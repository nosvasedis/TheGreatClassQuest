// /app.js

import { injectHTML } from './templates/index.js';
import { stageLoadingPersonalization, revealStagedLoadingPersonalization, reopenLoadingScreen } from './templates/loading.js';
injectHTML();

// Browser DevTools helper (not the npm terminal). Available even before theater auto-starts.
window.__skyTheaterDebugPlay = async (id) => {
    const mod = await import('./features/skyTheater.js');
    return mod.debugPlayAct(id);
};
window.__skyTheaterListActs = async () => {
    const mod = await import('./features/skyTheater.js');
    const ids = mod.listSkyTheaterActs();
    console.info('[skyTheater] acts:', ids.join(', '));
    return ids;
};

import {
    auth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    updateProfile,
    signOut
} from './firebaseAuth.js';
import { firebaseConfig, BILLING_BASE_URL, BILLING_SCHOOL_ID } from './constants.js';
import { updateDateTime, getTodayDateString, fetchSolarCycle } from './utils.js';
import * as utils from './utils.js';
import { buildSyntheticRoleEmail, getRoleFromSyntheticEmail, getRoleLabel, getRoleLoginDescription, isRoleLogin, normalizeUsername, ROLE_PARENT, ROLE_SECRETARY, ROLE_TEACHER } from './utils/roles.js';
import { clearLocalAppData, getDeviceCacheChoice, offerDeviceCacheChoice } from './utils/deviceCache.js';
import { recordModuleLoaded } from './utils/runtimeMetrics.js';

let state;
let setupDataListeners;
let setupParentSession;
let watchCommunicationThread;
let refreshParentPortalData;
let setupUIListeners;
let toggleWallpaperMode;
let initializeHeaderQuote;
let maybeAutoShowGuideForTeacher;
let loadSubscription;
let hasActiveSubscription;
let canUseFeature;
let getTier;
let getSubscriptionSnapshot;
let setSchoolGraceConfig;
let showSetupScreen;
let loadTeacherJourneyState;
let startSchoolGracePeriod;
let requestCheckoutSession;
let ensureTeacherUserProfile;
let loadUserProfile;
let renderParentPortal;
let activateParentTab;
let wireParentPortalListeners;
let renderSecretaryConsole;
let activateSecretaryTab;
let wireSecretaryConsoleListeners;
let authenticatedRuntimePromise = null;
let audioModulePromise = null;
let authenticatedUiWired = false;
let authSessionId = 0;
let pendingSignupBootstrap = null;
let signupRecoveryContext = null;
let secretaryAdminRuntimePromise = null;
let secretarySetupToken = '';
/** @type {'checking' | 'active' | 'locked' | 'error'} */
let schoolAuthState = 'checking';

const AUTH_AVAILABILITY_COPY = {
    checking: {
        eyebrow: 'School activation',
        iconHtml: '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>',
        title: 'Checking school activation…',
        text: 'One moment while we confirm this school is ready.'
    },
    locked: {
        eyebrow: 'School activation',
        iconHtml: '<i class="fas fa-scroll" aria-hidden="true"></i>',
        title: 'Awaiting school activation',
        text: 'Login and signup open after the school Secretary/admin activates this school.'
    },
    error: {
        eyebrow: 'School activation',
        iconHtml: '<i class="fas fa-cloud-sun" aria-hidden="true"></i>',
        title: "Couldn't confirm school activation",
        text: 'We could not reach the activation check. Try again in a moment.'
    }
};

function loadSecretaryAdminRuntime() {
    if (!secretaryAdminRuntimePromise) {
        secretaryAdminRuntimePromise = import('./utils/adminRuntime.js');
    }
    return secretaryAdminRuntimePromise;
}

function readSecretarySetupToken() {
    const fragment = String(window.location.hash || '').replace(/^#/, '');
    const params = new URLSearchParams(fragment);
    return String(params.get('secretary-setup') || params.get('admin-setup') || '').trim();
}

function showSignupProfileRecovery(user, displayName, originalError) {
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app-screen');
    const loadingScreen = document.getElementById('loading-screen');
    appScreen?.classList.add('hidden');
    loadingScreen?.classList.add('hidden');
    authScreen?.classList.remove('hidden');

    document.getElementById('gcq-signup-profile-recovery')?.remove();
    const panel = document.createElement('section');
    panel.id = 'gcq-signup-profile-recovery';
    panel.className = 'mx-auto mt-5 max-w-md rounded-3xl border border-amber-200 bg-amber-50 p-5 text-center shadow-lg';
    panel.innerHTML = `
        <h2 class="font-title text-xl text-amber-800">Finish teacher account setup</h2>
        <p class="mt-2 text-sm text-amber-900">Your login was created, but the required teacher profile could not be saved. No school data is available until this step succeeds.</p>
        <div class="mt-4 flex flex-wrap justify-center gap-3">
            <button type="button" data-retry-profile class="rounded-xl bg-amber-700 px-4 py-2.5 font-bold text-white hover:bg-amber-800 focus:outline-none focus:ring-4 focus:ring-amber-200">Retry safely</button>
            <button type="button" data-cancel-profile class="rounded-xl border border-amber-300 bg-white px-4 py-2.5 font-bold text-amber-800 hover:bg-amber-100">Sign out</button>
        </div>`;
    authScreen?.appendChild(panel);

    panel.querySelector('[data-retry-profile]')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = 'Retrying…';
        try {
            if (displayName && user.displayName !== displayName) await updateProfile(user, { displayName });
            await loadAuthenticatedRuntime();
            const profile = await ensureTeacherUserProfile(user);
            if (!profile || profile.role !== ROLE_TEACHER || profile.status !== 'active') {
                throw new Error('The fixed teacher profile could not be verified.');
            }
            signupRecoveryContext = null;
            window.location.reload();
        } catch (error) {
            console.error('Teacher profile recovery failed:', error);
            button.disabled = false;
            button.textContent = 'Retry safely';
            const errorEl = document.getElementById('auth-error');
            if (errorEl) errorEl.innerText = error?.message || 'Could not finish teacher account setup.';
        }
    });
    panel.querySelector('[data-cancel-profile]')?.addEventListener('click', async () => {
        signupRecoveryContext = null;
        await signOut(auth);
        panel.remove();
    });
    console.error('Teacher profile bootstrap failed:', originalError);
}

