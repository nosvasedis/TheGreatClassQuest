const test = require('node:test');
const assert = require('node:assert/strict');

async function loadCore() {
  return import('../features/guildScoringCore.js');
}

const WEIGHTS = {
  seasonGlory: 0.70,
  weeklyGlory: 0.15,
  activity: 0.10,
  momentum: 0.05,
};

test('guild power is fair for equal per-member output across different guild sizes', async () => {
  const { calculateGuildPower } = await loadCore();
  const maxima = { maxPerCapitaGlory: 20, maxWeeklyPerCapitaGlory: 4 };

  const smallGuild = calculateGuildPower({
    memberCount: 5,
    totalGlory: 100,
    weeklyGlory: 20,
    previousWeekGlory: 10,
    weeklyActiveMembers: 5,
  }, maxima, WEIGHTS);

  const largeGuild = calculateGuildPower({
    memberCount: 10,
    totalGlory: 200,
    weeklyGlory: 40,
    previousWeekGlory: 20,
    weeklyActiveMembers: 10,
  }, maxima, WEIGHTS);

  assert.equal(smallGuild.perCapitaGlory, largeGuild.perCapitaGlory);
  assert.equal(smallGuild.weeklyPerCapitaGlory, largeGuild.weeklyPerCapitaGlory);
  assert.equal(smallGuild.guildPower, largeGuild.guildPower);
});

test('empty guilds score zero and negative weekly glory clamps safely', async () => {
  const { calculateGuildPower } = await loadCore();

  const empty = calculateGuildPower({
    memberCount: 0,
    totalGlory: 500,
    weeklyGlory: 100,
    weeklyActiveMembers: 3,
  }, { maxPerCapitaGlory: 20, maxWeeklyPerCapitaGlory: 5 }, WEIGHTS);

  assert.equal(empty.guildPower, 0);
  assert.equal(empty.perCapitaGlory, 0);
  assert.equal(empty.weeklyPerCapitaGlory, 0);

  const penalized = calculateGuildPower({
    memberCount: 4,
    totalGlory: 40,
    weeklyGlory: -20,
    previousWeekGlory: 20,
    weeklyActiveMembers: 0,
  }, { maxPerCapitaGlory: 10, maxWeeklyPerCapitaGlory: 5 }, WEIGHTS);

  assert.equal(penalized.weeklyGloryScore, 0);
  assert.equal(penalized.activityScore, 0);
  assert.equal(penalized.momentumScore, 0);
  assert.equal(penalized.guildPower, 70);
});

test('momentum lock prevents negative momentum from lowering the momentum component', async () => {
  const { calculateGuildPower } = await loadCore();
  const now = Date.now();
  const base = {
    memberCount: 5,
    totalGlory: 100,
    weeklyGlory: 10,
    previousWeekGlory: 20,
    weeklyActiveMembers: 3,
  };

  const unlocked = calculateGuildPower(base, { maxPerCapitaGlory: 20, maxWeeklyPerCapitaGlory: 4 }, WEIGHTS);
  const locked = calculateGuildPower({
    ...base,
    gloryModifiers: [{ type: 'momentum_lock', expiresAt: now + 60_000 }],
  }, { maxPerCapitaGlory: 20, maxWeeklyPerCapitaGlory: 4 }, WEIGHTS);

  assert.equal(unlocked.momentumPct, -50);
  assert.equal(unlocked.momentumScore, 25);
  assert.equal(locked.momentumPct, 0);
  assert.equal(locked.momentumScore, 50);
  assert.ok(locked.guildPower > unlocked.guildPower);
});

test('glory events combine stars, Banner, Chalice, charged bonuses, and multipliers once', async () => {
  const { calculateGuildGloryDelta } = await loadCore();
  const now = Date.now();
  const result = calculateGuildGloryDelta({
    starDelta: 3,
    directGlory: 5,
    scoreData: { gloryBannerCharges: 1 },
    guildData: {
      chaliceActive: true,
      chaliceExpiresAt: now + 60_000,
      gloryModifiers: [
        { type: 'bonus_per_star', amount: 2, charges: 2, expiresAt: now + 60_000, label: 'Crown of Sparks' },
        { type: 'multiply', factor: 2, expiresAt: now + 60_000, label: 'Glory Doubler' },
      ],
    },
    gloryPerStar: 2,
    now,
  });

  assert.equal(result.baseGlory, 6);
  assert.equal(result.modifierGlory, 22);
  assert.equal(result.directGlory, 5);
  assert.equal(result.totalGloryDelta, 33);
  assert.equal(result.consumedGloryModifiers.length, 1);
  assert.equal(result.consumedGloryModifiers[0].type, 'multiply');
});

test('negative wheel star effects write negative Glory without per-star bonuses', async () => {
  const { calculateGuildGloryDelta } = await loadCore();
  const now = Date.now();

  const result = calculateGuildGloryDelta({
    starDelta: -2,
    scoreData: { gloryBannerCharges: 3 },
    guildData: {
      chaliceActive: true,
      chaliceExpiresAt: now + 60_000,
      gloryModifiers: [{ type: 'bonus_per_star', amount: 5, charges: 5, expiresAt: now + 60_000 }],
    },
    gloryPerStar: 2,
    now,
  });

  assert.equal(result.baseGlory, -4);
  assert.equal(result.modifierGlory, 0);
  assert.equal(result.totalGloryDelta, -4);
  assert.equal(result.consumedGloryModifiers[0].charges, 5);
});

test('leaderboard comparator uses deterministic fair tie-breaks', async () => {
  const { compareGuildLeaderboardRows } = await loadCore();
  const rows = [
    { guildName: 'Borealis', guildPower: 80, perCapitaGlory: 12, weeklyPerCapitaGlory: 5, totalGlory: 90 },
    { guildName: 'Aether', guildPower: 80, perCapitaGlory: 12, weeklyPerCapitaGlory: 5, totalGlory: 90 },
    { guildName: 'Cygnus', guildPower: 80, perCapitaGlory: 12, weeklyPerCapitaGlory: 6, totalGlory: 80 },
    { guildName: 'Dawn', guildPower: 81, perCapitaGlory: 1, weeklyPerCapitaGlory: 0, totalGlory: 1 },
  ];

  rows.sort(compareGuildLeaderboardRows);

  assert.deepEqual(rows.map(r => r.guildName), ['Dawn', 'Cygnus', 'Aether', 'Borealis']);
});
