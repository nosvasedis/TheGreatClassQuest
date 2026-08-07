import { glyphForAct, getActById, getAllActs } from './skyTheater/catalog.js';
import { buildBlockSchedule, msUntilNextBlock } from './skyTheater/scheduler.js';

let running = false;
let playing = false;
/** @type {ReturnType<typeof setTimeout>[]} */
let timers = [];
/** @type {ReturnType<typeof setTimeout> | null} */
let blockTimer = null;
/** @type {(() => void) | null} */
let visibilityHandler = null;

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

/**
 * @param {import('./skyTheater/catalog.js').SkyTheaterAct} act
 * @param {{ silent?: boolean }} [opts]
 */
export function playAct(act, opts = {}) {
    const log = opts.silent ? () => {} : (...args) => console.info('[skyTheater]', ...args);
    if (!act) {
        log('no act');
        return false;
    }
    if (playing) {
        log('busy — clearing previous actor');
        document.querySelectorAll('.sky-theater-actor').forEach((n) => n.remove());
        playing = false;
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

    const appHidden = document.getElementById('app-screen')?.classList.contains('hidden');
    if (appHidden) {
        log('app-screen is hidden — log in first so the header is visible');
    }

    playing = true;
    const el = document.createElement('span');
    el.className = `sky-theater-actor ${act.anim}${isNightCostume() ? ' is-night' : ''}`;
    el.dataset.actId = act.id;
    el.textContent = glyphForAct(act, isNightCostume());
    el.setAttribute('aria-hidden', 'true');
    mount.appendChild(el);
    log('playing', act.id, act.anim, el.textContent);

    const done = () => {
        el.remove();
        playing = false;
    };

    const fallback = window.setTimeout(done, act.durationMs + 400);
    el.addEventListener('animationend', () => {
        clearTimeout(fallback);
        done();
    }, { once: true });

    return true;
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
    playing = false;
    clearTimers();
    if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
    }
    document.querySelectorAll('.sky-theater-actor').forEach((n) => n.remove());
}

/** Dev helper: force an act by id (e.g. `mon-rocket`). */
export function debugPlayAct(id) {
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
    playing = false;
    return playAct(act);
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
