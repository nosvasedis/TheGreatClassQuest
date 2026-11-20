#!/usr/bin/env node
'use strict';

// Moves every Cloud Function from 1st gen (Node.js 22) to 2nd gen (Node.js 24), safely.
//
//   npm run functions:gen2                 checks everything, shows the plan, asks you to type MIGRATE
//   npm run functions:gen2 -- --check      checks only, changes nothing
//   npm run functions:gen2 -- --rollback   puts every function back on 1st gen / Node.js 22
//   --yes        do not ask before starting      --any-time   allow 23:30–05:00 Athens
//
// What it does (runbook: tools/FUNCTIONS_GEN2_MIGRATION.md):
//   1. Checks: Firebase login, what is deployed, that the new code defines exactly the same
//      functions, the test suite, a full dry-run deploy, and a ready 1st gen copy for rollback.
//   2. The one function that is already 2nd gen moves to Node.js 24 with a normal deploy.
//   3. The others go in small batches: delete the 1st gen function, deploy the 2nd gen one with
//      the same name (same URL), then prove it is live. If a batch fails, that batch is put back
//      on 1st gen at once and the run stops, so the app is never left without a function.

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const { repoRoot, firebaseBin, firebaseEnv, runFirebase } = require('./lib/firebase-cli.cjs');
const plan = require('./lib/functionsGen2Plan.cjs');

const args = new Set(process.argv.slice(2));
const MODE = args.has('--rollback') ? 'rollback' : args.has('--check') ? 'check' : 'migrate';
const PROJECT = JSON.parse(fs.readFileSync(path.join(repoRoot, '.firebaserc'), 'utf8')).projects.default;
const ROLLBACK_DIR = path.join(os.tmpdir(), `gcq-functions-gen1-${plan.ROLLBACK_REF}`);
const LOG_FILE = path.join(os.tmpdir(), `gcq-functions-gen2-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const startedAt = Date.now();

// ---------- output ----------
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
function log(line = '') {
  process.stdout.write(`${line}\n`);
  logStream.write(`${line}\n`);
}
const step = (text) => log(`\n=== ${text}`);
const ok = (text) => log(`  OK   ${text}`);
const warn = (text) => log(`  WARN ${text}`);
class Stop extends Error {}
function fail(text) {
  log(`  FAIL ${text}`);
  throw new Stop(text);
}
const minutes = () => `${((Date.now() - startedAt) / 60000).toFixed(1)} min`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- processes ----------
function run(command, commandArgs, { cwd = repoRoot, env = process.env, shell = false, echo = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, { cwd, env, shell, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; if (echo) process.stdout.write(d); logStream.write(d); });
    child.stderr.on('data', (d) => { stderr += d; if (echo) process.stderr.write(d); logStream.write(d); });
    child.on('error', (error) => resolve({ status: -1, stdout, stderr: String(error) }));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

async function firebaseJson(firebaseArgs, cwd = repoRoot) {
  const result = await run(process.execPath, [firebaseBin, ...firebaseArgs, '--json', '--project', PROJECT], { cwd, env: firebaseEnv() });
  const text = result.stdout;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  let parsed = null;
  try { parsed = JSON.parse(text.slice(start, end + 1)); } catch (_) { /* reported below */ }
  if (result.status !== 0 || !parsed || parsed.status !== 'success') {
    fail(`firebase ${firebaseArgs.join(' ')} failed:\n${(parsed && parsed.error) || result.stderr || text}`);
  }
  return parsed.result;
}

async function liveFunctions() {
  const endpoints = await firebaseJson(['functions:list']);
  return endpoints.map((e) => ({ id: e.id, platform: e.platform, runtime: e.runtime, region: e.region }));
}

// Loads a functions folder in its own Node process and reports what it would deploy.
async function codeFunctions(functionsDir) {
  const probe = `
    process.env.GCLOUD_PROJECT = ${JSON.stringify(PROJECT)};
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: ${JSON.stringify(PROJECT)}, storageBucket: ${JSON.stringify(`${PROJECT}.appspot.com`)} });
    const mod = require(${JSON.stringify(path.join(functionsDir, 'index.js'))});
    const out = Object.keys(mod).map((id) => {
      const e = mod[id].__endpoint || {};
      const kind = e.callableTrigger ? 'callable' : e.scheduleTrigger ? 'schedule' : e.httpsTrigger ? 'https' : e.eventTrigger ? 'event' : 'unknown';
      return { id, platform: e.platform, kind };
    });
    process.stdout.write('@@' + JSON.stringify(out) + '@@');`;
  const result = await run(process.execPath, ['-e', probe], { cwd: functionsDir });
  const match = /@@(.*)@@/s.exec(result.stdout);
  if (result.status !== 0 || !match) fail(`Could not load ${functionsDir}:\n${result.stderr}`);
  return JSON.parse(match[1]);
}

async function deploy(names, { cwd = repoRoot, label }) {
  const only = names.map((n) => `functions:${n}`).join(',');
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    log(`  ... deploying ${label} (attempt ${attempt}/3, ${minutes()})`);
    const result = await runFirebase(['deploy', '--only', only, '--project', PROJECT, '--non-interactive', '--force'], { cwd, attempts: 2 });
    logStream.write(result.output || '');
    if (result.status === 0) return true;
    warn(`deploy attempt ${attempt} failed (exit ${result.status})`);
    if (attempt < 3) await sleep(20000);
  }
  return false;
}

async function deleteFunctions(names) {
  log(`  ... deleting ${names.join(', ')}`);
  const result = await runFirebase(['functions:delete', ...names, '--region', plan.REGION, '--project', PROJECT, '--force'], { attempts: 2 });
  logStream.write(result.output || '');
  return result.status === 0;
}

// On Windows gcloud is a .cmd file, which Node only starts through the shell, so every
// argument is quoted (formats such as value(state,schedule) contain commas and brackets).
async function gcloud(gcloudArgs) {
  const all = [...gcloudArgs, '--project', PROJECT, '--quiet'];
  if (process.platform === 'win32') return run(['gcloud', ...all.map((a) => `"${a}"`)].join(' '), [], { shell: true });
  return run('gcloud', all);
}

// ---------- checks after a batch ----------
async function verifyBatch(names, kinds, { platform, runtime }) {
  const live = new Map((await liveFunctions()).map((e) => [e.id, e]));
  for (const name of names) {
    const e = live.get(name);
    if (!e) return `${name} is not deployed`;
    if (e.platform !== platform) return `${name} is ${e.platform}, expected ${platform}`;
    if (runtime && e.runtime !== runtime) return `${name} runs ${e.runtime}, expected ${runtime}`;
  }
  // Reachable at the same address as before (what the app and Stripe call).
  for (const name of names.filter((n) => ['callable', 'https'].includes(kinds.get(n)))) {
    const url = `https://${plan.REGION}-${PROJECT}.cloudfunctions.net/${name}`;
    let status = 0;
    for (let i = 0; i < 18; i += 1) {
      try { status = (await fetch(url, { method: 'GET' })).status; } catch (_) { status = 0; }
      if (plan.probeIsHealthy(kinds.get(name), status)) break;
      await sleep(10000);
    }
    if (!plan.probeIsHealthy(kinds.get(name), status)) return `${url} answered ${status}`;
  }
  return null;
}

