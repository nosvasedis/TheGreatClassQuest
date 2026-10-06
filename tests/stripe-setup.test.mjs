import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fakeStripe = pathToFileURL(path.join(root, 'tests', 'helpers', 'fakeStripe.mjs')).href;

function runSetup(dir, key, extraArgs = []) {
    return spawnSync(process.execPath, ['--import', fakeStripe, path.join(root, 'scripts', 'stripe-setup.mjs'), '--dry-run', ...extraArgs], {
        cwd: root,
        encoding: 'utf8',
        env: {
            ...process.env,
            STRIPE_SECRET_KEY_INPUT: key,
            FAKE_STRIPE_STATE: path.join(dir, 'stripe.json'),
            GCQ_STRIPE_SETUP_ENV_FILE: path.join(dir, '.env'),
        },
    });
}

test('stripe setup creates everything once, reuses it on a second run, and never prints the key', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcq-stripe-'));
    const key = 'sk_test_secret_do_not_print_123';
    const first = runSetup(dir, key);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.equal(`${first.stdout}${first.stderr}`.includes(key), false, 'the secret key is never printed');
    assert.match(first.stdout, /Starter\s+€19\/month, €150\/year\s+created/);

    const state = JSON.parse(fs.readFileSync(path.join(dir, 'stripe.json'), 'utf8'));
    const prices = state.objects.prices;
    const byKey = Object.fromEntries(prices.map((price) => [price.lookup_key, price]));
    assert.equal(byKey.gcq_pro_monthly.unit_amount, 3500);
    assert.equal(byKey.gcq_pro_monthly.recurring.interval, 'month');
    assert.equal(byKey.gcq_pro_yearly.unit_amount, 28000);
    assert.equal(byKey.gcq_elite_yearly.unit_amount, 39000);
    assert.equal(byKey.gcq_starter_monthly.tax_behavior, 'exclusive');
    assert.equal(byKey.gcq_starter_monthly.currency, 'eur');
    const tax = state.objects.tax_rates[0];
    assert.deepEqual([tax.percentage, tax.inclusive, tax.country], ['24', 'false', 'GR']);
    const coupon = state.objects.coupons[0];
    assert.deepEqual([coupon.id, coupon.percent_off, coupon.duration, coupon.duration_in_months], ['gcq-founding-20', '20', 'repeating', '12']);
    const promo = state.objects.promotion_codes[0];
    assert.deepEqual([promo.code, promo.max_redemptions, promo.restrictions.first_time_transaction], ['FOUNDING20', '5', 'true']);
    const webhook = state.objects.webhook_endpoints[0];
    assert.equal(webhook.url, 'https://europe-west1-the-great-class-quest.cloudfunctions.net/stripeWebhook');
    assert.deepEqual(webhook.enabled_events, ['checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted']);
    assert.equal(webhook.api_version, '2024-06-20');
    const portal = state.objects['billing_portal/configurations'][0];
    assert.equal(portal.features.subscription_cancel.mode, 'at_period_end');
    assert.equal(portal.features.subscription_update.products.length, 3);

    const env = fs.readFileSync(path.join(dir, '.env'), 'utf8');
    assert.match(env, /^GCQ_ENABLE_STRIPE=true$/m);
    assert.match(env, new RegExp(`^GCQ_STRIPE_PRICE_PRO_YEARLY=${byKey.gcq_pro_yearly.id}$`, 'm'));
    assert.match(env, new RegExp(`^GCQ_STRIPE_TAX_RATE=${tax.id}$`, 'm'));
    assert.equal(env.includes(key), false, 'the key never goes into .env');
    assert.equal(env.includes('whsec_'), false, 'nor the webhook secret');

    const createdBefore = state.calls.filter((call) => call.startsWith('POST') && !/\/(prices|webhook_endpoints|billing_portal\/configurations)\//.test(call)).length;
    const second = runSetup(dir, key);
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.match(second.stdout, /Starter\s+€19\/month, €150\/year\s+already there/);
    assert.match(second.stdout, /already existed, so its signing secret is unchanged/);
    const after = JSON.parse(fs.readFileSync(path.join(dir, 'stripe.json'), 'utf8'));
    assert.equal(after.objects.prices.length, 6, 'no duplicate prices');
    assert.equal(after.objects.products.length, 3);
    assert.equal(after.objects.tax_rates.length, 1);
    assert.equal(after.objects.promotion_codes.length, 1);
    assert.equal(after.objects.webhook_endpoints.length, 1);
    const createsOnSecondRun = after.calls.slice(state.calls.length).filter((call) => /^POST \/(tax_rates|products|prices|coupons|promotion_codes|webhook_endpoints|billing_portal\/configurations)$/.test(call));
    assert.deepEqual(createsOnSecondRun, [], 'nothing new is created');
    assert.ok(createdBefore > 0);
});

test('stripe setup refuses a live key without --live, and anything that is not a key', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcq-stripe-'));
    const live = runSetup(dir, 'sk_live_abc');
    assert.notEqual(live.status, 0);
    assert.match(live.stdout, /LIVE key/);
    const junk = runSetup(dir, 'hello');
    assert.notEqual(junk.status, 0);
    assert.match(junk.stdout, /does not look like a Stripe secret key/);
    assert.equal(fs.existsSync(path.join(dir, '.env')), false, 'nothing written');
});
