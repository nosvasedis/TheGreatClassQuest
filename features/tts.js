// English narration uses MeloTTS, or a named cloud voice when the caller asks for one
// (the quiz cast); device voices remain the free fallback.
let activeSpeech = null;
let narrationAudio = null;
let cloudUnavailableUntil = 0;
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
    if (!cleanText || typeof Audio === 'undefined' || Date.now() < cloudUnavailableUntil) return;
    if (/[\u0370-\u03ff\u1f00-\u1fff]/u.test(cleanText)) return;
    for (const chunk of splitSpeechText(cleanText)) {
        const key = cacheKey(chunk, voice);
        if (audioCache.has(key) || pendingAudio.has(key)) continue;
        const request = import('../api.js')
            .then(({ callSpeechApi }) => callSpeechApi(chunk, voice ? { voice } : undefined))
            .then((blob) => { rememberAudio(key, blob); return blob; })
            .catch(() => { cloudUnavailableUntil = Date.now() + 60000; return null; })
            .finally(() => pendingAudio.delete(key));
        pendingAudio.set(key, request);
    }
}

function alive(job) { return activeSpeech === job && !job.controller.signal.aborted; }

// Loud and even: a narrator asked to `boost` (the quiz) plays through a gain and a limiter, so a
// projector's small speakers carry every word to the back of the room without crackling.
// The narration element can be captured by Web Audio only once; when the audio context cannot
// run (no tap yet), the line plays plainly instead of silently.
let boostChain = null;

function boostContext() {
    if (boostChain) return boostChain;
    const Ctx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (!Ctx) return null;
    try {
        const ctx = new Ctx();
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
    chain.gain.gain.setValueAtTime(on ? 2.2 : 1, t);
    chain.limiter.threshold.setValueAtTime(on ? -10 : 0, t);
    chain.limiter.knee.setValueAtTime(on ? 6 : 0, t);
    chain.limiter.ratio.setValueAtTime(on ? 12 : 1, t);
    chain.limiter.attack.setValueAtTime(0.002, t);
    chain.limiter.release.setValueAtTime(0.2, t);
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
        const rate = Math.max(0.7, Math.min(1.3, (Number(job.opts.rate) || 1) * pace));
        // Set after src: loading a new source resets playbackRate to defaultPlaybackRate.
        audio.preservesPitch = true;
        audio.defaultPlaybackRate = rate;
        audio.playbackRate = rate;
        try { Promise.resolve(audio.play()).catch(finish); }
        catch (error) { finish(error); }
    });
}

async function pickDeviceVoice(job) {
    const synth = window.speechSynthesis;
    if (!synth.getVoices().length) {
        await new Promise(resolve => {
            const done = () => { clearTimeout(timer); synth.removeEventListener?.('voiceschanged', done); resolve(); };
            const timer = setTimeout(done, 700);
            synth.addEventListener?.('voiceschanged', done, { once: true });
        });
    }
    const hint = String(job.opts.lang || job.opts.voiceHint || 'en').toLowerCase();
    return synth.getVoices().find(v => v.lang.toLowerCase().startsWith(hint)
        || v.name.toLowerCase().includes(hint)) || null;
}

async function playDevice(job, text) {
    if (!deviceSupported()) throw new Error('Narration is unavailable on this device');
    const voice = await pickDeviceVoice(job);
    if (!alive(job)) return;
    await new Promise((resolve, reject) => {
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
        const timer = setTimeout(() => { finish(new Error('Device narration stalled')); synthCancel(); }, 180000);
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

function synthCancel() { if (deviceSupported()) window.speechSynthesis.cancel(); }

async function narrate(job, text) {
    const hint = String(job.opts.lang || job.opts.voiceHint || 'en').toLowerCase();
    let cloud = !!job.audio && hint.startsWith('en') && !/[\u0370-\u03ff\u1f00-\u1fff]/u.test(text);
    const voice = String(job.opts.voice || '');
    for (const chunk of splitSpeechText(text)) {
        if (!alive(job)) return;
        if (cloud) {
            const key = cacheKey(chunk, voice);
            let blob = audioCache.get(key);
            if (!blob && pendingAudio.has(key)) {
                blob = await pendingAudio.get(key);
                if (!alive(job)) return;
            }
            try {
                if (!blob) {
                    if (Date.now() < cloudUnavailableUntil) throw new Error('Cloud speech cooling down');
                    const { callSpeechApi } = await import('../api.js');
                    if (!alive(job)) return;
                    blob = await callSpeechApi(chunk, voice ? { signal: job.controller.signal, voice } : { signal: job.controller.signal });
                    if (!alive(job)) return;
                    rememberAudio(key, blob);
                }
            } catch (error) {
                if (!alive(job)) return;
                cloudUnavailableUntil = Date.now() + 60000;
                cloud = false;
            }
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
