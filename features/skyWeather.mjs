/**
 * Sky weather: pure maths that turns a live weather reading and the time of day
 * into one "scene" every sky surface paints from (header band, Award sky, Home
 * weather card, mobile header, Projector Sky Window).
 *
 * No DOM here, so it is unit tested (tests/sky-weather.test.js). The art lives in
 * features/skyWeatherArt.js and the DOM wiring in features/skyWeatherStage.js.
 */

/** Open-Meteo / WMO weather_code → a condition family the sky knows how to paint. */
export function conditionForCode(code) {
    const n = Number(code);
    if (!Number.isFinite(n)) return { condition: 'partly', intensity: '' };
    if (n === 0) return { condition: 'clear', intensity: '' };
    if (n === 1) return { condition: 'partly', intensity: 'light' };
    if (n === 2) return { condition: 'partly', intensity: '' };
    if (n === 3) return { condition: 'overcast', intensity: '' };
    if (n === 45) return { condition: 'fog', intensity: '' };
    if (n === 48) return { condition: 'fog', intensity: 'heavy' };
    if (n === 51) return { condition: 'drizzle', intensity: 'light' };
    if (n === 53) return { condition: 'drizzle', intensity: '' };
    if (n === 55) return { condition: 'drizzle', intensity: 'heavy' };
    if (n === 56 || n === 66) return { condition: 'freezing', intensity: 'light' };
    if (n === 57 || n === 67) return { condition: 'freezing', intensity: 'heavy' };
    if (n === 61) return { condition: 'rain', intensity: 'light' };
    if (n === 63) return { condition: 'rain', intensity: '' };
    if (n === 65) return { condition: 'rain', intensity: 'heavy' };
    if (n === 71 || n === 77 || n === 85) return { condition: 'snow', intensity: 'light' };
    if (n === 73) return { condition: 'snow', intensity: '' };
    if (n === 75 || n === 86) return { condition: 'snow', intensity: 'heavy' };
    if (n === 80) return { condition: 'showers', intensity: 'light' };
    if (n === 81) return { condition: 'showers', intensity: '' };
    if (n === 82) return { condition: 'showers', intensity: 'heavy' };
    if (n === 95) return { condition: 'storm', intensity: '' };
    if (n === 96) return { condition: 'hail', intensity: '' };
    if (n === 99) return { condition: 'hail', intensity: 'heavy' };
    if (n > 3 && n < 50) return { condition: 'fog', intensity: '' };
    if (n < 60) return { condition: 'drizzle', intensity: '' };
    if (n < 70) return { condition: 'rain', intensity: '' };
    if (n < 80) return { condition: 'snow', intensity: '' };
    if (n < 90) return { condition: 'showers', intensity: '' };
    return { condition: 'storm', intensity: '' };
}

/** Typical cloud cover (%) for each condition, used when the API gives none. */
const DEFAULT_COVER = {
    clear: 6, partly: 45, overcast: 96, fog: 85, drizzle: 88, rain: 92,
    showers: 68, freezing: 92, snow: 92, storm: 100, hail: 100
};

/** The cover a condition can plausibly have, so a stray reading never paints rain from a clear sky. */
const COVER_RANGE = {
    clear: [0, 25], partly: [20, 75], overcast: [75, 100], fog: [60, 100], drizzle: [65, 100],
    rain: [75, 100], showers: [45, 90], freezing: [75, 100], snow: [70, 100], storm: [85, 100], hail: [85, 100]
};

/** Grey sky families: their clouds and backdrop go grey instead of fair. */
const GREY = new Set(['overcast', 'fog', 'drizzle', 'rain', 'showers', 'freezing', 'snow', 'storm', 'hail']);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Light of the sky from the sun: dawn, day, golden hour, twilight or night.
 * Night itself still follows utils/dayPart.mjs (after sunset or before sunrise);
 * dawn and twilight are the tinted edges either side of it.
 */
export function resolveSkyLight(nowTime, sunrise, sunset) {
    const t = nowTime instanceof Date ? nowTime.getTime() : Number(nowTime);
    const MIN = 60 * 1000;
    if (!Number.isFinite(t) || !Number.isFinite(sunrise) || !Number.isFinite(sunset)) return 'day';
    if (t >= sunrise - 35 * MIN && t < sunrise + 55 * MIN) return 'dawn';
    if (t >= sunset - 80 * MIN && t < sunset) return 'golden';
    if (t >= sunset && t < sunset + 50 * MIN) return 'twilight';
    if (t >= sunset || t < sunrise) return 'night';
    return 'day';
}

