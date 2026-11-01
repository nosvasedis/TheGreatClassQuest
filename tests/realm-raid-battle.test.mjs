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

test('the party formation fits any number of classes inside its area', async () => {
    const { partyFormation, heroSpriteSvg } = await import('../features/realmRaidParty.mjs');
    assert.deepEqual(partyFormation(0), []);
    for (const n of [1, 2, 3, 5, 8, 10, 16, 22, 30, 40]) {
        const spots = partyFormation(n, { aspect: 1.3 });
        assert.equal(spots.length, n);
        for (const s of spots) {
            assert.ok(s.x > 0 && s.x < 100 && s.y > 0 && s.y < 100, `n=${n} spot inside`);
            assert.ok(s.h > 0 && s.h <= 54);
        }
        const keys = new Set(spots.map((s) => `${s.x}:${s.y}`));
        assert.equal(keys.size, n, `n=${n} no two heroes on one spot`);
    }
    assert.ok(partyFormation(1)[0].h > partyFormation(20)[0].h, 'fewer classes, bigger heroes');
    // A phone's tall, narrow field: every hero (and its flag) stays inside the box.
    for (const aspect of [0.6, 0.8, 1.5, 2.4]) {
        for (const n of [1, 4, 10, 22]) {
            for (const s of partyFormation(n, { aspect })) {
                const halfW = (s.h * (100 / 150)) / aspect / 2;
                assert.ok(s.x - halfW >= -0.01 && s.x + halfW <= 100.01, `n=${n} aspect=${aspect} hero inside`);
            }
        }
    }
    for (const sprite of ['sprite', 'squire', 'ranger', 'knight', 'archer', 'mage', 'paladin', 'adventurer', 'nope']) {
        assert.match(heroSpriteSvg({ sprite, color: '#f00', deep: '#900' }), /^<svg class="rr-u__svg"/);
    }
});

test('captions are short and fit the class', async () => {
    const { caption } = await import('../features/realmRaidBattle.mjs');
    assert.equal(caption('round', 'young', { n: 2 }), 'Round 2!');
    assert.equal(caption('round', 'senior', { n: 4 }), 'Round 4');
    assert.equal(caption('big', 'young'), 'WOW!');
});
