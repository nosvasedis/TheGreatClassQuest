/**
 * Hero Campfire: pure script shaping (question bank, lesson targeting, session merging).
 * No DOM or Firestore; covered by tests/hero-campfire-core.test.mjs.
 *
 * The question is chosen from what the class actually did: the book unit it practised,
 * the words from its homework or photocopies, and today's activities (quiz, story, test).
 * Recently used questions are skipped so the ritual never feels repetitive.
 */
import { getLeagueBand } from './languageScaffolds.mjs';
import { pickFairRotation } from '../utils/fairRotation.mjs';

export const CAMPFIRE_STAGES = ['kindling', 'words', 'question', 'glow', 'circle', 'kept', 'sleep'];
export const RECENT_QUESTION_MEMORY = 10;
export const cleanCampfireText = (s, max = 220) => typeof s === 'string' ? s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';

// ─── Question bank ───────────────────────────────────────────────────────────
// Each entry: [question, followUp, starters]. {theme}, {word}, {words}, {grammar}
// are filled from the lesson; an entry is only eligible when its slots can be filled.
const GENERIC = {
    early: [
        ['😊 What made you smile today?', 'Show us with your face!', ['I like…', 'Happy!']],
        ['🤝 Who helped our circle today?', 'Send them a little wave.', ['My friend…', 'Thank you!']],
        ['🌟 What can we do again next time?', 'Show us with your hands.', ['Let’s…', 'I can…']]
    ],
    junior: [
        ['What little brave thing did you try today?', 'How did it feel?', ['I tried…', 'I felt…']],
        ['How did someone help you learn today?', 'What could you say to them?', ['Thank you for…', 'You helped me…']],
        ['What was the most fun part of our lesson?', 'Why did you like it?', ['I liked…', 'It was fun because…']]
    ],
    mid: [
        ['What became a little easier with practice today?', 'What helped you take that step?', ['At first…', 'Then I tried…']],
        ['Which idea from today would you share with a friend?', 'What makes it worth sharing?', ['I discovered…', 'It matters because…']],
        ['When did our class work well together?', 'What can we carry into our next lesson?', ['We helped by…', 'Next time we could…']]
    ],
    upper: [
        ['Which moment changed how you understood today’s lesson?', 'What will you try differently next time?', ['I used to think…', 'Now I notice…']],
        ['What useful mistake did you make today?', 'Which strategy helped you respond?', ['I realised that…', 'A strategy I could reuse is…']],
        ['How did another perspective improve your thinking?', 'How could you invite more voices next time?', ['I reconsidered…', 'Building on that idea…']]
    ]
};
const THEMED = {
    early: [['🎒 Can you show us something from {theme}?', 'Point, act or say one word!', ['Look!', 'It’s a…']]],
    junior: [
        ['What is your favourite thing about {theme}?', 'Can you say it in a sentence?', ['My favourite…', 'I like… because…']],
        ['Tell a friend one thing about {theme}.', 'Can they tell you one more?', ['There is…', 'I can see…']]
    ],
    mid: [
        ['What is one new thing you now know about {theme}?', 'Where could you use it outside class?', ['Now I know that…', 'I could use this when…']],
        ['If you taught {theme} to a younger child, where would you start?', 'Which example would help them most?', ['First, I would…', 'For example,…']]
    ],
    upper: [
        ['How has today’s work on {theme} changed what you think?', 'Which detail convinced you?', ['I used to believe…', 'What changed my mind was…']],
        ['What question about {theme} is still open for you?', 'How could we find out more?', ['I still wonder…', 'We could explore…']]
    ]
};
// Cambridge Primary Path units are "Big Questions"; they deserve their own phrasing.
const BIG_QUESTION = {
    early: [['🌍 {bq} Show us with your hands!', 'Point, act or say one word.', ['Look!', 'I can…']]],
    junior: [
        ['Our big question: “{bq}” What can you say now?', 'Tell a partner one idea.', ['I think…', 'We learned that…']],
        ['Think about “{bq}” Draw your answer in the air!', 'Can you say it in English?', ['It’s…', 'I can see…']]
    ],
    mid: [
        ['Remember our big question: “{bq}” How would you answer it today?', 'What helped you find your answer?', ['Today I would say…', 'What helped me was…']],
        ['Has your answer to “{bq}” changed?', 'What made you think again?', ['At first I thought…', 'Now I think…']]
    ],
    upper: [['How would you answer “{bq}” now, with an example?', 'What would a classmate add?', ['In my view,…', 'For example,…']]]
};
const WORDY = {
    early: [['🔤 Which word can you say with us: {words}?', 'Say it loudly, then quietly!', ['{word}!', 'I can say…']]],
    junior: [
        ['Which word would you take on an adventure: {words}?', 'Can you put it in a sentence?', ['My word is…', 'I can see…']],
        ['Can you make a sentence with “{word}”?', 'Can a partner make a different one?', ['I have got a…', 'There is a…']]
    ],
    mid: [
        ['Which word from today will you keep: {words}?', 'Use it in a sentence about your life.', ['I will keep… because…', 'Yesterday I…']],
        ['How would you explain “{word}” without translating it?', 'Can you give an example?', ['It means something like…', 'For example,…']]
    ],
    upper: [
        ['Use “{word}” in a sentence that is true for you.', 'Which other word from today could follow it?', ['Personally,…', 'In my experience,…']],
        ['Which of these words is hardest to use well: {words}?', 'What would help you remember it?', ['The tricky part is…', 'I will remember it by…']]
    ]
};
const GRAMMAR = {
    early: [['👂 Can we say a little {grammar} together?', 'Say it, then try it with your hands!', ['Listen!', 'I can say…']]],
    junior: [['Can you make a sentence with {grammar}?', 'Can a friend make a different one?', ['I have…', 'There is…']]],
    mid: [['When could you use {grammar} outside the classroom?', 'Give one real example.', ['I could use it when…', 'For example,…']]],
    upper: [['What is the trickiest part of {grammar} for you?', 'Which example helped it click?', ['I often mix up…', 'It clicked when…']]]
};
const SOURCE = {
    quiz: {
        junior: ['Which quiz question made you think the most?', 'What helped you find the answer?', ['The question about…', 'I remembered…']],
        mid: ['Which quiz question made you think the most?', 'What would help you next time?', ['The hardest one was…', 'Next time I will…']],
        upper: ['Which quiz answer surprised you?', 'What does it tell you about how you learn?', ['I was surprised that…', 'It shows I…']]
    },
    story: {
        junior: ['What should happen next in our story?', 'Who will be brave?', ['Next,…', 'Suddenly,…']],
        mid: ['What should happen next in our story, and why?', 'Which word from today could appear in it?', ['I think… because…', 'The next scene…']],
        upper: ['What should our story’s next chapter reveal?', 'How could it surprise the reader?', ['Little did they know…', 'The twist could be…']]
    },
    trial: {
        junior: ['What helped you get ready for today’s test?', 'What will you do the same next time?', ['I practised…', 'Next time I will…']],
        mid: ['What helped you prepare for today’s test?', 'What would you change for the next one?', ['The best help was…', 'I will change…']],
        upper: ['Which preparation strategy paid off today?', 'Which one will you drop?', ['What worked was…', 'I will stop…']]
    }
};

