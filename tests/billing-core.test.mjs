import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../functions/billing/stripeCore.cjs');

function signed(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
    const body = JSON.stringify(payload);
    const v1 = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    return { body, header: `t=${timestamp},v1=${v1}` };
}

test('Stripe form encoding handles nested metadata and line items', () => {
    const form = core.encodeStripeForm({
        mode: 'subscription',
        line_items: [{ price: 'price_1', quantity: 1 }],
        metadata: { gcqSchoolId: 'alpha', tier: 'pro' },
        skip: undefined
    });
    const params = new URLSearchParams(form);
    assert.equal(params.get('mode'), 'subscription');
    assert.equal(params.get('line_items[0][price]'), 'price_1');
    assert.equal(params.get('line_items[0][quantity]'), '1');
    assert.equal(params.get('metadata[gcqSchoolId]'), 'alpha');
    assert.equal(params.has('skip'), false);
});

test('webhook signatures: genuine passes; tampered, foreign, old or missing fail', () => {
    const { body, header } = signed({ id: 'evt_1' }, 'whsec_test');
    assert.equal(core.verifyStripeSignature(body, header, 'whsec_test').id, 'evt_1');
    assert.equal(core.verifyStripeSignature(Buffer.from(body), header, 'whsec_test').id, 'evt_1');
    assert.throws(() => core.verifyStripeSignature(body.replace('evt_1', 'evt_2'), header, 'whsec_test'), /does not match/);
    assert.throws(() => core.verifyStripeSignature(body, header, 'whsec_other'), /does not match/);
    const old = signed({ id: 'evt_1' }, 'whsec_test', Math.floor(Date.now() / 1000) - 3600);
    assert.throws(() => core.verifyStripeSignature(old.body, old.header, 'whsec_test'), /too old/);
    assert.throws(() => core.verifyStripeSignature(body, '', 'whsec_test'), /Missing/);
    assert.throws(() => core.verifyStripeSignature(body, header, ''), /not configured/);
});

test('events map to one school plan change', () => {
    const priceIds = { starter: 'price_s', pro: 'price_p', elite: 'price_e' };
    assert.deepEqual(core.planChangeFromEvent({
        type: 'checkout.session.completed',
        data: { object: { metadata: { gcqSchoolId: 'alpha', tier: 'pro' }, customer: 'cus_1', subscription: 'sub_1' } }
    }, priceIds), { schoolId: 'alpha', tier: 'pro', customerId: 'cus_1', subscriptionId: 'sub_1', status: 'active' });

    const sub = (extra) => ({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { gcqSchoolId: 'alpha', tier: 'pro' }, items: { data: [{ price: { id: 'price_e' } }] }, ...extra } } });
    assert.equal(core.planChangeFromEvent(sub({}), priceIds).tier, 'elite', 'the price decides, not old metadata');
    assert.equal(core.planChangeFromEvent(sub({ status: 'past_due' }), priceIds).tier, 'elite', 'Stripe is still retrying');
    assert.equal(core.planChangeFromEvent(sub({ status: 'canceled' }), priceIds).tier, 'expired');
    assert.equal(core.planChangeFromEvent({ ...sub({}), type: 'customer.subscription.deleted' }, priceIds).tier, 'expired');
    assert.equal(core.planChangeFromEvent(sub({ items: { data: [{ price: 'price_unknown' }] } }), priceIds).tier, 'pro', 'falls back to metadata');
    assert.equal(core.planChangeFromEvent({ type: 'invoice.paid', data: { object: {} } }, priceIds), null);
    assert.equal(core.planChangeFromEvent({ type: 'checkout.session.completed', data: { object: { metadata: { tier: 'gold' } } } }, priceIds).tier, null);
});

test('price ids come from the environment; return links only to our sites', () => {
    assert.deepEqual(core.readPriceIds({ GCQ_STRIPE_PRICE_PRO: ' price_p ', GCQ_STRIPE_PRICE_ELITE: '' }), { pro: 'price_p' });
    const origins = core.readAllowedOrigins({ GCQ_BILLING_RETURN_ORIGINS: 'https://app.example.gr' });
    assert.equal(core.allowedReturnUrl('https://app.example.gr/x?y=1', origins, 'f'), 'https://app.example.gr/x?y=1');
    assert.equal(core.allowedReturnUrl('', origins, 'fallback'), 'fallback');
    assert.throws(() => core.allowedReturnUrl('https://evil.example/', origins, 'f'), /not allowed/);
    assert.throws(() => core.allowedReturnUrl('javascript:alert(1)', origins, 'f'), /not allowed|not valid/);
});
