// /features/guildScoringCore.js — pure Guild Glory and Guild Power math

export function roundTo(value, places = 1) {
    const factor = 10 ** places;
    return Math.round((Number(value) || 0) * factor) / factor;
}

export function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}

export function getActiveGuildModifiers(guildData = {}, now = Date.now()) {
    return (Array.isArray(guildData.gloryModifiers) ? guildData.gloryModifiers : [])
        .filter((mod) => (Number(mod?.expiresAt) || 0) > now);
}

export function getMomentumArrow(pct) {
    const n = Number(pct) || 0;
    if (n >= 50) return '⬆️';
    if (n >= 15) return '↗️';
    if (n > -15) return '➡️';
    if (n > -50) return '↘️';
    return '⬇️';
}

export function compareGuildLeaderboardRows(a = {}, b = {}) {
    return (Number(b.guildPower) || 0) - (Number(a.guildPower) || 0) ||
        (Number(b.perCapitaGlory) || 0) - (Number(a.perCapitaGlory) || 0) ||
        (Number(b.weeklyPerCapitaGlory) || 0) - (Number(a.weeklyPerCapitaGlory) || 0) ||
        (Number(b.totalGlory) || 0) - (Number(a.totalGlory) || 0) ||
        String(a.guildName || a.name || '').localeCompare(String(b.guildName || b.name || ''));
}

export function consumeChargeModifiers(modifiers = [], starDelta = 0, now = Date.now()) {
    if (!(starDelta > 0)) return modifiers;
    let starsRemaining = Number(starDelta) || 0;
    return modifiers
        .map((mod) => {
            if (!mod || mod.type !== 'bonus_per_star') return mod;
            const charges = Number(mod.charges);
            if (!Number.isFinite(charges)) return mod;
            if (charges <= 0) return null;
            const used = Math.min(charges, starsRemaining);
            starsRemaining = Math.max(0, starsRemaining - used);
            const nextCharges = charges - used;
            return nextCharges > 0 ? { ...mod, charges: nextCharges } : null;
        })
        .filter((mod) => mod && ((Number(mod.expiresAt) || 0) > now || !mod.expiresAt));
}

export function calculateGuildGloryDelta({
    starDelta = 0,
    directGlory = 0,
    scoreData = {},
    guildData = {},
    gloryPerStar = 2,
    now = Date.now(),
} = {}) {
    const safeStarDelta = Number(starDelta) || 0;
    const safeDirectGlory = Number(directGlory) || 0;
    const activeModifiers = getActiveGuildModifiers(guildData, now);
    const breakdown = [];

    let starGlory = safeStarDelta * gloryPerStar;
    if (safeStarDelta !== 0) {
        breakdown.push({ type: 'base_star_glory', amount: starGlory, detail: `${gloryPerStar} Glory per star` });
    }

    let perStarBonus = 0;
    if (safeStarDelta > 0 && Number(scoreData?.gloryBannerCharges) > 0) {
        const amount = Math.min(safeStarDelta, Number(scoreData.gloryBannerCharges) || 0);
        perStarBonus += amount;
        breakdown.push({ type: 'banner_of_glory', amount, detail: '+1 Glory per awarded star' });
    }

    if (safeStarDelta > 0 && guildData?.chaliceActive && Number(guildData?.chaliceExpiresAt) > now) {
        const amount = safeStarDelta;
        perStarBonus += amount;
        breakdown.push({ type: 'chalice_of_radiance', amount, detail: '+1 Glory per awarded star' });
    }

    for (const mod of activeModifiers) {
        if (mod.type !== 'bonus_per_star' || safeStarDelta <= 0) continue;
        const chargeLimit = Number.isFinite(Number(mod.charges)) ? Math.max(0, Number(mod.charges)) : safeStarDelta;
        const qualifyingStars = Math.min(safeStarDelta, chargeLimit);
        const amount = (Number(mod.amount) || 0) * qualifyingStars;
        if (!amount) continue;
        perStarBonus += amount;
        breakdown.push({ type: 'modifier_bonus_per_star', amount, label: mod.label || '', detail: `+${Number(mod.amount) || 0} Glory per star` });
    }

    const beforeMultiplier = starGlory + perStarBonus;
    let afterMultiplier = beforeMultiplier;
    let multiplierDelta = 0;
    for (const mod of activeModifiers) {
        if (mod.type !== 'multiply') continue;
        const factor = Number(mod.factor);
        if (!Number.isFinite(factor) || factor === 1) continue;
        const next = Math.round(afterMultiplier * factor);
        const delta = next - afterMultiplier;
        multiplierDelta += delta;
        afterMultiplier = next;
        breakdown.push({ type: 'modifier_multiply', amount: delta, factor, label: mod.label || '', detail: `${factor}x Glory modifier` });
    }

    if (safeDirectGlory) {
        breakdown.push({ type: 'direct_glory', amount: safeDirectGlory, detail: 'Direct Guild Glory event' });
    }

    return {
        starDelta: safeStarDelta,
        baseGlory: roundTo(starGlory, 2),
        modifierGlory: roundTo(perStarBonus + multiplierDelta, 2),
        directGlory: roundTo(safeDirectGlory, 2),
        totalGloryDelta: roundTo(afterMultiplier + safeDirectGlory, 2),
        breakdown,
        consumedGloryModifiers: consumeChargeModifiers(guildData.gloryModifiers || [], safeStarDelta, now),
    };
}

