// ui/modals/quietDragon.js — The Quiet Dragon: a noise meter for the projector.
// A dragon sleeps on its hoard while the class works. The laptop microphone measures only how loud
// the room is (a few readings a second; nothing is recorded, kept or sent). The dragon stirs as the
// room gets louder and wakes if the noise adds up. Waking is final: the quiet time ends there with
// no gift, and the teacher can try again. When the class gives it the calm minutes the teacher asked
// for, it leaves the gift the teacher chose, and the session counts as a completed class bounty.
// Nothing is ever taken away.
// Opened from the projector remote (Projector Mode) or the optional header button.
//
// The stage, in order: the lullaby card (setup) → the dragon learns the room (3 s, live sound bars
// and a countdown ring) → it sleeps (moon clock with hoard pips, the hush meter, a dock of controls)
// → the gift (coins burst from the hoard, then the gift card), or, if it wakes, the woke card. Keys: Space teacher speaking,
// ↑/↓ deeper/lighter sleep, F full screen, Esc end. No sounds play while the microphone listens, so
// the dragon never hears itself.
// Rules: features/quietDragonCore.mjs · Art: ui/quietDragonArt.js · Gift: db/actions/quietDragon.js
import { quietly } from '../../utils/runtimeMetrics.js';
import { GOLD_COIN_HTML } from '../../utils/goldCoin.js';
import '../../styles/quiet_dragon.css';
import { quietDragonSound, warmQuietDragonSounds } from '../../features/quietDragonSounds.js';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import { quietDragonHtml } from '../quietDragonArt.js';
import { lairBackHtml, lairFrontHtml, journeyHtml, flyCamera, settleCamera, CAVE_Z_END, easeInCamera } from '../quietDragonCave.js';
import {
    QUIET_LEVELS, QUIET_MINUTES, DEFAULT_MINUTES, CALIBRATE_SECONDS, HOARD_GIFTS, HOARD_PIECES, CLASS_TREATS,
    levelByKey, clampMinutes, rmsDb, calibrateFloor, tuneBy, createDragonEars, countsAsCalm, hoardPiecesFor,
    formatClock, normalizeGift, giftIsReady, hoardGiftLine, hoardGiftByKey
} from '../../features/quietDragonCore.mjs';
import { esc, myClasses, classById, classRoster, selectedToolClassId, followSelectedClass, reducedMotion, enterFullscreen, leaveFullscreen } from './classTools.js';

const STAGE_ID = 'quiet-dragon-stage';
const PREF_KEY = 'gcq.quietDragon.prefs';
const TICK_MS = 150;
const RING_R = 54;
const RING_LENGTH = 2 * Math.PI * RING_R;
const CAL_R = 30;
const CAL_LENGTH = 2 * Math.PI * CAL_R;
const DEFAULT_AMOUNTS = { gold: 2, stars: 0.5, quest: 1 };
const METER_MAX = 1.5; // the hush meter shows loudness up to 1.5× the limit
const ROLL_START = 2.35; // seconds into the gift when the first hero's share lands (matches the CSS)

const MOOD_TEXT = {
    asleep: 'Fast asleep…',
    stirring: 'The dragon stirs…',
    peeking: 'One eye opens… shhh!',
    awake: 'The dragon is awake!',
    gift: 'The dragon wakes gently, very pleased with you.'
};

let stage = null;   // the overlay element
let run = null;     // the live session (null while setting up)
let ui = null;      // setup choices
let unfollow = null;
let toastTimer = null;
let controlsTimer = null;

// ─── Preferences (per device) ────────────────────────────────────────────────

function readPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; }
}

function savePrefs() {
    try {
        localStorage.setItem(PREF_KEY, JSON.stringify({ level: ui.level, minutes: ui.minutes, gift: ui.gift, customTreat: ui.customTreat }));
    } catch { /* private window: fine */ }
}

const $ = (sel) => stage?.querySelector(sel);

// ─── Open / close ─────────────────────────────────────────────────────────────

/** Opens the Quiet Dragon. `from` is 'wallpaper' or 'header' (only changes the wording of the way out). */
export function openQuietDragon({ from = 'header', lite: forceLite = null, origin = null, journey: wantJourney = true } = {}) {
    if (stage) return;
    const prefs = readPrefs();
    ui = {
        from,
        classId: selectedToolClassId() || (myClasses().length === 1 ? myClasses()[0].id : null),
        level: levelByKey(prefs.level).key,
        minutes: clampMinutes(prefs.minutes || DEFAULT_MINUTES),
        gift: normalizeGift(prefs.gift || { hoard: { key: 'gold', amount: 2 }, treat: '' }),
        customTreat: String(prefs.customTreat || ''),
        treatOpen: false,
        error: ''
    };
    const lite = forceLite ?? (detectLowPowerTier() || reducedMotion());
    stage = document.createElement('div');
    stage.id = STAGE_ID;
    stage.className = `qd-stage${lite ? ' qd-stage--lite' : ''}${reducedMotion() ? ' qd-stage--still' : ''}`;
    stage.dataset.phase = 'setup';
    stage.dataset.mood = 'asleep';
    stage.setAttribute('role', 'dialog');
    stage.setAttribute('aria-modal', 'true');
    stage.setAttribute('aria-label', 'The Quiet Dragon');
    const journey = wantJourney && !reducedMotion();
    stage.dataset.journey = journey ? 'on' : 'done';
    stage.innerHTML = sceneHtml(lite, journey);
    setOrigin(origin);
    document.body.appendChild(stage);
    document.body.classList.add('qd-open');
    // The story opens from the button that called it: a circle of darkness opens onto a cave mouth,
    // and the camera travels through the tunnel to the lair where the dragon sleeps (two frames so
    // the closed circle paints first).
    requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!stage) return;
        stage.classList.add('is-in');
        warmQuietDragonSounds().then(() => quietDragonSound('open', { at: journey ? 0.2 : 0 }));
        if (journey) {
            camera = flyCamera(stage, { duration: lite ? 2000 : 4200, story: true });
            camera.done.then(() => arrive());
        } else {
            arrive();
        }
    }));

    stage.addEventListener('click', onClick);
    stage.addEventListener('input', onInput);
    stage.addEventListener('pointermove', wakeControls, { passive: true });
    stage.addEventListener('toggle', onToggle, true);
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('fullscreenchange', syncFullscreen);
    unfollow = followSelectedClass((classId) => {
        if (stage?.dataset.phase === 'setup' && classId) { ui.classId = classId; renderPanel(); }
    });
    renderPanel();
    setHoard(0);
}

let camera = null;

/** The camera has reached the lair: the cinema bars lift and the lullaby card slides in. */
function arrive() {
    camera = null;
    if (!stage || stage.classList.contains('is-out')) return;
    settleCamera(stage);
    stage.dataset.journey = 'done';
    stage.classList.add('is-arrived');
    setTimeout(() => stage?.querySelector('.qd-arches')?.remove(), 900);
}

/** Where the night opens from (and closes back into): the button's centre, or low in the middle. */
function setOrigin(origin) {
    let x = window.innerWidth / 2;
    let y = window.innerHeight * 0.62;
    const r = origin?.getBoundingClientRect?.();
    if (r && r.width) { x = r.left + r.width / 2; y = r.top + r.height / 2; }
    stage.style.setProperty('--qd-ox', `${Math.round(x)}px`);
    stage.style.setProperty('--qd-oy', `${Math.round(y)}px`);
    // The circle must reach the farthest corner.
    const far = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    stage.style.setProperty('--qd-or', `${Math.ceil(far) + 40}px`);
}

function closeQuietDragon() {
    if (!stage) return;
    // Back into the button if it is still on screen.
    const btn = ui?.from === 'header' ? document.getElementById('quiet-dragon-btn') : null;
    if (btn?.getClientRects().length) setOrigin(btn);
    camera?.cancel();
    camera = null;
    // The camera pulls back out of the lair as the circle closes (not on weak or still screens).
    const pullBack = !stage.classList.contains('qd-stage--lite') && !stage.classList.contains('qd-stage--still');
    if (pullBack) {
        settleCamera(stage);
        stage.classList.add('is-leaving-lair');
        flyCamera(stage, { from: CAVE_Z_END, to: CAVE_Z_END - 2.2, duration: 1000, ease: easeInCamera });
    }
    const wasListening = Boolean(run?.timer);
    stopListening();
    if (!wasListening) quietDragonSound('close');
    unfollow?.();
    unfollow = null;
    clearTimeout(toastTimer);
    clearTimeout(controlsTimer);
    window.removeEventListener('keydown', onKey, true);
    document.removeEventListener('fullscreenchange', syncFullscreen);
    if (document.fullscreenElement === stage) leaveFullscreen();
    const el = stage;
    stage = null;
    run = null;
    document.body.classList.remove('qd-open');
    el.classList.add('is-out');
    el.classList.remove('is-in');
    const still = el.classList.contains('qd-stage--lite') || el.classList.contains('qd-stage--still');
    setTimeout(() => el.remove(), still ? 260 : 1050);
}

