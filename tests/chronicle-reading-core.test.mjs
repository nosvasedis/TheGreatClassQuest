import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildChronicleReading, oracleBrief, readingFingerprint, readOracleNote, DAY_MS
} from '../features/chronicleReadingCore.mjs';
import { ORACLE_COUNSELS, getCounsel, questionTask } from '../features/heroOracleCounsels.mjs';

const NOW = Date.UTC(2026, 9, 8, 12);
const ago = (days) => new Date(NOW - days * DAY_MS);
const classmates = [{ id: 'm', name: 'Maria Kosta' }, { id: 'k', name: 'Nikos Pap' }];

function eleni() {
    return [
        { id: 'a', category: 'Academic', createdAt: ago(40), noteText: 'Very shy, doesn’t speak in English unless I ask her directly. Spelling in dictation was weak.' },
        { id: 'b', category: 'Social', createdAt: ago(30), noteText: 'I moved her seat next to Maria for pair work. I tried giving her sentence frames.' },
        { id: 'c', category: 'Academic', createdAt: ago(20), noteText: 'Answered in full sentences during the role play! More confident with Maria. She loves football.' },
        { id: 'd', category: 'General', createdAt: ago(5), noteText: 'Forgot her workbook again and the homework was not done. Argued with Nikos.' },
        { id: 'e', category: 'General', createdAt: ago(2), noteText: 'Δεν έκανε πάλι τις ασκήσεις. Μίλησα με τη μαμά της. Μιλάει ελληνικά στο μάθημα.' },
        { id: 'ember_x', category: 'Goals', source: 'ember_oath', createdAt: ago(1), noteText: 'Kept a promise: I will ask one question in English every lesson.' }
    ];
}

test('notes are numbered oldest first and keep the teacher’s words', () => {
    const r = buildChronicleReading({ notes: eleni().reverse(), firstName: 'Eleni', classmates, now: NOW });
    assert.deepEqual(r.notes.map((n) => n.id), ['a', 'b', 'c', 'd', 'e', 'ember_x']);
    assert.equal(r.notes[0].ref, 'N1');
    assert.equal(r.notes[5].source, 'oath');
    assert.equal(r.keptOaths.length, 1);
});

test('a theme that was a worry and then praised reads as getting better', () => {
    const r = buildChronicleReading({ notes: eleni(), firstName: 'Eleni', classmates, now: NOW });
    const shy = r.themes.find((t) => t.id === 'shy');
    assert.ok(shy, 'shy theme found');
    assert.equal(shy.trend, 'easing');
    assert.ok(r.brightSpots.some((t) => t.id === 'shy'));
});

test('homework worries are read in English and in Greek, and stay open', () => {
    const r = buildChronicleReading({ notes: eleni(), firstName: 'Eleni', classmates, now: NOW });
    const homework = r.themes.find((t) => t.id === 'homework');
    assert.equal(homework.count, 2);
    assert.equal(homework.trend, 'persistent');
    assert.ok(r.openThreads.some((t) => t.id === 'homework'));
    assert.ok(r.openThreads.some((t) => t.id === 'greek'), 'speaking Greek in the lesson is read');
});

test('a happy note does not turn a skill into a worry', () => {
    const note = readOracleNote({ noteText: 'Answered in full sentences during the role play! More confident with Maria.', category: 'Academic' });
    assert.ok(!note.themes.some((t) => t.tone === 'worry'));
    assert.equal(note.tone, 'good');
});

test('moves the teacher tried are judged by the notes that follow', () => {
    const r = buildChronicleReading({ notes: eleni(), firstName: 'Eleni', classmates, now: NOW });
    const seat = r.tried.find((t) => /moved her seat/.test(t.text));
    assert.ok(seat);
    assert.equal(seat.outcome, 'helping');
    assert.ok(seat.aimedAt.includes('shy'));
    const mum = r.tried.find((t) => /μαμά/.test(t.text));
    assert.equal(mum.outcome, 'no-word-yet');
});

