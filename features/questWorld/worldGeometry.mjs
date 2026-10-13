/**
 * Quest World geometry: the one road through the four realms, where the
 * landmarks stand, the lanterns along the road, and which realms are awake.
 * Pure (no DOM): the art (worldArt.mjs), the scene (worldScene.js) and the
 * party tokens (features/worldMap.js) all read the same numbers from here.
 *
 * The world is drawn in a 1600 × 900 box (16:9, like the map frame).
 */

import { QUEST_MAP_ZONES } from '../questMapZones.mjs';
import { resolveDayPart, defaultSolarTimes } from '../../utils/dayPart.mjs';

export const WORLD_W = 1600;
export const WORLD_H = 900;

/** Side step between parties sharing a stretch of road, in world units. */
export const TOKEN_LANE_GAP = 70;
/** Tokens never sit closer than this to the edge of the world. */
export const TOKEN_EDGE_MARGIN = 58;

// Everything the class must see (the road, the crests, the parties) stays this
// far inside the world, so the diorama tilt and the frame never clip it.
export const SAFE_MARGIN = 70;

// The road, as the points it passes through (a smooth curve is drawn through them).
// Meadow village → over the stream bridge → switchbacks up the Silver Peaks to the
// mountain gate → down over the river bridge → through the Golden Citadel →
// up the crystal steps of light to the Portal.
export const ROUTE_POINTS = Object.freeze([
    [236, 806], [330, 772], [420, 740], [484, 702], [524, 652],
    [516, 598], [468, 556], [436, 504], [474, 456], [540, 428],
    [548, 374], [500, 330], [520, 278], [584, 236],
    [640, 198], // 14 · the mountain gate (Silver Peaks, 30%)
    [700, 214], [752, 252], [772, 312], [752, 370], [790, 424],
    [856, 462], [920, 500], [968, 566],
    [1036, 604], // 23 · the citadel road (Golden Citadel, 60%), below its walls
    [1120, 622], [1200, 626], [1290, 612], [1376, 578],
    [1440, 528], // 28 · the crystal stair's foot (Crystal Realm, 85%)
    [1464, 468], [1478, 408], [1486, 348], [1490, 292],
    [1488, 234] // 33 · the Portal (100%)
].map((point) => Object.freeze(point)));

/** Where each realm's stretch of road begins, by point index. */
export const REALM_BREAKS = Object.freeze([
    { id: 'bronze', index: 0, progress: 0 },
    { id: 'silver', index: 14, progress: 30 },
    { id: 'gold', index: 23, progress: 60 },
    { id: 'crystal', index: 28, progress: 85 }
]);
export const ROUTE_END_INDEX = ROUTE_POINTS.length - 1;

/** The Portal's ring: the painted arch and the spinning vortex share these numbers. */
export const PORTAL = Object.freeze({ x: 1488, y: 158, r: 58 });

/**
 * The places on the map that answer a hover or a click: each realm's own
 * landmark (the village and its windmill, the mountain gate, the citadel, the
 * floating isle under the Portal). Ellipses in world units; `zone` is what the
 * Realm Overview opens with. The Portal itself is its own place (the ring).
 */
export const REALM_PLACES = Object.freeze([
    { id: 'bronze', zone: 'bronze', progress: 0, x: 190, y: 660, rx: 150, ry: 104, label: 'Bronze Meadows', kind: 'The village and its windmill' },
    { id: 'silver', zone: 'silver', progress: 30, x: 640, y: 168, rx: 74, ry: 62, label: 'Silver Peaks', kind: 'The mountain gate' },
    { id: 'gold', zone: 'gold', progress: 60, x: 1150, y: 392, rx: 172, ry: 150, label: 'Golden Citadel', kind: 'The citadel' },
    { id: 'crystal', zone: 'diamond', progress: 85, x: 1488, y: 338, rx: 108, ry: 70, label: 'Crystal Realm', kind: 'The floating isles' }
].map((place) => Object.freeze(place)));

