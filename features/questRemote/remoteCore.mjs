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

/** What the Wand can ask of a Showdown. */
export const SHOWDOWN_ACTIONS = Object.freeze(['open', 'point', 'minus', 'next', 'finish', 'close', 'reward', 'timer', 'golden', 'undo', 'blind', 'pass', 'rematch', 'reveal', 'stopclock']);

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
            if (!SHOWDOWN_ACTIONS.includes(p.action)) return fail('bad-action');
            if (p.team != null && !(Number.isInteger(p.team) && p.team >= 0 && p.team < 8)) return fail('bad-team');
            if (p.points != null && ![1, 2, 3].includes(p.points)) return fail('bad-points');
            if (p.seconds != null && !SHOWDOWN_CLOCKS.includes(p.seconds)) return fail('bad-seconds');
            if (p.action === 'reward') {
                if (p.scope != null && !SHOWDOWN_REWARD_SCOPES.includes(p.scope)) return fail('bad-scope');
                if (p.stars != null && ![1, 2, 3].includes(p.stars)) return fail('bad-stars');
            }
            if (p.action === 'open') {
                if (p.split != null && !SHOWDOWN_SPLITS.includes(p.split)) return fail('bad-split');
                if (p.teams != null && !validShowdownTeams(p.teams)) return fail('bad-teams');
                // rules travel as one map (a command holds at most 12 keys); an older Wand sends them flat
                if (p.rules != null && (typeof p.rules !== 'object' || Array.isArray(p.rules))) return fail('bad-rule');
                const problem = showdownRulesProblem(p.rules || p);
                if (problem) return fail(problem);
            }
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
// The teacher builds the teams on the Wand (the Team Forge), sets the rules, then runs the show:
// every point, bonus, hot seat and undo is decided here so the phone, the projector and the tests agree.
// Teams last for one show only: a guild split uses the guilds as they are and never moves anyone.

export const SHOWDOWN_COLORS = Object.freeze(['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#ec4899', '#14b8a6', '#f97316']);
const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Nursery and Pre-Junior play the Growth Festival way: no ranks, stars or numbers on the screen. */
export function isGrowthLeague(level) {
    return level === 'Nursery' || level === 'Pre-Junior';
}

export const SHOWDOWN_SHAPES = Object.freeze(['▲', '◆', '●', '■', '★', '⬟', '⬢', '✚']);

/** How the Team Forge splits the room: fair on stars, guilds mixed, pure luck, the guilds as teams, today's Team Maker teams, or everyone against the Dragon. */
export const SHOWDOWN_SPLITS = Object.freeze(['fair', 'mixed', 'random', 'guilds', 'today', 'dragon']);
/** Buzz in: one team answers and the point ends the question. Everyone: every team writes an answer, several can score, then Next. */
export const SHOWDOWN_STYLES = Object.freeze(['buzz', 'all']);
export const SHOWDOWN_GOALS = Object.freeze(['open', 'points', 'questions']);
/** Seconds the answer clock can run (a stopwatch tap or a timer command). */
export const SHOWDOWN_CLOCKS = Object.freeze([5, 10, 20, 30]);
/** The Forge's clock choice: 0 is "Off" (no clock at all). */
export const SHOWDOWN_CLOCK_CHOICES = Object.freeze([0, ...SHOWDOWN_CLOCKS]);
/** Where the questions come from: the teacher's own voice, past Quiz of the Week questions, the book's words, or both. */
export const SHOWDOWN_DECKS = Object.freeze(['voice', 'quiz', 'words', 'mix']);
export const SHOWDOWN_GOAL_MIN = 3;
export const SHOWDOWN_GOAL_MAX = 30;
export const SHOWDOWN_MAX_MEMBERS = 40;
export const SHOWDOWN_REWARD_SCOPES = Object.freeze(['winners', 'all', 'stars']);
export const SHOWDOWN_RULES_DEFAULT = Object.freeze({ style: 'buzz', goal: 'open', goalN: 10, clock: 0, autoClock: true, streak: true, underdog: false, hotseat: false, deck: 'voice' });
const SHOWDOWN_RULE_FLAGS = Object.freeze(['streak', 'underdog', 'hotseat', 'autoClock']);

