/**
 * Recently redesigned screens for guidebook capture: Post a Bounty poster, Adventurer's Passport,
 * Avatar Forge, class charter and emblem case, guild banner and anthem alcove, Teacher Boon, Hero's Boon,
 * and the Secretary Office (front desk and Students & Classes).
 *
 * Every screen is drawn by the app's own templates and renderers, fed with fake state.
 * capture-ui.mjs fixes the page clock (Monday 28 September 2026, 10:15) before these run,
 * so "today", the Teacher Boon window and the office greeting are stable.
 */

import * as state from '../../../../state.js';
import { applySubscriptionPreview } from '../../../../utils/subscription.js';
import { classModalsHTML } from '../../../../templates/modals/class.js';
import { baseModalsHTML } from '../../../../templates/modals/base.js';
import { roleShellsHTML } from '../../../../templates/roles.js';
import { hideAppScreen, hideExtras } from './fill-extras.js';

const CLASS_ID = 'guide-jb';
const TEACHER = { uid: 'guide-teacher', name: 'Ms Eleftheriou' };
const YEAR = '2026-2027';

function face(emoji, bg) {
  return 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="' + bg + '"/><text x="32" y="44" font-size="32" text-anchor="middle">' + emoji + '</text></svg>'
  );
}

const CLASSES = [
  {
    id: CLASS_ID, name: 'Junior B', logo: '📚', questLevel: 'Junior B', schoolYearKey: YEAR,
    scheduleDays: ['1', '3'], timeStart: '09:40', timeEnd: '10:40', createdBy: TEACHER, teacherBoons: {}
  },
  {
    id: 'guide-ja', name: 'Junior A Foxes', logo: '🦊', questLevel: 'Junior A', schoolYearKey: YEAR,
    scheduleDays: ['2', '4'], timeStart: '16:00', timeEnd: '17:00', createdBy: { uid: 'guide-t2', name: 'Mr Karras' }
  },
  {
    id: 'guide-b', name: 'B Explorers', logo: '🚀', questLevel: 'B', schoolYearKey: YEAR,
    scheduleDays: ['1', '5'], timeStart: '18:00', timeEnd: '19:15', createdBy: TEACHER
  }
];

const STUDENTS = [
  { id: 'guide-alex', name: 'Alex', classId: CLASS_ID, guildId: 'dragon_flame', heroClass: 'Guardian', avatar: face('🦊', '#fde68a'), birthday: '2017-03-14', nameday: '2017-08-30' },
  { id: 'guide-maria', name: 'Maria', classId: CLASS_ID, guildId: 'owl_wisdom', heroClass: 'Sage', avatar: face('🐼', '#bfdbfe') },
  { id: 'guide-nikos', name: 'Nikos', classId: CLASS_ID, guildId: 'grizzly_might', heroClass: 'Artificer' },
  { id: 'guide-eleni', name: 'Eleni', classId: CLASS_ID, guildId: 'phoenix_rising', heroClass: 'Weaver', avatar: face('🐯', '#fed7aa') },
  { id: 'guide-sofia', name: 'Sofia', classId: CLASS_ID, guildId: 'owl_wisdom' },
  { id: 'guide-yannis', name: 'Yannis', classId: CLASS_ID, guildId: 'dragon_flame', avatar: face('🐸', '#bbf7d0') },
  { id: 'guide-sam', name: 'Sam', classId: 'guide-ja', heroClass: 'Paladin' },
  { id: 'guide-robin', name: 'Robin', classId: 'guide-ja', avatar: face('🦁', '#fecdd3') },
  { id: 'guide-dimitra', name: 'Dimitra', classId: 'guide-b', heroClass: 'Scholar' },
  { id: 'guide-kostas', name: 'Kostas', classId: 'guide-b' },
  { id: 'guide-petros', name: 'Petros', classId: null, enrollmentStatus: 'pendingPlacement', previousClassName: 'Junior A Foxes' }
];

