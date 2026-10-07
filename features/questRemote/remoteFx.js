// features/questRemote/remoteFx.js — the projector's Wand effects: the spark trail that flies to
// whatever the Wand touches, the star comet, bursts and the binding beam.
//
// Built for weak classroom laptops: ONE canvas, ONE requestAnimationFrame loop that runs only while
// something is alive, pre-rendered glow sprites drawn with drawImage (no per-frame gradients), a
// particle budget per device tier (utils/devicePerformance.mjs), DPR capped, nothing while the tab
// is hidden. prefers-reduced-motion: no canvas at all, only a soft fading ring on the target.

import { detectDevicePerformance } from '../../utils/devicePerformance.mjs';

const perf = (() => { try { return detectDevicePerformance(); } catch { return { tier: 'mid', reducedMotion: false }; } })();
const LITE = perf.tier === 'low';
const STILL = Boolean(perf.reducedMotion);
const MAX_PARTICLES = LITE ? 70 : 220;
const DPR = Math.min(window.devicePixelRatio || 1, LITE ? 1 : 1.5);

let canvas = null;
let ctx = null;
let rafId = 0;
let lastT = 0;
const particles = [];
const comets = [];
const rings = [];
const sprites = new Map();

export const isLiteFx = () => LITE;
export const isStillFx = () => STILL;

function ensureCanvas() {
    if (canvas?.isConnected) return true;
    canvas = document.createElement('canvas');
    canvas.className = 'qr-fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.dataset.qrIgnore = '';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize, { passive: true });
    return Boolean(ctx);
}

function resize() {
    if (!canvas) return;
    canvas.width = Math.round(window.innerWidth * DPR);
    canvas.height = Math.round(window.innerHeight * DPR);
}

/** A soft round glow, drawn once per colour and reused for every particle. */
function sprite(color) {
    if (sprites.has(color)) return sprites.get(color);
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.5, `${color}55`);
    grad.addColorStop(1, `${color}00`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    sprites.set(color, c);
    return c;
}

function spawn(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push(p);
}

function start() {
    if (rafId || document.hidden) return;
    lastT = performance.now();
    rafId = requestAnimationFrame(frame);
}

function frame(now) {
    rafId = 0;
    const dt = Math.min(48, now - lastT);
    lastT = now;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = comets.length - 1; i >= 0; i -= 1) {
        const c = comets[i];
        c.t = Math.min(1, c.t + dt / c.duration);
        const e = c.ease(c.t);
        const x = bez(c.x0, c.cx, c.x1, e);
        const y = bez(c.y0, c.cy, c.y1, e);
        // the tail: a few sparks shed per frame, fewer on lite laptops
        const shed = LITE ? 1 : 3;
        for (let k = 0; k < shed; k += 1) {
            spawn({ x, y, vx: (Math.random() - 0.5) * 0.06, vy: (Math.random() - 0.5) * 0.06 + 0.02,
                life: 1, decay: 0.0024 + Math.random() * 0.002, size: c.size * (0.35 + Math.random() * 0.45), color: c.color });
        }
        const head = sprite(c.color);
        const hs = c.size * 2.4;
        ctx.globalAlpha = 1;
        ctx.drawImage(head, x - hs / 2, y - hs / 2, hs, hs);
        if (c.t >= 1) {
            comets.splice(i, 1);
            burstAt(c.x1, c.y1, { color: c.color, count: c.burst });
            c.resolve();
        }
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= p.decay * dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.gravity || 0) * dt;
        const s = p.size * (0.5 + p.life * 0.5);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.drawImage(sprite(p.color), p.x - s / 2, p.y - s / 2, s, s);
    }

    for (let i = rings.length - 1; i >= 0; i -= 1) {
        const r = rings[i];
        r.t += dt / r.duration;
        if (r.t >= 1) { rings.splice(i, 1); continue; }
        if (r.t < 0) continue; // a delayed ring waits its turn
        ctx.globalAlpha = (1 - r.t) * 0.9;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width * (1 - r.t) + 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * easeOut(r.t), 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (comets.length || particles.length || rings.length) {
        rafId = requestAnimationFrame(frame);
    } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function bez(a, c, b, t) { const u = 1 - t; return u * u * a + 2 * u * t * c + t * t * b; }
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    // Hidden: finish everything at once (promises resolve, nothing draws in the background).
    comets.splice(0).forEach((c) => c.resolve());
    particles.length = 0;
    rings.length = 0;
});