/** Why a set of rules from a command is not acceptable ('' when it is). Missing rules are fine (defaults). */
function showdownRulesProblem(r) {
    if (r.style != null && !SHOWDOWN_STYLES.includes(r.style)) return 'bad-style';
    if (r.goal != null && !SHOWDOWN_GOALS.includes(r.goal)) return 'bad-goal';
    if (r.goalN != null && !(Number.isInteger(r.goalN) && r.goalN >= SHOWDOWN_GOAL_MIN && r.goalN <= SHOWDOWN_GOAL_MAX)) return 'bad-goal';
    if (r.clock != null && !SHOWDOWN_CLOCK_CHOICES.includes(r.clock)) return 'bad-clock';
    if (r.deck != null && !SHOWDOWN_DECKS.includes(r.deck)) return 'bad-deck';
    for (const k of SHOWDOWN_RULE_FLAGS) if (r[k] != null && typeof r[k] !== 'boolean') return 'bad-rule';
    return '';
}
const HISTORY_KEEP = 25;

/** Rules from anywhere (the phone's saved choice, a command) made safe; unknown values fall back to the defaults. */
export function normalizeShowdownRules(raw = {}) {
    const d = SHOWDOWN_RULES_DEFAULT;
    const r = raw && typeof raw === 'object' ? raw : {};
    const n = Math.round(Number(r.goalN));
    return {
        style: SHOWDOWN_STYLES.includes(r.style) ? r.style : d.style,
        goal: SHOWDOWN_GOALS.includes(r.goal) ? r.goal : d.goal,
        goalN: Number.isFinite(n) ? Math.min(SHOWDOWN_GOAL_MAX, Math.max(SHOWDOWN_GOAL_MIN, n)) : d.goalN,
        clock: r.clock != null && SHOWDOWN_CLOCK_CHOICES.includes(Number(r.clock)) ? Number(r.clock) : d.clock,
        autoClock: typeof r.autoClock === 'boolean' ? r.autoClock : d.autoClock,
        streak: typeof r.streak === 'boolean' ? r.streak : d.streak,
        underdog: typeof r.underdog === 'boolean' ? r.underdog : d.underdog,
        hotseat: typeof r.hotseat === 'boolean' ? r.hotseat : d.hotseat,
        deck: SHOWDOWN_DECKS.includes(r.deck) ? r.deck : d.deck
    };
}

function shuffled(list, rng = Math.random) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * A new showdown. teams: [{ name, members?, color?, emoji?, dragon? }] (2–8). `growth` (Nursery /
 * Pre-Junior) keeps every number off the screen: teams grow flowers, nobody ranks, no bonuses, and a
 * "first to N points" goal becomes "N questions". The hot seat order is shuffled once per show.
 */
export function createShowdown(teams, { growth = false, title = 'Showdown', rules = null, rng = Math.random } = {}) {
    const list = (Array.isArray(teams) ? teams : []).slice(0, 8);
    const r = normalizeShowdownRules(rules || {});
    if (growth) Object.assign(r, { streak: false, underdog: false, goal: r.goal === 'points' ? 'questions' : r.goal });
    // Class against the Dragon: an answer is right or wrong, never both, so one side takes each question
    if (list.some((t) => t?.dragon)) r.style = 'buzz';
    return {
        title: cleanPadLabel(title, 40) || 'Showdown',
        growth: Boolean(growth),
        rules: r,
        round: 1,
        finished: false,
        golden: false,
        blind: false,
        reached: false,
        teams: list.map((t, i) => {
            const members = (Array.isArray(t?.members) ? t.members : []).map(String).filter(Boolean).slice(0, SHOWDOWN_MAX_MEMBERS);
            return {
                name: cleanPadLabel(t?.name, 28) || `Team ${i + 1}`,
                members,
                order: shuffled(members, rng),
                seat: 0,
                dragon: Boolean(t?.dragon),
                score: 0,
                streak: 0,
                color: HEX_RE.test(t?.color || '') ? t.color : SHOWDOWN_COLORS[i % SHOWDOWN_COLORS.length],
                shape: SHOWDOWN_SHAPES[i % SHOWDOWN_SHAPES.length],
                emoji: typeof t?.emoji === 'string' ? t.emoji.slice(0, 4) : ''
            };
        }),
        lastScorer: -1,
        roundScorers: [],
        prevScorers: [],
        credits: {},
        lastGain: null,
        history: []
    };
}

