// features/fortunesWheel.js — Fortune's Wheel: segment catalog, spin logic, canvas renderer, effect application

import * as state from '../state.js';
import { GUILD_IDS, getGuildById, getGuildEmblemUrl } from './guilds.js';
import { GLORY_PER_STAR, WHEEL_RARITY_WEIGHTS, WHEEL_RARITY_CONFIG, JUNIOR_LEAGUES } from '../constants.js';
import { adjustGuildGlory, applyGloryModifier, saveFortuneWheelResult, hasSpunThisWeek } from '../db/actions/guilds.js';
import { getISOWeekKey, updateGuildScores, adjustGuildScoresForWheel } from './guildScoring.js';
import { applyWheelStudentEffects, applyClassQuestBonusDelta } from '../db/actions/fortuneWheelEffects.js';
import { checkBountyProgress } from '../db/actions/bounties.js';
import { checkAndRecordQuestCompletion } from '../db/actions/stars.js';
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
    { id: 'glory_windfall',    emoji: '⚜️', label: 'Glory Windfall',    description: '+200 Glory instantly!',                             rarity: 'epic',      category: 'glory', effect: (ctx) => instantGlory(ctx, 200) },
    { id: 'glory_miracle',     emoji: '👑', label: 'Glory Miracle',     description: '+400 Glory instantly!',                             rarity: 'mythic',    category: 'glory', effect: (ctx) => instantGlory(ctx, 400) },

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
    { id: 'focus_aura',        emoji: '🎯', label: 'Focus Aura',        description: '+1 star to 1 random member!',                      rarity: 'uncommon',  category: 'perk',  effect: (ctx) => randomStars(ctx, 1, 1) },
    { id: 'spotlight',         emoji: '🌟', label: 'Spotlight',         description: '1 random member receives a Legendary Artifact!',   rarity: 'uncommon',  category: 'perk',  effect: (ctx) => randomArtifact(ctx, 1) },
    { id: 'scholars_blessing', emoji: '📚', label: 'Scholar\'s Blessing', description: '+5 Team Quest bonus stars (this month)!',        rarity: 'uncommon',  category: 'perk',  effect: (ctx) => classQuestBonus(ctx, 5) },
    { id: 'treasure_chest',    emoji: '📦', label: 'Treasure Chest',    description: '+20 gold to 1 random member & +10 Glory!',         rarity: 'uncommon',  category: 'perk',  effect: (ctx) => { randomGold(ctx, 1, 20); return instantGlory(ctx, 10); } },
    { id: 'time_warp',         emoji: '⏰', label: 'Time Warp',          description: '+10 Team Quest bonus stars (this month)!',        rarity: 'uncommon',  category: 'perk',  effect: (ctx) => classQuestBonus(ctx, 10) },
    { id: 'challenge',         emoji: '🥊', label: 'Glory Challenge',   description: 'Earn most Glory this week → bonus +50 Glory!',     rarity: 'epic',      category: 'perk',  effect: (ctx) => applyChallenge(ctx) },
    { id: 'fortress',          emoji: '🏰', label: 'Fortress',          description: 'Cannot lose Glory for 2 days!',                    rarity: 'epic',      category: 'perk',  effect: (ctx) => applyShield(ctx, 2) },
    { id: 'quest_surge',       emoji: '🗺️', label: 'Quest Surge',       description: '+15 Team Quest bonus stars (this month)!',         rarity: 'rare',      category: 'perk',  effect: (ctx) => classQuestBonus(ctx, 15) },
    { id: 'aurum_sprinkle',    emoji: '🪙', label: 'Aurum Sprinkle',     description: '5 random members get +5 gold each!',              rarity: 'common',    category: 'perk',  effect: (ctx) => randomGold(ctx, 5, 5) },
    { id: 'aurum_blossom',     emoji: '🪙', label: 'Aurum Blossom',      description: '3 random members get +20 gold each!',             rarity: 'uncommon',  category: 'perk',  effect: (ctx) => randomGold(ctx, 3, 20) },
    { id: 'star_burst',        emoji: '⭐', label: 'Star Burst',         description: '3 random members get +1 star each!',              rarity: 'rare',      category: 'perk',  effect: (ctx) => randomStars(ctx, 3, 1) },
    { id: 'mythic_relic',      emoji: '🏆', label: 'Relic of Triumph',   description: '+30 Team Quest bonus stars & +1 Artifact (5 students)!', rarity: 'mythic', category: 'perk', effect: (ctx) => mythicRelic(ctx) },

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
    { id: 'tangled_web',       emoji: '🕸️', label: 'Tangled Web',       description: '-5 Team Quest bonus stars (this month)!',          rarity: 'rare',      category: 'negative', effect: (ctx) => classQuestBonus(ctx, -5) },
    { id: 'market_crash',      emoji: '📉', label: 'Market Crash',      description: 'All guilds lose 5% weekly Glory!',                 rarity: 'common',    category: 'negative', effect: (ctx) => allGuildsTax(ctx, 0.05) },
    { id: 'trickster',         emoji: '🎭', label: 'Trickster',         description: 'What looks like a win... turns out to be nothing!', rarity: 'common',   category: 'negative', effect: () => ({ gloryDelta: 0, description: 'The Trickster laughs! Nothing happened.' }) },
    { id: 'lightning_strike',  emoji: '⚡', label: 'Lightning Strike',  description: 'Lose 30 Glory instantly!',                         rarity: 'uncommon',  category: 'negative', effect: (ctx) => instantGlory(ctx, -30) },
    { id: 'aurum_tax',         emoji: '🧾', label: 'Aurum Tax',          description: '3 random members lose 10 gold each!',             rarity: 'uncommon',  category: 'negative', effect: (ctx) => randomGold(ctx, 3, -10) },
    { id: 'artifact_plunder',  emoji: '🪓', label: 'Artifact Plunder',  description: '1 random member loses 1 artifact!',               rarity: 'rare',      category: 'negative', effect: (ctx) => randomArtifactLoss(ctx, 1, 1) },
    { id: 'star_snatch',       emoji: '🕯️', label: 'Star Snatch',       description: '1 random member loses 1 star...',                  rarity: 'cursed',    category: 'negative', effect: (ctx) => randomStars(ctx, 1, -1) },
    { id: 'mythic_calamity',   emoji: '☄️', label: 'Calamity',          description: '-100 Glory, -10 Team Quest bonus, 3 artifacts lost...', rarity: 'mythic', category: 'negative', effect: (ctx) => mythicCalamity(ctx) },
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
    if (members.length === 0) return { gloryDelta: 0, description: 'No students were present for this guild.' };

    const outcome = await applyWheelStudentEffects({
        classId: ctx.classId,
        students: members,
        count,
        starsDelta: amount,
        note: amount < 0 ? 'Wheel star curse' : 'Wheel star blessing'
    });

    if (outcome.affectedStudents?.length) {
        if (amount > 0) {
            for (const sid of outcome.affectedStudents) await updateGuildScores(sid, amount);
            await checkBountyProgress(ctx.classId, amount * outcome.affectedStudents.length);
        } else if (amount < 0) {
            for (const sid of outcome.affectedStudents) await adjustGuildScoresForWheel(sid, amount);
        }
        await checkAndRecordQuestCompletion(ctx.classId).catch(() => {});
    }

    const affected = members.filter(s => outcome.affectedStudents.includes(s.id));
    const names = affected.map(s => s.name).join(', ');

    return {
        gloryDelta: 0,
        ...outcome,
        description: count >= members.length
            ? `All ${members.length} guild members ${amount >= 0 ? `gain ${amount} star` : `lose ${Math.abs(amount)} star`}!`
            : `${names} ${affected.length > 1 ? 'each' : ''} ${amount >= 0 ? `gain ${amount} star` : `loses ${Math.abs(amount)} star`}.`
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
        note: amount < 0 ? 'Wheel gold tax' : 'Wheel gold blessing'
    });

    const affected = members.filter(s => outcome.affectedStudents.includes(s.id));
    const names = affected.map(s => s.name).join(', ');

    return {
        gloryDelta: 0,
        ...outcome,
        description: count >= members.length
            ? `All guild members ${amount >= 0 ? `gain ${amount} gold` : `lose ${Math.abs(amount)} gold`}!`
            : `${names} ${affected.length > 1 ? 'each' : ''} ${amount >= 0 ? `gain ${amount} gold` : `lose ${Math.abs(amount)} gold`}.`
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
            ? `All guild members receive an artifact!`
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
    if (sid) {
        await updateGuildScores(sid, 2);
        await checkBountyProgress(ctx.classId, 2);
        await checkAndRecordQuestCompletion(ctx.classId).catch(() => {});
    }

    const student = members.find(s => s.id === sid);
    return {
        gloryDelta: 0,
        ...outcome,
        description: student ? `${student.name} receives +2 stars and +30 gold from the Teacher's Favor!` : `A student receives +2 stars and +30 gold from the Teacher's Favor!`
    };
}

