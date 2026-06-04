const test = require('node:test');
const assert = require('node:assert/strict');

test('wheel star blessing contributes star credit', async () => {
  const { getAwardLogMonthlyStarCredit, shouldShowInStarAwardLog } = await import('../features/awardLogReasonMeta.js');
  const log = {
    reason: 'wheel_fortune',
    stars: 0,
    appliedStarCredit: 1,
    wheel: { deltaStars: 1, deltaGold: 0 }
  };

  assert.equal(getAwardLogMonthlyStarCredit(log), 1);
  assert.equal(shouldShowInStarAwardLog(log), true);
});

test('wheel gold blessing has no star credit and is hidden from star award logs', async () => {
  const { getAwardLogGoldCredit, getAwardLogMonthlyStarCredit, isWheelGoldOnlyAwardLog, shouldShowInStarAwardLog } = await import('../features/awardLogReasonMeta.js');
  const log = {
    reason: 'wheel_fortune',
    stars: 0,
    appliedStarCredit: 0,
    wheel: { deltaStars: 0, deltaGold: 15 }
  };

  assert.equal(getAwardLogMonthlyStarCredit(log), 0);
  assert.equal(getAwardLogGoldCredit(log), 15);
  assert.equal(isWheelGoldOnlyAwardLog(log), true);
  assert.equal(shouldShowInStarAwardLog(log), false);
});
