// /ui/tabs/classes.js
import * as state from '../../state.js';
import * as modals from '../modals.js';
import { deleteClass, deleteStudent } from '../../db/actions.js';
import { showTab } from './navigation.js';
import * as avatar from '../../features/avatar.js';
import { wrapAvatarWithLevelUpIndicator } from '../core/avatar.js';
import { getGuildBadgeHtml, getGuildById } from '../../features/guilds.js';
import { openSkillTreeModal } from '../modals/skillTree.js';
import { getHeroTitle, HERO_SKILL_TREE } from '../../features/heroSkillTree.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { canUseFeature } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { getUpgradeMessage } from '../../config/tiers/features.js';
import { openAccessCenterForStudent } from '../../features/accessManagement.js';

export function renderManageClassesTab() {
    const list = document.getElementById('class-list');
    if (!list) return;
    if (state.get('allTeachersClasses').length === 0) {
        list.innerHTML = `<p class="text-center text-gray-700 bg-white/50 p-4 rounded-2xl text-lg">You haven't created any classes yet.</p>`;
        return;
    }
    list.innerHTML = state.get('allTeachersClasses').sort((a, b) => a.name.localeCompare(b.name)).map(c => {
        const schedule = (c.scheduleDays || []).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
        const time = (c.timeStart && c.timeEnd) ? `${c.timeStart} - ${c.timeEnd}` : 'No time set';
        return `
            <div class="relative bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-lg border border-teal-100 transform transition hover:shadow-xl hover:-translate-y-1 overflow-hidden group">
                <div class="absolute -right-12 -top-12 w-40 h-40 bg-teal-400/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                <div class="absolute -left-12 -bottom-12 w-32 h-32 bg-cyan-400/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                
                <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div class="flex-1">
                        <div class="flex items-center gap-4 mb-2">
                            <span class="text-5xl drop-shadow-md floating-icon transition-transform duration-300 group-hover:scale-110">${c.logo || '📚'}</span>
                            <div>
                                <h3 class="font-title text-3xl text-gray-800 tracking-wide">${c.name}</h3>
                                <p class="text-xs text-teal-600 font-bold uppercase tracking-widest mt-0.5">${c.questLevel || 'Uncategorized'}</p>
                            </div>
                        </div>
                        
                        <div class="flex flex-wrap gap-3 mt-4 text-sm font-semibold text-gray-600">
                            <span class="bg-white/80 backdrop-blur-sm px-3.5 py-1.5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2"><i class="fas fa-calendar-day text-teal-500"></i> ${schedule || 'No days set'}</span>
                            <span class="bg-white/80 backdrop-blur-sm px-3.5 py-1.5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2"><i class="fas fa-clock text-teal-500"></i> ${time}</span>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap md:flex-nowrap md:flex-col lg:flex-row justify-end gap-2.5 mt-2 md:mt-0">
                        <button data-id="${c.id}" class="report-class-btn bg-gradient-to-r from-emerald-100 to-green-100 text-green-800 hover:from-emerald-200 hover:to-green-200 border border-green-200 font-bold py-2.5 px-5 rounded-2xl shadow-sm bubbly-button transition-all flex items-center justify-center gap-2">
                            <i class="fas fa-magic"></i><span class="hidden sm:inline">Report</span>
                        </button>
                        <button data-id="${c.id}" class="edit-class-btn bg-gradient-to-r from-cyan-100 to-blue-100 text-blue-800 hover:from-cyan-200 hover:to-blue-200 border border-blue-200 font-bold py-2.5 px-5 rounded-2xl shadow-sm bubbly-button transition-all flex items-center justify-center gap-2">
                            <i class="fas fa-pencil-alt"></i><span class="hidden sm:inline">Edit</span>
                        </button>
                        <button data-id="${c.id}" data-name="${c.name.replace(/'/g, "\\'")}" class="manage-students-btn bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-500 hover:to-emerald-600 text-white border border-teal-400 font-bold py-2.5 px-6 rounded-2xl shadow-md bubbly-button transition-all flex items-center justify-center gap-2">
                            <i class="fas fa-users"></i><span class="hidden sm:inline">Students</span>
                        </button>
                        <button data-id="${c.id}" class="delete-class-btn bg-white text-red-500 hover:bg-red-50 hover:text-red-600 border border-red-200 font-bold w-12 h-12 rounded-2xl shadow-sm bubbly-button transition-all flex items-center justify-center flex-shrink-0">
                            <i class="fas fa-trash-alt"></i>
                        </button>
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
}

export function renderManageStudentsTab() {
    const list = document.getElementById('student-list');
    const currentManagingClassId = state.get('currentManagingClassId');
    if (!list || !currentManagingClassId) return;

    const studentsInClass = state.get('allStudents')
        .filter(s => s.classId === currentManagingClassId)
        .sort((a, b) => a.name.localeCompare(b.name));
    const heroProgressionEnabled = canUseFeature('heroProgression');
    const guildsEnabled = canUseFeature('guilds');
    const eliteAiEnabled = canUseFeature('eliteAI');

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
        const pendingSkill = heroProgressionEnabled && (scoreData?.pendingSkillChoice || false);
        const hc = heroProgressionEnabled && s.heroClass ? (heroClassConfig[s.heroClass] || null) : null;

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

        const heroLevel = heroProgressionEnabled ? (scoreData?.heroLevel || 0) : 0;
        const heroTitle = heroProgressionEnabled && s.heroClass && heroLevel > 0 ? getHeroTitle(s.heroClass, heroLevel) : null;
        const tree = heroProgressionEnabled && s.heroClass ? HERO_SKILL_TREE[s.heroClass] : null;
        const auraColor = tree?.auraColor || '#7c3aed';
        const heroTitlePill = heroTitle
            ? `<span class="hero-title-pill inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full text-white shadow-sm border border-white/30" style="background: linear-gradient(135deg, ${auraColor}, ${auraColor}dd); box-shadow: 0 1px 3px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.2);">${HERO_CLASSES[s.heroClass]?.icon || ''} ${heroTitle}</span>`
            : '';
        const heroClassBadge = hc
            ? `<span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style="background:${hc.bg};color:${hc.text};">${hc.icon} ${s.heroClass}</span>`
            : (heroProgressionEnabled ? `<span class="text-[11px] text-gray-400 italic">No class</span>` : '');
        const heroMetaRow = (heroClassBadge || heroTitlePill)
            ? `<div class="flex items-center gap-1.5 mt-0.5 flex-wrap">${heroClassBadge}${heroTitlePill}</div>`
            : '';

        const guildAction = s.guildId
            ? `<span class="guild-badge-wrap flex-shrink-0">${getGuildBadgeHtml(s.guildId, 'w-7 h-7')}</span>`
            : guildsEnabled
                ? `<button data-id="${s.id}" class="guild-quiz-btn w-7 h-7 flex items-center justify-center bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-full bubbly-button transition-colors" title="Take Guild Quiz"><i class="fas fa-hat-wizard" style="font-size:10px;"></i></button>`
                : `<button data-id="${s.id}" class="guild-quiz-btn w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-full border border-slate-200 bubbly-button transition-colors" title="Pro plan: Guild Sorting Quiz"><i class="fas fa-hat-wizard" style="font-size:10px;"></i></button>`;

        const skillTreeBtnCls = !heroProgressionEnabled
            ? 'skill-tree-btn skill-tree-btn-locked w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-full border border-slate-200 bubbly-button transition-colors'
            : pendingSkill
                ? 'skill-tree-btn w-7 h-7 flex items-center justify-center bg-purple-500 hover:bg-purple-600 text-white rounded-full bubbly-button animate-pulse ring-2 ring-purple-300 transition-colors'
                : 'skill-tree-btn w-7 h-7 flex items-center justify-center bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-full bubbly-button transition-colors';
        const avatarMakerBtnCls = eliteAiEnabled
            ? 'avatar-maker-btn w-7 h-7 flex items-center justify-center bg-fuchsia-100 hover:bg-fuchsia-200 text-fuchsia-700 rounded-full bubbly-button transition-colors'
            : 'avatar-maker-btn avatar-maker-btn-locked w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-full border border-slate-200 bubbly-button transition-colors';

        const guildBorderStyle = s.guildId && getGuildById(s.guildId)
            ? `border-left: 3px solid ${getGuildById(s.guildId).primary};`
            : '';

        return `
        <div class="flex items-center gap-3 px-4 py-3 hover:bg-teal-50/50 transition-colors" style="${guildBorderStyle}">
            <div class="flex-shrink-0">${avatarHtml}</div>
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-800 text-sm leading-snug truncate">${s.name}</p>
                ${heroMetaRow}
            </div>
            <div class="flex-shrink-0 flex flex-col items-end gap-1.5">
                <div class="flex items-center gap-1">
                    ${guildAction}
                    <button data-id="${s.id}" class="${skillTreeBtnCls}" title="${!heroProgressionEnabled ? 'Pro plan: Hero Classes & Skill Tree' : (pendingSkill ? '✨ New Skill Available!' : 'Skill Tree')}">
                        <i class="fas fa-sitemap" style="font-size:10px;"></i>
                    </button>
                    <button data-id="${s.id}" class="hero-chronicle-btn w-7 h-7 flex items-center justify-center bg-green-100 hover:bg-green-200 text-green-700 rounded-full bubbly-button transition-colors" title="Hero's Chronicle">
                        <i class="fas fa-book-reader" style="font-size:10px;"></i>
                    </button>
                    <button data-id="${s.id}" class="parent-access-student-btn w-7 h-7 flex items-center justify-center bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-full bubbly-button transition-colors" title="Parent Access">
                        <i class="fas fa-user-shield" style="font-size:10px;"></i>
                    </button>
                    <button data-id="${s.id}" class="${avatarMakerBtnCls}" title="${eliteAiEnabled ? 'Create/Edit Avatar' : 'Elite plan: Avatar Forge'}">
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
    list.querySelectorAll('.avatar-maker-btn').forEach(btn => btn.addEventListener('click', () => {
        if (!eliteAiEnabled) {
            showUpgradePrompt({
                feature: 'Avatar Forge',
                tier: 'Elite',
                message: getUpgradeMessage('Elite')
            });
            return;
        }
        avatar.openAvatarMaker(btn.dataset.id);
    }));
    list.querySelectorAll('.move-student-btn').forEach(btn => btn.addEventListener('click', () => modals.openMoveStudentModal(btn.dataset.id)));
    list.querySelectorAll('.hero-chronicle-btn').forEach(btn => btn.addEventListener('click', () => modals.openHeroChronicleModal(btn.dataset.id)));
    list.querySelectorAll('.parent-access-student-btn').forEach(btn => btn.addEventListener('click', async () => {
        openAccessCenterForStudent(btn.dataset.id);
        await showTab('options-tab');
        document.querySelector('.options-subtab-btn[data-options-tab="access"]')?.click();
    }));
    list.querySelectorAll('.guild-quiz-btn').forEach(btn => btn.addEventListener('click', () => {
        if (!guildsEnabled) {
            showUpgradePrompt({
                feature: 'Guild Sorting Quiz',
                tier: 'Pro',
                message: getUpgradeMessage('Pro', 'guilds')
            });
            return;
        }
        modals.openSortingQuizModal(btn.dataset.id);
    }));
    list.querySelectorAll('.skill-tree-btn').forEach(btn => btn.addEventListener('click', () => {
        if (!heroProgressionEnabled) {
            showUpgradePrompt({
                feature: 'Hero Classes & Skill Tree',
                tier: 'Pro',
                message: getUpgradeMessage('Pro', 'heroProgression')
            });
            return;
        }
        openSkillTreeModal(btn.dataset.id);
    }));
}
