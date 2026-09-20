const test = require('node:test');
const assert = require('node:assert/strict');

async function loadResilience() {
  return import('../utils/aiResilience.js');
}

async function loadQueue() {
  return import('../utils/asyncQueue.js');
}

test('rate limits do not trip the AI circuit breaker', async () => {
  const { shouldCountAsCircuitFailure, isRetryableHttpStatus } = await loadResilience();

  assert.equal(shouldCountAsCircuitFailure({ name: 'RateLimitError', status: 429 }), false);
  assert.equal(shouldCountAsCircuitFailure({ name: 'TimeoutError' }), true);
  assert.equal(shouldCountAsCircuitFailure({ name: 'Error', status: 502 }), true);
  assert.equal(shouldCountAsCircuitFailure({ name: 'CircuitBreakerError', isCircuitBreaker: true }), false);

  assert.equal(isRetryableHttpStatus(429), true);
  assert.equal(isRetryableHttpStatus(503), true);
  assert.equal(isRetryableHttpStatus(400), false);
});

test('concurrency queue never runs more tasks than the limit', async () => {
  const { createConcurrencyQueue } = await loadQueue();
  const run = createConcurrencyQueue(2);
  let inFlight = 0;
  let peak = 0;

  await Promise.all(Array.from({ length: 6 }, () => run(async () => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 20));
    inFlight -= 1;
  })));

  assert.equal(peak, 2);
});
