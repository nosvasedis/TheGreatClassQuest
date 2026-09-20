function toWinCount(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

export function getYearLegendContextFromState(appState) {
    const schoolYearState = typeof appState?.get === 'function'
        ? (appState.get('schoolYearState') || {})
        : (appState?.schoolYearState || {});
    const activeYearKey = schoolYearState.activeYearKey
        || (typeof appState?.getActiveSchoolYearKey === 'function' ? appState.getActiveSchoolYearKey() : null)
        || null;
    return {
        lastClosedYearKey: schoolYearState.lastClosedYearKey || null,
        activeYearKey
    };
}

/**
 * Hero of the Day legend wins (Rising / Golden / Mythic) are this school year
 * only. Last year's crowns stay in that year's snapshot and Hall archive.
 */
export function getYearScopedHeroOfDayWins(score = {}, { activeYearKey, lastClosedYearKey } = {}) {
    const wins = toWinCount(score?.heroOfDayWins);
    if (!wins) return 0;

    const stampedYear = String(score?.heroOfDayWinsYearKey || '').trim();
    const active = String(activeYearKey || '').trim();
    if (stampedYear && active && stampedYear !== active) return 0;
    if (stampedYear && active && stampedYear === active) return wins;
    if (lastClosedYearKey) return 0;
    return wins;
}

export function getYearScopedHeroOfDayWinsFromAppState(score, appState) {
    return getYearScopedHeroOfDayWins(score, getYearLegendContextFromState(appState));
}

export function nextHeroOfDayWinWrite(existingScore = {}, { activeYearKey, lastClosedYearKey } = {}) {
    const active = String(activeYearKey || '').trim();
    const stampedYear = String(existingScore?.heroOfDayWinsYearKey || '').trim();
    const currentWins = toWinCount(existingScore?.heroOfDayWins);

    if (stampedYear && active && stampedYear === active) {
        return { increment: true, heroOfDayWinsYearKey: active };
    }

    if (!stampedYear && !lastClosedYearKey && currentWins > 0) {
        return { increment: true, heroOfDayWinsYearKey: active || null };
    }

    return {
        increment: false,
        heroOfDayWins: 1,
        heroOfDayWinsYearKey: active || null
    };
}

export function isCarriedPriorYearLegendWins(score = {}, { lastClosedYearKey, activeYearKey } = {}) {
    if (!lastClosedYearKey) return false;
    if (!toWinCount(score?.heroOfDayWins)) return false;
    const stampedYear = String(score?.heroOfDayWinsYearKey || '').trim();
    const active = String(activeYearKey || '').trim();
    if (stampedYear && active && stampedYear === active) return false;
    return true;
}
