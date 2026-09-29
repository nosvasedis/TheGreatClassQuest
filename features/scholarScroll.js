// /features/scholarScroll.js
let loadedHistoricalScores = [];
let historySortDateDir = 'desc';   // 'desc' = newest first, 'asc' = oldest first
let historySortStudentBy = 'name'; // 'name' | 'name-desc' | 'score-desc' | 'score-asc'

/** Last class id used to render Scholar's Scroll (for swap animations on header class change). */
let lastRenderedScrollClassId = null;

/** Cleanup function for the bulk-trial custom date picker outside-click handler. */
let _dpOutsideClickHandler = null;

function scrollMotionReduced() {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Pending grading, makeups, upcoming-test ribbon — stays visually separate from the chart “stage”. */
function getScrollQueuesHost() {
    return document.getElementById('scroll-dashboard-queues') || document.getElementById('scroll-dashboard-content');
}

function setScrollPanelStack(showDashboard) {
    const dash = document.getElementById('scroll-dashboard-content');
    const ph = document.getElementById('scroll-placeholder');
    if (!dash || !ph) return;

    dash.classList.remove('hidden');
    ph.classList.remove('hidden');

    if (!dash.classList.contains('scroll-panel')) dash.classList.add('scroll-panel');
    if (!ph.classList.contains('scroll-panel')) ph.classList.add('scroll-panel');

    const on = Boolean(showDashboard);
    dash.classList.toggle('scroll-panel--fg', on);
    dash.classList.toggle('scroll-panel--bg', !on);
    ph.classList.toggle('scroll-panel--fg', !on);
    ph.classList.toggle('scroll-panel--bg', on);

    dash.setAttribute('aria-hidden', on ? 'false' : 'true');
    ph.setAttribute('aria-hidden', on ? 'true' : 'false');
}

function waitForAnimation(el, animName, fallbackMs) {
    return new Promise((resolve) => {
        if (!el || scrollMotionReduced()) {
            resolve();
            return;
        }
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            el.removeEventListener('animationend', onEnd);
            resolve();
        };
        const onEnd = (e) => {
            if (e.target === el && e.animationName === animName) finish();
        };
        el.addEventListener('animationend', onEnd);
        setTimeout(finish, fallbackMs);
    });
}

function bumpInnerReflow(inner) {
    if (inner) void inner.offsetWidth;
}

async function playInnerEnter(inner) {
    if (!inner || scrollMotionReduced()) return;
    inner.classList.remove('scroll-dashboard-inner--swap-out');
    inner.classList.add('scroll-dashboard-inner--swap-in');
    await waitForAnimation(inner, 'scroll-dash-inner-swap-in', 560);
    inner.classList.remove('scroll-dashboard-inner--swap-in');
}

async function playInnerClassSwap(inner, runRender) {
    if (!inner || scrollMotionReduced()) {
        runRender();
        return;
    }
    inner.classList.remove('scroll-dashboard-inner--swap-in');
    inner.classList.add('scroll-dashboard-inner--swap-out');
    await waitForAnimation(inner, 'scroll-dash-inner-swap-out', 400);
    runRender();
    inner.classList.remove('scroll-dashboard-inner--swap-out');
    bumpInnerReflow(inner);
    inner.classList.add('scroll-dashboard-inner--swap-in');
    await waitForAnimation(inner, 'scroll-dash-inner-swap-in', 560);
    inner.classList.remove('scroll-dashboard-inner--swap-in');
}

// --- IMPORTS ---
import { db, doc, addDoc, updateDoc, collection, serverTimestamp, writeBatch, runTransaction } from '../firebase.js';

