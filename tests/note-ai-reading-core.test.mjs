import test from 'node:test';
import assert from 'node:assert/strict';
import {
    needsAiReading, pendingNotes, roundDue, packBatches, buildAiReadingPrompt, parseAiReading,
    DAY_MS, NOTES_PER_CALL, MAX_CALLS_PER_ROUND, MAX_CHARS_PER_CALL
} from '../features/noteAiReadingCore.mjs';
import { readNote, AI_READING_VERSION } from '../features/classGreenhouseNotes.mjs';
import { hashText } from '../features/noteTextCore.mjs';

const UID = 'teacher-1';
const note = (id, text, extra = {}) => ({ id, studentId: 's1', teacherId: UID, noteText: text, category: 'General', ...extra });
const NOW = Date.UTC(2026, 9, 10, 9);

test('only unclear notes of this teacher are sent, never private ones', () => {
    assert.equal(needsAiReading(note('a', 'Κάτι δεν πάει καλά με τον Γιώργο τελευταία.'), { uid: UID }), true, 'nothing named: unsure');
    assert.equal(needsAiReading(note('b', 'poly zwhros kai den kanei tis askhseis'), { uid: UID }), true, 'Greeklish is checked once by the AI');
    assert.equal(needsAiReading(note('c', 'Struggles with spelling, many mistakes.'), { uid: UID }), false, 'read with confidence: no call');
    assert.equal(needsAiReading(note('d', 'Κάτι δεν πάει καλά.', { teacherId: 'someone-else' }), { uid: UID }), false, 'not this teacher');
    assert.equal(needsAiReading(note('e', 'Κάτι δεν πάει καλά στο σπίτι.', { authorRole: 'office' }), { uid: UID }), false, 'office notes are not sent');
    assert.equal(needsAiReading(note('f', 'Οι γονείς του χώρισαν, κάτι δεν πάει καλά.'), { uid: UID }), false, 'home matters never leave the laptop');
    assert.equal(needsAiReading(note('g', 'Has a dyslexia diagnosis, I am not sure what helps.'), { uid: UID }), false, 'diagnoses never leave the laptop');
    assert.equal(needsAiReading(note('h', 'ok'), { uid: UID }), false, 'too short');
});

test('a saved reading is never redone until the words change', () => {
    const text = 'Κάτι δεν πάει καλά με τον Γιώργο τελευταία.';
    const saved = { v: AI_READING_VERSION, h: hashText(text), t: [] };
    assert.equal(needsAiReading(note('a', text, { aiReading: saved }), { uid: UID }), false, 'read once, even when nothing was found');
    assert.equal(needsAiReading(note('a', `${text} Και σήμερα.`, { aiReading: saved }), { uid: UID }), true, 'edited: read again');
    assert.equal(needsAiReading(note('a', text, { readingFix: { add: [{ id: 'worry', tone: 'worry' }] } }), { uid: UID }), false, 'the teacher already said what it is about');
});

test('pending notes come oldest change first, only for known students', () => {
    const students = [{ id: 's1', name: 'Anna', classId: 'c1' }];
    const list = pendingNotes([
        note('new', 'Κάτι δεν πάει καλά.', { createdAt: NOW }),
        note('old', 'Κάτι άλλο δεν πάει καλά.', { createdAt: NOW - 5 * DAY_MS }),
        note('ghost', 'Κάτι δεν πάει καλά.', { studentId: 'gone' })
    ], students, { uid: UID });
    assert.deepEqual(list.map((n) => n.id), ['old', 'new']);
});

test('a round runs at most weekly, only when something waits, with a daily backlog and a pause after failure', () => {
    assert.equal(roundDue({}, 0, NOW).due, false, 'nothing waiting: never');
    assert.equal(roundDue({}, 3, NOW).due, true, 'first round');
    assert.equal(roundDue({ lastRunAt: NOW - 3 * DAY_MS }, 3, NOW).due, false, 'less than a week');
    assert.equal(roundDue({ lastRunAt: NOW - 3 * DAY_MS }, 3, NOW).next, NOW + 4 * DAY_MS);
    assert.equal(roundDue({ lastRunAt: NOW - 7 * DAY_MS }, 3, NOW).due, true, 'a week later');
    assert.equal(roundDue({ lastRunAt: NOW - DAY_MS - 1, backlog: 10 }, 10, NOW).due, true, 'a backlog continues the next day');
    assert.equal(roundDue({ lastRunAt: NOW - 8 * DAY_MS, lastAttemptAt: NOW - 3600e3 }, 3, NOW).due, false, 'after a failure: wait a day');
    assert.equal(roundDue({ leaseUntil: NOW + 60e3 }, 3, NOW).due, false, 'another laptop is running it');
});

test('calls are packed within the note, character and call limits', () => {
    const many = Array.from({ length: 50 }, (_, i) => note(`n${i}`, `Κάτι δεν πάει καλά ${i}. `.repeat(3)));
    const batches = packBatches(many);
    assert.ok(batches.length <= MAX_CALLS_PER_ROUND);
    batches.forEach((b) => assert.ok(b.length <= NOTES_PER_CALL));
    const long = Array.from({ length: 12 }, (_, i) => note(`l${i}`, 'x'.repeat(900)));
    packBatches(long).forEach((b) => assert.ok(b.reduce((t) => t + 740, 0) <= MAX_CHARS_PER_CALL + 740));
    assert.deepEqual(packBatches([]), []);
});

test('the prompt is compact, names the catalogue and numbers the sentences', () => {
    const batch = [note('a', 'poly zwhros. Den kanei askhseis.')];
    const { system, user } = buildAiReadingPrompt(batch, { firstNames: { s1: 'Thiseas' } });
    assert.match(system, /energetic: Lively/);
    assert.match(system, /ζωηρός/);
    assert.match(user, /N1 \(General about Thiseas\): \[0\] poly zwhros\. \[1\] Den kanei askhseis\./);
    assert.ok(system.length < 8000 && user.length < 8000, 'within the AI proxy message limit');
});

test('the AI reply is checked before it is saved, and the reader uses it', () => {
    const batch = [note('a', 'poly zwhros simera. Den kanei askhseis.'), note('b', 'Κάτι δεν πάει καλά.')];
    const reply = '```json\n{"r":[{"n":1,"t":[["energetic","w",3,0],["homework","w",1,1],["made_up","w",1,0],["helper","w",1,0],["home","w",1,0],["energetic","b",1,0]]},{"n":9,"t":[["worry","w",1,0]]}]}\n```';
    const out = parseAiReading(reply, batch);
    assert.deepEqual(out.a.t, ['energetic|w|3|0', 'homework|w|1|1'], 'unknown ids, wrong tones for the kind and repeats are dropped');
    assert.deepEqual(out.b.t, [], 'a note the reply leaves out is saved as read, nothing found');
    assert.equal(out.a.h, hashText('poly zwhros simera. Den kanei askhseis.'));
    assert.equal(parseAiReading('sorry, I cannot', batch), null, 'an unusable reply saves nothing');

    const r = readNote({ text: batch[1].noteText, aiReading: out.b });
    assert.equal(r.aiRead, true);
});

test('saved readings are plain strings (Firestore stores no arrays inside arrays)', () => {
    const batch = [note('a', 'poly zwhros simera.')];
    const out = parseAiReading('{"r":[{"n":1,"t":[["energetic","w",2,0]]}]}', batch);
    out.a.t.forEach((row) => assert.equal(typeof row, 'string'));
    const r = readNote({ text: batch[0].noteText, aiReading: out.a });
    assert.ok(r.themes.some((t) => t.id === 'energetic'));
});
