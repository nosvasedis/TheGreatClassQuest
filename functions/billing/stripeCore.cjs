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

// Price ids come from GCQ_STRIPE_PRICE_STARTER / _PRO / _ELITE.
function readPriceIds(env = process.env) {
  const priceIds = {};
  for (const tier of PAID_TIERS) {
    const value = String(env[`GCQ_STRIPE_PRICE_${tier.toUpperCase()}`] || '').trim();
    if (value) priceIds[tier] = value;
  }
  return priceIds;
}

function tierForPrice(priceId, priceIds) {
  if (!priceId) return null;
  return Object.entries(priceIds || {}).find(([, id]) => id === priceId)?.[0] || null;
}

function idOf(value) {
  return typeof value === 'string' ? value : (value?.id || null);
}

// What a webhook event means for one school: { schoolId, tier, customerId, subscriptionId, status } or null.
// Stripe statuses that keep the paid plan: active, trialing, past_due (Stripe is still retrying).
function planChangeFromEvent(event, priceIds) {
  const object = event?.data?.object || {};
  if (event?.type === 'checkout.session.completed') {
    const tier = String(object.metadata?.tier || '').toLowerCase();
    return {
      schoolId: object.metadata?.gcqSchoolId || null,
      tier: PAID_TIERS.includes(tier) ? tier : null,
      customerId: idOf(object.customer),
      subscriptionId: idOf(object.subscription),
      status: 'active',
    };
  }
  if (event?.type === 'customer.subscription.updated' || event?.type === 'customer.subscription.deleted') {
    const status = String(object.status || '');
    const ended = event.type === 'customer.subscription.deleted' || ['canceled', 'unpaid', 'incomplete_expired'].includes(status);
    const priceTier = tierForPrice(idOf(object.items?.data?.[0]?.price), priceIds);
    const metadataTier = String(object.metadata?.tier || '').toLowerCase();
    return {
      schoolId: object.metadata?.gcqSchoolId || null,
      tier: ended ? 'expired' : (priceTier || (PAID_TIERS.includes(metadataTier) ? metadataTier : null)),
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
  encodeStripeForm,
  verifyStripeSignature,
  readPriceIds,
  tierForPrice,
  planChangeFromEvent,
  allowedReturnUrl,
  readAllowedOrigins,
};
