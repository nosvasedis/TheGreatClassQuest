import test from 'node:test';
import assert from 'node:assert/strict';
import { finalCrownStandings, wheelYearSummary, raidYearSummary, ceremonyChapterKeys } from '../features/grandCeremonyCore.mjs';

const year = '2026-2027';
const ids = ['dragon_flame', 'grizzly_might', 'owl_wisdom', 'phoenix_rising'];
const members = { dragon_flame: ['d1', 'd2'], grizzly_might: ['g1', 'g2'], owl_wisdom: ['o1', 'o2'], phoenix_rising: [] };
const sealed = (place, crowns, unity = false) => ({ place, crowns, unity, perMember: 1 });
const june = new Date(2027, 5, 18);

const scores = {
    dragon_flame: { activeSchoolYearKey: year, totalGlory: 40, sealedChapters: { m2026_09: sealed(1, 5), m2026_10: sealed(2, 3) }, chapters: { m2027_06: { glory: 10, members: { d1: 6, d2: 4 } } } },
    grizzly_might: { activeSchoolYearKey: year, totalGlory: 60, sealedChapters: { m2026_09: sealed(2, 3), m2026_10: sealed(1, 6, true) }, chapters: { m2027_06: { glory: 4, members: { g1: 4 } } } },
    owl_wisdom: { activeSchoolYearKey: year, totalGlory: 20, sealedChapters: { m2026_09: sealed(3, 2), m2026_10: sealed(3, 2) }, chapters: { m2027_06: { glory: 20, members: { o1: 10, o2: 10 } } } },
    phoenix_rising: { activeSchoolYearKey: year },
};

test('chapter keys run from the first Chapter up to the current month', () => {
    const keys = ceremonyChapterKeys(scores, year, { now: june });
    assert.equal(keys[0], 'm2026_09');
    assert.equal(keys.at(-1), 'm2027_06');
    assert.equal(ceremonyChapterKeys(scores, year, { now: june, firstKey: 'm2026_10' })[0], 'm2026_10');
});

test('the June Chapter is ranked as it stands and counts tonight; empty guilds are left out', () => {
    const rows = finalCrownStandings({ allGuildScores: scores, membersByGuild: members, guildIds: ids, schoolYearKey: year, now: june });
    assert.equal(rows.length, 3);
    // owl: 2 + 2 + June 1st (5, Unity: both have 6+) = 10; dragon 5+3+June 2nd (3, unity no: d2 has 4) = 11; grizzly 3+6+June 3rd 2 = 11 (Unity Oct)
    const by = Object.fromEntries(rows.map((r) => [r.guildId, r]));
    assert.equal(by.owl_wisdom.crowns, 2 + 2 + 6);
    assert.equal(by.dragon_flame.crowns, 5 + 3 + 3);
    assert.equal(by.grizzly_might.crowns, 3 + 6 + 2);
    const juneOwl = by.owl_wisdom.chapters.find((c) => c.key === 'm2027_06');
    assert.equal(juneOwl.provisional, true);
    assert.equal(juneOwl.unity, true);
    assert.equal(by.grizzly_might.unitySeals, 1);
    // dragon and grizzly tie on 11 Crowns: grizzly has more Glory per member (30 vs 20)
    assert.equal(rows[0].guildId, 'grizzly_might');
    assert.equal(rows[0].tieBreak, true);
    assert.equal(rows[1].guildId, 'dragon_flame');
    assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3]);
    assert.deepEqual(by.dragon_flame.chapterWins, ['m2026_09']);
});

test('a past Chapter nobody sealed is ranked from its tallies', () => {
    const s = structuredClone(scores);
    s.dragon_flame.chapters.m2026_11 = { glory: 12, members: { d1: 6, d2: 6 } };
    const rows = finalCrownStandings({ allGuildScores: s, membersByGuild: members, guildIds: ids, schoolYearKey: year, now: june });
    const nov = rows.find((r) => r.guildId === 'dragon_flame').chapters.find((c) => c.key === 'm2026_11');
    assert.equal(nov.place, 1);
    assert.equal(nov.crowns, 6);
    assert.equal(nov.provisional, true);
    const empty = rows.find((r) => r.guildId === 'owl_wisdom').chapters.find((c) => c.key === 'm2026_12');
    assert.equal(empty.place, null);
    assert.equal(empty.crowns, 0);
});

test('the Wheel summary counts every guild turn, Omens, storms braved and Glory moved between guilds', () => {
    const entries = [
        { classId: 'c1', results: [
            { guildId: 'owl_wisdom', rarity: 'omen', segmentLabel: '🌠 Wishing Star', gloryDelta: 16, gloryByGuild: { owl_wisdom: 16 } },
            { guildId: 'dragon_flame', rarity: 'storm', braved: true, gloryDelta: 0 },
            { guildId: 'phoenix_rising', envoy: true, rarity: 'envoy', gloryByGuild: { owl_wisdom: -3, dragon_flame: 2 } },
        ] },
        { classId: 'c2', results: [{ guildId: 'grizzly_might', rarity: 'legendary', gloryDelta: 40 }] },
    ];
    const w = wheelYearSummary(entries, ['c1']);
    assert.equal(w.totalSpins, 3);
    assert.equal(w.wheelDays, 1);
    assert.equal(w.omens, 1);
    assert.equal(w.braved, 1);
    assert.equal(w.envoys, 1);
    assert.equal(w.gloryByGuild.owl_wisdom, 13);
    assert.equal(w.luckiestGuild.guildId, 'owl_wisdom');
    assert.equal(w.rarestFind.label, '🌠 Wishing Star');
    assert.equal(wheelYearSummary([], ['c1']).luckiestGuild, null);
});

test('Realm Raids count once per raid however many classes won it', () => {
    const r = raidYearSummary([
        { id: 'c1', realmRaids: { winter: { victoryAt: 1, hero: { name: 'Mia' } }, spring: { victoryAt: 1, legendaryAt: 2 } } },
        { id: 'c2', realmRaids: { winter: { victoryAt: 1 }, summer: {} } },
    ]);
    assert.equal(r.victories, 2);
    assert.equal(r.legendary, 1);
    assert.equal(r.raidHeroes[0].name, 'Mia');
});
