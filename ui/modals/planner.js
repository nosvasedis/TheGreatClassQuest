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
