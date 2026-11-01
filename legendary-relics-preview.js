// Legendary Artifacts preview: the relic shelf with sample shoppers, no Firebase.
// /legendary-relics-preview.html?[before=1][&state=affordable|short][&forms=1][&shot=1]
import './styles/legendary_relics.css';
import './styles/market_charms.css';
import { shopTabHTML } from './templates/app/tabs/shop.js';
import { renderMarketAisle, renderShelf, renderShopItemCard, renderLegendaryRelicCard, shopBuyBtnInner, shopBuyBtnClass } from './ui/core/marketView.mjs';
import { LEGENDARY_FAMILIES, legendaryFamilyVariants } from './features/legendaryCatalog.mjs';

// The catalog as it was before the November 2026 audit (for the before shot).
const BEFORE = [
    ['leg_clarity', 'Crystal of Clarity', 15, 'Pulsing gem for a hint pass. Used on your card.', '💎'],
    ['leg_gilded', 'Scroll of the Gilded Star', 20, '3x Gold for the next star you earn.', '✨'],
    ['leg_hourglass', 'Time Warp Hourglass', 25, 'Adds +5m to any active class Bounty Timers.', '⏳'],
    ['leg_luck', 'Elixir of Luck', 30, '50% chance for +1 star during your NEXT lesson.', '🍀'],
    ['leg_aurum', 'Aurum Satchel', 32, 'Grants 50% off your next Mystic Market purchase this month.', '💰'],
    ['leg_glory_banner', 'Banner of Glory', 35, 'Your next 3 stars each write +1 bonus Guild Glory into the ledger.', '⚜️'],
    ['leg_banner', "The Herald's Banner", 40, 'Broadcasts a school-wide victory celebration!', '📢'],
    ['leg_bulwark', "Fortune's Favor", 48, "Your guild's next Fortune's Wheel in your class is gilded: no storms, no Trickster and no common wedges.", '🍀'],
    ['leg_catalyst', 'The Starfall Catalyst', 50, 'Double the stars for your next high test score.', '📜'],
    ['leg_glory_chalice', 'Chalice of Unity', 55, '+1 Glory right now for you and every guildmate in your class.', '🏆'],
    ['leg_compassion', 'Compassion Token', 55, "Hero's Boon costs 0 Gold for the rest of this month.", '💝'],
    ['leg_pathfinder', 'The Pathfinder’s Map', 60, 'Instant +10 Stars for the Team Quest. (Class Limit: 1/month)', '🗺️'],
    ['leg_quill', "Archivist's Quill", 62, 'Your next Story Weaver class bonus awards you 1 star instead of 0.5.', '✒️'],
    ['leg_protagonist', 'The Mask of the Protagonist', 75, 'Guarantees you are the Hero in the next Story Log. (Limit: 1/month)', '🎭'],
    ['leg_glory_crown', 'Guild Standard', 75, "Your name flies on your guild's banner in the Guild Hall for the rest of this month's Chapter, plus +2 Glory.", '🚩'],
].map(([id, name, price, description, icon]) => ({ id, name, price, description, icon }));

const params = new URLSearchParams(location.search);
const gold = Number(params.get('gold') || 50);
const picks = { purse: 'leg_aurum', guild: 'leg_glory_chalice', story: 'leg_protagonist' };
const formsShot = params.has('forms');

document.getElementById('pv-root').innerHTML = shopTabHTML;
const tab = document.getElementById('shop-tab');
tab.classList.remove('hidden');
const container = document.getElementById('shop-items-container');
container.classList.remove('hidden');

function shelfHtml() {
    const body = params.has('before')
        ? BEFORE.map((item) => renderShopItemCard(item, 'legendary')).join('')
        : LEGENDARY_FAMILIES.map((f) => renderLegendaryRelicCard(f, legendaryFamilyVariants(f.id), formsShot ? picks[f.id] : '')).join('');
    return renderMarketAisle({
        id: 'legendary', label: 'Artifacts', icon: 'fa-scroll', tone: 'indigo', title: 'Legendary Artifacts',
        desc: params.has('before')
            ? 'Evergreen relics with battle-shaping perks. Stock is precious: two legendary buys per student each month.'
            : 'Five relics that change something real in class. Each comes in a few forms: tap a form under the name to choose. Two artifacts per hero each month.',
        badge: 'Limit 2 / month',
        body: renderShelf(body)
    });
}

function priceButtons() {
    container.querySelectorAll('.mm-ware').forEach((card) => {
        const price = Number(card.dataset.price) || 0;
        const btn = card.querySelector('.shop-buy-btn');
        const ok = gold >= price;
        card.dataset.state = ok ? 'affordable' : 'short';
        btn.className = shopBuyBtnClass(false, ok ? 'cta' : 'muted');
        btn.disabled = !ok;
        btn.innerHTML = shopBuyBtnInner(ok ? 'cta' : 'muted', ok ? `Buy for ${price}` : `Need ${price - gold} more`);
    });
}

container.innerHTML = shelfHtml();
priceButtons();
container.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-relic-form]');
    if (!chip) return;
    const card = chip.closest('.mm-relic');
    const family = LEGENDARY_FAMILIES.find((f) => f.id === card.dataset.family);
    const holder = document.createElement('div');
    holder.innerHTML = renderLegendaryRelicCard(family, legendaryFamilyVariants(family.id), chip.dataset.relicForm).trim();
    holder.firstElementChild.classList.add('is-form-swap');
    card.replaceWith(holder.firstElementChild);
    priceButtons();
});
document.getElementById('shop-aisles')?.classList.add('hidden');
if (params.has('shot')) document.body.classList.add('pv-shot');
document.getElementById('pv-toolbar').innerHTML = '<a href="?">after</a><a href="?before=1">before</a><a href="?forms=1">forms picked</a><a href="?gold=20">20 gold</a>';