// ─── Markup ───────────────────────────────────────────────────────────────────

function starsHtml(lite) {
    // Fixed positions (no randomness on every open) so the sky is the same each lesson.
    const count = lite ? 22 : 54;
    let html = '';
    for (let i = 0; i < count; i++) {
        const x = (i * 61.8 + 7) % 100;
        const y = ((i * 37.3) % 58) + 2;
        const size = 1 + ((i * 7) % 3);
        const twinkle = !lite && i % 4 === 0 ? ' qd-star--twinkle' : '';
        html += `<i class="qd-star${twinkle}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--s:${size}px;--d:${(i % 5) * 0.9}s"></i>`;
    }
    return html;
}

/** The eight hoard pips sit on the moon ring where each treasure lands. */
function ringPipsHtml() {
    let html = '';
    for (let i = 1; i <= HOARD_PIECES; i++) {
        const a = (i / HOARD_PIECES) * Math.PI * 2;
        html += `<circle class="qd-ring__pip" data-pip="${i}" cx="${(60 + RING_R * Math.cos(a)).toFixed(2)}" cy="${(60 + RING_R * Math.sin(a)).toFixed(2)}" r="4.2"/>`;
    }
    return html;
}

function burstHtml(lite) {
    const n = lite ? 8 : 18;
    let html = '';
    for (let i = 0; i < n; i++) {
        const spread = (i / (n - 1)) * 2 - 1;               // -1 … 1, left to right
        const x = (spread * 34 + ((i * 13) % 7) - 3).toFixed(1);
        const y = (-(30 + ((i * 17) % 26))).toFixed(1);
        const spin = ((i * 97) % 720) - 360;
        html += `<i style="--x:${x}vw;--y:${y}vh;--r:${spin}deg;--d:${(i % 6) * 0.07}s" class="${i % 5 === 0 ? 'is-gem' : ''}"></i>`;
    }
    return html;
}

function sceneHtml(lite, journey) {
    return `
    <div class="qd-world">
        <div class="qd-sky" aria-hidden="true">
            <div class="qd-stars">${starsHtml(lite)}</div>
            ${lite ? '' : '<i class="qd-shooting"></i>'}
        </div>
        ${lite ? '' : '<div class="qd-aurora" aria-hidden="true"><i></i><i></i></div>'}
        ${lairBackHtml()}
        <div class="qd-beam" aria-hidden="true"></div>
        <div class="qd-glow" aria-hidden="true"></div>
        <div class="qd-rays" aria-hidden="true"></div>
        ${lite ? '' : `<div class="qd-embers" aria-hidden="true">${'<i></i>'.repeat(12)}</div>`}
        ${lite ? '' : '<div class="qd-motes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'}
        <div class="qd-scene">
            ${quietDragonHtml()}
            <div class="qd-breath-gold" aria-hidden="true">${'<i></i>'.repeat(lite ? 0 : 14)}</div>
            <div class="qd-burst" aria-hidden="true">${burstHtml(lite)}</div>
            <div class="qd-shock" aria-hidden="true"><i></i><i></i></div>
        </div>
        ${lite ? '' : `<div class="qd-lull" aria-hidden="true">${'<i></i>'.repeat(16)}</div>`}
        ${lairFrontHtml()}
    </div>
    <div class="qd-alarm" aria-hidden="true"></div>
    <div class="qd-flash" aria-hidden="true"></div>
    ${journey ? journeyHtml(lite) : ''}
    <div class="qd-veil" aria-hidden="true"></div>

    <header class="qd-hud">
        <div class="qd-hud__title">
            <span class="qd-hud__class" data-qd-class></span>
            <h2 class="qd-hud__name">The Quiet Dragon</h2>
            <p class="qd-mood" data-qd-mood aria-live="polite">Fast asleep…</p>
        </div>
        <div class="qd-hud__side">
            <div class="qd-ring" data-qd-ring>
                <span class="qd-ring__halo" aria-hidden="true"></span>
                <span class="qd-ring__moon" aria-hidden="true"><span class="qd-ring__shade"></span></span>
                <svg viewBox="0 0 120 120" aria-hidden="true">
                    <circle class="qd-ring__track" cx="60" cy="60" r="${RING_R}"/>
                    <circle class="qd-ring__fill" cx="60" cy="60" r="${RING_R}" style="stroke-dasharray:${RING_LENGTH.toFixed(1)};stroke-dashoffset:${RING_LENGTH.toFixed(1)}"/>
                    ${ringPipsHtml()}
                </svg>
                <span class="qd-ring__pause" aria-hidden="true"><i></i><i></i></span>
            </div>
            <div class="qd-ring__text"><strong data-qd-left>15:00</strong><span data-qd-left-label>calm minutes to go</span></div>
            <div class="qd-hush" data-qd-hush>
                <div class="qd-hush__row">
                    <span class="qd-hush__label"><i class="fas fa-volume-low" aria-hidden="true"></i> The room</span>
                    <span class="qd-hush__zones" aria-hidden="true"><b>calm</b><b>stirs</b><b>wakes</b></span>
                </div>
                <div class="qd-hush__track" role="meter" aria-label="How loud the room is" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-qd-meter>
                    <span class="qd-hush__fill" data-qd-ear></span>
                    <span class="qd-hush__rail" data-qd-rail><i class="qd-hush__orb"></i></span>
                </div>
                <div class="qd-hush__row qd-hush__row--wake">
                    <span class="qd-hush__label"><i class="fas fa-eye" aria-hidden="true"></i> Waking</span>
                    <span class="qd-hush__wake"><span data-qd-wake></span></span>
                </div>
            </div>
        </div>
    </header>

    <div class="qd-banner" data-qd-banner aria-live="assertive">
        <div class="qd-banner__awake">
            <strong>Too loud!</strong>
            <span>The dragon woke up. The quiet time is over.</span>
        </div>
        <div class="qd-banner__held">
            <strong><i class="fas fa-person-chalkboard" aria-hidden="true"></i> Teacher speaking</strong>
            <span>The dragon is not listening. The clock waits.</span>
        </div>
    </div>
    <p class="qd-toast" data-qd-toast aria-live="polite"></p>

    <div class="qd-dock" role="toolbar" aria-label="Quiet Dragon controls">
        <button type="button" class="qd-ctl qd-ctl--hold" data-qd="hold" title="I am speaking: stop listening" aria-pressed="false"><i class="fas fa-person-chalkboard" aria-hidden="true"></i><span data-qd-hold-label>Teacher speaking</span><kbd>Space</kbd></button>
        <span class="qd-dock__group" role="group" aria-label="How deeply it sleeps">
            <button type="button" class="qd-ctl qd-ctl--icon" data-qd="tune-down" title="Lighter sleep: wakes more easily (↓)" aria-label="Lighter sleep"><i class="fas fa-ear-listen" aria-hidden="true"></i></button>
            <span class="qd-depth" data-qd-depth aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
            <button type="button" class="qd-ctl qd-ctl--icon" data-qd="tune-up" title="Deeper sleep: wakes less easily (↑)" aria-label="Deeper sleep"><i class="fas fa-moon" aria-hidden="true"></i></button>
        </span>
        <button type="button" class="qd-ctl qd-ctl--icon" data-qd="fullscreen" title="Full screen (F)" aria-label="Full screen"><i class="fas fa-expand" aria-hidden="true"></i></button>
        <button type="button" class="qd-ctl qd-ctl--end" data-qd="end" title="End the quiet time"><i class="fas fa-door-open" aria-hidden="true"></i><span>End</span><kbd>Esc</kbd></button>
    </div>

    <div class="qd-panel-wrap"><section class="qd-panel" data-qd-panel></section></div>`;
}

