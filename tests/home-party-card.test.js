const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../features/homePartyCard.mjs');
const hero = (id, name, extra = {}) => ({ id, name, avatar: '', monthlyStars: 0, ...extra });

test('the class photo keeps the front row the fullest', async () => {
  const { arrangePartyRows } = await load();
  assert.deepEqual(arrangePartyRows(0), []);
  assert.deepEqual(arrangePartyRows(6), [6]);
  assert.deepEqual(arrangePartyRows(12), [6, 6]);
  assert.deepEqual(arrangePartyRows(13), [6, 7]);
  assert.deepEqual(arrangePartyRows(20), [6, 7, 7]);
});

test('the crest shows the virtue with the most stars', async () => {
  const { buildHomePartyCardHtml } = await load();
  const html = buildHomePartyCardHtml({ students: [hero('a', 'Anna')], virtueStars: { focus: 4, teamwork: 9.5 } });
  assert.match(html, /data-virtue="violet"/);
  assert.match(html, />Teamwork</);
  assert.match(html, /9\.5 of 13\.5 stars/);
});

test('before any stars the card is Ready to Quest', async () => {
  const { buildHomePartyCardHtml } = await load();
  const html = buildHomePartyCardHtml({ students: [hero('a', 'Anna')], virtueStars: {} });
  assert.match(html, /Ready to Quest!/);
  assert.match(html, /home-party__ribbon--empty/);
});

test('heroes keep the Hero Stage hooks, the level-up arrow and a gold star for the month leader', async () => {
  const { buildHomePartyCardHtml } = await load();
  const html = buildHomePartyCardHtml({
    students: [hero('b', 'Zoe', { monthlyStars: 3 }), hero('a', 'Anna <x>', { pendingSkillChoice: true, avatar: 'a.png' })],
    virtueStars: {}
  });
  assert.match(html, /class="home-party__avatar enlargeable-avatar" data-student-id="a"/);
  assert.match(html, /level-up-badge/);
  assert.ok(html.indexOf('Anna') < html.indexOf('Zoe'), 'sorted by name');
  assert.ok(!html.includes('<x>'), 'names are escaped');
  assert.match(html, /home-party__hero is-lead[^>]*>.*?data-student-id="b"/s);
});

test('away heroes are greyed out with an away badge and counted', async () => {
  const { buildHomePartyCardHtml } = await load();
  const html = buildHomePartyCardHtml({
    students: [hero('a', 'Anna'), hero('b', 'Ben')],
    virtueStars: {},
    absentIds: ['b']
  });
  assert.equal((html.match(/is-absent/g) || []).length, 1, 'only the absent hero is marked');
  assert.match(html, /home-party__hero is-absent[^>]*>.*?data-student-id="b"/s);
  assert.match(html, /home-party__away/);
  assert.match(html, /home-party__count--away/);
  assert.match(html, /<b>away<\/b>/);
});

test('with everyone present the card shows no away markings', async () => {
  const { buildHomePartyCardHtml } = await load();
  const html = buildHomePartyCardHtml({ students: [hero('a', 'Anna')], virtueStars: {}, absentIds: new Set() });
  assert.ok(!html.includes('home-party__count--away'));
  assert.ok(!html.includes('is-absent'));
});
