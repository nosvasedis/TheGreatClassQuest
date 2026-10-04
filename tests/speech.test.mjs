import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const tick = () => new Promise(resolve => setImmediate(resolve));
const mp3 = Uint8Array.from([0x49, 0x44, 0x33, ...Array(100).fill(0)]);

function setGlobal(t, name, value) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    t.after(() => { if (original) Object.defineProperty(globalThis, name, original); else delete globalThis[name]; });
}

async function workerModule() {
    const source = await readFile(new URL('scratch/ai-proxy-worker/src/worker.js', root), 'utf8');
    return (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${crypto.randomUUID()}`)).default;
}
function request(payload, authenticated = true) {
    return new Request('https://worker.example/', {
        method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json',
            ...(authenticated ? { 'X-GCQ-Service-Key': 'speech-test-service' } : {}) },
        body: JSON.stringify(payload)
    });
}
function environment(run) {
    return { GCQ_AI_SERVICE_KEY: 'speech-test-service', FIREBASE_PROJECT_ID: 'the-great-class-quest',
        SPEECH_FREE_PLAN_CONFIRMED: 'true', AI: { run } };
}

test('speech pins MeloTTS and accepts stream, bytes, Response, and base64 outputs', async () => {
    for (const output of [mp3, new Response(mp3), new Blob([mp3]).stream(), { audio: Buffer.from(mp3).toString('base64') }]) {
        const worker = await workerModule();
        const env = environment(async (model, input) => {
            assert.equal(model, '@cf/myshell-ai/melotts');
            assert.deepEqual(input, { prompt: 'Together we learn.', lang: 'en' });
            return output;
        });
        const response = await worker.fetch(request({ text: 'Together we learn.', model_id: 'paid-model' }), env, {});
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000');
        assert.deepEqual(new Uint8Array(await response.arrayBuffer()), mp3);
    }
});

test('speech recognizes the live model base64 WAV and returns the correct MIME type', async () => {
    const worker = await workerModule();
    const wav = new Uint8Array(64);
    wav.set(new TextEncoder().encode('RIFF'), 0);
    wav.set(new TextEncoder().encode('WAVE'), 8);
    const env = environment(async () => ({ audio: Buffer.from(wav).toString('base64') }));
    const response = await worker.fetch(request({ text: 'Hello' }), env, {});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'audio/wav');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), wav);
});

test('speech does no inference without verified free plan, authentication, or valid English input', async () => {
    for (const scenario of ['plan', 'auth', 'language', 'length', 'empty', 'binding']) {
        const worker = await workerModule();
        const env = environment(() => assert.fail('Inference must not run'));
        const payload = { text: 'Hello' };
        if (scenario === 'plan') delete env.SPEECH_FREE_PLAN_CONFIRMED;
        if (scenario === 'binding') delete env.AI;
        if (scenario === 'length') payload.text = 'a'.repeat(1001);
        if (scenario === 'empty') payload.text = ' ';
        if (scenario === 'language') payload.lang = 'el';
        const response = await worker.fetch(request(payload, scenario !== 'auth'), env, {});
        assert.equal(response.status, scenario === 'auth' ? 401 : ['plan', 'binding'].includes(scenario) ? 503 : 400);
    }
});

test('speech quota failures and malformed upstream output never use a paid fallback', async () => {
    for (const kind of ['quota', 'json', 'empty', 'wrapper', 'http-error']) {
        const worker = await workerModule();
        let calls = 0;
        const env = environment(async () => {
            calls += 1;
            if (kind === 'quota') throw new Error('Neuron limit exceeded');
            if (kind === 'json') return new Response('{"error":"unavailable"}');
            if (kind === 'empty') return new Uint8Array();
            if (kind === 'wrapper') return { error: 'unavailable' };
            return new Response(mp3, { status: 503 });
        });
        const response = await worker.fetch(request({ text: 'Hello' }), env, {});
        assert.equal(response.status, kind === 'quota' ? 429 : 503);
        assert.equal(calls, 1);
        assert.equal(response.headers.get('X-GCQ-Error-Source'), 'speech-unavailable');
    }
});

async function setupNarrator(t, generate, { autoEnd = true, denyAudio = false, voices = true } = {}) {
    let source = await readFile(new URL('features/tts.js', root), 'utf8');
    source = source.replace("await import('../api.js')", '({ callSpeechApi: globalThis.__speechGenerate })');
    const audios = [];
    const spoken = [];
    const released = [];
    const synth = { getVoices: () => voices ? [{ name: 'English', lang: 'en-GB' }] : [],
        addEventListener(name, callback) { voices = true; queueMicrotask(callback); }, removeEventListener() {},
        cancel() {}, resume() {}, speak(utterance) {
            spoken.push(utterance);
            queueMicrotask(() => { utterance.onstart?.(); if (autoEnd) utterance.onend?.(); });
        } };
    class Audio {
        constructor() { audios.push(this); }
        pause() {}
        play() {
            if (this.src.startsWith('data:')) return Promise.resolve();
            if (denyAudio) return Promise.reject(new Error('Autoplay blocked'));
            queueMicrotask(() => { this.onplaying?.(); if (autoEnd) this.onended?.(); });
            return Promise.resolve();
        }
    }
    setGlobal(t, 'window', { speechSynthesis: synth });
    setGlobal(t, 'Audio', Audio);
    setGlobal(t, 'SpeechSynthesisUtterance', class { constructor(text) { this.text = text; } });
    setGlobal(t, '__speechGenerate', generate);
    t.mock.method(URL, 'createObjectURL', () => `blob:${crypto.randomUUID()}`);
    t.mock.method(URL, 'revokeObjectURL', url => released.push(url));
    const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${crypto.randomUUID()}`);
    t.after(() => module.stopSpeech());
    return { ...module, audios, spoken, released };
}

