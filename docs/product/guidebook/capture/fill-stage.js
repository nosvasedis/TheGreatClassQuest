/** Guidebook capture stage: the ceremonies and the Attendance Chronicle, drawn with the live view builders. */

import {
  arenaBackdropHtml,
  arenaDuelHtml,
  arenaIntroHtml,
  arenaRevealHtml,
  arenaStandingsHtml,
  arenaTransitionHtml
} from '../../../../features/ceremonyArenaView.js';
import {
  gardenBackdropHtml,
  gardenFinaleHtml,
  gardenIntroHtml,
  gardenLeagueHtml,
  gardenParadeHtml,
  gardenSprigHtml
} from '../../../../features/ceremonyGardenView.js';
import {
  GRAND_CHAPTERS,
  grandBackdropHtml,
  grandChampionHtml,
  grandGuildPillarsHtml,
  grandOpeningHtml,
  grandProdigyRoadHtml
} from '../../../../features/grandCeremonyView.js';
import { GUILD_IDS, getGuildById as liveGuild } from '../../../../features/guilds.js';
import { getQuestMapZoneForProgressPercent } from '../../../../features/questMapZones.mjs';

// The stage page lives under docs/, so root-relative asset paths need a leading slash.
function getGuildById(id) {
  const g = liveGuild(id);
  if (!g) return g;
  const fix = (url) => (url && !/^(\/|https?:|data:)/.test(url) ? `/${url}` : url);
  return { ...g, emblem: fix(g.emblem), anthem: fix(g.anthem) };
}

const TEAM = [
  { id: 'c-jb', name: 'Junior B Owls', logo: '🦉', rank: 1, score: 212, goal: 200, progress: 100, level: 4, avgPerHero: 17.7, teamBonus: 10, topSkill: 'teamwork', studentCount: 12 },
  { id: 'c-ja', name: 'Junior B Comets', logo: '☄️', rank: 2, score: 188, goal: 200, progress: 94, level: 4, avgPerHero: 15.7, teamBonus: 5, topSkill: 'creativity', studentCount: 12 },
  { id: 'c-jk', name: 'Junior B Knights', logo: '🛡️', rank: 3, score: 151, goal: 200, progress: 76, level: 3, avgPerHero: 13.7, teamBonus: 0, topSkill: 'focus', studentCount: 11 }
].map((c) => ({ ...c, zone: getQuestMapZoneForProgressPercent(c.progress) }));

const HEROES = [
  { id: 'maria', name: 'Maria', rank: 1, score: 31, stats: { count3: 6, count2: 4, topSkill: 'creativity', uniqueReasons: 4, academicAvg: 94 }, teacherBoon: { stars: 2, reasonText: 'Helped a new classmate every lesson' } },
  { id: 'alex', name: 'Alex', rank: 2, score: 28, stats: { count3: 5, count2: 3, topSkill: 'teamwork', uniqueReasons: 4, academicAvg: 88 } },
  { id: 'eleni', name: 'Eleni', rank: 3, score: 24, stats: { count3: 3, count2: 5, topSkill: 'respect', uniqueReasons: 3, academicAvg: 90 } },
  { id: 'nikos', name: 'Nikos', rank: 4, score: 19, stats: { count3: 2, count2: 4, topSkill: 'focus', uniqueReasons: 3 } },
  { id: 'sofia', name: 'Sofia', rank: 5, score: 16, stats: { count3: 1, count2: 5, topSkill: 'teamwork', uniqueReasons: 2 } },
  { id: 'yannis', name: 'Yannis', rank: 6, score: 12, stats: { count3: 1, count2: 3, topSkill: 'creativity', uniqueReasons: 2 } }
];

const LEARNERS = ['Anna', 'Leo', 'Mia', 'Theo', 'Zoe', 'Nick', 'Ella', 'Sam', 'Iris', 'Max'].map((name) => ({ id: name.toLowerCase(), name }));

