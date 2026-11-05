import test from 'node:test';
import assert from 'node:assert/strict';

import { countQuestStations, describeQuestStanding, furthestStationIndex } from '../features/teamQuestStanding.mjs';

const entry = (progress, portal = null, stars = progress, goal = 100) => ({ progress, currentMonthlyStars: stars, goals: { diamond: goal }, portal });

test('a party on the road stands in its realm and names the next stop', () => {
    const s = describeQuestStanding(entry(71));
    assert.equal(s.place, 'road');
    assert.equal(s.realm.label, 'Golden Citadel');
    assert.equal(s.next.label, 'Crystal Realm');
    assert.equal(s.next.starsNeeded, 14);
    assert.equal(s.phase, 'land');
});

test('stars full but sealed waits at the Portal with the Portal line', () => {
    const s = describeQuestStanding(entry(104, { open: false, completed: false, state: 'sealed', runes: [{ id: 'virtues', met: false }] }));
    assert.equal(s.place, 'sealed');
    assert.equal(s.station, 'portal');
    assert.equal(s.next.locked, true);
    assert.match(s.next.label, /rune/);
    assert.equal(s.over, 4);
});

test('past the goal and through the Portal climbs the Starward Way', () => {
    const s = describeQuestStanding(entry(163, { open: true, completed: true }));
    assert.equal(s.place, 'sky');
    assert.equal(s.station, 'sky');
    assert.equal(s.realm.label, 'The Star Crown');
    assert.equal(s.next.label, 'Aurora Bridge');
    assert.equal(s.next.starsNeeded, 12);
    assert.equal(s.phase, 'sky');
    assert.ok(s.track > 60 && s.track < 64);
    assert.equal(s.over, 63);
});

test('just through the Portal is inside it, Moonstep next', () => {
    const s = describeQuestStanding(entry(100, { open: true, completed: true }));
    assert.equal(s.place, 'inside');
    assert.equal(s.next.label, 'Moonstep');
});

test('200% and more is home in the Celestial Palace, true share kept', () => {
    const s = describeQuestStanding(entry(214, { open: true, completed: true }));
    assert.equal(s.place, 'palace');
    assert.equal(s.next, null);
    assert.equal(s.track, 100);
    assert.equal(s.over, 114);
});

test('station counts and the furthest station', () => {
    const list = [entry(10), entry(50), entry(120, { open: true, completed: true }), entry(101)].map(describeQuestStanding);
    const counts = countQuestStations(list);
    assert.equal(counts.bronze, 1);
    assert.equal(counts.silver, 1);
    assert.equal(counts.sky, 1);
    assert.equal(counts.portal, 1);
    assert.equal(furthestStationIndex(list), 5);
});
