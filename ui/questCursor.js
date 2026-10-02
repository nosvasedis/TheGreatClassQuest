// Continuous cursor artwork, with native fallbacks and short click twinkles.
import { getQuestCursorAssets, resolveQuestCursor } from './questCursorCore.mjs';

const STORAGE_KEY = 'gcq-quest-cursor-enabled';
const INTERACTIVE = 'button, a[href], select, summary, label[for], input[type="checkbox"], input[type="radio"], input[type="range"], input[type="button"], input[type="submit"], input[type="reset"], input[type="color"], input[type="file"], [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], .cursor-pointer';
const TEXT_INPUT = 'textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="color"]):not([type="file"]):not([type="hidden"]), [contenteditable=""], [contenteditable="true"], [role="textbox"]';
let teardown;

export function setupQuestCursor() {
    if (teardown) return teardown;
    const root = document.documentElement;
    const fine = matchMedia('(any-hover: hover) and (any-pointer: fine)');
    const contrast = matchMedia('(forced-colors: active)');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const abort = new AbortController();
    let enabled = true;
    try { enabled = localStorage.getItem(STORAGE_KEY) !== 'false'; } catch { /* private browsing */ }
    const assets = getQuestCursorAssets();
    for (const [mode, asset] of Object.entries(assets)) root.style.setProperty(`--gcq-cursor-${mode}`, asset.css);

    const effects = document.createElement('div');
    effects.className = 'gcq-cursor-effects';
    effects.setAttribute('aria-hidden', 'true');
    const visual = document.createElement('span');
    visual.className = 'gcq-cursor-visual';
    visual.hidden = true;
    const glyphs = new Map();
    for (const [state, asset] of Object.entries(assets)) {
        // Both busy semantics share one animation, so it never restarts between them.
        if (state === 'progress') { glyphs.set(state, glyphs.get('wait')); continue; }
        const glyph = document.createElement('span');
        glyph.className = `gcq-cursor-glyph${state === 'wait' ? ' gcq-cursor-hourglass' : ''}`;
        glyph.dataset.cursorArt = state;
        glyph.innerHTML = decodeURIComponent(asset.url.split(',')[1]);
        glyph.firstElementChild.style.left = `${16 - asset.x}px`;
        glyph.firstElementChild.style.top = `${16 - asset.y}px`;
        visual.append(glyph);
        glyphs.set(state, glyph);
    }
    effects.append(visual);
    document.body.append(effects);

    let target = null;
    let mode = 'native';
    let pointer = null;
    let frame = 0;
    let assetsReady = false;
    let nativePixelRatio = 0;
    let nativeRevision = 0;
    let dragging = false;
    let activeGlyph = null;
    const swaps = new Map();
    let idleTimer = 0;
    let moving = false;
    let pointerHit = null;
    const allowed = () => assetsReady && enabled && fine.matches && !contrast.matches && pointer !== 'touch';
    function clearTarget() {
        target?.removeAttribute('data-gcq-cursor');
        target = null;
    }
    function positionVisual() {
        const dpr = window.devicePixelRatio || 1;
        visual.style.left = `${Math.round(pointer.x * dpr) / dpr}px`;
        visual.style.top = `${Math.round(pointer.y * dpr) / dpr}px`;
    }
    function finishSwap() {
        if (!swaps.size) return;
        for (const swap of swaps.values()) swap.cancel();
        swaps.clear();
        for (const glyph of visual.children) glyph.classList.remove('is-leaving');
    }
    function parkVisual() {
        finishSwap();
        if (visual.hidden) return;
        visual.hidden = true;
        root.classList.remove('gcq-cursor-overlay');
    }
    function showVisual(state) {
        const next = state && glyphs.get(state);
        if (!next) {
            parkVisual();
            activeGlyph?.classList.remove('is-active');
            activeGlyph = null;
            return;
        }
        positionVisual();
        const busy = state === 'wait' || state === 'progress';
        if (next === activeGlyph) {
            if (busy && !moving) {
                visual.hidden = false;
                root.classList.add('gcq-cursor-overlay');
            }
            return;
        }
        const previous = activeGlyph;
        finishSwap();
        previous?.classList.remove('is-active');
        next.classList.add('is-active');
        activeGlyph = next;
        // Movement always belongs to the OS cursor. Never stretch, blend or
        // chase the pointer with a composited bitmap during mouse movement.
        if (moving || !previous) {
            if (busy && !moving) {
                visual.hidden = false;
                root.classList.add('gcq-cursor-overlay');
            } else parkVisual();
            return;
        }
        previous.classList.add('is-leaving');
        visual.hidden = false;
        root.classList.add('gcq-cursor-overlay');
        // One opaque silhouette on each side of a shared reveal boundary.
        // No crossfade, fractional scaling or double exposure of the artwork.
        const timing = { duration: 90, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'forwards' };
        const startTime = document.timeline.currentTime;
        const outgoing = previous.animate([
            { clipPath: 'inset(0 0px 0 0)' }, { clipPath: 'inset(0 48px 0 0)' },
        ], timing);
        const incoming = next.animate([
            { clipPath: 'inset(0 0 0 48px)' }, { clipPath: 'inset(0 0 0 0px)' },
        ], timing);
        outgoing.startTime = incoming.startTime = startTime;
        swaps.set(previous, outgoing);
        swaps.set(next, incoming);
        incoming.onfinish = () => {
            if (activeGlyph !== next || swaps.get(next) !== incoming) return;
            finishSwap();
            if (!busy) parkVisual();
        };
    }
    function hide() {
        clearTimeout(idleTimer);
        moving = false;
        pointer = null;
        pointerHit = null;
        clearTarget();
        showVisual(null);
        effects.querySelectorAll('.gcq-cursor-twinkle').forEach(el => el.remove());
    }
    function syncPreference() {
        const toggle = document.getElementById('quest-cursor-toggle');
        if (toggle) toggle.checked = enabled;
        root.classList.toggle('gcq-quest-cursor', allowed());
    }
    function refresh(hit = null) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        syncPreference();
        clearTarget();
        if (!allowed() || !pointer || document.hidden) { showVisual(null); return; }
        const el = hit instanceof Element ? hit : document.elementFromPoint(pointer.x, pointer.y);
        if (!el || el.closest('.gcq-cursor-effects')) { showVisual(null); return; }
        pointerHit = el;
        const style = getComputedStyle(el);
        const control = el.closest(INTERACTIVE);
        const field = el.closest(TEXT_INPUT);
        const disabled = Boolean(el.closest(':disabled, [aria-disabled="true"], [inert]'));
        const busy = Boolean(el.closest('[aria-busy="true"], [data-cursor-busy="true"], #loading-screen:not(.hidden)')) ||
            Boolean(disabled && control?.querySelector('.fa-spinner.fa-spin, .fa-circle-notch.fa-spin, .animate-spin, [role="progressbar"]'));
        const ownText = Array.from(el.childNodes).some(node => node.nodeType === 3 && node.textContent.trim());
        mode = resolveQuestCursor({ cursor: style.cursor, busy, disabled,
            interactive: Boolean(control),
            text: Boolean(field) || (!control && ownText && style.userSelect !== 'none' && style.webkitUserSelect !== 'none'),
            native: Boolean(el.closest('[data-gcq-native-cursor], iframe')) });
        if (dragging) mode = 'native';
        if (mode !== 'native') {
            target = el;
            target.setAttribute('data-gcq-cursor', mode);
        }
        showVisual(!motion.matches && mode !== 'native' ? mode : null);
    }
    function schedule() {
        if (!frame) frame = requestAnimationFrame(() => refresh());
    }
    function move(event) {
        if (event.pointerType !== 'mouse') {
            hide();
            if (event.pointerType === 'touch') {
                pointer = 'touch';
                syncPreference();
            }
            return;
        }
        pointer = { x: event.clientX, y: event.clientY };
        moving = true;
        parkVisual();
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            moving = false;
            if (pointer && allowed() && !motion.matches && !dragging && !document.hidden) {
                showVisual(mode !== 'native' ? mode : null);
            }
        }, 90);
        // Update semantics synchronously when crossing a control boundary.
        if (event.type === 'pointerover' || !pointerHit) refresh(event.target);
    }
    function press(event) {
        move(event);
        if (!allowed() || event.pointerType !== 'mouse' || event.button !== 0 || motion.matches) return;
        refresh();
        if (mode !== 'pointer') return;
        const spark = document.createElement('span');
        spark.className = 'gcq-cursor-twinkle';
        spark.style.left = `${event.clientX}px`;
        spark.style.top = `${event.clientY}px`;
        spark.innerHTML = '<i></i><i></i><i></i>';
        // Rapid clicking has a bounded number of decorative elements.
        while (effects.children.length > 5) effects.lastElementChild.remove();
        effects.append(spark);
        spark.addEventListener('animationend', () => spark.remove(), { once: true });
        setTimeout(() => spark.remove(), 500);
    }
    function preference(event) {
        if (event.target.id !== 'quest-cursor-toggle') return;
        enabled = event.target.checked;
        try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { /* session preference still works */ }
        if (!enabled) effects.querySelectorAll('.gcq-cursor-twinkle').forEach(el => el.remove());
        schedule();
    }
    function environmentChanged() {
        if (!fine.matches || contrast.matches || document.hidden) hide();
        if (motion.matches) effects.querySelectorAll('.gcq-cursor-twinkle').forEach(el => el.remove());
        schedule();
    }
    const on = (node, name, callback, options = {}) => node.addEventListener(name, callback, { ...options, signal: abort.signal });
    on(document, 'pointerover', move, { passive: true });
    on(document, 'pointermove', move, { passive: true });
    on(document, 'pointerdown', press, { capture: true, passive: true });
    on(document, 'pointerup', schedule, { passive: true });
    on(document, 'pointercancel', hide, { passive: true });
    on(document, 'scroll', schedule, { capture: true, passive: true });
    on(document, 'change', preference);
    on(root, 'pointerleave', hide);
    on(window, 'blur', hide);
    on(window, 'resize', () => { prepareNativeResolution(); schedule(); }, { passive: true });
    on(document, 'visibilitychange', environmentChanged);
    on(document, 'dragstart', () => { dragging = true; clearTarget(); showVisual(null); });
    on(document, 'dragend', () => { dragging = false; schedule(); });
    for (const query of [fine, contrast, motion]) on(query, 'change', environmentChanged);
    // Only observed UI changes trigger refreshes while the mouse is stationary.
    const observer = new MutationObserver(records => {
        if (!pointer || pointer === 'touch') { syncPreference(); return; }
        const changes = records.filter(record => !effects.contains(record.target) &&
            !(record.type === 'attributes' && record.oldValue === record.target.getAttribute(record.attributeName)));
        if (!changes.length) return;
        const affected = target || pointerHit;
        if (changes.some(record => affected &&
            (record.target.contains(affected) || affected.contains(record.target)))) {
            schedule();
            return;
        }
        // Background animations must not recalculate the cursor. Recheck only
        // when an unrelated UI change actually puts another element under it.
        if (document.elementFromPoint(pointer.x, pointer.y) !== pointerHit) schedule();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeOldValue: true,
        attributeFilter: ['class', 'style', 'disabled', 'readonly', 'aria-disabled', 'aria-busy', 'hidden', 'inert', 'data-cursor-busy'] });

    function prepareNativeResolution() {
        const ratio = window.devicePixelRatio || 1;
        if (ratio === nativePixelRatio) return;
        nativePixelRatio = ratio;
        const revision = ++nativeRevision;
        const bindings = Object.entries(getQuestCursorAssets(ratio)).map(([state, asset]) => {
            const supported = CSS.supports('cursor', asset.css);
            return { state, css: supported ? asset.css : asset.fallbackCss, url: supported ? asset.nativeUrl : asset.url };
        });
        // Decode the device-resolution images before replacing native artwork.
        Promise.all(bindings.map(binding => new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = binding.url;
        }))).then(results => {
            if (abort.signal.aborted || revision !== nativeRevision || !results.every(Boolean)) return;
            for (const binding of bindings) root.style.setProperty(`--gcq-cursor-${binding.state}`, binding.css);
            assetsReady = true;
            schedule();
        });
    }
    prepareNativeResolution();
    teardown = () => {
        abort.abort();
        observer.disconnect();
        cancelAnimationFrame(frame);
        clearTarget();
        clearTimeout(idleTimer);
        finishSwap();
        effects.remove();
        root.classList.remove('gcq-quest-cursor', 'gcq-cursor-overlay');
        for (const key of Object.keys(assets)) root.style.removeProperty(`--gcq-cursor-${key}`);
        teardown = undefined;
    };
    if (import.meta.hot) import.meta.hot.dispose(teardown);
    return teardown;
}
