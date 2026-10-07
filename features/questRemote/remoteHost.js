// features/questRemote/remoteHost.js — Quest Remote, projector side (lazy).
//
// The projector PC is the ONLY executor: the Wand (the teacher's phone) sends intents and this
// module performs them through the app's own buttons, keys and functions, so every guard, sound,
// celebration and Firestore transaction is the one the mouse would trigger. Each command is shown
// to the class first: a spark flies from the bottom edge to what the Wand touches (remoteFx.js).
//
// Stage Pad: the host finds the top-most surface (an open window over the screen, else the active
// tab), lists its buttons (explicit `data-remote="Label"` first) and sends them to the Wand, so
// every screen of the app can be driven, including ones added later.
// Opt-outs: `data-remote-skip` on a container hides its buttons from the pad; `data-qr-ignore`
// marks Quest Remote's own layers.

import '../../styles/quest_remote.css';
import * as state from '../../state.js';
import { canUseFeature } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { FEATURE_DEFINITIONS, getUpgradeMessage, TAB_FEATURE_FLAGS } from '../../config/tiers/features.js';
import { playSound, ensureAudioReady } from '../../audio.js';
import { showToast } from '../../ui/effects.js';
import { getSchoolId, DEFAULT_SCHOOL_ID } from '../../utils/tenant.mjs';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import { getTodayDateString } from '../../utils.js';
import * as channel from './remoteChannel.js';
import {
    validateCommand, createCommandLedger, isStaleCommand, makeSessionCode, makeSessionId, buildWandLink,
    buildStageSummary, stageFingerprint, formatTimerClock, CAST_TABS, HEARTBEAT_MS, HOST_LIVE_MS, STAGE_MIN_INTERVAL_MS
} from './remoteCore.mjs';
import { bindingHtml, timerHtml, curtainHtml, starRibbonHtml } from './remoteStageView.mjs';
import { sparkTo, starComet, burstOn, bindBeam, isStillFx } from './remoteFx.js';

const STORE_KEY = 'gcq.questRemote.host';
const LITE = (() => { try { return detectLowPowerTier(); } catch { return false; } })();
const DANGER_RE = /\b(delete|remove|erase|purge|sign ?out|log ?out|reset|archive|discard|leave school)\b/i;

let host = null;

// ─── Public API ─────────────────────────────────────────────────────────────

export function isHosting() { return Boolean(host); }
export function isWandBound() { return Boolean(host?.bound); }

/** Header / projector button: start hosting, or re-open the binding circle when already hosting. */
export async function toggleQuestRemote() {
    if (!canUseFeature('questRemote')) {
        showUpgradePrompt({ feature: FEATURE_DEFINITIONS.questRemote.name, tier: 'Pro', message: getUpgradeMessage('Pro', 'questRemote') });
        return;
    }
    if (host) { openBindingCircle(); return; }
    await startHosting();
}

/** After a page reload: quietly re-open the session this tab was hosting. */
export async function resumeQuestRemoteIfHosting() {
    if (host || !canUseFeature('questRemote')) return;
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null'); } catch { saved = null; }
    if (!saved?.id || !saved?.code) return;
    await startHosting({ resume: saved });
}

export async function stopQuestRemote({ quiet = false } = {}) {
    if (!host) return;
    const h = host;
    host = null;
    try { sessionStorage.removeItem(STORE_KEY); } catch { /* private mode */ }
    h.unsubSession?.();
    h.unsubCommands?.();
    clearInterval(h.beat);
    clearTimeout(h.stageTimer);
    clearInterval(h.safetyScan);
    h.observer?.disconnect();
    document.removeEventListener('click', h.onAnyInput, true);
    document.removeEventListener('keydown', h.onAnyInput, true);
    stopTimer();
    setBlackout(false);
    (await import('./showdown.js').catch(() => null))?.closeShowdown?.({ silent: true });
    document.getElementById('qr-star-ribbon')?.remove();
    closeBindingCircle();
    syncLaunchButtons();
    await channel.closeHostSession(h.id);
    if (!quiet) {
        playSound('click');
        showToast('The Wand is asleep. This screen is yours again.', 'info');
    }
}

// ─── Session lifecycle ──────────────────────────────────────────────────────

async function startHosting({ resume = null } = {}) {
    try { await ensureAudioReady(); } catch { /* sounds are optional */ }
    const id = resume?.id || makeSessionId();
    const code = resume?.code || makeSessionCode();
    const hostId = Math.random().toString(36).slice(2, 10);
    host = {
        id, code, hostId,
        bound: false, wandId: null, wandBeatMs: 0,
        ledger: createCommandLedger(),
        lastFp: '', lastStageAt: 0, stageTimer: 0, lastResult: null,
        pad: new Map(), elIds: new WeakMap(), padSeq: 0,
        queue: Promise.resolve()
    };
    try {
        await channel.openHostSession(id, { code, hostId, classId: state.get('globalSelectedClassId') || '' });
    } catch (error) {
        console.warn('Quest Remote: session could not open', error);
        host = null;
        if (!resume) showToast('Quest Remote could not start. Check the connection and try again.', 'error');
        return;
    }
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ id, code })); } catch { /* private mode */ }

    const h = host;
    h.unsubSession = channel.watchSession(id, onSessionData, (e) => console.warn('Quest Remote session watch', e));
    h.unsubCommands = channel.watchCommands(id, (cmd) => enqueue(cmd), (e) => console.warn('Quest Remote commands watch', e));
    h.beat = setInterval(() => {
        if (host !== h) return;
        channel.beatHost(id).catch(() => {});
        refreshBondState();
    }, HEARTBEAT_MS);

    // Keep the Wand's view of the screen fresh: DOM changes, the teacher's own clicks/keys, and a
    // slow safety scan (all coalesced into at most ~1 write per second).
    h.observer = new MutationObserver(() => scheduleStage());
    h.observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'disabled', 'aria-hidden'] });
    h.onAnyInput = () => scheduleStage(300);
    document.addEventListener('click', h.onAnyInput, true);
    document.addEventListener('keydown', h.onAnyInput, true);
    h.safetyScan = setInterval(() => scheduleStage(), 4000);

    syncLaunchButtons();
    if (!resume) openBindingCircle();
    scheduleStage(0);
}

