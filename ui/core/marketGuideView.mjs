// ui/core/marketGuideView.mjs — "How treasures work" in the Mystic Market: pure markup.
// The controller (marketGuide.js) passes in the live numbers for this league and shopper.
// Looks like the Market itself: a wooden sign over a parchment ledger with three bookmarks.
import { escapeShopHtml, charmGemsMarkup } from './marketView.mjs';
import {
    TREASURE_CHARMS,
    HOARD_RANKS,
    HOARD_POINTS,
    HOARD_FESTIVAL_BONUS,
    CHILD_TIER_LIMITS,
    CHARM_SET_SIZE,
    charmText
} from '../../features/treasureCharmsCore.mjs';

const TIERS = [
    { id: 'common', label: 'Common', price: '10–18' },
    { id: 'rare', label: 'Rare', price: '35–50' },
    { id: 'legendary', label: 'Legendary', price: '80–120' }
];

export const MARKET_GUIDE_TABS = [
    { id: 'charms', label: 'Charms', icon: 'fa-hand-sparkles' },
    { id: 'hoard', label: 'Hoard', icon: 'fa-gem' },
    { id: 'fair', label: 'Fair stall', icon: 'fa-scale-balanced' }
];

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function journeyHtml() {
    const stops = [
        { art: '🛍️', title: 'Buy a treasure', text: 'Each one carries a Charm.' },
        { art: '🧩', title: 'Fill a set', text: 'Collect treasures of one rarity.' },
        { art: '✨', title: 'Wake a charm', text: 'A full set wakes one. Use it in a lesson.' },
        { art: '🏺', title: 'Grow the Hoard', text: 'Every treasure adds points.' }
    ];
    return `
        <ol class="mg-road" aria-label="How it works">
            ${stops.map((stop, i) => `
                <li class="mg-road__stop">
                    <span class="mg-road__coin" aria-hidden="true"><span>${stop.art}</span><i>${i + 1}</i></span>
                    <span class="mg-road__words"><b>${stop.title}</b><span>${stop.text}</span></span>
                </li>`).join('')}
        </ol>`;
}

/** One rarity's set: coin slots that fill as treasures are collected (the shopper's own when known). */
function setCardHtml(tier, set) {
    const need = CHARM_SET_SIZE[tier.id];
    const ready = set ? set.ready : 0;
    // A set that just filled shows full slots; after that, the slots count toward the next one.
    const filled = !set ? 0 : (ready > 0 && set.inSet === 0 ? need : set.inSet);
    const slots = Array.from({ length: need }, (_, i) => `<i class="mg-slot${i < filled ? ' is-filled' : ''}"></i>`).join('');
    const status = !set
        ? `${need} ${tier.label.toLowerCase()} treasures wake 1 ${tier.label.toLowerCase()} charm`
        : ready > 0
            ? `<b>${plural(ready, 'charm')} awake</b>${set.inSet > 0 ? ` · ${set.inSet} of ${need} toward the next` : ', ready to use'}`
            : `${filled} of ${need} · ${set.toNext} more to wake one`;
    return `
        <div class="mg-set mg-set--${tier.id}${ready > 0 ? ' is-ready' : ''}">
            <div class="mg-set__head">
                <span class="mm-charm__gems mg-gems" aria-hidden="true">${charmGemsMarkup(tier.id)}</span>
                <b>${tier.label}</b>
                <span class="mg-set__price">${tier.price} Gold</span>
            </div>
            <div class="mg-set__slots" aria-hidden="true">${slots}${ready > 0 ? '<span class="mg-set__spark">✨</span>' : ''}</div>
            <p class="mg-set__status">${status}</p>
        </div>`;
}

function charmListHtml(tier, young) {
    return `
        <div class="mg-charmcol mg-charmcol--${tier.id}">
            <h4 class="mg-charmcol__head"><span class="mm-charm__gems mg-gems" aria-hidden="true">${charmGemsMarkup(tier.id)}</span>${tier.label} charms</h4>
            <ul class="mg-charms">
                ${TREASURE_CHARMS[tier.id].map((charm) => `
                    <li class="mg-charm">
                        <span class="mg-charm__icon" aria-hidden="true">${escapeShopHtml(charm.icon)}</span>
                        <span class="mg-charm__text"><b>${escapeShopHtml(charm.title)}</b><span>${escapeShopHtml(charmText(charm, { young }))}</span></span>
                    </li>`).join('')}
            </ul>
        </div>`;
}

