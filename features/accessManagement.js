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

    return `
        <article class="bg-white rounded-3xl border border-sky-100 p-6 shadow-lg">
            <div class="mb-4">
                <h3 class="font-title text-2xl text-sky-800">Parent Access</h3>
                <p class="text-sm text-slate-500 mt-1">One login per student. Share the username and password with the family.</p>
            </div>
            ${students.length ? `
                <div class="grid gap-4 lg:grid-cols-[minmax(220px,280px)_1fr]">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2" for="options-access-student-select">Student</label>
                        <select id="options-access-student-select" class="w-full px-4 py-3 border border-slate-200 rounded-2xl bg-white">
                            ${students.map((student) => `
                                <option value="${student.id}" ${selectedStudent?.id === student.id ? 'selected' : ''}>${escapeHtml(student.name)}</option>
                            `).join('')}
                        </select>
                        <div class="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            ${link
                                ? `<p><strong class="text-slate-800">Current username:</strong> ${escapeHtml(link.username)}</p><p class="mt-1"><strong class="text-slate-800">Status:</strong> ${escapeHtml(link.status || 'active')}</p>`
                                : '<p>No parent account has been created for this student yet.</p>'
                            }
                        </div>
                    </div>
                    <div class="space-y-4">
                        <div class="grid gap-4 md:grid-cols-2">
                            <div>
                                <label class="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2" for="options-parent-username">Parent username</label>
                                <input id="options-parent-username" type="text" class="w-full px-4 py-3 border border-slate-200 rounded-2xl" value="${escapeHtml(link?.username || '')}" placeholder="e.g. maria.parent">
                            </div>
                            <div>
                                <label class="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2" for="options-parent-password">Password</label>
                                <input id="options-parent-password" type="password" class="w-full px-4 py-3 border border-slate-200 rounded-2xl" placeholder="${link ? 'Enter a new password to reset' : 'Create a password'}">
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-3">
                            <button type="button" id="options-parent-create-btn" class="px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold">Save Parent Account</button>
                            <button type="button" id="options-parent-reset-btn" class="px-5 py-3 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold ${link ? '' : 'hidden'}">Reset Password</button>
                            <button type="button" id="options-parent-disable-btn" class="px-5 py-3 rounded-2xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold ${link ? '' : 'hidden'}">Disable</button>
                            <button type="button" id="options-parent-delete-btn" class="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold ${link ? '' : 'hidden'}">Delete</button>
                        </div>
                    </div>
                </div>
            ` : '<div class="parent-empty">Create students first, then parent accounts can be linked here.</div>'}
        </article>
    `;
}

export async function renderAccessCenterUi() {
    const container = document.getElementById('options-access-content');
    if (!container) return;
    if (!canUseFeature('parentAccess')) {
        container.innerHTML = `
            <div class="parent-empty">Parent access is not included in this school's plan.</div>
        `;
        return;
    }

    await loadAccessData();
    container.innerHTML = `
        <div class="space-y-6">
            ${renderParentAccessCard()}
        </div>
    `;
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
