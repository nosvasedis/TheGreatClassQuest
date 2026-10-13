/**
 * The monthly star counter (student_scores.monthlyStars) and its month stamp
 * (lastMonthlyResetDate, 'YYYY-MM-01').
 *
 * The counter is reset lazily: it keeps last month's stars until the first star write of a
 * new month archives them to monthly_history/{YYYY-MM} and starts again from 0. Readers
 * (Team Quest, Hero's Challenge, Home) count a counter stamped with another month as 0.
 *
 * Every write that adds stars to this month must therefore roll a stale counter over first.
 * Adding to a stale counter (the old Student Star Manager did) hides the stars from every
 * board, then the next ordinary award files them under the old month and wipes them.
 *
 * Same rule as the readers (utils.js#getClassMonthlyQuestStars,
 * heroRanking.js#currentMonthStarsFromScore): a counter with no stamp counts as this month,
 * so it is only stamped, never archived or zeroed.
 */

/** 'YYYY-MM-01' for the given date (local time). */
export function monthStartOf(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

/** True when the counter holds another month's stars. */
export function isMonthlyCounterStale(scoreData, monthStart) {
    const stamp = scoreData?.lastMonthlyResetDate;
    return Boolean(stamp && monthStart && stamp !== monthStart);
}

/** Month key ('YYYY-MM') a stale counter belongs to. */
export function closingMonthKey(lastMonthlyResetDate, currentMonthStart) {
    if (typeof lastMonthlyResetDate === 'string' && lastMonthlyResetDate.length >= 7) {
        return lastMonthlyResetDate.substring(0, 7);
    }
    const match = String(currentMonthStart || '').match(/^(\d{4})-(\d{2})/);
    if (!match) return null;
    let year = Number(match[1]);
    let month = Number(match[2]) - 1;
    if (month < 1) {
        month = 12;
        year -= 1;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * What the counter needs before this month's stars can be added.
 * @returns {{ stale: boolean, base: number, stamp: object, archive: { month: string, stars: number } | null }}
 *   base: the counter's value for this month before the change (0 when stale);
 *   stamp: fields to write with the change ({} when the counter is already this month's);
 *   archive: last month's stars to file in monthly_history, or null.
 */
export function planMonthlyRollover(scoreData, monthStart) {
    const current = Number(scoreData?.monthlyStars) || 0;
    if (!scoreData || scoreData.lastMonthlyResetDate === monthStart) {
        return { stale: false, base: current, stamp: {}, archive: null };
    }
    if (!isMonthlyCounterStale(scoreData, monthStart)) {
        // No stamp yet: readers already count it as this month, so keep it and stamp it.
        return { stale: false, base: current, stamp: { lastMonthlyResetDate: monthStart }, archive: null };
    }
    const month = closingMonthKey(scoreData.lastMonthlyResetDate, monthStart);
    return {
        stale: true,
        base: 0,
        stamp: { lastMonthlyResetDate: monthStart },
        archive: current > 0 && month ? { month, stars: current } : null,
    };
}
