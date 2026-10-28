import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createConcurrencyQueue } from '../utils/asyncQueue.js';
import * as resilience from '../utils/aiResilience.js';

function harness(fetch) {
    let source = readFileSync(new URL('../api.js', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/export /g, '');
    const start = source.indexOf('async function getAuthenticatedProxyHeaders');
    const end = source.indexOf('// Speech has its own', start);
    source = source.slice(0, start) + "async function getAuthenticatedProxyHeaders() { return { Authorization: 'Bearer synthetic' }; }\n" + source.slice(end);
    const deps = { fetch, createConcurrencyQueue, ...resilience, AI_TEXT_PROVIDERS: [], DEEPSEEK_MODEL_ID: 'unchanged', cloudflareWorkerUrl: 'https://worker.example', blobToBase64: async blob => `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`, console: { warn() {}, error() {} } };
    return new Function(...Object.keys(deps), source + '\nreturn { callCloudflareAiImageApi, recordAiFailure, isAiCircuitOpen, getGlobalRateLimitRemainingMs };')(...Object.values(deps));
}
const image = () => new Response(new Uint8Array(64), { headers: { 'Content-Type': 'image/jpeg' } });

test('overlapping images share one inference, later Redraw still paints fresh, at 512px', async () => {
    let calls = 0, finish;
    const api = harness(async (_, options) => {
        calls++;
        const payload = JSON.parse(options.body);
        assert.equal(payload.width, 512); assert.equal(payload.height, 512);
        await new Promise(resolve => { finish = resolve; });
        return image();
    });
    const a = api.callCloudflareAiImageApi('fox'), b = api.callCloudflareAiImageApi('fox');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1); finish();
    assert.equal(await a, await b);
    const redraw = api.callCloudflareAiImageApi('fox');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 2); finish(); await redraw;
});

test('image failures neither retry a full model chain nor trip the text circuit', async () => {
    let calls = 0;
    const api = harness(async () => { calls++; return new Response('{}', { status: 503 }); });
    for (let i = 0; i < 3; i++) await assert.rejects(api.callCloudflareAiImageApi('fox'), /503/);
    assert.equal(calls, 3);
    assert.equal(api.isAiCircuitOpen(), false);
});

test('text failures do not block images, and image rate limits do not pause text', async () => {
    const api = harness(async () => new Response('{}', { status: 429, headers: { 'Retry-After': '60' } }));
    api.recordAiFailure(); api.recordAiFailure();
    assert.equal(api.isAiCircuitOpen(), true);
    await assert.rejects(api.callCloudflareAiImageApi('fox'), { status: 429 });
    assert.equal(api.getGlobalRateLimitRemainingMs(), 0);
});

test('school quota errors retain their cause and never retry; JSON success is not an image', async () => {
    let calls = 0;
    const api = harness(async () => { calls++; return new Response('{}', { status: 429, headers: { 'X-GCQ-Error-Source': 'school-ai-quota' } }); });
    await assert.rejects(api.callCloudflareAiImageApi('fox'), { errorSource: 'school-ai-quota' });
    assert.equal(calls, 1);
    await assert.rejects(harness(async () => new Response('{}')).callCloudflareAiImageApi('fox'), /invalid image/);
});
