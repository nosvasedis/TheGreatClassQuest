import * as state from '../state.js';
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

const STEPS = Object.freeze({
    CLASS: 'class',
    IDENTITY: 'identity',
    REVIEW: 'review'
});

const CREATE_FLOW = [STEPS.CLASS, STEPS.IDENTITY, STEPS.REVIEW];

const CREATE_STEPS = Object.freeze([
    { id: STEPS.CLASS, label: 'Class', icon: 'fa-chalkboard' },
    { id: STEPS.IDENTITY, label: 'Name', icon: 'fa-user-plus' },
    { id: STEPS.REVIEW, label: 'Review', icon: 'fa-clipboard-check' }
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

function formatOccasionLabel(month, day) {
    const m = Number(month);
    const d = Number(day);
    if (!m || !d) return '';
    const label = MONTHS.find((item) => item.value === m)?.label || String(m);
    return `${label} ${d}`;
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

export function renderStudentLauncher({ classCount } = {}) {
    const count = Number.isFinite(classCount) ? classCount : activeClasses().length;
    const badge = count ? (count === 1 ? '1 class' : `${count} classes`) : 'No classes yet';
    return `
        <section class="secretary-card student-desk-launcher">
            <div class="student-desk-launcher__glow" aria-hidden="true"></div>
            <div class="secretary-card__header">
                <div>
                    <p class="secretary-card__eyebrow">New student</p>
                    <h3 class="secretary-card__title">Add a new student</h3>
                </div>
                <div class="secretary-card__badge">${escapeHtml(badge)}</div>
            </div>
            <p class="text-sm text-slate-600 leading-relaxed">
                ${count
                    ? 'Seat a new hero in a teacher’s class this year. The teacher owns the roster in their Teacher App.'
                    : 'Create this year’s classes first, then add new students to a teacher’s roster.'}
            </p>
            <button type="button" id="school-year-student-desk-open-btn" class="secretary-shell__primary-btn student-desk-launcher__cta">
                <i class="fas fa-user-plus mr-2" aria-hidden="true"></i>Open student desk
            </button>
        </section>
    `;
}

function paintWizard({ nameCaret, focusName = false } = {}) {
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

    const nameInput = document.getElementById('student-desk-name');
    if (nameInput && focusName) {
        nameInput.focus();
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
            title: 'Choose a class',
            subtitle: count
                ? 'The teacher who owns this class will see the new student in their Teacher App.'
                : 'Create a class first. Then you can add a new student to that roster.'
        };
    }
    if (wizardState.step === STEPS.IDENTITY) {
        return {
            title: 'Name the new student',
            subtitle: 'Full name is enough. Birthday and nameday are optional — you can still set them later from Edit.'
        };
    }
    return {
        title: 'Review and add',
        subtitle: 'Check the class, teacher, and name, then add the student to the roster.'
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
                <p>Create this year’s classes for each teacher, then come back to add a new student.</p>
                <button type="button" class="secretary-shell__primary-btn" data-student-desk-open-class-desk>
                    <i class="fas fa-chalkboard-user mr-2" aria-hidden="true"></i>Open class desk
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
                ${escapeHtml(wizardState.lastCreatedName)} is on the roster. Add another to the same class, or go back to pick a different class.
            </p>
        ` : ''}
        ${classData ? `
            <div class="class-desk-summary student-desk-class-summary">
                <span class="placement-class-tile__logo" aria-hidden="true">${escapeHtml(classData.logo || '📚')}</span>
                <div>
                    <p class="class-desk-summary__kicker">${escapeHtml(classOwner(classData)?.name || 'Teacher')}</p>
                    <strong>${escapeHtml(classData.name)}</strong>
                </div>
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

function renderReviewBody() {
    const classData = selectedClass();
    const owner = classOwner(classData);
    const birthdayLabel = formatOccasionLabel(wizardState.birthdayMonth, wizardState.birthdayDay);
    const namedayLabel = formatOccasionLabel(wizardState.namedayMonth, wizardState.namedayDay);
    return `
        <div class="class-desk-summary">
            <span class="placement-class-tile__logo" aria-hidden="true">${escapeHtml(classData?.logo || '📚')}</span>
            <div>
                <p class="class-desk-summary__kicker">${escapeHtml(owner?.name || 'No teacher yet')}</p>
                <strong>${escapeHtml(wizardState.name.trim() || 'Unnamed student')}</strong>
                <div class="class-desk-summary__meta">
                    <span>${escapeHtml(classData?.name || 'No class')}</span>
                    ${classData?.questLevel ? renderLeagueChip(classData.questLevel) : ''}
                    ${birthdayLabel ? `<span>Birthday ${escapeHtml(birthdayLabel)}</span>` : ''}
                    ${namedayLabel ? `<span>Nameday ${escapeHtml(namedayLabel)}</span>` : ''}
                </div>
            </div>
        </div>
        <p class="placement-hint">This is a new student, not a returning hero. The class teacher owns the record, so they can award stars and edit details in the Teacher App.</p>
    `;
}

function renderBody() {
    if (wizardState.step === STEPS.IDENTITY) return renderIdentityBody();
    if (wizardState.step === STEPS.REVIEW) return renderReviewBody();
    return renderClassBody();
}

function renderFooter() {
    if (wizardState.step === STEPS.CLASS) {
        return activeClasses().length
            ? `<p class="placement-hint">Tap a class to continue.</p>`
            : '';
    }
    const back = `<button type="button" class="secretary-shell__secondary-btn" data-student-desk-back><i class="fas fa-arrow-left mr-2" aria-hidden="true"></i>Back</button>`;
    if (wizardState.step === STEPS.REVIEW) {
        const ready = Boolean(selectedClass() && classOwner(selectedClass()) && String(wizardState.name || '').trim());
        return `
            ${back}
            <button type="button" class="secretary-shell__primary-btn" data-student-desk-create ${ready ? '' : 'disabled'}>
                Add to roster
            </button>
        `;
    }
    return `
        ${back}
        <button type="button" class="secretary-shell__primary-btn" data-student-desk-continue ${canAdvance() ? '' : 'disabled'}>
            Continue<i class="fas fa-arrow-right ml-2" aria-hidden="true"></i>
        </button>
    `;
}

function canAdvance() {
    if (wizardState.step === STEPS.CLASS) return Boolean(selectedClass() && classOwner(selectedClass()));
    if (wizardState.step === STEPS.IDENTITY) return Boolean(String(wizardState.name || '').trim());
    return false;
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
    paintWizard({ focusName: wizardState.step === STEPS.IDENTITY });
}

function goForward() {
    captureFormFields();
    const index = CREATE_FLOW.indexOf(wizardState.step);
    if (index < 0 || index >= CREATE_FLOW.length - 1 || !canAdvance()) return;
    wizardState.lastCreatedName = '';
    wizardState.step = CREATE_FLOW[index + 1];
    paintWizard();
}

function goToCreateStep(stepId) {
    captureFormFields();
    const target = CREATE_FLOW.indexOf(stepId);
    const current = CREATE_FLOW.indexOf(wizardState.step);
    if (target < 0 || current < 0 || target >= current) return;
    wizardState.step = stepId;
    paintWizard({ focusName: stepId === STEPS.IDENTITY });
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
    paintWizard({ focusName: true });
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
        paintWizard({ focusName: true });
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
    if (event.target.closest('[data-student-desk-continue]')) {
        goForward();
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
    if (event.target.closest('[data-student-desk-open-class-desk]')) {
        import('./classWizard.js').then(({ openClassWizard }) => {
            openClassWizard({ onRerender: onStudentDeskRerender });
        });
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

function handleWizardInput(event) {
    if (event.target.id === 'student-desk-name') {
        wizardState.name = event.target.value;
        const footer = document.getElementById('student-desk-footer');
        if (footer) footer.innerHTML = renderFooter();
    }
}

function handleWizardKeydown(event) {
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

export function openStudentWizard({ onRerender } = {}) {
    if (typeof onRerender === 'function') onStudentDeskRerender = onRerender;
    if (!hasFullConsole()) {
        showToast('Adding students needs the Elite School Office.', 'info');
        return;
    }
    wizardState.step = STEPS.CLASS;
    resetIdentity();
    wizardState.lastCreatedName = '';
    const modal = ensureWizard();
    paintWizard();
    modal.classList.remove('hidden');
    document.body.classList.add('placement-wizard-open');
}

export function closeStudentWizard() {
    const modal = document.getElementById(WIZARD_ID);
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('placement-wizard-open');
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
