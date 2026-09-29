/**
 * Sky Theater choreography.
 *
 * A choreography turns the stage size into a flight: a function `at(u)` (u = 0…1 of the flight)
 * that returns the actor's top-left `x`, `y`, rotation `r` (deg), `s` scale and `o` opacity.
 * The engine samples it into Web Animations keyframes (so pacing lives in the path itself, not an
 * easing curve) and reads it again while flying to drop trail particles in the right place.
 *
 * Paths are generated per flight from the real stage width, so the actor always travels the
 * whole header (the old vw-based keyframes overshot or fell short depending on layout), and
 * every flight gets its own lane, bob and direction.
 */

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function smooth(t) {
    return t * t * (3 - 2 * t);
}

/** Soft fade in/out at the very ends of a flight. */
function edgeFade(u, inEnd = 0.05, outStart = 0.95) {
    if (u < inEnd) return u / inEnd;
    if (u > outStart) return (1 - u) / (1 - outStart);
    return 1;
}

/**
 * @typedef {object} FlightCtx
 * @property {number} W stage width (px)
 * @property {number} H stage height (px)
 * @property {number} w actor width (px)
 * @property {number} h actor height (px)
 * @property {1 | -1} dir 1 = left-to-right
 * @property {() => number} rng
 */

/**
 * @typedef {object} Flight
 * @property {(u: number) => { x: number, y: number, r?: number, s?: number, o?: number }} at
 * @property {number} duration ms
 * @property {{ dx: number, dy: number }} [tail] where trail particles leave the actor, from its centre
 * @property {{ at: number, add?: string, remove?: string, burst?: number }[]} [cues]
 * @property {number} [bank] how much the actor leans into its path (0…1)
 * @property {boolean} [steer] true → rotation follows the path exactly (loops)
 * @property {boolean} [noTilt] true → rotation comes only from `r`
 */

function lane(ctx, lo, hi) {
    const { H, h, rng } = ctx;
    const top = 2;
    const bottom = Math.max(top, H - h - 2);
    return clamp(lerp(H * lo, H * hi, rng()), top, bottom);
}

function span(ctx) {
    const { W, w, dir } = ctx;
    const from = dir === 1 ? -w - 12 : W + 12;
    const to = dir === 1 ? W + 12 : -w - 12;
    return { from, to, dist: Math.abs(to - from) };
}

function durationFor(dist, pxPerSec, min, max) {
    return clamp((dist / pxPerSec) * 1000, min, max);
}