function onSessionData(data) {
    if (!host) return;
    if (!data || data.closed) {
        if (data?.closed) stopQuestRemote({ quiet: true });
        return;
    }
    const beatMs = channel.toMs(data.wandHeartbeatAt);
    if (data.wandId && Number.isFinite(beatMs)) {
        const isNewWand = data.wandId !== host.wandId;
        // Liveness is measured on this computer's clock (when a new beat arrived), never by
        // comparing server time with a classroom PC clock that may be minutes off.
        if (isNewWand || beatMs !== host.wandBeatMs) host.wandSeenAt = Date.now();
        host.wandId = data.wandId;
        host.wandBeatMs = beatMs;
        if (isNewWand) onWandBound();
    }
    refreshBondState();
}

function onWandBound() {
    host.bound = true;
    playSound('magic_chime');
    const circle = document.querySelector('#quest-remote-bind .qr-circle');
    if (circle) {
        bindBeam(circle).then(() => {
            if (!host) return;
            renderBinding(true);
            setTimeout(() => closeBindingCircle(), isStillFx() ? 900 : 1800);
        });
    } else {
        // Reconnected without the circle on screen: the header wand answers instead.
        const btn = launchButton();
        if (btn) sparkTo(btn, { color: '#fcd34d', size: 20, duration: 520, burst: 16 });
        else showToast('✨ The Wand is awake.', 'success');
    }
    syncLaunchButtons();
    scheduleStage(0);
}

function refreshBondState() {
    if (!host) return;
    const alive = host.wandId && Date.now() - (host.wandSeenAt || 0) < HOST_LIVE_MS + 10_000;
    const was = host.bound;
    host.bound = Boolean(alive);
    if (was !== host.bound) syncLaunchButtons();
}

// ─── Binding circle, glyph, launch buttons ──────────────────────────────────

async function openBindingCircle() {
    if (!host) return;
    let modal = document.getElementById('quest-remote-bind');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quest-remote-bind';
        modal.className = `qr-bind${LITE ? ' qr-lite' : ''}`;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'qr-bind-title');
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('[data-qr-close]')) { playSound('click'); closeBindingCircle(); return; }
            if (e.target.closest('[data-qr-sleep]')) stopQuestRemote();
        });
        modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeBindingCircle(); } });
        document.body.appendChild(modal);
    }
    renderBinding(host.bound);
    modal.classList.remove('is-leaving');
    requestAnimationFrame(() => modal.classList.add('is-open'));
    modal.querySelector('[data-qr-close]')?.focus({ preventScroll: true });
    playSound('magic_chime_short');

    // The QR (lazy library, shared with the Family Access Kit)
    try {
        const { renderQrSvg } = await import('../familyAccessKit.js');
        const schoolId = getSchoolId();
        const link = buildWandLink(location.origin, location.pathname, host.id, schoolId !== DEFAULT_SCHOOL_ID ? schoolId : '');
        const svg = await renderQrSvg(link, { color: '#1e1b4b', accent: '#d97706', title: 'Quest Remote: scan with your phone', emblem: true });
        const slot = modal.querySelector('[data-qr-target]');
        if (slot && host) { slot.innerHTML = svg; host.qrSvg = svg; }
    } catch (error) {
        console.warn('Quest Remote QR failed', error);
    }
}

function renderBinding(bound) {
    const modal = document.getElementById('quest-remote-bind');
    if (!modal || !host) return;
    modal.innerHTML = bindingHtml({ qrSvg: host.qrSvg || '', code: host.code, lite: LITE, bound });
    modal.dataset.state = bound ? 'bound' : 'waiting';
}

function closeBindingCircle() {
    const modal = document.getElementById('quest-remote-bind');
    if (!modal) return;
    if (isStillFx()) { modal.remove(); return; }
    modal.classList.add('is-leaving');
    modal.classList.remove('is-open');
    setTimeout(() => modal.remove(), 380);
}

/** The visible wand button: the header one, or Projector Mode's when that covers the screen. */
function launchButton() {
    return [...document.querySelectorAll('[data-wall-action="wand"], #quest-remote-btn')].find(isShown) || null;
}

/** Header and projector buttons glow while a Wand is awake. */
function syncLaunchButtons() {
    const on = Boolean(host);
    const bound = Boolean(host?.bound);
    document.querySelectorAll('#quest-remote-btn, [data-wall-action="wand"]').forEach((btn) => {
        btn.classList.toggle('is-wand-awake', on);
        btn.classList.toggle('is-wand-bound', bound);
        btn.setAttribute('aria-pressed', String(on));
        btn.title = bound ? 'Quest Remote: your phone is the Wand (click for the circle or to sleep)'
            : on ? 'Quest Remote: waiting for your phone' : 'Quest Remote: your phone runs the projector';
    });
}

// ─── Commands ───────────────────────────────────────────────────────────────

function enqueue(cmd) {
    if (!host) return;
    const check = validateCommand(cmd);
    if (!check.ok) return;
    if (!host.ledger.accept(cmd.wandId, cmd.clientSeq)) return;
    if (isStaleCommand(cmd.createdMs, cmd.sentAt)) return;
    host.queue = host.queue.then(() => run(cmd)).catch((error) => {
        console.warn('Quest Remote command failed', cmd.type, error);
        report(cmd, false, 'That did not work on the projector.');
    });
}