/** The same teams and rules, every score back to zero (and a fresh hot seat order). */
export function rematchShowdown(sd, { rng = Math.random } = {}) {
    if (!sd) return sd;
    return createShowdown(sd.teams.map((t) => ({ name: t.name, members: t.members, color: t.color, emoji: t.emoji, dragon: t.dragon })),
        { growth: sd.growth, title: sd.title, rules: sd.rules, rng });
}

/** Who is in the hot seat for a team right now ('' when the hot seat is off or the team has nobody). */
export function showdownAnswerer(sd, teamIndex) {
    const t = sd?.teams?.[teamIndex];
    if (!t || !sd.rules?.hotseat || t.dragon || !t.order.length) return '';
    return t.order[t.seat % t.order.length];
}

function snapshotOf(sd) {
    return {
        scores: sd.teams.map((t) => [t.score, t.streak, t.seat]),
        round: sd.round, golden: sd.golden, finished: sd.finished, reached: sd.reached, lastScorer: sd.lastScorer,
        roundScorers: [...sd.roundScorers], prevScorers: [...sd.prevScorers], credits: { ...sd.credits }
    };
}

function withHistory(sd) {
    return [...(sd.history || []), snapshotOf(sd)].slice(-HISTORY_KEEP);
}

function goalReached(sd) {
    const r = sd.rules || SHOWDOWN_RULES_DEFAULT;
    if (r.goal === 'points') return sd.teams.some((t) => t.score >= r.goalN);
    if (r.goal === 'questions') return sd.round > r.goalN;
    return false;
}

/** The question is over: streaks of teams that did not score break, the hot seats move on, golden is spent. */
function advance(sd) {
    const scored = new Set(sd.roundScorers);
    const teams = sd.teams.map((t, i) => ({
        ...t,
        streak: scored.has(i) ? t.streak : 0,
        seat: sd.rules?.hotseat && !t.dragon && t.order.length ? (t.seat + 1) % t.order.length : t.seat
    }));
    return { ...sd, teams, round: sd.round + 1, prevScorers: [...scored], roundScorers: [], golden: false };
}

/**
 * `points` (1–3, or negative for a penalty) to a team. A Golden Question doubles a gain. With the
 * Streak bonus, every third question in a row earns +1; with the Underdog boost, a team 3+ behind the
 * leader earns +1. In Buzz-in style the point ends the question; in Everyone style several teams can
 * score, each once per question for streaks and bonuses, until Next. The hot seat hero is credited.
 */
