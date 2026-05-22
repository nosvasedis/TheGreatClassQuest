// /ui/core/shop.js
import * as state from '../../state.js';
import { showToast } from '../effects.js';
import * as modals from '../modals.js';
import { canUseFeature } from '../../utils/subscription.js';
import { FAMILIAR_TYPES, FAMILIAR_LEVEL_THRESHOLDS, buildFamiliarInitData } from '../../features/familiars.js';
import { getSeasonalShopPriceMeta } from '../../utils.js';

// --- SHOP UI HELPERS ---

function shopPriceMarkupPlain(basePrice) {
    return `
        <span class="shop-price-label">Price</span>
        <div class="shop-price-pill">
            <span class="shop-price-value">${basePrice}</span>
            <span class="shop-price-coin" aria-hidden="true">🪙</span>
        </div>`;
}

function shopPriceMarkupDiscount(basePrice, finalPrice, finalPriceClassNames) {
    return `
        <span class="shop-price-label">Your price</span>
        <div class="shop-price-pill shop-price-pill--sale">
            <span class="shop-price-was">${basePrice}</span>
            <span class="shop-price-now ${finalPriceClassNames}">${finalPrice}</span>
            <span class="shop-price-coin" aria-hidden="true">🪙</span>
        </div>`;
}

function shopBuyBtnClass(isFamiliar, variant) {
    const base = 'shop-buy-btn shop-buy-btn--premium';
    const fam = isFamiliar ? ' shop-buy-btn--familiar' : '';
    return `${base}${fam} shop-buy-btn--${variant}`;
}

const SHOPPER_PLACEHOLDER = 'Choose your adventurer…';

let shopStudentDropdownListenersBound = false;

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
}

// --- SHOP UI LOGIC ---

export function initializeShopTab() {
    ensureShopStudentDropdownListeners();

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

        const shopCurtain = document.getElementById('shop-curtain');
        if (shopCurtain) shopCurtain.classList.remove('hidden');
        document.getElementById('shop-items-container').innerHTML = '';
        document.getElementById('shop-items-container').classList.add('hidden');
        document.getElementById('shop-empty-state').classList.add('hidden');
        return;
    }

    // Hide curtain now that a class is selected
    const shopCurtain = document.getElementById('shop-curtain');
    if (shopCurtain) shopCurtain.classList.add('hidden');

    // 2. Set UI Text
    document.getElementById('shop-title').innerText = "Mystic Market"; // Title is now static

    const restockBtn = document.getElementById('generate-shop-btn');
    if (restockBtn) {
        const canRestock = canUseFeature('eliteAI');
        restockBtn.classList.toggle('hidden', !canRestock);
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
}

