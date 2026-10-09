// features/questRemote/remoteWand.js — Quest Remote, the Wand (the teacher's phone), lazy.
//
// The phone never writes to the economy: it sends small commands (remoteChannel.js) that the
// projector runs through the app's own buttons (remoteHost.js). The Wand answers every touch at
// once (haptics, local animation) and then shows the projector's confirmation.
// Gestures: Star Flick (award), Hold to Crown, Wheel Slingshot, Shake to Summon, swipe the deck.
// Markup: remoteWandView.mjs. Styles: styles/quest_remote_wand.css.

import '../../styles/quest_remote_wand.css';
import * as state from '../../state.js';
import { canUseFeature } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { FEATURE_DEFINITIONS, getUpgradeMessage, TAB_FEATURE_FLAGS } from '../../config/tiers/features.js';
import { getTodayDateString } from '../../utils.js';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import * as channel from './remoteChannel.js';
import {
    validateCommand, CLASS_GENERAL, CLASS_FOLLOW, classifyFlick, slingshotPower, SLINGSHOT_MIN_POWER, createShakeDetector,
    isHostLive, HEARTBEAT_MS, HOST_LIVE_MS, formatTimerClock, clampTimerMinutes, pushSpellLog,
    SHOWDOWN_SPLITS, SHOWDOWN_GOAL_MIN, SHOWDOWN_GOAL_MAX, normalizeShowdownRules, forgeShowdownTeams, showdownTeamLooks,
    packShowdownTeams, isGrowthLeague
} from './remoteCore.mjs';
import { makeTeams, moveHero, teamBanner, teamsForDay, pastTeamSets, clampTeamCount, suggestTeamCount, MIN_TEAMS, MAX_TEAMS } from '../teamMakerCore.mjs';
import { getGuildById } from '../guilds.js';
import {
    wandShellHtml, nowStripHtml, chooserHtml, starsHtml, awardSheetHtml, classSheetHtml, stageHtml, magicHtml, lessonHtml, showHtml,
    spellsSheetHtml, WAND_MODES
} from './remoteWandView.mjs';
import { morphInto } from './wandMorph.mjs';

const LITE = (() => { try { return detectLowPowerTier(); } catch { return false; } })();
const STILL = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
const ROOT_ID = 'quest-wand';
const HOLD_MS = 1500;

let wand = null;

const buzz = (pattern) => { try { navigator.vibrate?.(pattern); } catch { /* not on iOS */ } };

// ─── Open / close ───────────────────────────────────────────────────────────

export async function openWand({ sessionId = '' } = {}) {
    if (!canUseFeature('questRemote')) {
        showUpgradePrompt({ feature: FEATURE_DEFINITIONS.questRemote.name, tier: 'Pro', message: getUpgradeMessage('Pro', 'questRemote') });
        return;
    }
    if (wand) {
        if (sessionId && sessionId !== wand.sessionId) await connect(sessionId);
        return;
    }
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = `qw${LITE ? ' qw-lite' : ''}${STILL ? ' qw-still' : ''}`;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Quest Remote');
    root.dataset.phase = 'choose';
    root.innerHTML = wandShellHtml({ lite: LITE });
    document.body.appendChild(root);
    document.body.classList.add('qw-open');

    wand = {
        root,
        main: root.querySelector('[data-qw-main]'),
        sheet: root.querySelector('[data-qw-sheet]'),
        mode: savedMode(),
        multi: false,
        picked: new Set(),
        padOpen: false,
        lastHtml: '',
        lastNow: '',
        sessionId: '',
        code: '',
        wandId: `wand${Math.random().toString(36).slice(2, 10)}`,
        boundWandId: '',
        seq: 0,
        stage: null,
        secret: null,
        hostSeenAt: 0,
        hostBeat: NaN,
        lastResultSeq: 0,
        lastPanelKind: '',
        sheetKind: '',
        award: { heroIds: [], reason: '', size: 'auto' },
        pending: new Map(),
        classOverride: '',
        gesture: false,
        renderQueued: false,
        timers: [],
        unsub: null,
        wakeLock: null,
        shake: createShakeDetector(),
        motionOn: false,
        waiting: savedFlag(WAITING_KEY),
        customMinutes: savedMinutes(),
        spells: [],
        forge: savedForge(),
        sdPoints: 1,
        sdReward: { scope: 'winners', stars: 1 },
        connectSeq: 0,
        gestures: new Set(),
        retry: 0
    };
    wand.returnFocus = document.activeElement;
    wireEvents(root);
    // Page and network listeners live as long as the Wand (not one set per projector bound).
    wand.onVisible = () => {
        if (!wand) return;
        if (document.hidden) { cancelGestures(); return; }
        if (wand.root.dataset.phase !== 'bound' || !wand.sessionId) return;
        requestWakeLock();
        channel.beatWand(wand.sessionId).catch(() => {});
        syncLink();
    };
    wand.onNet = () => syncLink();
    document.addEventListener('visibilitychange', wand.onVisible);
    window.addEventListener('online', wand.onNet);
    window.addEventListener('offline', wand.onNet);
    requestAnimationFrame(() => root.classList.add('is-in'));
    root.querySelector('[data-qw="leave"]')?.focus({ preventScroll: true });
    if (sessionId) await connect(sessionId);
    else await showChooser();
}

export async function closeWand({ quiet = false, release = true } = {}) {
    if (!wand) return;
    const w = wand;
    // Hand the projector back before everything is torn down: the PC's wand goes dark at once.
    if (release) releaseProjector(w);
    cancelGestures();
    wand = null;
    w.connectSeq += 1;
    w.unsub?.();
    w.timers.forEach((t) => clearInterval(t));
    stopMotion(w);
    try { await w.wakeLock?.release(); } catch { /* already released */ }
    document.removeEventListener('visibilitychange', w.onVisible);
    window.removeEventListener('online', w.onNet);
    window.removeEventListener('offline', w.onNet);
    document.body.classList.remove('qw-open');
    try { if (w.returnFocus?.isConnected) w.returnFocus.focus({ preventScroll: true }); } catch { /* gone */ }
    if (/wand=/.test(location.hash)) {
        try { history.replaceState(null, '', `${location.pathname}${location.search}`); } catch { /* ignore */ }
    }
    if (quiet || STILL) { w.root.remove(); return; }
    w.root.classList.remove('is-in');
    w.root.classList.add('is-leaving');
    setTimeout(() => w.root.remove(), 360);
}

async function showChooser(error = '') {
    if (!wand) return;
    wand.root.dataset.phase = 'choose';
    wand.main.innerHTML = chooserHtml([], { loading: true });
    setLink('connecting', 'Looking for projectors…');
    try {
        const sessions = await channel.listLiveSessions();
        if (!wand) return;
        if (sessions.length === 1 && !error) { await connect(sessions[0].id); return; }
        wand.main.innerHTML = chooserHtml(sessions, { error });
        setLink('asleep', sessions.length ? 'Choose a projector' : 'No projector awake');
    } catch (e) {
        console.warn('Quest Remote: list failed', e);
        if (wand) wand.main.innerHTML = chooserHtml([], { error: isRefused(e) ? RULES_TEXT : 'Could not reach the school. Check the connection.' });
        setLink(isRefused(e) ? 'asleep' : 'offline', isRefused(e) ? 'Refused by the school rules' : 'No connection');
    }
}

const RULES_TEXT = 'The school rules refused the Wand. They need updating (firestore rules deploy).';
const isRefused = (e) => e?.code === 'permission-denied';