/** @type {Record<string, (ctx: FlightCtx) => Flight>} */
export const FLIGHTS = {
    /** Easy horizontal cruise with a gentle bob. */
    glide(ctx) {
        const { rng, h } = ctx;
        const { from, to, dist } = span(ctx);
        const y0 = lane(ctx, 0.1, 0.5);
        const amp = 5 + rng() * 5;
        const cycles = 1.4 + rng() * 1.2;
        const phase = rng() * TAU;
        return {
            duration: durationFor(dist, 175 + rng() * 45, 6200, 10500),
            bank: 0.55,
            tail: { dx: -ctx.dir * ctx.w * 0.46, dy: h * 0.08 },
            at: (u) => ({ x: lerp(from, to, u), y: y0 + amp * Math.sin(u * cycles * TAU + phase), o: edgeFade(u) })
        };
    },

    /** Dives from high, skims low through the middle, climbs out. */
    swoop(ctx) {
        const { rng, H, h } = ctx;
        const { from, to, dist } = span(ctx);
        const high = clamp(H * 0.04, 2, H - h - 2);
        const low = lane(ctx, 0.42, 0.62);
        const wobble = 3 + rng() * 3;
        return {
            duration: durationFor(dist, 185 + rng() * 40, 6000, 9800),
            bank: 0.6,
            tail: { dx: -ctx.dir * ctx.w * 0.4, dy: 0 },
            at: (u) => ({
                x: lerp(from, to, u),
                y: lerp(high, low, Math.sin(Math.PI * u)) + wobble * Math.sin(u * 5 * TAU),
                o: edgeFade(u)
            })
        };
    },

    /** Lively up-and-down hops (kites, parrots, bats). */
    zigzag(ctx) {
        const { rng } = ctx;
        const { from, to, dist } = span(ctx);
        const y0 = lane(ctx, 0.18, 0.45);
        const amp = 9 + rng() * 6;
        const cycles = 3 + rng() * 1.5;
        return {
            duration: durationFor(dist, 170 + rng() * 40, 6400, 10200),
            bank: 0.45,
            tail: { dx: -ctx.dir * ctx.w * 0.45, dy: 0 },
            at: (u) => ({ x: lerp(from, to, u), y: y0 + amp * Math.sin(u * cycles * TAU), o: edgeFade(u) })
        };
    },

    /** Big serpentine weave with a playful mid-air somersault of the bob (dragon). */
    weave(ctx) {
        const { rng } = ctx;
        const { from, to, dist } = span(ctx);
        const y0 = lane(ctx, 0.2, 0.42);
        const amp = 13 + rng() * 6;
        const cycles = 2 + rng();
        return {
            duration: durationFor(dist, 190 + rng() * 40, 6200, 9800),
            bank: 0.7,
            tail: { dx: ctx.dir * ctx.w * 0.46, dy: -ctx.h * 0.05 },
            at: (u) => ({ x: lerp(from, to, u), y: y0 + amp * Math.sin(u * cycles * TAU), o: edgeFade(u) })
        };
    },

    /** Slow, floaty drift with a lazy bob (balloons, blimps). */
    drift(ctx) {
        const { rng } = ctx;
        const { from, to, dist } = span(ctx);
        const y0 = lane(ctx, 0.08, 0.32);
        const amp = 3 + rng() * 3;
        return {
            duration: durationFor(dist, 95 + rng() * 25, 9000, 15000),
            bank: 0.12,
            tail: { dx: -ctx.dir * ctx.w * 0.4, dy: 0 },
            at: (u) => ({ x: lerp(from, to, u), y: y0 + amp * Math.sin(u * 2.2 * TAU), o: edgeFade(u, 0.04, 0.96) })
        };
    },

    /** Erratic, dancing flutter (butterflies, bees). */
    flutter(ctx) {
        const { rng } = ctx;
        const { from, to, dist } = span(ctx);
        const y0 = lane(ctx, 0.2, 0.45);
        const a1 = 8 + rng() * 5;
        const a2 = 4 + rng() * 3;
        const p = rng() * TAU;
        return {
            duration: durationFor(dist, 120 + rng() * 30, 8000, 13000),
            bank: 0.25,
            tail: { dx: -ctx.dir * ctx.w * 0.3, dy: 0 },
            at: (u) => ({
                x: lerp(from, to, u) + ctx.dir * 14 * Math.sin(u * 7 * TAU),
                y: y0 + a1 * Math.sin(u * 3 * TAU + p) + a2 * Math.sin(u * 11 * TAU),
                o: edgeFade(u)
            })
        };
    },

    /** Paper plane: cruises in, flies a full loop-the-loop, cruises out. */
    loop(ctx) {
        const { W, H, w, h, dir, rng } = ctx;
        const { from, to } = span(ctx);
        const R = clamp((H - h - 8) / 2.2, 12, 34);
        const yc = clamp(H - h - 6, 2 * R + 2, H - h - 2);
        const cx = clamp(lerp(W * 0.3, W * 0.7, rng()), w, W - w) - w / 2;
        const a = 0.42;
        const b = 0.64;
        return {
            duration: durationFor(Math.abs(to - from), 230, 6200, 9000),
            steer: true,
            tail: { dx: -dir * w * 0.45, dy: h * 0.1 },
            at: (u) => {
                if (u < a) {
                    const t = u / a;
                    return { x: lerp(from, cx, t), y: yc - 6 * Math.sin(Math.PI * t), o: edgeFade(u) };
                }
                if (u < b) {
                    const th = smooth((u - a) / (b - a)) * TAU;
                    return { x: cx + dir * R * Math.sin(th), y: yc - R * (1 - Math.cos(th)) };
                }
                const t = (u - b) / (1 - b);
                return { x: lerp(cx, to, t), y: yc - 8 * Math.sin(Math.PI * t), o: edgeFade(u) };
            }
        };
    },

    /** Rocket lift-off from the bottom edge of the header, accelerating up and out. */
    launch(ctx) {
        const { W, H, w, h, dir, rng } = ctx;
        const x0 = lerp(W * 0.18, W * 0.82, rng()) - w / 2;
        const drift = dir * (60 + rng() * 90);
        const lean = dir * (10 + rng() * 8);
        return {
            duration: 4200,
            noTilt: true,
            tail: { dx: 0, dy: h * 0.52 },
            at: (u) => {
                // Brief rumble on the pad, then a smooth accelerating climb.
                const t = u < 0.18 ? 0 : (u - 0.18) / 0.82;
                const climb = t * t;
                const rumble = u < 0.18 ? Math.sin(u * 180) * 1.2 : 0;
                return {
                    x: x0 + drift * climb + rumble,
                    y: lerp(H - h * 0.35, -h - 20, climb),
                    r: lean * smooth(Math.min(1, t * 2)),
                    o: u > 0.92 ? (1 - u) / 0.08 : 1
                };
            }
        };
    },

    /** Comet streak: a fast diagonal dash across the sky. */
    streak(ctx) {
        const { H, h, dir, rng } = ctx;
        const { from, to, dist } = span(ctx);
        const y0 = -h * 0.6;
        const y1 = clamp(H * (0.5 + rng() * 0.25), 0, H);
        return {
            duration: durationFor(dist, 440 + rng() * 80, 2600, 4200),
            bank: 1,
            tail: { dx: -dir * ctx.w * 0.3, dy: 0 },
            at: (u) => ({ x: lerp(from, to, u), y: lerp(y0, y1, u), o: edgeFade(u, 0.06, 0.9) })
        };
    },

    /** UFO: glides in, hovers and beams down, then zips away with a hop. */
    hover(ctx) {
        const { W, w, h, dir, rng } = ctx;
        const { from, to } = span(ctx);
        const y0 = lane(ctx, 0.04, 0.2);
        const cx = lerp(W * 0.32, W * 0.68, rng()) - w / 2;
        const a = 0.34;
        const b = 0.7;
        return {
            duration: 9000,
            bank: 0.35,
            tail: { dx: 0, dy: h * 0.4 },
            cues: [{ at: a + 0.02, add: 'is-beaming' }, { at: b - 0.03, remove: 'is-beaming' }],
            at: (u) => {
                if (u < a) {
                    const t = u / a;
                    const e = 1 - (1 - t) * (1 - t);
                    return { x: lerp(from, cx, e), y: y0 + 4 * Math.sin(t * TAU), o: edgeFade(u, 0.05, 1) };
                }
                if (u < b) {
                    const t = (u - a) / (b - a);
                    return { x: cx + dir * 3 * Math.sin(t * 2 * TAU), y: y0 + 3 * Math.sin(t * 3 * TAU), r: 3 * Math.sin(t * 2 * TAU) };
                }
                const t = (u - b) / (1 - b);
                return { x: lerp(cx, to, t * t), y: y0 - 10 * Math.sin(Math.PI * Math.min(1, t * 1.6)), o: edgeFade(u, 0, 0.94) };
            }
        };
    },

    /** Falling guest (leaves, snowflakes): drifts down across the header, rocking like a pendulum. */
    fall(ctx) {
        const { W, H, w, h, dir, rng } = ctx;
        const x0 = lerp(W * 0.1, W * 0.6, rng()) - w / 2;
        const across = dir * (W * (0.2 + rng() * 0.18));
        const sway = 16 + rng() * 10;
        return {
            duration: 9500,
            noTilt: true,
            tail: { dx: 0, dy: -h * 0.3 },
            at: (u) => ({
                x: x0 + across * u + sway * Math.sin(u * 3 * TAU),
                y: lerp(-h - 4, H + 4, u),
                r: 22 * Math.cos(u * 3 * TAU),
                o: edgeFade(u, 0.04, 0.9)
            })
        };
    }
};

