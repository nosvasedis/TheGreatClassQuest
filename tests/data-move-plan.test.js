// Step rules of the database move (scripts/lib/dataMovePlan.cjs + scripts/migrate-data-europe.cjs).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const plan = require('../scripts/lib/dataMovePlan.cjs');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'scripts/migrate-data-europe.cjs'), 'utf8');

test('the move keeps the free database name and goes to the functions region', () => {
  assert.equal(plan.DATABASE, '(default)');
  assert.equal(plan.SOURCE_LOCATION, 'nam5');
  assert.equal(plan.TARGET_LOCATION, 'europe-west1');
  const b = plan.buckets('the-great-class-quest');
  assert.equal(b.us.location, 'us-central1');
  assert.equal(b.eu.location, 'europe-west1');
  assert.notEqual(b.us.name, b.eu.name);
});

test('nothing is deleted before all three copies are verified, and the app opens only after the 1:1 check', () => {
  const ids = plan.MOVE_STEPS.map((s) => s.id);
  const at = (id) => ids.indexOf(id);
  for (const before of ['pause-jobs', 'readonly-rules', 'dump-before', 'export', 'dump-after', 'copy-eu', 'export-verified']) {
    assert.ok(at(before) < at('delete-source'), before);
  }
  assert.ok(at('dump-before') < at('export') && at('export') < at('dump-after'));
  for (const after of ['create-target', 'indexes', 'import', 'verify']) assert.ok(at('delete-source') < at(after), after);
  assert.ok(at('indexes') < at('import'), 'indexes exist before the import builds them');
  assert.ok(at('verify') < at('normal-rules') && at('verify') < at('trigger'));
  assert.ok(at('normal-rules') < at('resume-jobs'));
  assert.equal(plan.MOVE_STEPS.filter((s) => s.pointOfNoReturn).map((s) => s.id).join(), 'delete-source');
});

test('a rerun continues after the last finished step', () => {
  assert.equal(plan.nextStep(null), 'pause-jobs');
  assert.equal(plan.nextStep('export'), 'dump-after');
  assert.equal(plan.nextStep('resume-jobs'), null);
  assert.equal(plan.pastPointOfNoReturn('export-verified'), false);
  assert.equal(plan.pastPointOfNoReturn('delete-source'), true);
  assert.equal(plan.pastPointOfNoReturn(null), false);
  assert.throws(() => plan.nextStep('nope'), /Unknown step/);
});

test('the rehearsal check allows only documents that changed while it ran', () => {
  const before = new Map([['a', '1'], ['b', '2'], ['c', '3']]);
  const after = new Map([['a', '1'], ['b', '2x'], ['c', '3'], ['d', '4']]);
  assert.equal(plan.compareRehearsal(before, after, new Map([['a', '1'], ['b', '2'], ['c', '3']])).ok, true);
  assert.equal(plan.compareRehearsal(before, after, new Map([['a', '1'], ['b', '2x'], ['c', '3'], ['d', '4']])).ok, true);
  const bad = plan.compareRehearsal(before, after, new Map([['a', '1'], ['b', 'zzz'], ['e', '5']]));
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.problems.map((p) => `${p.problem}:${p.path}`).sort(), ['extra:e', 'missing:c', 'unexpected version:b']);
});

test('indexes and the rehearsal age are read correctly', () => {
  assert.deepEqual(plan.indexesReady([{ state: 'READY' }, { state: 'READY' }]), { ready: true, total: 2, notReady: [] });
  assert.equal(plan.indexesReady([{ name: 'x', state: 'CREATING' }]).ready, false);
  const now = Date.parse('2026-11-30T12:00:00Z');
  assert.equal(plan.rehearsalIsFresh({ rehearsal: { passedAt: '2026-11-21T12:00:00Z' } }, now), true);
  assert.equal(plan.rehearsalIsFresh({ rehearsal: { passedAt: '2026-11-01T12:00:00Z' } }, now), false);
  assert.equal(plan.rehearsalIsFresh({}, now), false);
});

