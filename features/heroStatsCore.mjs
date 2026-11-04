// features/heroStatsCore.mjs — pure maths for the Hero Stats record (ui/modals/heroStats.js).
// No DOM, no Firestore, no app imports, so `node --test` can check it directly.

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const monthKeyOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/**
 * The school year as a row of months, oldest first, each with the hero's stars.
 * Past months read the archived `monthly_history` counters; the current month reads the live counter.
 * Without a school-year start the row runs September → June around `today`.
 * @param {object} opts
 * @param {Date|null} [opts.start]   first day of the school year
 * @param {Date|null} [opts.end]     last day of the school year
 * @param {Date} [opts.today]
 * @param {Record<string, number>} [opts.history] 'YYYY-MM' → stars (closed months)
 * @param {number} [opts.currentStars] live stars this month
 * @param {boolean} [opts.loaded] false while past months are still being fetched
 */
export function buildYearMonths({ start = null, end = null, today = new Date(), history = {}, currentStars = 0, loaded = true } = {}) {
    let first;
    if (start instanceof Date && !Number.isNaN(start.getTime())) {
        first = new Date(start.getFullYear(), start.getMonth(), 1);
    } else {
        const y = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
        first = new Date(y, 8, 1);
    }
    let last;
    if (end instanceof Date && !Number.isNaN(end.getTime()) && end >= first) {
        last = new Date(end.getFullYear(), end.getMonth(), 1);
    } else {
        last = new Date(first.getFullYear() + 1, 5, 1); // June
    }
    const nowKey = monthKeyOf(today);
    const months = [];
    for (let d = new Date(first); d <= last && months.length < 12; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        const key = monthKeyOf(d);
        const state = key === nowKey ? 'now' : key < nowKey ? 'past' : 'future';
        let stars = null;
        if (state === 'now') stars = round1(currentStars);
        else if (state === 'past') stars = loaded ? round1(history[key] || 0) : null;
        months.push({ key, short: MONTHS[d.getMonth()], long: MONTHS_LONG[d.getMonth()], year: d.getFullYear(), state, stars, best: false });
    }
    const counted = months.filter((m) => m.stars !== null);
    const max = Math.max(0, ...counted.map((m) => m.stars));
    if (max > 0) {
        // The best month wears the crown (the earliest one if two tie).
        const best = counted.find((m) => m.stars === max);
        if (best) best.best = true;
    }
    const past = months.filter((m) => m.state === 'past' && m.stars !== null);
    const yearSum = round1(counted.reduce((s, m) => s + m.stars, 0));
    const average = past.length ? round1(past.reduce((s, m) => s + m.stars, 0) / past.length) : null;
    return { months, max, best: months.find((m) => m.best) || null, yearSum, average };
}

/** Bar height in % for a month (a small stub for 0 so the column still reads as a month). */
export function monthBarPercent(stars, max) {
    if (stars === null || stars === undefined) return 0;
    if (!(max > 0) || !(stars > 0)) return 4;
    return Math.max(8, Math.round((stars / max) * 100));
}

export const VIRTUE_ORDER = ['teamwork', 'creativity', 'respect', 'focus'];

/**
 * The four virtues as a diamond "rose": teamwork up, creativity right, respect down, focus left.
 * @param {Array<{key:string, stars:number}>} virtues
 * @param {{ size?: number, radius?: number, floor?: number }} [opts]
 */
