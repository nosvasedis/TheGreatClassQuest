import { detectLowPowerTier as sharedLowPowerTier } from '../utils/devicePerformance.mjs';
import { paintLoadingSky } from './loadingSky.js';
import { createTipDeck } from './loadingTips.mjs';
// templates/loading.js
//
// The loading screen is a short film starring Lumi, the app's guiding star.
// The house lights dim into a twilight sky over the Quest hills, and then:
//
//   arrive    The Great Class Quest logo drifts down from the sky and lands.
//   title     A spark writes "The Great Class Quest" in starlight under it
//             and a gold sparkle between two lines pops: logo and title
//             together, for a moment.
//   wake      A ring of light gathers into the logo's star and Lumi wakes
//             out of it (a breath, a spring to full size, eyes open, a ring
//             of light and a shower of sparkles) as the logo fades away
//             (styles/loading2.css).
//   wait      Lumi floats and plays (a twirl, a peek, a happy bounce, a
//             shower of sparkles). Each real step of the start-up lights a
//             star in the constellation: she casts a spark to it.
//   welcome   A big starlit line for the moment, the school on a gold
//             ribbon, the person under it. Lumi cheers.
//   woosh     She winds up and swoops low over the hills, sprinkling
//             stardust; dawn breaks, the scene melts away, and she flies home
//             to the header, landing where its little Lumi starts her trip
//             round the title and becoming her (flyLumiHome). Where that Lumi
//             is not shown (phones), she swoops off past the top corner.
//
// Every move is a transform or an opacity change, so the compositor keeps it
// smooth while the app boots on the main thread. Weak machines get a smaller
// sky; reduced motion keeps Lumi still and simply fades.

let _tipIntervalId = null;
let _trickTimer = 0;
let _stagedPersonalization = null;
let _isLowPowerDevice = null;
let _loadingStep = 0;
// When the screen last appeared, so an early exit can let Lumi land first.
let _shownAt = 0;
// When the scene will start melting into the next screen (performance.now()).
let _revealAt = 0;
let _exitTimers = [];
const TIP_ROTATE_MS = 6500;
// When the first tip has risen in the full film (--t-tip + its rise, styles/loading2.css).
const TIP_FIRST_SHOWN_MS = 3300;
const TIP_FADE_MS = 420;
// Longest we hold the words back waiting for the storybook font.
const FONT_WAIT_MS = 1200;
// Same breakpoint as the phone shell (mobile/index.js → body.gcq-mobile).
const MOBILE_LOADING_QUERY = '(max-width: 1023px)';
const LOADING_LOGO_URL = new URL('../assets/great-class-quest-logo.svg', import.meta.url).href;

// ── Timing (ms) ──────────────────────────────────────────────────────
// Two cuts of the same film (styles/loading2.css has the matching clock).
// The first load of the day on this device plays the full film; later loads
// the same day play the short cut. In both, the Welcome arrives at THE
// REVEAL, together with the crest sparkle and all three stars.
//   reveal        the crest sparkle pops; the earliest the Welcome can arrive
//   pathShown     when the constellation has risen in (if still loading)
//   signedOutMin  the earliest woosh with no Welcome (title and crest seen)
//   hold          the Welcome arrives in ~2.3s, then stays still a moment
//   tricksAt      Lumi's first trick, if the app is still loading
const FILM_CUTS = {
    // pathStart / pathShown: when the constellation starts and finishes rising
    // (--t-path in styles/loading2.css, plus its 0.7s rise).
    // lineStart / lineDwell: when the line under the title starts rising
    // (--t-tagline, plus its 0.8s rise), and how long it stays once risen.
    // wakePop: the moment Lumi springs out of the logo (--t-wake + 0.72 × --wake-dur).
    full: { reveal: 4300, lineStart: 4500, lineDwell: 1400, pathStart: 4800, pathShown: 5300, signedOutMin: 5000, hold: 3600, tricksAt: 6200, letterWaveMs: 750, wakePop: 3850 },
    short: { reveal: 2250, lineStart: 2450, lineDwell: 1100, pathStart: 2650, pathShown: 3150, signedOutMin: 2600, hold: 2700, tricksAt: 3900, letterWaveMs: 550, wakePop: 1990 },
};
const WELCOME_HOLD_REDUCED_MS = 2600;
const LINE_RISE_MS = 800;
const FILM_DAY_KEY = 'gcq-loading-film-day';
let _cut = 'full';

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** 'full' for the first load of the day on this device, 'short' after that. */
function loadingFilmCut() {
    try {
        return window.localStorage.getItem(FILM_DAY_KEY) === todayKey() ? 'short' : 'full';
    } catch {
        return 'full';
    }
}

/** The full film has been seen today (it played up to the Welcome). */
function rememberFullFilmSeen() {
    try { window.localStorage.setItem(FILM_DAY_KEY, todayKey()); } catch { /* blocked storage: full again next time */ }
}

function applyFilmCut(cut) {
    _cut = FILM_CUTS[cut] ? cut : 'full';
    document.getElementById('loading-screen')?.classList.toggle('loading-short', _cut === 'short');
}

/** Dev previews: force a cut ('full' or 'short'). */
export function setLoadingFilmCut(cut) {
    applyFilmCut(cut);
    scheduleLumiTricks();
}

const cutTiming = () => FILM_CUTS[_cut] || FILM_CUTS.full;

// The woosh: a short wind-up, then the flight over the screen.
const WOOSH_WINDUP_MS = 280;
const WOOSH_FLIGHT_MS = 1050;
// The scene starts to melt at REVEAL_AT and is gone at GONE_AT (from the woosh start).
const WOOSH_REVEAL_AT_MS = 1150;
const WOOSH_GONE_AT_MS = 1950;
const REDUCED_FADE_MS = 600;

const r1 = (n) => Math.round(n * 100) / 100;

function randomInt(max) {
    return Math.floor(Math.random() * max);
}

function randomRange(min, max) {
    return min + (Math.random() * (max - min));
}

function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Lumi, the guiding star ───────────────────────────────────────────
// The app's mascot: a golden, rounded five-point star with a face. One small
// SVG painted once; every move she makes is a transform on a wrapper.
const LUMI_STAR_PATH = 'M45.4 8.7Q50 0 54.6 8.7L60.7 20.3Q65.3 29 75 30.6L87.9 32.9Q97.6 34.5 90.7 41.6L81.6 51Q74.7 58 76.1 67.8L78 80.7Q79.4 90.5 70.6 86.1L58.8 80.3Q50 76 41.2 80.3L29.4 86.1Q20.6 90.5 22 80.7L23.9 67.8Q25.3 58 18.4 51L9.3 41.6Q2.4 34.5 12.1 32.9L25 30.6Q34.7 29 39.3 20.3Z';

const LUMI_EYE = '<ellipse rx="4.4" ry="5.8" fill="#2b2250"/><circle cx="1.5" cy="-2.2" r="1.7" fill="#fff"/><circle cx="-1.4" cy="2" r="0.8" fill="#fff" opacity="0.8"/>';

// Two mouths: her quiet smile, and the open "hooray" for the Welcome and the woosh.
// The eyes sit in two groups: __look slides them (following the title's spark,
// peeking around), __eyes blinks.
const LUMI_SVG = `
    <svg class="lumi" viewBox="0 0 100 100" focusable="false">
        <use href="#lumi-star" fill="url(#lumi-body)" stroke="#f2a516" stroke-width="1.4" stroke-linejoin="round"/>
        <ellipse cx="38" cy="30" rx="12" ry="7" fill="url(#lumi-shine)" transform="rotate(-32 38 30)"/>
        <ellipse cx="36.5" cy="62" rx="5.2" ry="3.2" fill="#ff8fa3" opacity="0.6"/>
        <ellipse cx="63.5" cy="62" rx="5.2" ry="3.2" fill="#ff8fa3" opacity="0.6"/>
        <g class="lumi__look">
            <g class="lumi__eyes">
                <g transform="translate(42 54)">${LUMI_EYE}</g>
                <g transform="translate(58 54)">${LUMI_EYE}</g>
            </g>
        </g>
        <path class="lumi__smile" d="M45.5 62.5Q50 66.5 54.5 62.5" stroke="#8a3a2a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        <g class="lumi__cheer">
            <path d="M45 62Q50 63.2 55 62Q54 68 50 68.9Q46 68 45 62Z" fill="#7a2e2e"/>
            <ellipse cx="50" cy="67" rx="2.6" ry="1.2" fill="#ff7b8a"/>
        </g>
    </svg>`;

