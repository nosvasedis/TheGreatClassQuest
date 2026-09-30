// ui/authGate.js — the sign-in card is the Quest Gate. After a successful sign-in its two
// doors swing open, the view walks through the arch into daylight, and the loading screen
// rises out of that same light. On a cold start the loading screen's daylight lands the
// user back at the gate (playAuthGateArrival), so the two screens read as one journey.

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

        // Dev only: window.__gcqGateSlow stretches the timeline for frame-by-frame checks.
        const slow = (import.meta.env?.DEV && Number(window.__gcqGateSlow)) || 1;
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

if (import.meta.env?.DEV && typeof window !== 'undefined') {
    // Lets the gate be previewed in dev without a real sign-in.
    window.__gcqAuthGate = { playAuthGateEntrance, cancelAuthGate, playAuthGateArrival };
}
