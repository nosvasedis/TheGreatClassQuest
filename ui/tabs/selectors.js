// /ui/tabs/selectors.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import * as modals from '../modals.js';
import { renderAwardStarsStudentList } from './award.js';

export function findAndSetCurrentClass(targetSelectId = null) {
    if (state.get('globalSelectedClassId')) return;
    if (!state.get('classFollowSchedule')) return;

    const todayString = utils.getTodayDateString();
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
    const classesToday = utils.getClassesOnDay(todayString, state.get('allSchoolClasses'), state.get('allScheduleOverrides'), classEndDates);
    const myClassesToday = classesToday.filter(c => state.get('allTeachersClasses').some(tc => tc.id === c.id));

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    for (const c of myClassesToday) {
        if (c.timeStart && c.timeEnd && currentTime >= c.timeStart && currentTime <= c.timeEnd) {
            state.setGlobalSelectedClass(c.id);
            return;
        }
    }
}

export function populateCalendarStars(logSource) {
    if (!logSource || logSource.length === 0) return;

    const logsByDate = logSource.reduce((acc, log) => {
        const date = log.date;
        if (!acc[date]) {
            acc[date] = 0;
        }
        acc[date] += log.stars;
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

// Accepts optional 'customLogs' for historical views. 
// If null, defaults to state.allAwardLogs (Current Month).
export function renderCalendarTab(customLogs = null) {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    // Determine which dataset to use
    const logsToRender = customLogs || state.get('allAwardLogs');
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
    document.getElementById('prev-month-btn').disabled = calendarCurrentDate <= constants.competitionStart;
    document.getElementById('next-month-btn').disabled = calendarCurrentDate.getMonth() === constants.competitionEnd.getMonth() && calendarCurrentDate.getFullYear() === constants.competitionEnd.getFullYear();

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
        const totalStarsThisDay = logsForThisDay.reduce((sum, log) => sum + (log.stars || 0), 0);

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

            // --- NEW: Event Icons Map ---
            const eventIcons = {
                '2x Star Day': '⭐ x2',
                'Reason Bonus Day': '✨ Bonus',
                'Vocabulary Vault': '🔑 Vocab',
                'The Unbroken Chain': '🔗 Chain',
                'Grammar Guardians': '🛡️ Grammar',
                'The Scribe\'s Sketch': '✏️ Sketch',
                'Five-Sentence Saga': '📜 Saga'
            };

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
