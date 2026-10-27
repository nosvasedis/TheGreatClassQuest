// The Home greeting (desktop card and phone hero): who it greets, the line under it, and the
// badges below it (school, teacher, how the class's month is going). The words come from
// features/homeGreetingWords.mjs and follow the live sky: when the weather or the hour changes,
// the line and the hello change in place with a short light sweep, and nothing else redraws.
// Every animation moves only transform and opacity, and reduced motion gets plain swaps.

import * as state from '../state.js';
import * as utils from '../utils.js';
import { DEFAULT_SCHOOL_NAME, getQuestLeagueDefinition } from '../constants.js';
import { escapeHtml } from './roles/shared.js';
import { composeHomeGreeting, questNudge } from './homeGreetingWords.mjs';
import { getSkyScene, getLastSkyReading } from './skyWeatherStage.js';

const INTRO_MS = 2600;
const SHIFT_MS = 1500;

function reducedMotion() {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function selectedClass() {
    const id = state.get('globalSelectedClassId');
    return id ? (state.get('allSchoolClasses') || []).find((c) => c.id === id) || null : null;
}

/** The greeting for what is on screen now: the selected class, or the whole school. */
export function currentHomeGreeting(now = new Date()) {
    const cls = selectedClass();
    return composeHomeGreeting({
        mode: cls ? 'class' : 'general',
        className: cls?.name || '',
        young: !!getQuestLeagueDefinition(cls?.questLevel)?.isYoungLearner,
        part: utils.getCurrentDayPart(now.getTime()).part,
        scene: getSkyScene() || {},
        reading: getLastSkyReading() || {},
        now
    });
}

/** Words as pieces for the entrance; `tail` (the comma, the "!") rides on the last word so it never wraps alone. */
function wordsHtml(text, from, tail = '') {
    const words = String(text).split(/\s+/).filter(Boolean);
    return words.map((w, i) => `<span class="gw-word" style="--i:${from + i}">${escapeHtml(w)}${i === words.length - 1 ? tail : ''}</span>`).join(' ');
}

/** The big line: "Good Morning, Owls!" with each word its own piece for the entrance. */
export function greetingTitleInnerHtml(g) {
    const helloWords = String(g.hello).split(/\s+/).filter(Boolean).length;
    return `<span class="gw-hello">${wordsHtml(g.hello, 0, '<span class="gw-punct">,</span>')}</span> `
        + `<span class="gw-name">${wordsHtml(g.name, helloWords, '<span class="gw-punct gw-bang">!</span>')}</span>`;
}

export function greetingLineInnerHtml(g) {
    return `<span class="greeting-line__icon" aria-hidden="true"><i class="fas ${g.icon}"></i></span><span class="greeting-line__text">${escapeHtml(g.line)}</span>`;
}

/** The light sweep that crosses the card on the entrance and when the sky changes. */
export function greetingGlintHtml() {
    return '<span class="greeting-glint" aria-hidden="true"><span class="greeting-glint__band"></span></span>';
}

function teacherInitial(name) {
    const ch = String(name || '').trim().charAt(0);
    return ch ? escapeHtml(ch.toUpperCase()) : '★';
}

/**
 * Badges under the greeting: school and teacher side by side, then the class's month
 * (class view, `nudge` from questNudge) or today's lessons across the school (general view).
 */
export function greetingBadgesHtml({ nudge = null, todayChip = '' } = {}) {
    const school = state.get('schoolName') || DEFAULT_SCHOOL_NAME;
    const teacher = state.get('currentTeacherName') || 'Quest Master';
    const badges = [
        `<span class="greeting-chip greeting-chip--school" style="--ci:0"><i class="fas fa-university" aria-hidden="true"></i><span data-school-name>${escapeHtml(school)}</span></span>`,
        `<span class="greeting-chip greeting-chip--teacher" style="--ci:1" title="Teacher"><span class="greeting-chip__crest" aria-hidden="true">${teacherInitial(teacher)}</span><span class="greeting-chip__name">${escapeHtml(teacher)}</span></span>`
    ];
    if (nudge) {
        badges.push(`<span class="greeting-chip greeting-chip--quest greeting-chip--quest-${nudge.tone}" style="--ci:2"><i class="fas ${nudge.icon}" aria-hidden="true"></i>${escapeHtml(nudge.text)}</span>`);
    } else if (todayChip) {
        badges.push(todayChip);
    }
    return badges.join('');
}

/** The class view's month badge, from the same stars and goal the Quest card shows. */
export function classNudge(monthStars, goal) {
    return questNudge({ monthStars, goal, now: new Date() });
}

/** Classes the greeting adds for a while: a Home morph never strips them. */
export const GREETING_SCRIPT_CLASSES = ['is-greeting-await', 'is-greeting-intro', 'is-sky-shift', 'is-shifting'];

/** For a Home morph: a greeting title or line already showing the same words is left alone. */
export function keepGreetingPart(from, to) {
    if (!(from.hasAttribute('data-greeting-title') || from.hasAttribute('data-greeting-line'))) return false;
    return from.dataset.text === to.dataset.text;
}

// ─── Entrance ──────────────────────────────────────────────────────────────

function loadingScreenShowing() {
    const el = document.getElementById('loading-screen');
    return !!el && !el.classList.contains('hidden') && el.dataset.exiting !== 'true';
}

/**
 * Plays the greeting's entrance on a freshly drawn card. On app start it waits for the
 * loading screen to step aside, so the class sees the words arrive.
 */
export function playGreetingIntro(panel) {
    if (!panel || reducedMotion()) return;
    panel.classList.add('is-greeting-await');
    const start = () => {
        if (!panel.isConnected) return;
        panel.classList.remove('is-greeting-await');
        panel.classList.add('is-greeting-intro');
        setTimeout(() => panel.classList.remove('is-greeting-intro'), INTRO_MS);
    };
    if (!loadingScreenShowing()) {
        requestAnimationFrame(start);
        return;
    }
    const screen = document.getElementById('loading-screen');
    const observer = new MutationObserver(() => {
        if (screen.dataset.exiting === 'true' || screen.classList.contains('hidden')) {
            observer.disconnect();
            setTimeout(start, 380);
        }
    });
    observer.observe(screen, { attributes: true, attributeFilter: ['class', 'data-exiting'] });
    setTimeout(() => { observer.disconnect(); if (panel.classList.contains('is-greeting-await')) start(); }, 9000);
}

// ─── Following the sky ─────────────────────────────────────────────────────

function swapLine(lineEl, g, animate) {
    lineEl.dataset.text = g.line;
    if (!animate) {
        lineEl.innerHTML = greetingLineInnerHtml(g);
        return;
    }
    lineEl.querySelectorAll('.greeting-line__swap').forEach((n) => n.remove());
    const old = document.createElement('span');
    old.className = 'greeting-line__swap greeting-line__swap--out';
    old.setAttribute('aria-hidden', 'true');
    old.innerHTML = lineEl.innerHTML;
    lineEl.innerHTML = greetingLineInnerHtml(g);
    lineEl.classList.remove('is-shifting');
    void lineEl.offsetWidth;
    lineEl.classList.add('is-shifting');
    lineEl.appendChild(old);
    setTimeout(() => { old.remove(); lineEl.classList.remove('is-shifting'); }, SHIFT_MS);
}

/** Brings every greeting on screen up to date; animates only what really changed. */
export function refreshGreetingsInPlace({ animate = true } = {}) {
    const panels = document.querySelectorAll('.greeting-panel[data-greeting-key]');
    if (!panels.length) return;
    const g = currentHomeGreeting();
    const motion = animate && !reducedMotion();
    panels.forEach((panel) => {
        if (panel.dataset.greetingKey === g.key) return;
        const title = panel.querySelector('[data-greeting-title]');
        const line = panel.querySelector('[data-greeting-line]');
        const titleChanged = title && title.dataset.text !== `${g.hello}|${g.name}`;
        panel.dataset.greetingKey = g.key;
        if (title && titleChanged) {
            title.innerHTML = greetingTitleInnerHtml(g);
            title.dataset.text = `${g.hello}|${g.name}`;
            if (motion) {
                title.classList.remove('is-shifting');
                void title.offsetWidth;
                title.classList.add('is-shifting');
                setTimeout(() => title.classList.remove('is-shifting'), SHIFT_MS);
            }
        }
        if (line) swapLine(line, g, motion);
        if (motion) {
            panel.classList.remove('is-sky-shift');
            void panel.offsetWidth;
            panel.classList.add('is-sky-shift');
            setTimeout(() => panel.classList.remove('is-sky-shift'), SHIFT_MS);
        }
    });
}

let following = false;
/** Once per session: the greeting follows the live sky (weather melts, the hour turning). */
export function followSkyWithGreeting() {
    if (following || typeof window === 'undefined') return;
    following = true;
    window.addEventListener('gcq:sky-scene', () => refreshGreetingsInPlace());
}
