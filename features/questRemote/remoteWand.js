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
    validateCommand, classifyFlick, slingshotPower, SLINGSHOT_MIN_POWER, createShakeDetector,
    isHostLive, HEARTBEAT_MS, HOST_LIVE_MS, formatTimerClock
} from './remoteCore.mjs';
import {
    wandShellHtml, nowStripHtml, chooserHtml, starsHtml, awardSheetHtml, classSheetHtml, stageHtml, magicHtml, showHtml
} from './remoteWandView.mjs';

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
        motionOn: false
    };
    wireEvents(root);
    requestAnimationFrame(() => root.classList.add('is-in'));
    if (sessionId) await connect(sessionId);
    else await showChooser();
}

export async function closeWand({ quiet = false } = {}) {
    if (!wand) return;
    const w = wand;
    wand = null;
    w.unsub?.();
    w.timers.forEach((t) => clearInterval(t));
    stopMotion(w);
    try { await w.wakeLock?.release(); } catch { /* already released */ }
    document.removeEventListener('visibilitychange', w.onVisible);
    window.removeEventListener('online', w.onNet);
    window.removeEventListener('offline', w.onNet);
    document.body.classList.remove('qw-open');
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
        if (wand) wand.main.innerHTML = chooserHtml([], { error: 'Could not reach the school. Check the connection.' });
        setLink('offline', 'No connection');
    }
}

async function connect(sessionId) {
    if (!wand) return;
    wand.unsub?.();
    wand.timers.forEach((t) => clearInterval(t));
    wand.timers = [];
    wand.root.dataset.phase = 'choose';
    wand.main.innerHTML = chooserHtml([], { loading: true });
    setLink('connecting', 'Binding…');
    let data = null;
    try { data = await channel.readSession(sessionId); } catch { data = null; }
    if (!wand) return;
    if (!data || data.closed || data.teacherId !== state.get('currentUserId')) {
        await showChooser('That projector is not awake any more. Press the wand button on the classroom computer.');
        return;
    }
    try {
        await channel.bindWand(sessionId, wand.wandId);
    } catch (e) {
        console.warn('Quest Remote: bind failed', e);
        await showChooser('The Wand could not bind. Try again.');
        return;
    }
    wand.sessionId = sessionId;
    wand.code = data.code || '';
    wand.hostSeenAt = Date.now();
    wand.root.dataset.phase = 'bound';
    wand.unsub = channel.watchSession(sessionId, onSession, () => setLink('offline', 'Connection lost'));
    wand.timers.push(setInterval(() => {
        if (!wand) return;
        channel.beatWand(wand.sessionId).catch(() => {});
        syncLink();
    }, HEARTBEAT_MS));
    wand.timers.push(setInterval(() => { if (wand?.mode === 'stars' && !wand.sheetKind) refreshRosterIfChanged(); }, 1500));
    wand.timers.push(setInterval(() => tickTimerBadge(), 1000));
    wand.onVisible = () => {
        if (!wand || document.hidden) return;
        requestWakeLock();
        channel.beatWand(wand.sessionId).catch(() => {});
        syncLink();
    };
    wand.onNet = () => syncLink();
    document.addEventListener('visibilitychange', wand.onVisible);
    window.addEventListener('online', wand.onNet);
    window.addEventListener('offline', wand.onNet);
    requestWakeLock();
    send('bind', {});
    buzz([20, 60, 30]);
    wand.root.classList.add('is-bound');
    setTimeout(() => wand?.root.classList.remove('is-bound'), 1400);
    setMode(wand.mode);
}

async function requestWakeLock() {
    try {
        if (!wand || !('wakeLock' in navigator) || document.hidden) return;
        wand.wakeLock = await navigator.wakeLock.request('screen');
    } catch { /* not allowed: the screen may dim, the Wand still works */ }
}

// ─── Session updates ────────────────────────────────────────────────────────