function classLine(classId) {
    const cls = classById(classId);
    if (!cls) return '';
    return `${cls.logo ? `<span aria-hidden="true">${esc(cls.logo)}</span> ` : ''}${esc(cls.name || 'Class')}`;
}

function levelIcon(index) {
    // A crescent that fills as the room may grow louder: thin for pin-drop, round for soft voices.
    const cut = [4, 8, 22][index] ?? 8;
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><defs><mask id="qd-lv-${index}"><rect width="32" height="32" fill="#fff"/><circle cx="${16 + cut}" cy="${16 - cut * 0.45}" r="11" fill="#000"/></mask></defs><circle cx="16" cy="16" r="11" fill="currentColor" mask="url(#qd-lv-${index})"/></svg>`;
}

/** A little sound line for each quiet level: flat for pin-drop, a ripple for whispers, waves for soft voices. */
function waveIcon(index) {
    const amp = [1.2, 4, 8][index] ?? 4;
    let d = 'M2 16';
    for (let x = 2; x <= 46; x += 4) d += ` Q ${x + 1} ${16 - amp * (x % 8 === 2 ? 1 : -1)} ${x + 2} 16`;
    return `<svg viewBox="0 0 48 32" aria-hidden="true"><path d="${d} L46 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
}

/** The dragon's sleeping eye: the crest of the lullaby card. */
function crestHtml() {
    return `<span class="qd-crest" aria-hidden="true">
        <svg viewBox="0 0 64 64">
            <defs><radialGradient id="qd-crest-g" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#e9fffb"/><stop offset=".45" stop-color="#7fe3d9"/><stop offset="1" stop-color="#1f6f7a"/></radialGradient></defs>
            <circle cx="32" cy="32" r="29" fill="url(#qd-crest-g)"/>
            <path class="qd-crest__lid" d="M14 34 Q32 46 50 34" fill="none" stroke="#0b2a33" stroke-width="3.4" stroke-linecap="round"/>
            <path d="M18 39 l-3 4 M25 42 l-1.5 4.5 M32 43 v5 M39 42 l1.5 4.5 M46 39 l3 4" stroke="#0b2a33" stroke-width="2.4" stroke-linecap="round"/>
            <circle cx="22" cy="20" r="4" fill="#fff" opacity=".7"/>
        </svg>
        <i class="qd-crest__z">z</i><i class="qd-crest__z">z</i>
    </span>`;
}

function minutesDial(minutes) {
    const r = 46;
    const len = 2 * Math.PI * r;
    const frac = Math.min(1, minutes / 60);
    const ticks = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        return `<line x1="${(60 + 52 * Math.cos(a)).toFixed(1)}" y1="${(60 + 52 * Math.sin(a)).toFixed(1)}" x2="${(60 + 56 * Math.cos(a)).toFixed(1)}" y2="${(60 + 56 * Math.sin(a)).toFixed(1)}"/>`;
    }).join('');
    return `<span class="qd-dial" aria-hidden="true">
        <svg viewBox="0 0 120 120">
            <g class="qd-dial__ticks">${ticks}</g>
            <circle class="qd-dial__track" cx="60" cy="60" r="${r}"/>
            <circle class="qd-dial__fill" cx="60" cy="60" r="${r}" style="stroke-dasharray:${len.toFixed(1)};stroke-dashoffset:${(len * (1 - frac)).toFixed(1)}"/>
        </svg>
        <span class="qd-dial__value"><strong data-qd-minutes-value>${minutes}</strong><small>calm min</small></span>
    </span>`;
}

function setupHtml() {
    const classes = myClasses();
    const cls = classById(ui.classId);
    const here = cls ? classRoster(cls.id).filter((h) => !h.away).length : 0;
    const gift = ui.gift;
    const giftDef = hoardGiftByKey(gift.hoard.key);
    const isCustom = gift.treat && !CLASS_TREATS.includes(gift.treat);
    const ready = Boolean(cls) && giftIsReady(gift);
    const level = levelByKey(ui.level);
    const tokens = [
        `<span class="qd-token"><span class="qd-token__icon">${levelIcon(QUIET_LEVELS.indexOf(level))}</span>${esc(level.name)}</span>`,
        `<span class="qd-token"><i class="fas fa-hourglass-half" aria-hidden="true"></i><b>${ui.minutes}</b> min</span>`,
        hoardGiftLine(gift) ? `<span class="qd-token qd-token--gift"><span class="qd-token__icon">${giftIcon(gift.hoard.key)}</span>${esc(amountLabel(gift.hoard.key, gift.hoard.amount))}</span>` : '',
        gift.treat ? `<span class="qd-token qd-token--treat"><span class="qd-token__icon">${giftIcon('none')}</span>${esc(gift.treat)}</span>` : ''
    ].filter(Boolean).join('');
    let step = 0;
    const num = () => `<b class="qd-step__num">${++step}</b>`;
    return `
    <div class="qd-panel__head">
        ${crestHtml()}
        <div>
            <p class="qd-panel__kicker">A lullaby for the class</p>
            <h3 class="qd-panel__title">Let the dragon sleep</h3>
            <p class="qd-panel__lede">Keep the room calm and it leaves a gift. If the noise wakes it, the quiet time ends with no gift.</p>
        </div>
        <button type="button" class="qd-x" data-qd="close" aria-label="Close"><i class="fas fa-xmark"></i></button>
    </div>

    <div class="qd-panel__body">
        ${cls ? `<p class="qd-panel__class"><span class="qd-panel__classname">${classLine(cls.id)}</span><span class="qd-panel__heroes"><i class="fas fa-user-group" aria-hidden="true"></i> ${here} hero${here === 1 ? '' : 'es'} here</span></p>`
        : `<section class="qd-step"><span class="qd-label">${num()} Which class?</span><div class="qd-chips">${classes.map((c) => `<button type="button" class="qd-chip" data-qd-class-pick="${esc(c.id)}">${esc(c.logo || '')} ${esc(c.name || 'Class')}</button>`).join('') || '<em class="qd-muted">Add a class first.</em>'}</div></section>`}

        <section class="qd-step">
            <span class="qd-label">${num()} How quiet?</span>
            <div class="qd-levels">
                ${QUIET_LEVELS.map((l, i) => `<button type="button" class="qd-level qd-level--${i}${ui.level === l.key ? ' is-on' : ''}" data-qd-level="${l.key}" aria-pressed="${ui.level === l.key}">
                    <span class="qd-level__icon">${levelIcon(i)}</span>
                    <span class="qd-level__wave">${waveIcon(i)}</span>
                    <strong>${esc(l.name)}</strong><small>${esc(l.hint)}</small></button>`).join('')}
            </div>
        </section>

        <section class="qd-step">
            <span class="qd-label">${num()} How long?</span>
            <div class="qd-time">
                <div class="qd-stepper">
                    <button type="button" class="qd-stepper__btn" data-qd="minus" aria-label="One minute less" ${ui.minutes <= 1 ? 'disabled' : ''}><i class="fas fa-minus"></i></button>
                    ${minutesDial(ui.minutes)}
                    <button type="button" class="qd-stepper__btn" data-qd="plus" aria-label="One minute more" ${ui.minutes >= 60 ? 'disabled' : ''}><i class="fas fa-plus"></i></button>
                </div>
                <div class="qd-chips qd-chips--quick" role="group" aria-label="Quick picks">
                    ${QUIET_MINUTES.map((m) => `<button type="button" class="qd-chip${ui.minutes === m ? ' is-on' : ''}" data-qd-minutes="${m}" aria-pressed="${ui.minutes === m}">${m}<small>min</small></button>`).join('')}
                </div>
            </div>
        </section>

        <section class="qd-step">
            <span class="qd-label">${num()} The dragon's gift</span>
            <div class="qd-gifts">
                ${HOARD_GIFTS.map((g) => `<button type="button" class="qd-gift qd-gift--${g.key}${gift.hoard.key === g.key ? ' is-on' : ''}" data-qd-hoard="${g.key}" aria-pressed="${gift.hoard.key === g.key}">
                    <span class="qd-gift__niche"><span class="qd-gift__icon" aria-hidden="true">${giftIcon(g.key)}</span></span>
                    <strong>${esc(g.name)}</strong><small>${esc(g.hint)}</small></button>`).join('')}
            </div>
            ${giftDef.amounts.length ? `<div class="qd-amounts" role="group" aria-label="How much">${giftDef.amounts.map((a) => `<button type="button" class="qd-amount${gift.hoard.amount === a ? ' is-on' : ''}" data-qd-amount="${a}" aria-pressed="${gift.hoard.amount === a}">${amountLabel(giftDef.key, a)}</button>`).join('')}</div>` : ''}
            <details class="qd-treat"${ui.treatOpen || gift.hoard.key === 'none' ? ' open' : ''}>
                <summary><span class="qd-gift__icon" aria-hidden="true">${giftIcon('none')}</span><span><strong>${gift.treat ? esc(gift.treat) : 'Add a classroom treat'}</strong><small>${gift.treat ? 'You give it in person' : 'Optional, you give it in person'}</small></span><i class="fas fa-chevron-down" aria-hidden="true"></i></summary>
                <div class="qd-chips">
                    <button type="button" class="qd-chip${!gift.treat ? ' is-on' : ''}" data-qd-treat="">No treat</button>
                    ${CLASS_TREATS.map((t) => `<button type="button" class="qd-chip${gift.treat === t ? ' is-on' : ''}" data-qd-treat="${esc(t)}">${esc(t)}</button>`).join('')}
                    <label class="qd-chip qd-chip--input${isCustom ? ' is-on' : ''}"><i class="fas fa-pen" aria-hidden="true"></i><input type="text" maxlength="80" data-qd-treat-input value="${esc(isCustom ? gift.treat : ui.customTreat)}" placeholder="Your own treat…" aria-label="Your own treat"></label>
                </div>
            </details>
        </section>

        <p class="qd-privacy"><i class="fas fa-microphone-lines" aria-hidden="true"></i> The microphone only measures how loud the room is. Nothing is recorded, kept or sent anywhere.</p>
        ${ui.error ? `<p class="qd-error" role="alert">${esc(ui.error)}</p>` : ''}
    </div>

    <div class="qd-panel__foot">
        <div class="qd-summary" data-qd-summary>${ready ? tokens : `<span class="qd-summary__hint">${cls ? 'Pick a gift or a treat' : 'Pick a class'}</span>`}</div>
        <div class="qd-actions">
            <button type="button" class="qd-btn qd-btn--ghost" data-qd="close">${ui.from === 'wallpaper' ? 'Back' : 'Not now'}</button>
            <button type="button" class="qd-btn qd-btn--go qd-btn--big" data-qd="start" ${ready ? '' : 'disabled'}><span class="qd-btn__gem" aria-hidden="true"><i class="fas fa-moon"></i></span><span>Let the dragon sleep</span></button>
        </div>
    </div>`;
}

