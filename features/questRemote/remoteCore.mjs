// features/questRemote/remoteCore.mjs — Quest Remote (the Wand): pure rules shared by the projector
// host (remoteHost.js), the phone (remoteWand.js) and the tests. No DOM, no Firebase, no app state.
//
// The phone sends small commands; the projector PC is the only executor (it runs the app's own
// code paths, so every guard, celebration and transaction is reused and nothing is written twice).

/** Every command the Wand may send. firestore.rules keeps the same list (validRemoteCommand). */
export const REMOTE_COMMAND_TYPES = Object.freeze([
    'bind', 'pad', 'key', 'cast', 'class', 'scroll', 'award', 'undo', 'attendance', 'crown',
    'wheel', 'picker', 'timer', 'blackout', 'dragon', 'wall', 'showdown', 'quiz', 'charm'
]);

/** The class picker's two other choices (sent as a `class` command's classId). */
export const CLASS_GENERAL = '*general';
export const CLASS_FOLLOW = '*follow';

/** Keys the Wand may press on the projector (the app's own keyboard shortcuts). */
export const REMOTE_KEYS = Object.freeze([
    'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ',
    '1', '2', '3', '4', 'a', 'b', 'c', 'd', 'r', 'q', 'l'
]);

/**
 * Screens the Wand can cast to the projector, in the order, icons and cloud colours of the real dock
 * (templates/app/nav.js + styles/nav.css), so the phone shows the same clouds the class sees.
 */
export const CAST_TABS = Object.freeze([
    { tab: 'about-tab', label: 'Home', icon: 'fa-home', from: '#06b6d4', to: '#22d3ee' },
    { tab: 'class-leaderboard-tab', label: 'Team Quest', icon: 'fa-route', from: '#f59e0b', to: '#fbbf24' },
    { tab: 'student-leaderboard-tab', label: "Hero's Challenge", icon: 'fa-user-graduate', from: '#a855f7', to: '#c084fc' },
    { tab: 'shop-tab', label: 'Mystic Market', icon: 'fa-store', from: '#65a30d', to: '#84cc16' },
    { tab: 'guilds-tab', label: 'Guild Hall', icon: 'fa-shield-alt', flag: 'guilds', from: '#c2410c', to: '#f97316' },
    { tab: 'award-stars-tab', label: 'Award Stars', icon: 'fa-star', from: '#f43f5e', to: '#fb7185' },
    { tab: 'adventure-log-tab', label: 'Adventure Log', icon: 'fa-book-open', from: '#14b8a6', to: '#2dd4bf' },
    { tab: 'scholars-scroll-tab', label: "Scholar's Scroll", icon: 'fa-scroll', flag: 'scholarScroll', from: '#be185d', to: '#db2777' },
    { tab: 'calendar-tab', label: 'Quest Calendar', icon: 'fa-calendar-alt', flag: 'calendar', from: '#3b82f6', to: '#60a5fa' },
    { tab: 'reward-ideas-tab', label: 'Training Grounds', icon: 'fa-bullseye', flag: 'storyWeavers', from: '#6366f1', to: '#818cf8' }
]);

export const CAST_TAB_IDS = Object.freeze(CAST_TABS.map((t) => t.tab));

/** The four virtues a star names (same keys as features/awardCloudCard.mjs AWARD_VIRTUES). */
export const WAND_VIRTUES = Object.freeze([
    { key: 'teamwork', name: 'Teamwork', icon: 'fa-users', rune: 'ᚷ' },
    { key: 'creativity', name: 'Creativity', icon: 'fa-lightbulb', rune: 'ᚲ' },
    { key: 'respect', name: 'Respect', icon: 'fa-hands-helping', rune: 'ᚱ' },
    { key: 'focus', name: 'Focus', icon: 'fa-brain', rune: 'ᛟ' }
]);

const VIRTUE_KEYS = new Set(WAND_VIRTUES.map((v) => v.key));
const TYPES = new Set(REMOTE_COMMAND_TYPES);
const KEYS = new Set(REMOTE_KEYS);

