// /features/realmMomentsCore.mjs — Team Quest realm moments, pure data and rules.
// The first time each month a class reaches the Silver Peaks, the Golden Citadel or the
// Crystal Realm, the arrival is stamped in the class's Map Journal (classes/<id>.mapJournal),
// shown as a short banner, and given one line in that day's diary.
// Covered by tests/realm-moments.test.mjs.

/** The three realms a class arrives at (Bronze Meadows is where every month starts). */
export const REALM_STOPS = Object.freeze([
    { id: 'silver', minPercent: 30, label: 'Silver Peaks', named: 'the Silver Peaks', icon: '🏔️', cheer: 'The high passes are yours!' },
    { id: 'gold', minPercent: 60, label: 'Golden Citadel', named: 'the Golden Citadel', icon: '🏰', cheer: 'The citadel gates swing open!' },
    { id: 'crystal', minPercent: 85, label: 'Crystal Realm', named: 'the Crystal Realm', icon: '💎', cheer: 'The summit sparkles for you!' }
]);

const STOP_BY_ID = new Map(REALM_STOPS.map((stop) => [stop.id, stop]));

export function getRealmStop(id) {
    return STOP_BY_ID.get(id) || null;
}

const pad = (n) => String(n).padStart(2, '0');

export function realmMonthKey(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function realmDateKey(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Realm ids reached at this monthly progress (0..100), in road order. */
export function realmsReachedAt(pct) {
    const value = Number(pct) || 0;
    return REALM_STOPS.filter((stop) => value >= stop.minPercent).map((stop) => stop.id);
}

/** The journal page for one month: { silver: { date, at, late }, ... } or {}. */
export function journalMonth(classData, monthKey) {
    const page = classData?.mapJournal?.[monthKey];
    return page && typeof page === 'object' ? page : {};
}

/** Realms reached now that this month's journal has not stamped yet. */
export function unstampedRealms(classData, pct, monthKey) {
    const page = journalMonth(classData, monthKey);
    return realmsReachedAt(pct).filter((id) => !page[id]);
}

/** The stored stamp. `late` marks a realm found already reached (not seen live), so the diary skips it. */
export function buildRealmStamp(realmId, { date = new Date(), stars = 0, late = false } = {}) {
    return { realm: realmId, date: realmDateKey(date), at: date.getTime(), stars: Math.round((Number(stars) || 0) * 10) / 10, late: Boolean(late) };
}

/** One line for the diary: "Today we reached the Silver Peaks". */
export function realmDiaryLine(realmId) {
    const stop = getRealmStop(realmId);
    return stop ? `Today we reached ${stop.named}` : '';
}

/** Live (not late) arrivals stamped on one day, road order, for the diary. */
export function realmArrivalsOn(classData, dateKey) {
    const monthKey = String(dateKey || '').slice(0, 7);
    const page = journalMonth(classData, monthKey);
    return REALM_STOPS
        .filter((stop) => page[stop.id] && page[stop.id].date === dateKey && !page[stop.id].late)
        .map((stop) => ({ realm: stop.label, line: realmDiaryLine(stop.id) }));
}

/**
 * The year's journal for one class: one row per month (oldest first) with a cell per realm.
 * `monthKeys` is the school year's months up to now.
 */
export function buildJournalYear(classData, monthKeys = []) {
    return monthKeys.map((monthKey) => {
        const page = journalMonth(classData, monthKey);
        const stamps = REALM_STOPS.map((stop) => ({ ...stop, stamp: page[stop.id] || null }));
        return { monthKey, stamps, reached: stamps.filter((s) => s.stamp).length };
    });
}

/** Totals across the year: how many times each realm was reached. */
export function journalTotals(rows = []) {
    const totals = Object.fromEntries(REALM_STOPS.map((stop) => [stop.id, 0]));
    rows.forEach((row) => row.stamps.forEach((s) => { if (s.stamp) totals[s.id] += 1; }));
    return totals;
}

/** Month keys from a start date to `now` inclusive (at most 13). */
export function monthKeysSince(start, now = new Date()) {
    const keys = [];
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) return [realmMonthKey(now)];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor <= end && keys.length < 13) {
        keys.push(realmMonthKey(cursor));
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return keys.length ? keys : [realmMonthKey(now)];
}
