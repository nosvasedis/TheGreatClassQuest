const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../utils/dayCycle.mjs');
const at = (hour, minute = 0, day = 15) => new Date(2026, 8, day, hour, minute, 0, 0).getTime();

test('the dial puts noon at the top and midnight at the bottom', async () => {
  const { dialAngle } = await load();
  assert.equal(dialAngle(at(12)), 0);
  assert.equal(dialAngle(at(18)), 90);
  assert.equal(dialAngle(at(0)), 180);
  assert.equal(dialAngle(at(6)), 270);
});

test('the light span follows real sunrise and sunset, across midnight too', async () => {
  const { currentLightSpan } = await load();
  const rise = at(7, 0);
  const set = at(19, 0);
  const noon = currentLightSpan(at(13, 0), rise, set);
  assert.equal(noon.isDay, true);
  assert.equal(noon.progress, 0.5);

  const evening = currentLightSpan(at(21, 0), rise, set);
  assert.equal(evening.isDay, false);
  assert.equal(evening.start, set);
  assert.equal(evening.end, at(7, 0, 16));

  const beforeDawn = currentLightSpan(at(4, 0), rise, set);
  assert.equal(beforeDawn.isDay, false);
  assert.equal(beforeDawn.start, at(19, 0, 14));
  assert.equal(beforeDawn.end, rise);
  assert.ok(beforeDawn.progress > 0.7 && beforeDawn.progress < 0.8);
});

test('moon phase matches known moons', async () => {
  const { moonPhase, moonPhaseName } = await load();
  // Full moon 2026-09-26, new moon 2026-10-10 (UTC).
  assert.equal(moonPhaseName(moonPhase(Date.UTC(2026, 8, 26, 17))), 'Full moon');
  assert.equal(moonPhaseName(moonPhase(Date.UTC(2026, 9, 10, 12))), 'New moon');
});

test('moon path lights the right side while waxing and the left while waning', async () => {
  const { moonLitPath } = await load();
  assert.equal(moonLitPath(0, 10), '');
  assert.match(moonLitPath(0.25, 10), /A 10 10 0 0 1 0 10/);
  assert.match(moonLitPath(0.75, 10), /A 10 10 0 0 0 0 10/);
});
