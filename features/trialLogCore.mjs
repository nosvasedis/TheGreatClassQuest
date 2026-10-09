// features/trialLogCore.mjs
// Pure markup + helpers for the Log New Trial marking board (no state, no DOM globals),
// so the app and the guidebook capture render the exact same rows.

const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** The mark for a trial that could not be marked at all (kept in step with UNMARKABLE_MARK in assessmentConfig.js). */
export const UNMARKABLE_VALUE = '?';

/** Keys that write the unmarkable mark in a score box: "?" and "-" mean the same thing. */
export const UNMARKABLE_KEYS = ['?', '-'];

/**
 * Cleans what was typed into a score box: only digits and one decimal point survive
 * (a comma becomes a point). "?" or "-" anywhere means "could not be marked".
 */
export function sanitizeScoreInput(raw) {
    const text = String(raw ?? '');
    if (UNMARKABLE_KEYS.some((key) => text.includes(key))) return { unmarkable: true, value: '' };
    let seenPoint = false;
    let value = '';
    for (const ch of text.replace(/,/g, '.')) {
        if (ch >= '0' && ch <= '9') value += ch;
        else if (ch === '.' && !seenPoint) {
            seenPoint = true;
            value += ch;
        }
    }
    return { unmarkable: false, value };
}

/** A typed score is valid only as a plain number from 0 up to the paper's maximum. */
export function parseTrialScore(raw, maxScore) {
    const text = String(raw ?? '').trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false, reason: 'not-a-number' };
    const value = Number(text);
    const max = Number(maxScore) || 100;
    if (!Number.isFinite(value) || value < 0) return { ok: false, reason: 'not-a-number' };
    if (value > max) return { ok: false, reason: 'above-max', max };
    return { ok: true, value };
}

/** Ink colour family for a qualitative grade, by its normalized percent. */
export function gradeToneForPercent(pct) {
    const p = Number(pct) || 0;
    if (p >= 90) return 'emerald';
    if (p >= 65) return 'teal';
    if (p >= 40) return 'amber';
    return 'rose';
}

/** Numeric score band used for the red-pen colour of a typed score. */
export function numericBandFor(value, maxScore) {
    const v = parseFloat(value);
    if (Number.isNaN(v) || value === '' || value == null) return '';
    const max = Number(maxScore) || 100;
    if (v > max) return 'over';
    const p = Math.min(100, Math.max(0, Math.round((v / max) * 100)));
    if (p >= 80) return 'high';
    if (p >= 60) return 'good';
    if (p >= 40) return 'mid';
    if (p >= 20) return 'low';
    return 'fail';
}

/** "Today · Tue 29 Sep" style label for a yyyy-mm-dd value. */
export function trialDateLabel(isoDate, todayIso) {
    if (!isoDate) return '--/--/----';
    const [y, m, d] = String(isoDate).split('-').map(Number);
    if (!y || !m || !d) return '--/--/----';
    const date = new Date(y, m - 1, d);
    const pretty = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    if (todayIso && isoDate === todayIso) return `Today · ${pretty}`;
    if (todayIso) {
        const [ty, tm, td] = String(todayIso).split('-').map(Number);
        const diff = Math.round((new Date(ty, tm - 1, td) - date) / 86400000);
        if (diff === 1) return `Yesterday · ${pretty}`;
    }
    const sameYear = todayIso && String(todayIso).slice(0, 4) === String(y);
    return sameYear ? pretty : `${pretty} ${y}`;
}

/** Legend under the sheet heading: the grade stamps, or the score it is out of. */
export function trialScaleLegendHtml(scheme) {
    if (!scheme) return '';
    if (scheme.mode === 'qualitative') {
        const stamps = (scheme.scale || [])
            .map((entry) => `<span class="tl-legend__stamp tl-ink--${gradeToneForPercent(entry.normalizedPercent)}">${esc(entry.label)}</span>`)
            .join('');
        return `<span class="tl-legend__label">Stamps</span>${stamps}`;
    }
    const max = Number(scheme.maxScore) || 100;
    return `<span class="tl-legend__label">Scored</span><span class="tl-legend__score">out of <b>${max}</b></span>`;
}

/**
 * One student's line on the marking sheet.
 * Contract read by handleBulkSaveTrial: .bulk-log-item[data-student-id][data-trial-id?],
 * .toggle-absent-btn(.is-absent)[data-was-absent], .bulk-grade-input (value),
 * .is-unmarkable on the row when the teacher wrote "?" (read the mark with trialRowValue).
 */
