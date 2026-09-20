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
  assert.match(started.message, /pictures arrive/i);

  const partial = shopRestockToast({ mode: 'fill', savedThisRun: 3, completeCount: 7, league: 'Junior B' });
  assert.equal(partial.type, 'info');
  assert.match(partial.message, /7 of 15/);
  assert.doesNotMatch(partial.message, /Tap Restock/);

  const full = shopRestockToast({ mode: 'fill', savedThisRun: 11, completeCount: 15, league: 'Junior B' });
  assert.equal(full.type, 'success');
  assert.match(full.message, /Junior B/);

  const empty = shopRestockToast({ mode: 'fill', savedThisRun: 0, completeCount: 0, league: 'Junior B' });
  assert.equal(empty.type, 'error');

  const replacing = shopRestockToast({ mode: 'replace', savedThisRun: 8, completeCount: 8, league: 'Junior B' });
  assert.equal(replacing.type, 'info');
  assert.match(replacing.message, /8 of 15 new treasures/);
  assert.match(replacing.message, /Today's stall stays/);

  const stillFullLooking = shopRestockToast({ mode: 'replace', savedThisRun: 3, completeCount: 15, league: 'Junior B' });
  assert.equal(stillFullLooking.type, 'info');
  assert.doesNotMatch(stillFullLooking.message, /are ready for Junior B!/);
});

test('Restock on a full stall starts replacement; auto-ensure does not', async () => {
  const { planShopRestock, shopStallNeedsWork, SHOP_RESTOCK_ITEM_COUNT } = await loadShopRestock();
  const fullStall = Array.from({ length: SHOP_RESTOCK_ITEM_COUNT }, (_, index) => complete({
    id: `old-${index}`,
    name: `Old ${index}`,
    price: index < 5 ? 12 : index < 10 ? 40 : 90
  }));
  const fullPlan = planShopRestock(fullStall);
  assert.equal(fullPlan.mode, 'replace');
  assert.equal(shopStallNeedsWork(fullPlan, { forceReplace: false }), false);
  assert.equal(shopStallNeedsWork(fullPlan, { forceReplace: true }), true);

  const incoming = Array.from({ length: 8 }, (_, index) => complete({
    id: `new-${index}`,
    name: `New ${index}`,
    price: 12,
    incoming: true
  }));
  const inProgress = planShopRestock([...fullStall, ...incoming]);
  assert.equal(inProgress.mode, 'replace');
  assert.equal(shopStallNeedsWork(inProgress, { forceReplace: false }), true);
});

test('legacy items without stock count as one copy and sold-out items hide', async () => {
  const {
    shopItemStock,
    isVisibleSeasonalShopItem,
    isVisibleFestivalShopItem,
    nextShopStockAfterPurchase
  } = await loadShopRestock();
  assert.equal(shopItemStock(complete()), 1);
  assert.equal(shopItemStock(complete({ stock: 5 })), 5);
  assert.equal(isVisibleSeasonalShopItem(complete({ stock: 0 })), false);
  assert.equal(isVisibleSeasonalShopItem(complete({ stock: 2 })), true);
  assert.equal(isVisibleFestivalShopItem(complete({ shelf: 'festival', stock: 2 })), true);
  assert.equal(isVisibleSeasonalShopItem(complete({ shelf: 'festival', stock: 2 })), false);
  assert.equal(nextShopStockAfterPurchase(complete({ stock: 5 })), 4);
  assert.equal(nextShopStockAfterPurchase(complete()), 0);
});

