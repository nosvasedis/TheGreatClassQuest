// Quest cursors are always real OS cursors: they move with zero lag and never blur.
// Life comes from swapping pre-built frames on the hovered element: a quick pop when the
// state changes, a press while the button is held, and a calmly turning hourglass.
import { ANIMATED_STATES, HOURGLASS_FRAMES, getQuestCursorFrameSet, resolveQuestCursor } from './questCursorCore.mjs';

const STORAGE_KEY = 'gcq-quest-cursor-enabled';
const INTERACTIVE = 'button, a[href], select, summary, label[for], input[type="checkbox"], input[type="radio"], input[type="range"], input[type="button"], input[type="submit"], input[type="reset"], input[type="color"], input[type="file"], [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], .cursor-pointer';
const TEXT_INPUT = 'textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="color"]):not([type="file"]):not([type="hidden"]), [contenteditable=""], [contenteditable="true"], [role="textbox"]';
const WAITING = '#loading-screen:not(.hidden), [data-cursor-busy="wait"]';
const BUSY = '[aria-busy="true"], [data-cursor-busy="true"]';
const MEDIA = '(any-hover: hover) and (any-pointer: fine) and (forced-colors: none)';
// A state change pops in: slightly small, a touch of overshoot, then at rest.
const POP = [['enter', 0], ['settle', 55], [null, 125]];
const RELEASE = [['settle', 0], [null, 80]];
// Leaving and re-entering a busy state quickly keeps the hourglass where it was.
const HOURGLASS_MEMORY = 1500;
const HOURGLASS_CYCLE = HOURGLASS_FRAMES.reduce((sum, frame) => sum + frame.duration, 0);
let teardown;

function hourglassFrameAt(elapsed) {
    let t = ((elapsed % HOURGLASS_CYCLE) + HOURGLASS_CYCLE) % HOURGLASS_CYCLE;
    for (let i = 0; i < HOURGLASS_FRAMES.length; i++) {
        if (t < HOURGLASS_FRAMES[i].duration) return { index: i, remaining: HOURGLASS_FRAMES[i].duration - t };
        t -= HOURGLASS_FRAMES[i].duration;
    }
    return { index: 0, remaining: HOURGLASS_FRAMES[0].duration };
}

// text_selection.css marks selectable regions with --gcq-select because Firefox reports a
// child of an unselectable parent as user-select: auto even though it can't be selected.
function selectable(style) {
    return style.userSelect !== 'none' && style.webkitUserSelect !== 'none' &&
        style.getPropertyValue('--gcq-select').trim() !== 'none';
}

function cursorRules(frameSet, supported) {
    const css = asset => supported ? asset.css : asset.fallbackCss;
    const select = (mode, frame) => `:is(.gcq-quest-cursor, .gcq-quest-cursor *)[data-gcq-cursor="${mode}"]` +
        (frame ? `[data-gcq-frame="${frame}"]` : '');
    const rules = [`html.gcq-quest-cursor { cursor: ${css(frameSet.default.rest)}; }`];
    for (const [mode, { rest, frames }] of Object.entries(frameSet)) {
        rules.push(`${select(mode)} { cursor: ${css(rest)} !important; }`);
        for (const [frame, asset] of Object.entries(frames)) rules.push(`${select(mode, frame)} { cursor: ${css(asset)} !important; }`);
    }
    return `@media ${MEDIA} {\n${rules.join('\n')}\n}`;
}