function report(cmd, ok, message = '') {
    if (!host) return;
    host.lastResult = { seq: cmd.clientSeq, ok, message };
    scheduleStage(0);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Waits (briefly) for an element to appear; resolves null if it never does. */
async function waitFor(selector, { timeout = 2500, root = document, visible = true } = {}) {
    const end = performance.now() + timeout;
    while (performance.now() < end) {
        const el = root.querySelector(selector);
        if (el && (!visible || el.getClientRects().length)) return el;
        await wait(60);
    }
    return null;
}

function isShown(el) { return Boolean(el && el.isConnected && el.getClientRects().length); }

async function sparkAndClick(el, opts = {}) {
    if (!isShown(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) {
        el.scrollIntoView({ block: 'center', behavior: isStillFx() ? 'auto' : 'smooth' });
        await wait(isStillFx() ? 30 : 380);
    }
    await sparkTo(el, opts);
    if (!el.isConnected) return false;
    el.click();
    return true;
}

/** Presses one of the app's own keyboard shortcuts on the projector. */
function pressKey(key) {
    const target = document.body;
    const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
}

function activeTabId() { return document.querySelector('.app-tab:not(.hidden)')?.id || ''; }

function wallpaperRunning() {
    const wall = document.getElementById('dynamic-wallpaper-screen');
    return Boolean(wall && !wall.classList.contains('hidden'));
}

/** Is this screen part of the school's plan? Same gate as the dock (config/tiers/features.js TAB_FEATURE_FLAGS). */
function tabAllowed(tab) {
    const flag = TAB_FEATURE_FLAGS[tab];
    return !flag || canUseFeature(flag);
}

/**
 * The dock cloud for a tab, ready to be touched. On a mouse PC the dock sinks out of sight when idle
 * (ui/core/cloudDock.js); then only this one cloud rises for the Wand, and sinks back a moment later.
 */
async function riseCloud(tab) {
    const dock = document.getElementById('bottom-nav-bar');
    const cloud = dock?.querySelector(`.nav-button[data-tab="${tab}"]`);
    if (!cloud || !dock.getClientRects().length) return null;
    if (dock.classList.contains('cloud-dock--asleep')) {
        clearTimeout(cloud._qrSink);
        cloud.classList.add('qr-summoned');
        cloud._qrSink = setTimeout(() => cloud.classList.remove('qr-summoned'), 2600);
        await wait(isStillFx() ? 0 : 420);
    }
    return isShown(cloud) ? cloud : null;
}

/** showTab reveals the new tab only after the old one has faded out: wait for it to really be there. */
async function waitForTab(tab, timeout = 1800) {
    const end = performance.now() + timeout;
    while (performance.now() < end) {
        if (activeTabId() === tab) return true;
        await wait(60);
    }
    return activeTabId() === tab;
}

/**
 * Brings a tab to the screen the way the mouse does: the Wand touches its cloud in the dock (the
 * cloud's own click handler plays the sound and switches). Under a covering window there is no
 * cloud to see, so the tab simply switches underneath.
 */
async function ensureTab(tab, { spark } = {}) {
    if (activeTabId() === tab) return true;
    if (!tabAllowed(tab)) return false;
    const cloud = (spark ?? !topOverlay()) ? await riseCloud(tab) : null;
    if (cloud) {
        await sparkTo(cloud, { size: 18, duration: 480, burst: 14 });
        cloud.click();
    } else {
        const nav = await import('../../ui/tabs/navigation.js');
        await nav.showTab(tab);
    }
    return waitForTab(tab);
}

/** "Show this" commands (cast, crown, wheel, picker) first let Projector Mode step aside, or it would hide them. */
async function stepAsideProjectorMode() {
    if (!wallpaperRunning()) return;
    const { toggleWallpaperMode } = await import('../../ui/wallpaper.js');
    toggleWallpaperMode();
    await wait(isStillFx() ? 60 : 480);
}

async function runCast(cmd, tab) {
    const label = CAST_TABS.find((t) => t.tab === tab)?.label || 'That screen';
    if (!tabAllowed(tab)) return report(cmd, false, `${label} is not part of this school's plan`);
    await stepAsideProjectorMode();
    const overlay = topOverlay();
    const ok = await ensureTab(tab, { spark: !overlay });
    if (!ok) return report(cmd, false, `${label} did not open`);
    if (overlay) return report(cmd, true, `${label} is ready behind this window: press Back`);
    return report(cmd, true, `On screen: ${label}`);
}

function ensureClass(classId) {
    if (!classId || state.get('globalSelectedClassId') === classId) return;
    const mine = (state.get('allTeachersClasses') || []).some((c) => c.id === classId);
    if (!mine) return;
    state.setGlobalSelectedClass(classId, true);
    import('../../ui/headerClassSelector.js').then((m) => m.syncHeaderClassSelector?.()).catch(() => {});
}

function studentById(id) { return (state.get('allStudents') || []).find((s) => s.id === id) || null; }
function firstName(s) { return String(s?.name || 'Hero').split(' ')[0]; }

async function run(cmd) {
    const p = cmd.payload || {};
    switch (cmd.type) {
        case 'bind': return report(cmd, true, '✨ The Wand is awake');
        case 'pad': return runPad(cmd, p.id);
        case 'key': {
            const surface = findSurface();
            await sparkTo(surface.el, { size: 14, duration: 360, burst: 6 });
            pressKey(p.key);
            return report(cmd, true, '');
        }
        case 'cast': return runCast(cmd, p.tab);
        case 'class': {
            const btn = document.getElementById('header-class-selector-btn');
            if (isShown(btn)) await sparkTo(btn, { size: 16, duration: 420, burst: 10 });
            ensureClass(p.classId);
            const cls = (state.get('allTeachersClasses') || []).find((c) => c.id === p.classId);
            return report(cmd, Boolean(cls), cls ? `${cls.logo || ''} ${cls.name}`.trim() : 'Class not found');
        }
        case 'scroll': return runScroll(cmd, p.dir);
        case 'award': return runAward(cmd, p);
        case 'undo': return runCardAction(cmd, p.studentId, '.post-award-undo-btn', 'Undone');
        case 'attendance': return runCardAction(cmd, p.studentId, `[data-action="${p.action}"]`,
            p.action === 'mark-absent' ? 'Marked away' : p.action === 'welcome-back' ? 'Welcome back!' : 'Marked present');
        case 'crown': return runCrown(cmd);
        case 'wheel': return runWheel(cmd, p);
        case 'picker': return runPicker(cmd, p.action);
        case 'timer': return runTimer(cmd, p);
        case 'blackout': setBlackout(p.on); return report(cmd, true, p.on ? 'Screen paused' : 'Screen back');
        case 'dragon': {
            if (p.action === 'open') {
                const { openQuietDragonFrom } = await import('../../ui/quietDragonButton.js');
                await sparkTo(findSurface().el, { color: '#86efac', size: 22 });
                await openQuietDragonFrom('remote');
            } else pressKey('Escape');
            return report(cmd, true, '');
        }
        case 'wall': return runWall(cmd, p.action);
        case 'showdown': {
            const sd = await import('./showdown.js');
            const message = await sd.runShowdownCommand(p, { sparkTo, scheduleStage, award: awardHero });
            return report(cmd, true, message || '');
        }
        case 'quiz': return runQuiz(cmd, p);
        default: return report(cmd, false, 'Unknown command');
    }
}

async function runPad(cmd, id) {
    const el = host.pad.get(id)?.deref?.();
    if (!isShown(el) || el.disabled) return report(cmd, false, 'That button is no longer on screen');
    await sparkAndClick(el);
    return report(cmd, true, '');
}

function scrollContainerOf(surfaceEl) {
    // Walk up from the middle of the surface to the first scrollable box.
    const probe = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight * 0.55)
        .find((el) => !el.closest('[data-qr-ignore]'));
    for (let n = probe; n && n !== document.documentElement; n = n.parentElement) {
        if (surfaceEl && !surfaceEl.contains(n) && n !== surfaceEl) break;
        const cs = getComputedStyle(n);
        if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 20) return n;
    }
    return null;
}