/** Wind (km/h and the direction it comes FROM) → drift speed factor, drift direction and rain slant. */
export function windForReading(speedKmh, fromDegrees) {
    const speed = Number.isFinite(Number(speedKmh)) ? clamp(Number(speedKmh), 0, 120) : 9;
    const deg = Number(fromDegrees);
    // Wind from the east half pushes clouds to the left (west); otherwise to the right.
    const dir = Number.isFinite(deg) && Math.sin((deg * Math.PI) / 180) > 0.2 ? -1 : 1;
    const factor = Math.round(clamp(0.6 + speed / 20, 0.6, 2.6) * 100) / 100;
    const slant = Math.round(clamp(4 + speed * 0.45, 4, 26)) * dir;
    const level = speed >= 38 ? 'gale' : speed >= 24 ? 'windy' : speed >= 12 ? 'breezy' : 'calm';
    return { speed: Math.round(speed), dir, factor, slant, level };
}

/** How many clouds each surface paints for a given cover. Lite mode (weak devices) paints fewer. */
export function cloudCountFor(surface, cover, { lite = false } = {}) {
    const c = clamp(Number(cover) || 0, 0, 100) / 100;
    const table = {
        header: [2, 8],
        sky: [2, 9],
        card: [1, 4],
        wall: [3, 12],
        mobile: [1, 4]
    };
    const [lo, hi] = table[surface] || table.header;
    let n = Math.round(lo + (hi - lo) * c);
    if (lite) n = Math.max(lo > 1 ? lo - 1 : lo, Math.round(n * 0.6));
    return n;
}

/**
 * The whole scene. `weather` is the cached live reading ({ code, cloudCover,
 * windSpeed, windDirection }); `sun` is { now, sunrise, sunset } in ms.
 */
export function resolveSkyScene(weather = {}, sun = {}, { lite = false } = {}) {
    const hasReading = weather && weather.code !== undefined && weather.code !== null;
    const { condition, intensity } = hasReading ? conditionForCode(weather.code) : { condition: 'partly', intensity: 'light' };
    const [lo, hi] = COVER_RANGE[condition];
    const rawCover = Number(weather?.cloudCover);
    const cover = Math.round(clamp(Number.isFinite(rawCover) ? rawCover : DEFAULT_COVER[condition], lo, hi));

    const now = sun.now ?? Date.now();
    const light = resolveSkyLight(now, sun.sunrise, sun.sunset);
    const isNight = light === 'night' || light === 'twilight'
        || (light === 'dawn' && Number.isFinite(sun.sunrise) && now < sun.sunrise);

    const wind = windForReading(weather?.windSpeed, weather?.windDirection);
    const grey = GREY.has(condition);

    const precip = {
        drizzle: 'drizzle', rain: 'rain', showers: 'rain', freezing: 'sleet',
        snow: 'snow', storm: 'rain', hail: 'hail'
    }[condition] || null;

    const tone = condition === 'storm' || condition === 'hail' ? 'storm'
        : condition === 'snow' ? 'snow'
            : condition === 'fog' ? 'fog'
                : condition === 'freezing' ? 'ice'
                    : ['rain', 'drizzle'].includes(condition) ? 'rain'
                        : condition === 'overcast' || condition === 'showers' ? 'grey'
                            : 'fair';

    const scene = {
        condition,
        intensity,
        light,
        isNight,
        grey,
        tone,
        cover,
        wind,
        precip,
        fog: condition === 'fog' || (condition === 'drizzle' && intensity === 'heavy'),
        lightning: condition === 'storm' || condition === 'hail',
        rainbow: condition === 'showers' && intensity !== 'heavy' && !isNight,
        sun: !isNight && cover < 72 && !['rain', 'storm', 'hail', 'freezing', 'drizzle'].includes(condition)
            && !(condition === 'showers' && intensity === 'heavy'),
        moon: isNight && cover < 82,
        stars: isNight && cover < 80,
        shootingStars: isNight && cover < 45,
        gusts: wind.level === 'windy' || wind.level === 'gale',
        icicles: condition === 'freezing' || (condition === 'fog' && intensity === 'heavy'),
        lite: !!lite,
        now,
        counts: {}
    };
    for (const surface of ['header', 'sky', 'card', 'wall', 'mobile']) {
        scene.counts[surface] = cloudCountFor(surface, cover, { lite });
    }
    return scene;
}

