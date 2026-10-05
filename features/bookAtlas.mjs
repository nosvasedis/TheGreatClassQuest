/** Deterministic lesson recognition. Never infer textbook page content with AI. */
import { BOOK_ATLAS } from './bookAtlas.data.mjs';
import { splitKeywords, looksLikeVocabulary } from '../utils/vocabularyText.mjs';
export { BOOK_ATLAS };
const HOMOGLYPHS = { α: 'a', β: 'b', ε: 'e', ο: 'o', ι: 'i', κ: 'k', μ: 'm', ν: 'n', ρ: 'p', τ: 't', υ: 'y', χ: 'x', ζ: 'z', η: 'h' };
const escapeRe = s => s.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
export function normalizeBookText(text) {
    return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[αβεοικμνρτυχζη]/g, c => HOMOGLYPHS[c])
        .replace(/[’'\u0060]/g, '').replace(/\./g, '').replace(/[–—~]/g, '-')
        .replace(/([a-z])-(?=[a-z])/g, '$1 ').replace(/\b(b1)\s*\+/g, '$1+')
        .replace(/\s+/g, ' ').trim();
}
const COMPONENTS = {
    sb: ["student's book", "students' book", 'student book', 'st book', 'sts book', "st's book", 'sb', 's b', 'sbk', 'student', 'students',
        "pupil's book", "pupils' book", 'pupil book', 'pupil', 'pupils', 'pb', 'p b', 'pbk', 'coursebook', 'course book', 'course bk', 'class book', 'main book', 'main coursebook', 'βιβλιο μαθητη', 'κυριως βιβλιο', 'book', 'bk', 'βιβλιο'],
    wb: ['workbook', 'work book', 'workbk', 'wkbk', 'wb', 'w b', 'activity book', 'act book', 'activ book', 'activity', 'ab', 'a b', 'exercises book', 'exercise book', 'practice book', 'prac book', 'ασκησεις', 'ασκησεων', 'βιβλιο ασκησεων', 'τετραδιο εργασιων'],
    companion: ['companion', 'companion book', 'companions', 'comp', 'learning companion', 'lc', 'l c', 'language booster', 'lang booster', 'l booster', 'lang booster book', 'language boost', 'lang boost', 'booster', 'boost', 'language b', 'lang b', 'language bk', 'lb', 'l b', 'language', 'lang', 'comp & grammar', 'companion and grammar', 'λεξιλογιο', 'βοηθημα', 'συνοδευτικο', 'συνοδευτικο βιβλιο'],
    grammar: ['grammar', 'grammar book', 'grammar bk', 'gram book', 'gram b', 'gramm book', 'grammar b', 'gr book', 'gr b', 'gb', 'g b', 'grb', 'γραμματικη', 'γραμματικη book'],
    test: ['test', 'tests', 'test book', 'test bk', 'tests book', 't book', 'tb', 't b', 'quiz book', 'test booklet', 'booklet', 'τεστ'],
    reader: ['reader', 'readers', 'reader book', 'story book', 'story bk', 'story', 'stories', 'αναγνωσμα', 'λογοτεχνια'],
    'picture dictionary': ['picture dictionary', 'pic dictionary', 'pd', 'λεξικο εικονων'],
    'alphabet/starter': ['alphabet book', 'starter book', 'alphabet & starter', 'starter']
};
const componentIndex = Object.entries(COMPONENTS).flatMap(([component, aliases]) => aliases.map(raw => {
    const alias = normalizeBookText(raw);
    const source = '(?:^|[^\\p{L}\\d])(' + escapeRe(alias).replace(/ /g, '\\s*') + ')(?=$|[^\\p{L}\\d])';
    return { component, alias, regex: new RegExp(source, 'u'), all: new RegExp(source, 'gu') };
})).sort((a, b) => b.alias.length - a.alias.length);
// Everyday words that only name a component when a book, unit or page is also present
// ("Read the story", "Grammar: past simple", "Test on Friday", "Each student…").
const WEAK_COMPONENT_ALIASES = new Set(['book', 'bk', 'story', 'stories', 'reader', 'readers', 'test', 'tests', 'activity', 'pupil', 'pupils', 'student', 'students', 'comp', 'boost', 'booster',
    'language', 'lang', 'starter', 'grammar', 'booklet', 'pd', 'companion', 'companions', 'βιβλιο', 'τεστ', 'ασκησεις', 'λεξιλογιο', 'αναγνωσμα', 'λογοτεχνια', 'γραμματικη'].map(normalizeBookText));
const LOW_COMPONENT_ALIASES = new Set(['book', 'bk', 'βιβλιο'].map(normalizeBookText));
const componentInfoFor = item => ({ component: item.component, confidence: LOW_COMPONENT_ALIASES.has(item.alias) ? 'low' : 'high', explicit: true, weak: WEAK_COMPONENT_ALIASES.has(item.alias) });
/** The one part a short text names. Text that names several parts is split first by parseLessonTarget. */
export function detectBookComponent(text) {
    const normal = normalizeBookText(text);
    for (const item of componentIndex) if (item.regex.test(normal)) return componentInfoFor(item);
    return { component: 'sb', confidence: 'low', explicit: false };
}
/** Every part named in normalised text, with its position. Longer names win ("activity book" over "book"). */
function scanComponents(normal, blocked = []) {
    const found = [];
    for (const item of componentIndex) for (const m of normal.matchAll(item.all)) {
        const end = m.index + m[0].length, start = end - m[1].length;
        if ([...found, ...blocked].some(o => start < o.end && end > o.start)) continue;
        found.push({ type: 'component', start, end, alias: item.alias, ...componentInfoFor(item) });
    }
    return found.sort((a, b) => a.start - b.start);
}
const aliasIndexCache = new WeakMap();
export function buildAliasIndex(atlas = BOOK_ATLAS) {
    return atlas.flatMap(book => {
        const series = book.id.startsWith('primary-path-') ? ['primary path', 'cpp', 'pp']
            : book.id.startsWith('close-up-') ? ['new close up', 'close up', 'closeup', 'ncu', 'cu']
            : book.id.startsWith('grammalysis-') ? ['grammalysis'] : [];
        return [...new Set([...book.aliases, ...series].map(normalizeBookText))].map(alias => ({
            bookId: book.id, alias, broad: series.includes(alias),
            regex: new RegExp('(^|[^\\p{L}\\d+])(' + escapeRe(alias).replace(/ /g, '\\s*') + ')(?=$|[^\\p{L}\\d+])', 'gu')
        }));
    }).sort((a, b) => b.alias.length - a.alias.length);
}
function aliasIndex(atlas) {
    if (!aliasIndexCache.has(atlas)) aliasIndexCache.set(atlas, buildAliasIndex(atlas));
    return aliasIndexCache.get(atlas);
}
// Unsupported levels belong to the named series; never reinterpret B1+ as
// another publisher's book or silently fall back to a broad series match.
// Close-Up B1+ and Grammalysis B2 are not in the atlas: leave them unread
// rather than landing on the B1 book of the same series. Blanks keep every position in place.
function bookScanText(text) {
    const blank = m => ' '.repeat(m.length);
    return normalizeBookText(text)
        .replace(/\bgrammalysis\s+(?:b1\+|b2)(?![\p{L}\d])/gu, blank)
        .replace(/(?:\b(?:new\s*)?(?:close\s*-?\s*up|closeup|n?cu)\s*)?\bb1\s*(?:\+|plus\b)/gu, blank)
        .replace(/\bclose\s*-?\s*up\s+plus\b/gu, blank);
}
/** Every book mention in prepared text (one hit per book per place; a series name hits each of its books). */
function scanBooks(normal, atlas) {
    const hits = []; const occupied = [];
    for (const item of aliasIndex(atlas)) for (const m of normal.matchAll(item.regex)) {
        const start = m.index + m[1].length, end = start + m[2].length;
        // "pp 78" is a page list, not the Primary Path series.
        if (item.broad && item.alias === 'pp' && /^\s*\d/.test(normal.slice(end))) continue;
        if (occupied.some(o => start < o.end && end > o.start && (start !== o.start || end !== o.end))) continue;
        if (!occupied.some(o => o.start === start && o.end === end)) occupied.push({ start, end });
        hits.push({ bookId: item.bookId, alias: item.alias, start, end,
            confidence: item.broad || /^grammar\s+\d/.test(item.alias) ? 'low' : /^b1(?:\+| plus)?$/.test(item.alias) ? 'medium' : 'high' });
    }
    return hits;
}
export function detectBooks(text, atlas = BOOK_ATLAS) {
    const found = [];
    for (const hit of scanBooks(bookScanText(text), atlas)) if (!found.some(f => f.bookId === hit.bookId)) found.push(hit);
    return found.sort((a, b) => a.start - b.start);
}
const PAGE_TOKENS = ['pages', 'page', 'pgs', 'pp', 'pg', 'p', 'σελιδα', 'σελ', 'σ'].map(normalizeBookText).join('|');
const RANGE_WORDS = ['to', 'εως', 'μεχρι'].map(normalizeBookText).join('|');
export function parsePages(text) {
    const normal = normalizeBookText(String(text || '').replace(/\bpp[123]\b/gi, ''));
    const re = new RegExp('(?:^|[^\\p{L}\\d])(?:' + PAGE_TOKENS + ')\\s*(\\d{1,3}(?:\\s*(?:-|,|&|\\+|and|' + RANGE_WORDS + ')\\s*\\d{1,3})*)', 'gu');
    const matches = [...normal.matchAll(re)];
    if (!matches.length) return { from: null, to: null, list: [], raw: '' };
    const pages = new Set();
    for (const m of matches) {
        const expr = m[1].replace(new RegExp('\\s*(?:' + RANGE_WORDS + ')\\s*', 'g'), '-');
        for (const part of expr.split(/\s*(?:,|&|\+|and)\s*/)) {
            const [start, end = start] = part.split(/\s*-\s*/).map(Number);
            if (!(start > 0 && end >= start && end < 1000 && end - start <= 200)) continue;
            for (let p = start; p <= end; p++) pages.add(p);
        }
    }
    const list = [...pages].sort((a, b) => a - b);
    return { from: list[0] || null, to: list.at(-1) || null, list, raw: matches.map(m => m[0].trim()).join(', ') };
}
const UNIT_TOKENS = ['units', 'unit', 'un', 'u', 'unt', 'lessons', 'lesson', 'les', 'lsn', 'ls', 'l', 'chapter', 'cha', 'chap', 'ch', 'module', 'mod', 'section', 'sec', 'sect', 'part', 'pt', 'διδακτικη ενοτητα', 'ενοτητα', 'ενοτ', 'εν', 'κεφαλαιο', 'κεφ', 'μαθημα', 'review', 'revision'].map(normalizeBookText).sort((a, b) => b.length - a.length).join('|');
export function parseUnits(text) {
    const normal = normalizeBookText(text);
    const regex = new RegExp('(?:^|[^\\p{L}\\d])(' + UNIT_TOKENS + ')\\s*(\\d{1,2})([a-c])?(?=$|[^\\p{L}\\d])', 'gu');
    const result = [...normal.matchAll(regex)].map(m => ({ unit: +m[2], lessonCode: m[3] ? m[2] + m[3] : null, review: ['review', 'revision'].includes(m[1]) }));
    if (!result.length) {
        const bare = normal.match(/^(\d{1,2})([a-c])$/);
        if (bare) result.push({ unit: +bare[1], lessonCode: bare[1] + bare[2], review: false });
    }
    return result.filter(u => u.unit > 0);
}
export function describeUnit(atlas = BOOK_ATLAS, bookId, unit) {
    return atlas.find(b => b.id === bookId)?.units.find(u => u.n === Number(unit)) || null;
}
export const PART_LABELS = { sb: "Student's Book", wb: 'Activity book', companion: 'Companion', grammar: 'Grammar book', test: 'Test book', reader: 'Reader', 'picture dictionary': 'Picture dictionary', 'alphabet/starter': 'Alphabet & Starter' };
const STANDARD_PARTS = ['sb', 'wb', 'companion', 'grammar', 'test', 'reader'];
/**
 * The parts of a book collection the picker can offer. A book's own page maps decide what exists
 * (so a workbook-only map shows an Activity book part); a custom book falls back to the standard set.
 */
export function bookComponents(book) {
    if (!book) return [...STANDARD_PARTS];
    const primary = book.kind === 'grammar' ? 'grammar' : 'sb';
    const found = new Set([primary]);
    for (const u of book.units) for (const part of Object.keys(u.pages || {})) if (u.pages[part]) found.add(part);
    const ordered = STANDARD_PARTS.filter(p => found.has(p));
    for (const p of found) if (!ordered.includes(p)) ordered.push(p);
    return ordered;
}
/**
 * Every part the picker offers for a book: the parts with a page map first, then the other usual parts of
 * that kind of book (a class may use an activity book the atlas has no page list for). A grammar book keeps
 * its own parts only, so a coursebook part never lands on it.
 */
export function bookPartOptions(book) {
    const mapped = bookComponents(book);
    if (!book) return mapped;
    const usual = book.kind === 'grammar' ? ['grammar', 'test'] : STANDARD_PARTS.filter(p => p !== 'grammar');
    return [...mapped, ...usual.filter(p => !mapped.includes(p))];
}
/** True when one part of a book has a printed page map, so pages and units can fill each other. */
export function hasPageMap(bookId, component = 'sb', atlas = BOOK_ATLAS) {
    const book = atlas.find(b => b.id === bookId);
    return Boolean(book?.units.some(u => componentRange(book, u, component)));
}
// A unit's page map for one part: the part's own published range, or the book's primary range.
function componentRange(book, unit, component) {
    if (!unit) return null;
    const primary = book?.kind === 'grammar' ? 'grammar' : 'sb';
    // Tolerate legacy calls that pass 'sb' for a grammar-kind book.
    const comp = component === 'sb' && book?.kind === 'grammar' ? 'grammar' : component;
    const parts = unit.pages || {};
    const range = parts[comp] ?? (comp === primary ? unit.pageRange : null);
    return Array.isArray(range) && range.length === 2 && range[0] > 0 ? range : null;
}
export function unitForPage(bookId, page, component = 'sb', atlas = BOOK_ATLAS) {
    const book = atlas.find(b => b.id === bookId);
    if (!book || !page) return null;
    // Published ranges can overlap by a page or two (a unit's opening spread is listed in both units).
    // Resolve deterministically: the page belongs to the unit that started most recently.
    let best = null, bestStart = -Infinity;
    for (const u of book.units) {
        const range = componentRange(book, u, component);
        if (!range || page < range[0] || page > range[1]) continue;
        if (range[0] > bestStart) { best = u; bestStart = range[0]; }
    }
    return best?.n || null;
}
/** The published page range [from, to] of a unit for one part, or null when that part has no printed page map. */
export function pageRangeForUnit(bookId, unit, component = 'sb', atlas = BOOK_ATLAS) {
    const book = atlas.find(b => b.id === bookId);
    return componentRange(book, describeUnit(atlas, bookId, unit), component);
}
const formatRange = range => range[0] === range[1] ? String(range[0]) : range[0] + '-' + range[1];
/**
 * Keep one picker row's Unit and Pages in step after the teacher changes something.
 * `row` = { bookId, component, unit, pageText, unitAuto, pagesAuto }; the *Auto flags mark a field the app
 * filled from the other one. `change` is 'unit', 'pages', 'book' or 'part'.
 * - A typed unit fills that unit's pages for this part; a typed page fills its unit.
 * - A field the app filled is cleared when it no longer follows (a unit with no page list for this part).
 * - On a new book or part the teacher's own entry leads: their pages re-find the unit, otherwise their unit
 *   re-fills the pages, because page numbers differ from part to part while the unit does not.
 */
export function syncLessonRow(row, change, atlas = BOOK_ATLAS) {
    const next = { ...row, unit: String(row.unit ?? ''), pageText: String(row.pageText ?? ''), unitAuto: Boolean(row.unitAuto), pagesAuto: Boolean(row.pagesAuto) };
    if (change === 'unit') next.unitAuto = false;
    if (change === 'pages') next.pagesAuto = false;
    if (!atlas.some(b => b.id === next.bookId)) return next;
    const firstPage = () => parsePages('pp ' + next.pageText).from;
    const fillPages = () => {
        const unit = Number(next.unit) || null;
        const range = unit ? pageRangeForUnit(next.bookId, unit, next.component, atlas) : null;
        if (range) { next.pageText = formatRange(range); next.pagesAuto = true; }
        else if (next.pagesAuto) { next.pageText = ''; next.pagesAuto = false; }
    };
    const fillUnit = () => {
        const page = firstPage();
        const unit = page ? unitForPage(next.bookId, page, next.component, atlas) : null;
        if (unit) { next.unit = String(unit); next.unitAuto = true; }
        else if (next.unitAuto) { next.unit = ''; next.unitAuto = false; }
    };
    if (change === 'unit') fillPages();
    else if (change === 'pages') fillUnit();
    else if (next.unitAuto && firstPage()) fillUnit();
    else if (Number(next.unit)) fillPages();
    else if (firstPage()) fillUnit();
    return next;
}
function defaultBook(atlas, league, component) {
    const kind = component === 'grammar' ? 'grammar' : 'coursebook';
    return atlas.find(b => b.defaultLeagues.includes(league) && b.kind === kind)?.id || null;
}
function carryBook(bookPlan, component, atlas) {
    const current = atlas.find(b => b.id === bookPlan.currentBookId);
    const isGrammar = component === 'grammar';
    if (current && (current.kind === 'grammar') === isGrammar) return current.id;
    const previous = [...(bookPlan.history || [])].reverse().find(h => {
        if (h.unconfirmed) return false; // a guess the teacher never confirmed is not a class book
        const b = atlas.find(v => v.id === h.bookId); return b && (b.kind === 'grammar') === isGrammar;
    });
    return previous?.bookId || (isGrammar ? null : bookPlan.currentBookId) || null;
}
export function extractAssignmentVocabulary(text) {
    const words = [], materials = [];
    for (const m of String(text || '').matchAll(/(?:words?|vocabulary|λέξεις|λεξεις|φωτοτυπία|φωτοτυπια|worksheet|handout|elabs?|photocopy)\s*[:=-]\s*([^;\n]+)/gi)) {
        splitKeywords(m[1]).filter(looksLikeVocabulary).forEach(w => words.push(w));
    }
    for (const m of String(text || '').matchAll(/φωτοτυπ[ίι]α|worksheet|handout|elabs?|photocopy/gi)) materials.push(m[0]);
    return { words: [...new Set(words)].slice(0, 16), materials: [...new Set(materials)] };
}
// Words and marks that join two lessons: "SB p.42, AB p.30", "SB and AB", "SB / AB", "SB και AB".
const SEPARATOR_RE = new RegExp('[;,+&/|]|(?:^|\\s)(?:and|or|' + normalizeBookText('και') + ')(?=\\s|$)', 'gu');
const isGrammarPart = component => component === 'grammar';
const COURSEBOOK_PARTS = new Set(['sb', 'wb', 'companion']);
/**
 * Split an assignment into one piece per lesson. A new piece starts where a second part or a different book is
 * named, so "Pupil's Book p.30, Activity Book p.20" is two lessons and the Activity book never swallows the
 * Pupil's Book. Joining words ("and", "&", "/", ",", "και", "or") are optional: "AB p.30 PB p.42" splits too.
 * A trailing qualifier stays with its lesson ("PP2 u.4 pp.78-80 (SB)"), and a passing everyday word
 * ("SB activity 3 p.42") does not start a lesson of its own.
 */
function lessonSegments(normal, atlas) {
    const books = [];
    for (const hit of scanBooks(normal, atlas)) {
        let span = books.find(s => s.start === hit.start && s.end === hit.end);
        if (!span) books.push(span = { type: 'book', start: hit.start, end: hit.end, bookIds: [] });
        span.bookIds.push(hit.bookId);
    }
    for (const span of books) span.grammar = span.bookIds.some(id => atlas.find(b => b.id === id)?.kind === 'grammar');
    // A part named inside a book's own name ("My Grammar Book 2") belongs to that book.
    const anchors = [...books, ...scanComponents(normal, books)].sort((a, b) => a.start - b.start);
    const numeric = books.reduce((s, b) => s.slice(0, b.start) + ' '.repeat(b.end - b.start) + s.slice(b.end), normal);
    const hasNumbers = (from, to) => {
        if (to <= from) return false;
        const slice = numeric.slice(from, to);
        return parsePages(slice).list.length > 0 || parseUnits(slice).length > 0;
    };
    // A part that cannot belong to the book in hand (an activity book inside a grammar book) is a new lesson.
    const conflicts = (span, component) => span.grammar ? COURSEBOOK_PARTS.has(component) : isGrammarPart(component);
    const segments = [];
    let cur = null;
    const open = (start, anchor, joined) => {
        cur = { start, last: anchor.end, joined, book: anchor.type === 'book' ? anchor : null, comp: anchor.type === 'component' ? anchor : null };
        segments.push(cur);
    };
    for (const a of anchors) {
        if (!cur) { open(0, a, false); continue; }
        const numbersSince = hasNumbers(cur.last, a.start);
        let split = false, ignore = false;
        if (a.type === 'book') {
            split = Boolean((cur.book && !cur.book.bookIds.some(id => a.bookIds.includes(id)))
                || (cur.comp && !cur.comp.weak && conflicts(a, cur.comp.component))
                || (cur.comp && numbersSince));
        } else if (cur.comp) {
            if (!numbersSince && (a.weak || a.component === cur.comp.component)) ignore = a.weak && !cur.comp.weak;
            else split = true;
        } else {
            split = Boolean(cur.book && conflicts(cur.book, a.component));
        }
        if (split) {
            const seps = [...normal.slice(0, a.start).matchAll(SEPARATOR_RE)].filter(m => m.index >= cur.last);
            const cut = seps.length ? seps.at(-1).index : a.start;
            cur.end = cut;
            open(cut, a, seps.length > 0);
            continue;
        }
        if (ignore) continue;
        if (a.type === 'book' && !cur.book) cur.book = a;
        if (a.type === 'component' && (!cur.comp || (cur.comp.weak && !a.weak))) cur.comp = a;
        cur.last = Math.max(cur.last, a.end);
    }
    if (!segments.length) segments.push({ start: 0, joined: false, book: null, comp: null });
    segments.forEach((s, i) => {
        s.end = segments[i + 1]?.start ?? normal.length;
        s.text = normal.slice(s.start, s.end);
        s.numeric = numeric.slice(s.start, s.end);
    });
    return segments;
}
const LESSON_PRIORITIES = ['sb', 'companion', 'wb', 'grammar', 'test', 'reader', 'picture dictionary', 'alphabet/starter'];
const partRank = component => { const i = LESSON_PRIORITIES.indexOf(component); return i < 0 ? LESSON_PRIORITIES.length : i; };
/** The lesson that leads: the coursebook (Student's / Pupil's Book) first; activity book, grammar etc. ride along. */
export function primaryLessonTarget(targets = []) {
    return [...targets].filter(Boolean).sort((a, b) => partRank(a.component) - partRank(b.component))[0] || null;
}
export function parseLessonTarget(text, atlas = BOOK_ATLAS, bookPlan = {}) {
    const normal = bookScanText(String(text || '').replace(/\r?\n/g, ';'));
    const extracted = extractAssignmentVocabulary(text);
    const kindOf = id => atlas.find(b => b.id === id)?.kind;
    const fits = (bookId, component) => Boolean(bookId) && (kindOf(bookId) === 'grammar') === isGrammarPart(component);
    // 1. One piece per lesson, with its own part, book mentions, units and pages.
    const pieces = lessonSegments(normal, atlas).map(seg => {
        const componentInfo = seg.comp ? { component: seg.comp.component, confidence: seg.comp.confidence, explicit: true, weak: seg.comp.weak }
            : { component: 'sb', confidence: 'low', explicit: false };
        return { seg, componentInfo, candidates: detectBooks(seg.text, atlas), units: parseUnits(seg.numeric), pages: parsePages(seg.numeric) };
    }).filter(p => p.candidates.length || p.units.length || p.pages.list.length || (p.componentInfo.explicit && !p.componentInfo.weak));
    // 2. The book each piece names, if any.
    for (const p of pieces) {
        p.component = p.componentInfo.component;
        if (p.candidates.length === 1 && kindOf(p.candidates[0].bookId) === 'grammar') p.component = 'grammar';
        p.carriedBook = carryBook(bookPlan, p.component, atlas);
        if (p.candidates.length > 1 && p.candidates.every(c => c.confidence === 'low')) {
            const preferred = p.candidates.find(c => c.bookId === p.carriedBook)
                || p.candidates.find(c => atlas.find(b => b.id === c.bookId)?.defaultLeagues.includes(bookPlan.league));
            if (preferred) p.candidates = [preferred];
        }
        p.exact = p.candidates[0] || null;
    }
    // 3. A part without a book of its own belongs to the book named next to it in the same text
    //    ("PP1 SB p.42, AB p.20": the AB is PP1's), before falling back on the class book.
    pieces.forEach((p, i) => {
        if (p.exact) return;
        const near = [...pieces.slice(0, i).reverse(), ...pieces.slice(i + 1)].find(q => q.exact && q.candidates.length === 1 && fits(q.exact.bookId, p.component));
        p.inherited = near ? near.exact : null;
    });
    for (const p of pieces) {
        p.bookId = p.exact?.bookId || p.inherited?.bookId || p.carriedBook || defaultBook(atlas, bookPlan.league, p.component);
        p.carried = !p.exact && !p.inherited && Boolean(p.carriedBook);
    }
    // 4. "Student's Book and Activity Book unit 3": a bare part joined to its neighbour shares that unit (same book only).
    pieces.forEach((p, i) => {
        if (p.units.length || p.pages.list.length || !p.componentInfo.explicit) return;
        const next = pieces[i + 1], prev = pieces[i - 1];
        const share = [next?.seg.joined ? next : null, p.seg.joined ? prev : null]
            .find(q => q && q.units.length && !q.units[0].review && q.bookId === p.bookId);
        if (share) p.units = [share.units[0]];
    });
    const targets = pieces.map(p => {
        const { component, bookId, exact, inherited, carried, candidates, units, pages, componentInfo } = p;
        const review = Boolean(units[0]?.review);
        const pageUnit = !review && !units[0]?.unit && pages.from ? unitForPage(bookId, pages.from, component, atlas) : null;
        // The class's current unit only means something for the class's current book.
        const classUnit = !exact && !inherited && !pages.from && bookId && bookId === bookPlan.currentBookId ? bookPlan.unit : null;
        const unit = review ? null : units[0]?.unit || pageUnit || classUnit || null;
        const named = exact || inherited;
        const needsConfirm = !bookId || candidates.length > 1 || (named && named.confidence !== 'high')
            || (!named && !carried) || (componentInfo.explicit && componentInfo.confidence === 'low')
            || (pages.from && !units.length && !unit) || (unit && !describeUnit(atlas, bookId, unit)) || review;
        return { bookId, component, unit, unitFromPage: Boolean(pageUnit && unit === pageUnit), lessonCode: units[0]?.lessonCode || null, review: review ? units[0].unit : null,
            pageFrom: pages.from, pageTo: pages.to, pages: pages.list, words: extracted.words, materials: extracted.materials,
            confidence: named?.confidence || (carried ? 'high' : bookId ? 'medium' : 'low'),
            carried, needsConfirm: Boolean(needsConfirm), candidates: candidates.map(c => c.bookId) };
    });
    if (!targets.length && bookPlan.currentBookId) {
        targets.push({ bookId: bookPlan.currentBookId, component: bookPlan.component || 'sb', unit: bookPlan.unit || null,
            pageFrom: bookPlan.page || null, pageTo: bookPlan.page || null, pages: [], words: extracted.words, materials: extracted.materials,
            // Nothing in the text points at a lesson: offer the class's current book as a question, never as a fact.
            confidence: 'low', carried: true, needsConfirm: true, lessonCode: null, review: null, candidates: [] });
    }
    const primary = primaryLessonTarget(targets);
    return { targets, primary, ...extracted };
}
export function resolveLessonTarget({ detected, bookPlan = {}, atlas = BOOK_ATLAS } = {}) {
    const parsed = typeof detected === 'string' ? parseLessonTarget(detected, atlas, bookPlan) : detected;
    const target = parsed?.primary || (Array.isArray(parsed) ? parsed[0] : parsed?.bookId ? parsed : null);
    const targets = Array.isArray(parsed?.targets) ? parsed.targets : target ? [target] : [];
    return { target, targets, changed: Boolean(target?.bookId && bookPlan.currentBookId && target.bookId !== bookPlan.currentBookId),
        carried: Boolean(target?.carried), needsConfirm: !target || Boolean(target.needsConfirm), candidates: target?.candidates || [] };
}
export function buildLessonTargetSummary(target, atlas = BOOK_ATLAS) {
    if (!target) return 'Choose a book and lesson';
    const book = atlas.find(b => b.id === target.bookId), unit = describeUnit(atlas, target.bookId, target.unit);
    const parts = [book?.title || target.customTitle || target.bookId || 'Book not recognised'];
    if (target.component && target.component !== 'sb' && !(target.component === 'grammar' && book?.kind === 'grammar')) parts.push(PART_LABELS[target.component] || target.component);
    if (target.review) parts.push('Review ' + target.review);
    else if (target.unit) parts.push('Unit ' + (target.lessonCode || target.unit) + (unit?.title ? ' · ' + unit.title : ''));
    const page = target.pageFrom || target.page;
    if (page) parts.push(target.pageTo && target.pageTo !== page ? 'pp. ' + page + '–' + target.pageTo : 'p. ' + page);
    return parts.join(' · ');
}
const loaders = {
    'primary-path-1': () => import('./bookAtlas/data/cpp1.json', { with: { type: 'json' } }),
    'primary-path-2': () => import('./bookAtlas/data/cpp2.json', { with: { type: 'json' } }),
    'primary-path-3': () => import('./bookAtlas/data/cpp3.json', { with: { type: 'json' } }),
    'close-up-b1': () => import('./bookAtlas/data/close-up-b1.json', { with: { type: 'json' } }),
    bamboo: () => import('./bookAtlas/data/bamboo1.json', { with: { type: 'json' } }),
    'yeti-2': () => import('./bookAtlas/data/yeti2.json', { with: { type: 'json' } })
};
export async function getUnitWords(bookId, unit, { component = 'sb', pages = [], lessonCode = null, limit = Infinity } = {}) {
    if (!loaders[bookId] || !unit) return [];
    const data = (await loaders[bookId]()).default;
    const source = component === 'companion' && Object.keys(data.companion || {}).length ? data.companion : data.units;
    let words = [...(source?.[String(unit)] || [])];
    if (component === 'wb') words = words.filter(w => w.component === 'wb');
    else if (component === 'sb') words = words.filter(w => w.component !== 'wb');
    if (lessonCode) { const matching = words.filter(w => w.location?.toLowerCase() === lessonCode.toLowerCase()); if (matching.length) words = matching; }
    if (pages.length) {
        // Senior courses teach a DIFFERENT vocabulary set on each page set inside one unit. When the
        // wordlist pins words to pages, take only the requested set; a page-less book (junior) keeps its
        // whole unit, and a requested page the wordlist does not pin falls back to the unit.
        const pageSet = words.filter(w => w.page != null && pages.includes(Number(w.page)));
        if (pageSet.length) words = pageSet.sort((a, b) => Number(a.page) - Number(b.page));
        else words.sort((a, b) => Number(pages.includes(b.page)) - Number(pages.includes(a.page)));
    }
    return words.slice(0, limit);
}
/** The page sets inside one unit that carry vocabulary (senior courses). Empty for page-less books. */
export async function unitPageSets(bookId, unit, { component = 'sb' } = {}) {
    const words = await getUnitWords(bookId, unit, { component });
    const byPage = new Map();
    for (const w of words) if (w.page != null) byPage.set(Number(w.page), (byPage.get(Number(w.page)) || 0) + 1);
    return [...byPage.entries()].map(([page, count]) => ({ page, count })).sort((a, b) => a.page - b.page);
}

// ─── Lesson history (what each assignment was, dated by the day it was written) ───
/**
 * One history entry for an assignment. The date is the day the teacher WROTE it (the end of lesson N),
 * so at the end of lesson N+1 the Campfire finds it as "practised before today".
 * An entry the app is unsure about keeps its words but is marked unconfirmed (it never moves the class book).
 */
export function lessonHistoryEntry({ text = '', date, assignmentId = null, bookPlan = {}, confirmedTarget = null, confirmedTargets = null, atlas = BOOK_ATLAS } = {}) {
    const resolved = resolveLessonTarget({ detected: text, bookPlan, atlas });
    const list = (confirmedTargets?.length ? confirmedTargets : confirmedTarget ? [confirmedTarget] : resolved.targets).filter(t => t && t.bookId);
    // A coursebook part leads; grammar/booster ride along. The primary keeps the legacy single-book fields.
    const primary = primaryLessonTarget(list)
        || confirmedTarget || resolved.target || null;
    const confirmed = Boolean(confirmedTarget?.bookId || confirmedTargets?.some(t => t?.bookId)) || Boolean(primary?.bookId && !resolved.needsConfirm);
    const books = list.map(t => ({ bookId: t.bookId, component: t.component || 'sb', unit: t.unit || null, page: t.pageFrom || t.page || null }));
    return {
        bookId: primary?.bookId || null, component: primary?.component || 'sb', unit: primary?.unit || null,
        page: primary?.pageFrom || primary?.page || null, date, assignmentId: assignmentId || null,
        words: extractAssignmentVocabulary(text).words, text: String(text || '').slice(0, 300),
        ...(books.length ? { books } : {}),
        ...(confirmed ? {} : { unconfirmed: true })
    };
}
/** Add an entry: one entry per assignment and per day (a re-saved assignment replaces that day's), oldest first, at most 40. */
export function appendLessonHistory(history = [], entry) {
    if (!entry?.date) return [...history];
    return [...history.filter(h => h && h.date !== entry.date && (!entry.assignmentId || h.assignmentId !== entry.assignmentId)), entry]
        .sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-40);
}
