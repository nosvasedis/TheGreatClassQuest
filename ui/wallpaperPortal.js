// ui/wallpaperPortal.js
// The journey between the Home greeting card and Projector Mode.
//
// Opening: the picture inside the greeting card (its pale sky and the meadow with the cottage)
// grows until it fills the screen, as if the camera walks into the card. Without stopping,
// the camera then travels right along the hills: near hills slide past faster than far ones,
// the cottage drifts away and the castle rises on the horizon. The clock, the ribbon and the
// remote come into focus in place once the camera has arrived.
// Closing plays the same journey backwards and settles into the greeting card again.
//
// Full screen is entered before anything is measured (and left before the way back), so every
// size is final while things move and nothing jumps when the journey ends.

import * as utils from '../utils.js';
import { getGreetingHillsHtml, treesHtml } from '../features/homeGreetingScene.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FULLSCREEN_WAIT_MS = 800;

// Opening: the camera enters the card, then travels to the castle (the two overlap, so it never stops).
const ENTER_MS = 1500;
const TRAVEL_MS = 3000;
const TRAVEL_START = 850;
// Closing: travel back to the cottage, then pull out into the card.
const BACK_TRAVEL_MS = 2600;
const EXIT_MS = 1400;
const EXIT_START = 1900;

const EASE_TRAVEL = 'cubic-bezier(.45, 0, .25, 1)';
const EASE_SOFT = 'cubic-bezier(.3, .7, .3, 1)';

/**
 * Parallax: every depth swaps its meadow for the realm while the camera travels. `extra` is how
 * far each strip reaches past the screen edge (with hills that carry on), `feather` the soft seam
 * between the two, both in screen widths. Travel distance is 1 + 2 * extra - feather, so near
 * hills move furthest.
 */
const DEPTHS = {
    far: { extra: 0.22, feather: 0.22 },
    mid: { extra: 0.34, feather: 0.28 },
    near: { extra: 0.5, feather: 0.3 }
};
const travelOf = ({ extra, feather }) => 1 + 2 * extra - feather;

/** Which parts of the greeting hills belong to each depth. */
const MEADOW_PARTS = {
    far: ['.gh-layer--far', 'rect.gh-layer'],
    mid: ['.gh-layer--mid', '.gh-trees--mid', '.gh-layer--mid2', '.gh-crest--mid'],
    near: ['.gh-layer--near', '.gh-crest:not(.gh-crest--mid)', '.gh-cottage', '.gh-trees--near', '.gh-shade']
};

/** The realm's weather and big clouds float above the hills, so they wait while the card's sky shows. */
const SKY_VEILED = ['#wall-weather-fx', ':scope > .z-10'];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const byId = (id) => document.getElementById(id);
const px = (n) => `${Math.round(n * 100) / 100}px`;

function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

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

function setMask(el, gradient) {
    el.style.maskImage = gradient;
    el.style.webkitMaskImage = gradient;
}

/**
 * While the projector is full screen, Esc belongs to the projector: one press plays the closing
 * journey instead of the browser dropping out of full screen under it (holding Esc still leaves
 * full screen). Browsers without the Keyboard Lock API keep their own Esc.
 */
function lockEscape() {
    navigator.keyboard?.lock?.(['Escape']).catch(() => {});
}

function unlockEscape() {
    try { navigator.keyboard?.unlock?.(); } catch { /* nothing locked */ }
}

/** Enters full screen and resolves once the new size is in place (or it was refused). */
export async function enterFullscreen() {
    const root = document.documentElement;
    if (!root.requestFullscreen || document.fullscreenElement) return;
    const changed = new Promise((resolve) => {
        document.addEventListener('fullscreenchange', resolve, { once: true });
        setTimeout(resolve, FULLSCREEN_WAIT_MS);
    });
    root.requestFullscreen().then(lockEscape, () => {});
    await changed;
    await nextFrames();
}

/** Leaves full screen and resolves once the page is back at its normal size. */
export async function leaveFullscreen() {
    unlockEscape();
    if (!document.fullscreenElement || !document.exitFullscreen) return;
    const changed = new Promise((resolve) => {
        document.addEventListener('fullscreenchange', resolve, { once: true });
        setTimeout(resolve, FULLSCREEN_WAIT_MS);
    });
    document.exitFullscreen().catch(() => {});
    await changed;
    await nextFrames();
}

