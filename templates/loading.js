import { detectLowPowerTier as sharedLowPowerTier } from '../utils/devicePerformance.mjs';
import { cloudSvg, cloudVariantCount } from '../features/skyWeatherArt.js';
import { createTipDeck } from './loadingTips.mjs';
// templates/loading.js

let _tipIntervalId = null;
let _stagedPersonalization = null;
let _isLowPowerDevice = null;
let _loadingStep = 0;
// When the screen last appeared, so a very early woosh knows Lumi is still arriving.
let _shownAt = 0;
const TIP_ROTATE_MS = 4600;
const TIP_FADE_MS = 420;
// Longest we hold the words back waiting for the storybook font. Past this the
// fallback font shows rather than leaving a wordless screen on slow networks.
const FONT_WAIT_MS = 1200;
// Same breakpoint as the phone shell (mobile/index.js → body.gcq-mobile).
const MOBILE_LOADING_QUERY = '(max-width: 1023px)';
const LOADING_LOGO_URL = new URL('../assets/great-class-quest-logo.svg', import.meta.url).href;

// ── Sun and ring artwork ─────────────────────────────────────────────
// Built once as static SVG strings. Each moving part sits in its own layer
// and only ever animates transform/opacity, so none of it needs repainting
// while the app boots behind the loading screen.

const r1 = (n) => Math.round(n * 100) / 100;

function polar(cx, cy, r, deg) {
    const a = (deg * Math.PI) / 180;
    return { x: r1(cx + r * Math.sin(a)), y: r1(cy - r * Math.cos(a)) };
}

/** A tapered sunbeam with a rounded tip, pointing straight up (rotated into place). */
function sunRayPath(inner, outer, halfWidth) {
    const tip = r1(halfWidth * 0.32);
    const shoulder = r1(outer - tip);
    return `M ${-halfWidth} ${-inner} L ${-tip} ${-shoulder} A ${tip} ${tip} 0 0 1 ${tip} ${-shoulder} L ${halfWidth} ${-inner} Z`;
}

function sunRays({ count, offset, inner, outer, halfWidth, fill }) {
    const d = sunRayPath(inner, outer, halfWidth);
    return Array.from({ length: count }, (_, i) =>
        `<path d="${d}" fill="${fill}" transform="rotate(${r1(offset + (360 / count) * i)})"/>`).join('');
}

const SUN_LONG_RAYS_SVG = `
    <svg viewBox="-100 -100 200 200" focusable="false">
        <defs>
            <radialGradient id="ls-ray-long" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="92">
                <stop offset="0.48" stop-color="#fcd34d" stop-opacity="1"/>
                <stop offset="0.78" stop-color="#fbbf24" stop-opacity="0.7"/>
                <stop offset="1" stop-color="#f59e0b" stop-opacity="0.08"/>
            </radialGradient>
        </defs>
        ${sunRays({ count: 12, offset: 0, inner: 46, outer: 90, halfWidth: 11, fill: 'url(#ls-ray-long)' })}
    </svg>`;

const SUN_SHORT_RAYS_SVG = `
    <svg viewBox="-100 -100 200 200" focusable="false">
        <defs>
            <radialGradient id="ls-ray-short" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="72">
                <stop offset="0.62" stop-color="#fef9c3" stop-opacity="1"/>
                <stop offset="1" stop-color="#fde68a" stop-opacity="0.15"/>
            </radialGradient>
        </defs>
        ${sunRays({ count: 12, offset: 15, inner: 46, outer: 70, halfWidth: 8, fill: 'url(#ls-ray-short)' })}
    </svg>`;

// Same palette and build as the home greeting's day-ring sun (warm cream
// core → sunflower → amber rim, white rim line), drawn larger with more detail.
const SUN_DISC_SVG = `
    <svg viewBox="-100 -100 200 200" focusable="false">
        <defs>
            <radialGradient id="ls-corona" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="62">
                <stop offset="0.72" stop-color="#fffbeb" stop-opacity="0.95"/>
                <stop offset="1" stop-color="#fde68a" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="ls-disc" cx="0.38" cy="0.35" r="0.72">
                <stop offset="0" stop-color="#fffbeb"/>
                <stop offset="0.42" stop-color="#fde047"/>
                <stop offset="0.82" stop-color="#fbbf24"/>
                <stop offset="1" stop-color="#f59e0b"/>
            </radialGradient>
            <radialGradient id="ls-sheen" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stop-color="#ffffff" stop-opacity="0.75"/>
                <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <circle r="62" fill="url(#ls-corona)"/>
        <circle r="47" fill="url(#ls-disc)"/>
        <circle r="39" fill="none" stroke="#fffbeb" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="2.5 6" stroke-linecap="round"/>
        <ellipse cx="-15" cy="-17" rx="17" ry="11" fill="url(#ls-sheen)" transform="rotate(-38 -15 -17)"/>
        <circle r="47" fill="none" stroke="#ffffff" stroke-opacity="0.9" stroke-width="2.4"/>
        <circle r="51.5" fill="none" stroke="#fde68a" stroke-opacity="0.6" stroke-width="1.1"/>
    </svg>`;

