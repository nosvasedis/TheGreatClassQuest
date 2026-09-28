const test = require('node:test');
const assert = require('node:assert/strict');
const { firebaseEnv, isTransientDiscoveryFailure } = require('../scripts/lib/firebase-cli.cjs');

test('firebase invocations use file-based functions discovery instead of a random port', () => {
  assert.equal(firebaseEnv().FIREBASE_FUNCTIONS_DISCOVERY_OUTPUT_PATH, 'true');
});

test('extra environment values win over the discovery defaults', () => {
  const env = firebaseEnv({ GOOGLE_APPLICATION_CREDENTIALS: 'key.json' });
  assert.equal(env.GOOGLE_APPLICATION_CREDENTIALS, 'key.json');
  assert.equal(env.FIREBASE_FUNCTIONS_DISCOVERY_OUTPUT_PATH, 'true');
});

test('the intermittent Windows discovery failure is treated as retryable', () => {
  assert.equal(
    isTransientDiscoveryFailure(
      1,
      'Error: User code failed to load. Cannot determine backend specification. Timeout after 10000.',
    ),
    true,
  );
  assert.equal(isTransientDiscoveryFailure(3221226505, ''), true);
});

test('real deploy errors are never retried', () => {
  assert.equal(isTransientDiscoveryFailure(0, ''), false);
  assert.equal(isTransientDiscoveryFailure(1, 'SyntaxError: Unexpected token in functions/index.js'), false);
  assert.equal(
    isTransientDiscoveryFailure(1, 'Error: HTTP Error: 403, The caller does not have permission'),
    false,
  );
});
