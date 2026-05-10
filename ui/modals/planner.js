// /ui/modals/planner.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { showAnimatedModal, setCurrentlySelectedDayCell, getCurrentlySelectedDayCell } from './base.js';
import { handleCancelLesson } from '../../db/actions.js';

// --- MAIN FEATURE MODALS ---

export function openDayPlannerModal(dateString, dayCell) {
    const prev = getCurrentlySelectedDayCell();
    if (prev) {
        prev.classList.remove('day-selected');
    }
    setCurrentlySelectedDayCell(dayCell);
    dayCell.classList.add('day-selected');

    const modal = document.getElementById('day-planner-modal');
    const displayDate = utils.parseDDMMYYYY(dateString).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
    document.getElementById('day-planner-title').innerText = `Planner: ${displayDate}`;
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
        // Premium tab styling
        btn.classList.toggle('bg-white', isSelected);
        btn.classList.toggle('shadow-sm', isSelected);
        btn.classList.toggle('text-indigo-600', isSelected);
        btn.classList.toggle('text-gray-500', !isSelected);
        btn.classList.toggle('hover:text-gray-700', !isSelected);
    });
    document.querySelectorAll('.day-planner-tab-content').forEach(content => {
        content.classList.add('hidden');
        content.classList.remove('animate-fade-in');
    });
    const activeContent = document.getElementById(`day-planner-${tabName}-content`);
    activeContent.classList.remove('hidden');
    activeContent.classList.add('animate-fade-in');
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
        listEl.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 px-4 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm">
                    <i class="fas fa-calendar-times text-2xl text-gray-300"></i>
                </div>
                <p class="text-gray-500 font-semibold">The hall is quiet.</p>
                <p class="text-gray-400 text-sm mt-1">No lessons scheduled for this day.</p>
            </div>`;
    } else {
        listEl.innerHTML = classesOnDay.map(c => {
            const isMine = allTeacherClassIds.includes(c.id);
            const timeDisplay = (c.timeStart && c.timeEnd) ? `${c.timeStart} - ${c.timeEnd}` : 'No time set';
            const cancelButton = isMine
                ? `<button class="cancel-lesson-btn bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-2 px-4 rounded-xl shadow-sm border border-rose-100 transition-all hover:scale-105 active:scale-95 flex items-center gap-2" data-class-id="${c.id}">
                    <i class="fas fa-calendar-minus"></i> Cancel
                   </button>`
                : `<div class="bg-gray-100/80 px-3 py-1.5 rounded-lg border border-gray-200/50 text-[10px] font-black uppercase tracking-widest text-gray-400">By ${c.createdBy.name}</div>`;
            
            return `
                <div class="flex items-center justify-between bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md group">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                            ${c.logo}
                        </div>
                        <div>
                            <h4 class="font-title text-lg text-gray-800 leading-tight">${c.name}</h4>
                            <p class="text-xs font-bold text-gray-400 mt-0.5 flex items-center gap-1.5"><i class="fas fa-clock text-[10px]"></i> ${timeDisplay}</p>
                        </div>
                    </div>
                    ${cancelButton}
                </div>`;
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
