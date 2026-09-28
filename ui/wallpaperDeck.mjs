/**
 * Projector Mode (The Director): the Sky Card system.
 * Pure data + helpers shared by ui/wallpaper.js, the new cards and the guidebook capture.
 * Covered by tests/wallpaper-deck.test.mjs.
 *
 * Every card belongs to one family. The family decides the card's frame colour, its crest,
 * the label the room reads above the title, and whether the teacher has it switched on in
 * the wallpaper's deck settings.
 */

export const CARD_FAMILIES = Object.freeze([
    { key: 'heroes', label: 'Hall of Heroes', sigil: '🏅', blurb: 'Spotlights, awards, birthdays' },
    { key: 'quest', label: 'Class Quest', sigil: '🗺️', blurb: 'Map, treasury, bounties, streaks' },
    { key: 'time', label: 'Time & Tides', sigil: '⏳', blurb: 'Lesson clock, holidays, tests' },
    { key: 'words', label: 'Word Workshop', sigil: '📖', blurb: 'English from the lesson and beyond' },
    { key: 'puzzles', label: 'Puzzle Nook', sigil: '🧩', blurb: 'Riddles, games, quick challenges' },
    { key: 'wonders', label: 'Wonders', sigil: '🔭', blurb: 'Facts, history, science, myths' },
    { key: 'heart', label: 'Mind & Heart', sigil: '🌱', blurb: 'Calm, kindness, healthy habits' },
    { key: 'sky', label: 'Sky Watch', sigil: '☁️', blurb: 'Weather, moon, daylight, seasons' },
    { key: 'realm', label: 'The Realm', sigil: '🏰', blurb: 'The whole school and its guilds' }
]);

export const FAMILY_KEYS = Object.freeze(CARD_FAMILIES.map((family) => family.key));

const FAMILY_BY_KEY = new Map(CARD_FAMILIES.map((family) => [family.key, family]));

const FAMILY_OF_TYPE = {
    heroes: [
        'stu_spotlight', 'stu_funfact', 'recent_award', 'top_student_monthly', 'top_student_daily',
        'bday', 'name', 'reigning_hero_spotlight', 'lang_growth_star', 'school_top_student',
        'absent_heroes', 'teacher_shoutout', 'class_stars_today', 'class_star_of_week', 'class_next_birthday'
    ],
    quest: [
        'class_quest', 'treasury_class', 'streak', 'class_bounty', 'quest_map_position',
        'class_rank_vs_school', 'class_gold_ranking', 'class_gold_top_trio', 'class_familiar_parade',
        'class_familiar_hatch_watch', 'class_special_quest', 'attendance_summary', 'class_season_snapshot',
        'lesson_milestone', 'story_sentence', 'log'
    ],
    time: [
        'timekeeper', 'next_lesson', 'holiday', 'pre_holiday_hype', 'upcoming_test_countdown',
        'class_test_luck', 'school_upcoming_event', 'context_morning', 'context_afternoon', 'context_night',
        'context_monday', 'context_friday', 'post_holiday_welcome', 'giant_clock', 'school_year_journey',
        'timer_end'
    ],
    words: [
        'lang_learned_today', 'lang_quiz_rewind', 'lang_word_scramble', 'lang_story_recall',
        'lang_sentence_starter', 'lang_think_pair_share', 'lang_grammar_nugget', 'lang_minimal_pair',
        'lang_classroom_english', 'lang_next_quest', 'ai_word', 'ai_idiom', 'ai_tongue_twister',
        'fun_english_phrase', 'word_of_the_day', 'language_origin', 'book_recommendation', 'spell_it_right'
    ],
    puzzles: [
        'ai_riddle', 'ai_brain_teaser', 'ai_joke', 'emoji_riddle', 'math_challenge', 'puzzle_of_the_day',
        'math_magic', 'daily_challenge', 'true_or_false', 'odd_one_out', 'letter_hunt', 'quick_draw'
    ],
    wonders: [
        'ai_fact_science', 'ai_fact_history', 'ai_fact_nature', 'ai_fact_geography', 'ai_fact_math',
        'ai_did_you_know', 'this_day_history', 'world_record', 'thought_experiment', 'mythology_moment',
        'historical_figure_spotlight', 'science_demo', 'on_this_day_science', 'greek_nameday_today',
        'orthodox_calendar'
    ],
    heart: [
        'mindfulness', 'healthy_habit', 'eco_hero_tip', 'class_mood_check', 'study_tip',
        'motivation_poster', 'creative_prompt', 'would_you_rather'
    ],
    sky: ['weather', 'season_visual', 'sky_moon_phase', 'sky_daylight'],
    realm: [
        'school_pulse', 'treasury_school', 'school_leader_top3', 'school_active_bounties',
        'school_adventure_count', 'school_gold_leader', 'school_avg_attendance', 'guild_leaderboard',
        'league_race'
    ]
};

