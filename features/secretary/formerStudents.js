// features/secretary/formerStudents.js — students who have left the school.
// Leaving is a reversible status: the record, stars, grades and notes all stay,
// the student simply drops off every live roster. Only "Delete forever" erases data.
import * as state from '../../state.js';
import { db, collection, query, where, getDocs } from '../../firebase.js';
import { showToast, showUndoToast } from '../../ui/effects.js';
import { showTypedConfirmationModal } from '../../ui/modals/base.js';
import { markStudentLeftSchool, restoreFormerStudent, purgeStudent } from '../../utils/adminRuntime.js';
import { escapeHtml, setBusyState } from '../roles/shared.js';
import { liveSchoolClasses, renderOfficeAvatar } from './helpers.js';
import { openOfficeModal, closeOfficeModal, releaseOfficeScrollLock } from './officeModal.js';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
const DIALOG_ID = 'secretary-office-dialog';
const UNDO_ID = 'secretary-undo-bar';
const UNDO_MS = 9000;

export const LEAVE_REASONS = Object.freeze([
    { key: 'moved', label: 'Moved away', stamp: 'Moved away', hint: 'Changed school or left the area.', icon: 'fa-truck-moving', tone: 'sky' },
    { key: 'graduated', label: 'Graduated', stamp: 'Graduated', hint: 'Finished their studies with us.', icon: 'fa-graduation-cap', tone: 'amber' },
    { key: 'other', label: 'Other reason', stamp: 'Left', hint: 'Paused, stopped lessons, or anything else.', icon: 'fa-door-open', tone: 'slate' }
]);

export function reasonMeta(key) {
    return LEAVE_REASONS.find((item) => item.key === key) || LEAVE_REASONS[2];
}

let cache = { status: 'idle', items: [], error: '' };
let inflight = null;
let onChange = null;
const dialog = { mode: null, studentId: null, reason: 'moved', note: '', target: 'former', classId: '' };

export function setFormerStudentsListener(fn) {
    onChange = typeof fn === 'function' ? fn : null;
}

function notify() {
    onChange?.();
}

// Other office dialogs (moves, placements) share the same "records changed" repaint.
export function notifyRecordsChanged() {
    notify();
}

function toMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatLeftDate(value) {
    const ms = toMillis(value);
    if (!ms) return 'Date not recorded';
    return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sortFormer(items) {
    return items.slice().sort((a, b) => toMillis(b.leftSchoolAt) - toMillis(a.leftSchoolAt)
        || String(a.name || '').localeCompare(String(b.name || '')));
}

export function getFormerStudents() {
    return cache;
}

/** Guidebook capture and local previews only: fill the former-students file without Firestore. */
export function previewFormerStudents(items = []) {
    cache = { status: 'ready', items: sortFormer(items), error: '' };
}

export function loadFormerStudents({ force = false } = {}) {
    if (inflight) return inflight;
    if (!force && cache.status === 'ready') return Promise.resolve(cache);
    cache = { ...cache, status: cache.status === 'ready' ? 'ready' : 'loading', error: '' };
    inflight = getDocs(query(
        collection(db, `${PUBLIC_DATA_PATH}/students`),
        where('enrollmentStatus', '==', 'inactive')
    ))
        .then((snapshot) => {
            const items = (snapshot?.docs || []).map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            cache = { status: 'ready', items: sortFormer(items), error: '' };
        })
        .catch((error) => {
            console.error('Could not load former students:', error);
            cache = { ...cache, status: 'error', error: error?.message || 'Could not load former students.' };
        })
        .finally(() => {
            inflight = null;
            notify();
        });
    return inflight;
}

function upsertFormer(record) {
    const rest = cache.items.filter((item) => item.id !== record.id);
    cache = { ...cache, status: 'ready', items: sortFormer([record, ...rest]) };
}

function dropFormer(studentId) {
    cache = { ...cache, items: cache.items.filter((item) => item.id !== studentId) };
}

function classById(classId) {
    return (state.get('allSchoolClasses') || []).find((item) => item.id === classId) || null;
}

function liveClassById(classId) {
    return liveSchoolClasses().find((item) => item.id === classId && item.createdBy?.uid) || null;
}

function studentById(studentId) {
    return (state.get('allStudents') || []).find((item) => item.id === studentId) || null;
}

function formerById(studentId) {
    return cache.items.find((item) => item.id === studentId) || null;
}

// ── Undo bar ────────────────────────────────────────────────────────────────

export function showUndoBar(message, onUndo) {
    showUndoToast(escapeHtml(message), onUndo, { key: UNDO_ID, duration: UNDO_MS });
}

// ── Core actions (each one is the undo of the other) ───────────────────────

async function leaveSchool(student, { reason, note }) {
    const classData = classById(student.classId);
    await markStudentLeftSchool({ studentId: student.id, reason, note });
    state.setAllStudents((state.get('allStudents') || []).filter((item) => item.id !== student.id));
    upsertFormer({
        ...student,
        enrollmentStatus: 'inactive',
        classId: null,
        leftReason: reason,
        leftNote: note || '',
        formerClassId: student.classId || student.formerClassId || null,
        formerClassName: classData?.name || student.formerClassName || '',
        formerTeacher: student.createdBy || null,
        formerEnrollmentStatus: student.enrollmentStatus || 'active',
        leftSchoolAt: new Date().toISOString()
    });
    notify();
}

async function bringBack(former, { classId = '', toPlacement = false } = {}) {
    const result = await restoreFormerStudent({ studentId: former.id, classId: classId || undefined, toPlacement });
    const seatedClass = result?.placement === 'class' ? classById(result.classId) : null;
    const { leftReason, leftNote, leftSchoolAt, purgeAfterAt, formerEnrollmentStatus, ...rest } = former;
    const restored = {
        ...rest,
        activeSchoolYearKey: state.getActiveSchoolYearKey?.() || former.activeSchoolYearKey,
        enrollmentStatus: seatedClass ? 'active' : 'pendingPlacement',
        classId: seatedClass ? seatedClass.id : null,
        createdBy: seatedClass?.createdBy || former.createdBy
    };
    const others = (state.get('allStudents') || []).filter((item) => item.id !== former.id);
    state.setAllStudents([...others, restored].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))));
    dropFormer(former.id);
    notify();
    return { restored, seatedClass };
}

