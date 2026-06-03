import * as state from '../state.js';
import { postCommunicationMessage } from '../utils/adminRuntime.js';
import { showToast } from '../ui/effects.js';
import { activateParentTab as activateRoleParentTab, getStoredRoleTab } from '../ui/roles/navigation.js';
import { renderParentHome, updateParentHeader } from './parent/home.js';
import { renderParentHomework } from './parent/homework.js';
import { renderParentProgress } from './parent/progress.js';
import { renderParentMessages, getParentMessageTypeValue } from './parent/messages.js';

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
    return LEGACY_TAB_MAP[tabKey] || tabKey || 'home';
}

function getActiveTabKey() {
    const panel = document.querySelector('[data-parent-section]:not(.hidden)');
    return panel?.dataset.parentSection || state.get('parentView')?.activeTab || 'home';
}

export function activateParentTab(tabKey, options) {
    const resolved = resolveTabKey(tabKey);
    state.setParentView({ activeTab: resolved });
    activateRoleParentTab(resolved, options);
    renderParentTab(resolved);
}

export function renderParentTab(tabKey) {
    const resolved = resolveTabKey(tabKey);
    const renderer = TAB_RENDERERS[resolved];
    const section = document.querySelector(`[data-parent-section="${resolved}"]`);
    if (!renderer || !section) return;
    section.innerHTML = renderer();
}

export function renderParentPortal(tabKey) {
    const snapshot = state.get('currentParentSnapshot') || {};
    updateParentHeader(snapshot);

    if (tabKey) {
        renderParentTab(resolveTabKey(tabKey));
        return;
    }

    renderParentTab(getActiveTabKey());
}

export function wireParentPortalListeners({ onLogout, onRefresh, onSelectThread }) {
    if (listenersWired) return;
    listenersWired = true;

    document.getElementById('parent-logout-btn')?.addEventListener('click', () => onLogout?.());
    document.getElementById('parent-refresh-btn')?.addEventListener('click', () => onRefresh?.());

    document.getElementById('parent-screen')?.addEventListener('click', (event) => {
        const navBtn = event.target.closest('.nav-button[data-parent-tab]');
        if (navBtn) {
            state.setParentView({ messageView: 'inbox', homeworkView: 'list', selectedHomeworkId: null });
            activateParentTab(navBtn.dataset.parentTab || 'home');
            return;
        }

        const tabLink = event.target.closest('[data-parent-tab-link]');
        if (tabLink) {
            activateParentTab(tabLink.dataset.parentTabLink);
            return;
        }

        const homeworkItem = event.target.closest('[data-parent-homework-id]');
        if (homeworkItem) {
            state.setParentView({
                homeworkView: 'detail',
                selectedHomeworkId: homeworkItem.dataset.parentHomeworkId,
                activeTab: 'homework'
            });
            renderParentTab('homework');
            return;
        }

        const homeworkBack = event.target.closest('[data-parent-homework-view="list"]');
        if (homeworkBack) {
            state.setParentView({ homeworkView: 'list', selectedHomeworkId: null });
            renderParentTab('homework');
            return;
        }

        const messageViewBtn = event.target.closest('[data-parent-message-view]');
        if (messageViewBtn) {
            state.setParentView({ messageView: messageViewBtn.dataset.parentMessageView });
            renderParentTab('messages');
            return;
        }

        const messageTypeChip = event.target.closest('[data-parent-message-type]');
        if (messageTypeChip) {
            state.setParentView({ messageType: messageTypeChip.dataset.parentMessageType });
            renderParentTab('messages');
            return;
        }

        const threadBtn = event.target.closest('[data-parent-thread-id]');
        if (threadBtn) {
            onSelectThread?.(threadBtn.dataset.parentThreadId);
            state.setParentView({ messageView: 'thread', activeTab: 'messages' });
            renderParentTab('messages');
            return;
        }

        const showHistoryBtn = event.target.closest('#parent-show-full-history');
        if (showHistoryBtn) {
            state.setParentView({ progressModalOpen: true });
            renderParentTab('progress');
            return;
        }

        const closeModalBtn = event.target.closest('#parent-progress-modal-close');
        if (closeModalBtn) {
            state.setParentView({ progressModalOpen: false });
            renderParentTab('progress');
            return;
        }

        if (event.target.id === 'parent-progress-modal') {
            state.setParentView({ progressModalOpen: false });
            renderParentTab('progress');
        }
    });

    document.getElementById('parent-screen')?.addEventListener('submit', async (event) => {
        if (event.target.id !== 'parent-message-form') return;
        event.preventDefault();
        const threadId = state.get('currentCommunicationThreadId');
        const body = document.getElementById('parent-message-text')?.value?.trim();
        const profile = state.get('currentUserProfile');
        const linkedStudentId = profile?.linkedStudentId;
        const messageTypeKey = state.get('parentView')?.messageType || 'general';
        if (!threadId || !body || !linkedStudentId) {
            showToast('Write a message first.', 'info');
            return;
        }
        try {
            await postCommunicationMessage({
                threadId,
                studentId: linkedStudentId,
                body,
                messageType: getParentMessageTypeValue(messageTypeKey)
            });
            document.getElementById('parent-message-text').value = '';
            showToast('Message sent.', 'success');
        } catch (error) {
            console.error('Could not send parent message:', error);
            showToast(error?.message || 'Could not send the message right now.', 'error');
        }
    });
}

export function openParentPortalTab(tabKey = null) {
    const resolved = resolveTabKey(tabKey || getStoredRoleTab('parent'));
    activateParentTab(resolved, { animate: false });
}
