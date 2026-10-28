import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const core = await import('../features/testDeskCore.mjs');
const { testDeskHtml } = await import('../features/testDeskView.mjs');

const day = (key) => new Date(`${key}T12:00:00`).getTime();
const score = (studentId, title, key) => ({ studentId, title, dayKey: key, time: day(key) });

test('titles that name the same paper resemble each other', () => {
    const n = core.normalizePaperTitle;
    assert.equal(n('  Unit  7 '), 'unit 7');
    assert.ok(core.titlesResemble(n('Unit 7'), n('Unit 7 (CPP1)')));
    assert.ok(core.titlesResemble(n('Unit 7 - revision'), n('unit 7')));
    assert.ok(!core.titlesResemble(n('Unit 7'), n('Unit 70')));
    assert.ok(!core.titlesResemble(n('Unit 7'), n('Unit 8')));
});

test('marks logged on the test day under a fuller name belong to the announced test', () => {
    const titles = core.paperTitlesForScheduledTest(
        { title: 'Unit 7', dayKey: '2026-10-26' },
        [score('a', 'Unit 7 (CPP1)', '2026-10-26'), score('b', 'Unit 7 (CPP1)', '2026-10-26'), score('c', 'Unit 6', '2026-10-12')]
    );
    assert.deepEqual([...titles].sort(), ['unit 7', 'unit 7 (cpp1)']);
});

test('the only test that day takes its marks whatever they were called', () => {
    const titles = core.paperTitlesForScheduledTest({ title: 'Unit 7', dayKey: '2026-10-26' }, [score('a', 'Progress test 2', '2026-10-26')]);
    assert.ok(titles.has('progress test 2'));
});

test('with two tests announced that day only a resembling title is claimed', () => {
    const scores = [score('a', 'Grammar quiz', '2026-10-26'), score('a', 'Unit 7 (CPP1)', '2026-10-26')];
    const unit = core.paperTitlesForScheduledTest({ title: 'Unit 7', dayKey: '2026-10-26' }, scores, { otherTitlesThatDay: ['Grammar quiz'] });
    assert.deepEqual([...unit].sort(), ['unit 7', 'unit 7 (cpp1)']);
});

const students = [
    { id: 'a', name: 'Anna', joinedAt: null },
    { id: 'b', name: 'Billy', joinedAt: null },
    { id: 'c', name: 'Chris', joinedAt: null },
    { id: 'd', name: 'Dora', joinedAt: null },
    { id: 'z', name: 'Zoe (joined later)', joinedAt: day('2026-10-27') }
];

test('a marked test lists who still owes it, with the absence that day', () => {
    const testScores = ['a', 'b', 'c'].map((id) => score(id, 'Unit 7 (CPP1)', '2026-10-26'));
    const groups = core.buildMakeupGroups({
        students,
        testScores,
        absences: new Set(['d|2026-10-26']),
        announced: new Map([['unit 7 (cpp1)', 'Unit 7']])
    });
    assert.equal(groups.length, 1);
    const [g] = groups;
    assert.equal(g.title, 'Unit 7 (CPP1)');
    assert.equal(g.announcedAs, 'Unit 7');
    assert.equal(g.sat, 3);
    assert.equal(g.expected, 4);
    assert.deepEqual(g.missing.map((m) => [m.student.id, m.absent]), [['d', true]]);
});

test('dismissed makeups and lone makeup papers stay off the desk', () => {
    const testScores = ['a', 'b', 'c'].map((id) => score(id, 'Unit 7', '2026-10-26'));
    const dismissed = { [core.makeupDismissKey('Unit 7', 'd')]: true };
    assert.equal(core.buildMakeupGroups({ students, testScores, dismissed }).length, 0);
    // One mark under a new name is most likely a makeup itself, unless it is an announced test.
    const lone = [score('a', 'Retake', '2026-10-26')];
    assert.equal(core.buildMakeupGroups({ students, testScores: lone }).length, 0);
    assert.equal(core.buildMakeupGroups({ students, testScores: lone, announced: new Map([['retake', 'Retake']]) }).length, 1);
});

test('the summary and progress read like a sentence', () => {
    assert.equal(core.testDeskSummary({ makeups: 1 }), '1 makeup to log');
    assert.equal(core.testDeskSummary({ toMark: true, makeups: 2 }), '1 test to mark · 2 makeups to log');
    assert.deepEqual(core.paperProgress(6, 7), { label: '6 of 7 marked', percent: 86 });
});

