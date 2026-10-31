import test from 'node:test';
import assert from 'node:assert/strict';

test('one shared interval serves every listener and stops when the last leaves', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const { onSecond, clockStatus } = await import('../utils/clock.mjs');
    let a = 0;
    let b = 0;
    const stopA = onSecond(() => { a += 1; });
    const stopB = onSecond(() => { b += 1; });
    assert.deepEqual(clockStatus(), { listeners: 2, running: true });

    t.mock.timers.tick(3000);
    assert.equal(a, 3);
    assert.equal(b, 3);

    stopA();
    stopA(); // stopping twice is harmless
    t.mock.timers.tick(1000);
    assert.equal(a, 3);
    assert.equal(b, 4);

    stopB();
    assert.deepEqual(clockStatus(), { listeners: 0, running: false });
});

test('a failing listener does not stop the others', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const { onSecond } = await import('../utils/clock.mjs');
    const warn = t.mock.method(console, 'warn', () => {});
    let ok = 0;
    const stopBad = onSecond(() => { throw new Error('boom'); });
    const stopGood = onSecond(() => { ok += 1; });
    t.mock.timers.tick(1000);
    assert.equal(ok, 1);
    assert.equal(warn.mock.callCount(), 1);
    stopBad();
    stopGood();
});
