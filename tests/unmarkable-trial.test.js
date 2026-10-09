const test = require('node:test');
const assert = require('node:assert/strict');

global.localStorage = global.localStorage || {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const config = () => import('../features/assessmentConfig.js');
const sheet = () => import('../features/trialLogCore.mjs');

const SCHOOL = {
  A: {
    tests: { mode: 'numeric', maxScore: 40 },
    dictations: { mode: 'qualitative', scale: [{ id: 'g', label: 'Great!', normalizedPercent: 100 }, { id: 'n', label: 'Nice Try!', normalizedPercent: 25 }] }
  }
};
const CLASS = { id: 'c1', questLevel: 'A', assessmentConfig: { inheritSchoolDefaults: true } };
const base = { studentId: 's1', classId: 'c1', teacherId: 't1', date: '2026-10-09', classData: CLASS, schoolDefaults: SCHOOL, earlyLeagueNoneMigrationComplete: true };

test('"?" is saved as its own state with no score, for dictations and tests alike', async () => {
  const { createAssessmentScorePayload } = await config();
  for (const type of ['dictation', 'test']) {
    const p = createAssessmentScorePayload({ ...base, type, title: 'Unit 1', value: '?' });
    assert.equal(p.unmarkable, true);
    assert.equal(p.scoreNumeric, null);
    assert.equal(p.scoreQualitative, null);
    assert.equal(p.normalizedPercent, null);
    assert.ok(p.gradingSnapshot, 'keeps the grading snapshot');
  }
});

test('a real mark clears the unmarkable flag, so editing a "?" into a grade sticks', async () => {
  const { createAssessmentScorePayload } = await config();
  const t = createAssessmentScorePayload({ ...base, type: 'test', title: 'Unit 1', value: '30' });
  assert.equal(t.unmarkable, false);
  assert.equal(t.normalizedPercent, 75);
  const d = createAssessmentScorePayload({ ...base, type: 'dictation', value: 'Nice Try!' });
  assert.equal(d.unmarkable, false);
  assert.equal(d.scoreQualitative, 'Nice Try!');
});

test('a numeric score that is not a number is refused instead of being saved as NaN', async () => {
  const { createAssessmentScorePayload } = await config();
  assert.throws(() => createAssessmentScorePayload({ ...base, type: 'test', title: 'x', value: 'abc' }));
});

test('"?" reads back as "?" and never as a percent, so averages and high scores skip it', async () => {
  const { getNormalizedPercentForScore, getAssessmentValueLabel, getAssessmentAverage, qualifiesForHighScore, getQualitativeDistribution } = await config();
  const unmarked = { type: 'dictation', unmarkable: true, scoreNumeric: null, scoreQualitative: null, normalizedPercent: null, gradingSnapshot: { mode: 'qualitative', scale: SCHOOL.A.dictations.scale } };
  const graded = { type: 'dictation', unmarkable: false, scoreQualitative: 'Great!', normalizedPercent: 100, gradingSnapshot: unmarked.gradingSnapshot };
  assert.equal(getNormalizedPercentForScore(unmarked), null);
  assert.equal(getAssessmentValueLabel(unmarked), '?');
  assert.equal(getAssessmentAverage([unmarked, graded]), 100);
  assert.equal(qualifiesForHighScore(unmarked, 'dictation'), false);
  assert.deepEqual(getQualitativeDistribution([unmarked, graded]), { 'Great!': 1 });
});

test('the hero tie-break academic average ignores "?" instead of counting it as zero', async () => {
  const { buildHeroTieStats } = await import('../features/heroRanking.js');
  const { getNormalizedPercentForScore } = await config();
  const stats = buildHeroTieStats([], [
    { unmarkable: true, normalizedPercent: null, gradingSnapshot: { mode: 'numeric', maxScore: 40 } },
    { unmarkable: false, normalizedPercent: 80, gradingSnapshot: { mode: 'numeric', maxScore: 40 } }
  ], getNormalizedPercentForScore);
  assert.equal(stats.academicAvg, 80);
});

test('the marking sheet draws "?" for both grading kinds and counts it as marked', async () => {
  const m = await sheet();
  const numeric = m.trialRowHtml({ student: { id: 's1', name: 'Alex' }, scheme: { mode: 'numeric', maxScore: 40 }, value: '?' });
  assert.match(numeric, /is-unmarkable/);
  assert.match(numeric, /class="tl-unmark active"/);
  assert.match(numeric, /placeholder="\?"/);
  assert.match(numeric, /value=""/);
  const qual = m.trialRowHtml({ student: { id: 's2', name: 'Eva' }, scheme: { mode: 'qualitative', scale: SCHOOL.A.dictations.scale }, value: '?' });
  assert.match(qual, /is-unmarkable/);
  assert.match(qual, /class="bulk-grade-input" value="\?"/);
  assert.doesNotMatch(qual, /tl-stamp[^"]*active/);
  const absent = m.trialRowHtml({ student: { id: 's3', name: 'Nikos' }, scheme: { mode: 'numeric', maxScore: 40 }, isAbsent: true, value: '?' });
  assert.doesNotMatch(absent, /is-unmarkable/);

  assert.equal(m.trialRowValue({ unmarkable: true, value: '' }), '?');
  assert.equal(m.trialRowValue({ unmarkable: false, value: '12' }), '12');
  const tally = m.trialTally([{ absent: false, value: '?' }, { absent: false, value: '12' }, { absent: true, value: '' }]);
  assert.deepEqual(tally, { graded: 2, unmarkable: 1, absent: 1, present: 2, total: 3 });
  assert.equal(m.trialTallyText(tally), '2 of 2 marked · 1 unmarkable · 1 absent');
});

test('reports, certificates and the roster chart never turn "?" into 0%', async () => {
  const report = await import('../features/weeklyReportCore.mjs');
  const roster = await import('../features/classRosterCore.mjs');
  const series = roster.buildTrialSeries(
    [{ type: 'test', date: '2026-10-01', unmarkable: true }, { type: 'test', date: '2026-10-02' }],
    { percentFor: (s) => (s.unmarkable ? null : 90), dateOf: (s) => new Date(s.date) }
  );
  assert.deepEqual(series.tests, [null, 90]);
  assert.equal(roster.pickBestTest([{ type: 'test', unmarkable: true }], () => null), null);
  assert.equal(typeof report.buildWeeklyReportModel, 'function');
});
