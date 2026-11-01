/**
 * The last sky the app saw, remembered on this device, so the loading screen
 * can paint the real time of day and weather from its very first frame,
 * before Firebase, the school's location or a weather request have answered.
 *
 *   rememberSkyReading(reading)   after each live weather reading (features/liveWeather.js)
 *   rememberSunTimes(sun)         after the real sunrise/sunset arrive (utils.js#fetchSolarCycle)
 *   loadingSkyPlan(now)           what the loading screen should paint now
 *
 * Pure apart from the storage passed in (localStorage by default).
 */

const KEY = 'gcq-sky-memory';
const DAY_MS = 24 * 60 * 60 * 1000;
// A reading this fresh is still the weather outside; older, the screen asks again.
export const SKY_MEMORY_FRESH_MS = 75 * 60 * 1000;
// Sun times drift slowly: a few weeks old is still close enough.
const SUN_MEMORY_MAX_MS = 21 * DAY_MS;
// Athens, the app's default school location (utils.js DEFAULT_WEATHER_LOCATION).
const FALLBACK_PLACE = { latitude: 37.9667, longitude: 23.7167 };

function defaultStorage() {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
        return null;
    }
}

export function readSkyMemory(storage = defaultStorage()) {
    try {
        const raw = storage?.getItem(KEY);
        const data = raw ? JSON.parse(raw) : null;
        return data && typeof data === 'object' ? data : null;
    } catch {
        return null;
    }
}

function writeSkyMemory(patch, storage) {
    try {
        if (!storage) return;
        storage.setItem(KEY, JSON.stringify({ ...(readSkyMemory(storage) || {}), ...patch }));
    } catch {
        // Blocked storage: the loading screen simply guesses from the clock.
    }
}

const finite = (n) => (n === null || n === undefined || n === '' ? null : (Number.isFinite(Number(n)) ? Number(n) : null));

/** Keep the weather part of a live reading (and where it was read). */
export function rememberSkyReading(reading, { now = Date.now(), storage = defaultStorage() } = {}) {
    if (!reading || finite(reading.code) === null) return;
    const loc = reading.location || {};
    writeSkyMemory({
        weather: {
            code: finite(reading.code),
            cloudCover: finite(reading.cloudCover),
            windSpeed: finite(reading.windSpeed),
            windDirection: finite(reading.windDirection),
            at: now,
        },
        ...(finite(loc.latitude) !== null && finite(loc.longitude) !== null
            ? { place: { latitude: finite(loc.latitude), longitude: finite(loc.longitude) } }
            : {}),
    }, storage);
}

/** Keep the real sunrise and sunset (epoch ms) for the school. */
export function rememberSunTimes(sun, { now = Date.now(), storage = defaultStorage(), place = null } = {}) {
    const sunrise = finite(sun?.sunrise);
    const sunset = finite(sun?.sunset);
    if (sunrise === null || sunset === null || sunset <= sunrise) return;
    writeSkyMemory({
        sun: { sunrise, sunset, at: now },
        ...(place && finite(place.latitude) !== null && finite(place.longitude) !== null
            ? { place: { latitude: finite(place.latitude), longitude: finite(place.longitude) } }
            : {}),
    }, storage);
}

/** The same clock time as `ms`, on the local day of `now`. */
function onDayOf(ms, now) {
    const src = new Date(ms);
    const day = new Date(now);
    day.setHours(src.getHours(), src.getMinutes(), src.getSeconds(), 0);
    return day.getTime();
}

/**
 * Sunrise and sunset for a place and day, close enough for painting a sky
 * (the NOAA approximation, within a few minutes at school latitudes).
 */
export function approxSunTimes(now, { latitude, longitude } = FALLBACK_PLACE) {
    const rad = Math.PI / 180;
    const date = new Date(now);
    const start = Date.UTC(date.getFullYear(), 0, 0);
    const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const dayOfYear = Math.round((today - start) / DAY_MS);
    const g = (2 * Math.PI / 365) * (dayOfYear - 1);
    const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
        - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
        + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const lat = latitude * rad;
    const cosH = (Math.cos(90.833 * rad) / (Math.cos(lat) * Math.cos(decl))) - Math.tan(lat) * Math.tan(decl);
    const ha = Math.acos(Math.min(1, Math.max(-1, cosH))) / rad;
    const noonUtcMin = 720 - 4 * longitude - eqTime;
    return {
        sunrise: today + (noonUtcMin - 4 * ha) * 60 * 1000,
        sunset: today + (noonUtcMin + 4 * ha) * 60 * 1000,
    };
}

/**
 * What the loading screen should paint at `now`:
 *   sun       { sunrise, sunset } for today (remembered, else worked out)
 *   weather   a remembered reading still fresh enough to show, or null
 *   place     where to ask for the weather when it is not (null: unknown)
 */
export function loadingSkyPlan(now = Date.now(), { storage = defaultStorage() } = {}) {
    const memory = readSkyMemory(storage) || {};
    const place = memory.place && finite(memory.place.latitude) !== null && finite(memory.place.longitude) !== null
        ? { latitude: memory.place.latitude, longitude: memory.place.longitude }
        : null;
    let sun = null;
    if (memory.sun && now - memory.sun.at < SUN_MEMORY_MAX_MS && now >= memory.sun.at - DAY_MS) {
        const sunrise = onDayOf(memory.sun.sunrise, now);
        const sunset = onDayOf(memory.sun.sunset, now);
        if (sunset > sunrise) sun = { sunrise, sunset };
    }
    if (!sun) sun = approxSunTimes(now, place || FALLBACK_PLACE);
    const w = memory.weather;
    const weather = w && finite(w.code) !== null && now - w.at >= 0 && now - w.at < SKY_MEMORY_FRESH_MS
        ? { code: w.code, cloudCover: w.cloudCover, windSpeed: w.windSpeed, windDirection: w.windDirection }
        : null;
    return { sun, weather, place };
}
