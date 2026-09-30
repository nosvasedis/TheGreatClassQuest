// features/parent/messages.js — letters between home and school
import * as state from '../../state.js';
import {
    escapeHtml,
    getSnapshot,
    firstName,
    shortDate,
    relativeDay,
    toDate,
    toMillis,
    threadMeta,
    authorLabel,
    isThreadUnread,
    FAMILY_TOPICS,
    getNextLesson,
    weekdayName
} from './helpers.js';

export function getActiveThread() {
    const threads = state.get('currentCommunicationThreads') || [];
    const selectedThreadId = state.get('currentCommunicationThreadId');
    return threads.find((thread) => thread.id === selectedThreadId) || null;
}

function sortedThreads() {
    return (state.get('currentCommunicationThreads') || [])
        .slice()
        .sort((a, b) => toMillis(b.lastMessageAt) - toMillis(a.lastMessageAt));
}

function renderInbox() {
    const threads = sortedThreads();
    const name = firstName(getSnapshot().studentName);
    return `
        <header class="fp-pagehead fp-rise">
            <span class="fp-pagehead__icon fp-pagehead__icon--rose" aria-hidden="true"><i class="fas fa-envelope"></i></span>
            <div>
                <h2 class="fp-pagehead__title">Messages</h2>
                <p class="fp-pagehead__sub">Notes between home and school about ${escapeHtml(name)}.</p>
            </div>
        </header>
        <button type="button" class="fp-write fp-rise" style="--fp-delay:1" data-parent-message-view="compose">
            <span class="fp-write__icon" aria-hidden="true"><i class="fas fa-pen-nib"></i></span>
            <span class="fp-write__copy">
                <span class="fp-write__title">Write to the school</span>
                <span class="fp-write__sub">Ask a question, ask to meet, or let us know about an absence.</span>
            </span>
            <i class="fas fa-chevron-right fp-write__chev" aria-hidden="true"></i>
        </button>
        ${threads.length ? `
            <ul class="fp-letters fp-rise" style="--fp-delay:2">
                ${threads.map((thread) => {
                    const meta = threadMeta(thread.threadType);
                    const unread = isThreadUnread(thread);
                    return `
                        <li>
                            <button type="button" class="fp-envelope${unread ? ' is-unread' : ''}" data-parent-thread-id="${escapeHtml(thread.id)}">
                                <span class="fp-bubble fp-bubble--${meta.tone}"><i class="fas ${meta.icon}" aria-hidden="true"></i></span>
                                <span class="fp-envelope__copy">
                                    <span class="fp-envelope__title">${escapeHtml(meta.label)}${unread ? '<span class="fp-dot" aria-label="Unread"></span>' : ''}</span>
                                    <span class="fp-envelope__preview">${escapeHtml(thread.previewText || 'Open to read the conversation.')}</span>
                                </span>
                                <span class="fp-envelope__when">${escapeHtml(relativeDay(thread.lastMessageAt))}</span>
                            </button>
                        </li>`;
                }).join('')}
            </ul>` : `
            <div class="fp-empty-card fp-rise" style="--fp-delay:2">
                <i class="fas fa-envelope-open" aria-hidden="true"></i>
                <p>No messages yet. Notes from the teacher and the school office will arrive here.</p>
            </div>`}`;
}

