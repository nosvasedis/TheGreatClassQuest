import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildGreenhouse, toDay, gini, profileFor, almanacBrief, DAY_MS, PROFILES
} from '../features/classGreenhouseCore.mjs';
import { TECHNIQUES, getTechnique } from '../features/classGreenhousePlaybook.mjs';

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
        { studentId: 's5', category: 'Behavior', createdAtMs: NOW.getTime() - 3 * DAY_MS },
        { studentId: 's5', category: 'Behavior', createdAtMs: NOW.getTime() - 10 * DAY_MS },
        { studentId: 's0', category: 'Academic', createdAtMs: NOW.getTime() - 5 * DAY_MS }
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
    assert.ok(by.s5.signals.some((s) => s.id === 'behaviour'));
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