function hoardRoadHtml(hoard) {
    const points = hoard ? hoard.points : -1;
    return `
        <ol class="mg-ranks">
            ${HOARD_RANKS.map((rank) => {
                const reached = points >= rank.points;
                const next = Boolean(hoard?.next && hoard.next.rank === rank.rank);
                return `
                    <li class="mg-rank${reached ? ' is-reached' : ''}${next ? ' is-next' : ''}">
                        <span class="mg-rank__stone" aria-hidden="true">${escapeShopHtml(rank.icon)}</span>
                        <span class="mg-rank__name">${escapeShopHtml(rank.title)}</span>
                        <span class="mg-rank__pts">${rank.points} pts</span>
                        <span class="mg-rank__gold"><i class="fas fa-coins" aria-hidden="true"></i>+${rank.gold}</span>
                    </li>`;
            }).join('')}
        </ol>`;
}

/**
 * Who shares this stall. `children`/`classCount` are the heroes the stall is sized for;
 * `leagueChildren`/`leagueClassCount` are the whole league across the school (shown when
 * they differ, so a teacher with part of a league sees both numbers).
 */
function fairBoardHtml({ league, children, classCount, leagueChildren, leagueClassCount, copies }) {
    const name = escapeShopHtml(league || 'This league');
    const copyTile = (tier) => {
        const n = copies[tier.id];
        return `
            <div class="mg-copy mg-copy--${tier.id}">
                <span class="mm-charm__gems mg-gems" aria-hidden="true">${charmGemsMarkup(tier.id)}</span>
                <b>${n || '–'}</b>
                <span>${tier.label}<br>${n === 1 ? 'copy' : 'copies'} each</span>
            </div>`;
    };
    const wider = leagueClassCount > classCount;
    return `
        <div class="mg-board">
            <div class="mg-board__league">
                <span class="mg-board__kicker">${name} stall</span>
                <div class="mg-board__stats">
                    <div class="mg-stat"><b>${children || '–'}</b><span>heroes</span></div>
                    <div class="mg-stat"><b>${classCount || '–'}</b><span>${classCount === 1 ? 'class' : 'classes'}</span></div>
                </div>
                ${wider ? `<p class="mg-board__note">The whole league has ${plural(leagueChildren, 'hero', 'heroes')} in ${plural(leagueClassCount, 'class', 'classes')}.</p>` : ''}
            </div>
            <div class="mg-board__copies">${TIERS.map(copyTile).join('')}</div>
        </div>`;
}

/**
 * @param {{ league?: string, young?: boolean, children?: number, classCount?: number,
 *   leagueChildren?: number, leagueClassCount?: number,
 *   copies?: {common?: number|null, rare?: number|null, legendary?: number|null},
 *   shopper?: { name: string, hoard: object, sets: object } | null, tab?: string }} view
 */