function runScroll(cmd, dir) {
    const surface = findSurface();
    const box = scrollContainerOf(surface.el);
    const behavior = isStillFx() ? 'auto' : 'smooth';
    if (box) {
        if (dir === 'top') box.scrollTo({ top: 0, behavior });
        else box.scrollBy({ top: (dir === 'down' ? 1 : -1) * box.clientHeight * 0.7, behavior });
    } else if (dir === 'top') window.scrollTo({ top: 0, behavior });
    else window.scrollBy({ top: (dir === 'down' ? 1 : -1) * window.innerHeight * 0.7, behavior });
    return report(cmd, true, '');
}

/**
 * The hero's own cloud on Award Stars, wherever the projector is. Awards always go through that
 * cloud (the same buttons, guards and saving as the mouse). If a window covers the screen (Projector
 * Mode, a show, a quiz) the tab switches quietly underneath and the class sees a star ribbon instead.
 */
async function cardFor(studentId) {
    const student = studentById(studentId);
    if (!student) return { error: 'Hero not found' };
    ensureClass(student.classId);
    const covered = Boolean(topOverlay());
    if (!(await ensureTab('award-stars-tab', { spark: !covered }))) return { error: 'Award Stars could not open' };
    const card = await waitFor(`#award-stars-student-list .student-cloud-card[data-studentid="${CSS.escape(studentId)}"]`, { timeout: 3000, visible: !covered });
    if (!card) return { error: `${firstName(student)} is not in this class on Award Stars` };
    if (!covered) {
        const r = card.getBoundingClientRect();
        if (r.top < 60 || r.bottom > window.innerHeight - 20) {
            card.scrollIntoView({ block: 'center', behavior: isStillFx() ? 'auto' : 'smooth' });
            await wait(isStillFx() ? 40 : 420);
        }
    }
    return { card, student, covered };
}

async function runAward(cmd, { studentId, reason, stars }) {
    const res = await awardHero(studentId, reason, stars);
    return report(cmd, res.ok, res.message);
}

/** One star award through the hero's own cloud on the Award Stars screen (same path as the mouse). */
async function awardHero(studentId, reason, stars) {
    const { card, student, covered, error } = await cardFor(studentId);
    if (error) return { ok: false, message: error };
    if (card.classList.contains('is-locked')) return { ok: false, message: `${firstName(student)} already has today's stars` };
    if (card.classList.contains('is-absent')) {
        return { ok: false, message: card.querySelector('[data-action="welcome-back"]')
            ? `${firstName(student)} was away last lesson: welcome them back first`
            : `${firstName(student)} is marked away today` };
    }
    const reasonBtn = card.querySelector(`.reason-btn[data-reason="${reason}"]`);
    const starBtn = card.querySelector(`.star-award-btn[data-stars="${stars}"]`);
    if (!reasonBtn || !starBtn) return { ok: false, message: 'This cloud cannot take a star right now' };
    if (!reasonBtn.classList.contains('active')) {
        if (!covered) await sparkTo(reasonBtn, { color: '#c4b5fd', size: 16, duration: 440, burst: 8 });
        reasonBtn.click();
        await wait(isStillFx() || covered ? 60 : 260);
    }
    const target = covered
        ? await showRibbon(student, { stars, reason })
        : (isShown(starBtn) ? starBtn : card);
    await starComet(target, stars);
    starBtn.click();
    return { ok: true, message: `${'★'.repeat(stars)} ${firstName(student)}` };
}

