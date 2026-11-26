// features/trialHistoryPdf.js
// "Bind a copy": the Trial History PDF export. Loaded only when the teacher presses Export PDF
// in the record book (features/scholarScroll.js), together with html2canvas + jsPDF.
// The teacher picks kinds, period, arrangement and scholar; the pages are packed as A4 sheets in
// an off-screen host, painted by html2canvas (browser fonts, so Greek prints as on screen) and
// bound into one PDF. Model + markup: ./trialHistoryPdfCore.mjs.

import '../styles/trial_history_pdf.css';
import { loadPdfTools } from '../utils/lazyLibraries.js';
import { esc } from './scholarScrollCore.mjs';
import {
    LAYOUTS,
    PDF_PAGE_HEIGHT,
    PDF_PAGE_WIDTH,
    buildPdfBlocks,
    buildTrialHistoryPdfModel,
    groupCountLabel,
    pageFootHtml,
    pdfFileName,
    resolvePeriod,
    runningHeadHtml
} from './trialHistoryPdfCore.mjs';

const PERIODS = [
    ['month', 'This month'],
    ['3m', 'Last 3 months'],
    ['year', 'School year'],
    ['all', 'Everything'],
    ['custom', 'Choose dates']
];

const PRINT_FONTS = [
    "700 34px 'Cinzel Decorative'",
    "700 12px 'Cinzel'",
    "400 20px 'Fredoka One'",
    "400 12px 'Open Sans'",
    "600 12px 'Open Sans'",
    "700 12px 'Open Sans'"
];

/** Remembered between openings in this visit (not saved anywhere). */
const prefs = { period: 'month', layout: 'trial', scholarPerPage: false };

let busy = false;

