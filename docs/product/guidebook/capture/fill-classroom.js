/** Hero's Challenge, Award Stars tab, Team Quest, Fortune Ledger, Trophy Room, Hall of Prodigies. */

import { awardTabHTML } from '../../../../templates/app/tabs/award.js';
import { guildPowerExplainerCardHtml } from '../../../../ui/tabs/guilds.js';
import { leaderboardTabHTML } from '../../../../templates/app/tabs/leaderboard.js';
import { renderQuestChroniclesHtml } from '../../../../ui/tabs/teamQuestChronicles.js';
import { trophyRoomModalsHTML } from '../../../../templates/modals/trophyRoom.js';
import { renderTrophyRosterHtml, renderTrophySatchelHtml } from '../../../../ui/modals/trophyRoomView.js';
import { buildProdigyNavHtml, buildProdigyShrinesHtml, buildProdigyYearHtml } from '../../../../ui/modals/prodigyHallView.js';
import { buildTrophySatchel, buildActiveEffects } from '../../../../features/trophyRoomCore.mjs';
import { getGuildBadgeHtml, getGuildById, getGuildEmblemUrl } from '../../../../features/guilds.js';
import { buildAwardCloudCardHtml, buildAwardSkySummaryHtml } from '../../../../features/awardCloudCard.mjs';
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

function guideGuild(guildId) {
  const g = getGuildById(guildId);
  if (!g) return null;
  return { name: g.name, emblemUrl: getGuildEmblemUrl(guildId).replace('./assets/', '/assets/'), color: g.primary };
}

/** A real award cloud (features/awardCloudCard.mjs) with guide data. */
export function guideCloudCard({ id, name, cloud, guildId, title, icon = '🛡️', aura, today = 0, month, total, gold, reason = null, starsVisible = false, locked = false, honours = {}, attendanceMode = 'absent-offer', isAbsent = false, boon = { eligible: true } }, index = 0) {
  const html = buildAwardCloudCardHtml({
    id, name, firstName: name.split(' ')[0], avatar: null,
    guild: guideGuild(guildId),
    heroClass: title ? { title, icon, aura } : null,
    gold, today, month, total, todayReason: reason, locked, isAbsent, attendanceMode,
    boon, honours, cloud, floatDelay: index * 900, riseDelay: 0
  }).replace(' tab-mount-rise', '');
  if (!starsVisible || !reason || locked) return html;
  return html
    .replace(`data-reason="${reason}" title=`, `data-reason="${reason}" data-guide-active title=`)
    .replace('star-selector-container aw-stars', 'star-selector-container aw-stars visible')
    .replace('data-studentid=', `data-aura="${reason}" data-studentid=`);
}

function markGuideActive(root) {
  root?.querySelectorAll('[data-guide-active]').forEach((btn) => {
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    btn.removeAttribute('data-guide-active');
  });
}

