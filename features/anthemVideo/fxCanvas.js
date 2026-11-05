// features/anthemVideo/fxCanvas.js — soft, glowing particles for the anthem music videos, drawn on one canvas.
// Scenes describe emitters (embers, snow, rain, fireflies, stars…) and one-shot bursts tied to their cues;
// this engine spawns and draws them with pre-rendered glow sprites and additive light, so a few hundred
// particles cost one canvas instead of hundreds of animated SVG nodes. Weak machines get fewer particles,
// a 1× canvas and 30 frames a second.

const WORLD_W = 1600;
const WORLD_H = 900;

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(list) { return Array.isArray(list) ? list[(Math.random() * list.length) | 0] : list; }

/** '#rgb' / '#rrggbb' → '#rrggbb' so alpha suffixes like '66' stay valid; anything else falls back to white. */
function hex6(color) {
    const c = String(color || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
    return '#ffffff';
}

/** A soft round glow sprite in one colour (white-hot core fading to transparent). */
function makeSprite(color, size = 64, core = 0.18) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const r = size / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(core, color);
    grad.addColorStop(0.45, color + '66');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
}

/** A soft flake / ash sprite: solid centre, no white core. */
function makeFlake(color, size = 32) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const r = size / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, color);
    grad.addColorStop(0.55, color + 'cc');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ emitters?: object[], bursts?: object[] }} spec — from the scene
 * @param {{ lite?: boolean, still?: boolean }} opts
 */
