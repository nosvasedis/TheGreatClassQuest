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
    sb: ["student's book", "students' book", 'student book', 'st book', 'sts book', "st's book", 'sb', 's b', 'sbk',
        "pupil's book", "pupils' book", 'pupil book', 'pupil', 'pupils', 'pb', 'p b', 'pbk', 'coursebook', 'course book', 'course bk', 'class book', 'main book', 'main coursebook', 'βιβλιο μαθητη', 'κυριως βιβλιο', 'book', 'bk', 'βιβλιο'],
    wb: ['workbook', 'work book', 'workbk', 'wkbk', 'wb', 'w b', 'activity book', 'act book', 'activ book', 'activity', 'ab', 'a b', 'exercises book', 'exercise book', 'practice book', 'prac book', 'ασκησεις', 'ασκησεων', 'βιβλιο ασκησεων', 'τετραδιο εργασιων'],
    companion: ['companion', 'companion book', 'companions', 'comp', 'learning companion', 'lc', 'l c', 'language booster', 'lang booster', 'l booster', 'lang booster book', 'language boost', 'lang boost', 'booster', 'boost', 'language b', 'lang b', 'language bk', 'lb', 'l b', 'comp & grammar', 'companion and grammar', 'λεξιλογιο', 'βοηθημα', 'συνοδευτικο', 'συνοδευτικο βιβλιο'],
    grammar: ['grammar', 'grammar book', 'grammar bk', 'gram book', 'gram b', 'gramm book', 'grammar b', 'gr book', 'gr b', 'gb', 'g b', 'grb', 'γραμματικη', 'γραμματικη book'],
    test: ['test', 'tests', 'test book', 'test bk', 'tests book', 't book', 'tb', 't b', 'quiz book', 'test booklet', 'booklet', 'τεστ'],
    reader: ['reader', 'readers', 'reader book', 'story book', 'story bk', 'story', 'stories', 'αναγνωσμα', 'λογοτεχνια'],
    'picture dictionary': ['picture dictionary', 'pic dictionary', 'pd', 'λεξικο εικονων'],
    'alphabet/starter': ['alphabet book', 'starter book', 'alphabet & starter', 'starter']
};
const componentIndex = Object.entries(COMPONENTS).flatMap(([component, aliases]) => aliases.map(raw => {
    const alias = normalizeBookText(raw);
    return { component, alias, regex: new RegExp('(?:^|[^\\p{L}\\d])(' + escapeRe(alias).replace(/ /g, '\\s*') + ')(?=$|[^\\p{L}\\d])', 'u') };
})).sort((a, b) => b.alias.length - a.alias.length);
// Everyday words that only name a component when a book, unit or page is also present
// ("Read the story", "Grammar: past simple", "Test on Friday").
const WEAK_COMPONENT_ALIASES = new Set(['book', 'bk', 'story', 'stories', 'reader', 'readers', 'test', 'tests', 'activity', 'pupil', 'pupils', 'comp', 'boost', 'booster',
    'starter', 'grammar', 'booklet', 'pd', 'companion', 'companions', 'βιβλιο', 'τεστ', 'ασκησεις', 'λεξιλογιο', 'αναγνωσμα', 'λογοτεχνια', 'γραμματικη'].map(normalizeBookText));
