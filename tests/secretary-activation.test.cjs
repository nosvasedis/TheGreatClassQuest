const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createSecretaryActivation } = require('../tools/onboarding-console/lib.js');

function fakeDb(role = null) {
  const writes = [];
  return {
    writes,
    doc(docPath) {
      return {
        async get() {
          if (docPath.endsWith('/school_roles/secretary') && role) {
            return { exists: true, data: () => role };
          }
          return { exists: false, data: () => null };
        },
        async set(data, options) {
          writes.push({ docPath, data, options });
        },
      };
    },
  };
}

test('founding activation stores only a SHA-256 hash and expires after seven days', async () => {
  const db = fakeDb();
  const before = Date.now();
  const result = await createSecretaryActivation(db, {
    purpose: 'founding',
    siteUrl: 'https://school.example/',
  });
  const write = db.writes.at(0);
  const token = new URL(result.activationUrl).hash.replace('#secretary-setup=', '');
  assert.equal(write.docPath.endsWith('/admin_bootstrap/secretary'), true);
  assert.match(write.data.tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(write.data).includes(token), false);
  assert.equal(write.data.status, 'pending');
  assert.equal(write.data.purpose, 'founding');
  const expiresMs = new Date(result.expiresAt).getTime();
  assert.ok(expiresMs >= before + (7 * 24 * 60 * 60 * 1000) - 1000);
  assert.ok(expiresMs <= before + (7 * 24 * 60 * 60 * 1000) + 2000);
});

test('recovery activation is linked to the canonical UID and expires after 24 hours', async () => {
  const db = fakeDb({ uid: 'secretary-uid', status: 'active' });
  const before = Date.now();
  const result = await createSecretaryActivation(db, { purpose: 'recovery', siteUrl: 'https://school.example' });
  const write = db.writes.at(0);
  assert.equal(write.data.targetUid, 'secretary-uid');
  assert.equal(write.data.purpose, 'recovery');
  const duration = new Date(result.expiresAt).getTime() - before;
  assert.ok(duration >= (24 * 60 * 60 * 1000) - 1000);
  assert.ok(duration <= (24 * 60 * 60 * 1000) + 2000);
});

test('founding activation refuses to replace an active Secretary and links are randomized', async () => {
  await assert.rejects(
    createSecretaryActivation(fakeDb({ uid: 'active', status: 'active' }), { purpose: 'founding' }),
    /already exists/,
  );
  const first = await createSecretaryActivation(fakeDb(), { purpose: 'handover' });
  const second = await createSecretaryActivation(fakeDb(), { purpose: 'handover' });
  assert.notEqual(first.activationUrl, second.activationUrl);
});

test('runtime activation is single-use, retry-aware, concurrency-safe, and legacy lifecycle calls hard-deny', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'functions', 'index.js'), 'utf8');
  assert.match(source, /crypto\.timingSafeEqual/);
  assert.match(source, /data\.status === 'consumed'/);
  assert.match(source, /data\.status === 'claiming'/);
  assert.match(source, /auth\/email-already-exists/);
  assert.match(source, /resumed: true/);
  assert.match(source, /exports\.createOrReplaceSecretaryAccess = callable\(rejectLegacySecretaryLifecycle\)/);
  assert.match(source, /exports\.disableSecretaryAccess = callable\(rejectLegacySecretaryLifecycle\)/);
  assert.match(source, /exports\.deleteSecretaryAccess = callable\(rejectLegacySecretaryLifecycle\)/);
});

test('migration is dry-run by default, exact-confirmed, scoped, and redacts the link from audit', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'migrate-secretary-admin.cjs'), 'utf8');
  assert.match(source, /dryRun: true/);
  assert.match(source, /HANDOVER-\$\{options\.projectId\}/);
  assert.match(source, /auth\.deleteUser\(oldUid\)/);
  assert.match(source, /batch\.delete\(db\.doc\(`\$\{PROFILE_COLLECTION\}\/\$\{oldUid\}`\)\)/);
  assert.match(source, /schoolAdmin: FieldValue\.delete\(\)/);
  assert.match(source, /activationUrl: '\[REDACTED: printed once to the operator console\]'/);
});