import * as state from '../state.js';
import * as utils from '../utils.js';
import { showToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import * as modals from '../ui/modals.js';
import { wrapAvatarWithLevelUpIndicator } from '../ui/core/avatar.js';
import { HERO_CLASSES } from '../features/heroClasses.js';
import {
    getAssessmentSchemeForClass,
    getAssessmentValueLabel,
    getClassAssessmentUsage,
    getNearestQualitativeLabel,
    getNormalizedPercentForScore,
    getScheduledAssessmentStatus,
    getScheduledAssignmentForClassOnDate,
    classUsesTests,
    isAssessmentSchemeEnabled,
    normalizeAssessmentScheme,
    getUpcomingScheduledAssessment,
    listScheduledAssessmentsNeedingGrades
} from './assessmentConfig.js';
import {
    trialDateLabel,
    trialRowHtml,
    trialScaleLegendHtml,
    trialTipHtml,
    trialTally,
    trialTallyText,
    numericBandFor
} from './trialLogCore.mjs';
import {
    SCROLL_TIERS,
    competitionRanks,
    esc,
    formatPct,
    groupTrialSessions,
    mean,
    ringGaugeSvg,
    sparklineSvg,
    tierBarHtml,
    tierCounts,
    tierForPercent,
    trendFor
} from './scholarScrollCore.mjs';

function formatYmdFromAnyDateString(dateStr) {
    const d = utils.parseFlexibleDate(dateStr);
    const target = d || new Date();
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function pickBulkTestLogContext(classId) {
    const todayStr = utils.getTodayDateString();
    const incompletes = listScheduledAssessmentsNeedingGrades(classId);

    const urgent = incompletes.filter((s) => s.phase === 'missed' || s.phase === 'window_passed');
    urgent.sort((a, b) => a.dayDiff - b.dayDiff);

    if (urgent.length > 0) {
        const s = urgent[0];
        return {
            initialDate: formatYmdFromAnyDateString(s.testData.date),
            suggestedTitle: String(s.testData.title || '').trim(),
            status: s
        };
    }

    const todayIncomplete = incompletes.find((s) => utils.datesMatch(s.testData.date, todayStr));
    if (todayIncomplete) {
        return {
            initialDate: todayStr,
            suggestedTitle: String(todayIncomplete.testData.title || '').trim(),
            status: todayIncomplete
        };
    }

    const todayAssignment = getScheduledAssignmentForClassOnDate(classId, todayStr);
    if (todayAssignment?.testData) {
        const st = getScheduledAssessmentStatus(todayAssignment);
        return {
            initialDate: todayStr,
            suggestedTitle: String(todayAssignment.testData.title || '').trim(),
            status: st
        };
    }

    return {
        initialDate: todayStr,
        suggestedTitle: '',
        status: null
    };
}

function refreshBulkTrialScheduledHint(classId, type, dateVal) {
    // Badge removed — it was noisy and unhelpful during test entry.
    const hintEl = document.getElementById('bulk-trial-scheduled-hint');
    if (hintEl) hintEl.classList.add('hidden');
}

const TRIAL_SAVE_IDLE_HTML = '<i class="fas fa-stamp" aria-hidden="true"></i> Save results';

function todayIsoDate() {
    return formatYmdFromAnyDateString(utils.getTodayDateString());
}

function setTrialDateDisplay(isoDate) {
    const el = document.getElementById('bulk-trial-date-display');
    if (el) el.textContent = trialDateLabel(isoDate, todayIsoDate());
}

/** Reads what the teacher has put on the sheet so far, keyed by student id. */
function readTrialSheet() {
    const marks = new Map();
    document.querySelectorAll('#bulk-student-list .bulk-log-item').forEach((row) => {
        const input = row.querySelector('.bulk-grade-input');
        marks.set(row.dataset.studentId, {
            value: input ? input.value : '',
            absent: !!row.querySelector('.toggle-absent-btn')?.classList.contains('is-absent')
        });
    });
    return marks;
}

function updateTrialTally() {
    const rows = [...document.querySelectorAll('#bulk-student-list .bulk-log-item')];
    const tally = trialTally(rows.map((row) => ({
        absent: !!row.querySelector('.toggle-absent-btn')?.classList.contains('is-absent'),
        value: row.querySelector('.bulk-grade-input')?.value ?? ''
    })));
    const text = document.getElementById('bulk-trial-tally');
    const fill = document.getElementById('bulk-trial-tally-fill');
    if (text) text.textContent = rows.length ? trialTallyText(tally) : '';
    if (fill) fill.style.width = tally.present ? `${Math.round((tally.graded / tally.present) * 100)}%` : '0%';
    const saveBtn = document.getElementById('bulk-trial-save-btn');
    if (saveBtn) saveBtn.classList.toggle('is-ready', tally.graded > 0 && tally.graded === tally.present);
}

function setRowAbsent(row, isAbsent) {
    const btn = row.querySelector('.toggle-absent-btn');
    const input = row.querySelector('.bulk-grade-input');
    btn?.classList.toggle('is-absent', isAbsent);
    if (btn && !btn.classList.contains('hidden')) {
        btn.setAttribute('aria-pressed', isAbsent ? 'true' : 'false');
        btn.title = isAbsent ? 'Mark present' : 'Mark absent';
        btn.innerHTML = isAbsent
            ? '<i class="fas fa-user-slash" aria-hidden="true"></i><span>Absent</span>'
            : '<i class="fas fa-user-check" aria-hidden="true"></i><span>Present</span>';
    }
    row.classList.toggle('absent', isAbsent);
    row.querySelectorAll('.tl-stamp').forEach((stamp) => {
        stamp.disabled = isAbsent;
        if (isAbsent) {
            stamp.classList.remove('active');
            stamp.setAttribute('aria-pressed', 'false');
        }
    });
    if (input) {
        if (input.type !== 'hidden') input.disabled = isAbsent;
        if (isAbsent) {
            input.value = '';
            input.removeAttribute('data-grade');
            row.classList.remove('is-graded');
        }
    }
}

/** One set of delegated handlers for the whole sheet (re-assigned, never stacked). */
function wireTrialSheet(listContainer) {
    listContainer.onclick = (e) => {
        const attend = e.target.closest('.toggle-absent-btn');
        if (attend && listContainer.contains(attend)) {
            const row = attend.closest('.bulk-log-item');
            setRowAbsent(row, !attend.classList.contains('is-absent'));
            updateTrialTally();
            return;
        }
        const stamp = e.target.closest('.tl-stamp');
        if (stamp && !stamp.disabled) {
            const row = stamp.closest('.bulk-log-item');
            const input = row.querySelector('.bulk-grade-input');
            const wasActive = stamp.classList.contains('active');
            row.querySelectorAll('.tl-stamp').forEach((b) => {
                b.classList.remove('active', 'just-stamped');
                b.setAttribute('aria-pressed', 'false');
            });
            if (wasActive) {
                input.value = '';
            } else {
                input.value = stamp.dataset.value;
                stamp.classList.add('active', 'just-stamped');
                stamp.setAttribute('aria-pressed', 'true');
            }
            row.classList.toggle('is-graded', !!input.value);
            updateTrialTally();
        }
    };
    listContainer.oninput = (e) => {
        const input = e.target.closest('.bulk-grade-numeric');
        if (!input) return;
        const band = numericBandFor(input.value, input.max);
        if (band) input.setAttribute('data-grade', band);
        else input.removeAttribute('data-grade');
        input.closest('.bulk-log-item')?.classList.toggle('is-graded', input.value !== '');
        updateTrialTally();
    };
    listContainer.onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        const input = e.target.closest('.bulk-grade-numeric');
        if (!input) return;
        e.preventDefault();
        const inputs = [...listContainer.querySelectorAll('.bulk-grade-numeric:not(:disabled)')];
        const next = inputs[inputs.indexOf(input) + 1];
        if (next) {
            next.focus();
            next.select();
        } else {
            document.getElementById('bulk-trial-save-btn')?.focus();
        }
    };
    listContainer.onwheel = (e) => {
        if (e.target.closest('.bulk-grade-numeric') === document.activeElement) document.activeElement.blur();
    };
}

function populateBulkTrialStudentRows(classId, type, assessmentScheme, dateIso, carry = null) {
    const students = state.get('allStudents').filter((s) => s.classId === classId).sort((a, b) => a.name.localeCompare(b.name));
    const listContainer = document.getElementById('bulk-student-list');

    if (students.length === 0) {
        listContainer.innerHTML = `
            <div class="tl-empty">
                <div class="tl-empty__icon">🧭</div>
                <p class="tl-empty__title font-title">No students yet</p>
                <p class="tl-empty__text">Add students to this class to start logging trials.</p>
            </div>
        `;
        updateTrialTally();
        return;
    }

    const attendance = state.get('allAttendanceRecords').filter((r) => r.classId === classId && utils.datesMatch(r.date, dateIso));

    listContainer.innerHTML = students.map((student) => {
        const wasAbsent = attendance.some((r) => r.studentId === student.id);
        const kept = carry?.marks?.get(student.id);
        const isAbsent = carry?.keepAbsences && kept ? kept.absent : wasAbsent;
        const value = !isAbsent && carry?.keepValues && kept ? kept.value : '';
        return trialRowHtml({ student, scheme: assessmentScheme, isAbsent, wasAbsent, value });
    }).join('');

    wireTrialSheet(listContainer);
    updateTrialTally();
}

function rememberTrialType(classId, type) {
    try { localStorage.setItem(`gcq-trial-type-${classId}`, type); } catch (_) { /* private mode */ }
}

function recallTrialType(classId) {
    try { return localStorage.getItem(`gcq-trial-type-${classId}`); } catch (_) { return null; }
}

/** Resets the parts of the board that edit/makeup mode change. */
function resetTrialBoard({ tabsFor = null, scheme = null } = {}) {
    const board = document.getElementById('bulk-trial-shell');
    const tabs = document.getElementById('bulk-trial-type-switch');
    if (tabs) {
        tabs.classList.toggle('hidden', !tabsFor);
        tabs.querySelectorAll('.tl-tab').forEach((tab) => {
            const on = tab.dataset.trialType === tabsFor;
            tab.classList.toggle('is-active', on);
            tab.setAttribute('aria-selected', on ? 'true' : 'false');
        });
    }
    board?.classList.toggle('tl-board--tabbed', !!tabsFor);
    const legend = document.getElementById('bulk-trial-legend');
    if (legend) legend.innerHTML = trialScaleLegendHtml(scheme);
    const tip = document.getElementById('bulk-trial-tip-default');
    if (tip) tip.innerHTML = trialTipHtml(scheme);
    const saveBtn = document.getElementById('bulk-trial-save-btn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = TRIAL_SAVE_IDLE_HTML;
        saveBtn.dataset.idleHtml = TRIAL_SAVE_IDLE_HTML;
    }
    document.getElementById('bulk-trial-tip-default')?.classList.remove('hidden');
}

// --- TAB RENDERING ---

/** Viewer choices on the ledger + Honour Roll. The band filter resets when the class changes. */
const rollPrefs = { metric: 'overall', range: '3m', sort: 'rank', tier: 'all' };
/** Rows only animate in when what they show changes (class, metric, period), not on every live update. */
let lastRollRenderKey = '';
/** Pending Makeups folded shut, per class, for this session. */
const collapsedMakeups = new Set();

const RANGE_LABEL = { '30d': 'last 30 days', '3m': 'last 3 months' };
const METRIC_LABEL = { overall: 'Overall', test: 'Tests', dictation: 'Dictations' };

function findScrollClass(classId) {
    return (state.get('allSchoolClasses') || []).find((c) => c.id === classId)
        || (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || null;
}

/** Start of a period: 30 days back, or the first of the month three months back. */
function rangeStart(range) {
    const d = new Date();
    if (range === '30d') {
        d.setDate(d.getDate() - 30);
    } else {
        d.setMonth(d.getMonth() - 3);
        d.setDate(1);
    }
    d.setHours(0, 0, 0, 0);
    return d;
}

function shortDate(date, withYear = false) {
    if (!date) return '';
    const opts = { day: 'numeric', month: 'short' };
    if (withYear) opts.year = 'numeric';
    return date.toLocaleDateString('en-GB', opts);
}

function heroIconFor(student) {
    return student?.heroClass && HERO_CLASSES[student.heroClass] ? HERO_CLASSES[student.heroClass].icon : '';
}

function avatarMarkup(student, cls = 'ss-av', { enlargeable = false } = {}) {
    const name = esc(student?.name || '?');
    const extra = enlargeable ? ' enlargeable-avatar' : '';
    const data = enlargeable ? ` data-student-id="${esc(student.id)}"` : '';
    if (student?.avatar) {
        return `<img src="${esc(student.avatar)}" alt="${name}" loading="lazy" decoding="async" class="${cls}${extra}"${data}>`;
    }
    return `<span class="${cls} ${cls.split(' ')[0]}--initial${extra}"${data} aria-hidden="${enlargeable ? 'false' : 'true'}">${esc((student?.name || '?').charAt(0))}</span>`;
}

export async function renderScholarsScrollTab(selectedClassId = null, opts = {}) {
    const subtleReenter = opts.subtleReenter === true;
    const currentVal = selectedClassId || state.get('globalSelectedClassId');
    const inner = document.getElementById('scroll-dashboard-inner');

    if (currentVal) {
        const prevRendered = lastRenderedScrollClassId;
        const classChanged = prevRendered != null && prevRendered !== currentVal;
        const firstDashboardShow = prevRendered == null && currentVal != null;
        if (prevRendered !== currentVal) rollPrefs.tier = 'all';

        lastRenderedScrollClassId = currentVal;
        setScrollPanelStack(true);

        const runRender = () => {
            renderMissingWorkDashboard(currentVal);
            renderScrollDashboard(currentVal);
        };

        if (classChanged) {
            await playInnerClassSwap(inner, runRender);
        } else {
            runRender();
            if (firstDashboardShow || subtleReenter) await playInnerEnter(inner);
        }
    } else {
        lastRenderedScrollClassId = null;
        inner?.classList.remove('scroll-dashboard-inner--swap-in', 'scroll-dashboard-inner--swap-out');

        setScrollPanelStack(false);
    }
}

/** Everything the ledger and the roll need for one class and period. */
function buildScrollModel(classId, classData, range) {
    const since = rangeStart(range);
    const usage = getClassAssessmentUsage(classData);
    const students = (state.get('allStudents') || []).filter((s) => s.classId === classId);
    const classScores = [];
    (state.get('allWrittenScores') || []).forEach((score) => {
        if (score.classId !== classId || !score.date) return;
        if (score.type !== 'test' && score.type !== 'dictation') return;
        const date = utils.parseFlexibleDate(score.date);
        if (!date) return;
        const pct = getNormalizedPercentForScore(score, classData);
        if (!Number.isFinite(pct)) return;
        classScores.push({ score, date, time: date.getTime(), pct });
    });
    classScores.sort((a, b) => a.time - b.time);
    const scores = classScores.filter((e) => e.date >= since);

    const byStudent = new Map();
    scores.forEach((e) => {
        if (!byStudent.has(e.score.studentId)) byStudent.set(e.score.studentId, { test: [], dictation: [] });
        byStudent.get(e.score.studentId)[e.score.type].push(e);
    });

    const showTests = usage.tests || classScores.some((e) => e.score.type === 'test');
    const showDictations = usage.dictations || classScores.some((e) => e.score.type === 'dictation');

    /** Weighted 60/40 when the class uses both, as elsewhere in the app. */
    const metricValue = (bucket, metric) => {
        if (!bucket) return null;
        const t = mean(bucket.test.map((e) => e.pct));
        const d = mean(bucket.dictation.map((e) => e.pct));
        if (metric === 'test') return t;
        if (metric === 'dictation') return d;
        if (t !== null && d !== null) {
            if (usage.tests && !usage.dictations) return t;
            if (usage.dictations && !usage.tests) return d;
            return (t * 0.6) + (d * 0.4);
        }
        return t ?? d;
    };
    const seriesFor = (bucket, metric) => {
        if (!bucket) return [];
        if (metric === 'test' || metric === 'dictation') return bucket[metric];
        return [...bucket.test, ...bucket.dictation].sort((a, b) => a.time - b.time);
    };

    return { since, usage, students, classScores, scores, byStudent, showTests, showDictations, metricValue, seriesFor };
}

function schemeForMetric(classData, metric, usage) {
    if (metric === 'test') return getAssessmentSchemeForClass(classData, 'test');
    if (metric === 'dictation') return getAssessmentSchemeForClass(classData, 'dictation');
    const t = getAssessmentSchemeForClass(classData, 'test');
    const d = getAssessmentSchemeForClass(classData, 'dictation');
    if (usage.tests && usage.dictations) return t.mode === 'qualitative' && d.mode === 'qualitative' ? t : null;
    return usage.dictations ? d : t;
}

function qualLabel(scheme, pct) {
    if (!scheme || scheme.mode !== 'qualitative' || !Number.isFinite(pct)) return '';
    return getNearestQualitativeLabel(scheme, pct);
}

function renderScrollDashboard(classId) {
    const classData = findScrollClass(classId);
    const ledgerEl = document.getElementById('scroll-stats-cards');
    const chartEl = document.getElementById('scroll-performance-chart');
    const toolbarEl = document.getElementById('scroll-chart-toolbar');
    const legendEl = document.getElementById('scroll-chart-legend');
    const rollEl = document.getElementById('scroll-chart-section');
    if (!chartEl || !classData) return;

    renderUpcomingTestNotice(classId, classData);

    const model = buildScrollModel(classId, classData, rollPrefs.range);
    const { usage, showTests, showDictations } = model;
    const bothKinds = showTests && showDictations;
    if (!bothKinds) rollPrefs.metric = 'overall';
    const metric = rollPrefs.metric;

    const renderKey = `${classId}|${metric}|${rollPrefs.range}|${rollPrefs.sort}|${rollPrefs.tier}`;
    const animate = renderKey !== lastRollRenderKey && !scrollMotionReduced();
    lastRollRenderKey = renderKey;
    rollEl?.classList.toggle('ss-roll--animate', animate);
    ledgerEl?.classList.toggle('ss-ledger--animate', animate);

    // Does not use tests or dictations and never did.
    if (!usage.any && model.classScores.length === 0) {
        ledgerEl.innerHTML = '';
        ledgerEl.hidden = true;
        toolbarEl.innerHTML = '';
        legendEl.innerHTML = '';
        chartEl.innerHTML = emptyStateHtml({
            icon: 'fa-feather-alt',
            title: 'No trials for this class',
            text: 'This class does not use tests or dictations. The secretary can turn them on in Grading.'
        });
        wireScrollControls(classId);
        return;
    }

    // --- Rows for the roll ---
    const rows = model.students.map((student) => {
        const bucket = model.byStudent.get(student.id);
        return {
            student,
            bucket,
            value: model.metricValue(bucket, metric),
            overall: model.metricValue(bucket, 'overall'),
            series: model.seriesFor(bucket, metric)
        };
    });
    const graded = rows.filter((r) => r.value !== null)
        .sort((a, b) => (b.value - a.value) || a.student.name.localeCompare(b.student.name));
    const ranks = competitionRanks(graded.map((r) => Math.round(r.value * 10)));
    graded.forEach((r, i) => { r.rank = ranks[i]; r.tier = tierForPercent(r.value); });
    const awaiting = rows.filter((r) => r.value === null).sort((a, b) => a.student.name.localeCompare(b.student.name));
    const classAvg = mean(graded.map((r) => r.value));

    ledgerEl.hidden = false;
    ledgerEl.innerHTML = ledgerHtml(classData, model, rows, metric);
    toolbarEl.innerHTML = toolbarHtml(bothKinds, metric);

    if (graded.length === 0) {
        legendEl.innerHTML = '';
        const olderData = rollPrefs.range === '30d' && model.classScores.some((e) => e.date >= rangeStart('3m'));
        const kindWord = usage.tests && usage.dictations ? 'trial' : (usage.tests ? 'test' : 'dictation');
        chartEl.innerHTML = olderData
            ? emptyStateHtml({
                icon: 'fa-hourglass-half',
                title: 'A quiet month',
                text: 'Nothing was graded in the last 30 days.',
                action: '<button type="button" class="ss-btn ss-btn--ink" data-ss-range="3m"><i class="fas fa-calendar-alt" aria-hidden="true"></i> Show the last 3 months</button>'
            })
            : emptyStateHtml({
                icon: 'fa-feather-alt',
                title: metric === 'overall' ? 'The roll is still blank' : `No ${METRIC_LABEL[metric].toLowerCase()} yet`,
                text: `Log a ${metric === 'overall' ? kindWord : metric} to see the performance chart!`,
                action: usage.any ? '<button type="button" class="ss-btn ss-btn--seal" data-ss-action="log-trial"><i class="fas fa-feather-alt" aria-hidden="true"></i> Log New Trial</button>' : ''
            });
        wireScrollControls(classId);
        return;
    }

    const counts = { high: 0, mid: 0, low: 0 };
    graded.forEach((r) => { counts[r.tier] += 1; });
    if (rollPrefs.tier !== 'all' && !counts[rollPrefs.tier]) rollPrefs.tier = 'all';
    legendEl.innerHTML = legendHtml(counts, graded.length, classAvg);

    const scheme = schemeForMetric(classData, metric, usage);
    let visible = rollPrefs.tier === 'all' ? graded : graded.filter((r) => r.tier === rollPrefs.tier);
    if (rollPrefs.sort === 'name') visible = [...visible].sort((a, b) => a.student.name.localeCompare(b.student.name));

    const scoreMeta = new Map((state.get('allStudentScores') || []).map((sc) => [sc.id, sc]));
    const rowsHtml = visible.map((r, i) => rollRowHtml(r, i, { metric, scheme, classAvg, scoreMeta })).join('');

    chartEl.innerHTML = `
        <div class="ss-list-head" aria-hidden="true">
            <span>Rank</span><span>Scholar</span><span>${metric === 'overall' ? 'Average' : `${METRIC_LABEL[metric]} average`} · ${RANGE_LABEL[rollPrefs.range]}</span><span>Recent</span>
        </div>
        <ol class="ss-list" aria-label="Scholars ranked by ${metric === 'overall' ? 'average' : METRIC_LABEL[metric].toLowerCase() + ' average'}">${rowsHtml}</ol>
        ${awaitingHtml(awaiting, metric)}
    `;
    wireScrollControls(classId);
}

function emptyStateHtml({ icon, title, text, action = '' }) {
    return `
        <div class="ss-empty">
            <span class="ss-empty__art" aria-hidden="true"><i class="fas ${icon}"></i></span>
            <p class="ss-empty__title">${esc(title)}</p>
            <p class="ss-empty__text">${esc(text)}</p>
            ${action ? `<div class="ss-empty__actions">${action}</div>` : ''}
        </div>`;
}

function segHtml(name, options, active, label, extraClass = '') {
    return `<div class="ss-seg ${extraClass}" role="group" aria-label="${esc(label)}">${options.map(([val, text, icon]) => `
        <button type="button" class="ss-seg__btn${val === active ? ' is-active' : ''}" data-ss-${name}="${val}" aria-pressed="${val === active}">
            ${icon ? `<i class="fas ${icon}" aria-hidden="true"></i>` : ''}<span>${text}</span>
        </button>`).join('')}</div>`;
}

function toolbarHtml(bothKinds, metric) {
    const metricSeg = bothKinds
        ? segHtml('metric', [['overall', 'Overall', 'fa-layer-group'], ['test', 'Tests', 'fa-file-alt'], ['dictation', 'Dictations', 'fa-microphone-alt']], metric, 'Rank by')
        : '';
    const sortSeg = segHtml('sort', [['rank', 'Rank', 'fa-trophy'], ['name', 'A–Z', 'fa-sort-alpha-down']], rollPrefs.sort, 'Order', 'ss-seg--quiet');
    return `${metricSeg}${sortSeg}`;
}

function legendHtml(counts, total, classAvg) {
    const chip = (key, label, range, n) => `
        <button type="button" class="ss-chip${rollPrefs.tier === key ? ' is-active' : ''}" data-ss-tier="${key}" aria-pressed="${rollPrefs.tier === key}" ${key !== 'all' && !n ? 'disabled' : ''}>
            ${key !== 'all' ? `<span class="ss-chip__dot" data-tier="${key}" aria-hidden="true"></span>` : ''}
            <span>${label}</span>${range ? `<small>${range}</small>` : ''}<b>${n}</b>
        </button>`;
    return `
        <div class="ss-legend" role="group" aria-label="Show scholars by band">
            ${chip('all', 'All scholars', '', total)}
            ${SCROLL_TIERS.map((t) => chip(t.key, t.label, t.range, counts[t.key])).join('')}
        </div>
        <span class="ss-legend__key" title="The dashed line on every bar marks the class average">
            <span class="ss-legend__mark" aria-hidden="true"></span>Class average <b>${formatPct(classAvg)}</b>
        </span>`;
}

function rollRowHtml(r, index, { metric, scheme, classAvg, scoreMeta }) {
    const { student, value, series, bucket, rank, tier } = r;
    const pendingSkill = !!scoreMeta.get(student.id)?.pendingSkillChoice;
    const avatar = wrapAvatarWithLevelUpIndicator(avatarMarkup(student, 'ss-row__img', { enlargeable: true }), pendingSkill);
    const tests = bucket?.test.length || 0;
    const dicts = bucket?.dictation.length || 0;
    const parts = [];
    if (metric !== 'dictation' && tests) parts.push(`${tests} test${tests === 1 ? '' : 's'}`);
    if (metric !== 'test' && dicts) parts.push(`${dicts} dictation${dicts === 1 ? '' : 's'}`);
    const last = series[series.length - 1];
    if (last) parts.push(`last ${shortDate(last.date)}`);
    const pcts = series.map((e) => e.pct);
    const trend = trendFor(pcts);
    const trendHtml = trend
        ? `<span class="ss-trend" data-dir="${trend.dir}" title="Latest ${formatPct(trend.latest, 0)} vs earlier average ${formatPct(trend.prior, 0)}">
                <i class="fas fa-${trend.dir === 'up' ? 'arrow-up' : (trend.dir === 'down' ? 'arrow-down' : 'minus')}" aria-hidden="true"></i>${trend.dir === 'steady' ? '' : Math.round(Math.abs(trend.delta))}
                <span class="sr-only">${trend.dir === 'up' ? 'improving' : (trend.dir === 'down' ? 'slipping' : 'steady')}</span>
            </span>`
        : '<span class="ss-trend" data-dir="none" title="One result so far">·</span>';
    const qual = qualLabel(scheme, value);
    return `
        <li class="ss-row" data-tier="${tier}" style="--i:${Math.min(index, 24)}">
            <span class="ss-rank"${rank <= 3 ? ` data-podium="${rank}"` : ''} title="Rank ${rank}">${rank}</span>
            <span class="ss-row__avatar">${avatar}</span>
            <button type="button" class="ss-row__who chart-label-button" data-student-id="${esc(student.id)}" aria-label="Open analytics for ${esc(student.name)}">
                <span class="ss-row__name">${heroIconFor(student) ? `<span class="ss-row__hero" aria-hidden="true">${heroIconFor(student)}</span>` : ''}${esc(student.name)}</span>
                <span class="ss-row__meta">${esc(parts.join(' · '))}</span>
            </button>
            <span class="ss-row__track" role="img" aria-label="${esc(student.name)}: ${formatPct(value)}">
                <span class="ss-row__guide" style="left:50%" aria-hidden="true"></span>
                <span class="ss-row__guide" style="left:80%" aria-hidden="true"></span>
                <span class="ss-row__fill" data-tier="${tier}" style="--w:${(Math.max(1.5, value) / 100).toFixed(4)}"></span>
                ${Number.isFinite(classAvg) ? `<span class="ss-row__avg" style="left:${classAvg.toFixed(2)}%" aria-hidden="true"></span>` : ''}
            </span>
            <span class="ss-row__score"><b>${formatPct(value)}</b>${qual ? `<small>${esc(qual)}</small>` : ''}</span>
            <span class="ss-row__recent">${sparklineSvg(pcts)}${trendHtml}</span>
        </li>`;
}

function awaitingHtml(awaiting, metric) {
    if (!awaiting.length) return '';
    const noun = metric === 'overall' ? 'a trial' : (metric === 'test' ? 'a test' : 'a dictation');
    return `
        <div class="ss-awaiting">
            <p class="ss-awaiting__title"><i class="fas fa-hourglass-half" aria-hidden="true"></i> Waiting for ${noun} <b>${awaiting.length}</b></p>
            <div class="ss-awaiting__list">${awaiting.map(({ student }) => `
                <button type="button" class="ss-awaiting__chip chart-label-button" data-student-id="${esc(student.id)}" aria-label="Open analytics for ${esc(student.name)}">
                    ${avatarMarkup(student, 'ss-awaiting__av')}<span>${esc(student.name)}</span>
                </button>`).join('')}
            </div>
        </div>`;
}

function ledgerHtml(classData, model, rows, metric) {
    const { usage, scores, showTests, showDictations } = model;
    const bothKinds = showTests && showDictations;
    const overallVals = rows.map((r) => r.overall).filter((v) => v !== null);
    const classAvg = mean(overallVals);
    const overallScheme = schemeForMetric(classData, 'overall', usage);

    // Momentum: the last 30 days against the 60 days before them.
    const now = Date.now();
    const DAY = 86400000;
    const recent = mean(model.classScores.filter((e) => e.time >= now - 30 * DAY).map((e) => e.pct));
    const earlier = mean(model.classScores.filter((e) => e.time < now - 30 * DAY && e.time >= now - 90 * DAY).map((e) => e.pct));
    let momentum = '';
    if (recent !== null && earlier !== null) {
        const delta = recent - earlier;
        const dir = delta >= 2 ? 'up' : (delta <= -2 ? 'down' : 'steady');
        momentum = `<span class="ss-momentum" data-dir="${dir}" title="Average of the last 30 days (${formatPct(recent, 0)}) against the two months before (${formatPct(earlier, 0)})">
            <i class="fas fa-${dir === 'up' ? 'arrow-trend-up' : (dir === 'down' ? 'arrow-trend-down' : 'equals')}" aria-hidden="true"></i>
            ${dir === 'steady' ? 'Holding steady' : `${dir === 'up' ? '+' : '−'}${Math.abs(delta).toFixed(1)} pts this month`}
        </span>`;
    }

    const kindTile = (type) => {
        const entries = scores.filter((e) => e.score.type === type);
        const avg = mean(entries.map((e) => e.pct));
        const sessions = new Set(entries.map((e) => `${e.score.date}|${String(e.score.title || '').trim().toLowerCase()}`));
        const latest = entries[entries.length - 1];
        const scheme = getAssessmentSchemeForClass(classData, type);
        const qual = qualLabel(scheme, avg);
        const isTest = type === 'test';
        const latestName = latest ? (isTest ? (String(latest.score.title || '').trim() || 'Test') : 'Dictation') : '';
        const active = bothKinds && metric === type;
        const tag = bothKinds ? 'button' : 'div';
        return `
            <${tag} ${bothKinds ? `type="button" data-ss-metric="${type}" aria-pressed="${active}" title="Rank the roll by ${isTest ? 'tests' : 'dictations'}"` : ''} class="ss-tile ss-tile--${type}${active ? ' is-active' : ''}">
                <span class="ss-tile__icon" aria-hidden="true"><i class="fas ${isTest ? 'fa-file-alt' : 'fa-microphone-alt'}"></i></span>
                <span class="ss-tile__label">${isTest ? 'Tests' : 'Dictations'}</span>
                <span class="ss-tile__value">${avg === null ? '--' : formatPct(avg, 0)}${qual ? `<small>${esc(qual)}</small>` : ''}</span>
                <span class="ss-tile__note">${sessions.size ? `${sessions.size} ${isTest ? 'test' : 'dictation'}${sessions.size === 1 ? '' : 's'} · ${entries.length} results` : 'None logged yet'}</span>
                ${latest ? `<span class="ss-tile__latest"><i class="fas fa-bookmark" aria-hidden="true"></i><span>${esc(latestName)}</span><em>${shortDate(latest.date)}</em></span>` : ''}
            </${tag}>`;
    };

    const top = rows.filter((r) => r.overall !== null).sort((a, b) => b.overall - a.overall);
    const topVal = top[0]?.overall;
    const leaders = top.filter((r) => Math.abs(r.overall - topVal) < 0.05).slice(0, 3);
    const starTile = `
        <div class="ss-tile ss-tile--star">
            <span class="ss-tile__icon" aria-hidden="true"><i class="fas fa-crown"></i></span>
            <span class="ss-tile__label">Top scholar${leaders.length > 1 ? 's' : ''}</span>
            ${leaders.length ? `
                <span class="ss-star">
                    <span class="ss-star__avs">${leaders.map((r) => avatarMarkup(r.student, 'ss-star__av')).join('')}</span>
                    <span class="ss-star__names">${leaders.map((r) => `<button type="button" class="ss-star__name chart-label-button" data-student-id="${esc(r.student.id)}">${esc(r.student.name)}</button>`).join('')}</span>
                </span>
                <span class="ss-tile__note">${formatPct(topVal)} overall average</span>`
        : '<span class="ss-tile__note">Crowned after the first graded trial</span>'}
        </div>`;

    const overallActive = bothKinds && metric === 'overall';
    const avgTag = bothKinds ? 'button' : 'div';
    return `
        <div class="ss-ledger__bar">
            <p class="ss-ledger__caption"><span class="ss-ledger__logo" aria-hidden="true">${esc(classData.logo || '📜')}</span><span>${esc(classData.name || 'Class')}</span><em>· ${RANGE_LABEL[rollPrefs.range]}</em></p>
            <div class="ss-ledger__actions">
                ${segHtml('range', [['30d', '30 days'], ['3m', '3 months']], rollPrefs.range, 'Period', 'ss-seg--sm')}
                <button type="button" class="ss-btn ss-btn--ghost" data-ss-action="history" title="Browse every logged test and dictation"><i class="fas fa-book-open" aria-hidden="true"></i><span>History</span></button>
                ${usage.any ? '<button type="button" class="ss-btn ss-btn--seal" data-ss-action="log-trial"><i class="fas fa-feather-alt" aria-hidden="true"></i><span>Log New Trial</span></button>' : ''}
            </div>
        </div>
        <div class="ss-ledger__grid${bothKinds ? '' : ' ss-ledger__grid--three'}">
            <${avgTag} ${bothKinds ? `type="button" data-ss-metric="overall" aria-pressed="${overallActive}" title="Rank the roll by the overall average"` : ''} class="ss-tile ss-tile--avg${overallActive ? ' is-active' : ''}">
                <span class="ss-tile__gauge">${ringGaugeSvg(classAvg)}<span class="ss-tile__gauge-value">${classAvg === null ? '--' : formatPct(classAvg, 0)}</span></span>
                <span class="ss-tile__stack">
                    <span class="ss-tile__label">Class average</span>
                    <span class="ss-tile__headline">${classAvg === null ? 'No grades yet' : esc(qualLabel(overallScheme, classAvg) || SCROLL_TIERS.find((t) => t.key === tierForPercent(classAvg)).label)}</span>
                    <span class="ss-tile__note">${overallVals.length} of ${rows.length} scholar${rows.length === 1 ? '' : 's'} graded${bothKinds ? ' · tests 60% · dictations 40%' : ''}</span>
                    ${momentum}
                </span>
            </${avgTag}>
            ${showTests ? kindTile('test') : ''}
            ${showDictations ? kindTile('dictation') : ''}
            ${starTile}
        </div>`;
}

/** One set of delegated handlers on the tab (re-assigned each render, never stacked). */
function wireScrollControls(classId) {
    const host = document.getElementById('scroll-dashboard-inner');
    if (!host) return;
    host.onclick = (e) => {
        const btn = e.target.closest('[data-ss-metric],[data-ss-range],[data-ss-sort],[data-ss-tier],[data-ss-action]');
        if (!btn || !host.contains(btn) || btn.disabled) return;
        const d = btn.dataset;
        if (d.ssAction === 'log-trial') {
            openTrialTypeModal(classId);
            return;
        }
        if (d.ssAction === 'history') {
            openTrialHistoryModal(classId);
            return;
        }
        if (d.ssMetric) rollPrefs.metric = d.ssMetric;
        if (d.ssRange) rollPrefs.range = d.ssRange;
        if (d.ssSort) rollPrefs.sort = d.ssSort;
        if (d.ssTier) rollPrefs.tier = d.ssTier;
        renderScrollDashboard(classId);
    };
}

function renderUpcomingTestNotice(classId, classData) {
    const queuesHost = getScrollQueuesHost();
    document.getElementById('scroll-test-alert')?.remove();
    const upcoming = classUsesTests(classData) ? getUpcomingScheduledAssessment(classId) : null;
    if (!upcoming || !queuesHost) return;

    const canLog = ['today', 'later_today', 'in_progress', 'window_passed', 'missed'].includes(upcoming.phase);
    const note = upcoming.phase === 'missed'
        ? 'Announced with <strong>Schedule a Test</strong> on the Quest Board. Log results for everyone who wrote it so Pending Makeups stay accurate.'
        : (upcoming.phase === 'window_passed'
            ? 'The lesson has ended. Capture the grades while memory is fresh; title and date stay tied to what you announced.'
            : '');
    const notice = document.createElement('article');
    notice.id = 'scroll-test-alert';
    notice.className = 'ss-notice ss-notice--test';
    notice.dataset.tone = upcoming.tone || 'amber';
    notice.innerHTML = `
        <span class="ss-notice__seal" aria-hidden="true"><i class="fas fa-${esc(upcoming.icon)}"></i></span>
        <div class="ss-notice__body">
            <p class="ss-notice__kicker"><span>${esc(upcoming.statusLabel)}</span><em>${esc(upcoming.chipLabel)}</em></p>
            <h4 class="ss-notice__title">${esc(upcoming.testData.title || 'Scheduled test')}</h4>
            <p class="ss-notice__text"><i class="far fa-calendar" aria-hidden="true"></i> ${esc(upcoming.detailLabel)}</p>
            ${note ? `<p class="ss-notice__hint">${note}</p>` : ''}
            ${upcoming.testData.curriculum ? `<p class="ss-notice__topics"><b>Topics</b> ${esc(upcoming.testData.curriculum)}</p>` : ''}
        </div>
        ${canLog ? `<button type="button" class="ss-btn ss-btn--seal ss-notice__cta"><i class="fas fa-feather-alt" aria-hidden="true"></i> Log results</button>` : ''}
    `;
    notice.querySelector('.ss-notice__cta')?.addEventListener('click', () => {
        openBulkLogModal(classId, 'test', {
            presetDate: formatYmdFromAnyDateString(upcoming.testData.date),
            presetTitle: String(upcoming.testData.title || '').trim()
        });
    });
    queuesHost.prepend(notice);
}

// --- NEW MODAL LOGIC ---

/** Log New Trial: one marking board; a Dictation / Test tab pair when the class uses both. */
export function openTrialTypeModal(classId) {
    if (!classId) return;
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classData) return;
    const usage = getClassAssessmentUsage(classData);
    if (!usage.any) {
        showToast('This class does not use tests or dictations.', 'info');
        return;
    }
    if (usage.tests && !usage.dictations) {
        openBulkLogModal(classId, 'test');
        return;
    }
    if (!usage.tests && usage.dictations) {
        openBulkLogModal(classId, 'dictation');
        return;
    }
    // A test on the calendar (today or overdue) wins; otherwise the kind last logged for this class.
    const scheduled = pickBulkTestLogContext(classId).status;
    const last = recallTrialType(classId);
    const type = scheduled ? 'test' : (last === 'test' || last === 'dictation' ? last : 'dictation');
    openBulkLogModal(classId, type, { allowTypeSwitch: true });
}

function setupBulkDatePicker() {
    const chip = document.getElementById('bulk-trial-date-chip');
    const picker = document.getElementById('bulk-trial-date-picker');
    const hiddenInput = document.getElementById('bulk-trial-date');
    const shell = document.getElementById('bulk-trial-shell');
    const chevron = chip?.querySelector('.dp-chevron');
    if (!chip || !picker || !hiddenInput) return;
    let closeAnimTimer = null;

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const activeYearStart = state.getActiveSchoolYearStartDate();
    const activeYearEnd = state.getActiveSchoolYearEndDate();

    let dpState = { day: 1, month: 1, year: new Date().getFullYear() };

    const setStateFromDate = (date) => {
        dpState = {
            day: date.getDate(),
            month: date.getMonth() + 1,
            year: date.getFullYear()
        };
    };

    const parseFromInput = () => {
        const val = hiddenInput.value;
        if (!val) return;
        const [y, m, d] = val.split('-').map(Number);
        dpState = { day: d, month: m, year: y };
    };

    const clampDay = () => {
        const max = new Date(dpState.year, dpState.month, 0).getDate();
        if (dpState.day > max) dpState.day = max;
        const selected = new Date(dpState.year, dpState.month - 1, dpState.day);
        if (activeYearStart && selected < activeYearStart) setStateFromDate(activeYearStart);
        else if (activeYearEnd && selected > activeYearEnd) setStateFromDate(activeYearEnd);
    };

    const renderDp = () => {
        clampDay();
        document.getElementById('dp-day').textContent = String(dpState.day).padStart(2, '0');
        document.getElementById('dp-month').textContent = MONTHS[dpState.month - 1];
        document.getElementById('dp-year').textContent = String(dpState.year);
    };

    const closeDp = () => {
        if (closeAnimTimer) {
            clearTimeout(closeAnimTimer);
            closeAnimTimer = null;
        }
        picker.classList.remove('bulk-date-picker--open');
        picker.classList.add('bulk-date-picker--closing');
        chip.setAttribute('aria-expanded', 'false');
        if (chevron) chevron.style.transform = '';
        if (_dpOutsideClickHandler) {
            document.removeEventListener('click', _dpOutsideClickHandler, true);
            _dpOutsideClickHandler = null;
        }
        closeAnimTimer = setTimeout(() => {
            picker.classList.add('hidden');
            picker.classList.remove('bulk-date-picker--closing');
            if (shell) shell.style.overflow = '';
            closeAnimTimer = null;
        }, 170);
    };

    const openDp = () => {
        if (closeAnimTimer) {
            clearTimeout(closeAnimTimer);
            closeAnimTimer = null;
        }
        parseFromInput();
        renderDp();
        if (shell) shell.style.overflow = 'visible';
        picker.classList.remove('bulk-date-picker--closing');
        picker.classList.remove('hidden');
        void picker.offsetWidth;
        picker.classList.add('bulk-date-picker--open');
        chip.setAttribute('aria-expanded', 'true');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        _dpOutsideClickHandler = (e) => {
            if (!picker.contains(e.target) && !chip.contains(e.target)) {
                closeDp();
            }
        };
        document.addEventListener('click', _dpOutsideClickHandler, true);
    };

    chip.onclick = (e) => {
        e.stopPropagation();
        const isHidden = picker.classList.contains('hidden');
        const isClosing = picker.classList.contains('bulk-date-picker--closing');
        (isHidden || isClosing) ? openDp() : closeDp();
    };

    const maxDayFor = () => new Date(dpState.year, dpState.month, 0).getDate();

    picker.querySelector('#dp-day-up').onclick = () => {
        dpState.day = dpState.day >= maxDayFor() ? 1 : dpState.day + 1;
        renderDp();
    };
    picker.querySelector('#dp-day-down').onclick = () => {
        dpState.day = dpState.day <= 1 ? maxDayFor() : dpState.day - 1;
        renderDp();
    };
    picker.querySelector('#dp-month-up').onclick = () => {
        if (dpState.month >= 12) {
            dpState.month = 1;
            dpState.year += 1;
        } else {
            dpState.month += 1;
        }
        renderDp();
    };
    picker.querySelector('#dp-month-down').onclick = () => {
        if (dpState.month <= 1) {
            dpState.month = 12;
            dpState.year -= 1;
        } else {
            dpState.month -= 1;
        }
        renderDp();
    };
    picker.querySelector('#dp-year-up').onclick = () => {
        dpState.year++;
        renderDp();
    };
    picker.querySelector('#dp-year-down').onclick = () => {
        dpState.year--;
        renderDp();
    };

    picker.querySelector('#dp-confirm-btn').onclick = () => {
        clampDay();
        const yyyy = String(dpState.year);
        const mm = String(dpState.month).padStart(2, '0');
        const dd = String(dpState.day).padStart(2, '0');
        hiddenInput.value = `${yyyy}-${mm}-${dd}`;
        hiddenInput.dispatchEvent(new Event('change'));
        closeDp();
    };

    picker.querySelector('#dp-cancel-btn').onclick = () => closeDp();

    const todayBtn = picker.querySelector('#dp-today-btn');
    if (todayBtn) {
        todayBtn.onclick = () => {
            setStateFromDate(new Date());
            renderDp();
        };
    }
}

export function openBulkLogModal(classId, type, options = {}) {
    const classData = state.get('allSchoolClasses').find((c) => c.id === classId);
    if (!classData) return;
    const assessmentScheme = getAssessmentSchemeForClass(classData, type);
    if (!isAssessmentSchemeEnabled(assessmentScheme)) {
        showToast(type === 'dictation' ? 'This class does not use dictations.' : 'This class does not use tests.', 'info');
        return;
    }
    const modal = document.getElementById('bulk-trial-modal');
    const isSwitch = !!options.carry;

    document.getElementById('bulk-trial-title').innerText = type === 'dictation' ? 'Log Dictation' : 'Log Test';
    document.getElementById('bulk-trial-subtitle').innerText = `${classData.logo} ${classData.name}`;
    if (!isSwitch) resetTrialBoard({ tabsFor: options.allowTypeSwitch ? type : null, scheme: assessmentScheme });
    else resetTrialBoard({ tabsFor: type, scheme: assessmentScheme });
    rememberTrialType(classId, type);

    const dateInput = document.getElementById('bulk-trial-date');
    if (!isSwitch) {
        let initialDate =
            typeof options.presetDate === 'string' && options.presetDate.trim()
                ? formatYmdFromAnyDateString(options.presetDate.trim())
                : null;
        if (!initialDate) initialDate = todayIsoDate();
        dateInput.value = initialDate;
    }
    setTrialDateDisplay(dateInput.value);

    const titleWrapper = document.getElementById('bulk-trial-title-wrapper');
    const titleInput = document.getElementById('bulk-trial-name');

    if (type === 'test') {
        titleWrapper.classList.remove('hidden');
        const presetTitle = typeof options.presetTitle === 'string' ? options.presetTitle.trim() : '';
        if (presetTitle) {
            titleInput.value = presetTitle;
        } else {
            const assignmentOnDate = getScheduledAssignmentForClassOnDate(classId, dateInput.value);
            titleInput.value = String(assignmentOnDate?.testData?.title || pickBulkTestLogContext(classId).suggestedTitle || '').trim();
        }
    } else {
        titleWrapper.classList.add('hidden');
        titleInput.value = '';
    }

    dateInput.onchange = (e) => {
        setTrialDateDisplay(e.target.value);
        if (type === 'test') {
            const assn = getScheduledAssignmentForClassOnDate(classId, e.target.value);
            if (assn?.testData?.title || !titleInput.value.trim()) titleInput.value = String(assn?.testData?.title || '').trim();
        }
        // Keep the marks already written; attendance follows the new day's register.
        populateBulkTrialStudentRows(classId, type, assessmentScheme, e.target.value, { marks: readTrialSheet(), keepValues: true });
        refreshBulkTrialScheduledHint(classId, type, e.target.value);
    };

    setupBulkDatePicker();
    populateBulkTrialStudentRows(classId, type, assessmentScheme, dateInput.value, options.carry || null);
    refreshBulkTrialScheduledHint(classId, type, dateInput.value);
    titleInput.oninput = null;

    const tabs = document.getElementById('bulk-trial-type-switch');
    if (tabs) {
        tabs.onclick = (e) => {
            const tab = e.target.closest('.tl-tab');
            const next = tab?.dataset.trialType;
            if (!next || next === modal.dataset.type) return;
            const marks = readTrialSheet();
            const switchNow = () => openBulkLogModal(classId, next, { allowTypeSwitch: true, carry: { marks, keepAbsences: true } });
            const hasMarks = [...marks.values()].some((m) => !m.absent && m.value !== '');
            if (hasMarks) {
                modals.showModal(
                    `Switch to ${next === 'test' ? 'Test' : 'Dictation'}?`,
                    'The marks on this sheet will be cleared. Absences stay as they are.',
                    switchNow,
                    'Switch',
                    'Keep marking'
                );
            } else {
                switchNow();
            }
        };
    }

    document.getElementById('bulk-trial-close-btn').onclick = () => modals.hideModal('bulk-trial-modal');

    modal.dataset.classId = classId;
    modal.dataset.type = type;
    modal.dataset.gradingMode = assessmentScheme.mode;

    if (isSwitch) {
        const sheet = modal.querySelector('.tl-sheet');
        sheet?.classList.remove('tl-sheet--flip');
        void sheet?.offsetWidth;
        sheet?.classList.add('tl-sheet--flip');
        return;
    }
    modals.showAnimatedModal('bulk-trial-modal');
    if (type === 'test' && !titleInput.value.trim()) {
        setTimeout(() => titleInput.focus({ preventScroll: true }), 320);
    }
}

// --- HISTORY & SINGLE EDIT ---

/** Record-book viewer state (reset each time the book opens). */
const thState = {
    classId: null,
    mode: 'trial',          // 'trial' = grouped by sitting · 'student' = one card per scholar
    query: '',
    fullLoaded: false,
    expanded: new Set(),    // trial keys opened by the teacher
    collapsed: new Set(),   // trial keys closed by the teacher (overrides the default-open ones)
    expandAll: null         // null = default, true/false = Expand all / Collapse all
};

function activeHistoryView() {
    return document.querySelector('#trial-history-view-toggle .active-toggle')?.dataset.view || 'test';
}

/** Scores the book can show: the loaded window from state, plus the archive once fetched. */
function historyScoresForClass(classId) {
    const cutoff = rangeStart('3m');
    const fromState = (state.get('allWrittenScores') || []).filter((s) => {
        if (s.classId !== classId || !s.date) return false;
        if (thState.fullLoaded) return true;
        const d = utils.parseFlexibleDate(s.date);
        return !!d && d >= cutoff;
    });
    // Archive first so the live copy of a record wins.
    const merged = new Map();
    loadedHistoricalScores.filter((s) => s.classId === classId).forEach((s) => merged.set(s.id, s));
    fromState.forEach((s) => merged.set(s.id, s));
    return [...merged.values()];
}

function findScoreRecord(trialId) {
    return (state.get('allWrittenScores') || []).find((s) => s.id === trialId)
        || loadedHistoricalScores.find((s) => s.id === trialId)
        || null;
}

export function openTrialHistoryModal(classId) {
    if (!classId) return;
    const classData = (state.get('allTeachersClasses') || []).find((c) => c.id === classId) || findScrollClass(classId);
    if (!classData) return;

    loadedHistoricalScores = [];
    historySortDateDir = 'desc';
    historySortStudentBy = 'name';
    Object.assign(thState, { classId, mode: 'trial', query: '', fullLoaded: false, expandAll: null });
    thState.expanded = new Set();
    thState.collapsed = new Set();

    const modal = document.getElementById('trial-history-modal');
    modal.dataset.classId = classId;
    document.getElementById('trial-history-title').innerHTML = `<span class="th-head__logo" aria-hidden="true">${esc(classData.logo || '📜')}</span><span>Trial History</span>`;

    const usage = getClassAssessmentUsage(classData);
    const scoresForHistory = (state.get('allWrittenScores') || []).filter((score) => score.classId === classId);
    const showTests = usage.tests || scoresForHistory.some((score) => score.type === 'test');
    const showDictations = usage.dictations || scoresForHistory.some((score) => score.type === 'dictation');
    const initialView = showTests ? 'test' : 'dictation';

    // 1. Kind tabs (Tests / Dictations)
    const viewToggle = document.getElementById('trial-history-view-toggle');
    const kindBtn = (view, icon, label) => `
        <button type="button" role="tab" data-view="${view}" aria-selected="${initialView === view}"
            class="toggle-btn th-seg__btn th-seg__btn--${view}${initialView === view ? ' active-toggle' : ''}">
            <i class="fas ${icon}" aria-hidden="true"></i><span>${label}</span><b class="th-seg__count" data-count-for="${view}"></b>
        </button>`;
    viewToggle.innerHTML = `${showTests ? kindBtn('test', 'fa-file-alt', 'Tests') : ''}${showDictations ? kindBtn('dictation', 'fa-microphone-alt', 'Dictations') : ''}`;
    viewToggle.classList.toggle('hidden', !showTests || !showDictations);
    viewToggle.onclick = (e) => {
        const btn = e.target.closest('.toggle-btn');
        if (!btn) return;
        viewToggle.querySelectorAll('.toggle-btn').forEach((b) => {
            const on = b === btn;
            b.classList.toggle('active-toggle', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        thState.expanded.clear();
        thState.collapsed.clear();
        thState.expandAll = null;
        renderTrialHistoryContent(classId, btn.dataset.view);
    };

    // 2. Arrangement (by trial / by student)
    const modeToggle = document.getElementById('trial-history-mode-toggle');
    const buildModeToggle = () => {
        modeToggle.innerHTML = [['trial', 'fa-layer-group', 'By trial'], ['student', 'fa-user-graduate', 'By scholar']]
            .map(([mode, icon, label]) => `
                <button type="button" class="th-seg__btn${thState.mode === mode ? ' is-active' : ''}" data-mode="${mode}" aria-pressed="${thState.mode === mode}">
                    <i class="fas ${icon}" aria-hidden="true"></i><span>${label}</span>
                </button>`).join('');
    };
    buildModeToggle();
    modeToggle.onclick = (e) => {
        const btn = e.target.closest('[data-mode]');
        if (!btn || btn.dataset.mode === thState.mode) return;
        thState.mode = btn.dataset.mode;
        buildModeToggle();
        buildSortRow();
        renderTrialHistoryContent(classId, activeHistoryView());
    };

    // 3. Search
    const search = document.getElementById('trial-history-search');
    if (search) {
        search.value = '';
        search.oninput = () => {
            thState.query = search.value.trim();
            renderTrialHistoryContent(classId, activeHistoryView());
        };
    }

    // 4. Content: open/close a trial, edit, delete (delegated, the node is replaced to drop old listeners)
    const contentEl = document.getElementById('trial-history-content');
    const newContentEl = contentEl.cloneNode(false);
    contentEl.parentNode.replaceChild(newContentEl, contentEl);
    newContentEl.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-trial-btn');
        if (deleteBtn) {
            const trialId = deleteBtn.dataset.trialId;
            import('../db/actions.js').then((actions) => actions.handleDeleteTrial(trialId, () => {
                loadedHistoricalScores = loadedHistoricalScores.filter((s) => s.id !== trialId);
                renderTrialHistoryContent(classId, activeHistoryView());
            }));
            return;
        }
        const editBtn = e.target.closest('.edit-trial-btn');
        if (editBtn) {
            openSingleTrialEditModal(classId, editBtn.dataset.trialId);
            return;
        }
        const head = e.target.closest('.th-trial__head');
        if (head) {
            const key = head.closest('.th-trial')?.dataset.key;
            if (!key) return;
            const open = head.getAttribute('aria-expanded') !== 'true';
            head.setAttribute('aria-expanded', open ? 'true' : 'false');
            head.closest('.th-trial').classList.toggle('is-open', open);
            if (open) { thState.expanded.add(key); thState.collapsed.delete(key); }
            else { thState.collapsed.add(key); thState.expanded.delete(key); }
            return;
        }
        const clear = e.target.closest('[data-th-clear-search]');
        if (clear && search) {
            search.value = '';
            thState.query = '';
            renderTrialHistoryContent(classId, activeHistoryView());
            search.focus();
            return;
        }
        if (e.target.closest('[data-th-load-full]')) document.getElementById('trial-history-load-full-btn')?.click();
    });

    // 5. Sort bar
    const sortRow = document.getElementById('trial-history-sort-row');
    const sortSeg = (type, label, options, current) => `
        <div class="th-sort">
            <span class="th-sort__label">${label}</span>
            <div class="th-seg th-seg--sm" role="group" aria-label="${label}">${options.map(([val, text]) => `
                <button type="button" class="th-seg__btn${val === current ? ' is-active' : ''}" data-sort-type="${type}" data-sort-val="${val}" aria-pressed="${val === current}">${text}</button>`).join('')}
            </div>
        </div>`;
    const buildSortRow = () => {
        sortRow.innerHTML = `
            ${sortSeg('date', 'Dates', [['desc', 'Newest first'], ['asc', 'Oldest first']], historySortDateDir)}
            ${sortSeg('student', 'Scholars', [['name', 'A–Z'], ['name-desc', 'Z–A'], ['score-desc', 'Highest'], ['score-asc', 'Lowest']], historySortStudentBy)}
            ${thState.mode === 'trial' ? `
                <div class="th-sort th-sort--end">
                    <button type="button" class="th-linkbtn" data-expand="open"><i class="fas fa-angle-double-down" aria-hidden="true"></i> Open all</button>
                    <button type="button" class="th-linkbtn" data-expand="close"><i class="fas fa-angle-double-up" aria-hidden="true"></i> Close all</button>
                </div>` : ''}`;
    };
    buildSortRow();
    sortRow.onclick = (e) => {
        const expandBtn = e.target.closest('[data-expand]');
        if (expandBtn) {
            thState.expandAll = expandBtn.dataset.expand === 'open';
            thState.expanded.clear();
            thState.collapsed.clear();
            renderTrialHistoryContent(classId, activeHistoryView());
            return;
        }
        const btn = e.target.closest('[data-sort-type]');
        if (!btn) return;
        if (btn.dataset.sortType === 'date') historySortDateDir = btn.dataset.sortVal;
        else historySortStudentBy = btn.dataset.sortVal;
        buildSortRow();
        renderTrialHistoryContent(classId, activeHistoryView());
    };

    // 6. Archive: load every assessment for this class on demand
    const actionsContainer = document.getElementById('trial-history-actions');
    actionsContainer.innerHTML = `
        <button id="trial-history-load-full-btn" type="button" class="th-btn" title="Fetch every assessment for this class from the database">
            <i class="fas fa-box-archive" aria-hidden="true"></i><span>Open the full archive</span>
        </button>`;
    const loadBtn = document.getElementById('trial-history-load-full-btn');
    loadBtn.onclick = async () => {
        loadBtn.disabled = true;
        loadBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>Unrolling the archive…</span>';
        try {
            const { fetchAllTrialsForClass } = await import('../db/queries.js');
            const scores = await fetchAllTrialsForClass(classId);
            loadedHistoricalScores = scores;
            thState.fullLoaded = true;
            renderTrialHistoryContent(classId, activeHistoryView());
            showToast(scores.length ? 'Full trial history is ready.' : 'No records found in the archive.', scores.length ? 'success' : 'info');
            loadBtn.innerHTML = '<i class="fas fa-rotate" aria-hidden="true"></i><span>Refresh archive</span>';
        } catch (err) {
            console.error('Trial history full load failed:', err);
            showToast('Could not load full thState. Try again.', 'error');
            loadBtn.innerHTML = '<i class="fas fa-box-archive" aria-hidden="true"></i><span>Open the full archive</span>';
        } finally {
            loadBtn.disabled = false;
        }
    };

    renderTrialHistoryContent(classId, initialView);
    modals.showAnimatedModal('trial-history-modal');
}

function historyStudentSorter(pctOf) {
    const students = state.get('allStudents') || [];
    const nameOf = (score) => students.find((s) => s.id === score.studentId)?.name || '';
    return (a, b) => {
        if (historySortStudentBy === 'score-desc') return ((pctOf(b) ?? -1) - (pctOf(a) ?? -1)) || nameOf(a).localeCompare(nameOf(b));
        if (historySortStudentBy === 'score-asc') return ((pctOf(a) ?? 101) - (pctOf(b) ?? 101)) || nameOf(a).localeCompare(nameOf(b));
        return historySortStudentBy === 'name-desc' ? nameOf(b).localeCompare(nameOf(a)) : nameOf(a).localeCompare(nameOf(b));
    };
}

export function renderTrialHistoryContent(classId, view) {
    const contentEl = document.getElementById('trial-history-content');
    if (!contentEl) return;
    const classData = findScrollClass(classId);
    const students = state.get('allStudents') || [];
    const studentById = new Map(students.map((s) => [s.id, s]));
    const pctCache = new Map();
    const pctOf = (score) => {
        if (!pctCache.has(score.id)) {
            const p = getNormalizedPercentForScore(score, classData);
            pctCache.set(score.id, Number.isFinite(p) ? p : null);
        }
        return pctCache.get(score.id);
    };
    const timeOf = (score) => utils.parseFlexibleDate(score.date)?.getTime() ?? null;

    const all = historyScoresForClass(classId);
    const ofView = all.filter((s) => s.type === view);

    // Header summary + tab counts
    const sessionsByKind = { test: 0, dictation: 0 };
    ['test', 'dictation'].forEach((kind) => {
        sessionsByKind[kind] = groupTrialSessions(all.filter((s) => s.type === kind), timeOf).length;
        const countEl = document.querySelector(`#trial-history-view-toggle [data-count-for="${kind}"]`);
        if (countEl) countEl.textContent = sessionsByKind[kind] || '';
    });
    const viewAvg = mean(ofView.map(pctOf));
    const summaryEl = document.getElementById('trial-history-summary');
    if (summaryEl) {
        const kindWord = view === 'dictation' ? 'dictation' : 'test';
        summaryEl.innerHTML = `
            <span>${esc(classData?.name || '')}</span>
            <span><b>${sessionsByKind[view]}</b> ${kindWord}${sessionsByKind[view] === 1 ? '' : 's'}</span>
            <span><b>${ofView.length}</b> result${ofView.length === 1 ? '' : 's'}</span>
            ${viewAvg !== null ? `<span>average <b>${formatPct(viewAvg, 0)}</b></span>` : ''}`;
    }
    const rangeEl = document.getElementById('trial-history-range');
    if (rangeEl) {
        rangeEl.innerHTML = thState.fullLoaded
            ? '<i class="fas fa-box-open" aria-hidden="true"></i> Showing the <b>full archive</b>'
            : '<i class="fas fa-hourglass-half" aria-hidden="true"></i> Showing the <b>last 3 months</b>. Older records live in the archive.';
    }

    // Search: a trial title match keeps the whole sitting; otherwise only matching scholars.
    const q = thState.query.toLowerCase();
    const nameOf = (score) => studentById.get(score.studentId)?.name || '';

    if (ofView.length === 0) {
        contentEl.innerHTML = historyEmptyHtml({
            icon: view === 'dictation' ? 'fa-microphone-alt' : 'fa-file-alt',
            title: `No ${view === 'dictation' ? 'dictations' : 'tests'} recorded`,
            text: thState.fullLoaded ? 'The archive has nothing of this kind for this class yet.' : 'Nothing in the last 3 months. Older records may be waiting in the archive.',
            action: thState.fullLoaded ? '' : '<button type="button" class="th-btn" data-th-load-full><i class="fas fa-box-archive" aria-hidden="true"></i><span>Open the full archive</span></button>'
        });
        return;
    }

    const html = thState.mode === 'student'
        ? historyByStudentHtml({ classId, view, ofView, students, pctOf, timeOf, q })
        : historyByTrialHtml({ view, ofView, studentById, pctOf, timeOf, q, nameOf });

    contentEl.innerHTML = html || historyEmptyHtml({
        icon: 'fa-search',
        title: 'No matches',
        text: `Nothing matches “${thState.query}”.`,
        action: '<button type="button" class="th-btn th-btn--quiet" data-th-clear-search><i class="fas fa-times" aria-hidden="true"></i><span>Clear search</span></button>'
    });
}

function historyEmptyHtml({ icon, title, text, action = '' }) {
    return `
        <div class="th-empty">
            <span class="th-empty__art" aria-hidden="true"><i class="fas ${icon}"></i></span>
            <p class="th-empty__title">${esc(title)}</p>
            <p class="th-empty__text">${esc(text)}</p>
            ${action ? `<div class="th-empty__actions">${action}</div>` : ''}
        </div>`;
}

function historyByTrialHtml({ view, ofView, studentById, pctOf, timeOf, q, nameOf }) {
    let sessions = groupTrialSessions(ofView, timeOf);
    sessions.sort((a, b) => historySortDateDir === 'asc' ? (a.time ?? 0) - (b.time ?? 0) : (b.time ?? 0) - (a.time ?? 0));

    if (q) {
        sessions = sessions.map((s) => {
            if (s.title.toLowerCase().includes(q)) return s;
            const hits = s.scores.filter((sc) => nameOf(sc).toLowerCase().includes(q));
            return hits.length ? { ...s, scores: hits, filtered: true } : null;
        }).filter(Boolean);
    }
    if (!sessions.length) return '';

    const months = [];
    sessions.forEach((s, i) => {
        const d = s.time ? new Date(s.time) : null;
        const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'unknown';
        let month = months[months.length - 1];
        if (!month || month.key !== key) {
            month = { key, label: d ? d.toLocaleString('en-GB', { month: 'long', year: 'numeric' }) : 'Undated', sessions: [] };
            months.push(month);
        }
        month.sessions.push({ ...s, index: i });
    });

    const sorter = historyStudentSorter(pctOf);
    const currentUserId = state.get('currentUserId');

    return months.map((month) => `
        <section class="th-month" data-month-key="${month.key}">
            <h3 class="th-month__title"><span>${esc(month.label)}</span><em>${month.sessions.length} ${view === 'dictation' ? 'dictation' : 'test'}${month.sessions.length === 1 ? '' : 's'}</em></h3>
            ${month.sessions.map((s) => {
        const d = s.time ? new Date(s.time) : null;
        const pcts = s.scores.map(pctOf).filter((p) => p !== null);
        const avg = mean(pcts);
        const title = s.title || (view === 'dictation' ? 'Dictation' : 'Test');
        const defaultOpen = thState.expandAll !== null ? thState.expandAll : (!!q || s.index < 2);
        const open = thState.expanded.has(s.key) || (defaultOpen && !thState.collapsed.has(s.key));
        const results = [...s.scores].sort(sorter).map((score) => historyResultHtml(score, studentById.get(score.studentId), pctOf(score), currentUserId)).join('');
        const bodyId = `th-trial-${s.key.replace(/[^a-z0-9]/gi, '-')}`;
        return `
                <article class="th-trial${open ? ' is-open' : ''}" data-key="${esc(s.key)}" data-tier="${tierForPercent(avg)}">
                    <button type="button" class="th-trial__head" aria-expanded="${open}" aria-controls="${bodyId}">
                        <span class="th-date" aria-hidden="true"><b>${d ? d.getDate() : '?'}</b><small>${d ? d.toLocaleDateString('en-GB', { month: 'short' }) : ''}</small><i>${d ? d.toLocaleDateString('en-GB', { weekday: 'short' }) : ''}</i></span>
                        <span class="th-trial__main">
                            <span class="th-trial__title">${esc(title)}</span>
                            <span class="th-trial__meta">${d ? esc(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })) : esc(s.date)} · ${s.filtered ? `${s.scores.length} matching` : `${s.scores.length} graded`}</span>
                            ${tierBarHtml(tierCounts(pcts))}
                        </span>
                        <span class="th-trial__avg" data-tier="${tierForPercent(avg)}"><b>${avg === null ? '--' : formatPct(avg, 0)}</b><small>average</small></span>
                        <i class="fas fa-chevron-down th-trial__chev" aria-hidden="true"></i>
                    </button>
                    <div class="th-trial__body" id="${bodyId}">
                        <ul class="th-results">${results}</ul>
                    </div>
                </article>`;
    }).join('')}
        </section>`).join('');
}

