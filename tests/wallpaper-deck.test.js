const test = require('node:test');
const assert = require('node:assert/strict');

test('wallpaper deck weights class-mode award and familiar families', async () => {
  const { applyWallpaperFamilyWeights } = await import('../utils/wallpaperDeck.mjs');

  const weighted = applyWallpaperFamilyWeights(
    ['recent_award:1', 'class_familiar_parade', 'school_pulse'],
    { mode: 'class', holidayPhase: 'none', lessonPhase: 'main', isOffDay: false },
    (cardType) => {
      if (cardType.startsWith('recent_award:')) return { family: 'awards' };
      if (cardType === 'class_familiar_parade') return { family: 'familiars' };
      return null;
    }
  );

  assert.equal(weighted.filter((item) => item.startsWith('recent_award:')).length, 2);
  assert.equal(weighted.filter((item) => item === 'class_familiar_parade').length, 2);
  assert.equal(weighted.filter((item) => item === 'school_pulse').length, 1);
});

test('wallpaper deck weights calendar family heavily during active holidays', async () => {
  const { applyWallpaperFamilyWeights } = await import('../utils/wallpaperDeck.mjs');

  const weighted = applyWallpaperFamilyWeights(
    ['holiday', 'school_leader_top3'],
    { mode: 'school', holidayPhase: 'active', lessonPhase: 'opening', isOffDay: true },
    (cardType) => {
      if (cardType === 'holiday') return { family: 'calendar' };
      if (cardType === 'school_leader_top3') return { family: 'leaderboards' };
      return null;
    }
  );

  assert.equal(weighted.filter((item) => item === 'holiday').length, 5);
  assert.equal(weighted.filter((item) => item === 'school_leader_top3').length, 3);
});

test('wallpaper repeat guard blocks recently shown sibling cards from the same family', async () => {
  const { createWallpaperRepeatGuard } = await import('../utils/wallpaperDeck.mjs');

  const guard = createWallpaperRepeatGuard({
    getHistory: () => [{ id: 'school_leader_top3', family: 'leaderboards', time: Date.now() - 60_000 }],
    getCardCooldown: () => 0,
    getDefinition: (cardType) => {
      if (cardType === 'school_gold_leader') return { family: 'leaderboards' };
      return null;
    },
    getFamilyCooldown: (family) => family === 'leaderboards' ? 5 * 60_000 : 0
  });

  assert.equal(guard.hasBeenShownRecently('school_gold_leader'), true);
});