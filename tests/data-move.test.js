// Pure parts of the database move to Europe (tools/DATA_MOVE_TO_EUROPE.md): the typed dump and
// 1:1 check, the read-only rules and the one-time device cache reset. The emulator round trips
// live in tests/emulator/ (npm run test:data-move).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dump = require('../scripts/lib/firestoreDump.cjs');
const { makeReadonlyRules, listAllows, READ_METHODS } = require('../scripts/lib/readonlyRules.cjs');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const hashOf = (fields) => dump.hashFields(dump.canonicalFields(fields));

test('the same stored value gives the same fingerprint however the SDK hands it over', () => {
  // gRPC form (with valueType) and REST form (without), Long objects and strings.
  assert.equal(hashOf({ n: { valueType: 'integerValue', integerValue: '5' } }), hashOf({ n: { integerValue: '5' } }));
  assert.equal(hashOf({ n: { integerValue: { low: 5, high: 0, unsigned: false } } }), hashOf({ n: { integerValue: '5' } }));
  assert.equal(hashOf({ n: { integerValue: { low: -1, high: -1, unsigned: false } } }), hashOf({ n: { integerValue: '-1' } }));
  // Timestamps as {seconds, nanos} and as RFC 3339 text.
  assert.equal(hashOf({ t: { timestampValue: { seconds: '1795178096', nanos: 123456000 } } }),
    hashOf({ t: { timestampValue: '2026-11-20T12:34:56.123456Z' } }));
  // Bytes as a Buffer and as base64.
  assert.equal(hashOf({ b: { bytesValue: Buffer.from([1, 2, 3]) } }), hashOf({ b: { bytesValue: 'AQID' } }));
  // Map key order never matters.
  assert.equal(hashOf({ m: { mapValue: { fields: { a: { stringValue: '1' }, b: { stringValue: '2' } } } } }),
    hashOf({ m: { mapValue: { fields: { b: { stringValue: '2' }, a: { stringValue: '1' } } } } }));
  // A reference compares by document path, whichever database it was read from.
  assert.equal(hashOf({ r: { referenceValue: 'projects/p/databases/(default)/documents/a/b' } }),
    hashOf({ r: { referenceValue: 'projects/p/databases/gcq-move-rehearsal/documents/a/b' } }));
});

test('different stored values never share a fingerprint', () => {
  const variants = [
    { v: { integerValue: '5' } }, { v: { doubleValue: 5 } }, { v: { stringValue: '5' } },
    { v: { doubleValue: 0 } }, { v: { doubleValue: -0 } }, { v: { doubleValue: NaN } },
    { v: { nullValue: null } }, { v: { booleanValue: false } }, { v: { arrayValue: {} } }, { v: { mapValue: {} } },
    { v: { timestampValue: { seconds: '1', nanos: 0 } } }, { v: { timestampValue: { seconds: '1', nanos: 1000 } } },
    { v: { geoPointValue: { latitude: 1, longitude: 2 } } }, { v: { geoPointValue: { latitude: 2, longitude: 1 } } },
    { v: { referenceValue: 'projects/p/databases/(default)/documents/a/b' } }, { v: { referenceValue: 'projects/p/databases/(default)/documents/a/c' } },
    { v: { arrayValue: { values: [{ integerValue: '1' }, { integerValue: '2' }] } } }, { v: { arrayValue: { values: [{ integerValue: '2' }, { integerValue: '1' }] } } },
  ];
  const hashes = variants.map(hashOf);
  assert.equal(new Set(hashes).size, variants.length);
  assert.deepEqual(dump.canonicalValue({ doubleValue: -0 }), ['double', '-0']);
  assert.throws(() => dump.canonicalValue({ stringValue: 'a', integerValue: '1' }), /Unreadable/);
});

test('the 1:1 check reports missing, extra and changed documents', () => {
  const source = new Map([['a/1', 'h1'], ['a/2', 'h2'], ['a/3', 'h3']]);
  assert.equal(dump.compareManifests(source, new Map(source)).equal, true);
  const diff = dump.compareManifests(source, new Map([['a/1', 'h1'], ['a/2', 'XX'], ['a/4', 'h4']]));
  assert.deepEqual({ missing: diff.missing, extra: diff.extra, changed: diff.changed, equal: diff.equal },
    { missing: ['a/3'], extra: ['a/4'], changed: ['a/2'], equal: false });
});