function ymd(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function withTimeout(promise, ms) {
    return Promise.race([Promise.resolve(promise).catch(() => null), new Promise((r) => setTimeout(r, ms))]);
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/**
 * Open the export sheet over the record book.
 * @param {object} ctx
 * @param {HTMLElement} ctx.mount        element the sheet covers (the .th-book)
 * @param {object} ctx.classData
 * @param {string} ctx.view              current tab ('test' | 'dictation')
 * @param {string[]} ctx.kindsAvailable
 * @param {Array} ctx.students
 * @param {() => Array} ctx.loadedScores scores already in memory for this class
 * @param {(from: Date|null) => boolean} ctx.needsArchive
 * @param {() => Promise<Array>} ctx.fetchArchive  every score for the class (fills the book too)
 * @param {Function} ctx.pctOf
 * @param {Function} ctx.labelOf
 * @param {Function} ctx.timeOf
 * @param {Function} ctx.isUnmarkable
 * @param {string} ctx.teacherName
 * @param {string} ctx.schoolName
 * @param {(msg: string, type?: string) => void} ctx.toast
 */
export function openTrialHistoryExport(ctx) {
    const { mount } = ctx;
    if (!mount || mount.querySelector('.thx-veil')) return;
    const kindsAvailable = ctx.kindsAvailable.length ? ctx.kindsAvailable : ['test'];
    const chosen = { kinds: new Set([kindsAvailable.includes(ctx.view) ? ctx.view : kindsAvailable[0]]), studentId: '' };
    const now = new Date();
    const roster = ctx.students
        .filter((s) => s.classId === ctx.classData.id)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'el', { sensitivity: 'base' }));

    const veil = document.createElement('div');
    veil.className = 'thx-veil';
    veil.innerHTML = `
        <div class="thx-sheet" role="dialog" aria-modal="true" aria-labelledby="thx-title">
            <header class="thx-head">
                <span class="thx-head__seal" aria-hidden="true"><i class="fas fa-file-pdf"></i></span>
                <div class="thx-head__text">
                    <p class="thx-head__kicker">${esc(ctx.classData.name || '')} · Record Book</p>
                    <h3 id="thx-title" class="thx-head__title">Bind a copy as PDF</h3>
                </div>
                <button type="button" class="thx-close" data-thx-close aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
            </header>
            <div class="thx-body scrollbar-custom">
                ${kindsAvailable.length > 1 ? `
                <fieldset class="thx-field">
                    <legend class="thx-label">What to include</legend>
                    <div class="thx-chips" data-thx-kinds>
                        ${kindsAvailable.map((k) => `<button type="button" class="thx-chip" data-kind="${k}" aria-pressed="false"><i class="fas ${k === 'dictation' ? 'fa-pen-nib' : 'fa-file-alt'}" aria-hidden="true"></i>${k === 'dictation' ? 'Dictations' : 'Tests'}</button>`).join('')}
                    </div>
                </fieldset>` : ''}
                <fieldset class="thx-field">
                    <legend class="thx-label">Which dates</legend>
                    <div class="thx-chips" data-thx-periods>
                        ${PERIODS.map(([key, label]) => `<button type="button" class="thx-chip" data-period="${key}" aria-pressed="false">${label}</button>`).join('')}
                    </div>
                    <div class="thx-dates hidden" data-thx-dates>
                        <label>From<input type="date" data-thx-from value="${ymd(new Date(now.getFullYear(), now.getMonth(), 1))}" max="${ymd(now)}"></label>
                        <label>To<input type="date" data-thx-to value="${ymd(now)}"></label>
                    </div>
                </fieldset>
                <fieldset class="thx-field">
                    <legend class="thx-label">Arrange the pages</legend>
                    <div class="thx-layouts" data-thx-layouts>
                        ${Object.entries(LAYOUTS).map(([key, { label, hint }]) => `
                            <button type="button" class="thx-layout" data-layout="${key}" aria-pressed="false">
                                <span class="thx-mini thx-mini--${key}" aria-hidden="true"><i></i><i></i><i></i></span>
                                <span><b>${label}</b><small>${hint}</small></span>
                            </button>`).join('')}
                    </div>
                    <label class="thx-check hidden" data-thx-perpage><input type="checkbox" data-thx-perpage-box> Start each scholar on a new page</label>
                </fieldset>
                <fieldset class="thx-field">
                    <legend class="thx-label">Scholars</legend>
                    <select class="thx-select" data-thx-student aria-label="Scholars to include">
                        <option value="">The whole class (${roster.length})</option>
                        ${roster.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}
                    </select>
                </fieldset>
            </div>
            <footer class="thx-foot">
                <p class="thx-count" data-thx-count aria-live="polite"></p>
                <button type="button" class="thx-go" data-thx-go>
                    <span class="thx-go__fill" aria-hidden="true"></span>
                    <i class="fas fa-feather-alt" aria-hidden="true"></i><span data-thx-go-label>Bind the PDF</span>
                </button>
            </footer>
        </div>`;
    mount.appendChild(veil);

    const $ = (sel) => veil.querySelector(sel);
    const fromInput = $('[data-thx-from]');
    const toInput = $('[data-thx-to]');
    const goBtn = $('[data-thx-go]');

    const period = () => resolvePeriod(prefs.period, { now: new Date(), customFrom: fromInput.value, customTo: toInput.value });
    const kinds = () => kindsAvailable.filter((k) => chosen.kinds.has(k));

    const modelFrom = (scores) => buildTrialHistoryPdfModel({
        scores,
        students: ctx.students,
        classData: ctx.classData,
        kinds: kinds(),
        period: period(),
        studentId: chosen.studentId || null,
        pctOf: ctx.pctOf,
        labelOf: ctx.labelOf,
        timeOf: ctx.timeOf,
        isUnmarkable: ctx.isUnmarkable,
        teacherName: ctx.teacherName,
        schoolName: ctx.schoolName
    });

    const refresh = () => {
        veil.querySelectorAll('[data-kind]').forEach((b) => {
            const on = chosen.kinds.has(b.dataset.kind);
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', String(on));
        });
        veil.querySelectorAll('[data-period]').forEach((b) => {
            const on = b.dataset.period === prefs.period;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', String(on));
        });
        veil.querySelectorAll('[data-layout]').forEach((b) => {
            const on = b.dataset.layout === prefs.layout;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', String(on));
        });
        $('[data-thx-dates]').classList.toggle('hidden', prefs.period !== 'custom');
        $('[data-thx-perpage]').classList.toggle('hidden', prefs.layout !== 'scholar' || !!chosen.studentId);
        $('[data-thx-perpage-box]').checked = prefs.scholarPerPage;

        const p = period();
        const model = modelFrom(ctx.loadedScores());
        const archive = ctx.needsArchive(p.from);
        const countEl = $('[data-thx-count]');
        const empty = !model.resultCount && !archive;
        countEl.classList.toggle('is-empty', empty);
        countEl.innerHTML = model.resultCount
            ? `<b>${groupCountLabel(model)}</b> · <b>${model.resultCount}</b> result${model.resultCount === 1 ? '' : 's'}<small>${esc(p.label)}${archive ? ' · older records will be fetched from the archive' : ''}</small>`
            : archive
                ? `Nothing loaded yet for this period<small>${esc(p.label)} · the archive will be checked when you bind</small>`
                : `No results in this period<small>${esc(p.label)}</small>`;
        goBtn.setAttribute('aria-disabled', String(empty || !kinds().length));
    };

    const close = () => {
        if (busy) return;
        veil.classList.add('is-leaving');
        document.removeEventListener('keydown', onKey, true);
        setTimeout(() => veil.remove(), 180);
    };
    const onKey = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); }
    };
    document.addEventListener('keydown', onKey, true);

    veil.addEventListener('click', (e) => {
        if (e.target === veil || e.target.closest('[data-thx-close]')) { close(); return; }
        const kindBtn = e.target.closest('[data-kind]');
        if (kindBtn) {
            const k = kindBtn.dataset.kind;
            if (chosen.kinds.has(k) && chosen.kinds.size > 1) chosen.kinds.delete(k);
            else chosen.kinds.add(k);
            refresh();
            return;
        }
        const periodBtn = e.target.closest('[data-period]');
        if (periodBtn) { prefs.period = periodBtn.dataset.period; refresh(); return; }
        const layoutBtn = e.target.closest('[data-layout]');
        if (layoutBtn) { prefs.layout = layoutBtn.dataset.layout; refresh(); return; }
        if (e.target.closest('[data-thx-go]')) bind();
    });
    $('[data-thx-perpage-box]').addEventListener('change', (e) => { prefs.scholarPerPage = e.target.checked; });
    $('[data-thx-student]').addEventListener('change', (e) => { chosen.studentId = e.target.value; refresh(); });
    fromInput.addEventListener('change', refresh);
    toInput.addEventListener('change', refresh);

    const setGo = (label, fraction = null) => {
        $('[data-thx-go-label]').textContent = label;
        $('.thx-go__fill').style.width = fraction === null ? '0' : `${Math.round(fraction * 100)}%`;
    };

    async function bind() {
        if (busy || goBtn.getAttribute('aria-disabled') === 'true') return;
        busy = true;
        goBtn.disabled = true;
        const icon = goBtn.querySelector('.fas');
        icon.className = 'fas fa-spinner fa-spin';
        try {
            const p = period();
            setGo('Gathering the records…', 0.05);
            const [scores] = await Promise.all([
                ctx.needsArchive(p.from) ? ctx.fetchArchive() : Promise.resolve(ctx.loadedScores()),
                loadPdfTools()
            ]);
            const model = modelFrom(scores);
            if (!model.resultCount) {
                ctx.toast('No results were recorded in this period.', 'info');
                return;
            }
            const blocks = buildPdfBlocks(model, prefs.layout, { scholarPerPage: prefs.scholarPerPage && !chosen.studentId });
            await printPdf(model, blocks, (done, total) => setGo(`Binding page ${done} of ${total}…`, 0.1 + 0.85 * (done / total)));
            setGo('Done!', 1);
            ctx.toast('Your Trial History PDF is ready.', 'success');
            busy = false;
            close();
        } catch (err) {
            console.error('Trial History PDF failed:', err);
            ctx.toast('Could not make the PDF. Please try again.', 'error');
        } finally {
            busy = false;
            goBtn.disabled = false;
            icon.className = 'fas fa-feather-alt';
            if (veil.isConnected) { setGo('Bind the PDF'); refresh(); }
        }
    }

    refresh();
    requestAnimationFrame(() => goBtn.focus({ preventScroll: true }));
}

