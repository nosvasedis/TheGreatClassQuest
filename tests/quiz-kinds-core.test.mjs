import test from 'node:test';
import assert from 'node:assert/strict';
import {
    QUIZ_MAX_PICTURE_QUESTIONS,
    balanceAnswerPositions,
    buildQuizSystemPrompt,
    countKinds,
    describeKindMix,
    hasAllPictures,
    mixTotal,
    normalizeAiQuestion,
    pictureToListenQuestion,
    planQuizBatches,
    questionKey,
    questionKind,
    quizKindMix,
    quizPicturePrompt,
    reorderQuestionOptions
} from '../features/quizKindsCore.mjs';
import { buildQuizGenerationUserPrompt } from '../features/quizCurriculumCore.mjs';
import {
    computeQuestionStats,
    sanitizeQuizQuestion,
    shuffleQuestionOptions,
    statToCarriedQuestion
} from '../features/quizReviewCore.mjs';

const pictureRaw = {
    format: 'picture',
    question: 'Which one is a ladder?',
    answer: 'ladder',
    options: ['ladder', 'umbrella', 'bucket', 'kite'],
    pictures: ['a wooden ladder', 'a red umbrella', 'a blue bucket', 'a kite']
};

test('older questions without a kind play as classic choice questions', () => {
    assert.equal(questionKind({ type: 'mcq', question: 'x' }), 'choice');
    assert.equal(questionKind({ kind: 'nonsense' }), 'choice');
    assert.equal(questionKind({ kind: 'listen' }), 'listen');
});

test('younger leagues get more Listen and Picture questions than older ones', () => {
    const early = quizKindMix({ count: 10, band: 'early', type: 'mix' });
    const junior = quizKindMix({ count: 10, band: 'junior', type: 'mix' });
    const senior = quizKindMix({ count: 10, band: 'senior', type: 'mix' });
    const heardAndSeen = (mix) => mix.listen + mix.picture;
    assert.ok(heardAndSeen(early) > heardAndSeen(junior));
    assert.ok(heardAndSeen(junior) > heardAndSeen(senior));
    assert.equal(early.fix, 0, 'Pre-Junior never gets Fix the sentence');
    assert.ok(senior.fix >= 2);
    for (const mix of [early, junior, senior]) assert.equal(mixTotal(mix), 10);
});

test('every mix adds up, keeps pictures within the image limit, and has each format that belongs', () => {
    for (const band of ['early', 'junior', 'mid', 'senior']) {
        for (const type of ['mix', 'grammar', 'vocabulary']) {
            for (let count = 1; count <= 15; count++) {
                const mix = quizKindMix({ count, band, type });
                assert.equal(mixTotal(mix), count, `${band} ${type} ${count}`);
                assert.ok(mix.picture <= QUIZ_MAX_PICTURE_QUESTIONS);
                if (count >= 5) assert.ok(mix.listen >= 1, `${band} ${type} ${count} has a listen question`);
                if (band === 'early') assert.equal(mix.fix, 0);
            }
        }
    }
    const grammar = quizKindMix({ count: 12, band: 'mid', type: 'grammar' });
    const vocab = quizKindMix({ count: 12, band: 'mid', type: 'vocabulary' });
    assert.ok(grammar.fix > vocab.fix);
    assert.ok(vocab.picture > grammar.picture);
});

test('batches stay small for the text service and keep every question', () => {
    const mix = { choice: 4, listen: 5, picture: 4, fix: 2 };
    const batches = planQuizBatches(mix);
    assert.equal(batches.length, 3);
    batches.forEach((batch) => assert.ok(mixTotal(batch) <= 5));
    for (const kind of ['choice', 'listen', 'picture', 'fix']) {
        assert.equal(batches.reduce((sum, batch) => sum + batch[kind], 0), mix[kind]);
    }
    assert.ok(batches.every((batch) => batch.picture >= 1), 'pictures are dealt out');
    assert.deepEqual(planQuizBatches({}), []);
});

test('AI questions are read by their answer text, whatever index the AI wrote', () => {
    const q = normalizeAiQuestion({ format: 'choice', question: 'She ___ to school.', answer: 'goes', options: ['go', 'goes', 'going', 'gone'], correctIndex: 0 });
    assert.equal(q.kind, 'choice');
    assert.equal(q.type, 'mcq');
    assert.equal(q.correctIndex, 1);
    assert.equal(q.correctAnswer, 'goes');
});

