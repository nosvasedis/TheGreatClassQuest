// /ui/core/shop.js
import * as state from '../../state.js';
import * as modals from '../modals.js';
import { canUseFeature } from '../../utils/subscription.js';
import { FAMILIAR_TYPES, FAMILIAR_LEVEL_THRESHOLDS, buildFamiliarInitData } from '../../features/familiars.js';
import { getSeasonalShopPriceMeta, getLocalIsoDateString } from '../../utils.js';
import { isGameplaySeasonLiveFromAppState } from '../../utils/schoolYear.js';
import { getLiveYearGoldFromAppState } from '../../utils/yearGold.js';
import { getYearScopedHeroOfDayWinsFromAppState } from '../../utils/yearLegend.js';
import {
    isVisibleSeasonalShopItem,
    isVisibleFestivalShopItem,
    isCurrentStallItem,
    shopInventoryNeedsEnsure
} from '../../utils/shopRestock.js';
import { shopMonthKey, getMonthlyShopTheme, getActiveFestival } from '../../utils/shopCalendar.js';
import { showToast } from '../effects.js';
import {
    keeperWelcomeLine,
    keeperGreetingLine,
    keeperWareLine,
    keeperPurchaseLine,
    keeperFailLine,
    sortWareEntries,
    salePercent,
    goldNeeded
} from '../../features/marketKeeperCore.mjs';
import {
    escapeShopHtml,
    shopPriceMarkupPlain,
    shopPriceMarkupDiscount,
    shopBuyBtnClass,
    shopBuyBtnInner,
    renderShopItemCard,
    renderFamiliarEggCard,
    renderShelf,
    renderMarketAisle
} from './marketView.mjs';
import { initMarketKeeperFloat, keeperFloatSay } from './marketKeeperFloat.js';
import { closeMarketCurtains, openMarketCurtains, shopStageIsLive } from './marketCurtains.js';

// --- SHOP UI HELPERS ---

function setShopBuyBtn(btn, variant, label, { disabled = true, title = '' } = {}) {
    btn.disabled = disabled;
    btn.className = shopBuyBtnClass(btn.dataset.type === 'familiar', variant);
    btn.innerHTML = shopBuyBtnInner(variant, label);
    btn.title = title;
}

// --- MARKET KEEPER (shopkeeper speech bubble) ---

let keeperContextLine = '';
let keeperRevertTimer = null;

function keeperSay(text, { mood = '', sticky = false, revert = false } = {}) {
    const lineEl = document.getElementById('shop-keeper-line');
    const keeper = document.getElementById('shop-keeper');
    if (!lineEl || !keeper || !text) return;
    if (sticky) keeperContextLine = text;
    if (lineEl.textContent !== text) {
        lineEl.textContent = text;
        keeper.classList.remove('is-speaking');
        void keeper.offsetWidth;
        keeper.classList.add('is-speaking');
    }
    keeper.dataset.mood = mood;
    keeperFloatSay(text, { mood, revert });
    clearTimeout(keeperRevertTimer);
    if (!sticky) {
        keeperRevertTimer = setTimeout(() => {
            if (keeperContextLine) keeperSay(keeperContextLine, { sticky: true, revert: true });
        }, mood === 'celebrate' || mood === 'sad' ? 6000 : 4200);
    }
}

// --- AISLES (departments), SORT, AFFORD FILTER ---

let shopActiveAisle = 'all';
let shopSortMode = 'price-asc';
let shopAffordOnly = false;

function readShopSortPreference() {
    try {
        const saved = localStorage.getItem('gcq-shop-sort');
        if (saved === 'price-asc' || saved === 'price-desc' || saved === 'name') shopSortMode = saved;
    } catch (_) { /* storage unavailable */ }
}

function applyShopSort() {
    document.querySelectorAll('#shop-items-container .mm-shelf-grid').forEach(grid => {
        const cards = [...grid.querySelectorAll(':scope > .mm-ware')];
        if (cards.length < 2) return;
        const entries = cards.map(card => ({
            card,
            name: card.dataset.name || '',
            price: Number(card.dataset.finalPrice || card.dataset.price) || 0
        }));
        sortWareEntries(entries, shopSortMode).forEach(entry => grid.appendChild(entry.card));
    });
}

function renderShopAisleChips() {
    const nav = document.getElementById('shop-aisles');
    const chips = document.getElementById('shop-aisle-chips');
    const container = document.getElementById('shop-items-container');
    if (!nav || !chips || !container) return;
    const aisles = [...container.querySelectorAll('.mm-aisle')];
    if (!aisles.length) {
        nav.classList.add('hidden');
        return;
    }
    nav.classList.remove('hidden');
    if (shopActiveAisle !== 'all' && !aisles.some(a => a.dataset.aisle === shopActiveAisle)) {
        shopActiveAisle = 'all';
    }
    const total = container.querySelectorAll('.mm-ware').length;
    const chip = (id, icon, label, count) => `
        <button type="button" class="mm-aisle-chip mm-aisle-chip--${id}${shopActiveAisle === id ? ' is-active' : ''}"
            data-aisle="${id}" aria-pressed="${shopActiveAisle === id ? 'true' : 'false'}">
            <i class="fas ${icon}" aria-hidden="true"></i><span>${label}</span>${count ? `<span class="mm-aisle-chip__count">${count}</span>` : ''}
        </button>`;
    chips.innerHTML = chip('all', 'fa-store', 'All wares', total) + aisles.map(a =>
        chip(a.dataset.aisle, a.dataset.icon || 'fa-box', a.dataset.label || a.dataset.aisle, a.querySelectorAll('.mm-ware').length)
    ).join('');
    const sortSel = document.getElementById('shop-sort-select');
    if (sortSel) sortSel.value = shopSortMode;
}