// ─── The camera frame: where the greeting card sits on screen ──────────────

/**
 * The greeting card's picture (its sky and hills) on screen, or a gentle stand-in window in the
 * middle when Home isn't showing. Everything is in viewport pixels.
 */
function measureCard(vw, vh) {
    const panel = document.querySelector('#about-tab:not(.hidden) .greeting-panel');
    const sky = panel?.querySelector('.greeting-sky');
    const hills = sky?.querySelector('.greeting-hills');
    const rect = sky?.getBoundingClientRect();
    const onScreen = rect && rect.width > 40 && rect.height > 40
        && rect.bottom > vh * 0.15 && rect.top < vh * 0.85 && rect.right > 0 && rect.left < vw;
    if (onScreen) {
        const part = [...panel.classList].find((c) => c.startsWith('greeting-panel--'))?.slice(16);
        return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            radius: parseFloat(getComputedStyle(sky).borderTopLeftRadius) || 28,
            hillsHeight: hills?.getBoundingClientRect().height || rect.height * 0.58,
            part: part || null,
            live: true
        };
    }
    const width = Math.min(vw * 0.6, 900);
    const height = width * 0.36;
    return {
        left: (vw - width) / 2,
        top: (vh - height) / 2,
        width,
        height,
        radius: 28,
        hillsHeight: height * 0.58,
        part: null,
        live: false
    };
}

/**
 * The wallpaper is scaled down (uniformly) so its bottom strip sits exactly inside the card, and
 * clipped to the card's rounded window. Easing both back to rest is the camera walking in.
 */
function cameraFrames(card, vw, vh) {
    const s = Math.min(1, Math.max(card.width / vw, card.height / vh));
    const lw = card.width / s;
    const lh = card.height / s;
    const lx = (vw - lw) / 2;
    const ly = vh - lh;
    return {
        vh,
        scale: s,
        tx: card.left - lx * s,
        ty: card.top - ly * s,
        inset: { top: ly, right: vw - lx - lw, left: lx },
        radius: card.radius / s,
        window: { top: ly, height: lh }
    };
}

/** Standard CSS cubic-bezier timing function, solved for x with a few Newton steps. */
function cubicBezier(x1, y1, x2, y2) {
    const curve = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
    const slope = (a, b, t) => 3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
    return (x) => {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        let t = x;
        for (let i = 0; i < 8; i++) {
            const d = slope(x1, x2, t);
            if (Math.abs(d) < 1e-6) break;
            t -= (curve(x1, x2, t) - x) / d;
            t = Math.min(1, Math.max(0, t));
        }
        return curve(y1, y2, t);
    };
}

const easeCamera = cubicBezier(0.62, 0, 0.24, 1);
const easeOut = cubicBezier(0, 0, 0.58, 1);
const easeIn = cubicBezier(0.42, 0, 1, 1);

/**
 * Places the camera between the card (`at` 0) and full screen (`at` 1). Transform, clip and the
 * card's sky are written together, in one frame, as plain styles: no animated clip-path, which
 * browsers may hand to the GPU and which flickers there next to the realm's glass panels.
 */
function placeCamera(wallEl, cardSky, frame, at, opacity) {
    const k = 1 - at;
    const s = frame.scale + (1 - frame.scale) * at;
    const { top, right, left } = frame.inset;
    wallEl.style.transform = `translate(${px(frame.tx * k)}, ${px(frame.ty * k)}) scale(${Math.round(s * 1e5) / 1e5})`;
    wallEl.style.clipPath = at >= 1 ? 'none'
        : `inset(${px(top * k)} ${px(right * k)} 0px ${px(left * k)} round ${px(frame.radius * k)})`;
    wallEl.style.opacity = String(Math.round(opacity * 1000) / 1000);
    cardSky.style.top = px(frame.window.top * k);
    cardSky.style.height = px(frame.window.height + (frame.vh - frame.window.height) * at);
}

function releaseCamera(wallEl) {
    ['transform', 'clipPath', 'opacity', 'transformOrigin'].forEach((prop) => { wallEl.style[prop] = ''; });
    wallEl.classList.remove('is-zooming');
}

