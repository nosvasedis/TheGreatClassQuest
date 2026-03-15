// /app.js

import { injectHTML } from './templates/index.js';
injectHTML();

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { db, auth } from './firebase.js';
import { firebaseConfig, BILLING_BASE_URL, BILLING_SCHOOL_ID } from './constants.js';
import * as state from './state.js';
import { setupDataListeners } from './db/listeners.js';
import { setupUIListeners } from './ui/core.js';
import { setupSounds, activateAudioContext } from './audio.js';
import { updateDateTime, getTodayDateString, fetchSolarCycle } from './utils.js';
import { archivePreviousDayStars } from './db/listeners.js';
import { toggleWallpaperMode } from './ui/wallpaper.js';
import { initializeHeaderQuote, maybeAutoShowGuideForTeacher } from './features/home.js';
import * as utils from './utils.js';
import { loadSubscription, hasActiveSubscription, getTier, getSubscriptionSnapshot, setSchoolGraceConfig } from './utils/subscription.js';
import { showSetupScreen } from './features/schoolSetup.js';
import { loadTeacherJourneyState, markTeacherOnboardingComplete, startSchoolGracePeriod } from './features/teacherJourney.js';
import { requestCheckoutSession } from './utils/billingCheckout.js';

function updateTierLabel() {
    const tierEl = document.getElementById('app-tier-label');
    if (!tierEl) return;
    const config = getSubscriptionSnapshot();
    const t = getTier();
    const pretty = t === 'elite' ? 'Elite' : t === 'pro' ? 'Pro' : t === 'expired' ? 'Expired' : t === 'pending' ? 'Pending' : 'Starter';
    tierEl.textContent = config?.isGracePeriod ? 'Plan: Starter (Grace Day)' : `Plan: ${pretty}`;
}
window.addEventListener('gcq-subscription-updated', updateTierLabel);

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    updateProfile,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

let soundSetupStarted = false;

const HOME_READY_FALLBACK_MS = 4500;

function animateLoadingScreenOut(loadingScreen) {
    if (!loadingScreen || loadingScreen.dataset.exiting === 'true') return;

    loadingScreen.dataset.exiting = 'true';
    loadingScreen.classList.add('loading-screen-exit');

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
}

function dismissLoadingAfterHomeIsReady(loadingScreen) {
    if (!loadingScreen) return;

    let isSettled = false;
    const settle = () => {
        if (isSettled) return;
        isSettled = true;
        document.removeEventListener('home:rendered', onHomeRendered);
        animateLoadingScreenOut(loadingScreen);
    };

    const onHomeRendered = () => {
        requestAnimationFrame(settle);
    };

    document.addEventListener('home:rendered', onHomeRendered, { once: true });
    setTimeout(settle, HOME_READY_FALLBACK_MS);
}

function onFirstUserGesture() {
    activateAudioContext();
    if (!soundSetupStarted) {
        soundSetupStarted = true;
        setupSounds(); // Defer so AudioContext is created after user gesture (avoids console warning)
    }
}

function setAuthSubmitLoading(mode, isLoading) {
    const submitBtn = document.getElementById(mode === 'signup' ? 'signup-submit-btn' : 'login-submit-btn');
    const toggleBtn = document.getElementById('toggle-auth-mode');
    if (!submitBtn) return;

    submitBtn.disabled = isLoading;
    if (toggleBtn) toggleBtn.disabled = isLoading;
    submitBtn.innerHTML = isLoading
        ? `<i class="fas fa-spinner fa-spin"></i><span>${mode === 'signup' ? 'Creating your account...' : 'Signing you in...'}</span>`
        : `<span class="auth-submit-label">${mode === 'signup' ? 'Sign Up' : 'Login'}</span>`;
}

function hideAuthScreen(authScreen) {
    authScreen.classList.add('auth-screen-out');
    setTimeout(() => {
        authScreen.classList.add('hidden');
        authScreen.classList.remove('auth-screen-out');
    }, 500);
}

async function openMainAppForTeacher({ user, loadingScreen, authScreen, appScreen }) {
    hideAuthScreen(authScreen);
    appScreen.classList.remove('hidden');
    appScreen.classList.add('app-screen-in');
    setTimeout(() => appScreen.classList.remove('app-screen-in'), 500);
    import('./ui/tabs.js').then((tabs) => tabs.showTab('about-tab'));
    dismissLoadingAfterHomeIsReady(loadingScreen);
    await maybeAutoShowGuideForTeacher(user);
}

