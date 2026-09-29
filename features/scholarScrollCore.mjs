// features/scholarScrollCore.mjs
// Pure helpers for the Scholar's Scroll tab and the Trial History record book
// (no state, no DOM), so they can be unit-tested and shared.

export const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Performance bands used across the tab: bar colour, legend filters and result pills. */
export const SCROLL_TIERS = [
    { key: 'high', label: 'Distinguished', range: '80%+', min: 80 },
    { key: 'mid', label: 'Steady', range: '50–79%', min: 50 },
    { key: 'low', label: 'Needs support', range: 'under 50%', min: -Infinity }
];

/** A real number, or NaN for null / undefined / '' (Number(null) would be 0). */
const num = (value) => (value === null || value === undefined || value === '' ? NaN : Number(value));

export function tierForPercent(pct) {
    const p = num(pct);
    if (!Number.isFinite(p)) return 'none';
    return SCROLL_TIERS.find((t) => p >= t.min).key;
}

/** "82%" or "82.4%" — drops a trailing .0 so whole numbers read cleanly. */
export function formatPct(value, digits = 1) {
    const n = num(value);
    if (!Number.isFinite(n)) return '--';
    const fixed = n.toFixed(digits);
    return `${fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed}%`;
}

export function mean(values) {
    const nums = (values || []).map(num).filter(Number.isFinite);
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Direction of a scholar's latest result against their earlier average.
 * `values` are normalized percents in chronological order.
 */
export function trendFor(values, threshold = 3) {
    const nums = (values || []).map(num).filter(Number.isFinite);
    if (nums.length < 2) return null;
    const latest = nums[nums.length - 1];
    const prior = mean(nums.slice(0, -1));
    const delta = latest - prior;
    const dir = delta >= threshold ? 'up' : (delta <= -threshold ? 'down' : 'steady');
    return { dir, delta, latest, prior };
}

/** A tiny line of the last few results (0–100 scale), newest on the right. */
export function sparklineSvg(values, { width = 72, height = 24, max = 8 } = {}) {
    const nums = (values || []).map(num).filter(Number.isFinite).slice(-max);
    if (nums.length === 0) return '';
    const pad = 3;
    const w = width - pad * 2;
    const h = height - pad * 2;
    const step = nums.length > 1 ? w / (nums.length - 1) : 0;
    const pts = nums.map((v, i) => {
        const x = nums.length > 1 ? pad + i * step : width / 2;
        const y = pad + h - (Math.max(0, Math.min(100, v)) / 100) * h;
        return [Number(x.toFixed(1)), Number(y.toFixed(1))];
    });
    const last = pts[pts.length - 1];
    const line = pts.length > 1
        ? `<polyline class="ss-spark__line" points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" />`
        : '';
    const dots = pts.slice(0, -1).map(([x, y]) => `<circle class="ss-spark__dot" cx="${x}" cy="${y}" r="1.6" />`).join('');
    return `<svg class="ss-spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true" focusable="false">`
        + `<line class="ss-spark__base" x1="${pad}" x2="${width - pad}" y1="${pad + h / 2}" y2="${pad + h / 2}" />`
        + `${line}${dots}<circle class="ss-spark__now" data-tier="${tierForPercent(nums[nums.length - 1])}" cx="${last[0]}" cy="${last[1]}" r="2.8" /></svg>`;
}

/** Circular gauge (0–100). */
export function ringGaugeSvg(pct, { size = 88, stroke = 9 } = {}) {
    const p = Number.isFinite(num(pct)) ? Math.max(0, Math.min(100, num(pct))) : 0;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const dash = (p / 100) * c;
    return `<svg class="ss-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true" focusable="false">`
        + `<circle class="ss-ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none" />`
        + `<circle class="ss-ring__fill" data-tier="${tierForPercent(pct)}" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"`
        + ` stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${c.toFixed(2)}" style="--ss-ring-c:${c.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})" /></svg>`;
}

/** Counts per tier for a list of percents. */
export function tierCounts(percents) {
    const counts = { high: 0, mid: 0, low: 0 };
    (percents || []).forEach((p) => {
        const t = tierForPercent(p);
        if (counts[t] !== undefined) counts[t] += 1;
    });
    return counts;
}

/** Stacked tier bar (used on each trial in the record book). */
export function tierBarHtml(counts) {
    const total = (counts.high || 0) + (counts.mid || 0) + (counts.low || 0);
    if (!total) return '';
    return `<span class="th-dist" aria-hidden="true">${['high', 'mid', 'low']
        .filter((k) => counts[k])
        .map((k) => `<span class="th-dist__seg" data-tier="${k}" style="flex-grow:${counts[k]}"></span>`)
        .join('')}</span>`;
}

/** Standard competition ranking ("1, 2, 2, 4") for values sorted high → low. */
export function competitionRanks(sortedValues) {
    const ranks = [];
    sortedValues.forEach((v, i) => {
        ranks.push(i > 0 && v === sortedValues[i - 1] ? ranks[i - 1] : i + 1);
    });
    return ranks;
}

/**
 * Groups score records into trial sessions (one sitting of one test/dictation).
 * `timeOf(score)` returns a sortable timestamp or null.
 */
export function groupTrialSessions(scores, timeOf) {
    const sessions = new Map();
    (scores || []).forEach((score) => {
        const title = String(score.title || '').trim();
        const key = `${score.type}|${score.date}|${title.toLowerCase()}`;
        if (!sessions.has(key)) {
            sessions.set(key, { key, type: score.type, date: score.date, title, time: timeOf(score), scores: [] });
        }
        sessions.get(key).scores.push(score);
    });
    return [...sessions.values()];
}
