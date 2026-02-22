// /app.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { db, auth } from './firebase.js';
import { firebaseConfig } from './constants.js';
import * as state from './state.js';
import { setupDataListeners } from './db/listeners.js';
import { setupUIListeners } from './ui/core.js';
import { setupSounds, activateAudioContext } from './audio.js';
import { updateDateTime, getTodayDateString, fetchSolarCycle } from './utils.js';
import { archivePreviousDayStars } from './db/listeners.js';
import { toggleWallpaperMode } from './ui/wallpaper.js';
import { initializeHeaderQuote } from './features/home.js';
import * as utils from './utils.js';

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    updateProfile,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

let soundSetupStarted = false;
function onFirstUserGesture() {
    activateAudioContext();
    if (!soundSetupStarted) {
        soundSetupStarted = true;
        setupSounds(); // Defer so AudioContext is created after user gesture (avoids console warning)
    }
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

            setupDataListeners(user.uid, newDate);

            authScreen.classList.add('auth-screen-out');
            appScreen.classList.remove('hidden');
            appScreen.classList.add('app-screen-in');

            setTimeout(() => {
                authScreen.classList.add('hidden');
                authScreen.classList.remove('auth-screen-out');
                appScreen.classList.remove('app-screen-in');
            }, 500);

            // Force Home Tab on Login (Bypass Persistence)
            import('./ui/tabs.js').then(tabs => tabs.showTab('about-tab'));

            loadingScreen.classList.add('opacity-0');
            setTimeout(() => {
                loadingScreen.classList.add('pointer-events-none');
            }, 500);

        } else {
            state.resetState();
            appScreen.classList.add('hidden');
            authScreen.classList.remove('hidden');
            loadingScreen.classList.add('opacity-0');
            setTimeout(() => {
                loadingScreen.classList.add('pointer-events-none');
            }, 500);
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
