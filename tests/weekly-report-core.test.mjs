import test from 'node:test';
import assert from 'node:assert/strict';
import {
    parseReportDate,
    getReportWeek,
    dayIndexInWeek,
    buildWeeklyReportModel,
    buildWeeklyHighlights,
    buildWeeklyReportPrompt,
    parseWeeklyReading,
    buildWeeklyReportText,
    formatStars,
} from '../features/weeklyReportCore.mjs';

test('parseReportDate reads every stored format as a local day', () => {
    const want = new Date(2026, 8, 30).getTime();
    assert.equal(parseReportDate('30-09-2026').getTime(), want);
    assert.equal(parseReportDate('30/09/2026').getTime(), want);
    assert.equal(parseReportDate('2026-09-30').getTime(), want);
    assert.equal(parseReportDate(new Date(2026, 8, 30, 15, 20)).getTime(), want);
    assert.equal(parseReportDate({ toDate: () => new Date(2026, 8, 30, 9) }).getTime(), want);
    assert.equal(parseReportDate('nonsense'), null);
    assert.equal(parseReportDate(''), null);
});

test('getReportWeek runs Monday to Sunday and steps back by whole weeks', () => {
    const wed = new Date(2026, 8, 30); // Wednesday
    const week = getReportWeek(wed, 0);
    assert.equal(week.key, '2026-09-28');
    assert.equal(week.end.getDate(), 4);
    assert.equal(week.elapsedDays, 3);
    assert.equal(week.name, 'This week');
    assert.match(week.label, /28 Sep – 4 Oct 2026/);
    const last = getReportWeek(wed, -1);
    assert.equal(last.key, '2026-09-21');
    assert.equal(last.elapsedDays, 7);
    assert.equal(last.label, '21–27 Sep 2026');
    const sunday = getReportWeek(new Date(2026, 9, 4), 0);
    assert.equal(sunday.key, '2026-09-28');
    assert.equal(dayIndexInWeek(week, '04-10-2026'), 6);
    assert.equal(dayIndexInWeek(week, '27-09-2026'), -1);
});

function fixture() {
    const week = getReportWeek(new Date(2026, 8, 27), 0); // 21–27 Sep
    const students = [
        { id: 'a', name: 'Anna Papadopoulou' },
        { id: 'b', name: 'Babis K' },
        { id: 'c', name: 'Chloe M' },
    ];
    const awardLogs = [
        { classId: 'k', studentId: 'a', date: '22-09-2026', reason: 'teamwork', stars: 2, note: 'Helped her group' },
        { classId: 'k', studentId: 'a', date: '24-09-2026', reason: 'focus', stars: 1 },
        { classId: 'k', studentId: 'b', date: '24-09-2026', reason: 'teamwork', stars: 1 },
        { classId: 'k', studentId: 'b', date: '24-09-2026', reason: 'teacher_boon', stars: 2 },
        { classId: 'k', studentId: 'a', date: '15-09-2026', reason: 'respect', stars: 1 }, // week before
        { classId: 'other', studentId: 'z', date: '22-09-2026', reason: 'focus', stars: 5 },
    ];
    const writtenScores = [
        { classId: 'k', studentId: 'a', date: '2026-09-24', type: 'test', title: 'Unit 1', normalizedPercent: 90 },
        { classId: 'k', studentId: 'b', date: '2026-09-24', type: 'test', title: 'Unit 1', normalizedPercent: 70 },
    ];
    const attendance = [{ classId: 'k', studentId: 'c', date: '22-09-2026' }];
    const adventureLogs = [{ classId: 'k', date: '24-09-2026', hero: 'Babis K' }];
    return { week, students, awardLogs, writtenScores, attendance, adventureLogs, classData: { id: 'k', name: 'Owls', logo: '🦉', questLevel: 'B' } };
}

