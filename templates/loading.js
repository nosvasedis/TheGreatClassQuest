import { detectLowPowerTier as sharedLowPowerTier } from '../utils/devicePerformance.mjs';
// templates/loading.js

const LOADING_TIPS = [
    'Heroes earn XP by completing quests and helping their guild\u2026',
    'The Fortune Wheel rewards the bravest adventurers!',
    'Guild teams grow stronger when every hero contributes\u2026',
    'Rare boons await those who master their skills.',
    'Every great quest begins with a single step forward.',
    'Scholar\u2019s Scroll tracks every hero\u2019s growth over time.',
    'Class streaks grow when daily quests are completed together.',
    'Adventure Log keeps your class story alive, one day at a time.',
    'Power-Ups can shift the tide for your guild at the perfect moment.',
    'Sorting heroes into balanced guilds creates stronger teamwork.',
    'Quiz of the Week is a fast way to earn extra class glory.',
    'Familiars level up as heroes stay active in their learning journey.',
    'Boon windows reward consistency, teamwork, and daily momentum.',
    'The world map celebrates every milestone your class unlocks.',
    'Assessment moments are easier when heroes prep as a guild.',
    'Great classrooms rise when curiosity leads the quest.',
    'Teacher Journey has smart checkpoints for your next best step.',
    'Small daily wins stack into legendary school adventures.',
];

let _tipIntervalId = null;
let _stagedPersonalization = null;
let _isLowPowerDevice = null;
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

/** A comet arc: a gold head that trails off into a fading tail. */
function ringComet({ r, from, to, headAtEnd, color, width, headR, glowId }) {
    const steps = 14;
    const span = (to - from) / steps;
    const segments = Array.from({ length: steps }, (_, k) => {
        const a0 = from + span * k;
        const a1 = from + span * (k + 1) + (headAtEnd ? 0.6 : -0.6) * Math.sign(span);
        const t = headAtEnd ? (k + 1) / steps : 1 - k / steps;
        const p0 = polar(50, 50, r, a0);
        const p1 = polar(50, 50, r, a1);
        const sweep = a1 > a0 ? 1 : 0;
        return `<path d="M ${p0.x} ${p0.y} A ${r} ${r} 0 0 ${sweep} ${p1.x} ${p1.y}" stroke-opacity="${r1(t * t)}"/>`;
    }).join('');
    const head = polar(50, 50, r, headAtEnd ? to : from);
    return `
        <g class="loading-ring__comet" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round">${segments}</g>
        <circle cx="${head.x}" cy="${head.y}" r="${r1(headR * 2.6)}" fill="url(#${glowId})"/>
        <circle cx="${head.x}" cy="${head.y}" r="${headR}" fill="#fffbeb"/>`;
}

const RING_OUTER_SVG = `
    <svg viewBox="0 0 100 100" focusable="false">
        <defs>
            <radialGradient id="lr-glow-outer">
                <stop offset="0" stop-color="#fde047" stop-opacity="0.9"/>
                <stop offset="1" stop-color="#f59e0b" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <circle class="loading-ring__track" cx="50" cy="50" r="46.5" fill="none" stroke="rgba(14, 165, 233, 0.16)" stroke-width="3"/>
        ${ringComet({ r: 46.5, from: -125, to: 0, headAtEnd: true, color: '#fbbf24', width: 3, headR: 2.1, glowId: 'lr-glow-outer' })}
    </svg>`;

const RING_INNER_SVG = `
    <svg viewBox="0 0 100 100" focusable="false">
        <defs>
            <radialGradient id="lr-glow-inner">
                <stop offset="0" stop-color="#fef9c3" stop-opacity="0.85"/>
                <stop offset="1" stop-color="#fde047" stop-opacity="0"/>
            </radialGradient>
        </defs>
        <circle class="loading-ring__track loading-ring__track--inner" cx="50" cy="50" r="38" fill="none" stroke="rgba(103, 232, 249, 0.16)" stroke-width="2.2"/>
        ${ringComet({ r: 38, from: 180, to: 280, headAtEnd: false, color: '#fde047', width: 2.2, headR: 1.6, glowId: 'lr-glow-inner' })}
    </svg>`;