function applyShopAisleFilters() {
    const container = document.getElementById('shop-items-container');
    if (!container) return;
    container.querySelectorAll('.mm-aisle').forEach(aisle => {
        const inAisle = shopActiveAisle === 'all' || aisle.dataset.aisle === shopActiveAisle;
        aisle.classList.toggle('is-filtered-out', !inAisle);
        const wares = aisle.querySelectorAll('.mm-ware');
        const reachable = aisle.querySelectorAll('.mm-ware[data-state="affordable"]');
        aisle.classList.toggle('is-out-of-reach', shopAffordOnly && wares.length > 0 && reachable.length === 0);
    });
    container.classList.toggle('is-afford-only', shopAffordOnly);
    document.querySelectorAll('#shop-aisle-chips .mm-aisle-chip').forEach(btn => {
        const active = btn.dataset.aisle === shopActiveAisle;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const affordBtn = document.getElementById('shop-afford-toggle');
    if (affordBtn) {
        affordBtn.classList.toggle('is-active', shopAffordOnly);
        affordBtn.setAttribute('aria-pressed', shopAffordOnly ? 'true' : 'false');
    }
}

function syncShopAffordToggle(hasShopper) {
    const btn = document.getElementById('shop-afford-toggle');
    const countEl = document.getElementById('shop-afford-count');
    if (!btn) return;
    if (!hasShopper) {
        shopAffordOnly = false;
        btn.disabled = true;
        btn.title = 'Choose a shopper first';
        if (countEl) countEl.textContent = '';
        return;
    }
    const count = document.querySelectorAll('#shop-items-container .mm-ware[data-state="affordable"]').length;
    btn.disabled = false;
    btn.title = 'Show only what this shopper can buy now';
    if (countEl) countEl.textContent = String(count);
}

const SHOPPER_PLACEHOLDER = 'Choose your adventurer…';

const SHOP_CURTAIN_SLEEPING = {
    icon: '🔮',
    title: 'The Market Sleeps',
    message: 'Pick a class from the header to lift the veil — then choose a shopper and browse the stalls.'
};

const SHOP_CURTAIN_SEALED = {
    icon: '🔏',
    title: 'The Market is Sealed',
    message: 'The school year is sealed — rest your quills and see you in September!'
};

export function isShopSeasonLive() {
    return isGameplaySeasonLiveFromAppState(state);
}

function setShopCurtainCopy({ icon, title, message }) {
    const iconEl = document.getElementById('shop-curtain-icon');
    const titleEl = document.getElementById('shop-curtain-title');
    const messageEl = document.getElementById('shop-curtain-message');
    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
}

function applyShopSeasonLock(isLive) {
    document.getElementById('shop-tab')?.classList.toggle('is-season-sealed', !isLive);
    document.getElementById('shop-window')?.classList.toggle('is-season-sealed', !isLive);
}

function setShopOpenSign(open) {
    const sign = document.getElementById('shop-open-sign');
    if (!sign) return;
    sign.classList.toggle('is-closed', !open);
    sign.innerHTML = open
        ? '<i class="fas fa-door-open"></i> Open for trade'
        : '<i class="fas fa-door-closed"></i> Closed';
}

function showShopCurtain(copy) {
    setShopCurtainCopy(copy);
    setShopOpenSign(false);
    document.getElementById('shop-curtain')?.classList.remove('hidden');
    const items = document.getElementById('shop-items-container');
    if (items) {
        items.innerHTML = '';
        items.classList.add('hidden');
    }
    document.getElementById('shop-aisles')?.classList.add('hidden');
    document.getElementById('shop-empty-state')?.classList.add('hidden');
    keeperSay(copy === SHOP_CURTAIN_SEALED
        ? 'The market is resting for the summer. See you in September!'
        : 'Shop is shut until a class walks in. Pick one from the header!', { sticky: true });
}

let shopStudentDropdownListenersBound = false;
let shopRestockBusy = false;

export function setShopRestockBusy(busy) {
    shopRestockBusy = Boolean(busy);
    syncShopRestockButton();
    // The Market Manager shows the same restock in progress without loading the Market.
    document.dispatchEvent(new CustomEvent('gcq:shop-restock', { detail: { busy: shopRestockBusy } }));
}

function syncShopRestockButton() {
    const restockBtn = document.getElementById('generate-shop-btn');
    if (!restockBtn) return;
    restockBtn.disabled = shopRestockBusy;
    restockBtn.setAttribute('aria-busy', shopRestockBusy ? 'true' : 'false');
    restockBtn.classList.toggle('is-restocking', shopRestockBusy);
    const label = shopRestockBusy ? 'Restocking…' : 'Restock the shelves';
    restockBtn.setAttribute('aria-label', label);
    restockBtn.dataset.tooltip = label;
    restockBtn.innerHTML = shopRestockBusy
        ? '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>'
        : '<i class="fas fa-sync-alt" aria-hidden="true"></i>';
}

function setShopStudentPanelOpen(open) {
    const trigger = document.getElementById('shop-shopper-trigger');
    const panel = document.getElementById('shop-shopper-listbox');
    const pill = document.querySelector('.shop-selector-pill--shopper');
    if (!trigger || !panel) return;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    pill?.classList.toggle('shop-selector-pill--dropdown-open', open);
}

function closeShopStudentDropdown() {
    setShopStudentPanelOpen(false);
}

function toggleShopStudentDropdown() {
    const panel = document.getElementById('shop-shopper-listbox');
    if (!panel) return;
    setShopStudentPanelOpen(!panel.classList.contains('is-open'));
}

function syncShopStudentOptionHighlight(value) {
    const panel = document.getElementById('shop-shopper-listbox');
    if (!panel) return;
    panel.querySelectorAll('.shop-shopper__option').forEach(btn => {
        const v = btn.dataset.value ?? '';
        btn.classList.toggle('is-selected', v === value);
        btn.setAttribute('aria-selected', v === value ? 'true' : 'false');
    });
}

function syncShopStudentTriggerLabel() {
    const sel = document.getElementById('shop-student-select');
    const display = document.getElementById('shop-shopper-display');
    if (!sel || !display) return;
    const opt = sel.options[sel.selectedIndex];
    display.textContent = opt?.textContent || SHOPPER_PLACEHOLDER;
    syncShopStudentOptionHighlight(sel.value);
}

function applyShopStudentSelection(value) {
    const sel = document.getElementById('shop-student-select');
    if (!sel) return;
    sel.value = value;
    syncShopStudentTriggerLabel();
    closeShopStudentDropdown();
    sel.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Keeps hidden native select and custom listbox in sync with student ids + labels. */
export function populateShopStudentPicker(validStudents) {
    const sel = document.getElementById('shop-student-select');
    const panel = document.getElementById('shop-shopper-listbox');
    if (!sel || !panel) return;

    const previousValue = sel.value;

    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = SHOPPER_PLACEHOLDER;
    sel.appendChild(opt0);
    validStudents.forEach(s => {
        const o = document.createElement('option');
        o.value = s.id;
        o.textContent = s.name;
        sel.appendChild(o);
    });

    panel.innerHTML = '';
    const mkBtn = (value, label, isPlaceholder) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'option');
        btn.dataset.value = value;
        btn.className = isPlaceholder
            ? 'shop-shopper__option shop-shopper__option--placeholder'
            : 'shop-shopper__option';
        btn.textContent = label;
        btn.setAttribute('aria-selected', 'false');
        return btn;
    };
    panel.appendChild(mkBtn('', SHOPPER_PLACEHOLDER, true));
    validStudents.forEach(s => {
        panel.appendChild(mkBtn(s.id, s.name, false));
    });

    const shouldRestore = previousValue && validStudents.some(s => s.id === previousValue);
    sel.value = shouldRestore ? previousValue : '';
    syncShopStudentTriggerLabel();
    closeShopStudentDropdown();
}

function ensureShopStudentDropdownListeners() {
    if (shopStudentDropdownListenersBound) return;
    shopStudentDropdownListenersBound = true;

    document.body.addEventListener('click', (e) => {
        const root = document.getElementById('shop-shopper-root');
        const trigger = document.getElementById('shop-shopper-trigger');
        const panel = document.getElementById('shop-shopper-listbox');
        if (!root || !trigger || !panel) return;

        if (trigger.contains(e.target)) {
            e.preventDefault();
            toggleShopStudentDropdown();
            return;
        }

        const optBtn = e.target.closest('.shop-shopper__option');
        if (panel.contains(e.target) && optBtn) {
            applyShopStudentSelection(optBtn.dataset.value ?? '');
            return;
        }

        if (!root.contains(e.target)) {
            closeShopStudentDropdown();
        }
    });

    document.body.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const panel = document.getElementById('shop-shopper-listbox');
        if (!panel?.classList.contains('is-open')) return;
        closeShopStudentDropdown();
        document.getElementById('shop-shopper-trigger')?.focus();
    });

    bindShopStorefrontListeners();
}

