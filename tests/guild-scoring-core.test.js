const test = require('node:test');
const assert = require('node:assert/strict');

async function loadCore() {
  return import('../features/guildScoringCore.js');
}

const ids = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

/** A Chapter where each listed member earned the given Glory. */
function chapterOf(gloryByMember) {
  const members = { ...gloryByMember };
  const glory = Object.values(members).reduce((a, b) => a + b, 0);
  return { glory, members };
}

test('a star is 2 Glory, the Banner of Glory adds 1 per star, and nothing multiplies it', async () => {
  const { calculateGuildGloryDelta } = await loadCore();
  assert.equal(calculateGuildGloryDelta({ starDelta: 3 }).totalGloryDelta, 6);
  const banner = calculateGuildGloryDelta({ starDelta: 3, scoreData: { gloryBannerCharges: 2 } });
  assert.equal(banner.totalGloryDelta, 8, 'only two Banner charges were left');
  const old = calculateGuildGloryDelta({ starDelta: 2, scoreData: { gloryMultiplier: 3, chaliceActive: true }, modifiers: [{ multiplier: 2 }] });
  assert.equal(old.totalGloryDelta, 4, 'retired multipliers and chalices are ignored');
});

test('a star taken back costs only its plain Glory', async () => {
  const { calculateGuildGloryDelta } = await loadCore();
  const back = calculateGuildGloryDelta({ starDelta: -1, scoreData: { gloryBannerCharges: 3 } });
  assert.equal(back.totalGloryDelta, -2);
  assert.equal(calculateGuildGloryDelta({ directGlory: 5 }).totalGloryDelta, 5);
});

test('an exact Glory change is exactly that size', async () => {
  const { exactGuildGloryDelta } = await loadCore();
  assert.equal(exactGuildGloryDelta({ starDelta: -1, glory: -3 }).totalGloryDelta, -3);
});

test('Chapter keys are calendar months and name the month', async () => {
  const { chapterKeyFor, chapterKeyFromMonthKey, chapterName, chapterShortName, schoolYearChapterKeys, chapterDaysLeft } = await loadCore();
  assert.equal(chapterKeyFor(new Date(2026, 9, 3)), 'm2026_10');
  assert.equal(chapterKeyFromMonthKey('2026-11'), 'm2026_11');
  assert.equal(chapterKeyFromMonthKey('m2026_11'), 'm2026_11');
  assert.equal(chapterKeyFromMonthKey('nope'), null);
  assert.equal(chapterName('m2027_01'), 'January');
  assert.equal(chapterShortName('m2026_09'), 'Sep');
  const keys = schoolYearChapterKeys('2026-2027');
  assert.equal(keys.length, 10);
  assert.equal(keys[0], 'm2026_09');
  assert.equal(keys[9], 'm2027_06');
  assert.equal(chapterDaysLeft(new Date(2026, 9, 31)), 1);
  assert.equal(chapterDaysLeft(new Date(2026, 9, 1)), 31);
});

test('only a school year\'s own Chapters are read', async () => {
  const { isChapterOfSchoolYear, guildChapterBook } = await loadCore();
  assert.equal(isChapterOfSchoolYear('m2026_09', '2026-2027'), true);
  assert.equal(isChapterOfSchoolYear('m2027_08', '2026-2027'), true);
  assert.equal(isChapterOfSchoolYear('m2026_08', '2026-2027'), false);
  const book = guildChapterBook({
    chapters: { m2026_06: { glory: 9 }, m2026_10: { glory: 4 } },
    sealedChapters: { m2026_05: { crowns: 5 }, m2026_09: { crowns: 3 } },
  }, '2026-2027');
  assert.deepEqual(Object.keys(book.chapters), ['m2026_10']);
  assert.deepEqual(Object.keys(book.sealed), ['m2026_09']);
});

test('a Chapter is won on Glory per member, so size never decides it', async () => {
  const { chapterTally, rankChapter } = await loadCore();
  const small = ids('s', 5);
  const big = ids('b', 20);
  // Every member of both guilds earns 10 Glory, but four big-guild stars carry 30 each.
  const smallChapter = chapterOf(Object.fromEntries(small.map((id) => [id, 10])));
  const bigChapter = chapterOf(Object.fromEntries(big.slice(0, 4).map((id) => [id, 30])));
  const ranked = rankChapter({
    small: chapterTally(smallChapter, small),
    big: chapterTally(bigChapter, big),
  });
  assert.equal(chapterTally(bigChapter, big).glory, 120, 'more raw Glory');
  assert.equal(ranked.small.place, 1, 'but fewer Glory each');
  assert.equal(ranked.big.place, 2);
  assert.equal(ranked.small.crowns, 5 + 1, '1st place plus the Unity Seal');
  assert.equal(ranked.big.crowns, 3, '2nd place, no Unity Seal');
});

test('Chapter places pay 5, 3, 2, 1; ties share the higher place; no Glory pays nothing', async () => {
  const { rankChapter } = await loadCore();
  const r = rankChapter({
    a: { perMember: 8, unity: false },
    b: { perMember: 8, unity: false },
    c: { perMember: 3, unity: false },
    d: { perMember: 0, unity: false },
  });
  assert.equal(r.a.place, 1);
  assert.equal(r.b.place, 1);
  assert.equal(r.a.crowns, 5);
  assert.equal(r.b.crowns, 5);
  assert.equal(r.c.place, 3);
  assert.equal(r.c.crowns, 2);
  assert.equal(r.d.place, null);
  assert.equal(r.d.crowns, 0);
});