function amountLabel(key, amount) {
    if (key === 'gold') return `+${amount} Gold each`;
    if (key === 'stars') return amount === 0.5 ? '+½ star each' : `+${amount} star each`;
    if (key === 'quest') return `+${amount} Team Quest`;
    return String(amount);
}

function giftIcon(key) {
    // Gold is always the app's own coin; the rest are small hand-drawn marks matching the hoard.
    if (key === 'gold') return `<span class="qd-coin">${GOLD_COIN_HTML}</span>`;
    if (key === 'stars') return '<svg viewBox="0 0 40 40"><path d="M20 4 L24.5 15 L36 15.6 L27 23 L30 34.5 L20 28 L10 34.5 L13 23 L4 15.6 L15.5 15 Z" fill="#ffd970" stroke="#b9823c" stroke-width="1.5" stroke-linejoin="round"/><path d="M20 9 L22.6 16.5" stroke="#fff6dc" stroke-width="2" stroke-linecap="round"/></svg>';
    if (key === 'quest') return '<svg viewBox="0 0 40 40"><path d="M6 32 C 12 22 18 26 22 18 C 25 12 30 12 34 6" fill="none" stroke="#c7b3ff" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round"/><path d="M30 4 L30 14 M30 4 L38 7 L30 10" fill="#ff7a59" stroke="#ff7a59" stroke-width="2" stroke-linejoin="round"/><circle cx="6" cy="32" r="3.5" fill="#5eead4"/></svg>';
    return '<svg viewBox="0 0 40 40"><rect x="7" y="16" width="26" height="18" rx="3" fill="#a3564b"/><rect x="5" y="11" width="30" height="7" rx="2" fill="#e07a5f"/><path d="M20 11 V34" stroke="#ffd970" stroke-width="3"/><path d="M20 11 C 14 4 8 8 12 11 M20 11 C 26 4 32 8 28 11" fill="none" stroke="#ffd970" stroke-width="2.5" stroke-linecap="round"/></svg>';
}

function calibrateHtml() {
    return `
    <div class="qd-panel__center qd-calibrate">
        <div class="qd-cal">
            <svg viewBox="0 0 70 70" aria-hidden="true">
                <circle class="qd-cal__track" cx="35" cy="35" r="${CAL_R}"/>
                <circle class="qd-cal__fill" cx="35" cy="35" r="${CAL_R}" data-qd-cal-ring style="stroke-dasharray:${CAL_LENGTH.toFixed(1)};stroke-dashoffset:${CAL_LENGTH.toFixed(1)}"/>
            </svg>
            <strong data-qd-cal-count>${CALIBRATE_SECONDS}</strong>
        </div>
        <span class="qd-listen" aria-hidden="true" data-qd-bars>${'<i></i>'.repeat(13)}</span>
        <h3 class="qd-panel__title">Shhh… the dragon is listening</h3>
        <p class="qd-panel__lede">Stay quiet for ${CALIBRATE_SECONDS} seconds so it learns how a calm room sounds here.</p>
    </div>`;
}

function confirmEndHtml() {
    const done = run ? Math.floor((run.calm || 0) / 60) : 0;
    return `
    <div class="qd-panel__center qd-end-card">
        ${crestHtml()}
        <h3 class="qd-panel__title">End the quiet time?</h3>
        <p class="qd-panel__lede">${done ? `The class has given the dragon <b>${done} calm minute${done === 1 ? '' : 's'}</b> so far.` : 'The dragon has only just fallen asleep.'} You can still give the gift if you feel they earned it.</p>
        <div class="qd-actions qd-actions--stack">
            <button type="button" class="qd-btn qd-btn--go" data-qd="resume"><span class="qd-btn__gem" aria-hidden="true"><i class="fas fa-moon"></i></span><span>Keep listening</span></button>
            <button type="button" class="qd-btn qd-btn--gold" data-qd="gift-now"><span class="qd-btn__gem" aria-hidden="true"><i class="fas fa-gift"></i></span><span>Give the gift now</span></button>
            <button type="button" class="qd-btn qd-btn--ghost" data-qd="close">End without a gift</button>
        </div>
    </div>`;
}

function wokeHtml() {
    const calm = Math.floor(run?.calm || 0);
    const goal = run?.goal || 0;
    const pieces = hoardPiecesFor(goal ? calm / goal : 0);
    return `
    <div class="qd-panel__center qd-woke-card">
        <span class="qd-woke-card__eye" aria-hidden="true"><svg viewBox="0 0 80 48"><path d="M4 24 Q40 -6 76 24 Q40 54 4 24 Z" fill="#2a0a0a" stroke="#ff9a4a" stroke-width="2.5"/><ellipse class="qd-woke-card__iris" cx="40" cy="24" rx="15" ry="15" fill="#ffb02e"/><ellipse class="qd-woke-card__pupil" cx="40" cy="24" rx="3.2" ry="13" fill="#1a0400"/><circle cx="34" cy="18" r="3" fill="#fff6d0" opacity=".85"/></svg></span>
        <p class="qd-gift-card__kicker">The quiet time is over</p>
        <h3 class="qd-panel__title">The dragon woke up!</h3>
        <div class="qd-stats">
            <span><strong>${formatClock(calm)}</strong><small>calm time</small></span>
            <span><strong>${formatClock(goal)}</strong><small>it needed</small></span>
            <span><strong>${pieces}/${HOARD_PIECES}</strong><small>treasures</small></span>
        </div>
        <p class="qd-panel__lede">The room got too loud and the dragon woke. It keeps its hoard, so there is no gift this time.</p>
        <div class="qd-actions qd-actions--stack">
            <button type="button" class="qd-btn qd-btn--go" data-qd="again"><span class="qd-btn__gem" aria-hidden="true"><i class="fas fa-moon"></i></span><span>Try again from the start</span></button>
            <button type="button" class="qd-btn qd-btn--ghost" data-qd="close">${ui?.from === 'wallpaper' ? 'Back to the projector' : 'Close'}</button>
        </div>
    </div>`;
}

