/**
 * Quest World art: the painted world and everything that moves on it.
 *
 * The land is a hand-finished painting (assets/team-quest-map/painted, baked by
 * tools/team-quest-map/bake_painted.py): one picture per season with the sky
 * cut out, so the app's live sky shows through, plus a night "lights" layer
 * (windows, lamps, the stair and the Portal) that the painter adds after dark.
 * This module is pure data: which pictures to load, and where the small living
 * pieces sit on the painting, in world units (1600 × 900, worldGeometry.mjs).
 */

import { PORTAL, lanternPositions, REALM_LANDMARKS } from './worldGeometry.mjs';

export const WORLD_SEED = 20261013;
/** Bump when the pictures change, so devices drop the old ones. */
export const ART_VERSION = 9;

const asset = (name) => new URL(`../../assets/team-quest-map/painted/${name}`, import.meta.url).href;

// Every file is spelled out so the bundler can see (and fingerprint) it.
const LAND = Object.freeze({
    autumn: { 1600: asset('land-autumn-1600.webp'), 2560: asset('land-autumn-2560.webp') },
    winter: { 1600: asset('land-winter-1600.webp'), 2560: asset('land-winter-2560.webp') },
    spring: { 1600: asset('land-spring-1600.webp'), 2560: asset('land-spring-2560.webp') },
    summer: { 1600: asset('land-summer-1600.webp'), 2560: asset('land-summer-2560.webp') }
});
const ISLETS = Object.freeze({
    autumn: [asset('islet-autumn-0.webp'), asset('islet-autumn-1.webp')],
    winter: [asset('islet-winter-0.webp'), asset('islet-winter-1.webp')],
    spring: [asset('islet-spring-0.webp'), asset('islet-spring-1.webp')],
    summer: [asset('islet-summer-0.webp'), asset('islet-summer-1.webp')]
});

/** Painted props shared by the sky, the realm mists and the scroll. */
export const PAINTED_PROPS = Object.freeze({
    clouds: Object.freeze([asset('cloud-0.webp'), asset('cloud-1.webp'), asset('cloud-2.webp'), asset('cloud-3.webp')]),
    // Each cloud's height as a share of its width, so a sized box never squashes it.
    cloudRatios: Object.freeze([0.442, 0.92, 0.637, 0.65]),
    seal: asset('seal.webp'),
    ribbon: asset('ribbon.webp'),
    sketch: asset('sketch-1280.webp'),
    lights: asset('lights-1600.webp'),
    sails: asset('sails.webp'),
    // The sky's visitors: a dragon (one wing beat in two frames), a balloon and a kite.
    dragon: Object.freeze([asset('dragon-up.webp'), asset('dragon-down.webp')]),
    balloon: asset('balloon.webp'),
    kite: asset('kite.webp')
});

export const SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);

/** The two floating islets lifted out of the painting (they bob gently). */
const ISLET_BOXES = Object.freeze([
    { x: 1220.9, y: 155.3, w: 51.7, h: 81.4 },
    { x: 1475.6, y: 251.4, w: 58.1, h: 85.5 }
]);

/**
 * The village windmills. Their sails were lifted out of the painting
 * (tools/team-quest-map/free_windmills.py) and turn on the hub here. `rest`
 * is the angle the painting had them at; the far windmill is seen from the
 * side, so its sails turn in a plane through its hub (a 2D matrix).
 */
export const WINDMILLS = Object.freeze([
    Object.freeze({ x: 313.1, y: 523.1, size: 115, rest: 26.4, plane: null }),
    Object.freeze({ x: 144.4, y: 738.1, size: 115, rest: 0, plane: Object.freeze([0.729, 0.444, -0.424, 1.035]) })
]);

