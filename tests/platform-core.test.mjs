import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

import { suggestSchoolCode } from '../features/operatorConsoleCore.mjs';
import { parseSchoolCodeFromLocation } from '../utils/deviceSchool.mjs';

const require = createRequire(import.meta.url);
const core = require('../functions/platformCore.cjs');
const presets = require('../functions/tierPresets.js');

test('the Functions copy of the plan presets matches config/tiers exactly', () => {
    for (const tier of ['pending', 'starter', 'pro', 'elite', 'expired']) {
        const source = JSON.parse(fs.readFileSync(new URL(`../config/tiers/${tier}.json`, import.meta.url), 'utf8'));
        assert.deepEqual(presets[tier], source, tier);
    }
});

test('a new school needs a name, a free code and a known plan', () => {
    assert.deepEqual(core.validateNewSchool({ name: '  Alpha   School ', schoolId: 'Alpha-Patras', tier: 'PRO' }),
        { name: 'Alpha School', schoolId: 'alpha-patras', tier: 'pro', endsAt: null });
    assert.throws(() => core.validateNewSchool({ name: 'A', schoolId: 'alpha', tier: 'pro' }), /name/);
    assert.throws(() => core.validateNewSchool({ name: 'Alpha', schoolId: 'great-class-quest', tier: 'pro' }), /reserved/);
    assert.throws(() => core.validateNewSchool({ name: 'Alpha', schoolId: 'ab', tier: 'pro' }), /3 to 63/);
    assert.throws(() => core.validateNewSchool({ name: 'Alpha', schoolId: 'a/b', tier: 'pro' }), /3 to 63/);
    assert.throws(() => core.validateNewSchool({ name: 'Alpha', schoolId: 'alpha', tier: 'gold' }), /plan/);
    assert.equal(core.validateNewSchool({ name: 'Alpha', schoolId: 'alpha', tier: 'elite', endsAt: '2027-06-30' }).endsAt, '2027-06-30T23:59:59.000Z');
    assert.throws(() => core.parsePlanEnd('30/06/2027'), /2027-06-30/);
});

test('a school plan is the tier preset plus its end date', () => {
    const plan = core.buildSchoolPlan('elite', '2027-06-30T23:59:59.000Z', presets);
    assert.equal(plan.tier, 'elite');
    assert.equal(plan.eliteAI, true);
    assert.equal(plan.endsAt, '2027-06-30T23:59:59.000Z');
    assert.equal('endsAt' in core.buildSchoolPlan('pro', null, presets), false);
});

test('teacher codes are readable, hashed per school and checked in constant time', () => {
    const code = core.generateJoinCode();
    assert.match(code, /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    const hash = core.hashJoinCode('alpha', code);
    assert.notEqual(hash, core.hashJoinCode('beta', code));
    assert.equal(core.joinCodeMatches('alpha', code.toLowerCase().replace('-', ' '), hash), true);
    assert.equal(core.joinCodeMatches('beta', code, hash), false);
    assert.equal(core.joinCodeMatches('alpha', 'WRONG-CODE1', hash), false);
    assert.equal(core.joinCodeMatches('alpha', code, undefined), false);
});

test('the console suggests a Latin school code from a Greek or English name', () => {
    assert.equal(suggestSchoolCode('Φροντιστήριο Άλφα Πάτρας'), 'frontistirio-alfa-patras');
    assert.equal(suggestSchoolCode('Prodigies Language School!'), 'prodigies-language-school');
    assert.equal(suggestSchoolCode('  '), '');
});

test('a school link picks the device school from ?school= or the #fragment', () => {
    assert.equal(parseSchoolCodeFromLocation('?school=Alpha-Patras', ''), 'alpha-patras');
    assert.equal(parseSchoolCodeFromLocation('', '#secretary-setup=tok&school=beta'), 'beta');
    assert.equal(parseSchoolCodeFromLocation('?school=../evil', ''), null);
    assert.equal(parseSchoolCodeFromLocation('', '#secretary-setup=tok'), null);
});

test('the family sign-in link keeps another school on its own gate', async () => {
    const { getParentLoginUrl } = await import('../features/familyAccessKit.js');
    assert.equal(getParentLoginUrl('https://x.io/app/index.html?school=a#z', 'great-class-quest'), 'https://x.io/app/?login=parent');
    assert.equal(getParentLoginUrl('https://x.io/app/', 'alpha-patras'), 'https://x.io/app/?school=alpha-patras&login=parent');
});