const LOADING_SUN_HTML = `
    <div class="loading-sun" aria-hidden="true">
        <div class="loading-sun__body">
            <span class="loading-sun__halo"></span>
            <span class="loading-sun__bloom"></span>
            <span class="loading-sun__rays loading-sun__rays--long">${SUN_LONG_RAYS_SVG}</span>
            <span class="loading-sun__rays loading-sun__rays--short">${SUN_SHORT_RAYS_SVG}</span>
            <span class="loading-sun__disc">${SUN_DISC_SVG}</span>
            <span class="loading-sun__flare"></span>
        </div>
    </div>`;

// ── Lumi, the guiding star ───────────────────────────────────────────
// The app's mascot: a golden, rounded five-point star with a face, drawn from
// the official artwork (roundedStarPath(.52, .3) on a 100-unit box). She is
// one small SVG painted once; every move she makes is a transform or opacity
// change on one of the wrappers around her (styles/loading2.css), so she stays
// smooth while the app boots on the main thread.
const LUMI_STAR_PATH = 'M45.4 8.7Q50 0 54.6 8.7L60.7 20.3Q65.3 29 75 30.6L87.9 32.9Q97.6 34.5 90.7 41.6L81.6 51Q74.7 58 76.1 67.8L78 80.7Q79.4 90.5 70.6 86.1L58.8 80.3Q50 76 41.2 80.3L29.4 86.1Q20.6 90.5 22 80.7L23.9 67.8Q25.3 58 18.4 51L9.3 41.6Q2.4 34.5 12.1 32.9L25 30.6Q34.7 29 39.3 20.3Z';

const LUMI_EYE = '<ellipse rx="4.4" ry="5.8" fill="#2b2250"/><circle cx="1.5" cy="-2.2" r="1.7" fill="#fff"/><circle cx="-1.4" cy="2" r="0.8" fill="#fff" opacity="0.8"/>';

// Two mouths: her quiet smile, and the open "hooray" she wears for the Welcome and the woosh.
const LUMI_SVG = `
    <svg class="lumi" viewBox="0 0 100 100" focusable="false">
        <use href="#lumi-star" fill="url(#lumi-body)" stroke="#f2a516" stroke-width="1.4" stroke-linejoin="round"/>
        <ellipse cx="38" cy="30" rx="12" ry="7" fill="url(#lumi-shine)" transform="rotate(-32 38 30)"/>
        <ellipse cx="36.5" cy="62" rx="5.2" ry="3.2" fill="#ff8fa3" opacity="0.55"/>
        <ellipse cx="63.5" cy="62" rx="5.2" ry="3.2" fill="#ff8fa3" opacity="0.55"/>
        <g class="lumi__eyes">
            <g transform="translate(42 54)">${LUMI_EYE}</g>
            <g transform="translate(58 54)">${LUMI_EYE}</g>
        </g>
        <path class="lumi__smile" d="M45.5 62.5Q50 66.5 54.5 62.5" stroke="#8a3a2a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        <g class="lumi__cheer">
            <path d="M45 62Q50 63.2 55 62Q54 68 50 68.9Q46 68 45 62Z" fill="#7a2e2e"/>
            <ellipse cx="50" cy="67" rx="2.6" ry="1.2" fill="#ff7b8a"/>
        </g>
    </svg>`;

/** A small star on the quest path: a pale outline, and a gold copy that lights up over it. */
const PATH_STAR_HTML = `
    <span class="loading-path__star">
        <svg class="loading-path__dim" viewBox="0 0 100 100" focusable="false"><use href="#lumi-star"/></svg>
        <svg class="loading-path__lit" viewBox="0 0 100 100" focusable="false"><use href="#lumi-star" fill="url(#lumi-body)" stroke="#f2a516" stroke-width="3"/></svg>
    </span>`;