const SCORES = [
  { id: 'guide-alex', totalStars: 86, monthlyStars: 18, gold: 42, heroLevel: 3 },
  { id: 'guide-maria', totalStars: 94, monthlyStars: 21, gold: 55, heroLevel: 3 },
  { id: 'guide-nikos', totalStars: 61, monthlyStars: 14, gold: 30, heroLevel: 2 },
  { id: 'guide-eleni', totalStars: 72, monthlyStars: 16, gold: 38, heroLevel: 2 },
  { id: 'guide-sofia', totalStars: 48, monthlyStars: 11, gold: 21, heroLevel: 2 },
  { id: 'guide-yannis', totalStars: 39, monthlyStars: 9, gold: 17, heroLevel: 1 },
  { id: 'guide-sam', totalStars: 52, monthlyStars: 12, gold: 24 },
  { id: 'guide-robin', totalStars: 44, monthlyStars: 10, gold: 19 },
  { id: 'guide-dimitra', totalStars: 67, monthlyStars: 15, gold: 33 },
  { id: 'guide-kostas', totalStars: 58, monthlyStars: 13, gold: 26 }
];

/** Lesson days of star awards so the poster's smart picks have a real median to work from. */
function recentAwardLogs() {
  const days = ['14-09-2026', '16-09-2026', '21-09-2026', '23-09-2026'];
  const perDay = [15, 17, 16, 18];
  return days.flatMap((date, i) => Array.from({ length: perDay[i] }, (_, n) => ({
    classId: CLASS_ID, date, stars: 1, studentId: STUDENTS[n % 6].id, reason: 'teamwork'
  })));
}

/** One fake Elite school, shared by every redesigned screen. Re-seeded each time: older fills overwrite state. */
export function seedSchool() {
  applySubscriptionPreview({ tier: 'elite' });
  state.set('schoolYearState', { activeYearKey: YEAR, closeDate: '2027-06-18' });
  state.set('allSchoolYears', [{ id: YEAR, startsAt: '2026-09-07' }]);
  state.set('allSchoolClasses', CLASSES.map((c) => ({ ...c })));
  state.set('allTeachersClasses', CLASSES.filter((c) => c.createdBy === TEACHER).map((c) => ({ ...c })));
  state.set('allStudents', STUDENTS.map((s) => ({ ...s })));
  state.set('allStudentScores', SCORES.map((s) => ({ ...s })));
  state.set('allAwardLogs', recentAwardLogs());
  state.set('allQuestBounties', []);
  state.set('globalSelectedClassId', CLASS_ID);
  state.set('schoolName', 'Northwind Language School');
  state.set('currentUserProfile', { displayName: 'Katerina' });
  state.set('allWrittenScores', [
    { id: 'ws1', studentId: 'guide-maria', classId: CLASS_ID, date: '2026-09-23', type: 'test', title: 'Unit 1 Test', scoreNumeric: 92, maxScore: 100 }
  ]);
  state.set('currentCommunicationThreads', [
    { id: 'th1', studentId: 'guide-nikos', classId: CLASS_ID, threadType: 'meeting-request', lastMessageAt: 2, lastReadAt: 1 },
    { id: 'th2', studentId: 'guide-eleni', classId: CLASS_ID, threadType: 'celebration', lastMessageAt: 1, lastReadAt: 1 }
  ]);
  state.set('allHeroChronicleNotes', []);
}

function fixAssetUrls(root) {
  if (!root) return;
  root.querySelectorAll('img[src^="./assets/"]').forEach((img) => {
    img.setAttribute('src', img.getAttribute('src').replace(/^\.\//, '/'));
  });
}

function lift(html, id) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  return doc.getElementById(id)?.outerHTML || '';
}

export function redesignShellHtml() {
  return lift(classModalsHTML, 'create-class-modal')
    + lift(baseModalsHTML, 'logo-picker-modal')
    + lift(roleShellsHTML, 'secretary-screen');
}

const CAPTURE_TARGETS = [
  ['create-bounty-modal', 'capture-bp'],
  ['edit-student-modal', 'capture-sp'],
  ['avatar-maker-modal', 'capture-af'],
  ['create-class-modal', 'capture-cc'],
  ['logo-picker-modal', 'capture-lp'],
  ['guild-lore-overlay', 'capture-lore'],
  ['guild-anthem-overlay', 'capture-anthem'],
  ['teacher-boon-modal', 'capture-tb'],
  ['bestow-boon-modal', 'capture-hb'],
  ['secretary-screen', 'capture-office']
];

export function hideRedesign() {
  for (const [id, cls] of CAPTURE_TARGETS) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.classList.add('hidden');
    el.classList.remove(cls, 'capture-modal');
  }
}

