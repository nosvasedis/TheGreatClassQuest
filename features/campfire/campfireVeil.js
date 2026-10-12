// Hero Campfire "gathering" veil (initial bundle; keep it small). It appears the instant the teacher taps
// Gather, so the projector shows the fire is on its way while the lesson, words and promises load.
// When the scene is ready underneath, the veil lifts away. Transform/opacity only.

const STEPS = [
    ['words', 'Gathering tonight’s words'],
    ['seats', 'Finding a seat for every hero'],
    ['fire', 'Waking the embers']
];
const SLOW_LINE = 'The fire is taking its time. Almost there…';
const FLAME = '<svg class="cf-veil__flame" viewBox="0 0 48 64" aria-hidden="true">' +
    '<path class="cf-veil__f1" fill="#fa7844" d="M25 1C38 20 47 29 43 43 39 60 13 65 5 47-2 30 16 23 16 12c6 5 8 9 7 14C30 17 30 9 25 1Z"/>' +
    '<path class="cf-veil__f2" fill="#ffc969" d="M25 20c10 13 14 20 9 29-5 10-20 9-23-1-3-11 9-17 10-23l4 10c4-5 3-9 0-15Z"/>' +
    '<path class="cf-veil__f3" fill="#fff5c8" d="M24 37c4 7 10 11 5 16-5 6-13 1-11-5 1-4 5-6 6-11Z"/></svg>';

/** Pure markup (also used by the preview studio). */
export function campfireVeilMarkup({ held = false, step = 'words' } = {}) {
    const at = Math.max(0, STEPS.findIndex(([key]) => key === step));
    return '<div class="cf-veil__sky" aria-hidden="true"></div><div class="cf-veil__glow" aria-hidden="true"></div>' +
        '<div class="cf-veil__body"><div class="cf-veil__hearth" aria-hidden="true"><span class="cf-veil__halo"></span>' + FLAME +
        '<span class="cf-veil__logs"></span><span class="cf-veil__sparks">' + Array.from({ length: 7 }, (_, i) => '<i style="--i:' + i + '"></i>').join('') + '</span></div>' +
        '<p class="cf-veil__eyebrow">Hero Campfire</p><h2 class="cf-veil__title">' + (held ? 'Relighting our fire…' : 'Gather round…') + '</h2>' +
        '<p class="cf-veil__step" aria-live="polite">' + STEPS[at][1] + '</p>' +
        '<ol class="cf-veil__trail" aria-hidden="true">' + STEPS.map((_, i) => '<li class="' + (i < at ? 'is-done' : i === at ? 'is-now' : '') + '"></li>').join('') + '</ol></div>' +
        '<button type="button" class="cf-veil__cancel" data-veil-cancel>Not now</button>';
}

/**
 * Show the veil at once. `step(key)` moves the little trail on; `lift()` fades it away over the scene;
 * `cancel` (Not now / Esc) calls onCancel and removes it.
 */
export function showCampfireVeil({ held = false, onCancel = () => {} } = {}) {
    document.querySelector('.cf-veil')?.remove();
    const el = document.createElement('div');
    el.className = 'cf-veil';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'Opening the Hero Campfire');
    el.innerHTML = campfireVeilMarkup({ held });
    document.body.append(el);
    const reduced = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    let gone = false, cancelled = false, current = 0;
    const slow = setTimeout(() => { if (!gone) el.querySelector('.cf-veil__step').textContent = SLOW_LINE; }, 7000);
    const remove = () => { if (gone) return; gone = true; clearTimeout(slow); document.removeEventListener('keydown', onKey, true); };
    const cancel = () => { if (gone) return; cancelled = true; remove(); el.remove(); onCancel(); };
    function onKey(event) { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancel(); } }
    document.addEventListener('keydown', onKey, true);
    el.querySelector('[data-veil-cancel]').onclick = cancel;
    el.querySelector('[data-veil-cancel]').focus({ preventScroll: true });
    return {
        step(key) {
            const at = STEPS.findIndex(([k]) => k === key);
            if (gone || at < current) return;
            current = at;
            el.querySelector('.cf-veil__step').textContent = STEPS[at][1];
            el.querySelectorAll('.cf-veil__trail li').forEach((li, i) => { li.className = i < at ? 'is-done' : i === at ? 'is-now' : ''; });
        },
        /** Fade away once whatever is underneath has had a frame to paint. */
        lift() {
            if (gone) return;
            remove();
            if (reduced) { el.remove(); return; }
            requestAnimationFrame(() => requestAnimationFrame(() => {
                el.classList.add('is-lifting');
                setTimeout(() => el.remove(), 700);
            }));
        },
        get cancelled() { return cancelled; }
    };
}