// ── Sky travellers and finale glints ─────────────────────────────────
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
            <radialGradient id="lb-shade" cx="0.36" cy="0.3" r="0.75">
                <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
                <stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/>
                <stop offset="1" stop-color="#0f172a" stop-opacity="0.22"/>
            </radialGradient>
            <radialGradient id="ls-beam" gradientUnits="userSpaceOnUse" cx="1000" cy="0" r="1350">
                <stop offset="0" stop-color="#fffbeb" stop-opacity="0.8"/>
                <stop offset="0.3" stop-color="#fef3c7" stop-opacity="0.3"/>
                <stop offset="0.8" stop-color="#fef3c7" stop-opacity="0"/>
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
            <path id="lumi-star" d="${LUMI_STAR_PATH}"/>
        </defs>
    </svg>`;

/** A four-point sparkle with a soft glow. */
const GLINT_SVG = `
    <svg viewBox="-12 -12 24 24" focusable="false">
        <circle r="8" fill="url(#lg-glint-glow)"/>
        <path d="M0 -11 C0.9 -2.4 2.4 -0.9 11 0 C2.4 0.9 0.9 2.4 0 11 C-0.9 2.4 -2.4 0.9 -11 0 C-2.4 -0.9 -0.9 -2.4 0 -11 Z" fill="url(#lg-glint-star)"/>
    </svg>`;

/**
 * A band of light that sweeps across a line of words. Only the band and a
 * copy of the words inside it move, in opposite directions, so the copy stays
 * locked over the real words while the band slides: two plain translations,
 * run by the compositor, with nothing repainted (styles/loading2.css).
 */
function sheenHTML(innerHTML) {
    return `<span class="gcq-sheen" aria-hidden="true"><span class="gcq-sheen__band"><span class="gcq-sheen__text">${innerHTML}</span></span></span>`;
}

const LOADING_TITLE_TEXT = 'The Great Class Quest';
// The app's own promise, as on the plan screen (templates/subscribe.js).
const LOADING_TAGLINE = 'Turn every lesson into an adventure';

function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * The Welcome, one letter per span so the letters can rise in a wave. Words
 * stay unbroken (each is its own inline-block) and wrap at the spaces. The
 * same markup is used for the ink, its glow and its sheen, so all three lay
 * out letter for letter on top of each other.
 */
function greetingLettersHTML(text) {
    let index = 0;
    return text.split(' ').map((word) => {
        const letters = Array.from(word).map((ch) =>
            `<span class="lg-l" style="--i:${index++}"><span class="lg-l__ink">${escapeHTML(ch)}</span></span>`).join('');
        return `<span class="lg-w">${letters}</span>`;
    }).join(' ');
}

function glints(className, count) {
    return Array.from({ length: count }, (_, i) =>
        `<span class="loading-glint ${className}-${i + 1}">${GLINT_SVG}</span>`).join('');
}

// Long soft shafts of light falling from the sun towards the lower left.
// The box's top-right corner sits on the sun's centre (styles/loading.css).
const SUNBEAMS_SVG = `
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" focusable="false">
        ${[[194, 4], [210, 5.5], [227, 3.5], [244, 4.5]].map(([a, half]) =>
            // Three nested wedges per beam fake a soft edge without any blur.
            [[1.9, 0.28], [1.1, 0.4], [0.45, 0.5]].map(([w, o]) => {
                const p0 = polar(1000, 0, 1400, a - half * w);
                const p1 = polar(1000, 0, 1400, a + half * w);
                return `<path d="M 1000 0 L ${p0.x} ${p0.y} L ${p1.x} ${p1.y} Z" fill="url(#ls-beam)" fill-opacity="${o}"/>`;
            }).join('')).join('')}
    </svg>`;

// Hot-air balloons: striped gores, a gold crown band, ropes and a wicker basket.
const BALLOON_PALETTES = [
    { a: '#fb7185', b: '#fff1f2', band: '#f59e0b' },
    { a: '#38bdf8', b: '#f0f9ff', band: '#fbbf24' },
    { a: '#a78bfa', b: '#faf5ff', band: '#f472b6' },
    { a: '#34d399', b: '#ecfdf5', band: '#fbbf24' },
    { a: '#fb923c', b: '#fff7ed', band: '#0ea5e9' },
];

function balloonSvg(palette, id) {
    const envelope = 'M30 2 C47 2 58 15 58 30 C58 44 47 53 39 61 L21 61 C13 53 2 44 2 30 C2 15 13 2 30 2 Z';
    return `
    <svg viewBox="0 0 60 84" focusable="false">
        <defs><clipPath id="lb-clip-${id}"><path d="${envelope}"/></clipPath></defs>
        <path d="M23 61 L25.5 72 M37 61 L34.5 72 M30 61 L30 72" stroke="#7c5a3a" stroke-width="0.9" stroke-opacity="0.75"/>
        <g clip-path="url(#lb-clip-${id})">
            <rect x="0" y="0" width="60" height="64" fill="${palette.a}"/>
            <ellipse cx="30" cy="30" rx="18.5" ry="36" fill="${palette.b}"/>
            <ellipse cx="30" cy="30" rx="7.5" ry="36" fill="${palette.a}"/>
            <rect x="0" y="52" width="60" height="4.5" fill="${palette.band}"/>
            <rect x="0" y="0" width="60" height="64" fill="url(#lb-shade)"/>
        </g>
        <path d="${envelope}" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"/>
        <rect x="24" y="72" width="12" height="9" rx="2" fill="#b7791f"/>
        <path d="M24.5 75.5 H35.5 M24.5 78.5 H35.5" stroke="#8a5a14" stroke-width="0.8" stroke-opacity="0.7"/>
        <rect x="23.4" y="71.2" width="13.2" height="2.2" rx="1.1" fill="#d69e2e"/>
    </svg>`;
}

const BIRD_SVG = `
    <svg viewBox="0 0 26 10" focusable="false">
        <path d="M1 7.5 Q4 2.2 8 3.4 Q11 4.4 13 7.5 Q15 4.4 18 3.4 Q22 2.2 25 7.5 Q21.5 5 18 5.6 Q15 6.2 13 9 Q11 6.2 8 5.6 Q4.5 5 1 7.5 Z" fill="#334e6f"/>
    </svg>`;

function randomInt(max) {
    return Math.floor(Math.random() * max);
}

function randomRange(min, max) {
    return min + (Math.random() * (max - min));
}

/**
 * Best-effort, cached detection of constrained hardware so the loading scene
 * can automatically shed its costliest filter/blur work on weaker laptops
 * while keeping full visual density on capable machines. Never throws.
 */
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

/**
 * Keep the words hidden until Fredoka One is ready, then let them rise in once.
 * Without this the title, subtitle and tip paint in a fallback font first and
 * visibly "flash" when the web font swaps in.
 */
function revealLoadingTextWhenFontsReady(loadingScreen) {
    if (!loadingScreen) return;
    loadingScreen.classList.add('loading-fonts-pending');
    let revealed = false;
    const reveal = () => {
        if (revealed) return;
        revealed = true;
        requestAnimationFrame(() => {
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

export const loadingHTML = `
    <div id="loading-screen"
        class="fixed inset-0 flex flex-col items-center justify-center z-[1100]"
        style="background: linear-gradient(180deg, #E8F6FF 0%, #BFE8FB 42%, #8FDCEF 68%, #CFF3DC 100%);">

        ${LOADING_DEFS_SVG}
        <div class="loading-sky-glow" aria-hidden="true"></div>
        ${LOADING_SUN_HTML}

        <!-- Storybook clouds, the same shapes as the app's sky (built in initLoadingAtmosphere) -->
        <div class="loading-cloud-art-layer" aria-hidden="true"></div>

        <!-- Light falling from the sun -->
        <div class="loading-sunbeams" aria-hidden="true">
            <div class="loading-sunbeams__glow">${SUNBEAMS_SVG}</div>
        </div>

        <!-- Sky travellers: hot-air balloons and flocks (built in initLoadingAtmosphere) -->
        <div class="loading-balloons" aria-hidden="true"></div>
        <div class="loading-birds" aria-hidden="true"></div>

        <!-- Slow twinkles scattered across the sky -->
        <div class="loading-twinkles" aria-hidden="true">${glints('lt', 7)}</div>

        <!-- Center content: Lumi, the words, the quest path and the tip -->
        <div class="loading-stage">
            <!-- Lumi. Each wrapper owns one kind of move (styles/loading2.css):
                 the woosh across the sky (x, then y), her arrival and spin,
                 hops and cheers, and the idle float. -->
            <div class="loading-lumi" aria-hidden="true">
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
            </div>

            <!-- The title and the Welcome share one cell, so swapping them never moves the stage -->
            <div class="loading-words">
                <div class="loading-heading">
                    <h1 class="loading-title" data-text="${LOADING_TITLE_TEXT}">
                        <span class="loading-title__ink">${LOADING_TITLE_TEXT}</span>
                        ${sheenHTML(LOADING_TITLE_TEXT)}
                    </h1>
                    <div class="loading-crest" aria-hidden="true">
                        <span class="loading-crest__line"></span>
                        <img class="loading-crest__logo" src="${LOADING_LOGO_URL}" alt="" />
                        <span class="loading-crest__line"></span>
                    </div>
                    <p class="loading-tagline">${LOADING_TAGLINE}</p>
                </div>

                <div id="loading-greeting" class="loading-welcome">
                    <div id="loading-greeting-text" class="loading-welcome__line"></div>
                    <div id="loading-greeting-school" class="loading-welcome__school"></div>
                    <div id="loading-greeting-person" class="loading-welcome__person"></div>
                </div>
            </div>

            <!-- Three stars that light up as the app gets ready -->
            <div class="loading-path" aria-hidden="true">
                ${PATH_STAR_HTML}<span class="loading-path__link"></span>${PATH_STAR_HTML}<span class="loading-path__link"></span>${PATH_STAR_HTML}
            </div>

            <!-- Fixed-height card: tips of one or two lines never shift the stage -->
            <div class="loading-tip-card">
                <div id="loading-tip" class="loading-tip" aria-live="polite">Preparing your quest&hellip;</div>
            </div>
        </div>

        <!-- Sparkle dust Lumi leaves along her woosh (placed in launchLoadingWoosh) -->
        <div class="loading-dust" aria-hidden="true"></div>

        <!-- Warm light that washes over the scene as it hands over to the app -->
        <div class="loading-daylight" aria-hidden="true"></div>
    </div>