async function runCardAction(cmd, studentId, selector, okMessage) {
    const { card, student, covered, error } = await cardFor(studentId);
    if (error) return report(cmd, false, error);
    const btn = card.querySelector(selector);
    if (!btn || (btn.classList.contains('hidden') && !isShown(btn))) return report(cmd, false, `Nothing to do for ${firstName(student)}`);
    const target = covered ? await showRibbon(student, { note: okMessage }) : (isShown(btn) ? btn : card);
    await sparkTo(target, { size: 18, duration: 480, burst: 10 });
    btn.click();
    return report(cmd, true, `${okMessage}: ${firstName(student)}`);
}

// ─── Star ribbon (when a window covers the Award Stars clouds) ──────────────

let ribbonTimer = 0;

/** Drops a golden ribbon with the hero over whatever is on screen; resolves with the comet target. */
async function showRibbon(student, { stars = 0, reason = '', note = '' } = {}) {
    let el = document.getElementById('qr-star-ribbon');
    if (!el) {
        el = document.createElement('div');
        el.id = 'qr-star-ribbon';
        el.className = `qr-ribbon${LITE ? ' qr-lite' : ''}`;
        el.dataset.qrIgnore = '';
        el.setAttribute('role', 'status');
        document.body.appendChild(el);
    }
    clearTimeout(ribbonTimer);
    el.innerHTML = starRibbonHtml({ name: firstName(student), avatar: student.avatar || '', stars, reason, note });
    el.classList.remove('is-out', 'is-in');
    void el.offsetWidth;
    el.classList.add('is-in');
    ribbonTimer = setTimeout(() => {
        el.classList.remove('is-in');
        el.classList.add('is-out');
    }, 2800);
    await wait(isStillFx() ? 0 : 280);
    return el.querySelector('[data-qr-ribbon-target]') || el;
}

async function runCrown(cmd) {
    if (!canUseFeature('adventureLog')) return report(cmd, false, 'Hero of the Day needs the Adventure Log (Pro)');
    // The same checks the crown button makes, answered on the phone instead of a toast nobody reads.
    const classId = state.get('globalSelectedClassId');
    if (!classId) return report(cmd, false, 'Choose a class first (top right)');
    const today = getTodayDateString();
    const page = (state.get('allAdventureLogs') || []).find((l) => l.classId === classId && l.date === today);
    const stars = state.get('todaysStars') || {};
    const shining = (state.get('allStudents') || []).some((s) => s.classId === classId && Number(stars[s.id]?.stars) > 0);
    if (!page && !shining) return report(cmd, false, `Award some stars first, then crown today's hero`);
    await stepAsideProjectorMode();
    if (!(await ensureTab('adventure-log-tab'))) return report(cmd, false, 'The Adventure Log could not open');
    const btn = await waitFor('#log-adventure-btn', { timeout: 2500 });
    if (!btn || btn.disabled) return report(cmd, false, 'No crown to give right now');
    await sparkTo(btn, { color: '#fde047', size: 30, duration: 820, burst: 30 });
    btn.click();
    return report(cmd, true, page ? `Today's hero is already crowned: opening the page` : 'The crown is chosen…');
}

async function runWheel(cmd, { action, power }) {
    const modal = document.getElementById('fortunes-wheel-modal');
    const open = modal && !modal.classList.contains('hidden');
    if (action === 'open') {
        if (open) return report(cmd, true, '');
        if (!canUseFeature('guilds')) return report(cmd, false, "Fortune's Wheel needs the Guild Hall (Pro)");
        await stepAsideProjectorMode();
        if (!(await ensureTab('guilds-tab'))) return report(cmd, false, 'The Guild Hall could not open');
        const btn = await waitFor('#fortunes-wheel-btn', { timeout: 3000 });
        if (!btn || btn.disabled) return report(cmd, false, document.getElementById('fortunes-wheel-status')?.textContent?.trim() || 'The wheel is resting');
        await sparkAndClick(btn, { color: '#fbbf24', size: 26 });
        return report(cmd, true, "Fortune's Wheel");
    }
    if (!open) return report(cmd, false, "Fortune's Wheel is not open");
    if (action === 'spin') {
        const fw = await import('../fortunesWheel.js');
        if (fw.getWheelState()?.phase !== 'ready') return report(cmd, false, 'The wheel is busy');
        const btn = document.getElementById('fw-spin-btn');
        if (isShown(btn)) await sparkTo(btn, { color: '#fbbf24', size: 30, duration: 520, burst: 24 });
        fw.triggerSpin({ power: Number.isFinite(power) ? power : null });
        return report(cmd, true, 'Spinning!');
    }
    if (action === 'next') {
        const btn = ['fw-reveal-primary-btn', 'fw-next-btn', 'fw-done-btn'].map((id) => document.getElementById(id)).find(isShown);
        if (!btn) return report(cmd, false, 'Nothing next yet');
        await sparkAndClick(btn);
        return report(cmd, true, '');
    }
    const close = document.getElementById('fw-close-btn');
    if (isShown(close)) await sparkAndClick(close);
    return report(cmd, true, '');
}

const PICKER_SELECTORS = {
    pick: '[data-fpk-pick]', pass: '[data-fpk-pass]', think5: '[data-fpk-think="5"]', think10: '[data-fpk-think="10"]',
    think20: '[data-fpk-think="20"]', fresh: '[data-fpk-fresh]', big: '[data-fpk-big]', close: '[data-fpk-close]'
};

