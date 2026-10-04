// /features/familiars.js — Familiars: companion eggs that hatch and evolve as their hero earns stars.
// The creatures are hand-built SVG rigs from the Familiar Forge (features/familiarForge.mjs):
// 30 presets per class, personal traits on top, idle motion, a voice, a hop when their hero
// earns a star and, at level 3, a once-a-month trick in the Quiz of the Week.

import { db, doc, getDoc, updateDoc } from '../firebase.js';
import * as state from '../state.js';
import { playSound, playFamiliarVoice, ensureAudioReady } from '../audio.js';
import { showToast } from '../ui/effects.js';
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';
import {
    FAMILIAR_LEVEL_THRESHOLDS,
    deriveLegacyStarsAtHatch,
    getEffectiveStarsAtHatch,
    getUnlockedFamiliarLevel,
    getFamiliarProgress,
    getFamiliarProgressPercent
} from './familiarProgression.mjs';
import { getFamiliarVariant, normalizeFamiliarName } from './familiarIdentity.mjs';
import {
    FAMILIAR_LOOK_VERSION,
    FAMILIAR_TRICKS,
    FAMILIAR_TRICK_LEVEL,
    buildFamiliarEggSvg,
    buildFamiliarSvg,
    createFamiliarLook,
    describeFamiliar,
    familiarVoice,
    isFamiliarTrickReady,
    resolveFamiliarLook,
    trickMonthKey
} from './familiarForge.mjs';

const publicDataPath = 'artifacts/great-class-quest/public/data';
const familiarOps = new Map();
const FAMILIAR_SCHEMA_VERSION = 3;

export { FAMILIAR_LEVEL_THRESHOLDS };

// ─── FAMILIAR TYPE DEFINITIONS ────────────────────────────────────────────────

export const FAMILIAR_TYPES = {
    emberfang: {
        id: 'emberfang',
        name: 'Emberfang',
        price: 40,
        eggIcon: '🥚',
        eggColor: '#ef4444',
        eggAccent: '#fca5a5',
        personality: 'Bold and fierce — a flame that never goes out.',
        desc: 'A fire-breathing dragon hatchling that grows into a mighty flame drake.',
        flavorHint: 'Daring • Fierce • Unstoppable',
        levelNames: ['Hatchling', 'Flame Drake', 'Inferno Dragon']
    },
    frostpaw: {
        id: 'frostpaw',
        name: 'Frostpaw',
        price: 35,
        eggIcon: '🥚',
        eggColor: '#3b82f6',
        eggAccent: '#bfdbfe',
        personality: 'Calm and wise — cool as the winter wind.',
        desc: 'An arctic fox spirit that grows into a mystical frost guardian.',
        flavorHint: 'Serene • Wise • Graceful',
        levelNames: ['Ice Cub', 'Snow Fox', 'Frost Guardian']
    },
    thornback: {
        id: 'thornback',
        name: 'Thornback',
        price: 30,
        eggIcon: '🥚',
        eggColor: '#16a34a',
        eggAccent: '#86efac',
        personality: 'Sturdy and loyal — as solid as the ancient oaks.',
        desc: 'A mossy forest toad that evolves into a legendary ancient treant.',
        flavorHint: 'Strong • Loyal • Grounded',
        levelNames: ['Moss Toad', 'Bark Bear', 'Ancient Treant']
    },
    veilshade: {
        id: 'veilshade',
        name: 'Veilshade',
        price: 45,
        eggIcon: '🥚',
        eggColor: '#7c3aed',
        eggAccent: '#c4b5fd',
        personality: 'Mysterious and elusive — a whisper between worlds.',
        desc: 'A shadow sprite that grows into the legendary Void Stalker.',
        flavorHint: 'Mysterious • Swift • Ethereal',
        levelNames: ['Shadow Wisp', 'Phantom Cat', 'Void Stalker']
    },
    sparkling: {
        id: 'sparkling',
        name: 'Sparkling',
        price: 50,
        eggIcon: '🥚',
        eggColor: '#f59e0b',
        eggAccent: '#fde68a',
        personality: 'Bright and joyful — a burst of sunrise magic.',
        desc: 'A radiant fairy-phoenix that blossoms into a legendary sun guardian.',
        flavorHint: 'Radiant • Joyful • Inspiring',
        levelNames: ['Sun Sprite', 'Dawn Fairy', 'Solar Phoenix']
    }
};

// ─── STYLES, PERFORMANCE AND GENOMES ──────────────────────────────────────────

let stylesRequested = false;
function ensureFamiliarStyles() {
    if (stylesRequested || typeof document === 'undefined') return;
    stylesRequested = true;
    import('../styles/familiar_creatures.css').catch((e) => console.warn('Familiar styles failed to load:', e));
}

let liteTier = null;
function isLite() {
    if (liteTier === null) {
        try { liteTier = detectLowPowerTier(); } catch { liteTier = false; }
    }
    return liteTier;
}

