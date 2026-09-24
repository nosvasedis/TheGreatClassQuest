import * as state from '../state.js';
import { db, collection, getDocs, query, where } from '../firebase.js';
import { getQuestLeagueDefinition, questLeagues } from '../constants.js';
import { showToast } from '../ui/effects.js';
import { showLogoPicker } from '../ui/modals/base.js';
import { callGeminiApi } from '../api.js';
import { getAgeGroupForLeague } from '../utils.js';
import { canUseFeature } from '../utils/subscription.js';
import { requireEliteAI } from '../utils/upgradePrompt.js';
import { assignClassTeacher } from '../utils/adminRuntime.js';
import {
    createClass,
    deleteEmptyClass,
    showClassCreationLimitIfNeeded,
    updateClassDetails
} from '../db/actions/classes.js';
import { escapeHtml, initials, setBusyState } from './roles/shared.js';
import { formatClassSchedule } from './secretary/helpers.js';

const WIZARD_ID = 'class-desk-wizard';
const DAYS = [
    { value: '1', label: 'Mon' },
    { value: '2', label: 'Tue' },
    { value: '3', label: 'Wed' },
    { value: '4', label: 'Thu' },
    { value: '5', label: 'Fri' },
    { value: '6', label: 'Sat' },
    { value: '0', label: 'Sun' }
];

const STEPS = Object.freeze({
    LIST: 'list',
    TEACHER: 'teacher',
    IDENTITY: 'identity',
    LEAGUE: 'league',
    SCHEDULE: 'schedule',
    REVIEW: 'review',
    EDIT: 'edit'
});

const CREATE_FLOW = [STEPS.TEACHER, STEPS.IDENTITY, STEPS.LEAGUE, STEPS.SCHEDULE, STEPS.REVIEW];

const CREATE_STEPS = Object.freeze([
    { id: STEPS.TEACHER, label: 'Teacher', icon: 'fa-chalkboard-user' },
    { id: STEPS.IDENTITY, label: 'Name', icon: 'fa-pen-nib' },
    { id: STEPS.LEAGUE, label: 'League', icon: 'fa-crown' },
    { id: STEPS.SCHEDULE, label: 'Schedule', icon: 'fa-clock' },
    { id: STEPS.REVIEW, label: 'Review', icon: 'fa-clipboard-check' }
]);

const wizardState = {
    step: STEPS.LIST,
    teacherUid: '',
    teacherName: '',
    name: '',
    logo: '📚',
    questLevel: '',
    scheduleDays: [],
    timeStart: '',
    timeEnd: '',
    editClassId: '',
    confirmDeleteId: '',
    teacherSearch: '',
    nameSuggestions: [],
    teachers: [],
    teachersLoaded: false,
    teachersLoading: false,
    listenersBound: false
};

let onClassDeskRerender = null;

function hasFullConsole() {
    return canUseFeature('secretaryAccess');
}