/** While a projector is bound, the X is the disconnect: it hands the projector back and closes. */
function setLeaveLabel(bound) {
    const btn = wand?.root.querySelector('[data-qw="leave"]');
    if (!btn) return;
    const label = bound ? 'Disconnect and put the Wand down' : 'Put the Wand down';
    btn.setAttribute('aria-label', label);
    btn.title = label;
}

/**
 * Tells the projector the Wand is leaving (fire and forget: the PC also notices a silent phone,
 * this just makes it instant). Only ours to give back — a phone that took over keeps it.
 */
function releaseProjector(w = wand) {
    if (!w?.sessionId || w.boundWandId !== w.wandId) return;
    const id = w.sessionId;
    w.boundWandId = '';
    channel.releaseWand(id).catch(() => { /* the heartbeat going stale ends it anyway */ });
}

/** Forgets everything about the projector the Wand was bound to (closed, lost, or swapped). */
function endSession(w = wand) {
    if (!w) return;
    setLeaveLabel(false);
    cancelGestures();
    w.unsub?.();
    w.unsub = null;
    w.timers.forEach((t) => clearInterval(t));
    w.timers = [];
    w.sessionId = '';
    stopMotion(w);
    try { w.wakeLock?.release(); } catch { /* already released */ }
    w.wakeLock = null;
    if (w.sheetKind) closeSheet();
    Object.assign(w, {
        stage: null, secret: null, hostId: '', boundWandId: '', classOverride: '', classOverrideAt: 0, multi: false,
        timerKey: '', timerBase: null, clockId: 0, clockBase: null, lastPanelKind: '', lastNow: '', lastHtml: '', centredTab: ''
    });
    w.pending.clear();
    w.picked.clear();
}

async function connect(sessionId) {
    if (!wand) return;
    const w = wand;
    const token = (w.connectSeq += 1);
    // a double tap, a QR link or a retry can start a second bind: only the newest one goes on
    const stale = () => wand !== w || w.connectSeq !== token;
    // Moving to another projector: give the old one back instead of leaving it looking bound.
    if (w.sessionId && w.sessionId !== sessionId) releaseProjector(w);
    endSession(w);
    w.root.dataset.phase = 'choose';
    w.main.innerHTML = chooserHtml([], { loading: true });
    setLink('connecting', 'Binding…');
    let data = null;
    let refused = false;
    try { data = await channel.readSession(sessionId); } catch (e) { refused = isRefused(e); data = null; }
    if (stale()) return;
    if (!data || data.closed || data.teacherId !== state.get('currentUserId')) {
        await showChooser(refused ? RULES_TEXT : 'That projector is not awake any more. Press the wand button on the classroom computer.');
        return;
    }
    try {
        await channel.bindWand(sessionId, w.wandId);
    } catch (e) {
        console.warn('Quest Remote: bind failed', e);
        if (!stale()) await showChooser(isRefused(e) ? RULES_TEXT : 'The Wand could not bind. Try again.');
        return;
    }
    if (stale()) return;
    w.sessionId = sessionId;
    w.boundWandId = w.wandId;
    w.code = data.code || '';
    w.hostSeenAt = Date.now();
    w.root.dataset.phase = 'bound';
    w.unsub = channel.watchSession(sessionId, (d, meta) => { if (!stale()) { w.retry = 0; onSession(d, meta); } }, () => {
        // The live link broke (network, token refresh): bind again instead of showing a frozen Wand.
        if (stale()) return;
        setLink('offline', 'Connection lost · trying again');
        const delay = Math.min(30_000, 3000 * 2 ** w.retry);
        w.retry = Math.min(4, w.retry + 1);
        setTimeout(() => { if (!stale()) connect(sessionId); }, delay);
    });
    w.timers.push(setInterval(() => {
        if (stale()) return;
        channel.beatWand(w.sessionId).catch(() => {});
        syncLink();
    }, HEARTBEAT_MS));
    w.timers.push(setInterval(() => { if (wand?.mode === 'stars' && !wand.sheetKind) refreshRosterIfChanged(); }, 1500));
    w.timers.push(setInterval(() => tickClocks(), 1000));
    requestWakeLock();
    send('bind', {});
    buzz([20, 60, 30]);
    setLeaveLabel(true);
    w.root.classList.add('is-bound');
    setTimeout(() => wand?.root.classList.remove('is-bound'), 1400);
    setMode(w.mode);
}

async function requestWakeLock() {
    try {
        if (!wand || !('wakeLock' in navigator) || document.hidden) return;
        wand.wakeLock = await navigator.wakeLock.request('screen');
    } catch { /* not allowed: the screen may dim, the Wand still works */ }
}

// ─── Session updates ────────────────────────────────────────────────────────

function onSession(data, { fromCache = false } = {}) {
    if (!wand) return;
    if (!data || data.closed) {
        setLink('asleep', 'The projector put the Wand to sleep');
        wand.root.dataset.phase = 'choose';
        endSession();
        const token = wand.connectSeq;
        setTimeout(() => { if (wand && wand.connectSeq === token) showChooser('The projector put the Wand to sleep.'); }, 1200);
        return;
    }
    // Another phone bound to the same projector: that one has it now, this one steps back.
    if (!fromCache && data.wandId && data.wandId !== wand.wandId) {
        wand.boundWandId = data.wandId;
        setLink('asleep', 'Another phone took the Wand');
        wand.root.dataset.phase = 'choose';
        endSession();
        const taken = wand.connectSeq;
        setTimeout(() => { if (wand && wand.connectSeq === taken) showChooser('Another phone is holding the Wand now.'); }, 1200);
        return;
    }
    if (data.wandId && !fromCache) wand.boundWandId = data.wandId;
    // The projector reloaded (a new host on the same session): answer at once so it knows the Wand is here.
    if (data.hostId && wand.hostId && data.hostId !== wand.hostId) channel.beatWand(wand.sessionId).catch(() => {});
    wand.hostId = data.hostId || '';
    const beat = channel.toMs(data.hostHeartbeatAt);
    if (beat !== wand.hostBeat) { wand.hostBeat = beat; wand.hostSeenAt = Date.now(); }
    const prevPanel = wand.stage?.panel?.kind || '';
    const prevClass = currentClassId();
    wand.stage = data.stage || null;
    wand.secret = data.secret || null;
    syncClocks();
    // The class asked for has arrived, or never will (refused or lost): the projector's class wins.
    if (wand.classOverride && (wand.stage?.classId === wand.classOverride || Date.now() - wand.classOverrideAt > 10_000)) wand.classOverride = '';
    if (currentClassId() !== prevClass) {
        // Another class is in the room: last class's picks and award sheet go.
        wand.picked.clear();
        wand.multi = false;
        if (wand.sheetKind === 'award') closeSheet();
    }
    syncLink();
    showResult(wand.stage?.lastResult);

    // A show appearing on the projector brings its controls forward.
    const kind = wand.stage?.panel?.kind || '';
    if (kind && kind !== prevPanel && kind !== wand.lastPanelKind) {
        wand.lastPanelKind = kind;
        const target = kind === 'quiz' || kind === 'showdown' ? 'show' : 'stage';
        if (wand.mode !== target && wand.mode !== 'stars') setMode(target);
        else if (wand.mode === 'stars' && (kind === 'quiz' || kind === 'showdown')) setMode(target);
        else render();
        buzz(12);
        return;
    }
    if (!kind) wand.lastPanelKind = '';
    if (wand.stage?.panel?.kind === 'picker' || wand.mode === 'magic') startMotion(); else stopMotion(wand);
    render();
}

