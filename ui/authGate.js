// ui/authGate.js — the sign-in card is the Quest Gate. After a successful sign-in its two
// doors swing open, the view walks through the arch into daylight, and the loading screen
// rises out of that same light. On a cold start the loading screen's daylight lands the
// user back at the gate (playAuthGateArrival), so the two screens read as one journey.
// Logging out plays the entrance backwards (walkOutThroughGate + playAuthGateExit): the app
// dissolves into daylight, the view steps back out of the arch and the doors close.

const TIMING = {
    open: 320,      // doors appear over the form, then start to swing
    enter: 900,     // the view starts walking through the arch
    handoff: 1500,  // the light fills the screen: the loading screen takes over
    cleanup: 2300
};

let activeGate = null;
let arrivalTimer = 0;

function prefersReducedMotion() {
    try {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    } catch (_) {
        return false;
    }
}

// Dev only: window.__gcqGateSlow stretches the timeline for frame-by-frame checks.
function slowFactor() {
    return (import.meta.env?.DEV && typeof window !== 'undefined' && Number(window.__gcqGateSlow)) || 1;
}

function buildPortal() {
    const portal = document.createElement('div');
    portal.className = 'auth-gate-portal';
    portal.setAttribute('aria-hidden', 'true');
    portal.innerHTML = `
        <div class="auth-gate-portal__sky"></div>
        <div class="auth-gate-portal__rays"></div>
        <div class="auth-gate-portal__bloom"></div>
        <div class="auth-gate-portal__door auth-gate-portal__door--left"><span class="auth-gate-portal__ring"></span></div>
        <div class="auth-gate-portal__door auth-gate-portal__door--right"><span class="auth-gate-portal__ring"></span></div>
    `;
    return portal;
}

/** How far to zoom so the arch (and the light inside it) covers the whole screen. */
function measureZoom(authScreen, card) {
    const screenRect = authScreen.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const vw = screenRect.width || window.innerWidth;
    const vh = screenRect.height || window.innerHeight;
    // Aim at the visible part of the card (on a phone it can run below the fold).
    const top = Math.max(cardRect.top, screenRect.top);
    const bottom = Math.min(cardRect.bottom, screenRect.bottom);
    const cx = cardRect.left + cardRect.width / 2 - screenRect.left;
    const cy = (top + bottom) / 2 - screenRect.top;
    const halfW = Math.max(cardRect.width / 2, 1);
    const halfH = Math.max((bottom - top) / 2, 1);
    const needX = Math.max(cx, vw - cx) / halfW;
    const needY = Math.max(cy, vh - cy) / halfH;
    // Extra room for the rounded top of the arch.
    const zoom = Math.min(Math.max(needX, needY) * 1.45, 14);
    return { zoom, originX: cx, originY: cy };
}

function clearGate(gate) {
    gate.timers.forEach(clearTimeout);
    gate.timers = [];
    gate.authScreen.classList.remove('is-gate-closing', 'is-gate-opening', 'is-gate-entering');
    gate.authScreen.style.removeProperty('--gate-zoom');
    gate.authScreen.style.removeProperty('--gate-origin-x');
    gate.authScreen.style.removeProperty('--gate-origin-y');
    gate.portal.remove();
}

/**
 * Plays the gate opening. onHandoff runs when the light has filled the screen
 * (that is where the loading screen should appear). The returned promise resolves
 * right after the handoff, or at once when the animation can't or shouldn't run.
 */
export function playAuthGateEntrance({ onHandoff } = {}) {
    cancelAuthGate();
    const handoff = () => {
        try { onHandoff?.(); } catch (error) { console.error('Gate handoff failed:', error); }
    };
    const authScreen = document.getElementById('auth-screen');
    const card = document.getElementById('login-form-container');
    if (!authScreen || !card || authScreen.classList.contains('hidden') || prefersReducedMotion()) {
        handoff();
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        const portal = buildPortal();
        card.appendChild(portal);
        const gate = { authScreen, portal, timers: [], resolve, handedOff: false };
        activeGate = gate;

        const { zoom, originX, originY } = measureZoom(authScreen, card);
        authScreen.style.setProperty('--gate-zoom', zoom.toFixed(3));
        authScreen.style.setProperty('--gate-origin-x', `${Math.round(originX)}px`);
        authScreen.style.setProperty('--gate-origin-y', `${Math.round(originY)}px`);
        void portal.offsetWidth;
        authScreen.classList.add('is-gate-closing');

        const slow = slowFactor();
        const later = (ms, fn) => gate.timers.push(setTimeout(fn, ms * slow));
        later(TIMING.open, () => authScreen.classList.add('is-gate-opening'));
        later(TIMING.enter, () => authScreen.classList.add('is-gate-entering'));
        later(TIMING.handoff, () => {
            gate.handedOff = true;
            handoff();
            resolve();
        });
        later(TIMING.cleanup, () => {
            clearGate(gate);
            if (activeGate === gate) activeGate = null;
        });
    });
}

