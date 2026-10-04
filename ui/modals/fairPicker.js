// ui/modals/fairPicker.js — Fair Picker (Home › Class Actions and Global Tools).
// One child at a time for any question in any lesson, with the Quiz spotlight's promise:
// nobody gets a second turn until everyone here has had one. The round is kept on the class
// (`fairPicker`), so it carries on next lesson. Today's Team Maker teams can narrow the pick.
// Rules live in features/fairPickerCore.mjs.
import '../../styles/class_tools.css';
import * as utils from '../../utils.js';
import { playSound } from '../../audio.js';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import { normalizeFairPicker, fairStatus, pickTurn, passTurn, freshRound } from '../../features/fairPickerCore.mjs';
import { teamsForDay, teamBanner } from '../../features/teamMakerCore.mjs';
import { showAnimatedModal, hideModal } from './base.js';
import {
    esc, classById, classRoster, selectedToolClassId, followSelectedClass, faceHtml,
    readClassField, saveClassField, reducedMotion, enterFullscreen, leaveFullscreen
} from './classTools.js';

const MODAL_ID = 'fair-picker-modal';
const SAVE_DELAY_MS = 1500;
const THINK_CHOICES = [5, 10, 20];
const CALLS = ['Your turn!', 'Over to you!', 'You\'re up!', 'Take it away!'];

let ui = null;
let session = null;
let saveTimer = null;
const timers = new Set();

function later(fn, ms) {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
}
function clearTimers() {
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
}

function loadClass(classId) {
    const roster = classRoster(classId);
    const today = teamsForDay(readClassField(classId, 'teamMaker'), utils.getTodayDateString());
    const known = new Set(roster.map((h) => h.id));
    ui = {
        classId,
        roster,
        fair: normalizeFairPicker(readClassField(classId, 'fairPicker')),
        teams: today ? today.teams.map((ids) => ids.filter((id) => known.has(id))) : [],
        pool: null, // null = everyone here; else a team index
        current: null, // id on the spotlight
        rolling: false,
        call: '',
        think: 0,
        thinkLeft: 0,
        lite: detectLowPowerTier() || reducedMotion()
    };
}

function heroById(id) {
    return ui.roster.find((h) => h.id === id) || null;
}

function presentIds() {
    return ui.roster.filter((h) => !h.away).map((h) => h.id);
}

function poolIds() {
    return ui.pool == null ? null : (ui.teams[ui.pool] || null);
}

function status() {
    return fairStatus(ui.fair, { classIds: ui.roster.map((h) => h.id), presentIds: presentIds(), poolIds: poolIds() });
}

function scheduleSave() {
    clearTimeout(saveTimer);
    const classId = ui.classId;
    const value = { ...ui.fair, savedAt: Date.now() };
    saveTimer = setTimeout(() => { saveTimer = null; saveClassField(classId, 'fairPicker', value); }, SAVE_DELAY_MS);
    pendingSave = () => saveClassField(classId, 'fairPicker', value);
}
let pendingSave = null;
function flushSave() {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    pendingSave?.();
    pendingSave = null;
}

// ─── Markup ───────────────────────────────────────────────────────────────────

function headerHtml() {
    const cls = classById(ui.classId);
    return `
        <header class="fpk-head">
            <span class="fpk-head__crest" aria-hidden="true"><i class="fas fa-hand-sparkles"></i></span>
            <span class="fpk-head__text">
                <strong id="fpk-title" class="font-title">Fair Picker</strong>
                <span class="fpk-head__sub">${esc(cls?.logo || '📚')} ${esc(cls?.name || 'Class')} · one hero answers, everyone gets a turn</span>
            </span>
            <button type="button" class="fpk-bigbtn" data-fpk-big aria-pressed="false" title="Big screen for the projector"><i class="fas fa-expand"></i><span>Big screen</span></button>
            <button type="button" class="ct-close" data-fpk-close aria-label="Close Fair Picker"><i class="fas fa-times"></i></button>
        </header>`;
}