function bindShopStorefrontListeners() {
    readShopSortPreference();
    initMarketKeeperFloat();

    document.getElementById('shop-aisle-chips')?.addEventListener('click', (e) => {
        const chip = e.target.closest('.mm-aisle-chip');
        if (!chip) return;
        shopActiveAisle = chip.dataset.aisle || 'all';
        applyShopAisleFilters();
        if (shopActiveAisle !== 'all') {
            const label = chip.querySelector('span')?.textContent || 'that aisle';
            keeperSay(`Right this way, to the ${label}!`);
        }
    });

    document.getElementById('shop-sort-select')?.addEventListener('change', (e) => {
        shopSortMode = e.target.value || 'price-asc';
        try { localStorage.setItem('gcq-shop-sort', shopSortMode); } catch (_) { /* storage unavailable */ }
        applyShopSort();
    });

    document.getElementById('shop-afford-toggle')?.addEventListener('click', (e) => {
        if (e.currentTarget.disabled) return;
        shopAffordOnly = !shopAffordOnly;
        applyShopAisleFilters();
        if (shopAffordOnly) keeperSay('Only what your purse can carry. Sensible!');
    });

    const container = document.getElementById('shop-items-container');
    let hoverTimer = null;
    let hoveredCard = null;
    container?.addEventListener('pointerover', (e) => {
        if (e.pointerType === 'touch') return;
        const card = e.target.closest('.mm-ware');
        if (!card || card === hoveredCard) return;
        hoveredCard = card;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
            const gold = Number(document.getElementById('shop-items-container')?.dataset.shopperGold) || 0;
            keeperSay(keeperWareLine({
                name: card.dataset.name,
                state: card.dataset.state || 'waiting',
                finalPrice: Number(card.dataset.finalPrice || card.dataset.price) || 0,
                gold,
                kind: card.dataset.kind
            }), { mood: card.dataset.state === 'short' ? 'hopeful' : '' });
        }, 160);
    });
    container?.addEventListener('pointerleave', () => {
        hoveredCard = null;
        clearTimeout(hoverTimer);
    });

    window.addEventListener('gcq:shop-purchase', (e) => {
        const d = e.detail || {};
        keeperSay(keeperPurchaseLine({ studentName: d.studentName, itemName: d.itemName, soldOut: d.soldOut }), { mood: 'celebrate' });
        const card = d.itemId
            ? document.querySelector(`.mm-ware[data-item-id="${CSS.escape(d.itemId)}"]`)
            : null;
        if (card && !d.soldOut) {
            card.classList.remove('is-just-bought');
            void card.offsetWidth;
            card.classList.add('is-just-bought');
            setTimeout(() => card.classList.remove('is-just-bought'), 1400);
        }
        spillShopCoins();
    });

    window.addEventListener('gcq:shop-purchase-failed', (e) => {
        keeperSay(keeperFailLine(e.detail?.message), { mood: 'sad' });
    });
}

