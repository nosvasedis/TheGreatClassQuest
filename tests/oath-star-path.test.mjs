import test from 'node:test';
import assert from 'node:assert/strict';
import { oathPerkFor, starsForKept, goldForKept, rankFor, nextRank, keepsakeFor, keptCountFromInventory, personalConstellation, personalFigureKey, PERSONAL_FIGURES, STAR_RANKS, starPathNote } from '../features/oathStarPath.mjs';
import { figureProgress, figureCompletedBy, FIGURE_SIZE, CONSTELLATION_FIGURES, constellationMarkup } from '../features/campfireConstellation.mjs';
import { BONUS_ONLY_AWARD_REASONS, EMBER_OATH_AWARD_REASON, isBonusOnlyAwardLog } from '../features/awardLogReasonMeta.js';

test('the Star Path grows with every promise kept and never shrinks', () => {
    let lastStars = 0, lastGold = 0;
    for (let n = 1; n <= 30; n++) {
        const p = oathPerkFor(n);
        assert.ok(p.stars === 0 || p.stars === 1, 'bonus stars stay rare: ' + n);
        assert.equal(p.stars, p.milestone && n > 2 || (n > 12 && n % 4 === 0) ? 1 : 0, 'a star only on a big milestone: ' + n);
        if (n <= 12) assert.ok(p.gold >= lastGold, 'gold ' + n);
        assert.ok(p.gold >= 5 && p.gold <= 30);
        assert.equal(p.goldTotal, p.gold + p.stars, 'each bonus star brings its Gold too');
        lastStars = p.stars; lastGold = Math.max(lastGold, p.gold);
    }
    assert.equal(starsForKept(1), 0); assert.equal(starsForKept(3), 1); assert.equal(starsForKept(9), 0); assert.equal(starsForKept(16), 1);
    assert.equal([...Array(12)].reduce((sum, _, i) => sum + starsForKept(i + 1), 0), 4, 'four bonus stars across the first twelve promises');
    assert.equal(goldForKept(1), 5); assert.equal(goldForKept(12), 30); assert.equal(goldForKept(16), 30); assert.equal(goldForKept(13), 20);
});

test('ranks, milestones and keepsakes land on the right promise', () => {
    assert.equal(rankFor(0), null);
    assert.equal(rankFor(1).id, 'first_light');
    assert.equal(rankFor(4).id, 'star_weaver');
    assert.equal(rankFor(40).id, 'keeper_of_the_sky');
    assert.equal(oathPerkFor(3).milestone.id, 'star_weaver');
    assert.equal(oathPerkFor(4).milestone, null);
    assert.deepEqual(nextRank(3), { ...STAR_RANKS[3], left: 2 });
    assert.equal(nextRank(12), null);
    for (const n of [3, 8, 12]) {
        const k = keepsakeFor(n, { studentId: 's1', date: '2026-10-15' });
        assert.ok(k && k.source === 'ember_path' && k.image.startsWith('data:image/svg+xml,'), String(n));
        assert.equal(k.id, 'starpath_' + n + '_s1', 'stable id: a retried keep never adds it twice');
    }
    assert.equal(keepsakeFor(4), null);
    assert.match(starPathNote(oathPerkFor(5), 'The Brave Voice'), /Star Path 5 · Bright Constellation/);
});

test('the count comes from the Star-Embers in the satchel, never counting this promise twice', () => {
    const inv = [{ source: 'ember_oath', oathId: 'a' }, { source: 'ember_oath', oathId: 'b' }, { source: 'market' }, { source: 'ember_path' }];
    assert.equal(keptCountFromInventory(inv), 2);
    assert.equal(keptCountFromInventory(inv, 'b'), 1);
    assert.equal(keptCountFromInventory(null), 0);
});

test('a bonus Star Path row never counts as today\'s stars', () => {
    assert.ok(BONUS_ONLY_AWARD_REASONS.includes(EMBER_OATH_AWARD_REASON));
    assert.ok(isBonusOnlyAwardLog({ reason: 'ember_oath' }));
});

test('every child has their own figure: from their Hero Path, otherwise stable by id', () => {
    assert.equal(personalFigureKey({ heroClass: 'Sage', studentId: 'x' }), 'owl');
    assert.equal(personalFigureKey({ studentId: 'abc' }), personalFigureKey({ studentId: 'abc' }));
    for (const [key, fig] of Object.entries(PERSONAL_FIGURES)) {
        assert.equal(fig.nodes.length, 12, key);
        for (const [a, b] of fig.edges) assert.ok(a < 12 && b < 12 && a !== b, key);
        // The first three stars already join: a constellation is born at three.
        const sky = personalConstellation(3, { heroClass: { kite: 'Artificer', lantern: 'Patron', owl: 'Sage', shield: 'Guardian', arrow: 'Vanguard', ship: 'Nomad' }[key] });
        assert.equal(sky.key, key);
        assert.ok(sky.edges.some(e => e.lit), key + ' joins by three');
    }
    const whole = personalConstellation(14, { studentId: 'q' });
    assert.ok(whole.whole); assert.equal(whole.extra, 2); assert.equal(whole.lit, 12);
});

test('class figures are drawn whole by seven promises of a kind', () => {
    for (const fig of Object.values(CONSTELLATION_FIGURES)) assert.equal(fig.nodes.length, FIGURE_SIZE);
    const oaths = Array.from({ length: 7 }, (_, i) => ({ id: 's' + i, status: 'kept', category: 'speak', keptAt: { seconds: i } }));
    assert.equal(figureCompletedBy(oaths.slice(0, 6), oaths[5]), null);
    const done = figureCompletedBy(oaths, oaths[6]);
    assert.equal(done.kind, 'speak'); assert.equal(done.completions, 1);
    assert.equal(figureProgress(oaths).find(f => f.kind === 'speak').whole, true);
    const svg = constellationMarkup(oaths.slice(0, 3));
    assert.match(svg, /cf-figure-guide/, 'the shape still waiting is drawn');
    assert.match(svg, /The Herald · 3\/7/);
    assert.doesNotMatch(svg, /<title>/, 'no plain browser tooltips: the sky has its own peek');
    assert.match(constellationMarkup(oaths), /cf-figure-name is-whole/);
});
