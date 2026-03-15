/**
 * GCQ Billing backend (Stripe).
 * - POST /create-checkout-session: create Stripe Checkout for upgrading a school.
 * - POST /webhook: Stripe webhook; on payment, writes tier to school's Firestore (or calls school webhook).
 *
 * School config: either (firebaseProjectId + firebaseServiceAccountKey/path) for direct Firestore write,
 * or (webhookUrl + webhookSecret) for callback. Direct Firestore = no per-school deployment.
 *
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, BILLING_SCHOOLS_PATH (optional)
 * Optional: PORT (default 3333). Loads .env from billing folder if present.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') });

import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, existsSync } from 'fs';
const __dirname = dirname(fileURLToPath(import.meta.url));

const firebaseApps = {};
function getFirestoreForSchool(school) {
  const projectId = school.firebaseProjectId;
  const key = school.firebaseServiceAccountKey;
  const keyPath = school.firebaseServiceAccountPath;
  if (!projectId || (!key && !keyPath)) return null;
  if (firebaseApps[projectId]) return firebaseApps[projectId].firestore();
  const keyPathResolved = keyPath && keyPath.startsWith('.') ? join(__dirname, keyPath) : keyPath;
  const credential = key
    ? admin.credential.cert(typeof key === 'string' ? JSON.parse(key) : key)
    : admin.credential.cert(JSON.parse(readFileSync(keyPathResolved, 'utf8')));
  const app = admin.initializeApp({ credential }, projectId);
  firebaseApps[projectId] = app;
  return app.firestore();
}

const app = express();
app.use(cors({ origin: true })); // Allow app origin; set CORS_ORIGIN in production to restrict
const PORT = process.env.PORT || 3333;

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const schoolsPath = process.env.BILLING_SCHOOLS_PATH || join(__dirname, 'schools.json');

if (!stripeSecret) {
  console.error('Missing STRIPE_SECRET_KEY');
  process.exit(1);
}

const stripe = new Stripe(stripeSecret);

// Webhook needs raw body for Stripe signature verification — register before express.json()
app.post('/webhook', express.raw({ type: 'application/json' }), webhookHandler);
app.use(express.json());

function loadSchools() {
  const fromEnv = process.env.BILLING_SCHOOLS_JSON;
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv);
    } catch (e) {
      console.warn('BILLING_SCHOOLS_JSON invalid JSON');
      return { schools: [], priceIds: {} };
    }
  }
  if (!existsSync(schoolsPath)) {
    console.warn('No schools.json found at', schoolsPath);
    return { schools: [], priceIds: {} };
  }
  return JSON.parse(readFileSync(schoolsPath, 'utf8'));
}

function loadTierPreset(tier) {
  const paths = [
    join(__dirname, '..', 'config', 'tiers', tier + '.json'),
    join(process.cwd(), 'config', 'tiers', tier + '.json'),
  ];
  for (const p of paths) {
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  }
  return null;
}

function getSchoolByCustomerId(customerId) {
  const { schools } = loadSchools();
  return schools.find((s) => s.stripeCustomerId === customerId) || null;
}

function getSchoolById(schoolId) {
  const { schools } = loadSchools();
  return schools.find((s) => s.schoolId === schoolId) || null;
}

/** Cached portal configuration ID so customers can switch plans (Starter / Pro / Elite) in Stripe. */
let cachedPortalConfigId = null;

/** Get or create a Stripe Customer Portal config that allows plan switching. Uses priceIds from schools config. */
async function getOrCreatePortalConfiguration() {
  if (cachedPortalConfigId) return cachedPortalConfigId;
  const { priceIds } = loadSchools();
  const tierOrder = ['starter', 'pro', 'elite'];
  const productPricePairs = [];
  for (const tier of tierOrder) {
    const priceId = priceIds?.[tier];
    if (!priceId) continue;
    try {
      const price = await stripe.prices.retrieve(priceId);
      const productId = typeof price.product === 'string' ? price.product : price.product?.id;
      if (productId) productPricePairs.push({ product: productId, prices: [priceId] });
    } catch (e) {
      console.warn('Could not load price for tier', tier, e.message);
    }
  }
  if (productPricePairs.length === 0) {
    console.warn('No valid prices for portal config; plan switching will be disabled in portal.');
    return undefined;
  }
  try {
    const config = await stripe.billingPortal.configurations.create({
      business_profile: { headline: 'Manage your subscription' },
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price'],
          proration_behavior: 'create_prorations',
          products: productPricePairs,
          schedule_at_period_end: {
            conditions: [{ type: 'decreasing_item_amount' }],
          },
        },
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
      },
    });
    cachedPortalConfigId = config.id;
    console.log('Portal configuration created for plan switching:', config.id);
    return cachedPortalConfigId;
  } catch (e) {
    console.error('Failed to create portal configuration:', e.message);
    return undefined;
  }
}

