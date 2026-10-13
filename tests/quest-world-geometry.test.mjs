import test from 'node:test';
import assert from 'node:assert/strict';

import { QUEST_MAP_ZONES } from '../features/questMapZones.mjs';
import { QUEST_ROAD_STOPS } from '../features/teamQuestRace.mjs';
import {
    LANTERN_STOPS,
    REALM_BREAKS,
    REALM_LANDMARKS,
    ROUTE_POINTS,
    SCENE_TIERS,
    WORLD_H,
    WORLD_W,
    catmullRomBeziers,
    PORTAL,
    REALM_PLACES,
    SAFE_MARGIN,
    dayPhase,
    furthestRealm,
    landGrade,
    seasonFor,
    lanternPositions,
    litLanternCount,
    pointAtProgress,
    realmStates,
    resolveSceneTier,
    routeSegments,
    scenePlan
} from '../features/questWorld/worldGeometry.mjs';

const inWorld = ({ x, y }) => x >= 0 && x <= WORLD_W && y >= 0 && y <= WORLD_H;

test('the road is one unbroken line through the four realms', () => {
    const segments = routeSegments();
    assert.deepEqual(segments.map((segment) => segment.id), ['bronze', 'silver', 'gold', 'crystal']);
    for (let i = 1; i < segments.length; i += 1) {
        const previousEnd = segments[i - 1].curves.at(-1)[3];
        const start = segments[i].curves[0][0];
        assert.deepEqual(start, previousEnd, `${segments[i].id} starts where ${segments[i - 1].id} ends`);
        assert.equal(segments[i].minProgress, segments[i - 1].maxProgress);
    }
    assert.equal(segments[0].minProgress, 0);
    assert.equal(segments.at(-1).maxProgress, 100);
    segments.forEach((segment) => assert.match(segment.d, /^M [\d.]+ [\d.]+ C /));
});

test('realm breaks match the realms the rest of the app uses', () => {
    assert.deepEqual(
        REALM_BREAKS.map(({ id, progress }) => [id, progress]),
        QUEST_MAP_ZONES.map(({ id, minPercent }) => [id, minPercent])
    );
    assert.deepEqual(
        QUEST_ROAD_STOPS.filter((stop) => stop.progress < 100).map((stop) => stop.progress),
        REALM_BREAKS.slice(1).map((realm) => realm.progress)
    );
});

test('neighbouring curve pieces share their tangent (no kinks at realm gates)', () => {
    const curves = catmullRomBeziers(ROUTE_POINTS);
    for (let i = 1; i < curves.length; i += 1) {
        const [, , inbound, joint] = curves[i - 1];
        const [, outbound] = curves[i];
        const a = Math.atan2(joint[1] - inbound[1], joint[0] - inbound[0]);
        const b = Math.atan2(outbound[1] - joint[1], outbound[0] - joint[0]);
        const turn = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
        assert.ok(turn < 0.02, `joint ${i} turns by ${turn.toFixed(3)} rad`);
    }
});

test('progress walks the road from the meadow start to the Portal', () => {
    const start = pointAtProgress(0);
    const end = pointAtProgress(100);
    assert.deepEqual([Math.round(start.x), Math.round(start.y)], ROUTE_POINTS[0]);
    assert.deepEqual([Math.round(end.x), Math.round(end.y)], ROUTE_POINTS.at(-1));
    REALM_BREAKS.forEach(({ index, progress }) => {
        const point = pointAtProgress(progress);
        assert.ok(Math.hypot(point.x - ROUTE_POINTS[index][0], point.y - ROUTE_POINTS[index][1]) < 1, `realm gate at ${progress}%`);
    });
    for (let p = 0; p <= 100; p += 2.5) {
        const point = pointAtProgress(p);
        assert.ok(inWorld(point), `${p}% stays inside the world`);
        assert.ok(Math.abs(Math.hypot(point.normalX, point.normalY) - 1) < 1e-6);
    }
    assert.deepEqual(pointAtProgress(-20), pointAtProgress(0));
    assert.deepEqual(pointAtProgress(Number.NaN), pointAtProgress(0));
    assert.deepEqual(pointAtProgress(180), pointAtProgress(100));
});

