// /ui/modals.js

// --- IMPORTS ---
import { fetchLogsForDate, fetchAttendanceForMonth, fetchLogsForMonth } from '../db/queries.js';
import { db } from '../firebase.js';
import { doc, getDocs, collection, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// State and Constants
import * as state from '../state.js';
import { fetchMonthlyHistory } from '../state.js';
import * as constants from '../constants.js';
import * as utils from '../utils.js';
import { HERO_CLASSES } from '../features/heroClasses.js';

// Actions and Effects
import { playSound } from '../audio.js';
import { callGeminiApi } from '../api.js';
import { showToast, showPraiseToast } from './effects.js';
import {
    deleteClass,
    deleteStudent,
    handleEditClass,
    handleDeleteQuestEvent,
    handleCancelLesson,
    handleAddOneTimeLesson,
    handleDeleteAwardLog,
    saveAwardNote,
    saveAdventureLogNote,
    deleteAdventureLog,
    handleDeleteTrial,
    handleMoveStudent,
    handleMarkAbsent,
    handleAwardBonusStar,
    handleBatchAwardBonus, // NEW IMPORT
    addOrUpdateHeroChronicleNote,
    handleRemoveAttendanceColumn,
    deleteHeroChronicleNote, ensureHistoryLoaded
} from '../db/actions.js';

// Helper function to populate date dropdowns
function populateDateDropdowns(monthSelectId, daySelectId, dateString) { // dateString is YYYY-MM-DD
    const monthSelect = document.getElementById(monthSelectId);
    const daySelect = document.getElementById(daySelectId);

    // Populate months
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthSelect.innerHTML = '<option value="">-- Month --</option>' + months.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');

    // Populate days
    daySelect.innerHTML = '<option value="">-- Day --</option>' + Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
    
    // Set selected values if dateString exists
    if (dateString && dateString.includes('-')) {
        const parts = dateString.split('-');
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        monthSelect.value = month;
        daySelect.value = day;
    }
}

// --- LOCAL STATE FOR MODALS ---
let heroStatsChart = null;
let currentlySelectedDayCell = null;

// --- GENERIC MODAL FUNCTIONS ---

export function showAnimatedModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const innerContent = modal.querySelector('.pop-in');

    modal.classList.remove('hidden');
    if (innerContent) {
        innerContent.classList.add('modal-origin-start'); 
        innerContent.classList.remove('pop-out'); 
    }

    requestAnimationFrame(() => {
        if (innerContent) {
            innerContent.classList.remove('modal-origin-start');
        }
    });
}


export function showModal(title, message, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel') {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = message;
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    confirmBtn.innerText = confirmText;
    cancelBtn.innerText = cancelText;

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener('click', () => {
        playSound('click');
        if (onConfirm) onConfirm();
        hideModal('confirmation-modal');
    });
    showAnimatedModal('confirmation-modal');
}

export function hideModal(modalId) {
    if (modalId === 'quest-update-modal' || modalId === 'storybook-viewer-modal') {
        const audio = modalId === 'quest-update-modal' ? state.get('currentNarrativeAudio') : state.get('currentStorybookAudio');
        const btn = modalId === 'quest-update-modal' ? document.getElementById('play-narrative-btn') : document.getElementById('storybook-viewer-play-btn');
        if (audio && !audio.paused) {
            audio.pause();
            if(btn) btn.innerHTML = `<i class="fas fa-play-circle mr-2"></i> ${btn.textContent.includes('Narrate') ? 'Narrate Story' : 'Play Narrative'}`;
        }
        if (modalId === 'quest-update-modal') state.set('currentNarrativeAudio', null);
        else state.set('currentStorybookAudio', null);
    }

    if (modalId === 'hero-stats-modal' && heroStatsChart) {
        heroStatsChart.destroy();
        heroStatsChart = null;
    }

    const modal = document.getElementById(modalId);
    if (!modal || modal.classList.contains('hidden')) return;

    const innerContent = modal.querySelector('.pop-in');

    if (innerContent) {
        innerContent.classList.add('pop-out');
    }

    setTimeout(() => {
        modal.classList.add('hidden');
        if (innerContent) {
            innerContent.classList.remove('pop-out');
        }
    }, 200); 

    if (currentlySelectedDayCell) {
        currentlySelectedDayCell.classList.remove('day-selected');
        currentlySelectedDayCell = null;
    }
}


// --- PICKER MODALS ---

export function showLeaguePicker() {
    const list = document.getElementById('league-picker-list');
    list.innerHTML = constants.questLeagues.map(league => `<button class="league-select-btn w-full p-4 font-title text-xl text-amber-800 bg-amber-100 rounded-xl shadow border-2 border-amber-200 transition hover:bg-amber-200 hover:shadow-md bubbly-button" data-league="${league}">${league}</button>`).join('');
    list.querySelectorAll('.league-select-btn').forEach(btn => btn.addEventListener('click', () => {
        playSound('click');
        state.setGlobalSelectedLeague(btn.dataset.league, true);
        hideModal('league-picker-modal');
    }));
    showAnimatedModal('league-picker-modal');
}

export function showLogoPicker(target) {
    const list = document.getElementById('logo-picker-list');
    list.innerHTML = constants.classLogos.map(logo => `<button class="logo-select-btn p-2 rounded-lg transition hover:bg-gray-200 bubbly-button" data-logo="${logo}">${logo}</button>`).join('');
    list.querySelectorAll('.logo-select-btn').forEach(btn => btn.addEventListener('click', () => {
        playSound('click');
        const logo = btn.dataset.logo;
        if (target === 'create') {
            document.getElementById('class-logo').value = logo;
            document.getElementById('logo-picker-btn').innerText = logo;
        } else if (target === 'edit') {
            document.getElementById('edit-class-logo').value = logo;
            document.getElementById('edit-logo-picker-btn').innerText = logo;
        }
        hideModal('logo-picker-modal');
    }));
    showAnimatedModal('logo-picker-modal');
}


// --- MAIN FEATURE MODALS ---

export function openDayPlannerModal(dateString, dayCell) {
    if (currentlySelectedDayCell) {
        currentlySelectedDayCell.classList.remove('day-selected');
    }
    currentlySelectedDayCell = dayCell;
    dayCell.classList.add('day-selected');

    const modal = document.getElementById('day-planner-modal');
    const displayDate = utils.parseDDMMYYYY(dateString).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
    document.getElementById('day-planner-title').innerText = `Planner for ${displayDate}`;
    modal.dataset.date = dateString;
    
    // 1. Reset the form FIRST to clear old inputs
    document.getElementById('quest-event-form').reset();
    
    // 2. SET the date AFTER reset so it sticks
    document.getElementById('quest-event-date').value = dateString;

    renderScheduleManagerList(dateString);
    renderQuestEventDetails(); // Clear/Reset details area
    
    switchDayPlannerTab('schedule');
    showAnimatedModal('day-planner-modal');
}

export function switchDayPlannerTab(tabName) {
    document.querySelectorAll('.day-planner-tab-btn').forEach(btn => {
        const isSelected = btn.dataset.tab === tabName;
        btn.classList.toggle('border-blue-500', isSelected && tabName === 'schedule');
        btn.classList.toggle('text-blue-600', isSelected && tabName === 'schedule');
        btn.classList.toggle('border-purple-500', isSelected && tabName === 'event');
        btn.classList.toggle('text-purple-600', isSelected && tabName === 'event');
        btn.classList.toggle('border-transparent', !isSelected);
        btn.classList.toggle('text-gray-500', !isSelected);
    });
    document.querySelectorAll('.day-planner-tab-content').forEach(content => content.classList.add('hidden'));
    document.getElementById(`day-planner-${tabName}-content`).classList.remove('hidden');
}

function renderScheduleManagerList(dateString) {
    const listEl = document.getElementById('schedule-manager-list');
    const selectEl = document.getElementById('add-onetime-lesson-select');
    
    const classesOnDay = utils.getClassesOnDay(
        dateString,
        state.get('allSchoolClasses'),
        state.get('allScheduleOverrides')
    );
    const allTeacherClassIds = state.get('allTeachersClasses').map(c => c.id);

    if (classesOnDay.length === 0) {
        listEl.innerHTML = `<p class="text-center text-gray-500">No lessons scheduled for this day.</p>`;
    } else {
        listEl.innerHTML = classesOnDay.map(c => {
            const cancelButton = allTeacherClassIds.includes(c.id)
                ? `<button class="cancel-lesson-btn bg-red-100 text-red-700 font-bold py-1 px-3 rounded-full bubbly-button" data-class-id="${c.id}">Cancel</button>`
                : `<span class="text-xs text-gray-400">By ${c.createdBy.name}</span>`;
            return `<div class="flex items-center justify-between bg-gray-50 p-2 rounded-lg"><span>${c.logo} ${c.name}</span>${cancelButton}</div>`;
        }).join('');
    }

    const scheduledIds = classesOnDay.map(c => c.id);
    const availableToAdd = state.get('allTeachersClasses').filter(c => !scheduledIds.includes(c.id));
    selectEl.innerHTML = availableToAdd.map(c => `<option value="${c.id}">${c.logo} ${c.name}</option>`).join('');
    document.getElementById('add-onetime-lesson-btn').disabled = availableToAdd.length === 0;

    listEl.querySelectorAll('.cancel-lesson-btn').forEach(btn => {
        btn.onclick = () => handleCancelLesson(dateString, btn.dataset.classId, renderScheduleManagerList);
    });
}

export function renderQuestEventDetails() {
    const type = document.getElementById('quest-event-type').value;
    const container = document.getElementById('quest-event-details-container');
    let html = '';

    const completionBonusField = `
        <div>
            <label for="quest-completion-bonus" class="block text-sm font-medium text-gray-700">Completion Bonus (Stars per student)</label>
            <input type="number" id="quest-completion-bonus" value="1" min="0.5" step="0.5" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" required>
        </div>
    `;

    const goalTargetField = (label) => `
        <div>
            <label for="quest-goal-target" class="block text-sm font-medium text-gray-700">${label}</label>
            <input type="number" id="quest-goal-target" value="10" min="1" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" required>
        </div>
    `;

    switch(type) {
        case 'Vocabulary Vault':
        case 'Grammar Guardians':
            html = goalTargetField('Goal Target (# of Uses/Sentences)') + completionBonusField;
            break;
        case 'The Unbroken Chain':
        case 'The Scribe\'s Sketch':
        case 'Five-Sentence Saga':
            html = completionBonusField;
            break;
        case 'Reason Bonus Day':
            html = `<div>
                        <label for="quest-event-reason" class="block text-sm font-medium text-gray-700">Bonus Reason</label>
                        <select id="quest-event-reason" class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" required>
                            <option value="teamwork">Teamwork</option>
                            <option value="creativity">Creativity</option>
                            <option value="respect">Respect</option>
                            <option value="focus">Focus/Effort</option>
                        </select>
                     </div>`;
            break;
        default:
            html = '';
            break;
    }
    container.innerHTML = html;
}

export function openEditClassModal(classId) {
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;
    document.getElementById('edit-class-id').value = classId;
    document.getElementById('edit-class-name').value = classData.name;
    document.getElementById('edit-class-logo').value = classData.logo || '📚';
    document.getElementById('edit-logo-picker-btn').innerText = classData.logo || '📚';
    document.getElementById('edit-class-time-start').value = classData.timeStart || '';
    document.getElementById('edit-class-time-end').value = classData.timeEnd || '';
    const levelSelect = document.getElementById('edit-class-level');
    levelSelect.innerHTML = constants.questLeagues.map(l => `<option value="${l}" ${l === classData.questLevel ? 'selected' : ''}>${l}</option>`).join('');
    const daysContainer = document.getElementById('edit-schedule-days');
    const days = [{ v: "1", l: "Mon" }, { v: "2", l: "Tue" }, { v: "3", l: "Wed" }, { v: "4", l: "Thu" }, { v: "5", l: "Fri" }, { v: "6", l: "Sat" }, { v: "0", l: "Sun" }];
    daysContainer.innerHTML = days.map(d => `<label class="flex items-center space-x-2 bg-gray-50 px-3 py-1 rounded-full"><input type="checkbox" name="edit-schedule-day" value="${d.v}" ${(classData.scheduleDays || []).includes(d.v) ? 'checked' : ''}><span>${d.l}</span></label>`).join('');
    showAnimatedModal('edit-class-modal');
}

export async function showLogbookModal(dateString, isOndemand = false) {
    const titleEl = document.getElementById('logbook-modal-title');
    const contentEl = document.getElementById('logbook-modal-content');
    const displayDate = utils.parseDDMMYYYY(dateString);
    titleEl.innerText = `Log for ${displayDate.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' })}`;

    let logs;

    if (isOndemand) {
        contentEl.innerHTML = '<p class="text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Fetching historical log...</p>';
        // Use the helper to show the modal with animation
        showAnimatedModal('logbook-modal'); 
        logs = await fetchLogsForDate(dateString);
    } else {
        // --- THE FIX: SIMPLIFIED FILTER ---
        // Old way: utils.getDDMMYYYY(utils.parseDDMMYYYY(log.date)) === dateString
        // New way: direct string comparison. Much faster and less error-prone.
        // FIX: Robust Date Comparison
    // 1. Create a standardized timestamp for the day selected on the calendar
    const targetTime = utils.parseDDMMYYYY(dateString).setHours(0, 0, 0, 0);

    // 2. Filter logs by comparing their parsed time, not just the text string
    logs = state.get('allAwardLogs').filter(log => {
        // Exact match (Fastest)
        if (log.date === dateString) return true;
        
        // Parsing match (Handles YYYY-MM-DD, MM/DD/YYYY, etc.)
        if (log.date) {
            const logTime = utils.parseDDMMYYYY(log.date).setHours(0, 0, 0, 0);
            return logTime === targetTime;
        }
        return false;
    });
    }
    
    const reasonColors = { teamwork: 'text-purple-600', creativity: 'text-pink-600', respect: 'text-green-600', focus: 'text-yellow-600', correction: 'text-gray-500', welcome_back: 'text-cyan-600', story_weaver: 'text-cyan-600', scholar_s_bonus: 'text-amber-700' };

    if (logs.length === 0) {
        contentEl.innerHTML = '<p class="text-gray-600 text-center py-8">No stars were awarded in the school on this day.</p>';
    } else {
        const teacherNameMap = state.get('allSchoolClasses').reduce((acc, c) => {
            if (c.createdBy?.uid && c.createdBy?.name) {
                acc[c.createdBy.uid] = c.createdBy.name;
            }
            return acc;
        }, {});
        teacherNameMap[state.get('currentUserId')] = state.get('currentTeacherName');

        const totalStars = logs.reduce((sum, log) => sum + log.stars, 0);
        const reasonCounts = logs.reduce((acc, log) => { if(log.reason) acc[log.reason] = (acc[log.reason] || 0) + log.stars; return acc; }, {});
        const topReason = Object.keys(reasonCounts).length > 0 ? Object.entries(reasonCounts).sort((a,b) => b[1] - a[1])[0][0] : 'N/A';
        const classStarCounts = logs.reduce((acc, log) => { acc[log.classId] = (acc[log.classId] || 0) + log.stars; return acc; }, {});

        const topClassEntry = Object.entries(classStarCounts).sort((a,b) => b[1] - a[1])[0];
        const topClassId = topClassEntry ? topClassEntry[0] : null;
        const topClass = topClassId ? state.get('allSchoolClasses').find(c => c.id === topClassId) : null;
        
        let summaryHtml = `<div class="grid grid-cols-3 gap-4 text-center mb-6 p-4 bg-gray-50 rounded-2xl border">
            <div><div class="text-sm text-gray-500">Total Stars</div><div class="font-title text-3xl text-amber-600 flex items-center justify-center gap-2">${totalStars} <i class="fas fa-star"></i></div></div>
            <div><div class="text-sm text-gray-500">Top Skill</div><div class="font-title text-3xl ${reasonColors[topReason] || 'text-purple-600'} capitalize">${topReason.replace(/_/g, ' ')}</div></div>
            <div><div class="text-sm text-gray-500">Top Class</div><div class="font-title text-xl text-green-600 truncate">${topClass ? `${topClass.logo} ${topClass.name}` : 'N/A'}</div></div>
        </div>`;

        const groupedByClass = logs.reduce((acc, log)=> { (acc[log.classId] = acc[log.classId] || []).push(log); return acc; }, {});
        
        let detailsHtml = '';
        for (const classId in groupedByClass) {
            const classInfo = state.get('allSchoolClasses').find(c => c.id === classId);
            if (!classInfo) continue;
            detailsHtml += `<div class="mb-4 bg-white p-4 rounded-xl shadow-md border"><h3 class="font-title text-xl text-gray-800 border-b pb-2 mb-2 flex justify-between items-center"><span>${classInfo.logo} ${classInfo.name}</span> <span class="text-amber-500 font-sans font-bold text-lg">${classStarCounts[classId]} ⭐</span></h3><div class="space-y-2 mt-2">`;
            
            groupedByClass[classId].sort((a, b) => {
            const nameA = state.get('allStudents').find(s => s.id === a.studentId)?.name || 'Z';
            const nameB = state.get('allStudents').find(s => s.id === b.studentId)?.name || 'Z';
            return nameA.localeCompare(nameB);
        }).forEach(log => {
            const student = state.get('allStudents').find(s => s.id === log.studentId);
            
            // --- ADDED: Check if this student was the Hero of THIS specific day ---
            const dayAdventureLog = state.get('allAdventureLogs').find(l => l.classId === log.classId && l.date === dateString);
            const isDayHero = dayAdventureLog && dayAdventureLog.hero === student?.name;
            // ---------------------------------------------------------------------

            const teacherName = log.createdBy?.name || teacherNameMap[log.teacherId] || 'a teacher';
            const colorClass = reasonColors[log.reason] || 'text-gray-500';
            const noteHtml = log.note ? `<p class="text-xs text-gray-600 italic pl-4 border-l-2 border-gray-300 ml-1 mt-1">"${log.note}"</p>` : '';
            
            detailsHtml += `<div class="bg-gray-50 p-3 rounded-lg min-h-[50px] flex flex-col justify-center" id="log-entry-${log.id}">
                        <div class="flex justify-between items-center">
                            <div class="flex-grow">
                                <!-- UPDATED: Added Crown and Color for historical heroes -->
                                <span class="font-semibold ${isDayHero ? 'text-indigo-700' : ''}">
                                    ${isDayHero ? '<i class="fas fa-crown text-amber-500 mr-1"></i>' : ''}${student?.name || '?'}
                                </span>
                                <span class="text-sm text-gray-500"> - for <b class="${colorClass} capitalize">${(log.reason || '').replace(/_/g, ' ')}</b> from ${teacherName}</span>
                            </div>
                            <div class="flex items-center flex-shrink-0">
                                <span class="font-title text-lg text-amber-600">${log.stars} ⭐</span>
                                ${log.teacherId === state.get('currentUserId') ? `<button class="note-log-btn" data-log-id="${log.id}" title="${log.note ? 'Edit Note' : 'Add Note'}"><i class="fas fa-pencil-alt"></i></button>` : ''}
                                ${log.teacherId === state.get('currentUserId') && log.reason !== 'story_weaver' && log.reason !== 'scholar_s_bonus' ? `<button class="delete-log-btn ml-2" data-log-id="${log.id}" data-student-id="${log.studentId}" data-stars="${log.stars}" title="Delete this log entry">&times;</button>` : ''}
                            </div>
                        </div>
                        ${noteHtml}
                     </div>`;
        });
        }
        contentEl.innerHTML = summaryHtml + detailsHtml;
    }
    
    if (!isOndemand) {
        showAnimatedModal('logbook-modal');
    }
}

