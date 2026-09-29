import { getActById, getAllActs, getActsForWeekday } from './skyTheater/catalog.js';
import { buildBlockSchedule, msUntilNextBlock } from './skyTheater/scheduler.js';
import { renderArt } from './skyTheater/art.js';
import { FLIGHTS, CAMEOS, sampleFlight } from './skyTheater/motion.js';

let running = false;
/** @type {ReturnType<typeof setTimeout>[]} */
let timers = [];
/** @type {ReturnType<typeof setTimeout> | null} */
let blockTimer = null;
/** @type {(() => void) | null} */
let visibilityHandler = null;

/**
 * The actor currently on stage (one at a time keeps the header calm).
 * @type {{ el: HTMLElement, anim: Animation | null, emitter: ReturnType<typeof setInterval> | null, cues: ReturnType<typeof setTimeout>[] } | null}
 */
let current = null;

const OPENER_KEY = 'gcq-sky-theater-opener';
const MAX_MOTES = 90;
let liveMotes = 0;

/** How often each trail drops a particle (ms). */
const TRAIL_RATE = {
    rainbow: 32,
    glow: 32,
    dash: 70,
    puff: 85,
    sparkle: 105,
    confetti: 90,
    ember: 110,
    feather: 420,
    snow: 150,
    leaf: 380
};

/** Ribbon trails are laid down every N px instead of once per tick. */
const RIBBON_STEP = { rainbow: 5, glow: 9 };

const lerpN = (a, b, t) => a + (b - a) * t;

const PALETTES = {
    sparkle: ['#fff7d6', '#fde68a', '#ffffff', '#fbcfe8'],
    sparkleNight: ['#fde68a', '#fef9c3', '#c4b5fd', '#a5f3fc'],
    confetti: ['#f43f5e', '#fbbf24', '#38bdf8', '#34d399', '#a78bfa', '#fb7185'],
    ember: ['#fde047', '#fb923c', '#f97316', '#fef08a'],
    leaf: ['#f97316', '#dc2626', '#f59e0b', '#b45309']
};

