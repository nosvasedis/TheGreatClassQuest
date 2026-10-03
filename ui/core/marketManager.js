import * as state from '../../state.js';
import { canUseFeature } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { getUpgradeMessage } from '../../config/tiers/features.js';
import { escapeHtml } from '../../features/roles/shared.js';
import { isGameplaySeasonLiveFromAppState } from '../../utils/schoolYear.js';
import { shopMonthKey, getMonthlyShopTheme, getActiveFestival } from '../../utils/shopCalendar.js';
import {
    isCurrentStallItem,
    isManagedShopShelf,
    shopItemShelf,
    shopItemStock,
    shopItemTier,
    stockMaxForTier,
    shopInventoryNeedsEnsure,
    isCompleteShopItem,
    planShopRestock
} from '../../utils/shopRestock.js';
import {
    saveManagedShopItem,
    removeManagedShopItem,
    regenerateManagedShopPicture,
    replaceManagedShopItem
} from '../../db/actions/shopManager.js';

// The Market's treasures load on demand. The Mystic Market used to be the only thing
// that started that load, so opening the Market Manager first showed an empty stall.
let itemsReady = false;
let itemsLoading = null;
let itemsFailed = false;
let restockBusy = false;
const autoFilledScopes = new Set();

function shopItemsReady() {
    if (itemsReady && state.get('hasLoadedShopItems')) return true;
    itemsReady = false;
    if (itemsLoading) return false;
    itemsFailed = false;
    itemsLoading = import('../../db/listeners.js')
        .then((listeners) => listeners.ensureShopItemsListener())
        .then((ok) => {
            itemsReady = Boolean(ok);
            itemsFailed = !ok;
        })
        .catch((error) => {
            console.error('Market Manager could not load the stall:', error);
            itemsFailed = true;
        })
        .finally(() => {
            itemsLoading = null;
            if (marketManagerVisible()) renderMarketManagerUi();
        });
    return false;
}

function marketManagerVisible() {
    const section = document.querySelector('[data-options-section="market"]');
    return Boolean(section && !section.classList.contains('hidden'));
}

const TIER_LABELS = { common: 'Common', rare: 'Rare', legendary: 'Legendary' };

