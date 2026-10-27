/**
 * Map journey geometry (pure, no DOM): stretches of the road as drawable
 * lines, the nearest spot on the road to a point, how far a party is from a
 * spot, footsteps along a walk, and the camera's zoom and pan maths.
 *
 * Everything is in world units (1600 × 900, worldGeometry.mjs), except the
 * camera, which works in the frame's own pixels.
 */

import { WORLD_H, WORLD_W, pointAtProgress } from './worldGeometry.mjs';
import { getQuestMapZoneForProgressPercent } from '../questMapZones.mjs';
import { formatQuestStars, starsToReachPercent } from '../teamQuestRace.mjs';

const round1 = (value) => Math.round(value * 10) / 10;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Points along the road from `from` to `to` (progress 0–100), every `step`. */
export function trailPoints(from, to, step = 0.5) {
    const a = clamp(Number(from) || 0, 0, 100);
    const b = clamp(Number(to) || 0, 0, 100);
    if (b <= a) return [];
    const count = Math.max(1, Math.ceil((b - a) / step));
    const points = [];
    for (let i = 0; i <= count; i += 1) {
        const progress = a + ((b - a) * i) / count;
        const point = pointAtProgress(progress);
        points.push({ progress, x: point.x, y: point.y, normalX: point.normalX, normalY: point.normalY });
    }
    return points;
}

/** SVG path data through the points (a fine polyline reads as the curve). */
export function pathThrough(points) {
    if (!points.length) return '';
    return points.map((point, i) => `${i ? 'L' : 'M'}${round1(point.x)} ${round1(point.y)}`).join(' ');
}

/** The stretch of road from `from` to `to` as SVG path data. */
export function trailPath(from, to, step = 0.5) {
    return pathThrough(trailPoints(from, to, step));
}

/** Arc length of a run of points, and each point's share of it (0–1). */
export function measureTrail(points) {
    const lengths = [0];
    for (let i = 1; i < points.length; i += 1) {
        lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    }
    const total = lengths[lengths.length - 1] || 0;
    return { total, shares: lengths.map((length) => (total ? length / total : 0)) };
}

// A fine table of the whole road for "which spot is the pointer near?".
let roadTable = null;
function roadSamples() {
    if (!roadTable) roadTable = trailPoints(0, 100, 0.25);
    return roadTable;
}

/** The spot on the road nearest to (x, y): its progress, where it is and how far away. */
export function nearestOnRoad(x, y) {
    let best = null;
    let bestDistance = Infinity;
    for (const sample of roadSamples()) {
        const distance = (sample.x - x) ** 2 + (sample.y - y) ** 2;
        if (distance < bestDistance) {
            bestDistance = distance;
            best = sample;
        }
    }
    return { progress: Math.round(best.progress * 4) / 4, x: best.x, y: best.y, distance: Math.sqrt(bestDistance) };
}

/**
 * What a spot on the road means for a party: the realm it is in and how many
 * stars the party still needs to stand there (or that it has passed it).
 */
export function describeRoadSpot(progress, party = null) {
    const safe = clamp(Number(progress) || 0, 0, 100);
    const zone = getQuestMapZoneForProgressPercent(safe);
    // 100% is the Portal itself: a spot still on the road reads 99% at most.
    const spot = { progress: safe, percent: safe >= 100 ? 100 : Math.min(99, Math.floor(safe)), realm: zone.label, zone: zone.id };
    if (!party) return spot;
    const partyProgress = clamp(Number(party.progress) || 0, 0, 100);
    if (partyProgress >= safe - 0.25) return { ...spot, party: party.name, passed: true, starsAway: 0 };
    const starsAway = Math.max(1, starsToReachPercent(party.stars, party.goal, safe));
    return { ...spot, party: party.name, passed: false, starsAway, starsLabel: `${formatQuestStars(starsAway)}★` };
}

/**
 * Footsteps along a walk from `from` to `to`: where each falls, which way it
 * points (degrees), which foot (side) and when (0–1 of the walk's distance).
 */
export function footstepPlan(from, to, { spacing = 2.4, max = 26, stride = 4 } = {}) {
    const a = clamp(Number(from) || 0, 0, 100);
    const b = clamp(Number(to) || 0, 0, 100);
    if (b - a < spacing / 2) return [];
    const count = Math.min(max, Math.max(1, Math.floor((b - a) / spacing)));
    const steps = [];
    for (let i = 1; i <= count; i += 1) {
        const share = i / (count + 1);
        const point = pointAtProgress(a + (b - a) * share);
        const side = i % 2 ? 1 : -1;
        // The road's direction is the normal turned back a quarter.
        const angle = (Math.atan2(-point.normalX, point.normalY) * 180) / Math.PI;
        steps.push({
            x: round1(point.x + point.normalX * stride * side),
            y: round1(point.y + point.normalY * stride * side),
            angle: Math.round(angle),
            side,
            share
        });
    }
    return steps;
}

