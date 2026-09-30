import test from 'node:test';
import assert from 'node:assert/strict';
import {
    clockToMinutes,
    lessonMinutes,
    formatDuration,
    addMinutesToClock,
    normalizeDays,
    formatDayList,
    formatScheduleSummary,
    matchingDayPreset,
    validateCharter,
    changedFields,
    leagueChangeNote,
} from '../features/classCharterCore.mjs';

test('clock helpers', () => {
    assert.equal(clockToMinutes('17:30'), 1050);
    assert.equal(clockToMinutes('9:05'), 545);
    assert.equal(clockToMinutes('25:00'), null);
    assert.equal(clockToMinutes(''), null);
    assert.equal(lessonMinutes('17:00', '18:30'), 90);
    assert.equal(lessonMinutes('18:30', '17:00'), null);
    assert.equal(formatDuration(90), '1 h 30 min');
    assert.equal(formatDuration(45), '45 min');
    assert.equal(formatDuration(120), '2 h');
    assert.equal(addMinutesToClock('17:00', 90), '18:30');
    assert.equal(addMinutesToClock('23:30', 90), '23:59');
    assert.equal(addMinutesToClock('', 60), '');
});

test('days are Monday-first and read naturally', () => {
    assert.deepEqual(normalizeDays(['0', '3', '1', '3']), ['1', '3', '0']);
    assert.equal(formatDayList(['3', '1']), 'Mon & Wed');
    assert.equal(formatDayList(['1', '3', '5']), 'Mon, Wed & Fri');
    assert.equal(formatDayList(['2']), 'Tuesday');
    assert.equal(matchingDayPreset(['4', '2']), 'tue-thu');
    assert.equal(matchingDayPreset(['1']), null);
});

test('schedule summary', () => {
    assert.equal(formatScheduleSummary({ days: ['1', '3'], timeStart: '17:00', timeEnd: '18:30' }), 'Meets Mon & Wed · 17:00–18:30 (1 h 30 min)');
    assert.equal(formatScheduleSummary({}), 'No lesson days or times set yet.');
    assert.equal(formatScheduleSummary({ days: ['5'] }), 'Meets Friday');
    assert.equal(formatScheduleSummary({ timeStart: '10:00', timeEnd: '11:00' }), 'No lesson days set · 10:00–11:00 (1 h)');
});

test('validation', () => {
    assert.equal(validateCharter({ name: 'Owls', questLevel: 'B' }).ok, true);
    const bad = validateCharter({ name: ' ', questLevel: '', timeStart: '18:00', timeEnd: '17:00' });
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.name && bad.errors.level && bad.errors.time);
    assert.match(validateCharter({ name: 'x', questLevel: 'B', timeStart: '17:00' }).errors.time, /ends/);
});

test('change tracking ignores day order and surrounding spaces', () => {
    const original = { name: 'Owls', questLevel: 'B', logo: '🦉', scheduleDays: ['3', '1'], timeStart: '17:00', timeEnd: '18:00' };
    assert.deepEqual(changedFields(original, { ...original, name: ' Owls ', scheduleDays: ['1', '3'] }), []);
    assert.deepEqual(changedFields(original, { ...original, questLevel: 'C', timeEnd: '18:30' }), ['questLevel', 'timeEnd']);
});

test('league note only when the league moves', () => {
    assert.equal(leagueChangeNote('B', 'B'), '');
    assert.equal(leagueChangeNote('', 'B'), '');
    assert.match(leagueChangeNote('B', 'C'), /C Team Quest map/);
});
