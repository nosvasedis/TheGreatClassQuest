// ui/modals/quietDragon.js — The Quiet Dragon: a noise meter for the projector.
// A dragon sleeps on its hoard while the class works. The laptop microphone measures only how loud
// the room is (a few readings a second; nothing is recorded, kept or sent). The dragon stirs as the
// room gets louder and wakes if it stays loud; while it is awake the calm clock waits. When the
// class gives it the calm minutes the teacher asked for, it leaves the gift the teacher chose, and
// the session counts as a completed class bounty. Nothing is ever taken away.
// Opened from the projector remote (Projector Mode) or the optional header button.
// Rules: features/quietDragonCore.mjs · Art: ui/quietDragonArt.js · Gift: db/actions/quietDragon.js
import '../../styles/quiet_dragon.css';
import { playSound, playHeroFanfare } from '../../audio.js';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import { quietDragonHtml } from '../quietDragonArt.js';
import {
    QUIET_LEVELS, QUIET_MINUTES, DEFAULT_MINUTES, CALIBRATE_SECONDS, HOARD_GIFTS, CLASS_TREATS,
    levelByKey, clampMinutes, rmsDb, calibrateFloor, tuneBy, createDragonEars, countsAsCalm, hoardPiecesFor,
    formatClock, normalizeGift, giftIsReady, hoardGiftLine, hoardGiftByKey
} from '../../features/quietDragonCore.mjs';
import { esc, myClasses, classById, classRoster, selectedToolClassId, followSelectedClass, reducedMotion } from './classTools.js';

const STAGE_ID = 'quiet-dragon-stage';
const PREF_KEY = 'gcq.quietDragon.prefs';
const TICK_MS = 150;
const RING_LENGTH = 2 * Math.PI * 54;
const DEFAULT_AMOUNTS = { gold: 2, stars: 0.5, quest: 1 };

const MOOD_TEXT = {
    asleep: 'Fast asleep…',
    stirring: 'The dragon stirs…',
    peeking: 'One eye opens…',
    awake: 'The dragon is awake! Shhh… let it settle.',
    settling: 'Drifting back to sleep…'
};

let stage = null;   // the overlay element
let run = null;     // the live session (null while setting up)
let ui = null;      // setup choices
let unfollow = null;

// ─── Preferences (per device) ────────────────────────────────────────────────

function readPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; }
}

function savePrefs() {
    try {
        localStorage.setItem(PREF_KEY, JSON.stringify({ level: ui.level, minutes: ui.minutes, gift: ui.gift, customTreat: ui.customTreat }));
    } catch { /* private window: fine */ }
}

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
    stage.addEventListener('pointermove', wakeControls);
    window.addEventListener('keydown', onKey, true);
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
    window.removeEventListener('keydown', onKey, true);
    const el = stage;
    stage = null;
    run = null;
    document.body.classList.remove('qd-open');
    el.classList.remove('is-in');
    el.classList.add('is-out');
    setTimeout(() => el.remove(), el.classList.contains('qd-stage--lite') ? 0 : 450);
}

// ─── Markup ───────────────────────────────────────────────────────────────────