/**
 * Cameo routines — little moments beside the date and clock. Keyframes are relative transforms
 * (the anchor is set in CSS), so they only describe how the character enters, plays and leaves.
 * @type {Record<string, () => { duration: number, frames: Keyframe[], cues?: { at: number, add?: string, remove?: string, burst?: number }[] }>}
 */
export const CAMEOS = {
    pop: () => ({
        duration: 3800,
        cues: [{ at: 0.1, burst: 10 }],
        frames: [
            { offset: 0, transform: 'translateY(30%) scale(0.1) rotate(-30deg)', opacity: 0 },
            { offset: 0.12, transform: 'translateY(-8%) scale(1.22) rotate(10deg)', opacity: 1 },
            { offset: 0.2, transform: 'translateY(0) scale(0.92) rotate(-5deg)' },
            { offset: 0.27, transform: 'translateY(-3%) scale(1.04) rotate(2deg)' },
            { offset: 0.45, transform: 'translateY(-8%) scale(1) rotate(-3deg)' },
            { offset: 0.62, transform: 'translateY(0) scale(1.02) rotate(3deg)' },
            { offset: 0.8, transform: 'translateY(-6%) scale(1) rotate(-2deg)', opacity: 1 },
            { offset: 1, transform: 'translateY(-40%) scale(0.3) rotate(25deg)', opacity: 0 }
        ]
    }),
    rise: () => ({
        duration: 4200,
        cues: [{ at: 0.2, burst: 8 }],
        frames: [
            { offset: 0, transform: 'translateY(70%) scale(0.6)', opacity: 0 },
            { offset: 0.2, transform: 'translateY(-6%) scale(1.08)', opacity: 1 },
            { offset: 0.3, transform: 'translateY(0) scale(1)' },
            { offset: 0.55, transform: 'translateY(-7%) scale(1.03)' },
            { offset: 0.8, transform: 'translateY(0) scale(1)', opacity: 1 },
            { offset: 1, transform: 'translateY(70%) scale(0.6)', opacity: 0 }
        ]
    }),
    peek: () => ({
        duration: 4200,
        frames: [
            { offset: 0, transform: 'translateX(70%) rotate(12deg) scale(0.8)', opacity: 0 },
            { offset: 0.18, transform: 'translateX(-6%) rotate(-5deg) scale(1.04)', opacity: 1 },
            { offset: 0.28, transform: 'translateX(0) rotate(2deg) scale(1)' },
            { offset: 0.42, transform: 'translateX(-3%) rotate(-3deg) scale(1.02)' },
            { offset: 0.58, transform: 'translateX(0) rotate(3deg) scale(1)' },
            { offset: 0.8, transform: 'translateX(-2%) rotate(-2deg) scale(1)', opacity: 1 },
            { offset: 1, transform: 'translateX(70%) rotate(12deg) scale(0.8)', opacity: 0 }
        ]
    }),
    stamp: () => ({
        duration: 3800,
        cues: [{ at: 0.22, burst: 12 }],
        frames: [
            { offset: 0, transform: 'translateY(-90%) rotate(-28deg) scale(1.3)', opacity: 0 },
            { offset: 0.16, transform: 'translateY(-10%) rotate(-6deg) scale(1.1)', opacity: 1 },
            { offset: 0.22, transform: 'translateY(4%) rotate(3deg) scale(1.14, 0.86)' },
            { offset: 0.3, transform: 'translateY(-6%) rotate(-2deg) scale(0.96, 1.06)' },
            { offset: 0.38, transform: 'translateY(0) rotate(0deg) scale(1)' },
            { offset: 0.6, transform: 'translateY(-4%) rotate(4deg) scale(1)' },
            { offset: 0.8, transform: 'translateY(0) rotate(-3deg) scale(1)', opacity: 1 },
            { offset: 1, transform: 'translateY(-50%) rotate(10deg) scale(0.5)', opacity: 0 }
        ]
    }),
    burst: () => ({
        duration: 3600,
        cues: [{ at: 0.3, add: 'is-popped', burst: 18 }],
        frames: [
            { offset: 0, transform: 'translateY(30%) scale(0.2) rotate(20deg)', opacity: 0 },
            { offset: 0.14, transform: 'translateY(-4%) scale(1.1) rotate(-6deg)', opacity: 1 },
            { offset: 0.24, transform: 'translateY(0) scale(0.94) rotate(4deg)' },
            { offset: 0.3, transform: 'translateY(6%) scale(1.18, 0.82) rotate(-14deg)' },
            { offset: 0.38, transform: 'translateY(-4%) scale(0.98, 1.04) rotate(4deg)' },
            { offset: 0.5, transform: 'translateY(0) scale(1) rotate(0deg)' },
            { offset: 0.8, transform: 'translateY(-4%) scale(1) rotate(-3deg)', opacity: 1 },
            { offset: 1, transform: 'translateY(30%) scale(0.3) rotate(18deg)', opacity: 0 }
        ]
    }),
    treasure: () => ({
        duration: 4600,
        cues: [{ at: 0.28, add: 'is-open', burst: 14 }, { at: 0.8, remove: 'is-open' }],
        frames: [
            { offset: 0, transform: 'translateY(40%) scale(0.3) rotate(-14deg)', opacity: 0 },
            { offset: 0.12, transform: 'translateY(-6%) scale(1.12) rotate(5deg)', opacity: 1 },
            { offset: 0.2, transform: 'translateY(0) scale(0.95) rotate(-2deg)' },
            { offset: 0.26, transform: 'translateY(0) scale(1.06, 0.92) rotate(0deg)' },
            { offset: 0.34, transform: 'translateY(-4%) scale(1) rotate(0deg)' },
            { offset: 0.6, transform: 'translateY(0) scale(1.02) rotate(2deg)' },
            { offset: 0.86, transform: 'translateY(0) scale(1) rotate(-2deg)', opacity: 1 },
            { offset: 1, transform: 'translateY(40%) scale(0.3) rotate(10deg)', opacity: 0 }
        ]
    })
};

