// /features/heroRanking.js
// One set of rules for ranking heroes, shared by the Hero's Challenge board,
// the Ceremony of the Month, the Hall of Prodigies and the reigning-Prodigy
// badges, so they can never disagree about who is ahead or who is tied.
//
// The rules (the Ceremony's):
//   1. More stars ranks higher.
//   2. Tie-breakers, in order: more 3-star awards, more 2-star awards, more
//      different award reasons, higher academic average.
//   3. Places 1-3 are shared when stars, 3-star, 2-star and reason counts all
//      match (the academic average never splits a podium place). Below the top
//      three the academic average must also match (within 0.1) to share.
//   4. Everyone sharing 1st place with at least one star is Prodigy of the
//      Month; more than one makes them Co-Prodigies.
//
// Pure: no app state, so tests and the guidebook capture stage can use it.

import { getAwardLogMonthlyStarCredit } from './awardLogReasonMeta.js';

/** Class-wide awards that everyone present receives, so they never break a tie. */
export const HERO_TIE_EXCLUDED_REASONS = Object.freeze(['special_quest']);

const ACADEMIC_TIE_TOLERANCE = 0.1;
const PODIUM_PLACES = 3;

/**
 * Tie-break stats for one hero from that period's award logs and written scores
 * (both already filtered to the hero and the period).
 * `normalizePercent(score)` returns 0-100, or null/NaN when the score has no value.
 */
export function buildHeroTieStats(logs = [], scores = [], normalizePercent = () => null) {
    let count3 = 0;
    let count2 = 0;
    const reasons = new Set();
    (logs || []).forEach((log) => {
        if (!log || HERO_TIE_EXCLUDED_REASONS.includes(log.reason)) return;
        const credit = getAwardLogMonthlyStarCredit(log);
        if (credit >= 3) count3 += 1;
        else if (credit >= 2) count2 += 1;
        if (log.reason) reasons.add(log.reason);
    });
    // A "?" (unmarkable) trial was sat but has no mark: it is neither a zero nor part of the average.
    const marked = (scores || []).filter((score) => score?.unmarkable !== true);
    let academicSum = 0;
    marked.forEach((score) => {
        const value = Number(normalizePercent(score));
        if (Number.isFinite(value)) academicSum += value;
    });
    const scoreCount = marked.length;
    return {
        count3,
        count2,
        uniqueReasons: reasons.size,
        academicAvg: scoreCount > 0 ? academicSum / scoreCount : 0
    };
}

function stat(hero, field) {
    return Number(hero?.stats?.[field]) || 0;
}

function stars(hero) {
    return Number(hero?.stars) || 0;
}

/** Sort comparator: best first. Items carry { stars, name, stats }. */
export function compareHeroes(a, b) {
    return (stars(b) - stars(a))
        || (stat(b, 'count3') - stat(a, 'count3'))
        || (stat(b, 'count2') - stat(a, 'count2'))
        || (stat(b, 'uniqueReasons') - stat(a, 'uniqueReasons'))
        || (stat(b, 'academicAvg') - stat(a, 'academicAvg'))
        || String(a?.name || '').localeCompare(String(b?.name || ''));
}

/** Same stars, 3-star, 2-star and reason counts. */
export function isHeroBehaviourTie(a, b) {
    return stars(a) === stars(b)
        && stat(a, 'count3') === stat(b, 'count3')
        && stat(a, 'count2') === stat(b, 'count2')
        && stat(a, 'uniqueReasons') === stat(b, 'uniqueReasons');
}

/**
 * Ranks for a list already sorted with compareHeroes ("1, 1, 3, 4").
 * `starsOnly` shares a place on equal stars alone (used where the period's
 * tie-break stats are not available, e.g. all-time stars).
 */
export function assignHeroRanks(sorted = [], { starsOnly = false } = {}) {
    const ranks = [];
    let rank = 0;
    sorted.forEach((hero, index) => {
        if (index === 0) {
            rank = 1;
        } else {
            const prev = sorted[index - 1];
            let tie;
            if (starsOnly) {
                tie = stars(hero) === stars(prev);
            } else {
                tie = isHeroBehaviourTie(hero, prev);
                if (tie && rank > PODIUM_PLACES) {
                    tie = Math.abs(stat(hero, 'academicAvg') - stat(prev, 'academicAvg')) < ACADEMIC_TIE_TOLERANCE;
                }
            }
            if (!tie) rank = index + 1;
        }
        ranks.push(rank);
    });
    return ranks;
}

/** Sorts (best first) and adds `rank` to each hero. */
export function rankHeroes(heroes = [], options = {}) {
    const sorted = [...heroes].sort(options.starsOnly ? compareByStarsThenName : compareHeroes);
    const ranks = assignHeroRanks(sorted, options);
    return sorted.map((hero, index) => ({ ...hero, rank: ranks[index] }));
}

function compareByStarsThenName(a, b) {
    return (stars(b) - stars(a)) || String(a?.name || '').localeCompare(String(b?.name || ''));
}

/** Everyone sharing 1st place with at least one star (Co-Prodigies when more than one). */
export function pickProdigyWinners(rankedHeroes = []) {
    return rankedHeroes.filter((hero) => hero.rank === 1 && stars(hero) > 0);
}

/**
 * Stars this calendar month from a student_scores doc. The doc's monthlyStars
 * is only reset by the first award of a new month, so until then it still holds
 * last month's stars and must read as 0.
 * `monthStart` is 'YYYY-MM-01' for the current month.
 */
export function currentMonthStarsFromScore(score, monthStart) {
    if (!score) return 0;
    const lastReset = score.lastMonthlyResetDate;
    if (lastReset && monthStart && lastReset !== monthStart) return 0;
    return Number(score.monthlyStars) || 0;
}
