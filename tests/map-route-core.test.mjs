import test from 'node:test';
import assert from 'node:assert/strict';
import { cubicBezier, assignStableMapLanes, getRoutePoint } from '../features/questWorld/mapRouteCore.mjs';

test('cubicBezier keeps the ends fixed and matches a linear curve', () => {
    const ease = cubicBezier(0.3, 0.02, 0.16, 1);
    assert.ok(Math.abs(ease(0)) < 1e-6);
    assert.ok(Math.abs(ease(1) - 1) < 1e-6);
    assert.ok(ease(0.5) > 0.5, 'an ease-out curve is ahead at the halfway point');
    const linear = cubicBezier(0, 0, 1, 1);
    for (const t of [0.1, 0.25, 0.5, 0.9]) assert.ok(Math.abs(linear(t) - t) < 1e-4);
});

test('parties close on the road get side-by-side lanes that stay put', () => {
    const items = [
        { tokenKey: 'c', pct: 41 },
        { tokenKey: 'a', pct: 40 },
        { tokenKey: 'b', pct: 42 },
        { tokenKey: 'z', pct: 80 },
    ];
    assignStableMapLanes(items);
    const lane = Object.fromEntries(items.map((i) => [i.tokenKey, i.lane]));
    assert.deepEqual(lane, { a: 0, b: -1, c: 1, z: 0 });

    // the same parties a little further on keep the same lanes
    const later = items.map((i) => ({ tokenKey: i.tokenKey, pct: i.pct + 2 }));
    assignStableMapLanes(later);
    assert.deepEqual(Object.fromEntries(later.map((i) => [i.tokenKey, i.lane])), lane);
});

test('getRoutePoint walks a straight segment and gives its normal', () => {
    // a horizontal road 100 units long from (0, 50) to (100, 50)
    const path = { getPointAtLength: (len) => ({ x: len, y: 50 }) };
    const segments = [
        { minProgress: 0, maxProgress: 50, totalLength: 100, path },
        { minProgress: 50, maxProgress: 100, totalLength: 100, path: { getPointAtLength: (len) => ({ x: 100, y: 50 + len }) } },
    ];
    const quarter = getRoutePoint(segments, 25);
    assert.equal(quarter.x, 50);
    assert.equal(quarter.y, 50);
    assert.ok(Math.abs(quarter.normalX - 0) < 1e-9 && Math.abs(quarter.normalY - 1) < 1e-9);
    // out-of-range progress is clamped onto the road
    assert.deepEqual(getRoutePoint(segments, -10).x, 0);
    const end = getRoutePoint(segments, 140);
    assert.equal(end.x, 100);
    assert.equal(end.y, 150);
});
