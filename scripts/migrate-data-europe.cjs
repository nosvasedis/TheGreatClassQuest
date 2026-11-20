#!/usr/bin/env node
'use strict';

// Moves the Firestore database from nam5 (USA) to europe-west1, keeping its name `(default)` so it
// stays on the free tier and no code changes (runbook: tools/DATA_MOVE_TO_EUROPE.md).
//
//   npm run data:move -- --check       checks only, changes nothing
//   npm run data:move -- --rehearse    full trial: copy into a temporary database, check 1:1, delete it
//                                      (no downtime; costs a few cents)
//   npm run data:move -- --go          the real move (asks you to type MOVE); a rerun continues
//   npm run data:move -- --rollback    puts everything back (before the delete: normal rules +
//                                      jobs; after it: the database back in nam5 from the copy)
//   --yes  do not ask before starting
//
// Nothing is deleted until three verified copies exist (Google's export in a US bucket, a second
// copy in a European bucket, and our own typed copy with a SHA-256 per document), and the new
// database is opened only after every document matches that copy.

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const { spawn } = require('child_process');
const { repoRoot, firebaseBin, runFirebase } = require('./lib/firebase-cli.cjs');
const plan = require('./lib/dataMovePlan.cjs');
const dumpLib = require('./lib/firestoreDump.cjs');
const { makeReadonlyRules } = require('./lib/readonlyRules.cjs');

const args = new Set(process.argv.slice(2));
const MODE = args.has('--rollback') ? 'rollback' : args.has('--go') ? 'go' : args.has('--rehearse') ? 'rehearse' : 'check';
const PROJECT = JSON.parse(fs.readFileSync(path.join(repoRoot, '.firebaserc'), 'utf8')).projects.default;
const REGION = 'europe-west1'; // where the functions and their scheduler jobs live
const BUCKETS = plan.buckets(PROJECT);
const STATE_DIR = path.join(os.homedir(), '.gcq-data-move');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
fs.mkdirSync(STATE_DIR, { recursive: true });
const LOG_FILE = path.join(STATE_DIR, `log-${MODE}-${plan.stamp()}.txt`);
const startedAt = Date.now();

// ---------- output ----------
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
function log(line = '') { process.stdout.write(`${line}\n`); logStream.write(`${line}\n`); }
const step = (text) => log(`\n=== ${text}  [${minutes()}]`);
const ok = (text) => log(`  OK   ${text}`);
const warn = (text) => log(`  WARN ${text}`);
class Stop extends Error {}
function fail(text) { log(`  FAIL ${text}`); throw new Stop(text); }
function minutes() { return `${((Date.now() - startedAt) / 60000).toFixed(1)} min`; }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- state ----------
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (_) { return {}; }
}
function saveState(state) {
  fs.writeFileSync(`${STATE_FILE}.tmp`, JSON.stringify(state, null, 2));
  fs.renameSync(`${STATE_FILE}.tmp`, STATE_FILE);
}

