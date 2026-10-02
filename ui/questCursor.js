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
        glyph.style.left = `${-asset.x}px`;
        glyph.style.top = `${-asset.y}px`;
        glyph.style.transformOrigin = `${asset.x}px ${asset.y}px`;
        glyph.innerHTML = decodeURIComponent(asset.url.split(',')[1]);
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
    let dragging = false;
    let activeGlyph = null;
    const fades = new Map();
    const allowed = () => assetsReady && enabled && fine.matches && !contrast.matches && pointer !== 'touch';
    function clearTarget() {
        target?.removeAttribute('data-gcq-cursor');
        target = null;
    }
    function showVisual(state) {
        const next = state && glyphs.get(state);
        if (!next) {
            visual.hidden = true;
            root.classList.remove('gcq-cursor-overlay');
            for (const fade of fades.values()) fade.cancel();
            fades.clear();
            activeGlyph?.classList.remove('is-active');
            activeGlyph = null;
            return;
        }
        visual.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
        if (next !== activeGlyph) {
            const layers = [...visual.children];
            const weights = layers.map(glyph => Number(getComputedStyle(glyph).opacity));
            const total = weights.reduce((sum, weight) => sum + weight, 0);
            const animate = !visual.hidden && total > 0;
            const startTime = document.timeline.currentTime;
            for (const [index, glyph] of layers.entries()) {
                fades.get(glyph)?.cancel();
                fades.delete(glyph);
                const opacity = glyph === next ? 1 : 0;
                glyph.classList.toggle('is-active', glyph === next);
                if (!animate) continue;
                // Restart every fade from its current weight on interruption. All
                // weights sum to one throughout, even when states change rapidly.
                const from = weights[index] / total;
                if (from === opacity) continue;
                const fade = glyph.animate([{ opacity: from }, { opacity }], { duration: 160, easing: 'linear' });
                fade.startTime = startTime;
                fades.set(glyph, fade);
                fade.onfinish = () => { if (fades.get(glyph) === fade) fades.delete(glyph); };
            }
            activeGlyph = next;
        }
        visual.hidden = false;
        root.classList.add('gcq-cursor-overlay');
    }
    function hide() {
        pointer = null;
        clearTarget();
        showVisual(null);
        effects.querySelectorAll('.gcq-cursor-twinkle').forEach(el => el.remove());
    }
    function syncPreference() {
        const toggle = document.getElementById('quest-cursor-toggle');
        if (toggle) toggle.checked = enabled;
        root.classList.toggle('gcq-quest-cursor', allowed());
    }
    function refresh() {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        syncPreference();
        clearTarget();
        if (!allowed() || !pointer || document.hidden) { showVisual(null); return; }
        const el = document.elementFromPoint(pointer.x, pointer.y);
        if (!el || el.closest('.gcq-cursor-effects')) { showVisual(null); return; }
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
        if (!frame) frame = requestAnimationFrame(refresh);
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
        // Position tracks the mouse directly; only changes of shape are eased.
        if (!visual.hidden) visual.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
        // Update semantics synchronously when crossing a control boundary.
        if (event.type === 'pointerover') refresh();
        else schedule();
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
    on(window, 'resize', schedule, { passive: true });
    on(document, 'visibilitychange', environmentChanged);
    on(document, 'dragstart', () => { dragging = true; clearTarget(); showVisual(null); });
    on(document, 'dragend', () => { dragging = false; schedule(); });
    for (const query of [fine, contrast, motion]) on(query, 'change', environmentChanged);
    // Only observed UI changes trigger refreshes while the mouse is stationary.
    const observer = new MutationObserver(records => {
        if (!pointer) { syncPreference(); return; }
        if (records.some(record => !effects.contains(record.target) &&
            !(record.type === 'attributes' && record.attributeName === 'style' && target && !record.target.contains(target)))) schedule();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['class', 'style', 'disabled', 'readonly', 'aria-disabled', 'aria-busy', 'hidden', 'inert', 'data-cursor-busy'] });

    // Do not replace the OS cursor until the browser has decoded the artwork.
    Promise.all(Object.values(assets).map(asset => new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = asset.url;
    }))).then(results => {
        if (abort.signal.aborted) return;
        assetsReady = results.every(Boolean);
        schedule();
    });
    teardown = () => {
        abort.abort();
        observer.disconnect();
        cancelAnimationFrame(frame);
        clearTarget();
        for (const fade of fades.values()) fade.cancel();
        fades.clear();
        effects.remove();
        root.classList.remove('gcq-quest-cursor', 'gcq-cursor-overlay');
        for (const key of Object.keys(assets)) root.style.removeProperty(`--gcq-cursor-${key}`);
        teardown = undefined;
    };
    if (import.meta.hot) import.meta.hot.dispose(teardown);
    return teardown;
}
