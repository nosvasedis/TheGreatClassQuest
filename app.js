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
import { initializeHeaderQuote } from './features/home.js';
import * as utils from './utils.js';
import { loadSubscription, hasActiveSubscription, getTier } from './utils/subscription.js';
import { isSetupNeeded, showSetupScreen } from './features/schoolSetup.js';

function updateTierLabel() {
    const tierEl = document.getElementById('app-tier-label');
    if (!tierEl) return;
    const t = getTier();
    const pretty = t === 'elite' ? 'Elite' : t === 'pro' ? 'Pro' : t === 'expired' ? 'Expired' : 'Starter';
    tierEl.textContent = `Plan: ${pretty}`;
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

function showSubscribeScreen(loadingScreen, authScreen) {
    authScreen.classList.add('hidden');
    const subscribeScreen = document.getElementById('subscribe-screen');
    const actionsEl = document.getElementById('subscribe-actions');
    const refreshHint = document.getElementById('subscribe-refresh-hint');
    const titleEl = subscribeScreen?.querySelector('h1');
    const descEl = subscribeScreen?.querySelector('.text-gray-600');
    if (!subscribeScreen || !actionsEl) return;

    const expired = getTier() === 'expired';
    if (titleEl) titleEl.textContent = expired ? 'Your subscription has ended' : 'Subscribe to get started';
    if (descEl) descEl.textContent = expired ? 'Resubscribe to continue using The Great Class Quest.' : 'Choose a plan to unlock The Great Class Quest for your school.';

    const schoolId = BILLING_SCHOOL_ID || firebaseConfig?.projectId || '';
    const billingUrl = (BILLING_BASE_URL || '').replace(/\/$/, '');

    if (billingUrl && schoolId) {
        actionsEl.innerHTML = `
            <button type="button" id="subscribe-starter-btn" class="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-title text-xl py-3 rounded-xl mb-3">Subscribe to Starter</button>
            <button type="button" id="subscribe-pro-btn" class="w-full bg-sky-500 hover:bg-sky-600 text-white font-title text-xl py-3 rounded-xl mb-3">Subscribe to Pro</button>
            <button type="button" id="subscribe-elite-btn" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-title text-xl py-3 rounded-xl">Subscribe to Elite</button>
        `;
        refreshHint.classList.remove('hidden');

        const goCheckout = async (tier) => {
            try {
                const res = await fetch(billingUrl + '/create-checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        schoolId,
                        tier,
                        successUrl: window.location.href,
                        cancelUrl: window.location.href
                    })
                });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
                else actionsEl.insertAdjacentHTML('beforeend', `<p class="text-red-600 text-sm mt-2">${data.error || 'Checkout failed'}</p>`);
            } catch (e) {
                console.error(e);
                actionsEl.insertAdjacentHTML('beforeend', '<p class="text-red-600 text-sm mt-2">Could not open checkout. Try again or contact support.</p>');
            }
        };

        document.getElementById('subscribe-starter-btn').addEventListener('click', () => goCheckout('starter'));
        document.getElementById('subscribe-pro-btn').addEventListener('click', () => goCheckout('pro'));
        document.getElementById('subscribe-elite-btn').addEventListener('click', () => goCheckout('elite'));
    } else {
        actionsEl.innerHTML = '<p class="text-gray-600">Contact us to get started and choose your plan.</p>';
    }

    subscribeScreen.classList.remove('hidden');
    if (loadingScreen) animateLoadingScreenOut(loadingScreen);
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
            await signInWithEmailAndPassword(auth, email, password);
            errorEl.innerText = '';
        } catch (error) {
            errorEl.innerText = error.message.replace('Firebase: ', '');
        }
    });

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const errorEl = document.getElementById('auth-error');
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            state.set('currentTeacherName', name);
            errorEl.innerText = '';
        } catch (error) {
            errorEl.innerText = error.message.replace('Firebase: ', '');
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

            if (!hasActiveSubscription()) {
                showSubscribeScreen(loadingScreen, authScreen);
                return;
            }

            setupDataListeners(user.uid, newDate, function onInitialDataReady() {
                authScreen.classList.add('auth-screen-out');
                setTimeout(() => {
                    authScreen.classList.add('hidden');
                    authScreen.classList.remove('auth-screen-out');
                }, 500);

                if (isSetupNeeded()) {
                    showSetupScreen();
                    animateLoadingScreenOut(loadingScreen);
                } else {
                    appScreen.classList.remove('hidden');
                    appScreen.classList.add('app-screen-in');
                    setTimeout(() => appScreen.classList.remove('app-screen-in'), 500);
                    import('./ui/tabs.js').then(tabs => tabs.showTab('about-tab'));
                    dismissLoadingAfterHomeIsReady(loadingScreen);
                }
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
