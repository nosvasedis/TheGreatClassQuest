import test from 'node:test';
import assert from 'node:assert/strict';
import { createLivePacer, diffStandings, heraldLines, standingsSnapshot } from '../features/guildLiveCore.mjs';

const row = (guildId, perMember, place, extra = {}) => ({ guildId, guildName: guildId.toUpperCase(), crowns: 0, live: { perMember, place, crowns: 0, ...extra } });

test('snapshot keeps a unique leader only', () => {
    assert.equal(standingsSnapshot([row('a', 5, 1), row('b', 4, 2)]).leader, 'a');
    assert.equal(standingsSnapshot([row('a', 5, 1), row('b', 5, 1)]).leader, null);
    assert.equal(standingsSnapshot([row('a', 5, 1)], { counts: false }).byId.a.place, null);
});

test('a gain with no place change is a plain gain', () => {
    const prev = standingsSnapshot([row('a', 5, 1), row('b', 4, 2)]);
    const next = standingsSnapshot([row('a', 5.5, 1), row('b', 4, 2)]);
    const diff = diffStandings(prev, next);
    assert.equal(diff.changes.length, 1);
    assert.equal(diff.changes[0].delta, 0.5);
    assert.equal(diff.newLeader, null);
    assert.deepEqual(heraldLines(diff).map((l) => l.tone), ['up']);
});

test('rounding noise is not news', () => {
    const prev = standingsSnapshot([row('a', 5, 1)]);
    const next = standingsSnapshot([row('a', 5.01, 1)]);
    assert.equal(diffStandings(prev, next).changes.length, 0);
});

test('overtaking the leader names who was passed', () => {
    const prev = standingsSnapshot([row('a', 5, 1), row('b', 4, 2), row('c', 3, 3)]);
    const next = standingsSnapshot([row('b', 6, 1), row('a', 5, 2), row('c', 3, 3)]);
    const diff = diffStandings(prev, next);
    assert.equal(diff.newLeader, 'b');
    const b = diff.changes.find((c) => c.guildId === 'b');
    assert.deepEqual(b.passed, ['A']);
    const lines = heraldLines(diff, { month: 'October' });
    assert.equal(lines[0].tone, 'lead');
    assert.match(lines[0].text, /B take the lead of October, past A!/);
    assert.ok(lines.some((l) => l.guildId === 'a' && /slip to 2nd/.test(l.text)));
});

test('a storm reads as a loss', () => {
    const prev = standingsSnapshot([row('a', 5, 1), row('b', 4, 2)]);
    const next = standingsSnapshot([row('a', 5, 1), row('b', 3.4, 2)]);
    const lines = heraldLines(diffStandings(prev, next));
    assert.equal(lines[0].tone, 'down');
    assert.match(lines[0].text, /−0\.6/);
});

test('pacer gathers a burst and waits while covered', () => {
    let t = 0;
    const timers = [];
    const setTimer = (fn, ms) => { timers.push({ fn, at: t + ms }); return timers.length; };
    const clearTimer = (id) => { if (timers[id - 1]) timers[id - 1].fn = null; };
    const advance = (ms) => {
        t += ms;
        for (const tm of timers) if (tm.fn && tm.at <= t) { const f = tm.fn; tm.fn = null; f(); }
    };
    let covered = false;
    let runs = 0;
    const pacer = createLivePacer(() => { runs += 1; }, { settle: 200, maxWait: 600, holdPoll: 100, hold: () => covered, now: () => t, setTimer, clearTimer });
    for (let i = 0; i < 3; i++) { pacer.request(); advance(100); }
    assert.equal(runs, 0);
    advance(200);
    assert.equal(runs, 1);
    covered = true;
    pacer.request();
    advance(1000);
    assert.equal(runs, 1);
    assert.equal(pacer.held, true);
    covered = false;
    advance(100);
    assert.equal(runs, 2);
});
