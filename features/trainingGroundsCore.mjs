/**
 * Training Grounds: the four skill games that share one tab.
 *   story   Story Weavers         Creativity   (features/storyWeaver.js)
 *   hoard   The Vanishing Hoard   Focus        a dragon's-treasure memory game
 *   map     The Torn Map          Teamwork     each group holds one clue to a riddle
 *   council The Round Table       Respect      a council with a Speaking Stone and the Echo Rule
 *
 * Every game grows one keepsake per class across lessons. A round only counts when the class
 * succeeds, and only one round per class per lesson day counts. Every second counted round the
 * teacher may give every student a +0.5 bonus star of that skill (reason = the game's reason).
 *
 * Content (treasures, map adventures, council questions) lives per Quest League in the lazily
 * loaded modules under features/trainingGrounds/content/; the helpers here take it as an argument.
 * Pure (no DOM, no Firestore); covered by tests/training-grounds-core.test.mjs and
 * tests/training-grounds-content.test.mjs.
 */

import { getLeagueKey, leagueIndex, LEAGUE_KEYS } from './trainingGrounds/leagueKey.mjs';

export { getLeagueKey, leagueIndex, LEAGUE_KEYS };

export const TRAINING_BONUS_STARS = 0.5;
export const ROUNDS_PER_STAR = 2;
const LOG_LIMIT = 30;

export const TRAINING_GAMES = Object.freeze({
    story: Object.freeze({
        key: 'story', reason: 'story_weaver', skill: 'creativity', skillLabel: 'Creativity',
        name: 'Story Weavers', short: 'Story', icon: 'fa-feather-pointed', emoji: '✒️',
        tagline: 'Weave a class story, one page at a time.'
    }),
    hoard: Object.freeze({
        key: 'hoard', reason: 'vanishing_hoard', skill: 'focus', skillLabel: 'Focus',
        name: 'The Vanishing Hoard', short: 'Hoard', icon: 'fa-eye', emoji: '🐉',
        tagline: 'Watch the hoard. Spot what the dragon changed.',
        keepsake: 'vault', pieces: 8
    }),
    map: Object.freeze({
        key: 'map', reason: 'torn_map', skill: 'teamwork', skillLabel: 'Teamwork',
        name: 'The Torn Map', short: 'Map', icon: 'fa-compass', emoji: '🗺️',
        tagline: 'Every group holds one scrap. Only together can you read it.',
        keepsake: 'map', pieces: 6
    }),
    council: Object.freeze({
        key: 'council', reason: 'round_table', skill: 'respect', skillLabel: 'Respect',
        name: 'The Round Table', short: 'Council', icon: 'fa-shield-heart', emoji: '🕯️',
        tagline: 'Pass the stone. Echo, listen, and let every voice be heard.',
        keepsake: 'banner', pieces: 6
    })
});

export const TRAINING_GAME_KEYS = Object.freeze(['story', 'hoard', 'map', 'council']);
/** The games whose rounds live on the class doc under trainingGrounds.{key} (Story Weavers keeps its own). */
export const ROUND_GAME_KEYS = Object.freeze(['hoard', 'map', 'council']);
/** Award reasons paid by the Training Grounds. They are bonus rows, never a daily skill award. */
export const TRAINING_REASONS = Object.freeze(TRAINING_GAME_KEYS.map((key) => TRAINING_GAMES[key].reason));
/** Hero Path key the Vanguard levels on: the sum of all four Training Grounds reasons. */
export const TRAINING_PATH_KEY = 'training_grounds';

export const TRAINING_REASON_LABELS = Object.freeze({
    story_weaver: 'Story Weavers',
    vanishing_hoard: 'Vanishing Hoard',
    torn_map: 'Torn Map',
    round_table: 'Round Table'
});

export function isTrainingReason(reason) {
    return TRAINING_REASONS.includes(reason);
}

export function gameForReason(reason) {
    return TRAINING_GAME_KEYS.map((key) => TRAINING_GAMES[key]).find((game) => game.reason === reason) || null;
}

// ─── Rounds, knots and keepsakes ─────────────────────────────────────────────

export function emptyGameState(gameKey) {
    return { game: gameKey, rounds: 0, pieces: 0, keepsakeIndex: 0, lastCountedDate: '', used: [], spoiled: [], shelf: [], log: [], current: [] };
}

