// Pure Stripe helpers for the billing functions (no network, no Firebase; unit-tested).
// The functions call Stripe's REST API directly, so no Stripe SDK is bundled.
const crypto = require('node:crypto');

const PAID_TIERS = ['starter', 'pro', 'elite'];
const SIGNATURE_TOLERANCE_SECONDS = 300;

// Stripe takes form-encoded bodies with bracketed keys: metadata[gcqSchoolId]=..., line_items[0][price]=...
function encodeStripeForm(params, prefix = '') {
  const pairs = [];
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item !== null && typeof item === 'object') pairs.push(encodeStripeForm(item, `${name}[${index}]`));
        else pairs.push(`${encodeURIComponent(`${name}[${index}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof value === 'object') {
      pairs.push(encodeStripeForm(value, name));
    } else {
      pairs.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return pairs.filter(Boolean).join('&');
}

// Verifies the Stripe-Signature header (t=...,v1=...) over the exact raw body.
function verifyStripeSignature(rawBody, header, secret, { now = Date.now(), toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS } = {}) {
  if (!secret) throw new Error('Webhook signing secret is not configured.');
  const parts = String(header || '').split(',').map((part) => part.trim().split('='));
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value).filter(Boolean);
  if (!Number.isFinite(timestamp) || !signatures.length) throw new Error('Missing Stripe signature.');
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) throw new Error('Stripe signature is too old.');
  const payload = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '');
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest();
  const matches = signatures.some((signature) => {
    const given = Buffer.from(signature, 'hex');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
  if (!matches) throw new Error('Stripe signature does not match.');
  return JSON.parse(payload);
}

const BILLING_INTERVALS = ['year', 'month'];

// Two Stripe prices per plan: GCQ_STRIPE_PRICE_{STARTER|PRO|ELITE}_{MONTHLY|YEARLY}.
// A bare GCQ_STRIPE_PRICE_{TIER} is read as the monthly price (the first setup had only that).
function readPriceIds(env = process.env) {
  const priceIds = {};
  const read = (name) => String(env[name] || '').trim();
  for (const tier of PAID_TIERS) {
    const upper = tier.toUpperCase();
    const month = read(`GCQ_STRIPE_PRICE_${upper}_MONTHLY`) || read(`GCQ_STRIPE_PRICE_${upper}`);
    const year = read(`GCQ_STRIPE_PRICE_${upper}_YEARLY`);
    if (month || year) priceIds[tier] = { ...(month ? { month } : {}), ...(year ? { year } : {}) };
  }
  return priceIds;
}

/** Which plan and billing choice a Stripe price id stands for, or null. */
function tierForPrice(priceId, priceIds) {
  if (!priceId) return null;
  for (const [tier, prices] of Object.entries(priceIds || {})) {
    for (const interval of BILLING_INTERVALS) {
      if (prices?.[interval] === priceId) return { tier, interval };
    }
  }
  return null;
}

// ---- School-calendar billing dates (Europe/Athens) ----
// Monthly payments fall on the 1st; the yearly payment on 1 September. July and August are
// free: monthly billing is paused from 15 June to 15 August (so the 1 July and 1 August
// payments are skipped, with two weeks of margin either side), and anyone starting in July or
// August pays nothing until 1 September.

function athensParts(ms) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Athens', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const value = (type) => Number(parts.find((part) => part.type === type).value);
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute'), second: value('second') };
}

/** Unix seconds of 00:00 Athens time on the given date (month 1-12; overflow rolls over). */
function athensMidnight(year, month, day) {
  const wall = Date.UTC(year, month - 1, day);
  let guess = wall - 2 * 3600 * 1000;
  for (let i = 0; i < 3; i += 1) {
    const p = athensParts(guess);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += wall - shown;
  }
  return Math.round(guess / 1000);
}

function isSchoolSummer(nowMs = Date.now()) {
  const { month } = athensParts(nowMs);
  return month === 7 || month === 8;
}

// Stripe wants a Checkout trial to end at least 48 hours ahead; keep anchors an hour ahead.
const MIN_TRIAL_SECONDS = 49 * 3600;
const MIN_ANCHOR_SECONDS = 3600;

