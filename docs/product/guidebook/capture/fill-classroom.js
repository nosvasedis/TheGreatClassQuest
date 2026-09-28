/** Hero's Challenge, Award Stars tab, Team Quest, Fortune Ledger, Trophy Room, Hall of Prodigies. */

import { awardTabHTML } from '../../../../templates/app/tabs/award.js';
import { guildPowerExplainerCardHtml } from '../../../../ui/tabs/guilds.js';
import { leaderboardTabHTML } from '../../../../templates/app/tabs/leaderboard.js';
import { trophyRoomModalsHTML } from '../../../../templates/modals/trophyRoom.js';
import { renderTrophyRosterHtml, renderTrophySatchelHtml } from '../../../../ui/modals/trophyRoomView.js';
import { buildTrophySatchel, buildActiveEffects } from '../../../../features/trophyRoomCore.mjs';
import { getGuildBadgeHtml } from '../../../../features/guilds.js';
import { hideAppScreen, hideExtras } from './fill-extras.js';
import {
  annotateStandingsChanges,
  buildStandingsSnapshot,
  playStandingsChanges,
  renderStandingsHeraldHtml,
  renderStandingsSectionHtml
} from '../../../../ui/tabs/heroStandings.js';

function badge(guildId, size = 'w-8 h-8') {
  return getGuildBadgeHtml(guildId, size)
    .replace('./assets/', '/assets/');
}

function startShow() {
  hideExtras();
  hideAppScreen();
}

export function classroomShellHtml() {
  return `${awardTabHTML}${leaderboardTabHTML}${trophyRoomModalsHTML}`;
}

export function hideClassroom() {
  hideAwardStarsTab();
  hideHerosChallenge();
  hideTeamQuest();
  hideFortuneLedger();
  hideTrophyRoom();
  hideHallOfProdigies();
  hideGuildPowerExplainer();
}

function cloudCard({
  id,
  name,
  initial,
  cloud,
  guildId,
  title,
  aura,
  today,
  month,
  total,
  gold,
  reason,
  starsVisible
}) {
  const guild = badge(guildId, 'w-5 h-5').replace('guild-badge ', 'guild-badge award-guild-corner ').replace(' border-2', '');
  const reasons = [
    ['teamwork', 'fa-users', 'Teamwork'],
    ['creativity', 'fa-lightbulb', 'Creativity'],
    ['respect', 'fa-hands-helping', 'Respect'],
    ['focus', 'fa-brain', 'Focus']
  ];
  return `
      <div class="award-card-mount">
        <div class="student-cloud-card" data-studentid="${id}">
          <div class="cloud-bg-svg cloud-bg-asset ${cloud}" aria-hidden="true"></div>
          <div class="absence-controls">
            <button class="absence-btn absence-btn--absent" type="button" title="Mark as Absent">
              <i class="fas fa-user-slash pointer-events-none"></i>
            </button>
          </div>
          <div class="student-avatar-cloud-placeholder">${initial}</div>
          ${guild}
          <div class="coin-pill" title="Current Gold">
            <i class="fas fa-coins text-yellow-400"></i>
            <span>${gold}</span>
          </div>
          <button class="boon-btn boon-btn--eligible absolute top-2 left-14 w-8 h-8 rounded-full z-30" type="button" title="Bestow Hero's Boon">
            <i class="fas fa-heart pointer-events-none"></i>
          </button>
          <div class="card-content-wrapper">
            <h3 class="font-title text-2xl text-gray-800 text-center">
              <div class="flex flex-wrap items-center justify-center gap-1.5 mb-1">
                <span class="hero-title-pill inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white shadow-sm border border-white/30" style="background: linear-gradient(135deg, ${aura}, ${aura}dd);" title="Hero rank"><span class="opacity-90">🛡️</span><span>${title}</span></span>
              </div>
              ${name}
            </h3>
            <div class="award-counters-row">
              <div class="counter-bubble counter-bubble--today">
                <span class="counter-bubble__ring"></span>
                <span class="counter-bubble__label">TODAY</span>
                <span class="counter-bubble__value font-title">${today}</span>
                <i class="fas fa-star counter-bubble__icon"></i>
              </div>
              <div class="counter-bubble counter-bubble--month">
                <span class="counter-bubble__ring"></span>
                <span class="counter-bubble__label">MONTH</span>
                <span class="counter-bubble__value font-title">${month}</span>
                <i class="fas fa-star counter-bubble__icon"></i>
              </div>
              <div class="counter-bubble counter-bubble--total">
                <span class="counter-bubble__ring"></span>
                <span class="counter-bubble__label">TOTAL</span>
                <span class="counter-bubble__value font-title">${total}</span>
                <i class="fas fa-star counter-bubble__icon"></i>
              </div>
            </div>
            <div class="reason-selector flex justify-center items-center gap-2">
              ${reasons.map(([key, icon, label]) => `
              <button class="reason-btn bubbly-button reason-btn--${key}${key === reason ? ' active' : ''}" data-reason="${key}" type="button" title="${label}">
                <span class="reason-btn__shimmer" aria-hidden="true"></span>
                <i class="fas ${icon} pointer-events-none"></i>
                <span class="reason-btn__label">${label}</span>
              </button>`).join('')}
            </div>
            <div class="star-selector-container ${starsVisible ? 'visible' : ''} flex items-center justify-center" data-aura="${reason}">
              <button data-stars="1" class="star-award-btn star-btn-1" type="button" aria-label="Award 1 star">
                <span class="star-btn__shine" aria-hidden="true"></span>
                <i class="fas fa-star"></i>
              </button>
              <span class="star-divider" aria-hidden="true"></span>
              <button data-stars="2" class="star-award-btn star-btn-2" type="button" aria-label="Award 2 stars">
                <span class="star-btn__shine" aria-hidden="true"></span>
                <i class="fas fa-star"></i><i class="fas fa-star"></i>
              </button>
              <span class="star-divider" aria-hidden="true"></span>
              <button data-stars="3" class="star-award-btn star-btn-3" type="button" aria-label="Award 3 stars">
                <span class="star-btn__shine" aria-hidden="true"></span>
                <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
              </button>
            </div>
          </div>
        </div>
      </div>`;
}