function poolHtml() {
    if (!ui.teams.length) return '';
    const chip = (key, label, emoji, colour) => {
        const on = String(ui.pool) === String(key);
        return `<button type="button" class="fpk-pool${on ? ' is-on' : ''}" data-fpk-pool="${key}" aria-pressed="${on}"${colour ? ` style="--c:${colour}"` : ''}><span aria-hidden="true">${emoji}</span>${esc(label)}</button>`;
    };
    return `<div class="fpk-pools" role="group" aria-label="Pick from">
        <span class="fpk-pools__label">Pick from</span>
        ${chip('null', 'Everyone', '🏰', '')}
        ${ui.teams.map((ids, i) => ids.length ? chip(i, teamBanner(i).short, teamBanner(i).emoji, teamBanner(i).primary) : '').join('')}
    </div>`;
}

function spotlightHtml(st) {
    const hero = ui.current ? heroById(ui.current) : null;
    const total = st.waiting.length + st.had.length + st.away.length;
    const doneShare = total ? st.had.length / total : 0;
    const name = hero ? esc(hero.first) : st.waiting.length ? 'Who will it be?' : (presentIds().length ? 'Everyone has had a turn!' : 'Nobody is here today');
    return `<section class="fpk-stage${hero ? ' has-hero' : ''}${ui.rolling ? ' is-rolling' : ''}" aria-live="polite">
        <div class="fpk-ring" aria-hidden="true">
            <span class="fpk-ring__beam"></span>
            <span class="fpk-ring__face">${hero ? faceHtml(hero, 'ct-face ct-face--xl') : '<i class="fas fa-question"></i>'}</span>
            ${ui.think ? `<svg class="fpk-think" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><circle class="fpk-think__run" cx="50" cy="50" r="46" style="--fpk-think:${ui.think}s"/></svg>` : ''}
        </div>
        <p class="fpk-call">${hero && !ui.rolling ? esc(ui.call) : ui.rolling ? 'Choosing…' : 'In the spotlight'}</p>
        <p class="fpk-name font-title" data-fpk-name>${name}</p>
        ${ui.think ? `<p class="fpk-think__left" data-fpk-think-left>${ui.thinkLeft > 0 ? `${ui.thinkLeft}s to think` : 'Time to answer!'}</p>` : ''}
        <div class="fpk-actions">
            <button type="button" class="ct-btn ct-btn--hero fpk-pick" data-fpk-pick ${ui.rolling || !presentIds().length ? 'disabled' : ''}><i class="fas fa-hand-sparkles"></i> ${hero ? 'Next hero' : 'Pick a hero'}</button>
            ${hero && !ui.rolling ? `
                <button type="button" class="ct-btn ct-btn--ghost" data-fpk-pass title="${esc(hero.first)} goes back to waiting"><i class="fas fa-rotate-left"></i> Not now</button>
                <span class="fpk-thinks" role="group" aria-label="Thinking time">${THINK_CHOICES.map((s) => `<button type="button" class="fpk-thinkbtn" data-fpk-think="${s}"><i class="fas fa-hourglass-half"></i>${s}s</button>`).join('')}</span>` : ''}
        </div>
        <div class="fpk-progress" aria-label="${st.had.length} of ${total} have had a turn this round">
            <span class="fpk-progress__label">Round ${st.round} · <b>${st.had.length}</b> of ${total} have had a turn${ui.pool != null ? ` in the ${esc(teamBanner(ui.pool).short)}` : ''}</span>
            <span class="fpk-progress__bar"><i style="transform:scaleX(${doneShare.toFixed(3)})"></i></span>
        </div>
    </section>`;
}