/** Timer presets (seconds). Think · Pair · Share is the classic wait-time routine. */
export const TIMER_PRESETS = Object.freeze([
    { id: 'think', label: 'Think', seconds: 30, icon: 'fa-lightbulb' },
    { id: 'pair', label: 'Pair', seconds: 60, icon: 'fa-user-group' },
    { id: 'share', label: 'Share', seconds: 90, icon: 'fa-comments' },
    { id: 'two', label: '2 min', seconds: 120, icon: 'fa-hourglass-half' },
    { id: 'five', label: '5 min', seconds: 300, icon: 'fa-hourglass' }
]);

/** Custom timer: whole minutes the teacher can dial on the Wand. */
export const CUSTOM_TIMER_MIN = 1;
export const CUSTOM_TIMER_MAX = 30;

/** Keeps a dialled timer inside 1–30 minutes. */
export function clampTimerMinutes(minutes) {
    const n = Math.round(Number(minutes));
    if (!Number.isFinite(n)) return 3;
    return Math.max(CUSTOM_TIMER_MIN, Math.min(CUSTOM_TIMER_MAX, n));
}

/**
 * Sound Charms: classroom stings the Wand plays on the projector's speakers. `sfx` names the
 * existing game-show voice (audio.js playQuizShowSfx); `word` is the comic burst the class sees.
 */
export const CHARM_SOUNDS = Object.freeze([
    { id: 'tada', label: 'Ta-daa!', icon: 'fa-wand-magic-sparkles', sfx: 'land', word: 'TA-DAA!', from: '#f59e0b', to: '#fde047' },
    { id: 'drumroll', label: 'Drum roll', icon: 'fa-drum', sfx: 'tally', word: 'Drum roll…', from: '#7c3aed', to: '#c084fc' },
    { id: 'fanfare', label: 'Fanfare', icon: 'fa-crown', sfx: 'fanfare', word: 'Hooray!', from: '#e11d48', to: '#fb7185' },
    { id: 'ding', label: 'Ding ding', icon: 'fa-bell', sfx: 'cheer', word: 'Ding ding!', from: '#0891b2', to: '#67e8f9' },
    { id: 'buzzer', label: 'Buzzer', icon: 'fa-circle-xmark', sfx: 'buzz', word: 'BZZZT!', from: '#475569', to: '#94a3b8' },
    { id: 'wahwah', label: 'Wah-wah', icon: 'fa-face-grin-tears', sfx: 'missed', word: 'Wah-wah…', from: '#0f766e', to: '#5eead4' }
]);
const CHARM_SOUND_IDS = new Set(CHARM_SOUNDS.map((c) => c.id));

/**
 * A command that reached the server this long after the phone sent it is never run (a tap queued
 * while the phone was offline must not fire minutes later). Phones keep network time, so the
 * server stamp minus the phone's own send time is the delay plus a little clock drift.
 */
export const COMMAND_MAX_AGE_MS = 30_000;
/** The projector beats every 15 s; a session silent for longer than this is no longer live. */
export const HOST_LIVE_MS = 45_000;
export const HEARTBEAT_MS = 15_000;
/** Stage summaries are written at most this often. */
export const STAGE_MIN_INTERVAL_MS = 1000;
export const MAX_PAD_ACTIONS = 40;