test('landmarks and lanterns stand inside the world', () => {
    Object.values(REALM_LANDMARKS).forEach((spot) => assert.ok(inWorld(spot)));
    const lanterns = lanternPositions();
    assert.equal(lanterns.length, LANTERN_STOPS.length);
    lanterns.forEach((lantern) => assert.ok(inWorld(lantern)));
});

test('lanterns light up to the furthest party', () => {
    assert.equal(litLanternCount(0), 0);
    assert.equal(litLanternCount(LANTERN_STOPS[0]), 1);
    assert.equal(litLanternCount(50), LANTERN_STOPS.filter((stop) => stop <= 50).length);
    assert.equal(litLanternCount(100), LANTERN_STOPS.length);
});

test('realms sleep until a party reaches them, and stir just before', () => {
    assert.deepEqual(realmStates(0), { bronze: 'awake', silver: 'asleep', gold: 'asleep', crystal: 'asleep' });
    assert.deepEqual(realmStates(22), { bronze: 'awake', silver: 'waking', gold: 'asleep', crystal: 'asleep' });
    assert.deepEqual(realmStates(30), { bronze: 'awake', silver: 'awake', gold: 'asleep', crystal: 'asleep' });
    assert.deepEqual(realmStates(84.9), { bronze: 'awake', silver: 'awake', gold: 'awake', crystal: 'waking' });
    assert.deepEqual(realmStates(100), { bronze: 'awake', silver: 'awake', gold: 'awake', crystal: 'awake' });
    assert.equal(furthestRealm(0), 'bronze');
    assert.equal(furthestRealm(59.9), 'silver');
    assert.equal(furthestRealm(60), 'gold');
    assert.equal(furthestRealm(97), 'crystal');
});

test('each tier runs within its caps, and lite keeps only lite pieces', () => {
    const sprites = Array.from({ length: 80 }, (_, i) => ({ id: `s${i}`, tier: i % 3 === 0 ? 'lite' : 'full' }));
    const full = scenePlan('full', sprites);
    const lite = scenePlan('lite', sprites);
    const still = scenePlan('still', sprites);
    assert.ok(full.sprites.length <= SCENE_TIERS.full.maxSprites);
    assert.ok(lite.sprites.length <= SCENE_TIERS.lite.maxSprites);
    assert.ok(lite.sprites.every((sprite) => sprite.tier === 'lite'));
    assert.ok(still.sprites.every((sprite) => sprite.tier === 'lite'));
    assert.equal(lite.parallax, false);
    assert.equal(lite.tilt, 0);
    assert.equal(still.tilt, 0);
    assert.ok(full.tilt > 0 && full.tilt <= 8, 'the diorama tilt stays gentle');
    assert.equal(scenePlan('unknown', sprites).maxSprites, SCENE_TIERS.lite.maxSprites);
});

test('the tier follows reduced motion first, then the effects setting', () => {
    assert.equal(resolveSceneTier({ fx: 'full', reducedMotion: true }), 'still');
    assert.equal(resolveSceneTier({ fx: 'lite' }), 'lite');
    assert.equal(resolveSceneTier({ fx: 'full' }), 'full');
    assert.equal(resolveSceneTier(), 'full');
});

test('the sky follows the time of day', () => {
    const at = (hours, minutes = 0) => new Date(2026, 9, 12, hours, minutes).getTime();
    const solar = { sunrise: at(7, 30), sunset: at(18, 45) };
    assert.equal(dayPhase(at(9), solar), 'morning');
    assert.equal(dayPhase(at(14), solar), 'afternoon');
    assert.equal(dayPhase(at(18), solar), 'evening');
    assert.equal(dayPhase(at(19, 30), solar), 'night');
    assert.equal(dayPhase(at(6), solar), 'night');
    // Without solar times it falls back to 06:30 / 20:30.
    assert.equal(dayPhase(at(20)), 'evening');
    assert.equal(dayPhase(at(21)), 'night');
});

