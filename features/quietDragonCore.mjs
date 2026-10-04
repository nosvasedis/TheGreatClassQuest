// features/quietDragonCore.mjs — rules for the Quiet Dragon (noise meter).
// Pure: no DOM, no microphone, no Firebase. The stage (ui/modals/quietDragon.js) feeds it one
// loudness reading a few times a second; the reward is paid by db/actions/quietDragon.js.
//
// How the dragon listens: the first seconds measure how quiet this room is (the "floor"). The
// teacher's level sets how far above that floor the class may go. Short bumps (a cough, a chair)
// only make the dragon stir; it wakes only when the room stays loud for a couple of seconds.
// While it is awake the calm clock waits; it never runs backwards and nothing is ever taken away.

export const QUIET_LEVELS = [
    { key: 'test', name: 'Test silence', hint: 'Pin-drop quiet, for tests', margin: 7 },
    { key: 'whisper', name: 'Whispers', hint: 'Writing time, whispers only', margin: 12 },
    { key: 'soft', name: 'Soft voices', hint: 'Quiet partner work', margin: 18 }
];

export const QUIET_MINUTES = [5, 10, 15, 20, 30];
export const DEFAULT_MINUTES = 15;
export const HOARD_PIECES = 8;

export const CALIBRATE_SECONDS = 3;
const FLOOR_MIN = -78;
const FLOOR_MAX = -32;
const WAKE_RATE = 1.15;       // annoyance per second for each "threshold" of extra noise
const CALM_RATE = 0.32;       // annoyance that fades per second once the room is quiet again
const MAX_OVER = 1.0;         // a door slam counts no more than a loud voice
const SETTLE_QUIET_S = 4;     // quiet seconds needed before an awake dragon lies back down
const SETTLE_ANIM_S = 2.5;    // the lying-down itself (still counts as calm)
const TUNE_STEP_DB = 2;
const TUNE_LIMIT_DB = 10;

export function levelByKey(key) {
    return QUIET_LEVELS.find((l) => l.key === key) || QUIET_LEVELS[1];
}

export function clampMinutes(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return DEFAULT_MINUTES;
    return Math.min(60, Math.max(1, n));
}

/** Root-mean-square of a block of samples (-1..1), in decibels below full scale. */
export function rmsDb(samples) {
    if (!samples?.length) return -100;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / samples.length);
    return Math.max(-100, 20 * Math.log10(Math.max(rms, 1e-5)));
}

/** The room's quiet level from the calibration readings: a low-ish percentile, kept in a sane range. */
export function calibrateFloor(readings = []) {
    const clean = readings.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (!clean.length) return -55;
    const at = clean[Math.min(clean.length - 1, Math.floor(clean.length * 0.4))];
    return Math.min(FLOOR_MAX, Math.max(FLOOR_MIN, at));
}

/** The teacher's fine-tune (in dB, + makes the dragon sleep deeper), kept within limits. */
export function tuneBy(current, direction) {
    const next = (Number(current) || 0) + Math.sign(direction) * TUNE_STEP_DB;
    return Math.max(-TUNE_LIMIT_DB, Math.min(TUNE_LIMIT_DB, next));
}

/**
 * The dragon's ears. `step(db, dt)` takes one reading (dBFS) and the seconds since the last one and
 * returns { mood, ratio, annoyance, woke } where mood is asleep | stirring | peeking | awake | settling,
 * ratio is the smoothed loudness (0 at the floor, 1 at the limit) and woke is true on the reading that
 * woke it. `held` (teacher speaking) freezes everything.
 */
