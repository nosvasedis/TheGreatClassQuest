// English narration uses a named cloud voice when the caller asks for one (the quiz cast);
// everything else reads with the best device voice. MeloTTS, the old cloud voice for plain
// lines, was retired by Workers AI on 2026-11-20; lines it read earlier still replay from the
// caches (this laptop, and the worker's for a month).
// Every cloud line is also kept on this laptop (Cache API), so a chronicle or quiz line heard
// once replays without the network or the day's free allowance. When the cloud says the
// allowance is spent (429), it rests for a while (remembered across reloads) and the best
// voice this laptop has reads instead, so read aloud never just fails.
let activeSpeech = null;
let narrationAudio = null;
const REST_KEY = 'gcq.cloudSpeechRestUntil';
let cloudUnavailableUntil = readRest();
const DISK_CACHE = 'gcq-speech-v1';
const DISK_CACHE_MAX = 160;
const audioCache = new Map();
const pendingAudio = new Map();
const MAX_CACHE_BYTES = 12 * 1024 * 1024;
let cacheBytes = 0;
// MeloTTS reads quickly for young language learners; its audio plays a little slower
// (pitch kept). Named voices play at the pace the caller asks for.
const MELO_PACE = 0.88;

function cacheKey(chunk, voice) { return voice ? `${voice}|${chunk}` : chunk; }

/** A friendly name for whoever spoke: the named voice, or '' for MeloTTS and device voices. */
function speakerName(provider) {
    const voice = String(provider || '').match(/aura[^:]*:([a-z]+)/i)?.[1] || '';
    return voice ? voice[0].toUpperCase() + voice.slice(1) : '';
}

