'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseImageDataUrl,
  storageObjectFromUrl,
  downloadUrlFor,
  canonicalObjectPath,
} = require('../scripts/migrate-avatars.cjs');

const ESAL_URL = 'https://firebasestorage.googleapis.com/v0/b/the-great-class-quest.firebasestorage.app/o/avatars%2F6bKFdFHUYTh2actiYmIF%2Favatar.webp?alt=media&token=d9546593-b30b-408d-a4f6-c8400a5b42be';

test('parseImageDataUrl decodes a valid inline webp portrait', () => {
  const parsed = parseImageDataUrl('data:image/webp;base64,UklGRg==');
  assert.equal(parsed.contentType, 'image/webp');
  assert.equal(parsed.extension, 'webp');
  assert.deepEqual([...parsed.bytes], [0x52, 0x49, 0x46, 0x46]);
});

test('parseImageDataUrl maps png and jpeg to their extensions', () => {
  assert.equal(parseImageDataUrl('data:image/png;base64,iVBORw0KGgo=').extension, 'png');
  assert.equal(parseImageDataUrl('data:image/jpeg;base64,/9j/4A==').extension, 'jpg');
});

test('parseImageDataUrl rejects non-images, unsupported types, and empty payloads', () => {
  assert.equal(parseImageDataUrl('data:text/plain;base64,aGk='), null);
  assert.equal(parseImageDataUrl('data:image/gif;base64,R0lGODlh'), null);
  assert.equal(parseImageDataUrl('https://example.com/avatar.webp'), null);
  assert.equal(parseImageDataUrl('data:image/webp;base64,'), null);
});

test('parseImageDataUrl rejects portraits above the 1 MiB limit', () => {
  const huge = Buffer.alloc(1024 * 1024 + 1).toString('base64');
  assert.equal(parseImageDataUrl(`data:image/webp;base64,${huge}`), null);
});

test('storageObjectFromUrl extracts bucket and decoded object path', () => {
  assert.deepEqual(storageObjectFromUrl(ESAL_URL), {
    bucket: 'the-great-class-quest.firebasestorage.app',
    objectPath: 'avatars/6bKFdFHUYTh2actiYmIF/avatar.webp',
  });
});

test('storageObjectFromUrl ignores non-Storage URLs', () => {
  assert.equal(storageObjectFromUrl('https://example.com/v0/b/x/o/y.png'), null);
  assert.equal(storageObjectFromUrl('data:image/webp;base64,UklGRg=='), null);
  assert.equal(storageObjectFromUrl(''), null);
});

test('canonicalObjectPath and downloadUrlFor build the unified Storage URL', () => {
  const objectPath = canonicalObjectPath('abc123', 'webp');
  assert.equal(objectPath, 'avatars/abc123/avatar.webp');
  assert.equal(
    downloadUrlFor('the-great-class-quest.firebasestorage.app', objectPath, 'tok-1'),
    'https://firebasestorage.googleapis.com/v0/b/the-great-class-quest.firebasestorage.app/o/avatars%2Fabc123%2Favatar.webp?alt=media&token=tok-1',
  );
});