export function buildVirtueRose(virtues = [], { size = 240, radius = 78, floor = 4 } = {}) {
    const c = size / 2;
    const byKey = new Map((virtues || []).map((v) => [v.key, round1(v.stars)]));
    const max = Math.max(floor, ...VIRTUE_ORDER.map((k) => byKey.get(k) || 0));
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const fmt = (n) => Math.round(n * 10) / 10;
    const points = VIRTUE_ORDER.map((key, i) => {
        const stars = byKey.get(key) || 0;
        const reach = stars > 0 ? Math.max(0.12, Math.min(1, stars / max)) : 0.04;
        const [dx, dy] = dirs[i];
        const len = radius * reach;
        // A compass-rose petal: centre → shoulder → tip → shoulder → centre.
        const w = Math.max(7, len * 0.3);
        const sx = c + dx * len * 0.42;
        const sy = c + dy * len * 0.42;
        const petal = stars > 0
            ? `M${fmt(c)} ${fmt(c)} L${fmt(sx - dy * w)} ${fmt(sy + dx * w)} L${fmt(c + dx * len)} ${fmt(c + dy * len)} L${fmt(sx + dy * w)} ${fmt(sy - dx * w)} Z`
            : '';
        return {
            key,
            stars,
            petal,
            x: fmt(c + dx * radius * reach),
            y: fmt(c + dy * radius * reach),
            tipX: fmt(c + dx * (radius + 22)),
            tipY: fmt(c + dy * (radius + 22)),
        };
    });
    const rings = [1, 2 / 3, 1 / 3].map((f) => {
        const r = radius * f;
        return `${fmt(c)},${fmt(c - r)} ${fmt(c + r)},${fmt(c)} ${fmt(c)},${fmt(c + r)} ${fmt(c - r)},${fmt(c)}`;
    });
    const total = round1(points.reduce((s, p) => s + p.stars, 0));
    const top = total > 0 ? points.slice().sort((a, b) => b.stars - a.stars)[0] : null;
    const tied = top ? points.filter((p) => p.stars === top.stars).length > 1 : false;
    return {
        size,
        center: c,
        radius,
        max,
        points,
        rings,
        polygon: points.map((p) => `${p.x},${p.y}`).join(' '),
        total,
        strongest: top && !tied ? top.key : null,
    };
}

/**
 * Lessons of the last few weeks with the hero's absences marked.
 * @param {string[]} lessonDates  DD-MM-YYYY, oldest first
 * @param {Iterable<string>} absentDates DD-MM-YYYY
 */
export function buildAttendance(lessonDates = [], absentDates = []) {
    const away = new Set(absentDates);
    const dots = lessonDates.map((date) => ({ date, absent: away.has(date) }));
    const absent = dots.filter((d) => d.absent).length;
    const lessons = dots.length;
    return { dots, lessons, absent, present: lessons - absent, rate: lessons ? Math.round(((lessons - absent) / lessons) * 100) : null };
}

/** Hero of the Day legend ladder: 3 Rising, 5 Golden, 10 Mythic. */
export const LEGEND_STEPS = [
    { wins: 3, key: 'rising', label: 'Rising Legend' },
    { wins: 5, key: 'golden', label: 'Golden Legend' },
    { wins: 10, key: 'mythic', label: 'Mythic Legend' },
];

export function buildLegend(wins = 0) {
    const n = Math.max(0, Math.floor(Number(wins) || 0));
    const reached = LEGEND_STEPS.filter((s) => n >= s.wins);
    const tier = reached[reached.length - 1] || null;
    const next = LEGEND_STEPS.find((s) => n < s.wins) || null;
    const from = tier ? tier.wins : 0;
    return {
        wins: n,
        tier,
        next,
        toNext: next ? next.wins - n : 0,
        pct: next ? Math.max(0, Math.min(1, (n - from) / (next.wins - from))) : 1,
        steps: LEGEND_STEPS.map((s) => ({ ...s, reached: n >= s.wins })),
    };
}

/**
 * Points for a small trial sparkline (percent 0–100 over time, oldest first).
 * @param {Array<{percent:number|null, type:string}>} trials
 */
export function buildSparkline(trials = [], { width = 300, height = 90, pad = 10 } = {}) {
    const list = (trials || []).filter((t) => Number.isFinite(t?.percent));
    if (!list.length) return { lines: {}, dots: [], width, height };
    const step = list.length > 1 ? (width - pad * 2) / (list.length - 1) : 0;
    const yOf = (p) => Math.round((pad + (1 - Math.max(0, Math.min(100, p)) / 100) * (height - pad * 2)) * 10) / 10;
    const dots = list.map((t, i) => ({
        x: Math.round((list.length > 1 ? pad + i * step : width / 2) * 10) / 10,
        y: yOf(t.percent),
        type: t.type === 'dictation' ? 'dictation' : 'test',
        percent: Math.round(t.percent),
        title: t.title || '',
        date: t.date || '',
    }));
    const lines = {};
    ['test', 'dictation'].forEach((type) => {
        const own = dots.filter((d) => d.type === type);
        if (own.length > 1) lines[type] = own.map((d) => `${d.x},${d.y}`).join(' ');
    });
    return { lines, dots, width, height, guides: [100, 50, 0].map((p) => ({ p, y: yOf(p) })) };
}
