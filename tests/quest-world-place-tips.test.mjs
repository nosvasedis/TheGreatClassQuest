import test from 'node:test';
import assert from 'node:assert/strict';

import { describePlace, placeTipHtml } from '../features/questWorld/placeTips.mjs';

const parties = [
    { name: 'Junior A', logo: '🦉', progress: 72 },
    { name: 'Junior B', logo: '📚', progress: 64, isMine: true },
    { name: 'Junior C', logo: '🌟', progress: 41 },
    { name: 'Junior D', logo: '🦊', progress: 12 }
];

test('a realm card lists the parties standing in it, leader first', () => {
    const gold = describePlace('gold', parties);
    assert.equal(gold.title, 'Golden Citadel');
    assert.equal(gold.status, 'here');
    assert.deepEqual(gold.here.map((p) => p.name), ['Junior A', 'Junior B']);
    assert.equal(gold.from, 'From 60% of the month’s goal');
    const bronze = describePlace('bronze', parties);
    assert.deepEqual(bronze.here.map((p) => p.name), ['Junior D']);
    assert.equal(bronze.from, 'Where every quest begins');
});

test('a realm nobody has reached says how far the leader still is', () => {
    const crystal = describePlace('crystal', parties);
    assert.equal(crystal.status, 'ahead');
    assert.equal(crystal.gap, 13);
    assert.match(placeTipHtml(crystal), /leading party is 13% away/);
});

test('a realm every party has left says so', () => {
    const late = parties.map((p) => ({ ...p, progress: p.progress + 40 }));
    assert.equal(describePlace('bronze', late).status, 'passed');
    assert.match(placeTipHtml(describePlace('bronze', late)), /Every party has passed through/);
});

test('the Portal card counts the parties who stepped through', () => {
    const portal = describePlace('portal', [...parties, { name: 'Finishers', logo: '🐉', progress: 100 }]);
    assert.equal(portal.title, 'The Crystal Portal');
    assert.deepEqual(portal.here.map((p) => p.name), ['Finishers']);
    assert.match(placeTipHtml(portal), /Stepped through/);
    assert.equal(describePlace('portal', parties).status, 'ahead');
});

test('the card escapes names and marks the active class', () => {
    const html = placeTipHtml(describePlace('gold', [{ name: '<b>x</b>', logo: '"', progress: 70, isMine: true }]), { badge: 'a.webp' });
    assert.doesNotMatch(html, /<b>x<\/b>/);
    assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
    assert.match(html, /tq-tip__chip is-mine/);
    assert.match(html, /src="a\.webp"/);
});

test('a crowded realm shows four chips and a count for the rest', () => {
    const crowd = Array.from({ length: 7 }, (_, i) => ({ name: `C${i}`, progress: 65 }));
    const html = placeTipHtml(describePlace('gold', crowd));
    assert.equal((html.match(/class="tq-tip__chip"/g) || []).length, 4);
    assert.match(html, /\+3/);
    assert.match(html, /7 parties here now/);
});
