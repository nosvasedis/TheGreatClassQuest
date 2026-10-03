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
 * Pure data + helpers (no DOM, no Firestore); covered by tests/training-grounds-core.test.mjs.
 */

import { getLeagueBand } from './languageScaffolds.mjs';

export { getLeagueBand };

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
        tagline: 'Watch the hoard. Name what the dragon stole.',
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
/** Hero Path key the Weaver levels on: the sum of all four Training Grounds reasons. */
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
    return { game: gameKey, rounds: 0, pieces: 0, keepsakeIndex: 0, lastCountedDate: '', used: [], shelf: [], log: [], current: [] };
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
 * @returns {{ next, counted, starMoment, keepsakeDone }}
 */
export function recordRound(gameKey, rawState, { today, success, piece = null, note = '', usedId = '' } = {}) {
    const game = TRAINING_GAMES[gameKey];
    const state = normalizeGameState(gameKey, rawState);
    const next = { ...state, used: [...state.used], shelf: [...state.shelf], log: [...state.log], current: [...state.current] };
    if (usedId && !next.used.includes(usedId)) next.used.push(usedId);
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
                name: keepsakeName(gameKey, state.keepsakeIndex),
                finished: today,
                pieces: next.current.slice(-game.pieces)
            };
            next.shelf.push(keepsakeDone);
            next.pieces = 0;
            next.current = [];
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

