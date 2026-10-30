// /features/heroBoonEligibility.js
// Who can receive a Hero's Boon, read off the shared hero ranking
// (features/heroRanking.js), so the pink heart in Award Stars, the Hero's Boon
// modal and the Hero's Challenge board all agree.
//
//   - The bottom three places on the board. A place shared at the cut-off
//     counts whole, so no hero in a tie is left out by chance.
//   - Or level on this month's stars with a classmate: a tie the class can
//     see, even when the board's tie-breaks put one of them ahead.
//
// Pure: no app state, so tests can use it.

const BOTTOM_PLACES = 3;

/** `ranked`: rankHeroes() output (best first, with { id, stars, rank }). Returns a Set of ids. */
export function heroBoonEligibleIds(ranked = []) {
    const eligible = new Set();
    if (!ranked.length) return eligible;
    const cutoffRank = ranked[Math.max(0, ranked.length - BOTTOM_PLACES)].rank;
    const starCounts = new Map();
    ranked.forEach((hero) => {
        const stars = Number(hero.stars) || 0;
        starCounts.set(stars, (starCounts.get(stars) || 0) + 1);
    });
    ranked.forEach((hero) => {
        if (hero.rank >= cutoffRank || starCounts.get(Number(hero.stars) || 0) > 1) eligible.add(hero.id);
    });
    return eligible;
}
