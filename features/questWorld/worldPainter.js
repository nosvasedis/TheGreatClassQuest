/**
 * Quest World painter: turns the art's paint passes (worldArt.mjs) into finished
 * pictures, once.
 *
 * Each big layer is drawn into a canvas pass by pass: the vector shapes, soft
 * shadows (blurred, multiplied), the detail, a brush-and-paper texture laid in
 * with soft-light, and a blurred glow. Canvas compositing runs on the GPU, so
 * a whole world takes a few hundred milliseconds, spread over frames. The day
 * pictures are kept in Cache Storage per device (keyed by the art version,
 * season and size), so later visits skip the painting entirely.
 *
 * The light of the moment (dawn, golden hour, night, a storm…) is a grade of
 * the day picture: saturation and brightness, a multiplied tint, a screened
 * glow from the sun's side, and the windows lit at night. A grade is a handful
 * of GPU draws, so the land can follow the live sky without repainting.
 */

import { seededRandom } from '../skyWeather.mjs';

const CACHE_NAME = 'gcq-quest-world';
const LAYERS = ['far', 'mid', 'near', 'halo', 'panes'];

const nextFrame = () => new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(resolve, 0));
    else setTimeout(resolve, 0);
});

function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

/** An SVG string as a decoded image. */
function loadSvg(svg) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
            const done = () => { URL.revokeObjectURL(url); resolve(img); };
            if (img.decode) img.decode().then(done, done);
            else done();
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Quest World art failed to load')); };
        img.src = url;
    });
}

// ── Textures ─────────────────────────────────────────────────────────────

/** Draws `fn(dx, dy)` at the tile's wrap-around offsets so the tile repeats seamlessly. */
function wrapDraw(size, x, y, reach, fn) {
    for (const dx of [-size, 0, size]) {
        for (const dy of [-size, 0, size]) {
            if (x + dx + reach < 0 || x + dx - reach > size || y + dy + reach < 0 || y + dy - reach > size) continue;
            fn(x + dx, y + dy);
        }
    }
}

let textureCache = null;

/**
 * Two seamless tiles: "brush" (mid-grey canvas with soft blotches and short
 * brush strokes leaning with the light; neutral under soft-light) and "grain"
 * (near-white paper speckle for multiply).
 */
