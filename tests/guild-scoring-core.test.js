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
  assert.equal(penalized.guildPower, 10, 'a bad week never lowers Guild Power; only the year\'s Glory per member counts');
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
  assert.equal(locked.guildPower, unlocked.guildPower, 'momentum is a badge, not part of the ranking');
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

test('the year-long race is ranked by Glory per member only; this week never reorders it', async () => {
  const { compareGuildLeaderboardRows, calculateGuildPower } = await loadCore();
  const steady = calculateGuildPower({ memberCount: 10, totalGlory: 300, weeklyGlory: 0, previousWeekGlory: 50 }, { maxWeeklyPerCapitaGlory: 5 });
  const hotWeek = calculateGuildPower({ memberCount: 10, totalGlory: 299, weeklyGlory: 50, previousWeekGlory: 0, weeklyActiveMembers: 10 }, { maxWeeklyPerCapitaGlory: 5 });
  assert.equal(steady.guildPower, 30);
  assert.ok(steady.guildPower > hotWeek.guildPower);

  const rows = [
    { guildName: 'Borealis', seasonGloryPerMember: 12, totalGlory: 90 },
    { guildName: 'Aether', seasonGloryPerMember: 12, totalGlory: 90 },
    { guildName: 'Cygnus', seasonGloryPerMember: 12, totalGlory: 120 },
    { guildName: 'Dawn', seasonGloryPerMember: 12.04, totalGlory: 12 },
  ];
  rows.sort(compareGuildLeaderboardRows);
  assert.deepEqual(rows.map(r => r.guildName), ['Dawn', 'Cygnus', 'Aether', 'Borealis']);
});

test('Glory earned by students who left leaves the guild with them', async () => {
  const { countedGuildGlory } = await loadCore();
  const guild = { activeSchoolYearKey: '2026-2027', memberGloryYear: '2026-2027', totalGlory: 130, memberGlory: { a: 40, b: 50, gone: 30 } };
  assert.deepEqual(countedGuildGlory(guild, ['a', 'b']), { countedGlory: 100, leaversGlory: 30, memberGloryReady: true });
  const lastYearMap = { ...guild, memberGloryYear: '2025-2026' };
  assert.equal(countedGuildGlory(lastYearMap, ['a', 'b']).countedGlory, 130, 'an old year\'s map is ignored');
});

test('wheel Glory is sized so each member of every guild gains the same', async () => {
  const { guildSizeScale } = await loadCore();
  const sizes = { small: 10, big: 30 };
  assert.equal(guildSizeScale(sizes, 'small'), 0.5);
  assert.equal(guildSizeScale(sizes, 'big'), 1.5);
  assert.equal(20 * guildSizeScale(sizes, 'small') / 10, 20 * guildSizeScale(sizes, 'big') / 30);
  assert.equal(guildSizeScale({}, 'small'), 1);
});


// Mon 5 Oct 2026, 10:00 local; previous Monday is 28 Sep.
const MONDAY_OCT_5 = new Date(2026, 9, 5, 10, 0, 0).getTime();

test('a guild that has not earned since Monday is read as a fresh week, not last week', async () => {
  const { resolveGuildWeek } = await loadCore();
  const stale = resolveGuildWeek({
    lastWeeklyReset: '2026-09-28', weeklyGlory: 180, previousWeekGlory: 90,
    weeklyActiveMembers: 12, weeklyActiveMemberIds: ['a', 'b'],
  }, MONDAY_OCT_5);
  assert.equal(stale.weeklyGlory, 0);
  assert.equal(stale.previousWeekGlory, 180, 'last week is the stored week');
  assert.equal(stale.weeklyActiveMembers, 0);

  const skippedAWeek = resolveGuildWeek({ lastWeeklyReset: '2026-09-21', weeklyGlory: 180 }, MONDAY_OCT_5);
  assert.equal(skippedAWeek.previousWeekGlory, 0, 'a guild that sat out last week had 0 last week');

  const current = resolveGuildWeek({
    lastWeeklyReset: '2026-10-05', weeklyGlory: 14, previousWeekGlory: 180,
    weeklyActiveMembers: 99, weeklyActiveMemberIds: ['a', 'a', 'b'],
  }, MONDAY_OCT_5);
  assert.equal(current.weeklyGlory, 14);
  assert.equal(current.previousWeekGlory, 180);
  assert.equal(current.weeklyActiveMembers, 2, 'active members come from the unique id list');
});

test('taking a star back during a multiplier costs only its plain Glory', async () => {
  const { calculateGuildGloryDelta } = await loadCore();
  const guildData = { gloryModifiers: [{ type: 'multiply', factor: 4, expiresAt: MONDAY_OCT_5 + 3600000 }] };
  const give = calculateGuildGloryDelta({ starDelta: 1, guildData, now: MONDAY_OCT_5 });
  const takeBack = calculateGuildGloryDelta({ starDelta: -1, guildData, now: MONDAY_OCT_5 });
  assert.equal(give.totalGloryDelta, 8);
  assert.equal(takeBack.totalGloryDelta, -2);
});

test('a Glory Challenge pays the guild with the most Glory per member last week', async () => {
  const { findWonGuildChallenges, consumeChargeModifiers } = await loadCore();
  const lastWed = new Date(2026, 8, 30, 11, 0, 0).getTime();
  const lastSunday = new Date(2026, 9, 4, 23, 59, 59, 999).getTime();
  const challenge = { type: 'challenge', bonus: 50, createdAt: lastWed, expiresAt: lastSunday };
  const scores = {
    small: { lastWeeklyReset: '2026-09-28', weeklyGlory: 100, gloryModifiers: [challenge] },
    big: { lastWeeklyReset: '2026-10-05', weeklyGlory: 4, previousWeekGlory: 150, gloryModifiers: [{ ...challenge, createdAt: lastWed + 1 }] },
  };
  const won = findWonGuildChallenges(scores, { small: 5, big: 10 }, MONDAY_OCT_5);
  assert.deepEqual(won.map((w) => w.guildId), ['small'], '20 per member beats 15 per member');
  assert.equal(won[0].key, `challenge_small_${lastWed}`);

  assert.equal(consumeChargeModifiers([challenge], 1, MONDAY_OCT_5).length, 1, 'kept on file until tallied');
  assert.equal(findWonGuildChallenges(scores, { small: 5, big: 10 }, lastWed + 3600000).length, 0, 'not judged mid-week');
});