/** A few coins hop out of the purse when gold is spent. */
function spillShopCoins() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const purse = document.querySelector('#shop-command-deck .mm-purse');
    if (!purse) return;
    for (let i = 0; i < 7; i++) {
        const coin = document.createElement('span');
        coin.className = 'mm-coin-spill';
        coin.textContent = '🪙';
        coin.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 110)}px`);
        coin.style.setProperty('--dy', `${-40 - Math.round(Math.random() * 50)}px`);
        coin.style.setProperty('--rot', `${Math.round((Math.random() - 0.5) * 540)}deg`);
        coin.style.animationDelay = `${i * 45}ms`;
        purse.appendChild(coin);
        setTimeout(() => coin.remove(), 1300);
    }
}

// --- SHOP UI LOGIC ---

let shopScopeKey = null;

/** What the curtains' plaque says while the market changes hands. */
function shopCurtainPlaque() {
    if (!isShopSeasonLive()) return { kicker: 'The season is over', title: 'Closed for the summer' };
    const classId = state.get('globalSelectedClassId');
    const cls = classId ? (state.get('allTeachersClasses') || []).find(c => c.id === classId) : null;
    if (!cls) return { kicker: 'Closing up shop', title: 'Pick a class to trade' };
    return { kicker: 'Now opening for', title: `${cls.logo ? `${cls.logo} ` : ''}${cls.name || 'your class'}` };
}

export async function initializeShopTab() {
    ensureShopStudentDropdownListeners();
    // Switching class (or to no class) while the market is on screen: draw the curtains,
    // restock the shelves behind them, then part them again.
    const scopeKey = `${isShopSeasonLive() ? 'live' : 'sealed'}|${state.get('globalSelectedClassId') || ''}`;
    const curtainCall = shopScopeKey !== null && scopeKey !== shopScopeKey && shopStageIsLive();
    shopScopeKey = scopeKey;
    if (curtainCall) await closeMarketCurtains(shopCurtainPlaque());
    try {
        const { ensureShopItemsListener } = await import('../../db/listeners.js');
        const shopItemsReady = await ensureShopItemsListener();
        initializeShopTabContent({ allowAutoEnsure: shopItemsReady });
    } finally {
        if (curtainCall) openMarketCurtains();
    }
}

function initializeShopTabContent({ allowAutoEnsure = false } = {}) {
    const seasonLive = isShopSeasonLive();
    applyShopSeasonLock(seasonLive);

    if (!seasonLive) {
        populateShopStudentPicker([]);
        const shopStudentGold = document.getElementById('shop-student-gold');
        if (shopStudentGold) shopStudentGold.innerText = '0 🪙';
        document.getElementById('generate-shop-btn')?.classList.add('hidden');
        showShopCurtain(SHOP_CURTAIN_SEALED);
        return;
    }

    // 1. Determine Context
    let league = state.get('globalSelectedLeague');
    let classId = state.get('globalSelectedClassId');
    const allClasses = state.get('allTeachersClasses') || [];

    // If viewing Hero Stats for a specific student, try to get their class/league
    if (!league && classId) {
        const cls = allClasses.find(c => c.id === classId);
        if (cls) league = cls.questLevel;
    }

    // Class comes from global header selection only

    // Tab tagline is static in the template (month lives on Seasonal Treasures).

    // The shop requires an explicit class selection — show curtain whenever none is active
    if (!classId) {
        populateShopStudentPicker([]);
        const shopStudentGold = document.getElementById('shop-student-gold');
        if (shopStudentGold) shopStudentGold.innerText = "0 🪙";

        showShopCurtain(SHOP_CURTAIN_SLEEPING);
        return;
    }

    // Hide curtain now that a class is selected
    setShopCurtainCopy(SHOP_CURTAIN_SLEEPING);
    const shopCurtain = document.getElementById('shop-curtain');
    if (shopCurtain) shopCurtain.classList.add('hidden');

    // 2. Set UI Text
    document.getElementById('shop-title').innerText = "Mystic Market"; // Title is now static

    const restockBtn = document.getElementById('generate-shop-btn');
    if (restockBtn) {
        const canRestock = canUseFeature('eliteAI');
        restockBtn.classList.toggle('hidden', !canRestock);
        syncShopRestockButton();
    }
    
    document.getElementById('shop-student-gold').innerText = "0 🪙";

    // 3. Filter Students
    const myClassesInLeague = allClasses.filter(c => c.questLevel === league);
    const myClassIds = classId ? [classId] : myClassesInLeague.map(c => c.id);
    
    const validStudents = state.get('allStudents')
        .filter(s => myClassIds.includes(s.classId))
        .sort((a,b) => a.name.localeCompare(b.name));

    populateShopStudentPicker(validStudents);

    renderShopUI();
    const stallScope = { league, monthKey: shopMonthKey(), festivalId: getActiveFestival()?.festivalId };
    const currentLeagueItems = (state.get('currentShopItems') || []).filter((item) => isCurrentStallItem(item, stallScope));
    const stockNeedsEnsure = shopInventoryNeedsEnsure(currentLeagueItems, {
        activeFestivalId: stallScope.festivalId
    });
    if (allowAutoEnsure && canUseFeature('eliteAI') && stockNeedsEnsure) {
        import('../../db/actions.js').then((actions) => actions.handleEnsureShopStock?.()).catch((error) => {
            console.warn('Shop auto-ensure failed', error);
        });
    }
}

export function renderShopUI() {
    if (!isShopSeasonLive()) {
        applyShopSeasonLock(false);
        showShopCurtain(SHOP_CURTAIN_SEALED);
        return;
    }
    applyShopSeasonLock(true);
    if (!state.get('globalSelectedClassId')) {
        showShopCurtain(SHOP_CURTAIN_SLEEPING);
        return;
    }
    setShopCurtainCopy(SHOP_CURTAIN_SLEEPING);
    document.getElementById('shop-curtain')?.classList.add('hidden');

    const container = document.getElementById('shop-items-container');
    const emptyState = document.getElementById('shop-empty-state');
    const currentMonthKey = shopMonthKey();
    const monthTheme = getMonthlyShopTheme();
    const activeFestival = getActiveFestival();
    
    let league = state.get('globalSelectedLeague');
    const classId = state.get('globalSelectedClassId');
    if (!league && classId) {
        const cls = state.get('allTeachersClasses').find(c => c.id === classId);
        if (cls) league = cls.questLevel;
    }

    // 1. Get Seasonal + Festival Items
    const shopItems = state.get('currentShopItems') || [];
    const seasonalItems = shopItems
        .filter(i => i.monthKey === currentMonthKey && i.league === league && isVisibleSeasonalShopItem(i))
        .sort((a,b) => a.price - b.price);
    // Festival treasures follow the festival, not the month: Easter's stall opens in the month before.
    const festivalItems = activeFestival
        ? shopItems
            .filter(i => i.league === league && i.festivalId === activeFestival.festivalId && isVisibleFestivalShopItem(i))
            .sort((a,b) => a.price - b.price)
        : [];

    // 2. Get Legendary Artifacts (from our new file)
    import('../../features/powerUps.js').then(m => {
        const artifacts = [...m.LEGENDARY_ARTIFACTS].sort((a, b) => (a.price - b.price) || a.name.localeCompare(b.name));
        
        if (seasonalItems.length === 0 && festivalItems.length === 0 && artifacts.length === 0) {
            container.innerHTML = '';
            container.classList.add('hidden');
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            container.classList.remove('hidden');

            const canUseAI = canUseFeature('eliteAI');
            const monthLabel = monthTheme.label;

            const legendarySection = renderMarketAisle({
                id: 'legendary', label: 'Artifacts', icon: 'fa-scroll', tone: 'indigo',
                title: 'Legendary Artifacts',
                desc: 'Evergreen relics with battle-shaping perks. Stock is precious: two legendary buys per student each month.',
                badge: 'Limit 2 / month',
                body: renderShelf(artifacts.map(item => renderShopItemCard(item, 'legendary')).join(''))
            });

            const noSeasonalHtml = shopRestockBusy
                ? `<div class="shop-callout shop-callout--amber">
                        <p class="shop-callout-title"><i class="fas fa-spinner fa-spin"></i> The merchant is restocking this month's treasures</p>
                        <p class="shop-callout-text">Keep teaching — new treasures appear as their pictures arrive.</p>
                    </div>`
                : canUseAI
                ? `<div class="shop-callout shop-callout--amber">
                        <p class="shop-callout-title"><i class="fas fa-sparkles"></i> Awaiting this month's drop</p>
                        <p class="shop-callout-text">The merchant is bringing this month's treasures. They'll appear on the stall as they arrive.</p>
                    </div>`
                : `<div class="shop-callout shop-callout--locked">
                        <p class="shop-callout-title"><i class="fas fa-leaf"></i> Seasonal Treasures</p>
                        <p class="shop-callout-text">A new stall of classroom treasures each month — Elite unlocks it.</p>
                        <button type="button" class="shop-upgrade-seasonal-btn shop-callout-action">Upgrade to Elite</button>
                    </div>`;

            const festivalSection = festivalItems.length
                ? renderMarketAisle({
                    id: 'festival', label: 'Festival Stall', icon: 'fa-mask', tone: 'rose',
                    title: 'Festival Stall',
                    month: activeFestival?.name || 'Festival',
                    desc: `${activeFestival?.tagline ? `${escapeShopHtml(activeFestival.tagline)}. ` : ''}Short-lived holiday treasures. Cheaper kinds have more copies; the rarest is truly one of a kind.`,
                    badge: 'Limited',
                    before: `
                        <div class="shop-festival-banner" role="status">
                            <p class="shop-festival-banner-title"><i class="fas fa-hat-wizard"></i> Limited ${escapeShopHtml(activeFestival?.name || 'festival')} treasures</p>
                            <p class="shop-festival-banner-text">The Festival Stall is open for ${escapeShopHtml(activeFestival?.name || 'this celebration')} — these pieces vanish when the celebration ends.</p>
                        </div>`,
                    body: renderShelf(festivalItems.map(item => renderShopItemCard(item, 'festival')).join(''))
                })
                : '';

            if (festivalItems.length) maybeToastFestivalArrival(activeFestival);

            const collectionName = seasonalItems.map(item => String(item.collection || '').trim()).find(Boolean) || '';
            const seasonalSection = renderMarketAisle({
                id: 'seasonal', label: 'Seasonal', icon: 'fa-leaf', tone: 'amber',
                title: 'Seasonal Treasures',
                month: collectionName ? `${monthLabel} · ${collectionName}` : monthLabel,
                desc: "This month's classroom treasures. Heroes of the Day earn discounts, and Aurum Satchels stack on the price.",
                body: seasonalItems.length === 0
                    ? noSeasonalHtml
                    : renderShelf(seasonalItems.map(item => renderShopItemCard(item, 'seasonal')).join(''))
            });

            // For AI-enabled tiers: Festival + Seasonal first, then Legendary. Otherwise keep original order.
            let html = canUseAI
                ? festivalSection + seasonalSection + legendarySection
                : legendarySection + festivalSection + seasonalSection;

            // ─── Familiar Eggs section (Elite only) ────────────────────────────
            if (canUseFeature('familiars')) {
                html += renderMarketAisle({
                    id: 'eggs', label: 'Familiar Eggs', icon: 'fa-egg', tone: 'violet',
                    title: 'Familiar Eggs',
                    desc: 'One mystical companion per hero — buy an egg with coins, hatch it with stars, then evolve through tiers as they shine.',
                    badge: `Hatch ${FAMILIAR_LEVEL_THRESHOLDS.hatch}★`,
                    body: renderShelf(Object.values(FAMILIAR_TYPES).map(fType => renderFamiliarEggCard(fType)).join(''))
                });
            } else {
                html += `
                    <div class="shop-callout shop-callout--locked shop-callout--violet shop-section--spaced">
                        <p class="shop-callout-title"><i class="fas fa-dragon"></i> Familiar Eggs</p>
                        <p class="shop-callout-text">Living companions that ride on progress — Elite adds eggs, hatch thresholds, and evolution arcs tied to stars.</p>
                        <button type="button" class="shop-upgrade-familiars-btn shop-callout-action">Upgrade to Elite</button>
                    </div>
                `;
            }

            container.innerHTML = html;
            setShopOpenSign(true);
            applyShopSort();
            renderShopAisleChips();
            applyShopAisleFilters();
            syncShopRestockButton();
            
            const currentStudentId = document.getElementById('shop-student-select').value;
            try {
                updateShopStudentDisplay(currentStudentId || '');
            } catch (e) {
                console.warn('Shop: updateShopStudentDisplay failed', e);
            }
        }
    });
}

function maybeToastFestivalArrival(festival) {
    if (!festival?.festivalId || typeof sessionStorage === 'undefined') return;
    const key = `gcq-festival-toast:${festival.festivalId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    showToast(`Limited ${festival.name} treasures have arrived in the Festival Stall — they vanish after the celebration.`, 'info');
}

