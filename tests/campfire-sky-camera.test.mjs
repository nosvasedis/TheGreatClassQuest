import test from 'node:test';
import assert from 'node:assert/strict';
import { SKY_ZOOM_REST, SKY_ZOOM_LOOK, SKY_ZOOM_MIN, SKY_ZOOM_MAX, clampSkyZoom, zoomSky, skyStarScreen } from '../features/campfireSkyCamera.mjs';

const box = { left: 80, top: 20, width: 800, height: 200 };

test('looking up is an optical zoom of the rest sky, not a new map', () => {
    assert.equal(SKY_ZOOM_REST, 1);
    assert.ok(SKY_ZOOM_LOOK >= SKY_ZOOM_REST);
    assert.ok(SKY_ZOOM_LOOK <= SKY_ZOOM_MAX);
    assert.equal(clampSkyZoom(SKY_ZOOM_REST), 1);
    assert.equal(zoomSky(SKY_ZOOM_LOOK, 0), SKY_ZOOM_LOOK);
    assert.equal(zoomSky(SKY_ZOOM_MIN, -1), SKY_ZOOM_MIN);
    assert.equal(zoomSky(SKY_ZOOM_MAX, 1), SKY_ZOOM_MAX);
});

test('zoom scales distance between the same two stars; order never flips', () => {
    const restA = skyStarScreen(100, 80, { box, zoom: SKY_ZOOM_REST });
    const restB = skyStarScreen(300, 80, { box, zoom: SKY_ZOOM_REST });
    const lookA = skyStarScreen(100, 80, { box, zoom: SKY_ZOOM_LOOK, lookY: 180 });
    const lookB = skyStarScreen(300, 80, { box, zoom: SKY_ZOOM_LOOK, lookY: 180 });
    const inA = skyStarScreen(100, 80, { box, zoom: SKY_ZOOM_LOOK + 0.8, lookY: 180 });
    const inB = skyStarScreen(300, 80, { box, zoom: SKY_ZOOM_LOOK + 0.8, lookY: 180 });
    const unlifted = skyStarScreen(100, 80, { box, zoom: SKY_ZOOM_LOOK, lookY: 0 });
    const restGap = restB.x - restA.x;
    assert.ok(restA.x < restB.x);
    assert.ok(lookA.x < lookB.x);
    assert.ok(inA.x < inB.x);
    assert.ok(Math.abs((lookB.x - lookA.x) - restGap * SKY_ZOOM_LOOK) < 0.001);
    assert.ok(Math.abs((inB.x - inA.x) - restGap * (SKY_ZOOM_LOOK + 0.8)) < 0.001);
    assert.ok(Math.abs((lookB.y - lookA.y) - (restB.y - restA.y) * SKY_ZOOM_LOOK) < 0.001);
    assert.ok(Math.abs((lookA.y - unlifted.y) - 180) < 0.001);
});