function syncLink() {
    if (!wand || wand.root.dataset.phase !== 'bound') return;
    if (!navigator.onLine) { setLink('offline', 'No connection'); return; }
    const live = isHostLive(wand.hostSeenAt, Date.now(), HOST_LIVE_MS);
    if (live) setLink('bound', `Bound · ${String(wand.code).split('').join(' ')}`);
    else setLink('asleep', 'The projector is not answering');
}

function setLink(stateName, text) {
    const link = wand?.root.querySelector('[data-qw-link]');
    if (!link) return;
    link.dataset.state = stateName;
    const t = link.querySelector('[data-qw-link-text]');
    if (t && t.textContent !== text) t.textContent = text;
}

let toastTimer = 0;
function toast(message, kind = 'ok', { action = null } = {}) {
    const el = wand?.root.querySelector('[data-qw-toast]');
    if (!el || !message) return;
    el.dataset.kind = kind;
    el.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = message;
    el.appendChild(span);
    if (action) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'qw-toast__btn';
        btn.textContent = action.label;
        btn.addEventListener('click', () => { action.run(); el.classList.remove('is-on'); });
        el.appendChild(btn);
    }
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), action ? 8000 : 2600);
}

function showResult(result) {
    if (!wand || !result || !Number.isInteger(result.seq) || result.seq <= wand.lastResultSeq) return;
    if (result.seq > wand.seq) return; // a result for an earlier Wand on this session
    wand.lastResultSeq = result.seq;
    if (result.message) wand.spells = pushSpellLog(wand.spells, { at: Date.now(), ok: result.ok, text: result.message });
    if (wand.sheetKind === 'spells') wand.sheet.innerHTML = spellsSheetHtml(wand.spells, Date.now(), { bound: wand.root.dataset.phase === 'bound' });
    if (!result.ok) {
        // The projector said no: undo anything shown optimistically.
        wand.pending.clear();
        wand.classOverride = '';
        if (wand.mode === 'stars') render();
        buzz([40, 50, 40]);
        if (result.message) toast(result.message, 'warn');
        return;
    }
    if (result.message && !wand.suppressNextOk) toast(result.message, 'ok');
    wand.suppressNextOk = false;
}

// ─── Sending ────────────────────────────────────────────────────────────────

function send(type, payload = {}) {
    if (!wand?.sessionId) return false;
    const cmd = { type, payload, clientSeq: (wand.seq + 1), wandId: wand.wandId };
    if (!validateCommand(cmd).ok) return false;
    // Firestore would quietly queue a spell sent offline and the projector would drop it as too old:
    // say so now instead of showing a star "on its way" that never lands.
    if (type !== 'bind') {
        if (!navigator.onLine) { buzz([40, 50, 40]); toast('No connection: nothing was sent', 'warn'); return false; }
        if (!isHostLive(wand.hostSeenAt, Date.now(), HOST_LIVE_MS)) { buzz([40, 50, 40]); toast('The projector is not answering: nothing was sent', 'warn'); return false; }
    }
    wand.seq += 1;
    channel.sendCommand(wand.sessionId, cmd).catch((e) => {
        console.warn('Quest Remote: send failed', e);
        if (!wand) return;
        if (type === 'award' && payload.studentId) { wand.pending.delete(payload.studentId); render(); }
        // Refused (not offline): the school's Firestore rules are older than this Wand.
        toast(isRefused(e) ? 'The projector refused this spell: the school rules need updating' : 'Not sent: check the connection', 'warn');
    });
    return true;
}

// ─── Rendering ──────────────────────────────────────────────────────────────

const MODE_KEY = 'gcq.questRemote.mode';
const WAITING_KEY = 'gcq.questRemote.waiting';
const MINUTES_KEY = 'gcq.questRemote.minutes';

function savedFlag(key) {
    try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

function savedMinutes() {
    try { return clampTimerMinutes(localStorage.getItem(MINUTES_KEY) ?? 3); } catch { return 3; }
}

function remember(key, value) {
    try { localStorage.setItem(key, String(value)); } catch { /* this session only */ }
}
// ─── The Team Forge (Show mode, before a Showdown) ──────────────────────────
// The teams are built on the phone from the roster it already has: nothing is written until Start,
// so trying splits, shuffling and moving heroes costs no Firestore writes at all.

const FORGE_KEY = 'gcq.questRemote.forge';

function savedForge() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(FORGE_KEY) || '{}') || {}; } catch { saved = {}; }
    return {
        split: SHOWDOWN_SPLITS.includes(saved.split) ? saved.split : 'fair',
        count: Number(saved.count) || 0,
        rules: normalizeShowdownRules(saved.rules),
        teams: null,
        sig: '',
        present: ''
    };
}

function rememberForge() {
    const f = wand?.forge;
    if (!f) return;
    try { localStorage.setItem(FORGE_KEY, JSON.stringify({ split: f.split, count: f.count, rules: f.rules })); } catch { /* this session only */ }
}

function classObj(classId) {
    return (state.get('allTeachersClasses') || []).find((c) => c.id === classId)
        || (state.get('allSchoolClasses') || []).find((c) => c.id === classId) || null;
}

/** The class's heroes with what the Forge needs: first name, guild, this month's stars, away today. */
function forgeRoster(classId) {
    const today = getTodayDateString();
    const away = new Set((state.get('allAttendanceRecords') || []).filter((r) => r.classId === classId && r.date === today).map((r) => r.studentId));
    const scores = new Map((state.get('allStudentScores') || []).map((x) => [x.id, x]));
    return (state.get('allStudents') || [])
        .filter((x) => x.classId === classId)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
        .map((x) => ({
            id: x.id, first: String(x.name || 'Hero').split(/\s+/)[0], guildId: x.guildId || '',
            stars: Number(scores.get(x.id)?.monthlyStars) || 0, away: away.has(x.id)
        }));
}

/**
 * Builds (or keeps) the Forge's teams and returns the model the view draws. Teams are re-dealt when
 * the class, the split or the team count changes, or on Shuffle; a hero marked away leaves their team
 * and a hero who arrives joins the smallest one, so the teacher's own moves are kept.
 */
function forgeModel({ reroll = false } = {}) {
    const classId = currentClassId();
    if (!classId || !wand) return null;
    const f = wand.forge;
    const cls = classObj(classId);
    const heroes = forgeRoster(classId);
    const here = heroes.filter((h) => !h.away);
    const today = teamsForDay(cls?.teamMaker, getTodayDateString());
    const canToday = forgeShowdownTeams({ heroes, split: 'today', today }).length >= 2;
    const canGuilds = new Set(here.map((h) => h.guildId).filter(Boolean)).size >= 2;
    if ((f.split === 'today' && !canToday) || (f.split === 'guilds' && !canGuilds)) f.split = 'fair';
    const maxCount = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, here.length));
    f.count = clampTeamCount(f.count || suggestTeamCount(here.length), here.length) || MIN_TEAMS;
    const counted = f.split === 'fair' || f.split === 'mixed' || f.split === 'random';
    const sig = `${classId}|${f.split}|${counted ? f.count : ''}`;
    const present = here.map((h) => h.id).join(',');
    const pastSets = pastTeamSets(cls?.teamMaker);
    if (reroll || sig !== f.sig || !f.teams) {
        f.teams = forgeShowdownTeams({ heroes, split: f.split, count: f.count, today, pastSets, makeTeams });
        f.sig = sig;
        f.present = present;
    } else if (present !== f.present) {
        const hereIds = new Set(here.map((h) => h.id));
        const placed = new Set();
        f.teams = f.teams.map((t) => ({ ...t, ids: t.ids.filter((id) => hereIds.has(id) && !placed.has(id) && placed.add(id)) }));
        if (f.split !== 'today') {
            here.filter((h) => !placed.has(h.id)).forEach((h) => {
                const open = f.teams.filter((t) => !t.dragon);
                const home = (f.split === 'guilds' && open.find((t) => t.guild === h.guildId)) || open.reduce((a, b) => (b.ids.length < a.ids.length ? b : a), open[0]);
                home?.ids.push(h.id);
            });
        }
        f.present = present;
    }
    const byId = new Map(heroes.map((h) => [h.id, h]));
    const looks = showdownTeamLooks(f.split, f.teams, { guildOf: getGuildById, bannerOf: teamBanner, classLook: cls ? { name: cls.name, emoji: cls.logo } : null });
    const teams = f.teams.map((t, i) => ({
        ...looks[i],
        members: t.ids.map((id) => ({ id, first: byId.get(id)?.first || 'Hero' })),
        stars: Math.round(t.ids.reduce((sum, id) => sum + (byId.get(id)?.stars || 0), 0))
    }));
    return {
        className: classLabel(), here: here.length, away: heroes.length - here.length,
        split: f.split, count: f.count, minCount: MIN_TEAMS, maxCount, canToday, canGuilds,
        growth: isGrowthLeague(cls?.questLevel), teams, rules: f.rules,
        note: counted && pastSets.length ? 'Teammates from last time are kept apart where possible.' : (f.split === 'today' && !canToday ? 'No Team Maker teams today.' : '')
    };
}