/** Pack blocks into A4 pages off screen; returns the host and page elements. */
export async function layoutPages(model, blocks) {
    const host = document.createElement('div');
    host.className = 'thp-host';
    host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
    // Fonts load lazily: ask for every face the pages use (with a Greek letter) before measuring.
    if (document.fonts?.load) {
        await withTimeout(Promise.all(PRINT_FONTS.map((f) => document.fonts.load(f, 'Aα').catch(() => null))), 3000);
    }
    await withTimeout(document.fonts?.ready, 2500);

    const pages = [];
    const newPage = () => {
        const page = document.createElement('section');
        page.className = 'thp-page';
        page.innerHTML = `<span class="thp-frame"></span>${pages.length ? runningHeadHtml(model) : ''}<div class="thp-body"></div><div class="thp-foot-slot"></div>`;
        host.appendChild(page);
        pages.push(page);
        return page.querySelector('.thp-body');
    };
    const overflows = (body) => body.scrollHeight > body.clientHeight + 1;
    const make = (block) => {
        const el = document.createElement('div');
        el.className = 'thp-block';
        if (block.keepWithNext) el.dataset.keep = '1';
        el.innerHTML = block.html;
        return el;
    };

    // Reserve the footer's height before measuring.
    let body = newPage();
    pages[0].querySelector('.thp-foot-slot').outerHTML = pageFootHtml(model, 1, 1);
    for (const block of blocks) {
        if (block.pageBreak && body.children.length) {
            body = newPage();
            pages[pages.length - 1].querySelector('.thp-foot-slot').outerHTML = pageFootHtml(model, 1, 1);
        }
        const el = make(block);
        body.appendChild(el);
        if (overflows(body) && body.children.length > 1) {
            el.remove();
            const carry = [];
            while (body.children.length > 1 && body.lastElementChild?.dataset.keep === '1') {
                carry.unshift(body.lastElementChild);
                body.lastElementChild.remove();
            }
            body = newPage();
            pages[pages.length - 1].querySelector('.thp-foot-slot').outerHTML = pageFootHtml(model, 1, 1);
            carry.forEach((c) => body.appendChild(c));
            body.appendChild(el);
        }
    }
    pages.forEach((page, i) => {
        page.querySelector('.thp-foot').outerHTML = pageFootHtml(model, i + 1, pages.length);
    });
    return { host, pages };
}

async function printPdf(model, blocks, onProgress) {
    const { html2canvas, jsPDF } = await loadPdfTools();
    const { host, pages } = await layoutPages(model, blocks);
    try {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        const w = pdf.internal.pageSize.getWidth();
        const h = pdf.internal.pageSize.getHeight();
        for (let i = 0; i < pages.length; i += 1) {
            onProgress?.(i + 1, pages.length);
            await nextFrame();
            const canvas = await html2canvas(pages[i], {
                scale: 2,
                backgroundColor: '#fffcf4',
                logging: false,
                width: PDF_PAGE_WIDTH,
                height: PDF_PAGE_HEIGHT,
                windowWidth: PDF_PAGE_WIDTH
            });
            if (i > 0) pdf.addPage('a4', 'portrait');
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h, undefined, 'FAST');
            canvas.width = 0;
            canvas.height = 0;
        }
        pdf.setProperties({ title: pdfFileName(model).replace(/\.pdf$/, ''), creator: 'The Great Class Quest' });
        pdf.save(pdfFileName(model));
    } finally {
        host.remove();
    }
}
