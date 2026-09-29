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

        <!-- Journey icons inspired by app features -->
        <div class="loading-journey-icons" aria-hidden="true">
            <span class="loading-journey-icon ji-1"><i class="fas fa-book-open"></i></span>
            <span class="loading-journey-icon ji-2"><i class="fas fa-compass"></i></span>
            <span class="loading-journey-icon ji-3"><i class="fas fa-scroll"></i></span>
            <span class="loading-journey-icon ji-4"><i class="fas fa-crown"></i></span>
            <span class="loading-journey-icon ji-5"><i class="fas fa-wand-sparkles"></i></span>
            <span class="loading-journey-icon ji-6"><i class="fas fa-shield-halved"></i></span>
            <span class="loading-journey-icon ji-7"><i class="fas fa-trophy"></i></span>
            <span class="loading-journey-icon ji-8"><i class="fas fa-gem"></i></span>
            <span class="loading-journey-icon ji-9"><i class="fas fa-feather"></i></span>
            <span class="loading-journey-icon ji-10"><i class="fas fa-star"></i></span>
            <span class="loading-journey-icon ji-11"><i class="fas fa-map"></i></span>
            <span class="loading-journey-icon ji-12"><i class="fas fa-rocket"></i></span>
        </div>

        <!-- Celebratory fireworks — only ignite during the final greeting moment -->
        <div class="loading-fireworks" aria-hidden="true">
            <span class="loading-firework fw-1"></span>
            <span class="loading-firework fw-2"></span>
            <span class="loading-firework fw-3"></span>
            <span class="loading-firework fw-4"></span>
            <span class="loading-firework fw-5"></span>
            <span class="loading-firework fw-6"></span>
        </div>

        <!-- Sparkle particles -->
        <div class="loading-particles" aria-hidden="true">
            <span class="loading-particle lp-1"><i class="fas fa-star"></i></span>
            <span class="loading-particle lp-2"><i class="fas fa-star"></i></span>
            <span class="loading-particle lp-3"><i class="fas fa-star"></i></span>
            <span class="loading-particle lp-4"><i class="fas fa-star"></i></span>
            <span class="loading-particle lp-5"><i class="fas fa-star"></i></span>
            <span class="loading-particle lp-6"><i class="fas fa-star"></i></span>
            <span class="loading-particle lp-7"><i class="fas fa-star"></i></span>
            <span class="loading-particle lp-8"><i class="fas fa-star"></i></span>
        </div>

        <!-- Center content -->
        <div class="loading-stage">
            <div class="loading-title" data-text="The Great Class Quest">The Great Class Quest</div>

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
                <span id="loading-greeting-text"></span>
                <span class="loading-stardust" aria-hidden="true">
                    <i class="loading-stardust-mote sd-1"></i>
                    <i class="loading-stardust-mote sd-2"></i>
                    <i class="loading-stardust-mote sd-3"></i>
                    <i class="loading-stardust-mote sd-4"></i>
                    <i class="loading-stardust-mote sd-5"></i>
                    <i class="loading-stardust-mote sd-6"></i>
                    <i class="loading-stardust-mote sd-7"></i>
                </span>
            </div>

            <div class="loading-burst" aria-hidden="true">
                <span class="loading-burst-star lb-1"><i class="fas fa-star"></i></span>
                <span class="loading-burst-star lb-2"><i class="fas fa-star"></i></span>
                <span class="loading-burst-star lb-3"><i class="fas fa-star"></i></span>
                <span class="loading-burst-star lb-4"><i class="fas fa-star"></i></span>
                <span class="loading-burst-star lb-5"><i class="fas fa-star"></i></span>
                <span class="loading-burst-star lb-6"><i class="fas fa-star"></i></span>
                <span class="loading-burst-star lb-7"><i class="fas fa-star"></i></span>
                <span class="loading-burst-star lb-8"><i class="fas fa-star"></i></span>
                <span class="loading-burst-star lb-9"><i class="fas fa-star"></i></span>
                <span class="loading-burst-star lb-10"><i class="fas fa-star"></i></span>
            </div>

            <!-- Fixed-height card: tips of one or two lines never shift the stage -->
            <div class="loading-tip-card">
                <div id="loading-tip" class="loading-tip" aria-live="polite">Preparing your quest&hellip;</div>
            </div>
        </div>
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
        const cloudCount = mobile ? (lowPower ? 6 : 8) : (lowPower ? 18 : 32);

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

    // Journey icons are hidden on the phone scene; leave them untouched there.
    const journeyIcons = mobile ? [] : Array.from(document.querySelectorAll('.loading-journey-icon'));
    journeyIcons.forEach((iconWrap) => {
        const base = parseFloat(getComputedStyle(iconWrap).animationDuration) || 82;
        const duration = base * randomRange(0.92, 1.14);
        iconWrap.style.animationDuration = `${duration.toFixed(2)}s`;
        iconWrap.style.animationDelay = `-${randomRange(10, 180).toFixed(2)}s`;

        const icon = iconWrap.querySelector('i');
        if (icon) {
            const twirlDuration = randomRange(9.5, 14.5);
            icon.style.animationDuration = `${twirlDuration.toFixed(2)}s`;
            icon.style.animationDelay = `-${randomRange(0, 8).toFixed(2)}s`;
        }
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
    const burstEl      = document.querySelector('.loading-burst');
    if (!greetingEl || !greetingText || !_stagedPersonalization) return false;

    if (_tipIntervalId) {
        clearInterval(_tipIntervalId);
        _tipIntervalId = null;
    }

    greetingText.textContent = _stagedPersonalization.greeting;
    // Kept in sync so the cheap ::before(attr(data-text)) glow layer always
    // mirrors the visible (per-role, personalized) text.
    greetingText.dataset.text = _stagedPersonalization.greeting;
    greetingEl.classList.add('loading-greeting-visible');
    if (stageEl) stageEl.classList.add('loading-stage-reveal');

    if (burstEl) {
        // One-shot celebratory sparkle burst — restart cleanly even if this
        // ever fires more than once for the same screen instance. Plays on
        // every device: it's a sub-second finale, not a continuous effect.
        burstEl.classList.remove('loading-burst-active');
        void burstEl.offsetWidth;
        burstEl.classList.add('loading-burst-active');
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
    document.querySelector('.loading-burst')?.classList.remove('loading-burst-active');
    void loadingScreen.offsetWidth; // flush the display change before animating opacity
    requestAnimationFrame(() => {
        loadingScreen.classList.remove('opacity-0', 'pointer-events-none');
    });
}
