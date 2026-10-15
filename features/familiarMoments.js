// features/familiarMoments.js — the big moments of a familiar's life, and how the class hears about them.
//
//   showFamiliarNotice()     a small card that rises from the corner when a familiar is ready to hatch
//                            or evolve, with its art and a "Watch it" button (several stack and fold).
//   playFamiliarEvolution()  the Evolution Moment: the old form glows and shakes, its light flickers
//                            between the old and the new shape faster and faster, a flash, and the new
//                            form bursts out with a ribbon naming it. Hatches crack the egg open instead.
//   bindFamiliarTips()       the familiar's own hover card (name, form, how far to the next one)
//                            instead of the browser's title box.
// Everything that moves is a transform or opacity; low-power machines get fewer particles and
// reduced motion jumps straight to the reveal. Styles: styles/familiar_moments.css.

import * as state from '../state.js';
import { ensureAudioReady, playFamiliarEvolutionSfx } from '../audio.js';
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';
import {
    FAMILIAR_DEN_THEMES,
    FAMILIAR_MAX_LEVEL,
    FAMILIAR_TYPES,
    describeFamiliarForTip,
    familiarArtSvg,
    familiarStageName,
    getPendingFamiliarMoment,
    markFamiliarSeen,
    openFamiliarStatsOverlay,
    playFamiliarCall
} from './familiars.js';
import { FAMILIAR_TRICKS, FAMILIAR_TRICK_LEVEL } from './familiarForge.mjs';

let stylesRequested = false;
function ensureStyles() {
    if (stylesRequested || typeof document === 'undefined') return;
    stylesRequested = true;
    import('../styles/familiar_moments.css').catch((e) => console.warn('Familiar moment styles failed to load:', e));
}

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

