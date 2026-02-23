// /ui/tabs/classes.js
import * as state from '../../state.js';
import * as modals from '../modals.js';
import { deleteClass, deleteStudent } from '../../db/actions.js';
import { showTab } from './navigation.js';
import * as avatar from '../../features/avatar.js';
import { getGuildBadgeHtml, getGuildById } from '../../features/guilds.js';

export function renderManageClassesTab() {
    const list = document.getElementById('class-list');
    if (!list) return;
    if (state.get('allTeachersClasses').length === 0) {
        list.innerHTML = `<p class="text-center text-gray-700 bg-white/50 p-4 rounded-2xl text-lg">You haven't created any classes yet. Add one above!</p>`;
        return;
    }
    list.innerHTML = state.get('allTeachersClasses').sort((a, b) => a.name.localeCompare(b.name)).map(c => {
        const schedule = (c.scheduleDays || []).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
        const time = (c.timeStart && c.timeEnd) ? `${c.timeStart} - ${c.timeEnd}` : 'No time set';
        return `
            <div class="bg-white p-4 rounded-2xl shadow-lg border-2 border-gray-100 transform transition hover:shadow-xl hover:scale-[1.02]">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h3 class="font-bold text-2xl text-gray-800">${c.logo || '📚'} ${c.name}</h3>
                        <p class="text-sm text-green-700 font-semibold">${c.questLevel || 'Uncategorized'}</p>
                        <p class="text-sm text-gray-500"><i class="fas fa-calendar-day mr-1"></i> ${schedule || 'No days set'}</p>
                        <p class="text-sm text-gray-500"><i class="fas fa-clock mr-1"></i> ${time}</p>
                    </div>
                    <div class="flex flex-col sm:flex-row gap-2">
                        <button data-id="${c.id}" class="report-class-btn bg-green-100 text-green-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-magic mr-0 sm:mr-2"></i><span class="hidden sm:inline">Report</span></button>
                        <button data-id="${c.id}" class="overview-class-btn bg-purple-100 text-purple-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-chart-line mr-0 sm:mr-2"></i><span class="hidden sm:inline">Overview</span></button>
                        <button data-id="${c.id}" class="edit-class-btn bg-cyan-100 text-cyan-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-pencil-alt mr-0 sm:mr-2"></i><span class="hidden sm:inline">Edit</span></button>
                        <button data-id="${c.id}" data-name="${c.name.replace(/'/g, "\\'")}" class="manage-students-btn bg-teal-100 text-teal-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-users mr-0 sm:mr-2"></i><span class="hidden sm:inline">Students</span></button>
                        <button data-id="${c.id}" class="delete-class-btn bg-red-100 text-red-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-trash-alt mr-0 sm:mr-2"></i><span class="hidden sm:inline">Delete</span></button>
                    </div>
                </div>
            </div>`;
    }).join('');

    list.querySelectorAll('.manage-students-btn').forEach(btn => btn.addEventListener('click', () => {
        state.set('currentManagingClassId', btn.dataset.id);
        document.getElementById('manage-class-name').innerText = btn.dataset.name;
        document.getElementById('manage-class-id').value = btn.dataset.id;
        showTab('manage-students-tab');
    }));
    list.querySelectorAll('.delete-class-btn').forEach(btn => btn.addEventListener('click', () => modals.showModal('Delete Class?', 'Are you sure you want to delete this class and all its students? This cannot be undone.', () => deleteClass(btn.dataset.id))));
    list.querySelectorAll('.edit-class-btn').forEach(btn => btn.addEventListener('click', () => modals.openEditClassModal(btn.dataset.id)));
    list.querySelectorAll('.report-class-btn').forEach(btn => btn.addEventListener('click', () => modals.handleGenerateReport(btn.dataset.id)));
    list.querySelectorAll('.overview-class-btn').forEach(btn => btn.addEventListener('click', () => modals.openOverviewModal(btn.dataset.id)));
}