/**
 * Runs the camera over `duration` ms after `delay`, from the card into full screen (`in`) or back
 * out into the card (`out`). The wallpaper fades in over the first `fadeMs` (in) or out over the
 * last `fadeMs` (out), so the card's words dissolve in or out underneath. While it runs the glass
 * panels are taken out of rendering (they are invisible at that moment anyway).
 */
function runCamera(wallEl, cardSky, frame, { direction, duration, delay = 0, fadeMs }) {
    const opening = direction === 'in';
    const pose = (elapsed) => {
        const t = Math.min(1, Math.max(0, elapsed / duration));
        const eased = easeCamera(t);
        const at = opening ? eased : 1 - eased;
        const fromEnd = duration - elapsed;
        const opacity = opening
            ? easeOut(Math.min(1, Math.max(0, elapsed / fadeMs)))
            : 1 - easeIn(Math.min(1, Math.max(0, 1 - fromEnd / fadeMs)));
        placeCamera(wallEl, cardSky, frame, at, opacity);
    };
    const begin = () => {
        wallEl.style.transformOrigin = '0 0';
        wallEl.classList.add('is-zooming');
    };
    if (opening && delay <= 0) {
        begin();
        pose(0);
    }
    return new Promise((resolve) => {
        const start = performance.now() + delay;
        const tick = (now) => {
            const elapsed = now - start;
            if (elapsed >= 0) {
                if (!wallEl.classList.contains('is-zooming')) begin();
                pose(elapsed);
            }
            if (elapsed < duration) requestAnimationFrame(tick);
            else resolve();
        };
        requestAnimationFrame(tick);
    });
}

// ─── The scene: the card's sky, the meadow strips and the realm strips ─────

/** A copy of the greeting card's pale sky, sized to the camera window. */
function buildCardSky(wallEl, part, frame) {
    const sky = document.createElement('div');
    sky.className = `greeting-panel greeting-panel--${part} wp-cardsky`;
    sky.setAttribute('aria-hidden', 'true');
    sky.innerHTML = '<div class="greeting-bg-mesh"></div><div class="greeting-sky"><span class="greeting-sky__glow"></span><span class="greeting-sky__stars"></span></div>';
    sky.style.top = px(frame.window.top);
    sky.style.height = px(frame.window.height);
    wallEl.appendChild(sky);
    return sky;
}

// ─── Hills beyond the screen edge ───────────────────────────────────────────
// While the camera travels, each strip shows a stretch past what the card or the horizon draws.
// These ridges carry the original hills on with the same slope (so the join is invisible) and
// roll gently between peaks and valleys that stay within the original hills' height.

const r2 = (n) => Math.round(n * 10) / 10;

/**
 * A run of hills from `start`, leaving it along the tangent set by `ctrl` (the last control point
 * of the original curve), `dir` 1 to the right or -1 to the left. Peaks and valleys alternate and
 * are flat on top, so the whole run is smooth. Returns the extremes and the cubic segments.
 */
function ridgeRun({ start, ctrl, dir, length, peaks, valleys }) {
    const goingDown = 2 * start[1] - ctrl[1] > start[1];
    const count = peaks.length + valleys.length;
    const points = [start];
    for (let i = 0; i < count; i++) {
        const isValley = (i % 2 === 0) === goingDown;
        const y = isValley ? valleys[Math.floor(i / 2)] : peaks[Math.floor(i / 2)];
        points.push([start[0] + dir * length * ((i + 1) / count), y]);
    }
    const segments = [];
    for (let i = 0; i < points.length - 1; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[i + 1];
        const reach = (x1 - x0) / 2.6;
        const c1 = i === 0 ? [2 * x0 - ctrl[0], 2 * y0 - ctrl[1]] : [x0 + reach, y0];
        segments.push({ from: points[i], c1, c2: [x1 - reach, y1], to: points[i + 1] });
    }
    return { points, segments };
}

const fmt = ([x, y]) => `${r2(x)} ${r2(y)}`;
const forward = (run) => run.segments.map((s) => `C ${fmt(s.c1)}, ${fmt(s.c2)}, ${fmt(s.to)}`).join(' ');
const backward = (run) => [...run.segments].reverse().map((s) => `C ${fmt(s.c2)}, ${fmt(s.c1)}, ${fmt(s.from)}`).join(' ');