// Shared gradients live in one always-rendered <defs> block: Chrome will not
// paint a gradient whose defining <svg> sits inside a display:none subtree.
const LOADING_DEFS_SVG = `
    <svg class="loading-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
            <radialGradient id="lg-glint-glow">
                <stop offset="0" stop-color="#fffbeb" stop-opacity="0.95"/>
                <stop offset="0.45" stop-color="#fde68a" stop-opacity="0.4"/>
                <stop offset="1" stop-color="#fde68a" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="lg-glint-star" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stop-color="#ffffff"/>
                <stop offset="0.5" stop-color="#fef9c3"/>
                <stop offset="1" stop-color="#fbbf24"/>
            </radialGradient>
            <radialGradient id="lumi-body" cx="0.42" cy="0.35" r="0.75">
                <stop offset="0" stop-color="#fffbe0"/>
                <stop offset="0.45" stop-color="#ffe066"/>
                <stop offset="0.85" stop-color="#ffb938"/>
                <stop offset="1" stop-color="#f59e0b"/>
            </radialGradient>
            <radialGradient id="lumi-shine">
                <stop offset="0" stop-color="#ffffff" stop-opacity="0.85"/>
                <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
            </radialGradient>
            <linearGradient id="ls-hill-far" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#5b4a8f"/>
                <stop offset="1" stop-color="#3a2f68"/>
            </linearGradient>
            <linearGradient id="ls-hill-mid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#3f3474"/>
                <stop offset="1" stop-color="#271f4f"/>
            </linearGradient>
            <linearGradient id="ls-hill-near" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#2a2254"/>
                <stop offset="1" stop-color="#160f33"/>
            </linearGradient>
            <path id="lumi-star" d="${LUMI_STAR_PATH}"/>
        </defs>
    </svg>`;

/** A four-point sparkle with a soft glow. */
const GLINT_SVG = `
    <svg viewBox="-12 -12 24 24" focusable="false">
        <circle r="8" fill="url(#lg-glint-glow)"/>
        <path d="M0 -11 C0.9 -2.4 2.4 -0.9 11 0 C2.4 0.9 0.9 2.4 0 11 C-0.9 2.4 -2.4 0.9 -11 0 C-2.4 -0.9 -0.9 -2.4 0 -11 Z" fill="url(#lg-glint-star)"/>
    </svg>`;

// A deeper gold sparkle for the stardust that falls over the (light) next screen.
// It falls after the loading screen is hidden, so it carries its own gradients
// (Chrome will not paint a gradient defined inside a display:none subtree).
const GLINT_WARM_SVG = `
    <svg viewBox="-12 -12 24 24" focusable="false">
        <defs>
            <radialGradient id="lg-veil-glow"><stop offset="0" stop-color="#fde68a" stop-opacity="0.9"/><stop offset="1" stop-color="#fbbf24" stop-opacity="0"/></radialGradient>
            <radialGradient id="lg-veil-star" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fffbe6"/><stop offset="0.45" stop-color="#fcd34d"/><stop offset="1" stop-color="#e48a0c"/></radialGradient>
        </defs>
        <circle r="9" fill="url(#lg-veil-glow)"/>
        <path d="M0 -11 C0.9 -2.4 2.4 -0.9 11 0 C2.4 0.9 0.9 2.4 0 11 C-0.9 2.4 -2.4 0.9 -11 0 C-2.4 -0.9 -0.9 -2.4 0 -11 Z" fill="url(#lg-veil-star)"/>
    </svg>`;

function glints(className, count) {
    return Array.from({ length: count }, (_, i) =>
        `<span class="loading-glint ${className}-${i + 1}">${GLINT_SVG}</span>`).join('');
}

function makeGlint(className = '') {
    const glint = document.createElement('span');
    glint.className = `loading-glint ${className}`.trim();
    glint.innerHTML = GLINT_SVG;
    return glint;
}

// ── The land: hills, the Quest castle and its lit windows ────────────
// The same hills and castle that wait behind the sign-in card, at dusk, so
// the dawn at the end hands over to that daylight naturally.
const HILLS_FAR = 'M0 150 C 120 118 230 104 360 116 C 470 126 540 92 660 86 C 790 80 880 118 1000 112 C 1120 106 1210 74 1330 80 C 1450 86 1530 110 1600 104 L 1600 300 L 0 300 Z';
const HILLS_MID = 'M0 196 C 140 160 260 150 400 170 C 520 188 600 150 740 142 C 880 134 960 176 1100 172 C 1240 168 1330 138 1450 146 C 1530 151 1570 160 1600 158 L 1600 300 L 0 300 Z';
const HILLS_NEAR = 'M0 250 C 160 214 300 206 460 226 C 600 244 700 214 860 210 C 1020 206 1120 240 1280 236 C 1420 232 1520 214 1600 218 L 1600 300 L 0 300 Z';

const HILLS_SVG = (path, fill, cls) => `
    <svg class="ls-hills ${cls}" viewBox="0 0 1600 300" preserveAspectRatio="none" focusable="false"><path d="${path}" fill="${fill}"/></svg>`;

const CASTLE_SVG = `
    <svg viewBox="0 0 120 110" focusable="false">
        <g fill="#2f2660">
            <path d="M22 110 V52 H18 L27 34 L36 52 H32 V110 Z"/>
            <path d="M88 110 V52 H84 L93 34 L102 52 H98 V110 Z"/>
            <path d="M46 110 V40 H42 L58 14 L74 40 H70 V110 Z"/>
            <rect x="30" y="66" width="60" height="44"/>
            <path d="M30 66 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 Z"/>
            <path d="M58 14 V2" stroke="#2f2660" stroke-width="1.6"/>
        </g>
        <path d="M58.8 2.4 L69 5.4 L58.8 8.4 Z" fill="#fbbf24"/>
        <path d="M54 110 V96 A6 6 0 0 1 66 96 V110 Z" fill="#1c1640"/>
    </svg>`;

// The windows are their own layer, so their glow can breathe as opacity.
const CASTLE_WINDOWS_SVG = `
    <svg viewBox="0 0 120 110" focusable="false">
        <g fill="#ffd36b">
            <rect x="55.6" y="44" width="4.8" height="7.5" rx="2.4"/>
            <rect x="25.6" y="58" width="3.6" height="6" rx="1.8"/>
            <rect x="91.6" y="58" width="3.6" height="6" rx="1.8"/>
            <rect x="40" y="78" width="4" height="6" rx="2"/>
            <rect x="76" y="78" width="4" height="6" rx="2"/>
        </g>
    </svg>`;

// A grove on the right-hand hill, so the land is not empty across from the castle.
const GROVE_SVG = `
    <svg viewBox="0 0 200 90" focusable="false">
        <g fill="#2b2357">
            <path d="M30 90 V70 H26 L34 22 L42 70 H38 V90 Z"/>
            <path d="M52 90 V74 H49 L56 38 L63 74 H60 V90 Z"/>
            <circle cx="84" cy="56" r="17"/><rect x="82" y="66" width="4" height="24"/>
            <circle cx="104" cy="64" r="12"/><rect x="102.5" y="70" width="3" height="20"/>
            <path d="M150 90 V68 H146 L155 14 L164 68 H160 V90 Z"/>
            <path d="M172 90 V76 H169 L176 44 L183 76 H180 V90 Z"/>
        </g>
        <g fill="#3a3070" opacity="0.9">
            <path d="M34 22 L38 46 L34 44 Z"/>
            <path d="M155 14 L159 40 L155 38 Z"/>
            <circle cx="79" cy="50" r="7"/>
        </g>
    </svg>`;

const MOON_SVG = `
    <svg viewBox="0 0 100 100" focusable="false">
        <defs>
            <radialGradient id="ls-moon-face" cx="0.38" cy="0.36" r="0.7">
                <stop offset="0" stop-color="#fffdf2"/>
                <stop offset="0.7" stop-color="#fdf3c8"/>
                <stop offset="1" stop-color="#f6e2a0"/>
            </radialGradient>
            <mask id="ls-moon-cut"><rect width="100" height="100" fill="#fff"/><circle cx="66" cy="38" r="34" fill="#000"/></mask>
        </defs>
        <circle cx="50" cy="50" r="36" fill="url(#ls-moon-face)" mask="url(#ls-moon-cut)"/>
    </svg>`;

// ── The words ────────────────────────────────────────────────────────

const LOADING_TITLE_TEXT = 'The Great Class Quest';
const LOADING_TAGLINE = 'Where every lesson becomes an adventure';

/**
 * Words as letters, one span each, so they can rise one by one. Words stay
 * unbroken (each is an inline-block) and wrap at the spaces.
 */
function lettersHTML(text) {
    let index = 0;
    return text.split(' ').map((word) => {
        const letters = Array.from(word).map((ch) =>
            `<span class="lg-l" style="--i:${index++}"><span class="lg-l__ink">${escapeHTML(ch)}</span></span>`).join('');
        index += 1; // the space counts, so the spark's pace stays even
        return `<span class="lg-w">${letters}</span>`;
    }).join(' ');
}

/**
 * A band of light that sweeps across a line of words. Only the band and a
 * copy of the words inside it move, in opposite directions, so the copy stays
 * locked over the real words while the band slides (styles/loading2.css).
 */
function sheenHTML(innerHTML) {
    return `<span class="gcq-sheen" aria-hidden="true"><span class="gcq-sheen__band"><span class="gcq-sheen__text">${innerHTML}</span></span></span>`;
}

const TITLE_LETTERS = lettersHTML(LOADING_TITLE_TEXT);

