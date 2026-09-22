/** Live Market, Fortune's Wheel, Skill Tree, and related chrome for guidebook capture. */

import { shopTabHTML } from '../../../../templates/app/tabs/shop.js';
import { logTabHTML } from '../../../../templates/app/tabs/log.js';
import { skillTreeModalHTML } from '../../../../templates/modals/skillTree.js';
import { fortunesWheelModalHTML } from '../../../../templates/modals/fortunesWheel.js';
import { PATHFINDER_CLASS_QUEST_BONUS_STARS } from '../../../../features/awardLogReasonMeta.js';
import { FAMILIAR_LEVEL_THRESHOLDS } from '../../../../features/familiarProgression.mjs';
import {
  HERO_SKILL_TREE,
  getHeroTitle,
  getReasonDisplayName,
  starsToNextLevel
} from '../../../../features/heroSkillTree.js';
import { HERO_CLASSES } from '../../../../features/heroClasses.js';
import { GUILD_IDS, getGuildById, getGuildEmblemUrl } from '../../../../features/guilds.js';
import { getHeroLegendTierInfo } from '../../../../utils.js';

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

function shopPriceMarkupPlain(basePrice) {
  return `
        <span class="shop-price-label">Price</span>
        <div class="shop-price-pill">
            <span class="shop-price-value">${basePrice}</span>
            <span class="shop-price-coin" aria-hidden="true">🪙</span>
        </div>`;
}

function shopBuyBtnClass(isFamiliar, variant) {
  const fam = isFamiliar ? ' shop-buy-btn--familiar' : '';
  return `shop-buy-btn shop-buy-btn--premium${fam} shop-buy-btn--${variant}`;
}

function renderShopItemCard(item, isLegendary) {
  const badge = isLegendary
    ? `<div class="absolute top-2 right-2 z-10 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow transform -rotate-2 border border-indigo-400">ARTIFACT</div>`
    : '';
  const imageHtml = item.image
    ? `<img src="${item.image}" alt="" class="relative w-full h-full object-contain filter drop-shadow-md">`
    : `<div class="text-7xl">${item.icon || '📦'}</div>`;
  return `
        <div class="shop-item-card group flex flex-col relative overflow-hidden">
            ${badge}
            <div class="shop-item-stage relative flex items-center justify-center overflow-hidden">${imageHtml}</div>
            <div class="shop-item-body flex-grow flex flex-col">
                <h3 class="font-title text-xl text-amber-300 leading-tight mb-1">${item.name}</h3>
                <p class="text-indigo-300/95 text-xs mb-2 line-clamp-3 flex-grow">${item.description}</p>
                <div class="shop-item-footer">
                    <div class="shop-price-display" data-item-id="${item.id}" data-base-price="${item.price}">${shopPriceMarkupPlain(item.price)}</div>
                    <button type="button" class="${shopBuyBtnClass(false, 'waiting')}" disabled>Pick shopper</button>
                </div>
            </div>
        </div>`;
}

function renderFamiliarEggCard(fType) {
  return `
        <div class="shop-item-card shop-item-card--familiar group flex flex-col relative overflow-hidden">
            <div class="absolute top-2 right-2 z-10 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow transform -rotate-2 border border-purple-400">EGG</div>
            <div class="shop-item-stage relative overflow-hidden flex items-center justify-center" style="background:linear-gradient(135deg,${fType.eggColor}33,${fType.eggAccent}22);">
                <div class="text-7xl" style="filter:drop-shadow(0 0 12px ${fType.eggColor});">🥚</div>
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
                    <div>📛 Forms: ${fType.levelNames.map((n) => `<strong class="text-purple-300">${n}</strong>`).join(' → ')}</div>
                </div>
                <div class="shop-item-footer">
                    <div class="shop-price-display" data-item-id="${fType.id}" data-base-price="${fType.price}">${shopPriceMarkupPlain(fType.price)}</div>
                    <button type="button" class="${shopBuyBtnClass(true, 'waiting')}" disabled>Pick shopper</button>
                </div>
            </div>
        </div>`;
}

