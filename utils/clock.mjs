// One shared once-a-second tick for every clock and countdown on screen (header date, Home clock,
// Home quest timer, Projector Mode clock and timer). One interval instead of one per widget; it
// stops while nobody listens or the browser tab is hidden, and ticks at once when the tab returns.

const subscribers = new Set();
let timer = null;

function isHidden() {
    return typeof document !== 'undefined' && document.hidden === true;
}

function tickAll() {
    for (const fn of [...subscribers]) {
        try {
            fn();
        } catch (error) {
            console.warn('Clock tick failed:', error);
        }
    }
}

function start() {
    if (timer !== null || subscribers.size === 0 || isHidden()) return;
    timer = setInterval(tickAll, 1000);
}

function stop() {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
        if (isHidden()) {
            stop();
            return;
        }
        tickAll();
        start();
    });
}

/**
 * Calls `fn` once a second until the returned function is called.
 * Does not call `fn` straight away: callers that need an immediate paint call it themselves.
 * @param {() => void} fn
 * @returns {() => void} stop listening
 */
export function onSecond(fn) {
    subscribers.add(fn);
    start();
    let active = true;
    return () => {
        if (!active) return;
        active = false;
        subscribers.delete(fn);
        if (subscribers.size === 0) stop();
    };
}

/** Test hook: how many listeners and whether the interval is running. */
export function clockStatus() {
    return { listeners: subscribers.size, running: timer !== null };
}
