// features/homeGreetingScene.js
// The Home greeting card's landscape (layered rolling hills) and the live
// day/night ring around the class logo. The ring is a 24-hour dial: noon at
// the top, midnight at the bottom, daylight painted between today's real
// sunrise and sunset, and the sun (or tonight's real moon phase) riding the
// ring at the current time.

import { getSolarTimes } from '../utils.js';
import {
    dialAngle,
    dialAngleFromMidnight,
    currentLightSpan,
    moonPhase,
    moonPhaseName,
    moonLitPath,
    pointOnDial,
    dialArcPath
} from '../utils/dayCycle.mjs';

const C = 120; // SVG centre (viewBox 0 0 240 240)
const BAND_IN = 84; // inner edge of the sky band
const BAND_OUT = 106; // outer edge of the sky band
const BAND_R = (BAND_IN + BAND_OUT) / 2;
const MARKER_R = BAND_R;
const TICK_IN = 109.6;
const TICK_OUT = 113.2;
const BEZEL_IN = 107.6;
const BEZEL_OUT = 115.2;
const INTRO_MS = 4200;

let ringInterval = null;
let introPending = true; // the first Home render of the session plays the intro
let introStartedAt = null;

const f = (n) => Math.round(n * 100) / 100;

function formatTime(time) {
    return new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Hills
// ---------------------------------------------------------------------------

/**
 * A handful of trees along a ridge: cypresses (tall) and olive-like rounded crowns.
 * Each tree is [x, y, size, kind] with kind 'c' (cypress) or 'o' (olive).
 */
export function treesHtml(trees) {
    return trees.map(([x, y, s, kind]) => {
        if (kind === 'c') {
            return `<path class="gs-tree" d="M ${x} ${y} c ${-3.2 * s} ${-6 * s} ${-3.4 * s} ${-18 * s} 0 ${-30 * s} c ${3.4 * s} ${12 * s} ${3.2 * s} ${24 * s} 0 ${30 * s} z"/>`;
        }
        return `<g class="gs-tree"><rect x="${f(x - 0.9 * s)}" y="${f(y - 7 * s)}" width="${f(1.8 * s)}" height="${f(7 * s)}" rx="${f(0.6 * s)}"/>`
            + `<ellipse cx="${x}" cy="${f(y - 10 * s)}" rx="${f(7.5 * s)}" ry="${f(5.8 * s)}"/>`
            + `<ellipse cx="${f(x - 4 * s)}" cy="${f(y - 8 * s)}" rx="${f(4.6 * s)}" ry="${f(3.8 * s)}"/></g>`;
    }).join('');
}

let hillsSerial = 0;

export function getGreetingHillsHtml() {
    // Wide canvas that crops from the middle on narrow cards (slice), so the
    // trees keep their shape instead of stretching.
    // Gradient ids are unique per copy: the phone and desktop Home both render
    // these hills, and url(#id) picks the first match in the document, so a
    // shared id would paint the visible hills with the hidden copy's gradients
    // (which Chrome draws as nothing, leaving only the trees and cottage).
    const uid = `gh-${++hillsSerial}`;
    return `
    <svg class="greeting-hills" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
        <defs>
            <linearGradient id="${uid}-far" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" class="gh-far-top"/>
                <stop offset="1" class="gh-far-bottom"/>
            </linearGradient>
            <linearGradient id="${uid}-mid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" class="gh-mid-top"/>
                <stop offset="1" class="gh-mid-bottom"/>
            </linearGradient>
            <linearGradient id="${uid}-mid2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" class="gh-mid2-top"/>
                <stop offset="1" class="gh-mid2-bottom"/>
            </linearGradient>
            <linearGradient id="${uid}-near" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" class="gh-near-top"/>
                <stop offset="1" class="gh-near-bottom"/>
            </linearGradient>
            <linearGradient id="${uid}-mist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" class="gh-mist" stop-opacity="0"/>
                <stop offset="0.55" class="gh-mist" stop-opacity="0.75"/>
                <stop offset="1" class="gh-mist" stop-opacity="0"/>
            </linearGradient>
            <linearGradient id="${uid}-shade" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" class="gh-shadow" stop-opacity="0.22"/>
                <stop offset="0.5" class="gh-shadow" stop-opacity="0.05"/>
                <stop offset="1" class="gh-shadow" stop-opacity="0.16"/>
            </linearGradient>
        </defs>

        <!-- Distant range, softened by haze -->
        <path class="gh-layer gh-layer--far" fill="url(#${uid}-far)"
            d="M0 168 C 70 150, 120 128, 190 132 C 250 136, 290 158, 350 150 C 420 140, 460 104, 540 108 C 610 112, 650 148, 720 146 C 790 144, 830 118, 900 112 C 980 106, 1030 140, 1100 142 C 1170 144, 1210 116, 1280 112 C 1350 108, 1400 128, 1440 136 L1440 320 L0 320 Z"/>
        <rect class="gh-layer" x="0" y="118" width="1440" height="90" fill="url(#${uid}-mist)"/>

        <!-- Middle hills -->
        <path class="gh-layer gh-layer--mid" fill="url(#${uid}-mid)"
            d="M0 206 C 90 184, 170 170, 260 178 C 350 186, 400 212, 490 206 C 590 198, 640 164, 740 160 C 840 156, 900 190, 990 196 C 1080 202, 1140 178, 1230 170 C 1320 162, 1390 176, 1440 184 L1440 320 L0 320 Z"/>
        <g class="gh-trees gh-trees--mid">
            ${treesHtml([
                [606, 184, 0.85, 'c'], [622, 181, 0.7, 'c'], [690, 166, 0.95, 'o'], [724, 162, 0.8, 'c'], [742, 161, 0.62, 'c'],
                [1170, 179, 0.85, 'o'], [1200, 174, 0.9, 'c'], [1218, 172, 0.7, 'c'],
                [236, 178, 0.8, 'o'], [262, 179, 0.85, 'c']
            ])}
        </g>
        <path class="gh-layer gh-layer--mid2" fill="url(#${uid}-mid2)"
            d="M0 240 C 110 222, 200 212, 300 220 C 390 228, 450 250, 560 246 C 660 242, 720 222, 820 224 C 930 226, 980 252, 1090 250 C 1190 248, 1260 224, 1350 222 C 1400 221, 1425 226, 1440 229 L1440 320 L0 320 Z"/>

        <!-- Near meadow -->
        <path class="gh-layer gh-layer--near" fill="url(#${uid}-near)"
            d="M0 272 C 140 256, 260 250, 400 262 C 520 272, 610 292, 740 288 C 880 284, 960 258, 1100 256 C 1230 254, 1330 270, 1440 276 L1440 320 L0 320 Z"/>
        <path class="gh-crest" d="M0 272 C 140 256, 260 250, 400 262 C 520 272, 610 292, 740 288 C 880 284, 960 258, 1100 256 C 1230 254, 1330 270, 1440 276"/>
        <path class="gh-crest gh-crest--mid" d="M0 240 C 110 222, 200 212, 300 220 C 390 228, 450 250, 560 246 C 660 242, 720 222, 820 224 C 930 226, 980 252, 1090 250 C 1190 248, 1260 224, 1350 222 C 1400 221, 1425 226, 1440 229"/>
        <g class="gh-cottage" transform="translate(1072 262)">
            <rect class="gh-cottage__chimney" x="4" y="-27" width="3.4" height="8"/>
            <rect class="gh-cottage__wall" x="-11" y="-15" width="22" height="15" rx="1"/>
            <path class="gh-cottage__roof" d="M -14 -14 L 0 -26 L 14 -14 Z"/>
            <rect class="gh-cottage__window" x="-7.5" y="-10.5" width="5" height="5" rx="0.8"/>
            <rect class="gh-cottage__door" x="2" y="-9" width="5" height="9" rx="2.5"/>
        </g>
        <g class="gh-trees gh-trees--near">
            ${treesHtml([[1012, 261, 1.3, 'c'], [1030, 259, 1.05, 'c'], [1112, 258, 1.3, 'o'], [470, 268, 1.2, 'o'], [80, 263, 1.25, 'o'], [108, 262, 1.0, 'c']])}
        </g>

        <path class="gh-shade" fill="url(#${uid}-shade)"
            d="M0 272 C 140 256, 260 250, 400 262 C 520 272, 610 292, 740 288 C 880 284, 960 258, 1100 256 C 1230 254, 1330 270, 1440 276 L1440 320 L0 320 Z"/>

    </svg>`;
}

// ---------------------------------------------------------------------------
// Day / night ring: a little celestial dial (astrolabe) around the class logo
// ---------------------------------------------------------------------------

/**
 * The intro plays when the Home tab opens. Home also re-renders quietly when
 * data changes; a re-render during the intro carries on from where it was
 * (negative animation delay) instead of restarting or cutting it off.
 */
export function requestDayRingIntro() {
    introPending = true;
}

function takeIntroOffset() {
    const now = performance.now();
    if (introPending) {
        introPending = false;
        introStartedAt = now;
        return 0;
    }
    if (introStartedAt != null && now - introStartedAt < INTRO_MS) return now - introStartedAt;
    return null;
}

/** Conic-gradient stops (degrees from midnight): deep night, violet and rose dawn, gold sunrise, open sky, and a fiery dusk. */
function bandGradient(sunrise, sunset) {
    const r = dialAngleFromMidnight(sunrise);
    const s = dialAngleFromMidnight(sunset);
    const noon = (r + s) / 2;
    const stops = [
        ['#0b1030', 0],
        ['#151a45', r - 34],
        ['#3b2f86', r - 18],
        ['#a855f7', r - 9],
        ['#f472b6', r - 3.5],
        ['#fb923c', r + 1.5],
        ['#fde68a', r + 8],
        ['#93d7fb', r + 22],
        ['#4cb8f5', noon - 25],
        ['#38a8f0', noon],
        ['#4cb8f5', noon + 25],
        ['#93d7fb', s - 22],
        ['#fcd34d', s - 8],
        ['#f97316', s - 1.5],
        ['#e11d48', s + 3.5],
        ['#9333ea', s + 9],
        ['#3b2f86', s + 18],
        ['#151a45', s + 34],
        ['#0b1030', 360]
    ];
    return `conic-gradient(from 180deg, ${stops.map(([c, a]) => `${c} ${f(Math.min(360, Math.max(0, a)))}deg`).join(', ')})`;
}

/** Soft colour of the sky right now, for the glow behind the logo. */
function skyTint(span) {
    if (!span.isDay) return 'rgba(129, 140, 248, 0.55)';
    if (span.progress < 0.12) return 'rgba(251, 191, 36, 0.55)';
    if (span.progress > 0.88) return 'rgba(251, 113, 133, 0.55)';
    return 'rgba(125, 211, 252, 0.55)';
}

/** Deterministic scatter, so stars don't jump about between renders. */
function seeded(seed) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function nightStarsHtml(sunrise, sunset) {
    const setA = dialAngle(sunset);
    let riseA = dialAngle(sunrise);
    if (riseA <= setA) riseA += 360;
    const from = setA + 14;
    const span = riseA - 14 - from;
    if (span <= 10) return '';
    const rand = seeded(42);
    const count = 30;
    return Array.from({ length: count }, (_, i) => {
        const a = from + span * ((i + rand() * 0.9) / count);
        const r = BAND_IN + 3 + rand() * (BAND_OUT - BAND_IN - 6);
        const p = pointOnDial(a, r, C, C);
        const big = rand() > 0.82;
        const size = big ? 1.5 : 0.55 + rand() * 0.6;
        const twinkle = rand() > 0.55 ? ' is-twinkle' : '';
        const style = `--i:${i}; animation-delay:calc(${1000 + i * 35}ms + var(--dr-t0, 0ms))${twinkle ? `, ${f(rand() * 3)}s` : ''}`;
        if (big) {
            // A four-point sparkle for the brightest stars.
            const s = 2.6;
            return `<path class="day-ring__star is-bright${twinkle}" style="${style}" transform="translate(${f(p.x)} ${f(p.y)})" d="M0 ${-s} Q0.35 -0.35 ${s} 0 Q0.35 0.35 0 ${s} Q-0.35 0.35 ${-s} 0 Q-0.35 -0.35 0 ${-s} Z"/>`;
        }
        return `<circle class="day-ring__star${twinkle}" style="${style}" cx="${f(p.x)}" cy="${f(p.y)}" r="${f(size)}"/>`;
    }).join('');
}

/** A few small clouds drifting across the daylight stretch. */
function dayCloudsHtml(sunrise, sunset) {
    const riseA = dialAngle(sunrise);
    let setA = dialAngle(sunset);
    if (setA <= riseA) setA += 360;
    const span = setA - riseA;
    return [[0.24, 1.5, 0.9], [0.52, -2.5, 1.1], [0.8, 2, 0.85]].map(([t, dr, s], i) => {
        const a = riseA + span * t;
        const p = pointOnDial(a, BAND_R + dr, C, C);
        return `<g class="day-ring__cloud" style="--i:${i}" transform="translate(${f(p.x)} ${f(p.y)}) rotate(${f(a)}) scale(${s})">`
            + '<ellipse cx="0" cy="1" rx="6.5" ry="2.6"/><circle cx="-2.2" cy="-0.4" r="2.8"/><circle cx="1.8" cy="-1.2" r="3.4"/></g>';
    }).join('');
}

/** Gold bezel: engraved hour ticks, a tiny sun at noon and a crescent at midnight. */
function bezelHtml() {
    const ticks = Array.from({ length: 24 }, (_, h) => {
        if (h % 6 === 0) return '';
        const a = ((h / 24) * 360 + 180) % 360;
        const long = h % 3 === 0;
        const p0 = pointOnDial(a, long ? TICK_IN - 0.6 : TICK_IN + 0.6, C, C);
        const p1 = pointOnDial(a, long ? TICK_OUT + 0.6 : TICK_OUT - 0.4, C, C);
        return `<line class="day-ring__tick${long ? ' is-long' : ''}" style="--i:${h}" x1="${f(p0.x)}" y1="${f(p0.y)}" x2="${f(p1.x)}" y2="${f(p1.y)}"/>`;
    }).join('');
    const mid = (BEZEL_IN + BEZEL_OUT) / 2;
    const noon = pointOnDial(0, mid, C, C);
    const midnight = pointOnDial(180, mid, C, C);
    const dawn = pointOnDial(270, mid, C, C);
    const dusk = pointOnDial(90, mid, C, C);
    const sunRays = Array.from({ length: 8 }, (_, i) => {
        const a = i * 45;
        const q0 = pointOnDial(a, 2.4, 0, 0);
        const q1 = pointOnDial(a, 3.6, 0, 0);
        return `<line x1="${f(q0.x)}" y1="${f(q0.y)}" x2="${f(q1.x)}" y2="${f(q1.y)}"/>`;
    }).join('');
    const stud = (p, i) => `<path class="day-ring__stud" style="--i:${i}" transform="translate(${f(p.x)} ${f(p.y)})" d="M0 -2.2 L1.6 0 L0 2.2 L-1.6 0 Z"/>`;
    return `
        <circle class="day-ring__bezel" cx="${C}" cy="${C}" r="${mid}" pathLength="1" transform="rotate(90 ${C} ${C})"/>
        <circle class="day-ring__bezel-line" cx="${C}" cy="${C}" r="${BEZEL_OUT}" pathLength="1" transform="rotate(90 ${C} ${C})"/>
        <circle class="day-ring__bezel-line" cx="${C}" cy="${C}" r="${BEZEL_IN}" pathLength="1" transform="rotate(90 ${C} ${C})"/>
        ${ticks}
        <g class="day-ring__glyph day-ring__glyph--sun" transform="translate(${f(noon.x)} ${f(noon.y)})"><circle r="1.7"/>${sunRays}</g>
        <path class="day-ring__glyph day-ring__glyph--moon" transform="translate(${f(midnight.x)} ${f(midnight.y)})" d="M0.6 -2.9 A 2.9 2.9 0 1 0 0.6 2.9 A 2.3 2.3 0 1 1 0.6 -2.9 Z"/>
        ${stud(dawn, 6)}${stud(dusk, 18)}`;
}

/** Glowing notches where the sky band meets the horizon: today's sunrise and sunset. */
function horizonMarksHtml(sunrise, sunset) {
    return [[sunrise, 'rise'], [sunset, 'set']].map(([t, kind]) => {
        const a = dialAngle(t);
        const p0 = pointOnDial(a, BAND_IN + 1, C, C);
        const p1 = pointOnDial(a, BAND_OUT - 1, C, C);
        return `<line class="day-ring__horizon day-ring__horizon--${kind}" x1="${f(p0.x)}" y1="${f(p0.y)}" x2="${f(p1.x)}" y2="${f(p1.y)}"/>`;
    }).join('');
}

/** Comet tail fading out behind the sun or moon. */
function cometHtml(st) {
    const length = Math.min(70, st.toA - st.startA);
    if (length < 3) return '';
    const n = 16;
    return Array.from({ length: n }, (_, k) => {
        const a0 = st.toA - length + (length * k) / n;
        const a1 = st.toA - length + (length * (k + 1)) / n;
        const t = (k + 1) / n;
        return `<path d="${dialArcPath(a0, a1 + 0.4, BAND_R, C, C)}" style="opacity:${f(t * t * 0.85)}; stroke-width:${f(2 + t * 5)}"/>`;
    }).join('');
}

function sunMarkerHtml() {
    const rays = Array.from({ length: 12 }, (_, i) => {
        const a = i * 30;
        const p0 = pointOnDial(a, 13.5, 0, 0);
        const p1 = pointOnDial(a, i % 2 ? 17.5 : 20.5, 0, 0);
        return `<line x1="${f(p0.x)}" y1="${f(p0.y)}" x2="${f(p1.x)}" y2="${f(p1.y)}"/>`;
    }).join('');
    return `
        <g class="day-ring__sun">
            <circle class="day-ring__flare" r="16" fill="url(#dr-sun-glow)"/>
            <circle r="28" fill="url(#dr-sun-glow)"/>
            <g class="day-ring__rays">${rays}</g>
            <circle r="10.5" fill="url(#dr-sun-disc)"/>
            <circle r="10.5" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="0.9"/>
        </g>`;
}

function moonMarkerHtml(phase) {
    const lit = moonLitPath(phase, 10.5);
    return `
        <g class="day-ring__moon">
            <circle class="day-ring__flare" r="16" fill="url(#dr-moon-glow)"/>
            <circle r="25" fill="url(#dr-moon-glow)"/>
            <circle r="10.5" class="day-ring__moon-dark"/>
            ${lit ? `<path d="${lit}" fill="url(#dr-moon-lit)"/>` : ''}
            <g clip-path="url(#dr-moon-clip)" class="day-ring__craters">
                <circle cx="-3" cy="-3.5" r="2.1"/>
                <circle cx="3.7" cy="2.3" r="1.6"/>
                <circle cx="-1" cy="4.6" r="1.1"/>
                <circle cx="4.4" cy="-4.4" r="0.9"/>
            </g>
            <circle r="10.5" fill="none" stroke="rgba(226,232,240,0.6)" stroke-width="0.7"/>
        </g>`;
}

function ringState(now, sunrise, sunset) {
    const span = currentLightSpan(now, sunrise, sunset);
    const nowA = dialAngle(now);
    const startA = dialAngle(span.start);
    // Unwrap so the sweep always runs clockwise from the start of this stretch.
    let toA = nowA;
    while (toA < startA) toA += 360;
    const phase = moonPhase(now);
    return { span, startA, toA, phase };
}

function ringLabel(now, sunrise, sunset, st) {
    const time = formatTime(now);
    if (st.span.isDay) {
        return `Daytime, ${time}. Sunrise ${formatTime(sunrise)}, sunset ${formatTime(sunset)}.`;
    }
    return `Night, ${time}. ${moonPhaseName(st.phase)}. Sunrise at ${formatTime(sunrise)}.`;
}

function trailPath(st) {
    return dialArcPath(st.startA, st.toA, BAND_R, C, C);
}

/** The whole emblem: a 24-hour sky dial with the sun or moon, around the class logo. */
export function getDayRingEmblemHtml(logo, { now = Date.now(), sunrise, sunset, intro } = {}) {
    if (sunrise == null || sunset == null) ({ sunrise, sunset } = getSolarTimes());
    const st = ringState(now, sunrise, sunset);
    const markerTop = pointOnDial(0, MARKER_R, C, C);
    const label = ringLabel(now, sunrise, sunset, st);
    const kind = st.span.isDay ? 'day' : 'night';
    // Low sun (near sunrise or sunset) glows orange; high sun is golden white.
    const lowSun = st.span.isDay && Math.sin(st.span.progress * Math.PI) < 0.35;
    const introOffset = intro === false ? null : intro === true ? 0 : takeIntroOffset();
    const introVars = introOffset == null ? '' : ` --dr-t0:${Math.round(-introOffset)}ms;`;
    return `
    <div class="greeting-emblem day-ring day-ring--${kind}${lowSun ? ' is-low-sun' : ''}${introOffset == null ? '' : ' is-intro'}" data-day-ring
        data-sunrise="${sunrise}" data-sunset="${sunset}" data-kind="${kind}"
        role="img" aria-label="${label}" title="${label}"
        style="--dr-from:${f(st.startA)}deg; --dr-to:${f(st.toA)}deg; --dr-tint:${skyTint(st.span)}; --dr-band:${bandGradient(sunrise, sunset)};${introVars}">
        <span class="day-ring__halo" aria-hidden="true"></span>
        <span class="day-ring__band-wrap" aria-hidden="true"><span class="day-ring__band"></span></span>
        <svg class="day-ring__svg" viewBox="0 0 240 240" aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id="dr-gold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="#fde68a"/>
                    <stop offset="0.35" stop-color="#d4a017"/>
                    <stop offset="0.6" stop-color="#fef3c7"/>
                    <stop offset="1" stop-color="#b7791f"/>
                </linearGradient>
                <radialGradient id="dr-sun-glow">
                    <stop offset="0" stop-color="#fef3c7" stop-opacity="0.95"/>
                    <stop offset="0.45" class="dr-sun-glow-mid" stop-opacity="0.45"/>
                    <stop offset="1" class="dr-sun-glow-mid" stop-opacity="0"/>
                </radialGradient>
                <radialGradient id="dr-sun-disc" cx="0.38" cy="0.35" r="0.7">
                    <stop offset="0" stop-color="#fffbeb"/>
                    <stop offset="0.45" class="dr-sun-core"/>
                    <stop offset="1" class="dr-sun-rim"/>
                </radialGradient>
                <radialGradient id="dr-moon-glow">
                    <stop offset="0" stop-color="#e0e7ff" stop-opacity="0.8"/>
                    <stop offset="0.5" stop-color="#a5b4fc" stop-opacity="0.3"/>
                    <stop offset="1" stop-color="#818cf8" stop-opacity="0"/>
                </radialGradient>
                <radialGradient id="dr-moon-lit" cx="0.4" cy="0.35" r="0.75">
                    <stop offset="0" stop-color="#ffffff"/>
                    <stop offset="1" stop-color="#cbd5e1"/>
                </radialGradient>
                <clipPath id="dr-moon-clip"><path d="${moonLitPath(st.phase, 10.5) || 'M0 0'}"/></clipPath>
            </defs>
            <circle class="day-ring__depth" cx="${C}" cy="${C}" r="${BAND_IN + 1.2}"/>
            <circle class="day-ring__depth day-ring__depth--rim" cx="${C}" cy="${C}" r="${BAND_OUT - 0.9}"/>
            <path class="day-ring__gloss" d="${dialArcPath(292, 352, BAND_OUT - 3.5, C, C)}"/>
            ${dayCloudsHtml(sunrise, sunset)}
            ${nightStarsHtml(sunrise, sunset)}
            ${horizonMarksHtml(sunrise, sunset)}
            ${bezelHtml()}
            <path class="day-ring__trail" data-day-ring-trail d="${trailPath(st)}" pathLength="1"/>
            <g class="day-ring__comet" data-day-ring-comet>${cometHtml(st)}</g>
            <circle class="day-ring__glint" cx="${C}" cy="${C}" r="${(BEZEL_IN + BEZEL_OUT) / 2}" pathLength="1" transform="rotate(${f(st.toA - 90)} ${C} ${C})"/>
            <g class="day-ring__carrier" data-day-ring-carrier>
                <g transform="translate(${f(markerTop.x)} ${f(markerTop.y)})">
                    <g class="day-ring__upright">
                        <g class="day-ring__body">
                            ${st.span.isDay ? sunMarkerHtml() : moonMarkerHtml(st.phase)}
                        </g>
                    </g>
                </g>
            </g>
        </svg>
        <span class="greeting-emblem__face" aria-hidden="true">${logo}</span>
    </div>`;
}

/** Keeps the ring on the real time: moves the sun or moon, and redraws at sunrise and sunset. */
export function startDayRingClock(root = document) {
    if (ringInterval) clearInterval(ringInterval);
    const tick = () => {
        const ring = root.querySelector('[data-day-ring]');
        if (!ring || !ring.isConnected) {
            clearInterval(ringInterval);
            ringInterval = null;
            return;
        }
        if (ring.classList.contains('is-intro')) {
            if (introStartedAt != null && performance.now() - introStartedAt < INTRO_MS + 400) return;
            ring.classList.remove('is-intro');
        }
        const { sunrise, sunset } = getSolarTimes();
        const now = Date.now();
        const st = ringState(now, sunrise, sunset);
        const kind = st.span.isDay ? 'day' : 'night';
        const solarChanged = String(sunrise) !== ring.dataset.sunrise || String(sunset) !== ring.dataset.sunset;
        if (solarChanged || kind !== ring.dataset.kind) {
            // Sunrise, sunset, or fresh solar times: rebuild quietly (no intro).
            const logo = ring.querySelector('.greeting-emblem__face')?.innerHTML || '';
            const holder = document.createElement('div');
            holder.innerHTML = getDayRingEmblemHtml(logo, { now, sunrise, sunset, intro: false });
            const fresh = holder.firstElementChild;
            if (fresh) ring.replaceWith(fresh);
            return;
        }
        ring.style.setProperty('--dr-from', `${f(st.startA)}deg`);
        ring.style.setProperty('--dr-to', `${f(st.toA)}deg`);
        ring.querySelector('[data-day-ring-trail]')?.setAttribute('d', trailPath(st));
        const comet = ring.querySelector('[data-day-ring-comet]');
        if (comet) comet.innerHTML = cometHtml(st);
        const label = ringLabel(now, sunrise, sunset, st);
        ring.setAttribute('aria-label', label);
        ring.setAttribute('title', label);
    };
    ringInterval = setInterval(tick, 30000);
    // Solar times usually land a moment after first paint; wait for the intro to finish.
    setTimeout(tick, INTRO_MS + 600);
}
