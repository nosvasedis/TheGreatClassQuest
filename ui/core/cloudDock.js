// ui/core/cloudDock.js
//
// The teacher bottom nav is a row of floating clouds. On mouse devices the clouds sink out of view
// after a few idle seconds away from the bottom of the screen, and float back up when the pointer
// reaches (or slips past) the bottom edge. Touch-only screens never hide them; a touch near the
// bottom, or keyboard focus on a cloud, always wakes them. Styling lives in styles/nav.css.

const ASLEEP_CLASS = 'cloud-dock--asleep';
const IDLE_MS = 3200;
const AFTER_TOUCH_IDLE_MS = 6000;
const WAKE_EDGE_PX = 26;
const TOUCH_WAKE_EDGE_PX = 72;
const DOCK_HOVER_SLACK_PX = 16;

export function setupCloudDock() {
    const dock = document.getElementById('bottom-nav-bar');
    if (!dock || dock.dataset.cloudDock === 'ready') return;
    dock.dataset.cloudDock = 'ready';

    const hoverQuery = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    let sleepTimer = null;
    let pointerNearDock = false;

    const canAutoHide = () =>
        Boolean(hoverQuery?.matches) && !document.body.classList.contains('gcq-mobile');

    const isAsleep = () => dock.classList.contains(ASLEEP_CLASS);

    // A clicked cloud keeps DOM focus; only keyboard focus should hold the clouds up.
    const hasKeyboardFocus = () => Boolean(dock.querySelector(':focus-visible'));

    function cancelSleep() {
        clearTimeout(sleepTimer);
        sleepTimer = null;
    }

    function wake() {
        cancelSleep();
        dock.classList.remove(ASLEEP_CLASS);
    }

    function sleep() {
        sleepTimer = null;
        if (!canAutoHide() || pointerNearDock || hasKeyboardFocus()) return;
        dock.classList.add(ASLEEP_CLASS);
    }

    function scheduleSleep(delay = IDLE_MS) {
        if (!canAutoHide() || isAsleep() || sleepTimer) return;
        sleepTimer = setTimeout(sleep, delay);
    }

    function dockTop() {
        // Clouds sit in the bottom few rem; measure once per call from the first cloud.
        const cloud = dock.querySelector('.nav-button');
        const rect = cloud ? cloud.getBoundingClientRect() : dock.getBoundingClientRect();
        return rect.top - DOCK_HOVER_SLACK_PX;
    }

    document.addEventListener('mousemove', (e) => {
        if (!canAutoHide()) return;
        const atBottomEdge = e.clientY >= window.innerHeight - WAKE_EDGE_PX;
        pointerNearDock = atBottomEdge || (!isAsleep() && e.clientY >= dockTop());
        if (atBottomEdge) {
            wake();
        } else if (pointerNearDock) {
            cancelSleep();
        } else {
            scheduleSleep();
        }
    }, { passive: true });

    // Sliding the mouse off the bottom of the window ("under the screen") also calls the clouds up.
    document.documentElement.addEventListener('mouseleave', (e) => {
        if (!canAutoHide()) return;
        if (e.clientY >= window.innerHeight - WAKE_EDGE_PX * 2) {
            pointerNearDock = true;
            wake();
        } else {
            pointerNearDock = false;
            scheduleSleep();
        }
    });

    document.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        if (e.clientY >= window.innerHeight - TOUCH_WAKE_EDGE_PX || dock.contains(e.target)) {
            wake();
            pointerNearDock = false;
            scheduleSleep(AFTER_TOUCH_IDLE_MS);
        }
    }, { passive: true });

    dock.addEventListener('focusin', wake);
    dock.addEventListener('focusout', () => {
        if (!pointerNearDock) scheduleSleep();
    });

    hoverQuery?.addEventListener?.('change', () => {
        if (!canAutoHide()) wake();
        else scheduleSleep();
    });

    scheduleSleep(IDLE_MS + 1500);
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * The moment a cloud is chosen: it squashes and springs back, a ring of light and a few mist puffs
 * spill out of it and tiny stars rise. A locked cloud only shakes its head. Returns the sound to play.
 * Transform/opacity animations only (styles/nav.css, .nav-button--chosen / --nope / .nav-burst).
 */
export function chooseCloud(btn) {
    const clouds = [...btn.parentNode.querySelectorAll('.nav-button[data-tab]')];
    const index = Math.max(0, clouds.indexOf(btn));
    const restart = (cls, ms) => {
        btn.classList.remove(cls);
        void btn.offsetWidth;
        btn.classList.add(cls);
        clearTimeout(btn._cloudFx);
        btn._cloudFx = setTimeout(() => btn.classList.remove(cls), ms);
    };
    if (btn.classList.contains('nav-button-locked')) {
        restart('nav-button--nope', 520);
        return 'cloud_nope';
    }
    const again = btn.classList.contains('active');
    restart('nav-button--chosen', 900);
    if (!again && !reducedMotion()) {
        btn.querySelector('.nav-burst')?.remove();
        const burst = document.createElement('span');
        burst.className = 'nav-burst';
        burst.setAttribute('aria-hidden', 'true');
        burst.innerHTML = '<b></b><b></b><b></b><b></b><b></b><i></i><i></i><i></i><i></i>';
        btn.appendChild(burst);
        setTimeout(() => burst.remove(), 1100);
    }
    return `cloud_${index}`;
}
