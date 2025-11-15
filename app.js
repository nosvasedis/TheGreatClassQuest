// /app.js

// --- MODULE IMPORTS ---

// Core & Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { db, auth } from './firebase.js';
import { firebaseConfig } from './constants.js';
import * as state from './state.js';
import { setupDataListeners } from './db/listeners.js';
import { setupUIListeners } from './ui/core.js';
import { setupSounds, activateAudioContext } from './audio.js';
// THIS IS THE FIX: Import the correct date function
import { updateDateTime, getTodayDateString } from './utils.js';
import { archivePreviousDayStars } from './db/listeners.js';

// Firebase Auth specific imports
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    updateProfile,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


// --- AUTHENTICATION ---

function setupAuthListeners() {
    // Add event listeners to activate audio context on user interaction
    document.body.addEventListener('mousedown', activateAudioContext, { once: true });
    document.body.addEventListener('touchstart', activateAudioContext, { once: true });

    // Listener for toggling between Login and Sign Up forms
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

    // Listener for the Login form submission
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

    // Listener for the Sign Up form submission
    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const errorEl = document.getElementById('auth-error');
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            state.set('currentTeacherName', name); // Update state
            errorEl.innerText = '';
        } catch (error) {
            errorEl.innerText = error.message.replace('Firebase: ', '');
        }
    });

    // Main authentication state change handler
    onAuthStateChanged(auth, async (user) => {
        const loadingScreen = document.getElementById('loading-screen');
        const authScreen = document.getElementById('auth-screen');
        const appScreen = document.getElementById('app-screen');
        
        if (user) {
            // --- USER IS LOGGED IN ---
            state.set('currentUserId', user.uid);
            state.set('currentTeacherName', user.displayName);

            // Update UI with user's name
            document.getElementById('teacher-greeting').innerText = `Welcome, ${user.displayName || 'Teacher'}!`;
            if (document.getElementById('teacher-name-input')) {
                document.getElementById('teacher-name-input').value = user.displayName || '';
            }

            // Perform daily data management
            // THIS IS THE FIX: Use the consistent date format function
            const newDate = getTodayDateString(); 
            await archivePreviousDayStars(user.uid, newDate);
            if (newDate !== state.get('todaysStarsDate')) {
                state.set('todaysStars', {});
                state.set('todaysStarsDate', newDate);
            }

            // Start listening to real-time data
            setupDataListeners(user.uid, newDate);
            
            // FIX 3: Implement smooth transition from auth to app screen
            authScreen.classList.add('auth-screen-out');
            appScreen.classList.remove('hidden');
            appScreen.classList.add('app-screen-in');
            
            setTimeout(() => {
                authScreen.classList.add('hidden');
                authScreen.classList.remove('auth-screen-out'); // Clean up for next time
                appScreen.classList.remove('app-screen-in');   // Clean up for next time
            }, 500); // Match animation duration in style.css

            // Hide loading screen
            loadingScreen.classList.add('opacity-0');
            setTimeout(() => {
                loadingScreen.classList.add('pointer-events-none');
            }, 500);

        } else {
            // --- USER IS LOGGED OUT ---
            state.resetState(); // Reset all global state variables
            
            // Show the authentication screen
            appScreen.classList.add('hidden');
            authScreen.classList.remove('hidden');
            
            // Hide loading screen
            loadingScreen.classList.add('opacity-0');
            setTimeout(() => {
                loadingScreen.classList.add('pointer-events-none');
            }, 500);
        }
    });
}


// --- INITIALIZATION ---

async function initApp() {
    try {
        // Initialize Firebase (from firebase.js)
        // Note: app, auth, and db are already initialized and exported from firebase.js
        
        // Disable autocomplete on all inputs for a cleaner UI
        document.querySelectorAll('input').forEach(input => input.setAttribute('autocomplete', 'off'));
        
        // Set up all event listeners
        setupAuthListeners();
        setupUIListeners();
        
        // Start the date/time display and set it to update periodically
        updateDateTime();
        setInterval(updateDateTime, 30000);
        
        // Initialize the audio engine
        await setupSounds();

    } catch (error) {
        console.error("Application initialization failed:", error);
        document.getElementById('loading-screen').innerHTML = `<div class="font-title text-3xl text-red-700">Error: Could not start app</div><p class="text-red-600 mt-4">${error.message}</p>`;
    }
}

// Start the application

initApp();
