import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildGreenhouse, toDay, gini, profileFor, almanacBrief, DAY_MS, PROFILES
} from '../features/classGreenhouseCore.mjs';
import { TECHNIQUES, getTechnique } from '../features/classGreenhousePlaybook.mjs';
import { readNote, readClassNotes, NOTE_THEMES } from '../features/classGreenhouseNotes.mjs';

const NOW = new Date(2026, 9, 8, 12, 0, 0); // Thu 8 Oct 2026
const iso = (daysAgo) => new Date(Date.UTC(2026, 9, 8) - daysAgo * DAY_MS).toISOString().slice(0, 10);
const ddmm = (daysAgo) => { const [y, m, d] = iso(daysAgo).split('-'); return `${d}-${m}-${y}`; };

// Two lessons a week for six weeks
const LESSONS = [];
for (let w = 0; w < 6; w += 1) { LESSONS.push(1 + w * 7, 4 + w * 7); }

function makeClass() {
    const students = ['Anna Papa', 'Bob Dyl', 'Chris Kon', 'Dora Lia', 'Eleni Mar', 'Fotis Gal', 'Giorgos Ath', 'Hara Zo'].map((name, i) => ({ id: `s${i}`, name }));
    const awards = [];
    const absences = [];
    const trials = [];
    LESSONS.forEach((ago) => {
        // Anna: lots of stars all season; Bob: stars stopped two weeks ago; Chris: never a star
        awards.push({ studentId: 's0', date: ddmm(ago), stars: 3, reason: 'focus' });
        if (ago > 14) awards.push({ studentId: 's1', date: ddmm(ago), stars: 2, reason: 'teamwork' });
        ['s3', 's4', 's5', 's6', 's7'].forEach((id, k) => { if ((ago + k) % 2 === 0) awards.push({ studentId: id, date: ddmm(ago), stars: 1, reason: k % 2 ? 'respect' : 'focus' }); });
    });
    // Dora absent the last three lessons
    [1, 4, 8].forEach((ago) => absences.push({ studentId: 's3', date: ddmm(ago) }));
    // Papers: four tests; Eleni slides, Anna strong, Chris low
    const marks = { s0: [92, 95, 90, 96], s1: [70, 72, 68, 71], s2: [40, 45, 38, 42], s4: [85, 80, 60, 55], s5: [75, 74, 76, 75], s6: [65, 70, 66, 68], s7: [80, 82, 79, 81], s3: [60, 62, 64, null] };
    [36, 25, 15, 4].forEach((ago, i) => Object.entries(marks).forEach(([id, xs]) => {
        if (xs[i] != null) trials.push({ studentId: id, date: iso(ago), pct: xs[i], type: 'test', title: `Unit ${i + 1}` });
    }));
    const notes = [
        { id: 'n1', studentId: 's5', category: 'Behavior', createdAtMs: NOW.getTime() - 3 * DAY_MS, text: 'Fotis was chatty again and kept interrupting Giorgos.' },
        { id: 'n2', studentId: 's5', category: 'Behavior', createdAtMs: NOW.getTime() - 10 * DAY_MS, text: 'Μιλάει συνέχεια στο μάθημα.' },
        { id: 'n3', studentId: 's0', category: 'Academic', createdAtMs: NOW.getTime() - 5 * DAY_MS, text: 'Excellent writing, very confident. Always helps others.' }
    ];
    return { students, awards, absences, trials, notes };
}

test('toDay reads every date shape the app stores', () => {
    assert.equal(toDay('08-10-2026'), toDay('2026-10-08'));
    assert.equal(toDay('8/10/2026'), toDay(new Date(2026, 9, 8)));
    assert.equal(toDay(''), null);
    assert.equal(toDay('nonsense'), null);
});

test('gini is 0 when shared and high when one child has everything', () => {
    assert.equal(gini([5, 5, 5, 5]), 0);
    assert.ok(gini([0, 0, 0, 20]) > 0.7);
    assert.equal(gini([]), 0);
});