export function showAwardStarsTab() {
  startShow();
  const tab = document.getElementById('award-stars-tab');
  if (!tab) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-award');
  document.getElementById('open-teacher-boon-btn')?.classList.remove('hidden');
  const list = document.getElementById('award-stars-student-list');
  if (list) {
    list.innerHTML = [
      cloudCard({ id: 'alex', name: 'Alex', initial: 'A', cloud: 'award-cloud-a', guildId: 'dragon_flame', title: 'Sentinel', aura: '#16a34a', today: '2', month: '18', total: '86', gold: 42, reason: 'teamwork', starsVisible: true }),
      cloudCard({ id: 'maria', name: 'Maria', initial: 'M', cloud: 'award-cloud-b', guildId: 'owl_wisdom', title: 'Squire', aura: '#7c3aed', today: '0', month: '22', total: '91', gold: 55, reason: 'creativity', starsVisible: true }),
      cloudCard({ id: 'nikos', name: 'Nikos', initial: 'N', cloud: 'award-cloud-c', guildId: 'grizzly_might', title: 'Scout', aura: '#b45309', today: '1', month: '14', total: '70', gold: 31, reason: 'respect', starsVisible: false }),
      cloudCard({ id: 'eleni', name: 'Eleni', initial: 'E', cloud: 'award-cloud-d', guildId: 'phoenix_rising', title: 'Novice', aura: '#db2777', today: '0', month: '11', total: '48', gold: 19, reason: 'focus', starsVisible: true })
    ].join('');
  }
}

export function hideAwardStarsTab() {
  const tab = document.getElementById('award-stars-tab');
  tab?.classList.add('hidden');
  tab?.classList.remove('capture-award');
}

const HC_PILL = {
  prodigy: '<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 shadow-sm border border-amber-300">👑 Prodigy</div>',
  week: (n) => `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-600 shadow-sm border border-orange-200"><i class="fas fa-fire"></i> Week: ${n}</div>`,
  streak: (n) => `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-600 shadow-sm border border-indigo-200"><i class="fas fa-bolt"></i> Streak: ${n}</div>`,
  skill: {
    Teamwork: '<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 shadow-sm border border-white/50"><i class="fas fa-users"></i> <span>Teamwork</span></div>',
    Focus: '<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700 shadow-sm border border-white/50"><i class="fas fa-brain"></i> <span>Focus</span></div>',
    Respect: '<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 shadow-sm border border-white/50"><i class="fas fa-hands-helping"></i> <span>Respect</span></div>',
    Creativity: '<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-700 shadow-sm border border-white/50"><i class="fas fa-lightbulb"></i> <span>Creativity</span></div>'
  }
};