const TYPE_TO_FAMILY = new Map(
    Object.entries(FAMILY_OF_TYPE).flatMap(([family, types]) => types.map((type) => [type, family]))
);

export function getCardBaseType(cardType) {
    return String(cardType || '').split(':')[0];
}

/** Family key for a deck entry such as `stu_spotlight:abc` or `weather`. Unknown cards join The Realm. */
export function getCardFamilyKey(cardType) {
    return TYPE_TO_FAMILY.get(getCardBaseType(cardType)) || 'realm';
}

export function getCardFamily(cardType) {
    return FAMILY_BY_KEY.get(getCardFamilyKey(cardType));
}

export function getFamilyByKey(key) {
    return FAMILY_BY_KEY.get(key) || FAMILY_BY_KEY.get('realm');
}

/** Every card type the family map knows, for tests and the deck panel counts. */
export function listKnownCardTypes() {
    return [...TYPE_TO_FAMILY.keys()];
}

// ─── Teacher preferences (per projector PC, kept in localStorage) ───────────

export const CARD_DURATION_CHOICES = Object.freeze([30, 60, 120, 300]);
export const DEFAULT_CARD_DURATION_S = 60;

export function defaultWallpaperPrefs() {
    return {
        durationS: DEFAULT_CARD_DURATION_S,
        families: Object.fromEntries(FAMILY_KEYS.map((key) => [key, true])),
        quote: true
    };
}

/** Accepts whatever was stored (or nothing) and returns a complete, valid prefs object. */
export function normalizeWallpaperPrefs(raw) {
    const prefs = defaultWallpaperPrefs();
    if (!raw || typeof raw !== 'object') return prefs;
    const duration = Number(raw.durationS);
    if (CARD_DURATION_CHOICES.includes(duration)) prefs.durationS = duration;
    if (raw.families && typeof raw.families === 'object') {
        FAMILY_KEYS.forEach((key) => {
            if (typeof raw.families[key] === 'boolean') prefs.families[key] = raw.families[key];
        });
    }
    if (typeof raw.quote === 'boolean') prefs.quote = raw.quote;
    return prefs;
}

/**
 * Keep only the deck entries whose family is switched on.
 * Celebrations (birthdays, namedays) and a running timer always stay, and when the teacher has
 * switched everything off the full deck comes back rather than an empty sky.
 */
export function filterDeckByFamilies(deck, prefs) {
    const families = normalizeWallpaperPrefs(prefs).families;
    const always = new Set(['bday', 'name', 'timer_end']);
    const kept = deck.filter((type) => always.has(getCardBaseType(type)) || families[getCardFamilyKey(type)]);
    const hasChoice = kept.some((type) => !always.has(getCardBaseType(type)));
    return hasChoice ? kept : deck;
}

export function countDeckByFamily(deck) {
    const counts = Object.fromEntries(FAMILY_KEYS.map((key) => [key, 0]));
    deck.forEach((type) => { counts[getCardFamilyKey(type)] += 1; });
    return counts;
}

// ─── Sky maths ───────────────────────────────────────────────────────────────

const SYNODIC_MONTH_DAYS = 29.530588853;
// A known new moon: 6 January 2000, 18:14 UTC.
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);

