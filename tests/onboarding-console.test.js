const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  validateSetupInput,
  upsertSchoolConfig,
  buildRenderPayload,
  buildManualSubscriptionPayload,
  buildFirestoreReleaseName,
  buildStorageReleaseName,
  buildServiceUsageConsumerName,
  compareRequiredIndexes,
  formatNetlifyVariables,
} = require('../tools/onboarding-console/lib');

const billingKeysDir = path.join(__dirname, '..', 'billing', 'keys');
const tempKeyPath = path.join(billingKeysDir, 'test-school.json');

const fakeServiceAccount = {
  type: 'service_account',
  project_id: 'gcq-test-school',
  private_key_id: '123',
  private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
  client_email: 'firebase-adminsdk@test.iam.gserviceaccount.com',
  client_id: '123',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk',
};

test.after(() => {
  if (fs.existsSync(tempKeyPath)) {
    fs.unlinkSync(tempKeyPath);
  }
});

test('validateSetupInput accepts a complete matching setup payload', () => {
  const result = validateSetupInput({
    schoolLabel: 'Volos Frontistirio',
    projectId: 'gcq-test-school',
    renderUrl: 'https://gcq-billing.onrender.com',
    serviceAccount: JSON.stringify(fakeServiceAccount),
    priceIds: {
      starter: 'price_starter',
      pro: 'price_pro',
      elite: 'price_elite',
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test('validateSetupInput rejects a mismatched service-account project', () => {
  const result = validateSetupInput({
    schoolLabel: 'Volos Frontistirio',
    projectId: 'another-school',
    renderUrl: 'https://gcq-billing.onrender.com',
    serviceAccount: JSON.stringify(fakeServiceAccount),
    priceIds: {
      starter: 'price_starter',
      pro: 'price_pro',
      elite: 'price_elite',
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /different project/i);
});

test('upsertSchoolConfig adds or updates a school cleanly', () => {
  const config = upsertSchoolConfig(
    {
      schools: [
        {
          schoolId: 'gcq-test-school',
          schoolLabel: 'Old label',
          stripeCustomerId: 'cus_123',
          firebaseProjectId: 'gcq-test-school',
          firebaseServiceAccountPath: './keys/old.json',
        },
      ],
      priceIds: {
        starter: 'price_old_starter',
        pro: 'price_old_pro',
        elite: 'price_old_elite',
      },
    },
    {
      schoolId: 'gcq-test-school',
      schoolLabel: 'New label',
      firebaseProjectId: 'gcq-test-school',
      firebaseServiceAccountPath: './keys/new.json',
    },
    {
      starter: 'price_starter',
      pro: 'price_pro',
      elite: 'price_elite',
    }
  );

  assert.equal(config.schools.length, 1);
  assert.equal(config.schools[0].schoolLabel, 'New label');
  assert.equal(config.schools[0].stripeCustomerId, 'cus_123');
  assert.equal(config.priceIds.pro, 'price_pro');
});

test('buildRenderPayload inlines service account JSON from the key path', () => {
  fs.mkdirSync(billingKeysDir, { recursive: true });
  fs.writeFileSync(tempKeyPath, JSON.stringify(fakeServiceAccount, null, 2));

  const payload = buildRenderPayload({
    schools: [
      {
        schoolId: 'gcq-test-school',
        firebaseProjectId: 'gcq-test-school',
        firebaseServiceAccountPath: './keys/test-school.json',
      },
    ],
    priceIds: {
      starter: 'price_starter',
      pro: 'price_pro',
      elite: 'price_elite',
    },
  });

  assert.equal(payload.schools.length, 1);
  assert.equal(payload.schools[0].firebaseProjectId, 'gcq-test-school');
  assert.equal(payload.schools[0].firebaseServiceAccountKey.project_id, 'gcq-test-school');
  assert.equal(payload.priceIds.elite, 'price_elite');
});

test('compareRequiredIndexes reports ready and missing index states', () => {
  const required = [
    {
      collectionGroup: 'quest_assignments',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'classId', order: 'ASCENDING' },
        { fieldPath: 'createdBy.uid', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' },
      ],
    },
    {
      collectionGroup: 'adventure_logs',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'classId', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' },
      ],
    },
  ];

  const existing = [
    {
      collectionGroup: 'quest_assignments',
      queryScope: 'COLLECTION',
      state: 'READY',
      fields: [
        { fieldPath: 'classId', order: 'ASCENDING' },
        { fieldPath: 'createdBy.uid', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' },
      ],
    },
  ];

  const result = compareRequiredIndexes(required, existing);

  assert.equal(result[0].status, 'done');
  assert.equal(result[1].status, 'missing');
});

test('compareRequiredIndexes matches API indexes that only expose collection group in name', () => {
  const required = [
    {
      collectionGroup: 'attendance',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'classId', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'ASCENDING' },
      ],
    },
  ];

  const existing = [
    {
      name: 'projects/gcq-test-school/databases/(default)/collectionGroups/attendance/indexes/abc123',
      queryScope: 'COLLECTION',
      state: 'READY',
      fields: [
        { fieldPath: 'classId', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'ASCENDING' },
        { fieldPath: '__name__', order: 'ASCENDING' },
      ],
    },
  ];

  const result = compareRequiredIndexes(required, existing);
  assert.equal(result[0].status, 'done');
});

test('build release names for Firestore and Storage rules correctly', () => {
  assert.equal(
    buildFirestoreReleaseName('gcq-test-school'),
    'projects/gcq-test-school/releases/cloud.firestore'
  );
  assert.equal(
    buildStorageReleaseName('gcq-test-school', 'gcq-test-school.firebasestorage.app'),
    'projects/gcq-test-school/releases/firebase.storage/gcq-test-school.firebasestorage.app'
  );
});

test('build service usage consumer name from a project number', () => {
  assert.equal(
    buildServiceUsageConsumerName({
      projectId: 'gcq-test-school',
      projectNumber: '123456789012',
    }),
    'projects/123456789012'
  );
});

test('buildManualSubscriptionPayload adds optional dates and notes', () => {
  const payload = buildManualSubscriptionPayload({
    tier: 'pro',
    startsAt: '2026-03-20',
    endsAt: '2026-04-20',
    notes: 'Gifted for spring term',
    source: 'manual',
  });

  assert.equal(payload.tier, 'pro');
  assert.equal(payload.source, 'manual');
  assert.equal(payload.notes, 'Gifted for spring term');
  assert.match(payload.startsAt, /^2026-03-20T/);
  assert.match(payload.endsAt, /^2026-04-20T/);
});

test('formatNetlifyVariables includes Firebase config and billing values', () => {
  const text = formatNetlifyVariables(
    {
      apiKey: 'api-key',
      authDomain: 'gcq-test-school.firebaseapp.com',
      projectId: 'gcq-test-school',
      storageBucket: 'gcq-test-school.appspot.com',
      messagingSenderId: '123456',
      appId: '1:123:web:abc',
      measurementId: 'G-123',
    },
    'https://gcq-billing.onrender.com',
    'gcq-test-school'
  );

  assert.match(text, /GCQ_FIREBASE_API_KEY=api-key/);
  assert.match(text, /GCQ_BILLING_BASE_URL=https:\/\/gcq-billing.onrender.com/);
  assert.match(text, /GCQ_BILLING_SCHOOL_ID=gcq-test-school/);
});
