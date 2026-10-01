// features/ceremonyStarCheck.js — does a class have anything to celebrate?
//
// A Ceremony of the Month only makes sense when the class actually earned
// stars that month. Award logs are the truth: undoing stars (tapping a star
// off, or deleting the log) removes the log, so test stars that were taken
// back leave nothing behind. A class whose surviving logs add up to zero (or
// less) has no ceremony to hold.
//
// One school-wide month fetch answers every class at once. Positive answers
// are kept on the device for good (a finished month rarely loses all its
// stars); negative answers are re-checked after a few hours so late awards
// still open the ceremony.

import { getAwardLogMonthlyStarCredit } from './awardLogReasonMeta.js';

const STORAGE_PREFIX = 'gcq.ceremonyStars.';
const NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000;

const memory = new Map();   // monthKey -> { at, positive: Set<classId> }
const inflight = new Map(); // monthKey -> Promise

/** Net monthly star credit per class from a month's award logs. */
export function netStarsByClass(logs = []) {
    const totals = {};
    for (const log of logs) {
        const classId = log?.classId;
        if (!classId) continue;
        const credit = getAwardLogMonthlyStarCredit(log);
        if (!Number.isFinite(credit) || credit === 0) continue;
        totals[classId] = (totals[classId] || 0) + credit;
    }
    return totals;
}

/** Class ids whose month ended with real (positive) stars. */
export function classesWithAwardedStars(logs = []) {
    return Object.entries(netStarsByClass(logs))
        .filter(([, total]) => total > 0)
        .map(([classId]) => classId);
}

function readStored(monthKey) {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + monthKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.positive)) return null;
        return { at: Number(parsed.at) || 0, positive: new Set(parsed.positive) };
    } catch {
        return null;
    }
}

function writeStored(monthKey, entry) {
    try {
        localStorage.setItem(STORAGE_PREFIX + monthKey, JSON.stringify({ at: entry.at, positive: [...entry.positive] }));
    } catch { /* storage may be blocked; memory still answers this session */ }
}

function cachedEntry(monthKey) {
    if (memory.has(monthKey)) return memory.get(monthKey);
    const stored = readStored(monthKey);
    if (stored) memory.set(monthKey, stored);
    return stored;
}

/**
 * Synchronous answer if known: true (stars were awarded), false (nothing to
 * celebrate), or undefined (not checked yet / negative answer gone stale).
 */
export function getCeremonyStarVerdict(classId, monthKey) {
    const entry = cachedEntry(monthKey);
    if (!entry) return undefined;
    if (entry.positive.has(classId)) return true;
    return Date.now() - entry.at < NEGATIVE_TTL_MS ? false : undefined;
}

/** Resolves true when the class earned stars in that month (YYYY-MM). */
export async function ensureCeremonyStarVerdict(classId, monthKey) {
    const known = getCeremonyStarVerdict(classId, monthKey);
    if (known !== undefined) return known;
    if (!inflight.has(monthKey)) {
        const [year, month] = monthKey.split('-').map(Number);
        const task = import('../db/queries.js')
            .then(({ fetchLogsForMonth }) => fetchLogsForMonth(year, month))
            .then((logs) => {
                const previous = cachedEntry(monthKey);
                const positive = new Set([...(previous?.positive || []), ...classesWithAwardedStars(logs)]);
                const entry = { at: Date.now(), positive };
                memory.set(monthKey, entry);
                // An empty answer may be a failed read, so only this session trusts it.
                if (logs.length) writeStored(monthKey, entry);
                return entry;
            })
            .finally(() => inflight.delete(monthKey));
        inflight.set(monthKey, task);
    }
    try {
        const entry = await inflight.get(monthKey);
        return entry.positive.has(classId);
    } catch (error) {
        console.warn('Ceremony star check failed:', error);
        return false;
    }
}

/** Forget a month's answer (e.g. after an award log from that month is deleted). */
export function forgetCeremonyStarVerdict(monthKey) {
    memory.delete(monthKey);
    try { localStorage.removeItem(STORAGE_PREFIX + monthKey); } catch { /* ignore */ }
}