`;

/** Start cycling through fun tips in the loading screen. Call once after injectHTML(). */
export function initLoadingTips() {
    const tipEl = document.getElementById('loading-tip');
    if (!tipEl) return;
    if (_tipIntervalId) {
        clearInterval(_tipIntervalId);
    }
    let storage = null;
    try { storage = window.localStorage; } catch { /* blocked storage: deal without memory */ }
    const deck = createTipDeck({ storage });
    tipEl.textContent = deck.next();

    _tipIntervalId = setInterval(() => {
        const tip = deck.next();
        tipEl.classList.add('loading-tip-fade');
        setTimeout(() => {
            tipEl.textContent = tip;
            tipEl.classList.remove('loading-tip-fade');
        }, TIP_FADE_MS);
    }, TIP_ROTATE_MS);
}

/**
 * Randomize cloud/icon motion so each loading screen has a fresh sky composition.
 */
export function initLoadingAtmosphere() {
    const loadingScreen = document.getElementById('loading-screen');
    const lowPower = detectLowPowerTier();
    // Phones get their own calm, compact loading scene (styles/loading-mobile.css).
    // Decided here, before the first paint, so there is no desktop-then-phone jump.
    const mobile = isMobileLoadingViewport();
    _shownAt = performance.now();
    if (loadingScreen) {
        loadingScreen.classList.toggle('gcq-perf-low', lowPower);
        loadingScreen.classList.toggle('gcq-loading-mobile', mobile);
        revealLoadingTextWhenFontsReady(loadingScreen);
    }

    const cloudArtLayer = document.querySelector('.loading-cloud-art-layer');
    // Far clouds are banks, streaks and small puffs; near ones are the big domes and towers.
    const farFamilies = ['long', 'puff', 'wisp', 'long', 'puff', 'cumulus'];
    const nearFamilies = ['cumulus', 'twin', 'cumulus', 'tower', 'puff', 'twin', 'cumulus'];
    const nextVariant = {};

    if (cloudArtLayer) {
        cloudArtLayer.innerHTML = '';

        // Real skies have clouds concentrated in the upper portion with a few
        // larger, more prominent ones lower down — not evenly spread top to bottom.
        // We build three loose groups and let randomness mix them naturally.
        // Weaker devices (auto-detected) get a lighter sky so motion stays smooth.
        // A calmer sky than the old 32 clouds: fewer, better-spaced layers read
        // as more painterly and leave the balloons room to be seen.
        const cloudCount = mobile ? (lowPower ? 6 : 8) : (lowPower ? 14 : 22);

        for (let index = 0; index < cloudCount; index += 1) {
            const cloud = document.createElement('span');

            const isRightward = index % 2 === 0;

            // Vertical placement — three weighted zones:
            //   ~60 % in the upper sky  (top 0 – 48 %)
            //   ~28 % in the mid sky    (48 – 72 %)
            //   ~12 % as foreground     (72 – 90 %)
            let topPercent;
            const roll = Math.random();
            if (mobile) {
                // Phones: keep the middle band clear for the logo and title —
                // clouds sit in the upper sky or low along the horizon.
                topPercent = roll < 0.62 ? randomRange(0, 26) : randomRange(70, 90);
            } else if (roll < 0.60) {
                topPercent = randomRange(1, 48);
            } else if (roll < 0.88) {
                topPercent = randomRange(48, 72);
            } else {
                topPercent = randomRange(72, 90);
            }

            // Depth impression: clouds higher up are farther away
            // (smaller, more transparent, slower drift).
            const depthT = topPercent / 90;   // 0 = top horizon, 1 = bottom
            const families = depthT < 0.45 ? farFamilies : nearFamilies;
            const family = families[(index + randomInt(families.length)) % families.length];
            // Walk each family's variants so the same cloud rarely shows twice.
            nextVariant[family] = (nextVariant[family] ?? randomInt(cloudVariantCount(family))) + 1;
            const sizePx = mobile
                ? Math.round(120 + depthT * 200 + randomRange(-20, 20))
                : Math.round(140 + depthT * 440 + randomRange(-30, 30));
            const opacity = (mobile
                ? Math.min(0.7, 0.28 + depthT * 0.4 + randomRange(-0.05, 0.05))
                : Math.min(0.92, 0.22 + depthT * 0.66 + randomRange(-0.05, 0.05))).toFixed(2);
            const durationS = (mobile
                ? 190 - depthT * 60 + randomRange(-14, 14)
                : 250 - depthT * 120 + randomRange(-18, 18)).toFixed(1);
            const scaleV = (0.76 + depthT * 0.4 + randomRange(-0.04, 0.04)).toFixed(2);

            // Negative delay = cloud is already mid-flight when the page loads,
            // giving an instant sky feel instead of all clouds starting from the edge.
            const delayS = randomRange(0, parseFloat(durationS)).toFixed(1);

            cloud.className = `loading-cloud-art loading-cloud-art--${family}`;
            cloud.innerHTML = cloudSvg(family, nextVariant[family]);
            cloud.style.top = `${topPercent.toFixed(1)}%`;
            // Spread left across the full width so clouds don't bunch on entry.
            cloud.style.left = `${randomRange(0, 75).toFixed(1)}%`;
            cloud.style.width = `${sizePx}px`;
            cloud.style.opacity = opacity;
            cloud.style.animationName = isRightward ? 'loading-cloud-right' : 'loading-cloud-left';
            cloud.style.animationDuration = `${durationS}s`;
            cloud.style.animationDelay = `-${delayS}s`;
            cloud.style.animationTimingFunction = 'linear';
            cloud.style.animationIterationCount = 'infinite';
            cloud.style.setProperty('--offset', `${randomRange(-28, 28).toFixed(1)}vw`);
            cloud.style.setProperty('--scale', scaleV);
            cloud.style.setProperty('--fromY', `${randomRange(-6, 6).toFixed(1)}px`);
            cloud.style.setProperty('--toY', `${randomRange(-6, 6).toFixed(1)}px`);
            cloudArtLayer.appendChild(cloud);
        }
    }

    buildBalloons(document.querySelector('.loading-balloons'), { mobile, lowPower });
    buildFlocks(document.querySelector('.loading-birds'), { mobile, lowPower });
}

/**
 * A few hot-air balloons drifting across at different depths. Far ones are
 * small, paler and slower. Each balloon is two layers: the drift across the
 * sky, and a gentle bob and sway inside it.
 */
function buildBalloons(layer, { mobile, lowPower }) {
    if (!layer) return;
    layer.innerHTML = '';
    const count = mobile ? (lowPower ? 1 : 2) : (lowPower ? 3 : 5);
    const start = randomInt(BALLOON_PALETTES.length);
    // Spread vertically in bands so two balloons never stack up.
    const bands = mobile ? [[6, 18], [72, 82]] : [[8, 22], [24, 40], [44, 60], [10, 30], [60, 72]];
    for (let i = 0; i < count; i += 1) {
        const depth = mobile ? 0.5 : i / Math.max(1, count - 1);   // 0 far → 1 near
        const [lo, hi] = bands[i % bands.length];
        const size = Math.round((mobile ? 40 : 38 + depth * 46) + randomRange(-4, 4));
        const duration = (mobile ? 95 : 150 - depth * 55) + randomRange(-10, 10);
        const balloon = document.createElement('span');
        balloon.className = 'loading-balloon';
        balloon.style.top = `${randomRange(lo, hi).toFixed(1)}%`;
        balloon.style.width = `${size}px`;
        balloon.style.opacity = (0.72 + depth * 0.28).toFixed(2);
        balloon.style.animationName = i % 2 ? 'loading-drift-left' : 'loading-drift-right';
        balloon.style.animationDuration = `${duration.toFixed(1)}s`;
        balloon.style.animationDelay = `-${randomRange(0.1, 0.9) * duration}s`;
        balloon.style.setProperty('--rise-delay', `${i * 90}ms`);
        const bob = document.createElement('span');
        bob.className = 'loading-balloon__bob';
        bob.style.animationDuration = `${randomRange(6, 8.5).toFixed(2)}s`;
        bob.style.animationDelay = `-${randomRange(0, 6).toFixed(2)}s`;
        bob.innerHTML = balloonSvg(BALLOON_PALETTES[(start + i) % BALLOON_PALETTES.length], i);
        balloon.appendChild(bob);
        layer.appendChild(balloon);
    }
}

/** Small flocks of birds gliding across the upper sky, wings beating out of step. */
function buildFlocks(layer, { mobile, lowPower }) {
    if (!layer) return;
    layer.innerHTML = '';
    const flocks = mobile ? (lowPower ? 0 : 1) : (lowPower ? 1 : 2);
    // A loose V: leader in front, followers trailing behind and to the sides.
    const formation = [[0, 0], [-22, -9], [-20, 11], [-42, -16], [-40, 19]];
    for (let f = 0; f < flocks; f += 1) {
        const rightward = f % 2 === 0;
        const duration = randomRange(46, 62);
        const flock = document.createElement('span');
        flock.className = 'loading-flock';
        flock.style.top = `${randomRange(mobile ? 12 : 8, mobile ? 22 : 30).toFixed(1)}%`;
        flock.style.animationName = rightward ? 'loading-drift-right' : 'loading-drift-left';
        flock.style.animationDuration = `${duration.toFixed(1)}s`;
        flock.style.animationDelay = `-${randomRange(0.15, 0.7) * duration}s`;
        const glide = document.createElement('span');
        glide.className = 'loading-flock__glide';
        const size = mobile ? 22 : randomRange(24, 32);
        const members = 3 + randomInt(3);
        for (let b = 0; b < members; b += 1) {
            const [x, y] = formation[b];
            const bird = document.createElement('span');
            bird.className = 'loading-bird';
            bird.style.left = `${(rightward ? x : -x) * (size / 20)}px`;
            bird.style.top = `${y * (size / 20)}px`;
            bird.style.width = `${(size * (b ? randomRange(0.8, 0.95) : 1)).toFixed(1)}px`;
            bird.style.animationDuration = `${randomRange(0.8, 1.05).toFixed(2)}s`;
            bird.style.animationDelay = `-${randomRange(0, 1).toFixed(2)}s`;
            bird.innerHTML = BIRD_SVG;
            glide.appendChild(bird);
        }
        flock.appendChild(glide);
        layer.appendChild(flock);
    }
}

/**
 * For the Welcome, the clouds part like curtains: each one slides out
 * towards the side of the screen it is already on. Measured once, at the
 * moment the finale starts.
 */
function partCloudsForWelcome() {
    const clouds = document.querySelectorAll('#loading-screen .loading-cloud-art');
    if (!clouds.length) return;
    const mid = window.innerWidth / 2;
    const rects = Array.from(clouds, (cloud) => cloud.getBoundingClientRect());
    clouds.forEach((cloud, i) => {
        const r = rects[i];
        const centre = r.left + r.width / 2;
        // Clouds near the middle move furthest, so the centre clears first.
        const pull = 1 - Math.min(1, Math.abs(centre - mid) / mid);
        cloud.style.setProperty('--part-x', `${(centre < mid ? -1 : 1) * (14 + pull * 26)}vw`);
    });
}

// ── The quest path: Lumi's three stars ───────────────────────────────
// Real readiness lights them, never a timer: 1 when sign-in has answered,
// 2 when the account has loaded (stageLoadingPersonalization), 3 for the
// Welcome. Lumi hops each time one lights.

function loadingPart(selector) {
    return document.querySelector(`#loading-screen ${selector}`);
}