/**
 * Sample a flight into keyframes, adding banking from the path's slope.
 * @param {Flight} flight
 * @param {1 | -1} dir
 * @param {number} [steps]
 */
export function sampleFlight(flight, dir, steps = 48) {
    const pts = [];
    for (let i = 0; i <= steps; i += 1) {
        pts.push({ u: i / steps, ...flight.at(i / steps) });
    }
    const bank = flight.bank ?? 0.5;
    let prevAngle = 0;
    return pts.map((p, i) => {
        let r = p.r ?? 0;
        if (!flight.noTilt) {
            const a = pts[Math.max(0, i - 1)];
            const b = pts[Math.min(pts.length - 1, i + 1)];
            const dx = (b.x - a.x) * dir;
            const dy = b.y - a.y;
            let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
            if (flight.steer) {
                // Unwrap so a loop turns smoothly through 360° instead of snapping back.
                while (ang - prevAngle > 180) ang -= 360;
                while (ang - prevAngle < -180) ang += 360;
                prevAngle = ang;
                r += dir * ang;
            } else {
                r += dir * clamp(ang, -40, 40) * bank;
            }
        }
        return {
            offset: p.u,
            transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${(p.s ?? 1).toFixed(3)})`,
            opacity: clamp(p.o ?? 1, 0, 1)
        };
    });
}
