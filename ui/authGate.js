// ui/authGate.js — the sign-in card is the Quest Gate. After a successful sign-in its two
// doors swing open, the view zooms through the arch as its light floods the screen, and the
// loading screen rises out of that same light. On a cold start the loading screen's daylight lands the
// user back at the gate (playAuthGateArrival), so the two screens read as one journey.
// Logging out plays the entrance backwards (walkOutThroughGate + playAuthGateExit): the app
// dissolves into daylight, the view zooms back out of the arch and the doors close.
//
// The zoom stays smooth because the scene is made cheap to scale first: frosted-glass
// panels drop their blur, the drifting scenery pauses, the scene is promoted to its own
// layer before it moves, and the zoom stops at MAX_ZOOM; the light (a separate, unscaled
// layer on top) covers the rest of the way.

const TIMING = {
    open: 320,      // doors appear over the form, then start to swing
    enter: 900,     // the view starts zooming through the arch
    handoff: 1500,  // the light fills the screen: the loading screen takes over
    cleanup: 2300
};

// Past this the scene would need a huge re-raster; the light covers the screen by then anyway.
const MAX_ZOOM = 3.2;
const EXIT_ZOOM = 1.7;
const GATE_STATES = ['is-gate-closing', 'is-gate-opening', 'is-gate-entering', 'is-gate-leaving', 'gate-instant'];

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
        <div class="auth-gate-portal__door auth-gate-portal__door--left"><span class="auth-gate-portal__ring"></span></div>
        <div class="auth-gate-portal__door auth-gate-portal__door--right"><span class="auth-gate-portal__ring"></span></div>
    `;
    return portal;
}

/** The light lives outside the sign-in screen so it never scales with it. */
function buildLight() {
    const light = document.createElement('div');
    light.className = 'gate-light';
    light.setAttribute('aria-hidden', 'true');
    light.innerHTML = '<div class="gate-light__glow"></div><div class="gate-light__flood"></div>';
    document.body.appendChild(light);
    return light;
}

function setStates(elements, add = [], remove = []) {
    elements.forEach((el) => {
        if (remove.length) el.classList.remove(...remove);
        if (add.length) el.classList.add(...add);
    });
}

/** Where the light shines from (the middle of the arch), how far to zoom, and the door shapes. */
function prepareGate(authScreen, card, portal, light) {
    const screenRect = authScreen.getBoundingClientRect();
    const rect = card.getBoundingClientRect();
    const vw = screenRect.width || window.innerWidth;
    const vh = screenRect.height || window.innerHeight;
    const top = Math.max(rect.top, screenRect.top);
    const bottom = Math.min(rect.bottom, screenRect.bottom);
    const cx = rect.left + rect.width / 2 - screenRect.left;
    const cy = top + (bottom - top) * 0.55 - screenRect.top;
    const needX = Math.max(cx, vw - cx) / Math.max(rect.width / 2, 1);
    const needY = Math.max(cy, vh - cy) / Math.max((bottom - top) / 2, 1);
    const zoom = Math.min(Math.max(needX, needY) * 1.3, MAX_ZOOM);
    [authScreen, light].forEach((el) => {
        el.style.setProperty('--gate-cx', `${Math.round(cx)}px`);
        el.style.setProperty('--gate-cy', `${Math.round(cy)}px`);
    });
    authScreen.style.setProperty('--gate-zoom', zoom.toFixed(3));

    // Each door carries its own half of the arch, so nothing has to clip them while they turn.
    const style = getComputedStyle(card);
    const [tlx, tly = tlx] = style.borderTopLeftRadius.split(' ');
    const [trx, try_ = trx] = style.borderTopRightRadius.split(' ');
    const [blx, bly = blx] = style.borderBottomLeftRadius.split(' ');
    const [brx, bry = brx] = style.borderBottomRightRadius.split(' ');
    const left = portal.querySelector('.auth-gate-portal__door--left');
    const right = portal.querySelector('.auth-gate-portal__door--right');
    if (left) left.style.borderRadius = `${tlx} 0 0 ${blx} / ${tly} 0 0 ${bly}`;
    if (right) right.style.borderRadius = `0 ${trx} ${brx} 0 / 0 ${try_} ${bry} 0`;
}

function clearGate(gate) {
    gate.timers.forEach(clearTimeout);
    gate.timers = [];
    resetGateElements(gate.authScreen, gate.portal, gate.light);
}

function resetGateElements(authScreen, portal, light) {
    authScreen.classList.remove(...GATE_STATES);
    ['--gate-cx', '--gate-cy', '--gate-zoom'].forEach((name) => authScreen.style.removeProperty(name));
    portal?.remove();
    light?.remove();
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
        const light = buildLight();
        const gate = { authScreen, portal, light, timers: [], resolve, handedOff: false };
        activeGate = gate;
        // The scene only needs the states that move it; the door steps stay on the gate's
        // own layers so they never invalidate (and repaint) the whole scene.
        const both = [authScreen, light, portal];
        const gateOnly = [light, portal];

        prepareGate(authScreen, card, portal, light);
        void portal.offsetWidth;
        // Closing also readies the scene for the zoom (own layer, no blur, scenery paused).
        setStates(both, ['is-gate-closing']);

        const slow = slowFactor();
        const later = (ms, fn) => gate.timers.push(setTimeout(fn, ms * slow));
        later(TIMING.open, () => setStates(gateOnly, ['is-gate-opening']));
        later(TIMING.enter, () => setStates(both, ['is-gate-entering']));
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
let exitElements = null;

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
 * The sign-in screen as seen from inside the gate: it starts zoomed into the lit arch with
 * the doors open, zooms back out as the light draws in, the doors close and the form returns.
 */
export function playAuthGateExit() {
    cancelAuthGate();
    exitTimers.forEach(clearTimeout);
    exitTimers = [];
    if (exitElements) resetGateElements(...exitElements);
    exitElements = null;
    const authScreen = document.getElementById('auth-screen');
    const card = document.getElementById('login-form-container');
    if (!authScreen || !card || prefersReducedMotion()) {
        clearDaylightVeil();
        return;
    }
    authScreen.querySelector('.auth-gate-portal')?.remove();
    const portal = buildPortal();
    card.appendChild(portal);
    const light = buildLight();
    exitElements = [authScreen, portal, light];
    const both = [authScreen, light, portal];
    const gateOnly = [light, portal];
    prepareGate(authScreen, card, portal, light);

    // Start zoomed into the lit arch, with no transitions, then let each step play backwards.
    // The zoom-out starts from a gentler scale than the zoom-in reaches: a shrinking layer
    // shows more and more of the scene, and at a big scale the browser cannot keep all of
    // it drawn sharp, so tiles pop in just as the motion settles. At EXIT_ZOOM they don't.
    const zoom = Number.parseFloat(authScreen.style.getPropertyValue('--gate-zoom')) || EXIT_ZOOM;
    authScreen.style.setProperty('--gate-zoom', Math.min(zoom, EXIT_ZOOM).toFixed(3));
    setStates(both, ['gate-instant', 'is-gate-leaving', 'is-gate-closing', 'is-gate-entering']);
    setStates(gateOnly, ['is-gate-opening']);
    void authScreen.offsetWidth;

    const slow = slowFactor();
    const later = (ms, fn) => exitTimers.push(setTimeout(fn, ms * slow));
    requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!exitElements || exitElements[0] !== authScreen) return;
        setStates(both, [], ['gate-instant']);
        void authScreen.offsetWidth;
        // The flood layer matches the veil exactly, so dropping the veil shows no seam.
        later(0, () => {
            clearDaylightVeil();
            setStates(both, [], ['is-gate-entering']);
        });
        later(850, () => setStates(gateOnly, [], ['is-gate-opening']));
        later(1750, () => setStates(both, [], ['is-gate-closing']));
        // Tidy up in two quiet steps, after everything has stopped moving.
        later(2150, () => {
            portal.remove();
            light.remove();
        });
        later(2450, () => {
            resetGateElements(authScreen, null, null);
            exitElements = null;
            exitTimers = [];
        });
    }));
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
    // Lets the gate be previewed in dev without a real sign-in.
    window.__gcqAuthGate = { playAuthGateEntrance, cancelAuthGate, playAuthGateArrival, playAuthGateExit, walkOutThroughGate };
}
