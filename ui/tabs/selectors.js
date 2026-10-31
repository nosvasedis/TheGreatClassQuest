// /ui/tabs/selectors.js
import { quietly } from '../../utils/runtimeMetrics.js';
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import { normalizeQuestType, QUEST_TYPE_LABELS } from '../../features/specialQuestEngine.js';
import { renderAwardStarsStudentList } from './award.js';
import { getAwardLogMonthlyStarCredit } from '../../features/awardLogReasonMeta.js';
import { filterDocsForActiveYear } from '../../utils/schoolYear.js';
import { getDayAgenda, QUEST_EVENT_ICONS } from '../../utils/calendarDay.js';
import { escapeHtml } from '../../features/roles/shared.js';
import { classUsesTests } from '../../features/assessmentConfig.js';
// Holiday tiles, the month's holiday strip and the Planner's day story; loaded with this module.
import '../../styles/calendar_holidays.css';

export function findAndSetCurrentClass(targetSelectId = null) {
    if (state.get('globalSelectedClassId')) return;
    if (!state.get('classFollowSchedule')) return;

    const todayString = utils.getTodayDateString();
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
    const classesToday = utils.getClassesOnDay(todayString, state.get('allSchoolClasses'), state.get('allScheduleOverrides'), classEndDates);
    const myClassesToday = classesToday.filter(c => state.get('allTeachersClasses').some(tc => tc.id === c.id));

    const activeClass = utils.findLessonClassWithGrace(myClassesToday);
    if (activeClass) {
        state.setGlobalSelectedClass(activeClass.id);
    }
}

export function populateCalendarStars(logSource) {
    if (!logSource || logSource.length === 0) return;

    const logsByDate = logSource.reduce((acc, log) => {
        const date = log.date;
        if (!acc[date]) {
            acc[date] = 0;
        }
        acc[date] += getAwardLogMonthlyStarCredit(log);
        return acc;
    }, {});

    for (const [dateString, totalStars] of Object.entries(logsByDate)) {
        const dayCell = document.querySelector(`.calendar-day-cell[data-date="${dateString}"]`);
        const head = dayCell?.querySelector('.qc-day__head');
        if (!head || totalStars <= 0) continue;
        head.querySelector('.calendar-star-count')?.remove();
        head.insertAdjacentHTML('beforeend', `<span class="calendar-star-count qc-day__stars"><i class="fas fa-star" aria-hidden="true"></i>${formatStarCount(totalStars)}</span>`);
    }
}

