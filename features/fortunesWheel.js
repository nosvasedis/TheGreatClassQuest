// features/fortunesWheel.js — Fortune's Wheel: segment catalog, spin logic, canvas renderer, effect application

import * as state from '../state.js';
import { GUILD_IDS, getGuildById } from './guilds.js';
import { GLORY_PER_STAR, WHEEL_RARITY_WEIGHTS, WHEEL_RARITY_CONFIG, JUNIOR_LEAGUES } from '../constants.js';
import { adjustGuildGlory, applyGloryModifier, saveFortuneWheelResult, hasSpunThisWeek } from '../db/actions/guilds.js';
import { getISOWeekKey } from './guildScoring.js';
import { playSound, playHeroFanfare } from '../audio.js';
import { evaluateWheelAvailability } from '../utils/fortuneWheelEligibility.mjs';

// ═══════════════════════════════════════════════════════════════════════════════
// SEGMENT CATALOG
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Each segment has: id, emoji, label, description, rarity, category, effect function.
 * Categories: 'glory' (guild scoring), 'perk' (student/class), 'negative' (penalties), 'fun' (cosmetic + small bonus)
 */
const ALL_SEGMENTS = [
    // ── Glory Segments (~15) ──────────────────────────────────────────────────
    { id: 'glory_surge',       emoji: '⚜️', label: 'Glory Surge',       description: '+20 Glory instantly!',                              rarity: 'common',    category: 'glory', effect: (ctx) => instantGlory(ctx, 20) },
    { id: 'glory_fountain',    emoji: '⚜️', label: 'Glory Fountain',    description: '+50 Glory instantly!',                              rarity: 'uncommon',  category: 'glory', effect: (ctx) => instantGlory(ctx, 50) },
    { id: 'glory_storm',       emoji: '⚜️', label: 'Glory Storm',       description: '+100 Glory instantly!',                             rarity: 'rare',      category: 'glory', effect: (ctx) => instantGlory(ctx, 100) },
    { id: 'glory_boost_25',    emoji: '📈', label: 'Momentum Boost',    description: '+25% Glory generation for 1 day.',                  rarity: 'uncommon',  category: 'glory', effect: (ctx) => gloryMultiplier(ctx, 1.25, 1) },
    { id: 'glory_doubler',     emoji: '📈', label: 'Glory Doubler',     description: '2× Glory generation for 1 day!',                   rarity: 'rare',      category: 'glory', effect: (ctx) => gloryMultiplier(ctx, 2, 1) },
    { id: 'glory_tripler',     emoji: '📈', label: 'Glory Tripler',     description: '3× Glory generation for 1 day!',                   rarity: 'epic',      category: 'glory', effect: (ctx) => gloryMultiplier(ctx, 3, 1) },
    { id: 'glory_quadruple',   emoji: '📈', label: 'Quadruple Glory',   description: '4× Glory generation for 3 days!',                  rarity: 'legendary', category: 'glory', effect: (ctx) => gloryMultiplier(ctx, 4, 3) },
    { id: 'glory_rain',        emoji: '⚜️', label: 'Glory Rain',        description: 'Every guild member gets +5 Glory!',                rarity: 'epic',      category: 'glory', effect: (ctx) => instantGlory(ctx, ctx.memberCount * 5) },
    { id: 'precision_glory',   emoji: '🎯', label: 'Precision Glory',   description: 'Next 10 stars give +1 extra Glory each.',          rarity: 'uncommon',  category: 'glory', effect: (ctx) => bonusPerStar(ctx, 1, 10) },
    { id: 'glory_magnet',      emoji: '🧲', label: 'Glory Magnet',      description: '+2 Glory per star for 2 days!',                    rarity: 'rare',      category: 'glory', effect: (ctx) => bonusPerStarTimed(ctx, 2, 2) },
    { id: 'glory_shield',      emoji: '🛡️', label: 'Glory Shield',      description: 'Immune to negative wheel effects for 1 week.',    rarity: 'rare',      category: 'glory', effect: (ctx) => applyShield(ctx, 7) },
    { id: 'glory_momentum',    emoji: '⏳', label: 'Momentum Lock',     description: 'Momentum score locked — can\'t decrease for 1 week.', rarity: 'rare',  category: 'glory', effect: (ctx) => applyMomentumLock(ctx) },
    { id: 'rainbow_bridge',    emoji: '🌈', label: 'Rainbow Bridge',    description: 'All guilds get +10 Glory — unity bonus!',          rarity: 'common',    category: 'glory', effect: (ctx) => allGuildsGlory(ctx, 10) },

    // ── Student/Class Perks (~20) ─────────────────────────────────────────────
    { id: 'star_shower',       emoji: '⭐', label: 'Star Shower',       description: '2 random guild members get +1 star each!',         rarity: 'common',    category: 'perk',  effect: (ctx) => randomStars(ctx, 2, 1) },
    { id: 'star_storm',        emoji: '⭐', label: 'Star Storm',        description: '5 random guild members get +1 star each!',         rarity: 'rare',      category: 'perk',  effect: (ctx) => randomStars(ctx, 5, 1) },
    { id: 'star_supernova',    emoji: '⭐', label: 'Star Supernova',    description: 'ALL guild members get +1 star!',                   rarity: 'legendary', category: 'perk',  effect: (ctx) => randomStars(ctx, ctx.memberCount, 1) },
    { id: 'gold_rush',         emoji: '🪙', label: 'Gold Rush',         description: '3 random members get +15 gold each!',              rarity: 'common',    category: 'perk',  effect: (ctx) => randomGold(ctx, 3, 15) },
    { id: 'treasury_overflow', emoji: '🪙', label: 'Treasury Overflow', description: 'All guild members get +10 gold!',                  rarity: 'rare',      category: 'perk',  effect: (ctx) => randomGold(ctx, ctx.memberCount, 10) },
    { id: 'gold_rush_extreme', emoji: '💰', label: 'Gold Rush Extreme', description: 'All guild members get +50 gold!',                  rarity: 'epic',      category: 'perk',  effect: (ctx) => randomGold(ctx, ctx.memberCount, 50) },
    { id: 'mystery_gift',      emoji: '🎒', label: 'Mystery Gift',      description: '1 random member gets a free Legendary Artifact!',  rarity: 'rare',      category: 'perk',  effect: (ctx) => randomArtifact(ctx, 1) },
    { id: 'double_gift',       emoji: '🎒', label: 'Double Gift',       description: '2 random members each get a Legendary Artifact!',  rarity: 'epic',      category: 'perk',  effect: (ctx) => randomArtifact(ctx, 2) },
    { id: 'artifact_rain',     emoji: '🎁', label: 'Artifact Rain',     description: 'ALL guild members get a Mystery Artifact!',        rarity: 'legendary', category: 'perk',  effect: (ctx) => randomArtifact(ctx, ctx.memberCount) },
    { id: 'teachers_favor',    emoji: '🍎', label: 'Teacher\'s Favor',  description: '1 random member gets +2 stars and +30 gold!',      rarity: 'epic',      category: 'perk',  effect: (ctx) => teachersFavor(ctx) },
    { id: 'glory_blackhole',   emoji: '🌌', label: 'Glory Blackhole',   description: 'Lose 10 Glory, but ALL members get +25 gold!',     rarity: 'rare',      category: 'perk',  effect: (ctx) => gloryBlackhole(ctx) },
    { id: 'focus_aura',        emoji: '🎯', label: 'Focus Aura',        description: 'Next star gives double gold to any guild member.', rarity: 'uncommon',  category: 'perk',  effect: (ctx) => instantGlory(ctx, 15) },
    { id: 'spotlight',         emoji: '🌟', label: 'Spotlight',          description: '1 random member\'s next star gives 3× Glory!',    rarity: 'uncommon',  category: 'perk',  effect: (ctx) => instantGlory(ctx, 20) },
    { id: 'scholars_blessing', emoji: '📚', label: 'Scholar\'s Blessing', description: 'Next test bonus doubled for the guild!',         rarity: 'uncommon',  category: 'perk',  effect: (ctx) => instantGlory(ctx, 15) },
    { id: 'treasure_chest',    emoji: '📦', label: 'Treasure Chest',    description: '+20 gold to 1 random member & +10 Glory!',         rarity: 'uncommon',  category: 'perk',  effect: (ctx) => { randomGold(ctx, 1, 20); return instantGlory(ctx, 10); } },
    { id: 'time_warp',         emoji: '⏰', label: 'Time Warp',         description: '+15 bonus momentum points this week!',             rarity: 'uncommon',  category: 'perk',  effect: (ctx) => instantGlory(ctx, 15) },
    { id: 'challenge',         emoji: '🥊', label: 'Glory Challenge',   description: 'Earn most Glory this week → bonus +50 Glory!',     rarity: 'epic',      category: 'perk',  effect: (ctx) => applyChallenge(ctx) },
    { id: 'fortress',          emoji: '🏰', label: 'Fortress',          description: 'Cannot lose Glory for 2 days!',                    rarity: 'epic',      category: 'perk',  effect: (ctx) => applyShield(ctx, 2) },

    // ── Fun / Cosmetic ────────────────────────────────────────────────────────
    { id: 'anthem_power',      emoji: '🎵', label: 'Anthem Power',      description: 'Guild anthem plays + +10 Glory!',                  rarity: 'common',    category: 'fun',   effect: (ctx) => instantGlory(ctx, 10) },
    { id: 'celebration',       emoji: '🎆', label: 'Celebration!',      description: 'Confetti explosion + +5 Glory!',                   rarity: 'common',    category: 'fun',   effect: (ctx) => instantGlory(ctx, 5) },
    { id: 'carnival',          emoji: '🎪', label: 'Carnival',          description: '3 random members get a small surprise!',           rarity: 'common',    category: 'fun',   effect: (ctx) => { randomGold(ctx, 3, 5); return instantGlory(ctx, 5); } },
    { id: 'stardust_trail',    emoji: '💫', label: 'Stardust Trail',    description: 'Stars earned leave sparkle trails + +1 Glory each!', rarity: 'uncommon', category: 'fun',  effect: (ctx) => bonusPerStarTimed(ctx, 1, 2) },
    { id: 'oracles_vision',    emoji: '🔮', label: 'Oracle\'s Vision',  description: 'Peek at a secret hint + +8 Glory!',               rarity: 'common',    category: 'fun',   effect: (ctx) => instantGlory(ctx, 8) },

    // ── Negative / Spicy (~8) ─────────────────────────────────────────────────
    { id: 'glory_tax',         emoji: '🔻', label: 'Glory Tax',         description: 'Lose 10% of weekly Glory.',                        rarity: 'common',    category: 'negative', effect: (ctx) => gloryTax(ctx, 0.10) },
    { id: 'glory_eclipse',     emoji: '🔻', label: 'Glory Eclipse',     description: 'Halve this week\'s Glory!',                        rarity: 'cursed',    category: 'negative', effect: (ctx) => gloryTax(ctx, 0.50) },
    { id: 'glory_heist',       emoji: '🏴‍☠️', label: 'Glory Heist',     description: 'Steal 15% of the leading guild\'s weekly Glory!',  rarity: 'cursed',    category: 'negative', effect: (ctx) => gloryHeist(ctx, 0.15) },
    { id: 'slumber',           emoji: '💤', label: 'Slumber',           description: 'Glory generation halved for 1 day.',               rarity: 'uncommon',  category: 'negative', effect: (ctx) => gloryMultiplier(ctx, 0.5, 1) },
    { id: 'tangled_web',       emoji: '🕸️', label: 'Tangled Web',      description: 'Momentum score counts as 0 this week.',             rarity: 'rare',      category: 'negative', effect: (ctx) => instantGlory(ctx, -15) },
    { id: 'market_crash',      emoji: '📉', label: 'Market Crash',      description: 'All guilds lose 5% weekly Glory!',                 rarity: 'common',    category: 'negative', effect: (ctx) => allGuildsTax(ctx, 0.05) },
    { id: 'trickster',         emoji: '🎭', label: 'Trickster',         description: 'What looks like a win... turns out to be nothing!', rarity: 'common',   category: 'negative', effect: () => ({ gloryDelta: 0, description: 'The Trickster laughs! Nothing happened.' }) },
    { id: 'lightning_strike',  emoji: '⚡', label: 'Lightning Strike',  description: 'Lose 30 Glory instantly!',                         rarity: 'uncommon',  category: 'negative', effect: (ctx) => instantGlory(ctx, -30) },
];