function historyResultHtml(score, student, pct, currentUserId) {
    const label = getAssessmentValueLabel(score) || (pct !== null ? formatPct(pct, 0) : '—');
    const numeric = score.scoreNumeric !== null && score.scoreNumeric !== undefined && !score.scoreQualitative;
    const isOwner = score.teacherId === currentUserId;
    const name = student?.name || 'Former scholar';
    return `
        <li class="th-result trial-history-item${student ? '' : ' th-result--former'}" data-tier="${tierForPercent(pct)}">
            ${avatarMarkup(student || { name: '?' }, 'th-av')}
            <span class="th-result__name">${esc(name)}</span>
            <span class="th-pill" data-tier="${tierForPercent(pct)}"><b>${esc(label)}</b>${numeric && pct !== null ? `<small>${formatPct(pct, 0)}</small>` : ''}</span>
            ${isOwner ? `
                <span class="th-result__tools">
                    <button type="button" data-trial-id="${esc(score.id)}" class="edit-trial-btn th-tool" title="Edit result" aria-label="Edit ${esc(name)}'s result"><i class="fas fa-pen" aria-hidden="true"></i></button>
                    <button type="button" data-trial-id="${esc(score.id)}" class="delete-trial-btn th-tool th-tool--danger" title="Delete result" aria-label="Delete ${esc(name)}'s result"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
                </span>` : '<span class="th-result__tools th-result__tools--none" title="Logged by another teacher"><i class="fas fa-lock" aria-hidden="true"></i></span>'}
        </li>`;
}