/** Resolve Stripe customer ID for a school (from schools.json or by finding subscription/customer). */
async function getCustomerIdForSchool(schoolId) {
  const school = getSchoolById(schoolId);
  let customerId = school?.stripeCustomerId;
  if (customerId) return customerId;
  try {
    const subs = await stripe.subscriptions.list({ limit: 100, status: 'all' });
    const match = subs.data.find((s) => s.metadata?.gcqSchoolId === schoolId);
    if (match) {
      customerId = typeof match.customer === 'string' ? match.customer : match.customer?.id;
      if (customerId) saveSchoolStripeCustomerId(schoolId, customerId);
      return customerId;
    }
    const customers = await stripe.customers.list({ limit: 100 });
    const cust = customers.data.find((c) => c.metadata?.gcqSchoolId === schoolId);
    if (cust) {
      saveSchoolStripeCustomerId(schoolId, cust.id);
      return cust.id;
    }
  } catch (e) {
    console.error('getCustomerIdForSchool error:', e);
  }
  return null;
}

/** Persist Stripe customer ID to schools.json so portal and future checkouts use it. No-op if config is from env. */
function saveSchoolStripeCustomerId(schoolId, customerId) {
  if (process.env.BILLING_SCHOOLS_JSON) return;
  if (!existsSync(schoolsPath)) return;
  try {
    const data = JSON.parse(readFileSync(schoolsPath, 'utf8'));
    const school = data.schools?.find((s) => s.schoolId === schoolId);
    if (school) {
      school.stripeCustomerId = customerId;
      writeFileSync(schoolsPath, JSON.stringify(data, null, 2), 'utf8');
      console.log('Saved stripeCustomerId for school', schoolId);
    }
  } catch (e) {
    console.error('Failed to save stripeCustomerId to schools.json:', e.message);
  }
}

function toIsoDateFromUnix(value) {
  if (!value) return null;
  return new Date(value * 1000).toISOString().slice(0, 10);
}

function summarizeInvoice(invoice) {
  if (!invoice) return null;
  const firstLine = invoice.lines?.data?.[0] || null;
  return {
    invoiceId: invoice.id,
    number: invoice.number || '',
    status: invoice.status || '',
    currency: (invoice.currency || '').toLowerCase(),
    amountPaid: invoice.amount_paid || 0,
    amountDue: invoice.amount_due || 0,
    paid: invoice.paid === true,
    paidAt: toIsoDateFromUnix(invoice.status_transitions?.paid_at || invoice.created),
    createdAt: toIsoDateFromUnix(invoice.created),
    hostedInvoiceUrl: invoice.hosted_invoice_url || '',
    description: invoice.description || firstLine?.description || '',
    periodStart: toIsoDateFromUnix(firstLine?.period?.start),
    periodEnd: toIsoDateFromUnix(firstLine?.period?.end),
  };
}

// Create Checkout Session for a school upgrading to a tier
app.post('/create-checkout-session', express.json(), async (req, res) => {
  const { schoolId, tier, successUrl, cancelUrl } = req.body || {};
  if (!schoolId || !tier) {
    return res.status(400).json({ error: 'schoolId and tier required' });
  }

  const school = getSchoolById(schoolId);
  if (!school) {
    return res.status(404).json({ error: 'School not found' });
  }

  const { priceIds } = loadSchools();
  const priceId = priceIds[tier.toLowerCase()];
  if (!priceId) {
    return res.status(400).json({ error: `No price configured for tier: ${tier}` });
  }

  try {
    let customerId = school.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { gcqSchoolId: schoolId },
      });
      customerId = customer.id;
      saveSchoolStripeCustomerId(schoolId, customerId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${req.protocol}://${req.get('host')}/?upgraded=1`,
      cancel_url: cancelUrl || `${req.protocol}://${req.get('host')}/`,
      metadata: { gcqSchoolId: schoolId, tier: tier.toLowerCase() },
      subscription_data: { metadata: { gcqSchoolId: schoolId, tier: tier.toLowerCase() } },
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('Checkout session error:', e);
    return res.status(500).json({ error: e.message || 'Checkout failed' });
  }
});

