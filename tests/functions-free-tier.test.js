import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

test('Cloud Functions stay free: nothing is kept warm', () => {
    for (const file of ['functions/index.js', 'functions/avatarForge.js', 'functions/shop/ensure.js']) {
        assert.doesNotMatch(read(file), /minInstances|minimumInstances/, `${file} must not keep instances warm (it bills even when idle)`);
    }
});

test('callables start quickly: more CPU, on-demand storage, parallel permission reads', () => {
    const index = read('functions/index.js');
    assert.match(index, /const CALLABLE_MEMORY = '1GB'/);
    assert.doesNotMatch(index, /^const \{ getStorage \} = require/m);
    assert.doesNotMatch(index, /^const \{ createAvatarForgeHandlers \} = require/m);
    assert.match(index, /db\.doc\(SECRETARY_ROLE_DOC\)\.get\(\)\r?\n  \]\);/);
    assert.match(index, /caller\.secretaryRoleSnap \|\|/);
});
