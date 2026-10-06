// Helpers kept from the retired per-school onboarding console (removed 2026-10-06):
// - Firestore index checks used by scripts/wait-for-firestore-indexes.cjs.
// - createSecretaryActivation: a one-use Secretary setup / recovery link for the founding
//   school (scripts/migrate-secretary-admin.cjs). Other schools get theirs from the operator
//   console (#operator). Copied verbatim; behaviour unchanged.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Timestamp, FieldValue } = require('firebase-admin/firestore');

const repoRoot = path.resolve(__dirname, '..', '..');
const firestoreIndexesPath = path.join(repoRoot, 'firestore.indexes.json');
const SECRETARY_BOOTSTRAP_DOC = 'artifacts/great-class-quest/public/data/admin_bootstrap/secretary';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const ACTIVE_YEAR_QUERY_INDEX_SPECS = [
  {
    collectionGroup: 'attendance',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'schoolYearKey', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'written_scores',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'schoolYearKey', order: 'ASCENDING' },
      { fieldPath: 'date', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'quest_assignments',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'schoolYearKey', order: 'ASCENDING' },
      { fieldPath: 'createdBy.uid', order: 'ASCENDING' },
    ],
  },
  {"collectionGroup":"ember_oaths","queryScope":"COLLECTION","fields":[{"fieldPath":"teacherId","order":"ASCENDING"},{"fieldPath":"schoolYearKey","order":"ASCENDING"}]},
  {"collectionGroup":"campfire_sessions","queryScope":"COLLECTION","fields":[{"fieldPath":"teacherId","order":"ASCENDING"},{"fieldPath":"schoolYearKey","order":"ASCENDING"}]},
  {"collectionGroup":"ember_oaths","queryScope":"COLLECTION","fields":[{"fieldPath":"studentId","order":"ASCENDING"},{"fieldPath":"schoolYearKey","order":"ASCENDING"},{"fieldPath":"updatedAt","order":"DESCENDING"}]},
  {"collectionGroup":"ember_oaths","queryScope":"COLLECTION","fields":[{"fieldPath":"studentId","order":"ASCENDING"},{"fieldPath":"schoolYearKey","order":"ASCENDING"}]},
  {"collectionGroup":"award_log","queryScope":"COLLECTION","fields":[{"fieldPath":"studentId","order":"ASCENDING"},{"fieldPath":"schoolYearKey","order":"ASCENDING"}]},
  {"collectionGroup":"written_scores","queryScope":"COLLECTION","fields":[{"fieldPath":"studentId","order":"ASCENDING"},{"fieldPath":"schoolYearKey","order":"ASCENDING"}]},
  {
    collectionGroup: 'hero_chronicle_notes',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'schoolYearKey', order: 'ASCENDING' },
      { fieldPath: 'teacherId', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'quest_bounties',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'schoolYearKey', order: 'ASCENDING' },
      { fieldPath: 'createdBy.uid', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'shop_items',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'schoolYearKey', order: 'ASCENDING' },
      { fieldPath: 'teacherId', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'completed_stories',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'schoolYearKey', order: 'ASCENDING' },
      { fieldPath: 'completedAt', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'award_log',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'schoolYearKey', order: 'ASCENDING' },
      { fieldPath: 'studentId', order: 'ASCENDING' },
      { fieldPath: 'reason', order: 'ASCENDING' },
    ],
  },
];

function loadRequiredIndexes() {
  const raw = readJson(firestoreIndexesPath);
  const indexes = (raw.indexes || []).map((index) => ({
    collectionGroup: index.collectionGroup,
    queryScope: index.queryScope || 'COLLECTION',
    fields: (index.fields || []).map((field) => ({
      fieldPath: field.fieldPath,
      ...(field.order ? { order: field.order } : {}),
      ...(field.arrayConfig ? { arrayConfig: field.arrayConfig } : {}),
    })),
  }));
  assertActiveYearQueryIndexesPresent(indexes);
  return indexes;
}

function formatRequiredIndexLabel(index = {}) {
  const fields = (index.fields || []).map((field) => field.fieldPath).join(', ');
  return `${index.collectionGroup} (${fields})`;
}

function findMatchingRequiredIndex(requiredIndexes, spec) {
  const specKey = normalizeIndexForLookup(spec);
  return requiredIndexes.find((index) => normalizeIndexForLookup(index) === specKey) || null;
}

function assertActiveYearQueryIndexesPresent(requiredIndexes) {
  const missing = ACTIVE_YEAR_QUERY_INDEX_SPECS.filter(
    (spec) => !findMatchingRequiredIndex(requiredIndexes, spec),
  );
  if (missing.length === 0) return requiredIndexes;
  throw new Error(
    `firestore.indexes.json is missing ${missing.length} active-year startup index(es): ${missing
      .map(formatRequiredIndexLabel)
      .join('; ')}`,
  );
}

