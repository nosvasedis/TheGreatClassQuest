// Storage rules may make at most 2 firestore.exists()/get() calls per request (more = permission
// denied), and only repeated identical calls may be cached. An exists() + get() pair on the
// teacher's profile was enough to refuse every diary picture upload, so the rules look each
// document up once, with get() only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = source.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

test('storage rules never call firestore.exists()', () => {
  assert.equal(/firestore\.exists\s*\(/.test(code), false);
});

test('the profile is read through one helper', () => {
  const profileReads = code.match(/firestore\.get\(profilePath\(\)\)/g) || [];
  assert.equal(profileReads.length, 1);
});
