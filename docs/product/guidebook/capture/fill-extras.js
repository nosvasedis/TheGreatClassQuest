/** Live Market, Fortune's Wheel, Skill Tree, and related chrome for guidebook capture. */

import { shopTabHTML } from '../../../../templates/app/tabs/shop.js';
import { logTabHTML } from '../../../../templates/app/tabs/log.js';
import { skillTreeModalHTML } from '../../../../templates/modals/skillTree.js';
import { fortunesWheelModalHTML } from '../../../../templates/modals/fortunesWheel.js';
import { PATHFINDER_CLASS_QUEST_BONUS_STARS } from '../../../../features/awardLogReasonMeta.js';
import { FAMILIAR_LEVEL_THRESHOLDS } from '../../../../features/familiarProgression.mjs';
import { HERO_SKILL_TREE, getReasonDisplayName } from '../../../../features/heroSkillTree.js';
import { buildSkillTreeModel } from '../../../../features/skillTreeCore.mjs';
import { renderSkillTreeStage, skillTreeThemeStyle } from '../../../../ui/modals/skillTreeView.mjs';
import { HERO_CLASSES } from '../../../../features/heroClasses.js';
import { GUILD_IDS, getGuildById, getGuildEmblemUrl } from '../../../../features/guilds.js';
import { getHeroLegendTierInfo } from '../../../../utils.js';
import { classModalsHTML } from '../../../../templates/modals/class.js';
import { buildHallOfHeroesHtml } from '../../../../ui/modals/rankings.js';
import { campfireChipMarkup, oathsButtonMarkup } from '../../../../features/campfireEntry.js';
import {
  renderShopItemCard,
  renderFamiliarEggCard,
  renderShelf,
  renderMarketAisle,
  shopBuyBtnClass,
  shopBuyBtnInner
} from '../../../../ui/core/marketView.mjs';

/** Same catalog as features/powerUps.js LEGENDARY_ARTIFACTS (emoji icons — not PNG files). */
const LEGENDARY_ARTIFACTS = [
  { id: 'leg_clarity', name: 'Crystal of Clarity', price: 15, description: 'Pulsing gem for a hint pass. Used on your card.', icon: '💎' },
  { id: 'leg_gilded', name: 'Scroll of the Gilded Star', price: 20, description: '3x Gold for the next star you earn.', icon: '✨' },
  { id: 'leg_hourglass', name: 'Time Warp Hourglass', price: 25, description: 'Adds +5m to any active class Bounty Timers.', icon: '⏳' },
  { id: 'leg_luck', name: 'Elixir of Luck', price: 30, description: '50% chance for +1 star during your NEXT lesson.', icon: '🍀' },
  { id: 'leg_glory_banner', name: 'Banner of Glory', price: 35, description: 'Your next 3 stars each write +1 bonus Guild Glory into the ledger.', icon: '⚜️' },
  { id: 'leg_banner', name: "The Herald's Banner", price: 40, description: 'Broadcasts a school-wide victory celebration!', icon: '📢' },
  { id: 'leg_catalyst', name: 'The Starfall Catalyst', price: 50, description: 'Double the stars for your next high test score.', icon: '📜' },
  { id: 'leg_glory_chalice', name: 'Chalice of Radiance', price: 55, description: "Guildmates' qualifying stars write +1 bonus Glory while the Chalice is active.", icon: '🏆' },
  { id: 'leg_pathfinder', name: 'The Pathfinder’s Map', price: 60, description: `Instant +${PATHFINDER_CLASS_QUEST_BONUS_STARS} Stars for the Team Quest. (Class Limit: 1/month)`, icon: '🗺️' },
  { id: 'leg_protagonist', name: 'The Mask of the Protagonist', price: 75, description: 'Guarantees you are the Hero in the next Story Log. (Limit: 1/month)', icon: '🎭' },
  { id: 'leg_glory_crown', name: 'Crown of the Eternal', price: 90, description: "Your guild's star-earned Glory ledger events are DOUBLED for the rest of the day!", icon: '👑' },
  { id: 'leg_aurum', name: 'Aurum Satchel', price: 32, description: 'Grants 50% off your next Mystic Market purchase this month.', icon: '💰' },
  { id: 'leg_bulwark', name: 'Bulwark Crest', price: 48, description: 'Your guild gains a Glory Shield for 7 days (blocks negative wheel effects).', icon: '🛡️' },
  { id: 'leg_quill', name: "Archivist's Quill", price: 62, description: 'Your next Story Weaver class bonus awards you 1 star instead of 0.5.', icon: '✒️' },
  { id: 'leg_compassion', name: 'Compassion Token', price: 55, description: "Hero's Boon costs 0 Gold for the rest of this month.", icon: '💝' }
];

