import test from 'node:test';
import assert from 'node:assert/strict';
import {
    orthodoxEaster, ruleDate, findNameday, namedaysOn, applyMovableNamedays, namedayToStore, nameSoundKeys, NAMEDAY_ENTRIES
} from '../features/namedayCalendar.mjs';

test('Orthodox Easter matches known dates', () => {
    assert.deepEqual(orthodoxEaster(2024), [5, 5]);
    assert.deepEqual(orthodoxEaster(2025), [4, 20]);
    assert.deepEqual(orthodoxEaster(2026), [4, 12]);
    assert.deepEqual(orthodoxEaster(2027), [5, 2]);
    assert.deepEqual(orthodoxEaster(2028), [4, 16]);
});

test('Saint George moves to Easter Monday when 23 April is before Easter', () => {
    assert.equal(ruleDate('george', 2024), '05-06');
    assert.equal(ruleDate('george', 2026), '04-23');
    assert.equal(ruleDate('george', 2027), '05-03');
    assert.equal(ruleDate('mark', 2027), '05-04');
    assert.equal(ruleDate('easter+7', 2026), '04-19');
});

test('names are found in Greek, Greeklish and English', () => {
    const cases = [
        ['Γιώργος Παπαδόπουλος', 'george'], ['Giorgos', 'george'], ['Yiorgos', 'george'], ['George', 'george'],
        ['Γιάννης', '01-07'], ['Yannis', '01-07'], ['Ioannis', '01-07'], ['John', '01-07'],
        ['ΒΑΣΩ', '01-01'], ['Vasiliki', '01-01'], ['Βασίλης', '01-01'],
        ['Κωνσταντίνα', '05-21'], ['Konstantinos', '05-21'], ['Eleni', '05-21'], ['Helen', '05-21'],
        ['Παναγιώτης', '08-15'], ['Maria', '08-15'], ['Δέσποινα', '08-15'],
        ['Δημήτρης', '10-26'], ['Dimitra', '10-26'], ['Ευάγγελος', '03-25'], ['Vangelis', '03-25'],
        ['Αγγελική', '11-08'], ['Angeliki', '11-08'], ['Aggeliki', '11-08'], ['Michalis', '11-08'],
        ['Νίκος', '12-06'], ['Nikoleta', '12-06'], ['Alexandros', '08-30'], ['Αλέξανδρος', '08-30'], ['Xenia', '01-24'],
        ['Christos', '12-25'], ['Hristos', '12-25'], ['Sophia', '09-17'], ['Fotis', '01-06'], ['Photis', '01-06'],
        ['Zoe', 'easter+5'], ['Θωμάς', 'easter+7'], ['Οδυσσέας', 'easter+56'], ['Andreas', '11-30'], ['Αντρέας', '11-30']
    ];
    for (const [name, rule] of cases) assert.equal(findNameday(name)?.rule, rule, name);
});

test('unknown names are not guessed', () => {
    assert.equal(findNameday('Kevin'), null);
    assert.equal(findNameday(''), null);
    assert.deepEqual(nameSoundKeys('   '), []);
});

test('every entry has a rule that resolves', () => {
    for (const [rule, feast, names] of NAMEDAY_ENTRIES) {
        assert.match(ruleDate(rule, 2027), /^\d{2}-\d{2}$/, feast);
        assert.ok(names.length > 0, feast);
    }
});

test('the projector lists the day\'s feasts', () => {
    const day = namedaysOn('2026-12-06');
    assert.ok(day.some((d) => d.names.includes('Νικόλαος')));
    assert.ok(namedaysOn('2027-05-03').some((d) => d.rule === 'george'));
    assert.ok(!namedaysOn('2027-04-23').some((d) => d.rule === 'george'));
});

test('moving name days follow the year and fixed ones stay', () => {
    const roster = [
        { id: 'a', name: 'Γιώργος', nameday: '0000-04-23', namedayRule: 'george' },
        { id: 'b', name: 'Νίκος', nameday: '0000-12-06' }
    ];
    const in2027 = applyMovableNamedays(roster, 2027);
    assert.equal(in2027[0].nameday, '0000-05-03');
    assert.equal(in2027[1], roster[1]);
    assert.equal(applyMovableNamedays(roster, 2026), roster);
});

test('what is stored keeps the teacher\'s choice', () => {
    assert.deepEqual(namedayToStore('Γιώργος', null, 2027), { nameday: '0000-05-03', namedayRule: 'george' });
    assert.deepEqual(namedayToStore('Γιώργος', '0000-05-03', 2027), { nameday: '0000-05-03', namedayRule: 'george' });
    assert.deepEqual(namedayToStore('Γιώργος', '0000-11-03', 2027), { nameday: '0000-11-03', namedayRule: null });
    assert.deepEqual(namedayToStore('Νίκος', null, 2027), { nameday: '0000-12-06', namedayRule: null });
    assert.deepEqual(namedayToStore('Kevin', null, 2027), { nameday: null, namedayRule: null });
});

test('the Greek year follows Easter', async () => {
    const { orthodoxSeasonOn } = await import('../features/namedayCalendar.mjs');
    assert.equal(orthodoxSeasonOn('2027-03-15')?.name, 'Clean Monday');
    assert.equal(orthodoxSeasonOn('2027-04-28')?.name, 'Holy Week');
    assert.equal(orthodoxSeasonOn('2027-05-02')?.name, 'Easter Sunday');
    assert.equal(orthodoxSeasonOn('2026-04-16')?.name, 'Easter Week');
    assert.equal(orthodoxSeasonOn('2026-10-28')?.name, 'Ohi Day');
    assert.equal(orthodoxSeasonOn('2026-10-12'), null);
});