/** One star of the constellation: a pale outline and a gold copy that lights over it. */
const CONSTELLATION_STAR = (i) => `
    <span class="loading-path__star" style="--n:${i}">
        <svg class="loading-path__dim" viewBox="0 0 100 100" focusable="false"><use href="#lumi-star"/></svg>
        <svg class="loading-path__lit" viewBox="0 0 100 100" focusable="false"><use href="#lumi-star" fill="url(#lumi-body)" stroke="#f2a516" stroke-width="3"/></svg>
    </span>`;

export const loadingHTML = `
    <div id="loading-screen"
        class="fixed inset-0 flex flex-col items-center justify-center z-[1100]">

        ${LOADING_DEFS_SVG}

        <!-- The sky: twilight, stars, the moon, a few dusky clouds -->
        <div class="ls-sky" aria-hidden="true">
            <div class="ls-sky__band"></div>
            <div class="ls-sky__veil"></div>
            <div class="ls-sun"></div>
            <div class="ls-stars ls-stars--far"></div>
            <div class="ls-stars ls-stars--near"></div>
            <div class="ls-stars ls-stars--bright"></div>
            <div class="ls-moon">${MOON_SVG}</div>
            <div class="ls-clouds"></div>
            <div class="ls-meteors"><span class="ls-meteor"></span><span class="ls-meteor"></span></div>
        </div>

        <!-- The land: hills, the Quest castle, fireflies -->
        <div class="ls-land" aria-hidden="true">
            <div class="ls-horizon"></div>
            ${HILLS_SVG(HILLS_FAR, 'url(#ls-hill-far)', 'ls-hills--far')}
            <div class="ls-castle">${CASTLE_SVG}<span class="ls-castle__windows">${CASTLE_WINDOWS_SVG}</span></div>
            <div class="ls-grove">${GROVE_SVG}</div>
            ${HILLS_SVG(HILLS_MID, 'url(#ls-hill-mid)', 'ls-hills--mid')}
            ${HILLS_SVG(HILLS_NEAR, 'url(#ls-hill-near)', 'ls-hills--near')}
            <div class="ls-motes"></div>
        </div>

        <!-- Rain, snow, fog or lightning, when the real sky has them (templates/loadingSky.js) -->
        <div class="ls-weather" aria-hidden="true"></div>

        <div class="loading-stage">
            <!-- Lumi. Each wrapper owns one kind of move (styles/loading2.css):
                 the logo she wakes out of, the flight (the woosh), the pose
                 (waking, spin), hops and tricks, and the idle float. -->
            <div class="loading-lumi" aria-hidden="true">
                <span class="loading-lumi__logo"><img src="${LOADING_LOGO_URL}" alt="" decoding="async" /></span>
                <span class="loading-lumi__wake"></span>
                <div class="loading-lumi__fly">
                    <span class="loading-lumi__trail"></span>
                    <div class="loading-lumi__pose">
                        <div class="loading-lumi__hop">
                            <div class="loading-lumi__float">
                                <span class="loading-lumi__halo"></span>
                                <span class="loading-lumi__burst"></span>
                                <span class="loading-lumi__orbit">${glints('lo', 3)}</span>
                                ${LUMI_SVG}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="loading-lumi__sprinkle"></div>
            </div>

            <!-- The title, the gold sparkle crest, and under them one cell that holds
                 the line under the title and, from the reveal, the Welcome -->
            <div class="loading-words">
                <div class="loading-heading">
                    <h1 class="loading-title" aria-label="${LOADING_TITLE_TEXT}">
                        <span class="loading-title__glow" aria-hidden="true">${TITLE_LETTERS}</span>
                        <span class="loading-title__ink" aria-hidden="true">${TITLE_LETTERS}</span>
                        <span class="loading-title__pen" aria-hidden="true"><span class="loading-title__nib">${GLINT_SVG}</span></span>
                    </h1>
                    <div class="loading-crest" aria-hidden="true">
                        <span class="loading-crest__line"></span>
                        <span class="loading-crest__medal">${GLINT_SVG}</span>
                        <span class="loading-crest__line"></span>
                    </div>
                    <div class="loading-sub">
                        <p class="loading-tagline"><span class="loading-tagline__text">${LOADING_TAGLINE}</span></p>
                        <div id="loading-greeting" class="loading-welcome">
                            <div id="loading-greeting-text" class="loading-welcome__line"></div>
                            <div id="loading-greeting-school" class="loading-welcome__school"></div>
                            <div id="loading-greeting-person" class="loading-welcome__person"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- A constellation that lights up as the app gets ready -->
            <div class="loading-path" aria-hidden="true">
                <svg class="loading-path__lines" viewBox="0 0 200 40" preserveAspectRatio="none" focusable="false">
                    <path class="loading-path__base" d="M16 26 L100 12 L184 26"/>
                    <path class="loading-path__line" pathLength="1" d="M16 26 L100 12"/>
                    <path class="loading-path__line" pathLength="1" d="M100 12 L184 26"/>
                </svg>
                ${CONSTELLATION_STAR(0)}${CONSTELLATION_STAR(1)}${CONSTELLATION_STAR(2)}
            </div>

            <!-- Fixed height: tips of one or two lines never shift the stage -->
            <div class="loading-tip-card">
                <div id="loading-tip" class="loading-tip" aria-live="polite">Preparing your quest&hellip;</div>
            </div>
        </div>

        <!-- Stardust and sparks (placed by the woosh and the constellation) -->
        <div class="loading-dust" aria-hidden="true"></div>

        <!-- Dawn breaking over the hills at the end -->
        <div class="loading-dawn" aria-hidden="true"></div>

        <!-- Daylight: the sign-in gate's light, when the screen arrives through it -->
        <div class="loading-daylight" aria-hidden="true"></div>
    </div>
`;

// ── Device hints ─────────────────────────────────────────────────────

function detectLowPowerTier() {
    if (_isLowPowerDevice === null) _isLowPowerDevice = sharedLowPowerTier();
    return _isLowPowerDevice;
}

function isMobileLoadingViewport() {
    try {
        return Boolean(window.matchMedia?.(MOBILE_LOADING_QUERY).matches);
    } catch {
        return false;
    }
}

function prefersReducedMotion() {
    try {
        return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch {
        return false;
    }
}

function loadingPart(selector) {
    return document.querySelector(`#loading-screen ${selector}`);
}

/**
 * Keep the words hidden until Fredoka One is ready, then let them arrive once.
 * Without this the title would paint in a fallback font and visibly swap.
 */
function revealLoadingTextWhenFontsReady(loadingScreen) {
    if (!loadingScreen) return;
    loadingScreen.classList.add('loading-fonts-pending');
    let revealed = false;
    const reveal = () => {
        if (revealed) return;
        revealed = true;
        requestAnimationFrame(() => {
            loadingScreen.style.setProperty('--since', `${Math.round(Math.max(0, performance.now() - _shownAt))}ms`);
            loadingScreen.classList.remove('loading-fonts-pending');
            loadingScreen.classList.add('loading-text-ready');
        });
    };
    setTimeout(reveal, FONT_WAIT_MS);
    try {
        const fonts = document.fonts;
        if (!fonts?.load) { reveal(); return; }
        Promise.all([
            fonts.load('1em "Fredoka One"'),
            fonts.load('600 1em "Fredoka"'),
        ]).then(reveal, reveal);
    } catch {
        reveal();
    }
}

function stopTipRotation() {
    // The handle is the first tip's timeout, then the interval: clear both ways.
    clearTimeout(_tipIntervalId);
    clearInterval(_tipIntervalId);
    _tipIntervalId = null;
}

/** Start cycling through tips in the loading screen. Call once after injectHTML(). */
export function initLoadingTips() {
    const tipEl = document.getElementById('loading-tip');
    if (!tipEl) return;
    stopTipRotation();
    let storage = null;
    try { storage = window.localStorage; } catch { /* blocked storage: deal without memory */ }
    const deck = createTipDeck({ storage });
    tipEl.textContent = deck.next();

    const nextTip = () => {
        const tip = deck.next();
        tipEl.classList.add('loading-tip-fade');
        setTimeout(() => {
            tipEl.textContent = tip;
            tipEl.classList.remove('loading-tip-fade');
        }, TIP_FADE_MS);
    };
    // Each tip gets a full read: the first changes only after it has been on
    // screen for TIP_ROTATE_MS (it rises at --t-tip, styles/loading2.css).
    _tipIntervalId = setTimeout(() => {
        nextTip();
        _tipIntervalId = setInterval(nextTip, TIP_ROTATE_MS);
    }, TIP_FIRST_SHOWN_MS + TIP_ROTATE_MS);
}

// ── Building the sky ─────────────────────────────────────────────────

const STAR_TINTS = ['#ffffff', '#ffffff', '#fff7d6', '#e0e7ff', '#fde68a'];

/**
 * One layer of stars as a single SVG, painted once. The three layers twinkle
 * at their own pace by fading as a whole, which the compositor does for free.
 */
function starLayerSvg(count, { rMin, rMax, glow = false }) {
    const parts = [];
    for (let i = 0; i < count; i += 1) {
        const x = randomRange(0, 1600);
        // Most stars high up; fewer towards the hills.
        const y = Math.pow(Math.random(), 1.5) * 720;
        const r = randomRange(rMin, rMax);
        const fill = STAR_TINTS[randomInt(STAR_TINTS.length)];
        if (glow) {
            const s = r * 3.4;
            parts.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r * 2.6)}" fill="${fill}" opacity="0.18"/>`);
            parts.push(`<path d="M${r1(x)} ${r1(y - s)} Q${r1(x + r * 0.35)} ${r1(y - r * 0.35)} ${r1(x + s)} ${r1(y)} Q${r1(x + r * 0.35)} ${r1(y + r * 0.35)} ${r1(x)} ${r1(y + s)} Q${r1(x - r * 0.35)} ${r1(y + r * 0.35)} ${r1(x - s)} ${r1(y)} Q${r1(x - r * 0.35)} ${r1(y - r * 0.35)} ${r1(x)} ${r1(y - s)} Z" fill="${fill}"/>`);
        } else {
            parts.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${fill}"/>`);
        }
    }
    return `<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" focusable="false">${parts.join('')}</svg>`;
}