function historyByStudentHtml({ classId, view, ofView, students, pctOf, timeOf, q }) {
    const currentUserId = state.get('currentUserId');
    const byStudent = new Map();
    ofView.forEach((s) => {
        if (!byStudent.has(s.studentId)) byStudent.set(s.studentId, []);
        byStudent.get(s.studentId).push(s);
    });
    const classStudents = students.filter((s) => s.classId === classId || byStudent.has(s.id));
    let cards = classStudents.map((student) => {
        const scores = (byStudent.get(student.id) || []).sort((a, b) => (timeOf(a) ?? 0) - (timeOf(b) ?? 0));
        const pcts = scores.map(pctOf).filter((p) => p !== null);
        return { student, scores, pcts, avg: mean(pcts) };
    });
    if (q) cards = cards.filter((c) => c.student.name.toLowerCase().includes(q) || c.scores.some((s) => String(s.title || '').toLowerCase().includes(q)));

    const withResults = cards.filter((c) => c.scores.length);
    const without = cards.filter((c) => !c.scores.length).sort((a, b) => a.student.name.localeCompare(b.student.name));
    withResults.sort((a, b) => {
        if (historySortStudentBy === 'score-desc') return ((b.avg ?? -1) - (a.avg ?? -1)) || a.student.name.localeCompare(b.student.name);
        if (historySortStudentBy === 'score-asc') return ((a.avg ?? 101) - (b.avg ?? 101)) || a.student.name.localeCompare(b.student.name);
        return historySortStudentBy === 'name-desc' ? b.student.name.localeCompare(a.student.name) : a.student.name.localeCompare(b.student.name);
    });
    if (!withResults.length && !without.length) return '';

    const kindWord = view === 'dictation' ? 'dictation' : 'test';
    const cardsHtml = withResults.map(({ student, scores, pcts, avg }) => {
        const ordered = historySortDateDir === 'asc' ? scores : [...scores].reverse();
        const trend = trendFor(pcts);
        const pills = ordered.map((score) => {
            const pct = pctOf(score);
            const d = utils.parseFlexibleDate(score.date);
            const label = getAssessmentValueLabel(score) || (pct !== null ? formatPct(pct, 0) : '—');
            const title = score.title || (view === 'dictation' ? 'Dictation' : 'Test');
            const tip = `${title} · ${d ? shortDate(d, true) : score.date}${pct !== null ? ` · ${formatPct(pct, 0)}` : ''}`;
            const isOwner = score.teacherId === currentUserId;
            const inner = `<small>${d ? shortDate(d) : ''}</small><b>${esc(label)}</b>`;
            return isOwner
                ? `<button type="button" class="th-mark edit-trial-btn" data-tier="${tierForPercent(pct)}" data-trial-id="${esc(score.id)}" title="${esc(tip)} — click to edit">${inner}</button>`
                : `<span class="th-mark" data-tier="${tierForPercent(pct)}" title="${esc(tip)}">${inner}</span>`;
        }).join('');
        return `
            <article class="th-scholar" data-tier="${tierForPercent(avg)}">
                <header class="th-scholar__head">
                    ${avatarMarkup(student, 'th-av th-av--lg')}
                    <span class="th-scholar__who">
                        <span class="th-scholar__name">${esc(student.name)}</span>
                        <span class="th-scholar__meta">${scores.length} ${kindWord}${scores.length === 1 ? '' : 's'}${trend ? ` · <span class="th-trend" data-dir="${trend.dir}">${trend.dir === 'up' ? 'rising' : (trend.dir === 'down' ? 'slipping' : 'steady')}</span>` : ''}</span>
                    </span>
                    ${sparklineSvg(pcts, { width: 84, height: 28, max: 10 })}
                    <span class="th-trial__avg" data-tier="${tierForPercent(avg)}"><b>${avg === null ? '--' : formatPct(avg, 0)}</b><small>average</small></span>
                </header>
                <div class="th-marks">${pills}</div>
            </article>`;
    }).join('');

    const withoutHtml = without.length ? `
        <div class="th-missing">
            <p class="th-missing__title"><i class="fas fa-user-clock" aria-hidden="true"></i> No ${kindWord}s recorded${thState.fullLoaded ? '' : ' in the last 3 months'}</p>
            <p class="th-missing__names">${without.map((c) => esc(c.student.name)).join(' · ')}</p>
        </div>` : '';
    return `<div class="th-scholars">${cardsHtml}</div>${withoutHtml}`;
}