/** Landmarks the scene hangs things on (the leader's pennant, realm bursts). */
// Each is where a flagpole stands: the village green, the gate's arch, the
// citadel's central spire and the edge of the Portal's isle.
export const REALM_LANDMARKS = Object.freeze({
    bronze: { x: 210, y: 650, label: 'Bronze Meadows' },
    silver: { x: 640, y: 150, label: 'Silver Peaks' },
    gold: { x: 1150, y: 212, label: 'Golden Citadel' },
    crystal: { x: 1388, y: 256, label: 'Crystal Realm' }
});

/** Lanterns stand beside the road at these shares of the journey. */
export const LANTERN_STOPS = Object.freeze([6, 13, 20, 26, 37, 45, 53, 66, 74, 80, 91]);

const round1 = (value) => Math.round(value * 10) / 10;

/**
 * Catmull-Rom through the points, as cubic Bézier pieces. Each piece is
 * [p0, c1, c2, p3]. Neighbouring pieces share their tangent, so splitting the
 * road at a realm break never puts a kink in it.
 */
export function catmullRomBeziers(points, tension = 0.5) {
    const curves = [];
    for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        const k = tension / 3;
        curves.push([
            [p1[0], p1[1]],
            [round1(p1[0] + (p2[0] - p0[0]) * k), round1(p1[1] + (p2[1] - p0[1]) * k)],
            [round1(p2[0] - (p3[0] - p1[0]) * k), round1(p2[1] - (p3[1] - p1[1]) * k)],
            [p2[0], p2[1]]
        ]);
    }
    return curves;
}

const ALL_CURVES = catmullRomBeziers(ROUTE_POINTS);

/** SVG path data for a run of Bézier pieces. */
export function curvesToPath(curves) {
    if (!curves.length) return '';
    const [start] = curves[0];
    return `M ${start[0]} ${start[1]} ` + curves.map(([, c1, c2, end]) => (
        `C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${end[0]} ${end[1]}`
    )).join(' ');
}

/** The road split into its four realm stretches (the shape worldMap.js measures). */
export function routeSegments() {
    return REALM_BREAKS.map((realm, index) => {
        const next = REALM_BREAKS[index + 1];
        const endIndex = next ? next.index : ROUTE_END_INDEX;
        const curves = ALL_CURVES.slice(realm.index, endIndex);
        return {
            id: realm.id,
            minProgress: realm.progress,
            maxProgress: next ? next.progress : 100,
            curves,
            d: curvesToPath(curves)
        };
    });
}

/** The whole road as one path (the art draws it in one stroke). */
export function fullRoutePath() {
    return curvesToPath(ALL_CURVES);
}

function bezierPoint([p0, c1, c2, p3], t) {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return [
        a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0],
        a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1]
    ];
}

// Arc-length table per realm stretch, so progress walks the road evenly
// (the same rule the DOM's getPointAtLength gives the tokens).
const SAMPLES_PER_CURVE = 24;
let lookup = null;
function routeLookup() {
    if (lookup) return lookup;
    lookup = routeSegments().map((segment) => {
        const points = [];
        segment.curves.forEach((curve, curveIndex) => {
            for (let s = curveIndex === 0 ? 0 : 1; s <= SAMPLES_PER_CURVE; s += 1) {
                points.push(bezierPoint(curve, s / SAMPLES_PER_CURVE));
            }
        });
        const lengths = [0];
        for (let i = 1; i < points.length; i += 1) {
            lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
        }
        return { ...segment, points, lengths, total: lengths[lengths.length - 1] };
    });
    return lookup;
}

