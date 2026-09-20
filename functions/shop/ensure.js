'use strict';

const YOUNG_LEARNER_LEAGUES = new Set(['Nursery', 'Pre-Junior', 'Junior A', 'Junior B']);
const AGE_GROUP_BY_LEAGUE = {
  Nursery: '5-6',
  'Pre-Junior': '6-7',
  'Junior A': '7-8',
  'Junior B': '8-9',
  A: '9-10',
  B: '10-11',
  C: '11-12',
  D: '12-13',
  E: '13-14',
  Lower: '14-15',
  Proficiency: '15+'
};

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
  return { name, desc, price: Math.round(price), id: item.id || null };
}

function styleForLeague(league) {
  return YOUNG_LEARNER_LEAGUES.has(league)
    ? 'a die-cut vector sticker, thick white outline, flat color, simple shapes, cartoon style, white background'
    : 'a fantasy rpg inventory icon, 3d render, centered, neutral background, high detail';
}

function languageForLeague(league) {
  return YOUNG_LEARNER_LEAGUES.has(league)
    ? 'Use simple English (7-9yo). Max 8 words.'
    : 'Use exciting English (10-13yo). Max 10 words.';
}

function buildCatalogPrompt({ league, needed, tiers, themePrompt, avoidNames }) {
  const ageCategory = AGE_GROUP_BY_LEAGUE[league] || 'all ages';
  const avoid = avoidNames.length ? `Do NOT reuse these names: ${avoidNames.join(', ')}.` : '';
  return `You are a JSON generator API for a school RPG app. You output ONLY raw valid JSON — no explanations, no reasoning, no markdown, no commentary before or after.
        Target Audience: ${league} students (approx age ${ageCategory}).
        ${themePrompt}
        
        Requirements:
        1. Generate ${needed} UNIQUE handheld objects. ${avoid}
        2. PRICE TIERS (CRITICAL):
           - ${tiers.common} "Common" items: 10-18 Gold (Easy to get in 1 month).
           - ${tiers.rare} "Rare" items: 35-50 Gold (Requires saving for 2-3 months).
           - ${tiers.legendary} "Legendary" items: 80-120 Gold (Long-term "End of Term" trophies).
        3. DESCRIPTIONS: ${languageForLeague(league)}
        4. Output ONLY this JSON structure, nothing else: [{"name": "string", "desc": "string", "price": number}, ...]`;
}

function createShopEngine({ db, storage, FieldValue, publicDataPath }) {
  const calendarP = import('./calendar.mjs');
  const restockP = import('./restock.mjs');
  const ai = require('./ai');

  async function loadStock(teacherId, league, monthKey) {
    const snap = await db.collection(`${publicDataPath}/shop_items`)
      .where('league', '==', league)
      .where('monthKey', '==', monthKey)
      .where('teacherId', '==', teacherId)
      .get();
    return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
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

  async function generateImage(item, league) {
    const styleContext = styleForLeague(league);
    const negativePrompt = 'pattern, texture, wallpaper, seamless, repeating, tiling, grid, background, scenery, landscape, text, watermark, blurry, noise, cropped, multiple objects, pile, heap';
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const prompt = `(single isolated object) of ((${item.name})), ${item.desc}. ${styleContext}. centered, full shot, high quality.`;
        return await ai.shopAiImage(prompt, negativePrompt);
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
          const bytes = await generateImage(item, context.league);
          const path = `shop_items/${context.teacherId}/${context.yearKey}/${context.monthKey}_${ai.simpleHashCode(item.name)}.png`;
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

  async function inventCatalog({ league, needed, tiers, themePrompt, existingNames }) {
    if (needed <= 0) return [];
    const systemPrompt = buildCatalogPrompt({
      league,
      needed,
      tiers,
      themePrompt,
      avoidNames: existingNames
    });
    let itemsData = [];
    const jsonString = await ai.shopAiChat(systemPrompt, 'Output the JSON array now.');
    try {
      itemsData = ai.extractJsonFromAiText(jsonString);
    } catch (_) {
      const fixedJson = await ai.shopAiChat(
        'You must output ONLY a valid JSON array. No explanation, no markdown. Fix and return this JSON array:',
        jsonString
      );
      itemsData = ai.extractJsonFromAiText(fixedJson);
    }
    if (!Array.isArray(itemsData)) itemsData = [];
    const taken = new Set(existingNames.map((name) => String(name).toLowerCase()));
    return itemsData
      .map(normalizeCatalogItem)
      .filter(Boolean)
      .filter((item) => {
        const key = item.name.toLowerCase();
        if (taken.has(key)) return false;
        taken.add(key);
        return true;
      })
      .slice(0, needed);
  }

  async function applyPlan(plan, currentItems, context) {
    const restock = await restockP;
    const idsToClear = plan.mode === 'swap'
      ? plan.removeIds
      : [...plan.retireIds, ...plan.removeIds];
    await deleteIds(idsToClear);
    let items = currentItems;
    if (idsToClear.length) items = await loadStock(context.teacherId, context.league, context.monthKey);
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

    const retryItems = nextPlan.retry.map(normalizeCatalogItem).filter(Boolean);
    let savedThisRun = await produceItems(retryItems, { ...context, incoming: nextPlan.incoming });
    const catalog = await inventCatalog({
      league: context.league,
      needed: nextPlan.needed,
      tiers: nextPlan.tiers,
      themePrompt: context.themePrompt,
      existingNames: nextPlan.existingNames
    });
    savedThisRun += await produceItems(catalog, { ...context, incoming: nextPlan.incoming });

    const latest = await loadStock(context.teacherId, context.league, context.monthKey);
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

    return withLock(lockId, async () => {
      let items = await loadStock(teacherId, league, monthKey);
      const expired = await expireStaleFestivals(items, festival);
      if (expired) items = await loadStock(teacherId, league, monthKey);

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
          themePrompt: calendar.monthlyShelfPrompt()
        });
        items = await loadStock(teacherId, league, monthKey);
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
            themePrompt: calendar.festivalShelfPrompt(festival)
          });
        }
      }

      return result;
    }, { waitMs: mode === 'replace-monthly' ? 20000 : 0 });
  }

  return { ensureStall, loadStock };
}

module.exports = { createShopEngine };
