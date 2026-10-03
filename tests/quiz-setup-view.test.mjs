import test from 'node:test';
import assert from 'node:assert/strict';
import { describeQuizWeek, planSummaryText, quizTrackHtml, weekLabel, weekRangeLabel, expectedQuestionCount } from '../ui/tabs/quizSetupView.mjs';

const questions = (n, carried = 0) => Array.from({ length: n }, (_, i) => ({ id: `q${i}`, ...(i < carried ? { carriedFrom: { questionId: `p${i}` } } : {}) }));

test('no quiz yet: plan step, no actions', () => {
    const m = describeQuizWeek({ quiz: null });
    assert.equal(m.phase, 1);
    assert.deepEqual(m.actions, []);
});

test('review waits on the teacher and offers approve + delete', () => {
    const m = describeQuizWeek({ quiz: { status: 'review', questions: questions(8, 2), curriculum: { type: 'mix' } } });
    assert.equal(m.phase, 3);
    assert.deepEqual(m.actions, ['review', 'reset']);
    assert.match(m.title, /8 questions/);
    assert.ok(m.facts.some((f) => f.text === '2 back from last time'));
});

test('ready names the next lesson, or says no lesson is left this week', () => {
    const quiz = { status: 'ready', questions: questions(7) };
    const withLesson = describeQuizWeek({ quiz, nextLesson: { date: new Date(2026, 9, 5), timeStart: '17:00' } });
    assert.ok(withLesson.facts.some((f) => f.text === 'Next lesson Mon 5 Oct, 17:00'));
    assert.match(describeQuizWeek({ quiz }).sub, /No lessons left/);
});

test('generating and errors override the stored status', () => {
    const quiz = { status: 'ready', questions: questions(7) };
    assert.equal(describeQuizWeek({ quiz, generating: true }).status, 'generating');
    assert.equal(describeQuizWeek({ quiz, error: 'boom' }).sub, 'boom');
});

test('completed quiz shows its score and offers only the results', () => {
    const m = describeQuizWeek({ quiz: { status: 'completed', questions: questions(8), results: { tier: 'epic', firstTryCorrectPct: 88, allParticipating: ['a'] } } });
    assert.equal(m.phase, 5);
    assert.deepEqual(m.actions, ['results']);
    assert.ok(m.facts.some((f) => f.text === '1 hero'));
});

test('track marks done, current and skipped steps', () => {
    const html = quizTrackHtml(4, { skippedCheck: true });
    assert.equal((html.match(/is-done/g) || []).length, 3);
    assert.match(html, /is-skipped/);
    assert.match(html, /aria-current="step"/);
});

test('labels and plan summary', () => {
    assert.equal(weekLabel('2026-W41'), 'Week of 5 Oct');
    assert.equal(weekRangeLabel('2026-09-28'), '28 Sep – 2 Oct');
    assert.equal(planSummaryText({ type: 'vocabulary', lessonFocus: { source: 'book-atlas', units: [{ unit: 4 }], words: ['a', 'b', 'c', 'd'] } }), 'Vocabulary · Unit 4 · a, b, c +1');
    assert.equal(planSummaryText({ type: 'grammar', categories: ['Can / Can\'t'], lessonFocus: null }), 'Grammar · Can / Can\'t');
    assert.equal(expectedQuestionCount(12), 9);
});
