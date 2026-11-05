// Student Star Manager (Settings › Student Tools), loaded when Student Tools opens.
// Two jobs on one star chart:
//   "Add missed stars": pick a class, the lesson day, a reason and the students; one tap
//   files a dated row for each of them. The day stays put while students are picked.
//   "Fix star counts": set one student's today / month / year counters, kept nested.
import * as state from "../state.js";
import {
    doesClassMeetOnDate,
    getStartOfMonthString,
} from "../utils.js";
import { getSchoolYearStartMonthDate } from "../utils/schoolYear.js";
import { showToast } from "../ui/effects.js";
import { playSound } from "../audio.js";
import {
    AWARD_LOG_REASON_ICONS,
    getAwardLogMonthlyStarCredit,
    getAwardReasonLabel,
} from "./awardLogReasonMeta.js";
import { planMonthlyRollover } from "./monthlyStarsCore.mjs";
import {
    MAX_STARS_PER_ADD,
    applyLinkedChange,
    formatDelta,
    monthLogStarsFor,
    parseCounter,
    parseStarsToAdd,
    recentLessonDays,
    roundToHalf,
    starWord,
    starsByStudentOnDay,
    toDDMMYYYY,
    toIsoDate,
    validateAwardDate,
    validateCounters,
} from "./starManagerCore.mjs";
import "../styles/star_manager.css";

const REASONS = ["teamwork", "creativity", "respect", "focus", "welcome_back", "correction"];

const ui = {
    root: null,
    mode: "add",
    classId: null,
    dateIso: "",
    reason: "teamwork",
    starsEach: 1,
    selected: new Set(),
    lastAdded: new Set(),
    lastResult: "",
    busy: false,
    progress: null,
    fixStudentId: null,
    counters: null,
    baseline: null,
    dirty: false,
    linked: true,
    stale: false,
    fixError: "",
    dayLogs: new Map(),
    unsubscribe: null,
    refreshTimer: null,
};

