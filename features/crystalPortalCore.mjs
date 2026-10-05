// features/crystalPortalCore.mjs
// The Crystal Portal: the goal at the end of the Team Quest road (100% of a class's
// own monthly goal). Pure rules for the Portal modal (ui/modals/crystalPortal.js):
// who has stepped through this month and in what order, who waits at the threshold,
// and how often each party opened the Portal this school year. No DOM, no state.
// Covered by tests/crystal-portal.test.mjs.

import { starsToReachPercent } from './teamQuestRace.mjs';

/** The Crystal Realm begins here; parties past it stand at the Portal's threshold. */
export const PORTAL_THRESHOLD_PERCENT = 85;

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function pct(party) {
    return Math.max(0, num(party?.progress));
}

/** A Firestore Timestamp, Date, millis or ISO string as millis (null when unknown). */
export function toMillis(value) {
    if (value == null || value === '') return null;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function monthKeyOf(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Stepping-through time for this month only (a completion from an older month is ignored). */
export function completedThisMonth(completedAt, monthKey) {
    const ms = toMillis(completedAt);
    return ms != null && monthKeyOf(ms) === monthKey ? ms : null;
}

/**
 * Parties that reached the Portal, in the order they stepped through: the recorded
 * time first (earliest wins), then any without a time yet by progress.
 */
export function orderThroughPortal(parties = [], monthKey) {
    return parties
        .filter((p) => pct(p) >= 100)
        .map((p) => ({ ...p, throughAt: completedThisMonth(p.completedAt, monthKey) }))
        .sort((a, b) => {
            if (a.throughAt != null && b.throughAt != null) return a.throughAt - b.throughAt;
            if (a.throughAt != null) return -1;
            if (b.throughAt != null) return 1;
            return pct(b) - pct(a) || String(a.name || '').localeCompare(String(b.name || ''));
        })
        .map((p, index) => ({ ...p, order: index + 1, first: index === 0 && p.throughAt != null }));
}

/** Crystal Realm parties (85–99%), closest first, with the stars each still needs. */
export function partiesAtThreshold(parties = []) {
    return parties
        .filter((p) => pct(p) >= PORTAL_THRESHOLD_PERCENT && pct(p) < 100)
        .map((p) => ({ ...p, starsToGo: Math.max(1, starsToReachPercent(p.stars, p.goal, 100)) }))
        .sort((a, b) => pct(b) - pct(a) || a.starsToGo - b.starsToGo);
}

/**
 * Each party's Portal year: one cell per month (true when it stepped through that month),
 * from the quest_history records plus this month's live progress.
 */
export function buildKeepers(parties = [], history = [], monthKeys = [], currentMonthKey = '') {
    const done = new Set((history || [])
        .filter((row) => row && row.classId && row.monthKey)
        .map((row) => `${row.classId}|${row.monthKey}`));
    return parties
        .map((p) => {
            const months = monthKeys.map((monthKey) => ({
                monthKey,
                done: done.has(`${p.id}|${monthKey}`) || (monthKey === currentMonthKey && pct(p) >= 100),
                current: monthKey === currentMonthKey
            }));
            return { ...p, months, count: months.filter((m) => m.done).length };
        })
        .sort((a, b) => b.count - a.count || pct(b) - pct(a) || String(a.name || '').localeCompare(String(b.name || '')));
}

/** Where one party stands against the Portal. */
export function describeMine(party, through = []) {
    if (!party) return null;
    const p = pct(party);
    const passed = through.find((t) => t.id === party.id);
    if (passed) return { ...party, state: 'through', order: passed.order, first: passed.first, throughAt: passed.throughAt, starsToGo: 0, pct: Math.min(100, p) };
    return {
        ...party,
        state: p >= PORTAL_THRESHOLD_PERCENT ? 'threshold' : 'road',
        starsToGo: Math.max(1, starsToReachPercent(party.stars, party.goal, 100)),
        pct: p
    };
}

/** Everything the Portal modal shows, for one league this month. */
export function buildPortalView({ parties = [], activeClassId = null, history = null, monthKey = '', monthKeys = [] } = {}) {
    const through = orderThroughPortal(parties, monthKey);
    const threshold = partiesAtThreshold(parties);
    const road = parties.filter((p) => pct(p) < PORTAL_THRESHOLD_PERCENT).length;
    const mine = describeMine(parties.find((p) => p.id === activeClassId) || null, through);
    const keepers = Array.isArray(history) ? buildKeepers(parties, history, monthKeys, monthKey) : null;
    const yearOpenings = keepers ? keepers.reduce((sum, k) => sum + k.count, 0) : null;
    return {
        total: parties.length,
        through,
        threshold,
        road,
        mine,
        keepers,
        yearOpenings,
        open: through.length > 0
    };
}