function starsHtml(lite) {
    // Fixed positions (no randomness on every open) so the sky is the same each lesson.
    const count = lite ? 22 : 46;
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

function sceneHtml(lite) {
    return `
    <div class="qd-sky" aria-hidden="true">
        <div class="qd-stars">${starsHtml(lite)}</div>
        <svg class="qd-peaks" viewBox="0 0 1600 400" preserveAspectRatio="none">
            <path class="qd-peaks__far" d="M0 300 L120 200 L210 250 L330 120 L450 230 L560 170 L700 260 L820 150 L960 240 L1080 110 L1210 220 L1320 170 L1460 250 L1600 190 L1600 400 L0 400 Z"/>
            <path class="qd-peaks__near" d="M0 350 C 160 290 260 330 400 300 C 560 268 640 320 800 300 C 960 280 1080 330 1240 306 C 1380 286 1500 320 1600 300 L1600 400 L0 400 Z"/>
        </svg>
        <div class="qd-mist qd-mist--a"></div>
        <div class="qd-mist qd-mist--b"></div>
    </div>
    <div class="qd-glow" aria-hidden="true"></div>
    ${lite ? '' : '<div class="qd-motes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'}
    <div class="qd-scene">${quietDragonHtml()}<div class="qd-breath-gold" aria-hidden="true">${'<i></i>'.repeat(lite ? 0 : 14)}</div></div>

    <header class="qd-hud" aria-live="off">
        <div class="qd-hud__title">
            <span class="qd-hud__class" data-qd-class></span>
            <h2 class="qd-hud__name">The Quiet Dragon</h2>
        </div>
        <div class="qd-ring" data-qd-ring>
            <span class="qd-ring__halo" aria-hidden="true"></span>
            <span class="qd-ring__moon" aria-hidden="true"></span>
            <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle class="qd-ring__track" cx="60" cy="60" r="54"/>
                <circle class="qd-ring__fill" cx="60" cy="60" r="54" style="stroke-dasharray:${RING_LENGTH.toFixed(1)};stroke-dashoffset:${RING_LENGTH.toFixed(1)}"/>
            </svg>
            <div class="qd-ring__text"><strong data-qd-left>15:00</strong><span data-qd-left-label>calm minutes to go</span></div>
        </div>
        <div class="qd-ear" title="How loud the room is">
            <span class="qd-ear__label">Room</span>
            <span class="qd-ear__track"><span class="qd-ear__fill" data-qd-ear></span><span class="qd-ear__limit"></span></span>
        </div>
    </header>
    <p class="qd-mood" data-qd-mood aria-live="polite">Fast asleep…</p>
    <p class="qd-held-note" aria-live="polite">The teacher is speaking. The dragon is not listening.</p>

    <div class="qd-controls" role="toolbar" aria-label="Quiet Dragon controls">
        <button type="button" class="qd-ctl" data-qd="hold" title="I am speaking: stop listening (Space)" aria-pressed="false"><i class="fas fa-person-chalkboard"></i><span>Teacher speaking</span></button>
        <button type="button" class="qd-ctl qd-ctl--small" data-qd="tune-down" title="Wake more easily"><i class="fas fa-ear-listen"></i><span>Lighter sleep</span></button>
        <button type="button" class="qd-ctl qd-ctl--small" data-qd="tune-up" title="Sleep more deeply"><i class="fas fa-moon"></i><span>Deeper sleep</span></button>
        <button type="button" class="qd-ctl qd-ctl--end" data-qd="end" title="End (Esc)"><i class="fas fa-door-open"></i><span>End</span></button>
    </div>

    <div class="qd-panel-wrap"><section class="qd-panel" data-qd-panel></section></div>`;
}

function classLine(classId) {
    const cls = classById(classId);
    if (!cls) return '';
    return `${cls.logo ? `<span aria-hidden="true">${esc(cls.logo)}</span> ` : ''}${esc(cls.name || 'Class')}`;
}

function setupHtml() {
    const classes = myClasses();
    const cls = classById(ui.classId);
    const here = cls ? classRoster(cls.id).filter((h) => !h.away).length : 0;
    const gift = ui.gift;
    const giftDef = hoardGiftByKey(gift.hoard.key);
    const treatChoices = CLASS_TREATS;
    const isCustom = gift.treat && !CLASS_TREATS.includes(gift.treat);
    return `
    <div class="qd-panel__head">
        <span class="qd-panel__seal" aria-hidden="true"><i class="fas fa-moon"></i></span>
        <div>
            <h3 class="qd-panel__title">Let the dragon sleep</h3>
            <p class="qd-panel__lede">Keep the room calm and the dragon leaves a gift. If it wakes, the clock simply waits until the room settles again.</p>
        </div>
        <button type="button" class="qd-x" data-qd="close" aria-label="Close"><i class="fas fa-xmark"></i></button>
    </div>

    ${cls ? `<p class="qd-panel__class">${classLine(cls.id)} <span>· ${here} hero${here === 1 ? '' : 'es'} here</span></p>`
        : `<div class="qd-field"><span class="qd-label">Which class?</span><div class="qd-chips">${classes.map((c) => `<button type="button" class="qd-chip" data-qd-class-pick="${esc(c.id)}">${esc(c.logo || '')} ${esc(c.name || 'Class')}</button>`).join('') || '<em class="qd-muted">Add a class first.</em>'}</div></div>`}

    <div class="qd-field">
        <span class="qd-label">How quiet?</span>
        <div class="qd-levels">
            ${QUIET_LEVELS.map((l, i) => `<button type="button" class="qd-level${ui.level === l.key ? ' is-on' : ''}" data-qd-level="${l.key}" aria-pressed="${ui.level === l.key}">
                <span class="qd-level__bars" aria-hidden="true">${[0, 1, 2].map((b) => `<i class="${b <= i ? 'is-lit' : ''}"></i>`).join('')}</span>
                <strong>${esc(l.name)}</strong><small>${esc(l.hint)}</small></button>`).join('')}
        </div>
    </div>

    <div class="qd-field">
        <span class="qd-label">How long?</span>
        <div class="qd-chips">
            ${QUIET_MINUTES.map((m) => `<button type="button" class="qd-chip${ui.minutes === m ? ' is-on' : ''}" data-qd-minutes="${m}">${m} calm minutes</button>`).join('')}
            <label class="qd-chip qd-chip--input${QUIET_MINUTES.includes(ui.minutes) ? '' : ' is-on'}"><input type="number" min="1" max="60" inputmode="numeric" data-qd-minutes-input value="${QUIET_MINUTES.includes(ui.minutes) ? '' : ui.minutes}" placeholder="Other" aria-label="Other length in minutes"> min</label>
        </div>
    </div>

    <div class="qd-field">
        <span class="qd-label">The dragon's gift</span>
        <div class="qd-gifts">
            ${HOARD_GIFTS.map((g) => `<button type="button" class="qd-gift qd-gift--${g.key}${gift.hoard.key === g.key ? ' is-on' : ''}" data-qd-hoard="${g.key}" aria-pressed="${gift.hoard.key === g.key}">
                <span class="qd-gift__icon" aria-hidden="true">${giftIcon(g.key)}</span>
                <strong>${esc(g.name)}</strong><small>${esc(g.hint)}</small></button>`).join('')}
        </div>
        ${giftDef.amounts.length ? `<div class="qd-chips qd-chips--amounts">${giftDef.amounts.map((a) => `<button type="button" class="qd-chip${gift.hoard.amount === a ? ' is-on' : ''}" data-qd-amount="${a}">${amountLabel(giftDef.key, a)}</button>`).join('')}</div>` : ''}
    </div>

    <div class="qd-field">
        <span class="qd-label">And a classroom treat <em>(optional, you give it in person)</em></span>
        <div class="qd-chips">
            <button type="button" class="qd-chip${!gift.treat ? ' is-on' : ''}" data-qd-treat="">No treat</button>
            ${treatChoices.map((t) => `<button type="button" class="qd-chip${gift.treat === t ? ' is-on' : ''}" data-qd-treat="${esc(t)}">${esc(t)}</button>`).join('')}
            <label class="qd-chip qd-chip--input qd-chip--wide${isCustom ? ' is-on' : ''}"><i class="fas fa-pen" aria-hidden="true"></i><input type="text" maxlength="80" data-qd-treat-input value="${esc(isCustom ? gift.treat : ui.customTreat)}" placeholder="Your own treat…" aria-label="Your own treat"></label>
        </div>
    </div>

    <p class="qd-privacy"><i class="fas fa-microphone-lines" aria-hidden="true"></i> The microphone only measures how loud the room is. Nothing is recorded, kept or sent anywhere.</p>
    ${ui.error ? `<p class="qd-error" role="alert">${esc(ui.error)}</p>` : ''}
    <div class="qd-actions">
        <button type="button" class="qd-btn qd-btn--ghost" data-qd="close">${ui.from === 'wallpaper' ? 'Back to the projector' : 'Not now'}</button>
        <button type="button" class="qd-btn qd-btn--go" data-qd="start" ${cls && giftIsReady(gift) ? '' : 'disabled'}><i class="fas fa-moon"></i> Let the dragon sleep</button>
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

function calibrateHtml() {
    return `
    <div class="qd-panel__center">
        <span class="qd-listen" aria-hidden="true"><i></i><i></i><i></i></span>
        <h3 class="qd-panel__title">The dragon is listening to the room…</h3>
        <p class="qd-panel__lede">Stay quiet for ${CALIBRATE_SECONDS} seconds so it learns how a calm room sounds here.</p>
    </div>`;
}

function confirmEndHtml() {
    const done = run ? Math.floor(run.calm / 60) : 0;
    return `
    <div class="qd-panel__center">
        <h3 class="qd-panel__title">End the quiet time?</h3>
        <p class="qd-panel__lede">${done ? `The class has given the dragon ${done} calm minute${done === 1 ? '' : 's'} so far.` : 'The dragon has only just fallen asleep.'} You can still give the gift if you feel they earned it.</p>
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
    let hoardNote = '';
    if (gift.hoard.key === 'gold' || gift.hoard.key === 'stars') hoardNote = paid ? `Given to ${result.heroes || run.heroIds.length} hero${(result.heroes || run.heroIds.length) === 1 ? '' : 'es'}.` : '';
    if (gift.hoard.key === 'quest') hoardNote = paid ? 'Added to this month’s Team Quest.' : '';
    if (!result) hoardNote = 'Placing it in the hoard…';
    const wakes = run.ears.wakes;
    return `
    <div class="qd-panel__center qd-gift-card">
        <div class="qd-gift-card__chest" aria-hidden="true">${giftIcon('none')}</div>
        <p class="qd-gift-card__kicker">${run.minutes} calm minute${run.minutes === 1 ? '' : 's'}</p>
        <h3 class="qd-panel__title">The dragon leaves a gift!</h3>
        <p class="qd-panel__lede">${wakes ? `It woke ${wakes === 1 ? 'once' : `${wakes} times`}, and every time the class let it settle again.` : 'It never woke once. A truly quiet class!'}</p>
        <ul class="qd-gift-card__list">
            ${hoardLine ? `<li><span class="qd-gift__icon" aria-hidden="true">${giftIcon(gift.hoard.key)}</span><span><strong>${esc(hoardLine)}</strong>${hoardNote ? `<small>${esc(hoardNote)}</small>` : ''}${result && !paid ? '<small class="qd-error">This could not be saved. Check the connection and try again.</small>' : ''}</span></li>` : ''}
            ${gift.treat ? `<li><span class="qd-gift__icon" aria-hidden="true">${giftIcon('none')}</span><span><strong>${esc(gift.treat)}</strong><small>From the teacher, in person.</small></span></li>` : ''}
        </ul>
        <div class="qd-actions">
            ${result && !paid ? '<button type="button" class="qd-btn qd-btn--gold" data-qd="retry-pay"><i class="fas fa-rotate"></i> Try again</button>' : ''}
            <button type="button" class="qd-btn qd-btn--go" data-qd="close">${ui.from === 'wallpaper' ? 'Back to the projector' : 'Close'}</button>
        </div>
    </div>`;
}

function setPanel(html) {
    const panel = stage?.querySelector('[data-qd-panel]');
    if (panel) panel.innerHTML = html;
}

function renderPanel() {
    if (!stage) return;
    stage.querySelector('[data-qd-class]').innerHTML = ui.classId ? classLine(ui.classId) : '';
    if (stage.dataset.phase === 'setup') setPanel(setupHtml());
}

function setHoard(progress) {
    const pieces = hoardPiecesFor(progress);
    stage?.querySelectorAll('[data-hoard]').forEach((g) => g.classList.toggle('is-shown', Number(g.dataset.hoard) <= pieces));
}

// ─── Events ───────────────────────────────────────────────────────────────────

function onClick(e) {
    const t = e.target.closest('button');
    if (!t || !stage) return;
    if (t.dataset.qdClassPick) { ui.classId = t.dataset.qdClassPick; renderPanel(); return; }
    if (t.dataset.qdLevel) { ui.level = t.dataset.qdLevel; savePrefs(); renderPanel(); return; }
    if (t.dataset.qdMinutes) { ui.minutes = Number(t.dataset.qdMinutes); savePrefs(); renderPanel(); return; }
    if (t.dataset.qdHoard) {
        const def = hoardGiftByKey(t.dataset.qdHoard);
        ui.gift = normalizeGift({ hoard: { key: def.key, amount: def.key === ui.gift.hoard.key ? ui.gift.hoard.amount : DEFAULT_AMOUNTS[def.key] }, treat: ui.gift.treat });
        savePrefs(); renderPanel(); return;
    }
    if (t.dataset.qdAmount) { ui.gift = normalizeGift({ ...ui.gift, hoard: { ...ui.gift.hoard, amount: Number(t.dataset.qdAmount) } }); savePrefs(); renderPanel(); return; }
    if ('qdTreat' in t.dataset) { ui.gift = normalizeGift({ ...ui.gift, treat: t.dataset.qdTreat }); savePrefs(); renderPanel(); return; }

    switch (t.dataset.qd) {
        case 'close': closeQuietDragon(); break;
        case 'start': startSession(); break;
        case 'hold': toggleHold(); break;
        case 'tune-down': tune(-1); break;
        case 'tune-up': tune(1); break;
        case 'end': askEnd(); break;
        case 'resume': resume(); break;
        case 'gift-now': finish(); break;
        case 'retry-pay': payGift(); break;
        default: break;
    }
}

function onInput(e) {
    if (!stage || stage.dataset.phase !== 'setup') return;
    if (e.target.matches('[data-qd-minutes-input]')) {
        const v = Number(e.target.value);
        if (v > 0) {
            ui.minutes = clampMinutes(v);
            savePrefs();
            stage.querySelectorAll('[data-qd-minutes]').forEach((b) => b.classList.toggle('is-on', Number(b.dataset.qdMinutes) === ui.minutes));
            e.target.closest('.qd-chip')?.classList.toggle('is-on', !QUIET_MINUTES.includes(ui.minutes));
        }
    }
    if (e.target.matches('[data-qd-treat-input]')) {
        ui.customTreat = e.target.value;
        ui.gift = normalizeGift({ ...ui.gift, treat: e.target.value });
        savePrefs();
        stage.querySelectorAll('[data-qd-treat]').forEach((b) => b.classList.toggle('is-on', b.dataset.qdTreat === ui.gift.treat));
        e.target.closest('.qd-chip')?.classList.toggle('is-on', Boolean(ui.gift.treat));
        const go = stage.querySelector('[data-qd="start"]');
        if (go) go.disabled = !(ui.classId && giftIsReady(ui.gift));
    }
}

function onKey(e) {
    if (!stage) return;
    const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (stage.dataset.phase === 'listening') askEnd();
        else if (stage.dataset.phase === 'ending') resume();
        else closeQuietDragon();
        return;
    }
    if (typing) { e.stopImmediatePropagation(); return; }
    if (e.key === ' ' && stage.dataset.phase === 'listening') {
        e.preventDefault();
        if (e.target?.closest?.('button')) e.target.blur();
        toggleHold();
    }
    // The projector's own keys (cards, full screen) stay quiet while the dragon is up.
    e.stopImmediatePropagation();
    wakeControls();
}

