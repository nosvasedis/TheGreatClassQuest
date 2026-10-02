// features/trialTypesCore.mjs
// The two Scholar's Scroll trial types and what they mean. A dictation is a
// WRITTEN vocabulary check: learners write the words they have been given to
// show they understand them. It is never a listening, speaking or oral
// exercise. Every AI prompt that reads trial data shares the guide below.

export const TRIAL_TYPE_GUIDE =
    'A dictation is a written vocabulary check: learners write the given words to show they understand them. It is a written exercise, never a listening, speaking or oral task. A test is a broader written test of the lesson’s language.';

export const TRIAL_TYPES = Object.freeze({
    test: Object.freeze({
        id: 'test',
        label: 'Test',
        plural: 'Tests',
        icon: 'fa-file-signature',
        about: 'A written test of the lesson’s language.'
    }),
    dictation: Object.freeze({
        id: 'dictation',
        label: 'Dictation',
        plural: 'Dictations',
        icon: 'fa-spell-check',
        about: 'A written vocabulary check: learners write the given words to show they understand them.'
    })
});

/** Stored type ids are 'test' | 'dictation'; anything else reads as a test. */
export function normalizeTrialType(type) {
    return /dict/i.test(String(type || '')) ? 'dictation' : 'test';
}

export function getTrialTypeMeta(type) {
    return TRIAL_TYPES[normalizeTrialType(type)];
}