export function createDragonEars({ floor = -55, margin = 12, tune = 0 } = {}) {
    const ears = {
        floor, margin, tune,
        mood: 'asleep', ratio: 0, annoyance: 0, quietFor: 0, settleLeft: 0, wakes: 0,
        step(db, dt = 0.15, { held = false } = {}) {
            const seconds = Math.max(0, Math.min(1, Number(dt) || 0));
            if (held) return ears.snapshot(false);
            const raw = (Number(db) - ears.floor) / Math.max(3, ears.margin + ears.tune);
            const target = Math.max(0, raw);
            // Quick to hear, slow to forget: the meter rises fast and falls gently.
            const k = target > ears.ratio ? 0.6 : 0.22;
            ears.ratio += (target - ears.ratio) * k;
            let woke = false;

            if (ears.mood === 'awake') {
                ears.quietFor = ears.ratio < 0.75 ? ears.quietFor + seconds : 0;
                if (ears.quietFor >= SETTLE_QUIET_S) {
                    ears.mood = 'settling';
                    ears.settleLeft = SETTLE_ANIM_S;
                    ears.annoyance = 0.2;
                    ears.quietFor = 0;
                }
                return ears.snapshot(false);
            }

            if (raw > 1) ears.annoyance += (Math.min(raw, 1 + MAX_OVER) - 1) * WAKE_RATE * seconds;
            else ears.annoyance -= CALM_RATE * seconds;
            ears.annoyance = Math.max(0, Math.min(1, ears.annoyance));

            if (ears.annoyance >= 1) {
                ears.mood = 'awake';
                ears.wakes += 1;
                ears.quietFor = 0;
                woke = true;
                return ears.snapshot(woke);
            }

            if (ears.mood === 'settling') {
                ears.settleLeft -= seconds;
                if (ears.settleLeft > 0) return ears.snapshot(false);
            }
            ears.mood = moodFor(ears.ratio, ears.annoyance);
            return ears.snapshot(false);
        },
        snapshot(woke) {
            return { mood: ears.mood, ratio: ears.ratio, annoyance: ears.annoyance, woke, wakes: ears.wakes };
        }
    };
    return ears;
}

function moodFor(ratio, annoyance) {
    if (annoyance >= 0.55 || ratio >= 1.05) return 'peeking';
    if (annoyance >= 0.15 || ratio >= 0.6) return 'stirring';
    return 'asleep';
}

/** Calm time only grows while the dragon sleeps (stirring is fine) and the teacher is not speaking. */
export function countsAsCalm(mood, held = false) {
    return !held && mood !== 'awake';
}

/** How many hoard pieces are showing for this much progress (0..1). */
export function hoardPiecesFor(progress) {
    return Math.max(0, Math.min(HOARD_PIECES, Math.floor((Number(progress) || 0) * HOARD_PIECES + 1e-9)));
}

export function formatClock(seconds) {
    const s = Math.max(0, Math.ceil(Number(seconds) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ─── The dragon's gift ──────────────────────────────────────────────────────────

/** Gifts the app hands out by itself (one, or none). */
export const HOARD_GIFTS = [
    { key: 'none', name: 'Just the treat', hint: 'Only the classroom treat below', amounts: [] },
    { key: 'gold', name: "Dragon's Gold", hint: 'Gold for every hero here', amounts: [1, 2, 3], unit: 'Gold' },
    { key: 'stars', name: 'Calm Star', hint: 'A star for every hero here', amounts: [0.5, 1], unit: 'star' },
    { key: 'quest', name: 'Team Quest boost', hint: "Pushes the class's Team Quest", amounts: [1, 2], unit: 'Team Quest bonus' }
];

/** Ready-made classroom treats the teacher gives in person (or their own words). */
export const CLASS_TREATS = [
    '5 minutes of free time',
    'The class picks the next song',
    'A game at the end of the lesson',
    'Sit where you like next lesson',
    'A story read aloud'
];

export function hoardGiftByKey(key) {
    return HOARD_GIFTS.find((g) => g.key === key) || HOARD_GIFTS[0];
}

function starWord(n) {
    return n === 0.5 ? '½ star' : `${n} star${n === 1 ? '' : 's'}`;
}

/** Cleans what the teacher picked: { hoard: {key, amount}, treat: 'text' }. */
export function normalizeGift(raw = {}) {
    const def = hoardGiftByKey(raw?.hoard?.key);
    const amount = def.amounts.includes(Number(raw?.hoard?.amount)) ? Number(raw.hoard.amount) : (def.amounts[0] ?? 0);
    const treat = String(raw?.treat || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    return { hoard: { key: def.key, amount: def.key === 'none' ? 0 : amount }, treat };
}

export function giftIsReady(gift) {
    const g = normalizeGift(gift);
    return g.hoard.key !== 'none' || g.treat.length > 0;
}

/** One line for the hoard gift, e.g. "+2 Gold for every hero here". */
export function hoardGiftLine(gift) {
    const { hoard } = normalizeGift(gift);
    if (hoard.key === 'gold') return `+${hoard.amount} Gold for every hero here`;
    if (hoard.key === 'stars') return `+${starWord(hoard.amount)} for every hero here`;
    if (hoard.key === 'quest') return `+${hoard.amount} to the class's Team Quest`;
    return '';
}

/** The reward text saved on the completed bounty. */
export function describeGift(gift) {
    const g = normalizeGift(gift);
    return [hoardGiftLine(g), g.treat].filter(Boolean).join(' + ');
}
