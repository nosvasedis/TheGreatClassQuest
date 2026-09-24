/** Live Home tab, Projector wallpaper, certificates, and Hero Path assignment. */

import { homeTabHTML } from '../../../../templates/app/tabs/home.js';
import { wallpaperHTML } from '../../../../templates/app/screens/wallpaper.js';
import { reportsModalsHTML } from '../../../../templates/modals/reports.js';
import { studentModalsHTML } from '../../../../templates/modals/student.js';
import { heroClassModalsHTML } from '../../../../templates/modals/heroClass.js';
import { HERO_CLASSES } from '../../../../features/heroClasses.js';
import { getReasonDisplayName } from '../../../../features/heroSkillTree.js';
import { getGuildEmblemUrl } from '../../../../features/guilds.js';
import { hideAppScreen, hideExtras } from './fill-extras.js';

function startShow() {
  hideExtras();
  hideAppScreen();
}

function emblemUrl(guildId) {
  return String(getGuildEmblemUrl(guildId) || '').replace(/^\.\//, '/');
}

export function surfacesShellHtml() {
  return `${homeTabHTML}${wallpaperHTML}${reportsModalsHTML}${studentModalsHTML}${heroClassModalsHTML}`;
}

export function hideSurfaces() {
  hideHomeTab();
  hideProjector();
  hideCertificateForge();
  hideCertificatePrint();
  hideHeroClass();
}

function reminderPillsHtml() {
  return `
                <div class="date-pill bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg flex items-center gap-2 px-4 py-2 rounded-full border-2 border-white/50">
                    <span class="text-xl">🎂</span>
                    <span class="font-bold text-shadow-sm">Happy Birthday, Maria!</span>
                </div>
                <button type="button" id="trigger-ceremony-btn" class="date-pill bg-gradient-to-r from-indigo-600 to-purple-600 text-white border border-indigo-400 shadow-lg flex items-center gap-2 px-4 py-2 rounded-full">
                    <i class="fas fa-trophy text-yellow-300"></i>
                    <span class="font-bold">July Ceremony!</span>
                </button>`;
}

function bountyPillHtml() {
  return `
        <button type="button" id="open-bounty-modal-btn" class="home-bounty-pill group" title="Post a bounty for this class">
            <span class="home-bounty-pill__glow" aria-hidden="true"></span>
            <span class="home-bounty-pill__icon" aria-hidden="true"><i class="fas fa-crosshairs"></i></span>
            <div class="home-bounty-pill__text">
                <span class="home-bounty-pill__title font-title">Bounty</span>
                <span class="home-bounty-pill__sub">Post a quest</span>
            </div>
            <span class="home-bounty-pill__chev" aria-hidden="true"><i class="fas fa-chevron-right"></i></span>
        </button>`;
}

function heroAvatar(initial, pending) {
  const inner = `<div class="roster-avatar bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs enlargeable-avatar" title="${initial}">${initial}</div>`;
  if (!pending) return inner;
  return `<div class="avatar-with-level-up-wrap"><span class="level-up-badge" aria-hidden="true" title="Level up! Assign skill in Skill Tree"><i class="fas fa-arrow-up"></i></span>${inner}</div>`;
}

function homeDashboardHtml() {
  const tools = [
    { icon: 'fa-clipboard-check', label: 'Roll Call', extra: 'data-action="open-attendance" class="tool-btn-pop shortcut-action-btn"' },
    { icon: 'fa-magic', label: 'Report', extra: 'data-action="open-report" class="tool-btn-pop shortcut-action-btn"' },
    { icon: 'fa-feather-alt', label: 'Story', extra: 'data-target="reward-ideas-tab" class="tool-btn-pop shortcut-tab-btn"' },
    { icon: 'fa-scroll', label: 'Trials', extra: 'data-target="scholars-scroll-tab" class="tool-btn-pop shortcut-tab-btn"' },
    { icon: 'fa-star', label: 'Stars', extra: 'data-target="award-stars-tab" class="tool-btn-pop shortcut-tab-btn"' },
    { icon: 'fa-pencil-alt', label: 'Edit', extra: 'data-action="edit-class" class="tool-btn-pop shortcut-action-btn"' }
  ];
  return `
    <div class="w-full max-w-7xl mx-auto p-4">
        <div class="horizons-grid">
            <div class="vibrant-card h-span-8 greeting-panel">
                <div class="greeting-bg-mesh"></div>
                <div class="greeting-hero-asset">📚</div>
                <div class="relative z-10 flex flex-col justify-between h-full">
                    <div class="greeting-top-row">
                        <div id="home-reminders-container" class="greeting-top-row__reminders flex flex-wrap items-center gap-3 py-1">
                            ${reminderPillsHtml()}
                        </div>
                        <div class="greeting-top-row__bounty">
                            ${bountyPillHtml()}
                        </div>
                    </div>
                    <div>
                        <h1 class="font-title text-4xl md:text-5xl text-slate-800 drop-shadow-sm mb-1">
                            <span class="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400">Good Morning</span>,
                            <span class="text-transparent bg-clip-text bg-gradient-to-r from-slate-700 to-slate-500 whitespace-nowrap">Ms. Elena</span>!
                        </h1>
                        <p class="text-gray-500 font-bold text-base opacity-75" data-school-name>
                            <i class="fas fa-university mr-2"></i>Your School
                        </p>
                    </div>
                </div>
            </div>

            <div class="vibrant-card h-span-4 weather-card w-day">
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

            <div class="vibrant-card h-span-8 p-6 flex flex-col justify-center relative overflow-hidden quest-progress-card">
                <div class="absolute -bottom-14 -left-14 w-56 h-56 rounded-full bg-blue-400/25 blur-3xl pointer-events-none"></div>
                <div class="absolute -top-10 right-0 w-44 h-44 rounded-full bg-indigo-500/18 blur-2xl pointer-events-none"></div>
                <div class="relative z-10 flex justify-between items-start mb-5">
                    <div>
                        <h3 class="font-bold text-blue-400/80 text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/15 border border-blue-300/40"><i class="fas fa-route text-[9px] text-blue-500"></i></span>
                            Quest Progress
                        </h3>
                        <div class="quest-pct-text">62<span style="font-size:2.5rem">%</span></div>
                        <p class="text-[11px] text-blue-400/60 mt-1 font-semibold tracking-wide">of monthly goal</p>
                    </div>
                    <div class="quest-stars-pill">
                        <div class="font-title text-3xl text-amber-500 leading-none">86 ⭐</div>
                        <p class="text-[10px] font-bold text-amber-700/60 mt-0.5">this month</p>
                    </div>
                </div>
                <div class="quest-progress-track relative z-10">
                    <div class="quest-progress-fill" style="width: 62%">
                        <div class="quest-progress-shine"></div>
                    </div>
                </div>
                <div class="relative z-10 flex justify-between mt-2">
                    <p class="text-[11px] text-blue-400/50 font-medium">Start</p>
                    <p class="text-[11px] text-blue-500/70 font-bold">Goal: 138 ⭐</p>
                </div>
            </div>

            <div class="vibrant-card h-span-4 p-5 flex flex-col justify-between bg-gradient-to-br from-violet-100 to-purple-200 border-purple-300">
                <div>
                    <h3 class="text-xs font-bold opacity-70 uppercase tracking-widest mb-1"><i class="fas fa-bolt mr-1"></i> Top Skill</h3>
                    <div class="flex items-center gap-3">
                        <div class="text-4xl text-purple-600 filter drop-shadow-sm"><i class="fas fa-users"></i></div>
                        <div class="text-left">
                            <div class="font-title text-2xl text-purple-900 truncate capitalize">Teamwork</div>
                        </div>
                    </div>
                </div>
                <div class="mt-4">
                    <h3 class="text-xs font-bold opacity-70 uppercase tracking-widest mb-2 flex justify-between">
                        <span>Heroes</span>
                    </h3>
                    <div class="flex items-center flex-wrap pl-2 gap-y-2">
                        <div class="relative group -ml-2 first:ml-0">${heroAvatar('A', false)}</div>
                        <div class="relative group -ml-2">${heroAvatar('M', true)}</div>
                        <div class="relative group -ml-2">${heroAvatar('N', false)}</div>
                        <div class="relative group -ml-2">${heroAvatar('E', false)}</div>
                    </div>
                </div>
            </div>

            <div class="vibrant-card h-span-8 p-5 bg-gray-50/50 backdrop-blur-sm">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4"><i class="fas fa-history mr-2"></i> The Chronicle</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                    <div class="chronicle-item chronicle-homework">
                        <div class="chronicle-card-accent chronicle-accent-homework"></div>
                        <div class="flex items-center gap-2.5 mb-3">
                            <div class="chronicle-icon-badge bg-indigo-500/15 text-indigo-600"><i class="fas fa-book text-sm"></i></div>
                            <span class="text-xs font-bold text-indigo-700 uppercase tracking-wider">Homework</span>
                        </div>
                        <p class="text-sm text-indigo-900 font-medium leading-snug line-clamp-3 flex-1">Revise irregular verbs, page 42.</p>
                    </div>
                    <div class="chronicle-item chronicle-story">
                        <div class="chronicle-card-accent chronicle-accent-story"></div>
                        <div class="flex items-center gap-2.5 mb-3">
                            <div class="chronicle-icon-badge bg-cyan-500/15 text-cyan-600"><i class="fas fa-feather-alt text-sm"></i></div>
                            <span class="text-xs font-bold text-cyan-700 uppercase tracking-wider">Story: brave</span>
                        </div>
                        <p class="text-sm text-cyan-900 font-serif italic leading-snug line-clamp-3 flex-1">The dragon waited at the gate while the class chose a word.</p>
                    </div>
                    <div class="chronicle-item chronicle-log">
                        <div class="chronicle-card-accent chronicle-accent-log"></div>
                        <div class="flex items-center gap-2.5 mb-3">
                            <div class="chronicle-icon-badge bg-emerald-500/15 text-emerald-600"><i class="fas fa-compass text-sm"></i></div>
                            <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">Sun, 30</span>
                        </div>
                        <p class="text-sm text-green-900 font-medium leading-snug line-clamp-3 flex-1">Alex led the teamwork circle today.</p>
                    </div>
                </div>
            </div>

            <div class="vibrant-card h-span-4 card-glass-white">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest p-4 pb-0">Class Actions</h3>
                <div class="grid grid-cols-3 gap-3 p-4 pt-3">
                    ${tools.map((t) => `<div ${t.extra} style="aspect-ratio: 1/0.8"><i class="fas ${t.icon} text-xl mb-1"></i><span style="font-size: 0.65rem">${t.label}</span></div>`).join('')}
                </div>
            </div>
        </div>
    </div>`;
}

export function showHomeTab() {
  startShow();
  const tab = document.getElementById('about-tab');
  const dash = document.getElementById('home-dashboard-container');
  if (!tab || !dash) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-home');
  dash.innerHTML = homeDashboardHtml();
}

export function hideHomeTab() {
  const tab = document.getElementById('about-tab');
  tab?.classList.add('hidden');
  tab?.classList.remove('capture-home');
}

function wallpaperFloatCard(css, html, pos) {
  return `<div class="wallpaper-float-card ${css} absolute" style="top:${pos.top};bottom:${pos.bottom};left:${pos.left};right:${pos.right};opacity:1;">${html}</div>`;
}

function fillAnalogueClock() {
  const ticks = document.getElementById('clock-minor-ticks');
  if (ticks && ticks.children.length === 0) {
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const angle = i * 6;
      const rad = (angle - 90) * (Math.PI / 180);
      const outerR = 85;
      const innerR = 79;
      line.setAttribute('x1', String(100 + outerR * Math.cos(rad)));
      line.setAttribute('y1', String(100 + outerR * Math.sin(rad)));
      line.setAttribute('x2', String(100 + innerR * Math.cos(rad)));
      line.setAttribute('y2', String(100 + innerR * Math.sin(rad)));
      ticks.appendChild(line);
    }
  }
  const hour = document.getElementById('wall-clock-hour');
  const minute = document.getElementById('wall-clock-minute');
  const second = document.getElementById('wall-clock-second');
  if (hour) hour.style.transform = 'rotate(277.5deg)';
  if (minute) minute.style.transform = 'rotate(90deg)';
  if (second) second.style.transform = 'rotate(0deg)';
}

