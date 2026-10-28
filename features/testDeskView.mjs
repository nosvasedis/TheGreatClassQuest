/**
 * Test Desk markup (Scholar's Scroll): one card for the test that is coming up or waiting
 * for marks, and every marked test someone still owes a makeup for.
 * Pure: no state, no DOM. Rules live in testDeskCore.mjs; wiring in scholarScroll.js.
 * DOM hooks scholarScroll.js relies on: .ss-testdesk-toggle, .ss-testdesk-log, .makeup-trigger,
 * .makeup-dismiss-btn (data-student-id / data-title / data-type), .scroll-makeup-item.
 */
import { paperProgress, testDeskSummary } from './testDeskCore.mjs';

const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function dayFromKey(dayKey) {
    const [y, m, d] = String(dayKey || '').split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
}

/** Torn calendar leaf: weekday, day, month. */
function dateLeafHtml(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return '<span class="ss-slip__leaf" aria-hidden="true"><b>?</b></span>';
    }
    return `<span class="ss-slip__leaf" aria-hidden="true">
            <small>${esc(date.toLocaleDateString('en-GB', { weekday: 'short' }))}</small>
            <b>${date.getDate()}</b>
            <small>${esc(date.toLocaleDateString('en-GB', { month: 'short' }))}</small>
        </span>`;
}

function scheduledSlipHtml(test) {
    return `
        <section class="ss-slip ss-slip--test" data-tone="${esc(test.tone || 'amber')}">
            ${dateLeafHtml(test.date)}
            <div class="ss-slip__main">
                <p class="ss-slip__kicker"><i class="fas fa-${esc(test.icon || 'clock')}" aria-hidden="true"></i><span>${esc(test.statusLabel)}</span><em>${esc(test.chipLabel)}</em></p>
                <h4 class="ss-slip__title">${esc(test.title || 'Scheduled test')}</h4>
                ${test.detailLabel ? `<p class="ss-slip__meta"><i class="far fa-calendar" aria-hidden="true"></i> ${esc(test.detailLabel)}</p>` : ''}
                ${test.curriculum ? `<p class="ss-slip__topics"><b>Topics</b> ${esc(test.curriculum)}</p>` : ''}
                ${test.hint ? `<p class="ss-slip__hint">${esc(test.hint)}</p>` : ''}
            </div>
            ${test.canLog ? `<button type="button" class="ss-btn ss-btn--seal ss-slip__cta ss-testdesk-log"><i class="fas fa-feather-alt" aria-hidden="true"></i> Log results</button>` : ''}
        </section>`;
}

function makeupRowHtml(entry, group, avatar, { current = true, position = '' } = {}) {
    const { student, absent } = entry;
    const day = dayFromKey(group.dayKey);
    const dayText = day ? day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
    const why = absent ? `Absent ${dayText}`.trim() : 'No mark yet';
    return `
        <li class="scroll-makeup-item ss-makeup${absent ? ' is-absent' : ''}${current ? ' is-current' : ''}"${current ? '' : ' hidden'}${position ? ` aria-label="${esc(position)}"` : ''}>
            ${avatar(student)}
            <span class="ss-makeup__who">
                <span class="ss-makeup__name">${esc(student.name)}</span>
                <span class="ss-makeup__why"><i class="fas fa-${absent ? 'user-slash' : 'pen-nib'}" aria-hidden="true"></i>${esc(why)}</span>
            </span>
            <button type="button" class="makeup-trigger ss-makeup__log"
                data-student-id="${esc(student.id)}" data-title="${esc(group.title)}" data-type="test"
                title="Log ${esc(student.name)}'s makeup mark" aria-label="Log ${esc(student.name)}'s makeup mark">
                <i class="fas fa-feather-alt" aria-hidden="true"></i><span>Log makeup</span>
            </button>
            <button type="button" class="makeup-dismiss-btn ss-makeup__dismiss"
                data-student-id="${esc(student.id)}" data-title="${esc(group.title)}" data-type="test"
                title="No makeup needed" aria-label="No makeup needed for ${esc(student.name)}">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
        </li>`;
}

/**
 * Who still owes the paper. Several names sit one at a time behind ‹ › arrows
 * (and dots), so a long list never stretches the page.
 */
