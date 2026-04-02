const test = require('node:test');
const assert = require('node:assert/strict');

function buildClass(scheduleDays, extra = {}) {
  return {
    id: 'class-1',
    name: 'Test Class',
    timeStart: '10:00',
    timeEnd: '11:00',
    scheduleDays,
    ...extra,
  };
}

async function loadModule() {
  return import('../utils/fortuneWheelEligibility.mjs');
}

test('Monday and Friday classes can spin only during the Friday lesson', async () => {
  const { evaluateWheelAvailability } = await loadModule();
  const allSchoolClasses = [buildClass(['1', '5'])];

  const monday = evaluateWheelAvailability('class-1', {
    now: new Date('2026-04-06T10:30:00'),
    allSchoolClasses,
  });
  const friday = evaluateWheelAvailability('class-1', {
    now: new Date('2026-04-10T10:30:00'),
    allSchoolClasses,
  });

  assert.equal(monday.allowed, false);
  assert.equal(monday.code, 'wrong_day');
  assert.equal(friday.allowed, true);
  assert.equal(friday.code, 'ready');
});

test('Tuesday and Thursday classes can spin only during the Thursday lesson', async () => {
  const { evaluateWheelAvailability } = await loadModule();
  const allSchoolClasses = [buildClass(['2', '4'])];

  const tuesday = evaluateWheelAvailability('class-1', {
    now: new Date('2026-04-07T10:30:00'),
    allSchoolClasses,
  });
  const thursday = evaluateWheelAvailability('class-1', {
    now: new Date('2026-04-09T10:30:00'),
    allSchoolClasses,
  });

  assert.equal(tuesday.allowed, false);
  assert.equal(tuesday.code, 'wrong_day');
  assert.equal(thursday.allowed, true);
  assert.equal(thursday.code, 'ready');
});

test('single weekly lesson class can spin only during that lesson', async () => {
  const { evaluateWheelAvailability } = await loadModule();
  const allSchoolClasses = [buildClass(['3'])];

  const duringLesson = evaluateWheelAvailability('class-1', {
    now: new Date('2026-04-08T10:15:00'),
    allSchoolClasses,
  });
  const afterLesson = evaluateWheelAvailability('class-1', {
    now: new Date('2026-04-08T11:30:00'),
    allSchoolClasses,
  });

  assert.equal(duringLesson.allowed, true);
  assert.equal(afterLesson.allowed, false);
  assert.equal(afterLesson.code, 'outside_lesson');
});

test('cancelling the scheduled final lesson shifts eligibility to the earlier actual final lesson', async () => {
  const { evaluateWheelAvailability } = await loadModule();
  const allSchoolClasses = [buildClass(['1', '5'])];
  const allScheduleOverrides = [
    { classId: 'class-1', type: 'cancelled', date: '10-04-2026' },
  ];

  const monday = evaluateWheelAvailability('class-1', {
    now: new Date('2026-04-06T10:30:00'),
    allSchoolClasses,
    allScheduleOverrides,
  });

  assert.equal(monday.allowed, true);
  assert.equal(monday.code, 'ready');
});

test('a one-time Friday lesson becomes the final lesson window', async () => {
  const { evaluateWheelAvailability } = await loadModule();
  const allSchoolClasses = [buildClass(['2'])];
  const allScheduleOverrides = [
    { classId: 'class-1', type: 'one-time', date: '10-04-2026' },
  ];

  const friday = evaluateWheelAvailability('class-1', {
    now: new Date('2026-04-10T10:30:00'),
    allSchoolClasses,
    allScheduleOverrides,
  });

  assert.equal(friday.allowed, true);
  assert.equal(friday.code, 'ready');
});

test('holiday on the usual final lesson day shifts eligibility to the actual last meeting day', async () => {
  const { evaluateWheelAvailability } = await loadModule();
  const allSchoolClasses = [buildClass(['2', '4'])];
  const schoolHolidayRanges = [
    { start: '2026-04-09', end: '2026-04-09' },
  ];

  const tuesday = evaluateWheelAvailability('class-1', {
    now: new Date('2026-04-07T10:30:00'),
    allSchoolClasses,
    schoolHolidayRanges,
  });

  assert.equal(tuesday.allowed, true);
  assert.equal(tuesday.code, 'ready');
});

test('outside lesson time on the correct day keeps the modal locked', async () => {
  const { evaluateWheelAvailability } = await loadModule();
  const allSchoolClasses = [buildClass(['5'])];

  const beforeLesson = evaluateWheelAvailability('class-1', {
    now: new Date('2026-04-10T09:15:00'),
    allSchoolClasses,
  });

  assert.equal(beforeLesson.allowed, false);
  assert.equal(beforeLesson.code, 'outside_lesson');
});

test('already spun classes stay locked even during the correct lesson window', async () => {
  const { evaluateWheelAvailability } = await loadModule();
  const allSchoolClasses = [buildClass(['5'])];

  const result = evaluateWheelAvailability('class-1', {
    now: new Date('2026-04-10T10:30:00'),
    allSchoolClasses,
    alreadySpun: true,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, 'already_spun');
});
