import test from 'node:test';
import assert from 'node:assert/strict';
import {
    phoneticGreek, greeklishWord, detectLanguage, splitClauses, emphasisOf, hashText, nameMatchers, readyClause
} from '../features/noteTextCore.mjs';
import { readNote, readClassNotes, AI_READING_VERSION } from '../features/classGreenhouseNotes.mjs';
import { foldText } from '../features/oathForge.mjs';

const read = (text, classmates = [], category = 'Behavior') => readNote({ text, category }, classmates);
const theme = (r, id) => r.themes.find((t) => t.id === id);
const ids = (r) => r.themes.map((t) => `${t.id}:${t.tone}`);

test('Greek is compared by sound, so typos and accents do not matter', () => {
    const key = (s) => phoneticGreek(foldText(s));
    assert.equal(key('ζωηρός'), key('ζοηρος'));
    assert.equal(key('ζωηρός'), key('ζωιρος'));
    assert.equal(key('ΖΩΗΡΟΣ'), key('ζωηρος'));
    assert.equal(key('ασκήσεις'), key('ασκισις'));
    assert.notEqual(key('ζωηρός'), key('ζωγράφος'));
});

test('Greeklish is turned into Greek letters', () => {
    assert.equal(phoneticGreek(greeklishWord('zwhros')), phoneticGreek(foldText('ζωηρός')));
    assert.equal(phoneticGreek(greeklishWord('zoiros')), phoneticGreek(foldText('ζωηρός')));
    assert.equal(phoneticGreek(greeklishWord('askhseis')), phoneticGreek(foldText('ασκήσεις')));
    assert.equal(greeklishWord('8ema'), 'θεμα');
});

test('the language of a sentence is recognised', () => {
    assert.equal(detectLanguage(foldText('Δεν έφερε το βιβλίο')), 'el');
    assert.equal(detectLanguage(foldText('He forgot his book again')), 'en');
    assert.equal(detectLanguage(foldText('poly zwhros kai den kanei tis askhseis')), 'greeklish');
    assert.equal(detectLanguage(foldText('Thiseas is ΠΟΛΥ ΖΩΗΡΟΣ')), 'mixed');
    assert.equal(detectLanguage(foldText('He argues with me')), 'en', 'English is never read as Greeklish');
});

test('a sentence is cut at "but", "αλλά", "όμως"', () => {
    assert.deepEqual(splitClauses('Πολύ ζωηρός αλλά ευγενικός'), ['Πολύ ζωηρός', 'ευγενικός']);
    assert.deepEqual(splitClauses('Very lively but kind to others'), ['Very lively', 'kind to others']);
    assert.equal(splitClauses('He has not learned them yet').length, 1);
});

test('capitals and "!!" are emphasis; acronyms are not', () => {
    assert.equal(emphasisOf('Thiseas is ΠΟΛΥ ΖΩΗΡΟΣ').shout, true);
    assert.equal(emphasisOf('Has an ADHD diagnosis').shout, false);
    assert.equal(emphasisOf('Talks all the time!!').bang, true);
});

test('a Latin name is found in Greek letters', () => {
    const m = nameMatchers('Thiseas Pap');
    const { views } = readyClause('Μίλησα με τον Θησέα σήμερα');
    m.el.lastIndex = 0;
    assert.ok(m.el.test(views.el));
});

test('the cases the teacher wrote: ΠΟΛΥ ΖΩΗΡΟΣ, Greeklish, negation, contrast', () => {
    let r = read('Thiseas is ΠΟΛΥ ΖΩΗΡΟΣ');
    assert.equal(theme(r, 'energetic').tone, 'worry');
    assert.equal(theme(r, 'energetic').intensity, 3, 'πολύ and capitals: said very strongly');

    r = read('poly zwhros kai den kanei tis askhseis');
    assert.equal(theme(r, 'energetic').tone, 'worry');
    assert.equal(theme(r, 'homework').tone, 'worry');
    assert.equal(r.lang, 'greeklish');

    assert.deepEqual(ids(read('Δεν είναι αγενής, απλά κουρασμένος')), ['tired:worry'], 'not rude, just tired');
    assert.equal(theme(read('Δεν είναι πια ζωηρός.'), 'energetic').tone, 'better');
    assert.equal(theme(read('Not chatty any more.'), 'chatty').tone, 'better');

    assert.deepEqual(ids(read('ζωηρή συμμετοχή στο μάθημα')), ['eager:strength']);
    assert.deepEqual(ids(read('A lively discussion today.')), ['eager:strength']);

    r = read('Very lively but kind to others');
    assert.equal(theme(r, 'energetic').tone, 'worry');
    assert.equal(theme(r, 'energetic').intensity, 2);
    assert.equal(theme(r, 'helper').tone, 'strength');
    assert.equal(r.tone, 'mixed');

    assert.deepEqual(ids(read('Πολύ ζωηρός αλλά ευγενικός')), ['energetic:worry', 'polite:strength']);
});

