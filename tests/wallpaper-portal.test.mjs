import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const portal = readFileSync(new URL('../ui/wallpaperPortal.js', import.meta.url), 'utf8');
const wallpaper = readFileSync(new URL('../ui/wallpaper.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/wallpaper_sky.css', import.meta.url), 'utf8');

const openBody = portal.slice(portal.indexOf('export async function playPortalOpen'), portal.indexOf('export async function playPortalClose'));
const closeBody = portal.slice(portal.indexOf('export async function playPortalClose'));

test('portal exports an opening and a closing and wallpaper.js uses both', () => {
    assert.match(portal, /export async function playPortalOpen/);
    assert.match(portal, /export async function playPortalClose/);
    assert.match(wallpaper, /playPortalOpen\(wallpaperEl\)/);
    assert.match(wallpaper, /playPortalClose\(wallpaperEl\)/);
});

test('toggle ignores presses while the portal is animating', () => {
    assert.match(wallpaper, /if \(portalBusy\) return;/);
});

test('the camera starts on the Home greeting card and its meadow', () => {
    assert.match(portal, /\.greeting-panel/);
    assert.match(portal, /getGreetingHillsHtml/);
    assert.match(portal, /function cameraFrames\(card/);
    assert.match(css, /\.wp-cardsky\b/);
    assert.match(css, /\.wp-strip--meadow\b/);
});

test('the journey travels by depth to the real castle horizon', () => {
    assert.match(portal, /far:[\s\S]*mid:[\s\S]*near:/);
    assert.match(portal, /wall-horizon__castle/);
    assert.match(css, /\.wall-horizon\.is-travelling > \.wall-horizon__far/);
});

test('full screen is settled before anything is measured', () => {
    assert.ok(openBody.indexOf('await enterFullscreen()') < openBody.indexOf('measureCard('));
    assert.ok(closeBody.indexOf('leaveFullscreen()') < closeBody.indexOf('measureCard('));
});

test('foreground only fades and comes into focus, it never moves or resizes', () => {
    const arrive = openBody.slice(openBody.indexOf('// 3.'), openBody.indexOf('await settle(animations)'));
    assert.doesNotMatch(arrive, /transform|scale|translate/);
});

test("holds never overwrite the foreground's inline opacity (the quote sets its own)", () => {
    const writes = portal.match(/[\w.]+\.style\.opacity/g) || [];
    assert.ok(writes.every((w) => w === 'wallEl.style.opacity'), writes.join(', '));
});

test('the zoom is driven frame by frame, never as an animated clip-path', () => {
    assert.match(portal, /function runCamera/);
    assert.match(portal, /requestAnimationFrame\(tick\)/);
    // Web Animations keyframes never carry a clip-path (browsers may run those on the GPU, where they flicker).
    assert.doesNotMatch(portal, /animate\([^;]*clipPath/s);
    assert.match(css, /\.is-zooming :is\(#wall-center-hub/);
});

test('Esc from full screen closes the projector smoothly instead of half-closing it', () => {
    assert.match(portal, /navigator\.keyboard\?\.lock\?\.\(\['Escape'\]\)/);
    assert.match(wallpaper, /addEventListener\('fullscreenchange', handleWallFullscreenChange\)/);
    assert.match(wallpaper, /function handleWallFullscreenChange\(\) \{\n\s+if \(document\.fullscreenElement \|\| !isRunning \|\| portalBusy \|\| fullscreenSwitching\) return;\n\s+toggleWallpaperMode\(\);/);
});

test('a resize keeps the showing card in its region and glides it there', () => {
    assert.match(wallpaper, /keepRegion: refit \? el\.dataset\.region : ''/);
    assert.match(wallpaper, /refitFloatingCard\(\{ glide: true \}\)/);
});

test('reduced motion skips the journey', () => {
    assert.match(portal, /prefersReducedMotion\(\)/);
});
