import test from 'node:test';
import assert from 'node:assert/strict';
import { QUEST_DEFINITIONS, SPECIAL_QUEST_TYPES, createQuestEventDocument, getDefaultProgress, reduceQuestProgress, resolveDailyModifier, applyDailyModifier, validateQuestEvent } from '../features/specialQuestEngine.js';
import { CEREMONY_MODES, resolveCeremonyMode, seededShuffle, buildGrowthSpotlight, chooseCanonicalWinners } from '../features/ceremonyDomain.js';
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

test('canonical winners do not crown zero-data students', () => {
  const result = chooseCanonicalWinners({ studentResults: [{ id: 'a', score: 0 }, { id: 'b', score: 0 }] });
  assert.equal(result.collectiveClose, true); assert.equal(result.prodigyWinners.length, 0);
});