async function loadAuthenticatedRuntime() {
    if (authenticatedRuntimePromise) return authenticatedRuntimePromise;
    authenticatedRuntimePromise = Promise.all([
        import('./state.js'),
        import('./db/listeners.js'),
        import('./ui/core.js'),
        import('./ui/wallpaper.js'),
        import('./features/home.js'),
        import('./utils/subscription.js'),
        import('./features/schoolSetup.js'),
        import('./features/teacherJourney.js'),
        import('./utils/billingCheckout.js'),
        import('./db/userProfiles.js'),
        import('./features/parentPortal.js'),
        import('./features/secretaryConsole.js')
    ]).then(([
        stateModule,
        listenerModule,
        coreModule,
        wallpaperModule,
        homeModule,
        subscriptionModule,
        schoolSetupModule,
        teacherJourneyModule,
        billingModule,
        userProfilesModule,
        parentPortalModule,
        secretaryConsoleModule
    ]) => {
        state = stateModule;
        ({ setupDataListeners, setupParentSession, watchCommunicationThread, refreshParentPortalData } = listenerModule);
        ({ setupUIListeners } = coreModule);
        ({ toggleWallpaperMode } = wallpaperModule);
        ({ initializeHeaderQuote, maybeAutoShowGuideForTeacher } = homeModule);
        ({ loadSubscription, hasActiveSubscription, canUseFeature, getTier, getSubscriptionSnapshot, setSchoolGraceConfig } = subscriptionModule);
        ({ showSetupScreen } = schoolSetupModule);
        ({ loadTeacherJourneyState, startSchoolGracePeriod } = teacherJourneyModule);
        ({ requestCheckoutSession } = billingModule);
        ({ ensureTeacherUserProfile, loadUserProfile } = userProfilesModule);
        ({ renderParentPortal, activateParentTab, wireParentPortalListeners } = parentPortalModule);
        ({ renderSecretaryConsole, activateSecretaryTab, wireSecretaryConsoleListeners } = secretaryConsoleModule);
        recordModuleLoaded('authenticated-runtime');
    }).catch((error) => {
        authenticatedRuntimePromise = null;
        throw error;
    });
    return authenticatedRuntimePromise;
}

function updateTierLabel() {
    const tierEl = document.getElementById('app-tier-label');
    if (!tierEl) return;
    const config = getSubscriptionSnapshot();
    const t = getTier();
    const pretty = t === 'elite' ? 'Elite' : t === 'pro' ? 'Pro' : t === 'expired' ? 'Expired' : t === 'pending' ? 'Pending' : 'Starter';
    tierEl.textContent = config?.isGracePeriod ? 'Plan: Starter (Grace Day)' : `Plan: ${pretty}`;
}
window.addEventListener('gcq-subscription-updated', updateTierLabel);

let activeAuthRole = ROLE_TEACHER;
let activeAuthMode = 'login';

const INITIALIZATION_TIMEOUT_MS = 8000;
let subscribeGraceTicker = null;

function clearSubscribeGraceTicker() {
    if (subscribeGraceTicker) {
        window.clearInterval(subscribeGraceTicker);
        subscribeGraceTicker = null;
    }
}

function formatRemainingTime(endsAt) {
    const compact = utils.formatCountdownCompact(endsAt, 'Grace time has ended');
    const tone = utils.getCountdownTone(endsAt);
    const toneClass = tone === 'critical'
        ? 'bg-rose-100 text-rose-700 border-rose-200'
        : tone === 'warning'
            ? 'bg-amber-100 text-amber-700 border-amber-200'
            : 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return `<span class="inline-flex items-center gap-2 rounded-full border px-3 py-1 ${toneClass}"><i class="fas fa-hourglass-half"></i><span>${compact}</span></span>`;
}

function updateSubscribeGraceBanner(graceWindow, options = {}) {
    const banner = document.getElementById('subscribe-grace-banner');
    const title = document.getElementById('subscribe-grace-title');
    const copy = document.getElementById('subscribe-grace-copy');
    const countdown = document.getElementById('subscribe-grace-countdown');
    const lead = document.getElementById('subscribe-status-lead');
    const meta = document.getElementById('subscribe-status-meta');

    clearSubscribeGraceTicker();

    if (!banner || !title || !copy || !countdown || !lead || !meta) return;

    if (graceWindow?.active && graceWindow?.endsAt) {
        banner.classList.remove('hidden');
        title.textContent = '1-day setup grace is active';
        copy.textContent = 'The school is temporarily unlocked so staff can finish initial setup before payment is required.';
        lead.textContent = 'This brand-new school is currently inside its setup grace period. Finish setup before the timer runs out, or complete payment now to keep access seamless.';
        meta.textContent = 'Grace timer is running';

        const refresh = () => {
            countdown.innerHTML = formatRemainingTime(graceWindow.endsAt);
            if (new Date(graceWindow.endsAt).getTime() <= Date.now()) {
                clearSubscribeGraceTicker();
            }
        };
        refresh();
        subscribeGraceTicker = window.setInterval(() => {
            const subscribeScreen = document.getElementById('subscribe-screen');
            if (!subscribeScreen || subscribeScreen.classList.contains('hidden')) {
                clearSubscribeGraceTicker();
                return;
            }
            refresh();
        }, 30000);
        return;
    }

    banner.classList.add('hidden');
    if (options.graceExpired) {
        lead.textContent = 'The school already used its 1-day setup grace period. Choose a plan below to unlock the app again.';
        meta.textContent = 'Grace period already used';
    } else if (options.canStartGrace) {
        lead.textContent = 'Choose a plan to unlock your school’s adventure, or begin the first-day setup grace period if this is a brand-new school.';
        meta.textContent = '1-day setup grace available';
    } else {
        lead.textContent = 'Choose a plan to unlock your school’s adventure.';
        meta.textContent = 'Payment unlocks the Quest';
    }
}

// How long the personalized "Welcome, Name!" greeting stays fully legible
// before the loading screen begins its exit/zoom-out animation.
const WELCOME_HOLD_MS = 1800;

