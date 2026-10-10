// features/noteAiReadingCore.mjs
// The Oracle's deep reading of Chronicle notes (Elite): the rules that keep it cheap.
//
//   what is sent    only this teacher's notes that the words-reader could not read with
//                   confidence (nothing named, Greeklish or mixed language, long mixed notes),
//                   and never a note about home, health or a diagnosis
//   when            a reading round at most once a week, and only when something new or
//                   edited is waiting; a backlog is finished one round a day; after a failure
//                   it waits a day
//   how much        at most MAX_CALLS_PER_ROUND calls a round, NOTES_PER_CALL notes per call
//   saved forever   each reading is saved on its note with the hash of the text it read, so
//                   a note is read once for each version of its words (features/classGreenhouseNotes.mjs
//                   ignores a reading whose hash no longer matches)
//
// Pure: no DOM, no Firebase, no AI call. The runtime is ui/modals/noteAiReader.js.
// Tested in tests/note-ai-reading-core.test.mjs.

import { readNote, noteTheme, validAiReading, AI_READING_VERSION, NOTE_THEMES, CONFIDENT } from './classGreenhouseNotes.mjs';
import { GREEK_GLOSSARY } from './noteLexicon.mjs';
import { hashText, sentencesOf, tidyText } from './noteTextCore.mjs';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const ROUND_EVERY_DAYS = 7;
export const BACKLOG_EVERY_DAYS = 1;
export const RETRY_AFTER_FAIL_DAYS = 1;
export const MAX_CALLS_PER_ROUND = 3;
export const NOTES_PER_CALL = 12;
export const MAX_CHARS_PER_CALL = 6000;
export const MAX_NOTE_CHARS = 700;
export const LEASE_MS = 5 * 60 * 1000;

// Never sent to the AI, whatever else the note says.
const PRIVATE_THEMES = new Set(['home', 'support']);
const toMs = (v) => {
    if (v == null) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.toDate === 'function') return v.toDate().getTime();
    if (v instanceof Date) return v.getTime();
    if (Number.isFinite(v)) return v;
    if (Number.isFinite(v?.seconds)) return v.seconds * 1000;
    return 0;
};

const textOf = (note) => tidyText(note?.noteText ?? note?.text ?? '').trim();

/**
 * Should this note be read by the AI? `reading` is readNote() of it (optional; read here if missing).
 * Only the teacher's own notes, never office notes or Ember Oaths, never private background.
 */
export function needsAiReading(note, { uid, reading = null, classmates = [], self = null } = {}) {
    if (!note || !uid || note.teacherId !== uid) return false;
    if (note.source === 'ember_oath' || note.authorRole === 'office') return false;
    const text = textOf(note);
    if (text.length < 12) return false;
    if (validAiReading(note, text)) return false;
    // A saved reading for these exact words (even an empty one) means it was read already.
    if (note.aiReading && note.aiReading.v === AI_READING_VERSION && note.aiReading.h === hashText(text)) return false;
    const r = reading || readNote({ ...note, text, aiReading: null }, classmates, { self });
    if (r.themes.some((t) => PRIVATE_THEMES.has(t.id))) return false;
    if (r.corrected) return false; // the teacher already said what it is about
    const unsure = !r.themes.some((t) => t.confidence >= CONFIDENT);
    const foreign = r.lang === 'greeklish' || r.lang === 'mixed';
    const longMixed = text.length > 220 && r.tone === 'mixed';
    return unsure || foreign || longMixed;
}

/**
 * The notes waiting for a deep reading, oldest change first.
 * notes: the Chronicle notes in state; students: [{ id, name, classId }].
 */
export function pendingNotes(notes = [], students = [], { uid } = {}) {
    const byId = new Map(students.map((s) => [s.id, s]));
    return notes
        .filter((n) => byId.has(n.studentId))
        .filter((n) => {
            const self = byId.get(n.studentId);
            const classmates = students.filter((s) => s.classId === self.classId && s.id !== self.id);
            return needsAiReading(n, { uid, classmates, self });
        })
        .sort((a, b) => (toMs(a.updatedAt) || toMs(a.createdAt)) - (toMs(b.updatedAt) || toMs(b.createdAt)));
}

/**
 * Is a round due? round = { lastRunAt, lastAttemptAt, backlog, leaseUntil } (ms, from the round doc).
 * Returns { due, next } where next is when the next round may run (ms) or null.
 */
export function roundDue(round = {}, pending = 0, now = Date.now()) {
    if (!pending) return { due: false, next: null, reason: 'nothing-waiting' };
    const lastRun = Number(round.lastRunAt) || 0;
    const lastTry = Number(round.lastAttemptAt) || 0;
    if (Number(round.leaseUntil) > now) return { due: false, next: Number(round.leaseUntil), reason: 'running-elsewhere' };
    if (lastTry > lastRun && now - lastTry < RETRY_AFTER_FAIL_DAYS * DAY_MS) {
        return { due: false, next: lastTry + RETRY_AFTER_FAIL_DAYS * DAY_MS, reason: 'after-failure' };
    }
    if (!lastRun) return { due: true, next: now, reason: 'first-round' };
    const gap = (round.backlog > 0 ? BACKLOG_EVERY_DAYS : ROUND_EVERY_DAYS) * DAY_MS;
    const next = lastRun + gap;
    return now >= next ? { due: true, next: now, reason: round.backlog > 0 ? 'backlog' : 'weekly' } : { due: false, next, reason: 'waiting' };
}

