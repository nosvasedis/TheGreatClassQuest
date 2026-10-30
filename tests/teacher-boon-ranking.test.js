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
