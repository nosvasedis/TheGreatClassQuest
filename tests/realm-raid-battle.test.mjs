import test from 'node:test';
import assert from 'node:assert/strict';
import { HERO_ARTS, STAR_ART, artForReason, heroArt, classArt, strikeArts, leagueRank, wordTier, strikeLine, bossLine, turnLine, battleMessages, battleTitle } from '../features/realmRaidBattle.mjs';

test('every hero class has its own art, sprite and colour, tied to the stars it earns', () => {
    const arts = Object.values(HERO_ARTS);
    assert.equal(new Set(arts.map((a) => a.art)).size, arts.length);
    assert.equal(new Set(arts.map((a) => a.sprite)).size, arts.length);
    assert.equal(artForReason('respect'), HERO_ARTS.Guardian);
    assert.equal(artForReason('torn_map'), HERO_ARTS.Vanguard);
    assert.equal(artForReason('mystery'), STAR_ART);
    assert.equal(heroArt('Weaver'), HERO_ARTS.Vanguard);
    assert.equal(heroArt(''), STAR_ART);
    assert.equal(wordTier('Pre-Junior'), 'young');
    assert.equal(wordTier('B'), 'mid');
    assert.equal(wordTier('D'), 'senior');
    assert.ok(leagueRank('Junior A') < leagueRank('C'));
    assert.equal(leagueRank('Mystery'), 99);
});

test('a class fights as its students\' main hero class, then as its biggest stars', () => {
    assert.equal(classArt({ heroMix: { Sage: 3, Guardian: 5 }, reasons: { focus: 20 } }), HERO_ARTS.Guardian);
    assert.equal(classArt({ heroMix: {}, reasons: { focus: 20, respect: 2 } }), HERO_ARTS.Artificer);
    assert.equal(classArt({}), STAR_ART);
    const arts = strikeArts({ respect: 2, teamwork: 5, story_weaver: 1, torn_map: 1, bogus: 0 });
    assert.deepEqual(arts.map((a) => [a.art.heroClass, a.stars]), [['Paladin', 5], ['Guardian', 2], ['Vanguard', 2]]);
});

test('strike lines use the striking class\'s art and the watching class\'s words', () => {
    const owls = { name: 'Little Owls', league: 'Pre-Junior', heroMix: { Sage: 2 } };
    assert.equal(strikeLine(owls, 3, 'young'), 'Little Owls: 🔮 Creative Spark! −3 ⭐');
    assert.match(strikeLine(owls, 12, 'young'), /WOW!/);
    assert.equal(strikeLine({ name: 'Hawks', league: 'B', heroMix: { Paladin: 1 } }, 4.5, 'mid'), 'Hawks use Battle Bond! The shield loses 4.5.');
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
    const rows = [{ classId: 'a', name: 'Owls', league: 'Pre-Junior' }, { classId: 'b', name: 'Hawks', league: 'B', heroMix: { Scholar: 4 } }];
    const lines = battleMessages({ raid, status: { broken: false }, turns, byDayClass: { d1: { a: 2 }, d2: { a: 1, b: 5 } }, rows, mood: 'brace', tier: 'mid', limit: 10 });
    assert.deepEqual(lines.map((l) => l.kind), ['turn', 'hit', 'turn', 'hit', 'hit', 'boss']);
    // Smaller hits first, the biggest right before Eldhorn speaks.
    assert.match(lines[4].text, /^Hawks use Academic Edge/);
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
    for (const sprite of ['guardian', 'sage', 'paladin', 'artificer', 'scholar', 'vanguard', 'nomad', 'patron', 'adventurer', 'nope']) {
        assert.match(heroSpriteSvg({ sprite, color: '#f00', deep: '#900' }), /^<svg class="rr-u__svg"/);
    }
});

test('captions are short and fit the class', async () => {
    const { caption } = await import('../features/realmRaidBattle.mjs');
    assert.equal(caption('round', 'young', { n: 2 }), 'Round 2!');
    assert.equal(caption('round', 'senior', { n: 4 }), 'Round 4');
    assert.equal(caption('big', 'young'), 'WOW!');
});

test('every season has a place to fight in, drawn the same each time', async () => {
    const { sceneHtml } = await import('../features/realmRaidScene.mjs');
    const { arenaSvg } = await import('../features/realmRaidArt.mjs');
    for (const season of ['winter', 'carnival', 'summer']) {
        const html = sceneHtml(season);
        for (const layer of ['rr-scene__far', 'rr-scene__mid', 'rr-scene__floor', 'rr-scene__near']) assert.ok(html.includes(layer), `${season} ${layer}`);
        assert.ok(!/NaN|undefined/.test(html), `${season} scene numbers`);
        assert.equal(sceneHtml(season), html, `${season} scene is stable`);
        const arena = arenaSvg(season);
        assert.ok(arena.includes('rr-arena__gate') && !/NaN|undefined/.test(arena), `${season} gate`);
    }
    assert.ok(sceneHtml('winter', { lite: true }).includes('is-still'));
});