export function openHistoryModal(type) {
    const modal = document.getElementById('history-modal');
    modal.dataset.historyType = type;
    
    // Title
    const title = type === 'team' ? 'Team Quest History' : 'Hero\'s Challenge History';
    document.querySelector('#history-modal h2').innerText = title;

    const league = state.get('globalSelectedLeague');

    // Logic: If it's HERO history, we still need a specific context (League or Class).
    // If it's TEAM history, we show ALL leagues, so we don't need a selection.
    
    if (type === 'hero' && !league) {
        // Show League Picker for Hero Mode
        const contentEl = document.getElementById('history-modal-content');
        const selectEl = document.getElementById('history-month-select');
        selectEl.classList.add('hidden');
        
        contentEl.innerHTML = `<h3 class="text-center font-semibold text-gray-700 mb-4">Select a league to view Hero History:</h3>` +
            `<div class="grid grid-cols-2 gap-4">` +
            constants.questLeagues.map(l => `<button class="league-select-btn w-full p-4 font-title text-xl text-amber-800 bg-amber-100 rounded-xl shadow border-2 border-amber-200 transition hover:bg-amber-200 hover:shadow-md bubbly-button" data-league="${l}">${l}</button>`).join('') +
            `</div>`;
        
        contentEl.querySelectorAll('.league-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                playSound('click');
                state.setGlobalSelectedLeague(btn.dataset.league, false);
                selectEl.classList.remove('hidden');
                populateHistoryMonthSelector();
                renderHistoricalLeaderboard("", type);
            });
        });

    } else {
        // Team Mode OR Hero Mode with league selected
        
        // FIX: If it is Hero mode, go straight to the Hero modal logic and SKIP the Team modal
        if (type === 'hero') {
            renderHistoricalLeaderboard("", type);
            return; // STOP here so we don't open the 'history-modal'
        }

        // Team Mode -> Show normal view
        document.getElementById('history-month-select').classList.remove('hidden');
        populateHistoryMonthSelector();
        renderHistoricalLeaderboard("", type);
        showAnimatedModal('history-modal'); // Only show this for Team history
    }
}

function populateHistoryMonthSelector() {
    const select = document.getElementById('history-month-select');
    select.innerHTML = '<option value="">--Choose a month--</option>';

    const now = new Date();
    let loopDate = new Date(constants.competitionStart);

    while (loopDate < now) {
        if (loopDate.getFullYear() < now.getFullYear() || (loopDate.getFullYear() === now.getFullYear() && loopDate.getMonth() < now.getMonth())) {const monthKey = loopDate.toISOString().substring(0, 7);
            const displayString = loopDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
            select.innerHTML += `<option value="${monthKey}">${displayString}</option>`;
        }
        loopDate.setMonth(loopDate.getMonth() + 1);
    }
}

// --- TEAM QUEST & HERO ARCHIVE ---
// ui/modals.js

export async function renderHistoricalLeaderboard(monthKey, type, scope = 'class') {
    // 1. Handle Hero History Redirect
    if (type === 'hero') {
        const modalTitle = document.querySelector('#history-modal h2');
        if(modalTitle) modalTitle.style.display = 'block';
        const outerSelect = document.querySelector('#history-month-select')?.parentElement;
        if(outerSelect) outerSelect.style.display = 'block';
        
        import('./modals.js').then(m => m.openStudentRankingsModal()); 
        return;
    }

    // 2. DOM Manipulation: Hide redundant elements
    const modalTitle = document.querySelector('#history-modal h2');
    if(modalTitle) modalTitle.style.display = 'none'; 
    
    const originalSelect = document.getElementById('history-month-select');
    if (originalSelect && originalSelect.parentElement) {
        originalSelect.parentElement.style.display = 'none';
    }

    const contentEl = document.getElementById('history-modal-content');
    
    // 3. Prepare Dropdown Options
    const options = Array.from(originalSelect.options).map(opt => {
        const isSelected = opt.value === monthKey ? 'selected' : '';
        return `<option value="${opt.value}" ${isSelected} class="text-gray-800 py-1">${opt.text}</option>`;
    }).join('');

    // --- Banner Header ---
    const headerHtml = `
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 p-6 text-white shadow-xl mb-6 border-4 border-orange-400/50">
            <div class="absolute -right-6 -top-6 text-white/10 text-9xl transform rotate-12 pointer-events-none"><i class="fas fa-flag-checkered"></i></div>
            <div class="absolute left-10 bottom-0 text-white/10 text-8xl transform -rotate-12 pointer-events-none"><i class="fas fa-map"></i></div>
            <div class="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <div class="flex items-center gap-3 mb-1">
                        <div class="bg-white/20 p-2 rounded-lg backdrop-blur-sm"><i class="fas fa-flag-checkered text-2xl"></i></div>
                        <h3 class="font-title text-3xl text-shadow-sm tracking-wide">Team Quest Archive</h3>
                    </div>
                    <p class="text-orange-100 font-medium text-sm ml-1 opacity-90">Review past victories and league standings</p>
                </div>
                <div class="w-full md:w-auto">
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-orange-200"><i class="fas fa-calendar-alt"></i></div>
                        <select id="internal-history-select" 
                            class="appearance-none w-full md:w-64 bg-white/20 hover:bg-white/30 text-white font-bold py-3 pl-10 pr-10 rounded-xl backdrop-blur-md border border-white/40 shadow-inner focus:outline-none focus:ring-2 focus:ring-white/50 transition-all cursor-pointer placeholder-white">
                            ${options}
                        </select>
                        <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-orange-200"><i class="fas fa-chevron-down"></i></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 4. Handle Empty State
    if (!monthKey) {
        contentEl.innerHTML = headerHtml + `
            <div class="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-300">
                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4"><i class="fas fa-history text-4xl text-gray-300"></i></div>
                <p class="text-gray-500 font-bold text-lg">Time Machine Ready</p>
                <p class="text-gray-400 text-sm">Select a month above to travel back in time.</p>
            </div>`;
        document.getElementById('internal-history-select').addEventListener('change', (e) => renderHistoricalLeaderboard(e.target.value, 'team'));
        return;
    }

    // 5. Loading State
    contentEl.innerHTML = headerHtml + `
        <div class="flex flex-col items-center justify-center py-20">
            <i class="fas fa-circle-notch fa-spin text-5xl text-amber-500 mb-4"></i>
            <p class="text-gray-600 font-bold animate-pulse text-lg">Retrieving Quest Logs...</p>
        </div>`;
    
    document.getElementById('internal-history-select').addEventListener('change', (e) => renderHistoricalLeaderboard(e.target.value, 'team'));

    // --- MAIN RENDER LOGIC WITH SAFETY ---
    try {
        let monthlyScores = {}; 
        let questHistoryData = []; // NEW: Store the accurate history

        // A. Fetch Data
        try {
            const { fetchLogsForMonth } = await import('../db/queries.js');
            const { fetchMonthlyHistory } = await import('../state.js'); 
            const [year, month] = monthKey.split('-').map(Number);
            
            // 1. Fetch Star Logs (The raw numbers)
            const logsPromise = fetchLogsForMonth(year, month);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
            const logs = await Promise.race([logsPromise, timeoutPromise]).catch(e => []);
            
            if (!logs || logs.length === 0) {
                monthlyScores = await fetchMonthlyHistory(monthKey);
            } else {
                logs.forEach(log => {
                    monthlyScores[log.studentId] = (monthlyScores[log.studentId] || 0) + log.stars;
                });
            }

            // 2. NEW: Fetch Quest History (The "Truth" Snapshots)
            // This grabs the official record if a class finished the quest that month
            const historyQ = query(
                collection(db, "artifacts/great-class-quest/public/data/quest_history"),
                where("monthKey", "==", monthKey)
            );
            const historySnap = await getDocs(historyQ);
            questHistoryData = historySnap.docs.map(d => d.data());

        } catch (e) { 
            console.error("Fetch Error:", e); 
        }

        // B. Calculate & Render
        const [hYear, hMonth] = monthKey.split('-').map(Number);
        const daysInMonth = new Date(hYear, hMonth, 0).getDate();
        
        let globalHolidayDays = 0;
        const ranges = state.get('schoolHolidayRanges') || [];
        const monthStart = new Date(hYear, hMonth - 1, 1);
        const monthEnd = new Date(hYear, hMonth, 0);

        ranges.forEach(range => {
            const start = new Date(range.start);
            const end = new Date(range.end);
            const overlapStart = start > monthStart ? start : monthStart;
            const overlapEnd = end < monthEnd ? end : monthEnd;
            if (overlapStart <= overlapEnd) {
                const diffTime = Math.abs(overlapEnd - overlapStart);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                globalHolidayDays += diffDays;
            }
        });

        const overrides = state.get('allScheduleOverrides') || [];
        const allLeagues = (await import('../constants.js')).questLeagues;
        const allClasses = state.get('allSchoolClasses');
        const myClassIds = state.get('allTeachersClasses').map(c => c.id);
        const BASE_GOAL = 18;
        const SCALING_FACTOR = 1.5;

        let fullHtml = '';

        for (const league of allLeagues) {
            const classesInLeague = allClasses.filter(c => c.questLevel === league);
            if (classesInLeague.length === 0) continue;

            const leagueScores = classesInLeague.map(c => {
                // 1. Check for an Official History Record (The "Truth")
                const historyRecord = questHistoryData.find(h => h.classId === c.id);

                if (historyRecord) {
                    // USE ACCURATE SNAPSHOT
                    return {
                        ...c,
                        totalStars: historyRecord.starsEarned,
                        progress: 100, // They finished it!
                        diamondGoal: historyRecord.goalTarget,
                        daysLost: 0, // Not needed for history records
                        historicalLevel: historyRecord.levelReached - 1, // Display the level they were AT, not what they reached
                        isQuestComplete: true // Flag for UI
                    };
                }

                // 2. Fallback: Calculate from Logs (for classes that didn't finish)
                const rosterStudents = state.get('allStudents').filter(s => s.classId === c.id); 
                const studentIds = new Set(rosterStudents.map(s => s.id));
                const totalStars = Array.from(studentIds).reduce((sum, id) => sum + (monthlyScores[id] || 0), 0);
                
                const classCancellations = overrides.filter(o => {
                    if (o.classId !== c.id || o.type !== 'cancelled') return false;
                    const oDate = utils.parseDDMMYYYY(o.date); 
                    return oDate.getMonth() === (hMonth - 1) && oDate.getFullYear() === hYear;
                }).length;

                const totalDaysLost = globalHolidayDays + classCancellations;
                let monthModifier = (daysInMonth - totalDaysLost) / daysInMonth;
                if (hMonth === 6) monthModifier = 0.5; 
                else monthModifier = Math.max(0.6, Math.min(1.0, monthModifier));

                // Guess difficulty based on current state (fallback)
                let historicalDifficulty = c.difficultyLevel || 0;
                
                // Adjustment attempt for older logs
                if (c.questCompletedAt) {
                    try {
                        const completedDate = c.questCompletedAt.toDate ? c.questCompletedAt.toDate() : new Date(c.questCompletedAt);
                        completedDate.setHours(0,0,0,0);
                        if (completedDate >= monthStart) {
                            historicalDifficulty = Math.max(0, historicalDifficulty - 1);
                        }
                    } catch(err) {}
                }

                const adjustedGoalPerStudent = (BASE_GOAL + (historicalDifficulty * SCALING_FACTOR)) * monthModifier;
                const diamondGoal = Math.round(Math.max(18, rosterStudents.length * adjustedGoalPerStudent));
                const progress = diamondGoal > 0 ? (totalStars / diamondGoal) * 100 : 0;
                
                return { 
                    ...c, 
                    totalStars, 
                    progress, 
                    diamondGoal, 
                    daysLost: totalDaysLost, 
                    historicalLevel: historicalDifficulty,
                    isQuestComplete: false 
                };
            }).sort((a, b) => b.progress - a.progress);
            if (leagueScores.every(c => c.totalStars === 0)) continue; 

            fullHtml += `
                <div class="mb-8 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h4 class="font-title text-xl text-indigo-900 flex items-center gap-2">
                            <span class="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                            ${league} League
                        </h4>
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-widest bg-white px-2 py-1 rounded border border-gray-200">Historical Data</span>
                    </div>
                    <div class="p-4 space-y-3">
            `;

            leagueScores.forEach((c, index) => {
                const rank = index + 1;
                const isMine = myClassIds.includes(c.id);
                
                let rankBadge = `<div class="w-10 h-10 rounded-full bg-gray-100 text-gray-500 font-bold flex items-center justify-center text-lg shadow-inner border border-gray-200">${rank}</div>`;
                let rowBg = "bg-white hover:bg-gray-50";
                let borderClass = "border border-gray-200";
                
                if (rank === 1) { 
                    rankBadge = `<div class="w-12 h-12 text-4xl filter drop-shadow-md transform hover:scale-110 transition-transform">🥇</div>`; 
                    rowBg = "bg-gradient-to-r from-amber-50 to-white";
                    borderClass = "border border-amber-200 shadow-amber-100/50 shadow-md";
                }
                else if (rank === 2) { rankBadge = `<div class="w-10 h-10 text-3xl filter drop-shadow-sm">🥈</div>`; }
                else if (rank === 3) { rankBadge = `<div class="w-10 h-10 text-3xl filter drop-shadow-sm">🥉</div>`; }

                if (isMine) {
                    rowBg += " bg-indigo-50/30";
                    borderClass = "border-2 border-indigo-200 shadow-md ring-2 ring-indigo-50";
                }

                const highlightBadge = isMine ? `<span class="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider border border-indigo-200 ml-2">My Class</span>` : '';
                const lostBadge = c.daysLost > 0 ? `<span class="bg-red-50 text-red-500 text-[10px] px-2 py-0.5 rounded-full border border-red-100 font-bold ml-1" title="${c.daysLost} days lost (Holidays/Cancelled)">-${c.daysLost}d</span>` : '';
                const levelBadge = c.historicalLevel > 0 ? `<span class="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded-full border border-orange-200 font-bold ml-1">Lvl ${c.historicalLevel + 1}</span>` : '';
                const displayProgress = Math.min(100, c.progress);
                const barColor = rank === 1 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : (isMine ? 'bg-indigo-500' : 'bg-gray-400');

                fullHtml += `
                    <div class="relative rounded-2xl p-4 transition-all ${rowBg} ${borderClass} flex items-center gap-4 group">
                        <div class="flex-shrink-0 w-12 text-center">${rankBadge}</div>
                        <div class="flex-grow min-w-0">
                            <div class="flex items-center gap-2 mb-1.5">
                                <span class="text-2xl filter drop-shadow-sm">${c.logo}</span>
                                <h5 class="font-bold text-lg text-gray-800 truncate">${c.name}</h5>
                                ${highlightBadge} ${levelBadge}
                            </div>
                            <div class="w-full bg-gray-200/80 rounded-full h-3 overflow-hidden shadow-inner relative" title="${c.progress.toFixed(1)}%">
                                <div class="${barColor} h-full rounded-full transition-all duration-1000 relative" style="width: ${displayProgress}%">
                                    <div class="absolute inset-0 bg-white/20"></div>
                                </div>
                                <div class="absolute top-0 bottom-0 w-0.5 bg-white z-10 opacity-50" style="left: 100%"></div>
                            </div>
                            <div class="flex items-center gap-2 mt-2">
                                <span class="text-xs text-gray-500 font-medium bg-white px-2 py-0.5 rounded-md border border-gray-200 shadow-sm flex items-center">
                                    <i class="fas fa-bullseye text-gray-400 mr-1"></i> Goal: ${c.diamondGoal}
                                </span>
                                ${lostBadge}
                            </div>
                        </div>
                        <div class="text-right flex-shrink-0 pl-4 border-l border-gray-100/50">
                            <div class="font-title text-2xl text-amber-600 leading-none mb-1">${c.progress.toFixed(0)}%</div>
                            <div class="text-xs font-bold text-gray-400 uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded">${c.totalStars} ⭐</div>
                        </div>
                    </div>`;
            });
            fullHtml += `</div></div>`;
        }

        contentEl.innerHTML = headerHtml + (fullHtml || `<div class="p-8 text-center text-gray-500 bg-gray-50 rounded-2xl">No data available for this month.</div>`);
        
        // Re-bind listener after HTML update
        document.getElementById('internal-history-select').addEventListener('change', (e) => renderHistoricalLeaderboard(e.target.value, 'team'));

    } catch (error) {
        console.error("Render Error:", error);
        contentEl.innerHTML = headerHtml + `
            <div class="flex flex-col items-center justify-center py-16 text-center">
                <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                <p class="text-gray-700 font-bold">The Archives are dusty.</p>
                <p class="text-gray-500 text-sm mt-1">Error: ${error.message}</p>
                <p class="text-gray-400 text-xs mt-4">Try selecting a different month.</p>
            </div>`;
        // Re-bind listener even on error state
        const select = document.getElementById('internal-history-select');
        if(select) select.addEventListener('change', (e) => renderHistoricalLeaderboard(e.target.value, 'team'));
    }
}
    
// --- REVAMPED ATTENDANCE CHRONICLE MODAL ---

export async function openAttendanceChronicle() {
    const classId = document.getElementById('adventure-log-class-select').value;
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;

    // Reset view date to current month on open
    state.setAttendanceViewDate(new Date());

    document.getElementById('attendance-chronicle-title').innerHTML = `${classData.logo} Attendance Chronicle`;
    document.getElementById('attendance-chronicle-content').innerHTML = `<p class="text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading attendance records...</p>`;
    showAnimatedModal('attendance-chronicle-modal');

    await renderAttendanceChronicle(classId);
}

