// /ui/tabs/classes.js
import * as state from '../../state.js';
import { TRAINING_HERO, withLegacyHeroAliases } from '../../features/heroClassNames.mjs';
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
import { handlePlaceReturningStudents } from '../../db/actions/students.js';
import { showToast } from '../effects.js';
import * as utils from '../../utils.js';
import {
    buildReturningStudentGroups,
    filterStudentsBySearch,
    getUnplacedStudents
} from '../../utils/returningStudents.js';

let returningStudentSearchQuery = '';
let returningStudentsPanelExpanded = false;
const returningStudentCheckedIds = new Set();

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderReturningStudentCard(entry, options = {}) {
    const { student, reason, prevLeague, previousClassName, score } = entry;
    const badge = options.suggested
        ? '<span class="returning-student-badge returning-student-badge--suggested"><i class="fas fa-star" aria-hidden="true"></i>Suggested</span>'
        : '';
    const oldClass = previousClassName || student.previousClassName || 'Previous class unknown';
    return `
        <label class="returning-student-card${options.suggested ? ' is-suggested' : ''}">
            <input type="checkbox" class="returning-student-check" value="${escapeHtml(student.id)}"${returningStudentCheckedIds.has(student.id) ? ' checked' : ''}>
            <span class="returning-student-card__tick" aria-hidden="true"><i class="fas fa-check"></i></span>
            <span class="returning-student-card__initial" aria-hidden="true">${escapeHtml(String(student.name || '?').trim().charAt(0).toUpperCase())}</span>
            <div class="returning-student-card__body">
                <div class="returning-student-card__title">
                    <strong>${escapeHtml(student.name)}</strong>
                    ${badge}
                </div>
                <p class="returning-student-card__meta">
                    <span class="returning-student-chip"><i class="fas fa-door-open" aria-hidden="true"></i>${student.releasedYearKey ? 'Left ' : ''}${escapeHtml(oldClass)}${student.releasedYearKey ? ' this year' : ''}</span>
                    ${prevLeague ? `<span class="returning-student-chip returning-student-chip--league"><i class="fas fa-flag" aria-hidden="true"></i>${escapeHtml(prevLeague)}</span>` : ''}
                </p>
                ${reason ? `<p class="returning-student-card__reason">${escapeHtml(reason)}</p>` : ''}
                ${options.suggested && score >= 100 ? '<p class="returning-student-card__hint"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>Likely match for this class league</p>' : ''}
            </div>
        </label>
    `;
}

function captureReturningStudentChecks(panel) {
    panel?.querySelectorAll('.returning-student-check').forEach((el) => {
        if (el.checked) returningStudentCheckedIds.add(el.value);
        else returningStudentCheckedIds.delete(el.value);
    });
}

function bindReturningStudentsPanel(panel, currentClassId) {
    panel.querySelector('[data-returning-students-toggle]')?.addEventListener('click', () => {
        captureReturningStudentChecks(panel);
        returningStudentsPanelExpanded = !returningStudentsPanelExpanded;
        renderReturningStudentsPanel(currentClassId);
    });

    const searchInput = panel.querySelector('#returning-students-search-input');
    searchInput?.addEventListener('input', (event) => {
        captureReturningStudentChecks(panel);
        returningStudentSearchQuery = event.target.value;
        renderReturningStudentsPanel(currentClassId, {
            searchCaret: event.target.selectionStart,
            focusSearch: true
        });
    });

    const updateSelectedCount = () => {
        const counter = panel.querySelector('[data-returning-selected]');
        if (!counter) return;
        const n = returningStudentCheckedIds.size;
        counter.textContent = n === 1 ? '1 ticked' : `${n} ticked`;
        counter.classList.toggle('is-empty', n === 0);
    };
    panel.querySelectorAll('.returning-student-check').forEach((el) => {
        el.addEventListener('change', () => {
            captureReturningStudentChecks(panel);
            updateSelectedCount();
        });
    });
    updateSelectedCount();

    panel.querySelector('#returning-students-place-btn')?.addEventListener('click', async () => {
        captureReturningStudentChecks(panel);
        const btn = panel.querySelector('#returning-students-place-btn');
        const studentIds = [...returningStudentCheckedIds];
        if (!studentIds.length) {
            showToast('Tick at least one returning student.', 'info');
            return;
        }
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Placing...';
        try {
            await handlePlaceReturningStudents(currentClassId, studentIds);
            returningStudentSearchQuery = '';
            returningStudentCheckedIds.clear();
            renderManageStudentsTab();
        } catch {
            // toast already shown
        } finally {
            if (btn.isConnected) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-user-check mr-2"></i>Place Selected';
            }
        }
    });
}

