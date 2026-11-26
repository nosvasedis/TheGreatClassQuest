// features/trialHistoryPdfCore.mjs
// Pure model + markup for the Trial History PDF ("The Record Book, bound").
// No state, no DOM: features/trialHistoryPdf.js measures the blocks into A4 pages and prints them.
// Tested in tests/trial-history-pdf-core.test.mjs.

import { esc, formatPct, groupTrialSessions, mean, tierCounts, tierForPercent, trendFor } from './scholarScrollCore.mjs';

/** A4 portrait at 96 dpi: the page the printer measures blocks into. */
export const PDF_PAGE_WIDTH = 794;
export const PDF_PAGE_HEIGHT = 1123;

/** How many papers fit across one marks grid, and how many scholars down one block. */
export const GRID_COLUMNS_PER_BLOCK = 8;
export const GRID_ROWS_PER_BLOCK = 30;
export const SCHOLAR_ROWS_PER_BLOCK = 26;

export const KIND_WORDS = {
    test: { one: 'Test', many: 'Tests' },
    dictation: { one: 'Dictation', many: 'Dictations' }
};

export const LAYOUTS = {
    trial: { label: 'Results by trial', hint: 'Every paper with each scholar’s mark' },
    grid: { label: 'Marks grid', hint: 'One table: scholars down, papers across' },
    scholar: { label: 'Scholar reports', hint: 'Each scholar’s marks, average and trend' }
};

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

/** The Greek school year starts on 1 September. */
export function schoolYearStart(now = new Date()) {
    const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(year, 8, 1);
}

/**
 * Resolve a period choice into { from, to, label }. `from`/`to` are Dates or null (open-ended).
 * Custom bounds are 'YYYY-MM-DD' strings from date inputs; they swap if given back to front.
 */
export function resolvePeriod(period, { now = new Date(), customFrom = '', customTo = '' } = {}) {
    const today = endOfDay(now);
    if (period === 'month') {
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: today, label: monthLabel(now) };
    }
    if (period === '3m') {
        const from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        return { from, to: today, label: `${longDate(from)} – ${longDate(now)}` };
    }
    if (period === 'year') {
        const from = schoolYearStart(now);
        return { from, to: today, label: `School year ${from.getFullYear()}–${String(from.getFullYear() + 1).slice(-2)}` };
    }
    if (period === 'custom') {
        let from = parseYmd(customFrom);
        let to = parseYmd(customTo);
        if (from && to && from > to) [from, to] = [to, from];
        const label = from && to ? `${longDate(from)} – ${longDate(to)}`
            : from ? `From ${longDate(from)}`
                : to ? `Up to ${longDate(to)}` : 'Every record';
        return { from: from ? startOfDay(from) : null, to: to ? endOfDay(to) : null, label };
    }
    return { from: null, to: null, label: 'Every record' };
}

function parseYmd(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
}

