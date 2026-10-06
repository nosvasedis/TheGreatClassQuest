// Stripe billing as Cloud Functions (replaces the Render billing server).
//
// - billingCreateCheckout: a school's teacher or Secretary starts Stripe Checkout for a plan.
// - billingCreatePortal: the school's Secretary manages the subscription in Stripe's portal.
// - stripeWebhook: Stripe tells us a plan started, changed or ended; we copy the plan preset onto
//   schools/{schoolId}.subscription. Each event is applied once, and an older event never
//   overwrites a newer one.
// The founding school's plan is never touched here.
const {
  PAID_TIERS,
  encodeStripeForm,
  verifyStripeSignature,
  readPriceIds,
  planChangeFromEvent,
  allowedReturnUrl,
  readAllowedOrigins,
} = require('./stripeCore.cjs');
const TIER_PRESETS = require('../tierPresets');
const { FOUNDING_SCHOOL_ID, currentSchoolId, normalizeSchoolId } = require('../tenant');

const STRIPE_API = 'https://api.stripe.com/v1';

function createBillingHandlers({
  db, FieldValue, HttpsError,
  requireAuthedCaller, isCanonicalSecretaryCaller,
  SCHOOLS_COLLECTION, env = process.env, fetchImpl = fetch,
}) {
  const fail = (code, message) => { throw new HttpsError(code, message); };

  async function stripe(method, path, params = null, { idempotencyKey = '' } = {}) {
    const secretKey = String(env.STRIPE_SECRET_KEY || '').trim();
    if (!secretKey) fail('failed-precondition', 'Online payment is not set up yet.');
    const headers = { Authorization: `Bearer ${secretKey}` };
    let url = `${STRIPE_API}${path}`;
    let body;
    if (params && method === 'GET') url += `?${encodeStripeForm(params)}`;
    else if (params) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = encodeStripeForm(params);
    }
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const response = await fetchImpl(url, { method, headers, body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(JSON.stringify({ event: 'gcq_stripe_error', path, status: response.status, message: data?.error?.message || '' }));
      fail('internal', 'Stripe could not complete that right now. Try again in a minute.');
    }
    return data;
  }

  function billedSchoolId() {
    const schoolId = currentSchoolId();
    if (schoolId === FOUNDING_SCHOOL_ID) fail('failed-precondition', 'This school’s plan is managed directly, not through online payment.');
    return schoolId;
  }

  async function readSchool(schoolId) {
    const ref = db.collection(SCHOOLS_COLLECTION).doc(schoolId);
    const snap = await ref.get();
    if (!snap.exists) fail('not-found', 'This school is not set up for online payment.');
    return { ref, data: snap.data() || {} };
  }

  async function ensureCustomer(schoolId, school) {
    const existing = school.data.billing?.stripeCustomerId;
    if (existing) return existing;
    const customer = await stripe('POST', '/customers', {
      name: school.data.name || schoolId,
      metadata: { gcqSchoolId: schoolId },
    }, { idempotencyKey: `gcq-customer-${schoolId}` });
    await school.ref.set({ billing: { stripeCustomerId: customer.id } }, { merge: true });
    return customer.id;
  }

  return {
    async createCheckout(request) {
      const caller = await requireAuthedCaller(request);
      if (!['teacher', 'secretary'].includes(caller.profile?.role)) fail('permission-denied', 'Ask the school office to choose a plan.');
      const schoolId = billedSchoolId();
      const tier = String(request.data?.tier || '').toLowerCase();
      if (!PAID_TIERS.includes(tier)) fail('invalid-argument', 'Choose Starter, Pro or Elite.');
      const priceId = readPriceIds(env)[tier];
      if (!priceId) fail('failed-precondition', `Online payment for ${tier} is not set up yet.`);
      const origins = readAllowedOrigins(env);
      let successUrl;
      let cancelUrl;
      try {
        successUrl = allowedReturnUrl(request.data?.successUrl, origins, 'https://great-class-quest-school.pages.dev/?upgraded=1');
        cancelUrl = allowedReturnUrl(request.data?.cancelUrl, origins, 'https://great-class-quest-school.pages.dev/');
      } catch (error) {
        fail('invalid-argument', error.message);
      }
      const school = await readSchool(schoolId);
      const customerId = await ensureCustomer(schoolId, school);
      const requestId = String(request.data?.requestId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
      const session = await stripe('POST', '/checkout/sessions', {
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { gcqSchoolId: schoolId, tier },
        subscription_data: { metadata: { gcqSchoolId: schoolId, tier } },
      }, { idempotencyKey: requestId ? `gcq-checkout-${schoolId}-${caller.uid}-${requestId}` : '' });
      if (!session?.url) fail('internal', 'Stripe did not return a checkout link.');
      return { url: session.url };
    },

    async createPortal(request) {
      const caller = await requireAuthedCaller(request);
      if (!await isCanonicalSecretaryCaller(caller)) fail('permission-denied', 'Only the school office can manage the subscription.');
      const schoolId = billedSchoolId();
      const school = await readSchool(schoolId);
      const customerId = school.data.billing?.stripeCustomerId;
      if (!customerId) fail('failed-precondition', 'This school has not paid online yet, so there is nothing to manage.');
      let returnUrl;
      try {
        returnUrl = allowedReturnUrl(request.data?.returnUrl, readAllowedOrigins(env), 'https://great-class-quest-school.pages.dev/');
      } catch (error) {
        fail('invalid-argument', error.message);
      }
      const configuration = String(env.GCQ_STRIPE_PORTAL_CONFIGURATION || '').trim();
      const session = await stripe('POST', '/billing_portal/sessions', {
        customer: customerId,
        return_url: returnUrl,
        ...(configuration ? { configuration } : {}),
      });
      if (!session?.url) fail('internal', 'Stripe did not return a portal link.');
      return { url: session.url };
    },

    // Express-style handler for an https.onRequest function. Firebase keeps the raw body.
    async handleWebhook(req, res) {
      if (req.method !== 'POST') return res.status(405).send('Method not allowed.');
      let event;
      try {
        event = verifyStripeSignature(req.rawBody, req.headers['stripe-signature'], String(env.STRIPE_WEBHOOK_SECRET || '').trim());
      } catch (error) {
        console.warn(JSON.stringify({ event: 'gcq_stripe_webhook_rejected', reason: error.message }));
        return res.status(400).send(`Webhook Error: ${error.message}`);
      }
      const change = planChangeFromEvent(event, readPriceIds(env));
      const schoolId = normalizeSchoolId(change?.schoolId);
      if (!change || !schoolId || !change.tier || schoolId === FOUNDING_SCHOOL_ID) {
        if (change) console.warn(JSON.stringify({ event: 'gcq_stripe_webhook_ignored', type: event.type, schoolId: change.schoolId || null, tier: change.tier || null }));
        return res.status(200).send('ignored');
      }
      const preset = TIER_PRESETS[change.tier];
      const eventRef = db.collection('billing_webhook_events').doc(String(event.id));
      const schoolRef = db.collection(SCHOOLS_COLLECTION).doc(schoolId);
      try {
        const outcome = await db.runTransaction(async (transaction) => {
          const [eventSnap, schoolSnap] = await Promise.all([transaction.get(eventRef), transaction.get(schoolRef)]);
          if (eventSnap.exists) return 'duplicate';
          if (!schoolSnap.exists) return 'unknown-school';
          const billing = schoolSnap.data()?.billing || {};
          const created = Number(event.created) || 0;
          const stale = created && Number(billing.lastEventCreated) > created;
          if (!stale) {
            // The whole plan is replaced (a hand-set end date must not outlive a Stripe plan);
            // billing fields are updated one by one so nothing else on the doc changes.
            transaction.update(schoolRef, {
              subscription: { ...preset },
              ...(change.customerId ? { 'billing.stripeCustomerId': change.customerId } : {}),
              ...(change.subscriptionId ? { 'billing.stripeSubscriptionId': change.subscriptionId } : {}),
              'billing.stripeStatus': change.status || '',
              'billing.lastEventCreated': created,
              'billing.lastEventType': event.type,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
          transaction.create(eventRef, {
            stripeEventId: event.id,
            stripeEventType: event.type,
            schoolId,
            tier: change.tier,
            applied: !stale,
            processedAt: FieldValue.serverTimestamp(),
          });
          return stale ? 'stale' : 'applied';
        });
        console.log(JSON.stringify({ event: 'gcq_stripe_webhook', type: event.type, schoolId, tier: change.tier, outcome }));
        return res.status(200).send(outcome);
      } catch (error) {
        console.error('Stripe webhook processing failed:', error?.message || error);
        return res.status(500).send('Webhook processing failed; Stripe will retry.');
      }
    },
  };
}

module.exports = { createBillingHandlers };
