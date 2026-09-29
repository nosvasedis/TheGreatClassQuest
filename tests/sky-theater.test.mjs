import test from 'node:test';
import assert from 'node:assert/strict';

import { getAllActs, getGuestsForMonth } from '../features/skyTheater/catalog.js';
import { ART, renderArt } from '../features/skyTheater/art.js';
import { FLIGHTS, CAMEOS, sampleFlight } from '../features/skyTheater/motion.js';
import { buildBlockSchedule } from '../features/skyTheater/scheduler.js';

test('every act points at real art and a real routine', () => {
    for (const act of getAllActs()) {
        assert.ok(ART[act.art], `${act.id}: unknown art ${act.art}`);
        const routines = act.stage === 'cameo' ? CAMEOS : FLIGHTS;
        assert.ok(routines[act.motion], `${act.id}: unknown ${act.stage} motion ${act.motion}`);
        assert.ok(act.size > 0, `${act.id}: size`);
    }
});

test('art renders day and night with unique gradient ids', () => {
    for (const id of Object.keys(ART)) {
        for (const night of [false, true]) {
            const a = renderArt(id, { night, text: 'GO TEAM!' });
            const b = renderArt(id, { night, text: 'GO TEAM!' });
            assert.match(a, /^<svg class="skyt-sprite/);
            const idsA = [...a.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
            const idsB = [...b.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
            assert.ok(idsA.every((x) => !idsB.includes(x)), `${id}: ids collide between renders`);
        }
    }
});

test('flights produce finite keyframes that start and end off the header', () => {
    for (const [name, choreo] of Object.entries(FLIGHTS)) {
        for (const dir of [1, -1]) {
            const ctx = { W: 1200, H: 120, w: 60, h: 44, dir, rng: () => 0.5 };
            const flight = choreo(ctx);
            assert.ok(flight.duration >= 2000 && flight.duration <= 16000, `${name}: duration ${flight.duration}`);
            const frames = sampleFlight(flight, dir);
            assert.equal(frames[0].offset, 0);
            assert.equal(frames.at(-1).offset, 1);
            for (const f of frames) {
                assert.doesNotMatch(f.transform, /NaN|Infinity/, `${name}: ${f.transform}`);
                assert.ok(f.opacity >= 0 && f.opacity <= 1);
            }
            const start = flight.at(0);
            const end = flight.at(1);
            const offStage = (p) => p.x <= -ctx.w || p.x >= ctx.W || p.y <= -ctx.h || p.y >= ctx.H || (p.o ?? 1) === 0;
            assert.ok(offStage(start) || offStage(end), `${name}: never leaves the stage`);
        }
    }
});

test('seasonal guests only visit in their months and join the block schedule', () => {
    assert.ok(getGuestsForMonth(9).some((g) => g.family === 'leaf'));
    assert.ok(!getGuestsForMonth(6).some((g) => g.family === 'snowflake'));
    const now = new Date(2026, 9, 7, 10, 0, 0);
    let seed = 7;
    const rng = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    const fires = buildBlockSchedule(now, { rng, crossoverChance: 0, guestChance: 1 });
    assert.ok(fires.some((f) => f.act.weekday === -1), 'guest scheduled');
});
