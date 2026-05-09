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

function randomInt(max) {
    return Math.floor(Math.random() * max);
}

function randomRange(min, max) {
    return min + (Math.random() * (max - min));
}

export const loadingHTML = `
    <div id="loading-screen"
        class="fixed inset-0 flex flex-col items-center justify-center z-[60] transition-opacity duration-500"
        style="background: linear-gradient(to bottom, #F0F9FF 0%, #E0F2FE 50%, #D6F9E3 100%);">

        <div class="loading-sky-glow" aria-hidden="true"></div>
        <div class="loading-sun" aria-hidden="true"></div>

        <!-- Floating clouds -->
        <div class="loading-clouds" aria-hidden="true">
            <span class="loading-cloud lc-1"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-2"><i class="fas fa-cloud-meatball"></i></span>
            <span class="loading-cloud lc-3"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-4"><i class="fas fa-cloud-meatball"></i></span>
            <span class="loading-cloud lc-5"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-6"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-7"><i class="fas fa-cloud-meatball"></i></span>
            <span class="loading-cloud lc-8"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-9"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-10"><i class="fas fa-cloud-meatball"></i></span>
            <span class="loading-cloud lc-11"><i class="fas fa-cloud-sun"></i></span>
            <span class="loading-cloud lc-12"><i class="fas fa-cloud-rain"></i></span>
            <span class="loading-cloud lc-13"><i class="fas fa-cloud-moon"></i></span>
            <span class="loading-cloud lc-14"><i class="fas fa-cloud-sun-rain"></i></span>
            <span class="loading-cloud lc-15"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-16"><i class="fas fa-cloud-meatball"></i></span>
            <span class="loading-cloud lc-17"><i class="fas fa-cloud-sun"></i></span>
            <span class="loading-cloud lc-18"><i class="fas fa-cloud-rain"></i></span>
        </div>

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
                <div class="loading-center-star">
                    <i class="fas fa-star"></i>
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
    const cloudIcons = ['fa-cloud', 'fa-cloud-meatball', 'fa-cloud-sun', 'fa-cloud-rain', 'fa-cloud-moon', 'fa-cloud-sun-rain'];

    const clouds = Array.from(document.querySelectorAll('.loading-cloud'));
    clouds.forEach((cloud) => {
        const icon = cloud.querySelector('i');
        if (icon) {
            icon.className = `fas ${cloudIcons[randomInt(cloudIcons.length)]}`;
        }

        const base = parseFloat(getComputedStyle(cloud).animationDuration) || 120;
        const duration = base * randomRange(0.88, 1.2);
        cloud.style.animationDuration = `${duration.toFixed(2)}s`;
        cloud.style.animationDelay = `-${randomRange(8, 220).toFixed(2)}s`;
        cloud.style.setProperty('--fromY', `${randomRange(-4, 4).toFixed(1)}px`);
        cloud.style.setProperty('--toY', `${randomRange(-9, 9).toFixed(1)}px`);
    });

    const cloudArt = Array.from(document.querySelectorAll('.loading-cloud-art'));
    cloudArt.forEach((cloud) => {
        const base = parseFloat(getComputedStyle(cloud).animationDuration) || 160;
        const duration = base * randomRange(0.9, 1.16);
        cloud.style.animationDuration = `${duration.toFixed(2)}s`;
        cloud.style.animationDelay = `-${randomRange(12, 260).toFixed(2)}s`;
    });

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
    if (!greetingEl || !greetingText || !_stagedPersonalization) return false;

    if (_tipIntervalId) {
        clearInterval(_tipIntervalId);
        _tipIntervalId = null;
    }

    greetingText.textContent = _stagedPersonalization.greeting;
    greetingEl.classList.add('loading-greeting-visible');

    if (tipEl) {
        tipEl.classList.add('loading-tip-fade');
        setTimeout(() => {
            tipEl.textContent = _stagedPersonalization.tip;
            tipEl.classList.remove('loading-tip-fade');
        }, 350);
    }

    _stagedPersonalization = null;
    return true;
}
