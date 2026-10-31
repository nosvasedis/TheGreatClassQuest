// /ui/tabs/classes.js
import '../../styles/student_roster.css';
import * as state from '../../state.js';
import { bindRosterTips } from './rosterTips.js';
import { emptyStateHtml } from '../emptyStateView.mjs';
import { morphInto } from '../../utils/domMorph.mjs';
import { TRAINING_HERO, withLegacyHeroAliases } from '../../features/heroClassNames.mjs';
import * as modals from '../modals/index.js';
import { deleteClass, deleteStudent } from '../../db/actions/index.js';
import { showTab } from './navigation.js';
import * as avatar from '../../features/avatar.js';
import { wrapAvatarWithLevelUpIndicator } from '../core/avatar.js';
import { getGuildBadgeHtml, getGuildById } from '../../features/guilds.js';
import { openSkillTreeModal } from '../modals/skillTree.js';
import { getHeroTitle, HERO_SKILL_TREE } from '../../features/heroSkillTree.js';
import { HERO_CLASSES, heroClassChangesRemaining, heroClassLockApplies } from '../../features/heroClasses.js';
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
    now: '<span class="mc-slot mc-slot--now"><span class="mc-slot__pulse" aria-hidden="true"></span>In session</span>',
    today: '<span class="mc-slot mc-slot--today"><i class="fas fa-hourglass-half" aria-hidden="true"></i>Later today</span>',
    done: '<span class="mc-slot mc-slot--done"><i class="fas fa-check" aria-hidden="true"></i>Done today</span>'
};

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * One tool on a class card: an icon plus a name and a live hint, so it says what it does
 * without a tooltip. `cls` keeps the old handler class names (report-class-btn, …).
 */
function classTool({ cls, tone, icon, name, hint, title, id, attrs = '', locked = false, nudge = false }) {
    const lock = locked ? '<i class="fas fa-lock mc-tool__lock" aria-hidden="true"></i>' : '';
    return `<button type="button" data-id="${id}" ${attrs}class="mc-tool mc-tool--${tone}${nudge ? ' is-nudge' : ''}${locked ? ' is-locked' : ''} ${cls}" title="${escapeHtml(title)}">
                <span class="mc-tool__icon" aria-hidden="true"><i class="fas ${icon}"></i>${lock}</span>
                <span class="mc-tool__text"><span class="mc-tool__name">${name}</span><span class="mc-tool__hint">${hint}</span></span>
            </button>`;
}