function listsHtml(st) {
    const chip = (id, extra = '') => {
        const h = heroById(id);
        return h ? `<li class="fpk-chip${extra}">${faceHtml(h, 'ct-face ct-face--sm')}<span>${esc(h.first)}</span></li>` : '';
    };
    return `<section class="fpk-lists">
        <div class="fpk-list fpk-list--waiting">
            <h3><i class="fas fa-hourglass-start"></i> Still waiting <small>${st.waiting.length}</small></h3>
            <ul>${st.waiting.map((id) => chip(id)).join('') || '<li class="fpk-list__empty">Nobody. The next pick starts a fresh round.</li>'}</ul>
        </div>
        <div class="fpk-list fpk-list--had">
            <h3><i class="fas fa-circle-check"></i> Had a turn <small>${st.had.length}</small></h3>
            <ul>${st.had.map((id) => chip(id, id === ui.current ? ' is-now' : '')).join('') || '<li class="fpk-list__empty">Nobody yet this round.</li>'}</ul>
        </div>
        ${st.away.length ? `<div class="fpk-list fpk-list--away">
            <h3><i class="fas fa-moon"></i> Away today, still owed a turn <small>${st.away.length}</small></h3>
            <ul>${st.away.map((id) => chip(id)).join('')}</ul>
        </div>` : ''}
        <button type="button" class="fpk-fresh" data-fpk-fresh><i class="fas fa-arrows-rotate"></i> Start a fresh round</button>
    </section>`;
}

function render() {
    const shell = document.querySelector(`#${MODAL_ID} .fpk-shell`);
    if (!shell) return;
    const st = status();
    const big = shell.classList.contains('is-big');
    shell.innerHTML = `${headerHtml()}<div class="fpk-body">${poolHtml()}${spotlightHtml(st)}${listsHtml(st)}</div>`;
    const bigBtn = shell.querySelector('[data-fpk-big]');
    bigBtn?.setAttribute('aria-pressed', String(big));
    if (bigBtn) bigBtn.innerHTML = big ? '<i class="fas fa-compress"></i><span>Leave big screen</span>' : '<i class="fas fa-expand"></i><span>Big screen</span>';
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function pick() {
    if (!ui || ui.rolling) return;
    const result = pickTurn(ui.fair, { presentIds: presentIds(), poolIds: poolIds() });
    if (!result) return;
    clearTimers();
    ui.think = 0;
    ui.fair = result.next;
    ui.current = result.id;
    ui.call = result.freshRound ? 'A fresh round begins with' : CALLS[Math.floor(Math.random() * CALLS.length)];
    scheduleSave();
    const pool = (poolIds() || presentIds()).filter((id) => id !== result.id).map(heroById).filter(Boolean);
    if (ui.lite || pool.length < 2) {
        render();
        playSound('quiz_student_reveal');
        return;
    }
    ui.rolling = true;
    render();
    const nameEl = document.querySelector(`#${MODAL_ID} [data-fpk-name]`);
    const steps = [60, 65, 70, 80, 95, 115, 140, 170, 210];
    let elapsed = 0;
    let index = Math.floor(Math.random() * pool.length);
    steps.forEach((gap) => {
        elapsed += gap;
        later(() => {
            if (!nameEl?.isConnected) return;
            index = (index + 1 + Math.floor(Math.random() * Math.max(1, pool.length - 1))) % pool.length;
            nameEl.textContent = pool[index].first;
            nameEl.classList.remove('is-flick');
            void nameEl.offsetWidth;
            nameEl.classList.add('is-flick');
            playSound('click');
        }, elapsed);
    });
    later(() => {
        if (!ui) return;
        ui.rolling = false;
        render();
        document.querySelector(`#${MODAL_ID} .fpk-stage`)?.classList.add('is-landing');
        playSound('quiz_student_reveal');
    }, elapsed + 260);
}

function pass() {
    if (!ui?.current || ui.rolling) return;
    clearTimers();
    ui.fair = passTurn(ui.fair, ui.current);
    ui.current = null;
    ui.think = 0;
    scheduleSave();
    playSound('click');
    render();
}

function think(seconds) {
    clearTimers();
    ui.think = seconds;
    ui.thinkLeft = seconds;
    render();
    playSound('click');
    const tick = () => {
        if (!ui?.think) return;
        ui.thinkLeft -= 1;
        const left = document.querySelector(`#${MODAL_ID} [data-fpk-think-left]`);
        if (left) left.textContent = ui.thinkLeft > 0 ? `${ui.thinkLeft}s to think` : 'Time to answer!';
        if (ui.thinkLeft > 0) later(tick, 1000);
        else playSound('magic_chime');
    };
    later(tick, 1000);
}

async function toggleBig() {
    const shell = document.querySelector(`#${MODAL_ID} .fpk-shell`);
    const modal = document.getElementById(MODAL_ID);
    if (!shell || !modal) return;
    const on = !shell.classList.contains('is-big');
    shell.classList.toggle('is-big', on);
    modal.classList.toggle('fpk-modal--big', on);
    if (on) await enterFullscreen(modal); else await leaveFullscreen();
    render();
}

function close() {
    clearTimers();
    flushSave();
    const modal = document.getElementById(MODAL_ID);
    modal?.querySelector('.fpk-shell')?.classList.remove('is-big');
    modal?.classList.remove('fpk-modal--big');
    leaveFullscreen();
    session?.dispose();
    hideModal(MODAL_ID);
}

function ensureShell() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-2 sm:p-5 hidden';
    modal.innerHTML = '<div class="fpk-shell ct-shell pop-in" role="dialog" aria-modal="true" aria-labelledby="fpk-title"></div>';
    document.body.append(modal);
    return modal;
}

