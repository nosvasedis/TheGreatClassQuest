const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

async function loadShopRestock() {
  return import('../utils/shopRestock.js');
}

const complete = (overrides = {}) => ({
  id: 'a',
  name: 'Candy Corn Ruler',
  description: 'A sweet measuring wand.',
  price: 12,
  image: 'https://example.com/ruler.jpg',
  ...overrides
});

test('complete shop items need a name, description, and hosted image', async () => {
  const { isCompleteShopItem, isVisibleSeasonalShopItem } = await loadShopRestock();
  assert.equal(isCompleteShopItem(complete()), true);
  assert.equal(isCompleteShopItem(complete({ image: '' })), false);
  assert.equal(isCompleteShopItem(complete({ name: '  ' })), false);
  assert.equal(isVisibleSeasonalShopItem(complete({ incoming: true })), false);
  assert.equal(isVisibleSeasonalShopItem(complete()), true);
});

test('restock keeps complete items and only plans the missing slots', async () => {
  const { planShopRestock, SHOP_RESTOCK_ITEM_COUNT } = await loadShopRestock();
  const plan = planShopRestock([
    complete({ id: 'keep-1', price: 12 }),
    complete({ id: 'keep-2', name: 'Ghost Torch', price: 40 }),
    complete({ id: 'keep-3', name: 'Charm Bracelet', price: 90 }),
    complete({ id: 'keep-4', name: 'Snow Globe', price: 16 }),
    { id: 'broken', name: 'Phantom Lantern', description: 'Needs a picture', price: 18, image: '' }
  ]);

  assert.equal(plan.mode, 'fill');
  assert.equal(plan.needed, SHOP_RESTOCK_ITEM_COUNT - 5);
  assert.deepEqual(plan.keepIds, ['keep-1', 'keep-2', 'keep-3', 'keep-4']);
  assert.equal(plan.retry.length, 1);
  assert.equal(plan.retry[0].id, 'broken');
  assert.equal(plan.incoming, false);
  assert.equal(plan.tiers.common + plan.tiers.rare + plan.tiers.legendary, plan.needed);
});

test('a full stall starts a background replacement without deleting current treasures yet', async () => {
  const { planShopRestock, SHOP_RESTOCK_ITEM_COUNT } = await loadShopRestock();
  const fullStall = Array.from({ length: SHOP_RESTOCK_ITEM_COUNT }, (_, index) => complete({
    id: `old-${index}`,
    name: `Old ${index}`,
    price: index < 5 ? 12 : index < 10 ? 40 : 90
  }));
  const plan = planShopRestock(fullStall);
  assert.equal(plan.mode, 'replace');
  assert.equal(plan.needed, SHOP_RESTOCK_ITEM_COUNT);
  assert.equal(plan.incoming, true);
  assert.deepEqual(plan.retireIds, []);
});

test('a finished incoming batch swaps onto the stall', async () => {
  const { planShopRestock, SHOP_RESTOCK_ITEM_COUNT } = await loadShopRestock();
  const oldItems = Array.from({ length: SHOP_RESTOCK_ITEM_COUNT }, (_, index) => complete({
    id: `old-${index}`,
    name: `Old ${index}`,
    price: 12
  }));
  const incoming = Array.from({ length: SHOP_RESTOCK_ITEM_COUNT }, (_, index) => complete({
    id: `new-${index}`,
    name: `New ${index}`,
    price: 40,
    incoming: true
  }));
  const plan = planShopRestock([...oldItems, ...incoming]);
  assert.equal(plan.mode, 'swap');
  assert.equal(plan.needed, 0);
  assert.equal(plan.retireIds.length, SHOP_RESTOCK_ITEM_COUNT);
});

test('shop restock toasts tell the truth about background fill and partial shelves', async () => {
  const { shopRestockToast } = await loadShopRestock();

  const started = shopRestockToast({ mode: 'started-fill', completeCount: 4, missingCount: 11, league: 'Junior B' });
  assert.equal(started.type, 'info');
  assert.match(started.message, /background/i);

  const partial = shopRestockToast({ mode: 'fill', savedThisRun: 3, completeCount: 7, league: 'Junior B' });
  assert.equal(partial.type, 'info');
  assert.match(partial.message, /7 of 15/);
  assert.match(partial.message, /Tap Restock/);

  const full = shopRestockToast({ mode: 'fill', savedThisRun: 11, completeCount: 15, league: 'Junior B' });
  assert.equal(full.type, 'success');
  assert.match(full.message, /Junior B/);

  const empty = shopRestockToast({ mode: 'fill', savedThisRun: 0, completeCount: 0, league: 'Junior B' });
  assert.equal(empty.type, 'error');
});

test('shop restock does not wipe a live stall and runs in the background', async () => {
  const economy = fs.readFileSync(path.join(root, 'db/actions/economy.js'), 'utf8');
  const shop = fs.readFileSync(path.join(root, 'ui/core/shop.js'), 'utf8');
  const api = fs.readFileSync(path.join(root, 'api.js'), 'utf8');

  assert.match(economy, /planShopRestock\(/);
  assert.match(economy, /setShopRestockBusy\(/);
  assert.doesNotMatch(economy, /container\.innerHTML = ''/);
  assert.match(economy, /ignoreCircuit:\s*true/);
  assert.match(shop, /isVisibleSeasonalShopItem\(/);
  assert.match(shop, /setShopRestockBusy/);
  assert.match(api, /requestOptions\.ignoreCircuit/);
});