export function renderManageClassesTab() {
    const list = document.getElementById('class-list');
    if (!list) return;
    if (state.get('allTeachersClasses').length === 0) {
        list.innerHTML = `<p class="text-center text-gray-700 bg-white/50 p-4 rounded-2xl text-lg">You haven't created any classes yet.</p>`;
        return;
    }
    const studentCounts = new Map();
    (state.get('allStudents') || []).forEach(s => studentCounts.set(s.classId, (studentCounts.get(s.classId) || 0) + 1));
    const eliteAI = canUseFeature('eliteAI');
    const oaths = canUseFeature('heroCampfire');

    list.innerHTML = sortClassesByTimeOfDay(state.get('allTeachersClasses')).map(({ cls: c, slot }) => {
        const days = (c.scheduleDays || []).map(d => WEEKDAY_SHORT[d]).filter(Boolean);
        const hasTime = Boolean(c.timeStart && c.timeEnd);
        const unscheduled = days.length === 0 || !hasTime;
        const count = studentCounts.get(c.id) || 0;
        const name = escapeHtml(c.name);
        return `
            <article class="mc-card${slot === 'now' ? ' is-live' : ''}" data-class-id="${c.id}">
                <header class="mc-card__head">
                    <span class="mc-card__logo" aria-hidden="true">${c.logo || '📚'}</span>
                    <div class="mc-card__id">
                        <h3 class="font-title mc-card__name">${name}</h3>
                        <p class="mc-card__league">${escapeHtml(c.questLevel || 'Uncategorized')}</p>
                        ${slot ? CLASS_SLOT_CHIPS[slot] : ''}
                    </div>
                    <div class="mc-card__side">
                        <div class="mc-card__when">
                            <span class="mc-fact${days.length ? '' : ' is-missing'}"><i class="fas fa-calendar-day" aria-hidden="true"></i>${days.length ? days.join(', ') : 'No days set'}</span>
                            <span class="mc-fact${hasTime ? '' : ' is-missing'}"><i class="fas fa-clock" aria-hidden="true"></i>${hasTime ? `${c.timeStart} – ${c.timeEnd}` : 'No time set'}</span>
                        </div>
                        <div class="mc-setup" role="group" aria-label="Set up this class">
                            <button type="button" data-id="${c.id}" class="mc-setup__btn mc-setup__btn--edit edit-class-btn${unscheduled ? ' is-nudge' : ''}" title="Change the class name, league, logo, days and times">
                                <span class="mc-setup__icon" aria-hidden="true"><i class="fas fa-pen-to-square"></i></span><span>${unscheduled ? 'Set schedule' : 'Edit class'}</span>
                            </button>
                            <button type="button" data-id="${c.id}" class="mc-setup__btn mc-setup__btn--delete delete-class-btn" title="Delete ${name} and all its students" aria-label="Delete ${name}">
                                <span class="mc-setup__icon" aria-hidden="true"><i class="fas fa-trash-can"></i></span><span>Delete class</span>
                            </button>
                        </div>
                    </div>
                </header>
                <div class="mc-tray">
                    <div class="mc-group mc-group--class" role="group" aria-label="In class">
                        <span class="mc-group__label">In class</span>
                        <div class="mc-group__tools mc-oaths-host">
                            ${classTool({ id: c.id, cls: 'manage-students-btn', attrs: `data-name="${name}" `, tone: 'roster', icon: 'fa-users', name: 'Roster',
                                hint: count ? `${count} student${count === 1 ? '' : 's'}` : 'Add your students', nudge: count === 0,
                                title: `Open the ${c.name} roster: add, edit and move students` })}
                        </div>
                    </div>
                    <div class="mc-group mc-group--insight" role="group" aria-label="Insight">
                        <span class="mc-group__label">Insight</span>
                        <div class="mc-group__tools">
                            ${classTool({ id: c.id, cls: 'greenhouse-class-btn', tone: 'greenhouse', icon: 'fa-seedling', name: 'Greenhouse', hint: 'How they\'re growing',
                                title: 'Class Greenhouse: understand and help the whole class' })}
                            ${classTool({ id: c.id, cls: 'report-class-btn', tone: 'report', icon: 'fa-feather-pointed', name: 'Weekly report',
                                hint: eliteAI ? 'This week\'s story' : 'Elite plan', locked: !eliteAI,
                                title: 'Weekly report: what the class did this week, to read or save as a PDF' })}
                        </div>
                    </div>
                </div>
            </article>`;
    }).join('');

    list.querySelectorAll('.manage-students-btn').forEach(btn => btn.addEventListener('click', () => {
        state.set('currentManagingClassId', btn.dataset.id);
        document.getElementById('manage-class-name').innerText = btn.dataset.name;
        document.getElementById('manage-class-id').value = btn.dataset.id;
        showTab('manage-students-tab');
    }));
    list.querySelectorAll('.delete-class-btn').forEach(btn => btn.addEventListener('click', () => modals.showModal('Delete Class?', 'Are you sure you want to delete this class and all its students? This cannot be undone.', () => deleteClass(btn.dataset.id))));
    list.querySelectorAll('.edit-class-btn').forEach(btn => btn.addEventListener('click', () => modals.openEditClassModal(btn.dataset.id)));
    // Ember Oaths joins Roster under "In class".
    if (oaths) import('../../features/campfireEntry.js').then(({ mountCampfireEntry }) => {
        list.querySelectorAll('.mc-oaths-host').forEach(host => mountCampfireEntry(host, host.closest('.mc-card').dataset.classId, { oathsOnly: true }));
    });
    list.querySelectorAll('.report-class-btn').forEach(btn => btn.addEventListener('click', () => modals.handleGenerateReport(btn.dataset.id)));
    list.querySelectorAll('.greenhouse-class-btn').forEach(btn => btn.addEventListener('click', () => openGreenhouse(btn.dataset.id)));
}