function fill(template, slots) {
    return template.replace(/\{(\w+)\}/g, (_, key) => slots[key] ?? '');
}
function hashSeed(text) {
    let h = 2166136261;
    for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
export function questionKey(question) {
    return hashSeed(cleanCampfireText(question, 220).toLowerCase()).toString(36);
}

/**
 * First homework of a Primary Path unit should not ask whether the answer “changed”.
 * Later visits to the same unit may. Yeti units are one lesson each, so they stay “first”.
 */
export function unitContinuity(history = [], practised, date = '') {
    if (!practised?.bookId || practised.unit == null || !date) return 'unknown';
    const prior = (Array.isArray(history) ? history : []).filter(h => h && h.date && h.date < date && !h.unconfirmed
        && h.bookId === practised.bookId && Number(h.unit) === Number(practised.unit));
    return prior.length > 1 ? 'continuing' : prior.length === 1 ? 'first' : 'unknown';
}
function bigQuestionEntries(band, continuity) {
    const entries = BIG_QUESTION[band] || [];
    const changed = entries.filter(e => /changed/i.test(e[0]));
    const stable = entries.filter(e => !/changed/i.test(e[0]));
    if (continuity === 'continuing') return changed.length ? changed : entries;
    if (stable.length) return stable;
    return entries;
}

/**
 * Pick one reflection question. Lesson-anchored questions (theme, words, grammar, today's
 * activities) come before generic ones; recently used questions are skipped.
 * @returns {{ question: string, followUp: string, starters: string[], kind: string, key: string }}
 */
export function pickReflectionQuestion({ band = 'mid', theme = '', bigQuestion = '', words = [], grammar = '', sources = [], recentKeys = [], seed = '',
    continuity = 'unknown', preferGrammar = false } = {}) {
    const slots = {
        theme: cleanCampfireText(theme, 80),
        bq: cleanCampfireText(bigQuestion, 90),
        word: cleanCampfireText(words[0] || '', 40),
        words: words.slice(0, 3).map(w => cleanCampfireText(w, 30)).filter(Boolean).join(', '),
        grammar: cleanCampfireText(Array.isArray(grammar) ? grammar[0] : grammar, 80)
    };
    const pools = [];
    for (const source of ['trial', 'quiz', 'story']) {
        const entry = sources.includes(source) && SOURCE[source][band];
        if (entry) pools.push({ kind: source, entries: [entry] });
    }
    const grammarEntries = GRAMMAR[band] || [];
    if (preferGrammar && slots.grammar && grammarEntries.length) pools.push({ kind: 'grammar', entries: grammarEntries });
    if (slots.bq) pools.push({ kind: 'bigQuestion', entries: bigQuestionEntries(band, continuity) });
    if (slots.theme) pools.push({ kind: 'theme', entries: THEMED[band] || [] });
    if (slots.words) pools.push({ kind: 'words', entries: WORDY[band] || [] });
    if (!preferGrammar && slots.grammar && grammarEntries.length) pools.push({ kind: 'grammar', entries: grammarEntries });
    pools.push({ kind: 'generic', entries: GENERIC[band] || GENERIC.mid });

    const recent = new Set(recentKeys);
    const candidates = pools.flatMap(pool => pool.entries.map(entry => {
        const [q, f, s] = entry.map(part => Array.isArray(part) ? part.map(p => fill(p, slots)) : fill(part, slots));
        return { kind: pool.kind, question: cleanCampfireText(q), followUp: cleanCampfireText(f), starters: s.map(x => cleanCampfireText(x, 100)).filter(Boolean) };
    })).filter(c => c.question);
    const fresh = candidates.filter(c => !recent.has(questionKey(c.question)));
    const usable = fresh.length ? fresh : candidates;
    // Prefer the most lesson-specific pool that still has an unused question.
    const bestKind = usable[0].kind;
    const best = usable.filter(c => c.kind === bestKind);
    const choice = best[hashSeed(seed) % best.length];
    return { ...choice, key: questionKey(choice.question) };
}

/** Remember the last few question keys (newest last), without duplicates. */
export function rememberQuestion(recentKeys = [], key) {
    return [...recentKeys.filter(k => k !== key), key].slice(-RECENT_QUESTION_MEMORY);
}

// ─── Lesson theme ────────────────────────────────────────────────────────────
/**
 * Book atlases describe units differently: Primary Path has Big Questions, Close-Up has topics,
 * Yeti lists the unit's words, Bamboo uses story titles and grammar books name grammar points.
 * Turn any of them into slots the question bank can use naturally.
 */
export function lessonThemeFromUnit({ kind = 'coursebook', title = '', theme = '', grammar = '' } = {}) {
    const firstGrammar = cleanCampfireText(String(Array.isArray(grammar) ? grammar[0] || '' : grammar).split(/[;]/)[0], 80);
    const text = cleanCampfireText(theme || title, 120);
    const result = { theme: '', bigQuestion: '', grammar: firstGrammar, extraWords: [] };
    if (kind === 'grammar' || !text) return result;
    if (/\?$/.test(text)) { result.bigQuestion = text; return result; }
    const parts = text.split(/\s*,\s*/);
    if (parts.length >= 3 && parts.every(p => p.split(' ').length <= 3)) { result.extraWords = parts; return result; }
    // A story line or "Lesson 4" title is not a discussable theme.
    if (/[.!]$/.test(text) || /^(lesson|unit|review)\s*\d+$/i.test(text) || text === cleanCampfireText(firstGrammar, 120)) return result;
    result.theme = /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
    return result;
}

// ─── Lesson history ──────────────────────────────────────────────────────────
/**
 * Split a class's book history into what the children practised for this lesson
 * (the homework set before today) and what was set today for next time.
 * @param {{ history?: Array<{date: string}> }} bookPlan
 * @param {string} today  YYYY-MM-DD
 */
export function splitLessonHistory(bookPlan = {}, today = '') {
    const history = (Array.isArray(bookPlan?.history) ? bookPlan.history : []).filter(h => h && /^\d{4}-\d{2}-\d{2}$/.test(h.date || ''));
    const newestFirst = [...history].reverse();
    return {
        practised: newestFirst.find(h => h.date < today) || null,
        upcoming: newestFirst.find(h => h.date === today) || null
    };
}

/**
 * The closing "tomorrow" line. It speaks like a storyteller: never book codes, units or pages.
 * nextBigQuestion / nextTheme describe the next lesson (from today's assignment or the next unit);
 * sameUnit means the class simply continues the current topic.
 */
export function buildTomorrowSpark({ band = 'mid', nextTheme = '', nextBigQuestion = '', nextGrammar = '', sameUnit = false, seed = '' } = {}) {
    const theme = cleanCampfireText(nextTheme, 90).replace(/[.!]+$/, '');
    const bq = cleanCampfireText(nextBigQuestion, 100);
    const grammar = cleanCampfireText(nextGrammar, 80).replace(/[.!]+$/, '');
    const pick = list => list[hashSeed(seed) % list.length];
    if (band === 'early') {
        if (theme) return 'Next time, more fun with ' + theme + '! 🌟';
        if (grammar) return 'Next time, more fun with our new pattern! 🌟';
        if (bq) return 'Next time, more fun with our story! 🌟';
        return pick(['Bring your kind hands and curious eyes. 🌟', 'Next time, a new little adventure! ✨']);
    }
    if (sameUnit && (theme || bq)) return bq ? 'Next time, we keep exploring: “' + bq + '”' : 'Next time, our adventure with ' + theme + ' continues.';
    if (sameUnit && grammar) return 'Next time, we keep practising ' + grammar + '.';
    if (bq) return 'Our next big question: “' + bq + '” What do you already know?';
    if (theme) return 'Next time, a new adventure begins: ' + theme + '.';
    if (grammar) return 'Next time, we meet a new pattern: ' + grammar + '.';
    return pick(['Bring one question you would like to explore.', 'Bring a new word you hear this week.', 'Notice one English word outside class and bring it back to the fire.']);
}

// ─── Words ─────────────────────────────────────────────────────────────────────
const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'at', 'is', 'are', 'it', 'this', 'that', 'page', 'unit', 'lesson', 'exercise', 'ex', 'homework', 'read', 'write', 'learn', 'study', 'do']);
/**
 * Choose the few words that go into the fire, in priority order (homework / photocopy words, then
 * the recognised text, the unit wordlist, the unit's word list theme, today's activities). Keeps
 * real vocabulary only: short, no numbers, no instructions, no duplicates. Little ones get fewer, shorter words.
 */