// Create Stripe Customer Portal session (manage subscription, payment method, invoices)
app.post('/create-portal-session', express.json(), async (req, res) => {
  const { schoolId, returnUrl } = req.body || {};
  if (!schoolId) {
    return res.status(400).json({ error: 'schoolId required' });
  }

  const customerId = await getCustomerIdForSchool(schoolId);
  if (!customerId) {
    return res.status(404).json({ error: 'No subscription found for this school' });
  }

  try {
    const configuration = await getOrCreatePortalConfiguration();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || req.headers.referer || `${req.protocol}://${req.get('host')}/`,
      ...(configuration && { configuration }),
    });
    return res.json({ url: session.url });
  } catch (e) {
    console.error('Portal session error:', e);
    return res.status(500).json({ error: e.message || 'Portal failed' });
  }
});

// Return subscription details for Options UI (before sending user to Stripe)
app.get('/subscription-info', async (req, res) => {
  const schoolId = req.query.schoolId;
  if (!schoolId) {
    return res.status(400).json({ error: 'schoolId required' });
  }

  try {
    const customerId = await getCustomerIdForSchool(schoolId);
    if (!customerId) {
      return res.json({
        hasSubscription: false,
        tier: 'starter',
        customerId: null,
        hasPaidInvoices: false,
        lifetimePaidAmount: 0,
        lifetimePaidCount: 0,
        firstPaidAt: null,
        lastPaidAt: null,
        recentPayments: [],
        message: 'No Stripe customer or paid subscription was found for this school.',
      });
    }

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 20,
      expand: ['data.items.data.price'],
    });

    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 100,
    });

    // Prefer active/trialing; otherwise most recent by period end
    const sorted = subs.data
      .filter((s) => s.status !== 'incomplete_expired')
      .sort((a, b) => (b.current_period_end || 0) - (a.current_period_end || 0));
    const sub = sorted[0];

    const allInvoices = invoices.data.map(summarizeInvoice).filter(Boolean);
    const paidInvoices = allInvoices
      .filter((invoice) => invoice.paid)
      .sort((a, b) => new Date(b.paidAt || b.createdAt || 0).getTime() - new Date(a.paidAt || a.createdAt || 0).getTime());
    const latestPaidInvoice = paidInvoices[0] || null;
    const oldestPaidInvoice = paidInvoices[paidInvoices.length - 1] || null;
    const lifetimePaidAmount = paidInvoices.reduce((sum, invoice) => sum + (invoice.amountPaid || 0), 0);

    if (!sub) {
      return res.json({
        hasSubscription: false,
        tier: 'starter',
        customerId,
        hasPaidInvoices: paidInvoices.length > 0,
        lifetimePaidAmount,
        lifetimePaidCount: paidInvoices.length,
        firstPaidAt: oldestPaidInvoice?.paidAt || null,
        lastPaidAt: latestPaidInvoice?.paidAt || null,
        recentPayments: paidInvoices.slice(0, 8),
        message: paidInvoices.length > 0
          ? 'Stripe shows payment history for this school, but no current subscription is active.'
          : 'Stripe has a customer record for this school, but no current subscription or paid invoice yet.',
      });
    }

    let tier = null;
    const priceRef = sub.items?.data?.[0]?.price;
    const priceId = typeof priceRef === 'string' ? priceRef : priceRef?.id;
    if (priceId) {
      const { priceIds } = loadSchools();
      for (const [t, id] of Object.entries(priceIds || {})) {
        if (id === priceId) {
          tier = t;
          break;
        }
      }
    }
    if (!tier) tier = (sub.metadata?.tier || (typeof priceRef === 'object' && priceRef?.nickname) || 'pro').toLowerCase();
    const currentPeriodStart = sub.current_period_start
      ? new Date(sub.current_period_start * 1000).toISOString().slice(0, 10)
      : null;
    const currentPeriodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString().slice(0, 10)
      : null;
    const canceledAt = sub.canceled_at
      ? new Date(sub.canceled_at * 1000).toISOString().slice(0, 10)
      : null;
    const subscriptionStartedAt = sub.start_date
      ? new Date(sub.start_date * 1000).toISOString().slice(0, 10)
      : toIsoDateFromUnix(sub.created);
    const currentPrice = typeof priceRef === 'object' && priceRef
      ? {
          id: priceRef.id,
          unitAmount: priceRef.unit_amount || 0,
          currency: (priceRef.currency || '').toLowerCase(),
          interval: priceRef.recurring?.interval || '',
          intervalCount: priceRef.recurring?.interval_count || 1,
          nickname: priceRef.nickname || '',
        }
      : null;

    return res.json({
      hasSubscription: true,
      customerId,
      tier,
      status: sub.status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end === true,
      canceledAt,
      subscriptionStartedAt,
      currentPrice,
      hasPaidInvoices: paidInvoices.length > 0,
      lifetimePaidAmount,
      lifetimePaidCount: paidInvoices.length,
      firstPaidAt: oldestPaidInvoice?.paidAt || null,
      lastPaidAt: latestPaidInvoice?.paidAt || null,
      latestPaidInvoice,
      recentPayments: paidInvoices.slice(0, 8),
      message: sub.cancel_at_period_end === true
        ? 'Stripe shows a paid subscription that will end at the close of the current billing period.'
        : 'Stripe shows an active paid subscription for this school.',
    });
  } catch (e) {
    console.error('Subscription info error:', e);
    return res.status(500).json({ error: e.message || 'Failed to load subscription' });
  }
});

