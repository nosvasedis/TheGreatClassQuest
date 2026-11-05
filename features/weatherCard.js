/**
 * The Home weather card: a small window onto the same sky as the header
 * (clouds, rain, snow, lightning from the shared sky scene), an illustrated
 * weather glyph with the real moon phase, a glassy clock, and the next few
 * hours of the school day.
 */

import { resolveSkyScene, sceneLayoutKey } from './skyWeather.mjs';
import { buildCloudsHtml, buildWeatherFxHtml, weatherGlyphSvg } from './skyWeatherArt.js';
import { moonPhase } from '../utils/dayCycle.mjs';
import { escapeHtml } from './roles/shared.js';

export function formatClockTime(date = new Date()) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Hand angles for the weather-card analogue clock. Angles grow through the day
 * (not modulo 360) so the CSS tick transition never spins a hand backwards.
 */
export function getClockHandAngles(date = new Date()) {
    const secs = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
    return { h: secs / 120, m: secs / 10, s: secs * 6 };
}

let clockSeq = 0;

/** Small analogue clock on the weather card: a white enamel face in a gold bezel. */
export function getWeatherClockHtml(now = new Date()) {
    const { h, m, s } = getClockHandAngles(now);
    const id = `wclk-${++clockSeq}`;
    const ticks = Array.from({ length: 12 }, (_, i) => {
        const major = i % 3 === 0;
        return major
            ? `<circle class="weather-clock__dot" cx="32" cy="10.2" r="2.1" transform="rotate(${i * 30} 32 32)"/>`
            : `<line class="weather-clock__tick" x1="32" y1="9" x2="32" y2="11.6" transform="rotate(${i * 30} 32 32)"/>`;
    }).join('');
    return `
        <svg class="weather-clock" viewBox="0 0 64 64" role="img" aria-label="Time ${formatClockTime(now)}" data-home-clock>
            <defs>
                <linearGradient id="${id}-bezel" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="var(--wc-bezel-1, #fde047)"/>
                    <stop offset="0.55" stop-color="var(--wc-bezel-2, #f59e0b)"/>
                    <stop offset="1" stop-color="var(--wc-bezel-3, #ea580c)"/>
                </linearGradient>
                <radialGradient id="${id}-face" cx="38%" cy="30%" r="78%">
                    <stop offset="0" stop-color="#ffffff"/>
                    <stop offset="0.75" stop-color="var(--wc-face-2, #fff7ed)"/>
                    <stop offset="1" stop-color="var(--wc-face-3, #ffedd5)"/>
                </radialGradient>
            </defs>
            <circle class="weather-clock__bezel" cx="32" cy="32" r="30.5" fill="url(#${id}-bezel)"/>
            <circle class="weather-clock__face" cx="32" cy="32" r="26" fill="url(#${id}-face)"/>
            <path class="weather-clock__gloss" d="M13 25 A20 20 0 0 1 38 12.6 A24 24 0 0 0 13 25 Z"/>
            ${ticks}
            <g class="weather-clock__hand weather-clock__hand--h" data-clock-hand="h" style="transform: rotate(${h}deg)"><line x1="32" y1="35" x2="32" y2="19.5"/></g>
            <g class="weather-clock__hand weather-clock__hand--m" data-clock-hand="m" style="transform: rotate(${m}deg)"><line x1="32" y1="36" x2="32" y2="12.5"/></g>
            <g class="weather-clock__hand weather-clock__hand--s" data-clock-hand="s" style="transform: rotate(${s}deg)"><line x1="32" y1="39" x2="32" y2="10.5"/><circle cx="32" cy="10.5" r="1.7"/></g>
            <circle class="weather-clock__pin" cx="32" cy="32" r="2.8"/>
            <circle class="weather-clock__pin-dot" cx="32" cy="32" r="1.1"/>
        </svg>`;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** "NE" style label for the direction the wind blows FROM. */
export function compassFrom(degrees) {
    if (degrees == null || degrees === '') return '';
    const d = Number(degrees);
    if (!Number.isFinite(d)) return '';
    return COMPASS[Math.round((((d % 360) + 360) % 360) / 45) % 8];
}

function metaChipsHtml(theme, reading) {
    const chips = [];
    if (theme.hi != null && theme.lo != null) {
        chips.push(`<span class="weather-chip weather-chip--temp" title="Today's high and low"><span class="weather-chip__hi"><i class="fas fa-temperature-arrow-up"></i>${theme.hi}°</span><span class="weather-chip__lo"><i class="fas fa-temperature-arrow-down"></i>${theme.lo}°</span></span>`);
    }
    const wind = reading?.windSpeed == null ? NaN : Number(reading.windSpeed);
    if (Number.isFinite(wind)) {
        const from = compassFrom(reading.windDirection);
        chips.push(`<span class="weather-chip weather-chip--wind" title="Wind${from ? ` from the ${from}` : ''}"><span class="weather-chip__icon"><i class="fas fa-wind"></i></span>${Math.round(wind)}<small>km/h</small></span>`);
    }
    return chips.join('');
}

/** The next few hours as mini glyphs ("11:00 ☁ 18°"). */
export function hoursStripHtml(reading, sun = {}) {
    const hours = (reading?.hours || []).slice(0, 4);
    if (!hours.length) return '';
    return `<div class="wx-hours" aria-label="Next hours">${hours.map((h) => {
        const t = new Date(h.time);
        const scene = resolveSkyScene({ code: h.code }, { now: t.getTime(), sunrise: sun.sunrise, sunset: sun.sunset });
        let label = `${String(t.getHours()).padStart(2, '0')}:00`;
        if (reading.timezone && reading.timezone !== 'auto') {
            try {
                label = new Intl.DateTimeFormat('en-GB', { timeZone: reading.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t);
            } catch (_) { /* Invalid stored timezone: keep the usable local label. */ }
        }
        const pop = Number.isFinite(h.pop) && h.pop >= 20 ? `<span class="wx-hour__pop">${h.pop}%</span>` : '';
        const warmth = !Number.isFinite(h.temp) ? 'mild' : h.temp < 8 ? 'cold' : h.temp < 16 ? 'cool' : h.temp < 25 ? 'mild' : 'hot';
        return `<div class="wx-hour wx-hour--${warmth}${scene.isNight ? ' wx-hour--night' : ''}" title="${label}: ${Number.isFinite(h.temp) ? `${h.temp}°` : ''}"><span class="wx-hour__t">${label}</span><span class="wx-hour__g">${weatherGlyphSvg(scene, { moonPhase: moonPhase(t.getTime()) })}</span><span class="wx-hour__deg">${Number.isFinite(h.temp) ? `${h.temp}°` : '–'}</span>${pop}</div>`;
    }).join('')}</div>`;
}

/**
 * Bring an open card up to date with a new sky (new reading, or the light moving
 * into night) without re-rendering it: its clouds and weather layers are painted
 * by the sky stage, so only the words, the glyph, the chips and the hours change.
 * The glyph cross-fades.
 */
/** Short stable key for a chunk of markup, so an unchanged glyph is never swapped. */
function hashText(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}

export function refreshWeatherCardInPlace(card, theme, scene, { reading = null, sun = {}, now = new Date() } = {}) {
    if (!card || !scene) return;
    const setText = (sel, text) => {
        const el = card.querySelector(sel);
        if (el && el.textContent !== text) el.textContent = text;
    };
    setText('.weather-temp', theme.temp || '--°C');
    setText('.weather-cond', theme.weatherText || '');
    card.classList.toggle('weather-night', !!theme.isNight);
    const glyphEl = card.querySelector('.weather-glyph');
    const glyph = weatherGlyphSvg(scene, { moonPhase: moonPhase(now.getTime()) });
    const glyphKey = hashText(glyph);
    if (glyphEl && glyphEl.dataset.glyphKey !== glyphKey) {
        const hadGlyph = glyphEl.children.length > 0;
        glyphEl.dataset.glyphKey = glyphKey;
        glyphEl.innerHTML = hadGlyph ? `<span class="weather-glyph__swap">${glyph}</span>` : glyph;
    }
    const meta = card.querySelector('.weather-meta');
    const chips = metaChipsHtml(theme, reading);
    if (meta && meta.innerHTML !== chips) meta.innerHTML = chips;
    const info = card.querySelector('.weather-info');
    if (info) {
        const hours = hoursStripHtml(reading, sun);
        const old = info.querySelector('.wx-hours');
        if (old && old.outerHTML !== hours) old.outerHTML = hours;
        else if (!old && hours) info.insertAdjacentHTML('beforeend', hours);
    }
}

/**
 * Full card markup. `theme` is the Home weather theme (temp, hi/lo, text,
 * legacy w-* class); `scene` is the live sky scene; `reading` the raw reading.
 */
export function getWeatherCardHtml(theme, scene, { reading = null, sun = {}, quizClassId = '', now = new Date(), footerHtml = '', extraClass = '' } = {}) {
    const sky = scene || resolveSkyScene(reading || {}, { now: now.getTime(), ...sun });
    const key = sceneLayoutKey(sky, 'card');
    const glyph = weatherGlyphSvg(sky, { moonPhase: moonPhase(now.getTime()) });
    return `
            <div class="vibrant-card h-span-4 weather-card weather-card--v2 weather-card--v3${extraClass ? ` ${extraClass}` : ''} ${theme.weatherBg || 'w-day'}${theme.isNight ? ' weather-night' : ''}${theme.intensity ? ` weather-${theme.intensity}` : ''}">
                <div class="wx-card-sky" aria-hidden="true">
                    <div class="wx-clouds wx-clouds--card" data-wx-key="c:${key}">${buildCloudsHtml(sky, 'card')}</div>
                    <div class="wx-stage wx-stage--card" data-wx-key="f:${key}">${buildWeatherFxHtml(sky, 'card')}</div>
                </div>
                <div class="weather-glyph" data-glyph-key="${hashText(glyph)}" aria-hidden="true">${glyph}</div>

                <div class="weather-top">
                    ${getWeatherClockHtml(now)}
                    <div class="weather-meta">${metaChipsHtml(theme, reading)}</div>
                </div>

                <div class="weather-info">
                    <div class="weather-temp font-title">${escapeHtml(theme.temp || '--°C')}</div>
                    <div class="weather-cond">${escapeHtml(theme.weatherText || '')}</div>
                    ${hoursStripHtml(reading, sun)}
                </div>

                <div class="weather-bottom">
                    <div id="weather-card-footer" class="weather-card-footer" data-quiz-class="${escapeHtml(quizClassId || '')}">${footerHtml}</div>
                </div>
            </div>`;
}