// ═══════════════════════════════════════════════════════════════════════════════
// EFFECT IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function instantGlory(ctx, amount) {
    await adjustGuildGlory(ctx.guildId, amount, 'wheel');
    return { gloryDelta: amount, description: `${amount >= 0 ? '+' : ''}${amount} Glory applied.` };
}

async function gloryMultiplier(ctx, factor, days) {
    const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
    const label = factor < 1
        ? `Fortune's Wheel: ${factor}× Glory (${days}d)`
        : `Fortune's Wheel: ${factor}× Glory (${days}d)`;
    await applyGloryModifier(ctx.guildId, { type: 'multiply', factor, expiresAt, label, createdAt: Date.now() });
    return { gloryDelta: 0, modifierCreated: { type: 'multiply', factor, expiresAt, label }, description: `${factor}× Glory for ${days} day${days > 1 ? 's' : ''}!` };
}

async function bonusPerStar(ctx, amount, charges) {
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const label = `Fortune's Wheel: +${amount} Glory/star (${charges} charges)`;
    await applyGloryModifier(ctx.guildId, { type: 'bonus_per_star', amount, expiresAt, label, charges, createdAt: Date.now() });
    return { gloryDelta: 0, modifierCreated: { type: 'bonus_per_star', amount }, description: `+${amount} bonus Glory per star (next ${charges} stars).` };
}