/** When a new subscription is first charged: trial_end in summer, otherwise a billing anchor. */
function checkoutSchedule(interval, nowMs = Date.now()) {
  const now = Math.floor(nowMs / 1000);
  const { year, month } = athensParts(nowMs);
  if (month === 7 || month === 8) {
    const firstSeptember = athensMidnight(year, 9, 1);
    // The last days of August are too close for a trial: start on 1 September (a tiny prorated
    // charge for the days left in August) instead.
    if (firstSeptember - now >= MIN_TRIAL_SECONDS) return { trial_end: firstSeptember };
    if (interval === 'month') return { billing_cycle_anchor: firstSeptember - now >= MIN_ANCHOR_SECONDS ? firstSeptember : athensMidnight(year, 10, 1) };
    return { billing_cycle_anchor: firstSeptember - now >= MIN_ANCHOR_SECONDS ? firstSeptember : athensMidnight(year + 1, 9, 1) };
  }
  if (interval === 'month') {
    const nextFirst = athensMidnight(year, month + 1, 1);
    return { billing_cycle_anchor: nextFirst - now >= MIN_ANCHOR_SECONDS ? nextFirst : athensMidnight(year, month + 2, 1) };
  }
  const nextSeptember = athensMidnight(month >= 9 ? year + 1 : year, 9, 1);
  return { billing_cycle_anchor: nextSeptember };
}

/** The summer pause for monthly plans: active from 15 June to 14 August; resumes 15 August. */
function summerPauseWindow(nowMs = Date.now()) {
  const { year, month, day } = athensParts(nowMs);
  const afterStart = month > 6 || (month === 6 && day >= 15);
  const beforeEnd = month < 8 || (month === 8 && day < 15);
  return { active: afterStart && beforeEnd, year, resumesAt: athensMidnight(year, 8, 15) };
}

function idOf(value) {
  return typeof value === 'string' ? value : (value?.id || null);
}

// What a webhook event means for one school: { schoolId, tier, customerId, subscriptionId, status } or null.
// Stripe statuses that keep the paid plan: active, trialing, past_due (Stripe is still retrying).
function planChangeFromEvent(event, priceIds) {
  const object = event?.data?.object || {};
  const metadataInterval = BILLING_INTERVALS.includes(object.metadata?.interval) ? object.metadata.interval : null;
  if (event?.type === 'checkout.session.completed') {
    const tier = String(object.metadata?.tier || '').toLowerCase();
    return {
      schoolId: object.metadata?.gcqSchoolId || null,
      tier: PAID_TIERS.includes(tier) ? tier : null,
      interval: metadataInterval,
      customerId: idOf(object.customer),
      subscriptionId: idOf(object.subscription),
      status: 'active',
    };
  }
  if (event?.type === 'customer.subscription.updated' || event?.type === 'customer.subscription.deleted') {
    const status = String(object.status || '');
    const ended = event.type === 'customer.subscription.deleted' || ['canceled', 'unpaid', 'incomplete_expired'].includes(status);
    // The price decides (a switch in the customer portal changes it); metadata is the fallback.
    const fromPrice = tierForPrice(idOf(object.items?.data?.[0]?.price), priceIds);
    const metadataTier = String(object.metadata?.tier || '').toLowerCase();
    return {
      schoolId: object.metadata?.gcqSchoolId || null,
      tier: ended ? 'expired' : (fromPrice?.tier || (PAID_TIERS.includes(metadataTier) ? metadataTier : null)),
      interval: fromPrice?.interval || metadataInterval,
      customerId: idOf(object.customer),
      subscriptionId: idOf(object.id),
      status,
    };
  }
  return null;
}

// Return links may only go back to this app's own sites.
function allowedReturnUrl(value, allowedOrigins, fallback) {
  if (!value) return fallback;
  let url;
  try {
    url = new URL(String(value));
  } catch (_) {
    throw new Error('Billing return link is not valid.');
  }
  if (!allowedOrigins.has(url.origin)) throw new Error('Billing return link is not allowed.');
  return url.toString();
}

function readAllowedOrigins(env = process.env) {
  return new Set([
    'https://great-class-quest-school.pages.dev',
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    ...String(env.GCQ_BILLING_RETURN_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean),
  ]);
}

module.exports = {
  PAID_TIERS,
  BILLING_INTERVALS,
  athensMidnight,
  isSchoolSummer,
  checkoutSchedule,
  summerPauseWindow,
  encodeStripeForm,
  verifyStripeSignature,
  readPriceIds,
  tierForPrice,
  planChangeFromEvent,
  allowedReturnUrl,
  readAllowedOrigins,
};
