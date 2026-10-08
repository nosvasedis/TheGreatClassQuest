// /ui/core/todaysPageNotice.js — "Today's Page" as a notice, not a sheet. Right after Huzzah!
// the app asks how the crowned page should be written with a herald notification that waits
// (no timer) while the teacher keeps moving around the app: Auto hands it to the AI Chronicler,
// Manual opens the page writer, the × leaves the page waiting in the diary. It steps aside when
// the page gets written another way (the diary, the Wand, another computer), when the header
// class changes, or when the full chooser sheet (ui/modals/diaryChooser.js) opens for it.
import * as state from '../../state.js';
import { notify, showToast } from '../effects.js';
import { readWaitingPage } from '../modals/diaryChooser.js';
import { isAwaitingAdventurePage } from '../../features/adventurePageCore.mjs';

const KEY = 'todays-page';
// The Campfire's AI prep waits for the choice so it queues behind the Chronicler, but a notice
// can sit untouched for a whole lesson: past this, the crowning is announced anyway.
const SETTLE_FALLBACK_MS = 60000;

let current = null; // { logId, classId, className, herald, settle, unwatch }

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** "Story Weavers' page", "Owl Class's page". */
function possessive(name) {
    const text = String(name || '').trim();
    return /s$/i.test(text) ? `${text}'` : `${text}'s`;
}

function gemHtml(model) {
    const face = model.heroAvatar
        ? `<img src="${esc(model.heroAvatar)}" alt="" decoding="async">`
        : model.heroInitial
            ? `<span class="tpn-initial">${esc(model.heroInitial)}</span>`
            : '<i class="fas fa-users"></i>';
    return `<span class="tpn-face">${face}</span><i class="fas fa-crown tpn-crown"></i>`;
}

function messageHtml(model) {
    const who = model.hero === 'The Class Team'
        ? 'The whole class wears the crown.'
        : `<strong>${esc(model.heroFirst || model.hero)}</strong> wears the crown.`;
    return `${who} <span class="tpn-ask">How shall ${esc(possessive(model.className))} diary page be written?</span>`;
}

async function focusPage(logId) {
    try {
        const { focusDiaryPage } = await import('../tabs/log.js');
        focusDiaryPage(logId);
    } catch { /* the diary tab may not be on screen */ }
}

async function showLockedNote() {
    try {
        const { getUpgradeMessage } = await import('../../config/tiers/features.js');
        showToast(`${getUpgradeMessage('Elite', 'adventureLog')} Choose Manual to write today's page yourself.`, 'info');
    } catch {
        showToast("Auto needs the Elite plan. Choose Manual to write today's page yourself.", 'info');
    }
}

function watchPage(entry) {
    let seen = false;
    const onLogs = (logs) => {
        if (current !== entry || entry.herald?.element?.classList.contains('is-busy')) return;
        const log = (logs || []).find((l) => l.id === entry.logId);
        if (log) {
            seen = true;
            if (!isAwaitingAdventurePage(log)) entry.herald?.dismiss('written');
        } else if (seen) {
            entry.herald?.dismiss('gone');
        }
    };
    const onClass = (event) => {
        if (current !== entry || entry.herald?.element?.classList.contains('is-busy')) return;
        if ((event.detail?.classId || null) !== entry.classId) entry.herald?.dismiss('class');
    };
    const unsubscribe = state.subscribe('allAdventureLogs', onLogs);
    window.addEventListener('gcq:class-selected', onClass);
    onLogs(state.get('allAdventureLogs'));
    return () => {
        unsubscribe();
        window.removeEventListener('gcq:class-selected', onClass);
    };
}

/**
 * After the crowning: ask Auto or Manual with a notice that stays until a choice or its ×.
 * `onSettled` runs once, when a path is chosen, the notice leaves, or the fallback passes.
 */
export async function showTodaysPageNotice(logId, { onSettled } = {}) {
    let settled = false;
    const settle = () => {
        if (settled) return;
        settled = true;
        try { onSettled?.(); } catch (error) { console.warn('After-choice hook failed:', error); }
    };

    const waiting = await readWaitingPage(logId);
    if (!waiting) return settle();
    const { log, model } = waiting;

    current?.herald?.dismiss('replaced');

    const entry = { logId, classId: log.classId || null, className: model.className, herald: null, settle, unwatch: null };
    const fallback = setTimeout(settle, SETTLE_FALLBACK_MS);

    const auto = async () => {
        if (!model.canAuto) {
            await showLockedNote();
            return false;
        }
        const message = entry.herald?.element?.querySelector('.herald__message');
        const original = message?.innerHTML;
        try {
            const actions = await import('../../db/actions.js');
            await actions.writeAdventurePageWithChronicler(logId, {
                onStatus: (text) => { if (message) message.textContent = text; }
            });
        } catch (error) {
            if (message && original != null) message.innerHTML = original;
            throw new Error(error?.message || 'The Chronicler could not start. Try again or write it yourself.');
        }
        showToast('The Chronicler is writing your page. It appears in the diary in a moment. ✨', 'success');
        focusPage(logId);
    };

    const manual = async () => {
        try {
            const writer = await import('../../features/adventurePageWriter.js');
            await writer.openAdventurePageWriter(logId);
        } catch (error) {
            console.error('Could not open the page writer:', error);
            throw new Error('The page could not be opened. Please try again.');
        }
    };

    entry.herald = notify({
        key: KEY,
        type: 'info',
        sticky: true,
        className: 'herald--page',
        title: "Today's Page",
        icon: gemHtml(model),
        message: messageHtml(model),
        closeLabel: 'Later: keep the page blank for now',
        actions: [
            {
                label: 'Auto',
                icon: model.canAuto ? 'fa-wand-magic-sparkles' : 'fa-lock',
                busyLabel: 'Writing…',
                className: `tpn-auto${model.canAuto ? '' : ' is-locked'}`,
                onClick: auto
            },
            { label: 'Manual', icon: 'fa-feather-alt', busyLabel: 'Opening…', className: 'tpn-manual', onClick: manual }
        ],
        onDismiss: (reason) => {
            clearTimeout(fallback);
            entry.unwatch?.();
            if (current === entry) current = null;
            if (reason === 'handoff') return; // the chooser sheet carries the hook on
            settle();
            if (reason === 'closed') showToast("Today's page will wait for you in the diary. 🔖", 'info');
            if (reason === 'class') showToast(`${esc(possessive(entry.className))} page will wait for you in the diary. 🔖`, 'info');
        }
    });
    if (!entry.herald) {
        clearTimeout(fallback);
        return settle();
    }
    entry.herald.element.dataset.logId = logId;
    current = entry;
    entry.unwatch = watchPage(entry);
}

/**
 * The full chooser sheet is opening for this page: the notice steps aside quietly and hands
 * over its after-choice hook. `{ busy: true }` while the notice is already handing the page to
 * the Chronicler or opening the writer (the sheet should not open then); null when there is no
 * notice for this page.
 */
export function handOffTodaysPageNotice(logId) {
    const entry = current;
    if (!entry || entry.logId !== logId) return null;
    if (entry.herald?.element?.classList.contains('is-busy')) return { busy: true };
    entry.herald?.dismiss('handoff');
    return { settle: entry.settle };
}

