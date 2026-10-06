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
    const priceIds = { starter: { month: 'price_s' }, pro: { month: 'price_p', year: 'price_py' }, elite: { month: 'price_e', year: 'price_ey' } };
    assert.deepEqual(core.planChangeFromEvent({
        type: 'checkout.session.completed',
        data: { object: { metadata: { gcqSchoolId: 'alpha', tier: 'pro' }, customer: 'cus_1', subscription: 'sub_1' } }
    }, priceIds), { schoolId: 'alpha', tier: 'pro', interval: null, customerId: 'cus_1', subscriptionId: 'sub_1', status: 'active' });

    const sub = (extra) => ({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { gcqSchoolId: 'alpha', tier: 'pro' }, items: { data: [{ price: { id: 'price_e' } }] }, ...extra } } });
    assert.equal(core.planChangeFromEvent(sub({}), priceIds).tier, 'elite', 'the price decides, not old metadata');
    assert.equal(core.planChangeFromEvent(sub({}), priceIds).interval, 'month');
    const yearly = core.planChangeFromEvent(sub({ items: { data: [{ price: { id: 'price_py' } }] } }), priceIds);
    assert.deepEqual([yearly.tier, yearly.interval], ['pro', 'year'], 'a switch to yearly in the portal is seen');
    assert.equal(core.planChangeFromEvent(sub({ status: 'past_due' }), priceIds).tier, 'elite', 'Stripe is still retrying');
    assert.equal(core.planChangeFromEvent(sub({ status: 'canceled' }), priceIds).tier, 'expired');
    assert.equal(core.planChangeFromEvent({ ...sub({}), type: 'customer.subscription.deleted' }, priceIds).tier, 'expired');
    assert.equal(core.planChangeFromEvent(sub({ items: { data: [{ price: 'price_unknown' }] } }), priceIds).tier, 'pro', 'falls back to metadata');
    assert.equal(core.planChangeFromEvent({ type: 'invoice.paid', data: { object: {} } }, priceIds), null);
    assert.equal(core.planChangeFromEvent({ type: 'checkout.session.completed', data: { object: { metadata: { tier: 'gold' } } } }, priceIds).tier, null);
});

test('price ids come from the environment; return links only to our sites', () => {
    assert.deepEqual(core.readPriceIds({ GCQ_STRIPE_PRICE_PRO: ' price_p ', GCQ_STRIPE_PRICE_ELITE: '' }), { pro: { month: 'price_p' } }, 'a bare price id is the monthly one');
    assert.deepEqual(core.readPriceIds({
        GCQ_STRIPE_PRICE_PRO_MONTHLY: 'price_pm', GCQ_STRIPE_PRICE_PRO_YEARLY: 'price_py', GCQ_STRIPE_PRICE_PRO: 'old',
        GCQ_STRIPE_PRICE_ELITE_YEARLY: 'price_ey'
    }), { pro: { month: 'price_pm', year: 'price_py' }, elite: { year: 'price_ey' } });
    assert.deepEqual(core.tierForPrice('price_py', { pro: { month: 'price_pm', year: 'price_py' } }), { tier: 'pro', interval: 'year' });
    assert.equal(core.tierForPrice('nope', { pro: { month: 'price_pm' } }), null);
    const origins = core.readAllowedOrigins({ GCQ_BILLING_RETURN_ORIGINS: 'https://app.example.gr' });
    assert.equal(core.allowedReturnUrl('https://app.example.gr/x?y=1', origins, 'f'), 'https://app.example.gr/x?y=1');
    assert.equal(core.allowedReturnUrl('', origins, 'fallback'), 'fallback');
    assert.throws(() => core.allowedReturnUrl('https://evil.example/', origins, 'f'), /not allowed/);
    assert.throws(() => core.allowedReturnUrl('javascript:alert(1)', origins, 'f'), /not allowed|not valid/);
});

const at = (iso) => Date.parse(iso);
const athensDate = (seconds) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(seconds * 1000));

test('billing dates: monthly on the 1st, yearly on 1 September, Athens midnight in summer and winter time', () => {
    assert.equal(athensDate(core.athensMidnight(2026, 9, 1)), '2026-09-01, 00:00');
    assert.equal(athensDate(core.athensMidnight(2027, 1, 1)), '2027-01-01, 00:00');
    assert.equal(athensDate(core.athensMidnight(2026, 13, 1)), '2027-01-01, 00:00', 'month 13 rolls into January');

    const october = at('2026-10-06T10:00:00Z');
    assert.equal(athensDate(core.checkoutSchedule('month', october).billing_cycle_anchor), '2026-11-01, 00:00');
    assert.equal(athensDate(core.checkoutSchedule('year', october).billing_cycle_anchor), '2027-09-01, 00:00');
    const may = at('2027-05-10T10:00:00Z');
    assert.equal(athensDate(core.checkoutSchedule('year', may).billing_cycle_anchor), '2027-09-01, 00:00', 'joining in May pays only to 31 August');
});

test('joining in July or August costs nothing until 1 September', () => {
    for (const interval of ['month', 'year']) {
        const schedule = core.checkoutSchedule(interval, at('2027-07-10T10:00:00Z'));
        assert.equal(athensDate(schedule.trial_end), '2027-09-01, 00:00');
        assert.equal('billing_cycle_anchor' in schedule, false);
    }
    // Too close to 1 September for a Stripe trial (it needs 48 hours): bill from 1 September.
    const late = core.checkoutSchedule('month', at('2027-08-30T12:00:00Z'));
    assert.equal(athensDate(late.billing_cycle_anchor), '2027-09-01, 00:00');
    assert.equal('trial_end' in late, false);
});

test('anchors are always comfortably in the future', () => {
    const lastMinute = at('2026-10-31T21:30:00Z'); // 31 Oct, 23:30 in Athens
    const schedule = core.checkoutSchedule('month', lastMinute);
    assert.ok(schedule.billing_cycle_anchor - lastMinute / 1000 >= 3600);
    assert.equal(athensDate(schedule.billing_cycle_anchor), '2026-12-01, 00:00');
});

test('the summer pause covers the 1 July and 1 August payments with margin on both sides', () => {
    assert.equal(core.summerPauseWindow(at('2027-06-14T10:00:00Z')).active, false);
    assert.equal(core.summerPauseWindow(at('2027-06-15T10:00:00Z')).active, true);
    assert.equal(core.summerPauseWindow(at('2027-08-14T10:00:00Z')).active, true);
    assert.equal(core.summerPauseWindow(at('2027-08-15T10:00:00Z')).active, false);
    const window = core.summerPauseWindow(at('2027-06-20T10:00:00Z'));
    assert.equal(window.year, 2027);
    assert.equal(athensDate(window.resumesAt), '2027-08-15, 00:00');
    assert.ok(window.resumesAt > core.athensMidnight(2027, 8, 1) && window.resumesAt < core.athensMidnight(2027, 9, 1));
});
