import test from 'node:test';
import assert from 'node:assert/strict';
import {
    RAID_EFFORT,
    computeShares,
    countRaidHeroWins,
    dayKey,
    findRaid,
    guardianMood,
    lessonPace,
    nextRaid,
    orthodoxEaster,
    owedRaidRewards,
    pickRaidHero,
    questStepStars,
    raidStatus,
    raidWindow,
    tallyRaidStars
} from '../features/realmRaidCore.mjs';

test('Orthodox Easter matches the known dates', () => {
    assert.equal(dayKey(orthodoxEaster(2027)), '2027-05-02');
    assert.equal(dayKey(orthodoxEaster(2026)), '2026-04-12');
});

test('the Winter Raid is the 7 days before the Christmas holiday', () => {
    const raid = raidWindow('winter', 2026, { holidays: [{ start: '2026-12-23', end: '2027-01-07' }] });
    assert.equal(raid.raidId, 'winter_2026');
    assert.equal(dayKey(raid.start), '2026-12-16');
    assert.equal(dayKey(raid.end), '2026-12-22');
    // DD-MM-YYYY holidays read the same way.
    const greek = raidWindow('winter', 2026, { holidays: [{ start: '19-12-2026', end: '06-01-2027' }] });
    assert.equal(dayKey(greek.end), '2026-12-18');
    // No holiday saved: ends on 22 December.
    assert.equal(dayKey(raidWindow('winter', 2026).end), '2026-12-22');
});

test('the Carnival Raid ends the day before Clean Monday', () => {
    const raid = raidWindow('carnival', 2026);
    // Easter 2027 is 2 May, so Clean Monday is 15 March.
    assert.equal(dayKey(raid.end), '2027-03-14');
    assert.equal(dayKey(raid.start), '2027-03-08');
    const longWeekend = raidWindow('carnival', 2026, { holidays: [{ start: '2027-03-12', end: '2027-03-15' }] });
    assert.equal(dayKey(longWeekend.end), '2027-03-11');
});

test('the Summer Raid is the last school week, never after 14 June', () => {
    assert.equal(dayKey(raidWindow('summer', 2026).end), '2027-06-14');
    assert.equal(dayKey(raidWindow('summer', 2026, { closeDate: '2027-06-05' }).end), '2027-06-04');
    assert.equal(dayKey(raidWindow('summer', 2026, { closeDate: '2027-07-31' }).end), '2027-06-14');
});

test('phases: herald, active, aftermath, then nothing', () => {
    const holidays = [{ start: '2026-12-23', end: '2027-01-07' }];
    assert.equal(findRaid(new Date(2026, 9, 4), { holidays }), null);
    const herald = findRaid(new Date(2026, 11, 12), { holidays });
    assert.equal(herald.phase, 'herald');
    assert.equal(herald.daysToStart, 4);
    const active = findRaid(new Date(2026, 11, 18, 10), { holidays });
    assert.equal(active.phase, 'active');
    assert.equal(active.dayNumber, 3);
    assert.equal(active.daysLeft, 4);
    assert.equal(findRaid(new Date(2027, 0, 1), { holidays }).phase, 'aftermath');
    assert.equal(findRaid(new Date(2027, 0, 2), { holidays }), null);
    assert.equal(nextRaid(new Date(2026, 9, 4), { holidays }).raidId, 'winter_2026');
    assert.equal(nextRaid(new Date(2027, 0, 5), { holidays }).raidId, 'carnival_2026');
});

test('a shard follows the class size and its lessons, not its league', () => {
    const raid = raidWindow('winter', 2026, { holidays: [{ start: '2026-12-23', end: '2027-01-07' }] });
    const classes = [
        { id: 'big', scheduleDays: ['1', '3'] },
        { id: 'small', scheduleDays: ['2'] },
        { id: 'away', scheduleDays: ['6'] },
        { id: 'empty', scheduleDays: ['1'] }
    ];
    const meets = (id, d) => (classes.find((c) => c.id === id).scheduleDays || []).includes(String(d.getDay())) && id !== 'away';
    const shares = computeShares({ raid, classes, heroCounts: { big: 16, small: 8, away: 10, empty: 0 }, meets });
    const byId = Object.fromEntries(shares.map((s) => [s.classId, s]));
    // 16-22 Dec: Mon 21, Wed 16 → 2 lessons; Tue 22 → 1 lesson.
    assert.equal(byId.big.lessonDates.length, 2);
    assert.equal(byId.small.lessonDates.length, 1);
    assert.equal(byId.big.share, Math.round(16 * 2 * lessonPace(classes[0]) * RAID_EFFORT));
    assert.equal(byId.small.share, Math.round(8 * 1 * lessonPace(classes[1]) * RAID_EFFORT));
    assert.equal(byId.away.share, 0);
    assert.equal(byId.empty.share, 0);
    // Per hero per week, a twice-a-week class and a once-a-week class are asked the same.
    assert.ok(Math.abs(byId.big.share / 16 - byId.small.share / 8) < 0.5);
});

