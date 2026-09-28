#!/usr/bin/env node
'use strict';

const { runFirebase } = require('./lib/firebase-cli.cjs');

async function main() {
  const forwardedArgs = process.argv.slice(2);
  const result = await runFirebase(
    ['deploy', '--only', 'functions', '--non-interactive', ...forwardedArgs],
    { attempts: 3 },
  );

  if (result.status !== 0) {
    console.error(`\nCloud Functions deploy failed with exit code ${result.status ?? 'unknown'}.`);
    process.exit(result.status || 1);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
