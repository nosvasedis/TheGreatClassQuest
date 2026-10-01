const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function loadModule() {
  return import('../utils.js');
}

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

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

test('follow schedule returns General when no lesson is in session', async () => {
  const { resolveFollowScheduleClassId } = await loadModule();
  assert.equal(resolveFollowScheduleClassId(true, null, 'pinned-class'), null);
  assert.equal(resolveFollowScheduleClassId(true, undefined, 'pinned-class'), null);
});

test('follow schedule switches to the class in session', async () => {
  const { resolveFollowScheduleClassId } = await loadModule();
  assert.equal(resolveFollowScheduleClassId(true, { id: 'alpha' }, 'pinned-class'), 'alpha');
  assert.equal(resolveFollowScheduleClassId(true, { id: 'alpha' }, 'alpha'), 'alpha');
});

test('a pinned class stays selected when follow schedule is off', async () => {
  const { resolveFollowScheduleClassId } = await loadModule();
  assert.equal(resolveFollowScheduleClassId(false, null, 'pinned-class'), 'pinned-class');
  assert.equal(resolveFollowScheduleClassId(false, { id: 'alpha' }, 'pinned-class'), 'pinned-class');
});

test('teacher sessions always start in follow today\'s schedule mode', () => {
  const stateSrc = read('state.js');
  assert.match(stateSrc, /classFollowSchedule:\s*true/);
  assert.doesNotMatch(stateSrc, /quest_class_follow_schedule/);
});

test('home schedule sync applies the follow-schedule target including General', () => {
  const home = read('features/home.js');
  assert.match(home, /resolveFollowScheduleClassId/);
  assert.match(home, /setGlobalSelectedClass\(nextId/);
});
test('a finished lesson stays selected for 15 minutes, then General', async () => {
  const { findLessonClassWithGrace, resolveFollowScheduleClassId } = await loadModule();
  const classes = [{ id: 'alpha', timeStart: '9:00', timeEnd: '9:45' }];
  const at = (h, m) => { const d = new Date(2026, 9, 1, h, m); return d; };
  assert.equal(findLessonClassWithGrace(classes, at(9, 45))?.id, 'alpha');
  assert.equal(findLessonClassWithGrace(classes, at(9, 50))?.id, 'alpha');
  assert.equal(findLessonClassWithGrace(classes, at(10, 0))?.id, 'alpha');
  assert.equal(findLessonClassWithGrace(classes, at(10, 1)), null);
  assert.equal(resolveFollowScheduleClassId(true, findLessonClassWithGrace(classes, at(10, 1)), 'alpha'), null);
});

test('a lesson starting during the grace window takes over at once', async () => {
  const { findLessonClassWithGrace } = await loadModule();
  const classes = [
    { id: 'alpha', timeStart: '9:00', timeEnd: '9:45' },
    { id: 'beta', timeStart: '9:50', timeEnd: '10:35' },
  ];
  assert.equal(findLessonClassWithGrace(classes, new Date(2026, 9, 1, 9, 48))?.id, 'alpha');
  assert.equal(findLessonClassWithGrace(classes, new Date(2026, 9, 1, 9, 50))?.id, 'beta');
});

test('every follow-schedule selector uses the grace window', () => {
  for (const file of ['features/home.js', 'ui/tabs/selectors.js', 'ui/core/misc.js', 'state.js']) {
    assert.match(read(file), /findLessonClassWithGrace/, file);
  }
});