/** First names for the hero roll (a last-name initial when two heroes share a first name). */
function heroLabels(heroes) {
    const counts = new Map();
    heroes.forEach((h) => counts.set(h.first, (counts.get(h.first) || 0) + 1));
    return heroes.map((h) => {
        if (counts.get(h.first) < 2) return { id: h.id, label: h.first };
        const last = String(h.name || '').trim().split(/\s+/).slice(1).join(' ');
        return { id: h.id, label: last ? `${h.first} ${last.charAt(0)}.` : h.first };
    });
}

/** Every hero who was here, by name: each lights up as their share lands. */
function rollHtml(gift) {
    const heroes = run.heroes || [];
    if (!heroes.length) return '';
    const perHero = gift.hoard.key === 'gold' || gift.hoard.key === 'stars';
    const badge = gift.hoard.key === 'gold' ? `+${gift.hoard.amount}${GOLD_COIN_HTML}`
        : gift.hoard.key === 'stars' ? `+${gift.hoard.amount === 0.5 ? '½' : gift.hoard.amount}<i class="fas fa-star" aria-hidden="true"></i>` : '';
    const step = Math.min(0.09, 1.4 / heroes.length);
    return `<ul class="qd-roll${perHero ? '' : ' qd-roll--plain'}" aria-label="Heroes who were here">
        ${heroLabels(heroes).map((h, i) => `<li style="--i:${(i * step).toFixed(3)}s"><span>${esc(h.label)}</span>${badge ? `<b>${badge}</b>` : ''}</li>`).join('')}
    </ul>`;
}

function giftStatusHtml(result) {
    const gift = run.gift;
    if (!result) return `<span class="qd-status qd-pending"><i class="fas fa-feather-pointed" aria-hidden="true"></i> ${gift.hoard.key === 'none' ? 'Writing it in the class log…' : 'Placing it in the hoard…'}</span>`;
    const paid = result.paid || result.alreadyPaid;
    if (!paid && gift.hoard.key === 'none') return '<span class="qd-status is-bad"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> This could not be saved. Check the connection and try again.</span>';
    if (gift.hoard.key === 'none') return '<span class="qd-status is-ok"><i class="fas fa-circle-check" aria-hidden="true"></i> Saved in the class log</span>';
    if (!paid) {
        const some = result.heroes > 0 ? ` ${result.heroes} of ${run.heroIds.length} heroes have theirs.` : '';
        return `<span class="qd-status is-bad"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> Not everything could be saved.${esc(some)} Check the connection and try again.</span>`;
    }
    if (gift.hoard.key === 'quest') return '<span class="qd-status is-ok"><i class="fas fa-circle-check" aria-hidden="true"></i> Added to this month’s Team Quest</span>';
    const heroes = result.heroes || run.heroIds.length;
    return `<span class="qd-status is-ok"><i class="fas fa-circle-check" aria-hidden="true"></i> Given to ${heroes} hero${heroes === 1 ? '' : 'es'}</span>`;
}

function giftActionsHtml(result) {
    const failed = result && !(result.paid || result.alreadyPaid);
    return `${failed ? '<button type="button" class="qd-btn qd-btn--gold" data-qd="retry-pay"><span class="qd-btn__gem" aria-hidden="true"><i class="fas fa-rotate"></i></span><span>Try again</span></button>' : ''}
        <button type="button" class="qd-btn qd-btn--go" data-qd="close"><span>${ui.from === 'wallpaper' ? 'Back to the projector' : 'Close'}</span></button>`;
}

/** The big amount under the title: "+2 Gold", "+½ star", "+1 Team Quest", or the treat. */
function giftHeadline(gift) {
    const { key, amount } = gift.hoard;
    if (key === 'gold') return `<span class="qd-reveal__amount"><span class="qd-reveal__line"><b>+${amount}</b>${GOLD_COIN_HTML}<em>Gold</em></span><small>for every hero here</small></span>`;
    if (key === 'stars') return `<span class="qd-reveal__amount"><span class="qd-reveal__line"><b>+${amount === 0.5 ? '½' : amount}</b><i class="fas fa-star qd-reveal__star" aria-hidden="true"></i><em>star</em></span><small>for every hero here</small></span>`;
    if (key === 'quest') return `<span class="qd-reveal__amount"><span class="qd-reveal__line"><b>+${amount}</b><em>Team Quest</em></span><small>for the whole class</small></span>`;
    return `<span class="qd-reveal__amount qd-reveal__amount--treat">${esc(gift.treat)} <small>from the teacher, in person</small></span>`;
}

function giftHtml(result) {
    const gift = run.gift;
    const title = 'The dragon leaves a gift!';
    const letters = [...title].map((ch, i) => ch === ' ' ? ' ' : `<span style="--i:${i}">${esc(ch)}</span>`).join('');
    const medal = gift.hoard.key === 'none' ? 'none' : gift.hoard.key;
    return `
    <div class="qd-panel__center qd-gift-card qd-gift-card--${medal}">
        <div class="qd-medal" aria-hidden="true">
            <span class="qd-medal__rays"></span>
            <span class="qd-medal__ring"></span>
            <span class="qd-medal__face">${giftIcon(medal)}</span>
            <span class="qd-medal__orbit"><i></i><i></i><i></i><i></i><i></i></span>
        </div>
        <p class="qd-gift-card__kicker">${run.calm >= run.goal ? `${run.minutes} calm minute${run.minutes === 1 ? '' : 's'} · it never woke` : `${run.minutes} calm minute${run.minutes === 1 ? '' : 's'} · ended early with a gift`}</p>
        <h3 class="qd-panel__title qd-reveal__title" aria-label="${esc(title)}">${letters}</h3>
        ${giftHeadline(gift)}
        ${rollHtml(gift)}
        ${gift.treat && gift.hoard.key !== 'none' ? `<p class="qd-reveal__treat"><span class="qd-gift__icon" aria-hidden="true">${giftIcon('none')}</span><span><strong>${esc(gift.treat)}</strong><small>And a treat from the teacher, in person.</small></span></p>` : ''}
        <p class="qd-reveal__status" data-qd-status aria-live="polite">${giftStatusHtml(result)}</p>
        <div class="qd-actions" data-qd-gift-actions>${giftActionsHtml(result)}</div>
    </div>`;
}

function setPanel(html) {
    const panel = $('[data-qd-panel]');
    if (!panel) return;
    // Keep the setup card's scroll position while it re-renders after a pick.
    const body = panel.querySelector('.qd-panel__body');
    const top = body?.scrollTop || 0;
    panel.innerHTML = html;
    const next = panel.querySelector('.qd-panel__body');
    if (next && top) next.scrollTop = top;
}

function renderPanel() {
    if (!stage) return;
    $('[data-qd-class]').innerHTML = ui.classId ? classLine(ui.classId) : '';
    if (stage.dataset.phase === 'setup') setPanel(setupHtml());
}

function setHoard(progress, { celebrate = false } = {}) {
    const pieces = hoardPiecesFor(progress);
    stage?.querySelectorAll('[data-hoard]').forEach((g) => {
        const n = Number(g.dataset.hoard);
        const was = g.classList.contains('is-shown');
        g.classList.toggle('is-shown', n <= pieces);
        if (celebrate && !was && n <= pieces) {
            g.classList.remove('is-new');
            void g.getBoundingClientRect();
            g.classList.add('is-new');
        }
    });
    stage?.querySelectorAll('[data-pip]').forEach((p) => p.classList.toggle('is-lit', Number(p.dataset.pip) <= pieces));
}

function showToast(text, ms = 2600) {
    const el = $('[data-qd-toast]');
    if (!el) return;
    el.textContent = text;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el?.classList.remove('is-on'), ms);
}

function setMoodText(text) {
    const el = $('[data-qd-mood]');
    if (el && el.textContent !== text) el.textContent = text;
}

function paintDepth() {
    const tuneSteps = Math.round((run?.tune || 0) / 2); // -3 … 3
    stage?.querySelectorAll('[data-qd-depth] i').forEach((dot, i) => {
        const pos = i - 3;
        dot.classList.toggle('is-on', pos === tuneSteps);
        dot.classList.toggle('is-mid', pos === 0);
    });
}

