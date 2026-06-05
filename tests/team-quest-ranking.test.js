const test = require('node:test');
const assert = require('node:assert/strict');

test('Team Quest near-equal progress falls through to stars', async () => {
  const { assignUniqueTeamQuestRanks } = await import('../utils.js');

  const ranked = assignUniqueTeamQuestRanks([
    { id: 'team-1', name: 'Team 1', progress: 72.004, score: 120 },
    { id: 'team-2', name: 'Team 2', progress: 72.001, score: 135 },
    { id: 'team-3', name: 'Team 3', progress: 66, score: 150 }
  ]);

  assert.deepEqual(ranked.map((team) => team.id), ['team-2', 'team-1', 'team-3']);
  assert.deepEqual(ranked.map((team) => team.rank), [1, 2, 3]);
});

test('Team Quest equal progress and stars still produces deterministic unique ranks', async () => {
  const { assignUniqueTeamQuestRanks } = await import('../utils.js');

  const ranked = assignUniqueTeamQuestRanks([
    { id: 'beta', name: 'Beta Class', progress: 80, currentMonthlyStars: 160 },
    { id: 'alpha', name: 'Alpha Class', progress: 80, currentMonthlyStars: 160 },
    { id: 'gamma', name: 'Gamma Class', progress: 80, currentMonthlyStars: 160 }
  ]);

  assert.deepEqual(ranked.map((team) => team.name), ['Alpha Class', 'Beta Class', 'Gamma Class']);
  assert.deepEqual(ranked.map((team) => team.rank), [1, 2, 3]);
});

test('Team Quest helper keeps ceremony and leaderboard field names aligned', async () => {
  const { sortTeamQuestEntries } = await import('../utils.js');

  const ceremonyEntry = { id: 'ceremony', name: 'Ceremony Team', progress: 50, score: 91 };
  const leaderboardEntry = { id: 'leaderboard', name: 'Leaderboard Team', progress: 50, currentMonthlyStars: 92 };

  assert.equal(sortTeamQuestEntries(ceremonyEntry, leaderboardEntry), 1);
  assert.equal(sortTeamQuestEntries(leaderboardEntry, ceremonyEntry), -1);
});
