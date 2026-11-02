// features/familiarDen.js — the Familiar's Habitat (the Den), loaded the first time a Den opens.
//
// A wide, living place instead of a tall card: the familiar's home realm fills the left side
// (features/familiarHabitat.mjs paints it for the species, the form, the time of day, the season
// and today's weather) and the familiar wanders about in it. Tap the ground and it walks there;
// tap the snack, its toy or its home and it goes to play, eat or nap. The journal on the right
// keeps everything the old Den showed: growth to the next form (or Starbond marks), the
// Evolution Path, its trick, stars together, its kind and its true name.
//
// Phones get the place on top and the journal below; projectors get the same layout, larger.
// Everything that moves is a transform or opacity; weak machines get fewer particles and no
// drifting clouds.

import '../styles/familiar_habitat.css';
import { quietly } from '../utils/runtimeMetrics.js';
import * as state from '../state.js';
import { ensureAudioReady } from '../audio.js';
import { FAMILIAR_MAX_LEVEL, FAMILIAR_STAGE_BOND } from './familiarProgression.mjs';
import {
    FAMILIAR_TRICKS,
    FAMILIAR_TRICK_LEVEL,
    familiarTricksPerMonth,
    familiarTricksUsed,
    isFamiliarTrickReady
} from './familiarForge.mjs';
import {
    FAMILIAR_TYPES,
    FAMILIAR_DEN_THEMES,
    describeFamiliarForTip,
    familiarArtSvg,
    familiarLiteMode,
    familiarPrefersReducedMotion,
    familiarStageName,
    getFamiliarGenome,
    playFamiliarCall,
    playFamiliarSoundEffect,
    saveFamiliarName,
    spawnFamiliarBurst
} from './familiars.js';
import {
    GROUND_Y,
    HABITAT_H,
    HABITAT_SEASONS,
    HABITAT_TIMES,
    HABITAT_W,
    TOY_SPOT,
    TREAT_SPOT,
    buildHabitat,
    habitatPlaces,
    habitatSpots,
    habitatWeathers,
    hashString
} from './familiarHabitat.mjs';

const SAYINGS = {
    hello: ['Hi, {hero}!', 'Hello, {hero}!', 'You came back!', 'Yay, {hero}!'],
    pet: ['Hehe!', 'Again!', 'That tickles!', 'Wheee!', 'I like you!', '♥'],
    treat: ['Yum!', 'So tasty!', 'Munch munch!', 'Thank you!'],
    toy: ['Wheee!', 'Catch!', 'Boing!', 'Fun!'],
    home: ['Zzz...', 'Nap time...', 'Cosy...'],
    egg: ['*tap tap*', '*wobble*', '*crack?*', '...']
};

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function scoreFor(studentId) {
    return (state.get('allStudentScores') || []).find((s) => s.id === studentId) || null;
}

/** Preview pages can pin the time, season and weather (window.__habitatOverride). */
function previewOverride() {
    try { return window.__habitatOverride || {}; } catch { return {}; }
}

function particlesHtml(list) {
    return list.map((p) => `<i class="hbp hbp--${p.kind}" style="left:${p.left}%;top:${p.top}%;--d:${p.dur}s;--dl:${p.delay}s;--s:${p.size};--dx:${p.drift}px"></i>`).join('');
}

/** The still scene plus its drifting cloud and mist layers (each its own composited layer). */
function sceneHtml(h) {
    return `${h.svg}${h.airSvg ? `<div class="fam-hab__air">${h.airSvg}</div>` : ''}${h.mistSvg ? `<div class="fam-hab__mist">${h.mistSvg}</div>` : ''}`;
}

