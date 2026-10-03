// features/fortunesWheel.js — Fortune's Wheel: segment catalog, spin logic, canvas renderer, effect application

import * as state from '../state.js';
import { db, doc, updateDoc } from '../firebase.js';
import { GUILD_IDS, getGuildById, getGuildEmblemUrl } from './guilds.js';
import { WHEEL_RARITY_WEIGHTS, WHEEL_RARITY_CONFIG, WHEEL_PRISMATIC_CONFIG, getRarityPalette } from '../constants.js';
import { saveFortuneWheelResult, hasSpunThisWeek } from '../db/actions/guilds.js';
import { getISOWeekKey, updateGuildScores, awardGloryToStudents } from './guildScoring.js';
import { applyWheelStudentEffects, applyClassQuestBonusDelta } from '../db/actions/fortuneWheelEffects.js';
import { checkBountyProgress } from '../db/actions/bounties.js';
import { checkAndRecordQuestCompletion } from '../db/actions/stars.js';
import { ensureAudioReady, playSound, playHeroFanfare } from '../audio.js';
import { evaluateWheelAvailability } from '../utils/fortuneWheelEligibility.mjs';
import { showAnimatedModal, hideModal } from '../ui/modals/base.js';

/** Compute relative luminance from a hex color for text contrast decisions */
function _luminance(hex) {
    const c = String(hex || '').replace('#', '');
    if (c.length < 6) return 0;
    const r = parseInt(c.substring(0, 2), 16) / 255;
    const g = parseInt(c.substring(2, 4), 16) / 255;
    const b = parseInt(c.substring(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEGMENT CATALOG
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The treasure wheel. Each segment has: id, emoji, label, description, rarity, category, effect.
 * Categories: 'glory' (Glory for the guild's members in this class), 'perk' (stars, gold,
 * artifacts, Team Quest), 'fun' (a moment plus a small gift), 'twist' (the harmless Trickster).
 *
 * Fair by design: Glory always goes to each guild member in the spinning class, so every child in
 * every guild gets the same chances each week, whatever the guild's size. Nothing on the wheel
 * takes stars, gold, artifacts or Glory away, and nothing multiplies future Glory.
 */
const ALL_SEGMENTS = [
    // ── Common ────────────────────────────────────────────────────────────────
    { id: 'glory_spark',       emoji: '⚜️', label: 'Spark of Glory',     description: '+1 Glory for each guildmate in this class.',            rarity: 'common',    category: 'glory', effect: (ctx) => classGlory(ctx, 1) },
    { id: 'anthem_power',      emoji: '🎵', label: 'Anthem Power',       description: 'Sing the anthem! +1 Glory for each guildmate here.',     rarity: 'common',    category: 'fun',   effect: (ctx) => classGlory(ctx, 1, 'The anthem rings out!') },
    { id: 'celebration',       emoji: '🎆', label: 'Celebration!',       description: 'Confetti! +1 Glory for each guildmate here.',             rarity: 'common',    category: 'fun',   effect: (ctx) => classGlory(ctx, 1, 'Confetti everywhere!') },
    { id: 'rainbow_bridge',    emoji: '🌈', label: 'Rainbow Bridge',     description: 'Unity! Every child in this class earns +1 Glory for their guild.', rarity: 'common', category: 'glory', effect: (ctx) => rainbowBridge(ctx, 1) },
    { id: 'gold_rush',         emoji: '🪙', label: 'Gold Rush',          description: '3 random guildmates get +15 gold each!',                 rarity: 'common',    category: 'perk',  effect: (ctx) => randomGold(ctx, 3, 15) },
    { id: 'aurum_sprinkle',    emoji: '🪙', label: 'Aurum Sprinkle',     description: '5 random guildmates get +5 gold each!',                  rarity: 'common',    category: 'perk',  effect: (ctx) => randomGold(ctx, 5, 5) },
    { id: 'copper_cache',      emoji: '🪙', label: 'Copper Cache',       description: '4 random guildmates get +8 gold each!',                  rarity: 'common',    category: 'perk',  effect: (ctx) => randomGold(ctx, 4, 8) },
    { id: 'star_shower',       emoji: '⭐', label: 'Star Shower',        description: '2 random guildmates get +1 star each!',                  rarity: 'common',    category: 'perk',  effect: (ctx) => randomStars(ctx, 2, 1) },
    { id: 'oracles_vision',    emoji: '🔮', label: "Oracle's Vision",   description: '2 random guildmates get +10 gold for their sharp eyes!', rarity: 'common',    category: 'fun',   effect: (ctx) => randomGold(ctx, 2, 10) },

    // ── Uncommon ──────────────────────────────────────────────────────────────
    { id: 'glory_surge',       emoji: '⚜️', label: 'Glory Surge',        description: '+2 Glory for each guildmate in this class.',            rarity: 'uncommon',  category: 'glory', effect: (ctx) => classGlory(ctx, 2) },
    { id: 'breeze_of_fortune', emoji: '🌬️', label: 'Breeze of Fortune',  description: '+1 Glory each, and 2 random guildmates get +10 gold.',   rarity: 'uncommon',  category: 'glory', effect: (ctx) => combo(ctx, [(c) => classGlory(c, 1), (c) => randomGold(c, 2, 10)], '+1 Glory for every guildmate here, and a breeze of gold for two of them!') },
    { id: 'treasure_chest',    emoji: '📦', label: 'Treasure Chest',     description: '+20 gold to 1 random guildmate and +1 Glory each.',     rarity: 'uncommon',  category: 'perk',  effect: (ctx) => combo(ctx, [(c) => randomGold(c, 1, 20), (c) => classGlory(c, 1)], 'A chest of +20 gold for one guildmate, and +1 Glory for everyone here!') },
    { id: 'carnival',          emoji: '🎪', label: 'Carnival',           description: '3 random guildmates get +5 gold, and +1 Glory each.',   rarity: 'uncommon',  category: 'fun',   effect: (ctx) => combo(ctx, [(c) => randomGold(c, 3, 5), (c) => classGlory(c, 1)], 'The Carnival arrives: gold for three, +1 Glory for everyone here!') },
    { id: 'focus_aura',        emoji: '🎯', label: 'Focus Aura',         description: '+1 star to 1 random guildmate!',                        rarity: 'uncommon',  category: 'perk',  effect: (ctx) => randomStars(ctx, 1, 1) },
    { id: 'spotlight',         emoji: '🌟', label: 'Spotlight',          description: '1 random guildmate receives a Legendary Artifact!',     rarity: 'uncommon',  category: 'perk',  effect: (ctx) => randomArtifact(ctx, 1) },
    { id: 'aurum_blossom',     emoji: '🪙', label: 'Aurum Blossom',      description: '3 random guildmates get +20 gold each!',                rarity: 'uncommon',  category: 'perk',  effect: (ctx) => randomGold(ctx, 3, 20) },
    { id: 'scholars_blessing', emoji: '📚', label: "Scholar's Blessing", description: '+5 Team Quest bonus stars (this month)!',               rarity: 'uncommon',  category: 'perk',  effect: (ctx) => classQuestBonus(ctx, 5) },
    { id: 'time_warp',         emoji: '⏰', label: 'Time Warp',          description: '+10 Team Quest bonus stars (this month)!',              rarity: 'uncommon',  category: 'perk',  effect: (ctx) => classQuestBonus(ctx, 10) },

    // ── Rare ──────────────────────────────────────────────────────────────────
    { id: 'glory_fountain',    emoji: '⚜️', label: 'Glory Fountain',     description: '+3 Glory for each guildmate in this class.',            rarity: 'rare',      category: 'glory', effect: (ctx) => classGlory(ctx, 3) },
    { id: 'star_burst',        emoji: '⭐', label: 'Star Burst',         description: '3 random guildmates get +1 star each!',                 rarity: 'rare',      category: 'perk',  effect: (ctx) => randomStars(ctx, 3, 1) },
    { id: 'star_storm',        emoji: '⭐', label: 'Star Storm',         description: '5 random guildmates get +1 star each!',                 rarity: 'rare',      category: 'perk',  effect: (ctx) => randomStars(ctx, 5, 1) },
    { id: 'treasury_overflow', emoji: '🪙', label: 'Treasury Overflow',  description: 'Every guildmate here gets +10 gold!',                    rarity: 'rare',      category: 'perk',  effect: (ctx) => randomGold(ctx, ctx.memberCount, 10) },
    { id: 'mystery_gift',      emoji: '🎒', label: 'Mystery Gift',       description: '1 random guildmate gets a free Legendary Artifact!',    rarity: 'rare',      category: 'perk',  effect: (ctx) => randomArtifact(ctx, 1) },
    { id: 'quest_surge',       emoji: '🗺️', label: 'Quest Surge',        description: '+15 Team Quest bonus stars (this month)!',              rarity: 'rare',      category: 'perk',  effect: (ctx) => classQuestBonus(ctx, 15) },
    { id: 'star_cascade',      emoji: '🌠', label: 'Star Cascade',       description: '4 random guildmates get +1 star and +10 gold each!',    rarity: 'rare',      category: 'perk',  effect: (ctx) => starsAndGold(ctx, 4, 1, 10) },

    // ── Epic ──────────────────────────────────────────────────────────────────
    { id: 'glory_storm',       emoji: '⚜️', label: 'Glory Storm',        description: '+4 Glory for each guildmate in this class!',            rarity: 'epic',      category: 'glory', effect: (ctx) => classGlory(ctx, 4) },
    { id: 'golden_tide',       emoji: '🌊', label: 'Golden Tide',        description: 'Every guildmate here gets +20 gold and +2 Glory!',      rarity: 'epic',      category: 'perk',  effect: (ctx) => combo(ctx, [(c) => randomGold(c, c.memberCount, 20), (c) => classGlory(c, 2)], 'A golden tide! Every guildmate here gets +20 gold and +2 Glory!') },
    { id: 'teachers_favor',    emoji: '🍎', label: "Teacher's Favor",   description: '1 random guildmate gets +2 stars and +30 gold!',        rarity: 'epic',      category: 'perk',  effect: (ctx) => teachersFavor(ctx) },
    { id: 'double_gift',       emoji: '🎒', label: 'Double Gift',        description: '2 random guildmates each get a Legendary Artifact!',    rarity: 'epic',      category: 'perk',  effect: (ctx) => randomArtifact(ctx, 2) },
    { id: 'gold_rush_extreme', emoji: '💰', label: 'Gold Rush Extreme',  description: 'Every guildmate here gets +50 gold!',                    rarity: 'epic',      category: 'perk',  effect: (ctx) => randomGold(ctx, ctx.memberCount, 50) },

    // ── Legendary ─────────────────────────────────────────────────────────────
    { id: 'star_supernova',    emoji: '⭐', label: 'Star Supernova',     description: 'Every guildmate here gets +1 star!',                    rarity: 'legendary', category: 'perk',  effect: (ctx) => randomStars(ctx, ctx.memberCount, 1) },
    { id: 'artifact_rain',     emoji: '🎁', label: 'Artifact Rain',      description: 'Every guildmate here gets a Mystery Artifact!',         rarity: 'legendary', category: 'perk',  effect: (ctx) => randomArtifact(ctx, ctx.memberCount) },
    { id: 'crown_of_stars',    emoji: '👑', label: 'Crown of Stars',     description: 'Every guildmate here gets +2 stars and +25 gold!',      rarity: 'legendary', category: 'perk',  effect: (ctx) => starsAndGold(ctx, ctx.memberCount, 2, 25) },

    // ── Mythic ────────────────────────────────────────────────────────────────
    { id: 'glory_miracle',     emoji: '👑', label: 'Glory Miracle',      description: '+5 Glory and +20 gold for each guildmate here!',        rarity: 'mythic',    category: 'glory', isPrismatic: true, effect: (ctx) => combo(ctx, [(c) => classGlory(c, 5), (c) => randomGold(c, c.memberCount, 20)], 'A Glory Miracle! Every guildmate here gets +5 Glory and +20 gold!') },
    { id: 'mythic_relic',      emoji: '🏆', label: 'Relic of Triumph',   description: '+30 Team Quest bonus stars & an Artifact for 5 guildmates!', rarity: 'mythic', category: 'perk', effect: (ctx) => mythicRelic(ctx) },
    { id: 'celestial_convergence', emoji: '✨', label: 'Celestial Convergence', description: '+20 Team Quest bonus, and every guildmate here gets +1 star & +30 gold!', rarity: 'mythic', category: 'perk', isPrismatic: true, effect: (ctx) => combo(ctx, [(c) => classQuestBonus(c, 20), (c) => starsAndGold(c, c.memberCount, 1, 30)], 'Celestial convergence! +20 Team Quest bonus stars, and every guildmate here gets +1 star and +30 gold!') },

    // ── Twist ─────────────────────────────────────────────────────────────────
    { id: 'trickster',         emoji: '🎭', label: 'Trickster',          description: 'What looks like a win... turns out to be nothing!',     rarity: 'cursed',    category: 'twist', effect: () => ({ gloryDelta: 0, description: 'The Trickster laughs! Nothing happened, and nothing was lost.' }) },
];

/** The catalog, for the guidebook and tests. */
export function getWheelCatalog() {
    return ALL_SEGMENTS.map(({ effect, ...seg }) => ({ ...seg }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// EFFECT IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** Runs several effects for one wedge and adds their outcomes together. */
async function combo(ctx, effects, description) {
    const total = { gloryDelta: 0, starsDelta: 0, goldDelta: 0, classQuestDelta: 0, artifactsGranted: 0, artifactsRemoved: 0, affectedStudents: [] };
    for (const run of effects) {
        const r = (await run(ctx)) || {};
        total.gloryDelta += Number(r.gloryDelta) || 0;
        total.starsDelta += Number(r.starsDelta) || 0;
        total.goldDelta += Number(r.goldDelta) || 0;
        total.classQuestDelta += Number(r.classQuestDelta) || 0;
        total.artifactsGranted += Number(r.artifactsGranted) || 0;
        total.affectedStudents = [...new Set([...total.affectedStudents, ...(r.affectedStudents || [])])];
    }
    return { ...total, description };
}

/** +perMember Glory for each guild member in this class, credited to each of them. */
async function classGlory(ctx, perMember, lead = '') {
    const members = ctx.guildStudents || [];
    if (!members.length) return { gloryDelta: 0, description: 'No guildmates in this class to receive the Glory.' };
    const byGuild = await awardGloryToStudents(members.map((s) => s.id), perMember, 'wheel_glory', {
        classId: ctx.classId,
        note: "Fortune's Wheel",
        idempotencyPrefix: ctx.spinKey ? `${ctx.spinKey}_glory` : null,
    });
    const gloryDelta = Math.round(Number(byGuild[ctx.guildId]) || 0);
    return {
        gloryDelta,
        affectedStudents: members.map((s) => s.id),
        description: `${lead ? `${lead} ` : ''}Each of the ${members.length} guildmate${members.length === 1 ? '' : 's'} here earns +${perMember} Glory (+${gloryDelta} for the guild).`,
    };
}

/** Rainbow Bridge: every child in the class earns Glory for their own guild. */
async function rainbowBridge(ctx, perMember) {
    const classStudents = (state.get('allStudents') || []).filter((s) => s.classId === ctx.classId && s.guildId);
    if (!classStudents.length) return { gloryDelta: 0, description: 'No guild members in this class yet.' };
    const byGuild = await awardGloryToStudents(classStudents.map((s) => s.id), perMember, 'wheel_rainbow_bridge', {
        classId: ctx.classId,
        note: "Fortune's Wheel: Rainbow Bridge",
        idempotencyPrefix: ctx.spinKey ? `${ctx.spinKey}_bridge` : null,
    });
    return {
        gloryDelta: Math.round(Number(byGuild[ctx.guildId]) || 0),
        description: `A rainbow bridge! All ${classStudents.length} guild members in this class earn +${perMember} Glory for their own guild.`,
    };
}

async function randomStars(ctx, count, amount) {
    const members = ctx.guildStudents || [];
    if (members.length === 0) return { gloryDelta: 0, description: 'No students were present for this guild.' };

    const outcome = await applyWheelStudentEffects({
        classId: ctx.classId,
        students: members,
        count,
        starsDelta: amount,
        note: 'Wheel star blessing'
    });

    if (outcome.affectedStudents?.length) {
        let gloryDelta = 0;
        for (const sid of outcome.affectedStudents) {
            const event = await updateGuildScores(sid, amount, 'wheel_star_blessing');
            gloryDelta += Number(event?.totalGloryDelta) || 0;
        }
        await checkBountyProgress(ctx.classId, amount * outcome.affectedStudents.length);
        await checkAndRecordQuestCompletion(ctx.classId).catch(() => {});
        outcome.gloryDelta = gloryDelta;
    }

    const affected = members.filter(s => outcome.affectedStudents.includes(s.id));
    const names = affected.map(s => s.name).join(', ');

    return {
        gloryDelta: Number(outcome.gloryDelta) || 0,
        ...outcome,
        description: count >= members.length
            ? `All ${members.length} guildmates here gain ${amount} star${amount === 1 ? '' : 's'}!`
            : `${names} ${affected.length > 1 ? 'each gain' : 'gains'} ${amount} star${amount === 1 ? '' : 's'}.`
    };
}

async function randomGold(ctx, count, amount) {
    const members = ctx.guildStudents || [];
    if (members.length === 0) return { gloryDelta: 0, description: 'No students were present for this guild.' };

    const outcome = await applyWheelStudentEffects({
        classId: ctx.classId,
        students: members,
        count,
        goldDelta: amount,
        note: 'Wheel gold blessing'
    });

    const affected = members.filter(s => outcome.affectedStudents.includes(s.id));
    const names = affected.map(s => s.name).join(', ');

    return {
        gloryDelta: 0,
        ...outcome,
        description: count >= members.length
            ? `All guildmates here gain ${amount} gold!`
            : `${names} ${affected.length > 1 ? 'each gain' : 'gains'} ${amount} gold.`
    };
}

async function starsAndGold(ctx, count, stars, gold) {
    const s = await randomStars(ctx, count, stars);
    const picked = (ctx.guildStudents || []).filter((st) => (s.affectedStudents || []).includes(st.id));
    const g = picked.length
        ? await applyWheelStudentEffects({ classId: ctx.classId, students: picked, count: picked.length, goldDelta: gold, note: 'Wheel gold blessing' })
        : { goldDelta: 0, affectedStudents: [] };
    return {
        gloryDelta: s.gloryDelta || 0,
        starsDelta: s.starsDelta || 0,
        goldDelta: g.goldDelta || 0,
        affectedStudents: [...new Set([...(s.affectedStudents || []), ...(g.affectedStudents || [])])],
        description: count >= (ctx.guildStudents || []).length
            ? `Every guildmate here gets +${stars} star${stars === 1 ? '' : 's'} and +${gold} gold!`
            : `${picked.map((st) => st.name).join(', ')} each get +${stars} star${stars === 1 ? '' : 's'} and +${gold} gold!`,
    };
}

async function randomArtifact(ctx, count) {
    const members = ctx.guildStudents || [];
    if (members.length === 0) return { gloryDelta: 0, description: 'No students were present for this guild.' };

    const outcome = await applyWheelStudentEffects({
        classId: ctx.classId,
        students: members,
        count,
        artifactsGrantCount: 1,
        note: 'Wheel artifact blessing'
    });

    const affected = members.filter(s => outcome.affectedStudents.includes(s.id));
    const names = affected.map(s => s.name).join(', ');

    return {
        gloryDelta: 0,
        ...outcome,
        description: count >= members.length
            ? `All guildmates here receive an artifact!`
            : `${names} ${affected.length > 1 ? 'each receive' : 'receives'} an artifact!`
    };
}

async function teachersFavor(ctx) {
    const members = ctx.guildStudents || [];
    if (members.length === 0) return { gloryDelta: 0, description: 'No students to receive favor.' };
    const outcome = await applyWheelStudentEffects({
        classId: ctx.classId,
        students: members,
        count: 1,
        starsDelta: 2,
        goldDelta: 30,
        note: 'Teacher’s Favor'
    });

    const sid = outcome.affectedStudents?.[0];
    let gloryDelta = 0;
    if (sid) {
        const event = await updateGuildScores(sid, 2, 'wheel_teachers_favor');
        gloryDelta = Number(event?.totalGloryDelta) || 0;
        await checkBountyProgress(ctx.classId, 2);
        await checkAndRecordQuestCompletion(ctx.classId).catch(() => {});
    }

    const student = members.find(s => s.id === sid);
    return {
        gloryDelta,
        ...outcome,
        description: student ? `${student.name} receives +2 stars and +30 gold from the Teacher's Favor!` : `A student receives +2 stars and +30 gold from the Teacher's Favor!`
    };
}

async function classQuestBonus(ctx, delta) {
    const outcome = await applyClassQuestBonusDelta(ctx.classId, delta, 'Wheel quest effect');
    if (outcome.classQuestDelta) await checkAndRecordQuestCompletion(ctx.classId).catch(() => {});
    return {
        gloryDelta: 0,
        ...outcome,
        description: `The class gains +${outcome.classQuestDelta} Team Quest bonus star${outcome.classQuestDelta === 1 ? '' : 's'} this month!`
    };
}

async function mythicRelic(ctx) {
    const quest = await applyClassQuestBonusDelta(ctx.classId, 30, 'Relic of Triumph');
    const artifacts = await applyWheelStudentEffects({
        classId: ctx.classId,
        students: ctx.guildStudents || [],
        count: 5,
        artifactsGrantCount: 1,
        note: 'Relic of Triumph artifacts'
    });

    if (quest.classQuestDelta) await checkAndRecordQuestCompletion(ctx.classId).catch(() => {});

    return {
        gloryDelta: 0,
        classQuestDelta: quest.classQuestDelta || 0,
        affectedStudents: artifacts.affectedStudents || [],
        artifactsGranted: artifacts.artifactsGranted || 0,
        artifactsRemoved: 0,
        starsDelta: 0,
        goldDelta: 0,
        description: `The Relic of Triumph surges: +${quest.classQuestDelta || 0} Team Quest bonus stars, plus artifacts for ${artifacts.affectedStudents?.length || 0} students!`
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEGMENT SELECTION
// ═══════════════════════════════════════════════════════════════════════════════

/** Fisher-Yates shuffle. */
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

const RARE_PLUS = ['rare', 'epic', 'legendary', 'mythic'];

/**
 * Generate 20 wheel segments for a spin, weighted by rarity.
 * A favored wheel (Fortune's Favor from the Mystic Market) has no common wedges and no Trickster.
 * @param {string} leagueLevel - e.g. 'Junior A', 'B', 'C' (every league draws from the same catalog)
 * @param {{ favored?: boolean }} options
 * @returns {Array} 20 segments
 */
export function generateWheelSegments(leagueLevel, { favored = false } = {}) {
    const pool = favored
        ? ALL_SEGMENTS.filter((s) => s.rarity !== 'common' && s.rarity !== 'cursed')
        : ALL_SEGMENTS;
    const caps = favored
        ? { cursed: 0, mythic: 1, epic: 4, legendary: 2 }
        : { cursed: 1, mythic: 1, epic: 2, legendary: 1 };
    const size = Math.min(20, pool.length);

    const weighted = [];
    for (const seg of pool) {
        const weight = WHEEL_RARITY_WEIGHTS[seg.rarity] || 10;
        for (let i = 0; i < weight; i++) weighted.push(seg);
    }

    const selected = new Map();
    const counts = {};
    let attempts = 0;
    while (selected.size < size && attempts < 2000) {
        attempts++;
        const candidate = weighted[Math.floor(Math.random() * weighted.length)];
        if (selected.has(candidate.id)) continue;
        const cap = caps[candidate.rarity];
        if (cap !== undefined && (counts[candidate.rarity] || 0) >= cap) continue;
        selected.set(candidate.id, { ...candidate, paletteIndex: Math.floor(Math.random() * 3) });
        counts[candidate.rarity] = (counts[candidate.rarity] || 0) + 1;
    }

    // Always at least one rare-or-better wedge to hope for.
    if (![...selected.values()].some((s) => RARE_PLUS.includes(s.rarity))) {
        const rares = pool.filter((s) => s.rarity === 'rare');
        const replaceable = [...selected.values()].filter((s) => s.rarity === 'common' || s.rarity === 'uncommon');
        if (rares.length && replaceable.length) {
            selected.delete(replaceable[0].id);
            const rare = rares[Math.floor(Math.random() * rares.length)];
            selected.set(rare.id, { ...rare, paletteIndex: 0 });
        }
    }

    return shuffleArray([...selected.values()]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPIN LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine the winning segment index (cryptographic-quality random, animation-independent).
 * @param {number} segmentCount
 * @returns {number} winning index
 */
export function spinWheel(segmentCount) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % segmentCount;
}

/**
 * Check if Fortune's Wheel can be spun this week for a class.
 * @param {string} classId
 * @returns {Promise<boolean>} true if can spin
 */
export async function canSpinThisWeek(classId) {
    if (!classId) return false;
    const alreadySpun = await hasSpunThisWeek(classId);
    if (alreadySpun) return false;

    const availability = evaluateWheelAvailability(classId, {
        now: new Date(),
        allSchoolClasses: state.get('allSchoolClasses') || [],
        allScheduleOverrides: state.get('allScheduleOverrides') || [],
        schoolHolidayRanges: state.get('schoolHolidayRanges') || [],
        classEndDates: state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {},
        alreadySpun,
    });

    return availability.allowed;
}

/** Guild members in a class whose Fortune's Favor (Mystic Market) is waiting for the wheel. */
function _favorHolders(guildId, classId) {
    const scores = new Map((state.get('allStudentScores') || []).map((sc) => [sc.id, sc]));
    return (state.get('allStudents') || [])
        .filter((s) => s.guildId === guildId && s.classId === classId && scores.get(s.id)?.fortuneFavorArmed)
        .map((s) => s.id);
}

/** True when this guild's wheel in this class is gilded by a Fortune's Favor. */
export function isGuildWheelFavored(guildId, classId) {
    return _favorHolders(guildId, classId).length > 0;
}

async function _spendFortuneFavor(guildId, classId) {
    const holder = _favorHolders(guildId, classId)[0];
    if (!holder) return;
    try {
        await updateDoc(doc(db, 'artifacts/great-class-quest/public/data/student_scores', holder), { fortuneFavorArmed: false });
        state.setAllStudentScores((state.get('allStudentScores') || []).map((sc) => (sc.id === holder ? { ...sc, fortuneFavorArmed: false } : sc)));
    } catch (err) {
        console.warn("Fortune's Favor could not be spent:", err);
    }
}

/**
 * Execute a full Fortune's Wheel spin for one guild.
 * @param {string} guildId
 * @param {object} segment - The winning segment
 * @param {string} classId - For student targeting
 * @param {{ favored?: boolean }} options - the wheel was gilded by a Fortune's Favor
 * @returns {Promise<object>} result with gloryDelta, description, affectedStudents, etc.
 */
export async function applyWheelResult(guildId, segment, classId, { favored = false } = {}) {
    const allStudents = state.get('allStudents') || [];
    const guildStudents = allStudents.filter(s => s.guildId === guildId && s.classId === classId);

    const ctx = {
        guildId,
        classId,
        guildStudents,
        memberCount: guildStudents.length || 1,
        // One spin per guild per class per week, so its Glory is written exactly once.
        spinKey: `wheel_${classId}_${getISOWeekKey()}_${guildId}`,
    };

    try {
        const result = await segment.effect(ctx);
        if (favored) await _spendFortuneFavor(guildId, classId);

        return {
            guildId,
            segmentId: segment.id,
            segmentLabel: `${segment.emoji} ${segment.label}`,
            segmentDescription: segment.description,
            rarity: segment.rarity,
            favored: Boolean(favored),
            applied: true,
            ...(result || {}),
        };
    } catch (err) {
        console.error(`Wheel effect failed for ${segment.id}:`, err);
        return {
            guildId,
            segmentId: segment.id,
            segmentLabel: `${segment.emoji} ${segment.label}`,
            segmentDescription: segment.description,
            rarity: segment.rarity,
            applied: false,
            gloryDelta: 0,
            description: `Effect could not be applied${err?.message ? `: ${err.message}` : '.'}`,
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANVAS WHEEL RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

const TAU = Math.PI * 2;

// ─── Offscreen wheel cache (pre-rendered static wheel for fast blitting) ────
let _wheelCache = { canvas: null, key: '', size: 0 };

/**
 * Generate a cache key from segments + guildDef + size to detect when re-render is needed.
 */
function _wheelCacheKey(segments, guildDef, size) {
    // Use segment labels+rarities + guild primary + size as the identity key
    let k = `${size}`;
    for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        k += `|${s.label}:${s.rarity}:${s.emoji}:${s.paletteIndex || 0}:${s.isPrismatic ? 1 : 0}`;
    }
    k += `#g:${guildDef?.primary || ''}:${guildDef?.secondary || ''}:${guildDef?.glow || ''}`;
    return k;
}

/** Wheel face radius for a canvas of `size` px — leaves room for the lacquered rim. */
function _wheelRadius(size) {
    return size / 2 - Math.max(10, size * 0.052);
}

function _hexToRgb(hex) {
    const c = String(hex || '').replace('#', '');
    if (c.length < 6) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(c.substring(0, 2), 16), g: parseInt(c.substring(2, 4), 16), b: parseInt(c.substring(4, 6), 16) };
}

/** Mix two hex colors (t = 0 → a, t = 1 → b), returned as an rgb() string. */
function _mixHex(a, b, t) {
    const x = _hexToRgb(a);
    const y = _hexToRgb(b);
    const m = (p, q) => Math.round(p + (q - p) * t);
    return `rgb(${m(x.r, y.r)}, ${m(x.g, y.g)}, ${m(x.b, y.b)})`;
}

function _wedgePath(ctx, radius, startAngle, endAngle) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, startAngle, endAngle);
    ctx.closePath();
}

/** Four-point gilt star (the rim inlay), rotated to face outward. */
function _giltStar(ctx, x, y, r, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
        const rr = k % 2 === 0 ? r : r * 0.32;
        const a = (k * Math.PI) / 4;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = '#fbe7a6';
    ctx.shadowColor = 'rgba(251, 231, 166, 0.8)';
    ctx.shadowBlur = r * 1.2;
    ctx.fill();
    ctx.restore();
}

function _giltDot(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#fffdf2');
    g.addColorStop(0.45, '#fbe7a6');
    g.addColorStop(1, '#9a7128');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
}

/**
 * Render the full static wheel (rim, wedges, pegs, text, gilt hub, sheen)
 * centered at the CURRENT origin. Caller must translate to (center, center) first.
 * Styled as a celestial wheel of fate: midnight enamel rim with gilt bands and
 * inlaid stars, jewel-toned rarity wedges split by gilt spokes, and peg studs
 * that the pointer ticks against.
 */
function _renderStaticWheelAtOrigin(ctx, size, segments, guildDef) {
    const radius = _wheelRadius(size);
    const segCount = segments.length;
    const segAngle = TAU / segCount;
    const rimWidth = Math.max(8, size * 0.042);
    const rimMid = radius + rimWidth / 2;

    // Soft drop shadow under the whole wheel
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.03;
    ctx.shadowOffsetY = size * 0.012;
    ctx.beginPath();
    ctx.arc(0, 0, radius + rimWidth, 0, TAU);
    ctx.fillStyle = '#07051a';
    ctx.fill();
    ctx.restore();

    // Midnight enamel rim
    ctx.beginPath();
    ctx.arc(0, 0, rimMid, 0, TAU);
    const enamelGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    enamelGrad.addColorStop(0, '#3b2d8a');
    enamelGrad.addColorStop(0.3, '#271d63');
    enamelGrad.addColorStop(0.55, '#1b1449');
    enamelGrad.addColorStop(0.8, '#0f0b2e');
    enamelGrad.addColorStop(1, '#271d63');
    ctx.strokeStyle = enamelGrad;
    ctx.lineWidth = rimWidth;
    ctx.stroke();

    // Gilt bands on both edges of the rim
    const giltGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    giltGrad.addColorStop(0, '#fffdf2');
    giltGrad.addColorStop(0.35, '#e8c46a');
    giltGrad.addColorStop(0.65, '#9a7128');
    giltGrad.addColorStop(1, '#fbe7a6');
    ctx.strokeStyle = giltGrad;
    ctx.lineWidth = Math.max(2, size * 0.008);
    ctx.beginPath();
    ctx.arc(0, 0, radius + rimWidth - ctx.lineWidth / 2, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = Math.max(2, size * 0.007);
    ctx.beginPath();
    ctx.arc(0, 0, radius + ctx.lineWidth / 2, 0, TAU);
    ctx.stroke();

    // Gilt stars set into the rim
    const starCount = segCount * 2;
    const starR = Math.max(2.5, size * 0.011);
    for (let i = 0; i < starCount; i++) {
        const a = (i + 0.5) * (TAU / starCount);
        _giltStar(ctx, Math.cos(a) * rimMid, Math.sin(a) * rimMid, i % 2 ? starR * 0.65 : starR, a);
    }

    // Wheel face backing
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fillStyle = '#140c24';
    ctx.fill();

    const bezelRadius = radius - Math.max(3, size * 0.011);
    const bezelWidth = Math.max(4, size * 0.016);

    for (let i = 0; i < segCount; i++) {
        const seg = segments[i];
        const startAngle = i * segAngle;
        const endAngle = startAngle + segAngle;
        const rarityConf = getRarityPalette(seg.rarity, seg.paletteIndex);
        const isPrismatic = seg.isPrismatic === true;

        // Jewel-toned wedge
        _wedgePath(ctx, radius, startAngle, endAngle);
        if (isPrismatic) {
            const prismaticColors = WHEEL_PRISMATIC_CONFIG.colors;
            if (typeof ctx.createConicGradient === 'function') {
                const prismaticGrad = ctx.createConicGradient(startAngle, 0, 0);
                for (let ci = 0; ci < prismaticColors.length; ci++) {
                    prismaticGrad.addColorStop(ci / prismaticColors.length, prismaticColors[ci]);
                }
                prismaticGrad.addColorStop(1, prismaticColors[0]);
                ctx.fillStyle = prismaticGrad;
            } else {
                const fallbackGrad = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
                fallbackGrad.addColorStop(0, '#083344');
                fallbackGrad.addColorStop(0.6, '#083344');
                fallbackGrad.addColorStop(1, '#22d3ee');
                ctx.fillStyle = fallbackGrad;
            }
        } else {
            const gradient = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
            gradient.addColorStop(0, _mixHex(rarityConf.bg, '#07051a', 0.45));
            gradient.addColorStop(0.5, rarityConf.bg);
            gradient.addColorStop(0.88, _mixHex(rarityConf.bg, rarityConf.color, 0.55));
            gradient.addColorStop(1, _mixHex(rarityConf.bg, rarityConf.color, 0.8));
            ctx.fillStyle = gradient;
        }
        ctx.fill();

        // Alternate wedges get a faint lift so neighbours of one rarity still read apart
        if (i % 2 === 0) {
            _wedgePath(ctx, radius, startAngle, endAngle);
            ctx.fillStyle = 'rgba(255, 244, 214, 0.05)';
            ctx.fill();
        }

        // Rarity bezel: the coloured band just inside the rim
        ctx.beginPath();
        ctx.arc(0, 0, bezelRadius, startAngle, endAngle);
        ctx.strokeStyle = isPrismatic ? 'rgba(255, 255, 255, 0.85)' : rarityConf.color;
        ctx.lineWidth = bezelWidth;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, bezelRadius - bezelWidth / 2, startAngle, endAngle);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = Math.max(1, size * 0.003);
        ctx.stroke();

        // Emoji icon near the rim
        ctx.save();
        ctx.rotate(startAngle + segAngle / 2);

        const emoji = seg.emoji || '';
        const label = seg.label || '';
        const maxTextWidth = radius * 0.42;

        const bgLum = _luminance(rarityConf.bg);
        const textColor = bgLum > 0.45 ? 'rgba(42, 23, 12, 0.92)' : '#fff7e6';
        const shadowColor = bgLum > 0.45 ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.75)';

        const emojiSize = Math.max(14, Math.floor(size / 26));
        ctx.font = `${emojiSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        ctx.shadowBlur = size * 0.006;
        ctx.shadowOffsetY = size * 0.002;
        const emojiRadius = radius - Math.max(20, size * 0.068);
        ctx.fillText(emoji, emojiRadius, 0);

        // Label text, reading outward from the hub
        const fontSize = Math.max(9, Math.floor(size / 40));
        ctx.font = `600 ${fontSize}px "Fredoka", "Fredoka One", "Trebuchet MS", system-ui, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = size * 0.006;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = size * 0.002;

        const lines = wrapText(ctx, label, maxTextWidth);
        const lineHeight = fontSize * 1.12;
        const totalTextHeight = lines.length * lineHeight;
        const textStartRadius = radius - Math.max(32, size * 0.115);
        const startY = -(totalTextHeight / 2) + (lineHeight / 2);

        for (let j = 0; j < lines.length; j++) {
            ctx.fillText(lines[j], textStartRadius, startY + (j * lineHeight));
        }

        ctx.restore();
    }

    // Gilt spokes between wedges
    const spokeGrad = ctx.createRadialGradient(0, 0, radius * 0.25, 0, 0, radius);
    spokeGrad.addColorStop(0, 'rgba(154, 113, 40, 0.9)');
    spokeGrad.addColorStop(0.6, 'rgba(251, 231, 166, 0.95)');
    spokeGrad.addColorStop(1, 'rgba(232, 196, 106, 1)');
    ctx.strokeStyle = spokeGrad;
    ctx.lineWidth = Math.max(1.5, size / 230);
    ctx.lineCap = 'round';
    for (let i = 0; i < segCount; i++) {
        const a = i * segAngle;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * radius * 0.25, Math.sin(a) * radius * 0.25);
        ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
        ctx.stroke();
    }

    // Peg studs the pointer ticks against — one per wedge boundary
    const pegRadius = Math.max(2.5, size * 0.011);
    for (let i = 0; i < segCount; i++) {
        const a = i * segAngle;
        _giltDot(ctx, Math.cos(a) * bezelRadius, Math.sin(a) * bezelRadius, pegRadius);
    }

    // Lamp-light sheen from the upper left, dusk on the lower right
    const sheen = ctx.createRadialGradient(-radius * 0.4, -radius * 0.5, radius * 0.05, -radius * 0.1, -radius * 0.15, radius * 1.15);
    sheen.addColorStop(0, 'rgba(255, 244, 214, 0.16)');
    sheen.addColorStop(0.45, 'rgba(255, 244, 214, 0.04)');
    sheen.addColorStop(1, 'rgba(10, 5, 20, 0.22)');
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fillStyle = sheen;
    ctx.fill();

    // Gilt hub (the guild emblem orb sits on top of it in the DOM)
    const innerRadius = radius * 0.27;
    const primary = guildDef?.primary || '#7c3aed';

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = size * 0.025;
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius, 0, TAU);
    const hubGrad = ctx.createRadialGradient(-innerRadius * 0.35, -innerRadius * 0.4, innerRadius * 0.1, 0, 0, innerRadius);
    hubGrad.addColorStop(0, '#fffdf2');
    hubGrad.addColorStop(0.35, '#fbe7a6');
    hubGrad.addColorStop(0.75, '#e8c46a');
    hubGrad.addColorStop(1, '#9a7128');
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, innerRadius, 0, TAU);
    ctx.strokeStyle = '#5c4216';
    ctx.lineWidth = Math.max(1.5, size * 0.004);
    ctx.stroke();

    // Guild-coloured inlay ring
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius * 0.86, 0, TAU);
    ctx.strokeStyle = primary;
    ctx.lineWidth = Math.max(3, size * 0.011);
    ctx.stroke();

    // Hub rivets
    const hubRivets = 10;
    for (let i = 0; i < hubRivets; i++) {
        const a = (i / hubRivets) * TAU;
        _giltDot(ctx, Math.cos(a) * innerRadius * 0.95, Math.sin(a) * innerRadius * 0.95, Math.max(1.2, size * 0.0045));
    }

    // Dark well behind the emblem orb
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius * 0.74, 0, TAU);
    const wellGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, innerRadius * 0.74);
    wellGrad.addColorStop(0, _mixHex(primary, '#000000', 0.35));
    wellGrad.addColorStop(1, _mixHex(primary, '#000000', 0.75));
    ctx.fillStyle = wellGrad;
    ctx.fill();
}

/**
 * Get or create the offscreen canvas with the pre-rendered static wheel.
 * Returns null if offscreen canvas is not available.
 */
function _getWheelOffscreen(segments, size, guildDef) {
    const key = _wheelCacheKey(segments, guildDef, size);
    if (_wheelCache.canvas && _wheelCache.key === key && _wheelCache.size === size) {
        return _wheelCache.canvas;
    }
    // Create or reuse offscreen canvas
    let offCanvas = _wheelCache.canvas;
    if (!offCanvas || offCanvas.width !== size || offCanvas.height !== size) {
        if (typeof OffscreenCanvas !== 'undefined') {
            offCanvas = new OffscreenCanvas(size, size);
        } else {
            offCanvas = document.createElement('canvas');
            offCanvas.width = size;
            offCanvas.height = size;
        }
    }
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return null;
    offCtx.clearRect(0, 0, size, size);
    offCtx.save();
    offCtx.translate(size / 2, size / 2);
    _renderStaticWheelAtOrigin(offCtx, size, segments, guildDef);
    offCtx.restore();
    _wheelCache = { canvas: offCanvas, key, size };
    return offCanvas;
}

/**
 * Invalidate the offscreen wheel cache (call when segments or size change).
 */
export function invalidateWheelCache() {
    _wheelCache = { canvas: null, key: '', size: 0 };
}

/**
 * Wrap text to fit within a given max width
 */
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

/**
 * Draw the wheel on a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {Array} segments - 20 segments
 * @param {number} rotationAngle - Current rotation in radians
 * @param {object} guildDef - Guild definition for center emblem colors
 * @param {number|null} highlightIndex - Optional segment index to glow
 */
export function drawWheel(canvas, segments, rotationAngle, guildDef, highlightIndex = null) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    const center = size / 2;
    const radius = _wheelRadius(size);
    const segCount = segments.length;
    const segAngle = TAU / segCount;

    ctx.clearRect(0, 0, size, size);

    // Blit the pre-rendered static wheel (rim, wedges, text, hub, sheen) with rotation
    const offscreen = _getWheelOffscreen(segments, size, guildDef);
    if (offscreen) {
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(rotationAngle);
        ctx.drawImage(offscreen, -center, -center, size, size);
        ctx.restore();
    } else {
        // Fallback: render directly with rotation (for browsers where getContext fails)
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(rotationAngle);
        _renderStaticWheelAtOrigin(ctx, size, segments, guildDef);
        ctx.restore();
    }

    // Winner spotlight (only drawn on the final revealed frame): dim every other
    // wedge, then gild the winning one.
    if (Number.isInteger(highlightIndex) && highlightIndex >= 0 && highlightIndex < segCount) {
        const seg = segments[highlightIndex];
        const rarityConf = getRarityPalette(seg?.rarity, seg?.paletteIndex);
        const startAngle = highlightIndex * segAngle;
        const endAngle = startAngle + segAngle;

        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(rotationAngle);

        for (let i = 0; i < segCount; i++) {
            if (i === highlightIndex) continue;
            _wedgePath(ctx, radius, i * segAngle, (i + 1) * segAngle);
            ctx.fillStyle = 'rgba(12, 6, 24, 0.5)';
            ctx.fill();
        }

        _wedgePath(ctx, radius, startAngle, endAngle);
        ctx.fillStyle = 'rgba(255, 240, 200, 0.12)';
        ctx.shadowColor = rarityConf.glow || 'rgba(251, 191, 36, 0.55)';
        ctx.shadowBlur = Math.max(18, size / 16);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = Math.max(4, size / 90);
        ctx.stroke();
        ctx.restore();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHEEL RESULT REVEAL EFFECTS
// ═══════════════════════════════════════════════════════════════════════════════

function triggerWheelRevealEffects(rarity, isNegative) {
    const stageFrame = document.getElementById('fw-stage-frame');
    if (!stageFrame) return;
    const rect = stageFrame.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    if (rarity === 'mythic') {
        triggerMythicReveal(x, y, isNegative);
    } else if (rarity === 'legendary') {
        triggerLegendaryReveal(x, y, isNegative);
    } else if (rarity === 'epic') {
        triggerEpicReveal(x, y, isNegative);
    } else if (rarity === 'rare') {
        triggerRareReveal(x, y);
    } else if (rarity === 'cursed') {
        triggerCursedReveal(x, y);
    } else {
        triggerCommonReveal(x, y);
    }
}

function _createSparkles(x, y, count, colors, sizeRange = [3, 7], distRange = [40, 120]) {
    for (let i = 0; i < count; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'fw-sparkle';
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
        const angle = Math.random() * Math.PI * 2;
        const dist = distRange[0] + Math.random() * (distRange[1] - distRange[0]);
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist - 20; // slight upward bias
        const dur = 0.6 + Math.random() * 0.5;
        sparkle.style.left = `${x}px`;
        sparkle.style.top = `${y}px`;
        sparkle.style.setProperty('--size', `${size}px`);
        sparkle.style.setProperty('--sparkle-color', color);
        sparkle.style.setProperty('--tx', `${tx}px`);
        sparkle.style.setProperty('--ty', `${ty}px`);
        sparkle.style.setProperty('--duration', `${dur}s`);
        sparkle.style.animationDelay = `${Math.random() * 0.15}s`;
        document.body.appendChild(sparkle);
        sparkle.addEventListener('animationend', () => sparkle.remove());
    }
}

function _createHaloRing(x, y, color, delay = 0) {
    setTimeout(() => {
        const ring = document.createElement('div');
        ring.className = 'fw-halo-ring';
        ring.style.left = `${x}px`;
        ring.style.top = `${y}px`;
        ring.style.setProperty('--halo-color', color);
        document.body.appendChild(ring);
        ring.addEventListener('animationend', () => ring.remove());
    }, delay);
}

function _createStarburst(x, y, color) {
    const burst = document.createElement('div');
    burst.className = 'fw-starburst';
    burst.style.left = `${x}px`;
    burst.style.top = `${y}px`;
    burst.style.setProperty('--burst-color', color);
    document.body.appendChild(burst);
    burst.addEventListener('animationend', () => burst.remove());
}

function _createCrumbleParticles(x, y, count, colors) {
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'fw-crumble-particle';
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = 4 + Math.random() * 6;
        const tx = (Math.random() - 0.5) * 160;
        const fd = 100 + Math.random() * 200;
        const rot = (Math.random() - 0.5) * 360;
        const dur = 0.8 + Math.random() * 0.6;
        p.style.left = `${x + (Math.random() - 0.5) * 100}px`;
        p.style.top = `${y - 20}px`;
        p.style.setProperty('--size', `${size}px`);
        p.style.setProperty('--crumble-color', color);
        p.style.setProperty('--tx', `${tx}px`);
        p.style.setProperty('--fd', `${fd}px`);
        p.style.setProperty('--rot', `${rot}deg`);
        p.style.setProperty('--duration', `${dur}s`);
        p.style.animationDelay = `${Math.random() * 0.2}s`;
        document.body.appendChild(p);
        p.addEventListener('animationend', () => p.remove());
    }
}

function _createPrismaticFlash() {
    const flash = document.createElement('div');
    flash.className = 'fw-prismatic-flash';
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());
}