async function bonusPerStarTimed(ctx, amount, days) {
    const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
    const label = `Fortune's Wheel: +${amount} Glory/star (${days}d)`;
    await applyGloryModifier(ctx.guildId, { type: 'bonus_per_star', amount, expiresAt, label, createdAt: Date.now() });
    return { gloryDelta: 0, modifierCreated: { type: 'bonus_per_star', amount }, description: `+${amount} bonus Glory per star for ${days} day${days > 1 ? 's' : ''}!` };
}

async function applyShield(ctx, days) {
    const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
    await applyGloryModifier(ctx.guildId, { type: 'shield', expiresAt, label: `Glory Shield (${days}d)`, createdAt: Date.now() });
    return { gloryDelta: 0, description: `Protected from negative effects for ${days} day${days > 1 ? 's' : ''}!` };
}

async function applyMomentumLock(ctx) {
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await applyGloryModifier(ctx.guildId, { type: 'momentum_lock', expiresAt, label: 'Momentum Lock (1 week)', createdAt: Date.now() });
    return { gloryDelta: 0, description: 'Momentum score locked — can\'t decrease this week!' };
}

async function applyChallenge(ctx) {
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await applyGloryModifier(ctx.guildId, { type: 'challenge', bonus: 50, expiresAt, label: 'Glory Challenge (+50 if #1 this week)', createdAt: Date.now() });
    return { gloryDelta: 0, description: 'Challenge accepted! Earn the most Glory this week for +50 bonus!' };
}

async function gloryTax(ctx, fraction) {
    // Check shield
    const allGuildScores = state.get('allGuildScores') || {};
    const gData = allGuildScores[ctx.guildId] || {};
    const hasShield = (gData.gloryModifiers || []).some(m => m.type === 'shield' && m.expiresAt > Date.now());
    if (hasShield) return { gloryDelta: 0, description: 'Glory Shield blocked the penalty!' };

    const weeklyGlory = Number(gData.weeklyGlory) || 0;
    const loss = -Math.round(weeklyGlory * fraction);
    if (loss < 0) await adjustGuildGlory(ctx.guildId, loss, 'wheel_tax');
    return { gloryDelta: loss, description: `Lost ${Math.abs(loss)} Glory (${Math.round(fraction * 100)}% of weekly).` };
}

async function gloryHeist(ctx, fraction) {
    // Check shield
    const allGuildScores = state.get('allGuildScores') || {};
    const gData = allGuildScores[ctx.guildId] || {};
    const hasShield = (gData.gloryModifiers || []).some(m => m.type === 'shield' && m.expiresAt > Date.now());

    // Find leader guild (not the current one)
    let leaderGuildId = null;
    let leaderWeeklyGlory = 0;
    for (const gid of GUILD_IDS) {
        if (gid === ctx.guildId) continue;
        const g = allGuildScores[gid] || {};
        if ((Number(g.weeklyGlory) || 0) > leaderWeeklyGlory) {
            leaderWeeklyGlory = Number(g.weeklyGlory);
            leaderGuildId = gid;
        }
    }
    if (!leaderGuildId || leaderWeeklyGlory === 0) return { gloryDelta: 0, description: 'No leader to steal from!' };

    // Check if leader has shield
    const leaderData = allGuildScores[leaderGuildId] || {};
    const leaderHasShield = (leaderData.gloryModifiers || []).some(m => m.type === 'shield' && m.expiresAt > Date.now());
    if (leaderHasShield) return { gloryDelta: 0, description: `${getGuildById(leaderGuildId)?.name || 'Leader'}'s Glory Shield blocked the heist!` };

    const stolen = Math.round(leaderWeeklyGlory * fraction);
    if (stolen > 0) {
        await adjustGuildGlory(leaderGuildId, -stolen, 'wheel_heist_loss');
        await adjustGuildGlory(ctx.guildId, stolen, 'wheel_heist_gain');
    }
    return { gloryDelta: stolen, description: `Stole ${stolen} Glory from ${getGuildById(leaderGuildId)?.name || 'the leader'}!` };
}