test('the desk is one card: the marked test and its makeup together', () => {
    const groups = core.buildMakeupGroups({
        students,
        testScores: ['a', 'b', 'c'].map((id) => score(id, 'Unit 7 (CPP1)', '2026-10-26')),
        absences: new Set(['d|2026-10-26'])
    });
    const { html, tone } = testDeskHtml({ scheduled: null, groups, avatar: () => '<i></i>' });
    assert.equal(tone, 'amber');
    assert.match(html, /1 makeup to log/);
    assert.match(html, /3 of 4 marked/);
    assert.match(html, /Absent Mon 26 Oct/);
    assert.match(html, /class="makeup-trigger/);
    assert.match(html, /ss-testdesk-toggle/);
    assert.doesNotMatch(html, /No results logged/);
});

test('several makeups sit one at a time behind arrows, never stacked', () => {
    const groups = core.buildMakeupGroups({
        students,
        testScores: ['a', 'b'].map((id) => score(id, 'Unit 7', '2026-10-26'))
    });
    assert.equal(groups[0].missing.length, 2);
    const first = testDeskHtml({ groups }).html;
    assert.match(first, /class="ss-makeup-pager"[^>]*data-page="0"[^>]*data-count="2"/);
    assert.equal((first.match(/scroll-makeup-item ss-makeup[^"]*is-current/g) || []).length, 1);
    assert.equal((first.match(/<li [^>]* hidden/g) || []).length, 1);
    assert.match(first, /data-step="-1" aria-label="Previous scholar" disabled/);
    assert.match(first, /<b>1<\/b> of 2/);
    // A remembered page survives a redraw, and is clamped when a name leaves.
    const second = testDeskHtml({ groups, pages: new Map([['unit 7', 5]]) }).html;
    assert.match(second, /data-page="1"/);
    assert.match(second, /data-step="1" aria-label="Next scholar" disabled/);
    // One makeup needs no pager.
    const one = core.buildMakeupGroups({ students, testScores: ['a', 'b', 'c'].map((id) => score(id, 'Unit 7', '2026-10-26')) });
    assert.doesNotMatch(testDeskHtml({ groups: one }).html, /ss-makeup-pager/);
});

test('scheduled status: a test with marks is marked, the rest are makeups', async () => {
    const state = await import('../state.js');
    const { getScheduledAssessmentStatus, getUpcomingScheduledAssessment } = await import('../features/assessmentConfig.js');
    const classData = { id: 'c1', questLevel: 'B', timeStart: '18:00', timeEnd: '20:00', assessmentConfig: { inheritSchoolDefaults: false, tests: { mode: 'numeric', maxScore: 100 }, dictations: { mode: 'none' } } };
    const assignment = { id: 'q1', classId: 'c1', testData: { date: '2026-10-26', title: 'Unit 7' } };
    state.setAllSchoolClasses([classData]);
    state.setAllTeachersClasses([classData]);
    state.setAllStudents(['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, classId: 'c1' })));
    state.setAllQuestAssignments([assignment]);
    state.setAllWrittenScores(['a', 'b', 'c'].map((id) => ({ id: `s${id}`, studentId: id, classId: 'c1', type: 'test', title: 'Unit 7 (CPP1)', date: '2026-10-26', scoreNumeric: 80 })));

    const opts = { now: new Date(2026, 9, 27, 10), classData, schoolDefaults: {} };
    const status = getScheduledAssessmentStatus(assignment, opts);
    assert.equal(status.scoreCount, 3);
    assert.equal(status.isConcluded, true);
    assert.equal(status.phase, 'completed');
    assert.equal(status.makeupCount, 1);
    assert.equal(status.chipLabel, '3/4 marked · 1 makeup');
    assert.equal(getUpcomingScheduledAssessment('c1'), null);

    state.setAllWrittenScores([]);
    const unmarked = getScheduledAssessmentStatus(assignment, opts);
    assert.equal(unmarked.phase, 'missed');
    assert.equal(unmarked.statusLabel, 'Ready to mark');
    assert.equal(unmarked.chipLabel, 'Sat yesterday');
});
