import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAudience, audienceIncludes, bountyStarsFromAward, describeAudience, audienceShare } from '../features/bountyAudience.mjs';

const students = new Map([
    ['a', { id: 'a', guildId: 'owl_wisdom' }],
    ['b', { id: 'b', guildId: 'dragon_flame' }],
    ['c', { id: 'c', guildId: 'owl_wisdom' }]
]);

test('old bounties without an audience stay whole-class', () => {
    assert.equal(normalizeAudience({ title: 'x' }).kind, 'class');
    assert.equal(bountyStarsFromAward({}, 3, null, students), 3);
    assert.equal(describeAudience({}).short, 'Whole class');
});

test('a guild bounty only counts its own heroes', () => {
    const bounty = { audience: { kind: 'guild', guildId: 'owl_wisdom' } };
    assert.equal(audienceIncludes(bounty, students.get('a')), true);
    assert.equal(audienceIncludes(bounty, students.get('b')), false);
    assert.equal(bountyStarsFromAward(bounty, 1, ['b'], students), 0);
    assert.equal(bountyStarsFromAward(bounty, 3, ['a', 'b', 'c'], students), 2);
    assert.equal(bountyStarsFromAward(bounty, 2, null, students), 0);
});

test('a chosen-heroes bounty counts only the picked heroes', () => {
    const bounty = { audience: { kind: 'heroes', studentIds: ['b', 'c', 'c'] } };
    assert.deepEqual(normalizeAudience(bounty).studentIds, ['b', 'c']);
    assert.equal(bountyStarsFromAward(bounty, 1.5, ['c'], students), 1.5);
    assert.equal(bountyStarsFromAward(bounty, 1, ['a'], students), 0);
    assert.equal(describeAudience(bounty).short, '2 heroes');
});

test('an empty heroes list falls back to whole class', () => {
    assert.equal(normalizeAudience({ audience: { kind: 'heroes', studentIds: [] } }).kind, 'class');
});

test('group targets scale with the group share', () => {
    assert.equal(audienceShare(5, 20), 0.25);
    assert.equal(audienceShare(1, 20), 0.2);
    assert.equal(audienceShare(0, 0), 1);
});