// Spire and tower tops that fly a banner: the Golden Citadel and the castle on Silver Peaks.
const BANNERS = Object.freeze([
    [1146, 188, 'gold'], [1183, 256, 'crimson'], [1079, 290, 'crimson'], [1221, 298, 'gold'], [1275, 352, 'crimson'], [1038, 345, 'gold'],
    [630, 78, 'silver'], [550, 97, 'azure'], [685, 105, 'azure']
]);
const BANNER_COLOURS = { gold: ['#f6c343', '#b9771a'], crimson: ['#d8433b', '#8e1f26'], silver: ['#f2f6ff', '#8aa3c9'], azure: ['#3f7fd8', '#1d4690'] };
const BANNER = (kind) => {
    const [cloth, edge] = BANNER_COLOURS[kind];
    return `<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M1.6 27 V1.5" stroke="#5b3b1f" stroke-width="1.4" stroke-linecap="round"/><circle cx="1.6" cy="1.4" r="1.2" fill="#f3d27a"/></svg>`
        + `<span class="tq-sp__cloth"><svg viewBox="0 0 22 12" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 H22 L16 6 L22 12 H0 Z" fill="${cloth}" stroke="${edge}" stroke-width="1"/></svg></span>`;
};

// Where the lake is wide and calm enough for a fish to leap and rings to spread.
const RIPPLES = Object.freeze([[881, 851], [985, 782], [1099, 810], [764, 822]]);
const FISH = Object.freeze([[910, 812], [1040, 790]]);
// Meadows and gardens where butterflies wander on a fair day.
const MEADOWS = Object.freeze([[598, 612], [1262, 602], [236, 812]]);

const FISH_SVG = '<svg viewBox="0 0 30 14" aria-hidden="true"><path d="M2 7 Q10 0 20 5 L28 1 L26 7 L28 13 L20 9 Q10 14 2 7 Z" fill="#f2a24a" stroke="#9a5320" stroke-width="0.8"/><circle cx="7" cy="6" r="1" fill="#2b1a0e"/></svg>';
const BUTTERFLY = (a, b) => `<svg viewBox="0 0 20 16" aria-hidden="true"><path d="M10 8 C6 0 0 1 1 6 C2 9 7 9 10 8 Z M10 8 C7 10 3 14 5 15 C8 16 9 12 10 8 Z" fill="${a}" stroke="${b}" stroke-width="0.6"/><path d="M10 8 C14 0 20 1 19 6 C18 9 13 9 10 8 Z M10 8 C13 10 17 14 15 15 C12 16 11 12 10 8 Z" fill="${a}" stroke="${b}" stroke-width="0.6"/><path d="M10 4 V13" stroke="#3a2614" stroke-width="1.2" stroke-linecap="round"/></svg>`;
const EAGLE = '<svg viewBox="0 0 40 14" aria-hidden="true"><path d="M1 6 Q10 1 18 6 L20 8 L22 6 Q30 1 39 6 Q30 4 23 9 L20 12 L17 9 Q10 4 1 6 Z" fill="#3b2d24"/></svg>';

// A soft pool of each realm's colour over its land (shown once the realm is reached).
const AURAS = Object.freeze([
    { realm: 'bronze', x: 300, y: 640, w: 640, h: 420 },
    { realm: 'silver', x: 620, y: 230, w: 520, h: 420 },
    { realm: 'gold', x: 1150, y: 400, w: 520, h: 520 },
    { realm: 'crystal', x: 1400, y: 220, w: 420, h: 420 }
]);

// Chimney tops in the village, where the painted smoke rises from.
const CHIMNEYS = Object.freeze([[137, 565], [205, 542], [372, 532], [485, 567], [390, 780]]);

// Bright water, spread over the lake, the river and the stream (from the bake).
export const WATER_GLINTS = Object.freeze([
    [300, 759], [463, 799], [614, 825], [683, 838], [764, 820], [798, 766], [881, 851], [928, 573],
    [930, 791], [951, 639], [985, 782], [1005, 836], [1027, 670], [1034, 753], [1099, 810], [1155, 820],
    [637, 897], [717, 888], [776, 883], [946, 880], [993, 898], [1065, 884]
].map((point) => Object.freeze(point)));

// Where the light catches the amethyst crystals of the Portal's isle.
const CRYSTAL_GLINTS = Object.freeze([[1336, 76], [1470, 52], [1496, 128], [1352, 236], [1452, 250], [1244, 182], [1498, 286]]);

// The floating stair, step by step from its foot to the isle (lights run up it).
export const STAIR_STEPS = Object.freeze([
    [1360, 520], [1380, 484], [1391, 446], [1390, 408], [1376, 372], [1352, 338],
    [1328, 306], [1313, 270], [1312, 236], [1328, 208], [1352, 184]
].map((point) => Object.freeze(point)));