/** Open the Fair Picker on a class (default: the selected class, or the one in a lesson now). */
export async function openFairPicker(classId = null) {
    const id = selectedToolClassId() || classId;
    if (!id) {
        const { showToast } = await import('../effects.js');
        showToast('Select one of your classes first, then pick fairly in it.', 'info');
        return;
    }
    session?.dispose();
    const modal = ensureShell();
    loadClass(id);
    render();

    const onClick = (e) => {
        if (e.target === modal) return close();
        const t = e.target;
        if (t.closest('[data-fpk-close]')) return close();
        if (t.closest('[data-fpk-big]')) return toggleBig();
        if (t.closest('[data-fpk-pick]')) return pick();
        if (t.closest('[data-fpk-pass]')) return pass();
        const th = t.closest('[data-fpk-think]');
        if (th) return think(Number(th.dataset.fpkThink));
        const pool = t.closest('[data-fpk-pool]');
        if (pool) {
            const v = pool.dataset.fpkPool;
            ui.pool = v === 'null' ? null : Number(v);
            ui.current = null;
            ui.think = 0;
            clearTimers();
            playSound('click');
            render();
            return;
        }
        if (t.closest('[data-fpk-fresh]')) {
            ui.fair = freshRound(ui.fair);
            ui.current = null;
            ui.think = 0;
            clearTimers();
            scheduleSave();
            playSound('magic_chime');
            render();
        }
    };
    // The Fair Picker always works on the class selected in the header.
    const unfollow = followSelectedClass((next) => {
        if (modal.classList.contains('hidden')) return;
        if (!next) { close(); return; }
        if (next === ui?.classId) return;
        clearTimers();
        flushSave();
        loadClass(next);
        render();
    });
    const onKey = (e) => {
        if (modal.classList.contains('hidden')) return;
        if (e.key === 'Escape') {
            e.stopPropagation();
            if (document.fullscreenElement) { toggleBig(); return; }
            close();
            return;
        }
        // Space or Enter on the stage picks the next hero (handy with a presenter clicker).
        if ((e.key === ' ' || e.key === 'PageDown' || e.key === 'ArrowRight') && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target?.tagName || '')) {
            e.preventDefault();
            pick();
        }
    };
    const onFullscreen = () => {
        const shell = modal.querySelector('.fpk-shell');
        if (!document.fullscreenElement && shell?.classList.contains('is-big')) {
            shell.classList.remove('is-big');
            modal.classList.remove('fpk-modal--big');
            render();
        }
    };
    modal.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('fullscreenchange', onFullscreen);
    session = {
        dispose() {
            modal.removeEventListener('click', onClick);
            unfollow();
            document.removeEventListener('keydown', onKey, true);
            document.removeEventListener('fullscreenchange', onFullscreen);
            session = null;
        }
    };
    showAnimatedModal(MODAL_ID);
    playSound('click');
    requestAnimationFrame(() => modal.querySelector('[data-fpk-pick]')?.focus({ preventScroll: true }));
}