function catalogHtml(kind) {
  if (kind === 'legendaries') {
    return `
                <div class="shop-section col-span-full">
                    <div class="shop-section-head shop-section-head--indigo">
                        <div class="shop-section-head-main">
                            <h3 class="shop-section-title"><i class="fas fa-scroll shop-section-title-icon"></i> Legendary Artifacts</h3>
                            <p class="shop-section-desc">Evergreen relics with battle-shaping perks — stock is precious: two legendary buys per student each month.</p>
                        </div>
                        <span class="shop-section-badge shop-section-badge--indigo">Limit 2 / month</span>
                    </div>
                </div>
            ${LEGENDARY_ARTIFACTS.map((item) => renderShopItemCard(item, true)).join('')}`;
  }
  if (kind === 'seasonal') {
    return `
                <div class="shop-section col-span-full">
                    <div class="shop-section-head shop-section-head--amber">
                        <div class="shop-section-head-main">
                            <h3 class="shop-section-title"><i class="fas fa-leaf shop-section-title-icon"></i> Seasonal Treasures</h3>
                            <p class="shop-section-season-month">October</p>
                            <p class="shop-section-desc shop-section-desc--after-month">This month's classroom treasures. Heroes of the Day earn discounts, and Aurum Satchels stack on the price.</p>
                        </div>
                    </div>
                </div>
            ${SAMPLE_SEASONAL.map((item) => renderShopItemCard(item, false)).join('')}`;
  }
  return `
                <div class="shop-section col-span-full shop-section--spaced">
                    <div class="shop-section-head shop-section-head--violet">
                        <div class="shop-section-head-main">
                            <h3 class="shop-section-title"><i class="fas fa-egg shop-section-title-icon"></i> Familiar Eggs</h3>
                            <p class="shop-section-desc">One mystical companion per hero — buy an egg with coins, hatch it with stars, then evolve through tiers as they shine.</p>
                        </div>
                        <span class="shop-section-badge shop-section-badge--violet">Hatch ${FAMILIAR_LEVEL_THRESHOLDS.hatch}★</span>
                    </div>
                </div>
            ${FAMILIAR_EGGS.map((fType) => renderFamiliarEggCard(fType)).join('')}`;
}

export function extrasShellHtml() {
  return `${shopTabHTML}${logTabHTML}${skillTreeModalHTML}${fortunesWheelModalHTML}${hallModalHtml()}${quizHostHtml()}`;
}

function hallModalHtml() {
  return `
    <div id="history-modal" class="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[71] flex items-center justify-center p-4 hidden">
        <div class="bg-white/95 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] max-w-5xl w-full pop-in border border-white/20 flex flex-col max-h-[90vh] overflow-hidden" id="history-modal-panel">
            <div class="relative bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-6 text-white flex-shrink-0 overflow-hidden">
                <div class="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl pointer-events-none"></div>
                <div class="relative flex items-start justify-between gap-4">
                    <div class="flex items-start gap-4 min-w-0">
                        <div class="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-2xl shadow-inner border border-white/30 flex-shrink-0">
                            <i class="fas fa-crown text-white drop-shadow-sm"></i>
                        </div>
                        <div class="min-w-0">
                            <h2 id="history-modal-title" class="font-title text-3xl drop-shadow-md truncate">Junior B Legends</h2>
                            <p id="history-modal-subtitle" class="text-amber-100 font-bold uppercase tracking-widest text-[10px] opacity-90">Hall of Heroes</p>
                        </div>
                    </div>
                    <button type="button" class="bg-white/10 text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" aria-label="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div id="history-modal-content" class="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/30"></div>
        </div>
    </div>`;
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
  container.innerHTML = catalogHtml(kind);
}

export function hideShop() {
  const tab = document.getElementById('shop-tab');
  tab?.classList.add('hidden');
  tab?.classList.remove('capture-shop');
}

