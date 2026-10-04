import * as state from '../state.js';
import { postCommunicationMessage, sendFamilyMessage } from '../utils/adminRuntime.js';
import { showToast } from '../ui/effects.js';
import { activateParentTab as activateRoleParentTab, getStoredRoleTab } from '../ui/roles/navigation.js';
import { renderParentHome, updateParentHeader } from './parent/home.js';
import { renderParentHomework, downloadTestCalendarEvent } from './parent/homework.js';
import { renderParentProgress } from './parent/progress.js';
import { renderParentMessages, getActiveThread, absenceStarter } from './parent/messages.js';
import { getLang, setLang, tr } from './parent/i18n.js';
import '../styles/family_portal_lang.css';
import {
    familyTopics,
    markThreadSeen,
    markHomeworkSeen,
    unreadThreadCount,
    newestHomework,
    isHomeworkNew
} from './parent/helpers.js';

let listenersWired = false;

const TAB_RENDERERS = {
    home: renderParentHome,
    homework: renderParentHomework,
    progress: renderParentProgress,
    messages: renderParentMessages
};

const LEGACY_TAB_MAP = {
    overview: 'home'
};

function resolveTabKey(tabKey) {
    const key = LEGACY_TAB_MAP[tabKey] || tabKey || 'home';
    return TAB_RENDERERS[key] ? key : 'home';
}

function getActiveTabKey() {
    const panel = document.querySelector('[data-parent-section]:not(.hidden)');
    return panel?.dataset.parentSection || state.get('parentView')?.activeTab || 'home';
}

function updateBadges() {
    const setBadge = (key, text, { dot = false, label = '' } = {}) => {
        const badge = document.querySelector(`[data-parent-badge="${key}"]`);
        if (!badge) return;
        const show = Boolean(text || dot);
        badge.textContent = dot ? '' : (text || '');
        badge.classList.toggle('hidden', !show);
        badge.classList.toggle('fp-nav__badge--dot', dot);
        if (label && show) badge.setAttribute('aria-label', label);
        else badge.removeAttribute('aria-label');
    };
    const unread = unreadThreadCount();
    setBadge('messages', unread ? String(unread) : '', { label: tr(`${unread} unread`, `${unread} αδιάβαστα`) });
    setBadge('homework', '', { dot: isHomeworkNew(newestHomework()), label: tr('New homework', 'Νέα εργασία') });
}

// Opening a tab counts as reading what is new there.
function markTabSeen(tabKey) {
    if (tabKey === 'homework') markHomeworkSeen();
    if (tabKey === 'messages' && state.get('parentView')?.messageView === 'thread') {
        markThreadSeen(getActiveThread());
    }
}

export function activateParentTab(tabKey, options) {
    const resolved = resolveTabKey(tabKey);
    state.setParentView({ activeTab: resolved });
    activateRoleParentTab(resolved, options);
    renderParentTab(resolved);
    // The panel may still be fading in, so the tab counts as read as soon as it is chosen.
    markTabSeen(resolved);
    updateBadges();
    document.querySelector('#parent-screen .fp-main')?.scrollTo({ top: 0 });
}

export function renderParentTab(tabKey) {
    const resolved = resolveTabKey(tabKey);
    const renderer = TAB_RENDERERS[resolved];
    const section = document.querySelector(`[data-parent-section="${resolved}"]`);
    if (!renderer || !section) return;

    // Live updates re-render the tab; keep whatever the family was typing.
    const drafts = ['parent-message-text', 'parent-compose-text'].map((id) => {
        const el = document.getElementById(id);
        return el ? { id, value: el.value, focused: document.activeElement === el } : null;
    }).filter(Boolean);

    section.innerHTML = renderer();

    drafts.forEach(({ id, value, focused }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = value;
        if (focused) el.focus();
        autoGrow(el);
    });

    if (resolved === 'messages') {
        const log = document.getElementById('fp-chat-log');
        if (log) log.lastElementChild?.scrollIntoView({ block: 'end' });
    }
    if (!section.classList.contains('hidden')) markTabSeen(resolved);
    updateBadges();
}

const SHELL_WORDS = {
    portal: ['Family Portal', 'Πύλη γονέων'],
    home: ['Home', 'Αρχική'],
    homework: ['Homework', 'Εργασίες'],
    progress: ['Progress', 'Πρόοδος'],
    messages: ['Messages', 'Μηνύματα']
};