function tierHint(price) {
    const tier = shopItemTier(price);
    return `${TIER_LABELS[tier]} · up to ${stockMaxForTier(tier)} copies`;
}

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
    const scope = { league: resolveLeague(), monthKey: shopMonthKey(), festivalId: getActiveFestival()?.festivalId };
    const teacherId = state.get('currentUserId');
    return (state.get('currentShopItems') || []).filter((item) => (
        isManagedShopShelf(item)
        && item.teacherId === teacherId
        && isCurrentStallItem(item, scope)
        && (shopItemShelf(item) !== 'festival' || item.festivalId === scope.festivalId)
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

// Typed but unsaved edits, by treasure. Every Market update (a student buying a copy,
// a save on another card) re-renders the list, and without this the half-typed name
// or description on the other cards was wiped.
const drafts = new Map();

function draftValue(item, field, saved) {
    const draft = drafts.get(item.id);
    return draft && Object.prototype.hasOwnProperty.call(draft, field) ? draft[field] : saved;
}

const MISSING_PICTURE_HTML = '<div class="market-manager-card__art market-manager-card__art--empty">No picture yet.<br>Press New picture.</div>';
const BROKEN_PICTURE_HTML = '<div class="market-manager-card__art market-manager-card__art--empty">This picture did not load.<br>Press New picture.</div>';

function renderCard(item) {
    const stock = shopItemStock(item);
    const stockMax = Number(item.stockMax) || stockMaxForTier(shopItemTier(item.price));
    const image = String(item.image || '').trim();
    const imageHtml = image
        ? `<img src="${escapeHtml(image)}" alt="" class="market-manager-card__art">`
        : MISSING_PICTURE_HTML;
    const dirty = drafts.has(item.id);
    const priceValue = draftValue(item, 'price', item.price || 10);
    const incoming = item.incoming
        ? '<span class="market-manager-pill">Coming in</span>'
        : '';
    const soldOut = !item.incoming && stock <= 0
        ? '<span class="market-manager-pill market-manager-pill--warn">Hidden on the Market</span>'
        : '';

    return `
        <article class="market-manager-card${dirty ? ' is-dirty' : ''}" data-item-id="${escapeHtml(item.id)}">
            <div class="market-manager-card__media">${imageHtml}${incoming}${soldOut}</div>
            <div class="market-manager-card__fields">
                <label class="market-manager-label">Name
                    <input type="text" class="market-manager-input" data-field="name" maxlength="48" value="${escapeHtml(draftValue(item, 'name', item.name || ''))}">
                </label>
                <label class="market-manager-label">Description
                    <textarea class="market-manager-input market-manager-input--area" data-field="description" maxlength="160" rows="2">${escapeHtml(draftValue(item, 'description', item.description || item.desc || ''))}</textarea>
                </label>
                <div class="market-manager-grid">
                    <label class="market-manager-label">Gold
                        <input type="number" class="market-manager-input" data-field="price" min="10" max="120" step="1" value="${escapeHtml(priceValue)}">
                        <span class="market-manager-hint" data-tier-hint>${escapeHtml(tierHint(priceValue))}</span>
                    </label>
                    <label class="market-manager-label">Copies left
                        <input type="number" class="market-manager-input" data-field="stock" min="0" max="${stockMax}" step="1" value="${escapeHtml(draftValue(item, 'stock', stock))}">
                    </label>
                </div>
            </div>
            <div class="market-manager-card__actions">
                <button type="button" class="market-manager-btn market-manager-btn--save" data-market-action="save"><i class="fas fa-save"></i> ${dirty ? 'Save changes' : 'Save'}</button>
                <span class="market-manager-unsaved">Unsaved changes</span>
                <button type="button" class="market-manager-btn market-manager-btn--picture" data-market-action="picture"><i class="fas fa-image"></i> New picture</button>
                <button type="button" class="market-manager-btn market-manager-btn--replace" data-market-action="replace"><i class="fas fa-shuffle"></i> Replace this treasure</button>
                <button type="button" class="market-manager-btn market-manager-btn--remove" data-market-action="remove"><i class="fas fa-trash"></i> Remove</button>
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

// A Firestore update for the card being worked on lands while it is still busy, and that
// render is skipped so it does not wipe the spinner. Remember it and render once free,
// otherwise the card keeps showing the old picture or the old treasure.
let renderSkippedWhileBusy = false;

function renderIfSkipped() {
    if (!renderSkippedWhileBusy) return;
    if (document.querySelector('.market-manager-card.is-busy')) return;
    renderSkippedWhileBusy = false;
    renderMarketManagerUi();
}

function showPicture(card, url) {
    const media = card?.querySelector('.market-manager-card__media');
    if (!media || !url) return;
    const current = media.querySelector('.market-manager-card__art');
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.className = 'market-manager-card__art';
    if (current) current.replaceWith(img);
    else media.prepend(img);
}

async function handleAction(action, itemId, card, button) {
    try {
        await runAction(action, itemId, card, button);
    } finally {
        renderIfSkipped();
    }
}

async function runAction(action, itemId, card, button) {
    if (action === 'save') {
        setBusy(card, true, button, 'Saving…');
        try {
            const saved = await saveManagedShopItem(itemId, readDraft(card));
            if (saved) {
                drafts.delete(itemId);
                card.classList.remove('is-dirty');
                button.dataset.idleHtml = '<i class="fas fa-save"></i> Save';
            }
        } finally {
            setBusy(card, false, button);
        }
        return;
    }
    if (action === 'picture') {
        setBusy(card, true, button, 'Drawing…');
        try {
            const result = await regenerateManagedShopPicture(itemId);
            if (result?.image) showPicture(card, result.image);
        } finally {
            setBusy(card, false, button);
        }
        return;
    }
    if (action === 'replace') {
        if (!window.confirm('Replace this treasure with a new one of the same rarity? The old piece leaves the stall.')) return;
        setBusy(card, true, button, 'Replacing…');
        try {
            const result = await replaceManagedShopItem(itemId);
            if (result?.ok) drafts.delete(itemId);
        } finally {
            setBusy(card, false, button);
        }
        return;
    }
    if (action === 'remove') {
        if (!window.confirm('Take this treasure off the stall? Heroes will not be able to buy it.')) return;
        setBusy(card, true, button, 'Removing…');
        try {
            const removed = await removeManagedShopItem(itemId);
            if (removed) drafts.delete(itemId);
        } finally {
            setBusy(card, false, button);
        }
    }
}

function captureFocus(list) {
    const active = document.activeElement;
    if (!active || !list.contains(active) || !active.dataset?.field) return null;
    const itemId = active.closest('[data-item-id]')?.dataset.itemId;
    if (!itemId) return null;
    let start = null;
    let end = null;
    try {
        start = active.selectionStart;
        end = active.selectionEnd;
    } catch (_) { /* number inputs have no selection */ }
    return { itemId, field: active.dataset.field, start, end };
}

function restoreFocus(list, focus) {
    if (!focus) return;
    const card = [...list.querySelectorAll('[data-item-id]')].find((el) => el.dataset.itemId === focus.itemId);
    const field = card?.querySelector(`[data-field="${focus.field}"]`);
    if (!field) return;
    field.focus({ preventScroll: true });
    if (focus.start === null || focus.start === undefined) return;
    try {
        field.setSelectionRange(focus.start, focus.end ?? focus.start);
    } catch (_) { /* number inputs have no selection */ }
}

function stallSummary(items) {
    const onSale = items.filter((item) => !item.incoming && shopItemStock(item) > 0 && isCompleteShopItem(item)).length;
    const soldOut = items.filter((item) => !item.incoming && shopItemStock(item) <= 0).length;
    const noPicture = items.filter((item) => !String(item.image || '').trim()).length;
    const parts = [`${onSale} on sale`];
    if (soldOut) parts.push(`${soldOut} sold out`);
    if (noPicture) parts.push(`${noPicture} without a picture`);
    return parts.join(' · ');
}

function missingSeasonalCount(items) {
    const plan = planShopRestock(items.filter((item) => shopItemShelf(item) === 'seasonal'), { shelf: 'seasonal' });
    if (plan.mode !== 'fill') return 0;
    return plan.needed + plan.retry.length;
}

function renderStatus(items, scope) {
    if (restockBusy) {
        return `
            <div class="market-manager-status market-manager-status--busy" role="status">
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                <span>The merchant is filling this stall. New treasures appear here as their pictures are ready.</span>
            </div>`;
    }
    const needsWork = shopInventoryNeedsEnsure(items, { activeFestivalId: scope.festivalId });
    if (needsWork) {
        const missing = missingSeasonalCount(items);
        const text = items.length
            ? (missing > 0
                ? `This stall is ${missing} ${missing === 1 ? 'treasure' : 'treasures'} short of a full shelf.`
                : 'Some treasures on this stall are not finished yet.')
            : 'This stall has no treasures yet.';
        return `
            <div class="market-manager-status market-manager-status--warn" role="status">
                <span>${escapeHtml(text)} ${escapeHtml(stallSummary(items))}.</span>
                <button type="button" class="market-manager-btn market-manager-btn--fill" data-market-stall="fill"><i class="fas fa-wand-magic-sparkles"></i> Fill the stall</button>
            </div>`;
    }
    return `
        <div class="market-manager-status" role="status">
            <i class="fas fa-circle-check" aria-hidden="true"></i>
            <span>The stall is full. ${escapeHtml(stallSummary(items))}.</span>
        </div>`;
}

function renderNotice(text, { spinner = false, retry = false } = {}) {
    return `
        <div class="market-manager-empty">
            ${spinner ? '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> ' : ''}${escapeHtml(text)}
            ${retry ? '<div class="market-manager-empty__action"><button type="button" class="market-manager-btn" data-market-stall="retry"><i class="fas fa-rotate-right"></i> Try again</button></div>' : ''}
        </div>`;
}

// Opening the Market Manager on a stall that needs work starts the same quiet fill the
// Mystic Market starts, once per stall per visit, so the teacher never has to go there first.
function autoFillOnce(items, scope) {
    if (restockBusy || !items) return;
    const key = `${scope.league}|${scope.monthKey}|${scope.festivalId || ''}`;
    if (autoFilledScopes.has(key)) return;
    if (!shopInventoryNeedsEnsure(items, { activeFestivalId: scope.festivalId })) return;
    autoFilledScopes.add(key);
    import('../../db/actions.js')
        .then((actions) => actions.handleEnsureShopStock?.())
        .catch((error) => console.warn('Market Manager auto-fill failed', error));
}

export function renderMarketManagerUi() {
    if (document.querySelector('.market-manager-card.is-busy')) {
        renderSkippedWhileBusy = true;
        return;
    }
    renderSkippedWhileBusy = false;
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
            ? `${className} · ${league} · ${theme.label}${festival ? ` · ${festival.name}` : ''}`
            : 'Choose a class from the header to open this stall.';
    }
    if (!isGameplaySeasonLiveFromAppState(state)) {
        list.innerHTML = renderNotice('The market stays sealed until the school year opens.');
        return;
    }
    if (!league) {
        list.innerHTML = renderNotice('Pick a class from the header, then the merchant will show this month’s stall here.');
        return;
    }
    if (!shopItemsReady()) {
        list.innerHTML = itemsFailed && !itemsLoading
            ? renderNotice('The stall could not be loaded. Check the connection and try again.', { retry: true })
            : renderNotice('Opening this class’s stall…', { spinner: true });
        return;
    }

    const scope = { league, monthKey: shopMonthKey(), festivalId: festival?.festivalId };
    const items = stallItems();
    const liveIds = new Set(items.map((item) => item.id));
    [...drafts.keys()].forEach((id) => { if (!liveIds.has(id)) drafts.delete(id); });
    const focus = captureFocus(list);
    const liveSeasonal = sortItems(items.filter((item) => shopItemShelf(item) === 'seasonal' && !item.incoming));
    const liveFestival = sortItems(items.filter((item) => shopItemShelf(item) === 'festival' && !item.incoming));
    const incoming = sortItems(items.filter((item) => item.incoming));

    list.innerHTML = [
        renderStatus(items, scope),
        renderGroup('Seasonal Treasures', liveSeasonal, restockBusy
            ? 'The merchant is bringing this month’s treasures now.'
            : 'The monthly stall is empty. Press Fill the stall and the merchant will bring this month’s treasures.'),
        festival || liveFestival.length
            ? renderGroup('Festival Stall', liveFestival, festival
                ? `${festival.name} is open, but this stall has no holiday treasures yet.`
                : 'No Festival Stall treasures on this stall.')
            : '',
        incoming.length ? renderGroup('Coming in', incoming, '') : ''
    ].join('');
    restoreFocus(list, focus);
    autoFillOnce(items, scope);
}

async function fillStall(button) {
    if (restockBusy) return;
    button.disabled = true;
    try {
        const actions = await import('../../db/actions.js');
        await actions.handleFillShopStock?.();
    } finally {
        button.disabled = false;
    }
}

function markDirty(card, itemId) {
    card.classList.add('is-dirty');
    const save = card.querySelector('[data-market-action="save"]');
    if (save && !card.classList.contains('is-busy')) save.innerHTML = '<i class="fas fa-save"></i> Save changes';
    if (drafts.has(itemId)) return;
    drafts.set(itemId, {});
}

function syncTierHint(card, priceField) {
    const tier = shopItemTier(priceField.value);
    const hint = card.querySelector('[data-tier-hint]');
    if (hint) hint.textContent = tierHint(priceField.value);
    const stockField = card.querySelector('[data-field="stock"]');
    if (stockField) stockField.max = String(stockMaxForTier(tier));
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
    list.addEventListener('input', (event) => {
        const field = event.target.closest('[data-field]');
        const card = field?.closest('[data-item-id]');
        const itemId = card?.dataset.itemId;
        if (!field || !itemId) return;
        markDirty(card, itemId);
        drafts.get(itemId)[field.dataset.field] = field.value;
        if (field.dataset.field === 'price') syncTierHint(card, field);
    });
    // Enter in the name box saves the card, like any other form.
    list.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.target.dataset?.field !== 'name') return;
        event.preventDefault();
        event.target.closest('[data-item-id]')?.querySelector('[data-market-action="save"]')?.click();
    });
    // Image errors do not bubble, so listen in the capture phase. A picture that will
    // not load says so and points at New picture instead of a broken-image icon.
    list.addEventListener('error', (event) => {
        const img = event.target;
        if (!(img instanceof HTMLImageElement) || !img.classList.contains('market-manager-card__art')) return;
        img.insertAdjacentHTML('afterend', BROKEN_PICTURE_HTML);
        img.remove();
    }, true);
    document.addEventListener('gcq:shop-restock', (event) => {
        restockBusy = Boolean(event.detail?.busy);
        if (marketManagerVisible()) renderMarketManagerUi();
    });
    list.addEventListener('click', async (event) => {
        const stallButton = event.target.closest('[data-market-stall]');
        if (stallButton) {
            if (stallButton.dataset.marketStall === 'fill') await fillStall(stallButton);
            else renderMarketManagerUi();
            return;
        }
        const button = event.target.closest('[data-market-action]');
        if (!button) return;
        const card = button.closest('[data-item-id]');
        const itemId = card?.dataset.itemId;
        if (!itemId) return;
        await handleAction(button.dataset.marketAction, itemId, card, button);
    });
}
