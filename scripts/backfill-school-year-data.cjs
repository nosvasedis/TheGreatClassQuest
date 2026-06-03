#!/usr/bin/env node

const { getAccessToken, getAllAccounts } = require('../node_modules/firebase-tools/lib/auth');

const PROJECT_ID = process.env.GCQ_FIREBASE_PROJECT || 'the-great-class-quest';
const DATABASE_ID = '(default)';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const ROOT = `artifacts/great-class-quest/public/data`;
const CLOSING_YEAR = process.env.GCQ_CLOSING_YEAR || '2025-2026';
const NEXT_YEAR = process.env.GCQ_NEXT_YEAR || '2026-2027';
const DRY_RUN = process.argv.includes('--dry-run');
let accessTokenPromise;

const YEAR_COLLECTIONS = [
  'award_log',
  'attendance',
  'written_scores',
  'adventure_logs',
  'quest_events',
  'quest_assignments',
  'schedule_overrides',
  'shop_items',
  'fortune_wheel_log',
  'quest_history',
  'hero_chronicle_notes',
  'parent_homework',
  'communication_threads',
  'communication_messages',
  'quest_bounties',
  'completed_stories',
  'quiz_of_the_week'
];

function stringValue(value) {
  return { stringValue: String(value) };
}

function boolValue(value) {
  return { booleanValue: Boolean(value) };
}

function timestampValue(value = new Date()) {
  return { timestampValue: value.toISOString() };
}

function fieldToJs(value) {
  if (!value || typeof value !== 'object') return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('mapValue' in value) {
    const fields = value.mapValue.fields || {};
    return Object.fromEntries(Object.entries(fields).map(([key, nested]) => [key, fieldToJs(nested)]));
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(fieldToJs);
  }
  return undefined;
}

function docId(documentName) {
  return String(documentName || '').split('/').pop();
}

async function authedFetch(pathOrUrl, options = {}) {
  if (!accessTokenPromise) {
    const account = getAllAccounts().find((item) => item.user?.email === 'nvasedis@gmail.com') || getAllAccounts()[0];
    if (!account?.tokens?.refresh_token) {
      throw new Error('No saved Firebase CLI account with a refresh token was found.');
    }
    accessTokenPromise = getAccessToken(account.tokens.refresh_token, []);
  }
  const token = await accessTokenPromise;
  const url = pathOrUrl.startsWith('https://')
    ? pathOrUrl
    : pathOrUrl.startsWith('projects/')
      ? `https://firestore.googleapis.com/v1/${pathOrUrl}`
      : `${BASE_URL}/${pathOrUrl}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return response.json();
}

async function listCollection(collectionName, mask = []) {
  const docs = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ pageSize: '300' });
    if (pageToken) params.set('pageToken', pageToken);
    mask.forEach((fieldPath) => params.append('mask.fieldPaths', fieldPath));
    const result = await authedFetch(`${ROOT}/${collectionName}?${params.toString()}`);
    docs.push(...(result.documents || []));
    pageToken = result.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function patchDocument(name, fields) {
  const fieldPaths = Object.keys(fields);
  if (DRY_RUN || fieldPaths.length === 0) return;
  const params = new URLSearchParams();
  fieldPaths.forEach((fieldPath) => params.append('updateMask.fieldPaths', fieldPath));
  await authedFetch(`${name}?${params.toString()}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields })
  });
}

async function ensureDoc(path, fields) {
  await patchDocument(`projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${path}`, fields);
}