export function showProjector() {
  startShow();
  const wall = document.getElementById('dynamic-wallpaper-screen');
  if (!wall) return;
  wall.classList.remove('hidden', 'wallpaper-exit');
  wall.classList.add('capture-wall');
  wall.classList.remove('wallpaper-enter');

  const timeEl = document.getElementById('wall-time');
  const dateEl = document.getElementById('wall-date');
  const className = document.getElementById('wall-class-name');
  const classLevel = document.getElementById('wall-class-level');
  const quote = document.getElementById('wall-quote-text');
  const quoteBox = document.getElementById('wall-quote-container');
  if (timeEl) {
    timeEl.textContent = '09:15';
    timeEl.style.textShadow = '0 4px 6px rgba(0,0,0,0.6), 0 0 20px hsl(210, 90%, 50%)';
  }
  if (dateEl) dateEl.textContent = 'Sunday, 30 August 2026';
  if (className) className.innerHTML = '<span class="mr-3 text-5xl align-middle">📚</span>Junior B';
  if (classLevel) classLevel.textContent = 'Quest League';
  if (quote) quote.textContent = 'Courage is a star you can share.';
  quoteBox?.classList.remove('opacity-0');
  quoteBox?.classList.add('opacity-100');

  fillAnalogueClock();

  let timerOverlay = document.getElementById('wall-timer-overlay');
  if (!timerOverlay) {
    timerOverlay = document.createElement('div');
    timerOverlay.id = 'wall-timer-overlay';
    timerOverlay.className = 'absolute top-4 left-4 z-50 pointer-events-none';
    wall.appendChild(timerOverlay);
  }
  timerOverlay.innerHTML = `
        <div class="wall-timer-pill wall-timer-pill--warning" data-wall-timer-card>
            <span class="wall-timer-pill__icon">⏳</span>
            <span class="wall-timer-pill__title">Star sprint</span>
            <span class="wall-timer-pill__sep"></span>
            <span class="wall-timer-pill__clock">00:04:12</span>
        </div>`;

  const area = document.getElementById('wall-floating-area');
  if (area) {
    area.innerHTML = [
      wallpaperFloatCard(
        'float-card-red',
        `<div class="text-center">
            <div class="badge-pill bg-red-100 text-red-700">Timekeeper</div>
            <div class="relative w-48 h-48 mx-auto mb-4 flex items-center justify-center bg-white rounded-full shadow-lg"
                 style="background: conic-gradient(#ef4444 108deg, #f3f4f6 0deg);">
                <div class="absolute inset-4 bg-white rounded-full flex items-center justify-center flex-col">
                    <span class="font-title text-6xl text-red-600 leading-none">18</span>
                    <span class="text-xs font-bold text-red-400 uppercase">Mins</span>
                </div>
            </div>
            <p class="text-red-900 font-bold text-2xl">Until Adventure Ends</p>
        </div>`,
        { top: '8%', left: '5%', bottom: 'auto', right: 'auto' }
      ),
      wallpaperFloatCard(
        'float-card-blue',
        `<div class="text-center w-full">
            <div class="badge-pill bg-blue-100 text-blue-700">Quest Progress</div>
            <div class="text-9xl mb-4 filter drop-shadow-md">📚</div>
            <div class="w-full bg-white h-8 rounded-full overflow-hidden border-2 border-blue-200 mb-2 shadow-inner">
                <div class="bg-gradient-to-r from-blue-400 to-indigo-500 h-full" style="width:62%"></div>
            </div>
            <p class="font-title text-4xl text-blue-900">62% Complete</p>
            <p class="text-sm font-bold text-indigo-600 mt-2">Includes +10 Pathfinder bonus</p>
        </div>`,
        { top: 'auto', left: 'auto', bottom: '12%', right: '5%' }
      )
    ].join('');
  }
}