function evolutionTrackHtml(familiar, studentId, typeDef, level, isEgg, progressPercent) {
    const stages = [{ name: 'Egg' }, ...typeDef.levelNames.map((name) => ({ name }))];
    return stages.map((stage, i) => {
        const status = i < level ? 'done' : i === level ? 'current' : i === level + 1 ? 'next' : 'locked';
        let art;
        if (status === 'locked') art = '<span class="fam-evo-mystery" aria-hidden="true">?</span>';
        else if (i === 0) art = `<span class="fam-evo-art">${familiarArtSvg(familiar, studentId, { egg: true, progress: isEgg ? progressPercent : 100, mode: 'chip' })}</span>`;
        else art = `<span class="fam-evo-art${status === 'next' ? ' fam-evo-art--shadow' : ''}">${familiarArtSvg(familiar, studentId, { egg: false, level: i, mode: 'chip', starbond: 0 })}</span>`;
        const label = status === 'locked' ? '???' : stage.name;
        return `
            <li class="fam-evo-node fam-evo-node--${status}" style="--evo-i:${i};">
                <span class="fam-evo-gem">${art}</span>
                <span class="fam-evo-name">${esc(label)}</span>
                ${i > 0 ? `<span class="fam-evo-need">${FAMILIAR_STAGE_BOND[i]}★</span>` : ''}
            </li>`;
    }).join('');
}