export async function renderAttendanceChronicle(classId) {
    const contentEl = document.getElementById('attendance-chronicle-content');
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);

    if (!classData || studentsInClass.length === 0) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">No students in this class to track attendance for.</p>`;
        return;
    }

    const viewDate = state.get('attendanceViewDate');
    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();
    const monthName = viewDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    // 1. Determine if we can go back/forward
    const competitionStart = constants.competitionStart;
    const canGoBack = new Date(currentYear, currentMonth, 1) > new Date(competitionStart.getFullYear(), competitionStart.getMonth(), 1);
    const canGoForward = new Date(currentYear, currentMonth + 1, 1) <= new Date();

    // 2. Fetch data if it's an old month not covered by real-time listener
    let attendanceRecords = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const viewMonthStart = new Date(currentYear, currentMonth, 1);
    
    if (viewMonthStart >= thirtyDaysAgo) {
        // Use real-time state
        attendanceRecords = state.get('allAttendanceRecords').filter(r => r.classId === classId);
    } else {
        // Fetch on demand
        contentEl.innerHTML = `<div class="text-center py-8 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Fetching historical data for ${monthName}...</div>`;
        attendanceRecords = await fetchAttendanceForMonth(classId, currentYear, currentMonth + 1);
    }

    // 3. Filter lesson dates for this specific month
    const scheduledDaysOfWeek = classData.scheduleDays || [];
    const lessonDates = [];
    
    // Generate all days in the month that match the schedule
    let loopDate = new Date(currentYear, currentMonth, 1);
    const overrides = state.get('allScheduleOverrides') || [];

    while (loopDate.getMonth() === currentMonth) {
        const dayOfWeek = loopDate.getDay().toString();
        const dateStr = utils.getDDMMYYYY(loopDate);
        
        // Check if this specific date has a "cancelled" override
        const isCancelled = overrides.some(o => 
            o.classId === classId && 
            o.date === dateStr && 
            o.type === 'cancelled'
        );

        if (scheduledDaysOfWeek.includes(dayOfWeek) && !isCancelled) {
            // Don't show future dates
            if (loopDate <= new Date()) {
                lessonDates.push(dateStr);
            }
        }
        loopDate.setDate(loopDate.getDate() + 1);
    }

    // Also include dates where attendance was actually taken (e.g. one-off lessons)
    attendanceRecords.forEach(r => {
        const rDate = utils.parseDDMMYYYY(r.date);
        if (rDate.getMonth() === currentMonth && rDate.getFullYear() === currentYear && !lessonDates.includes(r.date)) {
            lessonDates.push(r.date);
        }
    });

    lessonDates.sort((a,b) => utils.parseDDMMYYYY(a) - utils.parseDDMMYYYY(b));

    // 4. Build HTML
    let html = `
        <div class="flex items-center justify-between mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <button id="attendance-prev-btn" class="text-gray-600 hover:text-gray-800 font-bold py-1 px-3 rounded disabled:opacity-30" ${!canGoBack ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
            <span class="font-title text-xl text-gray-700">${monthName}</span>
            <button id="attendance-next-btn" class="text-gray-600 hover:text-gray-800 font-bold py-1 px-3 rounded disabled:opacity-30" ${!canGoForward ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
        </div>
    `;

    if(lessonDates.length === 0) {
        html += `<p class="text-center text-gray-500 py-8">No lessons recorded for this month.</p>`;
        contentEl.innerHTML = html;
    } else {
        const attendanceByStudent = attendanceRecords.reduce((acc, record) => {
            if (!acc[record.studentId]) acc[record.studentId] = new Set();
            acc[record.studentId].add(record.date);
            return acc;
        }, {});

        html += `<div class="overflow-x-auto rounded-lg border border-gray-200 shadow-sm"><table class="w-full border-collapse bg-white"><thead><tr class="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
            <th class="p-3 font-semibold text-left border-b sticky left-0 bg-gray-100 z-10 shadow-sm">Student</th>`;
        
        lessonDates.forEach(dateStr => {
            const d = utils.parseDDMMYYYY(dateStr);
            // MODIFIED: Added delete button to header
            html += `<th class="p-3 font-semibold text-center border-b min-w-[60px] align-top">
                <div class="attendance-header-container">
                    <span>${d.getDate()}</span>
                    <button class="delete-column-btn" data-date="${dateStr}" data-class-id="${classId}" title="Remove this day (Holiday/Cancelled)">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </th>`;
        });
        html += `</tr></thead><tbody>`;

        studentsInClass.forEach((student, index) => {
            const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
            html += `<tr class="${rowBg} hover:bg-gray-100 transition-colors">
                <td class="p-3 font-medium text-gray-800 border-r sticky left-0 ${rowBg} z-10">${student.name}</td>`;
            
            lessonDates.forEach(dateStr => {
                const isAbsent = attendanceByStudent[student.id]?.has(dateStr);
                const isEditable = viewMonthStart >= thirtyDaysAgo; 

                html += `<td class="p-3 text-center border-r border-gray-100">
                    <button class="attendance-status-btn w-6 h-6 rounded-full transition-transform transform hover:scale-110 focus:outline-none shadow-sm ${isAbsent ? 'status-absent bg-red-500' : 'status-present bg-green-500'}" 
                            data-student-id="${student.id}" 
                            data-date="${dateStr}" 
                            ${!isEditable ? 'disabled style="cursor: default; opacity: 0.7;"' : ''}
                            title="${isAbsent ? 'Absent' : 'Present'}">
                            ${isAbsent ? '<i class="fas fa-times text-white text-xs"></i>' : '<i class="fas fa-check text-white text-xs"></i>'}
                    </button>
                </td>`;
            });
            html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        
        const totalPossible = studentsInClass.length * lessonDates.length;
        let totalAbsences = 0;
        Object.values(attendanceByStudent).forEach(set => totalAbsences += set.size); 
        
        const attendanceRate = totalPossible > 0 ? ((totalPossible - totalAbsences) / totalPossible * 100).toFixed(1) : 100;

        html += `<div class="mt-4 text-right text-sm text-gray-500">
            Monthly Attendance Rate: <span class="font-bold ${attendanceRate > 90 ? 'text-green-600' : 'text-amber-600'}">${attendanceRate}%</span>
        </div>`;

        contentEl.innerHTML = html;
    }

    document.getElementById('attendance-prev-btn').addEventListener('click', () => changeAttendanceMonth(-1, classId));
    document.getElementById('attendance-next-btn').addEventListener('click', () => changeAttendanceMonth(1, classId));

    // Listener for toggling attendance status (Present/Absent)
    contentEl.querySelectorAll('.attendance-status-btn:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', (e) => toggleAttendanceRecord(e.currentTarget));
    });

    // NEW: Listeners for removing columns with Holiday option
    contentEl.querySelectorAll('.delete-column-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const dateStr = e.currentTarget.dataset.date;
            const cId = e.currentTarget.dataset.classId;
            
            // Inject a checkbox into the confirmation message
            const messageHtml = `
                <p class="mb-4">Mark <b>${dateStr}</b> as a "No Lesson" day?</p>
                <div class="bg-red-50 p-3 rounded-lg text-left border border-red-200">
                    <label class="flex items-center cursor-pointer">
                        <input type="checkbox" id="holiday-checkbox" class="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300">
                        <span class="ml-3 font-bold text-red-800">Is this a School Holiday?</span>
                    </label>
                    <p class="text-xs text-red-600 mt-1 ml-8">Checked: Removes this day for ALL classes.<br>Unchecked: Removes for THIS class only.</p>
                </div>
            `;

            showModal(
                'Remove Date?', 
                'placeholder', // We will replace this innerHTML immediately after
                () => {
                    // Check if the element exists before accessing checked property
                    const checkbox = document.getElementById('holiday-checkbox');
                    const isGlobal = checkbox ? checkbox.checked : false;
                    
                    // Dynamic import to avoid circular dependency issues if needed, or direct call
                    // We imported handleRemoveAttendanceColumn at the top of this file, so direct call is fine:
                    import('../db/actions.js').then(actions => {
                        actions.handleRemoveAttendanceColumn(cId, dateStr, isGlobal);
                    });
                },
                'Confirm Removal'
            );
            
            // Hack to inject HTML into the simple modal
            const msgEl = document.getElementById('modal-message');
            if(msgEl) msgEl.innerHTML = messageHtml;
        });
    });
}

async function changeAttendanceMonth(delta, classId) {
    const currentViewDate = state.get('attendanceViewDate');
    currentViewDate.setMonth(currentViewDate.getMonth() + delta);
    state.setAttendanceViewDate(currentViewDate);
    await renderAttendanceChronicle(classId);
}

async function toggleAttendanceRecord(button) {
    playSound('click');
    const { studentId, date } = button.dataset;
    const isCurrentlyAbsent = button.classList.contains('status-absent');
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    button.classList.toggle('status-absent', !isCurrentlyAbsent);
    button.classList.toggle('status-present', isCurrentlyAbsent);
    button.classList.toggle('bg-red-500', !isCurrentlyAbsent);
    button.classList.toggle('bg-green-500', isCurrentlyAbsent);
    button.innerHTML = !isCurrentlyAbsent ? '<i class="fas fa-times text-white text-xs"></i>' : '<i class="fas fa-check text-white text-xs"></i>';

    try {
        await handleMarkAbsent(studentId, student.classId, !isCurrentlyAbsent);
    } catch (error) {
        button.classList.toggle('status-absent', isCurrentlyAbsent);
        button.classList.toggle('status-present', !isCurrentlyAbsent);
        button.classList.toggle('bg-red-500', isCurrentlyAbsent);
        button.classList.toggle('bg-green-500', !isCurrentlyAbsent);
        button.innerHTML = isCurrentlyAbsent ? '<i class="fas fa-times text-white text-xs"></i>' : '<i class="fas fa-check text-white text-xs"></i>';
        showToast('Failed to update attendance.', 'error');
    }
}

export function openEditStudentModal(studentId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    document.getElementById('edit-student-id-input-full').value = studentId;
    document.getElementById('edit-student-name-input-full').value = student.name;
    
    // NEW: Use helper to populate dropdowns
    populateDateDropdowns('edit-student-birthday-month', 'edit-student-birthday-day', student.birthday);
    populateDateDropdowns('edit-student-nameday-month', 'edit-student-nameday-day', student.nameday);
    // Load Hero Class into dropdown
   // Load Hero Class and check if locked
    const classDropdown = document.getElementById('edit-student-hero-class');
    classDropdown.value = student.heroClass || "";
    
    if (student.isHeroClassLocked) {
        classDropdown.disabled = true;
        classDropdown.title = "This student has already used their one-time class change.";
    } else {
        classDropdown.disabled = false;
        classDropdown.title = "";
    }
    showAnimatedModal('edit-student-modal');
}

export async function openQuestAssignmentModal() {
    const classId = document.getElementById('adventure-log-class-select').value;
    if (!classId) return;

    const modal = document.getElementById('quest-assignment-modal');
    modal.dataset.editingId = '';
    document.getElementById('quest-assignment-confirm-btn').innerText = 'Save Assignment';

    document.getElementById('quest-assignment-class-id').value = classId;
    const previousAssignmentTextEl = document.getElementById('previous-assignment-text');
    const currentAssignmentTextarea = document.getElementById('quest-assignment-textarea');

    previousAssignmentTextEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    currentAssignmentTextarea.value = '';

    showAnimatedModal('quest-assignment-modal');

    try {
        const q = query(
            collection(db, `artifacts/great-class-quest/public/data/quest_assignments`),
            where("classId", "==", classId),
            where("createdBy.uid", "==", state.get('currentUserId')),
            orderBy("createdAt", "desc"),
            limit(1)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const lastAssignmentDoc = snapshot.docs[0];
            const lastAssignment = lastAssignmentDoc.data();

            // --- NEW: Test Badge Logic ---
            let testBadgeHtml = '';
            if (lastAssignment.testData) {
                const tDate = utils.parseFlexibleDate(lastAssignment.testData.date);
                const dateDisplay = tDate ? tDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Date TBD';
                
                testBadgeHtml = `
                    <div class="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                        <div class="bg-red-100 text-red-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                            <i class="fas fa-exclamation"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-red-800 text-sm uppercase tracking-wide">Test Scheduled</h4>
                            <p class="font-bold text-gray-800 text-lg leading-tight">${lastAssignment.testData.title}</p>
                            <p class="text-red-600 text-sm mt-1"><i class="fas fa-calendar-alt mr-1"></i> ${dateDisplay}</p>
                            ${lastAssignment.testData.curriculum ? `<p class="text-gray-500 text-xs mt-1">Topic: ${lastAssignment.testData.curriculum}</p>` : ''}
                        </div>
                    </div>`;
            }
            
            // --- SMART FORMATTER START ---
            const formatAssignmentText = (text) => {
                const lines = text.split('\n');
                let html = '';
                
                // Check if any line starts with a number pattern to decide if we use List Mode
                const hasList = lines.some(l => l.trim().match(/^(\d+)[\.\)]\s+/));
                
                if (!hasList) {
                    // Standard Text Mode (preserve line breaks)
                    return `<p class="text-gray-800 italic whitespace-pre-wrap">${text}</p>`;
                }

                // List Mode
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return;

                    // Match "1. " or "1) "
                    const match = trimmed.match(/^(\d+)[\.\)]\s+(.*)/);
                    
                    if (match) {
                        const [_, num, content] = match;
                        // Styled Card for List Item
                        html += `
                            <div class="flex items-start gap-3 mb-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm transition-transform hover:translate-x-1">
                                <span class="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-indigo-500 text-white text-xs font-bold rounded-full mt-0.5 shadow-sm">${num}</span>
                                <span class="text-gray-800 text-sm leading-relaxed">${content}</span>
                            </div>`;
                    } else {
                        // Regular text (headers, notes)
                        html += `<p class="text-gray-600 text-xs font-bold uppercase tracking-wider mb-2 mt-3 ml-1">${trimmed}</p>`;
                    }
                });
                return `<div class="space-y-1 mt-2">${html}</div>`;
            };
            
            const formattedContent = formatAssignmentText(lastAssignment.text);

           previousAssignmentTextEl.innerHTML = `
            <div class="w-full">
                ${testBadgeHtml} 
                ${formattedContent}
                </div>
                <div class="mt-3 flex justify-end">
                    <button id="edit-last-assignment-btn" class="text-xs text-blue-500 hover:text-blue-700 font-bold bg-blue-50 px-3 py-1 rounded-full transition-colors border border-blue-100">
                        <i class="fas fa-pencil-alt mr-1"></i>Edit
                    </button>
                </div>
            `;
            // --- SMART FORMATTER END ---

            document.getElementById('edit-last-assignment-btn').onclick = () => {
                currentAssignmentTextarea.value = lastAssignment.text;
                modal.dataset.editingId = lastAssignmentDoc.id;
                document.getElementById('quest-assignment-confirm-btn').innerText = 'Update Assignment';
                currentAssignmentTextarea.focus();
            };
        } else {
            previousAssignmentTextEl.textContent = "No previous assignment was set for this class.";
        }

    } catch (error) {
        console.error("Error loading previous assignment:", error);
        previousAssignmentTextEl.textContent = "Could not load the previous assignment.";
    }
}

export function openMoveStudentModal(studentId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;
    const currentClass = state.get('allSchoolClasses').find(c => c.id === student.classId);
    if (!currentClass) return;

    const modal = document.getElementById('move-student-modal');
    modal.dataset.studentId = studentId;

    document.getElementById('move-student-name').innerText = student.name;
    document.getElementById('move-student-current-class').innerText = `${currentClass.logo} ${currentClass.name}`;

    const targetClassSelect = document.getElementById('move-student-target-class');
    const possibleClasses = state.get('allSchoolClasses').filter(c => c.questLevel === currentClass.questLevel && c.id !== currentClass.id);

    if (possibleClasses.length === 0) {
        targetClassSelect.innerHTML = `<option value="">No other classes in this league.</option>`;
        document.getElementById('move-student-confirm-btn').disabled = true;
    } else {
        targetClassSelect.innerHTML = possibleClasses.map(c => `<option value="${c.id}">${c.logo} ${c.name} (by ${c.createdBy.name})</option>`).join('');
        document.getElementById('move-student-confirm-btn').disabled = false;
    }
    
    showAnimatedModal('move-student-modal');

}

// --- SINGLE STARFALL (Used for individual entry edit or correction) ---
export function showStarfallModal(studentId, studentName, bonusAmount, trialType) {
    playSound('magic_chime');

    // Toggle views
    document.getElementById('starfall-single-view').classList.remove('hidden');
    document.getElementById('starfall-batch-view').classList.add('hidden');

    document.getElementById('starfall-student-name').innerText = studentName;
    const confirmBtn = document.getElementById('starfall-confirm-btn');
    confirmBtn.innerText = `Yes, Bestow ${bonusAmount} Star! ✨`;

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        handleAwardBonusStar(studentId, bonusAmount, trialType); 
        hideModal('starfall-modal');
    });

    showAnimatedModal('starfall-modal');
}

