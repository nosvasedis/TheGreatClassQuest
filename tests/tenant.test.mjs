import test from 'node:test';
import assert from 'node:assert/strict';

import * as tenant from '../utils/tenant.mjs';

test('defaults to the founding school so existing data stays where it is', () => {
    tenant.resetSchoolId();
    assert.equal(tenant.getSchoolId(), 'great-class-quest');
    assert.equal(tenant.PUBLIC_DATA_PATH, 'artifacts/great-class-quest/public/data');
    assert.equal(tenant.dataPath('students'), 'artifacts/great-class-quest/public/data/students');
    assert.equal(tenant.dataPath(), 'artifacts/great-class-quest/public/data');
});

test('PUBLIC_DATA_PATH is a live binding that follows setSchoolId', () => {
    tenant.setSchoolId('alpha-patras');
    assert.equal(tenant.PUBLIC_DATA_PATH, 'artifacts/alpha-patras/public/data');
    assert.equal(tenant.dataPath('/classes/c1'), 'artifacts/alpha-patras/public/data/classes/c1');
    tenant.resetSchoolId();
    assert.equal(tenant.PUBLIC_DATA_PATH, 'artifacts/great-class-quest/public/data');
});

test('rejects ids that could escape the school root', () => {
    for (const bad of ['', '../x', 'a/b', 'A B', '-x', 'x-', 'a'.repeat(64), null, undefined]) {
        assert.equal(tenant.normalizeSchoolId(bad), null, String(bad));
        assert.throws(() => tenant.setSchoolId(bad));
    }
    assert.equal(tenant.getSchoolId(), 'great-class-quest');
    assert.equal(tenant.normalizeSchoolId('  Alpha-1 '), 'alpha-1');
});

test('profiles without a schoolId belong to the founding school', () => {
    assert.equal(tenant.resolveProfileSchoolId({}), 'great-class-quest');
    assert.equal(tenant.resolveProfileSchoolId(null), 'great-class-quest');
    assert.equal(tenant.resolveProfileSchoolId({ schoolId: 'beta' }), 'beta');
    assert.equal(tenant.resolveProfileSchoolId({ schoolId: '../evil' }), null);
});

import { createRequire } from 'node:module';
const serverTenant = createRequire(import.meta.url)('../functions/tenant.js');

test('functions: outside a call the founding school is used, exactly as before', () => {
    assert.equal(serverTenant.currentSchoolId(), 'great-class-quest');
    assert.equal(serverTenant.dataRoot(), 'artifacts/great-class-quest/public/data');
    assert.equal(serverTenant.isFoundingSchool(), true);
});

test('functions: work awaited inside runInSchool keeps its school, and calls never mix', async () => {
    const seen = [];
    const visit = (id, delay) => serverTenant.runInSchool(id, async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        seen.push([id, serverTenant.dataRoot()]);
    });
    await Promise.all([visit('school-a', 15), visit('school-b', 1), visit('great-class-quest', 5)]);
    assert.deepEqual(seen.sort(), [
        ['great-class-quest', 'artifacts/great-class-quest/public/data'],
        ['school-a', 'artifacts/school-a/public/data'],
        ['school-b', 'artifacts/school-b/public/data'],
    ]);
    assert.equal(serverTenant.currentSchoolId(), 'great-class-quest');
});

test('functions: profile and id validation match the browser', () => {
    assert.throws(() => serverTenant.runInSchool('../x', () => {}));
    assert.equal(serverTenant.resolveProfileSchoolId({}), 'great-class-quest');
    assert.equal(serverTenant.resolveProfileSchoolId({ schoolId: 'school-b' }), 'school-b');
    assert.equal(serverTenant.resolveProfileSchoolId({ schoolId: 'Bad/Id' }), null);
});