async function gloryBlackhole(ctx) {
    const members = ctx.guildStudents || [];
    await adjustGuildGlory(ctx.guildId, -10, 'wheel_blackhole');
    if (members.length === 0) return { gloryDelta: -10, description: `Lost 10 Glory to the Blackhole.` };
    const outcome = await applyWheelStudentEffects({
        classId: ctx.classId,
        students: members,
        count: members.length,
        goldDelta: 25,
        note: 'Glory Blackhole payout'
    });

    return {
        gloryDelta: -10,
        ...outcome,
        description: `Lost 10 Glory to the Blackhole, but all members get +25 gold!`
    };
}

async function randomArtifactLoss(ctx, studentCount, removeCountPerStudent) {
    const members = ctx.guildStudents || [];
    if (members.length === 0) return { gloryDelta: 0, description: 'No students were present for this guild.' };

    const outcome = await applyWheelStudentEffects({
        classId: ctx.classId,
        students: members,
        count: studentCount,
        artifactsRemoveCount: removeCountPerStudent,
        note: 'Wheel artifact loss'
    });

    const affected = members.filter(s => outcome.affectedStudents.includes(s.id));
    const names = affected.map(s => s.name).join(', ');

    return {
        gloryDelta: 0,
        ...outcome,
        description: affected.length > 0
            ? `${names} ${affected.length > 1 ? 'each lose' : 'loses'} an artifact!`
            : 'A mysterious force tried to steal an artifact... but none were found.'
    };
}

