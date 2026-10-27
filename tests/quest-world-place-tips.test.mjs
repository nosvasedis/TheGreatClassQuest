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
    assert.match(placeTipHtml(portal), /Inside the Portal/);
    assert.equal(describePlace('portal', parties).status, 'ahead');
});

test('only parties that stepped through are inside; a full party still outside waits at the gate', () => {
    const map = [
        { name: 'Inside', logo: '🦉', progress: 100, inside: true },
        { name: 'AtGate', logo: '🦊', progress: 100, inside: false },
        { name: 'Road', logo: '📚', progress: 50, inside: false }
    ];
    const portal = describePlace('portal', map);
    assert.deepEqual(portal.here.map((p) => p.name), ['Inside']);
    assert.deepEqual(portal.gate.map((p) => p.name), ['AtGate']);
    const html = placeTipHtml(portal);
    assert.match(html, /Inside the Portal/);
    // The card follows the party at the gate, so it says so there rather than in a second list.
    assert.equal(portal.focus.name, 'AtGate');
    assert.match(html, /at the gate/);
    const two = describePlace('portal', [...map, { name: 'AlsoGate', logo: '🐸', progress: 100, inside: false }]);
    assert.match(placeTipHtml(two), /Waiting at the sealed gate/);
    assert.deepEqual(describePlace('crystal', map).here.map((p) => p.name), ['AtGate']);
    // Every party inside is named, never "+N".
    const many = Array.from({ length: 6 }, (_, i) => ({ name: `C${i}`, progress: 100, inside: true }));
    const tip = placeTipHtml(describePlace('portal', many));
    assert.doesNotMatch(tip, /chip--more/);
    assert.match(tip, /6 parties inside the Portal/);
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

test('the Portal card counts the stars this class still needs, then its runes', () => {
    const runes = [
        { id: 'virtues', short: 'Four Virtues', icon: 'fa-clover', met: true },
        { id: 'lanterns', short: 'Lanterns', icon: 'fa-fire-flame-curved', met: false }
    ];
    const map = [
        { name: 'Owls', logo: '🦉', progress: 92, stars: 129, goal: 140, inside: false, isLeader: true },
        { name: 'Books', logo: '📚', progress: 79, stars: 111, goal: 140, inside: false, isMine: true, portal: { state: 'road', runes } }
    ];
    const portal = describePlace('portal', map);
    assert.equal(portal.focus.name, 'Books');
    assert.equal(portal.focus.starsLeft, 29);
    assert.equal(portal.chaser.name, 'Owls');
    assert.equal(portal.chaser.starsLeft, 11);
    const html = placeTipHtml(portal);
    assert.match(html, /<b>29<\/b><span>stars to go<em>111 of 140★<\/em>/);
    assert.match(html, /Then one rune to light/);
    assert.match(html, /tq-tip__rune is-lit/);
    assert.match(html, /11★ to go/);
    assert.doesNotMatch(html, /leading party is/);
});

test('a class with every star but a sleeping rune waits at the gate, never "100%" on the road', () => {
    const sealed = describePlace('portal', [{
        name: 'Books', logo: '📚', progress: 100, stars: 140, goal: 140, inside: false, isMine: true,
        portal: { state: 'sealed', runes: [{ id: 'virtues', short: 'Four Virtues', icon: 'fa-clover', met: false }] }
    }]);
    assert.equal(sealed.focus.starsMet, true);
    const html = placeTipHtml(sealed);
    assert.match(html, /Stars gathered/);
    assert.match(html, /One rune still sleeps/);
    const nearly = describePlace('portal', [{ name: 'Owls', logo: '🦉', progress: 99.8, stars: 139.7, goal: 140, isMine: true }]);
    assert.equal(nearly.focus.percent, 99);
    assert.equal(nearly.focus.starsLeft, 1);
    assert.match(placeTipHtml(nearly), /star to go/);
});
