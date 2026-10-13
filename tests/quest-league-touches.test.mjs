import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEAGUE_TOUCH_KEYS, leagueTouchKey, leagueTouchLabel, leagueTouchSprites } from '../features/questWorld/leagueTouches.mjs';
import { questLeagues } from '../constants.js';
import { WORLD_W, WORLD_H } from '../features/questWorld/worldGeometry.mjs';

test('every active league has its own touches on the map', () => {
    questLeagues.forEach((league) => {
        const sprites = leagueTouchSprites(league);
        assert.ok(sprites.length >= 2, league);
        assert.ok(leagueTouchLabel(league), league);
    });
    assert.equal(LEAGUE_TOUCH_KEYS.length, questLeagues.length);
});

test('unknown or retired leagues get none', () => {
    ['', null, 'Nursery', 'Proficiency', 'E'].forEach((league) => {
        assert.equal(leagueTouchKey(league), '');
        assert.deepEqual(leagueTouchSprites(league), []);
    });
});

test('touches sit in the world, with unique ids and a known slot', () => {
    const ids = new Set();
    LEAGUE_TOUCH_KEYS.forEach((key) => {
        leagueTouchSprites(key).forEach((sprite) => {
            assert.ok(!ids.has(sprite.id), sprite.id);
            ids.add(sprite.id);
            assert.ok(['back', 'mid'].includes(sprite.slot));
            assert.ok(sprite.x >= 0 && sprite.y >= 0 && sprite.x + sprite.w <= WORLD_W && sprite.y + sprite.h <= WORLD_H, sprite.id);
            assert.ok(sprite.html.length > 0);
        });
    });
});

test('league touch keyframes animate transform and opacity only', () => {
    const css = readFileSync(new URL('../styles/quest_world.css', import.meta.url), 'utf8');
    const blocks = css.match(/@keyframes tqw-lt-[\w-]+\s*\{[\s\S]*?\n\}|@keyframes tqw-lt-[\w-]+\s*\{[^\n]*\}/g) || [];
    assert.ok(blocks.length > 10);
    blocks.forEach((block) => {
        const props = [...block.replace(/@keyframes[^{]*\{/, '').matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
        props.forEach((prop) => assert.ok(['transform', 'opacity'].includes(prop), `${prop} in ${block.slice(0, 40)}`));
    });
});