test('classmates and passions come from the notes', () => {
    const r = buildChronicleReading({ notes: eleni(), firstName: 'Eleni', classmates, now: NOW });
    assert.equal(r.people.find((p) => p.id === 'm')?.warm > 0, true);
    assert.equal(r.people.find((p) => p.id === 'k')?.friction, 1);
    assert.ok(r.passions.some((p) => p.id === 'football'));
});

test('gaps name the parts of an English learner the notes never touch', () => {
    const r = buildChronicleReading({ notes: eleni(), firstName: 'Eleni', classmates, now: NOW });
    const ids = r.gaps.map((g) => g.id);
    assert.ok(ids.includes('listening'));
    assert.ok(ids.includes('reading'));
    assert.ok(!ids.includes('speaking'));
    assert.match(r.gaps[0].ask, /Eleni/);
});

test('notes are checked against papers and stars', () => {
    const numbers = {
        trials: { count: 6, avg: 78, classAvg: 72, testAvg: 80, classTestAvg: 74, dictAvg: 85, classDictAvg: 70, momentum: { dir: 'down', delta: -6 } },
        stars: { total: 12, recent30: 3, byVirtue: { teamwork: 4, creativity: 0, respect: 5, focus: 3 } },
        absences30: 0,
        missedPapers: 0
    };
    const r = buildChronicleReading({ notes: eleni(), firstName: 'Eleni', classmates, numbers, now: NOW });
    assert.ok(r.cross.some((c) => c.kind === 'disagree' && c.themeId === 'spelling'), 'dictations above the class disagree with a spelling worry');
    assert.ok(r.cross.some((c) => /Creativity/.test(c.text)));
});

test('an empty chronicle still gives a headline and every gap', () => {
    const r = buildChronicleReading({ notes: [], firstName: 'Nikos', now: NOW });
    assert.match(r.headline, /No notes for Nikos/);
    assert.equal(r.gaps.length, 6);
    assert.equal(r.openThreads.length, 0);
});

test('only-worries notes are flagged', () => {
    const notes = ['Forgot his book again.', 'Very chatty, talks all the time during the lesson.', 'Homework not done again.']
        .map((t, i) => ({ id: `w${i}`, noteText: t, category: 'Behavior', createdAt: ago(10 - i) }));
    const r = buildChronicleReading({ notes, firstName: 'Fotis', now: NOW });
    assert.equal(r.balance, 'only-worries');
});

test('the brief cites notes by number and keeps private background out of parent summaries', () => {
    const notes = [...eleni(), { id: 'f', category: 'General', createdAt: ago(1), noteText: 'Her parents are going through a divorce, she cried in class.' }];
    const r = buildChronicleReading({ notes, firstName: 'Eleni', classmates, now: NOW });
    const teacher = oracleBrief(r, { league: 'B', ageGroup: '10-11' });
    assert.match(teacher, /\[N1\] .*Very shy/);
    assert.match(teacher, /divorce/);
    assert.match(teacher, /ALREADY TRIED/);
    const parent = oracleBrief(r, { audience: 'parent' });
    assert.doesNotMatch(parent, /divorce|cried/);
    assert.doesNotMatch(parent, /ALREADY TRIED|CLASSMATES WRITTEN/);
});

test('the fingerprint changes when a note is edited, not when it is re-read', () => {
    const a = buildChronicleReading({ notes: eleni(), firstName: 'Eleni', now: NOW });
    const b = buildChronicleReading({ notes: eleni(), firstName: 'Eleni', now: NOW + DAY_MS });
    assert.equal(readingFingerprint(a), readingFingerprint(b));
    const edited = eleni();
    edited[0].noteText += ' She mixes up b and d.';
    assert.notEqual(readingFingerprint(a), readingFingerprint(buildChronicleReading({ notes: edited, firstName: 'Eleni', now: NOW })));
});

test('counsels keep the ids the buttons use and ask for citations', () => {
    assert.deepEqual(ORACLE_COUNSELS.map((c) => c.id).sort(), ['analysis', 'goal', 'parent', 'teacher']);
    assert.match(getCounsel('teacher').task('Eleni'), /\[Nx\]/);
    assert.equal(getCounsel('parent').audience, 'parent');
    assert.match(questionTask('Eleni', '  why   so quiet? '), /"why so quiet\?"/);
});
