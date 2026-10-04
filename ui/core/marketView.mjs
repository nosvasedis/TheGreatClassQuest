// ui/core/marketView.mjs — pure markup for the Mystic Market storefront shelves.
// Shared by ui/core/shop.js and the guidebook capture (no Firebase / state imports).
import { shopItemStock } from '../../utils/shopRestock.js';
import { FAMILIAR_LEVEL_THRESHOLDS } from '../../features/familiarProgression.mjs';
import { buildFamiliarEggSvg, describeFamiliar, getFamiliarPresets } from '../../features/familiarForge.mjs';

/** The class's egg, drawn by the Familiar Forge in its signature colours. */
function familiarEggArt(typeId) {
    const preset = getFamiliarPresets(typeId)[0];
    if (!preset) return '🥚';
    return buildFamiliarEggSvg(describeFamiliar(typeId, { v: 1, preset: preset.id, seed: 7 }), { progress: 0 }).replace('class="fc ', 'class="fc fc--chip ');
}

export function escapeShopHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Paper price tag hanging in the display niche. */
export function shopPriceMarkupPlain(basePrice) {
    return `
        <span class="mm-tag__hole" aria-hidden="true"></span>
        <span class="mm-tag__price"><span class="shop-price-value">${basePrice}</span><span class="shop-price-coin" aria-hidden="true">🪙</span></span>
        <span class="sr-only">gold</span>`;
}

export function shopPriceMarkupDiscount(basePrice, finalPrice) {
    return `
        <span class="mm-tag__hole" aria-hidden="true"></span>
        <span class="mm-tag__was shop-price-was"><span class="sr-only">was </span>${basePrice}</span>
        <span class="mm-tag__price mm-tag__price--sale"><span class="shop-price-now">${finalPrice}</span><span class="shop-price-coin" aria-hidden="true">🪙</span></span>
        <span class="sr-only">gold, your price</span>`;
}

export function shopBuyBtnClass(isFamiliar, variant) {
    const base = 'shop-buy-btn shop-buy-btn--premium';
    const fam = isFamiliar ? ' shop-buy-btn--familiar' : '';
    return `${base}${fam} shop-buy-btn--${variant}`;
}

export const BUY_BTN_ICONS = {
    waiting: 'fa-hand-pointer',
    cta: 'fa-shopping-bag',
    muted: 'fa-piggy-bank',
    success: 'fa-check',
    danger: 'fa-ban'
};

export function shopBuyBtnInner(variant, label) {
    return `<i class="fas ${BUY_BTN_ICONS[variant] || 'fa-tag'}" aria-hidden="true"></i><span>${escapeShopHtml(label)}</span>`;
}

export function shopCopiesLabel(item) {
    const stock = shopItemStock(item);
    if (stock <= 1) return 'Only 1';
    return `${stock} left`;
}

const WARE_RIBBONS = {
    legendary: 'Artifact',
    festival: 'Festival',
    familiar: 'Egg'
};

/**
 * One ware on a shelf: display niche (spotlight, shelf ledge, hanging price tag), then name, blurb and till button.
 * kind: 'legendary' | 'seasonal' | 'festival'
 */
export function renderShopItemCard(item, kind = 'seasonal') {
    const isLegendary = kind === 'legendary';
    const ribbon = WARE_RIBBONS[kind]
        ? `<span class="mm-ware__ribbon">${WARE_RIBBONS[kind]}</span>`
        : '';
    const stock = isLegendary ? 0 : shopItemStock(item);
    const copies = isLegendary
        ? ''
        : `<span class="shop-item-stock mm-sticker${stock <= 1 ? ' mm-sticker--last' : ''}" data-item-id="${escapeShopHtml(item.id)}">${shopCopiesLabel(item)}</span>`;

    const imageHtml = item.image
        ? `<img src="${escapeShopHtml(item.image)}" alt="" loading="lazy" decoding="async" class="mm-ware__img">`
        : `<span class="mm-ware__emoji" aria-hidden="true">${item.icon || '📦'}</span>`;

    return `
        <article class="shop-item-card mm-ware mm-ware--${kind}" data-kind="${kind}" data-item-id="${escapeShopHtml(item.id)}"
            data-name="${escapeShopHtml(item.name)}" data-price="${Number(item.price) || 0}" data-state="waiting">
            <div class="shop-item-stage mm-ware__display">
                <span class="mm-ware__spot" aria-hidden="true"></span>
                ${ribbon}
                ${copies}
                <span class="mm-ware__sale" aria-hidden="true"></span>
                <div class="mm-ware__item">${imageHtml}</div>
                <span class="mm-ware__ledge" aria-hidden="true"></span>
                <div class="shop-price-display mm-tag" data-item-id="${escapeShopHtml(item.id)}" data-base-price="${Number(item.price) || 0}">
                    ${shopPriceMarkupPlain(item.price)}
                </div>
                <span class="mm-ware__stamp" aria-hidden="true">Sold!</span>
            </div>
            <div class="shop-item-body mm-ware__body">
                <h3 class="font-title mm-ware__name">${escapeShopHtml(item.name)}</h3>
                <p class="mm-ware__desc">${escapeShopHtml(item.description)}</p>
                <div class="shop-item-footer mm-ware__footer">
                    <button type="button" class="${shopBuyBtnClass(false, 'waiting')}"
                            data-id="${escapeShopHtml(item.id)}" data-type="${isLegendary ? 'legendary' : 'seasonal'}" disabled
                            title="Choose a student from the Shopper menu above">
                        ${shopBuyBtnInner('waiting', 'Pick a shopper')}
                    </button>
                </div>
            </div>
        </article>
    `;
}