function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function myClasses() {
    return [...(state.get("allTeachersClasses") || [])].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function classStudents(classId) {
    return (state.get("allStudents") || [])
        .filter((s) => s.classId === classId)
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function scoreOf(studentId) {
    return (state.get("allStudentScores") || []).find((s) => s.id === studentId) || null;
}

function liveCounters(studentId) {
    const score = scoreOf(studentId) || {};
    return {
        today: roundToHalf(Number(state.get("todaysStars")?.[studentId]?.stars) || 0),
        monthly: roundToHalf(planMonthlyRollover(score, getStartOfMonthString()).base),
        total: roundToHalf(Number(score.totalStars) || 0),
    };
}

function yearStart() {
    const fromState = typeof state.getActiveSchoolYearStartDate === "function" ? state.getActiveSchoolYearStartDate() : null;
    return fromState || getSchoolYearStartMonthDate(null, state.getActiveSchoolYearKey?.());
}

function classMeetsOn(classId) {
    const classEndDates = state.get("teacherSettings")?.schoolYearSettings?.classEndDates || {};
    return (date) => doesClassMeetOnDate(
        classId,
        date,
        state.get("allSchoolClasses") || [],
        state.get("allScheduleOverrides") || [],
        state.get("schoolHolidayRanges") || [],
        classEndDates,
    );
}

function dayLabel(date, long = false) {
    return date.toLocaleDateString("en-GB", long
        ? { weekday: "long", day: "numeric", month: "long" }
        : { weekday: "short", day: "numeric", month: "short" });
}

function avatarHtml(student) {
    if (student.avatar) {
        return `<span class="sm-avatar"><img src="${esc(student.avatar)}" alt="" loading="lazy" decoding="async"></span>`;
    }
    const letter = String(student.name || "?").trim().charAt(0).toUpperCase() || "?";
    return `<span class="sm-avatar sm-avatar--letter" aria-hidden="true">${esc(letter)}</span>`;
}

// ── Day logs (what each student already has on the chosen day) ──────────────

function dayKey() {
    const check = validateAwardDate(ui.dateIso, { yearStart: yearStart() });
    return check.ok && ui.classId ? `${ui.classId}|${toDDMMYYYY(check.date)}` : null;
}

function dayLogsFor(key) {
    if (!key) return null;
    const entry = ui.dayLogs.get(key);
    if (entry) return entry;
    const fresh = { status: "loading", byStudent: {} };
    ui.dayLogs.set(key, fresh);
    const [classId, ddmmyyyy] = key.split("|");
    import("../db/actions/starManagerWrites.js")
        .then((m) => m.fetchClassDayAwardLogs(classId, ddmmyyyy))
        .then((rows) => {
            fresh.status = "ready";
            fresh.byStudent = starsByStudentOnDay(rows, ddmmyyyy, getAwardLogMonthlyStarCredit);
        })
        .catch((error) => {
            console.warn("Star Manager day check failed:", error);
            fresh.status = "error";
        })
        .finally(() => { if (ui.mode === "add") renderPanel(); });
    return fresh;
}

// ── Rendering ─────────────────────────────────────────────────────────────

function shellHtml() {
    return `
        <header class="sm-head">
            <span class="sm-head__seal" aria-hidden="true"><i class="fas fa-star"></i></span>
            <div class="sm-head__text">
                <span class="sm-head__kicker">Star chart</span>
                <h3 class="font-title sm-head__title">Student Star Manager</h3>
                <p class="sm-head__hint">Mend a lesson when stars weren't given, or set one student's star counts.</p>
            </div>
        </header>
        <div class="sm-modes" role="tablist" aria-label="What do you need?">
            <button type="button" class="sm-mode" role="tab" data-sm-mode="add">
                <span class="sm-mode__icon" aria-hidden="true"><i class="fas fa-calendar-plus"></i></span>
                <span class="sm-mode__text"><strong>Add missed stars</strong><small>For a past lesson, one student or many</small></span>
            </button>
            <button type="button" class="sm-mode" role="tab" data-sm-mode="fix">
                <span class="sm-mode__icon" aria-hidden="true"><i class="fas fa-sliders"></i></span>
                <span class="sm-mode__text"><strong>Fix star counts</strong><small>Set today, this month and this year</small></span>
            </button>
        </div>
        <div class="sm-classes" data-sm-classes></div>
        <div class="sm-panel" data-sm-panel aria-live="polite"></div>`;
}

function renderModes() {
    ui.root.querySelectorAll("[data-sm-mode]").forEach((btn) => {
        const on = btn.dataset.smMode === ui.mode;
        btn.classList.toggle("is-on", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    ui.root.dataset.smMode = ui.mode;
}

function renderClasses() {
    const host = ui.root.querySelector("[data-sm-classes]");
    const classes = myClasses();
    if (!classes.length) {
        host.innerHTML = `<p class="sm-empty"><i class="fas fa-moon" aria-hidden="true"></i> You have no classes yet. Add one in My Classes.</p>`;
        return;
    }
    host.innerHTML = `
        <span class="sm-label">Class</span>
        <div class="sm-chips" role="radiogroup" aria-label="Class">
            ${classes.map((c) => `
                <button type="button" class="sm-chip${c.id === ui.classId ? " is-on" : ""}" role="radio" aria-checked="${c.id === ui.classId}" data-sm-class="${esc(c.id)}">
                    ${c.logo ? `<span class="sm-chip__logo" aria-hidden="true">${esc(c.logo)}</span>` : ""}${esc(c.name)}
                </button>`).join("")}
        </div>`;
}

function renderPanel() {
    const host = ui.root?.querySelector("[data-sm-panel]");
    if (!host) return;
    if (!ui.classId) { host.innerHTML = ""; return; }
    host.innerHTML = ui.mode === "add" ? addPanelHtml() : fixPanelHtml();
}

function addPanelHtml() {
    const ys = yearStart();
    const now = new Date();
    const days = recentLessonDays(classMeetsOn(ui.classId), { now, yearStart: ys, limit: 6 });
    const check = validateAwardDate(ui.dateIso, { now, yearStart: ys });
    const chipIsos = days.map(toIsoDate);
    const otherPicked = ui.dateIso && !chipIsos.includes(ui.dateIso);
    const students = classStudents(ui.classId);
    const logs = check.ok ? dayLogsFor(dayKey()) : null;
    const byStudent = logs?.byStudent || {};
    const picked = students.filter((s) => ui.selected.has(s.id));
    const pickedWithStars = picked.filter((s) => byStudent[s.id]?.stars > 0).length;
    const stars = parseStarsToAdd(ui.starsEach);

    const dayChips = days.length
        ? days.map((d) => {
            const iso = toIsoDate(d);
            return `<button type="button" class="sm-day${iso === ui.dateIso ? " is-on" : ""}" data-sm-day="${iso}">
                <span class="sm-day__wd">${esc(d.toLocaleDateString("en-GB", { weekday: "short" }))}</span>
                <span class="sm-day__d">${d.getDate()}</span>
                <span class="sm-day__m">${esc(d.toLocaleDateString("en-GB", { month: "short" }))}</span>
            </button>`;
        }).join("")
        : `<p class="sm-note">No lessons found for this class in the last weeks. Choose the day below.</p>`;

    let dayLine = `<p class="sm-dayline sm-dayline--empty">Tap the day of the lesson.</p>`;
    if (ui.dateIso && !check.ok) dayLine = `<p class="sm-dayline sm-dayline--bad"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> ${esc(check.message)}</p>`;
    else if (check.ok) {
        dayLine = `<p class="sm-dayline"><i class="fas fa-star" aria-hidden="true"></i> Stars will be filed under <strong>${esc(dayLabel(check.date, true))}</strong>. The day stays the same while you pick students.</p>`;
        if (check.isToday) {
            dayLine += `<p class="sm-warn"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> That's today. Give today's stars in <strong>Award Stars</strong> instead: stars added here count for the month and the year, but not as today's stars, and other teachers can't see them on their star cards.</p>`;
        }
    }

    const reasonChips = REASONS.map((r) => `
        <button type="button" class="sm-reason${r === ui.reason ? " is-on" : ""}" role="radio" aria-checked="${r === ui.reason}" data-sm-reason="${r}">
            <i class="fas ${AWARD_LOG_REASON_ICONS[r] || "fa-star"}" aria-hidden="true"></i> ${esc(r === "welcome_back" ? "Welcome Back" : getAwardReasonLabel(r))}
        </button>`).join("");

    const pills = students.length
        ? students.map((s) => {
            const on = ui.selected.has(s.id);
            const had = byStudent[s.id]?.stars || 0;
            const done = ui.lastAdded.has(s.id);
            return `<button type="button" class="sm-pill${on ? " is-on" : ""}${done ? " is-done" : ""}" aria-pressed="${on}" data-sm-pick="${esc(s.id)}" ${ui.busy ? "disabled" : ""}>
                ${avatarHtml(s)}
                <span class="sm-pill__name">${esc(s.name)}</span>
                ${check.ok ? (logs?.status === "loading"
                    ? `<span class="sm-pill__day is-loading" aria-hidden="true">…</span>`
                    : had > 0 ? `<span class="sm-pill__day" title="Already has ${esc(starWord(roundToHalf(had)))} that day">★ ${roundToHalf(had)}</span>` : "") : ""}
                <span class="sm-pill__tick" aria-hidden="true"><i class="fas fa-check"></i></span>
            </button>`;
        }).join("")
        : `<p class="sm-empty">No students in this class yet.</p>`;

    const allOn = students.length > 0 && picked.length === students.length;
    let summary = ui.lastResult ? `<span class="sm-summary__ok"><i class="fas fa-circle-check" aria-hidden="true"></i> ${esc(ui.lastResult)}</span>` : "Pick the students who should have had stars.";
    if (!check.ok) summary = "Choose the lesson day first.";
    else if (stars === null) summary = `Stars each must be between 0.5 and ${MAX_STARS_PER_ADD}.`;
    else if (picked.length) {
        summary = `<strong>${esc(starWord(stars))}</strong> for <strong>${esc(getAwardReasonLabel(ui.reason))}</strong> to <strong>${picked.length === 1 ? esc(picked[0].name) : `${picked.length} students`}</strong> on <strong>${esc(dayLabel(check.date))}</strong>.`;
        if (pickedWithStars) summary += ` <span class="sm-summary__warn">${picked.length === 1 ? "They already have" : `${pickedWithStars} of them already ${pickedWithStars === 1 ? "has" : "have"}`} stars that day; these are added on top.</span>`;
    }
    const canAdd = check.ok && stars !== null && picked.length > 0 && !ui.busy;
    const btnText = ui.busy && ui.progress
        ? `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Adding ${ui.progress.done + 1 > ui.progress.total ? ui.progress.total : ui.progress.done + 1} of ${ui.progress.total}…`
        : `<i class="fas fa-star" aria-hidden="true"></i> Add stars${picked.length > 1 ? ` to ${picked.length}` : ""}`;

    return `
        <section class="sm-step">
            <h4 class="sm-step__title"><span class="sm-step__num">1</span> Which lesson?</h4>
            <div class="sm-days">${dayChips}</div>
            <label class="sm-other${otherPicked ? " is-on" : ""}">
                <span>Another day</span>
                <input type="date" class="sm-input" data-sm-date value="${esc(otherPicked ? ui.dateIso : "")}" max="${toIsoDate(now)}"${ys ? ` min="${toIsoDate(ys)}"` : ""}>
            </label>
            ${dayLine}
        </section>
        <section class="sm-step">
            <h4 class="sm-step__title"><span class="sm-step__num">2</span> What for?</h4>
            <div class="sm-reasons" role="radiogroup" aria-label="Reason">${reasonChips}</div>
            <div class="sm-each">
                <span class="sm-label">Stars each</span>
                <div class="sm-stepper">
                    <button type="button" class="sm-stepper__btn" data-sm-each="-0.5" aria-label="Fewer stars" ${stars !== null && stars <= 0.5 ? "disabled" : ""}><i class="fas fa-minus"></i></button>
                    <input type="number" class="sm-input sm-stepper__val" data-sm-each-input min="0.5" max="${MAX_STARS_PER_ADD}" step="0.5" value="${esc(ui.starsEach)}" aria-label="Stars each">
                    <button type="button" class="sm-stepper__btn" data-sm-each="0.5" aria-label="More stars" ${stars !== null && stars >= MAX_STARS_PER_ADD ? "disabled" : ""}><i class="fas fa-plus"></i></button>
                </div>
            </div>
        </section>
        <section class="sm-step">
            <div class="sm-step__row">
                <h4 class="sm-step__title"><span class="sm-step__num">3</span> Who?</h4>
                ${students.length ? `<button type="button" class="sm-link" data-sm-all="${allOn ? "none" : "all"}" ${ui.busy ? "disabled" : ""}>${allOn ? "Clear all" : "Pick everyone"}</button>` : ""}
            </div>
            ${check.ok && logs?.status === "error" ? `<p class="sm-note">Couldn't check that day's stars right now. You can still add them.</p>` : ""}
            <div class="sm-pills">${pills}</div>
        </section>
        <footer class="sm-foot">
            <p class="sm-summary">${summary}</p>
            <button type="button" class="sm-go" data-sm-add ${canAdd ? "" : "disabled"}>${btnText}</button>
        </footer>`;
}

function fixPanelHtml() {
    const students = classStudents(ui.classId);
    if (!students.length) return `<p class="sm-empty">No students in this class yet.</p>`;
    const pills = students.map((s) => {
        const on = s.id === ui.fixStudentId;
        const month = liveCounters(s.id).monthly;
        return `<button type="button" class="sm-pill sm-pill--fix${on ? " is-on" : ""}" aria-pressed="${on}" data-sm-fix="${esc(s.id)}">
            ${avatarHtml(s)}
            <span class="sm-pill__name">${esc(s.name)}</span>
            <span class="sm-pill__month" title="Stars this month">★ ${month}</span>
        </button>`;
    }).join("");

    const student = students.find((s) => s.id === ui.fixStudentId);
    if (!student || !ui.counters) {
        return `<p class="sm-step__lead">Tap a student to see their star counts.</p><div class="sm-pills">${pills}</div>`;
    }
    const c = ui.counters;
    const b = ui.baseline;
    const log = monthLogStarsFor(state.get("allAwardLogs") || [], student.id, new Date(), getAwardLogMonthlyStarCredit);
    const rows = [
        { key: "today", label: "Today", sub: "From your lesson today" },
        { key: "monthly", label: "This month", sub: "Team Quest, Hero's Challenge" },
        { key: "total", label: "This year", sub: "All stars since September" },
    ].map((r) => {
        const delta = formatDelta(c[r.key] - b[r.key]);
        return `<div class="sm-count${delta ? " is-changed" : ""}" data-sm-row="${r.key}">
            <div class="sm-count__label"><strong>${r.label}</strong><small>${r.sub}</small></div>
            <div class="sm-stepper">
                <button type="button" class="sm-stepper__btn" data-sm-step="${r.key}" data-sm-by="-0.5" aria-label="${r.label}: less" ${c[r.key] <= 0 || ui.busy ? "disabled" : ""}><i class="fas fa-minus"></i></button>
                <input type="number" class="sm-input sm-stepper__val" data-sm-count="${r.key}" min="0" step="0.5" value="${esc(c[r.key])}" aria-label="${r.label}" ${ui.busy ? "disabled" : ""}>
                <button type="button" class="sm-stepper__btn" data-sm-step="${r.key}" data-sm-by="0.5" aria-label="${r.label}: more" ${ui.busy ? "disabled" : ""}><i class="fas fa-plus"></i></button>
            </div>
            <span class="sm-count__delta">${delta ? `${b[r.key]} → ${c[r.key]} <em>${delta}</em>` : `was ${b[r.key]}`}</span>
        </div>`;
    }).join("");

    const logMatches = roundToHalf(log.stars) === roundToHalf(c.monthly);
    const logLine = log.count
        ? `<p class="sm-check${logMatches ? " is-ok" : ""}">
            <i class="fas ${logMatches ? "fa-circle-check" : "fa-scale-unbalanced"}" aria-hidden="true"></i>
            This month's star log adds up to <strong>${esc(starWord(log.stars))}</strong> (${log.count} ${log.count === 1 ? "entry" : "entries"}).
            ${logMatches ? "" : `<button type="button" class="sm-link" data-sm-match="${log.stars}">Set this month to ${log.stars}</button>`}
          </p>`
        : `<p class="sm-check"><i class="fas fa-scroll" aria-hidden="true"></i> No star log entries for ${esc(student.name)} this month yet.</p>`;

    return `
        <div class="sm-pills sm-pills--fix">${pills}</div>
        <div class="sm-counts">
            <div class="sm-counts__head">
                ${avatarHtml(student)}
                <div><strong>${esc(student.name)}</strong><small>Change a number, then save.</small></div>
            </div>
            ${ui.stale ? `<p class="sm-warn"><i class="fas fa-rotate" aria-hidden="true"></i> ${esc(student.name)}'s stars just changed somewhere else. <button type="button" class="sm-link" data-sm-reload>Load the new counts</button></p>` : ""}
            ${rows}
            <label class="sm-linked">
                <input type="checkbox" data-sm-linked ${ui.linked ? "checked" : ""}>
                <span>Keep them in step <small>(a star added to today is also added to this month and the year)</small></span>
            </label>
            ${logLine}
            <p class="sm-note">Saved counts don't add a line to the star log. Game bonus stars (Showdown, Quiz of the Week, Quiet Dragon) belong to this month and the year, never to today.</p>
            ${ui.fixError ? `<p class="sm-warn sm-warn--bad"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> ${esc(ui.fixError)}</p>` : ""}
            <div class="sm-foot sm-foot--fix">
                ${ui.dirty ? `<button type="button" class="sm-link" data-sm-reset ${ui.busy ? "disabled" : ""}>Undo changes</button>` : `<span class="sm-summary">No changes yet.</span>`}
                <button type="button" class="sm-go" data-sm-save ${ui.dirty && !ui.busy && !ui.stale ? "" : "disabled"}>
                    ${ui.busy ? `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Saving…` : `<i class="fas fa-check" aria-hidden="true"></i> Save ${esc(student.name)}'s counts`}
                </button>
            </div>
        </div>`;
}

function renderAll() {
    if (!ui.root) return;
    renderModes();
    renderClasses();
    renderPanel();
}

// ── Actions ───────────────────────────────────────────────────────────────

function pickClass(classId) {
    if (ui.classId === classId) return;
    ui.classId = classId;
    ui.selected = new Set();
    ui.lastAdded = new Set();
    ui.lastResult = "";
    ui.fixStudentId = null;
    ui.counters = null;
    ui.baseline = null;
    ui.dirty = false;
    ui.stale = false;
    ui.fixError = "";
    // The chosen day is kept: only an empty or impossible day moves to the class's last lesson.
    ensureDay();
    renderAll();
}

/** Starts the day at the class's last lesson before today when nothing is chosen. */
function ensureDay() {
    if (ui.dateIso) return;
    const last = recentLessonDays(classMeetsOn(ui.classId), { yearStart: yearStart(), limit: 1 })[0];
    if (last) ui.dateIso = toIsoDate(last);
}

function pickFixStudent(studentId) {
    ui.fixStudentId = studentId;
    ui.baseline = liveCounters(studentId);
    ui.counters = { ...ui.baseline };
    ui.dirty = false;
    ui.stale = false;
    ui.fixError = "";
    renderPanel();
}

function setCounter(field, value) {
    if (!ui.counters) return;
    ui.counters = applyLinkedChange(ui.counters, field, value, ui.linked);
    const b = ui.baseline;
    ui.dirty = ["today", "monthly", "total"].some((k) => roundToHalf(ui.counters[k]) !== roundToHalf(b[k]));
    ui.fixError = "";
    renderPanel();
}

async function addStars() {
    const ys = yearStart();
    const check = validateAwardDate(ui.dateIso, { yearStart: ys });
    const stars = parseStarsToAdd(ui.starsEach);
    const students = classStudents(ui.classId).filter((s) => ui.selected.has(s.id));
    if (!check.ok) { showToast(check.message, "error"); return; }
    if (stars === null) { showToast(`Stars each must be between 0.5 and ${MAX_STARS_PER_ADD}.`, "error"); return; }
    if (!students.length) { showToast("Pick at least one student.", "error"); return; }

    ui.busy = true;
    ui.progress = { done: 0, total: students.length };
    renderPanel();
    try {
        const { addMissedStars } = await import("../db/actions/starManagerWrites.js");
        const result = await addMissedStars({
            students,
            logDate: check.date,
            stars,
            reason: ui.reason,
            onProgress: (p) => { ui.progress = p; renderPanel(); },
        });
        ui.lastAdded = new Set(result.added);
        ui.selected = new Set(result.failed.map((f) => f.id));
        ui.dayLogs.delete(dayKey());
        const day = dayLabel(check.date);
        if (result.added.length) {
            playSound?.("star2");
            const who = result.added.length === 1
                ? (students.find((s) => s.id === result.added[0])?.name || "1 student")
                : `${result.added.length} students`;
            ui.lastResult = `${starWord(stars)} added to ${who} for ${day}.`;
            showToast(ui.lastResult, "success");
        }
        if (result.failed.length) {
            const names = result.failed.map((f) => students.find((s) => s.id === f.id)?.name || f.id).join(", ");
            showToast(`Not saved for ${names}: ${result.failed[0].message}. They're still picked, so you can try again.`, "error", 6000);
        }
    } catch (error) {
        console.error("Star Manager add failed:", error);
        showToast(`Couldn't add the stars: ${error?.message || error}`, "error");
    } finally {
        ui.busy = false;
        ui.progress = null;
        renderPanel();
    }
}

async function saveCounts() {
    const student = classStudents(ui.classId).find((s) => s.id === ui.fixStudentId);
    if (!student || !ui.counters) return;
    const check = validateCounters(ui.counters);
    if (!check.ok) { ui.fixError = check.message; renderPanel(); return; }
    ui.busy = true;
    renderPanel();
    try {
        const { setStudentStarCounts, StarCountsChangedError } = await import("../db/actions/starManagerWrites.js");
        try {
            await setStudentStarCounts({ studentId: student.id, values: check.values, baseline: ui.baseline });
            ui.baseline = { ...check.values };
            ui.counters = { ...check.values };
            ui.dirty = false;
            ui.stale = false;
            showToast(`${student.name}'s star counts are saved.`, "success");
        } catch (error) {
            if (error instanceof StarCountsChangedError) {
                ui.stale = true;
                ui.fixError = "";
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error("Star Manager save failed:", error);
        ui.fixError = `Couldn't save: ${error?.message || error}`;
    } finally {
        ui.busy = false;
        renderPanel();
    }
}

function onClick(event) {
    const t = event.target.closest("button, [data-sm-day]");
    if (!t || !ui.root.contains(t) || t.disabled) return;
    const d = t.dataset;
    if (d.smMode) {
        if (ui.mode !== d.smMode && !ui.busy) {
            ui.mode = d.smMode;
            renderModes();
            renderPanel();
            playSound?.("click");
        }
    } else if (d.smClass) {
        if (!ui.busy) { pickClass(d.smClass); playSound?.("click"); }
    } else if (d.smDay) {
        ui.dateIso = d.smDay;
        ui.lastAdded = new Set();
        ui.lastResult = "";
        renderPanel();
    } else if (d.smReason) {
        ui.reason = d.smReason;
        renderPanel();
    } else if (d.smEach) {
        const current = parseStarsToAdd(ui.starsEach) ?? 1;
        ui.starsEach = Math.min(MAX_STARS_PER_ADD, Math.max(0.5, roundToHalf(current + Number(d.smEach))));
        renderPanel();
    } else if (d.smPick) {
        if (ui.selected.has(d.smPick)) ui.selected.delete(d.smPick);
        else ui.selected.add(d.smPick);
        ui.lastAdded.delete(d.smPick);
        ui.lastResult = "";
        renderPanel();
    } else if (d.smAll) {
        ui.selected = d.smAll === "all" ? new Set(classStudents(ui.classId).map((s) => s.id)) : new Set();
        ui.lastAdded = new Set();
        ui.lastResult = "";
        renderPanel();
    } else if (d.smAdd !== undefined) {
        addStars();
    } else if (d.smFix) {
        if (!ui.busy && d.smFix !== ui.fixStudentId) pickFixStudent(d.smFix);
    } else if (d.smStep) {
        setCounter(d.smStep, (Number(ui.counters?.[d.smStep]) || 0) + Number(d.smBy));
    } else if (d.smMatch) {
        setCounter("monthly", Number(d.smMatch));
    } else if (d.smReset !== undefined) {
        ui.counters = { ...ui.baseline };
        ui.dirty = false;
        ui.fixError = "";
        renderPanel();
    } else if (d.smReload !== undefined) {
        pickFixStudent(ui.fixStudentId);
    } else if (d.smSave !== undefined) {
        saveCounts();
    }
}

function onChange(event) {
    const t = event.target;
    if (t.matches("[data-sm-date]")) {
        ui.dateIso = t.value || "";
        ui.lastAdded = new Set();
        ui.lastResult = "";
        renderPanel();
    } else if (t.matches("[data-sm-each-input]")) {
        const n = parseStarsToAdd(t.value);
        ui.starsEach = n === null ? t.value : n;
        renderPanel();
    } else if (t.matches("[data-sm-count]")) {
        const n = parseCounter(t.value);
        if (n === null) { ui.fixError = "Counts must be 0 or more."; renderPanel(); return; }
        setCounter(t.dataset.smCount, n);
    } else if (t.matches("[data-sm-linked]")) {
        ui.linked = t.checked;
    }
}

function onKeydown(event) {
    // Enter in a number box applies it (change fires), never submits anything else.
    if (event.key === "Enter" && event.target.matches("input[type=number]")) {
        event.preventDefault();
        event.target.blur();
    }
}

// ── Live data ─────────────────────────────────────────────────────────────

function scheduleRefresh() {
    if (!ui.root) return;
    clearTimeout(ui.refreshTimer);
    ui.refreshTimer = setTimeout(refreshFromState, 120);
}

function refreshFromState() {
    if (!ui.root?.isConnected) return;
    // Never redraw under the teacher's cursor: wait until they leave the box.
    const active = document.activeElement;
    if (active && ui.root.contains(active) && active.matches("input")) {
        active.addEventListener("blur", scheduleRefresh, { once: true });
        return;
    }
    const classes = myClasses();
    if (!classes.some((c) => c.id === ui.classId)) {
        ui.classId = null;
        const preferred = state.get("globalSelectedClassId");
        pickClass(classes.find((c) => c.id === preferred)?.id || classes[0]?.id || null);
        return;
    }
    const roster = classStudents(ui.classId);
    ui.selected = new Set([...ui.selected].filter((id) => roster.some((s) => s.id === id)));
    if (ui.fixStudentId && !roster.some((s) => s.id === ui.fixStudentId)) {
        ui.fixStudentId = null;
        ui.counters = null;
        ui.baseline = null;
        ui.dirty = false;
    } else if (ui.fixStudentId && ui.baseline && !ui.busy) {
        const live = liveCounters(ui.fixStudentId);
        const moved = ["today", "monthly", "total"].some((k) => live[k] !== ui.baseline[k]);
        if (moved && !ui.dirty) {
            ui.baseline = live;
            ui.counters = { ...live };
        } else if (moved) {
            ui.stale = true;
        }
    }
    renderClasses();
    renderPanel();
}

/** Builds the Star Manager into its card (once) and refreshes it. */
export function mountStarManager(root) {
    if (!root) return;
    if (ui.root !== root) {
        ui.root = root;
        root.classList.add("sm");
        root.innerHTML = shellHtml();
        root.addEventListener("click", onClick);
        root.addEventListener("change", onChange);
        root.addEventListener("keydown", onKeydown);
        ui.unsubscribe?.();
        ui.unsubscribe = state.subscribe(["allStudents", "allStudentScores", "allAwardLogs", "todaysStars"], scheduleRefresh);
        const classes = myClasses();
        const preferred = state.get("globalSelectedClassId");
        ui.classId = null;
        pickClass(classes.find((c) => c.id === preferred)?.id || classes[0]?.id || null);
        if (!ui.classId) renderAll();
        return;
    }
    refreshFromState();
}