function buildStars({ mobile, lowPower }) {
    const scale = mobile ? 0.5 : (lowPower ? 0.7 : 1);
    const far = loadingPart('.ls-stars--far');
    const near = loadingPart('.ls-stars--near');
    const bright = loadingPart('.ls-stars--bright');
    if (far) far.innerHTML = starLayerSvg(Math.round(110 * scale), { rMin: 0.9, rMax: 1.7 });
    if (near) near.innerHTML = starLayerSvg(Math.round(46 * scale), { rMin: 1.6, rMax: 2.6 });
    if (bright) bright.innerHTML = starLayerSvg(Math.round(12 * scale), { rMin: 2.2, rMax: 3.4, glow: true });
}

/** Fireflies of light rising slowly out of the hills. */
function buildMotes({ mobile, lowPower }) {
    const layer = loadingPart('.ls-motes');
    if (!layer) return;
    layer.innerHTML = '';
    const count = lowPower ? 0 : (mobile ? 5 : 12);
    for (let i = 0; i < count; i += 1) {
        const mote = document.createElement('span');
        mote.className = 'ls-mote';
        mote.style.left = `${randomRange(3, 97).toFixed(1)}%`;
        mote.style.bottom = `${randomRange(2, 22).toFixed(1)}%`;
        const size = randomRange(3, 6.5);
        mote.style.width = `${size.toFixed(1)}px`;
        mote.style.height = `${size.toFixed(1)}px`;
        mote.style.animationDuration = `${randomRange(7, 12).toFixed(2)}s`;
        mote.style.animationDelay = `-${randomRange(0, 10).toFixed(2)}s`;
        mote.style.setProperty('--sway', `${randomRange(-40, 40).toFixed(0)}px`);
        layer.appendChild(mote);
    }
}

/**
 * Build the sky for this visit. Called once after injectHTML(), before the
 * first paint, so a phone never sees the desktop scene first.
 */
export function initLoadingAtmosphere() {
    const loadingScreen = document.getElementById('loading-screen');
    const lowPower = detectLowPowerTier();
    const mobile = isMobileLoadingViewport();
    _shownAt = performance.now();
    if (loadingScreen) {
        loadingScreen.classList.toggle('gcq-perf-low', lowPower);
        loadingScreen.classList.toggle('gcq-loading-mobile', mobile);
        applyFilmCut(loadingFilmCut());
        revealLoadingTextWhenFontsReady(loadingScreen);
    }
    // The real time of day and weather (templates/loadingSky.js).
    paintLoadingSky(loadingScreen, { mobile, lowPower });
    buildStars({ mobile, lowPower });
    buildMotes({ mobile, lowPower });
    scheduleLumiTricks();
}

// ── Lumi at play ─────────────────────────────────────────────────────
// While the app loads she is never just parked: every few seconds she does
// one small thing. Each trick is a one-shot class on her hop layer.

const TRICKS = ['is-twirl', 'is-peek', 'is-bounce', 'is-sprinkle', 'is-peek', 'is-twirl', 'is-sprinkle'];
let _trickIndex = 0;

function lumiReact(kind) {
    const hop = loadingPart('.loading-lumi__hop');
    if (!hop) return;
    hop.classList.remove('is-hop', 'is-cheer', 'is-cast', ...TRICKS);
    void hop.offsetWidth;
    hop.classList.add(kind);
}

function lumiSprinkle(count) {
    const layer = loadingPart('.loading-lumi__sprinkle');
    if (!layer) return;
    layer.innerHTML = '';
    for (let i = 0; i < count; i += 1) {
        const glint = makeGlint('lumi-sprinkle');
        glint.style.left = `${randomRange(25, 75).toFixed(0)}%`;
        glint.style.top = `${randomRange(55, 75).toFixed(0)}%`;
        const size = randomRange(9, 16);
        glint.style.width = `${size.toFixed(0)}px`;
        glint.style.height = `${size.toFixed(0)}px`;
        glint.style.setProperty('--fall', `${randomRange(50, 110).toFixed(0)}px`);
        glint.style.setProperty('--drift', `${randomRange(-34, 34).toFixed(0)}px`);
        glint.style.animationDelay = `${Math.round(i * 90 + randomRange(0, 60))}ms`;
        layer.appendChild(glint);
    }
}

let _wakeTimer = 0;

function scheduleLumiTricks() {
    clearTimeout(_trickTimer);
    clearTimeout(_wakeTimer);
    if (prefersReducedMotion()) return;
    // Sparkles shaken loose as she springs out of the logo.
    const sinceShown = performance.now() - _shownAt;
    const popIn = cutTiming().wakePop - sinceShown;
    if (popIn > -150) _wakeTimer = setTimeout(() => lumiSprinkle(detectLowPowerTier() ? 5 : 9), Math.max(0, popIn));
    const next = () => {
        const screen = document.getElementById('loading-screen');
        if (!screen || screen.classList.contains('hidden') || screen.classList.contains('loading-final-moment')
            || screen.classList.contains('loading-screen-exit')) return;
        const trick = TRICKS[_trickIndex++ % TRICKS.length];
        lumiReact(trick);
        if (trick === 'is-sprinkle') lumiSprinkle(detectLowPowerTier() ? 4 : 7);
        _trickTimer = setTimeout(next, randomRange(3800, 5200));
    };
    // The first trick waits until the opening is composed, so it never steals its moments.
    _trickTimer = setTimeout(next, cutTiming().tricksAt);
}

// ── The constellation ────────────────────────────────────────────────
// Real readiness lights it, never a timer: 1 when sign-in has answered,
// 2 when the account has loaded (stageLoadingPersonalization), 3 for the
// Welcome. For each, Lumi casts a spark that flies to the star.

const SPARK_MS = 520;

function castSpark(star) {
    const lumi = loadingPart('.loading-lumi');
    const dust = loadingPart('.loading-dust');
    if (!lumi || !dust || !star || prefersReducedMotion()) return 0;
    const from = lumi.getBoundingClientRect();
    const to = star.getBoundingClientRect();
    if (!from.width || !to.width) return 0;
    const x0 = from.left + from.width * 0.5;
    const y0 = from.top + from.height * 0.62;
    const spark = makeGlint('loading-spark');
    spark.style.left = `${Math.round(x0)}px`;
    spark.style.top = `${Math.round(y0)}px`;
    spark.style.setProperty('--dx', `${Math.round(to.left + to.width / 2 - x0)}px`);
    spark.style.setProperty('--dy', `${Math.round(to.top + to.height / 2 - y0)}px`);
    dust.appendChild(spark);
    setTimeout(() => spark.remove(), SPARK_MS + 200);
    return SPARK_MS - 60;
}

// While the app is still loading, the constellation rises in after the
// reveal; a star that is ready earlier waits for it, so every cast can be
// seen, and casts are spaced so each star gets its own moment. At the
// Welcome all the remaining stars light together.
const CAST_SPACING_MS = 700;
let _litStep = 0;
let _castTimer = 0;

function lightStar(i) {
    const path = loadingPart('.loading-path');
    if (!path) return;
    path.querySelectorAll('.loading-path__star')[i]?.classList.add('is-on');
    if (i > 0) path.querySelectorAll('.loading-path__line')[i - 1]?.classList.add('is-on');
}

function castNextStar() {
    clearTimeout(_castTimer);
    _castTimer = 0;
    if (_litStep >= _loadingStep) return;
    const wait = cutTiming().pathShown - (performance.now() - _shownAt);
    if (wait > 0 && !prefersReducedMotion()) {
        _castTimer = setTimeout(castNextStar, wait);
        return;
    }
    const i = _litStep;
    _litStep += 1;
    const star = loadingPart('.loading-path')?.querySelectorAll('.loading-path__star')[i];
    const screen = document.getElementById('loading-screen');
    if (!screen?.classList.contains('loading-final-moment')) lumiReact('is-cast');
    const travel = castSpark(star);
    setTimeout(() => lightStar(i), travel);
    if (_litStep < _loadingStep) _castTimer = setTimeout(castNextStar, CAST_SPACING_MS);
}

/**
 * Light the constellation up to `step` (1–3). Steps only ever go forward.
 * quiet: light it at once, without Lumi's cast (used when the screen reopens).
 */
