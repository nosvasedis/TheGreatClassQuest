const test = require('node:test');
const assert = require('node:assert/strict');

test('wallpaper registry resolves exact family definitions with scene metadata', async () => {
  const { createWallpaperCardRegistry } = await import('../utils/wallpaperCardRegistry.mjs');
  const registry = createWallpaperCardRegistry({
    getNextHolidayCard: () => ({ html: '<div>holiday</div>', css: 'float-card-blue' })
  });

  const card = await registry.hydrate('holiday', {});

  assert.equal(card.family, 'calendar');
  assert.equal(card.sizeTier, 'feature');
  assert.deepEqual(card.preferredZones, ['sky-right', 'sky-left']);
});

test('wallpaper registry resolves prefixed award cards using data ids', async () => {
  const { createWallpaperCardRegistry } = await import('../utils/wallpaperCardRegistry.mjs');
  const registry = createWallpaperCardRegistry({
    getRecentAwardCard: (classId, logId) => ({ html: `<div>${classId}:${logId}</div>`, css: 'float-card-purple' })
  });

  const card = await registry.hydrate('recent_award:log-1', { classId: 'class-a' });

  assert.equal(card.family, 'awards');
  assert.equal(card.sizeTier, 'feature');
  assert.match(card.html, /class-a:log-1/);
});