async function verifySchedules(names) {
  for (const name of names) {
    const job = await gcloud(['scheduler', 'jobs', 'describe', plan.schedulerJobName(name), '--location', plan.REGION, '--format=value(state,schedule)']);
    if (job.status !== 0 || !/ENABLED/.test(job.stdout)) return `Cloud Scheduler job for ${name} is missing in ${plan.REGION}`;
    ok(`${name}: Cloud Scheduler ${job.stdout.trim().replace(/\s+/g, ' ')}`);
  }
  return null;
}

// Old 1st gen schedule jobs live in us-central1. functions:delete removes them; this only
// cleans up one that was left behind, so it can never fire into nothing.
async function removeOldScheduleJobs(names) {
  for (const name of names) {
    const job = await gcloud(['scheduler', 'jobs', 'describe', plan.schedulerJobName(name), '--location', 'us-central1', '--format=value(state)']);
    if (job.status === 0) {
      const removed = await gcloud(['scheduler', 'jobs', 'delete', plan.schedulerJobName(name), '--location', 'us-central1']);
      if (removed.status === 0) ok(`removed the old 1st gen schedule of ${name}`);
      else warn(`old 1st gen schedule of ${name} is still in us-central1 (remove it in the Cloud console)`);
    }
  }
}

// ---------- rollback copy ----------
async function prepareRollbackCopy(codeIds) {
  if (!fs.existsSync(path.join(ROLLBACK_DIR, 'functions', 'index.js'))) {
    await run('git', ['worktree', 'prune'], { cwd: repoRoot });
    const added = await run('git', ['worktree', 'add', '--detach', ROLLBACK_DIR, plan.ROLLBACK_REF], { cwd: repoRoot });
    if (added.status !== 0) fail(`Could not make the rollback copy:\n${added.stderr}`);
  }
  const head = (await run('git', ['rev-parse', 'HEAD'], { cwd: ROLLBACK_DIR })).stdout.trim();
  const want = (await run('git', ['rev-parse', plan.ROLLBACK_REF], { cwd: repoRoot })).stdout.trim();
  if (!head || head !== want) fail(`${ROLLBACK_DIR} is not at ${plan.ROLLBACK_REF}; delete that folder and run again`);
  // Settings that are not in git (Stripe on, prices, tax rate) must match what is live.
  fs.copyFileSync(path.join(repoRoot, 'functions', '.env'), path.join(ROLLBACK_DIR, 'functions', '.env'));
  if (!fs.existsSync(path.join(ROLLBACK_DIR, 'functions', 'node_modules', 'firebase-functions'))) {
    log('  ... installing the rollback copy (npm ci)');
    const installed = await run('npm ci --no-audit --no-fund', [], { cwd: path.join(ROLLBACK_DIR, 'functions'), shell: true });
    if (installed.status !== 0) fail(`npm ci in the rollback copy failed:\n${installed.stderr}`);
  }
  const old = await codeFunctions(path.join(ROLLBACK_DIR, 'functions'));
  const oldIds = old.map((e) => e.id).sort();
  if (JSON.stringify(oldIds) !== JSON.stringify([...codeIds].sort())) {
    fail(`The rollback copy defines different functions:\n  old: ${oldIds.join(', ')}\n  new: ${[...codeIds].sort().join(', ')}`);
  }
  const notGen1 = old.filter((e) => e.platform !== 'gcfv1' && e.id !== 'reconcileSpecialQuestEffects');
  if (notGen1.length) fail(`Rollback copy has non-1st-gen functions: ${notGen1.map((e) => e.id).join(', ')}`);
  ok(`rollback copy ready (${plan.ROLLBACK_REF}, 1st gen, Node.js 22): ${ROLLBACK_DIR}`);
  return old;
}