const MOON_PHASES = [
    { max: 0.0339, name: 'New Moon', emoji: '🌑', note: 'The moon hides between us and the sun.' },
    { max: 0.2161, name: 'Waxing Crescent', emoji: '🌒', note: 'A thin smile of light grows each night.' },
    { max: 0.2839, name: 'First Quarter', emoji: '🌓', note: 'Half lit: the moon is a quarter of the way round.' },
    { max: 0.4661, name: 'Waxing Gibbous', emoji: '🌔', note: 'Almost full. Look for it in the afternoon sky!' },
    { max: 0.5339, name: 'Full Moon', emoji: '🌕', note: 'The whole face shines all night long.' },
    { max: 0.7161, name: 'Waning Gibbous', emoji: '🌖', note: 'Rising later each night, shrinking slowly.' },
    { max: 0.7839, name: 'Last Quarter', emoji: '🌗', note: 'Half lit again, the other side this time.' },
    { max: 0.9661, name: 'Waning Crescent', emoji: '🌘', note: 'A thin crescent before sunrise.' },
    { max: 1.0001, name: 'New Moon', emoji: '🌑', note: 'The moon hides between us and the sun.' }
];

/** Moon phase for a date: age in days, 0..1 phase, % lit, name and emoji. */
export function getMoonPhase(date = new Date()) {
    const days = (new Date(date).getTime() - KNOWN_NEW_MOON_MS) / 86400000;
    const age = ((days % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
    const phase = age / SYNODIC_MONTH_DAYS;
    const illumination = Math.round(((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100);
    const info = MOON_PHASES.find((entry) => phase < entry.max) || MOON_PHASES[0];
    const daysToFull = Math.round(((0.5 - phase + 1) % 1) * SYNODIC_MONTH_DAYS);
    return { age, phase, illumination, name: info.name, emoji: info.emoji, note: info.note, daysToFull };
}

/** A drawn moon (SVG) lit for the given phase, so it looks right on every projector's fonts. */
export function moonPhaseSvg(phase, { size = 100, className = 'sky-moon-svg' } = {}) {
    const r = 40;
    const cx = 50;
    const cy = 50;
    const p = ((Number(phase) % 1) + 1) % 1;
    const k = Math.cos(2 * Math.PI * p);
    const rx = Math.abs(k * r).toFixed(2);
    const waxing = p < 0.5;
    let lit = '';
    if (Math.abs(k) < 0.999 || k < 0) {
        lit = waxing
            ? `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${rx} ${r} 0 0 ${k > 0 ? 0 : 1} ${cx} ${cy - r} Z`
            : `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} A ${rx} ${r} 0 0 ${k > 0 ? 1 : 0} ${cx} ${cy - r} Z`;
    }
    return `<svg class="${className}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
        <defs><radialGradient id="skyMoonLit" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fffbea"/><stop offset="1" stop-color="#fde68a"/></radialGradient></defs>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="#2e3a6e"/>
        ${lit ? `<path d="${lit}" fill="url(#skyMoonLit)"/>` : ''}
        <circle cx="38" cy="40" r="5" fill="rgba(120,100,60,0.18)"/><circle cx="60" cy="62" r="7" fill="rgba(120,100,60,0.15)"/><circle cx="62" cy="34" r="3.5" fill="rgba(120,100,60,0.16)"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.5"/>
    </svg>`;
}

// Approximate start dates (northern hemisphere, astronomical seasons).
const SEASONS = [
    { key: 'spring', name: 'Spring', emoji: '🌸', month: 2, day: 20, note: 'Blossoms, longer days and birdsong.' },
    { key: 'summer', name: 'Summer', emoji: '☀️', month: 5, day: 21, note: 'The longest days of the year.' },
    { key: 'autumn', name: 'Autumn', emoji: '🍂', month: 8, day: 22, note: 'Falling leaves and cooler mornings.' },
    { key: 'winter', name: 'Winter', emoji: '❄️', month: 11, day: 21, note: 'Short days, long nights, cosy evenings.' }
];

/** Which season it is, how far in, and how long until the next one. */
export function getSeasonInfo(date = new Date()) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const starts = [-1, 0, 1].flatMap((offset) => SEASONS.map((season) => ({
        ...season,
        start: new Date(d.getFullYear() + offset, season.month, season.day)
    }))).sort((a, b) => a.start - b.start);
    let index = 0;
    starts.forEach((season, i) => { if (season.start <= d) index = i; });
    const current = starts[index];
    const next = starts[index + 1];
    const dayOf = Math.round((d - current.start) / 86400000) + 1;
    const daysToNext = Math.round((next.start - d) / 86400000);
    const length = Math.round((next.start - current.start) / 86400000);
    return { ...current, dayOf, daysToNext, progress: dayOf / length, next: { name: next.name, emoji: next.emoji } };
}

/** Where the sun is on today's arc: 0 at sunrise, 1 at sunset; below 0 / above 1 means night. */
export function getSunProgress(nowMs, sunriseMs, sunsetMs) {
    const span = sunsetMs - sunriseMs;
    if (!(span > 0)) return 0.5;
    return (nowMs - sunriseMs) / span;
}

function minutesOf(hhmm) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * The lesson window drawn on the analogue dial (12-hour face), in degrees clockwise from 12.
 * Returns null when there is no usable window or it is not today's lesson time (more than
 * 30 minutes before the start or after the end).
 */
export function getLessonDialArc(timeStart, timeEnd, now = new Date()) {
    const start = minutesOf(timeStart);
    const end = minutesOf(timeEnd);
    if (start === null || end === null || end <= start || end - start > 12 * 60) return null;
    const current = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    if (current < start - 30 || current > end) return null;
    const toDeg = (minutes) => ((minutes % 720) / 720) * 360;
    const startDeg = toDeg(start);
    const sweep = ((end - start) / 720) * 360;
    const elapsed = Math.max(0, Math.min(1, (current - start) / (end - start)));
    return {
        startDeg,
        sweepDeg: sweep,
        elapsedDeg: sweep * elapsed,
        progress: elapsed,
        minutesLeft: Math.max(0, Math.ceil(end - current)),
        started: current >= start
    };
}

/** SVG path for an arc on a circle centred at (cx, cy); angles in degrees clockwise from 12 o'clock. */
export function describeArc(cx, cy, r, startDeg, sweepDeg) {
    const sweep = Math.max(0.01, Math.min(359.99, sweepDeg));
    const point = (deg) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
    };
    const [x1, y1] = point(startDeg);
    const [x2, y2] = point(startDeg + sweep);
    const large = sweep > 180 ? 1 : 0;
    const f = (n) => Number(n.toFixed(2));
    return `M ${f(x1)} ${f(y1)} A ${r} ${r} 0 ${large} 1 ${f(x2)} ${f(y2)}`;
}

/** Stable pick for "of the day" cards: the same item all day, a different one tomorrow. */
export function pickForDay(list, date = new Date(), salt = 0) {
    if (!Array.isArray(list) || list.length === 0) return null;
    const d = new Date(date);
    const dayNumber = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    return list[Math.abs(dayNumber * 7 + salt * 13) % list.length];
}

export function pickRandom(list, random = Math.random) {
    if (!Array.isArray(list) || list.length === 0) return null;
    return list[Math.floor(random() * list.length)];
}

// ─── Frame ───────────────────────────────────────────────────────────────────

export function escapeCardText(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

/**
 * Inner markup of a Sky Card: crest medallion, family label, title ribbon, the card's own body,
 * and a footer with the life bar (drained by CSS over the card's remaining time).
 * `sigil` and `title` default to the family's; ui/wallpaper.js lifts them out of older card
 * bodies (their emoji and badge) so every card shares one anatomy.
 */
export function buildSkyCardInner({ family, sigil, title, bodyHtml, hint = '' }) {
    const fam = getFamilyByKey(family);
    return `
        <div class="sky-card__crest" aria-hidden="true"><span class="sky-card__sigil">${sigil || fam.sigil}</span></div>
        <div class="sky-card__frame">
            <div class="sky-card__panel">
                <p class="sky-card__family">${escapeCardText(fam.label)}</p>
                ${title ? `<h4 class="sky-card__title">${title}</h4>` : ''}
                <div class="sky-card__body">${bodyHtml}</div>
                <div class="sky-card__foot">
                    <span class="sky-card__hint" data-sky-hint>${hint}</span>
                    <span class="sky-card__life" aria-hidden="true"><i data-sky-life></i></span>
                </div>
            </div>
        </div>`;
}

// ─── Content banks for the new game and talk cards ──────────────────────────
// Tiers follow utils.getAgeTierForLeague: 'junior' (youngest), 'mid', 'senior'.

export const TRUE_OR_FALSE = Object.freeze({
    junior: [
        { s: 'A spider has eight legs.', a: true, why: 'Count them: four on each side!' },
        { s: 'Penguins can fly.', a: false, why: 'They swim fast instead.' },
        { s: 'The sun is a star.', a: true, why: 'Our very own, very close star.' },
        { s: 'A tomato is a vegetable.', a: false, why: 'It has seeds inside, so it is a fruit!' },
        { s: 'Frogs start life as tadpoles.', a: true, why: 'They grow legs later.' },
        { s: 'Cows drink milk every day.', a: false, why: 'Grown-up cows drink water.' },
        { s: 'A week has seven days.', a: true, why: 'Monday to Sunday.' },
        { s: 'Snow is warm.', a: false, why: 'Brrr! It is frozen water.' }
    ],
    mid: [
        { s: 'Octopuses have three hearts.', a: true, why: 'Two pump blood to the gills, one to the body.' },
        { s: 'The Great Wall of China is easy to see from the Moon.', a: false, why: 'It is far too thin to see from that far.' },
        { s: 'Bananas grow pointing up.', a: true, why: 'They curve up towards the sun.' },
        { s: 'Lightning never strikes the same place twice.', a: false, why: 'Tall towers are hit many times a year.' },
        { s: 'A group of owls is called a parliament.', a: true, why: 'A wise name for a wise bird.' },
        { s: 'Goldfish only remember things for three seconds.', a: false, why: 'They can remember for months.' },
        { s: 'Mount Olympus is the highest mountain in Greece.', a: true, why: '2,918 metres tall.' },
        { s: 'Bats are blind.', a: false, why: 'They can see, and they also use echoes.' }
    ],
    senior: [
        { s: 'Honey found in ancient Egyptian tombs can still be eaten.', a: true, why: 'Honey almost never spoils.' },
        { s: 'Humans use only 10% of their brains.', a: false, why: 'Scans show activity all over the brain.' },
        { s: 'Venus spins in the opposite direction to most planets.', a: true, why: 'The sun rises in the west there.' },
        { s: 'Napoleon was extremely short.', a: false, why: 'He was about average height for his time.' },
        { s: 'Sharks existed before trees.', a: true, why: 'By around 50 million years.' },
        { s: 'Chameleons change colour mainly to hide.', a: false, why: 'Mostly to show mood and control heat.' },
        { s: 'The word "alphabet" comes from Greek letters.', a: true, why: 'Alpha + beta.' },
        { s: 'Glass is a slow-moving liquid.', a: false, why: 'It is an amorphous solid; old windows were made uneven.' }
    ]
});

export const WOULD_YOU_RATHER = Object.freeze({
    junior: [
        ['be able to fly', 'be able to breathe underwater'],
        ['have a pet dragon', 'have a pet unicorn'],
        ['eat ice cream for breakfast', 'eat pizza for breakfast'],
        ['be as small as a mouse', 'be as big as a giraffe'],
        ['live in a castle', 'live in a treehouse'],
        ['talk to animals', 'talk to toys']
    ],
    mid: [
        ['visit the past', 'visit the future'],
        ['be invisible', 'read minds'],
        ['live by the sea', 'live in the mountains'],
        ['never do homework again', 'never have to go to bed early'],
        ['speak every language', 'play every instrument'],
        ['explore space', 'explore the deep ocean']
    ],
    senior: [
        ['know the answer to one big question', 'be able to ask anyone one question'],
        ['have a rewind button for your life', 'have a pause button'],
        ['be famous for your art', 'be famous for a discovery'],
        ['live without music', 'live without films'],
        ['always tell the truth', 'always know when someone is lying'],
        ['be the best player on a losing team', 'the worst player on a winning team']
    ]
});

export const ODD_ONE_OUT = Object.freeze({
    junior: [
        { words: ['cat', 'dog', 'apple', 'horse'], odd: 'apple', why: 'The others are animals.' },
        { words: ['red', 'blue', 'green', 'chair'], odd: 'chair', why: 'The others are colours.' },
        { words: ['one', 'two', 'book', 'four'], odd: 'book', why: 'The others are numbers.' },
        { words: ['milk', 'juice', 'water', 'bread'], odd: 'bread', why: 'You drink the others.' },
        { words: ['hand', 'foot', 'nose', 'shoe'], odd: 'shoe', why: 'The others are parts of the body.' }
    ],
    mid: [
        { words: ['lion', 'tiger', 'shark', 'leopard'], odd: 'shark', why: 'The others are big cats.' },
        { words: ['guitar', 'piano', 'violin', 'painting'], odd: 'painting', why: 'The others are instruments.' },
        { words: ['Monday', 'June', 'Friday', 'Sunday'], odd: 'June', why: 'June is a month.' },
        { words: ['ran', 'swam', 'jump', 'sang'], odd: 'jump', why: 'The others are past simple.' },
        { words: ['Paris', 'Rome', 'Spain', 'Athens'], odd: 'Spain', why: 'Spain is a country; the others are cities.' }
    ],
    senior: [
        { words: ['whale', 'dolphin', 'shark', 'seal'], odd: 'shark', why: 'The others are mammals.' },
        { words: ['happiness', 'kindness', 'quickly', 'darkness'], odd: 'quickly', why: 'The others are nouns ending in -ness.' },
        { words: ['Mercury', 'Venus', 'Moon', 'Mars'], odd: 'Moon', why: 'The others are planets.' },
        { words: ['went', 'saw', 'played', 'took'], odd: 'played', why: 'The only regular past form.' },
        { words: ['triangle', 'square', 'cube', 'circle'], odd: 'cube', why: 'A cube is 3D; the others are flat shapes.' }
    ]
});

export const SPELL_IT_RIGHT = Object.freeze({
    junior: [
        { right: 'friend', wrong: 'freind' },
        { right: 'school', wrong: 'scool' },
        { right: 'house', wrong: 'hous' },
        { right: 'yellow', wrong: 'yelow' },
        { right: 'because', wrong: 'becuase' }
    ],
    mid: [
        { right: 'beautiful', wrong: 'beatiful' },
        { right: 'Wednesday', wrong: 'Wensday' },
        { right: 'different', wrong: 'diffrent' },
        { right: 'believe', wrong: 'beleive' },
        { right: 'tomorrow', wrong: 'tommorow' }
    ],
    senior: [
        { right: 'necessary', wrong: 'neccessary' },
        { right: 'accommodation', wrong: 'accomodation' },
        { right: 'separate', wrong: 'seperate' },
        { right: 'definitely', wrong: 'definately' },
        { right: 'rhythm', wrong: 'rythm' }
    ]
});

export const LETTER_HUNT_CATEGORIES = Object.freeze({
    junior: ['animals', 'food', 'toys', 'things in the classroom', 'things in a park'],
    mid: ['animals', 'food', 'countries', 'jobs', 'things in a house', 'verbs'],
    senior: ['countries', 'jobs', 'adjectives', 'verbs', 'sports', 'things you find in a city']
});

// Letters that give every category a fair chance.
export const LETTER_HUNT_LETTERS = Object.freeze(['A', 'B', 'C', 'D', 'F', 'G', 'H', 'L', 'M', 'P', 'R', 'S', 'T', 'W']);

export const QUICK_DRAW = Object.freeze({
    junior: ['a happy sun', 'a cat in a hat', 'a big red bus', 'your favourite fruit', 'a fish with a crown', 'a house with a smile'],
    mid: ['a dragon eating spaghetti', 'your dream bedroom', 'a robot teacher', 'a castle on a cloud', 'an animal that does not exist', 'a map of a treasure island'],
    senior: ['the sound of rain', 'a superhero for the planet', 'your future invention', 'a city in 100 years', 'what "freedom" looks like', 'a monster who is afraid of children']
});
