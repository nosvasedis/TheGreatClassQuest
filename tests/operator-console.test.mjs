import test from 'node:test';
import assert from 'node:assert/strict';

import { filterSchools, schoolYearlyIncome, stripeCustomerUrl, summarizeSchools } from '../features/operatorConsoleCore.mjs';
import { detailPageHtml, listPageHtml } from '../features/operatorConsoleView.mjs';

const schools = [
    { schoolId: 'alfa', name: 'Φροντιστήριο Άλφα', status: 'active', tier: 'pro', billing: { paysOnline: true, interval: 'year' } },
    { schoolId: 'beta', name: 'Beta English', status: 'active', tier: 'elite', billing: { paysOnline: true, interval: 'month' } },
    { schoolId: 'gamma', name: 'Gamma', status: 'active', tier: 'starter', billing: { paysOnline: false } },
    { schoolId: 'delta', name: 'Delta', status: 'suspended', tier: 'pro', billing: { paysOnline: true, interval: 'year' } },
    { schoolId: 'epsilon', name: 'Epsilon', status: 'active', tier: 'pending', billing: {} }
];

test('yearly income counts card payments by their choice and invoiced schools at the yearly price', () => {
    assert.deepEqual(schoolYearlyIncome(schools[0]), { amount: 280, kind: 'online' });
    assert.deepEqual(schoolYearlyIncome(schools[1]), { amount: 490, kind: 'online' }, 'monthly = 10 payments');
    assert.deepEqual(schoolYearlyIncome(schools[2]), { amount: 150, kind: 'manual' });
    assert.equal(schoolYearlyIncome(schools[3]).amount, 0, 'suspended schools bring nothing');
    assert.equal(schoolYearlyIncome(schools[4]).amount, 0, 'pending schools bring nothing');
    assert.equal(schoolYearlyIncome({ founding: true, status: 'active', tier: 'elite' }).amount, 0, 'your own school is not income');
});

test('the overview counts schools, plans and income, never the founding school', () => {
    const summary = summarizeSchools([...schools, { founding: true, schoolId: 'great-class-quest', status: 'active', tier: 'elite' }]);
    assert.equal(summary.total, 5);
    assert.equal(summary.active, 4);
    assert.equal(summary.suspended, 1);
    assert.deepEqual(summary.plans, { pending: 1, starter: 1, pro: 2, elite: 1, expired: 0 });
    assert.equal(summary.paysOnline, 3);
    assert.deepEqual(summary.income, { online: 770, manual: 150, total: 920 });
});

test('search ignores case and Greek accents; Stripe links open the right mode', () => {
    assert.deepEqual(filterSchools(schools, 'αλφα').map((s) => s.schoolId), ['alfa']);
    assert.deepEqual(filterSchools(schools, 'BETA').map((s) => s.schoolId), ['beta']);
    assert.equal(filterSchools(schools, '').length, 5);
    assert.equal(stripeCustomerUrl({ stripeCustomerId: 'cus_123', livemode: false }), 'https://dashboard.stripe.com/test/customers/cus_123');
    assert.equal(stripeCustomerUrl({ stripeCustomerId: 'cus_123', livemode: true }), 'https://dashboard.stripe.com/customers/cus_123');
    assert.equal(stripeCustomerUrl({ stripeCustomerId: 'javascript:alert(1)' }), '');
});

const details = {
    schoolId: 'alfa', name: 'Alfa <b>', status: 'active', createdAt: '2026-10-01T10:00:00Z', founding: false,
    plan: { tier: 'pro', endsAt: null },
    billing: { interval: 'year', stripeStatus: 'active', stripeCustomerId: 'cus_9', stripeSubscriptionId: 'sub_9', livemode: false },
    office: { active: true, username: 'office', uid: 'u1' },
    counts: { classes: 4, students: 50, teachers: 1, familyLogins: 20 },
    teachers: [{ uid: 't1', name: 'Maria', email: 'maria@example.test', status: 'active', lastSignIn: null }]
};

test('the school page escapes names, keeps delete locked until the code is typed, and shows the founding school read-only', () => {
    const locked = detailPageHtml(details);
    assert.ok(locked.includes('Alfa &lt;b&gt;'));
    assert.match(locked, /data-action="delete" disabled/);
    assert.match(locked, /test\/customers\/cus_9/);
    assert.match(locked, /data-action="teacher-status" data-uid="t1" data-status="disabled"/);
    assert.doesNotMatch(detailPageHtml(details, { deleteCode: 'ALFA ' }), /data-action="delete" disabled/);
    const founding = detailPageHtml({ ...details, founding: true });
    assert.doesNotMatch(founding, /data-action="delete"/);
    assert.doesNotMatch(founding, /data-action="save-plan"/);
});

test('the list shows your school first and filters by the search', () => {
    const html = listPageHtml({ schools, founding: { founding: true, schoolId: 'great-class-quest', name: 'Prodigies', status: 'active', tier: 'elite' }, query: '' });
    assert.ok(html.indexOf('Prodigies') < html.indexOf('Beta English'));
    assert.match(html, /Your school/);
    assert.doesNotMatch(listPageHtml({ schools, query: 'gamma' }), /Beta English/);
});
