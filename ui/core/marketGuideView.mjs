// ui/core/marketGuideView.mjs — "How treasures work" in the Mystic Market: pure markup.
// The controller (marketGuide.js) passes in the live numbers for this league and shopper.
import { escapeShopHtml, charmGemsMarkup } from './marketView.mjs';
import { TREASURE_CHARMS, HOARD_RANKS, HOARD_POINTS, HOARD_FESTIVAL_BONUS, CHILD_TIER_LIMITS, charmText } from '../../features/treasureCharmsCore.mjs';

const TIERS = [
    { id: 'common', label: 'Common', price: '10–18' },
    { id: 'rare', label: 'Rare', price: '35–50' },
    { id: 'legendary', label: 'Legendary', price: '80–120' }
];

function charmChips(tier, young) {
    return TREASURE_CHARMS[tier].map((charm) => `
        <li class="mg-charm" title="${escapeShopHtml(charmText(charm, { young }))}">
            <span class="mg-charm__icon" aria-hidden="true">${escapeShopHtml(charm.icon)}</span>
            <span class="mg-charm__text"><b>${escapeShopHtml(charm.title)}</b><span>${escapeShopHtml(charmText(charm, { young }))}</span></span>
        </li>`).join('');
}

function hoardLadder(hoard) {
    const points = hoard ? hoard.points : -1;
    return HOARD_RANKS.map((rank) => {
        const reached = points >= rank.points;
        const next = hoard && hoard.next && hoard.next.rank === rank.rank;
        return `
            <li class="mg-rank${reached ? ' is-reached' : ''}${next ? ' is-next' : ''}">
                <span class="mg-rank__icon" aria-hidden="true">${escapeShopHtml(rank.icon)}</span>
                <span class="mg-rank__name">${escapeShopHtml(rank.title)}</span>
                <span class="mg-rank__pts">${rank.points} pts</span>
                <span class="mg-rank__gold">+${rank.gold} Gold</span>
            </li>`;
    }).join('');
}

/**
 * @param {{ league?: string, young?: boolean, children?: number, classCount?: number,
 *   copies?: {common?: number|null, rare?: number|null, legendary?: number|null},
 *   shopper?: { name: string, hoard: ReturnType<import('../../features/treasureCharmsCore.mjs').buildHoard> } | null }} view
 */
export function renderMarketGuideHtml({ league = '', young = false, children = 0, classCount = 0, copies = {}, shopper = null } = {}) {
    const first = shopper ? escapeShopHtml(String(shopper.name || '').trim().split(/\s+/)[0] || 'This hero') : '';
    const hoard = shopper?.hoard || null;
    const limits = CHILD_TIER_LIMITS.seasonal;
    const fairLeague = children > 0
        ? `${escapeShopHtml(league || 'This league')} has <b>${children} heroes</b> in <b>${classCount} class${classCount === 1 ? '' : 'es'}</b>, so each treasure comes in`
        : 'Each treasure comes in';
    const copyLine = (tier) => {
        const n = copies[tier];
        return n ? `<b>${n}</b> ${n === 1 ? 'copy' : 'copies'}` : 'a few copies';
    };

    return `
        <div class="mg-sheet" role="dialog" aria-modal="true" aria-labelledby="mg-title">
            <button type="button" class="mg-close" data-mg-close aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>
            <header class="mg-head">
                <span class="mg-head__kicker">The Market Keeper explains</span>
                <h2 id="mg-title" class="font-title">How treasures work</h2>
                <p>Every treasure is a keepsake, a small privilege and a step up the Collector's Hoard.</p>
            </header>

            <ol class="mg-steps">
                <li class="mg-step">
                    <span class="mg-step__num">1</span>
                    <span class="mg-step__art" aria-hidden="true">🛍️</span>
                    <h3>Choose a treasure</h3>
                    <p>Each one carries a <b>Charm</b>. The gems show how rare it is.</p>
                </li>
                <li class="mg-step">
                    <span class="mg-step__num">2</span>
                    <span class="mg-step__art" aria-hidden="true">✨</span>
                    <h3>Use its Charm once</h3>
                    <p>From the <b>Trophy Room</b>, in a lesson. The treasure stays yours for good.</p>
                </li>
                <li class="mg-step">
                    <span class="mg-step__num">3</span>
                    <span class="mg-step__art" aria-hidden="true">🏺</span>
                    <h3>Grow your Hoard</h3>
                    <p>Every treasure adds points. New ranks pay a little Gold.</p>
                </li>
            </ol>

            <section class="mg-block">
                <h3 class="mg-block__title"><i class="fas fa-hand-sparkles" aria-hidden="true"></i>The Charms</h3>
                <p class="mg-block__lead">Small moments in the lesson. They never change stars, Glory, Gold, marks or homework. One charm a day for each hero, and up to three a day for the class.</p>
                <div class="mg-tiers">
                    ${TIERS.map((tier) => `
                        <div class="mg-tier mg-tier--${tier.id}">
                            <div class="mg-tier__head">
                                <span class="mm-charm__gems mg-gems" aria-hidden="true">${charmGemsMarkup(tier.id)}</span>
                                <b>${tier.label}</b>
                                <span class="mg-tier__price">${tier.price} Gold</span>
                            </div>
                            <ul class="mg-charms">${charmChips(tier.id, young)}</ul>
                        </div>`).join('')}
                </div>
            </section>

            <section class="mg-block mg-block--hoard">
                <h3 class="mg-block__title"><i class="fas fa-gem" aria-hidden="true"></i>The Collector's Hoard</h3>
                <p class="mg-block__lead">Common ${HOARD_POINTS.common} point, rare ${HOARD_POINTS.rare}, legendary ${HOARD_POINTS.legendary}, and +${HOARD_FESTIVAL_BONUS} for a festival treasure. Quiz and raid prizes count too. Each rank pays its Gold once.</p>
                ${hoard ? `<p class="mg-you">${first}: <b>${hoard.points} pts</b>${hoard.rank ? `, ${escapeShopHtml(hoard.icon)} ${escapeShopHtml(hoard.title)}` : ''}${hoard.next ? ` · ${hoard.toNext} to ${escapeShopHtml(hoard.next.title)}` : ' · top of the Hoard!'}</p>` : ''}
                <ol class="mg-ranks">${hoardLadder(hoard)}</ol>
            </section>

            <section class="mg-block mg-block--fair">
                <h3 class="mg-block__title"><i class="fas fa-scale-balanced" aria-hidden="true"></i>A fair stall</h3>
                <ul class="mg-fair">
                    <li><span aria-hidden="true">📦</span><span>${fairLeague} ${copyLine('common')} if common, ${copyLine('rare')} if rare and ${copyLine('legendary')} if legendary.</span></li>
                    <li><span aria-hidden="true">🎒</span><span>One of each treasure per hero, and at most ${limits.rare} rare and ${limits.legendary} legendary from each month's stall.</span></li>
                    <li><span aria-hidden="true">🤝</span><span>Every class gets its share of each rarity, by size. In the month's last week, whatever is left is open to all.</span></li>
                    <li><span aria-hidden="true">🕯️</span><span>When the last copy goes, it is sold out until next month. The merchant does not refill it.</span></li>
                </ul>
            </section>

            <footer class="mg-foot">
                <button type="button" class="mg-done" data-mg-close>Back to the stall</button>
            </footer>
        </div>`;
}
