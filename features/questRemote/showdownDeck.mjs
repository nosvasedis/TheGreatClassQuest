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
 * The kinds of word question, and which a book's wordlist can make: Primary Path lists carry Greek
 * meanings and example sentences, Close-Up carries English definitions with an example after "●", the
 * junior books (Bamboo, Yeti) carry the words alone, so they get spelling and missing-letter questions.
 */
export const WORD_KINDS = Object.freeze([
    { key: 'meaning', label: 'Meanings', hint: 'Greek ↔ English' },
    { key: 'define', label: 'Definitions', hint: 'Which word means…' },
    { key: 'gap', label: 'Gap-fills', hint: "The book's own sentences" },
    { key: 'spell', label: 'Spelling', hint: 'Which is spelled right?' },
    { key: 'letter', label: 'Missing letter', hint: 'k _ t e' }
]);
const KIND_KEYS = WORD_KINDS.map((k) => k.key);

/** The kinds a book's wordlist can make (by book id; unknown books get spelling and letters). */
export function wordKindsForBook(bookId = '') {
    if (/^primary-path-/.test(bookId)) return ['meaning', 'gap', 'spell', 'letter'];
    if (bookId === 'close-up-b1') return ['define', 'gap', 'spell'];
    return ['spell', 'letter'];
}

/** A Close-Up style "definition ● example" split in two. */
function splitDef(def) {
    const [meaning, example] = String(def || '').split('●');
    return { meaning: clean(meaning, 120), example: clean(example, 150) };
}

const VOWELS = 'aeiou';
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** Up to `n` believable misspellings of a word (a doubled, swapped, dropped or changed letter). */
export function misspellings(word, n = 3, rng = Math.random) {
    const w = String(word || '');
    const lower = w.toLowerCase();
    const out = new Set();
    const tries = [];
    for (let i = 1; i < w.length; i++) {
        if (/[a-z]/i.test(w[i])) tries.push(w.slice(0, i) + w[i] + w.slice(i)); // doubled
        if (i < w.length - 1 && /[a-z]/i.test(w[i]) && /[a-z]/i.test(w[i + 1]) && w[i] !== w[i + 1]) tries.push(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2)); // swapped
        // dropped (only from longer words: "hurt" without its r is the real word "hut")
        if (w.length > 5 && /[a-z]/i.test(w[i])) tries.push(w.slice(0, i) + w.slice(i + 1));
        if (VOWELS.includes(lower[i])) {
            for (const v of VOWELS) if (v !== lower[i]) tries.push(w.slice(0, i) + v + w.slice(i + 1)); // changed vowel
        }
    }
    for (const t of shuffled(tries, rng)) {
        if (out.size >= n) break;
        if (t.toLowerCase() !== lower && t.length >= 2) out.add(t);
    }
    return [...out];
}

/**
 * One card for a word, of one kind (null when this word cannot make that kind).
 * list: every word of the chosen units (distractors come from them).
 */
