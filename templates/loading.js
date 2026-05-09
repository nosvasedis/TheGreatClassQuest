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

        <!-- Floating sparkle particles (absolutely positioned, don't affect layout flow) -->
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

        <!-- 3D stage card with integrated hierarchy -->
        <div class="loading-stage">
            <div class="loading-watermark loading-watermark-left" aria-hidden="true">GCQ</div>
            <div class="loading-watermark loading-watermark-right" aria-hidden="true">ADVENTURE</div>

            <div class="loading-title">The Great Class Quest</div>

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
    const nameParts = (name || '').trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts.find(p => !HONORIFICS.test(p)) || '';

    switch (role) {
        case 'student':
            return {
                greeting: firstName ? `Welcome, Hero ${firstName}!` : 'Welcome, Hero!',
                tip: 'Your guild is counting on you - the adventure continues!'
            };
        case 'parent':
            return {
                greeting: firstName ? `Welcome back, ${firstName}!` : 'Welcome back!',
                tip: "Check in on your hero's progress and adventure log."
            };
        case 'secretary':
            return {
                greeting: firstName ? `Welcome, ${firstName}!` : 'Welcome!',
                tip: 'The school records and hero roster are ready.'
            };
        default:
            return {
                greeting: firstName ? `Welcome back, ${firstName}!` : 'Welcome back!',
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