/** Stops a running gate animation and puts the sign-in card back (e.g. sign-in was refused). */
export function cancelAuthGate() {
    const gate = activeGate;
    if (!gate) return;
    activeGate = null;
    clearGate(gate);
    if (!gate.handedOff) gate.resolve();
}

/**
 * The user lands at the gate: the card rises and the keystone settles.
 * delayMs lets the loading screen's daylight fade first on a cold start.
 */
export function playAuthGateArrival({ delayMs = 0 } = {}) {
    const authScreen = document.getElementById('auth-screen');
    if (!authScreen || prefersReducedMotion()) return;
    clearTimeout(arrivalTimer);
    authScreen.classList.remove('auth-screen-arrive');
    authScreen.style.setProperty('--arrive-delay', `${Math.max(0, Math.round(delayMs))}ms`);
    void authScreen.offsetWidth;
    authScreen.classList.add('auth-screen-arrive');
    arrivalTimer = setTimeout(() => {
        authScreen.classList.remove('auth-screen-arrive');
        authScreen.style.removeProperty('--arrive-delay');
    }, delayMs + 1800);
}

// ── Logging out: back out through the gate ─────────────────────────────────

let veil = null;
let veilSafetyTimer = 0;
let exitPending = false;
let exitTimers = [];

function showDaylightVeil() {
    if (!veil) {
        veil = document.createElement('div');
        veil.className = 'gate-daylight-veil';
        veil.setAttribute('aria-hidden', 'true');
        document.body.appendChild(veil);
    }
    veil.classList.remove('is-clearing');
    void veil.offsetWidth;
    veil.classList.add('is-shown');
    clearTimeout(veilSafetyTimer);
    // Never leave the screen washed out if the sign-out stalls.
    veilSafetyTimer = setTimeout(() => clearDaylightVeil(), 6000);
}

function clearDaylightVeil() {
    clearTimeout(veilSafetyTimer);
    const current = veil;
    if (!current) return;
    veil = null;
    current.classList.add('is-clearing');
    current.classList.remove('is-shown');
    setTimeout(() => current.remove(), 900);
}

/**
 * Log out with a walk back through the gate: the app fades into daylight, then
 * doSignOut runs. The sign-in screen picks it up with playAuthGateExit().
 */
export async function walkOutThroughGate(doSignOut) {
    if (prefersReducedMotion() || !document.getElementById('auth-screen')) {
        await doSignOut();
        return;
    }
    showDaylightVeil();
    await new Promise((resolve) => setTimeout(resolve, 440 * slowFactor()));
    exitPending = true;
    try {
        await doSignOut();
    } catch (error) {
        exitPending = false;
        clearDaylightVeil();
        throw error;
    }
}

/** True once, right after walkOutThroughGate signed the user out. */
export function consumeGateExit() {
    const pending = exitPending;
    exitPending = false;
    return pending;
}

/**
 * The sign-in screen as seen from inside the gate: it starts zoomed into the lit arch
 * with the doors open, steps back out, the doors close and the form returns.
 */
export function playAuthGateExit() {
    cancelAuthGate();
    exitTimers.forEach(clearTimeout);
    exitTimers = [];
    const authScreen = document.getElementById('auth-screen');
    const card = document.getElementById('login-form-container');
    if (!authScreen || !card || prefersReducedMotion()) {
        clearDaylightVeil();
        return;
    }
    authScreen.querySelector('.auth-gate-portal')?.remove();
    const portal = buildPortal();
    card.appendChild(portal);
    const { zoom, originX, originY } = measureZoom(authScreen, card);
    authScreen.style.setProperty('--gate-zoom', zoom.toFixed(3));
    authScreen.style.setProperty('--gate-origin-x', `${Math.round(originX)}px`);
    authScreen.style.setProperty('--gate-origin-y', `${Math.round(originY)}px`);

    // Start inside the light, with no transitions, then let each step play backwards.
    authScreen.classList.add('gate-instant', 'is-gate-leaving', 'is-gate-closing', 'is-gate-opening', 'is-gate-entering');
    void authScreen.offsetWidth;
    authScreen.classList.remove('gate-instant');
    void authScreen.offsetWidth;

    const slow = slowFactor();
    const later = (ms, fn) => exitTimers.push(setTimeout(fn, ms * slow));
    later(60, () => {
        clearDaylightVeil();
        authScreen.classList.remove('is-gate-entering');
    });
    later(820, () => authScreen.classList.remove('is-gate-opening'));
    later(1750, () => authScreen.classList.remove('is-gate-closing'));
    later(2100, () => {
        authScreen.classList.remove('is-gate-leaving');
        authScreen.style.removeProperty('--gate-zoom');
        authScreen.style.removeProperty('--gate-origin-x');
        authScreen.style.removeProperty('--gate-origin-y');
        portal.remove();
        exitTimers = [];
    });
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
    // Lets the gate be previewed in dev without a real sign-in.
    window.__gcqAuthGate = { playAuthGateEntrance, cancelAuthGate, playAuthGateArrival, playAuthGateExit, walkOutThroughGate };
}
