// Hero Campfire fire renderer: Canvas 2D, additive sprites drawn once, pooled particles, no per-frame
// gradients/shadows/filters. Quality tiers + a frame governor keep weak classroom laptops smooth.
import { detectDevicePerformance } from '../../utils/devicePerformance.mjs';
import { FIRE_W, FIRE_H, FIRE_CX, FIRE_BASE, createFirePool, stepParticle, governFire, fireFlicker, createSpark, stepSpark, seededRandom } from './fireParticlesCore.mjs';

function makeSprite(stops, w = 128, h = 128) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) / 2);
    stops.forEach(([p, color]) => g.addColorStop(p, color));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    return c;
}

/**
 * A soft teardrop flame tongue (round base, pointed tip), drawn once. Concentric passes give it a
 * soft edge without any canvas filter, so it renders the same on every browser.
 */
function makeTongue(stops, w = 96, h = 224) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, h, 0, 0);
    stops.forEach(([p, color]) => g.addColorStop(p, color));
    const passes = 6;
    for (let k = 0; k < passes; k++) {
        const s = 1 - k * 0.11, cx = w / 2, base = h * 0.93, r = w * 0.42 * s, top = h * (0.04 + k * 0.05);
        x.globalAlpha = k === 0 ? 0.28 : 0.2;
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(cx, top);
        x.bezierCurveTo(cx + r * 0.25, h * 0.38, cx + r * 1.15, base - r * 1.3, cx + r, base - r * 0.55);
        x.arc(cx, base - r * 0.55, r, 0, Math.PI, false);
        x.bezierCurveTo(cx - r * 1.15, base - r * 1.3, cx - r * 0.25, h * 0.38, cx, top);
        x.fill();
    }
    return c;
}