export function longDate(date) {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function monthLabel(date) {
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function shortDay(date) {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** First letter for a name badge, without Greek accents ("Ά" → "Α"). */
export function initialOf(name) {
    const first = String(name || '?').trim().charAt(0) || '?';
    return first.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

function clip(text, max) {
    const s = String(text || '').trim();
    return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/**
 * Everything the printed book shows.
 * @param {object} input
 * @param {Array} input.scores       written_scores for the class (any kinds, any dates)
 * @param {Array} input.students     every student the app knows (names for ids)
 * @param {object} input.classData   the class ({ id, name, logo })
 * @param {string[]} input.kinds     ['test'] | ['dictation'] | both
 * @param {{from: Date|null, to: Date|null, label: string}} input.period
 * @param {string|null} input.studentId  one scholar only, or null for the whole class
 * @param {(score) => number|null} input.pctOf
 * @param {(score) => string} input.labelOf
 * @param {(score) => number|null} input.timeOf
 * @param {(score) => boolean} input.isUnmarkable
 */
export function buildTrialHistoryPdfModel({
    scores = [], students = [], classData = {}, kinds = ['test'], period = { from: null, to: null, label: '' },
    studentId = null, pctOf, labelOf, timeOf, isUnmarkable = () => false,
    teacherName = '', schoolName = '', now = new Date()
}) {
    const fromMs = period.from ? period.from.getTime() : -Infinity;
    const toMs = period.to ? period.to.getTime() : Infinity;
    const inPeriod = scores.filter((s) => {
        if (s.classId && classData.id && s.classId !== classData.id) return false;
        if (!kinds.includes(s.type)) return false;
        const t = timeOf(s);
        if (!Number.isFinite(t)) return !period.from && !period.to;
        return t >= fromMs && t <= toMs;
    });

    const studentById = new Map(students.map((s) => [s.id, s]));
    const nameOf = (id) => studentById.get(id)?.name || 'Former scholar';

    const sessionsByKind = {};
    kinds.forEach((kind) => {
        const ofKind = inPeriod.filter((s) => s.type === kind);
        sessionsByKind[kind] = groupTrialSessions(ofKind, timeOf)
            .map((session) => ({
                ...session,
                title: session.title || KIND_WORDS[kind].one,
                scores: studentId ? session.scores.filter((sc) => sc.studentId === studentId) : session.scores
            }))
            .filter((session) => session.scores.length)
            .sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
    });

    // Roster: the class's scholars plus anyone (e.g. moved away) with a result in the period.
    const withResults = new Set(inPeriod.map((s) => s.studentId));
    let roster = students.filter((s) => s.classId === classData.id || withResults.has(s.id));
    const known = new Set(roster.map((s) => s.id));
    withResults.forEach((id) => { if (!known.has(id)) roster.push({ id, name: nameOf(id), former: true }); });
    if (studentId) roster = roster.filter((s) => s.id === studentId);
    roster = roster.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'el', { sensitivity: 'base' }));

    const shown = studentId ? inPeriod.filter((s) => s.studentId === studentId) : inPeriod;
    const pcts = shown.map(pctOf).filter((p) => p !== null && Number.isFinite(p));
    const sessionCount = kinds.reduce((n, k) => n + sessionsByKind[k].length, 0);

    const scholars = roster.map((student) => {
        const own = shown.filter((s) => s.studentId === student.id)
            .sort((a, b) => (timeOf(a) ?? 0) - (timeOf(b) ?? 0));
        const ownPcts = own.map(pctOf).filter((p) => p !== null && Number.isFinite(p));
        const byKind = {};
        kinds.forEach((k) => { byKind[k] = mean(own.filter((s) => s.type === k).map(pctOf)); });
        return { student, scores: own, avg: mean(ownPcts), byKind, trend: trendFor(ownPcts), best: ownPcts.length ? Math.max(...ownPcts) : null };
    });

    const student = studentId ? (studentById.get(studentId) || roster[0] || { id: studentId, name: nameOf(studentId) }) : null;

    return {
        className: classData.name || 'Class',
        classLogo: classData.logo || '📜',
        kinds,
        periodLabel: period.label,
        student,
        teacherName: teacherName || '',
        schoolName: schoolName || '',
        generatedLabel: now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        sessionsByKind,
        sessionCount,
        resultCount: shown.length,
        unmarkableCount: shown.filter(isUnmarkable).length,
        average: mean(pcts),
        tiers: tierCounts(pcts),
        scholars,
        nameOf,
        pctOf,
        labelOf,
        timeOf,
        isUnmarkable
    };
}

/** "3 tests", "1 dictation" or "5 trials" (both kinds). */
export function groupCountLabel(model) {
    const n = model.sessionCount;
    if (model.kinds.length > 1) return `${n} ${n === 1 ? 'trial' : 'trials'}`;
    const words = KIND_WORDS[model.kinds[0]];
    return `${n} ${(n === 1 ? words.one : words.many).toLowerCase()}`;
}

export function kindsLabel(kinds) {
    if (kinds.length > 1) return 'Tests & Dictations';
    return KIND_WORDS[kinds[0]]?.many || 'Trials';
}

// ─── Markup ───────────────────────────────────────────────────────────────

function tierBar(counts) {
    const total = counts.high + counts.mid + counts.low;
    if (!total) return '<span class="thp-bar thp-bar--empty"></span>';
    const seg = (key) => counts[key] ? `<i class="thp-bar__seg thp-bar__seg--${key}" style="flex:${counts[key]}"></i>` : '';
    return `<span class="thp-bar">${seg('high')}${seg('mid')}${seg('low')}</span>`;
}

function markPill(model, score, { withPct = true } = {}) {
    if (!score) return '<span class="thp-mark thp-mark--none">—</span>';
    const unmarkable = model.isUnmarkable(score);
    const pct = model.pctOf(score);
    const label = model.labelOf(score) || (pct !== null ? formatPct(pct, 0) : '—');
    const tier = unmarkable ? 'unmarkable' : tierForPercent(pct);
    const showPct = withPct && pct !== null && /\d\s*\/\s*\d/.test(label);
    return `<span class="thp-mark" data-tier="${tier}"><b>${esc(label)}</b>${showPct ? `<small>${formatPct(pct, 0)}</small>` : ''}</span>`;
}

function avgChip(avg, word = 'average') {
    return `<span class="thp-avg" data-tier="${tierForPercent(avg)}"><b>${avg === null ? '--' : formatPct(avg, 0)}</b><small>${word}</small></span>`;
}

/** The title plate on page one. */
export function coverBlockHtml(model, layout) {
    const counts = model.tiers;
    const forWho = model.student
        ? `<p class="thp-cover__for">Scholar report for <b>${esc(model.student.name)}</b></p>`
        : '';
    const by = [model.teacherName && `Kept by ${esc(model.teacherName)}`, model.schoolName && esc(model.schoolName)].filter(Boolean).join(' · ');
    const stat = (value, label, extra = '') => `<div class="thp-stat${extra}"><b>${value}</b><span>${label}</span></div>`;
    return `
        <header class="thp-cover">
            <div class="thp-cover__band">
                <span class="thp-cover__logo">${esc(model.classLogo)}</span>
                <div class="thp-cover__text">
                    <p class="thp-kicker">Scholar’s Scroll · Record Book</p>
                    <h1 class="thp-cover__title">Trial History</h1>
                    <p class="thp-cover__class">${esc(model.className)}</p>
                </div>
                <div class="thp-cover__seal"><span>${esc(kindsLabel(model.kinds))}</span></div>
            </div>
            <div class="thp-cover__meta">
                <span><i>Period</i>${esc(model.periodLabel)}</span>
                <span><i>Arranged</i>${esc(LAYOUTS[layout]?.label || '')}</span>
                ${by ? `<span><i>Book</i>${by}</span>` : ''}
            </div>
            ${forWho}
            <div class="thp-stats">
                ${stat(model.sessionCount, model.sessionCount === 1 ? (model.kinds.length > 1 ? 'trial' : KIND_WORDS[model.kinds[0]].one.toLowerCase()) : (model.kinds.length > 1 ? 'trials' : KIND_WORDS[model.kinds[0]].many.toLowerCase()))}
                ${stat(model.resultCount, model.resultCount === 1 ? 'result' : 'results')}
                ${stat(model.average === null ? '--' : formatPct(model.average, 0), 'average', ` thp-stat--avg" data-tier="${tierForPercent(model.average)}`)}
                <div class="thp-stat thp-stat--tiers">
                    ${tierBar(counts)}
                    <div class="thp-legend">
                        <span data-tier="high"><i></i>${counts.high} distinguished <em>80%+</em></span>
                        <span data-tier="mid"><i></i>${counts.mid} steady <em>50–79%</em></span>
                        <span data-tier="low"><i></i>${counts.low} need support <em>under 50%</em></span>
                        ${model.unmarkableCount ? `<span data-tier="unmarkable"><i></i>${model.unmarkableCount} could not be marked</span>` : ''}
                    </div>
                </div>
            </div>
        </header>`;
}

function sectionHeadHtml(title, note = '') {
    return `<h2 class="thp-section"><span>${esc(title)}</span>${note ? `<em>${esc(note)}</em>` : ''}</h2>`;
}

function sessionCardHtml(model, session) {
    const d = Number.isFinite(session.time) ? new Date(session.time) : null;
    const pcts = session.scores.map(model.pctOf).filter((p) => p !== null);
    const avg = mean(pcts);
    const rows = [...session.scores]
        .sort((a, b) => model.nameOf(a.studentId).localeCompare(model.nameOf(b.studentId), 'el', { sensitivity: 'base' }))
        .map((score) => {
            const later = score.date !== session.date && Number.isFinite(model.timeOf(score))
                ? `<small class="thp-later">sat ${esc(shortDay(new Date(model.timeOf(score))))}</small>` : '';
            return `<li><span class="thp-name">${esc(model.nameOf(score.studentId))}${later}</span>${markPill(model, score)}</li>`;
        }).join('');
    const single = !!model.student;
    const perColumn = Math.max(1, Math.ceil(session.scores.length / 2));
    return `
        <article class="thp-trial" data-tier="${tierForPercent(avg)}">
            <div class="thp-trial__head">
                <span class="thp-date"><b>${d ? d.getDate() : '?'}</b><small>${d ? d.toLocaleDateString('en-GB', { month: 'short' }) : ''}</small></span>
                <div class="thp-trial__main">
                    <p class="thp-trial__title">${esc(session.title)}</p>
                    <p class="thp-trial__meta">${d ? esc(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : esc(session.date || 'Undated')}${single ? '' : ` · ${session.scores.length} marked${session.makeups ? ` · ${session.makeups} sat it later` : ''}`}</p>
                    ${single ? '' : tierBar(tierCounts(pcts))}
                </div>
                ${single ? markPill(model, session.scores[0]) : avgChip(avg)}
            </div>
            ${single ? '' : `<ul class="thp-results" style="grid-template-rows:repeat(${perColumn},auto)">${rows}</ul>`}
        </article>`;
}

function trialBlocks(model) {
    const blocks = [];
    model.kinds.forEach((kind) => {
        const sessions = model.sessionsByKind[kind];
        if (!sessions.length) return;
        if (model.kinds.length > 1) blocks.push({ html: sectionHeadHtml(KIND_WORDS[kind].many, `${sessions.length} ${sessions.length === 1 ? KIND_WORDS[kind].one.toLowerCase() : KIND_WORDS[kind].many.toLowerCase()}`), keepWithNext: true, kind: 'section' });
        let monthKey = '';
        sessions.forEach((session) => {
            const d = Number.isFinite(session.time) ? new Date(session.time) : null;
            const key = d ? `${d.getFullYear()}-${d.getMonth()}` : 'undated';
            if (key !== monthKey) {
                monthKey = key;
                blocks.push({ html: `<h3 class="thp-month">${esc(d ? monthLabel(d) : 'Undated')}</h3>`, keepWithNext: true, kind: 'month' });
            }
            blocks.push({ html: sessionCardHtml(model, session), kind: 'card' });
        });
    });
    return blocks;
}

function gridBlocks(model) {
    const blocks = [];
    model.kinds.forEach((kind) => {
        const sessions = model.sessionsByKind[kind];
        if (!sessions.length) return;
        blocks.push({ html: sectionHeadHtml(`${KIND_WORDS[kind].many} · marks grid`, `${sessions.length} ${sessions.length === 1 ? 'paper' : 'papers'} · ${model.scholars.length} ${model.scholars.length === 1 ? 'scholar' : 'scholars'}`), keepWithNext: true, kind: 'section' });
        const cellFor = new Map();
        sessions.forEach((session, i) => session.scores.forEach((score) => cellFor.set(`${i}|${score.studentId}`, score)));
        // Balanced slices (9 papers → 5 + 4, never 8 + 1).
        const perBlock = Math.ceil(sessions.length / Math.ceil(sessions.length / GRID_COLUMNS_PER_BLOCK));
        for (let c = 0; c < sessions.length; c += perBlock) {
            const cols = sessions.slice(c, c + perBlock).map((session, j) => ({ session, index: c + j }));
            const last = c + perBlock >= sessions.length;
            for (let r = 0; r < model.scholars.length; r += GRID_ROWS_PER_BLOCK) {
                const rows = model.scholars.slice(r, r + GRID_ROWS_PER_BLOCK);
                const head = cols.map(({ session }) => {
                    const d = Number.isFinite(session.time) ? new Date(session.time) : null;
                    const avg = mean(session.scores.map(model.pctOf));
                    return `<th><span class="thp-gh__date">${d ? esc(shortDay(d)) : '—'}</span><span class="thp-gh__title">${esc(clip(session.title, 16))}</span><span class="thp-gh__avg" data-tier="${tierForPercent(avg)}">${avg === null ? '--' : formatPct(avg, 0)}</span></th>`;
                }).join('');
                const body = rows.map(({ student, byKind }) => `
                    <tr>
                        <th class="thp-grid__name">${esc(student.name)}${student.former ? ' <small>(left)</small>' : ''}</th>
                        ${cols.map(({ index }) => `<td>${markPill(model, cellFor.get(`${index}|${student.id}`), { withPct: false })}</td>`).join('')}
                        ${last ? `<td class="thp-grid__avg">${avgChip(byKind[kind], '')}</td>` : ''}
                    </tr>`).join('');
                const part = sessions.length > perBlock
                    ? `<p class="thp-grid__part">Papers ${c + 1}–${c + cols.length} of ${sessions.length}</p>` : '';
                blocks.push({
                    kind: 'grid',
                    html: `${part}<table class="thp-grid"><thead><tr><th class="thp-grid__corner">Scholar</th>${head}${last ? '<th class="thp-grid__avghead">Average</th>' : ''}</tr></thead><tbody>${body}</tbody></table>`
                });
            }
        }
    });
    return blocks;
}

function scholarBlocks(model, { pageBreaks = false } = {}) {
    const blocks = [];
    const list = model.student ? model.scholars : model.scholars.filter((s) => s.scores.length);
    list.forEach(({ student, scores, avg, byKind, trend, best }, idx) => {
        const trendHtml = trend
            ? `<span class="thp-trend thp-trend--${trend.dir}">${trend.dir === 'up' ? '▲ rising' : trend.dir === 'down' ? '▼ dipping' : '● steady'}</span>` : '';
        const kindAvgs = model.kinds.length > 1
            ? model.kinds.map((k) => `<span>${KIND_WORDS[k].many}: <b>${byKind[k] === null ? '--' : formatPct(byKind[k], 0)}</b></span>`).join('') : '';
        const head = `
            <div class="thp-scholar__head">
                <span class="thp-initial" data-tier="${tierForPercent(avg)}">${esc(initialOf(student.name))}</span>
                <div class="thp-scholar__main">
                    <p class="thp-scholar__name">${esc(student.name)}${student.former ? ' <small>(left the class)</small>' : ''}</p>
                    <p class="thp-scholar__meta">${scores.length} ${scores.length === 1 ? 'result' : 'results'}${best !== null ? ` · best ${formatPct(best, 0)}` : ''} ${kindAvgs} ${trendHtml}</p>
                </div>
                ${avgChip(avg)}
            </div>`;
        if (!scores.length) {
            blocks.push({ kind: 'scholar', pageBreak: pageBreaks && idx > 0, html: `<article class="thp-scholar">${head}<p class="thp-scholar__none">No results in this period.</p></article>` });
            return;
        }
        for (let r = 0; r < scores.length; r += SCHOLAR_ROWS_PER_BLOCK) {
            const rows = scores.slice(r, r + SCHOLAR_ROWS_PER_BLOCK).map((score) => {
                const t = model.timeOf(score);
                const d = Number.isFinite(t) ? new Date(t) : null;
                return `<tr><td class="thp-sr__date">${d ? esc(longDate(d)) : esc(score.date || '')}</td>${model.kinds.length > 1 ? `<td class="thp-sr__kind">${esc(KIND_WORDS[score.type]?.one || '')}</td>` : ''}<td class="thp-sr__title">${esc(score.title || (model.kinds.length > 1 ? '' : KIND_WORDS[score.type]?.one || ''))}</td><td class="thp-sr__mark">${markPill(model, score)}</td></tr>`;
            }).join('');
            blocks.push({
                kind: 'scholar',
                pageBreak: pageBreaks && idx > 0 && r === 0,
                html: `<article class="thp-scholar${r ? ' thp-scholar--cont' : ''}">${r ? `<p class="thp-scholar__cont">${esc(student.name)} · continued</p>` : head}<table class="thp-sr"><tbody>${rows}</tbody></table></article>`
            });
        }
    });
    return blocks;
}

/**
 * The book as a list of blocks, in reading order. The printer packs them into pages:
 * `keepWithNext` blocks (headings) never end a page, `pageBreak` blocks start a fresh one.
 */
export function buildPdfBlocks(model, layout = 'trial', { scholarPerPage = false } = {}) {
    const blocks = [{ html: coverBlockHtml(model, layout), kind: 'cover' }];
    if (!model.resultCount) {
        blocks.push({ kind: 'empty', html: '<p class="thp-empty">No results were recorded in this period.</p>' });
        return blocks;
    }
    if (layout === 'grid') blocks.push(...gridBlocks(model));
    else if (layout === 'scholar') blocks.push(...scholarBlocks(model, { pageBreaks: scholarPerPage }));
    else blocks.push(...trialBlocks(model));
    return blocks;
}

/** The thin header on every page after the first. */
export function runningHeadHtml(model) {
    return `<div class="thp-run"><span>${esc(model.classLogo)} ${esc(model.className)}${model.student ? ` · ${esc(model.student.name)}` : ''}</span><span>Trial History · ${esc(kindsLabel(model.kinds))} · ${esc(model.periodLabel)}</span></div>`;
}

export function pageFootHtml(model, page, pages) {
    return `<div class="thp-foot"><span>The Great Class Quest · printed ${esc(model.generatedLabel)}</span><span>Page ${page} of ${pages}</span></div>`;
}

/** A safe, readable file name: "Trial History - B Ghosts - Tests - Nov 2026.pdf". */
export function pdfFileName(model) {
    const clean = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
    const parts = ['Trial History', clean(model.className), model.student ? clean(model.student.name) : '', clean(kindsLabel(model.kinds).replace('&', 'and')), clean(model.periodLabel.replace(/–/g, '-'))]
        .filter(Boolean);
    return `${parts.join(' - ').slice(0, 150)}.pdf`;
}

