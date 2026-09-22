/** Hero's Challenge, Award Stars tab, Team Quest, Fortune Ledger, Trophy Room, Hall of Prodigies. */

import { awardTabHTML } from '../../../../templates/app/tabs/award.js';
import { leaderboardTabHTML } from '../../../../templates/app/tabs/leaderboard.js';
import { trophyRoomModalsHTML } from '../../../../templates/modals/trophyRoom.js';
import { getGuildBadgeHtml } from '../../../../features/guilds.js';
import { hideAppScreen, hideExtras } from './fill-extras.js';

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
                <span class="star-btn__badge">1</span>
                <i class="fas fa-star"></i>
              </button>
              <span class="star-divider" aria-hidden="true"></span>
              <button data-stars="2" class="star-award-btn star-btn-2" type="button" aria-label="Award 2 stars">
                <span class="star-btn__shine" aria-hidden="true"></span>
                <span class="star-btn__badge">2</span>
                <i class="fas fa-star"></i><i class="fas fa-star"></i>
              </button>
              <span class="star-divider" aria-hidden="true"></span>
              <button data-stars="3" class="star-award-btn star-btn-3" type="button" aria-label="Award 3 stars">
                <span class="star-btn__shine" aria-hidden="true"></span>
                <span class="star-btn__badge">3</span>
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

