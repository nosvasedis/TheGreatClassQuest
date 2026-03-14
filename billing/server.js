/**
 * GCQ Billing backend (Stripe).
 * - POST /create-checkout-session: create Stripe Checkout for upgrading a school.
 * - POST /webhook: Stripe webhook; on payment, writes tier to school's Firestore (or calls school webhook).
 *
 * School config: either (firebaseProjectId + firebaseServiceAccountKey/path) for direct Firestore write,
 * or (webhookUrl + webhookSecret) for callback. Direct Firestore = no per-school deployment.
 *
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, BILLING_SCHOOLS_PATH (optional)
 * Optional: PORT (default 3333)
 */

import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
    join(__dirname, '..', 'config', 'tiers', `${tier}.json'),
    join(process.cwd(), 'config', 'tiers', `${tier}.json'),
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
      // In production you would persist customerId back to schools.json or a DB
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
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      schoolId = sub.metadata?.gcqSchoolId;
      tier = sub.metadata?.tier;
      if (event.type === 'customer.subscription.deleted') {
        tier = 'starter';
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

app.listen(PORT, () => {
  console.log('GCQ Billing listening on port', PORT);
});