async function runPicker(cmd, action) {
    const modal = document.getElementById('fair-picker-modal');
    const open = modal && !modal.classList.contains('hidden');
    if (action === 'open' || (!open && action === 'pick')) {
        if (!open) {
            await stepAsideProjectorMode();
            const { openFairPicker } = await import('../../ui/modals/fairPicker.js');
            await sparkTo(findSurface().el, { color: '#f9a8d4', size: 22 });
            await openFairPicker(state.get('globalSelectedClassId'));
            await wait(400);
        }
        if (action === 'open') return report(cmd, true, 'Fair Picker');
    }
    const btn = document.querySelector(`#fair-picker-modal ${PICKER_SELECTORS[action]}`);
    if (!btn || btn.disabled) return report(cmd, false, action === 'pick' ? 'Still choosing…' : 'Not available right now');
    await sparkAndClick(btn, { color: '#f9a8d4', size: action === 'pick' ? 28 : 18 });
    return report(cmd, true, '');
}

async function runWall(cmd, action) {
    const { toggleWallpaperMode } = await import('../../ui/wallpaper.js');
    const screen = document.getElementById('dynamic-wallpaper-screen');
    const running = screen && !screen.classList.contains('hidden');
    if (action === 'toggle') {
        await sparkTo(findSurface().el, { color: '#93c5fd', size: 22 });
        toggleWallpaperMode();
        return report(cmd, true, running ? 'Projector Mode closed' : 'Projector Mode');
    }
    if (!running) return report(cmd, false, 'Projector Mode is not on');
    const key = { next: 'ArrowRight', prev: 'ArrowLeft', pin: ' ', reveal: 'r', deck: 'd' }[action];
    const btn = screen.querySelector(`[data-wall-action="${{ next: 'next', prev: 'prev', pin: 'pause', deck: 'deck' }[action] || ''}"]`);
    await sparkTo(isShown(btn) ? btn : screen, { color: '#93c5fd', size: 16, duration: 380, burst: 8 });
    pressKey(key);
    return report(cmd, true, '');
}

async function runQuiz(cmd, { action, index }) {
    const modal = document.getElementById('quiz-of-week-modal');
    if (!modal || modal.classList.contains('hidden')) return report(cmd, false, 'Quiz of the Week is not on screen');
    if (action === 'answer') {
        const btn = modal.querySelector(`.qs-answer[data-answer-index="${index}"]`);
        if (!btn || btn.disabled) return report(cmd, false, 'That answer is closed');
        await sparkTo(btn, { color: '#fde047', size: 24, duration: 520, burst: 18 });
        pressKey(String(index + 1));
        return report(cmd, true, '');
    }
    if (action === 'skip') {
        const btn = document.getElementById('quiz-skip-btn');
        if (!isShown(btn)) return report(cmd, false, 'Nothing to skip');
        await sparkAndClick(btn);
        return report(cmd, true, '');
    }
    const key = { next: 'Enter', listen: 'l', close: 'Escape' }[action];
    const target = action === 'next'
        ? ['quiz-next-btn', 'quiz-begin-btn', 'quiz-finish-btn'].map((id) => document.getElementById(id)).find(isShown)
        : action === 'listen' ? document.getElementById('quiz-listen-btn') : null;
    await sparkTo(target || modal, { size: 18, duration: 420, burst: 10 });
    pressKey(key);
    return report(cmd, true, '');
}

// ─── Timer & Blackout (projector overlays) ──────────────────────────────────

let timer = null;

function runTimer(cmd, p) {
    if (p.action === 'start') startTimer(Math.round(p.seconds), timerLabel(p.seconds));
    else if (p.action === 'stop') stopTimer();
    else if (p.action === 'pause') pauseTimer(true);
    else if (p.action === 'resume') pauseTimer(false);
    else if (p.action === 'add' && timer) startTimer(Math.round(timer.remaining() / 1000) + 30, timer.label, timer.total + 30);
    return report(cmd, true, '');
}

function timerLabel(seconds) {
    return { 30: 'Think', 60: 'Pair', 90: 'Share' }[seconds] || 'Timer';
}

function startTimer(seconds, label, totalSeconds = seconds) {
    stopTimer({ keepNode: true });
    let el = document.getElementById('qr-timer');
    if (!el) {
        el = document.createElement('div');
        el.id = 'qr-timer';
        el.className = `qr-timer${LITE ? ' qr-lite' : ''}`;
        el.dataset.qrIgnore = '';
        el.setAttribute('role', 'timer');
        document.body.appendChild(el);
    }
    const endsAt = performance.now() + seconds * 1000;
    timer = {
        label, total: totalSeconds, endsAt, pausedLeft: null, el,
        remaining() { return this.pausedLeft ?? Math.max(0, this.endsAt - performance.now()); }
    };
    el.innerHTML = timerHtml({ label, seconds: totalSeconds, remainingMs: seconds * 1000 });
    el.classList.remove('is-done', 'is-final', 'is-leaving');
    requestAnimationFrame(() => el.classList.add('is-in'));
    sparkTo(el, { color: '#fb923c', size: 20, duration: 500, burst: 12 });
    playSound('magic_chime_short');
    timer.tick = setInterval(tickTimer, 250);
    scheduleStage(0);
}

