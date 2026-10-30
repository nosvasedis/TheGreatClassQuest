// db/actions/smartStock.js — sizes each treasure on a teacher's stall to the league that shares
// it (the teacher's classes in that league). Copies already sold stay sold; a resize only
// changes how many are left. Runs quietly when the Market or the Market Manager opens.
import { db, doc, runTransaction } from '../../firebase.js';
import * as state from '../../state.js';
import { isCurrentStallItem, shopItemShelf, shopItemTier, shopItemStock, stockMaxForTier } from '../../utils/shopRestock.js';
import { shopMonthKey, getActiveFestival } from '../../utils/shopCalendar.js';
import { assignStallCharms, leagueRoster, resizedStock, smartStockMax, stallBuyCheck } from '../../features/treasureCharmsCore.mjs';
import { PUBLIC_DATA_PATH } from '../../utils/tenant.mjs';

const running = new Set();

/** The children sharing this teacher's stall for `league`. */
export function stallRosterFor(league) {
    return leagueRoster(state.get('allTeachersClasses') || [], state.get('allStudents') || [], league);
}

/** Smart copy count for one rarity on one shelf of this league's stall (null when unknown). */
export function smartStockFor(league, tier, shelf = 'seasonal') {
    return smartStockMax({ tier, shelf, children: stallRosterFor(league).children });
}

// Sized once per league size: a Market Manager edit for the same league size stays as set.
function needsResize(item, target, children) {
    if (!target) return false;
    return Number(item.stockSizedFor) !== children || !(Number(item.stockMax) > 0);
}

export async function syncSmartStallStock(league) {
    const teacherId = state.get('currentUserId');
    if (!league || !teacherId || running.has(league)) return 0;
    const roster = stallRosterFor(league);
    if (roster.children <= 0) return 0;
    const scope = { league, monthKey: shopMonthKey(), festivalId: getActiveFestival()?.festivalId || '' };
    const items = (state.get('currentShopItems') || []).filter((item) => (
        item?.id && item.teacherId === teacherId && isCurrentStallItem(item, scope)
    ));
    // Each treasure also gets its charm written on it, so every buyer gets the one on the card.
    const charms = assignStallCharms(items);
    const work = items
        .map((item) => {
            const tier = item.tier || shopItemTier(item.price);
            const target = smartStockMax({ tier, shelf: shopItemShelf(item), children: roster.children });
            return { item, tier, target, charm: charms.get(item.id) || '' };
        })
        .filter(({ item, target, charm }) => charm || needsResize(item, target, roster.children));
    if (!work.length) return 0;

    running.add(league);
    let changed = 0;
    try {
        for (const { item, tier, target, charm } of work) {
            try {
                const patch = await runTransaction(db, async (transaction) => {
                    const ref = doc(db, `${PUBLIC_DATA_PATH}/shop_items`, item.id);
                    const snap = await transaction.get(ref);
                    if (!snap.exists()) return null;
                    const data = snap.data() || {};
                    const update = {};
                    if (charm && !data.charm) update.charm = charm;
                    if (needsResize(data, target, roster.children)) {
                        // A stall made before stock was counted has no stockMax: its tier's old size.
                        const before = Number(data.stockMax) > 0 ? Number(data.stockMax) : stockMaxForTier(tier);
                        const next = resizedStock({ stock: shopItemStock(data), stockMax: before, target });
                        Object.assign(update, { stock: next.stock, stockMax: next.stockMax, stockSizedFor: roster.children });
                        if (next.stock <= 0 && !data.soldOutAt) update.soldOutAt = new Date().toISOString();
                        if (next.stock > 0 && data.soldOutAt) update.soldOutAt = null;
                    }
                    if (!Object.keys(update).length) return null;
                    transaction.update(ref, update);
                    return update;
                });
                if (patch) {
                    changed += 1;
                    const list = state.get('currentShopItems') || [];
                    state.setCurrentShopItems(list.map((entry) => (entry.id === item.id ? { ...entry, ...patch } : entry)));
                }
            } catch (error) {
                console.warn('Smart stock: could not size a treasure.', item.name, error);
            }
        }
    } finally {
        running.delete(league);
    }
    return changed;
}

function ymd(parts) {
    if (!parts?.year) return '';
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function localToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * The fair-share check for one child and one stall treasure, from what the app has loaded:
 * one copy per hero, a rarity limit per hero, and each class's share of every rarity.
 */
export function stallBuyCheckFor(studentId, item, { inventory = null } = {}) {
    const students = state.get('allStudents') || [];
    const scores = state.get('allStudentScores') || [];
    const student = students.find((s) => s.id === studentId);
    const roster = stallRosterFor(item?.league);
    const inClasses = new Set(roster.classIds);
    const inventories = students
        .filter((s) => inClasses.has(s.classId) || s.id === studentId)
        .map((s) => ({
            studentId: s.id,
            classId: s.classId,
            inventory: s.id === studentId && Array.isArray(inventory)
                ? inventory
                : (scores.find((sc) => sc.id === s.id)?.inventory || [])
        }));
    const festival = getActiveFestival();
    const festivalEnd = festival && festival.festivalId === item?.festivalId ? ymd(festival.end) : '';
    return stallBuyCheck({
        item,
        studentId,
        classId: student?.classId || '',
        roster,
        inventories,
        stallItems: (state.get('currentShopItems') || []).filter((row) => row?.league === item?.league),
        today: localToday(),
        festivalEnd
    });
}

/** Only the child's own limits (one copy each, rarity limit), for the purchase transaction. */
export function childStallCheck(studentId, item, inventory) {
    return stallBuyCheck({
        item,
        studentId,
        classId: '',
        roster: null,
        inventories: [{ studentId, classId: '', inventory: Array.isArray(inventory) ? inventory : [] }],
        stallItems: (state.get('currentShopItems') || []).filter((row) => row?.league === item?.league)
    });
}
