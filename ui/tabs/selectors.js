

export function findAndSetCurrentClass(targetSelectId = null) {
    if (state.get('globalSelectedClassId')) return;

    const todayString = utils.getTodayDateString();
    const classesToday = utils.getClassesOnDay(todayString, state.get('allSchoolClasses'), state.get('allScheduleOverrides'));
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

export function findAndSetCurrentLeague(shouldRender = true) {
    if (state.get('globalSelectedLeague')) return;

    const now = new Date();
    const currentDay = now.getDay().toString();
    const currentTime = now.toTimeString().slice(0, 5);
    for (const c of state.get('allTeachersClasses')) {
        if (c.scheduleDays && c.scheduleDays.includes(currentDay)) {
            if (c.timeStart && c.timeEnd && currentTime >= c.timeStart && currentTime <= c.timeEnd) {
                state.setGlobalSelectedLeague(c.questLevel);
                if (shouldRender) {
                    renderClassLeaderboardTab();
                    renderStudentLeaderboardTab();
                }
                return;
            }
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

    const loader = document.getElementById('calendar-loader');
    const isLoaderVisible = loader && !loader.classList.contains('hidden');

    grid.innerHTML = '';
    if (isLoaderVisible) {
        grid.appendChild(loader);
    }

    const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayHeaders.forEach(day => {
        const headerEl = document.createElement('div');
        headerEl.className = 'text-center font-bold text-gray-600';
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
        emptyCell.className = 'border rounded-md bg-gray-50/70 calendar-day-cell';
        grid.appendChild(emptyCell);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const day = new Date(year, month, i);
        const isFuture = day > today;
        const isToday = today.toDateString() === day.toDateString();
        const dateString = utils.getDDMMYYYY(day);

        const logsForThisDay = logsToRender.filter(log => utils.getDDMMYYYY(utils.parseDDMMYYYY(log.date)) === dateString);
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
        const classesOnThisDay = utils.getClassesOnDay(dateString, state.get('allSchoolClasses'), state.get('allScheduleOverrides'));
        const myClassIds = myClasses.map(c => c.id);
        const myCancellations = state.get('allScheduleOverrides').filter(o =>
            o.date === dateString &&
            o.type === 'cancelled' &&
            myClassIds.includes(o.classId)
        );

        const isFullHoliday = globalHoliday || (myScheduledClasses.length > 0 && classesOnThisDay.length === 0 && myCancellations.length > 0);
        const dayNumberHtml = isToday ? `<span class="today-date-highlight shadow-md transform scale-110">${i}</span>` : i;

        if (isFullHoliday) {
            const themeClass = globalHoliday ? `holiday-theme-${globalHoliday.type}` : 'bg-red-50 border-red-200';
            const labelText = globalHoliday ? (globalHoliday.type === 'christmas' ? 'Winter Break' : globalHoliday.name) : 'No School';
            const icon = globalHoliday ? (globalHoliday.type === 'christmas' ? '❄️' : (globalHoliday.type === 'easter' ? '🐰' : '📅')) : '⛔';

            dayCell.className = `border rounded-md p-1 calendar-day-cell calendar-holiday-cell ${themeClass} relative overflow-hidden flex flex-col`;
            dayCell.innerHTML = `
                <div class="font-bold text-right text-gray-400 opacity-50 z-10 relative">${i}</div>
                <div class="absolute inset-0 flex flex-col items-center justify-center opacity-80 pointer-events-none">
                    <span class="text-3xl mb-1">${icon}</span>
                    <span class="font-title text-xs uppercase tracking-wider font-bold text-gray-500 text-center leading-tight px-1">${labelText}</span>
                </div>
            `;
        } else {
            // --- RENDER NORMAL DAY ---
            dayCell.className = `border rounded-md p-1 calendar-day-cell flex flex-col ${isFuture ? 'bg-white future-day' : 'bg-white logbook-day-btn'}`;

            const starHtml = totalStarsThisDay > 0 ? `<div class="calendar-star-count text-center text-amber-600 font-bold -mt-4 mb-1 text-sm relative z-10"><i class="fas fa-star"></i> ${totalStarsThisDay}</div>` : '';

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

            const questEventsOnThisDay = state.get('allQuestEvents').filter(e => e.date === dateString);

            // --- NEW: Render Events as Banners (Outside Scroll) ---
            let questEventsHtml = questEventsOnThisDay.map(e => {
                const title = e.details?.title || e.type;
                const icon = eventIcons[e.type] || '📅 Event';
                // Vibrant Gradient Style
                return `
                <div class="relative group w-full mb-1 p-1 rounded-md bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-md border border-fuchsia-400 flex items-center justify-between z-20 cursor-help transition-transform hover:scale-105" title="${title}">
                    <div class="flex items-center gap-1.5 overflow-hidden">
                        <span class="text-[10px] font-bold bg-white/20 px-1 rounded">${icon}</span>
                        <span class="font-title text-[10px] font-bold truncate leading-tight">${title}</span>
                    </div>
                    <button class="delete-event-btn bg-white/20 hover:bg-white/40 text-white rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 transition-colors" data-id="${e.id}" data-name="${title}">
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
                    ? `<div class="absolute -top-1 -right-1 z-20">
                         <span class="relative flex h-3 w-3">
                           <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                           <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                         </span>
                       </div>
                       <span class="absolute top-[-4px] right-[-4px] bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-bl-md rounded-tr-md shadow-sm z-10" title="Test: ${testAssignment.testData.title}">📝 TEST</span>`
                    : '';
                // -------------------------------------

                return `
                <div class="relative text-xs px-1.5 py-1 rounded ${color.bg} ${color.text} border-l-4 ${color.border} shadow-sm group hover:scale-[1.02] transition-transform" title="${c.name} (${timeDisplay})">
                    ${testIndicator}
                    <span class="font-bold block text-[10px] opacity-80">${timeDisplay}</span>
                    <span class="truncate block font-semibold">${c.logo} ${c.name}</span>
                </div>`;
            }).join('');

            dayCell.innerHTML = `
                <div class="font-bold text-right text-gray-800 text-sm mb-1">${dayNumberHtml}</div>
                ${starHtml}
                
                <!-- Events Area (Fixed Top) -->
                <div class="flex flex-col shrink-0">
                    ${questEventsHtml}
                </div>
                
                <!-- Classes Area (Scrollable) -->
                <div class="flex flex-col gap-1 mt-1 overflow-y-auto flex-grow custom-scrollbar" style="min-height: 0;">
                    ${classesHtml}
                </div>
            `;
        }
        grid.appendChild(dayCell);
    }
}