test('profiles follow the growth map quadrants', () => {
    assert.equal(profileFor('hi', 'hi'), 'bloom');
    assert.equal(profileFor('hi', 'lo'), 'reaching');
    assert.equal(profileFor('lo', 'hi'), 'roots');
    assert.equal(profileFor('lo', 'lo'), 'tending');
    assert.equal(profileFor('mid', 'mid'), 'steady');
    assert.equal(profileFor('lo', 'unknown'), 'roots');
});

test('the reading spots the children a teacher should act on', () => {
    const g = buildGreenhouse({ ...makeClass(), now: NOW });
    const by = Object.fromEntries(g.students.map((r) => [r.id, r]));

    assert.equal(g.lessons.all, 12);
    assert.equal(by.s0.profile, 'bloom');
    assert.ok(by.s1.signals.some((s) => s.id === 'wilting'), 'Bob\'s stars stopped');
    assert.ok(by.s2.signals.some((s) => s.id === 'unseen'), 'Chris never gets a star');
    assert.equal(by.s2.profile, 'tending');
    assert.ok(by.s3.signals.some((s) => s.id === 'absent-streak' && s.sev === 3));
    assert.ok(by.s3.papers.missed.some((m) => m.title === 'Unit 4' && m.wasAbsent));
    assert.ok(by.s4.signals.some((s) => s.id === 'grades-down'), 'Eleni\'s papers slide');
    const chatty = by.s5.signals.find((s) => s.id === 'note-chatty');
    assert.ok(chatty, 'Fotis: what the notes say, not how many there are');
    assert.equal(chatty.sev, 2, 'two notes on the same worry this month');
    assert.match(chatty.quote, /chatty again/);
    assert.match(by.s5.action, /hand signal/);
    // Highest priority first
    assert.ok(g.students[0].priority >= g.students[g.students.length - 1].priority);
    // Every child gets an action and real techniques
    g.students.forEach((r) => {
        assert.ok(r.action.length > 10);
        r.techniques.forEach((id) => assert.ok(getTechnique(id), id));
    });
});

test('the class reading and plan are built from the same records', () => {
    const g = buildGreenhouse({ ...makeClass(), now: NOW });
    const c = g.classReading;
    assert.equal(c.size, 8);
    assert.ok(c.health >= 0 && c.health <= 100);
    assert.ok(c.insights.length > 0);
    c.insights.forEach((i) => i.techniques.forEach((id) => assert.ok(getTechnique(id), id)));
    assert.ok(c.insights.some((i) => i.id === 'virtue-creativity'), 'no creativity stars at all');
    assert.ok(g.plan.focus.length > 0 && g.plan.focus.length <= 4);
    assert.ok(g.plan.welcome.some((w) => w.id === 's3'));
    assert.ok(g.plan.catchUps.some((x) => x.id === 's3'));
    assert.equal(g.plan.crews.length, 3);
    const crewed = g.plan.crews.flatMap((cr) => cr.members.map((m) => m.id));
    assert.equal(new Set(crewed).size, crewed.length);
    const paired = g.plan.pairs.flat().map((m) => m.id);
    assert.equal(new Set(paired).size, paired.length);
    assert.equal(paired.length, 8);
});

test('an empty class still reads without errors', () => {
    const g = buildGreenhouse({ students: [{ id: 'a', name: 'New Child' }], now: NOW });
    assert.equal(g.students[0].profile, 'planted');
    assert.ok(g.classReading.insights.some((i) => i.id === 'few-records'));
    assert.equal(g.plan.crews, null);
});

test('the fingerprint changes when the records change, and the brief carries no note text', () => {
    const base = makeClass();
    const a = buildGreenhouse({ ...base, now: NOW });
    const b = buildGreenhouse({ ...base, now: NOW });
    assert.equal(a.fingerprint, b.fingerprint);
    const c = buildGreenhouse({ ...base, awards: [...base.awards, { studentId: 's2', date: ddmm(1), stars: 3, reason: 'creativity' }], now: NOW });
    assert.notEqual(a.fingerprint, c.fingerprint);
    const brief = almanacBrief(a, { className: 'Owls' });
    assert.match(brief, /Owls/);
    assert.match(brief, /Anna:/);
    assert.doesNotMatch(brief, /Papa/, 'surnames stay out of the AI brief');
    assert.ok(Object.keys(PROFILES).length >= 5);
});