/** Taps inside the Forge (and the finale's reward choice). True when the tap was the Forge's. */
function forgeTap(t) {
    const f = wand.forge;
    const split = t.closest('[data-qw-split]');
    if (split && !split.disabled) {
        if (f.split !== split.dataset.qwSplit) { f.split = split.dataset.qwSplit; f.teams = null; rememberForge(); }
        buzz(6); render(); return true;
    }
    const move = t.closest('[data-qw-move]');
    if (move && f.teams) {
        const id = move.dataset.qwMove;
        const from = f.teams.findIndex((x) => x.ids.includes(id));
        const open = f.teams.map((x, i) => (x.dragon ? -1 : i)).filter((i) => i >= 0);
        if (from < 0 || open.length < 2) return true;
        const to = open[(open.indexOf(from) + 1) % open.length];
        const moved = moveHero(f.teams.map((x) => x.ids), id, to);
        f.teams = f.teams.map((x, i) => ({ ...x, ids: moved[i] }));
        buzz(8); render(); return true;
    }
    const rule = t.closest('[data-qw-rule]');
    if (rule) {
        const key = rule.dataset.qwRule;
        const value = rule.dataset.value;
        if (key === 'reward-scope') wand.sdReward.scope = value;
        else if (key === 'reward-stars') wand.sdReward.stars = Number(value) || 1;
        else if (['streak', 'underdog', 'hotseat', 'autoClock'].includes(key)) f.rules = normalizeShowdownRules({ ...f.rules, [key]: !f.rules[key] });
        else f.rules = normalizeShowdownRules({ ...f.rules, [key]: key === 'clock' ? Number(value) : value });
        rememberForge(); buzz(6); render(); return true;
    }
    const pts = t.closest('[data-qw-points]');
    if (pts) { wand.sdPoints = Number(pts.dataset.qwPoints) || 1; buzz(6); render(); return true; }
    const act = t.closest('[data-qw]')?.dataset.qw;
    if (!act?.startsWith('forge-')) return false;
    if (act === 'forge-count-down' || act === 'forge-count-up') { f.count += act.endsWith('up') ? 1 : -1; rememberForge(); }
    else if (act === 'forge-goal-down' || act === 'forge-goal-up') {
        f.rules = normalizeShowdownRules({ ...f.rules, goalN: Math.min(SHOWDOWN_GOAL_MAX, Math.max(SHOWDOWN_GOAL_MIN, f.rules.goalN + (act.endsWith('up') ? 1 : -1))) });
        rememberForge();
    } else if (act === 'forge-shuffle') { forgeModel({ reroll: true }); buzz([10, 30, 10]); render(); return true; }
    else if (act === 'forge-new') { if (send('showdown', { action: 'close' })) { f.teams = null; buzz(10); } return true; }
    else if (act === 'forge-start') {
        const model = forgeModel();
        if (!model) return true;
        // the rules travel as one map: a command holds at most 12 keys
        const payload = { action: 'open', split: f.split, teams: packShowdownTeams(f.teams), rules: { ...f.rules } };
        if (send('showdown', payload)) { wand.sdPoints = 1; wand.sdReward = { scope: 'winners', stars: 1 }; buzz([20, 40, 60]); }
        return true;
    }
    buzz(6); render(); return true;
}

const MODES = new Set(WAND_MODES.map((m) => m.key));

function savedMode() {
    try { const m = localStorage.getItem(MODE_KEY); return MODES.has(m) ? m : 'stars'; } catch { return 'stars'; }
}