// ---------- processes ----------
function run(command, commandArgs, { cwd = repoRoot, shell = false, quiet = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, { cwd, shell, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; logStream.write(d); });
    child.stderr.on('data', (d) => { stderr += d; logStream.write(d); if (!quiet) process.stderr.write(d); });
    child.on('error', (error) => resolve({ status: -1, stdout, stderr: String(error) }));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

// On Windows gcloud is a .cmd file, which Node only starts through the shell: quote every argument.
function gcloud(gcloudArgs, options = {}) {
  const all = [...gcloudArgs, `--project=${PROJECT}`, '--quiet'];
  if (process.platform === 'win32') return run(['gcloud', ...all.map((a) => `"${a}"`)].join(' '), [], { ...options, shell: true });
  return run('gcloud', all, options);
}
async function gcloudJson(gcloudArgs) {
  const result = await gcloud([...gcloudArgs, '--format=json'], { quiet: true });
  if (result.status !== 0) return { ok: false, error: result.stderr.trim(), value: null };
  try { return { ok: true, value: JSON.parse(result.stdout || 'null') }; } catch (_) { return { ok: false, error: 'bad JSON', value: null }; }
}
async function gcloudOrFail(gcloudArgs, what) {
  const result = await gcloud(gcloudArgs);
  if (result.status !== 0) fail(`${what} failed:\n${result.stderr.trim()}`);
  return result;
}

// ---------- Firestore ----------
function firestoreFor(databaseId) {
  const req = (m) => require(require.resolve(m, { paths: [path.join(repoRoot, 'functions')] }));
  const { initializeApp, getApps } = req('firebase-admin/app');
  const { getFirestore } = req('firebase-admin/firestore');
  const app = getApps().find((a) => a.name === 'data-move') || initializeApp({ projectId: PROJECT }, 'data-move');
  const db = databaseId === plan.DATABASE ? getFirestore(app) : getFirestore(app, databaseId);
  try { db.settings({ preferRest: true }); } catch (_) { /* already set */ }
  return db;
}

async function describeDatabase(databaseId) {
  const result = await gcloudJson(['firestore', 'databases', 'describe', `--database=${databaseId}`]);
  return result.ok ? result.value : null;
}

// Reads the whole database; writes the typed copy (gzip NDJSON) and returns path -> hash.
async function dumpDatabase(databaseId, label) {
  const file = path.join(STATE_DIR, `${label}.ndjson.gz`);
  const gzip = zlib.createGzip();
  const out = fs.createWriteStream(file);
  gzip.pipe(out);
  const manifest = new Map();
  let lastPrint = 0;
  const result = await dumpLib.walkDatabase(firestoreFor(databaseId), {
    concurrency: 48,
    onDoc: (d) => {
      manifest.set(d.path, d.hash);
      gzip.write(`${JSON.stringify({ path: d.path, hash: d.hash, updateTime: d.updateTime, fields: d.fields })}\n`);
    },
    onProgress: (s) => {
      if (Date.now() - lastPrint > 5000) { lastPrint = Date.now(); log(`  ... ${s.docs} documents, ${s.collections} collections`); }
    },
  });
  await new Promise((resolve) => { out.on('finish', resolve); gzip.end(); });
  fs.writeFileSync(path.join(STATE_DIR, `${label}.manifest.json`), JSON.stringify({ databaseId, at: new Date().toISOString(), ...result, hashes: Object.fromEntries(manifest) }));
  ok(`${label}: ${result.docs} documents in ${result.collections} collections (${result.collectionIds.length} kinds), copy saved: ${file}`);
  return manifest;
}
function loadManifest(label) {
  const data = JSON.parse(fs.readFileSync(path.join(STATE_DIR, `${label}.manifest.json`), 'utf8'));
  return new Map(Object.entries(data.hashes));
}
function reportDiff(diff, max = 15) {
  for (const [kind, list] of [['missing', diff.missing], ['extra', diff.extra], ['changed', diff.changed]]) {
    if (list.length) log(`    ${kind} (${list.length}): ${list.slice(0, max).join(', ')}${list.length > max ? ' …' : ''}`);
  }
}

// ---------- buckets / export ----------
async function ensureBucket({ name, location }) {
  const found = await gcloudJson(['storage', 'buckets', 'describe', `gs://${name}`]);
  if (found.ok) {
    const loc = String(found.value.location || '').toLowerCase();
    if (loc !== location) fail(`gs://${name} exists in ${loc}, expected ${location}`);
    return;
  }
  await gcloudOrFail(['storage', 'buckets', 'create', `gs://${name}`, `--location=${location}`, '--uniform-bucket-level-access', '--public-access-prevention'], `Creating gs://${name}`);
  ok(`bucket gs://${name} (${location})`);
}
async function listExport(bucket, prefix) {
  const res = await gcloudJson(['storage', 'objects', 'list', `gs://${bucket}/${prefix}/**`]);
  if (!res.ok) fail(`Listing gs://${bucket}/${prefix}: ${res.error}`);
  return res.value.map((o) => `${String(o.name).replace(/^.*?\//, '')} ${o.size} ${o.crc32c_hash}`).sort();
}
async function exportTo(prefix, databaseId = plan.DATABASE) {
  log(`  ... Google export of ${databaseId} to gs://${BUCKETS.us.name}/${prefix}`);
  await gcloudOrFail(['firestore', 'export', `gs://${BUCKETS.us.name}/${prefix}`, `--database=${databaseId}`], 'Export');
  const files = await listExport(BUCKETS.us.name, prefix);
  if (!files.some((f) => f.startsWith(`${prefix}.overall_export_metadata `))) fail(`The export has no ${prefix}.overall_export_metadata`);
  ok(`export: ${files.length} files`);
  return files;
}
async function copyExportToEu(prefix, usFiles) {
  await gcloudOrFail(['storage', 'cp', '-r', `gs://${BUCKETS.us.name}/${prefix}`, `gs://${BUCKETS.eu.name}/`], 'Copying the export to Europe');
  const euFiles = await listExport(BUCKETS.eu.name, prefix);
  if (JSON.stringify(euFiles) !== JSON.stringify(usFiles)) fail('The European copy of the export differs from the US one (names, sizes or checksums)');
  ok(`European copy identical: ${euFiles.length} files, same sizes and checksums`);
}
async function importFrom(bucket, prefix, databaseId) {
  log(`  ... importing gs://${bucket}/${prefix} into ${databaseId}`);
  await gcloudOrFail(['firestore', 'import', `gs://${bucket}/${prefix}/`, `--database=${databaseId}`], 'Import');
  ok('import finished');
}

// ---------- rules / indexes / jobs / trigger ----------
function writeMoveConfig(readonly) {
  const rulesFile = path.join(STATE_DIR, readonly ? 'readonly.rules' : 'firestore.rules');
  const source = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  fs.writeFileSync(rulesFile, readonly ? makeReadonlyRules(source).rules : source);
  fs.copyFileSync(path.join(repoRoot, 'firestore.indexes.json'), path.join(STATE_DIR, 'firestore.indexes.json'));
  fs.writeFileSync(path.join(STATE_DIR, 'firebase.json'), JSON.stringify({ firestore: { rules: path.basename(rulesFile), indexes: 'firestore.indexes.json' } }, null, 2));
}
async function deployFirestore({ readonly, only = 'firestore', dryRun = false }) {
  writeMoveConfig(readonly);
  const extra = dryRun ? ['--dry-run'] : [];
  const result = await runFirebase(['deploy', '--only', only, '--project', PROJECT, '--non-interactive', ...extra], { cwd: STATE_DIR, attempts: 2 });
  logStream.write(result.output || '');
  if (result.status !== 0) fail(`firebase deploy --only ${only}${dryRun ? ' --dry-run' : ''} (${readonly ? 'read-only' : 'normal'} rules) failed`);
}
async function waitForIndexes(databaseId) {
  for (let i = 0; i < 120; i += 1) {
    const res = await gcloudJson(['firestore', 'indexes', 'composite', 'list', `--database=${databaseId}`]);
    if (res.ok) {
      const state = plan.indexesReady(res.value);
      if (state.ready) { ok(`${state.total} composite indexes ready`); return; }
      if (i % 4 === 0) log(`  ... indexes building: ${state.notReady.length} of ${state.total} left`);
    }
    await sleep(15000);
  }
  fail('Indexes were not ready after 30 minutes');
}
const jobName = (fn) => `firebase-schedule-${fn}-${REGION}`;
async function setJobs(action) {
  for (const fn of plan.SCHEDULED_JOBS) {
    const res = await gcloud(['scheduler', 'jobs', action, jobName(fn), `--location=${REGION}`], { quiet: true });
    if (res.status !== 0 && !/already (paused|enabled)|is (paused|enabled)/i.test(res.stderr)) fail(`Could not ${action} ${jobName(fn)}:\n${res.stderr.trim()}`);
  }
  ok(`nightly jobs ${action === 'pause' ? 'paused' : 'resumed'}: ${plan.SCHEDULED_JOBS.join(', ')}`);
}
async function recreateTrigger() {
  const del = await runFirebase(['functions:delete', plan.TRIGGER_FUNCTION, '--region', REGION, '--project', PROJECT, '--force'], { attempts: 2 });
  logStream.write(del.output || '');
  const dep = await runFirebase(['deploy', '--only', `functions:${plan.TRIGGER_FUNCTION}`, '--project', PROJECT, '--non-interactive', '--force'], { attempts: 3 });
  logStream.write(dep.output || '');
  if (dep.status !== 0) fail(`Could not re-create ${plan.TRIGGER_FUNCTION}. Everything else is done; run: npm run deploy:functions -- --only functions:${plan.TRIGGER_FUNCTION}`);
  ok(`${plan.TRIGGER_FUNCTION} re-created for the new database`);
}
async function createDatabase(databaseId, location) {
  for (let i = 0; i < 40; i += 1) {
    const res = await gcloud(['firestore', 'databases', 'create', `--database=${databaseId}`, `--location=${location}`, '--type=firestore-native'], { quiet: true });
    if (res.status === 0) { ok(`database ${databaseId} created in ${location}`); return; }
    if (!/ALREADY_EXISTS|already exists|recently deleted|FAILED_PRECONDITION|try again|in use/i.test(res.stderr)) fail(`Creating ${databaseId} failed:\n${res.stderr.trim()}`);
    if (i % 2 === 0) log('  ... the name is not free yet (Google waits ~5 minutes after a delete); retrying');
    await sleep(30000);
  }
  fail(`${databaseId} could not be created within 20 minutes`);
}
async function deleteDatabase(databaseId) {
  await gcloud(['firestore', 'databases', 'update', `--database=${databaseId}`, '--no-delete-protection'], { quiet: true });
  await gcloudOrFail(['firestore', 'databases', 'delete', `--database=${databaseId}`], `Deleting ${databaseId}`);
  ok(`database ${databaseId} deleted`);
}

async function confirm(word) {
  if (args.has('--yes')) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(`\nType ${word} to start: `, resolve));
  rl.close();
  return answer.trim() === word;
}