export function hideProjector() {
  const wall = document.getElementById('dynamic-wallpaper-screen');
  wall?.classList.add('hidden');
  wall?.classList.remove('capture-wall', 'wallpaper-enter');
}

export function showCertificateForge() {
  startShow();
  const modal = document.getElementById('certificate-modal');
  const content = document.getElementById('certificate-modal-content');
  if (!modal || !content) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-cert-forge');
  content.innerHTML = `
        <div class="w-full py-6 min-h-[350px] flex flex-col justify-center">
            <div class="relative flex flex-col items-center">
                <div class="relative mb-6">
                    <div class="relative w-28 h-28 rounded-[2rem] bg-white p-1 shadow-2xl rotate-3">
                        <div class="w-full h-full rounded-[1.8rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-title text-4xl text-white">A</div>
                        <div class="absolute -bottom-3 -right-3 w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-2xl flex items-center justify-center shadow-lg border-4 border-white transform -rotate-6">
                            <i class="fas fa-pen-fancy text-xl"></i>
                        </div>
                    </div>
                </div>
                <div class="text-center space-y-2 mb-8">
                    <h3 class="font-title text-3xl text-indigo-900 tracking-tight">Forge Alex's Legacy</h3>
                    <div class="flex items-center justify-center gap-3">
                        <span class="h-px w-8 bg-indigo-200"></span>
                        <span class="text-xs font-black uppercase tracking-widest text-indigo-500/80">Monthly Achievement</span>
                        <span class="h-px w-8 bg-indigo-200"></span>
                    </div>
                    <p class="text-indigo-600/70 text-sm max-w-xs mx-auto pt-2 leading-relaxed font-medium">
                        The Oracle is ready to weave Alex's deeds into a masterpiece.
                        Choose your mode and let the magic begin.
                    </p>
                </div>
                <div class="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
                    <div class="bg-white/40 backdrop-blur-sm p-4 rounded-2xl border border-white/60 flex flex-col items-center text-center">
                        <i class="fas fa-star text-amber-500 mb-1"></i>
                        <span class="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Stars Earned</span>
                        <span class="text-lg font-title text-indigo-900">This Month</span>
                    </div>
                    <div class="bg-white/40 backdrop-blur-sm p-4 rounded-2xl border border-white/60 flex flex-col items-center text-center">
                        <i class="fas fa-shield-halved text-indigo-500 mb-1"></i>
                        <span class="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Class Level</span>
                        <span class="text-lg font-title text-indigo-900">Junior B</span>
                    </div>
                </div>
                <button type="button" id="generate-cert-btn" class="group relative bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-title text-2xl py-4 px-12 rounded-[1.5rem] shadow-xl shadow-indigo-200/50">
                    <span class="relative flex items-center gap-3">
                        <i class="fas fa-wand-sparkles text-xl"></i>
                        Forge Certificate
                    </span>
                </button>
            </div>
        </div>`;
}

