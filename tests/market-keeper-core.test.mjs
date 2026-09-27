import test from 'node:test';
import assert from 'node:assert/strict';
import {
    firstName,
    goldNeeded,
    keeperWelcomeLine,
    keeperGreetingLine,
    keeperWareLine,
    keeperPurchaseLine,
    keeperFailLine,
    sortWareEntries,
    salePercent
} from '../features/marketKeeperCore.mjs';

test('firstName and goldNeeded', () => {
    assert.equal(firstName('  Eleni Papadopoulou '), 'Eleni');
    assert.equal(firstName(''), 'traveller');
    assert.equal(goldNeeded(12, 30), 18);
    assert.equal(goldNeeded(40, 30), 0);
    assert.equal(goldNeeded(undefined, '15'), 15);
});

test('welcome line is stable for a seed', () => {
    assert.equal(keeperWelcomeLine('7'), keeperWelcomeLine('7'));
    assert.ok(keeperWelcomeLine('x').length > 10);
});

test('greeting reflects hero, voucher, legend, empty purse and reach', () => {
    assert.match(keeperGreetingLine({ studentName: 'Nikos K', gold: 20, isHero: true }), /Hero of the Day, Nikos/);
    assert.match(keeperGreetingLine({ studentName: 'Nikos', gold: 20, voucherPercent: 50 }), /50% off/);
    assert.match(keeperGreetingLine({ studentName: 'Nikos', gold: 20, legendLabel: 'Golden Legend', legendDiscount: 10 }), /Golden Legend.*10%/);
    assert.match(keeperGreetingLine({ studentName: 'Nikos', gold: 0 }), /purse is empty/);
    assert.match(keeperGreetingLine({ studentName: 'Nikos', gold: 5, affordableCount: 0, totalCount: 9 }), /Nothing is in reach/);
    assert.match(keeperGreetingLine({ studentName: 'Nikos', gold: 500, affordableCount: 9, totalCount: 9 }), /Everything/);
    assert.match(keeperGreetingLine({ studentName: 'Nikos', gold: 30, affordableCount: 1, totalCount: 9 }), /1 ware is within/);
    assert.match(keeperGreetingLine({ studentName: 'Nikos', gold: 30, affordableCount: 4, totalCount: 9 }), /4 wares are within/);
});

test('ware lines per state', () => {
    assert.match(keeperWareLine({ name: 'Elixir of Luck', state: 'affordable', finalPrice: 30 }), /Elixir of Luck/);
    assert.match(keeperWareLine({ name: 'Elixir of Luck', state: 'short', finalPrice: 30, gold: 12 }), /Save 18 more/);
    assert.match(keeperWareLine({ name: 'Ember Drake', state: 'owned', kind: 'familiar' }), /One Familiar per hero/);
    assert.match(keeperWareLine({ name: 'Mask', state: 'owned' }), /already own the Mask/);
    assert.match(keeperWareLine({ name: 'Mask', state: 'limit' }), /limit/);
    assert.match(keeperWareLine({ name: 'Mask' }), /Choose a shopper/);
    assert.match(keeperWareLine({ name: 'Ember Drake', state: 'affordable', kind: 'familiar' }), /hatches/);
});

test('purchase and failure lines', () => {
    assert.match(keeperPurchaseLine({ studentName: 'Maria', itemName: 'Quill', soldOut: true }), /last Quill.*Maria/);
    assert.match(keeperPurchaseLine({ studentName: 'Maria', itemName: 'Quill' }), /Maria/);
    assert.match(keeperFailLine('Not enough gold!'), /Not enough gold!/);
    assert.match(keeperFailLine(''), /jammed/);
});

test('sortWareEntries sorts without mutating', () => {
    const input = [
        { name: 'b', price: 20 },
        { name: 'a', price: 20 },
        { name: 'c', price: 5 }
    ];
    assert.deepEqual(sortWareEntries(input).map(e => e.name), ['c', 'a', 'b']);
    assert.deepEqual(sortWareEntries(input, 'price-desc').map(e => e.name), ['a', 'b', 'c']);
    assert.deepEqual(sortWareEntries(input, 'name').map(e => e.name), ['a', 'b', 'c']);
    assert.equal(input[0].name, 'b');
    assert.deepEqual(sortWareEntries(null), []);
});

test('salePercent', () => {
    assert.equal(salePercent(40, 30), 25);
    assert.equal(salePercent(40, 40), 0);
    assert.equal(salePercent(0, 0), 0);
});
