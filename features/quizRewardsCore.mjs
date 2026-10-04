/**
 * Quiz of the Week rewards: who earns what, and who wins the one Market prize.
 * Pure; no DOM, no Firestore. Paid out by db/actions/quizOfTheWeek.js#distributeQuizRewards.
 * Covered by tests/quiz-rewards-core.test.mjs.
 *
 * The rules, in words a class understands:
 * - Your own answers earn your stars. Right on the first try: 1 star. Rescuing a question
 *   someone else missed: ½ star. At most 2 stars from one quiz, so a hero who happened to be
 *   called more often cannot run away with it. Every star pays 1 Gold, as everywhere else.
 * - Took a turn but nothing landed: +1 Gold for being brave. Every week, whatever the class score.
 * - The class score (first-try accuracy) sets the tier and the Team Quest bonus for everyone.
 * - One Quiz Champion wins one treasure from the league's Mystic Market stall, taken out of
 *   its stock. Ties go to the hero who has won the fewest quiz prizes this year.
 */

export const QUIZ_STAR_FIRST_TRY = 1;
export const QUIZ_STAR_RESCUE = 0.5;
export const QUIZ_STAR_CAP = 2;
export const QUIZ_BRAVE_GOLD = 1;
/** Paid to the champion instead of a treasure when the stall has nothing in stock. */
export const QUIZ_PRIZE_FALLBACK_GOLD = 10;

export const QUIZ_TEAM_BONUS = { legendary: 3, epic: 2, rare: 1, common: 0.5, heroic: 0 };

/** Treasure tiers the champion's prize may come from, by how well the whole class did. */
export const QUIZ_PRIZE_TIERS = {
    legendary: ['rare', 'common'],
    epic: ['rare', 'common'],
    rare: ['common'],
    common: ['common'],
    heroic: ['common']
};

export function computeQuizRewardTier(firstTryCorrectPct) {
    const pct = Number(firstTryCorrectPct) || 0;
    if (pct >= 100) return 'legendary';
    if (pct >= 80) return 'epic';
    if (pct >= 60) return 'rare';
    if (pct >= 40) return 'common';
    return 'heroic';
}

const half = (n) => Math.round(n * 2) / 2;

/**
 * Per-hero tally from the logged attempts. A first-try answer is attemptNumber 1 on that
 * question; a rescue is a right answer after someone else missed it.
 */
export function tallyQuizHeroes(attempts = []) {
    const byStudent = new Map();
    for (const attempt of attempts) {
        if (!attempt?.studentId) continue;
        const row = byStudent.get(attempt.studentId) || { studentId: attempt.studentId, turns: 0, firstTry: 0, rescues: 0, wrong: 0 };
        row.turns += 1;
        if (attempt.correct) {
            if ((Number(attempt.attemptNumber) || 1) <= 1) row.firstTry += 1;
            else row.rescues += 1;
        } else {
            row.wrong += 1;
        }
        byStudent.set(attempt.studentId, row);
    }
    return [...byStudent.values()];
}

/** Stars and Gold for each hero who took a turn. */
export function computeHeroRewards(attempts = []) {
    return tallyQuizHeroes(attempts).map((row) => {
        const earned = row.firstTry * QUIZ_STAR_FIRST_TRY + row.rescues * QUIZ_STAR_RESCUE;
        const stars = half(Math.min(QUIZ_STAR_CAP, earned));
        const brave = stars === 0 && row.turns > 0;
        return {
            ...row,
            correct: row.firstTry + row.rescues,
            stars,
            gold: brave ? QUIZ_BRAVE_GOLD : stars,
            brave
        };
    });
}

/**
 * The one Quiz Champion: needs at least one first-try answer. Ranked by points (first try 2,
 * rescue 1), then fewer quiz prizes already won this year, then fewer wrong answers.
 * A remaining tie is settled by `random` (injectable for tests).
 */
export function pickQuizChampion(heroRewards = [], { prizeWins = {}, random = Math.random } = {}) {
    const eligible = heroRewards.filter((hero) => hero.firstTry > 0);
    if (!eligible.length) return null;
    const ranked = eligible
        .map((hero) => ({
            hero,
            points: hero.firstTry * 2 + hero.rescues,
            wins: Number(prizeWins[hero.studentId]) || 0,
            wrong: hero.wrong || 0,
            roll: random()
        }))
        .sort((a, b) => (b.points - a.points) || (a.wins - b.wins) || (a.wrong - b.wrong) || (a.roll - b.roll));
    return ranked[0].hero.studentId;
}

/** How many quiz prizes each student has already won, from earlier finished quizzes. */
export function countQuizPrizeWins(history = []) {
    const wins = {};
    for (const quiz of history) {
        const id = quiz?.results?.rewards?.prize?.studentId;
        if (id) wins[id] = (wins[id] || 0) + 1;
    }
    return wins;
}

function itemTier(item) {
    const gold = Number(item?.price) || 0;
    if (gold >= 80) return 'legendary';
    if (gold >= 35) return 'rare';
    return 'common';
}

/**
 * Treasures the champion could receive, best first: items from the class's league stall that
 * are in stock and in a tier the class score allows. Within a tier the order is random, so the
 * prize is a surprise but never above what the class earned.
 */
export function quizPrizeCandidates(stallItems = [], tier = 'common', { random = Math.random } = {}) {
    const allowed = QUIZ_PRIZE_TIERS[tier] || QUIZ_PRIZE_TIERS.common;
    const inStock = stallItems.filter((item) => item?.id && item?.name && (item.stock === undefined || item.stock === null || Number(item.stock) > 0));
    return allowed.flatMap((itemTierName) => inStock
        .filter((item) => itemTier(item) === itemTierName)
        .map((item) => ({ item, roll: random() }))
        .sort((a, b) => a.roll - b.roll)
        .map(({ item }) => item));
}