/** Restart a one-shot animation class on Lumi's hop layer ('is-hop' or 'is-cheer'). */
function lumiReact(kind) {
    const hop = loadingPart('.loading-lumi__hop');
    if (!hop) return;
    hop.classList.remove('is-hop', 'is-cheer');
    void hop.offsetWidth;
    hop.classList.add(kind);
}

/**
 * Light the quest path up to `step` (1–3). Steps only ever go forward.
 * quiet: light it without Lumi's hop (used when the screen reopens).
 */
export function markLoadingStage(step, { quiet = false } = {}) {
    const next = Math.min(3, Math.max(_loadingStep, step));
    if (next === _loadingStep) return;
    _loadingStep = next;
    loadingPart('.loading-path')?.querySelectorAll('.loading-path__star, .loading-path__link').forEach((el, i) => {
        // Star, link, star, link, star: the star at 2k lights at step k + 1.
        el.classList.toggle('is-on', i < next * 2 - 1);
    });
    if (!quiet && next < 3) lumiReact('is-hop');
}

// ── The Welcome ──────────────────────────────────────────────────────
// The big line is a warm hello for the moment, not a name. The school and
// the person signing in sit underneath it, smaller.

const TEACHER_LINES = {
    morning: 'A bright new day of quests',
    afternoon: 'Today’s quest begins',
    evening: 'The adventure continues',
    night: 'The stars are out for you',
};

