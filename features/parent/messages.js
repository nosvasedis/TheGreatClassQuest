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
    familyTopics,
    getNextLesson,
    weekdayName,
    onWeekday,
    tr,
    isGreek
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
                <h2 class="fp-pagehead__title">${tr('Messages', 'Μηνύματα')}</h2>
                <p class="fp-pagehead__sub">${isGreek() ? 'Μηνύματα ανάμεσα στο σπίτι και το σχολείο.' : `Notes between home and school about ${escapeHtml(name)}.`}</p>
            </div>
        </header>
        <button type="button" class="fp-write fp-rise" style="--fp-delay:1" data-parent-message-view="compose">
            <span class="fp-write__icon" aria-hidden="true"><i class="fas fa-pen-nib"></i></span>
            <span class="fp-write__copy">
                <span class="fp-write__title">${tr('Write to the school', 'Γράψτε στο σχολείο')}</span>
                <span class="fp-write__sub">${tr('Ask a question, ask to meet, or let us know about an absence.', 'Κάντε μια ερώτηση, ζητήστε συνάντηση ή ενημερώστε μας για μια απουσία.')}</span>
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
                                    <span class="fp-envelope__title">${escapeHtml(meta.label)}${unread ? `<span class="fp-dot" aria-label="${tr('Unread', 'Αδιάβαστο')}"></span>` : ''}</span>
                                    <span class="fp-envelope__preview">${escapeHtml(thread.previewText || tr('Open to read the conversation.', 'Ανοίξτε για να διαβάσετε τη συζήτηση.'))}</span>
                                </span>
                                <span class="fp-envelope__when">${escapeHtml(relativeDay(thread.lastMessageAt))}</span>
                            </button>
                        </li>`;
                }).join('')}
            </ul>` : `
            <div class="fp-empty-card fp-rise" style="--fp-delay:2">
                <i class="fas fa-envelope-open" aria-hidden="true"></i>
                <p>${tr('No messages yet. Notes from the teacher and the school office will arrive here.', 'Δεν υπάρχουν μηνύματα ακόμη. Τα μηνύματα της τάξης και της γραμματείας θα έρχονται εδώ.')}</p>
            </div>`}`;
}

function dayLabel(date) {
    const diff = Math.round((new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
    if (diff === 0) return tr('Today', 'Σήμερα');
    if (diff === -1) return tr('Yesterday', 'Χθες');
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
                <button type="button" class="fp-icon-btn fp-icon-btn--ink" data-parent-message-view="inbox" aria-label="${tr('Back to messages', 'Πίσω στα μηνύματα')}"><i class="fas fa-arrow-left" aria-hidden="true"></i></button>
                <span class="fp-bubble fp-bubble--${meta.tone}"><i class="fas ${meta.icon}" aria-hidden="true"></i></span>
                <div>
                    <h2 class="fp-thread__title">${escapeHtml(meta.label)}</h2>
                    <p class="fp-thread__sub">${isGreek()
                        ? `Με ${escapeHtml(getSnapshot().teacherName || 'την τάξη')} και τη γραμματεία`
                        : `With ${escapeHtml(getSnapshot().teacherName || 'the teacher')} and the school office`}</p>
                </div>
            </header>
            <ol class="fp-chat" id="fp-chat-log">
                ${bubbles || `<li class="fp-empty-line">${tr('No messages in this conversation yet.', 'Δεν υπάρχουν ακόμη μηνύματα σε αυτή τη συζήτηση.')}</li>`}
            </ol>
            <form id="parent-message-form" class="fp-reply" autocomplete="off">
                <label class="sr-only" for="parent-message-text">${tr('Your reply', 'Η απάντησή σας')}</label>
                <textarea id="parent-message-text" rows="1" placeholder="${tr('Write a reply…', 'Γράψτε μια απάντηση…')}" maxlength="2000"></textarea>
                <button type="submit" class="fp-send" aria-label="${tr('Send reply', 'Αποστολή απάντησης')}"><i class="fas fa-paper-plane" aria-hidden="true"></i></button>
            </form>
        </div>`;
}

export function absenceStarter() {
    const snapshot = getSnapshot();
    const lesson = getNextLesson(snapshot);
    const name = firstName(snapshot.studentName);
    if (isGreek()) {
        if (!lesson) return `${name} θα απουσιάσει από το μάθημα `;
        return `${name} θα απουσιάσει από το μάθημα ${onWeekday(lesson.date)} ${shortDate(lesson.date, { weekday: false })}, επειδή `;
    }
    if (!lesson) return `${name} will miss the lesson on `;
    return `${name} will miss the lesson on ${weekdayName(lesson.date)} ${shortDate(lesson.date, { weekday: false })} because `;
}

function renderCompose() {
    const view = state.get('parentView') || {};
    const topicKey = view.composeTopic || 'question';
    const topics = familyTopics();
    const topic = topics.find((item) => item.key === topicKey) || topics[0];
    const snapshot = getSnapshot();
    return `
        <div class="fp-compose">
            <header class="fp-thread__head">
                <button type="button" class="fp-icon-btn fp-icon-btn--ink" data-parent-message-view="inbox" aria-label="${tr('Back to messages', 'Πίσω στα μηνύματα')}"><i class="fas fa-arrow-left" aria-hidden="true"></i></button>
                <div>
                    <h2 class="fp-thread__title">${tr('Write to the school', 'Γράψτε στο σχολείο')}</h2>
                    <p class="fp-thread__sub">${isGreek()
                        ? `Θα το διαβάσουν ${snapshot.teacherName ? `${escapeHtml(snapshot.teacherName)} και ` : 'η τάξη και '}η γραμματεία.`
                        : `${escapeHtml(snapshot.teacherName || 'The teacher')} and the school office will read it.`}</p>
                </div>
            </header>
            <form id="parent-compose-form" class="fp-card fp-compose__card" autocomplete="off">
                <fieldset class="fp-topics">
                    <legend class="fp-kicker">${tr('What is it about?', 'Τι αφορά;')}</legend>
                    ${topics.map((item) => `
                        <button type="button" class="fp-topic fp-topic--${item.tone}${item.key === topic.key ? ' is-active' : ''}" data-parent-topic="${item.key}" aria-pressed="${item.key === topic.key}">
                            <i class="fas ${item.icon}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span>
                        </button>`).join('')}
                </fieldset>
                <label class="fp-field">
                    <span class="fp-kicker">${tr('Your message', 'Το μήνυμά σας')}</span>
                    <textarea id="parent-compose-text" rows="6" maxlength="2000" placeholder="${escapeHtml(topic.placeholder)}"></textarea>
                </label>
                <div class="fp-compose__actions">
                    <p class="fp-compose__hint"><i class="fas fa-lock" aria-hidden="true"></i> ${tr('Only the school can read this.', 'Μόνο το σχολείο μπορεί να το διαβάσει.')}</p>
                    <button type="submit" class="fp-btn fp-btn--primary"><i class="fas fa-paper-plane" aria-hidden="true"></i> ${tr('Send', 'Αποστολή')}</button>
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
