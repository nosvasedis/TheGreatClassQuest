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

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';

let selectedStudentId = '';
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

function renderParentAccessCard() {
    const students = getManageableStudents().slice().sort((a, b) => a.name.localeCompare(b.name));
    const selectedStudent = getSelectedStudent();
    const link = selectedStudent ? accessData.parentLinksByStudent[selectedStudent.id] : null;

    const status = link ? String(link.status || 'active') : '';
    const statusTone = !link ? 'none' : status === 'active' ? 'active' : 'off';
    const statusLabel = !link ? 'No login yet' : status === 'active' ? 'Active' : status.charAt(0).toUpperCase() + status.slice(1);

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
                            <input id="options-parent-username" type="text" class="ts-input" value="${escapeHtml(link?.username || '')}" placeholder="e.g. maria.parent" autocomplete="off">
                        </label>
                        <label class="ts-field" for="options-parent-password">
                            <span class="ts-label">Password</span>
                            <input id="options-parent-password" type="password" class="ts-input" placeholder="${link ? 'Enter a new password to reset' : 'Create a password'}" autocomplete="new-password">
                        </label>
                    </div>
                    <div class="ts-actions">
                        <button type="button" id="options-parent-create-btn" class="ts-btn bubbly-button"><i class="fas fa-save"></i> Save Parent Account</button>
                        <button type="button" id="options-parent-reset-btn" class="ts-btn ts-btn--quiet bubbly-button ${link ? '' : 'hidden'}"><i class="fas fa-rotate"></i> Reset Password</button>
                        <button type="button" id="options-parent-disable-btn" class="ts-btn ts-btn--quiet bubbly-button ${link ? '' : 'hidden'}"><i class="fas fa-ban"></i> Disable</button>
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
            renderAccessCenterUi().catch((error) => console.error('Could not refresh access center:', error));
        }
    });

    document.getElementById('options-tab')?.addEventListener('click', async (event) => {
        const selectedStudent = getSelectedStudent();
        const currentLink = selectedStudent ? accessData.parentLinksByStudent[selectedStudent.id] : null;

        if (event.target.closest('#options-parent-create-btn')) {
            const button = event.target.closest('#options-parent-create-btn');
            if (!selectedStudent) {
                showToast('Choose a student first.', 'info');
                return;
            }
            const username = document.getElementById('options-parent-username')?.value?.trim();
            const password = document.getElementById('options-parent-password')?.value?.trim();
            if (!username || !password) {
                showToast('Username and password are required.', 'error');
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
                showToast('Parent account saved.', 'success');
                await renderAccessCenterUi();
            } catch (error) {
                console.error('Could not save parent access:', error);
                showToast(error?.message || 'Could not save the parent account.', 'error');
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
                showToast('Enter the new password first.', 'info');
                return;
            }
            try {
                setBusyState(button, true, 'Resetting Password...');
                await resetParentAccessPassword({ studentId: selectedStudent.id, password });
                showToast('Parent password reset.', 'success');
                document.getElementById('options-parent-password').value = '';
            } catch (error) {
                console.error('Could not reset parent password:', error);
                showToast(error?.message || 'Could not reset the parent password.', 'error');
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
                showToast('Parent access disabled.', 'success');
                await renderAccessCenterUi();
            } catch (error) {
                console.error('Could not disable parent access:', error);
                showToast(error?.message || 'Could not disable parent access.', 'error');
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
                        showToast(error?.message || 'Could not delete parent access.', 'error');
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
