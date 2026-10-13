/**
 * Map magic: everything that answers the class's hand on the Team Quest map.
 *
 * Loaded lazily with the world (features/worldMap.js mounts it once the world
 * is there). It adds, on top of the painted world:
 * - the living road: the explored road glows faintly, wisps of light run up
 *   it to the leading party, the uncharted road beyond is dotted like ink;
 * - the road wears its realms' colours (copper meadows, ice-blue peaks,
 *   gold citadel, violet stair), and flares as a party crosses into a realm;
 * - hover a party: its whole journey lights up, the way to its next stop is
 *   marked with a flag, and the rest of the map steps back into shade;
 * - hover the road: a pin says where that spot is and how many stars your
 *   class (or the leader) still needs to stand there;
 * - hover a realm: the map dims around it like a spotlight;
 * - a lantern of warm light and a trail of dust follow the pointer (full only);
 * - the camera: double-click, pinch, Ctrl + scroll or the buttons to zoom,
 *   drag to look around, the keys + − 0 and the arrows;
 * - footsteps where parties walk (full only).
 *
 * Every moving thing animates transform or opacity, so the compositor does
 * the work. Lite keeps the useful parts (trails, pins, camera) and
 * drops the purely decorative ones; reduced motion keeps them still.
 */

import { QUEST_ROAD_STOPS } from '../teamQuestRace.mjs';
import { WORLD_H, WORLD_W, pointAtProgress } from './worldGeometry.mjs';
import { REALM_HUES, describeRoadSpot, footstepPlan, measureTrail, nearestOnRoad, realmAt, realmRoadPieces, trailPath, trailPoints } from './mapJourney.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ROAD_NEAR = 18;
const ROAD_FAR = 26;
const HINT_KEY = 'gcq-team-quest-map-hint';
const WISPS = 5;

const pctX = (x) => `${((x / WORLD_W) * 100).toFixed(3)}%`;
const pctY = (y) => `${((y / WORLD_H) * 100).toFixed(3)}%`;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

function svgPath(className) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', className);
    return path;
}