function startShow() {
  hideExtras();
  hideRedesign();
  hideAppScreen();
  seedSchool();
}

function frame(id, cls) {
  const el = document.getElementById(id);
  if (!el) return null;
  el.classList.remove('hidden');
  el.classList.add('capture-modal', cls);
  return el;
}

/** Wait out the open-time focus (the app focuses a field on the next frame), then drop it. */
async function settleFocus() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  document.activeElement?.blur?.();
}

function type(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

// ── Post a Bounty ────────────────────────────────────────────────────────────

export async function showBountyPoster(mode = 'standard') {
  startShow();
  try { localStorage.setItem('gcq.bountyPoster.mode', mode); } catch { /* capture only */ }
  const { prepareBountyPoster, setupBountyPoster } = await import('../../../../ui/modals/bountyPoster.js');
  setupBountyPoster();
  prepareBountyPoster(CLASS_ID);
  if (mode === 'timer') {
    type('bounty-title', 'Rapid Clean Up');
    document.querySelector('#bounty-smart-options [data-bell="1"]')?.click();
  } else {
    type('bounty-title', 'English Only');
    type('bounty-reward', 'Music while we work');
  }
  frame('create-bounty-modal', 'capture-bp');
}

// ── Adventurer's Passport ────────────────────────────────────────────────────

export async function showPassport() {
  startShow();
  const { openEditStudentModal } = await import('../../../../ui/modals/student.js');
  openEditStudentModal('guide-alex');
  const modal = frame('edit-student-modal', 'capture-sp');
  modal?.querySelector('.sp-spread')?.scrollTo({ top: 0 });
}

// ── Avatar Forge ─────────────────────────────────────────────────────────────

export async function showAvatarForge() {
  startShow();
  const { openAvatarMaker } = await import('../../../../features/avatar.js');
  openAvatarMaker('guide-nikos');
  const modal = frame('avatar-maker-modal', 'capture-af');
  const wrapper = document.getElementById('avatar-maker-options-wrapper');
  if (wrapper) wrapper.scrollTop = 0;
  return modal;
}

// ── Add New Class charter and the emblem case ────────────────────────────────

export async function showClassCharter() {
  startShow();
  const { openCreateClassModal } = await import('../../../../ui/modals/class.js');
  openCreateClassModal({ league: 'Junior B' });
  type('class-name', 'The Star Seekers');
  const logo = document.getElementById('class-logo');
  const btn = document.getElementById('logo-picker-btn');
  if (logo) logo.value = '🦉';
  if (btn) btn.innerText = '🦉';
  document.querySelectorAll('#create-class-modal input[name="schedule-day"]').forEach((box) => {
    box.checked = box.value === '1' || box.value === '3';
  });
  const start = document.getElementById('class-time-start');
  const end = document.getElementById('class-time-end');
  if (start) start.value = '09:40';
  if (end) end.value = '10:40';
  await settleFocus();
  frame('create-class-modal', 'capture-cc');
}

export async function showEmblemCase() {
  startShow();
  const logo = document.getElementById('class-logo');
  const btn = document.getElementById('logo-picker-btn');
  if (logo) logo.value = '🦉';
  if (btn) btn.innerText = '🦉';
  const { showLogoPicker } = await import('../../../../ui/modals/base.js');
  showLogoPicker('create');
  const modal = frame('logo-picker-modal', 'capture-lp');
  await settleFocus();
  const list = document.getElementById('logo-picker-list');
  if (list) list.scrollTop = 0;
  return modal;
}

// ── Guild banner and anthem alcove ───────────────────────────────────────────

function toBody(id) {
  const el = document.getElementById(id);
  if (el && el.parentElement !== document.body) document.body.appendChild(el);
  return el;
}

export async function showGuildBanner(guildId = 'dragon_flame') {
  startShow();
  const { fillGuildLoreCard } = await import('../../../../ui/tabs/guilds.js');
  toBody('guild-lore-overlay');
  fillGuildLoreCard(guildId, {
    memberCount: 7,
    totalStars: 142,
    perCapitaStars: 20.3,
    guildPower: 78,
    totalGlory: 318,
    weeklyGlory: 36,
    perCapitaGlory: 45.4,
    weeklyPerCapitaGlory: 5.1
  }, { seasonLive: true });
  const overlay = frame('guild-lore-overlay', 'capture-lore');
  fixAssetUrls(overlay);
}

export async function showGuildAnthem(guildId = 'owl_wisdom') {
  startShow();
  const { fillGuildAnthemCard } = await import('../../../../ui/tabs/guilds.js');
  toBody('guild-anthem-overlay');
  fillGuildAnthemCard(guildId);
  const card = document.getElementById('guild-anthem-card');
  const emblem = card?.style.getPropertyValue('--anthem-emblem');
  if (card && emblem) card.style.setProperty('--anthem-emblem', emblem.replace('"./assets/', '"/assets/'));
  // Mid-song, as the karaoke sync would leave it: one line lit, the ones before it sung.
  const lines = [...document.querySelectorAll('#guild-anthem-lyrics .guild-anthem-line')];
  lines.forEach((line, i) => {
    line.classList.toggle('karaoke-past', i < 2);
    line.classList.toggle('karaoke-active', i === 2);
    line.classList.toggle('karaoke-upcoming', i > 2);
  });
  frame('guild-anthem-overlay', 'capture-anthem');
}

// ── Teacher Boon ─────────────────────────────────────────────────────────────

export async function showTeacherBoon() {
  startShow();
  const { openTeacherBoonModal, wireTeacherBoonModal } = await import('../../../../ui/modals/teacherBoon.js');
  wireTeacherBoonModal();
  openTeacherBoonModal();
  const modal = frame('teacher-boon-modal', 'capture-tb');
  modal?.querySelector('[data-teacher-boon-student="guide-maria"]')?.click();
  document.getElementById('teacher-boon-next-btn')?.click();
  modal?.querySelector('[data-teacher-boon-preset="perseverance"]')?.click();
  document.getElementById('teacher-boon-next-btn')?.click();
}

// ── Hero's Boon ──────────────────────────────────────────────────────────────

/** Yannis (fewest stars) receives; Alex has a free boon, Sofia gave him the last one, Nikos is short of Gold. */
export async function showHeroBoon() {
  startShow();
  const scores = state.get('allStudentScores').map((s) => {
    if (s.id === 'guide-alex') return { ...s, peerBoonFreeUses: 1 };
    if (s.id === 'guide-sofia') return { ...s, lastPeerBoonRecipientId: 'guide-yannis' };
    if (s.id === 'guide-nikos') return { ...s, gold: 9 };
    return s;
  });
  state.set('allStudentScores', scores);
  state.set('allAwardLogs', [
    ...state.get('allAwardLogs'),
    { classId: CLASS_ID, date: '28-09-2026', stars: 0.5, studentId: 'guide-nikos', giverId: 'guide-maria', reason: 'peer_boon' }
  ]);
  const { openBestowBoonModal } = await import('../../../../ui/modals/rankings.js');
  openBestowBoonModal('guide-yannis');
  const modal = frame('bestow-boon-modal', 'capture-hb');
  modal?.querySelector('.hb-tile[data-id="guide-maria"]')?.click();
  await settleFocus();
}

// ── Secretary Office ─────────────────────────────────────────────────────────

const FORMER = [
  { id: 'guide-lina', name: 'Lina', enrollmentStatus: 'inactive', leftReason: 'moved', leftSchoolAt: '2026-06-20', formerClassName: 'Junior A Foxes', formerTeacher: { name: 'Mr Karras' }, leftNote: 'Family moved to Thessaloniki.' },
  { id: 'guide-marios', name: 'Marios', enrollmentStatus: 'inactive', leftReason: 'graduated', leftSchoolAt: '2026-06-12', formerClassName: 'Proficiency', formerTeacher: { name: 'Ms Eleftheriou' } },
  { id: 'guide-zoe', name: 'Zoe', enrollmentStatus: 'inactive', leftReason: 'other', leftSchoolAt: '2026-05-30', formerClassName: 'B Explorers' }
];

export async function showOffice(view = 'home') {
  startShow();
  const { previewFormerStudents } = await import('../../../../features/secretary/formerStudents.js');
  previewFormerStudents(FORMER);
  const tab = view === 'registry' ? 'admin' : 'home';
  state.setSecretaryView({ activeTab: tab, adminSubTab: 'registry', registryLane: 'students', registrySearch: '' });
  const screen = document.getElementById('secretary-screen');
  screen?.classList.remove('hidden');
  screen?.classList.add('capture-office');
  if (!screen) return;
  screen.querySelectorAll('[data-secretary-section]').forEach((section) => {
    section.classList.toggle('hidden', section.dataset.secretarySection !== tab);
  });
  screen.querySelectorAll('[data-secretary-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.secretaryTab === tab);
  });
  const { renderSecretaryConsole } = await import('../../../../features/secretaryConsole.js');
  renderSecretaryConsole(tab);
  const schoolName = screen.querySelector('[data-school-name]');
  if (schoolName) schoolName.textContent = 'Northwind Language School';
}

