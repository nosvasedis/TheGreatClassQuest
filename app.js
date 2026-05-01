// /app.js

import { injectHTML } from './templates/index.js';
injectHTML();

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { db, auth } from './firebase.js';
import { firebaseConfig, BILLING_BASE_URL, BILLING_SCHOOL_ID } from './constants.js';
import * as state from './state.js';
import { setupDataListeners } from './db/listeners.js';
import { setupParentSession, watchCommunicationThread } from './db/listeners.js';
import { setupUIListeners } from './ui/core.js';
import { setupSounds, activateAudioContext } from './audio.js';
import { updateDateTime, getTodayDateString, fetchSolarCycle } from './utils.js';
import { archivePreviousDayStars } from './db/listeners.js';
import { toggleWallpaperMode } from './ui/wallpaper.js';
import { initializeHeaderQuote, maybeAutoShowGuideForTeacher } from './features/home.js';
import * as utils from './utils.js';
import { loadSubscription, hasActiveSubscription, canUseFeature, getTier, getSubscriptionSnapshot, setSchoolGraceConfig } from './utils/subscription.js';
import { showSetupScreen } from './features/schoolSetup.js';
import { loadTeacherJourneyState, markTeacherOnboardingComplete, startSchoolGracePeriod } from './features/teacherJourney.js';
import { requestCheckoutSession } from './utils/billingCheckout.js';
import { ensureTeacherUserProfile, loadUserProfile, touchCurrentUserProfile } from './db/userProfiles.js';
import { claimFoundingSchoolAdmin } from './utils/adminRuntime.js';
import { buildSyntheticRoleEmail, getRoleFromSyntheticEmail, getRoleLabel, getRoleLoginDescription, isRoleLogin, normalizeUsername, ROLE_PARENT, ROLE_SECRETARY, ROLE_TEACHER } from './utils/roles.js';
import { renderParentPortal, activateParentTab, wireParentPortalListeners } from './features/parentPortal.js';
import { renderSecretaryConsole, activateSecretaryTab, wireSecretaryConsoleListeners } from './features/secretaryConsole.js';

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
let activeAuthRole = ROLE_TEACHER;
let activeAuthMode = 'login';

const HOME_READY_FALLBACK_MS = 4500;
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
        copy.textContent = 'The school is temporarily unlocked so the first teacher can finish setup before payment is required.';
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

function beginAuthSubmit(mode) {
    setAuthSubmitLoading(mode, true);
}

