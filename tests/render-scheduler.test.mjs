import test from 'node:test';
import assert from 'node:assert/strict';

test('render scheduler coalesces invalidations to one render per key per frame', async () => {
  let queuedFrame = null;
  globalThis.requestAnimationFrame = (callback) => {
    queuedFrame = callback;
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {};

  const { scheduleRender, cancelScheduledRenders } = await import('../utils/renderScheduler.js');
  const calls = [];
  scheduleRender('home', () => calls.push('old-home'));
  scheduleRender('home', () => calls.push('latest-home'));
  scheduleRender('other', () => calls.push('other'));
  assert.deepEqual(calls, []);
  queuedFrame();
  assert.deepEqual(calls, ['latest-home', 'other']);

  scheduleRender('cancelled', () => calls.push('cancelled'));
  cancelScheduledRenders();
  assert.deepEqual(calls, ['latest-home', 'other']);
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
});