/** Kinds of control the Wand can mirror. */
export const PAD_KINDS = Object.freeze(['button', 'tab', 'toggle', 'select', 'text']);
const TEXT_TYPES = new Set(['text', 'search', 'number', 'email', 'url', 'tel', 'date', 'time']);

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteIn(value, min, max) {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function shortString(value, max = 80) {
    return typeof value === 'string' && value.length > 0 && value.length <= max;
}

/**
 * Checks one command before the projector runs it.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateCommand(cmd) {
    if (!isPlainObject(cmd)) return { ok: false, reason: 'not-an-object' };
    if (!TYPES.has(cmd.type)) return { ok: false, reason: 'unknown-type' };
    if (!Number.isInteger(cmd.clientSeq) || cmd.clientSeq < 0) return { ok: false, reason: 'bad-seq' };
    const p = cmd.payload ?? {};
    if (!isPlainObject(p)) return { ok: false, reason: 'bad-payload' };
    if (Object.keys(p).length > 12) return { ok: false, reason: 'payload-too-big' };
    const fail = (reason) => ({ ok: false, reason });
    switch (cmd.type) {
        case 'pad':
            if (!shortString(p.id, 24)) return fail('bad-pad-id');
            // A dropdown choice or the text for a field on the projector (rides on the same command).
            if (p.value != null && !(typeof p.value === 'string' && p.value.length <= 500)) return fail('bad-value');
            return { ok: true };
        case 'key': return KEYS.has(p.key) ? { ok: true } : fail('key-not-allowed');
        case 'cast': return CAST_TAB_IDS.includes(p.tab) ? { ok: true } : fail('bad-tab');
        case 'class': return shortString(p.classId, 64) ? { ok: true } : fail('bad-class');
        case 'scroll': return ['up', 'down', 'top'].includes(p.dir) ? { ok: true } : fail('bad-dir');
        case 'award':
            if (!shortString(p.studentId, 64)) return fail('bad-student');
            if (!VIRTUE_KEYS.has(p.reason)) return fail('bad-reason');
            return [1, 2, 3].includes(p.stars) ? { ok: true } : fail('bad-stars');
        case 'undo': return shortString(p.studentId, 64) ? { ok: true } : fail('bad-student');
        case 'attendance':
            if (!shortString(p.studentId, 64)) return fail('bad-student');
            return ['mark-absent', 'mark-present', 'welcome-back'].includes(p.action) ? { ok: true } : fail('bad-action');
        case 'wheel':
            if (!['open', 'spin', 'next', 'close'].includes(p.action)) return fail('bad-action');
            if (p.power != null && !finiteIn(p.power, 0, 1)) return fail('bad-power');
            return { ok: true };
        case 'picker': return ['open', 'pick', 'pass', 'think5', 'think10', 'think20', 'fresh', 'big', 'close'].includes(p.action) ? { ok: true } : fail('bad-action');
        case 'timer':
            if (p.action === 'stop' || p.action === 'pause' || p.action === 'resume' || p.action === 'add') return { ok: true };
            if (p.action !== 'start') return fail('bad-action');
            return finiteIn(p.seconds, 5, 3600) ? { ok: true } : fail('bad-seconds');
        case 'blackout': return typeof p.on === 'boolean' ? { ok: true } : fail('bad-on');
        case 'dragon': return ['open', 'close'].includes(p.action) ? { ok: true } : fail('bad-action');
        case 'wall': return ['toggle', 'next', 'prev', 'pin', 'reveal', 'deck'].includes(p.action) ? { ok: true } : fail('bad-action');
        case 'showdown':
            if (!['open', 'point', 'minus', 'next', 'finish', 'close', 'reward', 'timer', 'golden'].includes(p.action)) return fail('bad-action');
            if (p.team != null && !(Number.isInteger(p.team) && p.team >= 0 && p.team < 8)) return fail('bad-team');
            return { ok: true };
        case 'quiz': return ['answer', 'next', 'skip', 'listen', 'close'].includes(p.action)
            && (p.action !== 'answer' || [0, 1, 2, 3].includes(p.index)) ? { ok: true } : fail('bad-quiz');
        case 'crown': return ['crown', 'huzzah'].includes(p.action ?? 'crown') ? { ok: true } : fail('bad-action');
        case 'charm':
            if (p.action === 'sound') return CHARM_SOUND_IDS.has(p.sound) ? { ok: true } : fail('bad-sound');
            if (p.action === 'point') return finiteIn(p.x, 0, 1) && finiteIn(p.y, 0, 1) ? { ok: true } : fail('bad-point');
            if (p.action === 'spotlight') return shortString(p.studentId, 64) ? { ok: true } : fail('bad-student');
            if (p.action === 'unspot') return { ok: true };
            return fail('bad-action');
        case 'bind': return { ok: true };
        default: return fail('unknown-type');
    }
}

/**
 * Remembers which commands already ran, so a re-delivered one never runs twice.
 * Keeps the last `limit` sequence numbers per Wand.
 */
export function createCommandLedger(limit = 200) {
    const seen = new Map();
    return {
        /** True the first time this (wand, seq) is offered. */
        accept(wandId, seq) {
            const key = `${wandId || 'wand'}:${seq}`;
            if (seen.has(key)) return false;
            seen.set(key, true);
            if (seen.size > limit) seen.delete(seen.keys().next().value);
            return true;
        },
        size: () => seen.size
    };
}

/** True when a command stamped by the server at `createdMs` but sent at `sentAtMs` should be dropped. */
export function isStaleCommand(createdMs, sentAtMs, maxAgeMs = COMMAND_MAX_AGE_MS) {
    if (!Number.isFinite(createdMs) || !Number.isFinite(sentAtMs)) return false;
    return createdMs - sentAtMs > maxAgeMs;
}

/** Whether a projector session still counts as live for the Wand's list. */
export function isHostLive(heartbeatMs, nowMs, liveMs = HOST_LIVE_MS) {
    return Number.isFinite(heartbeatMs) && nowMs - heartbeatMs <= liveMs;
}

// Runes for the short pairing code: easy to read aloud, no look-alikes.
const CODE_ALPHABET = 'ACEFHJKMNPRTWXY3479';
const CODE_RUNES = { A: 'ᚨ', C: 'ᚲ', E: 'ᛖ', F: 'ᚠ', H: 'ᚺ', J: 'ᛃ', K: 'ᚴ', M: 'ᛗ', N: 'ᚾ', P: 'ᛈ', R: 'ᚱ', T: 'ᛏ', W: 'ᚹ', X: 'ᚷ', Y: 'ᛉ', 3: 'ᛒ', 4: 'ᛞ', 7: 'ᛚ', 9: 'ᛟ' };

/** A 4-character code shown under the QR. `random` is injectable for tests. */
export function makeSessionCode(random = Math.random) {
    let code = '';
    for (let i = 0; i < 4; i += 1) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
    return code;
}

/** The rune that decorates each code letter on the projector's binding circle. */
export function runeForCodeChar(ch) {
    return CODE_RUNES[String(ch || '').toUpperCase()] || '✦';
}

/** A session id safe for a Firestore doc id and a URL fragment. */
export function makeSessionId(random = Math.random, nowMs = Date.now()) {
    const rand = Array.from({ length: 10 }, () => Math.floor(random() * 36).toString(36)).join('');
    return `w${nowMs.toString(36)}${rand}`;
}

/** Reads `#wand=<id>` (or `?wand=`) from a location hash/search. */
export function parseWandLink(hash = '', search = '') {
    const pick = (text) => {
        const params = new URLSearchParams(String(text || '').replace(/^[#?]/, ''));
        const id = String(params.get('wand') || '').trim();
        return /^[a-z0-9]{6,40}$/i.test(id) ? id : '';
    };
    return pick(hash) || pick(search);
}

/** The link the binding QR carries. */
export function buildWandLink(origin, pathname, sessionId, schoolId = '') {
    const base = `${String(origin || '').replace(/\/$/, '')}${pathname || '/'}`;
    const school = schoolId ? `school=${encodeURIComponent(schoolId)}&` : '';
    return `${base}#${school}wand=${encodeURIComponent(sessionId)}`;
}

// ─── Gestures ────────────────────────────────────────────────────────────────

/**
 * Star Flick: an upward swipe throws the star. Returns 0 when the movement is not a flick,
 * otherwise 1–3 stars from its speed (px/ms) unless the teacher fixed the size (`fixedStars`).
 */
export function classifyFlick({ dy, dx = 0, dtMs }, { fixedStars = null, minDistance = 60 } = {}) {
    if (!Number.isFinite(dy) || !Number.isFinite(dtMs) || dtMs <= 0) return 0;
    const up = -dy;
    if (up < minDistance) return 0;
    if (Math.abs(dx) > up * 0.9) return 0; // mostly sideways: not a throw
    if ([1, 2, 3].includes(fixedStars)) return fixedStars;
    const speed = up / dtMs;
    if (speed >= 2.2) return 3;
    if (speed >= 1.1) return 2;
    return 1;
}

/** Wheel Slingshot: pull distance (px) → power 0..1 with a soft ease, so small pulls still spin. */
export function slingshotPower(distance, maxDistance = 260) {
    if (!Number.isFinite(distance) || distance <= 0 || !(maxDistance > 0)) return 0;
    const t = Math.min(1, distance / maxDistance);
    return Math.round((1 - Math.pow(1 - t, 2)) * 1000) / 1000;
}

/** The pull must be at least this strong for a release to spin (a nudge does nothing). */
export const SLINGSHOT_MIN_POWER = 0.18;

/**
 * Shake to Summon: feed acceleration magnitudes (m/s², gravity removed); fires once when
 * `needed` strong jolts land inside `windowMs`, then rests for `cooldownMs`.
 */
export function createShakeDetector({ threshold = 14, needed = 3, windowMs = 900, cooldownMs = 1600 } = {}) {
    let hits = [];
    let restUntil = 0;
    return {
        feed(magnitude, tMs) {
            if (!Number.isFinite(magnitude) || !Number.isFinite(tMs)) return false;
            if (tMs < restUntil) return false;
            if (magnitude < threshold) return false;
            hits = hits.filter((t) => tMs - t <= windowMs);
            if (hits.length && tMs - hits[hits.length - 1] < 90) return false; // one jolt, not many samples
            hits.push(tMs);
            if (hits.length >= needed) {
                hits = [];
                restUntil = tMs + cooldownMs;
                return true;
            }
            return false;
        },
        reset() { hits = []; restUntil = 0; }
    };
}

// ─── Stage Pad ───────────────────────────────────────────────────────────────

/** Trims a button's visible text into a short Wand label. */
export function cleanPadLabel(text, max = 34) {
    const clean = String(text || '')
        .replace(/[​-‍﻿]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!clean) return '';
    return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

const ICON_RE = /^fa-[a-z0-9-]+$/;

/**
 * Orders the buttons the projector found into the Wand's Stage Pad.
 * items: [{ id, label, icon?, group?, order?, primary?, explicit?, danger? }] in DOM order.
 * Explicit (`data-remote`) buttons first by their order, then the rest in DOM order; empty and
 * duplicate labels are dropped; at most `max` are kept.
 */
export function buildPadActions(items, max = MAX_PAD_ACTIONS) {
    const list = (Array.isArray(items) ? items : [])
        .map((item, domIndex) => ({ ...item, domIndex, label: cleanPadLabel(item?.label) }))
        .filter((item) => item.label && shortString(item.id, 24));
    const placed = (i) => Number.isFinite(i.x) && Number.isFinite(i.y);
    // Reading order of the projector: buttons in sight first, then row by row (a 4%-of-screen band
    // counts as one row) and left to right. Without positions, page order.
    list.sort((a, b) => {
        if (Boolean(b.explicit) !== Boolean(a.explicit)) return a.explicit ? -1 : 1;
        if (a.explicit && b.explicit) {
            if (Boolean(b.primary) !== Boolean(a.primary)) return a.primary ? -1 : 1;
            const ao = Number.isFinite(a.order) ? a.order : 1000;
            const bo = Number.isFinite(b.order) ? b.order : 1000;
            if (ao !== bo) return ao - bo;
        }
        if (placed(a) && placed(b)) {
            if (Boolean(b.inView) !== Boolean(a.inView)) return a.inView ? -1 : 1;
            const ra = Math.round(a.y / 0.04);
            const rb = Math.round(b.y / 0.04);
            if (ra !== rb) return ra - rb;
            if (a.x !== b.x) return a.x - b.x;
        }
        return a.domIndex - b.domIndex;
    });
    const seen = new Set();
    const out = [];
    const hex = (v) => (HEX_RE.test(v || '') ? v.toLowerCase() : '');
    const unit = (v) => (Number.isFinite(v) ? Math.round(Math.max(-1, Math.min(2, v)) * 1000) / 1000 : null);
    for (const item of list) {
        const key = `${item.group || ''}|${item.label.toLowerCase()}|${placed(item) ? `${Math.round(item.x * 20)}:${Math.round(item.y * 20)}` : ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const action = {
            id: item.id,
            label: item.label,
            icon: ICON_RE.test(item.icon || '') ? item.icon : '',
            group: cleanPadLabel(item.group, 30),
            primary: Boolean(item.primary),
            danger: Boolean(item.danger)
        };
        // How the button looks and where it sits on the projector (only what checks out).
        for (const k of ['bg', 'bg2', 'fg', 'border']) { const v = hex(item[k]); if (v) action[k] = v; }
        if (['pill', 'soft', 'square'].includes(item.round)) action.round = item.round;
        if (placed(item)) { action.x = unit(item.x); action.y = unit(item.y); action.inView = Boolean(item.inView); }
        if (item.iconOnly) action.iconOnly = true;
        // The kind of control, and what it holds right now.
        const kind = PAD_KINDS.includes(item.kind) ? item.kind : 'button';
        if (kind !== 'button') action.kind = kind;
        if (kind === 'tab' || kind === 'toggle') action.on = Boolean(item.on);
        if (kind === 'select') {
            action.options = (Array.isArray(item.options) ? item.options : []).slice(0, 16)
                .map((o) => ({ label: cleanPadLabel(o?.label, 40) || String(o?.value ?? '').slice(0, 40), value: String(o?.value ?? '').slice(0, 60) }))
                .filter((o) => o.label);
            action.value = String(item.value ?? '').slice(0, 60);
        }
        if (kind === 'text') {
            action.value = String(item.value ?? '').slice(0, 300);
            action.placeholder = cleanPadLabel(item.placeholder, 60);
            action.multiline = Boolean(item.multiline);
            action.inputType = TEXT_TYPES.has(item.inputType) ? item.inputType : 'text';
        }
        out.push(action);
        if (out.length >= max) break;
    }
    return out;
}

/** A stable string for "did the stage change?" (key order independent). */
export function stageFingerprint(value) {
    const walk = (v) => {
        if (Array.isArray(v)) return `[${v.map(walk).join(',')}]`;
        if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${k}:${walk(v[k])}`).join(',')}}`;
        return JSON.stringify(v ?? null);
    };
    return walk(value);
}

/**
 * What the projector tells the Wand about the screen. Only labels and ids travel: no grades,
 * notes or private text. The quiz answer travels in the separate `secret` field (never drawn).
 */
export function buildStageSummary({ surface = 'tab', tab = '', title = '', classId = '', padActions = [], panel = null, lastResult = null, scrollable = false } = {}) {
    const summary = {
        surface: cleanPadLabel(surface, 24) || 'tab',
        tab: CAST_TAB_IDS.includes(tab) ? tab : '',
        title: cleanPadLabel(title, 60),
        classId: typeof classId === 'string' ? classId.slice(0, 64) : '',
        pad: buildPadActions(padActions),
        scrollable: Boolean(scrollable)
    };
    if (panel && typeof panel === 'object') summary.panel = sanitizePanel(panel);
    if (lastResult && typeof lastResult === 'object') {
        summary.lastResult = {
            seq: Number.isInteger(lastResult.seq) ? lastResult.seq : -1,
            ok: Boolean(lastResult.ok),
            message: cleanPadLabel(lastResult.message, 90)
        };
    }
    return summary;
}

const PANEL_KINDS = new Set(['wheel', 'picker', 'quiz', 'showdown', 'wall', 'dragon', 'timer', 'crown']);

/** The label a timer of `seconds` carries on the projector (presets keep their routine names). */
export function timerLabelFor(seconds) {
    const preset = { 30: 'Think', 60: 'Pair', 90: 'Share' }[seconds];
    if (preset) return preset;
    const m = Math.round(seconds / 60);
    return seconds % 60 === 0 && m >= 1 ? `${m} min` : 'Timer';
}

/** Recent spells: newest first, at most `max`, each { at, ok, text }. Pure, so the Wand and tests share it. */
export function pushSpellLog(log, entry, max = 12) {
    const text = cleanPadLabel(entry?.text, 90);
    if (!text) return Array.isArray(log) ? log : [];
    const next = [{ at: Number(entry.at) || 0, ok: entry.ok !== false, text }, ...(Array.isArray(log) ? log : [])];
    return next.slice(0, max);
}

function sanitizePanel(panel) {
    if (!PANEL_KINDS.has(panel.kind)) return null;
    const out = { kind: panel.kind };
    for (const [key, value] of Object.entries(panel)) {
        if (key === 'kind') continue;
        if (typeof value === 'string') out[key] = value.slice(0, 120);
        else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
        else if (typeof value === 'boolean') out[key] = value;
        else if (Array.isArray(value)) out[key] = value.slice(0, 8).map((v) => (typeof v === 'object' && v ? sanitizeFlat(v) : v));
    }
    return out;
}

function sanitizeFlat(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') out[k] = v.slice(0, 80);
        else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
        else if (typeof v === 'boolean') out[k] = v;
    }
    return out;
}

// ─── Showdown Arena (Kahoot-style team race, no student devices) ─────────────

export const SHOWDOWN_COLORS = Object.freeze(['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#ec4899', '#14b8a6', '#f97316']);
const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Nursery and Pre-Junior play the Growth Festival way: no ranks, stars or numbers on the screen. */
export function isGrowthLeague(level) {
    return level === 'Nursery' || level === 'Pre-Junior';
}

export const SHOWDOWN_SHAPES = Object.freeze(['▲', '◆', '●', '■', '★', '⬟', '⬢', '✚']);

/**
 * A new showdown. teams: [{ name, members?: string[] }] (2–8). `growth` (Nursery / Pre-Junior)
 * keeps every number off the screen: teams grow flowers, nobody ranks.
 */
export function createShowdown(teams, { growth = false, title = 'Showdown' } = {}) {
    const list = (Array.isArray(teams) ? teams : []).slice(0, 8);
    return {
        title: cleanPadLabel(title, 40) || 'Showdown',
        growth: Boolean(growth),
        round: 1,
        finished: false,
        golden: false,
        teams: list.map((t, i) => ({
            name: cleanPadLabel(t?.name, 28) || `Team ${i + 1}`,
            members: (Array.isArray(t?.members) ? t.members : []).slice(0, 12),
            score: 0,
            streak: 0,
            color: HEX_RE.test(t?.color || '') ? t.color : SHOWDOWN_COLORS[i % SHOWDOWN_COLORS.length],
            shape: SHOWDOWN_SHAPES[i % SHOWDOWN_SHAPES.length],
            emoji: typeof t?.emoji === 'string' ? t.emoji.slice(0, 4) : ''
        })),
        lastScorer: -1
    };
}

/**
 * One point (or `points`) to a team; the streak grows when the same team scores again.
 * A Golden Question (sd.golden) doubles the next point and is then spent.
 */
export function scoreShowdown(sd, teamIndex, points = 1) {
    if (!sd || sd.finished || !sd.teams[teamIndex]) return sd;
    if (points > 0 && sd.golden) points *= 2;
    const teams = sd.teams.map((t, i) => {
        if (i !== teamIndex) return { ...t, streak: points > 0 ? 0 : t.streak };
        const score = Math.max(0, t.score + points);
        const streak = points > 0 ? (sd.lastScorer === teamIndex ? t.streak + 1 : 1) : 0;
        return { ...t, score, streak };
    });
    return {
        ...sd, teams, lastScorer: points > 0 ? teamIndex : sd.lastScorer,
        round: points > 0 ? sd.round + 1 : sd.round, golden: points > 0 ? false : Boolean(sd.golden)
    };
}

/** Standings with shared places for ties (1, 1, 3). */
export function showdownStandings(sd) {
    const order = (sd?.teams || []).map((t, index) => ({ ...t, index }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
    let place = 0;
    let lastScore = null;
    return order.map((t, i) => {
        if (t.score !== lastScore) { place = i + 1; lastScore = t.score; }
        return { ...t, place };
    });
}

/** Indices of the winning team(s); empty while nobody has scored. */
export function showdownWinners(sd) {
    const standings = showdownStandings(sd);
    if (!standings.length || standings[0].score === 0) return [];
    return standings.filter((t) => t.place === 1).map((t) => t.index);
}

/** Bar heights 0..1 for the projector (relative to the leader, never below a visible stub). */
export function showdownBarLevels(sd) {
    const max = Math.max(0, ...(sd?.teams || []).map((t) => t.score));
    return (sd?.teams || []).map((t) => (max === 0 ? 0.06 : Math.max(0.06, t.score / max)));
}

/** What the Wand shows of a showdown (Growth Festival: no scores). */
export function showdownPanel(sd) {
    if (!sd) return null;
    return {
        kind: 'showdown',
        growth: sd.growth,
        finished: sd.finished,
        round: sd.round,
        golden: Boolean(sd.golden),
        teams: sd.teams.map((t) => (sd.growth
            ? { name: t.name, color: t.color, shape: t.shape, emoji: t.emoji }
            : { name: t.name, color: t.color, shape: t.shape, emoji: t.emoji, score: t.score, streak: t.streak }))
    };
}

// ─── Timers ──────────────────────────────────────────────────────────────────

/** "1:05" / "0:09". */
export function formatTimerClock(ms) {
    const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

/** Remaining fraction 1 → 0 of a timer. */
export function timerFraction(remainingMs, totalMs) {
    if (!(totalMs > 0)) return 0;
    return Math.max(0, Math.min(1, remainingMs / totalMs));
}