test('technique ids are unique and every technique says how and why', () => {
    const ids = TECHNIQUES.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
    TECHNIQUES.forEach((t) => { assert.ok(t.how && t.why && t.title && t.area && t.time, t.id); });
});

const theme = (r, id) => r.themes.find((t) => t.id === id);

test('the note reader understands what was written, in English and Greek', () => {
    const kids = [{ id: 'a', name: 'Νίκος Π' }, { id: 'b', name: 'Maria K' }];
    let r = readNote({ text: 'Excellent spelling in the dictation!' });
    assert.equal(theme(r, 'spelling').tone, 'strength');
    r = readNote({ text: 'Struggles with spelling, many mistakes.' });
    assert.equal(theme(r, 'spelling').tone, 'worry');
    r = readNote({ text: 'Much more focused this week, no longer distracted.' });
    assert.equal(theme(r, 'focus').tone, 'better');
    r = readNote({ text: 'Δεν έφερε το βιβλίο του πάλι.' });
    assert.equal(theme(r, 'materials').tone, 'worry');
    r = readNote({ text: 'Μάλωσε με τον Νίκο στο διάλειμμα.' }, kids);
    assert.equal(theme(r, 'conflict').tone, 'worry');
    assert.deepEqual(r.mentions, ['a']);
    r = readNote({ text: 'Πολύ ντροπαλή, αλλά λατρεύει το ποδόσφαιρο.' });
    assert.ok(theme(r, 'shy'));
    assert.ok(r.interests.includes('football'));
    r = readNote({ text: 'Helps others with the new words.' });
    assert.equal(theme(r, 'vocabulary'), undefined, 'a bare mention of a skill is not a worry');
    assert.equal(theme(r, 'helper').tone, 'strength');
    r = readNote({ text: 'Excellent writing. Always helps others with the new words.', category: 'Academic' });
    assert.equal(theme(r, 'vocabulary'), undefined, 'praise in the same sentence is not a vocabulary worry');
    r = readNote({ text: 'Kept interrupting Giorgos during the reading.', category: 'Behavior' });
    assert.ok(theme(r, 'chatty'));
    assert.equal(theme(r, 'reading'), undefined, 'the worry is the interrupting, not the reading');
    r = readNote({ text: 'She now brings her book and pays attention.' });
    assert.equal(theme(r, 'focus').tone, 'better');
    assert.equal(readNote({ text: 'Kept the oath', source: 'ember_oath' }).themes.length, 0);
    const ids = NOTE_THEMES.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
    NOTE_THEMES.forEach((t) => (t.techniques || []).forEach((id) => assert.ok(getTechnique(id), `${t.id} → ${id}`)));
});

