// templates/loadingPhone.js
//
// The loading screen on phones and small tablets (below 1024px, the phone
// shell's breakpoint). The desktop film (templates/loading.js) is a whole sky
// with hills, a castle, clouds, weather and Lumi's long flight; a phone gets
// a light scene of its own that still feels like the Quest:
//
//   one painted sky   a gradient for who is signing in and the time of day,
//                     with a small horizon drawn as one SVG (the Quest hills
//                     for teachers, a little town for families, the school
//                     for the School Office)
//   Lumi              floats in her halo, wearing a small badge for the role
//   words             a line for the role, then the Welcome: the school on a
//                     ribbon and the person under it
//   progress          three steps that fill as the app really gets ready,
//                     with a line saying what is happening
//   a tip             from the deck that fits the role (families read theirs
//                     in English or Greek, as their portal does)
//
// Before the account has loaded, the role is the one this device last signed
// in with (or the door a QR link opened), so a parent never sees a teacher's
// screen. Only transform and opacity move; no filters, blurs or shadows are
// animated. Weak Androids and data savers get the scene without its idle
// motion, reduced motion gets it still. styles/loading-phone.css paints it.

import { resolveSkyScene } from '../features/skyWeather.mjs';
import { loadingSkyPlan } from '../features/skyMemory.mjs';
import { LOADING_TIPS, FAMILY_LOADING_TIPS, OFFICE_LOADING_TIPS, createTipDeck } from './loadingTips.mjs';

export const PHONE_LOADING_QUERY = '(max-width: 1023px)';

const ROLES = ['teacher', 'parent', 'secretary'];
const LAST_ROLE_KEY = 'gcq.lastAuthRole'; // ui/authScreen.js remembers it
const FAMILY_LANG_KEY = 'gcq_family_lang_v1'; // features/parent/i18n.js
const DEEP_LINK_ROLES = {
    parent: 'parent', parents: 'parent', family: 'parent', families: 'parent',
    teacher: 'teacher', teachers: 'teacher',
    secretary: 'secretary', office: 'secretary', admin: 'secretary',
};
const DAY_KEY = 'gcq-loading-phone-day';

// ── Timing (ms) ──────────────────────────────────────────────────────
// first: the first load of the day on this device; again: later loads.
//   arrive     the scene has settled; the earliest the Welcome can show
//   signedOut  the earliest exit with no Welcome (the sign-in screen next)
//   welcome    how long the Welcome stays before the scene steps aside
const TIMES = {
    first: { arrive: 650, signedOut: 1100, welcome: 1700 },
    again: { arrive: 450, signedOut: 700, welcome: 1200 },
};
const STILL_WELCOME_MS = 2200;
const EXIT_REVEAL_MS = 120;  // the scene starts fading as Lumi lifts off
const EXIT_GONE_MS = 600;
const STILL_GONE_MS = 650;   // reduced motion: one plain fade (styles/loading.css)
const FONT_WAIT_MS = 700;
const TIP_ROTATE_MS = 6500;
const TIP_FADE_MS = 360;
const SWAP_MS = 180;
const SCHOOL_READ_MS = 1000; // a school name that arrives with the app gets a moment

let _role = '';
let _lang = 'en';
let _times = TIMES.first;
let _shownAt = 0;
let _welcomeAt = 0;
let _step = 0;
let _staged = null;
let _revealAt = 0;
let _timers = [];
let _tipTimer = 0;
let _deck = null;
let _deckRole = null;

const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function storage() {
    try { return window.localStorage; } catch { return null; }
}

function read(key) {
    try { return storage()?.getItem(key) || ''; } catch { return ''; }
}

