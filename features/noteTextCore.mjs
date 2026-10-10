// features/noteTextCore.mjs
// The text engine under the Chronicle note reader: how a teacher's sentence is turned into
// something the pedagogical lexicon (features/noteLexicon.mjs) can be matched against, in
// Greek, English, Greeklish or a mix of them, typed fast, in capitals or without accents.
//
//   views        every clause is read twice: an English view (accent-folded, lower case) and a
//                Greek "sound" view (Greek letters folded by how they sound, so ζωηρός, ζωιρος
//                and ζοηρος are one word; Greeklish words turned into Greek letters first)
//   clauses      "Πολύ ζωηρός αλλά ευγενικός": the "but" starts a new clause, so a worry and a
//                strength in one sentence are read apart
//   context      the words just before a match: negation ("δεν είναι αγενής", "not rude"),
//                intensity ("ΠΟΛΥ", "very", "!!"), a pattern ("always", "συνέχεια") or a one-off
//                ("today", "σήμερα"), and hedging ("maybe", "ίσως")
//   names        classmates' names are masked before matching, so a name never reads as a word
//
// Greeklish has no single spelling (Chalamandaris et al., LREC 2006: phonetic "potizo" and
// visual "potizw" habits live side by side), so it is transliterated and then compared by
// sound rather than matched against fixed Latin spellings.
//
// Pure: no DOM, no Firebase. Tested in tests/note-text-core.test.mjs.

import { foldText } from './oathForge.mjs';

/** A word start that also works for Greek letters (\b does not). */
export const WORD_START = '(?<![\\p{L}\\p{N}])';