export function createCampfireFire(canvas, options = {}) {
    const perf = { ...detectDevicePerformance(), ...options };
    const dpr = Math.min(globalThis.devicePixelRatio || 1, perf.dpr || 1);
    canvas.width = Math.round(FIRE_W * dpr); canvas.height = Math.round(FIRE_H * dpr);
    const ctx = canvas.getContext('2d', { alpha: true });
    const noop = { setIntensity() {}, burst() {}, riseEmber() {}, flare() {}, feed() {}, ignite() {}, dim() {}, setIdle() {}, dispose() {}, get intensity() { return 1; } };
    if (!ctx) return noop;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sprites = {
        core: makeSprite([[0, '#fffdf0'], [0.25, '#fff3b8'], [0.55, '#ffd36a88'], [1, '#ffb13b00']]),
        flame: makeSprite([[0, '#ffe7a0'], [0.3, '#ffb347cc'], [0.62, '#ff7a1f55'], [1, '#ff4d0000']]),
        tip: makeSprite([[0, '#ff9a4a'], [0.35, '#ff5a1f99'], [0.7, '#c2261033'], [1, '#8a100000']]),
        ember: makeSprite([[0, '#ffffff'], [0.25, '#fff2b0'], [0.55, '#ffb54a88'], [1, '#ff8c0000']], 32, 32),
        glow: makeSprite([[0, '#ffb65e55'], [0.35, '#ff8c3a26'], [0.7, '#ff6a2a0c'], [1, '#ff5a1f00']], 256, 256),
        smoke: makeSprite([[0, '#9f96b418'], [0.55, '#6f6a8a0a'], [1, '#5a557000']]),
        tongueOuter: makeTongue([[0, '#ff9a3c'], [0.35, '#ff6a1f'], [0.75, '#d8361299'], [1, '#a0180000']]),
        tongueInner: makeTongue([[0, '#ffefb0'], [0.3, '#ffcf62'], [0.7, '#ffa040bb'], [1, '#ff7a2a00']], 72, 180)
    };
    // Each tongue: horizontal offset, height, width, sway speed and phase. A few licking flames give the
    // fire a real shape; the particles fill it with life.
    const tongueCount = { low: 4, mid: 6, high: 7 }[perf.tier] || 5;
    const tongues = Array.from({ length: tongueCount }, (_, i) => {
        const side = i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2);
        return { off: side * 17, h: 250 - Math.abs(side) * 42, w: 94 - Math.abs(side) * 12, speed: 2.2 + i * 0.37, phase: i * 1.9 };
    });
    const reduced = options.reducedMotion ?? Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const sparkCount = { low: 10, mid: 18, high: 28 }[perf.tier] || 14;
    const pool = createFirePool(perf.particles);
    const sparks = Array.from({ length: sparkCount }, (_, i) => createSpark(Math.random, i * 0.2));
    const bursts = [];
    let control = { limit: perf.particles }, intensity = options.startIntensity ?? 1, goal = intensity;
    let frame = 0, last = 0, drawAt = 0, lightAt = 0, disposed = false, time = 0, boost = 0, idle = false;
    const lightEvery = perf.tier === 'low' ? 140 : 100;
    const lightTarget = options.lightTarget || null;

    function drawFrame(dt, random = Math.random, clear = true, gain = 1) {
        const flicker = fireFlicker(time);
        // A flare (a star landing, the moment of ignition) briefly lifts the fire above its goal.
        boost = Math.max(0, boost - dt * 1.3);
        const I = Math.min(1.5, intensity + boost);
        if (clear) ctx.clearRect(0, 0, FIRE_W, FIRE_H);
        ctx.globalCompositeOperation = 'lighter';
        // Warm halo behind the flame.
        ctx.globalAlpha = Math.min(1, (0.1 + 0.5 * I) * flicker * gain);
        ctx.drawImage(sprites.glow, FIRE_CX - 230, FIRE_BASE - 300, 460, 380);
        // Flame tongues: particles stretched vertically.
        // A low fire has fewer, fainter tongues (embers asleep); a roaring one uses the whole pool.
        // Unlit (I≈0) shows only glowing coals; tongues appear as the fire gathers strength.
        const active = Math.round(control.limit * Math.max(0, Math.min(1, (I - 0.06) / 0.9)));
        const fade = Math.min(1, 0.45 + 0.55 * I);
        for (let i = 0; i < active; i++) {
            const p = stepParticle(pool[i], dt, Math.max(0.25, I), random, time);
            ctx.globalAlpha = p.alpha * fade * gain * (0.85 + (p.depth + 1) * 0.08);
            const w = p.size, h = p.kind === 'ember' ? p.size : p.size * 1.75;
            ctx.drawImage(sprites[p.kind], p.x - w / 2, p.y - h * 0.62, w, h);
        }
        // Licking tongues: one sprite each, leaned with a skew (no per-frame paths or gradients).
        const tongueGain = Math.max(0, Math.min(1.25, (I - 0.08) / 0.85));
        if (tongueGain > 0.01) {
            for (const layer of ['tongueOuter', 'tongueInner']) {
                const inner = layer === 'tongueInner';
                for (const t of tongues) {
                    const wave = Math.sin(time * t.speed + t.phase), wave2 = Math.sin(time * t.speed * 1.73 + t.phase * 0.7);
                    const h = t.h * (inner ? 0.62 : 1) * tongueGain * (0.84 + 0.12 * wave + 0.06 * wave2) * (0.8 + 0.2 * flicker);
                    const w = t.w * (inner ? 0.62 : 1) * (0.9 + 0.1 * Math.min(1.2, I)) * (0.94 + 0.06 * wave2);
                    const lean = 0.2 * wave + 0.08 * wave2 - t.off * 0.004;
                    ctx.globalAlpha = Math.min(1, (inner ? 0.5 : 0.62) * gain * (0.7 + 0.3 * flicker));
                    ctx.setTransform(dpr, 0, lean * dpr, dpr, (FIRE_CX + t.off * (inner ? 0.6 : 1) + wave * 3) * dpr, (FIRE_BASE + 8) * dpr);
                    ctx.drawImage(sprites[layer], -w / 2, -h, w, h);
                }
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        // A bright bed of coals at the base.
        const coal = 0.4 + 0.1 * Math.sin(time * 1.7) + 0.25 * Math.min(1.2, I);
        ctx.globalAlpha = Math.min(1, coal * flicker * gain);
        ctx.drawImage(sprites.core, FIRE_CX - 78, FIRE_BASE - 30, 156, 56);
        ctx.globalAlpha = Math.min(1, (0.32 + 0.12 * Math.sin(time * 1.1 + 1)) * gain);
        ctx.drawImage(sprites.tip, FIRE_CX - 95, FIRE_BASE - 22, 190, 44);
        // Sparks.
        const activeSparks = Math.round(sparks.length * Math.min(1, I));
        for (let i = 0; i < activeSparks; i++) {
            const s = stepSpark(sparks[i], dt, random);
            ctx.globalAlpha = s.alpha;
            ctx.drawImage(sprites.ember, s.x - s.size * 2, s.y - s.size * 2, s.size * 4, s.size * 4);
        }
        for (let i = bursts.length - 1; i >= 0; i--) {
            const b = bursts[i];
            b.age += dt; b.vy -= 40 * dt; b.x += b.vx * dt; b.y -= b.vy * dt;
            if (b.age > b.life) { bursts.splice(i, 1); continue; }
            ctx.globalAlpha = 1 - b.age / b.life;
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
            ctx.drawImage(sprites.ember, b.x - b.size * 2, b.y - b.size * 2, b.size * 4, b.size * 4);
        }
        // Soft smoke (skipped on low tier).
        if (perf.tier !== 'low') {
            ctx.globalCompositeOperation = 'source-over';
            for (let i = 0; i < 3; i++) {
                ctx.globalAlpha = 0.5 * Math.min(1, I);
                const drift = (time * 14 + i * 60) % 180;
                ctx.drawImage(sprites.smoke, FIRE_CX - 90 + Math.sin(time / 3 + i) * 30, FIRE_BASE - 330 - drift, 180, 200);
            }
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        return flicker;
    }

    function paintStill() {
        // Reduced motion: simulate quietly, then show one natural-looking frame.
        const random = seededRandom(7);
        for (let i = 0; i < 90; i++) { time += 1 / 30; for (let j = 0; j < control.limit; j++) stepParticle(pool[j], 1 / 30, intensity, random, time); }
        bursts.length = 0;
        // Three overlaid moments read as one soft, continuous flame in a still image.
        ctx.clearRect(0, 0, FIRE_W, FIRE_H);
        for (let k = 0; k < 3; k++) { time += 1 / 20; drawFrame(1 / 20, random, false, 0.6); }
        lightTarget?.style.setProperty('--fire-light', String(Math.max(0.12, Math.min(1.2, intensity * 0.95)).toFixed(3)));
    }

    function tick(now) {
        if (disposed) return;
        frame = requestAnimationFrame(tick);
        if (document.hidden) { last = 0; return; }
        const frameMs = last ? now - last : 16.7;
        last = now;
        control = governFire(control, frameMs, Math.min(0.05, frameMs / 1000), perf.particles);
        if (now - drawAt < 1000 / (idle ? Math.min(20, perf.fps) : perf.fps) - 1) return;
        const dt = Math.min(0.05, (now - (drawAt || now - 16.7)) / 1000); drawAt = now;
        time += dt;
        intensity += (goal - intensity) * Math.min(1, dt * 2.2);
        const flicker = drawFrame(dt);
        const lit = Math.min(1.35, intensity + boost);
        // Light the scene (ground, trees, faces) ~10× per second, never every frame.
        if (lightTarget && now - lightAt > lightEvery) {
            lightAt = now;
            lightTarget.style.setProperty('--fire-light', Math.max(0.12, lit * flicker).toFixed(3));
        }
    }
    if (reduced) paintStill(); else frame = requestAnimationFrame(tick);

    function burst(color = '#ffdc88', count = 16, { spread = 150, lift = 1 } = {}) {
        if (reduced) return;
        for (let i = 0; i < Math.min(count, 30); i++) {
            if (bursts.length >= 90) break;
            bursts.push({ x: FIRE_CX + (Math.random() - 0.5) * 50, y: FIRE_BASE - 60, vx: (Math.random() - 0.5) * spread,
                vy: (140 + Math.random() * 170) * lift, size: 1.5 + Math.random() * 2.2, age: 0, life: 0.9 + Math.random() * 0.9, color });
        }
    }
    return {
        get intensity() { return intensity; },
        setIntensity(value) {
            goal = Math.max(0, Math.min(1.4, value));
            if (reduced) { intensity = goal; paintStill(); }
        },
        burst,
        riseEmber(color) { burst(color || '#fff3b0', 12); },
        /** A star lands in the coals: a golden flare. */
        flare(color = '#ffe6a8', strength = 0.3) { boost = Math.min(0.9, boost + strength); burst(color, 5); },
        /** A word (or anything precious) is fed to the fire: it roars, throws a column of sparks and stays a little stronger. */
        feed(color = '#ffd27a') { boost = Math.min(1.1, boost + 0.75); goal = Math.min(1.3, Math.max(goal, 1) + 0.05); burst(color, 18, { spread: 60, lift: 1.7 }); burst('#fff3c4', 12, { spread: 200 }); if (reduced) { intensity = goal; paintStill(); } },
        ignite() { goal = 1; boost = 0.7; burst('#fff0c2', 30); if (reduced) { intensity = 1; paintStill(); } },
        dim() { this.setIntensity(0.3); },
        /** The class is looking at the sky (or a big moment covers the hearth): draw fewer frames. */
        setIdle(value) { idle = Boolean(value); },
        dispose() { disposed = true; cancelAnimationFrame(frame); bursts.length = 0; ctx.clearRect(0, 0, FIRE_W, FIRE_H); }
    };
}