function triggerMythicReveal(x, y, isNegative) {
    // Prismatic flash
    _createPrismaticFlash();
    // Starburst
    _createStarburst(x, y, isNegative ? 'rgba(220, 38, 38, 0.5)' : 'rgba(251, 191, 36, 0.5)');
    // 4 staggered halo rings
    for (let i = 0; i < 4; i++) {
        _createHaloRing(x, y, isNegative ? 'rgba(220, 38, 38, 0.7)' : 'rgba(251, 191, 36, 0.8)', i * 120);
    }
    // 40 sparkles
    const mythicColors = isNegative
        ? ['#ef4444', '#dc2626', '#991b1b', '#f97316', '#fbbf24']
        : ['#fbbf24', '#f59e0b', '#eab308', '#22d3ee', '#a78bfa', '#ec4899', '#34d399'];
    _createSparkles(x, y, 40, mythicColors, [4, 10], [60, 210]);
    // Emoji rain
    const emojis = isNegative ? ['☄️', '🌑', '⚰️', '💀', '🔥', '🕯️'] : ['🏆', '👑', '⚜️', '✨', '💎', '🌟', '🗺️', '🎁'];
    triggerEmojiRain(x, y, emojis, 55);
}

function triggerLegendaryReveal(x, y, isNegative) {
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    flash.style.setProperty('--flash-color', isNegative ? 'rgba(127, 29, 29, 0.45)' : 'rgba(251, 191, 36, 0.5)');
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());

    // 3 staggered halo rings
    for (let i = 0; i < 3; i++) {
        _createHaloRing(x, y, isNegative ? 'rgba(220, 38, 38, 0.7)' : 'rgba(251, 191, 36, 0.8)', i * 150);
    }

    // 32 sparkles
    const legendaryColors = isNegative
        ? ['#ef4444', '#dc2626', '#f97316']
        : ['#fbbf24', '#f59e0b', '#eab308', '#fcd34d'];
    _createSparkles(x, y, 32, legendaryColors, [3, 8], [50, 160]);

    const emojis = isNegative ? ['💀', '⚰️', '🌑', '💀', '🔥'] : ['⭐', '✨', '🌟', '💫', '🏆', '⚜️', '👑'];
    triggerEmojiRain(x, y, emojis, 35);
}

