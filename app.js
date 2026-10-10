// /app.js

import { injectHTML } from './templates/index.js';
import { stageLoadingPersonalization, revealStagedLoadingPersonalization, reopenLoadingScreen } from './templates/loading.js';
import { playAuthGateEntrance, cancelAuthGate, playAuthGateArrival, playAuthGateExit, consumeGateExit, walkOutThroughGate } from './ui/authGate.js';
import { DEFAULT_SCHOOL_ID, FOUNDING_SCHOOL_NAME, FOUNDING_SCHOOL_SHORT_NAME, PUBLIC_DATA_PATH, getSchoolId, normalizeSchoolId, resolveProfileSchoolId, setSchoolId } from './utils/tenant.mjs';
import { readDeviceSchoolId, rememberDeviceSchoolId } from './utils/deviceSchool.mjs';
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
    sendPasswordResetEmail,
    updateProfile,
    signOut
} from './firebaseAuth.js';
import { updateDateTime, getTodayDateString, fetchSolarCycle } from './utils.js';
import * as utils from './utils.js';
import { buildSyntheticRoleEmail, getRoleFromSyntheticEmail, isRoleLogin, normalizeUsername, ROLE_PARENT, ROLE_SECRETARY, ROLE_TEACHER } from './utils/roles.js';
import {
    clearAuthError,
    consumeAuthDeepLinkRole,
    hideForgotPanel,
    paintAuthRoleCopy,
    readRememberedAuthRole,
    readRememberedUsername,
    rememberAuthRole,
    rememberAuthUsername,
    renderForgotPanel,
    resetPasswordPeeks,
    showAuthError,
    updateUsernameHint,
    wireAuthFieldHelpers
} from './ui/authScreen.js';
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
let stopSubscription;
let hasActiveSubscription;
let canUseFeature;
let getTier;
let getSubscriptionSnapshot;
let getSchoolAccessState;
let showSetupScreen;
let loadTeacherJourneyState;
let requestCheckoutSession;
let isOnlineBillingAvailable;
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
/** @type {'checking' | 'active' | 'locked' | 'error' | 'unknown'} */
let schoolAuthState = 'checking';
// The name the server returned for this device's school (empty for the founding school).
let deviceSchoolName = '';

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
    unknown: {
        eyebrow: 'School code',
        iconHtml: '<i class="fas fa-school" aria-hidden="true"></i>',
        title: 'We don’t know that school code',
        text: 'Check the code your school gave you, or choose another school below.'
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

// A teacher joining a school other than the founding one: the server checks the teacher code
// and writes the profile (rules let browsers create founding-school profiles only).
async function joinTeacherToSchool(user, { schoolId, joinCode, displayName }) {
    const { joinSchoolAsTeacher } = await loadSecretaryAdminRuntime();
    try {
        await joinSchoolAsTeacher({ schoolId, joinCode, displayName });
    } catch (error) {
        // A retry after a lost response finds the profile already written: that is success.
        if (error?.code !== 'functions/already-exists') throw error;
    }
    return loadUserProfile(user);
}

// The operator console opens with #operator while signed in (staff accounts only; the server
// decides who is the operator).
function maybeOpenOperatorConsole() {
    if (!auth.currentUser || window.location.hash !== '#operator') return;
    if (![ROLE_TEACHER, ROLE_SECRETARY].includes(state?.get?.('currentUserRole'))) return;
    import('./features/operatorConsole.js')
        .then(({ openOperatorConsole }) => openOperatorConsole())
        .catch((error) => console.warn('Operator console could not open:', error?.message || error));
}
window.addEventListener('hashchange', maybeOpenOperatorConsole);

// The school's name hangs over the gate as a banner, so everyone sees whose gate this is.
// Founding-school devices show Prodigies; a device that opened another school's link (or signed
// in there before) only ever shows that school, never the founding one.
function syncAuthSchoolUi() {
    const schoolId = getSchoolId();
    const isFounding = schoolId === DEFAULT_SCHOOL_ID;
    const change = document.getElementById('auth-school-change');
    const form = document.getElementById('auth-school-form');
    const line = document.getElementById('auth-school-line');
    line?.classList.toggle('hidden', Boolean(secretarySetupToken));
    const name = isFounding ? FOUNDING_SCHOOL_NAME : deviceSchoolName;
    renderAuthSchoolBanner(secretarySetupToken || schoolAuthState === 'unknown' ? '' : name, schoolId);
    if (change) {
        change.textContent = schoolAuthState === 'unknown' ? 'Enter a different school code'
            : (isFounding ? `Not from ${FOUNDING_SCHOOL_SHORT_NAME}? Enter your school code` : 'Not your school? Change it');
        change.classList.toggle('hidden', !form?.classList.contains('hidden'));
    }
    document.getElementById('signup-join-code-wrap')?.classList.toggle('hidden', isFounding);
}

function renderAuthSchoolBanner(name, schoolId) {
    const banner = document.getElementById('auth-school-banner');
    if (!banner) return;
    const key = name ? `${schoolId}|${name}` : '';
    if (banner.dataset.school === key) return;
    banner.dataset.school = key;
    banner.classList.toggle('hidden', !name);
    if (!name) return;
    banner.querySelector('[data-auth-school-name]').textContent = name;
    banner.querySelector('[data-auth-school-mark]').textContent = schoolMonogram(name);
    banner.setAttribute('aria-label', `You are signing in to ${name}`);
    // Unfurl once each time the school changes (transform/opacity only, no repaint loop).
    banner.classList.remove('is-unfurling');
    void banner.offsetWidth;
    banner.classList.add('is-unfurling');
}

// "Prodigies Language School" → "P", "Alpha Patras" → "AP".
function schoolMonogram(name) {
    const skip = /^(the|of|school|language|languages|centre|center|academy|institute|and|&)$/i;
    const words = String(name).split(/\s+/).filter((word) => word && !skip.test(word));
    const letters = (words.length ? words : String(name).split(/\s+/)).slice(0, 2).map((word) => Array.from(word)[0] || '');
    return letters.join('').toUpperCase() || '★';
}

function useDeviceSchool(schoolId) {
    const id = setSchoolId(schoolId);
    rememberDeviceSchoolId(id);
    deviceSchoolName = '';
    clearAuthError();
    document.getElementById('auth-school-form')?.classList.add('hidden');
    syncAuthSchoolUi();
    void initializeAuthAvailability();
}

function wireAuthSchoolPicker() {
    const form = document.getElementById('auth-school-form');
    const input = document.getElementById('auth-school-code');
    document.getElementById('auth-school-change')?.addEventListener('click', () => {
        form?.classList.remove('hidden');
        if (input) input.value = getSchoolId() === DEFAULT_SCHOOL_ID ? '' : getSchoolId();
        syncAuthSchoolUi();
        input?.focus();
    });
    document.getElementById('auth-school-cancel')?.addEventListener('click', () => {
        form?.classList.add('hidden');
        syncAuthSchoolUi();
    });
    form?.addEventListener('submit', (event) => {
        event.preventDefault();
        const typed = String(input?.value || '').trim();
        // An empty code goes back to the founding school.
        const id = typed ? normalizeSchoolId(typed) : DEFAULT_SCHOOL_ID;
        if (!id) {
            showAuthError({ title: 'That school code doesn’t look right', text: 'It uses lowercase letters, numbers and dashes, like alpha-patras.', field: '' }, { role: activeAuthRole });
            return;
        }
        useDeviceSchool(id);
    });
}

function showSignupProfileRecovery(user, displayName, originalError) {
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app-screen');
    const loadingScreen = document.getElementById('loading-screen');
    cancelAuthGate();
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
            const join = signupRecoveryContext?.join;
            const profile = join
                ? await joinTeacherToSchool(user, { ...join, displayName: displayName || user.displayName || '' })
                : await ensureTeacherUserProfile(user);
            if (!profile || profile.role !== ROLE_TEACHER || profile.status !== 'active') {
                throw new Error('The fixed teacher profile could not be verified.');
            }
            signupRecoveryContext = null;
            window.location.reload();
        } catch (error) {
            console.error('Teacher profile recovery failed:', error);
            button.disabled = false;
            button.textContent = 'Retry safely';
            showAuthError({
                title: 'We couldn’t finish setting up your account',
                text: 'Check the internet connection, then press “Retry safely” again.',
                field: ''
            }, { role: ROLE_TEACHER, form: 'signup' });
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
        ({ loadSubscription, stopSubscription, hasActiveSubscription, canUseFeature, getTier, getSubscriptionSnapshot, getSchoolAccessState } = subscriptionModule);
        ({ showSetupScreen } = schoolSetupModule);
        ({ loadTeacherJourneyState } = teacherJourneyModule);
        ({ requestCheckoutSession, isOnlineBillingAvailable } = billingModule);
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


let activeAuthRole = ROLE_TEACHER;
let activeAuthMode = 'login';
// Set when a QR code or link opened a specific door (e.g. ?login=parent).
let authArrivedByLink = false;

const INITIALIZATION_TIMEOUT_MS = 8000;
// How long the personalized "Welcome, Name!" greeting stays fully legible
// before the loading screen begins its exit/zoom-out animation.
const WELCOME_HOLD_MS = 2300;

function animateLoadingScreenOut(loadingScreen) {
    if (!loadingScreen || loadingScreen.dataset.exiting === 'true') return;

    loadingScreen.dataset.exiting = 'true';
    const revealedPersonalization = revealStagedLoadingPersonalization();

    if (revealedPersonalization) {
        loadingScreen.classList.add('loading-final-moment');
    }

    const beginExit = () => {
        requestAnimationFrame(() => {
            loadingScreen.classList.remove('loading-screen-from-gate');
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
        ? 'Activating the school…'
        : mode === 'signup'
            ? 'Creating your account…'
            : 'Opening the gate…';
    const idleLabel = mode === 'activation' ? 'Activate Secretary / Admin' : mode === 'signup' ? 'Create my account' : 'Sign in';
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

async function logoutWithLocalCleanup() {
    await import('./ui/questRemoteButton.js').then((m) => m.beforeSignOut()).catch(() => {});
    await walkOutThroughGate(() => signOut(auth));
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
        onSelectThread: (threadId) => watchCommunicationThread(threadId)
    });
}

async function openMainAppForTeacher({ user, loadingScreen, authScreen, appScreen }) {
    // The School Office is the secretary's whole app; they never enter the Teacher App.
    if (state.get('currentUserRole') === ROLE_SECRETARY) {
        await openSecretaryConsole({ loadingScreen, authScreen });
        return;
    }
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
    resetAuthSubmitState();
    animateLoadingScreenOut(loadingScreen);
}

// What the plan screen says for each situation. Families never see prices.
const PLAN_SCREEN_COPY = {
    pending: {
        eyebrow: 'Your adventure starts here',
        headline: 'Make every lesson an adventure',
        lead: 'Your school is ready. Choose the plan that fits and start your Quest today.'
    },
    expired: {
        eyebrow: 'Welcome back',
        headline: 'Your Quest is waiting for you',
        lead: 'Renew your plan and pick up exactly where you left off. Every star, story and diary page is safe and waiting.'
    },
    suspended: {
        eyebrow: 'A short pause',
        paused: 'Your school’s access is paused for now, and everything you have created is safe. Get in touch with us and we will have you back on your Quest in no time.'
    },
    family: {
        eyebrow: 'A short pause',
        paused: 'Your child’s school has paused The Great Class Quest for a little while. Every star and story is safe. Please contact the school office for more.'
    }
};

function showSubscribeScreen(loadingScreen, authScreen, { audience = 'staff' } = {}) {
    resetAuthSubmitState();
    authScreen.classList.add('hidden');
    document.getElementById('app-screen')?.classList.add('hidden');
    document.getElementById('setup-screen')?.classList.add('hidden');
    const subscribeScreen = document.getElementById('subscribe-screen');
    if (!subscribeScreen) return;
    const byId = (id) => document.getElementById(id);
    const status = byId('subscribe-status');

    const accessState = getSchoolAccessState();
    const situation = audience === 'family' ? 'family' : (accessState === 'suspended' ? 'suspended' : accessState === 'expired' ? 'expired' : 'pending');
    const canBuy = situation === 'pending' || situation === 'expired';
    const copy = PLAN_SCREEN_COPY[situation];
    byId('subscribe-eyebrow').textContent = copy.eyebrow;
    byId('subscribe-headline').classList.toggle('hidden', !canBuy);
    byId('subscribe-lead').classList.toggle('hidden', !canBuy);
    if (canBuy) {
        byId('subscribe-headline').textContent = copy.headline;
        byId('subscribe-lead').textContent = copy.lead;
    }
    byId('subscribe-school-name').textContent = state.get('schoolName') || '';
    byId('subscribe-plans').classList.toggle('hidden', !canBuy);
    byId('subscribe-paused').classList.toggle('hidden', canBuy);
    byId('subscribe-paused-text').textContent = copy.paused || '';
    if (status) {
        status.classList.add('hidden');
        status.textContent = '';
    }
    byId('subscribe-refresh-hint')?.classList.toggle('hidden', !canBuy);
    byId('subscribe-signout-btn').onclick = () => signOut(auth).catch(() => {});
    const backToPlans = byId('subscribe-back-to-plans');
    if (backToPlans) backToPlans.onclick = () => byId('subscribe-plan-cards')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Yearly / Monthly switch: shows that price on every plan and is what checkout uses.
    let billingInterval = 'year';
    const intervalButtons = subscribeScreen.querySelectorAll('#subscribe-interval-switch [data-billing-interval]');
    const showInterval = (interval) => {
        billingInterval = interval === 'month' ? 'month' : 'year';
        intervalButtons.forEach((button) => {
            const on = button.dataset.billingInterval === billingInterval;
            button.setAttribute('aria-pressed', on ? 'true' : 'false');
            button.classList.toggle('bg-indigo-600', on);
            button.classList.toggle('text-white', on);
            button.classList.toggle('shadow', on);
            button.classList.toggle('text-slate-600', !on);
        });
        subscribeScreen.querySelectorAll('[data-price-interval]').forEach((block) => {
            block.classList.toggle('hidden', block.dataset.priceInterval !== billingInterval);
        });
    };
    intervalButtons.forEach((button) => {
        button.onclick = () => showInterval(button.dataset.billingInterval);
    });
    showInterval('year');

    const planButtons = ['starter', 'pro', 'elite'].map((tier) => byId(`subscribe-${tier}-btn`)).filter(Boolean);
    if (canBuy && isOnlineBillingAvailable()) {
        planButtons.forEach((button) => {
            const tier = button.id.replace('subscribe-', '').replace('-btn', '');
            button.classList.remove('hidden');
            button.onclick = async () => {
                if (status) {
                    status.classList.add('hidden');
                    status.textContent = '';
                }
                planButtons.forEach((other) => { other.disabled = true; });
                button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Opening secure payment…';
                try {
                    const data = await requestCheckoutSession({
                        tier,
                        interval: billingInterval,
                        successUrl: window.location.href,
                        cancelUrl: window.location.href
                    });
                    window.location.assign(data.url);
                } catch (e) {
                    console.error(e);
                    if (status) {
                        status.textContent = e.message || 'Could not open checkout right now.';
                        status.classList.remove('hidden');
                    }
                    planButtons.forEach((other) => { other.disabled = false; });
                    button.textContent = button.dataset.planLabel || 'Choose';
                }
            };
        });
    } else if (canBuy) {
        // Only the founding school cannot pay online, and it never reaches this screen.
        planButtons.forEach((button) => button.classList.add('hidden'));
        if (status) {
            status.textContent = 'Online payment is not available for this school. Please contact us to choose a plan.';
            status.classList.remove('hidden');
        }
    }

    subscribeScreen.scrollTop = 0;
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
        showSubscribeScreen(loadingScreen, authScreen);
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
        showSubscribeScreen(loadingScreen, authScreen);
        return;
    }
    await openSecretaryConsole({ loadingScreen, authScreen });
}

async function routeAuthenticatedParent({ loadingScreen, authScreen }) {
    if (!hasActiveSubscription() || !canUseFeature('parentAccess')) {
        showSubscribeScreen(loadingScreen, authScreen, { audience: 'family' });
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
        paintAuthRoleCopy(ROLE_SECRETARY, { activation: true });
        return;
    }

    card?.classList.remove('auth-card--activation');
    activationForm?.classList.add('hidden');

    if (schoolAuthState !== 'active') {
        interactive?.classList.add('hidden');
        card?.classList.add('auth-card--gated');
        paintAuthRoleCopy(activeAuthRole, { mode: 'login' });
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

    if (activeAuthRole !== ROLE_TEACHER) activeAuthMode = 'login';
    const heading = paintAuthRoleCopy(activeAuthRole, { mode: activeAuthMode, arrivedByLink: authArrivedByLink });
    if (title && heading) title.innerText = heading.title;
    if (subtitle && heading) subtitle.innerText = heading.subtitle;

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
            toggleBtn.innerText = isSignup ? 'Already have an account? Sign in' : 'New teacher? Create an account';
            toggleBtn.disabled = false;
            toggleBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

let authAvailabilityPromise = null;

// Once this device has seen the school open, the login form shows straight away and the
// server check runs in the background, instead of every visit waiting on it.
const SCHOOL_AUTH_OPEN_KEY = 'gcq.schoolAuthOpen';

function schoolAuthOpenKey() {
    const schoolId = getSchoolId();
    return schoolId === DEFAULT_SCHOOL_ID ? SCHOOL_AUTH_OPEN_KEY : `${SCHOOL_AUTH_OPEN_KEY}.${schoolId}`;
}

function readSchoolAuthOpenHint() {
    try {
        return localStorage.getItem(schoolAuthOpenKey()) === '1';
    } catch (_) {
        return false;
    }
}

function writeSchoolAuthOpenHint(isOpen) {
    try {
        if (isOpen) localStorage.setItem(schoolAuthOpenKey(), '1');
        else localStorage.removeItem(schoolAuthOpenKey());
    } catch (_) { /* storage unavailable: the server check still decides */ }
}

async function initializeAuthAvailability() {
    if (authAvailabilityPromise) return authAvailabilityPromise;
    authAvailabilityPromise = (async () => {
    secretarySetupToken = readSecretarySetupToken();
    if (secretarySetupToken) {
        syncAuthRoleUi();
        syncAuthSchoolUi();
        return;
    }
    const knownOpen = readSchoolAuthOpenHint();
    schoolAuthState = knownOpen ? 'active' : 'checking';
    syncAuthRoleUi();
    let nextState;
    try {
        const { getSecretaryBootstrapStatus } = await loadSecretaryAdminRuntime();
        const status = await getSecretaryBootstrapStatus({ schoolId: getSchoolId() });
        nextState = status?.state === 'active' ? 'active' : (status?.state === 'unknown' ? 'unknown' : 'locked');
        deviceSchoolName = String(status?.schoolName || '');
        writeSchoolAuthOpenHint(nextState === 'active');
        syncAuthSchoolUi();
    } catch (error) {
        console.warn('Could not verify Secretary activation status:', error?.message || error);
        nextState = knownOpen ? 'active' : 'error';
    }
    if (nextState !== schoolAuthState) {
        schoolAuthState = nextState;
        syncAuthRoleUi();
        syncAuthSchoolUi();
    }
    })().finally(() => { authAvailabilityPromise = null; });
    return authAvailabilityPromise;
}

function setAuthRole(role) {
    const nextRole = role || ROLE_TEACHER;
    const changed = nextRole !== activeAuthRole;
    activeAuthRole = nextRole;
    if (changed) {
        clearAuthError();
        hideForgotPanel();
        prefillRememberedUsername();
    }
    syncAuthRoleUi();
}

function setAuthMode(mode) {
    const nextMode = mode === 'signup' ? 'signup' : 'login';
    if (nextMode !== activeAuthMode) {
        clearAuthError();
        hideForgotPanel();
    }
    activeAuthMode = nextMode;
    syncAuthRoleUi();
}

function prefillRememberedUsername() {
    const input = document.getElementById('login-username');
    if (!input || input.value.trim() || !isRoleLogin(activeAuthRole)) return;
    input.value = readRememberedUsername(activeAuthRole);
    updateUsernameHint();
}

// The door the sign-in screen opens on: a QR code or link first, then the role this device used last.
function resolveStartingAuthRole() {
    const linked = consumeAuthDeepLinkRole();
    if (linked) {
        authArrivedByLink = true;
        rememberAuthRole(linked);
        return linked;
    }
    return readRememberedAuthRole() || ROLE_TEACHER;
}

function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

async function sendTeacherPasswordReset(button) {
    const email = document.getElementById('login-email')?.value?.trim() || '';
    if (!looksLikeEmail(email)) {
        showAuthError({ title: 'Type your email first', text: 'We’ll send the reset link there.', field: 'email' }, { role: ROLE_TEACHER });
        return;
    }
    try {
        if (button) {
            button.disabled = true;
            button.textContent = 'Sending…';
        }
        await sendPasswordResetEmail(auth, email);
        hideForgotPanel();
        showAuthError({
            title: 'Check your inbox',
            text: ` If ${email} has an account, a reset link is on its way. Look in spam too.`,
            field: ''
        }, { role: ROLE_TEACHER, tone: 'notice' });
    } catch (error) {
        if (button) {
            button.disabled = false;
            button.textContent = 'Send reset link';
        }
        showAuthError(error, { role: ROLE_TEACHER });
    }
}

function setupAuthListeners() {
    setSchoolId(readDeviceSchoolId());
    wireAuthFieldHelpers();
    wireAuthSchoolPicker();
    syncAuthSchoolUi();
    document.querySelectorAll('.auth-role-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            authArrivedByLink = false;
            setAuthRole(btn.dataset.authRole || ROLE_TEACHER);
        });
    });

    document.getElementById('auth-forgot-btn')?.addEventListener('click', () => {
        clearAuthError();
        renderForgotPanel(activeAuthRole, {
            email: looksLikeEmail(document.getElementById('login-email')?.value) ? document.getElementById('login-email').value.trim() : '',
            onSendReset: sendTeacherPasswordReset
        });
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
        const username = normalizeUsername(document.getElementById('activation-username')?.value || '');
        const password = document.getElementById('activation-password')?.value || '';
        const displayName = document.getElementById('activation-display-name')?.value?.trim() || '';
        const schoolName = document.getElementById('activation-school-name')?.value?.trim() || '';
        const activationOptions = { role: ROLE_SECRETARY, form: 'activation' };
        if (!displayName) return showAuthError({ title: 'Please enter the administrator’s name', text: '', field: 'name' }, activationOptions);
        if (!username) return showAuthError({ title: 'Choose a username', text: 'Use English letters, numbers, dots or dashes.', field: 'id' }, activationOptions);
        if (password.length < 6) return showAuthError({ title: 'Choose a longer password', text: 'Use at least 6 characters.', field: 'password' }, activationOptions);
        try {
            beginAuthSubmit('activation');
            clearAuthError();
            const { activateSecretaryAdmin } = await loadSecretaryAdminRuntime();
            await activateSecretaryAdmin({ token: secretarySetupToken, username, password, displayName, schoolName, schoolId: getSchoolId() });
            const identifier = buildSyntheticRoleEmail(ROLE_SECRETARY, username);
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
            secretarySetupToken = '';
            schoolAuthState = 'active';
            await signInWithEmailAndPassword(auth, identifier, password);
        } catch (error) {
            resetAuthSubmitState();
            showAuthError(error, activationOptions);
        }
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { identifier, rawUsername } = getRoleAwareLoginIdentifier();
        const password = document.getElementById('login-password').value;
        const role = activeAuthRole;
        const options = { role, form: 'login' };
        hideForgotPanel();
        if (!isSchoolAuthOpen()) {
            showAuthError({ title: 'Sign-in isn’t open yet', text: 'It opens once the school office activates this school.', field: '' }, options);
            return;
        }
        if (isRoleLogin(role) ? !rawUsername : !identifier) {
            showAuthError({ title: isRoleLogin(role) ? 'Please enter your username' : 'Please enter your email', text: '', field: 'id' }, options);
            return;
        }
        if (!isRoleLogin(role) && !looksLikeEmail(identifier)) {
            showAuthError({ title: 'That email address doesn’t look right', text: 'It should look like name@example.com.', field: 'id' }, options);
            return;
        }
        if (!password) {
            showAuthError({ title: 'Please enter your password', text: '', field: 'password' }, options);
            document.getElementById('login-password')?.focus();
            return;
        }
        try {
            beginAuthSubmit('login');
            clearAuthError();
            resetPasswordPeeks();
            await signInWithEmailAndPassword(auth, identifier, password);
            rememberAuthRole(role);
            rememberAuthUsername(role, rawUsername, { trustedDevice: getDeviceCacheChoice() === 'trusted' });
        } catch (error) {
            resetAuthSubmitState();
            showAuthError(error, options);
        }
    });

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const signupOptions = { role: ROLE_TEACHER, form: 'signup' };
        if (!isSchoolAuthOpen()) {
            showAuthError({ title: 'Sign-up isn’t open yet', text: 'It opens once the school office activates this school.', field: '' }, signupOptions);
            return;
        }
        if (!name) return showAuthError({ title: 'Please tell us your name', text: 'Students will see it as their teacher’s name.', field: 'name' }, signupOptions);
        if (!looksLikeEmail(email)) return showAuthError({ title: 'That email address doesn’t look right', text: 'It should look like name@example.com.', field: 'email' }, signupOptions);
        if (password.length < 6) return showAuthError({ title: 'Choose a longer password', text: 'Use at least 6 characters.', field: 'password' }, signupOptions);
        const signupSchoolId = getSchoolId();
        const joinCode = document.getElementById('signup-join-code')?.value?.trim() || '';
        const joiningSchool = signupSchoolId !== DEFAULT_SCHOOL_ID;
        if (joiningSchool && !joinCode) return showAuthError({ title: 'Type your teacher code', text: 'Your school office gives every new teacher this code.', field: '' }, signupOptions);
        let resolveBootstrap;
        const bootstrapPromise = new Promise((resolve) => {
            resolveBootstrap = resolve;
        });
        pendingSignupBootstrap = bootstrapPromise;
        let createdUser = null;
        try {
            beginAuthSubmit('signup');
            clearAuthError();
            resetPasswordPeeks();
            if (joiningSchool) {
                // Check both codes before the login exists, so a typo never leaves a half-made account.
                const { verifyTeacherJoinCode } = await loadSecretaryAdminRuntime();
                await verifyTeacherJoinCode({ schoolId: signupSchoolId, joinCode });
            }
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            createdUser = userCredential.user;
            await updateProfile(userCredential.user, { displayName: name });
            await loadAuthenticatedRuntime();
            const profile = joiningSchool
                ? await joinTeacherToSchool(userCredential.user, { schoolId: signupSchoolId, joinCode, displayName: name })
                : await ensureTeacherUserProfile(userCredential.user);
            rememberAuthRole(ROLE_TEACHER);
            resolveBootstrap(profile);
        } catch (error) {
            resolveBootstrap(null);
            pendingSignupBootstrap = null;
            resetAuthSubmitState();
            showAuthError(error, signupOptions);
            if (createdUser && auth.currentUser?.uid === createdUser.uid) {
                signupRecoveryContext = { uid: createdUser.uid, displayName: name, error, join: joiningSchool ? { schoolId: signupSchoolId, joinCode } : null };
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
            // The sign-in card opens like a gate and the loading screen rises out of its light.
            const gateHandoff = cameFromAuthScreen
                ? playAuthGateEntrance({ onHandoff: () => reopenLoadingScreen({ fromGate: true }) })
                : null;
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
                let planSchoolId = getSchoolId();
                if (signupBootstrap) {
                    // Security rules intentionally deny configuration reads until
                    // the fixed-role signup profile exists.
                    profile = await signupBootstrap;
                    if (profile) await loadSubscription();
                } else {
                    planSchoolId = getSchoolId();
                    const [subscriptionResult, profileResult] = await Promise.allSettled([
                        loadSubscription(planSchoolId),
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
                // Every read and write below goes to this school's data root.
                const profileSchoolId = profile ? resolveProfileSchoolId(profile) : null;
                if (!profile || !profileSchoolId || profile.status !== 'active' || !validRoles.has(profile.role)) {
                    const inferredRole = getRoleFromSyntheticEmail(user.email);
                    const problemRole = inferredRole || profile?.role || activeAuthRole;
                    const message = !profile
                        ? {
                            title: 'This login isn’t set up completely',
                            text: inferredRole === ROLE_PARENT
                                ? ' Ask your child’s teacher or the school office to save the family login again.'
                                : ' Please contact the school office.',
                            field: ''
                        }
                        : {
                            title: 'This login is switched off',
                            text: profile.role === ROLE_PARENT || problemRole === ROLE_PARENT
                                ? ' The school has paused this family login. Contact your child’s teacher or the school office to turn it back on.'
                                : ' Please contact the school office.',
                            field: ''
                        };
                    resetAuthSubmitState();
                    await signOut(auth);
                    showAuthError(message, { role: problemRole });
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

                if (gateHandoff) {
                    await gateHandoff;
                    if (sessionId !== authSessionId || auth.currentUser?.uid !== user.uid) return;
                }
                setSchoolId(profileSchoolId);
                rememberDeviceSchoolId(profileSchoolId);
                // The plan was read in parallel with the profile, for the device's school. When the
                // profile belongs to another school, read that school's plan instead.
                if (profileSchoolId !== planSchoolId) {
                    await loadSubscription(profileSchoolId);
                    if (sessionId !== authSessionId || auth.currentUser?.uid !== user.uid) return;
                }
                rememberAuthRole(profile.role);
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
                                const studentSnap = await getDoc(doc(db, `${PUBLIC_DATA_PATH}/students`, linkedStudentId));
                                const enrollmentStatus = studentSnap.exists()
                                    ? (studentSnap.data()?.enrollmentStatus || 'active')
                                    : 'missing';
                                if (!studentSnap.exists() || enrollmentStatus === 'inactive') {
                                    resetAuthSubmitState();
                                    await signOut(auth);
                                    showAuthError({
                                        title: 'This family login is no longer active',
                                        text: ' Contact the school office if you need help.',
                                        field: ''
                                    }, { role: ROLE_PARENT });
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
                        if (isCurrentSession()) maybeOpenOperatorConsole();
                        if (isCurrentSession() && profile.role !== ROLE_SECRETARY) {
                            import('./ui/questRemoteButton.js').then((m) => m.onTeacherAppReady()).catch(() => {});
                            // The weekly deep reading of Chronicle notes (Elite): a quiet check, once a day, on idle.
                            setTimeout(() => {
                                const run = () => { if (isCurrentSession()) import('./ui/modals/noteAiReader.js').then((m) => m.maybeRunReadingRound()).catch(() => {}); };
                                if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 30000 });
                                else run();
                            }, 20000);
                        }
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
                if (gateHandoff) await gateHandoff;
                if (sessionId === authSessionId) showInitializationRecovery(error);
            }

        } else {
            cancelAuthGate();
            resetAuthSubmitState();
            import('./ui/questRemoteButton.js').then((m) => m.onSignedOut()).catch(() => {});
            stopSubscription?.();
            if (state) state.resetState();
            setSchoolId(readDeviceSchoolId());
            syncAuthSchoolUi();
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
            secretarySetupToken = readSecretarySetupToken();
            if (secretarySetupToken) {
                syncAuthRoleUi();
            } else {
                schoolAuthState = 'checking';
                resetPasswordPeeks();
                const passwordInput = document.getElementById('login-password');
                if (passwordInput) passwordInput.value = '';
                setAuthRole(activeAuthRole || readRememberedAuthRole() || ROLE_TEACHER);
                setAuthMode('login');
                void initializeAuthAvailability();
            }
            // Cold start: the card rises just as the loading screen's daylight clears.
            const loadingStillShowing = loadingScreen
                && !loadingScreen.classList.contains('hidden')
                && loadingScreen.dataset.exiting !== 'true';
            if (consumeGateExit()) playAuthGateExit();
            else playAuthGateArrival({ delayMs: loadingStillShowing ? 480 : 0 });
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

        import('./ui/quietDragonButton.js').then((m) => m.initQuietDragonButton()).catch((e) => console.warn('Quiet Dragon button failed to start', e));
        import('./ui/questRemoteButton.js').then((m) => m.initQuestRemoteButton()).catch((e) => console.warn('Quest Remote button failed to start', e));

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
        try {
            // Keeps the header, Award sky and Projector weather live (free Open-Meteo, every 20 min).
            const { startLiveSky } = await import('./features/liveWeather.js');
            startLiveSky();
        } catch (e) {
            console.warn('Live sky failed to start', e);
        }
        // Team Quest realm moments: stamps the Map Journal and plays the arrival banner.
        import('./features/realmMoments.js')
            .then(({ startRealmMoments }) => startRealmMoments())
            .catch((e) => console.warn('Realm moments failed to start', e));
        // Hero Seals: presses each child's personal milestones and tells the teacher.
        import('./features/heroSeals.js')
            .then(({ startHeroSeals }) => startHeroSeals())
            .catch((e) => console.warn('Hero Seals failed to start', e));
        // Realm Raid: the school's shared Guardian three times a year; pays each class its spoils.
        import('./features/realmRaid.js')
            .then(({ startRealmRaid }) => startRealmRaid())
            .catch((e) => console.warn('Realm Raid failed to start', e));
        // Audio is initialized on first user gesture (mousedown/touchstart) to satisfy browser autoplay policy

        // Solar sync should wait for school settings so we do not
        // fetch once for the Athens fallback and again for the saved school.

    } catch (error) {
        console.error("Application initialization failed:", error);
        document.getElementById('loading-screen').innerHTML = `<div class="font-title text-3xl text-red-700">Error: Could not start app</div><p class="text-red-600 mt-4">${error.message}</p>`;
    }
}

activeAuthRole = '';
setAuthRole(resolveStartingAuthRole());
setAuthMode('login');
initApp();
