// /ui/tabs/selectors.js
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

    const holidayHtml = agenda.isNoSchool
        ? `<section class="m-cal-banner m-cal-banner--holiday" aria-label="Holiday">
                <span class="m-cal-banner__icon" aria-hidden="true">${agenda.holidayIcon || '📅'}</span>
                <div>
                    <p class="m-cal-banner__label">${escapeHtml(agenda.holidayLabel || 'No School')}</p>
                    <p class="m-cal-banner__hint">No regular lessons today</p>
                </div>
           </section>`
        : '';

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

function renderMonthStats({ stars, events, schoolDays, tests }) {
    const host = document.getElementById('qc-month-stats');
    if (!host) return;
    const pill = (tone, icon, value, label) => `
        <span class="qc-stat qc-stat--${tone}" title="${escapeHtml(label)}">
            <span class="qc-stat__icon" aria-hidden="true">${icon}</span>
            <span class="qc-stat__value">${value}</span>
            <span class="qc-stat__label">${escapeHtml(label)}</span>
        </span>`;
    host.innerHTML = [
        pill('stars', '<i class="fas fa-star"></i>', formatStarCount(stars), stars === 1 ? 'star' : 'stars'),
        pill('events', '<i class="fas fa-wand-magic-sparkles"></i>', events, events === 1 ? 'event' : 'events'),
        pill('days', '<i class="fas fa-school"></i>', schoolDays, schoolDays === 1 ? 'lesson day' : 'lesson days'),
        tests ? pill('tests', '📝', tests, tests === 1 ? 'test' : 'tests') : '',
    ].join('');
}

// Accepts optional 'customLogs' for historical views. 
// If null, defaults to state.allAwardLogs (Current Month).
export function renderCalendarTab(customLogs = null) {
    // Schedule and event listeners all funnel through here, so keep an open Planner in step.
    import('../modals/planner.js').then(m => m.refreshOpenDayPlanner?.()).catch(() => {});

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

    const stats = { stars: 0, events: 0, schoolDays: 0, tests: 0 };
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

        if (agenda.isNoSchool) {
            const themeKey = agenda.holiday ? String(agenda.holiday.type || 'generic').replace(/[^a-z]/gi, '') : 'cancelled';
            dayCell.className = `calendar-day-cell calendar-holiday-cell qc-day qc-day--holiday qc-day--hol-${themeKey} qc-day--${tense} ${opensPlanner ? 'future-day' : 'logbook-day-btn'}`;
            dayCell.setAttribute('aria-label', `${longDate}: ${agenda.holidayLabel}. ${opensPlanner ? 'Open planner' : 'Open quest log'}`);
            dayCell.innerHTML = `
                <div class="qc-day__head">${dayNumber}${starBadge}</div>
                <div class="qc-day__stamp">
                    <span class="qc-day__stamp-icon" aria-hidden="true">${escapeHtml(agenda.holidayIcon || '📅')}</span>
                    <span class="qc-day__stamp-label">${escapeHtml(agenda.holidayLabel || 'No School')}</span>
                </div>`;
            grid.appendChild(dayCell);
            continue;
        }

        const lessonIds = new Set(agenda.classes.map(c => c.id));
        const events = agenda.questEvents.filter(e => !e.classId || lessonIds.has(e.classId));
        const tests = agenda.classes.filter(c => c.testAssignment).length;
        stats.events += events.length;
        stats.tests += tests;
        if (agenda.classes.some(c => (state.get('allTeachersClasses') || []).some(tc => tc.id === c.id))) stats.schoolDays += 1;

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

        dayCell.innerHTML = `
            <div class="qc-day__head">${dayNumber}${starBadge}</div>
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
    renderMonthStats(stats);

}