function animateLoadingScreenOut(loadingScreen) {
    if (!loadingScreen || loadingScreen.dataset.exiting === 'true') return;

    loadingScreen.dataset.exiting = 'true';
    const revealedPersonalization = revealStagedLoadingPersonalization();

    if (revealedPersonalization) {
        loadingScreen.classList.add('loading-final-moment');
    }

    const beginExit = () => {
        requestAnimationFrame(() => {
            loadingScreen.classList.add('loading-screen-exit');
        });

        const finishExit = () => {
            loadingScreen.classList.add('opacity-0', 'pointer-events-none', 'hidden');
        };

        const onExitAnimationEnd = (event) => {
            if (event.target !== loadingScreen) return;
            loadingScreen.removeEventListener('animationend', onExitAnimationEnd);
            finishExit();
        };

        loadingScreen.addEventListener('animationend', onExitAnimationEnd);
        setTimeout(() => {
            loadingScreen.removeEventListener('animationend', onExitAnimationEnd);
            finishExit();
        }, 1100);
    };

    if (revealedPersonalization) {
        // Give the user a moment to actually read their personalized greeting
        // before the exit/zoom animation whisks it away.
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        setTimeout(beginExit, reduceMotion ? 300 : WELCOME_HOLD_MS);
    } else {
        beginExit();
    }
}

// Resolves once the loading screen (including any personalized "Welcome"
// hold) has fully faded out, plus a short buffer so the app has a moment to
// breathe. Used to delay post-login prompts (like the device cache choice)
// so they never pop up on top of the loading/welcome moment.
function waitForLoadingScreenSettled(loadingScreen) {
    const EXTRA_SETTLE_MS = 600;
    return new Promise((resolve) => {
        if (!loadingScreen) { resolve(); return; }
        if (loadingScreen.classList.contains('hidden')) { setTimeout(resolve, EXTRA_SETTLE_MS); return; }
        const observer = new MutationObserver(() => {
            if (loadingScreen.classList.contains('hidden')) {
                observer.disconnect();
                setTimeout(resolve, EXTRA_SETTLE_MS);
            }
        });
        observer.observe(loadingScreen, { attributes: true, attributeFilter: ['class'] });
        // Safety net in case the loading screen never gets dismissed for some reason.
        setTimeout(() => { observer.disconnect(); resolve(); }, 6000);
    });
}

function showInitializationRecovery(error) {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen || document.getElementById('gcq-initialization-recovery')) return;
    const recovery = document.createElement('div');
    recovery.id = 'gcq-initialization-recovery';
    recovery.className = 'absolute inset-x-4 bottom-6 z-[30] mx-auto max-w-xl rounded-3xl border border-rose-200 bg-white/95 p-5 text-center shadow-2xl backdrop-blur';
    recovery.innerHTML = `
        <h2 class="font-title text-xl text-rose-700">GCQ could not finish loading</h2>
        <p class="mt-2 text-sm text-slate-600">Your data was not changed. Check the connection and try again; year-scoped writes remain blocked until configuration is available.</p>
        <button type="button" class="mt-4 rounded-xl bg-rose-600 px-5 py-2.5 font-bold text-white hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-200">Retry safely</button>`;
    recovery.querySelector('button')?.addEventListener('click', () => window.location.reload());
    loadingScreen.appendChild(recovery);
    console.error('GCQ initialization failed:', error);
}

function dismissLoadingAfterHomeIsReady(loadingScreen) {
    if (!loadingScreen) return;

    // Listener hydration can render the already-selected home tab before role
    // routing reaches this point. The session-scoped marker closes that event race.
    if (document.documentElement?.hasAttribute('data-gcq-home-ready')) {
        requestAnimationFrame(() => animateLoadingScreenOut(loadingScreen));
        return;
    }

    let isSettled = false;
    let timeoutId = null;
    const settle = () => {
        if (isSettled) return;
        isSettled = true;
        document.removeEventListener('home:rendered', onHomeRendered);
        clearTimeout(timeoutId);
        animateLoadingScreenOut(loadingScreen);
    };

    const onHomeRendered = () => {
        requestAnimationFrame(settle);
    };

    document.addEventListener('home:rendered', onHomeRendered, { once: true });
    timeoutId = setTimeout(() => {
        // Critical configuration and listener hydration already completed before
        // this function was called. Never trap a usable session on optional UI work.
        if (!isSettled) settle();
    }, INITIALIZATION_TIMEOUT_MS);
}

function onFirstUserGesture() {
    audioModulePromise ??= import('./audio.js');
    audioModulePromise
        .then(({ ensureAudioReady }) => ensureAudioReady())
        .catch((error) => console.warn('Audio initialization was deferred:', error));
}

function setAuthSubmitLoading(mode, isLoading) {
    const submitBtn = document.getElementById(
        mode === 'activation'
            ? 'secretary-activation-submit-btn'
            : mode === 'signup'
                ? 'signup-submit-btn'
                : 'login-submit-btn'
    );
    const toggleBtn = document.getElementById('toggle-auth-mode');
    if (!submitBtn) return;

    submitBtn.disabled = isLoading;
    if (toggleBtn) toggleBtn.disabled = isLoading;
    const loadingLabel = mode === 'activation'
        ? 'Activating the school...'
        : mode === 'signup'
            ? 'Creating your account...'
            : 'Signing you in...';
    const idleLabel = mode === 'activation' ? 'Activate Secretary / Admin' : mode === 'signup' ? 'Sign Up' : 'Login';
    submitBtn.innerHTML = isLoading
        ? `<i class="fas fa-spinner fa-spin"></i><span>${loadingLabel}</span>`
        : `<span class="auth-submit-label">${idleLabel}</span>`;
}

function beginAuthSubmit(mode) {
    setAuthSubmitLoading(mode, true);
}

function resetAuthSubmitState() {
    setAuthSubmitLoading('login', false);
    setAuthSubmitLoading('signup', false);
    setAuthSubmitLoading('activation', false);
}

function hideAuthScreen(authScreen) {
    authScreen.classList.add('auth-screen-out');
    setTimeout(() => {
        authScreen.classList.add('hidden');
        authScreen.classList.remove('auth-screen-out');
    }, 500);
}

