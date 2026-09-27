import * as state from '../state.js';
import { db, doc, updateDoc } from '../firebase.js';
import { BOOK_ATLAS, resolveLessonTarget, buildLessonTargetSummary, parsePages, unitForPage, pageRangeForUnit, extractAssignmentVocabulary, lessonHistoryEntry, appendLessonHistory } from './bookAtlas.mjs';
import { getLocalIsoDateString as getTodayDateString } from '../utils.js';
import { canUseFeature } from '../utils/subscription.js';
import { cleanCampfireText } from './heroCampfireCore.mjs';
const confirmations = new Map();
window.addEventListener('gcq:campfire-reset', () => confirmations.clear());
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function getClassBookPlan(classId) {
    const c = state.get('allTeachersClasses').find(c => c.id === classId);
    return { ...(c?.bookPlan || {}), league: c?.questLevel };
}
function stripPlan(plan) {
    const { league, ...rest } = plan || {};
    return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
}
/**
 * Called after the teacher saves a Quest Assignment (at the end of a lesson). Quest Assignment keeps only the
 * newest assignment, so the previous one is copied into the class history here, dated by the day it was
 * written: that is the homework the children practised for the NEXT lesson, which the Campfire shows.
 */
export async function updateBookProgressFromAssignment({ classId, text, assignmentId, previous = null }) {
    const old = getClassBookPlan(classId);
    const confirmation = confirmations.get(classId);
    const confirmedTarget = confirmation?.text === text ? confirmation.target : null;
    let history = [...(old.history || [])];
    if (assignmentId && history.some(h => h.assignmentId === assignmentId)) return;
    if (previous?.text && previous.date && !history.some(h => h.assignmentId && h.assignmentId === previous.id)) {
        history = appendLessonHistory(history, lessonHistoryEntry({ text: previous.text, date: previous.date, assignmentId: previous.id, bookPlan: old }));
    }
    const entry = lessonHistoryEntry({ text, date: getTodayDateString(), assignmentId, bookPlan: old, confirmedTarget });
    history = appendLessonHistory(history, entry);
    const moveBook = !entry.unconfirmed && entry.bookId;
    const bookPlan = moveBook ? {
        currentBookId: entry.bookId, previousBookId: old.currentBookId !== entry.bookId ? old.currentBookId || null : old.previousBookId || null,
        component: entry.component, unit: entry.unit || null, page: entry.page || null, customTitle: confirmedTarget?.customTitle || '',
        customTheme: confirmedTarget?.customTheme || '', source: confirmedTarget ? 'teacher' : 'detected', updatedAt: new Date().toISOString(), history
    } : { ...stripPlan(old), history, updatedAt: new Date().toISOString() };
    await updateDoc(doc(db, 'artifacts/great-class-quest/public/data/classes', classId), { bookPlan });
    state.setAllTeachersClasses(state.get('allTeachersClasses').map(c => c.id === classId ? { ...c, bookPlan } : c));
    confirmations.delete(classId);
}
/** The small helper under the Quest Assignment text: it tells the Hero Campfire what the class practised. */
export function attachBookRecognition(classId, { force = false } = {}) {
    if (!force && !canUseFeature('heroCampfire')) return; // `force`: campfire-preview.html only
    const input = document.getElementById('quest-assignment-textarea');
    if (!input) return;
    document.getElementById('book-recognition-chip')?.remove();
    const chip = document.createElement('div');
    chip.id = 'book-recognition-chip';
    chip.className = 'mt-4 rounded-3xl border-2 p-4 text-sm transition-colors';
    chip.setAttribute('aria-live', 'polite');
    (input.closest('.notebook-container') || input).after(chip);
    let timer, override = null, confirmed = false, picking = false;
    const read = () => resolveLessonTarget({ detected: input.value, bookPlan: getClassBookPlan(classId) });
    const wordChips = words => words.length ? '<div class="mt-3 flex flex-wrap items-center gap-1.5"><span class="mr-1 text-xs font-black uppercase tracking-widest text-purple-400">Words</span>' +
        words.slice(0, 10).map(w => '<span class="rounded-full border border-purple-200 bg-white px-2.5 py-0.5 text-xs font-bold text-purple-700">' + escape(w) + '</span>').join('') + '</div>' : '';
    const TONES = { calm: ['border-purple-100', 'bg-white'], unsure: ['border-amber-200', 'bg-amber-50'], done: ['border-emerald-200', 'bg-emerald-50'] };
    const setTone = tone => {
        Object.values(TONES).flat().forEach(c => chip.classList.remove(c));
        chip.classList.add(...TONES[tone]);
    };
    const render = () => {
        if (picking) return;
        const hasText = !!input.value.trim();
        chip.hidden = !hasText;
        if (!hasText) return;
        const result = read(), target = override || result.target;
        const words = extractAssignmentVocabulary(input.value).words;
        const known = Boolean(target?.bookId);
        if (confirmed && known) {
            setTone('done');
            chip.innerHTML = '<div class="flex flex-wrap items-center gap-3"><span class="text-2xl" aria-hidden="true">✅</span><div class="min-w-[12rem] flex-1"><p class="font-black text-emerald-800">' + escape(buildLessonTargetSummary(target)) + '</p>' +
                '<p class="text-xs text-emerald-700">Saved with this assignment. The Hero Campfire will use this lesson and its words.</p></div>' +
                '<button type="button" data-book-change class="rounded-xl border-2 border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50">Change</button></div>' + wordChips(words);
        } else if (known) {
            const unsure = result.needsConfirm && !override;
            setTone(unsure ? 'unsure' : 'calm');
            chip.innerHTML = '<div class="flex flex-wrap items-center gap-3"><span class="text-2xl" aria-hidden="true">' + (unsure ? '🤔' : '📘') + '</span><div class="min-w-[12rem] flex-1">' +
                '<p class="text-xs font-black uppercase tracking-widest ' + (unsure ? 'text-amber-600' : 'text-purple-400') + '">' + (unsure ? 'Is this the right lesson?' : 'Lesson recognised') + '</p>' +
                '<p class="font-black text-slate-800">' + escape(buildLessonTargetSummary(target)) + '</p></div>' +
                '<button type="button" data-book-confirm class="bubbly-button rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md">✓ Yes, that’s it</button>' +
                '<button type="button" data-book-change class="rounded-xl border-2 border-purple-200 bg-white px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-50">Choose the book</button></div>' + wordChips(words);
        } else {
            setTone('calm');
            chip.innerHTML = '<div class="flex flex-wrap items-center gap-3"><span class="text-2xl" aria-hidden="true">📚</span><p class="min-w-[12rem] flex-1 text-slate-600"><b class="text-slate-800">Tip:</b> add the book and page, like <i>“PP2 unit 4 p.78”</i> or <i>“SB p.42, GB unit 5”</i>. For a photocopy, write <i>“words: …”</i>. The Hero Campfire then knows what the class practised.</p>' +
                '<button type="button" data-book-change class="rounded-xl border-2 border-purple-200 bg-white px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-50">Choose the book</button></div>' + wordChips(words);
        }
        chip.querySelector('[data-book-confirm]')?.addEventListener('click', () => {
            confirmed = true; override = target; confirmations.set(classId, { text: input.value.trim(), target }); render();
        });
        chip.querySelector('[data-book-change]')?.addEventListener('click', picker);
    };
    function picker() {
        picking = true;
        const target = override || read().target || {};
        setTone('calm');
        const field = 'mt-1 w-full rounded-xl border-2 border-purple-100 bg-white p-2 font-semibold text-slate-700';
        chip.innerHTML = '<p class="mb-3 font-black text-purple-700">📘 Which book did the class use?</p><div class="grid gap-3 sm:grid-cols-2">' +
            '<label class="text-xs font-bold text-slate-500 sm:col-span-2">Book<select data-book class="' + field + '">' + BOOK_ATLAS.map(b => '<option value="' + b.id + '">' + escape(b.title) + '</option>').join('') + '<option value="custom">Another book…</option></select></label>' +
            '<label class="text-xs font-bold text-slate-500">Unit<input data-unit type="number" min="1" max="99" placeholder="e.g. 4" class="' + field + '"></label>' +
            '<label class="text-xs font-bold text-slate-500">Pages<input data-page placeholder="e.g. 78-80" class="' + field + '"></label>' +
            '<label data-custom-row class="text-xs font-bold text-slate-500 sm:col-span-2" hidden>Book title<input data-title maxlength="100" class="' + field + '"></label>' +
            '<label data-custom-row class="text-xs font-bold text-slate-500 sm:col-span-2" hidden>What is this unit about? (used for the Campfire question)<input data-theme maxlength="120" placeholder="e.g. my town" class="' + field + '"></label></div>' +
            '<div class="mt-4 flex flex-wrap items-center justify-end gap-2"><button type="button" data-cancel class="rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</button>' +
            '<button type="button" data-apply class="bubbly-button rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-md">✓ Save this lesson</button></div>';
        const bookSelect = chip.querySelector('[data-book]');
        const unitInput = chip.querySelector('[data-unit]');
        const pageInput = chip.querySelector('[data-page]');
        bookSelect.value = BOOK_ATLAS.some(b => b.id === target.bookId) ? target.bookId : (target.customTitle ? 'custom' : BOOK_ATLAS[0].id);
        unitInput.value = target.unit || '';
        pageInput.value = target.pageFrom ? (target.pageTo && target.pageTo !== target.pageFrom ? target.pageFrom + '-' + target.pageTo : target.pageFrom) : target.page || '';
        chip.querySelector('[data-title]').value = target.customTitle || '';
        chip.querySelector('[data-theme]').value = target.customTheme || '';
        const syncCustom = () => chip.querySelectorAll('[data-custom-row]').forEach(r => { r.hidden = bookSelect.value !== 'custom'; });
        // Unit and Pages stay in step: a page belongs to one unit, and a unit spans one page range. Only the
        // Student's Book (and grammar units) publish a page map, so workbooks and page-less books stay untouched.
        const mapComponent = () => {
            const book = BOOK_ATLAS.find(b => b.id === bookSelect.value);
            if (!book) return target.component || 'sb';
            if (book.kind === 'grammar') return 'grammar';
            return target.component === 'grammar' ? 'sb' : (target.component || 'sb');
        };
        // A page typed in the picker, or already parsed from the assignment text, anchors the unit.
        const typedPage = () => parsePages('pp ' + pageInput.value).from || target.pageFrom || target.page || null;
        const unitFromPage = () => {
            if (bookSelect.value === 'custom') return;
            const page = typedPage();
            if (!page) return;
            const unit = unitForPage(bookSelect.value, page, mapComponent());
            if (unit) unitInput.value = unit;
        };
        const pagesFromUnit = () => {
            if (bookSelect.value === 'custom') return;
            const unit = Number(unitInput.value) || null;
            const range = unit ? pageRangeForUnit(bookSelect.value, unit) : null;
            // The range only fits when the same component can map its first page back to that unit.
            if (!range || unitForPage(bookSelect.value, range[0], mapComponent()) !== unit) return;
            pageInput.value = range[0] === range[1] ? String(range[0]) : range[0] + '-' + range[1];
        };
        bookSelect.onchange = () => { syncCustom(); unitFromPage(); };
        unitInput.oninput = pagesFromUnit;
        pageInput.oninput = unitFromPage;
        syncCustom();
        chip.querySelector('[data-cancel]').onclick = () => { picking = false; render(); };
        chip.querySelector('[data-apply]').onclick = () => {
            const bookId = bookSelect.value, customTitle = chip.querySelector('[data-title]').value.trim();
            if (bookId === 'custom' && !customTitle) { chip.querySelector('[data-title]').focus(); return; }
            const pages = parsePages('pp ' + pageInput.value);
            override = { bookId, customTitle, customTheme: cleanCampfireText(chip.querySelector('[data-theme]').value, 120), component: mapComponent(),
                unit: Number(unitInput.value) || null, page: pages.from, pageFrom: pages.from, pageTo: pages.to, pages: pages.list, confidence: 'high', needsConfirm: false };
            picking = false; confirmed = true; confirmations.set(classId, { text: input.value.trim(), target: override }); render();
        };
    }
    // Reopening the same modal replaces the old handler rather than accumulating it.
    input.oninput = () => {
        clearTimeout(timer);
        if (confirmed && override) confirmations.set(classId, { text: input.value.trim(), target: override });
        timer = setTimeout(render, 300);
    };
    render();
}
