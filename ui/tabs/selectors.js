// /ui/tabs/selectors.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import { renderAwardStarsStudentList } from './award.js';
import { getAwardLogMonthlyStarCredit } from '../../features/awardLogReasonMeta.js';
import { filterDocsForActiveYear } from '../../utils/schoolYear.js';
import { getDayAgenda, QUEST_EVENT_ICONS } from '../../utils/calendarDay.js';
import { escapeHtml } from '../../features/roles/shared.js';

export function findAndSetCurrentClass(targetSelectId = null) {
    if (state.get('globalSelectedClassId')) return;
    if (!state.get('classFollowSchedule')) return;

    const todayString = utils.getTodayDateString();
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
    const classesToday = utils.getClassesOnDay(todayString, state.get('allSchoolClasses'), state.get('allScheduleOverrides'), classEndDates);
    const myClassesToday = classesToday.filter(c => state.get('allTeachersClasses').some(tc => tc.id === c.id));

    const activeClass = utils.findCurrentLessonClass(myClassesToday);
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
        if (dayCell && totalStars > 0) {
            const dateNumberEl = dayCell.querySelector('.font-bold.text-right');
            if (dateNumberEl) {
                const existingStars = dayCell.querySelector('.calendar-star-count');
                if (existingStars) existingStars.remove();

                const starHtml = `<div class="calendar-star-count text-center text-amber-600 font-bold mt-1 text-sm"><i class="fas fa-star"></i> ${totalStars}</div>`;
                dateNumberEl.insertAdjacentHTML('afterend', starHtml);
            }
        }
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
        ? agenda.questEvents.map((e) => `
            <article class="m-cal-event">
                <span class="m-cal-event__icon">${escapeHtml(e.icon)}</span>
                <div class="m-cal-event__body">
                    <p class="m-cal-event__title">${escapeHtml(e.title)}</p>
                    <p class="m-cal-event__type">${escapeHtml(e.type || 'Quest Event')}</p>
                </div>
                <button type="button" class="m-cal-event__delete delete-event-btn" data-id="${escapeHtml(e.id)}" data-name="${escapeHtml(e.title)}" aria-label="Delete event">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </article>`).join('')
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

// Accepts optional 'customLogs' for historical views. 
// If null, defaults to state.allAwardLogs (Current Month).
export function renderCalendarTab(customLogs = null) {
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
    if (isLoaderVisible) {
        grid.appendChild(loader);
    }

    const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayHeaders.forEach(day => {
        const headerEl = document.createElement('div');
        headerEl.className = 'calendar-header-cell text-center font-bold text-gray-400 uppercase tracking-widest text-[10px] pb-3';
        headerEl.textContent = day;
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
    document.getElementById('prev-month-btn').disabled = !activeYearStart || calendarCurrentDate <= activeYearStart;
    document.getElementById('next-month-btn').disabled = !activeYearEnd || (calendarCurrentDate.getMonth() === activeYearEnd.getMonth() && calendarCurrentDate.getFullYear() === activeYearEnd.getFullYear());
    const prevBtn = document.getElementById('prev-month-btn');
    const nextBtn = document.getElementById('next-month-btn');
    if (prevBtn) prevBtn.setAttribute('aria-label', 'Previous month');
    if (nextBtn) nextBtn.setAttribute('aria-label', 'Next month');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const isRecentView = calendarCurrentDate >= thirtyDaysAgo;

    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day-cell calendar-empty-cell opacity-40';
        grid.appendChild(emptyCell);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const day = new Date(year, month, i);
        const isFuture = day > today;
        const isToday = today.toDateString() === day.toDateString();
        const dateString = utils.getDDMMYYYY(day);

        const logsForThisDay = logsToRender.filter(log => utils.datesMatch(log.date, dateString));
        const totalStarsThisDay = logsForThisDay.reduce((sum, log) => sum + getAwardLogMonthlyStarCredit(log), 0);

        const dayCell = document.createElement('div');
        dayCell.dataset.date = dateString;

        // 1. Check for Global Holidays
        const yyyy = day.getFullYear();
        const mm = String(day.getMonth() + 1).padStart(2, '0');
        const dd = String(day.getDate()).padStart(2, '0');
        const compDate = `${yyyy}-${mm}-${dd}`;

        const globalHoliday = (state.get('schoolHolidayRanges') || []).find(h => compDate >= h.start && compDate <= h.end);

        // 2. Check for Manual Cancellations
        const myClasses = state.get('allTeachersClasses');
        const dayOfWeekStr = day.getDay().toString();
        const myScheduledClasses = myClasses.filter(c => c.scheduleDays && c.scheduleDays.includes(dayOfWeekStr));
        const classesOnThisDay = utils.getClassesOnDay(dateString, state.get('allSchoolClasses'), state.get('allScheduleOverrides'), classEndDates);
        const myClassIds = myClasses.map(c => c.id);
        const myCancellations = state.get('allScheduleOverrides').filter(o =>
            o.date === dateString &&
            o.type === 'cancelled' &&
            myClassIds.includes(o.classId)
        );

        const isFullHoliday = globalHoliday || (myScheduledClasses.length > 0 && classesOnThisDay.length === 0 && myCancellations.length > 0);
        const dayNumberHtml = isToday ? `<span class="today-date-highlight shadow-lg transform scale-110 ring-2 ring-sky-300 ring-offset-2">${i}</span>` : i;

        if (isFullHoliday) {
            const themeClass = globalHoliday ? `holiday-theme-${globalHoliday.type}` : 'bg-rose-50 border-rose-100';
            const labelText = globalHoliday ? (globalHoliday.type === 'christmas' ? 'Winter Break' : globalHoliday.name) : 'No School';
            const icon = globalHoliday ? (globalHoliday.type === 'christmas' ? '❄️' : (globalHoliday.type === 'easter' ? '🐰' : '📅')) : '⛔';

            dayCell.className = `calendar-day-cell calendar-holiday-cell ${themeClass} relative overflow-hidden flex flex-col group transition-all duration-300 hover:brightness-95`;
            dayCell.innerHTML = `
                <div class="font-bold text-right text-gray-400 opacity-40 z-10 relative pr-2 pt-2">${i}</div>
                <div class="absolute inset-0 flex flex-col items-center justify-center opacity-80 pointer-events-none group-hover:scale-110 transition-transform">
                    <span class="text-3xl mb-1 drop-shadow-sm">${icon}</span>
                    <span class="font-title text-[10px] uppercase tracking-wider font-bold text-gray-500 text-center leading-tight px-2">${labelText}</span>
                </div>
            `;
        } else {
            // --- RENDER NORMAL DAY ---
            dayCell.className = `calendar-day-cell flex flex-col min-h-0 transition-all duration-300 ${isFuture ? 'bg-white/80 future-day hover:bg-sky-50' : 'bg-white logbook-day-btn hover:bg-amber-50/30'}`;

            const starHtml = totalStarsThisDay > 0 ? `<div class="calendar-star-count text-center text-amber-600 font-bold -mt-5 mb-2 text-sm relative z-10 filter drop-shadow-sm"><i class="fas fa-star mr-1"></i>${totalStarsThisDay}</div>` : '';

            // --- Event Icons Map ---
            const eventIcons = QUEST_EVENT_ICONS;

            const questEventsOnThisDay = state.get('allQuestEvents').filter(e => utils.datesMatch(e.date, dateString));

            // --- NEW: Render Events as Banners (Outside Scroll) ---
            let questEventsHtml = questEventsOnThisDay.map(e => {
                const title = e.details?.title || e.type;
                const icon = eventIcons[e.type] || '📅 Event';
                // Vibrant Gradient Style
                return `
                <div class="relative group w-full mb-1.5 p-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-md border border-white/20 flex items-center justify-between z-20 cursor-help transition-all hover:scale-[1.03] hover:shadow-lg" title="${title}">
                    <div class="flex items-center gap-1.5 overflow-hidden">
                        <span class="text-[9px] font-black bg-white/30 px-1.5 py-0.5 rounded-lg backdrop-blur-sm shadow-inner">${icon}</span>
                        <span class="font-title text-[10px] font-bold truncate leading-tight tracking-tight">${title}</span>
                    </div>
                    <button class="delete-event-btn bg-white/20 hover:bg-white/40 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center flex-shrink-0 transition-colors" data-id="${e.id}" data-name="${title}">
                        <i class="fas fa-times text-[8px]"></i>
                    </button>
                </div>`;
            }).join('');

            // Classes (Inside Scroll)
            let classesHtml = classesOnThisDay.map(c => {
                const color = c.color || constants.classColorPalettes[utils.simpleHashCode(c.id) % constants.classColorPalettes.length];
                const timeDisplay = (c.timeStart && c.timeEnd) ? `${c.timeStart}-${c.timeEnd}` : (c.timeStart || '');

                // --- NEW: Check for Scheduled Test (Smart Match) ---
                const testAssignment = state.get('allQuestAssignments').find(a =>
                    a.classId === c.id &&
                    a.testData &&
                    utils.datesMatch(dateString, a.testData.date)
                );

                // 2. Create the Indicator
                const testIndicator = testAssignment
                    ? `<div class="absolute -top-1.5 -right-1.5 z-20">
                         <span class="relative flex h-3.5 w-3.5">
                           <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                           <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border border-white shadow-sm"></span>
                         </span>
                       </div>
                       <span class="absolute top-[-5px] right-[-5px] bg-rose-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-bl-lg rounded-tr-lg shadow-md z-10 tracking-tighter" title="Test: ${testAssignment.testData.title}">📝 TEST</span>`
                    : '';
                // -------------------------------------

                return `
                <div class="relative text-xs px-2 py-1.5 rounded-xl ${color.bg} ${color.text} border-l-4 ${color.border} shadow-sm group hover:scale-[1.02] hover:shadow-md transition-all mb-1" title="${c.name} (${timeDisplay})">
                    ${testIndicator}
                    <div class="flex items-center justify-between mb-0.5">
                        <span class="font-black block text-[9px] opacity-60 tracking-wider">${timeDisplay}</span>
                    </div>
                    <span class="truncate block font-bold text-[11px]">${c.logo} ${c.name}</span>
                </div>`;
            }).join('');

            dayCell.innerHTML = `
                <div class="font-bold text-right text-gray-500 text-sm mb-1 pr-2 pt-1 opacity-70">${dayNumberHtml}</div>
                ${starHtml}
                
                <div class="px-1.5 pb-2 flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
                    <!-- Events Area (Fixed Top) -->
                    <div class="flex flex-col shrink-0">
                        ${questEventsHtml}
                    </div>
                    
                    <!-- Classes Area (Scrollable) -->
                    <div class="flex flex-col gap-1 mt-1 min-h-0 flex-1 min-w-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
                        ${classesHtml}
                    </div>
                </div>
            `;
        }
        grid.appendChild(dayCell);
    }
}