let liteTier = null;
function isLite() {
    if (liteTier === null) {
        try { liteTier = detectLowPowerTier(); } catch { liteTier = false; }
    }
    return liteTier;
}
function reducedMotion() {
    try { return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

// ─── Notices ──────────────────────────────────────────────────────────────────

const NOTICE_MAX = 3;
const NOTICE_MS = 16000;

function noticeStack() {
    let stack = document.querySelector('.fam-notice-stack');
    if (!stack) {
        stack = document.createElement('div');
        stack.className = 'fam-notice-stack';
        stack.setAttribute('role', 'status');
        stack.setAttribute('aria-live', 'polite');
        document.body.appendChild(stack);
    }
    return stack;
}

function dismissNotice(card) {
    if (!card || card.dataset.state === 'leaving') return;
    card.dataset.state = 'leaving';
    clearTimeout(card.__timer);
    card.classList.add('is-leaving');
    setTimeout(() => {
        card.remove();
        refreshNoticeOverflow();
    }, 420);
}

function refreshNoticeOverflow() {
    const stack = document.querySelector('.fam-notice-stack');
    if (!stack) return;
    const cards = [...stack.querySelectorAll('.fam-notice:not(.is-leaving)')];
    cards.forEach((card, i) => card.classList.toggle('is-folded', i < cards.length - NOTICE_MAX));
    const hidden = Math.max(0, cards.length - NOTICE_MAX);
    let more = stack.querySelector('.fam-notice-more');
    if (!hidden) { more?.remove(); return; }
    if (!more) {
        more = document.createElement('div');
        more.className = 'fam-notice-more';
        stack.prepend(more);
    }
    more.textContent = `+${hidden} more ${hidden === 1 ? 'familiar is' : 'familiars are'} ready`;
}

/**
 * Tell the class a familiar is ready for its moment.
 * @param {string} studentId
 * @param {object} familiar  the familiar with its new level
 */
export function showFamiliarNotice(studentId, familiar) {
    if (typeof document === 'undefined' || !familiar || !FAMILIAR_TYPES[familiar.typeId]) return;
    ensureStyles();
    const info = describeFamiliarForTip(studentId);
    const typeDef = FAMILIAR_TYPES[familiar.typeId];
    const level = Math.max(1, Math.min(FAMILIAR_MAX_LEVEL, Number(familiar.level) || 1));
    const seen = Math.max(0, Number(familiar.seenLevel) || 0);
    const hatch = seen === 0;
    const firstName = info?.firstName || 'A hero';
    const name = info?.name || typeDef.name;
    const stack = noticeStack();
    stack.querySelector(`.fam-notice[data-student-id="${CSS.escape(studentId)}"]`)?.remove();

    const before = hatch
        ? familiarArtSvg(familiar, studentId, { egg: true, progress: 100, mode: 'chip' })
        : familiarArtSvg(familiar, studentId, { level: seen, mode: 'chip' });
    const kicker = hatch ? 'An egg is cracking!' : level === FAMILIAR_MAX_LEVEL ? 'A Mythic evolution!' : 'Evolution time!';
    const line = hatch
        ? `${firstName}'s ${typeDef.name} egg is ready to hatch.`
        : `${firstName}'s ${name} is ready to become a ${familiarStageName(familiar.typeId, level)}.`;

    const card = document.createElement('div');
    card.className = `fam-notice${level === FAMILIAR_MAX_LEVEL ? ' fam-notice--mythic' : ''}`;
    card.dataset.studentId = studentId;
    card.dataset.famType = familiar.typeId;
    card.style.setProperty('--fam-color', typeDef.eggColor);
    card.style.setProperty('--fam-accent', typeDef.eggAccent);
    card.innerHTML = `
        <div class="fam-notice__art" aria-hidden="true"><span class="fam-notice__glow"></span>${before}</div>
        <div class="fam-notice__text">
            <div class="fam-notice__kicker">${FAMILIAR_DEN_THEMES[familiar.typeId]?.sigil || '✨'} ${esc(kicker)}</div>
            <div class="fam-notice__line">${esc(line)}</div>
            <div class="fam-notice__actions">
                <button type="button" class="fam-notice__watch"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Watch it</button>
                <button type="button" class="fam-notice__later">Later</button>
            </div>
        </div>
        <button type="button" class="fam-notice__close" aria-label="Close">&times;</button>
        <span class="fam-notice__timer" aria-hidden="true"></span>`;
    stack.appendChild(card);
    refreshNoticeOverflow();

    card.querySelector('.fam-notice__watch').addEventListener('click', () => {
        dismissNotice(card);
        playFamiliarEvolution(studentId);
    });
    card.querySelector('.fam-notice__later').addEventListener('click', () => dismissNotice(card));
    card.querySelector('.fam-notice__close').addEventListener('click', () => dismissNotice(card));
    card.addEventListener('pointerenter', () => { clearTimeout(card.__timer); card.classList.add('is-held'); });
    card.addEventListener('pointerleave', () => {
        card.classList.remove('is-held');
        card.__timer = setTimeout(() => dismissNotice(card), NOTICE_MS / 2);
    });
    card.__timer = setTimeout(() => dismissNotice(card), NOTICE_MS);

    ensureAudioReady().then(() => {
        playFamiliarEvolutionSfx('notice');
        setTimeout(() => playFamiliarCall({ ...familiar, level: Math.max(1, seen) }, studentId), 380);
    }).catch(() => {});
}

// ─── The Evolution Moment ─────────────────────────────────────────────────────

let activeMoment = null;

function particles(count, cls, spread = 1) {
    return Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + (i % 3) * 0.37;
        const d = (130 + (i * 53) % 120) * spread;
        return `<i class="${cls}" style="--i:${i};--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d)}px;--rot:${(i * 47) % 360}deg"></i>`;
    }).join('');
}