let controlsTimer = null;
function wakeControls() {
    if (!stage) return;
    stage.classList.add('qd-awake-ui');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => stage?.classList.remove('qd-awake-ui'), 3200);
}

// ─── Listening ────────────────────────────────────────────────────────────────

async function startSession() {
    if (!ui.classId || !giftIsReady(ui.gift)) return;
    const media = navigator.mediaDevices;
    if (!media?.getUserMedia) {
        ui.error = 'This browser cannot use a microphone here. Try Chrome or Edge on the classroom computer.';
        renderPanel();
        return;
    }
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
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

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
        calibrateUntil: performance.now() + CALIBRATE_SECONDS * 1000,
        ears: null,
        tune: 0,
        calm: 0,
        held: false,
        last: performance.now(),
        shownSecond: -1,
        shownPieces: -1,
        paid: null,
        timer: null
    };
    unfollow?.();
    unfollow = null;
    stage.dataset.phase = 'calibrating';
    setPanel(calibrateHtml());
    run.timer = setInterval(tick, TICK_MS);
}

function stopListening() {
    if (!run) return;
    clearInterval(run.timer);
    run.timer = null;
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
        if (now >= run.calibrateUntil) {
            run.ears = createDragonEars({ floor: calibrateFloor(run.calibration), margin: run.level.margin, tune: run.tune });
            stage.dataset.phase = 'listening';
            setPanel('');
            wakeControls();
        }
        return;
    }
    if (stage.dataset.phase !== 'listening') return;

    const snap = run.ears.step(db, dt, { held: run.held });
    if (countsAsCalm(snap.mood, run.held)) run.calm = Math.min(run.goal, run.calm + dt);
    // While the teacher speaks the dragon simply sleeps on; the clock and its ears wait.
    paint(run.held ? { ...snap, mood: 'asleep', ratio: 0 } : snap);
    if (run.calm >= run.goal) finish();
}

