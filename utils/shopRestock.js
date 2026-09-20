export const SHOP_RESTOCK_ITEM_COUNT = 15;

function text(value) {
    return String(value || '').trim();
}

export function hasShopItemImage(item) {
    return /^https?:\/\//i.test(text(item?.image));
}

export function isCompleteShopItem(item) {
    return Boolean(text(item?.name) && text(item?.description || item?.desc) && hasShopItemImage(item));
}

export function isVisibleSeasonalShopItem(item) {
    return isCompleteShopItem(item) && !item?.incoming;
}

export function shopItemTier(price) {
    const gold = Number(price);
    if (gold >= 80) return 'legendary';
    if (gold >= 35) return 'rare';
    return 'common';
}

export function remainingShopTiers(existingItems, neededTotal) {
    const counts = { common: 0, rare: 0, legendary: 0 };
    for (const item of existingItems || []) {
        counts[shopItemTier(item?.price)] += 1;
    }
    const remaining = {
        common: Math.max(0, 5 - counts.common),
        rare: Math.max(0, 5 - counts.rare),
        legendary: Math.max(0, 5 - counts.legendary)
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

export function planShopRestock(items = []) {
    const list = Array.isArray(items) ? items : [];
    const complete = list.filter(isCompleteShopItem);
    const incomplete = list.filter((item) => !isCompleteShopItem(item) && text(item?.name));
    const active = complete.filter((item) => !item.incoming);
    const incomingComplete = complete.filter((item) => item.incoming);
    const incomingIncomplete = incomplete.filter((item) => item.incoming);
    const fillIncomplete = incomplete.filter((item) => !item.incoming);
    const namesOf = (rows) => rows.map((item) => text(item.name)).filter(Boolean);

    if (active.length >= SHOP_RESTOCK_ITEM_COUNT) {
        const incomingSlots = [...incomingComplete, ...incomingIncomplete];
        const needed = Math.max(0, SHOP_RESTOCK_ITEM_COUNT - incomingSlots.length);
        const readyToSwap = incomingComplete.length >= SHOP_RESTOCK_ITEM_COUNT;
        return {
            mode: readyToSwap ? 'swap' : 'replace',
            keepIds: incomingComplete.map((item) => item.id).filter(Boolean),
            retry: incomingIncomplete,
            retireIds: readyToSwap ? active.map((item) => item.id).filter(Boolean) : [],
            removeIds: fillIncomplete.map((item) => item.id).filter(Boolean),
            needed,
            incoming: true,
            existingNames: namesOf([...active, ...incomingSlots]),
            tiers: remainingShopTiers(incomingSlots, needed),
            swapIncomingIds: readyToSwap ? incomingComplete.map((item) => item.id).filter(Boolean) : []
        };
    }

    const slots = [...active, ...fillIncomplete];
    const needed = Math.max(0, SHOP_RESTOCK_ITEM_COUNT - slots.length);
    return {
        mode: 'fill',
        keepIds: active.map((item) => item.id).filter(Boolean),
        retry: fillIncomplete,
        retireIds: [...incomingComplete, ...incomingIncomplete].map((item) => item.id).filter(Boolean),
        removeIds: [],
        needed,
        incoming: false,
        existingNames: namesOf(slots),
        tiers: remainingShopTiers(slots, needed),
        swapIncomingIds: []
    };
}

export function shopRestockToast(options = {}) {
    const mode = String(options.mode || 'fill');
    const savedThisRun = Math.max(0, Number(options.savedThisRun) || 0);
    const completeCount = Math.max(0, Number(options.completeCount) || 0);
    const missingCount = Math.max(0, Number(options.missingCount) || 0);
    const targetCount = Math.max(1, Number(options.targetCount) || SHOP_RESTOCK_ITEM_COUNT);
    const place = text(options.league) || 'this league';

    if (mode === 'started-fill') {
        const missing = missingCount || Math.max(0, targetCount - completeCount);
        if (missing <= 0) {
            return { type: 'info', message: `The stall for ${place} is already full.` };
        }
        return {
            type: 'info',
            message: `The merchant is filling ${missing} missing treasures for ${place} in the background.`
        };
    }
    if (mode === 'started-replace') {
        return {
            type: 'info',
            message: `The merchant is weaving a fresh stall for ${place} in the background. Current treasures stay until all ${targetCount} pictures are ready.`
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
    if (mode === 'replace') {
        return {
            type: 'info',
            message: `${completeCount} of ${targetCount} new treasures are ready for ${place}. Tap Restock to finish the swap.`
        };
    }
    return {
        type: 'info',
        message: `The stall now has ${completeCount} of ${targetCount} treasures for ${place}. Tap Restock to finish the rest.`
    };
}
