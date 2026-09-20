import * as state from '../../state.js';
import { canUseFeature } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { getUpgradeMessage } from '../../config/tiers/features.js';
import { escapeHtml } from '../../features/roles/shared.js';
import { shopMonthKey, getMonthlyShopTheme, getActiveFestival } from '../../utils/shopCalendar.js';
import {
    isManagedShopShelf,
    shopItemShelf,
    shopItemStock,
    shopItemTier,
    stockMaxForTier
} from '../../utils/shopRestock.js';
import {
    saveManagedShopItem,
    removeManagedShopItem,
    regenerateManagedShopPicture,
    replaceManagedShopItem
} from '../../db/actions/shopManager.js';

function resolveLeague() {
    let league = state.get('globalSelectedLeague');
    if (!league) {
        const classId = state.get('globalSelectedClassId');
        if (classId) {
            const cls = (state.get('allSchoolClasses') || []).find((row) => row.id === classId)
                || (state.get('allTeachersClasses') || []).find((row) => row.id === classId);
            if (cls) league = cls.questLevel;
        }
    }
    return String(league || '').trim();
}

function classLabel() {
    const classId = state.get('globalSelectedClassId');
    const cls = (state.get('allTeachersClasses') || []).find((row) => row.id === classId)
        || (state.get('allSchoolClasses') || []).find((row) => row.id === classId);
    return cls?.name || '';
}

function stallItems() {
    const league = resolveLeague();
    const monthKey = shopMonthKey();
    const teacherId = state.get('currentUserId');
    return (state.get('currentShopItems') || []).filter((item) => (
        isManagedShopShelf(item)
        && item.teacherId === teacherId
        && String(item.league || '') === league
        && String(item.monthKey || '') === monthKey
    ));
}

function sortItems(items) {
    return [...items].sort((a, b) => {
        const tierRank = { common: 0, rare: 1, legendary: 2 };
        const aTier = tierRank[shopItemTier(a.price)] ?? 0;
        const bTier = tierRank[shopItemTier(b.price)] ?? 0;
        if (aTier !== bTier) return aTier - bTier;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });
}

function renderCard(item) {
    const stock = shopItemStock(item);
    const stockMax = Number(item.stockMax) || stockMaxForTier(shopItemTier(item.price));
    const image = String(item.image || '').trim();
    const imageHtml = image
        ? `<img src="${escapeHtml(image)}" alt="" class="market-manager-card__art">`
        : '<div class="market-manager-card__art market-manager-card__art--empty">No picture yet</div>';
    const incoming = item.incoming
        ? '<span class="market-manager-pill">Coming in</span>'
        : '';
    const soldOut = !item.incoming && stock <= 0
        ? '<span class="market-manager-pill market-manager-pill--warn">Hidden on the Market</span>'
        : '';

    return `
        <article class="market-manager-card" data-item-id="${escapeHtml(item.id)}">
            <div class="market-manager-card__media">${imageHtml}${incoming}${soldOut}</div>
            <div class="market-manager-card__fields">
                <label class="market-manager-label">Name
                    <input type="text" class="market-manager-input" data-field="name" maxlength="48" value="${escapeHtml(item.name || '')}">
                </label>
                <label class="market-manager-label">Description
                    <textarea class="market-manager-input market-manager-input--area" data-field="description" maxlength="160" rows="2">${escapeHtml(item.description || item.desc || '')}</textarea>
                </label>
                <div class="market-manager-grid">
                    <label class="market-manager-label">Gold
                        <input type="number" class="market-manager-input" data-field="price" min="10" max="120" step="1" value="${escapeHtml(item.price || 10)}">
                    </label>
                    <label class="market-manager-label">Copies left
                        <input type="number" class="market-manager-input" data-field="stock" min="0" max="${stockMax}" step="1" value="${stock}">
                    </label>
                </div>
            </div>
            <div class="market-manager-card__actions">
                <button type="button" class="market-manager-btn market-manager-btn--save" data-market-action="save">Save</button>
                <button type="button" class="market-manager-btn market-manager-btn--picture" data-market-action="picture">New picture</button>
                <button type="button" class="market-manager-btn market-manager-btn--replace" data-market-action="replace">Replace this treasure</button>
                <button type="button" class="market-manager-btn market-manager-btn--remove" data-market-action="remove">Remove</button>
            </div>
        </article>`;
}

function renderGroup(title, items, emptyText) {
    if (!items.length) {
        return `
            <section class="market-manager-group">
                <h3 class="market-manager-group__title">${escapeHtml(title)}</h3>
                <p class="market-manager-empty">${escapeHtml(emptyText)}</p>
            </section>`;
    }
    return `
        <section class="market-manager-group">
            <h3 class="market-manager-group__title">${escapeHtml(title)}</h3>
            <div class="market-manager-grid-cards">${items.map(renderCard).join('')}</div>
        </section>`;
}

