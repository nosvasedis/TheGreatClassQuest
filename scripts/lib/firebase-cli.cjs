'use strict';

const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const firebaseBin = path.join(
  repoRoot,
  'node_modules',
  'firebase-tools',
  'lib',
  'bin',
  'firebase.js',
);

// The CLI's default functions discovery serves the function manifest over a random
// port and polls it for 10s. On Windows that server intermittently never comes up,
// which fails every `deploy --only functions` with "Cannot determine backend
// specification. Timeout after 10000" and sometimes aborts the CLI with exit
// 3221226505 (libuv assertion in src\win\async.c). Writing the manifest to a file
// instead of serving it over HTTP removes the port and the polling loop entirely.
const DISCOVERY_ENV = {
  FIREBASE_FUNCTIONS_DISCOVERY_OUTPUT_PATH: 'true',
};

const TRANSIENT_DISCOVERY_EXIT_CODES = new Set([3221226505]);
const TRANSIENT_DISCOVERY_PATTERNS = [
  /Cannot determine backend specification/,
  /Timeout after \d+/,
];

function firebaseEnv(extra = {}) {
  return { ...process.env, ...DISCOVERY_ENV, ...extra };
}

function isTransientDiscoveryFailure(status, output) {
  if (TRANSIENT_DISCOVERY_EXIT_CODES.has(status)) {
    return true;
  }
  return TRANSIENT_DISCOVERY_PATTERNS.some((pattern) => pattern.test(output));
}

function runFirebase(args, options = {}) {
  const attempts = Math.max(1, options.attempts || 1);
  const cwd = options.cwd || repoRoot;
  const env = firebaseEnv(options.env);

  return new Promise((resolve, reject) => {
    let attempt = 0;

    const runAttempt = () => {
      attempt += 1;
      let output = '';
      const child = spawn(process.execPath, [firebaseBin, ...args], {
        cwd,
        env,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      const forward = (chunk, stream) => {
        const text = chunk.toString();
        output += text;
        stream.write(text);
      };

      child.stdout.on('data', (chunk) => forward(chunk, process.stdout));
      child.stderr.on('data', (chunk) => forward(chunk, process.stderr));

      child.on('error', reject);
      child.on('close', (status) => {
        if (status === 0) {
          resolve({ status, output });
          return;
        }
        if (attempt < attempts && isTransientDiscoveryFailure(status, output)) {
          console.warn(
            `\nFirebase functions discovery failed transiently (exit ${status}). Retrying (${attempt}/${attempts})...`,
          );
          setTimeout(runAttempt, 1500);
          return;
        }
        resolve({ status, output });
      });
    };

    runAttempt();
  });
}

module.exports = {
  repoRoot,
  firebaseBin,
  firebaseEnv,
  isTransientDiscoveryFailure,
  runFirebase,
};