/** Display fields from features/familiars.js FAMILIAR_TYPES (no Firebase import). */
const FAMILIAR_EGGS = [
  { id: 'thornback', name: 'Thornback', price: 30, eggColor: '#16a34a', eggAccent: '#86efac', desc: 'A mossy forest toad that evolves into a legendary ancient treant.', flavorHint: 'Strong • Loyal • Grounded', levelNames: ['Moss Toad', 'Bark Bear', 'Ancient Treant'] },
  { id: 'frostpaw', name: 'Frostpaw', price: 35, eggColor: '#3b82f6', eggAccent: '#bfdbfe', desc: 'An arctic fox spirit that grows into a mystical frost guardian.', flavorHint: 'Serene • Wise • Graceful', levelNames: ['Ice Cub', 'Snow Fox', 'Frost Guardian'] },
  { id: 'emberfang', name: 'Emberfang', price: 40, eggColor: '#ef4444', eggAccent: '#fca5a5', desc: 'A fire-breathing dragon hatchling that grows into a mighty flame drake.', flavorHint: 'Daring • Fierce • Unstoppable', levelNames: ['Hatchling', 'Flame Drake', 'Inferno Dragon'] },
  { id: 'veilshade', name: 'Veilshade', price: 45, eggColor: '#7c3aed', eggAccent: '#c4b5fd', desc: 'A shadow sprite that grows into the legendary Void Stalker.', flavorHint: 'Mysterious • Swift • Ethereal', levelNames: ['Shadow Wisp', 'Phantom Cat', 'Void Stalker'] },
  { id: 'sparkling', name: 'Sparkling', price: 50, eggColor: '#f59e0b', eggAccent: '#fde68a', desc: 'A radiant fairy-phoenix that blossoms into a legendary sun guardian.', flavorHint: 'Radiant • Joyful • Inspiring', levelNames: ['Sun Sprite', 'Dawn Fairy', 'Solar Phoenix'] }
];

function seasonalArt(emoji, from, to) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="256" height="256" rx="36" fill="url(#g)"/>
    <circle cx="196" cy="52" r="28" fill="rgba(255,255,255,0.22)"/>
    <text x="128" y="158" font-size="108" text-anchor="middle">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Sample seasonal stall layout. Live Elite Restock writes 15 new titles and AI pictures
 * each month — these SVG plates only show how pictured cards sit on the shelf.
 */
