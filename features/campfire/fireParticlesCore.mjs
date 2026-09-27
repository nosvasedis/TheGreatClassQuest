/**
 * Hero Campfire fire simulation: pure maths, no DOM. Covered by tests/campfire-performance-rotation.test.mjs.
 *
 * Canvas space is FIRE_W × FIRE_H with the hearth at (FIRE_CX, FIRE_BASE). Flame particles are born on
 * an ellipse (pseudo-3D depth), rise, lean towards the centre (a teardrop), sway, shrink and cool
 * from a white core through orange to red tips. Sparks are separate, long-lived and tiny.
 */
export const FIRE_W = 480;
export const FIRE_H = 600;
export const FIRE_CX = FIRE_W / 2;
export const FIRE_BASE = 500;

export function createFirePool(count, random = Math.random) {
    return Array.from({ length: count }, (_, i) => resetParticle({}, random, i / count));
}

export function resetParticle(p, random = Math.random, initialAge = 0) {
    p.age = initialAge;
    p.life = 0.75 + random() * 0.65;
    p.angle = random() * Math.PI * 2;
    p.depth = Math.sin(p.angle);                        // -1 (back) … 1 (front)
    const radius = 12 + random() * 40;
    p.x = FIRE_CX + Math.cos(p.angle) * radius;
    p.y = FIRE_BASE + p.depth * 10;
    p.phase = random() * Math.PI * 2;
    p.size = 38 + random() * 34;
    p.speed = 190 + random() * 110;
    p.kind = random() > 0.93 ? 'ember' : 'flame';
    return p;
}

/** Colour stage by age: the hot core at the base, red tips at the top. */
export function flameStage(t) {
    return t < 0.26 ? 'core' : t < 0.62 ? 'flame' : 'tip';
}

export function stepParticle(p, dt, intensity = 1, random = Math.random, time = 0) {
    p.age += Math.min(0.05, Math.max(0, dt)) / p.life;
    if (p.age >= 1) resetParticle(p, random);
    const t = p.age;
    const lean = Math.pow(t, 0.8) * 0.85;                 // converge towards the centre line
    const sway = Math.sin(t * 7 + p.phase + time * 2.1) * 11 * t + Math.sin(time * 1.3 + p.phase) * 3 * t;
    const ember = p.kind === 'ember';
    return {
        x: p.x + (FIRE_CX - p.x) * lean + sway,
        y: p.y - t * p.speed * (0.55 + intensity * 0.5) * (ember ? 1.6 : 1),
        size: Math.max(1, p.size * (1 - t * 0.82) * (ember ? 0.1 : 0.72 + intensity * 0.28)),
        alpha: Math.min(1, Math.max(0, Math.pow(Math.sin(Math.PI * Math.min(0.99, t + 0.03)), 0.8) * (ember ? 0.95 : 0.55))),
        depth: p.depth,
        kind: ember ? 'ember' : flameStage(t)
    };
}

/** A calm, organic flicker (sum of sines) in roughly 0.82 … 1.0, used for the glow and the scene's light. */
export function fireFlicker(time) {
    return 0.91 + 0.045 * Math.sin(time * 11) + 0.03 * Math.sin(time * 17.3 + 1) + 0.02 * Math.sin(time * 29.1 + 2);
}

export function createSpark(random = Math.random, initialAge = 0) {
    return {
        age: initialAge, life: 1.6 + random() * 1.6,
        x: FIRE_CX + (random() - 0.5) * 70, y: FIRE_BASE - 40 - random() * 40,
        vx: (random() - 0.5) * 34, vy: 70 + random() * 70,
        phase: random() * Math.PI * 2, size: 1 + random() * 1.6
    };
}

export function stepSpark(s, dt, random = Math.random) {
    s.age += Math.min(0.05, Math.max(0, dt));
    if (s.age >= s.life) Object.assign(s, createSpark(random));
    const t = s.age / s.life;
    s.x += (s.vx + Math.sin(s.age * 5 + s.phase) * 22) * dt;
    s.y -= s.vy * dt;
    return { x: s.x, y: s.y, size: s.size, alpha: Math.max(0, (1 - t) * (0.6 + 0.4 * Math.sin(s.age * 18 + s.phase))) };
}

export function governFire({ limit, slowFor = 0, fastFor = 0 }, frameMs, dt, maximum) {
    slowFor = frameMs > 22 ? slowFor + dt : 0;
    fastFor = frameMs < 18 ? fastFor + dt : 0;
    if (slowFor >= 2) { limit = Math.max(30, Math.floor(limit * .7)); slowFor = 0; }
    if (fastFor >= 10) { limit = Math.min(maximum, limit + 10); fastFor = 0; }
    return { limit, slowFor, fastFor };
}

/** Deterministic pseudo-random (mulberry32) for the reduced-motion painted frame and tests. */
export function seededRandom(seed = 1) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
