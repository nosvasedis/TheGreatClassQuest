// ui/wallpaperPortal.js
// The door between the Home greeting card and Projector Mode.
// Opening: the card's day ring glows, then the Sky Window grows out of the card and the
// big analogue clock flies out of the ring. Closing: the window folds back into the card
// and the clock lands in the ring again. Without a visible greeting card, the window
// opens and closes as an iris around the TV button.

const OPEN_MS = 1150;
const CLOSE_MS = 950;
const LAUNCH_LEAD_MS = 240;
const EASE_OPEN = 'cubic-bezier(.7, 0, .18, 1)';
const EASE_CLOSE = 'cubic-bezier(.62, 0, .3, 1)';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function isOnScreen(rect) {
    return rect.width > 40 && rect.height > 40
        && rect.bottom > 0 && rect.right > 0
        && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

/** The greeting card and its day ring, only when the Home tab is showing them. */
function findGreetingSource() {
    const panel = document.querySelector('.greeting-panel');
    if (!panel || !panel.getClientRects().length) return null;
    const rect = panel.getBoundingClientRect();
    if (!isOnScreen(rect)) return null;
    const ring = panel.querySelector('[data-day-ring]');
    const ringRect = ring?.getBoundingClientRect();
    return { panel, rect, ring, ringRect: ringRect && ringRect.width > 0 ? ringRect : null };
}

function insetFor(rect, radius) {
    const top = Math.max(0, rect.top);
    const left = Math.max(0, rect.left);
    const right = Math.max(0, window.innerWidth - rect.right);
    const bottom = Math.max(0, window.innerHeight - rect.bottom);
    return `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius}px)`;
}

function cardRadius(panel) {
    const r = parseFloat(getComputedStyle(panel).borderTopLeftRadius);
    return Number.isFinite(r) ? r : 32;
}

function irisCenter() {
    const btn = document.getElementById('projector-mode-btn');
    const r = btn?.getBoundingClientRect();
    if (r && r.width) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function irisClip(radius) {
    const { x, y } = irisCenter();
    return `circle(${radius} at ${x}px ${y}px)`;
}

/** Transform that shrinks the hub so its analogue clock sits exactly on the card's day ring. */
function hubToRing(ringRect) {
    const hub = document.getElementById('wall-center-hub');
    const clock = document.getElementById('wall-analogue-clock');
    if (!hub || !clock || !ringRect) return null;
    const hubRect = hub.getBoundingClientRect();
    const clockRect = clock.getBoundingClientRect();
    if (!hubRect.width || !clockRect.width) return null;
    const cx = clockRect.left + clockRect.width / 2;
    const cy = clockRect.top + clockRect.height / 2;
    const rx = ringRect.left + ringRect.width / 2;
    const ry = ringRect.top + ringRect.height / 2;
    const scale = Math.max(0.08, (ringRect.width * 0.82) / clockRect.width);
    return {
        hub,
        origin: `${cx - hubRect.left}px ${cy - hubRect.top}px`,
        folded: `translate(${rx - cx}px, ${ry - cy}px) scale(${scale})`,
    };
}

function animate(el, keyframes, options) {
    if (!el?.animate) return null;
    return el.animate(keyframes, { fill: 'both', ...options });
}

function settle(animations) {
    return Promise.all(animations.filter(Boolean).map((a) => a.finished.catch(() => {})));
}

function cancelAll(animations) {
    animations.filter(Boolean).forEach((a) => a.cancel());
}

function pulse(panel, className, ms) {
    if (!panel) return;
    panel.classList.remove(className);
    void panel.offsetWidth;
    panel.classList.add(className);
    setTimeout(() => panel.classList.remove(className), ms);
}

/**
 * Plays the opening. The wallpaper element must already be visible (no `hidden`).
 * Resolves when the window fills the screen.
 */
export async function playPortalOpen(wallEl) {
    if (prefersReducedMotion()) {
        const fade = animate(wallEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
        await settle([fade]);
        cancelAll([fade]);
        return;
    }

    const source = findGreetingSource();
    const animations = [];

    if (source) {
        // The ring gathers light first, then the window opens out of the card.
        wallEl.style.clipPath = insetFor(source.rect, cardRadius(source.panel));
        wallEl.style.opacity = '0';
        pulse(source.panel, 'is-portal-launch', LAUNCH_LEAD_MS + OPEN_MS);
        await wait(LAUNCH_LEAD_MS);

        const fold = hubToRing(source.ringRect);
        wallEl.style.clipPath = '';
        wallEl.style.opacity = '';
        animations.push(animate(wallEl, [
            { clipPath: insetFor(source.rect, cardRadius(source.panel)), opacity: 0 },
            { opacity: 1, offset: 0.3 },
            { clipPath: insetFor({ top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight }, 0), opacity: 1 },
        ], { duration: OPEN_MS, easing: EASE_OPEN }));
        if (fold) {
            fold.hub.style.transformOrigin = fold.origin;
            animations.push(animate(fold.hub, [
                { transform: fold.folded, opacity: 0 },
                { opacity: 1, offset: 0.35 },
                { transform: 'none', opacity: 1 },
            ], { duration: OPEN_MS + 150, easing: EASE_OPEN }));
        }
    } else {
        const far = `${Math.hypot(window.innerWidth, window.innerHeight)}px`;
        animations.push(animate(wallEl, [
            { clipPath: irisClip('0px'), opacity: 0.4 },
            { opacity: 1, offset: 0.25 },
            { clipPath: irisClip(far), opacity: 1 },
        ], { duration: OPEN_MS, easing: EASE_OPEN }));
        animations.push(animate(document.getElementById('wall-center-hub'), [
            { transform: 'scale(.86)', opacity: 0 },
            { transform: 'none', opacity: 1 },
        ], { duration: OPEN_MS, delay: 150, easing: EASE_OPEN }));
    }

    animations.push(animate(document.getElementById('wall-horizon'), [
        { transform: 'translateY(55%)' },
        { transform: 'translateY(0)' },
    ], { duration: OPEN_MS, delay: 200, easing: 'cubic-bezier(.2, .8, .2, 1)' }));
    animations.push(animate(document.getElementById('wall-floating-area'), [
        { opacity: 0 },
        { opacity: 1 },
    ], { duration: 500, delay: OPEN_MS * 0.6, easing: 'ease-out' }));
    animations.push(animate(document.getElementById('wall-quote-container'), [
        { translate: '0 60px' },
        { translate: '0 0' },
    ], { duration: 700, delay: OPEN_MS - 350, easing: 'cubic-bezier(.2, .8, .2, 1)' }));

    await settle(animations);
    cancelAll(animations);
    const hub = document.getElementById('wall-center-hub');
    if (hub) hub.style.transformOrigin = '';
}

async function leaveFullscreen() {
    if (!document.fullscreenElement || !document.exitFullscreen) return;
    const changed = new Promise((resolve) => {
        document.addEventListener('fullscreenchange', resolve, { once: true });
        setTimeout(resolve, 400);
    });
    document.exitFullscreen().catch(() => {});
    await changed;
    // Let the page behind settle into its windowed layout before measuring the card.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/**
 * Plays the closing and leaves the wallpaper invisible. Resolves with a cleanup that the
 * caller runs once the wallpaper is `hidden`.
 */
export async function playPortalClose(wallEl) {
    const animations = [];
    const calm = prefersReducedMotion();
    if (!calm) {
        // The cards, ribbon and remote bow out while the browser leaves full screen.
        animations.push(animate(document.getElementById('wall-floating-area'), [
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: 'scale(.94)' },
        ], { duration: 320, easing: 'ease-in' }));
        animations.push(animate(document.getElementById('wall-quote-container'), [
            { opacity: 1 },
            { opacity: 0 },
        ], { duration: 280, easing: 'ease-in' }));
        animations.push(animate(document.getElementById('wall-remote'), [
            { opacity: 1 },
            { opacity: 0 },
        ], { duration: 200, easing: 'ease-in' }));
    }
    await leaveFullscreen();

    if (calm) {
        const fade = animate(wallEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in' });
        await settle([fade]);
        return () => cancelAll([fade]);
    }

    const source = findGreetingSource();
    animations.push(animate(document.getElementById('wall-horizon'), [
        { transform: 'translateY(0)' },
        { transform: 'translateY(60%)' },
    ], { duration: CLOSE_MS * 0.8, easing: 'cubic-bezier(.5, 0, .75, .2)' }));

    if (source) {
        const radius = cardRadius(source.panel);
        const fold = hubToRing(source.ringRect);
        animations.push(animate(wallEl, [
            { clipPath: insetFor({ top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight }, 0), opacity: 1 },
            { opacity: 1, offset: 0.7 },
            { clipPath: insetFor(source.rect, radius), opacity: 0 },
        ], { duration: CLOSE_MS, easing: EASE_CLOSE }));
        if (fold) {
            fold.hub.style.transformOrigin = fold.origin;
            animations.push(animate(fold.hub, [
                { transform: 'none', opacity: 1 },
                { opacity: 1, offset: 0.72 },
                { transform: fold.folded, opacity: 0 },
            ], { duration: CLOSE_MS, easing: EASE_CLOSE }));
        }
        setTimeout(() => pulse(source.panel, 'is-portal-land', 1100), CLOSE_MS - 180);
    } else {
        const far = `${Math.hypot(window.innerWidth, window.innerHeight)}px`;
        animations.push(animate(wallEl, [
            { clipPath: irisClip(far), opacity: 1 },
            { opacity: 1, offset: 0.75 },
            { clipPath: irisClip('0px'), opacity: 0 },
        ], { duration: CLOSE_MS, easing: EASE_CLOSE }));
    }

    await settle(animations);
    return () => {
        cancelAll(animations);
        const hub = document.getElementById('wall-center-hub');
        if (hub) hub.style.transformOrigin = '';
    };
}