test('unfair AI questions are dropped', () => {
    assert.equal(normalizeAiQuestion({ question: 'Pick', answer: 'a', options: ['a', 'b', 'c'] }), null, 'three answers');
    assert.equal(normalizeAiQuestion({ question: 'Pick', answer: 'a', options: ['a', 'A', 'c', 'd'] }), null, 'two the same');
    assert.equal(normalizeAiQuestion({ question: 'Pick', answer: 'z', options: ['a', 'b', 'c', 'd'] }), null, 'no right answer');
    assert.equal(normalizeAiQuestion({ format: 'listen', question: 'Listen.', answer: 'a', options: ['a', 'b', 'c', 'd'] }), null, 'nothing to hear');
    assert.equal(normalizeAiQuestion({ format: 'listen', listen: 'The cat is black.', question: 'The cat is black. What colour?', answer: 'black', options: ['black', 'white', 'red', 'blue'] }), null, 'spoken words printed on screen');
    assert.equal(normalizeAiQuestion({ format: 'fix', answer: 'Go', options: ['Go', 'Goes', 'Went', 'Gone'] }), null, 'fix needs sentences');
});

test('letter prefixes and a fifth answer are tidied', () => {
    const q = normalizeAiQuestion({ question: 'Which is a fruit?', answer: 'apple', options: ['A) chair', 'B) apple', 'C) shoe', 'D) door', 'E) lamp'].slice(0, 4) });
    assert.deepEqual(q.options, ['chair', 'apple', 'shoe', 'door']);
    const five = normalizeAiQuestion({ question: 'Which is a fruit?', answer: 'pear', options: ['chair', 'shoe', 'door', 'lamp', 'pear'] });
    assert.equal(five.options.length, 4);
    assert.equal(five.correctAnswer, 'pear');
});

test('the three new kinds keep what they need', () => {
    const listen = normalizeAiQuestion({ format: 'listen', listen: 'Tom has got a big brown dog.', question: 'Listen. What has Tom got?', answer: 'a dog', options: ['a dog', 'a cat', 'a bike', 'a ball'] });
    assert.equal(listen.kind, 'listen');
    assert.equal(listen.listen, 'Tom has got a big brown dog.');

    const picture = normalizeAiQuestion(pictureRaw);
    assert.equal(picture.kind, 'picture');
    assert.deepEqual(picture.picturePrompts, pictureRaw.pictures);
    assert.equal(picture.optionImages, null);

    const fix = normalizeAiQuestion({ format: 'fix', broken: 'He don\'t like milk.', answer: 'He doesn\'t like milk.', options: ['He doesn\'t like milk.', 'He don\'t likes milk.', 'He not like milk.', 'He doesn\'t likes milk.'] });
    assert.equal(fix.kind, 'fix');
    assert.equal(fix.question, 'Which sentence is correct?');
    assert.equal(fix.broken, 'He don\'t like milk.');
    const fixNoBroken = normalizeAiQuestion({ format: 'fix', broken: 'He doesn\'t like milk', answer: 'He doesn\'t like milk.', options: ['He doesn\'t like milk.', 'He don\'t likes milk.', 'He not like milk.', 'He doesn\'t likes milk.'] });
    assert.equal(fixNoBroken.broken, undefined, 'a "broken" sentence that is the right one is dropped');
});

test('right answers spread over A to D and pictures move with their answers', () => {
    const base = Array.from({ length: 8 }, (_, i) => normalizeAiQuestion({ ...pictureRaw, question: `Which one is a ladder? ${i}` }));
    base.forEach((q) => { q.optionImages = q.options.map((o) => `https://img/${o}.jpg`); });
    let seed = 0.37;
    const random = () => { seed = (seed * 9301 + 0.49297) % 1; return seed; };
    const balanced = balanceAnswerPositions(base, random);
    const positions = balanced.map((q) => q.correctIndex).sort();
    assert.deepEqual(positions, [0, 0, 1, 1, 2, 2, 3, 3]);
    balanced.forEach((q) => {
        assert.equal(q.options[q.correctIndex], 'ladder');
        q.options.forEach((option, i) => {
            assert.equal(q.optionImages[i], `https://img/${option}.jpg`);
            assert.equal(q.picturePrompts[i], pictureRaw.pictures[pictureRaw.options.indexOf(option)]);
        });
    });
});

test('a picture question without all its pictures becomes Listen and choose', () => {
    const picture = { ...normalizeAiQuestion(pictureRaw), id: 'q1', optionImages: ['https://a', null, 'https://c', 'https://d'] };
    assert.equal(hasAllPictures(picture), false);
    const listen = pictureToListenQuestion(picture);
    assert.equal(listen.kind, 'listen');
    assert.equal(listen.listen, 'ladder');
    assert.equal(listen.optionImages, undefined);

    const sanitized = sanitizeQuizQuestion(picture, 'q1');
    assert.equal(sanitized.kind, 'listen', 'the review save and carry-forward apply the same rule');
});

