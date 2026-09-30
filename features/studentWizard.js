import * as state from '../state.js';
import { openOfficeModal, closeOfficeModal, releaseOfficeScrollLock } from './secretary/officeModal.js';
import { getQuestLeagueDefinition } from '../constants.js';
import { showToast } from '../ui/effects.js';
import { canUseFeature } from '../utils/subscription.js';
import { createStudent } from '../db/actions/students.js';
import { escapeHtml, setBusyState } from './roles/shared.js';
import { formatClassSchedule } from './secretary/helpers.js';

const WIZARD_ID = 'student-desk-wizard';

const MONTHS = Object.freeze([
    { value: 1, label: 'Jan' },
    { value: 2, label: 'Feb' },
    { value: 3, label: 'Mar' },
    { value: 4, label: 'Apr' },
    { value: 5, label: 'May' },
    { value: 6, label: 'Jun' },
    { value: 7, label: 'Jul' },
    { value: 8, label: 'Aug' },
    { value: 9, label: 'Sep' },
    { value: 10, label: 'Oct' },
    { value: 11, label: 'Nov' },
    { value: 12, label: 'Dec' }
]);

// Two steps: which class, then who. The class card stays in view on the second
// step, so there is nothing left to review before adding them.
const STEPS = Object.freeze({
    CLASS: 'class',
    IDENTITY: 'identity'
});

const CREATE_FLOW = [STEPS.CLASS, STEPS.IDENTITY];

const CREATE_STEPS = Object.freeze([
    { id: STEPS.CLASS, label: 'Class', icon: 'fa-chalkboard' },
    { id: STEPS.IDENTITY, label: 'Student', icon: 'fa-user-plus' }
]);

const wizardState = {
    step: STEPS.CLASS,
    classId: '',
    name: '',
    birthdayMonth: '',
    birthdayDay: '',
    namedayMonth: '',
    namedayDay: '',
    lastCreatedName: '',
    listenersBound: false
};

let onStudentDeskRerender = null;

function hasFullConsole() {
    return canUseFeature('secretaryAccess');
}