export function scoreShowdown(sd, teamIndex, points = 1) {
    if (!sd || sd.finished || !sd.teams[teamIndex]) return sd;
    const base = Math.round(Number(points) || 0);
    if (!base) return sd;
    const history = withHistory(sd);
    const rules = sd.rules || SHOWDOWN_RULES_DEFAULT;
    const team = sd.teams[teamIndex];
    if (base < 0) {
        const teams = sd.teams.map((t, i) => (i === teamIndex ? { ...t, score: Math.max(0, t.score + base), streak: 0 } : t));
        return { ...sd, teams, history, lastGain: { team: teamIndex, total: base, bonus: [] } };
    }
    const first = !sd.roundScorers.includes(teamIndex);
    let gain = base * (sd.golden ? 2 : 1);
    const bonus = [];
    const leader = Math.max(0, ...sd.teams.map((t) => t.score));
    if (rules.underdog && first && !sd.growth && leader - team.score >= 3) { gain += 1; bonus.push('underdog'); }
    const streak = first ? (sd.prevScorers.includes(teamIndex) ? team.streak + 1 : 1) : team.streak;
    if (rules.streak && first && !sd.growth && streak >= 3 && streak % 3 === 0) { gain += 1; bonus.push('streak'); }
    const seated = showdownAnswerer(sd, teamIndex);
    const credits = seated ? { ...sd.credits, [seated]: (sd.credits[seated] || 0) + gain } : sd.credits;
    const teams = sd.teams.map((t, i) => (i === teamIndex ? { ...t, score: t.score + gain, streak } : t));
    let out = {
        ...sd, teams, credits, history, lastScorer: teamIndex,
        roundScorers: first ? [...sd.roundScorers, teamIndex] : sd.roundScorers,
        lastGain: { team: teamIndex, total: gain, bonus, golden: Boolean(sd.golden), answerer: seated }
    };
    if (rules.style !== 'all') out = advance(out);
    return { ...out, reached: goalReached(out) };
}

/** Next question (in Buzz-in style: nobody got it). */
export function nextShowdownQuestion(sd) {
    if (!sd || sd.finished) return sd;
    const out = advance({ ...sd, history: withHistory(sd), lastGain: null });
    return { ...out, reached: goalReached(out) };
}

/** The hot seat passes to the next hero in every team without ending the question. */
export function passShowdownSeats(sd) {
    if (!sd || sd.finished || !sd.rules?.hotseat) return sd;
    const teams = sd.teams.map((t) => (t.dragon || !t.order.length ? t : { ...t, seat: (t.seat + 1) % t.order.length }));
    return { ...sd, teams, history: withHistory(sd) };
}

export function finishShowdown(sd) {
    if (!sd || sd.finished) return sd;
    return { ...sd, history: withHistory(sd), finished: true, golden: false };
}

/** One step back (a point, a penalty, a Next, a finish). */
export function undoShowdown(sd) {
    const last = sd?.history?.[sd.history.length - 1];
    if (!last) return sd;
    const teams = sd.teams.map((t, i) => {
        const [score, streak, seat] = last.scores[i] || [t.score, t.streak, t.seat];
        return { ...t, score, streak, seat };
    });
    return {
        ...sd, teams, round: last.round, golden: last.golden, finished: last.finished, reached: last.reached,
        lastScorer: last.lastScorer, roundScorers: last.roundScorers, prevScorers: last.prevScorers, credits: last.credits,
        history: sd.history.slice(0, -1), lastGain: null
    };
}

/**
 * Heroes marked absent leave the show: out of their team, the hot seat order and the star players.
 * The hero at the microphone keeps it when still here; otherwise the next hero in line takes it.
 * Scores stay (a team keeps what it won). Returns the same object when nobody had to leave.
 */