export function renderFamiliarEggCard(fType) {
    const forms = fType.levelNames.map(n => `<strong>${escapeShopHtml(n)}</strong>`).join(' <i class="fas fa-arrow-right" aria-hidden="true"></i> ');
    return `
        <article class="shop-item-card shop-item-card--familiar mm-ware mm-ware--familiar" data-kind="familiar" data-item-id="${escapeShopHtml(fType.id)}"
            data-name="${escapeShopHtml(fType.name)}" data-price="${Number(fType.price) || 0}" data-state="waiting"
            style="--egg-color:${fType.eggColor};--egg-accent:${fType.eggAccent};">
            <div class="shop-item-stage mm-ware__display">
                <span class="mm-ware__spot" aria-hidden="true"></span>
                <span class="mm-ware__ribbon">${WARE_RIBBONS.familiar}</span>
                <span class="mm-ware__sale" aria-hidden="true"></span>
                <div class="mm-ware__item">
                    <span class="mm-ware__nest" aria-hidden="true"></span>
                    <span class="mm-ware__emoji mm-ware__egg familiar-egg-wobble" aria-hidden="true" style="display:inline-block;width:4.8rem;height:4.8rem;">${familiarEggArt(fType.id)}</span>
                </div>
                <span class="mm-ware__ledge" aria-hidden="true"></span>
                <div class="shop-price-display mm-tag" data-item-id="${escapeShopHtml(fType.id)}" data-base-price="${Number(fType.price) || 0}">
                    ${shopPriceMarkupPlain(fType.price)}
                </div>
            </div>
            <div class="shop-item-body mm-ware__body">
                <h3 class="font-title mm-ware__name">${escapeShopHtml(fType.name)}</h3>
                <p class="mm-ware__desc">${escapeShopHtml(fType.desc)}</p>
                <p class="mm-ware__flavor">${escapeShopHtml(fType.flavorHint)}</p>
                <ul class="mm-ware__facts">
                    <li><span aria-hidden="true">🥚</span> Hatches after <strong>${FAMILIAR_LEVEL_THRESHOLDS.hatch} stars</strong></li>
                    <li><span aria-hidden="true">✨</span> <strong>+${FAMILIAR_LEVEL_THRESHOLDS.level2}</strong> stars after hatch → Level 2</li>
                    <li><span aria-hidden="true">✨</span> <strong>+${FAMILIAR_LEVEL_THRESHOLDS.level3}</strong> stars after hatch → Level 3</li>
                    <li class="mm-ware__forms"><span aria-hidden="true">📛</span> ${forms}</li>
                </ul>
                <div class="shop-item-footer mm-ware__footer">
                    <button type="button" class="${shopBuyBtnClass(true, 'waiting')}"
                            data-id="${escapeShopHtml(fType.id)}" data-type="familiar" data-price="${Number(fType.price) || 0}" disabled
                            title="Choose a student from the Shopper menu above">
                        ${shopBuyBtnInner('waiting', 'Pick a shopper')}
                    </button>
                </div>
            </div>
        </article>`;
}

export function renderShelf(cardsHtml) {
    return `<div class="mm-shelf-grid">${cardsHtml}</div>`;
}

/** One department: hanging aisle sign + its shelf (or a callout). */
export function renderMarketAisle({ id, label, icon, tone, title, month = '', desc, badge = '', before = '', body }) {
    return `
        <section class="mm-aisle mm-aisle--${tone}" data-aisle="${id}" data-label="${escapeShopHtml(label)}" data-icon="${icon}" id="shop-aisle-${id}">
            ${before}
            <header class="mm-aisle__sign shop-section-head">
                <span class="mm-aisle__sign-icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
                <div class="shop-section-head-main">
                    <h3 class="shop-section-title">${title}</h3>
                    ${month ? `<p class="shop-section-season-month">${escapeShopHtml(month)}</p>` : ''}
                    <p class="shop-section-desc">${desc}</p>
                </div>
                ${badge ? `<span class="shop-section-badge shop-section-badge--${tone}">${badge}</span>` : ''}
            </header>
            ${body}
            <p class="mm-aisle__none">Nothing on this shelf is in reach yet. Keep earning stars!</p>
        </section>`;
}