// Soft fan of light behind the phone greeting (styles/loading-mobile.css).
const SUNBURST_SVG = `
    <svg viewBox="-100 -100 200 200" focusable="false">
        <defs>
            <radialGradient id="ls-burst" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="100">
                <stop offset="0.1" stop-color="#fffbeb" stop-opacity="0.9"/>
                <stop offset="0.45" stop-color="#fef3c7" stop-opacity="0.45"/>
                <stop offset="0.9" stop-color="#fde68a" stop-opacity="0"/>
            </radialGradient>
        </defs>
        ${Array.from({ length: 16 }, (_, i) => {
            const a = i * 22.5;
            const half = i % 2 ? 3.2 : 5;
            const p0 = polar(0, 0, 100, a - half);
            const p1 = polar(0, 0, 100, a + half);
            return `<path d="M 0 0 L ${p0.x} ${p0.y} A 100 100 0 0 1 ${p1.x} ${p1.y} Z" fill="url(#ls-burst)"/>`;
        }).join('')}
    </svg>`;

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
        </defs>
    </svg>`;

/** A four-point sparkle with a soft glow. */
const GLINT_SVG = `
    <svg viewBox="-12 -12 24 24" focusable="false">
        <circle r="8" fill="url(#lg-glint-glow)"/>
        <path d="M0 -11 C0.9 -2.4 2.4 -0.9 11 0 C2.4 0.9 0.9 2.4 0 11 C-0.9 2.4 -2.4 0.9 -11 0 C-2.4 -0.9 -0.9 -2.4 0 -11 Z" fill="url(#lg-glint-star)"/>
    </svg>`;

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

        <!-- Giant painted cloud assets for a true sky-world feel -->
        <div class="loading-cloud-art-layer" aria-hidden="true">
            <span class="loading-cloud-art lca-1"></span>
            <span class="loading-cloud-art lca-2"></span>
            <span class="loading-cloud-art lca-3"></span>
            <span class="loading-cloud-art lca-4"></span>
            <span class="loading-cloud-art lca-5"></span>
            <span class="loading-cloud-art lca-6"></span>
            <span class="loading-cloud-art lca-7"></span>
            <span class="loading-cloud-art lca-8"></span>
            <span class="loading-cloud-art lca-9"></span>
            <span class="loading-cloud-art lca-10"></span>
            <span class="loading-cloud-art lca-11"></span>
            <span class="loading-cloud-art lca-12"></span>
        </div>

        <!-- Light falling from the sun -->
        <div class="loading-sunbeams" aria-hidden="true">
            <div class="loading-sunbeams__glow">${SUNBEAMS_SVG}</div>
        </div>

        <!-- Sky travellers: hot-air balloons and flocks (built in initLoadingAtmosphere) -->
        <div class="loading-balloons" aria-hidden="true"></div>
        <div class="loading-birds" aria-hidden="true"></div>

        <!-- Slow twinkles scattered across the sky -->
        <div class="loading-twinkles" aria-hidden="true">${glints('lt', 7)}</div>

        <!-- Center content -->
        <div class="loading-stage">
            <div class="loading-title" data-text="The Great Class Quest"><span class="loading-title__ink">The Great Class Quest</span></div>

            <div class="loading-title-flourish" aria-hidden="true">
                <span class="loading-flourish-line"></span>
                <span class="loading-flourish-gem"></span>
                <span class="loading-flourish-line"></span>
            </div>

            <div class="loading-subtitle">Every Great Quest Starts With One Brave Step</div>

            <div class="loading-spinner-wrap">
                <div class="loading-center-logo" aria-hidden="true">
                    <img src="${LOADING_LOGO_URL}" alt="" />
                </div>
                <div class="loading-simple-ring" aria-hidden="true">
                    ${RING_OUTER_SVG}
                    <div class="loading-simple-ring__inner">${RING_INNER_SVG}</div>
                </div>
            </div>

            <div class="loading-sunburst" aria-hidden="true">${SUNBURST_SVG}</div>

            <div id="loading-greeting" class="loading-greeting">
                <span id="loading-greeting-text"><span class="loading-greeting-ink"></span></span>
            </div>

            <!-- Welcome finale: sparkles pop in a ring around the greeting -->
            <div class="loading-cheer" aria-hidden="true">${glints('lc', 8)}</div>

            <!-- Fixed-height card: tips of one or two lines never shift the stage -->
            <div class="loading-tip-card">
                <div id="loading-tip" class="loading-tip" aria-live="polite">Preparing your quest&hellip;</div>
            </div>
        </div>

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
    let i = randomInt(LOADING_TIPS.length);
    tipEl.textContent = LOADING_TIPS[i];

    _tipIntervalId = setInterval(() => {
        let next = i;
        while (next === i && LOADING_TIPS.length > 1) {
            next = randomInt(LOADING_TIPS.length);
        }
        i = next;

        tipEl.classList.add('loading-tip-fade');
        setTimeout(() => {
            tipEl.textContent = LOADING_TIPS[i];
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
    if (loadingScreen) {
        loadingScreen.classList.toggle('gcq-perf-low', lowPower);
        loadingScreen.classList.toggle('gcq-loading-mobile', mobile);
        revealLoadingTextWhenFontsReady(loadingScreen);
    }

    const cloudArt = Array.from(document.querySelectorAll('.loading-cloud-art'));
    const cloudArtLayer = document.querySelector('.loading-cloud-art-layer');
    const cloudAssets = [
        new URL('../assets/award-clouds/cloud-a.png', import.meta.url).href,
        new URL('../assets/award-clouds/cloud-b.png', import.meta.url).href,
        new URL('../assets/award-clouds/cloud-c.png', import.meta.url).href,
        new URL('../assets/award-clouds/cloud-d.png', import.meta.url).href,
        new URL('../assets/award-clouds/cloud-e.png', import.meta.url).href,
        new URL('../assets/award-clouds/cloud-f.png', import.meta.url).href,
        new URL('../assets/award-clouds/cloud-g.png', import.meta.url).href,
        new URL('../assets/award-clouds/cloud-h.png', import.meta.url).href
    ];

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

            // Cycle through all 8 cloud assets so every image appears at least
            // 4 times but no two consecutive clouds share the same image.
            const asset = cloudAssets[(index * 3 + randomInt(3)) % cloudAssets.length];
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

            cloud.className = 'loading-cloud-art';
            cloud.style.backgroundImage = `url('${asset}')`;
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

function buildPersonalizedCopy(name, role) {
    const HONORIFICS = /^(mr|mrs|ms|miss|dr|prof|rev|sir|lord|lady)\.?$/i;
    const displayName = (name || '').trim().replace(/\s+/g, ' ');
    const nameParts = displayName.split(/\s+/).filter(Boolean);
    const firstName = nameParts.find(p => !HONORIFICS.test(p)) || '';
    const formalLabel = displayName || firstName;

    switch (role) {
        case 'student':
            return {
                greeting: firstName ? `Welcome, Hero ${firstName}!` : 'Welcome, Hero!',
                tip: 'Your guild is counting on you - the adventure continues!'
            };
        case 'parent':
            return {
                greeting: formalLabel ? `Welcome back, ${formalLabel}!` : 'Welcome back!',
                tip: "Check in on your hero's progress and adventure log."
            };
        case 'secretary':
            return {
                greeting: formalLabel ? `Welcome, ${formalLabel}!` : 'Welcome!',
                tip: 'The school records and hero roster are ready.'
            };
        default:
            return {
                greeting: formalLabel ? `Welcome back, ${formalLabel}!` : 'Welcome back!',
                tip: "Your class is ready for today's quest. Let's go!"
            };
    }
}

/**
 * Stage the personalized loading copy so it can be shown at the last moment.
 */
export function stageLoadingPersonalization(name, role) {
    _stagedPersonalization = buildPersonalizedCopy(name, role);
}

/**
 * Reveal staged personalized copy right before exit animation starts.
 * Returns true when personalized content was shown.
 */
export function revealStagedLoadingPersonalization() {
    const greetingEl   = document.getElementById('loading-greeting');
    const greetingText = document.getElementById('loading-greeting-text');
    const tipEl        = document.getElementById('loading-tip');
    const stageEl      = document.querySelector('.loading-stage');
    const cheerEl      = document.querySelector('.loading-cheer');
    if (!greetingEl || !greetingText || !_stagedPersonalization) return false;

    if (_tipIntervalId) {
        clearInterval(_tipIntervalId);
        _tipIntervalId = null;
    }

    partCloudsForWelcome();

    // The words go in an inner "ink" span that carries the gradient fill;
    // keeping background-clip:text off the outer span lets its ::before glow
    // breathe on the compositor instead of repainting the words every frame.
    const ink = greetingText.querySelector('.loading-greeting-ink') || greetingText;
    ink.textContent = _stagedPersonalization.greeting;
    // Kept in sync so the cheap ::before(attr(data-text)) glow layer always
    // mirrors the visible (per-role, personalized) text.
    greetingText.dataset.text = _stagedPersonalization.greeting;
    greetingEl.classList.add('loading-greeting-visible');
    if (stageEl) stageEl.classList.add('loading-stage-reveal');

    if (cheerEl) {
        // One-shot ring of sparkles; restart cleanly even if this ever fires
        // more than once for the same screen instance.
        cheerEl.classList.remove('loading-cheer-active');
        void cheerEl.offsetWidth;
        cheerEl.classList.add('loading-cheer-active');
    }

    if (tipEl) {
        const tipText = _stagedPersonalization.tip;
        tipEl.classList.add('loading-tip-fade');
        setTimeout(() => {
            tipEl.textContent = tipText;
            tipEl.classList.remove('loading-tip-fade');
        }, TIP_FADE_MS);
    }

    _stagedPersonalization = null;
    return true;
}

/**
 * Smoothly bring the loading screen back for a real login/signup/activation
 * that just happened from the visible auth screen. The loading screen was
 * already dismissed once on cold boot (dataset.exiting = 'true', hidden
 * class applied); this resets that state so the personalized "Welcome"
 * moment can play and crossfade in over the filled-in auth form.
 */
export function reopenLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;
    loadingScreen.dataset.exiting = '';
    loadingScreen.classList.remove('loading-screen-exit', 'loading-final-moment', 'hidden');
    document.getElementById('loading-greeting')?.classList.remove('loading-greeting-visible');
    document.querySelector('.loading-stage')?.classList.remove('loading-stage-reveal');
    document.querySelector('.loading-cheer')?.classList.remove('loading-cheer-active');
    void loadingScreen.offsetWidth; // flush the display change before animating opacity
    requestAnimationFrame(() => {
        loadingScreen.classList.remove('opacity-0', 'pointer-events-none');
    });
}
