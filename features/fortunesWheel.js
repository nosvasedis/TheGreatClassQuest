// features/fortunesWheel.js — Fortune's Wheel: segment catalog, spin logic, canvas renderer, effect application

import * as state from '../state.js';
import { GUILD_IDS, getGuildById, getGuildEmblemUrl } from './guilds.js';
import { GLORY_PER_STAR, WHEEL_RARITY_WEIGHTS, WHEEL_RARITY_CONFIG, WHEEL_PRISMATIC_CONFIG, getRarityPalette } from '../constants.js';
import { adjustGuildGlory, applyGloryModifier, saveFortuneWheelResult, hasSpunThisWeek } from '../db/actions/guilds.js';
import { getISOWeekKey, updateGuildScores, adjustGuildScoresForWheel } from './guildScoring.js';
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

function _optimisticallyApplyWheelResultToState({ guildId, gloryDelta = 0, modifierCreated = null, segmentId = '' }) {
    if (!guildId) return;
    const allGuildScores = state.get('allGuildScores') || {};
    if (!allGuildScores || typeof allGuildScores !== 'object') return;

    const applyTo = (gid) => {
        const current = allGuildScores[gid] || { id: gid };
        const next = { ...current };
        if (gloryDelta) {
            next.totalGlory = (Number(next.totalGlory) || 0) + Number(gloryDelta);
            next.weeklyGlory = (Number(next.weeklyGlory) || 0) + Number(gloryDelta);
            next.monthlyGlory = (Number(next.monthlyGlory) || 0) + Number(gloryDelta);
        }
        if (modifierCreated && typeof modifierCreated === 'object') {
            const arr = Array.isArray(next.gloryModifiers) ? [...next.gloryModifiers] : [];
            arr.push(modifierCreated);
            next.gloryModifiers = arr;
        }
        return next;
    };

    const seg = String(segmentId || '');
    // Simple known all-guild glory effect
    if (seg === 'rainbow_bridge') {
        const nextAll = { ...allGuildScores };
        for (const gid of GUILD_IDS) nextAll[gid] = applyTo(gid);
        state.setAllGuildScores(nextAll);
        return;
    }

    if (!allGuildScores[guildId]) return;
    state.setAllGuildScores({ ...allGuildScores, [guildId]: applyTo(guildId) });
}

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
    { id: 'treasure_chest',    emoji: '📦', label: 'Treasure Chest',    description: '+20 gold to 1 random member & +10 Glory!',         rarity: 'uncommon',  category: 'perk',  effect: async (ctx) => { const g = await randomGold(ctx, 1, 20); const gl = await instantGlory(ctx, 10); const student = (ctx.guildStudents || []).find(s => s.id === (g.affectedStudents || [])[0]); return { ...g, gloryDelta: gl.gloryDelta, description: student ? `${student.name} receives +20 gold, and the guild earns +10 Glory!` : 'A guild member receives +20 gold, and the guild earns +10 Glory!' }; } },
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
    { id: 'carnival',          emoji: '🎪', label: 'Carnival',          description: '3 random members get a small surprise!',           rarity: 'common',    category: 'fun',   effect: async (ctx) => { const g = await randomGold(ctx, 3, 5); const gl = await instantGlory(ctx, 5); return { ...g, gloryDelta: gl.gloryDelta, description: '3 guild members each receive +5 gold — the Carnival arrives! +5 Glory to the guild!' }; } },
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

    // ── NEW: Expanded Glory Segments ──────────────────────────────────────────
    { id: 'breeze_of_fortune',  emoji: '🌬️', label: 'Breeze of Fortune',  description: '+15 Glory and a whisper of luck!',                     rarity: 'common',    category: 'glory',  effect: (ctx) => instantGlory(ctx, 15) },
    { id: 'copper_cache',       emoji: '🪙', label: 'Copper Cache',       description: '4 random members get +8 gold each!',                  rarity: 'common',    category: 'perk',   effect: (ctx) => randomGold(ctx, 4, 8) },
    { id: 'whisper_of_unity',   emoji: '🤝', label: 'Whisper of Unity',   description: '+5 Glory to your guild, +3 to every other guild!',    rarity: 'common',    category: 'glory',  effect: async (ctx) => { await allGuildsGlory(ctx, 3); return instantGlory(ctx, 5); } },
    { id: 'silver_lining',      emoji: '🪩', label: 'Silver Lining',      description: '0.8× Glory for 1 day, but +30 Glory right now!',    rarity: 'uncommon',  category: 'glory',  effect: async (ctx) => { const mod = await gloryMultiplier(ctx, 0.8, 1); const gl = await instantGlory(ctx, 30); return { ...gl, modifierCreated: mod.modifierCreated, description: `Silver lining: +30 Glory now, but Glory generation is reduced for 1 day.` }; } },
    { id: 'scholars_momentum',  emoji: '📖', label: "Scholar's Momentum", description: '+1 Glory per star for the next 15 stars!',            rarity: 'uncommon',  category: 'glory',  effect: (ctx) => bonusPerStar(ctx, 1, 15) },
    { id: 'guild_herald',       emoji: '📯', label: 'Guild Herald',        description: '+1 Glory per star for all guildmates (next 5 stars each)!', rarity: 'uncommon', category: 'glory', effect: (ctx) => bonusPerStarTimed(ctx, 1, 2) },
    { id: 'crystal_focus',      emoji: '💎', label: 'Crystal Focus',      description: '2× Glory generation for 2 days!',                     rarity: 'rare',      category: 'glory',  effect: (ctx) => gloryMultiplier(ctx, 2, 2) },
    { id: 'star_cascade',       emoji: '🌠', label: 'Star Cascade',       description: '4 random members get +1 star and +10 gold each!',   rarity: 'rare',      category: 'perk',   effect: async (ctx) => { const s = await randomStars(ctx, 4, 1); const g = await randomGold(ctx, 4, 10); return { gloryDelta: 0, starsDelta: s.starsDelta || 4, goldDelta: g.goldDelta || 40, affectedStudents: [...new Set([...(s.affectedStudents || []), ...(g.affectedStudents || [])])], description: '4 guild members each receive +1 star and +10 gold!' }; } },
    { id: 'echoes_of_glory',    emoji: '🔔', label: 'Echoes of Glory',     description: '+25 Glory and echo your best active modifier for 1 day!', rarity: 'rare', category: 'glory', effect: (ctx) => echoesOfGlory(ctx) },
    { id: 'golden_tide',        emoji: '🌊', label: 'Golden Tide',        description: 'ALL members get +20 gold, guild gets +30 Glory!',    rarity: 'epic',      category: 'perk',   effect: async (ctx) => { const g = await randomGold(ctx, ctx.memberCount, 20); const gl = await instantGlory(ctx, 30); return { ...g, gloryDelta: gl.gloryDelta + (g.gloryDelta || 0), description: `A golden tide! All members receive +20 gold, and the guild earns +30 Glory!` }; } },
    { id: 'phoenix_rise',       emoji: '🔥', label: 'Phoenix Rise',       description: 'If guild has <50 Glory, gain +100; otherwise +40.',   rarity: 'epic',      category: 'glory',  effect: (ctx) => phoenixRise(ctx) },
    { id: 'titans_stride',      emoji: '🏔️', label: "Titan's Stride",    description: '3× Glory generation for 2 days!',                     rarity: 'epic',      category: 'glory',  effect: (ctx) => gloryMultiplier(ctx, 3, 2) },
    { id: 'crown_of_stars',     emoji: '👑', label: 'Crown of Stars',     description: 'ALL members get +2 stars and +25 gold!',              rarity: 'legendary', category: 'perk',   effect: async (ctx) => { const s = await randomStars(ctx, ctx.memberCount, 2); const g = await randomGold(ctx, ctx.memberCount, 25); return { gloryDelta: 0, starsDelta: s.starsDelta || ctx.memberCount * 2, goldDelta: g.goldDelta || ctx.memberCount * 25, affectedStudents: [...new Set([...(s.affectedStudents || []), ...(g.affectedStudents || [])])], description: `A crown of stars descends! All ${ctx.memberCount} members receive +2 stars and +25 gold!` }; } },
    { id: 'sovereigns_boon',     emoji: '⚜️', label: "Sovereign's Boon",   description: 'Extend your best active modifier by 3 days!',         rarity: 'legendary', category: 'glory',  effect: (ctx) => sovereignsBoon(ctx) },
    { id: 'celestial_convergence', emoji: '✨', label: 'Celestial Convergence', description: '+50 Quest bonus, ALL members +1 star & +50 gold, +100 Glory!', rarity: 'mythic', category: 'perk', isPrismatic: true, effect: async (ctx) => { const q = await applyClassQuestBonusDelta(ctx.classId, 50, 'Celestial Convergence'); const s = await randomStars(ctx, ctx.memberCount, 1); const g = await randomGold(ctx, ctx.memberCount, 50); const gl = await instantGlory(ctx, 100); if (q.classQuestDelta) await checkAndRecordQuestCompletion(ctx.classId).catch(() => {}); return { gloryDelta: gl.gloryDelta, starsDelta: s.starsDelta || ctx.memberCount, goldDelta: g.goldDelta || ctx.memberCount * 50, classQuestDelta: q.classQuestDelta || 50, affectedStudents: [...new Set([...(s.affectedStudents || []), ...(g.affectedStudents || [])])], description: `Celestial convergence! +50 Quest bonus, all members gain +1 star & +50 gold, and the guild earns +100 Glory!` }; } },
    { id: 'fates_reversal',     emoji: '🔄', label: "Fate's Reversal",    description: 'Swap weekly Glory with the nearest rival guild!',      rarity: 'mythic',    category: 'glory',  isPrismatic: true, effect: (ctx) => fatesReversal(ctx) },
    { id: 'shattered_mirror',   emoji: '🪞', label: 'Shattered Mirror',   description: 'Next positive wheel effect is halved!',               rarity: 'cursed',    category: 'negative', effect: (ctx) => applyShatteredMirror(ctx) },
    { id: 'plague_of_doubt',    emoji: '🦠', label: 'Plague of Doubt',    description: 'ALL members lose 5 gold, guild -20 Glory, 0.75× for 1 day.', rarity: 'cursed', category: 'negative', effect: async (ctx) => { const g = await randomGold(ctx, ctx.memberCount, -5); const gl = await instantGlory(ctx, -20); const mod = await gloryMultiplier(ctx, 0.75, 1); return { gloryDelta: gl.gloryDelta + (g.gloryDelta || 0), goldDelta: g.goldDelta, modifierCreated: mod.modifierCreated, description: `Plague of doubt! All members lose 5 gold, the guild loses 20 Glory, and Glory generation is reduced for 1 day.` }; } },
];