// ── Dialog ─────────────────────────────────────────────────────────────────

function ensureDialog() {
    let modal = document.getElementById(DIALOG_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = DIALOG_ID;
    modal.className = 'office-dialog hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'office-dialog-title');
    modal.innerHTML = `
        <div class="office-dialog__panel office-folder" data-office-panel>
            <span class="office-folder__tab" id="office-dialog-tab">Student record</span>
            <button type="button" class="office-close" data-office-dialog-close aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
            <header class="office-dialog__header">
                <p class="office-kicker" id="office-dialog-kicker"></p>
                <h3 class="office-dialog__title" id="office-dialog-title"></h3>
                <p class="office-dialog__subtitle" id="office-dialog-subtitle"></p>
            </header>
            <div class="office-dialog__body custom-scrollbar" id="office-dialog-body"></div>
            <footer class="office-dialog__footer" id="office-dialog-footer"></footer>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', handleDialogClick);
    modal.addEventListener('input', (event) => {
        if (event.target.id === 'office-leave-note') dialog.note = event.target.value;
    });
    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeDialog();
    });
    return modal;
}

function closeDialog() {
    const modal = document.getElementById(DIALOG_ID);
    closeOfficeModal(modal, { onClosed: releaseOfficeScrollLock });
}

function studentSummary(record, { classData, teacherName } = {}) {
    return `
        <div class="office-summary">
            ${renderOfficeAvatar(record, { size: 'lg' })}
            <div class="office-summary__copy">
                <strong>${escapeHtml(record.name || 'Student')}</strong>
                <span>${classData
                    ? `${escapeHtml(classData.logo || '📚')} ${escapeHtml(classData.name)} · ${escapeHtml(teacherName || classData.createdBy?.name || 'Teacher')}`
                    : escapeHtml(record.enrollmentStatus === 'pendingPlacement' ? 'Waiting for a class this year' : record.enrollmentStatus === 'inactive' ? 'Former student, record kept' : 'No class')}</span>
            </div>
        </div>
    `;
}

function renderLeaveDialog() {
    const student = studentById(dialog.studentId);
    if (!student) return null;
    const classData = classById(student.classId);
    return {
        tab: 'Leaving the school',
        kicker: 'Student record',
        title: `${student.name} is leaving`,
        subtitle: 'Choose why. Nothing is deleted, and you can bring them back at any time.',
        body: `
            ${studentSummary(student, { classData })}
            <fieldset class="office-choice-grid" aria-label="Reason for leaving">
                ${LEAVE_REASONS.map((reason) => `
                    <button type="button" class="office-choice office-choice--${reason.tone}${dialog.reason === reason.key ? ' is-selected' : ''}"
                        data-office-reason="${reason.key}" aria-pressed="${dialog.reason === reason.key ? 'true' : 'false'}">
                        <span class="office-choice__icon" aria-hidden="true"><i class="fas ${reason.icon}"></i></span>
                        <strong>${escapeHtml(reason.label)}</strong>
                        <small>${escapeHtml(reason.hint)}</small>
                    </button>
                `).join('')}
            </fieldset>
            <label class="office-field">
                <span>Note for the record <em>optional</em></span>
                <textarea id="office-leave-note" maxlength="240" rows="2" placeholder="e.g. Moved to Thessaloniki in October">${escapeHtml(dialog.note)}</textarea>
            </label>
            <ul class="office-facts">
                <li><i class="fas fa-user-minus" aria-hidden="true"></i>Leaves ${classData ? escapeHtml(classData.name) : 'every'} roster, and every classroom list.</li>
                <li><i class="fas fa-box-archive" aria-hidden="true"></i>Keeps stars, grades, notes and history on file.</li>
                <li><i class="fas fa-lock" aria-hidden="true"></i>Family app access pauses until they return.</li>
                <li><i class="fas fa-rotate-left" aria-hidden="true"></i>Find them later under Former students to bring them back.</li>
            </ul>
        `,
        footer: `
            <button type="button" class="office-btn office-btn--quiet" data-office-dialog-close>Cancel</button>
            <button type="button" class="office-btn office-btn--stamp" data-office-confirm-leave>
                <i class="fas fa-stamp" aria-hidden="true"></i> Mark as left
            </button>
        `
    };
}

function renderReturnDialog() {
    const former = formerById(dialog.studentId);
    if (!former) return null;
    const formerClass = liveClassById(former.formerClassId);
    const classes = liveSchoolClasses().filter((item) => item.createdBy?.uid)
        .slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    const meta = reasonMeta(former.leftReason);
    const option = (key, icon, title, detail) => `
        <button type="button" class="office-route${dialog.target === key ? ' is-selected' : ''}" data-office-return-target="${key}" aria-pressed="${dialog.target === key ? 'true' : 'false'}">
            <span class="office-route__icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
            <span class="office-route__copy"><strong>${title}</strong><small>${detail}</small></span>
            <span class="office-route__check" aria-hidden="true"><i class="fas fa-check"></i></span>
        </button>
    `;
    return {
        tab: 'Welcome back',
        kicker: 'Former student',
        title: `Bring ${former.name} back`,
        subtitle: `${meta.label} on ${formatLeftDate(former.leftSchoolAt)}${former.formerClassName ? ` from ${former.formerClassName}` : ''}. Their record is exactly as they left it.`,
        body: `
            ${studentSummary(former)}
            <div class="office-routes" role="group" aria-label="Where they go">
                ${formerClass ? option('former', 'fa-chalkboard-user', `Back to ${escapeHtml(formerClass.name)}`, `${escapeHtml(formerClass.createdBy?.name || 'Teacher')}'s class, the one they left`) : ''}
                ${classes.length ? option('class', 'fa-shuffle', 'Choose a class', 'Seat them straight into another class this year') : ''}
                ${option('placement', 'fa-hourglass-half', 'Wait in Student placement', 'Seat them later with the other returning students')}
            </div>
            ${dialog.target === 'class' ? `
                <div class="office-class-pick" role="group" aria-label="Choose a class">
                    ${classes.map((item) => `
                        <button type="button" class="office-class-chip${dialog.classId === item.id ? ' is-selected' : ''}" data-office-return-class="${escapeHtml(item.id)}" aria-pressed="${dialog.classId === item.id ? 'true' : 'false'}">
                            <span aria-hidden="true">${escapeHtml(item.logo || '📚')}</span>
                            <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.createdBy?.name || 'Teacher')}</small></span>
                        </button>
                    `).join('')}
                </div>
            ` : ''}
            ${former.leftNote ? `<p class="office-note"><i class="fas fa-quote-left" aria-hidden="true"></i>${escapeHtml(former.leftNote)}</p>` : ''}
        `,
        footer: `
            <button type="button" class="office-btn office-btn--quiet" data-office-dialog-close>Cancel</button>
            <button type="button" class="office-btn office-btn--primary" data-office-confirm-return ${dialog.target === 'class' && !dialog.classId ? 'disabled' : ''}>
                <i class="fas fa-door-open" aria-hidden="true"></i> Bring back
            </button>
        `
    };
}

function paintDialog() {
    const modal = ensureDialog();
    const view = dialog.mode === 'leave' ? renderLeaveDialog() : renderReturnDialog();
    if (!view) {
        closeDialog();
        return false;
    }
    modal.dataset.mode = dialog.mode;
    modal.querySelector('#office-dialog-tab').textContent = view.tab;
    modal.querySelector('#office-dialog-kicker').textContent = view.kicker;
    modal.querySelector('#office-dialog-title').textContent = view.title;
    modal.querySelector('#office-dialog-subtitle').textContent = view.subtitle;
    modal.querySelector('#office-dialog-body').innerHTML = view.body;
    modal.querySelector('#office-dialog-footer').innerHTML = view.footer;
    return true;
}

function showDialog() {
    if (!paintDialog()) return;
    const modal = document.getElementById(DIALOG_ID);
    document.body.classList.add('placement-wizard-open');
    openOfficeModal(modal);
    requestAnimationFrame(() => (modal.querySelector('.office-choice.is-selected, .office-route.is-selected') || modal.querySelector('[data-office-dialog-close]'))?.focus({ preventScroll: true }));
}

export function openLeaveDialog(studentId) {
    if (!studentById(studentId)) return;
    Object.assign(dialog, { mode: 'leave', studentId, reason: 'moved', note: '' });
    showDialog();
}

export function openReturnDialog(studentId) {
    const former = formerById(studentId);
    if (!former) return;
    Object.assign(dialog, {
        mode: 'return',
        studentId,
        target: liveClassById(former.formerClassId) ? 'former' : 'placement',
        classId: ''
    });
    showDialog();
}

export function confirmDeleteFormer(studentId) {
    const former = formerById(studentId);
    if (!former) return;
    showTypedConfirmationModal({
        title: `Delete ${former.name} forever?`,
        message: `<p>This erases ${escapeHtml(former.name)}'s whole record from the app: stars, grades, notes, messages, avatar and family access. <strong>It cannot be undone.</strong></p>
            <p class="mt-2">If they might come back one day, keep them as a former student instead.</p>`,
        expectedText: former.name,
        confirmText: 'Delete forever',
        onConfirm: async () => {
            try {
                await purgeStudent({ studentId });
                dropFormer(studentId);
                notify();
                showToast(`${former.name}'s record was deleted.`, 'success');
            } catch (error) {
                console.error('Could not delete former student:', error);
                showToast(error?.message || 'Could not delete that record.', 'error');
            }
        }
    });
}

