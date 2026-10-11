/**
 * Ember Oath evidence and readiness. Dependency-free, so the always-loaded Campfire entry points
 * (Adventure Log hearth, My Classes) count "ready" promises exactly as the Oath Board does.
 * Re-exported by emberOathCore.mjs.
 *
 * The whole rule: a promise has a few embers; each lesson day the child keeps it lights one;
 * all lit = ready to keep. A day is lit by a 🔥 "Yes, I tried" check-in (Campfire or board), a
 * moment the teacher saw, or (by itself) a matching virtue star, logged practice or quiz.
 */
/** How many embers a new promise has: 2 for a 1-week promise, 3 for a longer one. */
export const emberTarget = weeks => (Number(weeks) || 2) <= 1 ? 2 : 3;
export function oathDate(value) {
    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
        const local = value.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
        return local ? local[3] + '-' + local[2] + '-' + local[1] : '';
    }
    const d = value?.toDate?.() || (value?.seconds ? new Date(value.seconds * 1000) : value instanceof Date ? value : null);
    return d && !Number.isNaN(d.getTime()) ? [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-') : '';
}
/**
 * A 🔥 "Yes, I tried" check-in (a Campfire seat or the Oath Board) lights that day's ember.
 * It is derived from the check-in, so changing that day's mood takes the moment back. It uses the
 * `manual` kind because the database rules only accept the four stored kinds (a kept promise
 * stores its moments); the `checkin:` refId tells it apart.
 */
export const TRIED_IT_REF = 'checkin:';
export const TRIED_IT_LABEL = 'Tried it';
export const isTriedItMoment = e => e?.kind === 'manual' && String(e.refId || '').startsWith(TRIED_IT_REF);
const STORY_ICON = { virtue: '⭐', practice: '📜', quiz: '❓', manual: '✍️' };
export const emberIcon = e => (isTriedItMoment(e) ? '🔥' : STORY_ICON[e?.kind] || '✨');
export function dedupeEvidence(evidence) {
    const seen = new Set();
    return evidence.filter(e => {
        const key = [e.kind, e.refId || e.label, e.date].join('|');
        if (seen.has(key)) return false;
        seen.add(key); return true;
    }).sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
}
/** One line per lit day, oldest first: { date, icons, text } (e.g. "🔥✍️", "Tried it · Spoke up in English"). */
export function emberStory(days = []) {
    return days.map(d => {
        const items = [...d.items].sort((a, b) => Number(isTriedItMoment(b)) - Number(isTriedItMoment(a))); // the child's own 🔥 first
        return { date: d.date, icons: [...new Set(items.map(emberIcon))].join(''),
            text: [...new Set(items.map(e => String(e.label || '').trim()).filter(Boolean))].join(' · ') };
    });
}
export function evaluateOathEvidence(oath, { awards = [], writtenScores = [], quizzes = [], today = '9999-12-31' } = {}) {
    const inWindow = item => (!item.studentId || item.studentId === oath.studentId) &&
        (!item.schoolYearKey || item.schoolYearKey === oath.schoolYearKey) &&
        (!item.classId || item.classId === oath.classId) &&
        oathDate(item.date || item.createdAt) >= oath.startDate &&
        oathDate(item.date || item.createdAt) <= today;
    const evidence = [...(oath.evidence || []).filter(inWindow)];
    for (const c of oath.checkIns || []) {
        if (c?.mood === 'flame' && typeof c.date === 'string' && inWindow({ date: c.date }))
            evidence.push({ kind: 'manual', label: TRIED_IT_LABEL, date: oathDate(c.date), refId: TRIED_IT_REF + oathDate(c.date) });
    }
    if (oath.evidenceRule === 'virtue') for (const a of awards.filter(inWindow)) {
        if (Number(a.stars) > 0 && String(a.reason).toLowerCase() === String(oath.target.reason).toLowerCase())
            evidence.push({ kind: 'virtue', date: oathDate(a.date), refId: a.id, label: oath.target.reason + ' star' });
    }
    if (oath.evidenceRule === 'practice') for (const s of writtenScores.filter(inWindow))
        evidence.push({ kind: 'practice', date: oathDate(s.date || s.createdAt), refId: s.id, label: 'Practice recorded' });
    if (oath.evidenceRule === 'quiz') for (const q of quizzes.filter(inWindow)) {
        const p = q.results?.studentPerformance?.[oath.studentId];
        if (p?.attemptedCount > 0) evidence.push({ kind: 'quiz', date: oathDate(q.date || q.createdAt), refId: q.id, label: 'Played the Quiz of the Week' });
    }
    const unique = dedupeEvidence(evidence);
    // One ember per lesson day, however much happened that day: a promise grows over lessons.
    const days = [];
    for (const e of unique) {
        if (days.at(-1)?.date !== e.date) days.push({ date: e.date, items: [] });
        days.at(-1).items.push(e);
    }
    const count = days.length, target = Math.max(1, Number(oath.target?.count) || 1);
    return { evidence: unique, days, count, target, progress: Math.min(1, count / target), ready: oath.status === 'active' && count >= target };
}
