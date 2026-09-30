/**
 * Sky weather stage: paints the current scene onto every sky surface that is
 * in the page and keeps it painted (colour-only changes never touch the DOM).
 *
 *   applySkyScene(scene)     set <html> state + rebuild any surface whose layout changed
 *   refreshSkyLight(sun)     minute tick: dawn/golden/twilight/night without a new fetch
 *   skyWeatherIsLite()       weak-device mode (fewer clouds and layers)
 *
 * No imports from utils.js, so utils can call refreshSkyLight without a cycle.
 */

import { resolveSkyScene, sceneLayoutKey } from './skyWeather.mjs';
import { buildCloudsHtml, buildWeatherFxHtml, BOLT_PATHS } from './skyWeatherArt.js';

let currentScene = null;
let lastReading = null;
let lightningTimer = null;

function detectLite() {
    try {
        const cores = Number(navigator.hardwareConcurrency) || 8;
        const memory = Number(navigator.deviceMemory) || 8;
        return cores <= 2 || memory <= 2 || (cores <= 4 && memory <= 4);
    } catch (_) {
        return false;
    }
}

const LITE = typeof navigator !== 'undefined' ? detectLite() : false;

export function skyWeatherIsLite() {
    return LITE;
}

export function getSkyScene() {
    return currentScene;
}

export function getLastSkyReading() {
    return lastReading;
}

/** Scene for a reading + sun times, with the device's lite setting. */
export function computeSkyScene(reading, sun) {
    return resolveSkyScene(reading || {}, sun || {}, { lite: LITE });
}

/** Cloud and weather-layer slots for each surface. Missing ones are skipped. */
const SURFACES = [
    { surface: 'header', clouds: '#award-header-atmosphere .header-sky-clouds', fx: '#award-header-atmosphere .wx-stage--header' },
    { surface: 'sky', clouds: '#award-immersive-sky .wx-clouds--sky', fx: '#award-immersive-sky .wx-stage--sky' },
    { surface: 'mobile', clouds: '.m-header .m-header__clouds', fx: '.m-header .wx-stage--mobile' },
    { surface: 'card', clouds: '.weather-card--v3 .wx-clouds--card', fx: '.weather-card--v3 .wx-stage--card' },
    { surface: 'wall', clouds: '#wall-parallax-clouds', fx: '#wall-weather-fx' }
];

function paint(el, key, build) {
    if (!el || el.dataset.wxKey === key) return;
    el.innerHTML = build();
    el.dataset.wxKey = key;
}

/** (Re)paint one surface. Safe to call for freshly rendered markup (e.g. the Home card). */
export function paintSkySurface(surface, root = document) {
    const scene = currentScene;
    const slot = SURFACES.find((s) => s.surface === surface);
    if (!scene || !slot) return;
    const key = sceneLayoutKey(scene, surface);
    root.querySelectorAll(slot.clouds).forEach((el) => paint(el, `c:${key}`, () => buildCloudsHtml(scene, surface)));
    root.querySelectorAll(slot.fx).forEach((el) => paint(el, `f:${key}`, () => buildWeatherFxHtml(scene, surface)));
}

function setHtmlState(scene) {
    const html = document.documentElement;
    const d = html.dataset;
    d.wx = scene.condition;
    d.wxTone = scene.tone;
    d.wxInt = scene.intensity || 'normal';
    d.wxLight = scene.light;
    d.wxNight = scene.isNight ? '1' : '0';
    d.wxWind = scene.wind.level;
    d.wxDir = scene.wind.dir < 0 ? 'w' : 'e';
    d.wxSun = scene.sun ? '1' : '0';
    d.wxMoon = scene.moon ? '1' : '0';
    d.wxStars = scene.stars ? '1' : '0';
    d.wxLite = LITE ? '1' : '0';
    html.style.setProperty('--wx-slant', `${scene.wind.slant}deg`);
    html.style.setProperty('--wx-wind', String(scene.wind.factor));
}

export function applySkyScene(scene) {
    if (!scene || typeof document === 'undefined') return;
    currentScene = scene;
    setHtmlState(scene);
    for (const { surface } of SURFACES) paintSkySurface(surface);
    setLightning(scene.lightning);
}

/** Paint a reading (live weather) with the given sun times. */
export function applySkyReading(reading, sun) {
    if (reading) lastReading = reading;
    applySkyScene(computeSkyScene(lastReading, sun));
    return currentScene;
}

/**
 * Minute tick from utils.updateDateTime: moves the sky through dawn, golden
 * hour, twilight and night using the last reading, no network needed.
 */
export function refreshSkyLight(sun) {
    if (typeof document === 'undefined') return;
    const next = computeSkyScene(lastReading, sun);
    if (currentScene
        && next.light === currentScene.light
        && next.isNight === currentScene.isNight
        && sceneLayoutKey(next, 'header') === sceneLayoutKey(currentScene, 'header')) {
        return;
    }
    applySkyScene(next);
}

/* ---------------- Lightning ---------------- */

function isShown(el) {
    return !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
}

function strike() {
    lightningTimer = null;
    if (!currentScene?.lightning) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!document.hidden && !reduce) {
        const x = 12 + Math.random() * 72;
        const s = 0.8 + Math.random() * 0.45;
        const path = BOLT_PATHS[Math.floor(Math.random() * BOLT_PATHS.length)];
        document.querySelectorAll('[data-wx-lightning]').forEach((zone) => {
            if (!isShown(zone)) return;
            zone.style.setProperty('--bolt-x', `${x}%`);
            zone.style.setProperty('--bolt-s', s.toFixed(2));
            zone.querySelectorAll('.wx-bolt path').forEach((p) => p.setAttribute('d', path));
            zone.classList.remove('is-striking');
            // Restart the one-shot animation.
            void zone.offsetWidth;
            zone.classList.add('is-striking');
        });
    }
    lightningTimer = setTimeout(strike, 6500 + Math.random() * 10000);
}

function setLightning(on) {
    if (on && !lightningTimer) {
        lightningTimer = setTimeout(strike, 2500 + Math.random() * 4000);
    } else if (!on && lightningTimer) {
        clearTimeout(lightningTimer);
        lightningTimer = null;
    }
}
