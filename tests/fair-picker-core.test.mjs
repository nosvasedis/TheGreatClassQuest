import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFairPicker, fairStatus, pickTurn, passTurn, freshRound } from '../features/fairPickerCore.mjs';

const CLASS = ['a', 'b', 'c', 'd', 'e'];

test('nobody gets a second turn until everyone here has had one', () => {
    let fair = normalizeFairPicker(null);
    const seen = [];
    for (let i = 0; i < 5; i++) {
        const r = pickTurn(fair, { presentIds: CLASS });
        seen.push(r.id);
        fair = r.next;
        assert.equal(r.freshRound, false);
    }
    assert.deepEqual([...seen].sort(), CLASS);
    const sixth = pickTurn(fair, { presentIds: CLASS });
    assert.equal(sixth.freshRound, true);
    assert.equal(sixth.next.round, 2);
    assert.notEqual(sixth.id, seen[4], 'the last child is not picked straight again');
});

test('a child who is away keeps waiting and the round does not close without them', () => {
    let fair = normalizeFairPicker(null);
    const present = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 4; i++) fair = pickTurn(fair, { presentIds: present }).next;
    const status = fairStatus(fair, { classIds: CLASS, presentIds: present });
    assert.deepEqual(status.waiting, []);
    assert.deepEqual(status.away, ['e']);
    // Next lesson, everyone is back: e is the only one still owed a turn.
    const next = pickTurn(fair, { presentIds: CLASS });
    assert.equal(next.id, 'e');
});

test('picking from one team only uses that team, and "not now" gives the turn back', () => {
    const fair = normalizeFairPicker(null);
    const r = pickTurn(fair, { presentIds: CLASS, poolIds: ['b', 'd'] });
    assert.ok(['b', 'd'].includes(r.id));
    const back = passTurn(r.next, r.id);
    assert.deepEqual(back.taken, []);
    assert.deepEqual(back.recent, []);
    assert.deepEqual(back.counts, {});
    assert.equal(pickTurn(fair, { presentIds: [] }), null);
});

test('a fresh round clears turns but keeps the round count going', () => {
    const fair = { round: 3, taken: ['a', 'b'], counts: { a: 2 } };
    const fresh = freshRound(fair);
    assert.equal(fresh.round, 4);
    assert.deepEqual(fresh.taken, []);
    assert.deepEqual(fresh.counts, { a: 2 });
});
