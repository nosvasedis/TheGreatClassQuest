import {
    db,
    doc,
    getDoc
} from '../firebase.js';
import * as state from '../state.js';
import { canUseFeature } from '../utils/subscription.js';
import { createOrReplaceSecretaryAccess, createParentAccess, disableParentAccess, disableSecretaryAccess, publishParentHomework, resetParentAccessPassword } from '../utils/adminRuntime.js';
import { showToast } from '../ui/effects.js';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';

let selectedStudentId = '';
let accessData = {
    parentLinksByStudent: {},
    secretaryRole: null
};

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getManageableStudents() {
    const role = state.get('currentUserRole');
    const currentUserId = state.get('currentUserId');
    const students = state.get('allStudents') || [];
    if (role === 'secretary') return students;
    return students.filter((student) => student.createdBy?.uid === currentUserId);
}

async function loadAccessData() {
    const manageableStudents = getManageableStudents();
    const [parentLinks, secretarySnapshot] = await Promise.all([
        Promise.all(manageableStudents.map(async (student) => {
            const linkSnap = await getDoc(doc(db, `${PUBLIC_DATA_PATH}/parent_links`, student.id));
            return linkSnap.exists() ? { studentId: student.id, ...linkSnap.data() } : null;
        })),
        getDoc(doc(db, `${PUBLIC_DATA_PATH}/school_roles`, 'secretary'))
    ]);

    const parentLinksByStudent = {};
    parentLinks.forEach((data) => {
        if (data?.studentId) {
            parentLinksByStudent[data.studentId] = data;
        }
    });

    accessData = {
        parentLinksByStudent,
        secretaryRole: secretarySnapshot.exists() ? { id: secretarySnapshot.id, ...secretarySnapshot.data() } : null
    };
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
            <div class="flex items-center justify-between gap-4 mb-4">
                <div>
                    <h3 class="font-title text-2xl text-sky-800">Parent Access</h3>
                    <p class="text-sm text-slate-500 mt-1">One parent login per student. Parents see curated progress, homework, and school messages.</p>
                </div>
                <span class="inline-flex items-center rounded-full bg-sky-100 text-sky-700 px-3 py-1 text-xs font-bold uppercase tracking-wide">Pro+</span>
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
                        </div>
                        <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                            <p class="text-sm font-semibold text-emerald-900 mb-2">Quick Homework Share</p>
                            <div class="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                                <input id="options-parent-homework-date" type="date" class="px-4 py-3 border border-emerald-200 rounded-2xl bg-white">
                                <input id="options-parent-homework-title" type="text" class="px-4 py-3 border border-emerald-200 rounded-2xl bg-white" placeholder="Homework title">
                            </div>
                            <textarea id="options-parent-homework-body" class="w-full mt-3 px-4 py-3 border border-emerald-200 rounded-2xl bg-white" rows="4" placeholder="What should the parent know for the next lesson?"></textarea>
                            <button type="button" id="options-parent-homework-btn" class="mt-3 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">Publish Homework</button>
                        </div>
                    </div>
                </div>
            ` : '<div class="parent-empty">Create students first, then parent accounts can be linked here.</div>'}
        </article>
    `;
}

function renderSecretaryAccessCard() {
    const role = state.get('currentUserRole');
    const canManageSecretary = state.get('isSchoolAdmin') || role === 'secretary';
    const secretaryRole = accessData.secretaryRole;
    if (!canUseFeature('secretaryAccess')) {
        return `
            <article class="bg-white rounded-3xl border border-amber-100 p-6 shadow-lg">
                <h3 class="font-title text-2xl text-amber-800">Secretary Console</h3>
                <p class="text-sm text-slate-500 mt-2">This school needs the Elite plan to activate the secretary role.</p>
            </article>
        `;
    }

    return `
        <article class="bg-white rounded-3xl border border-violet-100 p-6 shadow-lg">
            <div class="flex items-center justify-between gap-4 mb-4">
                <div>
                    <h3 class="font-title text-2xl text-violet-800">Secretary Account</h3>
                    <p class="text-sm text-slate-500 mt-1">One secretary per school with school-wide read/write access.</p>
                </div>
                <span class="inline-flex items-center rounded-full bg-violet-100 text-violet-700 px-3 py-1 text-xs font-bold uppercase tracking-wide">Elite</span>
            </div>
            <div class="grid gap-4 lg:grid-cols-[260px_1fr]">
                <div class="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    ${secretaryRole
                        ? `<p><strong class="text-slate-800">Current username:</strong> ${escapeHtml(secretaryRole.username || 'Not set')}</p><p class="mt-1"><strong class="text-slate-800">Status:</strong> ${escapeHtml(secretaryRole.status || 'active')}</p>`
                        : '<p>No secretary account has been created yet.</p>'
                    }
                </div>
                <div class="space-y-4">
                    <div class="grid gap-4 md:grid-cols-2">
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2" for="options-secretary-username">Secretary username</label>
                            <input id="options-secretary-username" type="text" class="w-full px-4 py-3 border border-slate-200 rounded-2xl" value="${escapeHtml(secretaryRole?.username || '')}" placeholder="e.g. frontoffice">
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2" for="options-secretary-password">Password</label>
                            <input id="options-secretary-password" type="password" class="w-full px-4 py-3 border border-slate-200 rounded-2xl" placeholder="${secretaryRole ? 'Enter a new password to replace' : 'Create a password'}">
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-3">
                        <button type="button" id="options-secretary-create-btn" class="px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold">Save Secretary Account</button>
                        <button type="button" id="options-secretary-disable-btn" class="px-5 py-3 rounded-2xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold ${secretaryRole ? '' : 'hidden'}">Disable</button>
                    </div>
                </div>
            </div>
        </article>
    `;
}