// --- SINGLE EDIT MODAL ---

export function openSingleTrialEditModal(classId, trialId) {
    const score = findScoreRecord(trialId);
    if (!score) return;

    const classData = findScrollClass(classId);
    if (!classData) return;
    let assessmentScheme = getAssessmentSchemeForClass(classData, score.type);
    if (!isAssessmentSchemeEnabled(assessmentScheme) && score.gradingSnapshot) {
        assessmentScheme = normalizeAssessmentScheme(score.gradingSnapshot, score.gradingSnapshot);
    }

    const modal = document.getElementById('bulk-trial-modal');
    document.getElementById('bulk-trial-scheduled-hint')?.classList.add('hidden');
    resetTrialBoard({ scheme: assessmentScheme });
    document.getElementById('bulk-trial-tip-default')?.classList.add('hidden');

    document.getElementById('bulk-trial-title').innerText = 'Edit Result';
    document.getElementById('bulk-trial-subtitle').innerText = `${classData.logo || ''} ${classData.name}`.trim();

    const dateInput = document.getElementById('bulk-trial-date');
    dateInput.value = formatYmdFromAnyDateString(score.date);
    dateInput.onchange = (e) => setTrialDateDisplay(e.target.value);
    setTrialDateDisplay(dateInput.value);
    setupBulkDatePicker();

    const titleWrapper = document.getElementById('bulk-trial-title-wrapper');
    const titleInput = document.getElementById('bulk-trial-name');

    if (score.type === 'test') {
        titleWrapper.classList.remove('hidden');
        titleInput.value = score.title || '';
    } else {
        titleWrapper.classList.add('hidden');
    }

    const listContainer = document.getElementById('bulk-student-list');
    listContainer.innerHTML = '';

    const student = state.get('allStudents').find(s => s.id === score.studentId);
    if (student) {
        const value = score.scoreQualitative || (score.scoreNumeric !== null && score.scoreNumeric !== undefined ? String(score.scoreNumeric) : '');
        listContainer.innerHTML = trialRowHtml({ student, scheme: assessmentScheme, value });
        listContainer.querySelector('.bulk-log-item').dataset.trialId = trialId;
    }
    wireTrialSheet(listContainer);
    updateTrialTally();

    modal.dataset.classId = classId;
    modal.dataset.type = score.type;
    modal.dataset.gradingMode = assessmentScheme.mode;

    const saveBtn = document.getElementById('bulk-trial-save-btn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    import('../db/actions.js').then(actions => {
        newSaveBtn.addEventListener('click', actions.handleBulkSaveTrial);
    });

    modals.showAnimatedModal('bulk-trial-modal');
    document.getElementById('bulk-trial-close-btn').onclick = () => modals.hideModal('bulk-trial-modal');
}