test('an index that exists only in production is caught before the move', () => {
  const name = (cg, id) => `projects/p/databases/(default)/collectionGroups/${cg}/indexes/${id}`;
  const live = [
    { name: name('award_log', 'a'), queryScope: 'COLLECTION', fields: [{ fieldPath: 'studentId', order: 'ASCENDING' }, { fieldPath: 'teacherId', order: 'ASCENDING' }, { fieldPath: '__name__', order: 'ASCENDING' }] },
    { name: name('monthly_history', 'b'), queryScope: 'COLLECTION_GROUP', fields: [{ fieldPath: 'month', order: 'ASCENDING' }, { fieldPath: 'stars', order: 'ASCENDING' }] },
  ];
  const liveFields = [
    { name: 'projects/p/databases/(default)/collectionGroups/__default__/fields/*', indexConfig: {} },
    { name: 'projects/p/databases/(default)/collectionGroups/monthly_history/fields/month', indexConfig: { indexes: [{ queryScope: 'COLLECTION', fields: [{ fieldPath: 'month', order: 'ASCENDING' }] }, { queryScope: 'COLLECTION_GROUP', fields: [{ fieldPath: 'month', order: 'ASCENDING' }] }] } },
  ];
  const file = { indexes: [{ collectionGroup: 'award_log', queryScope: 'COLLECTION', fields: [{ fieldPath: 'studentId', order: 'ASCENDING' }, { fieldPath: 'teacherId', order: 'ASCENDING' }] }], fieldOverrides: [] };
  const drift = plan.indexDrift(live, liveFields, file);
  assert.deepEqual(drift.missingInFile, ['monthly_history|COLLECTION_GROUP|month:ASCENDING,stars:ASCENDING']);
  assert.equal(drift.overridesMissingInFile.length, 1);
  file.indexes.push({ collectionGroup: 'monthly_history', queryScope: 'COLLECTION_GROUP', fields: [{ fieldPath: 'month', order: 'ASCENDING' }, { fieldPath: 'stars', order: 'ASCENDING' }] });
  file.fieldOverrides.push({ collectionGroup: 'monthly_history', fieldPath: 'month', indexes: [{ order: 'ASCENDING', queryScope: 'COLLECTION_GROUP' }, { order: 'ASCENDING', queryScope: 'COLLECTION' }] });
  assert.deepEqual(plan.indexDrift(live, liveFields, file), { missingInFile: [], newInFile: [], overridesMissingInFile: [] });
  // The real file covers production's 64 indexes (checked against production on 2026-11-20).
  const real = JSON.parse(fs.readFileSync(path.join(root, 'firestore.indexes.json'), 'utf8'));
  assert.ok(real.indexes.length >= 65);
  assert.ok(real.fieldOverrides.some((o) => o.collectionGroup === 'monthly_history' && o.fieldPath === 'month'));
  assert.match(script, /production has indexes that firestore\.indexes\.json lacks/);
});

test('the script refuses unsafe moves', () => {
  // The move needs a passed rehearsal, the device cache reset live, and nam5 as the source.
  assert.match(script, /if \(!plan\.rehearsalIsFresh\(loadState\(\)\)\) fail\(/);
  assert.match(script, /resetFirestoreCacheIfEpochChanged/);
  assert.match(script, /if \(db\.locationId !== plan\.SOURCE_LOCATION\) fail\(/);
  // Writes during the read-only window stop the move before anything is deleted.
  assert.match(script, /case 'dump-after'[\s\S]*?if \(!diff\.equal\)[\s\S]*?fail\(/);
  // The new database opens only when every document matches.
  assert.match(script, /case 'verify'[\s\S]*?if \(!diff\.equal\)[\s\S]*?fail\(/);
  // Rollback never deletes an intact original.
  assert.match(script, /const originalIntact = Boolean\(db\) && db\.locationId === plan\.SOURCE_LOCATION && !plan\.pastPointOfNoReturn\(state\.move\.done\);/);
  assert.match(script, /Type \$\{word\} to start/);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['data:move'], 'node scripts/migrate-data-europe.cjs');
  assert.match(pkg.scripts['test:data-move'], /tests\/emulator\/data-move-dump\.cjs tests\/emulator\/data-move-readonly-rules\.cjs/);
});
