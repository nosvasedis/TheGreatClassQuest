#!/usr/bin/env node
// One-command Stripe setup for card payments (see tools/STRIPE_SETUP.md).
//
//   npm run stripe:setup            (Test mode: use a sk_test_ / rk_test_ key)
//   npm run stripe:setup -- --live  (Live mode: use a sk_live_ / rk_live_ key)
//
// Asks for your Stripe secret key with hidden typing, then creates or reuses:
//   the Greek VAT rate (24%, added on top), the Starter / Pro / Elite products with a monthly and
//   a yearly price each (amounts from config/tiers/pricing.mjs), the founding-schools code
//   (20% off the first year, first 5 schools), the customer portal and the webhook.
// It writes the ids to functions/.env and stores STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in
// Firebase Secret Manager. Secrets are never printed or written to a file.
// Safe to run again: everything is found by its gcq_key / lookup key before anything is created.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { PLAN_PRICES } from '../config/tiers/pricing.mjs';

const require = createRequire(import.meta.url);
const { encodeStripeForm } = require('../functions/billing/stripeCore.cjs');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(ROOT, 'functions', '.env');
const FIREBASE_CLI = path.join(ROOT, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const PROJECT_ID = process.env.FIREBASE_PROJECT || 'the-great-class-quest';
const WEBHOOK_URL = `https://europe-west1-${PROJECT_ID}.cloudfunctions.net/stripeWebhook`;
const WEBHOOK_EVENTS = ['checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted'];
const STRIPE_API_VERSION = '2024-06-20'; // same as functions/billing/billing.js
const TIER_NAMES = { starter: 'Starter', pro: 'Pro', elite: 'Elite' };
const FOUNDING = { coupon: 'gcq-founding-20', code: 'FOUNDING20', percentOff: 20, months: 12, maxSchools: 5 };

const args = new Set(process.argv.slice(2));
const LIVE = args.has('--live');
const ROTATE_WEBHOOK = args.has('--rotate-webhook');
// --dry-run (tests): nothing is stored in Firebase and the ids go to GCQ_STRIPE_SETUP_ENV_FILE.
const DRY_RUN = args.has('--dry-run');
const TARGET_ENV_FILE = DRY_RUN ? (process.env.GCQ_STRIPE_SETUP_ENV_FILE || path.join(ROOT, 'functions', '.env.dry-run')) : ENV_FILE;

function say(line = '') { process.stdout.write(`${line}\n`); }
function fail(message) { say(`\n✖ ${message}`); process.exit(1); }

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => { if (text.includes(question)) rl.output.write(text); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer.trim()); });
  });
}