function triggerEpicReveal(x, y, isNegative) {
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    flash.style.setProperty('--flash-color', isNegative ? 'rgba(127, 29, 29, 0.35)' : 'rgba(168, 85, 247, 0.4)');
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());

    // 2 staggered halo rings
    _createHaloRing(x, y, isNegative ? 'rgba(220, 38, 38, 0.6)' : 'rgba(168, 85, 247, 0.7)');
    setTimeout(() => _createHaloRing(x, y, isNegative ? 'rgba(220, 38, 38, 0.5)' : 'rgba(168, 85, 247, 0.5)'), 130);

    // 24 sparkles
    const epicColors = isNegative
        ? ['#ef4444', '#f97316', '#fbbf24']
        : ['#a855f7', '#c084fc', '#e879f9', '#fbbf24'];
    _createSparkles(x, y, 24, epicColors, [3, 7], [40, 130]);

    const emojis = isNegative ? ['🔻', '⚡', '💔'] : ['🌟', '✨', '💫', '🎁'];
    triggerEmojiRain(x, y, emojis, 22);
}

function triggerRareReveal(x, y) {
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    flash.style.setProperty('--flash-color', 'rgba(59, 130, 246, 0.35)');
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());

    // 1 halo ring
    _createHaloRing(x, y, 'rgba(96, 165, 250, 0.6)');

    // 16 sparkles
    _createSparkles(x, y, 16, ['#a855f7', '#818cf8', '#c084fc', '#e9d5ff'], [2, 6], [30, 100]);

    const emojis = ['✨', '⭐', '💫'];
    triggerEmojiRain(x, y, emojis, 14);
}