async function classQuestBonus(ctx, delta) {
    const outcome = await applyClassQuestBonusDelta(ctx.classId, delta, 'Wheel quest effect');
    if (outcome.classQuestDelta) await checkAndRecordQuestCompletion(ctx.classId).catch(() => {});
    return {
        gloryDelta: 0,
        ...outcome,
        description: outcome.classQuestDelta >= 0
            ? `The class gains +${outcome.classQuestDelta} Team Quest bonus star${outcome.classQuestDelta === 1 ? '' : 's'} this month!`
            : `The class loses ${Math.abs(outcome.classQuestDelta)} Team Quest bonus star${Math.abs(outcome.classQuestDelta) === 1 ? '' : 's'} this month...`
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

async function mythicCalamity(ctx) {
    await adjustGuildGlory(ctx.guildId, -100, 'wheel_mythic_calamity');
    const quest = await applyClassQuestBonusDelta(ctx.classId, -10, 'Calamity');
    const artifacts = await applyWheelStudentEffects({
        classId: ctx.classId,
        students: ctx.guildStudents || [],
        count: 3,
        artifactsRemoveCount: 1,
        note: 'Calamity artifact loss'
    });

    if (quest.classQuestDelta) await checkAndRecordQuestCompletion(ctx.classId).catch(() => {});

    return {
        gloryDelta: -100,
        classQuestDelta: quest.classQuestDelta || 0,
        affectedStudents: artifacts.affectedStudents || [],
        artifactsGranted: 0,
        artifactsRemoved: artifacts.artifactsRemoved || 0,
        starsDelta: 0,
        goldDelta: 0,
        description: `Calamity strikes: -100 Glory, ${quest.classQuestDelta ? `${quest.classQuestDelta} Team Quest bonus` : 'no quest change'}, and artifacts vanish...`
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
        if (isJunior && seg.rarity === 'mythic') return false;
        if (isJunior && seg.rarity === 'cursed') return false;
        if (isJunior && seg.category === 'negative' && ['glory_eclipse', 'glory_heist', 'tangled_web', 'lightning_strike', 'star_snatch', 'mythic_calamity'].includes(seg.id)) return false;
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
    let mythicCount = 0;
    let negativeCount = 0;
    let hasRarePlus = false;

    while (selected.size < 20 && attempts < maxAttempts) {
        attempts++;
        const candidate = weighted[Math.floor(Math.random() * weighted.length)];
        if (selected.has(candidate.id)) continue;

        // Variety constraints
        if (candidate.rarity === 'cursed' && cursedCount >= 1) continue;
        if (candidate.rarity === 'mythic' && mythicCount >= 1) continue;
        if (candidate.rarity === 'epic' && epicCount >= 2) continue;
        if (candidate.rarity === 'legendary' && legendaryCount >= 1) continue;
        if (candidate.category === 'negative' && negativeCount >= 4) continue;

        selected.set(candidate.id, candidate);
        if (candidate.rarity === 'cursed') cursedCount++;
        if (candidate.rarity === 'epic') epicCount++;
        if (candidate.rarity === 'legendary') legendaryCount++;
        if (candidate.rarity === 'mythic') mythicCount++;
        if (candidate.category === 'negative') negativeCount++;
        if (['rare', 'epic', 'legendary', 'mythic'].includes(candidate.rarity)) hasRarePlus = true;
    }

    // Ensure at least 1 rare+ segment
    if (!hasRarePlus && pool.some(s => ['rare', 'epic', 'legendary', 'mythic'].includes(s.rarity))) {
        const rares = pool.filter(s => ['rare', 'epic', 'legendary', 'mythic'].includes(s.rarity));
        const rare = rares[Math.floor(Math.random() * rares.length)];
        // Replace a common segment
        const replaceable = [...selected.values()].filter(s => s.rarity === 'common' || s.rarity === 'uncommon');
        if (replaceable.length > 0) {
            selected.delete(replaceable[0].id);
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
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 24; 
    const segCount = segments.length;
    const segAngle = TAU / segCount;

    ctx.clearRect(0, 0, size, size);

    // Bright celestial aura behind the wheel
    const aura = ctx.createRadialGradient(center, center, radius * 0.2, center, center, size / 2);
    aura.addColorStop(0, `rgba(255, 255, 255, 0.9)`);
    aura.addColorStop(0.5, 'rgba(253, 230, 138, 0.4)');
    aura.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(rotationAngle);

    // Bright Golden thick outer rim
    ctx.beginPath();
    ctx.arc(0, 0, radius + 12, 0, TAU);
    const rimGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    rimGrad.addColorStop(0, '#FEF3C7');
    rimGrad.addColorStop(0.2, '#F59E0B');
    rimGrad.addColorStop(0.5, '#FFFBEB');
    rimGrad.addColorStop(0.8, '#D97706');
    rimGrad.addColorStop(1, '#FEF3C7');
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = Math.max(16, size / 35);
    ctx.stroke();

    // Lighter inner rim line for depth
    ctx.beginPath();
    ctx.arc(0, 0, radius + 2, 0, TAU);
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.8)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Wheel background disc (bright instead of dark)
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    for (let i = 0; i < segCount; i++) {
        const seg = segments[i];
        const startAngle = i * segAngle;
        const endAngle = startAngle + segAngle;
        const rarityConf = WHEEL_RARITY_CONFIG[seg.rarity] || WHEEL_RARITY_CONFIG.common;
        
        // Vibrant wedge gradient
        const gradient = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
        gradient.addColorStop(0, rarityConf.bg);
        gradient.addColorStop(0.6, rarityConf.bg);
        gradient.addColorStop(1, rarityConf.color);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Highlighting edge
        ctx.beginPath();
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 6;
        ctx.stroke();

        // Wedge dividing borders (bright gold)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius);
        const borderGrad = ctx.createLinearGradient(0, 0, Math.cos(startAngle) * radius, Math.sin(startAngle) * radius);
        borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        borderGrad.addColorStop(1, 'rgba(245, 158, 11, 0.8)');
        ctx.strokeStyle = borderGrad;
        ctx.lineWidth = Math.max(2, size / 150);
        ctx.stroke();

        // Draw segment label
        ctx.save();
        ctx.rotate(startAngle + segAngle / 2);
        
        const label = String(seg.label || '');
        const maxTextWidth = radius * 0.45;
        
        const fontSize = Math.max(12, Math.floor(size / 38));
        ctx.font = `700 ${fontSize}px "Fredoka One", "Trebuchet MS", system-ui, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        const lines = wrapText(ctx, label, maxTextWidth);
        const lineHeight = fontSize * 1.2;
        const totalTextHeight = lines.length * lineHeight;
        
        ctx.font = `800 ${fontSize}px "Fredoka One", "Trebuchet MS", system-ui, sans-serif`;
        const textStartRadius = radius - Math.max(34, size * 0.12);
        const startY = -(totalTextHeight / 2) + (lineHeight / 2);

        for (let j = 0; j < lines.length; j++) {
            ctx.fillText(lines[j], textStartRadius, startY + (j * lineHeight));
        }

        ctx.restore();
    }

    if (Number.isInteger(highlightIndex) && highlightIndex >= 0 && highlightIndex < segCount) {
        const seg = segments[highlightIndex];
        const rarityConf = WHEEL_RARITY_CONFIG[seg?.rarity] || WHEEL_RARITY_CONFIG.common;
        const startAngle = highlightIndex * segAngle;
        const endAngle = startAngle + segAngle;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.shadowColor = rarityConf.glow || 'rgba(251, 191, 36, 0.55)';
        ctx.shadowBlur = Math.max(18, size / 18);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.lineWidth = Math.max(10, size / 55);
        ctx.stroke();
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

    ctx.beginPath();
    ctx.arc(0, 0, innerRadius * 0.52, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, innerRadius * 0.18, 0, TAU);
    ctx.fillStyle = '#fff7d6';
    ctx.fill();

    ctx.restore();
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

function triggerMythicReveal(x, y, isNegative) {
    triggerLegendaryReveal(x, y, isNegative);
    const emojis = isNegative ? ['☄️', '🌑', '⚰️', '💀', '🔥', '🕯️'] : ['🏆', '👑', '⚜️', '✨', '💎', '🌟', '🗺️', '🎁'];
    triggerEmojiRain(x, y, emojis, 55);
}

function triggerLegendaryReveal(x, y, isNegative) {
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    flash.style.setProperty('--flash-color', isNegative ? 'rgba(127, 29, 29, 0.45)' : 'rgba(251, 191, 36, 0.5)');
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());

    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const shockwave = document.createElement('div');
            shockwave.className = 'shockwave';
            shockwave.style.left = `${x}px`;
            shockwave.style.top = `${y}px`;
            shockwave.style.setProperty('--shockwave-color', isNegative ? 'rgba(220, 38, 38, 0.7)' : 'rgba(251, 191, 36, 0.8)');
            document.body.appendChild(shockwave);
            shockwave.addEventListener('animationend', () => shockwave.remove());
        }, i * 150);
    }

    const emojis = isNegative ? ['💀', '⚰️', '🌑', '💀', '🔥'] : ['⭐', '✨', '🌟', '💫', '🏆', '⚜️', '👑'];
    triggerEmojiRain(x, y, emojis, 35);
}

function triggerEpicReveal(x, y, isNegative) {
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    flash.style.setProperty('--flash-color', isNegative ? 'rgba(127, 29, 29, 0.35)' : 'rgba(168, 85, 247, 0.4)');
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());

    const shockwave = document.createElement('div');
    shockwave.className = 'shockwave';
    shockwave.style.left = `${x}px`;
    shockwave.style.top = `${y}px`;
    shockwave.style.setProperty('--shockwave-color', isNegative ? 'rgba(220, 38, 38, 0.6)' : 'rgba(168, 85, 247, 0.7)');
    document.body.appendChild(shockwave);
    shockwave.addEventListener('animationend', () => shockwave.remove());

    const emojis = isNegative ? ['🔻', '⚡', '💔'] : ['🌟', '✨', '💫', '🎁'];
    triggerEmojiRain(x, y, emojis, 22);
}

function triggerRareReveal(x, y) {
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    flash.style.setProperty('--flash-color', 'rgba(59, 130, 246, 0.35)');
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());

    const shockwave = document.createElement('div');
    shockwave.className = 'shockwave';
    shockwave.style.left = `${x}px`;
    shockwave.style.top = `${y}px`;
    shockwave.style.setProperty('--shockwave-color', 'rgba(96, 165, 250, 0.6)');
    document.body.appendChild(shockwave);
    shockwave.addEventListener('animationend', () => shockwave.remove());

    const emojis = ['✨', '⭐', '💫'];
    triggerEmojiRain(x, y, emojis, 14);
}

function triggerCursedReveal(x, y) {
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    flash.style.setProperty('--flash-color', 'rgba(127, 29, 29, 0.5)');
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());

    for (let i = 0; i < 2; i++) {
        setTimeout(() => {
            const shockwave = document.createElement('div');
            shockwave.className = 'shockwave';
            shockwave.style.left = `${x}px`;
            shockwave.style.top = `${y}px`;
            shockwave.style.setProperty('--shockwave-color', 'rgba(185, 28, 28, 0.7)');
            document.body.appendChild(shockwave);
            shockwave.addEventListener('animationend', () => shockwave.remove());
        }, i * 200);
    }

    triggerEmojiRain(x, y, ['⚡', '💀', '🌑', '🔻'], 18);
}

function triggerCommonReveal(x, y) {
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
        if (_wheelState.phase !== 'ready' && _wheelState.phase !== 'spinning' && _wheelState.phase !== 'revealed') return;
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
        _wheelState = { active: false, classId: null, leagueLevel: null, guildOrder: [], currentGuildIndex: 0, segments: [], results: [], phase: 'idle', winnerIndex: null, rotationAngle: 0 };
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
        winnerIndex: null,
        rotationAngle: 0,
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
    _setStageCaption('The relic remains sealed until the proper class and lesson window align.');

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
    _wheelState.winnerIndex = null;
    _wheelState.rotationAngle = 0;

    const canvas = document.getElementById('fortunes-wheel-canvas');
    const guildId = _wheelState.guildOrder[_wheelState.currentGuildIndex];
    const guildDef = getGuildById(guildId);
    const segments = _wheelState.segments;
    const winnerIndex = spinWheel(segments.length);
    const stageFrame = document.getElementById('fw-stage-frame');
    if (stageFrame) stageFrame.classList.add('is-spinning');

    _updateSpinButton(true, 'Spinning...');

    // Animate
    const anim = await animateWheelSpin(canvas, segments, winnerIndex, guildDef, () => {
        try { playSound('click'); } catch (_) {}
    });
    if (stageFrame) stageFrame.classList.remove('is-spinning');
    _wheelState.winnerIndex = winnerIndex;
    _wheelState.rotationAngle = anim?.rotationAngle || 0;

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
    triggerWheelRevealEffects(winningSeg.rarity, winningSeg.category === 'negative');

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
    if (_wheelState.results.length > 0) {
        try {
            await saveFortuneWheelResult(_wheelState.classId, _wheelState.results);
        } catch (err) {
            console.error('Failed to save wheel results:', err);
        }
    }

    _wheelState = { active: false, classId: null, leagueLevel: null, guildOrder: [], currentGuildIndex: 0, segments: [], results: [], phase: 'idle', winnerIndex: null, rotationAngle: 0 };

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
    const emblemUrl = getGuildEmblemUrl(guildId);

    // Update header
    const headerEl = document.getElementById('fw-guild-header');
    if (headerEl) {
        headerEl.innerHTML = `
            <div class="fw-guild-banner" style="--guild-primary:${guildDef?.primary || '#fff'};--guild-secondary:${guildDef?.secondary || '#ddd'};">
                <div class="fw-guild-banner__crest">
                    ${emblemUrl ? `<img src="${emblemUrl}" alt="${guildDef?.name || guildId}" class="fw-guild-banner__crest-image">` : `<span class="fw-guild-banner__crest-fallback">${guildNum}</span>`}
                </div>
                <div class="fw-guild-banner__copy">
                    <div class="fw-guild-banner__eyebrow">Guild ${guildNum} of ${_wheelState.guildOrder.length}</div>
                    <div class="fw-guild-banner__name">${guildDef?.name || guildId}</div>
                </div>
            </div>`;
    }

    _renderGuildProgress();
    _setStageEmblem(guildId);
    _setStageCaption(`${guildDef?.name || 'This guild'} steps onto the relic stage. Spin to reveal its weekly omen.`);

    const stageFrame = document.getElementById('fw-stage-frame');
    if (stageFrame) {
        stageFrame.classList.remove('is-locked');
        stageFrame.classList.remove('is-spinning');
    }

    const canvasWrap = document.getElementById('fw-canvas-wrap');
    if (canvasWrap) canvasWrap.classList.remove('hidden');
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

function _sizeAndRenderWheel() {
    const canvas = document.getElementById('fortunes-wheel-canvas');
    if (!canvas || !_wheelState.segments?.length) return;
    const guildId = _wheelState.guildOrder[_wheelState.currentGuildIndex];
    const guildDef = getGuildById(guildId);

    const parentEl = canvas.parentElement;
    const parentWidth = parentEl?.clientWidth || 620;
    const parentHeight = parentEl?.clientHeight || parentWidth;
    const available = Math.min(parentWidth, parentHeight);
    const displaySize = Math.round(Math.min(640, available));
    if (!displaySize || displaySize < 10) return;

    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;
    canvas.width = displaySize;
    canvas.height = displaySize;
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

function _renderWheelResult(segment, result, guildDef) {
    const resultEl = document.getElementById('fw-result');
    if (!resultEl) return;

    const rarityConf = WHEEL_RARITY_CONFIG[segment.rarity] || WHEEL_RARITY_CONFIG.common;
    const isNegative = segment.category === 'negative';
    const emblemUrl = getGuildEmblemUrl(guildDef?.id);

    resultEl.innerHTML = `
        <div class="fw-result-card" style="border-color:${rarityConf.color};box-shadow:0 0 30px ${rarityConf.glow};">
            <div class="fw-result-header">
                <div class="fw-result-rarity" style="background:${rarityConf.bg};color:${rarityConf.color};border-color:${rarityConf.color}40;">${rarityConf.label}</div>
                <div class="fw-result-guild">
                    ${emblemUrl ? `<img src="${emblemUrl}" alt="${guildDef?.name || result.guildId}" class="fw-result-guild__image">` : ''}
                    <span class="fw-result-guild__name">${guildDef?.name || result.guildId}</span>
                </div>
            </div>
            <div class="fw-result-title">${segment.label}</div>
            <div class="fw-result-description">${result.description || segment.description}</div>
            ${result.gloryDelta ? `<div class="fw-result-glory ${isNegative ? 'fw-result-glory--negative' : ''}">${result.gloryDelta >= 0 ? '+' : ''}${result.gloryDelta} ⚜️ Glory</div>` : ''}
            ${result.goldDelta ? `<div class="fw-result-glory ${result.goldDelta < 0 ? 'fw-result-glory--negative' : ''}">${result.goldDelta >= 0 ? '+' : ''}${result.goldDelta} 🪙 Gold</div>` : ''}
            ${result.starsDelta ? `<div class="fw-result-glory ${result.starsDelta < 0 ? 'fw-result-glory--negative' : ''}">${result.starsDelta >= 0 ? '+' : ''}${result.starsDelta} ⭐ Stars</div>` : ''}
            ${result.classQuestDelta ? `<div class="fw-result-glory ${result.classQuestDelta < 0 ? 'fw-result-glory--negative' : ''}">${result.classQuestDelta >= 0 ? '+' : ''}${result.classQuestDelta} 🗺️ Quest</div>` : ''}
            ${(result.artifactsGranted || result.artifactsRemoved) ? `<div class="fw-result-glory ${(result.artifactsRemoved || 0) > 0 ? 'fw-result-glory--negative' : ''}">${result.artifactsGranted ? `+${result.artifactsGranted}` : ''}${result.artifactsGranted && result.artifactsRemoved ? ' / ' : ''}${result.artifactsRemoved ? `-${result.artifactsRemoved}` : ''} 🎒 Artifacts</div>` : ''}
            ${result.affectedStudents?.length ? `<div class="fw-result-students">${result.affectedStudents.length} student${result.affectedStudents.length > 1 ? 's' : ''} affected</div>` : ''}
        </div>`;
    resultEl.classList.remove('hidden');

    _setStageCaption(`${guildDef?.name || 'The guild'} has received ${segment.label}. Advance when you are ready for the next reveal.`);
    _updateSpinButton(true, 'Fate Revealed', 'Prepare the next presentation');

    if (_wheelState.currentGuildIndex < _wheelState.guildOrder.length - 1) {
        const nextBtn = document.getElementById('fw-next-btn');
        if (nextBtn) {
            nextBtn.innerHTML = '<span class="font-title">Present Next Guild</span>';
            nextBtn.classList.remove('hidden');
        }
    } else {
        const doneBtn = document.getElementById('fw-done-btn');
        if (doneBtn) {
            doneBtn.innerHTML = '<span class="font-title">Reveal Final Ledger</span>';
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
    if (headerEl) headerEl.innerHTML = '<div class="fw-guild-banner fw-guild-banner--summary"><div class="fw-guild-banner__copy"><div class="fw-guild-banner__eyebrow">Ceremony Complete</div><div class="fw-guild-banner__name">Fortune Ledger</div></div></div>';

    _renderGuildProgress(true);
    _setStageEmblem(null);
    _setStageCaption('All omens have been revealed. Review the final ledger before closing the ceremony.');

    const nextBtn = document.getElementById('fw-next-btn');
    if (nextBtn) nextBtn.classList.add('hidden');

    summaryEl.innerHTML = `
        <div class="fw-summary-header">
            <div class="fw-summary-eyebrow">Weekly Outcome</div>
            <div class="fw-summary-title">Guild Fortune Ledger</div>
        </div>
        <div class="fw-summary-grid">
        ${_wheelState.results.map(r => {
            const guildDef = getGuildById(r.guildId);
            const rarityConf = WHEEL_RARITY_CONFIG[r.rarity] || WHEEL_RARITY_CONFIG.common;
            const emblemUrl = getGuildEmblemUrl(r.guildId);
            return `
                <div class="fw-summary-item" style="border-color:${guildDef?.primary || '#666'};">
                    <div class="fw-summary-guild" style="color:${guildDef?.primary || '#fff'}">
                        ${emblemUrl ? `<img src="${emblemUrl}" alt="${guildDef?.name || r.guildId}" class="fw-summary-emblem">` : ''}
                        <span>${guildDef?.name || r.guildId}</span>
                    </div>
                    <div class="fw-summary-result">${r.segmentLabel}</div>
                    <div class="fw-summary-rarity" style="color:${rarityConf.color}">${rarityConf.label}</div>
                    <div class="fw-summary-desc">${r.description || r.segmentDescription}</div>
                    ${r.gloryDelta ? `<div class="fw-result-glory ${r.gloryDelta < 0 ? 'fw-result-glory--negative' : ''}">${r.gloryDelta >= 0 ? '+' : ''}${r.gloryDelta} ⚜️</div>` : ''}
                    ${r.goldDelta ? `<div class="fw-result-glory ${r.goldDelta < 0 ? 'fw-result-glory--negative' : ''}">${r.goldDelta >= 0 ? '+' : ''}${r.goldDelta} 🪙</div>` : ''}
                    ${r.starsDelta ? `<div class="fw-result-glory ${r.starsDelta < 0 ? 'fw-result-glory--negative' : ''}">${r.starsDelta >= 0 ? '+' : ''}${r.starsDelta} ⭐</div>` : ''}
                    ${r.classQuestDelta ? `<div class="fw-result-glory ${r.classQuestDelta < 0 ? 'fw-result-glory--negative' : ''}">${r.classQuestDelta >= 0 ? '+' : ''}${r.classQuestDelta} 🗺️</div>` : ''}
                    ${(r.artifactsGranted || r.artifactsRemoved) ? `<div class="fw-result-glory ${(r.artifactsRemoved || 0) > 0 ? 'fw-result-glory--negative' : ''}">${r.artifactsGranted ? `+${r.artifactsGranted}` : ''}${r.artifactsGranted && r.artifactsRemoved ? ' / ' : ''}${r.artifactsRemoved ? `-${r.artifactsRemoved}` : ''} 🎒</div>` : ''}
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
    if (captionEl) captionEl.textContent = text;
}