function tickTimer() {
    if (!timer) return;
    const left = timer.remaining();
    const clock = timer.el.querySelector('[data-qr-clock]');
    const text = formatTimerClock(left);
    if (clock && clock.textContent !== text) clock.textContent = text;
    timer.el.classList.toggle('is-final', left > 0 && left <= 5000);
    if (left <= 0 && !timer.done) {
        timer.done = true;
        timer.el.classList.add('is-done');
        clock && (clock.textContent = 'Time!');
        playSound('magic_chime');
        burstOn(timer.el, { color: '#fb923c', count: 28 });
        setTimeout(() => { if (timer?.done) stopTimer(); }, 4000);
        scheduleStage(0);
    }
}

function pauseTimer(pause) {
    if (!timer || timer.done) return;
    const ring = timer.el.querySelector('.qr-timer__ring');
    if (pause && timer.pausedLeft == null) {
        timer.pausedLeft = timer.remaining();
        ring?.classList.add('is-paused');
    } else if (!pause && timer.pausedLeft != null) {
        timer.endsAt = performance.now() + timer.pausedLeft;
        timer.pausedLeft = null;
        ring?.classList.remove('is-paused');
    }
    scheduleStage(0);
}

function stopTimer({ keepNode = false } = {}) {
    if (timer) clearInterval(timer.tick);
    timer = null;
    if (keepNode) return;
    const el = document.getElementById('qr-timer');
    if (!el) return;
    el.classList.add('is-leaving');
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 420);
    scheduleStage(0);
}

function timerState() {
    if (!timer) return null;
    return { label: timer.label, total: timer.total, remainingMs: Math.round(timer.remaining()), paused: timer.pausedLeft != null, done: Boolean(timer.done) };
}

function setBlackout(on) {
    let el = document.getElementById('qr-curtain');
    if (on) {
        if (!el) {
            el = document.createElement('div');
            el.id = 'qr-curtain';
            el.className = `qr-curtain${LITE ? ' qr-lite' : ''}`;
            el.dataset.qrIgnore = '';
            el.setAttribute('role', 'dialog');
            el.setAttribute('aria-label', 'Eyes on me');
            el.innerHTML = curtainHtml({ lite: LITE });
            el.addEventListener('click', () => setBlackout(false));
            document.body.appendChild(el);
            requestAnimationFrame(() => el.classList.add('is-down'));
            playSound('magic_chime_short');
        }
    } else if (el) {
        el.classList.remove('is-down');
        el.classList.add('is-lifting');
        setTimeout(() => el.remove(), isStillFx() ? 0 : 700);
    }
    scheduleStage(0);
}

// ─── Stage: what the Wand sees ──────────────────────────────────────────────

/** The top-most surface on screen: an open overlay (window, show, ceremony) or the active tab. */
function topOverlay() {
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    const points = [[0.5, 0.5], [0.5, 0.25], [0.25, 0.6], [0.75, 0.6]];
    for (const [px, py] of points) {
        const stack = document.elementsFromPoint(w * px, hgt * py);
        const el = stack.find((n) => !n.closest('[data-qr-ignore]'));
        for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
            if (n.classList?.contains('app-tab')) break;
            const cs = getComputedStyle(n);
            if ((cs.position === 'fixed' || cs.position === 'absolute' && n.parentElement === document.body)
                && n.offsetWidth >= w * 0.45 && n.offsetHeight >= hgt * 0.45) return n;
        }
    }
    return null;
}

function findSurface() {
    const overlay = topOverlay();
    if (overlay) return { el: overlay, kind: 'overlay' };
    const tab = document.querySelector('.app-tab:not(.hidden)');
    return { el: tab || document.body, kind: 'tab' };
}

function surfaceTitle(surface) {
    if (surface.kind === 'tab') return CAST_TABS.find((t) => t.tab === surface.el.id)?.label || '';
    const aria = surface.el.getAttribute('aria-label');
    if (aria) return aria;
    const labelledBy = surface.el.getAttribute('aria-labelledby');
    const labelled = labelledBy && document.getElementById(labelledBy)?.textContent;
    if (labelled) return labelled;
    const heading = surface.el.querySelector('h1, h2, [role="heading"], .font-title');
    return heading?.textContent || '';
}

function iconOf(el) {
    if (el.dataset.remoteIcon) return el.dataset.remoteIcon;
    const i = el.querySelector('i[class*="fa-"]');
    if (!i) return '';
    return [...i.classList].find((c) => c.startsWith('fa-') && !['fa-solid', 'fa-regular', 'fa-brands', 'fa-spin', 'fa-fw'].includes(c)) || '';
}

function labelOf(el) {
    return el.dataset.remote || el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '';
}

function collectPad(surface) {
    const items = [];
    const nodes = surface.el.querySelectorAll('button, [role="button"], a[href^="#"], [data-remote]');
    for (const el of nodes) {
        if (items.length > 90) break;
        if (el.closest('[data-remote-skip], [data-qr-ignore], #award-stars-student-list')) continue;
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
        if (!el.getClientRects().length) continue;
        const explicit = el.hasAttribute('data-remote');
        const label = labelOf(el);
        if (!explicit && DANGER_RE.test(label)) continue;
        if (!explicit && /(^|\s)(hidden|sr-only)(\s|$)/.test(el.className || '')) continue;
        let id = host.elIds.get(el);
        if (!id) {
            id = `p${(host.padSeq += 1).toString(36)}`;
            host.elIds.set(el, id);
        }
        host.pad.set(id, new WeakRef(el));
        const cls = String(el.className || '');
        items.push({
            id, label, icon: iconOf(el), explicit,
            group: el.dataset.remoteGroup || '',
            order: Number(el.dataset.remoteOrder),
            primary: explicit ? el.dataset.remotePrimary === 'true' : /(primary|success|hero|gold|cta)/i.test(cls),
            danger: DANGER_RE.test(label)
        });
    }
    // forget buttons that are gone
    if (host.pad.size > 400) {
        for (const [key, ref] of host.pad) if (!ref.deref()?.isConnected) host.pad.delete(key);
    }
    return items;
}