// Puts these functions back exactly as they were before tonight.
async function restoreGen1(names, kinds) {
  log(`\n  >>> Putting back on 1st gen: ${names.join(', ')}`);
  const live = new Map((await liveFunctions()).map((e) => [e.id, e]));
  const gen2 = names.filter((n) => live.get(n)?.platform === 'gcfv2');
  if (gen2.length && !await deleteFunctions(gen2)) warn('delete of the 2nd gen copies failed; trying the deploy anyway');
  if (!await deploy(names, { cwd: ROLLBACK_DIR, label: '1st gen copy' })) return false;
  const problem = await verifyBatch(names, kinds, { platform: 'gcfv1' });
  if (problem) { warn(problem); return false; }
  ok(`back on 1st gen: ${names.join(', ')}`);
  return true;
}

function manualRestoreHelp(names) {
  log('\n  The automatic restore did not finish. Run this to put the batch back on 1st gen:');
  log(`    cd "${ROLLBACK_DIR}"`);
  log(`    node "${firebaseBin}" deploy --only ${names.map((n) => `functions:${n}`).join(',')} --project ${PROJECT} --force`);
  log('  (If it says a function is 2nd gen, first: npm run functions:gen2 -- --rollback)');
}

// ---------- main ----------
async function preflight() {
  step('Checks (nothing is changed)');
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 22) fail(`Node.js ${process.versions.node} on this computer; install Node.js 24`);
  if (nodeMajor !== 24) warn(`this computer has Node.js ${process.versions.node}; Node.js 24 is recommended`);
  else ok(`Node.js ${process.versions.node}`);

  const code = await codeFunctions(path.join(repoRoot, 'functions'));
  const notGen2 = code.filter((e) => e.platform !== 'gcfv2');
  if (notGen2.length) fail(`The code still has 1st gen functions: ${notGen2.map((e) => e.id).join(', ')}`);
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'functions', 'package.json'), 'utf8'));
  if (pkg.engines?.node !== '24') fail(`functions/package.json engines.node is ${pkg.engines?.node}, expected 24`);
  ok(`new code: ${code.length} functions, all 2nd gen, Node.js 24`);

  const live = await liveFunctions();
  ok(`signed in; ${live.length} functions live in ${PROJECT}`);
  const result = plan.planMigration(code, live);
  if (result.problems.length) fail(result.problems.join('\n'));
  if (result.create.length) warn(`new functions that are not live yet (created in the last batch): ${result.create.join(', ')}`);

  const kinds = new Map(code.map((e) => [e.id, e.kind]));
  const old = await prepareRollbackCopy(code.map((e) => e.id));
  old.forEach((e) => { if (!kinds.has(e.id)) kinds.set(e.id, e.kind); });

  const changed = (await run('git', ['diff', '--name-only', plan.ROLLBACK_REF, '--', 'functions'], { cwd: repoRoot })).stdout.trim().split(/\r?\n/).filter(Boolean);
  const expected = ['functions/index.js', 'functions/adventurePicture.js', 'functions/avatarForge.js', 'functions/package.json', 'functions/package-lock.json'];
  const extra = changed.filter((f) => !expected.includes(f));
  if (extra.length) warn(`functions files changed since ${plan.ROLLBACK_REF} besides the move itself (a rollback would undo them too): ${extra.join(', ')}`);

  if (MODE !== 'rollback') {
    log('  ... running the test suite');
    const tests = await run(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--test'], { cwd: repoRoot });
    const summary = /ℹ pass (\d+)[\s\S]*?ℹ fail (\d+)/.exec(tests.stdout);
    if (tests.status !== 0 || !summary || summary[2] !== '0') fail(`tests failed (see ${LOG_FILE})`);
    ok(`tests: ${summary[1]} passed`);

    log('  ... dry-run deploy of every function (validates settings, secrets and APIs)');
    const dry = await runFirebase(['deploy', '--only', 'functions', '--project', PROJECT, '--dry-run', '--non-interactive'], { attempts: 3 });
    logStream.write(dry.output || '');
    if (dry.status !== 0) fail('dry-run deploy failed (see the log)');
    ok('dry-run deploy passed');
  }

  if (MODE === 'migrate' && plan.inNightlyWindow() && !args.has('--any-time')) {
    const { hour, minute } = plan.athensParts();
    fail(`It is ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} in Athens. The nightly jobs run 00:10–04:30, so start before 23:30 (or pass --any-time).`);
  }
  return { code, live, result, kinds };
}

