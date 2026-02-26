// /ui/tabs/log.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import * as modals from '../modals.js';
import { renderAwardStarsStudentList } from './award.js';

export async function renderAdventureLogTab() {
    const classSelect = document.getElementById('adventure-log-class-select');
    const monthFilter = document.getElementById('adventure-log-month-filter');

    if (!classSelect || !monthFilter) return;

    const classVal = state.get('globalSelectedClassId');
    const optionsHtml = state.get('allTeachersClasses').sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${c.logo} ${c.name}</option>`).join('');
    classSelect.innerHTML = '<option value="">Select a class to view its log...</option>' + optionsHtml;

    if (classVal) {
        classSelect.value = classVal;
    }

    state.get('currentLogFilter').classId = classVal;
    document.getElementById('log-adventure-btn').disabled = !classVal;
    document.getElementById('quest-assignment-btn').disabled = !classVal;
    document.getElementById('attendance-chronicle-btn').disabled = !classVal;
    document.getElementById('hall-of-heroes-btn').disabled = !classVal;

    const monthVal = monthFilter.value;

    // --- FIX: Generate month list from competition start instead of memory ---
    const availableMonths = [];
    const now = new Date();
    // Start from the first day of the competition start month
    let loopDate = new Date(constants.competitionStart.getFullYear(), constants.competitionStart.getMonth(), 1);

    while (loopDate <= now) {
        const month = (loopDate.getMonth() + 1).toString().padStart(2, '0');
        const year = loopDate.getFullYear();
        availableMonths.unshift(`${month}-${year}`); // Newest months first
        loopDate.setMonth(loopDate.getMonth() + 1);
    }

    const currentMonth = utils.getDDMMYYYY(new Date()).substring(3);

    monthFilter.innerHTML = availableMonths.map(monthKey => {
        const [m, y] = monthKey.split('-').map(Number);
        const d = new Date(y, m - 1, 1);
        const display = d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
        return `<option value="${monthKey}">${display}</option>`;
    }).join('');

    monthFilter.value = monthVal || currentMonth;
    state.get('currentLogFilter').month = monthFilter.value;

    await renderAdventureLog();
}

export async function renderAdventureLog() {
    const feed = document.getElementById('adventure-log-feed');
    if (!feed) return;

    const currentLogFilter = state.get('currentLogFilter');

    if (!currentLogFilter.classId) {
        feed.innerHTML = `<p class="text-center text-gray-500 bg-white/50 p-6 rounded-2xl">Please select one of your classes to see its Adventure Log.</p>`;
        return;
    }

    // --- FIX: ON-DEMAND FETCHING FOR HISTORICAL LOGS ---
    let logsForClass = [];
    const [month, year] = currentLogFilter.month.split('-').map(Number);
    const viewMonthStart = new Date(year, month - 1, 1);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (viewMonthStart >= thirtyDaysAgo) {
        // Use real-time state for recent logs
        logsForClass = state.get('allAdventureLogs').filter(log => {
            if (log.classId !== currentLogFilter.classId) return false;
            const dateObj = utils.parseFlexibleDate(log.date);
            if (!dateObj || isNaN(dateObj.getTime())) return false;
            const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
            const y = dateObj.getFullYear();
            return `${m}-${y}` === currentLogFilter.month;
        });
    } else {
        // Fetch from Firestore on-demand for older months
        feed.innerHTML = `
            <div class="diary-page empty">
                <p class="text-center text-gray-500">
                    <i class="fas fa-spinner fa-spin mr-2"></i>
                    Reading the archives for ${currentLogFilter.month}...
                </p>
            </div>`;
        try {
            const { fetchAdventureLogsForMonth } = await import('../../db/queries.js');
            logsForClass = await fetchAdventureLogsForMonth(currentLogFilter.classId, year, month);
        } catch (error) {
            console.error("Historical log fetch failed:", error);
        }
    }

    if (logsForClass.length === 0) {
        const selectedMonthDisplay = document.getElementById('adventure-log-month-filter').options[document.getElementById('adventure-log-month-filter').selectedIndex]?.text;
        feed.innerHTML = `<div class="diary-page empty"><p class="text-center text-gray-500">The diary is empty for ${selectedMonthDisplay}.<br>Award some stars and then 'Log Today's Adventure'!</p></div>`;
        return;
    }

    // Sort descending by date
    logsForClass.sort((a, b) => utils.parseFlexibleDate(b.date) - utils.parseFlexibleDate(a.date));

    // Track if this is a re-render (to skip animations)
    const existingEntries = feed.querySelectorAll('.diary-page');
    const isReRender = existingEntries.length > 0;
    const existingLogIds = isReRender ? Array.from(existingEntries).map(el => el.dataset.logId) : [];

    feed.innerHTML = logsForClass.map(log => {
        const dateObj = utils.parseFlexibleDate(log.date);
        const displayDate = dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' }) : log.date;
        const title = log.title || 'Daily Chronicle';
        const heroLabel = log.hero || 'The Class Team';
        const keywordsHtml = (log.keywords || []).map(kw => `<span class="diary-keyword">#${kw}</span>`).join('');
        const highlightsHtml = (log.highlights || []).slice(0, 4).map(h => `<span class="diary-highlight-chip">${h}</span>`).join('');

        const noteHtml = log.note ? `
            <div class="diary-note">
                <p>"${log.note}"</p>
                <span class="diary-note-author">- Note by ${log.noteBy || 'the Teacher'}</span>
            </div>
        ` : '';

        // Only animate if this is a new entry (not already in DOM)
        const isNewEntry = !isReRender || !existingLogIds.includes(log.id);
        const animationClass = isNewEntry ? 'diary-page pop-in-start' : 'diary-page';

        return `
            <div class="${animationClass}" data-log-id="${log.id}">
                <div class="diary-header">
                    <div>
                        <h3 class="diary-date">${displayDate}</h3>
                        <p class="diary-title">${title}</p>
                    </div>
                    <div class="diary-hero bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md">
                        <i class="fas fa-crown mr-1"></i> 
                        <span class="uppercase tracking-tighter text-[10px] opacity-90 mr-1">Hero:</span>
                        ${heroLabel}
                    </div>
                </div>
                <div class="diary-body">
                    <div class="diary-image-container">
                        <img src="${log.imageUrl || log.imageBase64 || ''}" alt="Image for ${(log.keywords || []).join(', ')}" class="diary-image">
                    </div>
                    <div class="diary-text-content">
                        <p class="diary-text">${log.text}</p>
                        ${highlightsHtml ? `<div class="diary-highlights">${highlightsHtml}</div>` : ''}
                        ${noteHtml}
                    </div>
                </div>
                <div class="diary-footer">
                    <div class="diary-keywords">
                        ${keywordsHtml}
                    </div>
                    <div class="flex gap-2">
                        <button class="log-note-btn bubbly-button bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center" data-log-id="${log.id}" title="${log.note ? 'Edit Note' : 'Add Note'}"><i class="fas fa-pencil-alt"></i></button>
                        <button class="log-delete-btn bubbly-button bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center" data-log-id="${log.id}" title="Delete Log Entry"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            </div>`;
    }).join('');

    // Only animate NEW pages
    const pages = feed.querySelectorAll('.diary-page.pop-in-start');
    pages.forEach((page, index) => {
        setTimeout(() => {
            page.classList.remove('pop-in-start');
        }, 50 + (index * 80));
    });
}