export async function renderAccessCenterUi() {
    const container = document.getElementById('options-access-content');
    if (!container) return;
    if (!canUseFeature('parentAccess') && !canUseFeature('secretaryAccess') && state.get('currentUserRole') !== 'secretary' && !state.get('isSchoolAdmin')) {
        container.innerHTML = `
            <div class="parent-empty">This school's current plan does not include role-based parent or secretary access.</div>
        `;
        return;
    }

    await loadAccessData();
    container.innerHTML = `
        <div class="space-y-6">
            ${renderParentAccessCard()}
            ${renderSecretaryAccessCard()}
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
            }
            return;
        }

        if (event.target.closest('#options-parent-reset-btn')) {
            if (!selectedStudent || !currentLink) return;
            const password = document.getElementById('options-parent-password')?.value?.trim();
            if (!password) {
                showToast('Enter the new password first.', 'info');
                return;
            }
            try {
                await resetParentAccessPassword({ studentId: selectedStudent.id, password });
                showToast('Parent password reset.', 'success');
                document.getElementById('options-parent-password').value = '';
            } catch (error) {
                console.error('Could not reset parent password:', error);
                showToast(error?.message || 'Could not reset the parent password.', 'error');
            }
            return;
        }

        if (event.target.closest('#options-parent-disable-btn')) {
            if (!selectedStudent || !currentLink) return;
            try {
                await disableParentAccess({ studentId: selectedStudent.id });
                showToast('Parent access disabled.', 'success');
                await renderAccessCenterUi();
            } catch (error) {
                console.error('Could not disable parent access:', error);
                showToast(error?.message || 'Could not disable parent access.', 'error');
            }
            return;
        }

        if (event.target.closest('#options-secretary-create-btn')) {
            const username = document.getElementById('options-secretary-username')?.value?.trim();
            const password = document.getElementById('options-secretary-password')?.value?.trim();
            if (!username || !password) {
                showToast('Secretary username and password are required.', 'error');
                return;
            }
            try {
                await createOrReplaceSecretaryAccess({ username, password });
                showToast('Secretary account saved.', 'success');
                await renderAccessCenterUi();
            } catch (error) {
                console.error('Could not save secretary account:', error);
                showToast(error?.message || 'Could not save the secretary account.', 'error');
            }
            return;
        }

        if (event.target.closest('#options-secretary-disable-btn')) {
            try {
                await disableSecretaryAccess({});
                showToast('Secretary access disabled.', 'success');
                await renderAccessCenterUi();
            } catch (error) {
                console.error('Could not disable secretary access:', error);
                showToast(error?.message || 'Could not disable the secretary account.', 'error');
            }
            return;
        }

        if (event.target.closest('#options-parent-homework-btn')) {
            if (!selectedStudent) {
                showToast('Choose a student first.', 'info');
                return;
            }
            const lessonDate = document.getElementById('options-parent-homework-date')?.value?.trim();
            const title = document.getElementById('options-parent-homework-title')?.value?.trim();
            const body = document.getElementById('options-parent-homework-body')?.value?.trim();
            if (!lessonDate || !title || !body) {
                showToast('Add the date, title, and homework details first.', 'error');
                return;
            }
            try {
                await publishParentHomework({
                    studentId: selectedStudent.id,
                    classId: selectedStudent.classId,
                    lessonDate,
                    title,
                    body
                });
                showToast('Homework published for the parent portal.', 'success');
                document.getElementById('options-parent-homework-title').value = '';
                document.getElementById('options-parent-homework-body').value = '';
            } catch (error) {
                console.error('Could not publish homework:', error);
                showToast(error?.message || 'Could not publish homework.', 'error');
            }
        }
    });
}
