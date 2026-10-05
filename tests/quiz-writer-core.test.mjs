import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPartialQuestions, readAiQuestions, writeQuizQuestions } from '../features/quizWriterCore.mjs';
import { mixTotal } from '../features/quizKindsCore.mjs';

const choice = (n) => ({ format: 'choice', question: `Word ${n}: pick it`, answer: `right${n}`, options: [`right${n}`, `wrong${n}a`, `wrong${n}b`, `wrong${n}c`], explanation: 'because' });
const listen = (n) => ({ format: 'listen', listen: `I can hear number ${n}.`, question: 'Listen. Which number?', answer: `n${n}`, options: [`n${n}`, 'x1', 'x2', 'x3'] });
const picture = (n) => ({ format: 'picture', question: `Which one is thing ${n}?`, answer: `thing${n}`, options: [`thing${n}`, 'cup', 'hat', 'car'], pictures: [`a thing ${n}`, 'a cup', 'a hat', 'a car'] });
const fix = (n) => ({ format: 'fix', broken: `He go ${n}.`, answer: `He goes ${n}.`, options: [`He goes ${n}.`, `He go ${n}.`, `He going ${n}.`, `He gone ${n}.`] });
const MAKERS = { choice, listen, picture, fix };

/** A fake AI that answers each request with what its prompt asks for. */
function fakeAi({ breakAt = -1, dropPerPart = 0 } = {}) {
    let calls = 0;
    let n = 0;
    const prompts = [];
    const ask = async (system, user) => {
        calls += 1;
        prompts.push(user);
        if (calls === breakAt) throw new Error('provider down');
        const list = [];
        for (const kind of ['choice', 'listen', 'picture', 'fix']) {
            const count = Number((user.match(new RegExp(`- (\\d+) × "${kind}"`)) || [])[1] || 0);
            for (let i = 0; i < count; i++) list.push(MAKERS[kind](++n));
        }
        return JSON.stringify({ questions: list.slice(0, Math.max(0, list.length - dropPerPart)) });
    };
    return { ask, prompts, get calls() { return calls; } };
}

test('a reply cut off mid-way still gives back the finished questions', () => {
    const full = JSON.stringify({ questions: [choice(1), listen(2), fix(3)] });
    const cut = full.slice(0, full.length - 30);
    const found = extractPartialQuestions(cut);
    assert.equal(found.length, 2);
    assert.equal(readAiQuestions('```json\n' + full + '\n```').length, 3);
    assert.equal(readAiQuestions('Here you go! ' + full + ' Enjoy.').length, 3);
    assert.equal(readAiQuestions(JSON.stringify([choice(1)])).length, 1);
    assert.equal(readAiQuestions('{"data":{"items":[' + JSON.stringify(choice(1)) + ']}}').length, 1);
    assert.deepEqual(readAiQuestions('no json here'), []);
    // Braces inside strings do not confuse the reader.
    assert.equal(extractPartialQuestions(JSON.stringify([{ ...choice(4), question: 'Odd {brace} here ___' }])).length, 1);
});

test('a long quiz is written in parts that each stay small, with the mix the league needs', async () => {
    const ai = fakeAi();
    const progress = [];
    const { questions, mix } = await writeQuizQuestions({
        curriculum: { type: 'mix' }, freshCount: 15, band: 'junior', ageDesc: 'children aged 8-9',
        askAi: ai.ask, onProgress: (p) => progress.push(p)
    });
    assert.equal(questions.length, 15);
    assert.equal(ai.calls, 3);
    ai.prompts.forEach((prompt) => {
        const total = Number(prompt.match(/Write (\d+) quiz questions/)[1]);
        assert.ok(total <= 5);
    });
    const kinds = questions.reduce((acc, q) => ({ ...acc, [q.kind]: (acc[q.kind] || 0) + 1 }), {});
    assert.deepEqual(kinds, Object.fromEntries(Object.entries(mix).filter(([, n]) => n > 0)));
    assert.equal(mixTotal(mix), 15);
    // Later parts are told what is already in the quiz.
    assert.match(ai.prompts[1], /do not ask again: right1|do not ask again: .*right1/);
    assert.deepEqual(progress.map((p) => p.done), [0, 1, 2]);
    // Right answers are spread over A to D.
    const positions = new Set(questions.map((q) => q.correctIndex));
    assert.equal(positions.size, 4);
    questions.forEach((q) => assert.equal(q.options[q.correctIndex], q.correctAnswer));
});

test('missing questions are topped up once, and a failed part does not sink the quiz', async () => {
    const short = fakeAi({ dropPerPart: 1 });
    const res = await writeQuizQuestions({ freshCount: 10, band: 'mid', askAi: short.ask });
    assert.equal(short.calls, 3, 'two parts and one top-up');
    assert.ok(res.questions.length >= 9);

    const broken = fakeAi({ breakAt: 1 });
    const res2 = await writeQuizQuestions({ freshCount: 10, band: 'senior', askAi: broken.ask });
    assert.ok(res2.questions.length >= 5, 'the second part and the top-up still arrive');

    await assert.rejects(() => writeQuizQuestions({ freshCount: 5, askAi: async () => { throw Object.assign(new Error('API failed with status 429'), { status: 429 }); } }), /429/);
});

test('duplicates and unfair questions are left out', async () => {
    const ask = async () => JSON.stringify({ questions: [choice(1), choice(1), { question: 'bad', options: ['a', 'b'] }, listen(2)] });
    const res = await writeQuizQuestions({ freshCount: 3, band: 'mid', askAi: ask });
    const keys = res.questions.map((q) => q.correctAnswer);
    assert.equal(new Set(keys).size, keys.length);
});

test('never more than four picture questions, even when the AI writes more', async () => {
    const ask = async (system, user) => {
        const total = Number(user.match(/Write (\d+) quiz questions/)[1]);
        return JSON.stringify({ questions: Array.from({ length: total }, (_, i) => picture(Math.random().toString(36).slice(2, 7) + i)) });
    };
    const res = await writeQuizQuestions({ freshCount: 12, band: 'early', askAi: ask });
    assert.ok(res.questions.filter((q) => q.kind === 'picture').length <= 4);
    assert.ok(res.questions.filter((q) => q.kind === 'listen').every((q) => q.listen));
});