function panelFor() {
    const picker = document.getElementById('fair-picker-modal');
    if (picker && !picker.classList.contains('hidden')) {
        const stage = picker.querySelector('.fpk-stage');
        return {
            kind: 'picker',
            name: picker.querySelector('[data-fpk-name]')?.textContent?.trim() || '',
            call: picker.querySelector('.fpk-call')?.textContent?.trim() || '',
            rolling: Boolean(stage?.classList.contains('is-rolling')),
            canPass: Boolean(picker.querySelector('[data-fpk-pass]')),
            progress: picker.querySelector('.fpk-progress__label')?.textContent?.trim() || ''
        };
    }
    const wheel = document.getElementById('fortunes-wheel-modal');
    if (wheel && !wheel.classList.contains('hidden')) {
        const nextBtn = ['fw-reveal-primary-btn', 'fw-next-btn', 'fw-done-btn'].map((id) => document.getElementById(id)).find(isShown);
        return {
            kind: 'wheel',
            ready: isShown(document.getElementById('fw-spin-btn')) && !document.getElementById('fw-spin-btn')?.disabled,
            caption: document.getElementById('fw-stage-caption')?.textContent?.trim() || '',
            next: nextBtn ? nextBtn.textContent.trim() : ''
        };
    }
    const wall = document.getElementById('dynamic-wallpaper-screen');
    if (wall && !wall.classList.contains('hidden')) return { kind: 'wall', pinned: wall.querySelector('[data-wall-action="pause"]')?.getAttribute('aria-pressed') === 'true' };
    const dragon = document.getElementById('quiet-dragon-stage') || document.querySelector('.qd-stage');
    if (dragon) return { kind: 'dragon', phase: dragon.dataset.phase || '' };
    return null;
}

async function quizPanel() {
    const modal = document.getElementById('quiz-of-week-modal');
    if (!modal || modal.classList.contains('hidden')) return null;
    const ui = await import('../../ui/modals/quizOfTheWeek.js');
    const view = ui.getQuizRemoteView();
    if (!view.open) return null;
    const panel = { kind: 'quiz', screen: view.screen };
    let secret = null;
    if (view.screen === 'turn') {
        const core = await import('../quizOfTheWeek.js');
        const turn = core.getActiveTurn(view.classId);
        const cue = modal.querySelector('.qs-cue');
        panel.question = (cue?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 118);
        panel.student = turn?.student?.name ? String(turn.student.name).split(' ')[0] : '';
        panel.options = [...modal.querySelectorAll('.qs-answer')].slice(0, 4).map((b) => ({
            text: (b.querySelector('.qs-answer__text')?.textContent || b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70),
            closed: Boolean(b.disabled)
        }));
        panel.progress = turn ? `${(turn.answeredCount || 0) + 1} / ${turn.totalQuestions || '?'}` : '';
        if (turn?.question && Number.isInteger(turn.question.correctIndex)) secret = { quizCorrect: turn.question.correctIndex };
    }
    panel.canNext = ['quiz-next-btn', 'quiz-begin-btn', 'quiz-finish-btn'].some((id) => isShown(document.getElementById(id)));
    panel.canSkip = isShown(document.getElementById('quiz-skip-btn'));
    return { panel, secret };
}

function scheduleStage(delay = 250) {
    if (!host) return;
    if (host.stageTimer) return;
    const since = performance.now() - host.lastStageAt;
    const delayMs = Math.max(delay, STAGE_MIN_INTERVAL_MS - since, 0);
    host.stageTimer = setTimeout(() => {
        if (!host) return;
        host.stageTimer = 0;
        publishStage().catch((error) => console.warn('Quest Remote stage', error));
    }, delayMs);
}

async function publishStage() {
    if (!host) return;
    const surface = findSurface();
    let panel = panelFor();
    let secret = null;
    const quiz = await quizPanel();
    if (quiz) { panel = quiz.panel; secret = quiz.secret; }
    const showdownMod = document.getElementById('qr-showdown') ? await import('./showdown.js') : null;
    const sdPanel = showdownMod?.getShowdownPanel?.();
    if (sdPanel) panel = sdPanel;

    const stage = buildStageSummary({
        surface: sdPanel ? 'showdown' : surface.kind === 'tab' ? 'tab' : 'overlay',
        tab: activeTabId(),
        title: sdPanel ? 'Showdown Arena' : surfaceTitle(surface),
        classId: state.get('globalSelectedClassId') || '',
        padActions: sdPanel ? [] : collectPad(surface),
        panel,
        lastResult: host.lastResult,
        scrollable: Boolean(scrollContainerOf(surface.el)) || document.documentElement.scrollHeight > window.innerHeight + 40
    });
    stage.timer = timerState();
    // What the class actually sees: a covering window hides the tab underneath (the Wand words its hints by this).
    stage.covered = !sdPanel && surface.kind === 'overlay';
    stage.blackout = Boolean(document.getElementById('qr-curtain'));
    stage.wall = Boolean(document.getElementById('dynamic-wallpaper-screen') && !document.getElementById('dynamic-wallpaper-screen').classList.contains('hidden'));
    // timer remaining changes every tick: leave it out of the "did anything change" check
    const fp = stageFingerprint({ ...stage, timer: stage.timer ? { ...stage.timer, remainingMs: Math.round(stage.timer.remainingMs / 5000) } : null, secret });
    if (fp === host.lastFp) return;
    host.lastFp = fp;
    host.lastStageAt = performance.now();
    const patch = { stage, classId: stage.classId, secret: secret || {} };
    await channel.updateHostSession(host.id, patch);
}

export { scheduleStage as requestQuestRemoteStage };
