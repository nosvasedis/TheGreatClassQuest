// features/fortunesWheel.js — Fortune's Wheel: segment catalog, spin logic, canvas renderer, effect application

import * as state from '../state.js';
import { db, doc, updateDoc } from '../firebase.js';
import { GUILD_IDS, getGuildById, getGuildEmblemUrl } from './guilds.js';
import { WHEEL_RARITY_WEIGHTS, WHEEL_PRISMATIC_CONFIG, getRarityPalette } from '../constants.js';
import { saveFortuneWheelResult, hasSpunThisWeek } from '../db/actions/guilds.js';
import { getISOWeekKey, updateGuildScores, awardGloryToStudents, takeGloryFromStudents, chapterGloryOf, getGuildMemberCounts, getComebackWind } from './guildScoring.js';
import { chapterKeyFor } from './guildScoringCore.js';
import { composeWheel, composeEnvoyWheel, wheelModeFor } from '../utils/fortuneWheelSegments.mjs';
import { challengeBand } from '../utils/wheelChallenges.mjs';
import { runStage, cancelStage, fxStorm, fxShield, fxSwirl, fxTwist, fxTrial, fxBurst, fxFlash, fxOmen } from './wheelStages.js';
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';
import { applyWheelStudentEffects, applyClassQuestBonusDelta } from '../db/actions/fortuneWheelEffects.js';
import { checkBountyProgress } from '../db/actions/bounties.js';
import { checkAndRecordQuestCompletion } from '../db/actions/stars.js';
import { ensureAudioReady, playSound, playHeroFanfare, playWheelSfx, warmWheelAudio, playDrumRoll, stopDrumRoll } from '../audio.js';
import { evaluateWheelAvailability } from '../utils/fortuneWheelEligibility.mjs';
import { showAnimatedModal, hideModal } from '../ui/modals/base.js';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';

/**
 * Every write the Wheel makes, in one place: the effects below call these, so the preview page
 * (fortune-wheel-preview.js) can run the real fates against a pretend school without Firestore.
 */
export const wheelIo = {
    awardGlory: awardGloryToStudents,
    takeGlory: takeGloryFromStudents,
    monthGlory: chapterGloryOf,
    wind: getComebackWind,
    studentEffects: applyWheelStudentEffects,
    questBonus: applyClassQuestBonusDelta,
    starGlory: updateGuildScores,
    bounty: checkBountyProgress,
    questCheck: checkAndRecordQuestCompletion,
    hasSpun: hasSpunThisWeek,
    save: saveFortuneWheelResult,
    availability: null,
};

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
 * The Wheel of Fate. Each segment has: id, emoji, label, description, rarity, category, effect.
 * Four families share the wheel, each with its own colour and pattern:
 *   treasure (common … mythic): Glory, stars, gold, artifacts and Team Quest stars
 *   twist:  drama (spin again, three chests, double or nothing, a kindness gift, the Trickster…)
 *   trial:  a quick English challenge the guild (or one hero) takes in front of the class
 *   storm:  a small loss: a little Glory or gold. Some storms can be braved with a right answer.
 *   omen:   super rare (about one wheel in three hides one): a big swing of Glory. The bright
 *           ones (phoenix, golden dawn, wishing star) lift a guild; the `harsh` ones (comet,
 *           eclipse, dragon's wager, scales, thief, swaps, the Void) can take Glory or move it
 *           between guilds, still only Glory earned this month and at most OMEN_MAX_SWING per hero.
 *           The Eclipse, the Scales and the Thief hit whoever leads the class this month, so they
 *           help the guilds behind catch up. Calm and gilded wheels only carry bright Omens.
 *   envoy:  a guild with no heroes in the class sends its Envoy instead: a wheel for every hero
 *           in the class, whatever their guild. Mostly gifts, a few tolls (`harsh`), and one
 *           rare trick (`envoyRare`) that swaps the top and bottom guilds' Glory.
 *
 * Fair by design: Glory always goes to (or comes from) each guild member in the spinning class,
 * so every child in every guild faces the same chances, whatever the guild's size. A storm only
 * takes Glory a child already earned this month (never below 0), never takes stars or artifacts,
 * and a guild a storm hit last time gets calmer skies the next week.
 * `stage` names the interactive moment (features/wheelStages.js) that runs before the effect;
 * the effect then receives that moment's decision. `favoredOk: false` keeps a wedge off a wheel
 * gilded by Fortune's Favor.
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
    { id: 'lucky_clover',      emoji: '🍀', label: 'Lucky Clover',       description: '+1 Glory each, and 1 lucky guildmate gets +1 star!',     rarity: 'common',    category: 'perk',  effect: (ctx) => combo(ctx, [(c) => classGlory(c, 1, '', 'clover'), (c) => randomStars(c, 1, 1)], 'Four leaves of luck: +1 Glory for every guildmate here, and a star for one of them!') },

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
    { id: 'star_storm',        emoji: '⭐', label: 'Star Shower Royale', description: '5 random guildmates get +1 star each!',                 rarity: 'rare',      category: 'perk',  effect: (ctx) => randomStars(ctx, 5, 1) },
    { id: 'treasury_overflow', emoji: '🪙', label: 'Treasury Overflow',  description: 'Every guildmate here gets +10 gold!',                    rarity: 'rare',      category: 'perk',  effect: (ctx) => randomGold(ctx, ctx.memberCount, 10) },
    { id: 'mystery_gift',      emoji: '🎒', label: 'Mystery Gift',       description: '1 random guildmate gets a free Legendary Artifact!',    rarity: 'rare',      category: 'perk',  effect: (ctx) => randomArtifact(ctx, 1) },
    { id: 'quest_surge',       emoji: '🗺️', label: 'Quest Surge',        description: '+15 Team Quest bonus stars (this month)!',              rarity: 'rare',      category: 'perk',  effect: (ctx) => classQuestBonus(ctx, 15) },
    { id: 'star_cascade',      emoji: '🌠', label: 'Star Cascade',       description: '4 random guildmates get +1 star and +10 gold each!',    rarity: 'rare',      category: 'perk',  effect: (ctx) => starsAndGold(ctx, 4, 1, 10) },
    { id: 'castle_feast',      emoji: '🍗', label: 'Castle Feast',       description: 'A feast in the great hall: every guildmate here gets +10 gold and +1 Glory!', rarity: 'rare', category: 'fun', effect: (ctx) => combo(ctx, [(c) => randomGold(c, c.memberCount, 10), (c) => classGlory(c, 1, '', 'feast')], 'A feast in the great hall! Every guildmate here gets +10 gold and +1 Glory.') },

    // ── Epic ──────────────────────────────────────────────────────────────────
    { id: 'glory_storm',       emoji: '⚜️', label: 'Glory Cascade',      description: '+4 Glory for each guildmate in this class!',            rarity: 'epic',      category: 'glory', effect: (ctx) => classGlory(ctx, 4) },
    { id: 'golden_tide',       emoji: '🌊', label: 'Golden Tide',        description: 'Every guildmate here gets +20 gold and +2 Glory!',      rarity: 'epic',      category: 'perk',  effect: (ctx) => combo(ctx, [(c) => randomGold(c, c.memberCount, 20), (c) => classGlory(c, 2)], 'A golden tide! Every guildmate here gets +20 gold and +2 Glory!') },
    { id: 'teachers_favor',    emoji: '🍎', label: "Teacher's Favor",   description: '1 random guildmate gets +2 stars and +30 gold!',        rarity: 'epic',      category: 'perk',  effect: (ctx) => teachersFavor(ctx) },
    { id: 'double_gift',       emoji: '🎒', label: 'Double Gift',        description: '2 random guildmates each get a Legendary Artifact!',    rarity: 'epic',      category: 'perk',  effect: (ctx) => randomArtifact(ctx, 2) },
    { id: 'gold_rush_extreme', emoji: '💰', label: 'Gold Rush Extreme',  description: 'Every guildmate here gets +50 gold!',                    rarity: 'epic',      category: 'perk',  effect: (ctx) => randomGold(ctx, ctx.memberCount, 50) },
    { id: 'genies_wish',       emoji: '🧞', label: "Genie's Wish",       description: 'The genie grants one wish. The guild chooses: Glory, gold, or stars!', rarity: 'epic', category: 'perk', stage: 'wish', effect: (ctx, d) => geniesWish(ctx, d) },

    // ── Legendary ─────────────────────────────────────────────────────────────
    { id: 'star_supernova',    emoji: '⭐', label: 'Star Supernova',     description: 'Every guildmate here gets +1 star!',                    rarity: 'legendary', category: 'perk',  effect: (ctx) => randomStars(ctx, ctx.memberCount, 1) },
    { id: 'artifact_rain',     emoji: '🎁', label: 'Artifact Rain',      description: 'Every guildmate here gets a Mystery Artifact!',         rarity: 'legendary', category: 'perk',  effect: (ctx) => randomArtifact(ctx, ctx.memberCount) },
    { id: 'crown_of_stars',    emoji: '👑', label: 'Crown of Stars',     description: 'Every guildmate here gets +2 stars and +25 gold!',      rarity: 'legendary', category: 'perk',  effect: (ctx) => starsAndGold(ctx, ctx.memberCount, 2, 25) },

    // ── Mythic ────────────────────────────────────────────────────────────────
    { id: 'glory_miracle',     emoji: '👑', label: 'Glory Miracle',      description: '+5 Glory and +20 gold for each guildmate here!',        rarity: 'mythic',    category: 'glory', isPrismatic: true, effect: (ctx) => combo(ctx, [(c) => classGlory(c, 5), (c) => randomGold(c, c.memberCount, 20)], 'A Glory Miracle! Every guildmate here gets +5 Glory and +20 gold!') },
    { id: 'mythic_relic',      emoji: '🏆', label: 'Relic of Triumph',   description: '+30 Team Quest bonus stars & an Artifact for 5 guildmates!', rarity: 'mythic', category: 'perk', effect: (ctx) => mythicRelic(ctx) },
    { id: 'celestial_convergence', emoji: '✨', label: 'Celestial Convergence', description: '+20 Team Quest bonus, and every guildmate here gets +1 star & +30 gold!', rarity: 'mythic', category: 'perk', isPrismatic: true, effect: (ctx) => combo(ctx, [(c) => classQuestBonus(c, 20), (c) => starsAndGold(c, c.memberCount, 1, 30)], 'Celestial convergence! +20 Team Quest bonus stars, and every guildmate here gets +1 star and +30 gold!') },

    // ── Twists: the drama ─────────────────────────────────────────────────────
    { id: 'trickster',         emoji: '🎭', label: 'Trickster',          description: 'It looks like a win… then it turns out to be nothing!', rarity: 'twist', category: 'twist', stage: 'trickster', weight: 2, favoredOk: false, effect: () => ({ gloryDelta: 0, echo: { kind: 'none' }, description: 'The Trickster laughs! No treasure, and nothing was lost.' }) },
    { id: 'whirlwind',         emoji: '🌪️', label: 'Whirlwind',          description: 'The wind grabs the wheel and spins it again!',          rarity: 'twist', category: 'twist', stage: 'whirlwind', weight: 2, effect: () => ({ gloryDelta: 0, echo: { kind: 'none' }, description: 'The Whirlwind spun the wheel again.' }) },
    { id: 'double_or_nothing', emoji: '🎲', label: 'Double or Nothing',  description: 'Keep +1 Glory each, or flip the coin: +3 each or −1 each!', rarity: 'twist', category: 'twist', stage: 'coin', weight: 2, effect: (ctx, d) => doubleOrNothing(ctx, d) },
    { id: 'three_chests',      emoji: '🗝️', label: 'Three Chests',       description: 'Pick a chest! Two hold treasure… one holds a Mimic.',    rarity: 'twist', category: 'twist', stage: 'chests', weight: 2, effect: (ctx, d) => threeChests(ctx, d) },
    { id: 'kindness_gift',     emoji: '💝', label: 'Kindness Gift',      description: 'Choose a guild to share with: you both earn +1 Glory each.', rarity: 'twist', category: 'twist', stage: 'kindness', weight: 2, effect: (ctx, d) => kindnessGift(ctx, d) },
    { id: 'robin_hood',        emoji: '🏹', label: 'Robin Hood',         description: 'Takes 1 Glory from each guildmate here for the guild that is last this month. If you are last, it helps you!', rarity: 'twist', category: 'twist', weight: 1, favoredOk: false, effect: (ctx) => robinHood(ctx) },
    { id: 'mirror_of_fates',   emoji: '🪞', label: 'Mirror of Fates',    description: 'You get exactly what the guild before you got, good or bad!', rarity: 'twist', category: 'twist', weight: 1, favoredOk: false, effect: (ctx) => mirrorOfFates(ctx) },
    { id: 'gift_exchange',     emoji: '🎁', label: 'Gift Exchange',      description: 'One of your heroes and one hero from another guild here each get +15 gold!', rarity: 'twist', category: 'twist', weight: 1, effect: (ctx) => giftExchange(ctx) },

    // ── Trials: a challenge in front of the class ─────────────────────────────
    { id: 'sphinx_riddle',     emoji: '🦁', label: "Sphinx's Riddle",   description: 'Answer the Sphinx together: +3 Glory each if right, −1 each if wrong.', rarity: 'trial', category: 'trial', stage: 'trial', trial: 'riddle', win: '+3 Glory each', lose: '−1 Glory each', weight: 2, effect: (ctx, d) => (d?.passed ? classGlory(ctx, 3, 'The Sphinx bows!', 'sphinx') : stormGlory(ctx, 1, 'The Sphinx keeps its secret.', 'sphinx')) },
    { id: 'lightning_round',   emoji: '⚡', label: 'Lightning Round',    description: 'Name the words before the clock runs out: +2 Glory each!', rarity: 'trial', category: 'trial', stage: 'trial', trial: 'lightning', win: '+2 Glory each', lose: 'No Glory this time', weight: 2, effect: (ctx, d) => (d?.passed ? classGlory(ctx, 2, 'Lightning fast!', 'lightning') : { gloryDelta: 0, echo: { kind: 'none' }, description: 'So close! The clock won this round.' }) },
    { id: 'heros_dare',        emoji: '🎤', label: "Hero's Dare",        description: 'The spotlight picks one guildmate for a dare: +1 star and +10 gold!', rarity: 'trial', category: 'trial', stage: 'dare', weight: 2, effect: (ctx, d) => herosDare(ctx, d) },

    // ── Storms: small losses (never stars, never artifacts) ───────────────────
    { id: 'rain_cloud',        emoji: '🌧️', label: 'Rain Cloud',         description: '−1 Glory for each guildmate here.',                      rarity: 'storm', category: 'storm', stage: 'storm', brave: true,  weight: 3, favoredOk: false, effect: (ctx, d) => (d?.braved ? braved(ctx) : stormGlory(ctx, 1, 'The rain washes a little Glory away.')) },
    { id: 'leaky_pouch',       emoji: '🕳️', label: 'Leaky Pouch',        description: '3 guildmates drop 5 gold each.',                         rarity: 'storm', category: 'storm', stage: 'storm', brave: false, weight: 3, favoredOk: false, effect: (ctx) => loseGold(ctx, 3, 5, 'A hole in the pouch!') },
    { id: 'goblin_toll',       emoji: '👺', label: "Goblin's Toll",      description: '2 guildmates pay the goblin 10 gold each.',              rarity: 'storm', category: 'storm', stage: 'storm', brave: true,  weight: 2, favoredOk: false, effect: (ctx, d) => (d?.braved ? braved(ctx, 'The goblin grumbles and runs off empty-handed!') : loseGold(ctx, 2, 10, 'The goblin collects its toll.')) },
    { id: 'rockslide',         emoji: '🪨', label: 'Rockslide',          description: '−1 Glory each, and 2 guildmates drop 5 gold.',           rarity: 'storm', category: 'storm', stage: 'storm', brave: true,  weight: 2, favoredOk: false, effect: (ctx, d) => (d?.braved ? braved(ctx, 'The rocks roll past the guild!') : combo(ctx, [(c) => stormGlory(c, 1), (c) => loseGold(c, 2, 5)], 'Rockslide! A little Glory and gold tumble away.')) },
    { id: 'thunderclap',       emoji: '⛈️', label: 'Thunderclap',        description: '−3 Glory for each guildmate here. No shelter from this one!', rarity: 'storm', category: 'storm', stage: 'storm', brave: false, weight: 1, favoredOk: false, effect: (ctx) => stormGlory(ctx, 3, 'Thunder shakes the hall!') },

    // ── Omens: super rare, big swings of Glory ────────────────────────────────
    { id: 'wishing_star',      emoji: '🌠', label: 'Wishing Star',       description: 'The rarest light in the sky: +8 Glory for each guildmate here!', rarity: 'omen', category: 'omen', weight: 1, effect: (ctx) => classGlory(ctx, 8, 'A wishing star falls into the guild hall!', 'wish') },
    { id: 'golden_dawn',       emoji: '🌅', label: 'Golden Dawn',        description: '+4 Glory for each guildmate here, and +1 Glory for every other hero in the class!', rarity: 'omen', category: 'omen', weight: 2, effect: (ctx) => goldenDawn(ctx) },
    { id: 'phoenix_rising',    emoji: '🔥', label: 'Phoenix Rising',     description: '+2 Glory each, or +6 each if the guild is last in this class this month or a storm hit it last time!', rarity: 'omen', category: 'omen', weight: 2, effect: (ctx) => phoenixRising(ctx) },
    { id: 'falling_comet',     emoji: '☄️', label: 'Falling Comet',      description: 'A comet falls: −5 Glory each! Answer together and it bursts into stardust: +2 Glory each instead.', rarity: 'omen', category: 'omen', stage: 'omen', brave: true, harsh: true, weight: 2, favoredOk: false, effect: (ctx, d) => fallingComet(ctx, d) },
    { id: 'eclipse',           emoji: '🌑', label: 'The Eclipse',        description: 'The shadow falls on the brightest guild in this class this month: −4 Glory for each of its heroes here.', rarity: 'omen', category: 'omen', harsh: true, weight: 2, favoredOk: false, effect: (ctx) => eclipse(ctx) },
    { id: 'scales_of_fate',    emoji: '⚖️', label: 'Scales of Fate',     description: 'Behind the leader? +3 Glory each. Leading this class? −3 each, and the last guild here gets +4 each.', rarity: 'omen', category: 'omen', harsh: true, weight: 2, favoredOk: false, effect: (ctx) => scalesOfFate(ctx) },
    { id: 'dragons_wager',     emoji: '🐉', label: "Dragon's Wager",     description: 'Walk away with +1 Glory each, or wake the dragon: +8 Glory each… or −4 each!', rarity: 'omen', category: 'omen', stage: 'dragon', harsh: true, weight: 2, effect: (ctx, d) => dragonsWager(ctx, d) },
    { id: 'shadow_thief',      emoji: '🦹', label: 'Shadow Thief',       description: 'A thief steals up to 3 Glory from each hero of the class leader and hands it to this guild. If this guild leads, it is robbed for the last guild instead!', rarity: 'omen', category: 'omen', harsh: true, weight: 2, favoredOk: false, effect: (ctx) => shadowThief(ctx) },
    { id: 'swap_of_fates',     emoji: '🔄', label: 'Swap of Fates',      description: 'This guild and another guild here trade places: their Glory this month swaps (up to 8 per hero). Lucky if you are behind!', rarity: 'omen', category: 'omen', harsh: true, weight: 1, favoredOk: false, effect: (ctx) => swapOfFates(ctx) },
    { id: 'topsy_turvy',       emoji: '🙃', label: 'Topsy-Turvy',        description: 'The top and bottom guilds in this class swap their Glory this month (up to 8 per hero)!', rarity: 'omen', category: 'omen', harsh: true, weight: 1, favoredOk: false, effect: (ctx) => topsyTurvy(ctx) },
    { id: 'the_void',          emoji: '🌌', label: 'The Void',           description: 'The rarest dark sky: the Void swallows half of each guildmate\'s Glory this month (up to 8 each).', rarity: 'omen', category: 'omen', harsh: true, weight: 1, favoredOk: false, effect: (ctx) => theVoid(ctx) },
    // ── The Envoy's wheel: a guild with no heroes here sends gifts (and a few tolls) for the whole class ──
    { id: 'envoy_dove',        emoji: '🕊️', label: 'Peace Dove',         description: 'Every hero in this class earns +1 Glory for their own guild.', rarity: 'envoy', category: 'envoy', weight: 3, effect: (ctx) => envoyGlory(ctx, 1) },
    { id: 'envoy_map',         emoji: '🗺️', label: "Envoy's Map",        description: 'A map from far away: +4 Team Quest bonus stars for the class!', rarity: 'envoy', category: 'envoy', weight: 3, effect: (ctx) => classQuestBonus(ctx, 4) },
    { id: 'envoy_parcel',      emoji: '📦', label: "Envoy's Parcel",     description: 'One hero from every guild in this class gets +10 gold.', rarity: 'envoy', category: 'envoy', weight: 3, effect: (ctx) => envoyPerGuild(ctx, { gold: 10 }) },
    { id: 'envoy_letter',      emoji: '📜', label: 'Letter from Afar',   description: '3 heroes in this class get +5 gold, with warm greetings.', rarity: 'envoy', category: 'envoy', weight: 2, effect: (ctx) => envoyGold(ctx, 3, 5) },
    { id: 'envoy_banner',      emoji: '🚩', label: 'Distant Banner',     description: 'The envoy cheers for the underdog: +2 Glory for each hero of the guild that is last in this class this month.', rarity: 'envoy', category: 'envoy', weight: 1, effect: (ctx) => envoyBanner(ctx) },
    { id: 'envoy_lantern',     emoji: '🏮', label: 'Wishing Lantern',    description: 'One hero from every guild in this class gets +1 star!', rarity: 'envoy', category: 'envoy', weight: 1, effect: (ctx) => envoyPerGuild(ctx, { stars: 1 }) },
    { id: 'envoy_feast',       emoji: '🍯', label: "Travellers' Feast",  description: 'Every hero in this class gets +5 gold!', rarity: 'envoy', category: 'envoy', weight: 1, effect: (ctx) => envoyGold(ctx, Infinity, 5) },
    { id: 'envoy_toll',        emoji: '🧾', label: "Envoy's Toll",       description: 'The envoy collects a toll: −1 Glory from every hero in this class (only Glory earned this month).', rarity: 'envoy', category: 'envoy', harsh: true, weight: 1, effect: (ctx) => envoyToll(ctx, 1) },
    { id: 'envoy_spy',         emoji: '🕵️', label: 'Spy from Afar',      description: 'A spy slips into the leading guild\'s camp: −3 Glory for each of its heroes here.', rarity: 'envoy', category: 'envoy', harsh: true, weight: 1, effect: (ctx) => envoySpy(ctx, 3) },
    { id: 'envoy_fog',         emoji: '🌫️', label: 'Sour Fog',           description: 'A fog rolls in from far away: one hero from every guild here drops 10 gold.', rarity: 'envoy', category: 'envoy', harsh: true, weight: 1, effect: (ctx) => envoyFog(ctx, 10) },
    { id: 'envoy_trick',       emoji: '🃏', label: "Envoy's Trick",      description: 'The rarest card in the envoy\'s sleeve: the top and bottom guilds in this class swap their Glory this month (up to 8 per hero)!', rarity: 'envoy', category: 'envoy', harsh: true, envoyRare: true, weight: 1, effect: (ctx) => topsyTurvy(ctx, 'envoy_trick') },
    { id: 'envoy_jest',        emoji: '🤹', label: "Envoy's Juggling",   description: 'The envoy juggles for the class. Big laughs, and nothing else changes!', rarity: 'envoy', category: 'envoy', weight: 1, effect: () => ({ gloryDelta: 0, echo: { kind: 'none' }, description: 'The envoy juggles three apples and a teapot. The whole class laughs, and nothing else changes!' }) },
];