function welcomeLine(role, dayPart) {
    if (role === 'parent') return 'Your child’s adventure awaits';
    if (role === 'secretary') return 'Your School Office is ready';
    return TEACHER_LINES[dayPart] || TEACHER_LINES.afternoon;
}

function buildPersonalizedCopy(name, role) {
    const HONORIFICS = /^(mr|mrs|ms|miss|dr|prof|rev|sir|lord|lady)\.?$/i;
    const displayName = (name || '').trim().replace(/\s+/g, ' ');
    const firstName = displayName.split(' ').find(p => !HONORIFICS.test(p)) || '';
    const tips = {
        parent: "Check in on your hero's progress and adventure log.",
        secretary: 'The school records and hero roster are ready.',
    };
    return {
        role,
        name: displayName,
        initial: Array.from(firstName || displayName)[0]?.toUpperCase() || '',
        tip: tips[role] || "Your class is ready for today's quest. Let's go!",
    };
}

/**
 * Stage the personalized loading copy so it can be shown at the last moment.
 * The account has loaded by now, so the second star on the quest path lights.
 */
export function stageLoadingPersonalization(name, role) {
    _stagedPersonalization = buildPersonalizedCopy(name, role);
    markLoadingStage(2);
}

/**
 * Reveal staged personalized copy right before exit animation starts.
 * schoolName: shown under the big line (left out when unknown).
 * dayPart: morning / afternoon / evening / night from the real sky (utils/dayPart.mjs).
 * Returns true when personalized content was shown.
 */
