const test = require('node:test');
const assert = require('node:assert/strict');

const EFFECT_TYPES = new Set([
  'self_gold_on_reason',
  'star_bonus_on_reason',
  'classmate_gold_on_reason',
  'guildmate_gold_on_reason',
  'first_of_month_guild_bonus',
  'random_classmate_gold'
]);

test('Patron tree has three gift thresholds and two branches per level', async () => {
  const { HERO_SKILL_TREE, getReasonDisplayName } = await import('../features/heroSkillTree.js');
  const { HERO_CLASSES } = await import('../features/heroClasses.js');

  const tree = HERO_SKILL_TREE.Patron;
  assert.equal(HERO_CLASSES.Patron.reason, 'peer_boon');
  assert.equal(tree.reason, 'peer_boon');
  assert.equal(tree.auraColor, '#e11d48');
  assert.equal(HERO_CLASSES.Patron.theme.accent, tree.auraColor);
  assert.equal(HERO_CLASSES.Patron.bonus, 10);
  assert.equal(getReasonDisplayName('peer_boon'), "Hero's Boon");
  assert.deepEqual(tree.titles, ['Giver', 'Benefactor', 'Grand Patron']);
  assert.equal(tree.levels.length, 3);
  assert.deepEqual(tree.levels.map((level) => level.threshold), [10, 20, 30]);

  for (const level of tree.levels) {
    assert.equal(level.branches.length, 2);
    for (const branch of level.branches) {
      assert.ok(String(branch.id).startsWith('patron_'));
      assert.ok(EFFECT_TYPES.has(branch.effect.type));
      if (branch.secondaryEffect) {
        assert.ok(EFFECT_TYPES.has(branch.secondaryEffect.type));
      }
    }
  }
});

test('Patron path credits the giver without inventing rank stars', async () => {
  const { calculatePatronGiftEffects } = await import('../features/heroClasses.js');

  const nonPatron = calculatePatronGiftEffects({ heroClass: 'Guardian' }, { heroSkills: [], heroLevel: 0, starsByReason: {} });
  assert.equal(nonPatron.applies, false);
  assert.equal(nonPatron.giverGoldBonus, 0);
  assert.equal(nonPatron.extraStarsForReceiver, 0);

  const basePatron = calculatePatronGiftEffects(
    { heroClass: 'Patron' },
    { heroSkills: [], heroLevel: 0, starsByReason: {} }
  );
  assert.equal(basePatron.applies, true);
  assert.equal(basePatron.pathCredit, 1);
  assert.equal(basePatron.giverGoldBonus, 10);
  assert.equal(basePatron.extraStarsForReceiver, 0);
  assert.equal(basePatron.newReasonStars, 1);
  assert.equal(basePatron.newHeroLevel, 0);
  assert.equal(basePatron.leveledUp, false);
});

test('Patron Open Hand refunds gold to the giver only', async () => {
  const { calculatePatronGiftEffects } = await import('../features/heroClasses.js');

  const result = calculatePatronGiftEffects(
    { heroClass: 'Patron' },
    { heroSkills: ['patron_1a'], heroLevel: 1, starsByReason: { peer_boon: 10 } }
  );
  assert.equal(result.giverGoldBonus, 13);
  assert.equal(result.extraStarsForReceiver, 0);
  assert.equal(result.newHeroLevel, 1);
});

test('Overflowing Heart enlarges the receiver gift, not the Patron totals', async () => {
  const { calculatePatronGiftEffects } = await import('../features/heroClasses.js');
  const { calculateSkillBonus, computeHeroLevel } = await import('../features/heroSkillTree.js');

  const skill = calculateSkillBonus('Patron', ['patron_3b'], 'peer_boon', 1);
  assert.equal(skill.extraGold, 0);
  assert.equal(skill.extraStars, 1);

  const result = calculatePatronGiftEffects(
    { heroClass: 'Patron' },
    { heroSkills: ['patron_3b'], heroLevel: 2, starsByReason: { peer_boon: 29 } }
  );
  assert.equal(result.giverGoldBonus, 10);
  assert.equal(result.extraStarsForReceiver, 1);
  assert.equal(result.newReasonStars, 30);
  assert.equal(result.newHeroLevel, 3);
  assert.equal(result.leveledUp, true);
  assert.equal(computeHeroLevel('Patron', 9), 0);
  assert.equal(computeHeroLevel('Patron', 10), 1);
  assert.equal(computeHeroLevel('Patron', 30), 3);
});