test('the road and the realm places stay on the map (nothing clipped by the frame)', () => {
    for (let p = 0; p <= 100; p += 1) {
        const point = pointAtProgress(p);
        assert.ok(point.x >= SAFE_MARGIN + 60 && point.x <= WORLD_W - SAFE_MARGIN, `road x at ${p}%: ${point.x}`);
        assert.ok(point.y >= SAFE_MARGIN + 60 && point.y <= WORLD_H - SAFE_MARGIN, `road y at ${p}%: ${point.y}`);
    }
    REALM_PLACES.forEach((place) => {
        assert.ok(place.x - place.rx >= 0 && place.x + place.rx <= WORLD_W, `${place.id} place x`);
        assert.ok(place.y - place.ry >= 0 && place.y + place.ry <= WORLD_H, `${place.id} place y`);
    });
    for (let i = 0; i < REALM_PLACES.length; i += 1) {
        for (let j = i + 1; j < REALM_PLACES.length; j += 1) {
            const a = REALM_PLACES[i];
            const b = REALM_PLACES[j];
            assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > Math.max(a.rx, b.rx), `${a.id} and ${b.id} places are apart`);
        }
    }
    assert.deepEqual(REALM_PLACES.map((place) => place.progress), REALM_BREAKS.map((realm) => realm.progress));
});

test('the citadel never stands on the road', () => {
    // The citadel's towers and walls (world boxes) and the road between them.
    const buildings = [[992, 454, 1032, 552], [1000, 486, 1300, 546], [1288, 454, 1328, 552]];
    for (let p = 55; p <= 90; p += 0.25) {
        const point = pointAtProgress(p);
        buildings.forEach(([x0, y0, x1, y1]) => {
            const inside = point.x > x0 - 16 && point.x < x1 + 16 && point.y > y0 - 16 && point.y < y1 + 16;
            assert.ok(!inside, `road at ${p}% (${Math.round(point.x)}, ${Math.round(point.y)}) runs into the citadel`);
        });
    }
});

test('the Crystal Realm stands clear of the citadel', () => {
    const isleLeft = PORTAL.x - 114;
    assert.ok(isleLeft > 1328 + 30, `the portal isle starts at ${isleLeft}, the citadel ends at 1328`);
});

test('the land follows the season', () => {
    const at = (month) => new Date(2026, month, 15).getTime();
    assert.equal(seasonFor(at(9)), 'autumn');
    assert.equal(seasonFor(at(0)), 'winter');
    assert.equal(seasonFor(at(3)), 'spring');
    assert.equal(seasonFor(at(6)), 'summer');
    assert.equal(seasonFor(at(11)), 'winter');
});

test('the land is graded for the light and the weather of the shared sky', () => {
    const day = landGrade('day', 'fair');
    assert.equal(day.key, 'day-fair');
    assert.equal(day.lights, 0, 'no lit windows on a fair day');
    const night = landGrade('night', 'fair');
    assert.equal(night.lights, 1, 'every window lit at night');
    assert.ok(night.brightness < day.brightness && night.saturate < day.saturate);
    const storm = landGrade('day', 'storm');
    assert.ok(storm.brightness < day.brightness, 'a storm darkens the land');
    assert.ok(storm.lights > 0, 'windows glow under a storm');
    assert.ok(storm.glowAlpha < landGrade('day', 'fair').glowAlpha, 'grey skies soften the sun');
    assert.equal(landGrade('nonsense', 'nonsense').key, 'day-fair');
    ['dawn', 'day', 'golden', 'twilight', 'night'].forEach((light) => {
        ['fair', 'grey', 'rain', 'storm', 'snow', 'fog', 'ice'].forEach((tone) => {
            const grade = landGrade(light, tone);
            assert.ok(grade.saturate > 0.2 && grade.saturate <= 1.2, `${light}-${tone} saturate`);
            assert.ok(grade.brightness > 0.4 && grade.brightness <= 1.2, `${light}-${tone} brightness`);
            assert.ok(grade.lights >= 0 && grade.lights <= 1);
        });
    });
});

test('the Portal ring sits at the end of the road, inside the map', () => {
    const end = pointAtProgress(100);
    assert.equal(PORTAL.x, Math.round(end.x));
    assert.ok(PORTAL.y < end.y - PORTAL.r * 0.9, 'the ring stands above where the road arrives');
    assert.ok(PORTAL.y - PORTAL.r - 40 > 0 && PORTAL.x + PORTAL.r + 30 < WORLD_W, 'ring and crown are on the map');
});