async function migrate({ result, kinds }) {
  step('Plan');
  if (result.gen2Update.length) log(`  Node.js 24 update, no downtime: ${result.gen2Update.join(', ')}`);
  result.batches.forEach((b, i) => log(`  Batch ${i + 1} (${b.label}): ${b.names.join(', ')}`));
  if (result.create.length) log(`  New: ${result.create.join(', ')}`);
  if (!result.gen2Update.length && !result.batches.length && !result.create.length) {
    ok('everything is already 2nd gen on Node.js 24. Nothing to do.');
    return;
  }
  log('\n  Each batch is offline for a few minutes while it is replaced. Anyone who uses one of');
  log('  those features in those minutes sees an error and can simply try again.');

  if (!args.has('--yes')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => rl.question('\nType MIGRATE to start: ', resolve));
    rl.close();
    if (answer.trim() !== 'MIGRATE') { log('Not started. Nothing was changed.'); return; }
  }

  if (result.gen2Update.length) {
    step(`Node.js 24 for ${result.gen2Update.join(', ')} (no downtime)`);
    if (!await deploy(result.gen2Update, { label: 'update' })) fail('could not update; nothing else was touched and everything still runs as before');
    const problem = await verifyBatch(result.gen2Update, kinds, { platform: 'gcfv2', runtime: plan.TARGET_RUNTIME });
    if (problem) fail(problem);
    ok(`${result.gen2Update.join(', ')} on Node.js 24`);
  }

  for (const [index, batch] of result.batches.entries()) {
    step(`Batch ${index + 1}/${result.batches.length} (${batch.label}): ${batch.names.join(', ')}  [${minutes()}]`);
    let problem = null;
    try {
      if (!await deleteFunctions(batch.names)) {
        problem = 'delete failed';
      } else if (!await deploy(batch.names, { label: `batch ${index + 1}` })) {
        problem = 'deploy failed';
      } else {
        problem = await verifyBatch(batch.names, kinds, { platform: 'gcfv2', runtime: plan.TARGET_RUNTIME });
        const schedules = batch.names.filter((n) => kinds.get(n) === 'schedule');
        if (!problem && schedules.length) {
          problem = await verifySchedules(schedules);
          if (!problem) await removeOldScheduleJobs(schedules);
        }
      }
    } catch (error) {
      problem = `unexpected error: ${error.message || error}`;
    }
    if (problem) {
      warn(problem);
      const restored = await restoreGen1(batch.names, kinds).catch((error) => { warn(String(error.message || error)); return false; });
      if (!restored) manualRestoreHelp(batch.names);
      fail(`Stopped at batch ${index + 1}. ${restored ? 'That batch is back on 1st gen and everything works as before.' : 'See the steps above.'} Earlier batches are already on 2nd gen and working. Log: ${LOG_FILE}`);
    }
    ok(`batch ${index + 1} live on 2nd gen, Node.js 24`);
  }

  if (result.create.length) {
    step(`New functions: ${result.create.join(', ')}`);
    if (!await deploy(result.create, { label: 'new functions' })) fail('could not create the new functions (everything else is migrated)');
  }

  step('Final check');
  const live = await liveFunctions();
  const left = live.filter((e) => e.platform !== 'gcfv2' || e.runtime !== plan.TARGET_RUNTIME);
  if (left.length) fail(`Not yet on 2nd gen / Node.js 24: ${left.map((e) => `${e.id} (${e.platform} ${e.runtime})`).join(', ')}`);
  ok(`all ${live.length} functions are 2nd gen on Node.js 24 (${minutes()})`);
}

