// The quiz's cast of narrators. Each Listen and choose question has its own voice,
// picked from the question id so a replay, the review card and every device agree.
// Speakers are Deepgram Aura-2 voices served by the AI worker, chosen for clear, steady
// speech a language learner can follow. If that voice is unavailable the worker answers
// with the nearest Aura-1 voice or MeloTTS, and the device voice is the last resort.

export const QUIZ_VOICES = [
    { id: 'thalia', name: 'Thalia', accent: 'American' },
    { id: 'arcas', name: 'Arcas', accent: 'American' },
    { id: 'harmonia', name: 'Harmonia', accent: 'American' },
    { id: 'mars', name: 'Mars', accent: 'American' },
    { id: 'draco', name: 'Draco', accent: 'British' },
    { id: 'asteria', name: 'Asteria', accent: 'American' },
    { id: 'orpheus', name: 'Orpheus', accent: 'American' },
    { id: 'callista', name: 'Callista', accent: 'American' }
];

// The youngest classes hear the clearest, calmest voices only.
const EARLY_VOICES = ['thalia', 'arcas', 'harmonia', 'mars'];
const JUNIOR_VOICES = ['thalia', 'arcas', 'harmonia', 'mars', 'draco', 'asteria'];

export function quizVoicePool(band = '') {
    if (band === 'early') return QUIZ_VOICES.filter((v) => EARLY_VOICES.includes(v.id));
    if (band === 'junior') return QUIZ_VOICES.filter((v) => JUNIOR_VOICES.includes(v.id));
    return QUIZ_VOICES.slice();
}

function hash(text) {
    let h = 2166136261;
    for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
    return h >>> 0;
}

/** The narrator of one question: stable for the same question, varied across a quiz. */
export function quizVoiceFor(key, band = '') {
    const pool = quizVoicePool(band);
    return pool[hash(key || 'quiz') % pool.length];
}

/**
 * Speaking pace for the projector: a little slower than conversation for every class, and
 * slower still for the younger leagues (pitch is kept). tts.js slows MeloTTS further on its own.
 */
export function quizSpeechRate(band = '') {
    return band === 'early' ? 0.82 : band === 'junior' ? 0.86 : 0.9;
}