test('the Unity Seal needs 4 in 5 members with 6 Glory, and any guild can win it', async () => {
  const { chapterTally, rankChapter } = await loadCore();
  const team = ids('m', 10);
  const eight = chapterOf(Object.fromEntries(team.slice(0, 8).map((id) => [id, 6])));
  const seven = chapterOf(Object.fromEntries(team.slice(0, 7).map((id) => [id, 6])));
  const t8 = chapterTally(eight, team);
  const t7 = chapterTally(seven, team);
  assert.equal(t8.unityNeeded, 8);
  assert.equal(t8.unity, true);
  assert.equal(t7.unity, false);
  const r = rankChapter({ x: { ...t7, perMember: 9 }, y: t8 });
  assert.equal(r.x.crowns, 5, '1st place without the seal');
  assert.equal(r.y.crowns, 3 + 1, '2nd place with the seal');
  // Small guilds round the share up: 3 members need 3.
  assert.equal(chapterTally({}, ids('t', 3)).unityNeeded, 3);
  assert.equal(chapterTally({}, ids('f', 5)).unityNeeded, 4);
});

test('Glory earned by members who left leaves the Chapter with them', async () => {
  const { chapterTally } = await loadCore();
  const t = chapterTally({ glory: 30, members: { a: 10, b: 10, gone: 10 } }, ['a', 'b']);
  assert.equal(t.glory, 20);
  assert.equal(t.perMember, 10);
  assert.equal(t.contributors, 2);
  assert.equal(chapterTally({ glory: 4, members: {} }, []).perMember, 0, 'an empty guild scores 0');
});

test('finished Chapters are sealed once, from the first Crown Chapter on', async () => {
  const { chaptersToSeal } = await loadCore();
  const guilds = {
    a: { chapters: { m2026_09: { glory: 4 }, m2026_10: { glory: 2 } }, sealedChapters: {} },
    b: { chapters: { m2026_09: { glory: 6 } }, sealedChapters: {} },
  };
  const now = new Date(2026, 10, 2);
  assert.deepEqual(chaptersToSeal(guilds, '2026-2027', now), ['m2026_09', 'm2026_10']);
  assert.deepEqual(chaptersToSeal(guilds, '2026-2027', now, 'm2026_10'), ['m2026_10'], 'a warm-up month is never sealed');
  const sealed = {
    a: { ...guilds.a, sealedChapters: { m2026_09: { crowns: 3 } } },
    b: { ...guilds.b, sealedChapters: { m2026_09: { crowns: 5 } } },
  };
  assert.deepEqual(chaptersToSeal(sealed, '2026-2027', now), ['m2026_10']);
  assert.deepEqual(chaptersToSeal(sealed, '2026-2027', new Date(2026, 9, 15)), [], 'the running Chapter waits');
});

test('the year is ranked on Crowns, then the year\'s Glory per member', async () => {
  const { compareCrownRaceRows, compareFinalCrownRows, sharedPlaces } = await loadCore();
  const rows = [
    { guildName: 'A', crowns: 9, yearGloryPerMember: 50 },
    { guildName: 'B', crowns: 12, yearGloryPerMember: 20 },
    { guildName: 'C', crowns: 9, yearGloryPerMember: 60 },
  ].sort(compareCrownRaceRows);
  assert.deepEqual(rows.map((r) => r.guildName), ['B', 'C', 'A']);
  assert.deepEqual(sharedPlaces(rows), [0, 1, 1]);
  const june = [
    { guildName: 'B', crowns: 12, liveCrowns: 1, yearGloryPerMember: 20 },
    { guildName: 'C', crowns: 9, liveCrowns: 6, yearGloryPerMember: 60 },
  ].sort(compareFinalCrownRows);
  assert.equal(june[0].guildName, 'C', 'June\'s Chapter counts at the ceremony');
});

test('Glory earned by students who left leaves the guild with them', async () => {
  const { countedGuildGlory } = await loadCore();
  const guild = { activeSchoolYearKey: '2026-2027', memberGloryYear: '2026-2027', totalGlory: 130, memberGlory: { a: 40, b: 50, gone: 30 } };
  assert.deepEqual(countedGuildGlory(guild, ['a', 'b']), { countedGlory: 100, leaversGlory: 30, memberGloryReady: true });
  const lastYearMap = { ...guild, memberGloryYear: '2025-2026' };
  assert.equal(countedGuildGlory(lastYearMap, ['a', 'b']).countedGlory, 130, 'an old year\'s map is ignored');
});

test('Glory left on members with no stars is found so it can be taken back', async () => {
  const { findOrphanMemberGlory } = await loadCore();
  const guild = { activeSchoolYearKey: 'Y', memberGloryYear: 'Y', totalGlory: 16, memberGlory: { tested: 12, real: 4, gone: 0 } };
  assert.deepEqual(findOrphanMemberGlory(guild, ['tested', 'real'], { real: 2 }), [{ studentId: 'tested', glory: -12 }]);
  assert.deepEqual(findOrphanMemberGlory({ ...guild, memberGloryYear: 'X' }, ['tested'], {}), [], 'not before the map is built');
});