function paint(snap) {
    if (stage.dataset.mood !== snap.mood) {
        stage.dataset.mood = snap.mood;
        const moodEl = stage.querySelector('[data-qd-mood]');
        if (moodEl) moodEl.textContent = MOOD_TEXT[snap.mood] || '';
        const label = stage.querySelector('[data-qd-left-label]');
        if (label) label.textContent = snap.mood === 'awake' ? 'the clock waits for calm' : 'calm minutes to go';
    }
    const ear = stage.querySelector('[data-qd-ear]');
    if (ear) ear.style.transform = `scaleX(${Math.min(1, snap.ratio / 1.5).toFixed(3)})`;

    const second = Math.floor(run.calm);
    if (second !== run.shownSecond) {
        run.shownSecond = second;
        const left = stage.querySelector('[data-qd-left]');
        if (left) left.textContent = formatClock(run.goal - run.calm);
        const fill = stage.querySelector('.qd-ring__fill');
        if (fill) fill.style.strokeDashoffset = (RING_LENGTH * (1 - run.calm / run.goal)).toFixed(1);
        const pieces = hoardPiecesFor(run.calm / run.goal);
        if (pieces !== run.shownPieces) { run.shownPieces = pieces; setHoard(run.calm / run.goal); }
    }
}

function toggleHold() {
    if (!run || stage?.dataset.phase !== 'listening') return;
    run.held = !run.held;
    stage.classList.toggle('is-held', run.held);
    const btn = stage.querySelector('[data-qd="hold"]');
    if (btn) {
        btn.setAttribute('aria-pressed', String(run.held));
        btn.querySelector('span').textContent = run.held ? 'Listen again' : 'Teacher speaking';
    }
}