function setBusy(card, busy, button, label) {
    if (!card) return;
    card.classList.toggle('is-busy', busy);
    card.querySelectorAll('button, input, textarea').forEach((el) => {
        el.disabled = busy;
    });
    if (!button) return;
    if (busy) {
        button.dataset.idleHtml = button.dataset.idleHtml || button.innerHTML;
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${escapeHtml(label)}`;
        return;
    }
    if (button.dataset.idleHtml) button.innerHTML = button.dataset.idleHtml;
}

function readDraft(card) {
    return {
        name: card.querySelector('[data-field="name"]')?.value || '',
        description: card.querySelector('[data-field="description"]')?.value || '',
        price: card.querySelector('[data-field="price"]')?.value || '',
        stock: card.querySelector('[data-field="stock"]')?.value || ''
    };
}

async function handleAction(action, itemId, card, button) {
    if (action === 'save') {
        setBusy(card, true, button, 'Saving…');
        try {
            await saveManagedShopItem(itemId, readDraft(card));
        } finally {
            setBusy(card, false, button);
        }
        return;
    }
    if (action === 'picture') {
        setBusy(card, true, button, 'Drawing…');
        try {
            await regenerateManagedShopPicture(itemId);
        } finally {
            setBusy(card, false, button);
        }
        return;
    }
    if (action === 'replace') {
        if (!window.confirm('Replace this treasure with a new one of the same rarity? The old piece leaves the stall.')) return;
        setBusy(card, true, button, 'Replacing…');
        try {
            await replaceManagedShopItem(itemId);
        } finally {
            setBusy(card, false, button);
        }
        return;
    }
    if (action === 'remove') {
        if (!window.confirm('Take this treasure off the stall? Heroes will not be able to buy it.')) return;
        setBusy(card, true, button, 'Removing…');
        try {
            await removeManagedShopItem(itemId);
        } finally {
            setBusy(card, false, button);
        }
    }
}

export function renderMarketManagerUi() {
    if (document.querySelector('.market-manager-card.is-busy')) return;
    const locked = document.getElementById('options-market-locked');
    const content = document.getElementById('options-market-content');
    const list = document.getElementById('market-manager-list');
    const classEl = document.getElementById('market-manager-class');
    if (!list) return;

    const hasMarket = canUseFeature('eliteAI');
    locked?.classList.toggle('hidden', hasMarket);
    content?.classList.toggle('hidden', !hasMarket);
    if (!hasMarket) return;

    const league = resolveLeague();
    const theme = getMonthlyShopTheme();
    const festival = getActiveFestival();
    const className = classLabel();
    if (classEl) {
        classEl.textContent = className && league
            ? `${className} · ${league} · ${theme.label}`
            : 'Choose a class from the header to open this stall.';
    }
    if (!league) {
        list.innerHTML = '<p class="market-manager-empty">Pick a class from the header, then the merchant will show this month’s stall here.</p>';
        return;
    }

    const items = stallItems();
    const liveSeasonal = sortItems(items.filter((item) => shopItemShelf(item) === 'seasonal' && !item.incoming));
    const liveFestival = sortItems(items.filter((item) => shopItemShelf(item) === 'festival' && !item.incoming));
    const incoming = sortItems(items.filter((item) => item.incoming));

    list.innerHTML = [
        renderGroup('Seasonal Treasures', liveSeasonal, 'The monthly stall is empty. Restock from the Mystic Market, or wait for the merchant to fill it.'),
        festival || liveFestival.length
            ? renderGroup('Festival Stall', liveFestival, festival
                ? `${festival.name} is open, but this stall has no holiday treasures yet.`
                : 'No Festival Stall treasures on this stall.')
            : '',
        incoming.length ? renderGroup('Coming in', incoming, '') : ''
    ].join('');
}

export function wireMarketManagerEvents() {
    const locked = document.getElementById('options-market-locked');
    locked?.addEventListener('click', () => {
        showUpgradePrompt({
            feature: 'Market Manager',
            tier: 'Elite',
            message: getUpgradeMessage('Elite', 'eliteAI')
        });
    });
    const list = document.getElementById('market-manager-list');
    if (!list || list.dataset.wired === 'true') return;
    list.dataset.wired = 'true';
    list.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-market-action]');
        if (!button) return;
        const card = button.closest('[data-item-id]');
        const itemId = card?.dataset.itemId;
        if (!itemId) return;
        await handleAction(button.dataset.marketAction, itemId, card, button);
    });
}