/** The meadow's layers continued to the right, from x 1440 to 2880 (the card's viewBox is 1440 wide). */
const MEADOW_RIDGES = {
    far: { start: [1440, 136], ctrl: [1400, 128], peaks: [112, 118, 110], valleys: [146, 140, 148] },
    mid: { start: [1440, 184], ctrl: [1390, 176], peaks: [168, 164, 170], valleys: [196, 192, 198] },
    mid2: { start: [1440, 229], ctrl: [1425, 226], peaks: [222, 220, 224], valleys: [246, 242, 248] },
    near: { start: [1440, 276], ctrl: [1330, 270], peaks: [262, 258, 264], valleys: [286, 282, 288] }
};

/** The castle horizon's layers continued to the left, from x 0 to -1600 (its viewBox is 1600 wide). */
const REALM_RIDGES = {
    far: { start: [0, 150], ctrl: [140, 95], peaks: [92, 100, 86], valleys: [138, 128, 142] },
    near: { start: [0, 190], ctrl: [180, 150], peaks: [156, 150, 160], valleys: [186, 182, 190] }
};

/** Extends a copy of the greeting hills to the right with rolling ridges and a few more trees. */
function extendMeadow(svg) {
    const run = {};
    Object.entries(MEADOW_RIDGES).forEach(([layer, spec]) => {
        run[layer] = ridgeRun({ ...spec, dir: 1, length: 1440 });
    });
    const edge = /\s*L1440 320 L0 320 Z\s*$/;
    const extendFill = (path, layer) => {
        path?.setAttribute('d', `${path.getAttribute('d').replace(edge, '')} ${forward(run[layer])} L2880 320 L0 320 Z`);
    };
    ['far', 'mid', 'mid2', 'near'].forEach((layer) => extendFill(svg.querySelector(`.gh-layer--${layer}`), layer));
    extendFill(svg.querySelector('.gh-shade'), 'near');
    const crest = svg.querySelector('.gh-crest:not(.gh-crest--mid)');
    crest?.setAttribute('d', `${crest.getAttribute('d')} ${forward(run.near)}`);
    const crestMid = svg.querySelector('.gh-crest--mid');
    crestMid?.setAttribute('d', `${crestMid.getAttribute('d')} ${forward(run.mid2)}`);
    svg.querySelector('rect.gh-layer')?.setAttribute('width', '2880');

    // A few trees on the new peaks, in the same two rows as the card's.
    const onPeak = (layer, i) => run[layer].points.filter((_, k) => k > 0 && k % 2 === 0)[i] || run[layer].points[1];
    const tree = (layer, i, dx, size, kind) => {
        const [x, y] = onPeak(layer, i);
        return [r2(x + dx), r2(y + 1), size, kind];
    };
    const midTrees = document.createElementNS(SVG_NS, 'g');
    midTrees.setAttribute('class', 'gh-trees gh-trees--mid');
    midTrees.innerHTML = treesHtml([tree('mid', 0, -10, 0.85, 'c'), tree('mid', 0, 8, 0.7, 'c'), tree('mid', 1, 0, 0.95, 'o'), tree('mid', 2, -6, 0.8, 'c')]);
    svg.querySelector('.gh-trees--mid')?.after(midTrees);
    const nearTrees = document.createElementNS(SVG_NS, 'g');
    nearTrees.setAttribute('class', 'gh-trees gh-trees--near');
    nearTrees.innerHTML = treesHtml([tree('near', 0, 0, 1.25, 'o'), tree('near', 1, -12, 1.2, 'c'), tree('near', 1, 6, 1.0, 'c')]);
    svg.querySelector('.gh-trees--near')?.after(nearTrees);

    // The side shading keeps its look over the card's width and simply carries on past it.
    const shade = svg.querySelector('linearGradient[id$="gh-shade"]');
    shade?.setAttribute('gradientUnits', 'userSpaceOnUse');
    shade?.setAttribute('x2', '1440');
}

