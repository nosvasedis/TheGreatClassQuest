// features/familiarProgression.mjs — how a familiar grows.
//
// A familiar grows with its "bond": the stars its hero has earned since the egg was bought.
// The bond is kept on the familiar itself as { banked, anchor, year }:
//   bond now = banked + (this year's totalStars - anchor)
// so it survives the yearly star reset (totalStars goes back to 0 when a school year closes,
// but the familiar stays). When the school year changes, the stars earned with the familiar in
// the closed year are banked and the anchor restarts at 0.
//
// Pure module: no DOM, no Firebase.

/** Bond (stars together) needed to reach each level. Index = level. */
export const FAMILIAR_STAGE_BOND = [0, 20, 80, 160];
export const FAMILIAR_MAX_LEVEL = FAMILIAR_STAGE_BOND.length - 1;

/** Kept for older callers: hatch after 20, then +60 and +140 stars after hatching. */
export const FAMILIAR_LEVEL_THRESHOLDS = {
    hatch: FAMILIAR_STAGE_BOND[1],
    level2: FAMILIAR_STAGE_BOND[2] - FAMILIAR_STAGE_BOND[1],
    level3: FAMILIAR_STAGE_BOND[3] - FAMILIAR_STAGE_BOND[1]
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/** The bond needed for a level (0 = egg). */
export function bondForLevel(level) {
    const lvl = clamp(Math.floor(num(level)), 0, FAMILIAR_MAX_LEVEL);
    return FAMILIAR_STAGE_BOND[lvl];
}

/** The level a bond reaches. */
export function levelForBond(bond) {
    const b = num(bond);
    let level = 0;
    for (let i = 1; i <= FAMILIAR_MAX_LEVEL; i++) {
        if (b >= FAMILIAR_STAGE_BOND[i]) level = i;
    }
    return level;
}

function aliveLevel(familiar) {
    return familiar?.state === 'alive' ? clamp(Math.floor(num(familiar.level)), 0, FAMILIAR_MAX_LEVEL) : 0;
}

export function hasStoredBond(familiar) {
    const bond = familiar?.bond;
    return Boolean(bond && typeof bond === 'object' && Number.isFinite(Number(bond.banked)) && Number.isFinite(Number(bond.anchor)));
}

/** Older saves stored the star total at hatch (or, before that, at the last level-up). */
export function deriveLegacyStarsAtHatch(familiar) {
    if (!familiar || familiar.state === 'egg') return null;
    if (typeof familiar.starsAtHatch === 'number') return familiar.starsAtHatch;

    const legacy = typeof familiar.starsWhenHatched === 'number' ? familiar.starsWhenHatched : null;
    if (legacy === null) return null;

    if (familiar.level >= 3) return legacy - FAMILIAR_LEVEL_THRESHOLDS.level3;
    if (familiar.level === 2) return legacy - FAMILIAR_LEVEL_THRESHOLDS.level2;
    return legacy;
}

/**
 * A familiar saved before the bond existed: work out its bond from the star total at purchase.
 * When the star total has been reset since then (a new school year), `priorYear` can carry the
 * last closed year's final star total; every star of the current year was earned together.
 * A familiar never loses a stage it already reached.
 * @param {object} familiar
 * @param {number} totalStars
 * @param {{ resetSincePurchase?: boolean, priorYearTotal?: number|null }} [priorYear]
 */
export function estimateLegacyBond(familiar, totalStars, priorYear = {}) {
    if (!familiar) return 0;
    const total = Math.max(0, num(totalStars));
    const purchase = Math.max(0, num(familiar.starsWhenPurchased));
    const floor = bondForLevel(aliveLevel(familiar));
    if (priorYear.resetSincePurchase) {
        const lastYear = typeof priorYear.priorYearTotal === 'number' ? Math.max(0, priorYear.priorYearTotal - purchase) : 0;
        return Math.max(floor, lastYear) + total;
    }
    return Math.max(floor, total - purchase);
}

/** Stars earned together right now. */
export function getFamiliarBond(familiar, totalStars) {
    if (!familiar) return 0;
    const total = Math.max(0, num(totalStars));
    if (hasStoredBond(familiar)) {
        const banked = Math.max(0, num(familiar.bond.banked));
        const anchor = Math.max(0, num(familiar.bond.anchor));
        return banked + Math.max(0, total - anchor);
    }
    return estimateLegacyBond(familiar, total);
}

/** A fresh bond record for a familiar bought (or re-anchored) right now. */
export function createFamiliarBond(totalStars, yearKey = null, banked = 0) {
    return { banked: Math.max(0, Math.round(num(banked))), anchor: Math.max(0, num(totalStars)), year: yearKey || null };
}

/**
 * The bond record after a school-year change: the closed year's stars are banked and the
 * anchor restarts at 0 (the new year's star total starts from 0).
 * @param {object} bond   the stored bond
 * @param {number|null} closedYearTotal  the hero's final star total for the closed year, if known
 * @param {string|null} newYearKey
 */
export function rollFamiliarBondOver(bond, closedYearTotal, newYearKey) {
    const banked = Math.max(0, num(bond?.banked));
    const anchor = Math.max(0, num(bond?.anchor));
    const closed = typeof closedYearTotal === 'number' ? Math.max(0, closedYearTotal - anchor) : 0;
    return { banked: banked + closed, anchor: 0, year: newYearKey || null };
}

export function getUnlockedFamiliarLevel(familiar, totalStars) {
    if (!familiar) return 0;
    return levelForBond(getFamiliarBond(familiar, totalStars));
}

/**
 * Where a familiar stands on its way to the next stage.
 * phase: 'egg' | 'level1' | 'level2' | ... | 'max'
 */
export function getFamiliarProgress(familiar, totalStars) {
    const bond = getFamiliarBond(familiar, totalStars);
    const unlockedLevel = levelForBond(bond);
    const effectiveLevel = Math.max(aliveLevel(familiar), unlockedLevel);

    if (!familiar || effectiveLevel === 0 || familiar.state === 'egg') {
        const max = FAMILIAR_STAGE_BOND[1];
        return {
            phase: 'egg',
            bond,
            current: clamp(bond, 0, max),
            min: 0,
            max,
            remaining: Math.max(0, max - bond),
            unlockedLevel: effectiveLevel
        };
    }

    if (effectiveLevel >= FAMILIAR_MAX_LEVEL) {
        const top = FAMILIAR_STAGE_BOND[FAMILIAR_MAX_LEVEL];
        return { phase: 'max', bond, current: top, min: top, max: top, remaining: 0, unlockedLevel: effectiveLevel };
    }

    const min = FAMILIAR_STAGE_BOND[effectiveLevel];
    const max = FAMILIAR_STAGE_BOND[effectiveLevel + 1];
    return {
        phase: `level${effectiveLevel}`,
        bond,
        current: clamp(bond, min, max),
        min,
        max,
        remaining: Math.max(0, max - bond),
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