function triggerCursedReveal(x, y) {
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    flash.style.setProperty('--flash-color', 'rgba(127, 29, 29, 0.5)');
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());

    // 2 staggered halo rings
    for (let i = 0; i < 2; i++) {
        _createHaloRing(x, y, 'rgba(185, 28, 28, 0.7)', i * 200);
    }

    // Crumble particles
    _createCrumbleParticles(x, y, 20, ['#ef4444', '#dc2626', '#991b1b', '#7f1d1d']);

    // 20 sparkles (dark red)
    _createSparkles(x, y, 20, ['#ef4444', '#dc2626', '#f87171'], [2, 5], [20, 80]);

    triggerEmojiRain(x, y, ['⚡', '💀', '🌑', '🔻'], 18);
}

function triggerCommonReveal(x, y) {
    // 8 sparkles (subtle)
    _createSparkles(x, y, 8, ['#fbbf24', '#fcd34d', '#fef3c7'], [2, 5], [20, 60]);

    triggerEmojiRain(x, y, ['✨', '⭐', '💫'], 8);
}

function triggerEmojiRain(x, y, emojis, count) {
    for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.className = 'star-rain-element';
        star.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        const sz = 16 + Math.random() * 22;
        const ws = (Math.random() - 0.5) * 120;
        const we = (Math.random() - 0.5) * 160;
        const fd = 120 + Math.random() * 220;
        const rot = (Math.random() - 0.5) * 720;
        const dur = 0.75 + Math.random() * 0.8;
        const startX = x + (Math.random() - 0.5) * 200;
        star.style.left = `${startX}px`;
        star.style.top = `${y}px`;
        star.style.setProperty('--size', `${sz}px`);
        star.style.setProperty('--ws', `${ws}px`);
        star.style.setProperty('--we', `${we}px`);
        star.style.setProperty('--fd', `${fd}px`);
        star.style.setProperty('--rot', `${rot}deg`);
        star.style.setProperty('--duration', `${dur}s`);
        star.style.animationDelay = `${Math.random() * 0.3}s`;
        document.body.appendChild(star);
        star.addEventListener('animationend', () => star.remove());
    }
}