function reducedMotion() {
    try { return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

function isPreview() {
    return Boolean(document.body?.classList.contains('pv-loading'));
}

function previewParam(name) {
    try { return isPreview() ? new URLSearchParams(location.search).get(name) : null; } catch { return null; }
}

export function wantsPhoneLoading() {
    try { return Boolean(window.matchMedia?.(PHONE_LOADING_QUERY).matches); } catch { return false; }
}

export function isPhoneLoading() {
    return Boolean(document.getElementById('loading-screen')?.classList.contains('gcq-loading-phone'));
}

// ── Who, when, and how much motion ──────────────────────────────────

/** The role this device last signed in with, or the door a link opened. */
function guessRole() {
    try {
        const door = new URLSearchParams(location.search).get('login');
        if (door && DEEP_LINK_ROLES[door.toLowerCase()]) return DEEP_LINK_ROLES[door.toLowerCase()];
    } catch { /* no URL to read */ }
    const remembered = read(LAST_ROLE_KEY);
    return ROLES.includes(remembered) ? remembered : '';
}

/** guessRole, or in the dev preview (loading-preview.html) ?guess= or ?role=. */
function startingRole() {
    const forced = previewParam('guess') ?? previewParam('role');
    if (forced !== null) return ROLES.includes(forced) ? forced : '';
    return guessRole();
}

/** Families read the portal in English or Greek; the loading screen follows. */
function familyLang() {
    const saved = previewParam('lang') || read(FAMILY_LANG_KEY);
    if (saved === 'el' || saved === 'en') return saved;
    try {
        const prefs = [...(navigator.languages || []), navigator.language].filter(Boolean);
        return prefs.some((code) => /^el\b/i.test(code)) ? 'el' : 'en';
    } catch {
        return 'en';
    }
}

/** day, golden (dawn and the last light) or night, from the real sky. */
function skyMood() {
    const forced = previewParam('sky');
    let light = forced;
    if (!light) {
        try {
            const now = Date.now();
            const plan = loadingSkyPlan(now);
            light = resolveSkyScene(plan.weather || {}, { now, ...plan.sun }, { lite: true }).light;
        } catch {
            const h = new Date().getHours();
            light = h < 6 || h >= 20 ? 'night' : (h < 8 || h >= 18 ? 'golden' : 'day');
        }
    }
    if (light === 'night' || light === 'twilight') return 'night';
    return light === 'day' ? 'day' : 'golden';
}

function dayPartNow() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
}

/**
 * still: reduced motion. lite: weak Androids and data savers, the scene
 * without its idle motion. rich: everything else (iPhones included).
 */
function motionTier() {
    if (reducedMotion()) return 'still';
    if (previewParam('low') === '1') return 'lite';
    try {
        const nav = navigator;
        if (nav.connection?.saveData) return 'lite';
        const ua = nav.userAgent || '';
        const apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
        if (apple) return 'rich';
        const memory = Number(nav.deviceMemory) || 0;
        const cores = Number(nav.hardwareConcurrency) || 0;
        if ((memory && memory <= 3) || (cores && cores <= 4)) return 'lite';
    } catch { /* unknown hardware: the full scene */ }
    return 'rich';
}

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// ── Words ────────────────────────────────────────────────────────────

const TEACHER_LINES = {
    morning: 'A bright new day of quests',
    afternoon: 'Your adventure continues',
    evening: 'The evening quest awaits',
    night: 'The stars are out for you',
};

// Each role: the line while loading, the line for the Welcome, the small line
// under it, and what each progress step is doing (the last one: all ready).
const COPY = {
    teacher: {
        title: (part) => TEACHER_LINES[part] || TEACHER_LINES.afternoon,
        welcome: (part) => TEACHER_LINES[part] || TEACHER_LINES.afternoon,
        sub: 'Lumi is lighting up your classroom',
        steps: ['Opening the gate…', 'Gathering your classes…', 'Setting out today’s quests…', 'Your quest is ready'],
        eyebrow: 'Welcome to',
    },
    parent: {
        en: {
            title: () => 'Your hero’s story awaits',
            welcome: () => 'Your hero’s story awaits',
            sub: 'Stars, homework and news from school',
            steps: ['Opening the gate…', 'Finding your hero…', 'Gathering this month’s stars…', 'All ready'],
            eyebrow: 'Welcome to',
        },
        el: {
            title: () => 'Η ιστορία του ήρωά σας συνεχίζεται',
            welcome: () => 'Η ιστορία του ήρωά σας συνεχίζεται',
            sub: 'Αστέρια, εργασίες και νέα από το σχολείο',
            steps: ['Ανοίγει η πύλη…', 'Βρίσκουμε τον ήρωά σας…', 'Μαζεύουμε τα αστέρια του μήνα…', 'Όλα έτοιμα'],
            eyebrow: 'Καλώς ήρθατε',
        },
    },
    secretary: {
        title: () => 'Opening the School Office',
        welcome: () => 'Your School Office is ready',
        sub: 'Classes, families and records in one place',
        steps: ['Unlocking the office…', 'Pulling the class folders…', 'Setting out the register…', 'The office is open'],
        eyebrow: 'Welcome to',
    },
    '': {
        title: () => 'Where every lesson becomes an adventure',
        welcome: () => 'Welcome, adventurer',
        sub: '',
        steps: ['Opening the gate…', 'Opening the gate…', 'Getting everything ready…', 'Ready'],
        eyebrow: 'Welcome to',
    },
};

function copyFor(role = _role, lang = _lang) {
    const c = COPY[role] || COPY[''];
    return c.en ? (c[lang] || c.en) : c;
}

function tipsFor(role, lang) {
    if (role === 'parent') return { key: `gcq-loading-tip-deck-family-${lang}`, tips: FAMILY_LOADING_TIPS.map((pair) => (lang === 'el' ? pair[1] : pair[0])) };
    if (role === 'secretary') return { key: 'gcq-loading-tip-deck-office', tips: OFFICE_LOADING_TIPS };
    return { key: 'gcq-loading-tip-deck', tips: LOADING_TIPS };
}

// ── Drawing ──────────────────────────────────────────────────────────

const LUMI_STAR_PATH = 'M45.4 8.7Q50 0 54.6 8.7L60.7 20.3Q65.3 29 75 30.6L87.9 32.9Q97.6 34.5 90.7 41.6L81.6 51Q74.7 58 76.1 67.8L78 80.7Q79.4 90.5 70.6 86.1L58.8 80.3Q50 76 41.2 80.3L29.4 86.1Q20.6 90.5 22 80.7L23.9 67.8Q25.3 58 18.4 51L9.3 41.6Q2.4 34.5 12.1 32.9L25 30.6Q34.7 29 39.3 20.3Z';
const EYE = '<ellipse rx="4.4" ry="5.8" fill="#2b2250"/><circle cx="1.5" cy="-2.2" r="1.7" fill="#fff"/>';

const LUMI = `
    <svg class="pls-lumi__svg" viewBox="0 0 100 100" focusable="false" aria-hidden="true">
        <defs>
            <radialGradient id="pls-lumi-body" cx="0.42" cy="0.36" r="0.7">
                <stop offset="0" stop-color="#fff8d6"/><stop offset="0.45" stop-color="#ffd54a"/><stop offset="1" stop-color="#f5a623"/>
            </radialGradient>
        </defs>
        <path d="${LUMI_STAR_PATH}" fill="url(#pls-lumi-body)" stroke="#f2a516" stroke-width="1.4" stroke-linejoin="round"/>
        <ellipse cx="38" cy="30" rx="11" ry="6" fill="#fff" opacity="0.55" transform="rotate(-32 38 30)"/>
        <ellipse cx="36.5" cy="62" rx="5.2" ry="3.2" fill="#ff8fa3" opacity="0.6"/>
        <ellipse cx="63.5" cy="62" rx="5.2" ry="3.2" fill="#ff8fa3" opacity="0.6"/>
        <g transform="translate(42 54)">${EYE}</g>
        <g transform="translate(58 54)">${EYE}</g>
        <path class="pls-lumi__smile" d="M45.5 62.5Q50 66.5 54.5 62.5" stroke="#8a3a2a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        <path class="pls-lumi__cheer" d="M45 62Q50 63.2 55 62Q54 68 50 68.9Q46 68 45 62Z" fill="#7a2e2e"/>
    </svg>`;

// The small badge Lumi wears: a book, a heart, a key.
const BADGES = {
    teacher: '<path d="M4 6.5C6.6 5.4 9.3 5.4 12 7c2.7-1.6 5.4-1.6 8-.5v11c-2.6-1.1-5.3-1.1-8 .5-2.7-1.6-5.4-1.6-8-.5z" fill="currentColor" opacity="0.25"/><path d="M4 6.5C6.6 5.4 9.3 5.4 12 7c2.7-1.6 5.4-1.6 8-.5v11c-2.6-1.1-5.3-1.1-8 .5-2.7-1.6-5.4-1.6-8-.5zM12 7v11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    parent: '<path d="M12 19.5s-7-4.3-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.1c0 5.1-7 9.4-7 9.4z" fill="currentColor"/>',
    secretary: '<circle cx="8.5" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 12h8m-3 0v3m-3-3v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

// One horizon per role, one SVG each (viewBox 400 × 140, bottom aligned).
const LANDS = {
    // The Quest hills with the castle on the far hill and three pines.
    teacher: `
        <path class="pls-g1" d="M0 66C60 50 122 44 190 56C258 68 322 42 400 48V140H0Z"/>
        <g transform="translate(293 54) scale(1.55) translate(-293 -50)">
            <path class="pls-g1" d="M282 50V34h5v-4h4v4h4v-4h4v4h5v16zM292 30V18l4-6 4 6v12z"/>
            <path class="pls-accent" d="M296 12V4l7 2.5-7 2.5"/>
            <rect class="pls-win" x="294" y="22" width="4" height="6" rx="2"/>
            <rect class="pls-win" x="287" y="40" width="3" height="5" rx="1.5"/>
            <rect class="pls-win" x="302" y="40" width="3" height="5" rx="1.5"/>
        </g>
        <path class="pls-g2" d="M0 98C78 78 150 72 222 86C292 100 344 82 400 84V140H0Z"/>
        <path class="pls-g3" d="M46 92l9-26 9 26zM62 94l7-19 7 19zM352 88l8-24 8 24z"/>
        <path class="pls-g3" d="M0 122C96 108 196 110 280 118C330 123 370 118 400 116V140H0Z"/>`,
    // A little town of three houses, one with a chimney, and a round tree.
    parent: `
        <path class="pls-g1" d="M0 74C70 58 140 56 210 66C280 76 340 60 400 62V140H0Z"/>
        <circle class="pls-g3" cx="318" cy="58" r="16"/><rect class="pls-g3" x="316" y="70" width="4" height="16"/>
        <path class="pls-wall" d="M118 70h38v28h-38zM166 60h46v38h-46zM222 72h34v26h-34z"/>
        <path class="pls-roof" d="M113 72l24-20 24 20zM160 62l29-25 29 25zM218 74l21-17 21 17z"/>
        <rect class="pls-roof" x="198" y="40" width="7" height="14"/>
        <rect class="pls-win" x="124" y="78" width="9" height="9" rx="1.5"/>
        <rect class="pls-win" x="174" y="68" width="10" height="10" rx="1.5"/>
        <rect class="pls-win" x="194" y="68" width="10" height="10" rx="1.5"/>
        <rect class="pls-door" x="184" y="82" width="10" height="16" rx="5"/>
        <rect class="pls-win" x="234" y="80" width="10" height="9" rx="1.5"/>
        <path class="pls-g2" d="M0 100C90 86 170 88 250 96C320 103 362 94 400 92V140H0Z"/>
        <path class="pls-g3" d="M0 124C100 112 200 114 290 120C340 124 376 120 400 118V140H0Z"/>`,
    // The school: a pediment with a clock, a row of windows, a flag.
    secretary: `
        <path class="pls-g1" d="M0 78C70 66 150 64 220 72C290 80 350 68 400 70V140H0Z"/>
        <path class="pls-wall" d="M130 64h140v36H130zM108 76h22v24h-22zM270 76h22v24h-22z"/>
        <path class="pls-roof" d="M124 66l76-30 76 30z"/>
        <circle class="pls-wall" cx="200" cy="54" r="8"/>
        <path class="pls-door" d="M200 49v5l3 2" fill="none" stroke-width="1.6" stroke-linecap="round"/>
        <rect class="pls-g3" x="198" y="14" width="2" height="22"/>
        <path class="pls-accent" d="M200 14h14l-3 4 3 4h-14z"/>
        <rect class="pls-win" x="140" y="72" width="10" height="12" rx="1.5"/>
        <rect class="pls-win" x="160" y="72" width="10" height="12" rx="1.5"/>
        <rect class="pls-win" x="230" y="72" width="10" height="12" rx="1.5"/>
        <rect class="pls-win" x="250" y="72" width="10" height="12" rx="1.5"/>
        <rect class="pls-win" x="114" y="82" width="10" height="10" rx="1.5"/>
        <rect class="pls-win" x="276" y="82" width="10" height="10" rx="1.5"/>
        <path class="pls-door" d="M190 100V82a10 10 0 0 1 20 0v18z"/>
        <path class="pls-g2" d="M0 102C90 92 170 96 250 100C320 104 362 98 400 96V140H0Z"/>
        <path class="pls-g3" d="M0 124C100 114 200 116 290 121C340 124 376 121 400 119V140H0Z"/>`,
};

function starsSvg() {
    // A handful of stars, painted once; the two halves twinkle by fading.
    const spots = [[8, 12, 1.3], [22, 26, 0.9], [37, 8, 1.1], [64, 15, 1.4], [79, 6, 0.9], [91, 22, 1.2], [14, 40, 0.8], [86, 38, 0.9], [55, 30, 0.7], [30, 46, 0.7]];
    const dot = ([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r * 0.32}"/>`;
    return `<svg class="pls-stars__a" viewBox="0 0 100 60" preserveAspectRatio="xMidYMin slice" focusable="false">${spots.filter((_, i) => i % 2 === 0).map(dot).join('')}</svg>`
        + `<svg class="pls-stars__b" viewBox="0 0 100 60" preserveAspectRatio="xMidYMin slice" focusable="false">${spots.filter((_, i) => i % 2 === 1).map(dot).join('')}</svg>`;
}

function landSvg(role) {
    return `<svg class="pls-land__svg" viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" focusable="false">${LANDS[role] || LANDS.teacher}</svg>`;
}

function stepsHTML() {
    return [0, 1, 2].map((i) => `<span class="pls-steps__seg" data-seg="${i}"><span class="pls-steps__fill"></span></span>`).join('');
}

/** The phone loading screen, ready for the first paint. */
export function phoneLoadingHTML() {
    _role = startingRole();
    _lang = _role === 'parent' ? familyLang() : 'en';
    const mood = skyMood();
    const tier = motionTier();
    const copy = copyFor();
    const part = dayPartNow();
    return `
    <div id="loading-screen" class="gcq-loading-phone pls-${tier} fixed inset-0 z-[1100]"
        data-pls-role="${_role || 'none'}" data-pls-mood="${mood}" lang="${_lang}" aria-busy="true">
        <div class="pls-sky" aria-hidden="true">
            <span class="pls-glow"></span>
            <span class="pls-stars">${starsSvg()}</span>
        </div>
        <div class="pls-land" aria-hidden="true">${landSvg(_role)}</div>
        <div class="pls-stage">
            <p class="pls-brand">The Great Class Quest</p>
            <div class="pls-emblem" aria-hidden="true">
                <span class="pls-halo"></span>
                <span class="pls-orbit"><i></i><i></i><i></i></span>
                <span class="pls-lumi"><span class="pls-lumi__hop">${LUMI}</span></span>
                <span class="pls-badge">${_role ? `<svg viewBox="0 0 24 24" focusable="false">${BADGES[_role]}</svg>` : ''}</span>
            </div>
            <h1 class="pls-title"><span class="pls-swap">${esc(copy.title(part))}</span></h1>
            <div class="pls-cell">
                <p class="pls-sub">${esc(copy.sub)}</p>
                <div class="pls-welcome" id="loading-greeting">
                    <p class="pls-person" id="loading-greeting-person" hidden></p>
                    <p class="pls-school" id="loading-greeting-school" hidden></p>
                </div>
            </div>
            <div class="pls-progress">
                <div class="pls-steps" aria-hidden="true">${stepsHTML()}</div>
                <p class="pls-status" role="status"><span class="pls-swap">${esc(copy.steps[0])}</span></p>
            </div>
        </div>
        <div class="pls-tip"><p id="loading-tip" class="pls-tip__text"></p></div>
        <div class="pls-daylight" aria-hidden="true"></div>
    </div>`;
}

// ── Running the scene ────────────────────────────────────────────────

function screenEl() {
    return document.getElementById('loading-screen');
}

function later(ms, fn) {
    _timers.push(setTimeout(fn, ms));
}

function clearTimers() {
    _timers.forEach(clearTimeout);
    _timers = [];
}

/** Swap a line's words with a quick fade (no fade with reduced motion). */
function swapText(el, text) {
    if (!el || el.textContent === text) return;
    if (reducedMotion()) { el.textContent = text; return; }
    el.classList.add('is-out');
    setTimeout(() => {
        el.textContent = text;
        el.classList.remove('is-out');
    }, SWAP_MS);
}

function paintSteps() {
    const screen = screenEl();
    if (!screen) return;
    screen.querySelectorAll('.pls-steps__seg').forEach((seg, i) => {
        seg.classList.toggle('is-on', i < _step);
        seg.classList.toggle('is-now', i === _step);
    });
    swapText(screen.querySelector('.pls-status .pls-swap'), copyFor().steps[Math.min(3, _step)]);
}

function revealWordsWhenFontsReady(screen) {
    let done = false;
    const reveal = () => {
        if (done) return;
        done = true;
        requestAnimationFrame(() => screen.classList.add('pls-ready'));
    };
    setTimeout(reveal, FONT_WAIT_MS);
    try {
        const fonts = document.fonts;
        if (!fonts?.load) { reveal(); return; }
        fonts.load('1em "Fredoka One"').then(reveal, reveal);
    } catch {
        reveal();
    }
}

function stopTips() {
    clearTimeout(_tipTimer);
    clearInterval(_tipTimer);
    _tipTimer = 0;
}

function dealTip() {
    const role = _role;
    if (!_deck || _deckRole !== `${role}:${_lang}`) {
        const { key, tips } = tipsFor(role, _lang);
        _deck = createTipDeck({ tips, storage: storage(), storageKey: key });
        _deckRole = `${role}:${_lang}`;
    }
    return _deck.next();
}

function startTips() {
    const tipEl = document.getElementById('loading-tip');
    if (!tipEl) return;
    stopTips();
    tipEl.textContent = dealTip();
    _tipTimer = setInterval(() => {
        tipEl.classList.add('is-out');
        setTimeout(() => {
            tipEl.textContent = dealTip();
            tipEl.classList.remove('is-out');
        }, TIP_FADE_MS);
    }, TIP_ROTATE_MS);
}

/** Called once after the HTML is in the page, before the first paint. */
export function initPhoneLoading() {
    const screen = screenEl();
    if (!screen) return;
    _shownAt = performance.now();
    _times = read(DAY_KEY) === todayKey() ? TIMES.again : TIMES.first;
    revealWordsWhenFontsReady(screen);
    startTips();
}

/** 1: sign-in has answered, 2: the account has loaded, 3: ready. */
export function phoneMarkStage(step) {
    const next = Math.min(3, Math.max(_step, step));
    if (next === _step) return;
    _step = next;
    paintSteps();
}

/** The account has loaded: the scene becomes theirs, and the Welcome shows. */
export function phoneStagePersonalization(name, role) {
    const displayName = String(name || '').trim().replace(/\s+/g, ' ');
    const HONORIFICS = /^(mr|mrs|ms|miss|dr|prof|rev|sir|lord|lady|κ)\.?$/i;
    const first = displayName.split(' ').find((p) => !HONORIFICS.test(p)) || '';
    _staged = { name: displayName, role: ROLES.includes(role) ? role : '', initial: Array.from(first || displayName)[0]?.toUpperCase() || '' };
    applyRole(_staged.role);
    phoneMarkStage(2);
    const wait = Math.max(0, _times.arrive - (performance.now() - _shownAt));
    later(wait, () => showWelcome({}));
}

/** The signed-in role differs from the guess: repaint the scene for it. */
function applyRole(role) {
    const screen = screenEl();
    if (!screen || role === _role) return;
    _role = role;
    _lang = role === 'parent' ? familyLang() : 'en';
    screen.dataset.plsRole = role || 'none';
    screen.setAttribute('lang', _lang);
    const land = screen.querySelector('.pls-land');
    if (land) land.innerHTML = landSvg(role);
    const badge = screen.querySelector('.pls-badge');
    if (badge) badge.innerHTML = role ? `<svg viewBox="0 0 24 24" focusable="false">${BADGES[role]}</svg>` : '';
    const copy = copyFor();
    swapText(screen.querySelector('.pls-title .pls-swap'), copy.title(dayPartNow()));
    const sub = screen.querySelector('.pls-sub');
    if (sub) sub.textContent = copy.sub;
    paintSteps();
}

/** Shows (or fills in) the Welcome. Returns true when the school name is new on screen. */
function showWelcome({ schoolName, dayPart } = {}) {
    const screen = screenEl();
    if (!screen || !_staged) return false;
    const hadSchool = Boolean(_staged.school) && Boolean(_welcomeAt);
    const copy = copyFor();
    if (schoolName !== undefined) _staged.school = String(schoolName || '').trim();
    const school = _staged.school || '';
    const schoolEl = document.getElementById('loading-greeting-school');
    const personEl = document.getElementById('loading-greeting-person');
    if (schoolEl) {
        schoolEl.hidden = !school;
        schoolEl.innerHTML = school ? `<span class="pls-school__eyebrow">${esc(copy.eyebrow)}</span><span class="pls-school__name">${esc(school)}</span>` : '';
    }
    if (personEl) {
        personEl.hidden = !_staged.name;
        personEl.innerHTML = _staged.name ? `<span class="pls-person__crest" aria-hidden="true">${esc(_staged.initial)}</span><span class="pls-person__name">${esc(_staged.name)}</span>` : '';
    }
    if (_welcomeAt) return Boolean(school) && !hadSchool; // already showing: only the school filled in
    _welcomeAt = performance.now();
    swapText(screen.querySelector('.pls-title .pls-swap'), copy.welcome(dayPart || dayPartNow()));
    screen.classList.add('pls-welcomed');
    try { storage()?.setItem(DAY_KEY, todayKey()); } catch { /* full scene again next time */ }
    return false;
}

/** Milliseconds until the scene starts fading (0 once it has). */
export function phoneRevealEta() {
    return _revealAt ? Math.max(0, Math.round(_revealAt - performance.now())) : 0;
}

/**
 * The hand-over: the Welcome (filled in with the school), a moment to read it,
 * then Lumi lifts off as the scene fades. Returns the milliseconds until the
 * fade starts, so the next screen can time its entrance.
 */
export function phoneLoadingExit(screen, { schoolName = '', dayPart = '', onHidden } = {}) {
    if (!screen) return 0;
    if (screen.classList.contains('hidden')) {
        screen.classList.add('opacity-0', 'pointer-events-none');
        _revealAt = 0;
        return 0;
    }
    clearTimers();
    const still = reducedMotion();
    const now = performance.now();
    const since = now - _shownAt;
    let exitIn;
    if (_staged) {
        const showIn = Math.max(0, _times.arrive - since);
        // School names arrive with the app: fill the ribbon in now (or with the Welcome).
        let schoolIsNew = false;
        if (showIn) later(showIn, () => showWelcome({ schoolName, dayPart }));
        else schoolIsNew = showWelcome({ schoolName, dayPart });
        const shownAt = _welcomeAt || now + showIn;
        exitIn = Math.max(showIn, shownAt + (still ? STILL_WELCOME_MS : _times.welcome) - now, schoolIsNew ? SCHOOL_READ_MS : 0);
    } else {
        exitIn = still ? 0 : Math.max(0, _times.signedOut - since);
    }
    const revealIn = exitIn + (still ? 0 : EXIT_REVEAL_MS);
    const goneIn = exitIn + (still ? STILL_GONE_MS : EXIT_GONE_MS);
    _revealAt = now + revealIn;

    later(exitIn, () => {
        _step = 3;
        paintSteps();
        stopTips();
        screen.classList.remove('loading-screen-from-gate');
        screen.classList.add('loading-screen-exit');
    });
    later(revealIn, () => screen.classList.add('loading-revealing'));
    later(goneIn, () => {
        screen.classList.add('opacity-0', 'pointer-events-none', 'hidden');
        screen.setAttribute('aria-busy', 'false');
        _revealAt = 0;
        _staged = null;
        try { onHidden?.(); } catch (error) { console.error(error); }
    });
    return revealIn;
}

/**
 * Back on screen after a sign-in from the visible sign-in screen. fromGate: it
 * appears inside the gate's daylight (ui/authGate.js), which then clears.
 */
export function phoneReopen({ fromGate = false } = {}) {
    const screen = screenEl();
    if (!screen) return;
    clearTimers();
    _revealAt = 0;
    _welcomeAt = 0;
    _staged = null;
    _step = 0;
    _times = read(DAY_KEY) === todayKey() ? TIMES.again : TIMES.first;
    screen.dataset.exiting = '';
    screen.classList.remove('loading-screen-exit', 'loading-revealing', 'pls-welcomed', 'loading-screen-from-gate', 'hidden');
    screen.setAttribute('aria-busy', 'true');
    // The person may have chosen another door at the gate.
    applyRole(startingRole());
    screen.dataset.plsMood = skyMood();
    const copy = copyFor();
    const title = screen.querySelector('.pls-title .pls-swap');
    if (title) title.textContent = copy.title(dayPartNow());
    ['loading-greeting-school', 'loading-greeting-person'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) { el.hidden = true; el.innerHTML = ''; }
    });
    _shownAt = performance.now();
    if (fromGate) {
        screen.classList.add('loading-screen-from-gate');
        later(1600, () => screen.classList.remove('loading-screen-from-gate'));
    }
    phoneMarkStage(1);
    startTips();
    void screen.offsetWidth;
    requestAnimationFrame(() => screen.classList.remove('opacity-0', 'pointer-events-none'));
}