function makeupListHtml(group, avatar, page = 0) {
    const owed = group.missing.length;
    if (owed <= 1) {
        return `<ul class="ss-makeup-list">${group.missing.map((entry) => makeupRowHtml(entry, group, avatar)).join('')}</ul>`;
    }
    const at = Math.min(Math.max(0, Number(page) || 0), owed - 1);
    const rows = group.missing.map((entry, i) => makeupRowHtml(entry, group, avatar, {
        current: i === at,
        position: `${i + 1} of ${owed}: ${entry.student.name}`
    })).join('');
    // Past eight names the dots would crowd; the "3 of 12" count says it all.
    const dots = owed > 8 ? '' : group.missing.map((entry, i) => `<button type="button" class="ss-makeup-dot${i === at ? ' is-current' : ''}" data-page="${i}"
            aria-label="Show ${esc(entry.student.name)}"${i === at ? ' aria-current="true"' : ''}></button>`).join('');
    return `
        <div class="ss-makeup-pager" data-group="${esc(group.key)}" data-page="${at}" data-count="${owed}">
            <ul class="ss-makeup-list" aria-live="polite">${rows}</ul>
            <div class="ss-makeup-nav">
                <button type="button" class="ss-makeup-step" data-step="-1" aria-label="Previous scholar"${at === 0 ? ' disabled' : ''}><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                <span class="ss-makeup-dots">${dots}</span>
                <span class="ss-makeup-count"><b>${at + 1}</b> of ${owed}</span>
                <button type="button" class="ss-makeup-step" data-step="1" aria-label="Next scholar"${at === owed - 1 ? ' disabled' : ''}><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
            </div>
        </div>`;
}

function makeupSlipHtml(group, avatar, page = 0) {
    const progress = paperProgress(group.sat, group.expected);
    const owed = group.missing.length;
    return `
        <section class="ss-slip ss-slip--makeup" data-tone="amber">
            ${dateLeafHtml(dayFromKey(group.dayKey))}
            <div class="ss-slip__main">
                <p class="ss-slip__kicker"><i class="fas fa-check-double" aria-hidden="true"></i><span>Marked</span><em>${owed} makeup${owed === 1 ? '' : 's'}</em></p>
                <h4 class="ss-slip__title">${esc(group.title)}</h4>
                ${group.announcedAs ? `<p class="ss-slip__meta"><i class="fas fa-bullhorn" aria-hidden="true"></i> Announced as <b>${esc(group.announcedAs)}</b></p>` : ''}
                <div class="ss-slip__progress">
                    <span class="ss-slip__meter" role="progressbar" aria-label="${esc(progress.label)}"
                        aria-valuemin="0" aria-valuemax="${group.expected}" aria-valuenow="${group.sat}">
                        <span style="width:${progress.percent}%"></span>
                    </span>
                    <span class="ss-slip__count">${esc(progress.label)}</span>
                </div>
                ${makeupListHtml(group, avatar, page)}
            </div>
        </section>`;
}

/**
 * @param {object} model
 * @param {object|null} model.scheduled  { title, statusLabel, chipLabel, detailLabel, tone, icon, curriculum, date, canLog, hint }
 * @param {Array} model.groups           from buildMakeupGroups
 * @param {boolean} [model.collapsed]
 * @param {(student: object) => string} [model.avatar]
 * @param {Map<string, number>} [model.pages] makeup pager position per group key
 * @returns {{ html: string, tone: string }}
 */
export function testDeskHtml({ scheduled = null, groups = [], collapsed = false, avatar = () => '', pages = new Map() }) {
    const makeups = groups.reduce((n, g) => n + g.missing.length, 0);
    const toMark = !!scheduled?.canLog;
    const summary = testDeskSummary({ toMark, upcoming: !!scheduled && !toMark, makeups });
    const tone = toMark ? (scheduled.tone || 'orange') : (makeups ? 'amber' : (scheduled?.tone || 'amber'));
    const icon = toMark ? 'clipboard-check' : (makeups ? 'hourglass-half' : (scheduled?.icon || 'clock'));
    const help = makeups
        ? 'Log a makeup when they sit it, or tap × if none is needed.'
        : (toMark ? 'Anyone you leave out becomes a makeup, listed here.' : 'Announced on the Quest Board.');
    const collapsible = makeups > 0;
    const folded = collapsible && collapsed;

    const html = `
        <header class="ss-testdesk__bar">
            <span class="ss-notice__seal" aria-hidden="true"><i class="fas fa-${esc(icon)}"></i></span>
            <div class="ss-notice__body">
                <p class="ss-notice__kicker"><span>Test desk</span></p>
                <h4 class="ss-notice__title">${esc(summary)}</h4>
                <p class="ss-notice__text">${esc(help)}</p>
            </div>
            ${collapsible ? `<button type="button" class="ss-btn ss-btn--ghost ss-testdesk-toggle" aria-expanded="${!folded}" aria-controls="ss-testdesk-slips">
                <span>${folded ? 'Show' : 'Hide'}</span><i class="fas fa-chevron-down" aria-hidden="true"></i>
            </button>` : ''}
        </header>
        <div class="ss-testdesk__slips" id="ss-testdesk-slips">
            ${scheduled ? scheduledSlipHtml(scheduled) : ''}
            ${groups.map((g) => makeupSlipHtml(g, avatar, pages.get(g.key))).join('')}
        </div>`;
    return { html, tone, folded };
}