function skillTreeContentHtml(heroClass, tree, heroSkills, starsInReason, pendingChoice) {
  return tree.levels.map((lvl, idx) => {
    const levelNumber = idx + 1;
    const isUnlocked = starsInReason >= lvl.threshold;
    const chosenSkillId = heroSkills[idx] || null;
    const needsChoice = isUnlocked && !chosenSkillId;
    const isCurrentPending = pendingChoice && levelNumber === (heroSkills.length + 1) && needsChoice;
    const connectorHtml = idx < tree.levels.length - 1
      ? `<div class="flex justify-center my-2"><div class="w-1 h-12 rounded-full ${isUnlocked ? 'bg-gradient-to-b from-white/30 to-white/10' : 'bg-white/5 shadow-inner'}"></div></div>`
      : '';
    const titleLabel = getHeroTitle(heroClass, levelNumber);
    const thresholdLabel = `${lvl.threshold} ${getReasonDisplayName(tree.reason)} stars`;
    return `
            <div class="skill-tree-level-node group ${isUnlocked ? 'is-unlocked' : 'is-locked opacity-60'}" data-level="${levelNumber}">
                <div class="flex items-center gap-4 mb-5">
                    <div class="relative w-12 h-12 flex-shrink-0">
                        <div class="absolute inset-0 rounded-xl rotate-45 ${isUnlocked ? 'bg-white/10 border border-white/20' : 'bg-black/40 border border-white/5'}"></div>
                        <div class="relative flex items-center justify-center h-full text-lg font-title ${isUnlocked ? 'text-white' : 'text-white/30'}">${levelNumber}</div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-title text-xl text-white flex items-center gap-3">
                            ${titleLabel}
                            ${isUnlocked ? '<i class="fas fa-check-circle text-[10px] text-green-400 opacity-60"></i>' : '<i class="fas fa-lock text-[10px] opacity-30"></i>'}
                        </h3>
                        <div class="flex items-center gap-2 mt-1">
                            ${isUnlocked
                              ? `<span class="text-[9px] px-2 py-0.5 rounded-md bg-white/10 text-white/60 font-bold uppercase tracking-wider">Unlocked</span>`
                              : `<span class="text-[9px] px-2 py-0.5 rounded-md bg-black/40 text-white/30 font-bold uppercase tracking-wider border border-white/5">Requires ${thresholdLabel}</span>`}
                            ${isCurrentPending ? `<span class="text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider" style="background:${tree.auraColor};color:white">Level Up! Choice Pending</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    ${lvl.branches.map((branch) => {
                      const isChosen = chosenSkillId === branch.id;
                      const canChoose = isUnlocked && !chosenSkillId && (idx === 0 || !!heroSkills[idx - 1]);
                      return `
                            <div class="skill-branch-card relative rounded-[1.5rem] p-4 border
                                ${isChosen ? 'is-active border-2' : canChoose ? 'is-available border-white/10 bg-white/5' : 'is-unavailable border-white/5 bg-black/20 grayscale-[0.8] opacity-50'}"
                                style="${isChosen ? `border-color:${tree.auraColor};background:linear-gradient(135deg, ${tree.auraColor}22, ${tree.auraColor}11)` : ''}">
                                <div class="relative w-12 h-12 flex items-center justify-center rounded-2xl bg-black/40 border border-white/10 mb-3">
                                    <div class="text-3xl">${branch.icon}</div>
                                    ${isChosen ? `<div class="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px]" style="background:${tree.auraColor}"><i class="fas fa-check"></i></div>` : ''}
                                </div>
                                <div class="font-title text-sm text-white leading-tight mb-1.5">${branch.name}</div>
                                <div class="text-[11px] text-white/50 leading-relaxed">${branch.desc}</div>
                                ${isChosen ? `<div class="mt-3 flex items-center gap-2"><div class="h-1 flex-1 rounded-full overflow-hidden bg-white/10"><div class="h-full w-full" style="background:${tree.auraColor}"></div></div><span class="text-[8px] font-bold uppercase tracking-widest text-white/40">Active</span></div>` : ''}
                                ${canChoose ? `<div class="mt-4 py-2 rounded-xl text-center text-[10px] font-bold uppercase tracking-widest border border-dashed border-white/20">Select Skill</div>` : ''}
                            </div>`;
                    }).join('')}
                </div>
            </div>
            ${connectorHtml}`;
  }).join('');
}

export function showSkillTree() {
  hideExtras();
  hideAppScreen();
  const modal = document.getElementById('skill-tree-modal');
  const panel = document.getElementById('skill-tree-modal-panel');
  const heroClass = 'Guardian';
  const tree = HERO_SKILL_TREE[heroClass];
  const classInfo = HERO_CLASSES[heroClass];
  const heroSkills = ['guardian_1a'];
  const starsInReason = 52;
  const currentLevel = 1;
  if (!modal || !panel || !tree) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-skill');
  panel.style.background = `linear-gradient(165deg, ${tree.auraColor}33 0%, #0f172a 60%, #020617 100%)`;
  panel.style.borderColor = `${tree.auraColor}44`;
  const glow = document.getElementById('skill-tree-class-icon-glow');
  if (glow) glow.style.background = tree.auraColor;
  const bgIcon = document.getElementById('skill-tree-class-bg-icon');
  if (bgIcon) {
    bgIcon.textContent = classInfo.icon;
    bgIcon.style.color = tree.auraColor;
  }
  const bar = document.getElementById('skill-tree-progress-bar');
  if (bar) {
    const nextThreshold = tree.levels[currentLevel]?.threshold || 200;
    const prevThreshold = currentLevel > 0 ? tree.levels[currentLevel - 1].threshold : 0;
    const pct = Math.min(100, Math.max(0, Math.round(((starsInReason - prevThreshold) / (nextThreshold - prevThreshold)) * 100)));
    bar.style.background = `linear-gradient(90deg, ${tree.auraColor}aa, ${tree.auraColor})`;
    bar.style.boxShadow = `0 0 15px ${tree.auraColor}66`;
    bar.style.width = `${pct}%`;
  }
  const icon = document.getElementById('skill-tree-class-icon');
  if (icon) icon.textContent = classInfo.icon;
  const title = document.getElementById('skill-tree-modal-title');
  if (title) title.textContent = heroClass;
  const name = document.querySelector('#skill-tree-student-name .student-name-text');
  if (name) name.textContent = 'Alex';
  const levelLabel = document.getElementById('skill-tree-level-label');
  if (levelLabel) levelLabel.textContent = getHeroTitle(heroClass, currentLevel);
  const progressText = document.getElementById('skill-tree-progress-text');
  if (progressText) {
    const needed = starsToNextLevel(heroClass, currentLevel, starsInReason);
    progressText.textContent = `Lvl ${currentLevel} · ${starsInReason} ${getReasonDisplayName(tree.reason)} · ${needed} to next level`;
  }
  const content = document.getElementById('skill-tree-content');
  if (content) content.innerHTML = skillTreeContentHtml(heroClass, tree, heroSkills, starsInReason, true);
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

export function showAdventureLog() {
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
  tab?.classList.add('hidden');
  tab?.classList.remove('capture-log');
}

function hallCard({ name, initial, heroIcon, wins, latest, accent, label, extraDiscount, nextText, progressPercent, medal, delay }) {
  return `
                <article class="hoh-card rounded-[1.75rem] overflow-hidden shadow-md border border-white/60 bg-white" style="animation:none;animation-delay:${delay}ms">
                    <div class="relative p-5 text-white bg-gradient-to-br ${accent} overflow-hidden">
                        <div class="relative flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="relative flex-shrink-0">
                                    <div class="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm text-white text-2xl font-title flex items-center justify-center border-4 border-white/50 shadow-xl">${initial}</div>
                                    <div class="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-xl bg-white shadow-lg border border-white/60 flex items-center justify-center text-base leading-none">${heroIcon}</div>
                                </div>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-1.5 mb-0.5">
                                        <span class="text-[9px] uppercase tracking-[0.2em] font-black opacity-70">#${medal ? '1' : '2'}</span>
                                        ${medal ? `<span class="text-base leading-none">${medal}</span>` : '<span class="text-base leading-none">🥈</span>'}
                                    </div>
                                    <h3 class="font-title text-2xl leading-tight truncate">${name}</h3>
                                    <div class="inline-flex items-center gap-1.5 mt-1 bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide">
                                        <i class="fas fa-shield-halved text-[8px]"></i>
                                        ${label}
                                    </div>
                                </div>
                            </div>
                            <div class="flex-shrink-0 text-right">
                                <div class="text-[9px] uppercase tracking-[0.18em] font-black opacity-70 mb-0.5">Crowns</div>
                                <div class="font-title text-5xl leading-none" style="text-shadow:0 2px 12px rgba(0,0,0,0.3)">${wins}</div>
                                <div class="text-[9px] opacity-60 mt-0.5"><i class="fas fa-crown"></i></div>
                            </div>
                        </div>
                    </div>
                    <div class="px-4 py-3 space-y-2.5">
                        <div class="grid grid-cols-2 gap-2">
                            <div class="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                                <i class="fas fa-calendar-check text-indigo-400 text-sm flex-shrink-0"></i>
                                <div>
                                    <div class="text-[9px] uppercase tracking-[0.14em] font-black text-slate-400">Latest Crown</div>
                                    <div class="font-bold text-slate-700 text-sm mt-0.5">${latest}</div>
                                </div>
                            </div>
                            <div class="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
                                <i class="fas fa-tag text-amber-400 text-sm flex-shrink-0"></i>
                                <div>
                                    <div class="text-[9px] uppercase tracking-[0.14em] font-black text-amber-600">Shop Perk</div>
                                    <div class="font-bold text-amber-900 text-sm mt-0.5">+${extraDiscount}% off</div>
                                </div>
                            </div>
                        </div>
                        <div class="rounded-xl bg-slate-900 px-4 py-3">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[9px] uppercase tracking-[0.16em] font-black text-slate-400 flex items-center gap-1.5">
                                    <i class="fas fa-bolt text-amber-400"></i> Next milestone
                                </span>
                                <span class="text-[10px] font-black text-amber-400">${progressPercent}%</span>
                            </div>
                            <div class="h-2 rounded-full bg-white/10 overflow-hidden">
                                <div class="h-full rounded-full hoh-bar-fill" style="width:${progressPercent}%;animation:none"></div>
                            </div>
                            <p class="text-[11px] text-slate-400 mt-2">${nextText}</p>
                        </div>
                    </div>
                </article>`;
}

export function showHallOfHeroes() {
  hideExtras();
  hideAppScreen();
  const modal = document.getElementById('history-modal');
  const content = document.getElementById('history-modal-content');
  if (!modal || !content) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-hoh');
  const alex = getHeroLegendTierInfo(3);
  const maria = getHeroLegendTierInfo(5);
  content.innerHTML = `
        <div class="grid grid-cols-3 gap-3 mb-7">
            <div class="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-lg text-center">
                <div class="text-[9px] uppercase tracking-[0.2em] font-black opacity-75 mb-1">Total Crowns</div>
                <div class="font-title text-4xl">18</div>
            </div>
            <div class="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg text-center">
                <div class="text-[9px] uppercase tracking-[0.2em] font-black opacity-75 mb-1">Crowned Heroes</div>
                <div class="font-title text-4xl">9</div>
            </div>
            <div class="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-lg text-center">
                <div class="text-[9px] uppercase tracking-[0.2em] font-black opacity-75 mb-1">Top Legend</div>
                <div class="font-title text-2xl leading-tight truncate">Alex</div>
            </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4">
            ${hallCard({
              name: 'Alex', initial: 'A', heroIcon: '🛡️', wins: 3, latest: '30 Aug 2026',
              accent: alex.accent, label: alex.label, extraDiscount: alex.extraDiscount,
              nextText: '2 more crowns to reach <strong>Golden Legend</strong>', progressPercent: 60,
              medal: '🥇', delay: 0
            })}
            ${hallCard({
              name: 'Maria', initial: 'M', heroIcon: '⚔️', wins: 5, latest: '23 Aug 2026',
              accent: maria.accent, label: maria.label, extraDiscount: maria.extraDiscount,
              nextText: '5 more crowns to reach <strong>Mythic Legend</strong>', progressPercent: 50,
              medal: '', delay: 0
            })}
        </div>`;
}

export function hideHallOfHeroes() {
  const modal = document.getElementById('history-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-hoh');
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