// ---------- checks ----------
async function checks({ forMove }) {
  step('Checks (nothing is changed)');
  const account = (await gcloud(['config', 'get-value', 'account'], { quiet: true })).stdout.trim();
  if (!account) fail('gcloud is not signed in: run gcloud auth login and gcloud auth application-default login');
  ok(`gcloud signed in (${account.replace(/^(.).*(@.*)$/, '$1…$2')})`);
  const db = await describeDatabase(plan.DATABASE);
  if (!db) fail('The (default) database was not found');
  ok(`(default) is in ${db.locationId} (${db.type}, delete protection ${db.deleteProtectionState === 'DELETE_PROTECTION_ENABLED' ? 'on' : 'off'})`);
  // A quick read proves the local credentials reach the database.
  await dumpLib.withRetry('test read', () => firestoreFor(plan.DATABASE).collection('user_profiles').limit(1).get());
  ok('this computer can read the database');
  const fns = await run(process.execPath, [firebaseBin, 'functions:list', '--project', PROJECT, '--json'], { quiet: true });
  const listed = (() => { try { return JSON.parse(fns.stdout.slice(fns.stdout.indexOf('{'), fns.stdout.lastIndexOf('}') + 1)).result || []; } catch (_) { return []; } })();
  if (!listed.length) fail(`Could not list the functions:\n${fns.stderr.trim()}`);
  const trigger = listed.find((e) => e.id === plan.TRIGGER_FUNCTION);
  const gen1 = listed.filter((e) => e.platform === 'gcfv1').map((e) => e.id);
  if (gen1.length) warn(`still 1st gen (run npm run functions:gen2 first): ${gen1.join(', ')}`);
  if (!trigger) fail(`${plan.TRIGGER_FUNCTION} is not deployed`);
  ok(`${listed.length} functions deployed${gen1.length ? '' : ', all 2nd gen'}`);
  for (const fn of plan.SCHEDULED_JOBS) {
    const job = await gcloudJson(['scheduler', 'jobs', 'describe', jobName(fn), `--location=${REGION}`]);
    if (!job.ok) fail(`Scheduler job ${jobName(fn)} not found in ${REGION} (the 2nd gen move creates it)`);
  }
  ok('the 4 nightly scheduler jobs are found');
  // The new database gets its indexes only from firestore.indexes.json.
  const liveIx = await gcloudJson(['firestore', 'indexes', 'composite', 'list', `--database=${plan.DATABASE}`]);
  const liveFields = await gcloudJson(['firestore', 'indexes', 'fields', 'list', `--database=${plan.DATABASE}`]);
  if (!liveIx.ok || !liveFields.ok) fail(`Could not list the live indexes: ${liveIx.error || liveFields.error}`);
  const drift = plan.indexDrift(liveIx.value, liveFields.value, JSON.parse(fs.readFileSync(path.join(repoRoot, 'firestore.indexes.json'), 'utf8')));
  const missing = [...drift.missingInFile, ...drift.overridesMissingInFile];
  if (missing.length) (forMove ? fail : warn)(`production has indexes that firestore.indexes.json lacks (the new database would not get them): ${missing.join('; ')}`);
  else ok(`every live index is in firestore.indexes.json (${liveIx.value.length} composite${drift.newInFile.length ? `; ${drift.newInFile.length} more in the file will be created` : ''})`);
  // Say so when the move would also publish rule changes that are not live yet.
  const token = (await gcloud(['auth', 'print-access-token'], { quiet: true })).stdout.trim();
  try {
    const headers = { authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT };
    const releases = await (await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases`, { headers })).json();
    const release = (releases.releases || []).find((r) => r.name.endsWith('/cloud.firestore'));
    const ruleset = await (await fetch(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`, { headers })).json();
    const liveRules = ruleset.source.files[0].content.replace(/\r\n/g, '\n').trim();
    const repoRules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8').replace(/\r\n/g, '\n').trim();
    if (liveRules === repoRules) ok('firestore.rules matches the live rules');
    else warn(`firestore.rules differs from the live rules (live since ${release.updateTime}): the move publishes the repo version`);
  } catch (error) {
    warn(`could not compare the live rules: ${error.message || error}`);
  }
  await deployFirestore({ readonly: true, only: 'firestore:rules', dryRun: true });
  ok('read-only rules compile');
  await deployFirestore({ readonly: false, only: 'firestore', dryRun: true });
  ok('normal rules and indexes compile');
  const rehearsalLeft = await describeDatabase(plan.REHEARSAL_DATABASE);
  if (rehearsalLeft) warn(`a rehearsal database ${plan.REHEARSAL_DATABASE} still exists (it costs a little; --rehearse deletes it)`);
  // Devices must already have the cache-reset code before the move.
  await run('git', ['fetch', '--quiet', 'origin'], { quiet: true });
  const live = await run('git', ['show', 'origin/main:firebase.js'], { quiet: true });
  if (!/resetFirestoreCacheIfEpochChanged/.test(live.stdout)) {
    (forMove ? fail : warn)('the one-time device cache reset (firebase.js) is not on origin/main yet: push it and let it go live before the move');
  } else ok('the device cache reset is live on origin/main');
  if (forMove) {
    if (db.locationId !== plan.SOURCE_LOCATION) fail(`(default) is in ${db.locationId}; this move is from ${plan.SOURCE_LOCATION}`);
    if (!plan.rehearsalIsFresh(loadState())) fail(`No passed rehearsal in the last ${plan.REHEARSAL_VALID_DAYS} days: run npm run data:move -- --rehearse first`);
    ok(`rehearsal passed ${loadState().rehearsal.passedAt}`);
  }
  return db;
}