export function hideCertificateForge() {
  const modal = document.getElementById('certificate-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-cert-forge');
}

export function showCertificatePrint() {
  startShow();
  const tpl = document.getElementById('certificate-template');
  if (!tpl) return;
  const wrap = tpl.parentElement;
  wrap?.classList.add('capture-cert-wrap');
  tpl.classList.add('capture-cert');

  const style = {
    borderColor: '#FBBF24',
    bgColor: '#FFFBEB',
    titleColor: '#B45309',
    nameColor: '#D97706',
    textColor: '#92400E',
    icon: '⭐'
  };
  tpl.style.borderColor = style.borderColor;
  tpl.style.backgroundColor = style.bgColor;
  tpl.style.color = style.textColor;
  ['cert-corner-tl', 'cert-corner-tr', 'cert-corner-bl', 'cert-corner-br'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.borderColor = style.borderColor;
  });

  const icon = document.getElementById('cert-icon');
  const title = document.getElementById('cert-title');
  const name = document.getElementById('cert-student-name');
  const text = document.getElementById('cert-text');
  const teacher = document.getElementById('cert-teacher-name');
  const date = document.getElementById('cert-date');
  const flair = document.getElementById('cert-flair-row');
  const meta = document.getElementById('cert-meta');
  const school = tpl.querySelector('[data-school-name]');
  const logo = document.getElementById('cert-app-logo');
  const emblem = document.getElementById('cert-guild-emblem');

  if (icon) {
    icon.textContent = style.icon;
    icon.style.color = style.borderColor;
  }
  if (title) {
    title.textContent = 'Hero of the Quest';
    title.style.color = style.titleColor;
  }
  if (name) {
    name.textContent = 'Alex';
    name.style.color = style.nameColor;
  }
  if (text) {
    text.textContent = 'This month Alex practised Teamwork with a Guardian’s calm — 18 stars, a clear voice in Junior B, and a class that moved farther down the map together.';
  }
  if (teacher) {
    teacher.textContent = 'Ms. Elena';
    teacher.style.borderTopColor = style.borderColor;
  }
  if (date) {
    date.textContent = '30 August 2026';
    date.style.borderTopColor = style.borderColor;
  }
  if (meta) meta.textContent = 'Monthly Quest · Junior B · 18 ⭐';
  if (school) school.textContent = 'Your School';
  if (logo) {
    logo.src = '/assets/great-class-quest-logo.svg';
    logo.style.display = 'block';
  }
  if (emblem) {
    emblem.src = emblemUrl('dragon_flame');
    emblem.style.display = 'block';
  }
  if (flair) {
    flair.innerHTML = ['🌈', '📚', '⭐']
      .map((ch) => `<span style="font-size:18px">${ch}</span>`)
      .join('');
  }

  const pills = {
    'cert-class-name': { text: '📚 Junior B', bg: '#fff', color: '#92400E', border: '#FBBF24' },
    'cert-guild-pill': { text: '🔥 Dragon Flame', bg: '#dc2626', color: '#fff', border: '#b91c1c' },
    'cert-hero-pill': { text: '🛡️ Guardian', bg: '#2563eb', color: '#fff', border: '#1d4ed8' },
    'cert-stars-pill': { text: '18 ⭐ this month', bg: '#FBBF24', color: '#78350F', border: '#D97706' },
    'cert-league-pill': { text: 'Junior B', bg: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)', color: '#fff', border: 'rgba(255,255,255,0.55)' },
    'cert-virtue-pill': { text: '🤝 Teamwork', bg: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', color: '#fff', border: 'rgba(255,255,255,0.55)' }
  };
  Object.entries(pills).forEach(([id, spec]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = spec.text;
    el.style.background = spec.bg;
    el.style.color = spec.color;
    el.style.border = `1px solid ${spec.border}`;
  });
}