function isMobileCalendarMode() {
    return typeof document !== 'undefined' && document.body?.classList.contains('gcq-mobile');
}

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function renderMobileCalendarDay(customLogs = null) {
    const dayRoot = document.getElementById('m-calendar-day');
    const grid = document.getElementById('calendar-grid');
    if (!dayRoot) return;

    if (grid) grid.hidden = true;
    dayRoot.hidden = false;

    const logsToRender = filterDocsForActiveYear(
        customLogs || state.get('allAwardLogs'),
        state.get('schoolYearState'),
    );
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
    const calendarCurrentDate = startOfDay(state.get('calendarCurrentDate') || new Date());
    const dateString = utils.getDDMMYYYY(calendarCurrentDate);
    const today = startOfDay(new Date());

    const agenda = getDayAgenda({
        dateString,
        allSchoolClasses: state.get('allSchoolClasses'),
        allTeachersClasses: state.get('allTeachersClasses'),
        allScheduleOverrides: state.get('allScheduleOverrides'),
        schoolHolidayRanges: state.get('schoolHolidayRanges'),
        allQuestEvents: state.get('allQuestEvents'),
        allQuestAssignments: state.get('allQuestAssignments'),
        awardLogs: logsToRender,
        classEndDates,
        today,
    });

    const titleEl = document.getElementById('calendar-month-year');
    if (titleEl) {
        titleEl.textContent = agenda.day.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    }

    const todayChip = document.getElementById('m-calendar-today-chip');
    if (todayChip) todayChip.classList.toggle('hidden', !agenda.isToday);

    const activeYearStart = state.getActiveSchoolYearStartDate();
    const activeYearEnd = state.getActiveSchoolYearEndDate();
    const prevBtn = document.getElementById('prev-month-btn');
    const nextBtn = document.getElementById('next-month-btn');
    if (prevBtn) {
        prevBtn.disabled = Boolean(activeYearStart && calendarCurrentDate <= startOfDay(activeYearStart));
        prevBtn.setAttribute('aria-label', 'Previous day');
    }
    if (nextBtn) {
        nextBtn.disabled = Boolean(activeYearEnd && calendarCurrentDate >= startOfDay(activeYearEnd));
        nextBtn.setAttribute('aria-label', 'Next day');
    }

    const special = agenda.special;
    const holidayHtml = agenda.isNoSchool
        ? `<section class="m-cal-banner m-cal-banner--holiday qc-day--theme-${escapeHtml(agenda.theme || 'break')}" aria-label="Holiday">
                <span class="m-cal-banner__icon" aria-hidden="true">${escapeHtml(agenda.holidayIcon || '📅')}</span>
                <div>
                    <p class="m-cal-banner__label">${escapeHtml(agenda.holidayLabel || 'No School')}</p>
                    ${special?.nameEl && special.nameEl !== agenda.holidayLabel ? `<p class="m-cal-banner__sub" lang="el">${escapeHtml(special.nameEl)}</p>` : ''}
                    <p class="m-cal-banner__hint">${escapeHtml(special?.blurb || 'No regular lessons this day')}</p>
                </div>
           </section>`
        : (special?.key
            ? `<section class="m-cal-banner m-cal-banner--special qc-day--theme-${escapeHtml(special.theme)}" aria-label="Special day">
                    <span class="m-cal-banner__icon" aria-hidden="true">${escapeHtml(special.icon)}</span>
                    <div>
                        <p class="m-cal-banner__label">${escapeHtml(special.name)}</p>
                        <p class="m-cal-banner__hint">${escapeHtml(special.kind === 'closure' || special.kind === 'local' ? 'A holiday, but your school is open. Lessons as normal.' : special.blurb)}</p>
                    </div>
               </section>`
            : '')
        + (agenda.breakEdge
            ? `<p class="m-cal-edge">${agenda.breakEdge.edge === 'last-before' ? `🎒 Last lessons before ${escapeHtml(agenda.breakEdge.range.name || 'the break')}` : `🔔 Back from ${escapeHtml(agenda.breakEdge.range.name || 'the break')}`}</p>`
            : '');

    const lessonsHtml = agenda.classes.length
        ? agenda.classes.map((c) => {
            const testTitle = c.testAssignment?.testData?.title;
            const testHtml = c.testAssignment
                ? `<span class="m-cal-lesson__test" title="${escapeHtml(testTitle || 'Test')}">📝 TEST</span>`
                : '';
            return `<article class="m-cal-lesson ${c.color?.bg || ''} ${c.color?.text || ''} ${c.color?.border ? `border-l-4 ${c.color.border}` : ''}">
                <div class="m-cal-lesson__meta">
                    <span class="m-cal-lesson__time">${escapeHtml(c.timeDisplay || 'Lesson')}</span>
                    ${testHtml}
                </div>
                <p class="m-cal-lesson__name">${escapeHtml(c.logo || '')} ${escapeHtml(c.name || 'Class')}</p>
            </article>`;
        }).join('')
        : `<p class="m-cal-empty">No lessons scheduled</p>`;

    const eventsHtml = agenda.questEvents.length
        ? agenda.questEvents.map((e) => {
            const normalized = normalizeQuestType(e.type);
            const gradients = {
                double_star_day: 'linear-gradient(120deg, #f59e0b 0%, #eab308 100%)',
                reason_bonus_day: 'linear-gradient(120deg, #ec4899 0%, #e11d48 100%)',
                vocabulary_vault: 'linear-gradient(120deg, #9333ea 0%, #4338ca 100%)',
                grammar_guardians: 'linear-gradient(120deg, #059669 0%, #0f766e 100%)',
                unbroken_chain: 'linear-gradient(120deg, #0891b2 0%, #2563eb 100%)',
                scribes_sketch: 'linear-gradient(120deg, #d97706 0%, #ea580c 100%)',
                five_sentence_saga: 'linear-gradient(120deg, #e11d48 0%, #7c3aed 100%)'
            };
            const bg = gradients[normalized] || 'linear-gradient(120deg, #c026d3 0%, #4f46e5 100%)';
            return `
            <article class="m-cal-event" style="background: ${bg}">
                <span class="m-cal-event__icon">${escapeHtml(e.icon)}</span>
                <div class="m-cal-event__body">
                    <p class="m-cal-event__title">${escapeHtml(e.title)}</p>
                    <p class="m-cal-event__type">${escapeHtml(e.type || 'Quest Event')}</p>
                </div>
                <button type="button" class="m-cal-event__delete delete-event-btn" data-id="${escapeHtml(e.id)}" data-name="${escapeHtml(e.title)}" aria-label="Delete event">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </article>`;
        }).join('')
        : '';

    const starsHtml = agenda.starTotal > 0
        ? `<section class="m-cal-stars" aria-label="Stars earned">
                <i class="fas fa-star" aria-hidden="true"></i>
                <span><strong>${agenda.starTotal}</strong> star${agenda.starTotal === 1 ? '' : 's'} earned this day</span>
           </section>`
        : '';

    const isEmpty = !agenda.isNoSchool && !agenda.classes.length && !agenda.questEvents.length && agenda.starTotal <= 0;
    const emptyHtml = isEmpty
        ? `<div class="m-cal-empty-state">
                <span aria-hidden="true">🌤️</span>
                <p>No lessons or quest events on this day.</p>
           </div>`
        : '';

    const showLessonsSection = !isEmpty && !agenda.isNoSchool;
    const lessonsSection = showLessonsSection
        ? `<section class="m-cal-section">
                <h3 class="m-cal-section__title">Lessons</h3>
                <div class="m-cal-section__body">${lessonsHtml}</div>
           </section>`
        : '';

    dayRoot.innerHTML = `
        <div class="m-cal-day-card">
            ${holidayHtml}
            ${emptyHtml}
            ${lessonsSection}
            ${agenda.questEvents.length ? `
            <section class="m-cal-section">
                <h3 class="m-cal-section__title">Quest Events</h3>
                <div class="m-cal-section__body m-cal-section__body--events">${eventsHtml}</div>
            </section>` : ''}
            ${starsHtml}
            <div class="m-cal-actions">
                <button type="button" class="m-cal-action m-cal-action--plan" data-m-cal-action="plan" data-date="${escapeHtml(dateString)}">
                    <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
                    Plan day
                </button>
                <button type="button" class="m-cal-action m-cal-action--log" data-m-cal-action="logbook" data-date="${escapeHtml(dateString)}" ${agenda.isFuture ? 'disabled' : ''}>
                    <i class="fas fa-book-open" aria-hidden="true"></i>
                    Open logbook
                </button>
            </div>
        </div>
    `;
}