function renderReturningStudentsPanel(currentClassId, options = {}) {
    const panel = document.getElementById('returning-students-panel');
    if (!panel) return;

    const allStudents = state.get('allStudents') || [];
    const unplaced = getUnplacedStudents(allStudents);
    const unplacedCount = unplaced.length;
    if (!unplacedCount) {
        returningStudentSearchQuery = '';
        returningStudentsPanelExpanded = false;
        returningStudentCheckedIds.clear();
        panel.classList.add('hidden');
        panel.innerHTML = '';
        return;
    }

    const currentClass = (state.get('allSchoolClasses') || []).find((c) => c.id === currentClassId)
        || (state.get('allTeachersClasses') || []).find((c) => c.id === currentClassId);
    if (!currentClass) {
        panel.classList.add('hidden');
        panel.innerHTML = '';
        return;
    }

    const existingSearch = panel.querySelector('#returning-students-search-input');
    const searchWasFocused = options.focusSearch || document.activeElement === existingSearch;
    const searchCaret = Number.isInteger(options.searchCaret)
        ? options.searchCaret
        : (searchWasFocused && existingSearch ? existingSearch.selectionStart : null);
    captureReturningStudentChecks(panel);

    const liveIds = new Set(unplaced.map((student) => student.id));
    for (const id of [...returningStudentCheckedIds]) {
        if (!liveIds.has(id)) returningStudentCheckedIds.delete(id);
    }

    const { suggested, others } = buildReturningStudentGroups(allStudents, currentClass);
    const filterEntries = (entries) => filterStudentsBySearch(entries, returningStudentSearchQuery);
    const filteredSuggested = filterEntries(suggested);
    const filteredOthers = filterEntries(others);
    const waitingLabel = unplacedCount === 1 ? '1 student still needs a class' : `${unplacedCount} students still need a class`;
    const leagueLabel = currentClass.questLevel || 'this class';

    panel.classList.remove('hidden');
    panel.innerHTML = `
        <div class="returning-students-shell${returningStudentsPanelExpanded ? ' is-open' : ' is-collapsed'}">
            <div class="returning-students-shell__header">
                <button type="button"
                    class="returning-students-shell__toggle"
                    data-returning-students-toggle
                    aria-expanded="${returningStudentsPanelExpanded ? 'true' : 'false'}"
                    aria-controls="returning-students-body">
                    <span class="returning-students-shell__crest" aria-hidden="true"><i class="fas fa-dungeon"></i></span>
                    <span class="returning-students-shell__copy">
                        <p class="returning-students-shell__eyebrow">Student setup</p>
                        <h3 class="returning-students-shell__title">Returning adventurers for ${escapeHtml(currentClass.name)}</h3>
                        <p class="returning-students-shell__meta">
                            ${escapeHtml(waitingLabel)}. Suggestions are based on last year’s league (${escapeHtml(leagueLabel)}).
                            ${returningStudentsPanelExpanded ? '' : ' Open to seat them.'}
                        </p>
                    </span>
                    <span class="returning-students-shell__count" aria-hidden="true">${unplacedCount}<small>waiting</small></span>
                    <span class="returning-students-shell__chevron" aria-hidden="true">
                        <i class="fas fa-chevron-${returningStudentsPanelExpanded ? 'up' : 'down'}"></i>
                    </span>
                </button>
                ${returningStudentsPanelExpanded ? `
                    <div class="returning-students-shell__actions">
                        <span class="returning-students-selected is-empty" data-returning-selected>0 ticked</span>
                        <button type="button" id="returning-students-place-btn"
                            class="returning-students-place-btn bubbly-button">
                            <i class="fas fa-user-check mr-2"></i>Place Selected
                        </button>
                    </div>
                ` : ''}
            </div>
            ${returningStudentsPanelExpanded ? `
                <div class="returning-students-body" id="returning-students-body">
                    <div class="returning-students-search">
                        <i class="fas fa-search text-amber-600"></i>
                        <input type="search" id="returning-students-search-input"
                            placeholder="Search by name, old class, or league..."
                            value="${escapeHtml(returningStudentSearchQuery)}"
                            autocomplete="off">
                    </div>
                    ${filteredSuggested.length ? `
                        <div class="returning-students-group">
                            <h4 class="returning-students-group__title"><i class="fas fa-wand-magic-sparkles mr-2"></i>Suggested for this class</h4>
                            <div class="returning-students-grid">
                                ${filteredSuggested.map((entry) => renderReturningStudentCard(entry, { suggested: true, score: entry.score })).join('')}
                            </div>
                        </div>
                    ` : (returningStudentSearchQuery && suggested.length
                        ? '<p class="returning-students-empty">No suggested matches for that search.</p>'
                        : '<p class="returning-students-empty">No strong league matches — check all unplaced students below.</p>'
                    )}
                    ${filteredOthers.length ? `
                        <div class="returning-students-group">
                            <h4 class="returning-students-group__title"><i class="fas fa-users mr-2"></i>${suggested.length ? 'Everyone else waiting' : 'All unplaced students'}</h4>
                            <div class="returning-students-grid">
                                ${filteredOthers.map((entry) =>
                                    renderReturningStudentCard(entry, { suggested: false, score: entry.score })
                                ).join('')}
                            </div>
                        </div>
                    ` : (returningStudentSearchQuery
                        ? '<p class="returning-students-empty">No other students match that search.</p>'
                        : ''
                    )}
                </div>
            ` : ''}
        </div>
    `;

    bindReturningStudentsPanel(panel, currentClassId);

    if (searchWasFocused) {
        const input = panel.querySelector('#returning-students-search-input');
        if (input) {
            input.focus();
            const caret = Math.min(
                typeof searchCaret === 'number' ? searchCaret : input.value.length,
                input.value.length
            );
            input.setSelectionRange(caret, caret);
        }
    }
}