function openGreenhouse(classId, options) {
    import('../modals/classGreenhouse.js').then(m => m.openClassGreenhouse(classId, options));
}

// --- Roster tools: one delegated click listener per list, bound once. The list is morphed on
// every data refresh (rows stay put), so per-button listeners would pile up.
const ROSTER_ACTIONS = {
    'delete-student-btn': (id) => modals.showModal('Delete Student?', 'Are you sure you want to delete this student?', () => deleteStudent(id)),
    'certificate-student-btn': (id) => modals.handleGenerateCertificate(id),
    'edit-student-btn': (id) => modals.openEditStudentModal(id),
    'avatar-maker-btn': (id) => {
        if (!canUseFeature('eliteAI')) {
            showUpgradePrompt({ feature: 'Avatar Forge', tier: 'Elite', message: getUpgradeMessage('Elite') });
            return;
        }
        avatar.openAvatarMaker(id);
    },
    'hero-chronicle-btn': (id) => modals.openHeroChronicleModal(id),
    'parent-access-student-btn': async (id) => {
        openAccessCenterForStudent(id);
        await showTab('options-tab');
        document.querySelector('#options-tab .options-subtab-btn[data-options-tab="access"]')?.click();
    },
    'guild-quiz-btn': (id) => {
        if (!canUseFeature('guilds')) {
            showUpgradePrompt({ feature: 'Guild Sorting Quiz', tier: 'Pro', message: getUpgradeMessage('Pro', 'guilds') });
            return;
        }
        modals.openSortingQuizModal(id);
    },
    'hero-class-select-btn': (id) => {
        if (!canUseFeature('heroProgression')) {
            showUpgradePrompt({ feature: 'Hero Classes & Skill Tree', tier: 'Pro', message: getUpgradeMessage('Pro', 'heroProgression') });
            return;
        }
        modals.openHeroClassSelectModal(id);
    },
    'skill-tree-btn': (id) => {
        if (!canUseFeature('heroProgression')) {
            showUpgradePrompt({ feature: 'Hero Classes & Skill Tree', tier: 'Pro', message: getUpgradeMessage('Pro', 'heroProgression') });
            return;
        }
        openSkillTreeModal(id);
    },
};
const ROSTER_ACTION_SELECTOR = Object.keys(ROSTER_ACTIONS).map((cls) => `.${cls}`).join(', ');
const boundRosterLists = new WeakSet();

function bindRosterActions(list) {
    if (boundRosterLists.has(list)) return;
    boundRosterLists.add(list);
    list.addEventListener('click', (event) => {
        const btn = event.target.closest(ROSTER_ACTION_SELECTOR);
        if (!btn || !list.contains(btn)) return;
        const action = Object.keys(ROSTER_ACTIONS).find((cls) => btn.classList.contains(cls));
        if (action) ROSTER_ACTIONS[action](btn.dataset.id, btn);
    });
}