// ── Adventure Log diary ──────────────────────────────────────────────────────

const DIARY_PAGES = [
  {
    id: 'guide-log-today', classId: CLASS_ID, date: '28-09-2026', entryMode: 'manual',
    title: 'The Owls Found Their Voice', hero: 'Maria', heroStudentId: 'guide-maria', totalStars: 17,
    text: 'Junior B worked in pairs to describe their families. Maria helped Nikos find the right words, and the whole class cheered when Eleni read her sentence aloud without a single pause.',
    highlights: ['Teamwork', 'Reading aloud', 'Hero of the Day'],
    keywords: ['family', 'teamwork'],
    learnedToday: { items: [{ source: 'teacher', label: 'Unit 1: My family' }, { source: 'quiz', label: 'Family words' }], words: ['brother', 'aunt', 'cousin'] },
    note: 'Lovely patience today. Keep the pairs for Wednesday.', noteBy: 'Ms Eleftheriou'
  },
  {
    id: 'guide-log-wed', classId: CLASS_ID, date: '23-09-2026', entryMode: 'manual',
    title: 'A Map of Our Classroom', hero: 'Alex', heroStudentId: 'guide-alex', totalStars: 15,
    text: 'We labelled everything in the room in English. Alex led the recap and remembered every new word.',
    highlights: ['Focus', 'New words'],
    keywords: ['classroom'],
    learnedToday: { words: ['desk', 'board', 'shelf'] }
  }
];

