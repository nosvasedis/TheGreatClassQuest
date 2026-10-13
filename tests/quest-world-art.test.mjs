import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    ART_VERSION,
    PAINTED_PROPS,
    SEASONS,
    STAIR_STEPS,
    WATER_GLINTS,
    WORLD_SEED,
    buildWorldArt,
    paintingFor
} from '../features/questWorld/worldArt.mjs';
import { SCENE_TIERS, scenePlan, WORLD_W, WORLD_H, pointAtProgress } from '../features/questWorld/worldGeometry.mjs';

const art = buildWorldArt(WORLD_SEED, 'autumn');
const fileOf = (url) => fileURLToPath(url);

test('every season has its painting at both sizes, and the files are shipped', () => {
    assert.deepEqual([...SEASONS].sort(), ['autumn', 'spring', 'summer', 'winter']);
    const lands = new Set();
    SEASONS.forEach((season) => {
        [1600, 2560].forEach((width) => {
            const { land, lights } = paintingFor(season, width);
            assert.match(land, new RegExp(`land-${season}-${width}\\.webp$`));
            assert.ok(existsSync(fileOf(land)), `${season} ${width} is in the repo`);
            assert.ok(existsSync(fileOf(lights)), 'night lights are in the repo');
            lands.add(land);
        });
    });
    assert.equal(lands.size, 8, 'four seasons at two sizes');
    assert.equal(paintingFor('nonsense', 1600).land, paintingFor('autumn', 1600).land, 'unknown seasons fall back to autumn');
    assert.equal(buildWorldArt(WORLD_SEED, 'nonsense').season, 'autumn');
    assert.equal(art.version, ART_VERSION);
});

test('the painted pictures stay light enough for a weak school laptop', () => {
    SEASONS.forEach((season) => {
        const small = statSync(fileOf(paintingFor(season, 1600).land)).size;
        const big = statSync(fileOf(paintingFor(season, 2560).land)).size;
        assert.ok(small < 420_000, `${season} 1600 is ${small} bytes`);
        assert.ok(big < 900_000, `${season} 2560 is ${big} bytes`);
    });
    const props = [...PAINTED_PROPS.clouds, PAINTED_PROPS.seal, PAINTED_PROPS.ribbon, PAINTED_PROPS.sketch, PAINTED_PROPS.lights];
    props.forEach((url) => {
        assert.ok(existsSync(fileOf(url)), `${url} is in the repo`);
        assert.ok(statSync(fileOf(url)).size < 260_000, `${url} is small`);
    });
    assert.equal(PAINTED_PROPS.cloudRatios.length, PAINTED_PROPS.clouds.length);
});

test('sprites sit in the world, carry markup and fit the tier caps', () => {
    SEASONS.forEach((season) => {
        const built = buildWorldArt(WORLD_SEED, season);
        const ids = new Set();
        built.sprites.forEach((sprite) => {
            assert.ok(!ids.has(sprite.id), `${sprite.id} is unique`);
            ids.add(sprite.id);
            assert.ok(['back', 'mid'].includes(sprite.slot), `${sprite.id} slot`);
            assert.ok(['lite', 'full'].includes(sprite.tier), `${sprite.id} tier`);
            assert.ok(sprite.w > 0 && sprite.h > 0, `${sprite.id} has a size`);
            assert.ok(sprite.x + sprite.w > 0 && sprite.x < WORLD_W && sprite.y + sprite.h > 0 && sprite.y < WORLD_H, `${sprite.id} is in view`);
            assert.ok(sprite.html.length > 0);
            assert.doesNotMatch(sprite.html, /NaN|undefined/);
            assert.doesNotMatch(sprite.html, /<script/i);
        });
        const lite = built.sprites.filter((sprite) => sprite.tier === 'lite');
        assert.ok(lite.length >= 6, 'lite still has the islets, the waterfall and some sparkle');
        assert.ok(lite.length <= SCENE_TIERS.lite.maxSprites, 'every lite piece survives the lite cap');
        assert.ok(built.sprites.length <= SCENE_TIERS.full.maxSprites, 'every piece survives the full cap');
        assert.deepEqual(scenePlan('lite', built.sprites).sprites.map((s) => s.id), lite.map((s) => s.id));
        const islets = built.sprites.filter((sprite) => sprite.kind === 'islet');
        assert.ok(islets.every((sprite) => sprite.html.includes(`islet-${built.season}-`)), 'islets wear the season');
    });
});

test('water glints sparkle on the water, below the mountains', () => {
    assert.ok(WATER_GLINTS.length >= 12);
    WATER_GLINTS.forEach(([x, y]) => assert.ok(x > 0 && x < WORLD_W && y > 480 && y <= WORLD_H, `glint at ${x},${y}`));
});

test('the road climbs the painted stair to the Portal', () => {
    for (let p = 85; p <= 98; p += 0.5) {
        const point = pointAtProgress(p);
        const near = Math.min(...STAIR_STEPS.map(([x, y]) => Math.hypot(x - point.x, y - point.y)));
        assert.ok(near < 32, `road at ${p}% is ${Math.round(near)} from the stair`);
    }
});

test('landmarks, lanterns and realm clouds line up with the realms', () => {
    assert.deepEqual(Object.keys(art.landmarks).sort(), ['bronze', 'crystal', 'gold', 'silver']);
    Object.values(art.landmarks).forEach(({ x, y }) => assert.ok(x > 0 && x < WORLD_W && y > 40 && y < WORLD_H));
    assert.deepEqual(art.mists.map((mist) => mist.realm), ['silver', 'gold', 'crystal']);
    art.mists.forEach((mist) => {
        assert.ok(mist.blobs.length >= 4, `${mist.realm} has enough cloud to hide it`);
        mist.blobs.forEach(([x, y, w, cloud]) => {
            assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1 && w > 0 && w <= 1, `${mist.realm} puff in its box`);
            assert.ok(PAINTED_PROPS.clouds[cloud], `${mist.realm} puff uses a painted cloud`);
        });
    });
    assert.ok(art.lanterns.length >= 8);
});

test('the world stylesheet animates only transform and opacity and follows the app sky', () => {
    const css = readFileSync(new URL('../styles/quest_world.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const keyframes = css.match(/@keyframes [\w-]+\s*\{(?:[^{}]*\{[^{}]*\})+\s*\}/g) || [];
    assert.ok(keyframes.length >= 25, 'keyframes found');
    keyframes.forEach((block) => {
        const props = [...block.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]);
        props.forEach((prop) => assert.ok(['transform', 'opacity'].includes(prop), `${block.split('{')[0].trim()} animates ${prop}`));
    });
    assert.ok(keyframes.every((block) => /@keyframes tqw-/.test(block)), 'keyframes are prefixed tqw- (no clashes)');
    const names = new Set(keyframes.map((block) => block.match(/@keyframes ([\w-]+)/)[1]));
    const used = [...css.matchAll(/animation(?:-name)?\s*:\s*([^;]+);/g)].flatMap((match) => match[1].match(/tqw-[\w-]+/g) || []);
    used.forEach((name) => assert.ok(names.has(name), `${name} is defined`));
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /is-motion-paused/);
    assert.match(css, /var\(--wx-sky-1/, 'the sky uses the app palette');
    assert.match(css, /var\(--wx-slant/, 'rain follows the wind');
});
