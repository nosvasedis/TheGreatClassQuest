// db/actions/stallTreasure.js — a free treasure from the Mystic Market stall, taken out of its
// stock exactly like a purchase for 0 Gold. Used by the Quiz Champion and the Realm Raid Hero.
import { db, doc, getDocs, collection, runTransaction, where, query } from '../../firebase.js';
import * as state from '../../state.js';
import { isCompleteShopItem, isCurrentStallItem, shopItemInStock, shopItemStock } from '../../utils/shopRestock.js';
import { shopMonthKey, getActiveFestival } from '../../utils/shopCalendar.js';
import { getLiveYearGold, getLiveYearGoldContextFromState } from '../../utils/yearGold.js';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';

/** The league's current Mystic Market stall (this month's treasures and any festival stall). */
export async function loadLeagueStall(league) {
    const teacherId = state.get('currentUserId');
    const scope = { league, monthKey: shopMonthKey(), festivalId: getActiveFestival()?.festivalId || '' };
    const byId = new Map();
    try {
        const snap = await getDocs(query(
            collection(db, `${PUBLIC_DATA_PATH}/shop_items`),
            where('league', '==', league),
            where('monthKey', '==', scope.monthKey),
            where('teacherId', '==', teacherId)
        ));
        snap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
    } catch (error) {
        console.warn('Stall treasure: could not read the stall, using the loaded one.', error);
    }
    // Festival stalls can belong to the month before; the live listener already holds them.
    for (const item of state.get('currentShopItems') || []) {
        if (item?.id && !byId.has(item.id) && isCurrentStallItem(item, scope)) byId.set(item.id, item);
    }
    return [...byId.values()].filter((item) => isCurrentStallItem(item, scope) && isCompleteShopItem(item) && !item.incoming && shopItemInStock(item));
}

/**
 * Gives the first candidate still in stock to the student: the stall loses one copy (the last
 * copy leaves the shelf). Falls back to `fallbackGold` when every candidate is gone.
 * Returns { studentId, kind: 'treasure', item, league } or { studentId, kind: 'gold', gold, league }.
 */
export async function grantStallTreasure(studentId, candidates = [], { league = '', source = 'prize', fallbackGold = 10 } = {}) {
    const scoreRef = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, studentId);
    for (const candidate of candidates) {
        try {
            const granted = await runTransaction(db, async (transaction) => {
                const itemRef = doc(db, `${PUBLIC_DATA_PATH}/shop_items`, candidate.id);
                const itemSnap = await transaction.get(itemRef);
                const scoreSnap = await transaction.get(scoreRef);
                if (!itemSnap.exists() || !scoreSnap.exists()) return null;
                const item = { id: itemSnap.id, ...itemSnap.data() };
                const remaining = shopItemStock(item) - 1;
                if (remaining < 0) return null;
                if (remaining === 0) transaction.delete(itemRef);
                else transaction.update(itemRef, { stock: remaining });
                const inventory = Array.isArray(scoreSnap.data().inventory) ? scoreSnap.data().inventory : [];
                transaction.update(scoreRef, {
                    inventory: [...inventory, {
                        id: item.id,
                        name: item.name,
                        image: item.image || null,
                        icon: item.icon || null,
                        description: item.description || '',
                        acquiredAt: new Date().toISOString(),
                        source
                    }]
                });
                return { item, remaining };
            });
            if (!granted) continue;
            const { item, remaining } = granted;
            const shopItems = state.get('currentShopItems') || [];
            state.setCurrentShopItems(remaining > 0
                ? shopItems.map((entry) => (entry.id === item.id ? { ...entry, stock: remaining } : entry))
                : shopItems.filter((entry) => entry.id !== item.id));
            return {
                studentId,
                kind: 'treasure',
                item: { id: item.id, name: item.name, image: item.image || null, icon: item.icon || null, description: item.description || '', price: Number(item.price) || 0 },
                league
            };
        } catch (error) {
            console.warn('Stall treasure: this treasure could not be given, trying another.', error);
        }
    }

    await runTransaction(db, async (transaction) => {
        const scoreSnap = await transaction.get(scoreRef);
        if (!scoreSnap.exists()) return;
        const current = getLiveYearGold(scoreSnap.data(), getLiveYearGoldContextFromState(state));
        transaction.update(scoreRef, { gold: current + fallbackGold });
    });
    return { studentId, kind: 'gold', gold: fallbackGold, league };
}