function prefersReducedMotion() {
    try { return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

const genomeCache = new Map();

/** The full genome (palette, parts, traits) for a saved familiar. */
export function getFamiliarGenome(familiar, studentId = '') {
    if (!familiar || !FAMILIAR_TYPES[familiar.typeId]) return null;
    const look = resolveFamiliarLook(familiar, studentId);
    const key = `${familiar.typeId}|${look.preset}|${look.seed}`;
    if (!genomeCache.has(key)) genomeCache.set(key, describeFamiliar(familiar.typeId, look));
    return genomeCache.get(key);
}

/** Play this familiar's voice (no-op until the audio context is running). */
export function playFamiliarCall(familiar, studentId = '') {
    const genome = getFamiliarGenome(familiar, studentId);
    if (!genome) return;
    try { playFamiliarVoice(familiarVoice(genome, familiar.level || 1)); } catch (_) { /* audio is optional */ }
}

// ─── LIFECYCLE ────────────────────────────────────────────────────────────────

export function buildFamiliarInitData(typeId, currentTotalStars, studentId = '') {
    const variant = getFamiliarVariant(typeId, studentId);
    return {
        typeId,
        state: 'egg',
        level: 0,
        starsWhenPurchased: currentTotalStars,
        starsWhenHatched: 0,
        starsAtHatch: null,
        name: '',
        variant,
        look: createFamiliarLook(typeId),
        seenLevel: 0,
        trickMonth: null,
        schemaVersion: FAMILIAR_SCHEMA_VERSION
    };
}

export function checkHatchOrLevelUp(studentId) {
    return reconcileFamiliarLifecycle(studentId, { announce: true, source: 'stars' });
}

export function reconcileFamiliarLifecycle(studentId, options = {}) {
    const existing = familiarOps.get(studentId);
    if (existing) return existing;

    const promise = _reconcileFamiliarLifecycle(studentId, options)
        .catch((error) => {
            console.warn('Familiar reconciliation failed:', error);
            return null;
        })
        .finally(() => {
            familiarOps.delete(studentId);
        });

    familiarOps.set(studentId, promise);
    return promise;
}

async function _reconcileFamiliarLifecycle(studentId, options = {}) {
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
    const scoreSnap = await getDoc(scoreRef);
    if (!scoreSnap.exists()) return null;

    const scoreData = scoreSnap.data();
    if (!scoreData?.familiar) return null;

    let familiar = scoreData.familiar;
    const totalStars = scoreData.totalStars || 0;
    const migrationUpdates = _buildMigrationUpdates(familiar, studentId);
    if (Object.keys(migrationUpdates).length) {
        await updateDoc(scoreRef, migrationUpdates);
        familiar = _mergeFamiliar(familiar, migrationUpdates);
    }

    const currentLevel = familiar.state === 'alive' ? (familiar.level || 0) : 0;
    const unlockedLevel = getUnlockedFamiliarLevel(familiar, totalStars);
    const desiredLevel = Math.max(currentLevel, unlockedLevel);
    const desiredState = desiredLevel > 0 || familiar.state === 'alive' ? 'alive' : 'egg';
    const levelChanged = (familiar.level || 0) !== desiredLevel || familiar.state !== desiredState;
    const progressionUpdates = {};

    if (desiredState === 'alive') {
        const starsAtHatch = getEffectiveStarsAtHatch(familiar, totalStars);
        if (familiar.state !== 'alive') progressionUpdates['familiar.state'] = 'alive';
        if ((familiar.level || 0) !== desiredLevel) progressionUpdates['familiar.level'] = desiredLevel;
        if (familiar.starsWhenHatched !== starsAtHatch) progressionUpdates['familiar.starsWhenHatched'] = starsAtHatch;
        if (familiar.starsAtHatch !== starsAtHatch) progressionUpdates['familiar.starsAtHatch'] = starsAtHatch;
    } else {
        if (familiar.state !== 'egg') progressionUpdates['familiar.state'] = 'egg';
        if ((familiar.level || 0) !== 0) progressionUpdates['familiar.level'] = 0;
    }

    if (Object.keys(progressionUpdates).length) {
        await updateDoc(scoreRef, progressionUpdates);
        familiar = _mergeFamiliar(familiar, progressionUpdates);
    }

    if (levelChanged && options.announce && desiredLevel > 0) {
        _announceStageChange(studentId, familiar, desiredLevel);
    }
    return { level: desiredLevel };
}

/**
 * Bring an older familiar onto the Forge: it keeps its type, level, stars and name, gains a
 * look that matches its old variant name, and is marked as already met at its current stage
 * (so no hatch moment replays for a familiar the class has known for months).
 */
function _buildMigrationUpdates(familiar, studentId = '') {
    const updates = {};
    if (!familiar) return updates;

    if (familiar.schemaVersion !== FAMILIAR_SCHEMA_VERSION) updates['familiar.schemaVersion'] = FAMILIAR_SCHEMA_VERSION;

    if (familiar.state !== 'egg') {
        const starsAtHatch = deriveLegacyStarsAtHatch(familiar);
        if (typeof starsAtHatch === 'number') {
            if (familiar.starsAtHatch !== starsAtHatch) updates['familiar.starsAtHatch'] = starsAtHatch;
            if (familiar.starsWhenHatched !== starsAtHatch) updates['familiar.starsWhenHatched'] = starsAtHatch;
        }
    }

    if (!('name' in familiar)) updates['familiar.name'] = '';
    if (!familiar.variant) updates['familiar.variant'] = getFamiliarVariant(familiar.typeId, studentId);
    if (!familiar.look || familiar.look.v !== FAMILIAR_LOOK_VERSION) {
        updates['familiar.look'] = resolveFamiliarLook({ ...familiar, look: null }, studentId);
    }
    if (typeof familiar.seenLevel !== 'number') {
        updates['familiar.seenLevel'] = familiar.state === 'alive' ? (familiar.level || 0) : 0;
    }
    if (!('trickMonth' in familiar)) updates['familiar.trickMonth'] = null;

    return updates;
}

function _mergeFamiliar(familiar, updates) {
    const merged = typeof structuredClone === 'function'
        ? structuredClone(familiar)
        : JSON.parse(JSON.stringify(familiar));
    for (const [path, value] of Object.entries(updates)) {
        if (!path.startsWith('familiar.')) continue;
        const keys = path.split('.').slice(1);
        let cursor = merged;
        while (keys.length > 1) {
            const key = keys.shift();
            if (!(key in cursor) || typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {};
            cursor = cursor[key];
        }
        cursor[keys[0]] = value;
    }
    return merged;
}

function _announceStageChange(studentId, familiar, newLevel) {
    const student = state.get('allStudents').find((s) => s.id === studentId);
    const typeDef = FAMILIAR_TYPES[familiar.typeId];
    if (!student || !typeDef) return;
    const familiarLabel = getFamiliarDisplayName(familiar, typeDef);
    const firstName = student.name.split(' ')[0];

    import('../ui/effects.js').then((m) => {
        if (newLevel <= 1) m.showPraiseToast(`${firstName}'s ${familiarLabel} has hatched! Open the Den to meet it. 🥚✨`, '🎉');
        else m.showPraiseToast(`${firstName}'s ${familiarLabel} evolved into a ${typeDef.levelNames[newLevel - 1]}! 🌟`, '⬆️');
    });
    _playFamiliarSound(newLevel <= 1 ? 'hatch' : 'levelup');
    setTimeout(() => playFamiliarCall({ ...familiar, level: newLevel }, studentId), 700);
}

function _playFamiliarSound(type) {
    try {
        playSound(type === 'hatch' ? 'familiar_hatch' : 'familiar_levelup');
    } catch (_) {}
}

// ─── RENDER HELPERS ───────────────────────────────────────────────────────────

const SIZE_PX = { small: 40, medium: 64, large: 128, xl: 168 };
const lastSeenStars = new Map(); // studentId -> { stars, hopUntil }
let lastHopCall = 0;

/** True for a short moment after this student's star total went up, so every view of the familiar hops. */
function shouldHop(studentId) {
    if (!studentId) return false;
    const score = (state.get('allStudentScores') || []).find((s) => s.id === studentId);
    const stars = Number(score?.totalStars) || 0;
    const seen = lastSeenStars.get(studentId);
    const now = Date.now();
    if (!seen) {
        lastSeenStars.set(studentId, { stars, hopUntil: 0 });
        return false;
    }
    if (stars > seen.stars) {
        seen.hopUntil = now + 1600;
        if (score?.familiar?.state === 'alive' && now - lastHopCall > 2500) {
            lastHopCall = now;
            setTimeout(() => playFamiliarCall(score.familiar, studentId), 160);
        }
    }
    seen.stars = stars;
    return now < seen.hopUntil;
}

function eggProgressFor(familiar, studentId) {
    const score = (state.get('allStudentScores') || []).find((s) => s.id === studentId);
    return getFamiliarProgressPercent(getFamiliarProgress(familiar, Number(score?.totalStars) || 0));
}

/** Just the SVG for a familiar at a given stage (used by the Den, the hatch moment, the Parade and the Quiz). */
export function familiarArtSvg(familiar, studentId = '', { level = null, mode = 'full', egg = null, progress = null } = {}) {
    ensureFamiliarStyles();
    const genome = getFamiliarGenome(familiar, studentId);
    if (!genome) return '';
    const showEgg = egg ?? familiar.state === 'egg';
    const lite = isLite();
    let svg = showEgg
        ? buildFamiliarEggSvg(genome, { progress: progress ?? eggProgressFor(familiar, studentId) })
        : buildFamiliarSvg(genome, { level: level || familiar.level || 1, mode });
    if (lite) svg = svg.replace('class="fc ', 'class="fc fc--lite ');
    if (mode === 'chip') svg = svg.replace('class="fc ', 'class="fc fc--chip ');
    return svg;
}

export function renderFamiliarSprite(familiar, size = 'small', studentId = '') {
    if (!familiar) return '';
    const typeDef = FAMILIAR_TYPES[familiar.typeId];
    if (!typeDef) return '';
    const px = SIZE_PX[size] || SIZE_PX.small;
    const chip = px < 100;
    const isEgg = familiar.state === 'egg';
    const genome = getFamiliarGenome(familiar, studentId);
    const displayName = getFamiliarDisplayName(familiar, typeDef);
    const stageName = isEgg ? 'Egg — earn stars to hatch!' : typeDef.levelNames[(familiar.level || 1) - 1];
    const title = `${displayName} • ${genome?.preset?.label || typeDef.name} — ${stageName}`;
    const hop = shouldHop(studentId);
    const live = chip && !isEgg && !isLite() && !hop;
    const classes = ['familiar-container', 'enlargeable-familiar', live ? 'fam-live' : '', hop ? 'fam-hop' : ''].filter(Boolean).join(' ');

    return `
        <div class="${classes}" data-student-id="${escapeHtml(studentId)}"
             style="width:${px}px;height:${px}px;flex-shrink:0;"
             title="${escapeHtml(title)}">${familiarArtSvg(familiar, studentId, { mode: chip ? 'chip' : 'full' })}</div>`;
}

// ─── FAMILIAR DEN (stats overlay) ─────────────────────────────────────────────

// Element sigil per species; the matching habitat colours live in styles/familiar_modal.css.
const FAMILIAR_DEN_THEMES = {
    emberfang: { sigil: '🔥', element: 'Fire', burst: ['#fb923c', '#fde047', '#ef4444'] },
    frostpaw: { sigil: '❄️', element: 'Frost', burst: ['#e0f2fe', '#7dd3fc', '#ffffff'] },
    thornback: { sigil: '🌿', element: 'Wildwood', burst: ['#84cc16', '#4ade80', '#fde047'] },
    veilshade: { sigil: '🌙', element: 'Shadow', burst: ['#c084fc', '#818cf8', '#f0abfc'] },
    sparkling: { sigil: '☀️', element: 'Sunlight', burst: ['#fde047', '#fbbf24', '#fff7ed'] }
};

function spawnBurst(host, typeId, colours) {
    if (!host || prefersReducedMotion()) return;
    const burst = document.createElement('div');
    burst.className = 'fam-burst';
    burst.dataset.kind = typeId;
    const count = isLite() ? 6 : 12;
    burst.innerHTML = Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const d = 50 + Math.random() * 40;
        return `<i style="--n:${i};--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d - 20)}px;--burst:${colours[i % colours.length]}"></i>`;
    }).join('');
    host.appendChild(burst);
    setTimeout(() => burst.remove(), 1200);
}

function runHatchMoment(altar, familiar, studentId, onDone) {
    const creature = altar.querySelector('.fam-den-creature');
    if (!creature || prefersReducedMotion()) { onDone?.(); return; }
    const seen = Number(familiar.seenLevel) || 0;
    const before = seen <= 0
        ? familiarArtSvg(familiar, studentId, { egg: true, progress: 100 })
        : familiarArtSvg(familiar, studentId, { level: seen, mode: 'full' });
    const stage = document.createElement('div');
    stage.className = 'fam-hatch';
    stage.innerHTML = `<div class="fam-hatch__egg">${before}</div><div class="fam-hatch__flash"></div>`;
    creature.style.opacity = '0';
    altar.appendChild(stage);
    _playFamiliarSound(seen <= 0 ? 'hatch' : 'levelup');
    setTimeout(() => {
        creature.style.opacity = '';
        creature.classList.add('fam-hatch-reveal');
        spawnBurst(altar, familiar.typeId, FAMILIAR_DEN_THEMES[familiar.typeId]?.burst || ['#fde68a']);
        playFamiliarCall(familiar, studentId);
    }, 1550);
    setTimeout(() => { stage.remove(); onDone?.(); }, 2600);
}

async function markFamiliarSeen(studentId, level) {
    try {
        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
        await updateDoc(scoreRef, { 'familiar.seenLevel': level });
        _patchLocalFamiliarState(studentId, (current) => ({ ...current, seenLevel: level }));
    } catch (error) {
        console.warn('Could not save that the familiar was met:', error);
    }
}

export function openFamiliarStatsOverlay(studentId) {
    const scoreData = state.get('allStudentScores').find((s) => s.id === studentId);
    const student = state.get('allStudents').find((s) => s.id === studentId);
    if (!scoreData?.familiar || !student) return;

    const familiar = scoreData.familiar;
    const typeDef = FAMILIAR_TYPES[familiar.typeId];
    if (!typeDef) return;
    ensureFamiliarStyles();

    const existingOverlay = document.querySelector('.familiar-stats-overlay');
    if (existingOverlay) {
        if (existingOverlay.dataset.studentId === studentId) {
            existingOverlay.querySelector('.fam-overlay-tap')?.click();
            return;
        }
        existingOverlay.remove();
    }

    const level = familiar.level || 1;
    const starsTotal = scoreData.totalStars || 0;
    const starsTogether = Math.max(0, starsTotal - (familiar.starsWhenPurchased || 0));
    const progress = getFamiliarProgress(familiar, starsTotal);
    const progressPercent = getFamiliarProgressPercent(progress);
    const isMaxLevel = progress.phase === 'max';
    const isEgg = familiar.state === 'egg';
    const levelName = isEgg ? 'Egg' : (typeDef.levelNames[level - 1] || 'Unknown');
    const genome = getFamiliarGenome(familiar, studentId);
    const spriteHtml = renderFamiliarSprite(familiar, 'xl', studentId);
    const displayName = getFamiliarDisplayName(familiar, typeDef);
    const speciesLabel = familiar.name ? `${typeDef.name} • ${genome?.preset?.label || ''}` : genome?.preset?.label || typeDef.name;
    const denTheme = FAMILIAR_DEN_THEMES[familiar.typeId] || { sigil: '✨', element: 'Arcane', burst: ['#fde68a'] };
    const trick = FAMILIAR_TRICKS[familiar.typeId];
    const trickReady = isFamiliarTrickReady(familiar);
    const needsHatchMoment = !isEgg && typeof familiar.seenLevel === 'number' && familiar.seenLevel < level;

    const overlay = document.createElement('div');
    overlay.dataset.studentId = studentId;
    overlay.className = 'familiar-stats-overlay fixed inset-0 z-[95] flex items-center justify-center';

    // Habitat motes: the per-type CSS makes embers rise, snow fall, leaves drift, wisps flicker, sun motes shimmer.
    const motes = Array.from({ length: isLite() ? 6 : 14 }, (_, i) => {
        const left = 4 + ((i * 37) % 92);
        const top = 6 + ((i * 53) % 80);
        const dur = (4.8 + (i % 5) * 0.9).toFixed(1);
        const delay = (-(i * 0.73)).toFixed(2);
        const drift = (i % 2 ? -1 : 1) * (10 + (i % 4) * 7);
        const size = 3 + (i % 4) * 1.5;
        return `<span class="fam-den-mote" style="left:${left}%;top:${top}%;--mote-size:${size}px;--mote-dur:${dur}s;--mote-delay:${delay}s;--mote-drift:${drift}px;"></span>`;
    }).join('');

    const runeMarks = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const x = 100 + Math.cos(a) * 86;
        const y = 100 + Math.sin(a) * 86;
        return i % 3 === 0
            ? `<path d="M${x.toFixed(1)} ${(y - 5).toFixed(1)}L${(x + 4).toFixed(1)} ${y.toFixed(1)}L${x.toFixed(1)} ${(y + 5).toFixed(1)}L${(x - 4).toFixed(1)} ${y.toFixed(1)}Z" class="fam-rune-gem"/>`
            : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" class="fam-rune-dot"/>`;
    }).join('');

    // Evolution path: Egg → the three named forms, each drawn as this very familiar.
    const currentStage = isEgg ? 0 : Math.min(3, level);
    const stages = [{ name: 'Egg' }, ...typeDef.levelNames.map((name) => ({ name }))];
    const evolutionTrack = stages.map((stage, i) => {
        const status = i < currentStage ? 'done' : i === currentStage ? 'current' : 'locked';
        const art = status === 'locked'
            ? '<i class="fas fa-lock"></i>'
            : `<span class="fam-evo-art">${familiarArtSvg(familiar, studentId, i === 0 ? { egg: true, progress: isEgg ? progressPercent : 100, mode: 'chip' } : { egg: false, level: i, mode: 'chip' })}</span>`;
        return `
            <li class="fam-evo-node fam-evo-node--${status}" style="--evo-i:${i};">
                <span class="fam-evo-gem">${art}</span>
                <span class="fam-evo-name">${escapeHtml(stage.name)}</span>
            </li>`;
    }).join('');
    const trackFill = Math.round((currentStage / 3) * 100);

    const nextStageName = isMaxLevel ? '' : stages[Math.min(3, currentStage + 1)].name;
    const progressSpan = Math.max(1, progress.max - progress.min);
    const progressDone = Math.max(0, Math.min(progressSpan, progress.current - progress.min));
    const progressVerb = progress.phase === 'egg' ? 'Hatches into' : 'Evolves into';

    const traits = (genome?.traits || []).slice(1)
        .map((t) => `<span class="fam-den-trait${t === 'Shiny' ? ' fam-den-trait--shiny' : ''}">${escapeHtml(t)}</span>`).join('');

    const trickPanel = trick ? (level >= FAMILIAR_TRICK_LEVEL && !isEgg ? `
                    <section class="fam-den-panel fam-den-trick">
                        <span class="fam-stat-icon" aria-hidden="true">🪄</span>
                        <div>
                            <div class="fam-den-label">Trick · ${escapeHtml(trick.name)}</div>
                            <div class="fam-den-hint">Once a month in the Quiz of the Week, ${escapeHtml(displayName)} ${escapeHtml(trick.verb)}.</div>
                            <div class="fam-den-trick-state ${trickReady ? 'is-ready' : ''}">${trickReady ? 'Ready this month' : 'Used this month. Back next month!'}</div>
                        </div>
                    </section>` : `
                    <section class="fam-den-panel fam-den-trick fam-den-trick--locked">
                        <span class="fam-stat-icon" aria-hidden="true">🪄</span>
                        <div>
                            <div class="fam-den-label">Trick at ${escapeHtml(typeDef.levelNames[2])}</div>
                            <div class="fam-den-hint">Learns ${escapeHtml(trick.name)}: once a month in the Quiz of the Week it ${escapeHtml(trick.verb)}.</div>
                        </div>
                    </section>`) : '';

    overlay.innerHTML = `
        <div class="fam-overlay-backdrop"></div>
        <div class="fam-modal-card fam-den relative w-full" data-fam-type="${escapeHtml(familiar.typeId)}"
             style="--fam-color:${typeDef.eggColor};--fam-accent:${typeDef.eggAccent || typeDef.eggColor};">
            <div class="fam-modal-scroll">
                <button type="button" class="fam-overlay-close" aria-label="Close">&times;</button>

                <div class="fam-den-stage">
                    <div class="fam-den-sky" aria-hidden="true"></div>
                    <div class="fam-den-rays" aria-hidden="true"></div>
                    <div class="fam-den-motes" aria-hidden="true">${motes}</div>
                    <div class="fam-den-sigil" title="${escapeHtml(denTheme.element)} familiar">
                        <span class="fam-den-sigil-icon">${denTheme.sigil}</span>
                        <span>${escapeHtml(denTheme.element)}</span>
                    </div>
                    <div class="fam-den-altar">
                        <svg class="fam-den-runes" viewBox="0 0 200 200" aria-hidden="true">
                            <circle cx="100" cy="100" r="94" class="fam-rune-ring"/>
                            <circle cx="100" cy="100" r="78" class="fam-rune-ring fam-rune-ring--dash"/>
                            <circle cx="100" cy="100" r="64" class="fam-rune-ring fam-rune-ring--faint"/>
                            ${runeMarks}
                        </svg>
                        <div class="fam-modal-sprite-halo" aria-hidden="true"></div>
                        <div class="fam-den-pedestal" aria-hidden="true"></div>
                        <button type="button" class="fam-overlay-tap fam-den-creature" aria-label="Pet ${escapeHtml(displayName)}">
                            <span class="fc-tilt">${spriteHtml}</span>
                        </button>
                    </div>
                    <div class="fam-den-pet-hint" aria-hidden="true">${isEgg ? 'Tap the egg to listen' : 'Tap to play'}</div>
                </div>

                <div class="fam-den-body">
                    <div class="fam-den-heading">
                        <div class="fam-modal-species">${escapeHtml(speciesLabel)}</div>
                        <h3 class="fam-modal-name">${escapeHtml(displayName)}</h3>
                        <div class="fam-modal-badge">${isEgg ? '🥚' : '✨'} ${escapeHtml(levelName)}</div>
                    </div>

                    <blockquote class="fam-modal-quote">${escapeHtml(typeDef.personality)}</blockquote>
                    ${traits ? `<div class="fam-den-traits">${traits}</div>` : ''}

                    <section class="fam-den-panel" aria-label="Evolution path">
                        <div class="fam-den-label">Evolution Path</div>
                        <ol class="fam-evo-track" style="--evo-fill:${trackFill}%;">${evolutionTrack}</ol>
                    </section>

                    ${!isMaxLevel ? `
                    <section class="fam-den-panel fam-den-progress">
                        <div class="fam-den-progress-head">
                            <div>
                                <div class="fam-den-label">${progressVerb}</div>
                                <div class="fam-den-next">${escapeHtml(nextStageName)}</div>
                            </div>
                            <div class="fam-den-count"><strong>${progressDone}</strong> / ${progressSpan} ⭐</div>
                        </div>
                        <div class="fam-den-bar">
                            <div class="fam-modal-progress-bar" style="--fam-progress:${progressPercent}%;"></div>
                        </div>
                        <div class="fam-den-hint">${progress.remaining} more ${progress.remaining === 1 ? 'star' : 'stars'} to go · ${progressPercent}%</div>
                    </section>` : `
                    <section class="fam-den-panel fam-den-max">
                        <span class="fam-den-max-crown" aria-hidden="true">👑</span>
                        <div>
                            <div class="fam-den-max-title">Legendary Form</div>
                            <div class="fam-den-hint">Maximum evolution reached</div>
                        </div>
                    </section>`}

                    ${trickPanel}

                    <div class="fam-den-stats">
                        <div class="fam-modal-stat">
                            <span class="fam-stat-icon" aria-hidden="true">⭐</span>
                            <div>
                                <div class="fam-stat-value">${starsTogether}</div>
                                <div class="fam-den-label">Stars together</div>
                            </div>
                        </div>
                        <div class="fam-modal-stat">
                            <span class="fam-stat-icon" aria-hidden="true">${denTheme.sigil}</span>
                            <div>
                                <div class="fam-stat-value fam-stat-value--sm">${escapeHtml(genome?.preset?.label || 'Standard')}</div>
                                <div class="fam-den-label">${isEgg ? 'Hatching as' : 'Kind'}</div>
                            </div>
                        </div>
                    </div>

                    ${familiar.state === 'alive' ? `
                    <section class="fam-den-panel">
                        <div class="fam-den-label">True name</div>
                        <div class="fam-den-name-row">
                            <input type="text" class="fam-name-input" maxlength="24" value="${escapeHtml(familiar.name || '')}" placeholder="Give this familiar a name">
                            <button type="button" class="fam-name-save" data-student-id="${escapeHtml(studentId)}">Save</button>
                        </div>
                    </section>` : `
                    <section class="fam-den-panel fam-den-egg-note">
                        <span class="fam-stat-icon" aria-hidden="true">🥚</span>
                        <div class="fam-den-hint">This egg can be named after it hatches.</div>
                    </section>`}
                </div>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    const closeOverlay = () => {
        const card = overlay.querySelector('.fam-modal-card');
        const backdrop = overlay.querySelector('.fam-overlay-backdrop');
        if (card) {
            card.classList.add('fam-modal-card--exit');
            if (backdrop) backdrop.classList.add('fam-overlay-backdrop--exit');
            card.addEventListener('animationend', (e) => { if (e.target === card) overlay.remove(); });
            setTimeout(() => overlay.remove(), 700);
        } else {
            overlay.remove();
        }
    };
    overlay.querySelector('.fam-overlay-close').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

    const altar = overlay.querySelector('.fam-den-altar');
    const stageEl = overlay.querySelector('.fam-den-stage');
    const tapBtn = overlay.querySelector('.fam-overlay-tap');

    // A gentle 3D tilt toward the pointer; the head and eyes follow a little further.
    if (stageEl && altar && !isLite() && !prefersReducedMotion()) {
        stageEl.addEventListener('pointermove', (e) => {
            const r = altar.getBoundingClientRect();
            const px = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 1.2)));
            const py = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 1.2)));
            altar.style.setProperty('--fc-px', px.toFixed(3));
            altar.style.setProperty('--fc-py', py.toFixed(3));
        });
        stageEl.addEventListener('pointerleave', () => {
            altar.style.setProperty('--fc-px', '0');
            altar.style.setProperty('--fc-py', '0');
        });
    }

    let busy = false;
    if (tapBtn) {
        tapBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (busy) return;
            await ensureAudioReady().catch(() => false);
            const box = tapBtn.querySelector('.familiar-container');
            if (isEgg) {
                box?.classList.remove('fam-react-wiggle');
                void box?.offsetWidth;
                box?.classList.add('fam-react-wiggle');
                _playFamiliarSound('hatch');
                return;
            }
            const reaction = ['fam-react-spin', 'fam-react-hop', 'fam-react-wiggle'][Math.floor(Math.random() * 3)];
            box?.classList.remove('fam-react-spin', 'fam-react-hop', 'fam-react-wiggle', 'fam-live');
            void box?.offsetWidth;
            box?.classList.add(reaction);
            spawnBurst(altar, familiar.typeId, denTheme.burst);
            playFamiliarCall(familiar, studentId);
        });
    }

    if (needsHatchMoment && altar) {
        busy = true;
        ensureAudioReady().catch(() => false).finally(() => {
            runHatchMoment(altar, familiar, studentId, () => { busy = false; });
        });
        markFamiliarSeen(studentId, level);
    } else if (!isEgg) {
        ensureAudioReady().then(() => playFamiliarCall(familiar, studentId)).catch(() => {});
    }

    const saveBtn = overlay.querySelector('.fam-name-save');
    const nameInput = overlay.querySelector('.fam-name-input');
    if (saveBtn && nameInput) {
        const commitName = async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            try {
                await saveFamiliarName(studentId, nameInput.value);
                closeOverlay();
                setTimeout(() => openFamiliarStatsOverlay(studentId), 480);
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save';
            }
        };

        saveBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await commitName();
        });

        nameInput.addEventListener('keydown', async (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            e.stopPropagation();
            await commitName();
        });
    }
}

export async function saveFamiliarName(studentId, rawName) {
    const scoreData = state.get('allStudentScores').find((s) => s.id === studentId);
    if (!scoreData?.familiar || scoreData.familiar.state !== 'alive') {
        showToast('This familiar can be named after it hatches.', 'error');
        return;
    }

    const name = normalizeFamiliarName(rawName);
    const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
    await updateDoc(scoreRef, {
        'familiar.name': name
    });

    _patchLocalFamiliarState(studentId, (familiar) => ({ ...familiar, name }));
    showToast(name ? `Familiar named "${name}"!` : 'Familiar name cleared.', 'success');
}

// ─── QUIZ TRICK ───────────────────────────────────────────────────────────────

/** The trick this student's familiar can do right now, or null. */
export function getReadyFamiliarTrick(studentId) {
    const familiar = (state.get('allStudentScores') || []).find((s) => s.id === studentId)?.familiar;
    if (!familiar || !FAMILIAR_TYPES[familiar.typeId] || !isFamiliarTrickReady(familiar)) return null;
    const typeDef = FAMILIAR_TYPES[familiar.typeId];
    return { familiar, trick: FAMILIAR_TRICKS[familiar.typeId], name: getFamiliarDisplayName(familiar, typeDef) };
}

/** Spend this month's trick. Resolves true when it was saved. */
export async function useFamiliarTrick(studentId) {
    const ready = getReadyFamiliarTrick(studentId);
    if (!ready) return false;
    const month = trickMonthKey();
    try {
        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
        await updateDoc(scoreRef, { 'familiar.trickMonth': month });
        _patchLocalFamiliarState(studentId, (current) => ({ ...current, trickMonth: month }));
        playFamiliarCall(ready.familiar, studentId);
        return true;
    } catch (error) {
        console.warn('Familiar trick could not be saved:', error);
        return false;
    }
}

// ─── OPTIONS: FAMILIAR LOOK ───────────────────────────────────────────────────

export function renderFamiliarOptionsUi() {
    const select = document.getElementById('familiar-maintenance-student-select');
    const status = document.getElementById('familiar-maintenance-status');
    const button = document.getElementById('familiar-regenerate-btn');
    if (!select || !status || !button) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Select a student with a Familiar...</option>';

    const teacherClassIds = new Set((state.get('allTeachersClasses') || []).map((item) => item.id));
    const students = (state.get('allStudents') || [])
        .filter((student) => teacherClassIds.has(student.classId))
        .filter((student) => state.get('allStudentScores').some((score) => score.id === student.id && score.familiar))
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const student of students) {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = student.name;
        select.appendChild(option);
    }

    select.value = students.some((student) => student.id === currentValue) ? currentValue : '';
    updateFamiliarOptionsState();
}

export function updateFamiliarOptionsState() {
    const select = document.getElementById('familiar-maintenance-student-select');
    const status = document.getElementById('familiar-maintenance-status');
    const button = document.getElementById('familiar-regenerate-btn');
    if (!select || !status || !button) return;

    const studentId = select.value;
    if (!studentId) {
        status.textContent = 'Choose a student to see their Familiar and give it a new look.';
        button.disabled = true;
        return;
    }

    const student = state.get('allStudents').find((item) => item.id === studentId);
    const familiar = state.get('allStudentScores').find((item) => item.id === studentId)?.familiar;
    if (!student || !familiar) {
        status.textContent = 'No Familiar data found for this student.';
        button.disabled = true;
        return;
    }

    const typeDef = FAMILIAR_TYPES[familiar.typeId];
    const genome = getFamiliarGenome(familiar, studentId);
    const stageText = familiar.state === 'egg'
        ? 'Egg stage'
        : `${typeDef?.name || 'Familiar'} • ${typeDef?.levelNames?.[(familiar.level || 1) - 1] || `Level ${familiar.level || 1}`}`;

    status.textContent = `${student.name}: ${stageText}. Look: ${(genome?.traits || []).join(', ') || 'standard'}.`;
    button.disabled = false;
}

/** Give a familiar a fresh random look (same class, stage, stars and name). */
export async function handleRegenerateFamiliarFromOptions() {
    const select = document.getElementById('familiar-maintenance-student-select');
    const button = document.getElementById('familiar-regenerate-btn');
    if (!select || !button) return;

    const studentId = select.value;
    if (!studentId) {
        showToast('Choose a student first.', 'error');
        return;
    }
    const familiar = state.get('allStudentScores').find((item) => item.id === studentId)?.familiar;
    if (!familiar || !FAMILIAR_TYPES[familiar.typeId]) return;

    const student = state.get('allStudents').find((item) => item.id === studentId);
    button.disabled = true;
    try {
        const look = createFamiliarLook(familiar.typeId);
        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
        await updateDoc(scoreRef, { 'familiar.look': look });
        _patchLocalFamiliarState(studentId, (current) => ({ ...current, look }));
        showToast(`${student?.name || 'This student'}'s Familiar has a new look!`, 'success');
    } catch (error) {
        console.error('Familiar look change failed:', error);
        showToast(error.message || 'Could not change the Familiar look.', 'error');
    } finally {
        updateFamiliarOptionsState();
    }
}

function _patchLocalFamiliarState(studentId, patcher) {
    const scores = state.get('allStudentScores');
    const index = scores.findIndex((score) => score.id === studentId && score.familiar);
    if (index === -1) return;

    const nextScores = [...scores];
    nextScores[index] = {
        ...nextScores[index],
        familiar: patcher(scores[index].familiar)
    };
    state.setAllStudentScores(nextScores);
}

function getFamiliarDisplayName(familiar, typeDef) {
    return familiar?.name || typeDef?.name || 'Familiar';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
