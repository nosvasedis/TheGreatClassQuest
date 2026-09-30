// ui/ceremonyFx.js — one canvas for every ceremony celebration (fireworks,
// confetti, petals, embers, lanterns). Built for weak classroom laptops:
// a single <canvas>, pooled particles, pre-rendered glow sprites (no
// shadowBlur, no CSS filters), a DPR cap, and a frame-time governor that
// thins the particle budget when frames run long. The loop sleeps whenever
// nothing is alive.

const TAU = Math.PI * 2;

function prefersReducedMotion() {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
        return false;
    }
}

/** 'lite' on low-core / low-memory machines, 'full' otherwise. */
export function detectCeremonyFxTier() {
    const cores = Number(navigator.hardwareConcurrency) || 4;
    const memory = Number(navigator.deviceMemory) || 4;
    if (cores <= 4 || memory <= 4) return 'lite';
    return 'full';
}

const TIER_LIMITS = {
    lite: { maxParticles: 260, dpr: 1, scale: 0.55 },
    full: { maxParticles: 700, dpr: 1.5, scale: 1 }
};

const spriteCache = new Map();

function glowSprite(color, size = 32) {
    const key = `g|${color}|${size}`;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.45, hexToRgba(color, 0.35));
    grad.addColorStop(1, hexToRgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    spriteCache.set(key, c);
    return c;
}

function petalSprite(color, size = 28) {
    const key = `p|${color}|${size}`;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    const grad = g.createLinearGradient(0, -size / 2, 0, size / 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, -size * 0.46);
    g.bezierCurveTo(size * 0.42, -size * 0.3, size * 0.3, size * 0.32, 0, size * 0.46);
    g.bezierCurveTo(-size * 0.3, size * 0.32, -size * 0.42, -size * 0.3, 0, -size * 0.46);
    g.fill();
    spriteCache.set(key, c);
    return c;
}