export function renderShopUI() {
    const container = document.getElementById('shop-items-container');
    const emptyState = document.getElementById('shop-empty-state');
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    
    let league = state.get('globalSelectedLeague');
    const classId = state.get('globalSelectedClassId');
    if (!league && classId) {
        const cls = state.get('allTeachersClasses').find(c => c.id === classId);
        if (cls) league = cls.questLevel;
    }

    // 1. Get Seasonal Items
    const seasonalItems = state.get('currentShopItems')
        .filter(i => i.monthKey === currentMonthKey && i.league === league)
        .sort((a,b) => a.price - b.price);

    // 2. Get Legendary Artifacts (from our new file)
    import('../../features/powerUps.js').then(m => {
        const artifacts = [...m.LEGENDARY_ARTIFACTS].sort((a, b) => (a.price - b.price) || a.name.localeCompare(b.name));
        
        if (seasonalItems.length === 0 && artifacts.length === 0) {
            container.innerHTML = '';
            container.classList.add('hidden');
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            container.classList.remove('hidden');

            const canUseAI = canUseFeature('eliteAI');
            const monthLabel = new Date().toLocaleString('en-US', {month: 'long'});

            const legendarySection = `
                <div class="shop-section col-span-full">
                    <div class="shop-section-head shop-section-head--indigo">
                        <div class="shop-section-head-main">
                            <h3 class="shop-section-title"><i class="fas fa-scroll shop-section-title-icon"></i> Legendary Artifacts</h3>
                            <p class="shop-section-desc">Evergreen relics with battle-shaping perks — stock is precious: two legendary buys per student each month.</p>
                        </div>
                        <span class="shop-section-badge shop-section-badge--indigo">Limit 2 / month</span>
                    </div>
                </div>
            ` + artifacts.map(item => renderShopItemCard(item, true)).join('');

            const noSeasonalHtml = canUseAI
                ? `<div class="shop-callout shop-callout--amber col-span-full">
                        <p class="shop-callout-title"><i class="fas fa-sparkles"></i> Awaiting this month's drop</p>
                        <p class="shop-callout-text">The caravan's shelves are empty — tap <strong>Restock</strong> to weave fresh, AI-crafted treasures for your class theme.</p>
                    </div>`
                : `<div class="shop-callout shop-callout--locked col-span-full">
                        <p class="shop-callout-title"><i class="fas fa-leaf"></i> Seasonal Treasures</p>
                        <p class="shop-callout-text">Monthly rotating flair — Elite unlocks AI-generated loot that refreshes with the calendar.</p>
                        <button type="button" class="shop-upgrade-seasonal-btn shop-callout-action">Upgrade to Elite</button>
                    </div>`;

            const seasonalSection = `
                <div class="shop-section col-span-full">
                    <div class="shop-section-head shop-section-head--amber">
                        <div class="shop-section-head-main">
                            <h3 class="shop-section-title"><i class="fas fa-leaf shop-section-title-icon"></i> Seasonal Treasures</h3>
                            <p class="shop-section-season-month">${monthLabel}</p>
                            <p class="shop-section-desc shop-section-desc--after-month">Limited-time flair priced for the moment — heroes earn discounts as legends; Aurum vouchers stack on seasonal tags.</p>
                        </div>
                    </div>
                </div>
            ` + (seasonalItems.length === 0 ? noSeasonalHtml : seasonalItems.map(item => renderShopItemCard(item, false)).join(''));

            // For AI-enabled tiers: Seasonal first, then Legendary. Otherwise keep original order.
            let html = canUseAI
                ? seasonalSection + `<div class="col-span-full mt-8"></div>` + legendarySection
                : legendarySection + `<div class="col-span-full mt-8"></div>` + seasonalSection;

            // ─── Familiar Eggs section (Elite only) ────────────────────────────
            if (canUseFeature('familiars')) {
                html += `
                    <div class="shop-section col-span-full shop-section--spaced">
                        <div class="shop-section-head shop-section-head--violet">
                            <div class="shop-section-head-main">
                                <h3 class="shop-section-title"><i class="fas fa-egg shop-section-title-icon"></i> Familiar Eggs</h3>
                                <p class="shop-section-desc">One mystical companion per hero — buy an egg with coins, hatch it with stars, then evolve through tiers as they shine.</p>
                            </div>
                            <span class="shop-section-badge shop-section-badge--violet">Hatch ${FAMILIAR_LEVEL_THRESHOLDS.hatch}★</span>
                        </div>
                    </div>
                `;
                html += Object.values(FAMILIAR_TYPES).map(fType => renderFamiliarEggCard(fType)).join('');
            } else {
                html += `
                    <div class="shop-callout shop-callout--locked shop-callout--violet col-span-full shop-section--spaced">
                        <p class="shop-callout-title"><i class="fas fa-dragon"></i> Familiar Eggs</p>
                        <p class="shop-callout-text">Living companions that ride on progress — Elite adds eggs, hatch thresholds, and evolution arcs tied to stars.</p>
                        <button type="button" class="shop-upgrade-familiars-btn shop-callout-action">Upgrade to Elite</button>
                    </div>
                `;
            }

            container.innerHTML = html;
            
            const currentStudentId = document.getElementById('shop-student-select').value;
            try {
                updateShopStudentDisplay(currentStudentId || '');
            } catch (e) {
                console.warn('Shop: updateShopStudentDisplay failed', e);
            }
        }
    });
}

/**
 * Shared card renderer to keep things neat
 */