function getActiveYearQueryIndexes(requiredIndexes = loadRequiredIndexes()) {
  return ACTIVE_YEAR_QUERY_INDEX_SPECS.map((spec) => {
    const match = findMatchingRequiredIndex(requiredIndexes, spec);
    if (!match) {
      throw new Error(`Missing active-year startup index: ${formatRequiredIndexLabel(spec)}`);
    }
    return match;
  });
}

function normalizeIndex(index) {
  return JSON.stringify({
    collectionGroup: index.collectionGroup,
    queryScope: index.queryScope || 'COLLECTION',
    fields: (index.fields || [])
      .filter((field) => field.fieldPath !== '__name__')
      .map((field) => ({
        fieldPath: field.fieldPath,
        order: field.order || null,
        arrayConfig: field.arrayConfig || null,
      })),
  });
}

function normalizeIndexForLookup(index) {
  const normalized = JSON.parse(normalizeIndex(index));
  normalized.fields = normalized.fields
    .slice()
    .sort((a, b) => {
      if (a.fieldPath === b.fieldPath) {
        return String(a.order || a.arrayConfig || '').localeCompare(String(b.order || b.arrayConfig || ''));
      }
      return String(a.fieldPath).localeCompare(String(b.fieldPath));
    });
  return JSON.stringify(normalized);
}

function getCollectionGroupFromIndex(index) {
  if (index && index.collectionGroup) {
    return index.collectionGroup;
  }
  const name = String(index && index.name ? index.name : '');
  const match = name.match(/\/collectionGroups\/([^/]+)\/indexes\//);
  return match ? decodeURIComponent(match[1]) : '';
}

function mapIndexState(state) {
  if (state === 'READY') return 'done';
  if (state === 'CREATING') return 'building';
  if (state === 'NEEDS_REPAIR') return 'needs_attention';
  return 'waiting';
}

function compareRequiredIndexes(requiredIndexes, existingIndexes) {
  const existingMap = new Map();
  for (const index of existingIndexes) {
    existingMap.set(
      normalizeIndexForLookup({
        collectionGroup: getCollectionGroupFromIndex(index),
        queryScope: index.queryScope || 'COLLECTION',
        fields: index.fields || [],
      }),
      index
    );
  }

  return requiredIndexes.map((required) => {
    const existing = existingMap.get(normalizeIndexForLookup(required));
    const rawState = existing ? existing.state || 'UNKNOWN' : 'MISSING';
    const status = existing ? mapIndexState(rawState) : 'missing';
    return {
      ...required,
      rawState,
      status,
      existing,
    };
  });
}

async function createSecretaryActivation(db, options = {}) {
  const purpose = String(options.purpose || 'founding').trim().toLowerCase();
  if (!['founding', 'recovery', 'handover'].includes(purpose)) {
    throw new Error('Secretary activation purpose must be founding, recovery, or handover.');
  }
  const defaultHours = purpose === 'founding' ? 7 * 24 : 24;
  const expiresInHours = Number(options.expiresInHours || defaultHours);
  if (!Number.isFinite(expiresInHours) || expiresInHours <= 0) {
    throw new Error('Secretary activation expiry must be a positive number of hours.');
  }
  const roleRef = db.doc('artifacts/great-class-quest/public/data/school_roles/secretary');
  const roleSnap = await roleRef.get();
  if (purpose === 'founding' && roleSnap.exists && roleSnap.data()?.status === 'active') {
    throw new Error('An active Secretary/admin already exists; use a recovery or handover activation instead.');
  }
  if (purpose === 'recovery' && (!roleSnap.exists || roleSnap.data()?.status !== 'active' || !roleSnap.data()?.uid)) {
    throw new Error('Recovery requires one active canonical Secretary/admin.');
  }
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
  const now = Date.now();
  const expiresAt = Timestamp.fromMillis(now + expiresInHours * 60 * 60 * 1000);
  await db.doc(SECRETARY_BOOTSTRAP_DOC).set({
    tokenHash,
    purpose,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt,
    ...(purpose === 'recovery' ? { targetUid: roleSnap.data().uid } : {}),
  }, { merge: false });
  const baseUrl = String(options.siteUrl || '').trim().replace(/\/$/, '');
  return {
    purpose,
    expiresAt: expiresAt.toDate().toISOString(),
    activationUrl: `${baseUrl || ''}/#secretary-setup=${encodeURIComponent(token)}`,
  };
}

module.exports = {
  compareRequiredIndexes,
  createSecretaryActivation,
  formatRequiredIndexLabel,
  getActiveYearQueryIndexes,
  loadRequiredIndexes,
};
