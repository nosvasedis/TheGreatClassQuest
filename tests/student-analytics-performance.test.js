const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

function buildScore(index, topic) {
  const month = (index % 12) + 1;
  const day = String((index % 28) + 1).padStart(2, '0');
  return {
    date: `2026-${String(month).padStart(2, '0')}-${day}`,
    normalizedPercent: 55 + (index % 45),
    type: index % 3 === 0 ? 'dictation' : 'test',
    title: `${topic} Check ${index}`,
    tags: [topic]
  };
}

test('student analytics helpers stay fast on large synthetic datasets', async () => {
  const {
    buildHeatmapData,
    buildRollingTrend,
    buildSubjectBreakdown,
    extractTopicWeaknesses,
    predictAssessmentOutcome
  } = await import('../utils/studentAnalytics.mjs');

  const topics = ['Grammar', 'Vocabulary', 'Listening', 'Reading', 'Writing'];
  const studentScores = Array.from({ length: 1500 }, (_, index) => buildScore(index, topics[index % topics.length]));
  const classScores = Array.from({ length: 4000 }, (_, index) => buildScore(index, topics[(index + 2) % topics.length]));
  const attendance = Array.from({ length: 180 }, (_, index) => ({
    date: `2026-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`
  }));

  const startedAt = performance.now();
  const trend = buildRollingTrend(studentScores, 6, new Date('2026-12-15T12:00:00'));
  const heatmap = buildHeatmapData(studentScores, attendance, new Date('2026-12-15T12:00:00'));
  const subjectBreakdown = buildSubjectBreakdown(studentScores, classScores);
  const weakTopics = extractTopicWeaknesses(studentScores, 4);
  const prediction = predictAssessmentOutcome(studentScores, 91);
  const elapsed = performance.now() - startedAt;

  assert.equal(trend.length, 6);
  assert.equal(heatmap.length, 84);
  assert.ok(subjectBreakdown.length > 0);
  assert.ok(weakTopics.length > 0);
  assert.ok(prediction.predictedScore !== null);
  assert.ok(elapsed < 500, `Expected analytics helpers to finish under 500ms, got ${elapsed.toFixed(2)}ms`);
});