const GREEK_LETTER = /[Ͱ-Ͽἀ-῿]/u;
const LATIN_WORD = /^[a-z][a-z0-9']*$/;

/** Straight apostrophes and one kind of space, so "doesn’t" reads like "doesn't". */
export function tidyText(text) {
    return String(text || '').replace(/[‘’ʼ´`]/g, '\'').replace(/\r/g, '').replace(/[ \t ]+/g, ' ');
}

/** Small stable hash: same text, same key, on any computer. */
export function hashText(text) {
    let h = 5381;
    const s = String(text || '');
    for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
}

// ---------------------------------------------------------------- Greek by sound

/**
 * Folds Greek letters by how they sound: ω→ο; η, υ, ει, οι, υι→ι; αι→ε; αυ/ευ→αβ/εβ;
 * doubled letters collapse. Expects folded text (no accents, lower case, σ for ς).
 * Latin letters are left alone, so an English view passes through unchanged.
 */
export function phoneticGreek(folded) {
    // Single letters first, so ζωηρός, ζοηρος, ζωιρος and the Greeklish "zoiros" all land on one key.
    return String(folded || '')
        .replace(/ου/g, 'ȣ')
        .replace(/αυ/g, 'αβ').replace(/ευ/g, 'εβ')
        .replace(/[ηυ]/g, 'ι')
        .replace(/ω/g, 'ο')
        .replace(/ει|οι|ιι/g, 'ι')
        .replace(/αι/g, 'ε')
        .replace(/([α-ωȣ])\1+/g, '$1');
}

// ---------------------------------------------------------------- Greeklish

const GREEKLISH_DIGRAPHS = [
    ['th', 'θ'], ['ch', 'χ'], ['ps', 'ψ'], ['ks', 'ξ'], ['ou', 'ου'], ['mp', 'μπ'], ['nt', 'ντ'],
    ['gk', 'γκ'], ['gg', 'γγ'], ['ts', 'τσ'], ['tz', 'τζ']
];
const GREEKLISH_LETTERS = {
    a: 'α', b: 'μπ', c: 'κ', d: 'δ', e: 'ε', f: 'φ', g: 'γ', h: 'η', i: 'ι', j: 'τζ', k: 'κ', l: 'λ', m: 'μ',
    n: 'ν', o: 'ο', p: 'π', q: 'κ', r: 'ρ', s: 'σ', t: 'τ', u: 'υ', v: 'β', w: 'ω', x: 'χ', y: 'υ', z: 'ζ',
    8: 'θ', 3: 'ξ', 4: 'ψ'
};

/** One Latin word to Greek letters ("zwhros" → "ζωηροσ"). Not a Latin word: unchanged. */
export function greeklishWord(word) {
    const w = String(word || '').toLowerCase();
    if (!/[a-z]/.test(w) || !/^[a-z0-9']+$/.test(w)) return w;
    let out = '';
    for (let i = 0; i < w.length;) {
        const pair = GREEKLISH_DIGRAPHS.find(([lat]) => w.startsWith(lat, i));
        if (pair) { out += pair[1]; i += pair[0].length; continue; }
        const ch = w[i];
        out += ch === '\'' ? '' : (GREEKLISH_LETTERS[ch] || ch);
        i += 1;
    }
    return out;
}

/** Turns every Latin word of a (folded) sentence into Greek letters. */
export function greeklishToGreek(folded) {
    return String(folded || '').replace(/[a-z0-9']+/g, (w) => (/[a-z]/.test(w) ? greeklishWord(w) : w));
}

// Function words that only Greeklish writes in Latin letters, and English words that only English does.
const GREEKLISH_HINTS = new Set(('den de einai einia ine kai ke poly poli polu para sto sth sti stin stn stis stous tou toy tis ths tin thn tous ' +
    'na alla omws omos kanei kanh kani kanoun exei exi ehei exoun pia akoma akomh sinexeia synexeia sinexia synexia giati gt epeidh epeidi ' +
    'oti pou pws pos mporei mpori kala kalh kali kalos kalo ton tn ta oi apo gia mathima mathimata ma8hma paidi paidia ergasia ergasies ' +
    'askhsh askisi askhseis askiseis askiseis ligo ligaki paei pigainei milaei milaei milaei leei kaneis eixe eixan htan itan sxoleio ' +
    'mazi me ton thn tis tous kathe kapoies kamia fora fores shmera simera xthes xtes avrio pali ksana xana').split(/\s+/));
const ENGLISH_STOPS = new Set(('the is was are were be been he she they his her their him them it its this that these those and or but ' +
    'with without for of in on at to from by very really not doesnt dont didnt isnt cant wont has have had does did a an ' +
    'today yesterday lesson class homework always never often sometimes again who what when where why how because so too much many').split(/\s+/));

/**
 * The language a sentence is written in: 'el', 'en', 'greeklish' or 'mixed'.
 * Expects folded text with names already masked.
 */
export function detectLanguage(folded) {
    const text = String(folded || '');
    const greek = GREEK_LETTER.test(text);
    const words = text.split(/[^a-z0-9'Ͱ-Ͽ]+/).filter(Boolean);
    const latin = words.filter((w) => LATIN_WORD.test(w));
    if (!latin.length) return greek ? 'el' : 'en';
    const hints = latin.filter((w) => GREEKLISH_HINTS.has(w)).length;
    const stops = latin.filter((w) => ENGLISH_STOPS.has(w.replace(/'/g, ''))).length;
    const greeklish = (hints >= 2 && hints > stops) || (hints >= 1 && stops === 0 && latin.length <= 4);
    if (greek) return greeklish ? 'greeklish' : 'mixed';
    return greeklish ? 'greeklish' : 'en';
}

// ---------------------------------------------------------------- patterns

/**
 * Compiles lexicon fragments into the two matchers a clause is read with.
 * English fragments are regex sources run on the folded text. Greek fragments are written in
 * plain (accentless) Greek and run on the Greek sound view; "\<" marks a word start in both.
 */
export function compilePatterns(spec) {
    if (!spec) return null;
    const en = (spec.en || []).filter(Boolean);
    const el = (spec.el || []).filter(Boolean);
    const build = (parts, greek) => {
        if (!parts.length) return null;
        let src = parts.map((p) => `(?:${p})`).join('|');
        // Fold the Greek letters only; escapes such as \p{L} keep their case.
        if (greek) src = src.split(/(\\[pP]\{[^}]+\}|\\[A-Z])/).map((part, i) => (i % 2 ? part : phoneticGreek(foldText(part)))).join('');
        return new RegExp(src.replace(/\\</g, WORD_START), 'u');
    };
    const m = { en: build(en, false), el: build(el, true) };
    return m.en || m.el ? m : null;
}

/** First hit of a compiled matcher in a clause's views: { view, index, text } or null. */
export function firstHit(matcher, views) {
    if (!matcher) return null;
    if (matcher.en) {
        const m = matcher.en.exec(views.en);
        if (m) return { view: 'en', index: m.index, text: m[0] };
    }
    if (matcher.el) {
        const m = matcher.el.exec(views.el);
        if (m) return { view: 'el', index: m.index, text: m[0] };
    }
    return null;
}

export const hits = (matcher, views) => !!firstHit(matcher, views);

// ---------------------------------------------------------------- the words around a match

const wordSet = (en, el) => ({
    en: new Set(en.split(/\s*,\s*/).filter(Boolean)),
    el: new Set(el.split(/\s*,\s*/).filter(Boolean).map((w) => phoneticGreek(foldText(w))))
});

export const NEGATORS = wordSet(
    'not, no, never, hardly, cannot, nobody, none, without, dont, doesnt, didnt, isnt, wasnt, arent, cant, wont, hasnt, havent, couldnt, wouldnt, neither, nor',
    'δεν, δε, μην, μη, ούτε, καθόλου, ποτέ, ουδέποτε, χωρίς, όχι'
);
export const INTENSIFIERS = wordSet(
    'very, really, so, too, extremely, incredibly, super, totally, completely, seriously, terribly, awfully, highly, especially, truly',
    'πολύ, πάρα, υπερβολικά, τρομερά, απίστευτα, εντελώς, τελείως, τόσο, ιδιαίτερα, φοβερά, εξαιρετικά, πολλή, πολλά'
);
export const DOWNTONERS = wordSet(
    'bit, slightly, sometimes, occasionally, little, somewhat, fairly, mostly, partly, rarely',
    'λίγο, λιγάκι, κάπως, ελαφρώς, μερικές, καμιά, κάποιες, ενίοτε, σχετικά'
);
// Words that end the look-back window: a new idea starts after them.
const STOPPERS = wordSet(
    'and, or, while, because, since, when, then, also, plus, which, who',
    'και, ή, ενώ, γιατί, επειδή, όταν, μετά, επίσης, που, οπότε, αφού'
);

const FREQUENCY = {
    en: /\b(always|constantly|all the time|every (lesson|time|day|week)|continually|again and again|keeps? (on )?\w+ing|repeatedly|often|usually|most of the time|each lesson)\b/u,
    el: new RegExp(phoneticGreek(foldText('πάντα|συνέχεια|συνεχώς|όλη την ώρα|κάθε (φορά|μάθημα|μέρα|εβδομάδα)|ξανά και ξανά|συχνά|συνήθως|διαρκώς|μονίμως|ασταμάτητα')), 'u')
};
const ONE_OFF = {
    en: /\b(today|yesterday|this (lesson|time|morning|afternoon|week)|tonight|for once|just once|on monday|on tuesday|on wednesday|on thursday|on friday|on saturday)\b/u,
    el: new RegExp(phoneticGreek(foldText('σήμερα|χθες|χτες|αυτή τη φορά|σε αυτό το μάθημα|στο σημερινό|μια φορά|την (Δευτέρα|Τρίτη|Τετάρτη|Πέμπτη|Παρασκευή|Σάββατο)|το Σάββατο')), 'u')
};
const HEDGES = {
    en: /\b(maybe|perhaps|i think|i guess|might|possibly|seems?|probably|not sure)\b/u,
    el: new RegExp(phoneticGreek(foldText('ίσως|μάλλον|νομίζω|πιθανόν|φαίνεται|μου φαίνεται|δεν είμαι σίγουρ')), 'u')
};
const NOW_BETTER = {
    en: /\b(anymore|any more|no longer|not any more|now|these days|finally)\b/u,
    el: new RegExp(phoneticGreek(foldText('πια|πλέον|τώρα|επιτέλους|τελευταία')), 'u')
};

/** Clause-level flags: { pattern: 'trait'|'incident'|'', hedged, now }. */
export function clauseFlags(views) {
    const any = (pair) => pair.en.test(views.en) || pair.el.test(views.el);
    const trait = any(FREQUENCY);
    return {
        pattern: trait ? 'trait' : any(ONE_OFF) ? 'incident' : '',
        hedged: any(HEDGES),
        now: any(NOW_BETTER)
    };
}

/**
 * The few words before a hit, back to the last comma or conjunction.
 * Returns { negated, intensity: -1..2 } for that window.
 */
export function lookBack(views, hit, span = 3) {
    if (!hit) return { negated: false, boost: 0 };
    const text = views[hit.view].slice(0, hit.index);
    const before = text.split(/[,;:()]/).pop();
    const tokens = before.split(/[^\p{L}\p{N}']+/u).filter(Boolean);
    const set = (s) => (hit.view === 'en' ? s.en : s.el);
    const window = [];
    for (let i = tokens.length - 1; i >= 0 && window.length < span; i -= 1) {
        const t = tokens[i].replace(/'/g, '');
        if (set(STOPPERS).has(t)) break;
        window.push(t);
    }
    const negated = window.some((t) => set(NEGATORS).has(t));
    const strong = window.filter((t) => set(INTENSIFIERS).has(t)).length;
    const soft = window.some((t) => set(DOWNTONERS).has(t));
    return { negated, boost: Math.min(2, strong) - (soft ? 1 : 0) };
}

// ---------------------------------------------------------------- sentences, clauses, emphasis

/** Split a note into sentences, keeping the original words for quoting. */
export function sentencesOf(text) {
    return String(text || '')
        .replace(/\r/g, '')
        .split(/(?<=[.!?;·\n])\s+|\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1);
}

const CONTRAST_RX = /\s*(?:,\s*)?\b(?:but|however|although|whereas)\b\s*|\s*(?:,\s*)?(?<![\p{L}])(?:αλλά|αλλα|όμως|ομως|ωστόσο|ωστοσο|αν και|παρόλο που|παρολο που|παρ'? όλα αυτά|μολονότι|ενώ)(?![\p{L}])\s*|\s*(?:,\s*)?(?<![\p{L}])(?:alla|omws|omos|wstoso)(?![\p{L}])\s*/giu;

/** A sentence cut at "but / αλλά / όμως…", so each side is judged on its own. */
export function splitClauses(sentence) {
    return String(sentence || '').split(CONTRAST_RX).map((s) => s.trim()).filter((s) => s.length > 1);
}

const ACRONYMS = new Set(['ADHD', 'ADD', 'SEN', 'KET', 'PET', 'FCE', 'CAE', 'CPE', 'ECCE', 'ECPE', 'IELTS', 'TOEFL', 'ΔΕΠΥ', 'ΚΕΔΑΣΥ', 'ΚΕΠΕΑ', 'ΚΔΑΥ', 'ΕΔΕΑΥ', 'OK', 'TV', 'PE']);

/** Emphasis written into a clause: whole words in CAPITALS, or "!!". */
export function emphasisOf(clause) {
    const raw = String(clause || '');
    const words = raw.split(/[^\p{L}]+/u).filter((w) => w.length >= 3);
    const caps = words.filter((w) => w === w.toUpperCase() && w !== w.toLowerCase() && !ACRONYMS.has(w));
    const allCaps = words.length >= 2 && caps.length === words.length;
    return { shout: caps.length >= 2 || allCaps, bang: /!{2,}|!\s*!/.test(raw) };
}

// ---------------------------------------------------------------- names

/** Matchers for one child's first name, in Latin and in Greek letters ("Thiseas" ~ "Θησέα"). */
export function nameMatchers(name) {
    const first = foldText(String(name || '').trim().split(/\s+/)[0] || '');
    if (first.length < 3) return null;
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Names bend at the end (Νικος / Νικο / Νικου): match the stem.
    const stem = first.length > 4 ? first.slice(0, -1) : first;
    const greekStem = phoneticGreek(GREEK_LETTER.test(stem) ? stem : greeklishWord(stem));
    return {
        en: new RegExp(`(?<!\\p{L})${esc(stem)}\\p{L}{0,2}(?!\\p{L})`, 'gu'),
        el: greekStem.length >= 3 ? new RegExp(`(?<!\\p{L})${esc(greekStem)}\\p{L}{0,2}(?!\\p{L})`, 'gu') : null
    };
}

/** Does a folded text (and its Greek sound view) name this child? */
export function namesChild(matchers, folded, soundView) {
    if (!matchers) return false;
    matchers.en.lastIndex = 0;
    if (matchers.en.test(folded)) return true;
    if (!matchers.el) return false;
    matchers.el.lastIndex = 0;
    return matchers.el.test(soundView);
}

/** Replaces names (any of the given global regexes) with a neutral placeholder. */
export function maskNames(text, regexes) {
    return regexes.filter(Boolean).reduce((out, re) => out.replace(re, ' @ '), text);
}

// ---------------------------------------------------------------- one clause, ready to read

/**
 * The two views of a clause, its language and its emphasis.
 * `masks` are nameMatchers() of the children whose names should not be read as words.
 */
export function readyClause(clause, masks = []) {
    const tidy = tidyText(clause);
    const live = masks.filter(Boolean);
    const en = maskNames(foldText(tidy), live.map((m) => m.en));
    const lang = detectLanguage(en);
    const greekSide = lang === 'greeklish' ? greeklishToGreek(en) : en;
    const el = maskNames(phoneticGreek(greekSide), live.map((m) => m.el));
    return { views: { en, el }, lang, emphasis: emphasisOf(tidy) };
}