export function trialRowHtml({ student, scheme, isAbsent = false, wasAbsent = isAbsent, value = '', note = '', lockAttendance = false }) {
    const unmarkable = !isAbsent && String(value ?? '') === UNMARKABLE_VALUE;
    const name = esc(student?.name || 'Student');
    const initial = esc((student?.name || '?').charAt(0).toUpperCase());
    const avatar = student?.avatar
        ? `<img src="${esc(student.avatar)}" alt="" loading="lazy" decoding="async" class="tl-row__avatar student-avatar">`
        : `<span class="tl-row__avatar tl-row__avatar--initial student-avatar" aria-hidden="true">${initial}</span>`;

    let gradeHtml;
    if (scheme?.mode === 'qualitative') {
        const stamps = (scheme.scale || []).map((entry) => {
            const active = !unmarkable && value && String(value) === String(entry.label);
            return `<button type="button" class="tl-stamp tl-ink--${gradeToneForPercent(entry.normalizedPercent)}${active ? ' active' : ''}"
                data-value="${esc(entry.label)}" aria-pressed="${active ? 'true' : 'false'}" ${isAbsent || unmarkable ? 'disabled' : ''}>${esc(entry.label)}</button>`;
        }).join('');
        gradeHtml = `
            <div class="tl-stamps" role="group" aria-label="Grade for ${name}">
                ${stamps}
                <input type="hidden" class="bulk-grade-input" value="${esc(value)}">
            </div>`;
    } else {
        const max = Number(scheme?.maxScore) || 100;
        const typed = unmarkable ? '' : value;
        const band = numericBandFor(typed, max);
        gradeHtml = `
            <label class="tl-score">
                <input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" maxlength="6" class="tl-score__input bulk-grade-input bulk-grade-numeric"
                    placeholder="${unmarkable ? UNMARKABLE_VALUE : '–'}" data-max="${max}" value="${esc(typed)}" ${band ? `data-grade="${band}"` : ''}
                    aria-label="Score for ${name} out of ${max}" ${isAbsent || unmarkable ? 'disabled' : ''}>
                <span class="tl-score__max">/${max}</span>
            </label>`;
    }

    const attendance = lockAttendance
        ? `<button type="button" class="toggle-absent-btn hidden" tabindex="-1" aria-hidden="true" data-was-absent="false"></button>`
        : `<button type="button" class="tl-attend toggle-absent-btn${isAbsent ? ' is-absent' : ''}" data-was-absent="${wasAbsent ? 'true' : 'false'}"
                aria-pressed="${isAbsent ? 'true' : 'false'}" title="${isAbsent ? 'Mark present' : 'Mark absent'}">
                <i class="fas ${isAbsent ? 'fa-user-slash' : 'fa-user-check'}" aria-hidden="true"></i>
                <span>${isAbsent ? 'Absent' : 'Present'}</span>
            </button>`;

    const unmark = `<button type="button" class="tl-unmark${unmarkable ? ' active' : ''}" data-unmarkable-toggle
                aria-pressed="${unmarkable ? 'true' : 'false'}" ${isAbsent ? 'disabled' : ''}
                title="${unmarkable ? 'Clear the ?' : 'Unmarkable: write ? when this could not be marked'}"
                aria-label="Unmarkable (?) for ${name}">${UNMARKABLE_VALUE}</button>`;

    return `
        <div class="tl-row bulk-log-item${isAbsent ? ' absent' : ''}${unmarkable ? ' is-unmarkable' : ''}${value !== '' && value != null ? ' is-graded' : ''}" data-student-id="${esc(student?.id || '')}">
            <div class="tl-row__who">
                ${avatar}
                <div class="tl-row__id">
                    <p class="tl-row__name">${name}</p>
                    ${note ? `<span class="tl-row__note">${esc(note)}</span>` : attendance}
                    ${note ? attendance : ''}
                </div>
            </div>
            <div class="tl-row__grade grade-input-wrapper">${gradeHtml}${unmark}</div>
            <span class="tl-row__absent-stamp" aria-hidden="true">Absent</span>
        </div>`;
}

/** The one-line tip beside the legend; it depends on how this trial is graded. */
export function trialTipHtml(scheme) {
    const how = scheme?.mode === 'qualitative'
        ? 'Tap a stamp again to clear it.'
        : 'Type <b class="tl-tip__key">?</b> or <b class="tl-tip__key">-</b> for unmarkable. Press <b class="tl-tip__key">Enter</b> to jump to the next student.';
    return `<i class="fas fa-lightbulb" aria-hidden="true"></i> Tap <b>Present</b> to mark someone absent, <b>?</b> if it could not be marked. ${how}`;
}

/** The mark a row holds: "?" when flagged unmarkable, else what was stamped or typed. */
export function trialRowValue({ unmarkable = false, value = '' } = {}) {
    return unmarkable ? UNMARKABLE_VALUE : String(value ?? '');
}

/** Counts for the live tally: graded (a "?" counts as marked) / unmarkable / present / absent. */
export function trialTally(rows) {
    let graded = 0;
    let unmarkable = 0;
    let absent = 0;
    let total = 0;
    rows.forEach((row) => {
        total += 1;
        if (row.absent) absent += 1;
        else if (row.value !== '' && row.value != null) {
            graded += 1;
            if (String(row.value) === UNMARKABLE_VALUE) unmarkable += 1;
        }
    });
    return { graded, unmarkable, absent, present: total - absent, total };
}

export function trialTallyText({ graded, unmarkable = 0, absent, present }) {
    let text = present === 0 ? 'Nobody present' : `${graded} of ${present} marked`;
    if (unmarkable) text += ` · ${unmarkable} unmarkable`;
    if (absent) text += ` · ${absent} absent`;
    return text;
}
