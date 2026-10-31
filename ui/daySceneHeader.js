// /ui/daySceneHeader.js
// The look of a special day (utils/schoolCalendar.mjs) inside the Planner and the Quest Log:
// the header takes the day's colours, a big faded icon and a few drifting little shapes, the
// title gets a name badge, and the body opens with a themed day card.

import { escapeHtml as esc } from '../utils/html.mjs';
import { describeSchoolDay } from '../utils/schoolCalendar.mjs';
import { parseDDMMYYYY } from '../utils.js';
import '../styles/day_scene.css';

// [light, lighter, ink] for days that don't carry their own colours.
const THEME_COLORS = {
    national: ['#eff6ff', '#dbeafe', '#1e3a8a'],
    remembrance: ['#f8fafc', '#e2e8f0', '#334155'],
    winter: ['#f0f9ff', '#fee2e2', '#991b1b'],
    spring: ['#f0fdf4', '#fdf2f8', '#166534'],
    kites: ['#e0f2fe', '#f0fdfa', '#0e7490'],
    flowers: ['#fdf2f8', '#fef9c3', '#9d174d'],
    dove: ['#f0f9ff', '#cffafe', '#155e75'],
    summer: ['#fffbeb', '#cffafe', '#92400e'],
    local: ['#fffbeb', '#fef3c7', '#92400e'],
    break: ['#f0fdfa', '#ccfbf1', '#115e59'],
    letters: ['#faf5ff', '#ede9fe', '#5b21b6'],
    observance: ['#faf5ff', '#ede9fe', '#5b21b6'],
};

// The little shapes that drift across the header, by the day's art or theme.
const PARTICLES = {
    bats: ['🦇', '🎃', '🦇', '✨', '🦇'],
    hearts: ['💗', '💌', '💕', '✨', '💗'],
    clovers: ['☘️', '🍀', '✨', '☘️'],
    leaves: ['🍂', '🍁', '🍃', '🍂'],
    sparks: ['✨', '⭐', '✨', '💫'],
    confetti: ['🎉', '✨', '🎊', '⭐'],
    winter: ['❄️', '✨', '❄️', '⭐', '❄️'],
    spring: ['🌸', '🌷', '🦋', '🌸', '🥚'],
    national: ['⭐', '🕊️', '✨', '⭐'],
    remembrance: ['🕯️', '🕊️', '✨'],
    kites: ['🪁', '☁️', '🪁', '✨'],
    flowers: ['🌸', '🌼', '🌺', '🌸'],
    dove: ['🕊️', '🌊', '✨'],
    summer: ['☀️', '🌊', '🐚', '✨'],
    local: ['🔔', '✨', '🔔'],
    break: ['✨', '☁️', '✨'],
};

// Fixed spots so the scene is calm and the same every time: [left %, top %, delay s, size rem].
const SPOTS = [[46, 62, 0, 1.1], [58, 18, 1.3, 0.9], [66, 70, 2.4, 1.25], [74, 30, 0.7, 1], [84, 64, 1.9, 0.85], [92, 20, 3.1, 1.05], [52, 38, 3.8, 0.8]];

/** The special day on a DD-MM-YYYY date, or null. */
export function specialDayFor(dateString) {
    const day = parseDDMMYYYY(dateString);
    if (!day) return null;
    const info = describeSchoolDay(day);
    return info.headline ? { ...info.headline, closed: Boolean(info.closure) } : null;
}

/** Colours and shapes for a special day. */
export function dayLook(special) {
    const [a, b, ink] = Array.isArray(special?.colors) ? special.colors : (THEME_COLORS[special?.theme] || THEME_COLORS.break);
    const particles = PARTICLES[special?.art] || PARTICLES[special?.theme] || PARTICLES.sparks;
    return { a, b, ink, particles };
}

function styleVars(look) {
    return `--day-a:${look.a};--day-b:${look.b};--day-ink:${look.ink}`;
}

function particlesHtml(look, spots = SPOTS) {
    return spots.map(([x, y, d, size], i) => `<span class="qc-scene__bit" style="--x:${x}%;--y:${y}%;--d:${d}s;--s:${size}rem">${esc(look.particles[i % look.particles.length])}</span>`).join('');
}

/**
 * Theme a Planner / Quest Log header (.qc-mhead) for the date, or put it back to normal.
 * Returns the special day (or null).
 */
export function paintDayScene(header, dateString) {
    if (!header) return null;
    const special = specialDayFor(dateString);
    header.querySelector('.qc-scene')?.remove();
    header.querySelector('.qc-dayname')?.remove();
    header.classList.toggle('qc-mhead--day', Boolean(special));
    if (!special) {
        header.removeAttribute('style');
        return null;
    }
    const look = dayLook(special);
    header.setAttribute('style', styleVars(look));
    header.insertAdjacentHTML('afterbegin', `
        <span class="qc-scene" aria-hidden="true">
            <span class="qc-scene__glow"></span>
            ${particlesHtml(look)}
            <span class="qc-scene__icon">${esc(special.icon)}</span>
        </span>`);
    const when = header.querySelector('.qc-when');
    const label = special.also ? `${special.name} & ${special.also.name}` : special.name;
    when?.insertAdjacentHTML('afterend', `
        <span class="qc-dayname" title="${esc(special.blurb || label)}">
            <span class="qc-dayname__icon" aria-hidden="true">${esc(special.icon)}${special.also ? esc(special.also.icon) : ''}</span>
            <span>${esc(label)}</span>
            ${special.closed ? '<span class="qc-dayname__tag">No lessons</span>' : ''}
        </span>`);
    return special;
}

/**
 * The themed card that opens the Planner glance and the Quest Log for a special day.
 * `tip` is an extra line (what the teacher can do), `compact` drops the drifting shapes.
 */
export function dayCardHtml(special, { eyebrow = '', tip = '', compact = false } = {}) {
    if (!special) return '';
    const look = dayLook(special);
    const greek = [special.nameEl !== special.name && special.nameEl, special.also?.nameEl].filter(Boolean).join(' · ');
    const title = special.also ? `${special.name} & ${special.also.name}` : special.name;
    const eyebrowText = eyebrow || (special.closed
        ? (special.closureName && special.closureName !== special.name ? special.closureName : 'No lessons today')
        : 'Lessons as normal');
    return `
        <div class="qc-daycard${compact ? ' qc-daycard--compact' : ''}${special.closed ? ' qc-daycard--closed' : ''}" style="${styleVars(look)}">
            ${compact ? '' : `<span class="qc-daycard__bits" aria-hidden="true">${particlesHtml(look, [[78, 8, 0, 0.85], [88, 18, 1.4, 1], [95, 6, 2.6, 0.8], [70, 16, 3.4, 0.75]])}</span>`}
            <span class="qc-daycard__medal" aria-hidden="true"><span>${esc(special.icon)}</span>${special.also ? `<i>${esc(special.also.icon)}</i>` : ''}</span>
            <span class="qc-daycard__text">
                <small class="qc-daycard__eyebrow">${esc(eyebrowText)}</small>
                <strong class="font-title">${esc(title)}</strong>
                ${greek ? `<span class="qc-daycard__greek" lang="el">${esc(greek)}</span>` : ''}
                ${special.blurb ? `<span class="qc-daycard__blurb">${esc(special.blurb)}</span>` : ''}
                ${special.also?.blurb ? `<span class="qc-daycard__blurb">${esc(special.also.icon)} ${esc(special.also.blurb)}</span>` : ''}
                ${tip ? `<span class="qc-daycard__tip">${esc(tip)}</span>` : ''}
            </span>
        </div>`;
}