function setMode(mode) {
    if (!wand) return;
    // The new view slides in from the side its mode sits on, and the wand-tip glides under it.
    const order = WAND_MODES.map((m) => m.key);
    const from = order.indexOf(wand.root.dataset.mode || '');
    const to = Math.max(0, order.indexOf(mode));
    wand.root.dataset.dir = from < 0 || from === to ? 'none' : to > from ? 'right' : 'left';
    wand.root.style.setProperty('--mode-i', String(to));
    wand.mode = mode;
    wand.root.dataset.mode = mode;
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* this session only */ }
    wand.root.querySelectorAll('[data-qw-mode]').forEach((b) => {
        const on = b.dataset.qwMode === mode;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    if (mode !== 'stars') { wand.multi = false; wand.picked.clear(); }
    wand.padOpen = false;
    wand.lastHtml = '';
    wand.main.scrollTop = 0;
    if (mode === 'magic' || wand.stage?.panel?.kind === 'picker') startMotion(); else stopMotion(wand);
    render({ fresh: true });
}

/** Where a star will show on the projector, in one line (empty when it simply lands on the cloud). */
function starsNote(stage) {
    if (!stage) return '';
    if (stage.covered) return `Stars show as a golden ribbon over “${stage.title || 'the window'}”.`;
    if (stage.tab !== 'award-stars-tab') return 'Award Stars opens on the projector with your first star.';
    return '';
}

function render({ fresh = false } = {}) {
    if (!wand || wand.root.dataset.phase !== 'bound') return;
    if (wand.gesture || isTyping()) { wand.renderQueued = true; return; }
    const stage = wand.stage || {};
    let html = '';
    if (wand.mode === 'stars') {
        html = starsHtml(heroesNow(), {
            className: classLabel(),
            empty: wand.stage?.follow ? 'Following the schedule: no lesson right now, so the projector shows the General view.'
                : 'The projector is on the General view. Choose a class (top right) to see its heroes.',
            multi: wand.multi, picked: [...wand.picked], note: starsNote(wand.stage), waiting: wand.waiting
        });
    } else if (wand.mode === 'stage') {
        html = stageHtml(stage, { secret: wand.secret, castAllowed: (t) => !TAB_FEATURE_FLAGS[t.tab] || canUseFeature(TAB_FEATURE_FLAGS[t.tab]), padOpen: wand.padOpen });
    } else if (wand.mode === 'magic') {
        html = magicHtml(stage, { canCrown: canUseFeature('adventureLog'), canWheel: canUseFeature('guilds') });
    } else if (wand.mode === 'lesson') {
        html = lessonHtml(stage, { customMinutes: wand.customMinutes });
    } else {
        const showdownOn = stage.panel?.kind === 'showdown' || stage.panel?.kind === 'quiz';
        html = showHtml(stage, { secret: wand.secret, clock: showClockLeft(), forge: showdownOn ? null : forgeModel(), points: wand.sdPoints, reward: wand.sdReward });
    }
    // Only touch the page when something changed: no flicker, no lost taps, less work.
    const view = wand.main.firstElementChild;
    if (fresh || !view) {
        wand.lastHtml = html;
        wand.main.innerHTML = `<div class="qw-view qw-view--${wand.mode} is-fresh">${html}</div>`;
        wand.main.scrollTop = 0;
    } else if (html !== wand.lastHtml) {
        // Live update: change only what differs, so nothing flickers and running animations go on.
        wand.lastHtml = html;
        morphInto(view, html);
    }
    // The cloud of the screen on the projector is always in sight in the row of screens (only when
    // that screen changed, so a thumb scrolling the row is never pulled back).
    const onCloud = wand.main.querySelector('.qw-screens .qw-cloud.is-on');
    const onTab = onCloud?.dataset.tab || '';
    if (onCloud && (fresh || onTab !== wand.centredTab)) {
        const row = onCloud.parentElement;
        row.scrollTo({ left: Math.max(0, onCloud.offsetLeft - (row.clientWidth - onCloud.offsetWidth) / 2), behavior: fresh || STILL ? 'auto' : 'smooth' });
    }
    wand.centredTab = onTab;
    const now = nowStripHtml(wand.stage);
    if (now !== wand.lastNow) {
        wand.lastNow = now;
        const strip = wand.root.querySelector('[data-qw-now]');
        if (strip) { strip.innerHTML = now; strip.hidden = !now; }
    }
    const chip = wand.root.querySelector('[data-qw-class]');
    const label = classLabel() || (wand.stage ? 'General' : 'Class');
    wand.root.querySelector('[data-qw="class"]')?.classList.toggle('is-following', Boolean(wand.stage?.follow));
    if (chip && chip.textContent !== label) chip.textContent = label;
}

/** A field on the Wand has the keyboard: redrawing now would throw away what is being typed. */
function isTyping() {
    const a = document.activeElement;
    return Boolean(a && wand?.main.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}

/** The class on the projector ('' = General view). The projector decides; the phone's own pick never leaks in. */
function currentClassId() {
    if (wand?.classOverride) return wand.classOverride;
    if (wand?.stage) return wand.stage.classId || '';
    return state.get('globalSelectedClassId') || '';
}

function classLabel() {
    const id = currentClassId();
    const cls = (state.get('allTeachersClasses') || []).find((c) => c.id === id)
        || (state.get('allSchoolClasses') || []).find((c) => c.id === id);
    return cls ? `${cls.logo || ''} ${cls.name}`.trim() : '';
}

function heroesNow() {
    const classId = currentClassId();
    if (!classId) return [];
    const today = getTodayDateString();
    const stars = state.get('todaysStars') || {};
    const away = new Set((state.get('allAttendanceRecords') || []).filter((r) => r.classId === classId && r.date === today).map((r) => r.studentId));
    const now = Date.now();
    for (const [id, p] of wand.pending) if (now - p.at > 20_000) wand.pending.delete(id);
    return (state.get('allStudents') || [])
        .filter((s) => s.classId === classId)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
        .map((s) => {
            const saved = Number(stars[s.id]?.stars) || 0;
            const pending = wand.pending.get(s.id);
            return {
                id: s.id,
                first: String(s.name || 'Hero').split(/\s+/)[0],
                avatar: s.avatar || '',
                stars: pending ? pending.stars : saved,
                pending: Boolean(pending) && saved === 0,
                away: away.has(s.id)
            };
        });
}

function refreshRosterIfChanged() {
    if (!wand) return;
    const stars = state.get('todaysStars') || {};
    for (const id of wand.pending.keys()) if (Number(stars[id]?.stars) > 0) wand.pending.delete(id);
    render();
}

// ─── Clocks the phone runs itself ───────────────────────────────────────────
// The projector only writes a timer's start, pause, +30 s and end (and the Showdown clock's start),
// never every second. The phone counts down from the moment that news arrived. Heartbeat snapshots
// repeat the same stage, so they never reset the count.

function syncClocks() {
    if (!wand) return;
    const t = wand.stage?.timer;
    const key = t ? `${t.id ?? ''}|${t.label}|${t.total}|${t.paused}|${t.done}|${t.remainingMs}` : '';
    if (key !== wand.timerKey) {
        wand.timerKey = key;
        wand.timerBase = t ? { ms: Number(t.remainingMs) || 0, at: Date.now(), running: !t.paused && !t.done } : null;
    }
    if (t) t.remainingMs = timerLeftMs();
    const panel = wand.stage?.panel;
    const clock = panel?.kind === 'showdown' && Number.isInteger(panel.clock) ? panel.clock : 0;
    if (clock !== wand.clockId) {
        wand.clockId = clock;
        wand.clockBase = clock ? { from: Number(panel.clockFrom) || 10, at: Date.now() } : null;
    }
}

function timerLeftMs() {
    const b = wand?.timerBase;
    if (!b) return 0;
    return b.running ? Math.max(0, b.ms - (Date.now() - b.at)) : b.ms;
}

function showClockLeft() {
    const b = wand?.clockBase;
    if (!b) return 0;
    return Math.max(0, b.from - Math.floor((Date.now() - b.at) / 1000));
}

function tickClocks() {
    if (!wand) return;
    const t = wand.stage?.timer;
    if (t && wand.timerBase?.running) {
        t.remainingMs = timerLeftMs();
        const text = formatTimerClock(t.remainingMs);
        wand.root.querySelectorAll('[data-qw-timer-left]').forEach((el) => { if (el.textContent !== text) el.textContent = text; });
        wand.root.querySelector('[data-qw-timer-card]')?.style.setProperty('--p', (t.remainingMs / ((t.total || 1) * 1000)).toFixed(3));
    }
    if (wand.clockBase) {
        const left = showClockLeft();
        const btn = wand.root.querySelector('[data-qw-clock]');
        if (btn) {
            btn.textContent = `${left || wand.stage?.panel?.clockSecs || wand.stage?.panel?.clockFrom || 10}s`;
            const b = btn.closest('button');
            if (b) {
                // counting: a tap stops it; done: a tap starts it again
                b.classList.toggle('is-counting', left > 0);
                b.dataset.action = left > 0 ? 'stopclock' : 'timer';
                const icon = b.querySelector('i');
                if (icon) icon.className = `fas ${left > 0 ? 'fa-stop' : 'fa-stopwatch'}`;
            }
        }
        if (!left) { wand.clockBase = null; buzz([60, 40, 60]); }
    }
}

// ─── Sheets ─────────────────────────────────────────────────────────────────

/** The Wand behind an open sheet: out of reach for taps, keys and screen readers. */
function setBackdropInert(on) {
    wand?.root.querySelectorAll(':scope > .qw-top, :scope > .qw-now, :scope > .qw-main, :scope > .qw-modes').forEach((n) => { n.inert = on; });
}

function openSheet(kind, html) {
    if (!wand) return;
    if (!wand.sheetKind) wand.sheetFocus = document.activeElement;
    wand.sheetKind = kind;
    wand.sheet.innerHTML = html;
    wand.sheet.setAttribute('aria-hidden', 'false');
    wand.sheet.classList.add('is-open');
    setBackdropInert(true);
    const first = wand.sheet.querySelector('.qw-sheet__panel [data-qw="sheet-close"]:not(.qw-sheet__grab), .qw-sheet__panel button:not(.qw-sheet__grab)');
    first?.focus({ preventScroll: true });
}

function closeSheet() {
    if (!wand) return;
    wand.sheetKind = '';
    wand.sheet.classList.remove('is-open');
    wand.sheet.setAttribute('aria-hidden', 'true');
    setBackdropInert(false);
    const back = wand.sheetFocus;
    wand.sheetFocus = null;
    try { if (back?.isConnected && wand.root.contains(back)) back.focus({ preventScroll: true }); } catch { /* gone */ }
    setTimeout(() => { if (wand && !wand.sheetKind) wand.sheet.innerHTML = ''; }, 320);
}

function awardHeroes() {
    const all = heroesNow();
    return wand.award.heroIds.map((id) => all.find((h) => h.id === id)).filter(Boolean);
}

function renderAwardSheet() {
    const heroes = awardHeroes();
    if (!heroes.length) { closeSheet(); return; }
    wand.sheet.innerHTML = awardSheetHtml(heroes.length > 1 ? heroes : heroes[0], { reason: wand.award.reason, size: wand.award.size });
}

function openAward(heroIds) {
    // A fresh award starts with no virtue picked: the teacher names it each time; the size is remembered.
    wand.award = { heroIds, reason: '', size: wand.award.size || 'auto' };
    const heroes = awardHeroes();
    if (!heroes.length) return;
    openSheet('award', awardSheetHtml(heroes.length > 1 ? heroes : heroes[0], { reason: '', size: wand.award.size }));
    buzz(8);
}

function sendStar(stars) {
    const { reason } = wand.award;
    const heroes = awardHeroes().filter((h) => !(h.stars > 0) && !h.away);
    if (!reason || ![1, 2, 3].includes(stars) || !heroes.length) return;
    let sent = 0;
    for (const hero of heroes) {
        if (!send('award', { studentId: hero.id, reason, stars })) continue;
        wand.pending.set(hero.id, { stars, at: Date.now() });
        sent += 1;
    }
    if (!sent) return;
    buzz(stars >= 3 ? [20, 30, 20, 30, 60] : stars === 2 ? [20, 30, 40] : [30]);
    const starEl = wand.sheet.querySelector('[data-qw-star]');
    starEl?.classList.add('is-flying', `is-flying--${stars}`);
    wand.suppressNextOk = sent === 1;
    const ids = heroes.map((h) => h.id);
    const who = sent === 1 ? heroes[0].first : `${sent} heroes`;
    setTimeout(() => {
        closeSheet();
        wand.multi = false;
        wand.picked.clear();
        render();
        toast(`${'★'.repeat(stars)} on its way to ${who}`, 'ok', {
            action: {
                label: 'Undo',
                run: () => { ids.forEach((id) => { send('undo', { studentId: id }); wand.pending.delete(id); }); render(); buzz(15); }
            }
        });
    }, STILL ? 60 : 420);
}

// ─── Events ─────────────────────────────────────────────────────────────────

function datasetPayload(el) {
    const d = el.dataset;
    const p = {};
    if (d.action) p.action = d.action;
    if (d.key) p.key = d.key;
    if (d.dir) p.dir = d.dir;
    if (d.tab) p.tab = d.tab;
    if (d.seconds) p.seconds = Number(d.seconds);
    if (d.on) p.on = d.on === 'true';
    if (d.team) p.team = Number(d.team);
    if (d.index) p.index = Number(d.index);
    if (d.sound) p.sound = d.sound;
    if (d.student) p.studentId = d.student;
    if (d.points) p.points = Number(d.points);
    if (d.scope) p.scope = d.scope;
    if (d.stars) p.stars = Number(d.stars);
    return p;
}

function onHeroTap(heroId) {
    if (!wand.multi) { openAward([heroId]); return; }
    const hero = heroesNow().find((h) => h.id === heroId);
    if (!hero) return;
    if (hero.stars > 0 || hero.away) {
        buzz([30, 40, 30]);
        toast(hero.away ? `${hero.first} is away today` : `${hero.first} already shines today`, 'warn');
        return;
    }
    if (wand.picked.has(heroId)) wand.picked.delete(heroId); else wand.picked.add(heroId);
    buzz(6);
    render();
}

function wireEvents(root) {
    root.addEventListener('click', (e) => {
        if (!wand) return;
        const t = e.target;
        // the click a swipe across the deck ends with is not a tap on a card
        if (performance.now() < (wand.noClickUntil || 0)) { e.preventDefault(); return; }
        // Keyboard / screen reader (a click with no pointer): the gestures get a plain tap path.
        if (e.detail === 0) {
            if (t.closest('[data-qw-hold]')) { if (send('crown', { action: 'crown' })) buzz([40, 40, 120]); return; }
            const knob = t.closest('[data-qw-sling-knob]');
            if (knob && !knob.disabled) { if (send('wheel', { action: 'spin', power: 0.6 })) buzz([30, 20, 60]); return; }
            const star = t.closest('[data-qw-star]');
            if (star && !star.disabled) { sendStar(wand.award.size === 'auto' ? 1 : Number(wand.award.size)); return; }
        }
        const act = t.closest('[data-qw]')?.dataset.qw;
        if (act === 'leave') { buzz(10); closeWand(); return; }
        if (act === 'refresh') { showChooser(); return; }
        if (act === 'sheet-close') { closeSheet(); return; }
        if (act === 'to-stage') { buzz(6); setMode('stage'); return; }
        if (act === 'to-stars') { buzz(6); setMode('stars'); return; }
        if (act === 'pad-toggle') { wand.padOpen = !wand.padOpen; render(); return; }
        if (act === 'multi-clear') { wand.picked.clear(); render(); return; }
        if (act === 'multi-go') { if (wand.picked.size) openAward([...wand.picked]); return; }
        if (act === 'class') {
            const classes = [...(state.get('allTeachersClasses') || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
            openSheet('class', classSheetHtml(classes, currentClassId(), { follow: Boolean(wand.stage?.follow) }));
            return;
        }
        if (act === 'undo') {
            const id = t.closest('[data-id]')?.dataset.id;
            if (id && send('undo', { studentId: id })) { wand.pending.delete(id); buzz(15); closeSheet(); }
            return;
        }
        if (act === 'shake-pick') { enableMotionPermission(); summon(); return; }
        if (act === 'waiting') { wand.waiting = !wand.waiting; remember(WAITING_KEY, wand.waiting ? '1' : '0'); buzz(6); render({ fresh: true }); return; }
        if (act === 'tmin-down' || act === 'tmin-up') {
            wand.customMinutes = clampTimerMinutes(wand.customMinutes + (act === 'tmin-up' ? 1 : -1));
            remember(MINUTES_KEY, wand.customMinutes);
            buzz(6);
            render();
            return;
        }
        if (act === 'spells') {
            if (wand.root.dataset.phase !== 'bound') return;
            buzz(6);
            openSheet('spells', spellsSheetHtml(wand.spells, Date.now(), { bound: true }));
            return;
        }
        if (act === 'disconnect') {
            buzz([20, 40, 20]);
            releaseProjector();
            closeSheet();
            endSession();
            wand.root.dataset.phase = 'choose';
            setLink('asleep', 'Disconnected');
            showChooser();
            return;
        }
        const map = t.closest('[data-qw-map]');
        if (map) { pointAt(map, e); return; }
        if (t === wand.sheet) { closeSheet(); return; }

        const session = t.closest('[data-qw-session]');
        if (session) { connect(session.dataset.qwSession); return; }
        const mode = t.closest('[data-qw-mode]');
        if (mode) { buzz(6); setMode(mode.dataset.qwMode); if (mode.dataset.qwMode === 'magic') enableMotionPermission(); return; }
        const pick = t.closest('[data-qw-pick]');
        if (pick) { wand.multi = pick.dataset.qwPick === 'many'; wand.picked.clear(); buzz(6); render(); return; }
        const hero = t.closest('[data-qw-hero]');
        if (hero) { onHeroTap(hero.dataset.qwHero); return; }
        const virtue = t.closest('[data-qw-virtue]');
        if (virtue) { wand.award.reason = virtue.dataset.qwVirtue; buzz(8); renderAwardSheet(); return; }
        const size = t.closest('[data-qw-size]');
        if (size) { wand.award.size = size.dataset.qwSize; buzz(6); renderAwardSheet(); return; }
        const att = t.closest('[data-qw-att]');
        if (att) { if (send('attendance', { studentId: att.dataset.id, action: att.dataset.qwAtt })) { buzz(12); closeSheet(); } return; }
        const classOpt = t.closest('[data-qw-classid]');
        if (classOpt) {
            const id = classOpt.dataset.qwClassid;
            // General view and Follow the schedule are settled by the projector; a class shows at once.
            const special = id === CLASS_GENERAL || id === CLASS_FOLLOW;
            if (send('class', { classId: id })) {
                if (!special) { wand.classOverride = id; wand.classOverrideAt = Date.now(); }
                wand.picked.clear(); buzz(10); closeSheet(); render();
            }
            return;
        }
        if (wand.mode === 'show' && forgeTap(t)) return;
        const pad = t.closest('[data-qw-pad]');
        if (pad) { pressFeedback(pad); send('pad', { id: pad.dataset.qwPad }); return; }
        const cmdEl = t.closest('[data-qw-cmd]');
        if (cmdEl && !cmdEl.disabled) {
            const type = cmdEl.dataset.qwCmd;
            const payload = datasetPayload(cmdEl);
            // A quick double tap must not start a timer, a wheel or a show twice. Points, scrolling and
            // keys stay rapid-fire.
            const repeatable = type === 'scroll' || type === 'key' || (type === 'showdown' && (payload.action === 'point' || payload.action === 'minus'));
            const nowMs = performance.now();
            if (!repeatable && nowMs - (Number(cmdEl.dataset.qwSentAt) || 0) < 650) return;
            if (send(type, payload)) {
                cmdEl.dataset.qwSentAt = String(nowMs);
                pressFeedback(cmdEl);
                // A hero called into the spotlight: the sheet steps away so the teacher sees the room.
                if (type === 'charm' && payload.action === 'spotlight' && wand.sheetKind === 'award') closeSheet();
                // a +2 or +3 is for one tap only: the next point is a plain one again
                if (type === 'showdown' && payload.action === 'point' && wand.sdPoints !== 1) { wand.sdPoints = 1; render(); }
            }
        }
    });

    // The projector's own controls: a dropdown choice, or text typed on the phone (sent on Send / Enter).
    root.addEventListener('change', (e) => {
        const sel = e.target.closest?.('[data-qw-select]');
        if (!sel || !wand) return;
        if (send('pad', { id: sel.dataset.qwSelect, value: sel.value })) { buzz(10); sel.blur(); }
    });
    root.addEventListener('submit', (e) => {
        const form = e.target.closest?.('[data-qw-text]');
        if (!form || !wand) return;
        e.preventDefault();
        const field = form.querySelector('[name="v"]');
        if (send('pad', { id: form.dataset.qwText, value: String(field?.value ?? '').slice(0, 500) })) {
            buzz([10, 30, 10]);
            form.classList.remove('is-sent');
            void form.offsetWidth;
            form.classList.add('is-sent');
            field?.blur();
        }
    });
    root.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && wand?.sheetKind) { e.preventDefault(); closeSheet(); return; }
        // Enter in a one-line box sends; in a text area it is a new line.
        if (e.key === 'Enter' && e.target?.matches?.('[data-qw-text] input')) {
            e.preventDefault();
            e.target.form?.requestSubmit?.();
        }
    });
    root.addEventListener('focusout', () => {
        setTimeout(() => { if (wand?.renderQueued && !isTyping() && !wand.gesture) { wand.renderQueued = false; render(); } }, 0);
    });

    // Star Flick, Hold to Crown, Wheel Slingshot, deck swipe: pointer gestures.
    root.addEventListener('pointerdown', (e) => {
        if (!wand) return;
        sparkle(e);
        const star = e.target.closest('[data-qw-star]');
        if (star && !star.disabled) { startFlick(e, star); return; }
        const hold = e.target.closest('[data-qw-hold]');
        if (hold) { startHold(e, hold); return; }
        const knob = e.target.closest('[data-qw-sling-knob]');
        if (knob && !knob.disabled) { startSling(e, knob); return; }
        const swipe = e.target.closest('[data-qw-swipe]');
        if (swipe) startSwipe(e, swipe);
    });
}

/** "Look here": where on the projector the teacher tapped (0..1 of the map), sent as a beacon. */
function pointAt(map, e) {
    const r = map.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const cx = Number.isFinite(e.clientX) && e.clientX ? e.clientX : r.left + r.width / 2;
    const cy = Number.isFinite(e.clientY) && e.clientY ? e.clientY : r.top + r.height / 2;
    const x = Math.round(Math.max(0, Math.min(1, (cx - r.left) / r.width)) * 1000) / 1000;
    const y = Math.round(Math.max(0, Math.min(1, (cy - r.top) / r.height)) * 1000) / 1000;
    if (!send('charm', { action: 'point', x, y })) return;
    buzz([12, 30, 12]);
    const ping = document.createElement('span');
    ping.className = 'qw-look__ping';
    ping.dataset.qwTransient = '';
    ping.style.left = `${x * 100}%`;
    ping.style.top = `${y * 100}%`;
    map.appendChild(ping);
    setTimeout(() => ping.remove(), 1200);
}

/** A few sparks fly off the fingertip on every touch: the phone feels like a wand (skipped on weak phones). */
function sparkle(e) {
    if (LITE || STILL || !wand || e.pointerType === 'mouse' && e.button !== 0) return;
    const layer = wand.root.querySelector('[data-qw-sparks]');
    if (!layer) return;
    if (layer.childElementCount > 18) layer.firstElementChild?.remove();
    const burst = document.createElement('span');
    burst.className = 'qw-spark';
    burst.style.left = `${e.clientX}px`;
    burst.style.top = `${e.clientY}px`;
    burst.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i>';
    layer.appendChild(burst);
    setTimeout(() => burst.remove(), 650);
}

function pressFeedback(el) {
    buzz(10);
    el.classList.remove('is-pressed');
    void el.offsetWidth;
    el.classList.add('is-pressed');
    setTimeout(() => el.classList.remove('is-pressed'), 420);
}

/** Every gesture in flight, so a hidden page, a redraw or a closed Wand can end them all. */
function cancelGestures() {
    if (!wand) return;
    [...wand.gestures].forEach((stop) => stop());
}

/**
 * Follows one finger on `el` until it lifts. Ends on pointerup, pointercancel, lost capture (the
 * element was redrawn away) or cancelGestures(); `onEnd(ev, cancelled)` always runs exactly once.
 */
function trackPointer(e, el, { onMove, onEnd, capture = true }) {
    const w = wand;
    // Without capture (the deck), taps still reach the card under the finger; the window hears the rest.
    const src = capture ? el : window;
    if (capture) { try { el.setPointerCapture(e.pointerId); } catch { /* old browser */ } }
    let frame = 0;
    let last = e;
    let done = false;
    const move = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        last = ev;
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (!done) onMove(last); });
    };
    const finish = (ev, cancelled) => {
        if (done) return;
        done = true;
        src.removeEventListener('pointermove', move);
        src.removeEventListener('pointerup', up);
        src.removeEventListener('pointercancel', cancel);
        src.removeEventListener('lostpointercapture', cancel);
        cancelAnimationFrame(frame);
        w.gestures.delete(stop);
        w.gesture = w.gestures.size > 0;
        onEnd(ev || last, cancelled);
        if (wand === w && !w.gesture && w.renderQueued) { w.renderQueued = false; render(); }
    };
    const up = (ev) => { if (ev.pointerId === e.pointerId) finish(ev, false); };
    const cancel = (ev) => { if (ev.pointerId === e.pointerId) finish(ev, true); };
    const stop = () => finish(null, true);
    w.gestures.add(stop);
    w.gesture = true;
    src.addEventListener('pointermove', move, { passive: true });
    src.addEventListener('pointerup', up);
    src.addEventListener('pointercancel', cancel);
    if (capture) src.addEventListener('lostpointercapture', cancel);
    return stop;
}