const SPARKLE = (colour) => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0 L11.6 8.4 L20 10 L11.6 11.6 L10 20 L8.4 11.6 L0 10 L8.4 8.4 Z" fill="${colour}"/></svg>`;
const BIRDS = '<svg viewBox="0 0 60 30" aria-hidden="true"><path d="M2 14 Q8 8 13 13 Q18 8 24 14" stroke="#2f3a52" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M26 6 Q31 1 35 5 Q39 1 44 6" stroke="#2f3a52" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M38 22 Q42 18 46 21 Q50 18 54 22" stroke="#2f3a52" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';
// Bats flitting round the citadel spires at night.
const BAT = '<svg viewBox="0 0 30 12" aria-hidden="true"><path d="M15 5 Q12 1 8 3 Q5 0 1 4 Q5 4 6 8 Q9 5 12 8 Q13 6 15 7 Q17 6 18 8 Q21 5 24 8 Q25 4 29 4 Q25 0 22 3 Q18 1 15 5 Z" fill="#20172a"/></svg>';

const spans = (count) => Array.from({ length: count }, () => '<span></span>').join('');

/**
 * Every moving piece in the world, in world units, with the tier it needs.
 * Lite pieces come first so the lite cap keeps the important ones. The sky
 * (clouds, rain, sun and moon) is not here: it follows the live weather.
 */
