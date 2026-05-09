const test = require('node:test');
const assert = require('node:assert/strict');

function makeScore(date, normalizedPercent, extra = {}) {
  return {
    date,
    normalizedPercent,
    type: extra.type || 'test',
    title: extra.title || 'Assessment',
    tags: extra.tags || []
  };
}

test('calculateImprovementRate detects upward momentum', async () => {
  const { calculateImprovementRate } = await import('../utils/studentAnalytics.mjs');
  const result = calculateImprovementRate([
    makeScore('2026-01-10', 58),
    makeScore('2026-02-10', 62),
    makeScore('2026-03-10', 74),
    makeScore('2026-04-10', 81)
  ]);

  assert.equal(result.trend, 'up');
  assert.ok(result.delta > 10);
  assert.equal(result.label, 'Improving');
});

test('predictAssessmentOutcome uses low confidence for sparse history', async () => {
  const { predictAssessmentOutcome } = await import('../utils/studentAnalytics.mjs');
  const result = predictAssessmentOutcome([
    makeScore('2026-04-10', 78),
    makeScore('2026-04-24', 80)
  ], 88);

  assert.equal(result.confidence, 'low');
  assert.ok(result.predictedScore >= 70);
  assert.match(result.band, /A|B|C|D|Needs Support/);
});

test('buildSmartAlerts flags a performance drop and attendance watch', async () => {
  const { buildSmartAlerts } = await import('../utils/studentAnalytics.mjs');
  const alerts = buildSmartAlerts({
    attendanceRate: 78,
    weakTopics: [{ label: 'Grammar', average: 63 }],
    scores: [
      makeScore('2026-01-10', 87),
      makeScore('2026-02-10', 84),
      makeScore('2026-03-10', 82),
      makeScore('2026-04-10', 68),
      makeScore('2026-04-17', 66),
      makeScore('2026-04-24', 64)
    ]
  });

  assert.ok(alerts.some((alert) => alert.title === 'Attendance Watch'));
  assert.ok(alerts.some((alert) => alert.title === 'Performance Drop'));
  assert.ok(alerts.some((alert) => alert.title === 'Weak Topic Cluster'));
});

test('buildRecommendations prioritizes weak topics and attendance support', async () => {
  const { buildRecommendations } = await import('../utils/studentAnalytics.mjs');
  const recommendations = buildRecommendations({
    attendanceRate: 82,
    participationLevel: { score: 45, label: 'Low' },
    weakTopics: [{ label: 'Listening', average: 61 }],
    prediction: { predictedScore: 72 }
  });

  assert.ok(recommendations.some((item) => /Listening/.test(item.title + item.description)));
  assert.ok(recommendations.some((item) => item.type === 'attendance'));
  assert.ok(recommendations.some((item) => item.type === 'engagement'));
});

test('buildHeatmapData always returns a 12 week x 7 day grid', async () => {
  const { buildHeatmapData } = await import('../utils/studentAnalytics.mjs');
  const heatmap = buildHeatmapData([
    makeScore('2026-03-16', 84),
    makeScore('2026-03-18', 88),
    makeScore('2026-04-01', 90)
  ], [
    { date: '2026-03-19' }
  ], new Date('2026-05-01T12:00:00'));

  assert.equal(heatmap.length, 84);
  assert.ok(heatmap.some((cell) => cell.assessments > 0));
});

test('buildSubjectBreakdown compares student scores against class averages', async () => {
  const { buildSubjectBreakdown } = await import('../utils/studentAnalytics.mjs');
  const studentScores = [
    makeScore('2026-01-10', 90, { tags: ['Grammar'] }),
    makeScore('2026-02-10', 84, { tags: ['Vocabulary'] })
  ];
  const classScores = [
    makeScore('2026-01-10', 70, { tags: ['Grammar'] }),
    makeScore('2026-02-10', 78, { tags: ['Vocabulary'] }),
    makeScore('2026-02-15', 82, { tags: ['Vocabulary'] })
  ];
  const breakdown = buildSubjectBreakdown(studentScores, classScores);

  const grammar = breakdown.find((entry) => entry.label === 'Grammar');
  const vocabulary = breakdown.find((entry) => entry.label === 'Vocabulary');

  assert.equal(grammar.studentAverage, 90);
  assert.equal(grammar.classAverage, 70);
  assert.equal(vocabulary.studentAverage, 84);
  assert.equal(vocabulary.classAverage, 80);
});

test('buildAnalyticsCsv serializes metrics, history, alerts, and recommendations', async () => {
  const { buildAnalyticsCsv } = await import('../utils/studentAnalytics.mjs');
  const csv = buildAnalyticsCsv({
    student: { name: 'Ada Lovelace' },
    metrics: {
      currentGrade: 'B',
      attendancePercent: '92.0',
      averageScore: '84.5',
      improvementDelta: '7.5'
    },
    history: [{
      date: '2026-05-01',
      type: 'test',
      title: 'Grammar Sprint',
      displayScore: '17/20',
      normalizedPercent: 85,
      tags: ['Grammar']
    }],
    alerts: [{
      severity: 'medium',
      title: 'Attendance Watch',
      message: 'Attendance is trending down.'
    }],
    recommendations: [{
      type: 'practice',
      title: 'Revisit Grammar',
      description: 'Use retrieval practice.'
    }]
  });

  assert.match(csv, /Ada Lovelace/);
  assert.match(csv, /Grammar Sprint/);
  assert.match(csv, /Attendance Watch/);
  assert.match(csv, /Revisit Grammar/);
});
