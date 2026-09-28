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

test('callables overlap their reads instead of waiting on each one in turn', () => {
    const index = read('functions/index.js');
    // Every signed-in call starts its permission reads on arrival, and checks the caller once.
    assert.match(index, /prefetchCallerReads\(request\);\r?\n    return handler\(request\);/);
    assert.match(index, /request\.callerPromise = resolveAuthedCaller\(request\)/);
    // Permission failures are always reported before anything the other reads found.
    assert.match(index, /async function allInOrder\(promises\)/);
    assert.match(index, /const \[caller, student\] = await callerAnd\(request, getStudent\(studentId\)\)/);
    // The family snapshot reads everything at once; class-wide updates run several students at a time.
    assert.doesNotMatch(index, /const homeworkCount = await countPublishedHomework/);
    assert.match(index, /await forEachLimited\(studentsSnap\.docs, HOMEWORK_SYNC_CONCURRENCY/);
    assert.match(index, /await forEachLimited\(studentMeta, HOMEWORK_SYNC_CONCURRENCY/);
    // The Market reads the school-year record once per call.
    assert.match(index, /return \{ caller, yearKey \};/);
});
