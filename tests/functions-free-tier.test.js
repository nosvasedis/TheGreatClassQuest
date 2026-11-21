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
    assert.match(index, /const CALLABLE_MEMORY = '1GiB'/);
    assert.doesNotMatch(index, /^const \{ getStorage \} = require/m);
    assert.doesNotMatch(index, /^const \{ createAvatarForgeHandlers \} = require/m);
    assert.match(index, /db\.doc\(secretaryRoleDoc\(\)\)\.get\(\)\r?\n {2}\]\);/);
    assert.match(index, /caller\.secretaryRoleSnap \|\|/);
});

test('callables overlap their reads instead of waiting on each one in turn', () => {
    const index = read('functions/index.js');
    // Every signed-in call starts its permission reads on arrival, and checks the caller once.
    // The caller's school comes first (from their own profile); the reads then start inside it.
    assert.match(index, /const schoolId = await resolveCallSchoolId\(request\);/);
    assert.match(index, /prefetchCallerReads\(request\);\r?\n {6}return handler\(request\);/);
    assert.match(index, /request\.profileRead \|\| db\.collection\(PROFILE_COLLECTION\)/);
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

test('every function is 2nd gen on Node.js 24 with a full CPU, a cost cap and safe sharing', () => {
    const index = read('functions/index.js');
    const pkg = JSON.parse(read('functions/package.json'));
    assert.equal(pkg.engines.node, '24');
    // 1st gen cannot run Node.js 24, so nothing may use the v1 SDK any more.
    for (const file of ['functions/index.js', 'functions/adventurePicture.js', 'functions/avatarForge.js', 'functions/billing/billing.js', 'functions/platform.js', 'functions/platformAdmin.js']) {
        assert.doesNotMatch(read(file), /firebase-functions\/v1|functionsV1|\.runWith\(|pubsub\.schedule/, file);
    }
    // One full CPU, never more than 20 instances, light calls share a warm instance and heavy
    // work (pictures, exports, purges, nightly jobs) gets an instance to itself.
    assert.match(index, /const RUNTIME_DEFAULTS = Object\.freeze\(\{ cpu: 1, maxInstances: 20 \}\);/);
    assert.match(index, /const LIGHT_CONCURRENCY = 16;/);
    assert.match(index, /const HEAVY_CONCURRENCY = 1;/);
    assert.match(index, /region: FUNCTIONS_REGION,\s*\.\.\.RUNTIME_DEFAULTS,\s*concurrency: isHeavy\(options\) \? HEAVY_CONCURRENCY : LIGHT_CONCURRENCY/);
    assert.match(index, /functionOptions\(\{ \.\.\.options, heavy: true \}\), schedule, timeZone/);
    assert.match(index, /exports\.saveStudentAvatar = callable\([^)]*\)[^]*?heavy: true/);
    // Sharing an instance is only safe because the school of each call is per-request.
    assert.match(read('functions/tenant.js'), /new AsyncLocalStorage\(\)/);
    // Firestore over REST: a faster first call after a cold start.
    assert.match(index, /const db = getFirestore\(\);\r?\ndb\.settings\(\{ preferRest: true \}\);/);
    // 2nd gen memory sizes are written in MiB / GiB.
    assert.doesNotMatch(index, /memory: '\d+(MB|GB)'/);
    // Every export goes through a wrapper that applies the parity options (or is the one trigger
    // that was 2nd gen already).
    const exportsFound = [...index.matchAll(/^\s*exports\.(\w+) = (\w+)\(/gm)];
    assert.ok(exportsFound.length >= 55);
    for (const [, name, builder] of exportsFound) {
        assert.ok(['callable', 'scheduled', 'onRequest', 'onDocumentCreated'].includes(builder), `${name} uses ${builder}`);
    }
    // A failed night is not retried, as with the old Pub/Sub schedules.
    assert.match(index, /schedule, timeZone, retryCount: 0/);
});
