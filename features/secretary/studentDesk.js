// features/secretary/studentDesk.js — what the Secretary can do from a student's passport:
// keep office notes on the student's file, and move (or seat) the student in a class.
// Both open as office dialogs with the Office's own open/close motion.
import * as state from '../../state.js';
import { showToast } from '../../ui/effects.js';
import { allocateReturningStudents, transferStudentToClass } from '../../utils/adminRuntime.js';
import { saveOfficeNote, deleteOfficeNote } from '../../db/actions/officeNotes.js';
import { escapeHtml, setBusyState } from '../roles/shared.js';
import { liveSchoolClasses, renderOfficeAvatar } from './helpers.js';
import { openOfficeModal, closeOfficeModal, releaseOfficeScrollLock } from './officeModal.js';
import { notifyRecordsChanged, showUndoBar } from './formerStudents.js';

const DIALOG_ID = 'secretary-student-desk';

export const OFFICE_NOTE_KINDS = Object.freeze([
    { key: 'Family', label: 'Family', icon: 'fa-house-user', tone: 'sky' },
    { key: 'Health', label: 'Health', icon: 'fa-heart-pulse', tone: 'rose' },
    { key: 'Admin', label: 'Fees & forms', icon: 'fa-file-signature', tone: 'amber' },
    { key: 'General', label: 'General', icon: 'fa-thumbtack', tone: 'slate' }
]);

const desk = { mode: null, studentId: null, classId: '', kind: 'Family', text: '', editingId: '', confirmDeleteId: '' };
let unsubscribeNotes = null;

// ── Lookups ────────────────────────────────────────────────────────────────

function studentById(studentId) {
    return (state.get('allStudents') || []).find((item) => item.id === studentId) || null;
}

function classById(classId) {
    return (state.get('allSchoolClasses') || []).find((item) => item.id === classId) || null;
}

function isWaiting(student) {
    return student?.enrollmentStatus === 'pendingPlacement' || !classById(student?.classId);
}

function kindMeta(key) {
    return OFFICE_NOTE_KINDS.find((item) => item.key === key) || OFFICE_NOTE_KINDS[3];
}

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function noteDate(note) {
    return toDate(note.createdAt) || toDate(note.updatedAt) || new Date();
}

export function isOfficeNote(note) {
    return note?.authorRole === 'office';
}

export function getStudentNotes(studentId) {
    const notes = (state.get('allHeroChronicleNotes') || [])
        .filter((note) => note.studentId === studentId)
        .sort((a, b) => noteDate(b) - noteDate(a));
    return {
        office: notes.filter(isOfficeNote),
        classroom: notes.filter((note) => !isOfficeNote(note))
    };
}

function teacherNameFor(teacherId) {
    if (!teacherId) return 'Teacher';
    const owned = (state.get('allSchoolClasses') || []).find((item) => item.createdBy?.uid === teacherId);
    return owned?.createdBy?.name || 'Teacher';
}

function studentLine(student) {
    const classData = classById(student.classId);
    if (classData) return `${escapeHtml(classData.logo || '📚')} ${escapeHtml(classData.name)} · ${escapeHtml(classData.createdBy?.name || 'Teacher')}`;
    return student.enrollmentStatus === 'pendingPlacement' ? 'Waiting for a class this year' : 'No class yet';
}

function summary(student) {
    return `
        <div class="office-summary">
            ${renderOfficeAvatar(student, { size: 'lg' })}
            <div class="office-summary__copy">
                <strong>${escapeHtml(student.name || 'Student')}</strong>
                <span>${studentLine(student)}</span>
            </div>
        </div>
    `;
}