// --- BATCH STARFALL (New Function) ---
export function showBatchStarfallModal(eligibleStudents) {
    playSound('magic_chime');

    // Toggle views
    document.getElementById('starfall-single-view').classList.add('hidden');
    document.getElementById('starfall-batch-view').classList.remove('hidden');

    const listEl = document.getElementById('starfall-batch-list');
    listEl.innerHTML = eligibleStudents.map(s => `
        <div class="flex justify-between items-center p-2 border-b border-white/20 last:border-0">
            <span class="font-semibold text-white">${s.name}</span>
            <span class="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">+${s.bonusAmount} ⭐</span>
        </div>
    `).join('');

    const confirmBtn = document.getElementById('starfall-confirm-btn');
    const totalStars = eligibleStudents.reduce((sum, s) => sum + s.bonusAmount, 0);
    confirmBtn.innerText = `Yes, Bestow Bonus Stars! ✨`;

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        handleBatchAwardBonus(eligibleStudents); 
        hideModal('starfall-modal');
    });

    showAnimatedModal('starfall-modal');
}

// --- AI & REPORTING MODALS ---

export async function handleGetQuestUpdate() {
    const narrativeContainer = document.getElementById('narrative-text-container');
    const playBtn = document.getElementById('play-narrative-btn');
    
    if (!state.get('globalSelectedLeague')) {
        showToast('Please select a league first!', 'error');
        return;
    }

    playBtn.classList.add('hidden');
    narrativeContainer.innerHTML = `<i class="fas fa-spinner fa-spin text-4xl text-purple-400"></i>`;
    showAnimatedModal('quest-update-modal');

    const GOAL_PER_STUDENT = { DIAMOND: 18 };
   const classesInLeague = state.get('allSchoolClasses').filter(c => c.questLevel === state.get('globalSelectedLeague'));
    
    // Correct Calculation Logic
    const classScores = classesInLeague.map(c => {
        const students = state.get('allStudents').filter(s => s.classId === c.id);
        const scores = state.get('allStudentScores') || [];
        const monthlyStars = students.reduce((sum, s) => {
            const scoreData = scores.find(sc => sc.id === s.id);
            return sum + (scoreData ? (scoreData.monthlyStars || 0) : 0);
        }, 0);

        const BASE_GOAL = 18; 
        const SCALING_FACTOR = 2.5; 
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        
        let holidayDaysLost = 0;
        (state.get('schoolHolidayRanges') || []).forEach(range => {
            const start = new Date(range.start);
            const end = new Date(range.end);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const overlapStart = start > monthStart ? start : monthStart;
            const overlapEnd = end < monthEnd ? end : monthEnd;
            if (overlapStart <= overlapEnd) {
                holidayDaysLost += (Math.ceil(Math.abs(overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1);
            }
        });

        let monthModifier = (daysInMonth - holidayDaysLost) / daysInMonth;
        monthModifier = now.getMonth() === 5 ? 0.5 : Math.max(0.6, Math.min(1.0, monthModifier));
        
        const adjustedGoalPerStudent = (BASE_GOAL + ((c.difficultyLevel || 0) * SCALING_FACTOR)) * monthModifier;
        const diamondGoal = Math.round(Math.max(18, students.length * adjustedGoalPerStudent));
        const progress = diamondGoal > 0 ? ((monthlyStars / diamondGoal) * 100).toFixed(1) : 0;
        
        return { name: c.name, totalStars: monthlyStars, progress };
    }).sort((a, b) => b.progress - a.progress);

    const topClasses = classScores.filter(c => c.totalStars > 0).slice(0, 3);

    if (topClasses.length < 2) {
        narrativeContainer.innerHTML = `<p class="text-xl text-center">Not enough Quest data yet! At least two classes need to earn stars for a rivalry to begin!</p>`;
        return;
    }

    const classDataString = topClasses.map(c => `'${c.name}' is at ${c.progress}% of their goal with ${c.totalStars} stars`).join('. ');
    const systemPrompt = "You are a fun, exciting quest announcer for a classroom game. Do not use markdown or asterisks. Your response must be only the narrative text. You will be given the names, progress percentage, and star counts of the top classes. Write a short, exciting, 2-sentence narrative about their race to the top. IMPORTANT: The class with the highest progress percentage is in the lead, NOT the class with the most stars. Make this distinction clear in your narrative.";
    const userPrompt = `The top classes are: ${classDataString}. The first class in this list is in the lead. Write the narrative.`;

    try {
        const narrative = await callGeminiApi(systemPrompt, userPrompt);
        narrativeContainer.innerHTML = `<p>${narrative}</p>`;
        narrativeContainer.dataset.text = narrative;
       
    } catch (error) {
        console.error("Quest Update Narrative Error:", error);
        narrativeContainer.innerHTML = `<p class="text-xl text-center text-red-500">The Quest Announcer is taking a break. Please try again in a moment!</p>`;
    }
}

export async function handleGenerateIdea() {
    const classId = document.getElementById('gemini-class-select').value;
    if (!classId) { showToast('Please select a class first.', 'error'); return; }
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) { showToast('Could not find selected class data.', 'error'); return; }
    const ageGroup = utils.getAgeGroupForLeague(classData.questLevel);

    const btn = document.getElementById('gemini-idea-btn'), output = document.getElementById('gemini-idea-output'), copyBtn = document.getElementById('copy-idea-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Thinking...';
    output.value = ''; copyBtn.disabled = true; copyBtn.classList.add('opacity-50');

    const systemPrompt = `You are the 'Quest Master,' a helpful AI assistant for a teacher's classroom competition. You are creative, fun, and concise. Do NOT use markdown or asterisks. You will be asked to generate a 'special lesson experience' reward idea. The teacher will provide an age group. Make the idea fun, educational, and achievable in a classroom setting, and ensure it is perfectly suited for the specified age group. Format the response with a title and a 2-3 sentence description.`;
    const userPrompt = `Generate a 'special lesson experience' reward idea for students in the ${ageGroup} age group.`;
    try {
        const idea = await callGeminiApi(systemPrompt, userPrompt);
        output.value = idea;
        copyBtn.disabled = false; copyBtn.classList.remove('opacity-50');
    } catch (error) { console.error('Gemini Idea Error:', error); output.value = 'Oops! The Quest Master is busy. Please try again in a moment.'; }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-lightbulb mr-2"></i> Generate New Idea'; }
}

export function copyToClipboard(elementId) {
    const textarea = document.getElementById(elementId);
    textarea.select();
    document.execCommand('copy');
    showToast('Copied to clipboard!', 'success');
}

export async function handleGetOracleInsight() {
    await ensureHistoryLoaded();
    const classId = document.getElementById('oracle-class-select').value;
    const question = document.getElementById('oracle-question-input').value.trim();
    if (!classId || !question) {
        showToast('Please select a class and ask a question.', 'error');
        return;
    }
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classData) return;

    const btn = document.getElementById('oracle-insight-btn');
    const output = document.getElementById('oracle-insight-output');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Consulting the Oracle...';
    output.value = '';

    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const oneMonthAgoStr = oneMonthAgo.toLocaleDateString('en-GB');

    const relevantLogs = state.get('allAwardLogs').filter(log => log.classId === classId && log.date >= oneMonthAgoStr).map(log => {
        const student = state.get('allStudents').find(s => s.id === log.studentId);
        const noteText = log.note ? ` (Note: ${log.note})` : '';
        return `On ${log.date}, ${student?.name || 'A student'} received ${log.stars} star(s) for ${log.reason}${noteText}.`;
    }).join('\n');
    
    const academicScores = state.get('allWrittenScores').filter(score => score.classId === classId && score.date >= oneMonthAgoStr).map(score => {
        const student = state.get('allStudents').find(s => s.id === score.studentId);
        const noteText = score.note ? ` (Note: ${score.note})` : '';
        return `On ${score.date}, ${student?.name || 'A student'} scored ${score.scoreNumeric || score.scoreQualitative} on a ${score.type}${noteText}.`;
    }).join('\n');
    
    const attendanceRecords = state.get('allAttendanceRecords').filter(rec => rec.classId === classId && rec.date >= oneMonthAgoStr);
    const absenceCount = attendanceRecords.length;
    const absentStudents = attendanceRecords.reduce((acc, rec) => {
        const student = state.get('allStudents').find(s => s.id === rec.studentId);
        if (student) acc.push(student.name);
        return acc;
    }, []);
    const attendanceSummary = absenceCount > 0 ? `There were ${absenceCount} absences recorded. Students absent include: ${[...new Set(absentStudents)].join(', ')}.` : 'Attendance has been perfect.';

    if (relevantLogs.length === 0 && academicScores.length === 0 && absenceCount === 0) {
        output.value = "The Oracle has no records for this class in the past month. Award some stars, log some trial scores, or mark attendance to gather insights!";
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-question-circle mr-2"></i> Ask the Oracle';
        return;
    }

    const systemPrompt = "You are 'The Oracle,' a wise and encouraging AI data analyst for a teacher. Your goal is to analyze raw award log data, academic scores, and attendance records, including any teacher notes, and answer the teacher's questions in plain English. Provide concise, actionable, and positive insights based ONLY on the data provided. If the data is insufficient, say so kindly. Format your response clearly in 2-3 sentences. Do not use markdown.";
    const userPrompt = `Here is the data for the class "${classData.name}" over the last 30 days:
- Behavioral Star Data:
${relevantLogs || 'None.'}
- Academic Score Data:
${academicScores || 'None.'}
- Attendance Data:
${attendanceSummary}

Based on ALL this data, please answer the teacher's question: "${question}"`;

    try {
        const insight = await callGeminiApi(systemPrompt, userPrompt);
        output.value = insight;
    } catch (error) {
        console.error("Oracle Insight Error:", error);
        output.value = 'The Oracle is pondering other mysteries right now. Please try again in a moment.';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-question-circle mr-2"></i> Ask the Oracle';
    }
}

export function openAwardNoteModal(logId) {
    const log = state.get('allAwardLogs').find(l => l.id === logId);
    if (!log) return;
    document.getElementById('award-note-log-id-input').value = logId;
    document.getElementById('award-note-textarea').value = log.note || '';
    showAnimatedModal('award-note-modal');
}

export function openNoteModal(logId) {
    const log = state.get('allAdventureLogs').find(l => l.id === logId);
    if (!log) return;
    document.getElementById('note-log-id-input').value = logId;
    document.getElementById('note-textarea').value = log.note || '';
    showAnimatedModal('note-modal');
}

export async function openMilestoneModal(markerElement) {
    await ensureHistoryLoaded();
    const questCard = markerElement.closest('.quest-card');
    const classId = questCard.dataset.classId;
    const classInfo = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classInfo) return;

    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    const studentCount = studentsInClass.length;
    
    // --- 1. SYNCED MATH LOGIC ---
    const BASE_GOAL = 18; 
    const SCALING_FACTOR = 2.5; 
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    let holidayDaysLost = 0;
    const ranges = state.get('schoolHolidayRanges') || [];
    ranges.forEach(range => {
        const start = new Date(range.start);
        const end = new Date(range.end);
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        const overlapStart = start > monthStart ? start : monthStart;
        const overlapEnd = end < monthEnd ? end : monthEnd;
        if (overlapStart <= overlapEnd) {
            holidayDaysLost += (Math.ceil(Math.abs(overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1);
        }
    });

    let monthModifier = (daysInMonth - holidayDaysLost) / daysInMonth;
    monthModifier = currentMonth === 5 ? 0.5 : Math.max(0.6, Math.min(1.0, monthModifier));

    let isCompletedThisMonth = false;
    if (classInfo.questCompletedAt) {
        const completedDate = classInfo.questCompletedAt.toDate();
        if (completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear) isCompletedThisMonth = true;
    }
    const dbDifficulty = classInfo.difficultyLevel || 0;
    const effectiveDifficulty = isCompletedThisMonth ? Math.max(0, dbDifficulty - 1) : dbDifficulty;
    const adjustedGoalPerStudent = (BASE_GOAL + (effectiveDifficulty * SCALING_FACTOR)) * monthModifier;

    const goals = {
        bronze: Math.round(studentCount * (adjustedGoalPerStudent * 0.25)),
        silver: Math.round(studentCount * (adjustedGoalPerStudent * 0.50)),
        gold: Math.round(studentCount * (adjustedGoalPerStudent * 0.75)),
        diamond: studentCount > 0 ? Math.round(studentCount * adjustedGoalPerStudent) : 18
    };

    // --- 2. ADVANCED DATA ANALYSIS ---
    const currentMonthlyStars = studentsInClass.reduce((sum, s) => {
        const scoreData = state.get('allStudentScores').find(score => score.id === s.id);
        return sum + (scoreData?.monthlyStars || 0);
    }, 0);

    const relevantLogs = state.get('allAwardLogs').filter(log => {
        if (log.classId !== classId) return false;
        const logDate = utils.parseDDMMYYYY(log.date); 
        return logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear;
    });

    // Weekly Momentum
    const todayDate = new Date();
    const startOfWeek = new Date(todayDate.setDate(todayDate.getDate() - todayDate.getDay() + (todayDate.getDay() === 0 ? -6 : 1)));
    startOfWeek.setHours(0, 0, 0, 0);
    const weeklyStars = relevantLogs.filter(log => utils.parseDDMMYYYY(log.date) >= startOfWeek).reduce((sum, log) => sum + log.stars, 0);

    // Trial Mastery (Class Average)
    const classTrials = state.get('allWrittenScores').filter(s => s.classId === classId && new Date(s.date).getMonth() === currentMonth);
    let totalScorePercent = 0, scoreCount = 0;
    classTrials.forEach(s => {
        if (s.scoreNumeric !== null) { totalScorePercent += (s.scoreNumeric / s.maxScore) * 100; scoreCount++; }
        else if (s.scoreQualitative === "Great!!!") { totalScorePercent += 100; scoreCount++; }
    });
    const trialMastery = scoreCount > 0 ? (totalScorePercent / scoreCount).toFixed(0) : "N/A";

    // Attendance Rate
    const absences = state.get('allAttendanceRecords').filter(r => r.classId === classId && utils.parseDDMMYYYY(r.date).getMonth() === currentMonth).length;
    const lessonDatesCount = new Set(relevantLogs.map(l => l.date)).size || 1;
    const totalPotential = studentCount * lessonDatesCount;
    const attendanceRate = totalPotential > 0 ? (((totalPotential - absences) / totalPotential) * 100).toFixed(0) : "100";

    // Top Skill
    const reasonCounts = relevantLogs.reduce((acc, log) => {
        if (['welcome_back', 'scholar_s_bonus'].includes(log.reason)) return acc;
        acc[log.reason || 'excellence'] = (acc[log.reason || 'excellence'] || 0) + log.stars;
        return acc;
    }, {});
    const topReason = Object.entries(reasonCounts).sort((a,b) => b[1] - a[1])[0]?.[0].replace(/_/g, ' ') || "Teamwork";

    // --- 3. DYNAMIC UI RENDER ---
    const modalTitle = document.getElementById('milestone-modal-title');
    const modalContent = document.getElementById('milestone-modal-content');
    
    let milestoneName, goal, icon, color;
    if (markerElement.innerText.includes('🛡️')) { milestoneName = "Bronze Shield"; goal = goals.bronze; icon = '🛡️'; color = "blue"; } 
    else if (markerElement.innerText.includes('🏆')) { milestoneName = "Silver Trophy"; goal = goals.silver; icon = '🏆'; color = "slate"; }
    else if (markerElement.innerText.includes('👑')) { milestoneName = "Golden Crown"; goal = goals.gold; icon = '👑'; color = "amber"; } 
    else { milestoneName = "Diamond Quest"; goal = goals.diamond; icon = '💎'; color = "cyan"; }

    const progressPercent = goal > 0 ? Math.min(100, (currentMonthlyStars / goal) * 100).toFixed(1) : 0;
    const starsNeeded = Math.max(0, goal - currentMonthlyStars);

    modalTitle.innerHTML = `${icon} ${milestoneName}`;
    modalContent.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div class="vibrant-card p-6 bg-gradient-to-b from-white to-${color}-50 border-4 border-${color}-400 shadow-[0_10px_30px_rgba(0,0,0,0.1)] rounded-[3rem] text-center">
                <div class="mb-4">
                    <span class="text-4xl filter drop-shadow-md">${classInfo.logo}</span>
                    <h3 class="font-title text-4xl text-gray-800 tracking-tight mt-2">${classInfo.name}</h3>
                    <p class="text-xs font-black uppercase text-${color}-600 tracking-[0.2em] mb-4">Quest Level ${dbDifficulty + 1}</p>
                </div>
                
                <div class="relative py-4">
                    <div class="flex justify-center items-baseline gap-2 mb-2">
                        <span class="font-title text-7xl text-transparent bg-clip-text bg-gradient-to-br from-${color}-500 to-${color}-800">${currentMonthlyStars}</span>
                        <span class="font-title text-2xl text-gray-400">/ ${goal}</span>
                    </div>
                    <div class="w-full bg-gray-200/50 rounded-full h-10 border-4 border-white shadow-inner relative overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-${color}-400 to-${color}-600 transition-all duration-1000 shadow-[0_0_20px_rgba(0,0,0,0.2)]" style="width: ${progressPercent}%">
                            <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                        <span class="absolute inset-0 flex items-center justify-center text-sm font-black text-gray-800 mix-blend-overlay">${progressPercent}%</span>
                    </div>
                </div>

                ${starsNeeded > 0 
                    ? `<div class="mt-6 bg-${color}-100/50 border-2 border-dashed border-${color}-300 rounded-2xl p-4 animate-bounce-slow">
                         <p class="text-${color}-800 font-bold text-lg"><i class="fas fa-arrow-up mr-2"></i>${starsNeeded} stars to reach ${icon}</p>
                       </div>` 
                    : `<div class="mt-6 bg-green-100 border-2 border-green-400 rounded-2xl p-4">
                         <p class="text-green-800 font-bold text-xl">⚔️ Milestone Claimed!</p>
                       </div>`
                }
            </div>

            <div class="grid grid-cols-1 gap-4">
                <div class="vibrant-card p-4 bg-white border-2 border-orange-300 rounded-3xl shadow-sm flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-2xl shadow-inner"><i class="fas fa-fire-alt"></i></div>
                    <div>
                        <p class="text-[10px] font-black text-orange-400 uppercase tracking-widest leading-none mb-1">Weekly Momentum</p>
                        <p class="font-title text-3xl text-orange-700">${weeklyStars} <span class="text-sm font-sans font-bold">Stars</span></p>
                    </div>
                </div>

                <div class="vibrant-card p-4 bg-white border-2 border-purple-300 rounded-3xl shadow-sm flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center text-2xl shadow-inner"><i class="fas fa-bolt"></i></div>
                    <div>
                        <p class="text-[10px] font-black text-purple-400 uppercase tracking-widest leading-none mb-1">Top Skill</p>
                        <p class="font-title text-3xl text-purple-700 capitalize">${topReason}</p>
                    </div>
                </div>

                <div class="vibrant-card p-4 bg-white border-2 border-green-300 rounded-3xl shadow-sm flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center text-2xl shadow-inner"><i class="fas fa-graduation-cap"></i></div>
                    <div>
                        <p class="text-[10px] font-black text-green-400 uppercase tracking-widest leading-none mb-1">Trial Mastery</p>
                        <p class="font-title text-3xl text-green-700">${trialMastery}% <span class="text-sm font-sans font-bold">Avg</span></p>
                    </div>
                </div>

                <div class="vibrant-card p-4 bg-white border-2 border-indigo-300 rounded-3xl shadow-sm flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl shadow-inner"><i class="fas fa-user-check"></i></div>
                    <div>
                        <p class="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Attendance Rate</p>
                        <p class="font-title text-3xl text-indigo-700">${attendanceRate}% <span class="text-sm font-sans font-bold">Show-up</span></p>
                    </div>
                </div>
            </div>
        </div>`;
    
    showAnimatedModal('milestone-details-modal');
}

export async function showWelcomeBackMessage(firstName, stars) {
    const modal = document.getElementById('welcome-back-modal');
    const messageEl = document.getElementById('welcome-back-message');
    const starsEl = document.getElementById('welcome-back-stars');

    starsEl.textContent = stars;
    messageEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    showAnimatedModal('welcome-back-modal');

    const systemPrompt = "You are the 'Quest Master' in a fun classroom game. You speak in short, exciting, single sentences. Do NOT use markdown or asterisks. Your job is to give a unique, positive welcome back message to a student who was absent. It must be one sentence only.";
    const userPrompt = `Generate a one-sentence welcome back message for a student named ${firstName}.`;

    try {
        const message = await callGeminiApi(systemPrompt, userPrompt);
        messageEl.textContent = message;
    } catch (e) {
        messageEl.textContent = `We're so glad you're back, ${firstName}!`;
    }
    
    setTimeout(() => {
        hideModal('welcome-back-modal');
    }, 4000);
}

export async function handleGenerateClassName() {
    const level = document.getElementById('class-level').value;
    const output = document.getElementById('class-name-suggestions');
    const btn = document.getElementById('generate-class-name-btn');

    if (!level) {
        showToast('Please select a Quest Level first.', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    
    // Get age context using utils
    const ageGroup = utils.getAgeGroupForLeague(level);
    
    const systemPrompt = "You are a creative assistant helping a teacher name their class team. Generate 3 short, catchy, fantasy/adventure themed class names suitable for children aged " + ageGroup + ". Do not use numbers. Return only the names separated by commas (e.g. 'Star Seekers, Dragon Riders, Time Travelers').";
    const userPrompt = `Generate names for a class in the "${level}" league.`;

    try {
        const result = await callGeminiApi(systemPrompt, userPrompt);
        const names = result.split(',').map(n => n.trim());
        
        output.innerHTML = names.map(name => 
            `<button type="button" class="suggestion-btn bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold hover:bg-indigo-200 transition-colors border border-indigo-200 shadow-sm">${name}</button>`
        ).join('');
        
    } catch (error) {
        console.error(error);
        showToast('The naming spell failed. Try again!', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-magic"></i>`;
    }
}

export async function handleGenerateReport(classId) {
    await ensureHistoryLoaded();
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;
    const contentEl = document.getElementById('report-modal-content');
    contentEl.innerHTML = `<p class="text-center"><i class="fas fa-spinner fa-spin mr-2"></i> Generating your report from the Quest Log...</p>`;
    showAnimatedModal('report-modal');

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toLocaleDateString('en-GB');

    const logs = state.get('allAwardLogs').filter(log => log.classId === classId && log.date >= oneWeekAgoStr);
    const totalStars = logs.reduce((sum, log) => sum + log.stars, 0);
    const reasonCounts = logs.reduce((acc, log) => { acc[log.reason] = (acc[log.reason] || 0) + log.stars; return acc; }, {});
    const reasonsString = Object.entries(reasonCounts).map(([reason, count]) => `${reason}: ${count}`).join(', ');
    const behaviorNotes = logs.filter(log => log.note).map(log => `On ${log.date}, a note mentioned: "${log.note}"`).join('. ');
    
    const academicScores = state.get('allWrittenScores').filter(score => score.classId === classId && score.date >= oneWeekAgoStr);
    const academicNotes = academicScores.filter(s => s.note).map(s => `For a ${s.type} on ${s.date}, a note said: "${s.note}"`).join('. ');
    const academicSummary = academicScores.map(s => `A ${s.type} score of ${s.scoreNumeric || s.scoreQualitative}`).join(', ');

    const systemPrompt = "You are the 'Quest Master,' a helpful AI assistant. You write encouraging, insightful reports for teachers. Do not use markdown. Format your response into two paragraphs with clear headings. The first paragraph is a 'Weekly Summary,' and the second is a 'Suggested Mini-Quest.' Your analysis must be based on ALL provided data: behavioral (stars) and academic (scores), including any teacher notes.";
    const userPrompt = `Class "${classData.name}" (League: ${classData.questLevel}) this week:
- Behavior Data: Earned ${totalStars} stars. Breakdown: ${reasonsString || 'None'}. Notes: ${behaviorNotes || 'None'}.
- Academic Data: Recent scores: ${academicSummary || 'None'}. Notes on scores: ${academicNotes || 'None'}.
Write a 2-paragraph summary highlighting connections between behavior and academics, and suggest a 'mini-quest' for next week based on this combined data.`;
    
    try {
        const report = await callGeminiApi(systemPrompt, userPrompt);
        contentEl.innerHTML = `<h3 class="font-title text-2xl text-green-600 mb-2">${classData.logo} ${classData.name}</h3>` + report.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
    } catch (error) {
        console.error("AI Report Generation Error:", error);
        contentEl.innerHTML = `<p class="text-red-600">The Quest Master is currently on another adventure. Please try again later.</p>`;
    }
}

export async function handleGenerateCertificate(studentId) {
    await ensureHistoryLoaded();
    const student = state.get('allStudents').find(s => s.id === studentId);
    const studentClass = state.get('allSchoolClasses').find(c => c.id === student.classId);
    if (!student || !studentClass) return;

    const contentEl = document.getElementById('certificate-modal-content');
    const downloadBtn = document.getElementById('download-certificate-btn');
    contentEl.innerHTML = `<p class="text-center"><i class="fas fa-spinner fa-spin mr-2"></i> Generating unique certificate...</p>`;
    downloadBtn.classList.add('hidden');
    showAnimatedModal('certificate-modal');

    const ageCategory = utils.getAgeCategoryForLeague(studentClass.questLevel);
    let stylePool = constants.midCertificateStyles;
    if (ageCategory === 'junior') stylePool = constants.juniorCertificateStyles;
    if (ageCategory === 'senior') stylePool = constants.seniorCertificateStyles;
    const randomStyle = stylePool[Math.floor(Math.random() * stylePool.length)];
    
    const certTemplate = document.getElementById('certificate-template');
    certTemplate.style.borderColor = randomStyle.borderColor;
    certTemplate.style.backgroundColor = randomStyle.bgColor;
    certTemplate.style.color = randomStyle.textColor;
    
    const certAvatarEl = document.getElementById('cert-avatar');
    if (student.avatar) {
        certAvatarEl.src = student.avatar;
        certAvatarEl.style.display = 'block';
    } else {
        certAvatarEl.style.display = 'none';
    }

    document.getElementById('cert-icon').innerText = randomStyle.icon;
    document.getElementById('cert-icon').style.color = randomStyle.borderColor;
    document.getElementById('cert-title').style.color = randomStyle.titleColor;
    document.getElementById('cert-student-name').style.color = randomStyle.nameColor;
    document.getElementById('cert-teacher-name').style.borderTopColor = randomStyle.borderColor;
    document.getElementById('cert-date').style.borderTopColor = randomStyle.borderColor;

    const startOfMonth = new Date(new Date().setDate(1)).toLocaleDateString('en-GB');
    const logs = state.get('allAwardLogs').filter(log => log.studentId === studentId && log.teacherId === state.get('currentUserId') && log.date >= startOfMonth);
    const monthlyStars = logs.reduce((sum, log) => sum + log.stars, 0);
    const topReason = Object.entries(logs.reduce((acc, log) => {
        acc[log.reason] = (acc[log.reason] || 0) + 1;
        return acc;
    }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || 'all-around excellence';
    
    const academicScores = state.get('allWrittenScores').filter(score => score.studentId === studentId && score.date >= startOfMonth);
    const topScore = academicScores.sort((a, b) => (b.scoreNumeric / b.maxScore) - (a.scoreNumeric / a.scoreNumeric))[0];
    const topScoreString = topScore ? `a top score of ${topScore.scoreNumeric || topScore.scoreQualitative}` : "";
    const academicNotes = academicScores.filter(s => s.note).map(s => `(Academic note: '${s.note}')`).join(' ');

    let systemPrompt = "";
    if (ageCategory === 'junior') { 
        systemPrompt = "You are an AI writing for a young child's (ages 7-9) achievement certificate. Use very simple English, short sentences, and a cheerful tone. Do NOT use markdown. Write 1-2 brief, simple sentences. Focus on being encouraging. If specific notes are provided, try to incorporate their theme simply.";
    } else if (ageCategory === 'mid') { 
        systemPrompt = "You are an AI writing for a pre-teen's (ages 9-12) certificate. Use positive, encouraging language that sounds cool and acknowledges their effort. Do NOT use markdown. Write 2 brief, well-structured sentences. Refer to specific achievements if notes are provided.";
    } else {
        systemPrompt = "You are an AI writing for a teenager's (ages 12+) certificate. The student is an English language learner. Use clear, positive, and inspiring language, avoiding overly complex vocabulary. The tone should respect their effort. Do NOT use markdown. Write 2 brief, powerful sentences. Use the teacher's notes and academic scores to make the message specific and impactful.";
    }
    const userPrompt = `Write a short certificate message for ${student.name}. This month they showed great ${topReason}, earned ${monthlyStars} stars, and achieved ${topScoreString || 'good results on their trials'}. Teacher's academic notes: ${academicNotes || 'None'}. Keep it brief.`;

    try {
        const text = await callGeminiApi(systemPrompt, userPrompt);
        contentEl.innerHTML = `<p class="text-lg text-center p-4">${text}</p>`;
        document.getElementById('cert-student-name').innerText = student.name;
        document.getElementById('cert-text').innerText = text;
        document.getElementById('cert-teacher-name').innerText = state.get('currentTeacherName');
        document.getElementById('cert-date').innerText = new Date().toLocaleDateString('en-GB', { month: 'long', day: 'numeric', year: 'numeric' });
        downloadBtn.classList.remove('hidden');
    } catch (error) {
        console.error("AI Certificate Generation Error:", error);
        contentEl.innerHTML = `<p class="text-red-600">There was an error generating the certificate text. Please try again.</p>`;
    }
}

export async function downloadCertificateAsPdf() {
    const btn = document.getElementById('download-certificate-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Preparing PDF...`;
    
    const { jsPDF } = window.jspdf;
    const certificateElement = document.getElementById('certificate-template');
    const studentName = document.getElementById('cert-student-name').innerText;

    try {
        const canvas = await html2canvas(certificateElement, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [800, 600] });
        pdf.addImage(imgData, 'PNG', 0, 0, 800, 600);
        pdf.save(`${studentName}_Certificate_of_Achievement.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        showToast('Could not generate PDF.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-download mr-2"></i> Download as PDF`;
    }
}

// --- ADDED: OVERVIEW MODAL FUNCTIONS ---
    export async function openOverviewModal(classId) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classData) return;

    // NEW: Ensure we have the data to calculate stats
    await ensureHistoryLoaded();

    const modal = document.getElementById('overview-modal');
    modal.dataset.classId = classId;
    document.getElementById('overview-modal-title').innerHTML = `${classData.logo} ${classData.name} - Quest Overview`;

    document.querySelectorAll('.overview-tab-btn').forEach(btn => {
        const isDefault = btn.dataset.view === 'class';
        btn.classList.toggle('border-purple-500', isDefault);
        btn.classList.toggle('text-purple-600', isDefault);
        btn.classList.toggle('border-transparent', !isDefault);
        btn.classList.toggle('text-gray-500', !isDefault);
    });

    renderOverviewContent(classId, 'class');
    showAnimatedModal('overview-modal');
}

export function renderOverviewContent(classId, view) {
    const contentEl = document.getElementById('overview-modal-content');
    contentEl.innerHTML = `<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-purple-500"></i><p class="mt-2">Analyzing Quest Logs...</p></div>`;

    const overviewData = generateOverviewData(classId);

    if (view === 'class') {
        renderClassOverview(overviewData);
    } else {
        renderStudentOverview(overviewData);
    }
}

function generateOverviewData(classId) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    const logsForClass = state.get('allAwardLogs').filter(log => log.classId === classId);

    if (logsForClass.length === 0) {
        return { classStats: { noData: true }, studentStats: {}, students: studentsInClass };
    }

    const logsByMonth = logsForClass.reduce((acc, log) => {
        const monthKey = utils.parseDDMMYYYY(log.date).toISOString().substring(0, 7);
        if (!acc[monthKey]) acc[monthKey] = [];
        acc[monthKey].push(log);
        return acc;
    }, {});

    const GOAL_PER_STUDENT = { BRONZE: 4, SILVER: 8, GOLD: 13, DIAMOND: 18 };
    const MILESTONE_NAMES = {
        diamond: "💎 Diamond",
        gold: "👑 Gold",
        silver: "🏆 Silver",
        bronze: "🛡️ Bronze",
        none: "None"
    };

    const monthlyStats = Object.entries(logsByMonth).map(([monthKey, monthLogs]) => {
        const totalStars = monthLogs.reduce((sum, log) => sum + log.stars, 0);
        const diamondGoal = studentsInClass.length > 0 ? Math.round(studentsInClass.length * GOAL_PER_STUDENT.DIAMOND) : 18;
        const progress = diamondGoal > 0 ? Math.min(100, (totalStars / diamondGoal) * 100) : 0;
        
        let milestone = 'none';
        if (totalStars >= studentsInClass.length * GOAL_PER_STUDENT.DIAMOND) milestone = 'diamond';
        else if (totalStars >= studentsInClass.length * GOAL_PER_STUDENT.GOLD) milestone = 'gold';
        else if (totalStars >= studentsInClass.length * GOAL_PER_STUDENT.SILVER) milestone = 'silver';
        else if (totalStars >= studentsInClass.length * GOAL_PER_STUDENT.BRONZE) milestone = 'bronze';

        return { monthKey, totalStars, progress, milestone };
    });

    const bestMonth = monthlyStats.sort((a, b) => b.totalStars - a.totalStars)[0] || null;
    const furthestMilestoneMonth = monthlyStats.sort((a, b) => b.progress - a.progress)[0] || null;

    const allTimeReasonCounts = logsForClass.reduce((acc, log) => {
        if(log.reason) acc[log.reason] = (acc[log.reason] || 0) + log.stars;
        return acc;
    }, {});
    const topReason = Object.entries(allTimeReasonCounts).sort((a,b) => b[1] - a[1])[0] || null;

    const allTimeStudentStars = logsForClass.reduce((acc, log) => {
        acc[log.studentId] = (acc[log.studentId] || 0) + log.stars;
        return acc;
    }, {});
    const topStudents = Object.entries(allTimeStudentStars).sort((a,b) => b[1] - a[1]).slice(0, 3);

    const studentStats = {};
    studentsInClass.forEach(student => {
        const studentLogs = logsForClass.filter(log => log.studentId === student.id);
        if (studentLogs.length === 0) {
            studentStats[student.id] = { noData: true };
            return;
        }
        
        const studentLogsByMonth = studentLogs.reduce((acc, log) => {
            const monthKey = utils.parseDDMMYYYY(log.date).toISOString().substring(0, 7);
            if (!acc[monthKey]) acc[monthKey] = 0;
            acc[monthKey] += log.stars;
            return acc;
        }, {});
        const bestStudentMonth = Object.entries(studentLogsByMonth).sort((a,b) => b[1] - a[1])[0] || null;

        const studentReasonCounts = studentLogs.reduce((acc, log) => {
            if(log.reason) acc[log.reason] = (acc[log.reason] || 0) + log.stars;
            return acc;
        }, {});
        const topStudentReason = Object.entries(studentReasonCounts).sort((a,b) => b[1] - a[1])[0] || null;

        studentStats[student.id] = {
            totalStars: studentLogs.reduce((sum, log) => sum + log.stars, 0),
            bestMonth: bestStudentMonth ? { month: bestStudentMonth[0], stars: bestStudentMonth[1] } : null,
            topReason: topStudentReason ? { reason: topStudentReason[0], stars: topStudentReason[1] } : null
        };
    });

    return {
        classStats: {
            bestMonth: bestMonth ? { month: bestMonth.monthKey, stars: bestMonth.totalStars } : null,
            furthestMilestone: furthestMilestoneMonth ? { month: furthestMilestoneMonth.monthKey, milestone: MILESTONE_NAMES[furthestMilestoneMonth.milestone] } : null,
            topReason: topReason ? { reason: topReason[0], stars: topReason[1] } : null,
            topStudents
        },
        studentStats,
        students: studentsInClass
    };
}

function renderClassOverview(data) {
    const contentEl = document.getElementById('overview-modal-content');
    if (data.classStats.noData) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">Not enough data yet! Award some stars to this class to start seeing insights.</p>`;
        return;
    }

    const { bestMonth, furthestMilestone, topReason, topStudents } = data.classStats;

    const reasonInfo = {
        teamwork: { icon: 'fa-users', color: 'text-purple-500', name: 'Teamwork' },
        creativity: { icon: 'fa-lightbulb', color: 'text-pink-500', name: 'Creativity' },
        respect: { icon: 'fa-hands-helping', color: 'text-green-500', name: 'Respect' },
        focus: { icon: 'fa-brain', color: 'text-yellow-600', name: 'Focus/Effort' },
        welcome_back: { icon: 'fa-hand-sparkles', color: 'text-cyan-500', name: 'Welcome Back' },
        story_weaver: { icon: 'fa-feather-alt', color: 'text-cyan-600', name: 'Story Weaver' },
        scholar_s_bonus: { icon: 'fa-graduation-cap', color: 'text-amber-700', name: 'Scholar\'s Bonus' }
    };

    const bestMonthDisplay = bestMonth ? new Date(bestMonth.month + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' }) : 'N/A';
    const furthestMilestoneDisplay = furthestMilestone ? `${furthestMilestone.milestone} <span class="text-sm font-normal text-gray-500">(in ${new Date(furthestMilestone.month + '-02').toLocaleString('en-GB', { month: 'long' })})</span>` : 'N/A';
    const topReasonDisplay = topReason ? `<i class="fas ${reasonInfo[topReason.reason]?.icon || 'fa-star'} ${reasonInfo[topReason.reason]?.color || 'text-purple-500'} mr-2"></i> ${reasonInfo[topReason.reason]?.name || topReason.reason}` : 'N/A';
    
    const topStudentsHtml = topStudents.length > 0 
        ? topStudents.map((studentEntry, index) => {
            const student = state.get('allStudents').find(s => s.id === studentEntry[0]);
            return `<div class="flex items-center gap-2"><span class="font-bold text-gray-400 w-6">${index+1}.</span> <span class="flex-grow">${student?.name || 'Unknown'}</span> <span class="font-semibold text-purple-600">${studentEntry[1]} ⭐</span></div>`;
        }).join('')
        : 'No stars awarded yet.';

    contentEl.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-calendar-alt mr-2"></i>Best Month</p>
                <p class="font-title text-3xl text-purple-700">${bestMonthDisplay}</p>
                <p class="font-semibold text-lg text-purple-600">${bestMonth?.stars || 0} ⭐ collected</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-route mr-2"></i>Furthest on Quest Map</p>
                <p class="font-title text-3xl text-purple-700">${furthestMilestoneDisplay}</p>
                <p class="font-semibold text-lg text-purple-600">Highest monthly progress</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-award mr-2"></i>All-Time Top Skill</p>
                <p class="font-title text-3xl text-purple-700">${topReasonDisplay}</p>
                <p class="font-semibold text-lg text-purple-600">${topReason?.stars || 0} ⭐ from this skill</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-crown mr-2"></i>All-Time Top Adventurers</p>
                <div class="space-y-1 mt-2 text-lg">
                    ${topStudentsHtml}
                </div>
            </div>
        </div>
    `;
}

function renderStudentOverview(data) {
    const contentEl = document.getElementById('overview-modal-content');
    
    if (data.students.length === 0) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">Add students to this class to see their individual stats.</p>`;
        return;
    }
    
    const studentOptions = data.students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    contentEl.innerHTML = `
        <div class="flex flex-col md:flex-row gap-4">
            <div class="md:w-1/3">
                <label for="overview-student-select" class="block text-sm font-medium text-gray-700 mb-1">Select a Student:</label>
                <select id="overview-student-select" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-lg">
                    ${studentOptions}
                </select>
            </div>
            <div id="overview-student-details" class="flex-grow">
                </div>
        </div>
    `;

    const studentSelect = document.getElementById('overview-student-select');
    studentSelect.addEventListener('change', (e) => {
        renderStudentDetails(data, e.target.value);
    });

    renderStudentDetails(data, studentSelect.value);
}

