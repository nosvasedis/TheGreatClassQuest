'use strict';

// Pure rules for moving the Firestore database from nam5 (USA) to europe-west1
// (tools/DATA_MOVE_TO_EUROPE.md). No I/O: scripts/migrate-data-europe.cjs does the work; this is
// unit-tested in tests/data-move-plan.test.js.

const SOURCE_LOCATION = 'nam5';
const TARGET_LOCATION = 'europe-west1';
const DATABASE = '(default)';
const REHEARSAL_DATABASE = 'gcq-move-rehearsal';
const SCHEDULED_JOBS = ['maintainShopStock', 'prepareShopStock', 'purgeLeftSchoolStudents', 'stripeSummerPause'];
const TRIGGER_FUNCTION = 'reconcileSpecialQuestEffects';
const REHEARSAL_VALID_DAYS = 14;

function buckets(project) {
  return {
    // The US copy sits in the free storage region; the European copy is a second, separate one.
    us: { name: `${project}-move-us`, location: 'us-central1' },
    eu: { name: `${project}-move-eu`, location: TARGET_LOCATION },
  };
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

// The real move, in order. Steps up to `export-verified` change nothing that cannot be undone
// by putting the normal rules back; `delete-source` is the point after which the data lives
// only in the copies until the import finishes.
const MOVE_STEPS = [
  { id: 'pause-jobs', label: 'Pause the 4 nightly jobs' },
  { id: 'readonly-rules', label: 'Read-only rules on the database' },
  { id: 'dump-before', label: 'Full copy + fingerprints (copy 3)' },
  { id: 'export', label: 'Google export to the US bucket (copy 1)' },
  { id: 'dump-after', label: 'Check nothing changed during the export' },
  { id: 'copy-eu', label: 'Second copy in the European bucket (copy 2)' },
  { id: 'export-verified', label: 'All three copies verified' },
  { id: 'delete-source', label: 'Delete the database in nam5', pointOfNoReturn: true },
  { id: 'create-target', label: 'Create the database in europe-west1' },
  { id: 'indexes', label: 'Indexes + read-only rules on the new database' },
  { id: 'import', label: 'Import the copy' },
  { id: 'verify', label: '1:1 check of every document' },
  { id: 'trigger', label: 'Re-create the Firestore trigger' },
  { id: 'normal-rules', label: 'Normal rules back on' },
  { id: 'protect', label: 'Turn on delete protection' },
  { id: 'resume-jobs', label: 'Resume the nightly jobs' },
];

function stepIndex(id) {
  const i = MOVE_STEPS.findIndex((s) => s.id === id);
  if (i === -1) throw new Error(`Unknown step ${id}`);
  return i;
}

// The step to run next after `done` (the last finished step id, or null).
function nextStep(done) {
  if (!done) return MOVE_STEPS[0].id;
  const i = stepIndex(done);
  return i + 1 < MOVE_STEPS.length ? MOVE_STEPS[i + 1].id : null;
}

function pastPointOfNoReturn(done) {
  return Boolean(done) && stepIndex(done) >= stepIndex('delete-source');
}

/**
 * Rehearsal check. `before` and `after` are the live database read before and after the export
 * (the app keeps running during a rehearsal); `copy` is the rehearsal database.
 * Documents equal in before/after must be equal in the copy. Documents that changed while the
 * export ran may match either version.
 */
function compareRehearsal(before, after, copy) {
  const problems = [];
  const changedDuringRun = [];
  const paths = new Set([...before.keys(), ...after.keys()]);
  for (const p of paths) {
    const a = before.get(p);
    const b = after.get(p);
    const c = copy.get(p);
    if (a !== undefined && a === b) {
      if (c !== a) problems.push({ path: p, problem: c === undefined ? 'missing' : 'changed' });
    } else {
      changedDuringRun.push(p);
      if (c !== undefined && c !== a && c !== b) problems.push({ path: p, problem: 'unexpected version' });
    }
  }
  for (const p of copy.keys()) if (!paths.has(p)) problems.push({ path: p, problem: 'extra' });
  return { ok: problems.length === 0, problems, changedDuringRun, compared: paths.size };
}

// gcloud firestore indexes composite list --format=json
function indexesReady(list) {
  const items = Array.isArray(list) ? list : [];
  const notReady = items.filter((ix) => ix.state !== 'READY');
  return { ready: notReady.length === 0, total: items.length, notReady: notReady.map((ix) => `${ix.name || '?'} ${ix.state}`) };
}

// The new database gets its indexes only from firestore.indexes.json, so every index that
// production has must be in the file (an index made in the console would otherwise be lost).
function indexKey(collectionGroup, queryScope, fields) {
  const parts = (fields || [])
    .filter((f) => f.fieldPath !== '__name__')
    .map((f) => `${f.fieldPath}:${f.order || f.arrayConfig || (f.vectorConfig ? 'VECTOR' : '?')}`);
  return `${collectionGroup}|${queryScope || 'COLLECTION'}|${parts.join(',')}`;
}
function overrideKey(collectionGroup, fieldPath, indexes) {
  // The file writes { order } / { arrayConfig }; gcloud nests them as fields[0].
  const how = (i) => i.order || i.arrayConfig || (i.fields && i.fields[0] && (i.fields[0].order || i.fields[0].arrayConfig)) || '?';
  const parts = (indexes || []).map((i) => `${i.queryScope || 'COLLECTION'}:${how(i)}`).sort();
  return `${collectionGroup}.${fieldPath}=[${parts.join(',')}]`;
}
/**
 * @param liveComposite  gcloud firestore indexes composite list --format=json
 * @param liveFields     gcloud firestore indexes fields list --format=json (non-default entries)
 * @param file           parsed firestore.indexes.json
 */
function indexDrift(liveComposite, liveFields, file) {
  const groupOf = (name) => String(name).split('/collectionGroups/')[1].split('/')[0];
  const live = new Set((liveComposite || []).map((ix) => indexKey(groupOf(ix.name), ix.queryScope, ix.fields)));
  const inFile = new Set((file.indexes || []).map((ix) => indexKey(ix.collectionGroup, ix.queryScope, ix.fields)));
  const liveOverrides = new Set((liveFields || [])
    .filter((f) => !/\/fields\/\*$/.test(f.name) && !/__default__/.test(f.name))
    .map((f) => overrideKey(groupOf(f.name), String(f.name).split('/fields/')[1], f.indexConfig && f.indexConfig.indexes)));
  const fileOverrides = new Set((file.fieldOverrides || []).map((o) => overrideKey(o.collectionGroup, o.fieldPath, o.indexes)));
  return {
    missingInFile: [...live].filter((k) => !inFile.has(k)),
    newInFile: [...inFile].filter((k) => !live.has(k)),
    overridesMissingInFile: [...liveOverrides].filter((k) => !fileOverrides.has(k)),
  };
}

function rehearsalIsFresh(state, now = Date.now()) {
  const at = state && state.rehearsal && state.rehearsal.passedAt ? Date.parse(state.rehearsal.passedAt) : NaN;
  return Number.isFinite(at) && now - at <= REHEARSAL_VALID_DAYS * 24 * 3600 * 1000;
}

module.exports = {
  SOURCE_LOCATION,
  TARGET_LOCATION,
  DATABASE,
  REHEARSAL_DATABASE,
  SCHEDULED_JOBS,
  TRIGGER_FUNCTION,
  REHEARSAL_VALID_DAYS,
  MOVE_STEPS,
  buckets,
  stamp,
  stepIndex,
  nextStep,
  pastPointOfNoReturn,
  compareRehearsal,
  indexesReady,
  indexDrift,
  rehearsalIsFresh,
};
