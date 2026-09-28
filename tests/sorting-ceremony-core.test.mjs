import test from 'node:test';
import assert from 'node:assert/strict';
import {
    SORTING_RING_ORDER,
    ORB_REST,
    GUILD_REVEAL_LINES,
    firstName,
    computeGuildAffinity,
    mixHex,
    orbColorsForShares,
    buildRevealSequence,
    revealDuration,
    buildAffinityEcho,
    splitOptionGlyph,
    questionLabel,
} from '../features/sortingCeremonyCore.mjs';

const GUILDS = {
    dragon_flame: { glow: '#ef4444' },
    grizzly_might: { glow: '#f59e0b' },
    owl_wisdom: { glow: '#60a5fa' },
    phoenix_rising: { glow: '#f472b6' },
};

const questions = [
    { options: [
        { guildWeights: { dragon_flame: 2, phoenix_rising: 1 } },
        { guildWeights: { owl_wisdom: 2, dragon_flame: 1 } },
    ] },
    { options: [
        { guildWeights: { grizzly_might: 2 } },
        { guildWeights: { dragon_flame: 2 } },
    ] },
];

test('every house has reveal words and a ring seat', () => {
    assert.equal(SORTING_RING_ORDER.length, 4);
    SORTING_RING_ORDER.forEach((id) => assert.ok(GUILD_REVEAL_LINES[id]));
});

test('firstName takes the first word and falls back to Hero', () => {
    assert.equal(firstName('Maria Papadopoulou'), 'Maria');
    assert.equal(firstName('  Nikos '), 'Nikos');
    assert.equal(firstName(''), 'Hero');
});

test('computeGuildAffinity sums weights and ignores unanswered questions', () => {
    const none = computeGuildAffinity(questions, []);
    assert.equal(none.total, 0);
    assert.equal(none.answered, 0);

    const some = computeGuildAffinity(questions, [0, undefined]);
    assert.equal(some.answered, 1);
    assert.equal(some.scores.dragon_flame, 2);
    assert.equal(some.scores.phoenix_rising, 1);

    const all = computeGuildAffinity(questions, [0, 1]);
    assert.equal(all.scores.dragon_flame, 4);
    const shareSum = Object.values(all.shares).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(shareSum - 1) < 1e-9);
});

test('mixHex blends and clamps', () => {
    assert.equal(mixHex('#000000', '#ffffff', 0), '#000000');
    assert.equal(mixHex('#000000', '#ffffff', 1), '#ffffff');
    assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
    assert.equal(mixHex('#000000', '#ffffff', 5), '#ffffff');
});

test('orb rests in violet, then leans toward the leading house without becoming it', () => {
    assert.deepEqual(orbColorsForShares({}, GUILDS), ORB_REST);
    const { shares } = computeGuildAffinity(questions, [0, 1]);
    const { a } = orbColorsForShares(shares, GUILDS);
    assert.notEqual(a, ORB_REST.a);
    assert.notEqual(a, GUILDS.dragon_flame.glow);
});

test('reveal sequence always lands on the chosen house and slows down', () => {
    for (const id of SORTING_RING_ORDER) {
        for (const r of [0, 0.3, 0.6, 0.99]) {
            const seq = buildRevealSequence(id, { random: () => r });
            assert.equal(seq.at(-1).guildId, id);
            assert.ok(seq.length >= 14);
            for (let i = 1; i < seq.length; i++) {
                assert.ok(seq[i].delay >= seq[i - 1].delay);
                // Clockwise: each step moves one seat along the ring.
                const prev = SORTING_RING_ORDER.indexOf(seq[i - 1].guildId);
                assert.equal(seq[i].guildId, SORTING_RING_ORDER[(prev + 1) % 4]);
            }
        }
    }
    const seq = buildRevealSequence('owl_wisdom', { random: () => 0 });
    assert.ok(revealDuration(seq) > 2500 && revealDuration(seq) < 6000);
});

test('affinity echo sums to 100 and puts the strongest first', () => {
    const { shares } = computeGuildAffinity(questions, [0, 1]);
    const echo = buildAffinityEcho(shares);
    assert.equal(echo.reduce((a, r) => a + r.percent, 0), 100);
    assert.equal(echo[0].guildId, 'dragon_flame');
});

test('splitOptionGlyph lifts the leading emoji off the words', () => {
    assert.deepEqual(splitOptionGlyph('🔥 Play a brave hero', 'A'), { glyph: '🔥', text: 'Play a brave hero', isEmoji: true });
    assert.deepEqual(splitOptionGlyph('🙋‍♀️ Going first', 'B').glyph, '🙋‍♀️');
    assert.deepEqual(splitOptionGlyph('Just words', 'C'), { glyph: 'C', text: 'Just words', isEmoji: false });
    assert.equal(splitOptionGlyph('⭐', 'D').glyph, 'D');
});

test('questionLabel keeps step within range', () => {
    assert.equal(questionLabel(3, 7), 'Question 3 of 7');
    assert.equal(questionLabel(0, 7), 'Question 1 of 7');
});
