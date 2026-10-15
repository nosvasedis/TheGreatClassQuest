// /features/familiars.js — Familiars: companion eggs that hatch and evolve as their hero earns stars.
// The creatures are hand-built SVG rigs from the Familiar Forge (features/familiarForge.mjs):
// 8 classes with 30 presets each, personal traits on top, idle motion, a voice, a hop when their
// hero earns a star, 5 forms (the trick in the Quiz of the Week arrives at the third, twice a
// month at the fifth) and Starbond marks after the Mythic form. A new form is announced with a
// notice and revealed in the Evolution Moment (features/familiarMoments.js); until it has been
// watched the familiar keeps its old form and glows, waiting.

import { db, doc, getDoc, updateDoc } from '../firebase.js';
import * as state from '../state.js';
import { playSound, playFamiliarVoice, ensureAudioReady } from '../audio.js';
import { showToast } from '../ui/effects.js';
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';
import {
    FAMILIAR_LEVEL_THRESHOLDS,
    FAMILIAR_MAX_LEVEL,
    FAMILIAR_STAGE_BOND,
    bondForLevel,
    createFamiliarBond,
    estimateLegacyBond,
    getFamiliarBond,
    getUnlockedFamiliarLevel,
    getFamiliarProgress,
    getFamiliarProgressPercent,
    getFamiliarStarbond,
    hasStoredBond,
    rollFamiliarBondOver
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
    familiarTricksPerMonth,
    familiarTricksUsed,
    familiarVoice,
    isFamiliarTrickReady,
    resolveFamiliarLook,
    trickMonthKey
} from './familiarForge.mjs';
import { PUBLIC_DATA_PATH as publicDataPath } from '../utils/tenant.mjs';

const familiarOps = new Map();
const FAMILIAR_SCHEMA_VERSION = 4;