function resetAuthSubmitState() {
    setAuthSubmitLoading('login', false);
    setAuthSubmitLoading('signup', false);
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

async function openMainAppForTeacher({ user, loadingScreen, authScreen, appScreen }) {
    hideAllExperienceScreens();
    hideAuthScreen(authScreen);
    appScreen.classList.remove('hidden');
    appScreen.classList.add('app-screen-in');
    setTimeout(() => appScreen.classList.remove('app-screen-in'), 500);
    const tabs = await import('./ui/tabs.js');
    await tabs.showTab('about-tab');
    resetAuthSubmitState();
    dismissLoadingAfterHomeIsReady(loadingScreen);
    if (state.get('currentUserRole') === ROLE_TEACHER) {
        await maybeAutoShowGuideForTeacher(user);
    }
}

async function openParentPortal({ loadingScreen, authScreen }) {
    hideAllExperienceScreens();
    hideAuthScreen(authScreen);
    const parentScreen = document.getElementById('parent-screen');
    if (parentScreen) parentScreen.classList.remove('hidden');
    activateParentTab('overview');
    renderParentPortal();
    resetAuthSubmitState();
    animateLoadingScreenOut(loadingScreen);
}

async function openSecretaryConsole({ loadingScreen, authScreen }) {
    hideAllExperienceScreens();
    hideAuthScreen(authScreen);
    const secretaryScreen = document.getElementById('secretary-screen');
    if (secretaryScreen) secretaryScreen.classList.remove('hidden');
    activateSecretaryTab('overview');
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
                                    : 'Use this only for the very first setup of a brand-new school. GCQ unlocks Starter-level access for 24 hours so the first teacher can set everything up before paying.'
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
        await markTeacherOnboardingComplete(user, { migratedFromExistingTeacherData: true });
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

    if (!state.get('isSchoolAdmin')) {
        try {
            const adminClaim = await claimFoundingSchoolAdmin();
            if (adminClaim?.schoolAdmin) {
                state.setIsSchoolAdmin(true);
                state.setCurrentUserProfile({
                    ...(state.get('currentUserProfile') || {}),
                    schoolAdmin: true
                });
            }
        } catch (error) {
            if (error?.code !== 'functions/failed-precondition' && error?.code !== 'failed-precondition') {
                console.warn('Could not auto-claim school admin:', error);
            }
        }
    }

    const isFirstTeacher = allSchoolClasses.length === 0;
    const shouldCollectSchoolName = isFirstTeacher || !state.get('schoolName');

    if (needsTeacherSetup) {
        hideAuthScreen(authScreen);
        resetAuthSubmitState();
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

async function routeAuthenticatedSecretary({ user, loadingScreen, authScreen }) {
    if (!hasActiveSubscription() || !canUseFeature('secretaryAccess')) {
        showSubscribeScreen(loadingScreen, authScreen, {
            canStartGrace: false,
            graceExpired: false,
            graceWindow: state.get('schoolBillingGrace')
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
        }
    }
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
    document.body.addEventListener('mousedown', onFirstUserGesture, { once: true });
    document.body.addEventListener('touchstart', onFirstUserGesture, { once: true });

    document.querySelectorAll('.auth-role-btn').forEach((btn) => {
        btn.addEventListener('click', () => setAuthRole(btn.dataset.authRole || ROLE_TEACHER));
    });

    document.getElementById('toggle-auth-mode').addEventListener('click', (e) => {
        if (activeAuthRole !== ROLE_TEACHER) return;
        setAuthMode(activeAuthMode === 'signup' ? 'login' : 'signup');
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { identifier, rawUsername } = getRoleAwareLoginIdentifier();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('auth-error');
        try {
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
        try {
            beginAuthSubmit('signup');
            errorEl.innerText = '';
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            state.set('currentTeacherName', name);
        } catch (error) {
            resetAuthSubmitState();
            errorEl.innerText = error.message.replace('Firebase: ', '');
        }
    });

    onAuthStateChanged(auth, async (user) => {
        const loadingScreen = document.getElementById('loading-screen');
        const authScreen = document.getElementById('auth-screen');
        const appScreen = document.getElementById('app-screen');

        if (user) {
            state.set('currentUserId', user.uid);
            state.set('currentTeacherName', user.displayName || user.email || '');

            if (document.getElementById('teacher-name-input')) {
                document.getElementById('teacher-name-input').value = user.displayName || '';
            }

            const newDate = getTodayDateString();
            // Fire-and-forget: archival only deletes stale docs — no effect on current session.
            // Running it non-blocking avoids delaying setupDataListeners() by 200–700ms.
            archivePreviousDayStars(user.uid, newDate).catch(console.error);
            if (newDate !== state.get('todaysStarsDate')) {
                state.set('todaysStars', {});
                state.set('todaysStarsDate', newDate);
            }

            await loadSubscription();
            initializeHeaderQuote();
            let profile = await loadUserProfile(user);
            if (!profile) {
                const inferredRole = getRoleFromSyntheticEmail(user.email);
                if (inferredRole) {
                    resetAuthSubmitState();
                    document.getElementById('auth-error').innerText = `This ${getRoleLabel(inferredRole).toLowerCase()} account is missing its access profile. Recreate it from the teacher access screen.`;
                    await signOut(auth);
                    return;
                }
                profile = await ensureTeacherUserProfile(user);
            }
            await touchCurrentUserProfile(user);
            state.setCurrentUserProfile(profile);
            state.setCurrentUserRole(profile.role || ROLE_TEACHER);
            state.setIsSchoolAdmin(profile.schoolAdmin === true);
            state.setCurrentTeacherName(profile.displayName || user.displayName || user.email || '');

            if ((profile.role || ROLE_TEACHER) === ROLE_PARENT) {
                setupParentSession(user.uid, profile, async () => {
                    await routeAuthenticatedParent({ loadingScreen, authScreen });
                });
            } else {
                setupDataListeners(user.uid, newDate, async function onInitialDataReady() {
                    if ((profile.role || ROLE_TEACHER) === ROLE_SECRETARY) {
                        await routeAuthenticatedSecretary({ user, loadingScreen, authScreen });
                    } else {
                        await routeAuthenticatedTeacher({ user, loadingScreen, authScreen, appScreen });
                    }
                }, { role: profile.role || ROLE_TEACHER, profile });
            }

        } else {
            resetAuthSubmitState();
            state.resetState();
            appScreen.classList.add('hidden');
            document.getElementById('parent-screen')?.classList.add('hidden');
            document.getElementById('secretary-screen')?.classList.add('hidden');
            const subScreen = document.getElementById('subscribe-screen');
            if (subScreen) subScreen.classList.add('hidden');
            authScreen.classList.remove('hidden');
            setSecretaryReturnButtonVisible(false);
            setAuthRole(ROLE_TEACHER);
            setAuthMode('login');
            animateLoadingScreenOut(loadingScreen);
        }
    });
}

async function initApp() {
    try {
        document.querySelectorAll('input').forEach(input => input.setAttribute('autocomplete', 'off'));

        setupAuthListeners();
        wireParentPortalListeners({
            onLogout: async () => signOut(auth),
            onRefresh: () => renderParentPortal(),
            onSelectThread: (threadId) => watchCommunicationThread(threadId)
        });
        wireSecretaryConsoleListeners({
            onLogout: async () => signOut(auth),
            onOpenTeacherView: async () => {
                document.getElementById('secretary-screen')?.classList.add('hidden');
                document.getElementById('app-screen')?.classList.remove('hidden');
                const tabs = await import('./ui/tabs.js');
                await tabs.showTab('about-tab');
            },
            onSelectThread: (threadId) => watchCommunicationThread(threadId)
        });

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
        document.getElementById('secretary-console-btn')?.addEventListener('click', () => {
            document.getElementById('app-screen')?.classList.add('hidden');
            document.getElementById('secretary-screen')?.classList.remove('hidden');
            activateSecretaryTab('overview');
            renderSecretaryConsole();
        });

        let clockInterval = setInterval(updateDateTime, 1000);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearInterval(clockInterval);
            } else {
                updateDateTime();
                clockInterval = setInterval(updateDateTime, 1000);
            }
        });

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
