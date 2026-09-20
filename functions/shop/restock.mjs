export const SHOP_RESTOCK_ITEM_COUNT = 15;
export const FESTIVAL_STALL_ITEM_COUNT = 5;
export const SHOP_STOCK_BY_TIER = { common: 5, rare: 2, legendary: 1 };
export const MONTHLY_TIER_COUNTS = { common: 5, rare: 5, legendary: 5 };
export const FESTIVAL_TIER_COUNTS = { common: 2, rare: 2, legendary: 1 };

function text(value) {
    return String(value || '').trim();
}

export function hasShopItemImage(item) {
    return /^https?:\/\//i.test(text(item?.image));
}

export function isCompleteShopItem(item) {
    return Boolean(text(item?.name) && text(item?.description || item?.desc) && hasShopItemImage(item));
}

export function shopItemStock(item) {
    if (item?.stock === undefined || item?.stock === null || item?.stock === '') return 1;
    const stock = Number(item.stock);
    if (!Number.isFinite(stock)) return 0;
    return Math.max(0, Math.floor(stock));
}

export function shopItemShelf(item) {
    return text(item?.shelf) === 'festival' ? 'festival' : 'seasonal';
}

export function shopItemInStock(item) {
    return shopItemStock(item) > 0;
}

export function isVisibleSeasonalShopItem(item) {
    return isCompleteShopItem(item) && !item?.incoming && shopItemInStock(item) && shopItemShelf(item) === 'seasonal';
}

export function isVisibleFestivalShopItem(item) {
    return isCompleteShopItem(item) && !item?.incoming && shopItemInStock(item) && shopItemShelf(item) === 'festival';
}

export function shopItemTier(price) {
    const gold = Number(price);
    if (gold >= 80) return 'legendary';
    if (gold >= 35) return 'rare';
    return 'common';
}

export function stockMaxForTier(tier) {
    return SHOP_STOCK_BY_TIER[tier] || SHOP_STOCK_BY_TIER.common;
}

export function remainingShopTiers(existingItems, neededTotal, tierTargets = MONTHLY_TIER_COUNTS) {
    const counts = { common: 0, rare: 0, legendary: 0 };
    for (const item of existingItems || []) {
        counts[shopItemTier(item?.price)] += 1;
    }
    const remaining = {
        common: Math.max(0, Number(tierTargets.common || 0) - counts.common),
        rare: Math.max(0, Number(tierTargets.rare || 0) - counts.rare),
        legendary: Math.max(0, Number(tierTargets.legendary || 0) - counts.legendary)
    };
    let needed = Math.max(0, Number(neededTotal) || 0);
    let sum = remaining.common + remaining.rare + remaining.legendary;
    while (sum < needed) {
        remaining.common += 1;
        sum += 1;
    }
    while (sum > needed) {
        if (remaining.legendary > 0) remaining.legendary -= 1;
        else if (remaining.rare > 0) remaining.rare -= 1;
        else remaining.common -= 1;
        sum -= 1;
    }
    return remaining;
}

export function itemsForShelf(items = [], shelf = 'seasonal') {
    return (Array.isArray(items) ? items : []).filter((item) => shopItemShelf(item) === shelf);
}