function resetShopWareCard(card) {
    card.classList.remove('is-on-sale');
    delete card.dataset.saleTheme;
    card.dataset.state = 'waiting';
    card.dataset.finalPrice = card.dataset.price || '';
    const sale = card.querySelector('.mm-ware__sale');
    if (sale) sale.textContent = '';
}

export async function updateShopStudentDisplay(studentId) {
    const goldDisplay = document.getElementById('shop-student-gold');
    const buyBtns = document.querySelectorAll('.shop-buy-btn');
    const shopHeader = document.getElementById('shop-student-select')?.closest('.shop-selector-pill');
    const container = document.getElementById('shop-items-container');

    // Sale themes follow the shopper's standing (Hero of the Day, or Hero-of-the-Day legend tier)
    const ringMap = {
        hero: 'ring-red-500',
        mythic: 'ring-fuchsia-500',
        golden: 'ring-amber-400',
        rising: 'ring-sky-400',
        none: 'ring-slate-400'
    };
    const gradientMap = {
        hero: 'from-red-500 to-orange-500',
        mythic: 'from-fuchsia-500 to-indigo-600',
        golden: 'from-amber-400 to-orange-500',
        rising: 'from-sky-400 to-cyan-500',
        none: 'from-slate-400 to-slate-500'
    };

    // Trigger magical reflow effect on header pill (hero / legend rings)
    if (shopHeader) {
        shopHeader.classList.remove('scale-105', 'animate-pulse');
        void shopHeader.offsetWidth;
        shopHeader.classList.add('transition-all', 'duration-500', 'scale-105');
        setTimeout(() => shopHeader.classList.remove('scale-105'), 500);

        shopHeader.className = shopHeader.className.replace(/ring-[a-z]+-\d+/g, '').replace(/bg-[a-z]+-50/g, '').trim();
        shopHeader.classList.remove('ring-4', 'ring-2', 'rounded-xl', 'p-2');
    }
    document.getElementById('shop-hero-badge')?.remove();
    document.getElementById('shop-legend-badge')?.remove();

    document.querySelectorAll('#shop-items-container .mm-ware').forEach(resetShopWareCard);

    if (!studentId) {
        goldDisplay.innerText = "0 🪙";
        if (container) delete container.dataset.shopperGold;
        buyBtns.forEach(btn => {
            setShopBuyBtn(btn, 'waiting', 'Pick a shopper', { title: 'Choose a student from the Shopper menu above' });
        });
        document.querySelectorAll('.shop-price-display').forEach(el => {
            const basePrice = el.dataset.basePrice;
            if (basePrice !== undefined && basePrice !== '') el.innerHTML = shopPriceMarkupPlain(basePrice);
        });
        syncShopAffordToggle(false);
        applyShopSort();
        applyShopAisleFilters();
        keeperSay(keeperWelcomeLine(String(new Date().getDate())), { sticky: true });
        return;
    }

    const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
    const gold = getLiveYearGoldFromAppState(scoreData, state);
    const inventory = scoreData?.inventory || [];
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;
    const heroOfDayWins = getYearScopedHeroOfDayWinsFromAppState(scoreData, state);
    const currentMonthKey = getLocalIsoDateString().substring(0, 7);
    const aurumVoucherPercent = Number(scoreData?.aurumVoucherPercent) || 0;
    const hasAurumVoucher = scoreData?.aurumVoucherMonth === currentMonthKey && aurumVoucherPercent > 0;

    // --- CHECK HERO STATUS ---
    const reigningHero = state.get('reigningHero');
    const isHero = reigningHero && reigningHero.id === studentId;

    const legendMeta = getSeasonalShopPriceMeta(100, { isReigningHero: false, heroOfDayWins });
    const isMythic = legendMeta.legendTier.key === 'mythic';
    const themeKey = isHero ? 'hero' : (ringMap[legendMeta.legendTier.key] ? legendMeta.legendTier.key : 'none');

    if (shopHeader) {
        if (isHero) {
            shopHeader.classList.add('ring-2', ringMap.hero, 'transition-all');
            const badge = document.createElement('div');
            badge.id = 'shop-hero-badge';
            badge.className = `shop-status-badge bg-gradient-to-r ${gradientMap.hero} text-white ${isMythic ? 'animate-pulse' : ''}`;
            badge.innerHTML = '<i class="fas fa-crown"></i><span>Hero of the Day</span>';
            shopHeader.appendChild(badge);
        } else if (legendMeta.legendDiscount > 0) {
            shopHeader.classList.add('ring-2', ringMap[themeKey], 'transition-all');
            const badge = document.createElement('div');
            badge.id = 'shop-legend-badge';
            badge.className = `shop-status-badge bg-gradient-to-r ${gradientMap[themeKey]} text-white ${isMythic ? 'animate-pulse' : ''}`;
            badge.innerHTML = `<i class="fas fa-trophy"></i><span>${legendMeta.legendTier.label} ${legendMeta.legendDiscount}% off</span>`;
            shopHeader.appendChild(badge);
        }
    }

    // LIMIT CHECK 1: Individual Legendary limit (2 per month)
    const legendariesThisMonth = inventory.filter(i => i.id && i.id.startsWith('leg_') && i.acquiredAt && i.acquiredAt.startsWith(currentMonthKey));
    const legLimitReached = legendariesThisMonth.length >= 2;

    // LIMIT CHECK 2: Pathfinder Map (1 per class per month)
    const { LEGENDARY_ARTIFACTS, isItemUsable } = await import('../../features/powerUps.js');
    const classData = state.get('allSchoolClasses').find(c => c.id === student.classId);
    const pathfinderBonusThisMonth = Number(classData?.teamQuestBonuses?.[currentMonthKey]) || 0;

    const classStudents = state.get('allStudents').filter(s => s.classId === student.classId);
    const classScores = state.get('allStudentScores').filter(sc => classStudents.some(cs => cs.id === sc.id));
    const pathfinderHeldBySomeone = classScores.some(sc => sc.inventory?.some(i => i.id === 'leg_pathfinder' && i.acquiredAt && i.acquiredAt.startsWith(currentMonthKey)));
    const pathfinderLockedForClass = pathfinderBonusThisMonth >= 10 || pathfinderHeldBySomeone;

    // LIMIT CHECK 3: Mask of the Protagonist (1 per student per month)
    const protagonistThisMonth = scoreData?.lastProtagonistPurchaseMonth === currentMonthKey || inventory.some(i => i.id === 'leg_protagonist' && i.acquiredAt && i.acquiredAt.startsWith(currentMonthKey));

    // Update UI Display
    goldDisplay.innerText = `${gold} 🪙`;
    if (container) container.dataset.shopperGold = String(gold);

    buyBtns.forEach(btn => {
        const itemId = btn.dataset.id;
        const isFamiliar = btn.dataset.type === 'familiar';
        const isLegendary = btn.dataset.type === 'legendary';

        // --- PRICE CALCULATION ---
        let basePrice = 10;
        if (isFamiliar) {
            basePrice = parseInt(btn.dataset.price || '40');
        } else if (isLegendary) {
            basePrice = LEGENDARY_ARTIFACTS.find(a => a.id === itemId)?.price || 0;
        } else {
            basePrice = state.get('currentShopItems').find(i => i.id === itemId)?.price || 10;
        }

        let finalPrice = basePrice;
        let hasDiscount = false;

        if (!isLegendary && !isFamiliar) {
            const priceMeta = getSeasonalShopPriceMeta(basePrice, {
                isReigningHero: !!isHero,
                heroOfDayWins
            });
            finalPrice = priceMeta.finalPrice;
            hasDiscount = priceMeta.totalDiscount > 0;
        }

        if (hasAurumVoucher) {
            finalPrice = Math.max(1, Math.round(finalPrice * ((100 - aurumVoucherPercent) / 100)));
            hasDiscount = true;
        }

        // --- UPDATE CARD PRICE TAG + SALE STICKER ---
        const card = btn.closest('.mm-ware');
        const priceDisplay = card?.querySelector('.shop-price-display')
            || document.querySelector(`.shop-price-display[data-item-id="${itemId}"]`);
        const onSale = hasDiscount && finalPrice < basePrice;
        if (card) {
            card.dataset.finalPrice = String(finalPrice);
            card.classList.toggle('is-on-sale', onSale);
            if (onSale) {
                card.dataset.saleTheme = hasAurumVoucher && !isHero && !legendMeta.legendDiscount ? 'aurum' : themeKey;
                const sale = card.querySelector('.mm-ware__sale');
                if (sale) sale.textContent = `-${salePercent(basePrice, finalPrice)}%`;
            }
        }
        if (priceDisplay) {
            priceDisplay.innerHTML = onSale
                ? shopPriceMarkupDiscount(basePrice, finalPrice)
                : shopPriceMarkupPlain(String(basePrice));
        }

        const setState = (s) => { if (card) card.dataset.state = s; };
        const shortLabel = () => `Need ${goldNeeded(gold, finalPrice)} more`;

        // Familiar egg buttons
        if (isFamiliar) {
            if (scoreData?.familiar) {
                setShopBuyBtn(btn, 'success', 'Already owned');
                setState('owned');
            } else if (gold >= finalPrice) {
                setShopBuyBtn(btn, 'cta', `Buy for ${finalPrice}`, { disabled: false });
                setState('affordable');
            } else {
                setShopBuyBtn(btn, 'muted', shortLabel(), { title: 'Not enough gold' });
                setState('short');
            }
            return;
        }

        const alreadyOwned = inventory.some(i => i.id === itemId);
        const legendaryArtifact = isLegendary ? LEGENDARY_ARTIFACTS.find(a => a.id === itemId) : null;
        const isLegendaryUsable = !!(legendaryArtifact && isItemUsable(legendaryArtifact.name));

        if (alreadyOwned && isLegendary && !isLegendaryUsable) {
            setShopBuyBtn(btn, 'success', 'Owned');
            setState('owned');
        } else if (isLegendary && legLimitReached) {
            setShopBuyBtn(btn, 'danger', 'Monthly limit (2/2)');
            setState('limit');
        } else if (itemId === 'leg_pathfinder' && pathfinderLockedForClass) {
            setShopBuyBtn(btn, 'danger', 'Class limit reached');
            setState('limit');
        } else if (itemId === 'leg_protagonist' && protagonistThisMonth) {
            setShopBuyBtn(btn, 'danger', 'Limit: 1/month');
            setState('limit');
        } else if (gold >= finalPrice) {
            setShopBuyBtn(btn, 'cta', `Buy for ${finalPrice}`, { disabled: false });
            setState('affordable');
        } else {
            setShopBuyBtn(btn, 'muted', shortLabel(), { title: 'Not enough gold' });
            setState('short');
        }
    });

    applyShopSort();
    syncShopAffordToggle(true);
    applyShopAisleFilters();

    const allWares = document.querySelectorAll('#shop-items-container .mm-ware');
    keeperSay(keeperGreetingLine({
        studentName: student.name,
        gold,
        affordableCount: document.querySelectorAll('#shop-items-container .mm-ware[data-state="affordable"]').length,
        totalCount: allWares.length,
        isHero: !!isHero,
        legendLabel: legendMeta.legendTier?.label || '',
        legendDiscount: legendMeta.legendDiscount || 0,
        voucherPercent: hasAurumVoucher ? aurumVoucherPercent : 0
    }), { sticky: true });
}

export function renderEconomyStudentSelect() {
    const select = document.getElementById('economy-student-select');
    if (!select) return;
    
    const currentVal = select.value;
    
    // Get all students and group by class
    const allTeachersClasses = state.get('allTeachersClasses');
    const classesMap = allTeachersClasses.reduce((acc, c) => {
        acc[c.id] = { name: c.name, students: [] };
        return acc;
    }, {});
    
    state.get('allStudents').forEach(s => {
        if (classesMap[s.classId]) {
            classesMap[s.classId].students.push(s);
        }
    });

    let html = '<option value="">Select a student...</option>';
    
    Object.keys(classesMap).sort((a, b) => classesMap[a].name.localeCompare(classesMap[b].name)).forEach(classId => {
        const classData = classesMap[classId];
        if (classData.students.length > 0) {
            html += `<optgroup label="${classData.name}">`;
            classData.students.sort((a,b) => a.name.localeCompare(b.name)).forEach(s => {
                html += `<option value="${s.id}">${s.name}</option>`;
            });
            html += `</optgroup>`;
        }
    });

    select.innerHTML = html;
    select.value = currentVal;
}