export function renderMarketGuideHtml({
    league = '',
    young = false,
    children = 0,
    classCount = 0,
    leagueChildren = 0,
    leagueClassCount = 0,
    copies = {},
    shopper = null,
    tab = 'charms'
} = {}) {
    const first = shopper ? escapeShopHtml(String(shopper.name || '').trim().split(/\s+/)[0] || 'This hero') : '';
    const hoard = shopper?.hoard || null;
    const sets = shopper?.sets?.tiers || null;
    const limits = CHILD_TIER_LIMITS.seasonal;
    const active = MARKET_GUIDE_TABS.some((t) => t.id === tab) ? tab : 'charms';
    const awake = shopper?.sets?.ready || 0;

    const tabs = MARKET_GUIDE_TABS.map((t) => `
        <button type="button" role="tab" class="mg-tab" id="mg-tab-${t.id}" data-mg-tab="${t.id}"
            aria-controls="mg-panel-${t.id}" aria-selected="${t.id === active}" tabindex="${t.id === active ? 0 : -1}">
            <i class="fas ${t.icon}" aria-hidden="true"></i><span>${t.label}</span>
        </button>`).join('');
    const panel = (id, body) => `
        <section class="mg-panel" role="tabpanel" id="mg-panel-${id}" aria-labelledby="mg-tab-${id}"${id === active ? '' : ' hidden'}>${body}</section>`;

    const shopperLine = shopper
        ? `<p class="mg-you"><span class="mg-you__tag">${first}</span>${awake > 0
            ? `${plural(awake, 'charm')} awake now. Use ${awake === 1 ? 'it' : 'them'} from the Trophy Room.`
            : 'No charm awake yet. The slots below show the next set.'}</p>`
        : '';

    const charmsPanel = `
        <p class="mg-lead">Charms wake in <b>sets</b>. Collect treasures of one rarity until the set is full: that wakes one charm of that rarity. Pick which of those treasures' charms to use, in a lesson. The treasure stays yours.</p>
        ${shopperLine}
        <div class="mg-sets">${TIERS.map((tier) => setCardHtml(tier, sets ? sets[tier.id] : null)).join('')}</div>
        <div class="mg-charmcols">${TIERS.map((tier) => charmListHtml(tier, young)).join('')}</div>
        <p class="mg-small"><i class="fas fa-feather" aria-hidden="true"></i>Small lesson moments only: never stars, Glory, Gold, marks or homework. One charm a day for each hero, three a day for the class. Charms used before sets existed stay as they were.</p>`;

    const hoardPanel = `
        <p class="mg-lead">Every treasure adds points to the Collector's Hoard. Each new rank pays its Gold once.</p>
        <div class="mg-points">
            ${TIERS.map((tier) => `<span class="mg-point mg-point--${tier.id}"><span class="mm-charm__gems mg-gems" aria-hidden="true">${charmGemsMarkup(tier.id)}</span>${tier.label} <b>${HOARD_POINTS[tier.id]}</b></span>`).join('')}
            <span class="mg-point mg-point--festival">🎉 Festival <b>+${HOARD_FESTIVAL_BONUS}</b></span>
        </div>
        ${hoard ? `<p class="mg-you"><span class="mg-you__tag">${first}</span><b>${hoard.points} pts</b>${hoard.rank ? ` · ${escapeShopHtml(hoard.icon)} ${escapeShopHtml(hoard.title)}` : ''}${hoard.next ? ` · ${hoard.toNext} more to ${escapeShopHtml(hoard.next.title)}` : ' · top of the Hoard!'}</p>` : ''}
        ${hoardRoadHtml(hoard)}
        <p class="mg-small"><i class="fas fa-feather" aria-hidden="true"></i>Quiz and raid prizes count too. The Hoard never changes stars, Glory or rankings.</p>`;

    const fairPanel = `
        <p class="mg-lead">The stall is shared, so the keeper stocks it for the heroes who shop here.</p>
        ${fairBoardHtml({ league, children, classCount, leagueChildren, leagueClassCount, copies })}
        <ul class="mg-rules">
            <li><span aria-hidden="true">🎒</span><span><b>One of each treasure</b> per hero, and at most ${limits.rare} rare and ${limits.legendary} legendary from each month's stall.</span></li>
            <li><span aria-hidden="true">🤝</span><span><b>Every class gets its share</b> of each rarity, by size. In the month's last week, whatever is left is open to all.</span></li>
            <li><span aria-hidden="true">🕯️</span><span><b>Sold out means sold out.</b> When the last copy goes, the keeper does not refill it until next month.</span></li>
        </ul>`;

    return `
        <div class="mg-sheet" role="dialog" aria-modal="true" aria-labelledby="mg-title">
            <header class="mg-sign">
                <span class="mg-sign__chain mg-sign__chain--l" aria-hidden="true"></span>
                <span class="mg-sign__chain mg-sign__chain--r" aria-hidden="true"></span>
                <div class="mg-sign__plank">
                    <span class="mg-sign__kicker">The Keeper's ledger</span>
                    <h2 id="mg-title" class="mg-sign__title">How treasures work</h2>
                </div>
                <button type="button" class="mg-close" data-mg-close aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>
            </header>
            <div class="mg-page">
                ${journeyHtml()}
                <div class="mg-tabs" role="tablist" aria-label="Treasure guide">${tabs}</div>
                <div class="mg-panels">
                    ${panel('charms', charmsPanel)}
                    ${panel('hoard', hoardPanel)}
                    ${panel('fair', fairPanel)}
                </div>
                <footer class="mg-foot">
                    <button type="button" class="mg-done" data-mg-close><i class="fas fa-store" aria-hidden="true"></i>Back to the stall</button>
                </footer>
            </div>
        </div>`;
}
