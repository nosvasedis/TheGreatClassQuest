import assert from 'node:assert/strict';
import test from 'node:test';
import { QUIZ_VOICES, quizSpeechRate, quizVoiceFor, quizVoicePool } from '../features/quizVoices.mjs';

test('each question keeps its narrator and a quiz hears several voices', () => {
    assert.equal(quizVoiceFor('q-7', 'senior').id, quizVoiceFor('q-7', 'senior').id);
    const heard = new Set(Array.from({ length: 12 }, (_, i) => quizVoiceFor(`question-${i}`).id));
    assert.ok(heard.size >= 5, `only ${heard.size} voices`);
});

test('younger leagues hear a smaller, clearer cast at a gentler pace', () => {
    const early = quizVoicePool('early').map((v) => v.id);
    assert.ok(early.length >= 4 && !early.includes('angus'));
    for (let i = 0; i < 40; i++) assert.ok(early.includes(quizVoiceFor(`q${i}`, 'early').id));
    assert.equal(quizVoicePool('').length, QUIZ_VOICES.length);
    assert.ok(quizSpeechRate('early') < quizSpeechRate('junior'));
    assert.ok(quizSpeechRate('junior') < quizSpeechRate(''));
});