export function revealStagedLoadingPersonalization({ schoolName = '', dayPart = '' } = {}) {
    const greetingEl   = document.getElementById('loading-greeting');
    const greetingText = document.getElementById('loading-greeting-text');
    const schoolEl     = document.getElementById('loading-greeting-school');
    const personEl     = document.getElementById('loading-greeting-person');
    const tipEl        = document.getElementById('loading-tip');
    if (!greetingEl || !greetingText || !_stagedPersonalization) return false;

    if (_tipIntervalId) {
        clearInterval(_tipIntervalId);
        _tipIntervalId = null;
    }

    partCloudsForWelcome();
    markLoadingStage(3);
    lumiReact('is-cheer');

    // Three stacked copies of the same letters: a soft white glow behind, the
    // coloured ink that rises in letter by letter, and a sheen of light that
    // sweeps across once they have landed. Every copy is painted once; after
    // that only transform and opacity move (styles/loading2.css).
    const { role, name, initial, tip } = _stagedPersonalization;
    const line = welcomeLine(role, dayPart);
    const letters = greetingLettersHTML(line);
    greetingText.innerHTML =
        `<span class="loading-greeting-glow" aria-hidden="true">${letters}</span>` +
        `<span class="loading-greeting-ink">${letters}</span>` +
        sheenHTML(letters);
    greetingText.setAttribute('aria-label', line);
    const count = Array.from(line.replace(/ /g, '')).length;
    // The whole wave lands within ~0.7s, however long the line is.
    const step = Math.min(42, 700 / Math.max(1, count - 1));
    const landed = Math.round(step * (count - 1) + 520);
    greetingText.style.setProperty('--lg-step', `${step.toFixed(1)}ms`);
    greetingEl.style.setProperty('--lg-landed', `${landed}ms`);

    const school = String(schoolName || '').trim();
    if (schoolEl) {
        schoolEl.hidden = !school;
        schoolEl.innerHTML = school ? `<span class="loading-welcome__mark" aria-hidden="true">&#10022;</span>${escapeHTML(school)}<span class="loading-welcome__mark" aria-hidden="true">&#10022;</span>` : '';
    }
    if (personEl) {
        personEl.hidden = !name;
        personEl.innerHTML = name ? `<span class="loading-welcome__crest" aria-hidden="true">${escapeHTML(initial)}</span><span>${escapeHTML(name)}</span>` : '';
    }
    greetingEl.classList.add('loading-greeting-visible');

    if (tipEl) {
        tipEl.classList.add('loading-tip-fade');
        setTimeout(() => {
            tipEl.textContent = tip;
            tipEl.classList.remove('loading-tip-fade');
        }, TIP_FADE_MS);
    }

    _stagedPersonalization = null;
    return true;
}