function renderShopItemCard(item, isLegendary) {
    const badge = isLegendary 
        ? `<div class="absolute top-2 right-2 z-10 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow transform -rotate-2 border border-indigo-400">ARTIFACT</div>`
        : '';

    const imageHtml = item.image 
        ? `<img src="${item.image}" class="relative w-full h-full object-contain filter drop-shadow-md group-hover:scale-110 transition-transform duration-500">`
        : `<div class="text-7xl group-hover:scale-125 transition-transform duration-500">${item.icon || '📦'}</div>`;

    return `
        <div class="shop-item-card group flex flex-col relative overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_20px_rgba(251,191,36,0.25)]">
            ${badge}
            <div class="shop-item-stage relative flex items-center justify-center overflow-hidden">
                ${imageHtml}
            </div>
            <div class="shop-item-body flex-grow flex flex-col">
                <h3 class="font-title text-xl text-amber-300 leading-tight mb-1">${item.name}</h3>
                <p class="text-indigo-300/95 text-xs mb-2 line-clamp-3 flex-grow">${item.description}</p>
                <div class="shop-item-footer">
                    <div class="shop-price-display" data-item-id="${item.id}" data-base-price="${item.price}">
                        ${shopPriceMarkupPlain(item.price)}
                    </div>
                    <button type="button" class="${shopBuyBtnClass(false, 'waiting')}"
                            data-id="${item.id}" data-type="${isLegendary ? 'legendary' : 'seasonal'}" disabled
                            title="Choose a student from the Shopper menu above">
                        Pick shopper
                    </button>
                </div>
            </div>
        </div>
    `;
}

