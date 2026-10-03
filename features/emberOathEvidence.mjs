/**
 * Ember Oath evidence and readiness. Dependency-free, so the always-loaded Campfire entry points
 * (Adventure Log hearth, My Classes) count "ready" promises exactly as the Oath Board does.
 * Re-exported by emberOathCore.mjs.
 */
export function oathDate(value) {
    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
        const local = value.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
        return local ? local[3] + '-' + local[2] + '-' + local[1] : '';
    }
    const d = value?.toDate?.() || (value?.seconds ? new Date(value.seconds * 1000) : value instanceof Date ? value : null);
    return d && !Number.isNaN(d.getTime()) ? [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-') : '';
}
export function dedupeEvidence(evidence) {
    const seen = new Set();
    return evidence.filter(e => {
        const key = [e.kind, e.refId || e.label, e.date].join('|');
        if (seen.has(key)) return false;
        seen.add(key); return true;
    }).sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
}
export function evaluateOathEvidence(oath, { awards = [], writtenScores = [], quizzes = [], today = '9999-12-31' } = {}) {
    const inWindow = item => (!item.studentId || item.studentId === oath.studentId) &&
        (!item.schoolYearKey || item.schoolYearKey === oath.schoolYearKey) &&
        (!item.classId || item.classId === oath.classId) &&
        oathDate(item.date || item.createdAt) >= oath.startDate &&
        oathDate(item.date || item.createdAt) <= today;
    const evidence = [...(oath.evidence || []).filter(inWindow)];
    if (oath.evidenceRule === 'virtue') for (const a of awards.filter(inWindow)) {
        if (Number(a.stars) > 0 && String(a.reason).toLowerCase() === String(oath.target.reason).toLowerCase())
            evidence.push({ kind: 'virtue', date: oathDate(a.date), refId: a.id, label: oath.target.reason + ' observed' });
    }
    if (oath.evidenceRule === 'practice') for (const s of writtenScores.filter(inWindow))
        evidence.push({ kind: 'practice', date: oathDate(s.date || s.createdAt), refId: s.id, label: 'Practice recorded' });
    if (oath.evidenceRule === 'quiz') for (const q of quizzes.filter(inWindow)) {
        const p = q.results?.studentPerformance?.[oath.studentId];
        if (p?.attemptedCount > 0) evidence.push({ kind: 'quiz', date: oathDate(q.date || q.createdAt), refId: q.id, label: 'Quiz participation' });
    }
    const unique = dedupeEvidence(evidence);
    const count = unique.length, target = Math.max(1, Number(oath.target?.count) || 1);
    const hasFlame = (oath.checkIns || []).some(c => c.mood === 'flame' && c.date >= oath.startDate && c.date <= today);
    return { evidence: unique, count, target, progress: Math.min(1, count / target), ready: oath.status === 'active' && count >= target && hasFlame, hasFlame };
}