const SEGMENTS_BY_ID = new Map(ALL_SEGMENTS.map((seg) => [seg.id, seg]));

/** The catalog, for the guidebook and tests. */
export function getWheelCatalog() {
    return ALL_SEGMENTS.map(({ effect, ...seg }) => ({ ...seg }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// EFFECT IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

const _round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** The most Glory a single fate can move for one hero, up or down (losses only from this month's Glory). */
export const OMEN_MAX_SWING = 8;

/**
 * Notes what one hero received or lost in this fate. The card then shows every hero touched,
 * grouped by guild (`spared`: a storm found no Glory of theirs to take).
 */
function _mark(ctx, studentId, patch = {}) {
    if (!ctx?.ledger || !studentId) return;
    const row = ctx.ledger.get(studentId) || { id: studentId, glory: 0, gold: 0, stars: 0, artifacts: [] };
    for (const [key, value] of Object.entries(patch)) {
        if (key === 'artifact') row.artifacts.push(value);
        else if (key === 'spared') row.spared = true;
        else row[key] = _round2((row[key] || 0) + (Number(value) || 0));
    }
    ctx.ledger.set(studentId, row);
}

/**
 * Pays (or charges) the chosen heroes. Firestore refuses one commit that touches 9 or more
 * heroes' scores, so a big group (a whole class from the Envoy) is written 6 at a time.
 */
async function _studentEffects(opts) {
    const { students = [], count = 0 } = opts;
    const chosen = students.length > count ? shuffleArray([...students]).slice(0, count) : [...students];
    if (chosen.length <= 6) return wheelIo.studentEffects({ ...opts, students: chosen, count: chosen.length });
    const total = { affectedStudents: [], starsDelta: 0, goldDelta: 0, artifactsGranted: 0, artifactsRemoved: 0, grantedArtifacts: [] };
    for (let i = 0; i < chosen.length; i += 6) {
        const part = chosen.slice(i, i + 6);
        const r = await wheelIo.studentEffects({ ...opts, students: part, count: part.length });
        total.affectedStudents.push(...(r.affectedStudents || []));
        total.grantedArtifacts.push(...(r.grantedArtifacts || []));
        for (const key of ['starsDelta', 'goldDelta', 'artifactsGranted', 'artifactsRemoved']) total[key] += Number(r[key]) || 0;
    }
    return total;
}

/** Runs several effects for one wedge and adds their outcomes together. */
async function combo(ctx, effects, description) {
    const total = { gloryDelta: 0, starsDelta: 0, goldDelta: 0, classQuestDelta: 0, artifactsGranted: 0, artifactsRemoved: 0, affectedStudents: [], grantedArtifacts: [] };
    for (const run of effects) {
        const r = (await run(ctx)) || {};
        total.gloryDelta += Number(r.gloryDelta) || 0;
        total.starsDelta += Number(r.starsDelta) || 0;
        total.goldDelta += Number(r.goldDelta) || 0;
        total.classQuestDelta += Number(r.classQuestDelta) || 0;
        total.artifactsGranted += Number(r.artifactsGranted) || 0;
        total.grantedArtifacts.push(...(r.grantedArtifacts || []));
        if (r.stormHit) total.stormHit = true;
        total.affectedStudents = [...new Set([...total.affectedStudents, ...(r.affectedStudents || [])])];
    }
    return { ...total, description };
}

/** +perMember Glory for each guild member in this class, credited to each of them. */
async function classGlory(ctx, perMember, lead = '', tag = 'glory') {
    const members = ctx.guildStudents || [];
    if (!members.length) return { gloryDelta: 0, echo: { kind: 'glory', n: perMember }, description: 'No guildmates in this class to receive the Glory.' };
    const byGuild = await wheelIo.awardGlory(members.map((s) => s.id), perMember, 'wheel_glory', {
        classId: ctx.classId,
        note: "Fortune's Wheel",
        idempotencyPrefix: ctx.spinKey ? `${ctx.spinKey}_${tag}` : null,
    });
    members.forEach((s) => _mark(ctx, s.id, { glory: perMember }));
    const gloryDelta = Math.round(Number(byGuild[ctx.guildId]) || 0);
    return {
        gloryDelta,
        affectedStudents: members.map((s) => s.id),
        echo: { kind: 'glory', n: perMember },
        description: `${lead ? `${lead} ` : ''}Each of the ${members.length} guildmate${members.length === 1 ? '' : 's'} here earns +${perMember} Glory (+${gloryDelta} for the guild).`,
    };
}

/** +perHero Glory for each of `students` (any guild), each for their own guild. Returns Glory per guild. */
async function giveGlory(ctx, students, perHero, tag, source = 'wheel_glory') {
    if (!students.length) return {};
    const byGuild = await wheelIo.awardGlory(students.map((s) => s.id), perHero, source, {
        classId: ctx.classId,
        note: "Fortune's Wheel",
        idempotencyPrefix: ctx.spinKey ? `${ctx.spinKey}_${tag}` : null,
    });
    students.forEach((s) => _mark(ctx, s.id, { glory: perHero }));
    return byGuild;
}

/** A storm: up to `perMember` Glory from each guildmate here, only from Glory earned this month. */
async function stormGlory(ctx, perMember, lead = '', tag = 'storm') {
    const members = ctx.guildStudents || [];
    if (!members.length) return { gloryDelta: 0, echo: { kind: 'loseGlory', n: perMember }, description: 'No guildmates here, so the storm found no one.' };
    const { byGuild, byStudent } = await wheelIo.takeGlory(members.map((s) => s.id), perMember, 'wheel_storm', {
        classId: ctx.classId,
        note: "Fortune's Wheel storm",
        idempotencyPrefix: ctx.spinKey ? `${ctx.spinKey}_${tag}` : null,
    });
    members.forEach((s) => (byStudent[s.id] ? _mark(ctx, s.id, { glory: -byStudent[s.id] }) : _mark(ctx, s.id, { spared: true })));
    const lost = _round2(byGuild[ctx.guildId]);
    const spared = members.length - Object.keys(byStudent).length;
    return {
        gloryDelta: -lost,
        stormHit: lost > 0,
        affectedStudents: Object.keys(byStudent),
        echo: { kind: 'loseGlory', n: perMember },
        description: lost > 0
            ? `${lead ? `${lead} ` : ''}The guild loses ${lost} Glory (up to ${perMember} from each guildmate here${spared ? `; ${spared} had no Glory this month to lose` : ''}).`
            : `${lead ? `${lead} ` : ''}Nobody here had Glory this month for the storm to take!`,
    };
}

function _goldOf(studentId) {
    const sc = (state.get('allStudentScores') || []).find((x) => x.id === studentId);
    return Number(sc?.gold) || 0;
}

/** A storm: `count` random guildmates (with gold) lose `amount` gold each, never below 0. */
async function loseGold(ctx, count, amount, lead = '') {
    const members = ctx.guildStudents || [];
    const withGold = members.filter((s) => _goldOf(s.id) > 0);
    if (!withGold.length) return { gloryDelta: 0, echo: { kind: 'loseGold', count, n: amount }, description: `${lead ? `${lead} ` : ''}Empty pockets: nobody here had gold to drop!` };
    const before = new Map(withGold.map((s) => [s.id, _goldOf(s.id)]));
    const outcome = await _studentEffects({ classId: ctx.classId, students: withGold, count, goldDelta: -amount, note: "Fortune's Wheel storm" });
    outcome.affectedStudents.forEach((id) => _mark(ctx, id, { gold: -Math.min(amount, before.get(id) || amount) }));
    const names = members.filter((s) => outcome.affectedStudents.includes(s.id)).map((s) => s.name).join(', ');
    return {
        gloryDelta: 0,
        ...outcome,
        stormHit: (outcome.goldDelta || 0) < 0,
        echo: { kind: 'loseGold', count, n: amount },
        description: `${lead ? `${lead} ` : ''}${names} drop${outcome.affectedStudents.length === 1 ? 's' : ''} ${amount} gold.`,
    };
}

/** A storm the guild braved with a right answer: nothing lost. */
function braved(ctx, line = 'The guild braved the storm. Its shield held, and nothing was lost!') {
    (ctx.guildStudents || []).forEach((s) => _mark(ctx, s.id, { spared: true }));
    return { gloryDelta: 0, braved: true, echo: { kind: 'none' }, description: line };
}

async function doubleOrNothing(ctx, d = {}) {
    if (d.choice !== 'flip') {
        const r = await classGlory(ctx, 1, 'The guild played it safe.', 'coin');
        return { ...r, decision: 'Kept it safe' };
    }
    if (d.heads) {
        const r = await classGlory(ctx, 3, 'Heads! The gamble paid off.', 'coin');
        return { ...r, decision: 'Flipped: heads' };
    }
    const r = await stormGlory(ctx, 1, 'Tails! The gamble slipped away.', 'coin');
    return { ...r, decision: 'Flipped: tails' };
}

async function threeChests(ctx, d = {}) {
    if (d.prize === 'gold') return { ...(await classGlory(ctx, 3, 'The golden chest!', 'chest')), decision: 'Golden chest' };
    if (d.prize === 'silver') {
        const r = await combo(ctx, [(c) => classGlory(c, 1, '', 'chest'), (c) => randomGold(c, 2, 10)], 'The silver chest: +1 Glory each, and gold for two guildmates!');
        return { ...r, echo: { kind: 'glory', n: 1 }, decision: 'Silver chest' };
    }
    if (d.prize === 'bronze') return { ...(await randomGold(ctx, 2, 10)), echo: { kind: 'gold', count: 2, n: 10 }, decision: 'Bronze chest' };
    return { ...(await stormGlory(ctx, 1, 'A Mimic! It bites off a little Glory.', 'chest')), decision: 'The Mimic' };
}

/** Guild members in this class, for another guild. */
function _classMembersOf(guildId, classId) {
    return (state.get('allStudents') || []).filter((s) => s.guildId === guildId && s.classId === classId);
}

/** Every hero in this class who belongs to a guild. */
function _classHeroes(classId) {
    return (state.get('allStudents') || []).filter((s) => s.classId === classId && GUILD_IDS.includes(s.guildId));
}

const _guildName = (gid, fallback = 'a guild') => getGuildById(gid)?.name || fallback;

async function kindnessGift(ctx, d = {}) {
    const mine = await classGlory(ctx, 1, '', 'kind');
    const other = d.guildId ? _classMembersOf(d.guildId, ctx.classId) : [];
    if (!other.length) return { ...mine, description: 'No other guild here to share with, so the kindness stays home: +1 Glory each.' };
    await giveGlory(ctx, other, 1, 'kind_to', 'wheel_kindness');
    const name = _guildName(d.guildId, 'another guild');
    return { ...mine, sharedWith: d.guildId, decision: `Shared with ${name}`, description: `A kind heart! Every guildmate here and every ${name} member in this class earn +1 Glory.` };
}

/**
 * This month's Glory per member for each guild that has members in this class, lowest first.
 * Ties keep a stable order; `leaders` are every guild sharing the top, `last` only when alone at the bottom.
 */
function _classChapterStandings(classId) {
    const key = chapterKeyFor(new Date());
    const scores = state.get('allGuildScores') || {};
    const counts = getGuildMemberCounts();
    return GUILD_IDS
        .filter((gid) => _classMembersOf(gid, classId).length > 0)
        .map((gid) => ({ gid, perMember: (Number(scores[gid]?.chapters?.[key]?.glory) || 0) / Math.max(1, counts[gid] || 1) }))
        .sort((a, b) => a.perMember - b.perMember);
}

function _standingsShape(classId) {
    const st = _classChapterStandings(classId);
    const top = st.length ? st[st.length - 1].perMember : 0;
    const leaders = st.filter((x) => x.perMember === top).map((x) => x.gid);
    const lastAlone = st.length > 1 && st[0].perMember < st[1].perMember ? st[0].gid : null;
    return { st, leaders, soleLeader: leaders.length === 1 && st.length > 1 ? leaders[0] : null, lastAlone };
}

async function robinHood(ctx) {
    const standings = _classChapterStandings(ctx.classId);
    const last = standings[0]?.gid;
    if (!last || last === ctx.guildId || standings.length < 2) {
        const r = await classGlory(ctx, 1, 'Robin Hood helps the underdog!', 'robin');
        return { ...r, description: `Robin Hood helps the underdog! ${r.description}` };
    }
    const taken = await stormGlory(ctx, 1, '', 'robin');
    await giveGlory(ctx, _classMembersOf(last, ctx.classId), 1, 'robin_give', 'wheel_robin_hood');
    const name = _guildName(last, 'the last guild');
    return {
        ...taken,
        robinTo: last,
        echo: { kind: 'loseGlory', n: 1 },
        description: `Robin Hood strikes! ${taken.gloryDelta < 0 ? `This guild gives ${-taken.gloryDelta} Glory` : 'Nobody here had Glory to give, but Robin is generous'}, and each ${name} member in this class earns +1 Glory.`,
    };
}

async function mirrorOfFates(ctx) {
    const prev = ctx.previous;
    const echo = prev?.echo;
    const prevName = prev ? _guildName(prev.guildId, 'the guild before') : null;
    let r;
    if (!prev || !echo || echo.kind === 'none') {
        r = await classGlory(ctx, 1, '', 'mirror');
        return { ...r, description: prev
            ? `The mirror cannot copy ${prevName}'s fate, so it shines on you: +1 Glory for each guildmate here.`
            : 'The mirror shows only your own reflection: +1 Glory for each guildmate here.' };
    }
    if (echo.kind === 'segment' && SEGMENTS_BY_ID.get(echo.id) && !SEGMENTS_BY_ID.get(echo.id).stage) r = await SEGMENTS_BY_ID.get(echo.id).effect({ ...ctx, spinKey: `${ctx.spinKey}_mirror` }, {});
    else if (echo.kind === 'segment' && SEGMENTS_BY_ID.get(echo.id)?.stage === 'storm') r = await SEGMENTS_BY_ID.get(echo.id).effect({ ...ctx, spinKey: `${ctx.spinKey}_mirror` }, { braved: false });
    else if (echo.kind === 'glory') r = await classGlory(ctx, echo.n, '', 'mirror');
    else if (echo.kind === 'loseGlory') r = await stormGlory(ctx, echo.n, '', 'mirror');
    else if (echo.kind === 'gold') r = await randomGold(ctx, echo.count, echo.n);
    else if (echo.kind === 'loseGold') r = await loseGold(ctx, echo.count, echo.n);
    else r = { gloryDelta: 0, description: '' };
    return { ...r, echo: { kind: 'none' }, mirrored: prev.segmentLabel, description: `The mirror copies ${prevName}'s fate (${prev.segmentLabel}). ${r.description || 'Nothing happens… just like for them!'}` };
}

async function herosDare(ctx, d = {}) {
    const hero = (ctx.guildStudents || []).find((s) => s.id === d.studentId);
    if (!hero) return { gloryDelta: 0, echo: { kind: 'none' }, description: 'No hero in the spotlight this time.' };
    if (d.passed) {
        const r = await starsAndGold({ ...ctx, guildStudents: [hero] }, 1, 1, 10);
        return { ...r, echo: { kind: 'none' }, decision: `${hero.name} took the dare`, description: `${hero.name} nailed the dare! +1 star and +10 gold.` };
    }
    const r = await randomGold({ ...ctx, guildStudents: [hero] }, 1, 5);
    return { ...r, echo: { kind: 'none' }, decision: `${hero.name} was brave`, description: `${hero.name} gave it a brave try: +5 gold for courage.` };
}

/** Rainbow Bridge: every child in the class earns Glory for their own guild. */
async function rainbowBridge(ctx, perMember) {
    const classStudents = _classHeroes(ctx.classId);
    if (!classStudents.length) return { gloryDelta: 0, description: 'No guild members in this class yet.' };
    const byGuild = await giveGlory(ctx, classStudents, perMember, 'bridge', 'wheel_rainbow_bridge');
    return {
        gloryDelta: Math.round(Number(byGuild[ctx.guildId]) || 0),
        description: `A rainbow bridge! All ${classStudents.length} guild members in this class earn +${perMember} Glory for their own guild.`,
    };
}

/** Gift Exchange: one of this guild's heroes and one hero of another guild here each get gold. */
async function giftExchange(ctx) {
    const members = ctx.guildStudents || [];
    const others = _classHeroes(ctx.classId).filter((s) => s.guildId !== ctx.guildId);
    if (!members.length) return { gloryDelta: 0, echo: { kind: 'none' }, description: 'No one here to swap gifts with.' };
    const mine = await randomGold(ctx, 1, 15);
    if (!others.length) return { ...mine, echo: { kind: 'none' }, description: `No other guild here to swap with, so ${mine.description}` };
    const friend = others[Math.floor(Math.random() * others.length)];
    const theirs = await randomGold({ ...ctx, guildStudents: [friend] }, 1, 15);
    const me = members.find((s) => (mine.affectedStudents || []).includes(s.id));
    return {
        gloryDelta: 0,
        goldDelta: (mine.goldDelta || 0) + (theirs.goldDelta || 0),
        affectedStudents: [...(mine.affectedStudents || []), friend.id],
        echo: { kind: 'none' },
        decision: `${me?.name || 'A hero'} ⇄ ${friend.name}`,
        description: `Gifts across the hall! ${me?.name || 'One hero'} and ${friend.name} (${_guildName(friend.guildId)}) each get +15 gold.`,
    };
}

async function geniesWish(ctx, d = {}) {
    if (d.wish === 'gold') {
        const r = await randomGold(ctx, ctx.memberCount, 15);
        return { ...r, echo: { kind: 'gold', count: ctx.memberCount, n: 15 }, decision: 'Wished for gold', description: `The genie bows: every guildmate here gets +15 gold!` };
    }
    if (d.wish === 'stars') {
        const r = await randomStars(ctx, 2, 1);
        return { ...r, echo: { kind: 'none' }, decision: 'Wished for stars', description: `The genie bows: ${r.description}` };
    }
    const r = await classGlory(ctx, 2, 'The genie bows!', 'genie');
    return { ...r, decision: 'Wished for Glory' };
}

// ── Omens ─────────────────────────────────────────────────────────────────────

async function fallingComet(ctx, d = {}) {
    if (d.braved) return { ...(await classGlory(ctx, 2, 'The comet burst into stardust!', 'comet')), braved: true, echo: { kind: 'none' }, decision: 'Turned to stardust' };
    return { ...(await stormGlory(ctx, 5, 'The comet crashes into the guild hall!', 'comet')), echo: { kind: 'none' }, decision: d.attempted ? 'So close! The comet fell' : null };
}

async function goldenDawn(ctx) {
    const mine = await classGlory(ctx, 4, '', 'dawn');
    const others = _classHeroes(ctx.classId).filter((s) => s.guildId !== ctx.guildId);
    await giveGlory(ctx, others, 1, 'dawn_all');
    return {
        ...mine,
        description: others.length
            ? `A golden dawn rises over the class! +4 Glory for each guildmate here, and +1 Glory for the ${others.length} other hero${others.length === 1 ? '' : 'es'} in the class.`
            : `A golden dawn rises over the guild! ${mine.description}`,
    };
}

async function phoenixRising(ctx) {
    const { lastAlone } = _standingsShape(ctx.classId);
    const isLast = lastAlone === ctx.guildId;
    const burned = !isLast && stormHitLastTime(ctx.guildId, ctx.classId);
    const n = isLast || burned ? 6 : 2;
    const r = await classGlory(ctx, n, '', 'phoenix');
    const why = isLast ? 'The guild was last in this class, so the phoenix rises high:' : burned ? 'The guild rises from last week\'s storm:' : 'The phoenix spreads its wings:';
    return { ...r, decision: n === 6 ? 'Risen from the ashes' : null, description: `${why} +${n} Glory for each guildmate here (+${r.gloryDelta} for the guild).` };
}

async function eclipse(ctx) {
    const { leaders } = _standingsShape(ctx.classId);
    const targets = leaders.length ? leaders : [ctx.guildId];
    let own = { gloryDelta: 0, affectedStudents: [] };
    const lines = [];
    for (const gid of targets) {
        const r = await stormGlory({ ...ctx, guildId: gid, guildStudents: _classMembersOf(gid, ctx.classId) }, 4, '', `eclipse_${gid}`);
        if (gid === ctx.guildId) own = r;
        lines.push(r.gloryDelta < 0 ? `${_guildName(gid)} loses ${-r.gloryDelta} Glory` : `${_guildName(gid)} had no Glory this month to lose`);
    }
    const self = targets.includes(ctx.guildId);
    const intro = targets.length > 1
        ? 'The sky goes dark over the guilds tied at the top of this class!'
        : self ? 'The sky goes dark… and this guild is the brightest in the class!'
            : `The sky goes dark over ${_guildName(targets[0])}, the brightest guild in this class this month!`;
    return {
        gloryDelta: own.gloryDelta || 0,
        stormHit: Boolean(self && own.stormHit),
        affectedStudents: own.affectedStudents || [],
        eclipsed: targets,
        echo: { kind: 'none' },
        decision: self ? 'Eclipsed' : `Eclipsed: ${targets.map((g) => _guildName(g)).join(', ')}`,
        description: `${intro} ${lines.join('; ')}.`,
    };
}

async function scalesOfFate(ctx) {
    const { soleLeader, st } = _standingsShape(ctx.classId);
    if (soleLeader !== ctx.guildId) {
        const r = await classGlory(ctx, 3, '', 'scales');
        return { ...r, decision: 'The scales lift you', description: `The scales tip toward the guilds behind: +3 Glory for each guildmate here (+${r.gloryDelta} for the guild).` };
    }
    const last = st[0].gid;
    const taken = await stormGlory(ctx, 3, '', 'scales');
    await giveGlory(ctx, _classMembersOf(last, ctx.classId), 4, 'scales_give');
    return {
        ...taken,
        echo: { kind: 'none' },
        decision: `Leaders humbled, ${_guildName(last)} lifted`,
        description: `This guild leads the class, so the scales tip the other way: ${taken.gloryDelta < 0 ? `the guild gives ${-taken.gloryDelta} Glory` : 'nobody here had Glory to give'}, and each ${_guildName(last)} hero here earns +4 Glory.`,
    };
}

async function dragonsWager(ctx, d = {}) {
    if (d.choice !== 'wake') return { ...(await classGlory(ctx, 1, 'The guild tiptoed away from the sleeping dragon.', 'dragon')), echo: { kind: 'none' }, decision: 'Walked away' };
    if (d.won) return { ...(await classGlory(ctx, 8, 'The dragon roars with joy and shares its hoard!', 'dragon')), echo: { kind: 'none' }, decision: 'Woke the dragon: a friend!' };
    return { ...(await stormGlory(ctx, 4, 'The dragon snorts smoke over the guild!', 'dragon')), echo: { kind: 'none' }, decision: 'Woke the dragon: grumpy!' };
}

/** This month's Glory for one hero: all a loss can ever reach. */
function _monthGlory(studentId) {
    return Math.max(0, Number(wheelIo.monthGlory(studentId)) || 0);
}

/** Average Glory this month per hero of `heroes` (this class's heroes of one guild). */
function _avgMonthGlory(heroes) {
    return heroes.length ? heroes.reduce((sum, s) => sum + _monthGlory(s.id), 0) / heroes.length : 0;
}

/**
 * Takes a different amount from each hero (`plan`: [{ s, n }]), never more than they earned this
 * month. Heroes with nothing to lose show the 🛡️. Returns what was taken, per guild and in total.
 */
async function _takeEach(ctx, plan, tag, source = 'wheel_storm') {
    const byGuild = {};
    let total = 0;
    for (const { s, n } of plan) {
        const ask = _round2(Math.min(n, OMEN_MAX_SWING, _monthGlory(s.id)));
        let took = 0;
        if (ask > 0) {
            const r = await wheelIo.takeGlory([s.id], ask, source, {
                classId: ctx.classId,
                note: "Fortune's Wheel",
                idempotencyPrefix: ctx.spinKey ? `${ctx.spinKey}_${tag}` : null,
            });
            took = _round2(r?.byStudent?.[s.id]);
        }
        if (took > 0) {
            _mark(ctx, s.id, { glory: -took });
            byGuild[s.guildId] = _round2((byGuild[s.guildId] || 0) + took);
            total = _round2(total + took);
        } else {
            _mark(ctx, s.id, { spared: true });
        }
    }
    return { byGuild, total };
}

const _heroWord = (n) => `hero${n === 1 ? '' : 'es'}`;

/**
 * Two guilds trade places: the guild with more Glory per hero here this month gives each of its
 * heroes' difference away (only Glory they have), and each hero of the other guild gains it.
 * The swing is rounded to whole Glory and capped at OMEN_MAX_SWING per hero.
 */
async function _swapGuilds(ctx, gA, gB, tag) {
    const heroesA = _classMembersOf(gA, ctx.classId);
    const heroesB = _classMembersOf(gB, ctx.classId);
    const avgA = _avgMonthGlory(heroesA);
    const avgB = _avgMonthGlory(heroesB);
    const swing = Math.min(OMEN_MAX_SWING, Math.round(Math.abs(avgA - avgB)));
    if (!swing) return { swing: 0, avgA, avgB, net: {} };
    const [rich, richHeroes, poor, poorHeroes] = avgA > avgB ? [gA, heroesA, gB, heroesB] : [gB, heroesB, gA, heroesA];
    const taken = await _takeEach(ctx, richHeroes.map((s) => ({ s, n: swing })), `${tag}_from`, 'wheel_swap');
    await giveGlory(ctx, poorHeroes, swing, `${tag}_to`, 'wheel_swap');
    return {
        swing, avgA, avgB, rich, poor,
        net: { [rich]: -(taken.byGuild[rich] || 0), [poor]: _round2(swing * poorHeroes.length) },
    };
}

const _per = (n) => `${_round2(n)}`;

/** Shadow Thief: Glory moves from the class leader's heroes to this guild (or from this guild, if it leads, to the last). */
async function shadowThief(ctx) {
    const members = ctx.guildStudents || [];
    if (!members.length) return { gloryDelta: 0, echo: { kind: 'none' }, description: 'The thief found no one here to rob.' };
    const { soleLeader, st } = _standingsShape(ctx.classId);
    let victim = soleLeader && soleLeader !== ctx.guildId ? soleLeader : null;
    let winner = ctx.guildId;
    if (soleLeader === ctx.guildId) {
        victim = ctx.guildId;
        winner = st[0].gid;
    } else if (!victim) {
        const others = st.map((x) => x.gid).filter((g) => g !== ctx.guildId);
        victim = others.length ? others[Math.floor(Math.random() * others.length)] : null;
    }
    if (!victim) {
        const r = await classGlory(ctx, 1, '', 'thief');
        return { ...r, echo: { kind: 'none' }, decision: 'Nobody to rob', description: `The thief finds no other guild here to rob and leaves a coin of thanks: +1 Glory for each guildmate here.` };
    }
    const victimHeroes = _classMembersOf(victim, ctx.classId);
    const winnerHeroes = _classMembersOf(winner, ctx.classId);
    const taken = await _takeEach(ctx, victimHeroes.map((s) => ({ s, n: 3 })), 'thief_from', 'wheel_thief');
    if (!taken.total) {
        return { gloryDelta: 0, echo: { kind: 'none' }, decision: 'An empty sack', description: `The thief sneaks into ${_guildName(victim)}'s camp… but nobody there has Glory this month. The sack stays empty!` };
    }
    const each = Math.min(OMEN_MAX_SWING, Math.floor((taken.total / winnerHeroes.length) * 100) / 100);
    await giveGlory(ctx, winnerHeroes, each, 'thief_to', 'wheel_thief');
    const robbedSelf = victim === ctx.guildId;
    return {
        gloryDelta: robbedSelf ? -taken.total : _round2(each * winnerHeroes.length),
        stormHit: robbedSelf,
        echo: { kind: 'none' },
        decision: robbedSelf ? `Robbed for ${_guildName(winner)}` : `Stole from ${_guildName(victim)}`,
        description: robbedSelf
            ? `This guild leads the class, so the thief robs it: ${taken.total} Glory slips away from its heroes here, and each ${_guildName(winner)} hero (last in the class) catches +${_per(each)} Glory.`
            : `The thief sneaks out of ${_guildName(victim)}'s camp with ${taken.total} Glory, and each guildmate here catches +${_per(each)}!`,
    };
}

/** Swap of Fates: this guild trades this month's Glory with a random other guild here. */
async function swapOfFates(ctx) {
    const members = ctx.guildStudents || [];
    const others = GUILD_IDS.filter((g) => g !== ctx.guildId && _classMembersOf(g, ctx.classId).length);
    if (!members.length || !others.length) {
        const r = await classGlory(ctx, 1, '', 'swap');
        return { ...r, echo: { kind: 'none' }, decision: 'No one to swap with', description: `There is no other guild here to swap with, so the fates smile instead: +1 Glory for each guildmate here.` };
    }
    const partner = others[Math.floor(Math.random() * others.length)];
    const r = await _swapGuilds(ctx, ctx.guildId, partner, 'swap');
    const name = _guildName(partner);
    if (!r.swing) {
        return { gloryDelta: 0, echo: { kind: 'none' }, decision: `Swapped with ${name}`, description: `The fates swap this guild and ${name}… but they are already level this month (about ${_per(r.avgA)} Glory per hero), so nothing changes!` };
    }
    const gained = r.poor === ctx.guildId;
    return {
        gloryDelta: r.net[ctx.guildId] || 0,
        stormHit: !gained && (r.net[ctx.guildId] || 0) < 0,
        echo: { kind: 'none' },
        swapped: [ctx.guildId, partner],
        decision: `Swapped with ${name}`,
        description: gained
            ? `The fates swap places with ${name}! This guild had ${_per(r.avgA)} Glory per hero this month, ${name} had ${_per(r.avgB)}: each guildmate here gains +${r.swing}, and each ${name} hero gives up to ${r.swing}.`
            : `The fates swap places with ${name}! This guild had ${_per(r.avgA)} Glory per hero this month, ${name} had ${_per(r.avgB)}: each guildmate here gives up to ${r.swing}, and each ${name} hero gains +${r.swing}.`,
    };
}

/** Topsy-Turvy (and the Envoy's Trick): the top and bottom guilds in this class trade this month's Glory. */
async function topsyTurvy(ctx, tag = 'topsy') {
    const ranked = GUILD_IDS
        .map((g) => ({ g, heroes: _classMembersOf(g, ctx.classId) }))
        .filter((x) => x.heroes.length)
        .map((x) => ({ ...x, avg: _avgMonthGlory(x.heroes) }))
        .sort((a, b) => b.avg - a.avg);
    if (ranked.length < 2 || Math.round(ranked[0].avg - ranked[ranked.length - 1].avg) === 0) {
        return { gloryDelta: 0, echo: { kind: 'none' }, decision: 'All level', description: ranked.length < 2 ? 'Only one guild here, so the world stays the right way up.' : 'The world flips… but the guilds here are level this month, so it lands just as it was!' };
    }
    const top = ranked[0].g;
    const bottom = ranked[ranked.length - 1].g;
    const r = await _swapGuilds(ctx, top, bottom, tag);
    return {
        gloryDelta: r.net[ctx.guildId] || 0,
        stormHit: (r.net[ctx.guildId] || 0) < 0,
        loss: true,
        echo: { kind: 'none' },
        swapped: [top, bottom],
        decision: `${_guildName(top)} ⇄ ${_guildName(bottom)}`,
        description: `The world turns upside down! ${_guildName(top)} (top here, ${_per(r.avgA)} Glory per hero this month) and ${_guildName(bottom)} (bottom, ${_per(r.avgB)}) swap: each ${_guildName(top)} hero gives up to ${r.swing}, and each ${_guildName(bottom)} hero gains +${r.swing}.`,
    };
}

/** The Void: half of each guildmate's Glory this month, at most OMEN_MAX_SWING each. */
async function theVoid(ctx) {
    const members = ctx.guildStudents || [];
    if (!members.length) return { gloryDelta: 0, echo: { kind: 'none' }, description: 'The Void found no one here.' };
    const taken = await _takeEach(ctx, members.map((s) => ({ s, n: _monthGlory(s.id) / 2 })), 'void');
    return {
        gloryDelta: -taken.total,
        stormHit: taken.total > 0,
        affectedStudents: members.map((s) => s.id),
        echo: { kind: 'none' },
        description: taken.total > 0
            ? `The Void opens over the guild hall and swallows half of each guildmate's Glory this month (at most ${OMEN_MAX_SWING} each): the guild loses ${taken.total} Glory.`
            : 'The Void opens… but nobody here has Glory this month for it to swallow!',
    };
}

// ── The Envoy's wheel ─────────────────────────────────────────────────────────

function _envoyNobody() {
    return { gloryDelta: 0, echo: { kind: 'none' }, description: 'The envoy found no guild heroes in this class to visit.' };
}

async function envoyGlory(ctx, perHero) {
    const heroes = ctx.classStudents || [];
    if (!heroes.length) return _envoyNobody();
    const byGuild = await giveGlory(ctx, heroes, perHero, 'envoy_dove', 'wheel_envoy');
    const total = _round2(Object.values(byGuild).reduce((s, n) => s + (Number(n) || 0), 0));
    return { gloryDelta: 0, classGlory: total, affectedStudents: heroes.map((s) => s.id), echo: { kind: 'none' }, description: `A peace dove circles the class: all ${heroes.length} heroes here earn +${perHero} Glory for their own guild.` };
}

async function envoyGold(ctx, count, amount) {
    const heroes = ctx.classStudents || [];
    if (!heroes.length) return _envoyNobody();
    const r = await randomGold({ ...ctx, guildStudents: heroes }, Math.min(count, heroes.length), amount);
    return { ...r, echo: { kind: 'none' }, description: count >= heroes.length ? `Every hero in this class gets +${amount} gold!` : `With greetings from far away: ${r.description}` };
}

/** One random hero from every guild in this class gets the gift (fair across guilds). */
async function envoyPerGuild(ctx, { gold = 0, stars = 0 } = {}) {
    const heroes = ctx.classStudents || [];
    if (!heroes.length) return _envoyNobody();
    const byGuild = new Map();
    heroes.forEach((s) => byGuild.set(s.guildId, [...(byGuild.get(s.guildId) || []), s]));
    const picked = [...byGuild.values()].map((list) => list[Math.floor(Math.random() * list.length)]);
    const r = stars
        ? await randomStars({ ...ctx, guildStudents: picked }, picked.length, stars)
        : await randomGold({ ...ctx, guildStudents: picked }, picked.length, gold);
    const what = stars ? `+${stars} star${stars === 1 ? '' : 's'}` : `+${gold} gold`;
    return { ...r, echo: { kind: 'none' }, description: `The envoy chooses one hero from every guild here: ${picked.map((s) => s.name).join(', ')} each get ${what}.` };
}

async function envoyBanner(ctx) {
    const { lastAlone, st } = _standingsShape(ctx.classId);
    const target = lastAlone || st[0]?.gid;
    if (!target) return _envoyNobody();
    const heroes = _classMembersOf(target, ctx.classId);
    const byGuild = await giveGlory(ctx, heroes, 2, 'envoy_banner', 'wheel_envoy');
    return { gloryDelta: 0, classGlory: _round2(byGuild[target]), echo: { kind: 'none' }, description: `The envoy raises a banner for ${_guildName(target)}${lastAlone ? ', last in this class this month' : ''}: +2 Glory for each of its ${heroes.length} hero${heroes.length === 1 ? '' : 'es'} here!` };
}

// The Envoy's tolls: a guild far away can bring trouble too (only Glory earned this month, gold only from heroes who have some).

async function envoyToll(ctx, perHero) {
    const heroes = ctx.classStudents || [];
    if (!heroes.length) return _envoyNobody();
    const taken = await _takeEach(ctx, heroes.map((s) => ({ s, n: perHero })), 'envoy_toll', 'wheel_envoy');
    const lines = Object.entries(taken.byGuild).map(([gid, n]) => `${_guildName(gid)} −${n}`);
    return {
        gloryDelta: 0, classGlory: -taken.total, loss: taken.total > 0, echo: { kind: 'none' },
        description: taken.total > 0
            ? `The envoy collects a toll at the gate: up to ${perHero} Glory from every hero here (${lines.join(', ')}).`
            : 'The envoy holds out a hand for the toll… but nobody here has Glory this month. It shrugs and rides on!',
    };
}

async function envoySpy(ctx, perHero) {
    const { leaders } = _standingsShape(ctx.classId);
    const targets = leaders.length ? leaders : [];
    if (!targets.length) return _envoyNobody();
    const heroes = targets.flatMap((gid) => _classMembersOf(gid, ctx.classId));
    const taken = await _takeEach(ctx, heroes.map((s) => ({ s, n: perHero })), 'envoy_spy', 'wheel_envoy');
    const names = targets.map((g) => _guildName(g)).join(' and ');
    return {
        gloryDelta: 0, classGlory: -taken.total, loss: taken.total > 0, echo: { kind: 'none' },
        decision: `Spied on ${names}`,
        description: taken.total > 0
            ? `A spy slips into the camp of ${names}, ${targets.length > 1 ? 'tied at the top' : 'the leader'} of this class: up to ${perHero} Glory from each of their ${heroes.length} ${_heroWord(heroes.length)} here (−${taken.total} in all).`
            : `A spy slips into the camp of ${names}… but finds no Glory this month to carry off!`,
    };
}

async function envoyFog(ctx, amount) {
    const heroes = ctx.classStudents || [];
    if (!heroes.length) return _envoyNobody();
    const byGuild = new Map();
    heroes.filter((s) => _goldOf(s.id) > 0).forEach((s) => byGuild.set(s.guildId, [...(byGuild.get(s.guildId) || []), s]));
    const picked = [...byGuild.values()].map((list) => list[Math.floor(Math.random() * list.length)]);
    if (!picked.length) return { gloryDelta: 0, echo: { kind: 'none' }, description: 'A sour fog rolls in… but nobody here has gold to drop!' };
    const r = await loseGold({ ...ctx, guildStudents: picked }, picked.length, amount);
    return { ...r, stormHit: false, loss: true, echo: { kind: 'none' }, description: `A sour fog rolls in from far away: ${picked.map((s) => s.name).join(', ')} each drop up to ${amount} gold.` };
}

// ── Treasure helpers ──────────────────────────────────────────────────────────

async function randomStars(ctx, count, amount) {
    const members = ctx.guildStudents || [];
    if (members.length === 0) return { gloryDelta: 0, description: 'No students were present for this guild.' };

    const outcome = await _studentEffects({
        classId: ctx.classId,
        students: members,
        count,
        starsDelta: amount,
        note: 'Wheel star blessing'
    });

    if (outcome.affectedStudents?.length) {
        let gloryDelta = 0;
        for (const sid of outcome.affectedStudents) {
            const event = await wheelIo.starGlory(sid, amount, 'wheel_star_blessing');
            const g = Number(event?.totalGloryDelta) || 0;
            // Stars carry Glory too, but only the spinning guild's counts toward its tile.
            if (members.find((s) => s.id === sid)?.guildId === ctx.guildId) gloryDelta += g;
            _mark(ctx, sid, { stars: amount, glory: g });
        }
        await wheelIo.bounty(ctx.classId, amount * outcome.affectedStudents.length, outcome.affectedStudents);
        await wheelIo.questCheck(ctx.classId).catch(() => {});
        outcome.gloryDelta = gloryDelta;
    }

    const affected = members.filter(s => outcome.affectedStudents.includes(s.id));
    const names = affected.map(s => s.name).join(', ');

    return {
        gloryDelta: Number(outcome.gloryDelta) || 0,
        ...outcome,
        description: count >= members.length && members.length > 1
            ? `All ${members.length} guildmates here gain ${amount} star${amount === 1 ? '' : 's'}!`
            : `${names} ${affected.length > 1 ? 'each gain' : 'gains'} ${amount} star${amount === 1 ? '' : 's'}.`
    };
}

async function randomGold(ctx, count, amount) {
    const members = ctx.guildStudents || [];
    if (members.length === 0) return { gloryDelta: 0, description: 'No students were present for this guild.' };

    const outcome = await _studentEffects({
        classId: ctx.classId,
        students: members,
        count,
        goldDelta: amount,
        note: 'Wheel gold blessing'
    });
    outcome.affectedStudents.forEach((id) => _mark(ctx, id, { gold: amount }));

    const affected = members.filter(s => outcome.affectedStudents.includes(s.id));
    const names = affected.map(s => s.name).join(', ');

    return {
        gloryDelta: 0,
        ...outcome,
        description: count >= members.length && members.length > 1
            ? `All guildmates here gain ${amount} gold!`
            : `${names} ${affected.length > 1 ? 'each gain' : 'gains'} ${amount} gold.`
    };
}

async function starsAndGold(ctx, count, stars, gold) {
    const s = await randomStars(ctx, count, stars);
    const picked = (ctx.guildStudents || []).filter((st) => (s.affectedStudents || []).includes(st.id));
    const g = picked.length
        ? await _studentEffects({ classId: ctx.classId, students: picked, count: picked.length, goldDelta: gold, note: 'Wheel gold blessing' })
        : { goldDelta: 0, affectedStudents: [] };
    (g.affectedStudents || []).forEach((id) => _mark(ctx, id, { gold }));
    return {
        gloryDelta: s.gloryDelta || 0,
        starsDelta: s.starsDelta || 0,
        goldDelta: g.goldDelta || 0,
        affectedStudents: [...new Set([...(s.affectedStudents || []), ...(g.affectedStudents || [])])],
        description: count >= (ctx.guildStudents || []).length && (ctx.guildStudents || []).length > 1
            ? `Every guildmate here gets +${stars} star${stars === 1 ? '' : 's'} and +${gold} gold!`
            : `${picked.map((st) => st.name).join(', ')} ${picked.length > 1 ? 'each get' : 'gets'} +${stars} star${stars === 1 ? '' : 's'} and +${gold} gold!`,
    };
}

/** Marks each granted artifact on the hero who received it. */
function _markArtifacts(ctx, outcome) {
    (outcome.grantedArtifacts || []).forEach((a, i) => _mark(ctx, a.studentId || outcome.affectedStudents?.[i], { artifact: { icon: a.icon || '🎒', name: a.name || 'Artifact' } }));
}

async function randomArtifact(ctx, count) {
    const members = ctx.guildStudents || [];
    if (members.length === 0) return { gloryDelta: 0, description: 'No students were present for this guild.' };

    const outcome = await _studentEffects({
        classId: ctx.classId,
        students: members,
        count,
        artifactsGrantCount: 1,
        note: 'Wheel artifact blessing'
    });
    _markArtifacts(ctx, outcome);

    const affected = members.filter(s => outcome.affectedStudents.includes(s.id));
    const names = affected.map(s => s.name).join(', ');

    return {
        gloryDelta: 0,
        ...outcome,
        description: count >= members.length && members.length > 1
            ? `All guildmates here receive an artifact!`
            : `${names} ${affected.length > 1 ? 'each receive' : 'receives'} an artifact!`
    };
}

async function teachersFavor(ctx) {
    const members = ctx.guildStudents || [];
    if (members.length === 0) return { gloryDelta: 0, description: 'No students to receive favor.' };
    const outcome = await _studentEffects({
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
        const event = await wheelIo.starGlory(sid, 2, 'wheel_teachers_favor');
        gloryDelta = Number(event?.totalGloryDelta) || 0;
        _mark(ctx, sid, { stars: 2, gold: 30, glory: gloryDelta });
        await wheelIo.bounty(ctx.classId, 2, [sid]);
        await wheelIo.questCheck(ctx.classId).catch(() => {});
    }

    const student = members.find(s => s.id === sid);
    return {
        gloryDelta,
        ...outcome,
        description: student ? `${student.name} receives +2 stars and +30 gold from the Teacher's Favor!` : `A student receives +2 stars and +30 gold from the Teacher's Favor!`
    };
}

async function classQuestBonus(ctx, delta) {
    const outcome = await wheelIo.questBonus(ctx.classId, delta, 'Wheel quest effect');
    if (outcome.classQuestDelta) await wheelIo.questCheck(ctx.classId).catch(() => {});
    return {
        gloryDelta: 0,
        ...outcome,
        description: `The class gains +${outcome.classQuestDelta} Team Quest bonus star${outcome.classQuestDelta === 1 ? '' : 's'} this month!`
    };
}

async function mythicRelic(ctx) {
    const quest = await wheelIo.questBonus(ctx.classId, 30, 'Relic of Triumph');
    const artifacts = await _studentEffects({
        classId: ctx.classId,
        students: ctx.guildStudents || [],
        count: 5,
        artifactsGrantCount: 1,
        note: 'Relic of Triumph artifacts'
    });
    _markArtifacts(ctx, artifacts);

    if (quest.classQuestDelta) await wheelIo.questCheck(ctx.classId).catch(() => {});

    return {
        gloryDelta: 0,
        classQuestDelta: quest.classQuestDelta || 0,
        affectedStudents: artifacts.affectedStudents || [],
        artifactsGranted: artifacts.artifactsGranted || 0,
        grantedArtifacts: artifacts.grantedArtifacts || [],
        artifactsRemoved: 0,
        starsDelta: 0,
        goldDelta: 0,
        description: `The Relic of Triumph surges: +${quest.classQuestDelta || 0} Team Quest bonus stars, plus artifacts for ${artifacts.affectedStudents?.length || 0} heroes!`
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
 * Generate one guild's 20 wedges: treasure, twists, trials and storms (utils/fortuneWheelSegments.mjs).
 * A favored wheel (Fortune's Favor) has no storms, no Trickster and no common treasure;
 * calm skies (a storm hit this guild at its last spin here) leave one storm at most.
 * @param {string} leagueLevel - kept for callers; every league draws from the same catalogue
 * @param {{ favored?: boolean, calm?: boolean }} options
 * @returns {Array} 20 segments
 */
export function generateWheelSegments(leagueLevel, { favored = false, calm = false } = {}) {
    return composeWheel(ALL_SEGMENTS, WHEEL_RARITY_WEIGHTS, { mode: wheelModeFor({ favored, stormLastTime: calm }) })
        .map((seg) => ({ ...seg, effect: SEGMENTS_BY_ID.get(seg.id)?.effect }));
}

/** The Envoy's wheel, for a guild with no heroes in the spinning class (utils/fortuneWheelSegments.mjs). */
export function generateEnvoySegments() {
    return composeEnvoyWheel(ALL_SEGMENTS).map((seg) => ({ ...seg, effect: SEGMENTS_BY_ID.get(seg.id)?.effect }));
}

/** True when a storm (or any loss) hit this guild at its last spin in this class, before this week. */
export function stormHitLastTime(guildId, classId) {
    const week = getISOWeekKey();
    const last = (state.get('fortuneWheelLog') || []).find((entry) => entry.classId === classId && entry.weekKey !== week
        && (entry.results || []).some((r) => r?.guildId === guildId));
    const result = last?.results?.find((r) => r?.guildId === guildId);
    return Boolean(result && (result.stormHit || Number(result.gloryDelta) < 0 || Number(result.goldDelta) < 0));
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
    const alreadySpun = await wheelIo.hasSpun(classId);
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
        await updateDoc(doc(db, `${PUBLIC_DATA_PATH}/student_scores`, holder), { fortuneFavorArmed: false });
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
export async function applyWheelResult(guildId, segment, classId, { favored = false, decision = {}, previous = null, envoy = false, wind = null } = {}) {
    const allStudents = state.get('allStudents') || [];
    const guildStudents = allStudents.filter(s => s.guildId === guildId && s.classId === classId);

    const ctx = {
        guildId,
        classId,
        guildStudents,
        classStudents: _classHeroes(classId),
        memberCount: guildStudents.length || 1,
        previous,
        ledger: new Map(),
        // One spin per guild per class per week, so its Glory is written exactly once.
        spinKey: `wheel_${classId}_${getISOWeekKey()}_${guildId}`,
    };

    const base = {
        guildId,
        segmentId: segment.id,
        segmentLabel: `${segment.emoji} ${segment.label}`,
        segmentDescription: segment.description,
        rarity: segment.rarity,
        favored: Boolean(favored),
        ...(envoy ? { envoy: true } : {}),
    };
    try {
        const effect = wheelTestHooks.effect || segment.effect || SEGMENTS_BY_ID.get(segment.id)?.effect;
        const result = (await effect(ctx, decision || {}, segment)) || {};
        // Comeback wind: a guild behind the Chapter's leader gets a little extra on every spin.
        // It is shown apart from the fate (its own badge per hero and its own tile), never mixed in.
        if (!envoy && wind?.perHero > 0 && guildStudents.length) {
            await wheelIo.awardGlory(guildStudents.map((s) => s.id), wind.perHero, 'wheel_comeback_wind', {
                classId,
                note: "Fortune's Wheel comeback wind",
                idempotencyPrefix: `${ctx.spinKey}_wind`,
            });
            guildStudents.forEach((s) => _mark(ctx, s.id, { wind: wind.perHero }));
            result.wind = { place: wind.place, behind: wind.behind, perHero: wind.perHero, total: _round2(wind.perHero * guildStudents.length) };
        }
        if (favored) await _spendFortuneFavor(guildId, classId);
        // What the Mirror of Fates copies: the wedge itself, unless the effect named its own echo.
        const replayable = !envoy && (!segment.stage || (segment.stage === 'storm' && !result.braved));
        const echo = result.echo || (replayable ? { kind: 'segment', id: segment.id } : { kind: 'none' });
        const ledger = _ledgerRows(ctx.ledger);
        const gloryByGuild = {};
        ledger.forEach((row) => {
            const all = (row.glory || 0) + (row.wind || 0);
            if (all) gloryByGuild[row.guildId] = _round2((gloryByGuild[row.guildId] || 0) + all);
        });
        return { ...base, applied: true, ...result, echo, ledger, gloryByGuild };
    } catch (err) {
        console.error(`Wheel effect failed for ${segment.id}:`, err);
        return { ...base, applied: false, gloryDelta: 0, echo: { kind: 'none' }, description: `Effect could not be applied${err?.message ? `: ${err.message}` : '.'}` };
    }
}

/** The ledger as plain rows (saved with the spin), each with the hero's guild. */
function _ledgerRows(ledger) {
    const students = new Map((state.get('allStudents') || []).map((s) => [s.id, s]));
    return [...(ledger?.values() || [])]
        .filter((row) => students.has(row.id))
        .map((row) => ({ ...row, guildId: students.get(row.id).guildId || null, name: students.get(row.id).name || 'Hero' }));
}

/** Lets the guidebook capture and the browser checks run the ceremony without Firestore. */
export const wheelTestHooks = { effect: null, lite: null, segments: null, pick: null, order: null };

// ═══════════════════════════════════════════════════════════════════════════════
// CANVAS WHEEL RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

const TAU = Math.PI * 2;

const _ordinal = (n) => `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n] || 'th'}`;

/** The comeback wind's sign beside the wheel, before the spin. */
function _windNoteHtml() {
    const wind = _wheelState.wind;
    if (_wheelState.envoy || !(wind?.perHero > 0)) return '';
    return `<div class="fw-wheel-legend__wind"><span aria-hidden="true">🌬️</span> <span><b>Comeback wind</b> · ${_ordinal(wind.place)} this month, so whatever the wheel brings, every guildmate here also gets <b>+${wind.perHero} Glory</b>.</span></div>`;
}

/** How a wedge is painted: an Envoy's toll wears the storm's colours, so the class sees the risk. */
function _wedgeLook(seg) {
    return seg?.rarity === 'envoy' && seg.harsh ? 'storm' : seg?.rarity;
}

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

/** Patterns for the three families, drawn inside a wedge (already clipped to it). */
const FAMILY_PATTERNS = {
    // Storm: slanting rain streaks and a jagged bolt along the wedge.
    storm(ctx, radius, start, end, size, conf) {
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.16)';
        ctx.lineWidth = Math.max(1, size * 0.003);
        const step = Math.max(6, size * 0.022);
        for (let k = -radius; k < radius; k += step) {
            ctx.beginPath();
            ctx.moveTo(k, -radius);
            ctx.lineTo(k + radius * 0.35, radius);
            ctx.stroke();
        }
        const mid = (start + end) / 2;
        const r0 = radius * 0.34;
        const r1 = radius * 0.62;
        const w = (end - start) * 0.18;
        ctx.beginPath();
        ctx.moveTo(Math.cos(mid - w) * r0, Math.sin(mid - w) * r0);
        ctx.lineTo(Math.cos(mid + w) * (r0 + (r1 - r0) * 0.45), Math.sin(mid + w) * (r0 + (r1 - r0) * 0.45));
        ctx.lineTo(Math.cos(mid - w * 0.4) * (r0 + (r1 - r0) * 0.55), Math.sin(mid - w * 0.4) * (r0 + (r1 - r0) * 0.55));
        ctx.lineTo(Math.cos(mid + w) * r1, Math.sin(mid + w) * r1);
        ctx.strokeStyle = conf.color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = Math.max(1.5, size * 0.006);
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.globalAlpha = 1;
    },
    // Twist: harlequin diamonds.
    twist(ctx, radius, start, end, size) {
        const d = Math.max(10, size * 0.045);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
        for (let y = -radius; y < radius; y += d) {
            for (let x = -radius; x < radius; x += d) {
                const odd = Math.round((x + y) / d) % 2 === 0;
                if (!odd) continue;
                ctx.beginPath();
                ctx.moveTo(x, y - d / 2);
                ctx.lineTo(x + d / 2, y);
                ctx.lineTo(x, y + d / 2);
                ctx.lineTo(x - d / 2, y);
                ctx.closePath();
                ctx.fill();
            }
        }
    },
    // Omen: a scatter of stars and a comet's tail, with an ember glow at the rim.
    omen(ctx, radius, start, end, size, conf) {
        const mid = (start + end) / 2;
        const glow = ctx.createRadialGradient(Math.cos(mid) * radius * 0.82, Math.sin(mid) * radius * 0.82, 0, Math.cos(mid) * radius * 0.82, Math.sin(mid) * radius * 0.82, radius * 0.5);
        glow.addColorStop(0, 'rgba(255, 179, 71, 0.45)');
        glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
        let seed = 7;
        const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        for (let k = 0; k < 22; k += 1) {
            const a = start + (end - start) * rnd();
            const r = radius * (0.3 + rnd() * 0.66);
            ctx.beginPath();
            ctx.arc(Math.cos(a) * r, Math.sin(a) * r, Math.max(0.8, size * (0.0015 + rnd() * 0.0025)), 0, TAU);
            ctx.fillStyle = `rgba(255, 244, 214, ${(0.35 + rnd() * 0.5).toFixed(2)})`;
            ctx.fill();
        }
        const tail = ctx.createLinearGradient(Math.cos(mid) * radius * 0.35, Math.sin(mid) * radius * 0.35, Math.cos(mid) * radius * 0.7, Math.sin(mid) * radius * 0.7);
        tail.addColorStop(0, 'rgba(255, 179, 71, 0)');
        tail.addColorStop(1, conf.color);
        ctx.strokeStyle = tail;
        ctx.lineWidth = Math.max(1.5, size * 0.006);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(Math.cos(mid - 0.04) * radius * 0.35, Math.sin(mid - 0.04) * radius * 0.35);
        ctx.lineTo(Math.cos(mid) * radius * 0.7, Math.sin(mid) * radius * 0.7);
        ctx.stroke();
    },
    // Envoy: a letter's ruled lines and a wax seal near the hub.
    envoy(ctx, radius, start, end, size, conf) {
        ctx.strokeStyle = 'rgba(255, 248, 230, 0.1)';
        ctx.lineWidth = Math.max(1, size * 0.003);
        ctx.setLineDash([size * 0.012, size * 0.01]);
        for (let r = radius * 0.34; r < radius * 0.92; r += Math.max(7, size * 0.026)) {
            ctx.beginPath();
            ctx.arc(0, 0, r, start + 0.02, end - 0.02);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        const mid = (start + end) / 2;
        ctx.beginPath();
        ctx.arc(Math.cos(mid) * radius * 0.38, Math.sin(mid) * radius * 0.38, Math.max(3, size * 0.011), 0, TAU);
        ctx.fillStyle = conf.color;
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
    },
    // Trial: rings like a Sphinx's seal.
    trial(ctx, radius, start, end, size) {
        ctx.strokeStyle = 'rgba(204, 251, 241, 0.13)';
        ctx.lineWidth = Math.max(1, size * 0.004);
        const step = Math.max(6, size * 0.03);
        for (let r = radius * 0.3; r < radius; r += step) {
            ctx.beginPath();
            ctx.arc(0, 0, r, start, end);
            ctx.stroke();
        }
    },
};

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
        const look = _wedgeLook(seg);
        const rarityConf = getRarityPalette(look, seg.paletteIndex);
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

        // Storms, twists and trials carry a pattern too, so a family reads at a glance.
        if (FAMILY_PATTERNS[look]) {
            ctx.save();
            _wedgePath(ctx, radius, startAngle, endAngle);
            ctx.clip();
            FAMILY_PATTERNS[look](ctx, radius, startAngle, endAngle, size, rarityConf);
            ctx.restore();
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
        const rarityConf = getRarityPalette(_wedgeLook(seg), seg?.paletteIndex);
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

/** Weak laptops (and reduced motion) get the same moments with far fewer particles. */
function _isLite() {
    if (wheelTestHooks.lite !== null && wheelTestHooks.lite !== undefined) return Boolean(wheelTestHooks.lite);
    try {
        return detectLowPowerTier() || Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch (_) {
        return false;
    }
}

/** The centre of the wheel, in the card's effect layer coordinates. */
function _fxOrigin() {
    const layer = document.getElementById('fw-fx');
    const frame = document.getElementById('fw-stage-frame');
    if (!layer || !frame) return null;
    const l = layer.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    return { layer, x: f.left - l.left + f.width / 2, y: f.top - l.top + f.height / 2, size: f.width };
}

const TREASURE_FX = {
    common:    { count: 10, spread: 0.32, emojis: ['✨', '⭐'], emojiCount: 4, colors: ['#fbbf24', '#fcd34d', '#fef3c7'] },
    uncommon:  { count: 14, spread: 0.36, emojis: ['✨', '⭐', '🍀'], emojiCount: 6, colors: ['#22c55e', '#86efac', '#fbbf24'] },
    rare:      { count: 20, spread: 0.42, emojis: ['✨', '💫', '⭐'], emojiCount: 8, colors: ['#a855f7', '#c084fc', '#e9d5ff'], flash: 'rgba(168, 85, 247, 0.28)' },
    epic:      { count: 28, spread: 0.5, emojis: ['🌟', '✨', '💫', '🎁'], emojiCount: 12, colors: ['#f97316', '#fb7185', '#fbbf24'], flash: 'rgba(249, 115, 22, 0.3)' },
    legendary: { count: 36, spread: 0.6, emojis: ['👑', '⭐', '✨', '🏆', '⚜️'], emojiCount: 18, colors: ['#fbbf24', '#f59e0b', '#fde68a', '#fff7d6'], flash: 'rgba(251, 191, 36, 0.4)' },
    mythic:    { count: 44, spread: 0.7, emojis: ['💎', '👑', '✨', '🌟', '🏆'], emojiCount: 24, colors: ['#22d3ee', '#a78bfa', '#f472b6', '#fbbf24', '#34d399'], flash: 'rgba(167, 139, 250, 0.42)' },
};

/** Particles and a flash for a treasure, sized by rarity (a third of them on weak laptops). */
function triggerWheelRevealEffects(rarity) {
    const conf = TREASURE_FX[rarity];
    const o = _fxOrigin();
    if (!conf || !o) return;
    const lite = _isLite();
    if (conf.flash) fxFlash(o.layer, conf.flash);
    fxBurst(o.layer, { x: o.x, y: o.y, colors: conf.colors, count: conf.count, emojis: conf.emojis, emojiCount: conf.emojiCount, spread: o.size * conf.spread, lite });
}

/** Turns the wheel canvas with a CSS transform (composited: no repaint while it spins). */
function _setCanvasRotation(canvas, angle) {
    if (canvas) canvas.style.transform = `rotate(${angle}rad)`;
}

/**
 * Animate the wheel spin. The wheel face is painted once; the spin only rotates the canvas
 * (a GPU transform), so it stays smooth on weak classroom laptops.
 * About one spin in three ends with a near miss: the wheel creeps into the next wedge
 * and rolls back.
 * @param {HTMLCanvasElement} canvas
 * @param {Array} segments
 * @param {number} winnerIndex
 * @param {object} guildDef
 * @param {Function} onTick - Called on each segment pass (for tick sound)
 * @param {{ startAngle?: number, quick?: boolean }} options - quick: the Whirlwind's shorter second spin
 * @returns {Promise<{ rotationAngle: number }>} resolves when animation completes
 */
export function animateWheelSpin(canvas, segments, winnerIndex, guildDef, onTick, { startAngle = 0, quick = false, power = null } = {}) {
    return new Promise((resolve) => {
        const segCount = segments.length;
        const segAngle = TAU / segCount;

        drawWheel(canvas, segments, 0, guildDef);
        canvas.style.willChange = 'transform';

        // Target angle: winner segment should be at the TOP (12 o'clock = -π/2)
        const winnerCenterAngle = winnerIndex * segAngle + segAngle / 2;
        const base = ((startAngle % TAU) + TAU) % TAU;
        const targetAngle = -winnerCenterAngle - Math.PI / 2;
        const normalizedTarget = ((targetAngle - base) % TAU + TAU) % TAU;
        // Quest Remote slingshot: a harder pull (power 0..1) spins more turns for longer; the winner is already chosen.
        const pulled = !quick && Number.isFinite(power) ? Math.min(1, Math.max(0, power)) : null;
        const turns = quick ? 4 + Math.floor(Math.random() * 2)
            : pulled !== null ? 6 + Math.round(pulled * 7) : 8 + Math.floor(Math.random() * 4);
        const travel = turns * TAU + normalizedTarget;

        const nearMiss = !quick && Math.random() < 0.34;
        const overshoot = nearMiss ? segAngle * (0.6 + Math.random() * 0.15) : 0;
        const duration = (quick ? 3800 : pulled !== null ? 5200 + pulled * 3200 : 6500 + Math.random() * 1500) + (nearMiss ? 900 : 0);
        const windUp = quick ? 0 : 0.07;
        const rollback = nearMiss ? 0.13 : 0;
        const startTime = performance.now();
        let lastSegIndex = null;

        const angleAt = (t) => {
            if (t < windUp) return -segAngle * 0.7 * Math.sin((t / windUp) * Math.PI);
            const mainEnd = 1 - rollback;
            if (t < mainEnd || rollback === 0) {
                const pt = Math.min(1, (t - windUp) / (mainEnd - windUp));
                return (travel + overshoot) * (1 - Math.pow(1 - pt, 5));
            }
            const rt = (t - mainEnd) / rollback;
            return travel + overshoot * (1 - (0.5 - 0.5 * Math.cos(Math.PI * rt)));
        };

        function frame(now) {
            const t = Math.min(1, (now - startTime) / duration);
            const angle = base + angleAt(t);
            _setCanvasRotation(canvas, angle);

            // A tick each time a peg passes the pointer (both ways, so the roll-back clicks too).
            const pointerAt = ((((-Math.PI / 2 - angle) % TAU) + TAU) % TAU);
            const segIndex = Math.floor(pointerAt / segAngle) % segCount;
            if (lastSegIndex !== null && segIndex !== lastSegIndex && onTick && t < 0.999) onTick(segIndex);
            lastSegIndex = segIndex;

            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                const finalAngle = base + travel;
                _setCanvasRotation(canvas, finalAngle);
                canvas.style.willChange = '';
                // The winner's spotlight is painted in wheel space; the canvas keeps its rotation.
                drawWheel(canvas, segments, 0, guildDef, winnerIndex);
                // Resolve on the landing frame itself: the fate follows the stop with no gap.
                resolve({ rotationAngle: finalAngle });
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
    modal.classList.toggle('fw--lite', _isLite());
    // Clear the last ceremony's leftovers before the card animates in. The idle
    // phase hides the roster panel until the availability check settles.
    _setCardPhase('idle');
    _hideResultReveal();
    document.getElementById('fw-summary')?.classList.add('hidden');
    showAnimatedModal('fortunes-wheel-modal');
    // Wake the audio once the card has landed, so the first spin starts without a stall.
    setTimeout(() => { ensureAudioReady().then(() => warmWheelAudio()).catch(() => {}); }, 700);

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
    if (['spinning', 'staging', 'applying'].includes(_wheelState.phase)) return;
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
        if (!['ready', 'revealed', 'staging'].includes(_wheelState.phase)) return;
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
        alreadySpun = classId ? await wheelIo.hasSpun(classId) : false;
    } catch (err) {
        console.warn('Wheel availability check failed:', err);
    }

    const availability = wheelIo.availability || evaluateWheelAvailability(classId, {
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
        guildOrder: wheelTestHooks.order ? [...wheelTestHooks.order] : shuffleArray([...GUILD_IDS]),
        currentGuildIndex: 0,
        segments: [],
        results: [],
        phase: 'ready',
        winnerIndex: null,
        rotationAngle: 0,
    };

    _loadForgeRiddles(classId, leagueLevel);

    // Generate first guild's segments
    invalidateWheelCache();
    _prepareGuildWheel();
    _renderWheelPhase();
}

/**
 * Trial questions from the Grammar Forge for the grammar this class has met in its books
 * (loaded in the background; until then, and for classes with no book plan, the general bank).
 */
async function _loadForgeRiddles(classId, leagueLevel) {
    try {
        const [{ getClassBookPlan }, { BOOK_ATLAS }, forge] = await Promise.all([
            import('./bookProgress.js'), import('./bookAtlas.data.mjs'), import('./grammarForge/index.mjs')]);
        const band = challengeBand(leagueLevel);
        const { recent, covered } = forge.classGrammarLines(getClassBookPlan(classId), BOOK_ATLAS);
        // the newest units' grammar twice over, so it comes up most
        const riddles = band === 'e' ? forge.forgeRiddles([], 'e')
            : [...forge.forgeRiddles(recent, band), ...forge.forgeRiddles(recent, band), ...forge.forgeRiddles(covered, band)];
        if (_wheelState.classId === classId) _wheelState.forgeRiddles = riddles;
    } catch (err) {
        console.warn('Wheel: grammar questions', err);
    }
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
        stageFrame.classList.remove('is-spinning', 'is-envoy', 'has-omen');
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
    if (!students.length) {
        const heroes = _classHeroes(_wheelState.classId).length;
        panel.innerHTML = `
            <div class="fw-guild-members__header">${guildDef?.name || 'This guild'}'s Envoy<span class="fw-guild-members__count">0</span></div>
            <div class="fw-envoy-note">
                <span class="fw-envoy-note__seal" aria-hidden="true">📜</span>
                <p><b>No ${guildDef?.name || 'guild'} heroes in this class.</b> Their Envoy rides in with a wheel for ${heroes ? `all ${heroes} heroes here, whatever their guild` : 'the class'}: mostly gifts, a few tolls, and sometimes one rare trick.</p>
            </div>`;
        return;
    }
    panel.innerHTML = `
        <div class="fw-guild-members__header">${guildDef?.name || 'Active Guild'} Members<span class="fw-guild-members__count">${students.length}</span></div>
        <div class="fw-guild-members__list">${rosterHtml}</div>`;
}

/** Plays the moment a wedge is landed on: storm clouds, a twist's shimmer, a trial's ring, or treasure. */
async function _landingMoment(seg) {
    const frame = document.getElementById('fw-stage-frame');
    const lite = _isLite();
    try {
        if (seg.rarity === 'storm') {
            playWheelSfx('thunder');
            await fxStorm(frame, { lite });
            return;
        }
        if (seg.rarity === 'twist') {
            playSound('magic_chime');
            fxTwist(frame);
            // A staged twist lets its shimmer breathe; a plain one shows its fate at once.
            if (seg.stage) await new Promise((r) => setTimeout(r, 600));
            return;
        }
        if (seg.rarity === 'trial') {
            playSound('quiz_open');
            fxTrial(frame);
            if (seg.stage) await new Promise((r) => setTimeout(r, 600));
            return;
        }
        if (seg.rarity === 'omen') {
            // The rarest moment on the wheel: the sky darkens, the Omen's sign descends.
            const dark = Boolean(seg.harsh);
            _setStageCaption(dark ? 'The sky goes dark… an Omen!' : 'The sky turns to gold… an Omen!');
            try { playDrumRoll(); } catch (_) { /* optional */ }
            await fxOmen(frame, { emoji: seg.emoji, label: seg.label, dark, lite });
            try { stopDrumRoll(); } catch (_) { /* optional */ }
            if (dark) playWheelSfx('thunder');
            else playHeroFanfare();
            return;
        }
        if (seg.rarity === 'envoy' && seg.harsh) {
            playWheelSfx('thunder');
            await fxStorm(frame, { lite });
            return;
        }
        if (seg.rarity === 'envoy') {
            playSound('magic_chime');
            const o = _fxOrigin();
            if (o) fxBurst(o.layer, { x: o.x, y: o.y, colors: ['#bfdbfe', '#c4b5fd', '#fef3c7'], count: 14, emojis: ['🕊️', '📜', '✨'], emojiCount: 6, spread: o.size * 0.4, lite });
            return;
        }
        if (seg.rarity === 'mythic' || seg.rarity === 'legendary') playHeroFanfare();
        else if (seg.rarity === 'epic') playSound('familiar_levelup');
        else if (seg.rarity === 'rare') playSound('magic_chime');
        else playSound('star1');
    } catch (_) { /* sound is optional */ }
}

// Bumped whenever the ceremony closes, so a spin still playing out knows it is stale.
let _ceremonySeq = 0;

/** The teacher closed the wheel while it spun: close now (earlier guilds' fates are saved). */
function _closeAfterSpin() {
    _wheelState._aborting = false;
    _wheelState.phase = 'closing';
    return closeFortunesWheel();
}

/** Spins the wheel to `winnerIndex` (from wherever it rests) with ticks and pointer flicks. */
async function _spinTo(winnerIndex, { quick = false, power = null } = {}) {
    const canvas = document.getElementById('fortunes-wheel-canvas');
    const guildDef = getGuildById(_wheelState.guildOrder[_wheelState.currentGuildIndex]);
    const stageFrame = document.getElementById('fw-stage-frame');
    stageFrame?.classList.add('is-spinning');
    const anim = await animateWheelSpin(canvas, _wheelState.segments, winnerIndex, guildDef, () => {
        try { playSound('click'); } catch (_) { /* optional */ }
        _flickPointer();
    }, { startAngle: _wheelState.rotationAngle || 0, quick, power });
    stageFrame?.classList.remove('is-spinning');
    _wheelState.winnerIndex = winnerIndex;
    _wheelState.rotationAngle = anim?.rotationAngle || 0;
}

/** Opens the reveal layer as an empty, family-themed card for an interactive moment. */
function _openStageCard(seg) {
    const conf = getRarityPalette(seg.rarity, seg.paletteIndex);
    _showResultReveal({ cardHtml: '', rarity: seg.rarity, rarityColor: conf.color, rarityGlow: conf.glow, rarityBg: conf.bg });
    return document.getElementById('fw-reveal-card');
}

/** Everything a stage needs about the guild at the wheel and the class. */
function _stageOptions(seg, cardEl) {
    const guildId = _wheelState.guildOrder[_wheelState.currentGuildIndex];
    const guildDef = getGuildById(guildId);
    const classId = _wheelState.classId;
    const students = (state.get('allStudents') || [])
        .filter((s) => s.classId === classId && s.guildId === guildId)
        .map((s) => ({ id: s.id, name: s.name || 'Hero', avatar: s.avatar || null }));
    const otherGuilds = GUILD_IDS.filter((gid) => gid !== guildId)
        .map((gid) => ({ id: gid, def: getGuildById(gid), count: _classMembersOf(gid, classId).length }))
        .filter((g) => g.count > 0)
        .map((g) => ({ id: g.id, name: g.def?.name || g.id, primary: g.def?.primary, emblemUrl: getGuildEmblemUrl(g.id), count: g.count }));
    return {
        cardEl,
        segment: seg,
        guild: { id: guildId, name: guildDef?.name || guildId, primary: guildDef?.primary, emblemUrl: getGuildEmblemUrl(guildId) },
        band: challengeBand(_wheelState.leagueLevel),
        extra: _wheelState.forgeRiddles || [],
        students,
        otherGuilds,
        favored: Boolean(_wheelState.favored),
        lite: _isLite(),
        sfx: (name) => playWheelSfx(name),
        sound: (name) => playSound(name),
        drum: { start: () => playDrumRoll(), stop: () => stopDrumRoll() },
    };
}

/**
 * Called when teacher clicks "Spin!" for the current guild.
 * `power` (0..1, optional) comes from the Quest Remote slingshot.
 */
export async function triggerSpin({ power = null } = {}) {
    if (_wheelState.phase !== 'ready') return;
    _wheelState.phase = 'spinning';
    _wheelState.winnerIndex = null;
    const seq = _ceremonySeq;
    const stale = () => seq !== _ceremonySeq;

    try {
        await ensureAudioReady();
    } catch (_) {}

    const guildId = _wheelState.guildOrder[_wheelState.currentGuildIndex];
    const guildDef = getGuildById(guildId);
    const guildName = guildDef?.name || 'The guild';
    const segments = _wheelState.segments;
    document.getElementById('fw-canvas-wrap')?.classList.remove('is-idle');
    _setCardPhase('spinning');
    _setStageCaption('The wheel whirls… every eye on the pointer.');
    _updateSpinButton(true, 'Spinning...');

    await _spinTo(wheelTestHooks.pick ? wheelTestHooks.pick(segments) : spinWheel(segments.length), { power });
    if (stale()) return;
    if (_wheelState._aborting) return _closeAfterSpin();

    let winningSeg = segments[_wheelState.winnerIndex];
    await _landingMoment(winningSeg);
    if (stale()) return;
    if (_wheelState._aborting) return _closeAfterSpin();

    // The Whirlwind spins the wheel again (it can't land on itself twice).
    let whirlwind = null;
    if (winningSeg.stage === 'whirlwind') {
        whirlwind = winningSeg;
        _wheelState.phase = 'staging';
        _setCardPhase('staging');
        await runStage('whirlwind', _stageOptions(winningSeg, _openStageCard(winningSeg)));
        if (stale()) return;
        _hideResultReveal();
        _setCardPhase('spinning');
        _setStageCaption('The Whirlwind spins the wheel again!');
        fxSwirl(document.getElementById('fw-stage-frame'));
        drawWheel(document.getElementById('fortunes-wheel-canvas'), segments, 0, guildDef);
        const choices = segments.map((seg, i) => i).filter((i) => segments[i].id !== 'whirlwind');
        _wheelState.phase = 'spinning';
        await _spinTo(choices[spinWheel(choices.length)], { quick: true });
        if (stale()) return;
        if (_wheelState._aborting) return _closeAfterSpin();
        winningSeg = segments[_wheelState.winnerIndex];
        await _landingMoment(winningSeg);
        if (stale()) return;
        if (_wheelState._aborting) return _closeAfterSpin();
    }

    let decision = {};
    if (winningSeg.stage && winningSeg.stage !== 'whirlwind') {
        _wheelState.phase = 'staging';
        _setCardPhase('staging');
        _setStageCaption(winningSeg.rarity === 'storm'
            ? `A storm gathers over ${guildName}!`
            : winningSeg.rarity === 'omen'
                ? `An Omen! ${guildName} faces ${winningSeg.label}.`
                : `${guildName} faces ${winningSeg.label}.`);
        decision = await runStage(winningSeg.stage, _stageOptions(winningSeg, _openStageCard(winningSeg)));
        if (stale()) return;
    }

    // The Mirror copies the last guild that spun its own wheel (an Envoy's gifts can't be copied).
    const previous = [..._wheelState.results].reverse().find((r) => !r.envoy) || null;
    // Closing while the fate is being written waits for it, so it lands in the log too.
    _wheelState.phase = 'applying';
    // The card turns over the moment the wheel (or the stage) settles; the numbers
    // follow onto the same card as soon as the fate has been written.
    _renderWheelPending(winningSeg, guildDef, { whirlwind: Boolean(whirlwind), braved: Boolean(decision?.braved) });
    const result = await applyWheelResult(guildId, winningSeg, _wheelState.classId, { favored: Boolean(_wheelState.favored), decision, previous, envoy: Boolean(_wheelState.envoy), wind: _wheelState.wind });
    if (whirlwind) {
        result.segmentLabel = `${whirlwind.emoji} ${whirlwind.label} → ${result.segmentLabel}`;
        result.whirlwind = true;
    }
    _wheelState.results.push(result);
    if (_wheelState._aborting) return _closeAfterSpin();
    _wheelState.phase = 'revealed';

    // The guild_scores listener already carries these writes (Firestore applies local
    // writes at once); adding the result to state again here counted it twice.
    try {
        const guildsTab = document.getElementById('guilds-tab');
        if (guildsTab && !guildsTab.classList.contains('hidden')) {
            import('../ui/tabs/guilds.js').then(m => m.requestGuildHallRender());
        }
    } catch (_) { }

    _renderWheelResult(winningSeg, result, guildDef);
}

function _prepareGuildWheel() {
    const guildId = _wheelState.guildOrder[_wheelState.currentGuildIndex];
    // No heroes of this guild in the class: its Envoy spins a wheel for everyone.
    _wheelState.envoy = _classMembersOf(guildId, _wheelState.classId).length === 0;
    _wheelState.favored = !_wheelState.envoy && isGuildWheelFavored(guildId, _wheelState.classId);
    _wheelState.calm = !_wheelState.envoy && !_wheelState.favored && stormHitLastTime(guildId, _wheelState.classId);
    try {
        _wheelState.wind = _wheelState.envoy ? null : wheelIo.wind(guildId);
    } catch (_) {
        _wheelState.wind = null;
    }
    _wheelState.segments = _wheelState.envoy
        ? generateEnvoySegments()
        : generateWheelSegments(_wheelState.leagueLevel, { favored: _wheelState.favored, calm: _wheelState.calm });
    if (wheelTestHooks.segments) _wheelState.segments = wheelTestHooks.segments(_wheelState.segments, { envoy: _wheelState.envoy, catalog: ALL_SEGMENTS });
    _wheelState.rotationAngle = 0;
}

/**
 * Advance to next guild or show summary.
 */
export function advanceWheel() {
    if (_wheelState.currentGuildIndex < _wheelState.guildOrder.length - 1) {
        _wheelState.currentGuildIndex++;
        cancelStage();
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
    if (_wheelState.phase === 'spinning' || _wheelState.phase === 'applying') {
        _wheelState._aborting = true;
        return;
    }
    // Closing in the middle of a chest, a coin or a trial: that guild's fate is left unapplied.
    if (_wheelState.phase === 'staging') _wheelState.phase = 'closing';
    cancelStage();
    _ceremonySeq += 1;
    if (_wheelState.classId && _wheelState.results.length > 0) {
        try {
            // Firestore refuses undefined fields; the JSON round trip drops them.
            await wheelIo.save(_wheelState.classId, JSON.parse(JSON.stringify(_wheelState.results)));
        } catch (err) {
            console.error('Failed to save wheel results:', err);
        }
    }

    _wheelState = { active: false, classId: null, leagueLevel: null, guildOrder: [], currentGuildIndex: 0, segments: [], results: [], phase: 'idle', winnerIndex: null, rotationAngle: 0, _aborting: false };

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
    const order = ['omen', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'twist', 'trial', 'storm', 'envoy', 'toll'];
    const counts = new Map();
    const keyOf = (seg) => (seg.rarity === 'envoy' && seg.harsh ? 'toll' : seg.rarity);
    for (const seg of segments) counts.set(keyOf(seg), (counts.get(keyOf(seg)) || 0) + 1);
    const chips = order
        .filter(rarity => counts.get(rarity))
        .map(rarity => {
            const conf = rarity === 'toll' ? { ...getRarityPalette('storm', 0), label: 'Toll' } : getRarityPalette(rarity, 0);
            return `<span class="fw-wheel-legend__chip" data-rarity="${rarity === 'toll' ? 'storm' : rarity}" style="--chip-color:${conf.color};--chip-bg:${conf.bg};">
                <span class="fw-wheel-legend__gem"></span>${conf.label}<b>×${counts.get(rarity)}</b>
            </span>`;
        }).join('');
    legendEl.innerHTML = `
        <div class="fw-wheel-legend__header">${_wheelState.envoy ? 'The Envoy brings' : 'On this wheel'}</div>
        <div class="fw-wheel-legend__chips">${chips}</div>
        ${counts.get('omen') ? '<div class="fw-wheel-legend__omen"><span aria-hidden="true">✦</span> An Omen hides on this wheel. Its fate is huge, for better or worse!</div>' : ''}
        ${_windNoteHtml()}`;
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
                    <div class="fw-guild-banner__eyebrow">Guild ${guildNum} of ${_wheelState.guildOrder.length}${_wheelState.envoy ? ' · Envoy' : ''}</div>
                    <div class="fw-guild-banner__name">${guildDef?.name || guildId}</div>
                </div>
                ${guildDef?.emoji ? `<div class="fw-guild-banner__flag" aria-hidden="true">${guildDef.emoji}</div>` : ''}
            </div>`;
    }

    _renderGuildProgress();
    _renderCurrentGuildMembers();
    _renderWheelLegend();
    _setStageEmblem(guildId);
    const guildName = guildDef?.name || 'This guild';
    const omen = (_wheelState.segments || []).some((seg) => seg.rarity === 'omen');
    _setStageCaption((_wheelState.envoy
        ? `No ${guildName} heroes in this class, so their Envoy spins for the whole class: gifts… or a toll!`
        : _wheelState.favored
            ? `${guildName} steps up to a gilded wheel: Fortune's Favor cleared the storms and the Trickster.${omen ? ' An Omen glows on it!' : ''}`
            : _wheelState.calm
                ? `${guildName} steps up to calmer skies: only one storm this time.${omen ? ' And an Omen glows!' : ' Spin!'}`
                : omen
                    ? `${guildName} steps up to the wheel… and an Omen glows on it tonight!`
                    : `${guildName} steps up to the wheel. Treasure, twists, trials… or a storm?`)
        + (!_wheelState.envoy && _wheelState.wind?.perHero > 0 ? ` A comeback wind blows at their back: +${_wheelState.wind.perHero} Glory each.` : ''));
    _setCardPhase('ready');

    const stageFrame = document.getElementById('fw-stage-frame');
    if (stageFrame) {
        stageFrame.classList.remove('is-locked');
        stageFrame.classList.remove('is-spinning');
        delete stageFrame.dataset.lock;
        stageFrame.style.setProperty('--guild-primary', guildDef?.primary || '#e8c46a');
        stageFrame.style.setProperty('--guild-glow', guildDef?.glow || guildDef?.primary || '#fbbf24');
        stageFrame.classList.toggle('is-envoy', Boolean(_wheelState.envoy));
        stageFrame.classList.toggle('has-omen', omen);
    }

    // The ledger must be gone before the wheel measures its stage.
    document.getElementById('fw-summary')?.classList.add('hidden');
    const canvasWrap = document.getElementById('fw-canvas-wrap');
    if (canvasWrap) {
        canvasWrap.classList.remove('hidden');
        canvasWrap.classList.add('is-idle');
    }
    _sizeAndRenderWheel();

    _updateSpinButton(false, _wheelState.envoy ? 'Spin for the Envoy' : 'Spin This Guild', _wheelState.envoy ? 'Gifts or tolls for the whole class' : 'The relic chooses a fate');
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
    // The face is painted unturned; the canvas itself carries the rotation (see animateWheelSpin).
    const landed = _wheelState.phase === 'revealed' || _wheelState.phase === 'staging';
    _setCanvasRotation(canvas, _wheelState.rotationAngle || 0);
    drawWheel(canvas, _wheelState.segments, 0, guildDef, landed ? _wheelState.winnerIndex : null);
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
        shell.classList.remove('is-prismatic', 'is-wide');
        shell.style.removeProperty('--shell-rarity-color');
        shell.style.removeProperty('--shell-rarity-glow');
        shell.style.removeProperty('--shell-rarity-bg');
    }
}

function _showResultReveal({ cardHtml, rarity = 'common', rarityColor = null, rarityGlow = null, rarityBg = null, isPrismatic = false, primaryAction = null, secondaryAction = null, wide = null }) {
    const revealLayer = document.getElementById('fw-reveal-layer');
    const revealCard = document.getElementById('fw-reveal-card');
    const primaryBtn = document.getElementById('fw-reveal-primary-btn');
    const secondaryBtn = document.getElementById('fw-reveal-secondary-btn');
    if (!revealLayer || !revealCard || !primaryBtn || !secondaryBtn) return;

    // null keeps the card already on show (the pending fate card being filled in).
    if (cardHtml !== null) revealCard.innerHTML = cardHtml;

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
        // Room for every hero's chip when a fate touches many of them (null keeps the width).
        if (wide !== null) shell.classList.toggle('is-wide', Boolean(wide));
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

const _esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function _avatarHtml(student, cls) {
    return student?.avatar
        ? `<img src="${_esc(student.avatar)}" class="${cls}" alt="">`
        : `<span class="${cls} ${cls}--initial">${_esc((student?.name || '?').charAt(0).toUpperCase())}</span>`;
}

/** A guild's crest as a tiny inline image (for stat tiles), or its emoji. */
function _crestIcon(guildId) {
    const url = getGuildEmblemUrl(guildId);
    return url ? `<img src="${_esc(url)}" alt="" class="fw-result-stat__crest">` : (getGuildById(guildId)?.emoji || '⚜️');
}

function _ribbonText(segment, rarityConf, guildDef, { braved = false, whirlwind = false, outcome = null } = {}) {
    if (braved) return segment.rarity === 'omen' ? 'Omen defied!' : 'Storm braved!';
    if (segment.rarity === 'envoy') return `${guildDef?.name || 'The'} Envoy`;
    if (segment.rarity === 'omen') return `✦ Omen · ${segment.harsh && outcome !== 'gain' ? 'fate shakes' : 'fate shines'} ✦`;
    return whirlwind ? `Whirlwind · ${rarityConf.label}` : rarityConf.label;
}

/** Many heroes, or heroes of more than one guild: the card spreads out beside the fortune. */
function _ledgerIsBig(result) {
    const rows = result.ledger || [];
    return rows.length > 4 || new Set(rows.map((r) => r.guildId)).size > 1;
}

const _fmtDelta = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n * 100) / 100)}`;

/**
 * Every hero this fate touched, grouped by guild (the spinning guild first), each with exactly
 * what they received or lost. A storm's spared heroes show a little shield.
 */
function _heroLedgerHtml(result) {
    const rows = (result.ledger || []).filter((r) => r.glory || r.wind || r.gold || r.stars || r.artifacts?.length || r.spared);
    if (!rows.length) return '';
    const students = new Map((state.get('allStudents') || []).map((s) => [s.id, s]));
    const groups = new Map();
    for (const row of rows) groups.set(row.guildId, [...(groups.get(row.guildId) || []), row]);
    const order = [result.guildId, ...GUILD_IDS.filter((g) => g !== result.guildId), null];
    let k = 0;
    const groupHtml = [...groups.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((gid) => {
        const def = getGuildById(gid);
        const list = groups.get(gid).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const glory = _round2(list.reduce((sum, r) => sum + (r.glory || 0), 0));
        const crest = getGuildEmblemUrl(gid);
        const chips = list.map((row) => {
            const st = students.get(row.id) || { name: row.name };
            const badges = [
                row.glory ? `<span class="fw-hero__b fw-hero__b--glory${row.glory < 0 ? ' is-neg' : ''}">${_fmtDelta(row.glory)}<i aria-hidden="true">⚜️</i></span>` : '',
                row.stars ? `<span class="fw-hero__b fw-hero__b--star${row.stars < 0 ? ' is-neg' : ''}">${_fmtDelta(row.stars)}<i aria-hidden="true">⭐</i></span>` : '',
                row.gold ? `<span class="fw-hero__b fw-hero__b--gold${row.gold < 0 ? ' is-neg' : ''}">${_fmtDelta(row.gold)}<i aria-hidden="true">🪙</i></span>` : '',
                ...(row.artifacts || []).map((a) => `<span class="fw-hero__b fw-hero__b--artifact" title="${_esc(a.name)}"><i aria-hidden="true">${_esc(a.icon)}</i>${_esc(a.name)}</span>`),
                row.wind ? `<span class="fw-hero__b fw-hero__b--wind" title="Comeback wind">${_fmtDelta(row.wind)}<i aria-hidden="true">🌬️</i></span>` : '',
            ].join('');
            const spared = !badges && row.spared;
            const neg = (row.glory || 0) < 0 || (row.gold || 0) < 0;
            return `
                <li class="fw-hero${spared ? ' is-spared' : ''}${neg ? ' is-hit' : ''}" style="--k:${k++}">
                    ${_avatarHtml(st, 'fw-hero__avatar')}
                    <span class="fw-hero__name">${_esc(st.name || 'Hero')}</span>
                    <span class="fw-hero__badges">${badges || (spared ? '<span class="fw-hero__b fw-hero__b--safe">🛡️ safe</span>' : '')}</span>
                </li>`;
        }).join('');
        return `
            <section class="fw-heroes__group${gid === result.guildId ? ' is-home' : ''}" style="--g:${def?.primary || '#e8c46a'}">
                <header class="fw-heroes__head">
                    ${crest ? `<img src="${_esc(crest)}" alt="" class="fw-heroes__crest">` : `<span class="fw-heroes__crest fw-heroes__crest--blank">${_esc(def?.emoji || '⚜️')}</span>`}
                    <span class="fw-heroes__guild">${_esc(def?.name || 'Heroes')}</span>
                    <span class="fw-heroes__count">${list.length} hero${list.length === 1 ? '' : 'es'}</span>
                    ${glory ? `<span class="fw-heroes__glory${glory < 0 ? ' is-neg' : ''}">${_fmtDelta(glory)} ⚜️</span>` : ''}
                </header>
                <ul class="fw-heroes__list">${chips}</ul>
            </section>`;
    }).join('');
    return `
        <div class="fw-result-divider"></div>
        <div class="fw-heroes" aria-label="Every hero touched by this fate">
            <div class="fw-heroes__title"><span aria-hidden="true">✦</span> Who the fate found <span aria-hidden="true">✦</span></div>
            ${groupHtml}
        </div>`;
}

/** The fate card shown at once on landing, while its Glory, gold and stars are written. */
function _renderWheelPending(segment, guildDef, { whirlwind = false, braved = false } = {}) {
    const rarityConf = getRarityPalette(segment.rarity, segment.paletteIndex);
    const emblemUrl = getGuildEmblemUrl(guildDef?.id);
    const family = ['storm', 'twist', 'trial', 'omen', 'envoy'].includes(segment.rarity) ? segment.rarity : 'treasure';
    const ribbon = _ribbonText(segment, rarityConf, guildDef, { braved, whirlwind });
    const cardHtml = `
        <div class="fw-result-card fw-result-card--v2 is-pending${segment.isPrismatic ? ' is-prismatic' : ''}"
             data-rarity="${segment.rarity}" data-family="${family}" data-outcome="${braved ? 'braved' : 'gain'}"
             style="--rarity-color:${rarityConf.color};--rarity-glow:${rarityConf.glow};--rarity-bg:${rarityConf.bg};border-color:${rarityConf.color};">
            <div class="fw-result-ribbon">${ribbon}</div>
            <div class="fw-result-emoji-orb">${braved ? '🛡️' : segment.emoji}</div>
            <div class="fw-result-guild-row">
                ${emblemUrl ? `<img src="${emblemUrl}" alt="${guildDef?.name || ''}" class="fw-result-guild-row__image">` : ''}
                <span class="fw-result-guild-row__name">${guildDef?.name || ''}</span>
            </div>
            <div class="fw-result-title">${segment.label}</div>
            <div class="fw-result-description">${segment.description}</div>
            <div class="fw-result-inking" aria-live="polite"><span></span><span></span><span></span></div>
        </div>`;
    _setStageCaption(`${guildDef?.name || 'The guild'} receives ${segment.label}…`);
    _setCardPhase('revealed');
    _updateSpinButton(true, 'Fate Revealed', 'Prepare the next presentation');
    _showResultReveal({
        cardHtml,
        rarity: segment.rarity,
        rarityColor: rarityConf.color,
        rarityGlow: rarityConf.glow,
        rarityBg: rarityConf.bg,
        isPrismatic: segment.isPrismatic === true,
    });
}

function _renderWheelResult(segment, result, guildDef) {
    // Already on show as the pending card: fill it in place instead of dealing it again.
    const settled = Boolean(document.querySelector('#fw-reveal-card .fw-result-card.is-pending'));
    const rarityConf = getRarityPalette(segment.rarity, segment.paletteIndex);
    const emblemUrl = getGuildEmblemUrl(guildDef?.id);

    // ── Resolve affected student objects ─────────────────────────────────
    const allStudents = state.get('allStudents') || [];
    const affectedStudentIds = result.affectedStudents || [];

    // ── Every hero this fate touched, grouped by guild (nobody hidden behind "+N more") ──
    const heroLedgerHtml = _heroLedgerHtml(result);
    const affectedStudents = (result.ledger || []).length ? [] : affectedStudentIds
        .map(id => allStudents.find(s => s.id === id))
        .filter(Boolean);
    const studentChipsHtml = affectedStudents.length
        ? `<div class="fw-result-student-row">${affectedStudents.map(s => `<div class="fw-result-student-chip">${_avatarHtml(s, 'fw-result-student-avatar')}<span>${_esc(s.name)}</span></div>`).join('')}</div>`
        : '';

    // ── Impact stat tiles ─────────────────────────────────────────────────
    // Artifacts get their own showcase block below, so only show the generic
    // tile for removal events (no names available to show) or when no granted list.
    const showArtifactTile = (result.artifactsRemoved || 0) > 0 ||
        ((result.artifactsGranted || 0) > 0 && !(result.grantedArtifacts?.length));

    const statDefs = [
        result.gloryDelta
            ? { icon: '⚜️', label: result.envoy ? 'Glory' : 'Guild Glory', displayStr: `${result.gloryDelta >= 0 ? '+' : ''}${result.gloryDelta}`, isNeg: result.gloryDelta < 0 }
            : null,
        result.wind
            ? { icon: '🌬️', label: 'Comeback wind', displayStr: `+${result.wind.total}`, isNeg: false }
            : null,
        ...Object.entries(result.gloryByGuild || {})
            .filter(([gid, n]) => n && (result.envoy || gid !== result.guildId))
            .map(([gid, n]) => ({ icon: _crestIcon(gid), label: `${getGuildById(gid)?.name || 'Guild'} Glory`, displayStr: `${n >= 0 ? '+' : ''}${n}`, isNeg: n < 0 })),
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
        const pills = unique.map(a => `
            <div class="fw-result-artifact-pill">
                <span class="fw-result-artifact-pill__icon">${a.icon}</span>
                <span class="fw-result-artifact-pill__name">${a.name}${a.count > 1 ? ` ×${a.count}` : ''}</span>
            </div>`).join('');
        artifactShowcaseHtml = `
            <div class="fw-result-divider"></div>
            <div class="fw-result-artifacts-header">🎒 Artifacts Received</div>
            <div class="fw-result-artifacts-showcase">${pills}</div>`;
    }

    // ── Outcome: how the fate turned out (storm braved, chest chosen, coin flipped…) ──
    const family = ['storm', 'twist', 'trial', 'omen', 'envoy'].includes(segment.rarity) ? segment.rarity : 'treasure';
    const outcome = result.braved ? 'braved' : result.stormHit ? 'hit' : (result.gloryDelta || 0) < 0 ? 'hit' : (result.loss && !((result.gloryDelta || 0) > 0)) ? 'hit' : 'gain';
    const ribbon = _ribbonText(segment, rarityConf, guildDef, { braved: result.braved, whirlwind: result.whirlwind, outcome });
    const decisionHtml = result.decision
        ? `<div class="fw-result-decision">${result.decision}</div>`
        : '';

    // ── Full card HTML ────────────────────────────────────────────────────
    const cardHtml = `
        <div class="fw-result-card fw-result-card--v2${settled ? ' is-settled' : ''}${segment.isPrismatic ? ' is-prismatic' : ''}${heroLedgerHtml && _ledgerIsBig(result) ? ' has-heroes' : ''}"
             data-rarity="${segment.rarity}" data-family="${family}" data-outcome="${outcome}"
             style="--rarity-color:${rarityConf.color};--rarity-glow:${rarityConf.glow};--rarity-bg:${rarityConf.bg};border-color:${rarityConf.color};">
            <div class="fw-result-ribbon">${ribbon}</div>
            <div class="fw-result-emoji-orb">${result.braved ? '🛡️' : segment.emoji}</div>
            <div class="fw-result-guild-row">
                ${emblemUrl ? `<img src="${emblemUrl}" alt="${guildDef?.name || ''}" class="fw-result-guild-row__image">` : ''}
                <span class="fw-result-guild-row__name">${guildDef?.name || result.guildId}</span>
            </div>
            <div class="fw-result-title">${segment.label}</div>
            ${decisionHtml}
            <div class="fw-result-description">${result.description || segment.description}</div>
            ${result.wind ? `<div class="fw-result-wind"><span aria-hidden="true">🌬️</span> And the comeback wind: +${result.wind.perHero} Glory for each guildmate here, because ${guildDef?.name || 'the guild'} is ${_ordinal(result.wind.place)} this month.</div>` : ''}
            ${statsBlockHtml}
            ${artifactShowcaseHtml}
            ${heroLedgerHtml}
            ${studentChipsHtml}
        </div>`;

    const guildName = guildDef?.name || 'The guild';
    _setStageCaption(result.envoy
        ? (outcome === 'hit' ? `${guildName}'s Envoy brought trouble this time. Every class has stormy days. Advance when you are ready.` : `${guildName}'s Envoy has delivered its gift. Advance when you are ready.`)
        : result.braved
        ? `${guildName} braved the ${segment.rarity === 'omen' ? 'Omen' : 'storm'}! Advance when you are ready for the next guild.`
        : outcome === 'hit'
            ? `A stormy moment for ${guildName}. Every hero has one. Advance when you are ready.`
            : `${guildName} has received ${segment.label}. Advance when you are ready for the next reveal.`);
    _setCardPhase('revealed');
    _updateSpinButton(true, 'Fate Revealed', 'Prepare the next presentation');
    if (settled) _fillPendingCard(cardHtml);
    _showResultReveal({
        wide: Boolean(heroLedgerHtml) && _ledgerIsBig(result),
        cardHtml: settled ? null : cardHtml,
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

    _playOutcome(segment, result, outcome);
}

/** Moves the finished fate into the pending card, keeping its floating orb so nothing jumps. */
function _fillPendingCard(cardHtml) {
    const cur = document.querySelector('#fw-reveal-card .fw-result-card.is-pending');
    if (!cur) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = cardHtml.trim();
    const next = tpl.content.firstElementChild;
    if (!next) return;
    for (const { name, value } of [...next.attributes]) cur.setAttribute(name, value);
    const orb = cur.querySelector('.fw-result-emoji-orb');
    const nextOrb = next.querySelector('.fw-result-emoji-orb');
    if (orb && nextOrb) {
        if (orb.textContent !== nextOrb.textContent) orb.textContent = nextOrb.textContent;
        nextOrb.replaceWith(orb);
    }
    cur.replaceChildren(...next.childNodes);
}

/** The result card's moment: a shield for a braved storm, rain for a loss, a burst for a gift. */
function _playOutcome(segment, result, outcome) {
    const frame = document.getElementById('fw-stage-frame');
    const o = _fxOrigin();
    const lite = _isLite();
    if (outcome === 'braved' && segment.rarity === 'omen') {
        // The comet bursts into stardust.
        try { playHeroFanfare(); } catch (_) { /* optional */ }
        if (o) {
            fxFlash(o.layer, 'rgba(255, 214, 140, 0.35)');
            fxBurst(o.layer, { x: o.x, y: o.y, colors: ['#ffd28a', '#fff7d6', '#c4b5fd', '#93c5fd'], count: 34, emojis: ['✨', '🌟', '💫'], emojiCount: 14, spread: o.size * 0.6, lite });
        }
        return;
    }
    if (outcome === 'braved') {
        try { playWheelSfx('shield'); } catch (_) { /* optional */ }
        fxShield(frame);
        if (o) fxBurst(o.layer, { x: o.x, y: o.y, colors: ['#fde68a', '#fbbf24', '#fff7d6'], count: 18, emojis: ['🛡️', '✨'], emojiCount: 5, spread: o.size * 0.4, lite });
        return;
    }
    if (segment.rarity === 'omen' && (result.eclipsed || []).length && !result.eclipsed.includes(result.guildId)) {
        // The Eclipse passed this guild by and fell on the leader: a hush, then a shadow.
        try { setTimeout(() => playSound('star_remove'), 250); } catch (_) { /* optional */ }
        if (o) fxBurst(o.layer, { x: o.x, y: o.y, colors: ['#ffb347', '#475569', '#fde68a'], count: 14, emojis: ['🌑', '✨'], emojiCount: 6, spread: o.size * 0.45, lite });
        return;
    }
    if (outcome === 'hit' && segment.rarity === 'omen') {
        try { setTimeout(() => playSound('star_remove'), 250); } catch (_) { /* optional */ }
        if (o) fxBurst(o.layer, { x: o.x, y: o.y * 0.7, colors: ['#ffb347', '#7c2d12', '#94a3b8'], count: 16, emojis: [segment.emoji || '☄️', '💨'], emojiCount: 8, spread: o.size * 0.45, lite });
        return;
    }
    if (outcome === 'hit') {
        try { setTimeout(() => playSound('star_remove'), 250); } catch (_) { /* optional */ }
        if (o) fxBurst(o.layer, { x: o.x, y: o.y * 0.7, colors: ['#94a3b8', '#64748b', '#cbd5e1'], count: 8, emojis: ['💧', '🌧️'], emojiCount: 6, spread: o.size * 0.35, lite });
        return;
    }
    const hasGain = (result.gloryDelta || 0) > 0 || (result.goldDelta || 0) > 0 || (result.starsDelta || 0) > 0
        || (result.artifactsGranted || 0) > 0 || (result.classQuestDelta || 0) > 0 || (result.classGlory || 0) > 0;
    if (TREASURE_FX[segment.rarity]) triggerWheelRevealEffects(segment.rarity);
    else if (segment.rarity === 'omen' && hasGain) triggerWheelRevealEffects('mythic');
    else if (segment.rarity === 'envoy' && hasGain && o) fxBurst(o.layer, { x: o.x, y: o.y, colors: ['#bfdbfe', '#c4b5fd', '#a7f3d0', '#fef3c7'], count: 20, emojis: ['🕊️', '💌', '✨'], emojiCount: 8, spread: o.size * 0.5, lite });
    else if (hasGain) triggerWheelRevealEffects(segment.rarity === 'trial' ? 'rare' : 'uncommon');
    // Secondary sounds, staggered after the landing sound.
    if ((result.starsDelta || 0) > 0)       setTimeout(() => playSound('star2'),       400);
    if ((result.goldDelta || 0) > 0)        setTimeout(() => playSound('cash'),        600);
    if ((result.artifactsGranted || 0) > 0) setTimeout(() => playSound('magic_chime'), 800);
    if ((result.artifactsRemoved || 0) > 0) setTimeout(() => playSound('star_remove'), 400);
}

function _renderWheelSummary() {
    const summaryEl = document.getElementById('fw-summary');
    if (!summaryEl) return;
    _hideResultReveal();

    const canvasWrap = document.getElementById('fw-canvas-wrap');
    if (canvasWrap) canvasWrap.classList.add('hidden');
    const stageFrame = document.getElementById('fw-stage-frame');
    if (stageFrame) stageFrame.classList.add('is-locked');
    stageFrame?.classList.remove('is-envoy', 'has-omen');
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
                r.wind?.total ? deltaChip(signed(r.wind.total), '🌬️', 'Comeback wind', false) : '',
                ...Object.entries(r.gloryByGuild || {}).filter(([gid, n]) => n && (r.envoy || gid !== r.guildId))
                    .map(([gid, n]) => deltaChip(signed(n), _crestIcon(gid), `${getGuildById(gid)?.name || 'Guild'} Glory`, n < 0)),
                r.goldDelta ? deltaChip(signed(r.goldDelta), '🪙', 'Gold', r.goldDelta < 0) : '',
                r.starsDelta ? deltaChip(signed(r.starsDelta), '⭐', 'Stars', r.starsDelta < 0) : '',
                r.classQuestDelta ? deltaChip(signed(r.classQuestDelta), '🗺️', 'Quest Bonus', r.classQuestDelta < 0) : '',
                (r.artifactsGranted || r.artifactsRemoved)
                    ? deltaChip(`${r.artifactsGranted ? `+${r.artifactsGranted}` : ''}${r.artifactsGranted && r.artifactsRemoved ? ' / ' : ''}${r.artifactsRemoved ? `-${r.artifactsRemoved}` : ''}`, '🎒', 'Artifacts', (r.artifactsRemoved || 0) > 0)
                    : '',
            ].join('');
            // Every hero the fate touched, by name (other guilds' heroes wear their guild's colour).
            const heroes = (r.ledger || []).filter((row) => row.glory || row.gold || row.stars || row.artifacts?.length);
            const heroesHtml = heroes.length
                ? `<ul class="fw-summary-heroes">${heroes.map((row) => {
                    const g = getGuildById(row.guildId);
                    const neg = (row.glory || 0) < 0 || (row.gold || 0) < 0;
                    return `<li class="${neg ? 'is-neg' : ''}${row.guildId !== r.guildId ? ' is-other' : ''}" style="--hg:${g?.primary || '#e8c46a'}">${_esc(String(row.name || 'Hero').split(' ')[0])}</li>`;
                }).join('')}</ul>`
                : '';
            return `
                <div class="fw-summary-item${r.envoy ? ' is-envoy' : ''}" data-rarity="${r.rarity}" style="--guild-primary:${guildDef?.primary || '#9a7128'};--rarity-color:${rarityConf.color};--rarity-bg:${rarityConf.bg};animation-delay:${(0.08 + index * 0.1).toFixed(2)}s">
                    <div class="fw-summary-guild">
                        ${emblemUrl ? `<img src="${emblemUrl}" alt="${guildDef?.name || r.guildId}" class="fw-summary-emblem">` : ''}
                        <span>${guildDef?.name || r.guildId}${r.envoy ? ' <small>Envoy</small>' : ''}</span>
                    </div>
                    <div class="fw-summary-result">${r.segmentLabel}</div>
                    <div class="fw-summary-rarity">${r.envoy ? "The Envoy's fate" : rarityConf.label}</div>
                    <div class="fw-summary-desc">${r.description || r.segmentDescription}</div>
                    ${deltas ? `<div class="fw-summary-deltas">${deltas}</div>` : ''}
                    ${heroesHtml}
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
