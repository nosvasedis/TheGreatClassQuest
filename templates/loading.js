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
const LOADING_LOGO_URL = new URL('../assets/great-class-quest-logo.svg', import.meta.url).href;

function randomInt(max) {
    return Math.floor(Math.random() * max);
}

function randomRange(min, max) {
    return min + (Math.random() * (max - min));
}

export const loadingHTML = `
    <div id="loading-screen"
        class="fixed inset-0 flex flex-col items-center justify-center z-[1100] transition-opacity duration-500"
        style="background: linear-gradient(to bottom, #F0F9FF 0%, #E0F2FE 50%, #D6F9E3 100%);">

        <div class="loading-sky-glow" aria-hidden="true"></div>
        <div class="loading-sun" aria-hidden="true"></div>

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
            <div class="loading-title">The Great Class Quest</div>
            <div class="loading-subtitle">Every Great Quest Starts With One Brave Step</div>

            <div class="loading-spinner-wrap">
                <div class="loading-center-logo" aria-hidden="true">
                    <img src="${LOADING_LOGO_URL}" alt="" />
                </div>
                <div class="loading-simple-ring"></div>
            </div>

            <div class="loading-text">Loading</div>

            <div id="loading-greeting" class="loading-greeting">
                <span id="loading-greeting-text"></span>
            </div>

            <div id="loading-tip" class="loading-tip">Preparing your quest&hellip;</div>
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
        }, 350);
    }, 3200);
}

/**
 * Randomize cloud/icon motion so each loading screen has a fresh sky composition.
 */
export function initLoadingAtmosphere() {
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
        const cloudCount = 32;

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
            if (roll < 0.60) {
                topPercent = randomRange(1, 48);
            } else if (roll < 0.88) {
                topPercent = randomRange(48, 72);
            } else {
                topPercent = randomRange(72, 90);
            }

            // Depth impression: clouds higher up are farther away
            // (smaller, more transparent, slower drift).
            const depthT = topPercent / 90;   // 0 = top horizon, 1 = bottom
            const sizePx = Math.round(140 + depthT * 440 + randomRange(-30, 30));
            const opacity = Math.min(0.92, 0.22 + depthT * 0.66 + randomRange(-0.05, 0.05)).toFixed(2);
            const durationS = (250 - depthT * 120 + randomRange(-18, 18)).toFixed(1);
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

    const journeyIcons = Array.from(document.querySelectorAll('.loading-journey-icon'));
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
    if (!greetingEl || !greetingText || !_stagedPersonalization) return false;

    if (_tipIntervalId) {
        clearInterval(_tipIntervalId);
        _tipIntervalId = null;
    }

    greetingText.textContent = _stagedPersonalization.greeting;
    greetingEl.classList.add('loading-greeting-visible');
    if (stageEl) stageEl.classList.add('loading-stage-reveal');

    if (tipEl) {
        const tipText = _stagedPersonalization.tip;
        tipEl.classList.add('loading-tip-fade');
        setTimeout(() => {
            tipEl.textContent = tipText;
            tipEl.classList.remove('loading-tip-fade');
        }, 350);
    }

    _stagedPersonalization = null;
    return true;
}
