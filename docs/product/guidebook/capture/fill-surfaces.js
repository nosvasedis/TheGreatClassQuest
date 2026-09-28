/** Live Home tab, Projector wallpaper, certificates, and Hero Path assignment. */

import { homeTabHTML } from '../../../../templates/app/tabs/home.js';
import { wallpaperHTML } from '../../../../templates/app/screens/wallpaper.js';
import { reportsModalsHTML } from '../../../../templates/modals/reports.js';
import { studentModalsHTML } from '../../../../templates/modals/student.js';
import { heroClassModalsHTML } from '../../../../templates/modals/heroClass.js';
import { HERO_CLASSES } from '../../../../features/heroClasses.js';
import { HERO_SKILL_TREE, getReasonDisplayName } from '../../../../features/heroSkillTree.js';
import { GUILDS, getGuildEmblemUrl } from '../../../../features/guilds.js';
import { buildCertificateModel, certificateStyleVars, renderCertificateInner, CERTIFICATE_WIDTH } from '../../../../features/certificateCore.mjs';
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
  const model = sampleCertificateModel();
  paintCertificateTemplate(model, '');
  const student = document.getElementById('certificate-modal-student');
  if (student) student.textContent = `${model.name} · ${model.classLogo} ${model.className}`;
  content.innerHTML = `
        <div class="cert-desk"><div id="cert-preview" class="cert-preview"></div></div>
        <aside class="cert-scribe">
            <section class="cert-card">
                <p class="cert-card__label">Honours on the page</p>
                <ul class="cert-honours-list">${model.allHonours.map((h) => `<li><span class="cert-h-icon">${h.icon}</span><span class="cert-h-text"><span class="cert-h-value">${h.value}</span><span class="cert-h-label">${h.label}</span></span></li>`).join('')}</ul>
                <p class="cert-honours-note">Counted from ${model.periodLabel} only.</p>
            </section>
            <section class="cert-card cert-inscription">
                <p class="cert-card__label">The Oracle's citation</p>
                <p class="cert-inscription__intro">The Oracle reads Alex's month and writes a short citation in words for the Junior B league. You can edit it before sealing.</p>
                <button type="button" id="generate-cert-btn" class="cert-btn cert-btn--oracle"><i class="fas fa-wand-sparkles"></i> Ask the Oracle</button>
            </section>
        </aside>`;
  const preview = document.getElementById('cert-preview');
  const clone = document.getElementById('certificate-template').cloneNode(true);
  clone.removeAttribute('id');
  clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  preview.appendChild(clone);
  requestAnimationFrame(() => { clone.style.transform = `scale(${preview.clientWidth / CERTIFICATE_WIDTH})`; });
}

function sampleCertificateModel() {
  return buildCertificateModel({
    scope: 'monthly',
    now: new Date(2026, 8, 30),
    student: { id: 'alex', name: 'Alex', heroClass: 'Guardian', guildId: 'dragon_flame' },
    studentClass: { name: 'Junior B', logo: '📚', questLevel: 'Junior B' },
    ageCategory: 'junior',
    scoreData: { monthlyStars: 18, totalStars: 96, heroLevel: 2, heroSkills: ['guardian_1a', 'guardian_2b'], lastMonthlyResetDate: '2026-09-01',
      familiar: { typeId: 'emberfang', name: 'Cinder', state: 'alive', level: 2 } },
    awardLogs: [{ studentId: 'alex', reason: 'teamwork', stars: 3, date: '12-09-2026' }, { studentId: 'alex', reason: 'respect', stars: 2, date: '18-09-2026' }],
    writtenScores: [{ studentId: 'alex', date: '15-09-2026', scoreNumeric: 18, maxScore: 20 }],
    oaths: [{ studentId: 'alex', status: 'kept', text: 'I will help a classmate every week', keptAt: '2026-09-20' }],
    guild: GUILDS.dragon_flame,
    heroDef: HERO_CLASSES.Guardian,
    heroTree: HERO_SKILL_TREE.Guardian,
    familiarTypes: { emberfang: { name: 'Emberfang', levelNames: ['Hatchling', 'Flame Drake', 'Inferno Dragon'] } },
    teacherName: 'Ms. Elena',
    schoolName: 'Your School',
  });
}

function paintCertificateTemplate(model, citation) {
  const tpl = document.getElementById('certificate-template');
  if (!tpl) return null;
  tpl.className = `gcq-cert gcq-cert--${model.band}`;
  tpl.setAttribute('style', certificateStyleVars(model));
  tpl.innerHTML = renderCertificateInner(model, {
    citation,
    assets: { guildEmblem: emblemUrl('dragon_flame'), appLogo: '/assets/great-class-quest-logo.svg' },
  });
  return tpl;
}

export function hideCertificateForge() {
  const modal = document.getElementById('certificate-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-cert-forge');
}

export function showCertificatePrint() {
  startShow();
  const model = sampleCertificateModel();
  const tpl = paintCertificateTemplate(model, 'This month you led Dragon Flame like a true Warden: 18 stars, a kept Ember Oath, and a class that moved farther down the map together.');
  if (!tpl) return;
  tpl.parentElement?.classList.add('capture-cert-wrap');
  tpl.classList.add('capture-cert');
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
