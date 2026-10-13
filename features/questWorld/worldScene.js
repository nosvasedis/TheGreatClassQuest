/**
 * Quest World scene: mounts the living world into the Team Quest map.
 *
 * Loaded lazily by features/worldMap.js.
 * - The land is a finished painting per season (worldArt.mjs), drawn once into
 *   a canvas by worldPainter.js; the light of the moment is a cheap grade of
 *   it, with the night lights (windows, lamps, the stair) added after dusk.
 * - The sky is the app's own sky: the shared scene from skyWeatherStage.js
 *   (live weather + sun times, the same one the header, Home card and
 *   projector paint) and its palette tokens on <html> (--wx-*). The sun walks
 *   its real arc, the moon shows tonight's real phase (utils/dayCycle.mjs),
 *   clouds, rain, snow, fog, lightning and rainbows follow the reading, and the
 *   wind sets the drift and the banners.
 * - Everything that moves is a small sprite animated with transform/opacity
 *   (quest_world.css). Nothing here draws per frame; the only per-frame-ish
 *   script is the throttled pointer parallax.
 *
 * The scene outlives the map controller: live star updates re-create the
 * controller but keep this world. It tidies itself away once its map leaves.
 */

import '../../styles/quest_world.css';
import { PAINTED_PROPS, WORLD_SEED, buildWorldArt } from './worldArt.mjs';
import { leagueTouchKey, leagueTouchSprites } from './leagueTouches.mjs';
import { bakeWidthFor, bakeWorld, gradeInto } from './worldPainter.js';
import {
    WORLD_H,
    WORLD_W,
    SCENE_TIERS,
    furthestRealm,
    landGrade,
    litLanternCount,
    realmStates,
    scenePlan,
    seasonFor
} from './worldGeometry.mjs';
import { QUEST_MAP_ZONES } from '../questMapZones.mjs';
import { CAMERA_LIMITS, cameraOn, clampCamera, zoomAround } from './mapJourney.mjs';
import { applySkyScene, computeSkyScene, getSkyScene, getLastSkyReading } from '../skyWeatherStage.js';
import { BOLT_PATHS } from '../skyWeatherArt.js';
import { seededRandom } from '../skyWeather.mjs';
import { currentLightSpan, moonLitPath, moonPhase, moonPhaseName } from '../../utils/dayCycle.mjs';
import { getSolarTimes } from '../../utils.js';

const artBySeason = new Map();
function getArt(season) {
    if (!artBySeason.has(season)) artBySeason.set(season, buildWorldArt(WORLD_SEED, season));
    return artBySeason.get(season);
}

/** Loaded day pictures shared by every map on the page (keyed by season + size). */
const bakes = new Map();
function getBake(art, width) {
    const key = `${art.season}:${width}`;
    if (!bakes.has(key)) {
        bakes.set(key, bakeWorld(art, { width }).catch((error) => {
            bakes.delete(key);
            throw error;
        }));
    }
    return bakes.get(key);
}

const pct = (value, total) => `${((value / total) * 100).toFixed(3)}%`;
const boxStyle = ({ x, y, w, h }) => `left:${pct(x, WORLD_W)};top:${pct(y, WORLD_H)};width:${pct(w, WORLD_W)};height:${pct(h, WORLD_H)}`;

function spriteHtml(sprite) {
    const style = `${boxStyle(sprite)}${sprite.delay ? `;--d:${sprite.delay}s` : ''}`;
    return `<div class="tq-sp tq-sp--${sprite.kind}${sprite.flip ? ' is-flipped' : ''}" data-sprite="${sprite.id}" style="${style}" aria-hidden="true">${sprite.html}</div>`;
}

const cloudImg = (index) => `<img src="${PAINTED_PROPS.clouds[index % PAINTED_PROPS.clouds.length]}" alt="" draggable="false" decoding="async">`;

