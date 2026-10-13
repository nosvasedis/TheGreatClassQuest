/**
 * Quest World painter: loads the painted land and lights it for the sky.
 *
 * The land is one finished painting per season (worldArt.mjs#paintingFor),
 * fetched at the size the map needs: 1600 wide, or 2560 on big or sharp
 * screens. The browser keeps the files in its cache, so later visits draw
 * at once.
 *
 * The light of the moment (dawn, golden hour, night, a storm…) is a grade of
 * the day picture: saturation and brightness, a multiplied tint, a screened
 * glow from the sun's side, and after dusk the night lights added on top
 * (windows, lamps, the stair and the Portal). A grade is a handful of GPU
 * draws into one canvas, so the land follows the live sky without reloading.
 */

import { paintingFor } from './worldArt.mjs';

const images = new Map();

/** A picture, decoded off the main thread where the browser can. */
export function loadPicture(url) {
    if (!images.has(url)) {
        images.set(url, new Promise((resolve, reject) => {
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => {
                const done = () => resolve(img);
                if (img.decode) img.decode().then(done, done);
                else done();
            };
            img.onerror = () => {
                images.delete(url);
                reject(new Error(`Quest World picture failed to load: ${url}`));
            };
            img.src = url;
        }));
    }
    return images.get(url);
}

function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

/** The bake width for a map shown `cssWidth` wide: the small picture unless the screen needs more. */
export function bakeWidthFor(cssWidth, { dpr = 1, lite = false } = {}) {
    if (lite) return 1600;
    const wanted = Math.max(1, cssWidth) * Math.min(2, Math.max(1, dpr));
    return wanted > 1760 ? 2560 : 1600;
}

/** The season's land and the night lights, ready to draw. */
export async function bakeWorld(art, { width }) {
    const urls = paintingFor(art.season, width);
    const [land, lights] = await Promise.all([
        loadPicture(urls.land),
        loadPicture(urls.lights).catch(() => null)
    ]);
    const height = Math.round((width * 9) / 16);
    return { land, lights, width, height };
}

/** Paint (a colour or gradient) clipped to the opaque parts of `shape`. */
function shapedPaint(shape, paint, width, height) {
    const temp = makeCanvas(width, height);
    const t = temp.getContext('2d');
    t.fillStyle = typeof paint === 'function' ? paint(t) : paint;
    t.fillRect(0, 0, width, height);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(shape, 0, 0, width, height);
    return temp;
}

/**
 * Draws `source` graded for the sky into `target` (same size).
 * `grade` comes from worldGeometry.mjs#landGrade; `lights` (an image of the
 * glowing windows and lamps on black) is added at `grade.lights`.
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
        // The lights are glow on black: keep them to the land, then add them.
        const glow = makeCanvas(width, height);
        const g = glow.getContext('2d');
        g.drawImage(lights, 0, 0, width, height);
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(source, 0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, grade.lights);
        ctx.drawImage(glow, 0, 0);
    }
    ctx.restore();
    return target;
}
