import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CAMERA_LIMITS,
    cameraOn,
    clampCamera,
    describeRoadSpot,
    footstepPlan,
    measureTrail,
    nearestOnRoad,
    trailPath,
    trailPoints,
    worldToFrame,
    zoomAround
} from '../features/questWorld/mapJourney.mjs';
import { pointAtProgress } from '../features/questWorld/worldGeometry.mjs';

test('a trail follows the road from one share of the journey to another', () => {
    const points = trailPoints(10, 30);
    assert.ok(points.length > 20);
    const start = pointAtProgress(10);
    const end = pointAtProgress(30);
    assert.ok(Math.hypot(points[0].x - start.x, points[0].y - start.y) < 0.01);
    assert.ok(Math.hypot(points.at(-1).x - end.x, points.at(-1).y - end.y) < 0.01);
    assert.deepEqual(trailPoints(30, 10), [], 'no trail backwards');
    const d = trailPath(0, 50);
    assert.match(d, /^M[\d.]+ [\d.]+ L/);
    assert.doesNotMatch(d, /NaN|undefined/);
    assert.equal(trailPath(40, 40), '');
});

test('trail lengths grow along the road and shares run from 0 to 1', () => {
    const { total, shares } = measureTrail(trailPoints(0, 100, 1));
    assert.ok(total > 1500, `the road is ${Math.round(total)} long`);
    assert.equal(shares[0], 0);
    assert.equal(shares.at(-1), 1);
    shares.slice(1).forEach((share, i) => assert.ok(share >= shares[i]));
});

test('the nearest spot on the road is found from a point beside it', () => {
    [5, 27, 48, 66, 83, 97].forEach((progress) => {
        const point = pointAtProgress(progress);
        const near = nearestOnRoad(point.x + point.normalX * 8, point.y + point.normalY * 8);
        assert.ok(Math.abs(near.progress - progress) <= 1, `${progress}% found as ${near.progress}%`);
        assert.ok(near.distance < 10);
    });
    assert.ok(nearestOnRoad(1590, 890).distance > 40, 'a far corner is not on the road');
});

test('a spot on the road says its realm and how far a party is from it', () => {
    const party = { name: 'Junior B', progress: 34, stars: 48, goal: 140 };
    const ahead = describeRoadSpot(73, party);
    assert.equal(ahead.realm, 'Golden Citadel');
    assert.equal(ahead.passed, false);
    assert.equal(ahead.starsAway, Math.ceil(140 * 0.73 - 48));
    assert.equal(ahead.starsLabel, `${ahead.starsAway}★`);
    const behind = describeRoadSpot(20, party);
    assert.equal(behind.passed, true);
    assert.equal(behind.realm, 'Bronze Meadows');
    const bare = describeRoadSpot(90);
    assert.equal(bare.percent, 90);
    assert.equal(bare.party, undefined);
    assert.ok(describeRoadSpot(34.5, party).starsAway >= 1, 'a spot just ahead is at least a star away');
});

test('footsteps fall along the walk, alternate feet and stay in order', () => {
    const steps = footstepPlan(10, 40);
    assert.ok(steps.length >= 8 && steps.length <= 26);
    steps.forEach((step, i) => {
        assert.ok(Number.isFinite(step.x) && Number.isFinite(step.y) && Number.isFinite(step.angle));
        if (i) {
            assert.ok(step.share > steps[i - 1].share);
            assert.notEqual(step.side, steps[i - 1].side);
        }
    });
    assert.deepEqual(footstepPlan(40, 40.5), []);
    assert.ok(footstepPlan(0, 100).length <= 26, 'a long walk is capped');
});

test('the camera never shows past the edge of the world', () => {
    const w = 1200;
    const h = 675;
    assert.deepEqual(clampCamera({ x: 50, y: 50, zoom: 2 }, w, h), { zoom: 2, x: 0, y: 0 });
    assert.deepEqual(clampCamera({ x: -5000, y: -5000, zoom: 2 }, w, h), { zoom: 2, x: -1200, y: -675 });
    assert.equal(clampCamera({ zoom: 9 }, w, h).zoom, CAMERA_LIMITS.max);
    assert.equal(clampCamera({ zoom: 0.2 }, w, h).zoom, 1);
});

test('zooming keeps the spot under the pointer where it was', () => {
    const w = 1200;
    const h = 675;
    const start = { x: -100, y: -60, zoom: 1.5 };
    const px = 420;
    const py = 300;
    const worldBefore = { x: (px - start.x) / start.zoom, y: (py - start.y) / start.zoom };
    const next = zoomAround(start, 1.4, px, py, w, h);
    const worldAfter = { x: (px - next.x) / next.zoom, y: (py - next.y) / next.zoom };
    assert.ok(Math.abs(worldBefore.x - worldAfter.x) < 1e-6 && Math.abs(worldBefore.y - worldAfter.y) < 1e-6);
    assert.equal(zoomAround(start, 0.1, px, py, w, h).zoom, 1, 'zooming far out lands on the whole map');
});

test('the camera can centre a place, as far as the edges allow', () => {
    const w = 1600;
    const h = 900;
    const camera = cameraOn(800, 450, 2, w, h);
    const centre = worldToFrame(800, 450, camera, w, h);
    assert.ok(Math.abs(centre.x - 800) < 1e-6 && Math.abs(centre.y - 450) < 1e-6);
    const corner = cameraOn(0, 0, 2, w, h);
    assert.deepEqual({ x: corner.x, y: corner.y }, { x: 0, y: 0 }, 'a corner stays a corner');
});

test('the road is tinted by realm, blending where two realms meet', async () => {
    const { realmAt, realmRoadPieces, REALM_HUES } = await import('../features/questWorld/mapJourney.mjs');
    assert.equal(realmAt(10), 'bronze');
    assert.equal(realmAt(30), 'silver');
    assert.equal(realmAt(72), 'gold');
    assert.equal(realmAt(99), 'crystal');
    const pieces = realmRoadPieces();
    assert.equal(pieces[0].from, 0);
    assert.equal(pieces[pieces.length - 1].to, 100);
    for (let i = 1; i < pieces.length; i += 1) assert.ok(Math.abs(pieces[i].from - pieces[i - 1].to) < 1e-6, 'pieces join without gaps');
    const middle = (realm) => pieces.find((piece) => piece.realm === realm && piece.to - piece.from > 5);
    assert.equal(middle('silver').light, `rgb(${REALM_HUES.silver.light.join(', ')})`);
    assert.equal(middle('crystal').ink, `rgb(${REALM_HUES.crystal.ink.join(', ')})`);
});