function captureScreen(id) {
  const screen = document.getElementById(id);
  if (!screen) return null;
  screen.classList.remove('hidden');
  screen.classList.add('capture-ceremony', 'is-open');
  screen.dataset.tier = 'full';
  return screen;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setCeremonyChrome({ kicker = '', title = '', herald = '', action = '' }) {
  setText('ceremony-subtitle', kicker);
  setText('ceremony-title', title);
  document.getElementById('ceremony-header')?.classList.toggle('is-empty', !kicker && !title);
  setText('ceremony-ai-text', herald);
  document.getElementById('ceremony-ai-box')?.classList.toggle('is-on', Boolean(herald));
  const label = document.querySelector('#ceremony-action-btn .cer-action__label');
  if (label) label.textContent = action;
}

function openReveal(stage) {
  const reveal = stage.querySelector('.cer-reveal');
  reveal?.classList.remove('is-sealed');
  reveal?.classList.add('is-dropping', 'is-breaking', 'is-open', 'is-settled');
  stage.querySelectorAll('.cer-count').forEach((el) => { el.textContent = el.dataset.count; });
}

function crownDuel(stage, type) {
  const duel = stage.querySelector('.cer-duel');
  if (!duel) return;
  duel.classList.add('is-in', 'is-revealed', 'is-podium');
  duel.querySelectorAll('.cer-duelist').forEach((d) => {
    const rank = Number(d.dataset.rank);
    const card = d.querySelector('.cer-card');
    card?.classList.remove('cer-metal--mystery');
    card?.classList.add(`cer-metal--${rank === 1 ? 'gold' : 'silver'}`);
    const plate = card?.querySelector('.cer-card__plate');
    if (plate) plate.innerHTML = `<span>${rank === 1 ? 'Gold' : 'Silver'}</span><b>#${rank}</b>`;
    const count = card?.querySelector('.cer-count');
    if (count) count.textContent = count.dataset.count;
    card?.querySelector('.cer-card__score')?.classList.remove('is-veiled');
    d.classList.add(rank === 1 ? 'is-winner' : 'is-runnerup');
    if (rank === 1) card?.classList.add('is-crowned');
    d.dataset.place = rank === 1 ? '1' : '2';
  });
  if (type === 'student') duel.dataset.type = 'student';
}

function mountArena(scene, realm) {
  const screen = captureScreen('ceremony-screen');
  if (!screen) return null;
  screen.dataset.mode = 'arena';
  screen.dataset.scene = scene;
  screen.dataset.realm = realm;
  screen.dataset.ladder = 'off';
  const backdrop = document.getElementById('ceremony-backdrop');
  if (backdrop && backdrop.dataset.mode !== 'arena') {
    backdrop.innerHTML = arenaBackdropHtml();
    backdrop.dataset.mode = 'arena';
  }
  document.getElementById('gdn-bed-row')?.replaceChildren();
  return document.getElementById('ceremony-stage-area');
}

function mountGarden(scene, realm = 'day') {
  const screen = captureScreen('ceremony-screen');
  if (!screen) return null;
  screen.dataset.mode = 'garden';
  screen.dataset.scene = scene;
  screen.dataset.realm = realm;
  screen.dataset.ladder = 'off';
  const backdrop = document.getElementById('ceremony-backdrop');
  if (backdrop && backdrop.dataset.mode !== 'garden') {
    backdrop.innerHTML = gardenBackdropHtml();
    backdrop.dataset.mode = 'garden';
  }
  return document.getElementById('ceremony-stage-area');
}

function plantBed(count) {
  const row = document.getElementById('gdn-bed-row');
  if (!row) return;
  row.innerHTML = LEARNERS.slice(0, count).map((p, i) => gardenSprigHtml(p, i)).join('');
  row.style.setProperty('--n', String(row.children.length));
  row.querySelectorAll('.gdn-sprig').forEach((s) => s.classList.add('is-planted'));
}

export function attendanceChronicleInnerHtml() {
  return `
        <div class="flex items-center justify-between gap-3 mb-1 rounded-2xl border border-sky-200/85 bg-gradient-to-r from-white/95 via-sky-50/55 to-emerald-50/35 px-3 py-2.5 shadow-md shadow-sky-900/[0.06] backdrop-blur-sm">
            <button type="button" class="w-11 h-11 shrink-0 rounded-xl font-bold text-teal-900 bg-white/85 border border-teal-200/90 shadow-sm" aria-label="Previous month"><i class="fas fa-chevron-left"></i></button>
            <span class="font-title text-lg sm:text-xl md:text-2xl text-slate-800 text-center flex items-center justify-center gap-2 min-w-0 px-2"><i class="fas fa-book-open text-teal-600 shrink-0" aria-hidden="true"></i><span class="truncate">August 2026</span></span>
            <button type="button" class="w-11 h-11 shrink-0 rounded-xl font-bold text-teal-900 bg-white/85 border border-teal-200/90 shadow-sm" disabled aria-label="Next month"><i class="fas fa-chevron-right"></i></button>
        </div>
        <div class="ac-month-rail-wrap">
            <div class="ac-month-rail-caption"><i class="fas fa-th" aria-hidden="true"></i> Month at a glance</div>
            <div class="ac-month-rail-scroll">
                <div class="ac-month-rail" role="list">
                    <div class="ac-day-chip ac-day-chip--lesson" role="listitem"><span class="ac-day-chip-wd">MON</span><span class="ac-day-chip-day">3</span><span class="ac-day-chip-ico" aria-hidden="true">🏫</span></div>
                    <div class="ac-day-chip ac-day-chip--lesson" role="listitem"><span class="ac-day-chip-wd">WED</span><span class="ac-day-chip-day">5</span><span class="ac-day-chip-ico" aria-hidden="true">🏫</span></div>
                    <div class="ac-day-chip ac-day-chip--school_holiday" role="listitem"><span class="ac-day-chip-wd">FRI</span><span class="ac-day-chip-day">14</span><span class="ac-day-chip-ico" aria-hidden="true">🏖️</span></div>
                    <div class="ac-day-chip ac-day-chip--lesson ac-day-chip--today" role="listitem"><span class="ac-day-chip-wd">MON</span><span class="ac-day-chip-day">31</span><span class="ac-day-chip-ico" aria-hidden="true">🏫</span></div>
                </div>
            </div>
        </div>
        <div class="attendance-chronicle-summary-grid">
            <div class="attendance-summary-card attendance-summary-card--emerald">
                <div class="attendance-summary-label">Monthly Attendance</div>
                <div class="attendance-summary-value">94.4%</div>
                <div class="attendance-summary-meta">3 students tracked</div>
            </div>
            <div class="attendance-summary-card attendance-summary-card--blue">
                <div class="attendance-summary-label">Lessons Held</div>
                <div class="attendance-summary-value">4</div>
                <div class="attendance-summary-meta">Includes one-off lesson dates</div>
            </div>
            <div class="attendance-summary-card attendance-summary-card--rose">
                <div class="attendance-summary-label">Total Absences</div>
                <div class="attendance-summary-value">2</div>
                <div class="attendance-summary-meta">Across all students this month</div>
            </div>
            <div class="attendance-summary-card attendance-summary-card--amber">
                <div class="attendance-summary-label">Perfect Attendees</div>
                <div class="attendance-summary-value">1</div>
                <div class="attendance-summary-meta">No absences this month</div>
            </div>
        </div>
        <div class="attendance-chronicle-toolbar">
            <div class="attendance-chronicle-legend">
                <span class="attendance-legend-pill attendance-legend-pill--present"><i class="fas fa-check" aria-hidden="true"></i> Present</span>
                <span class="attendance-legend-pill attendance-legend-pill--absent"><i class="fas fa-times" aria-hidden="true"></i> Absent</span>
                <span class="attendance-legend-pill attendance-legend-pill--map-lesson"><i class="fas fa-school" aria-hidden="true"></i> Scheduled lesson</span>
                <span class="attendance-legend-pill attendance-legend-pill--map-break"><i class="fas fa-umbrella-beach" aria-hidden="true"></i> Break</span>
            </div>
            <div class="attendance-chronicle-mode is-live">
                <i class="fas fa-pen"></i> Live month: tap to edit attendance
            </div>
        </div>
        <div class="attendance-chronicle-table-wrap"><table class="attendance-chronicle-table"><thead><tr>
            <th class="attendance-student-col">Student</th>
            <th class="attendance-date-col"><div class="attendance-date-chip"><span class="attendance-date-chip-day">3</span><span class="attendance-date-chip-weekday">Mon</span><span class="attendance-date-chip-meta">0 absent</span></div></th>
            <th class="attendance-date-col"><div class="attendance-date-chip"><span class="attendance-date-chip-day">5</span><span class="attendance-date-chip-weekday">Wed</span><span class="attendance-date-chip-meta">1 absent</span></div></th>
            <th class="attendance-date-col"><div class="attendance-date-chip"><span class="attendance-date-chip-day">10</span><span class="attendance-date-chip-weekday">Mon</span><span class="attendance-date-chip-meta">1 absent</span></div></th>
            <th class="attendance-date-col attendance-date-col--today"><div class="attendance-date-chip attendance-date-chip--today"><span class="attendance-date-chip-day">31</span><span class="attendance-date-chip-weekday">Mon</span><span class="attendance-date-chip-meta">Today</span></div></th>
            <th class="attendance-summary-col">Absences</th>
            <th class="attendance-summary-col">Attendance %</th>
        </tr></thead><tbody>
            <tr class="attendance-row attendance-row--even">
                <td class="attendance-student-col attendance-student-cell"><div class="attendance-student-meta"><div class="attendance-student-avatar attendance-student-avatar--placeholder">A</div><div class="attendance-student-text"><div class="attendance-student-name font-title">Alex</div><div class="attendance-student-subtitle">4 present lessons</div></div></div></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-status-cell attendance-status-cell--today"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-summary-cell"><span class="attendance-count-pill">0</span></td>
                <td class="attendance-summary-cell"><span class="attendance-rate-pill is-strong">100%</span></td>
            </tr>
            <tr class="attendance-row attendance-row--odd">
                <td class="attendance-student-col attendance-student-cell"><div class="attendance-student-meta"><div class="attendance-student-avatar attendance-student-avatar--placeholder">M</div><div class="attendance-student-text"><div class="attendance-student-name font-title">Maria</div><div class="attendance-student-subtitle">3 present lessons</div></div></div></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-absent bg-red-500" title="Absent"><i class="fas fa-times text-white text-xs"></i></button></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-status-cell attendance-status-cell--today"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-summary-cell"><span class="attendance-count-pill">1</span></td>
                <td class="attendance-summary-cell"><span class="attendance-rate-pill">75%</span></td>
            </tr>
            <tr class="attendance-row attendance-row--even">
                <td class="attendance-student-col attendance-student-cell"><div class="attendance-student-meta"><div class="attendance-student-avatar attendance-student-avatar--placeholder">N</div><div class="attendance-student-text"><div class="attendance-student-name font-title">Nikos</div><div class="attendance-student-subtitle">3 present lessons</div></div></div></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-status-cell"><button type="button" class="attendance-status-btn status-absent bg-red-500" title="Absent"><i class="fas fa-times text-white text-xs"></i></button></td>
                <td class="attendance-status-cell attendance-status-cell--today"><button type="button" class="attendance-status-btn status-present bg-green-500" title="Present"><i class="fas fa-check text-white text-xs"></i></button></td>
                <td class="attendance-summary-cell"><span class="attendance-count-pill">1</span></td>
                <td class="attendance-summary-cell"><span class="attendance-rate-pill">75%</span></td>
            </tr>
        </tbody></table></div>`;
}

export function showCeremony(mode) {
  if (mode === 'intro') {
    const stage = mountArena('intro', 'ember');
    stage.innerHTML = arenaIntroHtml({ monthName: 'May', league: 'Junior B', className: 'Junior B Owls', classLogo: '🦉' });
    setCeremonyChrome({ herald: 'The scrolls are sealed. The arena awaits…', action: 'Start Ceremony' });
    return;
  }
  if (mode === 'team') {
    const stage = mountArena('classes', 'ember');
    stage.innerHTML = arenaRevealHtml(TEAM[2], 'class', { isMyClass: false });
    openReveal(stage);
    setCeremonyChrome({ kicker: 'Team Quest · League Junior B', title: 'The League Rises', herald: 'Junior B Knights walked three quarters of the quest road this month!', action: 'Next' });
    return;
  }
  if (mode === 'duel') {
    const stage = mountArena('duel', 'ember');
    stage.innerHTML = arenaDuelHtml(TEAM[1], TEAM[0], 'class', { myClassId: 'c-jb' });
    crownDuel(stage, 'class');
    document.getElementById('ceremony-screen')?.classList.add('is-revealed');
    setCeremonyChrome({ kicker: 'League Junior B', title: 'Champion of the League', herald: 'Junior B Owls take the league crown!', action: "On to the Hero's Challenge" });
    return;
  }
  if (mode === 'transition') {
    const stage = mountArena('transition', 'violet');
    stage.innerHTML = arenaTransitionHtml();
    setCeremonyChrome({ kicker: 'Individual Honours', title: 'Who went above and beyond?', action: "Begin Hero's Challenge" });
    return;
  }
  if (mode === 'hero') {
    const stage = mountArena('heroes', 'violet');
    stage.innerHTML = arenaDuelHtml(HEROES[1], HEROES[0], 'student');
    crownDuel(stage, 'student');
    document.getElementById('ceremony-screen')?.classList.add('is-revealed');
    setCeremonyChrome({ kicker: 'May · Junior B Owls', title: 'Prodigy of the Month', herald: 'Maria is the Prodigy of the Month!', action: 'Show Final Standings' });
    return;
  }
  if (mode === 'standings') {
    const stage = mountArena('standings', 'violet');
    stage.innerHTML = arenaStandingsHtml(HEROES, { monthName: 'May' });
    setCeremonyChrome({ action: 'Finish Ceremony' });
    return;
  }
  if (mode === 'growth-intro') {
    const stage = mountGarden('gate');
    plantBed(0);
    stage.innerHTML = gardenIntroHtml({ monthName: 'May', className: 'Pre-Junior Bees', classLogo: '🐝' });
    setCeremonyChrome({ herald: 'Welcome to the garden! Every bloom has a story…', action: 'Enter the Garden 🌸' });
    return;
  }
  if (mode === 'growth-garden') {
    const stage = mountGarden('league');
    plantBed(0);
    stage.innerHTML = gardenLeagueHtml([
      { id: 'c-nu2', className: 'Pre-Junior Ducklings', logo: '🐥', progressLabel: 'Growing steadily', topSkill: 'creativity' },
      { id: 'c-nu3', className: 'Pre-Junior Ladybirds', logo: '🐞', progressLabel: 'Blooming brightly', topSkill: 'respect' },
      { id: 'c-nu', className: 'Pre-Junior Bees', logo: '🐝', progressLabel: 'Reaching for the sun', topSkill: 'teamwork' }
    ], { pathfinderId: 'c-nu', myClassId: 'c-nu' });
    stage.querySelectorAll('.gdn-planter').forEach((el) => el.classList.add('is-grown'));
    setCeremonyChrome({ kicker: 'Our League Garden', title: 'Every class grows in its own way', herald: 'Look how our league garden is blossoming together! 🌸', action: 'Explore Our Blooms 🌸' });
    return;
  }
  if (mode === 'growth-bloom') {
    const stage = mountGarden('parade');
    plantBed(3);
    stage.innerHTML = gardenParadeHtml({ studentId: 'mia', studentName: 'Mia', key: 'growing_stronger', publicText: 'Mia tried new words every lesson and helped our garden grow stronger.' }, { index: 3, total: 10, person: LEARNERS[2] });
    const parade = stage.querySelector('.gdn-parade');
    parade?.classList.add('is-seeded', 'is-sprouting', 'is-budding', 'is-bloomed', 'is-told');
    stage.querySelector('.gdn-grow__head .gdn-bloom')?.classList.add('is-open');
    setCeremonyChrome({ kicker: 'Parade of Blooms', title: 'A special part of our garden', action: 'Next Bloom 🌸' });
    return;
  }
  if (mode === 'growth-finale') {
    const stage = mountGarden('finale');
    plantBed(10);
    stage.innerHTML = gardenFinaleHtml([{ id: 'mia', name: 'Mia' }], { classLogo: '🐝', className: 'Pre-Junior Bees' });
    const finale = stage.querySelector('.gdn-finale');
    finale?.classList.add('is-growing', 'is-glowing', 'is-open');
    finale?.querySelectorAll('.gdn-bloom').forEach((b) => b.classList.add('is-open'));
    setCeremonyChrome({ kicker: 'Prodigy of the Month', title: 'Our Golden Bloom', herald: 'Mia is our Golden Bloom this month! 🌼', action: 'Finish Ceremony 🌿' });
  }
}

export function hideCeremony() {
  const screen = document.getElementById('ceremony-screen');
  screen?.classList.add('hidden');
  screen?.classList.remove('capture-ceremony', 'is-open', 'is-revealed');
}

const GRAND_ROWS = [
  { guildId: 'owl_wisdom', crowns: 21, chapterWins: ['m2025_09', 'm2025_12', 'm2026_02', 'm2026_04'] },
  { guildId: 'dragon_flame', crowns: 18, chapterWins: ['m2025_10', 'm2026_03'] },
  { guildId: 'phoenix_rising', crowns: 15, chapterWins: ['m2025_11', 'm2026_01'] },
  { guildId: 'grizzly_might', crowns: 11, chapterWins: ['m2026_05'] }
].map((row, i) => ({ ...row, rank: i + 1, guild: getGuildById(row.guildId), guildName: getGuildById(row.guildId)?.name }));

function setGrandChrome({ scene, realm, kicker = '', title = '', herald = '', action = '' }) {
  const screen = captureScreen('grand-guild-ceremony-screen');
  if (!screen) return null;
  screen.dataset.scene = scene;
  screen.dataset.realm = realm;
  const backdrop = document.getElementById('grd-backdrop');
  if (backdrop && !backdrop.childElementCount) backdrop.innerHTML = grandBackdropHtml(GUILD_IDS.map(getGuildById));
  const chapters = document.getElementById('grd-chapters');
  if (chapters) {
    const at = GRAND_CHAPTERS.findIndex((c) => c.key === (scene === 'champion' ? 'guilds' : scene));
    chapters.innerHTML = GRAND_CHAPTERS.map((c, i) => `<li class="${i < at ? 'is-done' : i === at ? 'is-on' : ''}" title="${c.title}"><i class="fas ${c.icon}" aria-hidden="true"></i><span>${c.numeral}</span></li>`).join('');
  }
  setText('grd-kicker', kicker);
  setText('grd-title', title);
  document.getElementById('grd-header')?.classList.toggle('is-empty', !kicker && !title);
  setText('grd-herald-text', herald);
  document.getElementById('grd-herald')?.classList.toggle('is-on', Boolean(herald));
  const label = document.querySelector('#grd-action-btn .grd-action__label');
  if (label) label.textContent = action;
  return document.getElementById('grd-stage');
}

export function showGrandCeremony(mode) {
  if (mode === 'opening') {
    const stage = setGrandChrome({ scene: 'opening', realm: 'dusk', herald: 'The lanterns are lit. Welcome to the end-of-year festival!', action: 'Begin the Festival' });
    stage.innerHTML = grandOpeningHtml({
      yearLabel: '2025–26',
      classes: [{ name: 'Junior B Owls', logo: '🦉' }, { name: 'Junior B Comets', logo: '☄️' }, { name: 'Pre-Junior Bees', logo: '🐝' }, { name: 'Class C Dragons', logo: '🐲' }],
      guilds: GUILD_IDS.map(getGuildById)
    });
    return;
  }
  if (mode === 'prodigies') {
    const stage = setGrandChrome({ scene: 'prodigies', realm: 'dusk', kicker: 'Chapter III · The Crown Road', title: 'A crown for every month', action: 'Wonders of the Year' });
    const months = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
    const names = [['Maria'], ['Alex'], ['Eleni', 'Nikos'], ['Maria'], ['Sofia'], ['Alex'], ['Maria'], ['Yannis'], ['Zoe']];
    stage.innerHTML = grandProdigyRoadHtml(months.map((monthKey, i) => ({ monthKey, winners: names[i].map((name) => ({ name })) })), { mostCrowned: [{ name: 'Maria' }], mostCount: 3 });
    stage.querySelectorAll('.grd-month, .grd-crowned').forEach((el) => el.classList.add('is-shown'));
    return;
  }
  if (mode === 'crowning') {
    const stage = setGrandChrome({ scene: 'guilds', realm: 'night', kicker: 'Guild Champions of the Year', title: GRAND_ROWS[0].guildName, action: `Hear the ${GRAND_ROWS[0].guildName} anthem` });
    const display = GUILD_IDS.map((id) => GRAND_ROWS.find((r) => r.guildId === id));
    stage.innerHTML = grandGuildPillarsHtml(display, { maxCrowns: GRAND_ROWS[0].crowns });
    stage.querySelector('.grd-pillars')?.classList.add('is-rising', 'is-crowned');
    stage.querySelectorAll('.grd-pillar').forEach((el) => el.classList.add('is-revealed'));
    stage.querySelector('.grd-pillar[data-rank="1"]')?.classList.add('is-champion');
    stage.querySelectorAll('.grd-count').forEach((el) => { el.textContent = el.dataset.count; });
    document.getElementById('grand-guild-ceremony-screen')?.classList.add('is-revealed');
    return;
  }
  if (mode === 'champion') {
    const champion = GRAND_ROWS[0];
    const stage = setGrandChrome({ scene: 'champion', realm: 'night', herald: `“${champion.guild?.motto || ''}”`, action: 'Enter the Hall of Heroes' });
    stage.innerHTML = grandChampionHtml(champion, { heroes: [{ name: 'Maria' }, { name: 'Alex' }, { name: 'Eleni' }] });
    const lines = stage.querySelectorAll('.grd-lyrics li');
    lines.forEach((li, i) => { if (i < 3) li.classList.add('is-sung'); });
    lines[2]?.classList.add('is-now');
  }
}

export function hideGrandCeremony() {
  const screen = document.getElementById('grand-guild-ceremony-screen');
  screen?.classList.add('hidden');
  screen?.classList.remove('capture-ceremony', 'is-open', 'is-revealed');
}

export function showAttendanceChronicle() {
  const modal = document.getElementById('attendance-chronicle-modal');
  const title = document.getElementById('attendance-chronicle-title');
  const content = document.getElementById('attendance-chronicle-content');
  if (!modal || !content) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-ac');
  if (title) title.innerHTML = '📚 Attendance Chronicle';
  content.innerHTML = attendanceChronicleInnerHtml();
}

export function hideAttendanceChronicle() {
  document.getElementById('attendance-chronicle-modal')?.classList.add('hidden');
  document.getElementById('attendance-chronicle-modal')?.classList.remove('capture-ac');
}