export function detectBookComponent(text) {
    const normal = normalizeBookText(text);
    for (const item of componentIndex) if (item.regex.test(normal))
        return { component: item.component, confidence: ['book', 'bk', normalizeBookText('βιβλιο')].includes(item.alias) ? 'low' : 'high', explicit: true, weak: WEAK_COMPONENT_ALIASES.has(item.alias) };
    return { component: 'sb', confidence: 'low', explicit: false };
}
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
export function detectBooks(text, atlas = BOOK_ATLAS) {
    // Unsupported levels belong to the named series; never reinterpret B1+ as
    // another publisher's book or silently fall back to a broad series match.
    const normal = normalizeBookText(text).replace(/\bgrammalysis\s+b1\+/g, ' ');
    const found = []; const occupied = [];
    for (const item of buildAliasIndex(atlas)) for (const m of normal.matchAll(item.regex)) {
        const start = m.index + m[1].length, end = start + m[2].length;
        if (occupied.some(o => start < o.end && end > o.start && (start !== o.start || end !== o.end))) continue;
        if (!occupied.some(o => o.start === start && o.end === end)) occupied.push({ start, end });
        if (found.some(f => f.bookId === item.bookId)) continue;
        found.push({ bookId: item.bookId, alias: item.alias, start, end,
            confidence: item.broad || /^grammar\s+\d/.test(item.alias) ? 'low' : /^b1(?:\+| plus)?$/.test(item.alias) ? 'medium' : 'high' });
    }
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
export function unitForPage(bookId, page, component = 'sb', atlas = BOOK_ATLAS) {
    const book = atlas.find(b => b.id === bookId);
    if (!book || (component !== 'sb' && !(component === 'grammar' && book.kind === 'grammar'))) return null;
    if (!page) return null;
    // Published ranges can overlap by a page or two (a unit's opening spread is listed in both units).
    // Resolve deterministically: the page belongs to the unit that started most recently.
    let best = null;
    for (const u of book.units) {
        if (!u.pageRange || page < u.pageRange[0] || page > u.pageRange[1]) continue;
        if (!best || u.pageRange[0] > best.pageRange[0]) best = u;
    }
    return best?.n || null;
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
export function parseLessonTarget(text, atlas = BOOK_ATLAS, bookPlan = {}) {
    const normal = normalizeBookText(String(text || '').replace(/\r?\n/g, ';'));
    const starts = 'sb|s b|pb|wb|ab|gb|g b|gr b|gr book|grammar|companion|lc|lb|lang|primary|pp\\d|pp \\d|cpp|close|cu |ncu|bamboo|yeti|burlington|my grammar|grammalysis|' + normalizeBookText('φωτοτυπια');
    const segments = normal.split(new RegExp('[;,\\+]\\s*(?=(?:' + starts + '))', 'u'));
    const extracted = extractAssignmentVocabulary(text);
    const targets = [];
    for (const segment of segments) {
        const componentInfo = detectBookComponent(segment);
        let candidates = detectBooks(segment, atlas);
        const units = parseUnits(segment), pages = parsePages(segment);
        if (!candidates.length && !units.length && !pages.list.length && (!componentInfo.explicit || componentInfo.weak)) continue;
        let component = componentInfo.component;
        if (candidates.length === 1 && atlas.find(b => b.id === candidates[0].bookId)?.kind === 'grammar') component = 'grammar';
        const carriedBook = carryBook(bookPlan, component, atlas);
        if (candidates.length > 1 && candidates.every(c => c.confidence === 'low')) {
            const preferred = candidates.find(c => c.bookId === carriedBook)
                || candidates.find(c => atlas.find(b => b.id === c.bookId)?.defaultLeagues.includes(bookPlan.league));
            if (preferred) candidates = [preferred];
        }
        const exact = candidates[0];
        const bookId = exact?.bookId || carriedBook || defaultBook(atlas, bookPlan.league, component);
        const carried = !exact && Boolean(carriedBook);
        const review = Boolean(units[0]?.review);
        const unit = review ? null : units[0]?.unit || (pages.from ? unitForPage(bookId, pages.from, component, atlas) : null)
            || (!exact && !pages.from ? bookPlan.unit : null) || null;
        const needsConfirm = !bookId || candidates.length > 1 || (exact && exact.confidence !== 'high')
            || (!exact && !carried) || (componentInfo.explicit && componentInfo.confidence === 'low')
            || (pages.from && !units.length && !unit) || (unit && !describeUnit(atlas, bookId, unit)) || review;
        targets.push({ bookId, component, unit, lessonCode: units[0]?.lessonCode || null, review: review ? units[0].unit : null,
            pageFrom: pages.from, pageTo: pages.to, pages: pages.list, words: extracted.words, materials: extracted.materials,
            confidence: exact?.confidence || (carried ? 'high' : bookId ? 'medium' : 'low'),
            carried, needsConfirm: Boolean(needsConfirm), candidates: candidates.map(c => c.bookId) });
    }
    if (!targets.length && bookPlan.currentBookId) {
        targets.push({ bookId: bookPlan.currentBookId, component: bookPlan.component || 'sb', unit: bookPlan.unit || null,
            pageFrom: bookPlan.page || null, pageTo: bookPlan.page || null, pages: [], words: extracted.words, materials: extracted.materials,
            // Nothing in the text points at a lesson: offer the class's current book as a question, never as a fact.
            confidence: 'low', carried: true, needsConfirm: true, lessonCode: null, review: null, candidates: [] });
    }
    const priorities = ['sb', 'companion', 'wb', 'grammar', 'test', 'reader', 'picture dictionary', 'alphabet/starter'];
    const primary = [...targets].sort((a, b) => priorities.indexOf(a.component) - priorities.indexOf(b.component))[0] || null;
    return { targets, primary, ...extracted };
}
export function resolveLessonTarget({ detected, bookPlan = {}, atlas = BOOK_ATLAS } = {}) {
    const parsed = typeof detected === 'string' ? parseLessonTarget(detected, atlas, bookPlan) : detected;
    const target = parsed?.primary || (Array.isArray(parsed) ? parsed[0] : parsed?.bookId ? parsed : null);
    return { target, changed: Boolean(target?.bookId && bookPlan.currentBookId && target.bookId !== bookPlan.currentBookId),
        carried: Boolean(target?.carried), needsConfirm: !target || Boolean(target.needsConfirm), candidates: target?.candidates || [] };
}
export function buildLessonTargetSummary(target, atlas = BOOK_ATLAS) {
    if (!target) return 'Choose a book and lesson';
    const book = atlas.find(b => b.id === target.bookId), unit = describeUnit(atlas, target.bookId, target.unit);
    const parts = [book?.title || target.customTitle || target.bookId || 'Book not recognised'];
    const PART = { wb: 'Workbook', companion: 'Companion', grammar: 'Grammar', test: 'Test book', reader: 'Reader', 'picture dictionary': 'Picture dictionary', 'alphabet/starter': 'Starter' };
    if (target.component && target.component !== 'sb' && !(target.component === 'grammar' && book?.kind === 'grammar')) parts.push(PART[target.component] || target.component);
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
    'close-up-b1-plus': () => import('./bookAtlas/data/close-up-b1-plus.json', { with: { type: 'json' } }),
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
    if (pages.length) words.sort((a, b) => Number(pages.includes(b.page)) - Number(pages.includes(a.page)));
    return words.slice(0, limit);
}

// ─── Lesson history (what each assignment was, dated by the day it was written) ───
/**
 * One history entry for an assignment. The date is the day the teacher WROTE it (the end of lesson N),
 * so at the end of lesson N+1 the Campfire finds it as "practised before today".
 * An entry the app is unsure about keeps its words but is marked unconfirmed (it never moves the class book).
 */
export function lessonHistoryEntry({ text = '', date, assignmentId = null, bookPlan = {}, confirmedTarget = null, atlas = BOOK_ATLAS } = {}) {
    const resolved = resolveLessonTarget({ detected: text, bookPlan, atlas });
    const target = confirmedTarget || resolved.target;
    const confirmed = Boolean(confirmedTarget?.bookId) || Boolean(target?.bookId && !resolved.needsConfirm);
    return {
        bookId: target?.bookId || null, component: target?.component || 'sb', unit: target?.unit || null,
        page: target?.pageFrom || target?.page || null, date, assignmentId: assignmentId || null,
        words: extractAssignmentVocabulary(text).words, text: String(text || '').slice(0, 300),
        ...(confirmed ? {} : { unconfirmed: true })
    };
}
/** Add an entry: one entry per assignment and per day (a re-saved assignment replaces that day's), oldest first, at most 40. */
export function appendLessonHistory(history = [], entry) {
    if (!entry?.date) return [...history];
    return [...history.filter(h => h && h.date !== entry.date && (!entry.assignmentId || h.assignmentId !== entry.assignmentId)), entry]
        .sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-40);
}
