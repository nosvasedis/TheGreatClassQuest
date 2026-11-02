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
    HABITAT_W,
    HOME_SPOT,
    TOY_SPOT,
    TREAT_SPOT,
    buildHabitat,
    habitatPlaces,
    hashString
} from './familiarHabitat.mjs';
import { STATION_BITES, familiarWords, snackStationSvg, toySvg } from './familiarStations.mjs';

// What the familiar says, and how each kind of line looks: a friendly speech bubble, a pink
// love bubble, a cream "yum" bubble with crumbs, a starburst shout, a dreamy thought cloud or a
// shy whisper (the egg). {hero} = the student's first name, {sound} = the species' own voice
// word, {food} = its favourite food.
const MOODS = {
    hello: { shape: 'talk', icon: '👋', lines: ['Hi, {hero}!', 'You came back, {hero}!', '{sound} Hello!', 'Yay, it is {hero}!'] },
    pet: { shape: 'love', icon: '💖', lines: ['Hehe, that tickles!', '{sound}', 'I love you, {hero}!', 'Again, again!', 'Best friends!'] },
    come: { shape: 'talk', icon: '✨', lines: ['Coming!', 'On my way!', 'Here I am!', 'Wait for me!'] },
    eat: { shape: 'yum', icon: '{foodIcon}', lines: ['Yum yum!', 'Munch munch!', 'Mmm, {food}!', 'So tasty!'] },
    full: { shape: 'love', icon: '😋', lines: ['I am full! Thank you!', 'Best {food} ever!', 'Thank you, {hero}!'] },
    hungry: { shape: 'talk', icon: '{foodIcon}', lines: ['More {food} soon!', 'All gone! They grow back soon.'] },
    play: { shape: 'burst', icon: '⚡', lines: ['Wheee!', 'Catch it!', 'Kick!', '{sound}', 'Fetch!'] },
    caught: { shape: 'burst', icon: '🏆', lines: ['Got it!', 'Again!', 'I win!', 'One more time!'] },
    sleep: { shape: 'think', icon: '🌙', lines: ['Zzz...', 'Sweet dreams...', 'Zzz... {food}... Zzz'] },
    wake: { shape: 'talk', icon: '☀️', lines: ['Good nap!', 'Yaaawn! Hi, {hero}!', 'I feel great!'] },
    egg: { shape: 'whisper', icon: '🥚', lines: ['tap... tap...', '*wobble wobble*', 'Is it time yet?', 'crack...?'] }
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
    const habitat = buildHabitat({ typeId: familiar.typeId, stage: level, seed, lite, uid: `${uid}a`, ...view });
    const places = habitatPlaces(familiar.typeId);
    const words = familiarWords(familiar.typeId);

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
                ${isEgg ? '' : `<div class="fam-hab__stations">
                    <button type="button" class="fam-hab-station fam-hab-station--home" data-station="home" aria-label="${esc(`Send ${displayName} home for a nap`)}"><span class="fam-hab-station__tag">Nap</span></button>
                    <div class="fam-hab-homeglow" aria-hidden="true"></div>
                    <button type="button" class="fam-hab-station fam-hab-station--snack" data-station="snack" aria-label="${esc(`Give ${displayName} a snack: ${words.food}`)}">${snackStationSvg(familiar.typeId)}<span class="fam-hab-station__tag">Snack</span></button>
                    <button type="button" class="fam-hab-toy" data-station="toy" aria-label="${esc(`Play ball with ${displayName}`)}"><span class="fam-hab-toy__hop">${toySvg(familiar.typeId)}</span><span class="fam-hab-station__tag">Play</span></button>
                </div>`}
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
                </header>
                <div class="fam-hab__hint" aria-hidden="true">${isEgg ? 'Tap the egg to listen' : `Tap ${esc(displayName)}, its ${esc(words.food)}, its ball or its home`}</div>
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
    const walker = overlay.querySelector('.fam-hab__walker');
    const body = overlay.querySelector('.fam-hab__body');
    const bubble = overlay.querySelector('.fam-hab__bubble');
    const tapBtn = overlay.querySelector('.fam-overlay-tap');
    const stationsHost = overlay.querySelector('.fam-hab__stations');
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
        placeStations(true);
    }

    // ─── Speech bubbles ─────────────────────────────────────────────────────
    let bubbleTimer = null;
    const fill = (text) => text.replace(/\{hero\}/g, heroFirst).replace(/\{sound\}/g, words.sound)
        .replace(/\{food\}/g, words.food).replace(/\{foodIcon\}/g, words.foodIcon);
    const SHAPES = {
        burst: '<svg class="fam-say__bg" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true"><path d="M100 2l14 16l22 -12l2 22l26 -6l-10 22l30 6l-24 16l22 18l-30 2l8 24l-26 -12l-12 22l-16 -20l-16 20l-12 -22l-26 12l8 -24l-30 -2l22 -18l-24 -16l30 -6l-10 -22l26 6l2 -22l22 12z"/></svg>',
        think: '<svg class="fam-say__bg" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true"><path d="M40 86q-34 0 -34 -26q0 -22 26 -26q2 -26 34 -28q18 -14 40 -2q20 -10 40 4q30 -2 34 24q22 6 18 30q-4 24 -34 22q-14 14 -38 8q-20 12 -44 2q-26 8 -42 -8z"/></svg>'
    };
    function say(mood, lineOverride) {
        const m = MOODS[mood] || MOODS.pet;
        const text = fill(lineOverride || pick(m.lines));
        const wordsHtml = text.split(' ').map((w, i) => `<span class="fam-say__w" style="--i:${i}">${esc(w)}</span>`).join(' ');
        const zzz = m.shape === 'think' ? '<span class="fam-say__zzz" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span>' : '';
        const crumbs = m.shape === 'yum' ? '<span class="fam-say__crumbs" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' : '';
        bubble.className = `fam-hab__bubble fam-say fam-say--${m.shape}`;
        bubble.innerHTML = `${SHAPES[m.shape] || ''}<span class="fam-say__icon" aria-hidden="true">${fill(m.icon)}</span><span class="fam-say__text">${wordsHtml}</span>${zzz}${crumbs}`;
        void bubble.offsetWidth;
        bubble.classList.add('is-on');
        if (bubbleTimer) clearTimeout(bubbleTimer);
        bubbleTimer = later(() => bubble.classList.remove('is-on'), mood === 'sleep' ? 4200 : 2600);
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
            if (Date.now() - lastTouch > 5000 && !busy) {
                const [lo, hi] = visibleRange(walkerState.size / geo.s / 2 + 40);
                const roll = Math.random();
                if (roll < 0.25) { react('fam-react-hop'); }
                else walkTo(lo + Math.random() * (hi - lo));
            }
            wander();
        }, 6000 + Math.random() * 5000);
    }

    // ─── Stations: the snack, the ball and the home ──────────────────────────
    // Each one is a real thing in the place, and the familiar really does it: it eats the
    // bites one by one (they grow back), kicks the ball and chases it, or goes into its home
    // for a nap while the window glows.
    let busy = false;
    const toy = { x: TOY_SPOT[0] };
    let bitesLeft = STATION_BITES;
    const snackBtn = stationsHost?.querySelector('[data-station="snack"]');
    const toyBtn = stationsHost?.querySelector('[data-station="toy"]');
    const homeBtn = stationsHost?.querySelector('[data-station="home"]');
    const homeGlow = stationsHost?.querySelector('.fam-hab-homeglow');
    function placeAt(el, x, y, w, h, extra = '') {
        if (!el) return;
        el.style.width = `${(w * geo.s).toFixed(1)}px`;
        el.style.height = `${(h * geo.s).toFixed(1)}px`;
        el.style.transform = `translate3d(${(toPx(x) - (w * geo.s) / 2).toFixed(1)}px, ${(geo.h - (HABITAT_H - y) * geo.s - h * geo.s).toFixed(1)}px, 0)${extra}`;
    }
    function placeStations(instant = false) {
        if (!stationsHost) return;
        placeAt(snackBtn, TREAT_SPOT[0], TREAT_SPOT[1], 150, 108);
        placeAt(homeBtn, HOME_SPOT[0], HOME_SPOT[1] + 6, 230, 200);
        placeAt(homeGlow, HOME_SPOT[0], HOME_SPOT[1] - 20, 160, 140);
        if (instant) toyBtn.style.transition = 'none';
        placeAt(toyBtn, toy.x, TOY_SPOT[1], 74, 74);
        if (instant) { void toyBtn.offsetWidth; toyBtn.style.transition = ''; }
    }
    function setBites(n) {
        bitesLeft = n;
        snackBtn?.querySelectorAll('.fst-bite').forEach((g, i) => g.classList.toggle('is-eaten', i >= n));
        snackBtn?.classList.toggle('is-empty', n === 0);
    }
    function doSnack() {
        if (bitesLeft === 0) { walkTo(TREAT_SPOT[0] + 95, () => { react('fam-react-wiggle'); say('hungry'); busy = false; }); return; }
        walkTo(TREAT_SPOT[0] + 95, () => {
            body.style.setProperty('--dir', '-1');
            walker.classList.add('is-eating');
            say('eat');
            let n = bitesLeft;
            const chomp = () => {
                if (closed) return;
                n -= 1;
                setBites(n);
                crumbs();
                if (n > 0) { later(chomp, 750); return; }
                later(() => {
                    walker.classList.remove('is-eating');
                    react('fam-react-hop');
                    hearts('♥');
                    say(n === 0 ? 'full' : 'eat');
                    playFamiliarCall(familiar, studentId);
                    busy = false;
                    if (n === 0) later(() => { setBites(STATION_BITES); snackBtn?.classList.add('is-regrow'); later(() => snackBtn?.classList.remove('is-regrow'), 900); }, 9000);
                }, 500);
            };
            later(chomp, 450);
        });
    }
    function crumbs() {
        if (still || !snackBtn) return;
        const pop = document.createElement('span');
        pop.className = 'fam-hab-crumbs';
        pop.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
        snackBtn.appendChild(pop);
        later(() => pop.remove(), 900);
    }
    function doPlay() {
        const side = walkerState.x < toy.x ? -1 : 1;
        walkTo(toy.x + side * 70, () => {
            react('fam-react-hop');
            // Kick the ball the other way, as far as the place allows.
            const [lo, hi] = visibleRange(80);
            const dir = -side;
            let target = toy.x + dir * (260 + Math.random() * 260);
            if (target < lo || target > hi) target = toy.x - dir * (260 + Math.random() * 200);
            target = Math.max(lo, Math.min(hi, target));
            const dur = still ? 0 : 1.3;
            toyBtn.style.setProperty('--kick-dur', `${dur}s`);
            toyBtn.style.setProperty('--spin', target > toy.x ? '1' : '-1');
            toy.x = target;
            toyBtn.classList.remove('is-kicked');
            void toyBtn.offsetWidth;
            toyBtn.classList.add('is-kicked');
            placeStations();
            say('play');
            later(() => {
                toyBtn.classList.remove('is-kicked');
                const back = walkerState.x < toy.x ? -1 : 1;
                walkTo(toy.x + back * 70, () => {
                    react(Math.random() < 0.5 ? 'fam-react-spin' : 'fam-react-hop');
                    spawnFamiliarBurst(walker, familiar.typeId, theme.burst);
                    say('caught');
                    playFamiliarCall(familiar, studentId);
                    busy = false;
                });
            }, dur * 1000 + 150);
        });
    }
    function doNap() {
        walkTo(HOME_SPOT[0], () => {
            walker.classList.add('is-going-in');
            later(() => {
                homeGlow?.classList.add('is-on');
                say('sleep');
            }, 650);
            later(() => {
                if (closed) return;
                homeGlow?.classList.remove('is-on');
                walker.classList.remove('is-going-in');
                walker.classList.add('is-coming-out');
                say('wake');
                later(() => { walker.classList.remove('is-coming-out'); react('fam-react-hop'); busy = false; }, 700);
            }, 5200);
        });
    }
    stationsHost?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-station]');
        if (!btn) return;
        e.stopPropagation();
        lastTouch = Date.now();
        if (busy) return;
        busy = true;
        ensureAudioReady().catch(() => false);
        say('come');
        const kind = btn.dataset.station;
        if (kind === 'snack') doSnack();
        else if (kind === 'toy') doPlay();
        else doNap();
    });

    // Tap the ground: the familiar comes over.
    groundBtn.addEventListener('click', (e) => {
        lastTouch = Date.now();
        if (isEgg) { tapBtn.click(); return; }
        if (busy) return;
        const r = world.getBoundingClientRect();
        say('come');
        walkTo(toUnits(e.clientX - r.left));
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
        if (walker.classList.contains('is-going-in')) return;
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
