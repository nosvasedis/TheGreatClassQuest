function toGoldNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

export function getLiveYearGoldContextFromState(appState) {
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
 * Last year's Gold is snapshotted at year close (`goldAtClose`) and must not
 * remain spendable or visible in this year's Treasury. After close, live
 * score docs start with 0 stars, so leftover gold on those docs is carried.
 */
export function isCarriedPriorYearGold(score = {}, { lastClosedYearKey } = {}) {
    if (!lastClosedYearKey) return false;
    const gold = toGoldNumber(score.gold, 0);
    if (!(gold > 0)) return false;
    return toGoldNumber(score.totalStars, 0) === 0 && toGoldNumber(score.monthlyStars, 0) === 0;
}

export function getLiveYearGold(score = {}, yearContext = {}) {
    if (isCarriedPriorYearGold(score, yearContext)) return 0;
    if (score.gold !== undefined && score.gold !== null) {
        return Math.max(0, toGoldNumber(score.gold, 0));
    }
    return Math.max(0, toGoldNumber(score.totalStars, 0));
}

export function sumLiveYearGold(scores = [], yearContext = {}) {
    return (Array.isArray(scores) ? scores : []).reduce(
        (sum, score) => sum + getLiveYearGold(score, yearContext),
        0
    );
}

export function getLiveYearGoldFromAppState(score, appState) {
    return getLiveYearGold(score, getLiveYearGoldContextFromState(appState));
}

export function sumLiveYearGoldFromAppState(scores, appState) {
    return sumLiveYearGold(scores, getLiveYearGoldContextFromState(appState));
}
