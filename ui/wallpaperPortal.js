// ui/wallpaperPortal.js
// The journey between the Home greeting card's meadow and Projector Mode's castle.
// Opening: the camera leaves the cottage in the meadow and glides right along the hills
// until the castle rises on the horizon; the clock, cards and remote then fade in exactly
// where they will stay. Closing runs the same journey backwards and dissolves into Home.
// The projector is already full screen and laid out before anything moves, so nothing
// resizes or jumps when the journey ends.

import * as utils from '../utils.js';
import { getGreetingHillsHtml } from '../features/homeGreetingScene.js';

const TRAVEL_MS = 3200;
const FADE_MS = 500;
const EASE_TRAVEL = 'cubic-bezier(.65, 0, .3, 1)';
const EASE_SOFT = 'cubic-bezier(.3, .7, .3, 1)';
const FULLSCREEN_WAIT_MS = 600;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const byId = (id) => document.getElementById(id);

function animate(el, keyframes, options) {
    if (!el || !el.animate) return null;
    return el.animate(keyframes, { fill: 'both', ...options });
}

function settle(animations) {
    return Promise.all(animations.filter(Boolean).map((a) => a.finished.catch(() => {})));
}

function cancelAll(animations) {
    animations.forEach((a) => { try { a?.cancel(); } catch { /* already gone */ } });
}

/** The Home greeting meadow (hills and cottage) drawn as a full-width plane inside the wallpaper. */
function buildMeadow(wallEl) {
    const part = utils.getCurrentDayPart?.()?.part || 'afternoon';
    // Fresh gradient ids so the copy never borrows the hidden Home card's defs.
    const svg = getGreetingHillsHtml().replace(/id="gh-/g, 'id="wp-gh-').replace(/url\(#gh-/g, 'url(#wp-gh-');
    const meadow = document.createElement('div');
    meadow.className = 'wp-meadow';
    meadow.setAttribute('aria-hidden', 'true');
    meadow.innerHTML = `<div class="greeting-panel greeting-panel--${part} wp-meadow__palette">${svg}</div>`;
    wallEl.appendChild(meadow);
    return meadow;
}

async function enterFullscreen() {
    const root = document.documentElement;
    if (!root.requestFullscreen || document.fullscreenElement) return;
    const changed = new Promise((resolve) => {
        document.addEventListener('fullscreenchange', resolve, { once: true });
        setTimeout(resolve, FULLSCREEN_WAIT_MS);
    });
    root.requestFullscreen().catch(() => {});
    await changed;
    await nextFrames();
}

async function leaveFullscreen() {
    if (!document.fullscreenElement || !document.exitFullscreen) return;
    const changed = new Promise((resolve) => {
        document.addEventListener('fullscreenchange', resolve, { once: true });
        setTimeout(resolve, FULLSCREEN_WAIT_MS);
    });
    document.exitFullscreen().catch(() => {});
    await changed;
    await nextFrames();
}

/** Everything that sits over the scene: it fades, it never moves or resizes. */
function foregroundIds() {
    return ['wall-center-hub', 'wall-floating-area', 'wall-quote-container', 'wall-remote'];
}

/**
 * The travelling camera: meadow and castle horizon are one long strip, the horizon starting a
 * screen-width (minus a soft overlap) to the right. Sliding the strip left is a camera glide
 * to the right; the overlap is feathered in CSS so the two scenes melt into each other.
 */
const STRIP_SHIFT_VW = 85;

function travelAnimations(meadow, direction) {
    const opts = { duration: TRAVEL_MS, easing: EASE_TRAVEL };
    const slide = (from, to) => (direction === 'forward' ? [from, to] : [to, from]);
    const x = (vw) => ({ transform: `translateX(${vw}vw)` });
    return [
        animate(meadow, slide(x(0), x(-STRIP_SHIFT_VW)), opts),
        animate(byId('wall-horizon'), slide(x(STRIP_SHIFT_VW), x(0)), opts)
    ];
}

/**
 * Plays the opening. The wallpaper element must already be visible (no `hidden`) and this must
 * be called straight from the button press so full screen counts as user-initiated.
 * Resolves when the scene is at rest.
 */
export async function playPortalOpen(wallEl) {
    const fullscreen = enterFullscreen();
    const reduced = prefersReducedMotion();
    const meadow = reduced ? null : buildMeadow(wallEl);

    // Hold the foreground back until the scene has arrived.
    const holds = foregroundIds().map((id) => {
        const el = byId(id);
        if (el) el.style.opacity = '0';
        return el;
    });

    const dissolve = animate(wallEl, [{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' });
    await Promise.all([fullscreen, settle([dissolve])]);
    cancelAll([dissolve]);

    const releaseHolds = () => holds.forEach((el) => { if (el) el.style.opacity = ''; });

    if (reduced) {
        releaseHolds();
        return;
    }

    wallEl.classList.add('is-travelling');
    const travel = travelAnimations(meadow, 'forward');
    // The realm's foreground settles in over the last stretch of the journey, in place.
    const arrive = [
        ['wall-center-hub', 0.55, 900],
        ['wall-floating-area', 0.8, 700],
        ['wall-quote-container', 0.72, 800],
        ['wall-remote', 0.9, 600]
    ].map(([id, at, ms]) => {
        const el = byId(id);
        if (!el) return null;
        el.style.opacity = '';
        return animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: ms, delay: TRAVEL_MS * at, easing: EASE_SOFT });
    });

    await settle([...travel, ...arrive]);
    cancelAll([...travel, ...arrive]);
    meadow.remove();
    wallEl.classList.remove('is-travelling');
    releaseHolds();
}

/**
 * Plays the closing and leaves the wallpaper invisible. Resolves with a cleanup that the
 * caller runs once the wallpaper is `hidden`.
 */
export async function playPortalClose(wallEl) {
    const reduced = prefersReducedMotion();
    const animations = [];

    if (!reduced) {
        foregroundIds().forEach((id) => {
            animations.push(animate(byId(id), [{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: 'ease-in' }));
        });
    }
    // Leave full screen while the foreground bows out, so the journey plays in its final size.
    await Promise.all([leaveFullscreen(), reduced ? Promise.resolve() : wait(400)]);

    let meadow = null;
    if (reduced) {
        animations.push(animate(wallEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in' }));
    } else {
        meadow = buildMeadow(wallEl);
        wallEl.classList.add('is-travelling');
        animations.push(...travelAnimations(meadow, 'back'));
        animations.push(animate(wallEl, [{ opacity: 1 }, { opacity: 1, offset: 0.78 }, { opacity: 0 }], { duration: TRAVEL_MS + FADE_MS, easing: 'ease-in-out' }));
    }

    await settle(animations);
    return () => {
        cancelAll(animations);
        meadow?.remove();
        wallEl.classList.remove('is-travelling');
    };
}