async function allGuildsGlory(ctx, amount) {
    for (const gid of GUILD_IDS) {
        await adjustGuildGlory(gid, amount, 'wheel_all');
    }
    return { gloryDelta: amount, description: `All guilds received +${amount} Glory!` };
}

async function allGuildsTax(ctx, fraction) {
    const allGuildScores = state.get('allGuildScores') || {};
    let totalLoss = 0;
    for (const gid of GUILD_IDS) {
        const g = allGuildScores[gid] || {};
        const hasShield = (g.gloryModifiers || []).some(m => m.type === 'shield' && m.expiresAt > Date.now());
        if (hasShield) continue;
        const loss = -Math.round((Number(g.weeklyGlory) || 0) * fraction);
        if (loss < 0) await adjustGuildGlory(gid, loss, 'wheel_crash');
        if (gid === ctx.guildId) totalLoss = loss;
    }
    return { gloryDelta: totalLoss, description: `Market crash! All guilds lost ${Math.round(fraction * 100)}% weekly Glory.` };
}

async function randomStars(ctx, count, amount) {
    const members = ctx.guildStudents || [];
    const selected = shuffleArray([...members]).slice(0, Math.min(count, members.length));
    const names = selected.map(s => s.name).join(', ');
    // Stars will be awarded by the teacher through the normal flow — we just record which students
    return {
        gloryDelta: 0,
        affectedStudents: selected.map(s => s.id),
        description: count >= members.length
            ? `All ${members.length} guild members get +${amount} star!`
            : `${names} ${selected.length > 1 ? 'each get' : 'gets'} +${amount} star!`
    };
}

async function randomGold(ctx, count, amount) {
    const members = ctx.guildStudents || [];
    const selected = shuffleArray([...members]).slice(0, Math.min(count, members.length));
    const names = selected.map(s => s.name).join(', ');
    return {
        gloryDelta: 0,
        affectedStudents: selected.map(s => s.id),
        description: count >= members.length
            ? `All guild members get +${amount} gold!`
            : `${names} ${selected.length > 1 ? 'each get' : 'gets'} +${amount} gold!`
    };
}

async function randomArtifact(ctx, count) {
    const members = ctx.guildStudents || [];
    const selected = shuffleArray([...members]).slice(0, Math.min(count, members.length));
    const names = selected.map(s => s.name).join(', ');
    return {
        gloryDelta: 0,
        affectedStudents: selected.map(s => s.id),
        description: count >= members.length
            ? `All guild members receive a Mystery Artifact!`
            : `${names} ${selected.length > 1 ? 'each receive' : 'receives'} a Mystery Artifact!`
    };
}

async function teachersFavor(ctx) {
    const members = ctx.guildStudents || [];
    if (members.length === 0) return { gloryDelta: 0, description: 'No students to receive favor.' };
    const selected = shuffleArray([...members])[0];
    return {
        gloryDelta: 0,
        affectedStudents: [selected.id],
        description: `${selected.name} receives +2 stars and +30 gold from the Teacher's Favor!`
    };
}