test('Patron star bonus does not apply to other reasons', async () => {
  const { calculateSkillBonus } = await import('../features/heroSkillTree.js');
  const result = calculateSkillBonus('Patron', ['patron_3b'], 'respect', 1);
  assert.equal(result.extraStars, 0);
  assert.equal(result.extraGold, 0);
});

test('Grand Patron purse is break-even gold and gifts the receiver', async () => {
  const { calculatePatronGiftEffects } = await import('../features/heroClasses.js');
  const { getOutwardEffects } = await import('../features/heroSkillTree.js');

  const result = calculatePatronGiftEffects(
    { heroClass: 'Patron' },
    { heroSkills: ['patron_3a'], heroLevel: 3, starsByReason: { peer_boon: 30 } }
  );
  assert.equal(result.giverGoldBonus, 15);
  assert.equal(result.extraStarsForReceiver, 0);

  const outward = getOutwardEffects('Patron', ['patron_3a'], 'peer_boon', 1);
  assert.equal(outward.length, 1);
  assert.equal(outward[0].type, 'classmate_gold_on_reason');
  assert.equal(outward[0].amount, 3);
});

test('HERO_CLASSES and HERO_SKILL_TREE both list Patron last among eight classes', async () => {
  const { HERO_CLASSES } = await import('../features/heroClasses.js');
  const { HERO_SKILL_TREE } = await import('../features/heroSkillTree.js');
  const classNames = Object.keys(HERO_CLASSES);
  const treeNames = Object.keys(HERO_SKILL_TREE);
  assert.equal(classNames.length, 8);
  assert.equal(treeNames.length, 8);
  assert.deepEqual(classNames, treeNames);
  assert.equal(classNames[classNames.length - 1], 'Patron');
});

test('Patron gift branches target the receiver, guild, or first-of-month guild', async () => {
  const { getOutwardEffects } = await import('../features/heroSkillTree.js');

  const kindPurse = getOutwardEffects('Patron', ['patron_1b'], 'peer_boon', 1);
  assert.equal(kindPurse[0].type, 'classmate_gold_on_reason');
  assert.equal(kindPurse[0].amount, 3);

  const guildAlms = getOutwardEffects('Patron', ['patron_2a'], 'peer_boon', 1);
  assert.equal(guildAlms[0].type, 'guildmate_gold_on_reason');
  assert.equal(guildAlms[0].amount, 3);

  const firstMercy = getOutwardEffects('Patron', ['patron_2b'], 'peer_boon', 1);
  assert.equal(firstMercy[0].type, 'first_of_month_guild_bonus');
  assert.equal(firstMercy[0].amount, 7);
});

test('non-Patron paid gift spends 15 Gold, receiver +0.5, no path credit', async () => {
  const { computePeerBoonSettlement, PEER_BOON_COST } = await import('../features/heroClasses.js');
  const result = computePeerBoonSettlement({
    senderId: 'giver',
    receiverId: 'receiver',
    currentGold: 40,
    senderStudent: { heroClass: 'Guardian' },
    senderScoreData: { heroSkills: [], heroLevel: 0, starsByReason: {} },
    heroProgressionEnabled: true
  });
  assert.equal(result.ok, true);
  assert.equal(result.goldSpend, PEER_BOON_COST);
  assert.equal(result.giverGoldAfter, 25);
  assert.equal(result.receiverStarDelta, 0.5);
  assert.equal(result.patronGift.applies, false);
  assert.equal(result.patronGift.pathCredit, 0);
});

test('Patron paid gift nets 5 Gold, credits the giver path, keeps giver rank stars off the gift', async () => {
  const { computePeerBoonSettlement } = await import('../features/heroClasses.js');
  const result = computePeerBoonSettlement({
    senderId: 'giver',
    receiverId: 'receiver',
    currentGold: 40,
    senderStudent: { heroClass: 'Patron' },
    senderScoreData: { heroSkills: [], heroLevel: 0, starsByReason: { peer_boon: 4 }, totalStars: 12 },
    heroProgressionEnabled: true
  });
  assert.equal(result.ok, true);
  assert.equal(result.goldSpend, 15);
  assert.equal(result.giverGoldAfter, 35);
  assert.equal(result.receiverStarDelta, 0.5);
  assert.equal(result.patronGift.pathCredit, 1);
  assert.equal(result.patronGift.newReasonStars, 5);
  assert.equal(result.patronGift.extraStarsForReceiver, 0);
});

