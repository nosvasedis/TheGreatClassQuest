import test from 'node:test';
import assert from 'node:assert/strict';
import { composeHomeGreeting, questNudge, skyMood, teacherInitial } from '../features/homeGreetingWords.mjs';

const tuesdayMorning = new Date(2026, 9, 27, 10, 0);

test('a class in view is greeted by its name, the general view greets the heroes', () => {
    const cls = composeHomeGreeting({ mode: 'class', className: 'Owls', part: 'morning', now: tuesdayMorning });
    assert.equal(cls.hello, 'Good Morning');
    assert.equal(cls.name, 'Owls');
    const all = composeHomeGreeting({ mode: 'general', part: 'morning', now: tuesdayMorning });
    assert.equal(all.name, 'Heroes');
    assert.notEqual(cls.line, all.line);
});

test('the evening after an early sunset is still Good Evening, never Good Night', () => {
    const g = composeHomeGreeting({ mode: 'class', className: 'Owls', part: 'night', now: new Date(2026, 11, 3, 18, 30) });
    assert.equal(g.hello, 'Good Evening');
});

test('the line follows the sky', () => {
    const rain = composeHomeGreeting({ mode: 'class', className: 'Owls', part: 'morning', scene: { condition: 'rain', precip: 'rain' }, now: tuesdayMorning });
    assert.equal(rain.mood, 'rain');
    assert.equal(rain.icon, 'fa-cloud-rain');
    const snow = composeHomeGreeting({ mode: 'class', className: 'Owls', part: 'morning', scene: { condition: 'snow' }, now: tuesdayMorning });
    assert.equal(snow.mood, 'snow');
    assert.notEqual(rain.key, snow.key);
    assert.equal(skyMood({ condition: 'clear', isNight: true, stars: true }), 'stars');
    assert.equal(skyMood({ condition: 'clear' }, { temp: 34 }), 'hot');
    assert.equal(skyMood({ condition: 'clear', isNight: true }, { temp: 34 }), 'night');
});

test('the same day, sky and class always give the same words (no flicker on redraw)', () => {
    const a = composeHomeGreeting({ mode: 'class', className: 'Owls', part: 'morning', scene: { condition: 'rain', precip: 'rain' }, now: tuesdayMorning });
    const b = composeHomeGreeting({ mode: 'class', className: 'Owls', part: 'morning', scene: { condition: 'rain', precip: 'rain' }, now: new Date(2026, 9, 27, 11, 40) });
    assert.equal(a.key, b.key);
});

test('young leagues get their own short lines', () => {
    const young = composeHomeGreeting({ mode: 'class', className: 'Junior A', young: true, part: 'morning', scene: { condition: 'snow' }, now: tuesdayMorning });
    assert.match(young.line, /snow/i);
    assert.equal(young.line, 'Look, snow! A magic day to play and learn!');
});

test('the month badge says how the quest stands', () => {
    const now = new Date(2026, 9, 15);
    assert.equal(questNudge({ monthStars: 50, goal: 48, now }).tone, 'won');
    assert.equal(questNudge({ monthStars: 45, goal: 48, now }).text, 'Only 3 ★ to the goal!');
    assert.equal(questNudge({ monthStars: 0, goal: 48, now: new Date(2026, 9, 3) }).tone, 'fresh');
    assert.equal(questNudge({ monthStars: 10, goal: 48, now: new Date(2026, 9, 30) }).tone, 'rush');
    assert.equal(questNudge({ monthStars: 10, goal: 48, now }).text, '10 ★ of 48 this month');
    assert.equal(questNudge({ monthStars: 10, goal: 0, now }), null);
});

test('the month badge counts half stars like the Team Quest map', () => {
    const now = new Date(2026, 9, 15);
    // 45.5 of 48: the map says 3 to the Portal, so the badge must too (it used to round to 46 and say 2).
    assert.equal(questNudge({ monthStars: 45.5, goal: 48, now }).text, 'Only 3 ★ to the goal!');
    // 47.5 of 48 is not the goal yet.
    assert.equal(questNudge({ monthStars: 47.5, goal: 48, now }).text, 'Only 1 ★ to the goal!');
    assert.equal(questNudge({ monthStars: 48, goal: 48, now }).tone, 'won');
    assert.equal(questNudge({ monthStars: 10.5, goal: 48, now }).text, '10.5 ★ of 48 this month');
});

test('the teacher badge letter skips Mr., Ms., Miss, Mrs. and the Greek κ.', () => {
    assert.equal(teacherInitial('Mr. Nasos'), 'N');
    assert.equal(teacherInitial('Ms Elena'), 'E');
    assert.equal(teacherInitial('Miss Anna'), 'A');
    assert.equal(teacherInitial('Mrs. Papadopoulou'), 'P');
    assert.equal(teacherInitial('κ. Νάσος'), 'Ν');
    assert.equal(teacherInitial('Nasos'), 'N');
    assert.equal(teacherInitial(''), '★');
});
