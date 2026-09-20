import { db, doc, updateDoc, deleteDoc } from '../../firebase.js';
import * as state from '../../state.js';
import { showToast } from '../../ui/effects.js';
import { requireEliteAI } from '../../utils/upgradePrompt.js';
import { isGameplaySeasonLiveFromAppState } from '../../utils/schoolYear.js';
import {
    isManagedShopShelf,
    shopItemShelf,
    shopManagerFieldsFromInput,
    shopItemStock
} from '../../utils/shopRestock.js';
import { manageShopItem } from '../../utils/adminRuntime.js';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';

function assertSeasonLive() {
    if (isGameplaySeasonLiveFromAppState(state)) return true;
    showToast('The market stays sealed until the school year opens.', 'error');
    return false;
}

function ownedManagedItem(itemId) {
    const item = (state.get('currentShopItems') || []).find((entry) => entry.id === itemId);
    if (!item) {
        showToast('That treasure is no longer on the stall.', 'error');
        return null;
    }
    if (!isManagedShopShelf(item)) {
        showToast('Market Manager only edits Seasonal Treasures and the Festival Stall.', 'error');
        return null;
    }
    if (item.teacherId && item.teacherId !== state.get('currentUserId')) {
        showToast('You can only manage treasures on your own stall.', 'error');
        return null;
    }
    return item;
}

function duplicateName(item, name) {
    const shelf = shopItemShelf(item);
    const key = String(name || '').trim().toLowerCase();
    return (state.get('currentShopItems') || []).some((entry) => (
        entry.id !== item.id
        && shopItemShelf(entry) === shelf
        && String(entry.name || '').trim().toLowerCase() === key
    ));
}

export async function saveManagedShopItem(itemId, draft = {}) {
    if (!requireEliteAI({ feature: 'Market Manager' })) return null;
    if (!assertSeasonLive()) return null;
    const item = ownedManagedItem(itemId);
    if (!item) return null;
    const fields = shopManagerFieldsFromInput({
        ...draft,
        stock: draft.stock ?? shopItemStock(item)
    });
    if (!fields.name || !fields.description) {
        showToast('Give this treasure a name and a short description.', 'error');
        return null;
    }
    if (duplicateName(item, fields.name)) {
        showToast('Another treasure on this stall already uses that name.', 'error');
        return null;
    }
    try {
        await updateDoc(doc(db, `${PUBLIC_DATA_PATH}/shop_items`, itemId), {
            name: fields.name,
            description: fields.description,
            price: fields.price,
            tier: fields.tier,
            stock: fields.stock,
            stockMax: fields.stockMax
        });
        showToast(`${fields.name} is updated on the stall.`, 'success');
        return fields;
    } catch (error) {
        console.error('Market Manager save failed:', error);
        showToast('Could not save that treasure.', 'error');
        return null;
    }
}

export async function removeManagedShopItem(itemId) {
    if (!requireEliteAI({ feature: 'Market Manager' })) return null;
    if (!assertSeasonLive()) return null;
    const item = ownedManagedItem(itemId);
    if (!item) return null;
    try {
        await deleteDoc(doc(db, `${PUBLIC_DATA_PATH}/shop_items`, itemId));
        showToast(`${item.name || 'That treasure'} left the stall.`, 'success');
        return true;
    } catch (error) {
        console.error('Market Manager remove failed:', error);
        showToast('Could not remove that treasure.', 'error');
        return null;
    }
}

async function runManagedShopAction(itemId, action, busyLabel) {
    if (!requireEliteAI({ feature: 'Market Manager' })) return null;
    if (!assertSeasonLive()) return null;
    const item = ownedManagedItem(itemId);
    if (!item) return null;
    try {
        const result = await manageShopItem({ itemId, action });
        if (result?.skipped) {
            showToast('The merchant is already restocking. Try again in a moment.', 'info');
            return result;
        }
        if (action === 'replace') {
            showToast(`${result?.name || 'A new treasure'} took that place on the stall.`, 'success');
        } else {
            showToast(`A new picture is ready for ${item.name}.`, 'success');
        }
        return result;
    } catch (error) {
        console.error(`Market Manager ${action} failed:`, error);
        showToast(error?.message || `Could not ${busyLabel}.`, 'error');
        return null;
    }
}

export function regenerateManagedShopPicture(itemId) {
    return runManagedShopAction(itemId, 'new-picture', 'draw a new picture');
}

export function replaceManagedShopItem(itemId) {
    return runManagedShopAction(itemId, 'replace', 'replace this treasure');
}
