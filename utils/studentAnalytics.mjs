const DAY_MS = 86400000;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function parseAnalyticsDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('-').map(Number);
    const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  return `${MONTH_NAMES[(month || 1) - 1]} ${year}`;
}

function average(values = []) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildLinearSlope(values = []) {
  const valid = values.filter((value) => Number.isFinite(value));
  const n = valid.length;
  if (n < 2) return 0;
  const sumX = ((n - 1) * n) / 2;
  const sumY = valid.reduce((sum, value) => sum + value, 0);
  const sumXY = valid.reduce((sum, value, index) => sum + (index * value), 0);
  const sumXX = valid.reduce((sum, _value, index) => sum + (index * index), 0);
  const denominator = (n * sumXX) - (sumX * sumX);
  if (!denominator) return 0;
  return ((n * sumXY) - (sumX * sumY)) / denominator;
}

function cleanTag(tag) {
  return String(tag || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenizeTopicText(text) {
  return String(text || '')
    .split(/[,/|]| and | & |:/i)
    .map((part) => cleanTag(part))
    .filter(Boolean);
}

export function getScoreTopicTags(score = {}) {
  const explicitTags = Array.isArray(score.tags) ? score.tags.map(cleanTag).filter(Boolean) : [];
  if (explicitTags.length) return explicitTags;

  const merged = [
    ...tokenizeTopicText(score.topic),
    ...tokenizeTopicText(score.curriculum),
    ...tokenizeTopicText(score.title),
    ...tokenizeTopicText(score.notes)
  ];

  const unique = [];
  const seen = new Set();
  merged.forEach((tag) => {
    const normalized = tag.toLowerCase();
    if (tag.length < 3 || seen.has(normalized)) return;
    seen.add(normalized);
    unique.push(tag);
  });
  return unique.slice(0, 4);
}

export function summarizeGradeBand(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'N/A';
  if (numeric >= 90) return 'A';
  if (numeric >= 80) return 'B';
  if (numeric >= 70) return 'C';
  if (numeric >= 60) return 'D';
  return 'Needs Support';
}

export function buildRollingTrend(scores = [], monthCount = 6, now = new Date()) {
  const end = parseAnalyticsDate(now) || new Date();
  const monthKeys = [];
  for (let index = monthCount - 1; index >= 0; index -= 1) {
    const date = new Date(end.getFullYear(), end.getMonth() - index, 1, 12, 0, 0, 0);
    monthKeys.push(formatMonthKey(date));
  }

  const buckets = new Map(monthKeys.map((key) => [key, []]));
  scores.forEach((score) => {
    const date = parseAnalyticsDate(score.date);
    if (!date || !Number.isFinite(score.normalizedPercent)) return;
    const key = formatMonthKey(date);
    if (!buckets.has(key)) return;
    buckets.get(key).push(Number(score.normalizedPercent));
  });

  return monthKeys.map((key) => {
    const avg = average(buckets.get(key));
    return {
      key,
      label: formatMonthLabel(key),
      value: avg === null ? null : round(avg, 1)
    };
  });
}

export function calculateImprovementRate(scores = []) {
  const ordered = [...scores]
    .filter((score) => Number.isFinite(score.normalizedPercent) && parseAnalyticsDate(score.date))
    .sort((left, right) => parseAnalyticsDate(left.date) - parseAnalyticsDate(right.date));

  if (ordered.length < 2) {
    return {
      delta: 0,
      trend: 'stable',
      label: 'Stable',
      recentAverage: ordered.length ? round(ordered[ordered.length - 1].normalizedPercent, 1) : null,
      baselineAverage: ordered.length ? round(ordered[0].normalizedPercent, 1) : null
    };
  }

  const splitIndex = Math.max(1, Math.floor(ordered.length / 2));
  const baselineAverage = average(ordered.slice(0, splitIndex).map((score) => Number(score.normalizedPercent)));
  const recentAverage = average(ordered.slice(-splitIndex).map((score) => Number(score.normalizedPercent)));
  const delta = round((recentAverage || 0) - (baselineAverage || 0), 1) || 0;

  let trend = 'stable';
  let label = 'Stable';
  if (delta >= 6) {
    trend = 'up';
    label = 'Improving';
  } else if (delta <= -6) {
    trend = 'down';
    label = 'Needs Attention';
  }

  return {
    delta,
    trend,
    label,
    recentAverage: round(recentAverage, 1),
    baselineAverage: round(baselineAverage, 1)
  };
}

export function calculateParticipationLevel({ awardCount = 0, noteCount = 0, assessmentCount = 0, attendanceRate = null } = {}) {
  const safeAttendance = Number.isFinite(attendanceRate) ? attendanceRate : 75;
  const rawScore = (awardCount * 8) + (noteCount * 4) + (assessmentCount * 5) + (safeAttendance * 0.45);
  const score = clamp(Math.round(rawScore), 0, 100);

  let label = 'Developing';
  if (score >= 80) label = 'High';
  else if (score >= 60) label = 'Steady';
  else if (score < 40) label = 'Low';

  return { score, label };
}

export function buildSubjectBreakdown(studentScores = [], classScores = []) {
  const groups = new Map();

  function ensureGroup(tag) {
    const key = cleanTag(tag) || 'General';
    if (!groups.has(key)) {
      groups.set(key, {
        label: key,
        studentValues: [],
        classValues: []
      });
    }
    return groups.get(key);
  }

  studentScores.forEach((score) => {
    if (!Number.isFinite(score.normalizedPercent)) return;
    const tags = getScoreTopicTags(score);
    const label = tags[0] || (score.type === 'dictation' ? 'Dictation' : 'General');
    ensureGroup(label).studentValues.push(Number(score.normalizedPercent));
  });

  classScores.forEach((score) => {
    if (!Number.isFinite(score.normalizedPercent)) return;
    const tags = getScoreTopicTags(score);
    const label = tags[0] || (score.type === 'dictation' ? 'Dictation' : 'General');
    ensureGroup(label).classValues.push(Number(score.normalizedPercent));
  });

  return [...groups.values()]
    .map((group) => ({
      label: group.label,
      studentAverage: round(average(group.studentValues), 1) || 0,
      classAverage: round(average(group.classValues), 1) || 0,
      count: group.studentValues.length
    }))
    .filter((group) => group.count > 0)
    .sort((left, right) => right.studentAverage - left.studentAverage);
}

export function extractTopicWeaknesses(scores = [], limit = 4) {
  const groups = new Map();
  scores.forEach((score) => {
    if (!Number.isFinite(score.normalizedPercent)) return;
    const tags = getScoreTopicTags(score);
    const labels = tags.length ? tags : [score.type === 'dictation' ? 'Dictation' : 'General'];
    labels.slice(0, 2).forEach((label) => {
      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label).push(Number(score.normalizedPercent));
    });
  });

  return [...groups.entries()]
    .map(([label, values]) => ({
      label,
      average: round(average(values), 1) || 0,
      count: values.length
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => {
      if (left.average !== right.average) return left.average - right.average;
      return right.count - left.count;
    })
    .slice(0, limit);
}

export function buildHeatmapData(scores = [], attendanceRecords = [], now = new Date()) {
  const end = parseAnalyticsDate(now) || new Date();
  const start = new Date(end.getTime() - (7 * 12 * DAY_MS));
  const cells = new Map();
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function getCellKey(date) {
    const weekIndex = Math.max(0, Math.min(11, Math.floor((date - start) / (7 * DAY_MS))));
    const dayIndex = (date.getDay() + 6) % 7;
    return `${weekIndex}-${dayIndex}`;
  }

  scores.forEach((score) => {
    const date = parseAnalyticsDate(score.date);
    if (!date || date < start || date > end) return;
    const key = getCellKey(date);
    const cell = cells.get(key) || {
      weekIndex: Math.floor((date - start) / (7 * DAY_MS)),
      dayIndex: (date.getDay() + 6) % 7,
      assessments: 0,
      attendanceHits: 0,
      scoreValues: []
    };
    cell.assessments += 1;
    if (Number.isFinite(score.normalizedPercent)) {
      cell.scoreValues.push(Number(score.normalizedPercent));
    }
    cells.set(key, cell);
  });

  attendanceRecords.forEach((record) => {
    const date = parseAnalyticsDate(record.date);
    if (!date || date < start || date > end) return;
    const key = getCellKey(date);
    const cell = cells.get(key) || {
      weekIndex: Math.floor((date - start) / (7 * DAY_MS)),
      dayIndex: (date.getDay() + 6) % 7,
      assessments: 0,
      attendanceHits: 0,
      scoreValues: []
    };
    cell.attendanceHits += 1;
    cells.set(key, cell);
  });

  const output = [];
  for (let weekIndex = 0; weekIndex < 12; weekIndex += 1) {
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const key = `${weekIndex}-${dayIndex}`;
      const cell = cells.get(key) || { weekIndex, dayIndex, assessments: 0, attendanceHits: 0, scoreValues: [] };
      const avgScore = average(cell.scoreValues);
      const intensity = clamp(
        Math.round((cell.assessments * 18) + (cell.attendanceHits * 8) + ((avgScore || 0) * 0.35)),
        0,
        100
      );
      output.push({
        weekIndex,
        dayIndex,
        label: weekdays[dayIndex],
        assessments: cell.assessments,
        attendanceHits: cell.attendanceHits,
        averageScore: avgScore === null ? null : round(avgScore, 1),
        intensity
      });
    }
  }
  return output;
}

export function predictAssessmentOutcome(scores = [], attendanceRate = null) {
  const ordered = [...scores]
    .filter((score) => Number.isFinite(score.normalizedPercent) && parseAnalyticsDate(score.date))
    .sort((left, right) => parseAnalyticsDate(left.date) - parseAnalyticsDate(right.date));

  if (!ordered.length) {
    return {
      predictedScore: null,
      confidence: 'low',
      band: 'Insufficient data',
      rationale: 'Need more assessment history'
    };
  }

  const recent = ordered.slice(-6);
  const recentValues = recent.map((score) => Number(score.normalizedPercent));
  const recentAverage = average(recentValues) || 0;
  const slope = buildLinearSlope(recentValues);
  const volatility = average(recentValues.map((value) => Math.abs(value - recentAverage))) || 0;
  const attendanceAdjustment = Number.isFinite(attendanceRate) ? clamp((attendanceRate - 85) * 0.18, -6, 4) : 0;
  const predictedScore = clamp(recentAverage + (slope * 1.5) - (volatility * 0.15) + attendanceAdjustment, 0, 100);

  let confidence = 'low';
  if (recent.length >= 6 && volatility < 10) confidence = 'high';
  else if (recent.length >= 3) confidence = 'medium';

  return {
    predictedScore: round(predictedScore, 1),
    confidence,
    band: summarizeGradeBand(predictedScore),
    rationale: confidence === 'high'
      ? 'Strong recent pattern with stable attendance'
      : confidence === 'medium'
        ? 'Prediction based on recent assessments and attendance'
        : 'Light prediction based on limited history'
  };
}

export function buildSmartAlerts({ scores = [], attendanceRate = null, weakTopics = [] } = {}) {
  const ordered = [...scores]
    .filter((score) => Number.isFinite(score.normalizedPercent) && parseAnalyticsDate(score.date))
    .sort((left, right) => parseAnalyticsDate(left.date) - parseAnalyticsDate(right.date));

  const alerts = [];
  if (Number.isFinite(attendanceRate) && attendanceRate < 85) {
    alerts.push({
      severity: 'medium',
      title: 'Attendance Watch',
      message: `Attendance is ${round(attendanceRate, 1)}%, which may be affecting assessment consistency.`
    });
  }

  if (ordered.length >= 3) {
    const recentThree = ordered.slice(-3).map((score) => Number(score.normalizedPercent));
    const earlierThree = ordered.slice(-6, -3).map((score) => Number(score.normalizedPercent));
    const recentAverage = average(recentThree) || 0;
    const earlierAverage = average(earlierThree);

    if (earlierAverage !== null && recentAverage <= earlierAverage - 10) {
      alerts.push({
        severity: 'high',
        title: 'Performance Drop',
        message: `Recent scores are down ${round(earlierAverage - recentAverage, 1)} points from the earlier baseline.`
      });
    } else if (earlierAverage !== null && recentAverage >= earlierAverage + 8) {
      alerts.push({
        severity: 'positive',
        title: 'Momentum Building',
        message: `Recent scores are up ${round(recentAverage - earlierAverage, 1)} points and show a strong rebound.`
      });
    }
  }

  if (weakTopics.length > 0 && weakTopics[0].average < 70) {
    alerts.push({
      severity: 'medium',
      title: 'Weak Topic Cluster',
      message: `Lowest area is ${weakTopics[0].label} at ${weakTopics[0].average}%.`
    });
  }

  if (!alerts.length) {
    alerts.push({
      severity: 'neutral',
      title: 'Stable Pattern',
      message: 'No urgent alerts detected from the current assessment and attendance pattern.'
    });
  }

  return alerts;
}

export function buildRecommendations({ scores = [], attendanceRate = null, participationLevel = null, weakTopics = [], prediction = null } = {}) {
  const recommendations = [];

  if (weakTopics.length > 0) {
    recommendations.push({
      title: `Revisit ${weakTopics[0].label}`,
      description: `Prioritize short retrieval practice and worked examples for ${weakTopics[0].label}.`,
      type: 'practice'
    });
  }

  if (Number.isFinite(attendanceRate) && attendanceRate < 90) {
    recommendations.push({
      title: 'Protect lesson continuity',
      description: 'Share a catch-up checklist after absences so missed content does not compound.',
      type: 'attendance'
    });
  }

  if ((participationLevel?.score || 0) < 60) {
    recommendations.push({
      title: 'Increase classroom participation',
      description: 'Use low-risk turn-and-talk prompts before independent tasks to build confidence.',
      type: 'engagement'
    });
  }

  if ((prediction?.predictedScore || 0) >= 85) {
    recommendations.push({
      title: 'Stretch challenge',
      description: 'Add extension questions or mixed-topic practice to maintain momentum.',
      type: 'extension'
    });
  } else if (prediction?.predictedScore !== null) {
    recommendations.push({
      title: 'Pre-assessment revision plan',
      description: 'Schedule two short revision bursts focused on recent weak topics before the next assessment.',
      type: 'planning'
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      title: 'Maintain steady monitoring',
      description: 'Continue the current support pattern and review performance again after the next assessment.',
      type: 'monitor'
    });
  }

  return recommendations.slice(0, 4);
}

export function buildAnalyticsCsv({ student = {}, metrics = {}, history = [], alerts = [], recommendations = [] } = {}) {
  const lines = [
    ['Student', student.name || 'Unknown'],
    ['Current Grade', metrics.currentGrade || 'N/A'],
    ['Attendance', metrics.attendancePercent ?? 'N/A'],
    ['Average Score', metrics.averageScore ?? 'N/A'],
    ['Improvement Rate', metrics.improvementDelta ?? 'N/A'],
    []
  ];

  lines.push(['Assessment History']);
  lines.push(['Date', 'Type', 'Title', 'Score', 'Normalized Percent', 'Topics']);
  history.forEach((entry) => {
    lines.push([
      entry.date || '',
      entry.type || '',
      entry.title || '',
      entry.displayScore || '',
      entry.normalizedPercent ?? '',
      (entry.tags || []).join(' | ')
    ]);
  });

  lines.push([]);
  lines.push(['Alerts']);
  lines.push(['Severity', 'Title', 'Message']);
  alerts.forEach((alert) => {
    lines.push([alert.severity || '', alert.title || '', alert.message || '']);
  });

  lines.push([]);
  lines.push(['Recommendations']);
  lines.push(['Type', 'Title', 'Description']);
  recommendations.forEach((item) => {
    lines.push([item.type || '', item.title || '', item.description || '']);
  });

  return lines
    .map((row) => row.map((cell) => {
      const text = String(cell ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(','))
    .join('\n');
}