export function planShopRestock(items = [], options = {}) {
    const shelf = options.shelf === 'festival' ? 'festival' : 'seasonal';
    const targetCount = Math.max(1, Number(options.targetCount) || (shelf === 'festival' ? FESTIVAL_STALL_ITEM_COUNT : SHOP_RESTOCK_ITEM_COUNT));
    const tierTargets = options.tierTargets || (shelf === 'festival' ? FESTIVAL_TIER_COUNTS : MONTHLY_TIER_COUNTS);
    const list = itemsForShelf(items, shelf);
    const complete = list.filter(isCompleteShopItem);
    const incomplete = list.filter((item) => !isCompleteShopItem(item) && text(item?.name));
    const active = complete.filter((item) => !item.incoming && shopItemInStock(item));
    const incomingComplete = complete.filter((item) => item.incoming);
    const incomingIncomplete = incomplete.filter((item) => item.incoming);
    const fillIncomplete = incomplete.filter((item) => !item.incoming);
    const namesOf = (rows) => rows.map((item) => text(item.name)).filter(Boolean);

    if (active.length >= targetCount) {
        const incomingSlots = [...incomingComplete, ...incomingIncomplete];
        const needed = Math.max(0, targetCount - incomingSlots.length);
        const readyToSwap = incomingComplete.length >= targetCount;
        return {
            mode: readyToSwap ? 'swap' : 'replace',
            shelf,
            targetCount,
            keepIds: incomingComplete.map((item) => item.id).filter(Boolean),
            retry: incomingIncomplete,
            retireIds: readyToSwap ? active.map((item) => item.id).filter(Boolean) : [],
            removeIds: fillIncomplete.map((item) => item.id).filter(Boolean),
            needed,
            incoming: true,
            existingNames: namesOf([...active, ...incomingSlots]),
            tiers: remainingShopTiers(incomingSlots, needed, tierTargets),
            swapIncomingIds: readyToSwap ? incomingComplete.map((item) => item.id).filter(Boolean) : []
        };
    }

    const slots = [...active, ...fillIncomplete];
    const needed = Math.max(0, targetCount - slots.length);
    return {
        mode: 'fill',
        shelf,
        targetCount,
        keepIds: active.map((item) => item.id).filter(Boolean),
        retry: fillIncomplete,
        retireIds: [...incomingComplete, ...incomingIncomplete].map((item) => item.id).filter(Boolean),
        removeIds: [],
        needed,
        incoming: false,
        existingNames: namesOf(slots),
        tiers: remainingShopTiers(slots, needed, tierTargets),
        swapIncomingIds: []
    };
}

export function nextShopStockAfterPurchase(item) {
    return Math.max(0, shopItemStock(item) - 1);
}

export function shopStallNeedsWork(plan, options = {}) {
    if (!plan) return false;
    const forceReplace = Boolean(options.forceReplace);
    const retryCount = Array.isArray(plan.retry) ? plan.retry.length : 0;
    const needed = Math.max(0, Number(plan.needed) || 0);
    const targetCount = Math.max(1, Number(plan.targetCount) || SHOP_RESTOCK_ITEM_COUNT);
    if (plan.mode === 'swap') return true;
    if (retryCount > 0) return true;
    if (plan.mode === 'fill' && needed > 0) return true;
    if (forceReplace && plan.mode === 'replace') return true;
    if (plan.mode === 'replace' && needed < targetCount) return true;
    return false;
}

export function shopRestockToast(options = {}) {
    const mode = String(options.mode || 'fill');
    const savedThisRun = Math.max(0, Number(options.savedThisRun) || 0);
    const completeCount = Math.max(0, Number(options.completeCount) || 0);
    const missingCount = Math.max(0, Number(options.missingCount) || 0);
    const targetCount = Math.max(1, Number(options.targetCount) || SHOP_RESTOCK_ITEM_COUNT);
    const place = text(options.league) || 'this league';
    const stall = options.shelf === 'festival' ? 'Festival Stall' : 'stall';

    if (mode === 'started-fill') {
        const missing = missingCount || Math.max(0, targetCount - completeCount);
        if (missing <= 0) {
            return { type: 'info', message: `The ${stall} for ${place} is already full.` };
        }
        return {
            type: 'info',
            message: `The merchant is filling ${missing} missing treasures for ${place}. They'll appear as pictures arrive.`
        };
    }
    if (mode === 'started-replace') {
        return {
            type: 'info',
            message: `The merchant is bringing a fresh monthly stall for ${place}. Today's treasures stay until all ${targetCount} new pictures are ready.`
        };
    }
    if (mode === 'ensure-started') {
        return {
            type: 'info',
            message: `The merchant is restocking this month's treasures for ${place}. They'll appear as pictures arrive.`
        };
    }
    if (mode === 'swap') {
        return {
            type: 'success',
            message: `A fresh stall of ${targetCount} seasonal treasures is ready for ${place}!`
        };
    }
    if (mode === 'replace' || mode === 'replace-monthly') {
        if (savedThisRun <= 0 && completeCount <= 0) {
            return { type: 'error', message: 'The Merchant got lost. Try again.' };
        }
        return {
            type: 'info',
            message: `${completeCount} of ${targetCount} new treasures are ready for ${place}. Today's stall stays until the rest arrive.`
        };
    }
    if (completeCount >= targetCount) {
        return {
            type: 'success',
            message: `${targetCount} seasonal treasures are ready for ${place}!`
        };
    }
    if (savedThisRun <= 0 && completeCount <= 0) {
        return { type: 'error', message: 'The Merchant got lost. Try again.' };
    }
    return {
        type: 'info',
        message: `The stall now has ${completeCount} of ${targetCount} treasures for ${place}. The rest will appear as pictures arrive.`
    };
}