let SECRET_KEY = '';
async function stripe(method, apiPath, params = null) {
  const headers = { Authorization: `Bearer ${SECRET_KEY}`, 'Stripe-Version': STRIPE_API_VERSION };
  let url = `https://api.stripe.com/v1${apiPath}`;
  let body;
  if (params && method === 'GET') url += `?${encodeStripeForm(params)}`;
  else if (params) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = encodeStripeForm(params); }
  const response = await fetch(url, { method, headers, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Stripe answered ${response.status} for ${apiPath}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function listAll(apiPath, params = {}) {
  const items = [];
  let startingAfter;
  for (let page = 0; page < 20; page += 1) {
    const data = await stripe('GET', apiPath, { limit: 100, ...params, ...(startingAfter ? { starting_after: startingAfter } : {}) });
    items.push(...(data.data || []));
    if (!data.has_more) break;
    startingAfter = data.data.at(-1).id;
  }
  return items;
}

async function ensureTaxRate() {
  const existing = (await listAll('/tax_rates', { active: 'true' })).find((rate) => rate.metadata?.gcq_key === 'vat_gr_24');
  if (existing) return { id: existing.id, created: false };
  const rate = await stripe('POST', '/tax_rates', {
    display_name: 'ΦΠΑ', description: 'Greek VAT 24%', percentage: 24, inclusive: 'false',
    country: 'GR', jurisdiction: 'GR', metadata: { gcq_key: 'vat_gr_24' },
  });
  return { id: rate.id, created: true };
}

async function ensureProducts() {
  const products = await listAll('/products', { active: 'true' });
  const result = {};
  for (const tier of Object.keys(PLAN_PRICES)) {
    let product = products.find((item) => item.metadata?.gcq_key === `plan_${tier}`);
    const created = !product;
    if (!product) {
      product = await stripe('POST', '/products', {
        name: `The Great Class Quest ${TIER_NAMES[tier]}`,
        description: `${TIER_NAMES[tier]} plan for one school`,
        metadata: { gcq_key: `plan_${tier}` },
      });
    }
    result[tier] = { id: product.id, created };
  }
  return result;
}

// Prices cannot change amount: a new amount gets a new price, and the lookup key moves to it.
async function ensurePrice(tier, interval, productId) {
  const lookupKey = `gcq_${tier}_${interval === 'month' ? 'monthly' : 'yearly'}`;
  const amount = Math.round(PLAN_PRICES[tier][interval] * 100);
  const found = (await stripe('GET', '/prices', { lookup_keys: [lookupKey], active: 'true' })).data?.[0];
  if (found && found.unit_amount === amount && found.currency === 'eur' && found.recurring?.interval === interval && found.product === productId) {
    return { id: found.id, created: false };
  }
  const price = await stripe('POST', '/prices', {
    product: productId,
    currency: 'eur',
    unit_amount: amount,
    recurring: { interval },
    tax_behavior: 'exclusive',
    lookup_key: lookupKey,
    transfer_lookup_key: 'true',
    nickname: `${TIER_NAMES[tier]} ${interval === 'month' ? 'monthly (Sept–June)' : 'yearly (school year)'}`,
    metadata: { gcq_key: lookupKey },
  });
  if (found) await stripe('POST', `/prices/${found.id}`, { active: 'false' });
  return { id: price.id, created: true };
}

async function ensureFoundingCode() {
  let couponCreated = false;
  try {
    await stripe('GET', `/coupons/${FOUNDING.coupon}`);
  } catch (error) {
    if (error.status !== 404) throw error;
    await stripe('POST', '/coupons', {
      id: FOUNDING.coupon, name: 'Founding school', percent_off: FOUNDING.percentOff,
      duration: 'repeating', duration_in_months: FOUNDING.months,
    });
    couponCreated = true;
  }
  const codes = (await stripe('GET', '/promotion_codes', { code: FOUNDING.code, limit: 10 })).data || [];
  if (codes.some((code) => code.active)) return { code: FOUNDING.code, created: couponCreated };
  await stripe('POST', '/promotion_codes', {
    coupon: FOUNDING.coupon, code: FOUNDING.code, max_redemptions: FOUNDING.maxSchools,
    restrictions: { first_time_transaction: 'true' },
  });
  return { code: FOUNDING.code, created: true };
}

async function ensurePortal(products, prices) {
  const existing = (await listAll('/billing_portal/configurations', { active: 'true' })).find((config) => config.metadata?.gcq_key === 'school_portal');
  const params = {
    business_profile: { headline: 'The Great Class Quest: your school plan' },
    features: {
      payment_method_update: { enabled: 'true' },
      invoice_history: { enabled: 'true' },
      customer_update: { enabled: 'true', allowed_updates: ['address', 'tax_id', 'name'] },
      subscription_cancel: { enabled: 'true', mode: 'at_period_end' },
      subscription_update: {
        enabled: 'true',
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: Object.keys(PLAN_PRICES).map((tier) => ({
          product: products[tier].id,
          prices: [prices[tier].month.id, prices[tier].year.id],
        })),
      },
    },
    metadata: { gcq_key: 'school_portal' },
  };
  if (existing) {
    const updated = await stripe('POST', `/billing_portal/configurations/${existing.id}`, { features: params.features, business_profile: params.business_profile });
    return { id: updated.id, created: false };
  }
  const config = await stripe('POST', '/billing_portal/configurations', params);
  return { id: config.id, created: true };
}

async function ensureWebhook() {
  let existing = (await listAll('/webhook_endpoints')).find((endpoint) => endpoint.url === WEBHOOK_URL);
  if (existing && ROTATE_WEBHOOK) {
    await stripe('DELETE', `/webhook_endpoints/${existing.id}`);
    existing = null;
  }
  if (existing) {
    await stripe('POST', `/webhook_endpoints/${existing.id}`, { enabled_events: WEBHOOK_EVENTS, disabled: 'false' });
    return { id: existing.id, created: false, secret: '' };
  }
  const endpoint = await stripe('POST', '/webhook_endpoints', {
    url: WEBHOOK_URL,
    enabled_events: WEBHOOK_EVENTS,
    api_version: STRIPE_API_VERSION,
    description: 'The Great Class Quest: school plans',
  });
  return { id: endpoint.id, created: true, secret: endpoint.secret };
}

// Stored through the Firebase CLI's stdin, so the value never touches the disk or the screen.
function setFirebaseSecret(name, value) {
  if (DRY_RUN) return;
  const run = spawnSync(process.execPath, [FIREBASE_CLI, 'functions:secrets:set', name, '--data-file', '-', '--project', PROJECT_ID, '--non-interactive'], {
    cwd: ROOT, input: value, encoding: 'utf8', env: { ...process.env, FIREBASE_FUNCTIONS_DISCOVERY_OUTPUT_PATH: 'true' },
  });
  if (run.status !== 0) {
    const output = `${run.stdout || ''}${run.stderr || ''}`.split(value).join('[hidden]');
    fail(`Could not store ${name} in Firebase:\n${output.trim().slice(-800)}`);
  }
}

function writeEnv(values) {
  const current = fs.existsSync(TARGET_ENV_FILE) ? fs.readFileSync(TARGET_ENV_FILE, 'utf8') : fs.readFileSync(path.join(ROOT, 'functions', '.env.example'), 'utf8');
  let next = current;
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    next = pattern.test(next) ? next.replace(pattern, line) : `${next.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(TARGET_ENV_FILE, next);
}

async function main() {
  say(`The Great Class Quest: Stripe setup (${LIVE ? 'LIVE mode, real money' : 'Test mode'})`);
  say(`Firebase project: ${PROJECT_ID}\n`);
  SECRET_KEY = process.env.STRIPE_SECRET_KEY_INPUT || await askHidden(`Paste your Stripe ${LIVE ? 'LIVE' : 'TEST'} secret key (typing stays hidden): `);
  const mode = /^(sk|rk)_live_/.test(SECRET_KEY) ? 'live' : /^(sk|rk)_test_/.test(SECRET_KEY) ? 'test' : '';
  if (!mode) fail('That does not look like a Stripe secret key (sk_test_… / sk_live_… or rk_…).');
  if (mode === 'live' && !LIVE) fail('That is a LIVE key. Run again with --live when you are ready for real payments.');
  if (mode === 'test' && LIVE) fail('That is a TEST key, but --live was given.');

  const account = await stripe('GET', '/account').catch((error) => fail(`Stripe did not accept the key: ${error.message}`));
  say(`✔ Connected to Stripe account ${account.settings?.dashboard?.display_name || account.id}`);

  const tax = await ensureTaxRate();
  say(`✔ VAT rate 24% (added on top)        ${tax.created ? 'created' : 'already there'}  ${tax.id}`);
  const products = await ensureProducts();
  const prices = {};
  for (const tier of Object.keys(PLAN_PRICES)) {
    prices[tier] = {
      month: await ensurePrice(tier, 'month', products[tier].id),
      year: await ensurePrice(tier, 'year', products[tier].id),
    };
    say(`✔ ${TIER_NAMES[tier].padEnd(8)} €${PLAN_PRICES[tier].month}/month, €${PLAN_PRICES[tier].year}/year   ${prices[tier].month.created || prices[tier].year.created ? 'created' : 'already there'}`);
  }
  const founding = await ensureFoundingCode();
  say(`✔ Founding code ${founding.code}: 20% off year one, first ${FOUNDING.maxSchools} schools   ${founding.created ? 'created' : 'already there'}`);
  const portal = await ensurePortal(products, prices);
  say(`✔ Customer portal (change plan, card, invoices, cancel at period end)   ${portal.created ? 'created' : 'updated'}`);
  const webhook = await ensureWebhook();
  say(`✔ Webhook → ${WEBHOOK_URL}   ${webhook.created ? 'created' : 'already there'}`);

  writeEnv({
    GCQ_ENABLE_STRIPE: 'true',
    GCQ_STRIPE_PRICE_STARTER_MONTHLY: prices.starter.month.id,
    GCQ_STRIPE_PRICE_STARTER_YEARLY: prices.starter.year.id,
    GCQ_STRIPE_PRICE_PRO_MONTHLY: prices.pro.month.id,
    GCQ_STRIPE_PRICE_PRO_YEARLY: prices.pro.year.id,
    GCQ_STRIPE_PRICE_ELITE_MONTHLY: prices.elite.month.id,
    GCQ_STRIPE_PRICE_ELITE_YEARLY: prices.elite.year.id,
    GCQ_STRIPE_TAX_RATE: tax.id,
    GCQ_STRIPE_PORTAL_CONFIGURATION: portal.id,
  });
  say(`✔ Wrote the ids to functions/.env`);

  setFirebaseSecret('STRIPE_SECRET_KEY', SECRET_KEY);
  say('✔ Stored STRIPE_SECRET_KEY in Firebase Secret Manager');
  if (webhook.secret) {
    setFirebaseSecret('STRIPE_WEBHOOK_SECRET', webhook.secret);
    say('✔ Stored STRIPE_WEBHOOK_SECRET in Firebase Secret Manager');
  } else {
    say('• The webhook already existed, so its signing secret is unchanged in Firebase.');
    say('  (If Firebase has no STRIPE_WEBHOOK_SECRET yet, run again with --rotate-webhook.)');
  }

  say('\nAlmost done. One setting Stripe only allows in the dashboard:');
  say('  Settings → Billing → Subscriptions and emails → "If all retries for a payment fail":');
  say('  choose "Cancel the subscription" (and keep Smart Retries on, up to 2 weeks).');
  say('\nThen tell Claude "Stripe setup done" so it deploys the payment functions.');
}

main().catch((error) => fail(error?.message || String(error)));