function formatDay(date) {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Notes view ─────────────────────────────────────────────────────────────

function renderOfficeNoteCard(note) {
    const meta = kindMeta(note.category);
    const confirming = desk.confirmDeleteId === note.id;
    return `
        <article class="desk-note desk-note--${meta.tone}${desk.editingId === note.id ? ' is-editing' : ''}">
            <header class="desk-note__head">
                <span class="desk-note__kind"><i class="fas ${meta.icon}" aria-hidden="true"></i>${escapeHtml(meta.label)}</span>
                <time class="desk-note__date">${escapeHtml(formatDay(noteDate(note)))}</time>
            </header>
            <p class="desk-note__text">${escapeHtml(note.noteText || '')}</p>
            <footer class="desk-note__foot">
                <span class="desk-note__by">${escapeHtml(note.authorName || 'School office')}</span>
                ${confirming ? `
                    <span class="desk-note__confirm">
                        Delete this note?
                        <button type="button" class="office-btn office-btn--small office-btn--quiet" data-desk-note-keep>Keep</button>
                        <button type="button" class="office-btn office-btn--small office-btn--danger" data-desk-note-delete-yes="${escapeHtml(note.id)}">Delete</button>
                    </span>
                ` : `
                    <span class="desk-note__actions">
                        <button type="button" class="desk-note__btn" data-desk-note-edit="${escapeHtml(note.id)}" aria-label="Edit note" title="Edit note"><i class="fas fa-pen" aria-hidden="true"></i></button>
                        <button type="button" class="desk-note__btn desk-note__btn--danger" data-desk-note-delete="${escapeHtml(note.id)}" aria-label="Delete note" title="Delete note"><i class="fas fa-trash-can" aria-hidden="true"></i></button>
                    </span>
                `}
            </footer>
        </article>
    `;
}

function renderClassroomNote(note) {
    return `
        <li class="desk-class-note">
            <span class="desk-class-note__meta">
                <strong>${escapeHtml(teacherNameFor(note.teacherId))}</strong>
                <span>${escapeHtml(note.category || 'General')} · ${escapeHtml(formatDay(noteDate(note)))}</span>
            </span>
            <p>${escapeHtml(note.noteText || '')}</p>
        </li>
    `;
}

function renderNotesView() {
    const student = studentById(desk.studentId);
    if (!student) return null;
    const { office, classroom } = getStudentNotes(student.id);
    const editing = Boolean(desk.editingId);
    return {
        tab: 'Student file',
        kicker: 'Office notes',
        title: `${student.name}'s file`,
        subtitle: 'What the front desk should remember: family calls, health, fees and forms. Only the office sees these notes.',
        body: `
            ${summary(student)}
            <section class="desk-compose${editing ? ' is-editing' : ''}" aria-label="${editing ? 'Edit note' : 'New note'}">
                <div class="desk-kinds" role="radiogroup" aria-label="What the note is about">
                    ${OFFICE_NOTE_KINDS.map((kind) => `
                        <button type="button" class="desk-kind desk-kind--${kind.tone}${desk.kind === kind.key ? ' is-selected' : ''}"
                            role="radio" aria-checked="${desk.kind === kind.key ? 'true' : 'false'}" data-desk-kind="${kind.key}">
                            <i class="fas ${kind.icon}" aria-hidden="true"></i>${escapeHtml(kind.label)}
                        </button>
                    `).join('')}
                </div>
                <label class="office-field">
                    <span>${editing ? 'Edit the note' : 'New note'}</span>
                    <textarea id="secretary-desk-note-text" rows="3" maxlength="600" placeholder="e.g. Mum called: Anna has a dentist appointment on Thursday">${escapeHtml(desk.text)}</textarea>
                </label>
                <div class="desk-compose__actions">
                    ${editing ? '<button type="button" class="office-btn office-btn--small office-btn--quiet" data-desk-note-cancel>Cancel edit</button>' : ''}
                    <button type="button" class="office-btn office-btn--small office-btn--primary" data-desk-note-save ${desk.text.trim() ? '' : 'disabled'}>
                        <i class="fas fa-thumbtack" aria-hidden="true"></i> ${editing ? 'Update note' : 'Pin to file'}
                    </button>
                </div>
            </section>
            <section class="desk-notes" aria-label="Office notes on file">
                <h4 class="desk-heading"><i class="fas fa-folder-open" aria-hidden="true"></i>On file <span>${office.length}</span></h4>
                ${office.length
                    ? `<div class="desk-notes__list">${office.map(renderOfficeNoteCard).join('')}</div>`
                    : '<p class="desk-empty">No office notes yet. The first one you pin appears here.</p>'}
            </section>
            <section class="desk-classroom" aria-label="Notes from the classroom">
                <h4 class="desk-heading"><i class="fas fa-chalkboard-user" aria-hidden="true"></i>From the classroom <span>${classroom.length}</span></h4>
                ${classroom.length
                    ? `<ul class="desk-classroom__list">${classroom.map(renderClassroomNote).join('')}</ul>`
                    : '<p class="desk-empty">Teachers have not written notes about this student yet. Their notes appear here to read.</p>'}
            </section>
        `,
        footer: `
            <button type="button" class="office-btn office-btn--quiet" data-desk-close>Close</button>
        `
    };
}

// ── Move view ──────────────────────────────────────────────────────────────

function classSize(classId) {
    return (state.get('allStudents') || []).filter((item) => item.classId === classId && item.enrollmentStatus !== 'inactive').length;
}

function renderMoveView() {
    const student = studentById(desk.studentId);
    if (!student) return null;
    const waiting = isWaiting(student);
    const current = waiting ? null : classById(student.classId);
    const classes = liveSchoolClasses().filter((item) => item.createdBy?.uid);
    const homeLeague = current?.questLevel || student.previousQuestLevel || '';
    const leagues = [...new Set(classes.map((item) => item.questLevel || 'Other'))]
        .sort((a, b) => (a === homeLeague ? -1 : b === homeLeague ? 1 : String(a).localeCompare(String(b))));
    const target = classById(desk.classId);
    const chip = (item) => {
        const isCurrent = current?.id === item.id;
        const selected = desk.classId === item.id;
        return `
            <button type="button" class="office-class-chip desk-class-chip${selected ? ' is-selected' : ''}${isCurrent ? ' is-current' : ''}"
                data-desk-class="${escapeHtml(item.id)}" aria-pressed="${selected ? 'true' : 'false'}" ${isCurrent ? 'disabled' : ''}>
                <span aria-hidden="true">${escapeHtml(item.logo || '📚')}</span>
                <span>
                    <strong>${escapeHtml(item.name)}</strong>
                    <small>${isCurrent ? 'Their class now' : `${escapeHtml(item.createdBy?.name || 'Teacher')} · ${classSize(item.id)} heroes`}</small>
                </span>
            </button>
        `;
    };
    const confirmLabel = target
        ? `${waiting ? 'Seat in' : 'Move to'} ${escapeHtml(target.name)}`
        : 'Pick a class';
    return {
        tab: waiting ? 'Seat in a class' : 'Class change',
        kicker: 'Student record',
        title: waiting ? `Seat ${student.name} in a class` : `Move ${student.name}`,
        subtitle: waiting
            ? 'Pick the class they join this school year. Their teacher sees them straight away.'
            : 'Pick the class they move to. Their stars, gold, guild and notes go with them.',
        body: `
            ${summary(student)}
            ${classes.length ? leagues.map((league) => `
                <section class="desk-league" aria-label="${escapeHtml(league)}">
                    <p class="desk-league__name">${escapeHtml(league)}${league === homeLeague ? `<small>${waiting ? 'their league last year' : 'their league'}</small>` : ''}</p>
                    <div class="office-class-pick">
                        ${classes.filter((item) => (item.questLevel || 'Other') === league)
                            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
                            .map(chip).join('')}
                    </div>
                </section>
            `).join('') : '<p class="desk-empty">There are no classes with a teacher this school year yet. Create one in Admin first.</p>'}
            <ul class="office-facts">
                ${waiting
                    ? `<li><i class="fas fa-user-plus" aria-hidden="true"></i>Joins the class roster for this school year.</li>`
                    : `<li><i class="fas fa-arrow-right-arrow-left" aria-hidden="true"></i>Leaves ${escapeHtml(current?.name || 'their class')} and joins the new roster at once.</li>`}
                <li><i class="fas fa-shield-halved" aria-hidden="true"></i>Their guild stays the same. Guilds are for life.</li>
                <li><i class="fas fa-people-roof" aria-hidden="true"></i>The family app and messages follow them to the new teacher.</li>
            </ul>
        `,
        footer: `
            <button type="button" class="office-btn office-btn--quiet" data-desk-close>Cancel</button>
            <button type="button" class="office-btn office-btn--primary" data-desk-confirm-move ${target ? '' : 'disabled'}>
                <i class="fas fa-${waiting ? 'chair' : 'people-arrows'}" aria-hidden="true"></i> ${confirmLabel}
            </button>
        `
    };
}

// ── Dialog shell ───────────────────────────────────────────────────────────

function ensureDialog() {
    let modal = document.getElementById(DIALOG_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = DIALOG_ID;
    modal.className = 'office-dialog desk-dialog hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'secretary-desk-title');
    modal.innerHTML = `
        <div class="office-dialog__panel office-folder" data-office-panel>
            <span class="office-folder__tab" id="secretary-desk-tab">Student record</span>
            <button type="button" class="office-close" data-desk-close aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
            <header class="office-dialog__header">
                <p class="office-kicker" id="secretary-desk-kicker"></p>
                <h3 class="office-dialog__title" id="secretary-desk-title"></h3>
                <p class="office-dialog__subtitle" id="secretary-desk-subtitle"></p>
            </header>
            <div class="office-dialog__body custom-scrollbar" id="secretary-desk-body"></div>
            <footer class="office-dialog__footer" id="secretary-desk-footer"></footer>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', handleClick);
    modal.addEventListener('input', (event) => {
        if (event.target.id !== 'secretary-desk-note-text') return;
        desk.text = event.target.value;
        const save = modal.querySelector('[data-desk-note-save]');
        if (save) save.disabled = !desk.text.trim();
    });
    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeDesk();
    });
    return modal;
}

function paint({ keepScroll = false } = {}) {
    const modal = ensureDialog();
    const view = desk.mode === 'notes' ? renderNotesView() : renderMoveView();
    if (!view) {
        closeDesk();
        return false;
    }
    const body = modal.querySelector('#secretary-desk-body');
    const scrollTop = keepScroll ? body.scrollTop : 0;
    modal.dataset.mode = desk.mode;
    modal.querySelector('#secretary-desk-tab').textContent = view.tab;
    modal.querySelector('#secretary-desk-kicker').textContent = view.kicker;
    modal.querySelector('#secretary-desk-title').textContent = view.title;
    modal.querySelector('#secretary-desk-subtitle').textContent = view.subtitle;
    body.innerHTML = view.body;
    modal.querySelector('#secretary-desk-footer').innerHTML = view.footer;
    body.scrollTop = scrollTop;
    return true;
}

function showDesk() {
    if (!paint()) return;
    const modal = document.getElementById(DIALOG_ID);
    document.body.classList.add('placement-wizard-open');
    openOfficeModal(modal);
    requestAnimationFrame(() => {
        const focusTarget = desk.mode === 'notes'
            ? modal.querySelector('#secretary-desk-note-text')
            : modal.querySelector('.desk-class-chip:not([disabled])');
        (focusTarget || modal.querySelector('[data-desk-close]'))?.focus({ preventScroll: true });
    });
}

function closeDesk() {
    unsubscribeNotes?.();
    unsubscribeNotes = null;
    const modal = document.getElementById(DIALOG_ID);
    closeOfficeModal(modal, { onClosed: releaseOfficeScrollLock });
}

// ── Public entry points ────────────────────────────────────────────────────

export function openStudentNotes(studentId) {
    if (!studentById(studentId)) return;
    Object.assign(desk, { mode: 'notes', studentId, kind: 'Family', text: '', editingId: '', confirmDeleteId: '' });
    import('../../db/listeners.js')
        .then(({ ensureHeroChronicleNotesListener }) => ensureHeroChronicleNotesListener())
        .catch((error) => console.error('Could not load student notes:', error));
    unsubscribeNotes?.();
    unsubscribeNotes = state.subscribe('allHeroChronicleNotes', () => {
        if (desk.mode === 'notes' && !document.getElementById(DIALOG_ID)?.classList.contains('hidden')) paint({ keepScroll: true });
    });
    showDesk();
}

export function openStudentMove(studentId) {
    if (!studentById(studentId)) return;
    Object.assign(desk, { mode: 'move', studentId, classId: '' });
    showDesk();
}

// ── Actions ────────────────────────────────────────────────────────────────

function applyLocalPlacement(studentId, classData) {
    const students = (state.get('allStudents') || []).map((item) => (item.id === studentId
        ? { ...item, classId: classData.id, createdBy: classData.createdBy || item.createdBy, enrollmentStatus: 'active' }
        : item));
    state.setAllStudents(students);
    notifyRecordsChanged();
}

async function runMove(button) {
    const student = studentById(desk.studentId);
    const target = classById(desk.classId);
    if (!student || !target) return;
    const waiting = isWaiting(student);
    const previous = waiting ? null : classById(student.classId);
    try {
        setBusyState(button, true, waiting ? 'Seating...' : 'Moving...');
        if (student.enrollmentStatus === 'pendingPlacement') {
            await allocateReturningStudents({ classId: target.id, studentIds: [student.id] });
        } else {
            await transferStudentToClass({ studentId: student.id, classId: target.id });
        }
        applyLocalPlacement(student.id, target);
        closeDesk();
        if (previous) {
            showUndoBar(`${student.name} moved to ${target.name}.`, async () => {
                await transferStudentToClass({ studentId: student.id, classId: previous.id });
                applyLocalPlacement(student.id, previous);
                showToast(`${student.name} is back in ${previous.name}.`, 'success');
            });
        } else {
            showToast(`${student.name} now sits in ${target.name}.`, 'success');
        }
    } catch (error) {
        console.error('Could not move student:', error);
        showToast(error?.message || 'Could not move that student. Please try again.', 'error');
        setBusyState(button, false);
    }
}

async function runSaveNote(button) {
    const text = desk.text.trim();
    if (!text) return;
    try {
        setBusyState(button, true, 'Saving...');
        await saveOfficeNote({ studentId: desk.studentId, text, category: desk.kind, noteId: desk.editingId || null });
        showToast(desk.editingId ? 'Note updated.' : 'Note pinned to the file.', 'success');
        Object.assign(desk, { text: '', editingId: '', confirmDeleteId: '' });
        paint({ keepScroll: true });
    } catch (error) {
        console.error('Could not save office note:', error);
        showToast(error?.message || 'Could not save the note.', 'error');
        setBusyState(button, false);
    }
}

async function runDeleteNote(button, noteId) {
    try {
        setBusyState(button, true, 'Deleting...');
        await deleteOfficeNote(noteId);
        showToast('Note deleted.', 'success');
        if (desk.editingId === noteId) Object.assign(desk, { text: '', editingId: '' });
        desk.confirmDeleteId = '';
        paint({ keepScroll: true });
    } catch (error) {
        console.error('Could not delete office note:', error);
        showToast(error?.message || 'Could not delete the note.', 'error');
        setBusyState(button, false);
    }
}

function handleClick(event) {
    const modal = document.getElementById(DIALOG_ID);
    if (event.target === modal || event.target.closest('[data-desk-close]')) {
        closeDesk();
        return;
    }
    const classBtn = event.target.closest('[data-desk-class]');
    if (classBtn) {
        desk.classId = classBtn.dataset.deskClass;
        paint({ keepScroll: true });
        return;
    }
    const confirmMove = event.target.closest('[data-desk-confirm-move]');
    if (confirmMove) {
        void runMove(confirmMove);
        return;
    }
    const kindBtn = event.target.closest('[data-desk-kind]');
    if (kindBtn) {
        desk.kind = kindBtn.dataset.deskKind;
        modal.querySelectorAll('[data-desk-kind]').forEach((btn) => {
            const on = btn === kindBtn;
            btn.classList.toggle('is-selected', on);
            btn.setAttribute('aria-checked', on ? 'true' : 'false');
        });
        return;
    }
    const saveBtn = event.target.closest('[data-desk-note-save]');
    if (saveBtn) {
        void runSaveNote(saveBtn);
        return;
    }
    if (event.target.closest('[data-desk-note-cancel]')) {
        Object.assign(desk, { text: '', editingId: '', kind: 'Family' });
        paint({ keepScroll: true });
        return;
    }
    const editBtn = event.target.closest('[data-desk-note-edit]');
    if (editBtn) {
        const note = (state.get('allHeroChronicleNotes') || []).find((item) => item.id === editBtn.dataset.deskNoteEdit);
        if (!note) return;
        Object.assign(desk, { editingId: note.id, text: note.noteText || '', kind: kindMeta(note.category).key, confirmDeleteId: '' });
        paint();
        modal.querySelector('#secretary-desk-note-text')?.focus();
        return;
    }
    const deleteBtn = event.target.closest('[data-desk-note-delete]');
    if (deleteBtn) {
        desk.confirmDeleteId = deleteBtn.dataset.deskNoteDelete;
        paint({ keepScroll: true });
        return;
    }
    if (event.target.closest('[data-desk-note-keep]')) {
        desk.confirmDeleteId = '';
        paint({ keepScroll: true });
        return;
    }
    const deleteYes = event.target.closest('[data-desk-note-delete-yes]');
    if (deleteYes) void runDeleteNote(deleteYes, deleteYes.dataset.deskNoteDeleteYes);
}