function hcRow({ rank, name, initial, guildId, title, icon, gold, stars, week, topSkill, champion }) {
  const podium = rank <= 3 ? rank : 0;
  const podiumMod = podium === 1 ? 'hc-lb-card--gold' : podium === 2 ? 'hc-lb-card--silver' : podium === 3 ? 'hc-lb-card--bronze' : '';
  const medal = podium === 1 ? '🥇' : podium === 2 ? '🥈' : podium === 3 ? '🥉' : '';
  const rankInner = podium
    ? `<span class="hc-lb-medal" aria-hidden="true">${medal}</span>`
    : `<span class="hc-lb-rank-num font-title">${rank}</span>`;
  const starClass = podium === 1
    ? 'hc-lb-score-star hc-lb-score-star--p1'
    : podium === 2
      ? 'hc-lb-score-star hc-lb-score-star--p2'
      : podium === 3
        ? 'hc-lb-score-star hc-lb-score-star--p3'
        : 'hc-lb-score-star';
  const champ = champion
    ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style="background:#dc2626;" title="Guild Champion this month">⚔️ Champion</span>`
    : '';
  return `
        <div class="student-leaderboard-card hc-lb-card ${podiumMod}" data-hc-rank="${rank}" data-hc-podium="${podium || ''}">
            <div class="hc-lb-card__inner">
                <div class="hc-lb-rank-tower" aria-label="Rank ${rank}">${rankInner}</div>
                <div class="hc-lb-hero-col">
                    <div class="flex-shrink-0 relative hero-challenge-avatar-wrap hc-lb-avatar-stage">
                        <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg border-4 border-white shadow-md">${initial}</div>
                    </div>
                </div>
                <div class="hc-lb-copy">
                    <h3 class="hc-lb-name font-title text-lg sm:text-xl leading-tight flex items-center flex-wrap gap-1.5">
                        <span class="hc-lb-name__text truncate">${icon} ${name}</span>
                        <span class="hero-title-pill inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white">${title}</span>
                        ${champ}
                    </h3>
                    <div class="hc-lb-meta-row">
                        <div class="hc-lb-gold" title="Gold balance">
                            <i class="fas fa-coins hc-lb-gold__icon"></i>
                            <span class="hc-lb-gold__val">${gold}</span>
                        </div>
                        <div class="hc-lb-class-strip">
                            <span class="hc-lb-class-strip__emoji" aria-hidden="true">📚</span>
                            <span class="hc-lb-class-strip__name">Junior B</span>
                        </div>
                    </div>
                    <div class="hc-lb-pills flex flex-wrap gap-1.5">
                        ${rank === 1 ? '<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 shadow-sm border border-amber-300">👑 Prodigy</div>' : ''}
                        <div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-600 shadow-sm border border-orange-200"><i class="fas fa-fire"></i> Week: ${week}</div>
                        <div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 shadow-sm border border-white/50"><i class="fas fa-users"></i> <span>${topSkill}</span></div>
                        <span class="guild-badge-wrap">${badge(guildId, 'w-6 h-6')}</span>
                    </div>
                </div>
                <div class="hc-lb-score-stack">
                    <div class="hc-lb-score-row" title="This month stars">
                        <span class="${starClass}" aria-hidden="true"><i class="fas fa-star"></i></span>
                        <div class="hc-lb-score">${stars}</div>
                    </div>
                    <div class="hc-lb-stars-label">Stars</div>
                    <div class="hc-lb-metric-chip">Monthly</div>
                </div>
            </div>
        </div>`;
}

export function showHerosChallenge() {
  startShow();
  const tab = document.getElementById('student-leaderboard-tab');
  if (!tab) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-hc');
  const month = document.getElementById('hero-month-name');
  if (month) month.textContent = 'August';
  const leagueBtn = document.getElementById('student-leaderboard-league-picker-btn');
  if (leagueBtn) {
    const span = leagueBtn.querySelector('span');
    if (span) span.textContent = 'Junior';
  }
  document.getElementById('student-view-switcher')?.classList.add('is-open');
  document.getElementById('open-prodigy-btn')?.removeAttribute('disabled');
  document.getElementById('open-trophy-room-btn')?.removeAttribute('disabled');
  tab.querySelectorAll('.tab-fab-cluster, .hc-fab-cluster').forEach((el) => el.classList.add('revealed'));
  const list = document.getElementById('student-leaderboard-list');
  if (list) {
    list.innerHTML = [
      hcRow({ rank: 1, name: 'Maria', initial: 'M', guildId: 'owl_wisdom', title: 'Squire', icon: '⚔️', gold: 55, stars: 22, week: 6, topSkill: 'Teamwork', champion: true }),
      hcRow({ rank: 2, name: 'Alex', initial: 'A', guildId: 'dragon_flame', title: 'Sentinel', icon: '🛡️', gold: 42, stars: 18, week: 5, topSkill: 'Focus', champion: false }),
      hcRow({ rank: 3, name: 'Nikos', initial: 'N', guildId: 'grizzly_might', title: 'Scout', icon: '⚔️', gold: 31, stars: 14, week: 3, topSkill: 'Respect', champion: false }),
      hcRow({ rank: 4, name: 'Eleni', initial: 'E', guildId: 'phoenix_rising', title: 'Novice', icon: '🧵', gold: 19, stars: 11, week: 2, topSkill: 'Creativity', champion: false })
    ].join('');
  }
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
  const label = document.getElementById('custom-select-label');
  if (label) label.textContent = 'Alex';
  const content = document.getElementById('trophy-room-content');
  if (content) {
    content.innerHTML = `
        <div class="treasure-vault-shell w-full max-w-[min(1180px,100%)] mx-auto space-y-4" data-student-id="alex">
            <section class="tv-hero-panel bg-gradient-to-br from-indigo-600 via-violet-700 to-fuchsia-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 relative overflow-hidden shadow-xl border-2 border-white/20">
                <div class="flex justify-center sm:justify-start shrink-0 relative z-10">
                    <div class="w-[4.5rem] h-[4.5rem] sm:w-24 sm:h-24 rounded-full border-4 border-white/35 shadow-xl bg-white overflow-hidden ring-4 ring-amber-200/25 flex items-center justify-center font-title text-3xl text-indigo-700">A</div>
                </div>
                <div class="flex-1 min-w-0 text-white relative z-10">
                    <p class="text-[10px] uppercase tracking-widest text-amber-200 font-bold">Trophy Room</p>
                    <h3 class="font-title text-3xl leading-tight">Alex</h3>
                    <p class="text-sm text-white/80 mt-1">🛡️ Sentinel · Junior B</p>
                    <div class="flex flex-wrap gap-3 mt-3">
                        <div class="tv-hero-stat bg-white/15 rounded-xl py-2 px-3 text-center border border-white/20">
                            <p class="text-[10px] uppercase tracking-wide text-amber-100">Stars</p>
                            <p class="text-lg font-title leading-none">86</p>
                        </div>
                        <div class="tv-hero-stat bg-white/15 rounded-xl py-2 px-3 text-center border border-white/20">
                            <p class="text-[10px] uppercase tracking-wide text-amber-100">Gold</p>
                            <p class="text-lg font-title leading-none">42</p>
                        </div>
                        <div class="tv-hero-stat tv-hero-stat--inventory bg-gradient-to-br from-cyan-400/55 to-cyan-950/30 rounded-xl py-2 px-3 text-center border-2 border-cyan-200/60">
                            <p class="text-[10px] uppercase tracking-wide text-cyan-50">Relics</p>
                            <p class="text-lg font-title leading-none">2</p>
                        </div>
                    </div>
                </div>
            </section>
            <div id="backpack-container" class="tv-backpack-shell min-w-0 rounded-2xl border-2 border-violet-200/45 shadow-lg p-4 flex flex-col gap-3 bg-gradient-to-br from-violet-50/75 via-white to-amber-50/45">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm"><i class="fas fa-scroll"></i></div>
                    <div>
                        <p class="font-title text-base text-indigo-950 leading-tight">Hero's backpack</p>
                        <p class="text-[10px] text-indigo-500 font-semibold">Use a relic, or keep a collectible vaulted</p>
                    </div>
                </div>
                <div class="treasure-vault-backpack-grid treasure-vault-backpack-grid--compact grid grid-cols-2 gap-3">
                    <div class="trophy-vault-compartment bg-amber-50/80 rounded-2xl border-2 border-amber-200 shadow-md p-3 flex flex-col items-stretch gap-2">
                        <div class="flex flex-col items-center gap-2">
                            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-4xl">🍀</div>
                            <p class="font-title text-indigo-950 text-sm leading-tight">Elixir of Luck</p>
                            <p class="text-[10px] font-semibold text-emerald-600">Ready to use</p>
                        </div>
                        <button type="button" class="trophy-room-use-btn mt-auto w-full bg-gradient-to-r from-amber-400 to-orange-400 text-white font-title text-sm py-2 rounded-xl"><i class="fas fa-wand-magic-sparkles mr-1.5 text-xs"></i>Use relic</button>
                    </div>
                    <div class="trophy-vault-compartment bg-violet-50/80 rounded-2xl border-2 border-violet-200 shadow-md p-3 flex flex-col items-stretch gap-2">
                        <div class="flex flex-col items-center gap-2">
                            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center text-4xl">🐚</div>
                            <p class="font-title text-indigo-950 text-sm leading-tight">August Tide Charm</p>
                            <p class="text-[10px] font-semibold text-violet-600">Vaulted</p>
                        </div>
                        <div class="mt-auto w-full bg-white/75 text-slate-600 font-title text-sm py-2 rounded-xl text-center border-2 border-slate-200/70"><i class="fas fa-award text-amber-500/90 mr-1.5 text-xs"></i>Collectible</div>
                    </div>
                </div>
            </div>
        </div>`;
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
    overlay.innerHTML = `
            <div class="guild-power-explainer-bg"></div>
            <div class="guild-power-explainer-card" role="dialog" aria-modal="true" aria-label="Guild Power explained">
                <button class="guild-power-explainer-close" aria-label="Close">✕</button>
                <div class="guild-power-explainer-title font-title">⚡ Guild Power</div>
                <p class="guild-power-explainer-copy">
                    Guild Power is a season-fair score. Each piece is scored 0–100 against the leading house, then mixed. Glory is counted <em>per member</em> first, so a small busy house can beat a large sleepy one.
                </p>
                <div class="guild-power-explainer-grid">
                    <div class="guild-power-explainer-item">
                        <div class="k">⚜️ Season Glory / member</div>
                        <div class="v">70% of Power</div>
                        <p class="guild-power-explainer-hint">Year-to-date Glory ÷ members, compared with the house richest per member.</p>
                    </div>
                    <div class="guild-power-explainer-item">
                        <div class="k">📅 This week's Glory / member</div>
                        <div class="v">15% of Power</div>
                        <p class="guild-power-explainer-hint">Monday–Friday Glory ÷ members. Rewards houses that are earning now.</p>
                    </div>
                    <div class="guild-power-explainer-item">
                        <div class="k">🔥 Activity</div>
                        <div class="v">10% of Power</div>
                        <p class="guild-power-explainer-hint">Share of members who earned Glory this week. Showing up matters.</p>
                    </div>
                    <div class="guild-power-explainer-item">
                        <div class="k">📈 Momentum</div>
                        <div class="v">5% of Power</div>
                        <p class="guild-power-explainer-hint">This week versus last week. A rise lifts a little; a drop hurts a little. Momentum Lock can stop a fall.</p>
                    </div>
                </div>
                <div class="guild-power-explainer-note">
                    Stars, boons, shop relics, quiz rewards, and Fortune's Wheel write Glory first. Guild Power is calculated from that ledger.
                </div>
            </div>`;
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