/** The time (0–1) at which an eased walk has covered `share` of its distance. */
function timeForShare(ease, share) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 18; i += 1) {
        const mid = (lo + hi) / 2;
        if (ease(mid) < share) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

/**
 * @param {object} ctx
 * @param {HTMLElement} ctx.root   the map root
 * @param {object} ctx.scene       the mounted world (worldScene.js)
 * @param {() => Array} ctx.parties  the parties now: { key, el, progress, name, logo, isMine, isLeader, goal, stars }
 * @param {() => string} ctx.tier  'full' | 'lite' | 'still'
 */
export function mountMapMagic({ root, scene, parties, tier }) {
    const frame = root.querySelector('.tq-living-map__frame');
    const stage = root.querySelector('[data-quest-stage]');
    const svg = root.querySelector('.tq-route');
    const sparks = root.querySelector('[data-map-sparks]');
    if (!frame || !stage || !svg || !scene?.camera) return null;
    const camera = scene.camera;

    const listeners = new AbortController();
    const on = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: listeners.signal });
    const timers = new Set();
    const later = (fn, ms) => {
        const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
        timers.add(id);
        return id;
    };
    const loops = new Set();
    let paused = false;
    let destroyed = false;
    let explored = 0;

    // ── Layers (made once per map; a live update re-mounts and replaces them) ──
    root.querySelectorAll('[data-magic]').forEach((el) => el.remove());
    const make = (tag, className, parent, html = '') => {
        const el = document.createElement(tag);
        el.className = className;
        el.dataset.magic = '';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = html;
        parent.appendChild(el);
        return el;
    };

    // Every trail wears its realms' colours (copper, ice blue, gold, violet,
    // blending where two realms meet): each is the stretch of road it covers,
    // cut into coloured pieces. A plain bright line draws itself in first and
    // the colours bloom in behind it.
    const pieces = realmRoadPieces();
    const piecesHtml = (from, to, tone) => pieces
        .filter((piece) => piece.to > from && piece.from < to)
        .map((piece) => `<path d="${trailPath(Math.max(from, piece.from), Math.min(to, piece.to), 0.5)}" stroke="${piece[tone]}"/>`)
        .join('');
    const trails = document.createElementNS(SVG_NS, 'g');
    trails.setAttribute('class', 'tq-trails');
    trails.dataset.magic = '';
    trails.innerHTML = ['lit-glow', 'lit-draw', 'lit', 'uncharted', 'focus-glow', 'focus', 'focus-core', 'ahead', 'flare']
        .map((name) => `<g class="tq-trail tq-trail--${name}"></g>`).join('');
    const group = (name) => trails.querySelector(`.tq-trail--${name}`);
    const layer = {
        litGlow: group('lit-glow'), lit: group('lit'), uncharted: group('uncharted'),
        focusGlow: group('focus-glow'), focus: group('focus'), ahead: group('ahead')
    };
    const litDraw = svgPath('');
    group('lit-draw').appendChild(litDraw);
    const focusCore = svgPath('');
    group('focus-core').appendChild(focusCore);
    const flareLayer = group('flare');
    svg.insertBefore(trails, svg.firstChild);
    /** Fills a trail layer with the coloured road from `from` to `to` (fading in when asked). */
    const paint = (el, from, to, tone, { bloom = false, delay = 0 } = {}) => {
        el.innerHTML = to - from > 0.2 ? piecesHtml(from, to, tone) : '';
        el.getAnimations?.().forEach((animation) => animation.cancel());
        if (bloom && el.innerHTML) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay, easing: 'ease-out', fill: 'backwards' });
    };

    // The shade that falls round a hovered party or realm.
    const focusShade = make('div', 'tq-focus', stage);
    // World-sized boxes (1600 × 900 px, scaled to the stage): one under the
    // places for the road's life, one over the weather for the pins.
    const low = make('div', 'tq-magic tq-magic--low', stage);
    const high = make('div', 'tq-magic tq-magic--high', stage);
    const wispLayer = make('div', 'tq-magic__wisps', low);
    const stepLayer = make('div', 'tq-magic__steps', low);

    const roadPin = make('div', 'tq-road-pin', high, '<span class="tq-road-pin__ring"></span><span class="tq-road-pin__dot"></span><span class="tq-road-pin__label"></span>');
    const nextPin = make('div', 'tq-next-pin', high, '<span class="tq-next-pin__flag"><i class="fas fa-flag" aria-hidden="true"></i></span><span class="tq-next-pin__label"></span>');
    const lantern = make('div', 'tq-lantern-light', frame);
    const dust = Array.from({ length: 16 }, () => make('span', 'tq-dust', sparks || root));
    let dustIndex = 0;

    const cameraBar = make('div', 'tq-map-camera', frame, `
        <button type="button" class="tq-map-replay tq-map-camera__btn" data-cam="in" title="Zoom in" aria-label="Zoom in"><i class="fas fa-plus" aria-hidden="true"></i></button>
        <button type="button" class="tq-map-replay tq-map-camera__btn" data-cam="out" title="Zoom out" aria-label="Zoom out"><i class="fas fa-minus" aria-hidden="true"></i></button>
        <button type="button" class="tq-map-replay tq-map-camera__btn" data-cam="home" title="Whole map" aria-label="Show the whole map"><i class="fas fa-expand" aria-hidden="true"></i></button>`);
    cameraBar.removeAttribute('aria-hidden');
    const hint = make('div', 'tq-map-hint', frame);

    // The world boxes are 1600 × 900; this scales them to the stage.
    const fitLayers = () => {
        const k = (stage.clientWidth || WORLD_W) / WORLD_W;
        root.style.setProperty('--tq-k', k.toFixed(5));
    };
    fitLayers();

    // ── Trails ────────────────────────────────────────────────────────────
    const drawIn = (el, d, { animate }) => {
        el.setAttribute('d', d);
        if (!d) return;
        const length = el.getTotalLength ? el.getTotalLength() : 0;
        el.style.transition = 'none';
        el.style.strokeDasharray = `${length.toFixed(1)} ${(length + 20).toFixed(1)}`;
        el.style.strokeDashoffset = animate ? length.toFixed(1) : '0';
        if (!animate) return;
        void el.getBoundingClientRect();
        el.style.transition = '';
        el.style.strokeDashoffset = '0';
    };

    const animated = () => tier() === 'full' && !paused;

    // ── Wisps: little lights that run up the explored road to the leader ──
    const clearWisps = () => {
        loops.forEach((animation) => animation.cancel());
        loops.clear();
        wispLayer.replaceChildren();
    };
    const buildWisps = () => {
        clearWisps();
        if (tier() !== 'full' || explored < 4) return;
        const points = trailPoints(0, explored, 1);
        const { total, shares } = measureTrail(points);
        if (total < 80) return;
        const frames = points.map((point, i) => ({
            transform: `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0)`,
            offset: shares[i]
        }));
        frames.forEach((frameStep) => {
            frameStep.opacity = frameStep.offset < 0.06 ? frameStep.offset / 0.06 : frameStep.offset > 0.9 ? (1 - frameStep.offset) / 0.1 : 1;
        });
        const duration = Math.max(4200, (total / 85) * 1000);
        for (let i = 0; i < WISPS; i += 1) {
            const wisp = document.createElement('span');
            wisp.className = 'tq-wisp';
            wispLayer.appendChild(wisp);
            const animation = wisp.animate(frames, { duration, delay: (-i * duration) / WISPS, iterations: Infinity, easing: 'linear' });
            if (paused) animation.pause();
            loops.add(animation);
        }
    };

    const setExplored = (value, { animate = false } = {}) => {
        const next = Math.min(100, Math.max(0, Number(value) || 0));
        const grew = next > explored + 0.2;
        explored = next;
        const to = explored > 0.5 ? explored : 0;
        const withDraw = animate && grew && tier() !== 'still';
        drawIn(litDraw, withDraw ? trailPath(0, to) : '', { animate: withDraw });
        if (withDraw) litDraw.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 2400, fill: 'forwards' });
        paint(layer.litGlow, 0, to, 'light', { bloom: withDraw, delay: 1100 });
        paint(layer.lit, 0, to, 'light', { bloom: withDraw, delay: 1100 });
        // The uncharted road is dotted up to the next realm; beyond, the clouds still hide it.
        const nextBreak = QUEST_ROAD_STOPS.find((stop) => stop.progress > explored + 0.5);
        paint(layer.uncharted, explored, nextBreak ? nextBreak.progress : explored, 'ink');
        buildWisps();
    };

    // ── Where the pointer is on the land ─────────────────────────────────
    /** Client pixels → world units, through the stage's live transform and the frame's perspective. */
    const clientToWorld = (clientX, clientY) => {
        const rect = frame.getBoundingClientRect();
        const sx = clientX - rect.left - frame.clientLeft;
        const sy = clientY - rect.top - frame.clientTop;
        const style = getComputedStyle(stage);
        const own = style.transform && style.transform !== 'none' ? new DOMMatrix(style.transform) : new DOMMatrix();
        const [ox, oy] = style.transformOrigin.split(' ').map(Number.parseFloat);
        let m = new DOMMatrix().translate(ox || 0, oy || 0).multiply(own).translate(-(ox || 0), -(oy || 0));
        const frameStyle = getComputedStyle(frame);
        if (frameStyle.perspective && frameStyle.perspective !== 'none') {
            const d = Number.parseFloat(frameStyle.perspective);
            const [px, py] = frameStyle.perspectiveOrigin.split(' ').map(Number.parseFloat);
            const lens = new DOMMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / d, 0, 0, 0, 1]);
            m = new DOMMatrix().translate(px, py).multiply(lens).translate(-px, -py).multiply(m);
        }
        // Solve the projected plane z = 0 for the local point under (sx, sy).
        const a1 = m.m11 - sx * m.m14;
        const b1 = m.m21 - sx * m.m24;
        const c1 = sx * m.m44 - m.m41;
        const a2 = m.m12 - sy * m.m14;
        const b2 = m.m22 - sy * m.m24;
        const c2 = sy * m.m44 - m.m42;
        const det = a1 * b2 - a2 * b1 || 1e-9;
        const lx = (c1 * b2 - c2 * b1) / det;
        const ly = (a1 * c2 - a2 * c1) / det;
        return { x: (lx / (stage.clientWidth || 1)) * WORLD_W, y: (ly / (stage.clientHeight || 1)) * WORLD_H };
    };

    // ── Focus: one party or one realm at a time ──────────────────────────
    let focusedKey = null;
    const shadeAt = (x, y, rx, ry) => {
        focusShade.style.setProperty('--fx', pctX(x));
        focusShade.style.setProperty('--fy', pctY(y));
        focusShade.style.setProperty('--fw', pctX(rx));
        focusShade.style.setProperty('--fh', pctY(ry));
        focusShade.classList.add('is-on');
    };
    const clearShade = () => focusShade.classList.remove('is-on');

    const placeNextPin = (party) => {
        const stop = QUEST_ROAD_STOPS.find((candidate) => party.progress < candidate.progress);
        if (!stop) { nextPin.classList.remove('is-on'); return null; }
        const point = pointAtProgress(stop.progress);
        const spot = describeRoadSpot(stop.progress, party);
        nextPin.style.left = `${point.x.toFixed(1)}px`;
        nextPin.style.top = `${point.y.toFixed(1)}px`;
        nextPin.classList.toggle('is-below', point.y < 150);
        nextPin.querySelector('.tq-next-pin__label').innerHTML = `<b>${escapeHtml(stop.label)}</b><small>${escapeHtml(spot.starsLabel || '')} to go</small>`;
        nextPin.classList.add('is-on');
        return stop;
    };

    const focusParty = (key) => {
        if (key === focusedKey) return;
        focusedKey = key;
        const party = key ? parties().find((candidate) => candidate.key === key) : null;
        parties().forEach((candidate) => candidate.el.classList.toggle('is-focus', Boolean(party) && candidate.key === key));
        root.classList.toggle('is-party-focus', Boolean(party));
        if (!party) {
            [layer.focus, layer.focusGlow, layer.ahead].forEach((el) => { el.innerHTML = ''; });
            focusCore.setAttribute('d', '');
            nextPin.classList.remove('is-on');
            if (!placeFocused) clearShade();
            return;
        }
        hideRoadPin();
        const reach = party.progress > 0.5 ? party.progress : 0;
        const draw = tier() !== 'still';
        drawIn(focusCore, reach ? trailPath(0, reach) : '', { animate: draw });
        paint(layer.focusGlow, 0, reach, 'light', { bloom: draw, delay: 250 });
        paint(layer.focus, 0, reach, 'light', { bloom: draw, delay: 250 });
        const stop = placeNextPin(party);
        paint(layer.ahead, party.progress, stop ? stop.progress : party.progress, 'light');
        const point = pointAtProgress(party.progress);
        shadeAt(point.x, point.y, 300, 240);
    };

    let placeFocused = false;
    const focusPlace = (place) => {
        placeFocused = Boolean(place);
        if (!place) {
            if (!focusedKey) clearShade();
            return;
        }
        if (focusedKey) return;
        shadeAt(place.x, place.y, place.rx * 1.9, place.ry * 1.9);
    };

    // ── The road pin ─────────────────────────────────────────────────────
    let pinProgress = null;
    function hideRoadPin() {
        if (pinProgress === null) return;
        pinProgress = null;
        roadPin.classList.remove('is-on');
        if (!focusedKey) layer.ahead.innerHTML = '';
        root.dispatchEvent(new CustomEvent('tq:road', { detail: { active: false } }));
    }
    const guidePartyNow = () => {
        const list = parties();
        return list.find((party) => party.isMine) || list.find((party) => party.isLeader) || null;
    };
    const showRoadPin = (progress) => {
        const spot = describeRoadSpot(progress, guidePartyNow());
        const point = pointAtProgress(spot.progress);
        roadPin.style.left = `${point.x.toFixed(1)}px`;
        roadPin.style.top = `${point.y.toFixed(1)}px`;
        roadPin.classList.toggle('is-below', point.y < 150);
        roadPin.dataset.zone = spot.zone;
        const partyLine = !spot.party ? ''
            : spot.passed ? `<small><i class="fas fa-check" aria-hidden="true"></i> ${escapeHtml(spot.party)} has been here</small>`
                : `<small>${escapeHtml(spot.party)} · <b>${escapeHtml(spot.starsLabel)}</b> away</small>`;
        roadPin.querySelector('.tq-road-pin__label').innerHTML = `<strong>${spot.percent}%</strong><span>${escapeHtml(spot.realm)}</span>${partyLine}`;
        roadPin.classList.add('is-on');
        const guide = guidePartyNow();
        paint(layer.ahead, guide && !spot.passed ? guide.progress : 0, guide && !spot.passed ? spot.progress : 0, 'light');
        if (pinProgress === null) root.dispatchEvent(new CustomEvent('tq:road', { detail: { active: true } }));
        pinProgress = spot.progress;
    };

    // ── Pointer: road hover, the lantern and the dust ────────────────────
    const blocked = (target) => Boolean(target?.closest?.('[data-map-token], .tq-popover, .tq-tip, .tq-map-controls, .tq-map-camera, .tq-route-finish, .tq-map-title'));
    let moveFrame = 0;
    let lastMove = null;
    let lastRoadCheck = 0;
    let roadTimer = 0;
    let lastDust = { t: 0, x: 0, y: 0 };
    let dragging = false;

    const updatePointer = () => {
        moveFrame = 0;
        const event = lastMove;
        if (!event || destroyed || root.dataset.scroll !== 'open') return;
        const rect = frame.getBoundingClientRect();
        const fx = event.clientX - rect.left;
        const fy = event.clientY - rect.top;
        const isBlocked = blocked(event.target);
        const full = tier() === 'full';

        // The lantern: a pool of warm light held over the map.
        if (full && !dragging) {
            lantern.style.transform = `translate3d(${fx.toFixed(0)}px, ${fy.toFixed(0)}px, 0)`;
            lantern.classList.toggle('is-on', !isBlocked);
        }

        // Dust from the pointer's wake.
        const now = performance.now();
        if (full && !paused && !dragging && !isBlocked && sparks
            && now - lastDust.t > 42 && Math.hypot(fx - lastDust.x, fy - lastDust.y) > 16) {
            const rootRect = root.getBoundingClientRect();
            const x = event.clientX - rootRect.left;
            const y = event.clientY - rootRect.top;
            const mote = dust[dustIndex];
            dustIndex = (dustIndex + 1) % dust.length;
            const drift = (Math.random() - 0.5) * 26;
            mote.animate([
                { transform: `translate3d(${x}px, ${y}px, 0) scale(1)`, opacity: 0.95 },
                { transform: `translate3d(${(x + drift).toFixed(0)}px, ${(y - 18 - Math.random() * 16).toFixed(0)}px, 0) scale(0.2)`, opacity: 0 }
            ], { duration: 760, easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)' });
            lastDust = { t: now, x: fx, y: fy };
        }

        // The road pin, a few times a second (and once more where the pointer comes to rest).
        clearTimeout(roadTimer);
        if (now - lastRoadCheck < 45) {
            roadTimer = setTimeout(() => checkRoad(event), 50);
            return;
        }
        checkRoad(event);
    };

    const checkRoad = (event) => {
        if (destroyed) return;
        lastRoadCheck = performance.now();
        if (blocked(event.target) || focusedKey || dragging) { hideRoadPin(); return; }
        const point = clientToWorld(event.clientX, event.clientY);
        const near = nearestOnRoad(point.x, point.y);
        const limit = pinProgress === null ? ROAD_NEAR : ROAD_FAR;
        if (near.distance <= limit) {
            if (pinProgress !== near.progress) showRoadPin(near.progress);
        } else {
            hideRoadPin();
        }
    };

    on(frame, 'pointermove', (event) => {
        if (event.pointerType !== 'mouse') return;
        lastMove = event;
        if (!moveFrame) moveFrame = requestAnimationFrame(updatePointer);
    }, { passive: true });
    on(frame, 'pointerleave', () => {
        lastMove = null;
        clearTimeout(roadTimer);
        lantern.classList.remove('is-on');
        hideRoadPin();
    });

    // ── The camera ───────────────────────────────────────────────────────
    const framePoint = (clientX, clientY) => {
        const rect = frame.getBoundingClientRect();
        return { x: clientX - rect.left - frame.clientLeft, y: clientY - rect.top - frame.clientTop };
    };
    const centre = () => ({ x: (stage.clientWidth || 0) / 2, y: (stage.clientHeight || 0) / 2 });
    const interactive = (target) => Boolean(target?.closest?.('[data-place], [data-map-token], button, a, .tq-popover, .tq-tip, .tq-map-controls, .tq-map-camera'));

    const syncCameraUi = () => {
        const { zoom } = camera.state;
        cameraBar.querySelector('[data-cam="home"]').hidden = zoom <= 1.001;
        cameraBar.querySelector('[data-cam="in"]').disabled = zoom >= camera.maxZoom - 0.01;
        cameraBar.querySelector('[data-cam="out"]').disabled = zoom <= 1.001;
    };
    syncCameraUi();
    on(root, 'tq:camera', (event) => {
        syncCameraUi();
        if (event.detail?.phase === 'move') hideRoadPin();
    });

    cameraBar.querySelectorAll('[data-cam]').forEach((button) => {
        on(button, 'click', (event) => {
            event.stopPropagation();
            const c = centre();
            if (button.dataset.cam === 'in') camera.zoomAt(1.5, c.x, c.y, 'fly');
            else if (button.dataset.cam === 'out') camera.zoomAt(1 / 1.5, c.x, c.y, 'fly');
            else camera.home();
        });
    });

    on(frame, 'dblclick', (event) => {
        if (interactive(event.target) || root.dataset.scroll !== 'open') return;
        event.preventDefault();
        const p = framePoint(event.clientX, event.clientY);
        const { zoom } = camera.state;
        if (zoom >= camera.maxZoom - 0.05) camera.home();
        else camera.zoomAt(1.8, p.x, p.y, 'fly');
    });

    // Ctrl + scroll (and a trackpad pinch) zooms; once zoomed in, plain scrolling zooms too.
    let wheelDelta = 0;
    let wheelPoint = null;
    let wheelFrame = 0;
    on(frame, 'wheel', (event) => {
        if (root.dataset.scroll !== 'open') return;
        const zoomedIn = camera.state.zoom > 1.001;
        if (!event.ctrlKey && !zoomedIn) return;
        event.preventDefault();
        wheelDelta += event.deltaY * (event.ctrlKey ? 0.012 : 0.0018) * (event.deltaMode === 1 ? 16 : 1);
        wheelPoint = framePoint(event.clientX, event.clientY);
        if (!wheelFrame) {
            wheelFrame = requestAnimationFrame(() => {
                wheelFrame = 0;
                const factor = Math.exp(-Math.max(-0.6, Math.min(0.6, wheelDelta)));
                wheelDelta = 0;
                camera.zoomAt(factor, wheelPoint.x, wheelPoint.y, 'wheel');
            });
        }
    }, { passive: false });

    // Drag to look around (when zoomed in); two fingers pinch.
    const pointers = new Map();
    let drag = null;
    let pinch = null;
    let swallowClick = false;
    on(frame, 'pointerdown', (event) => {
        if (event.button !== 0 || root.dataset.scroll !== 'open') return;
        if (event.target.closest('.tq-popover, .tq-map-controls, .tq-map-camera, .tq-tip')) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
            drag = null;
            return;
        }
        if (camera.state.zoom <= 1.001 && event.pointerType === 'mouse') return;
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, samples: [] };
    });
    on(frame, 'pointermove', (event) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pinch && pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
            const mid = framePoint((a.x + b.x) / 2, (a.y + b.y) / 2);
            camera.zoomAt(distance / pinch.distance, mid.x, mid.y, 'drag');
            pinch.distance = distance;
            swallowClick = true;
            return;
        }
        if (!drag || drag.id !== event.pointerId || camera.state.zoom <= 1.001) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 5) return;
        if (!drag.moved) {
            drag.moved = true;
            dragging = true;
            root.classList.add('is-dragging');
            lantern.classList.remove('is-on');
            hideRoadPin();
            try { frame.setPointerCapture(event.pointerId); } catch { /* already released */ }
        }
        drag.x = event.clientX;
        drag.y = event.clientY;
        const now = performance.now();
        drag.samples.push({ t: now, dx, dy });
        while (drag.samples.length && now - drag.samples[0].t > 90) drag.samples.shift();
        camera.panBy(dx, dy, 'drag');
    });
    const endPointer = (event) => {
        pointers.delete(event.pointerId);
        if (pointers.size < 2) pinch = null;
        if (!drag || drag.id !== event.pointerId) return;
        const finished = drag;
        drag = null;
        if (!finished.moved) return;
        dragging = false;
        root.classList.remove('is-dragging');
        swallowClick = true;
        // A flick keeps the map gliding a little.
        const span = finished.samples.length > 1 ? finished.samples[finished.samples.length - 1].t - finished.samples[0].t : 0;
        if (span > 0 && tier() !== 'still') {
            const vx = finished.samples.reduce((sum, s) => sum + s.dx, 0) / span;
            const vy = finished.samples.reduce((sum, s) => sum + s.dy, 0) / span;
            if (Math.hypot(vx, vy) > 0.25) {
                const state = camera.state;
                camera.set({ ...state, x: state.x + vx * 220, y: state.y + vy * 220 }, 'coast');
            }
        }
    };
    on(frame, 'pointerup', endPointer);
    on(frame, 'pointercancel', endPointer);
    // A drag must not also click the party or realm it ended on.
    on(root, 'click', (event) => {
        if (!swallowClick) return;
        swallowClick = false;
        event.stopPropagation();
        event.preventDefault();
    }, { capture: true });
    on(frame, 'pointerdown', () => { swallowClick = false; }, { capture: true });

    on(root, 'keydown', (event) => {
        if (event.target.closest?.('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return;
        const c = centre();
        const zoomedIn = camera.state.zoom > 1.001;
        const step = 90;
        const actions = {
            '+': () => camera.zoomAt(1.5, c.x, c.y, 'fly'),
            '=': () => camera.zoomAt(1.5, c.x, c.y, 'fly'),
            '-': () => camera.zoomAt(1 / 1.5, c.x, c.y, 'fly'),
            0: () => camera.home(),
            ArrowLeft: () => zoomedIn && camera.panBy(step, 0, 'wheel'),
            ArrowRight: () => zoomedIn && camera.panBy(-step, 0, 'wheel'),
            ArrowUp: () => zoomedIn && camera.panBy(0, step, 'wheel'),
            ArrowDown: () => zoomedIn && camera.panBy(0, -step, 'wheel')
        };
        const action = actions[event.key];
        if (!action) return;
        if (event.key.startsWith('Arrow') && !zoomedIn) return;
        event.preventDefault();
        action();
    });

    // A first visit says once how to look around.
    on(frame, 'pointerenter', (event) => {
        if (tier() === 'still' || root.dataset.scroll !== 'open') return;
        try {
            if (sessionStorage.getItem(HINT_KEY)) return;
            sessionStorage.setItem(HINT_KEY, '1');
        } catch { return; }
        const touch = event.pointerType !== 'mouse';
        hint.innerHTML = touch
            ? '<span><i class="fas fa-hand-pointer" aria-hidden="true"></i> Pinch to zoom</span><span><i class="fas fa-route" aria-hidden="true"></i> Tap a party to see its journey</span>'
            : '<span><i class="fas fa-magnifying-glass-plus" aria-hidden="true"></i> Double-click to zoom</span><span><i class="fas fa-hand" aria-hidden="true"></i> Drag to explore</span><span><i class="fas fa-route" aria-hidden="true"></i> Point at the road</span>';
        hint.classList.add('is-on');
        later(() => hint.classList.remove('is-on'), 4200);
    });

    // ── Footsteps where a party walks ────────────────────────────────────
    const walk = ({ from, to, delay = 0, duration = 1000, ease = (t) => t }) => {
        if (tier() !== 'full' || paused || to - from < 1.2) return;
        footstepPlan(from, to).forEach((step) => {
            const el = document.createElement('i');
            el.className = `tq-step${step.side < 0 ? ' is-left' : ''}`;
            el.style.left = `${step.x}px`;
            el.style.top = `${step.y}px`;
            el.style.setProperty('--a', `${step.angle}deg`);
            stepLayer.appendChild(el);
            const at = delay + duration * timeForShare(ease, step.share);
            const animation = el.animate(
                [{ opacity: 0 }, { opacity: 0.9, offset: 0.05 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0 }],
                { duration: 3200, delay: at, fill: 'both' }
            );
            animation.addEventListener('finish', () => el.remove(), { once: true });
            animation.addEventListener('cancel', () => el.remove(), { once: true });
        });
    };

    /** The road flares in the realm's colour as the first party crosses into it. */
    const flareGate = (progress) => {
        const at = Number(progress);
        if (!(at > 0 && at < 100) || tier() === 'still') return;
        const hue = REALM_HUES[realmAt(at)];
        if (!hue) return;
        const el = document.createElementNS(SVG_NS, 'path');
        el.setAttribute('d', trailPath(Math.max(0, at - 6), Math.min(100, at + 4), 0.25));
        el.setAttribute('stroke', `rgb(${hue.light.join(', ')})`);
        flareLayer.appendChild(el);
        const length = el.getTotalLength();
        const animation = el.animate([
            { strokeDasharray: `0 ${length}`, opacity: 0 },
            { strokeDasharray: `${length} 0`, opacity: 1, offset: 0.35 },
            { strokeDasharray: `${length} 0`, opacity: 0 }
        ], { duration: 1800, easing: 'ease-out' });
        animation.addEventListener('finish', () => el.remove(), { once: true });
        animation.addEventListener('cancel', () => el.remove(), { once: true });
    };

    const magic = {
        setExplored,
        focusParty,
        focusPlace,
        walk,
        flareGate,
        clientToWorld,
        refresh() {
            fitLayers();
        },
        setTier() {
            if (tier() !== 'full') lantern.classList.remove('is-on');
            buildWisps();
        },
        setPaused(next) {
            paused = Boolean(next);
            loops.forEach((animation) => (paused ? animation.pause() : animation.play()));
            stepLayer.getAnimations?.({ subtree: true }).forEach((animation) => (paused ? animation.pause() : animation.play()));
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            cancelAnimationFrame(moveFrame);
            cancelAnimationFrame(wheelFrame);
            clearTimeout(roadTimer);
            timers.forEach((id) => clearTimeout(id));
            listeners.abort();
            clearWisps();
            root.classList.remove('is-party-focus', 'is-dragging');
            root.querySelectorAll('[data-magic]').forEach((el) => el.remove());
        }
    };
    root.__questMagic = magic;
    return magic;
}