// --- MAKEUP / MISSING WORK ---

function readDismissedMakeups(classId) {
    try { return JSON.parse(localStorage.getItem(`dismissed_makeups_${classId}`) || '{}'); } catch (_) { return {}; }
}

function renderMissingWorkDashboard(classId) {
    const dashboard = getScrollQueuesHost();
    let container = document.getElementById('makeup-work-container');
    if (!container) {
        container = document.createElement('section');
        container.id = 'makeup-work-container';
    }
    container.innerHTML = '';

    const classData = findScrollClass(classId);
    if (!classUsesTests(classData)) {
        container.remove();
        return;
    }

    const studentsInClass = state.get('allStudents').filter((s) => s.classId === classId);
    const scoresForClass = state.get('allWrittenScores').filter((s) => s.classId === classId);

    // 1. Unique tests (by title)
    const uniqueAssessments = {};
    scoresForClass.forEach((score) => {
        if (score.type !== 'test') return;
        const key = `${score.type}-${score.title || 'Untitled'}`;
        if (!uniqueAssessments[key]) {
            uniqueAssessments[key] = { type: score.type, title: score.title || 'Untitled', originalDate: score.date, count: 0 };
        }
        uniqueAssessments[key].count++;
    });

    // Tests only one or two scholars took are most likely makeups themselves.
    const threshold = Math.max(2, Math.floor(studentsInClass.length * 0.3));
    // Only the past 3 months (matches the loaded window)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    threeMonthsAgo.setHours(0, 0, 0, 0);

    const validAssessments = Object.values(uniqueAssessments).filter((a) => {
        if (a.count < threshold) return false;
        const aDate = utils.parseFlexibleDate(a.originalDate);
        return !!aDate && aDate >= threeMonthsAgo;
    });

    // 2. Who missed each one (skipping scholars who joined after it, and dismissed records)
    const dismissed = readDismissedMakeups(classId);
    const groups = validAssessments.map((assessment) => {
        const testDate = utils.parseFlexibleDate(assessment.originalDate);
        const missing = studentsInClass.filter((student) => {
            if (student.createdAt) {
                const joinDate = student.createdAt.toDate ? student.createdAt.toDate() : new Date(student.createdAt);
                const endOfTestDay = new Date(testDate);
                endOfTestDay.setHours(23, 59, 59, 999);
                if (joinDate > endOfTestDay) return false;
            }
            if (dismissed[`${assessment.type}-${assessment.title}-${student.id}`]) return false;
            return !scoresForClass.some((s) =>
                s.studentId === student.id
                && s.type === assessment.type
                && (s.title === assessment.title || (!s.title && assessment.title === 'Untitled')));
        }).sort((a, b) => a.name.localeCompare(b.name));
        return { assessment, testDate, missing };
    }).filter((g) => g.missing.length).sort((a, b) => b.testDate - a.testDate);

    const total = groups.reduce((n, g) => n + g.missing.length, 0);
    if (!total) {
        container.remove();
        return;
    }

    const collapsed = collapsedMakeups.has(classId);
    container.className = `ss-notice ss-notice--makeup${collapsed ? ' is-collapsed' : ''}`;
    container.dataset.tone = 'amber';
    container.innerHTML = `
        <header class="ss-notice__row">
            <span class="ss-notice__seal" aria-hidden="true"><i class="fas fa-hourglass-half"></i></span>
            <div class="ss-notice__body">
                <p class="ss-notice__kicker"><span>Scholastic alert</span></p>
                <h4 class="ss-notice__title">Pending Makeups</h4>
                <p class="ss-notice__text"><b class="ss-makeup-count">${total}</b> makeup${total === 1 ? "" : "s"} to log across ${groups.length} test${groups.length === 1 ? '' : 's'}</p>
            </div>
            <button type="button" class="ss-btn ss-btn--ghost ss-makeup-toggle" aria-expanded="${!collapsed}" aria-controls="ss-makeup-groups">
                <span>${collapsed ? 'Show' : 'Hide'}</span><i class="fas fa-chevron-down" aria-hidden="true"></i>
            </button>
        </header>
        <div class="ss-makeups" id="ss-makeup-groups">
            ${groups.map(({ assessment, testDate, missing }) => `
                <div class="ss-makeup-group">
                    <p class="ss-makeup-group__head">
                        <i class="fas fa-file-alt" aria-hidden="true"></i>
                        <b>${esc(assessment.title)}</b>
                        <span>${esc(shortDate(testDate))}</span>
                        <em>${missing.length} to catch up</em>
                    </p>
                    <ul class="ss-makeup-group__list">
                        ${missing.map((student) => `
                            <li class="scroll-makeup-item ss-makeup">
                                ${avatarMarkup(student, 'ss-makeup__av')}
                                <span class="ss-makeup__name">${esc(student.name)}</span>
                                <button type="button" class="makeup-trigger ss-makeup__log"
                                    data-student-id="${esc(student.id)}" data-title="${esc(assessment.title)}" data-type="${esc(assessment.type)}"
                                    title="Log ${esc(student.name)}'s makeup result">
                                    <i class="fas fa-feather-alt" aria-hidden="true"></i><span>Log</span>
                                </button>
                                <button type="button" class="makeup-dismiss-btn ss-makeup__dismiss"
                                    data-student-id="${esc(student.id)}" data-title="${esc(assessment.title)}" data-type="${esc(assessment.type)}"
                                    title="Dismiss: no makeup needed" aria-label="Dismiss ${esc(student.name)}'s makeup">
                                    <i class="fas fa-times" aria-hidden="true"></i>
                                </button>
                            </li>`).join('')}
                    </ul>
                </div>`).join('')}
        </div>
    `;
    // Sits after the upcoming-test notice when there is one.
    const testAlert = document.getElementById('scroll-test-alert');
    if (testAlert && testAlert.parentNode === dashboard) testAlert.insertAdjacentElement('afterend', container);
    else dashboard.prepend(container);

    container.onclick = (e) => {
        const toggle = e.target.closest('.ss-makeup-toggle');
        if (toggle) {
            const nowCollapsed = !container.classList.contains('is-collapsed');
            container.classList.toggle('is-collapsed', nowCollapsed);
            toggle.setAttribute('aria-expanded', String(!nowCollapsed));
            toggle.querySelector('span').textContent = nowCollapsed ? 'Show' : 'Hide';
            if (nowCollapsed) collapsedMakeups.add(classId); else collapsedMakeups.delete(classId);
            return;
        }
        const log = e.target.closest('.makeup-trigger');
        if (log) {
            openMakeupModal(classId, log.dataset.studentId, log.dataset.type, log.dataset.title);
            return;
        }
        const dismiss = e.target.closest('.makeup-dismiss-btn');
        if (!dismiss) return;
        const saved = readDismissedMakeups(classId);
        saved[`${dismiss.dataset.type}-${dismiss.dataset.title}-${dismiss.dataset.studentId}`] = true;
        try { localStorage.setItem(`dismissed_makeups_${classId}`, JSON.stringify(saved)); } catch (_) { /* private mode */ }
        const item = dismiss.closest('.scroll-makeup-item');
        if (!item) return;
        item.classList.add('is-leaving');
        setTimeout(() => {
            const group = item.closest('.ss-makeup-group');
            item.remove();
            if (group && !group.querySelector('.scroll-makeup-item')) group.remove();
            const remaining = container.querySelectorAll('.scroll-makeup-item').length;
            if (!remaining) container.remove();
            else {
                const countEl = container.querySelector('.ss-makeup-count');
                if (countEl) countEl.textContent = remaining;
            }
        }, scrollMotionReduced() ? 0 : 260);
    };
}