/** The header and tab bar are static HTML, so their words follow the chosen language here. */
function applyShellLanguage() {
    const screen = document.getElementById('parent-screen');
    if (!screen) return;
    const lang = getLang();
    screen.lang = lang;
    screen.dataset.lang = lang;
    screen.querySelectorAll('[data-parent-i18n]').forEach((el) => {
        const words = SHELL_WORDS[el.dataset.parentI18n];
        if (words) el.textContent = tr(...words);
    });
    const label = (el, en, el_) => {
        if (!el) return;
        el.title = tr(en, el_);
        el.setAttribute('aria-label', tr(en, el_));
    };
    label(document.getElementById('parent-refresh-btn'), 'Check for news', 'Έλεγχος για νέα');
    label(document.getElementById('parent-logout-btn'), 'Log out', 'Αποσύνδεση');
    document.getElementById('parent-bottom-nav')?.setAttribute('aria-label', tr(...SHELL_WORDS.portal));
    document.querySelectorAll('[data-lang-opt]').forEach((opt) => opt.classList.toggle('is-on', opt.dataset.langOpt === lang));
    const langBtn = document.getElementById('parent-lang-btn');
    langBtn?.setAttribute('aria-label', lang === 'el' ? 'Switch to English' : 'Αλλαγή σε Ελληνικά');
    langBtn?.setAttribute('title', lang === 'el' ? 'English' : 'Ελληνικά');
}

function switchLanguage() {
    setLang(getLang() === 'el' ? 'en' : 'el');
    applyShellLanguage();
    renderParentPortal();
    // Mid tab-change the old panel can still be the visible one; redraw the chosen tab too.
    const chosen = state.get('parentView')?.activeTab;
    if (chosen && chosen !== getActiveTabKey()) renderParentTab(chosen);
    const main = document.querySelector('#parent-screen .fp-main');
    main?.classList.remove('fp-lang-flip');
    void main?.offsetWidth;
    main?.classList.add('fp-lang-flip');
}

// Live updates (snapshot, homework, letters) redraw the header, badges and the tab on screen;
// hidden tabs are drawn fresh when opened.
export function renderParentPortal() {
    applyShellLanguage();
    updateParentHeader(state.get('currentParentSnapshot') || {});
    renderParentTab(getActiveTabKey());
}

function autoGrow(textarea) {
    if (!textarea || textarea.id !== 'parent-message-text') return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
}

function openMessagesView(view, extra = {}) {
    state.setParentView({ messageView: view, ...extra });
    if (getActiveTabKey() !== 'messages') {
        activateParentTab('messages');
    } else {
        renderParentTab('messages');
        document.querySelector('#parent-screen .fp-main')?.scrollTo({ top: 0 });
    }
}

function setBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.classList.toggle('is-busy', busy);
}

