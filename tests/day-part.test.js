const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

async function loadDayPart() {
  return import('../utils/dayPart.mjs');
}

const at = (hour, minute = 0) => new Date(2026, 0, 15, hour, minute, 0, 0).getTime();
const SUNRISE = at(7, 0);
const SUNSET = at(17, 30);

test('night is after sunset or before sunrise', async () => {
  const { isNightTime } = await loadDayPart();

  assert.equal(isNightTime(at(6, 59), SUNRISE, SUNSET), true);
  assert.equal(isNightTime(at(7, 0), SUNRISE, SUNSET), false);
  assert.equal(isNightTime(at(12, 0), SUNRISE, SUNSET), false);
  assert.equal(isNightTime(at(17, 29), SUNRISE, SUNSET), false);
  assert.equal(isNightTime(at(17, 30), SUNRISE, SUNSET), true);
  assert.equal(isNightTime(at(23, 0), SUNRISE, SUNSET), true);
  assert.equal(isNightTime(at(0, 30), SUNRISE, SUNSET), true);
});

test('the greeting day part uses the same night rule as the weather card', async () => {
  const { resolveDayPart, isNightTime } = await loadDayPart();

  // Reported bug: at 05:30 the greeting said "Good Morning" while the card said night.
  assert.equal(resolveDayPart(at(5, 30), SUNRISE, SUNSET), 'night');
  assert.equal(resolveDayPart(at(6, 0), SUNRISE, SUNSET), 'night');
  assert.equal(resolveDayPart(at(8, 0), SUNRISE, SUNSET), 'morning');
  assert.equal(resolveDayPart(at(13, 0), SUNRISE, SUNSET), 'afternoon');
  assert.equal(resolveDayPart(at(17, 0), SUNRISE, SUNSET), 'evening');
  assert.equal(resolveDayPart(at(18, 0), SUNRISE, SUNSET), 'night');

  for (let hour = 0; hour < 24; hour++) {
    const time = at(hour, 15);
    assert.equal(
      resolveDayPart(time, SUNRISE, SUNSET) === 'night',
      isNightTime(time, SUNRISE, SUNSET),
      `hour ${hour}`
    );
  }
});

test('greeting and gradient resolve for every day part', async () => {
  const { greetingForDayPart, gradientForDayPart } = await loadDayPart();

  assert.equal(greetingForDayPart('morning'), 'Good Morning');
  assert.equal(greetingForDayPart('afternoon'), 'Good Afternoon');
  assert.equal(greetingForDayPart('evening'), 'Good Evening');
  assert.equal(greetingForDayPart('night'), 'Good Night');
  assert.match(gradientForDayPart('night'), /from-indigo-900/);
});

test('home, mobile, and utils consume the shared day part module', () => {
  const home = read('features/home.js');
  const mobile = read('mobile/home.js');
  const utils = read('utils.js');

  assert.match(home, /utils\.getCurrentDayPart\(\)/);
  assert.match(mobile, /utils\.getCurrentDayPart\(\)/);
  assert.match(utils, /from '\.\/utils\/dayPart\.mjs'/);
  assert.match(utils, /isNightTime\(nowTime, sunrise, sunset\)/);

  // The old clock-hour greeting must be gone from both home surfaces.
  assert.doesNotMatch(home, /timeGreeting/);
  assert.doesNotMatch(mobile, /hour >= 5 && hour < 12/);
});
