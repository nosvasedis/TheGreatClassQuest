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
const BAND_R = 99; // centre line of the coloured band
const MARKER_R = 99;
const TICK_IN = 110;
const TICK_OUT = 114;

let ringInterval = null;

const f = (n) => Math.round(n * 100) / 100;

function formatTime(time) {
    return new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Hills
// ---------------------------------------------------------------------------

/** A handful of trees along a ridge: cypresses (tall) and olive-like rounded crowns. */
function treesHtml(trees) {
    return trees.map(([x, y, s, kind]) => {
        if (kind === 'c') {
            return `<path class="gs-tree" d="M ${x} ${y} c ${-3.2 * s} ${-6 * s} ${-3.4 * s} ${-18 * s} 0 ${-30 * s} c ${3.4 * s} ${12 * s} ${3.2 * s} ${24 * s} 0 ${30 * s} z"/>`;
        }
        return `<g class="gs-tree"><rect x="${f(x - 0.9 * s)}" y="${f(y - 7 * s)}" width="${f(1.8 * s)}" height="${f(7 * s)}" rx="${f(0.6 * s)}"/>`
            + `<ellipse cx="${x}" cy="${f(y - 10 * s)}" rx="${f(7.5 * s)}" ry="${f(5.8 * s)}"/>`
            + `<ellipse cx="${f(x - 4 * s)}" cy="${f(y - 8 * s)}" rx="${f(4.6 * s)}" ry="${f(3.8 * s)}"/></g>`;
    }).join('');
}

export function getGreetingHillsHtml() {
    // Wide canvas that crops from the middle on narrow cards (slice), so the
    // trees keep their shape instead of stretching.
    return `
    <svg class="greeting-hills" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
        <defs>
            <linearGradient id="gh-far" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" class="gh-far-top"/>
                <stop offset="1" class="gh-far-bottom"/>
            </linearGradient>
            <linearGradient id="gh-mid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" class="gh-mid-top"/>
                <stop offset="1" class="gh-mid-bottom"/>
            </linearGradient>
            <linearGradient id="gh-mid2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" class="gh-mid2-top"/>
                <stop offset="1" class="gh-mid2-bottom"/>
            </linearGradient>
            <linearGradient id="gh-near" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" class="gh-near-top"/>
                <stop offset="1" class="gh-near-bottom"/>
            </linearGradient>
            <linearGradient id="gh-mist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" class="gh-mist" stop-opacity="0"/>
                <stop offset="0.55" class="gh-mist" stop-opacity="0.75"/>
                <stop offset="1" class="gh-mist" stop-opacity="0"/>
            </linearGradient>
            <linearGradient id="gh-shade" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" class="gh-shadow" stop-opacity="0.22"/>
                <stop offset="0.5" class="gh-shadow" stop-opacity="0.05"/>
                <stop offset="1" class="gh-shadow" stop-opacity="0.16"/>
            </linearGradient>
        </defs>

        <!-- Distant range, softened by haze -->
        <path class="gh-layer gh-layer--far" fill="url(#gh-far)"
            d="M0 168 C 70 150, 120 128, 190 132 C 250 136, 290 158, 350 150 C 420 140, 460 104, 540 108 C 610 112, 650 148, 720 146 C 790 144, 830 118, 900 112 C 980 106, 1030 140, 1100 142 C 1170 144, 1210 116, 1280 112 C 1350 108, 1400 128, 1440 136 L1440 320 L0 320 Z"/>
        <rect class="gh-layer" x="0" y="118" width="1440" height="90" fill="url(#gh-mist)"/>

        <!-- Middle hills -->
        <path class="gh-layer gh-layer--mid" fill="url(#gh-mid)"
            d="M0 206 C 90 184, 170 170, 260 178 C 350 186, 400 212, 490 206 C 590 198, 640 164, 740 160 C 840 156, 900 190, 990 196 C 1080 202, 1140 178, 1230 170 C 1320 162, 1390 176, 1440 184 L1440 320 L0 320 Z"/>
        <g class="gh-trees gh-trees--mid">
            ${treesHtml([
                [606, 184, 0.85, 'c'], [622, 181, 0.7, 'c'], [690, 166, 0.95, 'o'], [724, 162, 0.8, 'c'], [742, 161, 0.62, 'c'],
                [1170, 179, 0.85, 'o'], [1200, 174, 0.9, 'c'], [1218, 172, 0.7, 'c'],
                [236, 178, 0.8, 'o'], [262, 179, 0.85, 'c']
            ])}
        </g>
        <path class="gh-layer gh-layer--mid2" fill="url(#gh-mid2)"
            d="M0 240 C 110 222, 200 212, 300 220 C 390 228, 450 250, 560 246 C 660 242, 720 222, 820 224 C 930 226, 980 252, 1090 250 C 1190 248, 1260 224, 1350 222 C 1400 221, 1425 226, 1440 229 L1440 320 L0 320 Z"/>

        <!-- Near meadow -->
        <path class="gh-layer gh-layer--near" fill="url(#gh-near)"
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

        <path class="gh-shade" fill="url(#gh-shade)"
            d="M0 272 C 140 256, 260 250, 400 262 C 520 272, 610 292, 740 288 C 880 284, 960 258, 1100 256 C 1230 254, 1330 270, 1440 276 L1440 320 L0 320 Z"/>

    </svg>`;
}

// ---------------------------------------------------------------------------
// Day / night ring
// ---------------------------------------------------------------------------

/** Conic-gradient stops (degrees from midnight) painting night, dawn, day and dusk. */
function bandGradient(sunrise, sunset) {
    const r = dialAngleFromMidnight(sunrise);
    const s = dialAngleFromMidnight(sunset);
    const noon = (r + s) / 2;
    const stops = [
        ['#1e1b4b', 0],
        ['#27235e', r - 26],
        ['#6d28d9', r - 11],
        ['#f472b6', r - 4],
        ['#fb923c', r + 1],
        ['#fcd34d', r + 8],
        ['#7dd3fc', r + 22],
        ['#38bdf8', noon],
        ['#7dd3fc', s - 22],
        ['#fcd34d', s - 8],
        ['#f97316', s - 1],
        ['#e11d48', s + 4],
        ['#7c3aed', s + 11],
        ['#27235e', s + 26],
        ['#1e1b4b', 360]
    ];
    return `conic-gradient(from 180deg, ${stops.map(([c, a]) => `${c} ${f(Math.min(360, Math.max(0, a)))}deg`).join(', ')})`;
}

function sunMarkerHtml(span) {
    // Low sun (near sunrise or sunset) glows orange; high sun is golden white.
    const rays = Array.from({ length: 12 }, (_, i) => {
        const a = i * 30;
        const p0 = pointOnDial(a, 15.5, 0, 0);
        const p1 = pointOnDial(a, i % 2 ? 19.5 : 22, 0, 0);
        return `<line x1="${f(p0.x)}" y1="${f(p0.y)}" x2="${f(p1.x)}" y2="${f(p1.y)}"/>`;
    }).join('');
    return `
        <g class="day-ring__sun">
            <circle r="30" fill="url(#dr-sun-glow)"/>
            <g class="day-ring__rays">${rays}</g>
            <circle r="12.5" fill="url(#dr-sun-disc)"/>
            <circle r="12.5" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="1"/>
        </g>`;
}

function moonMarkerHtml(phase) {
    const lit = moonLitPath(phase, 12);
    return `
        <g class="day-ring__moon">
            <circle r="28" fill="url(#dr-moon-glow)"/>
            <circle r="12" class="day-ring__moon-dark"/>
            ${lit ? `<path d="${lit}" fill="url(#dr-moon-lit)"/>` : ''}
            <g clip-path="url(#dr-moon-clip)" class="day-ring__craters">
                <circle cx="-3.5" cy="-4" r="2.4"/>
                <circle cx="4.2" cy="2.6" r="1.8"/>
                <circle cx="-1.2" cy="5.2" r="1.3"/>
                <circle cx="5" cy="-5" r="1"/>
            </g>
            <circle r="12" fill="none" stroke="rgba(226,232,240,0.55)" stroke-width="0.8"/>
        </g>`;
}

/** Twinkling stars scattered over the night stretch of the band. */
function nightStarsHtml(sunrise, sunset) {
    const setA = dialAngle(sunset);
    let riseA = dialAngle(sunrise);
    if (riseA <= setA) riseA += 360;
    const span = riseA - setA - 40;
    if (span <= 10) return '';
    const radii = [95, 103, 98, 94, 102, 97, 100];
    return radii.map((r, i) => {
        const a = setA + 20 + (span * (i + 0.5)) / radii.length;
        const p = pointOnDial(a, r, C, C);
        return `<circle class="day-ring__star" style="animation-delay:${f(i * 0.55)}s" cx="${f(p.x)}" cy="${f(p.y)}" r="${i % 3 === 0 ? 1.4 : 0.95}"/>`;
    }).join('');
}

function ticksHtml() {
    return Array.from({ length: 24 }, (_, h) => {
        const a = ((h / 24) * 360 + 180) % 360;
        const major = h % 6 === 0;
        const p0 = pointOnDial(a, major ? TICK_IN - 1.5 : TICK_IN, C, C);
        const p1 = pointOnDial(a, TICK_OUT + (major ? 1.5 : 0), C, C);
        return `<line class="day-ring__tick${major ? ' is-major' : ''}" x1="${f(p0.x)}" y1="${f(p0.y)}" x2="${f(p1.x)}" y2="${f(p1.y)}"/>`;
    }).join('');
}

/** Small sunrise / sunset notches just outside the band. */
function horizonMarksHtml(sunrise, sunset) {
    return [[sunrise, 'rise'], [sunset, 'set']].map(([t, kind]) => {
        const a = dialAngle(t);
        const p = pointOnDial(a, BAND_R, C, C);
        return `<circle class="day-ring__horizon day-ring__horizon--${kind}" cx="${f(p.x)}" cy="${f(p.y)}" r="2.6"/>`;
    }).join('');
}

function ringState(now, sunrise, sunset) {
    const span = currentLightSpan(now, sunrise, sunset);
    const nowA = dialAngle(now);
    let startA = dialAngle(span.start);
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

/** The whole emblem: 24-hour ring with the sun or moon, around the class logo. */
export function getDayRingEmblemHtml(logo, { now = Date.now(), sunrise, sunset, intro = true } = {}) {
    if (sunrise == null || sunset == null) ({ sunrise, sunset } = getSolarTimes());
    const st = ringState(now, sunrise, sunset);
    const markerTop = pointOnDial(0, MARKER_R, C, C);
    const trail = trailPath(st);
    const label = ringLabel(now, sunrise, sunset, st);
    const kind = st.span.isDay ? 'day' : 'night';
    // Low sun (near sunrise or sunset) glows orange; high sun is golden white.
    const lowSun = st.span.isDay && Math.sin(st.span.progress * Math.PI) < 0.35;
    return `
    <div class="greeting-emblem day-ring day-ring--${kind}${lowSun ? ' is-low-sun' : ''}${intro ? ' is-intro' : ''}" data-day-ring
        data-sunrise="${sunrise}" data-sunset="${sunset}" data-kind="${kind}"
        role="img" aria-label="${label}" title="${label}"
        style="--dr-from:${f(st.startA)}deg; --dr-to:${f(st.toA)}deg; --dr-band:${bandGradient(sunrise, sunset)};">
        <span class="day-ring__band"></span>
        <svg class="day-ring__svg" viewBox="0 0 240 240" aria-hidden="true" focusable="false">
            <defs>
                <radialGradient id="dr-sun-glow">
                    <stop offset="0" stop-color="#fde68a" stop-opacity="0.95"/>
                    <stop offset="0.45" class="dr-sun-glow-mid" stop-opacity="0.45"/>
                    <stop offset="1" class="dr-sun-glow-mid" stop-opacity="0"/>
                </radialGradient>
                <radialGradient id="dr-sun-disc" cx="0.38" cy="0.35" r="0.7">
                    <stop offset="0" stop-color="#fffbeb"/>
                    <stop offset="0.45" class="dr-sun-core"/>
                    <stop offset="1" class="dr-sun-rim"/>
                </radialGradient>
                <radialGradient id="dr-moon-glow">
                    <stop offset="0" stop-color="#e0e7ff" stop-opacity="0.75"/>
                    <stop offset="0.5" stop-color="#a5b4fc" stop-opacity="0.3"/>
                    <stop offset="1" stop-color="#818cf8" stop-opacity="0"/>
                </radialGradient>
                <radialGradient id="dr-moon-lit" cx="0.4" cy="0.35" r="0.75">
                    <stop offset="0" stop-color="#ffffff"/>
                    <stop offset="1" stop-color="#cbd5e1"/>
                </radialGradient>
                <clipPath id="dr-moon-clip"><path d="${moonLitPath(st.phase, 12) || 'M0 0'}"/></clipPath>
            </defs>
            <circle class="day-ring__rim" cx="${C}" cy="${C}" r="${BAND_R + 7.5}"/>
            <circle class="day-ring__rim" cx="${C}" cy="${C}" r="${BAND_R - 7.5}"/>
            ${ticksHtml()}
            ${nightStarsHtml(sunrise, sunset)}
            ${horizonMarksHtml(sunrise, sunset)}
            <path class="day-ring__trail" data-day-ring-trail d="${trail}" pathLength="1"/>
            <g class="day-ring__carrier" data-day-ring-carrier>
                <g transform="translate(${f(markerTop.x)} ${f(markerTop.y)})">
                    <g class="day-ring__upright" data-day-ring-upright>
                        ${st.span.isDay ? sunMarkerHtml(st.span) : moonMarkerHtml(st.phase)}
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
        const { sunrise, sunset } = getSolarTimes();
        const now = Date.now();
        const st = ringState(now, sunrise, sunset);
        const kind = st.span.isDay ? 'day' : 'night';
        const solarChanged = String(sunrise) !== ring.dataset.sunrise || String(sunset) !== ring.dataset.sunset;
        if (solarChanged || kind !== ring.dataset.kind) {
            // Sunrise, sunset, or fresh solar times: rebuild quietly (no intro sweep).
            const logo = ring.querySelector('.greeting-emblem__face')?.innerHTML || '';
            const holder = document.createElement('div');
            holder.innerHTML = getDayRingEmblemHtml(logo, { now, sunrise, sunset, intro: false });
            const fresh = holder.firstElementChild;
            if (fresh) ring.replaceWith(fresh);
            return;
        }
        ring.classList.remove('is-intro');
        ring.style.setProperty('--dr-from', `${f(st.startA)}deg`);
        ring.style.setProperty('--dr-to', `${f(st.toA)}deg`);
        ring.querySelector('[data-day-ring-trail]')?.setAttribute('d', trailPath(st));
        const label = ringLabel(now, sunrise, sunset, st);
        ring.setAttribute('aria-label', label);
        ring.setAttribute('title', label);
    };
    ringInterval = setInterval(tick, 30000);
    // Solar times usually land a moment after first paint.
    setTimeout(tick, 4000);
}