test('sanitize keeps kinds, drops emptied answers with their pictures, and falls back safely', () => {
    const full = { ...normalizeAiQuestion(pictureRaw), optionImages: ['https://a', 'https://b', 'https://c', 'https://d'] };
    const kept = sanitizeQuizQuestion(full, 'q1');
    assert.equal(kept.kind, 'picture');
    assert.equal(kept.optionImages.length, 4);

    const choice = sanitizeQuizQuestion({ question: 'Pick', options: ['a', '', 'c', 'd'], correctIndex: 2 }, 'q2');
    assert.deepEqual(choice.options, ['a', 'c', 'd']);
    assert.equal(choice.correctAnswer, 'c');

    const listenWithoutWords = sanitizeQuizQuestion({ kind: 'listen', question: 'Listen.', options: ['a', 'b'], correctIndex: 0 });
    assert.equal(listenWithoutWords.kind, 'choice');
});

test('missed questions come back next week as the same kind, pictures shuffled with answers', () => {
    const picture = sanitizeQuizQuestion({ ...normalizeAiQuestion(pictureRaw), id: 'q1', optionImages: ['https://ladder', 'https://umbrella', 'https://bucket', 'https://kite'] });
    const listen = sanitizeQuizQuestion({ id: 'q2', kind: 'listen', listen: 'I like red.', question: 'Listen. Which colour?', options: ['red', 'blue', 'green', 'pink'], correctIndex: 0 });
    const stats = computeQuestionStats([picture, listen], []);
    assert.equal(stats[0].kind, 'picture');
    assert.equal(stats[1].listen, 'I like red.');
    const carried = statToCarriedQuestion(stats[0], '2026-W40', 0);
    assert.equal(carried.kind, 'picture');
    const shuffled = shuffleQuestionOptions(carried, () => 0.1);
    shuffled.options.forEach((option, i) => assert.equal(shuffled.optionImages[i], `https://${option}`));
    assert.equal(statToCarriedQuestion(stats[1], '2026-W40', 1).listen, 'I like red.');
});

test('reorder keeps the right answer right', () => {
    const q = normalizeAiQuestion(pictureRaw);
    const moved = reorderQuestionOptions(q, [3, 2, 1, 0]);
    assert.equal(moved.options[moved.correctIndex], 'ladder');
    assert.equal(moved.picturePrompts[moved.correctIndex], 'a wooden ladder');
});

test('the prompt asks for each format, keeps the JSON shape and never leaks unselected words', () => {
    const prompt = buildQuizGenerationUserPrompt({
        curriculum: { type: 'mix', lessonFocus: { source: 'book-atlas', words: ['friend', 'ladder'], grammarPoints: [] } },
        ageDesc: 'children aged 8-9',
        band: 'junior',
        mix: { choice: 1, listen: 2, picture: 1, fix: 1 },
        avoid: ['goes']
    });
    assert.match(prompt, /Write 5 quiz questions/);
    assert.match(prompt, /2 × "listen"/);
    assert.match(prompt, /"pictures"/);
    assert.match(prompt, /"broken"/);
    assert.match(prompt, /Put the right answer FIRST/);
    assert.match(prompt, /do not ask again: goes/);
    assert.equal(/\bkind\b/i.test(prompt), false);
    assert.equal(/\bshare\b/i.test(prompt), false);
    assert.match(buildQuizSystemPrompt(), /\{"questions":\[\.\.\.\]\}/);

    const onlyChoice = buildQuizGenerationUserPrompt({ curriculum: { type: 'grammar' }, questionCount: 6 });
    assert.match(onlyChoice, /6 × "choice"/);
    assert.equal(/"pictures"/.test(onlyChoice), false);
});

test('picture prompts share one style; small helpers', () => {
    const a = quizPicturePrompt('a wooden ladder', 'bright storybook illustration, no text');
    const b = quizPicturePrompt('a red umbrella', 'bright storybook illustration, no text');
    assert.equal(a.replace('a wooden ladder', ''), b.replace('a red umbrella', ''));
    assert.equal(describeKindMix({ choice: 2, listen: 3, picture: 1, fix: 0 }), '3 Listen · 1 Picture · 2 Choose');
    assert.deepEqual(countKinds([{ kind: 'listen' }, {}, { kind: 'fix' }]), { choice: 1, listen: 1, picture: 0, fix: 1 });
    assert.equal(questionKey({ kind: 'listen', listen: 'Hello!', correctAnswer: 'hi' }), questionKey({ kind: 'listen', listen: 'hello', correctAnswer: 'Hi' }));
});