export function hideCertificatePrint() {
  const tpl = document.getElementById('certificate-template');
  tpl?.classList.remove('capture-cert');
  tpl?.parentElement?.classList.remove('capture-cert-wrap');
}

export function showHeroClass() {
  startShow();
  const modal = document.getElementById('hero-class-select-modal');
  const shell = document.getElementById('hcs-shell');
  if (!modal || !shell) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-hero-class');
  shell.dataset.mode = 'pick';
  shell.dataset.theme = 'Guardian';

  const guardian = HERO_CLASSES.Guardian;
  shell.style.setProperty('--hcs-accent', guardian.theme.accent);
  shell.style.setProperty('--hcs-accent-rgb', guardian.theme.rgb);

  const nameEl = document.getElementById('hcs-student-name');
  const subtitle = document.getElementById('hcs-subtitle');
  const watermark = document.getElementById('hcs-watermark');
  const emoji = document.getElementById('hcs-header-emoji');
  const swear = document.getElementById('hcs-swear-btn');
  const cards = document.getElementById('hcs-cards');
  const banner = document.getElementById('hcs-lock-banner');

  if (nameEl) nameEl.textContent = 'Alex';
  if (subtitle) subtitle.textContent = 'The path of the Guardian';
  if (watermark) watermark.textContent = guardian.icon;
  if (emoji) emoji.textContent = guardian.icon;
  if (swear) swear.disabled = false;
  if (banner) banner.classList.add('hidden');

  if (cards) {
    cards.innerHTML = Object.entries(HERO_CLASSES).map(([name, info]) => {
      const selected = name === 'Guardian';
      const virtue = getReasonDisplayName(info.reason);
      return `<button type="button"
            class="hcs-card${selected ? ' is-selected' : ''}"
            style="--card-accent:${info.theme.accent};--card-accent-rgb:${info.theme.rgb};">
            <div class="hcs-card-top">
                <span class="hcs-card-icon">${info.icon}</span>
                <span class="hcs-card-check" aria-hidden="true"><i class="fas fa-check"></i></span>
            </div>
            <span class="hcs-card-name">${name}</span>
            <span class="hcs-card-virtue">${virtue}</span>
            <span class="hcs-card-perk">${info.desc}</span>
        </button>`;
    }).join('');
  }
}

export function hideHeroClass() {
  const modal = document.getElementById('hero-class-select-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-hero-class');
}