/**
 * Orders My Classes by the clock: the class in session first (or the one that just
 * ended, same grace as follow-schedule), then today's upcoming lessons, then today's
 * finished ones, then other days by their next weekday and start time. Unscheduled
 * classes go last. Returns [{ cls, slot }] where slot is 'now' | 'today' | 'done' | null.
 */
function sortClassesByTimeOfDay(classes, now = new Date()) {
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
    const todayClasses = utils.getClassesOnDay(
        utils.getTodayDateString(),
        state.get('allSchoolClasses') || [],
        state.get('allScheduleOverrides') || [],
        classEndDates
    ).filter(c => classes.some(mine => mine.id === c.id));
    const todayIds = new Set(todayClasses.map(c => c.id));
    const live = utils.findLessonClassWithGrace(todayClasses, now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const today = now.getDay();

    const rank = (c) => {
        const start = utils.parseClockToMinutes(c.timeStart);
        const startKey = start == null ? 24 * 60 : start;
        if (live && c.id === live.id) return { group: 0, offset: 0, startKey, slot: 'now' };
        if (todayIds.has(c.id)) {
            const end = utils.parseClockToMinutes(c.timeEnd);
            const finished = end != null ? end < nowMin : (start != null && start < nowMin);
            return finished
                ? { group: 2, offset: 0, startKey, slot: 'done' }
                : { group: 1, offset: 0, startKey, slot: 'today' };
        }
        const offsets = (c.scheduleDays || [])
            .map(d => ((Number(d) - today + 7) % 7) || 7)
            .filter(n => Number.isFinite(n));
        if (offsets.length === 0) return { group: 4, offset: 0, startKey, slot: null };
        return { group: 3, offset: Math.min(...offsets), startKey, slot: null };
    };

    return classes
        .map(cls => ({ cls, ...rank(cls) }))
        .sort((a, b) => a.group - b.group
            || a.offset - b.offset
            || a.startKey - b.startKey
            || a.cls.name.localeCompare(b.cls.name))
        .map(({ cls, slot }) => ({ cls, slot }));
}

const CLASS_SLOT_CHIPS = {
    now: '<span class="inline-flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm"><span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>In session</span>',
    today: '<span class="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"><i class="fas fa-hourglass-half"></i>Later today</span>',
    done: '<span class="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 border border-gray-200 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"><i class="fas fa-check"></i>Done today</span>'
};

export function renderManageClassesTab() {
    const list = document.getElementById('class-list');
    if (!list) return;
    if (state.get('allTeachersClasses').length === 0) {
        list.innerHTML = `<p class="text-center text-gray-700 bg-white/50 p-4 rounded-2xl text-lg">You haven't created any classes yet.</p>`;
        return;
    }
    list.innerHTML = sortClassesByTimeOfDay(state.get('allTeachersClasses')).map(({ cls: c, slot }) => {
        const schedule = (c.scheduleDays || []).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
        const time = (c.timeStart && c.timeEnd) ? `${c.timeStart} - ${c.timeEnd}` : 'No time set';
        return `
            <div class="relative bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-lg border border-teal-100${slot === 'now' ? ' ring-4 ring-emerald-300/70' : ''} transform transition hover:shadow-xl hover:-translate-y-1 overflow-hidden group">
                <div class="absolute -right-12 -top-12 w-40 h-40 bg-teal-400/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                <div class="absolute -left-12 -bottom-12 w-32 h-32 bg-cyan-400/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                
                <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div class="flex-1">
                        <div class="flex items-center gap-4 mb-2">
                            <span class="text-5xl drop-shadow-md floating-icon transition-transform duration-300 group-hover:scale-110">${c.logo || '📚'}</span>
                            <div>
                                <h3 class="font-title text-3xl text-gray-800 tracking-wide">${c.name}</h3>
                                <p class="text-xs text-teal-600 font-bold uppercase tracking-widest mt-0.5">${c.questLevel || 'Uncategorized'}</p>
                                ${slot ? `<div class="mt-2">${CLASS_SLOT_CHIPS[slot]}</div>` : ''}
                            </div>
                        </div>
                        
                        <div class="flex flex-wrap gap-3 mt-4 text-sm font-semibold text-gray-600">
                            <span class="bg-white/80 backdrop-blur-sm px-3.5 py-1.5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2"><i class="fas fa-calendar-day text-teal-500"></i> ${schedule || 'No days set'}</span>
                            <span class="bg-white/80 backdrop-blur-sm px-3.5 py-1.5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2"><i class="fas fa-clock text-teal-500"></i> ${time}</span>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap md:flex-nowrap md:flex-col lg:flex-row justify-end gap-2.5 mt-2 md:mt-0">
                        <button data-id="${c.id}" class="report-class-btn bg-gradient-to-r from-emerald-100 to-green-100 text-green-800 hover:from-emerald-200 hover:to-green-200 border border-green-200 font-bold py-2.5 px-5 rounded-2xl shadow-sm bubbly-button transition-all flex items-center justify-center gap-2">
                            <i class="fas fa-file-lines"></i><span class="hidden sm:inline">Report</span>
                        </button>
                        <button data-id="${c.id}" class="edit-class-btn bg-gradient-to-r from-cyan-100 to-blue-100 text-blue-800 hover:from-cyan-200 hover:to-blue-200 border border-blue-200 font-bold py-2.5 px-5 rounded-2xl shadow-sm bubbly-button transition-all flex items-center justify-center gap-2">
                            <i class="fas fa-pencil-alt"></i><span class="hidden sm:inline">Edit</span>
                        </button>
                        <button data-id="${c.id}" data-name="${c.name.replace(/'/g, "\\'")}" class="manage-students-btn bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-500 hover:to-emerald-600 text-white border border-teal-400 font-bold py-2.5 px-6 rounded-2xl shadow-md bubbly-button transition-all flex items-center justify-center gap-2">
                            <i class="fas fa-users"></i><span class="hidden sm:inline">Students</span>
                        </button>
                        <button data-id="${c.id}" class="delete-class-btn ml-auto bg-white text-red-500 hover:bg-red-50 hover:text-red-600 border border-red-200 font-bold w-12 h-12 rounded-2xl shadow-sm bubbly-button transition-all flex items-center justify-center flex-shrink-0">
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
    if (canUseFeature('heroCampfire')) import('../../features/campfireEntry.js').then(({ mountCampfireEntry }) => {
        list.querySelectorAll('.edit-class-btn').forEach(btn => mountCampfireEntry(btn.parentElement, btn.dataset.id, { oathsOnly: true }));
    });
    list.querySelectorAll('.report-class-btn').forEach(btn => btn.addEventListener('click', () => modals.handleGenerateReport(btn.dataset.id)));
}

export function renderManageStudentsTab() {
    const list = document.getElementById('student-list');
    const currentManagingClassId = state.get('currentManagingClassId');
    if (!list || !currentManagingClassId) return;

    renderReturningStudentsPanel(currentManagingClassId);

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
        const unplacedCount = getUnplacedStudents(state.get('allStudents') || []).length;
        list.innerHTML = `
            <div class="text-center py-14 px-6">
                <div class="text-gray-200 text-6xl mb-4"><i class="fas fa-users"></i></div>
                <p class="text-gray-500 font-semibold text-lg">No adventurers yet!</p>
                <p class="text-gray-400 text-sm mt-1">${unplacedCount
                    ? 'Place returning students from the panel above, or add a brand-new student with the form.'
                    : 'Add your first student using the form to start the quest.'
                }</p>
            </div>`;
        return;
    }

    const heroClassConfig = withLegacyHeroAliases({
        'Guardian':  { icon: '🛡️', bg: '#f3e8ff', text: '#7e22ce', ring: '#a855f7' },
        'Sage':      { icon: '🔮', bg: '#ede9fe', text: '#6d28d9', ring: '#8b5cf6' },
        'Paladin':   { icon: '⚔️', bg: '#fee2e2', text: '#991b1b', ring: '#ef4444' },
        'Artificer': { icon: '⚙️', bg: '#ffedd5', text: '#9a3412', ring: '#f97316' },
        'Scholar':   { icon: '📜', bg: '#fef3c7', text: '#92400e', ring: '#f59e0b' },
        [TRAINING_HERO]: { icon: '⚜️', bg: '#d1fae5', text: '#065f46', ring: '#10b981' },
        'Nomad':     { icon: '👟', bg: '#e0f2fe', text: '#075985', ring: '#0ea5e9' },
        'Patron':    { icon: '💝', bg: '#ffe4e6', text: '#9f1239', ring: '#e11d48' },
    });

    list.innerHTML = studentsInClass.map(s => {
        const scoreData = state.get('allStudentScores').find(sc => sc.id === s.id);
        const pendingSkill = heroProgressionEnabled && (scoreData?.pendingSkillChoice || false);
        const hc = heroProgressionEnabled && s.heroClass ? (heroClassConfig[s.heroClass] || null) : null;

        const ringStyle = hc
            ? `box-shadow: 0 0 0 2px white, 0 0 0 4px ${hc.ring};`
            : 'box-shadow: 0 0 0 2px white, 0 0 0 4px #d1d5db;';

        const avatarInner = s.avatar
            ? `<img src="${s.avatar}" alt="${s.name}" data-student-id="${s.id}"
                loading="lazy" decoding="async"
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
        const guildChip = s.guildId && getGuildById(s.guildId)
            ? `<span class="roster-guild-chip" style="--chip-color:${getGuildById(s.guildId).primary};">${escapeHtml(getGuildById(s.guildId).name)}</span>`
            : '';
        const heroMetaRow = (heroClassBadge || heroTitlePill || guildChip)
            ? `<div class="roster-hero__meta">${heroTitlePill || heroClassBadge}${guildChip}</div>`
            : '';

        // Every row carries the same tools in the same slots, so the columns line up down the roster.
        const tool = ({ cls, tone, icon, label, title, locked = false, extra = '', tag = 'button' }) => {
            const lock = locked ? '<i class="fas fa-lock roster-tool__lock" aria-hidden="true"></i>' : '';
            const attrs = tag === 'button' ? `type="button" data-id="${s.id}" ` : '';
            return `<${tag} ${attrs}class="roster-tool roster-tool--${tone}${locked ? ' is-locked' : ''}${cls ? ' ' + cls : ''}" title="${title}"${extra}>
                <span class="roster-tool__icon">${icon}${lock}</span>
                <span class="roster-tool__label">${label}</span>
            </${tag}>`;
        };
        const fa = (name) => `<i class="fas ${name}" aria-hidden="true"></i>`;

        const guild = s.guildId ? getGuildById(s.guildId) : null;
        const guildTool = s.guildId
            ? tool({ tag: 'span', tone: 'guild', cls: 'is-set', icon: `<span class="guild-badge-wrap">${getGuildBadgeHtml(s.guildId, 'w-7 h-7')}</span>`, label: 'Guild', title: guild ? `Guild: ${guild.name}` : 'Guild' })
            : tool({ cls: 'guild-quiz-btn', tone: 'guild', icon: fa('fa-hat-wizard'), label: 'Sort', locked: !guildsEnabled, title: guildsEnabled ? 'Take Guild Quiz' : 'Pro plan: Guild Sorting Quiz' });

        const heroClassTool = s.heroClass
            ? tool({ tag: 'span', tone: 'class', cls: 'is-set', icon: `<span class="roster-tool__emoji">${hc?.icon || HERO_CLASSES[s.heroClass]?.icon || '🛡️'}</span>`, label: s.heroClass, title: `Hero class: ${s.heroClass}` })
            : tool({ cls: 'hero-class-select-btn', tone: 'class', icon: fa('fa-shield-halved'), label: 'Class', locked: !heroProgressionEnabled, title: heroProgressionEnabled ? 'Choose Hero Class' : 'Pro plan: Hero Classes & Skill Tree' });

        const skillTool = tool({
            cls: `skill-tree-btn${!heroProgressionEnabled ? ' skill-tree-btn-locked' : ''}${pendingSkill ? ' is-ready' : ''}`,
            tone: 'skills',
            icon: fa('fa-sitemap') + (pendingSkill ? '<span class="roster-tool__ping" aria-hidden="true"></span>' : ''),
            label: 'Skills',
            locked: !heroProgressionEnabled,
            title: !heroProgressionEnabled ? 'Pro plan: Hero Classes & Skill Tree' : (pendingSkill ? '✨ New Skill Available!' : 'Skill Tree')
        });

        const avatarTool = tool({
            cls: `avatar-maker-btn${eliteAiEnabled ? '' : ' avatar-maker-btn-locked'}`,
            tone: 'avatar', icon: fa('fa-user-astronaut'), label: 'Avatar',
            locked: !eliteAiEnabled, title: eliteAiEnabled ? 'Create/Edit Avatar' : 'Elite plan: Avatar Forge'
        });

        const accent = guild?.primary || (hc ? hc.ring : '');

        return `
        <article class="roster-row"${accent ? ` style="--roster-accent:${accent};"` : ''}>
            <div class="roster-hero">
                <div class="roster-hero__avatar">${avatarHtml}</div>
                <div class="roster-hero__text">
                    <p class="roster-hero__name">${escapeHtml(s.name)}</p>
                    ${heroMetaRow}
                </div>
            </div>
            <div class="roster-tools">
                <div class="roster-group roster-group--hero" role="group" aria-label="Hero path">
                    <span class="roster-group__caption">Hero path</span>
                    <div class="roster-group__tools">
                        ${guildTool}
                        ${heroClassTool}
                        ${skillTool}
                    </div>
                </div>
                <div class="roster-group roster-group--records" role="group" aria-label="Records">
                    <span class="roster-group__caption">Records</span>
                    <div class="roster-group__tools">
                        ${tool({ cls: 'hero-chronicle-btn', tone: 'chronicle', icon: fa('fa-book-reader'), label: 'Chronicle', title: "Hero's Chronicle" })}
                        ${tool({ cls: 'parent-access-student-btn', tone: 'parents', icon: fa('fa-user-shield'), label: 'Parents', title: 'Parent Access' })}
                        ${avatarTool}
                        ${tool({ cls: 'certificate-student-btn', tone: 'certificate', icon: fa('fa-award'), label: 'Certificate', title: 'Generate Certificate' })}
                    </div>
                </div>
                <div class="roster-group roster-group--admin" role="group" aria-label="Manage">
                    <span class="roster-group__caption">Manage</span>
                    <div class="roster-group__tools">
                        ${tool({ cls: 'move-student-btn', tone: 'move', icon: fa('fa-people-arrows'), label: 'Move', title: 'Move to Another Class' })}
                        ${tool({ cls: 'edit-student-btn', tone: 'edit', icon: fa('fa-pencil-alt'), label: 'Edit', title: 'Edit Student Details' })}
                        ${tool({ cls: 'delete-student-btn', tone: 'delete', icon: fa('fa-trash-alt'), label: 'Delete', title: 'Delete Student' })}
                    </div>
                </div>
            </div>
        </article>`;
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
        document.querySelector('#options-tab .options-subtab-btn[data-options-tab="access"]')?.click();
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
    list.querySelectorAll('.hero-class-select-btn').forEach(btn => btn.addEventListener('click', () => {
        if (!heroProgressionEnabled) {
            showUpgradePrompt({
                feature: 'Hero Classes & Skill Tree',
                tier: 'Pro',
                message: getUpgradeMessage('Pro', 'heroProgression')
            });
            return;
        }
        modals.openHeroClassSelectModal(btn.dataset.id);
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
