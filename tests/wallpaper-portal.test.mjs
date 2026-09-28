import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal = readFileSync(new URL('../ui/wallpaperPortal.js', import.meta.url), 'utf8');
const wallpaper = readFileSync(new URL('../ui/wallpaper.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/wallpaper_sky.css', import.meta.url), 'utf8');

test('portal exports an opening and a closing and wallpaper.js uses both', () => {
    assert.match(portal, /export async function playPortalOpen/);
    assert.match(portal, /export async function playPortalClose/);
    assert.match(wallpaper, /playPortalOpen\(wallpaperEl\)/);
    assert.match(wallpaper, /playPortalClose\(wallpaperEl\)/);
});

test('toggle ignores presses while the portal is animating', () => {
    assert.match(wallpaper, /if \(portalBusy\) return;/);
});

test('the journey copies the Home meadow and glides to the castle horizon', () => {
    assert.match(portal, /getGreetingHillsHtml/);
    assert.match(portal, /wall-horizon/);
    assert.match(css, /\.wp-meadow\b/);
    assert.match(css, /\.wp-meadow \.wp-meadow__palette/);
});

test('the projector is full screen before it travels and cards start only afterwards', () => {
    assert.ok(portal.includes('const fullscreen = enterFullscreen()'));
    assert.ok(portal.indexOf('await Promise.all([fullscreen') < portal.indexOf("travelAnimations(meadow, 'forward')"));
    assert.doesNotMatch(wallpaper, /requestFullscreen\(\)\.catch\(\(\) => \{\}\);\n\s*\}\n\s*\}\);/);
});

test('close leaves full screen before the journey back', () => {
    const close = portal.slice(portal.indexOf('export async function playPortalClose'));
    assert.ok(close.indexOf('leaveFullscreen()') < close.indexOf("travelAnimations(meadow, 'back')"));
});

test('foreground only fades, so it never changes size or position', () => {
    const arrive = portal.slice(portal.indexOf('const arrive'), portal.indexOf('await settle([...travel'));
    assert.doesNotMatch(arrive, /transform|scale|translate/);
});

test('reduced motion skips the travel', () => {
    assert.match(portal, /prefersReducedMotion\(\)/);
});
