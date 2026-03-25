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

function threadTone(threadType) {
    const t = (threadType || '').toLowerCase();
    if (t.includes('meeting') || t.includes('request')) return 'amber';
    if (t.includes('concern') || t.includes('issue')) return 'rose';
    if (t.includes('praise') || t.includes('celebr')) return 'emerald';
    if (t.includes('general') || t.includes('message')) return 'sky';
    return 'violet';
}

function threadIcon(threadType) {
    const t = (threadType || '').toLowerCase();
    if (t.includes('meeting') || t.includes('request')) return 'fa-calendar-check';
    if (t.includes('concern') || t.includes('issue')) return 'fa-exclamation-circle';
    if (t.includes('praise') || t.includes('celebr')) return 'fa-star';
    return 'fa-comment-dots';
}

function celebrationVariant(i) {
    return ['gold', 'rose', 'teal'][i % 3];
}

function celebrationEmoji(item) {
    const t = (item.reason || item.title || '').toLowerCase();
    if (t.includes('star') || t.includes('award')) return '⭐';
    if (t.includes('attend')) return '📅';
    if (t.includes('test') || t.includes('grade')) return '📝';
    if (t.includes('help') || t.includes('kind')) return '🤝';
    return '🎉';
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
                <div style="display:flex;gap:1rem;align-items:center;margin-bottom:1.25rem;">
                    <div class="parent-hero-avatar">${escapeHtml((studentName || '?').charAt(0).toUpperCase())}</div>
                    <div>
                        <p class="parent-card__title">${escapeHtml(studentName)}</p>
                        <p style="color:#92400e;font-size:0.9rem;margin-top:0.25rem;">${escapeHtml(className)}</p>
                        <p style="color:#a8a29e;font-size:0.8rem;margin-top:0.2rem;">${escapeHtml(snapshot.heroClass || 'Growing adventurer')}</p>
                    </div>
                </div>
                <div class="parent-stat-grid">
                    <div class="parent-stat-badge parent-stat-badge--stars">
                        <span class="parent-stat-badge__emoji">⭐</span>
                        <span class="parent-stat-badge__label">Total Stars</span>
                        <span class="parent-stat-badge__value">${Number(progress.totalStars || 0)}</span>
                    </div>
                    <div class="parent-stat-badge parent-stat-badge--monthly">
                        <span class="parent-stat-badge__emoji">🌟</span>
                        <span class="parent-stat-badge__label">This Month</span>
                        <span class="parent-stat-badge__value">${Number(progress.monthlyStars || 0)}</span>
                    </div>
                    <div class="parent-stat-badge parent-stat-badge--attend">
                        <span class="parent-stat-badge__emoji">📅</span>
                        <span class="parent-stat-badge__label">Attendance</span>
                        <span class="parent-stat-badge__value" style="font-size:1.3rem;">${escapeHtml(snapshot.attendanceSummary?.rateLabel || 'N/A')}</span>
                    </div>
                    <div class="parent-stat-badge parent-stat-badge--hw">
                        <span class="parent-stat-badge__emoji">📚</span>
                        <span class="parent-stat-badge__label">Homework</span>
                        <span class="parent-stat-badge__value">${Number(snapshot.homeworkCount || 0)}</span>
                    </div>
                </div>
            </article>
            <div class="grid gap-4">
                <article class="parent-card">
                    <p class="parent-card__title" style="margin-bottom:0.85rem;">✏️ Academic Snapshot</p>
                    <div class="parent-stat-grid">
                        <div class="parent-stat-badge parent-stat-badge--stars" style="grid-column:span 1">
                            <span class="parent-stat-badge__emoji">📝</span>
                            <span class="parent-stat-badge__label">Latest Test</span>
                            <span class="parent-stat-badge__value" style="font-size:1.15rem;">${escapeHtml(snapshot.latestGrade?.label || '—')}</span>
                        </div>
                        <div class="parent-stat-badge parent-stat-badge--monthly" style="grid-column:span 1">
                            <span class="parent-stat-badge__emoji">📊</span>
                            <span class="parent-stat-badge__label">Average</span>
                            <span class="parent-stat-badge__value" style="font-size:1.15rem;">${escapeHtml(snapshot.gradeAverageLabel || 'N/A')}</span>
                        </div>
                        <div class="parent-stat-badge parent-stat-badge--teal" style="grid-column:span 2">
                            <span class="parent-stat-badge__emoji">🗓️</span>
                            <span class="parent-stat-badge__label">Next Lesson</span>
                            <span class="parent-stat-badge__value" style="font-size:1rem;">${escapeHtml(snapshot.nextLessonLabel || 'Not scheduled')}</span>
                        </div>
                    </div>
                </article>
                <article class="parent-card">
                    <p class="parent-card__title" style="margin-bottom:0.85rem;">🎊 Recent Celebrations</p>
                    <div class="parent-list">
                        ${recentCelebrations.length
                            ? recentCelebrations.slice(0, 4).map((item, i) => `
                                <div class="parent-celebration-chip parent-celebration-chip--${celebrationVariant(i)}">
                                    <span class="parent-celebration-chip__emoji">${celebrationEmoji(item)}</span>
                                    <div>
                                        <div style="font-weight:800;color:#1e293b;font-size:0.95rem;">${escapeHtml(item.title || item.reason || 'Celebration')}</div>
                                        ${item.description ? `<div style="color:#78716c;font-size:0.84rem;margin-top:0.2rem;">${escapeHtml(item.description)}</div>` : ''}
                                    </div>
                                </div>
                            `).join('')
                            : '<div class="parent-empty">New celebrations will appear here ✨</div>'
                        }
                    </div>
                </article>
                <article class="parent-card">
                    <p class="parent-card__title" style="margin-bottom:0.85rem;">📖 Teacher's Notes</p>
                    <div class="parent-list">
                        ${publishedNotes.length
                            ? publishedNotes.slice(0, 4).map((item) => `
                                <div class="parent-list-item">
                                    <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.14em;color:#92400e;font-weight:800;">${escapeHtml(item.label || 'Teacher note')}</div>
                                    <div style="color:#44403c;font-size:0.9rem;margin-top:0.3rem;line-height:1.55;">${escapeHtml(item.body || item.text || '')}</div>
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
            <p class="parent-card__title" style="margin-bottom:0.85rem;">📜 Today's Quest Scroll</p>
            <div class="parent-list">
                ${item
                    ? `
                        <div class="parent-list-item" style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border-color:rgba(252,211,77,0.4);">
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;">
                                <div style="font-family:'Fredoka One',cursive;color:#7c2d12;font-size:1.1rem;">${escapeHtml(item.title || 'Homework')}</div>
                                <div style="font-size:0.78rem;color:#92400e;font-weight:700;background:rgba(253,230,138,0.6);padding:0.3rem 0.7rem;border-radius:999px;white-space:nowrap;">${escapeHtml(formatFlexibleDate(item.lessonDate))}</div>
                            </div>
                            <div style="color:#44403c;font-size:0.93rem;margin-top:0.75rem;white-space:pre-wrap;line-height:1.6;">${escapeHtml(item.body || '')}</div>
                        </div>
                    `
                    : '<div class="parent-empty">No homework assigned yet — enjoy the adventure! 🌟</div>'
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
                <p class="parent-card__title" style="margin-bottom:0.85rem;">⭐ Academic Journey</p>
                <div class="parent-list">
                    ${gradeHistory.length
                        ? gradeHistory.slice(0, 8).map((item) => `
                            <div class="parent-list-item" style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;">
                                <div>
                                    <div style="font-weight:800;color:#1e293b;">${escapeHtml(item.title || item.type || 'Assessment')}</div>
                                    <div style="font-size:0.78rem;color:#92400e;margin-top:0.15rem;">${escapeHtml(formatFlexibleDate(item.date))}</div>
                                </div>
                                <div style="font-family:'Fredoka One',cursive;font-size:1.35rem;color:#1d4ed8;background:linear-gradient(135deg,#dbeafe,#e0e7ff);padding:0.3rem 0.9rem;border-radius:999px;white-space:nowrap;">${escapeHtml(item.scoreLabel || item.label || 'N/A')}</div>
                            </div>
                        `).join('')
                        : '<div class="parent-empty">Published grades will appear here 📊</div>'
                    }
                </div>
            </article>
            <article class="parent-card">
                <p class="parent-card__title" style="margin-bottom:0.85rem;">📅 Adventure Log</p>
                <div class="parent-stat-grid">
                    <div class="parent-stat-badge parent-stat-badge--attend">
                        <span class="parent-stat-badge__emoji">✅</span>
                        <span class="parent-stat-badge__label">Rate</span>
                        <span class="parent-stat-badge__value" style="font-size:1.25rem;">${escapeHtml(attendance.rateLabel || 'N/A')}</span>
                    </div>
                    <div class="parent-stat-badge parent-stat-badge--hw">
                        <span class="parent-stat-badge__emoji">🏫</span>
                        <span class="parent-stat-badge__label">Lessons</span>
                        <span class="parent-stat-badge__value">${Number(attendance.lessonsHeld || 0)}</span>
                    </div>
                    <div class="parent-stat-badge parent-stat-badge--rose" style="border-color:rgba(252,165,165,0.6);background:linear-gradient(160deg,#fff1f2,#ffffff);">
                        <span class="parent-stat-badge__emoji">😶</span>
                        <span class="parent-stat-badge__label">Absences</span>
                        <span class="parent-stat-badge__value">${Number(attendance.absences || 0)}</span>
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
    const profile = state.get('currentUserProfile');

    return `
        <div class="parent-message-layout">
            <article class="parent-card">
                <p class="parent-card__title" style="margin-bottom:0.85rem;">💌 Your Inbox</p>
                <div class="parent-list">
                    ${threads.length
                        ? threads.map((thread) => {
                            const tone = threadTone(thread.threadType);
                            const icon = threadIcon(thread.threadType);
                            return `
                            <button type="button" class="parent-thread-btn ${thread.id === activeThread?.id ? 'parent-thread-btn-active' : ''}" data-parent-thread-id="${thread.id}">
                                <div class="parent-list-item" style="display:grid;grid-template-columns:auto 1fr;gap:0.85rem;align-items:start;">
                                    <span class="parent-thread-icon tone-${tone}"><i class="fas ${icon}" style="font-size:0.9rem;"></i></span>
                                    <div>
                                        <div style="font-family:'Fredoka One',cursive;color:#1e293b;font-size:1rem;">${escapeHtml(thread.threadType || 'Message')}</div>
                                        <div style="font-size:0.76rem;color:#92400e;margin-top:0.15rem;">${escapeHtml(formatFlexibleDate(thread.lastMessageAt))}</div>
                                        ${thread.previewText ? `<div style="font-size:0.82rem;color:#78716c;margin-top:0.3rem;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(thread.previewText)}</div>` : ''}
                                    </div>
                                </div>
                            </button>`;
                        }).join('')
                        : '<div class="parent-empty">No messages yet 📭</div>'
                    }
                </div>
            </article>
            <article class="parent-card">
                <p class="parent-card__title" style="margin-bottom:0.85rem;">💬 ${escapeHtml(activeThread?.threadType || 'Conversation')}</p>
                <div class="parent-message-stack">
                    ${messages.length
                        ? messages.map((message) => {
                            const isOwn = message.authorRole === 'parent' || message.authorRole === 'Parent';
                            const authorLabel = isOwn ? 'You' : (message.authorRole === 'teacher' || message.authorRole === 'Teacher' ? 'Teacher' : 'Your School');
                            return `
                            <div class="parent-message-bubble${isOwn ? ' parent-message-bubble--own' : ''}">
                                <div class="parent-message-bubble__meta">
                                    <span>${escapeHtml(authorLabel)}</span>
                                    <span>${escapeHtml(formatFlexibleDate(message.createdAt))}</span>
                                </div>
                                <div class="parent-message-bubble__body">${escapeHtml(message.body || '')}</div>
                            </div>`;
                        }).join('')
                        : '<div class="parent-empty">Select a conversation to read messages 💌</div>'
                    }
                </div>
                <form id="parent-message-form" class="parent-composer ${activeThread ? '' : 'hidden'}">
                    <textarea id="parent-message-text" placeholder="Write a message to the school..."></textarea>
                    <div style="display:flex;justify-content:flex-end;margin-top:0.75rem;">
                        <button type="submit" class="parent-composer-send-btn">📩 Send Message</button>
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