function tune(direction) {
    if (!run) return;
    run.tune = tuneBy(run.tune, direction);
    if (run.ears) run.ears.tune = run.tune;
    const msg = stage.querySelector('[data-qd-mood]');
    if (msg) {
        msg.textContent = direction > 0 ? 'The dragon sleeps a little more deeply.' : 'The dragon sleeps a little more lightly.';
        clearTimeout(tune.t);
        tune.t = setTimeout(() => { if (stage && run) msg.textContent = MOOD_TEXT[stage.dataset.mood] || ''; }, 2200);
    }
}

function askEnd() {
    if (!run || stage.dataset.phase !== 'listening') { closeQuietDragon(); return; }
    stage.dataset.phase = 'ending';
    setPanel(confirmEndHtml());
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
    stage.dataset.phase = 'gift';
    stage.dataset.mood = 'gift';
    setHoard(1);
    const moodEl = stage.querySelector('[data-qd-mood]');
    if (moodEl) moodEl.textContent = 'The dragon wakes gently, very pleased with you.';
    const left = stage.querySelector('[data-qd-left]');
    if (left) left.textContent = String(run.minutes);
    const leftLabel = stage.querySelector('[data-qd-left-label]');
    if (leftLabel) leftLabel.textContent = 'calm minutes given';
    const fill = stage.querySelector('.qd-ring__fill');
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
    if (stage?.dataset.phase === 'gift') setPanel(giftHtml(run.paid));
}

