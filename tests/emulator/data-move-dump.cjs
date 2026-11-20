// Runs the data-move dump and 1:1 check against the Firestore emulator (npm run test:data-move; not part of npm test, it needs the emulator).
// Documents are written in their exact stored form over the emulator's REST API, so integer vs
// double, nanosecond timestamps, bytes, references, geo points and nested values are all real.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const FUNCTIONS = path.resolve(__dirname, '..', '..', 'functions');
const { initializeApp } = require(require.resolve('firebase-admin/app', { paths: [FUNCTIONS] }));
const { getFirestore } = require(require.resolve('firebase-admin/firestore', { paths: [FUNCTIONS] }));
const dump = require('../../scripts/lib/firestoreDump.cjs');

const PROJECT = 'demo-gcq';
const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const docUrl = (db, p) => `http://${HOST}/v1/projects/${PROJECT}/databases/${db}/documents/${p}`;

async function putRaw(db, p, fields) {
  const res = await fetch(docUrl(db, p), { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer owner' }, body: JSON.stringify({ fields }) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}
async function wipe(db) {
  await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/${db}/documents`, { method: 'DELETE' });
}

const ref = (db, p) => ({ referenceValue: `projects/${PROJECT}/databases/${db}/documents/${p}` });
function sample(db) {
  return {
    'artifacts/school-a/public/data/students/s1': {
      name: { stringValue: 'Ελένη 🌟' },
      stars: { integerValue: '5' },
      ratio: { doubleValue: 5 },
      big: { integerValue: '9007199254740993' },
      when: { timestampValue: '2026-11-20T12:34:56.123456789Z' },
      blob: { bytesValue: Buffer.from([0, 1, 2, 250]).toString('base64') },
      teacher: ref(db, 'user_profiles/t1'),
      place: { geoPointValue: { latitude: 37.98, longitude: 23.72 } },
      none: { nullValue: null },
      yes: { booleanValue: true },
      empty: { arrayValue: {} },
      emptyMap: { mapValue: {} },
      nested: { mapValue: { fields: { z: { integerValue: '1' }, a: { arrayValue: { values: [{ stringValue: 'x' }, { mapValue: { fields: { k: { doubleValue: 0.5 } } } }] } } } } },
    },
    'artifacts/school-a/public/data/students/s1/monthly_history/2026-10': { stars: { integerValue: '12' } },
    // The parent student_scores/ghost does not exist itself; only its subcollection does.
    'artifacts/school-a/public/data/student_scores/ghost/monthly_history/2026-09': { stars: { integerValue: '3' } },
    'user_profiles/t1': { role: { stringValue: 'teacher' } },
  };
}

let app;
before(async () => {
  app = initializeApp({ projectId: PROJECT });
  for (const db of ['(default)', 'gcq-move-rehearsal']) {
    await wipe(db);
    for (const [p, fields] of Object.entries(sample(db))) await putRaw(db, p, fields);
  }
});

async function manifestOf(firestore) {
  const map = new Map();
  const result = await dump.walkDatabase(firestore, { onDoc: (d) => map.set(d.path, d.hash) });
  return { map, result };
}

test('finds every document, including ones under a parent that does not exist', async () => {
  const db = getFirestore(app);
  const { map, result } = await manifestOf(db);
  assert.deepEqual([...map.keys()].sort(), Object.keys(sample('(default)')).sort());
  assert.ok(result.missingParents >= 1);
  assert.ok(result.collectionIds.includes('monthly_history'));
});

test('the same data gives the same fingerprints over REST and gRPC, and in a database with another name', async () => {
  const grpc = getFirestore(app);
  const rest = getFirestore(app, 'gcq-move-rehearsal');
  rest.settings({ preferRest: true });
  const a = await manifestOf(grpc);
  const b = await manifestOf(rest);
  const diff = dump.compareManifests(a.map, b.map);
  assert.equal(diff.equal, true, JSON.stringify(diff));
});

test('keeps exact types: an integer is not a double; microsecond timestamps, bytes and references survive', async () => {
  const db = getFirestore(app);
  const snap = await db.doc('artifacts/school-a/public/data/students/s1').get();
  const fields = dump.canonicalFields(dump.storedFields(snap));
  assert.deepEqual(fields.stars, ['int', '5']);
  assert.deepEqual(fields.ratio, ['double', 5]);
  assert.deepEqual(fields.big, ['int', '9007199254740993']);
  assert.deepEqual(fields.when, ['time', String(Date.parse('2026-11-20T12:34:56Z') / 1000), 123456000]); // Firestore keeps microseconds
  assert.deepEqual(fields.blob, ['bytes', Buffer.from([0, 1, 2, 250]).toString('base64')]);
  assert.deepEqual(fields.teacher, ['ref', 'user_profiles/t1']);
  assert.deepEqual(Object.keys(fields.nested[1]), ['a', 'z']);
});

test('the 1:1 check catches a changed type, a changed value, a missing and an extra document', async () => {
  const source = (await manifestOf(getFirestore(app))).map;
  const copyDb = 'gcq-move-rehearsal';
  await putRaw(copyDb, 'artifacts/school-a/public/data/students/s1/monthly_history/2026-10', { stars: { doubleValue: 12 } }); // int -> double
  await putRaw(copyDb, 'user_profiles/t1', { role: { stringValue: 'secretary' } });
  await fetch(docUrl(copyDb, 'artifacts/school-a/public/data/student_scores/ghost/monthly_history/2026-09'), { method: 'DELETE', headers: { authorization: 'Bearer owner' } });
  await putRaw(copyDb, 'user_profiles/t2', { role: { stringValue: 'teacher' } });
  const copy = (await manifestOf(getFirestore(app, copyDb))).map;
  const diff = dump.compareManifests(source, copy);
  assert.equal(diff.equal, false);
  assert.deepEqual(diff.changed.sort(), ['artifacts/school-a/public/data/students/s1/monthly_history/2026-10', 'user_profiles/t1']);
  assert.deepEqual(diff.missing, ['artifacts/school-a/public/data/student_scores/ghost/monthly_history/2026-09']);
  assert.deepEqual(diff.extra, ['user_profiles/t2']);
});