function showSubscribeScreen(loadingScreen, authScreen, options = {}) {
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
                <div class="rounded-2xl border ${options.graceExpired ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'} p-5 text-left">
                    <h3 class="font-title text-2xl ${options.graceExpired ? 'text-amber-800' : 'text-emerald-800'} mb-2">
                        ${options.graceExpired ? 'The 1-day grace period has ended' : 'Brand-new school? Start a 1-day grace period'}
                    </h3>
                    <p class="text-sm text-slate-700 leading-relaxed">
                        ${options.graceExpired
                            ? 'This school already used its free setup day. To unlock the app again, choose a plan below and complete payment.'
                            : 'Use this only for the very first setup of a brand-new school. GCQ unlocks Starter-level access for 24 hours so the first teacher can set everything up before paying.'
                        }
                    </p>
                    ${options.canStartGrace ? `
                        <button type="button" id="subscribe-start-grace-btn" class="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-title text-lg py-3 px-5 rounded-xl bubbly-button flex items-center gap-2">
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
        subscribeScreen.querySelector('.max-w-4xl').appendChild(msg);
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
        await markTeacherOnboardingComplete(user, { migratedFromExistingTeacherData: true });
        needsTeacherSetup = false;
    }

    if (!hasActiveSubscription()) {
        const schoolGrace = state.get('schoolBillingGrace');
        const canStartGrace = !schoolGrace?.used && allSchoolClasses.length === 0;
        showSubscribeScreen(loadingScreen, authScreen, {
            canStartGrace,
            graceExpired: Boolean(schoolGrace?.expired),
            onStartGrace: async () => {
                const graceWindow = await startSchoolGracePeriod();
                state.setSchoolBillingGrace(graceWindow);
                setSchoolGraceConfig(graceWindow);
                await routeAuthenticatedTeacher({ user, loadingScreen, authScreen, appScreen });
            }
        });
        return;
    }

    const isFirstTeacher = allSchoolClasses.length === 0;
    const shouldCollectSchoolName = isFirstTeacher || !state.get('schoolName');

    if (needsTeacherSetup) {
        hideAuthScreen(authScreen);
        showSetupScreen({
            user,
            isFirstTeacher,
            shouldCollectSchoolName,
            onComplete: async () => {
                await openMainAppForTeacher({ user, loadingScreen, authScreen, appScreen });
            }
        });
        animateLoadingScreenOut(loadingScreen);
        return;
    }

    await openMainAppForTeacher({ user, loadingScreen, authScreen, appScreen });
}

function setupAuthListeners() {
    document.body.addEventListener('mousedown', onFirstUserGesture, { once: true });
    document.body.addEventListener('touchstart', onFirstUserGesture, { once: true });

    document.getElementById('toggle-auth-mode').addEventListener('click', (e) => {
        const login = document.getElementById('login-form');
        const signup = document.getElementById('signup-form');
        const title = document.getElementById('auth-title');
        const toggleBtn = document.getElementById('toggle-auth-mode');

        if (login.classList.contains('hidden')) {
            login.classList.remove('hidden');
            signup.classList.add('hidden');
            title.innerText = 'Teacher Login';
            toggleBtn.innerText = 'Need an account? Sign Up';
        } else {
            login.classList.add('hidden');
            signup.classList.remove('hidden');
            title.innerText = 'Teacher Sign Up';
            toggleBtn.innerText = 'Already have an account? Login';
        }
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('auth-error');
        try {
            setAuthSubmitLoading('login', true);
            await signInWithEmailAndPassword(auth, email, password);
            errorEl.innerText = '';
        } catch (error) {
            errorEl.innerText = error.message.replace('Firebase: ', '');
        } finally {
            setAuthSubmitLoading('login', false);
        }
    });

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const errorEl = document.getElementById('auth-error');
        try {
            setAuthSubmitLoading('signup', true);
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            state.set('currentTeacherName', name);
            errorEl.innerText = '';
        } catch (error) {
            errorEl.innerText = error.message.replace('Firebase: ', '');
        } finally {
            setAuthSubmitLoading('signup', false);
        }
    });

    onAuthStateChanged(auth, async (user) => {
        const loadingScreen = document.getElementById('loading-screen');
        const authScreen = document.getElementById('auth-screen');
        const appScreen = document.getElementById('app-screen');

        if (user) {
            state.set('currentUserId', user.uid);
            state.set('currentTeacherName', user.displayName);

            initializeHeaderQuote();

            if (document.getElementById('teacher-name-input')) {
                document.getElementById('teacher-name-input').value = user.displayName || '';
            }

            const newDate = getTodayDateString();
            await archivePreviousDayStars(user.uid, newDate);
            if (newDate !== state.get('todaysStarsDate')) {
                state.set('todaysStars', {});
                state.set('todaysStarsDate', newDate);
            }

            await loadSubscription();

            setupDataListeners(user.uid, newDate, async function onInitialDataReady() {
                await routeAuthenticatedTeacher({ user, loadingScreen, authScreen, appScreen });
            });

        } else {
            state.resetState();
            appScreen.classList.add('hidden');
            const subScreen = document.getElementById('subscribe-screen');
            if (subScreen) subScreen.classList.add('hidden');
            authScreen.classList.remove('hidden');
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
            projBtn.addEventListener('click', () => {
                toggleWallpaperMode();
            });
        }

        const exitWallBtn = document.getElementById('exit-wallpaper-btn');
        if (exitWallBtn) {
            exitWallBtn.addEventListener('click', () => {
                toggleWallpaperMode();
            });
        }
        // --- FIXED SECTION END ---

        setupUIListeners();

        updateDateTime();
        setInterval(updateDateTime, 1000);

        // Audio is initialized on first user gesture (mousedown/touchstart) to satisfy browser autoplay policy

        utils.fetchSolarCycle(); // Fetch sunrise/sunset times

    } catch (error) {
        console.error("Application initialization failed:", error);
        document.getElementById('loading-screen').innerHTML = `<div class="font-title text-3xl text-red-700">Error: Could not start app</div><p class="text-red-600 mt-4">${error.message}</p>`;
    }
}

initApp();