// Test hooks for the preview page (no microphone in headless browsers).
export const quietDragonTestHooks = {
    get stage() { return stage; },
    showMood(mood) { if (stage) { stage.dataset.phase = 'listening'; setPanel(''); stage.dataset.mood = mood; const m = stage.querySelector('[data-qd-mood]'); if (m) m.textContent = MOOD_TEXT[mood] || ''; } },
    showProgress(p, ratio = 0.3) {
        if (!stage) return;
        setHoard(p);
        const fill = stage.querySelector('.qd-ring__fill');
        if (fill) fill.style.strokeDashoffset = (RING_LENGTH * (1 - p)).toFixed(1);
        const left = stage.querySelector('[data-qd-left]');
        if (left) left.textContent = formatClock(15 * 60 * (1 - p));
        const ear = stage.querySelector('[data-qd-ear]');
        if (ear) ear.style.transform = `scaleX(${Math.min(1, ratio / 1.5)})`;
    },
    showGift(gift, heroes = 23, wakes = 2) {
        if (!stage) return;
        run = { gift: normalizeGift(gift), minutes: 15, heroIds: Array.from({ length: heroes }, (_, i) => `h${i}`), ears: { wakes } };
        stage.dataset.phase = 'gift';
        stage.dataset.mood = 'gift';
        const m = stage.querySelector('[data-qd-mood]');
        if (m) m.textContent = 'The dragon wakes gently, very pleased with you.';
        setHoard(1);
        setPanel(giftHtml({ paid: true, heroes }));
    },
    showEnding() { if (stage) { run = run || { calm: 420 }; stage.dataset.phase = 'ending'; setPanel(confirmEndHtml()); } },
    showCalibrating() { if (stage) { stage.dataset.phase = 'calibrating'; setPanel(calibrateHtml()); } },
    hold(on) { stage?.classList.toggle('is-held', on); }
};