const SAMPLE_SEASONAL = [
  { id: 'cap_harvest_lantern', name: 'Harvest Lantern', price: 14, icon: '🎃', image: seasonalArt('🎃', '#9a3412', '#f59e0b'), description: 'A carved autumn light for the classroom stall.' },
  { id: 'cap_frost_bell', name: 'Frost Bell', price: 16, icon: '🔔', image: seasonalArt('🔔', '#0e7490', '#e0f2fe'), description: 'A silver bell that chimes like first snow.' },
  { id: 'cap_maple_charm', name: 'Maple Charm', price: 12, icon: '🍁', image: seasonalArt('🍁', '#c2410c', '#fdba74'), description: 'A common autumn token — unique; buying it leaves the stall.' },
  { id: 'cap_olive_wreath', name: 'Olive Wreath', price: 42, icon: '🌿', image: seasonalArt('🌿', '#166534', '#86efac'), description: 'A rare spring wreath for the honour shelf.' },
  { id: 'cap_starlit_globe', name: 'Starlit Snow Globe', price: 48, icon: '❄️', image: seasonalArt('❄️', '#1e3a8a', '#93c5fd'), description: 'Winter ice trapped in glass — a rare seasonal trophy.' },
  { id: 'cap_harbor_compass', name: 'Harbor Compass', price: 38, icon: '🧭', image: seasonalArt('🧭', '#0f766e', '#99f6e4'), description: 'A rare summer navigator’s charm.' },
  { id: 'cap_midsummer_crown', name: 'Midsummer Crown', price: 88, icon: '🌻', image: seasonalArt('🌻', '#a16207', '#fde68a'), description: 'A legendary summer trophy for the season’s bravest saver.' },
  { id: 'cap_hearth_relic', name: 'Hearth Relic', price: 96, icon: '🔥', image: seasonalArt('🔥', '#7f1d1d', '#fb923c'), description: 'A legendary autumn relic — unique; buying it leaves the stall.' },
  { id: 'cap_aurora_lantern', name: 'Aurora Lantern', price: 112, icon: '🌌', image: seasonalArt('🌌', '#312e81', '#c4b5fd'), description: 'A legendary winter light that only this Restock can sell.' }
];

