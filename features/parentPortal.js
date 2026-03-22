import * as state from '../state.js';
import * as utils from '../utils.js';
import { postCommunicationMessage } from '../utils/adminRuntime.js';
import { showToast } from '../ui/effects.js';

let listenersWired = false;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatFlexibleDate(value) {
    if (!value) return 'Unknown';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const d = new Date(`${value}T12:00:00`);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (value?.toDate) {
        return value.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? String(value)
        : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getParentSnapshot() {
    return state.get('currentParentSnapshot') || {};
}

function renderOverview() {
    const snapshot = getParentSnapshot();
    const studentName = snapshot.studentName || 'Your hero';
    const className = snapshot.className || 'Quest class';
    const progress = snapshot.progress || {};
    const recentCelebrations = snapshot.recentCelebrations || [];
    const publishedNotes = snapshot.publishedNotes || [];

    return `
        <div class="parent-overview-grid">
            <article class="parent-card parent-card--hero">
                <p class="parent-card__title">${escapeHtml(studentName)}</p>
                <p class="text-sm text-slate-500 mt-1">${escapeHtml(className)}</p>
                <div class="mt-4 flex items-center gap-4">
                    <div class="w-20 h-20 rounded-[1.6rem] bg-gradient-to-br from-blue-500 to-teal-500 text-white flex items-center justify-center text-3xl font-title shadow-lg">
                        ${escapeHtml((studentName || '?').charAt(0).toUpperCase())}
                    </div>
                    <div class="space-y-1">
                        <div class="text-sm text-slate-500">Hero Level</div>
                        <div class="font-title text-3xl text-blue-900">${Number(progress.heroLevel || 0)}</div>
                        <div class="text-xs text-slate-500">${escapeHtml(snapshot.heroClass || 'Growing hero')}</div>
                    </div>
                </div>
                <div class="parent-stat-grid mt-5">
                    <div class="parent-list-item">
                        <div class="text-xs uppercase tracking-wide text-slate-400">Total Stars</div>
                        <div class="font-title text-2xl text-amber-600">${Number(progress.totalStars || 0)}</div>
                    </div>
                    <div class="parent-list-item">
                        <div class="text-xs uppercase tracking-wide text-slate-400">Monthly Stars</div>
                        <div class="font-title text-2xl text-indigo-600">${Number(progress.monthlyStars || 0)}</div>
                    </div>
                    <div class="parent-list-item">
                        <div class="text-xs uppercase tracking-wide text-slate-400">Attendance</div>
                        <div class="font-title text-2xl text-emerald-600">${escapeHtml(snapshot.attendanceSummary?.rateLabel || 'N/A')}</div>
                    </div>
                    <div class="parent-list-item">
                        <div class="text-xs uppercase tracking-wide text-slate-400">Homework</div>
                        <div class="font-title text-2xl text-sky-600">${Number(snapshot.homeworkCount || 0)}</div>
                    </div>
                </div>
            </article>
            <div class="grid gap-4">
                <article class="parent-card">
                    <p class="parent-card__title">Academic Snapshot</p>
                    <div class="parent-stat-grid mt-4">
                        <div class="parent-list-item">
                            <div class="text-xs uppercase tracking-wide text-slate-400">Latest Test</div>
                            <div class="font-semibold text-slate-800">${escapeHtml(snapshot.latestGrade?.label || 'No test yet')}</div>
                        </div>
                        <div class="parent-list-item">
                            <div class="text-xs uppercase tracking-wide text-slate-400">Average</div>
                            <div class="font-semibold text-slate-800">${escapeHtml(snapshot.gradeAverageLabel || 'N/A')}</div>
                        </div>
                        <div class="parent-list-item">
                            <div class="text-xs uppercase tracking-wide text-slate-400">Next Lesson</div>
                            <div class="font-semibold text-slate-800">${escapeHtml(snapshot.nextLessonLabel || 'Not scheduled')}</div>
                        </div>
                    </div>
                </article>
                <article class="parent-card">
                    <p class="parent-card__title">Recent Celebrations</p>
                    <div class="parent-list">
                        ${recentCelebrations.length
                            ? recentCelebrations.slice(0, 4).map((item) => `
                                <div class="parent-list-item">
                                    <div class="font-semibold text-slate-800">${escapeHtml(item.title || item.reason || 'Celebration')}</div>
                                    <div class="text-sm text-slate-500 mt-1">${escapeHtml(item.description || '')}</div>
                                </div>
                            `).join('')
                            : '<div class="parent-empty">New celebrations will appear here.</div>'
                        }
                    </div>
                </article>
                <article class="parent-card">
                    <p class="parent-card__title">Published Notes</p>
                    <div class="parent-list">
                        ${publishedNotes.length
                            ? publishedNotes.slice(0, 4).map((item) => `
                                <div class="parent-list-item">
                                    <div class="text-xs uppercase tracking-wide text-slate-400">${escapeHtml(item.label || 'Teacher note')}</div>
                                    <div class="text-sm text-slate-700 mt-1">${escapeHtml(item.body || item.text || '')}</div>
                                </div>
                            `).join('')
                            : '<div class="parent-empty">No published notes yet.</div>'
                        }
                    </div>
                </article>
            </div>
        </div>
    `;
}

function renderHomework() {
    const items = state.get('currentParentHomework') || [];
    const item = items[0] || null;
    return `
        <article class="parent-card">
            <p class="parent-card__title">Latest Homework</p>
            <div class="parent-list">
                ${item
                    ? `
                        <div class="parent-list-item">
                            <div class="flex items-center justify-between gap-3">
                                <div class="font-semibold text-slate-800">${escapeHtml(item.title || 'Homework')}</div>
                                <div class="text-xs text-slate-400">${escapeHtml(formatFlexibleDate(item.lessonDate))}</div>
                            </div>
                            <div class="text-sm text-slate-600 mt-2 whitespace-pre-wrap">${escapeHtml(item.body || '')}</div>
                        </div>
                    `
                    : '<div class="parent-empty">No homework has been assigned yet.</div>'
                }
            </div>
        </article>
    `;
}

function renderProgress() {
    const snapshot = getParentSnapshot();
    const gradeHistory = snapshot.gradeHistory || [];
    const attendance = snapshot.attendanceSummary || {};
    return `
        <div class="grid gap-4">
            <article class="parent-card">
                <p class="parent-card__title">Grades & Academics</p>
                <div class="parent-list">
                    ${gradeHistory.length
                        ? gradeHistory.slice(0, 8).map((item) => `
                            <div class="parent-list-item">
                                <div class="flex items-center justify-between gap-3">
                                    <div>
                                        <div class="font-semibold text-slate-800">${escapeHtml(item.title || item.type || 'Assessment')}</div>
                                        <div class="text-xs text-slate-400">${escapeHtml(formatFlexibleDate(item.date))}</div>
                                    </div>
                                    <div class="font-title text-xl text-blue-700">${escapeHtml(item.scoreLabel || item.label || 'N/A')}</div>
                                </div>
                            </div>
                        `).join('')
                        : '<div class="parent-empty">Published grades will appear here.</div>'
                    }
                </div>
            </article>
            <article class="parent-card">
                <p class="parent-card__title">Attendance Summary</p>
                <div class="parent-stat-grid mt-4">
                    <div class="parent-list-item">
                        <div class="text-xs uppercase tracking-wide text-slate-400">Rate</div>
                        <div class="font-title text-2xl text-emerald-600">${escapeHtml(attendance.rateLabel || 'N/A')}</div>
                    </div>
                    <div class="parent-list-item">
                        <div class="text-xs uppercase tracking-wide text-slate-400">Lessons Held</div>
                        <div class="font-title text-2xl text-sky-600">${Number(attendance.lessonsHeld || 0)}</div>
                    </div>
                    <div class="parent-list-item">
                        <div class="text-xs uppercase tracking-wide text-slate-400">Absences</div>
                        <div class="font-title text-2xl text-rose-600">${Number(attendance.absences || 0)}</div>
                    </div>
                </div>
            </article>
        </div>
    `;
}

function renderMessages() {
    const threads = state.get('currentCommunicationThreads') || [];
    const selectedThreadId = state.get('currentCommunicationThreadId');
    const activeThread = threads.find((thread) => thread.id === selectedThreadId) || threads[0] || null;
    const messages = state.get('currentCommunicationMessages') || [];
    return `
        <div class="parent-message-layout">
            <article class="parent-card">
                <p class="parent-card__title">Inbox</p>
                <div class="parent-list">
                    ${threads.length
                        ? threads.map((thread) => `
                            <button type="button" class="parent-thread-btn ${thread.id === activeThread?.id ? 'parent-thread-btn-active' : ''}" data-parent-thread-id="${thread.id}">
                                <div class="parent-list-item">
                                    <div class="font-semibold text-slate-800">${escapeHtml(thread.threadType || 'Message')}</div>
                                    <div class="text-xs text-slate-400 mt-1">${escapeHtml(formatFlexibleDate(thread.lastMessageAt))}</div>
                                    <div class="text-sm text-slate-500 mt-2">${escapeHtml(thread.previewText || thread.status || '')}</div>
                                </div>
                            </button>
                        `).join('')
                        : '<div class="parent-empty">No messages yet.</div>'
                    }
                </div>
            </article>
            <article class="parent-card">
                <p class="parent-card__title">${escapeHtml(activeThread?.threadType || 'Conversation')}</p>
                <div class="parent-list">
                    ${messages.length
                        ? messages.map((message) => `
                            <div class="parent-list-item">
                                <div class="flex items-center justify-between gap-3">
                                    <div class="font-semibold text-slate-800">${escapeHtml(message.authorRole || 'School')}</div>
                                    <div class="text-xs text-slate-400">${escapeHtml(formatFlexibleDate(message.createdAt))}</div>
                                </div>
                                <div class="text-sm text-slate-600 mt-2 whitespace-pre-wrap">${escapeHtml(message.body || '')}</div>
                            </div>
                        `).join('')
                        : '<div class="parent-empty">Select a conversation to see replies.</div>'
                    }
                </div>
                <form id="parent-message-form" class="parent-composer mt-4 ${activeThread ? '' : 'hidden'}">
                    <textarea id="parent-message-text" placeholder="Reply to the school..."></textarea>
                    <div class="flex justify-end mt-3">
                        <button type="submit">Send Reply</button>
                    </div>
                </form>
            </article>
        </div>
    `;
}

export function renderParentPortal() {
    const snapshot = getParentSnapshot();
    const nameEl = document.querySelector('[data-parent-student-name]');
    if (nameEl) {
        nameEl.textContent = snapshot.studentName
            ? `${snapshot.studentName} • ${snapshot.className || 'Hero overview'}`
            : 'Waiting for published school data...';
    }

    const sections = {
        overview: renderOverview(),
        homework: renderHomework(),
        progress: renderProgress(),
        messages: renderMessages()
    };

    Object.entries(sections).forEach(([key, html]) => {
        const section = document.querySelector(`[data-parent-section="${key}"]`);
        if (section) section.innerHTML = html;
    });
}

export function activateParentTab(tabKey) {
    document.querySelectorAll('.parent-nav-btn').forEach((btn) => {
        btn.classList.toggle('parent-nav-btn-active', btn.dataset.parentTab === tabKey);
    });
    document.querySelectorAll('[data-parent-section]').forEach((section) => {
        section.classList.toggle('hidden', section.dataset.parentSection !== tabKey);
    });
}

export function wireParentPortalListeners({ onLogout, onRefresh, onSelectThread }) {
    if (listenersWired) return;
    listenersWired = true;

    document.getElementById('parent-logout-btn')?.addEventListener('click', () => onLogout?.());
    document.getElementById('parent-refresh-btn')?.addEventListener('click', () => onRefresh?.());

    document.getElementById('parent-screen')?.addEventListener('click', (event) => {
        const navBtn = event.target.closest('.parent-nav-btn');
        if (navBtn) {
            activateParentTab(navBtn.dataset.parentTab || 'overview');
            return;
        }

        const threadBtn = event.target.closest('[data-parent-thread-id]');
        if (threadBtn) {
            onSelectThread?.(threadBtn.dataset.parentThreadId);
        }
    });

    document.getElementById('parent-screen')?.addEventListener('submit', async (event) => {
        if (event.target.id !== 'parent-message-form') return;
        event.preventDefault();
        const threadId = state.get('currentCommunicationThreadId');
        const body = document.getElementById('parent-message-text')?.value?.trim();
        const profile = state.get('currentUserProfile');
        const linkedStudentId = profile?.linkedStudentId;
        if (!threadId || !body || !linkedStudentId) {
            showToast('Write a message first.', 'info');
            return;
        }
        try {
            await postCommunicationMessage({
                threadId,
                studentId: linkedStudentId,
                body,
                messageType: 'meeting-request'
            });
            document.getElementById('parent-message-text').value = '';
            showToast('Message sent.', 'success');
        } catch (error) {
            console.error('Could not send parent message:', error);
            showToast(error?.message || 'Could not send the message right now.', 'error');
        }
    });
}
