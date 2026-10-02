/**
 * Live weather for the whole app (Open-Meteo Best Match + MET Norway fallback).
 *
 * One cached reading drives the header band, the Award sky, the Home card,
 * the phone header and the Projector Sky Window. The app refreshes it every
 * 15 minutes while visible, so the sky outside the window and the sky in the
 * app stay in step even when nobody opens Home.
 */

import * as utils from '../utils.js';
import { HEADER_WEATHER_CLASSES, resolveWeatherTheme, headerClassesForTheme } from './weatherTheme.js';
import { applySkyReading, getSkyScene, getLastSkyReading } from './skyWeatherStage.js';
import { isValidWeatherReading, readingFromOpenMeteo, readingFromMetNorway, openMeteoUrl, metNorwayUrl } from './weatherProviders.mjs';
export { pickUpcomingHours, readingFromOpenMeteo } from './weatherProviders.mjs';

// Versioned: older entries may contain null-as-zero values or wrong-location data.
const CACHE_PREFIX = 'gcq_weather_data_v2';
export const LIVE_WEATHER_TTL_MS = 15 * 60 * 1000;
const REFRESH_CHECK_MS = 5 * 60 * 1000;
const STALE_LIMIT_MS = 90 * 60 * 1000;
const MET_CACHE_MS = 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;

let refreshTimer = null;
const inflight = new Map();
const memoryCache = new Map();
const retryAfter = new Map();

function cacheKey(location = utils.getActiveWeatherLocation()) {
    return utils.getWeatherCacheKey(CACHE_PREFIX, location);
}

export function isWeatherForActiveLocation(reading) {
    return !!reading?.location && cacheKey(reading.location) === cacheKey();
}

function cachedWeather(location, maxAgeMs) {
    const key = cacheKey(location);
    let data = memoryCache.get(key);
    try {
        const raw = localStorage.getItem(key);
        if (raw) data = JSON.parse(raw);
    } catch (_) {
        // Storage may be unavailable in hardened/private browser profiles.
    }
    if (!data || !Number.isFinite(data.timestamp) || !isValidWeatherReading(data.weather)) return null;
    const age = Date.now() - data.timestamp;
    if (age < 0 || !data.weather.location || cacheKey(data.weather.location) !== key) return null;
    if (!Number.isFinite(data.weather.observedAt) || Date.now() - data.weather.observedAt > STALE_LIMIT_MS) return null;
    // MET asks clients to respect Expires; retain its forecast until revalidation.
    if (maxAgeMs === LIVE_WEATHER_TTL_MS && data.weather.provider === 'met-norway'
        && Date.now() < data.expiresAt) return data.weather;
    if (age > maxAgeMs) return null;
    return data.weather;
}

/** Last validated reading for this school; stale reads are explicitly age-bounded. */
export function getCachedWeather(maxAgeMs = LIVE_WEATHER_TTL_MS) {
    return cachedWeather(utils.getActiveWeatherLocation(), maxAgeMs);
}

async function requestWeather(url, parse) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    try {
        // Simple CORS request: the browser supplies Origin for MET identification.
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Weather API HTTP ${response.status}`);
        const weather = parse(await response.json());
        if (!weather) throw new Error('Weather API returned incomplete or outdated data');
        return { weather, expiresAt: Date.parse(response.headers?.get('expires') || '') };
    } finally {
        clearTimeout(timeoutId);
    }
}

/** Fetch one reading per location. Optional weather must never break the app. */
export async function fetchLiveWeather({ maxAgeMs = LIVE_WEATHER_TTL_MS } = {}) {
    const location = utils.getActiveWeatherLocation();
    const key = cacheKey(location);
    const cached = cachedWeather(location, maxAgeMs);
    if (cached) return cached;
    if (inflight.has(key)) return inflight.get(key);
    if (Date.now() < (retryAfter.get(key) || 0)) return cachedWeather(location, STALE_LIMIT_MS);

    const task = (async () => {
        let result;
        try {
            result = await requestWeather(openMeteoUrl(location), readingFromOpenMeteo);
        } catch (error) {
            console.warn('Open-Meteo unavailable; trying MET Norway:', error?.message || error);
            try {
                result = await requestWeather(metNorwayUrl(location), data => readingFromMetNorway(
                    data, Date.now(), location.timezone === 'auto' ? undefined : location.timezone
                ));
            } catch (fallbackError) {
                console.warn('Live weather unavailable:', fallbackError?.message || fallbackError);
                retryAfter.set(key, Date.now() + RETRY_MS);
                return key === cacheKey() ? cachedWeather(location, STALE_LIMIT_MS) : null;
            }
        }
        const timestamp = Date.now();
        const weather = { ...result.weather, location };
        const expiresAt = Number.isFinite(result.expiresAt) ? result.expiresAt : timestamp + MET_CACHE_MS;
        const entry = { timestamp, weather, expiresAt };
        memoryCache.set(key, entry);
        if (memoryCache.size > 8) memoryCache.delete(memoryCache.keys().next().value);
        retryAfter.delete(key);
        try {
            // Always write under the captured location, even if the school changed.
            localStorage.setItem(key, JSON.stringify(entry));
        } catch (_) {
            // A blocked cache must not break the app or trigger repeated requests.
        }
        return key === cacheKey() ? weather : null;
    })();
    inflight.set(key, task);
    try {
        return await task;
    } finally {
        inflight.delete(key);
    }
}

/**
 * Paint a reading everywhere: header weather classes (kept for the styles that
 * key off them), the Award sky mirror, and the sky weather scene.
 */
export function applyLiveSky(reading) {
    if (reading?.location && !isWeatherForActiveLocation(reading)) return getSkyScene();
    // An outage can keep this school's artwork, but must not reuse another school.
    const previous = getLastSkyReading();
    reading = reading || (isWeatherForActiveLocation(previous) ? previous : null);
    const sun = { now: Date.now(), ...utils.getSolarTimes() };
    const scene = applySkyReading(reading, sun, { reset: !reading });
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
    const previous = getLastSkyReading();
    if (reading || (previous && !isWeatherForActiveLocation(previous))) applyLiveSky(reading);
}

/** Keep the sky live while the app is open. Idempotent. */
export function startLiveSky() {
    if (refreshTimer || typeof window === 'undefined') return;
    refreshTimer = setInterval(refreshNow, REFRESH_CHECK_MS);
    window.addEventListener('gcq:weather-location', refreshNow);
    void refreshNow();
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshNow();
    });
}
