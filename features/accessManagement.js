import {
    db,
    doc,
    getDoc
} from '../firebase.js';
import * as state from '../state.js';
import { canUseFeature } from '../utils/subscription.js';
import { createParentAccess, deleteParentAccess, disableParentAccess, resetParentAccessPassword } from '../utils/adminRuntime.js';
import { showToast } from '../ui/effects.js';
import { showModal } from '../ui/modals/index.js';
import { friendlyActionError } from '../utils/friendlyErrors.js';
import { generateFamilyPassword, printClassQrSheet, printFamilySlips, suggestFamilyUsername } from './familyAccessKit.js';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';

const loadStudentPicker = () => import('./familyStudentPicker.js');


let selectedStudentId = '';
// The details just saved, kept only so the teacher can print the family's slip; never stored.
let lastIssued = null;
let slipAsk = null; // the student whose "new slip" confirm is open
let accessData = {
    parentLinksByStudent: {}
};

function setBusyState(button, isBusy, busyLabel, idleHtml = null) {
    if (!button) return;
    if (!button.dataset.idleHtml) {
        button.dataset.idleHtml = idleHtml || button.innerHTML;
    }
    button.disabled = isBusy;
    button.classList.toggle('opacity-70', isBusy);
    button.classList.toggle('cursor-wait', isBusy);
    button.innerHTML = isBusy
        ? `<i class="fas fa-spinner fa-spin mr-2"></i>${escapeHtml(busyLabel)}`
        : button.dataset.idleHtml;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isFamilyAccessStudent(student) {
    const status = student?.enrollmentStatus || 'active';
    return status !== 'inactive';
}

function getManageableStudents() {
    const role = state.get('currentUserRole');
    const currentUserId = state.get('currentUserId');
    const students = (state.get('allStudents') || []).filter(isFamilyAccessStudent);
    if (role === 'secretary') return students;
    return students.filter((student) => student.createdBy?.uid === currentUserId);
}

async function loadAccessData() {
    const manageableStudents = getManageableStudents();
    const parentLinks = await Promise.all(manageableStudents.map(async (student) => {
        const linkSnap = await getDoc(doc(db, `${PUBLIC_DATA_PATH}/parent_links`, student.id));
        return linkSnap.exists() ? { studentId: student.id, ...linkSnap.data() } : null;
    }));

    const parentLinksByStudent = {};
    parentLinks.forEach((data) => {
        if (data?.studentId) {
            parentLinksByStudent[data.studentId] = data;
        }
    });

    accessData = { parentLinksByStudent };
}

function getSelectedStudent() {
    const students = getManageableStudents();
    const fallback = students[0]?.id || '';
    const effectiveId = selectedStudentId || fallback;
    return students.find((student) => student.id === effectiveId) || students[0] || null;
}

/** The parent-login card. Exported (with the links passed in) so the guidebook capture renders the real card. */
export function renderParentAccessCard(data = accessData) {
    const students = getManageableStudents().slice().sort((a, b) => a.name.localeCompare(b.name));
    const selectedStudent = getSelectedStudent();
    const link = selectedStudent ? data.parentLinksByStudent[selectedStudent.id] : null;

    const status = link ? String(link.status || 'active') : '';
    const statusTone = !link ? 'none' : status === 'active' ? 'active' : 'off';
    const statusLabel = !link ? 'No login yet' : status === 'active' ? 'Active' : 'Switched off';
    const suggested = !link && selectedStudent
        ? suggestFamilyUsername(selectedStudent.name, Object.values(data.parentLinksByStudent || {}).map((item) => item.username))
        : '';
    const issued = lastIssued && selectedStudent && lastIssued.studentId === selectedStudent.id ? lastIssued : null;

    return `
        <article class="ts-access">
            ${students.length ? `
                <div class="ts-access__who">
                    ${renderStudentPickerButton(selectedStudent, students.length, link)}
                    <div class="ts-keytag ts-keytag--${statusTone}">
                        <span class="ts-keytag__hole" aria-hidden="true"></span>
                        <span class="ts-keytag__icon" aria-hidden="true"><i class="fas ${link ? 'fa-key' : 'fa-lock-open'}"></i></span>
                        <span class="ts-keytag__text">
                            <span class="ts-keytag__status">${escapeHtml(statusLabel)}</span>
                            ${link
                                ? `<span class="ts-keytag__user">${escapeHtml(link.username)}</span>`
                                : '<span class="ts-keytag__user">No parent account has been created for this student yet.</span>'}
                        </span>
                    </div>
                </div>
                <div class="ts-access__form">
                    <p class="ts-access__lede">One login per student. Share the username and password with the family.</p>
                    <div class="ts-row ts-row--2">
                        <label class="ts-field" for="options-parent-username">
                            <span class="ts-label">Parent username</span>
                            <input id="options-parent-username" type="text" class="ts-input" value="${escapeHtml(link?.username || suggested)}" placeholder="e.g. maria.p" autocomplete="off">
                        </label>
                        <label class="ts-field" for="options-parent-password">
                            <span class="ts-label">Password</span>
                            <input id="options-parent-password" type="text" class="ts-input" placeholder="${link ? 'Type a new password' : 'At least 6 characters'}" autocomplete="off" autocapitalize="off" spellcheck="false">
                        </label>
                    </div>
                    ${issued ? `
                        <div class="ts-access__issued" role="status">
                            <span><i class="fas fa-circle-check" aria-hidden="true"></i> Ready: <code>${escapeHtml(issued.username)}</code> / <code>${escapeHtml(issued.password)}</code></span>
                            <button type="button" id="options-parent-print-btn" class="ts-btn ts-btn--quiet bubbly-button"><i class="fas fa-print"></i> Print family slip</button>
                        </div>` : (link && status === 'active' ? `
                        <div class="ts-access__issued ts-access__issued--slip">
                            ${slipAsk === selectedStudent?.id
                                ? `<span><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> A new slip comes with a new password. The family's old slip and password stop working.</span>
                                   <span class="ts-access__slipbtns">
                                       <button type="button" id="options-parent-slip-cancel" class="ts-btn ts-btn--quiet bubbly-button">Cancel</button>
                                       <button type="button" id="options-parent-slip-go" class="ts-btn bubbly-button"><i class="fas fa-print"></i> New password and print</button>
                                   </span>`
                                : `<span><i class="fas fa-receipt" aria-hidden="true"></i> Lost the slip? Passwords are never stored, so a new slip gets a new easy password.</span>
                                   <button type="button" id="options-parent-slip-btn" class="ts-btn ts-btn--quiet bubbly-button"><i class="fas fa-print"></i> Print a new slip</button>`}
                        </div>` : '')}
                    <div class="ts-actions">
                        <button type="button" id="options-parent-suggest-btn" class="ts-btn ts-btn--quiet bubbly-button" title="Make an easy password"><i class="fas fa-dice"></i> Easy password</button>
                        <button type="button" id="options-parent-create-btn" class="ts-btn bubbly-button"><i class="fas fa-save"></i> Save Parent Account</button>
                        <button type="button" id="options-parent-reset-btn" class="ts-btn ts-btn--quiet bubbly-button ${link ? '' : 'hidden'}"><i class="fas fa-rotate"></i> ${status === 'active' ? 'Reset Password' : 'Switch back on'}</button>
                        <button type="button" id="options-parent-disable-btn" class="ts-btn ts-btn--quiet bubbly-button ${link && status === 'active' ? '' : 'hidden'}"><i class="fas fa-ban"></i> Disable</button>
                        <button type="button" id="options-parent-delete-btn" class="ts-btn ts-btn--danger bubbly-button ${link ? '' : 'hidden'}"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
                ${renderQrSheetRow(students)}
            ` : '<div class="parent-empty ts-empty"><div class="ts-empty__icon" aria-hidden="true">👪</div><p class="ts-empty__text">Create students first, then parent accounts can be linked here.</p></div>'}
        </article>
    `;
}

function pickerInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

/** The closed student picker: who is picked, their class and key colour. Opens the class roll (features/familyStudentPicker.js). */
function renderStudentPickerButton(student, total, link) {
    const classData = student ? classesById().get(student.classId) : null;
    const tone = !link ? 'none' : String(link.status || 'active') === 'active' ? 'active' : 'off';
    const face = student?.avatar
        ? `<span class="fsp-trigger__face"><img src="${escapeHtml(student.avatar)}" alt="" loading="lazy" decoding="async"></span>`
        : `<span class="fsp-trigger__face fsp-trigger__face--initials" aria-hidden="true">${escapeHtml(pickerInitials(student?.name))}</span>`;
    return `
        <div class="ts-field fsp-field">
            <span class="ts-label" id="fsp-label">Student</span>
            <button type="button" class="fsp-trigger" id="options-access-student-trigger" aria-haspopup="dialog" aria-expanded="false" aria-labelledby="fsp-label fsp-trigger-name" title="Choose from ${total} students">
                ${face}
                <span class="fsp-trigger__text">
                    <span class="fsp-trigger__name" id="fsp-trigger-name">${escapeHtml(student?.name || 'Choose a student')}</span>
                    ${classData ? `<span class="fsp-trigger__class">${escapeHtml(classData.logo || '')} ${escapeHtml(classData.name || '')}</span>` : ''}
                </span>
                <span class="fsp-dot fsp-dot--${tone}" aria-hidden="true"></span>
                <span class="fsp-trigger__open" aria-hidden="true"><i class="fas fa-chevron-down"></i></span>
            </button>
        </div>`;
}

function classesById() {
    const map = new Map();
    [...(state.get('allTeachersClasses') || []), ...(state.get('allSchoolClasses') || [])].forEach((item) => { if (item?.id && !map.has(item.id)) map.set(item.id, item); });
    return map;
}

/** One "print QR cards" button per class: every student's QR card on A4 with cut lines, for notebooks. */
function renderQrSheetRow(students) {
    const classes = classesById();
    const ids = [...new Set(students.map((student) => student.classId).filter((id) => classes.has(id)))]
        .sort((a, b) => String(classes.get(a).name || '').localeCompare(String(classes.get(b).name || '')));
    if (!ids.length) return '';
    return `
        <div class="ts-access__qr-sheets">
            <p class="ts-access__lede"><i class="fas fa-qrcode" aria-hidden="true"></i> Notebook QR cards: every student of a class on one A4 sheet, with cut lines and names. Each card opens the family's sign-in with their username filled in.</p>
            <div class="ts-actions">
                ${ids.map((id) => {
                    const classData = classes.get(id);
                    return `<button type="button" class="ts-btn ts-btn--quiet bubbly-button" data-access-qr-sheet="${escapeHtml(id)}"><i class="fas fa-print"></i> ${escapeHtml(classData.logo || '')} ${escapeHtml(classData.name || 'Class')}</button>`;
                }).join('')}
            </div>
        </div>`;
}

async function printQrSheetForClass(button) {
    const classId = button.dataset.accessQrSheet;
    const classData = classesById().get(classId);
    const students = getManageableStudents()
        .filter((student) => student.classId === classId)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    if (!students.length) return;
    setBusyState(button, true, 'Preparing…');
    try {
        await printClassQrSheet({
            schoolName: state.get('schoolName') || '',
            className: classData?.name || '',
            cards: students.map((student) => {
                const link = accessData.parentLinksByStudent[student.id];
                return { studentName: student.name, username: link && String(link.status || 'active') === 'active' ? link.username : '' };
            })
        });
    } catch (error) {
        console.error('Could not print the QR cards:', error);
        showToast('Could not open printing. Try again.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

export async function renderAccessCenterUi() {
    const container = document.getElementById('options-access-content');
    if (!container) return;
    if (!canUseFeature('parentAccess')) {
        container.innerHTML = `
            <div class="parent-empty ts-empty">Parent access is not included in this school's plan.</div>
        `;
        return;
    }

    const [picker] = await Promise.all([loadStudentPicker(), loadAccessData()]);
    await picker.loadFamilyPickerStyles().catch(() => {});
    picker.closeFamilyStudentPicker();
    container.innerHTML = renderParentAccessCard();
}

/** Picking a student only redraws the card from the logins already loaded. */
function showPickedStudent(studentId) {
    selectedStudentId = studentId;
    lastIssued = null;
    const container = document.getElementById('options-access-content');
    if (!container) return;
    container.innerHTML = renderParentAccessCard();
    container.querySelector('#options-access-student-trigger')?.focus({ preventScroll: true });
}

async function openStudentPicker(trigger) {
    try {
        const { openFamilyStudentPicker } = await loadStudentPicker();
        await openFamilyStudentPicker({
            trigger,
            students: getManageableStudents(),
            classes: classesById(),
            links: accessData.parentLinksByStudent || {},
            selectedId: getSelectedStudent()?.id || '',
            onPick: showPickedStudent
        });
    } catch (error) {
        console.error('Could not open the student list:', error);
        showToast('Could not open the student list. Try again.', 'error');
    }
}

export function openAccessCenterForStudent(studentId) {
    selectedStudentId = studentId || '';
}

export function wireAccessCenterEvents() {
    document.getElementById('options-tab')?.addEventListener('click', async (event) => {
        const selectedStudent = getSelectedStudent();
        const currentLink = selectedStudent ? accessData.parentLinksByStudent[selectedStudent.id] : null;

        const pickerTrigger = event.target.closest('#options-access-student-trigger');
        if (pickerTrigger) {
            void openStudentPicker(pickerTrigger);
            return;
        }

        if (event.target.closest('#options-parent-suggest-btn')) {
            const input = document.getElementById('options-parent-password');
            if (input) {
                input.value = generateFamilyPassword();
                input.focus();
                input.select();
            }
            return;
        }

        const qrSheetBtn = event.target.closest('[data-access-qr-sheet]');
        if (qrSheetBtn) {
            void printQrSheetForClass(qrSheetBtn);
            return;
        }

        if (event.target.closest('#options-parent-slip-btn')) {
            slipAsk = selectedStudent?.id || null;
            await renderAccessCenterUi();
            document.getElementById('options-parent-slip-go')?.focus();
            return;
        }

        if (event.target.closest('#options-parent-slip-cancel')) {
            slipAsk = null;
            await renderAccessCenterUi();
            return;
        }

        if (event.target.closest('#options-parent-slip-go')) {
            const button = event.target.closest('#options-parent-slip-go');
            if (!selectedStudent || !currentLink) return;
            const password = generateFamilyPassword();
            try {
                setBusyState(button, true, 'Making the slip...');
                await resetParentAccessPassword({ studentId: selectedStudent.id, password });
                lastIssued = { studentId: selectedStudent.id, username: currentLink.username, password };
                slipAsk = null;
                const classData = (state.get('allSchoolClasses') || state.get('allTeachersClasses') || []).find((item) => item.id === selectedStudent.classId);
                await printFamilySlips({
                    schoolName: state.get('schoolName') || '',
                    slips: [{ studentName: selectedStudent.name, className: classData?.name || '', username: currentLink.username, password }]
                }).catch(() => showToast('Could not open printing. Use Print family slip to try again.', 'error'));
                await renderAccessCenterUi();
            } catch (error) {
                console.error('Could not make a new family slip:', error);
                showToast(friendlyActionError(error, 'Could not make a new slip.'), 'error');
                setBusyState(button, false);
            }
            return;
        }

        if (event.target.closest('#options-parent-print-btn')) {
            if (!lastIssued || lastIssued.studentId !== selectedStudent?.id) return;
            const classData = (state.get('allSchoolClasses') || state.get('allTeachersClasses') || []).find((item) => item.id === selectedStudent.classId);
            printFamilySlips({
                schoolName: state.get('schoolName') || '',
                slips: [{ studentName: selectedStudent.name, className: classData?.name || '', username: lastIssued.username, password: lastIssued.password }]
            }).catch(() => showToast('Could not open printing. Try again.', 'error'));
            return;
        }

        if (event.target.closest('#options-parent-create-btn')) {
            const button = event.target.closest('#options-parent-create-btn');
            if (!selectedStudent) {
                showToast('Choose a student first.', 'info');
                return;
            }
            const username = document.getElementById('options-parent-username')?.value?.trim();
            const password = document.getElementById('options-parent-password')?.value?.trim();
            if (!username || !password) {
                showToast('Type a username and a password first.', 'error');
                return;
            }
            if (password.length < 6) {
                showToast('Passwords need at least 6 characters.', 'error');
                return;
            }
            try {
                setBusyState(button, true, 'Saving Parent Account...');
                await createParentAccess({
                    studentId: selectedStudent.id,
                    classId: selectedStudent.classId,
                    studentName: selectedStudent.name,
                    username,
                    password
                });
                lastIssued = { studentId: selectedStudent.id, username: username.toLowerCase().replace(/[^a-z0-9._-]/g, ''), password };
                showToast('Parent account saved. You can print the family slip now.', 'success');
                await renderAccessCenterUi();
            } catch (error) {
                console.error('Could not save parent access:', error);
                showToast(friendlyActionError(error, 'Could not save the parent account.'), 'error');
            } finally {
                setBusyState(button, false);
            }
            return;
        }

        if (event.target.closest('#options-parent-reset-btn')) {
            const button = event.target.closest('#options-parent-reset-btn');
            if (!selectedStudent || !currentLink) return;
            const password = document.getElementById('options-parent-password')?.value?.trim();
            if (!password) {
                showToast('Type the new password first, or press Easy password.', 'info');
                return;
            }
            if (password.length < 6) {
                showToast('Passwords need at least 6 characters.', 'error');
                return;
            }
            try {
                const isOff = String(currentLink.status || 'active') !== 'active';
                setBusyState(button, true, isOff ? 'Switching on...' : 'Resetting Password...');
                if (isOff) {
                    // Switching back on goes through the same call as creating, which reactivates the family's profile too.
                    await createParentAccess({
                        studentId: selectedStudent.id,
                        classId: selectedStudent.classId,
                        studentName: selectedStudent.name,
                        username: currentLink.username,
                        password
                    });
                } else {
                    await resetParentAccessPassword({ studentId: selectedStudent.id, password });
                }
                lastIssued = { studentId: selectedStudent.id, username: currentLink.username, password };
                showToast(isOff ? 'Parent access is back on.' : 'Parent password reset.', 'success');
                await renderAccessCenterUi();
            } catch (error) {
                console.error('Could not reset parent password:', error);
                showToast(friendlyActionError(error, 'Could not reset the parent password.'), 'error');
            } finally {
                setBusyState(button, false);
            }
            return;
        }

        if (event.target.closest('#options-parent-disable-btn')) {
            const button = event.target.closest('#options-parent-disable-btn');
            if (!selectedStudent || !currentLink) return;
            try {
                setBusyState(button, true, 'Disabling Parent Access...');
                await disableParentAccess({ studentId: selectedStudent.id });
                lastIssued = null;
                showToast('Parent access disabled.', 'success');
                await renderAccessCenterUi();
            } catch (error) {
                console.error('Could not disable parent access:', error);
                showToast(friendlyActionError(error, 'Could not disable parent access.'), 'error');
            } finally {
                setBusyState(button, false);
            }
            return;
        }

        if (event.target.closest('#options-parent-delete-btn')) {
            const button = event.target.closest('#options-parent-delete-btn');
            if (!selectedStudent || !currentLink) return;
            showModal(
                'Delete Parent Access?',
                `This will permanently delete the parent login for ${escapeHtml(selectedStudent.name)}. The username can be recreated later.`,
                async () => {
                    try {
                        setBusyState(button, true, 'Deleting Parent Access...');
                        await deleteParentAccess({ studentId: selectedStudent.id });
                        showToast('Parent access deleted.', 'success');
                        await renderAccessCenterUi();
                    } catch (error) {
                        console.error('Could not delete parent access:', error);
                        showToast(friendlyActionError(error, 'Could not delete parent access.'), 'error');
                    } finally {
                        setBusyState(button, false);
                    }
                },
                'Delete',
                'Cancel'
            );
            return;
        }

    });
}
