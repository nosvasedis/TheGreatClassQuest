/** Live Home tab, Projector wallpaper, certificates, and Hero Path assignment. */

import { quizLaunchButtonHtml } from '../../../../ui/modals/quizStageMarkup.js';
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
import { getGreetingHillsHtml, getDayRingEmblemHtml } from '../../../../features/homeGreetingScene.js';
import { buildHomePartyCardHtml } from '../../../../features/homePartyCard.mjs';
import { buildHomeQuestRoadCardHtml } from '../../../../features/homeQuestRoadCard.mjs';
import { buildSkyCardInner, describeArc, getLessonDialArc } from '../../../../ui/wallpaperDeck.mjs';
import { getWouldYouRatherCard } from '../../../../ui/wallpaperSkyCards.js';
import { hydrateAtlasCard } from '../../../../ui/wallpaperAtlasCards.js';

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

function partyFace(emoji, bg) {
  return 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="' + bg + '"/><text x="32" y="44" font-size="32" text-anchor="middle">' + emoji + '</text></svg>'
  );
}

/** The real class party card (features/homePartyCard.mjs) with a small sample class. */
function homePartyCardHtml() {
  const heroes = [
    ['Alex', '🦊', '#fde68a', 6], ['Maria', '🐼', '#bfdbfe', 9], ['Nikos', '🦁', '#fecdd3', 4], ['Eleni', '🐯', '#fed7aa', 7, true],
    ['Robin', '🐸', '#bbf7d0', 3], ['Sofia', '🦉', '#ddd6fe', 5], ['Yannis', '', '', 2], ['Zoe', '🐨', '#e0f2fe', 8]
  ].map(([name, emoji, bg, monthlyStars, pendingSkillChoice], i) => ({
    id: `guide-${i}`, name, avatar: emoji ? partyFace(emoji, bg) : '', monthlyStars, pendingSkillChoice: !!pendingSkillChoice
  }));
  return buildHomePartyCardHtml({ students: heroes, virtueStars: { teamwork: 34, creativity: 18, respect: 12, focus: 9 } });
}

/** The real day/night ring, frozen at 09:40 on a mid-September day so captures stay stable. */
function greetingRingHtml() {
  const at = (h, m) => new Date(2026, 8, 15, h, m).getTime();
  return getDayRingEmblemHtml('📚', { now: at(9, 40), sunrise: at(7, 5), sunset: at(19, 25), intro: false });
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
            <div class="vibrant-card h-span-8 greeting-panel greeting-panel--morning">
                <div class="greeting-bg-mesh"></div>
                <div class="greeting-sky" aria-hidden="true">
                    <span class="greeting-sky__glow"></span>
                    <span class="greeting-sky__stars"></span>
                    ${getGreetingHillsHtml()}
                </div>
                ${greetingRingHtml()}
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

            <div class="vibrant-card h-span-4 weather-card weather-card--v2 w-day">
              <div class="weather-deco" aria-hidden="true"><span class="weather-glow"></span><i class="fas fa-cloud weather-cloud"></i><i class="fas fa-cloud weather-cloud weather-cloud--b"></i></div>
              <i class="fas fa-sun weather-sun" aria-hidden="true"></i>
              <div class="weather-top"><span></span><div class="weather-meta"><span class="weather-chip"><i class="fas fa-temperature-arrow-up"></i>21°<span class="weather-chip__sep">/</span><i class="fas fa-temperature-arrow-down"></i>12°</span></div></div>
              <div class="weather-info"><div class="weather-temp font-title">18°</div><div class="weather-cond">Sunny</div></div>
              <div class="weather-bottom"><div id="weather-card-footer" class="weather-card-footer">${quizLaunchButtonHtml({ questionCount: 8 })}</div></div>
            </div>

            ${buildHomeQuestRoadCardHtml({ stars: 86, goal: 138, logo: '📚' })}

            ${homePartyCardHtml()}

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

/** A Sky Card exactly as the Director builds it (ui/wallpaperDeck.mjs frame + a real card body). */
function wallpaperSkyCard(family, card, pos, lifeLeft = 0.6) {
  const inner = buildSkyCardInner({ family, sigil: card.sigil, title: card.title, bodyHtml: card.html, hint: card.hint || '' });
  return `<div class="wallpaper-float-card sky-card sky-card--${family} absolute is-placed" style="top:${pos.top};left:${pos.left};opacity:1;--card-rotate:${pos.rotate || '0deg'};--life-left:${lifeLeft};">${inner}</div>`;
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
  if (timeEl) timeEl.textContent = '09:15';
  if (dateEl) dateEl.textContent = 'Sunday, 30 August 2026';
  if (className) className.innerHTML = '<span class="sky-hub__logo" aria-hidden="true">📚</span><span class="sky-hub__name">Junior B</span>';
  if (classLevel) classLevel.textContent = 'Quest League · Junior B';
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

  // Day arc (sun a little past the morning), lesson ring (09:00–10:00 at 09:15).
  const marker = document.getElementById('wall-day-marker');
  const dayDone = document.getElementById('wall-day-done');
  marker?.setAttribute('transform', 'translate(78.3 23.8)');
  dayDone?.setAttribute('d', 'M 20 58 A 130 46 0 0 1 78.3 23.8');
  const rise = document.getElementById('wall-sunrise');
  const set = document.getElementById('wall-sunset');
  if (rise) rise.textContent = '☀ 07:05';
  if (set) set.textContent = '19:52 ☾';
  const arc = getLessonDialArc('09:00', '10:00', new Date(2026, 7, 30, 9, 15));
  document.getElementById('wall-lesson-track')?.setAttribute('d', describeArc(100, 100, 93, arc.startDeg, arc.sweepDeg));
  document.getElementById('wall-lesson-done')?.setAttribute('d', describeArc(100, 100, 93, arc.startDeg, arc.elapsedDeg));
  const caption = document.getElementById('wall-lesson-caption');
  if (caption) {
    caption.textContent = `Lesson ends in ${arc.minutesLeft} min`;
    caption.classList.add('is-visible');
  }
  wall.classList.add('wall-awake');

  const area = document.getElementById('wall-floating-area');
  if (area) {
    const stars = hydrateAtlasCard('sky_constellation', null, 'Junior B');
    const talk = getWouldYouRatherCard('Junior B');
    area.innerHTML = [
      wallpaperSkyCard('sky', stars, { top: '14%', left: '3%', rotate: '-1deg' }, 0.7),
      wallpaperSkyCard('heart', talk, { top: '30%', left: '68%', rotate: '1deg' }, 0.35)
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
