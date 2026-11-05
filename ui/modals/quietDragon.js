// ui/modals/quietDragon.js — The Quiet Dragon: a noise meter for the projector.
// A dragon sleeps on its hoard while the class works. The laptop microphone measures only how loud
// the room is (a few readings a second; nothing is recorded, kept or sent). The dragon stirs as the
// room gets louder and wakes if it stays loud; while it is awake the calm clock waits. When the
// class gives it the calm minutes the teacher asked for, it leaves the gift the teacher chose, and
// the session counts as a completed class bounty. Nothing is ever taken away.
// Opened from the projector remote (Projector Mode) or the optional header button.
//
// The stage, in order: the lullaby card (setup) → the dragon learns the room (3 s, live sound bars
// and a countdown ring) → it sleeps (moon clock with hoard pips, the hush meter, a dock of controls)
// → the gift (coins burst from the hoard, then the gift card). Keys: Space teacher speaking,
// ↑/↓ deeper/lighter sleep, F full screen, Esc end. No sounds play while the microphone listens, so
// the dragon never hears itself.
// Rules: features/quietDragonCore.mjs · Art: ui/quietDragonArt.js · Gift: db/actions/quietDragon.js
import { quietly } from '../../utils/runtimeMetrics.js';
import '../../styles/quiet_dragon.css';
import { playSound, playHeroFanfare } from '../../audio.js';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import { quietDragonHtml } from '../quietDragonArt.js';
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

