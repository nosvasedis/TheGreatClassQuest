// Runs the real operator / join-code handlers (functions/platform.js) against the Firestore
// emulator with the Admin SDK. Run: npm run test:platform
const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const FUNCTIONS = path.resolve(__dirname, '..', '..', 'functions');
const { initializeApp } = require(require.resolve('firebase-admin/app', { paths: [FUNCTIONS] }));
const { getFirestore, FieldValue, Timestamp } = require(require.resolve('firebase-admin/firestore', { paths: [FUNCTIONS] }));
const { createPlatformHandlers } = require(path.join(FUNCTIONS, 'platform.js'));
const { runInSchool } = require(path.join(FUNCTIONS, 'tenant.js'));

const emulated = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const platformTest = emulated ? test : () => {};
const ROOT = 'artifacts/great-class-quest/public/data';

class HttpsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

let db;
let handlers;

if (emulated) before(() => {
  initializeApp({ projectId: 'demo-gcq' });
  db = getFirestore();
  // The real handlers, with simple stand-ins for the caller checks that live in index.js.
  handlers = createPlatformHandlers({
    db, FieldValue, Timestamp, HttpsError,
    requireAuthedCaller: async (request) => {
      if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
      const snap = await db.collection('user_profiles').doc(request.auth.uid).get();
      if (!snap.exists) throw new HttpsError('permission-denied', 'No profile.');
      return { uid: request.auth.uid, profile: snap.data() };
    },
    isCanonicalSecretaryCaller: async (caller) => {
      const role = await db.doc(`${ROOT}/school_roles/secretary`).get();
      return caller.profile.role === 'secretary' && role.data()?.uid === caller.uid && role.data()?.status === 'active';
    },
    hashSecretarySetupToken: (value) => require('node:crypto').createHash('sha256').update(String(value)).digest('hex'),
    PROFILE_COLLECTION: 'user_profiles',
    SCHOOLS_COLLECTION: 'schools',
  });
});

