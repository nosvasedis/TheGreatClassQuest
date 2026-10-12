// features/wonderLibrary/index.mjs — the Wonder Library: checked, league-matched content for the
// projector (The Director). Pure: no DOM, no Firestore. Loaded only when a projector card needs it.
// Covered by tests/wonder-library.test.mjs.
//
// Every shelf holds rows tagged with the bands they suit (e = Pre-Junior, j = Junior A/B,
// m = A/B, u = C/D, as in features/languageScaffolds.mjs). pickWonder() returns one fresh item
// for a card kind and a league, skipping the ones shown recently.

import { getLeagueBand } from '../languageScaffolds.mjs';
import { FACTS, DID_YOU_KNOW_SHELVES } from './facts.mjs';
import { ON_THIS_DAY } from './onThisDay.mjs';
import { WORDS, IDIOMS, TWISTERS, ORIGINS } from './english.mjs';
import { RIDDLES, EMOJI_RIDDLES, JOKES, TEASERS, THOUGHT_EXPERIMENTS } from './puzzles.mjs';
import { MYTHS, FIGURES, BOOKS } from './stories.mjs';
import { STUDY_TIPS, HEALTHY_HABITS, ECO_TIPS, CREATIVE_PROMPTS, SCIENCE_DEMOS } from './heart.mjs';

const BAND_LETTER = { early: 'e', junior: 'j', mid: 'm', upper: 'u' };
/** The nearest bands to fall back on when a shelf has nothing for this one. */
const FALLBACK = { e: ['e', 'j'], j: ['j', 'e', 'm'], m: ['m', 'j', 'u'], u: ['u', 'm'] };

/** 'e' | 'j' | 'm' | 'u' for a Quest League (no league: 'm'). */
export function wonderBand(league) {
    return league ? BAND_LETTER[getLeagueBand(league)] || 'm' : 'm';
}

const hash = (text) => {
    let h = 5381;
    const s = String(text || '');
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
};

const toFact = ([bands, icon, text]) => ({ bands, icon, text });
const facts = (shelf) => (FACTS[shelf] || []).map(toFact);

/** Card kind → shelf rows as objects with `bands`. */
const SHELVES = {
    fact_science: () => facts('science'),
    fact_nature: () => facts('nature'),
    fact_space: () => facts('space'),
    fact_body: () => facts('body'),
    fact_geography: () => facts('geography'),
    fact_history: () => facts('history'),
    fact_math: () => facts('math'),
    fact_greece: () => facts('greece'),
    inventions: () => facts('inventions'),
    did_you_know: () => DID_YOU_KNOW_SHELVES.flatMap(facts),
    world_record: () => facts('records'),
    word: () => WORDS.map(([bands, icon, word, meaning, example]) => ({ bands, icon, word, meaning, example })),
    idiom: () => IDIOMS.map(([bands, phrase, meaning, example]) => ({ bands, phrase, meaning, example })),
    tongue_twister: () => TWISTERS.map(([bands, text]) => ({ bands, text })),
    language_origin: () => ORIGINS.map(([bands, icon, word, story]) => ({ bands, icon, word, story })),
    riddle: () => RIDDLES.map(([bands, icon, question, answer]) => ({ bands, icon, question, answer })),
    emoji_riddle: () => EMOJI_RIDDLES.map(([bands, puzzle, answer]) => ({ bands, puzzle, answer })),
    joke: () => JOKES.map(([bands, question, answer]) => ({ bands, question, answer })),
    brain_teaser: () => TEASERS.map(([bands, icon, question, answer]) => ({ bands, icon, question, answer })),
    thought_experiment: () => THOUGHT_EXPERIMENTS.map(([bands, icon, question]) => ({ bands, icon, question })),
    myth: () => MYTHS.map(([bands, icon, title, story]) => ({ bands, icon, title, story })),
    figure: () => FIGURES.map(([bands, icon, name, years, text]) => ({ bands, icon, name, years, text })),
    book: () => BOOKS.map(([bands, icon, title, author, why]) => ({ bands, icon, title, author, why })),
    study_tip: () => STUDY_TIPS.map(([bands, icon, text]) => ({ bands, icon, text })),
    healthy_habit: () => HEALTHY_HABITS.map(([bands, icon, text]) => ({ bands, icon, text })),
    eco_tip: () => ECO_TIPS.map(([bands, icon, text]) => ({ bands, icon, text })),
    creative_prompt: () => CREATIVE_PROMPTS.map(([bands, icon, text]) => ({ bands, icon, text })),
    science_demo: () => SCIENCE_DEMOS.map(([bands, icon, title, how, why]) => ({ bands, icon, title, how, why }))
};

export const WONDER_KINDS = Object.freeze(Object.keys(SHELVES));

const shelfCache = new Map();
function shelf(kind) {
    if (!shelfCache.has(kind)) {
        const rows = (SHELVES[kind]?.() || []).map((row) => ({ ...row, id: hash(`${kind}|${JSON.stringify(row)}`) }));
        shelfCache.set(kind, rows);
    }
    return shelfCache.get(kind);
}

/** The rows of a shelf for a band, falling back to the nearest band when it has none. */
export function wonderShelf(kind, band = 'm') {
    const rows = shelf(kind);
    for (const b of FALLBACK[band] || FALLBACK.m) {
        const fit = rows.filter((r) => r.bands.includes(b));
        if (fit.length) return fit;
    }
    return [];
}

/**
 * One item for a card kind and band, avoiding the ids in `recent` while fresh ones remain.
 * @returns {object|null} the row (with its stable `id`)
 */
export function pickWonder(kind, band = 'm', { recent = [], rng = Math.random } = {}) {
    const rows = wonderShelf(kind, band);
    if (!rows.length) return null;
    const fresh = rows.filter((r) => !recent.includes(r.id));
    const pool = fresh.length ? fresh : rows;
    return pool[Math.floor(rng() * pool.length)] || null;
}

const pad = (n) => String(n).padStart(2, '0');
const SCIENCE_TAGS = new Set(['science', 'space', 'nature']);

/**
 * What happened on this day (a Date or 'YYYY-MM-DD'), for the science card ('science') or the
 * history card ('history': people, Greece, books, arts, sport and world days).
 * Each item has `text` written for the band (the simple version up to Junior B).
 */
export function onThisDay(dateLike = new Date(), { side = 'history', band = 'm' } = {}) {
    const date = typeof dateLike === 'string' ? new Date(`${dateLike}T12:00:00`) : dateLike;
    const key = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const kid = band === 'e' || band === 'j';
    return ON_THIS_DAY
        .filter(([d, , , tag]) => d === key && (side === 'science' ? SCIENCE_TAGS.has(tag) : !SCIENCE_TAGS.has(tag)))
        .map(([d, year, icon, tag, kidText, fullText]) => ({
            id: hash(`${d}|${year}|${fullText}`), date: d, year, icon, tag, worldDay: year === 0,
            text: kid ? kidText : fullText
        }));
}

/** How many rows the library holds (for the guidebook and the tests). */
export function wonderCount() {
    return WONDER_KINDS.filter((k) => k !== 'did_you_know').reduce((n, k) => n + shelf(k).length, 0) + ON_THIS_DAY.length;
}