export function buildWorldSprites(season = 'autumn') {
    const sprites = [];
    // Everything runs on every machine except the few big, costly layers marked full.
    const push = (sprite) => sprites.push({ slot: 'mid', tier: 'lite', ...sprite });
    const islets = ISLETS[season] || ISLETS.autumn;

    // Each reached realm glows softly in its own colour, so the land reads as four realms.
    AURAS.forEach(({ realm, x, y, w, h }, i) => {
        push({ id: `aura-${realm}`, kind: 'aura', slot: 'mid', x: x - w / 2, y: y - h / 2, w, h, delay: -i * 2.3, html: '<span></span>' });
    });

    // The windmills turn first: the painting no longer has sails of its own.
    WINDMILLS.forEach((mill, i) => {
        const half = mill.size / 2;
        const plane = mill.plane ? ` style="transform:matrix(${mill.plane.join(',')},0,0)"` : '';
        push({ id: `sails-${i}`, kind: 'sails', tier: 'lite', x: mill.x - half, y: mill.y - half, w: mill.size, h: mill.size, delay: -i * 3.7,
            html: `<span class="tq-sp__plane"${plane}><span class="tq-sp__spin"><img src="${PAINTED_PROPS.sails}" alt="" draggable="false" decoding="async" style="transform:rotate(${mill.rest}deg)"></span></span>` });
    });

    // The islets drift in the sky and the great waterfall falls (the Portal's
    // vortex turns in the map's own Portal button, features/worldMap.js).
    ISLET_BOXES.forEach((box, i) => {
        push({ id: `islet-${i}`, kind: 'islet', slot: 'back', tier: 'lite', ...box, delay: -i * 2.6,
            html: `<img src="${islets[i]}" alt="" draggable="false" decoding="async">` });
    });
    push({ id: 'fall-great', kind: 'fall', tier: 'lite', x: 924, y: 362, w: 54, h: 118, html: '<span class="tq-sp__mask"><span class="tq-sp__flow"></span></span><span class="tq-sp__foam"></span><span class="tq-sp__spray"></span>' });
    WATER_GLINTS.slice(0, 6).forEach(([x, y], i) => {
        push({ id: `glint-${i}`, kind: 'glint', tier: 'lite', x: x - 8, y: y - 8, w: 16, h: 16, html: SPARKLE('#ffffff'), delay: -i * 0.53 });
    });
    CRYSTAL_GLINTS.slice(0, 3).forEach(([x, y], i) => {
        push({ id: `crystal-${i}`, kind: 'glint', tier: 'lite', x: x - 9, y: y - 9, w: 18, h: 18, html: SPARKLE(i % 2 ? '#c8f6ff' : '#f2d2ff'), delay: -i * 0.9 });
    });

    // Full: the rest of the life on the painting.
    push({ id: 'portal-rays', kind: 'portal-rays', x: PORTAL.x - 150, y: PORTAL.y - 150, w: 300, h: 300, html: '<span></span>' });
    push({ id: 'portal-motes', kind: 'motes', x: PORTAL.x - 100, y: PORTAL.y - 60, w: 200, h: 240, html: spans(6) });
    push({ id: 'stair', kind: 'stair', x: 1290, y: 160, w: 120, h: 380,
        html: STAIR_STEPS.map(([x, y], i) => `<span style="left:${(((x - 1290) / 120) * 100).toFixed(1)}%;top:${(((y - 160) / 380) * 100).toFixed(1)}%;--i:${i}"></span>`).join('') });
    CHIMNEYS.forEach(([x, y], i) => {
        push({ id: `smoke-${i}`, kind: 'smoke', x: x - 12, y: y - 58, w: 24, h: 60, html: spans(3), delay: -i * 1.3 });
    });
    push({ id: 'fountain', kind: 'fountain', x: 1260, y: 522, w: 20, h: 22, html: spans(3) });
    WATER_GLINTS.slice(6).forEach(([x, y], i) => {
        push({ id: `glint-${i + 6}`, kind: 'glint', tier: 'full', x: x - 7, y: y - 7, w: 14, h: 14, html: SPARKLE('#ffffff'), delay: -(i + 6) * 0.47 });
    });
    CRYSTAL_GLINTS.slice(3).forEach(([x, y], i) => {
        push({ id: `crystal-${i + 3}`, kind: 'glint', tier: 'full', x: x - 8, y: y - 8, w: 16, h: 16, html: SPARKLE(i % 2 ? '#c8f6ff' : '#f2d2ff'), delay: -(i + 3) * 0.7 });
    });
    push({ id: 'sunbeams', kind: 'sunbeams', tier: 'full', slot: 'mid', x: 0, y: 0, w: 1600, h: 900, html: spans(4) });
    push({ id: 'birds-0', kind: 'birds', slot: 'back', x: 240, y: 170, w: 60, h: 30, html: `<span class="tq-sp__flap">${BIRDS}</span>` });
    push({ id: 'birds-1', kind: 'birds', slot: 'back', x: 860, y: 120, w: 44, h: 22, html: `<span class="tq-sp__flap">${BIRDS}</span>`, delay: -11 });
    push({ id: 'fireflies', kind: 'fireflies', x: 40, y: 480, w: 1000, h: 380, html: spans(10) });

    // Banners on the citadel spires and the mountain castle, streaming with the wind.
    BANNERS.forEach(([x, y, kind], i) => {
        push({ id: `banner-${i}`, kind: 'banner', x: x - 1.6, y: y - 25, w: 22, h: 26, delay: -i * 0.37, html: BANNER(kind) });
    });
    // The season in the air: falling leaves, blossom, summer seeds or winter sparkles.
    push({ id: 'drift', kind: 'drift', x: 0, y: 140, w: 1600, h: 760, html: spans(9) });
    // Rings on the lake, now and then a leaping fish, a little rainbow in the waterfall's spray.
    RIPPLES.forEach(([x, y], i) => {
        push({ id: `ripple-${i}`, kind: 'ripple', x: x - 16, y: y - 6, w: 32, h: 12, delay: -i * 1.9, html: spans(2) });
    });
    FISH.forEach(([x, y], i) => {
        push({ id: `fish-${i}`, kind: 'fish', x: x - 20, y: y - 22, w: 40, h: 28, delay: -i * 6.5, flip: i % 2 === 1,
            html: `<span class="tq-sp__leap">${FISH_SVG}</span><span class="tq-sp__splash"></span><span class="tq-sp__splash"></span>` });
    });
    push({ id: 'fall-rainbow', kind: 'fall-rainbow', x: 912, y: 438, w: 78, h: 44, html: '<span></span>' });
    // Butterflies in the meadows by day, and an eagle circling the castle on Silver Peaks.
    MEADOWS.forEach(([x, y], i) => {
        const [a, b] = [['#ffb547', '#8a4a10'], ['#8fd3ff', '#2d5f8a'], ['#ffd9f2', '#a0507a']][i % 3];
        push({ id: `butterfly-${i}`, kind: 'butterfly', x: x - 40, y: y - 26, w: 80, h: 52, delay: -i * 4.1,
            html: `<span class="tq-sp__wander"><span class="tq-sp__wings">${BUTTERFLY(a, b)}</span></span>` });
    });
    push({ id: 'eagle', kind: 'eagle', slot: 'back', x: 520, y: 14, w: 230, h: 70,
        html: `<span class="tq-sp__orbit"><span class="tq-sp__soar">${EAGLE}</span></span>` });

    // The sky's visitors: a dragon crossing now and then, a balloon on calm fair
    // days, a kite when the wind is up; bats round the spires and the northern
    // lights over the Crystal Realm at night (quest_world.css picks by the sky).
    push({ id: 'dragon', kind: 'dragon', slot: 'back', x: 0, y: 36, w: 1600, h: 150,
        html: `<span class="tq-sp__glide"><span class="tq-sp__bob"><span class="tq-sp__frame"><img src="${PAINTED_PROPS.dragon[0]}" alt="" draggable="false" decoding="async"></span><span class="tq-sp__frame"><img src="${PAINTED_PROPS.dragon[1]}" alt="" draggable="false" decoding="async"></span></span></span>` });
    push({ id: 'balloon', kind: 'balloon', slot: 'back', x: 30, y: 150, w: 720, h: 200,
        html: `<span class="tq-sp__drift-x"><span class="tq-sp__bob"><img src="${PAINTED_PROPS.balloon}" alt="" draggable="false" decoding="async"></span></span>` });
    push({ id: 'kite', kind: 'kite', slot: 'back', x: 300, y: 140, w: 70, h: 220, html: `<span class="tq-sp__string"></span><span class="tq-sp__sway"><img src="${PAINTED_PROPS.kite}" alt="" draggable="false" decoding="async"></span>` });
    push({ id: 'bats', kind: 'bats', x: 1010, y: 120, w: 300, h: 170,
        html: [0, 1, 2].map((i) => `<span class="tq-sp__bat" style="--i:${i}"><span class="tq-sp__flit">${BAT}</span></span>`).join('') });
    push({ id: 'aurora', kind: 'aurora', slot: 'back', x: 1120, y: -20, w: 480, h: 260, html: spans(3) });

    return [...sprites.filter((sprite) => sprite.tier === 'lite'), ...sprites.filter((sprite) => sprite.tier !== 'lite')];
}

