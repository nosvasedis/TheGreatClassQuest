// features/questRemote/showdownDeck.mjs — the Showdown's question deck (pure, tested).
// The teacher may let the Showdown bring its own questions instead of asking out loud:
//  · Quiz of the Week: questions from quizzes the class has ALREADY played (this week's quiz stays a
//    secret until it is played), the ones the class missed on the first try coming first: a revision race.
//  · Book words: quick questions made on the spot from the book atlas wordlists of the units the class
//    has been practising (gap-fills from the book's own example sentences, meanings in Greek and back).
// No AI call, no new document: the quizzes are read once when the show opens, the wordlists ship with the app.

export const DECK_MAX = 30;
const KEEP_KINDS = new Set(['choice', 'fix', undefined, null, '']);

function clean(text, max = 160) {
    return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function shuffled(list, rng = Math.random) {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** One card: the options shuffled with the right one followed, so a re-used quiz never has the same letter. */
function makeCard({ q, opts, correct, why = '', src = '', tag = '', missed = false }, rng) {
    const list = opts.map((t, i) => ({ t: clean(t, 70), right: i === correct })).filter((o) => o.t);
    if (list.length < 2 || !list.some((o) => o.right)) return null;
    const mixed = shuffled(list, rng).slice(0, 4);
    if (!mixed.some((o) => o.right)) mixed[mixed.length - 1] = list.find((o) => o.right);
    return {
        q: clean(q, 160),
        opts: mixed.map((o) => o.t),
        correct: mixed.findIndex((o) => o.right),
        why: clean(why, 140),
        src: clean(src, 40),
        tag,
        missed: Boolean(missed)
    };
}

/**
 * Cards from Quiz of the Week documents. quizzes: [{ weekKey, status, questions[], results? }].
 * Only played (completed) quizzes count; picture and listening questions stay in the quiz (the arena has
 * no pictures or voice), and a question the class missed on the first try comes first.
 */
export function quizDeckCards(quizzes = [], { rng = Math.random } = {}) {
    const missed = [];
    const rest = [];
    const seen = new Set();
    for (const quiz of quizzes || []) {
        if (!quiz || quiz.status !== 'completed') continue;
        const stats = new Map((Array.isArray(quiz.results?.questionStats) ? quiz.results.questionStats : []).map((s) => [s?.questionId, s]));
        const label = quiz.weekKey ? `Quiz · ${String(quiz.weekKey).replace(/^\d{4}-W/, 'week ')}` : 'Quiz of the Week';
        for (const raw of Array.isArray(quiz.questions) ? quiz.questions : []) {
            if (!raw || !KEEP_KINDS.has(raw.kind) || (raw.type && raw.type !== 'mcq')) continue;
            const options = Array.isArray(raw.options) ? raw.options : [];
            const correct = Number.isInteger(raw.correctIndex) ? raw.correctIndex : options.indexOf(raw.correctAnswer);
            const q = clean(raw.question);
            const key = q.toLowerCase();
            if (!q || correct < 0 || seen.has(key)) continue;
            seen.add(key);
            const stat = stats.get(raw.id);
            const wasMissed = Boolean(stat && stat.asked !== false && stat.firstTryCorrect === false);
            const card = makeCard({ q, opts: options, correct, why: raw.explanation, src: wasMissed ? `${label} · missed` : label, tag: 'quiz', missed: wasMissed }, rng);
            if (card) (wasMissed ? missed : rest).push(card);
        }
    }
    return [...shuffled(missed, rng), ...shuffled(rest, rng)];
}

function escapeRe(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Up to `n` other words to stand beside the right one (same part of speech first). */
function distractors(words, word, n, pick, rng) {
    const others = words.filter((w) => w !== word && pick(w) && pick(w).toLowerCase() !== pick(word).toLowerCase());
    const same = shuffled(others.filter((w) => w.pos && w.pos === word.pos), rng);
    const any = shuffled(others.filter((w) => !(w.pos && w.pos === word.pos)), rng);
    const out = [];
    for (const w of [...same, ...any]) {
        if (out.length >= n) break;
        if (!out.some((o) => pick(o).toLowerCase() === pick(w).toLowerCase())) out.push(w);
    }
    return out;
}

/**
 * Cards from book atlas words ([{ w, pos?, gr?, example? }]): a gap-fill where the book's example sentence
 * holds the word, otherwise "What does … mean?" (Greek meanings) or "How do you say … in English?".
 * `young` (the junior leagues) keeps to three options.
 */
export function wordDeckCards(words = [], { src = 'Book words', young = false, rng = Math.random, max = DECK_MAX } = {}) {
    const list = [];
    const seen = new Set();
    for (const w of words || []) {
        const word = clean(w?.w, 40);
        if (!word || seen.has(word.toLowerCase())) continue;
        seen.add(word.toLowerCase());
        list.push({ w: word, pos: w.pos || '', gr: clean(w.gr, 50), example: clean(w.example, 150) });
    }
    if (list.length < 3) return [];
    const n = young ? 2 : 3;
    const cards = [];
    shuffled(list, rng).forEach((word, i) => {
        if (cards.length >= max) return;
        const re = new RegExp(`\\b${escapeRe(word.w)}\\b`, 'i');
        const kind = word.example && re.test(word.example) && word.example.length > word.w.length + 8 ? 'gap'
            : word.gr ? (i % 2 ? 'meaning' : 'english') : '';
        if (!kind) return;
        if (kind === 'gap') {
            const others = distractors(list, word, n, (o) => o.w, rng);
            if (others.length < 2) return;
            cards.push(makeCard({
                q: `Fill the gap: ${word.example.replace(re, '_____')}`,
                opts: [word.w, ...others.map((o) => o.w)], correct: 0, why: word.example, src, tag: 'gap'
            }, rng));
        } else if (kind === 'meaning') {
            const others = distractors(list, word, n, (o) => o.gr, rng);
            if (others.length < 2) return;
            cards.push(makeCard({
                q: `What does “${word.w}” mean?`,
                opts: [word.gr, ...others.map((o) => o.gr)], correct: 0, why: `${word.w} = ${word.gr}`, src, tag: 'meaning'
            }, rng));
        } else {
            const others = distractors(list, word, n, (o) => o.w, rng);
            if (others.length < 2) return;
            cards.push(makeCard({
                q: `How do you say “${word.gr}” in English?`,
                opts: [word.w, ...others.map((o) => o.w)], correct: 0, why: `${word.gr} = ${word.w}`, src, tag: 'english'
            }, rng));
        }
    });
    return cards.filter(Boolean);
}

/** The deck for a show: one source, or both shuffled together (quiz questions and words taking turns). */
export function buildShowdownDeck(source, { quiz = [], words = [], max = DECK_MAX } = {}) {
    if (source === 'quiz') return quiz.slice(0, max);
    if (source === 'words') return words.slice(0, max);
    if (source !== 'mix') return [];
    const out = [];
    for (let i = 0; out.length < max && (i < quiz.length || i < words.length); i++) {
        if (quiz[i]) out.push(quiz[i]);
        if (words[i] && out.length < max) out.push(words[i]);
    }
    return out;
}

/**
 * The book units the class has been practising, newest first (from the class's bookPlan:
 * confirmed lesson history, then the current book and unit). Each { bookId, unit, component, page }.
 */
export function deckUnits(bookPlan = {}, { max = 3 } = {}) {
    const out = [];
    const add = (t) => {
        if (!t?.bookId || !t.unit || out.length >= max) return;
        const component = t.component || 'sb';
        if (out.some((u) => u.bookId === t.bookId && String(u.unit) === String(t.unit) && u.component === component)) return;
        out.push({ bookId: t.bookId, unit: t.unit, component, page: t.page || null });
    };
    const history = (Array.isArray(bookPlan?.history) ? bookPlan.history : []).filter((h) => h && !h.unconfirmed)
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    history.forEach(add);
    add({ bookId: bookPlan?.currentBookId, unit: bookPlan?.unit, component: bookPlan?.component, page: bookPlan?.page });
    return out;
}

/** "Unit 3 · Food" style label of a deck's words. */
export function deckUnitLabel(unit, describe) {
    const u = describe ? describe(unit) : null;
    const title = clean(u?.title, 24);
    return title ? `Unit ${unit.unit} · ${title}` : `Unit ${unit.unit}`;
}