test('the class reading turns shared notes into class moves', () => {
    const base = makeClass();
    const day = (ago) => NOW.getTime() - ago * DAY_MS;
    const notes = [
        ...base.notes,
        { id: 'x1', studentId: 's1', category: 'Academic', createdAtMs: day(6), text: 'Bob struggles with spelling, lots of mistakes.' },
        { id: 'x2', studentId: 's2', category: 'Academic', createdAtMs: day(4), text: 'Chris: spelling is weak again.' },
        { id: 'x3', studentId: 's7', category: 'Academic', createdAtMs: day(2), text: 'Hara has spelling difficulties.' },
        { id: 'x4', studentId: 's6', category: 'Behavior', createdAtMs: day(5), text: 'Giorgos argued with Fotis over the cards.' },
        { id: 'x5', studentId: 's3', category: 'General', createdAtMs: day(9), text: 'Dora is very shy. She loves football.' },
        { id: 'x6', studentId: 's4', category: 'General', createdAtMs: day(30), text: 'Eleni was anxious before the test and cried.' },
        { id: 'x7', studentId: 's7', category: 'General', createdAtMs: day(3), text: 'Hara talks about football all the time at break.' }
    ];
    const g = buildGreenhouse({ ...base, notes, now: NOW });
    const by = Object.fromEntries(g.students.map((r) => [r.id, r]));
    const c = g.classReading;

    const spellingInsight = c.insights.find((i) => i.id === 'notes-spelling');
    assert.ok(spellingInsight && ['Bob', 'Chris', 'Hara'].every((n) => spellingInsight.text.includes(n)), 'three spelling worries become one class move');
    assert.ok(c.insights.some((i) => i.id === 'notes-interests' && /football/i.test(i.text)));
    assert.ok(c.chronicle.friction.some((p) => [p.a, p.b].sort().join() === 's5,s6'), 'Giorgos and Fotis are written about together in rough notes');
    const spelling = g.plan.noteGroups.find((x) => x.id === 'spelling');
    assert.deepEqual(spelling.members.map((m) => m.id).sort(), ['s1', 's2', 's7']);
    assert.ok(g.plan.keepApart.length >= 1);
    g.plan.pairs.forEach((pair) => assert.ok(!(pair.some((m) => m.id === 's5') && pair.some((m) => m.id === 's6')), 'pairs keep friction apart'));
    const buddy = g.plan.buddies.find((b) => b.child.id === 's3');
    assert.ok(buddy, 'shy Dora gets a buddy');
    assert.equal(buddy.helper.id, 's0', 'Anna helps others, by the notes');
    assert.ok(g.plan.hooks.some((h) => h.id === 'football'));
    // Chris's spelling worry agrees with his low papers
    assert.match(by.s2.signals.find((s) => s.id === 'note-spelling').text, /papers agree/i);
    // Eleni's anxiety note is 30 days old and nothing since: a follow-up
    assert.ok(by.s4.signals.some((s) => s.id === 'follow-up'));
    assert.ok(g.plan.followUps.some((f) => f.id === 's4'));

    const brief = almanacBrief(g, { className: 'Owls' });
    assert.match(brief, /spelling \(worry\)/);
    assert.doesNotMatch(brief, /lots of mistakes|cried|anxious/i, 'no note text and no wellbeing labels reach the AI');
});

test('a worry marked as getting better is a reason to praise, not to act', () => {
    const students = [{ id: 'a', name: 'Anna' }];
    const today = 20000;
    const r = readClassNotes([
        { id: '1', studentId: 'a', day: today - 20, text: 'Anna is very distracted in class.' },
        { id: '2', studentId: 'a', day: today - 2, text: 'Anna is much more focused now.' }
    ], students, today);
    const a = r.perChild.get('a');
    assert.equal(a.worries.length, 0);
    assert.equal(a.better[0].id, 'focus');
    assert.equal(a.followUp, null);
});

test('the shared reader catches the wordings the Oracle found it missing', () => {
    const tones = (text, category = 'General') => readNote({ text, category }).themes.map((t) => `${t.id}:${t.tone}`);
    assert.ok(tones('Forgot her workbook again and the homework was not done.').includes('homework:worry'));
    assert.ok(tones('Δεν έκανε πάλι τις ασκήσεις.').includes('homework:worry'));
    assert.ok(tones('He keeps talking during the lesson.', 'Behavior').includes('chatty:worry'));
    assert.ok(tones('Forgot her workbook.').includes('materials:worry'));
    const happy = tones('Answered in full sentences during the role play! More confident with Maria.', 'Academic');
    assert.ok(happy.includes('writing:strength'), 'a bare skill in a happy note is praise');
    assert.ok(!happy.some((t) => t.endsWith(':worry')));
    assert.ok(tones('Writing in class.', 'Academic').includes('writing:worry'), 'a bare skill in a plain Academic note stays a worry');
    assert.ok(tones('He doesn’t pay attention.', 'Behavior').includes('focus:worry'), 'curly apostrophes read like straight ones');
});
