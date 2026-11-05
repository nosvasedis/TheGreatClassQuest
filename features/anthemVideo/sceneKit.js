// features/anthemVideo/sceneKit.js — small helpers shared by the anthem music video scenes.
// Scenes are plain SVG strings drawn in a 1600×900 world; seeded randomness keeps every showing identical.

export const W = 1600;
export const H = 900;

/** Deterministic random numbers (mulberry32). */
export function seeded(seed = 1) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Build `n` pieces of markup. */
export function times(n, fn) {
    let out = '';
    for (let i = 0; i < n; i++) out += fn(i);
    return out;
}

/** Fixed-precision number for SVG attributes. */
export function f(n, digits = 1) {
    return Number(n).toFixed(digits);
}

/** Open the scene's SVG: covers the screen, centred, with the karaoke band kept clear by each scene's layout. */
export function svgOpen(className) {
    return `<svg class="avs ${className}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" focusable="false">`;
}

/** A twinkling star field (CSS animates `.avs-twinkle`). */
export function starField(rand, count, { top = 0, bottom = 520, minR = 0.8, maxR = 2.4, color = '#fff' } = {}) {
    return times(count, () => {
        const x = rand() * W;
        const y = top + rand() * (bottom - top);
        const r = minR + rand() * (maxR - minR);
        const d = (rand() * 4).toFixed(2);
        const dur = (2.4 + rand() * 3).toFixed(2);
        return `<circle class="avs-twinkle" cx="${f(x)}" cy="${f(y)}" r="${f(r, 2)}" fill="${color}" style="animation-delay:-${d}s;animation-duration:${dur}s"/>`;
    });
}

/**
 * Rising particles (embers, sparks, motes). Each sits in a `<g>` placed with an attribute transform
 * so the CSS animation (`riseClass`) can move it with transform alone.
 */
export function risingParticles(rand, count, { className = 'avs-rise', yStart = 920, spread = W, x0 = 0, minR = 2, maxR = 5, colors = ['#fff'], minDur = 5, maxDur = 9, drift = 60 } = {}) {
    return times(count, (i) => {
        const x = x0 + rand() * spread;
        const r = minR + rand() * (maxR - minR);
        const dur = minDur + rand() * (maxDur - minDur);
        const delay = rand() * dur;
        const dx = (rand() - 0.5) * 2 * drift;
        const color = colors[i % colors.length];
        return `<g transform="translate(${f(x)} ${f(yStart)})"><circle class="${className}" r="${f(r, 2)}" fill="${color}" style="--dx:${f(dx)}px;animation-duration:${f(dur, 2)}s;animation-delay:-${f(delay, 2)}s"/></g>`;
    });
}
