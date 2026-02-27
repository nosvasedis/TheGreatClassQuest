// /ui/core/misc.js

import * as state from '../../state.js';
import { db } from '../../firebase.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import * as utils from '../../utils.js';
import { showToast } from '../effects.js';
import { renderClassLeaderboardTab, renderStudentLeaderboardTab } from '../tabs.js';
import * as storyWeaver from '../../features/storyWeaver.js';
import { playSound } from '../../audio.js';

// --- GLOBAL STATE SYNC FUNCTIONS ---
export function findAndSetCurrentClass(targetSelectId = null) {
    if (state.get('globalSelectedClassId')) return;

    const todayString = utils.getTodayDateString();
    const classesToday = utils.getClassesOnDay(todayString, state.get('allSchoolClasses'), state.get('allScheduleOverrides'));
    
    // FIX: Only consider classes that belong to the current teacher
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
    const currentTime = now.toTimeString().slice(0, 5);
    const todayString = utils.getTodayDateString();
    // Use getClassesOnDay so cancelled/overridden classes are respected
    const classesToday = utils.getClassesOnDay(todayString, state.get('allSchoolClasses'), state.get('allScheduleOverrides'));
    const myClassesToday = classesToday.filter(c => state.get('allTeachersClasses').some(tc => tc.id === c.id));

    for (const c of myClassesToday) {
        if (c.timeStart && c.timeEnd && currentTime >= c.timeStart && currentTime <= c.timeEnd) {
            state.setGlobalSelectedLeague(c.questLevel, false);
            if (shouldRender) {
                renderClassLeaderboardTab();
                renderStudentLeaderboardTab();
            }
            return;
        }
    }
}

export function updateStudentCardAttendanceState(studentId, isAbsent) {
    const studentCard = document.querySelector(`.student-cloud-card[data-studentid="${studentId}"]`);
    if (!studentCard) return;
    studentCard.classList.toggle('is-absent', isAbsent);
    const controlsDiv = studentCard.querySelector('.absence-controls');
    if (!controlsDiv) return;
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;
    const studentClass = state.get('allSchoolClasses').find(c => c.id === student.classId);
    const isLessonToday = (studentClass?.scheduleDays || []).includes(new Date().getDay().toString());
    const welcomeBackVisible = isAbsent && isLessonToday;
    if (isAbsent) {
        controlsDiv.innerHTML = `
            <button class="absence-btn bg-green-200 text-green-700 hover:bg-green-300" data-action="mark-present" title="Mark as Present">
                <i class="fas fa-user-check pointer-events-none"></i>
            </button>
            <button class="welcome-back-btn ${welcomeBackVisible ? '' : 'hidden'}" data-action="welcome-back" title="Welcome Back Bonus!">
                <i class="fas fa-hand-sparkles pointer-events-none"></i>
            </button>
        `;
    } else {
        controlsDiv.innerHTML = `
            <button class="absence-btn" data-action="mark-absent" title="Mark as Absent">
                <i class="fas fa-user-slash pointer-events-none"></i>
            </button>
        `;
    }
}

export function confirmWord() {
    const input = document.getElementById('story-weavers-word-input');
    const word = input.value.trim();
    if (word) {
        state.set('storyWeaverLockedWord', word);
        input.classList.add('bg-green-100', 'border-green-400', 'font-bold');
        document.getElementById('story-weavers-suggest-word-btn').disabled = true;
        document.getElementById('story-weavers-lock-in-btn').disabled = false;
        document.getElementById('story-weavers-end-btn').disabled = false;
        storyWeaver.hideWordEditorControls(true);
        playSound('confirm');
    }
}

export function handleWordInputChange(event) {
    if (event.target.value.trim() !== '') {
        storyWeaver.showWordEditorControls();
    } else {
        storyWeaver.hideWordEditorControls();
    }
}

