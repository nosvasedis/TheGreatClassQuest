// ui/authRoleMorph.js — smooth changes on the Quest Gate.
// Switching Teacher / Parent / Secretary (or sign-in / sign-up, or the family language)
// used to swap every text and resize the arch in one frame. Now the old words fade out,
// the change is applied, and the arch, welcome column and pills glide to their new size
// while the new words fade in. Only transform/opacity and a few element sizes animate,
// all with the Web Animations API so a quick second tap simply takes over mid-way.

import { syncAuthFamilyLanguage } from './authFamilyWords.js';

const FADE_OUT_MS = 130;
const RESIZE_MS = 480;
const FADE_IN_MS = 340;
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

// Words that change with the role: they fade out and back in.
const FADE_SELECTORS = [
    '.auth-welcome__kicker',
    '.auth-welcome__lede',
    '.auth-welcome__list',
    '.auth-footnote',
    '#auth-arrival',
    '#auth-title',
    '#auth-subtitle',
    '#login-form',
    '#signup-form',
    '.auth-family-lang-wrap',
    '.auth-other-door-wrap',
    '.auth-switch',
    '#auth-school-line',
    '[data-auth-school-kicker]'
];

// Boxes whose size follows the words: they glide from the old size to the new one.
// `clip` keeps the growing/shrinking box tidy without cutting off lifted buttons above it.
const RESIZE_TARGETS = [
    { selector: '#auth-interactive', height: true, clip: 'inset(-2.5rem -2.5rem 0 -2.5rem)' },
    { selector: '#auth-school-line', height: true, clip: 'inset(-1rem -2.5rem 0 -2.5rem)' },
    { selector: '.auth-welcome', height: true },
    { selector: '.auth-welcome__kicker', height: true, width: true, overflow: 'hidden', nowrap: true },
    // The footnote can appear or vanish (Secretary has none): it grows from / folds to nothing.
    { selector: '.auth-footnote', height: true, width: true, overflow: 'hidden', collapse: true }
];
const HOLD_CLASS = 'auth-morph-hold';

let phase = 'idle'; // idle | out | in
let pendingApply = null;
let outTimer = 0;
let outAnimations = [];
let inAnimations = [];
let sizeAnimations = [];
let snapshot = null;

function prefersReducedMotion() {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
        return false;
    }
}

function screenIsShowing() {
    const screen = document.getElementById('auth-screen');
    if (!screen || screen.classList.contains('hidden')) return false;
    // During the gate's door/zoom scenes the screen is busy with its own animation.
    return !/\bis-gate-(closing|opening|leaving|entering)\b/.test(screen.className);
}

function visibleElements(selectors) {
    const out = [];
    selectors.forEach((selector) => {
        document.querySelectorAll(`#auth-screen ${selector}`).forEach((el) => {
            if (el.getClientRects().length) out.push(el);
        });
    });
    return out;
}

function measureSizes() {
    const sizes = new Map();
    RESIZE_TARGETS.forEach((target) => {
        const el = document.querySelector(`#auth-screen ${target.selector}`);
        if (!el) return;
        const shown = el.getClientRects().length > 0;
        const rect = el.getBoundingClientRect();
        sizes.set(target.selector, { el, shown, width: rect.width, height: rect.height });
    });
    return sizes;
}

function cancelAll(list) {
    list.forEach((anim) => {
        try { anim.cancel(); } catch (_) { /* already gone */ }
    });
    return [];
}

function resetResizeStyles() {
    RESIZE_TARGETS.forEach((target) => {
        const el = document.querySelector(`#auth-screen ${target.selector}`);
        if (!el) return;
        el.style.removeProperty('clip-path');
        el.style.removeProperty('overflow');
        el.style.removeProperty('white-space');
        el.classList.remove(HOLD_CLASS);
    });
}