export async function showAdventureLogDiary(entry = 'oaths') {
  startShow();
  const tab = document.getElementById('adventure-log-tab');
  if (!tab) return;
  state.set('allAdventureLogs', DIARY_PAGES.map((p) => ({ ...p })));
  state.set('todaysStars', { 'guide-maria': { stars: 3 }, 'guide-alex': { stars: 2 } });
  state.set('currentLogFilter', { classId: CLASS_ID, month: '' });
  tab.classList.remove('hidden');
  tab.classList.add('capture-log');
  const month = document.getElementById('adventure-log-month-filter');
  if (month) month.innerHTML = '';
  const { renderAdventureLogTab } = await import('../../../../ui/tabs/log.js');
  await renderAdventureLogTab();
  tab.querySelectorAll('.diary-page.pop-in-start').forEach((page) => page.classList.remove('pop-in-start'));
  tab.querySelectorAll('.al-fab-cluster, .tab-fab-cluster').forEach((el) => el.classList.add('revealed'));
  const actions = tab.querySelector('.al-primary-actions');
  actions?.querySelector(':scope > .campfire-entry')?.remove();
  if (actions) {
    const { campfireChipMarkup, oathsButtonMarkup } = await import('../../../../features/campfireEntry.js');
    const wrap = document.createElement('div');
    wrap.className = 'campfire-entry';
    wrap.innerHTML = entry === 'gather'
      ? campfireChipMarkup({ igniting: true })
      : oathsButtonMarkup({ ready: 2 });
    actions.append(wrap);
  }
}
