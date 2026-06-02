export const FAMILIAR_LEVEL_THRESHOLDS = {
    hatch: 20,
    level2: 60,
    level3: 140
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function deriveLegacyStarsAtHatch(familiar) {
    if (!familiar || familiar.state === 'egg') return null;
    if (typeof familiar.starsAtHatch === 'number') return familiar.starsAtHatch;

    const legacy = typeof familiar.starsWhenHatched === 'number' ? familiar.starsWhenHatched : null;
    if (legacy === null) return null;

    if (familiar.level >= 3) return legacy - FAMILIAR_LEVEL_THRESHOLDS.level3;
    if (familiar.level === 2) return legacy - FAMILIAR_LEVEL_THRESHOLDS.level2;
    return legacy;
}

export function getEffectiveStarsAtHatch(familiar, totalStars) {
    if (!familiar) return totalStars ?? 0;

    const explicit = deriveLegacyStarsAtHatch(familiar);
    if (typeof explicit === 'number') return explicit;

    const purchaseStars = familiar.starsWhenPurchased || 0;
    return purchaseStars + FAMILIAR_LEVEL_THRESHOLDS.hatch;
}

export function getUnlockedFamiliarLevel(familiar, totalStars) {
    if (!familiar) return 0;

    const starsSincePurchase = Math.max(0, (totalStars || 0) - (familiar.starsWhenPurchased || 0));
    if (starsSincePurchase < FAMILIAR_LEVEL_THRESHOLDS.hatch) {
        return 0;
    }

    const starsAtHatch = getEffectiveStarsAtHatch(familiar, totalStars);
    const starsSinceHatch = Math.max(0, (totalStars || 0) - starsAtHatch);

    if (starsSinceHatch >= FAMILIAR_LEVEL_THRESHOLDS.level3) return 3;
    if (starsSinceHatch >= FAMILIAR_LEVEL_THRESHOLDS.level2) return 2;
    return 1;
}

export function getFamiliarProgress(familiar, totalStars) {
    const unlockedLevel = getUnlockedFamiliarLevel(familiar, totalStars);
    const currentLevel = familiar?.state === 'alive' ? (familiar.level || 0) : 0;
    const effectiveLevel = Math.max(currentLevel, unlockedLevel);

    if (!familiar || effectiveLevel === 0 || familiar.state === 'egg') {
        const current = Math.max(0, (totalStars || 0) - (familiar?.starsWhenPurchased || 0));
        return {
            phase: 'egg',
            current,
            min: 0,
            max: FAMILIAR_LEVEL_THRESHOLDS.hatch,
            remaining: Math.max(0, FAMILIAR_LEVEL_THRESHOLDS.hatch - current),
            unlockedLevel: effectiveLevel
        };
    }

    const starsAtHatch = getEffectiveStarsAtHatch(familiar, totalStars);
    const starsSinceHatch = Math.max(0, (totalStars || 0) - starsAtHatch);

    if (effectiveLevel >= 3) {
        return {
            phase: 'max',
            current: FAMILIAR_LEVEL_THRESHOLDS.level3,
            min: FAMILIAR_LEVEL_THRESHOLDS.level3,
            max: FAMILIAR_LEVEL_THRESHOLDS.level3,
            remaining: 0,
            unlockedLevel: effectiveLevel
        };
    }

    if (effectiveLevel === 1) {
        return {
            phase: 'level1',
            current: clamp(starsSinceHatch, 0, FAMILIAR_LEVEL_THRESHOLDS.level2),
            min: 0,
            max: FAMILIAR_LEVEL_THRESHOLDS.level2,
            remaining: Math.max(0, FAMILIAR_LEVEL_THRESHOLDS.level2 - starsSinceHatch),
            unlockedLevel: effectiveLevel
        };
    }

    return {
        phase: 'level2',
        current: clamp(starsSinceHatch, FAMILIAR_LEVEL_THRESHOLDS.level2, FAMILIAR_LEVEL_THRESHOLDS.level3),
        min: FAMILIAR_LEVEL_THRESHOLDS.level2,
        max: FAMILIAR_LEVEL_THRESHOLDS.level3,
        remaining: Math.max(0, FAMILIAR_LEVEL_THRESHOLDS.level3 - starsSinceHatch),
        unlockedLevel: effectiveLevel
    };
}

export function getFamiliarProgressPercent(progress) {
    if (!progress) return 0;
    const span = progress.max - progress.min;
    if (span <= 0) return progress.phase === 'max' ? 100 : 0;
    return Math.round((clamp(progress.current, progress.min, progress.max) - progress.min) / span * 100);
}

export function getEggAlertState(familiar, totalStars, soonThreshold = 5) {
    if (!familiar || familiar.state !== 'egg') return null;

    const progress = getFamiliarProgress(familiar, totalStars);
    if (progress.phase !== 'egg') return null;

    if (progress.remaining <= 0) {
        return {
            kind: 'ready',
            remaining: 0,
            current: progress.current,
            threshold: progress.max
        };
    }

    if (progress.remaining <= soonThreshold) {
        return {
            kind: 'soon',
            remaining: progress.remaining,
            current: progress.current,
            threshold: progress.max
        };
    }

    return null;
}