/** Extends a copy of a horizon layer (`far` or `near`) to the left with rolling ridges. */
function extendRealm(svg, layer) {
    const path = svg.querySelector('path');
    if (!path) return;
    const run = ridgeRun({ ...REALM_RIDGES[layer], dir: -1, length: 1600 });
    const [lastX, lastY] = run.points[run.points.length - 1];
    // Original: "M0 150 C … L1600 260 L0 260 Z" becomes "M-1600 260 L-1600 y C …(to 0 150) C … L1600 260 Z".
    const rest = path.getAttribute('d').replace(/^M\s*0\s+[\d.]+\s*/, '').replace(/\s*L0 260 Z\s*$/, '');
    path.setAttribute('d', `M${r2(lastX)} 260 L${r2(lastX)} ${r2(lastY)} ${backward(run)} ${rest} L${r2(lastX)} 260 Z`);
}

/**
 * The Home meadow, split by depth. Each strip is drawn exactly as in the card (same width, same
 * crop) and carries on to the right with more hills, fading out over its last stretch.
 */
function buildMeadow(part, hillsHeight, vw) {
    const strips = {};
    Object.entries(MEADOW_PARTS).forEach(([depth, selectors]) => {
        const { extra, feather } = DEPTHS[depth];
        // Fresh gradient ids so the copy never borrows the Home card's defs.
        const html = getGreetingHillsHtml().replace(/id="gh-/g, `id="wp-${depth}-gh-`).replace(/url\(#gh-/g, `url(#wp-${depth}-gh-`);
        const holder = document.createElement('div');
        holder.innerHTML = html.trim();
        const svg = holder.querySelector('svg');
        extendMeadow(svg);
        [...svg.children].forEach((node) => {
            if (node.tagName.toLowerCase() !== 'defs' && !selectors.some((sel) => node.matches(sel))) node.remove();
        });
        svg.style.width = px(vw);

        // The palette classes give the copy the card's colours for this part of the day.
        const strip = document.createElement('div');
        strip.className = `greeting-panel greeting-panel--${part} wp-strip wp-strip--meadow`;
        strip.dataset.depth = depth;
        strip.setAttribute('aria-hidden', 'true');
        strip.style.width = px(vw * (1 + extra));
        strip.style.height = px(hillsHeight);
        setMask(strip, `linear-gradient(90deg, #000 calc(100% - ${px(vw * feather)}), transparent 100%)`);
        strip.appendChild(svg);
        strips[depth] = strip;
    });
    return strips;
}

/**
 * The castle horizon's far and near hills as travelling copies that reach back to the left with
 * more hills and fade in over that stretch. At rest they match the real horizon pixel for pixel.
 */
function buildRealm(horizon, vw) {
    const strips = {};
    [['far', '.wall-horizon__far'], ['near', '.wall-horizon__near']].forEach(([depth, selector]) => {
        const source = horizon?.querySelector(selector);
        if (!source) return;
        const { extra, feather } = DEPTHS[depth];
        const svg = source.cloneNode(true);
        extendRealm(svg, depth);
        svg.style.left = px(vw * extra);
        svg.style.width = px(vw);

        const strip = document.createElement('div');
        strip.className = 'wall-horizon wp-strip wp-strip--realm';
        strip.dataset.depth = depth;
        strip.setAttribute('aria-hidden', 'true');
        strip.style.left = px(-vw * extra);
        strip.style.width = px(vw * (1 + extra));
        setMask(strip, `linear-gradient(90deg, transparent 0, #000 ${px(vw * feather)})`);
        strip.appendChild(svg);
        strips[depth] = strip;
    });
    return strips;
}

/**
 * Builds everything the journey needs, stacked by depth around the real horizon (whose castle
 * travels with the middle hills): far hills, castle, middle hills, near hills. `remove()` puts
 * the wallpaper back as it was.
 */
function buildJourney(wallEl, card, frame, vw) {
    const part = card.part || utils.getCurrentDayPart?.()?.part || 'afternoon';
    const horizon = byId('wall-horizon');
    const cardSky = buildCardSky(wallEl, part, frame);
    const realm = buildRealm(horizon, vw);
    const meadow = buildMeadow(part, card.hillsHeight / frame.scale, vw);
    const behind = [realm.far, meadow.far].filter(Boolean);
    const inFront = [meadow.mid, realm.near, meadow.near].filter(Boolean);
    if (horizon) {
        horizon.before(...behind);
        horizon.after(...inFront);
        horizon.classList.add('is-travelling');
    } else {
        wallEl.append(...behind, ...inFront);
    }
    return {
        cardSky,
        meadow,
        realm,
        castle: horizon?.querySelector('.wall-horizon__castle'),
        remove() {
            cardSky.remove();
            [...Object.values(meadow), ...Object.values(realm)].forEach((el) => el.remove());
            horizon?.classList.remove('is-travelling');
        }
    };
}

/**
 * The camera truck to the right (`forward`) or back to the cottage (`back`): each depth slides by its
 * own distance and the castle rides with the middle hills. The sky is far away and stays put.
 */
function travelAnimations(journey, vw, direction, options) {
    const x = (n) => ({ transform: `translateX(${px(n)})` });
    const slide = (from, to) => (direction === 'forward' ? [x(from), x(to)] : [x(to), x(from)]);
    const moves = [];
    Object.entries(DEPTHS).forEach(([depth, spec]) => {
        const d = vw * travelOf(spec);
        moves.push(animate(journey.meadow[depth], slide(0, -d), options));
        if (journey.realm[depth]) moves.push(animate(journey.realm[depth], slide(d, 0), options));
        if (depth === 'mid') moves.push(animate(journey.castle, slide(d, 0), options));
    });
    return moves;
}

/**
 * The card's meadow is drawn in pale colours even at night; when the realm is dark, it dims as the
 * camera walks out of the card (and brightens again on the way back), so the seam never glows.
 */
function duskAnimations(wallEl, journey, direction, options) {
    if (!wallEl.classList.contains('is-night')) return [];
    const frames = [{ filter: 'brightness(1)' }, { filter: 'brightness(0.5) saturate(1.15)' }];
    if (direction === 'back') frames.reverse();
    return Object.values(journey.meadow).map((strip) => animate(strip, frames, options));
}

/**
 * Everything that sits over the scene, as [element id, what fades]. It only fades and comes into
 * focus, it never moves or resizes. The ribbon fades inside its container, which keeps its own
 * opacity (it stays hidden until the day's quote has loaded).
 */
const FOREGROUND = [
    ['wall-center-hub', (el) => el],
    ['wall-quote-container', (el) => el.firstElementChild],
    ['wall-remote', (el) => el],
    ['wall-floating-area', (el) => el],
    ['wall-timer-overlay', (el) => el]
];

function foreground() {
    return FOREGROUND.map(([id, pick]) => {
        const el = byId(id);
        return el ? pick(el) : null;
    });
}

/** Keeps elements invisible (without touching their inline styles) until cancelled. */
function holdHidden(elements) {
    return elements.map((el) => animate(el, [{ opacity: 0 }, { opacity: 0 }], { duration: 1 }));
}

/**
 * Plays the opening. The wallpaper element must already be visible (no `hidden`) and this must
 * be called straight from the button press so full screen counts as user-initiated.
 * Resolves when the scene is at rest.
 */
export async function playPortalOpen(wallEl) {
    const reduced = prefersReducedMotion();
    const [hub, ribbon, remote, floating, timer] = foreground();
    // Nothing shows until the camera is placed on the card.
    const holds = holdHidden([wallEl, hub, ribbon, remote, floating, timer]);

    await enterFullscreen();

    if (reduced) {
        cancelAll(holds);
        const fade = animate(wallEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' });
        await settle([fade]);
        cancelAll([fade]);
        return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const card = measureCard(vw, vh);
    const frame = cameraFrames(card, vw, vh);
    const journey = buildJourney(wallEl, card, frame, vw);
    const animations = [];

    // 1. Into the card: the picture grows to fill the screen while the card's words dissolve.
    cancelAll(holds.slice(0, 1));
    const camera = runCamera(wallEl, journey.cardSky, frame, { direction: 'in', duration: ENTER_MS, fadeMs: card.live ? 320 : 600 });

    // 2. Along the hills to the castle, starting before the camera has fully stepped in.
    const travelTiming = { duration: TRAVEL_MS, delay: TRAVEL_START, easing: EASE_TRAVEL };
    animations.push(...travelAnimations(journey, vw, 'forward', travelTiming));
    // The card's pale sky gives way to the realm's sky as the camera leaves the cottage.
    const skyTiming = { duration: TRAVEL_MS * 0.7, delay: ENTER_MS * 0.4, easing: 'ease-in-out' };
    animations.push(animate(journey.cardSky, [{ opacity: 1 }, { opacity: 0 }], skyTiming));
    // The realm's weather and big clouds join once the camera is through the card.
    const veilTiming = { duration: TRAVEL_MS * 0.6, delay: ENTER_MS, easing: 'ease-in-out' };
    SKY_VEILED.forEach((sel) => animations.push(animate(wallEl.querySelector(sel), [{ opacity: 0 }, { opacity: 1 }], veilTiming)));
    animations.push(...duskAnimations(wallEl, journey, 'forward', skyTiming));

    // 3. The realm's foreground comes into focus in place as the camera settles.
    const arrivedAt = TRAVEL_START + TRAVEL_MS;
    [[hub, -700, 1100], [ribbon, -350, 900], [timer, -350, 900], [remote, -100, 700]].forEach(([el, offset, ms]) => {
        animations.push(animate(el, [
            { opacity: 0, filter: 'blur(10px)' },
            { opacity: 1, filter: 'blur(0px)' }
        ], { duration: ms, delay: arrivedAt + offset, easing: EASE_SOFT }));
    });
    animations.push(animate(floating, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: arrivedAt }));
    cancelAll(holds);

    await camera;
    releaseCamera(wallEl);
    await settle(animations);
    // The travelling copies match the real horizon at rest, so they hand over in a single frame.
    cancelAll(animations);
    journey.remove();
}

/**
 * Plays the closing and leaves the wallpaper invisible. Resolves with a cleanup that the
 * caller runs once the wallpaper is `hidden`.
 */
export async function playPortalClose(wallEl) {
    const reduced = prefersReducedMotion();
    const animations = [];

    if (reduced) {
        await leaveFullscreen();
        animations.push(animate(wallEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-in' }));
        await settle(animations);
        return () => cancelAll(animations);
    }

    // The foreground bows out while full screen is left, so the journey plays at its final size.
    foreground().forEach((el) => {
        animations.push(animate(el, [
            { opacity: 1, filter: 'blur(0px)' },
            { opacity: 0, filter: 'blur(8px)' }
        ], { duration: 420, easing: 'ease-in' }));
    });
    await Promise.all([leaveFullscreen(), wait(420)]);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const card = measureCard(vw, vh);
    const frame = cameraFrames(card, vw, vh);
    const journey = buildJourney(wallEl, card, frame, vw);
    journey.cardSky.style.top = '0px';
    journey.cardSky.style.height = px(vh);

    // 1. Back along the hills to the cottage, the realm's sky softening into the card's. The
    // realm's weather and big clouds are gone before the camera starts pulling out.
    animations.push(...travelAnimations(journey, vw, 'back', { duration: BACK_TRAVEL_MS, easing: EASE_TRAVEL }));
    const skyTiming = { duration: BACK_TRAVEL_MS * 0.6, delay: BACK_TRAVEL_MS * 0.4, easing: 'ease-in-out' };
    animations.push(animate(journey.cardSky, [{ opacity: 0 }, { opacity: 1 }], skyTiming));
    const veilTiming = { duration: EXIT_START - BACK_TRAVEL_MS * 0.3, delay: BACK_TRAVEL_MS * 0.3, easing: 'ease-in-out' };
    SKY_VEILED.forEach((sel) => animations.push(animate(wallEl.querySelector(sel), [{ opacity: 1 }, { opacity: 0 }], veilTiming)));
    animations.push(...duskAnimations(wallEl, journey, 'back', skyTiming));

    // 2. The camera pulls out of the card, which settles back among the Home cards.
    const camera = runCamera(wallEl, journey.cardSky, frame, {
        direction: 'out', duration: EXIT_MS, delay: EXIT_START, fadeMs: card.live ? 360 : 600
    });

    await camera;
    await settle(animations);
    return () => {
        cancelAll(animations);
        journey.remove();
        releaseCamera(wallEl);
    };
}