export function markLoadingStage(step, { quiet = false } = {}) {
    const next = Math.min(3, Math.max(_loadingStep, step));
    if (next === _loadingStep) return;
    _loadingStep = next;
    // The quick load has no constellation on screen: nothing to cast at.
    if (quiet || _cut === 'short') {
        clearTimeout(_castTimer);
        while (_litStep < _loadingStep) lightStar(_litStep++);
        return;
    }
    // A cast already waiting picks up the new star in its turn.
    if (!_castTimer) castNextStar();
}

// ── The Welcome ──────────────────────────────────────────────────────
// The big line is a starlit hello for the moment, never a name. The school
// rides a gold ribbon under it, and the person signing in sits under that.

const TEACHER_LINES = {
    morning: 'A bright new day of quests',
    afternoon: 'Your adventure continues',
    evening: 'The evening quest awaits',
    night: 'The stars are out for you',
};

function welcomeLine(role, dayPart) {
    if (role === 'parent') return 'Your hero’s story awaits';
    if (role === 'secretary') return 'Your School Office is ready';
    return TEACHER_LINES[dayPart] || TEACHER_LINES.afternoon;
}

function buildPersonalizedCopy(name, role) {
    const HONORIFICS = /^(mr|mrs|ms|miss|dr|prof|rev|sir|lord|lady|κ)\.?$/i;
    const displayName = (name || '').trim().replace(/\s+/g, ' ');
    const firstName = displayName.split(' ').find(p => !HONORIFICS.test(p)) || '';
    return {
        role,
        name: displayName,
        initial: Array.from(firstName || displayName)[0]?.toUpperCase() || '',
    };
}

/**
 * Stage the personalized copy so it can be shown at the last moment.
 * The account has loaded by now, so the second star lights.
 */
export function stageLoadingPersonalization(name, role) {
    _stagedPersonalization = buildPersonalizedCopy(name, role);
    markLoadingStage(2);
}

// The Welcome is taller than the line it replaces, so the stage grows and
// everything around it shifts. Measure before, then glide each part from where
// it was to where it now sits (an added translate, so it rides on top of any
// arrival animation already running) instead of letting it jump.
const GLIDE_PARTS = ['.loading-lumi', '.loading-words', '.loading-path', '.loading-tip-card'];

function measureGlide(screen) {
    if (!screen || prefersReducedMotion()) return () => {};
    const parts = GLIDE_PARTS.map(sel => screen.querySelector(sel)).filter(Boolean);
    const before = parts.map(el => el.getBoundingClientRect().top);
    return () => {
        parts.forEach((el, i) => {
            const dy = before[i] - el.getBoundingClientRect().top;
            if (Math.abs(dy) < 1 || typeof el.animate !== 'function') return;
            try {
                el.animate(
                    [{ translate: `0 ${dy.toFixed(1)}px` }, { translate: '0 0' }],
                    { duration: 820, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', composite: 'add' },
                );
            } catch { /* an old browser simply skips the glide */ }
        });
    };
}

/**
 * Show the staged Welcome. schoolName rides the ribbon (left out when unknown);
 * dayPart is morning / afternoon / evening / night from the real sky.
 * Returns true when there was a Welcome to show.
 */
export function revealStagedLoadingPersonalization({ schoolName = '', dayPart = '' } = {}) {
    const loadingScreen = document.getElementById('loading-screen');
    const greetingEl = document.getElementById('loading-greeting');
    const greetingText = document.getElementById('loading-greeting-text');
    const schoolEl = document.getElementById('loading-greeting-school');
    const personEl = document.getElementById('loading-greeting-person');
    if (!greetingEl || !greetingText || !_stagedPersonalization) return false;

    stopTipRotation();
    clearTimeout(_trickTimer);

    // The constellation may not have started rising yet: it comes in with the
    // Welcome. One already on its way keeps rising (restarting it would blink).
    const early = performance.now() - _shownAt < cutTiming().pathStart;
    // Where everything sits now, so the Welcome can make room smoothly.
    const glide = measureGlide(loadingScreen);
    loadingScreen?.classList.toggle('loading-early-welcome', early);
    loadingScreen?.classList.add('loading-final-moment');
    // Every star still dark lights now, one quick beat after another.
    clearTimeout(_castTimer);
    _castTimer = 0;
    _loadingStep = 3;
    // Counted from the first star still dark: one whose cast spark is still
    // in flight lights in this same wave, so they always light left to right.
    const pathStars = [...(loadingScreen?.querySelectorAll('.loading-path__star') || [])];
    const dark = pathStars.findIndex(star => !star.classList.contains('is-on'));
    const firstDark = !pathStars.length ? _litStep : (dark < 0 ? 3 : dark);
    for (let i = firstDark, k = 0; i < 3; i += 1, k += 1) {
        _exitTimers.push(setTimeout(() => lightStar(i), (early ? 450 : 150) + k * 160));
    }
    _litStep = 3;
    lumiReact('is-cheer');
    if (_cut === 'full') rememberFullFilmSeen();

    // Three stacked copies of the same letters: a soft glow behind, the
    // starlit ink that rises in letter by letter, and a sheen that sweeps
    // across once they have landed.
    const { role, name, initial } = _stagedPersonalization;
    const line = welcomeLine(role, dayPart);
    const letters = lettersHTML(line);
    greetingText.innerHTML =
        `<span class="loading-greeting-glow" aria-hidden="true">${letters}</span>` +
        `<span class="loading-greeting-ink" aria-hidden="true">${letters}</span>` +
        sheenHTML(letters);
    greetingText.setAttribute('role', 'heading');
    greetingText.setAttribute('aria-level', '2');
    greetingText.setAttribute('aria-label', line);
    const count = Array.from(line).length;
    // The whole wave lands quickly, however long the line is.
    const step = Math.min(44, cutTiming().letterWaveMs / Math.max(1, count - 1));
    const landed = Math.round(step * (count - 1) + 120 + 600);
    greetingText.style.setProperty('--lg-step', `${step.toFixed(1)}ms`);
    greetingEl.style.setProperty('--lg-landed', `${landed}ms`);

    const school = String(schoolName || '').trim();
    if (schoolEl) {
        schoolEl.hidden = !school;
        schoolEl.innerHTML = school
            ? `<span class="loading-ribbon"><span class="loading-ribbon__eyebrow">Welcome to</span><span class="loading-ribbon__name">${escapeHTML(school)}</span></span>`
            : '';
    }
    if (personEl) {
        personEl.hidden = !name;
        personEl.innerHTML = name
            ? `<span class="loading-welcome__crest" aria-hidden="true">${escapeHTML(initial)}</span><span class="loading-welcome__name">${escapeHTML(name)}</span>`
            : '';
    }
    greetingEl.classList.add('loading-greeting-visible');
    glide();
    // The tip on screen stays as it is, so whoever is reading it can finish.

    _stagedPersonalization = null;
    return true;
}

// ── The woosh ────────────────────────────────────────────────────────
// Lumi winds up, then swoops over the screen along one long curve: back and
// down, sweeping low across the hills towards us, then up and away past the
// top corner. The curve is a cubic Bézier measured here, played with the Web
// Animations API as plain transforms, and the stardust is dropped on the same
// curve, each grain at the moment she passes it.

function bezier(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function bezierSlope(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}

// Her pace along the curve: unhurried as she leaves, fast over the middle.
const flightEase = (u) => (u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2) * 0.35 + (u ** 1.7) * 0.65;

function planWoosh(loadingScreen) {
    const lumi = loadingScreen.querySelector('.loading-lumi');
    if (!lumi) return null;
    const rect = lumi.getBoundingClientRect();
    if (!rect.width) return null;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const x0 = rect.left + rect.width / 2;
    const y0 = rect.top + rect.height / 2;
    const mobile = loadingScreen.classList.contains('gcq-loading-mobile');
    // Control points, relative to her start.
    const P = mobile
        ? [[0, 0], [-0.32 * W, 0.34 * H], [0.42 * W, 0.40 * H], [W - x0 + 120, -y0 - 140]]
        : [[0, 0], [-0.26 * W, 0.42 * H], [0.30 * W, 0.46 * H], [W - x0 + 160, -y0 - 160]];
    const at = (t) => ({
        x: bezier(P[0][0], P[1][0], P[2][0], P[3][0], t),
        y: bezier(P[0][1], P[1][1], P[2][1], P[3][1], t),
        angle: Math.atan2(bezierSlope(P[0][1], P[1][1], P[2][1], P[3][1], t), bezierSlope(P[0][0], P[1][0], P[2][0], P[3][0], t)) * 180 / Math.PI,
    });
    return { x0, y0, at, size: rect.width };
}

function animateWoosh(loadingScreen, plan) {
    const fly = loadingScreen.querySelector('.loading-lumi__fly');
    const pose = loadingScreen.querySelector('.loading-lumi__pose');
    const trail = loadingScreen.querySelector('.loading-lumi__trail');
    if (!fly || !pose || typeof fly.animate !== 'function') return;
    const lead = WOOSH_WINDUP_MS / (WOOSH_WINDUP_MS + WOOSH_FLIGHT_MS);
    const total = WOOSH_WINDUP_MS + WOOSH_FLIGHT_MS;
    const STEPS = 28;
    const flyFrames = [{ offset: 0, transform: 'translate3d(0,0,0) rotate(0deg)' }];
    const poseFrames = [
        { offset: 0, transform: 'rotate(0deg) scale(1)' },
        { offset: lead * 0.6, transform: 'rotate(0deg) scale(1.18, 0.8)' },
        { offset: lead, transform: 'rotate(0deg) scale(0.9, 1.12)' },
    ];
    const trailFrames = [{ offset: 0, opacity: 0, transform: 'rotate(180deg) scaleX(0)' }, { offset: lead, opacity: 0, transform: 'rotate(180deg) scaleX(0)' }];
    for (let k = 1; k <= STEPS; k += 1) {
        const u = k / STEPS;
        const t = flightEase(u);
        const p = plan.at(t);
        const offset = lead + (1 - lead) * u;
        // She banks into the curve, and grows as she sweeps past the camera.
        const near = Math.sin(Math.PI * Math.min(1, t * 1.15));
        const scale = 1 + near * 0.75 - (t > 0.85 ? (t - 0.85) * 2.2 : 0);
        flyFrames.push({ offset, transform: `translate3d(${r1(p.x)}px, ${r1(p.y)}px, 0) rotate(${r1(p.angle)}deg)` });
        // Undo the bank for her face, plus one full joyful spin along the way.
        poseFrames.push({ offset, transform: `rotate(${r1(-p.angle + 360 * t)}deg) scale(${r1(scale)})` });
        trailFrames.push({
            offset,
            opacity: u < 0.12 ? u / 0.12 : (u > 0.9 ? (1 - u) / 0.1 : 1),
            transform: `rotate(180deg) scaleX(${r1(Math.min(1.5, 0.4 + u * 1.6) * (1 + near * 0.6))})`,
        });
    }
    const timing = { duration: total, fill: 'forwards', easing: 'linear' };
    const flight = fly.animate(flyFrames, timing);
    pose.animate(poseFrames, timing);
    trail?.animate(trailFrames, timing);
}

/** Stardust along her curve: each grain appears as she passes, then drifts down and fades. */
function sprinkleWooshDust(loadingScreen, plan) {
    const dust = loadingScreen.querySelector('.loading-dust');
    if (!dust) return;
    const lowPower = detectLowPowerTier();
    const mobile = loadingScreen.classList.contains('gcq-loading-mobile');
    const count = lowPower || mobile ? 16 : 30;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
        const u = (i + 0.5) / count;
        const t = flightEase(u);
        const p = plan.at(t);
        const glint = makeGlint('loading-stardust');
        glint.style.left = `${Math.round(plan.x0 + p.x + randomRange(-18, 18))}px`;
        glint.style.top = `${Math.round(plan.y0 + p.y + randomRange(-14, 14))}px`;
        const size = randomRange(12, 26) * (1 + Math.sin(Math.PI * t) * 0.6);
        glint.style.width = `${size.toFixed(0)}px`;
        glint.style.height = `${size.toFixed(0)}px`;
        glint.style.setProperty('--fall', `${randomRange(60, 170).toFixed(0)}px`);
        glint.style.setProperty('--drift', `${randomRange(-30, 30).toFixed(0)}px`);
        glint.style.animationDelay = `${Math.round(WOOSH_WINDUP_MS + WOOSH_FLIGHT_MS * u)}ms`;
        frag.appendChild(glint);
    }
    dust.innerHTML = '';
    dust.appendChild(frag);
}

/**
 * The last of Lumi's stardust keeps falling for a moment over the screen
 * underneath (Home, or the sign-in gate) after the scene has melted away.
 * A plain fixed layer above the app that never takes a click, removed after.
 */
function sprinkleStardustVeil(delayMs, { even = false } = {}) {
    if (typeof document === 'undefined' || prefersReducedMotion()) return;
    const lowPower = detectLowPowerTier();
    const mobile = isMobileLoadingViewport();
    const count = lowPower || mobile ? 16 : 30;
    const veil = document.createElement('div');
    veil.className = 'gcq-stardust-veil';
    veil.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < count; i += 1) {
        const glint = makeGlint('gcq-stardust-veil__grain');
        glint.innerHTML = GLINT_WARM_SVG;
        // Heavier towards the top right, where she left.
        const x = even ? randomRange(2, 98) : 100 - Math.pow(Math.random(), 1.6) * 100;
        glint.style.left = `${x.toFixed(1)}%`;
        glint.style.top = `${randomRange(-4, 38).toFixed(1)}%`;
        const size = randomRange(12, 26);
        glint.style.width = `${size.toFixed(0)}px`;
        glint.style.height = `${size.toFixed(0)}px`;
        glint.style.setProperty('--fall', `${randomRange(18, 40).toFixed(0)}vh`);
        glint.style.setProperty('--drift', `${randomRange(-50, 20).toFixed(0)}px`);
        glint.style.animationDelay = `${Math.round(delayMs + randomRange(0, 900))}ms`;
        glint.style.animationDuration = `${Math.round(randomRange(1300, 2000))}ms`;
        veil.appendChild(glint);
    }
    document.body.appendChild(veil);
    setTimeout(() => veil.remove(), delayMs + 3200);
}

