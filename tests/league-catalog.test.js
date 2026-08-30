const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('quest league catalogue exposes the complete progression and metadata', async () => {
  const constants = await import('../constants.js');
  assert.deepEqual(constants.questLeagues, [
    'Nursery', 'Pre-Junior', 'Junior A', 'Junior B',
    'A', 'B', 'C', 'D', 'E', 'Lower', 'Proficiency',
  ]);
  assert.deepEqual(constants.JUNIOR_LEAGUES, [
    'Nursery', 'Pre-Junior', 'Junior A', 'Junior B',
  ]);

  const nursery = constants.getQuestLeagueDefinition('Nursery');
  const preJunior = constants.getQuestLeagueDefinition('Pre-Junior');
  const proficiency = constants.getQuestLeagueDefinition('Proficiency');
  assert.equal(nursery.ageGroup, '5-6');
  assert.equal(nursery.ageCategory, 'early');
  assert.equal(nursery.isYoungLearner, true);
  assert.equal(preJunior.ageGroup, '6-7');
  assert.equal(proficiency.ageGroup, '15+');
  assert.equal(proficiency.curriculumTier, 'proficiency');
});

test('league helpers classify early, mid, and senior levels correctly', async () => {
  const utils = await import('../utils.js');
  assert.equal(utils.getAgeGroupForLeague('Nursery'), '5-6');
  assert.equal(utils.getAgeCategoryForLeague('Pre-Junior'), 'early');
  assert.equal(utils.getAgeTierForLeague('Nursery'), 'junior');
  assert.equal(utils.isYoungLearnerLeague('Junior B'), true);
  assert.equal(utils.isYoungLearnerLeague('A'), false);
  assert.equal(utils.getAgeGroupForLeague('E'), '13-14');
  assert.equal(utils.getAgeGroupForLeague('Lower'), '14-15');
  assert.equal(utils.getAgeTierForLeague('Proficiency'), 'senior');
});

test('returning-student progression spans every new league', async () => {
  const { getNaturalProgressionLeague } = await import('../utils/returningStudents.js');
  const pairs = [
    ['Nursery', 'Pre-Junior'],
    ['Pre-Junior', 'Junior A'],
    ['D', 'E'],
    ['E', 'Lower'],
    ['Lower', 'Proficiency'],
    ['Proficiency', null],
  ];
  for (const [current, next] of pairs) {
    assert.equal(getNaturalProgressionLeague(current), next);
  }
});

test('assessment defaults include all leagues and keep young learners gentle', async () => {
  global.localStorage = global.localStorage || {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const { normalizeAssessmentDefaultsByLeague } = await import('../features/assessmentConfig.js');
  const defaults = normalizeAssessmentDefaultsByLeague({});
  assert.deepEqual(Object.keys(defaults), [
    'Nursery', 'Pre-Junior', 'Junior A', 'Junior B',
    'A', 'B', 'C', 'D', 'E', 'Lower', 'Proficiency',
  ]);
  assert.equal(defaults.Nursery.tests.mode, 'none');
  assert.equal(defaults.Nursery.dictations.mode, 'none');
  assert.equal(defaults['Pre-Junior'].tests.mode, 'none');
  assert.equal(defaults['Pre-Junior'].dictations.mode, 'none');
  assert.equal(defaults['Junior A'].tests.maxScore, 40);
  assert.equal(defaults['Junior A'].dictations.mode, 'qualitative');
  assert.equal(defaults.Proficiency.tests.maxScore, 100);
});

test('sorting quiz uses dedicated early pools and senior content for advanced leagues', async () => {
  const { getQuestionsForLevel } = await import('../features/guildQuiz.js');
  const nursery = getQuestionsForLevel('Nursery');
  const preJunior = getQuestionsForLevel('Pre-Junior');
  const senior = getQuestionsForLevel('D');
  assert.ok(nursery.length >= 7);
  assert.ok(preJunior.length >= 7);
  assert.ok(nursery.every((question) => question.id.startsWith('n')));
  assert.ok(preJunior.every((question) => question.id.startsWith('pj')));
  assert.equal(getQuestionsForLevel('E'), senior);
  assert.equal(getQuestionsForLevel('Lower'), senior);
  assert.equal(getQuestionsForLevel('Proficiency'), senior);
});

test('league picker is themed, repeatable, silent, and uses a wide desktop grid', () => {
  const picker = read('ui/modals/base.js');
  const pickerFunction = picker.slice(
    picker.indexOf('export function showLeaguePicker'),
    picker.indexOf('export function showLogoPicker'),
  );
  assert.match(pickerFunction, /QUEST_LEAGUE_DEFINITIONS/);
  assert.match(pickerFunction, /definition\.name === 'Proficiency'/);
  assert.match(pickerFunction, /league-picker-option--wide col-span-2/);
  assert.match(pickerFunction, /league-match-active-btn w-full col-span-2 md:col-span-4/);
  assert.match(pickerFunction, /league-picker-option__watermark/);
  assert.match(pickerFunction, /is-selected/);
  const unlockIndex = pickerFunction.indexOf("list.classList.remove('is-selecting')");
  const rebuildIndex = pickerFunction.indexOf("list.innerHTML = chunks.join('')");
  assert.ok(unlockIndex >= 0, 'reopening must clear the prior selection lock');
  assert.ok(unlockIndex < rebuildIndex, 'the prior selection lock must clear before rebuilding buttons');
  assert.doesNotMatch(pickerFunction, /playSound/);

  const template = read('templates/modals/base.js');
  assert.match(template, /league-picker-shell[^\n]+max-w-5xl/);
  assert.match(template, /league-picker-list[^\n]+grid-cols-2 md:grid-cols-4/);

  const css = read('styles/modals.css');
  for (const theme of [
    'nursery', 'pre-junior', 'junior-a', 'junior-b',
    'a', 'b', 'c', 'd', 'e', 'lower', 'proficiency',
  ]) {
    assert.match(css, new RegExp(`league-picker-option--${theme}\\s*\\{`));
  }
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('Quiz of the Week has an explicit curriculum for every league', () => {
  const source = read('ui/tabs/navigation.js');
  for (const league of [
    'Nursery', 'Pre-Junior', 'Junior A', 'Junior B',
    'A', 'B', 'C', 'D', 'E', 'Lower', 'Proficiency',
  ]) {
    const occurrences = source.match(new RegExp(`'${league.replace('-', '\\-')}': \\[`, 'g')) || [];
    assert.equal(occurrences.length, 3, `${league} should have grammar, vocabulary, and mixed curricula`);
  }
});
