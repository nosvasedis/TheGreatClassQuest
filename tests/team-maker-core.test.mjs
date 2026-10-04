import test from 'node:test';
import assert from 'node:assert/strict';
import {
    clampTeamCount, suggestTeamCount, makeTeams, countRepeatPairs, normalizeTeamMaker,
    recordTeams, teamsForDay, pastTeamSets, describeTeams, moveHero, TEAM_BANNERS
} from '../features/teamMakerCore.mjs';

function seeded(seed = 7) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const GUILDS = ['dragon', 'grizzly', 'owl', 'phoenix'];
const heroes = (n) => Array.from({ length: n }, (_, i) => ({ id: `h${i}`, guildId: GUILDS[i % 4], stars: (i * 7) % 13 }));

test('team count stays between 2 and 6 and never above the children here', () => {
    assert.equal(clampTeamCount(9, 20), 6);
    assert.equal(clampTeamCount(1, 20), 2);
    assert.equal(clampTeamCount(5, 3), 3);
    assert.equal(clampTeamCount(3, 1), 0);
    assert.equal(suggestTeamCount(13), 3);
    assert.equal(suggestTeamCount(5), 2);
});

test('every child lands in exactly one team and sizes differ by at most one', () => {
    for (const mode of ['guild', 'stars', 'random']) {
        const { teams } = makeTeams({ heroes: heroes(14), count: 4, mode, rng: seeded(3) });
        assert.equal(teams.length, 4);
        const all = teams.flat();
        assert.equal(all.length, 14);
        assert.equal(new Set(all).size, 14);
        const sizes = teams.map((t) => t.length);
        assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `${mode}: ${sizes}`);
    }
});

test('mixing the guilds spreads each guild across the teams', () => {
    const { teams } = makeTeams({ heroes: heroes(16), count: 4, mode: 'guild', rng: seeded(11) });
    const byId = new Map(heroes(16).map((h) => [h.id, h]));
    teams.forEach((team) => {
        const guilds = new Set(team.map((id) => byId.get(id).guildId));
        assert.equal(guilds.size, 4);
    });
});

test('balancing by stars keeps team totals close', () => {
    const list = heroes(15);
    const { teams } = makeTeams({ heroes: list, count: 3, mode: 'stars', rng: seeded(5) });
    const byId = new Map(list.map((h) => [h.id, h]));
    const totals = teams.map((t) => t.reduce((s, id) => s + byId.get(id).stars, 0));
    assert.ok(Math.max(...totals) - Math.min(...totals) <= 12, `totals ${totals}`);
});

test('"never the same pairs" keeps last time\'s partners apart when it can', () => {
    const list = heroes(12);
    const last = [['h0', 'h1', 'h2'], ['h3', 'h4', 'h5'], ['h6', 'h7', 'h8'], ['h9', 'h10', 'h11']];
    for (const mode of ['random', 'guild', 'stars']) {
        const { teams, repeats } = makeTeams({ heroes: list, count: 4, mode, avoidPairs: true, pastSets: [last], rng: seeded(2) });
        assert.equal(repeats, 0, `${mode} kept ${repeats} pairs`);
        assert.equal(countRepeatPairs(teams, last), 0);
    }
});

test('saved teams: today only, old ones move into history', () => {
    assert.deepEqual(normalizeTeamMaker(null), { current: null, history: [] });
    const first = recordTeams(null, { teams: [['a', 'b'], ['c', 'd']], mode: 'guild', dateKey: '04-10-2026', madeAt: 1 });
    assert.deepEqual(teamsForDay(first, '04-10-2026').teams, [['a', 'b'], ['c', 'd']]);
    assert.equal(teamsForDay(first, '05-10-2026'), null);
    const second = recordTeams(first, { teams: [['a', 'c'], ['b', 'd']], mode: 'random', dateKey: '05-10-2026', madeAt: 2 });
    const third = recordTeams(second, { teams: [['a', 'd'], ['b', 'c']], mode: 'stars', dateKey: '06-10-2026', madeAt: 3 });
    assert.deepEqual(pastTeamSets(third), [[['a', 'd'], ['b', 'c']], [['a', 'c'], ['b', 'd']]]);
    assert.equal(normalizeTeamMaker(third).history.length, 2);
});

test('describe and move heroes by hand', () => {
    const byId = { a: { stars: 3, guildId: 'owl' }, b: { stars: 2, guildId: 'owl' }, c: { stars: 1 } };
    const d = describeTeams([['a', 'b'], ['c']], byId);
    assert.equal(d[0].stars, 5);
    assert.deepEqual(d[0].guilds, { owl: 2 });
    assert.equal(d[1].banner.key, TEAM_BANNERS[1].key);
    assert.deepEqual(moveHero([['a', 'b'], ['c']], 'b', 1), [['a'], ['c', 'b']]);
});