if (emulated) beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-gcq/databases/(default)/documents`, { method: 'DELETE' });
  await Promise.all([
    db.doc('user_profiles/office').set({ role: 'secretary', status: 'active' }),
    db.doc('user_profiles/teacher').set({ role: 'teacher', status: 'active' }),
    db.doc(`${ROOT}/school_roles/secretary`).set({ uid: 'office', status: 'active' }),
  ]);
});

const as = (uid, data = {}) => ({ auth: uid ? { uid } : null, data });

platformTest('only the founding Secretary can claim the operator console, and only once', async () => {
  await assert.rejects(handlers.claimOperator(as('teacher')), { code: 'permission-denied' });
  assert.equal((await handlers.getOperatorStatus(as('office'))).canClaim, true);
  await handlers.claimOperator(as('office'));
  assert.deepEqual(await handlers.getOperatorStatus(as('office')), { uid: 'office', isOperator: true, canClaim: false });
  await assert.rejects(handlers.claimOperator(as('office')), { code: 'failed-precondition' });
  await assert.rejects(handlers.listSchools(as('teacher')), { code: 'permission-denied' });
});

platformTest('create a school, open its office, and let a teacher join with the code', async () => {
  await handlers.claimOperator(as('office'));
  const created = await handlers.createSchool(as('office', { name: 'Alpha School', schoolId: 'alpha', tier: 'elite', endsAt: '2027-06-30' }));
  assert.equal(created.schoolId, 'alpha');
  assert.match(created.joinCode, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  const school = (await db.doc('schools/alpha').get()).data();
  assert.equal(school.status, 'active');
  assert.equal(school.subscription.tier, 'elite');
  assert.equal(school.subscription.endsAt, '2027-06-30T23:59:59.000Z');
  assert.equal(JSON.stringify(school).includes(created.joinCode), false, 'the code itself is never stored');
  const setup = (await db.doc('artifacts/alpha/public/data/admin_bootstrap/secretary').get()).data();
  assert.equal(setup.purpose, 'founding');
  assert.equal(setup.status, 'pending');
  await assert.rejects(handlers.createSchool(as('office', { name: 'Again', schoolId: 'alpha', tier: 'pro' })), { code: 'already-exists' });

  // Before the office is activated, teachers cannot join yet.
  await assert.rejects(handlers.verifyTeacherJoinCode(as(null, { schoolId: 'alpha', joinCode: created.joinCode })), { code: 'permission-denied' });
  await db.doc('artifacts/alpha/public/data/school_roles/secretary').set({ uid: 'alpha-office', status: 'active' });

  assert.equal((await handlers.verifyTeacherJoinCode(as(null, { schoolId: 'alpha', joinCode: created.joinCode.toLowerCase() }))).schoolName, 'Alpha School');
  await assert.rejects(handlers.verifyTeacherJoinCode(as(null, { schoolId: 'alpha', joinCode: 'AAAAA-AAAAA' })), { code: 'permission-denied' });
  await assert.rejects(handlers.verifyTeacherJoinCode(as(null, { schoolId: 'great-class-quest', joinCode: created.joinCode })), { code: 'permission-denied' });

  await handlers.joinSchoolAsTeacher(as('new-teacher', { schoolId: 'alpha', joinCode: created.joinCode, displayName: 'Ms Alpha' }));
  const profile = (await db.doc('user_profiles/new-teacher').get()).data();
  assert.equal(profile.schoolId, 'alpha');
  assert.equal(profile.role, 'teacher');
  await assert.rejects(handlers.joinSchoolAsTeacher(as('new-teacher', { schoolId: 'alpha', joinCode: created.joinCode })), { code: 'already-exists' });
  // An existing account (the founding teacher) can never be moved into another school.
  await assert.rejects(handlers.joinSchoolAsTeacher(as('teacher', { schoolId: 'alpha', joinCode: created.joinCode })), { code: 'already-exists' });

  const { schools } = await handlers.listSchools(as('office'));
  assert.equal(schools.length, 1);
  assert.equal(schools[0].officeActive, true);
  assert.equal(schools[0].teacherCount, 1);
});

platformTest('plan changes, suspension, new codes and links; the founding school is untouchable', async () => {
  await handlers.claimOperator(as('office'));
  const created = await handlers.createSchool(as('office', { name: 'Beta', schoolId: 'beta', tier: 'pro' }));
  await handlers.updateSchool(as('office', { schoolId: 'beta', tier: 'starter', endsAt: '2026-12-31' }));
  let school = (await db.doc('schools/beta').get()).data();
  assert.equal(school.subscription.tier, 'starter');
  assert.equal(school.subscription.guilds, false);
  assert.equal(school.subscription.endsAt, '2026-12-31T23:59:59.000Z');
  await handlers.updateSchool(as('office', { schoolId: 'beta', status: 'suspended' }));
  assert.equal((await db.doc('schools/beta').get()).data().status, 'suspended');
  await db.doc('artifacts/beta/public/data/school_roles/secretary').set({ uid: 'beta-office', status: 'active' });
  await assert.rejects(handlers.verifyTeacherJoinCode(as(null, { schoolId: 'beta', joinCode: created.joinCode })), { code: 'permission-denied' });
  await handlers.updateSchool(as('office', { schoolId: 'beta', status: 'active' }));

  const fresh = await handlers.resetTeacherJoinCode(as('office', { schoolId: 'beta' }));
  await assert.rejects(handlers.verifyTeacherJoinCode(as(null, { schoolId: 'beta', joinCode: created.joinCode })), { code: 'permission-denied' });
  await handlers.verifyTeacherJoinCode(as(null, { schoolId: 'beta', joinCode: fresh.joinCode }));

  const recovery = await handlers.issueSecretaryLink(as('office', { schoolId: 'beta' }));
  assert.equal(recovery.purpose, 'recovery');
  assert.equal((await db.doc('artifacts/beta/public/data/admin_bootstrap/secretary').get()).data().targetUid, 'beta-office');

  for (const call of ['updateSchool', 'issueSecretaryLink', 'resetTeacherJoinCode']) {
    await assert.rejects(handlers[call](as('office', { schoolId: 'great-class-quest', tier: 'pending' })), { code: 'failed-precondition' }, call);
  }
  school = (await db.doc('schools/beta').get()).data();
  assert.equal(school.status, 'active');
});

platformTest('runInSchool keeps a joining teacher in the school they joined', async () => {
  // joinSchoolAsTeacher runs its write inside the joined school; nothing leaks into the founding root.
  await runInSchool('gamma', async () => {
    assert.equal(require(path.join(FUNCTIONS, 'tenant.js')).dataRoot(), 'artifacts/gamma/public/data');
  });
});

// ---- Stripe billing handlers (functions/billing/billing.js) with Stripe's network faked ----
const crypto = require('node:crypto');
const { createBillingHandlers } = require(path.join(FUNCTIONS, 'billing', 'billing.js'));
const BILLING_ENV = {
  STRIPE_SECRET_KEY: 'sk_test_fake', STRIPE_WEBHOOK_SECRET: 'whsec_fake',
  GCQ_STRIPE_PRICE_STARTER: 'price_s', GCQ_STRIPE_PRICE_PRO: 'price_p', GCQ_STRIPE_PRICE_ELITE: 'price_e',
};

function billingHandlers(stripeCalls = []) {
  return createBillingHandlers({
    db, FieldValue, HttpsError,
    requireAuthedCaller: async (request) => {
      const snap = await db.collection('user_profiles').doc(request.auth.uid).get();
      return { uid: request.auth.uid, profile: snap.data() };
    },
    isCanonicalSecretaryCaller: async (caller) => caller.profile?.role === 'secretary',
    SCHOOLS_COLLECTION: 'schools',
    env: BILLING_ENV,
    fetchImpl: async (url, init) => {
      stripeCalls.push({ url, body: new URLSearchParams(init.body || ''), key: init.headers['Idempotency-Key'] || '' });
      if (url.endsWith('/customers')) return Response.json({ id: 'cus_new' });
      if (url.endsWith('/checkout/sessions')) return Response.json({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' });
      if (url.endsWith('/billing_portal/sessions')) return Response.json({ url: 'https://billing.stripe.test/p' });
      return Response.json({ error: { message: 'unexpected' } }, { status: 400 });
    },
  });
}

function webhookCall(handlers, event, secret = 'whsec_fake') {
  const body = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const res = {
    code: 0,
    text: '',
    status(code) { this.code = code; return this; },
    send(text) { this.text = String(text || ''); return this; },
  };
  const req = { method: 'POST', rawBody: Buffer.from(body), headers: { 'stripe-signature': `t=${t},v1=${v1}` } };
  return handlers.handleWebhook(req, res).then(() => res);
}

const subEvent = (id, created, priceId, extra = {}) => ({
  id,
  created,
  type: 'customer.subscription.updated',
  data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { gcqSchoolId: 'alpha', tier: 'pro' }, items: { data: [{ price: { id: priceId } }] }, ...extra } },
});

platformTest('Stripe webhook: applies a plan once, ignores older events, never touches the founding school', async () => {
  await db.doc('schools/alpha').set({ name: 'Alpha', status: 'active', subscription: { tier: 'pro', endsAt: '2026-11-01T00:00:00Z' } });
  const handlers = billingHandlers();
  let res = await webhookCall(handlers, subEvent('evt_1', 1000, 'price_e'));
  assert.equal(res.text, 'applied');
  let school = (await db.doc('schools/alpha').get()).data();
  assert.equal(school.subscription.tier, 'elite');
  assert.equal(school.subscription.eliteAI, true);
  assert.equal('endsAt' in school.subscription, false, 'a hand-set end date does not outlive a Stripe plan');
  assert.equal(school.billing.stripeCustomerId, 'cus_1');
  assert.equal(school.name, 'Alpha', 'nothing else on the school doc changes');

  res = await webhookCall(handlers, subEvent('evt_1', 1000, 'price_e'));
  assert.equal(res.text, 'duplicate');
  res = await webhookCall(handlers, subEvent('evt_0', 900, 'price_s'));
  assert.equal(res.text, 'stale');
  assert.equal((await db.doc('schools/alpha').get()).data().subscription.tier, 'elite', 'an older event never wins');

  res = await webhookCall(handlers, { ...subEvent('evt_2', 2000, 'price_e'), type: 'customer.subscription.deleted' });
  assert.equal(res.text, 'applied');
  assert.equal((await db.doc('schools/alpha').get()).data().subscription.tier, 'expired');

  const founding = subEvent('evt_3', 3000, 'price_s');
  founding.data.object.metadata.gcqSchoolId = 'great-class-quest';
  res = await webhookCall(handlers, founding);
  assert.equal(res.text, 'ignored');
  assert.equal((await db.doc('schools/great-class-quest').get()).exists, false);

  res = await webhookCall(handlers, subEvent('evt_4', 4000, 'price_e'), 'whsec_wrong');
  assert.equal(res.code, 400);
});

platformTest('Stripe checkout and portal: school-scoped, one customer per school, founding school refused', async () => {
  await db.doc('schools/alpha').set({ name: 'Alpha', status: 'active', subscription: { tier: 'pending' } });
  await db.doc('user_profiles/alpha-teacher').set({ role: 'teacher', status: 'active', schoolId: 'alpha' });
  await db.doc('user_profiles/alpha-office').set({ role: 'secretary', status: 'active', schoolId: 'alpha' });
  const calls = [];
  const handlers = billingHandlers(calls);

  await assert.rejects(runInSchool('alpha', () => handlers.createPortal(as('alpha-office'))), { code: 'failed-precondition' }, 'nothing to manage before paying');
  const checkout = await runInSchool('alpha', () => handlers.createCheckout(as('alpha-teacher', {
    tier: 'pro', successUrl: 'http://localhost:3000/?paid=1', cancelUrl: 'http://localhost:3000/', requestId: 'r1',
  })));
  assert.equal(checkout.url, 'https://checkout.stripe.test/cs_1');
  const session = calls.find((call) => call.url.endsWith('/checkout/sessions'));
  assert.equal(session.body.get('line_items[0][price]'), 'price_p');
  assert.equal(session.body.get('metadata[gcqSchoolId]'), 'alpha');
  assert.equal(session.body.get('subscription_data[metadata][gcqSchoolId]'), 'alpha');
  assert.equal((await db.doc('schools/alpha').get()).data().billing.stripeCustomerId, 'cus_new');

  await runInSchool('alpha', () => handlers.createCheckout(as('alpha-teacher', { tier: 'elite' })));
  assert.equal(calls.filter((call) => call.url.endsWith('/customers')).length, 1, 'the school keeps one Stripe customer');

  await assert.rejects(runInSchool('alpha', () => handlers.createCheckout(as('alpha-teacher', { tier: 'pro', successUrl: 'https://evil.example/' }))), { code: 'invalid-argument' });
  await assert.rejects(runInSchool('alpha', () => handlers.createCheckout(as('alpha-teacher', { tier: 'gold' }))), { code: 'invalid-argument' });
  await assert.rejects(runInSchool('alpha', () => handlers.createPortal(as('alpha-teacher'))), { code: 'permission-denied' });
  assert.equal((await runInSchool('alpha', () => handlers.createPortal(as('alpha-office')))).url, 'https://billing.stripe.test/p');
  await assert.rejects(handlers.createCheckout(as('teacher', { tier: 'pro' })), { code: 'failed-precondition' }, 'founding school never pays online');
});