test('Overflowing Heart enlarges the receiver gift to 1.5 without giver rank stars', async () => {
  const { computePeerBoonSettlement } = await import('../features/heroClasses.js');
  const result = computePeerBoonSettlement({
    senderId: 'giver',
    receiverId: 'receiver',
    currentGold: 40,
    senderStudent: { heroClass: 'Patron' },
    senderScoreData: { heroSkills: ['patron_3b'], heroLevel: 3, starsByReason: { peer_boon: 30 } },
    heroProgressionEnabled: true
  });
  assert.equal(result.ok, true);
  assert.equal(result.giverGoldAfter, 35);
  assert.equal(result.receiverStarDelta, 1.5);
  assert.equal(result.patronGift.extraStarsForReceiver, 1);
});

test('Compassion Token free gift still credits the Patron path', async () => {
  const { computePeerBoonSettlement } = await import('../features/heroClasses.js');
  const monthFree = computePeerBoonSettlement({
    senderId: 'giver',
    receiverId: 'receiver',
    currentGold: 8,
    isMonthFree: true,
    senderStudent: { heroClass: 'Patron' },
    senderScoreData: { heroSkills: [], heroLevel: 0, starsByReason: { peer_boon: 2 } },
    heroProgressionEnabled: true
  });
  assert.equal(monthFree.ok, true);
  assert.equal(monthFree.goldSpend, 0);
  assert.equal(monthFree.giverGoldAfter, 18);
  assert.equal(monthFree.patronGift.pathCredit, 1);
  assert.equal(monthFree.patronGift.newReasonStars, 3);

  const stackedFree = computePeerBoonSettlement({
    senderId: 'giver',
    receiverId: 'receiver',
    currentGold: 8,
    freeBoonUses: 2,
    senderStudent: { heroClass: 'Patron' },
    senderScoreData: { heroSkills: [], heroLevel: 0, starsByReason: { peer_boon: 2 } },
    heroProgressionEnabled: true
  });
  assert.equal(stackedFree.ok, true);
  assert.equal(stackedFree.usesFreeUse, true);
  assert.equal(stackedFree.goldSpend, 0);
  assert.equal(stackedFree.patronGift.pathCredit, 1);
});

test('locked daily-cap consecutive and self gifts do not credit the Patron path', async () => {
  const { computePeerBoonSettlement } = await import('../features/heroClasses.js');
  const patron = {
    senderStudent: { heroClass: 'Patron' },
    senderScoreData: { heroSkills: [], heroLevel: 0, starsByReason: { peer_boon: 9 } },
    heroProgressionEnabled: true,
    currentGold: 40
  };

  const selfGift = computePeerBoonSettlement({ senderId: 'same', receiverId: 'same', ...patron });
  assert.equal(selfGift.ok, false);
  assert.equal(selfGift.patronGift, undefined);

  const dailyCap = computePeerBoonSettlement({ senderId: 'giver', receiverId: 'receiver', dailyCount: 4, ...patron });
  assert.equal(dailyCap.ok, false);

  const consecutive = computePeerBoonSettlement({
    senderId: 'giver',
    receiverId: 'receiver',
    lastPeerBoonRecipientId: 'receiver',
    ...patron
  });
  assert.equal(consecutive.ok, false);

  const noGold = computePeerBoonSettlement({
    senderId: 'giver',
    receiverId: 'receiver',
    currentGold: 10,
    senderStudent: patron.senderStudent,
    senderScoreData: patron.senderScoreData,
    heroProgressionEnabled: true
  });
  assert.equal(noGold.ok, false);

  const noHeroPath = computePeerBoonSettlement({
    senderId: 'giver',
    receiverId: 'receiver',
    currentGold: 40,
    senderStudent: { heroClass: 'Patron' },
    senderScoreData: patron.senderScoreData,
    heroProgressionEnabled: false
  });
  assert.equal(noHeroPath.ok, true);
  assert.equal(noHeroPath.patronGift.applies, false);
  assert.equal(noHeroPath.giverGoldAfter, 25);
});