function renderStudentDetails(data, studentId) {
    const detailsEl = document.getElementById('overview-student-details');
    const studentData = data.studentStats[studentId];

    if (!studentData || studentData.noData) {
        detailsEl.innerHTML = `<div class="h-full flex items-center justify-center bg-gray-50 rounded-lg"><p class="text-gray-500">This student hasn't earned any stars yet.</p></div>`;
        return;
    }

    const { totalStars, bestMonth, topReason } = studentData;

    const reasonInfo = {
        teamwork: { icon: 'fa-users', color: 'text-purple-500', name: 'Teamwork' },
        creativity: { icon: 'fa-lightbulb', color: 'text-pink-500', name: 'Creativity' },
        respect: { icon: 'fa-hands-helping', color: 'text-green-500', name: 'Respect' },
        focus: { icon: 'fa-brain', color: 'text-yellow-600', name: 'Focus/Effort' },
        welcome_back: { icon: 'fa-hand-sparkles', color: 'text-cyan-500', name: 'Welcome Back' },
        story_weaver: { icon: 'fa-feather-alt', color: 'text-cyan-600', name: 'Story Weaver' },
        scholar_s_bonus: { icon: 'fa-graduation-cap', color: 'text-amber-700', name: 'Scholar\'s Bonus' }
    };

    const bestMonthDisplay = bestMonth ? new Date(bestMonth.month + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' }) : 'N/A';
    const topReasonDisplay = topReason ? `<i class="fas ${reasonInfo[topReason.reason]?.icon || 'fa-star'} ${reasonInfo[topReason.reason]?.color || 'text-purple-500'} mr-2"></i> ${reasonInfo[topReason.reason]?.name || topReason.reason}` : 'N/A';

    detailsEl.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-star mr-2"></i>All-Time Stars</p>
                <p class="font-title text-4xl text-purple-700">${totalStars}</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-calendar-alt mr-2"></i>Best Month</p>
                <p class="font-title text-2xl text-purple-700">${bestMonthDisplay}</p>
                <p class="font-semibold text-md text-purple-600">${bestMonth?.stars || 0} ⭐ earned</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-award mr-2"></i>Top Skill</p>
                <p class="font-title text-2xl text-purple-700">${topReasonDisplay}</p>
                <p class="font-semibold text-md text-purple-600">${topReason?.stars || 0} ⭐ from this skill</p>
            </div>
        </div>
    `;
}

// --- CORRECTED & ENHANCED HERO STATS MODAL ---

export function openHeroStatsModal(studentId, triggerElement) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    const modal = document.getElementById('hero-stats-modal');
    const modalContent = modal.querySelector('.pop-in');
    const avatarEl = document.getElementById('hero-stats-avatar');
    const nameEl = document.getElementById('hero-stats-name');
    const contentEl = document.getElementById('hero-stats-content');
    const chartContainer = document.getElementById('hero-stats-chart-container');

    // --- Animation Setup ---
    const rect = triggerElement.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    modalContent.style.transformOrigin = `${originX}px ${originY}px`;

    // --- Populate Content ---
    const heroIcon = (student.heroClass && HERO_CLASSES[student.heroClass]) ? HERO_CLASSES[student.heroClass].icon : '';
nameEl.innerHTML = `${heroIcon} ${student.name}`;
    if (student.avatar) {
        avatarEl.innerHTML = `<img src="${student.avatar}" alt="${student.name}">`;
    } else {
        avatarEl.innerHTML = `<div class="flex items-center justify-center bg-gray-500 text-white font-bold text-7xl">${student.name.charAt(0)}</div>`;
    }

    const classData = state.get('allSchoolClasses').find(c => c.id === student.classId);
    const isJunior = classData && (classData.questLevel === 'Junior A' || classData.questLevel === 'Junior B');
    
    const studentScores = state.get('allWrittenScores').filter(s => s.studentId === studentId);
    const studentTestScores = studentScores.filter(s => s.type === 'test');
    const studentDictationScores = studentScores.filter(s => s.type === 'dictation');
    const totalTests = studentTestScores.length;
    const totalDictations = studentDictationScores.length;

    let avgTestScore = null;
    if (totalTests > 0) {
        avgTestScore = studentTestScores.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore) * 100, 0) / totalTests;
    }

    let bestTest = null;
    if (totalTests > 0) {
        bestTest = studentTestScores.reduce((best, current) => {
            const bestScore = best.scoreNumeric / best.maxScore;
            const currentScore = current.scoreNumeric / current.maxScore;
            return currentScore > bestScore ? current : best;
        });
    }
    
    let dictationStatHtml = '';
    if (isJunior) {
        const dictationCounts = studentDictationScores.reduce((acc, s) => {
            if (s.scoreQualitative) acc[s.scoreQualitative] = (acc[s.scoreQualitative] || 0) + 1;
            return acc;
        }, {});
        const dictationOrder = ["Great!!!", "Great!!", "Great!", "Nice Try!"];
        const dictationSummary = dictationOrder
            .filter(key => dictationCounts[key])
            .map(key => `${dictationCounts[key]}x ${key}`)
            .join(', ');
        if (dictationSummary) {
            dictationStatHtml = `<div class="hero-stat-item">
                <div class="icon text-blue-400"><i class="fas fa-microphone-alt"></i></div>
                <div class="text">
                    <div class="title">Dictation Results</div>
                    <div class="value">${dictationSummary}</div>
                </div>
            </div>`;
        }
    } else { // Is Senior
        if (totalDictations > 0) {
            const seniorDictations = studentDictationScores.filter(s => s.scoreNumeric !== null);
            if (seniorDictations.length > 0) {
                const avgDictationScore = seniorDictations.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore) * 100, 0) / seniorDictations.length;
                dictationStatHtml = `<div class="hero-stat-item">
                    <div class="icon text-blue-400"><i class="fas fa-microphone-alt"></i></div>
                    <div class="text">
                        <div class="title">Average Dictation Score</div>
                        <div class="value">${avgDictationScore.toFixed(1)}%</div>
                    </div>
                </div>`;
            }
        }
    }

    let statsHtml = `
        <div class="hero-stat-item">
            <div class="icon text-gray-400"><i class="fas fa-scroll"></i></div>
            <div class="text">
                <div class="title">Trials Logged</div>
                <div class="value">${totalTests + totalDictations}</div>
            </div>
        </div>
    `;

    if (avgTestScore !== null) {
        statsHtml += `<div class="hero-stat-item">
            <div class="icon text-green-400"><i class="fas fa-file-alt"></i></div>
            <div class="text">
                <div class="title">Average Test Score</div>
                <div class="value">${avgTestScore.toFixed(1)}%</div>
            </div>
        </div>`;
    }

    statsHtml += dictationStatHtml;

    if (bestTest) {
        const bestScorePercent = (bestTest.scoreNumeric / bestTest.maxScore * 100).toFixed(0);
        statsHtml += `<div class="hero-stat-item">
            <div class="icon text-amber-400"><i class="fas fa-award"></i></div>
            <div class="text">
                <div class="title">Best Test Performance</div>
                <div class="value">${bestScorePercent}% on "${bestTest.title}"</div>
            </div>
        </div>`;
    }
    
    if (totalTests === 0 && totalDictations === 0) {
        statsHtml = `<div class="h-full flex items-center justify-center text-gray-400">No trial data logged for this student yet.</div>`;
    }
    
    contentEl.innerHTML = statsHtml;

    // --- Chart Implementation with Error Handling ---
    if (heroStatsChart) {
        heroStatsChart.destroy();
        heroStatsChart = null;
    }
    chartContainer.innerHTML = '';

    if (studentScores.length < 2) {
        chartContainer.innerHTML = `<div class="flex items-center justify-center h-full text-gray-400">Log at least two trials to see a progress chart.</div>`;
    } else {
        try {
            const canvas = document.createElement('canvas');
            chartContainer.appendChild(canvas);
            
            const sortedScores = [...studentScores].sort((a, b) => new Date(a.date) - new Date(b.date));
            const labels = sortedScores.map(s => new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
            const dictationMap = { "Great!!!": 100, "Great!!": 75, "Great!": 50, "Nice Try!": 25 };

            const testData = sortedScores.map(s => s.type === 'test' ? (s.scoreNumeric / s.maxScore) * 100 : null);
            const dictationData = sortedScores.map(s => {
                if (s.type !== 'dictation') return null;
                return s.scoreQualitative ? dictationMap[s.scoreQualitative] : (s.scoreNumeric / s.maxScore) * 100;
            });

            heroStatsChart = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Test Score', data: testData, borderColor: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.2)', fill: false, tension: 0.1, spanGaps: true },
                        { label: 'Dictation Score', data: dictationData, borderColor: '#60a5fa', backgroundColor: 'rgba(96, 165, 250, 0.2)', fill: false, tension: 0.1, spanGaps: true }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        title: { display: true, text: 'Trial Progress Over Time', color: '#d1d5db', font: { size: 16 } },
                        legend: { labels: { color: '#d1d5db' } },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    if (context.parsed.y !== null) {
                                        const originalScore = sortedScores[context.dataIndex];
                                        if(originalScore.type === 'dictation' && originalScore.scoreQualitative) {
                                            label += originalScore.scoreQualitative;
                                        } else {
                                            label += context.parsed.y.toFixed(1) + '%';
                                        }
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, max: 100, ticks: { color: '#9ca3af', callback: value => value + '%' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                        x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                    }
                }
            });
        } catch (error) {
            console.error("Chart.js rendering error:", error);
            chartContainer.innerHTML = `<div class="flex items-center justify-center h-full text-red-400">Could not render progress chart. (Is Chart.js library loaded?)</div>`;
        }
    }

    const closeHandler = () => {
        modal.removeEventListener('click', backgroundClickHandler);
        
        modalContent.classList.add('modal-origin-start');
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0)';

        setTimeout(() => {
            modal.classList.add('hidden');
        }, 350);
    };

    const backgroundClickHandler = (e) => {
        if (e.target === modal) {
            closeHandler();
        }
    };
    
    const oldCloseBtn = document.getElementById('hero-stats-close-btn');
    const newCloseBtn = oldCloseBtn.cloneNode(true);
    oldCloseBtn.parentNode.replaceChild(newCloseBtn, oldCloseBtn);
    newCloseBtn.addEventListener('click', closeHandler, { once: true });

    modal.addEventListener('click', backgroundClickHandler);

    modal.style.transition = 'background-color 0.3s ease-out';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    modalContent.classList.add('modal-origin-start');
    modal.classList.remove('hidden');

    requestAnimationFrame(() => {
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        modalContent.classList.remove('modal-origin-start');
    });
}

// --- NEW: HERO'S CHRONICLE MODAL ---

export function openHeroChronicleModal(studentId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    const modal = document.getElementById('hero-chronicle-modal');
    modal.dataset.studentId = studentId;

    document.getElementById('hero-chronicle-student-name').innerText = `for ${student.name}`;
    
    resetHeroChronicleForm();
    renderHeroChronicleContent(studentId);
    
    // Reset AI output
    document.getElementById('hero-chronicle-ai-output').innerHTML = `<p class="text-center text-indigo-700">Select a counsel type to receive the Oracle's wisdom.</p>`;

    showAnimatedModal('hero-chronicle-modal');
}

export function renderHeroChronicleContent(studentId) {
    const notesFeed = document.getElementById('hero-chronicle-notes-feed');
    const notes = state.get('allHeroChronicleNotes')
        .filter(n => n.studentId === studentId)
        .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());

    if (notes.length === 0) {
        notesFeed.innerHTML = `<p class="text-center text-gray-500 p-4">No notes have been added for this student yet.</p>`;
        return;
    }

    notesFeed.innerHTML = notes.map(note => `
        <div class="bg-white p-3 rounded-md shadow-sm border">
            <div class="flex justify-between items-center text-xs text-gray-500 mb-1">
                <span class="font-bold">${note.category}</span>
                <span>${(note.createdAt ? note.createdAt.toDate() : new Date()).toLocaleDateString('en-GB')}</span>
            </div>
            <p class="text-gray-800 whitespace-pre-wrap">${note.noteText}</p>
            <div class="text-right mt-2">
                <button class="edit-chronicle-note-btn text-blue-500 hover:underline text-xs mr-2" data-note-id="${note.id}">Edit</button>
                <button class="delete-chronicle-note-btn text-red-500 hover:underline text-xs" data-note-id="${note.id}">Delete</button>
            </div>
        </div>
    `).join('');
}

