// ui/questRemoteButton.js — the ways into Quest Remote (Pro). Tiny and eager; everything else loads
// on demand:
// - desktop header `#quest-remote-btn` and Projector Mode's wand button → the projector host
//   (features/questRemote/remoteHost.js) shows the binding circle;
// - a `#wand=<session>` link (the QR) or More › Quest Remote on a phone → the Wand
//   (features/questRemote/remoteWand.js);
// - after a page reload, a projector that was hosting quietly re-opens its session.
import { canUseFeature } from '../utils/subscription.js';

const WAND_LINK_RE = /(?:^|[#&?])wand=([a-z0-9]{6,40})(?:&|$)/i;
const HOST_KEY = 'gcq.questRemote.host';

function wandLinkId() {
    const m = String(window.location.hash || '').match(WAND_LINK_RE) || String(window.location.search || '').match(WAND_LINK_RE);
    return m ? m[1] : '';
}

function isPhoneLayout() {
    return document.body.classList.contains('gcq-mobile');
}

function applyVisibility() {
    const allowed = canUseFeature('questRemote');
    document.getElementById('quest-remote-btn')?.classList.toggle('hidden', !allowed || isPhoneLayout());
    document.querySelectorAll('[data-wall-action="wand"]').forEach((btn) => btn.classList.toggle('hidden', !allowed));
}

let hostModule = null;
let wandModule = null;
const loadHost = () => (hostModule ??= import('../features/questRemote/remoteHost.js'));
const loadWand = () => (wandModule ??= import('../features/questRemote/remoteWand.js'));

export function openQuestRemoteHost() {
    return loadHost()
        .then(({ toggleQuestRemote }) => toggleQuestRemote())
        .catch((error) => console.warn('Quest Remote could not open:', error));
}

function openWandFromLink() {
    const id = wandLinkId();
    if (!id) return;
    loadWand()
        .then(({ openWand }) => openWand({ sessionId: id }))
        .catch((error) => console.warn('The Wand could not open:', error));
}

let wired = false;

export function initQuestRemoteButton() {
    if (wired) return;
    wired = true;
    document.getElementById('quest-remote-btn')?.addEventListener('click', () => { void openQuestRemoteHost(); });
    window.addEventListener('gcq-subscription-updated', applyVisibility);
    document.addEventListener('gcq-mobile-mode', applyVisibility);
    window.addEventListener('hashchange', () => { if (document.body.dataset.gcqTeacherReady === 'true') openWandFromLink(); });
    applyVisibility();
}

/** Called once the teacher app has its data: open a Wand link, or resume hosting after a reload. */
export function onTeacherAppReady() {
    document.body.dataset.gcqTeacherReady = 'true';
    applyVisibility();
    if (wandLinkId()) { openWandFromLink(); return; }
    let hosting = false;
    try { hosting = Boolean(sessionStorage.getItem(HOST_KEY)); } catch { hosting = false; }
    if (hosting && canUseFeature('questRemote')) {
        loadHost()
            .then(({ resumeQuestRemoteIfHosting }) => resumeQuestRemoteIfHosting())
            .catch((error) => console.warn('Quest Remote could not resume:', error));
    }
}

/** Opens the Wand on this device (phone More sheet). */
export function openQuestRemoteWand() {
    return loadWand()
        .then(({ openWand }) => openWand())
        .catch((error) => console.warn('The Wand could not open:', error));
}

/** Sign-out: the projector session closes and the Wand is put down. */
export function onSignedOut() {
    delete document.body.dataset.gcqTeacherReady;
    hostModule?.then((m) => m.stopQuestRemote({ quiet: true })).catch(() => {});
    wandModule?.then((m) => m.closeWand({ quiet: true })).catch(() => {});
}
