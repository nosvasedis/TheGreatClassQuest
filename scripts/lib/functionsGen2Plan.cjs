'use strict';

// Pure planning rules for moving the Cloud Functions from 1st gen (Node.js 22) to 2nd gen
// (Node.js 24). No I/O here: scripts/migrate-functions-gen2.cjs does the work and these rules
// are unit-tested in tests/functions-gen2-migration.test.js.
//
// Why batches: Google cannot upgrade a function from 1st to 2nd gen in place. Each one is
// deleted and created again under the same name (same URL), so it is offline for a few
// minutes. Small batches keep most of the app working at any moment, and a failure stops the
// run with only one batch affected (that batch is then put back on 1st gen).

const REGION = 'europe-west1';
const TARGET_RUNTIME = 'nodejs24';

// The commit that moved the functions to 2nd gen. The rollback copy is the current commit with
// only this commit reversed, so a rollback keeps everyone else's later work on the functions.
const PORT_COMMIT = '0fe33ff46b72084e2b14c8f4c4c09e62c5cdb76f';

// Order matters: prove the new setup on functions nobody waits on, then the nightly jobs,
// then payments, then everything else.
const CANARY = ['getOperatorStatus', 'previewYearRollover', 'backfillSchoolYearData'];
const NIGHTLY = ['purgeLeftSchoolStudents', 'maintainShopStock', 'prepareShopStock', 'stripeSummerPause'];
const PAYMENTS = ['stripeWebhook', 'billingCreateCheckout', 'billingCreatePortal'];
const BATCH_SIZE = 17;

// Nightly jobs run at 00:10 Athens (Market), 00:30 UTC = 02:30 Athens (next month's
// pictures) and 04:30 Athens (Stripe summer pause). Never take them down around those times.
const QUIET_START = { hour: 23, minute: 30 }; // Athens
const QUIET_END = { hour: 5, minute: 0 };     // Athens

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * @param {Array<{id:string, kind:string}>} code  functions the new source defines (all 2nd gen)
 * @param {Array<{id:string, platform:string, runtime:string, region:string}>} live  deployed now
 */
function planMigration(code, live) {
  const liveById = new Map(live.filter((e) => e.region === REGION).map((e) => [e.id, e]));
  const codeIds = new Set(code.map((e) => e.id));
  const problems = [];

  const notInCode = [...liveById.keys()].filter((id) => !codeIds.has(id)).sort();
  if (notInCode.length) problems.push(`Deployed but missing from the code: ${notInCode.join(', ')}`);
  const otherRegion = live.filter((e) => e.region !== REGION).map((e) => `${e.id} (${e.region})`);
  if (otherRegion.length) problems.push(`Functions outside ${REGION}: ${otherRegion.join(', ')}`);

  const gen1 = [];          // must be deleted and created again
  const gen2Update = [];    // already 2nd gen: a normal deploy moves it to Node.js 24, no downtime
  const done = [];          // already 2nd gen on Node.js 24
  const create = [];        // in the code, not deployed yet
  for (const { id } of code) {
    const have = liveById.get(id);
    if (!have) create.push(id);
    else if (have.platform === 'gcfv1') gen1.push(id);
    else if (have.runtime !== TARGET_RUNTIME) gen2Update.push(id);
    else done.push(id);
  }

  const remaining = new Set(gen1);
  const take = (names) => names.filter((n) => remaining.delete(n));
  const batches = [];
  for (const [label, names] of [['canary', CANARY], ['nightly jobs', NIGHTLY], ['payments', PAYMENTS]]) {
    const picked = take(names);
    if (picked.length) batches.push({ label, names: picked });
  }
  chunk([...remaining].sort(), BATCH_SIZE).forEach((names, i) => batches.push({ label: `callables ${i + 1}`, names }));

  return { problems, gen1, gen2Update, done, create: create.sort(), batches };
}

function athensParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { hour: get('hour'), minute: get('minute') };
}

// True between 23:30 and 05:00 Athens time, when the nightly jobs run.
function inNightlyWindow(date = new Date()) {
  const { hour, minute } = athensParts(date);
  const m = hour * 60 + minute;
  const start = QUIET_START.hour * 60 + QUIET_START.minute;
  const end = QUIET_END.hour * 60 + QUIET_END.minute;
  return m >= start || m < end;
}

// A plain GET never runs a function's own code: a live callable answers 400 (it only accepts
// POST), the Stripe webhook answers 405. 403 / 404 mean the new function is not reachable yet.
function probeIsHealthy(kind, status) {
  if (kind === 'callable') return status === 400;
  if (kind === 'https') return status === 405;
  return false;
}

function schedulerJobName(id) {
  return `firebase-schedule-${id}-${REGION}`;
}

module.exports = {
  REGION,
  TARGET_RUNTIME,
  PORT_COMMIT,
  CANARY,
  NIGHTLY,
  PAYMENTS,
  BATCH_SIZE,
  planMigration,
  athensParts,
  inNightlyWindow,
  probeIsHealthy,
  schedulerJobName,
};
