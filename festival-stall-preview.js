// Festival Stall preview: every celebration's stall with sample wares, no Firebase.
// /festival-stall-preview.html?fest=halloween[&preparing=1][&lite=1][&last=1][&feast=1][&shot=1]
import './styles/festival_stall.css';
import { shopTabHTML } from './templates/app/tabs/shop.js';
import { getFestivalWindow, SHOP_FESTIVAL_IDS } from './utils/shopCalendar.js';
import { renderFestivalStall, festivalStallLook } from './ui/core/festivalStall.mjs';
import { renderMarketAisle, renderShelf, renderShopItemCard } from './ui/core/marketView.mjs';

const SAMPLES = {
    halloween: [['Smiling Pumpkin Lamp', '🎃', 12, 'A happy glow for dark evenings.', 5], ['Friendly Ghost Plush', '👻', 15, 'It giggles when you hug it.', 5], ['Moonlight Potion', '🧪', 42, 'Bubbles purple under the moon.', 2], ['Black Cat Lantern', '🐈‍⬛', 46, 'Its eyes glow a kind green.', 2], ['Haunted House Music Box', '🏚️', 96, 'Plays a spooky-sweet tune.', 1]],
    christmas: [['Jingle Bell Charm', '🔔', 12, 'Rings for every kind word.', 5], ['Gingerbread Badge', '🍪', 14, 'Smells like Christmas morning.', 5], ['Karavaki Boat', '⛵', 44, 'A little ship of twinkling lights.', 2], ['Carol Triangle', '🎶', 38, 'Sing the kalanta door to door.', 2], ['Starlit Snow Globe', '🌟', 105, 'A whole winter village inside.', 1]],
    newyear: [['Lucky Flouri Coin', '🪙', 13, 'Found in the vasilopita!', 5], ['Pomegranate Charm', '🍎', 11, 'Smash it for good luck.', 5], ['Wishing Jar', '🫙', 40, 'Holds one wish for the year.', 2], ['Midnight Clock', '🕛', 45, 'Chimes twelve times with sparkles.', 2], ['Golden Gouri Medallion', '🍀', 98, 'The luckiest charm in the Realm.', 1]],
    carnival: [['Rainbow Confetti Popper', '🎉', 12, 'Pop! A rainbow shower.', 5], ['Jester Hat', '🤡', 16, 'Bells jingle with every step.', 5], ['Masquerade Mask', '🎭', 43, 'Feathers of every colour.', 2], ['Clean Monday Kite', '🪁', 39, 'Flies highest on Clean Monday.', 2], ['Parade Float Model', '🎠', 110, 'A tiny carnival that really spins.', 1]],
    easter: [['Red Egg Charm', '🥚', 12, 'Wins every egg-tapping game.', 5], ['Fluffy Lamb', '🐑', 15, 'Soft as a spring cloud.', 5], ['Ribboned Lambada', '🕯️', 41, 'A candle for the midnight light.', 2], ['Tsoureki Keepsake', '🥖', 37, 'Braided bread that never goes stale.', 2], ['Painted Egg Basket', '🧺', 92, 'Every egg tells a spring story.', 1]],
    mayday: [['Daisy Chain Bracelet', '🌼', 11, 'Made from the first daisies.', 5], ['Butterfly Pin', '🦋', 14, 'It flutters when you smile.', 5], ['Wildflower Basket', '🌷', 40, 'Picked from the May meadows.', 2], ['Poppy Field Book', '📕', 36, 'Pressed poppies on every page.', 2], ['May Day Door Wreath', '💐', 95, 'The brightest wreath on the street.', 1]],
    endofyear: [['Gold Star Rosette', '🎖️', 12, 'For a year of brave quests.', 5], ['Autograph Book', '📒', 15, 'Every friend signs a page.', 5], ['Memory Jar', '🏺', 44, 'Holds the best moments of the year.', 2], ['Summer Ticket', '🎟️', 38, 'One ride into the holidays.', 2], ['Champion Trophy', '🏆', 115, 'For the hero of the whole year.', 1]]
};

function plate(emoji, from, to) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><radialGradient id="g" cx="50%" cy="40%" r="65%"><stop offset="0%" stop-color="${to}"/><stop offset="100%" stop-color="${from}" stop-opacity="0"/></radialGradient></defs><circle cx="128" cy="140" r="104" fill="url(#g)"/><text x="128" y="172" font-size="128" text-anchor="middle">${emoji}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const params = new URLSearchParams(location.search);
const id = SHOP_FESTIVAL_IDS.includes(params.get('fest')) ? params.get('fest') : 'halloween';
const year = id === 'newyear' ? 2027 : 2026;
const festival = getFestivalWindow(id, year);
const look = festivalStallLook(id);
const day = params.has('feast') ? festival.feast
    : params.has('last') ? festival.end
        : { ...festival.start, day: festival.start.day + 3 };
const now = new Date(Date.UTC(day.year, day.month - 1, day.day, 10));

const items = params.has('preparing') ? [] : SAMPLES[id].map(([name, emoji, price, description, stock], index) => ({
    id: `${id}-${index}`, name, price, description, stock, image: plate(emoji, look.colors.deep, look.colors.accent)
}));

document.getElementById('pv-root').innerHTML = shopTabHTML;
const tab = document.getElementById('shop-tab');
tab.classList.remove('hidden');
tab.dataset.festival = id;
const container = document.getElementById('shop-items-container');
container.classList.remove('hidden');
container.innerHTML = renderFestivalStall(festival, items, { now, preparing: params.has('preparing') })
    + renderMarketAisle({
        id: 'seasonal', label: 'Seasonal', icon: 'fa-leaf', tone: 'amber', title: 'Seasonal Treasures', month: 'October · Chestnut Fire',
        desc: "This month's classroom treasures.",
        body: renderShelf([['Chestnut Lantern', '🌰', 14], ['Mossy Compass', '🧭', 42], ['Owl Reading Lamp', '🦉', 90]].map(([name, emoji, price], index) => renderShopItemCard({ id: `s${index}`, name, price, stock: 3, description: 'A cosy autumn treasure.', image: plate(emoji, '#1c1640', '#fbbf24') }, 'seasonal')).join(''))
    });
const stall = document.getElementById('shop-aisle-festival');
if (params.has('lite')) stall.classList.add('mm-fest--lite');
if (params.has('arrive')) stall.classList.add('is-arriving');
document.getElementById('shop-aisles')?.classList.add('hidden');
if (params.has('shot')) document.body.classList.add('pv-shot');

document.getElementById('pv-toolbar').innerHTML = SHOP_FESTIVAL_IDS
    .map((fest) => `<a href="?fest=${fest}">${festivalStallLook(fest).emblem} ${fest}</a>`).join('')
    + `<a href="?fest=${id}&preparing=1">preparing</a><a href="?fest=${id}&last=1">last day</a><a href="?fest=${id}&feast=1">feast</a><a href="?fest=${id}&lite=1">lite</a>`;