export function normalizeGameState(gameKey, data) {
    const base = emptyGameState(gameKey);
    if (!data || typeof data !== 'object') return base;
    const num = (v) => Math.max(0, Math.floor(Number(v) || 0));
    return {
        ...base,
        rounds: num(data.rounds),
        pieces: num(data.pieces),
        keepsakeIndex: num(data.keepsakeIndex),
        lastCountedDate: String(data.lastCountedDate || ''),
        used: Array.isArray(data.used) ? data.used.map(String) : [],
        spoiled: Array.isArray(data.spoiled) ? data.spoiled.map(String) : [],
        shelf: Array.isArray(data.shelf) ? data.shelf : [],
        log: Array.isArray(data.log) ? data.log : [],
        current: Array.isArray(data.current) ? data.current : []
    };
}

/** Knots tied toward the next star (0 or 1). */
export function knotsTied(rounds) {
    return Math.max(0, Math.floor(Number(rounds) || 0)) % ROUNDS_PER_STAR;
}

export function isStarMoment(rounds) {
    const n = Math.floor(Number(rounds) || 0);
    return n > 0 && n % ROUNDS_PER_STAR === 0;
}

/** Only one round per class per lesson day ties a knot. Practice rounds stay fun but free. */
export function canCountRound(state, today) {
    return !state?.lastCountedDate || state.lastCountedDate !== today;
}

/**
 * Records a finished round. A failed round is only logged. A successful round adds a keepsake
 * piece and, if it is the first success today, ties a knot.
 * `spoil` marks a story riddle the class has already seen the answer to (the Torn Map then
 * offers a reserve riddle for that step); `keepsakeLabel` names the finished keepsake.
 * @returns {{ next, counted, starMoment, keepsakeDone }}
 */
export function recordRound(gameKey, rawState, { today, success, piece = null, note = '', usedId = '', spoil = '', keepsakeLabel = '' } = {}) {
    const game = TRAINING_GAMES[gameKey];
    const state = normalizeGameState(gameKey, rawState);
    const next = { ...state, used: [...state.used], spoiled: [...state.spoiled], shelf: [...state.shelf], log: [...state.log], current: [...state.current] };
    if (usedId && !next.used.includes(usedId)) next.used.push(usedId);
    if (spoil && !next.spoiled.includes(spoil)) next.spoiled.push(spoil);
    const entry = { date: today, ok: Boolean(success), note: String(note || '').slice(0, 140) };
    let counted = false;
    let starMoment = false;
    let keepsakeDone = null;
    if (success) {
        counted = canCountRound(state, today);
        if (counted) {
            next.rounds = state.rounds + 1;
            next.lastCountedDate = today;
            starMoment = isStarMoment(next.rounds);
        }
        entry.counted = counted;
        if (piece) next.current.push({ ...piece, date: today });
        next.pieces = state.pieces + 1;
        if (game?.pieces && next.pieces >= game.pieces) {
            keepsakeDone = {
                n: state.keepsakeIndex + 1,
                name: keepsakeLabel || keepsakeName(gameKey, state.keepsakeIndex),
                finished: today,
                pieces: next.current.slice(-game.pieces)
            };
            next.shelf.push(keepsakeDone);
            next.pieces = 0;
            next.current = [];
            next.spoiled = [];
            next.keepsakeIndex = state.keepsakeIndex + 1;
        }
    }
    next.log = [entry, ...next.log].slice(0, LOG_LIMIT);
    return { next, counted, starMoment, keepsakeDone };
}

const KEEPSAKE_NAMES = Object.freeze({
    hoard: ['The Ember Vault', 'The Moonstone Vault', 'The Thunder Vault', 'The Frost Vault', 'The Sunfire Vault', 'The Starlit Vault', 'The Emerald Vault', 'The Obsidian Vault'],
    map: ['The Whispering Isles', 'The Sunken Kingdom', 'The Crystal Peaks', 'The Emerald Wilds', 'The Desert of Echoes', 'The Cloud Citadel', 'The Ember Coast', 'The Frozen North'],
    council: ['The Banner of Dawn', 'The Banner of the Oak', 'The Banner of the Silver Moon', 'The Banner of the Lantern', 'The Banner of the River', 'The Banner of the Stars', 'The Banner of the Mountain', 'The Banner of the Hearth']
});

