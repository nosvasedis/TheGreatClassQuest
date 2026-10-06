import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { schoolAiLimitMessage, isFinalAiErrorSource, shouldCountAsCircuitFailure } from '../utils/aiResilience.js';

const source = await readFile(new URL('../scratch/ai-proxy-worker/src/worker.js', import.meta.url), 'utf8');
const worker = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function memoryStorage() {
    const map = new Map();
    return {
        async get(key) { return map.get(key); },
        async put(key, value) { map.set(key, value); },
        async list({ prefix }) { return new Map([...map].filter(([key]) => key.startsWith(prefix))); }
    };
}

function usageNamespace() {
    const objects = new Map();
    return {
        idFromName: (name) => name,
        get(id) {
            if (!objects.has(id)) objects.set(id, new worker.SchoolAiUsage({ storage: memoryStorage() }));
            const object = objects.get(id);
            return { fetch: (url, init) => object.fetch(new Request(url, init)) };
        }
    };
}

function schoolDocument({ status = 'active', tier = 'pro', endsAt = '', startsAt = '' } = {}) {
    const plan = { tier: { stringValue: tier } };
    if (endsAt) plan.endsAt = { stringValue: endsAt };
    if (startsAt) plan.startsAt = { stringValue: startsAt };
    return { fields: { status: { stringValue: status }, subscription: { mapValue: { fields: plan } } } };
}

async function withFirestore(document, run) {
    const realFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init) => {
        calls.push(String(url));
        return document === null ? new Response('{}', { status: 404 }) : Response.json(document);
    };
    try {
        return await run(calls);
    } finally {
        globalThis.fetch = realFetch;
    }
}

const identity = { projectId: 'the-great-class-quest', uid: 'teacher-b', token: 'id-token' };

test('the counter allows up to the limit, per school, per month and per route', async () => {
    const usage = new worker.SchoolAiUsage({ storage: memoryStorage() });
    const consume = (route, limit, month = '2026-10') => usage.fetch(new Request('https://x/consume', { method: 'POST', body: JSON.stringify({ month, route, limit }) })).then((r) => r.json());
    assert.deepEqual(await consume('chat', 2), { allowed: true, used: 1, limit: 2 });
    assert.deepEqual(await consume('chat', 2), { allowed: true, used: 2, limit: 2 });
    assert.deepEqual(await consume('chat', 2), { allowed: false, used: 2, limit: 2 });
    assert.equal((await consume('image', 1)).allowed, true);
    assert.equal((await consume('chat', 2, '2026-11')).allowed, true);
    const report = await usage.fetch(new Request('https://x/usage?month=2026-10')).then((r) => r.json());
    assert.deepEqual(report, { month: '2026-10', usage: { chat: 2, image: 1 } });
});

test('plan dates and suspension decide the tier the allowance uses', () => {
    const now = Date.parse('2026-10-06T10:00:00Z');
    assert.equal(worker.effectiveSchoolTier({ status: 'active', tier: 'elite' }, now), 'elite');
    assert.equal(worker.effectiveSchoolTier({ status: 'suspended', tier: 'elite' }, now), 'expired');
    assert.equal(worker.effectiveSchoolTier({ status: 'active', tier: 'pro', endsAt: '2026-10-01T00:00:00Z' }, now), 'expired');
    assert.equal(worker.effectiveSchoolTier({ status: 'active', tier: 'pro', startsAt: '2026-11-01T00:00:00Z' }, now), 'pending');
    assert.equal(worker.effectiveSchoolTier({ status: 'active', tier: 'platinum' }, now), 'pending');
    assert.deepEqual(worker.schoolPlanFromDocument(schoolDocument({ tier: 'elite', endsAt: '2027-06-30T23:59:59.000Z' })),
        { status: 'active', tier: 'elite', startsAt: null, endsAt: '2027-06-30T23:59:59.000Z' });
    assert.equal(worker.schoolUsageMonth(Date.parse('2026-10-31T22:30:00Z')), '2026-11', 'Athens is already in November');
});

test('limits can be tuned with SCHOOL_AI_MONTHLY_LIMITS without code changes', () => {
    const limits = worker.resolveSchoolAiLimits({ SCHOOL_AI_MONTHLY_LIMITS: '{"pro":{"chat":2000},"elite":{"image":-5}}' });
    assert.equal(limits.pro.chat, 2000);
    assert.equal(limits.elite.image, worker.DEFAULT_SCHOOL_AI_LIMITS.elite.image);
    assert.deepEqual(worker.resolveSchoolAiLimits({ SCHOOL_AI_MONTHLY_LIMITS: 'not json' }), worker.resolveSchoolAiLimits({}));
});

test('the founding school is never metered and never reads a plan', async () => {
    await withFirestore(schoolDocument(), async (calls) => {
        assert.equal(await worker.enforceSchoolAiAllowance(identity, 'great-class-quest', 'image', {}), null);
        assert.equal(calls.length, 0);
    });
});

test('another school is refused at its allowance, by plan, and when suspended or unknown', async () => {
    const env = { SCHOOL_AI_USAGE: usageNamespace(), SCHOOL_AI_MONTHLY_LIMITS: '{"pro":{"chat":2}}' };
    await withFirestore(schoolDocument({ tier: 'pro' }), async (calls) => {
        assert.equal(await worker.enforceSchoolAiAllowance(identity, 'school-b', 'chat', env), null);
        assert.equal(await worker.enforceSchoolAiAllowance(identity, 'school-b', 'chat', env), null);
        const refused = await worker.enforceSchoolAiAllowance(identity, 'school-b', 'chat', env);
        assert.equal(refused.status, 403);
        assert.equal(refused.headers.get('X-GCQ-Error-Source'), 'school-ai-quota');
        assert.match(calls[0], /documents\/schools\/school-b$/);
        // Pro has no speech allowance at all.
        assert.equal((await worker.enforceSchoolAiAllowance(identity, 'school-b', 'speech', env)).headers.get('X-GCQ-Error-Source'), 'school-ai-plan');
        // Another school keeps its own counter.
        assert.equal(await worker.enforceSchoolAiAllowance(identity, 'school-c', 'chat', env), null);
    });
    await withFirestore(schoolDocument({ tier: 'elite', status: 'suspended' }), async () => {
        const refused = await worker.enforceSchoolAiAllowance(identity, 'school-d', 'chat', env);
        assert.equal(refused.headers.get('X-GCQ-Error-Source'), 'school-ai-plan');
    });
    await withFirestore(null, async () => {
        const refused = await worker.enforceSchoolAiAllowance(identity, 'school-e', 'chat', env);
        assert.equal(refused.headers.get('X-GCQ-Error-Source'), 'school-ai-plan');
    });
});

test('a counter outage never blocks a lesson', async () => {
    const env = { SCHOOL_AI_USAGE: { idFromName: (n) => n, get: () => ({ fetch: async () => { throw new Error('down'); } }) } };
    await withFirestore(schoolDocument({ tier: 'elite' }), async () => {
        assert.equal(await worker.enforceSchoolAiAllowance(identity, 'school-b', 'chat', env), null);
    });
});

test('the browser treats a school limit as final, plain and harmless to the AI breaker', () => {
    for (const source of ['school-ai-quota', 'school-ai-plan']) {
        assert.equal(isFinalAiErrorSource(source), true);
        assert.ok(schoolAiLimitMessage(source).length > 20);
        assert.equal(shouldCountAsCircuitFailure({ status: 403, errorSource: source }), false);
    }
    assert.equal(schoolAiLimitMessage('deepseek'), '');
});