export function keepsakeName(gameKey, index) {
    const list = KEEPSAKE_NAMES[gameKey] || [];
    if (!list.length) return '';
    const n = Math.max(0, Math.floor(Number(index) || 0));
    const base = list[n % list.length];
    const cycle = Math.floor(n / list.length);
    return cycle ? `${base} ${['II', 'III', 'IV', 'V'][Math.min(cycle - 1, 3)]}` : base;
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

// ─── The Vanishing Hoard (Focus) ─────────────────────────────────────────────

const T = (emoji, word) => Object.freeze({ emoji, word });

export const TREASURE_BANK = Object.freeze({
    early: Object.freeze([
        T('🍎', 'apple'), T('🐱', 'cat'), T('🐶', 'dog'), T('🐟', 'fish'), T('⚽', 'ball'), T('🚗', 'car'),
        T('⭐', 'star'), T('☀️', 'sun'), T('🌙', 'moon'), T('🌸', 'flower'), T('🎈', 'balloon'), T('🎂', 'cake'),
        T('🦆', 'duck'), T('🎩', 'hat'), T('🍌', 'banana'), T('🚌', 'bus'), T('🐸', 'frog'), T('🧸', 'teddy')
    ]),
    junior: Object.freeze([
        T('👑', 'crown'), T('🔑', 'key'), T('💍', 'ring'), T('🛡️', 'shield'), T('🕯️', 'candle'), T('🔔', 'bell'),
        T('🗺️', 'map'), T('🪶', 'feather'), T('🦉', 'owl'), T('🚀', 'rocket'), T('☂️', 'umbrella'), T('🎸', 'guitar'),
        T('⏰', 'clock'), T('🪁', 'kite'), T('🎁', 'present'), T('🐚', 'shell'), T('🍄', 'mushroom'), T('🍦', 'ice cream'),
        T('🐢', 'tortoise'), T('🌈', 'rainbow')
    ]),
    mid: Object.freeze([
        T('🧭', 'compass'), T('🔭', 'telescope'), T('⏳', 'hourglass'), T('🏮', 'lantern'), T('📜', 'scroll'), T('⚓', 'anchor'),
        T('🧪', 'potion'), T('🎲', 'dice'), T('🏆', 'trophy'), T('🧲', 'magnet'), T('🎻', 'violin'), T('🔮', 'crystal ball'),
        T('🏰', 'castle'), T('🌋', 'volcano'), T('🦜', 'parrot'), T('🐙', 'octopus'), T('🌵', 'cactus'), T('❄️', 'snowflake'),
        T('💎', 'diamond'), T('🪓', 'axe'), T('🔨', 'hammer'), T('🦂', 'scorpion')
    ]),
    upper: Object.freeze([
        T('🔬', 'microscope'), T('♟️', 'pawn'), T('🧮', 'abacus'), T('🪃', 'boomerang'), T('🛰️', 'satellite'), T('🦔', 'hedgehog'),
        T('🦎', 'lizard'), T('🦚', 'peacock'), T('🖋️', 'fountain pen'), T('🔒', 'padlock'), T('🌡️', 'thermometer'), T('🏺', 'amphora'),
        T('⚔️', 'crossed swords'), T('🏹', 'bow and arrow'), T('🪙', 'coin'), T('🌍', 'globe'), T('🪗', 'accordion'), T('🦄', 'unicorn'),
        T('⚖️', 'scales'), T('🗝️', 'old key'), T('🧯', 'fire extinguisher'), T('🎭', 'theatre masks'), T('🦑', 'squid'), T('🌪️', 'tornado')
    ])
});

const HOARD_RULES = Object.freeze({
    early:  { base: 4, max: 6,  growEvery: 3, vanish: [1, 1, 1, 1, 1, 1, 2, 2, 2, 2], watch: 12, shuffleFrom: 99 },
    junior: { base: 5, max: 8,  growEvery: 2, vanish: [1, 1, 1, 2, 2, 2, 2, 2, 2, 3], watch: 10, shuffleFrom: 99 },
    mid:    { base: 6, max: 10, growEvery: 2, vanish: [2, 2, 2, 2, 2, 3, 3, 3, 3, 3], watch: 9,  shuffleFrom: 4 },
    upper:  { base: 8, max: 12, growEvery: 2, vanish: [2, 2, 3, 3, 3, 3, 4, 4, 4, 4], watch: 8,  shuffleFrom: 2 }
});

/** How hard the hoard is: grows with each lit rune, and a little with every finished vault. */
export function hoardLevel(state) {
    const s = normalizeGameState('hoard', state);
    return Math.min(9, s.pieces + Math.min(2, s.keepsakeIndex) * 2);
}

export function hoardSettings(band, level = 0) {
    const rules = HOARD_RULES[band] || HOARD_RULES.mid;
    const lvl = Math.max(0, Math.min(9, Math.floor(Number(level) || 0)));
    const count = Math.min(rules.max, rules.base + Math.floor(lvl / rules.growEvery));
    const vanish = Math.min(count - 2, rules.vanish[lvl]);
    return { count, vanish, watchSeconds: rules.watch, shuffle: lvl >= rules.shuffleFrom, level: lvl };
}

/** Teacher's lesson words become treasures too (a gem stands in for the picture). */
export function parseLessonWords(text) {
    return [...new Set(String(text || '')
        .split(/[,\n;]+/)
        .map((w) => w.trim().replace(/\s+/g, ' '))
        .filter((w) => w && w.length <= 24))]
        .slice(0, 16);
}

export function buildHoard(band, level, { rng = Math.random, lessonWords = [] } = {}) {
    const settings = hoardSettings(band, level);
    const bank = TREASURE_BANK[band] || TREASURE_BANK.mid;
    const custom = lessonWords.map((word) => ({ emoji: '', word }));
    const pool = custom.length >= settings.count
        ? shuffled(custom, rng)
        : [...shuffled(custom, rng), ...shuffled(bank.filter((t) => !lessonWords.includes(t.word)), rng)];
    const treasures = pool.slice(0, settings.count).map((t, i) => ({ id: `t${i}`, emoji: t.emoji, word: t.word }));
    const vanishIds = shuffled(treasures.map((t) => t.id), rng).slice(0, settings.vanish);
    const remaining = treasures.filter((t) => !vanishIds.includes(t.id));
    const after = settings.shuffle ? shuffled(remaining, rng) : treasures.map((t) => (vanishIds.includes(t.id) ? { id: t.id, gap: true } : t));
    return { settings, treasures, vanishIds, after };
}

// ─── The Torn Map (Teamwork) ─────────────────────────────────────────────────
// Each riddle has one answer; every clue rules out exactly one wrong option, so no
// group can solve it alone and every scrap is needed.

const O = (emoji, word) => Object.freeze({ emoji, word });
const R = (id, ask, options, answer, clues) => Object.freeze({ id, ask, options: Object.freeze(options), answer, clues: Object.freeze(clues) });

export const MAP_RIDDLES = Object.freeze({
    early: Object.freeze([
        R('e1', 'Which pet lives in the castle?', [O('🐱', 'cat'), O('🐶', 'dog'), O('🐟', 'fish'), O('🐦', 'bird')], 0,
            ["It can't fly.", 'It has got legs.', "It doesn't say “Woof!”"]),
        R('e2', 'Which fruit did the dragon eat?', [O('🍎', 'apple'), O('🍌', 'banana'), O('🍇', 'grapes'), O('🍊', 'orange')], 0,
            ["It isn't yellow.", "It isn't purple.", "It isn't orange."]),
        R('e3', 'Which toy is in the box?', [O('🚗', 'car'), O('🎈', 'balloon'), O('⚽', 'ball'), O('🧸', 'teddy')], 3,
            ["It hasn't got wheels.", "It can't fly.", "You don't kick it."]),
        R('e4', 'Who lives in the tower?', [O('👸', 'princess'), O('🐉', 'dragon'), O('🧙', 'wizard'), O('🐱', 'cat')], 2,
            ["It hasn't got wings.", "It hasn't got a crown.", "It doesn't say “Meow!”"]),
        R('e5', 'What is in the sky tonight?', [O('☀️', 'sun'), O('🌙', 'moon'), O('🌈', 'rainbow'), O('☁️', 'cloud')], 1,
            ["It isn't hot.", "It isn't many colours.", "It doesn't bring rain."]),
        R('e6', 'Which animal is at the farm gate?', [O('🐄', 'cow'), O('🐷', 'pig'), O('🐑', 'sheep'), O('🐔', 'chicken')], 1,
            ["It doesn't say “Moo!”", "It doesn't say “Baa!”", 'It has got four legs.']),
        R('e7', 'What is the knight wearing?', [O('🧢', 'cap'), O('🧣', 'scarf'), O('🧤', 'gloves'), O('👟', 'shoes')], 2,
            ["It isn't on the head.", "It isn't on the neck.", "It isn't on the feet."]),
        R('e8', 'What takes the hero home?', [O('🚗', 'car'), O('🚂', 'train'), O('✈️', 'plane'), O('⛵', 'boat')], 1,
            ["It can't fly.", "It doesn't go on water.", "It doesn't say “Beep beep!”"])
    ]),
    junior: Object.freeze([
        R('j1', 'Where is the lost crown?', [O('🏰', 'castle'), O('🌳', 'forest'), O('🏖️', 'beach'), O('⛰️', 'mountain')], 1,
            ["It isn't near the sea.", "It isn't very high.", "There aren't any walls or doors."]),
        R('j2', 'Which hero found the golden key?', [O('🧝', 'elf'), O('🧚', 'fairy'), O('🧜', 'mermaid'), O('🧙', 'wizard')], 0,
            ["This hero hasn't got wings.", "This hero doesn't live in the sea.", "This hero hasn't got a long beard."]),
        R('j3', 'What did the dragon have for breakfast?', [O('🥞', 'pancakes'), O('🍕', 'pizza'), O('🥚', 'eggs'), O('🍦', 'ice cream')], 2,
            ["It isn't cold.", "It hasn't got cheese on it.", "You don't put honey on it."]),
        R('j4', 'Which room is the treasure in?', [O('🛏️', 'bedroom'), O('🍳', 'kitchen'), O('🛁', 'bathroom'), O('📚', 'library')], 3,
            ["You don't sleep in this room.", "You don't cook in this room.", "You don't have a bath in this room."]),
        R('j5', 'Which animal carried the message?', [O('🦉', 'owl'), O('🐎', 'horse'), O('🐇', 'rabbit'), O('🐌', 'snail')], 0,
            ["It isn't slow.", "It hasn't got long ears.", "It isn't very big."]),
        R('j6', 'When is the spring festival?', [O('❄️', 'winter'), O('🌸', 'spring'), O('☀️', 'summer'), O('🍂', 'autumn')], 1,
            ["It isn't cold and snowy.", "It isn't very hot.", "The leaves aren't falling."]),
        R('j7', 'Which instrument does the bard play?', [O('🎸', 'guitar'), O('🥁', 'drum'), O('🎺', 'trumpet'), O('🎹', 'piano')], 0,
            ["You don't hit it with sticks.", "You don't blow into it.", "It hasn't got black and white keys."]),
        R('j8', 'Who is the knight’s new friend?', [O('🧑‍🍳', 'cook'), O('🧑‍⚕️', 'doctor'), O('🧑‍🌾', 'farmer'), O('🧑‍🏫', 'teacher')], 3,
            ["This person doesn't work in a kitchen.", "This person doesn't help sick people.", "This person doesn't work on a farm."])
    ]),
    mid: Object.freeze([
        R('m1', 'Where did the thief hide the golden goblet?', [O('🏰', 'castle'), O('⛵', 'ship'), O('🌉', 'bridge'), O('🕳️', 'cave'), O('🌲', 'forest')], 3,
            ["It doesn't move.", "You don't cross a river on it.", "There are no stairs inside.", "There aren't any trees there."]),
        R('m2', 'Which creature guards the gate?', [O('🦁', 'lion'), O('🐍', 'snake'), O('🦅', 'eagle'), O('🐻', 'bear'), O('🐺', 'wolf')], 4,
            ['It has got legs.', "It doesn't fly.", "It doesn't sleep all winter.", "It hasn't got a big mane."]),
        R('m3', 'What did the explorer forget at home?', [O('🧭', 'compass'), O('🔦', 'torch'), O('🗺️', 'map'), O('☂️', 'umbrella'), O('🎒', 'rucksack')], 1,
            ["It doesn't keep you dry.", "It doesn't show you which way is north.", "You can't carry things inside it.", "It hasn't got roads and rivers drawn on it."]),
        R('m4', 'Who wrote the secret letter?', [O('🧑‍🚀', 'astronaut'), O('🧑‍🍳', 'chef'), O('🧑‍🎨', 'painter'), O('🧑‍🚒', 'firefighter'), O('🧑‍🔬', 'scientist')], 2,
            ['The writer has never been to space.', "The writer doesn't put out fires.", "The writer doesn't work in a laboratory.", "The writer doesn't cook in a restaurant."]),
        R('m5', 'Which sport does the prince love?', [O('⚽', 'football'), O('🏊', 'swimming'), O('🎾', 'tennis'), O('🚴', 'cycling'), O('⛷️', 'skiing')], 2,
            ["You don't need snow for it.", "You don't need a pool for it.", "You don't ride a bike.", "You don't kick a ball."]),
        R('m6', 'What weather will the sailors meet?', [O('⛈️', 'storm'), O('🌫️', 'fog'), O('☀️', 'sunshine'), O('❄️', 'snow'), O('🌬️', 'wind')], 1,
            ["There won't be any thunder.", "There won't be any snow.", "It won't be hot and bright.", "It won't be windy."]),
        R('m7', 'What is inside the magic chest?', [O('💎', 'diamond'), O('📜', 'scroll'), O('🗝️', 'key'), O('💰', 'coins'), O('👑', 'crown')], 1,
            ["You can't open a door with it.", "You can't wear it on your head.", "It isn't money.", "It isn't a jewel."]),
        R('m8', 'Which place did the travellers visit first?', [O('🏜️', 'desert'), O('🌋', 'volcano'), O('🏝️', 'island'), O('🏔️', 'mountain'), O('🏙️', 'city')], 2,
            ["It wasn't full of buildings.", "There wasn't any snow.", "There wasn't any fire or smoke.", "It wasn't a dry place with no water."])
    ]),
    upper: Object.freeze([
        R('u1', 'Who stole the Moon Pearl?', [O('🧑‍🍳', 'the cook'), O('🧑‍🌾', 'the gardener'), O('💂', 'the guard'), O('🧙', 'the wizard'), O('🧑‍🎤', 'the minstrel')], 1,
            ["The thief wasn't wearing a uniform that night.", "Whoever did it can't use magic.", "The thief wasn't in the kitchen, which was full of people baking.", "The person who took it can't play an instrument."]),
        R('u2', 'Which route should the caravan take?', [O('🏜️', 'the desert road'), O('⛰️', 'the mountain pass'), O('🌊', 'the coast road'), O('🌲', 'the forest path'), O('🌉', 'the river bridge')], 2,
            ["Since the camels are exhausted, they can't climb anything steep.", 'The bridge was destroyed in last night’s storm.', 'Wolves have been seen among the trees.', 'They have run out of water, so a dry route would be too dangerous.']),
        R('u3', 'Which creature has been raiding the orchard?', [O('🦊', 'fox'), O('🦇', 'bat'), O('🦌', 'deer'), O('🐦', 'crow'), O('🐗', 'boar')], 2,
            ['The farmer found no black feathers anywhere.', "The raids happen in daylight, so it isn't a creature that only flies at night.", "The ground hasn't been dug up at all.", 'It ate only fruit and leaves, which a meat-eater would ignore.']),
        R('u4', 'Which gift should the envoy bring the queen?', [O('🌹', 'roses'), O('🐎', 'a horse'), O('🧁', 'cakes'), O('💍', 'a ring'), O('📚', 'books')], 4,
            ['The queen is allergic to flowers.', 'She already owns more horses than she can ride.', 'She has stopped eating sweets on her doctor’s advice.', 'She never wears jewellery.']),
        R('u5', 'Where should the explorers set up camp?', [O('🏞️', 'by the river'), O('⛰️', 'on the hill'), O('🌲', 'in the woods'), O('🏜️', 'on the open plain'), O('🕳️', 'in the cave')], 1,
            ['If they camp by the river, rising water could flood the tents.', 'Bears are known to sleep in the caves around here.', 'Without any shade, the open plain would be unbearable.', 'The woods are too dark to see danger coming.']),
        R('u6', 'What will open the frozen gate?', [O('🔥', 'a torch'), O('🔨', 'a hammer'), O('🗝️', 'a key'), O('🧲', 'a magnet'), O('🪢', 'a rope')], 0,
            ["The lock is frozen solid, so a key won't turn until something changes.", 'Hitting the gate would wake the ice giant.', 'The gate is made of stone, not metal.', 'There is nothing above the gate to tie anything to.']),
        R('u7', 'Which instrument woke the sleeping giant?', [O('🥁', 'a drum'), O('🎻', 'a violin'), O('🎺', 'a trumpet'), O('🎹', 'a piano'), O('🪕', 'a banjo')], 1,
            ["It wasn't made of brass.", "It wasn't too heavy to carry up the mountain.", "It wasn't played with sticks.", "It wasn't plucked with the fingers; it was played with a bow."]),
        R('u8', 'Which shop did the detective visit?', [O('🍞', 'the bakery'), O('💐', 'the florist'), O('📚', 'the bookshop'), O('💊', 'the pharmacy'), O('👞', 'the shoe shop')], 2,
            ["She didn't buy anything to eat.", "She wasn't feeling ill.", "She didn't come back with flowers.", 'Her old shoes were perfectly fine.'])
    ])
});

export const MAP_FRAMES = Object.freeze({
    early: ['Our clue says…', "It isn't the…", 'Yes!', 'No!'],
    junior: ['Our clue says…', "So it isn't the…", 'I think it is the…', 'Do you agree?'],
    mid: ['Our scrap says that…', "That means it can't be…", 'If we put our clues together…', 'Does everyone agree?'],
    upper: ['According to our scrap…', 'That rules out…', 'Combining our clues, the only option left is…', 'Is anyone unsure? Let’s check.']
});

export function pickRiddle(band, used = [], rng = Math.random) {
    return pickFresh(MAP_RIDDLES[band] || MAP_RIDDLES.mid, used, rng);
}

/** Picks the class may make on one riddle. The first wrong pick opens a hint scrap; the second ends the round. */
export const MAP_TRIES = 2;

/** Groups match the number of scraps: 3 for younger leagues, 4 from League A. */
export function scrapCount(band) {
    const riddle = (MAP_RIDDLES[band] || MAP_RIDDLES.mid)[0];
    return riddle.clues.length;
}

/** The next scrap to read out as a hint after a wrong answer, or -1 when all are already shown. */
export function hintScrapIndex(riddle, shownScraps = []) {
    const order = riddle.clues.map((_, i) => i).filter((i) => !shownScraps.includes(i));
    return order.length ? order[0] : -1;
}

// ─── The Round Table (Respect) ───────────────────────────────────────────────

const Q = (id, text) => Object.freeze({ id, text });

export const COUNCIL_QUESTIONS = Object.freeze({
    early: Object.freeze([
        Q('e1', 'What is the best animal?'), Q('e2', 'What is the best food?'), Q('e3', 'What is the best toy?'),
        Q('e4', 'What colour is the best dragon?'), Q('e5', 'Where is the best place to play?'), Q('e6', 'What is the best weather?'),
        Q('e7', 'What is the best fruit?'), Q('e8', 'Flying or being invisible: which magic is best?'), Q('e9', 'What is the best pet for a knight?'),
        Q('e10', 'What is the best game in the playground?'), Q('e11', 'What is the best season?'), Q('e12', 'What is the best thing at school?')
    ]),
    junior: Object.freeze([
        Q('j1', 'Should dragons live in castles?'), Q('j2', 'Is it better to be a giant or tiny?'), Q('j3', 'What is the best present for a friend?'),
        Q('j4', 'Should every class have a pet?'), Q('j5', 'Is summer or winter better?'), Q('j6', 'What is the best superpower?'),
        Q('j7', 'Should children help at home?'), Q('j8', 'Is it better to read a book or watch a film?'), Q('j9', 'What makes a good friend?'),
        Q('j10', 'Should the knight share the treasure?'), Q('j11', 'What is the best job in the kingdom?'), Q('j12', 'Should we have school on Saturday?')
    ]),
    mid: Object.freeze([
        Q('m1', 'Should heroes always tell the truth?'), Q('m2', 'Is it better to have one best friend or many friends?'), Q('m3', 'Should homework be banned?'),
        Q('m4', 'Would you rather explore the sea or space?'), Q('m5', 'Is it ever OK to break a rule?'), Q('m6', 'Should animals be kept in zoos?'),
        Q('m7', 'What makes someone a hero?'), Q('m8', 'Should children have mobile phones?'), Q('m9', 'Is it better to be clever or kind?'),
        Q('m10', 'Should the kingdom spend its gold on a castle or a school?'), Q('m11', 'Is it better to win or to have fun?'), Q('m12', 'Should everyone learn a second language?')
    ]),
    upper: Object.freeze([
        Q('u1', 'Is it fair to judge people by first impressions?'), Q('u2', 'Should video games count as a sport?'), Q('u3', 'Is it better to be honest or to be polite?'),
        Q('u4', 'Should a leader always follow the majority?'), Q('u5', 'Does social media bring people closer or push them apart?'), Q('u6', 'Should we keep a promise if the situation has changed?'),
        Q('u7', 'Is failure necessary to succeed?'), Q('u8', 'Should students choose what they learn?'), Q('u9', 'Is it ever right to keep a secret from a friend?'),
        Q('u10', 'Should famous people be role models?'), Q('u11', 'Would the world be better without money?'), Q('u12', 'Is it braver to speak up or to listen?')
    ])
});

export const COUNCIL_FRAMES = Object.freeze({
    early: { speak: ['I like… because…', 'I think…'], echo: ['You said…', 'Me too!'], kind: ['Good idea!', 'Thank you!'] },
    junior: { speak: ['I think… because…', 'My idea is…'], echo: ['[Name] said…', 'I agree with [Name].'], kind: ['I like your idea, and…', 'Thank you for sharing.'] },
    mid: { speak: ['In my opinion… because…', 'I believe that…'], echo: ['[Name] thinks that…', 'I agree with [Name] that…'], kind: ['I see what you mean, but…', 'Can I add something?'] },
    upper: { speak: ['From my point of view…', 'The main reason is…'], echo: ['Building on what [Name] said…', 'If I understood [Name] correctly…'], kind: ['I see your point, but have you considered…?', 'I partly agree, because…'] }
});

const COUNCIL_RULES = Object.freeze({
    early: { speakers: 4, seconds: 30 },
    junior: { speakers: 5, seconds: 40 },
    mid: { speakers: 6, seconds: 45 },
    upper: { speakers: 8, seconds: 60 }
});

export function councilSettings(band) {
    return { ...(COUNCIL_RULES[band] || COUNCIL_RULES.mid) };
}

export function pickCouncilQuestion(band, used = [], rng = Math.random) {
    return pickFresh(COUNCIL_QUESTIONS[band] || COUNCIL_QUESTIONS.mid, used, rng);
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