async function runLeave(button) {
    const student = studentById(dialog.studentId);
    if (!student) return;
    const snapshot = { ...student };
    const reason = dialog.reason;
    const note = String(dialog.note || '').trim();
    try {
        setBusyState(button, true, 'Filing...');
        await leaveSchool(snapshot, { reason, note });
        closeDialog();
        showUndoBar(`${snapshot.name} moved to Former students.`, async () => {
            const former = formerById(snapshot.id);
            if (!former) return;
            const back = snapshot.enrollmentStatus === 'pendingPlacement'
                ? await bringBack(former, { toPlacement: true })
                : await bringBack(former, { classId: snapshot.classId });
            showToast(`${snapshot.name} is back${back.seatedClass ? ` in ${back.seatedClass.name}` : ' in Student placement'}.`, 'success');
        });
    } catch (error) {
        console.error('Could not mark student as left:', error);
        showToast(error?.message || 'Could not update that student.', 'error');
        setBusyState(button, false);
    }
}

async function runReturn(button) {
    const former = formerById(dialog.studentId);
    if (!former) return;
    const snapshot = { ...former };
    const options = dialog.target === 'placement'
        ? { toPlacement: true }
        : { classId: dialog.target === 'class' ? dialog.classId : former.formerClassId };
    try {
        setBusyState(button, true, 'Bringing back...');
        const { seatedClass } = await bringBack(snapshot, options);
        closeDialog();
        const where = seatedClass ? `back in ${seatedClass.name}` : 'waiting in Student placement';
        showUndoBar(`${snapshot.name} is ${where}.`, async () => {
            const student = studentById(snapshot.id);
            if (!student) return;
            await leaveSchool(student, { reason: snapshot.leftReason || 'other', note: snapshot.leftNote || '' });
            showToast(`${snapshot.name} is back in Former students.`, 'info');
        });
    } catch (error) {
        console.error('Could not bring student back:', error);
        showToast(error?.message || 'Could not bring that student back.', 'error');
        setBusyState(button, false);
    }
}

function handleDialogClick(event) {
    const modal = document.getElementById(DIALOG_ID);
    if (event.target === modal || event.target.closest('[data-office-dialog-close]')) {
        closeDialog();
        return;
    }
    const reasonBtn = event.target.closest('[data-office-reason]');
    if (reasonBtn) {
        dialog.reason = reasonBtn.dataset.officeReason;
        paintDialog();
        return;
    }
    const targetBtn = event.target.closest('[data-office-return-target]');
    if (targetBtn) {
        dialog.target = targetBtn.dataset.officeReturnTarget;
        if (dialog.target !== 'class') dialog.classId = '';
        paintDialog();
        return;
    }
    const classBtn = event.target.closest('[data-office-return-class]');
    if (classBtn) {
        dialog.classId = classBtn.dataset.officeReturnClass;
        paintDialog();
        return;
    }
    const leaveBtn = event.target.closest('[data-office-confirm-leave]');
    if (leaveBtn) {
        runLeave(leaveBtn);
        return;
    }
    const returnBtn = event.target.closest('[data-office-confirm-return]');
    if (returnBtn && !returnBtn.disabled) runReturn(returnBtn);
}