// ─── Events ───────────────────────────────────────────────────────────────────

function onClick(e) {
    if (stage?.dataset.journey === 'on') { camera?.skip(); return; }
    const t = e.target.closest('button');
    if (!t || !stage) return;
    if (t.dataset.qdClassPick) { ui.classId = t.dataset.qdClassPick; renderPanel(); return; }
    if (t.dataset.qdLevel) { ui.level = t.dataset.qdLevel; savePrefs(); renderPanel(); return; }
    if (t.dataset.qdMinutes) { setMinutes(Number(t.dataset.qdMinutes)); return; }
    if (t.dataset.qdHoard) {
        const def = hoardGiftByKey(t.dataset.qdHoard);
        ui.gift = normalizeGift({ hoard: { key: def.key, amount: def.key === ui.gift.hoard.key ? ui.gift.hoard.amount : DEFAULT_AMOUNTS[def.key] }, treat: ui.gift.treat });
        savePrefs(); renderPanel(); return;
    }
    if (t.dataset.qdAmount) { ui.gift = normalizeGift({ ...ui.gift, hoard: { ...ui.gift.hoard, amount: Number(t.dataset.qdAmount) } }); savePrefs(); renderPanel(); return; }
    if ('qdTreat' in t.dataset) { ui.gift = normalizeGift({ ...ui.gift, treat: t.dataset.qdTreat }); ui.treatOpen = true; savePrefs(); renderPanel(); return; }

    switch (t.dataset.qd) {
        case 'close': closeQuietDragon(); break;
        case 'start': startSession(); break;
        case 'minus': setMinutes(ui.minutes - 1); break;
        case 'plus': setMinutes(ui.minutes + 1); break;
        case 'hold': toggleHold(); break;
        case 'tune-down': tune(-1); break;
        case 'tune-up': tune(1); break;
        case 'fullscreen': toggleFullscreen(); break;
        case 'end': askEnd(); break;
        case 'resume': resume(); break;
        case 'gift-now': finish(); break;
        case 'again': tryAgain(); break;
        case 'retry-pay': payGift(); break;
        default: break;
    }
}

function setMinutes(value) {
    ui.minutes = clampMinutes(value);
    savePrefs();
    renderPanel();
}

function onToggle(e) {
    if (e.target?.classList?.contains('qd-treat') && ui) ui.treatOpen = e.target.open;
}

function onInput(e) {
    if (!stage || stage.dataset.phase !== 'setup') return;
    if (e.target.matches('[data-qd-treat-input]')) {
        ui.customTreat = e.target.value;
        ui.gift = normalizeGift({ ...ui.gift, treat: e.target.value });
        savePrefs();
        stage.querySelectorAll('[data-qd-treat]').forEach((b) => b.classList.toggle('is-on', b.dataset.qdTreat === ui.gift.treat));
        e.target.closest('.qd-chip')?.classList.toggle('is-on', Boolean(ui.gift.treat));
        const ready = Boolean(ui.classId) && giftIsReady(ui.gift);
        const go = $('[data-qd="start"]');
        if (go) go.disabled = !ready;
        const summary = $('.qd-treat summary strong');
        if (summary) summary.textContent = ui.gift.treat || 'Add a classroom treat';
    }
}

function onKey(e) {
    if (!stage) return;
    const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (stage.dataset.phase === 'listening' || stage.dataset.phase === 'calibrating') askEnd();
        else if (stage.dataset.phase === 'ending') resume();
        else closeQuietDragon();
        return;
    }
    if (typing) { e.stopImmediatePropagation(); return; }
    if (stage.dataset.journey === 'on') { e.preventDefault(); e.stopImmediatePropagation(); camera?.skip(); return; }
    const listening = stage.dataset.phase === 'listening';
    if (e.key === ' ' && listening) {
        e.preventDefault();
        if (e.target?.closest?.('button')) e.target.blur();
        toggleHold();
    } else if (listening && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        tune(e.key === 'ArrowUp' ? 1 : -1);
    } else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && stage.dataset.phase !== 'setup') {
        e.preventDefault();
        toggleFullscreen();
    } else if (e.key === 'Enter' && stage.dataset.phase === 'setup' && !e.target?.closest?.('button, summary')) {
        e.preventDefault();
        startSession();
    }
    // The projector's own keys (cards, full screen) stay quiet while the dragon is up.
    e.stopImmediatePropagation();
    wakeControls();
}

function wakeControls() {
    if (!stage) return;
    stage.classList.add('qd-awake-ui');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => stage?.classList.remove('qd-awake-ui'), 3200);
}

function toggleFullscreen() {
    if (!stage) return;
    if (document.fullscreenElement) leaveFullscreen();
    else enterFullscreen(stage);
}

function syncFullscreen() {
    const btn = $('[data-qd="fullscreen"] i');
    if (btn) btn.className = `fas ${document.fullscreenElement ? 'fa-compress' : 'fa-expand'}`;
}

// ─── Listening ────────────────────────────────────────────────────────────────

async function keepScreenOn(on) {
    try {
        if (on && !run?.wakeLock && navigator.wakeLock?.request) {
            const lock = await navigator.wakeLock.request('screen');
            if (run) run.wakeLock = lock; else lock.release().catch(() => {});
        } else if (!on && run?.wakeLock) {
            const lock = run.wakeLock;
            run.wakeLock = null;
            await lock.release();
        }
    } catch { /* the projector's own power settings decide */ }
}

function onVisibility() {
    // Browsers drop the screen lock when the tab hides; take it again on return.
    if (document.visibilityState === 'visible' && run?.timer) keepScreenOn(true);
}

async function startSession() {
    if (!ui.classId || !giftIsReady(ui.gift) || ui.starting) return;
    ui.starting = true;
    try { await beginSession(); } finally { if (ui) ui.starting = false; }
}

