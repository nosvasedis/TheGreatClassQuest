// features/trialLogCore.mjs
// Pure markup + helpers for the Log New Trial marking board (no state, no DOM globals),
// so the app and the guidebook capture render the exact same rows.

const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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
 * .toggle-absent-btn(.is-absent)[data-was-absent], .bulk-grade-input (value).
 */
export function trialRowHtml({ student, scheme, isAbsent = false, wasAbsent = isAbsent, value = '', note = '', lockAttendance = false }) {
    const name = esc(student?.name || 'Student');
    const initial = esc((student?.name || '?').charAt(0).toUpperCase());
    const avatar = student?.avatar
        ? `<img src="${esc(student.avatar)}" alt="" loading="lazy" decoding="async" class="tl-row__avatar student-avatar">`
        : `<span class="tl-row__avatar tl-row__avatar--initial student-avatar" aria-hidden="true">${initial}</span>`;

    let gradeHtml;
    if (scheme?.mode === 'qualitative') {
        const stamps = (scheme.scale || []).map((entry) => {
            const active = value && String(value) === String(entry.label);
            return `<button type="button" class="tl-stamp tl-ink--${gradeToneForPercent(entry.normalizedPercent)}${active ? ' active' : ''}"
                data-value="${esc(entry.label)}" aria-pressed="${active ? 'true' : 'false'}" ${isAbsent ? 'disabled' : ''}>${esc(entry.label)}</button>`;
        }).join('');
        gradeHtml = `
            <div class="tl-stamps" role="group" aria-label="Grade for ${name}">
                ${stamps}
                <input type="hidden" class="bulk-grade-input" value="${esc(value)}">
            </div>`;
    } else {
        const max = Number(scheme?.maxScore) || 100;
        const band = numericBandFor(value, max);
        gradeHtml = `
            <label class="tl-score">
                <input type="number" inputmode="decimal" class="tl-score__input bulk-grade-input bulk-grade-numeric"
                    placeholder="–" min="0" max="${max}" value="${esc(value)}" ${band ? `data-grade="${band}"` : ''}
                    aria-label="Score for ${name} out of ${max}" ${isAbsent ? 'disabled' : ''}>
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

    return `
        <div class="tl-row bulk-log-item${isAbsent ? ' absent' : ''}${value !== '' && value != null ? ' is-graded' : ''}" data-student-id="${esc(student?.id || '')}">
            <div class="tl-row__who">
                ${avatar}
                <div class="tl-row__id">
                    <p class="tl-row__name">${name}</p>
                    ${note ? `<span class="tl-row__note">${esc(note)}</span>` : attendance}
                    ${note ? attendance : ''}
                </div>
            </div>
            <div class="tl-row__grade grade-input-wrapper">${gradeHtml}</div>
            <span class="tl-row__absent-stamp" aria-hidden="true">Absent</span>
        </div>`;
}

/** The one-line tip beside the legend; it depends on how this trial is graded. */
export function trialTipHtml(scheme) {
    const how = scheme?.mode === 'qualitative'
        ? 'Tap a stamp again to clear it.'
        : 'Press <b class="tl-tip__key">Enter</b> to jump to the next student.';
    return `<i class="fas fa-lightbulb" aria-hidden="true"></i> Tap <b>Present</b> to mark someone absent. ${how}`;
}

/** Counts for the live tally: graded / present / absent. */
export function trialTally(rows) {
    let graded = 0;
    let absent = 0;
    let total = 0;
    rows.forEach((row) => {
        total += 1;
        if (row.absent) absent += 1;
        else if (row.value !== '' && row.value != null) graded += 1;
    });
    return { graded, absent, present: total - absent, total };
}

export function trialTallyText({ graded, absent, present }) {
    const main = present === 0 ? 'Nobody present' : `${graded} of ${present} marked`;
    return absent ? `${main} · ${absent} absent` : main;
}
