const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../features/homeQuestRoadCard.mjs');

test('the road names the realm the class is in and the stars to the next one', async () => {
  const { describeQuestRoad } = await load();
  const mid = describeQuestRoad({ stars: 86, goal: 138 });
  assert.equal(mid.zone.id, 'gold');
  assert.equal(mid.next.id, 'crystal');
  assert.equal(mid.toGo, 32);
  const start = describeQuestRoad({ stars: 0, goal: 120 });
  assert.equal(start.zone.id, 'bronze');
  assert.equal(start.toGo, 36);
});

test('past the last realm the line counts down to the goal, then says it is reached', async () => {
  const { describeQuestRoad, buildHomeQuestRoadCardHtml } = await load();
  const near = describeQuestRoad({ stars: 130, goal: 138 });
  assert.equal(near.next, undefined);
  assert.equal(near.toGo, 8);
  const done = buildHomeQuestRoadCardHtml({ stars: 141, goal: 138, bonus: 3 });
  assert.match(done, /Goal reached! Step through the Portal/);
  assert.match(done, />102<small>%/);
  assert.match(done, /incl\. \+3 Pathfinder/);
  assert.match(done, /\+3 past the goal/);
});

test('a full road waits at the Portal: sealed shows what still sleeps', async () => {
  const { buildHomeQuestRoadCardHtml } = await load();
  const sealed = buildHomeQuestRoadCardHtml({ stars: 140, goal: 138, portal: { open: false, completed: false, state: 'sealed', runes: [{ id: 'focus', met: false }] } });
  assert.match(sealed, /data-place="sealed"/);
  assert.match(sealed, /At the sealed Portal/);
  assert.match(sealed, /1 rune still sleeps/);
  assert.match(sealed, /qroad__portal--sealed/);
  assert.ok(!sealed.includes('qroad--sky'));
});

test('through the Portal the card climbs the Starward Way to the next named stone', async () => {
  const { buildHomeQuestRoadCardHtml } = await load();
  const sky = buildHomeQuestRoadCardHtml({ stars: 160, goal: 128, portal: { open: true, completed: true } });
  assert.match(sky, /qroad--sky/);
  assert.match(sky, />125<small>%/);
  assert.match(sky, /Comet’s Rest/);
  assert.match(sky, /to <i class="fas fa-crown"><\/i>The Star Crown/);
  const inside = buildHomeQuestRoadCardHtml({ stars: 128, goal: 128, portal: { open: true, completed: true } });
  assert.match(inside, /data-place="inside"/);
  assert.match(inside, /Inside the Portal/);
  const palace = buildHomeQuestRoadCardHtml({ stars: 300, goal: 128, portal: { open: true, completed: true } });
  assert.match(palace, /data-place="palace"/);
  assert.match(palace, /Home at the top of the Crystal Sky/);
});

test('the percent never shows 100 before the goal is reached', async () => {
  const { buildHomeQuestRoadCardHtml } = await load();
  assert.match(buildHomeQuestRoadCardHtml({ stars: 137.5, goal: 138 }), />99<small>%/);
});

test('the class emblem is escaped and there is no trail before the first star', async () => {
  const { buildHomeQuestRoadCardHtml } = await load();
  const html = buildHomeQuestRoadCardHtml({ stars: 0, goal: 18, logo: '<b>' });
  assert.ok(html.includes('qroad__token-pin">&lt;b&gt;<'));
  assert.ok(!html.includes('qroad__trail'));
});