const NUMERALS = ['II', 'III', 'IV', 'V'];

function cycleName(list, index) {
    if (!list.length) return '';
    const n = Math.max(0, Math.floor(Number(index) || 0));
    const base = list[n % list.length];
    const cycle = Math.floor(n / list.length);
    return cycle ? `${base} ${NUMERALS[Math.min(cycle - 1, NUMERALS.length - 1)]}` : base;
}

export function keepsakeName(gameKey, index) {
    return cycleName(KEEPSAKE_NAMES[gameKey] || [], index);
}

// ─── Tiny seeded random, so rounds are testable ──────────────────────────────

export function seededRandom(seed = Date.now()) {
    let t = (Number(seed) >>> 0) || 1;
    return function next() {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

export function shuffled(list, rng = Math.random) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** Picks one item whose id is not in used; when every item is used, the cycle starts again. */
export function pickFresh(items, used = [], rng = Math.random) {
    const fresh = items.filter((item) => !used.includes(item.id));
    const pool = fresh.length ? fresh : items;
    return pool[Math.floor(rng() * pool.length)] || null;
}

/** A league's shelf from a content table, falling back to League A. */
export function forLeague(table, league) {
    return (table && (table[getLeagueKey(league)] || table.a)) || null;
}

// ─── The Vanishing Hoard (Focus) ─────────────────────────────────────────────
// content = { themes, rules, modes } from trainingGrounds/content/hoardContent.mjs

export const HOARD_MODE_KEYS = Object.freeze(['vanish', 'intruder', 'moved']);

/** How hard the hoard is: grows with each lit rune, and a little with every finished vault. */
export function hoardLevel(state) {
    const s = normalizeGameState('hoard', state);
    return Math.min(9, s.pieces + Math.min(2, s.keepsakeIndex) * 2);
}

/** The round types this league plays (vanish and intruder for all, moved from Junior B). */
export function hoardModesFor(modes, league) {
    const idx = leagueIndex(league);
    return HOARD_MODE_KEYS.filter((k) => modes?.[k] && idx >= (modes[k].from || 0));
}

/**
 * Size, speed and the number of treasures to name. `answers` is what the class must spot:
 * vanished treasures, intruders (at most two, one for Pre-Junior) or moved treasures (one or
 * two swapped pairs).
 */
export function hoardSettings(rules, league, level = 0, mode = 'vanish') {
    const key = getLeagueKey(league);
    const r = forLeague(rules, key);
    const lvl = Math.max(0, Math.min(9, Math.floor(Number(level) || 0)));
    const count = Math.min(r.max, r.base + Math.floor(lvl / r.growEvery));
    const vanish = Math.max(1, Math.min(count - 2, r.vanish[lvl]));
    let answers = vanish;
    if (mode === 'intruder') answers = key === 'prejunior' ? 1 : Math.min(2, vanish);
    if (mode === 'moved') answers = vanish >= 3 && count >= 8 ? 4 : 2;
    return {
        count, vanish, answers, mode,
        watchSeconds: r.watch,
        shuffle: mode !== 'moved' && lvl >= r.shuffleFrom,
        level: lvl
    };
}

/** Treasures a league may meet in a theme: up to its own tier. */
export function eligibleTreasures(theme, league) {
    const idx = leagueIndex(league);
    return (theme?.items || []).filter(([, , tier]) => tier <= idx);
}

/** Themes with enough treasures for this league's biggest hoard. */
export function hoardThemesFor(content, league) {
    const r = forLeague(content.rules, league);
    const need = r?.max || 8;
    return content.themes.filter((t) => eligibleTreasures(t, league).length >= need);
}

/** Teacher's lesson words become treasures too (a gem stands in for the picture). */
export function parseLessonWords(text) {
    return [...new Set(String(text || '')
        .split(/[,\n;]+/)
        .map((w) => w.trim().replace(/\s+/g, ' '))
        .filter((w) => w && w.length <= 24))]
        .slice(0, 16);
}

/**
 * The league's treasure pool: lesson words first, then the theme's words at this league's
 * level (own tier and the two below), then easier words, then other themes to top up.
 */
function treasurePool(content, league, { themeId = '', lessonWords = [], rng = Math.random } = {}) {
    const idx = leagueIndex(league);
    const seen = new Set();
    const out = [];
    const add = (emoji, word) => {
        const k = String(word).toLowerCase();
        if (!word || seen.has(k)) return;
        seen.add(k);
        out.push({ emoji, word });
    };
    shuffled(lessonWords, rng).forEach((w) => add('', w));
    const theme = content.themes.find((t) => t.id === themeId);
    const ranked = (themes) => {
        const items = themes.flatMap((t) => eligibleTreasures(t, league));
        const fresh = items.filter(([, , tier]) => tier >= idx - 2);
        const easy = items.filter(([, , tier]) => tier < idx - 2);
        return [...shuffled(fresh, rng), ...shuffled(easy, rng)];
    };
    if (theme) ranked([theme]).forEach(([e, w]) => add(e, w));
    ranked(content.themes.filter((t) => t !== theme)).forEach(([e, w]) => add(e, w));
    return out;
}

/**
 * Deals one hoard.
 *   treasures  what the class watches (ids t0…)
 *   extras     intruders that sneak in (ids x0…, intruder mode only)
 *   answerIds  what the class must name
 *   after      the hoard after the dragon: gaps for vanished treasures (or a shuffled remainder),
 *              intruders slipped in, or two treasures swapped
 */
export function buildHoard(content, league, level, { mode = 'vanish', themeId = '', rng = Math.random, lessonWords = [] } = {}) {
    const settings = hoardSettings(content.rules, league, level, mode);
    const pool = treasurePool(content, league, { themeId, lessonWords, rng });
    const extraCount = mode === 'intruder' ? settings.answers : 0;
    const treasures = pool.slice(0, settings.count).map((t, i) => ({ id: `t${i}`, emoji: t.emoji, word: t.word }));
    const extras = pool.slice(settings.count, settings.count + extraCount).map((t, i) => ({ id: `x${i}`, emoji: t.emoji, word: t.word }));
    let answerIds = [];
    let after = [];
    if (mode === 'intruder') {
        answerIds = extras.map((t) => t.id);
        after = settings.shuffle ? shuffled(treasures, rng) : [...treasures];
        for (const extra of extras) after.splice(Math.floor(rng() * (after.length + 1)), 0, extra);
    } else if (mode === 'moved') {
        const picks = shuffled(treasures.map((_, i) => i), rng).slice(0, settings.answers);
        after = [...treasures];
        for (let p = 0; p + 1 < picks.length; p += 2) {
            const [i, j] = [picks[p], picks[p + 1]];
            [after[i], after[j]] = [after[j], after[i]];
        }
        answerIds = picks.map((i) => treasures[i].id);
    } else {
        answerIds = shuffled(treasures.map((t) => t.id), rng).slice(0, settings.answers);
        const remaining = treasures.filter((t) => !answerIds.includes(t.id));
        after = settings.shuffle ? shuffled(remaining, rng) : treasures.map((t) => (answerIds.includes(t.id) ? { id: t.id, gap: true } : t));
    }
    return {
        settings, mode, treasures, extras, answerIds, after,
        vanishIds: mode === 'vanish' ? answerIds : [],
        all: [...treasures, ...extras]
    };
}

// ─── The Torn Map (Teamwork) ─────────────────────────────────────────────────
// content = { adventures, reserve } from trainingGrounds/content/mapContent.mjs.
// Each riddle has one answer; every clue rules out exactly one wrong option (clue.out).

/** Picks the class may make on one riddle. The first wrong pick opens a hint scrap; the second ends the round. */
export const MAP_TRIES = 2;

/** The map adventure for this keepsake (adventures cycle once a league has finished them all). */
export function mapAdventure(content, league, keepsakeIndex = 0) {
    const list = forLeague(content.adventures, league) || [];
    if (!list.length) return null;
    return list[Math.max(0, Math.floor(Number(keepsakeIndex) || 0)) % list.length];
}

/** The map's shelf name: the adventure's name, with a numeral on later journeys. */
export function mapAdventureName(content, league, keepsakeIndex = 0) {
    const list = forLeague(content.adventures, league) || [];
    return cycleName(list.map((a) => a.name), keepsakeIndex) || keepsakeName('map', keepsakeIndex);
}

/**
 * The riddle the class plays next. Normally the adventure's next story riddle; a reserve riddle
 * when that step was spoiled by a lost round, or when the teacher asks for another one.
 * @returns {{ riddle, adventure, step, fromReserve }}
 */
export function mapRiddleForStep(content, league, rawState, { exclude = [], forceReserve = false, rng = Math.random } = {}) {
    const state = normalizeGameState('map', rawState);
    const adventure = mapAdventure(content, league, state.keepsakeIndex);
    const step = Math.min(state.pieces, Math.max(0, (adventure?.riddles.length || 1) - 1));
    const story = adventure?.riddles[step] || null;
    if (story && !forceReserve && !state.spoiled.includes(story.id) && !exclude.includes(story.id)) {
        return { riddle: story, adventure, step, fromReserve: false };
    }
    const reserve = forLeague(content.reserve, league) || [];
    const riddle = pickFresh(reserve, [...state.used, ...exclude], rng) || story;
    return { riddle, adventure, step, fromReserve: riddle !== story };
}

/** Groups match the number of scraps: 2 for Pre-Junior, 3 for Junior, 4 from League A. */
export function scrapCount(content, league) {
    const adventure = mapAdventure(content, league, 0);
    return adventure?.riddles[0]?.clues.length || 3;
}

/** The next scrap to read out as a hint after a wrong answer, or -1 when all are already shown. */
export function hintScrapIndex(riddle, shownScraps = []) {
    const order = riddle.clues.map((_, i) => i).filter((i) => !shownScraps.includes(i));
    return order.length ? order[0] : -1;
}

/** Options already ruled out by the scraps the teacher has crossed off. */
export function ruledOutOptions(riddle, ruledScraps = []) {
    return [...new Set(ruledScraps.map((i) => riddle?.clues[i]?.out).filter((i) => Number.isInteger(i)))];
}

// ─── The Round Table (Respect) ───────────────────────────────────────────────
// content = { questions, frames, rules, kinds } from trainingGrounds/content/councilContent.mjs

export function councilSettings(rules, league) {
    return { ...(forLeague(rules, league) || { speakers: 6, seconds: 45 }) };
}

/** The question kinds this league's bank has, in the order of COUNCIL_KINDS. */
export function councilKindsFor(content, league) {
    const present = new Set((forLeague(content.questions, league) || []).map((q) => q.kind));
    return Object.keys(content.kinds || {}).filter((k) => present.has(k));
}

/** A fresh question, optionally of one kind ('any' or '' for all). */
export function pickCouncilQuestion(content, league, used = [], rng = Math.random, { kind = 'any' } = {}) {
    const all = forLeague(content.questions, league) || [];
    const ofKind = kind && kind !== 'any' ? all.filter((q) => q.kind === kind) : all;
    return pickFresh(ofKind.length ? ofKind : all, used, rng);
}

/**
 * The council is honoured when nobody interrupted and every speaker after the first echoed the
 * one before. The teacher always has the last word; this is only the suggestion.
 */
export function councilVerdict({ speakers = 0, echoes = 0, interruptions = 0 } = {}) {
    const needed = Math.max(0, speakers - 1);
    const echoedAll = echoes >= needed;
    const peaceful = interruptions === 0;
    return { honoured: speakers >= 2 && echoedAll && peaceful, echoedAll, peaceful, needed };
}

/** A short line for the Kingdom Vote: "🐱 cats 5 · 🐶 dogs 3". */
export function voteSummary(options = [], counts = {}) {
    const rows = options.map((o, i) => ({ ...o, n: Math.max(0, Math.floor(Number(counts[i]) || 0)) }));
    if (!rows.some((r) => r.n)) return '';
    return rows.map((r) => `${r.emoji} ${r.label} ${r.n}`).join(' · ');
}

// ─── Copy shared by every game ───────────────────────────────────────────────

export function milestoneLine(gameKey, rounds) {
    const game = TRAINING_GAMES[gameKey];
    const into = knotsTied(rounds);
    const star = `<strong>${game.skillLabel} Star</strong>`;
    if (!rounds) return `Every two rounds won, the class can earn a ${star}.`;
    return into === 1
        ? `One more round won and the class reaches a ${star} moment!`
        : `<strong>${rounds}</strong> rounds won. Two more for the next ${star}.`;
}