export function renderManageStudentsTab() {
    const list = document.getElementById('student-list');
    const currentManagingClassId = state.get('currentManagingClassId');
    if (!list || !currentManagingClassId) return;
    const greenhouseBtn = document.getElementById('class-greenhouse-roster-btn');
    if (greenhouseBtn) greenhouseBtn.onclick = () => openGreenhouse(currentManagingClassId);
    bindRosterTips(document.getElementById('manage-students-tab'));

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
        renderRosterTodo([]);
        const unplacedCount = getUnplacedStudents(state.get('allStudents') || []).length;
        morphInto(list, emptyStateHtml({
            icon: 'fa-users',
            title: 'No adventurers yet',
            line: unplacedCount
                ? 'Place returning students from the panel above, or add a brand-new student with New Student.'
                : 'Press New Student at the top to add your first student and start the quest.',
            size: 'lg'
        }));
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

    const todo = { guild: 0, heroClass: 0, skill: 0 };

    morphInto(list, studentsInClass.map((s, index) => {
        const scoreData = state.get('allStudentScores').find(sc => sc.id === s.id);
        const pendingSkill = heroProgressionEnabled && (scoreData?.pendingSkillChoice || false);
        const hc = heroProgressionEnabled && s.heroClass ? (heroClassConfig[s.heroClass] || null) : null;
        if (guildsEnabled && !s.guildId) todo.guild += 1;
        if (heroProgressionEnabled && !s.heroClass) todo.heroClass += 1;
        if (pendingSkill) todo.skill += 1;

        const ringStyle = hc
            ? `box-shadow: 0 0 0 2px white, 0 0 0 4px ${hc.ring};`
            : 'box-shadow: 0 0 0 2px white, 0 0 0 4px #d1d5db;';

        const avatarInner = s.avatar
            ? `<img src="${s.avatar}" alt="${escapeHtml(s.name)}" data-student-id="${s.id}"
                loading="lazy" decoding="async"
                class="student-avatar large-avatar enlargeable-avatar cursor-pointer"
                style="${ringStyle}">`
            : `<div data-student-id="${s.id}"
                class="student-avatar large-avatar enlargeable-avatar cursor-pointer flex items-center justify-center font-title text-white"
                style="font-size:1.25rem; background: linear-gradient(135deg, #2dd4bf, #06b6d4); ${ringStyle}">${escapeHtml(s.name.charAt(0).toUpperCase())}</div>`;
        const avatarHtml = wrapAvatarWithLevelUpIndicator(avatarInner, pendingSkill);

        const heroLevel = heroProgressionEnabled ? (scoreData?.heroLevel || 0) : 0;
        const heroTitle = heroProgressionEnabled && s.heroClass && heroLevel > 0 ? getHeroTitle(s.heroClass, heroLevel) : null;
        const tree = heroProgressionEnabled && s.heroClass ? HERO_SKILL_TREE[s.heroClass] : null;
        const auraColor = tree?.auraColor || '#7c3aed';
        const heroTitlePill = heroTitle
            ? `<span class="hero-title-pill roster-chip roster-chip--title" style="--chip-color:${auraColor};">${HERO_CLASSES[s.heroClass]?.icon || ''} ${heroTitle}</span>`
            : '';
        const guild = s.guildId ? getGuildById(s.guildId) : null;
        // Class and guild already show on their own tiles to the right; only the earned rank title sits under the name.
        const heroMetaRow = heroTitlePill ? `<div class="roster-hero__meta">${heroTitlePill}</div>` : '';

        // Every row carries the same tools in the same slots, so the columns line up down the roster.
        // tipTitle + tip feed the custom tooltip (ui/tabs/rosterTips.js); the accessible name keeps the visible label.
        const tool = ({ cls, tone, icon, label, tipTitle, tip, locked = false, tag = 'button' }) => {
            const lock = locked ? '<i class="fas fa-lock roster-tool__lock" aria-hidden="true"></i>' : '';
            const attrs = tag === 'button' ? `type="button" data-id="${s.id}"` : 'tabindex="0" role="img"';
            const name = tipTitle.toLowerCase().includes(label.toLowerCase()) ? tipTitle : `${label}: ${tipTitle}`;
            return `<${tag} ${attrs} class="roster-tool roster-tool--${tone}${locked ? ' is-locked' : ''}${cls ? ' ' + cls : ''}" aria-label="${escapeHtml(name)}" data-tip-title="${escapeHtml(tipTitle)}" data-tip="${escapeHtml(tip)}">
                <span class="roster-tool__icon" aria-hidden="true">${icon}${lock}</span>
                <span class="roster-tool__label" aria-hidden="true">${escapeHtml(label)}</span>
            </${tag}>`;
        };
        const fa = (name) => `<i class="fas ${name}" aria-hidden="true"></i>`;
        const proTip = 'Part of the Pro plan. Tap to see what it adds.';

        const guildTool = s.guildId
            ? tool({ tag: 'span', tone: 'guild', cls: 'is-set', icon: `<span class="guild-badge-wrap">${getGuildBadgeHtml(s.guildId, 'w-7 h-7')}</span>`, label: 'Guild',
                tipTitle: guild ? `Guild: ${guild.name}` : 'Guild', tip: 'Guilds are for life, so there is nothing to change here.' })
            : tool({ cls: `guild-quiz-btn${guildsEnabled ? ' is-todo' : ''}`, tone: 'guild', icon: fa('fa-hat-wizard'), label: 'Sort', locked: !guildsEnabled,
                tipTitle: guildsEnabled ? 'Sort into a guild' : 'Guild Quiz (Pro plan)',
                tip: guildsEnabled ? 'Opens the Guild Quiz. A few questions, and the student joins a guild for good.' : proTip });

        const heroClassSetTip = () => {
            if (!heroProgressionEnabled) return 'Hero Classes are part of the Pro plan.';
            const yearKey = state.getActiveSchoolYearKey();
            if (heroClassLockApplies(s, yearKey)) return 'Locked until next school year. Tap to see the path.';
            const left = heroClassChangesRemaining(s, yearKey);
            return `Tap to change it in the Deck of Paths. ${left} change${left === 1 ? '' : 's'} left this school year.`;
        };
        const heroClassTool = s.heroClass
            ? tool({ tag: heroProgressionEnabled ? 'button' : 'span', tone: 'class', cls: `is-set${heroProgressionEnabled ? ' hero-class-select-btn' : ''}`, icon: `<span class="roster-tool__emoji">${hc?.icon || HERO_CLASSES[s.heroClass]?.icon || '🛡️'}</span>`, label: s.heroClass,
                tipTitle: `Hero Class: ${s.heroClass}`, tip: heroClassSetTip() })
            : tool({ cls: `hero-class-select-btn${heroProgressionEnabled ? ' is-todo' : ''}`, tone: 'class', icon: fa('fa-shield-halved'), label: 'Class', locked: !heroProgressionEnabled,
                tipTitle: heroProgressionEnabled ? 'Choose a Hero Class' : 'Hero Classes (Pro plan)',
                tip: heroProgressionEnabled ? 'Opens the Deck of Paths, where the student picks the hero they want to be.' : proTip });

        const skillTool = tool({
            cls: `skill-tree-btn${!heroProgressionEnabled ? ' skill-tree-btn-locked' : ''}${pendingSkill ? ' is-ready' : ''}`,
            tone: 'skills',
            icon: fa('fa-sitemap') + (pendingSkill ? '<span class="roster-tool__ping" aria-hidden="true"></span>' : ''),
            label: 'Skills',
            locked: !heroProgressionEnabled,
            tipTitle: !heroProgressionEnabled ? 'Skill Tree (Pro plan)' : (pendingSkill ? 'A new skill is waiting!' : 'Skill Tree'),
            tip: !heroProgressionEnabled ? proTip
                : (pendingSkill ? 'Open the Skill Tree so the student can choose their new skill.' : 'The skills this hero has learned, and the ones still ahead.')
        });

        const avatarTool = tool({
            cls: `avatar-maker-btn${eliteAiEnabled ? '' : ' avatar-maker-btn-locked'}`,
            tone: 'avatar', icon: fa('fa-user-astronaut'), label: 'Avatar',
            locked: !eliteAiEnabled,
            tipTitle: eliteAiEnabled ? 'Avatar Forge' : 'Avatar Forge (Elite plan)',
            tip: eliteAiEnabled ? 'Make or change this hero\'s portrait.' : 'Part of the Elite plan. Tap to see what it adds.'
        });

        const accent = guild?.primary || (hc ? hc.ring : '');
        const rowStyle = `--row-i:${Math.min(index, 12)};${accent ? `--roster-accent:${accent};` : ''}`;

        return `
        <article class="roster-row" data-morph-key="${s.id}" style="${rowStyle}">
            <div class="roster-hero">
                <div class="roster-hero__avatar">${avatarHtml}</div>
                <div class="roster-hero__text">
                    <p class="roster-hero__name">${escapeHtml(s.name)}</p>
                    ${heroMetaRow}
                </div>
            </div>
            <div class="roster-tools">
                <div class="roster-group roster-group--hero" role="group" aria-label="Hero path">
                    <span class="roster-group__caption" aria-hidden="true"><i class="fas fa-shield-halved"></i> Hero path</span>
                    <div class="roster-group__tools">
                        ${guildTool}
                        ${heroClassTool}
                        ${skillTool}
                    </div>
                </div>
                <div class="roster-group roster-group--records" role="group" aria-label="Records">
                    <span class="roster-group__caption" aria-hidden="true"><i class="fas fa-book-open"></i> Records</span>
                    <div class="roster-group__tools">
                        ${tool({ cls: 'hero-chronicle-btn', tone: 'chronicle', icon: fa('fa-book-reader'), label: 'Chronicle', tipTitle: 'Hero\'s Chronicle', tip: 'Your private notebook about this student. Families never see it.' })}
                        ${tool({ cls: 'parent-access-student-btn', tone: 'parents', icon: fa('fa-user-shield'), label: 'Parents', tipTitle: 'Family login', tip: 'Make or share the login that lets this student\'s family follow along.' })}
                        ${avatarTool}
                        ${tool({ cls: 'certificate-student-btn', tone: 'certificate', icon: fa('fa-award'), label: 'Certificate', tipTitle: 'Certificate', tip: 'Make a certificate of praise to print or save.' })}
                    </div>
                </div>
                <div class="roster-group roster-group--admin" role="group" aria-label="Manage">
                    <span class="roster-group__caption" aria-hidden="true"><i class="fas fa-sliders-h"></i> Manage</span>
                    <div class="roster-group__tools">
                        ${tool({ cls: 'edit-student-btn', tone: 'edit', icon: fa('fa-pencil-alt'), label: 'Edit', tipTitle: 'Edit details', tip: 'Opens the Adventurer\'s Passport: name, birthday, name day, and Move to another class.' })}
                        ${tool({ cls: 'delete-student-btn', tone: 'delete', icon: fa('fa-trash-alt'), label: 'Delete', tipTitle: 'Delete student', tip: 'Removes the student for good. You will be asked first.' })}
                    </div>
                </div>
            </div>
        </article>`;
    }).join(''));

    renderRosterTodo([
        todo.skill && { tone: 'skills', icon: 'fa-wand-sparkles', text: `${todo.skill} new skill${todo.skill === 1 ? '' : 's'} to choose` },
        todo.guild && { tone: 'guild', icon: 'fa-hat-wizard', text: `${todo.guild} not in a guild yet` },
        todo.heroClass && { tone: 'class', icon: 'fa-shield-halved', text: `${todo.heroClass} without a Hero Class` },
    ].filter(Boolean));

    bindRosterActions(list);
}

// "Waiting for you" line above the roster: what still needs the teacher, as plain counts.
function renderRosterTodo(items) {
    const line = document.getElementById('roster-todo');
    if (!line) return;
    line.classList.toggle('hidden', items.length === 0);
    line.innerHTML = items.length
        ? `<span class="roster-todo__label">Waiting for you:</span>${items.map((item) =>
            `<span class="roster-todo__chip roster-todo__chip--${item.tone}"><i class="fas ${item.icon}" aria-hidden="true"></i>${item.text}</span>`).join('')}`
        : '';
}