test('a one-off is told from a pattern, and classmates are found in Greek', () => {
    const kids = [{ id: 'k', name: 'Nikos Pap' }];
    let r = read('Σήμερα μάλωσε με τον Νίκο', kids);
    assert.equal(theme(r, 'conflict').pattern, 'incident');
    assert.deepEqual(r.mentions, ['k']);
    r = read('Μιλάει συνέχεια, κάθε μάθημα.');
    assert.equal(theme(r, 'chatty').pattern, 'trait');
});

test('spelling mistakes in Greek still read', () => {
    assert.equal(theme(read('Είναι πολύ ζοηρος'), 'energetic').tone, 'worry');
    assert.equal(theme(read('ειναι ζωιρος'), 'energetic').tone, 'worry');
});

test('a classmate\'s name is never read as a word', () => {
    // "Αρίστη" sounds like "άριστη" (excellent): with the class list, it is a name.
    const kids = [{ id: 'a', name: 'Aristi Kosta' }];
    const r = read('Βοηθάει την Αρίστη.', kids);
    assert.deepEqual(ids(r), ['helper:strength']);
    assert.deepEqual(r.mentions, ['a']);
    assert.ok(theme(read('Βοηθάει την Αρίστη.'), 'ahead'), 'without the class list the name looks like praise');
});

test('hedged readings are less sure', () => {
    const sure = theme(read('He is distracted.'), 'focus').confidence;
    const unsure = theme(read('Maybe he is a bit distracted.'), 'focus').confidence;
    assert.ok(unsure < sure);
});

test('the AI reading fills gaps while the note is unchanged, and the teacher\'s fix wins', () => {
    const text = 'Κάτι δεν πάει καλά με τον Γιώργο τελευταία.';
    const plain = readNote({ text });
    assert.equal(plain.clear, false, 'the words alone are unsure here');

    const aiReading = { v: AI_READING_VERSION, h: hashText(text), t: [['worry', 'w', 2, 0]] };
    const withAi = readNote({ text, aiReading });
    assert.equal(theme(withAi, 'worry').source, 'ai');
    assert.equal(theme(withAi, 'worry').intensity, 2);
    assert.equal(withAi.aiRead, true);

    const stale = readNote({ text: `${text} Edited.`, aiReading });
    assert.equal(theme(stale, 'worry'), undefined, 'an edited note is not read with an old AI reading');

    const unknown = readNote({ text, aiReading: { ...aiReading, t: [['not-a-theme', 'w', 1, 0], ['worry', 'x', 1, 0]] } });
    assert.equal(unknown.themes.length, 0, 'unknown ids and tones are ignored');

    const fixed = readNote({ text: 'Δεν είναι αγενής, απλά κουρασμένος', readingFix: { remove: ['tired'], add: [{ id: 'energetic', tone: 'worry' }] } });
    assert.deepEqual(ids(fixed), ['energetic:worry']);
    assert.equal(theme(fixed, 'energetic').source, 'teacher');
    assert.equal(fixed.corrected, true);

    const overruled = readNote({ text: 'Very chatty today.', aiReading: { v: AI_READING_VERSION, h: hashText('Very chatty today.'), t: [['chatty', 'b', 1, 0]] } });
    assert.equal(theme(overruled, 'chatty').tone, 'worry', 'a confident reading of the words is not overruled by the AI');
});

test('the class reading counts languages, AI readings and unclear notes', () => {
    const students = [{ id: 'a', name: 'Anna' }, { id: 'b', name: 'Bob' }];
    const r = readClassNotes([
        { id: '1', studentId: 'a', day: 100, text: 'Πολύ ζωηρή σήμερα.' },
        { id: '2', studentId: 'b', day: 101, text: 'Very shy in pair work.' },
        { id: '3', studentId: 'b', day: 102, text: 'poly omorfh zwgrafia' }
    ], students, 103);
    assert.equal(r.languageMix.el, 1);
    assert.equal(r.languageMix.en, 1);
    assert.equal(r.unclear, 1);
    const energetic = r.clusters.find((c) => c.theme.id === 'energetic');
    assert.equal(energetic.open[0].intensity, 2);
});
