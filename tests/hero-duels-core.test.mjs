import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createDuels, normalizeDuels, startDuel, scoreDuel, crownDuel, cancelDuel, duelLeaders, duelGains,
    teamTotals, heroStandings, suggestDuel, duelsFinale, rewardIds, moveToTeam, waitingHeroes, teamIndexOf
} from '../features/heroDuelsCore.mjs';

const heroes = ['a', 'b', 'c', 'd', 'e', 'f'];
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('a duel: points, a single leader is crowned and banks points plus the winner bonus', () => {
    let g = createDuels({ id: 'g1', classId: 'c1', heroes });
    g = startDuel(g, ['a', 'b']);
    assert.deepEqual(g.current.ids, ['a', 'b']);
    g = scoreDuel(g, 'a', 3).game;
    g = scoreDuel(g, 'b', 1).game;
    g = scoreDuel(g, 'b', -5).game;
    assert.equal(g.current.scores.b, 0, 'never below 0');
    assert.deepEqual(duelLeaders(g.current), ['a']);
    const { game, duel } = crownDuel(g);
    assert.deepEqual(duel.winners, ['a']);
    assert.equal(game.points.a, 3 + 2);
    assert.equal(game.points.b, 0);
    assert.equal(game.wins.a, 1);
    assert.equal(game.played.b, 1);
    assert.equal(game.current, null);
});

test('a tie needs the teacher to name the winner; co-winners both get the bonus', () => {
    let g = startDuel(createDuels({ id: 'g', heroes }), ['a', 'b', 'c']);
    g = scoreDuel(g, 'a', 2).game;
    g = scoreDuel(g, 'b', 2).game;
    assert.equal(crownDuel(g).duel, null);
    const { game } = crownDuel(g, ['a', 'b']);
    assert.equal(game.points.a, 4);
    assert.equal(game.points.b, 4);
    assert.equal(game.wins.c, 0);
});

test('winner takes all banks only the crowned hero', () => {
    let g = startDuel(createDuels({ id: 'g', heroes, rules: { bank: 'winner', winBonus: 1 } }), ['a', 'b']);
    g = scoreDuel(scoreDuel(g, 'a', 1).game, 'b', 3).game;
    assert.deepEqual(duelGains(g, ['b']), { a: 0, b: 4 });
});

test('first to N reports the hero who reaches it', () => {
    let g = startDuel(createDuels({ id: 'g', heroes, rules: { target: 3 } }), ['a', 'b']);
    let r = scoreDuel(g, 'a', 2);
    assert.equal(r.reached, null);
    r = scoreDuel(r.game, 'a', 1);
    assert.equal(r.reached, 'a');
    assert.equal(scoreDuel(r.game, 'a', 1).reached, null, 'only once');
});

test('cancel banks nothing; duels need 2 heroes of the game and no duel running', () => {
    let g = createDuels({ id: 'g', heroes });
    assert.equal(startDuel(g, ['a']), g);
    assert.equal(startDuel(g, ['a', 'zz']), g);
    g = scoreDuel(startDuel(g, ['a', 'b']), 'a', 2).game;
    assert.equal(startDuel(g, ['c', 'd']), g);
    g = cancelDuel(g);
    assert.equal(g.current, null);
    assert.equal(g.points.a, 0);
});

test('big teams: duel points bank to the duellists’ teams, places shared on a tie', () => {
    let g = createDuels({ id: 'g', heroes, teams: [['a', 'c', 'e'], ['b', 'd'], []] });
    assert.equal(g.teams.length, 2, 'empty teams dropped');
    assert.ok(g.teams[1].includes('f'), 'a hero in no team joins the smallest');
    g = startDuel(g, ['a', 'b']);
    g = scoreDuel(scoreDuel(g, 'a', 2).game, 'b', 1).game;
    g = crownDuel(g).game;
    const t = teamTotals(g);
    assert.equal(t[0].points, 4);
    assert.equal(t[1].points, 1);
    assert.deepEqual(t.map((x) => x.place), [1, 2]);
    g = moveToTeam(g, 'a', 1);
    assert.equal(teamIndexOf(g, 'a'), 1);
    assert.deepEqual(teamTotals(g).map((x) => x.points), [0, 5]);
});

test('suggestDuel picks who has duelled least, one from each team, not the last duellists', () => {
    let g = createDuels({ id: 'g', heroes, teams: [['a', 'b', 'c'], ['d', 'e', 'f']] });
    const first = suggestDuel(g, 2, { rng: () => 0.5 });
    assert.equal(first.length, 2);
    assert.notEqual(teamIndexOf(g, first[0]), teamIndexOf(g, first[1]));
    g = crownDuel(scoreDuel(startDuel(g, first), first[0], 1).game).game;
    const second = suggestDuel(g, 2, { rng: () => 0.5 });
    assert.ok(second.every((x) => !first.includes(x)));
    const solo = createDuels({ id: 's', heroes: ['a', 'b', 'c'] });
    assert.equal(suggestDuel(solo, 3, { rng: seq(0.1, 0.2, 0.3) }).length, 3);
    assert.deepEqual(waitingHeroes(g).sort(), heroes.filter((x) => !first.includes(x)).sort());
});

test('standings, finale and reward groups', () => {
    let g = createDuels({ id: 'g', heroes, teams: [['a', 'b', 'c'], ['d', 'e', 'f']] });
    g = crownDuel(scoreDuel(startDuel(g, ['a', 'd']), 'a', 3).game).game;
    g = crownDuel(scoreDuel(startDuel(g, ['b', 'e']), 'e', 1).game).game;
    g = crownDuel(scoreDuel(startDuel(g, ['a', 'f']), 'a', 1).game).game;
    assert.deepEqual(heroStandings(g).slice(0, 2).map((r) => r.id), ['a', 'e']);
    const f = duelsFinale(g);
    assert.equal(f.duels, 3);
    assert.deepEqual(f.winningTeams, [0]);
    assert.deepEqual(f.crowns, ['a']);
    assert.deepEqual(f.podium.map((r) => r.id), ['a', 'e']);
    assert.deepEqual(rewardIds(g, 'team'), ['a', 'b', 'c']);
    assert.deepEqual(rewardIds(g, 'winners').sort(), ['a', 'e']);
    assert.equal(rewardIds(g, 'all').length, 6);
});

test('a stored game reads back, a broken one is null', () => {
    let g = createDuels({ id: 'g', classId: 'c', dateKey: '2026-10-27', heroes, teams: [['a', 'b', 'c'], ['d', 'e', 'f']], rules: { target: 5, winBonus: 3 } });
    g = scoreDuel(startDuel(g, ['a', 'd']), 'a', 2).game;
    const back = normalizeDuels(JSON.parse(JSON.stringify(g)));
    assert.deepEqual(back, g);
    assert.equal(normalizeDuels({ v: 2 }), null);
    assert.equal(normalizeDuels(null), null);
    assert.equal(createDuels({ id: 'x', heroes, rules: { winBonus: 9, size: 40 } }).rules.winBonus, 2);
    assert.equal(createDuels({ id: 'x', heroes, rules: { size: 40 } }).rules.size, 6);
});