function wordCard(word, kind, list, { n, rng, flip }) {
    const src = word.src || 'Book words';
    const isWord = /^[a-z][a-z' -]*$/i.test(word.w) && word.w.replace(/[^a-z]/gi, '').length >= 3;
    if (kind === 'meaning') {
        if (!word.gr) return null;
        const other = (pick) => distractors(list, word, n, pick, rng);
        if (flip) {
            const o = other((x) => x.w);
            if (o.length < 2) return null;
            return makeCard({ q: `How do you say “${word.gr}” in English?`, opts: [word.w, ...o.map((x) => x.w)], correct: 0, why: `${word.gr} = ${word.w}`, src, tag: 'english' }, rng);
        }
        const o = other((x) => x.gr);
        if (o.length < 2) return null;
        return makeCard({ q: `What does “${word.w}” mean?`, opts: [word.gr, ...o.map((x) => x.gr)], correct: 0, why: `${word.w} = ${word.gr}`, src, tag: 'meaning' }, rng);
    }
    if (kind === 'define') {
        if (!word.meaning || word.meaning.length < 8) return null;
        const o = distractors(list, word, n, (x) => x.w, rng);
        if (o.length < 2) return null;
        return makeCard({ q: `Which word means: “${word.meaning}”?`, opts: [word.w, ...o.map((x) => x.w)], correct: 0, why: word.example || `${word.w}: ${word.meaning}`, src, tag: 'define' }, rng);
    }
    if (kind === 'gap') {
        const re = new RegExp(`\\b${escapeRe(word.w)}\\b`, 'i');
        if (!word.example || !re.test(word.example) || word.example.length < word.w.length + 8) return null;
        const o = distractors(list, word, n, (x) => x.w, rng);
        if (o.length < 2) return null;
        return makeCard({ q: `Fill the gap: ${word.example.replace(re, '_____')}`, opts: [word.w, ...o.map((x) => x.w)], correct: 0, why: word.example, src, tag: 'gap' }, rng);
    }
    if (kind === 'spell') {
        if (!isWord || /\s/.test(word.w)) return null;
        const wrong = misspellings(word.w, n, rng).filter((m) => !list.some((x) => x.w.toLowerCase() === m.toLowerCase()));
        if (wrong.length < 2) return null;
        return makeCard({ q: 'Which word is spelled right?', opts: [word.w, ...wrong], correct: 0, why: word.gr ? `${word.w} = ${word.gr}` : `${word.w}`, src, tag: 'spell' }, rng);
    }
    if (kind === 'letter') {
        if (!isWord || /\s/.test(word.w) || word.w.length < 3) return null;
        const spots = [...word.w].map((ch, i) => (i > 0 && /[a-z]/i.test(ch) ? i : -1)).filter((i) => i > 0);
        if (!spots.length) return null;
        const at = spots[Math.floor(rng() * spots.length)];
        const right = word.w[at].toLowerCase();
        const pool = shuffled([...(VOWELS.includes(right) ? VOWELS : LETTERS)].filter((ch) => ch !== right && !VOWELS.includes(ch) === !VOWELS.includes(right)), rng);
        const shown = [...word.w].map((ch, i) => (i === at ? '_' : ch)).join(' ');
        return makeCard({ q: `Which letter is missing? ${shown}`, opts: [right, ...pool.slice(0, n)], correct: 0, why: word.w, src, tag: 'letter' }, rng);
    }
    return null;
}

/**
 * Cards from book atlas words ([{ w, pos?, gr?, example?, def?, src? }], several units pooled so the
 * wrong options come from every chosen unit). `kinds` are the kinds the teacher chose; each word tries
 * them in turn (the next kind when a word cannot make one). `young` (the junior leagues) keeps to three options.
 */
export function wordDeckCards(words = [], { kinds = KIND_KEYS, src = 'Book words', young = false, rng = Math.random, max = DECK_MAX } = {}) {
    const list = [];
    const seen = new Set();
    for (const w of words || []) {
        const word = clean(w?.w, 40);
        if (!word || seen.has(word.toLowerCase())) continue;
        seen.add(word.toLowerCase());
        const def = splitDef(w.def);
        list.push({ w: word, pos: w.pos || '', gr: clean(w.gr, 50), example: clean(w.example, 150) || def.example, meaning: def.meaning, src: clean(w.src, 40) || src });
    }
    const chosen = (Array.isArray(kinds) ? kinds : []).filter((k) => KIND_KEYS.includes(k));
    if (list.length < 3 || !chosen.length) return [];
    const n = young ? 2 : 3;
    const cards = [];
    shuffled(list, rng).forEach((word, i) => {
        if (cards.length >= max) return;
        // take turns between the chosen kinds, falling back to the next one this word can make
        for (let k = 0; k < chosen.length; k++) {
            const card = wordCard(word, chosen[(i + k) % chosen.length], list, { n, rng, flip: i % 2 === 1 });
            if (card) { cards.push(card); break; }
        }
    });
    return cards;
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

/** A short name for a book on a chip ("Primary Path 2", "Close-Up B1"). */
export function shortBookTitle(book) {
    return clean(String(book?.title || book?.id || 'Book').replace(/^(Cambridge|New|English with|Burlington)\s+/i, '').replace(/\s+and Friends Primary/i, ''), 22);
}

/** The unit the class has reached in a book (newest confirmed lesson, else the class's current unit), 0 when unknown. */
export function reachedUnit(bookPlan = {}, bookId = '') {
    const units = (Array.isArray(bookPlan?.history) ? bookPlan.history : [])
        .flatMap((h) => (h && !h.unconfirmed ? [h, ...(Array.isArray(h.books) ? h.books : [])] : []))
        .filter((t) => t?.bookId === bookId && Number(t.unit) > 0).map((t) => Number(t.unit));
    if (bookPlan?.currentBookId === bookId && Number(bookPlan.unit) > 0) units.push(Number(bookPlan.unit));
    return units.length ? Math.max(...units) : 0;
}

/**
 * The Forge's starting choice of book words for a class (the teacher can change all of it):
 * the class's own book when it has a wordlist (else its league's book), the unit it has reached and
 * the two before it, and every kind of question that book can make.
 * atlas: BOOK_ATLAS; wordBooks: ids with a wordlist; bookPlan: the class's plan; league: its questLevel.
 */
export function defaultWordChoice({ atlas = [], wordBooks = [], bookPlan = {}, league = '' } = {}) {
    const has = (id) => wordBooks.includes(id) && atlas.some((b) => b.id === id);
    const fromHistory = [...(Array.isArray(bookPlan?.history) ? bookPlan.history : [])].reverse()
        .flatMap((h) => (h && !h.unconfirmed ? [h, ...(Array.isArray(h.books) ? h.books : [])] : [])).map((t) => t?.bookId).find(has);
    const book = (has(bookPlan?.currentBookId) && bookPlan.currentBookId) || fromHistory
        || atlas.find((b) => has(b.id) && (b.defaultLeagues || []).includes(league))?.id
        || wordBooks.find(has) || '';
    if (!book) return null;
    const size = atlas.find((b) => b.id === book)?.units?.length || 1;
    const reached = Math.min(size, reachedUnit(bookPlan, book) || 1);
    const units = [];
    for (let u = Math.max(1, reached - 2); u <= reached; u++) units.push(u);
    return { book, units, kinds: wordKindsForBook(book) };
}

/** The teacher's choice made safe against the atlas (unknown units dropped, kinds limited to what the book can make). */
export function cleanWordChoice(choice, { atlas = [], wordBooks = [] } = {}) {
    const book = atlas.find((b) => b.id === choice?.book && wordBooks.includes(b.id));
    if (!book) return null;
    const size = book.units?.length || 0;
    const units = [...new Set((choice.units || []).map(Number))].filter((u) => Number.isInteger(u) && u >= 1 && u <= size).sort((a, b) => a - b).slice(0, 40);
    const can = wordKindsForBook(book.id);
    const kinds = (Array.isArray(choice.kinds) ? choice.kinds : can).filter((k) => can.includes(k));
    return units.length ? { book: book.id, units, kinds: kinds.length ? kinds : can } : null;
}

/** "Unit 3 · Food" style label of a deck's words. */
export function deckUnitLabel(unit, describe) {
    const u = describe ? describe(unit) : null;
    const title = clean(u?.title, 24);
    // junior books name their units "Lesson 3": that is the whole label
    if (/^lesson\s+\d+$/i.test(title)) return title;
    return title ? `Unit ${unit.unit} · ${title}` : `Unit ${unit.unit}`;
}
