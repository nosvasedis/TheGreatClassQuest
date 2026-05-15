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