async function main() {
  const summary = {
    dryRun: DRY_RUN,
    schoolYearDocs: 0,
    classesTagged: 0,
    studentsTagged: 0,
    scoresTagged: 0,
    missingScores: 0,
    appendOnlyTagged: {},
    parentLinksSynced: 0
  };

  await ensureDoc(`${ROOT}/school_year_state/current`, {
    activeYearKey: stringValue(CLOSING_YEAR),
    nextYearKey: stringValue(NEXT_YEAR),
    rolloverStatus: stringValue('preparing'),
    closeDate: stringValue('10-06-2026'),
    enforceActiveYearQueries: boolValue(false),
    updatedAt: timestampValue()
  });
  await ensureDoc(`${ROOT}/school_years/${CLOSING_YEAR}`, {
    label: stringValue(CLOSING_YEAR),
    startsAt: stringValue('2025-09-01'),
    endsAt: stringValue('10-06-2026'),
    closeAvailableAt: stringValue('10-06-2026'),
    status: stringValue('active'),
    updatedAt: timestampValue()
  });
  await ensureDoc(`${ROOT}/school_years/${NEXT_YEAR}`, {
    label: stringValue(NEXT_YEAR),
    startsAt: stringValue('2026-09-01'),
    endsAt: stringValue('2027-06-10'),
    closeAvailableAt: stringValue('2027-06-10'),
    status: stringValue('planned'),
    updatedAt: timestampValue()
  });
  summary.schoolYearDocs = 3;

  console.log(`${DRY_RUN ? 'Dry run' : 'Backfill'} started for ${CLOSING_YEAR}.`);

  const classes = await listCollection('classes', ['schoolYearKey', 'status']);
  for (const cls of classes) {
    const fields = cls.fields || {};
    const updates = {};
    if (!fields.schoolYearKey) updates.schoolYearKey = stringValue(CLOSING_YEAR);
    if (!fields.status) updates.status = stringValue('active');
    if (Object.keys(updates).length) {
      updates.updatedAt = timestampValue();
      await patchDocument(cls.name, updates);
      summary.classesTagged += 1;
    }
  }
  console.log(`classes: ${summary.classesTagged} updated`);

  const students = await listCollection('students', ['activeSchoolYearKey', 'enrollmentStatus', 'classId', 'createdBy']);
  const studentById = new Map();
  for (const student of students) {
    studentById.set(docId(student.name), student);
    const fields = student.fields || {};
    const updates = {};
    if (!fields.activeSchoolYearKey) updates.activeSchoolYearKey = stringValue(CLOSING_YEAR);
    if (!fields.enrollmentStatus) updates.enrollmentStatus = stringValue('active');
    if (Object.keys(updates).length) {
      updates.updatedAt = timestampValue();
      await patchDocument(student.name, updates);
      summary.studentsTagged += 1;
    }
  }
  console.log(`students: ${summary.studentsTagged} updated`);

  const scores = await listCollection('student_scores', ['activeSchoolYearKey', 'createdBy']);
  const existingScoreIds = new Set(scores.map((score) => docId(score.name)));
  for (const score of scores) {
    const fields = score.fields || {};
    const student = studentById.get(docId(score.name));
    const updates = {};
    if (!fields.activeSchoolYearKey) updates.activeSchoolYearKey = stringValue(CLOSING_YEAR);
    if (!fields.createdBy && student?.fields?.createdBy) updates.createdBy = student.fields.createdBy;
    if (Object.keys(updates).length) {
      updates.updatedAt = timestampValue();
      await patchDocument(score.name, updates);
      summary.scoresTagged += 1;
    }
  }
  console.log(`student_scores: ${summary.scoresTagged} updated`);

  for (const [studentId, student] of studentById.entries()) {
    if (existingScoreIds.has(studentId)) continue;
    const createdBy = student.fields?.createdBy || { mapValue: { fields: {} } };
    await ensureDoc(`${ROOT}/student_scores/${studentId}`, {
      activeSchoolYearKey: stringValue(CLOSING_YEAR),
      totalStars: { integerValue: '0' },
      monthlyStars: { integerValue: '0' },
      gold: { integerValue: '0' },
      inventory: { arrayValue: { values: [] } },
      starsByReason: { mapValue: { fields: {} } },
      heroLevel: { integerValue: '0' },
      heroSkills: { arrayValue: { values: [] } },
      pendingSkillChoice: boolValue(false),
      createdBy,
      createdAt: timestampValue(),
      updatedAt: timestampValue()
    });
    summary.missingScores += 1;
  }
  console.log(`missing score docs: ${summary.missingScores} created`);

  for (const collectionName of YEAR_COLLECTIONS) {
    console.log(`${collectionName}: scanning`);
    const docs = await listCollection(collectionName, ['schoolYearKey']);
    let tagged = 0;
    for (const document of docs) {
      if (document.fields?.schoolYearKey) continue;
      await patchDocument(document.name, {
        schoolYearKey: stringValue(CLOSING_YEAR),
        updatedAt: timestampValue()
      });
      tagged += 1;
    }
    summary.appendOnlyTagged[collectionName] = tagged;
    console.log(`${collectionName}: ${tagged} updated`);
  }

  const parentLinks = await listCollection('parent_links', ['classId']);
  for (const link of parentLinks) {
    const studentId = docId(link.name);
    const student = studentById.get(studentId);
    const classId = fieldToJs(student?.fields?.classId);
    if (!classId) continue;
    const existing = fieldToJs(link.fields?.classId);
    if (existing === classId) continue;
    await patchDocument(link.name, {
      classId: stringValue(classId),
      updatedAt: timestampValue()
    });
    summary.parentLinksSynced += 1;
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