test('festival items are ignored by monthly fill and replace', async () => {
  const { planShopRestock, SHOP_RESTOCK_ITEM_COUNT, FESTIVAL_STALL_ITEM_COUNT } = await loadShopRestock();
  const monthly = Array.from({ length: 4 }, (_, index) => complete({
    id: `month-${index}`,
    name: `Month ${index}`,
    price: 12
  }));
  const festival = Array.from({ length: 5 }, (_, index) => complete({
    id: `fest-${index}`,
    name: `Fest ${index}`,
    price: 12,
    shelf: 'festival',
    festivalId: 'halloween-2026'
  }));
  const monthlyPlan = planShopRestock([...monthly, ...festival]);
  assert.equal(monthlyPlan.mode, 'fill');
  assert.equal(monthlyPlan.needed, SHOP_RESTOCK_ITEM_COUNT - 4);
  assert.equal(monthlyPlan.keepIds.length, 4);

  const festivalPlan = planShopRestock([...monthly, ...festival], { shelf: 'festival' });
  assert.equal(festivalPlan.mode, 'replace');
  assert.equal(festivalPlan.targetCount, FESTIVAL_STALL_ITEM_COUNT);
  assert.equal(festivalPlan.needed, FESTIVAL_STALL_ITEM_COUNT);
});

test('functions shop restock stays aligned with the app restock planner', async () => {
  const app = await import('../utils/shopRestock.js');
  const fn = await import('../functions/shop/restock.mjs');
  assert.equal(app.SHOP_RESTOCK_ITEM_COUNT, fn.SHOP_RESTOCK_ITEM_COUNT);
  assert.equal(app.FESTIVAL_STALL_ITEM_COUNT, fn.FESTIVAL_STALL_ITEM_COUNT);
  assert.deepEqual(app.SHOP_STOCK_BY_TIER, fn.SHOP_STOCK_BY_TIER);
  assert.equal(app.shopItemStock({}), 1);
  assert.equal(fn.shopItemStock({}), 1);
  assert.equal(typeof app.shopStallNeedsWork, 'function');
  assert.equal(typeof fn.shopStallNeedsWork, 'function');
  assert.equal(app.shopStallNeedsWork({ mode: 'replace', needed: 15, targetCount: 15 }), false);
  assert.equal(fn.shopStallNeedsWork({ mode: 'replace', needed: 15, targetCount: 15 }, { forceReplace: true }), true);
});

test('an empty monthly stall plans fifteen kinds and an empty festival stall plans five', async () => {
  const { planShopRestock, SHOP_RESTOCK_ITEM_COUNT, FESTIVAL_STALL_ITEM_COUNT } = await loadShopRestock();
  const emptyMonthly = planShopRestock([]);
  assert.equal(emptyMonthly.mode, 'fill');
  assert.equal(emptyMonthly.needed, SHOP_RESTOCK_ITEM_COUNT);
  assert.deepEqual(emptyMonthly.tiers, { common: 5, rare: 5, legendary: 5 });

  const emptyFestival = planShopRestock([], { shelf: 'festival' });
  assert.equal(emptyFestival.needed, FESTIVAL_STALL_ITEM_COUNT);
  assert.deepEqual(emptyFestival.tiers, { common: 2, rare: 2, legendary: 1 });

  const soldOut = planShopRestock([complete({ id: 'gone', stock: 0 })]);
  assert.equal(soldOut.needed, SHOP_RESTOCK_ITEM_COUNT);
});

test('shop restock does not wipe a live stall and runs in the background', async () => {
  const economy = fs.readFileSync(path.join(root, 'db/actions/economy.js'), 'utf8');
  const shop = fs.readFileSync(path.join(root, 'ui/core/shop.js'), 'utf8');
  const api = fs.readFileSync(path.join(root, 'api.js'), 'utf8');
  const functions = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');

  assert.match(economy, /ensureShopStock\(/);
  assert.match(economy, /setShopRestockBusy\(/);
  assert.match(economy, /handleEnsureShopStock/);
  assert.doesNotMatch(economy, /container\.innerHTML = ''/);
  assert.match(shop, /isVisibleSeasonalShopItem\(/);
  assert.match(shop, /Festival Stall/);
  assert.match(shop, /setShopRestockBusy/);
  assert.match(api, /requestOptions\.ignoreCircuit/);
  assert.match(functions, /exports\.ensureShopStock/);
  assert.match(functions, /exports\.maintainShopStock/);
  assert.match(functions, /0 21 \* \* \*/);
  assert.match(functions, /GCQ_AI_SERVICE_KEY/);
  assert.doesNotMatch(shop, /Restock weaves/);
  assert.doesNotMatch(shop, /Festival Stall weaves itself/);
});
