import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BEYOND_MAX,
    beyondLanes,
    beyondLitShare,
    beyondMarkFor,
    beyondPoint,
    beyondShare,
    beyondStones,
    isBeyond,
    nextBeyondMark
} from '../features/questWorld/starwardWay.mjs';
import { readFileSync } from 'node:fs';
import { crystalSkyHtml, crystalSkyInkSvg, skyWayHtml } from '../features/questWorld/crystalSky.mjs';
import { describePlace, placeTipHtml } from '../features/questWorld/placeTips.mjs';
import { describeQuestRaceGaps, describeQuestRaceLine } from '../features/teamQuestRace.mjs';

test('a party steps onto the Starward Way just past its goal and stops at the Star Crown', () => {
    assert.equal(isBeyond(100), false);
    assert.equal(isBeyond(100.6), false);
    assert.equal(isBeyond(121), true);
    assert.equal(beyondShare(100), 0);
    assert.equal(beyondShare(125), 0.5);
    assert.equal(beyondShare(BEYOND_MAX), 1);
    assert.equal(beyondShare(240), 1);
    assert.deepEqual(beyondPoint(240), beyondPoint(BEYOND_MAX));
});

test('the Way rises out of the cloud sea and climbs the Crystal Sky to the Crown', () => {
    const start = beyondPoint(100);
    const crown = beyondPoint(BEYOND_MAX);
    assert.ok(start.y > 800, 'starts low, at the Portal in the clouds');
    assert.ok(crown.y < 200, 'ends high, at the Crown');
    assert.ok(beyondPoint(105).y < 790, 'the first stone is already above the clouds');
    for (let reach = 100; reach <= BEYOND_MAX; reach += 2.5) {
        const point = beyondPoint(reach);
        assert.ok(point.x > 120 && point.x < 1480, `inside the sky at ${reach}%: ${point.x}`);
        assert.ok(point.y > 100 && point.y < 900, `inside the sky at ${reach}%: ${point.y}`);
    }
    // Every 5% of the goal is about the same distance along the Way.
    const steps = [];
    for (let reach = 105; reach <= BEYOND_MAX; reach += 5) {
        const a = beyondPoint(reach - 5);
        const b = beyondPoint(reach);
        steps.push(Math.hypot(b.x - a.x, b.y - a.y));
    }
    assert.ok(Math.max(...steps) / Math.min(...steps) < 1.25);
    assert.equal(beyondLitShare(100), 0);
    assert.ok(beyondLitShare(125) > 0.5 && beyondLitShare(125) < 0.56);
    assert.equal(Math.round(beyondLitShare(BEYOND_MAX) * 1000), 1000);
});

test('the Crystal Sky is drawn once and moves only by transform and opacity', () => {
    const html = crystalSkyHtml({ vortexSrc: 'v.webp', wayHtml: skyWayHtml(121) });
    assert.match(html, /tqs-isle/);
    assert.match(html, /tqs-portal/);
    assert.match(html, /Moonstep/);
    assert.match(html, /is-reached/);
    assert.match(crystalSkyInkSvg(), /tq-living-map__ink-sky/);
    const css = readFileSync(new URL('../styles/quest_sky.css', import.meta.url), 'utf8');
    const frames = [...css.matchAll(/@keyframes\s+[\w-]+\s*\{([\s\S]*?)\}\s*\}/g)].map((match) => match[1]);
    assert.ok(frames.length > 5);
    frames.forEach((body) => {
        const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]);
        props.forEach((prop) => assert.ok(['transform', 'opacity', 'translate'].includes(prop), `keyframes animate ${prop}`));
    });
});

test('stones light up as far as the furthest party, with named marks', () => {
    const stones = beyondStones(121);
    assert.equal(stones.length, 10);
    assert.deepEqual(stones.filter((stone) => stone.lit).map((stone) => stone.at), [105, 110, 115, 120]);
    assert.equal(stones.find((stone) => stone.at === 110).kind, 'knot');
    assert.equal(stones.at(-1).kind, 'crown');
    assert.equal(beyondMarkFor(121).label, 'Moonstep');
    assert.equal(nextBeyondMark(121).label, 'Comet’s Rest');
    assert.equal(beyondMarkFor(104), null);
    assert.equal(nextBeyondMark(160), null);
});

test('parties close together on the Way walk side by side', () => {
    const lanes = beyondLanes([{ key: 'a', reach: 121 }, { key: 'b', reach: 123 }, { key: 'c', reach: 140 }, { key: 'd', reach: 190 }, { key: 'e', reach: 155 }]);
    assert.equal(lanes.get('a'), 0);
    assert.equal(lanes.get('b'), 1);
    assert.equal(lanes.get('c'), 0);
    // Past the Crown they all wait on it: side by side.
    assert.deepEqual([lanes.get('e'), lanes.get('d')].sort(), [0, 1]);
});

test('the Portal and the Way cards show the real share past the goal', () => {
    const parties = [
        { name: 'Junior A', logo: '🦉', progress: 100, reach: 121, inside: true },
        { name: 'Junior B', logo: '📚', progress: 100, reach: 100.2, inside: true },
        { name: 'Junior C', logo: '🌟', progress: 80, reach: 80, inside: false }
    ];
    const portal = placeTipHtml(describePlace('portal', parties));
    assert.match(portal, /121%/);
    assert.doesNotMatch(portal, />100%</);
    const way = describePlace('beyond', parties);
    assert.equal(way.climbing, 1);
    assert.equal(way.here[0].name, 'Junior A');
    const html = placeTipHtml(way);
    assert.match(html, /The Starward Way/);
    assert.match(html, /Junior A has reached Moonstep/);
    const empty = describePlace('beyond', [{ name: 'Junior C', progress: 80, inside: false }]);
    assert.equal(empty.status, 'ahead');
});

test('the race gap counts the stars past the goal too', () => {
    const gaps = describeQuestRaceGaps([
        { id: 'a', name: 'Junior A', progress: (221 / 140) * 100, currentMonthlyStars: 221, goals: { diamond: 140 } },
        { id: 'b', name: 'Junior B', progress: 127, currentMonthlyStars: 178, goals: { diamond: 140 } }
    ]);
    assert.equal(describeQuestRaceLine(gaps.get('b')), '43★ to catch Junior A');
});
