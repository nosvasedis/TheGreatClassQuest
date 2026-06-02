const test = require('node:test');
const assert = require('node:assert/strict');

async function loadModule() {
  return import('../utils.js');
}

test('findCurrentLessonClass matches unpadded lesson times', async () => {
  const { findCurrentLessonClass, isClassWindowActiveAt } = await loadModule();
  const now = new Date('2026-05-14T09:15:00');
  const classes = [
    { id: 'alpha', timeStart: '9:00', timeEnd: '10:00' },
    { id: 'beta', timeStart: '10:30', timeEnd: '11:30' },
  ];

  assert.equal(isClassWindowActiveAt('9:00', '10:00', now), true);
  assert.equal(findCurrentLessonClass(classes, now)?.id, 'alpha');
});

test('findCurrentLessonClass accepts flexible legacy time formats', async () => {
  const { findCurrentLessonClass, isClassWindowActiveAt } = await loadModule();
  const now = new Date('2026-05-14T09:15:00');
  const classes = [
    { id: 'dot', timeStart: '9.5', timeEnd: '10.0' },
    { id: 'seconds', timeStart: '09:00:00', timeEnd: '10:00:00' },
    { id: 'ampm', timeStart: '9:00am', timeEnd: '10:00am' },
  ];

  assert.equal(isClassWindowActiveAt('9.5', '10.0', now), true);
  assert.equal(isClassWindowActiveAt('09:00:00', '10:00:00', now), true);
  assert.equal(isClassWindowActiveAt('9:00am', '10:00am', now), true);
  assert.equal(findCurrentLessonClass(classes, now)?.id, 'dot');
});