export function wireParentPortalListeners({ onLogout, onRefresh, onSelectThread }) {
    if (listenersWired) return;
    listenersWired = true;

    document.getElementById('parent-logout-btn')?.addEventListener('click', () => onLogout?.());
    document.getElementById('parent-lang-btn')?.addEventListener('click', switchLanguage);
    document.getElementById('parent-refresh-btn')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        if (button.classList.contains('is-busy')) return;
        setBusy(button, true);
        try {
            await onRefresh?.();
            showToast(tr('Up to date.', 'Όλα ενημερωμένα.'), 'success');
        } catch (error) {
            console.error('Family refresh failed:', error);
            showToast(tr('Could not check for news right now.', 'Δεν ήταν δυνατός ο έλεγχος για νέα αυτή τη στιγμή.'), 'error');
        } finally {
            setBusy(button, false);
        }
    });

    const screen = document.getElementById('parent-screen');
    screen?.addEventListener('input', (event) => autoGrow(event.target));

    screen?.addEventListener('click', (event) => {
        const navBtn = event.target.closest('.fp-nav__btn[data-parent-tab]');
        if (navBtn) {
            const key = navBtn.dataset.parentTab || 'home';
            // Tapping Messages again returns to the list of letters.
            if (key === 'messages' || getActiveTabKey() !== key) state.setParentView({ messageView: 'inbox' });
            activateParentTab(key);
            return;
        }

        const tabLink = event.target.closest('[data-parent-tab-link]');
        if (tabLink) {
            activateParentTab(tabLink.dataset.parentTabLink);
            return;
        }

        const scrollLink = event.target.closest('[data-parent-scroll]');
        if (scrollLink) {
            document.getElementById(scrollLink.dataset.parentScroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        const replyBtn = event.target.closest('[data-parent-reply]');
        if (replyBtn) {
            const threadType = replyBtn.dataset.parentReply;
            const thread = (state.get('currentCommunicationThreads') || []).find((item) => item.threadType === threadType);
            if (thread) {
                onSelectThread?.(thread.id);
                openMessagesView('thread');
            } else {
                openMessagesView('compose', { composeTopic: 'message' });
            }
            return;
        }

        const composeLink = event.target.closest('[data-parent-compose]');
        if (composeLink) {
            openMessagesView('compose', { composeTopic: composeLink.dataset.parentCompose });
            prefillCompose(composeLink.dataset.parentCompose);
            return;
        }

        const icsBtn = event.target.closest('[data-parent-ics]');
        if (icsBtn) {
            if (!downloadTestCalendarEvent(icsBtn.dataset.parentIcs)) showToast(tr('This test has no date yet.', 'Αυτό το διαγώνισμα δεν έχει ακόμη ημερομηνία.'), 'info');
            return;
        }

        const toggleResults = event.target.closest('[data-parent-toggle-results]');
        if (toggleResults) {
            state.setParentView({ showAllResults: !state.get('parentView')?.showAllResults });
            renderParentTab('progress');
            return;
        }

        const messageViewBtn = event.target.closest('[data-parent-message-view]');
        if (messageViewBtn) {
            openMessagesView(messageViewBtn.dataset.parentMessageView);
            return;
        }

        const topicBtn = event.target.closest('[data-parent-topic]');
        if (topicBtn) {
            const key = topicBtn.dataset.parentTopic;
            const topic = familyTopics().find((item) => item.key === key);
            if (!topic) return;
            state.setParentView({ composeTopic: key });
            document.querySelectorAll('[data-parent-topic]').forEach((btn) => {
                const active = btn.dataset.parentTopic === key;
                btn.classList.toggle('is-active', active);
                btn.setAttribute('aria-pressed', String(active));
            });
            const text = document.getElementById('parent-compose-text');
            if (text) text.placeholder = topic.placeholder;
            prefillCompose(key);
            return;
        }

        const threadBtn = event.target.closest('[data-parent-thread-id]');
        if (threadBtn) {
            onSelectThread?.(threadBtn.dataset.parentThreadId);
            const thread = (state.get('currentCommunicationThreads') || []).find((item) => item.id === threadBtn.dataset.parentThreadId);
            markThreadSeen(thread);
            openMessagesView('thread');
        }
    });

    screen?.addEventListener('keydown', (event) => {
        // Enter sends a reply on a keyboard; Shift+Enter adds a line.
        if (event.target.id === 'parent-message-text' && event.key === 'Enter' && !event.shiftKey && !event.isComposing
            && window.matchMedia?.('(hover: hover)').matches) {
            event.preventDefault();
            event.target.form?.requestSubmit();
        }
    });

    screen?.addEventListener('submit', async (event) => {
        if (event.target.id === 'parent-message-form') {
            event.preventDefault();
            await sendReply(event.target);
        } else if (event.target.id === 'parent-compose-form') {
            event.preventDefault();
            await sendNewMessage(event.target, onSelectThread);
        }
    });
}

function prefillCompose(topicKey) {
    const text = document.getElementById('parent-compose-text');
    if (!text) return;
    if (topicKey === 'absence' && !text.value.trim()) {
        text.value = absenceStarter();
    }
    text.focus();
    text.setSelectionRange?.(text.value.length, text.value.length);
}

async function sendReply(form) {
    const thread = getActiveThread();
    const field = document.getElementById('parent-message-text');
    const body = field?.value?.trim();
    const linkedStudentId = state.get('currentUserProfile')?.linkedStudentId;
    if (!thread || !body || !linkedStudentId) {
        showToast(tr('Write a message first.', 'Γράψτε πρώτα ένα μήνυμα.'), 'info');
        return;
    }
    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true);
    try {
        await postCommunicationMessage({
            threadId: thread.id,
            studentId: linkedStudentId,
            body,
            messageType: thread.threadType || 'school-message'
        });
        field.value = '';
        autoGrow(field);
        markThreadSeen(thread);
    } catch (error) {
        console.error('Could not send parent message:', error);
        showToast(error?.message || tr('Could not send the message right now.', 'Δεν ήταν δυνατή η αποστολή του μηνύματος αυτή τη στιγμή.'), 'error');
    } finally {
        setBusy(button, false);
    }
}

async function sendNewMessage(form, onSelectThread) {
    const field = document.getElementById('parent-compose-text');
    const body = field?.value?.trim();
    const topic = state.get('parentView')?.composeTopic || 'question';
    if (!body) {
        showToast(tr('Write a message first.', 'Γράψτε πρώτα ένα μήνυμα.'), 'info');
        field?.focus();
        return;
    }
    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true);
    try {
        const result = await sendFamilyMessage({ topic, body });
        field.value = '';
        showToast(tr('Sent. The school will reply here.', 'Στάλθηκε. Το σχολείο θα απαντήσει εδώ.'), 'success');
        if (result?.threadId) {
            onSelectThread?.(result.threadId);
            openMessagesView('thread');
        } else {
            openMessagesView('inbox');
        }
    } catch (error) {
        console.error('Could not start a family message:', error);
        const notReady = /not[- ]found|internal/i.test(String(error?.code || ''));
        showToast(notReady ? tr('Messaging is being updated. Please try again later.', 'Τα μηνύματα ενημερώνονται. Δοκιμάστε ξανά αργότερα.') : (error?.message || tr('Could not send the message right now.', 'Δεν ήταν δυνατή η αποστολή του μηνύματος αυτή τη στιγμή.')), 'error');
    } finally {
        setBusy(button, false);
    }
}

export function openParentPortalTab(tabKey = null) {
    const resolved = resolveTabKey(tabKey || getStoredRoleTab('parent'));
    activateParentTab(resolved, { animate: false });
}