// --- GLOBAL UI SYNC FUNCTIONS ---
export function updateAllClassSelectors(isManual) {
    state.set('isProgrammaticSelection', true);
    const classId = state.get('globalSelectedClassId');

    const awardBtn = document.getElementById('award-class-dropdown-btn');
    if (awardBtn) {
        const allSchoolClasses = state.get('allSchoolClasses');
        const selectedClass = allSchoolClasses.find(c => c.id === classId);
        if (selectedClass) {
            document.getElementById('selected-class-logo').innerText = selectedClass.logo;
            document.getElementById('selected-class-name').innerText = selectedClass.name;
            document.getElementById('selected-class-level').innerText = selectedClass.questLevel;
            awardBtn.dataset.selectedId = classId;
            if (document.querySelector('.app-tab:not(.hidden)')?.id === 'award-stars-tab') {
                renderAwardStarsStudentList(classId);
            }
        } else {
            document.getElementById('selected-class-logo').innerText = '❓';
            document.getElementById('selected-class-name').innerText = 'Select a class...';
            document.getElementById('selected-class-level').innerText = '';
            awardBtn.dataset.selectedId = '';
            if (document.querySelector('.app-tab:not(.hidden)')?.id === 'award-stars-tab') {
                renderAwardStarsStudentList(null);
            }
        }
    }

    const selectors = ['gemini-class-select', 'oracle-class-select', 'story-weavers-class-select', 'adventure-log-class-select', 'scroll-class-select'];
    selectors.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.value = classId || '';
        }
    });
    state.set('isProgrammaticSelection', false);
}

export function updateAllLeagueSelectors() {
    state.set('isProgrammaticSelection', true);
    const league = state.get('globalSelectedLeague');
    const leagueButtons = ['leaderboard-league-picker-btn', 'student-leaderboard-league-picker-btn'];
    leagueButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.innerText = league || 'Select a League';
        }
    });
    state.set('isProgrammaticSelection', false);
}