function hideAllExperienceScreens() {
    document.getElementById('parent-screen')?.classList.add('hidden');
    document.getElementById('secretary-screen')?.classList.add('hidden');
    document.getElementById('app-screen')?.classList.add('hidden');
    document.getElementById('setup-screen')?.classList.add('hidden');
}

function setSecretaryReturnButtonVisible(isVisible) {
    document.getElementById('secretary-console-btn')?.classList.toggle('hidden', !isVisible);
}

async function logoutWithLocalCleanup() {
    await signOut(auth);
    if (getDeviceCacheChoice() === 'shared') clearLocalAppData();
}

function ensureAuthenticatedUiWired() {
    if (authenticatedUiWired) return;
    authenticatedUiWired = true;
    setupUIListeners();
    wireParentPortalListeners({
        onLogout: logoutWithLocalCleanup,
        onRefresh: async () => {
            await refreshParentPortalData();
            renderParentPortal();
        },
        onSelectThread: (threadId) => watchCommunicationThread(threadId)
    });
    wireSecretaryConsoleListeners({
        onLogout: logoutWithLocalCleanup,
        onOpenTeacherView: async () => {
            document.getElementById('secretary-screen')?.classList.add('hidden');
            document.getElementById('app-screen')?.classList.remove('hidden');
            const tabs = await import('./ui/tabs.js');
            await tabs.showTab('about-tab');
        },
        onSelectThread: (threadId) => watchCommunicationThread(threadId)
    });
    document.getElementById('secretary-console-btn')?.addEventListener('click', () => {
        document.getElementById('app-screen')?.classList.add('hidden');
        document.getElementById('secretary-screen')?.classList.remove('hidden');
        setSecretaryReturnButtonVisible(true);
        activateSecretaryTab('home');
        renderSecretaryConsole();
    });
}

async function openMainAppForTeacher({ user, loadingScreen, authScreen, appScreen }) {
    hideAllExperienceScreens();
    hideAuthScreen(authScreen);
    appScreen.classList.remove('hidden');
    appScreen.classList.add('app-screen-in');
    setTimeout(() => appScreen.classList.remove('app-screen-in'), 500);
    const tabs = await import('./ui/tabs.js');
    // Register readiness before the first tab render so a fast cached render
    // cannot win the race and leave the loading screen waiting forever.
    dismissLoadingAfterHomeIsReady(loadingScreen);
    await tabs.showTab('about-tab');
    resetAuthSubmitState();
    if (state.get('currentUserRole') === ROLE_TEACHER) {
        await maybeAutoShowGuideForTeacher(user);
    }
}

async function openParentPortal({ loadingScreen, authScreen }) {
    hideAllExperienceScreens();
    hideAuthScreen(authScreen);
    const parentScreen = document.getElementById('parent-screen');
    if (parentScreen) parentScreen.classList.remove('hidden');
    activateParentTab('home');
    renderParentPortal();
    resetAuthSubmitState();
    animateLoadingScreenOut(loadingScreen);
}

async function openSecretaryConsole({ loadingScreen, authScreen }) {
    hideAllExperienceScreens();
    hideAuthScreen(authScreen);
    const secretaryScreen = document.getElementById('secretary-screen');
    if (secretaryScreen) secretaryScreen.classList.remove('hidden');
    activateSecretaryTab('home');
    renderSecretaryConsole();
    setSecretaryReturnButtonVisible(true);
    resetAuthSubmitState();
    animateLoadingScreenOut(loadingScreen);
}