const QC_EVENT_THEMES = {
    double_star_day: 'star',
    reason_bonus_day: 'reason',
    vocabulary_vault: 'vault',
    grammar_guardians: 'grammar',
    unbroken_chain: 'chain',
    scribes_sketch: 'scribe',
    five_sentence_saga: 'saga',
    day_treasure: 'treasure',
};

function formatStarCount(value) {
    const n = Number(value) || 0;
    const rounded = Math.round(n * 4) / 4;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, '');
}

function splitEventIcon(icon) {
    const raw = String(icon || '📅');
    const [glyph] = raw.split(' ');
    return glyph || '📅';
}

function renderQuestEventRibbon(e) {
    const theme = QC_EVENT_THEMES[normalizeQuestType(e.type)] || 'custom';
    const title = escapeHtml(e.title);
    const status = e.status && e.status !== 'scheduled'
        ? `<span class="qc-ribbon__status">${escapeHtml(String(e.status).replace(/_/g, ' '))}</span>`
        : '';
    return `
        <div class="qc-ribbon qc-ribbon--${theme}" title="${title}">
            <span class="qc-ribbon__glyph" aria-hidden="true">${escapeHtml(splitEventIcon(e.icon))}</span>
            <span class="qc-ribbon__title">${title}</span>
            ${status}
            <button type="button" class="qc-ribbon__delete delete-event-btn" data-id="${escapeHtml(e.id)}" data-name="${title}" aria-label="Delete ${title}">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
        </div>`;
}

function renderLessonChip(c) {
    const testTitle = c.testAssignment?.testData?.title || 'Test';
    const test = c.testAssignment
        ? `<span class="qc-lesson__test" title="Test: ${escapeHtml(testTitle)}">📝</span>`
        : '';
    return `
        <div class="qc-lesson ${c.color?.bg || ''} ${c.color?.text || ''} ${c.color?.border || ''}${c.testAssignment ? ' qc-lesson--test' : ''}" title="${escapeHtml(c.name)}${c.timeDisplay ? ` · ${escapeHtml(c.timeDisplay)}` : ''}">
            <span class="qc-lesson__logo" aria-hidden="true">${escapeHtml(c.logo || '🏫')}</span>
            <span class="qc-lesson__text">
                ${c.timeDisplay ? `<span class="qc-lesson__time">${escapeHtml(c.timeDisplay)}</span>` : ''}
                <span class="qc-lesson__name">${escapeHtml(c.name)}</span>
            </span>
            ${test}
        </div>`;
}

/** Where a day sits inside a multi-day holiday range (for the joined-up "break" look). */
function holidayRunEdges(range, dateString) {
    if (!range?.start || !range?.end || range.start === range.end) return { inside: false, first: false, last: false };
    const iso = utils.getDDMMYYYY(utils.parseDDMMYYYY(dateString)).split('-').reverse().join('-');
    return { inside: true, first: iso === range.start, last: iso === range.end };
}

// Tiny CSS-drawn decorations behind a holiday's stamp (shapes styled in styles/calendar_holidays.css).
const HOLIDAY_ART = {
    national: '<span class="qc-art__flag"><span></span></span><span class="qc-art__laurel"></span>',
    remembrance: '<span class="qc-art__candle"><span></span></span>',
    winter: '<span class="qc-art__flake" style="--x:14%;--d:0s"></span><span class="qc-art__flake" style="--x:48%;--d:1.4s"></span><span class="qc-art__flake" style="--x:80%;--d:2.6s"></span>',
    spring: '<span class="qc-art__egg" style="--x:12%;--c:#ef4444"></span><span class="qc-art__egg" style="--x:80%;--c:#f59e0b"></span>',
    kites: '<span class="qc-art__kite" style="--x:16%;--c:#f43f5e;--d:0s"></span><span class="qc-art__kite" style="--x:74%;--c:#0ea5e9;--d:1.2s"></span>',
    flowers: '<span class="qc-art__bloom" style="--x:10%;--c:#f472b6"></span><span class="qc-art__bloom" style="--x:30%;--c:#facc15"></span><span class="qc-art__bloom" style="--x:72%;--c:#a78bfa"></span><span class="qc-art__bloom" style="--x:90%;--c:#fb7185"></span>',
    dove: '<span class="qc-art__wave"></span>',
    summer: '<span class="qc-art__sun"></span><span class="qc-art__wave"></span>',
    local: '<span class="qc-art__bell"></span>',
};

// Celebration days with lessons: a few floating shapes behind the tile (calendar_holidays.css).
const CELEBRATION_ART = {
    bats: '<span class="qc-art__bat" style="--x:18%;--y:42%;--d:0s"></span><span class="qc-art__bat" style="--x:62%;--y:58%;--d:1.1s"></span>',
    hearts: '<span class="qc-art__heart" style="--x:14%;--d:0s"></span><span class="qc-art__heart" style="--x:52%;--d:1.6s"></span><span class="qc-art__heart" style="--x:80%;--d:3s"></span>',
    clovers: '<span class="qc-art__clover" style="--x:12%"></span><span class="qc-art__clover" style="--x:46%"></span>',
    leaves: '<span class="qc-art__leaf" style="--x:16%;--d:0s"></span><span class="qc-art__leaf" style="--x:58%;--d:2s"></span>',
    sparks: '<span class="qc-art__spark" style="--x:16%;--y:46%;--d:0s"></span><span class="qc-art__spark" style="--x:52%;--y:70%;--d:.9s"></span><span class="qc-art__spark" style="--x:82%;--y:40%;--d:1.8s"></span>',
    confetti: '<span class="qc-art__bit" style="--x:12%;--c:#f472b6;--d:0s"></span><span class="qc-art__bit" style="--x:38%;--c:#facc15;--d:1.2s"></span><span class="qc-art__bit" style="--x:64%;--c:#38bdf8;--d:2.1s"></span><span class="qc-art__bit" style="--x:86%;--c:#34d399;--d:.6s"></span>',
};

