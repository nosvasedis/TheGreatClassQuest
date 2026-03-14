// features/schoolSetup.js
// First-user new-school setup: show when no classes exist; add classes + invite link; enter app.

import * as state from '../state.js';
import { createClass } from '../db/actions/classes.js';
import { showToast } from '../ui/effects.js';

/**
 * Should we show the setup screen? Yes when the school has no classes yet.
 */
export function isSetupNeeded() {
    const classes = state.get('allSchoolClasses') || [];
    return classes.length === 0;
}

/**
 * Show setup screen, hide main app.
 */
export function showSetupScreen() {
    const setupEl = document.getElementById('setup-screen');
    const appEl = document.getElementById('app-screen');
    if (setupEl) setupEl.classList.remove('hidden');
    if (appEl) appEl.classList.add('hidden');
    renderSetupClassesList();
    setInviteLink();
    setupSetupListeners();
}

/**
 * Hide setup screen, show main app. Call when user clicks "Enter the Quest".
 */
export function hideSetupScreen() {
    const setupEl = document.getElementById('setup-screen');
    const appEl = document.getElementById('app-screen');
    if (setupEl) setupEl.classList.add('hidden');
    if (appEl) appEl.classList.remove('hidden');
}

/**
 * User finished setup: hide setup, show app, and switch to a default tab (e.g. My Classes).
 */
export function finishSetupAndEnterApp() {
    const classes = state.get('allSchoolClasses') || [];
    if (classes.length === 0) {
        showToast('Add at least one class, then click Enter the Quest.', 'error');
        const hint = document.getElementById('setup-enter-hint');
        if (hint) hint.classList.remove('hidden');
        return;
    }
    hideSetupScreen();
    import('../ui/tabs.js').then(tabs => tabs.showTab('my-classes-tab'));
}

function renderSetupClassesList() {
    const list = document.getElementById('setup-classes-list');
    if (!list) return;
    const classes = state.get('allSchoolClasses') || [];
    if (classes.length === 0) {
        list.innerHTML = '<li class="text-gray-400">No classes yet. Add one above.</li>';
    } else {
        list.innerHTML = classes.map(c => `<li><span class="font-medium">${c.logo || '📚'} ${c.name}</span> (${c.questLevel})</li>`).join('');
    }
}

function setInviteLink() {
    const input = document.getElementById('setup-invite-link');
    if (input) input.value = window.location.href.split('?')[0];
}

let listenersAttached = false;

function setupSetupListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    document.getElementById('setup-add-class-btn')?.addEventListener('click', async () => {
        const nameInput = document.getElementById('setup-class-name');
        const levelSelect = document.getElementById('setup-class-level');
        const name = nameInput?.value?.trim();
        const level = levelSelect?.value;
        if (!name) {
            showToast('Enter a class name.', 'error');
            return;
        }
        try {
            await createClass({ name, questLevel: level || 'A' });
            nameInput.value = '';
            renderSetupClassesList();
            document.getElementById('setup-enter-hint')?.classList.add('hidden');
        } catch (e) {
            showToast(e?.message || 'Could not add class', 'error');
        }
    });

    document.getElementById('setup-copy-link-btn')?.addEventListener('click', () => {
        const input = document.getElementById('setup-invite-link');
        if (!input) return;
        input.select();
        input.setSelectionRange(0, 99999);
        try {
            navigator.clipboard.writeText(input.value);
            showToast('Link copied to clipboard!', 'success');
        } catch {
            showToast('Copy the link manually from the box.', 'info');
        }
    });

    document.getElementById('setup-enter-quest-btn')?.addEventListener('click', () => {
        finishSetupAndEnterApp();
    });
}

/**
 * Call this when classes list might have changed (e.g. from real-time listener) so the setup UI updates.
 */
export function refreshSetupClassesList() {
    if (document.getElementById('setup-screen')?.classList.contains('hidden')) return;
    renderSetupClassesList();
}