function showSubscribeScreen(loadingScreen, authScreen, options = {}) {
    resetAuthSubmitState();
    authScreen.classList.add('hidden');
    const appScreen = document.getElementById('app-screen');
    const setupScreen = document.getElementById('setup-screen');
    const subscribeScreen = document.getElementById('subscribe-screen');
    const refreshHint = document.getElementById('subscribe-refresh-hint');
    const actions = document.getElementById('subscribe-actions');
    const status = document.getElementById('subscribe-status');
    if (!subscribeScreen) return;
    if (appScreen) appScreen.classList.add('hidden');
    if (setupScreen) setupScreen.classList.add('hidden');
    updateSubscribeGraceBanner(options.graceWindow, options);

    const schoolId = BILLING_SCHOOL_ID || firebaseConfig?.projectId || '';
    const billingUrl = (BILLING_BASE_URL || '').replace(/\/$/, '');

    // Show refresh hint since buttons are now in the HTML template
    if (refreshHint) refreshHint.classList.remove('hidden');

    if (actions) {
        actions.classList.add('hidden');
        actions.innerHTML = '';
        if (options.canStartGrace || options.graceExpired) {
            actions.classList.remove('hidden');
            actions.innerHTML = `
                <div class="rounded-[1.6rem] border ${options.graceExpired ? 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50' : 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50'} p-6 text-left shadow-sm">
                    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                            <p class="text-xs uppercase tracking-[0.24em] font-black ${options.graceExpired ? 'text-amber-600' : 'text-emerald-600'} mb-2">
                                ${options.graceExpired ? 'Grace finished' : 'First-day setup option'}
                            </p>
                            <h3 class="font-title text-2xl ${options.graceExpired ? 'text-amber-800' : 'text-emerald-800'} mb-2">
                                ${options.graceExpired ? 'The 1-day grace period has ended' : 'Brand-new school? Start a 1-day grace period'}
                            </h3>
                            <p class="text-sm text-slate-700 leading-relaxed">
                                ${options.graceExpired
                                    ? 'This school already used its free setup day. To unlock the app again, choose a plan below and complete payment.'
                                    : 'Use this only for the first setup of a brand-new school. GCQ unlocks Starter-level access for 24 hours so the Secretary/admin and teaching staff can finish setup before paying.'
                                }
                            </p>
                        </div>
                        <div class="rounded-2xl ${options.graceExpired ? 'bg-white/85 border border-amber-200 text-amber-700' : 'bg-white/85 border border-emerald-200 text-emerald-700'} px-4 py-3 min-w-[220px] shadow-sm">
                            <p class="text-[11px] uppercase tracking-[0.24em] font-black mb-1">What it means</p>
                            <p class="text-sm font-medium">${options.graceExpired ? 'Payment is now required before the app can open again.' : 'You get one temporary 24-hour setup window for this school.'}</p>
                        </div>
                    </div>
                    ${options.canStartGrace ? `
                        <button type="button" id="subscribe-start-grace-btn" class="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white font-title text-lg py-3 px-5 rounded-xl bubbly-button flex items-center gap-2 shadow-md">
                            <i class="fas fa-hourglass-start"></i>
                            <span>Start 1-Day Grace Period</span>
                        </button>
                    ` : ''}
                </div>
            `;
        }
    }

    if (billingUrl && schoolId) {
        const goCheckout = async (tier) => {
            if (status) {
                status.classList.add('hidden');
                status.textContent = '';
            }
            const btn = document.getElementById(`subscribe-${tier}-btn`);
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Opening Stripe...';
            }
            try {
                const data = await requestCheckoutSession({
                    billingBaseUrl: billingUrl,
                    schoolId,
                    tier,
                    successUrl: window.location.href,
                    cancelUrl: window.location.href
                });
                window.location.assign(data.url);
            } catch (e) {
                console.error(e);
                if (status) {
                    status.textContent = e.message || 'Could not open checkout right now.';
                    status.classList.remove('hidden');
                } else {
                    alert('Could not open checkout. Please try again or contact support.');
                }
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = tier === 'starter' ? 'Choose Starter' : tier === 'pro' ? 'Choose Pro' : 'Choose Elite';
                }
            }
        };

        // Attach listeners to the buttons in the template
        const starterBtn = document.getElementById('subscribe-starter-btn');
        const proBtn = document.getElementById('subscribe-pro-btn');
        const eliteBtn = document.getElementById('subscribe-elite-btn');

        if (starterBtn) starterBtn.onclick = () => goCheckout('starter');
        if (proBtn) proBtn.onclick = () => goCheckout('pro');
        if (eliteBtn) eliteBtn.onclick = () => goCheckout('elite');
    } else {
        // Hide all plan buttons if billing is not configured
        const buttons = subscribeScreen.querySelectorAll('button[id^="subscribe-"]');
        buttons.forEach(btn => btn.classList.add('hidden'));
        const msg = document.createElement('p');
        msg.className = 'text-gray-600 text-center mt-4';
        msg.textContent = 'Billing is not configured. Please contact support.';
        subscribeScreen.querySelector('.max-w-6xl')?.appendChild(msg);
    }

    const graceBtn = document.getElementById('subscribe-start-grace-btn');
    if (graceBtn && typeof options.onStartGrace === 'function') {
        graceBtn.onclick = async () => {
            graceBtn.disabled = true;
            graceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Opening your grace day...</span>';
            try {
                await options.onStartGrace();
            } catch (error) {
                console.error(error);
                alert('Could not start the grace period right now. Please try again.');
                graceBtn.disabled = false;
                graceBtn.innerHTML = '<i class="fas fa-hourglass-start"></i><span>Start 1-Day Grace Period</span>';
            }
        };
    }

    subscribeScreen.classList.remove('hidden');
    if (loadingScreen) animateLoadingScreenOut(loadingScreen);
}

async function routeAuthenticatedTeacher({ user, loadingScreen, authScreen, appScreen }) {
    const teacherJourney = await loadTeacherJourneyState(user);
    const allSchoolClasses = state.get('allSchoolClasses') || [];
    const ownClasses = allSchoolClasses.filter((cls) => cls.createdBy?.uid === user.uid);
    let needsTeacherSetup = teacherJourney.onboardingCompleted !== true;

    if (needsTeacherSetup && ownClasses.length > 0) {
        needsTeacherSetup = false;
    }

    if (!hasActiveSubscription()) {
        const schoolGrace = state.get('schoolBillingGrace');
        const canStartGrace = !schoolGrace?.used && allSchoolClasses.length === 0;
        showSubscribeScreen(loadingScreen, authScreen, {
            canStartGrace,
            graceExpired: Boolean(schoolGrace?.expired),
            graceWindow: schoolGrace,
            onStartGrace: async () => {
                const graceWindow = await startSchoolGracePeriod();
                state.setSchoolBillingGrace(graceWindow);
                setSchoolGraceConfig(graceWindow);
                await routeAuthenticatedTeacher({ user, loadingScreen, authScreen, appScreen });
            }
        });
        return;
    }

    if (needsTeacherSetup) {
        hideAuthScreen(authScreen);
        resetAuthSubmitState();
        showSetupScreen({
            user,
            onComplete: async () => {
                await openMainAppForTeacher({ user, loadingScreen, authScreen, appScreen });
            }
        });
        animateLoadingScreenOut(loadingScreen);
        return;
    }

    await openMainAppForTeacher({ user, loadingScreen, authScreen, appScreen });
}

async function routeAuthenticatedSecretary({ user, loadingScreen, authScreen }) {
    if (!hasActiveSubscription()) {
        const schoolGrace = state.get('schoolBillingGrace');
        const canStartGrace = !schoolGrace?.used && (state.get('allSchoolClasses') || []).length === 0;
        showSubscribeScreen(loadingScreen, authScreen, {
            canStartGrace,
            graceExpired: Boolean(schoolGrace?.expired),
            graceWindow: schoolGrace,
            onStartGrace: async () => {
                const graceWindow = await startSchoolGracePeriod();
                state.setSchoolBillingGrace(graceWindow);
                setSchoolGraceConfig(graceWindow);
                await routeAuthenticatedSecretary({ user, loadingScreen, authScreen });
            }
        });
        return;
    }
    await openSecretaryConsole({ loadingScreen, authScreen });
}

async function routeAuthenticatedParent({ loadingScreen, authScreen }) {
    if (!hasActiveSubscription() || !canUseFeature('parentAccess')) {
        showSubscribeScreen(loadingScreen, authScreen, {
            canStartGrace: false,
            graceExpired: false,
            graceWindow: state.get('schoolBillingGrace')
        });
        return;
    }
    await openParentPortal({ loadingScreen, authScreen });
}

