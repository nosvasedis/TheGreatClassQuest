// features/anthemVideo/anthemVideoCore.mjs — pure clockwork for the guild anthem music videos.
// Everything is a function of the song's playback time, so pausing, seeking and restarting stay in sync.

/** How long the final line is held when there is no next line to measure from (matches the alcove). */
export const LAST_LINE_SECONDS = 4.4;
/** Light a word a hair early so eyes reach it as the voice does. */
export const KARAOKE_LEAD_SECONDS = 0.08;
/** Countdown shown in the intro, in seconds before the first line. */
export const COUNTDOWN_SECONDS = 3;

/** Split a lyric line into display words (punctuation stays attached to its word). */
export function splitWords(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean);
}

/** A singer's syllable count for one word: good enough to share a line's time fairly. */
export function countSyllables(word) {
    const w = String(word || '').toLowerCase().replace(/[^a-z']/g, '').replace(/'/g, '');
    if (!w) return 1;
    if (w.length <= 3) return 1;
    const groups = w
        .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
        .replace(/^y/, '')
        .match(/[aeiouy]{1,2}/g);
    return Math.max(1, groups ? groups.length : 1);
}

/**
 * Spread a line's words across [start, end): each word gets time in proportion to its syllables,
 * and the words fill `sungShare` of the window (singers breathe before the next line).
 */
export function estimateWordStarts(text, start, end, sungShare = 0.86) {
    const words = splitWords(text);
    if (!words.length) return [];
    const weights = words.map(countSyllables);
    const total = weights.reduce((a, b) => a + b, 0);
    const span = Math.max(0.2, (end - start) * sungShare);
    const starts = [];
    let acc = 0;
    for (const w of weights) {
        starts.push(round2(start + (acc / total) * span));
        acc += w;
    }
    return starts;
}

function round2(n) { return Math.round(n * 100) / 100; }

/**
 * Build the sung timeline from a guild's `anthemLyrics` and optional tuned word times.
 * @param {Array<{type:string, lines:Array<{text:string, time:number}>}>} lyrics
 * @param {{ words?: number[][], lastLineSeconds?: number }} [timing]
 */
export function buildWordTimeline(lyrics, timing = {}) {
    const flat = [];
    (lyrics || []).forEach((section, sectionIdx) => {
        (section.lines || []).forEach(line => flat.push({ section: section.type === 'chorus' ? 'chorus' : 'verse', sectionIdx, text: line.text, start: Number(line.time) || 0 }));
    });
    const lastHold = timing.lastLineSeconds ?? LAST_LINE_SECONDS;
    const lines = flat.map((line, idx) => {
        const end = idx + 1 < flat.length ? flat[idx + 1].start : line.start + lastHold;
        const texts = splitWords(line.text);
        const tuned = timing.words?.[idx];
        const starts = Array.isArray(tuned) && tuned.length === texts.length ? tuned : estimateWordStarts(line.text, line.start, end);
        const words = texts.map((text, i) => {
            const wStart = starts[i];
            const nextStart = i + 1 < starts.length ? starts[i + 1] : null;
            const wEnd = nextStart ?? Math.min(end, wStart + Math.max(0.45, (end - wStart) * 0.7));
            return { text, start: wStart, end: Math.max(wStart + 0.05, wEnd) };
        });
        const start = Math.min(line.start, words[0]?.start ?? line.start);
        return { idx, section: line.section, sectionIdx: line.sectionIdx, text: line.text, start, end, words };
    });
    return {
        lines,
        start: lines[0]?.start ?? 0,
        end: lines.length ? lines[lines.length - 1].end : 0,
    };
}

/**
 * Where the song is at time `t`: the phase, the sung line and word, and how far through the word we are.
 * @returns {{ phase:'intro'|'sing'|'outro', lineIdx:number, wordIdx:number, wordProgress:number, lineProgress:number, section:string|null, countdown:number }}
 */
export function frameAt(timeline, t, lead = KARAOKE_LEAD_SECONDS) {
    const at = (Number(t) || 0) + lead;
    const lines = timeline?.lines || [];
    const frame = { phase: 'intro', lineIdx: -1, wordIdx: -1, wordProgress: 0, lineProgress: 0, section: null, countdown: 0 };
    if (!lines.length) return frame;
    if (at < timeline.start) {
        const left = timeline.start - at;
        frame.countdown = left <= COUNTDOWN_SECONDS ? Math.ceil(left) : 0;
        return frame;
    }
    if (at >= timeline.end) {
        frame.phase = 'outro';
        frame.lineIdx = lines.length - 1;
        frame.wordIdx = lines[lines.length - 1].words.length - 1;
        frame.wordProgress = 1;
        frame.lineProgress = 1;
        frame.section = lines[lines.length - 1].section;
        return frame;
    }
    let li = 0;
    for (let i = 0; i < lines.length; i++) if (at >= lines[i].start) li = i;
    const line = lines[li];
    let wi = -1;
    for (let i = 0; i < line.words.length; i++) if (at >= line.words[i].start) wi = i;
    frame.phase = 'sing';
    frame.lineIdx = li;
    frame.wordIdx = wi;
    frame.section = line.section;
    frame.lineProgress = clamp01((at - line.start) / (line.end - line.start));
    if (wi >= 0) {
        const w = line.words[wi];
        frame.wordProgress = clamp01((at - w.start) / (w.end - w.start));
    }
    return frame;
}

function clamp01(n) { return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0)); }