function startFlick(e, star) {
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const t0 = performance.now();
    const samples = [{ x: x0, y: y0, t: t0 }];
    const zone = star.closest('[data-qw-flick]');
    zone?.classList.add('is-aiming');
    trackPointer(e, star, {
        onMove(ev) {
            const now = performance.now();
            samples.push({ x: ev.clientX, y: ev.clientY, t: now });
            if (samples.length > 12) samples.shift();
            const dy = Math.min(0, ev.clientY - y0);
            const dx = (ev.clientX - x0) * 0.35;
            star.style.transform = `translate(${dx}px, ${dy}px) scale(${1 + Math.min(0.5, -dy / 400)})`;
            zone?.style.setProperty('--qw-pull', String(Math.min(1, -dy / 220)));
        },
        onEnd(ev, cancelled) {
            zone?.classList.remove('is-aiming');
            zone?.style.removeProperty('--qw-pull');
            const now = performance.now();
            const totalDy = ev.clientY - y0;
            const totalDx = ev.clientX - x0;
            // speed from the last ~120 ms, so a slow aim then a fast flick still counts as fast
            const ref = samples.find((s) => now - s.t <= 120) || samples[0];
            const recentUp = ref.y - ev.clientY;
            const recentDt = Math.max(16, now - ref.t);
            const speed = recentUp / recentDt;
            const up = -totalDy;
            const fixed = wand.award.size === 'auto' ? null : Number(wand.award.size);
            const effectiveDt = speed > 0 ? up / speed : Infinity;
            let stars = cancelled ? 0 : classifyFlick({ dy: totalDy, dx: totalDx, dtMs: effectiveDt }, { fixedStars: fixed });
            const tapped = Math.abs(totalDy) < 10 && Math.abs(totalDx) < 10 && now - t0 < 400;
            if (!stars && tapped && !cancelled) stars = fixed || 1;
            if (stars) {
                star.style.transform = '';
                sendStar(stars);
            } else {
                star.style.transition = 'transform 280ms cubic-bezier(.34,1.56,.64,1)';
                star.style.transform = '';
                setTimeout(() => { star.style.transition = ''; }, 300);
            }
        }
    });
}