// ═══════════════════════════════════════════════════════════════════════════════
// EFFECT IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function _hasActiveShield(guildId) {
    const allGuildScores = state.get('allGuildScores') || {};
    const gData = allGuildScores[guildId] || {};
    return (gData.gloryModifiers || []).some(m => m.type === 'shield' && m.expiresAt > Date.now());
}

async function instantGlory(ctx, amount) {
    if (amount < 0 && _hasActiveShield(ctx.guildId)) {
        return { gloryDelta: 0, description: 'Glory Shield blocked the penalty!' };
    }
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
    if (_hasActiveShield(ctx.guildId)) {
        return { gloryDelta: 0, description: 'Glory Shield blocked the Blackhole!' };
    }
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
    if (_hasActiveShield(ctx.guildId)) {
        return { gloryDelta: 0, description: 'Glory Shield blocked the Calamity!' };
    }
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

// ── NEW: Expanded effect implementations ──────────────────────────────────────

async function phoenixRise(ctx) {
    const allGuildScores = state.get('allGuildScores') || {};
    const gData = allGuildScores[ctx.guildId] || {};
    const weeklyGlory = Number(gData.weeklyGlory) || 0;
    const amount = weeklyGlory < 50 ? 100 : 40;
    await adjustGuildGlory(ctx.guildId, amount, 'wheel_phoenix_rise');
    return { gloryDelta: amount, description: weeklyGlory < 50 ? `Phoenix rises from the ashes! +100 Glory!` : `Phoenix grants +40 Glory.` };
}

async function echoesOfGlory(ctx) {
    await adjustGuildGlory(ctx.guildId, 25, 'wheel_echoes');
    // Find the best active multiply or bonus_per_star modifier and echo it
    const allGuildScores = state.get('allGuildScores') || {};
    const gData = allGuildScores[ctx.guildId] || {};
    const modifiers = gData.gloryModifiers || [];
    const activeMods = modifiers.filter(m => m.expiresAt > Date.now() && (m.type === 'multiply' || m.type === 'bonus_per_star'));
    const bestMod = activeMods.sort((a, b) => {
        const aVal = a.type === 'multiply' ? (a.factor || 1) : (a.amount || 0);
        const bVal = b.type === 'multiply' ? (b.factor || 1) : (b.amount || 0);
        return bVal - aVal;
    })[0];

    if (bestMod) {
        const expiresAt = Date.now() + 1 * 24 * 60 * 60 * 1000;
        const echoMod = { ...bestMod, expiresAt, createdAt: Date.now(), label: `Echo: ${bestMod.label || bestMod.type} (1d)` };
        await applyGloryModifier(ctx.guildId, echoMod);
        return { gloryDelta: 25, modifierCreated: echoMod, description: `+25 Glory and your best modifier (${bestMod.label || bestMod.type}) echoes for 1 more day!` };
    }

    return { gloryDelta: 25, description: '+25 Glory! No active modifier to echo, but the glory is yours.' };
}

async function sovereignsBoon(ctx) {
    const allGuildScores = state.get('allGuildScores') || {};
    const gData = allGuildScores[ctx.guildId] || {};
    const modifiers = gData.gloryModifiers || [];
    const activeMods = modifiers.filter(m => m.expiresAt > Date.now());

    if (activeMods.length === 0) {
        // Fallback: give a 1.5× multiplier for 3 days if no active modifiers
        const fallbackMod = { type: 'multiply', factor: 1.5, expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000, label: "Sovereign's Boon: 1.5× Glory (3d)", createdAt: Date.now() };
        await applyGloryModifier(ctx.guildId, fallbackMod);
        return { gloryDelta: 0, modifierCreated: fallbackMod, description: "No active modifiers to extend — instead, the Sovereign grants 1.5× Glory for 3 days!" };
    }

    // Extend the best active modifier by 3 days
    const bestMod = activeMods.sort((a, b) => (b.expiresAt || 0) - (a.expiresAt || 0))[0];
    const extendedMod = { ...bestMod, expiresAt: (bestMod.expiresAt || Date.now()) + 3 * 24 * 60 * 60 * 1000, label: `${bestMod.label || bestMod.type} (extended 3d)` };
    await applyGloryModifier(ctx.guildId, extendedMod);
    return { gloryDelta: 0, modifierCreated: extendedMod, description: `Sovereign's Boon extends "${bestMod.label || bestMod.type}" by 3 days!` };
}

async function fatesReversal(ctx) {
    const allGuildScores = state.get('allGuildScores') || {};
    const gData = allGuildScores[ctx.guildId] || {};
    const myWeeklyGlory = Number(gData.weeklyGlory) || 0;

    // Find nearest rival guild (closest weekly glory, not same guild)
    let rivalGuildId = null;
    let rivalWeeklyGlory = 0;
    let smallestDiff = Infinity;

    for (const gid of GUILD_IDS) {
        if (gid === ctx.guildId) continue;
        const rival = allGuildScores[gid] || {};
        const rivalGlory = Number(rival.weeklyGlory) || 0;
        const diff = Math.abs(rivalGlory - myWeeklyGlory);
        if (diff < smallestDiff) {
            smallestDiff = diff;
            rivalGuildId = gid;
            rivalWeeklyGlory = rivalGlory;
        }
    }

    if (!rivalGuildId) {
        // Fallback: just give +150 glory
        await adjustGuildGlory(ctx.guildId, 150, 'wheel_fates_reversal_fallback');
        return { gloryDelta: 150, description: "Fate couldn't find a rival — instead, +150 Glory!" };
    }

    // Swap weekly glory values
    const myDelta = rivalWeeklyGlory - myWeeklyGlory;
    const rivalDelta = myWeeklyGlory - rivalWeeklyGlory;

    await adjustGuildGlory(ctx.guildId, myDelta, 'wheel_fates_reversal');
    await adjustGuildGlory(rivalGuildId, rivalDelta, 'wheel_fates_reversal');

    const rivalDef = getGuildById(rivalGuildId);
    return {
        gloryDelta: myDelta,
        description: myDelta >= 0
            ? `Fate's Reversal! Swapped weekly Glory with ${rivalDef?.name || 'rival'} — gained ${myDelta} Glory!`
            : `Fate's Reversal! Swapped weekly Glory with ${rivalDef?.name || 'rival'} — lost ${Math.abs(myDelta)} Glory...`
    };
}

async function applyShatteredMirror(ctx) {
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await applyGloryModifier(ctx.guildId, { type: 'shattered_mirror', factor: 0.5, expiresAt, label: 'Shattered Mirror (next positive halved)', createdAt: Date.now() });
    return { gloryDelta: 0, modifierCreated: { type: 'shattered_mirror', factor: 0.5, expiresAt }, description: 'A shattered mirror! The next positive wheel effect on this guild will be halved.' };
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
    // All leagues can land on any effect — the wheel of fortune spares no one
    let pool = ALL_SEGMENTS;

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

        selected.set(candidate.id, { ...candidate, paletteIndex: Math.floor(Math.random() * 3) });
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
        classEndDates: state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {},
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

        // Check for shattered mirror: halve positive effects and consume the modifier
        if (segment.category !== 'negative' && result) {
            const modifiers = gData.gloryModifiers || [];
            const mirrorIdx = modifiers.findIndex(m => m.type === 'shattered_mirror' && m.expiresAt > Date.now());
            if (mirrorIdx !== -1) {
                // Halve positive glory delta
                if (result.gloryDelta > 0) result.gloryDelta = Math.floor(result.gloryDelta / 2);
                if (result.goldDelta > 0) result.goldDelta = Math.floor((result.goldDelta || 0) / 2);
                if (result.starsDelta > 0) result.starsDelta = Math.floor((result.starsDelta || 0) / 2);
                if (result.classQuestDelta > 0) result.classQuestDelta = Math.floor((result.classQuestDelta || 0) / 2);
                // Remove the shattered mirror modifier (consumed)
                const updatedModifiers = [...modifiers];
                updatedModifiers.splice(mirrorIdx, 1);
                const updatedScores = { ...gData, gloryModifiers: updatedModifiers };
                const allScores = { ...allGuildScores, [guildId]: updatedScores };
                state.setAllGuildScores(allScores);
                result.description = `🪞 Shattered Mirror halved this effect! ${result.description}`;
            }
        }

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

/**
 * Render the full static wheel (segments, rim, text, center emblem, glossy sheen)
 * centered at the CURRENT origin. Caller must translate to (center, center) first.
 */
function _renderStaticWheelAtOrigin(ctx, size, segments, guildDef) {
    const center = size / 2;
    const radius = center - 24;
    const segCount = segments.length;
    const segAngle = TAU / segCount;

    // Assumes ctx is already translated to (center, center) by caller

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

    // Wheel background disc
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    for (let i = 0; i < segCount; i++) {
        const seg = segments[i];
        const startAngle = i * segAngle;
        const endAngle = startAngle + segAngle;
        const rarityConf = getRarityPalette(seg.rarity, seg.paletteIndex);
        const isPrismatic = seg.isPrismatic === true;

        // Vibrant wedge gradient
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.closePath();

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
            const gradient = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
            gradient.addColorStop(0, rarityConf.bg);
            gradient.addColorStop(0.6, rarityConf.bg);
            gradient.addColorStop(1, rarityConf.color);
            ctx.fillStyle = gradient;
        }
        ctx.fill();

        // Inner bevel highlight
        ctx.beginPath();
        ctx.arc(0, 0, radius, startAngle + 0.02, startAngle + segAngle * 0.35);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Highlighting edge
        ctx.beginPath();
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Inner shadow for depth
        ctx.beginPath();
        ctx.arc(0, 0, radius - 8, startAngle, endAngle);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Wedge dividing borders
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius);
        const borderGrad = ctx.createLinearGradient(0, 0, Math.cos(startAngle) * radius, Math.sin(startAngle) * radius);
        borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        borderGrad.addColorStop(1, 'rgba(245, 158, 11, 0.8)');
        ctx.strokeStyle = borderGrad;
        ctx.lineWidth = Math.max(2, size / 150);
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Draw emoji icon + label text
        ctx.save();
        ctx.rotate(startAngle + segAngle / 2);

        const emoji = seg.emoji || '';
        const label = seg.label || '';
        const maxTextWidth = radius * 0.45;

        const bgLum = _luminance(rarityConf.bg);
        const textColor = bgLum > 0.35 ? 'rgba(0, 0, 0, 0.85)' : '#FFFFFF';
        const shadowColor = bgLum > 0.35 ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.4)';

        // Emoji icon
        const emojiSize = Math.max(16, Math.floor(size / 28));
        ctx.font = `${emojiSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        const emojiRadius = radius - Math.max(22, size * 0.07);
        ctx.fillText(emoji, emojiRadius, 0);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Label text
        const fontSize = Math.max(11, Math.floor(size / 42));
        ctx.font = `800 ${fontSize}px "Fredoka One", "Trebuchet MS", system-ui, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        const lines = wrapText(ctx, label, maxTextWidth);
        const lineHeight = fontSize * 1.2;
        const totalTextHeight = lines.length * lineHeight;
        const textStartRadius = radius - Math.max(34, size * 0.12);
        const startY = -(totalTextHeight / 2) + (lineHeight / 2);

        for (let j = 0; j < lines.length; j++) {
            ctx.fillText(lines[j], textStartRadius, startY + (j * lineHeight));
        }

        ctx.restore();
    }

    // --- Glossy Sheen Overlay ---
    const sheen = ctx.createLinearGradient(-radius, -radius, radius, radius);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    sheen.addColorStop(0.4, 'rgba(255, 255, 255, 0.05)');
    sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(0.6, 'rgba(0, 0, 0, 0.05)');
    sheen.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fillStyle = sheen;
    ctx.fill();

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
    const radius = center - 24;
    const segCount = segments.length;
    const segAngle = TAU / segCount;

    ctx.clearRect(0, 0, size, size);

    // Bright celestial aura behind the wheel (cheap — single radial gradient)
    const aura = ctx.createRadialGradient(center, center, radius * 0.2, center, center, size / 2);
    aura.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    aura.addColorStop(0.5, 'rgba(253, 230, 138, 0.4)');
    aura.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, size, size);

    // Blit the pre-rendered static wheel (segments, rim, text, emblem, sheen) with rotation
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

    // Winner highlight overlay (only drawn on the final revealed frame)
    if (Number.isInteger(highlightIndex) && highlightIndex >= 0 && highlightIndex < segCount) {
        const seg = segments[highlightIndex];
        const rarityConf = getRarityPalette(seg?.rarity, seg?.paletteIndex);
        const startAngle = highlightIndex * segAngle;
        const endAngle = startAngle + segAngle;

        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(rotationAngle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.shadowColor = rarityConf.glow || 'rgba(251, 191, 36, 0.55)';
        ctx.shadowBlur = Math.max(18, size / 18);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = Math.max(12, size / 50);
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
    _renderCurrentGuildMembers();
    _setStageCaption('');

    _updateSpinButton(true, availability.code === 'already_spun' ? 'Recharging' : 'Await Final Lesson');
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

    panel.innerHTML = `
        <div class="fw-guild-members__header">${guildDef?.name || 'Active Guild'} Members</div>
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

    _updateSpinButton(true, 'Spinning...');

    // Animate
    const anim = await animateWheelSpin(canvas, segments, winnerIndex, guildDef, () => {
        try { playSound('click'); } catch (_) {}
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
    triggerWheelRevealEffects(winningSeg.rarity, winningSeg.category === 'negative');

    // Apply effect
    const result = await applyWheelResult(guildId, winningSeg, _wheelState.classId);
    _wheelState.results.push(result);
    _wheelState.phase = 'revealed';

    // Optimistic UI/state refresh (Firestore will still confirm truth shortly)
    _optimisticallyApplyWheelResultToState({ ...result, segmentId: winningSeg?.id });
    try {
        const guildsTab = document.getElementById('guilds-tab');
        if (guildsTab && !guildsTab.classList.contains('hidden')) {
            import('../ui/tabs/guilds.js').then(m => m.renderGuildsTab());
        }
    } catch (_) { }

    _renderWheelResult(winningSeg, result, guildDef);
}

/**
 * Advance to next guild or show summary.
 */
export function advanceWheel() {
    if (_wheelState.currentGuildIndex < _wheelState.guildOrder.length - 1) {
        _wheelState.currentGuildIndex++;
        invalidateWheelCache();
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
    _renderCurrentGuildMembers();

    hideModal('fortunes-wheel-modal');
    _hideResultReveal();
}

// ── Internal UI helpers ──────────────────────────────────────────────────────

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
    _renderCurrentGuildMembers();
    _setStageEmblem(guildId);
    _setStageCaption(`${guildDef?.name || 'This guild'} steps onto the relic stage. Spin to reveal its weekly omen.`);

    const stageFrame = document.getElementById('fw-stage-frame');
    if (stageFrame) {
        stageFrame.classList.remove('is-locked');
        stageFrame.classList.remove('is-spinning');
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
    const displaySize = Math.round(Math.min(640, available));
    if (!displaySize || displaySize < 10) return;

    if (displaySize !== _lastWheelDisplaySize) {
        invalidateWheelCache();
        _lastWheelDisplaySize = displaySize;
    }

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
    const backdrop = revealLayer.querySelector('.fw-reveal-layer__backdrop');
    if (backdrop) {
        backdrop.style.setProperty('--backdrop-glow', rarityGlow || 'rgba(251,191,36,0.24)');
    }

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
            const rarityConf = getRarityPalette(r.rarity, r.paletteIndex);
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
    if (!captionEl) return;
    const t = String(text ?? '').trim();
    captionEl.textContent = t;
    captionEl.classList.toggle('hidden', !t);
}