/**
 * Scene cues may be absolute (`{ at }`) or pinned to a sung word (`{ line, word, offset }`), so they
 * follow the tuned timings. Returns cues sorted by time with a resolved `at`.
 */
export function resolveCues(cues, timeline) {
    return (cues || []).map(cue => {
        let at = Number(cue.at);
        if (!Number.isFinite(at) && Number.isInteger(cue.line)) {
            const line = timeline?.lines?.[cue.line];
            if (line) {
                const word = Number.isInteger(cue.word) ? line.words[Math.max(0, Math.min(line.words.length - 1, cue.word))] : null;
                at = (word ? word.start : line.start) + (Number(cue.offset) || 0);
            }
        }
        return { name: cue.name, at: Number.isFinite(at) ? at : Infinity };
    }).filter(c => c.name && Number.isFinite(c.at)).sort((a, b) => a.at - b.at);
}

/** Names of every cue reached by time `t` (scenes keep cumulative state, so seeking back undoes them). */
export function cuesReached(resolvedCues, t) {
    const out = [];
    for (const cue of resolvedCues || []) {
        if (cue.at <= t) out.push(cue.name);
        else break;
    }
    return out;
}

/** The latest cue reached by time `t`, or null. */
export function cueAt(resolvedCues, t) {
    const reached = cuesReached(resolvedCues, t);
    return reached.length ? reached[reached.length - 1] : null;
}

/** Beat count and phase (0..1 through the beat) for a steady tempo. Before the first beat, beat is -1. */
export function beatPhase(bpm, offset, t) {
    const len = 60 / (Number(bpm) || 120);
    const rel = (Number(t) || 0) - (Number(offset) || 0);
    if (rel < 0) return { beat: -1, phase: 0, bar: -1 };
    const beat = Math.floor(rel / len);
    return { beat, phase: (rel - beat * len) / len, bar: Math.floor(beat / 4) };
}

/** Check tuned word times against the lyrics; returns a list of problems (empty when all good). */
export function validateWordTimings(lyrics, timing) {
    const problems = [];
    const tl = buildWordTimeline(lyrics, {});
    const words = timing?.words || [];
    if (words.length !== tl.lines.length) problems.push(`expected ${tl.lines.length} lines, got ${words.length}`);
    tl.lines.forEach((line, i) => {
        const tuned = words[i];
        if (!Array.isArray(tuned)) return;
        if (tuned.length !== line.words.length) problems.push(`line ${i}: expected ${line.words.length} words, got ${tuned.length}`);
        for (let w = 0; w < tuned.length; w++) {
            if (!Number.isFinite(tuned[w])) problems.push(`line ${i} word ${w}: not a number`);
            if (w > 0 && tuned[w] <= tuned[w - 1]) problems.push(`line ${i} word ${w}: not after the word before`);
            if (tuned[w] < line.start - 0.35 || tuned[w] >= line.end) problems.push(`line ${i} word ${w}: ${tuned[w]} outside ${line.start}–${line.end}`);
        }
    });
    return problems;
}