function assetUrl(url) {
  return String(url || '').replace(/^\.\//, '/');
}

/** Shelves built with the app's own markup (ui/core/marketView.mjs), priced for a 64-gold shopper. */
const CAPTURE_SHOPPER_GOLD = 64;

function catalogHtml(kind) {
  if (kind === 'legendaries') {
    return renderMarketAisle({
      id: 'legendary', label: 'Artifacts', icon: 'fa-scroll', tone: 'indigo',
      title: 'Legendary Artifacts',
      desc: 'Evergreen relics with battle-shaping perks. Stock is precious: two legendary buys per student each month.',
      badge: 'Limit 2 / month',
      body: renderShelf([...LEGENDARY_ARTIFACTS].sort((x, y) => x.price - y.price).map((item) => renderShopItemCard(item, 'legendary')).join(''))
    });
  }
  if (kind === 'seasonal') {
    return renderMarketAisle({
      id: 'seasonal', label: 'Seasonal', icon: 'fa-leaf', tone: 'amber',
      title: 'Seasonal Treasures',
      month: 'October',
      desc: "This month's classroom treasures. Heroes of the Day earn discounts, and Aurum Satchels stack on the price.",
      body: renderShelf(SAMPLE_SEASONAL.map((item) => renderShopItemCard(item, 'seasonal')).join(''))
    });
  }
  return renderMarketAisle({
    id: 'eggs', label: 'Familiar Eggs', icon: 'fa-egg', tone: 'violet',
    title: 'Familiar Eggs',
    desc: 'One mystical companion per hero — buy an egg with coins, hatch it with stars, then evolve through tiers as they shine.',
    badge: `Hatch ${FAMILIAR_LEVEL_THRESHOLDS.hatch}★`,
    body: renderShelf(FAMILIAR_EGGS.map((fType) => renderFamiliarEggCard(fType)).join(''))
  });
}

/** Mirror updateShopStudentDisplay's till states for the capture shopper (no Firestore). */
function priceShelvesForCapture(container) {
  container.dataset.shopperGold = String(CAPTURE_SHOPPER_GOLD);
  container.querySelectorAll('.mm-ware').forEach((card) => {
    const price = Number(card.dataset.price) || 0;
    const btn = card.querySelector('.shop-buy-btn');
    if (!btn) return;
    const affordable = CAPTURE_SHOPPER_GOLD >= price;
    card.dataset.state = affordable ? 'affordable' : 'short';
    card.dataset.finalPrice = String(price);
    btn.disabled = !affordable;
    btn.className = shopBuyBtnClass(btn.dataset.type === 'familiar', affordable ? 'cta' : 'muted');
    btn.innerHTML = shopBuyBtnInner(affordable ? 'cta' : 'muted', affordable ? `Buy for ${price}` : `Need ${price - CAPTURE_SHOPPER_GOLD} more`);
  });
  const chips = document.getElementById('shop-aisle-chips');
  const aisle = container.querySelector('.mm-aisle');
  if (chips && aisle) {
    const count = container.querySelectorAll('.mm-ware').length;
    chips.innerHTML = `
      <button type="button" class="mm-aisle-chip is-active" aria-pressed="true"><i class="fas fa-store" aria-hidden="true"></i><span>All wares</span><span class="mm-aisle-chip__count">${count}</span></button>
      <button type="button" class="mm-aisle-chip" aria-pressed="false"><i class="fas ${aisle.dataset.icon}" aria-hidden="true"></i><span>${aisle.dataset.label}</span><span class="mm-aisle-chip__count">${count}</span></button>`;
  }
  const afford = document.getElementById('shop-afford-toggle');
  if (afford) afford.disabled = false;
  const affordCount = document.getElementById('shop-afford-count');
  if (affordCount) affordCount.textContent = String(container.querySelectorAll('.mm-ware[data-state="affordable"]').length);
  document.getElementById('shop-aisles')?.classList.remove('hidden');
  const line = document.getElementById('shop-keeper-line');
  if (line) line.textContent = `Welcome back, Alex! With ${CAPTURE_SHOPPER_GOLD} gold, ${affordCount?.textContent || 'several'} wares are within your reach.`;
}

export function extrasShellHtml() {
  return `${shopTabHTML}${logTabHTML}${skillTreeModalHTML}${fortunesWheelModalHTML}${hallModalHtml()}${quizHostHtml()}`;
}

// The real Hall of Heroes shell, lifted from the app's class modals so the capture never drifts.
function hallModalHtml() {
  const doc = new DOMParser().parseFromString(`<div>${classModalsHTML}</div>`, 'text/html');
  const modal = doc.getElementById('history-modal');
  modal?.querySelector('.history-archive-shell')?.setAttribute('id', 'history-modal-panel');
  return modal ? modal.outerHTML : '';
}

function quizHostHtml() {
  return `
    <div id="capture-quiz-host" class="hidden capture-quiz-host">
      <div class="vibrant-card weather-card w-day weather-card--capture">
        <i class="fas fa-sun weather-sun"></i>
        <i class="fas fa-cloud weather-cloud"></i>
        <div class="weather-info">
          <div class="text-7xl font-title">18°</div>
          <div class="text-2xl font-bold uppercase tracking-widest opacity-95">Sunny</div>
        </div>
        <div id="weather-card-footer" class="absolute bottom-4 right-4 z-10">
          <div class="quiz-week-btn-wrap">
            <button type="button" class="quiz-week-btn" title="Quiz of the Week"><i class="fas fa-question"></i></button>
          </div>
        </div>
      </div>
    </div>`;
}

export function hideAppScreen() {
  document.getElementById('app-screen')?.classList.add('hidden');
  document.getElementById('hero-celebration-modal')?.classList.add('hidden');
}

let hideExtrasHook = null;

export function onHideExtras(fn) {
  hideExtrasHook = fn;
}

export function hideExtras() {
  hideShop();
  hideFortuneWheel();
  hideSkillTree();
  hideAdventureLog();
  hideHallOfHeroes();
  hideQuiz();
  window.dispatchEvent(new CustomEvent('gcq:campfire-close'));
  document.getElementById('hero-campfire-scene')?.remove();
  const oaths = document.getElementById('ember-oaths-modal');
  oaths?.classList.add('hidden');
  oaths?.classList.remove('capture-eo');
  hideExtrasHook?.();
}

function fillShopper() {
  const display = document.getElementById('shop-shopper-display');
  if (display) display.textContent = 'Alex';
  const gold = document.getElementById('shop-student-gold');
  if (gold) gold.textContent = '64 🪙';
  const restock = document.getElementById('generate-shop-btn');
  restock?.classList.remove('hidden');
  document.getElementById('shop-curtain')?.classList.add('hidden');
  document.getElementById('shop-loader')?.classList.add('hidden');
  document.getElementById('shop-empty-state')?.classList.add('hidden');
}

export function showShop(kind) {
  hideExtras();
  hideAppScreen();
  const tab = document.getElementById('shop-tab');
  const container = document.getElementById('shop-items-container');
  if (!tab || !container) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-shop');
  fillShopper();
  container.classList.remove('hidden');
  container.innerHTML = catalogHtml(kind);
  priceShelvesForCapture(container);
}

export function hideShop() {
  const tab = document.getElementById('shop-tab');
  tab?.classList.add('hidden');
  tab?.classList.remove('capture-shop');
}

export function showSkillTree() {
  hideExtras();
  hideAppScreen();
  const modal = document.getElementById('skill-tree-modal');
  const panel = document.getElementById('skill-tree-modal-panel');
  const stage = document.getElementById('skill-tree-stage');
  const heroClass = 'Guardian';
  const tree = HERO_SKILL_TREE[heroClass];
  if (!modal || !panel || !stage || !tree) return;
  // Level 2 unlocked with a choice pending, level 1 awakened.
  const model = buildSkillTreeModel({
    heroClass,
    tree,
    classIcon: HERO_CLASSES[heroClass].icon,
    studentName: 'Alex',
    heroSkills: ['guardian_1a'],
    starsInReason: 52,
    reasonLabel: getReasonDisplayName(tree.reason),
    titles: tree.titles
  });
  modal.classList.remove('hidden');
  modal.classList.add('capture-skill');
  panel.setAttribute('style', skillTreeThemeStyle(model));
  const sigil = document.getElementById('skill-tree-class-bg-icon');
  if (sigil) sigil.textContent = model.icon;
  stage.innerHTML = renderSkillTreeStage(model);
  const scroller = document.getElementById('skill-tree-content');
  const focus = scroller?.querySelector('.st-tier.is-focus');
  if (scroller && focus) scroller.scrollTop = Math.max(0, focus.offsetTop - (scroller.clientHeight - focus.offsetHeight) / 2);
}

export function hideSkillTree() {
  const modal = document.getElementById('skill-tree-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-skill');
}

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export async function showFortuneWheel() {
  hideExtras();
  hideAppScreen();
  const modal = document.getElementById('fortunes-wheel-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-fw');

  const guild = getGuildById('dragon_flame');
  const header = document.getElementById('fw-guild-header');
  if (header) {
    header.innerHTML = `
            <div class="fw-guild-banner" style="--guild-primary:${guild.primary};--guild-secondary:${guild.secondary};">
                <div class="fw-guild-banner__crest">
                    <img src="${assetUrl(getGuildEmblemUrl('dragon_flame'))}" alt="Dragon Flame" class="fw-guild-banner__crest-image">
                </div>
                <div class="fw-guild-banner__copy">
                    <div class="fw-guild-banner__eyebrow">Guild 1 of 4</div>
                    <div class="fw-guild-banner__name">Dragon Flame</div>
                </div>
            </div>`;
  }
  const progress = document.getElementById('fw-progress');
  if (progress) {
    progress.innerHTML = GUILD_IDS.map((guildId, index) => {
      const def = getGuildById(guildId);
      const stateName = index === 0 ? 'current' : 'upcoming';
      return `
            <div class="fw-progress-pill" data-state="${stateName}" style="--guild-primary:${def.primary};">
                <div class="fw-progress-pill__crest">
                    <img src="${assetUrl(getGuildEmblemUrl(guildId))}" alt="${def.name}" class="fw-progress-pill__image">
                </div>
                <div class="fw-progress-pill__copy">
                    <div class="fw-progress-pill__step">Guild ${index + 1}</div>
                    <div class="fw-progress-pill__name">${def.name}</div>
                </div>
            </div>`;
    }).join('');
  }
  const title = document.getElementById('fw-availability-title');
  if (title) title.textContent = 'The wheel is awake';
  const message = document.getElementById('fw-availability-message');
  if (message) message.textContent = "This is the class's final lesson before the weekend. The ceremonial spin may begin now.";
  const meta = document.getElementById('fw-availability-meta');
  if (meta) {
    meta.textContent = 'Active lesson window: 09:00-09:45.';
    meta.classList.remove('hidden');
  }
  const caption = document.getElementById('fw-stage-caption');
  if (caption) {
    caption.textContent = 'Dragon Flame steps onto the relic stage. Spin to reveal its weekly omen.';
    caption.classList.remove('hidden');
  }
  const members = document.getElementById('fw-guild-members');
  if (members) {
    members.innerHTML = `
      <div class="fw-guild-members__header">Dragon Flame Members</div>
      <div class="fw-guild-members__list">
        <div class="fw-guild-members__item"><div class="fw-guild-members__visual"><span class="fw-guild-members__initial">A</span></div><div class="fw-guild-members__name">Alex</div></div>
        <div class="fw-guild-members__item"><div class="fw-guild-members__visual"><span class="fw-guild-members__initial">M</span></div><div class="fw-guild-members__name">Maria</div></div>
        <div class="fw-guild-members__item"><div class="fw-guild-members__visual"><span class="fw-guild-members__initial">N</span></div><div class="fw-guild-members__name">Nikos</div></div>
      </div>`;
  }
  const emblem = document.getElementById('fw-guild-emblem-image');
  if (emblem) {
    emblem.src = assetUrl(getGuildEmblemUrl('dragon_flame'));
    emblem.alt = 'Dragon Flame';
  }
  document.querySelector('.fw-guild-emblem-orb')?.classList.remove('is-empty');
  document.getElementById('fw-canvas-wrap')?.classList.remove('hidden');
  document.getElementById('fw-canvas-wrap')?.classList.add('is-idle');
  document.getElementById('fw-stage-frame')?.classList.remove('is-locked', 'is-spinning');
  const spin = document.getElementById('fw-spin-btn');
  if (spin) {
    spin.disabled = false;
    const label = spin.querySelector('.fw-btn-primary__label');
    const sub = spin.querySelector('.fw-btn-primary__sub');
    if (label) label.textContent = 'Spin This Guild';
    if (sub) sub.textContent = 'The relic chooses a fate';
  }

  try {
    const wheelMod = await Promise.race([
      import('../../../../features/fortunesWheel.js'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('wheel import timeout')), 8000))
    ]);
    const { drawWheel, generateWheelSegments } = wheelMod;
    const orig = Math.random;
    Math.random = seededRandom(42);
    let segments;
    try {
      segments = generateWheelSegments('Junior B');
    } finally {
      Math.random = orig;
    }
    const canvas = document.getElementById('fortunes-wheel-canvas');
    if (canvas && segments?.length) {
      canvas.width = 560;
      canvas.height = 560;
      drawWheel(canvas, segments, -Math.PI / 2, guild, null);
    }
  } catch (err) {
    console.warn('Fortune wheel canvas skipped:', err);
  }
}

