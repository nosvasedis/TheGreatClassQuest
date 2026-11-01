// When next month's stall is painted, and how many shop pictures a day may be painted.
// The whole account shares Workers AI's 10,000 free neurons a day; on 1 Nov 2026 a full
// restock asked for ~240 pictures in 17 minutes and spent the day's allowance. So next
// month's Seasonal Treasures are painted over the last nights of the month (they stay
// hidden: the Market shows only the current monthKey), a little each night.

/** First day of the month (Athens) on which next month's stall starts being painted. */
export const PREPARE_FROM_DAY = 24;

/** Shop pictures a day across every school, unless GCQ_SHOP_DAILY_PICTURES says otherwise. */
export const DEFAULT_DAILY_PICTURES = 80;

// July and August have no lessons, and September opens a new school year (its stall is
// painted on 1 September, under the new year).
const NO_EARLY_STALL_MONTHS = new Set([7, 8, 9]);

export function nextShopMonthKey(monthKey) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ''));
    if (!match) return '';
    let year = Number(match[1]);
    let month = Number(match[2]) + 1;
    if (month > 12) { month = 1; year += 1; }
    return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Next month's stall to paint tonight, or null. `day` and `monthKey` are the Athens shop
 * day and month. `briefDate` is noon on the 1st, so the merchant writes for the start of
 * that month, not "the end of the month".
 */
export function preparationTarget({ day, monthKey, fromDay = PREPARE_FROM_DAY } = {}) {
    if (!Number.isFinite(Number(day)) || Number(day) < fromDay) return null;
    const next = nextShopMonthKey(monthKey);
    if (!next) return null;
    if (NO_EARLY_STALL_MONTHS.has(Number(next.slice(5)))) return null;
    return { monthKey: next, briefDate: new Date(`${next}-01T10:00:00Z`) };
}

export function dailyPictureCap(value) {
    if (value === undefined || value === null || String(value).trim() === '') return DEFAULT_DAILY_PICTURES;
    const cap = Math.floor(Number(value));
    return Number.isFinite(cap) && cap >= 0 ? cap : DEFAULT_DAILY_PICTURES;
}

/**
 * Whether one more shop picture may be painted today. A teacher's own "New picture" or
 * "Replace" is always allowed (one picture, asked for by a person) but still counted.
 */
export function pictureSlotDecision({ used = 0, cap = DEFAULT_DAILY_PICTURES, manual = false } = {}) {
    const count = Math.max(0, Number(used) || 0);
    const allowed = manual || count < cap;
    return { allowed, used: allowed ? count + 1 : count };
}
