// features/familiarParade.js — the Familiar Parade: after the Ceremony of the Month every hatched
// familiar in the class walks across the projector once, with its name and its hero's name.
// Walkers move with one composited transform each; low-power machines drop the inner bounce and
// reduced motion shows the companions standing in a row instead.

import * as state from '../state.js';
import { canUseFeature } from '../utils/subscription.js';
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';
import { FAMILIAR_TYPES, familiarArtSvg, playFamiliarCall } from './familiars.js';

let active = null;

const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The hatched familiars of a class, in roster order. */
export function paradeMembers(classId) {
    const scores = state.get('allStudentScores') || [];
    return (state.get('allStudents') || [])
        .filter((student) => student.classId === classId)
        .map((student) => ({ student, familiar: scores.find((score) => score.id === student.id)?.familiar }))
        .filter(({ familiar }) => familiar?.state === 'alive' && FAMILIAR_TYPES[familiar.typeId]);
}

/**
 * Start the parade. Returns false when there is nobody to parade.
 * @param {string} classId
 * @param {{ host?: HTMLElement, muted?: boolean }} [opts]
 */
export function startFamiliarParade(classId, { host = document.body, muted = false } = {}) {
    stopFamiliarParade();
    if (!canUseFeature('familiars')) return false;
    const members = paradeMembers(classId);
    if (!members.length) return false;

    let lite = false;
    try { lite = detectLowPowerTier(); } catch { lite = false; }
    const reduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const walk = lite ? 15 : 12;
    const gap = Math.max(0.8, Math.min(1.7, 32 / members.length));
    const shown = reduced ? members.slice(0, 12) : members;

    const layer = document.createElement('div');
    layer.className = `fam-parade${lite ? ' fam-parade--lite' : ''}`;
    layer.setAttribute('role', 'status');
    layer.innerHTML = `
        <div class="fam-parade__banner">🐾 The Familiar Parade 🐾</div>
        ${shown.map(({ student, familiar }, i) => {
            const typeDef = FAMILIAR_TYPES[familiar.typeId];
            const firstName = String(student.name || '').split(' ')[0];
            const label = familiar.name ? `${familiar.name} · ${firstName}` : `${firstName}'s ${typeDef.name}`;
            return `<div class="fam-parade__walker" style="--delay:${(1.2 + i * gap).toFixed(2)}s;--walk:${walk}s">
                ${familiarArtSvg(familiar, student.id, { mode: 'full' })}
                <span class="fam-parade__name">${esc(label)}</span>
            </div>`;
        }).join('')}
        <button type="button" class="fam-parade__skip">Skip parade</button>`;
    host.appendChild(layer);

    const timers = [];
    if (!muted && !reduced) {
        shown.slice(0, 16).forEach(({ student, familiar }, i) => {
            timers.push(setTimeout(() => playFamiliarCall(familiar, student.id), (1.2 + i * gap + walk * 0.35) * 1000));
        });
    }
    const total = reduced ? 9 : 1.2 + (shown.length - 1) * gap + walk + 0.5;
    timers.push(setTimeout(() => stopFamiliarParade(), total * 1000));
    layer.querySelector('.fam-parade__skip').addEventListener('click', () => stopFamiliarParade());
    active = { layer, timers };
    return true;
}

export function stopFamiliarParade() {
    if (!active) return;
    const { layer, timers } = active;
    active = null;
    timers.forEach(clearTimeout);
    layer.classList.add('is-leaving');
    setTimeout(() => layer.remove(), 650);
}