export function setupQuestCursor() {
    if (teardown) return teardown;
    const root = document.documentElement;
    const fine = matchMedia('(any-hover: hover) and (any-pointer: fine)');
    const contrast = matchMedia('(forced-colors: active)');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const abort = new AbortController();
    let enabled = true;
    try { enabled = localStorage.getItem(STORAGE_KEY) !== 'false'; } catch { /* private browsing */ }

    const sheet = document.createElement('style');
    sheet.id = 'gcq-quest-cursor-frames';
    document.head.append(sheet);
    const effects = document.createElement('div');
    effects.className = 'gcq-cursor-effects';
    effects.setAttribute('aria-hidden', 'true');
    document.body.append(effects);

    let target = null;
    let mode = 'native';
    let frame = null;
    let pointer = null;
    let pointerHit = null;
    let raf = 0;
    let assetsReady = false;
    let nativePixelRatio = 0;
    let nativeRevision = 0;
    let dragging = false;
    let pressed = false;
    let poseTimers = [];
    let hourglassTimer = 0;
    let hourglassEpoch = 0;
    let hourglassLeft = -Infinity;
    const allowed = () => assetsReady && enabled && fine.matches && !contrast.matches && pointer !== 'touch';
    const animate = () => !motion.matches && !document.hidden;

    function setFrame(next) {
        frame = next;
        if (!target) return;
        if (next === null) target.removeAttribute('data-gcq-frame');
        else target.setAttribute('data-gcq-frame', next);
    }
    function clearTarget() {
        target?.removeAttribute('data-gcq-cursor');
        target?.removeAttribute('data-gcq-frame');
        target = null;
    }
    function stopPose() {
        poseTimers.forEach(clearTimeout);
        poseTimers = [];
    }
    function playPose(steps) {
        stopPose();
        if (!animate() || ANIMATED_STATES.has(mode)) { setFrame(null); return; }
        for (const [pose, delay] of steps) {
            if (!delay) setFrame(pose);
            else poseTimers.push(setTimeout(() => setFrame(pose), delay));
        }
    }
    function stopHourglass() {
        if (!hourglassTimer) return;
        clearTimeout(hourglassTimer);
        hourglassTimer = 0;
        hourglassLeft = performance.now();
    }
    function tickHourglass() {
        hourglassTimer = 0;
        if (!ANIMATED_STATES.has(mode) || !animate()) { setFrame(null); return; }
        const now = performance.now();
        const { index, remaining } = hourglassFrameAt(now - hourglassEpoch);
        if (frame !== String(index)) setFrame(String(index));
        hourglassTimer = setTimeout(tickHourglass, Math.max(16, remaining));
    }
    function startHourglass() {
        if (hourglassTimer) return;
        const now = performance.now();
        if (now - hourglassLeft > HOURGLASS_MEMORY) hourglassEpoch = now;
        tickHourglass();
    }
    function apply(nextTarget, nextMode) {
        const previousMode = mode;
        if (nextTarget !== target) {
            clearTarget();
            target = nextTarget;
        }
        mode = nextMode;
        if (!target) {
            stopPose();
            stopHourglass();
            frame = null;
            return;
        }
        target.setAttribute('data-gcq-cursor', mode);
        if (ANIMATED_STATES.has(mode)) {
            stopPose();
            if (animate()) startHourglass();
            else stopHourglass();
            // A new element under the same busy cursor takes over the current frame instantly.
            setFrame(animate() && hourglassTimer ? String(hourglassFrameAt(performance.now() - hourglassEpoch).index) : null);
            return;
        }
        stopHourglass();
        if (mode !== previousMode) {
            pressed = false;
            playPose(POP);
        } else {
            // Same state on a new element: carry the pose over without restarting it.
            setFrame(pressed && animate() ? 'press' : frame);
        }
    }
    function hide() {
        pointer = null;
        pointerHit = null;
        pressed = false;
        apply(null, 'native');
        effects.replaceChildren();
    }
    function syncPreference() {
        const toggle = document.getElementById('quest-cursor-toggle');
        if (toggle) toggle.checked = enabled;
        root.classList.toggle('gcq-quest-cursor', allowed());
    }
    function refresh(hit = null) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        syncPreference();
        if (!allowed() || !pointer || pointer === 'touch' || document.hidden) { apply(null, 'native'); return; }
        const el = hit instanceof Element ? hit : document.elementFromPoint(pointer.x, pointer.y);
        if (!el || el.closest('.gcq-cursor-effects')) { apply(null, 'native'); return; }
        pointerHit = el;
        // Read the page's own cursor, not ours: lift our marker for this synchronous read only,
        // so no frame is ever painted without it.
        const marked = el === target;
        if (marked) el.removeAttribute('data-gcq-cursor');
        const style = getComputedStyle(el);
        const cursor = style.cursor;
        if (marked) el.setAttribute('data-gcq-cursor', mode);
        const control = el.closest(INTERACTIVE);
        const field = el.closest(TEXT_INPUT);
        const disabled = Boolean(el.closest(':disabled, [aria-disabled="true"], [inert]'));
        const waiting = Boolean(el.closest(WAITING));
        const busy = waiting ? 'wait' : Boolean(el.closest(BUSY)) ||
            Boolean(disabled && control?.querySelector('.fa-spinner.fa-spin, .fa-circle-notch.fa-spin, .animate-spin, [role="progressbar"]'));
        const ownText = Array.from(el.childNodes).some(node => node.nodeType === 3 && node.textContent.trim());
        let next = resolveQuestCursor({ cursor, busy, disabled,
            interactive: Boolean(control),
            text: Boolean(field) || (!control && ownText && selectable(style)),
            native: Boolean(el.closest('[data-gcq-native-cursor], iframe')) });
        if (dragging) next = 'native';
        apply(next === 'native' ? null : el, next);
    }
    function schedule() {
        if (!raf) raf = requestAnimationFrame(() => refresh());
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
        // Movement itself never touches styles; only crossing into another element does.
        if (event.type === 'pointerover' || !pointerHit) refresh(event.target);
    }
    function press(event) {
        move(event);
        if (!allowed() || event.pointerType !== 'mouse' || event.button !== 0) return;
        refresh();
        if (!target || ANIMATED_STATES.has(mode) || mode === 'text' || !animate()) return;
        pressed = true;
        stopPose();
        setFrame('press');
        if (mode === 'pointer') twinkle(event.clientX, event.clientY);
    }
    function release(event) {
        if (pressed) {
            pressed = false;
            if (target && !ANIMATED_STATES.has(mode)) playPose(RELEASE);
        }
        if (event.type === 'pointerup') schedule();
    }
    function twinkle(x, y) {
        const spark = document.createElement('span');
        spark.className = 'gcq-cursor-twinkle';
        spark.style.left = `${x}px`;
        spark.style.top = `${y}px`;
        spark.innerHTML = '<b></b><i></i><i></i><i></i><i></i>';
        // Rapid clicking keeps a bounded number of decorative elements.
        while (effects.children.length > 4) effects.firstElementChild.remove();
        effects.append(spark);
        spark.addEventListener('animationend', () => spark.remove(), { once: true });
        setTimeout(() => spark.remove(), 700);
    }
    function preference(event) {
        if (event.target.id !== 'quest-cursor-toggle') return;
        enabled = event.target.checked;
        try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { /* session preference still works */ }
        if (!enabled) effects.replaceChildren();
        schedule();
    }
    function environmentChanged() {
        if (!fine.matches || contrast.matches || document.hidden) hide();
        if (!animate()) {
            effects.replaceChildren();
            stopPose();
            stopHourglass();
            setFrame(null);
        }
        // Force a fresh evaluation so a resumed hourglass starts ticking again.
        const hit = pointerHit;
        pointerHit = null;
        if (pointer && pointer !== 'touch' && hit) refresh();
        else schedule();
    }
    const on = (node, name, callback, options = {}) => node.addEventListener(name, callback, { ...options, signal: abort.signal });
    on(document, 'pointerover', move, { passive: true });
    on(document, 'pointermove', move, { passive: true });
    on(document, 'pointerdown', press, { capture: true, passive: true });
    on(document, 'pointerup', release, { capture: true, passive: true });
    on(document, 'pointercancel', event => { release(event); hide(); }, { passive: true });
    on(document, 'scroll', schedule, { capture: true, passive: true });
    on(document, 'change', preference);
    on(root, 'pointerleave', hide);
    on(window, 'blur', hide);
    on(window, 'resize', () => {
        // Resize/zoom invalidates cached client coordinates; wait for the next real pointer event.
        hide();
        prepareNativeResolution();
    }, { passive: true });
    on(document, 'visibilitychange', environmentChanged);
    on(document, 'dragstart', () => { dragging = true; apply(null, 'native'); });
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
        const frameSet = getQuestCursorFrameSet(ratio);
        const supported = CSS.supports('cursor', frameSet.default.rest.css);
        const urls = Object.values(frameSet).flatMap(({ rest, frames }) =>
            [rest, ...Object.values(frames)].map(asset => supported ? asset.nativeUrl : asset.url));
        // Decode every frame before switching, so no frame can ever fall back to a system cursor.
        Promise.all(urls.map(url => new Promise(resolve => {
            const img = new Image();
            img.onload = () => (img.decode ? img.decode().then(() => resolve(true), () => resolve(true)) : resolve(true));
            img.onerror = () => resolve(false);
            img.src = url;
        }))).then(results => {
            if (abort.signal.aborted || revision !== nativeRevision || !results.every(Boolean)) return;
            sheet.textContent = cursorRules(frameSet, supported);
            assetsReady = true;
            schedule();
        });
    }
    prepareNativeResolution();
    teardown = () => {
        abort.abort();
        observer.disconnect();
        cancelAnimationFrame(raf);
        stopPose();
        stopHourglass();
        clearTarget();
        effects.remove();
        sheet.remove();
        root.classList.remove('gcq-quest-cursor');
        teardown = undefined;
    };
    if (import.meta.hot) import.meta.hot.dispose(teardown);
    return teardown;
}