export function resetHeroChronicleForm() {
    const form = document.getElementById('hero-chronicle-note-form');
    form.reset();
    document.getElementById('hero-chronicle-note-id').value = '';
    document.getElementById('hero-chronicle-cancel-edit-btn').classList.add('hidden');
    form.querySelector('button[type="submit"]').textContent = 'Save Note';
}

export function setupNoteForEditing(noteId) {
    const note = state.get('allHeroChronicleNotes').find(n => n.id === noteId);
    if (!note) return;

    document.getElementById('hero-chronicle-note-id').value = noteId;
    document.getElementById('hero-chronicle-note-text').value = note.noteText;
    document.getElementById('hero-chronicle-note-category').value = note.category;
    document.getElementById('hero-chronicle-cancel-edit-btn').classList.remove('hidden');
    document.getElementById('hero-chronicle-note-form').querySelector('button[type="submit"]').textContent = 'Update Note';
    document.getElementById('hero-chronicle-note-text').focus();
}

export async function generateAIInsight(studentId, insightType) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    const outputEl = document.getElementById('hero-chronicle-ai-output');
    outputEl.innerHTML = `<p class="text-center text-indigo-700"><i class="fas fa-spinner fa-spin mr-2"></i>The Oracle is consulting the records...</p>`;

    // 1. Gather all data
    const notes = state.get('allHeroChronicleNotes')
        .filter(n => n.studentId === studentId)
        .sort((a, b) => (a.createdAt?.toDate() || new Date()) - (b.createdAt?.toDate() || new Date()))
        .map(n => `[${(n.createdAt ? n.createdAt.toDate() : new Date()).toLocaleDateString('en-GB')} - ${n.category}] ${n.noteText}`)
        .join('\n');

    const academicScores = state.get('allWrittenScores')
        .filter(s => s.studentId === studentId)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(s => `[${s.date}] Scored ${s.scoreQualitative || `${s.scoreNumeric}/${s.maxScore}`} on a ${s.type} titled "${s.title || 'Dictation'}". Note: ${s.notes || 'N/A'}`)
        .join('\n');

    const behavioralAwards = state.get('allAwardLogs')
        .filter(l => l.studentId === studentId)
        .sort((a, b) => utils.parseDDMMYYYY(a.date) - utils.parseDDMMYYYY(b.date))
        .map(l => `[${l.date}] Awarded ${l.stars} star(s) for ${l.reason}. Note: ${l.note || 'N/A'}`)
        .join('\n');

    // 2. Select prompt based on type
    let systemPrompt = "";
    const prompts = {
        parent: {
            persona: "You are a thoughtful educational psychologist writing a summary for a parent-teacher meeting. Your tone is balanced, positive, and constructive. Use clear, jargon-free language.",
            task: `Summarize the student's progress. Structure your response with clear headings in markdown: '### Key Strengths' and '### Areas for Growth'. Under each, provide 2-3 bullet points. Conclude with a positive, encouraging sentence.`
        },
        teacher: {
            persona: "You are an experienced teaching coach and mentor providing confidential advice to another teacher. Your tone is practical, supportive, and insightful.",
            task: `Analyze the student's complete record and provide actionable strategies. Structure your response with clear headings in markdown: '### In-Classroom Strategies', '### Motivation Techniques', and '### Potential Challenges to Watch For'. Provide 2-3 specific, bulleted suggestions under each heading.`
        },
        analysis: {
            persona: "You are a concise data analyst summarizing student performance patterns. Your tone is objective and direct.",
            task: `Identify key patterns from the data. Structure your response with two markdown lists: '### Key Strengths' and '### Areas to Develop'. Provide 3-4 bullet points for each, citing specific data types (e.g., 'academic scores', 'behavior notes') where patterns emerge.`
        },
        goal: {
            persona: "You are a goal-setting expert for students, focusing on SMART (Specific, Measurable, Achievable, Relevant, Time-bound) goals. Your tone is positive and forward-looking.",
            task: `Based on the student's record, suggest ONE specific and achievable goal for the upcoming month. Explain the goal and why it's relevant in a single paragraph. Do not use markdown.`
        }
    };
    systemPrompt = `${prompts[insightType].persona} Your task is to analyze a comprehensive record for a student named ${student.name} and generate a specific type of summary. ${prompts[insightType].task}`;
    
    const userPrompt = `Here is the complete record for ${student.name}:
    
    --- TEACHER'S PRIVATE NOTES ---
    ${notes || "No private notes recorded."}

    --- ACADEMIC TRIAL SCORES ---
    ${academicScores || "No academic scores recorded."}

    --- BEHAVIORAL STAR AWARDS ---
    ${behavioralAwards || "No behavioral awards recorded."}

    Please generate the requested summary.`;

    try {
        const insight = await callGeminiApi(systemPrompt, userPrompt);
        // Basic markdown to HTML conversion
        let htmlInsight = insight
            .replace(/\*\*\*(.*?)\*\*\*/g, '<b>$1</b>') // Handle ***bold***
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')   // Handle **bold**
            .replace(/### (.*?)\n/g, '<h4 class="font-bold text-indigo-800 mt-3 mb-1">$1</h4>')
            .replace(/\* (.*?)\n/g, '<li class="ml-4">$1</li>')
            .replace(/(\n)/g, '<br>');
        outputEl.innerHTML = `<ul>${htmlInsight}</ul>`;
    } catch (error) {
        console.error("AI Insight Error:", error);
        outputEl.innerHTML = `<p class="text-center text-red-500">The Oracle could not process the records at this time. Please try again later.</p>`;
    }
}

