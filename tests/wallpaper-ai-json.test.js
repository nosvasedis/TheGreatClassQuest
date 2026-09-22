const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

async function loadParser() {
  return import('../utils/aiJson.js');
}

test('truncated wallpaper AI JSON recovers complete items instead of throwing', async () => {
  const { parseDailyWallpaperAiItems } = await loadParser();
  const truncated = `[
    {"type":"joke","content":"Why did the pencil go to school? To get to the point."},
    {"type":"word","content":"beacon","answer":"a light that guides"},
    {"type":"fact_science","content":"Octopuses have three hearts`;

  assert.doesNotThrow(() => parseDailyWallpaperAiItems(truncated));
  const items = parseDailyWallpaperAiItems(truncated);
  assert.equal(items.length, 2);
  assert.equal(items[0].type, 'joke');
  assert.equal(items[1].type, 'word');
  assert.equal(items[1].answer, 'a light that guides');
});

test('empty or incomplete wallpaper AI JSON returns no items instead of throwing', async () => {
  const { parseDailyWallpaperAiItems } = await loadParser();
  assert.deepEqual(parseDailyWallpaperAiItems(''), []);
  assert.deepEqual(parseDailyWallpaperAiItems('   '), []);
  assert.deepEqual(parseDailyWallpaperAiItems('['), []);
  assert.deepEqual(parseDailyWallpaperAiItems('```json\n```'), []);
});

test('valid fenced wallpaper AI JSON still parses', async () => {
  const { parseDailyWallpaperAiItems } = await loadParser();
  const items = parseDailyWallpaperAiItems(`\`\`\`json
[{"type":"riddle","content":"What has keys but no locks?","answer":"A piano"}]
\`\`\``);
  assert.equal(items.length, 1);
  assert.equal(items[0].type, 'riddle');
  assert.equal(items[0].answer, 'A piano');
});

test('wallpaper AI items with braces in content survive truncated recovery', async () => {
  const { parseDailyWallpaperAiItems } = await loadParser();
  const truncated = '[{"type":"joke","content":"Set {1,2,3} is not a club."},{"type":"word","content":"partial';
  const items = parseDailyWallpaperAiItems(truncated);
  assert.equal(items.length, 1);
  assert.equal(items[0].content, 'Set {1,2,3} is not a club.');
});

test('wallpaper AI parser drops invalid types and blank content', async () => {
  const { parseDailyWallpaperAiItems } = await loadParser();
  const items = parseDailyWallpaperAiItems(JSON.stringify([
    { type: 'joke', content: 'A valid joke' },
    { type: 'gossip', content: 'skip me' },
    { type: 'riddle', content: '   ' }
  ]));
  assert.equal(items.length, 1);
  assert.equal(items[0].type, 'joke');
});

test('wallpaper daily AI generation does not JSON.parse a 30-item payload', () => {
  const wallpaper = read('ui/wallpaper.js');
  assert.match(wallpaper, /parseDailyWallpaperAiItems/);
  assert.doesNotMatch(wallpaper, /JSON\.parse\(cleanJson\)/);
  assert.doesNotMatch(wallpaper, /EXACTLY 30 objects/);
  assert.doesNotMatch(wallpaper, /Generate 30 items now/);
});
