// Award Stars on phones: one hero's cloud at a time on a swipeable stage, with a sticky dock
// above it that shows the class's progress (who shines, who waits, who is away), which hero is
// on stage, and ‹ › to step through. Tapping any hero on the dock's track jumps to them.
//
// The stage is the cloud list itself (#award-stars-student-list) turned into a horizontal
// scroll-snap track by mobile/styles/award.css, so swiping is native and costs nothing; this file
// only renders the dock and keeps it in step with the track.

import '../styles/award_stars.css';
import { escapeHtml as esc } from '../utils/html.mjs';

const STATUS_WORDS = { shining: 'Shining', waiting: 'Waiting', returning: 'Back today', away: 'Away today' };

let heroesOnStage = [];
let currentId = null;
let stageClassId = null;
let boundTrack = null;
let boundDock = null;
let scrollFrame = 0;

export function isAwardPhoneStage() {
    return typeof document !== 'undefined' && document.body.classList.contains('gcq-mobile');
}

function formatStars(value) {
    const n = Math.round((Number(value) || 0) * 10) / 10;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** The dock's markup. Heroes come in stage order (the order of the clouds). */
export function buildAwardPhoneDockHtml({ heroes = [], starsToday = 0, modifierHtml = '' } = {}) {
    const away = heroes.filter((h) => h.status === 'away').length;
    const shining = heroes.filter((h) => h.status === 'shining').length;
    const here = heroes.length - away;
    const allShining = here > 0 && shining === here;
    const pct = here ? Math.round((shining / here) * 100) : 0;
    const segs = heroes.map((h, i) => `<button type="button" class="aw-dock__seg is-${esc(h.status)}" data-dock-go="${esc(h.id)}" style="--i:${i}"`
        + ` aria-label="${esc(h.name)}, ${esc(STATUS_WORDS[h.status] || '')}"><span aria-hidden="true"></span></button>`).join('');
    const count = here
        ? `<span class="aw-dock__count"><b>${shining}</b> of ${here} shining</span>`
        : '<span class="aw-dock__count">Everyone is away today</span>';
    return `<div class="aw-dock${allShining ? ' is-complete' : ''}" style="--aw-dock-pct:${pct}%">`
        + '<div class="aw-dock__head">'
        + `<span class="aw-dock__sigil" aria-hidden="true"><i class="fas ${allShining ? 'fa-sun' : 'fa-star'}"></i></span>`
        + count
        + `<span class="aw-dock__today"><b>${esc(formatStars(starsToday))}</b><i class="fas fa-star" aria-hidden="true"></i> today</span>`
        + modifierHtml
        + (away ? `<span class="aw-dock__away"><i class="fas fa-cloud-rain" aria-hidden="true"></i>${away}</span>` : '')
        + '</div>'
        + '<div class="aw-dock__bar">'
        + '<button type="button" class="aw-dock__arrow" data-dock-step="-1" aria-label="Previous hero"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>'
        + '<div class="aw-dock__middle">'
        + `<div class="aw-dock__track" role="group" aria-label="Heroes">${segs}</div>`
        + '<div class="aw-dock__who" aria-live="polite"><span class="aw-dock__name"></span><span class="aw-dock__state"></span><span class="aw-dock__pos"></span></div>'
        + '</div>'
        + '<button type="button" class="aw-dock__arrow" data-dock-step="1" aria-label="Next hero"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>'
        + '</div></div>';
}

function trackEl() {
    return document.getElementById('award-stars-student-list');
}

function mounts(track) {
    return [...track.querySelectorAll(':scope > .award-card-mount')];
}

function mountIndexOf(track, id) {
    return mounts(track).findIndex((m) => m.querySelector('.student-cloud-card')?.dataset.studentid === id);
}

function reduceMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

let glide = null;

/**
 * Glides the stage to `left`. Our own short tween with snapping switched off while it runs:
 * a smooth scrollTo inside a snapping track lets the browser snap mid-way (the stage flicked
 * to the neighbour and back before settling), and the dock read every hero it passed.
 */
function glideTo(track, left, smooth) {
    if (glide) cancelAnimationFrame(glide.frame);
    if (!smooth) {
        glide = null;
        track.scrollLeft = left;
        return;
    }
    const from = track.scrollLeft;
    const distance = left - from;
    if (Math.abs(distance) < 1) return;
    const duration = Math.min(560, 320 + Math.abs(distance) * 0.06);
    const start = performance.now();
    track.classList.add('is-gliding');
    const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        track.scrollLeft = from + distance * eased;
        if (t < 1) {
            glide.frame = requestAnimationFrame(step);
        } else {
            track.scrollLeft = left;
            track.classList.remove('is-gliding');
            glide = null;
        }
    };
    glide = { frame: requestAnimationFrame(step) };
}

