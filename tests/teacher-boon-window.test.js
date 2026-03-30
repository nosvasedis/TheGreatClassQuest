const test = require('node:test');
const assert = require('node:assert/strict');

test('isTeacherBoonWindow returns true only for the last 3 days of 31-day months', async () => {
  const { isTeacherBoonWindow } = await import('../utils/teacherBoonWindow.mjs');

  assert.equal(isTeacherBoonWindow(new Date(2026, 0, 28)), false);
  assert.equal(isTeacherBoonWindow(new Date(2026, 0, 29)), true);
  assert.equal(isTeacherBoonWindow(new Date(2026, 0, 30)), true);
  assert.equal(isTeacherBoonWindow(new Date(2026, 0, 31)), true);
});

test('isTeacherBoonWindow returns true only for the last 3 days of 30-day months', async () => {
  const { isTeacherBoonWindow } = await import('../utils/teacherBoonWindow.mjs');

  assert.equal(isTeacherBoonWindow(new Date(2026, 3, 27)), false);
  assert.equal(isTeacherBoonWindow(new Date(2026, 3, 28)), true);
  assert.equal(isTeacherBoonWindow(new Date(2026, 3, 29)), true);
  assert.equal(isTeacherBoonWindow(new Date(2026, 3, 30)), true);
});

test('isTeacherBoonWindow returns true only for the last 3 days of February in common and leap years', async () => {
  const { isTeacherBoonWindow } = await import('../utils/teacherBoonWindow.mjs');

  assert.equal(isTeacherBoonWindow(new Date(2026, 1, 25)), false);
  assert.equal(isTeacherBoonWindow(new Date(2026, 1, 26)), true);
  assert.equal(isTeacherBoonWindow(new Date(2026, 1, 27)), true);
  assert.equal(isTeacherBoonWindow(new Date(2026, 1, 28)), true);

  assert.equal(isTeacherBoonWindow(new Date(2028, 1, 26)), false);
  assert.equal(isTeacherBoonWindow(new Date(2028, 1, 27)), true);
  assert.equal(isTeacherBoonWindow(new Date(2028, 1, 28)), true);
  assert.equal(isTeacherBoonWindow(new Date(2028, 1, 29)), true);
});
