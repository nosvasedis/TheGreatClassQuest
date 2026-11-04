import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    buildYearMonths,
    monthBarPercent,
    buildVirtueRose,
    buildAttendance,
    buildLegend,
    buildSparkline,
} from '../features/heroStatsCore.mjs';

test('year row runs Sep to Jun with archived months, the live month and months ahead', () => {
    const year = buildYearMonths({
        start: new Date(2026, 8, 7),
        end: new Date(2027, 5, 25),
        today: new Date(2026, 10, 4),
        history: { '2026-09': 6, '2026-10': 14.5, '2025-10': 99 },
        currentStars: 2,
    });
    assert.equal(year.months.length, 10);
    assert.deepEqual(year.months.slice(0, 3).map((m) => [m.short, m.state, m.stars]), [['Sep', 'past', 6], ['Oct', 'past', 14.5], ['Nov', 'now', 2]]);
    assert.equal(year.months[9].short, 'Jun');
    assert.equal(year.months[9].state, 'future');
    assert.equal(year.months[9].stars, null);
    assert.equal(year.best.key, '2026-10');
    assert.equal(year.average, 10.3);
    assert.equal(year.yearSum, 22.5);
});

test('year row without a school-year start guesses September around today', () => {
    const year = buildYearMonths({ today: new Date(2027, 1, 10), currentStars: 3 });
    assert.equal(year.months[0].key, '2026-09');
    assert.equal(year.months.find((m) => m.state === 'now').key, '2027-02');
});

test('past months stay unknown while loading, so nothing claims a zero yet', () => {
    const year = buildYearMonths({ start: new Date(2026, 8, 1), today: new Date(2026, 10, 4), currentStars: 5, loaded: false });
    assert.equal(year.months[0].stars, null);
    assert.equal(year.best.key, '2026-11');
    assert.equal(year.average, null);
});

test('bars: a stub for zero, scaled otherwise, none for months ahead', () => {
    assert.equal(monthBarPercent(null, 10), 0);
    assert.equal(monthBarPercent(0, 10), 4);
    assert.equal(monthBarPercent(5, 10), 50);
    assert.equal(monthBarPercent(0.1, 10), 8);
});

test('virtue rose points the right way and names a clear leader only', () => {
    const rose = buildVirtueRose([
        { key: 'teamwork', stars: 0 }, { key: 'creativity', stars: 1 }, { key: 'respect', stars: 0 }, { key: 'focus', stars: 6 },
    ], { size: 200, radius: 80, floor: 4 });
    const focus = rose.points.find((p) => p.key === 'focus');
    assert.equal(focus.x, 20); // full reach to the left
    assert.equal(focus.y, 100);
    assert.equal(rose.strongest, 'focus');
    const tie = buildVirtueRose([{ key: 'teamwork', stars: 2 }, { key: 'respect', stars: 2 }]);
    assert.equal(tie.strongest, null);
    assert.equal(buildVirtueRose([]).total, 0);
});

test('attendance counts lessons and absences', () => {
    const a = buildAttendance(['03-11-2026', '04-11-2026', '27-10-2026'], ['04-11-2026', '01-01-2026']);
    assert.equal(a.lessons, 3);
    assert.equal(a.absent, 1);
    assert.equal(a.present, 2);
    assert.equal(a.rate, 67);
    assert.equal(buildAttendance([], []).rate, null);
});

test('Hero of the Day legend ladder', () => {
    assert.equal(buildLegend(0).next.key, 'rising');
    assert.equal(buildLegend(0).toNext, 3);
    const four = buildLegend(4);
    assert.equal(four.tier.key, 'rising');
    assert.equal(four.next.key, 'golden');
    assert.equal(four.pct, 0.5);
    assert.equal(buildLegend(12).next, null);
    assert.equal(buildLegend(12).tier.key, 'mythic');
});

test('sparkline skips trials with no percent and draws one line per kind', () => {
    const s = buildSparkline([
        { percent: 50, type: 'test' }, { percent: NaN, type: 'test' }, { percent: 100, type: 'test' }, { percent: 80, type: 'dictation' },
    ], { width: 100, height: 100, pad: 0 });
    assert.equal(s.dots.length, 3);
    assert.equal(s.dots[0].y, 50);
    assert.equal(s.dots[1].y, 0);
    assert.ok(s.lines.test);
    assert.equal(s.lines.dictation, undefined);
});

test('Hero Stage opens Hero stats, and the roster no longer carries the old hero view', () => {
    const avatar = readFileSync(new URL('../ui/core/avatar.js', import.meta.url), 'utf8');
    assert.match(avatar, /import\('\.\.\/modals\/heroStats\.js'\)/);
    const roster = readFileSync(new URL('../ui/modals/classRoster.js', import.meta.url), 'utf8');
    assert.doesNotMatch(roster, /renderHeroDetail|loadChart/);
    assert.match(roster, /openHeroStatsModal\(heroId/);
    const modal = readFileSync(new URL('../ui/modals/heroStats.js', import.meta.url), 'utf8');
    assert.match(modal, /import\('\.\.\/\.\.\/styles\/hero_stats\.css'\)/, 'styles load with the modal');
    const startup = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    assert.doesNotMatch(startup, /hero_stats\.css/, 'not in the startup stylesheet');
});
