// The quiz's cast of narrators. Each Listen and choose question has its own voice,
// picked from the question id so a replay, the review card and every device agree.
// Speakers are Deepgram Aura-1 voices served by the AI worker; if that voice is
// unavailable the worker answers with MeloTTS, and the device voice is the last resort.

export const QUIZ_VOICES = [
    { id: 'luna', name: 'Luna', accent: 'American' },
    { id: 'orion', name: 'Orion', accent: 'American' },
    { id: 'athena', name: 'Athena', accent: 'British' },
    { id: 'helios', name: 'Helios', accent: 'British' },
    { id: 'stella', name: 'Stella', accent: 'American' },
    { id: 'arcas', name: 'Arcas', accent: 'American' },
    { id: 'asteria', name: 'Asteria', accent: 'American' },
    { id: 'perseus', name: 'Perseus', accent: 'American' },
    { id: 'hera', name: 'Hera', accent: 'American' },
    { id: 'orpheus', name: 'Orpheus', accent: 'American' },
    { id: 'zeus', name: 'Zeus', accent: 'American' },
    { id: 'angus', name: 'Angus', accent: 'Irish' }
];

// The youngest classes hear the clearest, calmest voices only.
const EARLY_VOICES = ['luna', 'orion', 'athena', 'helios', 'stella', 'arcas'];
const JUNIOR_VOICES = ['luna', 'orion', 'athena', 'helios', 'stella', 'arcas', 'asteria', 'perseus', 'hera'];

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
 * Speaking pace for the projector. Aura voices already speak at a natural pace;
 * younger classes get a little more time. tts.js slows MeloTTS further on its own.
 */
export function quizSpeechRate(band = '') {
    return band === 'early' ? 0.86 : band === 'junior' ? 0.93 : 1;
}