const MOOD_TEXT = {
    asleep: 'Fast asleep…',
    stirring: 'The dragon stirs…',
    peeking: 'One eye opens… shhh!',
    awake: 'The dragon is awake!',
    settling: 'Drifting back to sleep…',
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
export function openQuietDragon({ from = 'header', lite: forceLite = null } = {}) {
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
    stage.innerHTML = sceneHtml(lite);
    document.body.appendChild(stage);
    document.body.classList.add('qd-open');
    requestAnimationFrame(() => stage?.classList.add('is-in'));

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

function closeQuietDragon() {
    if (!stage) return;
    stopListening();
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
    el.classList.remove('is-in');
    el.classList.add('is-out');
    setTimeout(() => el.remove(), el.classList.contains('qd-stage--lite') ? 0 : 500);
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

function sceneHtml(lite) {
    return `
    <div class="qd-sky" aria-hidden="true">
        <div class="qd-stars">${starsHtml(lite)}</div>
        ${lite ? '' : '<i class="qd-shooting"></i>'}
        <svg class="qd-peaks" viewBox="0 0 1600 400" preserveAspectRatio="none">
            <path class="qd-peaks__far" d="M0 300 L120 200 L210 250 L330 120 L450 230 L560 170 L700 260 L820 150 L960 240 L1080 110 L1210 220 L1320 170 L1460 250 L1600 190 L1600 400 L0 400 Z"/>
            <path class="qd-peaks__near" d="M0 350 C 160 290 260 330 400 300 C 560 268 640 320 800 300 C 960 280 1080 330 1240 306 C 1380 286 1500 320 1600 300 L1600 400 L0 400 Z"/>
        </svg>
        <div class="qd-mist qd-mist--a"></div>
        <div class="qd-mist qd-mist--b"></div>
    </div>
    <div class="qd-glow" aria-hidden="true"></div>
    <div class="qd-alarm" aria-hidden="true"></div>
    ${lite ? '' : '<div class="qd-motes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'}
    <div class="qd-scene">
        ${quietDragonHtml()}
        <div class="qd-breath-gold" aria-hidden="true">${'<i></i>'.repeat(lite ? 0 : 14)}</div>
        <div class="qd-burst" aria-hidden="true">${burstHtml(lite)}</div>
    </div>

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
            <strong>Shhh!</strong>
            <span>The dragon is awake. Stay quiet so it lies back down.</span>
            <span class="qd-settle" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
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
            <span class="qd-depth" data-qd-depth aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
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

function setupHtml() {
    const classes = myClasses();
    const cls = classById(ui.classId);
    const here = cls ? classRoster(cls.id).filter((h) => !h.away).length : 0;
    const gift = ui.gift;
    const giftDef = hoardGiftByKey(gift.hoard.key);
    const isCustom = gift.treat && !CLASS_TREATS.includes(gift.treat);
    const ready = Boolean(cls) && giftIsReady(gift);
    const summary = [
        `<b>${ui.minutes}</b> calm minute${ui.minutes === 1 ? '' : 's'}`,
        hoardGiftLine(gift) ? esc(amountLabel(gift.hoard.key, gift.hoard.amount)) : '',
        gift.treat ? esc(gift.treat) : ''
    ].filter(Boolean).join(' <i aria-hidden="true">·</i> ');
    return `
    <div class="qd-panel__head">
        <span class="qd-panel__seal" aria-hidden="true">${levelIcon(1)}</span>
        <div>
            <h3 class="qd-panel__title">Let the dragon sleep</h3>
            <p class="qd-panel__lede">Keep the room calm and the dragon leaves a gift. If it wakes, the clock simply waits until the room settles again.</p>
        </div>
        <button type="button" class="qd-x" data-qd="close" aria-label="Close"><i class="fas fa-xmark"></i></button>
    </div>

    <div class="qd-panel__body">
        ${cls ? `<p class="qd-panel__class"><span class="qd-panel__classname">${classLine(cls.id)}</span><span class="qd-panel__heroes"><i class="fas fa-user-group" aria-hidden="true"></i> ${here} hero${here === 1 ? '' : 'es'} here</span></p>`
        : `<div class="qd-field"><span class="qd-label"><b>1</b> Which class?</span><div class="qd-chips">${classes.map((c) => `<button type="button" class="qd-chip" data-qd-class-pick="${esc(c.id)}">${esc(c.logo || '')} ${esc(c.name || 'Class')}</button>`).join('') || '<em class="qd-muted">Add a class first.</em>'}</div></div>`}

        <div class="qd-field">
            <span class="qd-label"><b>${cls ? 1 : 2}</b> How quiet?</span>
            <div class="qd-levels">
                ${QUIET_LEVELS.map((l, i) => `<button type="button" class="qd-level${ui.level === l.key ? ' is-on' : ''}" data-qd-level="${l.key}" aria-pressed="${ui.level === l.key}">
                    <span class="qd-level__icon">${levelIcon(i)}</span>
                    <strong>${esc(l.name)}</strong><small>${esc(l.hint)}</small></button>`).join('')}
            </div>
        </div>

        <div class="qd-field">
            <span class="qd-label"><b>${cls ? 2 : 3}</b> How long?</span>
            <div class="qd-time">
                <div class="qd-stepper">
                    <button type="button" class="qd-stepper__btn" data-qd="minus" aria-label="One minute less" ${ui.minutes <= 1 ? 'disabled' : ''}><i class="fas fa-minus"></i></button>
                    <span class="qd-stepper__value"><strong data-qd-minutes-value>${ui.minutes}</strong><small>calm min</small></span>
                    <button type="button" class="qd-stepper__btn" data-qd="plus" aria-label="One minute more" ${ui.minutes >= 60 ? 'disabled' : ''}><i class="fas fa-plus"></i></button>
                </div>
                <div class="qd-chips qd-chips--quick">
                    ${QUIET_MINUTES.map((m) => `<button type="button" class="qd-chip${ui.minutes === m ? ' is-on' : ''}" data-qd-minutes="${m}" aria-pressed="${ui.minutes === m}">${m}</button>`).join('')}
                </div>
            </div>
        </div>

        <div class="qd-field">
            <span class="qd-label"><b>${cls ? 3 : 4}</b> The dragon's gift</span>
            <div class="qd-gifts">
                ${HOARD_GIFTS.map((g) => `<button type="button" class="qd-gift qd-gift--${g.key}${gift.hoard.key === g.key ? ' is-on' : ''}" data-qd-hoard="${g.key}" aria-pressed="${gift.hoard.key === g.key}">
                    <span class="qd-gift__icon" aria-hidden="true">${giftIcon(g.key)}</span>
                    <strong>${esc(g.name)}</strong><small>${esc(g.hint)}</small></button>`).join('')}
            </div>
            ${giftDef.amounts.length ? `<div class="qd-amounts" role="group" aria-label="How much">${giftDef.amounts.map((a) => `<button type="button" class="qd-amount${gift.hoard.amount === a ? ' is-on' : ''}" data-qd-amount="${a}" aria-pressed="${gift.hoard.amount === a}">${amountLabel(giftDef.key, a)}</button>`).join('')}</div>` : ''}
        </div>

        <details class="qd-treat"${ui.treatOpen || gift.hoard.key === 'none' ? ' open' : ''}>
            <summary><span class="qd-gift__icon" aria-hidden="true">${giftIcon('none')}</span><span><strong>${gift.treat ? esc(gift.treat) : 'Add a classroom treat'}</strong><small>${gift.treat ? 'You give it in person' : 'Optional, you give it in person'}</small></span><i class="fas fa-chevron-down" aria-hidden="true"></i></summary>
            <div class="qd-chips">
                <button type="button" class="qd-chip${!gift.treat ? ' is-on' : ''}" data-qd-treat="">No treat</button>
                ${CLASS_TREATS.map((t) => `<button type="button" class="qd-chip${gift.treat === t ? ' is-on' : ''}" data-qd-treat="${esc(t)}">${esc(t)}</button>`).join('')}
                <label class="qd-chip qd-chip--input${isCustom ? ' is-on' : ''}"><i class="fas fa-pen" aria-hidden="true"></i><input type="text" maxlength="80" data-qd-treat-input value="${esc(isCustom ? gift.treat : ui.customTreat)}" placeholder="Your own treat…" aria-label="Your own treat"></label>
            </div>
        </details>

        <p class="qd-privacy"><i class="fas fa-microphone-lines" aria-hidden="true"></i> The microphone only measures how loud the room is. Nothing is recorded, kept or sent anywhere.</p>
        ${ui.error ? `<p class="qd-error" role="alert">${esc(ui.error)}</p>` : ''}
    </div>

    <div class="qd-panel__foot">
        <p class="qd-summary" data-qd-summary>${ready ? summary : (cls ? 'Pick a gift or a treat' : 'Pick a class')}</p>
        <div class="qd-actions">
            <button type="button" class="qd-btn qd-btn--ghost" data-qd="close">${ui.from === 'wallpaper' ? 'Back' : 'Not now'}</button>
            <button type="button" class="qd-btn qd-btn--go" data-qd="start" ${ready ? '' : 'disabled'}><i class="fas fa-moon"></i> Let the dragon sleep</button>
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
    // Small hand-drawn marks, matching the hoard on stage.
    if (key === 'gold') return '<svg viewBox="0 0 40 40"><ellipse cx="20" cy="27" rx="13" ry="5" fill="#8a5516"/><ellipse cx="20" cy="25" rx="13" ry="5" fill="#f4c34d"/><ellipse cx="17" cy="19" rx="11" ry="4.5" fill="#8a5516"/><ellipse cx="17" cy="17" rx="11" ry="4.5" fill="#ffd970"/><ellipse cx="23" cy="11" rx="9" ry="3.8" fill="#8a5516"/><ellipse cx="23" cy="9.5" rx="9" ry="3.8" fill="#fff0b3"/></svg>';
    if (key === 'stars') return '<svg viewBox="0 0 40 40"><path d="M20 4 L24.5 15 L36 15.6 L27 23 L30 34.5 L20 28 L10 34.5 L13 23 L4 15.6 L15.5 15 Z" fill="#ffd970" stroke="#b9823c" stroke-width="1.5" stroke-linejoin="round"/><path d="M20 9 L22.6 16.5" stroke="#fff6dc" stroke-width="2" stroke-linecap="round"/></svg>';
    if (key === 'quest') return '<svg viewBox="0 0 40 40"><path d="M6 32 C 12 22 18 26 22 18 C 25 12 30 12 34 6" fill="none" stroke="#c7b3ff" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round"/><path d="M30 4 L30 14 M30 4 L38 7 L30 10" fill="#ff7a59" stroke="#ff7a59" stroke-width="2" stroke-linejoin="round"/><circle cx="6" cy="32" r="3.5" fill="#5eead4"/></svg>';
    return '<svg viewBox="0 0 40 40"><rect x="7" y="16" width="26" height="18" rx="3" fill="#a3564b"/><rect x="5" y="11" width="30" height="7" rx="2" fill="#e07a5f"/><path d="M20 11 V34" stroke="#ffd970" stroke-width="3"/><path d="M20 11 C 14 4 8 8 12 11 M20 11 C 26 4 32 8 28 11" fill="none" stroke="#ffd970" stroke-width="2.5" stroke-linecap="round"/></svg>';
}

function chestIcon() {
    return `<svg viewBox="0 0 120 100" aria-hidden="true">
        <defs><radialGradient id="qd-chest-glow" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#fff3c0"/><stop offset=".5" stop-color="#ffd25e" stop-opacity=".55"/><stop offset="1" stop-color="#ffd25e" stop-opacity="0"/></radialGradient></defs>
        <ellipse cx="60" cy="44" rx="56" ry="40" fill="url(#qd-chest-glow)"/>
        <g class="qd-chest__lid"><path d="M22 44 L22 30 Q60 4 98 30 L98 44 Z" fill="#7d4520" stroke="#3a1d0a" stroke-width="2.5"/><path d="M22 36 Q60 12 98 36" fill="none" stroke="#e8b94e" stroke-width="4"/><path d="M34 26 Q46 16 58 13" fill="none" stroke="#ffe7a0" stroke-opacity=".55" stroke-width="2.5" stroke-linecap="round"/></g>
        <circle cx="46" cy="46" r="5" fill="#ffd970"/><circle cx="60" cy="42" r="6" fill="#fff0b3"/><circle cx="74" cy="46" r="5" fill="#f4c34d"/>
        <rect x="20" y="46" width="80" height="40" rx="4" fill="#8a4d22" stroke="#3a1d0a" stroke-width="2.5"/>
        <path d="M20 58 H100 M20 76 H100" stroke="#e8b94e" stroke-width="4"/>
        <rect x="53" y="52" width="14" height="16" rx="3" fill="#f4c34d" stroke="#8a5516" stroke-width="1.5"/>
    </svg>`;
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
        <span class="qd-listen" aria-hidden="true" data-qd-bars>${'<i></i>'.repeat(9)}</span>
        <h3 class="qd-panel__title">Shhh… the dragon is listening</h3>
        <p class="qd-panel__lede">Stay quiet for ${CALIBRATE_SECONDS} seconds so it learns how a calm room sounds here.</p>
    </div>`;
}

function confirmEndHtml() {
    const done = run ? Math.floor((run.calm || 0) / 60) : 0;
    return `
    <div class="qd-panel__center">
        <span class="qd-panel__seal qd-panel__seal--big" aria-hidden="true">${levelIcon(1)}</span>
        <h3 class="qd-panel__title">End the quiet time?</h3>
        <p class="qd-panel__lede">${done ? `The class has given the dragon <b>${done} calm minute${done === 1 ? '' : 's'}</b> so far.` : 'The dragon has only just fallen asleep.'} You can still give the gift if you feel they earned it.</p>
        <div class="qd-actions qd-actions--stack">
            <button type="button" class="qd-btn qd-btn--go" data-qd="resume"><i class="fas fa-moon"></i> Keep listening</button>
            <button type="button" class="qd-btn qd-btn--gold" data-qd="gift-now"><i class="fas fa-gift"></i> Give the gift now</button>
            <button type="button" class="qd-btn qd-btn--ghost" data-qd="close">End without a gift</button>
        </div>
    </div>`;
}

function giftHtml(result) {
    const gift = run.gift;
    const hoardLine = hoardGiftLine(gift);
    const paid = result?.paid || result?.alreadyPaid;
    const heroes = result?.heroes || run.heroIds.length;
    let hoardNote = '';
    if (gift.hoard.key === 'gold' || gift.hoard.key === 'stars') hoardNote = paid ? `Given to ${heroes} hero${heroes === 1 ? '' : 'es'}.` : '';
    if (gift.hoard.key === 'quest') hoardNote = paid ? 'Added to this month’s Team Quest.' : '';
    if (!result) hoardNote = 'Placing it in the hoard…';
    const wakes = run.ears?.wakes || 0;
    return `
    <div class="qd-panel__center qd-gift-card">
        <div class="qd-gift-card__chest">${chestIcon()}</div>
        <p class="qd-gift-card__kicker">A gift from the hoard</p>
        <h3 class="qd-panel__title">The dragon leaves a gift!</h3>
        <div class="qd-stats">
            <span><strong>${run.minutes}</strong><small>calm minute${run.minutes === 1 ? '' : 's'}</small></span>
            <span><strong>${wakes || '0'}</strong><small>${wakes === 1 ? 'time it woke' : 'times it woke'}</small></span>
            <span><strong>${run.heroIds.length}</strong><small>hero${run.heroIds.length === 1 ? '' : 'es'} here</small></span>
        </div>
        <p class="qd-panel__lede">${wakes ? `Every time it woke, the class let it settle again.` : 'It never woke once. A truly quiet class!'}</p>
        <ul class="qd-gift-card__list">
            ${hoardLine ? `<li><span class="qd-gift__icon" aria-hidden="true">${giftIcon(gift.hoard.key)}</span><span><strong>${esc(hoardLine)}</strong>${hoardNote ? `<small${!result ? ' class="qd-pending"' : ''}>${esc(hoardNote)}</small>` : ''}${result && !paid ? '<small class="qd-error">This could not be saved. Check the connection and try again.</small>' : ''}</span>${paid ? '<i class="fas fa-circle-check qd-tick" aria-label="Saved"></i>' : ''}</li>` : ''}
            ${gift.treat ? `<li><span class="qd-gift__icon" aria-hidden="true">${giftIcon('none')}</span><span><strong>${esc(gift.treat)}</strong><small>From the teacher, in person.</small></span></li>` : ''}
        </ul>
        <div class="qd-actions">
            ${result && !paid ? '<button type="button" class="qd-btn qd-btn--gold" data-qd="retry-pay"><i class="fas fa-rotate"></i> Try again</button>' : ''}
            <button type="button" class="qd-btn qd-btn--go" data-qd="close">${ui.from === 'wallpaper' ? 'Back to the projector' : 'Close'}</button>
        </div>
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
    const tuneSteps = Math.round((run?.tune || 0) / 2); // -5 … 5
    stage?.querySelectorAll('[data-qd-depth] i').forEach((dot, i) => {
        const pos = i - 5;
        dot.classList.toggle('is-on', pos === tuneSteps);
        dot.classList.toggle('is-mid', pos === 0);
    });
}

// ─── Events ───────────────────────────────────────────────────────────────────

function onClick(e) {
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
    if (!ui.classId || !giftIsReady(ui.gift)) return;
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
    const heroIds = classRoster(ui.classId).filter((h) => !h.away).map((h) => h.id);
    run = {
        sessionId: `${ui.classId}_${Date.now().toString(36)}`,
        classId: ui.classId,
        level,
        minutes: ui.minutes,
        goal: ui.minutes * 60,
        gift: normalizeGift(ui.gift),
        heroIds,
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
        shownSettle: -1,
        lastMood: 'asleep',
        saidHalf: false,
        saidLast: false,
        paid: null,
        timer: null,
        wakeLock: null
    };
    unfollow?.();
    unfollow = null;
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
    if (countsAsCalm(snap.mood, run.held)) run.calm = Math.min(run.goal, run.calm + dt);
    // While the teacher speaks the dragon simply sleeps on; the clock and its ears wait.
    paint(run.held ? { ...snap, mood: 'asleep', ratio: 0, annoyance: 0, settle: 0 } : snap);
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
        if (label) label.textContent = snap.mood === 'awake' ? 'the clock waits for calm' : 'calm minutes to go';
        if (snap.mood === 'awake' && prev !== 'awake') {
            stage.classList.remove('is-jolt');
            void stage.offsetWidth;
            stage.classList.add('is-jolt');
        }
        if (snap.mood === 'asleep' && prev === 'settling') showToast('Phew… it is asleep again.');
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

    // Settle countdown: four dots light as the room stays quiet.
    const settleDots = snap.mood === 'awake' ? Math.floor((snap.settle || 0) * 4 + 1e-6) : 0;
    if (settleDots !== run.shownSettle) {
        run.shownSettle = settleDots;
        stage.querySelectorAll('.qd-settle i').forEach((d, i) => d.classList.toggle('is-on', i < settleDots));
    }

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
    try { playHeroFanfare(); } catch { /* sound is optional */ }
    setPanel(giftHtml(null));
    await payGift();
}

async function payGift() {
    if (!run || !stage) return;
    // Always saved, even for a classroom treat only: the calm session counts as a completed bounty.
    try {
        const { payQuietDragonGift } = await import('../../db/actions/quietDragon.js');
        run.paid = await payQuietDragonGift({
            classId: run.classId,
            sessionId: run.sessionId,
            gift: run.gift,
            heroIds: run.heroIds,
            minutes: run.minutes,
            levelKey: run.level.key,
            wakes: run.ears?.wakes || 0
        });
        try { playSound('magic_chime'); } catch { /* optional */ }
    } catch (error) {
        console.error('Quiet Dragon gift failed:', error);
        run.paid = { paid: false, heroes: 0 };
    }
    if (stage?.dataset.phase === 'gift') {
        $('[data-qd-panel]')?.classList.add('is-settled');
        setPanel(giftHtml(run.paid));
    }
}

// Test hooks for the preview page (no microphone in headless browsers).
export const quietDragonTestHooks = {
    get stage() { return stage; },
    showMood(mood) {
        if (!stage) return;
        run = run || { calm: 0, goal: 900, tune: 0, lastMood: 'asleep', shownSettle: -1 };
        stage.dataset.phase = 'listening';
        setPanel('');
        stage.dataset.mood = mood;
        setMoodText(MOOD_TEXT[mood] || '');
        const label = $('[data-qd-left-label]');
        if (label) label.textContent = mood === 'awake' ? 'the clock waits for calm' : 'calm minutes to go';
        paintDepth();
    },
    showProgress(p, ratio = 0.3, { annoyance = null, settle = 0.5 } = {}) {
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
        const dots = stage.dataset.mood === 'awake' ? Math.floor(settle * 4) : 0;
        stage.querySelectorAll('.qd-settle i').forEach((d, i) => d.classList.toggle('is-on', i < dots));
    },
    showGift(gift, heroes = 23, wakes = 2) {
        if (!stage) return;
        run = { gift: normalizeGift(gift), minutes: 15, heroIds: Array.from({ length: heroes }, (_, i) => `h${i}`), ears: { wakes } };
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
        setPanel(giftHtml({ paid: true, heroes }));
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
