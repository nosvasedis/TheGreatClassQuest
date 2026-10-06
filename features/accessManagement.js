import {
    db,
    doc,
    getDoc
} from '../firebase.js';
import * as state from '../state.js';
import { canUseFeature } from '../utils/subscription.js';
import { createParentAccess, deleteParentAccess, disableParentAccess, resetParentAccessPassword } from '../utils/adminRuntime.js';
import { showToast } from '../ui/effects.js';
import { showModal } from '../ui/modals.js';
import { friendlyActionError } from '../utils/friendlyErrors.js';
import { generateFamilyPassword, printFamilySlips, suggestFamilyUsername } from './familyAccessKit.js';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';


let selectedStudentId = '';
// The details just saved, kept only so the teacher can print the family's slip; never stored.
let lastIssued = null;
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
                    <label class="ts-field" for="options-access-student-select">
                        <span class="ts-label">Student</span>
                        <select id="options-access-student-select" class="ts-input">
                            ${students.map((student) => `
                                <option value="${student.id}" ${selectedStudent?.id === student.id ? 'selected' : ''}>${escapeHtml(student.name)}</option>
                            `).join('')}
                        </select>
                    </label>
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
                        </div>` : ''}
                    <div class="ts-actions">
                        <button type="button" id="options-parent-suggest-btn" class="ts-btn ts-btn--quiet bubbly-button" title="Make an easy password"><i class="fas fa-dice"></i> Easy password</button>
                        <button type="button" id="options-parent-create-btn" class="ts-btn bubbly-button"><i class="fas fa-save"></i> Save Parent Account</button>
                        <button type="button" id="options-parent-reset-btn" class="ts-btn ts-btn--quiet bubbly-button ${link ? '' : 'hidden'}"><i class="fas fa-rotate"></i> ${status === 'active' ? 'Reset Password' : 'Switch back on'}</button>
                        <button type="button" id="options-parent-disable-btn" class="ts-btn ts-btn--quiet bubbly-button ${link && status === 'active' ? '' : 'hidden'}"><i class="fas fa-ban"></i> Disable</button>
                        <button type="button" id="options-parent-delete-btn" class="ts-btn ts-btn--danger bubbly-button ${link ? '' : 'hidden'}"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                </div>
            ` : '<div class="parent-empty ts-empty"><div class="ts-empty__icon" aria-hidden="true">👪</div><p class="ts-empty__text">Create students first, then parent accounts can be linked here.</p></div>'}
        </article>
    `;
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

    await loadAccessData();
    container.innerHTML = renderParentAccessCard();
}

export function openAccessCenterForStudent(studentId) {
    selectedStudentId = studentId || '';
}

export function wireAccessCenterEvents() {
    document.getElementById('options-tab')?.addEventListener('change', (event) => {
        if (event.target.id === 'options-access-student-select') {
            selectedStudentId = event.target.value;
            lastIssued = null;
            renderAccessCenterUi().catch((error) => console.error('Could not refresh access center:', error));
        }
    });

    document.getElementById('options-tab')?.addEventListener('click', async (event) => {
        const selectedStudent = getSelectedStudent();
        const currentLink = selectedStudent ? accessData.parentLinksByStudent[selectedStudent.id] : null;

        if (event.target.closest('#options-parent-suggest-btn')) {
            const input = document.getElementById('options-parent-password');
            if (input) {
                input.value = generateFamilyPassword();
                input.focus();
                input.select();
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