export function createFx(canvas, spec = {}, { lite = false, still = false } = {}) {
    const ctx = canvas.getContext('2d');
    const emitters = (spec.emitters || []).map(e => ({ ...e, acc: 0, active: false, gain: 1 }));
    const bursts = spec.bursts || [];
    const parts = [];
    const sprites = new Map();
    const MAX = lite ? 170 : 420;
    const density = lite ? 0.45 : 1;
    let w = 0, h = 0, scale = 1, ox = 0, oy = 0, dpr = 1;
    let reached = new Set();
    let section = 'intro';
    let skip = false;
    let starField = null;
    let clock = 0;

    function sprite(color, kind) {
        const key = `${kind}:${color}`;
        if (!sprites.has(key)) {
            const c = hex6(color);
            sprites.set(key, kind === 'flake' ? makeFlake(c) : makeSprite(c));
        }
        return sprites.get(key);
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        dpr = lite ? 1 : Math.min(1.5, window.devicePixelRatio || 1);
        w = Math.max(1, rect.width);
        h = Math.max(1, rect.height);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        // the scenes' SVGs use xMidYMid slice on a 1600×900 world: match it so bursts land on their objects
        scale = Math.max(w / WORLD_W, h / WORLD_H);
        ox = (w - WORLD_W * scale) / 2;
        oy = (h - WORLD_H * scale) / 2;
        starField = null;
    }

    function isOn(e) {
        if (e.section && e.section !== section) return false;
        if (e.on && !reached.has(e.on)) return false;
        if (e.off && reached.has(e.off)) return false;
        if (e.offSection && e.offSection === section) return false;
        return true;
    }

    function gainOf(e) {
        let g = 1;
        if (e.boost) for (const [cue, m] of Object.entries(e.boost)) if (reached.has(cue)) g = m;
        if (e.chorus && section === 'chorus') g *= e.chorus;
        return g;
    }

    function spawn(e, x, y, extra = {}) {
        if (parts.length >= MAX) return;
        const life = rand(...(e.life || [3, 6]));
        const size = rand(...(e.size || [2, 5]));
        const speed = rand(...(e.speed || [40, 90]));
        const angle = extra.angle ?? ((e.angle ?? -Math.PI / 2) + rand(-(e.spread || 0), e.spread || 0));
        parts.push({
            type: e.type, x, y, vx: Math.cos(angle) * speed + (e.wind || 0), vy: Math.sin(angle) * speed,
            life, age: 0, size, color: pick(e.colors || '#ffffff'), sway: rand(0, Math.PI * 2), swayAmp: e.sway || 0,
            drag: e.drag ?? 0, gravity: e.gravity || 0, blink: e.blink || 0, kind: e.kind || 'glow', len: e.len || 0,
        });
    }

    function emitFrom(e, dt) {
        const rate = e.rate * density * gainOf(e);
        e.acc += rate * dt;
        const [x0, x1] = e.x || [0, WORLD_W];
        const [y0, y1] = e.y || [WORLD_H, WORLD_H];
        while (e.acc >= 1) {
            e.acc -= 1;
            spawn(e, rand(x0, x1), rand(y0, y1));
        }
    }

    /** One-shot bursts when a cue is reached during normal playback. */
    function burst(cueName) {
        if (still) return;
        for (const b of bursts) {
            if (b.cue !== cueName) continue;
            const n = Math.round(b.count * (lite ? 0.5 : 1));
            for (let i = 0; i < n; i++) {
                const a = b.angle != null ? b.angle + rand(-(b.spread ?? Math.PI), b.spread ?? Math.PI) : rand(0, Math.PI * 2);
                spawn({ ...b, type: b.type || 'spark' }, b.at[0] + rand(-(b.jitter || 0), b.jitter || 0), b.at[1] + rand(-(b.jitter || 0), b.jitter || 0), { angle: a });
            }
        }
    }

    function drawStars(t) {
        const s = spec.stars;
        if (!s) return;
        if (!starField) {
            const n = Math.round(s.count * (lite ? 0.6 : 1));
            starField = Array.from({ length: n }, () => ({ x: rand(0, WORLD_W), y: rand(0, s.bottom || 500), r: rand(...(s.size || [0.8, 2.2])), p: rand(0, Math.PI * 2), f: rand(0.6, 1.6) }));
        }
        let alpha = s.base ?? 1;
        if (s.fade) for (const [cue, a] of Object.entries(s.fade)) if (reached.has(cue)) alpha = a;
        s.alpha = s.alpha == null ? alpha : s.alpha + (alpha - s.alpha) * 0.03;
        if (s.alpha < 0.02) return;
        const img = sprite(s.color || '#ffffff', 'glow');
        for (const st of starField) {
            const tw = 0.55 + 0.45 * Math.sin(t * st.f + st.p);
            ctx.globalAlpha = s.alpha * tw;
            const d = st.r * 5 * scale;
            ctx.drawImage(img, ox + st.x * scale - d / 2, oy + st.y * scale - d / 2, d, d);
        }
    }

    function step(dt) {
        clock += dt;
        for (const e of emitters) if (isOn(e)) emitFrom(e, dt);
        for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i];
            p.age += dt;
            if (p.age >= p.life) { parts.splice(i, 1); continue; }
            p.sway += dt * 2.2;
            if (p.type === 'wander') {
                p.vx += rand(-40, 40) * dt;
                p.vy += rand(-40, 40) * dt;
                p.vx *= 0.98; p.vy *= 0.98;
            }
            p.vy += p.gravity * dt;
            if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
            p.x += (p.vx + Math.sin(p.sway) * p.swayAmp) * dt;
            p.y += p.vy * dt;
        }
    }

    function draw() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        drawStars(clock);
        for (const p of parts) {
            const k = p.age / p.life;
            let a = k < 0.12 ? k / 0.12 : k > 0.7 ? (1 - k) / 0.3 : 1;
            if (p.blink) a *= 0.35 + 0.65 * Math.max(0, Math.sin(p.age * p.blink + p.sway));
            const x = ox + p.x * scale;
            const y = oy + p.y * scale;
            if (p.type === 'rain') {
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = a * 0.55;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = Math.max(1, p.size * scale * 0.5);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x - p.vx * 0.045 * scale, y - p.vy * 0.045 * scale);
                ctx.stroke();
                ctx.globalCompositeOperation = 'lighter';
                continue;
            }
            const flake = p.kind === 'flake';
            if (flake) ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = Math.max(0, a);
            const shrink = p.type === 'rise' || p.type === 'spark' ? 1 - k * 0.6 : 1;
            const d = p.size * (flake ? 2.2 : 6) * scale * shrink;
            ctx.drawImage(sprite(p.color, p.kind), x - d / 2, y - d / 2, d, d);
            if (flake) ctx.globalCompositeOperation = 'lighter';
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    let lastPrewarm = false;
    return {
        resize,
        burst,
        /** Cues reached and the section being sung (scenes switch emitters with these). */
        setState(nextReached, nextSection) {
            reached = nextReached;
            section = nextSection;
            if (!lastPrewarm) {
                // start with the air already full instead of an empty sky filling up
                lastPrewarm = true;
                for (let i = 0; i < 40; i++) step(0.1);
            }
        },
        tick(dt, paused) {
            if (still) { if (!paused) step(Math.min(dt, 0.05)); draw(); return; }
            if (lite) { skip = !skip; if (skip) return; dt *= 2; }
            if (!paused) step(Math.min(dt, 0.1));
            draw();
        },
        clear() { parts.length = 0; },
        destroy() { parts.length = 0; sprites.clear(); },
    };
}