// ── The camera ───────────────────────────────────────────────────────────
// The stage is drawn at translate(x, y) scale(zoom) from its top-left corner,
// in the frame's pixels. At zoom 1 it sits still (x = y = 0).

export const CAMERA_LIMITS = Object.freeze({ min: 1, max: 2.6, liteMax: 2 });

/** Keeps the zoomed stage covering the whole frame (no empty edges). */
export function clampCamera({ x = 0, y = 0, zoom = 1 } = {}, width, height, maxZoom = CAMERA_LIMITS.max) {
    const z = clamp(Number(zoom) || 1, CAMERA_LIMITS.min, maxZoom);
    return {
        zoom: z,
        x: clamp(Number(x) || 0, width - width * z, 0),
        y: clamp(Number(y) || 0, height - height * z, 0)
    };
}

/** Zooms by `factor` around the frame point (px, py), keeping that spot under it. */
export function zoomAround(camera, factor, px, py, width, height, maxZoom = CAMERA_LIMITS.max) {
    const zoom = clamp(camera.zoom * factor, CAMERA_LIMITS.min, maxZoom);
    const ratio = zoom / camera.zoom;
    return clampCamera({ zoom, x: px - (px - camera.x) * ratio, y: py - (py - camera.y) * ratio }, width, height, maxZoom);
}

/** A camera that centres the world point (wx, wy) at `zoom`. */
export function cameraOn(wx, wy, zoom, width, height, maxZoom = CAMERA_LIMITS.max) {
    const z = clamp(zoom, CAMERA_LIMITS.min, maxZoom);
    const px = (wx / WORLD_W) * width;
    const py = (wy / WORLD_H) * height;
    return clampCamera({ zoom: z, x: width / 2 - px * z, y: height / 2 - py * z }, width, height, maxZoom);
}

/** Which frame point a world point is drawn at under the camera. */
export function worldToFrame(wx, wy, camera, width, height) {
    return {
        x: camera.x + (wx / WORLD_W) * width * camera.zoom,
        y: camera.y + (wy / WORLD_H) * height * camera.zoom
    };
}

// ── Realm colours on the road ────────────────────────────────────────────
// Each realm tints its stretch of road: warm copper through the meadows, ice
// blue up Silver Peaks, gold through the Citadel, violet on the Crystal
// stair. `light` is the glowing tint, `ink` the darker one for dotted road.
export const REALM_HUES = Object.freeze({
    bronze: Object.freeze({ light: [255, 172, 92], ink: [138, 78, 28] }),
    silver: Object.freeze({ light: [128, 214, 255], ink: [44, 104, 160] }),
    gold: Object.freeze({ light: [255, 190, 30], ink: [150, 100, 0] }),
    crystal: Object.freeze({ light: [206, 140, 255], ink: [110, 58, 176] })
});
const REALM_ORDER = Object.freeze([['bronze', 0], ['silver', 30], ['gold', 60], ['crystal', 85]]);
const BAND = 3; // half-width (progress) of the blend between two realms
const rgb = ([r, g, b]) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
const mixRgb = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);

/** The realm a spot on the road belongs to. */
export function realmAt(progress) {
    const safe = clamp(Number(progress) || 0, 0, 100);
    return REALM_ORDER.reduce((current, [id, start]) => (safe >= start ? id : current), 'bronze');
}

/**
 * The whole road as coloured pieces, for drawing it in its realms' tints:
 * one long piece per realm, and short pieces where two realms blend.
 * Each piece is { from, to, realm, light, ink } with CSS colours.
 */
export function realmRoadPieces({ step = 0.5 } = {}) {
    const pieces = [];
    const push = (from, to, light, ink, realm) => {
        if (to - from > 0.01) pieces.push({ from, to, realm, light: rgb(light), ink: rgb(ink) });
    };
    REALM_ORDER.forEach(([id, start], i) => {
        const end = REALM_ORDER[i + 1]?.[1] ?? 100;
        const hue = REALM_HUES[id];
        const solidFrom = i === 0 ? 0 : start + BAND;
        const solidTo = i === REALM_ORDER.length - 1 ? 100 : end - BAND;
        push(solidFrom, solidTo, hue.light, hue.ink, id);
        if (i < REALM_ORDER.length - 1) {
            const next = REALM_HUES[REALM_ORDER[i + 1][0]];
            for (let p = solidTo; p < end + BAND - 1e-6; p += step) {
                const t = (p + step / 2 - solidTo) / (2 * BAND);
                push(p, Math.min(end + BAND, p + step), mixRgb(hue.light, next.light, t), mixRgb(hue.ink, next.ink, t), realmAt(p + step / 2));
            }
        }
    });
    return pieces;
}