function starSprite(color, size = 30) {
    const key = `s|${color}|${size}`;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    g.fillStyle = color;
    g.beginPath();
    for (let i = 0; i < 10; i += 1) {
        const r = i % 2 === 0 ? size * 0.48 : size * 0.2;
        const a = (i / 10) * TAU - Math.PI / 2;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.arc(0, 0, size * 0.1, 0, TAU);
    g.fill();
    spriteCache.set(key, c);
    return c;
}

function hexToRgba(hex, alpha) {
    const value = String(hex || '#ffffff').replace('#', '');
    const full = value.length === 3 ? value.split('').map((ch) => ch + ch).join('') : value.padEnd(6, 'f');
    const n = parseInt(full.slice(0, 6), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

/**
 * Attach the effects canvas to `host` (it fills the host, under the UI).
 * Returns an API: fireworks, burst, confetti, petals, embers, lanterns, clear, destroy.
 */
export function createCeremonyFx(host, { tier = detectCeremonyFxTier(), className = 'cer-fx' } = {}) {
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.lite;
    const reduced = prefersReducedMotion();
    const canvas = document.createElement('canvas');
    canvas.className = className;
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let budget = limits.maxParticles;
    let slowFrames = 0;
    const particles = [];
    const emitters = new Set();
    const timers = new Set();

    function resize() {
        const rect = host.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, limits.dpr);
        width = Math.max(1, rect.width);
        height = Math.max(1, rect.height);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
    }
    resize();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    function later(fn, ms) {
        const id = setTimeout(() => {
            timers.delete(id);
            fn();
        }, ms);
        timers.add(id);
    }

    function wake() {
        if (!raf) {
            last = performance.now();
            raf = requestAnimationFrame(frame);
        }
    }

    function add(p) {
        if (particles.length >= budget) return;
        particles.push(p);
    }

    function frame(now) {
        const dtMs = Math.min(64, now - last || 16);
        last = now;
        const dt = dtMs / 1000;

        // Governor: long frames shrink the budget, steady ones let it recover.
        if (dtMs > 26) {
            slowFrames += 1;
            if (slowFrames > 12) {
                budget = Math.max(80, Math.floor(budget * 0.7));
                slowFrames = 0;
            }
        } else if (slowFrames > 0) {
            slowFrames -= 1;
        } else if (budget < limits.maxParticles) {
            budget = Math.min(limits.maxParticles, budget + 2);
        }

        emitters.forEach((emit) => emit(dt));

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        for (let i = particles.length - 1; i >= 0; i -= 1) {
            const p = particles[i];
            p.life -= dt;
            if (p.life <= 0 || p.y > height + 60 || p.y < -200) {
                particles.splice(i, 1);
                continue;
            }
            p.vx *= p.drag;
            p.vy = p.vy * p.drag + p.gravity * dt;
            if (p.sway) p.vx += Math.sin((p.age + p.phase) * p.swayFreq) * p.sway * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.age += dt;
            p.rot += p.spin * dt;
            if (p.rocket && p.vy >= -20) {
                particles.splice(i, 1);
                p.rocket(p);
                continue;
            }
            const t = p.life / p.maxLife;
            const alpha = p.fadeIn ? Math.min(1, p.age / p.fadeIn) * Math.min(1, t * 2.2) : Math.min(1, t * 1.8);
            ctx.globalAlpha = alpha;
            if (p.kind === 'confetti') {
                ctx.globalCompositeOperation = 'source-over';
                const flip = Math.cos(p.age * p.flipFreq);
                ctx.setTransform(dpr * Math.cos(p.rot), dpr * Math.sin(p.rot), -dpr * Math.sin(p.rot) * flip, dpr * Math.cos(p.rot) * flip, p.x * dpr, p.y * dpr);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            } else if (p.sprite) {
                ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
                const s = p.size * (p.grow ? 1 + (1 - t) * p.grow : 1);
                if (p.rot) {
                    ctx.setTransform(dpr * Math.cos(p.rot), dpr * Math.sin(p.rot), -dpr * Math.sin(p.rot), dpr * Math.cos(p.rot), p.x * dpr, p.y * dpr);
                    ctx.drawImage(p.sprite, -s / 2, -s / 2, s, s);
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                } else {
                    ctx.drawImage(p.sprite, p.x - s / 2, p.y - s / 2, s, s);
                }
            }
            if (p.trail && p.age > 0.02) {
                p.trailTimer -= dt;
                if (p.trailTimer <= 0) {
                    p.trailTimer = 0.03;
                    add(spark(p.x, p.y, 0, 0, p.color, { life: 0.35, size: p.size * 0.6, gravity: 30 }));
                }
            }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        if (particles.length || emitters.size) {
            raf = requestAnimationFrame(frame);
        } else {
            raf = 0;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    function base(x, y, vx, vy, extra) {
        return {
            x, y, vx, vy,
            age: 0, rot: 0, spin: 0, phase: Math.random() * 10,
            drag: 0.985, gravity: 0, sway: 0, swayFreq: 2,
            ...extra,
            maxLife: extra.life
        };
    }

    function spark(x, y, vx, vy, color, extra = {}) {
        return base(x, y, vx, vy, {
            kind: 'spark', sprite: glowSprite(color), color, additive: true,
            size: 10, life: 1.1, gravity: 90, drag: 0.972, ...extra
        });
    }

    /** Radial burst of glowing sparks at (x, y) in CSS px. */
    function burst(x, y, { colors = ['#fde68a', '#fbbf24', '#ffffff'], count = 70, speed = 260, size = 11, life = 1.3, gravity = 110, ring = false } = {}) {
        if (reduced) count = Math.min(count, 14);
        const n = Math.round(count * limits.scale);
        for (let i = 0; i < n; i += 1) {
            const a = ring ? (i / n) * TAU : Math.random() * TAU;
            const v = ring ? speed : speed * (0.35 + Math.random() * 0.75);
            add(spark(x, y, Math.cos(a) * v, Math.sin(a) * v, pick(colors), {
                size: size * (0.7 + Math.random() * 0.6),
                life: life * (0.7 + Math.random() * 0.5),
                gravity
            }));
        }
        wake();
    }

    /** Rockets that rise and explode. `count` shells over `spread` ms. */
    function fireworks({ count = 5, colors = ['#fde68a', '#f472b6', '#60a5fa', '#a78bfa', '#34d399'], spread = 1600, area = [0.15, 0.85], height: top = [0.12, 0.42] } = {}) {
        if (reduced) count = Math.min(count, 2);
        for (let i = 0; i < count; i += 1) {
            later(() => {
                const x = width * (area[0] + Math.random() * (area[1] - area[0]));
                const targetY = height * (top[0] + Math.random() * (top[1] - top[0]));
                const color = pick(colors);
                const vy = -Math.sqrt(2 * 520 * Math.max(40, height - targetY)) * 0.92;
                add(spark(x, height + 10, (Math.random() - 0.5) * 40, vy, color, {
                    size: 9, life: 5, gravity: 520, drag: 1, trail: true, trailTimer: 0,
                    rocket: (r) => burst(r.x, r.y, { colors: [color, pick(colors), '#ffffff'], count: 80, speed: 240 + Math.random() * 90, ring: Math.random() < 0.35 })
                }));
                wake();
            }, (spread / Math.max(1, count)) * i + Math.random() * 120);
        }
    }

    /** Paper confetti falling from the top. */
    function confetti({ count = 140, colors = ['#fcd34d', '#f87171', '#60a5fa', '#a78bfa', '#34d399', '#f9a8d4'], duration = 1200, origin = null } = {}) {
        if (reduced) count = Math.min(count, 24);
        const n = Math.round(count * limits.scale);
        for (let i = 0; i < n; i += 1) {
            later(() => {
                const fromCannon = origin && Math.random() < 0.7;
                const x = fromCannon ? origin.x : Math.random() * width;
                const y = fromCannon ? origin.y : -20 - Math.random() * 60;
                const a = fromCannon ? -Math.PI / 2 + (Math.random() - 0.5) * 1.4 : 0;
                const v = fromCannon ? 420 + Math.random() * 380 : 0;
                add(base(x, y, Math.cos(a) * v * 0.6, fromCannon ? Math.sin(a) * v : 40 + Math.random() * 80, {
                    kind: 'confetti', color: pick(colors), size: 9 + Math.random() * 6,
                    life: 5 + Math.random() * 2, gravity: 120, drag: 0.985,
                    spin: (Math.random() - 0.5) * 8, flipFreq: 4 + Math.random() * 6,
                    sway: 60, swayFreq: 1.5 + Math.random() * 2
                }));
                wake();
            }, Math.random() * duration);
        }
    }

    function drifting(kind, { count, colors, duration, sizeRange, rise = false }) {
        const n = Math.round(count * limits.scale);
        for (let i = 0; i < n; i += 1) {
            later(() => {
                const color = pick(colors);
                const size = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
                const sprite = kind === 'petal' ? petalSprite(color) : kind === 'star' ? starSprite(color) : glowSprite(color);
                add(base(Math.random() * width, rise ? height + 20 : -30, (Math.random() - 0.5) * 30, rise ? -(40 + Math.random() * 60) : 40 + Math.random() * 50, {
                    kind, sprite, color, size, additive: kind !== 'petal',
                    life: 7 + Math.random() * 4, fadeIn: 0.6, gravity: rise ? -4 : 8, drag: 1,
                    spin: kind === 'petal' ? (Math.random() - 0.5) * 3 : 0, rot: kind === 'petal' ? Math.random() * TAU : 0,
                    sway: 40, swayFreq: 1 + Math.random() * 1.5
                }));
                wake();
            }, Math.random() * duration);
        }
    }

    function petals({ count = 40, colors = ['#fbcfe8', '#f9a8d4', '#fde68a', '#fecaca', '#ddd6fe'], duration = 3000 } = {}) {
        drifting('petal', { count: reduced ? 8 : count, colors, duration, sizeRange: [14, 24] });
    }

    function stars({ count = 30, colors = ['#fde68a', '#fef3c7'], duration = 2000 } = {}) {
        drifting('star', { count: reduced ? 6 : count, colors, duration, sizeRange: [12, 22] });
    }

    function embers({ count = 30, colors = ['#fb923c', '#fbbf24', '#f97316'], duration = 3000 } = {}) {
        drifting('ember', { count: reduced ? 6 : count, colors, duration, sizeRange: [8, 16], rise: true });
    }

    /** Continuous gentle stream until the returned stop() is called. */
    function stream(kind, { rate = 6, colors } = {}) {
        if (reduced) return () => {};
        let acc = 0;
        const perSecond = rate * limits.scale;
        const emit = (dt) => {
            acc += dt * perSecond;
            while (acc >= 1) {
                acc -= 1;
                if (kind === 'petal') petals({ count: 1 / limits.scale, colors, duration: 0 });
                else if (kind === 'ember') embers({ count: 1 / limits.scale, colors, duration: 0 });
                else stars({ count: 1 / limits.scale, colors, duration: 0 });
            }
        };
        emitters.add(emit);
        wake();
        return () => emitters.delete(emit);
    }

    function clear() {
        timers.forEach((id) => clearTimeout(id));
        timers.clear();
        emitters.clear();
        particles.length = 0;
    }

    function destroy() {
        clear();
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        window.removeEventListener('resize', onResize);
        canvas.remove();
    }

    /** Convert an element's centre to canvas coordinates. */
    function pointOf(el) {
        const hostRect = host.getBoundingClientRect();
        const r = el?.getBoundingClientRect?.();
        if (!r) return { x: width / 2, y: height / 2 };
        return { x: r.left - hostRect.left + r.width / 2, y: r.top - hostRect.top + r.height / 2 };
    }

    return { tier, burst, fireworks, confetti, petals, stars, embers, stream, clear, destroy, resize, pointOf, get size() { return { width, height }; }, get count() { return particles.length; } };
}