export function removeShowdownMembers(sd, ids) {
    const gone = new Set([...(ids || [])].map(String));
    if (!sd || !gone.size || !sd.teams.some((t) => t.members.some((id) => gone.has(id)))) return sd;
    const teams = sd.teams.map((t) => {
        if (!t.members.some((id) => gone.has(id))) return t;
        const len = t.order.length;
        const seat = len ? t.seat % len : 0;
        // the first hero from the current seat onwards who is still here keeps (or takes) the microphone
        let next = '';
        for (let k = 0; k < len; k++) {
            const id = t.order[(seat + k) % len];
            if (!gone.has(id)) { next = id; break; }
        }
        const order = t.order.filter((id) => !gone.has(id));
        return { ...t, members: t.members.filter((id) => !gone.has(id)), order, seat: next ? order.indexOf(next) : 0 };
    });
    const credits = Object.fromEntries(Object.entries(sd.credits || {}).filter(([id]) => !gone.has(id)));
    return { ...sd, teams, credits };
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

/** The heroes the hot seat credited most (up to three, ties kept together), as [{ id, pts }]. */
export function showdownStarPlayers(sd, max = 3) {
    const list = Object.entries(sd?.credits || {}).filter(([, pts]) => pts > 0).sort((a, b) => b[1] - a[1]);
    if (!list.length) return [];
    const cut = list[Math.min(max, list.length) - 1][1];
    return list.filter(([, pts]) => pts >= cut).slice(0, max + 2).map(([id, pts]) => ({ id, pts }));
}

/**
 * Bar heights 0..1 for the projector: towards the finish line in a "first to N" race, otherwise
 * relative to the leader (never below a visible stub).
 */
export function showdownBarLevels(sd) {
    const teams = sd?.teams || [];
    if (sd?.rules?.goal === 'points') return teams.map((t) => Math.min(1, Math.max(0.06, t.score / sd.rules.goalN)));
    const max = Math.max(0, ...teams.map((t) => t.score));
    return teams.map((t) => (max === 0 ? 0.06 : Math.max(0.06, t.score / max)));
}

/** The heroes a reward reaches: the winners' members, everyone who played, or the star players. */
export function showdownRewardIds(sd, scope = 'winners') {
    if (!sd) return [];
    if (scope === 'stars') return showdownStarPlayers(sd).map((p) => p.id);
    const teams = scope === 'all' || sd.growth ? sd.teams : showdownWinners(sd).map((i) => sd.teams[i]);
    return [...new Set(teams.flatMap((t) => t.members))];
}

/** "Question 3 of 10", "First to 10", or "Question 3". */
export function showdownGoalText(sd) {
    const r = sd?.rules || SHOWDOWN_RULES_DEFAULT;
    if (r.goal === 'questions') return `Question ${Math.min(sd.round, r.goalN)} of ${r.goalN}`;
    if (r.goal === 'points') return `First to ${r.goalN}`;
    return `Question ${sd?.round ?? 1}`;
}

/** What the Wand shows of a showdown (Growth Festival: no scores). `nameOf(id)` gives a hero's first name. */
export function showdownPanel(sd, nameOf = () => '') {
    if (!sd) return null;
    const r = sd.rules || SHOWDOWN_RULES_DEFAULT;
    const stars = sd.growth ? [] : showdownStarPlayers(sd).slice(0, 3).map((p) => ({ name: String(nameOf(p.id) || 'Hero'), pts: p.pts }));
    return {
        kind: 'showdown',
        growth: sd.growth,
        finished: sd.finished,
        round: sd.round,
        golden: Boolean(sd.golden),
        blind: Boolean(sd.blind),
        reached: Boolean(sd.reached),
        style: r.style,
        goal: r.goal,
        goalN: r.goalN,
        clockSecs: r.clock,
        autoClock: Boolean(r.clock && r.autoClock),
        hotseat: r.hotseat,
        undo: Boolean(sd.history?.length),
        goalText: showdownGoalText(sd),
        stars,
        teams: sd.teams.map((t, i) => {
            const base = {
                name: t.name, color: t.color, shape: t.shape, emoji: t.emoji, dragon: Boolean(t.dragon),
                got: sd.roundScorers.includes(i), hot: String(nameOf(showdownAnswerer(sd, i)) || ''), size: t.members.length
            };
            return sd.growth ? base : { ...base, score: t.score, streak: t.streak };
        })
    };
}

// ─── The Team Forge (the Wand splits the room for one show) ────────────────────

const DRAGON_LOOK = Object.freeze({ name: 'The Dragon', color: '#dc2626', emoji: '🐉' });

/**
 * Splits the heroes who are here. heroes: [{ id, guildId?, stars?, away? }]. Returns
 * [{ ids: string[], guild?: string, dragon?: true }]. `makeTeams` is Team Maker's own splitter
 * (fair on stars, guilds mixed, luck; never the same pairs as last time when `pastSets` is given).
 */
export function forgeShowdownTeams({ heroes = [], split = 'fair', count = 2, today = null, pastSets = [], makeTeams = null, rng = Math.random } = {}) {
    const here = (heroes || []).filter((h) => h && h.id != null && !h.away).map((h) => ({ ...h, id: String(h.id) }));
    if (!here.length) return [];
    const ids = here.map((h) => h.id);
    if (split === 'dragon') return [{ ids }, { ids: [], dragon: true }];
    if (split === 'today') {
        const present = new Set(ids);
        const sets = (today?.teams || []).map((t) => (Array.isArray(t) ? t : t?.ids || []).map(String).filter((id) => present.has(id))).filter((t) => t.length);
        return sets.length >= 2 ? sets.slice(0, 8).map((t) => ({ ids: t })) : [];
    }
    if (split === 'guilds') {
        const byGuild = new Map();
        const loose = [];
        here.forEach((h) => { if (h.guildId) byGuild.set(h.guildId, [...(byGuild.get(h.guildId) || []), h.id]); else loose.push(h.id); });
        if (byGuild.size < 2) return [];
        const teams = [...byGuild.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).slice(0, 8).map(([guild, members]) => ({ ids: members, guild }));
        // a hero with no guild yet plays with the smallest guild for this show only
        loose.forEach((id) => { teams.reduce((a, b) => (b.ids.length < a.ids.length ? b : a)).ids.push(id); });
        return teams;
    }
    if (typeof makeTeams !== 'function') return [];
    const mode = split === 'fair' ? 'stars' : split === 'mixed' ? 'guild' : 'random';
    const { teams } = makeTeams({ heroes: here, count, mode, avoidPairs: Boolean(pastSets?.length), pastSets, rng });
    return (teams || []).filter((t) => t.length).map((t) => ({ ids: t }));
}

/**
 * Names, colours and badges of forged teams: guilds look like their guild, the Dragon like a dragon,
 * everything else wears Team Maker's banners (`bannerOf(i)` → { short, primary, emoji }).
 */
export function showdownTeamLooks(split, teams, { guildOf = () => null, bannerOf = () => null, classLook = null } = {}) {
    return (teams || []).map((t, i) => {
        if (t.dragon) return { ...DRAGON_LOOK, dragon: true };
        if (split === 'dragon') return { name: classLook?.name || 'The Class', color: '#38bdf8', emoji: classLook?.emoji || '🛡️' };
        if (split === 'guilds' && t.guild) {
            const g = guildOf(t.guild);
            if (g) return { name: g.name || 'Guild', color: g.primary || SHOWDOWN_COLORS[i % SHOWDOWN_COLORS.length], emoji: g.emoji || '🛡️' };
        }
        const b = bannerOf(i);
        return b ? { name: b.short || b.name, color: b.primary, emoji: b.emoji } : { name: `Team ${i + 1}`, color: SHOWDOWN_COLORS[i % SHOWDOWN_COLORS.length], emoji: '' };
    });
}

/** The forged teams as they travel in an `open` command (no nested arrays: Firestore refuses them). */
export function packShowdownTeams(teams) {
    return (teams || []).slice(0, 8).map((t) => {
        const out = { ids: (t.ids || []).map(String).slice(0, SHOWDOWN_MAX_MEMBERS) };
        if (t.guild) out.guild = String(t.guild).slice(0, 64);
        if (t.dragon) out.dragon = true;
        return out;
    });
}

function validShowdownTeams(teams) {
    if (!Array.isArray(teams) || teams.length < 2 || teams.length > 8) return false;
    return teams.every((t) => t && typeof t === 'object' && !Array.isArray(t)
        && Array.isArray(t.ids) && t.ids.length <= SHOWDOWN_MAX_MEMBERS && t.ids.every((id) => shortString(id, 64))
        && (t.guild == null || shortString(t.guild, 64)) && (t.dragon == null || typeof t.dragon === 'boolean'));
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