export function curateCampfireWords(sources = [], band = 'mid') {
    const max = band === 'early' ? 4 : band === 'junior' ? 5 : 6;
    const seen = new Set(), out = [];
    for (const list of sources) for (const raw of (Array.isArray(list) ? list : [])) {
        const word = cleanCampfireText(String(raw ?? ''), 40).replace(/^[\s"'“”‘’(]+|[\s"'“”‘’).,;:!?]+$/g, '');
        const key = word.toLowerCase();
        const parts = word.split(/\s+/);
        if (!word || word.length < 2 || word.length > 28 || /\d/.test(word) || STOP_WORDS.has(key) || seen.has(key)) continue;
        if (parts.length > (band === 'early' || band === 'junior' ? 2 : 3)) continue;
        seen.add(key); out.push(word);
        if (out.length >= max) return out;
    }
    return out;
}
/** Clear classroom antonyms only. Word-ember "Opposite?" is never guessed by AI. */
const OPPOSITE_PAIRS = [
    ['hot', 'cold'], ['big', 'small'], ['happy', 'sad'], ['old', 'new'], ['old', 'young'], ['fast', 'slow'], ['open', 'close'], ['open', 'closed'],
    ['in', 'out'], ['up', 'down'], ['left', 'right'], ['day', 'night'], ['light', 'dark'], ['long', 'short'], ['high', 'low'], ['near', 'far'],
    ['full', 'empty'], ['clean', 'dirty'], ['early', 'late'], ['easy', 'hard'], ['easy', 'difficult'], ['loud', 'quiet'], ['hard', 'soft'],
    ['wet', 'dry'], ['same', 'different'], ['first', 'last'], ['more', 'less'], ['always', 'never'], ['yes', 'no'], ['true', 'false'],
    ['right', 'wrong'], ['strong', 'weak'], ['rich', 'poor'], ['win', 'lose'], ['come', 'go'], ['give', 'take'], ['ask', 'answer'],
    ['buy', 'sell'], ['start', 'finish'], ['begin', 'end'], ['remember', 'forget'], ['arrive', 'leave'], ['appear', 'disappear'],
    ['love', 'hate'], ['friend', 'enemy'], ['before', 'after'], ['yesterday', 'tomorrow'], ['morning', 'evening'], ['summer', 'winter'],
    ['day', 'night'], ['boy', 'girl'], ['man', 'woman'], ['father', 'mother'], ['brother', 'sister'], ['on', 'off'], ['stop', 'go'],
    ['sit', 'stand'], ['push', 'pull'], ['add', 'subtract'], ['plus', 'minus'], ['inside', 'outside'], ['above', 'below'], ['over', 'under'],
    ['front', 'back'], ['top', 'bottom'], ['north', 'south'], ['east', 'west'], ['good', 'bad'], ['kind', 'unkind'], ['polite', 'rude'],
    ['safe', 'dangerous'], ['alive', 'dead'], ['asleep', 'awake'], ['present', 'absent'], ['enter', 'exit'], ['accept', 'refuse'],
    ['empty', 'full'], ['noisy', 'quiet'], ['thick', 'thin'], ['wide', 'narrow'], ['deep', 'shallow'], ['heavy', 'light'], ['sweet', 'sour'],
    ['catch', 'throw'], ['raise', 'lower'], ['increase', 'decrease'], ['success', 'failure'], ['public', 'private']
];
const OPPOSITES = (() => {
    const map = new Map();
    for (const [a, b] of OPPOSITE_PAIRS) { if (!map.has(a)) map.set(a, b); if (!map.has(b)) map.set(b, a); }
    return map;
})();
export function oppositeOf(word) {
    return OPPOSITES.get(cleanCampfireText(String(word || ''), 40).toLowerCase()) || '';
}
const WORD_TASKS = {
    early: [['🗣️', 'Say it'], ['🙌', 'Show it']],
    junior: [['🗣️', 'Say it'], ['🎭', 'Act it'], ['💬', 'Sentence']],
    other: [['💬', 'Sentence'], ['🗣️', 'Explain it'], ['🎭', 'Act it']]
};
/** Tiny projector task for a word ember. "Opposite?" only when the word is in the classroom antonym list. */
export function campfireWordHint(word, band = 'mid', index = 0) {
    if (band !== 'early' && oppositeOf(word)) return ['🔁', 'Opposite?'];
    const tasks = WORD_TASKS[band] || WORD_TASKS.other;
    return tasks[Math.abs(Number(index) || 0) % tasks.length];
}
/** Elite may reorder or trim the words, but only from the verified list: AI never adds a word. */
export function keepOnlyKnownWords(candidate, known) {
    const allowed = new Map(known.map(w => [w.toLowerCase(), w]));
    const chosen = (Array.isArray(candidate) ? candidate : []).map(w => allowed.get(String(w ?? '').trim().toLowerCase())).filter(Boolean);
    return chosen.length >= Math.min(3, known.length) ? [...new Set(chosen)] : known;
}

/** Ideas, grammar, time and feelings are not picture-book things. Nouns from the atlas (pos n) may be. */
const NON_DEPICTABLE = new Set([
    'always', 'never', 'often', 'sometimes', 'usually', 'already', 'still', 'just', 'also', 'very', 'too', 'much', 'many',
    'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
    'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred',
    'o\'clock', 'half past', 'quarter past', 'quarter to', 'today', 'tomorrow', 'yesterday', 'morning', 'evening', 'night',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
    'discover', 'together', 'content', 'question', 'oracy', 'presentation', 'in common', 'ground rules', 'magic', 'famous',
    'extinct', 'handsome', 'curious', 'kindness', 'courage', 'idea', 'ideas', 'pattern', 'review',
    'happy', 'sad', 'hungry', 'thirsty', 'young', 'old', 'fast', 'slow', 'strong', 'weak', 'good', 'bad', 'kind', 'unkind',
    'hot', 'cold', 'warm', 'cool', 'big', 'small', 'long', 'short', 'new', 'early', 'late', 'easy', 'hard', 'loud', 'quiet',
    'cry', 'laugh', 'sit', 'sleep', 'drive', 'wear', 'win', 'dance', 'sing', 'sew', 'skate', 'skip', 'shout', 'talk',
    'touch', 'listen', 'run', 'catch', 'find', 'give', 'hear', 'live', 'love', 'see', 'eat', 'drink', 'grow up', 'wake up',
    'be quiet', 'dress up', 'put on', 'text', 'write', 'read', 'draw', 'sail', 'watch', 'play', 'go', 'come', 'make',
    'get up', 'get dressed', 'do homework', 'make the bed', 'brush my teeth', 'wash my face', 'go home', 'go to school',
    'have breakfast', 'have lunch', 'take a photo', 'go fishing', 'go snowboarding', 'play chess', 'play table tennis',
    'sing a song', 'catch a fish', 'be', 'have', 'got', 'am', 'is', 'are', 'do', 'does', 'did', 'will', 'can', 'must'
]);
export function exampleContainsWord(example, word) {
    const w = cleanCampfireText(word, 40);
    if (!w) return false;
    return new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(cleanCampfireText(example, 160));
}
/** A picture only when the word is a thing a child can see. Atlas nouns win; adjectives/verbs/ideas never do. */
export function isDepictableCampfireWord(word, pos = '') {
    const w = cleanCampfireText(word, 40).toLowerCase();
    if (!w || w.length < 3 || w.split(/\s+/).length > 2 || NON_DEPICTABLE.has(w) || /\d/.test(w)) return false;
    const kind = String(pos || '').toLowerCase();
    if (kind.startsWith('n')) return true;
    if (kind && !kind.startsWith('n')) return false;
    return true;
}
/**
 * Grounded Word Ember extras: textbook example sentences first, pictures only for concrete nouns.
 * AI may polish an example later, but it may never invent a new word to illustrate.
 */
export function buildWordEmbellishments(words = [], atlasWords = []) {
    const meta = new Map();
    for (const item of atlasWords || []) {
        const key = cleanCampfireText(item?.w || item?.word || '', 40).toLowerCase();
        if (key && !meta.has(key)) meta.set(key, item);
    }
    return (words || []).map(word => {
        const item = meta.get(String(word).toLowerCase()) || {};
        const example = cleanCampfireText(item.example || '', 120);
        const pos = String(item.pos || '');
        return {
            word,
            example: example && exampleContainsWord(example, word) ? example : '',
            depict: isDepictableCampfireWord(word, pos)
        };
    }).filter(e => e.example || e.depict);
}
/** Merge Elite examples onto atlas-grounded extras. Unknown words are dropped; atlas examples are kept. */
export function mergeWordEmbellishments(base = [], candidate = [], known = []) {
    const allowed = new Map((known || []).map(w => [String(w).toLowerCase(), w]));
    const fromAi = new Map();
    for (const item of candidate || []) {
        const word = allowed.get(cleanCampfireText(item?.word, 40).toLowerCase());
        if (!word) continue;
        const example = cleanCampfireText(item.example, 120);
        if (example && exampleContainsWord(example, word)) fromAi.set(word.toLowerCase(), example);
    }
    const byWord = new Map((base || []).map(e => [String(e.word).toLowerCase(), { word: e.word, example: e.example || '', depict: !!e.depict }]));
    for (const word of known) {
        const key = String(word).toLowerCase();
        const cur = byWord.get(key) || { word, example: '', depict: isDepictableCampfireWord(word) };
        if (!cur.example && fromAi.has(key)) cur.example = fromAi.get(key);
        if (!Object.prototype.hasOwnProperty.call(cur, 'depict')) cur.depict = isDepictableCampfireWord(word);
        byWord.set(key, cur);
    }
    return [...byWord.values()].filter(e => e.example || e.depict);
}

// ─── Kindling ────────────────────────────────────────────────────────────────
export function campfireSessionId(classId, date) {
    if (!classId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('A class and lesson date are required.');
    return classId + '_' + date;
}
export function shouldKindleCampfire({ visible = true, enabled = true, existing = false, remainingMinutes, elapsedMinutes, lessonMinutes, stars = 0 } = {}) {
    return visible && enabled && !existing && Number.isFinite(remainingMinutes) && remainingMinutes >= 0 &&
        (remainingMinutes <= 15 || (elapsedMinutes >= lessonMinutes / 2 && stars > 0));
}

/**
 * The complete offline script. AI (Elite) may only polish its wording afterwards.
 */
export function buildCampfireScript({ league, date = '', learnedToday = {}, words = [], lessonTarget = null, presentIds = [], rotation = {}, priorityIds = [],
    recentQuestionKeys = [], next = {}, random, continuity = 'unknown', preferGrammar = false, atlasWords = [] } = {}) {
    const band = getLeagueBand(league);
    const allWords = curateCampfireWords([words, learnedToday.words], band);
    const sources = [...new Set((learnedToday.items || []).map(item => item.source))];
    const picked = pickReflectionQuestion({
        band, theme: lessonTarget?.theme || '', bigQuestion: lessonTarget?.bigQuestion || '', grammar: lessonTarget?.grammar || '', words: allWords,
        sources, recentKeys: recentQuestionKeys, seed: date + '|' + (lessonTarget?.summary || ''),
        continuity, preferGrammar
    });
    const circle = pickFairRotation({ presentIds, cycleIds: rotation?.cycleIds, lastIds: rotation?.lastIds, priorityIds, count: 4, random });
    const pattern = preferGrammar && lessonTarget?.grammar && !allWords.length
        ? { label: cleanCampfireText(lessonTarget.grammar, 60), example: '' } : undefined;
    return {
        question: picked.question, followUp: picked.followUp, starters: picked.starters.slice(0, 3),
        words: allWords,
        embellishments: buildWordEmbellishments(allWords, atlasWords),
        pattern,
        circle: band === 'early' ? [] : circle.selectedIds,
        rotation: circle, readyOathIds: [], lessonTarget,
        fireTale: 'Every small effort leaves a little light. Tonight, we gather ours.',
        closingLine: 'Our fire rests. What we learned stays with us.',
        tomorrowSpark: buildTomorrowSpark({ band, ...next, seed: date }),
        classPromise: 'We listen, we help, and we try together.'
    };
}
export function sanitizeCampfireScript(candidate, fallback) {
    const result = { ...fallback };
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return result;
    for (const key of ['question', 'followUp', 'fireTale', 'closingLine', 'tomorrowSpark']) {
        const value = cleanCampfireText(candidate[key]);
        if (value.length >= 5) result[key] = value;
    }
    // AI may only choose among the verified words (never invent one).
    if (Array.isArray(candidate.words)) result.words = keepOnlyKnownWords(candidate.words, fallback.words || []);
    const starters = Array.isArray(candidate.starters) ? candidate.starters.map(s => cleanCampfireText(s, 100)).filter(Boolean).slice(0, 3) : [];
    if (starters.length) result.starters = starters;
    result.embellishments = mergeWordEmbellishments(fallback.embellishments || [], candidate.embellishments, result.words);
    const grammarExample = cleanCampfireText(candidate.grammarExample, 140);
    if (grammarExample && fallback.lessonTarget?.grammar) {
        result.pattern = { ...(fallback.pattern || { label: cleanCampfireText(fallback.lessonTarget.grammar, 60) }), example: grammarExample };
    }
    return result;
}
export function mergeSessionProgress(current, patch) {
    const statuses = ['kindled', 'lit', 'skipped', 'completed'];
    const status = statuses.indexOf(patch.status) > statuses.indexOf(current.status) ? patch.status : current.status;
    return { ...current, ...patch, status,
        checkedInIds: [...new Set([...(current.checkedInIds || []), ...(patch.checkedInIds || [])])],
        keptOathIds: [...new Set([...(current.keptOathIds || []), ...(patch.keptOathIds || [])])]
    };
}

/** Firestore rejects `undefined`; drop it recursively (arrays keep their order). */
export function stripUndefined(value) {
    if (Array.isArray(value)) return value.filter(v => v !== undefined).map(stripUndefined);
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, stripUndefined(v)]));
    }
    return value;
}

/** Stars lit today, capped for the kindling animation. */
export function kindlingSparkCount(totalStars) {
    const n = Math.round(Number(totalStars) || 0);
    return Math.max(6, Math.min(30, n));
}