export async function updateShopStudentDisplay(studentId) {
    const goldDisplay = document.getElementById('shop-student-gold');
    const buyBtns = document.querySelectorAll('.shop-buy-btn');
    const shopHeader = document.getElementById('shop-student-select')?.closest('.shop-selector-pill');
    const container = document.getElementById('shop-items-container');

    const glowMap = {
        hero: { gradient: 'from-red-500 to-orange-500', ring: 'ring-red-500', shadow: 'shadow-[0_0_40px_rgba(239,68,68,0.6)]', text: 'text-red-400' },
        mythic: { gradient: 'from-fuchsia-500 to-indigo-600', ring: 'ring-fuchsia-500', shadow: 'shadow-[0_0_40px_rgba(217,70,239,0.6)]', text: 'text-fuchsia-400' },
        golden: { gradient: 'from-amber-400 to-orange-500', ring: 'ring-amber-400', shadow: 'shadow-[0_0_40px_rgba(251,191,36,0.6)]', text: 'text-amber-400' },
        rising: { gradient: 'from-sky-400 to-cyan-500', ring: 'ring-sky-400', shadow: 'shadow-[0_0_40px_rgba(56,189,248,0.6)]', text: 'text-sky-400' },
        none: { gradient: 'from-slate-400 to-slate-500', ring: 'ring-slate-400', shadow: 'shadow-[0_0_30px_rgba(148,163,184,0.6)]', text: 'text-slate-400' }
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
    const existingHeroBadge = document.getElementById('shop-hero-badge');
    if (existingHeroBadge) existingHeroBadge.remove();
    const existingLegendBadge = document.getElementById('shop-legend-badge');
    if (existingLegendBadge) existingLegendBadge.remove();

    if (!studentId) {
        goldDisplay.innerText = "0 🪙";
        buyBtns.forEach(btn => {
            btn.disabled = true;
            btn.innerText = "Pick shopper";
            btn.className = shopBuyBtnClass(btn.dataset.type === 'familiar', 'waiting');
        });
        document.querySelectorAll('.shop-price-display').forEach(el => {
            const basePrice = el.dataset.basePrice;
            const card = el.closest('.shop-item-card');
            if (card) {
                card.className = card.className.replace(/ring-[a-z]+-\d+/g, '').replace(/shadow-\[.*?\]/g, '').trim();
                card.classList.remove('ring-4', 'transform', 'scale-105', 'z-10');
                card.classList.add('hover:-translate-y-2');
            }
            if (basePrice !== undefined && basePrice !== '') el.innerHTML = shopPriceMarkupPlain(basePrice);
        });
        return;
    }

    const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
    const gold = scoreData && scoreData.gold !== undefined ? scoreData.gold : (scoreData?.totalStars || 0);
    const inventory = scoreData?.inventory || [];
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;
    const heroOfDayWins = scoreData?.heroOfDayWins || 0;
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    const aurumVoucherPercent = Number(scoreData?.aurumVoucherPercent) || 0;
    const hasAurumVoucher = scoreData?.aurumVoucherMonth === currentMonthKey && aurumVoucherPercent > 0;

    // --- CHECK HERO STATUS ---
    const reigningHero = state.get('reigningHero');
    const isHero = reigningHero && reigningHero.id === studentId;

    const legendMeta = getSeasonalShopPriceMeta(100, { isReigningHero: false, heroOfDayWins });
    const isMythic = legendMeta.legendTier.key === 'mythic';
    const activeGlowTheme = isHero ? glowMap.hero : (glowMap[legendMeta.legendTier.key] || glowMap.none);

    if (shopHeader) {
        if (isHero) {
            shopHeader.classList.add('ring-2', activeGlowTheme.ring, 'transition-all');
            const badge = document.createElement('div');
            badge.id = 'shop-hero-badge';
            badge.className = `shop-status-badge bg-gradient-to-r ${activeGlowTheme.gradient} text-white ${isMythic ? 'animate-pulse' : ''}`;
            badge.innerHTML = '<i class="fas fa-crown"></i><span>Hero of the Day</span>';
            shopHeader.appendChild(badge);
        } else if (legendMeta.legendDiscount > 0) {
            shopHeader.classList.add('ring-2', activeGlowTheme.ring, 'transition-all');
            const badge = document.createElement('div');
            badge.id = 'shop-legend-badge';
            badge.className = `shop-status-badge bg-gradient-to-r ${activeGlowTheme.gradient} text-white ${isMythic ? 'animate-pulse' : ''}`;
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

        // --- UPDATE CARD PRICE DISPLAY ---
        const priceDisplay = document.querySelector(`.shop-price-display[data-item-id="${itemId}"]`);
        if (priceDisplay) {
            const card = priceDisplay.closest('.shop-item-card');
            
            // Clean up old glow classes
            if (card) {
                card.className = card.className.replace(/ring-[a-z]+-\d+/g, '').replace(/shadow-\[.*?\]/g, '').trim();
                card.classList.remove('ring-4', 'transform', 'scale-105', 'z-10');
            }

            if (hasDiscount && finalPrice < basePrice) {
                if (card) {
                    card.classList.add('ring-4', activeGlowTheme.ring, activeGlowTheme.shadow, 'transform', 'scale-105', 'z-10', 'transition-all', 'duration-500');
                    card.classList.remove('hover:-translate-y-2');
                }
                priceDisplay.innerHTML = shopPriceMarkupDiscount(basePrice, finalPrice, `${activeGlowTheme.text} animate-bounce`);
            } else {
                if (card) {
                    card.classList.add('hover:-translate-y-2');
                }
                priceDisplay.innerHTML = shopPriceMarkupPlain(String(basePrice));
            }
        }

        // Familiar egg buttons
        if (btn.dataset.type === 'familiar') {
            const hasFamiliar = !!scoreData?.familiar;
            if (hasFamiliar) {
                btn.disabled = true;
                btn.innerText = 'Already Owned';
                btn.className = shopBuyBtnClass(true, 'success');
                btn.title = '';
            } else if (gold >= finalPrice) {
                btn.disabled = false;
                btn.innerText = 'Buy';
                btn.className = shopBuyBtnClass(true, 'cta');
                btn.title = '';
            } else {
                btn.disabled = true;
                btn.innerText = 'Buy';
                btn.className = shopBuyBtnClass(true, 'muted');
                btn.title = 'Not enough gold';
            }
            return;
        }

        const alreadyOwned = inventory.some(i => i.id === itemId);
        const legendaryArtifact = isLegendary ? LEGENDARY_ARTIFACTS.find(a => a.id === itemId) : null;
        const isLegendaryUsable = !!(legendaryArtifact && isItemUsable(legendaryArtifact.name));

        if (alreadyOwned && isLegendary && !isLegendaryUsable) {
            btn.disabled = true;
            btn.innerText = "Owned";
            btn.className = shopBuyBtnClass(isFamiliar, 'success');
            btn.title = '';
        }
        else if (isLegendary && legLimitReached) {
            btn.disabled = true;
            btn.innerText = "Monthly limit (2/2)";
            btn.className = shopBuyBtnClass(isFamiliar, 'danger');
            btn.title = '';
        }
        else if (itemId === 'leg_pathfinder' && pathfinderLockedForClass) {
            btn.disabled = true;
            btn.innerText = "Class limit reached";
            btn.className = shopBuyBtnClass(isFamiliar, 'danger');
            btn.title = '';
        }
        else if (itemId === 'leg_protagonist' && protagonistThisMonth) {
            btn.disabled = true;
            btn.innerText = "Limit: 1/month";
            btn.className = shopBuyBtnClass(isFamiliar, 'danger');
            btn.title = '';
        }
        else if (gold >= finalPrice) {
            btn.disabled = false;
            btn.innerText = 'Buy';
            btn.className = shopBuyBtnClass(isFamiliar, 'cta');
            btn.title = '';
        }
        else {
            btn.disabled = true;
            btn.innerText = 'Buy';
            btn.className = shopBuyBtnClass(isFamiliar, 'muted');
            btn.title = 'Not enough gold';
        }
    });
}

function renderFamiliarEggCard(fType) {
    return `
        <div class="shop-item-card shop-item-card--familiar group flex flex-col relative overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_22px_rgba(167,139,250,0.28)]">
            <div class="absolute top-2 right-2 z-10 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow transform -rotate-2 border border-purple-400">EGG</div>
            <div class="shop-item-stage relative overflow-hidden" style="background:linear-gradient(135deg,${fType.eggColor}33,${fType.eggAccent}22);">
                <div class="text-7xl group-hover:scale-125 transition-transform duration-500 familiar-egg-wobble" style="filter:drop-shadow(0 0 12px ${fType.eggColor});">🥚</div>
                <div class="absolute bottom-2 text-[10px] font-bold px-2 py-1 rounded-full text-white/80" style="background:${fType.eggColor}88;">${fType.name}</div>
            </div>
            <div class="p-4 pb-0 flex-grow flex flex-col">
                <h3 class="font-title text-xl text-purple-300 leading-tight mb-1">${fType.name}</h3>
                <p class="text-indigo-300 text-xs mb-1 flex-grow">${fType.desc}</p>
                <p class="text-purple-400/70 text-[10px] italic mb-3">${fType.flavorHint}</p>
                <div class="flex flex-col gap-1 mb-3 text-[10px] text-indigo-400">
                    <div>🥚 Hatches after <strong class="text-white">${FAMILIAR_LEVEL_THRESHOLDS.hatch} stars</strong> earned</div>
                    <div>✨ Evolves: <strong class="text-white">+${FAMILIAR_LEVEL_THRESHOLDS.level2}</strong> stars after hatch → Level 2</div>
                    <div>✨ Evolves: <strong class="text-white">+${FAMILIAR_LEVEL_THRESHOLDS.level3}</strong> stars after hatch → Level 3</div>
                    <div>📛 Forms: ${fType.levelNames.map(n => `<strong class="text-purple-300">${n}</strong>`).join(' → ')}</div>
                </div>
                <div class="shop-item-footer">
                    <div class="shop-price-display" data-item-id="${fType.id}" data-base-price="${fType.price}">
                        ${shopPriceMarkupPlain(fType.price)}
                    </div>
                    <button type="button" class="${shopBuyBtnClass(true, 'waiting')}"
                            data-id="${fType.id}" data-type="familiar" data-price="${fType.price}" disabled
                            title="Choose a student from the Shopper menu above">
                        Pick shopper
                    </button>
                </div>
            </div>
        </div>`;
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
