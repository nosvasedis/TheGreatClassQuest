// English narration uses MeloTTS; device voices remain the free fallback.
let activeSpeech = null;
let narrationAudio = null;
let cloudUnavailableUntil = 0;
const audioCache = new Map();
const MAX_CACHE_BYTES = 12 * 1024 * 1024;
let cacheBytes = 0;

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

function rememberAudio(text, blob) {
    if (blob.size > MAX_CACHE_BYTES) return;
    while (audioCache.size && (cacheBytes + blob.size > MAX_CACHE_BYTES || audioCache.size >= 48)) {
        const oldest = audioCache.keys().next().value;
        cacheBytes -= audioCache.get(oldest).size;
        audioCache.delete(oldest);
    }
    audioCache.set(text, blob);
    cacheBytes += blob.size;
}

function alive(job) { return activeSpeech === job && !job.controller.signal.aborted; }

function start(job) {
    if (!alive(job) || job.started) return;
    job.started = true;
    job.opts.onStart?.();
}

function playAudio(job, blob) {
    return new Promise((resolve, reject) => {
        const audio = job.audio;
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
        audio.onplaying = () => start(job);
        audio.onended = () => finish();
        audio.onerror = () => finish(new Error('Audio playback failed'));
        audio.src = job.url;
        audio.playbackRate = Math.max(0.7, Math.min(1.3, Number(job.opts.rate) || 1));
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
    for (const chunk of splitSpeechText(text)) {
        if (!alive(job)) return;
        if (cloud) {
            let blob = audioCache.get(chunk);
            try {
                if (!blob) {
                    if (Date.now() < cloudUnavailableUntil) throw new Error('Cloud speech cooling down');
                    const { callSpeechApi } = await import('../api.js');
                    if (!alive(job)) return;
                    blob = await callSpeechApi(chunk, { signal: job.controller.signal });
                    if (!alive(job)) return;
                    rememberAudio(chunk, blob);
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
