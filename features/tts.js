// /features/tts.js
let activeUtterance = null;

function getVoices() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return [];
    return window.speechSynthesis.getVoices() || [];
}

function pickVoice(voiceHint = '') {
    const voices = getVoices();
    if (!voices.length) return null;
    const hint = String(voiceHint || '').toLowerCase().trim();
    if (!hint) return voices[0];
    return voices.find(v => v.name.toLowerCase().includes(hint) || v.lang.toLowerCase().includes(hint)) || voices[0];
}

export function isTtsSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function isSpeaking() {
    return !!(isTtsSupported() && window.speechSynthesis.speaking);
}

export function stopSpeech() {
    if (!isTtsSupported()) return;
    window.speechSynthesis.cancel();
    activeUtterance = null;
}

export function speakText(text, opts = {}) {
    const {
        rate = 1,
        pitch = 1,
        voiceHint = '',
        onStart = null,
        onEnd = null,
        onError = null
    } = opts;

    if (!isTtsSupported()) {
        if (typeof onError === 'function') onError(new Error('TTS_NOT_SUPPORTED'));
        return false;
    }

    const cleanText = String(text || '').trim();
    if (!cleanText) {
        if (typeof onError === 'function') onError(new Error('EMPTY_TTS_TEXT'));
        return false;
    }

    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.voice = pickVoice(voiceHint);
    utterance.onstart = () => { if (typeof onStart === 'function') onStart(); };
    utterance.onend = () => {
        activeUtterance = null;
        if (typeof onEnd === 'function') onEnd();
    };
    utterance.onerror = (ev) => {
        activeUtterance = null;
        if (typeof onError === 'function') onError(ev?.error || ev || new Error('TTS_ERROR'));
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
}