/** A realm nobody has reached hides under painted clouds that part when the first party arrives. */
function mistHtml(mist) {
    const blobs = mist.blobs.map(([x, y, w, cloud], i) => (
        `<span class="tq-mist__puff" style="left:${(x * 100).toFixed(1)}%;top:${(y * 100).toFixed(1)}%;width:${(w * 100).toFixed(1)}%;--part:${x < 0.5 ? -1 : 1};--i:${i}">${cloudImg(cloud)}</span>`
    )).join('');
    return `<div class="tq-mist" data-realm="${mist.realm}" data-state="asleep" style="${boxStyle(mist)}" aria-hidden="true">${blobs}</div>`;
}

/** A road lantern: a little flame on the roadside that kindles once a party has passed it. */
function lanternHtml(lantern, index) {
    return `<div class="tq-lantern" data-lantern="${index}" data-progress="${lantern.progress}" style="${boxStyle({ x: lantern.x - 12, y: lantern.y - 22, w: 24, h: 24 })}" aria-hidden="true">`
        + '<span class="tq-lantern__glow"></span><span class="tq-lantern__flame"></span></div>';
}

// ── The sky ──────────────────────────────────────────────────────────────

/** How many clouds the map's sky shows for a cover. */
export function mapCloudCount(cover, tier) {
    const c = Math.min(100, Math.max(0, Number(cover) || 0)) / 100;
    const count = Math.round(2 + c * 9);
    return tier === 'full' ? count : Math.max(1, Math.round(count * 0.5));
}

// Which painted cloud each weather leans on: wide flat banks when it is grey,
// tall heaps before a storm, small fair-weather puffs on a bright day.
const CLOUDS_BY_TONE = {
    fair: [3, 2, 0, 3, 1],
    grey: [0, 2, 0, 1],
    rain: [0, 1, 0, 2],
    storm: [1, 0, 1, 2],
    snow: [0, 2, 0],
    fog: [0, 0, 3],
    ice: [0, 2, 0]
};

function cloudsHtml(scene, tier) {
    const count = mapCloudCount(scene.cover, tier);
    const shapes = CLOUDS_BY_TONE[scene.tone] || CLOUDS_BY_TONE.fair;
    const rng = seededRandom(31 + count);
    const wind = scene.wind || { factor: 1, dir: 1 };
    let html = '';
    for (let i = 0; i < count; i += 1) {
        const cloud = shapes[i % shapes.length];
        const depth = rng();
        const width = 8 + depth * 10 + (cloud === 0 ? 5 : 0);
        const top = rng() * 24 + (1 - depth) * 3 - 2;
        const duration = Math.round((240 - depth * 100) / Math.max(0.5, wind.factor));
        const delay = -Math.round(rng() * duration);
        html += `<div class="tq-cloud${depth < 0.35 ? ' is-far' : ''}" style="top:${top.toFixed(1)}%;--cw:${width.toFixed(1)}%;--cd:${duration}s;--cdl:${delay}s;--ca:${(0.78 + depth * 0.22).toFixed(2)}">${cloudImg(cloud)}</div>`;
    }
    return html;
}