export { FAMILIAR_LEVEL_THRESHOLDS, FAMILIAR_MAX_LEVEL, FAMILIAR_STAGE_BOND };

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
        desc: 'A fire-breathing dragon hatchling that grows into a sun-crowned elder dragon.',
        flavorHint: 'Daring • Fierce • Unstoppable',
        levelNames: ['Hatchling', 'Flame Drake', 'Inferno Dragon', 'Magma Wyrm', 'Sunfire Elder']
    },
    frostpaw: {
        id: 'frostpaw',
        name: 'Frostpaw',
        price: 35,
        eggIcon: '🥚',
        eggColor: '#3b82f6',
        eggAccent: '#bfdbfe',
        personality: 'Calm and wise — cool as the winter wind.',
        desc: 'An arctic fox spirit that grows a tail for every winter, up to a starfrost sovereign.',
        flavorHint: 'Serene • Wise • Graceful',
        levelNames: ['Ice Cub', 'Snow Fox', 'Frost Guardian', 'Aurora Kitsune', 'Starfrost Sovereign']
    },
    thornback: {
        id: 'thornback',
        name: 'Thornback',
        price: 30,
        eggIcon: '🥚',
        eggColor: '#16a34a',
        eggAccent: '#86efac',
        personality: 'Sturdy and loyal — as solid as the ancient oaks.',
        desc: 'A mossy forest toad that grows into a bear, a treant and, at last, a world-tree elder.',
        flavorHint: 'Strong • Loyal • Grounded',
        levelNames: ['Moss Toad', 'Bark Bear', 'Ancient Treant', 'Grove Warden', 'World-Tree Elder']
    },
    veilshade: {
        id: 'veilshade',
        name: 'Veilshade',
        price: 45,
        eggIcon: '🥚',
        eggColor: '#7c3aed',
        eggAccent: '#c4b5fd',
        personality: 'Mysterious and elusive — a whisper between worlds.',
        desc: 'A shadow wisp that grows into a cat of the night and, at last, a moonveil sphinx.',
        flavorHint: 'Mysterious • Swift • Ethereal',
        levelNames: ['Shadow Wisp', 'Phantom Cat', 'Void Stalker', 'Eclipse Lynx', 'Moonveil Sphinx']
    },
    sparkling: {
        id: 'sparkling',
        name: 'Sparkling',
        price: 50,
        eggIcon: '🥚',
        eggColor: '#f59e0b',
        eggAccent: '#fde68a',
        personality: 'Bright and joyful — a burst of sunrise magic.',
        desc: 'A radiant fairy-phoenix that blossoms into an eternal sunbird.',
        flavorHint: 'Radiant • Joyful • Inspiring',
        levelNames: ['Sun Sprite', 'Dawn Fairy', 'Solar Phoenix', 'Radiant Phoenix', 'Eternal Sunbird']
    },
    tidefin: {
        id: 'tidefin',
        name: 'Tidefin',
        price: 35,
        eggIcon: '🥚',
        eggColor: '#0284c7',
        eggAccent: '#7dd3fc',
        personality: 'Playful and kind — always ready to splash.',
        desc: 'A bubbly otter pup that grows fins, a coral crown and, at last, calls the tide.',
        flavorHint: 'Playful • Kind • Curious',
        levelNames: ['Bubble Pup', 'River Otter', 'Tide Otter', 'Coral Selkie', 'Tidecaller']
    },
    stormwing: {
        id: 'stormwing',
        name: 'Stormwing',
        price: 45,
        eggIcon: '🥚',
        eggColor: '#475569',
        eggAccent: '#fde047',
        personality: 'Sharp and brave — quick as a lightning flash.',
        desc: 'A puffball owlet that grows storm wings and becomes the mighty Thunderbird.',
        flavorHint: 'Clever • Brave • Electric',
        levelNames: ['Puffball Owlet', 'Storm Owl', 'Thunder Owl', 'Tempest Owl', 'Thunderbird']
    },
    gemshell: {
        id: 'gemshell',
        name: 'Gemshell',
        price: 40,
        eggIcon: '🥚',
        eggColor: '#0d9488',
        eggAccent: '#5eead4',
        personality: 'Patient and steady — slow and always shining.',
        desc: 'A pebble turtle whose shell grows crystals until it becomes a prism colossus.',
        flavorHint: 'Patient • Steady • Brilliant',
        levelNames: ['Pebble Tortle', 'Crystal Tortoise', 'Geode Guardian', 'Mountain Tortoise', 'Prism Colossus']
    }
};

/** The name of a form (1-5) for a familiar class. */
export function familiarStageName(typeId, level) {
    const typeDef = FAMILIAR_TYPES[typeId];
    if (!typeDef) return '';
    const lvl = Math.max(1, Math.min(FAMILIAR_MAX_LEVEL, Number(level) || 1));
    return typeDef.levelNames[lvl - 1] || `Form ${lvl}`;
}

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