/**
 * Clouds that lie over a realm nobody has reached yet, made of the painted
 * clouds. Each puff is [x, y, width, cloud] as shares of the box (the cloud is
 * which painted cloud); they part sideways when the realm wakes.
 */
export const REALM_MISTS = Object.freeze([
    { realm: 'silver', x: 380, y: 40, w: 560, h: 440, blobs: [[0.2, 0.46, 0.38, 0], [0.5, 0.2, 0.4, 1], [0.8, 0.42, 0.36, 2], [0.36, 0.76, 0.36, 3], [0.66, 0.74, 0.4, 0]] },
    { realm: 'gold', x: 990, y: 170, w: 360, h: 430, blobs: [[0.32, 0.22, 0.5, 2], [0.72, 0.3, 0.46, 1], [0.4, 0.62, 0.62, 0], [0.76, 0.8, 0.46, 3]] },
    { realm: 'crystal', x: 1210, y: 0, w: 360, h: 540, blobs: [[0.4, 0.16, 0.56, 1], [0.78, 0.28, 0.42, 2], [0.36, 0.5, 0.5, 0], [0.62, 0.78, 0.5, 3]] }
].map((mist) => Object.freeze(mist)));

/** The pictures for a season (the land at a bake width, the night lights, the islets). */
export function paintingFor(season = 'autumn', width = 1600) {
    const land = LAND[season] || LAND.autumn;
    return { land: width > 1600 ? land[2560] : land[1600], lights: PAINTED_PROPS.lights };
}

/** Everything the scene needs for a season. */
export function buildWorldArt(seed = WORLD_SEED, season = 'autumn') {
    return {
        season: LAND[season] ? season : 'autumn',
        version: ART_VERSION,
        seed,
        sprites: buildWorldSprites(season),
        landmarks: REALM_LANDMARKS,
        lanterns: lanternPositions(),
        mists: REALM_MISTS
    };
}