export function renderHolidayList() {
    const list = document.getElementById('holiday-list');
    if (!list) return;
    const ranges = state.get('schoolHolidayRanges') || [];
    
    if (ranges.length === 0) {
        list.innerHTML = '<p class="text-center text-xs text-gray-400">No holidays set.</p>';
        return;
    }
    
    list.innerHTML = ranges.map(r => `
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded border text-sm">
            <div>
                <span class="font-bold text-gray-700">${r.name}</span>
                <div class="text-xs text-gray-500">${utils.parseDDMMYYYY(utils.getDDMMYYYY(new Date(r.start))).toLocaleDateString('en-GB', {day:'numeric', month:'short'})} - ${utils.parseDDMMYYYY(utils.getDDMMYYYY(new Date(r.end))).toLocaleDateString('en-GB', {day:'numeric', month:'short'})}</div>
            </div>
            <button class="delete-holiday-btn text-red-500 hover:text-red-700" data-id="${r.id}"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}

// --- CLASS END DATES CONFIGURATION ---

export function renderClassEndDatesList() {
    const list = document.getElementById('class-end-dates-list');
    if (!list) return;
    
    const myClasses = state.get('allTeachersClasses') || [];
    const teacherSettings = state.get('teacherSettings') || {};
    const classEndDates = teacherSettings.schoolYearSettings?.classEndDates || {};
    
    if (myClasses.length === 0) {
        list.innerHTML = '<p class="text-center text-xs text-gray-400">No classes found.</p>';
        return;
    }
    
    list.innerHTML = myClasses.map(cls => {
        const schedule = (cls.scheduleDays || []).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
        const currentEndDate = classEndDates[cls.id] || '';
        const suggestedDate = calculateSuggestedEndDate(cls.scheduleDays || []);
        
        return `
            <div class="bg-gray-50 p-3 rounded border">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <div class="font-bold text-gray-700">${cls.name}</div>
                        <div class="text-xs text-gray-500">Schedule: ${schedule}</div>
                        <div class="text-xs text-purple-600">Suggested: ${suggestedDate}</div>
                    </div>
                    <div class="text-2xl">${cls.logo}</div>
                </div>
                <div class="flex items-center gap-2">
                    <input type="date" 
                        id="class-end-date-${cls.id}" 
                        class="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        value="${currentEndDate}"
                        min="2025-09-01"
                        max="2026-06-30">
                    <button type="button" 
                        class="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded"
                        onclick="document.getElementById('class-end-date-${cls.id}').value = '${suggestedDate}'">
                        Use Suggested
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Calculate suggested end date for a class based on schedule
 */
function calculateSuggestedEndDate(scheduleDays) {
    const targetMonth = 5; // June (0-indexed)
    const targetYear = 2026;
    const lastDay = new Date(targetYear, targetMonth + 1, 0); // Last day of June
    const scheduleDaysArray = scheduleDays.map(Number).sort();
    
    // Work backwards from last day of month to find last scheduled day
    for (let d = lastDay.getDate(); d >= 1; d--) {
        const checkDate = new Date(targetYear, targetMonth, d);
        const dayOfWeek = checkDate.getDay().toString();
        
        if (scheduleDaysArray.includes(dayOfWeek)) {
            return checkDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        }
    }
    
    return lastDay.toISOString().split('T')[0]; // Fallback to last day of June
}

/**
 * Save class end dates to teacher settings
 */
export async function saveClassEndDates() {
    const myClasses = state.get('allTeachersClasses') || [];
    const teacherId = state.get('currentUserId');
    
    if (!teacherId) {
        showToast('Error: Teacher not found', 'error');
        return;
    }
    
    const classEndDates = {};
    
    // Collect all end dates from the form
    myClasses.forEach(cls => {
        const input = document.getElementById(`class-end-date-${cls.id}`);
        if (input && input.value) {
            classEndDates[cls.id] = input.value;
        }
    });
    
    try {
        // Update teacher profile with class end dates
        const teacherRef = doc(db, 'artifacts/great-class-quest/public/data/teachers', teacherId);
        await updateDoc(teacherRef, {
            'schoolYearSettings.classEndDates': classEndDates
        });
        
        // Update local state
        const currentSettings = state.get('teacherSettings') || {};
        const updatedSettings = {
            ...currentSettings,
            schoolYearSettings: {
                ...currentSettings.schoolYearSettings,
                classEndDates
            }
        };
        state.setTeacherSettings(updatedSettings);
        
        // Update ceremony buttons
        const { updateCeremonyButtons } = await import('../../features/grandGuildCeremony.js');
        updateCeremonyButtons();
        
        showToast('Class end dates saved successfully!', 'success');
        
    } catch (error) {
        console.error('Error saving class end dates:', error);
        showToast('Error saving class end dates', 'error');
    }
}

// --- BOUNTY LOGIC ---

export function renderActiveBounties() {
    const container = document.getElementById('bounty-board-container');
    if (!container) return;

    const classId = state.get('globalSelectedClassId');
    if (!classId) {
        container.innerHTML = '';
        return;
    }

    const bounties = state.get('allQuestBounties')
        .filter(b => b.classId === classId && b.status !== 'completed') // Hide completed ones to keep board clean
        .sort((a,b) => new Date(a.deadline) - new Date(b.deadline));

    if (bounties.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = bounties.map(b => {
        const isTimer = b.type === 'timer';
        const now = new Date();
        const deadline = new Date(b.deadline);
        
        // --- TIMER RENDER ---
        if (isTimer) {
            return `
            <div class="bounty-card mb-3 bg-gradient-to-r from-red-50 to-white border-l-4 border-red-500 shadow-sm p-4 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="bg-red-100 text-red-600 w-12 h-12 rounded-full flex items-center justify-center text-2xl animate-pulse">
                        <i class="fas fa-hourglass-half"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-lg text-gray-800">${b.title}</h4>
                        <span class="bounty-timer text-3xl font-title text-red-600 leading-none" data-deadline="${b.deadline}">Loading...</span>
                    </div>
                </div>
                <button class="delete-bounty-btn text-gray-300 hover:text-red-500 transition-colors" data-id="${b.id}" title="Cancel Timer"><i class="fas fa-times"></i></button>
            </div>`;
        }

        // --- STANDARD STAR RENDER ---
        const progressPercent = Math.min(100, (b.currentProgress / b.target) * 100);
        const isReady = b.currentProgress >= b.target;
        let actionBtn = isReady 
            ? `<button class="claim-bounty-btn bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-bounce shadow-md" data-id="${b.id}" data-reward="${b.reward}">CLAIM</button>`
            : `<span class="text-xs font-bold text-amber-500">${b.currentProgress}/${b.target} ⭐</span>`;

        return `
            <div class="bounty-card mb-3 bg-gradient-to-r from-amber-50 to-white border-l-4 border-amber-400 shadow-sm p-3 flex items-center gap-3">
                <div class="text-2xl text-amber-500">🎯</div>
                <div class="flex-grow min-w-0">
                    <div class="flex justify-between items-center mb-1">
                        <h4 class="font-bold text-gray-800 truncate">${b.title}</h4>
                        ${actionBtn}
                    </div>
                    <div class="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div class="bg-amber-500 h-full transition-all duration-1000" style="width: ${progressPercent}%"></div>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">Reward: ${b.reward}</p>
                </div>
                <button class="delete-bounty-btn text-gray-300 hover:text-red-500" data-id="${b.id}"><i class="fas fa-times"></i></button>
            </div>
        `;
    }).join('');
    
    startBountyTimer(); // Ensure the interval runs
}

let bountyInterval;
function startBountyTimer() {
    if (bountyInterval) clearInterval(bountyInterval);
    
    const update = () => {
        const timers = document.querySelectorAll('.bounty-timer');
        if (timers.length === 0) { clearInterval(bountyInterval); return; }

        timers.forEach(el => {
            const deadline = new Date(el.dataset.deadline);
            const now = new Date();
            const diff = deadline - now;

            if (diff <= 0) {
                el.innerText = "00:00:00";
                el.classList.add('text-red-500');
                // Could trigger a reload here to mark visually as expired
            } else {
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                el.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
            }
        });
    };
    
    update();
    bountyInterval = setInterval(update, 1000);
}