const HC_AVATAR_TINTS = ['bg-indigo-100 text-indigo-600', 'bg-rose-100 text-rose-600', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-sky-100 text-sky-700'];

function hcAvatar(h, size) {
  const tint = HC_AVATAR_TINTS[h.name.length % HC_AVATAR_TINTS.length];
  const aura = h.aura ? `style="box-shadow: 0 0 0 3px ${h.aura}, 0 0 14px 4px ${h.aura}88; border-color: ${h.aura};"` : '';
  return `<div data-student-id="${h.id}" class="${size} rounded-full ${tint} flex items-center justify-center font-bold text-lg border-4 border-white shadow-md enlargeable-avatar" ${aura}>${h.name.charAt(0)}</div>`;
}

function hcEntry(h, rank, showClass) {
  return {
    id: h.id,
    name: h.name,
    rank,
    score: h.stars,
    gold: h.gold,
    heroIcon: h.icon,
    avatarHtml: hcAvatar(h, 'w-12 h-12 sm:w-14 sm:h-14'),
    avatarLargeHtml: hcAvatar(h, rank === 1 ? 'w-20 h-20 sm:w-24 sm:h-24' : 'w-16 h-16 sm:w-20 sm:h-20'),
    familiarHtml: '',
    guildBadgeHtml: `<span class="hcs-guild">${badge(h.guildId, 'w-6 h-6')}</span>`,
    titleBadgeHtml: `<span class="hero-title-pill inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white shadow-sm border border-white/30" style="background: linear-gradient(135deg, ${h.titleColor}, ${h.titleColor}dd);"><span>${h.title}</span></span>`,
    roleBadgesHtml: h.champion ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style="background:#7c3aed;" title="Guild Champion this month">⚔️ Champion</span>' : '',
    pillsHtml: [h.prodigy ? HC_PILL.prodigy : '', h.week ? HC_PILL.week(h.week) : '', h.streak ? HC_PILL.streak(h.streak) : '', HC_PILL.skill[h.skill] || ''].join(''),
    className: h.className,
    classLogo: h.classLogo,
    showClass
  };
}

const HC_CLASSES = [
  {
    id: 'junior-b', title: 'Junior B', logo: '🐉', mine: true,
    heroes: [
      { id: 'maria', name: 'Maria', icon: '🧙', stars: 22, gold: 55, guildId: 'owl_wisdom', title: 'Spellweaver', titleColor: '#7c3aed', aura: '#a855f7', week: 6, streak: 3, skill: 'Teamwork', champion: true, prodigy: true },
      { id: 'alex', name: 'Alex', icon: '🛡️', stars: 18, gold: 42, guildId: 'dragon_flame', title: 'Sentinel', titleColor: '#16a34a', week: 5, skill: 'Focus' },
      { id: 'nikos', name: 'Nikos', icon: '⚔️', stars: 14, gold: 31, guildId: 'grizzly_might', title: 'Scout', titleColor: '#b45309', week: 3, skill: 'Respect' },
      { id: 'eleni', name: 'Eleni', icon: '🧵', stars: 11, gold: 19, guildId: 'phoenix_rising', title: 'Novice', titleColor: '#db2777', week: 2, skill: 'Creativity' },
      { id: 'sofia', name: 'Sofia', icon: '🎵', stars: 9, gold: 27, guildId: 'owl_wisdom', title: 'Minstrel', titleColor: '#0891b2', week: 4, skill: 'Creativity' },
      { id: 'yannis', name: 'Yannis', icon: '🏹', stars: 9, gold: 12, guildId: 'dragon_flame', title: 'Ranger', titleColor: '#15803d', week: 1, skill: 'Focus' },
      { id: 'dimitra', name: 'Dimitra', icon: '📜', stars: 6, gold: 8, guildId: 'phoenix_rising', title: 'Novice', titleColor: '#db2777', skill: 'Respect' }
    ]
  },
  {
    id: 'junior-a', title: 'Junior A', logo: '🦉', mine: false,
    heroes: [
      { id: 'leo', name: 'Leo', icon: '⚔️', stars: 20, gold: 40, guildId: 'grizzly_might', title: 'Squire', titleColor: '#b45309', week: 7, streak: 2, skill: 'Teamwork', prodigy: true },
      { id: 'anna', name: 'Anna', icon: '🧙', stars: 17, gold: 33, guildId: 'owl_wisdom', title: 'Apprentice', titleColor: '#7c3aed', week: 4, skill: 'Focus' },
      { id: 'petros', name: 'Petros', icon: '🛡️', stars: 12, gold: 21, guildId: 'dragon_flame', title: 'Guard', titleColor: '#16a34a', week: 2, skill: 'Respect' },
      { id: 'ioanna', name: 'Ioanna', icon: '🎵', stars: 8, gold: 15, guildId: 'phoenix_rising', title: 'Novice', titleColor: '#0891b2', week: 2, skill: 'Creativity' }
    ]
  }
];

// Where the board stood at the teacher's last look (for the rank-change show).
const HC_EARLIER = { maria: 17, alex: 18, nikos: 14, eleni: 7, sofia: 9, yannis: 5, dimitra: 6 };
const HC_EARLIER_ORDER = ['alex', 'maria', 'nikos', 'sofia', 'eleni', 'dimitra', 'yannis'];

function hcSections(view) {
  const star = (n) => `<i class="fas fa-star" aria-hidden="true"></i>${n} stars in August`;
  if (view === 'league') {
    const all = HC_CLASSES.flatMap((c) => c.heroes.map((h) => ({ ...h, className: c.title, classLogo: c.logo })));
    all.sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
    return [{
      id: 'league:Junior', title: 'Junior League', logo: '', mine: false,
      facts: [`<i class="fas fa-users" aria-hidden="true"></i>${all.length} heroes`, '<i class="fas fa-flag" aria-hidden="true"></i>2 classes', star(all.reduce((n, h) => n + h.stars, 0))],
      entries: all.map((h, i) => hcEntry(h, i + 1, true))
    }];
  }
  return HC_CLASSES.map((c) => {
    const heroes = [...c.heroes].sort((a, b) => b.stars - a.stars);
    let lastRank = 0;
    return {
      id: c.id, title: c.title, logo: c.logo, mine: c.mine,
      facts: [`<i class="fas fa-users" aria-hidden="true"></i>${heroes.length} heroes`, star(heroes.reduce((n, h) => n + h.stars, 0))],
      entries: heroes.map((h, i) => {
        lastRank = i > 0 && heroes[i - 1].stars === h.stars && lastRank > 3 ? lastRank : i + 1;
        return hcEntry({ ...h, className: c.title, classLogo: c.logo }, lastRank, false);
      })
    };
  });
}

/** mode: 'class' (default), 'league' (Global Rank), 'moved' (after a lesson: chips + herald), 'replay' (plays the show). */
export function showHerosChallenge(mode = 'class') {
  startShow();
  const tab = document.getElementById('student-leaderboard-tab');
  if (!tab) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-hc');
  const month = document.getElementById('hero-month-name');
  if (month) month.textContent = 'August';
  const leagueBtn = document.getElementById('student-leaderboard-league-picker-btn');
  const nameEl = leagueBtn?.querySelector('.league-bar__pick-name');
  if (nameEl) nameEl.textContent = 'Junior';
  const view = mode === 'league' ? 'league' : 'class';
  [['view-by-class', view === 'class'], ['view-by-league', view === 'league'], ['metric-monthly', true], ['metric-total', false]].forEach(([id, on]) => {
    const btn = document.getElementById(id);
    btn?.classList.toggle('is-active', on);
    if (on) btn?.parentElement?.style.setProperty('--seg-i', id === 'view-by-league' ? '1' : '0');
  });
  document.getElementById('open-prodigy-btn')?.removeAttribute('disabled');
  document.getElementById('open-trophy-room-btn')?.removeAttribute('disabled');
  tab.querySelectorAll('.tab-fab-cluster, .hc-fab-cluster').forEach((el) => el.classList.add('revealed'));
  const list = document.getElementById('student-leaderboard-list');
  if (!list) return;

  const sections = hcSections(view);
  let earlier = null;
  if (mode === 'moved' || mode === 'replay') {
    const first = sections[0];
    const ranks = {};
    HC_EARLIER_ORDER.forEach((id, i) => { ranks[id] = i + 1; });
    earlier = { sections: { [first.id]: { order: HC_EARLIER_ORDER, scores: HC_EARLIER, ranks } } };
    sections.slice(1).forEach((sec) => { Object.assign(earlier.sections, buildStandingsSnapshot([sec]).sections); });
  }
  const moved = annotateStandingsChanges(sections, earlier, mode === 'replay' ? earlier : null);
  list.className = 'hcs-list';
  list.innerHTML = renderStandingsHeraldHtml(sections, { byClass: view === 'class' })
    + sections.map((sec, i) => renderStandingsSectionHtml(sec, { monthName: 'August', metric: 'monthly', delayIndex: i })).join('');
  if (mode === 'replay' && moved) playStandingsChanges(list, sections);
  else list.classList.add('hcs-list--settled');
}

export function hideHerosChallenge() {
  const tab = document.getElementById('student-leaderboard-tab');
  tab?.classList.add('hidden');
  tab?.classList.remove('capture-hc');
}

function questCard({ rank, name, logo, stars, avg, progress, heroes, you }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
  const rankClass = rank === 1 ? 'team-quest-card-refreshed--rank-1' : rank === 2 ? 'team-quest-card-refreshed--rank-2' : rank === 3 ? 'team-quest-card-refreshed--rank-3' : 'team-quest-card-refreshed--rank-other';
  const header = rank === 1
    ? 'bg-gradient-to-r from-amber-50 to-orange-50/50 border-b border-amber-100'
    : rank === 2
      ? 'bg-gradient-to-r from-slate-50 to-gray-50/50 border-b border-slate-100'
      : 'bg-gradient-to-r from-orange-50 to-amber-50/50 border-b border-orange-100';
  const p = progress;
  const fillBronze = Math.min(p, 30) / 30 * 100;
  const fillSilver = Math.min(Math.max(p - 30, 0), 30) / 30 * 100;
  const fillGold = Math.min(Math.max(p - 60, 0), 25) / 25 * 100;
  const fillCrystal = Math.min(Math.max(p - 85, 0), 15) / 15 * 100;
  const youChip = you ? '<span class="text-[10px] font-black bg-sky-600 text-white px-3 py-1 rounded-full uppercase tracking-widest">YOU</span>' : '';
  return `
        <div class="team-quest-card-refreshed ${rankClass}">
            <div class="${header} p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2.5 shrink-0">
                        <span class="rank-emblem-wrap rank-emblem-wrap--${rank}">${medal}</span>
                        <div class="quest-logo-container text-4xl md:text-5xl">${logo}</div>
                    </div>
                    <div>
                        <h4 class="font-title text-3xl text-indigo-900 leading-tight">${name}</h4>
                        <div class="flex flex-wrap gap-2 mt-2 items-center">
                            <span class="text-[10px] font-black bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 uppercase tracking-widest">Level 3</span>
                            <span class="text-[10px] font-black bg-white text-indigo-600 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest"><i class="fas fa-users mr-1"></i>12 Heroes</span>
                            ${youChip}
                        </div>
                    </div>
                </div>
                <div class="quest-status-crystal flex items-center gap-6">
                    <div class="text-center px-2 border-r border-indigo-100">
                        <div class="font-title text-4xl text-indigo-600 leading-none">${stars}</div>
                        <div class="text-[9px] font-black text-indigo-400 uppercase mt-1 tracking-wider">Stars Collected</div>
                    </div>
                    <div class="text-center px-2">
                        <div class="font-title text-4xl text-amber-500 leading-none">${avg}</div>
                        <div class="text-[9px] font-black text-amber-500 uppercase mt-1 tracking-wider">Avg / Hero</div>
                    </div>
                </div>
            </div>
            <div class="p-6 bg-gradient-to-b from-transparent to-indigo-50/30">
                <div class="relative w-full" style="height: 3.25rem;">
                    <div class="flex items-stretch w-full h-6 absolute rounded-full overflow-hidden shadow-inner border border-slate-200/60" style="top: 8px; background: #e9ecef;">
                        <div class="quest-trail-segment--bronze h-full relative overflow-hidden" style="flex: 30;"><div class="quest-trail-segment--bronze-fill h-full" style="width: ${fillBronze}%"></div></div>
                        <div class="quest-trail-segment--silver h-full relative overflow-hidden" style="flex: 30;"><div class="quest-trail-segment--silver-fill h-full" style="width: ${fillSilver}%"></div></div>
                        <div class="quest-trail-segment--gold h-full relative overflow-hidden" style="flex: 25;"><div class="quest-trail-segment--gold-fill h-full" style="width: ${fillGold}%"></div></div>
                        <div class="quest-trail-segment--crystal h-full relative overflow-hidden" style="flex: 15;"><div class="quest-trail-segment--crystal-fill h-full" style="width: ${fillCrystal}%"></div></div>
                    </div>
                </div>
                <div class="flex items-center gap-2 mt-3">${heroes}</div>
            </div>
        </div>`;
}

export function showTeamQuest() {
  startShow();
  const tab = document.getElementById('class-leaderboard-tab');
  if (!tab) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-tq');
  const month = document.getElementById('quest-month-name');
  if (month) month.textContent = 'August';
  const leagueBtn = document.getElementById('leaderboard-league-picker-btn');
  if (leagueBtn) {
    const span = leagueBtn.querySelector('span');
    if (span) span.textContent = 'Junior';
  }
  const av = (letter) => `<div class="w-8 h-8 rounded-full border border-gray-200 overflow-hidden shadow-sm"><div class="w-full h-full bg-indigo-100 flex items-center justify-center text-indigo-500 font-bold text-xs">${letter}</div></div>`;
  const list = document.getElementById('class-leaderboard-list');
  if (list) {
    list.innerHTML = [
      questCard({ rank: 1, name: 'Junior A', logo: '🦉', stars: 96, avg: '8.0', progress: 72, heroes: av('M') + av('S'), you: false }),
      questCard({ rank: 2, name: 'Junior B', logo: '📚', stars: 84, avg: '7.0', progress: 62, heroes: av('A') + av('N'), you: true }),
      questCard({ rank: 3, name: 'Junior C', logo: '🌟', stars: 61, avg: '5.1', progress: 44, heroes: av('E'), you: false })
    ].join('');
  }
}

export function hideTeamQuest() {
  const tab = document.getElementById('class-leaderboard-tab');
  tab?.classList.add('hidden');
  tab?.classList.remove('capture-tq');
}

function ledgerResult(guildId, label, delta) {
  const names = {
    dragon_flame: 'Dragon Flame',
    owl_wisdom: 'Owl Wisdom',
    grizzly_might: 'Grizzly Might',
    phoenix_rising: 'Phoenix Rising'
  };
  const palettes = {
    dragon_flame: { p: '#dc2626', s: '#f97316' },
    owl_wisdom: { p: '#7c3aed', s: '#a78bfa' },
    grizzly_might: { p: '#92400e', s: '#d97706' },
    phoenix_rising: { p: '#be185d', s: '#fb7185' }
  };
  const pal = palettes[guildId];
  const neg = delta < 0;
  return `
                            <div class="guild-fortune-ledger__result" style="--guild-primary:${pal.p};--guild-secondary:${pal.s};">
                                <div class="guild-fortune-ledger__result-badge">${badge(guildId, 'w-8 h-8')}</div>
                                <div class="guild-fortune-ledger__result-copy">
                                    <div class="guild-fortune-ledger__result-guild">${names[guildId]}</div>
                                    <div class="guild-fortune-ledger__result-label">${label}</div>
                                </div>
                                <div class="guild-fortune-ledger__result-impact${neg ? ' guild-fortune-ledger__result-impact--negative' : ''}">
                                    ${delta >= 0 ? '+' : ''}${delta} ⚜️
                                </div>
                            </div>`;
}

export function showFortuneLedger() {
  startShow();
  const tab = document.getElementById('guilds-tab');
  if (!tab) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-ledger');
  document.getElementById('guilds-leaderboard-list')?.classList.add('hidden');
  const section = document.getElementById('fortunes-wheel-section');
  const panel = document.getElementById('fortune-ledger-panel');
  const toggle = document.getElementById('fortune-ledger-toggle');
  section.dataset.ledgerExpanded = 'true';
  panel?.classList.add('is-open');
  panel?.removeAttribute('inert');
  panel?.setAttribute('aria-hidden', 'false');
  toggle?.setAttribute('aria-expanded', 'true');
  const cls = document.getElementById('fortunes-wheel-class');
  if (cls) cls.textContent = 'Junior B';
  const status = document.getElementById('fortunes-wheel-status');
  if (status) status.textContent = 'Last spin Friday 29 Aug · next window is this class’s last lesson of the week.';
  const list = document.getElementById('fortunes-log-list');
  if (list) {
    list.innerHTML = `
            <article class="guild-fortune-ledger__entry">
                <div class="guild-fortune-ledger__entry-topline">
                    <div>
                        <div class="guild-fortune-ledger__entry-date">29 Aug</div>
                        <div class="guild-fortune-ledger__entry-week">Week 2026-W35</div>
                    </div>
                    <div class="guild-fortune-ledger__entry-swing">+40 ⚜️</div>
                </div>
                <div class="guild-fortune-ledger__entry-results">
                    ${ledgerResult('dragon_flame', 'Glory Bloom', 40)}
                    ${ledgerResult('owl_wisdom', 'Trickster', 0)}
                    ${ledgerResult('grizzly_might', 'Unity Chorus', 12)}
                    ${ledgerResult('phoenix_rising', 'Confetti Burst', 8)}
                </div>
            </article>
            <article class="guild-fortune-ledger__entry">
                <div class="guild-fortune-ledger__entry-topline">
                    <div>
                        <div class="guild-fortune-ledger__entry-date">22 Aug</div>
                        <div class="guild-fortune-ledger__entry-week">Week 2026-W34</div>
                    </div>
                    <div class="guild-fortune-ledger__entry-swing guild-fortune-ledger__entry-swing--negative">−15 ⚜️</div>
                </div>
                <div class="guild-fortune-ledger__entry-results">
                    ${ledgerResult('grizzly_might', 'Glory Eclipse', -15)}
                    ${ledgerResult('phoenix_rising', 'Scholar\'s Momentum', 10)}
                    ${ledgerResult('dragon_flame', 'Anthem', 0)}
                    ${ledgerResult('owl_wisdom', 'Bulwark Crest', 0)}
                </div>
            </article>`;
  }
}

export function hideFortuneLedger() {
  const tab = document.getElementById('guilds-tab');
  tab?.classList.remove('capture-ledger');
  document.getElementById('guilds-leaderboard-list')?.classList.remove('hidden');
  const section = document.getElementById('fortunes-wheel-section');
  if (section) section.dataset.ledgerExpanded = 'false';
  document.getElementById('fortune-ledger-panel')?.classList.remove('is-open');
  if (!tab?.classList.contains('capture-guilds')) tab?.classList.add('hidden');
}

export function showTrophyRoom() {
  startShow();
  const modal = document.getElementById('trophy-room-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-trophy');
  const subtitle = document.getElementById('trophy-room-subtitle');
  if (subtitle) subtitle.textContent = '🦊 Junior B Foxes · 6 heroes';
  const roster = document.getElementById('trophy-room-roster');
  if (roster) {
    roster.innerHTML = renderTrophyRosterHtml([
      { id: 'alex', name: 'Alex', total: 5, ready: 3 },
      { id: 'chloe', name: 'Chloe', total: 2, ready: 0 },
      { id: 'dimitris', name: 'Dimitris', total: 4, ready: 1 },
      { id: 'eleni', name: 'Eleni', total: 0, ready: 0 },
      { id: 'maria', name: 'Maria', total: 3, ready: 2 },
      { id: 'nikos', name: 'Nikos', total: 1, ready: 0 },
    ], 'alex');
  }
  const isUsable = (name) => ['Elixir of Luck', 'Scroll of the Gilded Star'].includes(name);
  const inventory = [
    { id: 'leg_luck', name: 'Elixir of Luck', icon: '🍀', description: '50% chance for +1 star during your NEXT lesson.' },
    { id: 'aug_tide', name: 'August Tide Charm', icon: '🐚', description: 'A shell that still hums with summer.', acquiredAt: '2026-08-28T10:00:00Z' },
    { id: 'leg_gilded', name: 'Scroll of the Gilded Star', icon: '✨', description: '3x Gold for the next star you earn.' },
    { id: 'leg_luck', name: 'Elixir of Luck', icon: '🍀', description: '50% chance for +1 star during your NEXT lesson.' },
    { id: 'ember_demo', name: 'Star-Ember', icon: '🌟', source: 'ember_oath', description: 'Kept a promise: read one page every evening.', acquiredAt: '2026-09-22T10:00:00Z' },
  ];
  const content = document.getElementById('trophy-room-content');
  if (content) {
    content.innerHTML = renderTrophySatchelHtml({
      student: { id: 'alex', name: 'Alex' },
      classLabel: '🦊 Junior B Foxes',
      gold: 42,
      satchel: buildTrophySatchel(inventory, { isUsable }),
      effects: buildActiveEffects({ gloryBannerCharges: 2 }, '2026-09'),
    });
  }
}

export function hideTrophyRoom() {
  const modal = document.getElementById('trophy-room-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-trophy');
}

export function showHallOfProdigies() {
  startShow();
  const modal = document.getElementById('prodigy-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-prodigy');
  const nav = document.getElementById('prodigy-nav-container');
  if (nav) {
    nav.innerHTML = `
        <div class="prodigy-hall-nav-wrap flex items-center p-1.5 gap-1">
            <button type="button" class="prodigy-hall-nav-btn prodigy-hall-nav-arrow-btn w-11 h-11 rounded-xl bg-white border border-indigo-100 text-indigo-600"><span aria-hidden="true">&lt;</span></button>
            <div class="px-4 text-center min-w-[11rem]">
                <p class="prodigy-hall-month text-base text-indigo-950 font-semibold">July 2026</p>
            </div>
            <button type="button" class="prodigy-hall-nav-btn prodigy-hall-nav-arrow-btn w-11 h-11 rounded-xl bg-white border border-indigo-100 text-indigo-600"><span aria-hidden="true">&gt;</span></button>
        </div>`;
  }
  const content = document.getElementById('prodigy-content');
  if (content) {
    content.innerHTML = `
                <div class="prodigy-hall-card relative w-full max-w-3xl mx-auto">
                    <div class="prodigy-hall-card__inner p-5 sm:p-7 md:p-8 min-h-[14rem]">
                        <div class="relative z-[2] flex flex-col sm:flex-row gap-5 sm:gap-6 items-center sm:items-stretch text-center sm:text-left">
                            <div class="relative shrink-0 flex flex-col items-center">
                                <div class="prodigy-hall-avatar-ring w-[5.5rem] h-[5.5rem] sm:w-32 sm:h-32 rounded-full border-[3px] border-white/35 overflow-hidden bg-indigo-50 flex items-center justify-center font-title text-4xl text-indigo-600">M</div>
                                <div class="absolute -top-1 -right-1 bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-md border-2 border-amber-400 text-amber-500">
                                    <i class="fas fa-trophy text-lg"></i>
                                </div>
                            </div>
                            <div class="flex-1 min-w-0 flex flex-col gap-3 w-full justify-center">
                                <div class="flex flex-wrap items-center justify-center sm:justify-between gap-2.5">
                                    <div class="prodigy-hall-crown-pill text-amber-950 px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 bg-amber-400">
                                        <i class="fas fa-crown text-sm"></i> Eternal Prodigy
                                    </div>
                                    <div class="prodigy-hall-medal-pill flex items-center gap-2 bg-white/12 px-3 py-1.5 rounded-xl border border-white/20">
                                        <span class="text-lg text-amber-200 font-title">2×</span>
                                        <i class="fas fa-medal text-amber-300 text-sm"></i>
                                    </div>
                                </div>
                                <h2 class="prodigy-hall-student-name text-2xl sm:text-3xl text-white tracking-tight">Maria</h2>
                                <div class="prodigy-hall-badge-row flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-sm text-white/90">
                                    <span class="text-amber-200 font-title text-2xl leading-none">48</span>
                                    <span class="font-semibold tracking-wide text-sm"><i class="fas fa-sparkles text-amber-300 mr-1.5"></i>stars this month</span>
                                </div>
                                <div class="bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-2.5 rounded-2xl border border-white/25 flex items-center gap-2.5">
                                    <span class="text-white text-lg"><i class="fas fa-book-open"></i></span>
                                    <span class="text-white text-sm">Learned Hero (92%)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <p class="text-center text-indigo-500 text-sm mt-6 font-semibold">Completed months only — August is still live, so it is not in this hall yet.</p>`;
  }
}

export function hideHallOfProdigies() {
  const modal = document.getElementById('prodigy-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-prodigy');
}

export function showGuildPowerExplainer() {
  startShow();
  let overlay = document.getElementById('guild-power-explainer-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'guild-power-explainer-overlay';
    overlay.className = 'guild-power-explainer-overlay hidden';
    overlay.innerHTML = guildPowerExplainerCardHtml();
    document.body.appendChild(overlay);
  }
  overlay.classList.remove('hidden');
  overlay.classList.add('capture-gpex');
}

export function hideGuildPowerExplainer() {
  const overlay = document.getElementById('guild-power-explainer-overlay');
  overlay?.classList.add('hidden');
  overlay?.classList.remove('capture-gpex');
}