function moonSvg(phase) {
    const lit = moonLitPath(phase, 46, 50, 50);
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
            <radialGradient id="tqMoonLit" cx="0.4" cy="0.38" r="0.7"><stop offset="0" stop-color="#fffdf2"/><stop offset="0.7" stop-color="#f1ead0"/><stop offset="1" stop-color="#d9cfae"/></radialGradient>
            <clipPath id="tqMoonClip"><path d="${lit || 'M0 0'}"/></clipPath>
        </defs>
        <circle cx="50" cy="50" r="46" fill="#2b3566" opacity="0.55"/>
        <g clip-path="url(#tqMoonClip)">
            <circle cx="50" cy="50" r="46" fill="url(#tqMoonLit)"/>
            <circle cx="36" cy="34" r="8" fill="#d8ceb0" opacity="0.7"/><circle cx="60" cy="58" r="11" fill="#d8ceb0" opacity="0.55"/>
            <circle cx="64" cy="30" r="5" fill="#d8ceb0" opacity="0.6"/><circle cx="40" cy="66" r="6" fill="#d8ceb0" opacity="0.5"/>
            <circle cx="74" cy="46" r="4" fill="#d8ceb0" opacity="0.55"/>
        </g>
    </svg>`;
}

/** Where the sun or moon sits on its arc (share of the frame), from the real times. */
export function skyBodyPosition(progress) {
    const p = Math.min(1, Math.max(0, Number(progress) || 0));
    return { x: 6 + p * 88, y: 30 - Math.sin(p * Math.PI) * 25 };
}

/**
 * Mounts (or finds) the world in a map root.
 * @param {HTMLElement} root  the `[data-living-quest-map]` element
 * @param {{ tier: 'full'|'lite'|'still' }} options
 */
export function mountQuestWorld(root, { tier = 'full' } = {}) {
    const world = root.querySelector('[data-quest-world]');
    const front = root.querySelector('[data-quest-world-front]');
    const stage = root.querySelector('[data-quest-stage]');
    if (!world || !front || !stage) return null;
    if (world.__questScene && !world.__questScene.destroyed) {
        world.__questScene.setTier(tier);
        return world.__questScene;
    }

    const season = seasonFor(Date.now());
    const art = getArt(season);
    let currentTier = tier;
    let paused = false;
    let destroyed = false;
    let explored = 0;
    let leader = null;
    let sky = null;
    let gradeKey = '';
    let bake = null;
    const timers = new Set();
    const later = (fn, ms) => {
        const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
        timers.add(id);
        return id;
    };

    world.dataset.season = season;
    world.innerHTML = `
        <div class="tq-world__depth tq-world__depth--sky">
            <div class="tq-sky"></div>
            <div class="tq-sky__stars"><span></span><span></span></div>
            <div class="tq-sky__shooting"><span></span></div>
            <div class="tq-sky__rays"></div>
            <div class="tq-sky__sun"><span class="tq-sky__sun-glow"></span><span class="tq-sky__sun-disc"></span></div>
            <div class="tq-sky__moon" role="img"><span class="tq-sky__moon-glow"></span><span class="tq-sky__moon-disc"></span></div>
            <div class="tq-sky__rainbow"></div>
            <div class="tq-sky__clouds"></div>
        </div>
        <div class="tq-world__depth tq-world__depth--far"><div class="tq-world__sprites" data-sprites="back"></div></div>
        <div class="tq-world__paint tq-world__mid" data-layer="mid"></div>
        <div class="tq-world__sprites" data-sprites="mid"></div>
        <div class="tq-cloud-shadows"><span></span><span></span><span></span></div>
        <div class="tq-world__mists">${art.mists.map(mistHtml).join('')}</div>
        <div class="tq-world__sprites tq-world__league" data-sprites="league-back"></div>
        <div class="tq-world__sprites tq-world__league" data-sprites="league"></div>
        <div class="tq-world__lanterns">${art.lanterns.map(lanternHtml).join('')}</div>
        <div class="tq-world__marks">
            <div class="tq-portal-beam" aria-hidden="true"><span></span></div>
            <div class="tq-pennant" hidden aria-hidden="true">
                <span class="tq-pennant__pole"></span>
                <span class="tq-pennant__cloth"><span class="tq-pennant__logo"></span></span>
            </div>
        </div>`;
    front.innerHTML = `
        <div class="tq-weather">
            <div class="tq-weather__fog"><span></span><span></span><span></span></div>
            <div class="tq-weather__rain"><span></span><span></span></div>
            <div class="tq-weather__snow"><span></span><span></span><span></span></div>
            <div class="tq-weather__splash"><span></span><span></span><span></span><span></span><span></span></div>
            <div class="tq-weather__bolt"><svg viewBox="0 0 60 160" aria-hidden="true"><path d=""/></svg></div>
            <div class="tq-weather__flash"></div>
        </div>
        <div class="tq-world__vignette"></div>`;

    const landSlot = world.querySelector('[data-layer="mid"]');

    // ── The painted land ──────────────────────────────────────────────────
    const gradeLayers = ({ fade = true } = {}) => {
        if (!bake || !sky) return;
        const grade = landGrade(sky.light, sky.tone);
        if (grade.key === gradeKey) return;
        gradeKey = grade.key;
        const crossfade = fade && currentTier === 'full' && !paused;
        const canvas = document.createElement('canvas');
        canvas.width = bake.width;
        canvas.height = bake.height;
        canvas.className = 'tq-world__canvas';
        gradeInto(canvas, bake.land, grade, { lights: bake.lights });
        const old = [...landSlot.children];
        if (!crossfade || !old.length) {
            landSlot.replaceChildren(canvas);
            return;
        }
        canvas.classList.add('is-entering');
        landSlot.appendChild(canvas);
        requestAnimationFrame(() => requestAnimationFrame(() => canvas.classList.remove('is-entering')));
        later(() => old.forEach((el) => el.remove()), 1700);
    };

    const frameWidth = () => root.querySelector('.tq-living-map__frame')?.clientWidth || root.clientWidth || 1200;
    const bakeWidth = bakeWidthFor(frameWidth(), { dpr: window.devicePixelRatio || 1, lite: currentTier !== 'full' });
    const paintStarted = performance.now();
    const ready = getBake(art, bakeWidth).then((pictures) => {
        if (destroyed) return;
        bake = pictures;
        // For support: which picture the land drew and how long it took to arrive.
        world.dataset.paint = `${pictures.width}:${Math.round(performance.now() - paintStarted)}ms`;
        gradeLayers({ fade: false });
        world.classList.add('is-ready');
        front.classList.add('is-ready');
    }).catch((error) => {
        console.warn('Quest World could not paint the land.', error);
        world.classList.add('is-ready', 'is-unpainted');
        front.classList.add('is-ready');
    });

    // ── Sprites, by tier ──────────────────────────────────────────────────
    const renderSprites = () => {
        const plan = scenePlan(currentTier, art.sprites);
        const html = { back: '', mid: '' };
        plan.sprites.forEach((sprite) => { html[sprite.slot] += spriteHtml(sprite); });
        world.querySelector('[data-sprites="back"]').innerHTML = html.back;
        world.querySelector('[data-sprites="mid"]').innerHTML = html.mid;
        world.dataset.tier = currentTier;
        front.dataset.tier = currentTier;
    };
    renderSprites();

    // ── The league's own touches (leagueTouches.mjs) ─────────────────────
    let leagueKey = '';
    const renderLeague = (next) => {
        const key = leagueTouchKey(next);
        if (key === leagueKey) return;
        leagueKey = key;
        const html = { back: '', mid: '' };
        leagueTouchSprites(key).forEach((sprite) => { html[sprite.slot] += spriteHtml(sprite); });
        world.querySelector('[data-sprites="league-back"]').innerHTML = html.back;
        world.querySelector('[data-sprites="league"]').innerHTML = html.mid;
        if (key) world.dataset.league = key;
        else delete world.dataset.league;
    };

    // ── The sky: the app's live scene ────────────────────────────────────
    const sunEl = world.querySelector('.tq-sky__sun');
    const moonEl = world.querySelector('.tq-sky__moon');
    const raysEl = world.querySelector('.tq-sky__rays');
    const cloudsEl = world.querySelector('.tq-sky__clouds');
    let cloudsKey = '';
    let moonPhaseKey = -1;
    let skyClock = null;

    const placeSkyBodies = () => {
        if (!sky) return;
        const clock = skyClock || { now: Date.now(), ...getSolarTimes() };
        const { now, sunrise, sunset } = clock;
        const span = currentLightSpan(now, sunrise, sunset);
        const body = skyBodyPosition(span.progress);
        const target = span.isDay ? sunEl : moonEl;
        target.style.left = `${body.x.toFixed(2)}%`;
        target.style.top = `${body.y.toFixed(2)}%`;
        raysEl.style.left = sunEl.style.left;
        raysEl.style.top = sunEl.style.top;
        const phase = moonPhase(now);
        const phaseKey = Math.round(phase * 200);
        if (phaseKey !== moonPhaseKey) {
            moonPhaseKey = phaseKey;
            moonEl.querySelector('.tq-sky__moon-disc').innerHTML = moonSvg(phase);
            moonEl.setAttribute('aria-label', moonPhaseName(phase));
        }
    };

    const applySky = (scene) => {
        if (!scene || destroyed) return;
        sky = scene;
        const d = world.dataset;
        d.light = scene.light;
        d.tone = scene.tone;
        d.wx = scene.condition;
        d.intensity = scene.intensity || 'normal';
        d.night = scene.isNight ? '1' : '0';
        root.dataset.night = d.night;
        d.sun = scene.sun ? '1' : '0';
        d.moon = scene.moon ? '1' : '0';
        d.stars = !scene.stars ? '0' : scene.shootingStars ? '2' : '1';
        d.rainbow = scene.rainbow ? '1' : '0';
        d.wind = scene.wind?.level || 'calm';
        d.windDir = String(scene.wind?.dir || 1);
        Object.assign(front.dataset, {
            light: scene.light,
            tone: scene.tone,
            wx: scene.condition,
            intensity: scene.intensity || 'normal',
            precip: scene.precip || 'none',
            fog: scene.fog ? '1' : '0',
            night: scene.isNight ? '1' : '0'
        });
        root.style.setProperty('--tq-wind', String(scene.wind?.factor || 1));
        root.style.setProperty('--tq-wind-dir', String(scene.wind?.dir || 1));
        const key = `${scene.tone}:${mapCloudCount(scene.cover, currentTier)}:${Math.round((scene.wind?.factor || 1) * 4)}:${scene.wind?.dir || 1}`;
        if (key !== cloudsKey) {
            cloudsKey = key;
            cloudsEl.innerHTML = cloudsHtml(scene, currentTier);
        }
        placeSkyBodies();
        gradeLayers();
        setLightning(Boolean(scene.lightning) && currentTier !== 'still');
    };

    const initialScene = () => {
        const existing = getSkyScene();
        if (existing) return existing;
        // The app paints its sky at start-up; if it has not yet, paint it the way
        // the app does without a reading (the same fallback the header uses).
        const scene = computeSkyScene(getLastSkyReading(), { now: Date.now(), ...getSolarTimes() });
        applySkyScene(scene);
        return getSkyScene() || scene;
    };

    // ── Lightning (storms) ───────────────────────────────────────────────
    let lightningTimer = 0;
    const boltWrap = front.querySelector('.tq-weather__bolt');
    const strike = () => {
        lightningTimer = 0;
        if (destroyed || !sky?.lightning) return;
        if (!paused) {
            boltWrap.querySelector('path').setAttribute('d', BOLT_PATHS[Math.floor(Math.random() * BOLT_PATHS.length)]);
            boltWrap.style.left = `${(14 + Math.random() * 64).toFixed(1)}%`;
            front.classList.remove('is-striking');
            void front.offsetWidth;
            front.classList.add('is-striking');
        }
        lightningTimer = later(strike, 6500 + Math.random() * 9000);
    };
    const setLightning = (on) => {
        if (on && !lightningTimer) lightningTimer = later(strike, 2000 + Math.random() * 3000);
        if (!on && lightningTimer) {
            clearTimeout(lightningTimer);
            timers.delete(lightningTimer);
            lightningTimer = 0;
        }
    };

    // ── Explored road: mists lift, lanterns light, the leader's pennant ───
    const mists = [...world.querySelectorAll('.tq-mist')];
    const lanterns = [...world.querySelectorAll('.tq-lantern')];
    const pennant = world.querySelector('.tq-pennant');

    const placePennant = () => {
        if (!leader) { pennant.hidden = true; return; }
        const realm = furthestRealm(explored);
        const spot = art.landmarks[realm];
        pennant.hidden = false;
        pennant.dataset.realm = realm;
        pennant.style.cssText = boxStyle({ x: spot.x - 1.5, y: spot.y - 58, w: 46, h: 58 });
        pennant.querySelector('.tq-pennant__logo').textContent = leader.logo || '★';
        pennant.title = leader.name ? `${leader.name} leads the quest` : '';
    };

    const setExplored = (value, { animate = false } = {}) => {
        const previous = explored;
        explored = Math.min(100, Math.max(0, Number(value) || 0));
        const states = realmStates(explored);
        mists.forEach((mist) => { mist.dataset.state = states[mist.dataset.realm] || 'awake'; });
        const lit = litLanternCount(explored);
        const wasLit = litLanternCount(previous);
        lanterns.forEach((lantern, index) => {
            const on = index < lit;
            const step = Math.max(0, index - wasLit);
            lantern.style.transitionDelay = animate && on && index >= wasLit ? `${step * 160}ms` : '0ms';
            lantern.classList.toggle('is-lit', on);
        });
        // The Portal sends a beam of light into the sky once a party arrives.
        world.classList.toggle('is-portal-open', explored >= 100);
        placePennant();
    };

    const celebrateRealm = (progress) => {
        const zone = QUEST_MAP_ZONES.find((candidate) => candidate.minPercent === Number(progress));
        if (!zone) return;
        if (explored < zone.minPercent) setExplored(zone.minPercent, { animate: true });
        if (currentTier !== 'full') return;
        const spot = art.landmarks[zone.id];
        const burst = document.createElement('div');
        burst.className = `tq-burst tq-burst--${zone.id}`;
        burst.setAttribute('aria-hidden', 'true');
        burst.style.cssText = boxStyle({ x: spot.x - 70, y: spot.y - 40, w: 140, h: 140 });
        burst.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><i></i>';
        world.querySelector('.tq-world__marks').appendChild(burst);
        later(() => burst.remove(), 2200);
    };

    // ── The diorama: tilt, pointer parallax and the camera ───────────────
    // The stage is one transform from its top-left corner:
    //   translate(t) · [about the centre: rotateX(tilt) · scale(s)]
    // At rest it leans back (tilt) and sways with the pointer (parallax). The
    // camera zooms and pans it (tilt off, so pointer maths stay exact). Both
    // write the same list of functions, so moving between them interpolates
    // smoothly on the compositor.
    const depthEls = {
        sky: world.querySelector('.tq-world__depth--sky'),
        far: world.querySelector('.tq-world__depth--far')
    };
    const DEPTH = { sky: 0.12, far: 0.36, stage: 0.6 };
    const SWAY_X = 18;
    const SWAY_Y = 8;
    // The pointer target is written a few times a second; a CSS transition on
    // the layers glides between targets on the compositor (quest_world.css),
    // so the main thread does almost nothing while the mouse moves.
    const PARALLAX_STEP_MS = 110;
    const CAMERA_MS = { fly: 860, wheel: 200, coast: 560, drag: 0 };
    const pointer = { x: 0, y: 0 };
    let parallaxTimer = 0;
    let frameRect = null;
    let camera = { x: 0, y: 0, zoom: 1 };
    // Set when the camera moved to show a party card, so closing the card takes it home again.
    let cameraFocus = false;
    let settleTimer = 0;
    let sharpening = null;

    const settings = () => SCENE_TIERS[currentTier] || SCENE_TIERS.lite;
    const tiltDeg = () => Number(root.dataset.tilt) || 0;
    const stageSize = () => ({ width: stage.clientWidth || 1, height: stage.clientHeight || 1 });
    const maxZoom = () => (currentTier === 'full' ? CAMERA_LIMITS.max : CAMERA_LIMITS.liteMax);
    const zoomed = () => camera.zoom > 1.001;

    const writeStage = () => {
        const { width, height } = stageSize();
        const cx = width * 0.5;
        const cy = height * 0.55;
        const tilt = zoomed() ? 0 : tiltDeg();
        const { parallax } = settings();
        root.classList.toggle('is-zoomed', zoomed());
        root.style.setProperty('--tq-cam-zoom', camera.zoom.toFixed(3));
        root.style.setProperty('--tq-counter', (1 / camera.zoom ** 0.72).toFixed(3));
        if (!zoomed() && !tilt && !parallax) {
            stage.style.transform = '';
            Object.values(depthEls).forEach((el) => { el.style.transform = ''; });
            return;
        }
        let tx;
        let ty;
        let scale;
        if (zoomed()) {
            scale = camera.zoom;
            tx = camera.x - cx * (1 - scale);
            ty = camera.y - cy * (1 - scale);
        } else {
            scale = tilt ? 1.05 : 1.02;
            tx = -SWAY_X * DEPTH.stage * pointer.x;
            ty = -SWAY_Y * DEPTH.stage * pointer.y;
        }
        stage.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) rotateX(${tilt}deg) scale(${scale.toFixed(4)}) translate(${(-cx).toFixed(1)}px, ${(-cy).toFixed(1)}px)`;
        Object.entries(depthEls).forEach(([layer, el]) => {
            if (zoomed() || !parallax) { el.style.transform = ''; return; }
            const k = DEPTH[layer] - DEPTH.stage;
            el.style.transform = `translate3d(${(-SWAY_X * k * pointer.x).toFixed(2)}px, ${(-SWAY_Y * k * pointer.y).toFixed(2)}px, 0)`;
        });
    };

    const flushParallax = () => {
        parallaxTimer = 0;
        if (destroyed || paused || zoomed()) return;
        writeStage();
    };
    const queueParallax = () => {
        if (!parallaxTimer && settings().parallax && !zoomed()) parallaxTimer = setTimeout(flushParallax, PARALLAX_STEP_MS);
    };

    /** A closer look loads the big picture of the land (once), so it stays sharp. */
    const sharpen = () => {
        if (sharpening || !bake || bake.width >= 2560) return;
        if (currentTier === 'still' || (currentTier === 'lite' && camera.zoom < 1.5)) return;
        sharpening = getBake(art, 2560).then((pictures) => {
            if (destroyed) return;
            bake = pictures;
            world.dataset.paint = `${pictures.width}:zoom`;
            gradeKey = '';
            gradeLayers({ fade: false });
        }).catch(() => { sharpening = null; });
    };

    const announceCamera = (phase) => {
        root.dispatchEvent(new CustomEvent('tq:camera', { detail: { phase, camera: { ...camera } } }));
    };

    /** Moves the camera; `mode` picks the glide (fly, wheel, coast) or none (drag). */
    const setCamera = (next, mode = 'fly') => {
        const { width, height } = stageSize();
        const target = clampCamera(next, width, height, maxZoom());
        const still = currentTier === 'still' || mode === 'drag';
        const duration = still ? 0 : CAMERA_MS[mode] ?? CAMERA_MS.fly;
        camera = target.zoom <= 1.001 ? { x: 0, y: 0, zoom: 1 } : target;
        if (zoomed()) {
            clearTimeout(parallaxTimer);
            parallaxTimer = 0;
            pointer.x = 0;
            pointer.y = 0;
        }
        stage.dataset.cam = still ? 'drag' : mode;
        root.classList.add('is-cam-moving');
        writeStage();
        announceCamera('move');
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
            if (destroyed) return;
            // Dropping the layer hint lets the browser redraw the stage sharp at its new size.
            root.classList.remove('is-cam-moving');
            if (!zoomed()) delete stage.dataset.cam;
            announceCamera('settled');
            if (zoomed()) sharpen();
        }, duration + 60);
        return { ...camera };
    };

    const listeners = new AbortController();
    root.addEventListener('pointerenter', () => {
        frameRect = root.getBoundingClientRect();
    }, { passive: true, signal: listeners.signal });
    root.addEventListener('pointermove', (event) => {
        if (event.pointerType !== 'mouse' || !settings().parallax || zoomed()) return;
        frameRect ||= root.getBoundingClientRect();
        if (!frameRect.width) return;
        pointer.x = Math.max(-1, Math.min(1, ((event.clientX - frameRect.left) / frameRect.width - 0.5) * 2));
        pointer.y = Math.max(-1, Math.min(1, ((event.clientY - frameRect.top) / frameRect.height - 0.5) * 2));
        queueParallax();
    }, { passive: true, signal: listeners.signal });
    root.addEventListener('pointerleave', () => {
        pointer.x = 0;
        pointer.y = 0;
        frameRect = null;
        queueParallax();
    }, { signal: listeners.signal });
    window.addEventListener('gcq:sky-scene', (event) => applySky(event.detail?.scene), { signal: listeners.signal });

    const cameraApi = {
        get state() { return { ...camera }; },
        get maxZoom() { return maxZoom(); },
        set: (next, mode) => { cameraFocus = false; return setCamera(next, mode); },
        zoomAt(factor, px, py, mode = 'wheel') {
            cameraFocus = false;
            const { width, height } = stageSize();
            return setCamera(zoomAround(camera, factor, px, py, width, height, maxZoom()), mode);
        },
        panBy(dx, dy, mode = 'drag') {
            if (!zoomed()) return { ...camera };
            cameraFocus = false;
            return setCamera({ ...camera, x: camera.x + dx, y: camera.y + dy }, mode);
        },
        flyToWorld(wx, wy, zoom = 1.6, mode = 'fly') {
            const { width, height } = stageSize();
            return setCamera(cameraOn(wx, wy, zoom, width, height, maxZoom()), mode);
        },
        home(mode = 'fly') {
            cameraFocus = false;
            return setCamera({ x: 0, y: 0, zoom: 1 }, mode);
        }
    };

    /** Flies in toward a world point to show a party; resolves once the camera has settled. */
    const glideTo = (x, y) => new Promise((resolve) => {
        if (currentTier === 'still') { resolve(); return; }
        const wasHome = !zoomed();
        cameraApi.flyToWorld(x, y, Math.max(camera.zoom, 1.45));
        cameraFocus = wasHome;
        later(resolve, CAMERA_MS.fly + 40);
    });
    /** A card closed: if the camera only moved to show it, it goes home. */
    const release = () => {
        if (!cameraFocus) return;
        cameraFocus = false;
        setCamera({ x: 0, y: 0, zoom: 1 }, 'fly');
    };

    // Sun and moon walk their arcs; the app's own minute tick moves the light.
    const skyTimer = setInterval(() => {
        if (!world.isConnected) { scene.destroy(); return; }
        if (!paused) placeSkyBodies();
    }, 60 * 1000);

    const scene = {
        ready,
        get destroyed() { return destroyed; },
        get sky() { return sky; },
        setTier(next) {
            if (destroyed || !next || next === currentTier) return;
            currentTier = next;
            if (!settings().parallax) { pointer.x = 0; pointer.y = 0; }
            if (camera.zoom > maxZoom()) setCamera(camera, 'fly');
            renderSprites();
            cloudsKey = '';
            if (sky) applySky(sky);
            writeStage();
        },
        setPaused(next) {
            paused = Boolean(next);
            if (paused) {
                clearTimeout(parallaxTimer);
                parallaxTimer = 0;
            } else if (!world.isConnected) {
                scene.destroy();
            } else {
                placeSkyBodies();
            }
        },
        /** Shows a given sky scene and clock (the preview page uses this; the map follows the app's sky). */
        setSky(next, clock = null) {
            skyClock = clock;
            moonPhaseKey = -1;
            applySky(next);
        },
        setExplored,
        celebrateRealm,
        /** Draws the touches that make the map this league's own (none for an unknown league). */
        setLeague(next) {
            if (!destroyed) renderLeague(next);
        },
        setLeader(next) {
            leader = next && (next.logo || next.name) ? { logo: next.logo, name: next.name } : null;
            placePennant();
        },
        glideTo,
        release,
        camera: cameraApi,
        refreshStage: writeStage,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            clearInterval(skyTimer);
            timers.forEach((id) => clearTimeout(id));
            timers.clear();
            clearTimeout(parallaxTimer);
            clearTimeout(settleTimer);
            listeners.abort();
            if (world.__questScene === scene) world.__questScene = null;
        }
    };

    world.__questScene = scene;
    applySky(initialScene());
    writeStage();
    return scene;
}