function startHold(e, el) {
    e.preventDefault();
    el.classList.remove('is-fired');
    el.classList.add('is-holding');
    buzz(15);
    const pulse = setInterval(() => buzz(8), 300);
    let stop = null;
    const timer = setTimeout(() => {
        clearInterval(pulse);
        el.classList.remove('is-holding');
        if (document.hidden || !send('crown', { action: 'crown' })) { stop?.(); return; }
        el.classList.add('is-fired');
        buzz([40, 40, 120]);
        setTimeout(() => el.classList.remove('is-fired'), 1600);
        stop?.();
    }, HOLD_MS);
    stop = trackPointer(e, el, {
        onMove(ev) {
            // sliding the finger off the crown lets go of it
            const r = el.getBoundingClientRect();
            const m = 28;
            if (ev.clientX < r.left - m || ev.clientX > r.right + m || ev.clientY < r.top - m || ev.clientY > r.bottom + m) stop?.();
        },
        onEnd() {
            clearInterval(pulse);
            clearTimeout(timer);
            el.classList.remove('is-holding');
        }
    });
}

function startSling(e, knob) {
    e.preventDefault();
    const y0 = e.clientY;
    const track = knob.closest('[data-qw-sling]');
    const fill = track?.querySelector('[data-qw-sling-fill]');
    const max = Math.max(160, Math.min(300, (track?.clientHeight || 240) - 40));
    let power = 0;
    let lastStep = 0;
    knob.style.transition = 'none';
    track?.classList.add('is-pulling');
    trackPointer(e, knob, {
        onMove(ev) {
            const dist = Math.max(0, Math.min(max, ev.clientY - y0));
            power = slingshotPower(dist, max);
            knob.style.transform = `translateY(${dist}px) rotate(${dist * 1.4}deg)`;
            if (fill) fill.style.transform = `scaleY(${power.toFixed(3)})`;
            const step = Math.floor(power * 4);
            if (step !== lastStep) { lastStep = step; buzz(6 + step * 4); }
        },
        onEnd(ev, cancelled) {
            track?.classList.remove('is-pulling');
            knob.style.transition = '';
            knob.style.transform = '';
            if (fill) fill.style.transform = '';
            if (!cancelled && power >= SLINGSHOT_MIN_POWER) {
                track?.classList.add('is-released');
                setTimeout(() => track?.classList.remove('is-released'), 700);
                buzz([30, 20, 60]);
                send('wheel', { action: 'spin', power });
            }
        }
    });
}