function unlockLine(familiar, level, displayName) {
    const trick = FAMILIAR_TRICKS[familiar.typeId];
    if (level === FAMILIAR_TRICK_LEVEL && trick) return `New trick: <b>${esc(trick.name)}</b>. Once a month in the Quiz of the Week, ${esc(displayName)} ${esc(trick.verb)}.`;
    if (level === FAMILIAR_MAX_LEVEL) return `Mythic form! ${trick ? `${esc(trick.name)} now works <b>twice a month</b>, and ` : ''}every 150 stars together adds a Starbond mark.`;
    if (level === 1) return 'Give your new friend a true name in its Den.';
    if (level === 4) return 'It now wears its regalia. One more form to go!';
    return 'Keep earning stars together to grow even stronger.';
}

/**
 * Play the moment for this student's familiar, if one is waiting (or replay its current form).
 * @param {string} studentId
 * @param {{ then?: 'den'|null }} [opts]  open the Den afterwards
 */
export function playFamiliarEvolution(studentId, { then = null } = {}) {
    const score = (state.get('allStudentScores') || []).find((s) => s.id === studentId);
    const familiar = score?.familiar;
    const typeDef = FAMILIAR_TYPES[familiar?.typeId];
    if (!familiar || !typeDef || familiar.state !== 'alive') {
        if (then === 'den') openFamiliarStatsOverlay(studentId, { skipMoment: true });
        return;
    }
    ensureStyles();
    closeMoment(true);

    const pending = getPendingFamiliarMoment(familiar) || { from: Math.max(0, (Number(familiar.level) || 1) - 1), to: Number(familiar.level) || 1 };
    const { from, to } = pending;
    const hatch = from === 0;
    const info = describeFamiliarForTip(studentId);
    const displayName = info?.name || typeDef.name;
    const firstName = info?.firstName || '';
    const newStage = familiarStageName(familiar.typeId, to);
    const lite = isLite();
    const reduced = reducedMotion();

    const oldArt = hatch
        ? familiarArtSvg(familiar, studentId, { egg: true, progress: 100, mode: 'full' })
        : familiarArtSvg(familiar, studentId, { level: from, mode: 'full', starbond: 0 });
    const newArt = familiarArtSvg(familiar, studentId, { level: to, mode: 'full' });
    const pips = Array.from({ length: FAMILIAR_MAX_LEVEL }, (_, i) =>
        `<span class="fem__pip${i < to ? ' is-lit' : ''}${i === to - 1 ? ' is-new' : ''}" aria-hidden="true"></span>`).join('');

    const layer = document.createElement('div');
    layer.className = `fem${hatch ? ' fem--hatch' : ''}${to === FAMILIAR_MAX_LEVEL ? ' fem--mythic' : ''}${lite ? ' fem--lite' : ''}${reduced ? ' fem--reduced' : ''}`;
    layer.dataset.famType = familiar.typeId;
    layer.dataset.phase = 'charge';
    layer.style.setProperty('--fam-color', typeDef.eggColor);
    layer.style.setProperty('--fam-accent', typeDef.eggAccent);
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', hatch ? `${firstName}'s familiar is hatching` : `${displayName} is evolving`);
    layer.innerHTML = `
        <div class="fem__sky" aria-hidden="true"></div>
        <div class="fem__rays" aria-hidden="true"></div>
        <div class="fem__gather" aria-hidden="true">${particles(lite ? 10 : 22, 'fem__mote')}</div>
        <header class="fem__title">
            <span class="fem__kicker">${hatch ? 'Crack... crack...' : 'What is happening?'}</span>
            <h2 class="fem__headline">${esc(hatch ? `${firstName}'s egg is hatching!` : `${displayName} is evolving!`)}</h2>
        </header>
        <div class="fem__stage" aria-hidden="true">
            <div class="fem__ring"></div>
            <div class="fem__ring fem__ring--outer"></div>
            <div class="fem__form fem__form--old">${oldArt}</div>
            <div class="fem__form fem__form--new">${newArt}</div>
            <div class="fem__flash"></div>
            <div class="fem__burst">${particles(lite ? 10 : 24, 'fem__spark', 1.2)}</div>
            ${hatch ? `<div class="fem__shards">${Array.from({ length: 8 }, (_, i) => `<i class="fem__shard" style="--i:${i};--dx:${Math.round(Math.cos(i * 0.785) * 160)}px;--dy:${Math.round(Math.sin(i * 0.785) * 120 - 60)}px;--rot:${i * 61}deg"></i>`).join('')}</div>` : ''}
        </div>
        <div class="fem__reveal">
            <div class="fem__ribbon"><span>${esc(hatch ? `Meet the ${newStage}!` : `${displayName} became a ${newStage}!`)}</span></div>
            <div class="fem__pips" aria-label="Form ${to} of ${FAMILIAR_MAX_LEVEL}">${pips}</div>
            <p class="fem__unlock">${unlockLine(familiar, to, displayName)}</p>
            <div class="fem__actions">
                <button type="button" class="fem__btn fem__btn--primary" data-act="done">${hatch ? 'Welcome!' : 'Hooray!'}</button>
                <button type="button" class="fem__btn" data-act="den"><i class="fas fa-paw" aria-hidden="true"></i> Open the Den</button>
            </div>
        </div>
        <button type="button" class="fem__skip">Skip</button>`;
    document.body.appendChild(layer);

    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    activeMoment = { layer, timers, studentId, then };
    let revealed = false;

    const reveal = () => {
        if (revealed) return;
        revealed = true;
        timers.forEach(clearTimeout);
        layer.dataset.phase = 'reveal';
        markFamiliarSeen(studentId, to);
        playFamiliarEvolutionSfx('fanfare');
        setTimeout(() => playFamiliarCall({ ...familiar, level: to }, studentId), 520);
        setTimeout(() => layer.querySelector('[data-act="done"]')?.focus({ preventScroll: true }), 60);
    };

    layer.querySelector('.fem__skip').addEventListener('click', reveal);
    layer.querySelector('[data-act="done"]').addEventListener('click', () => {
        const goDen = activeMoment?.then === 'den';
        closeMoment();
        if (goDen) setTimeout(() => openFamiliarStatsOverlay(studentId, { skipMoment: true }), 380);
    });
    layer.querySelector('[data-act="den"]').addEventListener('click', () => {
        closeMoment();
        setTimeout(() => openFamiliarStatsOverlay(studentId, { skipMoment: true }), 380);
    });
    layer.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!revealed) reveal();
            else closeMoment();
        }
    });
    layer.tabIndex = -1;
    layer.focus({ preventScroll: true });

    if (reduced) {
        reveal();
        return;
    }
    ensureAudioReady().catch(() => false).finally(() => {
        if (activeMoment?.layer !== layer || revealed) return;
        playFamiliarEvolutionSfx(hatch ? 'crack' : 'charge');
        at(1700, () => { layer.dataset.phase = 'morph'; playFamiliarEvolutionSfx('morph'); });
        at(4300, () => { layer.dataset.phase = 'flash'; playFamiliarEvolutionSfx('burst'); });
        at(4750, reveal);
    });
}

function closeMoment(immediate = false) {
    if (!activeMoment) return;
    const { layer, timers } = activeMoment;
    activeMoment = null;
    timers.forEach(clearTimeout);
    if (immediate) { layer.remove(); return; }
    layer.classList.add('is-leaving');
    setTimeout(() => layer.remove(), 420);
}

// ─── Hover card ───────────────────────────────────────────────────────────────

let tipEl = null;
let tipFor = null;
let tipsBound = false;

function ensureTip() {
    if (tipEl?.isConnected) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'fam-tip';
    tipEl.setAttribute('role', 'tooltip');
    tipEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tipEl);
    return tipEl;
}

function tipHtml(info) {
    const pending = info.pending;
    let foot;
    if (info.familiar.state === 'egg') {
        foot = info.progress.remaining > 0
            ? `<div class="fam-tip__bar"><i style="width:${info.percent}%"></i></div><div class="fam-tip__note">${info.progress.remaining} more ${info.progress.remaining === 1 ? 'star' : 'stars'} to hatch</div>`
            : '<div class="fam-tip__note fam-tip__note--ready">Ready to hatch!</div>';
    } else if (pending) {
        foot = `<div class="fam-tip__note fam-tip__note--ready">${pending.from === 0 ? 'Ready to hatch!' : `Ready to become a ${esc(familiarStageName(info.typeId, pending.to))}!`} Tap to watch.</div>`;
    } else if (info.level >= FAMILIAR_MAX_LEVEL) {
        foot = `<div class="fam-tip__bar fam-tip__bar--gold"><i style="width:${Math.round((info.starbond.intoNext / info.starbond.step) * 100)}%"></i></div><div class="fam-tip__note">Mythic · Starbond ${info.starbond.marks}</div>`;
    } else {
        foot = `<div class="fam-tip__bar"><i style="width:${info.percent}%"></i></div><div class="fam-tip__note">${info.progress.remaining} more ${info.progress.remaining === 1 ? 'star' : 'stars'} to ${esc(info.nextName)}</div>`;
    }
    const form = info.familiar.state === 'egg' ? 'Egg' : `Form ${info.level} of ${FAMILIAR_MAX_LEVEL} · ${esc(info.stageName)}`;
    return `
        <div class="fam-tip__head"><span class="fam-tip__name">${esc(info.name)}</span>${info.shiny ? '<span class="fam-tip__shiny">Shiny</span>' : ''}</div>
        <div class="fam-tip__kind">${esc(info.kind)}${info.firstName ? ` · ${esc(info.firstName)}'s companion` : ''}</div>
        <div class="fam-tip__form">${form}</div>
        ${foot}`;
}

function showTip(target) {
    const studentId = target?.dataset?.studentId;
    const info = studentId ? describeFamiliarForTip(studentId) : null;
    if (!info) return;
    const tip = ensureTip();
    tip.style.setProperty('--fam-color', info.color);
    tip.style.setProperty('--fam-accent', info.accent);
    tip.dataset.famType = info.typeId;
    tip.innerHTML = tipHtml(info);
    tipFor = target;
    const r = target.getBoundingClientRect();
    tip.classList.add('is-measuring');
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    tip.classList.remove('is-measuring');
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(8, Math.min(window.innerWidth - tw - 8, left));
    let top = r.top - th - 10;
    let below = false;
    if (top < 8) { top = r.bottom + 10; below = true; }
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
    tip.style.setProperty('--arrow-x', `${Math.round(r.left + r.width / 2 - left)}px`);
    tip.classList.toggle('is-below', below);
    tip.classList.add('is-on');
}

function hideTip() {
    tipFor = null;
    tipEl?.classList.remove('is-on');
}

/** One set of document listeners serves every familiar on every screen. */
export function bindFamiliarTips() {
    if (tipsBound || typeof document === 'undefined') return;
    tipsBound = true;
    ensureStyles();
    document.addEventListener('pointerover', (e) => {
        if (e.pointerType === 'touch') return;
        const target = e.target.closest?.('[data-fam-tip]');
        if (target && target !== tipFor) showTip(target);
        else if (!target && tipFor) hideTip();
    });
    document.addEventListener('pointerdown', hideTip, true);
    document.addEventListener('scroll', hideTip, true);
    document.addEventListener('focusin', (e) => {
        const target = e.target.closest?.('[data-fam-tip]');
        if (target) showTip(target);
    });
    document.addEventListener('focusout', (e) => { if (e.target.closest?.('[data-fam-tip]')) hideTip(); });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const target = e.target.closest?.('.enlargeable-familiar[role="button"]');
        if (!target || e.target !== target) return;
        e.preventDefault();
        target.click();
    });
}