test('only network hiccups are retried', () => {
  assert.equal(dump.isTransient({ code: 14 }), true);
  assert.equal(dump.isTransient({ code: 'ECONNRESET' }), true);
  assert.equal(dump.isTransient(new Error('Total timeout of API exceeded')), true);
  assert.equal(dump.isTransient({ code: 7, message: 'PERMISSION_DENIED on line 4' }), false);
  assert.equal(dump.isTransient(new Error('Missing or insufficient permissions.')), false);
});

test('read-only rules keep every read rule word for word and no write rule at all', () => {
  const source = read('firestore.rules');
  const { rules, stats } = makeReadonlyRules(source);
  const before = listAllows(source);
  const after = listAllows(rules);
  assert.equal(after.length, before.filter((a) => a.methods.some((m) => READ_METHODS.has(m))).length);
  assert.ok(after.every((a) => a.methods.every((m) => READ_METHODS.has(m))));
  const reads = before.filter((a) => a.methods.some((m) => READ_METHODS.has(m)));
  reads.forEach((a, i) => {
    assert.equal(after[i].condition, a.condition);
    assert.deepEqual(after[i].methods, a.methods.filter((m) => READ_METHODS.has(m)));
  });
  assert.ok(stats.removed > 0 && stats.kept > 0);
  // Everything outside allow statements (functions, match blocks) is unchanged.
  const strip = (text) => text.replace(/\r\n/g, '\n').replace(/\ballow\s[\s\S]*?;|\/\* write rule removed while the database moves \*\//g, '').replace(/^\/\/ (GENERATED|Used only).*\n/gm, '').replace(/\n\s*\n/g, '\n');
  assert.equal(strip(rules), strip(source));
});

test('read-only rules handle mixed methods, strings with semicolons and comments', () => {
  const src = [
    "rules_version = '2';",
    'service cloud.firestore {',
    '  match /databases/{database}/documents {',
    '    // allow write: if true;   (a comment, left alone)',
    "    match /a/{id} { allow read, write: if request.auth.token.email.matches('.*;x'); }",
    '    match /b/{id} {',
    '      allow get, list: if f(1, [2;3].size() > 0);',
    '      allow create, update,',
    '            delete: if g();',
    '    }',
    '  }',
    '}',
  ].join('\n');
  const { rules, stats } = makeReadonlyRules(src);
  assert.match(rules, /allow read: if request\.auth\.token\.email\.matches\('\.\*;x'\);/);
  assert.match(rules, /allow get, list: if f\(1, \[2;3\]\.size\(\) > 0\);/);
  assert.doesNotMatch(rules, /allow create|delete: if g/);
  assert.match(rules, /\/\/ allow write: if true; {3}\(a comment, left alone\)/);
  assert.match(rules, /match \/a\/\{id\} \{ allow read: if/);
  assert.deepEqual(stats, { kept: 1, narrowed: 1, removed: 1 });
  assert.throws(() => makeReadonlyRules('allow destroy: if true;'), /Unknown rule method/);
});

test('each device drops its offline copy once when the database is replaced', async () => {
  const { resetFirestoreCacheIfEpochChanged, firestoreCacheDbName, FIRESTORE_EPOCH_STORAGE_KEY } = await import('../utils/firestoreCacheEpoch.mjs');
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  const deleted = [];
  const idb = { deleteDatabase: (name) => deleted.push(name) };
  assert.equal(firestoreCacheDbName('the-great-class-quest'), 'firestore/[DEFAULT]/the-great-class-quest/main');
  assert.equal(resetFirestoreCacheIfEpochChanged({ projectId: 'p', epoch: 'nam5', storage, idb }), true);
  assert.equal(resetFirestoreCacheIfEpochChanged({ projectId: 'p', epoch: 'nam5', storage, idb }), false);
  assert.equal(resetFirestoreCacheIfEpochChanged({ projectId: 'p', epoch: 'europe-west1', storage, idb }), true);
  assert.deepEqual(deleted, ['firestore/[DEFAULT]/p/main', 'firestore/[DEFAULT]/p/main']);
  assert.equal(store.get(FIRESTORE_EPOCH_STORAGE_KEY), 'europe-west1');
  const broken = { getItem: () => { throw new Error('blocked'); } };
  assert.equal(resetFirestoreCacheIfEpochChanged({ projectId: 'p', epoch: 'x', storage: broken, idb }), false);
  // firebase.js resets before Firestore opens its cache.
  const firebaseJs = read('firebase.js');
  assert.ok(firebaseJs.indexOf('resetFirestoreCacheIfEpochChanged({') < firebaseJs.indexOf('const db = initializeFirestore('));
  assert.match(read('constants.js'), /export const FIRESTORE_DATA_EPOCH = '[a-z0-9-]+';/);
});
