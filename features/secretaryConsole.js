import * as state from '../state.js';
import * as modals from '../ui/modals.js';

let listenersWired = false;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function filteredClasses() {
    const query = String(state.get('secretaryView')?.classFilter || '').trim().toLowerCase();
    const classes = state.get('allSchoolClasses') || [];
    if (!query) return classes;
    return classes.filter((item) =>
        String(item.name || '').toLowerCase().includes(query) ||
        String(item.questLevel || '').toLowerCase().includes(query)
    );
}

function filteredStudents() {
    const query = String(state.get('secretaryView')?.studentFilter || '').trim().toLowerCase();
    const students = state.get('allStudents') || [];
    if (!query) return students;
    return students.filter((item) =>
        String(item.name || '').toLowerCase().includes(query)
    );
}

function renderOverviewSection() {
    const classes = state.get('allSchoolClasses') || [];
    const students = state.get('allStudents') || [];
    const scores = state.get('allStudentScores') || [];
    const totalStars = scores.reduce((sum, item) => sum + Number(item.totalStars || 0), 0);
    const totalGold = scores.reduce((sum, item) => sum + Number(item.gold || 0), 0);

    return `
        <div class="secretary-stat-grid">
            <article class="secretary-card">
                <div class="text-xs uppercase tracking-wide text-slate-400">Classes</div>
                <div class="font-title text-3xl text-sky-700 mt-2">${classes.length}</div>
            </article>
            <article class="secretary-card">
                <div class="text-xs uppercase tracking-wide text-slate-400">Students</div>
                <div class="font-title text-3xl text-emerald-700 mt-2">${students.length}</div>
            </article>
            <article class="secretary-card">
                <div class="text-xs uppercase tracking-wide text-slate-400">Total Stars</div>
                <div class="font-title text-3xl text-amber-700 mt-2">${totalStars}</div>
            </article>
            <article class="secretary-card">
                <div class="text-xs uppercase tracking-wide text-slate-400">Treasury</div>
                <div class="font-title text-3xl text-indigo-700 mt-2">${totalGold}</div>
            </article>
        </div>
    `;
}

function renderClassSection() {
    const classes = filteredClasses().slice().sort((a, b) => a.name.localeCompare(b.name));
    return `
        <article class="secretary-card">
            <p class="secretary-card__title">All Classes</p>
            <div class="secretary-list">
                ${classes.length
                    ? classes.map((item) => `
                        <div class="secretary-list-item">
                            <div class="flex items-center justify-between gap-3">
                                <div>
                                    <div class="font-semibold text-slate-800">${escapeHtml(item.logo || '📚')} ${escapeHtml(item.name)}</div>
                                    <div class="text-xs text-slate-400 mt-1">${escapeHtml(item.questLevel || 'League')} • ${escapeHtml(item.createdBy?.name || 'Teacher')}</div>
                                </div>
                                <button type="button" class="text-sm font-semibold text-sky-600 hover:underline" data-secretary-edit-class="${item.id}">Edit</button>
                            </div>
                        </div>
                    `).join('')
                    : '<div class="secretary-empty">No classes match the current filter.</div>'
                }
            </div>
        </article>
    `;
}