function prefersReducedMotion() {
    return typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

function isNightCostume() {
    return Boolean(
        document.querySelector('header.header-night')
        || document.querySelector('.m-header.header-night')
        || document.body.classList.contains('night-mode')
    );
}

function resolveStages() {
    const mobile = document.body.classList.contains('gcq-mobile');
    if (mobile) {
        const header = document.getElementById('m-teacher-header')
            || document.querySelector('.m-header');
        return {
            sky: header?.querySelector('.sky-theater-sky') || null,
            cameo: header?.querySelector('.sky-theater-cameo') || null
        };
    }
    const header = document.querySelector('#award-header-atmosphere header')
        || document.querySelector('#app-screen header')
        || document.querySelector('header');
    return {
        sky: header?.querySelector('.sky-theater-sky') || null,
        cameo: header?.querySelector('.sky-theater-cameo') || null
    };
}

function clearTimers() {
    for (const t of timers) clearTimeout(t);
    timers = [];
    if (blockTimer) {
        clearTimeout(blockTimer);
        blockTimer = null;
    }
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

/**
 * Drop one particle on a stage.
 * @param {HTMLElement} stage
 * @param {string} kind
 * @param {number} x centre x (px, stage space)
 * @param {number} y centre y (px, stage space)
 * @param {{ night?: boolean, burst?: boolean, angle?: number, dir?: number, h?: number, before?: Element | null }} [o]
 */
function spawnMote(stage, kind, x, y, o = {}) {
    if (liveMotes >= MAX_MOTES || !stage.isConnected) return;
    const m = document.createElement('span');
    m.className = `skyt-mote skyt-mote--${kind}${o.burst ? ' skyt-mote--burst' : ''}`;
    m.setAttribute('aria-hidden', 'true');
    const s = m.style;
    s.left = `${x.toFixed(1)}px`;
    s.top = `${y.toFixed(1)}px`;
    s.setProperty('--rot', `${Math.round(rand(-180, 180))}deg`);
    s.setProperty('--spin', `${Math.round(rand(-260, 260))}deg`);

    const dir = o.dir || 1;
    switch (kind) {
        case 'sparkle':
            s.setProperty('--c', pick(o.night ? PALETTES.sparkleNight : PALETTES.sparkle));
            s.setProperty('--sz', `${rand(6, 12).toFixed(1)}px`);
            s.setProperty('--dx', `${rand(-8, 8).toFixed(1)}px`);
            s.setProperty('--dy', `${rand(-6, 10).toFixed(1)}px`);
            break;
        case 'confetti':
            s.setProperty('--c', pick(PALETTES.confetti));
            s.setProperty('--dx', `${rand(-14, 14).toFixed(1)}px`);
            s.setProperty('--dy', `${rand(18, 34).toFixed(1)}px`);
            break;
        case 'ember':
            s.setProperty('--c', pick(PALETTES.ember));
            s.setProperty('--sz', `${rand(3, 6).toFixed(1)}px`);
            s.setProperty('--dx', `${(dir * rand(8, 20)).toFixed(1)}px`);
            s.setProperty('--dy', `${rand(-12, -4).toFixed(1)}px`);
            break;
        case 'leaf':
            s.setProperty('--c', pick(PALETTES.leaf));
            s.setProperty('--dx', `${rand(-16, 16).toFixed(1)}px`);
            s.setProperty('--dy', `${rand(20, 34).toFixed(1)}px`);
            break;
        case 'puff':
            s.setProperty('--sz', `${rand(9, 15).toFixed(1)}px`);
            s.setProperty('--dx', `${(-dir * rand(4, 12)).toFixed(1)}px`);
            s.setProperty('--dy', `${rand(-4, 4).toFixed(1)}px`);
            break;
        case 'rainbow':
            s.setProperty('--h', `${Math.max(10, (o.h || 30) * 0.4).toFixed(1)}px`);
            s.setProperty('--rot', `${(o.angle || 0).toFixed(1)}deg`);
            break;
        case 'dash':
            s.setProperty('--rot', `${(o.angle || 0).toFixed(1)}deg`);
            break;
        case 'glow':
            s.setProperty('--sz', `${rand(8, 14).toFixed(1)}px`);
            s.setProperty('--dy', `${rand(-3, 3).toFixed(1)}px`);
            break;
        case 'feather':
            s.setProperty('--dx', `${rand(-12, 12).toFixed(1)}px`);
            s.setProperty('--dy', `${rand(22, 36).toFixed(1)}px`);
            break;
        case 'snow':
            s.setProperty('--sz', `${rand(3, 6).toFixed(1)}px`);
            s.setProperty('--dx', `${rand(-10, 10).toFixed(1)}px`);
            s.setProperty('--dy', `${rand(10, 24).toFixed(1)}px`);
            break;
        default:
            break;
    }

    if (o.burst) {
        const a = o.angle ?? rand(0, Math.PI * 2);
        const dist = rand(22, 46);
        s.setProperty('--dx', `${(Math.cos(a) * dist).toFixed(1)}px`);
        s.setProperty('--dy', `${(Math.sin(a) * dist).toFixed(1)}px`);
    }

    if (o.before && o.before.parentNode === stage) stage.insertBefore(m, o.before);
    else stage.appendChild(m);
    liveMotes += 1;

    let gone = false;
    const remove = () => {
        if (gone) return;
        gone = true;
        liveMotes = Math.max(0, liveMotes - 1);
        m.remove();
    };
    m.addEventListener('animationend', remove, { once: true });
    setTimeout(remove, 2600);
}

function burstAt(stage, kind, x, y, count, night) {
    const burstKind = kind === 'none' ? 'sparkle' : kind;
    for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
        spawnMote(stage, burstKind, x, y, { night, burst: true, angle });
    }
}

function clearCurrent() {
    if (!current) return;
    const { el, anim, emitter, cues } = current;
    if (emitter) clearInterval(emitter);
    for (const c of cues) clearTimeout(c);
    try { anim?.cancel(); } catch { /* already finished */ }
    el.remove();
    current = null;
}

function removeAllActors() {
    clearCurrent();
    document.querySelectorAll('.sky-theater-actor, .skyt-mote').forEach((n) => n.remove());
    liveMotes = 0;
}

/**
 * Build the actor element and measure it on its stage.
 * @param {import('./skyTheater/catalog.js').SkyTheaterAct} act
 */
function createActor(act, mount, { night, flip }) {
    const el = document.createElement('div');
    const anchor = act.stage === 'cameo' ? ` skyt-anchor--${act.anchor || 'time'}` : '';
    el.className = `sky-theater-actor skyt-actor skyt-actor--${act.stage} skyt-art--${act.art}${anchor}${night ? ' is-night' : ''}`;
    el.dataset.actId = act.id;
    el.setAttribute('aria-hidden', 'true');
    const aspect = act.aspect || 1;
    el.style.setProperty('--st-h', `${act.size}rem`);
    el.style.setProperty('--st-w', `${(act.size * aspect).toFixed(3)}rem`);

    const text = act.lines?.length ? pick(act.lines) : undefined;
    const art = renderArt(act.art, { night, flip, text });
    el.innerHTML = `<div class="skyt-actor__flip${flip ? ' is-flipped' : ''}"><div class="skyt-actor__body">${art}</div></div>`;

    // Banner planes size to their caption.
    if (act.art === 'bannerPlane') {
        const vb = el.querySelector('svg')?.getAttribute('viewBox')?.split(' ').map(Number);
        if (vb && vb[3]) el.style.setProperty('--st-w', `${((act.size * vb[2]) / vb[3]).toFixed(3)}rem`);
    }

    mount.appendChild(el);
    return el;
}

/**
 * Seat a cameo in the open sky just left of the date or clock line it visits, so it never covers
 * the numbers or hangs off the screen edge. Falls back to the CSS corner anchor (mobile clock).
 */
function placeCameo(el, stage, anchor) {
    if (document.body.classList.contains('gcq-mobile')) return;
    const column = stage.parentElement;
    const target = anchor === 'date'
        ? column?.querySelector('.gcq-date-wrap')
        : column?.querySelector('#current-time')?.parentElement;
    if (!target || !target.offsetWidth) return;
    const s = stage.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = t.left - s.left - w - 6;
    const top = t.top - s.top + (t.height - h) / 2;
    el.classList.add('is-seated');
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(Math.max(top, -s.top + 2))}px`;
}

function runCues(el, stage, act, cues, duration, night) {
    const ids = [];
    for (const cue of cues || []) {
        ids.push(setTimeout(() => {
            if (!el.isConnected) return;
            if (cue.add) el.classList.add(cue.add);
            if (cue.remove) el.classList.remove(cue.remove);
            if (cue.burst) {
                const x = el.offsetLeft + el.offsetWidth / 2;
                const y = el.offsetTop + el.offsetHeight / 2;
                burstAt(stage, act.trail, x, y, cue.burst, night);
            }
        }, cue.at * duration));
    }
    return ids;
}

/**
 * @param {import('./skyTheater/catalog.js').SkyTheaterAct} act
 * @param {{ silent?: boolean, dir?: 1 | -1 }} [opts]
 */
export function playAct(act, opts = {}) {
    const log = opts.silent ? () => {} : (...args) => console.info('[skyTheater]', ...args);
    if (!act) {
        log('no act');
        return false;
    }
    if (current) {
        log('busy — clearing previous actor');
        clearCurrent();
    }
    const stages = resolveStages();
    const mount = act.stage === 'cameo' ? stages.cameo : stages.sky;
    if (!mount) {
        log('stage missing', {
            stage: act.stage,
            sky: Boolean(stages.sky),
            cameo: Boolean(stages.cameo),
            appHidden: document.getElementById('app-screen')?.classList.contains('hidden')
        });
        return false;
    }
    if (!mount.clientWidth) {
        log('stage has no size (hidden?) — skipping', act.id);
        return false;
    }
    if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
        return false;
    }

    const night = isNightCostume();

    if (act.stage === 'cameo') {
        const routine = (CAMEOS[act.motion] || CAMEOS.pop)();
        const el = createActor(act, mount, { night, flip: false });
        placeCameo(el, mount, act.anchor || 'time');
        const anim = el.animate(routine.frames, { duration: routine.duration, easing: 'cubic-bezier(0.37, 0, 0.3, 1)', fill: 'both' });
        current = { el, anim, emitter: null, cues: runCues(el, mount, act, routine.cues, routine.duration, night) };
        // A few lingering twinkles while the cameo is on stage.
        if (act.trail !== 'none') {
            current.emitter = setInterval(() => {
                if (!el.isConnected) return;
                const x = el.offsetLeft + rand(0, el.offsetWidth);
                const y = el.offsetTop + rand(0, el.offsetHeight * 0.8);
                spawnMote(mount, act.trail === 'confetti' ? 'confetti' : 'sparkle', x, y, { night });
            }, 360);
        }
        anim.onfinish = () => { if (current?.el === el) clearCurrent(); };
        log('playing', act.id, act.motion);
        return true;
    }

    const choreo = FLIGHTS[act.motion] || FLIGHTS.glide;
    const dir = opts.dir || (Math.random() < 0.5 ? 1 : -1);
    const el = createActor(act, mount, { night, flip: dir === -1 });
    const ctx = {
        W: mount.clientWidth,
        H: mount.clientHeight,
        w: el.offsetWidth,
        h: el.offsetHeight,
        dir,
        rng: Math.random
    };
    const flight = choreo(ctx);
    const frames = sampleFlight(flight, dir);
    const anim = el.animate(frames, { duration: flight.duration, easing: 'linear', fill: 'both' });
    current = { el, anim, emitter: null, cues: runCues(el, mount, act, flight.cues, flight.duration, night) };

    const rate = TRAIL_RATE[act.trail];
    if (rate) {
        const tail = flight.tail || { dx: -dir * ctx.w * 0.45, dy: 0 };
        let last = null;
        current.emitter = setInterval(() => {
            const t = Number(anim.currentTime) || 0;
            const u = Math.min(1, t / flight.duration);
            if (u <= 0 || u >= 0.985) return;
            const p = flight.at(u);
            if ((p.o ?? 1) < 0.35) return;
            const x = p.x + ctx.w / 2 + tail.dx;
            const y = p.y + ctx.h / 2 + tail.dy;
            if (!last) {
                last = { x, y };
                return;
            }
            // Lean with the path while keeping "up" up, so rainbow bands never turn upside down.
            const angle = dir * (Math.atan2(y - last.y, (x - last.x) * dir) * 180) / Math.PI;
            const step = RIBBON_STEP[act.trail];
            if (step) {
                // Ribbon trails fill the gap since the last tick so they read as one continuous band.
                const n = Math.max(1, Math.round(Math.hypot(x - last.x, y - last.y) / step));
                for (let i = 1; i <= n; i += 1) {
                    const k = i / n;
                    spawnMote(mount, act.trail, lerpN(last.x, x, k), lerpN(last.y, y, k), { night, dir, h: ctx.h, angle, before: el });
                }
            } else {
                spawnMote(mount, act.trail, x + rand(-2, 2), y + rand(-2, 2), { night, dir, h: ctx.h, angle, before: el });
            }
            last = { x, y };
        }, rate);
    }

    anim.onfinish = () => { if (current?.el === el) clearCurrent(); };
    log('playing', act.id, act.motion, dir === 1 ? '→' : '←');
    return true;
}

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function openerDone() {
    try { return sessionStorage.getItem(OPENER_KEY) === todayKey(); } catch { return true; }
}

function markOpenerDone() {
    try { sessionStorage.setItem(OPENER_KEY, todayKey()); } catch { /* storage blocked */ }
}

function armSchedule() {
    clearTimers();
    if (!running || document.hidden) return;

    const now = new Date();
    const fires = buildBlockSchedule(now);
    for (const fire of fires) {
        const delay = Math.max(0, fire.atMs - Date.now());
        const id = setTimeout(() => {
            if (!running || document.hidden) return;
            playAct(fire.act, { silent: true });
        }, delay);
        timers.push(id);
    }

    // Opening number: one of today's flyers says hello shortly after the app opens (once a day per tab).
    if (!openerDone()) {
        const flyers = getActsForWeekday(now.getDay()).filter((a) => a.stage === 'sky');
        const opener = flyers[Math.floor(Math.random() * flyers.length)];
        if (opener) {
            timers.push(setTimeout(() => {
                if (!running || document.hidden || current) return;
                if (playAct(opener, { silent: true })) markOpenerDone();
            }, rand(18_000, 32_000)));
        }
    }

    const untilNext = msUntilNextBlock(now);
    blockTimer = setTimeout(() => {
        if (running && !document.hidden) armSchedule();
    }, Math.max(untilNext + 250, 1000));
}

export function startSkyTheater() {
    if (running) return;
    if (prefersReducedMotion()) {
        console.info('[skyTheater] skipped (prefers-reduced-motion)');
        return;
    }
    const stages = resolveStages();
    if (!stages.sky && !stages.cameo) {
        console.info('[skyTheater] skipped (no stages in DOM yet)');
        return;
    }

    running = true;
    visibilityHandler = () => {
        if (document.hidden) {
            clearTimers();
            removeAllActors();
        } else if (running) {
            armSchedule();
        }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    armSchedule();
    console.info('[skyTheater] started — try __skyTheaterDebugPlay("mon-rocket") in the browser console');
}

export function stopSkyTheater() {
    running = false;
    clearTimers();
    if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
    }
    removeAllActors();
}

/** Dev helper: force an act by id (e.g. `mon-rocket`). Optional `dir` 1 / -1. */
export function debugPlayAct(id, dir) {
    const act = getActById(id);
    if (!act) {
        const ids = getAllActs().map((a) => a.id);
        console.warn('[skyTheater] unknown act', id, '— try one of:', ids.join(', '));
        return false;
    }
    // Ensure stages exist even if auto-start was skipped
    if (!running && !prefersReducedMotion()) {
        const stages = resolveStages();
        if (stages.sky || stages.cameo) startSkyTheater();
    }
    return playAct(act, { dir: dir === 1 || dir === -1 ? dir : undefined });
}

export function listSkyTheaterActs() {
    return getAllActs().map((a) => a.id);
}

function installDebugApi() {
    if (typeof window === 'undefined') return;
    window.__skyTheaterDebugPlay = debugPlayAct;
    window.__skyTheaterListActs = listSkyTheaterActs;
}

installDebugApi();
