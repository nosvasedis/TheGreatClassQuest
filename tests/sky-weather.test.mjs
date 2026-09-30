import test from 'node:test';
import assert from 'node:assert/strict';
import {
    conditionForCode, resolveSkyLight, windForReading, cloudCountFor, resolveSkyScene,
    cloudLayout, sceneLayoutKey
} from '../features/skyWeather.mjs';
import { buildCloudsHtml, buildWeatherFxHtml, weatherGlyphSvg, cloudSvg, CLOUD_SHAPES } from '../features/skyWeatherArt.js';

const at = (h, m = 0) => new Date(2026, 8, 30, h, m).getTime();
const SUN = { sunrise: at(7, 20), sunset: at(19, 10) };

test('Open-Meteo codes map to sky conditions with intensity', () => {
    assert.deepEqual(conditionForCode(0), { condition: 'clear', intensity: '' });
    assert.deepEqual(conditionForCode(65), { condition: 'rain', intensity: 'heavy' });
    assert.deepEqual(conditionForCode(75), { condition: 'snow', intensity: 'heavy' });
    assert.deepEqual(conditionForCode(99), { condition: 'hail', intensity: 'heavy' });
    assert.equal(conditionForCode(56).condition, 'freezing');
    assert.equal(conditionForCode('nope').condition, 'partly');
});

test('sky light follows the sun through dawn, golden hour and twilight', () => {
    assert.equal(resolveSkyLight(at(7, 30), SUN.sunrise, SUN.sunset), 'dawn');
    assert.equal(resolveSkyLight(at(12), SUN.sunrise, SUN.sunset), 'day');
    assert.equal(resolveSkyLight(at(18, 30), SUN.sunrise, SUN.sunset), 'golden');
    assert.equal(resolveSkyLight(at(19, 30), SUN.sunrise, SUN.sunset), 'twilight');
    assert.equal(resolveSkyLight(at(23), SUN.sunrise, SUN.sunset), 'night');
});

test('wind sets drift speed, rain slant, direction and level', () => {
    const calm = windForReading(3, 270);
    const gale = windForReading(45, 90);
    assert.equal(calm.level, 'calm');
    assert.equal(gale.level, 'gale');
    assert.ok(gale.factor > calm.factor);
    assert.ok(Math.abs(gale.slant) > Math.abs(calm.slant));
    // An east wind blows the clouds west.
    assert.equal(gale.dir, -1);
    assert.equal(calm.dir, 1);
});

test('cloud cover drives cloud counts, and weak devices get fewer', () => {
    assert.ok(cloudCountFor('sky', 95) > cloudCountFor('sky', 10));
    assert.ok(cloudCountFor('wall', 95, { lite: true }) < cloudCountFor('wall', 95));
    assert.ok(cloudCountFor('card', 100) <= 4);
});

test('scenes pick sun, moon, stars, rainbow and lightning sensibly', () => {
    const clearNight = resolveSkyScene({ code: 0 }, { now: at(23), ...SUN });
    assert.equal(clearNight.isNight, true);
    assert.equal(clearNight.moon, true);
    assert.equal(clearNight.stars, true);
    assert.equal(clearNight.sun, false);

    const storm = resolveSkyScene({ code: 95 }, { now: at(12), ...SUN });
    assert.equal(storm.lightning, true);
    assert.equal(storm.precip, 'rain');
    assert.equal(storm.sun, false);
    assert.equal(storm.tone, 'storm');

    const showers = resolveSkyScene({ code: 80 }, { now: at(12), ...SUN });
    assert.equal(showers.rainbow, true);

    const snow = resolveSkyScene({ code: 73 }, { now: at(12), ...SUN });
    assert.equal(snow.precip, 'snow');
    assert.equal(snow.tone, 'snow');

    // A stray cover reading never paints a clear sky full of cloud.
    const clear = resolveSkyScene({ code: 0, cloudCover: 100 }, { now: at(12), ...SUN });
    assert.ok(clear.cover <= 25);
});

test('cloud layouts are stable per seed and stay inside the sky', () => {
    const a = cloudLayout('sky', 6, 'fair', 11);
    const b = cloudLayout('sky', 6, 'fair', 11);
    assert.deepEqual(a, b);
    assert.equal(a.length, 6);
    for (const c of a) {
        assert.ok(CLOUD_SHAPES[c.shape], c.shape);
        assert.ok(c.top >= 0 && c.top <= 100);
        assert.ok(c.duration > 0);
    }
});

test('cloud art is flat SVG with no filters or gradients (cheap on weak laptops)', () => {
    for (const shape of Object.keys(CLOUD_SHAPES)) {
        const svg = cloudSvg(shape);
        assert.match(svg, /^<svg class="wx-cloud__art"/);
        assert.doesNotMatch(svg, /filter|Gradient/);
    }
    const scene = resolveSkyScene({ code: 2 }, { now: at(12), ...SUN });
    const html = buildCloudsHtml(scene, 'header');
    assert.equal((html.match(/class="wx-cloud /g) || []).length, scene.counts.header);
});

test('weather layers match the scene, with one rain depth on small windows', () => {
    const rain = resolveSkyScene({ code: 63 }, { now: at(12), ...SUN });
    const sky = buildWeatherFxHtml(rain, 'sky');
    const card = buildWeatherFxHtml(rain, 'card');
    assert.match(sky, /wx-precip--rain/);
    assert.equal((sky.match(/wx-drop-layer--/g) || []).length, 2);
    assert.equal((card.match(/wx-drop-layer--/g) || []).length, 1);

    const storm = resolveSkyScene({ code: 95 }, { now: at(12), ...SUN });
    assert.match(buildWeatherFxHtml(storm, 'sky'), /data-wx-lightning/);
    assert.equal(buildWeatherFxHtml(resolveSkyScene({ code: 0 }, { now: at(12), ...SUN }), 'sky'), '');
});

test('the card glyph animates whole layers only', () => {
    const rain = resolveSkyScene({ code: 63 }, { now: at(12), ...SUN });
    const glyph = weatherGlyphSvg(rain);
    assert.match(glyph, /^<span class="wx-glyph wx-glyph--rain"/);
    assert.match(glyph, /wx-glyph__layer--fall/);
    const night = weatherGlyphSvg(resolveSkyScene({ code: 0 }, { now: at(23), ...SUN }), { moonPhase: 0.3 });
    assert.match(night, /wx-g-moon/);
    assert.doesNotMatch(night, /wx-g-sun/);
});

test('layout keys change with the weather so surfaces repaint only when needed', () => {
    const a = resolveSkyScene({ code: 2 }, { now: at(12), ...SUN });
    const b = resolveSkyScene({ code: 2 }, { now: at(12, 5), ...SUN });
    const c = resolveSkyScene({ code: 63 }, { now: at(12), ...SUN });
    assert.equal(sceneLayoutKey(a, 'sky'), sceneLayoutKey(b, 'sky'));
    assert.notEqual(sceneLayoutKey(a, 'sky'), sceneLayoutKey(c, 'sky'));
});

test('a cloudy night still shows the moon phase, veiled', () => {
    const overcastNight = resolveSkyScene({ code: 3 }, { now: at(23), ...SUN });
    assert.match(weatherGlyphSvg(overcastNight, { moonPhase: 0.4 }), /wx-g-moon--veiled/);
    const stormNight = resolveSkyScene({ code: 95 }, { now: at(23), ...SUN });
    assert.doesNotMatch(weatherGlyphSvg(stormNight), /wx-g-moon/);
});