async function beginSession() {
    const media = navigator.mediaDevices;
    if (!media?.getUserMedia) {
        ui.error = 'This browser cannot use a microphone here. Try Chrome or Edge on the classroom computer.';
        renderPanel();
        return;
    }
    const go = $('[data-qd="start"]');
    if (go) { go.disabled = true; go.innerHTML = '<i class="fas fa-microphone-lines"></i> Waking the microphone…'; }
    let stream;
    try {
        stream = await media.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (error) {
        ui.error = error?.name === 'NotAllowedError'
            ? 'The dragon needs the microphone to hear the room. Allow it in the browser (the icon in the address bar) and try again.'
            : 'No microphone was found. Plug one in or check the laptop’s sound settings, then try again.';
        renderPanel();
        return;
    }
    if (!stage) { stream.getTracks().forEach((tr) => tr.stop()); return; }
    ui.error = '';
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    if (ctx.state === 'suspended') ctx.resume().catch(quietly('ui/modals/quietDragon.js'));

    const level = levelByKey(ui.level);
    const heroes = classRoster(ui.classId).filter((h) => !h.away);
    const heroIds = heroes.map((h) => h.id);
    run = {
        sessionId: `${ui.classId}_${Date.now().toString(36)}`,
        classId: ui.classId,
        level,
        minutes: ui.minutes,
        goal: ui.minutes * 60,
        gift: normalizeGift(ui.gift),
        heroIds,
        heroes,
        stream, ctx, analyser,
        buf: new Float32Array(analyser.fftSize),
        calibration: [],
        calibrateFrom: performance.now(),
        calibrateUntil: performance.now() + CALIBRATE_SECONDS * 1000,
        ears: null,
        tune: 0,
        calm: 0,
        held: false,
        last: performance.now(),
        shownSecond: -1,
        shownPieces: -1,
        lastMood: 'asleep',
        saidHalf: false,
        saidLast: false,
        paid: null,
        timer: null,
        wakeLock: null
    };
    unfollow?.();
    unfollow = null;
    // The lullaby card folds away and the dragon glides to the middle of the hollow.
    const panel = $('[data-qd-panel]');
    stage.classList.remove('is-lulling');
    void stage.offsetWidth;
    stage.classList.add('is-lulling');
    setTimeout(() => stage?.classList.remove('is-lulling'), 3600);
    if (panel && !stage.classList.contains('qd-stage--still')) {
        panel.classList.add('is-leaving');
        await new Promise((resolve) => setTimeout(resolve, 380));
        panel.classList.remove('is-leaving');
    }
    if (!stage || !run) return;
    run.calibrateFrom = performance.now();
    run.calibrateUntil = run.calibrateFrom + CALIBRATE_SECONDS * 1000;
    run.last = run.calibrateFrom;
    stage.dataset.phase = 'calibrating';
    setPanel(calibrateHtml());
    paintClock();
    paintDepth();
    keepScreenOn(true);
    document.addEventListener('visibilitychange', onVisibility);
    run.timer = setInterval(tick, TICK_MS);
}

function stopListening() {
    if (!run) return;
    clearInterval(run.timer);
    run.timer = null;
    document.removeEventListener('visibilitychange', onVisibility);
    keepScreenOn(false);
    try { run.stream?.getTracks().forEach((tr) => tr.stop()); } catch { /* already stopped */ }
    try { run.ctx?.close(); } catch { /* already closed */ }
    run.stream = null;
    run.ctx = null;
}

function tick() {
    if (!stage || !run?.analyser) return;
    const now = performance.now();
    const dt = Math.min(1, (now - run.last) / 1000);
    run.last = now;
    run.analyser.getFloatTimeDomainData(run.buf);
    const db = rmsDb(run.buf);

    if (stage.dataset.phase === 'calibrating') {
        run.calibration.push(db);
        paintCalibration(now, db);
        if (now >= run.calibrateUntil) {
            run.ears = createDragonEars({ floor: calibrateFloor(run.calibration), margin: run.level.margin, tune: run.tune });
            stage.dataset.phase = 'listening';
            setPanel('');
            showToast('The dragon falls asleep. Shhh…');
            wakeControls();
        }
        return;
    }
    if (stage.dataset.phase !== 'listening') return;

    const snap = run.ears.step(db, dt, { held: run.held });
    if (snap.woke) { dragonWoke(snap); return; }
    if (countsAsCalm(snap.mood, run.held)) run.calm = Math.min(run.goal, run.calm + dt);
    // While the teacher speaks the dragon simply sleeps on; the clock and its ears wait.
    paint(run.held ? { ...snap, mood: 'asleep', ratio: 0, annoyance: 0 } : snap);
    if (run.calm >= run.goal) finish();
}

function paintCalibration(now, db) {
    const p = Math.min(1, (now - run.calibrateFrom) / (CALIBRATE_SECONDS * 1000));
    const ring = $('[data-qd-cal-ring]');
    if (ring) ring.style.strokeDashoffset = (CAL_LENGTH * (1 - p)).toFixed(1);
    const count = $('[data-qd-cal-count]');
    const left = Math.max(1, Math.ceil(CALIBRATE_SECONDS * (1 - p)));
    if (count && count.textContent !== String(left)) count.textContent = String(left);
    // The bars dance with the room (roughly -70 dB silent … -25 dB loud).
    const level = Math.max(0.08, Math.min(1, (db + 72) / 46));
    stage.querySelectorAll('[data-qd-bars] i').forEach((bar, i) => {
        const shape = 0.45 + 0.55 * Math.sin(((i + 1) / 10) * Math.PI);
        bar.style.transform = `scaleY(${Math.max(0.12, level * shape).toFixed(3)})`;
    });
}

function paintClock() {
    if (!run) return;
    const left = $('[data-qd-left]');
    if (left) left.textContent = formatClock(run.goal - run.calm);
    const fill = $('.qd-ring__fill');
    if (fill) fill.style.strokeDashoffset = (RING_LENGTH * (1 - run.calm / run.goal)).toFixed(1);
}

function paint(snap) {
    const prev = run.lastMood;
    if (stage.dataset.mood !== snap.mood) {
        stage.dataset.mood = snap.mood;
        setMoodText(MOOD_TEXT[snap.mood] || '');
        const label = $('[data-qd-left-label]');
        if (label) label.textContent = snap.mood === 'awake' ? 'left when it woke' : 'calm minutes to go';
        if (snap.mood === 'awake' && prev !== 'awake') {
            stage.classList.remove('is-jolt');
            void stage.offsetWidth;
            stage.classList.add('is-jolt');
        }
        if (snap.mood === 'peeking' && prev !== 'peeking' && !(performance.now() - (run.peekToastAt || -1e9) < 8000)) {
            run.peekToastAt = performance.now();
            showToast('One eye is open. One more noise and it wakes!', 2200);
        }
        run.lastMood = snap.mood;
    }

    // Hush meter: the orb glides along the rail, the fill follows (both transforms only).
    const x = Math.min(1, snap.ratio / METER_MAX);
    const ear = $('[data-qd-ear]');
    if (ear) ear.style.transform = `scaleX(${x.toFixed(3)})`;
    const rail = $('[data-qd-rail]');
    if (rail) rail.style.transform = `translateX(${(x * 100).toFixed(1)}%)`;
    const wake = $('[data-qd-wake]');
    if (wake) wake.style.transform = `scaleX(${(snap.mood === 'awake' ? 1 : snap.annoyance).toFixed(3)})`;
    const meter = $('[data-qd-meter]');
    if (meter) meter.setAttribute('aria-valuenow', String(Math.round(x * 100)));
    const zone = x >= 1 / METER_MAX ? 'loud' : x >= 0.6 / METER_MAX ? 'stir' : 'calm';
    if (stage.dataset.zone !== zone) stage.dataset.zone = zone;

    const second = Math.floor(run.calm);
    if (second !== run.shownSecond) {
        run.shownSecond = second;
        paintClock();
        const progress = run.calm / run.goal;
        const pieces = hoardPiecesFor(progress);
        if (pieces !== run.shownPieces) {
            const first = run.shownPieces < 0;
            run.shownPieces = pieces;
            setHoard(progress, { celebrate: !first });
            if (!first && pieces > 0 && pieces < HOARD_PIECES) showToast('A new treasure for the hoard!', 2000);
        }
        if (!run.saidHalf && progress >= 0.5 && run.goal >= 120) { run.saidHalf = true; showToast('Halfway there. The hoard is growing!'); }
        if (!run.saidLast && run.goal - run.calm <= 60 && run.goal >= 180) { run.saidLast = true; showToast('One more calm minute…'); }
    }
}

function toggleHold() {
    if (!run || stage?.dataset.phase !== 'listening') return;
    run.held = !run.held;
    stage.classList.toggle('is-held', run.held);
    const btn = $('[data-qd="hold"]');
    if (btn) btn.setAttribute('aria-pressed', String(run.held));
    const label = $('[data-qd-hold-label]');
    if (label) label.textContent = run.held ? 'Listen again' : 'Teacher speaking';
    setMoodText(run.held ? 'Resting while the teacher speaks…' : (MOOD_TEXT[stage.dataset.mood] || ''));
}

function tune(direction) {
    if (!run) return;
    const before = run.tune;
    run.tune = tuneBy(run.tune, direction);
    if (run.ears) run.ears.tune = run.tune;
    paintDepth();
    if (run.tune === before) showToast(direction > 0 ? 'It already sleeps as deeply as it can.' : 'It already sleeps as lightly as it can.');
    else showToast(direction > 0 ? 'The dragon sleeps a little more deeply.' : 'The dragon sleeps a little more lightly.');
}

function askEnd() {
    if (!run || !['listening', 'calibrating'].includes(stage.dataset.phase)) { closeQuietDragon(); return; }
    if (stage.dataset.phase === 'calibrating') { closeQuietDragon(); return; }
    stage.dataset.phase = 'ending';
    setPanel(confirmEndHtml());
    $('[data-qd="resume"]')?.focus({ preventScroll: true });
}

function resume() {
    if (!run || stage.dataset.phase !== 'ending') return;
    run.last = performance.now();
    stage.dataset.phase = 'listening';
    setPanel('');
}

// ─── The dragon wakes ─────────────────────────────────────────────────────────

/** The noise woke it: the session is over for good (no grace, no gift). The teacher may start again. */
function dragonWoke(snap) {
    if (!run || !stage) return;
    stopListening();
    run.woke = true;
    stage.classList.remove('is-held', 'qd-woke-card');
    stage.dataset.phase = 'woke';
    paint({ ...snap, mood: 'awake', annoyance: 1 });
    // The microphone is off now, so the dragon may roar.
    quietDragonSound('woke');
    clearTimeout(run.wokeTimer);
    run.wokeTimer = setTimeout(() => {
        if (stage?.dataset.phase !== 'woke') return;
        stage.classList.add('qd-woke-card');
        setPanel(wokeHtml());
        $('[data-qd="again"]')?.focus({ preventScroll: true });
    }, stage.classList.contains('qd-stage--still') ? 200 : 1600);
}

/** A fresh start with the same class, level, minutes and gift. */
function tryAgain() {
    if (!stage || stage.dataset.phase !== 'woke') return;
    clearTimeout(run?.wokeTimer);
    run = null;
    stage.classList.remove('qd-woke-card', 'is-jolt');
    stage.dataset.mood = 'asleep';
    stage.dataset.zone = 'calm';
    setMoodText(MOOD_TEXT.asleep);
    const label = $('[data-qd-left-label]');
    if (label) label.textContent = 'calm minutes to go';
    ['[data-qd-ear]', '[data-qd-wake]'].forEach((sel) => { const el = $(sel); if (el) el.style.transform = 'scaleX(0)'; });
    const rail = $('[data-qd-rail]');
    if (rail) rail.style.transform = 'translateX(0%)';
    setHoard(0);
    startSession();
}

// ─── The gift ─────────────────────────────────────────────────────────────────

async function finish() {
    if (!run || !stage) return;
    stopListening();
    run.minutes = run.calm >= run.goal ? Math.round(run.goal / 60) : Math.max(1, Math.round(run.calm / 60));
    stage.classList.remove('is-held');
    stage.dataset.phase = 'gift';
    stage.dataset.mood = 'gift';
    setHoard(1);
    setMoodText(MOOD_TEXT.gift);
    const left = $('[data-qd-left]');
    if (left) left.textContent = String(run.minutes);
    const leftLabel = $('[data-qd-left-label]');
    if (leftLabel) leftLabel.textContent = 'calm minutes given';
    const fill = $('.qd-ring__fill');
    if (fill) fill.style.strokeDashoffset = '0';
    // The microphone is off now: the dragon may purr and the hoard may sing.
    playGiftSounds(run);
    run.giftShownAt = performance.now();
    setPanel(giftHtml(null));
    await payGift();
}

/** The gift's music, and a soft coin for every hero as their name lights up on the roll. */
function playGiftSounds(r) {
    quietDragonSound('gift');
    const perHero = r.gift.hoard.key === 'gold' || r.gift.hoard.key === 'stars';
    const n = (r.heroes || []).length;
    if (!perHero || !n || stage?.classList.contains('qd-stage--still')) return;
    const step = Math.min(0.09, 1.4 / n);
    const every = Math.max(1, Math.ceil(n / 18)); // never more than ~18 coins, however big the class
    for (let i = 0; i < n; i += every) quietDragonSound('coin', { at: ROLL_START + 0.18 + i * step, i });
}

async function payGift() {
    if (!run || !stage) return;
    const r = run;
    const status = $('[data-qd-status]');
    if (status && r.paid) status.innerHTML = giftStatusHtml(null);
    // Always saved, even for a classroom treat only: the calm session counts as a completed bounty.
    try {
        const { payQuietDragonGift } = await import('../../db/actions/quietDragon.js');
        r.paid = await payQuietDragonGift({
            classId: r.classId,
            sessionId: r.sessionId,
            gift: r.gift,
            heroIds: r.heroIds,
            minutes: r.minutes,
            levelKey: r.level.key,
            wakes: r.ears?.wakes || 0
        });
    } catch (error) {
        console.error('Quiet Dragon gift failed:', error);
        r.paid = { paid: false, heroes: 0 };
    }
    // Let the reveal (medal, title, the roll of names) play before the card says it is saved.
    const wait = Math.max(0, 3600 - (performance.now() - (r.giftShownAt || 0)));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    if (run !== r || stage?.dataset.phase !== 'gift') return;
    const ok = r.paid.paid || r.paid.alreadyPaid;
    if (ok) quietDragonSound('saved');
    const statusEl = $('[data-qd-status]');
    if (statusEl) statusEl.innerHTML = giftStatusHtml(r.paid);
    const actions = $('[data-qd-gift-actions]');
    if (actions) actions.innerHTML = giftActionsHtml(r.paid);
}

// Test hooks for the preview page (no microphone in headless browsers).
export const quietDragonTestHooks = {
    get stage() { return stage; },
    showMood(mood) {
        if (!stage) return;
        run = run || { calm: 0, goal: 900, tune: 0, lastMood: 'asleep' };
        stage.dataset.phase = 'listening';
        setPanel('');
        stage.dataset.mood = mood;
        setMoodText(MOOD_TEXT[mood] || '');
        const label = $('[data-qd-left-label]');
        if (label) label.textContent = mood === 'awake' ? 'left when it woke' : 'calm minutes to go';
        paintDepth();
    },
    showProgress(p, ratio = 0.3, { annoyance = null } = {}) {
        if (!stage) return;
        setHoard(p);
        const fill = $('.qd-ring__fill');
        if (fill) fill.style.strokeDashoffset = (RING_LENGTH * (1 - p)).toFixed(1);
        const left = $('[data-qd-left]');
        if (left) left.textContent = formatClock(15 * 60 * (1 - p));
        const x = Math.min(1, ratio / METER_MAX);
        $('[data-qd-ear]').style.transform = `scaleX(${x})`;
        $('[data-qd-rail]').style.transform = `translateX(${x * 100}%)`;
        const a = annoyance ?? Math.min(1, Math.max(0, (ratio - 0.5) * 1.1));
        $('[data-qd-wake]').style.transform = `scaleX(${stage.dataset.mood === 'awake' ? 1 : a})`;
        stage.dataset.zone = x >= 1 / METER_MAX ? 'loud' : x >= 0.6 / METER_MAX ? 'stir' : 'calm';
    },
    showGift(gift, heroes = 23, { sound = false, fail = false } = {}) {
        if (!stage) return;
        const roster = classRoster(selectedToolClassId() || 'c1').slice(0, heroes);
        run = { gift: normalizeGift(gift), minutes: 15, calm: 900, goal: 900, heroes: roster, heroIds: roster.map((h) => h.id), giftShownAt: performance.now() };
        stage.dataset.phase = 'gift';
        stage.dataset.mood = 'gift';
        setMoodText(MOOD_TEXT.gift);
        setHoard(1);
        const left = $('[data-qd-left]');
        if (left) left.textContent = '15';
        const leftLabel = $('[data-qd-left-label]');
        if (leftLabel) leftLabel.textContent = 'calm minutes given';
        const fill = $('.qd-ring__fill');
        if (fill) fill.style.strokeDashoffset = '0';
        if (sound) playGiftSounds(run);
        setPanel(giftHtml(null));
        setTimeout(() => {
            const result = fail ? { paid: false, heroes: Math.floor(roster.length / 2) } : { paid: true, heroes: roster.length };
            const st = $('[data-qd-status]'); if (st) st.innerHTML = giftStatusHtml(result);
            const ac = $('[data-qd-gift-actions]'); if (ac) ac.innerHTML = giftActionsHtml(result);
        }, 3600);
        },
    showWoke(p = 0.55, { card = true } = {}) {
        if (!stage) return;
        run = { calm: 900 * p, goal: 900, tune: 0, lastMood: 'peeking', shownSecond: -1, shownPieces: -1 };
        stage.dataset.phase = 'woke';
        paint({ mood: 'awake', ratio: 1.4, annoyance: 1 });
        if (card) { stage.classList.add('qd-woke-card'); setPanel(wokeHtml()); } else setPanel('');
    },
    showEnding() { if (stage) { run = run || { calm: 420 }; stage.dataset.phase = 'ending'; setPanel(confirmEndHtml()); } },
    showCalibrating(p = 0.45) {
        if (!stage) return;
        stage.dataset.phase = 'calibrating';
        setPanel(calibrateHtml());
        run = { calibrateFrom: performance.now() - p * CALIBRATE_SECONDS * 1000 };
        paintCalibration(performance.now(), -48);
        run = null;
    },
    hold(on) {
        if (!stage) return;
        stage.classList.toggle('is-held', on);
        const label = $('[data-qd-hold-label]');
        if (label) label.textContent = on ? 'Listen again' : 'Teacher speaking';
        $('[data-qd="hold"]')?.setAttribute('aria-pressed', String(on));
    },
    toast(text) { showToast(text, 60000); },
    awakeUi() { stage?.classList.add('qd-awake-ui'); clearTimeout(controlsTimer); }
};