/** Shows the hero at `index` on the stage. */
function goTo(index, { smooth = true } = {}) {
    const track = trackEl();
    if (!track) return;
    const list = mounts(track);
    if (!list.length) return;
    const i = Math.max(0, Math.min(list.length - 1, index));
    setCurrent(list[i].querySelector('.student-cloud-card')?.dataset.studentid || null);
    glideTo(track, list[i].offsetLeft, smooth && !reduceMotion());
}

/** Marks the hero on stage on the dock. */
function setCurrent(id) {
    currentId = id;
    const dock = document.getElementById('award-phone-dock');
    if (!dock) return;
    dock.querySelectorAll('.aw-dock__seg.is-current').forEach((s) => s.classList.remove('is-current'));
    const seg = id ? dock.querySelector(`.aw-dock__seg[data-dock-go="${CSS.escape(id)}"]`) : null;
    seg?.classList.add('is-current');
    const track = trackEl();
    const total = track ? mounts(track).length : heroesOnStage.length;
    const index = track && id ? mountIndexOf(track, id) : -1;
    const hero = heroesOnStage.find((h) => h.id === id);
    const name = dock.querySelector('.aw-dock__name');
    const stateEl = dock.querySelector('.aw-dock__state');
    const pos = dock.querySelector('.aw-dock__pos');
    if (name) name.textContent = hero?.name || '';
    if (stateEl) {
        stateEl.className = `aw-dock__state${hero ? ` is-${hero.status}` : ''}`;
        stateEl.textContent = hero ? (hero.status === 'shining' ? `+${formatStars(hero.stars)} ★` : STATUS_WORDS[hero.status] || '') : '';
    }
    if (pos) pos.textContent = index >= 0 ? `${index + 1} / ${total}` : '';
    const prev = dock.querySelector('[data-dock-step="-1"]');
    const next = dock.querySelector('[data-dock-step="1"]');
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index < 0 || index >= total - 1;
}

/** Which cloud fills the stage, read from the scroll position. */
function readCurrentFromScroll() {
    scrollFrame = 0;
    if (glide) return; // a ‹ › glide already shows where it is going
    const track = trackEl();
    if (!track) return;
    const list = mounts(track);
    if (!list.length) return;
    const width = track.clientWidth || 1;
    const i = Math.max(0, Math.min(list.length - 1, Math.round(track.scrollLeft / width)));
    const id = list[i].querySelector('.student-cloud-card')?.dataset.studentid || null;
    if (id !== currentId) setCurrent(id);
}

/**
 * The stage never scrolls up and down: a cloud taller than the room it has (an open absent
 * desk on a short phone) is scaled down to fit instead.
 */