// ---------- rehearsal ----------
async function rehearse() {
  await checks({ forMove: false });
  step('Rehearsal plan');
  log(`  The app keeps running. A copy goes into a temporary database ${plan.REHEARSAL_DATABASE} in ${plan.TARGET_LOCATION},`);
  log('  is checked document by document against the live data, and is deleted again. Cost: a few cents.');
  if (!await confirm('REHEARSE')) { log('Not started. Nothing was changed.'); return; }
  const prefix = `rehearsal-${plan.stamp()}`;
  const t = {};
  const time = async (key, fn) => { const s = Date.now(); const r = await fn(); t[key] = Math.round((Date.now() - s) / 1000); return r; };
  step('Buckets'); await ensureBucket(BUCKETS.us); await ensureBucket(BUCKETS.eu);
  step('Reading the live database (before)');
  const before = await time('dump', () => dumpDatabase(plan.DATABASE, `${prefix}-before`));
  step('Google export'); const usFiles = await time('export', () => exportTo(prefix));
  step('Reading the live database (after)');
  const after = await dumpDatabase(plan.DATABASE, `${prefix}-after`);
  step('European copy'); await time('copy', () => copyExportToEu(prefix, usFiles));
  step(`Temporary database ${plan.REHEARSAL_DATABASE}`);
  if (await describeDatabase(plan.REHEARSAL_DATABASE)) await deleteDatabase(plan.REHEARSAL_DATABASE);
  await createDatabase(plan.REHEARSAL_DATABASE, plan.TARGET_LOCATION);
  try {
    step('Import into the temporary database');
    await time('import', () => importFrom(BUCKETS.eu.name, prefix, plan.REHEARSAL_DATABASE));
    step('1:1 check');
    const copy = await time('verify', () => dumpDatabase(plan.REHEARSAL_DATABASE, `${prefix}-copy`));
    const result = plan.compareRehearsal(before, after, copy);
    if (result.changedDuringRun.length) log(`  (${result.changedDuringRun.length} documents changed while the rehearsal ran; normal, the app was open: ${result.changedDuringRun.slice(0, 8).join(', ')})`);
    if (!result.ok) {
      result.problems.slice(0, 20).forEach((p) => log(`    ${p.problem}: ${p.path}`));
      fail(`Rehearsal FAILED: ${result.problems.length} documents differ. Nothing in production was touched.`);
    }
    ok(`all ${result.compared} documents identical in the copy`);
    const state = loadState();
    state.rehearsal = { passedAt: new Date().toISOString(), prefix, documents: before.size, seconds: t };
    saveState(state);
  } finally {
    step('Removing the temporary database');
    await deleteDatabase(plan.REHEARSAL_DATABASE);
  }
  log(`\nRehearsal passed. Timings (seconds): read ${t.dump}, export ${t.export}, copy ${t.copy}, import ${t.import}, check ${t.verify}.`);
  log('The real move: npm run data:move -- --go');
}