export function showAwardStarsTab() {
  startShow();
  const tab = document.getElementById('award-stars-tab');
  if (!tab) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-award');
  document.getElementById('open-teacher-boon-btn')?.classList.remove('hidden');
  const summary = document.getElementById('award-sky-summary');
  if (summary) {
    summary.innerHTML = buildAwardSkySummaryHtml({ shining: 2, heroes: 4, starsToday: 3, awaiting: 2 });
    summary.classList.remove('hidden');
  }
  const list = document.getElementById('award-stars-student-list');
  if (list) {
    list.innerHTML = [
      guideCloudCard({ id: 'alex', name: 'Alex', cloud: 'a', guildId: 'dragon_flame', title: 'Sentinel', aura: '#16a34a', today: 2, month: 18, total: 86, gold: 42, reason: 'teamwork', locked: true, attendanceMode: 'none' }, 0),
      guideCloudCard({ id: 'maria', name: 'Maria', cloud: 'b', guildId: 'owl_wisdom', title: 'Squire', aura: '#7c3aed', today: 1, month: 22, total: 91, gold: 55, reason: 'creativity', locked: true, attendanceMode: 'none', honours: { heroOfDay: true } }, 1),
      guideCloudCard({ id: 'nikos', name: 'Nikos', cloud: 'c', guildId: 'grizzly_might', title: 'Scout', aura: '#b45309', month: 14, total: 70, gold: 31, reason: 'respect', starsVisible: true }, 2),
      guideCloudCard({ id: 'eleni', name: 'Eleni', cloud: 'd', guildId: 'phoenix_rising', title: 'Novice', aura: '#db2777', month: 11, total: 48, gold: 19, honours: { prodigy: true, prodigyMonth: 'August' }, boon: { eligible: false } }, 3)
    ].join('');
    markGuideActive(list);
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
  const list = document.getElementById('class-leaderboard-list');
  if (list) {
    const party = (id, rank, name, logo, stars, goal, heroes, extra = {}) => ({
      id, rank, name, logo,
      progress: (stars / goal) * 100,
      currentMonthlyStars: stars,
      goals: { diamond: goal },
      topHeroes: heroes.map(([heroName, heroStars]) => ({ name: heroName, stars: heroStars })),
      studentCount: 12,
      ...extra
    });
    const entries = [
      party('junior-a', 1, 'Junior A', '🦉', 96, 133, [['Maria', 14], ['Sofia', 12], ['Nikos', 11]], { topSkill: 'teamwork', weeklyStars: 11, totalGold: 240, adventureCount: 3, difficulty: 1 }),
      party('junior-b', 2, 'Junior B', '📚', 84, 135, [['Anna', 13], ['Nikos', 10]], { topSkill: 'focus', weeklyStars: 9, totalGold: 188, adventureCount: 2, difficulty: 1 }),
      party('junior-c', 3, 'Junior C', '🌟', 61, 139, [['Eleni', 9]], { topSkill: 'creativity', weeklyStars: 4, totalGold: 120, adventureCount: 1 })
    ];
    list.innerHTML = `<div class="tq-board"><section class="tq-chronicles is-open">${renderQuestChroniclesHtml(entries, {
      monthName: 'August',
      leagueName: 'Junior',
      activeClassId: 'junior-b',
      openIds: new Set(['junior-b']),
      showFind: false
    })}</section></div>`;
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
                    ${ledgerResult('dragon_flame', 'Glory Storm', 20)}
                    ${ledgerResult('owl_wisdom', 'Trickster', 0)}
                    ${ledgerResult('grizzly_might', 'Glory Surge', 12)}
                    ${ledgerResult('phoenix_rising', 'Celebration!', 8)}
                </div>
            </article>
            <article class="guild-fortune-ledger__entry">
                <div class="guild-fortune-ledger__entry-topline">
                    <div>
                        <div class="guild-fortune-ledger__entry-date">22 Aug</div>
                        <div class="guild-fortune-ledger__entry-week">Week 2026-W34</div>
                    </div>
                    <div class="guild-fortune-ledger__entry-swing">+16 ⚜️</div>
                </div>
                <div class="guild-fortune-ledger__entry-results">
                    ${ledgerResult('grizzly_might', 'Glory Surge', 8)}
                    ${ledgerResult('phoenix_rising', 'Spark of Glory', 4)}
                    ${ledgerResult('dragon_flame', 'Anthem Power', 4)}
                    ${ledgerResult('owl_wisdom', 'Trickster', 0)}
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

function captureFace(emoji, bg) {
  return 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="' + bg + '"/><text x="32" y="44" font-size="32" text-anchor="middle">' + emoji + '</text></svg>'
  );
}

export function showHallOfProdigies() {
  startShow();
  const modal = document.getElementById('prodigy-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-prodigy');
  const maria = { id: 'maria', name: 'Maria', avatar: captureFace('🐼', '#bfdbfe') };
  const alex = { id: 'alex', name: 'Alex', avatar: captureFace('🦊', '#fde68a') };
  const eleni = { id: 'eleni', name: 'Eleni', avatar: captureFace('🐯', '#fed7aa') };
  const nav = document.getElementById('prodigy-nav-container');
  if (nav) nav.innerHTML = buildProdigyNavHtml({ monthName: 'July 2026', canGoBack: true, canGoForward: false });
  const content = document.getElementById('prodigy-content');
  if (content) {
    content.innerHTML = buildProdigyShrinesHtml({
      monthName: 'July 2026',
      winners: [{ ...maria, monthlyStars: 48, stats: { count3: 6, uniqueReasons: 5, academicAvg: 92 } }],
      crownsById: { maria: 3 },
      inventoryById: { maria: [{ name: 'Elixir of Luck', icon: '🧪' }, { name: 'Map of Stars', icon: '🗺️' }, { name: 'Owl Quill', icon: '🪶' }, { name: 'Crystal Orb', icon: '🔮' }] },
    });
  }
  const year = document.getElementById('prodigy-year-strip');
  if (year) {
    const winnersByMonth = [alex, maria, eleni, maria, null, alex, eleni, [alex, eleni], maria, eleni, maria];
    const months = ['Sep 2025', 'Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026'];
    year.innerHTML = buildProdigyYearHtml(months.map((label, i) => {
      const won = winnersByMonth[i];
      const winners = !won ? [] : (Array.isArray(won) ? won : [won]);
      return {
        key: `m${i}`,
        short: label.slice(0, 3),
        label,
        state: i === 11 ? 'live' : (winners.length ? 'crowned' : 'empty'),
        isCurrent: i === 10,
        winners,
      };
    }));
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