let fitFrame = 0;
export function fitAwardPhoneStage() {
    if (fitFrame || !isAwardPhoneStage()) return;
    fitFrame = requestAnimationFrame(() => {
        fitFrame = 0;
        const track = trackEl();
        if (!track) return;
        mounts(track).forEach((mount) => {
            const card = mount.querySelector('.aw-card');
            if (!card) return;
            const room = mount.clientHeight - 8;
            // The cloud reaches about 3rem past the card (top puffs, shelf); count that in.
            const need = card.offsetHeight + 48;
            const scale = room > 0 ? Math.max(0.5, Math.min(1, room / need)) : 1;
            card.style.setProperty('--aw-fit', scale.toFixed(3));
        });
    });
}

let fitObserver = null;
function bindTrack(track) {
    if (boundTrack === track) return;
    boundTrack = track;
    if (typeof ResizeObserver !== 'undefined') {
        fitObserver?.disconnect();
        fitObserver = new ResizeObserver(() => fitAwardPhoneStage());
        fitObserver.observe(track);
    }
    // Cards grow when a virtue opens its stars or a desk opens: refit after any tap.
    track.addEventListener('click', () => setTimeout(fitAwardPhoneStage, 450));
    track.addEventListener('scroll', () => {
        if (!scrollFrame) scrollFrame = requestAnimationFrame(readCurrentFromScroll);
    }, { passive: true });
}

function bindDock(dock) {
    if (boundDock === dock) return;
    boundDock = dock;
    dock.addEventListener('click', (event) => {
        const step = event.target.closest('[data-dock-step]');
        const track = trackEl();
        if (step && track) {
            const at = currentId ? mountIndexOf(track, currentId) : 0;
            goTo(Math.max(0, at) + Number(step.dataset.dockStep));
            return;
        }
        const seg = event.target.closest('[data-dock-go]');
        if (seg && track) {
            const at = mountIndexOf(track, seg.dataset.dockGo);
            if (at >= 0) goTo(at);
        }
    });
}

/**
 * Draws the dock and keeps the stage on the same hero across redraws.
 * `heroes` are in stage order: { id, name, stars, status }.
 */
function modifierChip(modifier) {
    if (modifier?.type === 'double') return '<span class="aw-dock__mod"><i class="fas fa-bolt" aria-hidden="true"></i>2×</span>';
    if (modifier?.type === 'reason' && modifier.reason) {
        const name = String(modifier.reason).charAt(0).toUpperCase() + String(modifier.reason).slice(1);
        return `<span class="aw-dock__mod"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>${esc(name)} +1</span>`;
    }
    return '';
}

export function renderAwardPhoneStage({ classId, heroes, starsToday, modifier = null }) {
    const modifierHtml = modifierChip(modifier);
    const dock = document.getElementById('award-phone-dock');
    if (!dock) return;
    if (!isAwardPhoneStage() || !classId || !heroes?.length) {
        dock.classList.add('hidden');
        dock.innerHTML = '';
        heroesOnStage = [];
        return;
    }
    if (stageClassId !== classId) currentId = null;
    stageClassId = classId;
    heroesOnStage = heroes;
    const html = buildAwardPhoneDockHtml({ heroes, starsToday, modifierHtml });
    if (dock.dataset.html !== html) {
        dock.innerHTML = html;
        dock.dataset.html = html;
    }
    dock.classList.remove('hidden');
    bindDock(dock);
    syncAwardPhoneStage();
}

/** After the clouds are (re)drawn: keep the hero on stage, or start at the first. */
export function syncAwardPhoneStage({ reset = false } = {}) {
    if (!isAwardPhoneStage()) return;
    const track = trackEl();
    if (!track) return;
    bindTrack(track);
    if (reset) currentId = null;
    const list = mounts(track);
    if (!list.length) return;
    let index = currentId ? mountIndexOf(track, currentId) : -1;
    if (index < 0) index = 0;
    const want = list[index].offsetLeft;
    if (!glide && Math.abs(track.scrollLeft - want) > 2) track.scrollLeft = want;
    fitAwardPhoneStage();
    setCurrent(list[index].querySelector('.student-cloud-card')?.dataset.studentid || null);
}
