// /ui/modals.js

// --- IMPORTS ---
import { fetchLogsForDate, fetchAttendanceForMonth } from '../db/queries.js';
import { db } from '../firebase.js';
import { doc, getDocs, collection, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// State and Constants
import * as state from '../state.js';
import * as constants from '../constants.js';
import * as utils from '../utils.js';

// Actions and Effects
import { playSound } from '../audio.js';
import { callGeminiApi, callElevenLabsTtsApi } from '../api.js';
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
    handleDeleteTrial, // Keeping this as it still exists
    handleMoveStudent,
    handleMarkAbsent,
    handleAwardBonusStar,
    addOrUpdateHeroChronicleNote,
    deleteHeroChronicleNote
} from '../db/actions.js';

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
    
    document.getElementById('quest-event-date').value = dateString;

    renderScheduleManagerList(dateString);
    document.getElementById('quest-event-form').reset();
    renderQuestEventDetails();
    
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
        showAnimatedModal('logbook-modal'); 
        logs = await fetchLogsForDate(dateString);
    } else {
        logs = state.get('allAwardLogs').filter(log => utils.getDDMMYYYY(utils.parseDDMMYYYY(log.date)) === dateString);
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
                const teacherName = log.createdBy?.name || teacherNameMap[log.teacherId] || 'a teacher';
                const colorClass = reasonColors[log.reason] || 'text-gray-500';
                const noteHtml = log.note ? `<p class="text-xs text-gray-600 italic pl-4 border-l-2 border-gray-300 ml-1 mt-1">"${log.note}"</p>` : '';
                detailsHtml += `<div class="bg-gray-50 p-3 rounded-lg min-h-[50px] flex flex-col justify-center" id="log-entry-${log.id}">
                            <div class="flex justify-between items-center">
                                <div class="flex-grow">
                                    <span class="font-semibold">${student?.name || '?'}</span>
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
            detailsHtml += `</div></div>`;
        }
        contentEl.innerHTML = summaryHtml + detailsHtml;
    }
    
    if (!isOndemand) {
        showAnimatedModal('logbook-modal');
    }
}

export function openHistoryModal() {
    populateHistoryMonthSelector();
    renderHistoricalLeaderboard("");
    showAnimatedModal('history-modal');
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

export async function renderHistoricalLeaderboard(monthKey) {
    const contentEl = document.getElementById('history-modal-content');
    if (!monthKey) {
        contentEl.innerHTML = '<p class="text-center text-gray-500">Select a month to view historical rankings.</p>';
        return;
    }

    const league = state.get('globalSelectedLeague');
    if (!league) {
        contentEl.innerHTML = '<p class="text-center text-red-500">Please select a league on the main tab first.</p>';
        return;
    }

    await state.fetchMonthlyHistory(monthKey);
    const monthlyScores = state.get('allMonthlyHistory')[monthKey] || {};
    
    const GOAL_PER_STUDENT = { BRONZE: 4, SILVER: 8, GOLD: 13, DIAMOND: 18 };
    const classesInLeague = state.get('allSchoolClasses').filter(c => c.questLevel === league);
    
    const classScores = classesInLeague.map(c => {
        const studentsInClass = state.get('allStudents').filter(s => s.classId === c.id);
        const studentCount = studentsInClass.length;
        const diamondGoal = studentCount > 0 ? Math.round(studentCount * GOAL_PER_STUDENT.DIAMOND) : 18;
        const totalStars = studentsInClass.reduce((sum, s) => sum + (monthlyScores[s.id] || 0), 0);
        const progress = diamondGoal > 0 ? Math.min(100, (totalStars / diamondGoal) * 100).toFixed(1) : 0;
        
        let milestone = "None";
        if (totalStars >= (studentCount * GOAL_PER_STUDENT.DIAMOND)) milestone = "💎 Diamond";
        else if (totalStars >= (studentCount * GOAL_PER_STUDENT.GOLD)) milestone = "👑 Gold";
        else if (totalStars >= (studentCount * GOAL_PER_STUDENT.SILVER)) milestone = "🏆 Silver";
        else if (totalStars >= (studentCount * GOAL_PER_STUDENT.BRONZE)) milestone = "🛡️ Bronze";

        return { ...c, totalStars, progress, milestone };
    }).sort((a, b) => b.progress - a.progress || b.totalStars - a.totalStars);

    let html = `<h3 class="font-title text-2xl text-amber-700">Class Quest Map for ${new Date(monthKey + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</h3>`;
    if (classScores.length === 0 || classScores.every(c => c.totalStars === 0)) {
        html += `<p class="text-gray-600 mt-2">No Quest Map data was recorded for this league during ${monthKey}.</p>`;
    } else {
        html += `<div class="mt-2 space-y-2">`;
        classScores.forEach((c, index) => {
            html += `
                <div class="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border-l-4 border-amber-300">
                    <span class="font-bold text-lg">${index + 1}. ${c.logo} ${c.name}</span> 
                    <div class="text-right">
                        <span class="font-bold text-amber-600">${c.totalStars} ⭐ (${c.progress}%)</span>
                        <span class="block text-xs text-gray-500">Highest Milestone: ${c.milestone}</span>
                        </div>
                </div>`;
        });
        html += `</div>`;
    }

    html += `<h3 class="font-title text-2xl text-purple-700 mt-6">"Prodigy of the Month" Race for ${new Date(monthKey + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</h3>`;
    const studentsInLeague = state.get('allStudents')
        .filter(s => classesInLeague.some(c => c.id === s.classId))
        .map(s => ({ ...s, score: monthlyScores[s.id] || 0 }))
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score);

    if (studentsInLeague.length === 0) {
        html += `<p class="text-gray-600 mt-2">No students earned stars in this league during ${monthKey}.</p>`;
    } else {
        html += `<div class="mt-2 space-y-2">`;
        studentsInLeague.slice(0, 50).forEach((s, index) => {
            const classInfo = state.get('allSchoolClasses').find(c => c.id === s.classId);
            html += `
                <div class="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border-l-4 border-purple-300">
                    <span class="font-bold text-lg">${index + 1}. ${classInfo.logo} ${s.name}</span> 
                    <span class="font-bold text-purple-600">${s.score} ⭐</span>
                </div>`;
        });
         html += `</div>`;
    }
    
    contentEl.innerHTML = html;
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
    while (loopDate.getMonth() === currentMonth) {
        if (scheduledDaysOfWeek.includes(loopDate.getDay().toString())) {
            // Don't show future dates
            if (loopDate <= new Date()) {
                lessonDates.push(utils.getDDMMYYYY(loopDate));
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
            html += `<th class="p-3 font-semibold text-center border-b min-w-[60px]">${d.getDate()}</th>`;
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

    contentEl.querySelectorAll('.attendance-status-btn:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', (e) => toggleAttendanceRecord(e.currentTarget));
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

export function openEditStudentNameModal(studentId, currentName) {
    playSound('click');
    document.getElementById('edit-student-id-input').value = studentId;
    document.getElementById('edit-student-name-input').value = currentName;
    showAnimatedModal('edit-student-name-modal');
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
            previousAssignmentTextEl.innerHTML = `
                <span class="break-words pr-2">${lastAssignment.text}</span>
                <button id="edit-last-assignment-btn" class="mt-2 text-sm text-blue-500 hover:underline font-semibold">
                    <i class="fas fa-pencil-alt mr-1"></i>Edit This Assignment
                </button>
            `;
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

export function showStarfallModal(studentId, studentName, bonusAmount, trialType) {
    playSound('magic_chime');

    document.getElementById('starfall-student-name').innerText = studentName;
    const confirmBtn = document.getElementById('starfall-confirm-btn');
    const modal = document.getElementById('starfall-modal');

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        handleAwardBonusStar(studentId, bonusAmount, trialType); 
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
    const classScores = classesInLeague.map(c => {
        const studentsInClass = state.get('allStudents').filter(s => s.classId === c.id);
        const studentCount = studentsInClass.length;
        const diamondGoal = studentCount > 0 ? Math.round(studentCount * GOAL_PER_STUDENT.DIAMOND) : 18;
        const totalStars = studentsInClass.reduce((sum, s) => sum + (state.get('allStudentScores').find(score => score.id === s.id)?.monthlyStars || 0), 0);
        const progress = diamondGoal > 0 ? Math.min(100, (totalStars / diamondGoal) * 100).toFixed(1) : 0;
        return { name: c.name, totalStars, progress };
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
        playBtn.classList.remove('hidden');
        playBtn.disabled = false;
        playBtn.innerHTML = `<i class="fas fa-play-circle mr-3"></i> Play Narrative`;

    } catch (error) {
        console.error("Quest Update Narrative Error:", error);
        narrativeContainer.innerHTML = `<p class="text-xl text-center text-red-500">The Quest Announcer is taking a break. Please try again in a moment!</p>`;
    }
}

// --- RESTORED IDEA FORGE FUNCTIONS ---

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

export function openMilestoneModal(markerElement) {
    const questCard = markerElement.closest('.quest-card');
    const classId = questCard.dataset.classId;
    const classInfo = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classInfo) return;

    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    const studentCount = studentsInClass.length;
    const currentMonthlyStars = studentsInClass.reduce((sum, s) => {
        const scoreData = state.get('allStudentScores').find(score => score.id === s.id);
        return sum + (scoreData?.monthlyStars || 0);
    }, 0);

    const GOAL_PER_STUDENT = { BRONZE: 4, SILVER: 8, GOLD: 13, DIAMOND: 18 };
    const goals = {
        bronze: Math.round(studentCount * GOAL_PER_STUDENT.BRONZE),
        silver: Math.round(studentCount * GOAL_PER_STUDENT.SILVER),
        gold: Math.round(studentCount * GOAL_PER_STUDENT.GOLD),
        diamond: studentCount > 0 ? Math.round(studentCount * GOAL_PER_STUDENT.DIAMOND) : 18
    };

    const modalTitle = document.getElementById('milestone-modal-title');
    const modalContent = document.getElementById('milestone-modal-content');
    
    let milestoneName, goal, icon;
    if (markerElement.innerText.includes('🛡️')) { milestoneName = "Bronze Shield"; goal = goals.bronze; icon = '🛡️'; } 
    else if (markerElement.innerText.includes('🏆')) { milestoneName = "Silver Trophy"; goal = goals.silver; icon = '🏆'; }
    else if (markerElement.innerText.includes('👑')) { milestoneName = "Golden Crown"; goal = goals.gold; icon = '👑'; } 
    else { milestoneName = "Diamond Quest"; goal = goals.diamond; icon = '💎'; }

    const now = new Date();
    const currentMonthIndex = now.getMonth();
    const currentYear = now.getFullYear();

    const relevantLogs = state.get('allAwardLogs').filter(log => {
        if (log.classId !== classId) return false;
        const logDate = utils.parseDDMMYYYY(log.date); 
        return logDate.getMonth() === currentMonthIndex && logDate.getFullYear() === currentYear;
    });

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const startOfWeek = new Date(today.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklyStars = relevantLogs
    .filter(log => utils.parseDDMMYYYY(log.date) >= startOfWeek)
    .reduce((sum, log) => sum + log.stars, 0);

    const reasonCounts = relevantLogs.reduce((acc, log) => {
        acc[log.reason || 'other'] = (acc[log.reason || 'other'] || 0) + log.stars;
        return acc;
    }, {});
    const topReasonEntry = Object.entries(reasonCounts).sort((a,b) => b[1] - a[1])[0];
    const topReason = topReasonEntry ? `${topReasonEntry[0].charAt(0).toUpperCase() + topReasonEntry[0].slice(1)}` : "N/A";

    const studentScores = studentsInClass.map(s => {
        const score = state.get('allStudentScores').find(sc => sc.id === s.id)?.monthlyStars || 0;
        return { name: s.name, score };
    }).filter(s => s.score > 0);
    
    let topAdventurers = "None yet this month!";
    if(studentScores.length > 0) {
        const topStudents = studentScores.sort((a, b) => b.score - a.score).slice(0, 5).map(s => `${s.name} (${s.score}⭐)`);
        topAdventurers = topStudents.join(', ');
    }
    
    modalTitle.innerHTML = `${icon} ${milestoneName}`;
    const starsNeeded = Math.max(0, goal - currentMonthlyStars);
    const progressPercent = goal > 0 ? Math.min(100, (currentMonthlyStars / goal) * 100).toFixed(1) : 0;

    modalContent.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div class="text-center">
                <h3 class="font-title text-4xl text-gray-800">${classInfo.logo} ${classInfo.name}</h3>
                <p class="text-lg text-gray-600 -mt-2">Progress towards the ${milestoneName}</p>
                
                <div class="text-2xl my-4">
                    <p><span class="font-bold text-amber-500 text-5xl">${currentMonthlyStars}</span> / <span class="font-bold text-3xl text-gray-500">${goal}</span></p>
                    <p class="text-sm text-gray-500 -mt-1">Total Stars Collected</p>
                    <div class="w-full bg-gray-200 rounded-full h-6 shadow-inner mt-2 border-2 border-gray-300">
                        <div class="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full flex items-center justify-center text-white font-bold text-sm" style="width: ${progressPercent}%">
                            ${progressPercent > 10 ? `${progressPercent}%` : ''}
                        </div>
                    </div>
                </div>
                
                ${starsNeeded > 0 
                    ? `<p class="mt-4 text-blue-600 font-bold text-3xl animate-pulse">${starsNeeded} more stars to go!</p>` 
                    : `<p class="mt-4 text-green-600 font-bold text-3xl title-sparkle">Milestone Achieved! Well done!</p>`
                }
            </div>
            <div class="text-left bg-gray-50 p-6 rounded-2xl border-2 border-gray-200 space-y-4">
                 <div class="bg-white p-3 rounded-lg shadow-sm">
                    <p class="text-sm text-gray-500 flex items-center gap-1"><i class="fas fa-bolt text-yellow-500"></i> Weekly Momentum (Since Monday)</p>
                    <p class="font-bold text-2xl text-yellow-600">${weeklyStars} stars</p>
                </div>
                <div class="bg-white p-3 rounded-lg shadow-sm">
                    <p class="text-sm text-gray-500 flex items-center gap-1"><i class="fas fa-award text-green-500"></i> Top Skill This Month</p>
                    <p class="font-bold text-2xl text-green-600">${topReason}</p>
                </div>
                <div class="bg-white p-3 rounded-lg shadow-sm">
                    <p class="text-sm text-gray-500 flex items-center gap-1"><i class="fas fa-crown text-purple-500"></i> Top Adventurers (Monthly)</p>
                    <p class="font-semibold text-lg text-purple-600" title="${topAdventurers}">${topAdventurers}</p>
                </div>
            </div>
        </div>
    `;
    
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

export async function handleGenerateReport(classId) {
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
export function openOverviewModal(classId) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classData) return;

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
    nameEl.textContent = student.name;
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
                <span>${note.createdAt.toDate().toLocaleDateString('en-GB')}</span>
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
        .sort((a, b) => a.createdAt.toDate() - b.createdAt.toDate())
        .map(n => `[${n.createdAt.toDate().toLocaleDateString('en-GB')} - ${n.category}] ${n.noteText}`)
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
