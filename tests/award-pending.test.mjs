import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    buildTodaysStarsMap,
    changedTodaysStarIds,
    clearAllPendingAwards,
    confirmAwardPending,
    getPendingAward,
    isRetryableWriteError,
    markAwardPending,
    runAwardWriteInOrder,
    settleAwardPending,
    withPendingAwards,
    withWriteRetries
} from '../features/awardPending.mjs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('a pending award shows on top of the saved rows until it settles', () => {
    clearAllPendingAwards();
    const saved = { a: { stars: 1, reason: 'focus' } };
    const token = markAwardPending('b', 2, 'teamwork');
    assert.deepEqual(withPendingAwards(saved).b, { stars: 2, reason: 'teamwork' });
    assert.equal(withPendingAwards(saved).a.stars, 1);
    assert.equal(settleAwardPending('b', token), true);
    assert.equal(withPendingAwards(saved).b, undefined);
});

test('a pending undo hides the saved stars at once', () => {
    clearAllPendingAwards();
    markAwardPending('a', 0, null);
    assert.equal(withPendingAwards({ a: { stars: 2, reason: 'focus' } }).a, undefined);
});

test('an older save settling never clears a newer tap', () => {
    clearAllPendingAwards();
    const award = markAwardPending('a', 1, 'focus');
    const undo = markAwardPending('a', 0, null);
    assert.equal(settleAwardPending('a', award), false);
    assert.equal(confirmAwardPending('a', award, { stars: 1, reason: 'focus' }), false);
    assert.equal(getPendingAward('a').token, undo);
});

test('a saved award stays shown until the listener brings the same row, then lets go', () => {
    clearAllPendingAwards();
    const token = markAwardPending('a', 1, 'focus');
    // A 2x day: the saved row holds 2 stars although the teacher tapped 1.
    confirmAwardPending('a', token, { stars: 2, reason: 'focus' }, 1000);
    assert.equal(withPendingAwards({}, 1500).a.stars, 2, 'no blink open before the snapshot');
    assert.equal(withPendingAwards({ a: { stars: 2, reason: 'focus' } }, 1600).a.stars, 2);
    assert.equal(getPendingAward('a'), null, 'dropped once the row arrived');
});

test('a saved award gives up waiting for the listener after the grace period', () => {
    clearAllPendingAwards();
    const token = markAwardPending('a', 1, 'focus');
    confirmAwardPending('a', token, { stars: 1, reason: 'focus' }, 0);
    assert.equal(withPendingAwards({}, 20000).a, undefined);
    assert.equal(getPendingAward('a'), null);
});

test('two rows for one student keep the one with stars, in any order', () => {
    const marker = { id: 'w', studentId: 's1', stars: 0, reason: 'welcome_back' };
    const award = { id: 'd', studentId: 's1', stars: 2, reason: 'focus' };
    assert.equal(buildTodaysStarsMap([marker, award]).s1.stars, 2);
    assert.equal(buildTodaysStarsMap([award, marker]).s1.stars, 2);
    assert.equal(buildTodaysStarsMap([award, marker]).s1.docId, 'd');
    assert.equal(buildTodaysStarsMap([marker]).s1.reason, 'welcome_back');
});

test('only students whose stars or reason changed are reported', () => {
    const before = { a: { stars: 1, reason: 'focus' }, b: { stars: 2, reason: 'respect' }, c: { stars: 1, reason: 'focus' } };
    const after = { a: { stars: 1, reason: 'focus', docId: 'x' }, b: { stars: 2, reason: 'teamwork' }, d: { stars: 1, reason: 'focus' } };
    assert.deepEqual(changedTodaysStarIds(before, after).sort(), ['b', 'c', 'd']);
});

test("one student's writes run in order: an undo tapped mid-save waits for the award", async () => {
    const db = { stars: 0 };
    const order = [];
    let releaseAward;
    const award = runAwardWriteInOrder('s1', () => new Promise((resolve) => {
        releaseAward = () => { db.stars = 2; order.push('award'); resolve('award'); };
    }));
    // The undo reads "what is saved" only when it actually runs.
    const undo = runAwardWriteInOrder('s1', async () => { order.push(`undo saw ${db.stars}`); db.stars = 0; return 'undo'; });
    const other = runAwardWriteInOrder('s2', async () => { order.push('other student'); return 'other'; });
    await other;
    assert.deepEqual(order, ['other student'], 'other students are not held up');
    releaseAward();
    assert.equal(await award, 'award');
    assert.equal(await undo, 'undo');
    assert.deepEqual(order, ['other student', 'award', 'undo saw 2']);
    assert.equal(db.stars, 0);
});

test('a failed write does not block the next one for that student', async () => {
    const failed = runAwardWriteInOrder('s3', async () => { throw new Error('offline'); });
    const next = runAwardWriteInOrder('s3', async () => 'ok');
    await assert.rejects(failed, /offline/);
    assert.equal(await next, 'ok');
});

test('contention and dropped connections are retried, real errors are not', async () => {
    assert.equal(isRetryableWriteError({ code: 'aborted' }), true);
    assert.equal(isRetryableWriteError({ code: 'firestore/unavailable' }), true);
    assert.equal(isRetryableWriteError({ code: 'permission-denied' }), false);
    assert.equal(isRetryableWriteError(new Error('Student not found!')), false);

    let calls = 0;
    const result = await withWriteRetries(async () => {
        calls += 1;
        if (calls < 3) throw Object.assign(new Error('busy'), { code: 'aborted' });
        return 'saved';
    }, { sleep: async () => {} });
    assert.equal(result, 'saved');
    assert.equal(calls, 3);

    let denied = 0;
    await assert.rejects(withWriteRetries(async () => {
        denied += 1;
        throw Object.assign(new Error('no'), { code: 'permission-denied' });
    }, { sleep: async () => {} }), /no/);
    assert.equal(denied, 1);
});

test('the star save is ordered per student, retried, and decides the Hero Boon inside the transaction', () => {
    const src = read('db/actions/stars.js');
    assert.match(src, /runAwardWriteInOrder\(studentId, \(\) => writeStudentStarsForToday/);
    assert.match(src, /withWriteRetries\(\(\) => runTransaction\(db/);
    assert.match(src, /heroBoonCandidate && !\(oldStars > 0\)/);
    assert.doesNotMatch(src, /hasStarsAlready/);
});

test('live listeners patch the award clouds instead of wiping them', () => {
    const award = read('ui/tabs/award.js');
    assert.match(award, /patchAwardCloudList\(listContainer, views\)/);
    assert.match(award, /restoreAwardOpenCloud/);
    assert.match(award, /withPendingAwards/);
    const listeners = read('db/listeners.js');
    assert.match(listeners, /buildTodaysStarsMap\(/);
    const ui = read('ui/core/listeners.js');
    assert.match(ui, /saveAwardWithOptimisticCloud\(studentId, starValue, reason\)/);
    assert.match(ui, /saveAwardWithOptimisticCloud\(studentId, 0, null\)/);
});
