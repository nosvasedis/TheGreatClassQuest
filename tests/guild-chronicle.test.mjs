import test from 'node:test';
import assert from 'node:assert/strict';
import { chapterFacts, heraldChronicleLines, parseChroniclerLines, sealedChapterKeys, storedChronicle } from '../features/guildChronicleText.js';

const year = '2026-2027';
const sealed = (place, crowns, perMember, unity = false) => ({ place, crowns, perMember, unity, memberCount: 5 });
const scores = {
  owl_wisdom: { sealedChapters: { m2026_09: sealed(2, 3, 8), m2026_10: sealed(1, 6, 12.5, true) }, chapters: { m2026_10: { members: { s1: 20, s2: 4 } } } },
  dragon_flame: { sealedChapters: { m2026_09: sealed(1, 5, 9), m2026_10: sealed(2, 3, 10) } },
  grizzly_might: { sealedChapters: { m2026_09: sealed(3, 2, 4), m2026_10: sealed(3, 2, 6) } },
  phoenix_rising: { sealedChapters: { m2026_09: sealed(4, 1, 1), m2026_10: sealed(4, 1, 2) }, chronicles: { m2026_09: { lines: ['a', 'b', 'c', 'd'] } } },
};

test('sealed Chapters are listed oldest first, and a stored chronicle is found on any guild', () => {
  assert.deepEqual(sealedChapterKeys(scores, year), ['m2026_09', 'm2026_10']);
  assert.deepEqual(storedChronicle(scores, 'm2026_09').lines, ['a', 'b', 'c', 'd']);
  assert.equal(storedChronicle(scores, 'm2026_10'), null);
});

test("the herald's record names the winner, its brightest member, the Unity Seal and the race", () => {
  const facts = chapterFacts(scores, 'm2026_10', { schoolYearKey: year, students: [{ id: 's1', name: 'Mia' }, { id: 's2', name: 'Leo' }] });
  assert.equal(facts.guilds[0].guildId, 'owl_wisdom');
  assert.equal(facts.guilds[0].brightest, 'Mia');
  assert.equal(facts.standing[0].guildId, 'owl_wisdom'); // 3 + 6 = 9 Crowns
  const lines = heraldChronicleLines(facts);
  assert.equal(lines.length, 4);
  assert.match(lines[0], /October/);
  assert.match(lines[1], /Mia/);
  assert.match(lines[2], /Unity Seal/);
  assert.match(lines[3], /9 Crowns/);
});

test("the Chronicler's answer is read as a JSON array or as plain lines", () => {
  assert.deepEqual(parseChroniclerLines('```json\n["One.", "Two.", "Three.", "Four."]\n```'), ['One.', 'Two.', 'Three.', 'Four.']);
  assert.deepEqual(parseChroniclerLines('1. One.\n2. Two.\n3. Three.\n4. Four.'), ['One.', 'Two.', 'Three.', 'Four.']);
  assert.equal(parseChroniclerLines('Only one line.'), null);
});