export function openAppInfoModal() {
    const studentContent = document.getElementById('info-content-students');
    const teacherContent = document.getElementById('info-content-teachers');

    // 1. STUDENTS CONTENT (Adventure Guide)
    studentContent.innerHTML = `
        <div class="bg-white/80 p-6 rounded-3xl shadow-sm border-l-8 border-cyan-400">
            <h3 class="font-title text-3xl text-cyan-800 mb-4"><i class="fas fa-map-signs"></i> Your Journey Begins!</h3>
            <p class="text-gray-700 text-lg leading-relaxed">
                Welcome, brave adventurer! In <strong>The Great Class Quest</strong>, your classroom is a team, and every lesson is a step on an epic journey. 
                Work together, learn new things, and earn <strong>Stars</strong> to travel across the map!
            </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-amber-50 p-6 rounded-2xl border-2 border-amber-200">
                <h4 class="font-title text-xl text-amber-700 mb-2"><i class="fas fa-star"></i> Earning Stars</h4>
                <p class="text-sm text-gray-600">
                    Show <strong>Teamwork</strong>, <strong>Creativity</strong>, <strong>Focus</strong>, and <strong>Respect</strong>. Every star your teacher awards moves your class ship forward on the Team Map!
                </p>
            </div>
            <div class="bg-purple-50 p-6 rounded-2xl border-2 border-purple-200">
                <h4 class="font-title text-xl text-purple-700 mb-2"><i class="fas fa-medal"></i> Hero's Challenge</h4>
                <p class="text-sm text-gray-600">
                    Your personal stars count too! Climb the ranks from <strong>Bronze</strong> to <strong>Diamond</strong>. Be the "Class Hero" by helping others!
                </p>
            </div>
            <div class="bg-indigo-50 p-6 rounded-2xl border-2 border-indigo-200">
                <h4 class="font-title text-xl text-indigo-700 mb-2"><i class="fas fa-store"></i> The Mystic Shop</h4>
                <p class="text-sm text-gray-600">
                    Earn <strong>Gold Coins</strong> by collecting stars. Spend them on cool virtual artifacts like swords, pets, and potions to decorate your profile!
                </p>
            </div>
            <div class="bg-green-50 p-6 rounded-2xl border-2 border-green-200">
                <h4 class="font-title text-xl text-green-700 mb-2"><i class="fas fa-feather-alt"></i> Story Weavers</h4>
                <p class="text-sm text-gray-600">
                    Every lesson, you create a story together. The AI illustrates your adventure based on what you learn!
                </p>
            </div>
        </div>
    `;

    // 2. TEACHERS CONTENT (Game Master's Manual)
    teacherContent.innerHTML = `
        <div class="bg-white/80 p-6 rounded-3xl shadow-sm border-l-8 border-green-500">
            <h3 class="font-title text-3xl text-green-800 mb-4"><i class="fas fa-chalkboard-teacher"></i> The Philosophy</h3>
            <p class="text-gray-700 text-lg leading-relaxed">
                This app turns classroom management into a cooperative RPG. Instead of policing behavior, you are the <strong>Game Master</strong> guiding a guild of heroes.
                Use visuals, sounds, and AI storytelling to make "boring" tasks (attendance, homework) feel magical.
            </p>
        </div>

        <div class="space-y-6">
            <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex gap-4">
                <div class="text-3xl text-rose-500"><i class="fas fa-mouse-pointer"></i></div>
                <div>
                    <h4 class="font-bold text-gray-800 text-lg">One-Tap Awards</h4>
                    <p class="text-sm text-gray-600">Go to <strong>Award Stars</strong>. Tap a student card to give 1 star. Tap the small buttons for specific amounts. Use the "Undo" button on the card if you make a mistake.</p>
                </div>
            </div>

            <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex gap-4">
                <div class="text-3xl text-blue-500"><i class="fas fa-calendar-check"></i></div>
                <div>
                    <h4 class="font-bold text-gray-800 text-lg">The Daily Rhythm</h4>
                    <p class="text-sm text-gray-600">
                        1. <strong>Home Tab:</strong> Check active class.<br>
                        2. <strong>Roll Call:</strong> Mark absences (removes today's stars).<br>
                        3. <strong>Award:</strong> Give stars during lesson.<br>
                        4. <strong>Log:</strong> At end of class, go to <strong>Log</strong> tab and click "Log Adventure". The AI writes the summary!
                    </p>
                </div>
            </div>

            <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex gap-4">
                <div class="text-3xl text-amber-500"><i class="fas fa-crown"></i></div>
                <div>
                    <h4 class="font-bold text-gray-800 text-lg">Ceremonies</h4>
                    <p class="text-sm text-gray-600">
                        At the start of a new month, the <strong>Team Quest</strong> and <strong>Hero's Challenge</strong> buttons will glow. Click them to launch the automated Award Ceremony for the previous month!
                    </p>
                </div>
            </div>
        </div>
    `;

    // 3. Reset Tabs (Show Student by default)
    const studentBtn = document.getElementById('info-btn-students');
    const teacherBtn = document.getElementById('info-btn-teachers');
    
    studentBtn.classList.add('bg-cyan-500', 'text-white', 'active');
    studentBtn.classList.remove('bg-white', 'text-cyan-700');
    teacherBtn.classList.remove('bg-green-500', 'text-white', 'active');
    teacherBtn.classList.add('bg-white', 'text-green-700');
    
    studentContent.classList.remove('hidden');
    teacherContent.classList.add('hidden');

    showAnimatedModal('app-info-modal');
}

