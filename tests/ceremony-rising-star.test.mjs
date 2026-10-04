import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRisingStar, buildCeremonySnapshot } from '../features/ceremonyDomain.js';

const kid = (id, current, previous, extra = {}) => ({ id, name: id, current, previous, hasPrevious: true, growthStarfalls: 0, ...extra });

test('Rising Star goes to the biggest climb, not the biggest total', () => {
  const pick = chooseRisingStar([kid('ana', 30, 28), kid('bo', 14, 5), kid('cy', 20, 15)]);
  assert.equal(pick.id, 'bo');
  assert.equal(pick.gain, 9);
});

test('the Prodigy is left out so the crown reaches someone new', () => {
  const pick = chooseRisingStar([kid('ana', 40, 10), kid('bo', 14, 5)], { excludeIds: ['ana'] });
  assert.equal(pick.id, 'bo');
});

test('Growth Starfalls count, and are all that counts without a previous month', () => {
  const pick = chooseRisingStar([kid('ana', 10, 0, { hasPrevious: false, growthStarfalls: 2 }), kid('bo', 30, 0, { hasPrevious: false })]);
  assert.equal(pick.id, 'ana');
  assert.equal(pick.previous, null);
  assert.equal(pick.growth, 4);
});

test('no Rising Star when nobody grew enough', () => {
  assert.equal(chooseRisingStar([kid('ana', 10, 9), kid('bo', 5, 6)]), null);
});

test('the Rising Star rides in the public sequence of a Classic Arena snapshot', () => {
  const snap = buildCeremonySnapshot({ classId: 'c', questLeague: 'A', monthKey: '2026-10', risingStar: { id: 'bo' } });
  assert.equal(snap.publicSequence.risingStar.id, 'bo');
});
