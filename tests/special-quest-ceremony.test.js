import test from 'node:test';
import assert from 'node:assert/strict';
import { QUEST_DEFINITIONS, SPECIAL_QUEST_TYPES, createQuestEventDocument, getDefaultProgress, reduceQuestProgress, resolveDailyModifier, applyDailyModifier, validateQuestEvent } from '../features/specialQuestEngine.js';
import { CEREMONY_MODES, resolveCeremonyMode, seededShuffle, buildGrowthSpotlight, buildGrowthPublicSequence, chooseCanonicalWinners } from '../features/ceremonyDomain.js';
import { QUEST_LEAGUE_DEFINITIONS } from '../constants.js';

test('ceremony mode is automatic for every league and blocks invalid values', () => {
  assert.equal(resolveCeremonyMode('Nursery').mode, CEREMONY_MODES.GROWTH);
  assert.equal(resolveCeremonyMode('Pre-Junior').mode, CEREMONY_MODES.GROWTH);
  for (const league of QUEST_LEAGUE_DEFINITIONS.filter((item) => item.ageCategory !== 'early')) assert.equal(resolveCeremonyMode(league.name).mode, CEREMONY_MODES.CLASSIC);
  assert.equal(resolveCeremonyMode('Not a league').ok, false);
});

test('quest document and validation use class scoped v2 contracts', () => {
  const event = createQuestEventDocument({ type: 'Vocabulary Vault', classId: 'class-a', dateKey: '2026-09-01', schoolYearKey: '2026-27', createdBy: { uid: 'teacher' } });
  assert.equal(event.schemaVersion, 2); assert.equal(event.type, SPECIAL_QUEST_TYPES.VOCABULARY_VAULT); assert.equal(event.goalSpec.target, 10); assert.equal(event.classId, 'class-a');
  assert.equal(validateQuestEvent(event).valid, true);
  assert.equal(validateQuestEvent({ ...event, classId: null }).valid, false);
});

test('progress reducers implement counter, streak, checklist and five steps', () => {
  const counterEvent = createQuestEventDocument({ type: 'Vocabulary Vault', classId: 'c', dateKey: '2026-09-01', schoolYearKey: 'y', createdBy: {} });
  let progress = getDefaultProgress(counterEvent); progress = reduceQuestProgress(counterEvent, progress, 'increment'); assert.equal(progress.current, 1);
  const chain = createQuestEventDocument({ type: 'The Unbroken Chain', classId: 'c', dateKey: '2026-09-01', schoolYearKey: 'y', createdBy: {} });
  progress = reduceQuestProgress(chain, getDefaultProgress(chain), 'success'); progress = reduceQuestProgress(chain, progress, 'break'); assert.equal(progress.current, 0); assert.equal(progress.best, 1);
  const sketch = createQuestEventDocument({ type: "The Scribe's Sketch", classId: 'c', dateKey: '2026-09-01', schoolYearKey: 'y', createdBy: {} });
  progress = reduceQuestProgress(sketch, getDefaultProgress(sketch), { step: 0 }); assert.equal(progress.current, 1);
  const saga = createQuestEventDocument({ type: 'Five-Sentence Saga', classId: 'c', dateKey: '2026-09-01', schoolYearKey: 'y', createdBy: {} });
  progress = reduceQuestProgress(saga, getDefaultProgress(saga), { type: 'next', index: 0, text: '<script>' }); assert.equal(progress.sentences[0], '<script>'); assert.equal(progress.current, 1);
});

test('modifier precedence is deterministic', () => {
  const modifier = resolveDailyModifier([{ type: 'Reason Bonus Day', details: { reason: 'teamwork' } }, { type: '2x Star Day' }]);
  assert.equal(modifier.type, 'double_star_day'); assert.equal(applyDailyModifier(1, 'teamwork', modifier), 2);
});

test('growth spotlight is dignity-first and seeded order is stable', () => {
  const card = buildGrowthSpotlight({ id: 's1', name: 'Maria' }, { currentLogs: [], previousLogs: [], attendedLessons: [] });
  assert.equal(card.key, 'special_part'); assert.match(card.publicText, /Maria/);
  assert.deepEqual(seededShuffle([1, 2, 3], 'same'), seededShuffle([1, 2, 3], 'same'));
});

test('growth garden keeps class scores private and reveals the pathfinder without ranks', () => {
  const sequence = buildGrowthPublicSequence({
    classes: [{ id: 'class-a', name: 'Nursery A', score: 42, rank: 1, progress: 88, topSkill: 'teamwork' }],
    pathfinderId: 'class-a',
    classId: 'class-a',
    monthKey: '2026-08'
  });
  assert.equal(sequence.garden[0].isPathfinder, true);
  assert.equal('score' in sequence.garden[0], false);
  assert.equal('rank' in sequence.garden[0], false);
});

test('canonical winners do not crown zero-data students', () => {
  const result = chooseCanonicalWinners({ studentResults: [{ id: 'a', score: 0 }, { id: 'b', score: 0 }] });
  assert.equal(result.collectiveClose, true); assert.equal(result.prodigyWinners.length, 0);
});

test('persisted class ranks keep the live Team Quest ranks and reveal order', () => {
  // Live queue: worst first, ranks from progress toward each class's own goal.
  const liveQueue = [
    { id: 'big', score: 500, progress: 60, rank: 2 },
    { id: 'small', score: 200, progress: 200, rank: 1 },
  ];
  const result = chooseCanonicalWinners({ classResults: liveQueue });
  assert.equal(result.classWinner.id, 'small');
  assert.deepEqual(result.classResults.map((item) => [item.id, item.rank]), [['big', 2], ['small', 1]]);
});

test('unranked class results rank by progress, not raw stars, with rank 1 as winner', () => {
  const result = chooseCanonicalWinners({ classResults: [
    { id: 'big', score: 500, progress: 60 },
    { id: 'small', score: 200, progress: 200 },
  ] });
  assert.equal(result.classWinner.id, 'small');
  assert.equal(result.classResults.at(-1).rank, 1);
});

test('podium student ties ignore the academic average, matching the live reveal', () => {
  const result = chooseCanonicalWinners({ studentResults: [
    { id: 'a', score: 10, count3: 1, count2: 0, uniqueReasons: 2, academicAvg: 90 },
    { id: 'b', score: 10, count3: 1, count2: 0, uniqueReasons: 2, academicAvg: 50 },
    { id: 'c', score: 3 },
  ] });
  assert.deepEqual(result.prodigyWinners.map((item) => item.id).sort(), ['a', 'b']);
  assert.equal(result.studentResults.at(-1).rank, 1);
  assert.equal(result.studentResults[0].id, 'c');
});

test('live student queue ranks (with stats) are preserved in the snapshot', () => {
  const result = chooseCanonicalWinners({ studentResults: [
    { id: 'p', rank: 3, score: 1, stats: { count3: 0 } },
    { id: 'q', rank: 1, score: 5, stats: { count3: 1 } },
    { id: 'r', rank: 1, score: 5, stats: { count3: 1 } },
  ] });
  assert.deepEqual(result.prodigyWinners.map((item) => item.id), ['q', 'r']);
  assert.deepEqual(result.studentResults[1].stats, { count3: 1 });
});
