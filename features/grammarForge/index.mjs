// features/grammarForge/index.mjs — the Grammar Forge: a checked bank of grammar items, matched to
// the grammar lines of the Book Atlas units a class has reached. Pure: no DOM, no Firestore.
// Covered by tests/grammar-forge.test.mjs.
//
// Used by the Fortune's Wheel Trials (questions from the class's own grammar), the Quest Remote
// Showdown (grammar cards next to the book words), the Quiz of the Week AI prompt (model sentences
// and typical slips) and the Campfire grammar question (a real example sentence).
// Bands as in features/wonderLibrary: e = Pre-Junior, j = Junior A/B, m = A/B, u = C/D.
// Pre-Junior never gets written grammar: only the spoken chunks in EARLY_CHUNKS.

import { getLeagueBand } from '../languageScaffolds.mjs';
import { BASIC_PATTERNS, EARLY_CHUNKS } from './basics.mjs';
import { TENSE_PATTERNS } from './tenses.mjs';
import { ADVANCED_PATTERNS } from './advanced.mjs';

export { EARLY_CHUNKS };
export const FORGE_PATTERNS = Object.freeze([...BASIC_PATTERNS, ...TENSE_PATTERNS, ...ADVANCED_PATTERNS]);

const BAND_LETTER = { early: 'e', junior: 'j', mid: 'm', upper: 'u' };
/** Items to fall back on when a pattern has none for this band (never harder ones for Junior). */
const FALLBACK = { e: [], j: ['j'], m: ['m', 'j', 'u'], u: ['u', 'm'] };

/** 'e' | 'j' | 'm' | 'u' for a Quest League (no league: 'm'). */
export function forgeBand(league) {
    return league ? BAND_LETTER[getLeagueBand(league)] || 'm' : 'm';
}

