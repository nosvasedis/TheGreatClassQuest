/**
 * Quiz of the Week lesson focus: which book units, grammar, and words the class
 * practised since the last finished quiz. Pure; no DOM or Firestore.
 * Covered by tests/quiz-curriculum-core.test.mjs.
 */
import { cleanCampfireText, lessonThemeFromUnit } from './heroCampfireCore.mjs';

export const QUIZ_WORD_CAP = 16;
export const QUIZ_EXAMPLE_CAP = 4;

/** Questions in a fresh quiz: proportional to class size, 5–15 (7 when the roster is unknown). */
export function expectedQuestionCount(enrolledCount) {
    if (!enrolledCount || enrolledCount <= 0) return 7;
    return Math.min(15, Math.max(5, Math.ceil(enrolledCount * 0.75)));
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'at', 'is', 'are', 'it', 'this', 'that', 'page', 'unit', 'lesson', 'exercise', 'ex', 'homework', 'read', 'write', 'learn', 'study', 'do']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_WEEK = /^(\d{4})-W(\d{2})$/;

function formatLocal(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseIsoDate(isoDate) {
    const match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function addDays(isoDate, days) {
    const date = parseIsoDate(isoDate);
    if (!date) return '';
    date.setDate(date.getDate() + Number(days || 0));
    return formatLocal(date);
}

/** ISO week key matching features/guildScoring.js#getISOWeekKey. */
export function isoWeekKey(isoDate) {
    const date = parseIsoDate(isoDate);
    if (!date) return '';
    const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
    return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function mondayFromIsoWeekKey(weekKey) {
    const match = String(weekKey || '').match(ISO_WEEK);
    if (!match) return '';
    const year = Number(match[1]);
    const week = Number(match[2]);
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7;
    return formatLocal(new Date(year, 0, 4 - (jan4Day - 1) + (week - 1) * 7));
}

/**
 * Monday of the quiz's target ISO week. Mon–Fri → this week's Monday;
 * Sat–Sun → next week's Monday (weekend prep for the coming first lesson).
 */
export function targetWeekMonday(isoDate) {
    const date = parseIsoDate(isoDate);
    if (!date) return '';
    const day = date.getDay();
    if (day === 0) date.setDate(date.getDate() + 1);
    else if (day === 6) date.setDate(date.getDate() + 2);
    else date.setDate(date.getDate() - (day - 1));
    return formatLocal(date);
}

export function completedQuizDate(quiz) {
    if (!quiz) return '';
    const ts = quiz.completedAt;
    if (ts && typeof ts.toMillis === 'function') return formatLocal(new Date(ts.toMillis()));
    if (ts && typeof ts.seconds === 'number') return formatLocal(new Date(ts.seconds * 1000));
    if (typeof ts === 'string' && ISO_DATE.test(ts.slice(0, 10))) return ts.slice(0, 10);
    if (quiz.weekKey) return mondayFromIsoWeekKey(quiz.weekKey);
    return '';
}

/**
 * History entries practised since the last completed quiz, up to (not including)
 * the target week's Monday. With no previous quiz, only the previous ISO week.
 */
export function quizReviewWindow(history = [], { lastCompletedDate = '', targetWeekMonday: to = '', lastWeekKey = '' } = {}) {
    const from = lastCompletedDate || (to ? addDays(to, -7) : '');
    if (!from || !to) {
        return { entries: [], from: from || '', to: to || '', sinceWeekKey: lastWeekKey || '', lessonCount: 0 };
    }
    const entries = (Array.isArray(history) ? history : []).filter((entry) => (
        entry && ISO_DATE.test(entry.date || '') && entry.date >= from && entry.date < to
    ));
    const lessonCount = new Set(entries.map((entry) => entry.date)).size;
    return {
        entries,
        from,
        to,
        sinceWeekKey: lastWeekKey || (lastCompletedDate ? isoWeekKey(lastCompletedDate) : isoWeekKey(from)),
        lessonCount
    };
}

function cleanWord(raw) {
    const word = cleanCampfireText(String(raw ?? ''), 40).replace(/^[\s"'“”‘’(]+|[\s"'“”‘’).,;:!?]+$/g, '');
    const key = word.toLowerCase();
    const parts = word.split(/\s+/);
    if (!word || word.length < 2 || word.length > 28 || /\d/.test(word) || STOP_WORDS.has(key)) return '';
    if (parts.length > 3) return '';
    return word;
}

export function curateQuizWords(sources = [], cap = QUIZ_WORD_CAP) {
    const seen = new Set();
    const out = [];
    for (const list of sources) {
        for (const raw of (Array.isArray(list) ? list : [])) {
            const word = cleanWord(raw);
            if (!word) continue;
            const key = word.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(word);
            if (out.length >= cap) return out;
        }
    }
    return out;
}

export function suggestQuizType({ bookKinds = [], grammarPoints = [], words = [] } = {}) {
    const kinds = (Array.isArray(bookKinds) ? bookKinds : []).filter(Boolean);
    if (kinds.length && kinds.every((kind) => kind === 'grammar')) return 'grammar';
    const grammar = (Array.isArray(grammarPoints) ? grammarPoints : []).filter(Boolean);
    const vocab = (Array.isArray(words) ? words : []).filter(Boolean);
    if (!grammar.length && vocab.length) return 'vocabulary';
    if (grammar.length && !vocab.length) return 'grammar';
    return 'mix';
}

function pickExamples(atlasWords = [], selectedWords = [], limit = QUIZ_EXAMPLE_CAP) {
    const selected = new Set(selectedWords.map((word) => String(word).toLowerCase()));
    const out = [];
    const seen = new Set();
    for (const item of (Array.isArray(atlasWords) ? atlasWords : [])) {
        const word = cleanWord(item?.w || item?.word || '');
        const example = cleanCampfireText(item?.example || '', 120);
        if (!word || !example || !selected.has(word.toLowerCase()) || seen.has(word.toLowerCase())) continue;
        if (!new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(example)) continue;
        seen.add(word.toLowerCase());
        out.push({ word, example });
        if (out.length >= limit) break;
    }
    return out;
}

export function unitDisplayLine(unit = {}) {
    const title = unit.bigQuestion || unit.theme || unit.title || '';
    return [unit.bookTitle, unit.unit != null ? `Unit ${unit.unit}` : '', title].filter(Boolean).join(' · ');
}

export function lessonFocusSummary(focus = {}) {
    const n = Number(focus.window?.lessonCount) || 0;
    const week = String(focus.window?.sinceWeekKey || '');
    const weekLabel = week.replace(/^\d{4}-W/, 'Week ');
    if (week && n) return `Since last quiz (${weekLabel}): ${n} lesson${n === 1 ? '' : 's'}`;
    if (week && !n) return `Since last quiz (${weekLabel}): no new lessons yet`;
    if (n) return `${n} lesson${n === 1 ? '' : 's'} from last week`;
    return '';
}

function uniqueStrings(list) {
    const seen = new Set();
    const out = [];
    for (const raw of list) {
        const text = cleanCampfireText(raw, 120);
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
    }
    return out;
}

/**
 * Build the one-tap card model. `units` is atlas metadata for confirmed books;
 * `atlasWords` is the lazy wordlist ({ w, example, page }). Unconfirmed history
 * contributes homework words only — never a guessed book.
 */
export function buildQuizLessonFocus({
    entries = [],
    units = [],
    atlasWords = [],
    window: windowMeta = null
} = {}) {
    const list = Array.isArray(entries) ? entries : [];
    const unitLookup = Array.isArray(units) ? units : [];
    const homeworkWords = list.flatMap((entry) => Array.isArray(entry?.words) ? entry.words : []);
    const unitMap = new Map();
    for (const entry of list) {
        if (!entry || entry.unconfirmed || !entry.bookId || entry.unit == null) continue;
        const key = `${entry.bookId}:${Number(entry.unit)}`;
        if (unitMap.has(key)) continue;
        const meta = unitLookup.find((unit) => unit.bookId === entry.bookId && Number(unit.unit) === Number(entry.unit)) || {};
        const shaped = lessonThemeFromUnit({
            kind: meta.kind || 'coursebook',
            title: meta.title || '',
            theme: meta.theme || '',
            grammar: meta.grammar || ''
        });
        unitMap.set(key, {
            bookId: entry.bookId,
            unit: Number(entry.unit),
            title: meta.title || '',
            theme: shaped.theme,
            grammar: shaped.grammar,
            bigQuestion: shaped.bigQuestion,
            bookTitle: meta.bookTitle || '',
            kind: meta.kind || 'coursebook',
            extraWords: shaped.extraWords
        });
    }
    const unitList = [...unitMap.values()];
    const extraWords = unitList.flatMap((unit) => unit.extraWords || []);
    const atlasList = (Array.isArray(atlasWords) ? atlasWords : []).map((item) => item?.w || item?.word || item);
    const words = curateQuizWords([homeworkWords, extraWords, atlasList], QUIZ_WORD_CAP);
    const grammarPoints = uniqueStrings(unitList.map((unit) => unit.grammar));
    const bookKinds = [...new Set(unitList.map((unit) => unit.kind).filter(Boolean))];
    const type = suggestQuizType({ bookKinds, grammarPoints, words });
    const categories = uniqueStrings([
        ...unitList.map((unit) => unit.bigQuestion || unit.theme || unit.title),
        ...grammarPoints
    ]).slice(0, 8);
    const examples = pickExamples(atlasWords, words, QUIZ_EXAMPLE_CAP);
    const usable = words.length > 0 || grammarPoints.length > 0;
    const focus = {
        source: usable ? 'book-atlas' : 'manual',
        window: {
            from: windowMeta?.from || '',
            to: windowMeta?.to || '',
            sinceWeekKey: windowMeta?.sinceWeekKey || '',
            lessonCount: windowMeta?.lessonCount ?? new Set(list.map((entry) => entry?.date).filter(Boolean)).size
        },
        units: unitList.map(({ extraWords: _extra, ...unit }) => unit),
        words,
        grammarPoints,
        examples,
        type,
        categories,
        keywords: words.join(', '),
        note: ''
    };
    return focus;
}

export function hasUsableLessonFocus(focus) {
    return Boolean(focus && ((Array.isArray(focus.words) && focus.words.length) || (Array.isArray(focus.grammarPoints) && focus.grammarPoints.length)));
}

export function applyWordSelection(focus, selectedWords = null) {
    if (!focus) return [];
    const allowed = new Map((focus.words || []).map((word) => [String(word).toLowerCase(), word]));
    if (!Array.isArray(selectedWords)) return [...allowed.values()];
    const picked = [];
    const seen = new Set();
    for (const raw of selectedWords) {
        const word = allowed.get(String(raw || '').toLowerCase());
        if (!word || seen.has(word.toLowerCase())) continue;
        seen.add(word.toLowerCase());
        picked.push(word);
    }
    return picked;
}

export function sanitizeLessonFocus(raw = {}) {
    const words = curateQuizWords([Array.isArray(raw.words) ? raw.words : []], QUIZ_WORD_CAP);
    const units = (Array.isArray(raw.units) ? raw.units : []).slice(0, 6).map((unit) => ({
        bookId: cleanCampfireText(unit?.bookId, 80),
        unit: Number(unit?.unit) || null,
        title: cleanCampfireText(unit?.title, 120),
        theme: cleanCampfireText(unit?.theme, 120),
        grammar: cleanCampfireText(unit?.grammar, 120),
        bigQuestion: cleanCampfireText(unit?.bigQuestion, 120),
        bookTitle: cleanCampfireText(unit?.bookTitle, 80),
        kind: cleanCampfireText(unit?.kind, 40)
    })).filter((unit) => unit.bookId);
    const grammarPoints = uniqueStrings(raw.grammarPoints || []).slice(0, 6);
    const examples = (Array.isArray(raw.examples) ? raw.examples : []).slice(0, QUIZ_EXAMPLE_CAP)
        .map((item) => ({
            word: cleanCampfireText(item?.word, 40),
            example: cleanCampfireText(item?.example, 120)
        }))
        .filter((item) => item.word && item.example && words.some((word) => word.toLowerCase() === item.word.toLowerCase()));
    const windowMeta = raw.window && typeof raw.window === 'object' ? {
        from: ISO_DATE.test(raw.window.from || '') ? raw.window.from : '',
        to: ISO_DATE.test(raw.window.to || '') ? raw.window.to : '',
        sinceWeekKey: String(raw.window.sinceWeekKey || '').slice(0, 12),
        lessonCount: Number(raw.window.lessonCount) || 0
    } : { from: '', to: '', sinceWeekKey: '', lessonCount: 0 };
    const source = raw.source === 'manual' ? 'manual' : 'book-atlas';
    const note = cleanCampfireText(raw.note, 240);
    const payload = {
        source,
        window: windowMeta,
        units,
        words,
        grammarPoints,
        examples,
        type: ['grammar', 'vocabulary', 'mix'].includes(raw.type) ? raw.type : suggestQuizType({
            bookKinds: units.map((unit) => unit.kind),
            grammarPoints,
            words
        }),
        categories: uniqueStrings(raw.categories || []).slice(0, 8),
        keywords: words.join(', '),
        note
    };
    return payload;
}

export function curriculumFromFocus(focus, {
    type,
    note = '',
    selectedWords = null,
    categories = [],
    manualOverride = false
} = {}) {
    const words = applyWordSelection(focus, selectedWords);
    const chosenType = ['grammar', 'vocabulary', 'mix'].includes(type) ? type : (focus?.type || 'mix');
    const trimmedNote = cleanCampfireText(note, 240);
    if (manualOverride) {
        return {
            type: chosenType,
            categories: uniqueStrings(categories).slice(0, 12),
            keywords: trimmedNote,
            lessonFocus: sanitizeLessonFocus({ ...focus, source: 'manual', words, note: trimmedNote, type: chosenType })
        };
    }
    const next = sanitizeLessonFocus({
        ...focus,
        source: 'book-atlas',
        words,
        note: trimmedNote,
        type: chosenType,
        categories: (focus?.categories || []).slice(0, 8)
    });
    return {
        type: chosenType,
        categories: next.categories,
        keywords: [next.words.join(', '), trimmedNote].filter(Boolean).join('; '),
        lessonFocus: next
    };
}

export function canGenerateQuiz({
    focus = null,
    selectedWords = null,
    categories = [],
    keywords = '',
    carryCount = 0,
    manualOverride = false
} = {}) {
    if (Number(carryCount) > 0) return true;
    const note = cleanCampfireText(keywords, 240);
    if (manualOverride) return uniqueStrings(categories).length > 0 || Boolean(note);
    const words = applyWordSelection(focus, selectedWords);
    const grammar = Array.isArray(focus?.grammarPoints) ? focus.grammarPoints.filter(Boolean) : [];
    return words.length > 0 || grammar.length > 0 || Boolean(note);
}

export function formatQuizFocusForPrompt(focus = {}) {
    const words = Array.isArray(focus.words) ? focus.words.filter(Boolean) : [];
    const grammar = Array.isArray(focus.grammarPoints) ? focus.grammarPoints.filter(Boolean) : [];
    const themes = uniqueStrings((Array.isArray(focus.units) ? focus.units : [])
        .map((unit) => unit.bigQuestion || unit.theme || unit.title));
    const examples = (Array.isArray(focus.examples) ? focus.examples : []).slice(0, QUIZ_EXAMPLE_CAP);
    const note = cleanCampfireText(focus.note, 240);
    const lines = [];
    if (themes.length) lines.push(`Lesson theme: ${themes.join('; ')}.`);
    if (grammar.length) lines.push(`Grammar: ${grammar.join('; ')}.`);
    if (words.length) lines.push(`Words the class practised (USE THESE, do not add others): ${words.join(', ')}.`);
    if (examples.length) {
        lines.push(`Classroom examples: ${examples.map((item) => `${item.word}: ${item.example}`).join(' / ')}.`);
    }
    if (note) lines.push(`Teacher note: ${note}.`);
    return lines.join('\n');
}

export function buildQuizGenerationUserPrompt({ curriculum = {}, ageDesc = 'primary learners', questionCount = 7 } = {}) {
    const type = curriculum.type === 'grammar' ? 'English Grammar'
        : curriculum.type === 'vocabulary' ? 'English Vocabulary'
            : 'English (Grammar and Vocabulary mix)';
    const focus = curriculum.lessonFocus;
    const grounded = focus && focus.source === 'book-atlas' && (hasUsableLessonFocus(focus) || focus.note);
    const focusBlock = grounded
        ? formatQuizFocusForPrompt({ ...focus, note: focus.note || '' })
        : [
            (curriculum.categories || []).length ? `Topics: ${(curriculum.categories || []).join(', ')}.` : '',
            curriculum.keywords ? `Specific focus: "${curriculum.keywords}".` : ''
        ].filter(Boolean).join('\n');
    const groundingRules = grounded
        ? `- Vocabulary questions must test only the listed words. Never invent a vocabulary item that is not in that list.
- Grammar questions must test the listed grammar. Use the listed words in stems and options when you can.
- Do not invent unrelated topics.`
        : `- Make every question directly relevant to the topics/focus listed above.`;

    return `Create a weekly English quiz for ${ageDesc}.
Subject: ${type}.
${focusBlock}

Rules:
- Generate exactly ${questionCount} questions (no more, no less).
- Use only this question type: "mcq" (4-option multiple choice).
${groundingRules}
- Keep language appropriate for ${ageDesc}.
- Keep explanations very short (max 10 words each).
- Do NOT produce any text outside the JSON object.

Output this exact JSON shape (nothing else):
{"questions":[{"type":"mcq","question":"...","options":["A","B","C","D"],"correctIndex":0,"correctAnswer":"A","explanation":"short reason"},{"type":"mcq","question":"Which word means happy?","options":["Sad","Joyful","Angry","Tired"],"correctIndex":1,"correctAnswer":"Joyful","explanation":"synonym for happy"},{"type":"mcq","question":"Choose the correct sentence.","options":["He are reading.","He is reading.","He reading.","He am reading."],"correctIndex":1,"correctAnswer":"He is reading.","explanation":"subject and verb agree"}]}`;
}
