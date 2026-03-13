import test from 'node:test';
import assert from 'node:assert/strict';

import { getFamiliarVariant, normalizeFamiliarName } from '../features/familiarIdentity.mjs';

test('familiar variants are deterministic per student and type', () => {
    const a = getFamiliarVariant('emberfang', 'student-1');
    const b = getFamiliarVariant('emberfang', 'student-1');
    const keys = new Set([
        getFamiliarVariant('emberfang', 'student-1').key,
        getFamiliarVariant('emberfang', 'student-2').key,
        getFamiliarVariant('emberfang', 'student-3').key,
        getFamiliarVariant('emberfang', 'student-4').key
    ]);

    assert.deepEqual(a, b);
    assert.ok(keys.size >= 2);
});

test('familiar name normalization trims and caps length', () => {
    assert.equal(normalizeFamiliarName('   Sir   Fluff   '), 'Sir Fluff');
    assert.equal(normalizeFamiliarName('123456789012345678901234567890'), '123456789012345678901234');
});