export function buildFamiliarInitData(typeId, currentTotalStars, studentId = '', yearKey = null) {
    const variant = getFamiliarVariant(typeId, studentId);
    return {
        typeId,
        state: 'egg',
        level: 0,
        starsWhenPurchased: currentTotalStars,
        bond: createFamiliarBond(currentTotalStars, yearKey),
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
    const totalStars = Number(scoreData.totalStars) || 0;
    const yearKey = scoreData.activeSchoolYearKey || null;
    const migrationUpdates = _buildMigrationUpdates(familiar, studentId);
    const bondUpdate = await _buildBondUpdate(familiar, studentId, totalStars, yearKey);
    if (bondUpdate) migrationUpdates['familiar.bond'] = bondUpdate;
    if (Object.keys(migrationUpdates).length) {
        await updateDoc(scoreRef, migrationUpdates);
        familiar = _mergeFamiliar(familiar, migrationUpdates);
    }

    const currentLevel = familiar.state === 'alive' ? (familiar.level || 0) : 0;
    const unlockedLevel = getUnlockedFamiliarLevel(familiar, totalStars);
    const desiredLevel = Math.min(FAMILIAR_MAX_LEVEL, Math.max(currentLevel, unlockedLevel));
    const desiredState = desiredLevel > 0 || familiar.state === 'alive' ? 'alive' : 'egg';
    const levelChanged = (familiar.level || 0) !== desiredLevel || familiar.state !== desiredState;
    const progressionUpdates = {};

    if (desiredState === 'alive') {
        if (familiar.state !== 'alive') progressionUpdates['familiar.state'] = 'alive';
        if ((familiar.level || 0) !== desiredLevel) progressionUpdates['familiar.level'] = desiredLevel;
        if (typeof familiar.starsAtHatch !== 'number') {
            // Kept for older screens; the bond is what drives growth now.
            progressionUpdates['familiar.starsAtHatch'] = totalStars;
            progressionUpdates['familiar.starsWhenHatched'] = totalStars;
        }
    } else {
        if (familiar.state !== 'egg') progressionUpdates['familiar.state'] = 'egg';
        if ((familiar.level || 0) !== 0) progressionUpdates['familiar.level'] = 0;
    }

    if (Object.keys(progressionUpdates).length) {
        await updateDoc(scoreRef, progressionUpdates);
        familiar = _mergeFamiliar(familiar, progressionUpdates);
    }

    if (Object.keys(migrationUpdates).length || Object.keys(progressionUpdates).length) {
        _patchLocalFamiliarState(studentId, () => familiar);
    }

    if (levelChanged && options.announce && desiredLevel > 0) {
        _announceStageChange(studentId, familiar, desiredLevel);
    }
    return { level: desiredLevel };
}

function previousYearKey(yearKey) {
    const m = /^(\d{4})-(\d{4})$/.exec(String(yearKey || ''));
    return m ? `${Number(m[1]) - 1}-${Number(m[2]) - 1}` : null;
}

/** The hero's final star total for a closed school year, from the year-close snapshot. */
async function closedYearTotal(studentId, yearKey) {
    if (!yearKey) return null;
    try {
        const snap = await getDoc(doc(db, `${publicDataPath}/student_year_snapshots`, `${studentId}_${yearKey}`));
        if (!snap.exists()) return null;
        const total = Number(snap.data()?.totalStars);
        return Number.isFinite(total) ? total : null;
    } catch (error) {
        console.warn('Could not read last year\'s stars for the familiar:', error);
        return null;
    }
}

/**
 * Keep the familiar's bond (stars earned together) right across school years.
 * Returns the new bond to save, or null when nothing changes.
 */
async function _buildBondUpdate(familiar, studentId, totalStars, yearKey) {
    if (!familiar) return null;

    if (!hasStoredBond(familiar)) {
        // A familiar from before the bond: if the star total is now below the total at purchase,
        // the year was reset since the egg was bought, so last year's stars are looked up.
        const purchase = Number(familiar.starsWhenPurchased) || 0;
        let priorYear = {};
        if (totalStars < purchase) {
            const lastYear = await closedYearTotal(studentId, previousYearKey(yearKey));
            if (typeof lastYear === 'number' && lastYear >= purchase) {
                priorYear = { resetSincePurchase: true, priorYearTotal: lastYear };
            }
        }
        const bond = estimateLegacyBond(familiar, totalStars, priorYear);
        return createFamiliarBond(totalStars, yearKey, bond);
    }

    const stored = familiar.bond;
    if (yearKey && stored.year && stored.year !== yearKey) {
        // A new school year: bank what was earned together in the year that closed.
        const closedTotal = await closedYearTotal(studentId, stored.year);
        const rolled = rollFamiliarBondOver(stored, closedTotal, yearKey);
        // Never let a stage already reached slip back.
        const floor = bondForLevel(familiar.state === 'alive' ? familiar.level : 0);
        if (rolled.banked < floor) rolled.banked = floor;
        return rolled;
    }
    if (yearKey && !stored.year) return { ...stored, year: yearKey };
    return null;
}

let sweepTimer = null;

/**
 * Stars arrive from many places (games, oaths, boons, quests), not all of which call the
 * familiar check. Whenever the scores change, any familiar of this teacher's own students
 * that has earned a new stage (or still needs its bond saved) is brought up to date.
 */
export function scheduleFamiliarGrowthSweep() {
    if (typeof window === 'undefined') return;
    clearTimeout(sweepTimer);
    sweepTimer = setTimeout(runFamiliarGrowthSweep, 1200);
}

function runFamiliarGrowthSweep() {
    const userId = state.get('currentUserId');
    if (!userId) return;
    // Only stage changes written here are announced; familiars already waiting simply glow.
    const announce = true;
    const owned = new Set((state.get('allStudents') || [])
        .filter((s) => s.createdBy?.uid === userId)
        .map((s) => s.id));
    for (const score of state.get('allStudentScores') || []) {
        const familiar = score?.familiar;
        if (!familiar || !owned.has(score.id) || !FAMILIAR_TYPES[familiar.typeId]) continue;
        const stored = familiar.state === 'alive' ? (Number(familiar.level) || 0) : 0;
        const unlocked = getUnlockedFamiliarLevel(familiar, Number(score.totalStars) || 0);
        const bondStale = !hasStoredBond(familiar)
            || (score.activeSchoolYearKey && familiar.bond?.year !== score.activeSchoolYearKey);
        if (unlocked > stored || bondStale) {
            reconcileFamiliarLifecycle(score.id, { announce, source: 'sweep' });
        }
    }
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
    if (!student || !FAMILIAR_TYPES[familiar.typeId]) return;
    import('./familiarMoments.js')
        .then((m) => m.showFamiliarNotice(studentId, { ...familiar, level: newLevel }))
        .catch((e) => console.warn('Familiar notice failed:', e));
}

export function _playFamiliarSound(type) {
    try {
        playSound(type === 'hatch' ? 'familiar_hatch' : 'familiar_levelup');
    } catch (_) {}
}

// ─── RENDER HELPERS ───────────────────────────────────────────────────────────

const SIZE_PX = { small: 40, medium: 64, large: 128, xl: 168 };
const lastSeenStars = new Map(); // studentId -> { stars, hopUntil }
let lastHopCall = 0;

function scoreFor(studentId) {
    return (state.get('allStudentScores') || []).find((s) => s.id === studentId) || null;
}

/** True for a short moment after this student's star total went up, so every view of the familiar hops. */
function shouldHop(studentId) {
    if (!studentId) return false;
    const score = scoreFor(studentId);
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
    return getFamiliarProgressPercent(getFamiliarProgress(familiar, Number(scoreFor(studentId)?.totalStars) || 0));
}

/**
 * A new form that has not been revealed yet. While it waits, every view keeps showing the
 * form the class last saw (the egg, for a hatch) with a glow, until the Evolution Moment plays.
 * @returns {{ from: number, to: number }|null}
 */
export function getPendingFamiliarMoment(familiar) {
    if (!familiar || familiar.state !== 'alive' || typeof familiar.seenLevel !== 'number') return null;
    const level = Math.max(1, Math.min(FAMILIAR_MAX_LEVEL, Number(familiar.level) || 1));
    const seen = Math.max(0, Math.min(level, Number(familiar.seenLevel) || 0));
    return seen < level ? { from: seen, to: level } : null;
}

/** Starbond marks for a Mythic familiar (0 before the fifth form). */
export function getFamiliarStarbondMarks(familiar, studentId) {
    if (!familiar || familiar.state !== 'alive' || (Number(familiar.level) || 0) < FAMILIAR_MAX_LEVEL) return 0;
    return getFamiliarStarbond(familiar, Number(scoreFor(studentId)?.totalStars) || 0).marks;
}

/** Just the SVG for a familiar at a given stage (used by the Den, the Evolution Moment, the Parade and the Quiz). */
export function familiarArtSvg(familiar, studentId = '', { level = null, mode = 'full', egg = null, progress = null, starbond = null } = {}) {
    ensureFamiliarStyles();
    const genome = getFamiliarGenome(familiar, studentId);
    if (!genome) return '';
    const showEgg = egg ?? familiar.state === 'egg';
    const lite = isLite();
    const drawLevel = level || familiar.level || 1;
    const marks = starbond ?? (drawLevel >= FAMILIAR_MAX_LEVEL ? getFamiliarStarbondMarks(familiar, studentId) : 0);
    let svg = showEgg
        ? buildFamiliarEggSvg(genome, { progress: progress ?? eggProgressFor(familiar, studentId) })
        : buildFamiliarSvg(genome, { level: drawLevel, mode, starbond: marks });
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
    const pending = getPendingFamiliarMoment(familiar);
    const isEgg = familiar.state === 'egg' || pending?.from === 0;
    const displayName = getFamiliarDisplayName(familiar, typeDef);
    const stageLabel = familiar.state === 'egg' ? 'egg' : pending ? 'ready to evolve' : familiarStageName(familiar.typeId, familiar.level);
    const hop = shouldHop(studentId);
    const live = chip && !isEgg && !isLite() && !hop && !pending;
    const classes = ['familiar-container', 'enlargeable-familiar', live ? 'fam-live' : '', hop ? 'fam-hop' : '', pending ? 'fam-awaits' : ''].filter(Boolean).join(' ');
    const art = pending
        ? (pending.from === 0
            ? familiarArtSvg(familiar, studentId, { egg: true, progress: 100, mode: chip ? 'chip' : 'full' })
            : familiarArtSvg(familiar, studentId, { level: pending.from, mode: chip ? 'chip' : 'full' }))
        : familiarArtSvg(familiar, studentId, { mode: chip ? 'chip' : 'full' });
    ensureFamiliarTips();

    return `
        <div class="${classes}" data-student-id="${escapeHtml(studentId)}" data-fam-tip="1" role="button" tabindex="0"
             style="width:${px}px;height:${px}px;flex-shrink:0;--fam-glow:${typeDef.eggAccent};"
             aria-label="${escapeHtml(`${displayName}, ${stageLabel}. Open the Den.`)}">${art}${pending ? '<span class="fam-awaits__spark" aria-hidden="true"></span>' : ''}</div>`;
}

// ─── FAMILIAR TAG (hover card instead of the browser's title box) ─────────────

let tipsBound = false;
function ensureFamiliarTips() {
    if (tipsBound || typeof document === 'undefined') return;
    tipsBound = true;
    import('./familiarMoments.js').then((m) => m.bindFamiliarTips()).catch(() => { tipsBound = false; });
}

/** Everything the hover card and the notices need to describe a familiar. */
export function describeFamiliarForTip(studentId) {
    const score = scoreFor(studentId);
    const familiar = score?.familiar;
    const typeDef = FAMILIAR_TYPES[familiar?.typeId];
    if (!familiar || !typeDef) return null;
    const student = (state.get('allStudents') || []).find((s) => s.id === studentId);
    const genome = getFamiliarGenome(familiar, studentId);
    const total = Number(score.totalStars) || 0;
    const progress = getFamiliarProgress(familiar, total);
    const pending = getPendingFamiliarMoment(familiar);
    const level = familiar.state === 'alive' ? Math.max(1, Math.min(FAMILIAR_MAX_LEVEL, Number(familiar.level) || 1)) : 0;
    return {
        studentId,
        heroName: student?.name || '',
        firstName: String(student?.name || '').split(' ')[0],
        name: getFamiliarDisplayName(familiar, typeDef),
        typeName: typeDef.name,
        kind: genome?.preset?.label || typeDef.name,
        shiny: Boolean(genome?.shiny),
        level,
        stageName: level ? familiarStageName(familiar.typeId, level) : 'Egg',
        nextName: level < FAMILIAR_MAX_LEVEL ? familiarStageName(familiar.typeId, level + 1) : '',
        progress,
        percent: getFamiliarProgressPercent(progress),
        bond: getFamiliarBond(familiar, total),
        starbond: getFamiliarStarbond(familiar, total),
        pending,
        color: typeDef.eggColor,
        accent: typeDef.eggAccent,
        typeId: familiar.typeId,
        familiar
    };
}

// ─── FAMILIAR DEN (stats overlay) ─────────────────────────────────────────────

// Element sigil per species; the matching habitat colours live in styles/familiar_modal.css.
export const FAMILIAR_DEN_THEMES = {
    emberfang: { sigil: '🔥', element: 'Fire', burst: ['#fb923c', '#fde047', '#ef4444'] },
    frostpaw: { sigil: '❄️', element: 'Frost', burst: ['#e0f2fe', '#7dd3fc', '#ffffff'] },
    thornback: { sigil: '🌿', element: 'Wildwood', burst: ['#84cc16', '#4ade80', '#fde047'] },
    veilshade: { sigil: '🌙', element: 'Shadow', burst: ['#c084fc', '#818cf8', '#f0abfc'] },
    sparkling: { sigil: '☀️', element: 'Sunlight', burst: ['#fde047', '#fbbf24', '#fff7ed'] },
    tidefin: { sigil: '🌊', element: 'Tide', burst: ['#7dd3fc', '#e0f2fe', '#2dd4bf'] },
    stormwing: { sigil: '⚡', element: 'Storm', burst: ['#fde047', '#e2e8f0', '#93c5fd'] },
    gemshell: { sigil: '💎', element: 'Crystal', burst: ['#5eead4', '#f0abfc', '#fde68a'] }
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

export async function markFamiliarSeen(studentId, level) {
    _patchLocalFamiliarState(studentId, (current) => ({ ...current, seenLevel: level }));
    try {
        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
        await updateDoc(scoreRef, { 'familiar.seenLevel': level });
    } catch (error) {
        console.warn('Could not save that the familiar was met:', error);
    }
}

/**
 * Open the Den. When a new form is still waiting to be revealed, the Evolution Moment plays
 * first and the Den opens straight after it.
 */
export function openFamiliarStatsOverlay(studentId, { skipMoment = false } = {}) {
    const scoreData = scoreFor(studentId);
    const familiar = scoreData?.familiar;
    if (!familiar || !FAMILIAR_TYPES[familiar.typeId]) return;
    if (!skipMoment && getPendingFamiliarMoment(familiar)) {
        import('./familiarMoments.js')
            .then((m) => m.playFamiliarEvolution(studentId, { then: 'den' }))
            .catch((e) => {
                console.warn('Evolution Moment failed:', e);
                openFamiliarStatsOverlay(studentId, { skipMoment: true });
            });
        return;
    }
    openDen(studentId);
}

function openDen(studentId) {
    const scoreData = scoreFor(studentId);
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

    const info = describeFamiliarForTip(studentId);
    const isEgg = familiar.state === 'egg';
    const level = isEgg ? 0 : info.level;
    const progress = info.progress;
    const progressPercent = info.percent;
    const isMaxLevel = progress.phase === 'max';
    const genome = getFamiliarGenome(familiar, studentId);
    const spriteHtml = `<div class="familiar-container" style="width:${SIZE_PX.xl}px;height:${SIZE_PX.xl}px;">${familiarArtSvg(familiar, studentId, { mode: 'full' })}</div>`;
    const displayName = info.name;
    const speciesLabel = familiar.name ? `${typeDef.name} • ${genome?.preset?.label || ''}` : genome?.preset?.label || typeDef.name;
    const denTheme = FAMILIAR_DEN_THEMES[familiar.typeId] || { sigil: '✨', element: 'Arcane', burst: ['#fde68a'] };
    const trick = FAMILIAR_TRICKS[familiar.typeId];
    const trickReady = isFamiliarTrickReady(familiar);
    const tricksAllowed = familiarTricksPerMonth(familiar);
    const tricksLeft = Math.max(0, tricksAllowed - familiarTricksUsed(familiar));

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

    // Evolution path: Egg, then the five forms, each drawn as this very familiar. The next form
    // shows as a shadow; later ones stay a mystery.
    const stages = [{ name: 'Egg' }, ...typeDef.levelNames.map((name) => ({ name }))];
    const evolutionTrack = stages.map((stage, i) => {
        const status = i < level ? 'done' : i === level ? 'current' : i === level + 1 ? 'next' : 'locked';
        let art;
        if (status === 'locked') art = '<span class="fam-evo-mystery" aria-hidden="true">?</span>';
        else if (i === 0) art = `<span class="fam-evo-art">${familiarArtSvg(familiar, studentId, { egg: true, progress: isEgg ? progressPercent : 100, mode: 'chip' })}</span>`;
        else art = `<span class="fam-evo-art${status === 'next' ? ' fam-evo-art--shadow' : ''}">${familiarArtSvg(familiar, studentId, { egg: false, level: i, mode: 'chip', starbond: 0 })}</span>`;
        const label = status === 'locked' ? '???' : stage.name;
        return `
            <li class="fam-evo-node fam-evo-node--${status}" style="--evo-i:${i};">
                <span class="fam-evo-gem">${art}</span>
                <span class="fam-evo-name">${escapeHtml(label)}</span>
                ${i > 0 ? `<span class="fam-evo-need">${FAMILIAR_STAGE_BOND[i]}★</span>` : ''}
            </li>`;
    }).join('');
    const trackFill = Math.round((level / FAMILIAR_MAX_LEVEL) * 100);

    const progressSpan = Math.max(1, progress.max - progress.min);
    const progressDone = Math.max(0, Math.min(progressSpan, progress.current - progress.min));
    const progressVerb = progress.phase === 'egg' ? 'Hatches into' : 'Evolves into';
    const nextStageName = isEgg ? familiarStageName(familiar.typeId, 1) : info.nextName;

    const traits = (genome?.traits || []).slice(1)
        .map((t) => `<span class="fam-den-trait${t === 'Shiny' ? ' fam-den-trait--shiny' : ''}">${escapeHtml(t)}</span>`).join('');

    const starbond = info.starbond;
    const starbondPips = Array.from({ length: Math.max(5, Math.min(10, starbond.marks + 1)) }, (_, i) =>
        `<span class="fam-starbond-pip${i < starbond.marks ? ' is-lit' : ''}" aria-hidden="true">★</span>`).join('');

    const trickPanel = trick ? (level >= FAMILIAR_TRICK_LEVEL ? `
                    <section class="fam-den-panel fam-den-trick">
                        <span class="fam-stat-icon" aria-hidden="true">🪄</span>
                        <div>
                            <div class="fam-den-label">Trick · ${escapeHtml(trick.name)}</div>
                            <div class="fam-den-hint">${tricksAllowed > 1 ? 'Twice' : 'Once'} a month in the Quiz of the Week, ${escapeHtml(displayName)} ${escapeHtml(trick.verb)}.</div>
                            <div class="fam-den-trick-state ${trickReady ? 'is-ready' : ''}">${trickReady ? (tricksLeft > 1 ? `${tricksLeft} ready this month` : 'Ready this month') : 'Used this month. Back next month!'}</div>
                        </div>
                    </section>` : `
                    <section class="fam-den-panel fam-den-trick fam-den-trick--locked">
                        <span class="fam-stat-icon" aria-hidden="true">🪄</span>
                        <div>
                            <div class="fam-den-label">Trick at ${escapeHtml(typeDef.levelNames[FAMILIAR_TRICK_LEVEL - 1])}</div>
                            <div class="fam-den-hint">Learns ${escapeHtml(trick.name)}: once a month in the Quiz of the Week it ${escapeHtml(trick.verb)}. At ${escapeHtml(typeDef.levelNames[FAMILIAR_MAX_LEVEL - 1])}, twice a month.</div>
                        </div>
                    </section>`) : '';

    overlay.innerHTML = `
        <div class="fam-overlay-backdrop"></div>
        <div class="fam-modal-card fam-den relative w-full${level >= FAMILIAR_MAX_LEVEL ? ' fam-den--mythic' : ''}" data-fam-type="${escapeHtml(familiar.typeId)}"
             style="--fam-color:${typeDef.eggColor};--fam-accent:${typeDef.eggAccent || typeDef.eggColor};">
            <div class="fam-modal-scroll">
                <button type="button" class="fam-overlay-close" aria-label="Close">&times;</button>

                <div class="fam-den-stage">
                    <div class="fam-den-sky" aria-hidden="true"></div>
                    <div class="fam-den-rays" aria-hidden="true"></div>
                    <div class="fam-den-motes" aria-hidden="true">${motes}</div>
                    <div class="fam-den-sigil">
                        <span class="fam-den-sigil-icon" aria-hidden="true">${denTheme.sigil}</span>
                        <span>${escapeHtml(denTheme.element)}</span>
                    </div>
                    ${level ? `<div class="fam-den-form-badge">Form ${level} of ${FAMILIAR_MAX_LEVEL}</div>` : ''}
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
                        <div class="fam-modal-badge">${isEgg ? '🥚' : level >= FAMILIAR_MAX_LEVEL ? '👑' : '✨'} ${escapeHtml(info.stageName)}</div>
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
                        <div class="fam-den-max-body">
                            <div class="fam-den-max-title">Mythic Form · Starbond ${starbond.marks}</div>
                            <div class="fam-starbond-row">${starbondPips}</div>
                            <div class="fam-den-bar fam-den-bar--starbond">
                                <div class="fam-modal-progress-bar" style="--fam-progress:${Math.round((starbond.intoNext / starbond.step) * 100)}%;"></div>
                            </div>
                            <div class="fam-den-hint">${starbond.step - starbond.intoNext} more stars together for the next Starbond mark</div>
                        </div>
                    </section>`}

                    ${trickPanel}

                    <div class="fam-den-stats">
                        <div class="fam-modal-stat">
                            <span class="fam-stat-icon" aria-hidden="true">⭐</span>
                            <div>
                                <div class="fam-stat-value">${info.bond}</div>
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

    if (tapBtn) {
        tapBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
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

    if (!isEgg) {
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
                setTimeout(() => openDen(studentId), 480);
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
    const scoreData = scoreFor(studentId);
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
    const familiar = scoreFor(studentId)?.familiar;
    if (!familiar || !FAMILIAR_TYPES[familiar.typeId] || !isFamiliarTrickReady(familiar)) return null;
    const typeDef = FAMILIAR_TYPES[familiar.typeId];
    return {
        familiar,
        trick: FAMILIAR_TRICKS[familiar.typeId],
        name: getFamiliarDisplayName(familiar, typeDef),
        left: Math.max(0, familiarTricksPerMonth(familiar) - familiarTricksUsed(familiar))
    };
}

/** Spend one of this month's tricks. Resolves true when it was saved. */
export async function useFamiliarTrick(studentId) {
    const ready = getReadyFamiliarTrick(studentId);
    if (!ready) return false;
    const month = trickMonthKey();
    const uses = familiarTricksUsed(ready.familiar) + 1;
    try {
        const scoreRef = doc(db, `${publicDataPath}/student_scores`, studentId);
        await updateDoc(scoreRef, { 'familiar.trickMonth': month, 'familiar.trickUses': uses });
        _patchLocalFamiliarState(studentId, (current) => ({ ...current, trickMonth: month, trickUses: uses }));
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