test('narration works without device voices and replay uses cached audio once', async t => {
    let generations = 0, starts = 0, ends = 0;
    const narrator = await setupNarrator(t, async () => { generations += 1; return new Blob([mp3]); });
    globalThis.window = {};
    assert.equal(narrator.isTtsSupported(), true);
    const opts = { onStart() { starts += 1; }, onEnd() { ends += 1; } };
    narrator.speakText('A shared adventure.', opts);
    assert.equal(narrator.isSpeaking(), true);
    await tick();
    assert.equal(narrator.isSpeaking(), false);
    narrator.speakText('A shared adventure.', opts);
    await tick();
    assert.equal(generations, 1);
    assert.equal(starts, 2); assert.equal(ends, 2);
    assert.equal(narrator.released.length, 2);
    assert.equal(narrator.audios.length, 1, 'Later pages reuse the mobile-unlocked audio element');
});

test('stopping pending speech ignores late audio and cannot turn a page', async t => {
    let release, ended = 0;
    const narrator = await setupNarrator(t, () => new Promise(resolve => { release = resolve; }));
    narrator.speakText('Waiting for narration.', { onEnd() { ended += 1; } });
    await tick();
    narrator.stopSpeech();
    release(new Blob([mp3]));
    await tick();
    assert.equal(narrator.isSpeaking(), false);
    assert.equal(ended, 0);
    assert.equal(narrator.released.length, 0);
});

test('stop during playback cleans audio without end/error callbacks', async t => {
    let callbacks = 0;
    const narrator = await setupNarrator(t, async () => new Blob([mp3]), { autoEnd: false });
    narrator.speakText('Our story.', { onEnd() { callbacks++; }, onError() { callbacks++; } });
    await tick();
    const oldEnd = narrator.audios[0].onended;
    narrator.stopSpeech();
    oldEnd?.();
    await tick();
    assert.equal(callbacks, 0);
    assert.equal(narrator.released.length, 1);
});

test('quota failures use ready device voices and finish long narration once', async t => {
    let starts = 0, ends = 0, calls = 0;
    const narrator = await setupNarrator(t, async () => { calls++; throw new Error('quota exceeded'); }, { voices: false });
    const text = 'The children share a wonderful adventure. '.repeat(45).trim();
    narrator.speakText(text, { voiceHint: 'en', onStart() { starts++; }, onEnd() { ends++; } });
    await tick();
    assert.equal(calls, 1);
    assert.equal(starts, 1); assert.equal(ends, 1);
    assert.ok(narrator.spoken.every(u => u.text.length <= 650));
    assert.equal(narrator.spoken.map(u => u.text).join(' '), text);
    assert.equal(narrator.isSpeaking(), false);
});

test('autoplay denial uses device narration; Greek never requests MeloTTS', async t => {
    let calls = 0;
    const narrator = await setupNarrator(t, async () => { calls++; return new Blob([mp3]); }, { denyAudio: true });
    narrator.speakText('We read together.');
    await tick();
    narrator.speakText('Διαβάζουμε μαζί.', { voiceHint: 'el' });
    await tick();
    assert.equal(calls, 1);
    assert.equal(narrator.spoken.length, 2);
    assert.equal(narrator.spoken[1].lang, 'el');
});

test('text splitting preserves unbroken words and surrogate pairs', async t => {
    const narrator = await setupNarrator(t, async () => new Blob([mp3]));
    const text = 'x'.repeat(649) + '🌟'.repeat(400);
    const chunks = narrator.splitSpeechText(text);
    assert.equal(chunks.join(''), text);
    assert.ok(chunks.every(c => c.length <= 650 && !/[\uD800-\uDBFF]$/.test(c)));
});

test('speech API authenticates, refreshes rejected login once, and does not retry generation failures', async t => {
    const apiSource = await readFile(new URL('api.js', root), 'utf8');
    const speechSource = apiSource.slice(apiSource.indexOf('export async function callSpeechApi'), apiSource.indexOf('async function fetchAuthenticatedProxy'));
    const source = `const cloudflareWorkerUrl = 'https://worker.example/'; const getAuthenticatedProxyHeaders = globalThis.__speechHeaders;\n${speechSource}`;
    const refreshes = [];
    setGlobal(t, '__speechHeaders', async refresh => { refreshes.push(refresh); return { Authorization: 'Bearer test' }; });
    const { callSpeechApi } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(options.headers.Authorization, 'Bearer test');
        assert.deepEqual(JSON.parse(options.body), { text: 'Hello', lang: 'en' });
        calls++;
        return calls === 1 ? new Response('{}', { status: 401, headers: { 'X-GCQ-Error-Source': 'firebase-token' } })
            : new Response(mp3, { headers: { 'Content-Type': 'audio/mpeg' } });
    });
    assert.equal((await callSpeechApi('Hello')).size, mp3.length);
    assert.deepEqual(refreshes, [false, true]);
    calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('{}', { status: 429 }); });
    await assert.rejects(callSpeechApi('Hello'), /429/);
    assert.equal(calls, 1);
});