/** Open (or toggle) the habitat for a student's familiar. */
export function renderFamiliarDen(studentId) {
    const scoreData = scoreFor(studentId);
    const student = (state.get('allStudents') || []).find((s) => s.id === studentId);
    if (!scoreData?.familiar || !student) return;
    const familiar = scoreData.familiar;
    const typeDef = FAMILIAR_TYPES[familiar.typeId];
    if (!typeDef) return;

    const existing = document.querySelector('.familiar-stats-overlay');
    if (existing) {
        if (existing.dataset.studentId === studentId) {
            existing.querySelector('.fam-overlay-tap')?.click();
            return;
        }
        existing.remove();
    }

    const lite = familiarLiteMode();
    const still = familiarPrefersReducedMotion();
    const info = describeFamiliarForTip(studentId);
    const isEgg = familiar.state === 'egg';
    const level = isEgg ? 0 : info.level;
    const progress = info.progress;
    const progressPercent = info.percent;
    const isMaxLevel = progress.phase === 'max';
    const genome = getFamiliarGenome(familiar, studentId);
    const displayName = info.name;
    const heroFirst = info.firstName || 'friend';
    const kindLabel = genome?.preset?.label || typeDef.name;
    const speciesLabel = familiar.name ? `${typeDef.name} · ${kindLabel}` : kindLabel;
    const theme = FAMILIAR_DEN_THEMES[familiar.typeId] || { sigil: '✨', element: 'Arcane', burst: ['#fde68a'] };
    const trick = FAMILIAR_TRICKS[familiar.typeId];
    const trickReady = isFamiliarTrickReady(familiar);
    const tricksAllowed = familiarTricksPerMonth(familiar);
    const tricksLeft = Math.max(0, tricksAllowed - familiarTricksUsed(familiar));
    const seed = `${studentId}|${familiar.look?.seed || ''}`;
    const uid = `hb${hashString(seed).toString(36)}`;
    const forced = previewOverride();
    const view = { time: forced.time || null, season: forced.season || null, weather: forced.weather || null };
    let habitat = buildHabitat({ typeId: familiar.typeId, stage: level, seed, lite, uid: `${uid}a`, ...view });
    const places = habitatPlaces(familiar.typeId);

    const spriteHtml = `<div class="familiar-container">${familiarArtSvg(familiar, studentId, { mode: 'full' })}</div>`;
    const progressSpan = Math.max(1, progress.max - progress.min);
    const progressDone = Math.max(0, Math.min(progressSpan, progress.current - progress.min));
    const progressVerb = progress.phase === 'egg' ? 'Hatches into' : 'Evolves into';
    const nextStageName = isEgg ? familiarStageName(familiar.typeId, 1) : info.nextName;
    const traits = (genome?.traits || []).slice(1)
        .map((t) => `<span class="fam-den-trait${t === 'Shiny' ? ' fam-den-trait--shiny' : ''}">${esc(t)}</span>`).join('');
    const starbond = info.starbond;
    const starbondPips = Array.from({ length: Math.max(5, Math.min(10, starbond.marks + 1)) }, (_, i) =>
        `<span class="fam-starbond-pip${i < starbond.marks ? ' is-lit' : ''}" aria-hidden="true">★</span>`).join('');
    const trackFill = Math.round((level / FAMILIAR_MAX_LEVEL) * 100);

    const growthPanel = !isMaxLevel ? `
        <section class="fam-hab-card fam-hab-grow">
            <div class="fam-hab-grow__head">
                <div>
                    <div class="fam-hab-label">${progressVerb}</div>
                    <div class="fam-hab-next">${esc(nextStageName)}</div>
                </div>
                <div class="fam-hab-count"><strong>${progressDone}</strong> / ${progressSpan} ⭐</div>
            </div>
            <div class="fam-hab-bar"><div class="fam-modal-progress-bar" style="--fam-progress:${progressPercent}%;"></div></div>
            <div class="fam-hab-hint">${progress.remaining} more ${progress.remaining === 1 ? 'star' : 'stars'} to go · ${progressPercent}%</div>
            ${habitat.nextPlace ? `<div class="fam-hab-nexthome"><span aria-hidden="true">🏡</span> Then its home grows: <strong>${esc(habitat.nextPlace)}</strong></div>` : ''}
        </section>` : `
        <section class="fam-hab-card fam-hab-max">
            <span class="fam-hab-max__crown" aria-hidden="true">👑</span>
            <div class="fam-hab-max__body">
                <div class="fam-hab-max__title">Mythic Form · Starbond ${starbond.marks}</div>
                <div class="fam-starbond-row">${starbondPips}</div>
                <div class="fam-hab-bar fam-hab-bar--starbond"><div class="fam-modal-progress-bar" style="--fam-progress:${Math.round((starbond.intoNext / starbond.step) * 100)}%;"></div></div>
                <div class="fam-hab-hint">${starbond.step - starbond.intoNext} more stars together for the next Starbond mark</div>
            </div>
        </section>`;

    const trickPanel = trick ? (level >= FAMILIAR_TRICK_LEVEL ? `
        <section class="fam-hab-card fam-hab-trick">
            <span class="fam-hab-trick__icon" aria-hidden="true">🪄</span>
            <div>
                <div class="fam-hab-label">Trick</div>
                <div class="fam-hab-next">${esc(trick.name)}</div>
                <p class="fam-hab-hint">${tricksAllowed > 1 ? 'Twice' : 'Once'} a month in the Quiz of the Week, ${esc(displayName)} ${esc(trick.verb)}.</p>
                <div class="fam-hab-trick__state${trickReady ? ' is-ready' : ''}">${trickReady ? (tricksLeft > 1 ? `${tricksLeft} ready this month` : 'Ready this month') : 'Used this month. Back next month!'}</div>
            </div>
        </section>` : `
        <section class="fam-hab-card fam-hab-trick is-locked">
            <span class="fam-hab-trick__icon" aria-hidden="true">🔒</span>
            <div>
                <div class="fam-hab-label">Trick at ${esc(typeDef.levelNames[FAMILIAR_TRICK_LEVEL - 1])}</div>
                <div class="fam-hab-next">${esc(trick.name)}</div>
                <p class="fam-hab-hint">Once a month in the Quiz of the Week it ${esc(trick.verb)}. At ${esc(typeDef.levelNames[FAMILIAR_MAX_LEVEL - 1])}, twice a month.</p>
            </div>
        </section>`) : '<p class="fam-hab-hint">This familiar has no trick yet.</p>';

    const placesList = places.map((name, i) => {
        const status = i < level ? 'done' : i === level ? 'current' : i === level + 1 ? 'next' : 'locked';
        const label = status === 'locked' ? '???' : name;
        const note = i === 0 ? 'Egg' : typeDef.levelNames[i - 1];
        return `<li class="fam-hab-place fam-hab-place--${status}"><span class="fam-hab-place__dot" aria-hidden="true">${status === 'done' ? '✓' : status === 'current' ? '★' : ''}</span><span class="fam-hab-place__name">${esc(label)}</span><span class="fam-hab-place__note">${esc(status === 'locked' ? '' : note)}</span></li>`;
    }).join('');

    const overlay = document.createElement('div');
    overlay.dataset.studentId = studentId;
    overlay.className = 'familiar-stats-overlay fam-hab-overlay';
    overlay.innerHTML = `
        <div class="fam-overlay-backdrop"></div>
        <div class="fam-modal-card fam-hab${level >= FAMILIAR_MAX_LEVEL ? ' is-mythic' : ''}${isEgg ? ' is-egg' : ''}${lite ? ' fam-hab--lite' : ''}${still ? ' fam-hab--still' : ''}"
             data-fam-type="${esc(familiar.typeId)}" role="dialog" aria-modal="true" aria-label="${esc(`${displayName}'s home`)}"
             style="--fam-color:${typeDef.eggColor};--fam-accent:${typeDef.eggAccent || typeDef.eggColor};">
            <button type="button" class="fam-overlay-close fam-hab-close" aria-label="Close">&times;</button>
            <section class="fam-hab__world" data-time="${habitat.time}">
                <div class="fam-hab__scene">${sceneHtml(habitat)}</div>
                <div class="fam-hab__fx" aria-hidden="true">${still ? '' : particlesHtml(habitat.particles)}</div>
                <button type="button" class="fam-hab__ground" aria-label="${isEgg ? 'Tap near the egg' : `Call ${esc(displayName)} here`}"></button>
                <div class="fam-hab__spots"></div>
                <div class="fam-hab__walker">
                    <div class="fam-hab__bubble" aria-live="polite"></div>
                    <div class="fam-hab__body">
                        <button type="button" class="fam-overlay-tap fam-den-creature" aria-label="${esc(isEgg ? 'Listen to the egg' : `Pet ${displayName}`)}">
                            <span class="fc-tilt">${spriteHtml}</span>
                        </button>
                    </div>
                </div>
                <header class="fam-hab__top">
                    <div class="fam-hab__place">
                        <span class="fam-hab__home"><span aria-hidden="true">${theme.sigil}</span> ${esc(habitat.home)}</span>
                        <strong class="fam-hab__placename">${esc(habitat.place)}</strong>
                    </div>
                    <div class="fam-hab__chips" role="group" aria-label="The habitat right now">
                        <button type="button" class="fam-hab-chip" data-cycle="time" title="Change the time of day"><span aria-hidden="true">${habitat.timeIcon}</span><span>${habitat.timeLabel}</span></button>
                        <button type="button" class="fam-hab-chip" data-cycle="season" title="Change the season"><span aria-hidden="true">${habitat.seasonIcon}</span><span>${habitat.seasonLabel}</span></button>
                        <button type="button" class="fam-hab-chip" data-cycle="weather" title="Change the weather"><span aria-hidden="true">${habitat.weatherIcon}</span><span>${habitat.weatherLabel}</span></button>
                    </div>
                </header>
                <div class="fam-hab__hint" aria-hidden="true">${isEgg ? 'Tap the egg to listen' : `Tap ${esc(displayName)} to play<span class="fam-hab__hint-more"> · tap the ground to call it</span>`}</div>
            </section>

            <aside class="fam-hab__journal">
                <div class="fam-hab-id">
                    <div class="fam-hab-id__row">
                        <span class="fam-hab-element"><span aria-hidden="true">${theme.sigil}</span> ${esc(theme.element)}</span>
                        ${level ? `<span class="fam-hab-form">Form ${level} of ${FAMILIAR_MAX_LEVEL}</span>` : '<span class="fam-hab-form">Egg</span>'}
                    </div>
                    <div class="fam-modal-species">${esc(speciesLabel)}</div>
                    <div class="fam-hab-name">
                        <h3 class="fam-modal-name">${esc(displayName)}</h3>
                        ${familiar.state === 'alive' ? `<button type="button" class="fam-hab-rename" aria-label="Give a true name" title="Give a true name"><i class="fas fa-pen" aria-hidden="true"></i></button>` : ''}
                    </div>
                    ${familiar.state === 'alive' ? `
                    <div class="fam-den-name-row" hidden>
                        <input type="text" class="fam-name-input" maxlength="24" value="${esc(familiar.name || '')}" placeholder="Give this familiar a name" aria-label="True name">
                        <button type="button" class="fam-name-save" data-student-id="${esc(studentId)}">Save</button>
                    </div>` : ''}
                    <div class="fam-modal-badge">${isEgg ? '🥚' : level >= FAMILIAR_MAX_LEVEL ? '👑' : '✨'} ${esc(info.stageName)}</div>
                </div>

                <div class="fam-hab-tabs" role="tablist">
                    <button type="button" role="tab" class="fam-hab-tab is-on" data-tab="grow" aria-selected="true">Growth</button>
                    <button type="button" role="tab" class="fam-hab-tab" data-tab="trick" aria-selected="false">Trick${level >= FAMILIAR_TRICK_LEVEL && trickReady ? ' <span class="fam-hab-tab__dot" aria-hidden="true"></span>' : ''}</button>
                    <button type="button" role="tab" class="fam-hab-tab" data-tab="about" aria-selected="false">${isEgg ? 'About' : 'Home'}</button>
                </div>

                <div class="fam-hab-panes">
                    <div class="fam-hab-pane is-on" data-pane="grow" role="tabpanel">
                        ${growthPanel}
                        <section class="fam-hab-card" aria-label="Evolution path">
                            <div class="fam-hab-label">Evolution Path</div>
                            <ol class="fam-evo-track" style="--evo-fill:${trackFill}%;">${evolutionTrackHtml(familiar, studentId, typeDef, level, isEgg, progressPercent)}</ol>
                        </section>
                        <div class="fam-hab-stats">
                            <div class="fam-hab-stat"><span aria-hidden="true">⭐</span><div><strong>${info.bond}</strong><small>Stars together</small></div></div>
                            <div class="fam-hab-stat"><span aria-hidden="true">${theme.sigil}</span><div><strong class="is-sm">${esc(kindLabel)}</strong><small>${isEgg ? 'Hatching as' : 'Kind'}</small></div></div>
                        </div>
                    </div>
                    <div class="fam-hab-pane" data-pane="trick" role="tabpanel" hidden>${trickPanel}</div>
                    <div class="fam-hab-pane" data-pane="about" role="tabpanel" hidden>
                        <blockquote class="fam-modal-quote">${esc(typeDef.personality)}</blockquote>
                        ${traits ? `<div class="fam-den-traits">${traits}</div>` : ''}
                        <section class="fam-hab-card">
                            <div class="fam-hab-label">${esc(habitat.home)}</div>
                            <p class="fam-hab-hint">${esc(habitat.blurb)} Every new form makes its home grow.</p>
                            <ol class="fam-hab-places">${placesList}</ol>
                        </section>
                        ${isEgg ? '<p class="fam-hab-hint fam-hab-eggnote"><span aria-hidden="true">🥚</span> This egg can be named after it hatches.</p>' : ''}
                    </div>
                </div>
            </aside>
        </div>`;

    document.body.appendChild(overlay);

    const card = overlay.querySelector('.fam-hab');
    const world = overlay.querySelector('.fam-hab__world');
    const fxHost = overlay.querySelector('.fam-hab__fx');
    const walker = overlay.querySelector('.fam-hab__walker');
    const body = overlay.querySelector('.fam-hab__body');
    const bubble = overlay.querySelector('.fam-hab__bubble');
    const tapBtn = overlay.querySelector('.fam-overlay-tap');
    const spotsHost = overlay.querySelector('.fam-hab__spots');
    const groundBtn = overlay.querySelector('.fam-hab__ground');
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    let closed = false;

    // ─── Close ──────────────────────────────────────────────────────────────
    const onKey = (e) => { if (e.key === 'Escape') closeOverlay(); };
    let resizeObs = null;
    function closeOverlay() {
        if (closed) return;
        closed = true;
        timers.forEach(clearTimeout);
        timers.clear();
        document.removeEventListener('keydown', onKey);
        resizeObs?.disconnect();
        window.removeEventListener('resize', layout);
        const backdrop = overlay.querySelector('.fam-overlay-backdrop');
        card.classList.add('fam-modal-card--exit');
        backdrop?.classList.add('fam-overlay-backdrop--exit');
        card.addEventListener('animationend', (e) => { if (e.target === card) overlay.remove(); });
        setTimeout(() => overlay.remove(), 600);
    }
    overlay.querySelector('.fam-hab-close').addEventListener('click', closeOverlay);
    overlay.querySelector('.fam-overlay-backdrop').addEventListener('click', closeOverlay);
    document.addEventListener('keydown', onKey);

    // ─── Scene geometry: view-box units to pixels (xMidYMax slice) ─────────
    const geo = { s: 1, w: 1, h: 1 };
    const walkerState = { x: 800, size: 200 };
    function toPx(x) { return (x - HABITAT_W / 2) * geo.s + geo.w / 2; }
    function toUnits(px) { return (px - geo.w / 2) / geo.s + HABITAT_W / 2; }
    function visibleRange(margin = 120) {
        const half = geo.w / geo.s / 2;
        return [Math.max(80, HABITAT_W / 2 - half + margin), Math.min(HABITAT_W - 80, HABITAT_W / 2 + half - margin)];
    }
    function placeWalker(instant = false) {
        if (instant) walker.style.transition = 'none';
        walker.style.transform = `translate3d(${(toPx(walkerState.x) - walkerState.size / 2).toFixed(1)}px,0,0)`;
        if (instant) { void walker.offsetWidth; walker.style.transition = ''; }
    }
    function layout() {
        const r = world.getBoundingClientRect();
        if (!r.width || !r.height) return;
        geo.w = r.width;
        geo.h = r.height;
        geo.s = Math.max(r.width / HABITAT_W, r.height / HABITAT_H);
        const base = isEgg ? 150 : 170 + level * 14;
        // Phones see the place by its height, so the familiar is drawn a little larger there.
        const k = r.width < 620 ? 1.75 : 1.35;
        walkerState.size = Math.round(Math.max(110, Math.min(base * geo.s * k, r.height * 0.5)));
        world.classList.toggle('is-narrow', r.width < 620);
        world.style.setProperty('--hab-size', `${walkerState.size}px`);
        world.style.setProperty('--hab-ground', `${((HABITAT_H - GROUND_Y) * geo.s - walkerState.size * 0.06).toFixed(1)}px`);
        const [lo, hi] = visibleRange(walkerState.size / geo.s / 2);
        walkerState.x = Math.max(lo, Math.min(hi, walkerState.x));
        placeWalker(true);
        placeSpots();
    }

    // ─── Speech bubble and moods ────────────────────────────────────────────
    let bubbleTimer = null;
    function say(kind) {
        const text = pick(SAYINGS[kind] || SAYINGS.pet).replace('{hero}', heroFirst);
        bubble.textContent = text;
        bubble.classList.remove('is-on');
        void bubble.offsetWidth;
        bubble.classList.add('is-on');
        if (bubbleTimer) clearTimeout(bubbleTimer);
        bubbleTimer = later(() => bubble.classList.remove('is-on'), 2200);
    }
    function react(kind) {
        const box = tapBtn.querySelector('.familiar-container');
        if (!box) return;
        const cls = kind || ['fam-react-spin', 'fam-react-hop', 'fam-react-wiggle'][Math.floor(Math.random() * 3)];
        box.classList.remove('fam-react-spin', 'fam-react-hop', 'fam-react-wiggle', 'fam-live');
        void box.offsetWidth;
        box.classList.add(cls);
    }
    function hearts(icon = '♥') {
        if (still) return;
        const pop = document.createElement('div');
        pop.className = 'fam-hab__pop';
        pop.innerHTML = Array.from({ length: lite ? 3 : 5 }, (_, i) => `<i style="--n:${i};--x:${Math.round((Math.random() - 0.5) * 70)}px">${icon}</i>`).join('');
        walker.appendChild(pop);
        later(() => pop.remove(), 1500);
    }

    // ─── Walking ────────────────────────────────────────────────────────────
    let lastTouch = 0;
    let walkDone = null;
    function walkTo(x, then) {
        if (isEgg) return;
        const [lo, hi] = visibleRange(walkerState.size / geo.s / 2);
        const target = Math.max(lo, Math.min(hi, x));
        const distPx = Math.abs(toPx(target) - toPx(walkerState.x));
        if (distPx < 6) { then?.(); return; }
        const dur = still ? 0 : Math.max(0.5, Math.min(2.6, distPx / 230));
        walker.style.setProperty('--walk-dur', `${dur.toFixed(2)}s`);
        body.style.setProperty('--dir', target < walkerState.x ? '-1' : '1');
        walkerState.x = target;
        walker.classList.add('is-walking');
        placeWalker(false);
        if (walkDone) clearTimeout(walkDone);
        walkDone = later(() => {
            walker.classList.remove('is-walking');
            then?.();
        }, dur * 1000 + 40);
    }
    function wander() {
        if (closed || isEgg || still) return;
        later(() => {
            if (closed) return;
            if (Date.now() - lastTouch > 5000 && !walker.classList.contains('is-napping')) {
                const [lo, hi] = visibleRange(walkerState.size / geo.s / 2 + 40);
                const roll = Math.random();
                if (roll < 0.25) { react('fam-react-hop'); }
                else walkTo(lo + Math.random() * (hi - lo));
            }
            wander();
        }, 6000 + Math.random() * 5000);
    }

    // ─── Hotspots: snack, toy, home ─────────────────────────────────────────
    const spots = isEgg ? [] : habitatSpots(level);
    const spotAnchor = { treat: TREAT_SPOT, toy: TOY_SPOT, home: [1065, 712] };
    spotsHost.innerHTML = spots.map((sp) => `<button type="button" class="fam-hab-spot" data-spot="${sp.id}" aria-label="${esc(`${sp.label}: send ${displayName}`)}"><span aria-hidden="true">${sp.icon}</span><em>${esc(sp.label)}</em></button>`).join('');
    function placeSpots() {
        spotsHost.querySelectorAll('.fam-hab-spot').forEach((btn) => {
            const [x, y] = spotAnchor[btn.dataset.spot] || [800, 700];
            btn.style.transform = `translate3d(${toPx(x).toFixed(1)}px, ${(geo.h - (HABITAT_H - y + 70) * geo.s).toFixed(1)}px, 0)`;
            const [lo, hi] = visibleRange(0);
            btn.hidden = x < lo - 60 || x > hi + 60;
        });
    }
    spotsHost.addEventListener('click', (e) => {
        const btn = e.target.closest('.fam-hab-spot');
        if (!btn) return;
        e.stopPropagation();
        lastTouch = Date.now();
        const spot = spots.find((s) => s.id === btn.dataset.spot);
        if (!spot) return;
        walker.classList.remove('is-napping');
        walkTo(spot.x, () => {
            if (spot.id === 'treat') { react('fam-react-hop'); hearts('♥'); say('treat'); playFamiliarCall(familiar, studentId); }
            else if (spot.id === 'toy') { react('fam-react-spin'); hearts('✦'); say('toy'); spawnFamiliarBurst(walker, familiar.typeId, theme.burst); }
            else {
                walker.classList.add('is-napping');
                say('home');
                later(() => walker.classList.remove('is-napping'), 4200);
            }
        });
    });

    // Tap the ground: the familiar comes over.
    groundBtn.addEventListener('click', (e) => {
        lastTouch = Date.now();
        if (isEgg) { tapBtn.click(); return; }
        const r = world.getBoundingClientRect();
        walker.classList.remove('is-napping');
        walkTo(toUnits(e.clientX - r.left), () => { if (Math.random() < 0.5) say('pet'); });
    });

    // Tap the familiar: the old Den's play reaction, voice and burst.
    tapBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        lastTouch = Date.now();
        await ensureAudioReady().catch(() => false);
        if (isEgg) {
            react('fam-react-wiggle');
            say('egg');
            playFamiliarSoundEffect('hatch');
            return;
        }
        walker.classList.remove('is-napping');
        react();
        hearts();
        say('pet');
        spawnFamiliarBurst(walker, familiar.typeId, theme.burst);
        playFamiliarCall(familiar, studentId);
    });

    // A gentle tilt toward the pointer; the head and eyes follow a little.
    if (!lite && !still) {
        world.addEventListener('pointermove', (e) => {
            const r = walker.getBoundingClientRect();
            const px = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 1.4)));
            const py = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 1.4)));
            walker.style.setProperty('--fc-px', px.toFixed(3));
            walker.style.setProperty('--fc-py', py.toFixed(3));
        });
        world.addEventListener('pointerleave', () => {
            walker.style.setProperty('--fc-px', '0');
            walker.style.setProperty('--fc-py', '0');
        });
    }

    // ─── Time, season and weather chips: try the place in another light ────
    let paintN = 0;
    function repaint(changes) {
        Object.assign(view, changes);
        paintN += 1;
        habitat = buildHabitat({ typeId: familiar.typeId, stage: level, seed, lite, uid: `${uid}${paintN}`, ...view });
        const next = document.createElement('div');
        next.className = 'fam-hab__scene is-entering';
        next.innerHTML = sceneHtml(habitat);
        const old = world.querySelectorAll('.fam-hab__scene');
        world.insertBefore(next, fxHost);
        requestAnimationFrame(() => next.classList.remove('is-entering'));
        later(() => old.forEach((el) => { if (el !== next) el.remove(); }), 650);
        fxHost.innerHTML = still ? '' : particlesHtml(habitat.particles);
        world.dataset.time = habitat.time;
        const chip = (k) => overlay.querySelector(`[data-cycle="${k}"]`);
        chip('time').innerHTML = `<span aria-hidden="true">${habitat.timeIcon}</span><span>${habitat.timeLabel}</span>`;
        chip('season').innerHTML = `<span aria-hidden="true">${habitat.seasonIcon}</span><span>${habitat.seasonLabel}</span>`;
        chip('weather').innerHTML = `<span aria-hidden="true">${habitat.weatherIcon}</span><span>${habitat.weatherLabel}</span>`;
    }
    overlay.querySelector('.fam-hab__chips').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cycle]');
        if (!btn) return;
        e.stopPropagation();
        const key = btn.dataset.cycle;
        if (key === 'time') {
            repaint({ time: HABITAT_TIMES[(HABITAT_TIMES.indexOf(habitat.time) + 1) % HABITAT_TIMES.length] });
        } else if (key === 'season') {
            const season = HABITAT_SEASONS[(HABITAT_SEASONS.indexOf(habitat.season) + 1) % HABITAT_SEASONS.length];
            repaint({ season, weather: habitatWeathers(season)[0] });
        } else {
            const list = habitatWeathers(habitat.season);
            repaint({ weather: list[(list.indexOf(habitat.weather) + 1) % list.length] });
        }
    });

    // ─── Journal tabs ───────────────────────────────────────────────────────
    const tabs = [...overlay.querySelectorAll('.fam-hab-tab')];
    tabs.forEach((tab) => tab.addEventListener('click', () => {
        tabs.forEach((t) => { const on = t === tab; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
        overlay.querySelectorAll('.fam-hab-pane').forEach((pane) => {
            const on = pane.dataset.pane === tab.dataset.tab;
            pane.hidden = !on;
            pane.classList.toggle('is-on', on);
        });
    }));

    // ─── True name ──────────────────────────────────────────────────────────
    const renameBtn = overlay.querySelector('.fam-hab-rename');
    const nameRow = overlay.querySelector('.fam-den-name-row');
    const nameInput = overlay.querySelector('.fam-name-input');
    const saveBtn = overlay.querySelector('.fam-name-save');
    if (renameBtn && nameRow) {
        renameBtn.addEventListener('click', () => {
            nameRow.hidden = !nameRow.hidden;
            if (!nameRow.hidden) nameInput?.focus();
        });
    }
    if (saveBtn && nameInput) {
        const commitName = async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            try {
                await saveFamiliarName(studentId, nameInput.value);
                const now = scoreFor(studentId)?.familiar;
                const shown = now?.name || typeDef.name;
                overlay.querySelector('.fam-modal-name').textContent = shown;
                overlay.querySelector('.fam-modal-species').textContent = now?.name ? `${typeDef.name} · ${kindLabel}` : kindLabel;
                nameRow.hidden = true;
                hearts('♥');
                react('fam-react-hop');
            } catch (error) {
                console.warn('Familiar name could not be saved:', error);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
            }
        };
        saveBtn.addEventListener('click', (e) => { e.stopPropagation(); commitName(); });
        nameInput.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            e.stopPropagation();
            commitName();
        });
    }

    // ─── Start ──────────────────────────────────────────────────────────────
    layout();
    if (typeof ResizeObserver === 'function') {
        resizeObs = new ResizeObserver(() => layout());
        resizeObs.observe(world);
    } else {
        window.addEventListener('resize', layout);
    }
    if (!isEgg) {
        later(() => say('hello'), 700);
        ensureAudioReady().then(() => playFamiliarCall(familiar, studentId)).catch(quietly('features/familiarDen.js'));
        wander();
    }
}