function activeClasses() {
    return (state.get('allSchoolClasses') || [])
        .filter((item) => item.status !== 'archived' && item.status !== 'closed')
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

function selectedClass() {
    return classById(wizardState.classId);
}

function classOwner(classData) {
    const uid = String(classData?.createdBy?.uid || '').trim();
    const name = String(classData?.createdBy?.name || 'Teacher').trim() || 'Teacher';
    return uid ? { uid, name } : null;
}

function daysInMonth(month) {
    const value = Number(month);
    if (!value) return 31;
    return new Date(2024, value, 0).getDate();
}

function clampDay(month, day) {
    const max = daysInMonth(month);
    const value = Number(day);
    if (!value) return '';
    return value > max ? String(max) : String(value);
}

function formatOccasionDate(month, day) {
    const m = Number(month);
    const d = Number(day);
    if (!m || !d) return null;
    return `0000-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function resetIdentity({ keepClass = false } = {}) {
    if (!keepClass) wizardState.classId = '';
    wizardState.name = '';
    wizardState.birthdayMonth = '';
    wizardState.birthdayDay = '';
    wizardState.namedayMonth = '';
    wizardState.namedayDay = '';
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

function paintWizard({ nameCaret, focusName = false, resetScroll = false } = {}) {
    const modal = document.getElementById(WIZARD_ID);
    if (!modal) return;
    const title = document.getElementById('student-desk-title');
    const subtitle = document.getElementById('student-desk-subtitle');
    const steps = document.getElementById('student-desk-steps');
    const body = document.getElementById('student-desk-body');
    const footer = document.getElementById('student-desk-footer');
    if (!title || !body || !footer) return;

    const copy = headingCopy();
    title.textContent = copy.title;
    subtitle.textContent = copy.subtitle;
    steps.innerHTML = renderSteps();
    body.innerHTML = renderBody();
    footer.innerHTML = renderFooter();

    // A new step starts at the top, so the class card stays in view above the name.
    if (resetScroll) body.scrollTop = 0;
    const nameInput = document.getElementById('student-desk-name');
    if (nameInput && focusName) {
        nameInput.focus({ preventScroll: true });
        if (typeof nameCaret === 'number') {
            const caret = Math.min(nameCaret, nameInput.value.length);
            nameInput.setSelectionRange(caret, caret);
        } else {
            nameInput.setSelectionRange(nameInput.value.length, nameInput.value.length);
        }
    }
}

function headingCopy() {
    if (wizardState.step === STEPS.CLASS) {
        const count = activeClasses().length;
        return {
            title: 'Which class are they joining?',
            subtitle: count
                ? 'Their teacher will see them in the Teacher App straight away. Class not here yet? Open it from the last card.'
                : 'There are no classes this year yet. Open one now and you will come straight back here.'
        };
    }
    const classData = selectedClass();
    return {
        title: classData ? `Who is joining ${classData.name}?` : 'Who is joining?',
        subtitle: 'A full name is enough. Birthday and nameday are optional, and you can add them later from Edit.'
    };
}

function renderSteps() {
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
                                data-student-desk-goto="${escapeHtml(step.id)}"
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

function renderClassTile(item) {
    const count = rosterCount(item.id);
    const selected = item.id === wizardState.classId;
    const owner = classOwner(item);
    return `
        <button type="button"
            class="class-desk-class-tile${selected ? ' is-selected' : ''}"
            data-student-desk-class="${escapeHtml(item.id)}"
            ${owner ? '' : 'disabled'}
            aria-pressed="${selected ? 'true' : 'false'}">
            <span class="placement-class-tile__logo" aria-hidden="true">${escapeHtml(item.logo || '📚')}</span>
            <span class="placement-class-tile__copy">
                <strong>${escapeHtml(item.name)}</strong>
                ${renderLeagueChip(item.questLevel)}
                <span class="placement-class-tile__roster">${escapeHtml(owner?.name || 'No teacher yet')}</span>
                <span class="placement-class-tile__roster">${escapeHtml(formatClassSchedule(item))}</span>
                <span class="placement-class-tile__roster">${count} ${count === 1 ? 'student' : 'students'}</span>
            </span>
            ${selected ? '<span class="class-desk-check" aria-hidden="true"><i class="fas fa-check"></i></span>' : ''}
        </button>
    `;
}

function renderClassBody() {
    const classes = activeClasses();
    if (!classes.length) {
        return `
            <div class="placement-empty">
                <i class="fas fa-chalkboard" aria-hidden="true"></i>
                <h4>No classes this year yet</h4>
                <p>Open the class first. Once it is made, you come straight back here to enrol the student into it.</p>
                <button type="button" class="secretary-shell__primary-btn" data-student-desk-new-class>
                    <i class="fas fa-chalkboard-user mr-2" aria-hidden="true"></i>Open a new class
                </button>
            </div>
        `;
    }
    const grouped = new Map();
    for (const item of classes) {
        const key = item.createdBy?.uid || 'unassigned';
        const title = item.createdBy?.name || 'No teacher yet';
        if (!grouped.has(key)) grouped.set(key, { title, classes: [] });
        grouped.get(key).classes.push(item);
    }
    const groups = [...grouped.values()].sort((a, b) => a.title.localeCompare(b.title));
    return `
        <div class="class-desk-groups">
            ${groups.map((group) => `
                <section class="class-desk-group">
                    <h4 class="class-desk-group__title">
                        <i class="fas fa-user" aria-hidden="true"></i>
                        ${escapeHtml(group.title)}
                        <span>${group.classes.length}</span>
                    </h4>
                    <div class="class-desk-class-grid">
                        ${group.classes.map((item) => renderClassTile(item)).join('')}
                    </div>
                </section>
            `).join('')}
            <button type="button" class="class-desk-class-tile student-desk-new-class" data-student-desk-new-class>
                <span class="student-desk-new-class__plus" aria-hidden="true"><i class="fas fa-plus"></i></span>
                <span class="placement-class-tile__copy">
                    <strong>Their class isn’t here yet</strong>
                    <span class="placement-class-tile__roster">Open a new class, then come straight back to enrol them.</span>
                </span>
            </button>
        </div>
    `;
}

function renderDateChips(kind, month, day) {
    const selectedMonth = Number(month) || 0;
    const selectedDay = Number(day) || 0;
    const maxDay = daysInMonth(selectedMonth);
    return `
        <div class="student-desk-date-card">
            <div class="student-desk-date-card__head">
                <strong>${kind === 'birthday' ? 'Birthday' : 'Nameday'}</strong>
                <button type="button" class="student-desk-date-clear" data-student-desk-clear-${kind}>Clear</button>
            </div>
            <p class="student-desk-date-card__hint">${kind === 'birthday' ? 'Optional. Celebrated during attendance.' : 'Optional. Greek Orthodox nameday.'}</p>
            <div class="class-desk-days" role="group" aria-label="${kind} month">
                ${MONTHS.map((item) => `
                    <button type="button"
                        class="class-desk-day${selectedMonth === item.value ? ' is-on' : ''}"
                        data-student-desk-${kind}-month="${item.value}">
                        ${item.label}
                    </button>
                `).join('')}
            </div>
            <div class="class-desk-days student-desk-day-grid" role="group" aria-label="${kind} day">
                ${Array.from({ length: maxDay }, (_, i) => {
                    const value = i + 1;
                    return `
                        <button type="button"
                            class="class-desk-day${selectedDay === value ? ' is-on' : ''}"
                            data-student-desk-${kind}-day="${value}">
                            ${value}
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function renderIdentityBody() {
    const classData = selectedClass();
    return `
        ${wizardState.lastCreatedName ? `
            <p class="student-desk-success">
                <i class="fas fa-check-circle" aria-hidden="true"></i>
                ${escapeHtml(wizardState.lastCreatedName)} is on the roster. Enrol the next student below, or choose Done.
            </p>
        ` : ''}
        ${classData ? `
            <div class="class-desk-summary student-desk-class-summary">
                <span class="placement-class-tile__logo" aria-hidden="true">${escapeHtml(classData.logo || '📚')}</span>
                <div>
                    <p class="class-desk-summary__kicker">${escapeHtml(classOwner(classData)?.name || 'Teacher')}</p>
                    <strong>${escapeHtml(classData.name)}</strong>
                    <div class="class-desk-summary__meta">
                        ${classData.questLevel ? renderLeagueChip(classData.questLevel) : ''}
                        <span>${escapeHtml(formatClassSchedule(classData))}</span>
                        <span>${rosterCount(classData.id)} ${rosterCount(classData.id) === 1 ? 'student' : 'students'}</span>
                    </div>
                </div>
                <button type="button" class="secretary-chip-btn student-desk-change-class" data-student-desk-back>
                    <i class="fas fa-arrows-rotate" aria-hidden="true"></i> Change class
                </button>
            </div>
        ` : ''}
        <label class="secretary-field class-desk-name-field">
            <span>Student's full name</span>
            <input type="text" id="student-desk-name" value="${escapeHtml(wizardState.name)}" placeholder="Student's full name..." autocomplete="off">
        </label>
        <div class="student-desk-dates">
            ${renderDateChips('birthday', wizardState.birthdayMonth, wizardState.birthdayDay)}
            ${renderDateChips('nameday', wizardState.namedayMonth, wizardState.namedayDay)}
        </div>
    `;
}

function renderBody() {
    if (wizardState.step === STEPS.IDENTITY) return renderIdentityBody();
    return renderClassBody();
}

function renderFooter() {
    if (wizardState.step === STEPS.CLASS) {
        return activeClasses().length
            ? `<p class="placement-hint">Tap a class to continue.</p>`
            : '';
    }
    const ready = Boolean(selectedClass() && classOwner(selectedClass()) && String(wizardState.name || '').trim());
    return `
        ${wizardState.lastCreatedName
            ? '<button type="button" class="secretary-shell__secondary-btn" data-student-desk-close>Done</button>'
            : '<button type="button" class="secretary-shell__secondary-btn" data-student-desk-back><i class="fas fa-arrow-left mr-2" aria-hidden="true"></i>Back</button>'}
        <button type="button" class="secretary-shell__primary-btn" data-student-desk-create ${ready ? '' : 'disabled'}>
            <i class="fas fa-user-plus mr-2" aria-hidden="true"></i>Add to roster
        </button>
    `;
}

function captureFormFields() {
    const nameInput = document.getElementById('student-desk-name');
    if (nameInput) wizardState.name = nameInput.value;
}

function goBack() {
    captureFormFields();
    const index = CREATE_FLOW.indexOf(wizardState.step);
    if (index <= 0) return;
    wizardState.step = CREATE_FLOW[index - 1];
    paintWizard({ focusName: wizardState.step === STEPS.IDENTITY, resetScroll: true });
}

function goToCreateStep(stepId) {
    captureFormFields();
    const target = CREATE_FLOW.indexOf(stepId);
    const current = CREATE_FLOW.indexOf(wizardState.step);
    if (target < 0 || current < 0 || target >= current) return;
    wizardState.step = stepId;
    paintWizard({ focusName: stepId === STEPS.IDENTITY, resetScroll: true });
}

function chooseClass(classId) {
    const classData = classById(classId);
    if (!classData) return;
    if (!classOwner(classData)) {
        showToast('That class needs a teacher before you can add a student.', 'error');
        return;
    }
    wizardState.classId = classId;
    wizardState.lastCreatedName = '';
    wizardState.step = STEPS.IDENTITY;
    paintWizard({ focusName: true, resetScroll: true });
}

function setOccasionPart(kind, part, value) {
    if (kind === 'birthday' && part === 'month') {
        wizardState.birthdayMonth = String(value);
        wizardState.birthdayDay = clampDay(wizardState.birthdayMonth, wizardState.birthdayDay);
    } else if (kind === 'birthday' && part === 'day') {
        wizardState.birthdayDay = clampDay(wizardState.birthdayMonth, value);
    } else if (kind === 'nameday' && part === 'month') {
        wizardState.namedayMonth = String(value);
        wizardState.namedayDay = clampDay(wizardState.namedayMonth, wizardState.namedayDay);
    } else if (kind === 'nameday' && part === 'day') {
        wizardState.namedayDay = clampDay(wizardState.namedayMonth, value);
    }
    paintWizard();
}

function clearOccasion(kind) {
    if (kind === 'birthday') {
        wizardState.birthdayMonth = '';
        wizardState.birthdayDay = '';
    } else {
        wizardState.namedayMonth = '';
        wizardState.namedayDay = '';
    }
    paintWizard();
}

async function runCreate(button) {
    captureFormFields();
    const classData = selectedClass();
    const owner = classOwner(classData);
    const name = String(wizardState.name || '').trim();
    if (!classData || !owner || !name) {
        showToast('Please enter a student name and choose a class.', 'error');
        return;
    }
    try {
        setBusyState(button, true, 'Adding...');
        await createStudent({
            name,
            classId: classData.id,
            createdBy: owner,
            birthday: formatOccasionDate(wizardState.birthdayMonth, wizardState.birthdayDay),
            nameday: formatOccasionDate(wizardState.namedayMonth, wizardState.namedayDay)
        });
        wizardState.lastCreatedName = name;
        resetIdentity({ keepClass: true });
        wizardState.step = STEPS.IDENTITY;
        paintWizard({ focusName: true, resetScroll: true });
        onStudentDeskRerender?.();
    } catch (error) {
        console.error('Could not add student:', error);
        showToast(error?.message || 'Could not add that student.', 'error');
        setBusyState(button, false);
    }
}

function handleWizardClick(event) {
    if (event.target.closest('[data-student-desk-close]')) {
        closeStudentWizard();
        return;
    }
    if (event.target.closest('[data-student-desk-back]')) {
        goBack();
        return;
    }
    const gotoBtn = event.target.closest('[data-student-desk-goto]');
    if (gotoBtn) {
        goToCreateStep(gotoBtn.dataset.studentDeskGoto);
        return;
    }
    const classBtn = event.target.closest('[data-student-desk-class]');
    if (classBtn) {
        chooseClass(classBtn.dataset.studentDeskClass);
        return;
    }
    if (event.target.closest('[data-student-desk-create]')) {
        runCreate(event.target.closest('[data-student-desk-create]'));
        return;
    }
    if (event.target.closest('[data-student-desk-new-class]')) {
        openClassOnTheWay();
        return;
    }
    const bMonth = event.target.closest('[data-student-desk-birthday-month]');
    if (bMonth) {
        captureFormFields();
        setOccasionPart('birthday', 'month', bMonth.dataset.studentDeskBirthdayMonth);
        return;
    }
    const bDay = event.target.closest('[data-student-desk-birthday-day]');
    if (bDay) {
        captureFormFields();
        setOccasionPart('birthday', 'day', bDay.dataset.studentDeskBirthdayDay);
        return;
    }
    const nMonth = event.target.closest('[data-student-desk-nameday-month]');
    if (nMonth) {
        captureFormFields();
        setOccasionPart('nameday', 'month', nMonth.dataset.studentDeskNamedayMonth);
        return;
    }
    const nDay = event.target.closest('[data-student-desk-nameday-day]');
    if (nDay) {
        captureFormFields();
        setOccasionPart('nameday', 'day', nDay.dataset.studentDeskNamedayDay);
        return;
    }
    if (event.target.closest('[data-student-desk-clear-birthday]')) {
        captureFormFields();
        clearOccasion('birthday');
        return;
    }
    if (event.target.closest('[data-student-desk-clear-nameday]')) {
        captureFormFields();
        clearOccasion('nameday');
    }
}

// A class that doesn't exist yet is opened on the way: the class desk takes over,
// and once the class is made the student desk comes back with it already chosen.
function openClassOnTheWay() {
    captureFormFields();
    const draft = {
        name: wizardState.name,
        birthdayMonth: wizardState.birthdayMonth,
        birthdayDay: wizardState.birthdayDay,
        namedayMonth: wizardState.namedayMonth,
        namedayDay: wizardState.namedayDay
    };
    const rerender = onStudentDeskRerender;
    closeStudentWizard();
    import('./classWizard.js').then(({ openClassWizard }) => {
        openClassWizard({
            create: true,
            onRerender: rerender,
            onCreated: (classId) => openStudentWizard({ classId, onRerender: rerender, draft }),
            onCancelled: () => openStudentWizard({ onRerender: rerender, draft })
        });
    });
}

function handleWizardInput(event) {
    if (event.target.id === 'student-desk-name') {
        wizardState.name = event.target.value;
        const footer = document.getElementById('student-desk-footer');
        if (footer) footer.innerHTML = renderFooter();
    }
}

function handleWizardKeydown(event) {
    if (event.key === 'Enter' && event.target.id === 'student-desk-name') {
        event.preventDefault();
        const addBtn = document.querySelector('[data-student-desk-create]:not(:disabled)');
        if (addBtn) runCreate(addBtn);
        return;
    }
    if (event.key !== 'Escape') return;
    closeStudentWizard();
}

function ensureWizard() {
    let modal = document.getElementById(WIZARD_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = WIZARD_ID;
    modal.className = 'placement-wizard hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'student-desk-title');
    modal.innerHTML = `
        <div class="placement-wizard__panel placement-wizard--sheet pop-in class-desk-panel student-desk-panel">
            <header class="placement-wizard__header class-desk-header">
                <div class="placement-wizard__heading">
                    <p class="placement-wizard__eyebrow">New student</p>
                    <h3 id="student-desk-title" class="placement-wizard__title">Add a new student</h3>
                    <p id="student-desk-subtitle" class="placement-wizard__subtitle"></p>
                </div>
                <button type="button" class="placement-wizard__close" data-student-desk-close aria-label="Close student desk">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
                <nav class="class-desk-stepper" id="student-desk-steps" aria-label="New student steps"></nav>
            </header>
            <div class="placement-wizard__body custom-scrollbar" id="student-desk-body"></div>
            <footer class="placement-wizard__footer" id="student-desk-footer"></footer>
        </div>
    `;
    document.body.appendChild(modal);
    if (!wizardState.listenersBound) {
        modal.addEventListener('click', handleWizardClick);
        modal.addEventListener('input', handleWizardInput);
        modal.addEventListener('keydown', handleWizardKeydown);
        wizardState.listenersBound = true;
    }
    return modal;
}

export function openStudentWizard({ onRerender, classId = '', draft = null } = {}) {
    if (typeof onRerender === 'function') onStudentDeskRerender = onRerender;
    if (!hasFullConsole()) {
        showToast('Adding students needs the Elite School Office.', 'info');
        return;
    }
    wizardState.step = STEPS.CLASS;
    resetIdentity();
    if (draft) Object.assign(wizardState, draft);
    wizardState.lastCreatedName = '';
    // Enrolling from a class card (or right after opening a class) skips the class step.
    const preset = classId ? classById(classId) : null;
    if (preset && classOwner(preset)) {
        wizardState.classId = preset.id;
        wizardState.step = STEPS.IDENTITY;
    }
    const modal = ensureWizard();
    paintWizard({ focusName: wizardState.step === STEPS.IDENTITY, resetScroll: true });
    document.body.classList.add('placement-wizard-open');
    openOfficeModal(modal);
}

export function closeStudentWizard() {
    const modal = document.getElementById(WIZARD_ID);
    closeOfficeModal(modal, { onClosed: releaseOfficeScrollLock });
}

export function refreshStudentWizardIfOpen() {
    const modal = document.getElementById(WIZARD_ID);
    if (!modal || modal.classList.contains('hidden')) return;
    if (wizardState.classId && !classById(wizardState.classId)) {
        wizardState.step = STEPS.CLASS;
        resetIdentity();
    }
    paintWizard();
}

export function isStudentWizardOpen() {
    const modal = document.getElementById(WIZARD_ID);
    return Boolean(modal && !modal.classList.contains('hidden'));
}