function getRoleAwareLoginIdentifier() {
    if (isRoleLogin(activeAuthRole)) {
        const username = normalizeUsername(document.getElementById('login-username')?.value || '');
        return {
            identifier: buildSyntheticRoleEmail(activeAuthRole, username),
            rawUsername: username
        };
    }

    return {
        identifier: document.getElementById('login-email')?.value?.trim() || '',
        rawUsername: ''
    };
}

function isSchoolAuthOpen() {
    return schoolAuthState === 'active';
}

function renderAuthAvailabilityPanel(state) {
    const panel = document.getElementById('auth-availability-panel');
    if (!panel) return;
    const copy = AUTH_AVAILABILITY_COPY[state];
    if (!copy) {
        panel.classList.add('hidden');
        return;
    }
    const eyebrow = panel.querySelector('.auth-availability-eyebrow');
    const icon = panel.querySelector('.auth-availability-icon');
    const title = panel.querySelector('.auth-availability-title');
    const text = panel.querySelector('.auth-availability-text');
    const retryBtn = document.getElementById('auth-availability-retry');
    if (eyebrow) eyebrow.textContent = copy.eyebrow;
    if (icon) icon.innerHTML = copy.iconHtml;
    if (title) title.textContent = copy.title;
    if (text) text.textContent = copy.text;
    retryBtn?.classList.toggle('hidden', state !== 'error');
    panel.classList.remove('hidden');
    panel.dataset.authAvailability = state;
}