/**
 * Animate the wheel spin.
 * @param {HTMLCanvasElement} canvas
 * @param {Array} segments
 * @param {number} winnerIndex
 * @param {object} guildDef
 * @param {Function} onTick - Called on each segment pass (for tick sound)
 * @returns {Promise} resolves when animation completes
 */
export function animateWheelSpin(canvas, segments, winnerIndex, guildDef, onTick) {
    return new Promise((resolve) => {
        const segCount = segments.length;
        const segAngle = TAU / segCount;

        // Target angle: winner segment should be at the TOP (12 o'clock = -π/2)
        const winnerCenterAngle = winnerIndex * segAngle + segAngle / 2;
        const targetAngle = -winnerCenterAngle - Math.PI / 2;

        // Add extra full spins for drama (8-12 full rotations for a high energy spin)
        const extraSpins = (8 + Math.floor(Math.random() * 4)) * TAU;
        const normalizedTarget = ((targetAngle % TAU) + TAU) % TAU;
        const totalRotation = extraSpins + normalizedTarget;

        const duration = 6500 + Math.random() * 1500; // 6.5-8s for maximum suspense
        const startTime = performance.now();
        let lastSegIndex = -1;

        // Custom easing: slight back-in (wind up) then long smooth ease-out
        function customSpinEase(t) {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            
            // Wind up
            if (t < 0.1) {
                const normalizedT = t / 0.1;
                return -0.05 * Math.sin(normalizedT * Math.PI); 
            }
            // Fast spin and slow down
            const pt = (t - 0.1) / 0.9;
            return 1 - Math.pow(1 - pt, 5); // easeOutQuint
        }

        function frame(now) {
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / duration);
            const eased = customSpinEase(t);
            const currentAngle = totalRotation * eased;

            drawWheel(canvas, segments, currentAngle, guildDef);

            // Tick sound on segment boundary crossing
            // Only play tick if we're moving forward
            if (t >= 0.1) {
                // Offset by -π/2 because pointer is at 12 o'clock (top), not 3 o'clock
                const normalizedAngle = (((currentAngle % TAU) + TAU) % TAU + Math.PI / 2) % TAU;
                const currentSegIndex = Math.floor(normalizedAngle / segAngle) % segCount;
                if (currentSegIndex !== lastSegIndex) {
                    lastSegIndex = currentSegIndex;
                    // Play sound slightly less often near the end for dramatic effect
                    if (onTick && t < 0.99) onTick();
                }
            }

            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                drawWheel(canvas, segments, totalRotation, guildDef, winnerIndex);
                setTimeout(() => resolve({ rotationAngle: totalRotation }), 800);
            }
        }

        requestAnimationFrame(frame);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHEEL MODAL CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

let _wheelState = {
    active: false,
    classId: null,
    leagueLevel: null,
    guildOrder: [],
    currentGuildIndex: 0,
    segments: [],         // Current guild's 20 segments
    results: [],          // All 4 guild results
    phase: 'idle',        // 'idle' | 'ready' | 'spinning' | 'revealed' | 'summary' | 'done'
    winnerIndex: null,
    rotationAngle: 0,
    _aborting: false,
};
let _wheelResizeWired = false;

export function getWheelState() { return _wheelState; }

/**
 * Open the Fortune's Wheel modal. Uses the header (global) class only.
 * Always opens — shows a locked/unavailable state when conditions aren't met.
 */
export async function openFortunesWheel() {
    const modal = document.getElementById('fortunes-wheel-modal');
    if (!modal) return;

    _wireWheelResize();
    // Clear the last ceremony's leftovers before the card animates in. The idle
    // phase hides the roster panel until the availability check settles.
    _setCardPhase('idle');
    _hideResultReveal();
    document.getElementById('fw-summary')?.classList.add('hidden');
    showAnimatedModal('fortunes-wheel-modal');

    const resolvedClassId = state.get('globalSelectedClassId') || '';
    const allClasses = state.get('allTeachersClasses') || [];
    const selectedClass = allClasses.find(c => c.id === resolvedClassId) || null;
    const resolvedLeague = selectedClass?.questLevel || state.get('globalSelectedLeague') || 'B';

    await _evaluateAndRender(resolvedClassId || null, resolvedLeague);
}

/**
 * When the header class changes while this modal is open, re-sync (no in-modal picker).
 * Skips during spin or when there are unsaved ceremony results.
 */
export async function refreshFortunesWheelModalFromGlobalClass() {
    const modal = document.getElementById('fortunes-wheel-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    if (_wheelState.phase === 'spinning') return;
    if ((_wheelState.results?.length || 0) > 0) return;

    const resolvedClassId = state.get('globalSelectedClassId') || '';
    const allClasses = state.get('allTeachersClasses') || [];
    const selectedClass = allClasses.find(c => c.id === resolvedClassId) || null;
    const resolvedLeague = selectedClass?.questLevel || state.get('globalSelectedLeague') || 'B';
    await _evaluateAndRender(resolvedClassId || null, resolvedLeague);
}

function _wireWheelResize() {
    if (_wheelResizeWired) return;
    _wheelResizeWired = true;
    window.addEventListener('resize', () => {
        if (_wheelState.phase !== 'ready' && _wheelState.phase !== 'spinning' && _wheelState.phase !== 'revealed') return;
        _sizeAndRenderWheel();
    });
}

/**
 * Core availability check + render. Called when the modal opens.
 */
async function _evaluateAndRender(classId, leagueLevel) {
    const allSchoolClasses = state.get('allSchoolClasses') || [];
    const allScheduleOverrides = state.get('allScheduleOverrides') || [];
    const schoolHolidayRanges = state.get('schoolHolidayRanges') || [];

    let alreadySpun = false;
    try {
        alreadySpun = classId ? await hasSpunThisWeek(classId) : false;
    } catch (err) {
        console.warn('Wheel availability check failed:', err);
    }

    const availability = evaluateWheelAvailability(classId, {
        now: new Date(),
        allSchoolClasses,
        allScheduleOverrides,
        schoolHolidayRanges,
        classEndDates: state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {},
        alreadySpun,
    });

    _renderAvailability(availability);

    if (!availability.allowed) {
        _wheelState = { active: false, classId: null, leagueLevel: null, guildOrder: [], currentGuildIndex: 0, segments: [], results: [], phase: 'idle', winnerIndex: null, rotationAngle: 0 };
        _renderLockedState(availability);
        return;
    }

    _wheelState = {
        active: true,
        classId,
        leagueLevel,
        guildOrder: shuffleArray([...GUILD_IDS]),
        currentGuildIndex: 0,
        segments: [],
        results: [],
        phase: 'ready',
        winnerIndex: null,
        rotationAngle: 0,
    };

    // Generate first guild's segments
    invalidateWheelCache();
    _prepareGuildWheel();
    _renderWheelPhase();
}

/**
 * Render a beautiful "locked" state inside the modal when the wheel can't be spun.
 */
function _renderAvailability(availability) {
    const root = document.getElementById('fw-availability');
    const titleEl = document.getElementById('fw-availability-title');
    const messageEl = document.getElementById('fw-availability-message');
    const metaEl = document.getElementById('fw-availability-meta');
    if (!root || !titleEl || !messageEl || !metaEl) return;

    if (!availability.allowed) {
        root.classList.add('hidden');
        return;
    }

    root.classList.remove('hidden');
    root.dataset.state = availability.code || 'locked';
    titleEl.textContent = availability.title || 'Fortune awaits';
    messageEl.textContent = availability.message || '';
    metaEl.textContent = availability.meta || '';
    metaEl.classList.toggle('hidden', !availability.meta);
}

function _renderLockedState(title, message, emoji) {
    _hideResultReveal();
    const availability = typeof title === 'object'
        ? title
        : { title, message, emoji, code: 'locked' };

    const canvasWrap = document.getElementById('fw-canvas-wrap');
    if (canvasWrap) canvasWrap.classList.add('hidden');
    const stageFrame = document.getElementById('fw-stage-frame');
    if (stageFrame) {
        stageFrame.classList.add('is-locked');
        stageFrame.classList.remove('is-spinning');
        stageFrame.dataset.lock = availability.code === 'already_spun' ? 'recharging' : 'sealed';
    }
    _setCardPhase('locked');
    const headerEl = document.getElementById('fw-guild-header');
    if (headerEl) headerEl.innerHTML = '';
    _renderWheelLegend();

    const summaryEl = document.getElementById('fw-summary');
    if (summaryEl) summaryEl.classList.add('hidden');

    const resultEl = document.getElementById('fw-result');
    if (resultEl) {
        resultEl.innerHTML = `
            <div class="fw-locked-state">
                <div class="fw-locked-sparkles" aria-hidden="true"></div>
                <div class="fw-locked-orb"></div>
                <h3 class="fw-locked-title">${availability.title}</h3>
                <p class="fw-locked-message">${availability.message}</p>
                ${availability.meta ? `<p class="fw-locked-meta">${availability.meta}</p>` : ''}
                <div class="fw-locked-divider"></div>
            </div>`;
        resultEl.classList.remove('hidden');
    }

    _setStageEmblem(null);
    _renderGuildProgress();
    _renderCurrentGuildMembers();
    _setStageCaption('');

    _updateSpinButton(true, availability.code === 'already_spun' ? 'Recharging' : 'Await Final Lesson', availability.code === 'already_spun' ? 'Returns next school week' : 'The relic is sealed');
    const nextBtn = document.getElementById('fw-next-btn');
    if (nextBtn) nextBtn.classList.add('hidden');
    const doneBtn = document.getElementById('fw-done-btn');
    if (doneBtn) doneBtn.classList.add('hidden');
}

function _renderCurrentGuildMembers() {
    const panel = document.getElementById('fw-guild-members');
    if (!panel) return;

    const guildId = _wheelState.guildOrder[_wheelState.currentGuildIndex];
    if (!_wheelState.active || !_wheelState.classId || !guildId) {
        panel.innerHTML = `
            <div class="fw-guild-members__header">Active Guild Members</div>
            <div class="fw-guild-members__empty">Select a class in the header to view guild members for each turn.</div>`;
        return;
    }

    const guildDef = getGuildById(guildId);
    const students = (state.get('allStudents') || [])
        .filter(student => student.classId === _wheelState.classId && student.guildId === guildId)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const rosterHtml = students.length > 0
        ? students.map(student => {
            const avatarHtml = student.avatar
                ? `<img src="${student.avatar}" alt="${student.name}" class="fw-guild-members__avatar">`
                : `<span class="fw-guild-members__initial">${(student.name || '?').charAt(0).toUpperCase()}</span>`;
            return `
                <div class="fw-guild-members__item">
                    <div class="fw-guild-members__visual">${avatarHtml}</div>
                    <div class="fw-guild-members__name">${student.name || 'Unknown Student'}</div>
                </div>`;
        }).join('')
        : '<div class="fw-guild-members__empty">No students from this guild are in the selected class.</div>';

    panel.style.setProperty('--guild-primary', guildDef?.primary || '#e8c46a');
    panel.innerHTML = `
        <div class="fw-guild-members__header">${guildDef?.name || 'Active Guild'} Members<span class="fw-guild-members__count">${students.length}</span></div>
        <div class="fw-guild-members__list">${rosterHtml}</div>`;
}

/**
 * Called when teacher clicks "Spin!" for the current guild.
 */
export async function triggerSpin() {
    if (_wheelState.phase !== 'ready') return;
    _wheelState.phase = 'spinning';
    _wheelState.winnerIndex = null;
    _wheelState.rotationAngle = 0;

    try {
        await ensureAudioReady();
    } catch (_) {}

    const canvas = document.getElementById('fortunes-wheel-canvas');
    const guildId = _wheelState.guildOrder[_wheelState.currentGuildIndex];
    const guildDef = getGuildById(guildId);
    const segments = _wheelState.segments;
    const winnerIndex = spinWheel(segments.length);
    const stageFrame = document.getElementById('fw-stage-frame');
    if (stageFrame) stageFrame.classList.add('is-spinning');
    const canvasWrap = document.getElementById('fw-canvas-wrap');
    if (canvasWrap) canvasWrap.classList.remove('is-idle');
    _setCardPhase('spinning');
    _setStageCaption('The wheel whirls… every eye on the pointer.');

    _updateSpinButton(true, 'Spinning...');

    // Animate
    const anim = await animateWheelSpin(canvas, segments, winnerIndex, guildDef, () => {
        try { playSound('click'); } catch (_) {}
        _flickPointer();
    });
    if (stageFrame) stageFrame.classList.remove('is-spinning');
    _wheelState.winnerIndex = winnerIndex;
    _wheelState.rotationAngle = anim?.rotationAngle || 0;

    // Guard: if the modal was closed during the spin animation, abort cleanly
    if (_wheelState._aborting) {
        _wheelState = { active: false, classId: null, leagueLevel: null, guildOrder: [], currentGuildIndex: 0, segments: [], results: [], phase: 'idle', winnerIndex: null, rotationAngle: 0, _aborting: false };
        hideModal('fortunes-wheel-modal');
        _hideResultReveal();
        return;
    }

    // Reveal sound based on rarity
    const winningSeg = segments[winnerIndex];
    try {
        if (winningSeg.rarity === 'mythic') playHeroFanfare();
        else if (winningSeg.rarity === 'legendary') playHeroFanfare();
        else if (winningSeg.rarity === 'epic') playSound('familiar_levelup');
        else if (winningSeg.rarity === 'rare') playSound('magic_chime');
        else if (winningSeg.rarity === 'cursed') playSound('star_remove');
        else playSound('star1');
    } catch (_) {}

    // Trigger WOW visual effects based on rarity
    triggerWheelRevealEffects(winningSeg.rarity, false);

    // Apply effect
    const result = await applyWheelResult(guildId, winningSeg, _wheelState.classId, { favored: Boolean(_wheelState.favored) });
    _wheelState.results.push(result);
    _wheelState.phase = 'revealed';

    // The guild_scores listener already carries these writes (Firestore applies local
    // writes at once); adding the result to state again here counted it twice.
    try {
        const guildsTab = document.getElementById('guilds-tab');
        if (guildsTab && !guildsTab.classList.contains('hidden')) {
            import('../ui/tabs/guilds.js').then(m => m.renderGuildsTab());
        }
    } catch (_) { }

    _renderWheelResult(winningSeg, result, guildDef);
}

/** Draws the wheel for the guild now at the wheel (gilded when a Fortune's Favor waits). */
function _prepareGuildWheel() {
    const guildId = _wheelState.guildOrder[_wheelState.currentGuildIndex];
    _wheelState.favored = isGuildWheelFavored(guildId, _wheelState.classId);
    _wheelState.segments = generateWheelSegments(_wheelState.leagueLevel, { favored: _wheelState.favored });
}

/**
 * Advance to next guild or show summary.
 */
export function advanceWheel() {
    if (_wheelState.currentGuildIndex < _wheelState.guildOrder.length - 1) {
        _wheelState.currentGuildIndex++;
        invalidateWheelCache();
        _prepareGuildWheel();
        _wheelState.phase = 'ready';
        _wheelState.winnerIndex = null;
        _wheelState.rotationAngle = 0;
        _renderWheelPhase();
    } else {
        _wheelState.phase = 'summary';
        _renderWheelSummary();
    }
}

/**
 * Close the wheel and save results.
 */
export async function closeFortunesWheel() {
    // If a spin animation is in progress, flag it to abort after animation completes
    if (_wheelState.phase === 'spinning') {
        _wheelState._aborting = true;
        return;
    }
    if (_wheelState.classId && _wheelState.results.length > 0) {
        try {
            await saveFortuneWheelResult(_wheelState.classId, _wheelState.results);
        } catch (err) {
            console.error('Failed to save wheel results:', err);
        }
    }

    _wheelState = { active: false, classId: null, leagueLevel: null, guildOrder: [], currentGuildIndex: 0, segments: [], results: [], phase: 'idle', winnerIndex: null, rotationAngle: 0 };

    // Leave the card exactly as it is while it animates out; re-rendering it
    // here flashed the idle roster panel inside the closing card.
    // openFortunesWheel resets the view before the next opening.
    hideModal('fortunes-wheel-modal');
}

// ── Internal UI helpers ──────────────────────────────────────────────────────

/** Mirror the ceremony phase onto the card so CSS can re-arrange the stage. */
function _setCardPhase(phase) {
    const card = document.querySelector('#fortunes-wheel-modal .fw-card');
    if (card) card.dataset.phase = phase;
}

let _lastPointerFlick = 0;

/** Flick the gilt pointer as a peg passes under it (visual only). */
function _flickPointer() {
    const pointer = document.querySelector('#fortunes-wheel-modal .fw-pointer-bright');
    if (!pointer || typeof pointer.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const now = performance.now();
    if (now - _lastPointerFlick < 45) return;
    _lastPointerFlick = now;
    pointer.animate([
        { transform: 'translateX(-50%) rotate(0deg)' },
        { transform: 'translateX(-50%) rotate(-16deg)', offset: 0.3 },
        { transform: 'translateX(-50%) rotate(0deg)' }
    ], { duration: 150, easing: 'ease-out' });
}

/** "On this wheel" tally: how many wedges of each rarity this guild faces. */
function _renderWheelLegend() {
    const legendEl = document.getElementById('fw-wheel-legend');
    if (!legendEl) return;
    const segments = _wheelState.segments || [];
    if (!_wheelState.active || segments.length === 0 || _wheelState.phase === 'summary') {
        legendEl.classList.add('hidden');
        legendEl.innerHTML = '';
        return;
    }
    const order = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'cursed'];
    const counts = new Map();
    for (const seg of segments) counts.set(seg.rarity, (counts.get(seg.rarity) || 0) + 1);
    const chips = order
        .filter(rarity => counts.get(rarity))
        .map(rarity => {
            const conf = getRarityPalette(rarity, 0);
            return `<span class="fw-wheel-legend__chip" data-rarity="${rarity}" style="--chip-color:${conf.color};--chip-bg:${conf.bg};">
                <span class="fw-wheel-legend__gem"></span>${conf.label}<b>×${counts.get(rarity)}</b>
            </span>`;
        }).join('');
    legendEl.innerHTML = `
        <div class="fw-wheel-legend__header">On this wheel</div>
        <div class="fw-wheel-legend__chips">${chips}</div>`;
    legendEl.classList.remove('hidden');
}

function _renderWheelPhase() {
    _hideResultReveal();
    const guildId = _wheelState.guildOrder[_wheelState.currentGuildIndex];
    const guildDef = getGuildById(guildId);
    const guildNum = _wheelState.currentGuildIndex + 1;
    const emblemUrl = getGuildEmblemUrl(guildId);

    // Update header
    const headerEl = document.getElementById('fw-guild-header');
    if (headerEl) {
        headerEl.innerHTML = `
            <div class="fw-guild-banner" style="--guild-primary:${guildDef?.primary || '#e8c46a'};--guild-secondary:${guildDef?.secondary || '#9a7128'};">
                <div class="fw-guild-banner__crest">
                    ${emblemUrl ? `<img src="${emblemUrl}" alt="${guildDef?.name || guildId}" class="fw-guild-banner__crest-image">` : `<span class="fw-guild-banner__crest-fallback">${guildNum}</span>`}
                </div>
                <div class="fw-guild-banner__copy">
                    <div class="fw-guild-banner__eyebrow">Guild ${guildNum} of ${_wheelState.guildOrder.length}</div>
                    <div class="fw-guild-banner__name">${guildDef?.name || guildId}</div>
                </div>
                ${guildDef?.emoji ? `<div class="fw-guild-banner__flag" aria-hidden="true">${guildDef.emoji}</div>` : ''}
            </div>`;
    }

    _renderGuildProgress();
    _renderCurrentGuildMembers();
    _renderWheelLegend();
    _setStageEmblem(guildId);
    _setStageCaption(_wheelState.favored
        ? `${guildDef?.name || 'This guild'} steps up to a gilded wheel: Fortune's Favor chose only the rarer fates.`
        : `${guildDef?.name || 'This guild'} steps up to the wheel. Spin to reveal its weekly fortune.`);
    _setCardPhase('ready');

    const stageFrame = document.getElementById('fw-stage-frame');
    if (stageFrame) {
        stageFrame.classList.remove('is-locked');
        stageFrame.classList.remove('is-spinning');
        delete stageFrame.dataset.lock;
        stageFrame.style.setProperty('--guild-primary', guildDef?.primary || '#e8c46a');
        stageFrame.style.setProperty('--guild-glow', guildDef?.glow || guildDef?.primary || '#fbbf24');
    }

    const canvasWrap = document.getElementById('fw-canvas-wrap');
    if (canvasWrap) {
        canvasWrap.classList.remove('hidden');
        canvasWrap.classList.add('is-idle');
    }
    _sizeAndRenderWheel();

    _updateSpinButton(false, 'Spin This Guild', 'The relic chooses a fate');
    const resultEl = document.getElementById('fw-result');
    if (resultEl) resultEl.classList.add('hidden');
    const nextBtn = document.getElementById('fw-next-btn');
    if (nextBtn) nextBtn.classList.add('hidden');
    const doneBtn = document.getElementById('fw-done-btn');
    if (doneBtn) doneBtn.classList.add('hidden');
    const summaryEl = document.getElementById('fw-summary');
    if (summaryEl) summaryEl.classList.add('hidden');
}

let _lastWheelDisplaySize = 0;

function _sizeAndRenderWheel() {
    const canvas = document.getElementById('fortunes-wheel-canvas');
    if (!canvas || !_wheelState.segments?.length) return;
    const guildId = _wheelState.guildOrder[_wheelState.currentGuildIndex];
    const guildDef = getGuildById(guildId);

    const parentEl = canvas.parentElement;
    const parentWidth = parentEl?.clientWidth || 620;
    const parentHeight = parentEl?.clientHeight || parentWidth;
    const available = Math.min(parentWidth, parentHeight);
    const displaySize = Math.round(Math.min(720, available));
    if (!displaySize || displaySize < 10) return;
    // Render at device resolution (capped) so labels stay crisp on projectors and tablets
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const pixelSize = Math.round(Math.min(1200, displaySize * dpr));

    if (pixelSize !== _lastWheelDisplaySize) {
        invalidateWheelCache();
        _lastWheelDisplaySize = pixelSize;
    }

    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    const rotation = _wheelState.phase === 'revealed' ? (_wheelState.rotationAngle || 0) : 0;
    const highlightIndex = _wheelState.phase === 'revealed' ? _wheelState.winnerIndex : null;
    drawWheel(canvas, _wheelState.segments, rotation, guildDef, highlightIndex);
}

function _updateSpinButton(disabled, label = 'Spin the Wheel', sublabel = 'The relic chooses a fate') {
    const spinBtn = document.getElementById('fw-spin-btn');
    if (!spinBtn) return;
    spinBtn.disabled = disabled;
    spinBtn.classList.toggle('is-busy', disabled && label === 'Spinning...');
    const labelEl = spinBtn.querySelector('.fw-btn-primary__label');
    const subEl = spinBtn.querySelector('.fw-btn-primary__sub');
    if (labelEl) labelEl.textContent = label;
    if (subEl) subEl.textContent = sublabel;
}

function _hideResultReveal() {
    const revealLayer = document.getElementById('fw-reveal-layer');
    const revealCard = document.getElementById('fw-reveal-card');
    const primaryBtn = document.getElementById('fw-reveal-primary-btn');
    const secondaryBtn = document.getElementById('fw-reveal-secondary-btn');
    if (revealLayer) revealLayer.classList.add('hidden');
    if (revealCard) revealCard.innerHTML = '';
    if (primaryBtn) {
        primaryBtn.classList.add('hidden');
        primaryBtn.onclick = null;
    }
    if (secondaryBtn) {
        secondaryBtn.classList.add('hidden');
        secondaryBtn.onclick = null;
    }
    // Clean up rarity theming from the shell
    const shell = revealLayer?.querySelector('.fw-reveal-layer__shell');
    if (shell) {
        delete shell.dataset.rarity;
        shell.classList.remove('is-prismatic');
        shell.style.removeProperty('--shell-rarity-color');
        shell.style.removeProperty('--shell-rarity-glow');
        shell.style.removeProperty('--shell-rarity-bg');
    }
}

function _showResultReveal({ cardHtml, rarity = 'common', rarityColor = null, rarityGlow = null, rarityBg = null, isPrismatic = false, primaryAction = null, secondaryAction = null }) {
    const revealLayer = document.getElementById('fw-reveal-layer');
    const revealCard = document.getElementById('fw-reveal-card');
    const primaryBtn = document.getElementById('fw-reveal-primary-btn');
    const secondaryBtn = document.getElementById('fw-reveal-secondary-btn');
    if (!revealLayer || !revealCard || !primaryBtn || !secondaryBtn) return;

    revealCard.innerHTML = cardHtml;

    // Apply rarity theming to the shell (the framed outer container)
    const shell = revealLayer.querySelector('.fw-reveal-layer__shell');
    if (shell) {
        shell.dataset.rarity = rarity;
        if (isPrismatic) {
            shell.classList.add('is-prismatic');
        } else {
            shell.classList.remove('is-prismatic');
        }
        if (rarityColor) shell.style.setProperty('--shell-rarity-color', rarityColor);
        if (rarityGlow)  shell.style.setProperty('--shell-rarity-glow',  rarityGlow);
        if (rarityBg)    shell.style.setProperty('--shell-rarity-bg',    rarityBg);
    }

    // Tint the backdrop to the rarity glow colour
    revealLayer.style.setProperty('--backdrop-glow', rarityGlow || 'rgba(251,191,36,0.24)');
    revealLayer.style.setProperty('--backdrop-color', rarityColor || '#fbbf24');

    if (primaryAction) {
        primaryBtn.classList.remove('hidden');
        primaryBtn.innerHTML = `<span class="font-title">${primaryAction.label}</span>`;
        primaryBtn.onclick = primaryAction.onClick;
    } else {
        primaryBtn.classList.add('hidden');
        primaryBtn.onclick = null;
    }

    if (secondaryAction) {
        secondaryBtn.classList.remove('hidden');
        secondaryBtn.innerHTML = `<span class="font-title">${secondaryAction.label}</span>`;
        secondaryBtn.onclick = secondaryAction.onClick;
    } else {
        secondaryBtn.classList.add('hidden');
        secondaryBtn.onclick = null;
    }

    revealLayer.classList.remove('hidden');
}

function _renderWheelResult(segment, result, guildDef) {
    const rarityConf = getRarityPalette(segment.rarity, segment.paletteIndex);
    const emblemUrl = getGuildEmblemUrl(guildDef?.id);

    // ── Resolve affected student objects ─────────────────────────────────
    const allStudents = state.get('allStudents') || [];
    const affectedStudentIds = result.affectedStudents || [];
    const affectedStudents = affectedStudentIds
        .map(id => allStudents.find(s => s.id === id))
        .filter(Boolean);

    // ── Student chips HTML ────────────────────────────────────────────────
    let studentChipsHtml = '';
    if (affectedStudents.length > 0) {
        const MAX_SHOWN = 3;
        const shown = affectedStudents.slice(0, MAX_SHOWN);
        const overflow = affectedStudents.length - MAX_SHOWN;
        const chips = shown.map(s => {
            const avatarHtml = s.avatar
                ? `<img src="${s.avatar}" class="fw-result-student-avatar" alt="${s.name}">`
                : `<span class="fw-result-student-avatar--initial">${s.name.charAt(0).toUpperCase()}</span>`;
            return `<div class="fw-result-student-chip">${avatarHtml}<span>${s.name}</span></div>`;
        }).join('');
        const overflowChip = overflow > 0
            ? `<div class="fw-result-student-overflow">+${overflow} more</div>`
            : '';
        studentChipsHtml = `<div class="fw-result-student-row">${chips}${overflowChip}</div>`;
    }

    // ── Impact stat tiles ─────────────────────────────────────────────────
    // Artifacts get their own showcase block below, so only show the generic
    // tile for removal events (no names available to show) or when no granted list.
    const showArtifactTile = (result.artifactsRemoved || 0) > 0 ||
        ((result.artifactsGranted || 0) > 0 && !(result.grantedArtifacts?.length));

    const statDefs = [
        result.gloryDelta
            ? { icon: '⚜️', label: 'Glory',       displayStr: `${result.gloryDelta >= 0 ? '+' : ''}${result.gloryDelta}`,           isNeg: result.gloryDelta < 0 }
            : null,
        result.goldDelta
            ? { icon: '🪙', label: 'Gold',        displayStr: `${result.goldDelta >= 0 ? '+' : ''}${result.goldDelta}`,             isNeg: result.goldDelta < 0 }
            : null,
        result.starsDelta
            ? { icon: '⭐', label: 'Stars',       displayStr: `${result.starsDelta >= 0 ? '+' : ''}${result.starsDelta}`,           isNeg: result.starsDelta < 0 }
            : null,
        result.classQuestDelta
            ? { icon: '🗺️', label: 'Quest Bonus', displayStr: `${result.classQuestDelta >= 0 ? '+' : ''}${result.classQuestDelta}`, isNeg: result.classQuestDelta < 0 }
            : null,
        showArtifactTile
            ? { icon: '🎒', label: 'Artifacts',
                displayStr: `${result.artifactsGranted ? `+${result.artifactsGranted}` : ''}${result.artifactsGranted && result.artifactsRemoved ? ' / ' : ''}${result.artifactsRemoved ? `-${result.artifactsRemoved}` : ''}`,
                isNeg: (result.artifactsRemoved || 0) > (result.artifactsGranted || 0) }
            : null,
    ].filter(Boolean);

    const statsHtml = statDefs.map((s, i) => `
        <div class="fw-result-stat" style="animation-delay:${(0.05 + i * 0.07).toFixed(2)}s">
            <div class="fw-result-stat__icon">${s.icon}</div>
            <div class="fw-result-stat__value ${s.isNeg ? 'fw-result-stat__value--negative' : ''}">${s.displayStr}</div>
            <div class="fw-result-stat__label">${s.label}</div>
        </div>`).join('');

    const statsBlockHtml = statsHtml
        ? `<div class="fw-result-divider"></div>
           <div class="fw-result-impact-grid">${statsHtml}</div>`
        : '';

    // ── Artifact showcase (when specific artifacts were granted) ──────────
    let artifactShowcaseHtml = '';
    const grantedArtifacts = result.grantedArtifacts || [];
    if (grantedArtifacts.length > 0) {
        // Deduplicate by id and show each unique artifact once with a count
        const counts = new Map();
        for (const a of grantedArtifacts) {
            const key = a.id;
            if (counts.has(key)) {
                counts.get(key).count += 1;
            } else {
                counts.set(key, { ...a, count: 1 });
            }
        }
        const unique = [...counts.values()];
        const MAX_SHOWN = 4;
        const shownArtifacts = unique.slice(0, MAX_SHOWN);
        const overflowCount = unique.length - MAX_SHOWN;
        const pills = shownArtifacts.map(a => `
            <div class="fw-result-artifact-pill">
                <span class="fw-result-artifact-pill__icon">${a.icon}</span>
                <span class="fw-result-artifact-pill__name">${a.name}${a.count > 1 ? ` ×${a.count}` : ''}</span>
            </div>`).join('');
        const overflowPill = overflowCount > 0
            ? `<div class="fw-result-artifact-overflow">+${overflowCount} more</div>`
            : '';
        artifactShowcaseHtml = `
            <div class="fw-result-divider"></div>
            <div class="fw-result-artifacts-header">🎒 Artifacts Received</div>
            <div class="fw-result-artifacts-showcase">${pills}${overflowPill}</div>`;
    }

    // ── Full card HTML ────────────────────────────────────────────────────
    const cardHtml = `
        <div class="fw-result-card fw-result-card--v2${segment.isPrismatic ? ' is-prismatic' : ''}"
             data-rarity="${segment.rarity}"
             style="--rarity-color:${rarityConf.color};--rarity-glow:${rarityConf.glow};--rarity-bg:${rarityConf.bg};border-color:${rarityConf.color};">
            <div class="fw-result-ribbon">${rarityConf.label}</div>
            <div class="fw-result-emoji-orb">${segment.emoji}</div>
            <div class="fw-result-guild-row">
                ${emblemUrl ? `<img src="${emblemUrl}" alt="${guildDef?.name || ''}" class="fw-result-guild-row__image">` : ''}
                <span class="fw-result-guild-row__name">${guildDef?.name || result.guildId}</span>
            </div>
            <div class="fw-result-title">${segment.label}</div>
            <div class="fw-result-description">${result.description || segment.description}</div>
            ${statsBlockHtml}
            ${artifactShowcaseHtml}
            ${studentChipsHtml}
        </div>`;

    _setStageCaption(`${guildDef?.name || 'The guild'} has received ${segment.label}. Advance when you are ready for the next reveal.`);
    _setCardPhase('revealed');
    _updateSpinButton(true, 'Fate Revealed', 'Prepare the next presentation');
    _showResultReveal({
        cardHtml,
        rarity: segment.rarity,
        rarityColor: rarityConf.color,
        rarityGlow: rarityConf.glow,
        rarityBg: rarityConf.bg,
        isPrismatic: segment.isPrismatic === true,
        secondaryAction: {
            label: 'Close the Relic',
            onClick: () => closeFortunesWheel()
        },
        primaryAction: _wheelState.currentGuildIndex < _wheelState.guildOrder.length - 1
            ? {
                label: 'Present Next Guild',
                onClick: () => {
                    _hideResultReveal();
                    advanceWheel();
                }
            }
            : {
                label: 'Reveal Final Ledger',
                onClick: () => {
                    _hideResultReveal();
                    advanceWheel();
                }
            }
    });

    // ── Secondary sounds (staggered after the rarity sound that plays at spin-stop) ──
    if ((result.starsDelta || 0) > 0)               setTimeout(() => playSound('star2'),        400);
    if ((result.goldDelta || 0) > 0)                setTimeout(() => playSound('cash'),         600);
    if ((result.artifactsGranted || 0) > 0)         setTimeout(() => playSound('magic_chime'),  800);
    if ((result.starsDelta || 0) < 0 || (result.artifactsRemoved || 0) > 0) {
        setTimeout(() => playSound('star_remove'), 400);
    }
}

function _renderWheelSummary() {
    const summaryEl = document.getElementById('fw-summary');
    if (!summaryEl) return;
    _hideResultReveal();

    const canvasWrap = document.getElementById('fw-canvas-wrap');
    if (canvasWrap) canvasWrap.classList.add('hidden');
    const stageFrame = document.getElementById('fw-stage-frame');
    if (stageFrame) stageFrame.classList.add('is-locked');
    const resultEl = document.getElementById('fw-result');
    if (resultEl) resultEl.classList.add('hidden');
    const headerEl = document.getElementById('fw-guild-header');
    if (headerEl) headerEl.innerHTML = '<div class="fw-guild-banner fw-guild-banner--summary"><div class="fw-guild-banner__copy"><div class="fw-guild-banner__eyebrow">Ceremony Complete</div><div class="fw-guild-banner__name">Fortune Ledger</div></div></div>';

    _renderGuildProgress(true);
    _renderWheelLegend();
    _setCardPhase('summary');
    _setStageEmblem(null);
    _setStageCaption('All omens have been revealed. Review the final ledger before closing the ceremony.');

    const nextBtn = document.getElementById('fw-next-btn');
    if (nextBtn) nextBtn.classList.add('hidden');

    const deltaChip = (value, icon, label, isNeg = value < 0) => `
        <span class="fw-summary-delta${isNeg ? ' fw-summary-delta--negative' : ''}" title="${label}">
            <span class="fw-summary-delta__icon">${icon}</span>${value}
        </span>`;

    summaryEl.innerHTML = `
        <div class="fw-summary-header">
            <div class="fw-summary-eyebrow">Weekly Outcome</div>
            <div class="fw-summary-title">Guild Fortune Ledger</div>
        </div>
        <div class="fw-summary-grid">
        ${_wheelState.results.map((r, index) => {
            const guildDef = getGuildById(r.guildId);
            const rarityConf = getRarityPalette(r.rarity, r.paletteIndex);
            const emblemUrl = getGuildEmblemUrl(r.guildId);
            const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;
            const deltas = [
                r.gloryDelta ? deltaChip(signed(r.gloryDelta), '⚜️', 'Glory', r.gloryDelta < 0) : '',
                r.goldDelta ? deltaChip(signed(r.goldDelta), '🪙', 'Gold', r.goldDelta < 0) : '',
                r.starsDelta ? deltaChip(signed(r.starsDelta), '⭐', 'Stars', r.starsDelta < 0) : '',
                r.classQuestDelta ? deltaChip(signed(r.classQuestDelta), '🗺️', 'Quest Bonus', r.classQuestDelta < 0) : '',
                (r.artifactsGranted || r.artifactsRemoved)
                    ? deltaChip(`${r.artifactsGranted ? `+${r.artifactsGranted}` : ''}${r.artifactsGranted && r.artifactsRemoved ? ' / ' : ''}${r.artifactsRemoved ? `-${r.artifactsRemoved}` : ''}`, '🎒', 'Artifacts', (r.artifactsRemoved || 0) > 0)
                    : '',
            ].join('');
            return `
                <div class="fw-summary-item" data-rarity="${r.rarity}" style="--guild-primary:${guildDef?.primary || '#9a7128'};--rarity-color:${rarityConf.color};--rarity-bg:${rarityConf.bg};animation-delay:${(0.08 + index * 0.1).toFixed(2)}s">
                    <div class="fw-summary-guild">
                        ${emblemUrl ? `<img src="${emblemUrl}" alt="${guildDef?.name || r.guildId}" class="fw-summary-emblem">` : ''}
                        <span>${guildDef?.name || r.guildId}</span>
                    </div>
                    <div class="fw-summary-result">${r.segmentLabel}</div>
                    <div class="fw-summary-rarity">${rarityConf.label}</div>
                    <div class="fw-summary-desc">${r.description || r.segmentDescription}</div>
                    ${deltas ? `<div class="fw-summary-deltas">${deltas}</div>` : ''}
                </div>`;
        }).join('')}
        </div>`;
    summaryEl.classList.remove('hidden');

    const doneBtn = document.getElementById('fw-done-btn');
    if (doneBtn) {
        doneBtn.innerHTML = '<span class="font-title">Close the Relic</span>';
        doneBtn.classList.remove('hidden');
        doneBtn.onclick = () => closeFortunesWheel();
    }

    _updateSpinButton(true, 'Ceremony Complete', 'Review the final ledger');
}

function _renderGuildProgress(allComplete = false) {
    const progressEl = document.getElementById('fw-progress');
    if (!progressEl) return;

    progressEl.innerHTML = _wheelState.guildOrder.map((guildId, index) => {
        const guildDef = getGuildById(guildId);
        const emblemUrl = getGuildEmblemUrl(guildId);
        const stateName = allComplete
            ? 'complete'
            : index < _wheelState.currentGuildIndex
                ? 'complete'
                : index === _wheelState.currentGuildIndex && _wheelState.phase !== 'summary'
                    ? 'current'
                    : 'upcoming';
        return `
            <div class="fw-progress-pill" data-state="${stateName}" style="--guild-primary:${guildDef?.primary || '#999'};">
                <div class="fw-progress-pill__crest">
                    ${emblemUrl ? `<img src="${emblemUrl}" alt="${guildDef?.name || guildId}" class="fw-progress-pill__image">` : `<span>${index + 1}</span>`}
                    ${stateName === 'complete' ? '<span class="fw-progress-pill__check" aria-hidden="true"><i class="fa-solid fa-check"></i></span>' : ''}
                </div>
                <div class="fw-progress-pill__copy">
                    <div class="fw-progress-pill__step">Guild ${index + 1}</div>
                    <div class="fw-progress-pill__name">${guildDef?.name || guildId}</div>
                </div>
            </div>`;
    }).join('');
}

function _setStageEmblem(guildId) {
    const imageEl = document.getElementById('fw-guild-emblem-image');
    const orbEl = document.querySelector('.fw-guild-emblem-orb');
    if (!imageEl || !orbEl) return;

    const emblemUrl = guildId ? getGuildEmblemUrl(guildId) : '';
    if (!emblemUrl) {
        imageEl.removeAttribute('src');
        imageEl.alt = '';
        orbEl.classList.add('is-empty');
        return;
    }

    const guildDef = getGuildById(guildId);
    imageEl.src = emblemUrl;
    imageEl.alt = guildDef?.name || guildId;
    orbEl.classList.remove('is-empty');
}

function _setStageCaption(text) {
    const captionEl = document.getElementById('fw-stage-caption');
    if (!captionEl) return;
    const t = String(text ?? '').trim();
    captionEl.textContent = t;
    captionEl.classList.toggle('hidden', !t);
}