test('buildWeeklyReportModel counts only this class and this week', () => {
    const m = buildWeeklyReportModel(fixture());
    assert.equal(m.totalStars, 6);
    assert.equal(m.prevStars, 1);
    assert.equal(m.starChange, 500);
    assert.equal(m.lessonCount, 2); // Tue + Thu
    assert.deepEqual(m.days.map((d) => d.stars), [0, 2, 0, 4, 0, 0, 0]);
    assert.equal(m.virtues.find((v) => v.id === 'teamwork').stars, 3);
    assert.equal(m.otherStars, 2);
    assert.equal(m.leadVirtue.id, 'teamwork');
    assert.deepEqual(m.shining.map((h) => h.id), ['a', 'b']);
    assert.equal(m.shining[0].topVirtue, 'teamwork');
    // Chloe was absent Tuesday but present Thursday, and has no stars
    assert.deepEqual(m.unseen.map((h) => h.id), ['c']);
    assert.equal(m.noticed, 2);
    assert.equal(m.absences, 1);
    assert.equal(m.attendanceRate, 83);
    assert.equal(m.trials.length, 1);
    assert.equal(m.trials[0].average, 80);
    assert.equal(m.trialAverage, 80);
    assert.deepEqual(m.crowns, [{ day: 'Thu', name: 'Babis K' }]);
    assert.deepEqual(m.notes, ['Helped her group']);
    assert.equal(m.isEmpty, false);
});

test('young learners get no star counts on heroes and no averages', () => {
    const m = buildWeeklyReportModel({ ...fixture(), youngLearners: true });
    assert.equal(m.shining[0].stars, null);
    assert.equal(m.trials[0].average, null);
    assert.equal(m.trialAverage, null);
});

test('an empty week is flagged and has no highlights', () => {
    const f = fixture();
    const m = buildWeeklyReportModel({ ...f, week: getReportWeek(new Date(2026, 6, 1), 0) });
    assert.equal(m.isEmpty, true);
    assert.equal(m.unseen.length, 0);
    assert.deepEqual(buildWeeklyHighlights(m), []);
});

test('highlights call out growth, the lead virtue and unseen heroes', () => {
    const texts = buildWeeklyHighlights(buildWeeklyReportModel(fixture())).map((h) => h.text).join(' | ');
    assert.match(texts, /up 500%/);
    assert.match(texts, /Teamwork led the way/);
    assert.match(texts, /1 hero was present but not yet recognised/);
});

test('prompt carries first names only and asks for JSON', () => {
    const { system, user } = buildWeeklyReportPrompt(buildWeeklyReportModel(fixture()));
    assert.match(system, /JSON/);
    assert.match(user, /"shining":\["Anna","Babis"\]/);
    assert.doesNotMatch(user, /Papadopoulou/);
});

test('parseWeeklyReading accepts JSON, fenced JSON with preamble, and plain text', () => {
    const json = '{"headline":"A team week","story":"One.\\n\\nTwo.","wins":["a","b","c","d"],"watch":["x"],"miniQuest":{"name":"Echo","goal":"g","howToWin":"h","reward":"r"},"familyNote":"Hi"}';
    const r = parseWeeklyReading(json);
    assert.equal(r.headline, 'A team week');
    assert.equal(r.story, 'One.\n\nTwo.');
    assert.equal(r.wins.length, 3);
    assert.equal(r.miniQuest.name, 'Echo');
    const fenced = parseWeeklyReading('Sure! ```json\n' + json + '\n```');
    assert.equal(fenced.familyNote, 'Hi');
    const plain = parseWeeklyReading('## Weekly Summary\nThe class did **well**.');
    assert.equal(plain.story, 'Weekly Summary\nThe class did well.');
    assert.equal(parseWeeklyReading(''), null);
});

test('plain-text export includes the numbers and the reading', () => {
    const m = buildWeeklyReportModel(fixture());
    const text = buildWeeklyReportText(m, parseWeeklyReading('{"headline":"H","story":"S","miniQuest":{"name":"Q","goal":"G"}}'));
    assert.match(text, /Owls: Weekly Report/);
    assert.match(text, /Stars: 6 \(week before: 1\)/);
    assert.match(text, /Mini-Quest: Q/);
    assert.equal(formatStars(2.25), '2.25');
});