async function gloryBlackhole(ctx) {
    const members = ctx.guildStudents || [];
    await adjustGuildGlory(ctx.guildId, -10, 'wheel_blackhole');
    return {
        gloryDelta: -10,
        affectedStudents: members.map(s => s.id),
        description: `Lost 10 Glory to the Blackhole, but all members get +25 gold!`
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

/**
 * Generate 20 wheel segments for a spin, weighted by rarity and filtered by league.
 * @param {string} leagueLevel - e.g. 'Junior A', 'B', 'C'
 * @returns {Array} 20 segments
 */
export function generateWheelSegments(leagueLevel) {
    const isJunior = JUNIOR_LEAGUES.includes(leagueLevel);

    // Filter pool: juniors exclude cursed and harsh negatives
    let pool = ALL_SEGMENTS.filter(seg => {
        if (isJunior && seg.rarity === 'cursed') return false;
        if (isJunior && seg.category === 'negative' && ['glory_eclipse', 'glory_heist', 'tangled_web', 'lightning_strike'].includes(seg.id)) return false;
        return true;
    });

    // Build weighted pool
    const weighted = [];
    for (const seg of pool) {
        const weight = WHEEL_RARITY_WEIGHTS[seg.rarity] || 10;
        for (let i = 0; i < weight; i++) weighted.push(seg);
    }

    // Select 20 unique segments (by id)
    const selected = new Map();
    let attempts = 0;
    const maxAttempts = 500;

    // Ensure variety constraints
    let cursedCount = 0;
    let epicCount = 0;
    let legendaryCount = 0;
    let negativeCount = 0;
    let hasRarePlus = false;

    while (selected.size < 20 && attempts < maxAttempts) {
        attempts++;
        const candidate = weighted[Math.floor(Math.random() * weighted.length)];
        if (selected.has(candidate.id)) continue;

        // Variety constraints
        if (candidate.rarity === 'cursed' && cursedCount >= 1) continue;
        if (candidate.rarity === 'epic' && epicCount >= 2) continue;
        if (candidate.rarity === 'legendary' && legendaryCount >= 1) continue;
        if (candidate.category === 'negative' && negativeCount >= 4) continue;

        selected.set(candidate.id, candidate);
        if (candidate.rarity === 'cursed') cursedCount++;
        if (candidate.rarity === 'epic') epicCount++;
        if (candidate.rarity === 'legendary') legendaryCount++;
        if (candidate.category === 'negative') negativeCount++;
        if (['rare', 'epic', 'legendary'].includes(candidate.rarity)) hasRarePlus = true;
    }

    // Ensure at least 1 rare+ segment
    if (!hasRarePlus && pool.some(s => s.rarity === 'rare')) {
        const rares = pool.filter(s => s.rarity === 'rare');
        const rare = rares[Math.floor(Math.random() * rares.length)];
        // Replace a common segment
        const commons = [...selected.values()].filter(s => s.rarity === 'common');
        if (commons.length > 0) {
            selected.delete(commons[0].id);
            selected.set(rare.id, rare);
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
        alreadySpun,
    });

    return availability.allowed;
}

/**
 * Execute a full Fortune's Wheel spin for one guild.
 * @param {string} guildId
 * @param {object} segment - The winning segment
 * @param {string} classId - For student targeting
 * @returns {Promise<object>} result with gloryDelta, description, affectedStudents, etc.
 */
export async function applyWheelResult(guildId, segment, classId) {
    const allStudents = state.get('allStudents') || [];
    const guildStudents = allStudents.filter(s => s.guildId === guildId && s.classId === classId);
    const allGuildScores = state.get('allGuildScores') || {};
    const gData = allGuildScores[guildId] || {};

    const ctx = {
        guildId,
        classId,
        guildStudents,
        memberCount: guildStudents.length || 1,
        weeklyGlory: Number(gData.weeklyGlory) || 0,
    };

    try {
        const result = await segment.effect(ctx);
        return {
            guildId,
            segmentId: segment.id,
            segmentLabel: `${segment.emoji} ${segment.label}`,
            segmentDescription: segment.description,
            rarity: segment.rarity,
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
            description: 'Effect could not be applied.',
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANVAS WHEEL RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

const TAU = Math.PI * 2;

/**
 * Draw the wheel on a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {Array} segments - 20 segments
 * @param {number} rotationAngle - Current rotation in radians
 * @param {object} guildDef - Guild definition for center emblem colors
 */
export function drawWheel(canvas, segments, rotationAngle, guildDef) {
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 20;
    const segCount = segments.length;
    const segAngle = TAU / segCount;

    ctx.clearRect(0, 0, size, size);
    const aura = ctx.createRadialGradient(center, center, radius * 0.16, center, center, radius * 1.12);
    aura.addColorStop(0, `${guildDef?.glow || '#a78bfa'}66`);
    aura.addColorStop(0.55, 'rgba(50, 20, 95, 0.35)');
    aura.addColorStop(1, 'rgba(6, 3, 20, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(rotationAngle);

    // Outer glowing rim
    ctx.beginPath();
    ctx.arc(0, 0, radius + 8, 0, TAU);
    const rimGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    rimGrad.addColorStop(0, 'rgba(255, 236, 196, 0.8)');
    rimGrad.addColorStop(0.5, 'rgba(218, 165, 32, 0.6)');
    rimGrad.addColorStop(1, 'rgba(255, 236, 196, 0.8)');
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = Math.max(12, size / 50);
    ctx.stroke();

    // Wheel background disc
    const wheelDisc = ctx.createRadialGradient(0, 0, radius * 0.05, 0, 0, radius);
    wheelDisc.addColorStop(0, 'rgba(255,255,255,0.2)');
    wheelDisc.addColorStop(0.45, 'rgba(75, 25, 125, 0.12)');
    wheelDisc.addColorStop(1, 'rgba(10, 4, 26, 0.5)');
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fillStyle = wheelDisc;
    ctx.fill();

    for (let i = 0; i < segCount; i++) {
        const seg = segments[i];
        const startAngle = i * segAngle;
        const endAngle = startAngle + segAngle;
        const rarityConf = WHEEL_RARITY_CONFIG[seg.rarity] || WHEEL_RARITY_CONFIG.common;
        
        // Wedge gradient
        const gradient = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
        gradient.addColorStop(0, rarityConf.bg);
        gradient.addColorStop(0.7, `${rarityConf.bg}ee`);
        gradient.addColorStop(1, rarityConf.color);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Inner shadow effect for wedges
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Wedge borders
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius);
        ctx.strokeStyle = `${rarityConf.color}dd`;
        ctx.lineWidth = Math.max(2, size / 160);
        ctx.stroke();

        ctx.save();
        ctx.rotate(startAngle + segAngle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const labelRadius = radius - Math.max(40, size * 0.1);
        const label = String(seg.label || '');
        const maxLabelLen = size > 500 ? 18 : 14;
        const truncated = label.length > maxLabelLen ? `${label.slice(0, maxLabelLen - 1)}...` : label;

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = Math.max(6, size / 70);
        ctx.font = `700 ${Math.max(14, Math.floor(size / 28))}px Georgia, serif`;
        ctx.fillText(seg.emoji || '*', labelRadius, -Math.max(16, size * 0.03));
        ctx.font = `700 ${Math.max(11, Math.floor(size / 34))}px "Trebuchet MS", system-ui, sans-serif`;
        ctx.fillText(truncated, labelRadius, Math.max(10, size * 0.025));
        ctx.restore();
    }

    // Center Logo / Emblem
    const innerRadius = radius * 0.28;
    
    // Center glowing aura
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius + 15, 0, TAU);
    const centerAura = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, innerRadius + 15);
    centerAura.addColorStop(0, `${guildDef?.glow || '#a78bfa'}99`);
    centerAura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = centerAura;
    ctx.fill();

    // Center metallic rim
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius, 0, TAU);
    const primary = guildDef?.primary || '#7c3aed';
    const secondary = guildDef?.secondary || '#a78bfa';
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, innerRadius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, secondary);
    grad.addColorStop(0.8, primary);
    grad.addColorStop(1, '#1a0536');
    ctx.fillStyle = grad;
    ctx.fill();
    
    const innerRimGrad = ctx.createLinearGradient(-innerRadius, -innerRadius, innerRadius, innerRadius);
    innerRimGrad.addColorStop(0, '#fff');
    innerRimGrad.addColorStop(0.5, '#ffdca8');
    innerRimGrad.addColorStop(1, '#8c6222');
    ctx.strokeStyle = innerRimGrad;
    ctx.lineWidth = Math.max(6, size / 90);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, innerRadius * 0.75, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = Math.max(2, size / 190);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.shadowColor = `${guildDef?.glow || '#a78bfa'}ee`;
    ctx.shadowBlur = Math.max(20, size / 25);
    ctx.font = `${Math.floor(innerRadius * 1.15)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(guildDef?.emoji || '*', 0, 4);

    ctx.restore();
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
        // The pointer is at π/2 (bottom) or -π/2 (top). We'll use top.
        // Winner segment center should align with -π/2 after rotation
        const winnerCenterAngle = winnerIndex * segAngle + segAngle / 2;
        const targetAngle = -winnerCenterAngle - Math.PI / 2;

        // Add extra full spins for drama (5-8 full rotations)
        const extraSpins = (5 + Math.floor(Math.random() * 4)) * TAU;
        const totalRotation = extraSpins + (TAU - (targetAngle % TAU) + TAU) % TAU;

        const duration = 4500 + Math.random() * 1500; // 4.5-6s
        const startTime = performance.now();
        let lastSegIndex = -1;

        function easeOutQuart(t) {
            return 1 - Math.pow(1 - t, 4);
        }

        function frame(now) {
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / duration);
            const eased = easeOutQuart(t);
            const currentAngle = totalRotation * eased;

            drawWheel(canvas, segments, currentAngle, guildDef);

            // Tick sound on segment boundary crossing
            const normalizedAngle = ((currentAngle % TAU) + TAU) % TAU;
            const currentSegIndex = Math.floor(normalizedAngle / segAngle) % segCount;
            if (currentSegIndex !== lastSegIndex) {
                lastSegIndex = currentSegIndex;
                if (onTick && t < 0.98) onTick();
            }

            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                // Final draw at exact target
                drawWheel(canvas, segments, totalRotation, guildDef);
                setTimeout(resolve, 600);
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
};
let _wheelResizeWired = false;

export function getWheelState() { return _wheelState; }

/**
 * Open the Fortune's Wheel modal. ALWAYS opens — shows a locked/unavailable
 * state with a gameified message if conditions aren't met.
 * @param {string|null} classId   — pre-selects a class; falls back to globalSelectedClassId
 * @param {string|null} leagueLevel — optional hint; derived from class if omitted
 */
export async function openFortunesWheel(classId, leagueLevel) {
    const modal = document.getElementById('fortunes-wheel-modal');
    if (!modal) return;

    // Always show the modal first
    modal.classList.remove('hidden');
    modal.classList.add('is-open');
    _wireWheelResize();

    // ── Resolve class ───────────────────────────────────────────────────────
    const resolvedClassId = classId || state.get('globalSelectedClassId') || '';
    _populateClassSelector(resolvedClassId);

    const allClasses = state.get('allTeachersClasses') || [];
    const selectedClass = allClasses.find(c => c.id === resolvedClassId) || null;
    const resolvedLeague = leagueLevel || selectedClass?.questLevel || state.get('globalSelectedLeague') || 'B';

    await _evaluateAndRender(resolvedClassId || null, resolvedLeague);
}

function _wireWheelResize() {
    if (_wheelResizeWired) return;
    _wheelResizeWired = true;
    window.addEventListener('resize', () => {
        if (_wheelState.phase !== 'ready' && _wheelState.phase !== 'spinning') return;
        _sizeAndRenderWheel();
    });
}

/**
 * Populate (or re-populate) the in-modal class selector and wire its change event.
 */
function _populateClassSelector(selectedClassId) {
    const select = document.getElementById('fw-class-select');
    if (!select) return;

    const classes = (state.get('allTeachersClasses') || [])
        .sort((a, b) => a.name.localeCompare(b.name));

    select.innerHTML = '<option value="">\u2014 Select a class \u2014</option>' +
        classes.map(c =>
            `<option value="${c.id}"${c.id === selectedClassId ? ' selected' : ''}>${c.logo} ${c.name} (${c.questLevel})</option>`
        ).join('');

    // Re-wire (safe to overwrite)
    select.onchange = async () => {
        const newId = select.value;
        const cls = (state.get('allTeachersClasses') || []).find(c => c.id === newId) || null;
        const league = cls?.questLevel || state.get('globalSelectedLeague') || 'B';
        await _evaluateAndRender(newId || null, league);
    };
}

/**
 * Core availability check + render. Called on open and whenever the class selector changes.
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
        alreadySpun,
    });

    _renderAvailability(availability);

    if (!availability.allowed) {
        _wheelState = { active: false, classId: null, leagueLevel: null, guildOrder: [], currentGuildIndex: 0, segments: [], results: [], phase: 'idle' };
        _renderLockedState(availability);
        return;
    }

    _wheelState = {
        active: true,
        classId,
        leagueLevel,
        guildOrder: [...GUILD_IDS],
        currentGuildIndex: 0,
        segments: [],
        results: [],
        phase: 'ready',
    };

    // Generate first guild's segments
    _wheelState.segments = generateWheelSegments(leagueLevel);
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

    root.dataset.state = availability.code || 'locked';
    titleEl.textContent = availability.title || 'Fortune awaits';
    messageEl.textContent = availability.message || '';
    metaEl.textContent = availability.meta || '';
    metaEl.classList.toggle('hidden', !availability.meta);
}

function _renderLockedState(title, message, emoji) {
    const availability = typeof title === 'object'
        ? title
        : { title, message, emoji, code: 'locked' };

    const canvasWrap = document.getElementById('fw-canvas-wrap');
    if (canvasWrap) canvasWrap.classList.add('hidden');
    const stageFrame = document.getElementById('fw-stage-frame');
    if (stageFrame) {
        stageFrame.classList.add('is-locked');
        stageFrame.classList.remove('is-spinning');
    }

    const summaryEl = document.getElementById('fw-summary');
    if (summaryEl) summaryEl.classList.add('hidden');

    const resultEl = document.getElementById('fw-result');
    if (resultEl) {
        const orb = availability.emoji
            || (availability.code === 'already_spun' ? '⌛' : availability.code === 'outside_lesson' ? '🕰️' : '✦');
        resultEl.innerHTML = `
            <div class="fw-locked-state">
                <div class="fw-locked-sparkles" aria-hidden="true">✦ ✧ ✦ ✧ ✦</div>
                <div class="fw-locked-orb">${orb}</div>
                <h3 class="fw-locked-title">${availability.title}</h3>
                <p class="fw-locked-message">${availability.message}</p>
                ${availability.meta ? `<p class="fw-locked-meta">${availability.meta}</p>` : ''}
                <div class="fw-locked-divider">
                    <span>✦</span><span class="fw-locked-gem">◈</span><span>✦</span>
                </div>
            </div>`;
        resultEl.classList.remove('hidden');
    }

    _updateSpinButton(true, availability.code === 'already_spun' ? 'Recharging' : 'Await Final Lesson');
    const nextBtn = document.getElementById('fw-next-btn');
    if (nextBtn) nextBtn.classList.add('hidden');
    const doneBtn = document.getElementById('fw-done-btn');
    if (doneBtn) doneBtn.classList.add('hidden');
}

/**
 * Called when teacher clicks "Spin!" for the current guild.
 */
export async function triggerSpin() {
    if (_wheelState.phase !== 'ready') return;
    _wheelState.phase = 'spinning';

    const canvas = document.getElementById('fortunes-wheel-canvas');
    const guildId = _wheelState.guildOrder[_wheelState.currentGuildIndex];
    const guildDef = getGuildById(guildId);
    const segments = _wheelState.segments;
    const winnerIndex = spinWheel(segments.length);
    const stageFrame = document.getElementById('fw-stage-frame');
    if (stageFrame) stageFrame.classList.add('is-spinning');

    _updateSpinButton(true, 'Spinning...');

    // Animate
    await animateWheelSpin(canvas, segments, winnerIndex, guildDef, () => {
        try { playSound('click'); } catch (_) {}
    });
    if (stageFrame) stageFrame.classList.remove('is-spinning');

    // Reveal sound based on rarity
    const winningSeg = segments[winnerIndex];
    try {
        if (winningSeg.rarity === 'legendary') playHeroFanfare();
        else if (winningSeg.rarity === 'epic') playSound('familiar_levelup');
        else if (winningSeg.rarity === 'rare') playSound('magic_chime');
        else if (winningSeg.rarity === 'cursed') playSound('star_remove');
        else playSound('star1');
    } catch (_) {}

    // Apply effect
    const result = await applyWheelResult(guildId, winningSeg, _wheelState.classId);
    _wheelState.results.push(result);
    _wheelState.phase = 'revealed';

    _renderWheelResult(winningSeg, result, guildDef);
}

/**
 * Advance to next guild or show summary.
 */
export function advanceWheel() {
    if (_wheelState.currentGuildIndex < _wheelState.guildOrder.length - 1) {
        _wheelState.currentGuildIndex++;
        _wheelState.segments = generateWheelSegments(_wheelState.leagueLevel);
        _wheelState.phase = 'ready';
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
    if (_wheelState.results.length > 0) {
        try {
            await saveFortuneWheelResult(_wheelState.classId, _wheelState.results);
        } catch (err) {
            console.error('Failed to save wheel results:', err);
        }
    }

    _wheelState = { active: false, classId: null, leagueLevel: null, guildOrder: [], currentGuildIndex: 0, segments: [], results: [], phase: 'idle' };

    const modal = document.getElementById('fortunes-wheel-modal');
    if (modal) {
        modal.classList.remove('is-open');
        modal.classList.add('hidden');
    }
}

// ── Internal UI helpers ──────────────────────────────────────────────────────

function _renderWheelPhase() {
    const guildId = _wheelState.guildOrder[_wheelState.currentGuildIndex];
    const guildDef = getGuildById(guildId);
    const guildNum = _wheelState.currentGuildIndex + 1;

    // Update header
    const headerEl = document.getElementById('fw-guild-header');
    if (headerEl) {
        headerEl.innerHTML = `
            <span class="fw-guild-emoji">${guildDef?.emoji || '⚜️'}</span>
            <span class="fw-guild-name" style="color:${guildDef?.primary || '#fff'}">${guildDef?.name || guildId}</span>
            <span class="fw-guild-progress">Guild ${guildNum} of ${_wheelState.guildOrder.length}</span>`;
    }

    const stageFrame = document.getElementById('fw-stage-frame');
    if (stageFrame) {
        stageFrame.classList.remove('is-locked');
        stageFrame.classList.remove('is-spinning');
    }

    const canvasWrap = document.getElementById('fw-canvas-wrap');
    if (canvasWrap) canvasWrap.classList.remove('hidden');
    _sizeAndRenderWheel();

    _updateSpinButton(false, 'Spin the Wheel');
    const resultEl = document.getElementById('fw-result');
    if (resultEl) resultEl.classList.add('hidden');
    const nextBtn = document.getElementById('fw-next-btn');
    if (nextBtn) nextBtn.classList.add('hidden');
    const doneBtn = document.getElementById('fw-done-btn');
    if (doneBtn) doneBtn.classList.add('hidden');
    const summaryEl = document.getElementById('fw-summary');
    if (summaryEl) summaryEl.classList.add('hidden');
}

function _sizeAndRenderWheel() {
    const canvas = document.getElementById('fortunes-wheel-canvas');
    if (!canvas || !_wheelState.segments?.length) return;
    const guildId = _wheelState.guildOrder[_wheelState.currentGuildIndex];
    const guildDef = getGuildById(guildId);

    const stageFrame = document.getElementById('fw-stage-frame');
    const stageRect = stageFrame?.getBoundingClientRect();
    const parentWidth = canvas.parentElement?.clientWidth || 520;
    const stageHeight = stageRect?.height || window.innerHeight * 0.58;

    // Fit-first for 13–17" laptop heights, with minimum size fallback.
    const widthBudget = Math.min(parentWidth, window.innerWidth * 0.56);
    const heightBudget = Math.max(320, stageHeight - 44);
    const displaySize = Math.round(Math.max(280, Math.min(620, widthBudget, heightBudget)));

    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;
    canvas.width = displaySize;
    canvas.height = displaySize;
    drawWheel(canvas, _wheelState.segments, 0, guildDef);
}

function _updateSpinButton(disabled, label = 'Spin the Wheel') {
    const spinBtn = document.getElementById('fw-spin-btn');
    if (!spinBtn) return;
    spinBtn.disabled = disabled;
    spinBtn.classList.toggle('is-busy', disabled && label === 'Spinning...');
    const labelEl = spinBtn.querySelector('.fw-btn__label');
    if (labelEl) {
        labelEl.textContent = label;
    } else {
        spinBtn.textContent = label;
    }
}

function _renderWheelResult(segment, result, guildDef) {
    const resultEl = document.getElementById('fw-result');
    if (!resultEl) return;

    const rarityConf = WHEEL_RARITY_CONFIG[segment.rarity] || WHEEL_RARITY_CONFIG.common;
    const isNegative = segment.category === 'negative';

    resultEl.innerHTML = `
        <div class="fw-result-card" style="border-color:${rarityConf.color};box-shadow:0 0 30px ${rarityConf.glow};">
            <div class="fw-result-rarity" style="background:${rarityConf.bg};color:${rarityConf.color};border-color:${rarityConf.color}40;">${rarityConf.label}</div>
            <div class="fw-result-emoji">${segment.emoji}</div>
            <div class="fw-result-title">${segment.label}</div>
            <div class="fw-result-description">${result.description || segment.description}</div>
            ${result.gloryDelta ? `<div class="fw-result-glory ${isNegative ? 'fw-result-glory--negative' : ''}">${result.gloryDelta >= 0 ? '+' : ''}${result.gloryDelta} ⚜️ Glory</div>` : ''}
            ${result.affectedStudents?.length ? `<div class="fw-result-students">${result.affectedStudents.length} student${result.affectedStudents.length > 1 ? 's' : ''} affected</div>` : ''}
        </div>`;
    resultEl.classList.remove('hidden');

    _updateSpinButton(true, 'Fate Revealed');

    if (_wheelState.currentGuildIndex < _wheelState.guildOrder.length - 1) {
        const nextBtn = document.getElementById('fw-next-btn');
        if (nextBtn) nextBtn.classList.remove('hidden');
    } else {
        const doneBtn = document.getElementById('fw-done-btn');
        if (doneBtn) {
            doneBtn.textContent = '📊 View Summary';
            doneBtn.classList.remove('hidden');
            doneBtn.onclick = () => advanceWheel();
        }
    }
}

function _renderWheelSummary() {
    const summaryEl = document.getElementById('fw-summary');
    if (!summaryEl) return;

    const canvasWrap = document.getElementById('fw-canvas-wrap');
    if (canvasWrap) canvasWrap.classList.add('hidden');
    const stageFrame = document.getElementById('fw-stage-frame');
    if (stageFrame) stageFrame.classList.add('is-locked');
    const resultEl = document.getElementById('fw-result');
    if (resultEl) resultEl.classList.add('hidden');
    const headerEl = document.getElementById('fw-guild-header');
    if (headerEl) headerEl.innerHTML = '<span class="fw-summary-title">Fortune\'s Wheel Results</span>';

    const nextBtn = document.getElementById('fw-next-btn');
    if (nextBtn) nextBtn.classList.add('hidden');

    summaryEl.innerHTML = `
        <div class="fw-summary-grid">
            ${_wheelState.results.map(r => {
                const guildDef = getGuildById(r.guildId);
                const rarityConf = WHEEL_RARITY_CONFIG[r.rarity] || WHEEL_RARITY_CONFIG.common;
                return `
                    <div class="fw-summary-card" style="border-color:${guildDef?.primary || '#666'};">
                        <div class="fw-summary-guild-name" style="color:${guildDef?.primary || '#fff'}">${guildDef?.emoji || '⚔️'} ${guildDef?.name || r.guildId}</div>
                        <div class="fw-summary-segment">${r.segmentLabel}</div>
                        <div class="fw-summary-rarity" style="color:${rarityConf.color}">${rarityConf.label}</div>
                        <div class="fw-summary-desc">${r.description || r.segmentDescription}</div>
                        ${r.gloryDelta ? `<div class="fw-summary-glory">${r.gloryDelta >= 0 ? '+' : ''}${r.gloryDelta} ⚜️</div>` : ''}
                    </div>`;
            }).join('')}
        </div>`;
    summaryEl.classList.remove('hidden');

    const doneBtn = document.getElementById('fw-done-btn');
    if (doneBtn) {
        doneBtn.textContent = 'Close the Relic';
        doneBtn.classList.remove('hidden');
        doneBtn.onclick = () => closeFortunesWheel();
    }
}
