const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Teacher Boon and the Hero\'s Challenge rank heroes from one shared source', () => {
    const boon = read('ui/modals/teacherBoon.js');
    const board = read('ui/tabs/leaderboard.js');

    // One ranking: this month's stars, the Ceremony's tie-breaks, shared places.
    assert.match(boon, /rankClassHeroesThisMonth/);
    assert.doesNotMatch(boon, /monthlyStars/);
    assert.match(board, /heroMonthRecords/);
    assert.match(board, /heroMonthStars/);

    // One set of reigning Prodigies (Co-Prodigies included).
    assert.match(boon, /getReigningProdigies/);
    assert.match(board, /getReigningProdigies/);
    assert.doesNotMatch(board, /async function getReigningProdigies/);
});

test('Hero\'s Boon eligibility reads the same ranking in Award Stars and the modal', () => {
    const award = read('ui/tabs/award.js');
    const modal = read('ui/modals/rankings.js');
    assert.match(award, /classHeroBoonEligibility/);
    assert.match(modal, /classHeroBoonEligibility/);
    assert.doesNotMatch(award, /bottomThreeIds/);
    assert.doesNotMatch(modal, /bottomThreeIds/);
});

test('Hero\'s Boon: bottom three places count whole, and equal stars still count as a tie', async () => {
    const { rankHeroes } = await import('../features/heroRanking.js');
    const { heroBoonEligibleIds } = await import('../features/heroBoonEligibility.js');
    const hero = (id, stars, count3 = 0) => ({ id, name: id, stars, stats: { count3 } });

    // Four heroes share last place: all four qualify, none left out by chance.
    let ids = heroBoonEligibleIds(rankHeroes([hero('a', 20), hero('b', 15), hero('c', 4), hero('d', 4), hero('e', 4), hero('f', 4)]));
    assert.deepEqual([...ids].sort(), ['c', 'd', 'e', 'f']);

    // Level on stars but split by a tie-break: still a tie the class can see.
    ids = heroBoonEligibleIds(rankHeroes([hero('a', 20, 3), hero('b', 20, 1), hero('c', 15), hero('d', 10), hero('e', 8), hero('f', 6)]));
    assert.deepEqual([...ids].sort(), ['a', 'b', 'd', 'e', 'f']);

    // Small classes: everyone is in the bottom three.
    assert.equal(heroBoonEligibleIds(rankHeroes([hero('a', 9), hero('b', 3)])).size, 2);
    assert.equal(heroBoonEligibleIds([]).size, 0);
});