async function webhookHandler(req, res) {
  if (!webhookSecret) {
    console.warn('STRIPE_WEBHOOK_SECRET not set; webhook will not verify');
  }

  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = webhookSecret && sig
      ? stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
      : JSON.parse(req.body.toString());
  } catch (e) {
    console.error('Webhook signature verification failed:', e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  let schoolId = null;
  let tier = null;

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      schoolId = session.metadata?.gcqSchoolId || session.subscription && (await stripe.subscriptions.retrieve(session.subscription)).metadata?.gcqSchoolId;
      tier = session.metadata?.tier || (session.subscription && (await stripe.subscriptions.retrieve(session.subscription)).metadata?.tier);
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      if (schoolId && customerId) saveSchoolStripeCustomerId(schoolId, customerId);
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      schoolId = sub.metadata?.gcqSchoolId;
      if (event.type === 'customer.subscription.deleted') {
        tier = 'expired';
      } else {
        const priceRef = sub.items?.data?.[0]?.price;
        const priceId = typeof priceRef === 'string' ? priceRef : priceRef?.id;
        if (priceId) {
          const { priceIds } = loadSchools();
          for (const [t, id] of Object.entries(priceIds || {})) {
            if (id === priceId) {
              tier = t;
              break;
            }
          }
        }
        if (!tier) tier = sub.metadata?.tier;
      }
      break;
    }
    case 'invoice.paid':
      // Optional: use invoice metadata if you store school/tier there
      break;
    default:
      return res.status(200).send();
  }

  if (!schoolId || !tier) {
    console.warn('Webhook event missing schoolId/tier:', event.type, event.data?.object?.id);
    return res.status(200).send();
  }

  const school = getSchoolById(schoolId) || getSchoolByCustomerId(event.data?.object?.customer);
  if (!school) {
    console.warn('School not found:', schoolId);
    return res.status(200).send();
  }

  const preset = loadTierPreset(tier);
  if (!preset) {
    console.warn('No preset for tier:', tier);
    return res.status(200).send();
  }

  const db = getFirestoreForSchool(school);
  if (db) {
    try {
      await db.collection('appConfig').doc('subscription').set(preset);
      console.log('Updated Firestore appConfig/subscription to', tier, 'for school', schoolId);
    } catch (e) {
      console.error('Firestore write failed for school', schoolId, e);
    }
  } else if (school.webhookUrl && school.webhookSecret) {
    try {
      const r = await fetch(school.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${school.webhookSecret}`,
        },
        body: JSON.stringify({ tier, subscription: preset }),
      });
      if (!r.ok) console.error('School webhook failed:', school.webhookUrl, r.status, await r.text());
    } catch (e) {
      console.error('School webhook request failed:', e);
    }
  } else {
    console.warn('School has no firebaseProjectId+key nor webhookUrl:', schoolId);
  }

  res.status(200).send();
}

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Export for testing
export {
  loadSchools,
  loadTierPreset,
  getSchoolById,
  getSchoolByCustomerId,
  getFirestoreForSchool,
  saveSchoolStripeCustomerId,
  getCustomerIdForSchool,
  getOrCreatePortalConfiguration,
  webhookHandler,
  firebaseApps
};

// Start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log('GCQ Billing listening on port', PORT);
  });
}

export default app;
