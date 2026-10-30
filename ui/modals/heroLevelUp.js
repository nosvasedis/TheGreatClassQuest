// ui/modals/heroLevelUp.js
// The hero level-up moment, made for the projector: the hero's medallion rises on a night sky
// tinted with their class colour, their rank ladder climbs, and the new rung lights with a burst
// (sparks, a shock ring, "LEVEL UP!" landing letter by letter). The new title unfurls on a
// ribbon, then the two skill paths of the new level and the buttons.
// Several level-ups at once (a batch of Scholar's bonuses) queue up and play one after another.
// Weaker laptops (detectLowPowerTier) get fewer sparks, no star rain and a still sky; reduced
// motion shows the last frame. Everything moves by transform and opacity; glows are gradients.
// Markup: ui/modals/heroLevelUpView.mjs. Styles: styles/hero_level_up.css (lazy, with this module).
// Sound: audio.js playLevelUpSfx (synthesised, no file to download).
import '../../styles/hero_level_up.css';
import * as state from '../../state.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { HERO_SKILL_TREE } from '../../features/heroSkillTree.js';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import { buildHeroLevelUpModel, buildHeroLevelUpHtml, ladderDelays, waitingText, HLU_TIMELINE } from './heroLevelUpView.mjs';

const MODAL_ID = 'hero-level-up-modal';
const queue = [];
let current = null;
let pending = false;

function sfx(name, opts) {
    import('../../audio.js').then(({ playLevelUpSfx }) => playLevelUpSfx?.(name, opts)).catch(() => {});
}

function tier() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'still';
    try { return detectLowPowerTier() ? 'lite' : 'full'; } catch { return 'full'; }
}

function getModal() {
    let modal = document.getElementById(MODAL_ID);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = MODAL_ID;
        document.body.appendChild(modal);
    }
    modal.className = 'hlu hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'hlu-title');
    return modal;
}

/** Shows the level-up moment, or queues it behind the one on screen. */
export function showHeroLevelUpCelebration(info) {
    if (!info?.studentId) return;
    queue.push(info);
    if (current) {
        noteWaiting();
        return;
    }
    // Level-ups that arrive together (a batch of bonuses) queue up before the first one shows.
    if (!pending) {
        pending = true;
        queueMicrotask(() => {
            pending = false;
            if (!current) showNext();
        });
    }
}

/** A hero levelled up while another one is on screen: say so, and "Later" becomes "Next hero". */
function noteWaiting() {
    const stage = current?.modal.querySelector('.hlu-stage');
    if (!stage) return;
    const later = stage.querySelector('[data-hlu="later"]');
    if (later) later.textContent = 'Next hero';
    let line = stage.querySelector('.hlu-queue');
    if (!line) {
        line = document.createElement('p');
        line.className = 'hlu-queue';
        stage.appendChild(line);
    }
    line.textContent = waitingText(queue.length);
}

function showNext() {
    const info = queue.shift();
    if (!info) return;
    const modal = getModal();
    const student = state.get('allStudents')?.find((s) => s.id === info.studentId);
    const model = buildHeroLevelUpModel({
        ...info,
        avatar: student?.avatar,
        classIcon: HERO_CLASSES[info.heroClass]?.icon,
        tree: HERO_SKILL_TREE[info.heroClass],
        waiting: queue.length
    });
    const mode = info.previewTier || tier();
    modal.innerHTML = buildHeroLevelUpHtml(model);
    modal.dataset.studentId = info.studentId;
    modal.style.setProperty('--hlu-aura', model.aura);
    modal.style.setProperty('--hlu-aura-rgb', model.auraRgb);
    modal.style.setProperty('--hlu-burst', `${HLU_TIMELINE.burst}ms`);
    modal.classList.toggle('hlu--lite', mode === 'lite');
    modal.classList.toggle('hlu--max', model.isMax);
    modal.classList.remove('hidden', 'is-leaving');

    current = { modal, model, mode, timers: [], burstDone: false, closing: false };
    modal.onclick = onClick;
    document.addEventListener('keydown', onKey, true);

    if (mode === 'still') {
        modal.classList.add('is-settled');
        current.burstDone = true;
        sfx('burst', { max: model.isMax });
    } else {
        void modal.offsetWidth;
        modal.classList.add('is-playing');
        play(current);
    }
    requestAnimationFrame(() => modal.querySelector('[data-hlu="skills"]')?.focus({ preventScroll: true }));
}

function at(run, ms, fn) {
    run.timers.push(setTimeout(() => { if (current === run) fn(); }, ms));
}

function play(run) {
    const t = HLU_TIMELINE;
    at(run, t.medal, () => sfx('rise'));
    ladderDelays(run.model.level).slice(0, -1).forEach((ms, i) => at(run, ms, () => sfx('step', { step: i })));
    at(run, t.burst, () => burst(run));
    at(run, t.ribbon, () => sfx('ribbon', { max: run.model.isMax }));
    at(run, t.done, () => settle(run));
}