// ── Lumi flies home ──────────────────────────────────────────────────
// When the header's little Lumi can be seen (desktop and tablet; phones hide
// her), the woosh does not leave the screen: Lumi swoops low over the hills,
// sprinkling stardust, climbs, curls in under the title and lands exactly
// where the header Lumi starts her trip, at her size and moving with her
// speed, and becomes her (styles/header_flourish.css, .gcq-pixie).
//
// The scene melts away while she is in the air, so she flies in her own fixed
// layer above the app (a "courier" copy, painted with its own gradients so it
// never depends on the hidden screen). The header Lumi's own CSS animations
// are paused at the hand-off point (3% of her cycle, fully shown) while the
// courier flies, then they play on from there: the same flight, unbroken.

const PIXIE_CYCLE_MS = 26000;
const PIXIE_HANDOFF_AT = 0.03; // of her cycle: faded in, full size
const HOME_WINDUP_MS = 280;
const HOME_FLIGHT_MS = 1950;
const HOME_TAIL_MS = 220; // courier and header Lumi overlap, moving together

const COURIER_LUMI_SVG = LUMI_SVG
    .replace('<svg class="lumi" viewBox="0 0 100 100" focusable="false">', `<svg class="lumi" viewBox="0 0 100 100" focusable="false"><defs>
        <radialGradient id="gcq-courier-body" cx="0.42" cy="0.35" r="0.75"><stop offset="0" stop-color="#fffbe0"/><stop offset="0.45" stop-color="#ffe066"/><stop offset="0.85" stop-color="#ffb938"/><stop offset="1" stop-color="#f59e0b"/></radialGradient>
        <radialGradient id="gcq-courier-shine"><stop offset="0" stop-color="#ffffff" stop-opacity="0.85"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
        <path id="gcq-courier-star" d="${LUMI_STAR_PATH}"/></defs>`)
    .replace('href="#lumi-star"', 'href="#gcq-courier-star"')
    .replace('url(#lumi-body)', 'url(#gcq-courier-body)')
    .replace('url(#lumi-shine)', 'url(#gcq-courier-shine)');

function centerOf(rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** The header Lumi that can be seen right now, paused at the hand-off point, or null. */
function catchHeaderLumi() {
    if (prefersReducedMotion() || typeof Element === 'undefined' || !Element.prototype.getAnimations) return null;
    const lanes = [...document.querySelectorAll('.gcq-pixie-lane')];
    for (const lane of lanes) {
        const box = lane.getBoundingClientRect();
        if (!box.width || !box.height || box.bottom < 0 || box.top > window.innerHeight * 0.5) continue;
        const body = lane.querySelector('.gcq-pixie__lumi');
        const pixie = lane.querySelector('.gcq-pixie');
        if (!body || !pixie) continue;
        const swashStar = lane.parentElement?.querySelector('.gcq-swash__star');
        const anims = [...lane.getAnimations({ subtree: true }), ...(swashStar?.getAnimations() || [])];
        const flyAnim = pixie.getAnimations().find(a => a.animationName === 'gcq-pixie-fly');
        if (!flyAnim) continue;
        const base = Number(flyAnim.effect?.getTiming?.().delay) || 0;
        const handoff = base + PIXIE_CYCLE_MS * PIXIE_HANDOFF_AT;
        // Every part of her cycle (and the swash star's flare) to the same
        // moment; her sway to its middle, where she is upright.
        const seek = (offset) => anims.forEach((a) => {
            const timing = a.effect?.getTiming?.() || {};
            a.pause();
            a.currentTime = Number(timing.duration) === PIXIE_CYCLE_MS ? handoff + offset : Number(timing.duration) / 2;
        });
        seek(120);
        const ahead = centerOf(body.getBoundingClientRect());
        seek(0);
        const rect = body.getBoundingClientRect();
        if (!rect.width) { anims.forEach(a => a.play()); continue; }
        const at = centerOf(rect);
        lane.style.opacity = '0';
        return {
            lane,
            anims,
            x: at.x,
            y: at.y,
            size: rect.width,
            vx: (ahead.x - at.x) / 0.12,
            vy: (ahead.y - at.y) / 0.12,
        };
    }
    return null;
}

/** Hermite spline through timed points with set velocities (px/ms). */
function hermiteAt(keys, t) {
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1].t) i += 1;
    const a = keys[i];
    const b = keys[i + 1];
    const d = b.t - a.t;
    const u = Math.min(1, Math.max(0, (t - a.t) / d));
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    const dh00 = 6 * u2 - 6 * u;
    const dh10 = 3 * u2 - 4 * u + 1;
    const dh01 = -6 * u2 + 6 * u;
    const dh11 = 3 * u2 - 2 * u;
    const smooth = u2 * (3 - 2 * u);
    return {
        x: h00 * a.x + h10 * d * a.vx + h01 * b.x + h11 * d * b.vx,
        y: h00 * a.y + h10 * d * a.vy + h01 * b.y + h11 * d * b.vy,
        vx: (dh00 * a.x + dh10 * d * a.vx + dh01 * b.x + dh11 * d * b.vx) / d,
        vy: (dh00 * a.y + dh10 * d * a.vy + dh01 * b.y + dh11 * d * b.vy) / d,
        scale: a.s + (b.s - a.s) * smooth,
    };
}

