const test = require('node:test');
const assert = require('node:assert/strict');

global.localStorage = global.localStorage || {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

test('early leagues exist as Nursery and Pre-Junior', async () => {
  const constants = await import('../constants.js');
  assert.deepEqual(constants.EARLY_LEAGUES, ['Nursery', 'Pre-Junior']);
});

test('unsaved assessment defaults turn tests and dictations off for Nursery and Pre-Junior', async () => {
  const { normalizeAssessmentDefaultsByLeague } = await import('../features/assessmentConfig.js');
  const defaults = normalizeAssessmentDefaultsByLeague({});
  assert.equal(defaults.Nursery.tests.mode, 'none');
  assert.equal(defaults.Nursery.dictations.mode, 'none');
  assert.equal(defaults['Pre-Junior'].tests.mode, 'none');
  assert.equal(defaults['Pre-Junior'].dictations.mode, 'none');
  assert.equal(defaults['Junior A'].tests.mode, 'numeric');
  assert.equal(defaults['Junior A'].tests.maxScore, 40);
  assert.equal(defaults['Junior A'].dictations.mode, 'qualitative');
  assert.equal(defaults.Proficiency.tests.mode, 'numeric');
  assert.equal(defaults.Proficiency.tests.maxScore, 100);
});

test('none mode is preserved and keeps the previous scale for later restore', async () => {
  const { normalizeAssessmentScheme } = await import('../features/assessmentConfig.js');
  const scheme = normalizeAssessmentScheme(
    { mode: 'none', maxScore: 20, scale: [{ id: 'great', label: 'Great', normalizedPercent: 100 }] },
    { mode: 'numeric', maxScore: 40 }
  );
  assert.equal(scheme.mode, 'none');
  assert.equal(scheme.maxScore, 20);
  assert.equal(scheme.scale[0].label, 'Great');
});

test('forceEarlyLeagueNone overlays saved Nursery tests until migration is complete', async () => {
  const { normalizeAssessmentDefaultsByLeague } = await import('../features/assessmentConfig.js');
  const saved = {
    Nursery: {
      tests: { mode: 'numeric', maxScore: 40 },
      dictations: { mode: 'qualitative', scale: [{ label: 'Great', normalizedPercent: 100 }] }
    }
  };
  const forced = normalizeAssessmentDefaultsByLeague(saved, { forceEarlyLeagueNone: true });
  assert.equal(forced.Nursery.tests.mode, 'none');
  assert.equal(forced.Nursery.tests.maxScore, 40);
  assert.equal(forced.Nursery.dictations.mode, 'none');

  const afterMigration = normalizeAssessmentDefaultsByLeague(saved, { forceEarlyLeagueNone: false });
  assert.equal(afterMigration.Nursery.tests.mode, 'numeric');
  assert.equal(afterMigration.Nursery.tests.maxScore, 40);
});

test('class overrides for early leagues are forced off until the none-migration flag is set', async () => {
  const { resolveAssessmentConfig, classUsesTests, classUsesDictations, classUsesAnyAssessments } = await import('../features/assessmentConfig.js');
  const schoolDefaults = {
    Nursery: {
      tests: { mode: 'numeric', maxScore: 40 },
      dictations: { mode: 'numeric', maxScore: 20 }
    }
  };
  const classData = {
    questLevel: 'Nursery',
    assessmentConfig: {
      inheritSchoolDefaults: false,
      tests: { mode: 'numeric', maxScore: 20 },
      dictations: { mode: 'numeric', maxScore: 10 }
    }
  };

  const overlay = resolveAssessmentConfig(classData, schoolDefaults, { earlyLeagueNoneMigrationComplete: false });
  assert.equal(overlay.tests.mode, 'none');
  assert.equal(overlay.dictations.mode, 'none');
  assert.equal(classUsesTests(classData, schoolDefaults, { earlyLeagueNoneMigrationComplete: false }), false);
  assert.equal(classUsesDictations(classData, schoolDefaults, { earlyLeagueNoneMigrationComplete: false }), false);
  assert.equal(classUsesAnyAssessments(classData, schoolDefaults, { earlyLeagueNoneMigrationComplete: false }), false);

  const after = resolveAssessmentConfig(classData, schoolDefaults, { earlyLeagueNoneMigrationComplete: true });
  assert.equal(after.tests.mode, 'numeric');
  assert.equal(after.tests.maxScore, 20);
  assert.equal(classUsesTests(classData, schoolDefaults, { earlyLeagueNoneMigrationComplete: true }), true);
});

test('describeAssessmentScheme labels none as Not used', async () => {
  const { describeAssessmentScheme } = await import('../features/assessmentConfig.js');
  assert.equal(describeAssessmentScheme({ mode: 'none' }), 'Not used');
});

test('weighted average ignores a disabled type and is null when both are unused', async () => {
  const { getWeightedAcademicAverage } = await import('../features/assessmentConfig.js');
  const classData = {
    questLevel: 'A',
    assessmentConfig: {
      inheritSchoolDefaults: false,
      tests: { mode: 'none' },
      dictations: { mode: 'numeric', maxScore: 100 }
    }
  };
  const schoolDefaults = {
    A: {
      tests: { mode: 'numeric', maxScore: 100 },
      dictations: { mode: 'numeric', maxScore: 100 }
    }
  };
  const avg = getWeightedAcademicAverage(
    [{ type: 'test', scoreNumeric: 100, maxScore: 100, gradingSnapshot: { mode: 'numeric', maxScore: 100 } }],
    [{ type: 'dictation', scoreNumeric: 50, maxScore: 100, gradingSnapshot: { mode: 'numeric', maxScore: 100 } }],
    classData,
    schoolDefaults,
    { earlyLeagueNoneMigrationComplete: true }
  );
  assert.equal(avg, 50);

  const noneClass = {
    questLevel: 'Nursery',
    assessmentConfig: {
      inheritSchoolDefaults: false,
      tests: { mode: 'none' },
      dictations: { mode: 'none' }
    }
  };
  const noneAvg = getWeightedAcademicAverage(
    [{ type: 'test', scoreNumeric: 100, maxScore: 40, gradingSnapshot: { mode: 'numeric', maxScore: 40 } }],
    [{ type: 'dictation', scoreNumeric: 100, maxScore: 100, gradingSnapshot: { mode: 'numeric', maxScore: 100 } }],
    noneClass,
    { Nursery: { tests: { mode: 'none' }, dictations: { mode: 'none' } } },
    { earlyLeagueNoneMigrationComplete: true }
  );
  assert.equal(noneAvg, null);
});

test('createAssessmentScorePayload refuses a disabled assessment type', async () => {
  const { createAssessmentScorePayload } = await import('../features/assessmentConfig.js');
  const classData = {
    id: 'class-1',
    questLevel: 'Nursery',
    assessmentConfig: {
      inheritSchoolDefaults: false,
      tests: { mode: 'none' },
      dictations: { mode: 'none' }
    }
  };
  assert.throws(() => createAssessmentScorePayload({
    studentId: 's1',
    classId: 'class-1',
    type: 'test',
    title: 'Unit 1',
    teacherId: 't1',
    date: '2026-08-30',
    value: 10,
    classData,
    schoolDefaults: { Nursery: { tests: { mode: 'none' }, dictations: { mode: 'none' } } },
    earlyLeagueNoneMigrationComplete: true
  }), /does not use/i);
});

test('scheduled test status is omitted when the class does not use tests', async () => {
  const { getScheduledAssessmentStatus } = await import('../features/assessmentConfig.js');
  const assignment = {
    classId: 'class-1',
    testData: { date: '2099-01-15', title: 'Unit 1' }
  };
  const classData = {
    id: 'class-1',
    questLevel: 'Nursery',
    timeStart: '10:00',
    timeEnd: '11:00',
    assessmentConfig: {
      inheritSchoolDefaults: false,
      tests: { mode: 'none' },
      dictations: { mode: 'none' }
    }
  };
  const status = getScheduledAssessmentStatus(assignment, {
    classData,
    schoolDefaults: { Nursery: { tests: { mode: 'none' }, dictations: { mode: 'none' } } },
    earlyLeagueNoneMigrationComplete: true
  });
  assert.equal(status, null);
});

test('assessment editor offers Not used for tests and dictations', async () => {
  const { getAssessmentConfigCardHtml } = await import('../ui/assessmentEditor.js');
  const html = getAssessmentConfigCardHtml(
    { tests: { mode: 'none' }, dictations: { mode: 'none' } },
    'league-Nursery',
    { questLevel: 'Nursery', title: 'Nursery defaults' }
  );
  assert.match(html, /value="none"/);
  assert.match(html, /Not used/);
  assert.match(html, /assessment-none-panel/);
});

test('teacher, secretary, quest, and parent surfaces gate tests and dictations', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(read('features/scholarScroll.js'), /This class does not use tests or dictations/);
  assert.match(read('ui/modals/student.js'), /applyQuestTestSchedulingVisibility/);
  assert.match(read('db/actions/quests.js'), /classUsesTests\(classData\)/);
  assert.match(read('features/parent/home.js'), /snapshotAssessmentUses/);
  assert.match(read('features/parent/progress.js'), /This class does not record tests or dictations/);
  assert.match(read('features/secretaryConsole.js'), /ASSESSMENT_NONE_MIGRATION_KEY/);
  assert.match(read('functions/index.js'), /assessmentUses/);
  assert.match(read('utils/calendarDay.js'), /classUsesTests\(c\)/);
});