export function renderManageStudentsTab() {
    const list = document.getElementById('student-list');
    const currentManagingClassId = state.get('currentManagingClassId');
    if (!list || !currentManagingClassId) return;
    const studentsInClass = state.get('allStudents').filter(s => s.classId === currentManagingClassId).sort((a, b) => a.name.localeCompare(b.name));
    if (studentsInClass.length === 0) {
        list.innerHTML = `<p class="text-sm text-center text-gray-500">No students in this class yet. Add one!</p>`;
        return;
    }
    list.innerHTML = studentsInClass.map(s => {
        const avatarHtml = s.avatar
            ? `<img src="${s.avatar}" alt="${s.name}" data-student-id="${s.id}" class="student-avatar large-avatar enlargeable-avatar cursor-pointer">`
            : `<div data-student-id="${s.id}" class="student-avatar large-avatar enlargeable-avatar cursor-pointer flex items-center justify-center bg-gray-300 text-gray-600 font-bold">${s.name.charAt(0)}</div>`;
        const guildBadgeOrQuiz = s.guildId
            ? getGuildBadgeHtml(s.guildId, 'w-8 h-8')
            : `<button data-id="${s.id}" class="guild-quiz-btn bg-amber-100 text-amber-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Guild Quiz"><i class="fas fa-hat-wizard text-xs"></i></button>`;
        const guildBorder = s.guildId ? 'border-l-4' : '';
        const borderStyle = s.guildId && getGuildById(s.guildId) ? `style="border-left-color: ${getGuildById(s.guildId).primary}"` : '';

        return `
        <div class="flex items-center justify-between bg-gray-50 p-2 rounded-lg ${guildBorder}" ${borderStyle}>
            <div class="flex items-center gap-3">
                ${avatarHtml}
                <span class="font-medium text-gray-700">${s.name}</span>
            </div>
            <div class="flex items-center gap-2">
                ${s.guildId ? `<span class="guild-badge-wrap flex-shrink-0">${guildBadgeOrQuiz}</span>` : guildBadgeOrQuiz}
                <button data-id="${s.id}" class="move-student-btn bg-yellow-100 text-yellow-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Move Student"><i class="fas fa-people-arrows text-xs"></i></button>
                <button data-id="${s.id}" class="hero-chronicle-btn bg-green-100 text-green-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Hero's Chronicle"><i class="fas fa-book-reader text-xs"></i></button>
                <button data-id="${s.id}" class="avatar-maker-btn font-bold w-8 h-8 rounded-full bubbly-button" title="Create/Edit Avatar"><i class="fas fa-user-astronaut text-xs"></i></button>
                <button data-id="${s.id}" class="certificate-student-btn bg-indigo-100 text-indigo-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Generate Certificate"><i class="fas fa-award text-xs"></i></button>
                <button data-id="${s.id}" class="edit-student-btn bg-cyan-100 text-cyan-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Edit Student Details"><i class="fas fa-pencil-alt text-xs"></i></button>
                <button data-id="${s.id}" class="delete-student-btn bg-red-100 text-red-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Delete Student"><i class="fas fa-trash-alt text-xs"></i></button>
            </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.delete-student-btn').forEach(btn => btn.addEventListener('click', () => modals.showModal('Delete Student?', 'Are you sure you want to delete this student?', () => deleteStudent(btn.dataset.id))));
    list.querySelectorAll('.certificate-student-btn').forEach(btn => btn.addEventListener('click', () => modals.handleGenerateCertificate(btn.dataset.id)));
    list.querySelectorAll('.edit-student-btn').forEach(btn => btn.addEventListener('click', () => modals.openEditStudentModal(btn.dataset.id)));
    list.querySelectorAll('.avatar-maker-btn').forEach(btn => btn.addEventListener('click', () => avatar.openAvatarMaker(btn.dataset.id)));
    list.querySelectorAll('.move-student-btn').forEach(btn => btn.addEventListener('click', () => modals.openMoveStudentModal(btn.dataset.id)));
    list.querySelectorAll('.hero-chronicle-btn').forEach(btn => btn.addEventListener('click', () => modals.openHeroChronicleModal(btn.dataset.id)));
    list.querySelectorAll('.guild-quiz-btn').forEach(btn => btn.addEventListener('click', () => modals.openSortingQuizModal(btn.dataset.id)));
}
