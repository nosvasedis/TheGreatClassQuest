import * as state from '../../state.js';
import { escapeHtml, formatFlexibleDate, renderTabHero, renderEmptyState } from '../roles/shared.js';
import { threadTone, threadIcon, threadLabel } from './helpers.js';

function getActiveThread() {
    const threads = state.get('currentCommunicationThreads') || [];
    const selectedThreadId = state.get('currentCommunicationThreadId');
    return threads.find((thread) => thread.id === selectedThreadId) || threads[0] || null;
}

const MESSAGE_TYPES = [
    { key: 'general', value: 'school-message', label: 'General' },
    { key: 'meeting', value: 'meeting-request', label: 'Meeting request' },
    { key: 'question', value: 'progress-share', label: 'Question' }
];

function renderInbox() {
    const threads = state.get('currentCommunicationThreads') || [];
    const activeThread = getActiveThread();

    return `
        <article class="role-card">
            <div class="role-card__header">
                <div>
                    <p class="role-card__eyebrow">Inbox</p>
                    <h3 class="role-card__title">Messages from school</h3>
                </div>
                <div class="role-card__badge">${threads.length}</div>
            </div>
            ${threads.length
                ? threads.map((thread) => {
                    const tone = threadTone(thread.threadType);
                    const icon = threadIcon(thread.threadType);
                    return `
                        <button type="button" class="role-inbox-item ${thread.id === activeThread?.id ? 'role-inbox-item--active' : ''}" data-parent-thread-id="${thread.id}" data-parent-message-view="thread">
                            <div class="role-inbox-item__icon role-inbox-item__icon--${tone}"><i class="fas ${icon}"></i></div>
                            <div>
                                <div class="role-inbox-item__title">${escapeHtml(threadLabel(thread.threadType))}</div>
                                <div class="role-inbox-item__meta">${escapeHtml(formatFlexibleDate(thread.lastMessageAt))}</div>
                                ${thread.previewText ? `<div class="role-inbox-item__preview">${escapeHtml(thread.previewText)}</div>` : ''}
                            </div>
                        </button>`;
                }).join('')
                : renderEmptyState('No messages yet. Your school will contact you here.', { large: true })
            }
        </article>
    `;
}

function renderConversation() {
    const activeThread = getActiveThread();
    const messages = state.get('currentCommunicationMessages') || [];
    const messageType = state.get('parentView')?.messageType || 'general';

    if (!activeThread) {
        return renderEmptyState('Choose a conversation from your inbox.', { large: true });
    }

    return `
        <button type="button" class="role-back-btn" data-parent-message-view="inbox"><i class="fas fa-arrow-left"></i> Back to inbox</button>
        <article class="role-card">
            <div class="role-conversation-header">
                <div>
                    <h3 class="role-card__title">${escapeHtml(threadLabel(activeThread.threadType))}</h3>
                    <p class="text-sm text-slate-500">${escapeHtml(formatFlexibleDate(activeThread.lastMessageAt, true))}</p>
                </div>
            </div>

            <div class="role-message-stack custom-scrollbar">
                ${messages.length
                    ? messages.map((message) => {
                        const isOwn = message.authorRole === 'parent' || message.authorRole === 'Parent';
                        const authorLabel = isOwn ? 'You' : (message.authorRole === 'teacher' || message.authorRole === 'Teacher' ? 'Teacher' : 'School');
                        return `
                            <div class="role-message-bubble ${isOwn ? 'role-message-bubble--own' : ''}">
                                <div class="role-message-bubble__meta">
                                    <span>${escapeHtml(authorLabel)}</span>
                                    <span>${escapeHtml(formatFlexibleDate(message.createdAt, true))}</span>
                                </div>
                                <div class="role-message-bubble__body">${escapeHtml(message.body || '')}</div>
                            </div>`;
                    }).join('')
                    : renderEmptyState('No messages in this conversation yet.')
                }
            </div>

            <form id="parent-message-form" class="role-composer">
                <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Message type</p>
                <div class="role-message-type-chips">
                    ${MESSAGE_TYPES.map((type) => `
                        <button type="button" class="role-message-type-chip ${messageType === type.key ? 'role-message-type-chip--active' : ''}" data-parent-message-type="${type.key}">
                            ${type.label}
                        </button>
                    `).join('')}
                </div>
                <label class="role-field">
                    <span>Your message</span>
                    <textarea id="parent-message-text" placeholder="Write a message to the school..."></textarea>
                </label>
                <button type="submit" class="role-btn-primary btn-shimmer w-full sm:w-auto">
                    <i class="fas fa-paper-plane"></i> Send message
                </button>
            </form>
        </article>
    `;
}

export function renderParentMessages() {
    const messageView = state.get('parentView')?.messageView || 'inbox';

    return `
        ${messageView === 'thread' ? '' : renderTabHero({
            icon: 'fa-envelope',
            iconColor: 'text-purple-500',
            title: 'Messages',
            subtitle: 'Read and reply to messages from teachers and the school office.'
        })}
        ${messageView === 'thread' ? renderConversation() : renderInbox()}
    `;
}

export function getParentMessageTypeValue(key) {
    return MESSAGE_TYPES.find((item) => item.key === key)?.value || 'school-message';
}