export function makeTextures(seed = 7) {
    if (textureCache) return textureCache;
    const rng = seededRandom(seed);
    const size = 512;
    const brush = makeCanvas(size, size);
    const b = brush.getContext('2d');
    b.fillStyle = '#808080';
    b.fillRect(0, 0, size, size);
    for (let i = 0; i < 220; i += 1) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 18 + rng() * 80;
        const light = rng() < 0.5;
        const alpha = 0.06 + rng() * 0.12;
        wrapDraw(size, x, y, r, (px, py) => {
            const g = b.createRadialGradient(px, py, 0, px, py, r);
            g.addColorStop(0, light ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`);
            g.addColorStop(1, 'rgba(128,128,128,0)');
            b.fillStyle = g;
            b.fillRect(px - r, py - r, r * 2, r * 2);
        });
    }
    b.lineCap = 'round';
    for (let i = 0; i < 1400; i += 1) {
        const x = rng() * size;
        const y = rng() * size;
        const len = 5 + rng() * 18;
        const angle = (-28 + (rng() - 0.5) * 30) * (Math.PI / 180);
        const light = rng() < 0.55;
        b.strokeStyle = light ? `rgba(255,255,255,${0.1 + rng() * 0.22})` : `rgba(20,20,20,${0.08 + rng() * 0.2})`;
        b.lineWidth = 1.2 + rng() * 3.4;
        wrapDraw(size, x, y, len, (px, py) => {
            b.beginPath();
            b.moveTo(px - Math.cos(angle) * len / 2, py - Math.sin(angle) * len / 2);
            b.lineTo(px + Math.cos(angle) * len / 2, py + Math.sin(angle) * len / 2);
            b.stroke();
        });
    }
    const grainSize = 256;
    const grain = makeCanvas(grainSize, grainSize);
    const g = grain.getContext('2d');
    const data = g.createImageData(grainSize, grainSize);
    for (let i = 0; i < data.data.length; i += 4) {
        const v = 205 + Math.floor(rng() * 50);
        data.data[i] = v;
        data.data[i + 1] = v - 4;
        data.data[i + 2] = v - 12;
        data.data[i + 3] = 255;
    }
    g.putImageData(data, 0, 0);
    textureCache = { brush, grain };
    return textureCache;
}

// ── Painting ─────────────────────────────────────────────────────────────

/** Paint (a colour, gradient or pattern) clipped to the opaque parts of `shape`. */
function shapedPaint(shape, paint, width, height) {
    const temp = makeCanvas(width, height);
    const t = temp.getContext('2d');
    t.fillStyle = typeof paint === 'function' ? paint(t) : paint;
    t.fillRect(0, 0, width, height);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(shape, 0, 0, width, height);
    return temp;
}

/** One layer: runs its passes into a fresh canvas. */
export async function paintPasses(passes, width, height, textures = makeTextures()) {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const scale = width / 1600;
    for (const pass of passes) {
        if (pass.svg) {
            const img = await loadSvg(pass.svg);
            if (pass.blur || pass.op || pass.alpha !== undefined) {
                const temp = makeCanvas(width, height);
                const t = temp.getContext('2d');
                if (pass.blur) t.filter = `blur(${(pass.blur * scale).toFixed(1)}px)`;
                t.drawImage(img, 0, 0, width, height);
                ctx.save();
                ctx.globalCompositeOperation = pass.op || 'source-over';
                ctx.globalAlpha = pass.alpha ?? 1;
                ctx.drawImage(temp, 0, 0);
                ctx.restore();
            } else {
                ctx.drawImage(img, 0, 0, width, height);
            }
        } else if (pass.texture) {
            const tile = textures[pass.texture];
            if (!tile) continue;
            const temp = shapedPaint(canvas, (t) => t.createPattern(tile, 'repeat'), width, height);
            ctx.save();
            ctx.globalCompositeOperation = pass.op || 'soft-light';
            ctx.globalAlpha = pass.alpha ?? 0.5;
            ctx.drawImage(temp, 0, 0);
            ctx.restore();
        }
        await nextFrame();
    }
    return canvas;
}

// ── Cache Storage (one painting per device, per art version) ─────────────

function cacheUrl(meta, name) {
    return `/__quest-world/v${meta.version}/${meta.season}/${meta.width}/${name}.png`;
}

async function readCached(meta) {
    try {
        if (typeof caches === 'undefined') return null;
        const cache = await caches.open(CACHE_NAME);
        const hits = await Promise.all(LAYERS.map((name) => cache.match(cacheUrl(meta, name))));
        if (hits.some((hit) => !hit)) return null;
        const bitmaps = await Promise.all(hits.map(async (hit) => createImageBitmap(await hit.blob())));
        return Object.fromEntries(LAYERS.map((name, i) => [name, bitmaps[i]]));
    } catch {
        return null;
    }
}

function canvasBlob(canvas) {
    return new Promise((resolve) => {
        try { canvas.toBlob((blob) => resolve(blob), 'image/png'); } catch { resolve(null); }
    });
}

async function writeCached(meta, pictures) {
    try {
        if (typeof caches === 'undefined') return;
        const cache = await caches.open(CACHE_NAME);
        // Older paintings (other versions, seasons or sizes of this version) are dropped.
        const keep = `/__quest-world/v${meta.version}/${meta.season}/`;
        const keys = await cache.keys();
        await Promise.all(keys.filter((request) => !new URL(request.url).pathname.startsWith(keep)
            || new URL(request.url).pathname.split('/').length < 5).map((request) => cache.delete(request)));
        const sizes = new Set(keys.map((request) => new URL(request.url).pathname.split('/')[4]).filter(Boolean));
        if (sizes.size > 2) {
            await Promise.all(keys.filter((request) => !new URL(request.url).pathname.includes(`/${meta.width}/`)).map((request) => cache.delete(request)));
        }
        for (const name of LAYERS) {
            const blob = await canvasBlob(pictures[name]);
            if (blob) await cache.put(cacheUrl(meta, name), new Response(blob, { headers: { 'Content-Type': 'image/png' } }));
        }
    } catch {
        // A full or blocked cache only means painting again next time.
    }
}

/** The bake width for a map shown `cssWidth` wide: snapped so the cache is reused. */
export function bakeWidthFor(cssWidth, { dpr = 1, lite = false } = {}) {
    const wanted = Math.max(1, cssWidth) * Math.min(2, Math.max(1, dpr)) * 1.1;
    const cap = lite ? 1600 : 2560;
    const snapped = Math.ceil(wanted / 320) * 320;
    return Math.max(1280, Math.min(cap, snapped));
}

/**
 * The day pictures of the world (far, mid, near, plus the night windows'
 * halo and panes). From the device cache when it has them, otherwise painted
 * now and cached in the background.
 */
export async function bakeWorld(art, { width }) {
    const height = Math.round((width * 9) / 16);
    const meta = { version: art.version, season: art.season, width };
    const cached = await readCached(meta);
    if (cached) return { ...cached, width, height, fromCache: true };
    const textures = makeTextures();
    const pictures = {};
    pictures.mid = await paintPasses(art.layers.mid.passes, width, height, textures);
    pictures.far = await paintPasses(art.layers.far.passes, width, height, textures);
    pictures.near = await paintPasses(art.layers.near.passes, width, height, textures);
    pictures.halo = await paintPasses([{ svg: art.lights.halo, blur: 3 }], width, height, textures);
    pictures.panes = await paintPasses([{ svg: art.lights.panes }], width, height, textures);
    const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback : (fn) => setTimeout(fn, 1500);
    idle(() => { void writeCached(meta, pictures); });
    return { ...pictures, width, height, fromCache: false };
}

// ── Grading (the light of the moment) ────────────────────────────────────

/**
 * Draws `source` graded for the sky into `target` (same size).
 * `grade` comes from worldGeometry.mjs#landGrade; `lights` = { halo, panes }
 * lights the windows (mid layer only).
 */
export function gradeInto(target, source, grade, { lights = null } = {}) {
    const width = target.width;
    const height = target.height;
    const ctx = target.getContext('2d');
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    const neutral = grade.saturate === 1 && grade.brightness === 1;
    if (!neutral) ctx.filter = `saturate(${grade.saturate}) brightness(${grade.brightness})`;
    ctx.drawImage(source, 0, 0, width, height);
    ctx.filter = 'none';
    if (grade.tintAlpha > 0) {
        const tint = shapedPaint(target, grade.tint, width, height);
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = grade.tintAlpha;
        ctx.drawImage(tint, 0, 0);
    }
    if (grade.weather && grade.weatherAlpha > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = grade.weatherAlpha;
        ctx.fillStyle = grade.weather;
        ctx.fillRect(0, 0, width, height);
    }
    if (grade.glowAlpha > 0) {
        const glow = shapedPaint(target, (t) => {
            const g = grade.glowFrom === 'right'
                ? t.createLinearGradient(width, 0, width * 0.35, height * 0.4)
                : grade.glowFrom === 'top'
                    ? t.createLinearGradient(0, 0, 0, height * 0.7)
                    : t.createLinearGradient(0, 0, width * 0.65, height * 0.4);
            g.addColorStop(0, grade.glow);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            return g;
        }, width, height);
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = grade.glowAlpha;
        ctx.drawImage(glow, 0, 0);
    }
    if (lights && grade.lights > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, grade.lights * 0.95);
        ctx.drawImage(lights.halo, 0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = grade.lights;
        ctx.drawImage(lights.panes, 0, 0, width, height);
    }
    ctx.restore();
    return target;
}
