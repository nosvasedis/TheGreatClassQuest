import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    ART_VERSION,
    RIVER_CENTRE,
    SEASON_PALETTES,
    STREAM_CENTRE,
    WORLD_SEED,
    buildWorldArt,
    crossingProgress,
    massifRidgeY,
    mixColour
} from '../features/questWorld/worldArt.mjs';
import { SCENE_TIERS, scenePlan, WORLD_W, WORLD_H, pointAtProgress } from '../features/questWorld/worldGeometry.mjs';

const art = buildWorldArt(WORLD_SEED, 'autumn');

function assertWellFormedSvg(svg, label) {
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, `${label} is an SVG document`);
    assert.ok(svg.endsWith('</svg>'), `${label} closes`);
    assert.doesNotMatch(svg, /NaN|undefined|Infinity|\[object/, `${label} has no broken numbers`);
    const opened = (svg.match(/<(svg|g|defs|linearGradient|radialGradient|clipPath)[\s>]/g) || []).length;
    const closed = (svg.match(/<\/(svg|g|defs|linearGradient|radialGradient|clipPath)>/g) || []).length;
    assert.equal(opened, closed, `${label} closes every group`);
    assert.doesNotMatch(svg, /<(script|foreignObject|image)\b/, `${label} stays pure vector`);
    assert.doesNotMatch(svg, /url\((?!#)/, `${label} loads nothing from outside`);
}

test('every paint pass is a well-formed, self-contained SVG or a known texture', () => {
    for (const [name, layer] of Object.entries(art.layers)) {
        assert.ok(layer.passes.length >= 2, `${name} has passes`);
        layer.passes.forEach((pass, i) => {
            if (pass.svg) assertWellFormedSvg(pass.svg, `${name} pass ${i}`);
            else assert.ok(['brush', 'grain'].includes(pass.texture), `${name} pass ${i} texture`);
            if (pass.op) assert.ok(['multiply', 'screen', 'soft-light', 'source-over'].includes(pass.op));
        });
    }
    assertWellFormedSvg(art.lights.halo, 'night halo');
    assertWellFormedSvg(art.lights.panes, 'night panes');
});

test('the art is the same every time for the same seed and season', () => {
    const again = buildWorldArt(WORLD_SEED, 'autumn');
    assert.deepEqual(again.layers.mid.passes.map((p) => p.svg), art.layers.mid.passes.map((p) => p.svg));
    assert.deepEqual(again.layers.far.passes.map((p) => p.svg), art.layers.far.passes.map((p) => p.svg));
    assert.equal(art.version, ART_VERSION);
});

test('each season paints its own land, and every season builds cleanly', () => {
    const seasons = Object.keys(SEASON_PALETTES);
    assert.deepEqual(seasons.sort(), ['autumn', 'spring', 'summer', 'winter']);
    const mids = seasons.map((season) => {
        const built = buildWorldArt(WORLD_SEED, season);
        built.layers.mid.passes.forEach((pass, i) => { if (pass.svg) assertWellFormedSvg(pass.svg, `${season} mid ${i}`); });
        return built.layers.mid.passes.map((pass) => pass.svg || '').join('');
    });
    assert.equal(new Set(mids).size, seasons.length, 'four different paintings');
    const winter = buildWorldArt(WORLD_SEED, 'winter').layers.mid.passes.map((pass) => pass.svg || '').join('');
    const autumn = art.layers.mid.passes.map((pass) => pass.svg || '').join('');
    assert.ok((winter.match(/#f7fbff/g) || []).length > (autumn.match(/#f7fbff/g) || []).length + 10, 'winter puts snow on the roofs');
});

test('the painted layers stay a reasonable size to rasterise once', () => {
    const total = Object.values(art.layers).flatMap((layer) => layer.passes).reduce((sum, pass) => sum + (pass.svg?.length || 0), 0);
    assert.ok(total < 2_500_000, `paint passes are ${total} characters`);
});

test('sprites sit in the world, carry markup and fit the tier caps', () => {
    const ids = new Set();
    art.sprites.forEach((sprite) => {
        assert.ok(!ids.has(sprite.id), `${sprite.id} is unique`);
        ids.add(sprite.id);
        assert.ok(['back', 'mid'].includes(sprite.slot), `${sprite.id} slot`);
        assert.ok(['lite', 'full'].includes(sprite.tier), `${sprite.id} tier`);
        assert.ok(sprite.w > 0 && sprite.h > 0, `${sprite.id} has a size`);
        assert.ok(sprite.x + sprite.w > 0 && sprite.x < WORLD_W && sprite.y + sprite.h > 0 && sprite.y < WORLD_H, `${sprite.id} is in view`);
        assert.ok(sprite.html.length > 0);
        assert.doesNotMatch(sprite.html, /NaN|undefined/);
    });
    const lite = art.sprites.filter((sprite) => sprite.tier === 'lite');
    assert.ok(lite.length >= 6, 'lite still has water, banners and isles');
    assert.ok(lite.length <= SCENE_TIERS.lite.maxSprites, 'every lite piece survives the lite cap');
    assert.ok(art.sprites.length <= SCENE_TIERS.full.maxSprites, 'every piece survives the full cap');
    assert.deepEqual(scenePlan('lite', art.sprites).sprites.map((s) => s.id), lite.map((s) => s.id));
});

test('landmarks, lanterns and realm clouds line up with the realms', () => {
    assert.deepEqual(Object.keys(art.landmarks).sort(), ['bronze', 'crystal', 'gold', 'silver']);
    Object.values(art.landmarks).forEach(({ x, y }) => assert.ok(x > 0 && x < WORLD_W && y > 40 && y < WORLD_H));
    assert.deepEqual(art.mists.map((mist) => mist.realm), ['silver', 'gold', 'crystal']);
    art.mists.forEach((mist) => assert.ok(mist.blobs.length >= 4, `${mist.realm} has enough cloud to hide it`));
    assert.ok(art.lanterns.length >= 8);
});

test('the bridges stand where the road crosses the water', () => {
    const stream = pointAtProgress(crossingProgress(STREAM_CENTRE, 4, 24));
    const river = pointAtProgress(crossingProgress(RIVER_CENTRE, 40, 60));
    const near = (point, line) => Math.min(...line.map(([x, y]) => Math.hypot(point.x - x, point.y - y)));
    assert.ok(near(stream, STREAM_CENTRE) < 40, 'stream bridge on the stream');
    assert.ok(near(river, RIVER_CENTRE) < 50, 'stone bridge on the river');
});

test('the Silver Peaks skyline leaves room for the mountain gate on the pass', () => {
    const pass = massifRidgeY(640);
    assert.ok(pass > 190 && pass < 220, `pass at ${pass}`);
    assert.ok(massifRidgeY(560) < pass && massifRidgeY(774) < pass, 'peaks rise on both sides of the gate');
    assert.equal(massifRidgeY(1400), WORLD_H, 'no mountain over the citadel lands');
});

test('colours mix as expected', () => {
    assert.equal(mixColour('#000000', '#ffffff', 0), '#000000');
    assert.equal(mixColour('#000000', '#ffffff', 1), '#ffffff');
    assert.equal(mixColour('#000000', '#ffffff', 0.5), '#808080');
    assert.equal(mixColour('#ff0000', '#0000ff', 2), '#0000ff');
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
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /is-motion-paused/);
    assert.match(css, /var\(--wx-sky-1/, 'the sky uses the app palette');
    assert.match(css, /var\(--wx-cloud-shade/, 'clouds use the app palette');
    assert.match(css, /var\(--wx-slant/, 'rain follows the wind');
});
