/**
 * Quiz of the Week: "Choose book pages". The teacher picks one or more books, a unit and/or
 * a page range, and the quiz is written from exactly those pages (their words and grammar).
 * Pure apart from the Book Atlas data; no DOM or Firestore.
 * Covered by tests/quiz-book-picks.test.mjs.
 */
import { BOOK_ATLAS, PART_LABELS, bookPartOptions, describeUnit, pageRangeForUnit, parsePages, unitForPage } from './bookAtlas.mjs';

/** At most this many books in one quiz plan. */
export const QUIZ_BOOK_PICK_CAP = 3;
/** A page range wider than this is cut, so a quiz never tries to cover half a book. */
export const QUIZ_BOOK_PAGE_SPAN = 40;

const clip = (value, n) => String(value ?? '').trim().slice(0, n);

/** One picker row as stored on the plan. */
export function cleanBookPick(raw = {}, atlas = BOOK_ATLAS) {
    const bookId = clip(raw.bookId, 80);
    const book = atlas.find((b) => b.id === bookId);
    if (!book) return null;
    const parts = bookPartOptions(book);
    const component = parts.includes(raw.component) ? raw.component : parts[0];
    const unit = Number(raw.unit) || null;
    const pageText = clip(raw.pageText, 40).replace(/[^\d,\-–\s]/g, '').replace(/–/g, '-').replace(/\s+/g, ' ').trim();
    return { bookId, component, unit: unit && book.units.some((u) => u.n === unit) ? unit : null, pageText };
}

/** The pages a row asks for, in order, never more than QUIZ_BOOK_PAGE_SPAN. */
export function pickPages(pick) {
    const list = parsePages(`pp ${pick?.pageText || ''}`).list;
    return list.slice(0, QUIZ_BOOK_PAGE_SPAN);
}

/**
 * The units one row touches, each with the pages of it that were asked for.
 * Pages lead when they are given (each page finds its own unit); otherwise the chosen unit
 * is taken whole. A row with neither gives nothing.
 */
export function bookPickTargets(pick, atlas = BOOK_ATLAS) {
    const clean = cleanBookPick(pick, atlas);
    if (!clean) return [];
    const pages = pickPages(clean);
    if (pages.length) {
        const byUnit = new Map();
        for (const page of pages) {
            const unit = unitForPage(clean.bookId, page, clean.component, atlas) || clean.unit;
            if (!unit) continue;
            if (!byUnit.has(unit)) byUnit.set(unit, []);
            byUnit.get(unit).push(page);
        }
        return [...byUnit.entries()].map(([unit, unitPages]) => ({ bookId: clean.bookId, component: clean.component, unit, pages: unitPages }));
    }
    return clean.unit ? [{ bookId: clean.bookId, component: clean.component, unit: clean.unit, pages: [] }] : [];
}

function rangeText(pages) {
    if (!pages.length) return '';
    const runs = [];
    let start = pages[0];
    let prev = pages[0];
    for (const page of pages.slice(1).concat(Infinity)) {
        if (page === prev + 1) { prev = page; continue; }
        runs.push(start === prev ? String(start) : `${start}–${prev}`);
        start = page;
        prev = page;
    }
    return `${pages.length === 1 ? 'p.' : 'pp.'} ${runs.join(', ')}`;
}

/** "Primary Path 2 · Unit 3 · pp. 30–35" for the plan summary and the AI prompt. */
export function bookPickLabel(pick, atlas = BOOK_ATLAS) {
    const clean = cleanBookPick(pick, atlas);
    if (!clean) return '';
    const book = atlas.find((b) => b.id === clean.bookId);
    const primary = book.kind === 'grammar' ? 'grammar' : 'sb';
    const pages = pickPages(clean);
    const units = [...new Set(bookPickTargets(clean, atlas).map((t) => t.unit))];
    const parts = [book.title.replace(/^Cambridge /, '')];
    if (clean.component !== primary) parts.push(PART_LABELS[clean.component] || clean.component);
    if (units.length === 1) {
        const unit = describeUnit(atlas, clean.bookId, units[0]);
        parts.push(`Unit ${units[0]}${unit?.title ? ` · ${unit.title}` : ''}`);
    } else if (units.length > 1) {
        parts.push(`Units ${units.join(', ')}`);
    }
    if (pages.length) parts.push(rangeText(pages));
    return parts.join(' · ');
}

/** True when the row says enough to quiz on: a unit, or pages that land in a unit. */
export function isCompleteBookPick(pick, atlas = BOOK_ATLAS) {
    return bookPickTargets(pick, atlas).length > 0;
}

/**
 * Books to offer, the class's own first: the book it is on, books from its lesson history,
 * then the books made for its league, then every other book.
 */
export function quizBookOptions({ bookPlan = {}, league = '' } = {}, atlas = BOOK_ATLAS) {
    const own = new Set([bookPlan.currentBookId, ...(bookPlan.history || []).filter((h) => h && !h.unconfirmed).map((h) => h.bookId)].filter(Boolean));
    const rank = (book) => (own.has(book.id) ? 0 : (book.defaultLeagues || []).includes(league) ? 1 : 2);
    return atlas
        .map((book, index) => ({ book, index, rank: rank(book) }))
        .sort((a, b) => (a.rank - b.rank) || (a.index - b.index))
        .map(({ book, rank: r }) => ({ id: book.id, title: book.title, kind: book.kind, suggested: r < 2 }));
}

/** A first row for a class: its current book and unit, with that unit's pages filled in. */
export function defaultBookPick({ bookPlan = {}, league = '' } = {}, atlas = BOOK_ATLAS) {
    const [first] = quizBookOptions({ bookPlan, league }, atlas);
    const bookId = bookPlan.currentBookId && atlas.some((b) => b.id === bookPlan.currentBookId) ? bookPlan.currentBookId : first?.id;
    if (!bookId) return null;
    const book = atlas.find((b) => b.id === bookId);
    const component = book.kind === 'grammar' ? 'grammar' : (bookPlan.currentBookId === bookId && bookPlan.component) || 'sb';
    const unit = bookPlan.currentBookId === bookId ? Number(bookPlan.unit) || null : null;
    const range = unit ? pageRangeForUnit(bookId, unit, component, atlas) : null;
    return cleanBookPick({ bookId, component, unit, pageText: range ? `${range[0]}-${range[1]}` : '' }, atlas);
}