function syncAuthRoleUi() {
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const toggleBtn = document.getElementById('toggle-auth-mode');
    const loginEmailWrap = document.getElementById('login-email-wrap');
    const loginUsernameWrap = document.getElementById('login-username-wrap');
    const loginEmail = document.getElementById('login-email');
    const loginUsername = document.getElementById('login-username');
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');
    const activationForm = document.getElementById('secretary-activation-form');
    const roleSwitcher = document.getElementById('auth-role-switcher');
    const interactive = document.getElementById('auth-interactive');
    const availabilityPanel = document.getElementById('auth-availability-panel');
    const card = document.getElementById('login-form-container');

    if (secretarySetupToken) {
        activeAuthRole = ROLE_SECRETARY;
        activeAuthMode = 'activation';
        availabilityPanel?.classList.add('hidden');
        interactive?.classList.remove('hidden');
        roleSwitcher?.classList.add('hidden');
        loginForm?.classList.add('hidden');
        signupForm?.classList.add('hidden');
        toggleBtn?.classList.add('hidden');
        activationForm?.classList.remove('hidden');
        card?.classList.remove('auth-card--gated');
        card?.classList.add('auth-card--activation');
        if (title) title.innerText = 'Activate Secretary / Admin';
        if (subtitle) subtitle.innerText = 'This secure one-time link creates the school’s sole administrator account.';
        return;
    }

    card?.classList.remove('auth-card--activation');
    activationForm?.classList.add('hidden');

    if (schoolAuthState !== 'active') {
        interactive?.classList.add('hidden');
        card?.classList.add('auth-card--gated');
        renderAuthAvailabilityPanel(schoolAuthState);
        return;
    }

    availabilityPanel?.classList.add('hidden');
    interactive?.classList.remove('hidden');
    card?.classList.remove('auth-card--gated');
    roleSwitcher?.classList.remove('hidden');

    document.querySelectorAll('.auth-role-btn').forEach((btn) => {
        btn.classList.toggle('auth-role-btn-active', btn.dataset.authRole === activeAuthRole);
    });

    if (title) {
        title.innerText = `${getRoleLabel(activeAuthRole)} ${activeAuthMode === 'signup' ? 'Sign Up' : 'Login'}`;
    }
    if (subtitle) {
        subtitle.innerText = getRoleLoginDescription(activeAuthRole);
    }

    const roleUsesUsername = isRoleLogin(activeAuthRole);
    loginEmailWrap?.classList.toggle('hidden', roleUsesUsername);
    loginUsernameWrap?.classList.toggle('hidden', !roleUsesUsername);
    if (loginEmail) loginEmail.required = !roleUsesUsername;
    if (loginUsername) loginUsername.required = roleUsesUsername;

    if (activeAuthRole !== ROLE_TEACHER) {
        activeAuthMode = 'login';
        signupForm?.classList.add('hidden');
        loginForm?.classList.remove('hidden');
        toggleBtn?.classList.add('hidden');
    } else {
        toggleBtn?.classList.remove('hidden');
        const isSignup = activeAuthMode === 'signup';
        loginForm?.classList.toggle('hidden', isSignup);
        signupForm?.classList.toggle('hidden', !isSignup);
        if (toggleBtn) {
            toggleBtn.innerText = isSignup ? 'Already have an account? Login' : 'Need an account? Sign Up';
            toggleBtn.disabled = false;
            toggleBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

let authAvailabilityPromise = null;

async function initializeAuthAvailability() {
    if (authAvailabilityPromise) return authAvailabilityPromise;
    authAvailabilityPromise = (async () => {
    secretarySetupToken = readSecretarySetupToken();
    if (secretarySetupToken) {
        syncAuthRoleUi();
        return;
    }
    schoolAuthState = 'checking';
    syncAuthRoleUi();
    try {
        const { getSecretaryBootstrapStatus } = await loadSecretaryAdminRuntime();
        const status = await getSecretaryBootstrapStatus();
        schoolAuthState = status?.state === 'active' ? 'active' : 'locked';
    } catch (error) {
        console.warn('Could not verify Secretary activation status:', error?.message || error);
        schoolAuthState = 'error';
    }
    syncAuthRoleUi();
    })().finally(() => { authAvailabilityPromise = null; });
    return authAvailabilityPromise;
}

function setAuthRole(role) {
    activeAuthRole = role || ROLE_TEACHER;
    syncAuthRoleUi();
}

function setAuthMode(mode) {
    activeAuthMode = mode === 'signup' ? 'signup' : 'login';
    syncAuthRoleUi();
}

function setupAuthListeners() {
    document.querySelectorAll('.auth-role-btn').forEach((btn) => {
        btn.addEventListener('click', () => setAuthRole(btn.dataset.authRole || ROLE_TEACHER));
    });

    document.getElementById('toggle-auth-mode').addEventListener('click', (e) => {
        if (activeAuthRole !== ROLE_TEACHER) return;
        if (!isSchoolAuthOpen()) return;
        setAuthMode(activeAuthMode === 'signup' ? 'login' : 'signup');
    });

    document.getElementById('auth-availability-retry')?.addEventListener('click', () => {
        void initializeAuthAvailability();
    });

    document.getElementById('secretary-activation-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('auth-error');
        const username = normalizeUsername(document.getElementById('activation-username')?.value || '');
        const password = document.getElementById('activation-password')?.value || '';
        const displayName = document.getElementById('activation-display-name')?.value?.trim() || '';
        const schoolName = document.getElementById('activation-school-name')?.value?.trim() || '';
        try {
            beginAuthSubmit('activation');
            errorEl.innerText = '';
            const { activateSecretaryAdmin } = await loadSecretaryAdminRuntime();
            await activateSecretaryAdmin({ token: secretarySetupToken, username, password, displayName, schoolName });
            const identifier = buildSyntheticRoleEmail(ROLE_SECRETARY, username);
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
            secretarySetupToken = '';
            schoolAuthState = 'active';
            await signInWithEmailAndPassword(auth, identifier, password);
        } catch (error) {
            resetAuthSubmitState();
            errorEl.innerText = String(error?.message || error).replace('Firebase: ', '');
        }
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { identifier, rawUsername } = getRoleAwareLoginIdentifier();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('auth-error');
        try {
            if (!isSchoolAuthOpen()) {
                throw new Error('Login opens after the school Secretary/admin activates this school.');
            }
            beginAuthSubmit('login');
            errorEl.innerText = '';
            if (isRoleLogin(activeAuthRole) && !rawUsername) {
                throw new Error('Please enter your username.');
            }
            await signInWithEmailAndPassword(auth, identifier, password);
        } catch (error) {
            resetAuthSubmitState();
            errorEl.innerText = error.message.replace('Firebase: ', '');
        }
    });

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const errorEl = document.getElementById('auth-error');
        let resolveBootstrap;
        const bootstrapPromise = new Promise((resolve) => {
            resolveBootstrap = resolve;
        });
        pendingSignupBootstrap = bootstrapPromise;
        let createdUser = null;
        try {
            if (!isSchoolAuthOpen()) {
                throw new Error('Login and signup open after the school Secretary/admin activates this school.');
            }
            beginAuthSubmit('signup');
            errorEl.innerText = '';
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            createdUser = userCredential.user;
            await updateProfile(userCredential.user, { displayName: name });
            await loadAuthenticatedRuntime();
            const profile = await ensureTeacherUserProfile(userCredential.user);
            resolveBootstrap(profile);
        } catch (error) {
            resolveBootstrap(null);
            pendingSignupBootstrap = null;
            resetAuthSubmitState();
            errorEl.innerText = error.message.replace('Firebase: ', '');
            if (createdUser && auth.currentUser?.uid === createdUser.uid) {
                signupRecoveryContext = { uid: createdUser.uid, displayName: name, error };
                showSignupProfileRecovery(createdUser, name, error);
            }
        }
    });

    void initializeAuthAvailability();

    onAuthStateChanged(auth, async (user) => {
        const sessionId = ++authSessionId;
        document.documentElement?.removeAttribute('data-gcq-home-ready');
        const loadingScreen = document.getElementById('loading-screen');
        const authScreen = document.getElementById('auth-screen');
        const appScreen = document.getElementById('app-screen');

        if (user) {
            // A real interactive login/signup/activation just happened while the
            // auth screen was visible (as opposed to a silent session restore on
            // page load) — reopen the loading screen so it can crossfade back in
            // over the filled-in form and play the personalized "Welcome" moment.
            const cameFromAuthScreen = authScreen && !authScreen.classList.contains('hidden');
            if (cameFromAuthScreen) reopenLoadingScreen();
            try {
                await loadAuthenticatedRuntime();
                if (sessionId !== authSessionId || auth.currentUser?.uid !== user.uid) return;
                ensureAuthenticatedUiWired();
                state.set('currentUserId', user.uid);
                state.set('currentTeacherName', user.displayName || user.email || '');

                if (document.getElementById('teacher-name-input')) {
                    document.getElementById('teacher-name-input').value = user.displayName || '';
                }

                const newDate = getTodayDateString();
                if (newDate !== state.get('todaysStarsDate')) {
                    state.set('todaysStars', {});
                    state.set('todaysStarsDate', newDate);
                }

                const signupBootstrap = pendingSignupBootstrap;
                let profile;
                if (signupBootstrap) {
                    // Security rules intentionally deny configuration reads until
                    // the fixed-role signup profile exists.
                    profile = await signupBootstrap;
                    if (profile) await loadSubscription();
                } else {
                    const [subscriptionResult, profileResult] = await Promise.allSettled([
                        loadSubscription(),
                        loadUserProfile(user)
                    ]);
                    if (profileResult.status === 'rejected') throw profileResult.reason;
                    profile = profileResult.value;
                    if (profile && subscriptionResult.status === 'rejected') {
                        throw subscriptionResult.reason;
                    }
                }
                if (signupBootstrap === pendingSignupBootstrap) pendingSignupBootstrap = null;
                if (sessionId !== authSessionId || auth.currentUser?.uid !== user.uid) return;

                if (!profile && signupRecoveryContext?.uid === user.uid) {
                    showSignupProfileRecovery(user, signupRecoveryContext.displayName, signupRecoveryContext.error);
                    return;
                }

                const validRoles = new Set([ROLE_TEACHER, ROLE_SECRETARY, ROLE_PARENT]);
                if (!profile || profile.status !== 'active' || !validRoles.has(profile.role)) {
                    const inferredRole = getRoleFromSyntheticEmail(user.email);
                    const message = !profile
                        ? (inferredRole
                            ? `This ${getRoleLabel(inferredRole).toLowerCase()} account is missing its access profile. Recreate it from the teacher access screen.`
                            : 'This account is missing its required access profile. No school data was loaded; contact the school administrator.')
                        : 'This account is inactive or has an invalid role. No school data was loaded.';
                    resetAuthSubmitState();
                    document.getElementById('auth-error').innerText = message;
                    await signOut(auth);
                    return;
                }

                if (window.__GCQ_APP_CHECK_SITE_KEY__) {
                    void import('./firebaseAppCheck.js')
                        .then(({ getAppCheckInstance }) => getAppCheckInstance())
                        .catch((error) => console.warn('App Check initialization is temporarily unavailable:', error?.message || error));
                }
                ['app-screen', 'parent-screen', 'secretary-screen'].forEach((screenId) => {
                    document.getElementById(screenId)?.addEventListener('pointerdown', onFirstUserGesture, { once: true });
                });

                initializeHeaderQuote();
                state.setCurrentUserProfile(profile);
                state.setCurrentUserRole(profile.role);
                state.setCurrentTeacherName(profile.displayName || user.displayName || user.email || '');
                stageLoadingPersonalization(profile.displayName || user.displayName || '', profile.role);
                const isCurrentSession = () => sessionId === authSessionId && auth.currentUser?.uid === user.uid;
                if (profile.role === ROLE_PARENT) {
                    setupParentSession(user.uid, profile, async () => {
                        if (!isCurrentSession()) return;
                        const linkedStudentId = profile.linkedStudentId;
                        if (linkedStudentId) {
                            try {
                                const { db, doc, getDoc } = await import('./firebase.js');
                                const studentSnap = await getDoc(doc(db, 'artifacts/great-class-quest/public/data/students', linkedStudentId));
                                const enrollmentStatus = studentSnap.exists()
                                    ? (studentSnap.data()?.enrollmentStatus || 'active')
                                    : 'missing';
                                if (!studentSnap.exists() || enrollmentStatus === 'inactive') {
                                    resetAuthSubmitState();
                                    const authError = document.getElementById('auth-error');
                                    if (authError) {
                                        authError.innerText = 'This family login is no longer active. Contact the school if you need help.';
                                    }
                                    await signOut(auth);
                                    return;
                                }
                            } catch (studentCheckError) {
                                console.warn('Could not verify linked student for parent session:', studentCheckError);
                            }
                        }
                        await routeAuthenticatedParent({ loadingScreen, authScreen });
                        await waitForLoadingScreenSettled(loadingScreen);
                        if (isCurrentSession()) offerDeviceCacheChoice(profile.role);
                    });
                } else {
                    void setupDataListeners(user.uid, newDate, async function onInitialDataReady() {
                        if (!isCurrentSession()) return;
                        if (profile.role === ROLE_SECRETARY) {
                            await routeAuthenticatedSecretary({ user, loadingScreen, authScreen });
                        } else {
                            await routeAuthenticatedTeacher({ user, loadingScreen, authScreen, appScreen });
                        }
                        await waitForLoadingScreenSettled(loadingScreen);
                        if (isCurrentSession()) offerDeviceCacheChoice(profile.role);
                    }, {
                        role: profile.role,
                        profile,
                        onInitializationError: (error) => {
                            if (isCurrentSession()) showInitializationRecovery(error);
                        }
                    }).catch((error) => {
                        if (isCurrentSession()) showInitializationRecovery(error);
                    });
                }
            } catch (error) {
                if (sessionId === authSessionId) showInitializationRecovery(error);
            }

        } else {
            resetAuthSubmitState();
            if (state) state.resetState();
            if (audioModulePromise) {
                audioModulePromise.then((audio) => {
                    audio.stopAllCeremonyAudio?.();
                    audio.stopDrumRoll?.();
                    audio.stopWritingLoop?.();
                }).catch(() => {});
            }
            appScreen.classList.add('hidden');
            document.getElementById('parent-screen')?.classList.add('hidden');
            document.getElementById('secretary-screen')?.classList.add('hidden');
            const subScreen = document.getElementById('subscribe-screen');
            if (subScreen) subScreen.classList.add('hidden');
            authScreen.classList.remove('hidden');
            setSecretaryReturnButtonVisible(false);
            secretarySetupToken = readSecretarySetupToken();
            if (secretarySetupToken) {
                syncAuthRoleUi();
            } else {
                schoolAuthState = 'checking';
                setAuthRole(ROLE_TEACHER);
                setAuthMode('login');
                void initializeAuthAvailability();
            }
            animateLoadingScreenOut(loadingScreen);
        }
    });
}

