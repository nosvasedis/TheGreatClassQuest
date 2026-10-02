import test from 'node:test';
import assert from 'node:assert/strict';
import { TRIAL_TYPES, TRIAL_TYPE_GUIDE, getTrialTypeMeta, normalizeTrialType } from '../features/trialTypesCore.mjs';

test('a dictation is a written vocabulary check, never listening or oral', () => {
    assert.equal(TRIAL_TYPES.dictation.label, 'Dictation');
    assert.equal(TRIAL_TYPES.dictation.plural, 'Dictations');
    assert.match(TRIAL_TYPES.dictation.about, /written vocabulary check/i);
    assert.doesNotMatch(TRIAL_TYPES.dictation.icon, /microphone/);
    assert.match(TRIAL_TYPE_GUIDE, /dictation is a written vocabulary check/i);
    assert.match(TRIAL_TYPE_GUIDE, /never a listening, speaking or oral task/i);
});

test('stored trial ids and labels normalise to the two canonical types', () => {
    assert.equal(normalizeTrialType('dictation'), 'dictation');
    assert.equal(normalizeTrialType('Dictation'), 'dictation');
    assert.equal(normalizeTrialType('test'), 'test');
    assert.equal(normalizeTrialType(undefined), 'test');
    assert.equal(getTrialTypeMeta('dictation').id, 'dictation');
    assert.equal(getTrialTypeMeta('test').plural, 'Tests');
});