export function hideFortuneWheel() {
  const modal = document.getElementById('fortunes-wheel-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-fw');
}

export function showAdventureLog(entry = 'oaths') {
  hideExtras();
  hideAppScreen();
  const tab = document.getElementById('adventure-log-tab');
  if (!tab) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-log');
  const month = document.getElementById('adventure-log-month-filter');
  if (month) {
    month.innerHTML = '<option value="2026-08" selected>August 2026</option>';
  }
  ['log-adventure-btn', 'hall-of-heroes-btn'].forEach((id) => {
    document.getElementById(id)?.removeAttribute('disabled');
  });
  tab.querySelectorAll('.al-fab-cluster, .tab-fab-cluster').forEach((el) => {
    el.classList.add('revealed');
  });
  const actions = tab.querySelector('.al-primary-actions');
  actions?.querySelector(':scope > .campfire-entry')?.remove();
  if (actions) {
    const wrap = document.createElement('div');
    wrap.className = 'campfire-entry';
    wrap.innerHTML = entry === 'gather'
      ? campfireChipMarkup({ igniting: true })
      : oathsButtonMarkup({ ready: 2 });
    actions.append(wrap);
  }
  const feed = document.getElementById('adventure-log-feed');
  if (feed) {
    feed.innerHTML = `
            <div class="diary-page">
                <div class="diary-header">
                    <div>
                        <h3 class="diary-date">Sunday, 30 August 2026</h3>
                        <p class="diary-title">The Meadows Remember</p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold uppercase tracking-wider">Manual Chronicle</span>
                        <div class="diary-hero bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md">
                            <i class="fas fa-crown mr-1"></i>
                            <span class="uppercase tracking-tighter text-[10px] opacity-90 mr-1">Hero:</span>
                            Alex
                        </div>
                    </div>
                </div>
                <div class="diary-body">
                    <div class="diary-text-content">
                        <p class="diary-text">Junior B practised Teamwork in pairs, then Alex led a calm recap. Tomorrow we return to the Golden Citadel trail.</p>
                        <div class="diary-highlights">
                            <span class="diary-highlight-chip">Teamwork</span>
                            <span class="diary-highlight-chip">Hero of the Day</span>
                        </div>
                    </div>
                </div>
                <div class="diary-footer">
                    <div class="diary-keywords">
                        <span class="diary-keyword">#teamwork</span>
                        <span class="diary-keyword">#hero</span>
                    </div>
                </div>
            </div>`;
  }
}

