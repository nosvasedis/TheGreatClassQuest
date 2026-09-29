import * as state from '../state.js';
import { db, doc, updateDoc } from '../firebase.js';
import { BOOK_ATLAS, resolveLessonTarget, buildLessonTargetSummary, parsePages, unitForPage, pageRangeForUnit, bookComponents, unitPageSets, PART_LABELS, extractAssignmentVocabulary, lessonHistoryEntry, appendLessonHistory } from './bookAtlas.mjs';
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
    const confirmedTargets = confirmation?.text === text ? confirmation.targets : null;
    let history = [...(old.history || [])];
    if (assignmentId && history.some(h => h.assignmentId === assignmentId)) return;
    if (previous?.text && previous.date && !history.some(h => h.assignmentId && h.assignmentId === previous.id)) {
        history = appendLessonHistory(history, lessonHistoryEntry({ text: previous.text, date: previous.date, assignmentId: previous.id, bookPlan: old }));
    }
    const entry = lessonHistoryEntry({ text, date: getTodayDateString(), assignmentId, bookPlan: old, confirmedTargets });
    history = appendLessonHistory(history, entry);
    const moveBook = !entry.unconfirmed && entry.bookId;
    const primary = confirmedTargets?.find(t => t.bookId === entry.bookId) || null;
    const targets = entry.books?.length ? entry.books : old.targets || [];
    const bookPlan = moveBook ? {
        currentBookId: entry.bookId, previousBookId: old.currentBookId !== entry.bookId ? old.currentBookId || null : old.previousBookId || null,
        component: entry.component, unit: entry.unit || null, page: entry.page || null, customTitle: primary?.customTitle || '',
        customTheme: primary?.customTheme || '', source: confirmedTargets ? 'teacher' : 'detected', updatedAt: new Date().toISOString(), history, targets
    } : { ...stripPlan(old), history, targets, updatedAt: new Date().toISOString() };
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
    const field = 'mt-1 w-full rounded-xl border-2 border-purple-100 bg-white p-2 font-semibold text-slate-700';
    let timer, targetsOverride = null, confirmed = false, picking = false, rows = [];
    const read = () => resolveLessonTarget({ detected: input.value, bookPlan: getClassBookPlan(classId) });
    const wordChips = words => words.length ? '<div class="mt-3 flex flex-wrap items-center gap-1.5"><span class="mr-1 text-xs font-black uppercase tracking-widest text-purple-400">Words</span>' +
        words.slice(0, 10).map(w => '<span class="rounded-full border border-purple-200 bg-white px-2.5 py-0.5 text-xs font-bold text-purple-700">' + escape(w) + '</span>').join('') + '</div>' : '';
    const TONES = { calm: ['border-purple-100', 'bg-white'], unsure: ['border-amber-200', 'bg-amber-50'], done: ['border-emerald-200', 'bg-emerald-50'] };
    const setTone = tone => {
        Object.values(TONES).flat().forEach(c => chip.classList.remove(c));
        chip.classList.add(...TONES[tone]);
    };
    const summaries = list => list.map(t => '<p class="font-black text-slate-800">' + escape(buildLessonTargetSummary(t)) + '</p>').join('');
    const primaryComponent = row => {
        const book = BOOK_ATLAS.find(b => b.id === row.bookId);
        return book?.kind === 'grammar' ? 'grammar' : 'sb';
    };
    const bookOptions = selected => BOOK_ATLAS.map(b => '<option value="' + b.id + '"' + (b.id === selected ? ' selected' : '') + '>' + escape(b.title) + '</option>').join('')
        + '<option value="custom"' + (selected === 'custom' ? ' selected' : '') + '>Another book…</option>';
    const render = () => {
        if (picking) return;
        const hasText = !!input.value.trim();
        chip.hidden = !hasText;
        if (!hasText) return;
        const result = read();
        const list = (targetsOverride || result.targets || []).filter(Boolean);
        const words = extractAssignmentVocabulary(input.value).words;
        const known = list.some(t => t.bookId);
        const unsure = !targetsOverride && (result.needsConfirm || list.some(t => t.needsConfirm));
        if (confirmed && known) {
            setTone('done');
            chip.innerHTML = '<div class="flex flex-wrap items-start gap-3"><span class="text-2xl" aria-hidden="true">✅</span><div class="min-w-[12rem] flex-1">' +
                '<p class="text-xs font-black uppercase tracking-widest text-emerald-700">Saved with this assignment</p>' + summaries(list) +
                '<p class="text-xs text-emerald-700">The Hero Campfire will use ' + (list.length > 1 ? 'these lessons and their words.' : 'this lesson and its words.') + '</p></div>' +
                '<button type="button" data-book-change class="rounded-xl border-2 border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50">Change</button></div>' + wordChips(words);
        } else if (known) {
            setTone(unsure ? 'unsure' : 'calm');
            chip.innerHTML = '<div class="flex flex-wrap items-start gap-3"><span class="text-2xl" aria-hidden="true">' + (unsure ? '🤔' : '📘') + '</span><div class="min-w-[12rem] flex-1">' +
                '<p class="text-xs font-black uppercase tracking-widest ' + (unsure ? 'text-amber-600' : 'text-purple-400') + '">' + (unsure ? 'Is this the right lesson?' : 'Lessons recognised') + '</p>' + summaries(list) + '</div>' +
                '<button type="button" data-book-confirm class="bubbly-button rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md">✓ Yes, that’s it</button>' +
                '<button type="button" data-book-change class="rounded-xl border-2 border-purple-200 bg-white px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-50">Choose the books</button></div>' + wordChips(words);
        } else {
            setTone('calm');
            chip.innerHTML = '<div class="flex flex-wrap items-center gap-3"><span class="text-2xl" aria-hidden="true">📚</span><p class="min-w-[12rem] flex-1 text-slate-600"><b class="text-slate-800">Tip:</b> add the book and page, like <i>“PP2 unit 4 p.78”</i> or <i>“SB p.42, GB unit 5”</i>. For a photocopy, write <i>“words: …”</i>. The Hero Campfire then knows what the class practised.</p>' +
                '<button type="button" data-book-change class="rounded-xl border-2 border-purple-200 bg-white px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-50">Choose the books</button></div>' + wordChips(words);
        }
        chip.querySelector('[data-book-confirm]')?.addEventListener('click', () => {
            confirmed = true; targetsOverride = list; confirmations.set(classId, { text: input.value.trim(), targets: list }); render();
        });
        chip.querySelector('[data-book-change]')?.addEventListener('click', picker);
    };
    const rowFromTarget = (t = {}) => ({
        bookId: BOOK_ATLAS.some(b => b.id === t.bookId) ? t.bookId : (t.customTitle ? 'custom' : BOOK_ATLAS[0].id),
        component: t.component || 'sb', unit: t.unit || '',
        pageText: t.pageFrom ? (t.pageTo && t.pageTo !== t.pageFrom ? t.pageFrom + '-' + t.pageTo : String(t.pageFrom)) : (t.page || ''),
        customTitle: t.customTitle || '', customTheme: t.customTheme || ''
    });
    const collect = () => rows.forEach((r, i) => {
        const get = name => chip.querySelector('[data-' + name + '="' + i + '"]');
        if (get('book')) r.bookId = get('book').value;
        if (get('part')) r.component = get('part').value;
        if (get('unit')) r.unit = get('unit').value;
        if (get('page')) r.pageText = get('page').value;
        if (get('title')) r.customTitle = get('title').value;
        if (get('theme')) r.customTheme = get('theme').value;
    });
    const partOptions = row => bookComponents(BOOK_ATLAS.find(b => b.id === row.bookId) || null)
        .map(p => '<option value="' + p + '"' + (p === (row.component || 'sb') ? ' selected' : '') + '>' + escape(PART_LABELS[p] || p) + '</option>').join('');
    // Compress a page list back into text ("30-33, 36") so the Pages field stays editable.
    const formatPageList = list => {
        const out = []; let i = 0;
        while (i < list.length) {
            let j = i; while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
            out.push(j - i >= 2 ? list[i] + '-' + list[j] : list.slice(i, j + 1).join(', '));
            i = j + 1;
        }
        return out.join(', ');
    };
    function drawPicker() {
        const rowHtml = rows.map((row, i) => {
            const custom = row.bookId === 'custom';
            const customHidden = custom ? '' : ' hidden';
            return '<div class="rounded-2xl border-2 border-purple-100 bg-white/70 p-3">' +
                '<div class="flex items-center justify-between gap-2"><span class="text-xs font-black uppercase tracking-widest text-purple-400">Book ' + (i + 1) + '</span>' +
                (rows.length > 1 ? '<button type="button" data-remove="' + i + '" class="rounded-lg px-2 py-1 text-xs font-bold text-rose-500 hover:bg-rose-50">Remove</button>' : '') + '</div>' +
                '<div class="mt-2 grid gap-3 sm:grid-cols-2">' +
                '<label class="text-xs font-bold text-slate-500 sm:col-span-2">Book<select data-book="' + i + '" class="' + field + '">' + bookOptions(row.bookId) + '</select></label>' +
                '<label class="text-xs font-bold text-slate-500">Part<select data-part="' + i + '" class="' + field + '">' + partOptions(row) + '</select></label>' +
                '<label class="text-xs font-bold text-slate-500">Unit<input data-unit="' + i + '" type="number" min="1" max="99" placeholder="e.g. 4" class="' + field + '" value="' + escape(row.unit || '') + '"></label>' +
                '<label class="text-xs font-bold text-slate-500 sm:col-span-2">Pages<input data-page="' + i + '" placeholder="e.g. 78-80" class="' + field + '" value="' + escape(row.pageText || '') + '"></label>' +
                '<div data-sets="' + i + '" class="flex flex-wrap items-center gap-1.5 sm:col-span-2"></div>' +
                '<label data-custom="' + i + '" class="text-xs font-bold text-slate-500 sm:col-span-2"' + customHidden + '>Book title<input data-title="' + i + '" maxlength="100" class="' + field + '" value="' + escape(row.customTitle || '') + '"></label>' +
                '<label data-custom="' + i + '" class="text-xs font-bold text-slate-500 sm:col-span-2"' + customHidden + '>What is this unit about? (Campfire question)<input data-theme="' + i + '" maxlength="120" placeholder="e.g. my town" class="' + field + '" value="' + escape(row.customTheme || '') + '"></label>' +
                '</div></div>';
        }).join('');
        chip.innerHTML = '<p class="mb-1 font-black text-purple-700">📘 Which books and parts did the class use?</p>' +
            '<p class="mb-3 text-xs text-slate-500">Add a second row for a grammar book, activity book or companion. Typing pages fills the unit automatically when that part has a page map.</p>' +
            '<div class="grid gap-3">' + rowHtml + '</div>' +
            '<div class="mt-3"><button type="button" data-add class="rounded-xl border-2 border-dashed border-purple-300 px-3 py-2 text-xs font-bold text-purple-600 hover:bg-purple-50">＋ Add another book</button></div>' +
            '<div class="mt-4 flex flex-wrap items-center justify-end gap-2"><button type="button" data-cancel class="rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</button>' +
            '<button type="button" data-apply class="bubbly-button rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-md">✓ Save these lessons</button></div>';
        rows.forEach((row, i) => {
            const get = name => chip.querySelector('[data-' + name + '="' + i + '"]');
            const bookSelect = get('book'), partSelect = get('part'), unitInput = get('unit'), pageInput = get('page');
            // Unit and Pages stay in step for THIS row's book and part, so an activity-book or companion page
            // still lands on the right unit.
            const unitFromPage = () => {
                if (row.bookId === 'custom') return;
                const page = parsePages('pp ' + pageInput.value).from;
                if (!page) return;
                const unit = unitForPage(row.bookId, page, row.component);
                if (unit) { row.unit = String(unit); unitInput.value = unit; }
            };
            const pagesFromUnit = () => {
                if (row.bookId === 'custom') return;
                const unit = Number(unitInput.value) || null;
                const range = unit ? pageRangeForUnit(row.bookId, unit, row.component) : null;
                if (!range || unitForPage(row.bookId, range[0], row.component) !== unit) return;
                row.pageText = range[0] === range[1] ? String(range[0]) : range[0] + '-' + range[1];
                pageInput.value = row.pageText;
            };
            // Senior books put a different vocabulary set on each page set. Offer those sets as chips so the
            // teacher picks the set taught; junior books (no pinned pages) show none and stay whole-unit.
            const enrichRow = () => {
                const setEl = get('sets');
                if (!setEl) return;
                const unit = Number(unitInput.value) || null;
                if (!unit || !row.bookId || row.bookId === 'custom') { setEl.innerHTML = ''; return; }
                unitPageSets(row.bookId, unit, { component: row.component }).then(sets => {
                    if (!picking || chip.querySelector('[data-sets="' + i + '"]') !== setEl) return;
                    if (!sets.length) { setEl.innerHTML = ''; return; }
                    setEl.innerHTML = '<span class="text-xs font-bold text-slate-400">Vocabulary pages:</span>' + sets.map(s =>
                        '<button type="button" data-set="' + i + ':' + s.page + '" class="rounded-full border border-purple-200 bg-white px-2.5 py-0.5 text-xs font-bold text-purple-700 hover:bg-purple-50">p.' + s.page + ' <span class="text-slate-400">·' + s.count + '</span></button>').join('');
                    sets.forEach(s => chip.querySelector('[data-set="' + i + ':' + s.page + '"]')?.addEventListener('click', () => {
                        const current = new Set(parsePages('pp ' + pageInput.value).list);
                        if (current.has(s.page)) current.delete(s.page); else current.add(s.page);
                        pageInput.value = formatPageList([...current].sort((a, b) => a - b));
                        row.pageText = pageInput.value;
                    }));
                }).catch(() => {});
            };
            bookSelect.onchange = () => {
                collect();
                row.bookId = bookSelect.value;
                if (!bookComponents(BOOK_ATLAS.find(b => b.id === row.bookId) || null).includes(row.component)) row.component = primaryComponent(row);
                drawPicker();
            };
            partSelect.onchange = () => { row.component = partSelect.value; unitFromPage(); enrichRow(); };
            unitInput.oninput = () => { pagesFromUnit(); enrichRow(); };
            pageInput.oninput = unitFromPage;
            get('remove')?.addEventListener('click', () => { collect(); rows.splice(i, 1); drawPicker(); });
            enrichRow();
        });
        chip.querySelector('[data-add]').onclick = () => {
            collect();
            const hasCoursebook = rows.some(r => primaryComponent(r) === 'sb');
            const grammar = BOOK_ATLAS.find(b => b.kind === 'grammar');
            rows.push(hasCoursebook && grammar ? { bookId: grammar.id, component: 'grammar', unit: '', pageText: '', customTitle: '', customTheme: '' }
                : { bookId: BOOK_ATLAS[0].id, component: 'sb', unit: '', pageText: '', customTitle: '', customTheme: '' });
            drawPicker();
        };
        chip.querySelector('[data-cancel]').onclick = () => { picking = false; render(); };
        chip.querySelector('[data-apply]').onclick = () => {
            collect();
            const built = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i], customTitle = (row.customTitle || '').trim();
                if (row.bookId === 'custom' && !customTitle) { chip.querySelector('[data-title="' + i + '"]')?.focus(); return; }
                const pages = parsePages('pp ' + (row.pageText || ''));
                const component = bookComponents(BOOK_ATLAS.find(b => b.id === row.bookId) || null).includes(row.component) ? row.component : primaryComponent(row);
                const unit = Number(row.unit) || (pages.from ? unitForPage(row.bookId, pages.from, component) : null) || null;
                built.push({ bookId: row.bookId, customTitle, customTheme: cleanCampfireText(row.customTheme || '', 120), component,
                    unit, page: pages.from, pageFrom: pages.from, pageTo: pages.to, pages: pages.list, confidence: 'high', needsConfirm: false });
            }
            if (!built.length) return;
            targetsOverride = built; picking = false; confirmed = true;
            confirmations.set(classId, { text: input.value.trim(), targets: built });
            render();
        };
    }
    function picker() {
        picking = true;
        const result = read();
        const seed = (targetsOverride || result.targets || []).filter(t => t && t.bookId);
        rows = (seed.length ? seed : [{}]).map(rowFromTarget);
        setTone('calm');
        drawPicker();
    }
    // Reopening the same modal replaces the old handler rather than accumulating it.
    input.oninput = () => {
        clearTimeout(timer);
        if (confirmed && targetsOverride) confirmations.set(classId, { text: input.value.trim(), targets: targetsOverride });
        timer = setTimeout(render, 300);
    };
    render();
}
