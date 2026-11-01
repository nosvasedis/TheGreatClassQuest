// templates/loadingSky.js
//
// The loading screen's sky follows the real one: the time of day from the
// clock and the school's sunrise and sunset, and the weather from the last
// reading this device remembers (features/skyMemory.mjs). When that reading
// is old, the screen asks for a fresh one and lets the weather roll in if it
// answers while the film is still playing.
//
// paintLoadingSky() sets data attributes on #loading-screen that
// styles/loading-sky.css turns into the sky, the light on the hills, the sun
// or the moon and stars, and builds the clouds and the weather layer (rain,
// snow, fog, lightning). Only transform and opacity move.

import { cloudSvg, cloudVariantCount } from '../features/skyWeatherArt.js';
import { resolveSkyScene } from '../features/skyWeather.mjs';
import { loadingSkyPlan, rememberSkyReading } from '../features/skyMemory.mjs';
import { openMeteoUrl, readingFromOpenMeteo } from '../features/weatherProviders.mjs';

const LIGHTS = ['dawn', 'day', 'golden', 'twilight', 'night'];
const TONES = ['fair', 'grey', 'rain', 'storm', 'snow', 'fog', 'ice'];
const FETCH_TIMEOUT_MS = 3000;

const r1 = (n) => Math.round(n * 10) / 10;
const randomRange = (min, max) => min + Math.random() * (max - min);
const randomInt = (max) => Math.floor(Math.random() * max);