export function calculateGuildPower(guildData, maxima = {}, weights) {
    const memberCountRaw = Number(guildData?.memberCount) || 0;
    if (memberCountRaw <= 0) {
        return {
            guildPower: 0,
            seasonGloryScore: 0,
            weeklyGloryScore: 0,
            activityScore: 0,
            momentumScore: 50,
            momentumPct: 0,
            momentumArrow: getMomentumArrow(0),
            perCapitaGlory: 0,
            weeklyPerCapitaGlory: 0,
        };
    }

    const memberCount = Math.max(memberCountRaw, 1);
    const totalGlory = Number(guildData?.totalGlory) || 0;
    const weeklyGlory = Number(guildData?.weeklyGlory) || 0;
    const previousWeekGlory = Number(guildData?.previousWeekGlory) || 0;
    const weeklyActiveMembers = Number(guildData?.weeklyActiveMembers) || 0;
    const activeModifiers = getActiveGuildModifiers(guildData);
    const hasMomentumLock = activeModifiers.some((m) => m.type === 'momentum_lock');

    const perCapitaGlory = totalGlory / memberCount;
    const weeklyPerCapitaGlory = weeklyGlory / memberCount;
    const maxPerCapitaGlory = Math.max(Number(maxima.maxPerCapitaGlory) || 0, 1);
    const maxWeeklyPerCapitaGlory = Math.max(Number(maxima.maxWeeklyPerCapitaGlory) || 0, 1);

    const seasonGloryScore = clamp((perCapitaGlory / maxPerCapitaGlory) * 100);
    const weeklyGloryScore = clamp((weeklyPerCapitaGlory / maxWeeklyPerCapitaGlory) * 100);
    const activityScore = clamp((weeklyActiveMembers / memberCount) * 100);

    let momentumPct = 0;
    if (previousWeekGlory > 0) {
        momentumPct = ((weeklyGlory - previousWeekGlory) / previousWeekGlory) * 100;
    } else if (weeklyGlory > 0) {
        momentumPct = 100;
    }
    if (hasMomentumLock) momentumPct = Math.max(0, momentumPct);
    momentumPct = clamp(momentumPct, -100, 100);
    const momentumScore = (momentumPct + 100) / 2;

    const safeWeights = weights || { seasonGlory: 0.70, weeklyGlory: 0.15, activity: 0.10, momentum: 0.05 };
    const guildPower = roundTo(
        seasonGloryScore * safeWeights.seasonGlory +
        weeklyGloryScore * safeWeights.weeklyGlory +
        activityScore * safeWeights.activity +
        momentumScore * safeWeights.momentum,
        1
    );

    return {
        guildPower: Math.max(0, guildPower),
        seasonGloryScore: roundTo(seasonGloryScore),
        gloryScore: roundTo(seasonGloryScore),
        weeklyGloryScore: roundTo(weeklyGloryScore),
        activityScore: roundTo(activityScore),
        momentumScore: roundTo(momentumScore),
        momentumPct: Math.round(momentumPct),
        momentumArrow: getMomentumArrow(momentumPct),
        perCapitaGlory: roundTo(perCapitaGlory),
        weeklyPerCapitaGlory: roundTo(weeklyPerCapitaGlory),
    };
}
