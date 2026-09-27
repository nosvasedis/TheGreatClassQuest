/**
 * Growth Starfall: a Scholar's Bonus for clear improvement, not only for top scores.
 * Pure logic; covered by tests/growth-starfall-core.test.mjs.
 *
 * A student qualifies when a new trial is well above their own recent average for the same
 * trial type. Classic Starfall (≥ 95% tests, > 85% dictations) still wins when both apply,
 * so a single trial never earns two bonuses.
 */

export const GROWTH_STARFALL_RULES = Object.freeze({
    /** Prior trials of the same type needed before growth can be judged fairly. */
    minPriorTrials: 3,
    /** How many of the most recent prior trials form the personal baseline. */
    baselineWindow: 5,
    /** Percentage points above the baseline that count as real growth. */
    minJumpPoints: 15,
    /** Stars proposed for a Growth Starfall (the teacher still confirms). */
    bonusStars: 0.5,
    /** At most this many Growth Starfalls per student per calendar month. */
    maxPerMonth: 1
});

/** Award-log note prefix; also used to keep growth bonuses out of the dictation cap. */
export const GROWTH_STARFALL_NOTE_PREFIX = 'Growth Starfall';

export function isGrowthStarfallNote(note) {
    return String(note || '').startsWith(GROWTH_STARFALL_NOTE_PREFIX);
}

export function buildGrowthStarfallNote({ trialType = 'test', jump = 0 } = {}) {
    const points = Math.round(Number(jump) || 0);
    return `${GROWTH_STARFALL_NOTE_PREFIX}: +${points} points above their recent average on a ${trialType === 'dictation' ? 'spelling trial' : 'test'}.`;
}

/**
 * @param {object} input
 * @param {number} input.newPercent            normalised score of the new trial (0–100)
 * @param {number[]} input.previousPercents    earlier scores of the same type, oldest → newest
 * @param {boolean} [input.alreadyHighScore]   true when classic Starfall already applies
 * @param {number} [input.growthAwardsThisMonth] Growth Starfalls already given this month
 * @returns {{ eligible: boolean, reason: string, baseline: number|null, jump: number|null, bonusStars: number }}
 */
export function evaluateGrowthStarfall({
    newPercent,
    previousPercents = [],
    alreadyHighScore = false,
    growthAwardsThisMonth = 0
} = {}, rules = GROWTH_STARFALL_RULES) {
    const result = (eligible, reason, baseline = null, jump = null) => ({
        eligible,
        reason,
        baseline,
        jump,
        bonusStars: eligible ? rules.bonusStars : 0
    });

    const score = Number(newPercent);
    if (!Number.isFinite(score)) return result(false, 'no_score');
    if (alreadyHighScore) return result(false, 'classic_starfall');
    if ((Number(growthAwardsThisMonth) || 0) >= rules.maxPerMonth) return result(false, 'monthly_cap');

    const prior = previousPercents.map(Number).filter(Number.isFinite);
    if (prior.length < rules.minPriorTrials) return result(false, 'not_enough_history');

    const recent = prior.slice(-rules.baselineWindow);
    const baseline = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    const jump = score - baseline;
    const roundedBaseline = Math.round(baseline * 10) / 10;
    const roundedJump = Math.round(jump * 10) / 10;
    if (jump < rules.minJumpPoints) return result(false, 'below_growth_bar', roundedBaseline, roundedJump);
    return result(true, 'growth', roundedBaseline, roundedJump);
}
