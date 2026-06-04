const test = require('node:test');
const assert = require('node:assert/strict');

test('star bonus skills add once per positive qualifying award event', async () => {
  const { calculateSkillBonus } = await import('../features/heroSkillTree.js');

  const result = calculateSkillBonus('Sage', ['sage_3b'], 'creativity', 3);

  assert.equal(result.extraStars, 1);
  assert.equal(3 + result.extraStars, 4);
});

test('star bonus skills subtract once when a qualifying award event is reverted', async () => {
  const { calculateSkillBonus } = await import('../features/heroSkillTree.js');

  const result = calculateSkillBonus('Sage', ['sage_3b'], 'creativity', -3);

  assert.equal(result.extraStars, -1);
  assert.equal(-3 + result.extraStars, -4);
});

test('star bonus skills do not apply to non-matching reasons', async () => {
  const { calculateSkillBonus } = await import('../features/heroSkillTree.js');

  const result = calculateSkillBonus('Sage', ['sage_3b'], 'teamwork', 3);

  assert.equal(result.extraStars, 0);
});
