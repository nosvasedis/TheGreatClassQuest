'use strict';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function normalizeCatalogItem(item) {
  const name = String(item?.name || '').trim();
  const desc = String(item?.desc || item?.description || '').trim();
  const price = Number(item?.price);
  if (!name || !desc || !Number.isFinite(price)) return null;
  return {
    name,
    desc,
    price: Math.round(price),
    id: item.id || null,
    look: String(item?.look || '').trim(),
    collection: String(item?.collection || '').trim()
  };
}

function createShopEngine({ db, storage, FieldValue, publicDataPath }) {
  const calendarP = import('./calendar.mjs');
  const restockP = import('./restock.mjs');
  const briefP = import('./brief.mjs');
  const ai = require('./ai');

  // This month's items plus the active festival's items. A festival window can start in the
  // month before its feast, so its stall is found by festivalId rather than by month.
  async function loadStock(teacherId, league, monthKey, festivalId = '') {
    const monthQuery = db.collection(`${publicDataPath}/shop_items`)
      .where('league', '==', league)
      .where('monthKey', '==', monthKey)
      .where('teacherId', '==', teacherId)
      .get();
    const festivalQuery = festivalId
      ? db.collection(`${publicDataPath}/shop_items`).where('festivalId', '==', festivalId).get()
      : Promise.resolve(null);
    const [monthSnap, festivalSnap] = await Promise.all([monthQuery, festivalQuery]);
    const byId = new Map();
    monthSnap.docs.forEach((docSnap) => byId.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
    (festivalSnap?.docs || []).forEach((docSnap) => {
      const data = docSnap.data() || {};
      if (data.teacherId !== teacherId || data.league !== league) return;
      if (!byId.has(docSnap.id)) byId.set(docSnap.id, { id: docSnap.id, ...data });
    });
    return [...byId.values()];
  }

  async function deleteIds(ids) {
    const unique = [...new Set((ids || []).filter(Boolean))];
    for (const group of chunk(unique, 400)) {
      const batch = db.batch();
      group.forEach((id) => batch.delete(db.doc(`${publicDataPath}/shop_items/${id}`)));
      await batch.commit();
    }
  }

  async function uploadPng(bytes, path) {
    const bucket = storage.bucket();
    const file = bucket.file(path);
    const token = require('node:crypto').randomUUID();
    await file.save(bytes, {
      resumable: false,
      metadata: {
        contentType: 'image/png',
        metadata: { firebaseStorageDownloadTokens: token }
      }
    });
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  }

  // Every picture gets its own file. Re-using one path per name and month let a second
  // league with the same treasure name (or a later redraw) overwrite the file and reset
  // its download token, which broke the picture already saved on the other item.
  function shopImagePath({ teacherId, yearKey, monthKey, league, name }) {
    const leagueKey = String(league || 'league').replace(/[^\w-]+/g, '_');
    return `shop_items/${teacherId}/${yearKey}/${monthKey}_${leagueKey}_${ai.simpleHashCode(name)}_${Date.now()}.png`;
  }

  async function generateImage(item, league, palette = '') {
    const brief = await briefP;
    const prompt = brief.buildImagePrompt(item, { league, palette });
    const negativePrompt = brief.buildImageNegativePrompt(league);
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        // Shop icons are shown small; 512 is one FLUX tile instead of four.
        return await ai.shopAiImage(prompt, negativePrompt, { width: 512, height: 512 });
      } catch (error) {
        lastError = error;
        await sleep(Math.min(2500 * (attempt + 1), 20000));
      }
    }
    throw lastError || new Error('Shop image generation failed.');
  }

  async function persistItem({ item, imageUrl, incoming, league, monthKey, teacherId, teacherName, yearKey, shelf, festivalId }) {
    const restock = await restockP;
    const tier = restock.shopItemTier(item.price);
    const stock = restock.stockMaxForTier(tier);
    const payload = {
      name: item.name,
      description: item.desc,
      price: item.price,
      image: imageUrl || '',
      incoming: Boolean(incoming),
      league,
      monthKey,
      teacherId,
      shelf,
      tier,
      stock,
      stockMax: stock,
      schoolYearKey: yearKey,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: { uid: teacherId, name: teacherName || 'Teacher' }
    };
    if (shelf === 'festival') payload.festivalId = festivalId;
    if (item.look) payload.look = item.look;
    if (item.collection) payload.collection = item.collection;
    if (item.id) {
      await db.doc(`${publicDataPath}/shop_items/${item.id}`).update({
        image: imageUrl || '',
        incoming: Boolean(incoming),
        description: item.desc,
        price: item.price,
        stock,
        stockMax: stock,
        shelf,
        tier
      });
      return item.id;
    }
    const ref = db.collection(`${publicDataPath}/shop_items`).doc();
    await ref.set(payload);
    return ref.id;
  }

  async function produceItems(items, context) {
    let savedThisRun = 0;
    for (const group of chunk(items, 2)) {
      await Promise.all(group.map(async (item) => {
        try {
          const bytes = await generateImage(item, context.league, context.theme?.palette);
          const path = shopImagePath({ ...context, name: item.name });
          const imageUrl = await uploadPng(bytes, path);
          await persistItem({ ...context, item, imageUrl });
          savedThisRun += 1;
        } catch (error) {
          console.error('Item gen failed:', item.name, error);
          if (!item.id) {
            try {
              item.id = await persistItem({ ...context, item, imageUrl: '' });
            } catch (persistErr) {
              console.error('Failed to keep unfinished shop item:', item.name, persistErr);
            }
          }
        }
      }));
    }
    return savedThisRun;
  }

  async function askMerchant(systemPrompt) {
    const jsonString = await ai.shopAiChat(systemPrompt, 'Output the JSON array now.');
    try {
      return ai.extractJsonFromAiText(jsonString);
    } catch (_) {
      const fixedJson = await ai.shopAiChat(
        'You must output ONLY a valid JSON array. No explanation, no markdown. Fix and return this JSON array:',
        jsonString
      );
      return ai.extractJsonFromAiText(fixedJson);
    }
  }

  // Invents treasures from the stall's brief, drops anything off-season or wrong for the
  // age group, and asks once more for whatever the checks threw out.
  async function inventCatalog({ league, needed, tiers, theme, collection = null, existingNames }) {
    if (needed <= 0) return [];
    const brief = await briefP;
    const taken = new Set(existingNames.map((name) => String(name).toLowerCase()));
    const accepted = [];
    const wanted = { ...tiers };
    const count = (rows) => (rows.common || 0) + (rows.rare || 0) + (rows.legendary || 0);
    // Batches of up to 8, plus one extra ask for anything the checks threw out.
    const maxAsks = Math.ceil(count(wanted) / 8) + 1;
    for (let ask = 0; ask < maxAsks && count(wanted) > 0; ask += 1) {
      const batch = brief.nextTierBatch(wanted, 8);
      const systemPrompt = brief.buildCatalogBrief({
        league,
        needed: count(batch),
        tiers: batch,
        theme,
        collection,
        avoidNames: [...existingNames, ...accepted.map((item) => item.name)]
      });
      let raw = [];
      try {
        raw = await askMerchant(systemPrompt);
      } catch (error) {
        if (!accepted.length && ask === maxAsks - 1) throw error;
        console.error('Shop catalog batch failed:', league, error?.message || error);
        continue;
      }
      const fresh = (Array.isArray(raw) ? raw : [])
        .map(brief.normalizeBriefItem)
        .filter(Boolean)
        .filter((item) => {
          const reason = brief.shopItemRejection(item, { league, theme });
          if (reason) {
            console.log(JSON.stringify({ event: 'shopItemRejected', league, name: item.name, reason }));
            return false;
          }
          const key = item.name.toLowerCase();
          if (taken.has(key)) return false;
          taken.add(key);
          return true;
        });
      brief.balanceTiers(fresh, batch).forEach((item) => {
        accepted.push({ ...item, collection: collection?.name || '' });
        wanted[item.tier] = Math.max(0, (wanted[item.tier] || 0) - 1);
      });
    }
    return accepted.slice(0, needed);
  }

  // Topping up keeps the collection already on the shelf. A fresh stall keeps the collection
  // its first new pictures were made in, or else brings one the live stall is not using.
  async function stallBrief({ shelf, festival, monthKey }, items, incoming) {
    const brief = await briefP;
    const theme = brief.stallTheme({ shelf, festival, monthKey });
    const onShelf = (items || []).filter((item) => String(item.shelf || 'seasonal') === shelf);
    const collectionOf = (rows) => rows.map((item) => String(item.collection || '')).find(Boolean) || '';
    const live = collectionOf(onShelf.filter((item) => !item.incoming));
    const arriving = collectionOf(onShelf.filter((item) => item.incoming));
    const collection = incoming
      ? (arriving
        ? brief.pickCollection(theme, { current: arriving, keep: true })
        : brief.pickCollection(theme, { current: live }))
      : brief.pickCollection(theme, { current: live, keep: true });
    return { theme, collection };
  }

  async function applyPlan(plan, currentItems, context) {
    const restock = await restockP;
    const idsToClear = plan.mode === 'swap'
      ? plan.removeIds
      : [...plan.retireIds, ...plan.removeIds];
    await deleteIds(idsToClear);
    let items = currentItems;
    if (idsToClear.length) items = await loadStock(context.teacherId, context.league, context.monthKey, context.activeFestivalId);
    let nextPlan = idsToClear.length ? restock.planShopRestock(items, { shelf: context.shelf }) : plan;

    if (nextPlan.mode === 'swap') {
      const batch = db.batch();
      nextPlan.swapIncomingIds.forEach((id) => {
        batch.update(db.doc(`${publicDataPath}/shop_items/${id}`), { incoming: false });
      });
      nextPlan.retireIds.forEach((id) => {
        batch.delete(db.doc(`${publicDataPath}/shop_items/${id}`));
      });
      await batch.commit();
      return { mode: 'swap', savedThisRun: 0, completeCount: nextPlan.targetCount };
    }

    const { theme, collection } = await stallBrief(context, items, nextPlan.incoming);
    const making = { ...context, theme, incoming: nextPlan.incoming };
    const retryItems = nextPlan.retry.map(normalizeCatalogItem).filter(Boolean);
    let savedThisRun = await produceItems(retryItems, making);
    const catalog = await inventCatalog({
      league: context.league,
      needed: nextPlan.needed,
      tiers: nextPlan.tiers,
      theme,
      collection,
      existingNames: nextPlan.existingNames
    });
    savedThisRun += await produceItems(catalog, making);

    const latest = await loadStock(context.teacherId, context.league, context.monthKey, context.activeFestivalId);
    const latestPlan = restock.planShopRestock(latest, { shelf: context.shelf });
    if (latestPlan.mode === 'swap') {
      const batch = db.batch();
      latestPlan.swapIncomingIds.forEach((id) => {
        batch.update(db.doc(`${publicDataPath}/shop_items/${id}`), { incoming: false });
      });
      latestPlan.retireIds.forEach((id) => {
        batch.delete(db.doc(`${publicDataPath}/shop_items/${id}`));
      });
      await batch.commit();
    }
    const visibleCount = context.shelf === 'festival'
      ? latest.filter(restock.isVisibleFestivalShopItem).length
      : latest.filter(restock.isVisibleSeasonalShopItem).length;
    const incomingReady = latest.filter((item) => (
      Boolean(item.incoming)
      && restock.isCompleteShopItem(item)
      && restock.shopItemShelf(item) === context.shelf
    )).length;
    const swapped = latestPlan.mode === 'swap';
    return {
      mode: swapped ? 'swap' : nextPlan.mode,
      savedThisRun,
      completeCount: (nextPlan.incoming || swapped)
        ? (swapped ? (latestPlan.targetCount || incomingReady) : incomingReady)
        : visibleCount,
      needed: latestPlan.needed
    };
  }

  async function expireStaleFestivals(items, activeFestival) {
    const stale = items.filter((item) => {
      if (String(item.shelf || '') !== 'festival') return false;
      if (!activeFestival) return true;
      return String(item.festivalId || '') !== activeFestival.festivalId;
    });
    await deleteIds(stale.map((item) => item.id));
    return stale.length;
  }

  async function withLock(lockId, fn, { waitMs = 0 } = {}) {
    const ref = db.doc(`${publicDataPath}/shop_restock_locks/${lockId}`);
    const deadline = Date.now() + Math.max(0, Number(waitMs) || 0);
    while (true) {
      const snap = await ref.get();
      const data = snap.data() || {};
      const running = data.status === 'running' && Number(data.startedAtMs) > Date.now() - (9 * 60 * 1000);
      if (!running) break;
      if (Date.now() >= deadline) return { skipped: true, reason: 'locked' };
      await sleep(1500);
    }
    await ref.set({
      status: 'running',
      startedAtMs: Date.now(),
      startedAt: FieldValue.serverTimestamp()
    });
    try {
      return await fn();
    } finally {
      await ref.set({
        status: 'idle',
        finishedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  async function ensureStall({ teacherId, teacherName, league, yearKey, mode = 'ensure' }) {
    const calendar = await calendarP;
    const restock = await restockP;
    const monthKey = calendar.shopMonthKey();
    const festival = calendar.getActiveFestival();
    const lockId = `${teacherId}_${league}_${monthKey}`.replace(/[^\w.-]+/g, '_');

    const activeFestivalId = festival?.festivalId || '';

    return withLock(lockId, async () => {
      let items = await loadStock(teacherId, league, monthKey, activeFestivalId);
      const expired = await expireStaleFestivals(items, festival);
      if (expired) items = await loadStock(teacherId, league, monthKey, activeFestivalId);

      const result = { expired, monthly: null, festival: null };
      const monthlyPlan = restock.planShopRestock(items, { shelf: 'seasonal' });
      const monthlyNeedsWork = restock.shopStallNeedsWork(monthlyPlan, {
        forceReplace: mode === 'replace-monthly'
      });

      if (monthlyNeedsWork) {
        result.monthly = await applyPlan(monthlyPlan, items, {
          teacherId,
          teacherName,
          league,
          yearKey,
          monthKey,
          shelf: 'seasonal',
          activeFestivalId
        });
        items = await loadStock(teacherId, league, monthKey, activeFestivalId);
      }

      if (festival) {
        const festivalPlan = restock.planShopRestock(items, { shelf: 'festival' });
        const festivalNeedsWork = restock.shopStallNeedsWork(festivalPlan);
        if (festivalNeedsWork) {
          result.festival = await applyPlan(festivalPlan, items, {
            teacherId,
            teacherName,
            league,
            yearKey,
            monthKey,
            shelf: 'festival',
            festivalId: festival.festivalId,
            activeFestivalId,
            festival
          });
        }
      }

      return result;
    }, { waitMs: mode === 'replace-monthly' ? 20000 : 0 });
  }

    async function manageItem({ teacherId, teacherName, yearKey, itemId, action }) {
      const calendar = await calendarP;
      const restock = await restockP;
      const ref = db.doc(`${publicDataPath}/shop_items/${itemId}`);
      const snap = await ref.get();
      if (!snap.exists) {
        const error = new Error('That treasure is no longer on the stall.');
        error.code = 'not-found';
        throw error;
      }
      const item = { id: snap.id, ...snap.data() };
      if (item.teacherId !== teacherId) {
        const error = new Error('You can only manage treasures on your own stall.');
        error.code = 'permission-denied';
        throw error;
      }
      if (!restock.isManagedShopShelf(item)) {
        const error = new Error('Market Manager only edits Seasonal Treasures and the Festival Stall.');
        error.code = 'failed-precondition';
        throw error;
      }
      const league = String(item.league || '').trim();
      const monthKey = String(item.monthKey || calendar.shopMonthKey()).trim();
      const lockId = `${teacherId}_${league}_${monthKey}`.replace(/[^\w.-]+/g, '_');
      return withLock(lockId, async () => {
        const latestSnap = await ref.get();
        if (!latestSnap.exists) {
          const error = new Error('That treasure is no longer on the stall.');
          error.code = 'not-found';
          throw error;
        }
        const latest = { id: latestSnap.id, ...latestSnap.data() };
        const shelf = restock.shopItemShelf(latest);
        const brief = await briefP;
        const activeFestival = calendar.getActiveFestival();
        const itemFestival = shelf === 'festival'
          ? (activeFestival && activeFestival.festivalId === latest.festivalId
            ? activeFestival
            : { id: String(latest.festivalId || '').replace(/-\d{4}$/, ''), name: 'Festival' })
          : null;
        const theme = brief.stallTheme({ shelf, festival: itemFestival, monthKey });
        if (action === 'new-picture') {
          const bytes = await generateImage({
            name: latest.name,
            desc: latest.description || latest.desc,
            look: latest.look,
            price: latest.price
          }, league, theme.palette);
          const path = shopImagePath({ teacherId, yearKey, monthKey, league, name: latest.name });
          const imageUrl = await uploadPng(bytes, path);
          await ref.update({ image: imageUrl });
          return { ok: true, action, itemId, image: imageUrl };
        }
        if (action === 'replace') {
          const festival = activeFestival;
          const stall = await loadStock(teacherId, league, monthKey, festival?.festivalId || '');
          const avoidNames = stall
            .filter((row) => row.id !== latest.id && restock.shopItemShelf(row) === shelf)
            .map((row) => row.name)
            .filter(Boolean);
          avoidNames.push(latest.name);
          const keepTier = restock.shopItemTier(latest.price);
          const tiers = { common: 0, rare: 0, legendary: 0 };
          tiers[keepTier] = 1;
          const collection = brief.pickCollection(theme, { current: String(latest.collection || ''), keep: true });
          const catalog = await inventCatalog({
            league,
            needed: 1,
            tiers,
            theme,
            collection: collection && collection.name === latest.collection ? collection : null,
            existingNames: avoidNames
          });
          const next = catalog[0];
          if (!next) {
            throw new Error('The merchant could not invent a replacement.');
          }
          next.price = restock.clampPriceToTier(next.price, keepTier);
          const bytes = await generateImage(next, league, theme.palette);
          const path = shopImagePath({ teacherId, yearKey, monthKey, league, name: next.name });
          const imageUrl = await uploadPng(bytes, path);
          await persistItem({
            item: next,
            imageUrl,
            incoming: Boolean(latest.incoming),
            league,
            monthKey,
            teacherId,
            teacherName,
            yearKey,
            shelf,
            festivalId: latest.festivalId || (festival && shelf === 'festival' ? festival.festivalId : undefined)
          });
          await deleteIds([latest.id]);
          return { ok: true, action, replacedId: latest.id, name: next.name };
        }
        const error = new Error('Unknown Market Manager action.');
        error.code = 'invalid-argument';
        throw error;
      }, { waitMs: 8000 });
    }

    return { ensureStall, loadStock, manageItem };
  }

module.exports = { createShopEngine };