/** Where she is on the loading screen right now: centre, size, tilt, scale. */
function lumiPoseNow(loadingScreen) {
    const box = loadingScreen.querySelector('.loading-lumi');
    if (!box) return null;
    const rect = box.getBoundingClientRect();
    if (!rect.width) return null;
    let m = new DOMMatrix();
    const w = rect.width;
    const h = rect.height;
    // hop (origin 50% 70%), then float (origin 50% 50%), as nested in the markup
    [['.loading-lumi__hop', 0.7], ['.loading-lumi__float', 0.5]].forEach(([sel, oy]) => {
        const el = box.querySelector(sel);
        const t = el ? getComputedStyle(el).transform : 'none';
        if (!t || t === 'none') return;
        m = m.translate(w / 2, h * oy).multiply(new DOMMatrix(t)).translate(-w / 2, -h * oy);
    });
    const c = m.transformPoint(new DOMPoint(w / 2, h / 2));
    return {
        x: rect.left + c.x,
        y: rect.top + c.y,
        size: w,
        rot: Math.atan2(m.b, m.a) * 180 / Math.PI,
        scale: Math.hypot(m.a, m.b),
    };
}

function flyLumiHome(loadingScreen, home) {
    const from = lumiPoseNow(loadingScreen);
    if (!from) return false;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const lowPower = detectLowPowerTier();
    const size = from.size;
    const endScale = home.size / size;
    const T = HOME_FLIGHT_MS;
    const v = { x: home.vx / 1000, y: home.vy / 1000 };
    // The route, in screen pixels and ms from take-off: back and down, low
    // over the hills towards us, up the far side, across, and in under the
    // title to curl up into her starting point.
    const keys = [
        { t: 0, x: from.x, y: from.y, vx: -0.45 * W / 1000, vy: 0.75 * H / 1000, s: from.scale },
        { t: T * 0.25, x: 0.24 * W, y: 0.72 * H, vx: 1.05 * W / 1000, vy: 0.2 * H / 1000, s: 1.35 },
        { t: T * 0.46, x: 0.68 * W, y: 0.7 * H, vx: 0.8 * W / 1000, vy: -0.95 * H / 1000, s: 1.75 },
        { t: T * 0.66, x: 0.8 * W, y: 0.26 * H, vx: -0.55 * W / 1000, vy: -0.45 * H / 1000, s: 0.95 },
        { t: T * 0.86, x: home.x + Math.min(90, 0.08 * W), y: home.y + 64, vx: -0.3, vy: -0.06, s: endScale * 1.7 },
        { t: T, x: home.x, y: home.y, vx: v.x, vy: v.y, s: endScale },
    ];
    // A short tail past the hand-off, moving on with the header Lumi.
    keys.push({ t: T + HOME_TAIL_MS, x: home.x + v.x * HOME_TAIL_MS, y: home.y + v.y * HOME_TAIL_MS, vx: v.x, vy: v.y, s: endScale });

    const layer = document.createElement('div');
    layer.className = 'gcq-lumi-courier';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = `
        <div class="gcq-lumi-courier__fly" style="width:${size}px;height:${size}px">
            <span class="loading-lumi__trail gcq-lumi-courier__trail"></span>
            <div class="gcq-lumi-courier__body">
                <span class="loading-lumi__halo gcq-lumi-courier__halo"></span>
                ${COURIER_LUMI_SVG}
            </div>
        </div>
        <div class="gcq-lumi-courier__dust"></div>`;
    document.body.appendChild(layer);
    const fly = layer.querySelector('.gcq-lumi-courier__fly');
    const body = layer.querySelector('.gcq-lumi-courier__body');
    const trail = layer.querySelector('.gcq-lumi-courier__trail');
    const halo = layer.querySelector('.gcq-lumi-courier__halo');
    const cheer = layer.querySelector('.lumi__cheer');
    const smile = layer.querySelector('.lumi__smile');
    // She takes over from the screen's Lumi in the same frame.
    const screenLumi = loadingScreen.querySelector('.loading-lumi');
    if (screenLumi) screenLumi.style.visibility = 'hidden';

    const total = HOME_WINDUP_MS + T + HOME_TAIL_MS;
    const off = (ms) => Math.min(1, ms / total);
    const pos = (x, y) => `translate3d(${r1(x - size / 2)}px, ${r1(y - size / 2)}px, 0)`;
    const flyFrames = [{ offset: 0, transform: pos(from.x, from.y) }, { offset: off(HOME_WINDUP_MS), transform: pos(from.x, from.y) }];
    const s0 = from.scale;
    const bodyFrames = [
        { offset: 0, transform: `rotate(${r1(from.rot)}deg) scale(${r1(s0)})` },
        { offset: off(HOME_WINDUP_MS * 0.6), transform: `rotate(0deg) scale(${r1(s0 * 1.18)}, ${r1(s0 * 0.8)})` },
        { offset: off(HOME_WINDUP_MS), transform: `rotate(0deg) scale(${r1(s0 * 0.9)}, ${r1(s0 * 1.12)})` },
    ];
    const trailFrames = [{ offset: 0, opacity: 0, transform: 'rotate(180deg) scale(0, 1)' }, { offset: off(HOME_WINDUP_MS), opacity: 0, transform: 'rotate(180deg) scale(0, 1)' }];
    const STEPS = lowPower ? 40 : 64;
    const fullSpeed = 1.2 * W / 1000;
    for (let k = 1; k <= STEPS; k += 1) {
        const t = (T + HOME_TAIL_MS) * (k / STEPS);
        const p = hermiteAt(keys, t);
        const offset = off(HOME_WINDUP_MS + t);
        const speed = Math.hypot(p.vx, p.vy);
        const heading = Math.atan2(p.vy, p.vx) * 180 / Math.PI;
        // One joyful spin over the swoop; a lean into the turns that settles
        // to upright as she lands.
        const spinU = Math.min(1, t / (T * 0.6));
        const spin = 360 * (spinU * spinU * (3 - 2 * spinU));
        const settle = Math.min(1, Math.max(0, (T - t) / (T * 0.25)));
        const lean = Math.max(-16, Math.min(16, p.vx / fullSpeed * 16)) * settle;
        flyFrames.push({ offset, transform: pos(p.x, p.y) });
        bodyFrames.push({ offset, transform: `rotate(${r1(spin + lean)}deg) scale(${r1(p.scale)})` });
        const tail = Math.min(1.5, speed / fullSpeed * 1.3) * Math.min(1, settle * 1.4);
        trailFrames.push({
            offset,
            opacity: r1(Math.min(1, tail * 1.2)),
            transform: `rotate(${r1(heading + 180)}deg) scale(${r1(tail * p.scale)}, ${r1(p.scale)})`,
        });
    }
    const timing = { duration: total, fill: 'forwards', easing: 'linear' };
    const flight = fly.animate(flyFrames, timing);
    body.animate(bodyFrames, timing);
    trail.animate(trailFrames, timing);
    halo.animate([
        { offset: 0, opacity: 1 },
        { offset: off(HOME_WINDUP_MS + T * 0.66), opacity: 0.85 },
        { offset: off(HOME_WINDUP_MS + T), opacity: 0.4 },
        { offset: 1, opacity: 0 },
    ], timing);
    // Her hooray turns back into her quiet smile as she comes in to land.
    const faceAt = off(HOME_WINDUP_MS + T * 0.7);
    const faceTo = off(HOME_WINDUP_MS + T * 0.8);
    cheer?.animate([{ offset: 0, opacity: 1 }, { offset: faceAt, opacity: 1 }, { offset: faceTo, opacity: 0 }, { offset: 1, opacity: 0 }], timing);
    smile?.animate([{ offset: 0, opacity: 0 }, { offset: faceAt, opacity: 0 }, { offset: faceTo, opacity: 1 }, { offset: 1, opacity: 1 }], timing);
    // She hands over while both move together.
    layer.animate([{ opacity: 1 }, { offset: off(HOME_WINDUP_MS + T + 50), opacity: 1 }, { opacity: 0 }], timing);

    // Stardust along the way, each grain dropped as she passes.
    const dust = layer.querySelector('.gcq-lumi-courier__dust');
    const count = lowPower ? 18 : 34;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
        const t = T * 0.9 * ((i + 0.5) / count);
        const p = hermiteAt(keys, t);
        const glint = makeGlint('loading-stardust');
        glint.innerHTML = GLINT_WARM_SVG;
        glint.style.left = `${Math.round(p.x + randomRange(-16, 16) * p.scale)}px`;
        glint.style.top = `${Math.round(p.y + randomRange(-12, 12) * p.scale)}px`;
        const grain = randomRange(11, 22) * Math.max(0.55, Math.min(1.6, p.scale));
        glint.style.width = `${grain.toFixed(0)}px`;
        glint.style.height = `${grain.toFixed(0)}px`;
        glint.style.setProperty('--fall', `${randomRange(50, 150).toFixed(0)}px`);
        glint.style.setProperty('--drift', `${randomRange(-30, 30).toFixed(0)}px`);
        glint.style.animationDelay = `${Math.round(HOME_WINDUP_MS + t)}ms`;
        frag.appendChild(glint);
    }
    dust.appendChild(frag);

    // The hand-off: the header Lumi plays on from the very spot and moment.
    // Timed on her flight's own clock (it can start a frame or two late while
    // the layer first paints), so the hand-off lands on the exact frame. Not
    // tied to later(): reopening the screen must never strand her paused.
    let handedOff = false;
    const handOff = () => {
        if (handedOff) return;
        handedOff = true;
        home.lane.style.transition = `opacity ${HOME_TAIL_MS}ms linear`;
        home.lane.style.opacity = '1';
        home.anims.forEach(a => a.play());
    };
    const landAt = HOME_WINDUP_MS + T;
    const watch = () => {
        if (handedOff) return;
        if ((Number(flight.currentTime) || 0) >= landAt - 24) handOff();
        else requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
    setTimeout(handOff, HOME_WINDUP_MS + T + 1500); // a background tab may never finish the clock
    setTimeout(() => {
        home.lane.style.transition = '';
        home.lane.style.opacity = '';
    }, total + 200);
    setTimeout(() => layer.remove(), total + 1600);
    return true;
}

