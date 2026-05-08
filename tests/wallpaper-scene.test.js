const test = require('node:test');
const assert = require('node:assert/strict');

test('wallpaper scene placement respects preferred zones and size tiers', async () => {
  const { getWallpaperScenePlacement } = await import('../utils/wallpaperScene.mjs');
  const placement = getWallpaperScenePlacement({
    family: 'familiars',
    sizeTier: 'feature',
    preferredZones: ['harbor-left', 'horizon-left']
  }, {
    familyCounters: { familiars: 0 }
  });

  assert.equal(placement.zoneName, 'harbor-left');
  assert.equal(placement.tierClassName, 'wallpaper-card-tier-feature');
  assert.equal(placement.style.left, '18%');
});

test('wallpaper scene placement cycles through a family zone sequence', async () => {
  const { getWallpaperScenePlacement } = await import('../utils/wallpaperScene.mjs');
  const placement = getWallpaperScenePlacement({
    family: 'calendar',
    sizeTier: 'compact',
    preferredZones: ['sky-right', 'sky-left']
  }, {
    familyCounters: { calendar: 1 }
  });

  assert.equal(placement.zoneName, 'sky-left');
  assert.equal(placement.tierClassName, 'wallpaper-card-tier-compact');
});