/** A point on the road at `progress` (0–100) with the unit normal to its left. */
export function pointAtProgress(progress) {
    const safe = Math.min(100, Math.max(0, Number(progress) || 0));
    const table = routeLookup();
    const segment = table.find((candidate, index) => (
        safe >= candidate.minProgress && (safe < candidate.maxProgress || index === table.length - 1)
    )) || table[table.length - 1];
    const local = (safe - segment.minProgress) / ((segment.maxProgress - segment.minProgress) || 1);
    const target = segment.total * Math.min(1, Math.max(0, local));
    let i = 1;
    while (i < segment.lengths.length - 1 && segment.lengths[i] < target) i += 1;
    const span = segment.lengths[i] - segment.lengths[i - 1] || 1;
    const t = (target - segment.lengths[i - 1]) / span;
    const a = segment.points[i - 1];
    const b = segment.points[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const size = Math.hypot(dx, dy) || 1;
    return {
        x: a[0] + dx * t,
        y: a[1] + dy * t,
        normalX: -dy / size,
        normalY: dx / size
    };
}

/** Lantern posts: beside the road, alternating sides, each with the share it marks. */
export function lanternPositions() {
    return LANTERN_STOPS.map((progress, index) => {
        const point = pointAtProgress(progress);
        const side = index % 2 === 0 ? 1 : -1;
        return {
            progress,
            x: round1(point.x + point.normalX * 30 * side),
            y: round1(point.y + point.normalY * 30 * side)
        };
    });
}

/** How many lanterns are lit once the road is explored up to `explored`. */
export function litLanternCount(explored) {
    const safe = Number(explored) || 0;
    return LANTERN_STOPS.filter((progress) => safe >= progress).length;
}

/**
 * Realms nobody has reached yet sleep under mist. A realm the leader is about
 * to reach is "waking" (the mist thins); a reached realm is awake.
 */
export const REALM_WAKING_LEAD = 8;
export function realmStates(explored) {
    const safe = Math.min(100, Math.max(0, Number(explored) || 0));
    return Object.fromEntries(QUEST_MAP_ZONES.map((zone) => {
        let stateName = 'asleep';
        if (zone.minPercent === 0 || safe >= zone.minPercent) stateName = 'awake';
        else if (safe >= zone.minPercent - REALM_WAKING_LEAD) stateName = 'waking';
        return [zone.id, stateName];
    }));
}

/** The furthest realm reached, for the leader's pennant. */
export function furthestRealm(explored) {
    const safe = Number(explored) || 0;
    return QUEST_MAP_ZONES.reduce((current, zone) => (safe >= zone.minPercent ? zone.id : current), 'bronze');
}

// What runs on each kind of machine. Lite keeps the world, the water, the
// banners and the day; full adds the small creatures, the realm weather,
// parallax and the diorama tilt. Hard caps keep a weak laptop smooth.
export const SCENE_TIERS = Object.freeze({
    lite: Object.freeze({ maxSprites: 14, parallax: false, tilt: 0 }),
    full: Object.freeze({ maxSprites: 64, parallax: true, tilt: 6 }),
    still: Object.freeze({ maxSprites: 14, parallax: false, tilt: 0 })
});

/** Which tier a map runs: reduced motion is always still, a slow machine lite. */
export function resolveSceneTier({ fx = 'full', reducedMotion = false } = {}) {
    if (reducedMotion) return 'still';
    return fx === 'lite' ? 'lite' : 'full';
}

/** Filters a sprite list down to what the tier runs, never more than its cap. */
export function scenePlan(tier, sprites = []) {
    const settings = SCENE_TIERS[tier] || SCENE_TIERS.lite;
    const allowed = sprites.filter((sprite) => tier === 'full' || sprite.tier === 'lite');
    return { ...settings, tier, sprites: allowed.slice(0, settings.maxSprites) };
}

/**
 * The season the land is painted in (Greece, northern hemisphere): fresh
 * blossom in spring, deep green in summer, gold and russet in autumn, frost
 * and snow-capped roofs in winter.
 */
export function seasonFor(time = Date.now()) {
    const month = new Date(time instanceof Date ? time.getTime() : Number(time)).getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
}

/**
 * How the painted land is lit for a sky (the app's shared sky scene: light =
 * dawn | day | golden | twilight | night, tone = fair | grey | rain | storm |
 * snow | fog | ice). The painter multiplies the land by `tint` at `tintAlpha`,
 * lays `glow` over it with screen from `glowFrom` (the sun's side), sets its
 * saturation and brightness, and lights the windows at `lights`.
 */
const LIGHT_GRADES = {
    dawn: { tint: '#ffcfc0', tintAlpha: 0.32, glow: '#ffb38a', glowAlpha: 0.22, glowFrom: 'left', saturate: 0.98, brightness: 1, lights: 0.25 },
    day: { tint: '#ffffff', tintAlpha: 0, glow: '#fff3cf', glowAlpha: 0.1, glowFrom: 'left', saturate: 1.04, brightness: 1.02, lights: 0 },
    golden: { tint: '#ffc78a', tintAlpha: 0.34, glow: '#ff9d4d', glowAlpha: 0.26, glowFrom: 'right', saturate: 1.06, brightness: 0.98, lights: 0.35 },
    twilight: { tint: '#7d6fc4', tintAlpha: 0.55, glow: '#ff8fb0', glowAlpha: 0.16, glowFrom: 'right', saturate: 0.82, brightness: 0.86, lights: 0.8 },
    night: { tint: '#33427f', tintAlpha: 0.74, glow: '#9fb4ff', glowAlpha: 0.08, glowFrom: 'top', saturate: 0.66, brightness: 0.82, lights: 1 }
};
const TONE_GRADES = {
    fair: { saturate: 1, brightness: 1, tint: null, tintAlpha: 0 },
    grey: { saturate: 0.78, brightness: 0.95, tint: '#aab6c6', tintAlpha: 0.22 },
    rain: { saturate: 0.7, brightness: 0.88, tint: '#8796ab', tintAlpha: 0.3 },
    storm: { saturate: 0.6, brightness: 0.76, tint: '#5c667a', tintAlpha: 0.4 },
    snow: { saturate: 0.7, brightness: 1.04, tint: '#dfe7f2', tintAlpha: 0.26 },
    fog: { saturate: 0.62, brightness: 1.02, tint: '#e6e9ee', tintAlpha: 0.32 },
    ice: { saturate: 0.68, brightness: 0.97, tint: '#c6d6ea', tintAlpha: 0.3 }
};
export function landGrade(light = 'day', tone = 'fair') {
    const l = LIGHT_GRADES[light] || LIGHT_GRADES.day;
    const t = TONE_GRADES[tone] || TONE_GRADES.fair;
    const fair = !t.tint;
    return {
        key: `${LIGHT_GRADES[light] ? light : 'day'}-${TONE_GRADES[tone] ? tone : 'fair'}`,
        saturate: Math.round(l.saturate * t.saturate * 100) / 100,
        brightness: Math.round(l.brightness * t.brightness * 100) / 100,
        tint: l.tint,
        tintAlpha: l.tintAlpha,
        weather: t.tint,
        weatherAlpha: t.tintAlpha,
        // Grey skies soften the sun's glow but never hide the windows.
        glow: l.glow,
        glowAlpha: Math.round(l.glowAlpha * (fair ? 1 : 0.35) * 100) / 100,
        glowFrom: l.glowFrom,
        lights: Math.min(1, l.lights + (fair ? 0 : light === 'day' ? 0.15 : 0.1))
    };
}

/** Morning / afternoon / evening / night for the sky (same rule as the Home greeting). */
export function dayPhase(now = Date.now(), solar = null) {
    const time = now instanceof Date ? now.getTime() : Number(now);
    const times = solar && Number.isFinite(solar.sunrise) && Number.isFinite(solar.sunset)
        ? solar
        : defaultSolarTimes(new Date(time));
    return resolveDayPart(time, times.sunrise, times.sunset);
}