function clearExitTimers() {
    _exitTimers.forEach(clearTimeout);
    _exitTimers = [];
}

function later(ms, fn) {
    _exitTimers.push(setTimeout(fn, ms));
}

/** Milliseconds until the scene starts melting into the next screen (0 once it has). */
export function loadingRevealEta() {
    if (!_revealAt) return 0;
    return Math.max(0, Math.round(_revealAt - performance.now()));
}

/**
 * The hand-over, from start to finish: the Welcome (when there is one), the
 * woosh, the stardust, dawn, and the screen hidden at the end. A very early
 * call waits for the reveal (see FILM_CUTS). Returns the milliseconds until the
 * scene starts melting, so the screen underneath can time its entrance.
 * onHidden runs once the screen is gone.
 */
export function playLoadingExit(loadingScreen, { schoolName = '', dayPart = '', onHidden } = {}) {
    if (!loadingScreen) return 0;
    clearExitTimers();
    if (loadingScreen.classList.contains('hidden')) {
        // Already out of sight (e.g. signing out): nothing to play.
        loadingScreen.classList.add('opacity-0', 'pointer-events-none');
        _revealAt = 0;
        return 0;
    }
    clearTimeout(_trickTimer);
    const reduced = prefersReducedMotion();
    const sinceShown = performance.now() - _shownAt;
    const hasWelcome = Boolean(_stagedPersonalization);
    const timing = cutTiming();
    // The Welcome arrives at the reveal, never before; with no Welcome the
    // woosh waits until the title and the crest have been seen.
    let landAt = hasWelcome ? timing.reveal : timing.signedOutMin;
    // A line under the title that has begun rising gets its moment, read in
    // full, before the Welcome takes its place (never a flash).
    const lineDone = timing.lineStart + LINE_RISE_MS + timing.lineDwell;
    if (hasWelcome && sinceShown >= timing.lineStart && sinceShown < lineDone) landAt = Math.max(landAt, lineDone);
    const landWait = reduced ? 0 : Math.max(0, landAt - sinceShown);
    const hold = hasWelcome ? (reduced ? WELCOME_HOLD_REDUCED_MS : timing.hold) : 0;
    const wooshAt = landWait + hold;
    const revealIn = wooshAt + (reduced ? 0 : WOOSH_REVEAL_AT_MS);
    const goneIn = wooshAt + (reduced ? REDUCED_FADE_MS : WOOSH_GONE_AT_MS);
    _revealAt = performance.now() + revealIn;

    const welcome = () => revealStagedLoadingPersonalization({ schoolName, dayPart });
    if (hasWelcome) {
        if (landWait) later(landWait, welcome); else welcome();
    }

    later(wooshAt, () => {
        loadingScreen.classList.remove('loading-screen-from-gate');
        if (!reduced) {
            let home = null;
            let flewHome = false;
            try {
                home = catchHeaderLumi();
                if (home) flewHome = flyLumiHome(loadingScreen, home);
            } catch (error) {
                console.warn('Lumi could not fly home:', error);
            }
            if (home && !flewHome) {
                // Something failed after the header Lumi was caught: let her be.
                home.lane.style.opacity = '';
                home.anims.forEach(a => a.play());
            }
            if (!flewHome) {
                try {
                    const plan = planWoosh(loadingScreen);
                    if (plan) {
                        animateWoosh(loadingScreen, plan);
                        sprinkleWooshDust(loadingScreen, plan);
                    }
                } catch { /* she just fades with the scene */ }
            }
            sprinkleStardustVeil(WOOSH_REVEAL_AT_MS - 150, { even: flewHome });
        }
        loadingScreen.classList.add('loading-screen-exit');
    });
    later(revealIn, () => loadingScreen.classList.add('loading-revealing'));
    later(goneIn, () => {
        loadingScreen.classList.add('opacity-0', 'pointer-events-none', 'hidden');
        _revealAt = 0;
        try { onHidden?.(); } catch (error) { console.error(error); }
    });
    return revealIn;
}

/**
 * Bring the loading screen back for a real login/signup/activation that just
 * happened from the visible sign-in screen. It was already dismissed once on
 * cold boot; this resets that state so Lumi can arrive again. The user is
 * signed in, so the first star is lit.
 * fromGate: the sign-in gate has just opened into daylight (ui/authGate.js);
 * the screen appears inside that light and dusk falls as the stars come out.
 */
let fromGateTimer = 0;

export function reopenLoadingScreen({ fromGate = false } = {}) {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;
    clearExitTimers();
    _revealAt = 0;
    loadingScreen.dataset.exiting = '';
    loadingScreen.classList.remove('loading-screen-exit', 'loading-revealing', 'loading-final-moment', 'loading-early-welcome', 'loading-screen-from-gate', 'hidden');
    applyFilmCut(loadingFilmCut());
    // Time has passed since the first paint: the sky catches up.
    paintLoadingSky(loadingScreen, { mobile: isMobileLoadingViewport(), lowPower: detectLowPowerTier() });
    _shownAt = performance.now();
    loadingScreen.style.setProperty('--since', '0ms');
    const screenLumi = loadingScreen.querySelector('.loading-lumi');
    if (screenLumi) screenLumi.style.visibility = '';
    loadingScreen.querySelectorAll('.loading-lumi__fly, .loading-lumi__pose, .loading-lumi__trail').forEach((el) => {
        // Only the woosh's Web Animations: cancelling a CSS animation would stop
        // her arrival from ever playing again.
        el.getAnimations?.().forEach((animation) => {
            if (typeof CSSAnimation === 'undefined' || !(animation instanceof CSSAnimation)) animation.cancel();
        });
    });
    clearTimeout(fromGateTimer);
    if (fromGate) {
        loadingScreen.classList.add('loading-screen-from-gate');
        fromGateTimer = setTimeout(() => loadingScreen.classList.remove('loading-screen-from-gate'), 2400);
    }
    document.getElementById('loading-greeting')?.classList.remove('loading-greeting-visible');
    loadingPart('.loading-lumi__hop')?.classList.remove('is-hop', 'is-cheer', 'is-cast', ...TRICKS);
    const dust = loadingPart('.loading-dust');
    if (dust) dust.innerHTML = '';
    loadingScreen.querySelectorAll('.loading-path .is-on').forEach((el) => el.classList.remove('is-on'));
    clearTimeout(_castTimer);
    _castTimer = 0;
    _loadingStep = 0;
    _litStep = 0;
    markLoadingStage(1, { quiet: true });
    scheduleLumiTricks();
    void loadingScreen.offsetWidth; // flush the display change before animating opacity
    requestAnimationFrame(() => {
        loadingScreen.classList.remove('opacity-0', 'pointer-events-none');
    });
}