export function hideAdventureLog() {
  const tab = document.getElementById('adventure-log-tab');
  tab?.querySelector(':scope .campfire-entry')?.remove();
  tab?.classList.add('hidden');
  tab?.classList.remove('capture-log');
}

export function showHallOfHeroes() {
  hideExtras();
  hideAppScreen();
  const modal = document.getElementById('history-modal');
  const content = document.getElementById('history-modal-content');
  if (!modal || !content) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-hoh', 'is-hoh');
  document.getElementById('history-month-select-wrapper')?.classList.add('hidden');
  const title = document.getElementById('history-modal-title');
  const subtitle = document.getElementById('history-modal-subtitle');
  if (title) title.textContent = 'Hall of Heroes';
  if (subtitle) subtitle.textContent = 'Junior B · Heroes of the Day';
  const row = (name, heroClass, wins, day) => {
    const tier = getHeroLegendTierInfo(wins);
    const nextThreshold = tier.nextThreshold ?? (wins < 3 ? 3 : null);
    const floor = tier.minWins || 0;
    const progressPercent = nextThreshold ? Math.round(((wins - floor) / (nextThreshold - floor)) * 100) : 100;
    return {
      student: { name, heroClass },
      wins,
      tier,
      nextThreshold,
      progressPercent,
      latestDate: day ? new Date(2026, 7, day) : null
    };
  };
  content.innerHTML = buildHallOfHeroesHtml([
    row('Maria', 'Guardian', 5, 27),
    row('Alex', 'Sage', 3, 21),
    row('Nikos', 'Artificer', 2, 17),
    row('Eleni', 'Weaver', 1, 12),
    row('Sofia', 'Nomad', 1, 6),
    row('Yannis', null, 0),
    row('Sam', null, 0)
  ], 12);
}

export function hideHallOfHeroes() {
  const modal = document.getElementById('history-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-hoh', 'is-hoh');
}

export function showQuiz() {
  hideExtras();
  hideAppScreen();
  const host = document.getElementById('capture-quiz-host');
  host?.classList.remove('hidden');
  host?.classList.add('capture-quiz');
}

export function hideQuiz() {
  const host = document.getElementById('capture-quiz-host');
  host?.classList.add('hidden');
  host?.classList.remove('capture-quiz');
}