async function initApp() {
    try {
        document.querySelectorAll('input').forEach(input => input.setAttribute('autocomplete', 'off'));

        setupAuthListeners();
        // --- FIXED SECTION START ---
        // Dynamic Wallpaper Toggle Listeners
        const projBtn = document.getElementById('projector-mode-btn');
        if (projBtn) {
            projBtn.addEventListener('click', async () => {
                const { toggleWallpaperMode: toggle } = await import('./ui/wallpaper.js');
                toggle();
            });
        }

        const exitWallBtn = document.getElementById('exit-wallpaper-btn');
        if (exitWallBtn) {
            exitWallBtn.addEventListener('click', async () => {
                const { toggleWallpaperMode: toggle } = await import('./ui/wallpaper.js');
                toggle();
            });
        }
        // --- FIXED SECTION END ---

        let clockInterval = setInterval(updateDateTime, 1000);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearInterval(clockInterval);
            } else {
                updateDateTime();
                clockInterval = setInterval(updateDateTime, 1000);
            }
        });

        try {
            const { startSkyTheater } = await import('./features/skyTheater.js');
            startSkyTheater();
        } catch (e) {
            console.warn('Sky Theater failed to start', e);
        }
        // Audio is initialized on first user gesture (mousedown/touchstart) to satisfy browser autoplay policy

        // Solar sync should wait for school settings so we do not
        // fetch once for the Athens fallback and again for the saved school.

    } catch (error) {
        console.error("Application initialization failed:", error);
        document.getElementById('loading-screen').innerHTML = `<div class="font-title text-3xl text-red-700">Error: Could not start app</div><p class="text-red-600 mt-4">${error.message}</p>`;
    }
}

setAuthRole(ROLE_TEACHER);
setAuthMode('login');
initApp();