async function rollback({ kinds }) {
  step('Rollback to 1st gen / Node.js 22');
  const live = await liveFunctions();
  const toRestore = live.filter((e) => e.platform === 'gcfv2' && e.id !== 'reconcileSpecialQuestEffects').map((e) => e.id);
  const reconcile = live.find((e) => e.id === 'reconcileSpecialQuestEffects');
  const batches = plan.planMigration(toRestore.map((id) => ({ id })), toRestore.map((id) => ({ id, platform: 'gcfv1', region: plan.REGION }))).batches;
  batches.forEach((b, i) => log(`  Batch ${i + 1} (${b.label}): ${b.names.join(', ')}`));
  if (reconcile && reconcile.runtime !== 'nodejs22') log('  Then: reconcileSpecialQuestEffects back to Node.js 22 (stays 2nd gen, as before)');
  if (!batches.length && !(reconcile && reconcile.runtime !== 'nodejs22')) { ok('nothing to roll back'); return; }
  if (!args.has('--yes')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => rl.question('\nType ROLLBACK to start: ', resolve));
    rl.close();
    if (answer.trim() !== 'ROLLBACK') { log('Not started. Nothing was changed.'); return; }
  }
  for (const [index, batch] of batches.entries()) {
    step(`Rollback batch ${index + 1}/${batches.length}: ${batch.names.join(', ')}  [${minutes()}]`);
    const restored = await restoreGen1(batch.names, kinds).catch((error) => { warn(String(error.message || error)); return false; });
    if (!restored) { manualRestoreHelp(batch.names); fail('rollback stopped'); }
  }
  if (reconcile && reconcile.runtime !== 'nodejs22') {
    if (!await deploy(['reconcileSpecialQuestEffects'], { cwd: ROLLBACK_DIR, label: 'trigger on Node.js 22' })) fail('could not move the trigger back to Node.js 22');
  }
  ok(`rollback finished (${minutes()}). The code in this folder is still the 2nd gen version: revert it before the next normal deploy.`);
}

(async () => {
  log(`Cloud Functions: 1st gen → 2nd gen / Node.js 24 · mode: ${MODE} · project: ${PROJECT}`);
  log(`Log file: ${LOG_FILE}`);
  try {
    const state = await preflight();
    if (MODE === 'check') {
      step('Plan (check only, nothing was changed)');
      if (state.result.gen2Update.length) log(`  Node.js 24 update, no downtime: ${state.result.gen2Update.join(', ')}`);
      state.result.batches.forEach((b, i) => log(`  Batch ${i + 1} (${b.label}): ${b.names.join(', ')}`));
      log('\nAll checks passed. Run `npm run functions:gen2` to migrate.');
    } else if (MODE === 'rollback') {
      await rollback(state);
    } else {
      await migrate(state);
      log('\nDone. Everything is on 2nd gen and Node.js 24.');
    }
    log(`Log file: ${LOG_FILE}`);
    logStream.end();
  } catch (error) {
    if (!(error instanceof Stop)) log(`\nUnexpected error: ${error.stack || error}`);
    log(`\nLog file: ${LOG_FILE}`);
    logStream.end(() => process.exit(1));
  }
})();