function renderStudentSection() {
    const students = filteredStudents().slice().sort((a, b) => a.name.localeCompare(b.name));
    const classes = state.get('allSchoolClasses') || [];
    return `
        <article class="secretary-card">
            <p class="secretary-card__title">All Students</p>
            <div class="secretary-list">
                ${students.length
                    ? students.map((student) => {
                        const classData = classes.find((item) => item.id === student.classId);
                        return `
                            <div class="secretary-list-item">
                                <div class="flex items-center justify-between gap-3">
                                    <div>
                                        <div class="font-semibold text-slate-800">${escapeHtml(student.name)}</div>
                                        <div class="text-xs text-slate-400 mt-1">${escapeHtml(classData?.name || 'Unknown class')}</div>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <button type="button" class="text-sm font-semibold text-sky-600 hover:underline" data-secretary-edit-student="${student.id}">Edit</button>
                                        <button type="button" class="text-sm font-semibold text-emerald-600 hover:underline" data-secretary-chronicle="${student.id}">Notes</button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')
                    : '<div class="secretary-empty">No students match the current filter.</div>'
                }
            </div>
        </article>
    `;
}

function renderAcademicSection() {
    const scores = state.get('allWrittenScores') || [];
    return `
        <article class="secretary-card">
            <div class="flex items-center justify-between gap-3">
                <p class="secretary-card__title">Academic Feed</p>
                <p class="text-sm text-slate-500">Use the Teacher View for full grading edits.</p>
            </div>
            <div class="secretary-list">
                ${scores.length
                    ? scores.slice(0, 20).map((item) => `
                        <div class="secretary-list-item">
                            <div class="font-semibold text-slate-800">${escapeHtml(item.title || item.type || 'Assessment')}</div>
                            <div class="text-xs text-slate-400 mt-1">${escapeHtml(item.studentName || item.studentId || '')} • ${escapeHtml(item.date || '')}</div>
                            <div class="text-sm text-slate-600 mt-2">${escapeHtml(item.scoreQualitative || `${item.scoreNumeric || ''}${item.maxScore ? ` / ${item.maxScore}` : ''}`)}</div>
                        </div>
                    `).join('')
                    : '<div class="secretary-empty">No academic results loaded yet.</div>'
                }
            </div>
        </article>
    `;
}

function renderCommunicationSection() {
    const threads = state.get('currentCommunicationThreads') || [];
    const messages = state.get('currentCommunicationMessages') || [];
    return `
        <div class="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <article class="secretary-card">
                <p class="secretary-card__title">Communication Threads</p>
                <div class="secretary-list">
                    ${threads.length
                        ? threads.map((thread) => `
                            <button type="button" class="parent-thread-btn ${thread.id === state.get('currentCommunicationThreadId') ? 'parent-thread-btn-active' : ''}" data-secretary-thread="${thread.id}">
                                <div class="secretary-list-item">
                                    <div class="font-semibold text-slate-800">${escapeHtml(thread.threadType || 'Message')}</div>
                                    <div class="text-xs text-slate-400 mt-1">${escapeHtml(thread.studentName || thread.studentId || '')}</div>
                                </div>
                            </button>
                        `).join('')
                        : '<div class="secretary-empty">No threads yet.</div>'
                    }
                </div>
            </article>
            <article class="secretary-card">
                <p class="secretary-card__title">Latest Messages</p>
                <div class="secretary-list">
                    ${messages.length
                        ? messages.map((message) => `
                            <div class="secretary-list-item">
                                <div class="flex items-center justify-between gap-3">
                                    <div class="font-semibold text-slate-800">${escapeHtml(message.authorRole || 'School')}</div>
                                    <div class="text-xs text-slate-400">${escapeHtml(message.createdAt?.toDate ? message.createdAt.toDate().toLocaleString('en-GB') : message.createdAt || '')}</div>
                                </div>
                                <div class="text-sm text-slate-600 mt-2 whitespace-pre-wrap">${escapeHtml(message.body || '')}</div>
                            </div>
                        `).join('')
                        : '<div class="secretary-empty">Select a thread to inspect school communication.</div>'
                    }
                </div>
            </article>
        </div>
    `;
}

function renderSettingsSection() {
    const profile = state.get('currentUserProfile');
    return `
        <article class="secretary-card">
            <p class="secretary-card__title">Secretary Permissions</p>
            <div class="secretary-list">
                <div class="secretary-list-item">
                    <div class="font-semibold text-slate-800">Account</div>
                    <div class="text-sm text-slate-600 mt-2">${escapeHtml(profile?.displayName || 'Secretary')}</div>
                </div>
                <div class="secretary-list-item">
                    <div class="font-semibold text-slate-800">Scope</div>
                    <div class="text-sm text-slate-600 mt-2">All classes, all students, all assessments, all notes, all communication threads.</div>
                </div>
            </div>
        </article>
    `;
}

export function activateSecretaryTab(tabKey) {
    document.querySelectorAll('.secretary-nav-btn').forEach((btn) => {
        btn.classList.toggle('secretary-nav-btn-active', btn.dataset.secretaryTab === tabKey);
    });
    document.querySelectorAll('[data-secretary-section]').forEach((section) => {
        section.classList.toggle('hidden', section.dataset.secretarySection !== tabKey);
    });
}

export function renderSecretaryConsole() {
    const sections = {
        overview: renderOverviewSection(),
        classes: renderClassSection(),
        students: renderStudentSection(),
        academics: renderAcademicSection(),
        communications: renderCommunicationSection(),
        settings: renderSettingsSection()
    };

    Object.entries(sections).forEach(([key, html]) => {
        const section = document.querySelector(`[data-secretary-section="${key}"]`);
        if (section) section.innerHTML = html;
    });
}

export function wireSecretaryConsoleListeners({ onLogout, onOpenTeacherView, onSelectThread }) {
    if (listenersWired) return;
    listenersWired = true;

    document.getElementById('secretary-logout-btn')?.addEventListener('click', () => onLogout?.());
    document.getElementById('secretary-open-teacher-app-btn')?.addEventListener('click', () => onOpenTeacherView?.());
    document.getElementById('secretary-class-filter')?.addEventListener('input', (event) => {
        state.setSecretaryView({ classFilter: event.target.value });
        renderSecretaryConsole();
    });
    document.getElementById('secretary-student-filter')?.addEventListener('input', (event) => {
        state.setSecretaryView({ studentFilter: event.target.value });
        renderSecretaryConsole();
    });

    document.getElementById('secretary-screen')?.addEventListener('click', (event) => {
        const navBtn = event.target.closest('.secretary-nav-btn');
        if (navBtn) {
            activateSecretaryTab(navBtn.dataset.secretaryTab || 'overview');
            return;
        }

        const editClassBtn = event.target.closest('[data-secretary-edit-class]');
        if (editClassBtn) {
            modals.openEditClassModal(editClassBtn.dataset.secretaryEditClass);
            return;
        }

        const editStudentBtn = event.target.closest('[data-secretary-edit-student]');
        if (editStudentBtn) {
            modals.openEditStudentModal(editStudentBtn.dataset.secretaryEditStudent);
            return;
        }

        const chronicleBtn = event.target.closest('[data-secretary-chronicle]');
        if (chronicleBtn) {
            modals.openHeroChronicleModal(chronicleBtn.dataset.secretaryChronicle);
            return;
        }

        const threadBtn = event.target.closest('[data-secretary-thread]');
        if (threadBtn) {
            onSelectThread?.(threadBtn.dataset.secretaryThread);
        }
    });
}
