// features/scholarFolioCore.mjs
// Pure helpers for the Scholar's Folio (the page that opens when you click a
// scholar on the Honour Roll, in the class roster or from Hero stats).
// No state and no DOM: the modal (ui/modals/studentAnalytics.js) turns the
// app's records into plain entries, and everything it shows is worked out here.
//
// An entry is one graded result:
//   { id, studentId, type: 'test' | 'dictation', title, date, time, pct, display }
// `time` is a timestamp, `pct` the normalized percent (0–100), `display` the
// mark as the class records it ("17/20", "Great!!").

import { competitionRanks, esc, mean, tierForPercent } from './scholarScrollCore.mjs';

export const FOLIO_RANGES = Object.freeze({
    '30d': 'Last 30 days',
    '3m': 'Last 3 months',
    year: 'Whole year'
});

const TYPE_LABEL = { test: 'test', dictation: 'dictation' };

/** Start of a period, as on the Honour Roll; the whole year has no start. */
export function folioRangeStart(range, now = new Date()) {
    if (range === 'year') return null;
    const d = new Date(now.getTime());
    if (range === '30d') {
        d.setDate(d.getDate() - 30);
    } else {
        d.setMonth(d.getMonth() - 3);
        d.setDate(1);
    }
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Tests 60% and dictations 40% when the class uses both, as on the Honour Roll. */
export function overallAverage(testPcts, dictPcts, usage = { tests: true, dictations: true }) {
    const t = mean(testPcts);
    const d = mean(dictPcts);
    if (t !== null && d !== null) {
        if (usage.tests && !usage.dictations) return t;
        if (usage.dictations && !usage.tests) return d;
        return (t * 0.6) + (d * 0.4);
    }
    return t ?? d;
}

export function sessionKey(entry) {
    return `${entry.type}|${entry.date}|${String(entry.title || '').trim().toLowerCase()}`;
}

export function shortDate(time, withYear = false) {
    if (!Number.isFinite(time)) return '';
    const opts = { day: 'numeric', month: 'short' };
    if (withYear) opts.year = 'numeric';
    return new Date(time).toLocaleDateString('en-GB', opts);
}

/** "Unit 3 Test", or "Dictation of 12 Sep" when a trial has no title. */
export function trialName(entry) {
    const title = String(entry?.title || '').trim();
    if (title) return title;
    return `${entry?.type === 'dictation' ? 'Dictation' : 'Test'} of ${shortDate(entry?.time)}`;
}

export function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

const round = (v) => Math.round(v);
const pctText = (v) => `${round(v)}%`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Everything the folio shows for one scholar in one period. */
export function buildFolio({
    studentId,
    firstName = 'This scholar',
    classStudentIds = [],
    entries = [],
    usage = { tests: true, dictations: true, any: true },
    since = null,
    joinedAt = null,
    absenceDates = []
} = {}) {
    const sinceTime = since instanceof Date ? since.getTime() : (Number.isFinite(since) ? since : null);
    const inWindow = entries
        .filter((e) => Number.isFinite(e.pct) && Number.isFinite(e.time))
        .filter((e) => sinceTime === null || e.time >= sinceTime)
        .sort((a, b) => a.time - b.time);

    // One sitting of one paper: everyone's results, the class average and the ranks.
    const sessions = new Map();
    inWindow.forEach((e) => {
        const key = sessionKey(e);
        if (!sessions.has(key)) sessions.set(key, { key, type: e.type, title: e.title, date: e.date, time: e.time, entries: [] });
        sessions.get(key).entries.push(e);
    });
    sessions.forEach((s) => {
        s.entries.sort((a, b) => b.pct - a.pct);
        s.count = s.entries.length;
        s.avg = mean(s.entries.map((e) => e.pct));
        const ranks = competitionRanks(s.entries.map((e) => Math.round(e.pct * 10)));
        s.rankOf = new Map(s.entries.map((e, i) => [e.studentId, ranks[i]]));
        s.rankCount = ranks.reduce((m, r) => m.set(r, (m.get(r) || 0) + 1), new Map());
        s.topCount = s.rankCount.get(1) || 0;
    });

    // Class standing on the overall average.
    const roster = new Set(classStudentIds.length ? classStudentIds : inWindow.map((e) => e.studentId));
    roster.add(studentId);
    const buckets = new Map();
    inWindow.forEach((e) => {
        if (!roster.has(e.studentId)) return;
        if (!buckets.has(e.studentId)) buckets.set(e.studentId, { test: [], dictation: [] });
        buckets.get(e.studentId)[e.type === 'dictation' ? 'dictation' : 'test'].push(e.pct);
    });
    const overallById = new Map();
    buckets.forEach((b, id) => {
        const v = overallAverage(b.test, b.dictation, usage);
        if (v !== null) overallById.set(id, v);
    });
    const graded = [...overallById.entries()].sort((a, b) => b[1] - a[1]);
    const ranks = competitionRanks(graded.map(([, v]) => Math.round(v * 10)));
    const rankIndex = graded.findIndex(([id]) => id === studentId);
    const rank = rankIndex >= 0 ? ranks[rankIndex] : null;
    const tiedWith = rank === null ? 0 : ranks.filter((r) => r === rank).length - 1;

    const mine = buckets.get(studentId) || { test: [], dictation: [] };
    const classTypeAvg = (type) => mean([...buckets.values()].map((b) => mean(b[type])).filter((v) => v !== null));
    const avg = {
        overall: overallById.get(studentId) ?? null,
        test: mean(mine.test),
        dictation: mean(mine.dictation)
    };
    const classAvg = {
        overall: mean([...overallById.values()]),
        test: classTypeAvg('test'),
        dictation: classTypeAvg('dictation')
    };

    // Personal bests are judged against everything known, not just this period,
    // and only once there are at least two earlier results of that kind.
    const bestIds = new Set();
    const maxSoFar = { test: -Infinity, dictation: -Infinity };
    const seen = { test: 0, dictation: 0 };
    entries
        .filter((e) => e.studentId === studentId && Number.isFinite(e.pct) && Number.isFinite(e.time))
        .sort((a, b) => a.time - b.time)
        .forEach((e) => {
            if (seen[e.type] >= 2 && e.pct > maxSoFar[e.type]) bestIds.add(e.id);
            maxSoFar[e.type] = Math.max(maxSoFar[e.type], e.pct);
            seen[e.type] += 1;
        });

    // The scholar's own trials, each set against the paper's class result.
    const trials = inWindow.filter((e) => e.studentId === studentId).map((e, index) => {
        const s = sessions.get(sessionKey(e));
        const classmates = s.count - 1;
        const sessionAvg = classmates > 0 ? s.avg : null;
        const isBest = bestIds.has(e.id);
        const sessionRank = s.rankOf.get(studentId);
        return {
            ...e,
            index,
            name: trialName(e),
            tier: tierForPercent(e.pct),
            classAvg: sessionAvg,
            delta: sessionAvg === null ? null : e.pct - sessionAvg,
            rank: classmates > 0 ? sessionRank : null,
            joint: classmates > 0 && (s.rankCount.get(sessionRank) || 0) > 1,
            of: s.count,
            isBest,
            // A shared first place among many (a row of "Great!!!") is not "top of the class".
            isTop: classmates >= 2 && sessionRank === 1 && s.topCount <= 2
        };
    });

    const pcts = trials.map((t) => t.pct);
    let momentum = null;
    if (pcts.length >= 4) {
        const recent = mean(pcts.slice(-3));
        const earlier = mean(pcts.slice(0, -3));
        momentum = { basis: 'three', recent, earlier, delta: recent - earlier };
    } else if (pcts.length >= 2) {
        const recent = pcts[pcts.length - 1];
        const earlier = mean(pcts.slice(0, -1));
        momentum = { basis: 'latest', recent, earlier, delta: recent - earlier };
    }
    if (momentum) momentum.dir = momentum.delta >= 3 ? 'up' : (momentum.delta <= -3 ? 'down' : 'steady');

    const best = trials.reduce((top, t) => (!top || t.pct >= top.pct ? t : top), null);
    const latest = trials[trials.length - 1] || null;

    // Papers most of the class sat that this scholar has no mark for.
    const classSize = roster.size;
    const quorum = Math.max(2, Math.ceil(classSize * 0.4));
    // Without a join date, count only papers after the scholar's first result here,
    // so a newcomer is not handed every paper the class sat before they arrived.
    const firstOwn = entries.reduce((min, e) => (e.studentId === studentId && Number.isFinite(e.time) ? Math.min(min, e.time) : min), Infinity);
    const joined = joinedAt instanceof Date ? joinedAt.getTime()
        : (Number.isFinite(joinedAt) ? joinedAt : (Number.isFinite(firstOwn) ? firstOwn : Infinity));
    const missed = [...sessions.values()]
        .filter((s) => !s.rankOf.has(studentId) && s.count >= quorum)
        .filter((s) => s.time >= joined - 86400000)
        .sort((a, b) => b.time - a.time)
        .map((s) => ({ key: s.key, type: s.type, title: s.title, date: s.date, time: s.time, name: trialName(s), classAvg: s.avg, count: s.count }));

    const folio = {
        trials,
        missed,
        avg,
        classAvg,
        counts: { test: mine.test.length, dictation: mine.dictation.length, all: trials.length },
        rank,
        rankOf: graded.length,
        tiedWith,
        momentum,
        best,
        latest,
        tier: tierForPercent(avg.overall),
        absences: [...new Set(absenceDates.filter(Boolean))],
        usage
    };
    folio.insights = buildInsights(folio, firstName);
    return folio;
}

/** Plain-English observations, the encouraging ones first. */
export function buildInsights(folio, firstName = 'This scholar') {
    const { trials, missed, avg, classAvg, momentum, latest, absences, usage } = folio;
    const good = [];
    const watch = [];
    const calm = [];
    const name = firstName;

    if (momentum?.basis === 'three' && momentum.delta >= 5) {
        good.push({ icon: 'fa-arrow-trend-up', text: `${name}'s last three trials average ${pctText(momentum.recent)}, ${round(momentum.delta)} points up on the ones before.` });
    } else if (momentum?.basis === 'three' && momentum.delta <= -5) {
        watch.push({ icon: 'fa-arrow-trend-down', text: `${name}'s last three trials average ${pctText(momentum.recent)}, ${round(-momentum.delta)} points down on the ones before.` });
    }

    if (latest?.isBest) {
        good.push({ icon: 'fa-medal', text: `The latest ${TYPE_LABEL[latest.type]}, ${latest.name}, was a personal best at ${pctText(latest.pct)}.` });
    } else if (latest && trials.length >= 3 && !(momentum?.dir === 'down' && momentum.basis === 'three')) {
        const usual = mean(trials.slice(0, -1).map((t) => t.pct));
        if (usual !== null && latest.pct <= usual - 12) {
            watch.push({ icon: 'fa-feather-alt', text: `The latest ${TYPE_LABEL[latest.type]}, ${latest.name}, came in at ${pctText(latest.pct)}, well below ${name}'s usual ${pctText(usual)}.` });
        }
    }

    if (Number.isFinite(avg.overall) && Number.isFinite(classAvg.overall) && folio.rankOf >= 3) {
        const gap = avg.overall - classAvg.overall;
        if (gap >= 5) good.push({ icon: 'fa-chart-line', text: `Working ${round(gap)} points above the class average (${pctText(classAvg.overall)}).` });
        else if (gap <= -8) watch.push({ icon: 'fa-chart-line', text: `Working ${round(-gap)} points below the class average (${pctText(classAvg.overall)}).` });
    }

    const tops = trials.filter((t) => t.isTop);
    if (tops.length) {
        const names = tops.slice(-2).reverse().map((t) => t.name).join(' and ');
        good.push({ icon: 'fa-crown', text: tops.length === 1
            ? `Top of the class in ${names}.`
            : `Top of the class in ${plural(tops.length, 'trial')}, most recently ${names}.` });
    }

    if (usage?.tests && usage?.dictations && folio.counts.test >= 2 && folio.counts.dictation >= 2
        && Number.isFinite(avg.test) && Number.isFinite(avg.dictation) && Math.abs(avg.test - avg.dictation) >= 10) {
        const strongDict = avg.dictation > avg.test;
        calm.push({ icon: 'fa-scale-balanced', text: strongDict
            ? `Stronger in dictations (${pctText(avg.dictation)}) than in tests (${pctText(avg.test)}).`
            : `Stronger in tests (${pctText(avg.test)}) than in dictations (${pctText(avg.dictation)}).` });
    }

    if (missed.length) {
        const names = missed.slice(0, 2).map((m) => m.name).join(' and ');
        watch.push({ icon: 'fa-hourglass-half', text: missed.length === 1
            ? `No mark yet for ${names}, which the class sat.`
            : `No mark yet for ${plural(missed.length, 'trial')} the class sat, including ${names}.` });
    }

    if (absences.length >= 2) {
        watch.push({ icon: 'fa-user-clock', text: `Absent on ${plural(absences.length, 'lesson day')} in the last 30 days.` });
    }

    if (Number.isFinite(avg.overall) && avg.overall < 50 && !watch.some((w) => w.icon === 'fa-chart-line')) {
        watch.push({ icon: 'fa-hands-holding-child', text: `The average sits in the Needs support band (under 50%).` });
    }

    if (!good.length && !watch.length && trials.length >= 2) {
        calm.push({ icon: 'fa-water', text: `A steady record across ${plural(trials.length, 'trial')}, with no big swings.` });
    }

    return [
        ...good.map((i) => ({ ...i, tone: 'good' })),
        ...watch.map((i) => ({ ...i, tone: 'watch' })),
        ...calm.map((i) => ({ ...i, tone: 'calm' }))
    ];
}

/**
 * The journey chart: every trial in order, the class average of the same paper
 * behind it, and the three bands. Built at the container's real pixel width so
 * text and dots stay crisp; returns the point positions for the hover card.
 */
export function journeyChartSvg(trials, { width = 640, height = 220 } = {}) {
    const W = Math.max(240, Math.round(width));
    const H = Math.max(150, Math.round(height));
    const padL = 38;
    const padR = 16;
    const padT = 14;
    const padB = 28;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const y = (v) => padT + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;
    const n = trials.length;
    const x = (i) => (n > 1 ? padL + (i * innerW) / (n - 1) : padL + innerW / 2);
    const f = (v) => Number(v.toFixed(1));

    const points = trials.map((t, i) => ({ x: f(x(i)), y: f(y(t.pct)), index: i }));

    const bands = [
        ['high', 100, 80], ['mid', 80, 50], ['low', 50, 0]
    ].map(([tier, top, bottom]) => `<rect class="sf-chart__band" data-tier="${tier}" x="${padL}" y="${f(y(top))}" width="${innerW}" height="${f(y(bottom) - y(top))}" />`).join('');
    const grid = [100, 80, 50, 0].map((v) => `
        <line class="sf-chart__grid${v === 0 || v === 100 ? ' is-edge' : ''}" x1="${padL}" x2="${W - padR}" y1="${f(y(v))}" y2="${f(y(v))}" />
        <text class="sf-chart__ylabel" x="${padL - 8}" y="${f(y(v) + 4)}" text-anchor="end">${v}%</text>`).join('');

    // Month labels under the first trial of each month, skipping any that would collide.
    let lastLabelX = -Infinity;
    let lastMonth = '';
    const months = trials.map((t, i) => {
        const d = new Date(t.time);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (key === lastMonth) return '';
        lastMonth = key;
        const px = x(i);
        if (px - lastLabelX < 34) return '';
        lastLabelX = px;
        return `<text class="sf-chart__xlabel" x="${f(px)}" y="${H - 8}" text-anchor="${n > 1 && i === 0 ? 'start' : 'middle'}">${d.toLocaleDateString('en-GB', { month: 'short' })}</text>`;
    }).join('');

    // Class average of each paper, broken where nobody else sat it.
    const classRuns = [];
    let run = [];
    trials.forEach((t, i) => {
        if (Number.isFinite(t.classAvg)) run.push(`${f(x(i))},${f(y(t.classAvg))}`);
        else if (run.length) { classRuns.push(run); run = []; }
    });
    if (run.length) classRuns.push(run);
    const classLine = classRuns.map((r) => (r.length > 1
        ? `<polyline class="sf-chart__class" points="${r.join(' ')}" />`
        : `<circle class="sf-chart__class-dot" cx="${r[0].split(',')[0]}" cy="${r[0].split(',')[1]}" r="2.5" />`)).join('')
        + trials.map((t, i) => (Number.isFinite(t.classAvg) && classRuns.some((r) => r.length > 1)
            ? `<circle class="sf-chart__class-dot" cx="${f(x(i))}" cy="${f(y(t.classAvg))}" r="2" />` : '')).join('');

    const linePts = points.map((p) => `${p.x},${p.y}`).join(' ');
    const area = n > 1
        ? `<path class="sf-chart__area" d="M${points[0].x},${f(y(0))} L${points.map((p) => `${p.x},${p.y}`).join(' L')} L${points[n - 1].x},${f(y(0))} Z" />`
        : '';
    const line = n > 1 ? `<polyline class="sf-chart__line" pathLength="1" points="${linePts}" />` : '';

    const dots = trials.map((t, i) => {
        const p = points[i];
        const delay = `style="--i:${Math.min(i, 30)}"`;
        const best = t.isBest ? `<circle class="sf-chart__halo" cx="${p.x}" cy="${p.y}" r="9" />` : '';
        const shape = t.type === 'dictation'
            ? `<rect class="sf-chart__pt" data-tier="${t.tier}" x="${f(p.x - 4.6)}" y="${f(p.y - 4.6)}" width="9.2" height="9.2" rx="1.6" transform="rotate(45 ${p.x} ${p.y})" />`
            : `<circle class="sf-chart__pt" data-tier="${t.tier}" cx="${p.x}" cy="${p.y}" r="5.2" />`;
        return `<g class="sf-chart__mark" data-index="${i}"><g class="sf-chart__pop" ${delay}>${best}${shape}</g></g>`;
    }).join('');

    const label = `Results of ${plural(n, 'trial')} in order, with the class average of each paper`;
    const svg = `<svg class="sf-chart__svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}" focusable="false">
        <defs><linearGradient id="sf-area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="0.13"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
        ${bands}${grid}${months}
        <g class="sf-chart__plot">${area}${classLine}${line}${dots}</g>
        <line class="sf-chart__guide" x1="0" x2="0" y1="${padT}" y2="${padT + innerH}" />
    </svg>`;
    return { svg, points, width: W, height: H };
}

const csvCell = (value) => {
    const s = String(value ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvPct = (v) => (Number.isFinite(v) ? v.toFixed(1) : '');

/** A spreadsheet of the folio: summary lines, then every trial, newest first. */
export function folioCsv({ name = '', className = '', periodLabel = '', folio }) {
    const rows = [
        ['Scholar', name],
        ['Class', className],
        ['Period', periodLabel],
        ['Average %', csvPct(folio.avg.overall)],
        ['Class average %', csvPct(folio.classAvg.overall)],
        ['Place in class', folio.rank ? `${folio.rank} of ${folio.rankOf}` : ''],
        [],
        ['Date', 'Kind', 'Trial', 'Mark', 'Percent', 'Class average %', 'Vs class (points)', 'Place on this paper'],
        ...folio.trials.slice().reverse().map((t) => [
            t.date,
            t.type === 'dictation' ? 'Dictation' : 'Test',
            t.name,
            t.display || '',
            csvPct(t.pct),
            csvPct(t.classAvg),
            Number.isFinite(t.delta) ? (t.delta >= 0 ? '+' : '') + t.delta.toFixed(1) : '',
            t.rank ? `${t.rank} of ${t.of}` : ''
        ])
    ];
    if (folio.missed.length) {
        rows.push([], ['No mark yet for'], ...folio.missed.map((m) => [m.date, m.type === 'dictation' ? 'Dictation' : 'Test', m.name]));
    }
    if (folio.insights.length) {
        rows.push([], ['Notes'], ...folio.insights.map((i) => [i.text]));
    }
    return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

/** Small, safe markdown for Oracle answers: escape first, then a few marks. */
export function oracleMarkdown(text) {
    const lines = esc(String(text || '').replace(/\r/g, '')).split('\n');
    const out = [];
    let list = null;
    const inline = (s) => s
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    lines.forEach((raw) => {
        const line = raw.trimEnd();
        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
        const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
        if (bullet || numbered) {
            const kind = bullet ? 'ul' : 'ol';
            if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; }
            out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
            return;
        }
        closeList();
        if (heading) out.push(`<h4>${inline(heading[1])}</h4>`);
        else if (line.trim()) out.push(`<p>${inline(line.trim())}</p>`);
    });
    closeList();
    return out.join('');
}
