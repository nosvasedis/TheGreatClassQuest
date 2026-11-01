import test from 'node:test';
import assert from 'node:assert/strict';
import { LEAGUE_JOBS, leagueJob, wordTier, strikeLine, bossLine, turnLine, battleMessages, battleTitle } from '../features/realmRaidBattle.mjs';

test('every league has its own job, skill and colour', () => {
    const names = Object.values(LEAGUE_JOBS).map((j) => j.job);
    assert.equal(new Set(names).size, names.length);
    assert.equal(new Set(Object.values(LEAGUE_JOBS).map((j) => j.skill)).size, names.length);
    assert.equal(leagueJob('junior a').job, 'Bubble Squires');
    assert.equal(leagueJob('Junior-B').job, 'Leaf Rangers');
    assert.equal(leagueJob('Mystery').job, 'Adventurers');
    assert.equal(wordTier('Pre-Junior'), 'young');
    assert.equal(wordTier('B'), 'mid');
    assert.equal(wordTier('D'), 'senior');
});

test('strike lines use the striking class\'s skill and the watching class\'s words', () => {
    const owls = { name: 'Little Owls', league: 'Pre-Junior' };
    assert.equal(strikeLine(owls, 3, 'young'), 'Little Owls: ✨ Twinkle Toss! −3 ⭐');
    assert.match(strikeLine(owls, 12, 'young'), /WOW!/);
    assert.equal(strikeLine({ name: 'Hawks', league: 'B' }, 4.5, 'mid'), 'Hawks use Thunder Arrow! The shield loses 4.5.');
    assert.match(strikeLine({ name: 'Mages', league: 'C' }, 11, 'senior'), /critical/);
});

test('nothing in the words hurts anyone', () => {
    const all = [
        ...['young', 'mid', 'senior'].flatMap((tier) => [
            strikeLine({ name: 'X', league: 'D' }, 20, tier),
            ...['proud', 'brace', 'strain'].map((mood) => bossLine({ mood, tier })),
            bossLine({ phase: 'herald', tier }), bossLine({ broken: true, tier }), bossLine({ broken: true, phase: 'over', tier }),
            bossLine({ legendary: true, broken: true, tier }), bossLine({ phase: 'over', tier }),
            turnLine(1, 5, tier), turnLine(3, 5, tier), turnLine(5, 5, tier)
        ])
    ].join(' ').toLowerCase();
    for (const word of ['kill', 'die', 'dead', 'blood', 'hurt', 'destroy', 'hate', 'stupid', 'lose!', 'loser']) {
        assert.ok(!all.includes(word), `"${word}" must not appear`);
    }
});

test('the message window tells the fight turn by turn, newest last', () => {
    const raid = { phase: 'active', season: { guardian: 'Eldhorn' }, daysToStart: 0 };
    const turns = [
        { n: 1, key: 'd1', when: 'past', lessons: true },
        { n: 2, key: 'd2', when: 'now', lessons: true },
        { n: 3, key: 'd3', when: 'next', lessons: true }
    ];
    const rows = [{ classId: 'a', name: 'Owls', league: 'Pre-Junior' }, { classId: 'b', name: 'Hawks', league: 'B' }];
    const lines = battleMessages({ raid, status: { broken: false }, turns, byDayClass: { d1: { a: 2 }, d2: { a: 1, b: 5 } }, rows, mood: 'brace', tier: 'mid', limit: 10 });
    assert.deepEqual(lines.map((l) => l.kind), ['turn', 'hit', 'turn', 'hit', 'hit', 'boss']);
    // Smaller hits first, the biggest right before Eldhorn speaks.
    assert.match(lines[4].text, /^Hawks use Thunder Arrow/);
    assert.equal(battleMessages({ raid, turns, rows, limit: 2 }).length, 2);
    const herald = battleMessages({ raid: { ...raid, phase: 'herald', daysToStart: 3 }, tier: 'young' });
    assert.match(herald[0].text, /3 days/);
});

test('titles', () => {
    assert.equal(battleTitle({ raid: { phase: 'active' }, status: {} }), 'BOSS BATTLE');
    assert.equal(battleTitle({ raid: { phase: 'over' }, status: { broken: true } }), 'VICTORY!');
    assert.equal(battleTitle({ raid: { phase: 'over' }, status: { broken: true, legendary: true } }), 'LEGENDARY VICTORY!');
    assert.equal(battleTitle({ raid: { phase: 'herald' }, status: {}, tier: 'young' }), 'A boss is coming!');
});