function deviceSupported() {
    return typeof window !== 'undefined' && !!window.speechSynthesis
        && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function isTtsSupported() {
    return typeof window !== 'undefined' && (typeof Audio !== 'undefined' || deviceSupported());
}

export function isSpeaking() {
    // Include fetching: a second click must stop a pending narration too.
    return !!activeSpeech;
}

export function stopSpeech() {
    const job = activeSpeech;
    activeSpeech = null;
    if (!job) return;
    job.controller.abort();
    job.cancelPlayback?.();
    job.audio?.pause();
    if (job.url) URL.revokeObjectURL(job.url);
    job.url = null;
    if (deviceSupported()) window.speechSynthesis.cancel();
    // Intentional stop never calls onEnd (which can turn a storybook page).
}

export function splitSpeechText(text, maxLength = 650) {
    const chunks = [];
    let remaining = String(text || '').trim();
    while (remaining.length > maxLength) {
        const head = remaining.slice(0, maxLength + 1);
        const boundaries = [...head.matchAll(/[.!?;]\s+/g)];
        const sentenceEnd = boundaries.at(-1)?.index;
        let end = sentenceEnd >= maxLength / 2 ? sentenceEnd + 1 : head.lastIndexOf(' ');
        if (end < maxLength / 2) end = maxLength;
        if (/[\uD800-\uDBFF]/.test(remaining[end - 1])) end -= 1;
        chunks.push(remaining.slice(0, end).trim());
        remaining = remaining.slice(end).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
}

function readRest() {
    try { return Math.max(0, Number(globalThis.localStorage?.getItem(REST_KEY)) || 0); } catch (_) { return 0; }
}

/** How long the cloud voice rests after a failure: a spent allowance rests far longer than a blip. */
export function cloudRestMs(error) {
    const status = Number(error?.status) || 0;
    const source = String(error?.source || '');
    if (status === 429 && source === 'speech-unavailable') return 30 * 60_000; // the day's free allowance is spent
    if (status === 429) return Math.min(10 * 60_000, Math.max(60_000, (Number(error?.retryAfter) || 0) * 1000));
    if (status === 403 && source.startsWith('school-ai')) return 6 * 3_600_000; // not in this school's plan
    if (status === 503 && source === 'speech-free-plan') return 6 * 3_600_000;
    return 60_000;
}

function restCloud(error) {
    cloudUnavailableUntil = Math.max(cloudUnavailableUntil, Date.now() + cloudRestMs(error));
    try { globalThis.localStorage?.setItem(REST_KEY, String(cloudUnavailableUntil)); } catch (_) { /* private window */ }
}

function cloudResting() {
    return Date.now() < cloudUnavailableUntil;
}

async function diskUrl(key) {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
    return `https://gcq-speech.invalid/${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function diskAvailable() {
    return typeof caches !== 'undefined' && typeof crypto !== 'undefined' && !!crypto.subtle;
}

/** A cloud line kept on this laptop from an earlier play, or null. */
async function readDisk(key) {
    if (!diskAvailable()) return null;
    try {
        const cache = await caches.open(DISK_CACHE);
        const hit = await cache.match(await diskUrl(key));
        if (!hit) return null;
        const blob = await hit.blob();
        if (blob.size < 32) return null;
        blob.speechProvider = hit.headers.get('X-GCQ-AI-Provider') || '';
        return blob;
    } catch (_) {
        return null;
    }
}

async function writeDisk(key, blob) {
    if (!diskAvailable() || !blob?.size || blob.size > 4 * 1024 * 1024) return;
    try {
        const cache = await caches.open(DISK_CACHE);
        await cache.put(await diskUrl(key), new Response(blob, { headers: {
            'Content-Type': blob.type || 'audio/mpeg', 'X-GCQ-AI-Provider': blob.speechProvider || '',
        } }));
        const keys = await cache.keys();
        // Oldest first: drop the lines heard longest ago.
        for (const old of keys.slice(0, Math.max(0, keys.length - DISK_CACHE_MAX))) await cache.delete(old);
    } catch (_) { /* storage full or blocked: the line simply is not kept */ }
}

function rememberAudio(key, blob) {
    if (blob.size > MAX_CACHE_BYTES) return;
    while (audioCache.size && (cacheBytes + blob.size > MAX_CACHE_BYTES || audioCache.size >= 48)) {
        const oldest = audioCache.keys().next().value;
        cacheBytes -= audioCache.get(oldest).size;
        audioCache.delete(oldest);
    }
    audioCache.set(key, blob);
    cacheBytes += blob.size;
}

/**
 * Fetch the cloud voice for `text` ahead of time (for example while the quiz spotlight spins),
 * so speakText can start at once. Quietly does nothing when cloud speech is unavailable.
 */
export function prefetchSpeech(text, { voice = '' } = {}) {
    const cleanText = String(text || '').trim();
    if (!cleanText || typeof Audio === 'undefined') return;
    if (/[\u0370-\u03ff\u1f00-\u1fff]/u.test(cleanText)) return;
    for (const chunk of splitSpeechText(cleanText)) {
        const key = cacheKey(chunk, voice);
        if (audioCache.has(key) || pendingAudio.has(key)) continue;
        const request = readDisk(key)
            .then(async (kept) => {
                if (kept) return kept;
                if (!voice || cloudResting()) return null;
                const { callSpeechApi } = await import('../api.js');
                const blob = await callSpeechApi(chunk, voice ? { voice } : undefined);
                void writeDisk(key, blob);
                return blob;
            })
            .then((blob) => { if (blob) rememberAudio(key, blob); return blob; })
            .catch((error) => { restCloud(error); return null; })
            .finally(() => pendingAudio.delete(key));
        pendingAudio.set(key, request);
    }
}

function alive(job) { return activeSpeech === job && !job.controller.signal.aborted; }

// Loud and even: a narrator asked to `boost` (the quiz) plays through a little gain and a gentle
// compressor, so a projector's small speakers carry every word to the back of the room. It used to
// squeeze hard (ratio 12 after +7 dB, plus the compressor's own make-up gain), which pumped the
// breaths up and made the voices sound strange; now it only evens the words out.
// The narration element can be captured by Web Audio only once; when the audio context cannot
// run (no tap yet), the line plays plainly instead of silently.
let boostChain = null;

function boostContext() {
    if (boostChain) return boostChain;
    const Ctx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (!Ctx) return null;
    try {
        // A roomy output buffer: narration plays next to busy animations without crackling.
        const ctx = new Ctx({ latencyHint: 'playback' });
        const gain = ctx.createGain();
        const limiter = ctx.createDynamicsCompressor();
        gain.connect(limiter).connect(ctx.destination);
        boostChain = { ctx, gain, limiter, element: null };
    } catch (_) {
        boostChain = null;
    }
    return boostChain;
}

function setBoost(chain, on) {
    const t = chain.ctx.currentTime;
    chain.gain.gain.setValueAtTime(on ? 1.4 : 1, t);
    chain.limiter.threshold.setValueAtTime(on ? -18 : 0, t);
    chain.limiter.knee.setValueAtTime(on ? 12 : 0, t);
    chain.limiter.ratio.setValueAtTime(on ? 3 : 1, t);
    chain.limiter.attack.setValueAtTime(0.006, t);
    chain.limiter.release.setValueAtTime(0.3, t);
}

async function contextRunning(chain) {
    if (chain.ctx.state === 'running') return true;
    try { await Promise.race([chain.ctx.resume(), new Promise((resolve) => setTimeout(resolve, 400))]); } catch (_) { /* stays suspended */ }
    return chain.ctx.state === 'running';
}

/** The element to play on: the shared one (boosted or plain), or a fresh plain one when Web Audio is stuck. */
async function playbackElement(job, boost) {
    const audio = job.audio;
    const chain = boost ? boostContext() : boostChain;
    if (!chain) return audio;
    if (chain.element === audio) {
        if (!(await contextRunning(chain))) return new Audio();
        setBoost(chain, boost);
        return audio;
    }
    if (!boost || !(await contextRunning(chain))) return audio;
    try {
        chain.ctx.createMediaElementSource(audio).connect(chain.gain);
        chain.element = audio;
        setBoost(chain, true);
    } catch (_) { /* already captured elsewhere: play plainly */ }
    return audio;
}

function start(job, info = {}) {
    if (!alive(job) || job.started) return;
    job.started = true;
    job.opts.onStart?.(info);
}

async function playAudio(job, blob) {
    const audio = await playbackElement(job, Boolean(job.opts.boost));
    if (!alive(job)) return;
    if (audio !== job.audio) job.audio = audio;
    return new Promise((resolve, reject) => {
        job.url = URL.createObjectURL(blob);
        let finished = false;
        const finish = (error) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            audio.onended = audio.onerror = audio.onplaying = null;
            job.cancelPlayback = null;
            if (job.url) URL.revokeObjectURL(job.url);
            job.url = null;
            error ? reject(error) : resolve();
        };
        job.cancelPlayback = () => finish(new DOMException('Stopped', 'AbortError'));
        const timer = setTimeout(() => finish(new Error('Audio playback stalled')), 180000);
        audio.onplaying = () => start(job, { speaker: speakerName(blob.speechProvider) });
        audio.onended = () => finish();
        audio.onerror = () => finish(new Error('Audio playback failed'));
        audio.src = job.url;
        const pace = speakerName(blob.speechProvider) ? 1 : MELO_PACE;
        // Slowing a recorded voice stretches it; much below 0.86 it sounds warbly and robotic.
        const rate = Math.max(0.86, Math.min(1.3, (Number(job.opts.rate) || 1) * pace));
        // Set after src: loading a new source resets playbackRate to defaultPlaybackRate.
        audio.preservesPitch = true;
        audio.defaultPlaybackRate = rate;
        audio.playbackRate = rate;
        try { Promise.resolve(audio.play()).catch(finish); }
        catch (error) { finish(error); }
    });
}

// Voices a browser ships for fun, never for reading to a class (macOS novelty voices).
const NOVELTY_VOICES = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|ralph|fred|junior|kathy|princess)\b/i;

/**
 * Device voices for `hint` (a language like 'en' or 'el'), best first. Neural voices (Edge's
 * "Online (Natural)", Safari's Premium/Enhanced) read far better than the old desktop ones, and
 * a British English voice suits the classroom best. Pure, so it can be tested.
 */
export function rankDeviceVoices(voices = [], hint = 'en') {
    const want = String(hint || 'en').toLowerCase();
    const score = (v) => {
        const lang = String(v.lang || '').toLowerCase().replace('_', '-');
        const name = String(v.name || '');
        let points = 0;
        if (want === 'en') points += lang === 'en-gb' ? 4 : lang === 'en-us' ? 3 : /^en-(au|ie|nz|ca)/.test(lang) ? 2 : 1;
        if (/natural|neural/i.test(name)) points += 10;
        if (/premium|enhanced/i.test(name)) points += 6;
        if (/^google\b/i.test(name)) points += 5;
        if (/online/i.test(name)) points += 2;
        if (NOVELTY_VOICES.test(name)) points -= 20;
        if (v.default) points += 0.5;
        return points;
    };
    return voices
        .filter((v) => String(v.lang || '').toLowerCase().startsWith(want) || String(v.name || '').toLowerCase().includes(want))
        .map((v, i) => ({ v, i, s: score(v) }))
        .sort((a, b) => b.s - a.s || a.i - b.i)
        .map((x) => x.v);
}

async function deviceVoices(job) {
    const synth = window.speechSynthesis;
    if (!synth.getVoices().length) {
        await new Promise(resolve => {
            const done = () => { clearTimeout(timer); synth.removeEventListener?.('voiceschanged', done); resolve(); };
            const timer = setTimeout(done, 700);
            synth.addEventListener?.('voiceschanged', done, { once: true });
        });
    }
    const hint = String(job.opts.lang || job.opts.voiceHint || 'en').toLowerCase();
    return rankDeviceVoices(synth.getVoices(), hint.split('-')[0] === 'en' ? 'en' : hint);
}

function speakPiece(job, text, voice) {
    return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        job.utterance = utterance;
        utterance.voice = voice;
        utterance.lang = job.opts.lang || voice?.lang || (/^[a-z]{2}(?:-|$)/i.test(job.opts.voiceHint || '') ? job.opts.voiceHint : 'en-GB');
        utterance.rate = Number(job.opts.rate) || 1;
        utterance.pitch = Number(job.opts.pitch) || 1;
        const finish = (error) => {
            clearTimeout(timer);
            utterance.onstart = utterance.onend = utterance.onerror = null;
            job.utterance = null;
            job.cancelPlayback = null;
            error ? reject(error) : resolve();
        };
        const timer = setTimeout(() => { finish(new Error('Device narration stalled')); synthCancel(); }, 60000);
        job.cancelPlayback = () => finish(new DOMException('Stopped', 'AbortError'));
        utterance.onstart = () => start(job);
        utterance.onend = () => finish();
        utterance.onerror = event => finish(new Error(event.error || 'Device narration failed'));
        try {
            window.speechSynthesis.resume?.();
            window.speechSynthesis.speak(utterance);
        } catch (error) { finish(error); }
    });
}

// Chrome's online voices fall silent after about 15 seconds of one utterance, so the device
// reads a sentence or two at a time. A voice that fails (an online voice with no network)
// hands its words to the next best voice.
async function playDevice(job, text) {
    if (!deviceSupported()) throw new Error('Narration is unavailable on this device');
    job.deviceVoices ||= await deviceVoices(job);
    if (!alive(job)) return;
    for (const piece of splitSpeechText(text, 220)) {
        for (;;) {
            if (!alive(job)) return;
            try {
                await speakPiece(job, piece, job.deviceVoices[0] || null);
                break;
            } catch (error) {
                if (!alive(job) || error?.name === 'AbortError') return;
                if (job.deviceVoices.length < 2 || /interrupted|canceled/.test(String(error?.message))) throw error;
                job.deviceVoices = job.deviceVoices.slice(1);
            }
        }
    }
}

function synthCancel() { if (deviceSupported()) window.speechSynthesis.cancel(); }

async function cloudAudio(job, chunk, voice, state) {
    const key = cacheKey(chunk, voice);
    let blob = audioCache.get(key) || null;
    if (!blob && pendingAudio.has(key)) blob = await pendingAudio.get(key);
    if (!blob) {
        blob = await readDisk(key);
        if (blob) rememberAudio(key, blob);
    }
    // Plain lines (no named voice) have no cloud voice since MeloTTS was retired: a line kept
    // from before still plays, anything new goes straight to the device voice.
    if (blob || !voice || !state.network || !alive(job)) return blob;
    if (cloudResting()) { state.network = false; return null; }
    try {
        const { callSpeechApi } = await import('../api.js');
        if (!alive(job)) return null;
        blob = await callSpeechApi(chunk, voice ? { signal: job.controller.signal, voice } : { signal: job.controller.signal });
        if (!alive(job)) return null;
        rememberAudio(key, blob);
        void writeDisk(key, blob);
        return blob;
    } catch (error) {
        if (alive(job)) restCloud(error);
        state.network = false;
        return null;
    }
}

async function narrate(job, text) {
    const hint = String(job.opts.lang || job.opts.voiceHint || 'en').toLowerCase();
    let cloud = !!job.audio && hint.startsWith('en') && !/[Ͱ-Ͽἀ-῿]/u.test(text);
    const voice = String(job.opts.voice || '');
    const state = { network: true };
    for (const chunk of splitSpeechText(text)) {
        if (!alive(job)) return;
        if (cloud) {
            const blob = await cloudAudio(job, chunk, voice, state);
            if (!alive(job)) return;
            if (blob) {
                await job.unlock;
                if (!alive(job)) return;
                try { await playAudio(job, blob); }
                catch (error) {
                    if (!alive(job)) return;
                    if (job.started) throw error;
                    cloud = false;
                    await playDevice(job, chunk);
                }
                continue;
            }
        }
        await playDevice(job, chunk);
    }
    if (!alive(job)) return;
    activeSpeech = null;
    job.opts.onEnd?.();
}

export function speakText(text, opts = {}) {
    const cleanText = String(text || '').trim();
    if (!cleanText || !isTtsSupported()) {
        opts.onError?.(new Error(cleanText ? 'TTS_NOT_SUPPORTED' : 'EMPTY_TTS_TEXT'));
        return false;
    }
    stopSpeech();
    synthCancel();
    // Reuse the element unlocked by the first click: the story reader also starts
    // later pages automatically, outside a new mobile-browser user gesture.
    const job = { opts, controller: new AbortController(), audio: typeof Audio !== 'undefined' ? (narrationAudio ||= new Audio()) : null, started: false };
    activeSpeech = job;
    // Unlock this element during the teacher's click for mobile browsers.
    if (job.audio) {
        job.audio.src = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
        try {
            job.unlock = Promise.resolve(job.audio.play()).then(() => { if (alive(job)) job.audio.pause(); }).catch(() => {});
        } catch (_) { job.unlock = Promise.resolve(); }
    }
    void narrate(job, cleanText).catch(error => {
        if (!alive(job)) return;
        stopSpeech();
        opts.onError?.(error);
    });
    return true;
}