function burst(run) {
    if (run.burstDone) return;
    run.burstDone = true;
    sfx('burst', { max: run.model.isMax });
    if (run.mode === 'still') return;
    const fx = run.modal.querySelector('.hlu-fx');
    const medal = run.modal.querySelector('.hlu-medal');
    if (!fx || !medal || typeof fx.animate !== 'function') return;
    const box = fx.getBoundingClientRect();
    const r = medal.getBoundingClientRect();
    const cx = r.left + r.width / 2 - box.left;
    const cy = r.top + r.height / 2 - box.top;
    const lite = run.mode === 'lite';
    const colors = ['#fef3c7', '#fde047', '#fbbf24', '#ffffff', run.model.aura];
    const sparks = lite ? 10 : 22;
    for (let i = 0; i < sparks; i += 1) {
        const angle = (i / sparks) * Math.PI * 2 + Math.random() * 0.3;
        const dist = r.width * (0.75 + Math.random() * 0.75);
        const el = piece(fx, i % 3 === 0 ? 'hlu-spark hlu-spark--star' : 'hlu-spark', cx, cy, colors[i % colors.length]);
        flyAndFade(el, [
            { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 1 },
            { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(1)`, opacity: 1, offset: 0.55 },
            { transform: `translate(calc(-50% + ${Math.cos(angle) * dist * 1.18}px), calc(-50% + ${Math.sin(angle) * dist * 1.18 + 26}px)) scale(0.2)`, opacity: 0 }
        ], 900 + Math.random() * 400);
    }
    if (lite) return;
    // A gentle rain of little stars over the whole stage.
    for (let i = 0; i < 16; i += 1) {
        const x = box.width * (0.08 + Math.random() * 0.84);
        const el = piece(fx, 'hlu-spark hlu-spark--star hlu-spark--rain', x, -20, colors[i % 4]);
        const drift = (Math.random() - 0.5) * 120;
        flyAndFade(el, [
            { transform: 'translate(-50%, 0) rotate(0deg)', opacity: 0 },
            { transform: `translate(calc(-50% + ${drift * 0.3}px), ${box.height * 0.15}px) rotate(90deg)`, opacity: 1, offset: 0.15 },
            { transform: `translate(calc(-50% + ${drift}px), ${box.height * 0.85}px) rotate(320deg)`, opacity: 0 }
        ], 2200 + Math.random() * 1400, 120 + Math.random() * 900);
    }
}

function piece(layer, className, x, y, color) {
    const el = document.createElement('span');
    el.className = className;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--c', color);
    layer.appendChild(el);
    return el;
}

function flyAndFade(el, keyframes, duration, delay = 0) {
    const anim = el.animate(keyframes, { duration, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
    anim.onfinish = () => el.remove();
    anim.oncancel = () => el.remove();
}

/** Jumps to the last frame (a tap during the sequence). */
function settle(run) {
    if (current !== run || run.modal.classList.contains('is-settled')) return;
    if (!run.burstDone) {
        run.burstDone = true;
        sfx('burst', { max: run.model.isMax });
    }
    run.timers.forEach(clearTimeout);
    run.timers = [];
    run.modal.classList.remove('is-playing');
    run.modal.classList.add('is-settled');
}

function close({ openSkills = false } = {}) {
    const run = current;
    if (!run || run.closing) return;
    run.closing = true;
    run.timers.forEach(clearTimeout);
    document.removeEventListener('keydown', onKey, true);
    const { modal } = run;
    const studentId = modal.dataset.studentId;
    modal.classList.add('is-leaving');
    const finish = () => {
        modal.classList.add('hidden');
        modal.classList.remove('is-playing', 'is-settled', 'is-leaving');
        modal.querySelector('.hlu-fx')?.replaceChildren();
        current = null;
        if (openSkills && studentId) {
            import('./skillTree.js').then((m) => {
                m.openSkillTreeModal(studentId);
                if (queue.length) waitForSkillTree();
            });
        } else if (queue.length) {
            showNext();
        }
    };
    setTimeout(finish, run.mode === 'still' ? 0 : 260);
}

/** After "Choose a skill", the next queued hero waits until the Skill Tree is closed. */
function waitForSkillTree() {
    const tree = document.getElementById('skill-tree-modal');
    if (!tree || tree.classList.contains('hidden')) { showNext(); return; }
    const watch = new MutationObserver(() => {
        if (!tree.classList.contains('hidden')) return;
        watch.disconnect();
        setTimeout(showNext, 200);
    });
    watch.observe(tree, { attributes: true, attributeFilter: ['class'] });
}

function onClick(e) {
    const run = current;
    if (!run) return;
    const action = e.target.closest?.('[data-hlu]')?.dataset.hlu;
    if (action === 'skills') { close({ openSkills: true }); return; }
    if (action === 'later') { close(); return; }
    const playing = run.modal.classList.contains('is-playing');
    if (playing) { settle(run); return; }
    // A tap on the empty sky closes it, as before.
    if (e.target.hasAttribute?.('data-hlu-backdrop')) close();
}

function onKey(e) {
    if (!current) return;
    if (e.key === 'Escape') {
        e.stopPropagation();
        close();
    } else if ((e.key === 'Enter' || e.key === ' ') && current.modal.classList.contains('is-playing')) {
        e.preventDefault();
        settle(current);
    }
}