function activeClasses() {
    return (state.get('allSchoolClasses') || [])
        .filter((item) => item.status !== 'archived')
        .slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function rosterCount(classId) {
    return (state.get('allStudents') || []).filter((student) => (
        student.classId === classId && student.enrollmentStatus !== 'inactive'
    )).length;
}

function classById(classId) {
    return activeClasses().find((item) => item.id === classId) || null;
}

function selectedTeacher() {
    return wizardState.teachers.find((teacher) => teacher.uid === wizardState.teacherUid)
        || (wizardState.teacherUid
            ? { uid: wizardState.teacherUid, name: wizardState.teacherName || 'Teacher' }
            : null);
}

function teachingThisYearUids() {
    return new Set(activeClasses().map((item) => item.createdBy?.uid).filter(Boolean));
}

function resetCreateDraft({ keepTeacher = false } = {}) {
    if (!keepTeacher) {
        wizardState.teacherUid = '';
        wizardState.teacherName = '';
    }
    wizardState.name = '';
    wizardState.logo = '📚';
    wizardState.questLevel = '';
    wizardState.scheduleDays = [];
    wizardState.timeStart = '';
    wizardState.timeEnd = '';
    wizardState.editClassId = '';
    wizardState.confirmDeleteId = '';
    wizardState.nameSuggestions = [];
    wizardState.teacherSearch = '';
}

function loadEditDraft(classData) {
    wizardState.editClassId = classData.id;
    wizardState.teacherUid = classData.createdBy?.uid || '';
    wizardState.teacherName = classData.createdBy?.name || '';
    wizardState.name = classData.name || '';
    wizardState.logo = classData.logo || '📚';
    wizardState.questLevel = classData.questLevel || '';
    wizardState.scheduleDays = [...(classData.scheduleDays || [])];
    wizardState.timeStart = classData.timeStart || '';
    wizardState.timeEnd = classData.timeEnd || '';
    wizardState.confirmDeleteId = '';
    wizardState.nameSuggestions = [];
}

function renderLeagueChip(leagueName) {
    const definition = getQuestLeagueDefinition(leagueName);
    if (!definition) {
        return `<span class="placement-league-chip placement-league-chip--unknown">League not recorded</span>`;
    }
    const ageLabel = definition.ageGroup.includes('-')
        ? definition.ageGroup.replace('-', '–')
        : definition.ageGroup;
    return `
        <span class="placement-league-chip league-picker-option--${escapeHtml(definition.pickerTheme)}" title="Ages ${escapeHtml(ageLabel)}">
            <i class="fas ${escapeHtml(definition.pickerIcon)}" aria-hidden="true"></i>
            <span class="placement-league-chip__name">${escapeHtml(definition.name)}</span>
            <span class="placement-league-chip__age">Ages ${escapeHtml(ageLabel)}</span>
        </span>
    `;
}

export function renderClassLauncher({ classCount } = {}) {
    const count = Number.isFinite(classCount) ? classCount : activeClasses().length;
    const badge = count === 1 ? '1 class' : `${count} classes`;
    return `
        <section class="secretary-card class-desk-launcher">
            <div class="class-desk-launcher__glow" aria-hidden="true"></div>
            <div class="secretary-card__header">
                <div>
                    <p class="secretary-card__eyebrow">This year's classes</p>
                    <h3 class="secretary-card__title">Create and manage classes</h3>
                </div>
                <div class="secretary-card__badge">${escapeHtml(badge)}</div>
            </div>
            <p class="text-sm text-slate-600 leading-relaxed">
                ${count
                    ? 'Give each teacher their classes for this year — name, logo, league, schedule, and who teaches them.'
                    : 'Start here. Create this year’s classes for each teacher, then seat returning students.'}
            </p>
            <button type="button" id="school-year-class-desk-open-btn" class="secretary-shell__primary-btn class-desk-launcher__cta">
                <i class="fas fa-chalkboard-user mr-2" aria-hidden="true"></i>Open class desk
            </button>
        </section>
    `;
}

async function ensureTeachers() {
    if (wizardState.teachersLoaded || wizardState.teachersLoading) return;
    wizardState.teachersLoading = true;
    try {
        const snap = await getDocs(query(collection(db, 'user_profiles'), where('role', '==', 'teacher')));
        const fromProfiles = snap.docs.map((docSnap) => {
            const data = docSnap.data() || {};
            if (data.status && data.status !== 'active') return null;
            return { uid: docSnap.id, name: data.displayName || 'Teacher' };
        }).filter(Boolean);
        const fromClasses = (state.get('allSchoolClasses') || [])
            .map((item) => item.createdBy)
            .filter((owner) => owner?.uid)
            .map((owner) => ({ uid: owner.uid, name: owner.name || 'Teacher' }));
        const map = new Map();
        for (const teacher of [...fromProfiles, ...fromClasses]) {
            if (!map.has(teacher.uid)) map.set(teacher.uid, teacher);
        }
        wizardState.teachers = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
        wizardState.teachersLoaded = true;
    } catch (error) {
        console.error('Could not load teachers for class desk:', error);
        const fallback = new Map();
        for (const item of activeClasses()) {
            if (item.createdBy?.uid && !fallback.has(item.createdBy.uid)) {
                fallback.set(item.createdBy.uid, {
                    uid: item.createdBy.uid,
                    name: item.createdBy.name || 'Teacher'
                });
            }
        }
        wizardState.teachers = [...fallback.values()].sort((a, b) => a.name.localeCompare(b.name));
        wizardState.teachersLoaded = true;
        showToast('Could not load every teacher list. Showing teachers who already have classes.', 'info');
    } finally {
        wizardState.teachersLoading = false;
    }
}

function paintWizard({ searchCaret } = {}) {
    const modal = document.getElementById(WIZARD_ID);
    if (!modal) return;
    const title = document.getElementById('class-desk-title');
    const subtitle = document.getElementById('class-desk-subtitle');
    const steps = document.getElementById('class-desk-steps');
    const body = document.getElementById('class-desk-body');
    const footer = document.getElementById('class-desk-footer');
    if (!title || !body || !footer) return;

    const copy = headingCopy();
    title.textContent = copy.title;
    subtitle.textContent = copy.subtitle;
    steps.innerHTML = renderSteps();
    body.innerHTML = renderBody();
    footer.innerHTML = renderFooter();

    const search = document.getElementById('class-desk-teacher-search');
    if (search && typeof searchCaret === 'number') {
        search.focus();
        const caret = Math.min(searchCaret, search.value.length);
        search.setSelectionRange(caret, caret);
    }
}

function headingCopy() {
    if (wizardState.step === STEPS.EDIT) {
        return {
            title: 'Edit this class',
            subtitle: 'Name, logo, league, schedule, and teacher — all in one place.'
        };
    }
    if (wizardState.step === STEPS.LIST) {
        const count = activeClasses().length;
        return {
            title: 'This year’s classes',
            subtitle: count
                ? 'Tap a class to edit it, or create a new one for a teacher.'
                : 'No classes yet. Create the first one for a teacher.'
        };
    }
    if (wizardState.step === STEPS.TEACHER) {
        return { title: 'Who teaches this class?', subtitle: 'Choose the Quest Master who will own this classroom.' };
    }
    if (wizardState.step === STEPS.IDENTITY) {
        return { title: 'Name and emblem', subtitle: 'Give the class a living name and a logo the children will recognise.' };
    }
    if (wizardState.step === STEPS.LEAGUE) {
        return { title: 'Quest League', subtitle: 'This chooses map peers, Market tone, and certificate voice.' };
    }
    if (wizardState.step === STEPS.SCHEDULE) {
        return { title: 'When do they meet?', subtitle: 'Lesson days and times. You can still change these later.' };
    }
    return { title: 'Review and create', subtitle: 'Check the teacher, name, league, and schedule, then create the class.' };
}

function renderSteps() {
    if (wizardState.step === STEPS.LIST || wizardState.step === STEPS.EDIT) return '';
    const index = CREATE_FLOW.indexOf(wizardState.step);
    const pct = ((index + 1) / CREATE_FLOW.length) * 100;
    return `
        <ol class="class-desk-steps">
            ${CREATE_STEPS.map((step, i) => {
                const current = i === index;
                const done = i < index;
                const icon = done ? 'fa-check' : step.icon;
                const inner = `
                    <span class="class-desk-step__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
                    <span class="class-desk-step__label">${escapeHtml(step.label)}</span>
                `;
                if (done) {
                    return `
                        <li>
                            <button type="button"
                                class="class-desk-step is-done"
                                data-class-desk-goto="${escapeHtml(step.id)}"
                                aria-label="Back to ${escapeHtml(step.label)}">
                                ${inner}
                            </button>
                        </li>
                    `;
                }
                return `
                    <li>
                        <span class="class-desk-step${current ? ' is-current' : ''}"${current ? ' aria-current="step"' : ''}>
                            ${inner}
                        </span>
                    </li>
                `;
            }).join('')}
        </ol>
        <div class="class-desk-progress" aria-hidden="true">
            <span style="width: ${pct}%"></span>
        </div>
    `;
}

function renderTeacherTile(teacher, { selected = false, classCount = 0 } = {}) {
    const countLabel = classCount === 1 ? '1 class this year' : `${classCount} classes this year`;
    return `
        <button type="button"
            class="class-desk-teacher-tile${selected ? ' is-selected' : ''}"
            data-class-desk-teacher="${escapeHtml(teacher.uid)}"
            aria-pressed="${selected ? 'true' : 'false'}">
            <span class="class-desk-teacher-tile__avatar" aria-hidden="true">${escapeHtml(initials(teacher.name))}</span>
            <span class="class-desk-teacher-tile__copy">
                <strong>${escapeHtml(teacher.name)}</strong>
                <span class="class-desk-teacher-tile__meta">${escapeHtml(classCount ? countLabel : 'Ready for a new class')}</span>
            </span>
            ${selected ? '<span class="class-desk-check" aria-hidden="true"><i class="fas fa-check"></i></span>' : ''}
        </button>
    `;
}

function filteredTeachers() {
    const queryText = String(wizardState.teacherSearch || '').trim().toLowerCase();
    const thisYear = teachingThisYearUids();
    const ranked = wizardState.teachers.slice().sort((a, b) => {
        const aYear = thisYear.has(a.uid) ? 0 : 1;
        const bYear = thisYear.has(b.uid) ? 0 : 1;
        if (aYear !== bYear) return aYear - bYear;
        return a.name.localeCompare(b.name);
    });
    if (!queryText) return ranked;
    return ranked.filter((teacher) => teacher.name.toLowerCase().includes(queryText));
}

function renderTeacherPicker({ includeSearch = true } = {}) {
    if (wizardState.teachersLoading) {
        return `<div class="placement-empty"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i><h4>Finding Quest Masters</h4><p>Loading teachers for this school.</p></div>`;
    }
    const teachers = filteredTeachers();
    const thisYear = teachingThisYearUids();
    const counts = new Map();
    for (const item of activeClasses()) {
        const uid = item.createdBy?.uid;
        if (!uid) continue;
        counts.set(uid, (counts.get(uid) || 0) + 1);
    }
    if (!wizardState.teachers.length) {
        return `
            <div class="placement-empty">
                <i class="fas fa-user-plus" aria-hidden="true"></i>
                <h4>No Quest Masters yet</h4>
                <p>Teachers need a Quest Master account first. Once they have signed in, you can give them classes here.</p>
            </div>
        `;
    }
    return `
        ${includeSearch ? `
            <label class="class-desk-search">
                <i class="fas fa-search" aria-hidden="true"></i>
                <input type="search" id="class-desk-teacher-search" value="${escapeHtml(wizardState.teacherSearch)}" placeholder="Search teachers..." autocomplete="off">
            </label>
        ` : ''}
        <div class="class-desk-teacher-grid">
            ${teachers.map((teacher) => renderTeacherTile(teacher, {
                selected: teacher.uid === wizardState.teacherUid,
                classCount: counts.get(teacher.uid) || 0
            })).join('')}
        </div>
        ${thisYear.size && includeSearch ? '<p class="placement-hint">Teachers already teaching this year appear first.</p>' : ''}
    `;
}

function renderListBody() {
    const classes = activeClasses();
    const grouped = new Map();
    for (const item of classes) {
        const key = item.createdBy?.uid || 'unassigned';
        const title = item.createdBy?.name || 'No teacher yet';
        if (!grouped.has(key)) grouped.set(key, { title, classes: [] });
        grouped.get(key).classes.push(item);
    }
    const groups = [...grouped.values()].sort((a, b) => a.title.localeCompare(b.title));
    return `
        ${classes.length ? `
            <div class="class-desk-groups">
                ${groups.map((group) => `
                    <section class="class-desk-group">
                        <h4 class="class-desk-group__title">
                            <i class="fas fa-user" aria-hidden="true"></i>
                            ${escapeHtml(group.title)}
                            <span>${group.classes.length}</span>
                        </h4>
                        <div class="class-desk-class-grid">
                            ${group.classes.map((item) => {
                                const count = rosterCount(item.id);
                                return `
                                    <button type="button" class="class-desk-class-tile" data-class-desk-edit="${escapeHtml(item.id)}">
                                        <span class="placement-class-tile__logo" aria-hidden="true">${escapeHtml(item.logo || '📚')}</span>
                                        <span class="placement-class-tile__copy">
                                            <strong>${escapeHtml(item.name)}</strong>
                                            ${renderLeagueChip(item.questLevel)}
                                            <span class="placement-class-tile__roster">${escapeHtml(formatClassSchedule(item))}</span>
                                            <span class="placement-class-tile__roster">${count} ${count === 1 ? 'student' : 'students'}</span>
                                        </span>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </section>
                `).join('')}
            </div>
        ` : `
            <div class="placement-empty">
                <i class="fas fa-sparkles" aria-hidden="true"></i>
                <h4>Ready when you are</h4>
                <p>Create a class for each teacher. Returning heroes can sit down once the classrooms exist.</p>
            </div>
        `}
    `;
}

function renderIdentityBody() {
    return `
        <div class="class-desk-identity">
            <label class="secretary-field class-desk-logo-field">
                <span>Class logo</span>
                <button type="button" id="class-desk-logo-btn" class="class-desk-logo-btn" data-class-desk-logo>
                    ${escapeHtml(wizardState.logo || '📚')}
                </button>
                <input type="hidden" id="class-desk-logo" value="${escapeHtml(wizardState.logo || '📚')}">
            </label>
            <label class="secretary-field class-desk-name-field">
                <span>Class name</span>
                <div class="class-desk-name-row">
                    <input type="text" id="class-desk-name" value="${escapeHtml(wizardState.name)}" placeholder="The Star Seekers" autocomplete="off">
                    ${canUseFeature('eliteAI') ? `
                        <button type="button" class="secretary-shell__secondary-btn" data-class-desk-suggest-name title="Suggest names">
                            <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
                        </button>
                    ` : ''}
                </div>
            </label>
        </div>
        <div id="class-desk-name-suggestions" class="class-desk-suggestions">
            ${wizardState.nameSuggestions.map((name) => (
                `<button type="button" class="class-desk-suggestion" data-class-desk-use-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`
            )).join('')}
        </div>
    `;
}

function renderLeagueBody() {
    return `
        <div class="class-desk-league-grid">
            ${questLeagues.map((league) => {
                const selected = wizardState.questLevel === league;
                return `
                    <button type="button" class="class-desk-league-tile${selected ? ' is-selected' : ''}" data-class-desk-league="${escapeHtml(league)}">
                        ${renderLeagueChip(league)}
                        ${selected ? '<span class="class-desk-check" aria-hidden="true"><i class="fas fa-check"></i></span>' : ''}
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

function renderScheduleBody() {
    return `
        <div class="class-desk-days" role="group" aria-label="Lesson days">
            ${DAYS.map((day) => {
                const on = wizardState.scheduleDays.includes(day.value);
                return `
                    <button type="button" class="class-desk-day${on ? ' is-on' : ''}" data-class-desk-day="${day.value}">
                        ${day.label}
                    </button>
                `;
            }).join('')}
        </div>
        <div class="class-desk-times">
            <label class="secretary-field">
                <span><i class="far fa-clock" aria-hidden="true"></i> Starts</span>
                <input type="time" id="class-desk-time-start" value="${escapeHtml(wizardState.timeStart)}">
            </label>
            <label class="secretary-field">
                <span><i class="far fa-clock" aria-hidden="true"></i> Ends</span>
                <input type="time" id="class-desk-time-end" value="${escapeHtml(wizardState.timeEnd)}">
            </label>
        </div>
    `;
}

function renderSummaryCard() {
    const teacher = selectedTeacher();
    return `
        <div class="class-desk-summary">
            <span class="placement-class-tile__logo" aria-hidden="true">${escapeHtml(wizardState.logo || '📚')}</span>
            <div>
                <p class="class-desk-summary__kicker">${escapeHtml(teacher?.name || 'No teacher yet')}</p>
                <strong>${escapeHtml(wizardState.name || 'Untitled class')}</strong>
                <div class="class-desk-summary__meta">
                    ${wizardState.questLevel ? renderLeagueChip(wizardState.questLevel) : '<span class="placement-league-chip placement-league-chip--unknown">Choose a league</span>'}
                    <span>${escapeHtml(formatClassSchedule({
                        scheduleDays: wizardState.scheduleDays,
                        timeStart: wizardState.timeStart,
                        timeEnd: wizardState.timeEnd
                    }))}</span>
                </div>
            </div>
        </div>
    `;
}

function renderReviewBody() {
    return `
        ${renderSummaryCard()}
        <p class="placement-hint">The teacher will see this class in their own Teacher App. You can still edit it from this desk.</p>
    `;
}

function renderEditBody() {
    const classData = classById(wizardState.editClassId);
    const count = classData ? rosterCount(classData.id) : 0;
    const confirming = wizardState.confirmDeleteId === wizardState.editClassId;
    return `
        ${renderSummaryCard()}
        <div class="class-desk-edit-stack">
            ${renderTeacherPicker({ includeSearch: true })}
            ${renderIdentityBody()}
            ${renderLeagueBody()}
            ${renderScheduleBody()}
        </div>
        ${count === 0 ? `
            <div class="class-desk-danger">
                ${confirming ? `
                    <p>Remove this empty class? This cannot be undone.</p>
                    <div class="class-desk-danger__actions">
                        <button type="button" class="secretary-shell__secondary-btn" data-class-desk-cancel-delete>Keep class</button>
                        <button type="button" class="secretary-shell__primary-btn school-year-danger-btn" data-class-desk-confirm-delete>Remove class</button>
                    </div>
                ` : `
                    <button type="button" class="secretary-chip-btn secretary-chip-btn--rose" data-class-desk-delete>Remove empty class</button>
                `}
            </div>
        ` : `<p class="placement-hint">${count} ${count === 1 ? 'student is' : 'students are'} seated here. Move them before removing the class.</p>`}
    `;
}

function renderBody() {
    if (wizardState.step === STEPS.LIST) return renderListBody();
    if (wizardState.step === STEPS.TEACHER) return renderTeacherPicker();
    if (wizardState.step === STEPS.IDENTITY) return renderIdentityBody();
    if (wizardState.step === STEPS.LEAGUE) return renderLeagueBody();
    if (wizardState.step === STEPS.SCHEDULE) return renderScheduleBody();
    if (wizardState.step === STEPS.REVIEW) return renderReviewBody();
    if (wizardState.step === STEPS.EDIT) return renderEditBody();
    return '';
}

function renderFooter() {
    if (wizardState.step === STEPS.LIST) {
        return `
            <button type="button" class="secretary-shell__secondary-btn" data-class-desk-close>Done</button>
            <button type="button" class="secretary-shell__primary-btn" data-class-desk-new>
                <i class="fas fa-plus mr-2" aria-hidden="true"></i>New class
            </button>
        `;
    }
    if (wizardState.step === STEPS.EDIT) {
        return `
            <button type="button" class="secretary-shell__secondary-btn" data-class-desk-back>Back to list</button>
            <button type="button" class="secretary-shell__primary-btn" data-class-desk-save ${wizardState.name && wizardState.questLevel && wizardState.teacherUid ? '' : 'disabled'}>
                Save class
            </button>
        `;
    }
    const back = `<button type="button" class="secretary-shell__secondary-btn" data-class-desk-back><i class="fas fa-arrow-left mr-2" aria-hidden="true"></i>Back</button>`;
    if (wizardState.step === STEPS.REVIEW) {
        const ready = wizardState.teacherUid && wizardState.name && wizardState.questLevel;
        return `
            ${back}
            <button type="button" class="secretary-shell__primary-btn" data-class-desk-create ${ready ? '' : 'disabled'}>
                Create class
            </button>
        `;
    }
    const canContinue = canAdvance();
    return `
        ${back}
        <button type="button" class="secretary-shell__primary-btn" data-class-desk-continue ${canContinue ? '' : 'disabled'}>
            Continue<i class="fas fa-arrow-right ml-2" aria-hidden="true"></i>
        </button>
    `;
}

function canAdvance() {
    if (wizardState.step === STEPS.TEACHER) return Boolean(wizardState.teacherUid);
    if (wizardState.step === STEPS.IDENTITY) return Boolean(String(wizardState.name || '').trim());
    if (wizardState.step === STEPS.LEAGUE) return Boolean(wizardState.questLevel);
    if (wizardState.step === STEPS.SCHEDULE) return true;
    return false;
}

function goBack() {
    if (wizardState.step === STEPS.EDIT) {
        wizardState.step = STEPS.LIST;
        wizardState.editClassId = '';
        wizardState.confirmDeleteId = '';
        paintWizard();
        return;
    }
    const index = CREATE_FLOW.indexOf(wizardState.step);
    if (index <= 0) {
        wizardState.step = STEPS.LIST;
        resetCreateDraft();
        paintWizard();
        return;
    }
    wizardState.step = CREATE_FLOW[index - 1];
    paintWizard();
}

function goForward() {
    const index = CREATE_FLOW.indexOf(wizardState.step);
    if (index < 0 || index >= CREATE_FLOW.length - 1 || !canAdvance()) return;
    wizardState.step = CREATE_FLOW[index + 1];
    paintWizard();
}

function goToCreateStep(stepId) {
    const target = CREATE_FLOW.indexOf(stepId);
    const current = CREATE_FLOW.indexOf(wizardState.step);
    if (target < 0 || current < 0 || target >= current) return;
    wizardState.step = stepId;
    paintWizard();
}

function captureFormFields() {
    const nameInput = document.getElementById('class-desk-name');
    if (nameInput) wizardState.name = nameInput.value;
    const start = document.getElementById('class-desk-time-start');
    if (start) wizardState.timeStart = start.value;
    const end = document.getElementById('class-desk-time-end');
    if (end) wizardState.timeEnd = end.value;
    const logo = document.getElementById('class-desk-logo');
    if (logo) wizardState.logo = logo.value || wizardState.logo;
}

async function runCreate(button) {
    captureFormFields();
    const teacher = selectedTeacher();
    if (!teacher || !wizardState.name.trim() || !wizardState.questLevel) {
        showToast('Choose a teacher, name, and Quest League first.', 'info');
        return;
    }
    if (showClassCreationLimitIfNeeded(teacher.uid)) return;
    try {
        setBusyState(button, true, 'Creating...');
        await createClass({
            name: wizardState.name.trim(),
            questLevel: wizardState.questLevel,
            logo: wizardState.logo || '📚',
            scheduleDays: wizardState.scheduleDays,
            timeStart: wizardState.timeStart,
            timeEnd: wizardState.timeEnd,
            createdBy: { uid: teacher.uid, name: teacher.name }
        }, { silent: true });
        showToast(`${wizardState.name.trim()} is ready for ${teacher.name}.`, 'success');
        onClassDeskRerender?.();
        resetCreateDraft({ keepTeacher: true });
        wizardState.step = STEPS.LIST;
        paintWizard();
    } catch (error) {
        console.error('Could not create class:', error);
        showToast(error?.message || 'Could not create that class.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function runSave(button) {
    captureFormFields();
    const classData = classById(wizardState.editClassId);
    const teacher = selectedTeacher();
    if (!classData || !teacher || !wizardState.name.trim() || !wizardState.questLevel) {
        showToast('Choose a teacher, name, and Quest League first.', 'info');
        return;
    }
    const teacherChanged = classData.createdBy?.uid !== teacher.uid;
    if (teacherChanged && showClassCreationLimitIfNeeded(teacher.uid)) return;
    try {
        setBusyState(button, true, 'Saving...');
        if (teacherChanged) {
            await assignClassTeacher({
                classId: classData.id,
                teacherUid: teacher.uid,
                teacherName: teacher.name
            });
        }
        await updateClassDetails(classData.id, {
            name: wizardState.name.trim(),
            questLevel: wizardState.questLevel,
            logo: wizardState.logo || '📚',
            scheduleDays: wizardState.scheduleDays,
            timeStart: wizardState.timeStart,
            timeEnd: wizardState.timeEnd
        }, { silent: true });
        showToast(`${wizardState.name.trim()} is updated.`, 'success');
        onClassDeskRerender?.();
        wizardState.step = STEPS.LIST;
        wizardState.editClassId = '';
        paintWizard();
    } catch (error) {
        console.error('Could not update class:', error);
        showToast(error?.message || 'Could not save that class.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function runDelete(button) {
    const classId = wizardState.editClassId;
    if (!classId) return;
    try {
        setBusyState(button, true, 'Removing...');
        const ok = await deleteEmptyClass(classId);
        if (!ok) return;
        onClassDeskRerender?.();
        wizardState.step = STEPS.LIST;
        wizardState.editClassId = '';
        wizardState.confirmDeleteId = '';
        paintWizard();
    } catch (error) {
        console.error('Could not remove class:', error);
        showToast(error?.message || 'Could not remove that class.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function runSuggestNames(button) {
    captureFormFields();
    if (!requireEliteAI({ feature: 'Class name suggestions' })) return;
    try {
        setBusyState(button, true, '');
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        const league = wizardState.questLevel;
        const ageGroup = league ? getAgeGroupForLeague(league) : '6-14';
        const systemPrompt = `You are a creative assistant helping a teacher name their class team. Generate 3 short, catchy, fantasy/adventure themed class names suitable for children aged ${ageGroup}. Do not use numbers. Return only the names separated by commas (e.g. 'Star Seekers, Dragon Riders, Time Travelers').`;
        const userPrompt = league
            ? `Generate names for a class in the "${league}" league.`
            : 'Generate names for an English class of children.';
        const result = await callGeminiApi(systemPrompt, userPrompt);
        wizardState.nameSuggestions = String(result || '')
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean)
            .slice(0, 4);
        paintWizard();
    } catch (error) {
        console.error(error);
        showToast('The naming spell failed. Try again!', 'error');
    } finally {
        setBusyState(button, false);
    }
}

function handleWizardClick(event) {
    if (event.target.closest('[data-class-desk-close]') || event.target === event.currentTarget) {
        closeClassWizard();
        return;
    }
    const closeBtn = event.target.closest('.placement-wizard__close');
    if (closeBtn) {
        closeClassWizard();
        return;
    }
    if (event.target.closest('[data-class-desk-new]')) {
        resetCreateDraft();
        wizardState.step = STEPS.TEACHER;
        ensureTeachers().then(() => paintWizard());
        paintWizard();
        return;
    }
    if (event.target.closest('[data-class-desk-back]')) {
        captureFormFields();
        goBack();
        return;
    }
    if (event.target.closest('[data-class-desk-continue]')) {
        captureFormFields();
        goForward();
        return;
    }
    const gotoBtn = event.target.closest('[data-class-desk-goto]');
    if (gotoBtn) {
        captureFormFields();
        goToCreateStep(gotoBtn.dataset.classDeskGoto);
        return;
    }
    const teacherBtn = event.target.closest('[data-class-desk-teacher]');
    if (teacherBtn) {
        const teacher = wizardState.teachers.find((item) => item.uid === teacherBtn.dataset.classDeskTeacher);
        wizardState.teacherUid = teacherBtn.dataset.classDeskTeacher;
        wizardState.teacherName = teacher?.name || wizardState.teacherName;
        paintWizard();
        return;
    }
    const editBtn = event.target.closest('[data-class-desk-edit]');
    if (editBtn) {
        const classData = classById(editBtn.dataset.classDeskEdit);
        if (!classData) return;
        loadEditDraft(classData);
        wizardState.step = STEPS.EDIT;
        ensureTeachers().then(() => paintWizard());
        paintWizard();
        return;
    }
    if (event.target.closest('[data-class-desk-logo]')) {
        captureFormFields();
        showLogoPicker('secretary');
        return;
    }
    const leagueBtn = event.target.closest('[data-class-desk-league]');
    if (leagueBtn) {
        wizardState.questLevel = leagueBtn.dataset.classDeskLeague;
        paintWizard();
        return;
    }
    const dayBtn = event.target.closest('[data-class-desk-day]');
    if (dayBtn) {
        captureFormFields();
        const day = dayBtn.dataset.classDeskDay;
        wizardState.scheduleDays = wizardState.scheduleDays.includes(day)
            ? wizardState.scheduleDays.filter((value) => value !== day)
            : [...wizardState.scheduleDays, day];
        paintWizard();
        return;
    }
    const useName = event.target.closest('[data-class-desk-use-name]');
    if (useName) {
        wizardState.name = useName.dataset.classDeskUseName;
        paintWizard();
        return;
    }
    if (event.target.closest('[data-class-desk-suggest-name]')) {
        runSuggestNames(event.target.closest('[data-class-desk-suggest-name]'));
        return;
    }
    if (event.target.closest('[data-class-desk-create]')) {
        runCreate(event.target.closest('[data-class-desk-create]'));
        return;
    }
    if (event.target.closest('[data-class-desk-save]')) {
        runSave(event.target.closest('[data-class-desk-save]'));
        return;
    }
    if (event.target.closest('[data-class-desk-delete]')) {
        wizardState.confirmDeleteId = wizardState.editClassId;
        paintWizard();
        return;
    }
    if (event.target.closest('[data-class-desk-cancel-delete]')) {
        wizardState.confirmDeleteId = '';
        paintWizard();
        return;
    }
    if (event.target.closest('[data-class-desk-confirm-delete]')) {
        runDelete(event.target.closest('[data-class-desk-confirm-delete]'));
    }
}

function handleWizardInput(event) {
    if (event.target.id === 'class-desk-teacher-search') {
        wizardState.teacherSearch = event.target.value;
        paintWizard({ searchCaret: event.target.selectionStart });
        return;
    }
    if (event.target.id === 'class-desk-name') {
        wizardState.name = event.target.value;
        const footer = document.getElementById('class-desk-footer');
        if (footer) footer.innerHTML = renderFooter();
        return;
    }
    if (event.target.id === 'class-desk-time-start') wizardState.timeStart = event.target.value;
    if (event.target.id === 'class-desk-time-end') wizardState.timeEnd = event.target.value;
}

function handleWizardKeydown(event) {
    if (event.key !== 'Escape') return;
    if (document.getElementById('logo-picker-modal') && !document.getElementById('logo-picker-modal').classList.contains('hidden')) {
        return;
    }
    if (wizardState.step === STEPS.LIST) closeClassWizard();
}

function ensureWizard() {
    let modal = document.getElementById(WIZARD_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = WIZARD_ID;
    modal.className = 'placement-wizard hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'class-desk-title');
    modal.innerHTML = `
        <div class="placement-wizard__panel placement-wizard--sheet pop-in class-desk-panel">
            <header class="placement-wizard__header class-desk-header">
                <div class="placement-wizard__heading">
                    <p class="placement-wizard__eyebrow">This year's classes</p>
                    <h3 id="class-desk-title" class="placement-wizard__title">This year’s classes</h3>
                    <p id="class-desk-subtitle" class="placement-wizard__subtitle"></p>
                </div>
                <button type="button" class="placement-wizard__close" data-class-desk-close aria-label="Close class desk">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
                <nav class="class-desk-stepper" id="class-desk-steps" aria-label="Class setup steps"></nav>
            </header>
            <div class="placement-wizard__body custom-scrollbar" id="class-desk-body"></div>
            <footer class="placement-wizard__footer" id="class-desk-footer"></footer>
        </div>
    `;
    document.body.appendChild(modal);
    if (!wizardState.listenersBound) {
        modal.addEventListener('click', handleWizardClick);
        modal.addEventListener('input', handleWizardInput);
        modal.addEventListener('keydown', handleWizardKeydown);
        document.addEventListener('class-desk-logo-picked', (event) => {
            const logo = event.detail?.logo;
            if (!logo) return;
            wizardState.logo = logo;
            const btn = document.getElementById('class-desk-logo-btn');
            if (btn) btn.innerText = logo;
        });
        wizardState.listenersBound = true;
    }
    return modal;
}

export async function openClassWizard({ onRerender, classId } = {}) {
    if (typeof onRerender === 'function') onClassDeskRerender = onRerender;
    if (!hasFullConsole()) {
        showToast('Creating and editing classes needs the Elite School Office.', 'info');
        return;
    }
    wizardState.step = STEPS.LIST;
    resetCreateDraft();
    const modal = ensureWizard();
    await ensureTeachers();
    if (classId) {
        const classData = classById(classId);
        if (classData) {
            loadEditDraft(classData);
            wizardState.step = STEPS.EDIT;
        }
    }
    paintWizard();
    modal.classList.remove('hidden');
    document.body.classList.add('placement-wizard-open');
}

export function closeClassWizard() {
    const modal = document.getElementById(WIZARD_ID);
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('placement-wizard-open');
    wizardState.confirmDeleteId = '';
}

export function refreshClassWizardIfOpen() {
    const modal = document.getElementById(WIZARD_ID);
    if (!modal || modal.classList.contains('hidden')) return;
    if (wizardState.editClassId && !classById(wizardState.editClassId)) {
        wizardState.step = STEPS.LIST;
        wizardState.editClassId = '';
    }
    paintWizard();
}

export function isClassWizardOpen() {
    const modal = document.getElementById(WIZARD_ID);
    return Boolean(modal && !modal.classList.contains('hidden'));
}
