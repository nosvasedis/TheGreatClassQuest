const test = require('node:test');
const assert = require('node:assert/strict');

test('isTeacherBoonWindow returns true for the last 7 days of 31-day months', async () => {
  const { isTeacherBoonWindow } = await import('../utils/teacherBoonWindow.mjs');

  assert.equal(isTeacherBoonWindow(new Date(2026, 0, 24)), false);
  assert.equal(isTeacherBoonWindow(new Date(2026, 0, 25)), true);
  assert.equal(isTeacherBoonWindow(new Date(2026, 0, 26)), true);
  assert.equal(isTeacherBoonWindow(new Date(2026, 0, 31)), true);
});

test('isTeacherBoonWindow returns true for the last 7 days of 30-day months', async () => {
  const { isTeacherBoonWindow } = await import('../utils/teacherBoonWindow.mjs');

  assert.equal(isTeacherBoonWindow(new Date(2026, 3, 23)), false);
  assert.equal(isTeacherBoonWindow(new Date(2026, 3, 24)), true);
  assert.equal(isTeacherBoonWindow(new Date(2026, 3, 25)), true);
  assert.equal(isTeacherBoonWindow(new Date(2026, 3, 30)), true);
});

test('isTeacherBoonWindow returns true for the last 7 days of February in common and leap years', async () => {
  const { isTeacherBoonWindow } = await import('../utils/teacherBoonWindow.mjs');

  assert.equal(isTeacherBoonWindow(new Date(2026, 1, 21)), false);
  assert.equal(isTeacherBoonWindow(new Date(2026, 1, 22)), true);
  assert.equal(isTeacherBoonWindow(new Date(2026, 1, 27)), true);
  assert.equal(isTeacherBoonWindow(new Date(2026, 1, 28)), true);

  assert.equal(isTeacherBoonWindow(new Date(2028, 1, 22)), false);
  assert.equal(isTeacherBoonWindow(new Date(2028, 1, 23)), true);
  assert.equal(isTeacherBoonWindow(new Date(2028, 1, 28)), true);
  assert.equal(isTeacherBoonWindow(new Date(2028, 1, 29)), true);
});
