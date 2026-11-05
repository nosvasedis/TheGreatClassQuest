// Phone Home: today's lessons as a timeline (what is on now, what comes next, what is done).
// Pure: no app state, so tests/mobile-home-timeline.test.js can check it with a fixed clock.

/** "09:40" → 580 minutes after midnight; anything unreadable → null. */
export function clockMinutes(text) {
    const m = /^\s*(\d{1,2})[:.](\d{2})/.exec(String(text || ''));
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
}

/** 25 → "25 min", 75 → "1 h 15", 120 → "2 h". */
export function formatSpan(minutes) {
    const m = Math.max(0, Math.round(Number(minutes) || 0));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h} h ${rest}` : `${h} h`;
}

/**
 * Orders today's lessons by start time and marks each one past, now or later; the first
 * later lesson (or the first lesson once all are later) is the "next" one.
 * @param {{ id: string, timeStart?: string, timeEnd?: string }[]} classes
 * @param {Date} now
 * @returns {{ cls: object, status: 'past'|'now'|'later', next: boolean, start: number|null, end: number|null, label: string, progress: number }[]}
 */
export function describeLessonTimeline(classes, now = new Date()) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const rows = (classes || []).map((cls) => {
        const start = clockMinutes(cls.timeStart);
        let end = clockMinutes(cls.timeEnd);
        if (start != null && (end == null || end <= start)) end = start + 60;
        let status = 'later';
        if (start != null && end != null) {
            if (nowMin >= end) status = 'past';
            else if (nowMin >= start) status = 'now';
        }
        return { cls, status, next: false, start, end, label: '', progress: 0 };
    }).sort((a, b) => (a.start ?? 9999) - (b.start ?? 9999));

    const firstLater = rows.find((r) => r.status === 'later' && r.start != null);
    if (firstLater && !rows.some((r) => r.status === 'now')) firstLater.next = true;

    rows.forEach((r) => {
        if (r.status === 'now') {
            r.label = `${formatSpan(r.end - nowMin)} left`;
            r.progress = Math.min(1, Math.max(0, (nowMin - r.start) / Math.max(1, r.end - r.start)));
        } else if (r.status === 'later' && r.start != null) {
            r.label = r.next ? `in ${formatSpan(r.start - nowMin)}` : '';
        } else if (r.status === 'past') {
            r.label = 'Done';
        }
    });
    return rows;
}
