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

test('every portal class the script pulses has CSS and a reduced-motion opt-out', () => {
    for (const cls of ['is-portal-launch', 'is-portal-land']) {
        assert.ok(portal.includes(cls), `${cls} used by the portal`);
        assert.ok(css.includes(`.greeting-panel.${cls}`), `${cls} styled`);
    }
    assert.match(css, /prefers-reduced-motion[\s\S]*is-portal-launch[\s\S]*animation: none/);
});

test('close leaves full screen before measuring the greeting card', () => {
    assert.ok(portal.indexOf('await leaveFullscreen()') < portal.indexOf('findGreetingSource()', portal.indexOf('playPortalClose')));
});
