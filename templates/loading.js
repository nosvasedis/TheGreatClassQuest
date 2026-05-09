// templates/loading.js

const LOADING_TIPS = [
    'Heroes earn XP by completing quests and helping their guild\u2026',
    'The Fortune Wheel rewards the bravest adventurers!',
    'Guild teams grow stronger when every hero contributes\u2026',
    'Rare boons await those who master their skills.',
    'Every great quest begins with a single step forward.',
    'Scholar\u2019s Scroll tracks every hero\u2019s growth over time.',
];

let _tipIntervalId = null;
let _stagedPersonalization = null;

export const loadingHTML = `
    <div id="loading-screen"
        class="fixed inset-0 flex flex-col items-center justify-center z-[60] transition-opacity duration-500"
        style="background: linear-gradient(to bottom, #F0F9FF 0%, #E0F2FE 50%, #D6F9E3 100%);">

        <div class="loading-sky-glow" aria-hidden="true"></div>

        <!-- Floating clouds -->
        <div class="loading-clouds" aria-hidden="true">
            <span class="loading-cloud lc-1"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-2"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-3"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-4"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-5"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-6"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-7"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-8"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-9"><i class="fas fa-cloud"></i></span>
            <span class="loading-cloud lc-10"><i class="fas fa-cloud"></i></span>
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
        </div>

        <!-- Big colorful icon watermarks -->
        <div class="loading-air-watermarks" aria-hidden="true">
            <span class="loading-air-watermark lw-1"><i class="fas fa-crown"></i></span>
            <span class="loading-air-watermark lw-2"><i class="fas fa-book-open"></i></span>
            <span class="loading-air-watermark lw-3"><i class="fas fa-wand-sparkles"></i></span>
            <span class="loading-air-watermark lw-4"><i class="fas fa-gem"></i></span>
            <span class="loading-air-watermark lw-5"><i class="fas fa-scroll"></i></span>
            <span class="loading-air-watermark lw-6"><i class="fas fa-compass"></i></span>
            <span class="loading-air-watermark lw-7"><i class="fas fa-shield-halved"></i></span>
            <span class="loading-air-watermark lw-8"><i class="fas fa-trophy"></i></span>
            <span class="loading-air-watermark lw-9"><i class="fas fa-star"></i></span>
            <span class="loading-air-watermark lw-10"><i class="fas fa-feather"></i></span>
        </div>

        <!-- Airborne magical icons -->
        <div class="loading-air-icons" aria-hidden="true">
            <span class="loading-air-icon li-1"><i class="fas fa-star"></i></span>
            <span class="loading-air-icon li-2"><i class="fas fa-book-open"></i></span>
            <span class="loading-air-icon li-3"><i class="fas fa-feather"></i></span>
            <span class="loading-air-icon li-4"><i class="fas fa-shield-halved"></i></span>
            <span class="loading-air-icon li-5"><i class="fas fa-scroll"></i></span>
            <span class="loading-air-icon li-6"><i class="fas fa-trophy"></i></span>
            <span class="loading-air-icon li-7"><i class="fas fa-wand-sparkles"></i></span>
            <span class="loading-air-icon li-8"><i class="fas fa-compass"></i></span>
            <span class="loading-air-icon li-9"><i class="fas fa-crown"></i></span>
            <span class="loading-air-icon li-10"><i class="fas fa-gem"></i></span>
            <span class="loading-air-icon li-11"><i class="fas fa-star"></i></span>
            <span class="loading-air-icon li-12"><i class="fas fa-book-open"></i></span>
            <span class="loading-air-icon li-13"><i class="fas fa-feather"></i></span>
            <span class="loading-air-icon li-14"><i class="fas fa-shield-halved"></i></span>
            <span class="loading-air-icon li-15"><i class="fas fa-scroll"></i></span>
            <span class="loading-air-icon li-16"><i class="fas fa-trophy"></i></span>
            <span class="loading-air-icon li-17"><i class="fas fa-wand-sparkles"></i></span>
            <span class="loading-air-icon li-18"><i class="fas fa-compass"></i></span>
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
            <div class="loading-subtitle">Every Great Quest Starts With One Brave Step.</div>

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
    let i = 0;
    _tipIntervalId = setInterval(() => {
        i = (i + 1) % LOADING_TIPS.length;
        tipEl.classList.add('loading-tip-fade');
        setTimeout(() => {
            tipEl.textContent = LOADING_TIPS[i];
            tipEl.classList.remove('loading-tip-fade');
        }, 350);
    }, 3200);
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