function openMakeupModal(classId, studentId, type, title) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const student = state.get('allStudents').find(s => s.id === studentId);
    const assessmentScheme = getAssessmentSchemeForClass(classData, type);

    // Reuse the marking board, configured for one makeup line
    const modal = document.getElementById('bulk-trial-modal');
    document.getElementById('bulk-trial-scheduled-hint')?.classList.add('hidden');
    resetTrialBoard({ scheme: assessmentScheme });
    document.getElementById('bulk-trial-tip-default')?.classList.add('hidden');

    document.getElementById('bulk-trial-title').innerText = `Makeup: ${type === 'dictation' ? 'Dictation' : 'Test'}`;
    document.getElementById('bulk-trial-subtitle').innerText = `${student.name} · ${title}`;

    const dateInput = document.getElementById('bulk-trial-date');
    dateInput.value = todayIsoDate();
    dateInput.onchange = (e) => setTrialDateDisplay(e.target.value);
    setTrialDateDisplay(dateInput.value);
    setupBulkDatePicker();

    // Always show the title for a makeup, to confirm which trial it belongs to
    const titleWrapper = document.getElementById('bulk-trial-title-wrapper');
    const titleInput = document.getElementById('bulk-trial-name');
    titleWrapper.classList.remove('hidden');
    titleInput.value = title || '';

    const listContainer = document.getElementById('bulk-student-list');
    listContainer.innerHTML = trialRowHtml({ student, scheme: assessmentScheme, note: 'Taking makeup', lockAttendance: true });
    wireTrialSheet(listContainer);
    updateTrialTally();

    // Set modal datasets for saving
    modal.dataset.classId = classId;
    modal.dataset.type = type;
    modal.dataset.gradingMode = assessmentScheme.mode;

    // Bind Save Button
    const saveBtn = document.getElementById('bulk-trial-save-btn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    // We need to import handleBulkSaveTrial from actions to bind it
    import('../db/actions.js').then(actions => {
        newSaveBtn.addEventListener('click', actions.handleBulkSaveTrial);
    });

    // Show
    modals.showAnimatedModal('bulk-trial-modal');
    document.getElementById('bulk-trial-close-btn').onclick = () => modals.hideModal('bulk-trial-modal');
}
