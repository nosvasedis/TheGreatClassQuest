/**
 * Live weather for the whole app (free Open-Meteo, no key).
 *
 * One cached reading drives the header band, the Award sky, the Home card,
 * the phone header and the Projector Sky Window. The app refreshes it every
 * 20 minutes while visible, so the sky outside the window and the sky in the
 * app stay in step even when nobody opens Home.
 */

import * as utils from '../utils.js';
import { HEADER_WEATHER_CLASSES, resolveWeatherTheme, headerClassesForTheme } from './weatherTheme.js';
import { applySkyReading } from './skyWeatherStage.js';

const CACHE_PREFIX = 'gcq_weather_data_open_meteo';
export const LIVE_WEATHER_TTL_MS = 20 * 60 * 1000;
const REFRESH_CHECK_MS = 5 * 60 * 1000;
const HOURS_AHEAD = 4;

let refreshTimer = null;
let inflight = null;

function cacheKey() {
    return utils.getWeatherCacheKey(CACHE_PREFIX, utils.getActiveWeatherLocation());
}

/** Last cached reading if it is younger than maxAgeMs (any age with Infinity). */
export function getCachedWeather(maxAgeMs = LIVE_WEATHER_TTL_MS) {
    try {
        const raw = localStorage.getItem(cacheKey());
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data?.weather || !Number.isFinite(data.timestamp)) return null;
        if (Date.now() - data.timestamp > maxAgeMs) return null;
        return data.weather;
    } catch (_) {
        // Storage may be unavailable in hardened/private browser profiles.
        return null;
    }
}

/** Next few whole hours from Open-Meteo's hourly arrays (local time strings). */
export function pickUpcomingHours(hourly, nowMs = Date.now(), count = HOURS_AHEAD) {
    const times = hourly?.time || [];
    const out = [];
    for (let i = 0; i < times.length && out.length < count; i++) {
        const t = new Date(times[i]).getTime();
        if (!Number.isFinite(t) || t <= nowMs) continue;
        out.push({
            time: times[i],
            code: hourly.weather_code?.[i],
            temp: Math.round(Number(hourly.temperature_2m?.[i])),
            pop: Number.isFinite(Number(hourly.precipitation_probability?.[i])) ? Math.round(Number(hourly.precipitation_probability[i])) : null
        });
    }
    return out;
}

/** Map Open-Meteo's JSON to the reading the app stores. */
export function readingFromOpenMeteo(data, nowMs = Date.now()) {
    const cur = data?.current || {};
    const hi = Number(data?.daily?.temperature_2m_max?.[0]);
    const lo = Number(data?.daily?.temperature_2m_min?.[0]);
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    return {
        temp: Math.round(Number(cur.temperature_2m)),
        code: cur.weather_code,
        hi: Number.isFinite(hi) ? Math.round(hi) : null,
        lo: Number.isFinite(lo) ? Math.round(lo) : null,
        cloudCover: num(cur.cloud_cover),
        windSpeed: num(cur.wind_speed_10m),
        windDirection: num(cur.wind_direction_10m),
        isDay: cur.is_day === undefined ? null : cur.is_day === 1,
        hours: pickUpcomingHours(data?.hourly, nowMs)
    };
}

/** Fetch (or reuse) the live reading. Returns null when offline or blocked. */
export async function fetchLiveWeather({ maxAgeMs = LIVE_WEATHER_TTL_MS } = {}) {
    const cached = getCachedWeather(maxAgeMs);
    // Readings saved before the sky revamp have no cloud cover; refresh them once.
    if (cached && cached.cloudCover !== undefined) return cached;
    if (inflight) return inflight;

    const location = utils.getActiveWeatherLocation();
    const url = 'https://api.open-meteo.com/v1/forecast'
        + `?latitude=${location.latitude}&longitude=${location.longitude}`
        + '&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,is_day'
        + '&hourly=temperature_2m,weather_code,precipitation_probability'
        + '&daily=temperature_2m_max,temperature_2m_min'
        + '&forecast_days=2&timezone=auto';

    inflight = (async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error('Weather API failed');
            const weather = readingFromOpenMeteo(await response.json());
            try {
                localStorage.setItem(cacheKey(), JSON.stringify({ timestamp: Date.now(), weather }));
            } catch (_) {
                // Weather is optional; a blocked local cache must not break the app.
            }
            return weather;
        } catch (e) {
            if (e?.name === 'AbortError') console.warn('Open-Meteo timed out; the sky keeps its last look.');
            else console.warn('Open-Meteo fetch failed:', e?.message || e);
            // An older reading still beats a blank sky.
            return getCachedWeather(6 * 60 * 60 * 1000);
        } finally {
            clearTimeout(timeoutId);
            inflight = null;
        }
    })();
    return inflight;
}

/**
 * Paint a reading everywhere: header weather classes (kept for the styles that
 * key off them), the Award sky mirror, and the sky weather scene.
 */
export function applyLiveSky(reading) {
    const sun = { now: Date.now(), ...utils.getSolarTimes() };
    const scene = applySkyReading(reading, sun);
    const header = document.querySelector('#award-header-atmosphere header') || document.querySelector('header');
    if (header) {
        header.classList.remove(...HEADER_WEATHER_CLASSES);
        const theme = reading ? resolveWeatherTheme(reading.code) : {};
        const classes = headerClassesForTheme(theme, scene?.isNight);
        if (classes.length) header.classList.add(...classes);
        header.style.background = '';
    }
    const atmosphere = document.getElementById('award-header-atmosphere');
    if (atmosphere) atmosphere.style.background = '';
    utils.syncAwardSkyWeather(header);
    return scene;
}

async function refreshNow() {
    if (typeof document !== 'undefined' && document.hidden) return;
    const reading = await fetchLiveWeather();
    if (reading) applyLiveSky(reading);
}

/** Keep the sky live while the app is open. Idempotent. */
export function startLiveSky() {
    if (refreshTimer || typeof window === 'undefined') return;
    refreshTimer = setInterval(refreshNow, REFRESH_CHECK_MS);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshNow();
    });
}