/** Splits the waiting notes into calls: few notes per call, a character budget, a cap per round. */
export function packBatches(pending = []) {
    const batches = [];
    let current = [];
    let chars = 0;
    for (const note of pending) {
        const size = Math.min(MAX_NOTE_CHARS, textOf(note).length) + 40;
        if (current.length && (current.length >= NOTES_PER_CALL || chars + size > MAX_CHARS_PER_CALL)) {
            batches.push(current);
            if (batches.length >= MAX_CALLS_PER_ROUND) return batches;
            current = [];
            chars = 0;
        }
        current.push(note);
        chars += size;
    }
    if (current.length && batches.length < MAX_CALLS_PER_ROUND) batches.push(current);
    return batches;
}

function clip(text, max) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** The theme catalogue the AI chooses from, one compact line each. */
export function themeCatalogue() {
    return NOTE_THEMES.map((t) => `${t.id}: ${t.label}${t.labelEl ? ` / ${t.labelEl}` : ''} [${t.kind}]`).join('\n');
}

/** The prompt for one call: { system, user }. Notes are numbered; sentences are indexed. */
export function buildAiReadingPrompt(batch, { firstNames = {} } = {}) {
    const system = [
        'You read short private notes an English teacher in Greece wrote about young students (ages 5-17).',
        'Notes may be in Greek, English or Greeklish (Greek written in Latin letters, e.g. "poly zwhros"), often without accents, sometimes in capitals.',
        'For each note, list the themes it is clearly about, using ONLY ids from the catalogue. Do not guess: if a note names nothing from the catalogue, return an empty list for it.',
        'Tone codes: w = a worry, b = getting better, s = a strength, c = background (only for [context] themes). [strength] themes take only s. [context] themes take only c.',
        'Intensity 1-3: 1 plain, 2 "very"/strong words, 3 capitals, "!!" or very strong words. Sentence = the 0-based index of the sentence that says it.',
        `Greek classroom words: ${GREEK_GLOSSARY.map(([el, en]) => `${el} = ${en}`).join('; ')}.`,
        'Reply with JSON only: {"r":[{"n":1,"t":[["theme_id","w",2,0]]}]} with one entry per note number.',
        '',
        'CATALOGUE (id: label [kind]):',
        themeCatalogue()
    ].join('\n');
    const user = batch.map((note, i) => {
        const sentences = sentencesOf(clip(textOf(note), MAX_NOTE_CHARS));
        const who = firstNames[note.studentId] ? ` about ${firstNames[note.studentId]}` : '';
        return `N${i + 1} (${note.category || 'General'}${who}): ${sentences.map((s, k) => `[${k}] ${s}`).join(' ')}`;
    }).join('\n');
    return { system, user: `Read these notes:\n${user}` };
}

function looseJson(text) {
    const raw = String(text || '').replace(/```(?:json)?/gi, '').trim();
    try { return JSON.parse(raw); } catch { /* try the outer object */ }
    const a = raw.indexOf('{');
    const b = raw.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(raw.slice(a, b + 1)); } catch { return null; }
}

const CODES = new Set(['w', 'b', 's', 'c']);

/**
 * Turns the AI reply into readings to save: { [noteId]: { v, h, t: ["id|code|intensity|sentence"] } }
 * (strings, because Firestore does not store arrays inside arrays).
 * Unknown ids, wrong tones for a theme's kind and bad indexes are dropped; a note the reply
 * leaves out is saved as read with nothing found. Returns null when the reply is not usable.
 */
export function parseAiReading(text, batch) {
    const data = looseJson(text);
    const rows = Array.isArray(data?.r) ? data.r : Array.isArray(data) ? data : null;
    if (!rows) return null;
    const out = {};
    batch.forEach((note) => { out[note.id] = { v: AI_READING_VERSION, h: hashText(textOf(note)), t: [] }; });
    rows.forEach((row) => {
        const n = Number(row?.n);
        if (!Number.isInteger(n) || n < 1 || n > batch.length) return;
        const note = batch[n - 1];
        const sentences = sentencesOf(clip(textOf(note), MAX_NOTE_CHARS)).length || 1;
        const seen = new Set();
        (Array.isArray(row.t) ? row.t : []).forEach((item) => {
            if (!Array.isArray(item) || out[note.id].t.length >= 6) return;
            const [id, code, intensity, sentence] = item;
            const theme = noteTheme(id);
            if (!theme || !CODES.has(code) || seen.has(id)) return;
            if (theme.kind === 'context' && code !== 'c') return;
            if (theme.kind !== 'context' && code === 'c') return;
            if (theme.kind === 'strength' && code !== 's') return;
            seen.add(id);
            const i = Math.max(1, Math.min(3, Math.round(Number(intensity) || 1)));
            const s = Number.isInteger(sentence) && sentence >= 0 && sentence < sentences ? sentence : 0;
            out[note.id].t.push(`${id}|${code}|${i}|${s}`);
        });
    });
    return out;
}

/** "Mon 14 Oct" for the next round, or '' when nothing waits. */
export function nextRoundLabel(next, now = Date.now()) {
    if (!next) return '';
    if (next <= now) return 'today';
    return new Date(next).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
