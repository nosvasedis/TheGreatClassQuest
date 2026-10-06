import test from 'node:test';
import assert from 'node:assert/strict';

import { PLAN_PRICES, BILLED_MONTHS_PER_YEAR, planPriceCopy, yearlySaving, yearlyPerSchoolMonth, normalizeBillingInterval, formatEuro } from '../config/tiers/pricing.mjs';

test('the agreed prices: monthly Sept–June, yearly about 20% less than 10 months', () => {
    assert.deepEqual(PLAN_PRICES, { starter: { month: 19, year: 150 }, pro: { month: 35, year: 280 }, elite: { month: 49, year: 390 } });
    assert.equal(BILLED_MONTHS_PER_YEAR, 10);
    for (const tier of Object.keys(PLAN_PRICES)) {
        const tenMonths = PLAN_PRICES[tier].month * 10;
        const discount = 1 - PLAN_PRICES[tier].year / tenMonths;
        assert.ok(discount >= 0.19 && discount <= 0.22, `${tier} yearly discount ${discount}`);
        assert.equal(yearlySaving(tier), tenMonths - PLAN_PRICES[tier].year);
    }
    assert.equal(yearlySaving('pro'), 70);
    assert.equal(yearlyPerSchoolMonth('pro'), 28);
});

test('display copy for each plan and billing choice', () => {
    assert.deepEqual(planPriceCopy('pro', 'year'), { amount: '€280', unit: '/school year', note: 'Save €70 · about €28 a month', vat: '+ VAT' });
    assert.deepEqual(planPriceCopy('elite', 'month'), { amount: '€49', unit: '/month', note: 'Sept–June only · summer free', vat: '+ VAT' });
    assert.equal(planPriceCopy('starter', 'weekly').unit, '/school year', 'unknown choices fall back to yearly');
    assert.equal(planPriceCopy('platinum', 'year'), null);
    assert.equal(normalizeBillingInterval('month'), 'month');
    assert.equal(normalizeBillingInterval(undefined), 'year');
    assert.equal(formatEuro(19.5), '€19.50');
});