// --- STUDENT RANKINGS MODAL (HERO RANKS ARCHIVE) ---
// --- STUDENT RANKINGS MODAL (HERO RANKS ARCHIVE) ---
export async function openStudentRankingsModal(resetDate = true) {
    const modalId = 'global-leaderboard-modal';
    const titleEl = document.getElementById('global-leaderboard-title');
    const contentEl = document.getElementById('global-leaderboard-content');
    
    // 1. Manage the Date (Default to last month if opening fresh)
    if (resetDate) {
        rankingsViewDate = new Date();
        rankingsViewDate.setMonth(rankingsViewDate.getMonth() - 1);
    }
    
    const activeMonthKey = rankingsViewDate.toISOString().substring(0, 7); // YYYY-MM
    const monthDisplay = rankingsViewDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    titleEl.innerHTML = `<i class="fas fa-trophy text-amber-500 mr-2"></i>Hero Ranks`;
    contentEl.innerHTML = `<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-purple-500"></i><p class="mt-2 text-gray-500">Loading Archives for ${monthDisplay}...</p></div>`;
    
    // 2. Show Modal (Only animate the first time it opens)
    if (resetDate) {
        showAnimatedModal(modalId);
    }

    // 3. Fetch Data (Logs & History)
    let monthlyScores = {};
    let logs = [];
    
    try {
        const { fetchLogsForMonth } = await import('../db/queries.js');
        const { fetchMonthlyHistory } = await import('../state.js'); 
        const [year, month] = activeMonthKey.split('-').map(Number);
        
        // Try fetching detailed logs first (for tie-breakers)
        const logsPromise = fetchLogsForMonth(year, month);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
        
        logs = await Promise.race([logsPromise, timeoutPromise]).catch(e => []);
        
        if (!logs || logs.length === 0) {
            monthlyScores = await fetchMonthlyHistory(activeMonthKey);
        } else {
            logs.forEach(log => {
                monthlyScores[log.studentId] = (monthlyScores[log.studentId] || 0) + log.stars;
            });
        }
    } catch (e) { console.error(e); }

    // 4. Prepare Data
    const leaguesPromise = import('../constants.js').then(c => c.questLeagues);
    const allLeagues = (await leaguesPromise).default || ['Junior A', 'Junior B', 'A', 'B', 'C', 'D'];
    const myClasses = state.get('allTeachersClasses').sort((a,b) => a.name.localeCompare(b.name));

    // 5. Render UI Structure with Navigation
    contentEl.innerHTML = `
        <div class="flex items-center justify-between mb-4 bg-indigo-50 p-2 rounded-xl border border-indigo-100 shadow-sm">
            <button id="rank-prev-month" class="w-8 h-8 rounded-full bg-white text-indigo-600 shadow hover:bg-indigo-100 transition-colors flex items-center justify-center">
                <i class="fas fa-chevron-left"></i>
            </button>
            <span class="font-title text-lg text-indigo-900">${monthDisplay}</span>
            <button id="rank-next-month" class="w-8 h-8 rounded-full bg-white text-indigo-600 shadow hover:bg-indigo-100 transition-colors flex items-center justify-center">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>

        <div class="flex justify-center gap-4 mb-4 border-b border-gray-200 pb-4">
            <button id="rank-tab-global" class="px-6 py-2 rounded-full font-bold text-sm transition-all bg-indigo-600 text-white shadow-md">
                <i class="fas fa-globe mr-2"></i>Global League
            </button>
            <button id="rank-tab-class" class="px-6 py-2 rounded-full font-bold text-sm transition-all bg-white text-gray-500 hover:bg-gray-100 border border-gray-200">
                <i class="fas fa-chalkboard-teacher mr-2"></i>My Class
            </button>
        </div>

        <div id="rank-filter-container" class="mb-4"></div>

        <div id="ranks-list-container" class="space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar"></div>
    `;

    // --- NAVIGATION LISTENERS ---
    document.getElementById('rank-prev-month').onclick = () => {
        rankingsViewDate.setMonth(rankingsViewDate.getMonth() - 1);
        openStudentRankingsModal(false); // Refresh without re-animating modal
    };
    document.getElementById('rank-next-month').onclick = () => {
        // Don't go past the current month
        if (rankingsViewDate.getMonth() === new Date().getMonth() && rankingsViewDate.getFullYear() === new Date().getFullYear()) return;
        rankingsViewDate.setMonth(rankingsViewDate.getMonth() + 1);
        openStudentRankingsModal(false);
    };

    // --- INTERNAL RENDER LOGIC ---
    const renderContent = (view, filterValue) => {
        const filterContainer = document.getElementById('rank-filter-container');
        const listContainer = document.getElementById('ranks-list-container');
        const allStudents = state.get('allStudents');
        const allClasses = state.get('allSchoolClasses');

        if (view === 'global') {
            const currentLeague = filterValue || allLeagues[0];
            const options = allLeagues.map(l => `<option value="${l}" ${l === currentLeague ? 'selected' : ''}>${l} League</option>`).join('');
            filterContainer.innerHTML = `<select id="rank-league-select" class="w-full p-3 border-2 border-indigo-100 rounded-xl bg-indigo-50 font-bold text-indigo-900 outline-none">${options}</select>`;
            const classesInLeague = allClasses.filter(c => c.questLevel === currentLeague);
            const classIds = classesInLeague.map(c => c.id);
            renderStudentList(allStudents.filter(s => classIds.includes(s.classId)), listContainer, monthlyScores);
            document.getElementById('rank-league-select').onchange = (e) => renderContent('global', e.target.value);
        } else {
            if (myClasses.length === 0) {
                listContainer.innerHTML = `<p class="text-center text-gray-500">No classes found.</p>`;
                return;
            }
            const currentClassId = filterValue || myClasses[0].id;
            const options = myClasses.map(c => `<option value="${c.id}" ${c.id === currentClassId ? 'selected' : ''}>${c.logo} ${c.name}</option>`).join('');
            filterContainer.innerHTML = `<select id="rank-class-select" class="w-full p-3 border-2 border-purple-100 rounded-xl bg-purple-50 font-bold text-purple-900 outline-none">${options}</select>`;
            renderStudentList(allStudents.filter(s => s.classId === currentClassId), listContainer, monthlyScores);
            document.getElementById('rank-class-select').onchange = (e) => renderContent('class', e.target.value);
        }
    };

    const renderStudentList = (students, container, scores) => {
        if (students.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-400 py-4">No students found in this category.</p>`;
            return;
        }

        const allWrittenScores = state.get('allWrittenScores');
        const [year, month] = activeMonthKey.split('-').map(Number);

        // 1. Calculate Stats EXACTLY like ceremony.js
        const ranked = students.map(s => {
            const cls = state.get('allSchoolClasses').find(c => c.id === s.classId);
            const sLogs = logs.filter(l => l.studentId === s.id);
            const score = scores[s.id] || 0;
            
            let count3 = 0, count2 = 0;
            const reasons = new Set();
            sLogs.forEach(l => {
                if (l.stars >= 3) count3++;
                else if (l.stars >= 2) count2++;
                if (l.reason) reasons.add(l.reason);
            });

            const sScores = allWrittenScores.filter(sc => {
                if(sc.studentId !== s.id || !sc.date) return false;
                const d = utils.parseFlexibleDate(sc.date);
                return d && d.getMonth() === (month - 1) && d.getFullYear() === year;
            });

            let acadSum = 0;
            sScores.forEach(sc => {
                if (sc.scoreNumeric !== null && sc.maxScore) acadSum += (sc.scoreNumeric/sc.maxScore)*100;
                else if (sc.scoreQualitative === 'Great!!!') acadSum += 100;
                else if (sc.scoreQualitative === 'Great!!') acadSum += 75;
            });
            const academicAvg = sScores.length > 0 ? acadSum / sScores.length : 0;

            return {
                ...s,
                stars: score,
                className: cls?.name,
                classLogo: cls?.logo,
                stats: { count3, count2, academicAvg, uniqueReasons: reasons.size }
            };
        }).sort((a, b) => {
            // 2. Sort EXACTLY like ceremony.js
            if (b.stars !== a.stars) return b.stars - a.stars;
            if (b.stats.count3 !== a.stats.count3) return b.stats.count3 - a.stats.count3;
            if (b.stats.count2 !== a.stats.count2) return b.stats.count2 - a.stats.count2;
            if (b.stats.uniqueReasons !== a.stats.uniqueReasons) return b.stats.uniqueReasons - a.stats.uniqueReasons;
            return b.stats.academicAvg - a.stats.academicAvg;
        });

        // 3. Assign Ranks EXACTLY like ceremony.js (handling visual ties)
        let currentRank = 1;
        const finalizedList = ranked.map((s, i) => {
            if (i > 0) {
                const prev = ranked[i-1];
                let isTie = s.stars === prev.stars && 
                            s.stats.count3 === prev.stats.count3 && 
                            s.stats.count2 === prev.stats.count2 &&
                            s.stats.uniqueReasons === prev.stats.uniqueReasons;
                
                // Academic average only breaks ties after the Top 3
                if (currentRank > 3) {
                    isTie = isTie && (Math.abs(s.stats.academicAvg - prev.stats.academicAvg) < 0.1);
                }
                
                if (!isTie) currentRank = i + 1;
            }
            return { ...s, ceremonyRank: currentRank };
        });

        // 4. Render the UI
        container.innerHTML = finalizedList.map((s) => {
            const rank = s.ceremonyRank;
            let icon = `<span class="text-gray-400 font-bold w-6 text-right">${rank}.</span>`;
            let bgClass = "bg-white";
            
            if (rank === 1) { icon = "🥇"; bgClass = "bg-amber-50 border border-amber-200"; }
            else if (rank === 2) { icon = "🥈"; bgClass = "bg-gray-50 border border-gray-200"; }
            else if (rank === 3) { icon = "🥉"; bgClass = "bg-orange-50 border border-orange-200"; }

            return `
                <div class="flex items-center justify-between p-3 rounded-xl ${bgClass} hover:shadow-sm transition-all mb-2">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <div class="text-xl w-8 text-center shrink-0">${icon}</div>
                        ${s.avatar ? `<img src="${s.avatar}" class="w-10 h-10 rounded-full object-cover">` : `<div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">${s.name.charAt(0)}</div>`}
                        <div class="min-w-0">
                            <div class="font-bold text-gray-800 truncate">${s.name}</div>
                            <div class="text-[10px] text-gray-500 truncate">${s.classLogo || ''} ${s.className || ''}</div>
                        </div>
                    </div>
                    <div class="font-title text-xl text-indigo-600 shrink-0">${s.stars} ⭐</div>
                </div>
            `;
        }).join('');
    };
    
    // Tab Listeners
    const btnGlobal = document.getElementById('rank-tab-global');
    const btnClass = document.getElementById('rank-tab-class');

    btnGlobal.onclick = () => {
        btnGlobal.className = "px-6 py-2 rounded-full font-bold text-sm transition-all bg-indigo-600 text-white shadow-md";
        btnClass.className = "px-6 py-2 rounded-full font-bold text-sm transition-all bg-white text-gray-500 hover:bg-gray-100 border border-gray-200";
        renderContent('global');
    };

    btnClass.onclick = () => {
        btnClass.className = "px-6 py-2 rounded-full font-bold text-sm transition-all bg-indigo-600 text-white shadow-md";
        btnGlobal.className = "px-6 py-2 rounded-full font-bold text-sm transition-all bg-white text-gray-500 hover:bg-gray-100 border border-gray-200";
        renderContent('class');
    };

    renderContent('global');
}

// Internal state for the Hall of Heroes month-browsing
let rankingsViewDate = new Date();
let hallOfHeroesViewDate = new Date();

export async function openHallOfHeroes() {
    const classId = document.getElementById('adventure-log-class-select').value;
    if (!classId) { showToast("Select a class first!", "info"); return; }
    
    // Reset view to the current month when opening
    hallOfHeroesViewDate = new Date();
    
    const modal = document.getElementById('history-modal');
    const selectEl = document.getElementById('history-month-select');
    
    // Setup Modal appearance
    selectEl.classList.add('hidden');
    showAnimatedModal('history-modal');

    renderHallOfHeroesContent(classId);
}

async function renderHallOfHeroesContent(classId) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const contentEl = document.getElementById('history-modal-content');
    const modalTitle = document.querySelector('#history-modal h2');

    const monthName = hallOfHeroesViewDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const currentMonth = hallOfHeroesViewDate.getMonth();
    const currentYear = hallOfHeroesViewDate.getFullYear();

    modalTitle.innerHTML = `<i class="fas fa-crown text-amber-500 mr-3"></i>${classData.name} Heroes`;

    // Filter logs for this specific class and specific month
    const monthlyLogs = state.get('allAdventureLogs').filter(l => {
        const d = utils.parseDDMMYYYY(l.date);
        return l.classId === classId && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).sort((a,b) => utils.parseDDMMYYYY(b.date) - utils.parseDDMMYYYY(a.date));

    let html = `
        <div class="flex items-center justify-between mb-6 bg-indigo-50 p-3 rounded-2xl border-2 border-indigo-100">
            <button id="hero-prev-month" class="w-10 h-10 rounded-full bg-white text-indigo-600 shadow hover:bg-indigo-100 transition-colors flex items-center justify-center">
                <i class="fas fa-chevron-left"></i>
            </button>
            <span class="font-title text-xl text-indigo-900">${monthName}</span>
            <button id="hero-next-month" class="w-10 h-10 rounded-full bg-white text-indigo-600 shadow hover:bg-indigo-100 transition-colors flex items-center justify-center">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;

    if (monthlyLogs.length === 0) {
        html += `
            <div class="text-center py-16 opacity-50">
                <div class="text-6xl mb-4">📜</div>
                <p class="font-bold text-gray-500">No heroes were crowned in ${monthName}.</p>
            </div>`;
    } else {
        html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">`;
        
        monthlyLogs.forEach(log => {
            const dateStr = utils.parseDDMMYYYY(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            
            // Find the student object to get their avatar
            const student = state.get('allStudents').find(s => s.name === log.hero && s.classId === classId);
            const avatarHtml = student?.avatar 
                ? `<img src="${student.avatar}" class="w-14 h-14 rounded-full border-4 border-white shadow-md object-cover">`
                : `<div class="w-14 h-14 rounded-full bg-indigo-500 border-4 border-white shadow-md flex items-center justify-center text-white font-bold">${log.hero.charAt(0)}</div>`;

            html += `
                <div class="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden group hover:scale-[1.02] transition-transform">
                    <!-- Diary Image (AI Image) -->
                    <div class="h-32 w-full relative">
                        <img src="${log.imageUrl}" class="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <div class="absolute bottom-2 left-3 text-white text-[10px] font-black uppercase tracking-tighter">${dateStr}</div>
                    </div>
                    
                    <!-- Content Area -->
                    <div class="p-4 pt-0 relative">
                        <!-- Student Avatar Overlap -->
                        <div class="absolute -top-7 right-4">
                            ${avatarHtml}
                        </div>
                        
                        <div class="mt-4">
                            <h4 class="font-title text-xl text-indigo-900 leading-tight mb-1">${log.hero}</h4>
                            <div class="flex items-center gap-1">
                                <span class="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-200">
                                    <i class="fas fa-award mr-1"></i>${log.topReason.replace(/_/g, ' ')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    contentEl.innerHTML = html;

    // Attach Nav Listeners
    document.getElementById('hero-prev-month').onclick = () => {
        hallOfHeroesViewDate.setMonth(hallOfHeroesViewDate.getMonth() - 1);
        renderHallOfHeroesContent(classId);
    };
    document.getElementById('hero-next-month').onclick = () => {
        // Prevent going into the future
        if (hallOfHeroesViewDate.getMonth() === new Date().getMonth() && hallOfHeroesViewDate.getFullYear() === new Date().getFullYear()) return;
        hallOfHeroesViewDate.setMonth(hallOfHeroesViewDate.getMonth() + 1);
        renderHallOfHeroesContent(classId);
    };
}

/**
 * Opens the Boon Modal and populates the sponsor list
 */
export function openBestowBoonModal(receiverId) {
    const receiver = state.get('allStudents').find(s => s.id === receiverId);
    if (!receiver) return;

    const modal = document.getElementById('bestow-boon-modal');
    document.getElementById('boon-receiver-name').innerText = receiver.name;
    modal.dataset.receiverId = receiverId;

    // Get all other students in the same class
    const classmates = state.get('allStudents').filter(s => s.classId === receiver.classId && s.id !== receiverId);
    const select = document.getElementById('boon-sender-select');
    
    if (classmates.length === 0) {
        select.innerHTML = `<option value="">No other students in class</option>`;
        document.getElementById('boon-confirm-btn').disabled = true;
    } else {
        select.innerHTML = classmates.map(s => {
            const scoreData = state.get('allStudentScores').find(sc => sc.id === s.id);
            const gold = scoreData?.gold !== undefined ? scoreData.gold : (scoreData?.totalStars || 0);
            return `<option value="${s.id}" ${gold < 15 ? 'disabled' : ''}>${s.name} (${gold} Gold)</option>`;
        }).join('');
        document.getElementById('boon-confirm-btn').disabled = false;
    }

    showAnimatedModal('bestow-boon-modal');
}

export function openZoneOverviewModal(zoneType) {
    const league = state.get('globalSelectedLeague');
    if (!league) return;

    // 1. Zone Definitions
    const ZONE_CONFIG = {
        bronze: { 
            name: "Bronze Meadows", pct: 25, icon: "🛡️", 
            desc: "The lush beginning. Green fields and ancient forests.",
            bannerGradient: "from-emerald-400 to-teal-600",
            cardBorder: "border-emerald-200",
            iconBg: "bg-emerald-100",
            barGradient: "from-emerald-400 to-teal-500",
            textColor: "text-emerald-600",
            lightBg: "bg-emerald-50"
        },
        silver: { 
            name: "Silver Peaks", pct: 50, icon: "🏆", 
            desc: "The frozen mountains. Only the brave cross the bridge.",
            bannerGradient: "from-cyan-400 to-blue-600",
            cardBorder: "border-cyan-200",
            iconBg: "bg-cyan-100",
            barGradient: "from-cyan-400 to-blue-500",
            textColor: "text-cyan-600",
            lightBg: "bg-cyan-50"
        },
        gold: { 
            name: "Golden Citadel", pct: 75, icon: "👑", 
            desc: "The royal desert city. Riches await within.",
            bannerGradient: "from-amber-300 to-orange-500",
            cardBorder: "border-amber-200",
            iconBg: "bg-amber-100",
            barGradient: "from-amber-300 to-orange-500",
            textColor: "text-amber-600",
            lightBg: "bg-amber-50"
        },
        diamond: { 
            name: "Crystal Realm", pct: 100, icon: "💎", 
            desc: "The floating void islands. The ultimate destination.",
            bannerGradient: "from-fuchsia-400 to-purple-600",
            cardBorder: "border-fuchsia-200",
            iconBg: "bg-fuchsia-100",
            barGradient: "from-fuchsia-400 to-purple-500",
            textColor: "text-fuchsia-600",
            lightBg: "bg-fuchsia-50"
        }
    };
    
    const config = ZONE_CONFIG[zoneType];
    const classes = state.get('allSchoolClasses').filter(c => c.questLevel === league);
    
    // --- CALCULATION LOGIC ---
    const BASE_GOAL = 18; 
    const SCALING_FACTOR = 2.5; 
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    let holidayDaysLost = 0;
    (state.get('schoolHolidayRanges') || []).forEach(range => {
        const start = new Date(range.start);
        const end = new Date(range.end);
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        const overlapStart = start > monthStart ? start : monthStart;
        const overlapEnd = end < monthEnd ? end : monthEnd;
        if (overlapStart <= overlapEnd) {
            holidayDaysLost += (Math.ceil(Math.abs(overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1);
        }
    });

    let monthModifier = (daysInMonth - holidayDaysLost) / daysInMonth;
    if (currentMonth === 5) monthModifier = 0.5;
    else monthModifier = Math.max(0.6, Math.min(1.0, monthModifier));

    const completed = [];
    const approaching = [];
    const far = [];

    const allStudentScores = state.get('allStudentScores') || [];

    classes.forEach(c => {
        const studentsInClass = state.get('allStudents').filter(s => s.classId === c.id);
        const studentCount = studentsInClass.length;
        
        let isCompletedThisMonth = false;
        if (c.questCompletedAt) {
            const completedDate = c.questCompletedAt.toDate();
            if (completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear) {
                isCompletedThisMonth = true;
            }
        }

        const dbDifficulty = c.difficultyLevel || 0;
        const effectiveDifficulty = isCompletedThisMonth ? Math.max(0, dbDifficulty - 1) : dbDifficulty;
        const adjustedGoalPerStudent = (BASE_GOAL + (effectiveDifficulty * SCALING_FACTOR)) * monthModifier;
        const diamondGoal = studentCount > 0 ? Math.round(studentCount * adjustedGoalPerStudent) : 18;

        const currentMonthlyStars = studentsInClass.reduce((sum, s) => {
            const scoreData = allStudentScores.find(sc => sc.id === s.id);
            return sum + (scoreData ? (Number(scoreData.monthlyStars) || 0) : 0);
        }, 0);

        const zoneTargetStars = (diamondGoal * (config.pct / 100));
        const remaining = Math.max(0, zoneTargetStars - currentMonthlyStars);
        
        let progressPct = diamondGoal > 0 ? (currentMonthlyStars / diamondGoal) * 100 : 0;
        if (isCompletedThisMonth && progressPct < 100) progressPct = 100;
        
        const info = { 
            name: c.name, 
            logo: c.logo, 
            progress: progressPct, 
            stars: currentMonthlyStars,
            remaining: remaining 
        };
        
        if (progressPct >= config.pct) completed.push(info);
        else if (progressPct >= (config.pct - 20)) approaching.push(info); 
        else far.push(info);
    });

    // --- NEW: SORT LISTS BY PROGRESS DESCENDING ---
    const sortDesc = (a, b) => {
        // Primary sort: Progress %
        if (b.progress !== a.progress) return b.progress - a.progress;
        // Secondary sort: Total Stars (Tie-breaker)
        return b.stars - a.stars;
    };
    
    completed.sort(sortDesc);
    approaching.sort(sortDesc);
    far.sort(sortDesc);

    const formatStarValue = (val) => {
        return val % 1 !== 0 ? val.toFixed(1) : val.toFixed(0);
    };

    // 5. Render
    const titleEl = document.getElementById('milestone-modal-title');
    const contentEl = document.getElementById('milestone-modal-content');
    
    titleEl.innerHTML = ``;
    titleEl.className = "hidden"; 

    const renderSection = (list, title, type) => {
        if (list.length === 0) return '';
        
        let icon = type === 'done' ? '✅' : (type === 'near' ? '🔥' : '🔭');
        let titleColor = type === 'done' ? 'text-green-600' : 'text-gray-500';
        
        return `
            <div class="mb-8 animate-fade-in">
                <div class="flex items-center gap-3 mb-4 pl-2">
                    <span class="text-2xl filter drop-shadow-sm">${icon}</span>
                    <h4 class="text-lg font-black ${titleColor} uppercase tracking-widest">${title}</h4>
                    <span class="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold shadow-inner">${list.length} Classes</span>
                </div>
                
                <div class="grid grid-cols-1 gap-4">
                    ${list.map(c => {
                        let badge;
                        let cardStyle = `bg-white border-4 ${config.cardBorder}`;
                        let glowEffect = "";
                        
                        const remainingFormatted = formatStarValue(c.remaining);

                        if (type === 'done') {
                            badge = `<div class="bg-gradient-to-r from-green-400 to-emerald-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md transform -rotate-2">Completed</div>`;
                            cardStyle = `bg-gradient-to-br from-white to-green-50 border-4 border-green-300`;
                            glowEffect = "shadow-[0_0_15px_rgba(34,197,94,0.3)]";
                        } else {
                            badge = `<div class="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-gray-200 shadow-sm"><span class="text-rose-500 mr-1">${remainingFormatted}</span> Stars Left</div>`;
                        }

                        const starsFormatted = formatStarValue(c.stars);
                        const barFill = Math.min(100, (c.progress / config.pct) * 100);

                        return `
                        <div class="group relative p-5 rounded-[2rem] ${cardStyle} ${glowEffect} shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                            <div class="absolute inset-0 opacity-[0.03]" style="background-image: radial-gradient(#000 1px, transparent 1px); background-size: 20px 20px;"></div>
                            
                            <div class="relative z-10 flex items-center gap-5">
                                <div class="w-16 h-16 rounded-2xl ${config.iconBg} flex items-center justify-center text-4xl shadow-inner transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500">
                                    ${c.logo}
                                </div>
                                
                                <div class="flex-grow min-w-0">
                                    <div class="flex justify-between items-center mb-2">
                                        <div class="font-title text-xl text-gray-800 truncate tracking-tight">${c.name}</div>
                                        ${badge}
                                    </div>
                                    
                                    <div class="h-6 bg-gray-100 rounded-full border border-gray-200 overflow-hidden relative shadow-inner">
                                        <div class="h-full bg-gradient-to-r ${config.barGradient} relative transition-all duration-1000" style="width: ${barFill}%">
                                            <div class="absolute inset-0 w-full h-full opacity-30" 
                                                 style="background-image: linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent); background-size: 1rem 1rem;">
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="flex justify-between mt-2 text-xs font-bold text-gray-400 uppercase tracking-wide">
                                        <span><i class="fas fa-star text-amber-400 mr-1"></i>${starsFormatted} Collected</span>
                                        <span class="${config.textColor}">${c.progress.toFixed(0)}% Overall</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
    };

    contentEl.innerHTML = `
        <div class="relative overflow-hidden p-8 rounded-[2.5rem] bg-gradient-to-br ${config.bannerGradient} shadow-2xl text-white mb-8 border-4 border-white ring-4 ring-${config.color}-100 transform transition-transform hover:scale-[1.01]">
            <div class="absolute -right-6 -bottom-6 text-9xl opacity-20 transform rotate-12 filter blur-sm pointer-events-none">${config.icon}</div>
            
            <div class="relative z-10">
                <div class="flex items-center gap-3 mb-2">
                     <span class="text-4xl filter drop-shadow-md animate-bounce-slow">${config.icon}</span>
                     <h3 class="font-title text-4xl text-shadow-md tracking-wide">${config.name}</h3>
                </div>
                <p class="text-lg font-medium opacity-90 italic max-w-lg leading-relaxed">"${config.desc}"</p>
                
                <div class="mt-6 inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-5 py-2 rounded-full border border-white/40 shadow-lg">
                    <i class="fas fa-flag text-yellow-300"></i> 
                    <span class="font-black uppercase tracking-wider text-xs">Requirement: ${config.pct}% Total Progress</span>
                </div>
            </div>
        </div>
        
        <div class="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar pb-8">
            ${renderSection(completed, "Conquered", 'done')}
            ${renderSection(approaching, "Approaching", 'near')}
            ${renderSection(far, "On the Way", 'far')}
        </div>
    `;

    import('./modals.js').then(m => m.showAnimatedModal('milestone-details-modal'));
}