function reducedMotion() {
    try {
        return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch {
        return false;
    }
}

/** Dev previews: ?sky=day|golden|dawn|twilight|night and ?wx=<WMO code>. */
function previewOverride() {
    try {
        if (!document.body?.classList.contains('pv-loading')) return {};
        const params = new URLSearchParams(location.search);
        const sky = params.get('sky');
        const wx = params.get('wx');
        return {
            light: LIGHTS.includes(sky) ? sky : null,
            code: wx !== null && wx !== '' && Number.isFinite(Number(wx)) ? Number(wx) : null,
        };
    } catch {
        return {};
    }
}

function sceneFor(weather, sun, now, lite, override) {
    const scene = resolveSkyScene(weather || {}, { now, ...sun }, { lite });
    if (!override.light) return scene;
    // A forced light keeps the weather, and redoes what depends on day or night.
    const isNight = override.light === 'night' || override.light === 'twilight';
    const clearish = scene.cover < 72 && !['rain', 'storm', 'hail', 'freezing', 'drizzle'].includes(scene.condition);
    return {
        ...scene,
        light: override.light,
        isNight,
        sun: !isNight && clearish,
        moon: isNight && scene.cover < 82,
        stars: isNight && scene.cover < 80,
        shootingStars: isNight && scene.cover < 45,
    };
}

/** How the scene reads on the loading screen: light, weather tone and what shows. */
function skyAttributes(scene) {
    const light = LIGHTS.includes(scene.light) ? scene.light : 'twilight';
    const tone = TONES.includes(scene.tone) ? scene.tone : 'fair';
    const preDawn = light === 'dawn' && scene.isNight;
    return {
        lsLight: light,
        lsWx: tone,
        lsSun: scene.sun ? '1' : '0',
        lsMoon: scene.moon && (light === 'night' || light === 'twilight' || preDawn) ? '1' : '0',
        lsStars: !scene.stars ? (preDawn && scene.cover < 80 ? 'dim' : '0') : (light === 'dawn' ? 'dim' : '1'),
        lsMeteors: scene.shootingStars && light !== 'dawn' ? '1' : '0',
        lsMotes: !scene.precip && (light === 'night' || light === 'twilight' || light === 'golden') ? '1' : '0',
    };
}

// ── Clouds ──────────────────────────────────────────────────────────

function cloudFamilies(scene, light) {
    const dark = light === 'night' || light === 'twilight';
    switch (scene.tone) {
        case 'storm': return ['long', 'fractus', 'long', 'anvil', 'fractus', 'long'];
        case 'rain':
        case 'ice': return ['long', 'fractus', 'long', 'cumulus', 'fractus', 'long'];
        case 'grey': return dark ? ['long', 'long', 'wisp', 'long'] : ['long', 'cumulus', 'long', 'puff', 'long', 'cumulus'];
        case 'snow':
        case 'fog': return ['long', 'long', 'wisp'];
        default: return dark ? ['long', 'wisp', 'long', 'wisp'] : ['cumulus', 'wisp', 'puff', 'twin', 'cumulus', 'wisp'];
    }
}

function cloudCount(scene, { mobile, lowPower }) {
    const cover = Math.max(0, Math.min(100, Number(scene.cover) || 0));
    let n = Math.round(1 + (cover / 100) * 5);
    if (scene.tone === 'fog') n = Math.min(n, 3);
    if (lowPower) n = Math.max(1, Math.round(n * 0.7));
    if (mobile) n = Math.max(1, Math.ceil(n * 0.6));
    return n;
}

function buildCloudSet(scene, light, opts) {
    const set = document.createElement('div');
    set.className = 'ls-clouds__set';
    const families = cloudFamilies(scene, light);
    const count = cloudCount(scene, opts);
    const heavy = scene.tone !== 'fair';
    const drift = scene.wind?.dir < 0 ? -1 : 1;
    const speed = Math.max(0.6, Math.min(2.2, Number(scene.wind?.factor) || 1));
    for (let i = 0; i < count; i += 1) {
        const family = families[i % families.length];
        const cloud = document.createElement('span');
        const depth = count === 1 ? 0.5 : i / (count - 1);
        const duration = (260 - depth * 90 + randomRange(-20, 20)) / speed;
        cloud.className = `ls-cloud ls-cloud--${family}`;
        cloud.innerHTML = cloudSvg(family, randomInt(cloudVariantCount(family)));
        // High enough to stay clear of the title in the middle of the screen.
        const band = heavy ? [1, 18] : [2, 16];
        const top = opts.mobile ? randomRange(3, 13) : randomRange(band[0] + depth * 10, band[0] + depth * 10 + (band[1] - band[0]) / 2);
        cloud.style.top = `${top.toFixed(1)}%`;
        const base = family === 'long' || family === 'wisp' || family === 'anvil' ? 240 : 170;
        cloud.style.width = `${Math.round((opts.mobile ? base * 0.65 : base) + depth * (opts.mobile ? 60 : 190))}px`;
        cloud.style.opacity = (heavy ? 0.7 + depth * 0.25 : 0.45 + depth * 0.35).toFixed(2);
        // Wind from the east carries them left; the order still alternates a little.
        const rightward = drift > 0 ? i % 3 !== 2 : i % 3 === 2;
        cloud.style.animationName = rightward ? 'ls-drift-right' : 'ls-drift-left';
        cloud.style.animationDuration = `${duration.toFixed(1)}s`;
        cloud.style.animationDelay = `-${(randomRange(0.1, 0.9) * duration).toFixed(1)}s`;
        set.appendChild(cloud);
    }
    return set;
}

// ── Weather: rain, snow, fog, lightning ─────────────────────────────

// One tile of a falling layer is 1.4 screens wide and 1.5 tall (styles/loading-sky.css
// .ls-fall); its viewBox keeps that shape, so flakes stay round.
function tileWidth() {
    try {
        return Math.round(1000 * (1.4 * window.innerWidth) / (1.5 * window.innerHeight)) || 1000;
    } catch {
        return 1000;
    }
}

function streaksSvg(count, { len, width }) {
    const parts = [];
    const w = tileWidth();
    for (let i = 0; i < count; i += 1) {
        const x = randomRange(0, w);
        const y = randomRange(0, 1000);
        const l = randomRange(len[0], len[1]);
        parts.push(`<line x1="${r1(x)}" y1="${r1(y)}" x2="${r1(x)}" y2="${r1(y + l)}" opacity="${randomRange(0.45, 1).toFixed(2)}"/>`);
    }
    return `<svg viewBox="0 0 ${w} 1000" preserveAspectRatio="none" focusable="false"><g stroke-width="${width}" stroke-linecap="round" vector-effect="non-scaling-stroke">${parts.join('')}</g></svg>`;
}

function flakesSvg(count, { r }) {
    const parts = [];
    const w = tileWidth();
    for (let i = 0; i < count; i += 1) {
        parts.push(`<circle cx="${r1(randomRange(0, w))}" cy="${r1(randomRange(0, 1000))}" r="${r1(randomRange(r[0], r[1]))}" opacity="${randomRange(0.55, 1).toFixed(2)}"/>`);
    }
    return `<svg viewBox="0 0 ${w} 1000" preserveAspectRatio="none" focusable="false">${parts.join('')}</svg>`;
}

/** One falling layer: the same tile twice, one above the other, sliding down a tile per loop. */
function fallLayer(className, tile) {
    return `<div class="ls-fall ${className}"><div class="ls-fall__run">${tile}${tile}</div></div>`;
}

function weatherHTML(scene, { mobile, lowPower }) {
    const scale = (mobile ? 0.55 : 1) * (lowPower ? 0.5 : 1);
    const heavy = scene.intensity === 'heavy';
    const light = scene.intensity === 'light';
    const parts = [];
    if (scene.precip === 'rain' || scene.precip === 'drizzle' || scene.precip === 'sleet' || scene.precip === 'hail') {
        const drizzle = scene.precip === 'drizzle';
        const n = Math.round((drizzle ? 90 : heavy ? 230 : light ? 100 : 160) * scale);
        const len = drizzle ? [10, 18] : [22, 40];
        parts.push(fallLayer(`ls-rain${drizzle ? ' ls-rain--drizzle' : ''}`, streaksSvg(n, { len, width: drizzle ? 1 : 1.4 })));
        if (scene.precip === 'sleet' || scene.precip === 'hail') {
            parts.push(fallLayer('ls-snow ls-snow--sleet', flakesSvg(Math.round(50 * scale), { r: [1.4, 2.6] })));
        }
    }
    if (scene.precip === 'snow') {
        const n = heavy ? 140 : light ? 60 : 100;
        parts.push(fallLayer('ls-snow ls-snow--far', flakesSvg(Math.round(n * scale), { r: [1.2, 2.2] })));
        parts.push(fallLayer('ls-snow ls-snow--near', flakesSvg(Math.round(n * 0.45 * scale), { r: [2.2, 3.8] })));
    }
    if (scene.fog) {
        parts.push('<div class="ls-fog ls-fog--far"></div>');
        if (!lowPower) parts.push('<div class="ls-fog ls-fog--near"></div>');
    }
    if (scene.lightning && !reducedMotion()) parts.push('<div class="ls-flash"></div>');
    return parts.join('');
}

// ── Painting ────────────────────────────────────────────────────────

let _sun = null;
let _fetchToken = 0;

function applyScene(screen, scene, opts, { rollIn = false } = {}) {
    const attrs = skyAttributes(scene);
    Object.assign(screen.dataset, attrs);
    const slant = Math.max(-24, Math.min(24, Number(scene.wind?.slant) || 0));
    screen.style.setProperty('--ls-slant', `${scene.precip === 'snow' ? Math.round(slant / 3) : slant}deg`);

    const clouds = screen.querySelector('.ls-clouds');
    if (clouds) {
        const old = [...clouds.children];
        const set = buildCloudSet(scene, attrs.lsLight, opts);
        if (rollIn && old.length) {
            set.classList.add('is-rolling-in');
            old.forEach((el) => el.classList.add('is-leaving'));
            setTimeout(() => old.forEach((el) => el.remove()), 3200);
        } else {
            old.forEach((el) => el.remove());
        }
        clouds.appendChild(set);
    }
    const weather = screen.querySelector('.ls-weather');
    if (weather) {
        weather.innerHTML = weatherHTML(scene, opts);
        weather.classList.toggle('is-rolling-in', rollIn);
    }
}

async function fetchWeather(place) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(openMeteoUrl({ ...place, timezone: 'auto' }), { signal: controller.signal });
        if (!response.ok) return null;
        return readingFromOpenMeteo(await response.json());
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Paint the sky for right now. opts: { mobile, lowPower }.
 * Returns the light ('dawn' | 'day' | 'golden' | 'twilight' | 'night').
 */
export function paintLoadingSky(screen, opts = {}) {
    if (!screen) return 'twilight';
    const now = Date.now();
    const override = previewOverride();
    const plan = loadingSkyPlan(now);
    _sun = plan.sun;
    const weather = override.code !== null && override.code !== undefined ? { code: override.code } : plan.weather;
    const scene = sceneFor(weather, plan.sun, now, Boolean(opts.lowPower), override);
    applyScene(screen, scene, opts);

    // No fresh reading: ask, and let the weather roll in if it answers in time.
    const token = ++_fetchToken;
    if (!weather && plan.place && typeof fetch === 'function') {
        fetchWeather(plan.place).then((reading) => {
            if (!reading || token !== _fetchToken) return;
            rememberSkyReading({ ...reading, location: plan.place });
            if (screen.classList.contains('hidden') || screen.classList.contains('loading-screen-exit')) return;
            const fresh = sceneFor(reading, _sun, Date.now(), Boolean(opts.lowPower), override);
            applyScene(screen, fresh, opts, { rollIn: true });
        });
    }
    return scene.light;
}