/** The parts of one unit's grammar line ("present simple; adverbs of frequency" → two parts). */
function grammarParts(line) {
    return String(line || '').split(/\s*;\s*|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
}

/**
 * The Forge patterns a list of grammar lines teaches, in the order they first appear.
 * @param {string|string[]} lines - Book Atlas `grammar` strings (or quiz grammar points)
 */
export function patternsForGrammar(lines) {
    const found = [];
    for (const line of [].concat(lines || [])) {
        for (const part of grammarParts(line)) {
            for (const p of FORGE_PATTERNS) {
                if (found.includes(p)) continue;
                if (p.match.test(part) && !(p.notMatch && p.notMatch.test(part))) found.push(p);
            }
        }
    }
    return found;
}

function rowsFor(rows, band) {
    for (const b of FALLBACK[band] || FALLBACK.m) {
        const fit = (rows || []).filter((r) => r[0].includes(b));
        if (fit.length) return fit;
    }
    return [];
}

function shuffled(list, rng) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * Every multiple-choice item the patterns hold for a band: { q, opts (right one first), correct: 0, why, pattern }.
 */
export function forgeChoices(patterns, band = 'm') {
    return [].concat(patterns || []).flatMap((p) => rowsFor(p.choose, band)
        .map(([, q, opts, why]) => ({ q, opts: [...opts], correct: 0, why, pattern: p.id, label: p.label })));
}

/** The "fix the sentence" items for a band: { wrong, right, pattern }. */
export function forgeFixes(patterns, band = 'm') {
    return [].concat(patterns || []).flatMap((p) => rowsFor(p.fix, band)
        .map(([, wrong, right]) => ({ wrong, right, pattern: p.id, label: p.label })));
}

/** The oral tasks for a band: { text, pattern }. */
export function forgeSays(patterns, band = 'm') {
    return [].concat(patterns || []).flatMap((p) => rowsFor(p.say, band).map(([, text]) => ({ text, pattern: p.id })));
}

/**
 * Questions for a Trial on the Fortune's Wheel, from the class's grammar: { q, a, pattern }.
 * Choice items show their options in the question; fix items ask the guild to say it right.
 * Pre-Junior gets the spoken chunks instead.
 */
export function forgeRiddles(lines, band = 'm', { rng = Math.random } = {}) {
    if (band === 'e') return EARLY_CHUNKS.map((c) => ({ q: c.q, a: c.a, pattern: 'early' }));
    const patterns = patternsForGrammar(lines);
    const choices = forgeChoices(patterns, band).map((c) => ({
        q: `${c.q} (${shuffled(c.opts, rng).join(' / ')})`,
        a: c.opts[0],
        pattern: c.pattern,
    }));
    const fixes = forgeFixes(patterns, band).map((f) => ({ q: `Say it right: "${f.wrong}"`, a: f.right, pattern: f.pattern }));
    return [...choices, ...fixes];
}

/**
 * Showdown cards from the class's grammar (the Showdown's own shuffling and trimming applies after).
 * @returns {{ q: string, opts: string[], correct: number, why: string, src: string, tag: string }[]}
 */
export function forgeShowdownItems(lines, band = 'm', { src = '', max = 12, rng = Math.random } = {}) {
    if (band === 'e') return [];
    const patterns = patternsForGrammar(lines);
    const srcOf = (label) => src || `Grammar · ${String(label).split(/,| \(/)[0]}`;
    const choices = forgeChoices(patterns, band).map((c) => ({ q: c.q, opts: c.opts, correct: 0, why: c.why, src: srcOf(c.label), tag: 'grammar', pattern: c.pattern }));
    const fixes = forgeFixes(patterns, band).map((f, i, all) => {
        // a wrong sentence and the right one, plus another slip of the same pattern when there is one
        const other = all.find((g) => g !== f && g.pattern === f.pattern);
        const opts = [f.right, f.wrong, ...(other ? [other.wrong] : [])];
        return { q: 'Which sentence is right?', opts, correct: 0, why: `Right: "${f.right}"`, src: srcOf(f.label), tag: 'grammar', pattern: f.pattern };
    });
    // the patterns take turns, so a deck of a few cards still covers the unit's grammar
    const byPattern = new Map();
    for (const item of [...shuffled(choices, rng), ...shuffled(fixes, rng)]) {
        const key = item.pattern;
        if (!byPattern.has(key)) byPattern.set(key, []);
        byPattern.get(key).push(item);
    }
    const queues = shuffled([...byPattern.values()], rng);
    const out = [];
    while (out.length < max && queues.some((q) => q.length)) {
        for (const q of queues) if (q.length && out.length < max) out.push(q.shift());
    }
    return out;
}

/**
 * Anchors for the Quiz of the Week AI prompt: model sentences and the slips to use as wrong options.
 * `wrong`: every known slip for the grammar, to check that no AI answer marks one as right.
 * @returns {{ rules: string[], examples: string[], slips: string[], wrong: string[] }}
 */
export function forgeAnchors(lines, band = 'm', { patterns: max = 3 } = {}) {
    if (band === 'e') return { rules: [], examples: [], slips: [], wrong: [] };
    const all = patternsForGrammar(lines);
    const patterns = all.slice(0, max);
    return {
        wrong: all.flatMap((p) => p.fix.map(([, w]) => w)),
        rules: patterns.map((p) => `${p.label}: ${p.rule}`),
        examples: patterns.flatMap((p) => p.examples.slice(0, 2)),
        slips: patterns.flatMap((p) => rowsFor(p.fix, band).slice(0, 2).map(([, wrong, right]) => `"${wrong}" (right: "${right}")`)),
    };
}

/** One model sentence for a grammar line, picked steadily by `seed` (''). */
export function forgeExample(line, band = 'm', seed = '') {
    if (band === 'e') return '';
    const [p] = patternsForGrammar(line);
    if (!p?.examples?.length) return '';
    let h = 0;
    for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return p.examples[h % p.examples.length];
}

/**
 * The grammar a class has met, from its bookPlan: `recent` = the newest units' lines (newest first),
 * `covered` = every unit up to the one reached in those books.
 * atlas: BOOK_ATLAS (units with { n, grammar }).
 */
export function classGrammarLines(bookPlan = {}, atlas = [], { recentUnits = 3 } = {}) {
    const marks = [];
    const add = (t) => {
        if (!t?.bookId || !(Number(t.unit) > 0)) return;
        if (!marks.some((m) => m.bookId === t.bookId && m.unit === Number(t.unit))) marks.push({ bookId: t.bookId, unit: Number(t.unit) });
    };
    const history = (Array.isArray(bookPlan?.history) ? bookPlan.history : []).filter((h) => h && !h.unconfirmed)
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    for (const h of history) { add(h); (Array.isArray(h.books) ? h.books : []).forEach(add); }
    add({ bookId: bookPlan?.currentBookId, unit: bookPlan?.unit });
    const grammarOf = (bookId, n) => atlas.find((b) => b.id === bookId)?.units?.find((u) => u.n === n)?.grammar || '';
    const recent = [...new Set(marks.slice(0, recentUnits).map((m) => grammarOf(m.bookId, m.unit)).filter(Boolean))];
    const reached = new Map();
    for (const m of marks) reached.set(m.bookId, Math.max(reached.get(m.bookId) || 0, m.unit));
    const covered = [];
    for (const [bookId, last] of reached) {
        for (let n = 1; n <= last; n += 1) {
            const g = grammarOf(bookId, n);
            if (g && !covered.includes(g)) covered.push(g);
        }
    }
    return { recent, covered };
}

/** How many items the Forge holds (for the guidebook and the tests). */
export function forgeCount() {
    return FORGE_PATTERNS.reduce((n, p) => n + p.choose.length + p.fix.length + p.say.length, 0) + EARLY_CHUNKS.length;
}