// ---------- the move ----------
async function move() {
  let state = loadState();
  const resuming = state.move && !state.move.finishedAt;
  if (!resuming) {
    await checks({ forMove: true });
    step('Plan');
    plan.MOVE_STEPS.forEach((s, i) => log(`  ${String(i + 1).padStart(2)}. ${s.label}${s.pointOfNoReturn ? '   <- from here the app is offline until step 14' : ''}`));
    log('\n  The app is read-only from step 2 and offline from step 8 until step 14 (about 20 minutes).');
    if (!await confirm('MOVE')) { log('Not started. Nothing was changed.'); return; }
    state.move = { prefix: `move-${plan.stamp()}`, startedAt: new Date().toISOString(), done: null };
    saveState(state);
  } else {
    log(`Continuing the move started ${state.move.startedAt} after step "${state.move.done || 'none'}".`);
  }
  const { prefix } = state.move;
  const mark = (id) => { state.move.done = id; saveState(state); };
  for (let id = plan.nextStep(state.move.done); id; id = plan.nextStep(state.move.done)) {
    const meta = plan.MOVE_STEPS[plan.stepIndex(id)];
    step(`${plan.stepIndex(id) + 1}/${plan.MOVE_STEPS.length} ${meta.label}`);
    try {
      switch (id) {
        case 'pause-jobs': await setJobs('pause'); break;
        case 'readonly-rules':
          await deployFirestore({ readonly: true, only: 'firestore:rules' });
          log('  ... waiting 90 s for the rules to reach every server and for writes in progress to finish');
          await sleep(90000);
          break;
        case 'dump-before': await dumpDatabase(plan.DATABASE, `${prefix}-before`); break;
        case 'export': {
          await ensureBucket(BUCKETS.us); await ensureBucket(BUCKETS.eu);
          // A rerun after a finished export reuses it; a half-written one is never reused.
          const existing = await gcloudJson(['storage', 'objects', 'list', `gs://${BUCKETS.us.name}/${prefix}/**`]);
          if (existing.ok && existing.value.length) {
            const files = await listExport(BUCKETS.us.name, prefix);
            if (!files.some((f) => f.startsWith(`${prefix}.overall_export_metadata `))) fail(`gs://${BUCKETS.us.name}/${prefix} holds an unfinished export. Run --rollback, then start the move again (it uses a new folder).`);
            state.move.usFiles = files;
            ok(`export already finished: ${files.length} files`);
          } else {
            state.move.usFiles = await exportTo(prefix);
          }
          saveState(state);
          break;
        }
        case 'dump-after': {
          const diff = dumpLib.compareManifests(loadManifest(`${prefix}-before`), await dumpDatabase(plan.DATABASE, `${prefix}-after`));
          if (!diff.equal) { reportDiff(diff); fail('Something was written while the database was read-only. Nothing was deleted: run npm run data:move -- --rollback, then look at the log.'); }
          ok('nothing changed while the copies were made');
          break;
        }
        case 'copy-eu': await copyExportToEu(prefix, state.move.usFiles); break;
        case 'export-verified':
          await gcloudOrFail(['storage', 'cp', path.join(STATE_DIR, `${prefix}-before.ndjson.gz`), path.join(STATE_DIR, `${prefix}-before.manifest.json`), `gs://${BUCKETS.eu.name}/${prefix}-typed-copy/`], 'Uploading the typed copy');
          ok(`three copies: gs://${BUCKETS.us.name}/${prefix}, gs://${BUCKETS.eu.name}/${prefix}, typed copy on this computer and in gs://${BUCKETS.eu.name}/${prefix}-typed-copy`);
          break;
        case 'delete-source': await deleteDatabase(plan.DATABASE); break;
        case 'create-target': await createDatabase(plan.DATABASE, plan.TARGET_LOCATION); break;
        case 'indexes': await deployFirestore({ readonly: true, only: 'firestore' }); await waitForIndexes(plan.DATABASE); break;
        case 'import': await importFrom(BUCKETS.eu.name, prefix, plan.DATABASE); await waitForIndexes(plan.DATABASE); break;
        case 'verify': {
          const diff = dumpLib.compareManifests(loadManifest(`${prefix}-before`), await dumpDatabase(plan.DATABASE, `${prefix}-europe`));
          if (!diff.equal) { reportDiff(diff); fail('The new database does not match the copy. It stays read-only. Run npm run data:move -- --rollback to put the database back in nam5.'); }
          ok(`all ${diff.sourceCount} documents identical (1:1)`);
          break;
        }
        case 'trigger': await recreateTrigger(); break;
        case 'normal-rules': await deployFirestore({ readonly: false, only: 'firestore:rules' }); break;
        case 'protect': await gcloudOrFail(['firestore', 'databases', 'update', `--database=${plan.DATABASE}`, '--delete-protection'], 'Turning on delete protection'); ok('delete protection on'); break;
        case 'resume-jobs': await setJobs('resume'); break;
        default: fail(`Unknown step ${id}`);
      }
      mark(id);
    } catch (error) {
      if (!(error instanceof Stop)) log(`  FAIL unexpected: ${error.stack || error}`);
      log(plan.pastPointOfNoReturn(state.move.done) || id === 'delete-source'
        ? '\n  Stopped after the old database was deleted. The copies are safe. Run the same command again to continue, or npm run data:move -- --rollback to go back to nam5.'
        : '\n  Stopped before anything was deleted. Run npm run data:move -- --rollback to reopen the app as it was.');
      throw error instanceof Stop ? error : new Stop(String(error));
    }
  }
  state.move.finishedAt = new Date().toISOString();
  saveState(state);
  log('\nDone: the database is in europe-west1, checked 1:1, writable again.');
  log('Last step for the devices: set FIRESTORE_DATA_EPOCH = \'europe-west1\' in constants.js, commit and push.');
}