// ── The woosh ────────────────────────────────────────────────────────
// Lumi swoops off her spot and flies into the sun; the sun answers with the
// daylight that hands over to the next screen (styles/loading2.css). Her path
// is measured once, here: the x and y moves run on separate wrappers with
// different easings, which bends the straight line into a swoop.

const WOOSH_LEAD = 0.18;   // share of the flight spent crouching before take-off
const WOOSH_FLIGHT_MS = 780;
// Lumi's arrival (delay + spin-in) ends about here (styles/loading2.css).
const LUMI_LANDED_MS = 1300;

function prefersReducedMotion() {
    try {
        return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch {
        return false;
    }
}

function aimWoosh(loadingScreen) {
    const lumi = loadingScreen.querySelector('.loading-lumi');
    const sun = loadingScreen.querySelector('.loading-sun');
    const dust = loadingScreen.querySelector('.loading-dust');
    if (!lumi || !sun) return;
    const from = lumi.getBoundingClientRect();
    const to = sun.getBoundingClientRect();
    if (!from.width || !to.width) return;
    const x0 = from.left + from.width / 2;
    const y0 = from.top + from.height / 2;
    const dx = to.left + to.width / 2 - x0;
    const dy = to.top + to.height / 2 - y0;
    loadingScreen.style.setProperty('--woosh-x', `${Math.round(dx)}px`);
    loadingScreen.style.setProperty('--woosh-y', `${Math.round(dy)}px`);
    loadingScreen.style.setProperty('--woosh-angle', `${Math.round(Math.atan2(dy, dx) * 180 / Math.PI)}deg`);
    if (!dust) return;

    // Sparkles left along the way: the same curves as the CSS (x speeds up,
    // y eases in and out after a small dip), each one popping as she passes.
    const count = detectLowPowerTier() || isMobileLoadingViewport() ? 5 : 9;
    const dip = from.height * 0.08;
    dust.innerHTML = glints('ld', count);
    Array.from(dust.children).forEach((glint, i) => {
        const u = (i + 1) / (count + 1);
        const fx = u * u * u;
        const fy = u < 0.5 ? 2 * u * u : 1 - ((2 - 2 * u) ** 2) / 2;
        glint.style.left = `${Math.round(x0 + dx * fx + randomRange(-10, 10))}px`;
        glint.style.top = `${Math.round(y0 + dip * (1 - fy) + dy * fy + randomRange(-10, 10))}px`;
        glint.style.setProperty('--dust-delay', `${Math.round((WOOSH_LEAD + (1 - WOOSH_LEAD) * u) * WOOSH_FLIGHT_MS)}ms`);
        const size = Math.round(randomRange(14, 26));
        glint.style.width = `${size}px`;
        glint.style.height = `${size}px`;
    });
}

/**
 * Start the hand-over: Lumi wooshes into the sun and the scene dissolves
 * into its daylight. With reduced motion the scene just fades, and Lumi stays
 * where she is. app.js listens for the screen's own animationend.
 */
export function launchLoadingWoosh(loadingScreen) {
    if (!loadingScreen) return;
    if (!prefersReducedMotion()) {
        try { aimWoosh(loadingScreen); } catch { /* she just fades with the scene */ }
    }
    // A fast sign-in can answer before she has landed: she keeps twinkling in
    // and flies anyway, instead of jumping into the spin.
    loadingScreen.classList.toggle('loading-exit-early', performance.now() - _shownAt < LUMI_LANDED_MS);
    loadingScreen.classList.add('loading-screen-exit');
}

/**
 * Smoothly bring the loading screen back for a real login/signup/activation
 * that just happened from the visible auth screen. The loading screen was
 * already dismissed once on cold boot (dataset.exiting = 'true', hidden
 * class applied); this resets that state so Lumi and the Welcome can play
 * again. The user is already signed in, so the first star is lit.
 * fromGate: the sign-in gate has just opened into daylight (ui/authGate.js).
 */
let fromGateTimer = 0;

export function reopenLoadingScreen({ fromGate = false } = {}) {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;
    loadingScreen.dataset.exiting = '';
    loadingScreen.classList.remove('loading-screen-exit', 'loading-exit-early', 'loading-final-moment', 'loading-screen-from-gate', 'hidden');
    _shownAt = performance.now();
    ['--woosh-x', '--woosh-y', '--woosh-angle'].forEach((name) => loadingScreen.style.removeProperty(name));
    clearTimeout(fromGateTimer);
    if (fromGate) {
        // Arrives inside the gate's daylight, then the veil clears (styles/loading.css).
        loadingScreen.classList.add('loading-screen-from-gate');
        fromGateTimer = setTimeout(() => loadingScreen.classList.remove('loading-screen-from-gate'), 2000);
    }
    document.getElementById('loading-greeting')?.classList.remove('loading-greeting-visible');
    loadingPart('.loading-lumi__hop')?.classList.remove('is-hop', 'is-cheer');
    const dust = loadingPart('.loading-dust');
    if (dust) dust.innerHTML = '';
    _loadingStep = 0;
    markLoadingStage(1, { quiet: true });
    void loadingScreen.offsetWidth; // flush the display change before animating opacity
    requestAnimationFrame(() => {
        loadingScreen.classList.remove('opacity-0', 'pointer-events-none');
    });
}
