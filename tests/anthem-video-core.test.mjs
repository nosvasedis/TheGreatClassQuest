import test from 'node:test';
import assert from 'node:assert/strict';
import {
    splitWords,
    countSyllables,
    estimateWordStarts,
    buildWordTimeline,
    frameAt,
    resolveCues,
    cuesReached,
    cueAt,
    beatPhase,
    validateWordTimings,
    LAST_LINE_SECONDS,
} from '../features/anthemVideo/anthemVideoCore.mjs';
import { GUILDS, GUILD_IDS } from '../features/guilds.js';
import { ANTHEM_VIDEO_TIMINGS } from '../features/anthemVideo/anthemWordTimings.js';

const LYRICS = [
    { type: 'verse', lines: [{ text: 'Out of the embers,', time: 2 }, { text: 'a spark tonight', time: 6 }] },
    { type: 'chorus', lines: [{ text: 'Burn bright!', time: 10 }] },
];

test('splitWords keeps punctuation on its word', () => {
    assert.deepEqual(splitWords('  we\'re first,  to stand! '), ["we're", 'first,', 'to', 'stand!']);
    assert.deepEqual(splitWords(''), []);
});

test('countSyllables gives sensible counts', () => {
    assert.equal(countSyllables('the'), 1);
    assert.equal(countSyllables('embers,'), 2);
    assert.equal(countSyllables('thunder'), 2);
    assert.equal(countSyllables('knowledge'), 2);
    assert.ok(countSyllables('wherever') >= 3);
    assert.equal(countSyllables('!!'), 1);
});

test('estimateWordStarts spreads words by syllables inside the window', () => {
    const starts = estimateWordStarts('Out of the embers,', 2, 6);
    assert.equal(starts.length, 4);
    assert.equal(starts[0], 2);
    for (let i = 1; i < starts.length; i++) assert.ok(starts[i] > starts[i - 1]);
    assert.ok(starts[3] < 6 * 0.86 + 2);
    // two-syllable "embers" is the last word, so it starts after 3 of 5 syllables
    assert.ok(Math.abs(starts[3] - (2 + (3 / 5) * 4 * 0.86)) < 0.02);
});

test('buildWordTimeline falls back to estimates and uses tuned times when they fit', () => {
    const est = buildWordTimeline(LYRICS);
    assert.equal(est.lines.length, 3);
    assert.equal(est.lines[0].end, 6);
    assert.equal(est.lines[2].end, 10 + LAST_LINE_SECONDS);
    assert.equal(est.lines[2].section, 'chorus');
    assert.equal(est.start, 2);

    const tuned = buildWordTimeline(LYRICS, { words: [[1.8, 2.5, 2.8, 3.1], [6, 6.5, 7], null] });
    assert.equal(tuned.lines[0].start, 1.8, 'an early first word pulls the line start forward');
    assert.deepEqual(tuned.lines[1].words.map(w => w.start), [6, 6.5, 7]);
    assert.equal(tuned.lines[0].words[0].end, 2.5);
    // wrong word count is ignored rather than trusted
    const bad = buildWordTimeline(LYRICS, { words: [[2, 3]] });
    assert.equal(bad.lines[0].words.length, 4);
});

test('frameAt walks intro, countdown, words and outro', () => {
    const tl = buildWordTimeline(LYRICS, { words: [[2, 2.5, 2.8, 3.1], [6, 6.5, 7], [10, 11]] });
    assert.deepEqual(
        [frameAt(tl, 0, 0).phase, frameAt(tl, 0, 0).countdown],
        ['intro', 2]
    );
    assert.equal(frameAt(tl, -2, 0).countdown, 0);
    assert.equal(frameAt(tl, 0.5, 0).countdown, 2);
    assert.equal(frameAt(tl, 1.5, 0).countdown, 1);

    const f = frameAt(tl, 2.6, 0);
    assert.equal(f.phase, 'sing');
    assert.equal(f.lineIdx, 0);
    assert.equal(f.wordIdx, 1);
    assert.ok(Math.abs(f.wordProgress - (0.1 / 0.3)) < 1e-9);

    assert.equal(frameAt(tl, 6, 0).lineIdx, 1, 'exactly on a line start');
    assert.equal(frameAt(tl, 5.95).lineIdx, 1, 'the lead lights a line a hair early');
    assert.equal(frameAt(tl, 10.5, 0).section, 'chorus');
    const out = frameAt(tl, 30, 0);
    assert.equal(out.phase, 'outro');
    assert.equal(out.lineIdx, 2);
    assert.equal(out.wordProgress, 1);
    assert.equal(frameAt({ lines: [] }, 5).phase, 'intro');
});

test('cues resolve against sung words and stay cumulative', () => {
    const tl = buildWordTimeline(LYRICS, { words: [[2, 2.5, 2.8, 3.1], [6, 6.5, 7], [10, 11]] });
    const cues = resolveCues([
        { name: 'chorus', line: 2 },
        { name: 'spark', line: 1, word: 1, offset: 0.1 },
        { name: 'open', at: 0 },
        { name: 'nowhere', line: 99 },
        { name: 'clamped', line: 0, word: 40 },
    ], tl);
    assert.deepEqual(cues.map(c => c.name), ['open', 'clamped', 'spark', 'chorus']);
    assert.equal(cues.find(c => c.name === 'spark').at, 6.6);
    assert.equal(cues.find(c => c.name === 'clamped').at, 3.1);
    assert.deepEqual(cuesReached(cues, 7), ['open', 'clamped', 'spark']);
    assert.equal(cueAt(cues, 7), 'spark');
    assert.equal(cueAt(cues, -1), null);
});

test('beatPhase counts beats and bars', () => {
    assert.deepEqual(beatPhase(120, 1, 0.5), { beat: -1, phase: 0, bar: -1 });
    const b = beatPhase(120, 0, 2.25);
    assert.equal(b.beat, 4);
    assert.equal(b.bar, 1);
    assert.ok(Math.abs(b.phase - 0.5) < 1e-9);
});

test('every guild anthem has valid tuned word timings', () => {
    for (const id of GUILD_IDS) {
        const timing = ANTHEM_VIDEO_TIMINGS[id];
        assert.ok(timing, `${id} has timings`);
        assert.deepEqual(validateWordTimings(GUILDS[id].anthemLyrics, timing), [], id);
        assert.ok(timing.bpm > 90 && timing.bpm < 150, `${id} bpm`);
        const tl = buildWordTimeline(GUILDS[id].anthemLyrics, timing);
        assert.ok(timing.outroAt >= tl.lines[tl.lines.length - 1].words.at(-1).start, `${id} outro after the last word`);
    }
});

test('validateWordTimings reports mismatches', () => {
    const problems = validateWordTimings(LYRICS, { words: [[2, 1.9, 3, 4], [6, 7], [10, 11]] });
    assert.ok(problems.some(p => p.includes('line 0 word 1')));
    assert.ok(problems.some(p => p.includes('line 1: expected 3')));
});