/** Centre of an element (or a point), in viewport pixels. */
export function centreOf(target) {
    if (!target) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    if (typeof target.x === 'number' && typeof target.y === 'number' && !target.getBoundingClientRect) return target;
    const r = target.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** A soft ring that fades on the target: the reduced-motion (and extra) "the Wand touched this". */
export function touchRing(target, { color = '#fcd34d' } = {}) {
    if (!target?.getBoundingClientRect) return;
    const r = target.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const ring = document.createElement('div');
    ring.className = 'qr-touch-ring';
    ring.dataset.qrIgnore = '';
    ring.style.cssText = `left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px;--qr-ring:${color}`;
    document.body.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });
    setTimeout(() => ring.remove(), 1400);
}

/**
 * The Wand's spark: flies from the bottom edge (where the teacher "points" from) to the target,
 * bursts, and resolves on arrival so the action happens exactly as the spark lands.
 */
export function sparkTo(target, { color = '#fcd34d', size = 22, duration = 620, burst = 14, from = null } = {}) {
    const to = centreOf(target);
    if (STILL || document.hidden || !ensureCanvas()) {
        if (target?.getBoundingClientRect) touchRing(target, { color });
        return Promise.resolve();
    }
    const origin = from || { x: window.innerWidth / 2 + (Math.random() - 0.5) * window.innerWidth * 0.3, y: window.innerHeight + 30 };
    const bend = (Math.random() < 0.5 ? -1 : 1) * Math.min(260, Math.abs(to.x - origin.x) * 0.6 + 80);
    return new Promise((resolve) => {
        comets.push({
            x0: origin.x, y0: origin.y, x1: to.x, y1: to.y,
            cx: (origin.x + to.x) / 2 + bend, cy: Math.min(origin.y, to.y) - 40,
            t: 0, duration: LITE ? duration * 0.85 : duration, size, color,
            burst: LITE ? Math.ceil(burst / 2) : burst, ease: easeInOut, resolve
        });
        start();
    });
}

/** A star comet: bigger, golden, with a long tail (Star Flick). */
export function starComet(target, stars = 1) {
    const size = 26 + stars * 8;
    return sparkTo(target, { color: stars >= 3 ? '#fde047' : '#fbbf24', size, duration: 760 + stars * 60, burst: 12 + stars * 8 });
}

export function burstAt(x, y, { color = '#fcd34d', count = 16, speed = 0.32, gravity = 0.0004 } = {}) {
    if (STILL || document.hidden || !ensureCanvas()) return;
    const n = LITE ? Math.ceil(count / 2) : count;
    for (let i = 0; i < n; i += 1) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const v = speed * (0.5 + Math.random() * 0.8);
        spawn({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity, life: 1, decay: 0.0011 + Math.random() * 0.0009,
            size: 10 + Math.random() * 14, color });
    }
    rings.push({ x, y, r0: 6, r1: LITE ? 46 : 70, t: 0, duration: 520, width: 5, color });
    start();
}

export function burstOn(target, opts) {
    const c = centreOf(target);
    burstAt(c.x, c.y, opts);
}

/** The binding: a beam rises from the bottom edge to the rune circle, then rings bloom. */
export async function bindBeam(target) {
    const c = centreOf(target);
    await sparkTo(target, { color: '#a5b4fc', size: 34, duration: 820, burst: 26, from: { x: c.x, y: window.innerHeight + 40 } });
    if (STILL || document.hidden) return;
    rings.push({ x: c.x, y: c.y, r0: 20, r1: LITE ? 160 : 260, t: 0, duration: 900, width: 8, color: '#fcd34d' });
    rings.push({ x: c.x, y: c.y, r0: 10, r1: LITE ? 110 : 180, t: -0.25, duration: 900, width: 5, color: '#c4b5fd' });
    start();
}

/** Confetti rain from the top (Showdown finale). */
export function confettiRain({ colors = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7'], count = 90 } = {}) {
    if (STILL || document.hidden || !ensureCanvas()) return;
    const n = LITE ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i += 1) {
        spawn({ x: Math.random() * window.innerWidth, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 0.08,
            vy: 0.12 + Math.random() * 0.18, gravity: 0.00012, life: 1.6, decay: 0.00045 + Math.random() * 0.0003,
            size: 12 + Math.random() * 12, color: colors[i % colors.length] });
    }
    start();
}