function dayLabel(date) {
    const diff = Math.round((new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === -1) return 'Yesterday';
    return shortDate(date);
}

function renderConversation() {
    const thread = getActiveThread();
    if (!thread) return renderInbox();
    const meta = threadMeta(thread.threadType);
    const messages = state.get('currentCommunicationMessages') || [];
    let lastDay = '';
    const bubbles = messages.map((message) => {
        const own = String(message.authorRole || '').toLowerCase() === 'parent';
        const date = toDate(message.createdAt) || new Date();
        const day = dayLabel(date);
        const divider = day !== lastDay ? `<li class="fp-chat__day"><span>${escapeHtml(day)}</span></li>` : '';
        lastDay = day;
        const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        return `${divider}
            <li class="fp-chat__msg${own ? ' is-own' : ''}">
                ${own ? '' : `<span class="fp-chat__who">${escapeHtml(authorLabel(message.authorRole))}</span>`}
                <div class="fp-chat__bubble">${escapeHtml(message.body || '')}</div>
                <span class="fp-chat__time">${escapeHtml(time)}</span>
            </li>`;
    }).join('');
    return `
        <div class="fp-thread">
            <header class="fp-thread__head">
                <button type="button" class="fp-icon-btn fp-icon-btn--ink" data-parent-message-view="inbox" aria-label="Back to messages"><i class="fas fa-arrow-left" aria-hidden="true"></i></button>
                <span class="fp-bubble fp-bubble--${meta.tone}"><i class="fas ${meta.icon}" aria-hidden="true"></i></span>
                <div>
                    <h2 class="fp-thread__title">${escapeHtml(meta.label)}</h2>
                    <p class="fp-thread__sub">With ${escapeHtml(getSnapshot().teacherName || 'the teacher')} and the school office</p>
                </div>
            </header>
            <ol class="fp-chat" id="fp-chat-log">
                ${bubbles || '<li class="fp-empty-line">No messages in this conversation yet.</li>'}
            </ol>
            <form id="parent-message-form" class="fp-reply" autocomplete="off">
                <label class="sr-only" for="parent-message-text">Your reply</label>
                <textarea id="parent-message-text" rows="1" placeholder="Write a reply…" maxlength="2000"></textarea>
                <button type="submit" class="fp-send" aria-label="Send reply"><i class="fas fa-paper-plane" aria-hidden="true"></i></button>
            </form>
        </div>`;
}

export function absenceStarter() {
    const snapshot = getSnapshot();
    const lesson = getNextLesson(snapshot);
    const name = firstName(snapshot.studentName);
    if (!lesson) return `${name} will miss the lesson on `;
    return `${name} will miss the lesson on ${weekdayName(lesson.date)} ${shortDate(lesson.date, { weekday: false })} because `;
}

function renderCompose() {
    const view = state.get('parentView') || {};
    const topicKey = view.composeTopic || 'question';
    const topic = FAMILY_TOPICS.find((item) => item.key === topicKey) || FAMILY_TOPICS[0];
    const snapshot = getSnapshot();
    return `
        <div class="fp-compose">
            <header class="fp-thread__head">
                <button type="button" class="fp-icon-btn fp-icon-btn--ink" data-parent-message-view="inbox" aria-label="Back to messages"><i class="fas fa-arrow-left" aria-hidden="true"></i></button>
                <div>
                    <h2 class="fp-thread__title">Write to the school</h2>
                    <p class="fp-thread__sub">${escapeHtml(snapshot.teacherName || 'The teacher')} and the school office will read it.</p>
                </div>
            </header>
            <form id="parent-compose-form" class="fp-card fp-compose__card" autocomplete="off">
                <fieldset class="fp-topics">
                    <legend class="fp-kicker">What is it about?</legend>
                    ${FAMILY_TOPICS.map((item) => `
                        <button type="button" class="fp-topic fp-topic--${item.tone}${item.key === topic.key ? ' is-active' : ''}" data-parent-topic="${item.key}" aria-pressed="${item.key === topic.key}">
                            <i class="fas ${item.icon}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span>
                        </button>`).join('')}
                </fieldset>
                <label class="fp-field">
                    <span class="fp-kicker">Your message</span>
                    <textarea id="parent-compose-text" rows="6" maxlength="2000" placeholder="${escapeHtml(topic.placeholder)}"></textarea>
                </label>
                <div class="fp-compose__actions">
                    <p class="fp-compose__hint"><i class="fas fa-lock" aria-hidden="true"></i> Only the school can read this.</p>
                    <button type="submit" class="fp-btn fp-btn--primary"><i class="fas fa-paper-plane" aria-hidden="true"></i> Send</button>
                </div>
            </form>
        </div>`;
}

export function renderParentMessages() {
    const messageView = state.get('parentView')?.messageView || 'inbox';
    if (messageView === 'compose') return renderCompose();
    if (messageView === 'thread') return renderConversation();
    return renderInbox();
}