test('stars of the raid week chip the shield; other days and negative logs do not', () => {
    const raid = raidWindow('winter', 2026);
    const logs = [
        { id: '1', classId: 'a', studentId: 's1', stars: 2, date: '16-12-2026' },
        { id: '2', classId: 'a', studentId: 's1', stars: 1, date: '18-12-2026' },
        { id: '2', classId: 'a', studentId: 's1', stars: 1, date: '18-12-2026' },
        { id: '3', classId: 'a', studentId: 's2', stars: 3, date: '15-12-2026' },
        { id: '4', classId: 'b', studentId: 's3', stars: -1, date: '17-12-2026' },
        { id: '5', classId: 'b', studentId: 's3', stars: 0.5, createdAt: new Date(2026, 11, 22, 9) }
    ];
    const tally = tallyRaidStars(logs, raid);
    assert.deepEqual(tally.byClass, { a: 3, b: 0.5 });
    assert.equal(tally.byHero.s1.days.size, 2);
});

test('the shield breaks on the school total, and stays broken once locked', () => {
    const shares = [{ classId: 'a', share: 10 }, { classId: 'b', share: 10 }];
    let status = raidStatus({ shares, tally: { byClass: { a: 15, b: 4 } } });
    assert.equal(status.hp, 20);
    assert.equal(status.broken, false);
    assert.equal(status.classes.find((c) => c.classId === 'a').valor, true);
    assert.equal(guardianMood(status), 'strain');
    status = raidStatus({ shares, tally: { byClass: { a: 15, b: 4, c: 2 } } });
    assert.equal(status.broken, true);
    assert.equal(status.classes.find((c) => c.classId === 'c').helper, true);
    assert.equal(raidStatus({ shares: [...shares, { classId: 'd', share: 30 }], tally: { byClass: { a: 15, b: 6 } }, locked: { brokenAt: 'x' } }).broken, true);
    assert.equal(raidStatus({ shares, tally: { byClass: { a: 14, b: 10 } } }).legendary, true);
});

test('rewards: valor any time in the week, the hero only after the class has had its lessons', () => {
    const raid = raidWindow('winter', 2026);
    const classRow = { valor: true, lessonDates: ['2026-12-16', '2026-12-21'] };
    const status = { broken: true, legendary: false };
    const mid = owedRaidRewards({ status, classRow, raid, today: new Date(2026, 11, 18) });
    assert.deepEqual(mid, { valor: true, victory: true, legendary: false, heroReady: false });
    const lastLesson = owedRaidRewards({ status, classRow, raid, today: new Date(2026, 11, 21) });
    assert.equal(lastLesson.heroReady, true);
    const paid = owedRaidRewards({ status, classRow, raid, today: new Date(2026, 11, 23), receipt: { valorAt: 1, victoryAt: 1, hero: { studentId: 's' } } });
    assert.deepEqual(paid, { valor: false, victory: false, legendary: false, heroReady: false });
    const before = owedRaidRewards({ status, classRow, raid, today: new Date(2026, 11, 10) });
    assert.equal(before.victory, false);
});

test('Team Quest step: the same share of every map', () => {
    assert.equal(questStepStars(200, 0.05), 10);
    assert.equal(questStepStars(150, 0.05), 7.5);
    assert.equal(questStepStars(10, 0.025), 1);
    assert.equal(questStepStars(0, 0.05), 0);
});

test('the Raid Hero is the steadiest striker, then most stars, then fewest prizes', () => {
    const heroes = [
        { studentId: 'many', stars: 6, days: new Set(['a']) },
        { studentId: 'steady', stars: 3, days: new Set(['a', 'b']) },
        { studentId: 'steady2', stars: 3, days: new Set(['a', 'b']) },
        { studentId: 'none', stars: 0, days: new Set() }
    ];
    assert.equal(pickRaidHero(heroes, { pastWins: { steady: 1 }, random: () => 0 }).studentId, 'steady2');
    assert.equal(pickRaidHero([heroes[3]]), null);
    assert.deepEqual(countRaidHeroWins({ 'winter_2026': { hero: { studentId: 'x' } }, 'carnival_2026': { hero: { studentId: 'x' } } }), { x: 2 });
});
