// /ui/tabs/classes.js
import * as state from '../../state.js';
import * as modals from '../modals.js';
import { deleteClass, deleteStudent } from '../../db/actions.js';
import { showTab } from './navigation.js';
import * as avatar from '../../features/avatar.js';
import { wrapAvatarWithLevelUpIndicator } from '../core/avatar.js';
import { getGuildBadgeHtml, getGuildById } from '../../features/guilds.js';
import { openSkillTreeModal } from '../modals/skillTree.js';

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

    const studentsInClass = state.get('allStudents')
        .filter(s => s.classId === currentManagingClassId)
        .sort((a, b) => a.name.localeCompare(b.name));

    // Update header count badge
    const countBadge = document.getElementById('student-count-badge');
    const countNumber = document.getElementById('student-count-number');
    if (countBadge && countNumber) {
        countNumber.textContent = studentsInClass.length;
        countBadge.classList.toggle('hidden', studentsInClass.length === 0);
    }

    if (studentsInClass.length === 0) {
        list.innerHTML = `
            <div class="text-center py-14 px-6">
                <div class="text-gray-200 text-6xl mb-4"><i class="fas fa-users"></i></div>
                <p class="text-gray-500 font-semibold text-lg">No adventurers yet!</p>
                <p class="text-gray-400 text-sm mt-1">Add your first student using the form to start the quest.</p>
            </div>`;
        return;
    }

    const heroClassConfig = {
        'Guardian':  { icon: '🛡️', bg: '#f3e8ff', text: '#7e22ce', ring: '#a855f7' },
        'Sage':      { icon: '🔮', bg: '#ede9fe', text: '#6d28d9', ring: '#8b5cf6' },
        'Paladin':   { icon: '⚔️', bg: '#fee2e2', text: '#991b1b', ring: '#ef4444' },
        'Artificer': { icon: '⚙️', bg: '#ffedd5', text: '#9a3412', ring: '#f97316' },
        'Scholar':   { icon: '📜', bg: '#fef3c7', text: '#92400e', ring: '#f59e0b' },
        'Weaver':    { icon: '✒️', bg: '#d1fae5', text: '#065f46', ring: '#10b981' },
        'Nomad':     { icon: '👟', bg: '#e0f2fe', text: '#075985', ring: '#0ea5e9' },
    };

    list.innerHTML = studentsInClass.map(s => {
        const scoreData = state.get('allStudentScores').find(sc => sc.id === s.id);
        const pendingSkill = scoreData?.pendingSkillChoice || false;
        const hc = s.heroClass ? (heroClassConfig[s.heroClass] || null) : null;

        const ringStyle = hc
            ? `box-shadow: 0 0 0 2px white, 0 0 0 4px ${hc.ring};`
            : 'box-shadow: 0 0 0 2px white, 0 0 0 4px #d1d5db;';

        const avatarInner = s.avatar
            ? `<img src="${s.avatar}" alt="${s.name}" data-student-id="${s.id}"
                class="student-avatar large-avatar enlargeable-avatar cursor-pointer"
                style="${ringStyle}">`
            : `<div data-student-id="${s.id}"
                class="student-avatar large-avatar enlargeable-avatar cursor-pointer flex items-center justify-center font-title text-white"
                style="font-size:1.25rem; background: linear-gradient(135deg, #2dd4bf, #06b6d4); ${ringStyle}">${s.name.charAt(0).toUpperCase()}</div>`;
        const avatarHtml = wrapAvatarWithLevelUpIndicator(avatarInner, pendingSkill);

        const heroClassBadge = hc
            ? `<span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style="background:${hc.bg};color:${hc.text};">${hc.icon} ${s.heroClass}</span>`
            : `<span class="text-[11px] text-gray-400 italic">No class</span>`;

        const guildAction = s.guildId
            ? `<span class="guild-badge-wrap flex-shrink-0">${getGuildBadgeHtml(s.guildId, 'w-7 h-7')}</span>`
            : `<button data-id="${s.id}" class="guild-quiz-btn w-7 h-7 flex items-center justify-center bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-full bubbly-button transition-colors" title="Take Guild Quiz"><i class="fas fa-hat-wizard" style="font-size:10px;"></i></button>`;

        const skillTreeBtnCls = pendingSkill
            ? 'skill-tree-btn w-7 h-7 flex items-center justify-center bg-purple-500 hover:bg-purple-600 text-white rounded-full bubbly-button animate-pulse ring-2 ring-purple-300 transition-colors'
            : 'skill-tree-btn w-7 h-7 flex items-center justify-center bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-full bubbly-button transition-colors';

        const guildBorderStyle = s.guildId && getGuildById(s.guildId)
            ? `border-left: 3px solid ${getGuildById(s.guildId).primary};`
            : '';

        return `
        <div class="flex items-center gap-3 px-4 py-3 hover:bg-teal-50/50 transition-colors" style="${guildBorderStyle}">
            <div class="flex-shrink-0">${avatarHtml}</div>
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-800 text-sm leading-snug truncate">${s.name}</p>
                <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">${heroClassBadge}</div>
            </div>
            <div class="flex-shrink-0 flex flex-col items-end gap-1.5">
                <div class="flex items-center gap-1">
                    ${guildAction}
                    <button data-id="${s.id}" class="${skillTreeBtnCls}" title="${pendingSkill ? '✨ New Skill Available!' : 'Skill Tree'}">
                        <i class="fas fa-sitemap" style="font-size:10px;"></i>
                    </button>
                    <button data-id="${s.id}" class="hero-chronicle-btn w-7 h-7 flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-700 rounded-full bubbly-button transition-colors" title="Hero's Chronicle">
                        <i class="fas fa-book-reader" style="font-size:10px;"></i>
                    </button>
                    <button data-id="${s.id}" class="avatar-maker-btn w-7 h-7 flex items-center justify-center rounded-full bubbly-button transition-colors" title="Create/Edit Avatar">
                        <i class="fas fa-user-astronaut" style="font-size:10px;"></i>
                    </button>
                    <button data-id="${s.id}" class="certificate-student-btn w-7 h-7 flex items-center justify-center bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-full bubbly-button transition-colors" title="Generate Certificate">
                        <i class="fas fa-award" style="font-size:10px;"></i>
                    </button>
                </div>
                <div class="flex items-center gap-1.5">
                    <button data-id="${s.id}" class="move-student-btn flex items-center gap-1 border border-yellow-200 text-xs font-bold py-1 px-2.5 rounded-full bubbly-button transition-colors" title="Move to Another Class">
                        <i class="fas fa-people-arrows" style="font-size:10px;"></i>
                        <span>Move</span>
                    </button>
                    <button data-id="${s.id}" class="edit-student-btn flex items-center gap-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-bold py-1 px-2.5 rounded-full bubbly-button transition-colors" title="Edit Student Details">
                        <i class="fas fa-pencil-alt" style="font-size:10px;"></i>
                        <span>Edit</span>
                    </button>
                    <button data-id="${s.id}" class="delete-student-btn w-7 h-7 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-full bubbly-button transition-colors" title="Delete Student">
                        <i class="fas fa-trash-alt" style="font-size:10px;"></i>
                    </button>
                </div>
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
    list.querySelectorAll('.skill-tree-btn').forEach(btn => btn.addEventListener('click', () => openSkillTreeModal(btn.dataset.id)));
}