/** Stable little PRNG so a sky keeps the same clouds between re-renders. */
export function seededRandom(seed) {
    let a = (Number(seed) >>> 0) || 1;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Cloud shapes each weather family draws from (see skyWeatherArt CLOUD_SHAPES). */
export const SHAPE_POOLS = {
    fair: ['cumulus', 'puff', 'twin', 'long', 'cumulus', 'puff', 'wisp', 'tower'],
    grey: ['long', 'cumulus', 'twin', 'tower', 'long', 'cumulus'],
    storm: ['anvil', 'tower', 'long', 'cumulus', 'anvil', 'twin'],
    fog: ['long', 'wisp', 'long', 'twin'],
    snow: ['cumulus', 'long', 'twin', 'puff', 'long'],
    rain: ['long', 'cumulus', 'tower', 'twin', 'long'],
    ice: ['long', 'cumulus', 'twin', 'long']
};

/** Vertical band (fraction of the surface height) where clouds may sit. */
const BANDS = {
    header: [-0.25, 0.55],
    sky: [0.02, 0.8],
    card: [-0.12, 0.2],
    wall: [0.02, 0.62],
    mobile: [-0.25, 0.5]
};

/** Base crossing time (seconds) for the nearest cloud on each surface, before wind. */
const BASE_SECONDS = { header: 70, sky: 150, card: 34, wall: 150, mobile: 60 };

/**
 * Where each cloud sits and how it drifts. Deterministic for (surface, count, tone, seed).
 * Returns [{ shape, top (%), size (rem), depth 0..1, alpha, duration (s), delay (s), flip }]
 */
export function cloudLayout(surface, count, tone = 'fair', seed = 7, wind = { factor: 1 }) {
    const rand = seededRandom(`${surface}:${tone}`.split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, seed));
    const pool = SHAPE_POOLS[tone] || SHAPE_POOLS.fair;
    const [top0, top1] = BANDS[surface] || BANDS.header;
    const base = BASE_SECONDS[surface] || 90;
    const factor = Math.max(0.4, Number(wind?.factor) || 1);
    const sizeRange = {
        header: [7, 15], sky: [9, 22], card: [3.4, 6], wall: [14, 30], mobile: [4.5, 8]
    }[surface] || [8, 16];
    const out = [];
    for (let i = 0; i < count; i++) {
        // Spread depths evenly, then jitter, so there is always a near and a far cloud.
        const depth = clamp((i + 0.5) / Math.max(1, count) + (rand() - 0.5) * 0.25, 0, 1);
        const shape = pool[Math.floor(rand() * pool.length)];
        const size = sizeRange[0] + (sizeRange[1] - sizeRange[0]) * (0.35 + depth * 0.65) * (0.85 + rand() * 0.3);
        const top = (top0 + (top1 - top0) * rand()) * 100;
        const duration = (base * (1.9 - depth * 0.95) * (0.85 + rand() * 0.3)) / factor;
        out.push({
            shape,
            top: Math.round(top * 10) / 10,
            size: Math.round(size * 10) / 10,
            depth: Math.round(depth * 100) / 100,
            alpha: Math.round((0.62 + depth * 0.38) * 100) / 100,
            duration: Math.round(duration),
            // Evenly spaced start points along the crossing, so clouds never bunch up.
            delay: -Math.round(duration * ((i / Math.max(1, count)) + rand() * 0.18) % duration),
            flip: rand() > 0.5
        });
    }
    // Far clouds first in the DOM so near ones paint over them.
    return out.sort((a, b) => a.depth - b.depth);
}

/** Short label for the sky, used by the Home card and screen readers. */
export function skySummary(scene) {
    const names = {
        clear: 'Clear sky', partly: 'Fair clouds', overcast: 'Overcast', fog: 'Fog',
        drizzle: 'Drizzle', rain: 'Rain', showers: 'Showers', freezing: 'Freezing rain',
        snow: 'Snow', storm: 'Thunderstorm', hail: 'Hail storm'
    };
    const bits = [names[scene?.condition] || 'Sky'];
    if (scene?.wind?.level === 'windy' || scene?.wind?.level === 'gale') bits.push(scene.wind.level === 'gale' ? 'strong wind' : 'windy');
    return bits.join(', ');
}

/** A key that changes only when a surface needs new DOM (not for colour-only changes). */
export function sceneLayoutKey(scene, surface) {
    if (!scene) return '';
    return [
        surface, scene.condition, scene.intensity, scene.tone, scene.counts?.[surface],
        scene.wind?.dir, Math.round((scene.wind?.factor || 1) * 4), scene.rainbow, scene.gusts,
        scene.stars, scene.shootingStars, scene.icicles, scene.fog, scene.lightning
    ].join('|');
}