function onSession(data) {
    if (!wand) return;
    if (!data || data.closed) {
        setLink('asleep', 'The projector put the Wand to sleep');
        wand.root.dataset.phase = 'choose';
        wand.unsub?.();
        wand.unsub = null;
        wand.timers.forEach((t) => clearInterval(t));
        wand.timers = [];
        setTimeout(() => wand && showChooser('The projector put the Wand to sleep.'), 1200);
        return;
    }
    const beat = channel.toMs(data.hostHeartbeatAt);
    if (beat !== wand.hostBeat) { wand.hostBeat = beat; wand.hostSeenAt = Date.now(); }
    const prevPanel = wand.stage?.panel?.kind || '';
    wand.stage = data.stage || null;
    wand.secret = data.secret || null;
    if (wand.classOverride && wand.stage?.classId === wand.classOverride) wand.classOverride = '';
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
    if (!result.ok) {
        // The projector said no: undo anything shown optimistically.
        wand.pending.clear();
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
    const cmd = { type, payload, clientSeq: (wand.seq += 1), wandId: wand.wandId };
    if (!validateCommand(cmd).ok) { wand.seq -= 1; return false; }
    channel.sendCommand(wand.sessionId, cmd).catch((e) => {
        console.warn('Quest Remote: send failed', e);
        toast('Not sent: check the connection', 'warn');
    });
    return true;
}

// ─── Rendering ──────────────────────────────────────────────────────────────

const MODE_KEY = 'gcq.questRemote.mode';
const MODES = new Set(['stars', 'stage', 'magic', 'show']);

function savedMode() {
    try { const m = localStorage.getItem(MODE_KEY); return MODES.has(m) ? m : 'stars'; } catch { return 'stars'; }
}

function setMode(mode) {
    if (!wand) return;
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
    if (wand.gesture) { wand.renderQueued = true; return; }
    const stage = wand.stage || {};
    let html = '';
    if (wand.mode === 'stars') {
        html = starsHtml(heroesNow(), {
            className: classLabel(), empty: 'Choose a class (top right) to see its heroes.',
            multi: wand.multi, picked: [...wand.picked], note: starsNote(wand.stage)
        });
    } else if (wand.mode === 'stage') {
        html = stageHtml(stage, { secret: wand.secret, castAllowed: (t) => !TAB_FEATURE_FLAGS[t.tab] || canUseFeature(TAB_FEATURE_FLAGS[t.tab]), padOpen: wand.padOpen });
    } else if (wand.mode === 'magic') {
        html = magicHtml(stage, { canCrown: canUseFeature('adventureLog'), canWheel: canUseFeature('guilds') });
    } else {
        html = showHtml(stage, { secret: wand.secret });
    }
    // Only touch the page when something changed: no flicker, no lost taps, less work.
    if (fresh || html !== wand.lastHtml) {
        const keep = fresh ? 0 : wand.main.scrollTop;
        wand.lastHtml = html;
        wand.main.innerHTML = `<div class="qw-view qw-view--${wand.mode}${fresh ? ' is-fresh' : ''}">${html}</div>`;
        wand.main.scrollTop = keep;
        // The cloud of the screen on the projector is always in sight in the row of screens.
        const onCloud = wand.main.querySelector('.qw-screens .qw-cloud.is-on');
        const row = onCloud?.parentElement;
        if (onCloud && row) row.scrollLeft = Math.max(0, onCloud.offsetLeft - (row.clientWidth - onCloud.offsetWidth) / 2);
    }
    const now = nowStripHtml(wand.stage);
    if (now !== wand.lastNow) {
        wand.lastNow = now;
        const strip = wand.root.querySelector('[data-qw-now]');
        if (strip) { strip.innerHTML = now; strip.hidden = !now; }
    }
    const chip = wand.root.querySelector('[data-qw-class]');
    const label = classLabel() || 'Class';
    if (chip && chip.textContent !== label) chip.textContent = label;
}

function currentClassId() {
    return wand?.classOverride || wand?.stage?.classId || state.get('globalSelectedClassId') || '';
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

function tickTimerBadge() {
    const t = wand?.stage?.timer;
    if (!t || t.paused || t.done) return;
    t.remainingMs = Math.max(0, t.remainingMs - 1000);
    const text = formatTimerClock(t.remainingMs);
    wand.root.querySelectorAll('[data-qw-timer-left]').forEach((el) => { if (el.textContent !== text) el.textContent = text; });
    const card = wand.root.querySelector('.qw-timer');
    card?.style.setProperty('--p', (t.remainingMs / ((t.total || 1) * 1000)).toFixed(3));
}

// ─── Sheets ─────────────────────────────────────────────────────────────────

function openSheet(kind, html) {
    if (!wand) return;
    wand.sheetKind = kind;
    wand.sheet.innerHTML = html;
    wand.sheet.setAttribute('aria-hidden', 'false');
    wand.sheet.classList.add('is-open');
}

function closeSheet() {
    if (!wand) return;
    wand.sheetKind = '';
    wand.sheet.classList.remove('is-open');
    wand.sheet.setAttribute('aria-hidden', 'true');
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
        const act = t.closest('[data-qw]')?.dataset.qw;
        if (act === 'leave') { buzz(10); closeWand(); return; }
        if (act === 'refresh') { showChooser(); return; }
        if (act === 'sheet-close') { closeSheet(); return; }
        if (act === 'to-stage') { buzz(6); setMode('stage'); return; }
        if (act === 'pad-toggle') { wand.padOpen = !wand.padOpen; render(); return; }
        if (act === 'multi-clear') { wand.picked.clear(); render(); return; }
        if (act === 'multi-go') { if (wand.picked.size) openAward([...wand.picked]); return; }
        if (act === 'class') {
            const classes = [...(state.get('allTeachersClasses') || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
            openSheet('class', classSheetHtml(classes, currentClassId()));
            return;
        }
        if (act === 'undo') {
            const id = t.closest('[data-id]')?.dataset.id;
            if (id && send('undo', { studentId: id })) { wand.pending.delete(id); buzz(15); closeSheet(); }
            return;
        }
        if (act === 'shake-pick') { enableMotionPermission(); summon(); return; }
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
            if (send('class', { classId: id })) { wand.classOverride = id; wand.picked.clear(); buzz(10); closeSheet(); render(); }
            return;
        }
        const pad = t.closest('[data-qw-pad]');
        if (pad) { pressFeedback(pad); send('pad', { id: pad.dataset.qwPad }); return; }
        const cmdEl = t.closest('[data-qw-cmd]');
        if (cmdEl && !cmdEl.disabled) {
            const type = cmdEl.dataset.qwCmd;
            const payload = datasetPayload(cmdEl);
            if (send(type, payload)) pressFeedback(cmdEl);
        }
    });

    // Star Flick, Hold to Crown, Wheel Slingshot, deck swipe: pointer gestures.
    root.addEventListener('pointerdown', (e) => {
        if (!wand) return;
        const star = e.target.closest('[data-qw-star]');
        if (star && !star.disabled) { startFlick(e, star); return; }
        const hold = e.target.closest('[data-qw-hold]');
        if (hold) { startHold(e, hold); return; }
        const knob = e.target.closest('[data-qw-sling-knob]');
        if (knob && !knob.disabled) { startSling(e, knob); return; }
        const swipe = e.target.closest('[data-qw-swipe]');
        if (swipe && !e.target.closest('button')) startSwipe(e, swipe);
    });
}

function pressFeedback(el) {
    buzz(10);
    el.classList.remove('is-pressed');
    void el.offsetWidth;
    el.classList.add('is-pressed');
    setTimeout(() => el.classList.remove('is-pressed'), 420);
}

function trackPointer(e, el, { onMove, onEnd }) {
    wand.gesture = true;
    try { el.setPointerCapture(e.pointerId); } catch { /* old browser */ }
    let frame = 0;
    let last = null;
    const move = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        last = ev;
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (last) onMove(last); });
    };
    const end = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', end);
        el.removeEventListener('pointercancel', end);
        cancelAnimationFrame(frame);
        wand && (wand.gesture = false);
        onEnd(ev, ev.type === 'pointercancel');
        if (wand?.renderQueued) { wand.renderQueued = false; render(); }
    };
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
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
    const timer = setTimeout(() => {
        clearInterval(pulse);
        el.classList.remove('is-holding');
        el.classList.add('is-fired');
        buzz([40, 40, 120]);
        send('crown', { action: 'crown' });
    }, HOLD_MS);
    trackPointer(e, el, {
        onMove() {},
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
        onMove() {},
        onEnd(ev, cancelled) {
            const dx = ev.clientX - x0;
            if (cancelled || Math.abs(dx) < 50) return;
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
