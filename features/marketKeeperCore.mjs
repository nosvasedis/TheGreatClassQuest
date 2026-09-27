// features/marketKeeperCore.mjs — pure helpers for the Mystic Market storefront:
// the Market Keeper's speech lines and shelf sorting / affordability.

function hashString(text) {
    let h = 0;
    const s = String(text || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
}

function pick(list, seed) {
    if (!list.length) return '';
    return list[hashString(seed) % list.length];
}

export function firstName(name) {
    const clean = String(name || '').trim();
    return clean ? clean.split(/\s+/)[0] : 'traveller';
}

export function goldNeeded(gold, price) {
    const g = Number(gold) || 0;
    const p = Number(price) || 0;
    return Math.max(0, p - g);
}

/** Opening line when no shopper is at the counter. */
export function keeperWelcomeLine(seed = '') {
    return pick([
        "Welcome, travellers! Choose a shopper and I'll open the till.",
        'Step inside! Pick a shopper and the shelves will tell you what you can afford.',
        'Mind the potions, they bite. Who is shopping today?'
    ], seed);
}

/** Greeting once a shopper is chosen: purse, reach, and any discount. */
export function keeperGreetingLine({
    studentName,
    gold = 0,
    affordableCount = 0,
    totalCount = 0,
    isHero = false,
    legendLabel = '',
    legendDiscount = 0,
    voucherPercent = 0
} = {}) {
    const who = firstName(studentName);
    const g = Number(gold) || 0;
    if (isHero) {
        return `Our Hero of the Day, ${who}! Seasonal treasures are cheaper for you today, and you carry ${g} gold.`;
    }
    if (voucherPercent > 0) {
        return `${who}, your Aurum Satchel is ready: ${voucherPercent}% off your next buy. You carry ${g} gold.`;
    }
    if (legendDiscount > 0 && legendLabel) {
        return `Ah, ${who} the ${legendLabel}! That earns you ${legendDiscount}% off seasonal treasures.`;
    }
    if (g <= 0) {
        return `Welcome, ${who}! Your purse is empty for now. Earn stars to fill it, then come back.`;
    }
    if (affordableCount <= 0) {
        return `${who}, you carry ${g} gold. Nothing is in reach yet, but save a little more and the shelves open up.`;
    }
    if (totalCount > 0 && affordableCount >= totalCount) {
        return `${who} with ${g} gold! Everything on my shelves is within your reach.`;
    }
    const noun = affordableCount === 1 ? 'ware is' : 'wares are';
    return `Welcome back, ${who}! With ${g} gold, ${affordableCount} ${noun} within your reach.`;
}

/**
 * Line for a ware the teacher is pointing at.
 * state: 'waiting' | 'affordable' | 'short' | 'owned' | 'limit'
 */
export function keeperWareLine({ name, state, finalPrice = 0, gold = 0, kind = '' } = {}) {
    const item = String(name || 'that one');
    const price = Number(finalPrice) || 0;
    switch (state) {
        case 'affordable':
            if (kind === 'familiar') return `A ${item}? Keep it warm. It hatches as you earn stars.`;
            return pick([
                `The ${item}? A fine choice, ${price} gold and it's yours.`,
                `${item}, ${price} gold. I polished it this morning.`,
                `Good eye! The ${item} is ${price} gold.`
            ], item);
        case 'short': {
            const need = goldNeeded(gold, price);
            return `The ${item} costs ${price} gold. Save ${need} more and I'll keep it on the shelf.`;
        }
        case 'owned':
            return kind === 'familiar'
                ? 'You already have a companion. One Familiar per hero!'
                : `You already own the ${item}. Use it well!`;
        case 'limit':
            return `Rules of the market: the ${item} has reached its limit this month.`;
        default:
            return `The ${item}? Choose a shopper first and I'll check their purse.`;
    }
}

export function keeperPurchaseLine({ studentName, itemName, soldOut = false } = {}) {
    const who = firstName(studentName);
    if (soldOut) return `Sold! That was the last ${itemName}. Lucky you, ${who}!`;
    return pick([
        `Pleasure doing business, ${who}! Enjoy the ${itemName}.`,
        `Wrapped and ready! The ${itemName} is yours, ${who}.`,
        `A wise purchase, ${who}. The ${itemName} suits you.`
    ], `${who}:${itemName}`);
}

export function keeperFailLine(message = '') {
    const text = String(message || '').trim();
    return text ? `Hmm, the till refused: ${text}` : 'Hmm, the till jammed. Try again in a moment.';
}

/**
 * Sort ware entries ({ name, price }) without mutating the input.
 * mode: 'price-asc' | 'price-desc' | 'name'
 */
export function sortWareEntries(entries, mode = 'price-asc') {
    const list = Array.isArray(entries) ? [...entries] : [];
    const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''));
    if (mode === 'name') return list.sort(byName);
    const dir = mode === 'price-desc' ? -1 : 1;
    return list.sort((a, b) => ((Number(a.price) || 0) - (Number(b.price) || 0)) * dir || byName(a, b));
}

export function salePercent(basePrice, finalPrice) {
    const base = Number(basePrice) || 0;
    const final = Number(finalPrice) || 0;
    if (base <= 0 || final >= base) return 0;
    return Math.round((1 - final / base) * 100);
}