// ---------- rollback ----------
async function rollback() {
  const state = loadState();
  if (!state.move) fail('No move has been started from this computer.');
  const { prefix } = state.move;
  const db = await describeDatabase(plan.DATABASE);
  // The original is still there whenever (default) is in nam5 and the move had not reached the
  // delete step: then only the rules and the jobs are put back, and no data is touched.
  const originalIntact = Boolean(db) && db.locationId === plan.SOURCE_LOCATION && !plan.pastPointOfNoReturn(state.move.done);
  if (!originalIntact && db && db.locationId === plan.SOURCE_LOCATION) {
    fail(`(default) is in ${plan.SOURCE_LOCATION} but the move had passed the delete step (${state.move.done}). It was probably rolled back already; check the app before doing anything else.`);
  }
  if (!originalIntact && !fs.existsSync(path.join(STATE_DIR, `${prefix}-before.manifest.json`))) fail('The typed copy of this move is missing on this computer; restore by hand from the exports (see the runbook).');
  step('Rollback plan');
  if (originalIntact) {
    log('  The old database was never deleted: normal rules back on, nightly jobs resumed. No data is touched.');
  } else {
    log(`  Put (default) back in ${plan.SOURCE_LOCATION} from gs://${BUCKETS.us.name}/${prefix}, check it 1:1, reopen it.`);
  }
  if (!await confirm('ROLLBACK')) { log('Not started. Nothing was changed.'); return; }
  if (originalIntact) {
    await deployFirestore({ readonly: false, only: 'firestore:rules' });
    await setJobs('resume');
    state.move.rolledBackAt = new Date().toISOString(); state.move.finishedAt = state.move.rolledBackAt; saveState(state);
    log('\nRolled back: the app works as before.');
    return;
  }
  step('Database back in nam5');
  if (db) await deleteDatabase(plan.DATABASE);
  await createDatabase(plan.DATABASE, plan.SOURCE_LOCATION);
  await deployFirestore({ readonly: true, only: 'firestore' });
  await waitForIndexes(plan.DATABASE);
  await importFrom(BUCKETS.us.name, prefix, plan.DATABASE);
  await waitForIndexes(plan.DATABASE);
  const diff = dumpLib.compareManifests(loadManifest(`${prefix}-before`), await dumpDatabase(plan.DATABASE, `${prefix}-rollback`));
  if (!diff.equal) { reportDiff(diff); fail('The restored database does not match the copy; it stays read-only. The typed copy and both exports are untouched.'); }
  ok(`all ${diff.sourceCount} documents identical (1:1)`);
  await recreateTrigger();
  await deployFirestore({ readonly: false, only: 'firestore:rules' });
  await setJobs('resume');
  state.move.rolledBackAt = new Date().toISOString(); state.move.finishedAt = state.move.rolledBackAt; saveState(state);
  log('\nRolled back: the database is in nam5 again, checked 1:1, writable.');
}

(async () => {
  log(`Database move nam5 → europe-west1 · mode: ${MODE} · project: ${PROJECT}`);
  log(`Log: ${LOG_FILE}`);
  try {
    if (MODE === 'check') { await checks({ forMove: false }); log('\nAll checks passed. Next: npm run data:move -- --rehearse'); }
    else if (MODE === 'rehearse') await rehearse();
    else if (MODE === 'go') await move();
    else await rollback();
    log(`Log: ${LOG_FILE}`);
    logStream.end();
  } catch (error) {
    if (!(error instanceof Stop)) log(`\nUnexpected error: ${error.stack || error}`);
    log(`\nLog: ${LOG_FILE}`);
    logStream.end(() => process.exit(1));
  }
})();
