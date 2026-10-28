import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildSchoolCalendar,
    builtInDaysForSchoolYear,
    describeSchoolDay,
    orthodoxEasterIso,
    parseCalendarSettings,
    setSchoolCalendarSource,
    suggestLocalFeast,
} from '../utils/schoolCalendar.mjs';

const NOW = { now: new Date(2026, 9, 28), yearsBack: 0, yearsAhead: 0 };
const closedOn = (cal, iso) => cal.ranges.find((r) => iso >= r.start && iso <= r.end) || null;

test('Orthodox Easter lands on the right Sundays', () => {
    assert.equal(orthodoxEasterIso(2026), '2026-04-12');
    assert.equal(orthodoxEasterIso(2027), '2027-05-02');
    assert.equal(orthodoxEasterIso(2028), '2028-04-16');
});

test('the 2026-27 frontistirio year closes on the days the law sets', () => {
    const cal = buildSchoolCalendar([], NOW);
    ['2026-10-28', '2026-11-17', '2026-12-24', '2027-01-02', '2027-01-06', '2027-03-15', '2027-03-25', '2027-06-21', '2027-08-15']
        .forEach((iso) => assert.ok(closedOn(cal, iso), `${iso} should be closed`));
    // Three Hierarchs was dropped for frontistiria in 2024: marked, lessons on.
    assert.equal(closedOn(cal, '2027-01-30'), null);
    assert.equal(describeSchoolDay('2027-01-30', cal).headline.name, 'Three Hierarchs Day');
    // Christmas ends on 2 January; 3-5 January are school days.
    assert.equal(closedOn(cal, '2027-01-04'), null);
});

test('the Easter break runs two weeks, Holy Monday to Thomas Sunday', () => {
    const cal = buildSchoolCalendar([], NOW);
    const easter = cal.ranges.find((r) => r.key === 'easter-break');
    assert.equal(easter.start, '2027-04-26');
    assert.equal(easter.end, '2027-05-09');
    assert.equal(describeSchoolDay('2027-04-30', cal).headline.name, 'Good Friday');
    assert.equal(describeSchoolDay('2027-05-10', cal).breakEdge.edge, 'back-from');
});

test('closures never overlap, so a day is never counted twice', () => {
    const cal = buildSchoolCalendar([{ id: 'x', name: 'Autumn break', start: '2026-10-26', end: '2026-10-30' }], NOW);
    const days = new Set();
    cal.ranges.forEach((r) => {
        for (let d = new Date(`${r.start}T00:00:00Z`); d <= new Date(`${r.end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
            const iso = d.toISOString().slice(0, 10);
            assert.ok(!days.has(iso), `${iso} owned twice`);
            days.add(iso);
        }
    });
    // The school's own break owns those days, but 28 October is still named on the day.
    assert.equal(closedOn(cal, '2026-10-28').name, 'Autumn break');
    assert.equal(describeSchoolDay('2026-10-28', cal).headline.name, 'Ohi Day');
});

test("a School Office break replaces the built-in break it overlaps", () => {
    const cal = buildSchoolCalendar([{ id: 'xmas', name: 'Christmas', type: 'christmas', start: '2026-12-22', end: '2027-01-06' }], NOW);
    assert.equal(cal.ranges.filter((r) => r.key === 'christmas-break').length, 0);
    assert.equal(closedOn(cal, '2026-12-22').name, 'Christmas');
});

test('School Office choices: lessons on, hidden, open days, whole calendar off', () => {
    const raw = [
        { id: 'a', kind: 'calendar-rule', key: 'polytechnic', mode: 'marked' },
        { id: 'b', kind: 'calendar-rule', key: 'halloween', mode: 'off' },
        { id: 'c', kind: 'school-day', date: '2026-10-28' },
    ];
    const cal = buildSchoolCalendar(raw, NOW);
    assert.equal(closedOn(cal, '2026-11-17'), null);
    assert.equal(describeSchoolDay('2026-11-17', cal).headline.name, 'Polytechnic Day');
    assert.equal(describeSchoolDay('2026-10-31', cal).headline, null);
    assert.equal(closedOn(cal, '2026-10-28'), null);
    assert.equal(describeSchoolDay('2026-10-28', cal).openDay, true);

    const off = buildSchoolCalendar([{ id: 'g', kind: 'calendar-rule', key: 'greek', mode: 'off' }], NOW);
    assert.equal(off.ranges.length, 0);
    // Rule entries are never mistaken for breaks.
    assert.equal(parseCalendarSettings(raw).manual.length, 0);
});

test("the town's patron saint closes the school, found from its location", () => {
    assert.equal(suggestLocalFeast('Thessaloniki, Greece').key, 'local-thessaloniki');
    assert.equal(suggestLocalFeast('Πάτρα').key, 'local-patras');
    assert.equal(suggestLocalFeast('Volos'), null);
    const cal = buildSchoolCalendar([], { ...NOW, locationName: 'Thessaloniki' });
    assert.equal(closedOn(cal, '2026-10-26').name, 'Saint Demetrius Day');
    assert.equal(closedOn(buildSchoolCalendar([], NOW), '2026-10-26'), null);
});

test('every built-in day has a name, a Greek name, an icon and a story', () => {
    builtInDaysForSchoolYear(2026).forEach((d) => {
        assert.ok(d.name && d.nameEl && d.icon && d.blurb && d.theme, d.key);
        assert.match(d.start, /^\d{4}-\d{2}-\d{2}$/);
    });
});

test('lessons stop on holidays everywhere, but a one-time lesson still runs', async () => {
    setSchoolCalendarSource([]);
    const { getClassesOnDay, doesClassMeetOnDate } = await import('../utils.js');
    const classes = [{ id: 'c1', name: 'A', scheduleDays: ['3'] }];
    assert.equal(getClassesOnDay('28-10-2026', classes, [], {}).length, 0);
    assert.equal(getClassesOnDay('04-11-2026', classes, [], {}).length, 1);
    const makeup = [{ classId: 'c1', date: '28-10-2026', type: 'one-time' }];
    assert.equal(getClassesOnDay('28-10-2026', classes, makeup, {}).length, 1);
    assert.equal(doesClassMeetOnDate('c1', '28-10-2026', classes, makeup, [{ start: '2026-10-28', end: '2026-10-28' }]), true);
});