function startSwipe(e, el) {
    const x0 = e.clientX;
    trackPointer(e, el, {
        capture: false,
        onMove() {},
        onEnd(ev, cancelled) {
            const dx = ev.clientX - x0;
            if (cancelled || Math.abs(dx) < 50) return;
            if (wand) wand.noClickUntil = performance.now() + 400;
            send(el.dataset.qwSwipe, { action: dx < 0 ? 'next' : 'prev' });
            buzz(10);
        }
    });
}

// ─── Shake to Summon ────────────────────────────────────────────────────────

function summon() {
    if (!wand) return;
    const open = wand.stage?.panel?.kind === 'picker';
    send('picker', { action: open ? 'pick' : 'open' });
    buzz([20, 40, 20]);
    wand.root.classList.remove('is-summoning');
    void wand.root.offsetWidth;
    wand.root.classList.add('is-summoning');
    setTimeout(() => wand?.root.classList.remove('is-summoning'), 900);
}

let motionAsked = false;
function enableMotionPermission() {
    if (motionAsked) return;
    motionAsked = true;
    const DM = window.DeviceMotionEvent;
    if (DM && typeof DM.requestPermission === 'function') {
        DM.requestPermission().then((r) => { if (r === 'granted') startMotion(); }).catch(() => {});
    }
}

function startMotion() {
    if (!wand || wand.motionOn || !('DeviceMotionEvent' in window)) return;
    wand.motionOn = true;
    wand.onMotion = (ev) => {
        const a = ev.acceleration;
        let mag;
        if (a && a.x != null) mag = Math.hypot(a.x, a.y, a.z);
        else {
            const g = ev.accelerationIncludingGravity;
            if (!g || g.x == null) return;
            mag = Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81);
        }
        if (wand.shake.feed(mag, performance.now())) summon();
    };
    window.addEventListener('devicemotion', wand.onMotion, { passive: true });
}

function stopMotion(w = wand) {
    if (!w?.motionOn) return;
    w.motionOn = false;
    window.removeEventListener('devicemotion', w.onMotion);
    w.shake.reset();
}
