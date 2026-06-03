import * as state from '../../state.js';
import { escapeHtml, formatFlexibleDate, renderTabHero, renderEmptyState } from '../roles/shared.js';
import {
    getActiveThread,
    getThreadTypeMeta,
    getThreadStudentLabel,
    getStudentMap,
    getClassMap
} from './helpers.js';

function renderInbox() {
    const threads = state.get('currentCommunicationThreads') || [];
    const activeThread = getActiveThread();
    const studentMap = getStudentMap();
    const classMap = getClassMap();

    return `
        <article class="role-card">
            <div class="role-card__header">
                <div>
                    <p class="role-card__eyebrow">Inbox</p>
                    <h3 class="role-card__title">Family messages</h3>
                </div>
                <div class="role-card__badge">${threads.length} threads</div>
            </div>
            ${threads.length
                ? threads.map((thread) => {
                    const meta = getThreadTypeMeta(thread.threadType);
                    const labels = getThreadStudentLabel(thread, studentMap, classMap);
                    return `
                        <button type="button" class="role-inbox-item ${thread.id === activeThread?.id ? 'role-inbox-item--active' : ''}" data-secretary-thread="${thread.id}" data-secretary-message-view="thread">
                            <div class="role-inbox-item__icon role-inbox-item__icon--${meta.tone}"><i class="fas ${meta.icon}"></i></div>
                            <div>
                                <div class="role-inbox-item__title">${escapeHtml(meta.label)}</div>
                                <div class="role-inbox-item__meta">${escapeHtml(labels.studentName)} • ${escapeHtml(labels.className)}</div>
                                <div class="role-inbox-item__preview">${escapeHtml(thread.previewText || 'Open to read the full conversation.')}</div>
                            </div>
                        </button>`;
                }).join('')
                : renderEmptyState('Messages from families will appear once teachers share updates.', { large: true })
            }
        </article>
    `;
}

function renderConversation() {
    const activeThread = getActiveThread();
    const messages = state.get('currentCommunicationMessages') || [];
    const studentMap = getStudentMap();
    const classMap = getClassMap();

    if (!activeThread) {
        return renderEmptyState('Choose a conversation from your inbox.', { large: true });
    }

    const labels = getThreadStudentLabel(activeThread, studentMap, classMap);
    const meta = getThreadTypeMeta(activeThread.threadType);

    return `
        <button type="button" class="role-back-btn" data-secretary-message-view="inbox"><i class="fas fa-arrow-left"></i> Back to inbox</button>
        <article class="role-card">
            <div class="role-conversation-header">
                <div class="role-inbox-item__icon role-inbox-item__icon--${meta.tone}"><i class="fas ${meta.icon}"></i></div>
                <div>
                    <h3 class="role-card__title">${escapeHtml(meta.label)}</h3>
                    <p class="text-sm text-slate-500">${escapeHtml(labels.studentName)} • ${escapeHtml(labels.className)}</p>
                </div>
                <div class="role-card__badge ml-auto">${escapeHtml(formatFlexibleDate(activeThread.lastMessageAt, true))}</div>
            </div>

            <div class="role-message-stack custom-scrollbar">
                ${messages.length
                    ? messages.map((message) => {
                        const isSecretary = message.authorRole === 'secretary';
                        const authorLabel = isSecretary
                            ? 'You'
                            : message.authorRole === 'parent'
                                ? 'Parent'
                                : message.authorRole === 'teacher'
                                    ? 'Teacher'
                                    : 'School';
                        return `
                            <div class="role-message-bubble ${isSecretary ? 'role-message-bubble--own' : ''}">
                                <div class="role-message-bubble__meta">
                                    <span>${escapeHtml(authorLabel)}</span>
                                    <span>${escapeHtml(formatFlexibleDate(message.createdAt, true))}</span>
                                </div>
                                <div class="role-message-bubble__body">${escapeHtml(message.body || '')}</div>
                            </div>`;
                    }).join('')
                    : renderEmptyState('No messages in this thread yet.')
                }
            </div>

            <form id="secretary-message-form" class="role-composer">
                <label class="role-field">
                    <span>Message type</span>
                    <select id="secretary-message-type">
                        <option value="admin-announcement">Announcement</option>
                        <option value="meeting-request">Meeting request</option>
                        <option value="attendance-alert">Attendance note</option>
                        <option value="celebration">Celebration</option>
                        <option value="progress-share">Progress update</option>
                        <option value="homework">Homework</option>
                        <option value="school-message">General message</option>
                    </select>
                </label>
                <label class="role-field">
                    <span>Your reply</span>
                    <textarea id="secretary-message-text" placeholder="Type your message here..."></textarea>
                </label>
                <button type="submit" id="secretary-message-send-btn" class="role-btn-primary btn-shimmer w-full sm:w-auto">
                    <i class="fas fa-paper-plane"></i> Send message
                </button>
            </form>
        </article>
    `;
}

export function renderSecretaryMessages() {
    const messageView = state.get('secretaryView')?.messageView || 'inbox';

    return `
        ${messageView === 'thread' ? '' : renderTabHero({
            icon: 'fa-comments',
            iconColor: 'text-purple-500',
            title: 'Messages',
            subtitle: 'Read and reply to messages from parents and teachers.'
        })}
        ${messageView === 'thread' ? renderConversation() : renderInbox()}
    `;
}