function glideSizes(before) {
    const after = measureSizes();
    const anims = [];
    RESIZE_TARGETS.forEach((target) => {
        const from = before.get(target.selector);
        const to = after.get(target.selector);
        if (!from || !to || from.el !== to.el) return;
        if (!from.shown && !to.shown) return;
        const el = to.el;
        if (!from.shown || !to.shown) {
            if (!target.collapse) return;
            const appearing = !from.shown;
            // Keep a vanishing box on screen (empty) just long enough to fold it away.
            if (!appearing) el.classList.add(HOLD_CLASS);
            const cs = getComputedStyle(el);
            const full = {
                height: `${appearing ? to.height : from.height}px`,
                marginTop: cs.marginTop,
                paddingTop: cs.paddingTop,
                paddingBottom: cs.paddingBottom,
                opacity: 1
            };
            const none = { height: '0px', marginTop: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 };
            el.style.overflow = 'hidden';
            anims.push(el.animate(appearing ? [none, full] : [full, none], {
                duration: RESIZE_MS,
                easing: EASE_OUT,
                fill: appearing ? 'none' : 'forwards'
            }));
            return;
        }
        const start = {};
        const end = {};
        if (target.height && Math.abs(from.height - to.height) > 0.5) {
            start.height = `${from.height}px`;
            end.height = `${to.height}px`;
        }
        if (target.width && Math.abs(from.width - to.width) > 0.5) {
            start.width = `${from.width}px`;
            end.width = `${to.width}px`;
        }
        if (!Object.keys(start).length) return;
        if (target.nowrap) el.style.whiteSpace = 'nowrap';
        if (target.clip) el.style.clipPath = target.clip;
        if (target.overflow) el.style.overflow = target.overflow;
        const anim = el.animate([start, end], { duration: RESIZE_MS, easing: EASE_OUT });
        anims.push(anim);
    });
    if (anims.length) {
        Promise.all(anims.map((a) => a.finished.catch(() => null))).then(() => {
            if (sizeAnimations === anims) {
                resetResizeStyles();
                sizeAnimations = cancelAll(anims);
            }
        });
    }
    return anims;
}

function fadeIn() {
    phase = 'in';
    const els = visibleElements(FADE_SELECTORS);
    const anims = els.map((el, index) => el.animate([
        { opacity: 0, transform: 'translateY(5px)' },
        { opacity: 1, transform: 'none' }
    ], {
        duration: FADE_IN_MS,
        delay: Math.min(index, 6) * 18,
        easing: EASE_OUT,
        fill: 'backwards'
    }));
    inAnimations = anims;
    Promise.all(anims.map((a) => a.finished.catch(() => null))).then(() => {
        if (inAnimations === anims) {
            inAnimations = [];
            if (phase === 'in') phase = 'idle';
        }
    });
}

function runPendingChange() {
    outTimer = 0;
    const apply = pendingApply;
    pendingApply = null;
    const before = snapshot || measureSizes();
    snapshot = null;

    sizeAnimations = cancelAll(sizeAnimations);
    resetResizeStyles();
    try {
        apply?.();
        // Families read Greek: translate now (not a microtask later) so the new size is measured in Greek.
        syncAuthFamilyLanguage();
    } finally {
        // The old words are already invisible: drop their fade and bring the new ones in.
        sizeAnimations = glideSizes(before);
        fadeIn();
        outAnimations = cancelAll(outAnimations);
    }
}

/**
 * Applies a change to the sign-in screen with a soft crossfade and gliding sizes.
 * `apply` runs synchronously when motion is reduced or the screen is not showing.
 */
export function morphAuthGate(apply) {
    if (typeof apply !== 'function') return;
    if (prefersReducedMotion() || !screenIsShowing() || typeof Element.prototype.animate !== 'function') {
        outTimer && clearTimeout(outTimer);
        outTimer = 0;
        pendingApply = null;
        outAnimations = cancelAll(outAnimations);
        inAnimations = cancelAll(inAnimations);
        sizeAnimations = cancelAll(sizeAnimations);
        resetResizeStyles();
        phase = 'idle';
        apply();
        return;
    }

    if (phase === 'out') {
        // Still fading the old words: the latest choice wins, no second fade needed.
        pendingApply = apply;
        return;
    }

    // Start from whatever is on screen right now, even halfway through a previous glide.
    snapshot = measureSizes();
    const els = visibleElements(FADE_SELECTORS);
    const startOpacity = new Map(els.map((el) => [el, Number.parseFloat(getComputedStyle(el).opacity) || 0]));
    inAnimations = cancelAll(inAnimations);
    sizeAnimations.forEach((anim) => { try { anim.pause(); } catch (_) { /* gone */ } });

    phase = 'out';
    pendingApply = apply;
    outAnimations = els.map((el) => el.animate([
        { opacity: startOpacity.get(el) ?? 1, transform: 'none' },
        { opacity: 0, transform: 'translateY(-3px)' }
    ], { duration: FADE_OUT_MS, easing: 'ease-in', fill: 'forwards' }));
    outTimer = setTimeout(runPendingChange, FADE_OUT_MS);
}