function celebrationArtHtml(art) {
    return CELEBRATION_ART[art] || CELEBRATION_ART.confetti;
}

function holidayArtHtml(theme) {
    return HOLIDAY_ART[theme] || '';
}

/** The month's holidays and special days, as a strip of chips under the month title. */
function renderMonthSpecials(items) {
    const host = document.getElementById('qc-month-specials');
    if (!host) return;
    // A break shows once (its first day in this month), single days each get a chip.
    const seen = new Set();
    const chips = items.filter((item) => {
        const id = item.holiday && item.holiday.start !== item.holiday.end ? `range:${item.holiday.id}` : `day:${item.day}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    }).map((item) => {
        const range = item.holiday && item.holiday.start !== item.holiday.end ? item.holiday : null;
        const special = item.special || null;
        const label = range ? (range.name || item.label) : item.label;
        const icon = range ? (range.icon || item.icon) : item.icon;
        const day = item.date || null;
        const weekday = day ? day.toLocaleDateString('en-GB', { weekday: 'short' }) : '';
        const longDate = range
            ? `${formatChipDate(range.start)} – ${formatChipDate(range.end)}`
            : (day ? day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '');
        const state = item.closed ? 'No lessons' : (item.open ? 'Holiday · your school is open' : 'Lessons as normal');
        const greek = !range && special?.nameEl && special.nameEl !== special.name ? special.nameEl : (range?.nameEl || '');
        const blurb = range ? (range.blurb || special?.blurb || '') : (special?.blurb || '');
        const spanDays = range ? Math.round((Date.UTC(...range.end.split('-').map((n, i) => (i === 1 ? n - 1 : +n))) - Date.UTC(...range.start.split('-').map((n, i) => (i === 1 ? n - 1 : +n)))) / 86400000) + 1 : 0;
        const vars = item.colors ? ` style="--hol-a:${escapeHtml(item.colors[0])};--hol-b:${escapeHtml(item.colors[1])};--hol-ink:${escapeHtml(item.colors[2])};--hol-line:${escapeHtml(item.colors[2])}55"` : '';
        const dateBadge = range
            ? `<span class="qc-special-chip__date qc-special-chip__date--range"><b>${escapeHtml(formatChipDate(range.start))}</b><small>to ${escapeHtml(formatChipDate(range.end))}</small></span>`
            : `<span class="qc-special-chip__date"><b>${item.day}</b><small>${escapeHtml(weekday)}</small></span>`;
        return `<li class="qc-special-chip qc-special-chip--${escapeHtml(item.theme || 'break')}${item.closed ? ' qc-special-chip--closed' : ''}"${vars}>
            <button type="button" class="qc-special-chip__btn" data-special-day="${escapeHtml(range ? '' : (item.dateString || ''))}" aria-label="${escapeHtml(`${label}, ${longDate}: ${state}`)}">
                ${dateBadge}
                <span class="qc-special-chip__icon" aria-hidden="true">${escapeHtml(icon || '📅')}</span>
                <span class="qc-special-chip__name">${escapeHtml(label)}</span>
                ${item.closed ? '<span class="qc-special-chip__tag">No lessons</span>' : ''}
            </button>
            <span class="qc-special-tip" role="tooltip">
                <span class="qc-special-tip__icon" aria-hidden="true">${escapeHtml(icon || '📅')}</span>
                <span class="qc-special-tip__body">
                    <strong>${escapeHtml(label)}</strong>
                    ${greek ? `<span class="qc-special-tip__greek" lang="el">${escapeHtml(greek)}</span>` : ''}
                    <span class="qc-special-tip__when"><i class="fas fa-calendar-day" aria-hidden="true"></i> ${escapeHtml(longDate)}${spanDays > 1 ? ` · ${spanDays} days` : ''}</span>
                    <span class="qc-special-tip__state${item.closed ? ' is-closed' : ''}">${item.closed ? '<i class="fas fa-umbrella-beach" aria-hidden="true"></i>' : '<i class="fas fa-school" aria-hidden="true"></i>'} ${escapeHtml(state)}</span>
                    ${blurb ? `<span class="qc-special-tip__blurb">${escapeHtml(blurb)}</span>` : ''}
                    ${range ? '' : '<span class="qc-special-tip__hint">Click to open the day</span>'}
                </span>
            </span>
        </li>`;
    });
    host.innerHTML = chips.join('');
    host.hidden = chips.length === 0;
    host.onclick = (e) => {
        const btn = e.target.closest('[data-special-day]');
        if (!btn || !btn.dataset.specialDay) return;
        const cell = document.querySelector(`.calendar-day-cell[data-date="${btn.dataset.specialDay}"]`);
        if (cell) cell.click();
        else import('../modals/planner.js').then((m) => m.openDayPlannerModal(btn.dataset.specialDay, null)).catch(quietly('ui/tabs/selectors.js'));
    };
}

function formatChipDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Busy tiles: fade the lesson list and show "+N more" until it is scrolled to the end. */
function markOverflowingLessons(grid) {
    grid.querySelectorAll('.qc-day__lessons').forEach((list) => {
        if (list.scrollHeight <= list.clientHeight + 2) return;
        const cell = list.closest('.qc-day');
        const pill = document.createElement('span');
        pill.className = 'qc-day__more';
        pill.setAttribute('aria-hidden', 'true');
        cell.appendChild(pill);
        const update = () => {
            const bottom = list.getBoundingClientRect().bottom;
            // Chips cut off by the fade count as hidden too.
            const hiddenCount = [...list.children].filter((chip) => chip.getBoundingClientRect().bottom > bottom - 18).length;
            const atEnd = hiddenCount === 0;
            list.classList.toggle('is-more', !atEnd);
            pill.hidden = atEnd;
            pill.innerHTML = `+${hiddenCount} more <i class="fas fa-chevron-down"></i>`;
        };
        update();
        list.addEventListener('scroll', update, { passive: true });
    });
}

const STAT_DAY = (day) => day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });

/** One hover card under a month chip: a title, a line of meaning, then the month's rows. */
function statTipHtml(tone, title, lead, rows, empty) {
    const list = rows.length
        ? `<ul class="qc-tip__rows">${rows.slice(0, 6).map((r) => `
            <li><span class="qc-tip__when">${escapeHtml(r.when || '')}</span><span class="qc-tip__what">${r.icon ? `<span aria-hidden="true">${escapeHtml(r.icon)}</span> ` : ''}${escapeHtml(r.what)}</span>${r.value != null ? `<b>${escapeHtml(String(r.value))}</b>` : ''}</li>`).join('')}</ul>
            ${rows.length > 6 ? `<p class="qc-tip__more">and ${rows.length - 6} more</p>` : ''}`
        : `<p class="qc-tip__empty">${escapeHtml(empty)}</p>`;
    return `<span class="qc-tip qc-tip--${tone}" role="tooltip"><strong class="qc-tip__title">${escapeHtml(title)}</strong><span class="qc-tip__lead">${escapeHtml(lead)}</span>${list}</span>`;
}

function renderMonthStats({ stars, events, schoolDays, tests, daysOff = 0, detail = {} }, monthLabel = 'this month') {
    const host = document.getElementById('qc-month-stats');
    if (!host) return;
    const pill = (tone, icon, value, label, tip) => `
        <span class="qc-stat qc-stat--${tone}" tabindex="0" aria-label="${escapeHtml(`${value} ${label}`)}">
            <span class="qc-stat__icon" aria-hidden="true">${icon}</span>
            <span class="qc-stat__value">${value}</span>
            <span class="qc-stat__label">${escapeHtml(label)}</span>
            ${tip}
        </span>`;
    const classes = new Map((state.get('allSchoolClasses') || []).map((c) => [c.id, c]));
    const className = (id) => classes.get(id)?.name || 'A class';
    const classLogo = (id) => classes.get(id)?.logo || '📚';

    const starRows = Object.entries(detail.starsByClass || {}).sort((a, b) => b[1] - a[1])
        .map(([id, n]) => ({ icon: classLogo(id), what: className(id), value: formatStarCount(n) }));
    const best = detail.bestStarDay;
    const lessonRows = Object.entries(detail.lessonsByClass || {}).sort((a, b) => b[1] - a[1])
        .map(([id, n]) => ({ icon: classLogo(id), what: className(id), value: `${n} ${n === 1 ? 'lesson' : 'lessons'}` }));

    host.innerHTML = [
        pill('stars', '<i class="fas fa-star"></i>', formatStarCount(stars), stars === 1 ? 'star' : 'stars',
            statTipHtml('stars', `${formatStarCount(stars)} ${stars === 1 ? 'star' : 'stars'} in ${monthLabel}`,
                best ? `Brightest day: ${STAT_DAY(best.day)} with ${formatStarCount(best.stars)} ★` : 'Stars awarded to every class, all teachers together.',
                starRows, 'No stars awarded yet. The first one is waiting!')),
        pill('events', '<i class="fas fa-wand-magic-sparkles"></i>', events, events === 1 ? 'event' : 'events',
            statTipHtml('events', `${events} quest ${events === 1 ? 'event' : 'events'}`, 'Special quest days planned on lesson days.',
                (detail.events || []).map((e) => ({ when: STAT_DAY(e.day), what: e.title, icon: String(e.icon || '').split(' ')[0] })),
                'Nothing planned yet. Open a day to add a quest event.')),
        pill('days', '<i class="fas fa-school"></i>', schoolDays, schoolDays === 1 ? 'lesson day' : 'lesson days',
            statTipHtml('days', `${schoolDays} lesson ${schoolDays === 1 ? 'day' : 'days'}`, `Days when at least one of your classes meets. ${detail.lessonTotal || 0} lessons in all.`,
                lessonRows, 'None of your classes meet this month.')),
        tests ? pill('tests', '📝', tests, tests === 1 ? 'test' : 'tests',
            statTipHtml('tests', `${tests} ${tests === 1 ? 'test' : 'tests'}`, 'Tests set for your classes this month.',
                (detail.tests || []).map((t) => ({ when: STAT_DAY(t.day), icon: classLogo(t.classId), what: t.title ? `${className(t.classId)} · ${t.title}` : className(t.classId) })), '')) : '',
        daysOff ? pill('off', '<i class="fas fa-umbrella-beach"></i>', daysOff, daysOff === 1 ? 'day off' : 'days off',
            statTipHtml('off', `${daysOff} ${daysOff === 1 ? 'weekday' : 'weekdays'} off`, 'School days with no lessons: holidays and breaks. Weekends are not counted.',
                (detail.daysOff || []).map((d) => ({ when: d.when, icon: d.icon, what: d.label })), '')) : '',
    ].join('');
}

// Accepts optional 'customLogs' for historical views. 
// If null, defaults to state.allAwardLogs (Current Month).
export function renderCalendarTab(customLogs = null) {
    // Schedule and event listeners all funnel through here, so keep an open Planner in step.
    import('../modals/planner.js').then(m => m.refreshOpenDayPlanner?.()).catch(quietly('ui/tabs/selectors.js'));

    if (isMobileCalendarMode()) {
        renderMobileCalendarDay(customLogs);
        return;
    }

    const grid = document.getElementById('calendar-grid');
    const dayRoot = document.getElementById('m-calendar-day');
    if (dayRoot) {
        dayRoot.hidden = true;
        dayRoot.innerHTML = '';
    }
    if (grid) grid.hidden = false;
    if (!grid) return;

    const todayChip = document.getElementById('m-calendar-today-chip');
    if (todayChip) todayChip.classList.add('hidden');

    // Determine which dataset to use (hide closed-year stars after year-end close)
    const logsToRender = filterDocsForActiveYear(
        customLogs || state.get('allAwardLogs'),
        state.get('schoolYearState'),
    );
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};

    const loader = document.getElementById('calendar-loader');
    const isLoaderVisible = loader && !loader.classList.contains('hidden');

    grid.innerHTML = '';
    if (loader) grid.appendChild(loader);

    const dayHeaders = [
        { short: 'Mon', long: 'Monday' }, { short: 'Tue', long: 'Tuesday' }, { short: 'Wed', long: 'Wednesday' },
        { short: 'Thu', long: 'Thursday' }, { short: 'Fri', long: 'Friday' },
        { short: 'Sat', long: 'Saturday', weekend: true }, { short: 'Sun', long: 'Sunday', weekend: true },
    ];
    dayHeaders.forEach(day => {
        const headerEl = document.createElement('div');
        headerEl.className = `calendar-header-cell qc-weekday${day.weekend ? ' qc-weekday--weekend' : ''}`;
        headerEl.setAttribute('role', 'columnheader');
        headerEl.innerHTML = `<abbr title="${day.long}">${day.short}</abbr>`;
        grid.appendChild(headerEl);
    });

    const calendarCurrentDate = state.get('calendarCurrentDate');
    const month = calendarCurrentDate.getMonth(), year = calendarCurrentDate.getFullYear();
    document.getElementById('calendar-month-year').innerText = calendarCurrentDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeYearStart = state.getActiveSchoolYearStartDate();
    const activeYearEnd = state.getActiveSchoolYearEndDate();
    const prevBtn = document.getElementById('prev-month-btn');
    const nextBtn = document.getElementById('next-month-btn');
    if (prevBtn) {
        prevBtn.disabled = !activeYearStart || calendarCurrentDate <= activeYearStart;
        prevBtn.setAttribute('aria-label', 'Previous month');
    }
    if (nextBtn) {
        nextBtn.disabled = !activeYearEnd || (month === activeYearEnd.getMonth() && year === activeYearEnd.getFullYear());
        nextBtn.setAttribute('aria-label', 'Next month');
    }
    const isViewingThisMonth = month === today.getMonth() && year === today.getFullYear();
    document.getElementById('calendar-today-btn')?.classList.toggle('hidden', isViewingThisMonth);

    const stats = { stars: 0, events: 0, schoolDays: 0, tests: 0, daysOff: 0 };
    // What the hover cards on the month chips list (renderMonthStats).
    const detail = { starsByClass: {}, bestStarDay: null, events: [], tests: [], lessonsByClass: {}, lessonTotal: 0, daysOff: [] };
    const myClassIds = new Set((state.get('allTeachersClasses') || []).map((c) => c.id));
    const monthSpecials = [];
    const agendaSlices = {
        allSchoolClasses: state.get('allSchoolClasses'),
        allTeachersClasses: state.get('allTeachersClasses'),
        allScheduleOverrides: state.get('allScheduleOverrides'),
        schoolHolidayRanges: state.get('schoolHolidayRanges'),
        allQuestEvents: state.get('allQuestEvents'),
        allQuestAssignments: state.get('allQuestAssignments'),
        awardLogs: logsToRender,
        classEndDates,
        today,
    };

    const leadingBlanks = firstDayIndex;
    for (let i = 0; i < leadingBlanks; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-empty-cell qc-day qc-day--blank';
        emptyCell.setAttribute('aria-hidden', 'true');
        grid.appendChild(emptyCell);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const day = new Date(year, month, i);
        const dateString = utils.getDDMMYYYY(day);
        const agenda = getDayAgenda({ dateString, ...agendaSlices });
        const weekdayIndex = (day.getDay() + 6) % 7;
        const isWeekend = weekdayIndex >= 5;
        const longDate = day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

        const dayCell = document.createElement('div');
        dayCell.dataset.date = dateString;
        dayCell.setAttribute('role', 'gridcell');
        dayCell.tabIndex = 0;

        const tense = agenda.isToday ? 'today' : (agenda.isFuture ? 'future' : 'past');
        // Today and later open the Planner; earlier days open the Quest Log.
        const opensPlanner = !agenda.isPast;
        const dayNumber = `
            <span class="qc-day__num">${i}</span>
            ${agenda.isToday ? '<span class="qc-day__today-tag">Today</span>' : ''}`;
        const starBadge = agenda.starTotal > 0
            ? `<span class="calendar-star-count qc-day__stars" title="${formatStarCount(agenda.starTotal)} stars awarded"><i class="fas fa-star" aria-hidden="true"></i>${formatStarCount(agenda.starTotal)}</span>`
            : '';
        stats.stars += agenda.starTotal;
        Object.entries(agenda.starsByClass || {}).forEach(([id, n]) => { detail.starsByClass[id] = (detail.starsByClass[id] || 0) + n; });
        if (agenda.starTotal > 0 && agenda.starTotal > (detail.bestStarDay?.stars || 0)) detail.bestStarDay = { day: agenda.day, stars: agenda.starTotal };

        if (agenda.isNoSchool) {
            const themeKey = String(agenda.theme || (agenda.holiday ? (agenda.holiday.type || 'generic') : 'cancelled')).replace(/[^a-z]/gi, '');
            const legacyKey = agenda.holiday ? String(agenda.holiday.type || 'generic').replace(/[^a-z]/gi, '') : 'cancelled';
            const edge = holidayRunEdges(agenda.holiday, dateString);
            const special = agenda.special;
            const subName = special?.nameEl && special.nameEl !== special.name ? special.nameEl : '';
            // Inside a long break only its first day and the named feasts carry the full stamp.
            const quiet = edge.inside && !(special && special.key && special.key !== agenda.holiday?.key) && !edge.first;
            const runNote = edge.inside && special?.closureName && special.closureName !== agenda.holidayLabel ? special.closureName : '';
            dayCell.className = [
                'calendar-day-cell calendar-holiday-cell qc-day qc-day--holiday',
                `qc-day--hol-${legacyKey}`,
                `qc-day--theme-${themeKey}`,
                `qc-day--${tense}`,
                opensPlanner ? 'future-day' : 'logbook-day-btn',
                edge.inside ? 'qc-day--run' : '',
                edge.first ? 'qc-day--run-first' : '',
                edge.last ? 'qc-day--run-last' : '',
                quiet ? 'qc-day--run-quiet' : '',
            ].filter(Boolean).join(' ');
            dayCell.setAttribute('aria-label', `${longDate}: ${agenda.holidayLabel}${special?.also ? ` and ${special.also.name}` : ''}${runNote ? ` (${runNote})` : ''}. No lessons. ${opensPlanner ? 'Open planner' : 'Open quest log'}`);
            if (special?.blurb) dayCell.title = `${agenda.holidayLabel}${subName ? ` · ${subName}` : ''}\n${special.blurb}${special.also ? `\n\n${special.also.icon} ${special.also.name}${special.also.blurb ? `: ${special.also.blurb}` : ''}` : ''}`;
            dayCell.innerHTML = `
                <span class="qc-day__art qc-art--${themeKey}" aria-hidden="true">${holidayArtHtml(themeKey)}</span>
                <div class="qc-day__head">${dayNumber}${starBadge}</div>
                <div class="qc-day__stamp">
                    <span class="qc-day__stamp-icon" aria-hidden="true">${escapeHtml(agenda.holidayIcon || '📅')}</span>
                    <span class="qc-day__stamp-label">${escapeHtml(agenda.holidayLabel || 'No School')}</span>
                    ${subName && !quiet ? `<span class="qc-day__stamp-sub" lang="el">${escapeHtml(subName)}</span>` : ''}
                    ${special?.also ? `<span class="qc-day__stamp-also"><span aria-hidden="true">${escapeHtml(special.also.icon)}</span> & ${escapeHtml(special.also.name)}</span>` : ''}
                    ${runNote && !quiet ? `<span class="qc-day__stamp-run">${escapeHtml(runNote)}</span>` : ''}
                </div>
                ${agenda.classes.length ? `<span class="qc-day__makeup" title="Extra lessons on this holiday">${agenda.classes.map(c => escapeHtml(c.logo || '🏫')).join('')} extra lesson${agenda.classes.length === 1 ? '' : 's'}</span>` : ''}`;
            if (!isWeekend) {
                stats.daysOff += 1;
                // One row per holiday or break: consecutive weekdays of the same one are merged.
                const label = agenda.holiday?.name && agenda.holiday.start !== agenda.holiday.end ? agenda.holiday.name : (agenda.holidayLabel || 'No school');
                const lastOff = detail.daysOff[detail.daysOff.length - 1];
                if (lastOff && lastOff.label === label && lastOff.lastDay >= i - 3) {
                    lastOff.count += 1;
                    lastOff.lastDay = i;
                    lastOff.when = `${lastOff.firstLabel} – ${STAT_DAY(agenda.day)}`;
                } else {
                    const first = STAT_DAY(agenda.day);
                    detail.daysOff.push({ label, icon: (label === agenda.holiday?.name && agenda.holiday?.icon) || agenda.holidayIcon, when: first, firstLabel: first, lastDay: i, count: 1 });
                }
            }
            monthSpecials.push({ day: i, date: agenda.day, dateString, special, label: special?.also ? `${agenda.holidayLabel} & ${special.also.name}` : agenda.holidayLabel, icon: agenda.holidayIcon, theme: themeKey, closed: true, holiday: agenda.holiday });
            grid.appendChild(dayCell);
            continue;
        }

        const lessonIds = new Set(agenda.classes.map(c => c.id));
        const events = agenda.questEvents.filter(e => !e.classId || lessonIds.has(e.classId));
        const tests = agenda.classes.filter(c => c.testAssignment).length;
        stats.events += events.length;
        stats.tests += tests;
        if (agenda.classes.some(c => myClassIds.has(c.id))) stats.schoolDays += 1;
        agenda.classes.forEach((c) => {
            if (!myClassIds.has(c.id)) return;
            detail.lessonsByClass[c.id] = (detail.lessonsByClass[c.id] || 0) + 1;
            detail.lessonTotal += 1;
        });
        events.forEach((e) => detail.events.push({ day: agenda.day, title: e.title, icon: e.icon }));
        agenda.classes.filter(c => c.testAssignment).forEach((c) => detail.tests.push({ day: agenda.day, classId: c.id, title: c.testAssignment.testData?.title || '' }));

        const summaryBits = [
            agenda.classes.length ? `${agenda.classes.length} lesson${agenda.classes.length === 1 ? '' : 's'}` : 'no lessons',
            events.length ? `${events.length} quest event${events.length === 1 ? '' : 's'}` : '',
            tests ? `${tests} test${tests === 1 ? '' : 's'}` : '',
            agenda.starTotal > 0 ? `${formatStarCount(agenda.starTotal)} stars` : '',
        ].filter(Boolean).join(', ');
        dayCell.setAttribute('aria-label', `${longDate}: ${summaryBits}. ${opensPlanner ? 'Open planner' : 'Open quest log'}`);

        const quiet = !agenda.classes.length && !events.length;
        dayCell.className = [
            'calendar-day-cell qc-day',
            `qc-day--${tense}`,
            opensPlanner ? 'future-day' : 'logbook-day-btn',
            isWeekend ? 'qc-day--weekend' : '',
            quiet ? 'qc-day--quiet' : '',
            agenda.starTotal > 0 ? 'qc-day--starred' : '',
        ].filter(Boolean).join(' ');

        const hint = opensPlanner
            ? `<span class="qc-day__hint"><i class="fas fa-feather-pointed" aria-hidden="true"></i>${agenda.isToday ? 'Plan today' : 'Plan'}</span>`
            : `<span class="qc-day__hint"><i class="fas fa-book-open" aria-hidden="true"></i>Log</span>`;

        const special = agenda.special && agenda.special.key ? agenda.special : null;
        if (special) {
            dayCell.classList.add('qc-day--marked', `qc-day--theme-${special.theme}`);
            if (special.colors) {
                const [a, b, ink] = special.colors;
                dayCell.classList.add('qc-day--celebration');
                dayCell.style.setProperty('--hol-a', a);
                dayCell.style.setProperty('--hol-b', b);
                dayCell.style.setProperty('--hol-ink', ink);
                dayCell.style.setProperty('--hol-line', `${ink}55`);
            }
            monthSpecials.push({ day: i, date: agenda.day, dateString, special, label: special.name, icon: special.icon, theme: special.theme, colors: special.colors, closed: false, open: special.kind === 'closure' || special.kind === 'local' });
        }
        const specialRibbon = special
            ? `<div class="qc-day__special qc-special--${escapeHtml(special.theme)}" title="${escapeHtml(`${special.name}${special.nameEl && special.nameEl !== special.name ? ` · ${special.nameEl}` : ''}${special.blurb ? `\n${special.blurb}` : ''}`)}">
                    <span aria-hidden="true">${escapeHtml(special.icon)}</span><span class="qc-day__special-name">${escapeHtml(special.name)}</span>${special.kind === 'closure' || special.kind === 'local' ? '<span class="qc-day__special-open">open</span>' : ''}
               </div>`
            : '';
        const edgeTag = agenda.breakEdge && !isWeekend
            ? `<div class="qc-day__edge qc-day__edge--${agenda.breakEdge.edge}" title="${escapeHtml(agenda.breakEdge.edge === 'last-before' ? `Last school day before ${agenda.breakEdge.range.name || 'the break'}` : `Back from ${agenda.breakEdge.range.name || 'the break'}`)}">
                    <span aria-hidden="true">${agenda.breakEdge.edge === 'last-before' ? '🎒' : '🔔'}</span><span>${agenda.breakEdge.edge === 'last-before' ? 'Last day before the break' : 'Back to school!'}</span>
               </div>`
            : '';
        if (special) dayCell.setAttribute('aria-label', `${dayCell.getAttribute('aria-label')} ${special.name}.`);

        const celebrationArt = special?.colors
            ? `<span class="qc-day__art qc-art--${escapeHtml(special.art || 'confetti')}" aria-hidden="true">${celebrationArtHtml(special.art)}<span class="qc-day__watermark">${escapeHtml(special.icon)}</span></span>`
            : '';
        dayCell.innerHTML = `
            ${celebrationArt}
            <div class="qc-day__head">${dayNumber}${starBadge}</div>
            ${specialRibbon}${edgeTag}
            ${events.length ? `<div class="qc-day__events">${events.map(renderQuestEventRibbon).join('')}</div>` : ''}
            <div class="qc-day__lessons custom-scrollbar">${agenda.classes.map(renderLessonChip).join('')}</div>
            ${hint}`;
        grid.appendChild(dayCell);
    }

    const trailingBlanks = (7 - ((leadingBlanks + daysInMonth) % 7)) % 7;
    for (let i = 0; i < trailingBlanks; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-empty-cell qc-day qc-day--blank';
        emptyCell.setAttribute('aria-hidden', 'true');
        grid.appendChild(emptyCell);
    }

    if (loader && !isLoaderVisible) loader.classList.add('hidden');
    requestAnimationFrame(() => markOverflowingLessons(grid));
    renderMonthStats({ ...stats, detail }, new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long' }));
    renderMonthSpecials(monthSpecials);

}
