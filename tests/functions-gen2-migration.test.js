const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const plan = require('../scripts/lib/functionsGen2Plan.cjs');

const root = path.resolve(__dirname, '..');
const NAMES = [
  'reconcileSpecialQuestEffects', 'getOperatorStatus', 'previewYearRollover', 'backfillSchoolYearData',
  'purgeLeftSchoolStudents', 'maintainShopStock', 'prepareShopStock', 'stripeSummerPause',
  'stripeWebhook', 'billingCreateCheckout', 'billingCreatePortal',
  ...Array.from({ length: 40 }, (_, i) => `callable${String(i).padStart(2, '0')}`),
];
const code = NAMES.map((id) => ({ id, kind: 'callable' }));
const liveToday = NAMES.map((id) => ({
  id,
  region: 'europe-west1',
  platform: id === 'reconcileSpecialQuestEffects' ? 'gcfv2' : 'gcfv1',
  runtime: 'nodejs22',
}));

test('every 1st gen function is moved exactly once; canary, nightly jobs and payments go first', () => {
  const result = plan.planMigration(code, liveToday);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.gen2Update, ['reconcileSpecialQuestEffects']);
  const moved = result.batches.flatMap((b) => b.names);
  assert.equal(moved.length, NAMES.length - 1);
  assert.equal(new Set(moved).size, moved.length);
  assert.deepEqual(result.batches.slice(0, 3).map((b) => b.label), ['canary', 'nightly jobs', 'payments']);
  assert.deepEqual(result.batches[0].names, plan.CANARY);
  assert.ok(result.batches.every((b) => b.names.length <= plan.BATCH_SIZE));
});

test('a rerun after a stop only picks up what is still 1st gen', () => {
  const halfway = liveToday.map((e) => (plan.CANARY.includes(e.id) || e.id === 'reconcileSpecialQuestEffects'
    ? { ...e, platform: 'gcfv2', runtime: 'nodejs24' } : e));
  const result = plan.planMigration(code, halfway);
  assert.deepEqual(result.gen2Update, []);
  assert.equal(result.batches[0].label, 'nightly jobs');
  assert.ok(!result.batches.flatMap((b) => b.names).some((n) => plan.CANARY.includes(n)));
  const done = plan.planMigration(code, liveToday.map((e) => ({ ...e, platform: 'gcfv2', runtime: 'nodejs24' })));
  assert.deepEqual(done.batches, []);
  assert.equal(done.done.length, NAMES.length);
});

test('refuses to run when the code and what is deployed disagree', () => {
  const result = plan.planMigration(code.slice(1), liveToday);
  assert.match(result.problems.join(' '), /missing from the code: reconcileSpecialQuestEffects/);
  const elsewhere = plan.planMigration(code, [...liveToday, { id: 'old', region: 'us-central1', platform: 'gcfv1' }]);
  assert.match(elsewhere.problems.join(' '), /outside europe-west1/);
});

test('the nightly jobs window is 23:30–05:00 Athens time', () => {
  // 20 November: Athens is UTC+2.
  assert.equal(plan.inNightlyWindow(new Date('2026-11-20T21:29:00Z')), false);
  assert.equal(plan.inNightlyWindow(new Date('2026-11-20T21:30:00Z')), true);
  assert.equal(plan.inNightlyWindow(new Date('2026-11-21T02:59:00Z')), true);
  assert.equal(plan.inNightlyWindow(new Date('2026-11-21T03:00:00Z')), false);
  assert.equal(plan.inNightlyWindow(new Date('2026-11-20T17:00:00Z')), false);
});

test('health probes never run a function: GET on a callable is 400, on the webhook 405', () => {
  assert.equal(plan.probeIsHealthy('callable', 400), true);
  assert.equal(plan.probeIsHealthy('callable', 403), false);
  assert.equal(plan.probeIsHealthy('callable', 404), false);
  assert.equal(plan.probeIsHealthy('https', 405), true);
  assert.equal(plan.probeIsHealthy('https', 200), false);
  assert.equal(plan.schedulerJobName('maintainShopStock'), 'firebase-schedule-maintainShopStock-europe-west1');
});

test('the migration is one npm command and is wired to the plan', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['functions:gen2'], 'node scripts/migrate-functions-gen2.cjs');
  const script = fs.readFileSync(path.join(root, 'scripts/migrate-functions-gen2.cjs'), 'utf8');
  assert.match(script, /restoreGen1\(batch\.names, kinds\)/);
  assert.match(script, /Type MIGRATE to start/);
  assert.match(script, /inNightlyWindow\(\)/);
});
