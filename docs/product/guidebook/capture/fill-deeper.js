/** Extra live chrome: Scroll bulk, Starfall, Story Weavers, Settings, Guild Quiz, Guild Hall, Calendar, Quiz play. */

import { ideasTabHTML } from '../../../../templates/app/tabs/ideas.js';
import { optionsTabHTML } from '../../../../templates/app/tabs/options.js';
import { studentsTabHTML } from '../../../../templates/app/tabs/students.js';
import { guildsTabHTML } from '../../../../templates/app/tabs/guilds.js';
import { calendarTabHTML } from '../../../../templates/app/tabs/calendar.js';
import { sortingQuizModalsHTML } from '../../../../templates/modals/sortingQuiz.js';
import { miscModalsHTML } from '../../../../templates/modals/misc.js';
import { plannerModalHTML } from '../../../../templates/modals/planner.js';
import { specialQuestModalHTML } from '../../../../templates/modals/specialQuest.js';
import { GUILDS, getGuildBadgeHtml, getGuildEmblemUrl } from '../../../../features/guilds.js';
import { hideAppScreen, hideExtras, onHideExtras } from './fill-extras.js';
import { classroomShellHtml, hideClassroom } from './fill-classroom.js';
import { hideSurfaces, surfacesShellHtml } from './fill-surfaces.js';

function assetUrl(url) {
  return String(url || '').replace(/^\.\//, '/');
}

function quizPlayShellHtml() {
  return `
    <div id="quiz-of-week-modal" class="fixed inset-0 z-[90] flex items-center justify-center p-3 hidden backdrop-blur-sm">
        <div id="quiz-modal-inner" class="quiz-modal-inner">
            <div id="quiz-modal-content" class="quiz-modal-stage"></div>
        </div>
    </div>`;
}

export function deeperShellHtml() {
  return `${miscModalsHTML}${sortingQuizModalsHTML}${plannerModalHTML}${specialQuestModalHTML}<div id="capture-sq-projector" class="hidden"></div>${quizPlayShellHtml()}${ideasTabHTML}${optionsTabHTML}${studentsTabHTML}${guildsTabHTML}${calendarTabHTML}${classroomShellHtml()}${surfacesShellHtml()}`;
}

export function hideDeeper() {
  hideBulkTrial();
  hideStarfall();
  hideStoryWeavers();
  hideSettings();
  hideRoster();
  hideChronicle();
  hideSortingQuiz();
  hideGuildHall();
  hideCalendar();
  hideDayPlanner();
  hideQuizPlay();
  hideSpecialQuestRunner();
  hideSpecialQuestProjector();
  hideClassroom();
  hideSurfaces();
}

onHideExtras(hideDeeper);

function startShow() {
  hideExtras();
  hideAppScreen();
}

export function showBulkTrial() {
  startShow();
  const modal = document.getElementById('bulk-trial-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-bulk');
  const title = document.getElementById('bulk-trial-title');
  const subtitle = document.getElementById('bulk-trial-subtitle');
  const date = document.getElementById('bulk-trial-date-display');
  if (title) title.textContent = 'Log Results';
  if (subtitle) subtitle.textContent = 'Junior B · Dictation';
  if (date) date.textContent = '30/08/2026';
  const list = document.getElementById('bulk-student-list');
  if (!list) return;
  const pills = (active) => `
            <div class="grade-pills-wrapper">
                <div class="grade-pills-grid">
                    <button type="button" class="grade-pill grade-pill--emerald${active === 'Great!!!' ? ' active' : ''}">Great!!!</button>
                    <button type="button" class="grade-pill grade-pill--teal${active === 'Great!!' ? ' active' : ''}">Great!!</button>
                    <button type="button" class="grade-pill grade-pill--amber${active === 'Great!' ? ' active' : ''}">Great!</button>
                    <button type="button" class="grade-pill grade-pill--rose${active === 'Nice Try!' ? ' active' : ''}">Nice Try!</button>
                </div>
            </div>`;
  const row = (name, initial, present, grade) => `
        <div class="bulk-log-item bg-white/80 p-4 rounded-2xl shadow-sm flex items-center gap-3 border border-amber-200/60 ${present ? '' : 'absent'}">
            <div class="w-11 h-11 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-amber-800 font-black shadow-sm ring-1 ring-amber-200/60">${initial}</div>
            <div class="flex-grow min-w-0">
                <p class="font-bold text-gray-800 truncate">${name}</p>
                <button type="button" class="toggle-absent-btn text-xs px-2.5 py-1.5 rounded-full mt-1 ${present ? 'bg-emerald-500 text-white' : 'is-absent bg-red-500 text-white'} shadow-sm">
                    ${present ? '<i class="fas fa-user-check"></i> Present' : '<i class="fas fa-user-slash"></i> Absent'}
                </button>
            </div>
            <div class="w-36 grade-input-wrapper">${present ? pills(grade) : ''}</div>
        </div>`;
  list.innerHTML = [
    row('Alex', 'A', true, 'Great!!!'),
    row('Maria', 'M', true, 'Great!!'),
    row('Nikos', 'N', false, ''),
    row('Eleni', 'E', true, 'Great!')
  ].join('');
}

export function hideBulkTrial() {
  const modal = document.getElementById('bulk-trial-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-bulk');
}

export function showStarfall() {
  startShow();
  const modal = document.getElementById('starfall-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-starfall');
  document.getElementById('starfall-single-view')?.classList.add('hidden');
  document.getElementById('starfall-batch-view')?.classList.remove('hidden');
  const list = document.getElementById('starfall-batch-list');
  if (list) {
    list.innerHTML = `
        <div class="flex justify-between items-center p-2 border-b border-white/20 last:border-0">
            <span class="font-semibold text-white">Alex</span>
            <span class="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">+1 ⭐</span>
        </div>
        <div class="flex justify-between items-center p-2 border-b border-white/20 last:border-0">
            <span class="font-semibold text-white">Maria</span>
            <span class="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">+1 ⭐</span>
        </div>`;
  }
}

export function hideStarfall() {
  const modal = document.getElementById('starfall-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-starfall');
}

export function showStoryWeavers() {
  startShow();
  const tab = document.getElementById('reward-ideas-tab');
  if (!tab) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-story');
  document.getElementById('story-weavers-placeholder')?.classList.add('hidden');
  document.getElementById('story-weavers-main-content')?.classList.remove('hidden');
  const word = document.getElementById('story-weavers-word-input');
  if (word) word.value = 'luminous';
  document.getElementById('story-weavers-confirm-word-btn')?.classList.remove('hidden');
  const line = document.getElementById('story-weavers-text');
  if (line) {
    line.textContent = 'The luminous lantern woke the harbour, and even the shyest fisher found a sentence to add.';
  }
}

export function hideStoryWeavers() {
  const tab = document.getElementById('reward-ideas-tab');
  tab?.classList.add('hidden');
  tab?.classList.remove('capture-story');
}

function activateOptionsSection(key) {
  document.querySelectorAll('#options-tab .options-subtab-btn').forEach((btn) => {
    btn.classList.toggle('options-subtab-active', btn.dataset.optionsTab === key);
  });
  document.querySelectorAll('#options-tab [data-options-section]').forEach((sec) => {
    const on = sec.dataset.optionsSection === key;
    sec.classList.toggle('hidden', !on);
    sec.classList.toggle('options-section-visible', on);
  });
  const active = document.querySelector(`#options-tab .options-subtab-btn[data-options-tab="${key}"]`);
  const wrap = document.getElementById('options-subtab-select');
  const iconEl = document.getElementById('options-subtab-trigger-icon');
  const labelEl = document.getElementById('options-subtab-trigger-label');
  if (wrap) wrap.dataset.activeTab = key;
  if (iconEl) {
    const icon = active?.querySelector('i')?.className || 'fas fa-tools';
    iconEl.innerHTML = `<i class="${icon}"></i>`;
  }
  if (labelEl) labelEl.textContent = (active?.textContent || '').replace(/\s+/g, ' ').trim() || 'Student Tools';
}

function fillStudentTools() {
  const starSelect = document.getElementById('star-manager-student-select');
  if (starSelect) {
    starSelect.innerHTML = '<option value="alex" selected>Alex</option><option value="maria">Maria</option>';
    starSelect.disabled = false;
  }
  const date = document.getElementById('star-manager-date');
  if (date) {
    date.value = '2026-08-30';
    date.disabled = false;
  }
  const stars = document.getElementById('star-manager-stars-to-add');
  if (stars) stars.disabled = false;
}

function fillMyClasses() {
  const list = document.getElementById('class-list');
  if (!list) return;
  list.innerHTML = `
            <div class="relative bg-white/70 backdrop-blur-xl p-6 rounded-[2rem] shadow-lg border border-teal-100 overflow-hidden">
                <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div class="flex-1">
                        <div class="flex items-center gap-4 mb-2">
                            <span class="text-5xl">📚</span>
                            <div>
                                <h3 class="font-title text-3xl text-gray-800 tracking-wide">Junior B</h3>
                                <p class="text-xs text-teal-600 font-bold uppercase tracking-widest mt-0.5">Junior</p>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-3 mt-4 text-sm font-semibold text-gray-600">
                            <span class="bg-white/80 px-3.5 py-1.5 rounded-xl shadow-sm border border-gray-100"><i class="fas fa-calendar-day text-teal-500 mr-1"></i> Mon, Wed</span>
                            <span class="bg-white/80 px-3.5 py-1.5 rounded-xl shadow-sm border border-gray-100"><i class="fas fa-clock text-teal-500 mr-1"></i> 17:00 - 18:30</span>
                        </div>
                    </div>
                    <div class="flex flex-wrap justify-end gap-2.5">
                        <button type="button" class="bg-gradient-to-r from-emerald-100 to-green-100 text-green-800 border border-green-200 font-bold py-2.5 px-5 rounded-2xl"><i class="fas fa-magic mr-1"></i>Report</button>
                        <button type="button" class="bg-gradient-to-r from-cyan-100 to-blue-100 text-blue-800 border border-blue-200 font-bold py-2.5 px-5 rounded-2xl"><i class="fas fa-pencil-alt mr-1"></i>Edit</button>
                        <button type="button" class="bg-gradient-to-r from-teal-400 to-emerald-500 text-white border border-teal-400 font-bold py-2.5 px-6 rounded-2xl"><i class="fas fa-users mr-1"></i>Students</button>
                    </div>
                </div>
            </div>`;
}

function fillPlanning() {
  const list = document.getElementById('class-end-dates-list');
  if (!list) return;
  list.innerHTML = `
            <div class="rounded-2xl border border-violet-100 bg-white p-5 md:p-6 shadow-sm ring-1 ring-violet-100/80">
                <div class="flex items-center gap-4 mb-6">
                    <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 text-3xl border border-violet-200/80">📚</div>
                    <div>
                        <h3 class="font-title text-xl text-gray-900">Junior B</h3>
                        <p class="text-xs text-gray-500"><span class="font-semibold text-gray-600">Schedule:</span> Mon, Wed</p>
                        <p class="text-xs text-violet-700 mt-1.5"><span class="font-semibold">Saved end date:</span> Tue, 16 June 2026</p>
                    </div>
                </div>
                <label class="block text-xs font-bold uppercase tracking-wider text-violet-800/90 mb-2">Final lesson date</label>
                <input type="date" class="w-full min-h-[48px] px-4 py-3 rounded-xl border-2 border-violet-200 bg-white font-semibold" value="2026-06-16">
            </div>`;
  const save = document.getElementById('save-class-end-dates-btn');
  if (save) save.disabled = false;
}

function fillFamilyAccess() {
  const box = document.getElementById('options-access-content');
  if (!box) return;
  box.innerHTML = `
        <article class="bg-white rounded-3xl border border-sky-100 p-6 shadow-lg">
            <div class="mb-4">
                <h3 class="font-title text-2xl text-sky-800">Parent Access</h3>
                <p class="text-sm text-slate-500 mt-1">One login per student. Share the username and password with the family.</p>
            </div>
            <div class="grid gap-4 lg:grid-cols-[minmax(220px,280px)_1fr]">
                <div>
                    <label class="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Student</label>
                    <select class="w-full px-4 py-3 border border-slate-200 rounded-2xl bg-white"><option selected>Alex</option></select>
                    <div class="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <p><strong class="text-slate-800">Current username:</strong> alex.parent</p>
                        <p class="mt-1"><strong class="text-slate-800">Status:</strong> active</p>
                    </div>
                </div>
                <div class="space-y-4">
                    <div class="grid gap-4 md:grid-cols-2">
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Parent username</label>
                            <input type="text" class="w-full px-4 py-3 border border-slate-200 rounded-2xl" value="alex.parent">
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Password</label>
                            <input type="password" class="w-full px-4 py-3 border border-slate-200 rounded-2xl" placeholder="Enter a new password to reset">
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-3">
                        <button type="button" class="px-5 py-3 rounded-2xl bg-sky-600 text-white font-bold">Save Parent Account</button>
                        <button type="button" class="px-5 py-3 rounded-2xl bg-amber-100 text-amber-800 font-bold">Reset Password</button>
                    </div>
                </div>
            </div>
        </article>`;
}

function fillGrading() {
  const inherited = document.getElementById('options-assessment-defaults-editor');
  if (inherited) {
    inherited.innerHTML = `
            <div class="class-grading-league-grid">
                <article class="class-grading-league-card"><h4>Junior B</h4><div class="class-grading-league-card__row"><span>Tests</span><strong>Numeric · 20</strong></div><div class="class-grading-league-card__row"><span>Dictations</span><strong>Word scale · 4 labels</strong></div></article>
                <article class="class-grading-league-card"><h4>Junior C</h4><div class="class-grading-league-card__row"><span>Tests</span><strong>Numeric · 100</strong></div><div class="class-grading-league-card__row"><span>Dictations</span><strong>Numeric · 100</strong></div></article>
            </div>`;
  }
  const own = document.getElementById('options-class-assessment-editor');
  if (own) {
    own.innerHTML = `
            <div class="assessment-config-card" data-assessment-card data-card-key="options-class-junior-b">
                <div class="assessment-config-card__content">
                    <div class="assessment-config-card__header">
                        <label class="assessment-inherit-control">
                            <input type="checkbox" class="assessment-inherit-toggle" checked>
                            <span><strong>Use school defaults</strong><small>Keep this class synced</small></span>
                        </label>
                    </div>
                </div>
            </div>`;
  }
  const classSelect = document.getElementById('class-grading-class-select');
  if (classSelect) {
    classSelect.innerHTML = '<option value="junior-b" selected>📚 Junior B</option><option value="junior-c">📚 Junior C</option>';
  }
}

function fillQuizSetup() {
  document.getElementById('options-quiz-locked')?.classList.add('hidden');
  document.getElementById('options-quiz-content')?.classList.remove('hidden');
  const cls = document.getElementById('qow-class-display');
  if (cls) cls.textContent = '📚 Junior B';
  document.getElementById('qow-class-meta')?.classList.remove('hidden');
  const level = document.getElementById('qow-class-level-badge');
  if (level) level.textContent = 'Junior B';
  const meta = document.getElementById('qow-class-meta-text');
  if (meta) meta.textContent = 'Mon, Wed · 17:00–18:30';
  document.getElementById('qow-card-curriculum')?.classList.remove('qow-card-disabled');
  const chips = document.getElementById('quiz-categories-chips');
  if (chips) {
    const topics = [
      ['Simple Present', true],
      ['Daily Actions', true],
      ['Animals', true],
      ['Food & Drinks', false],
      ['Can / Can\'t', false],
      ['Family & Friends', false],
      ['Clothes', false],
      ['Have / Has', false]
    ];
    chips.innerHTML = topics.map(([cat, on]) => `
            <label class="qow-chip-label">
                <input type="checkbox" value="${cat}" class="qow-chip-check quiz-category-checkbox"${on ? ' checked' : ''} />
                <span>${cat}</span>
            </label>`).join('');
  }
  const keywords = document.getElementById('quiz-keywords');
  if (keywords) keywords.value = 'was / were in past sentences, daily routines';
  const generate = document.getElementById('quiz-generate-btn');
  if (generate) {
    generate.disabled = false;
    const icon = generate.querySelector('i');
    if (icon) icon.className = 'fas fa-rotate-right';
  }
  const generateLabel = document.getElementById('quiz-generate-btn-label');
  if (generateLabel) generateLabel.textContent = 'Re-generate Quiz';
  const status = document.getElementById('quiz-status-area');
  status?.classList.remove('hidden', 'qow-status-active', 'qow-status-done', 'qow-status-error');
  status?.classList.add('qow-status-ready');
  const icon = document.getElementById('quiz-status-icon');
  if (icon) icon.textContent = '✅';
  const text = document.getElementById('quiz-status-text');
  if (text) text.textContent = 'Quiz ready — 8 questions!';
  const details = document.getElementById('quiz-status-details');
  if (details) details.textContent = 'MIX · Simple Present, Daily Actions, Animals';
  const badge = document.getElementById('qow-status-badge');
  if (badge) {
    badge.textContent = '✅ Ready';
    badge.className = 'qow-status-pill qow-pill-ready';
    badge.classList.remove('hidden');
  }
  document.getElementById('quiz-reset-btn')?.classList.remove('hidden');
  document.getElementById('quiz-history-area')?.classList.remove('hidden');
  const history = document.getElementById('quiz-history-list');
  if (history) {
    history.innerHTML = `
                        <div class="qow-history-item">
                            <span class="qow-history-week">Week 2026-W35</span>
                            <span class="qow-tier-badge qow-tier-epic">🌟 EPIC</span>
                            <span class="qow-history-pct">88%</span>
                            <span class="qow-history-q">8 Q</span>
                        </div>
                        <div class="qow-history-item">
                            <span class="qow-history-week">Week 2026-W34</span>
                            <span class="qow-tier-badge qow-tier-rare">💎 RARE</span>
                            <span class="qow-history-pct">71%</span>
                            <span class="qow-history-q">7 Q</span>
                        </div>`;
  }
}

export function showSettings(section) {
  startShow();
  hideRoster();
  hideChronicle();
  const tab = document.getElementById('options-tab');
  if (!tab) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-settings');
  activateOptionsSection(section);
  if (section === 'manage') fillStudentTools();
  if (section === 'classes') fillMyClasses();
  if (section === 'planning') fillPlanning();
  if (section === 'profile') {
    const name = document.getElementById('teacher-name-input');
    if (name) name.value = 'Ms. Elena';
  }
  if (section === 'assessments') fillGrading();
  if (section === 'access') fillFamilyAccess();
  if (section === 'quiz') fillQuizSetup();
}

export function hideSettings() {
  const tab = document.getElementById('options-tab');
  tab?.classList.add('hidden');
  tab?.classList.remove('capture-settings');
}

function rosterRow({ name, initial, hero, title, guildId, pending, unsorted }) {
  const guild = GUILDS[guildId];
  const badge = getGuildBadgeHtml(guildId, 'w-7 h-7').replace('./assets/', '/assets/');
  const skillCls = pending
    ? 'w-7 h-7 flex items-center justify-center bg-purple-500 text-white rounded-full ring-2 ring-purple-300'
    : 'w-7 h-7 flex items-center justify-center bg-purple-100 text-purple-700 rounded-full';
  const border = guild ? `border-left: 3px solid ${guild.primary};` : '';
  const heroMeta = unsorted
    ? `<span class="text-[11px] text-gray-400 italic">No class</span>`
    : `<span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800">${hero}</span>
                    <span class="hero-title-pill inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style="background:linear-gradient(135deg,#16a34a,#16a34add)">${title}</span>`;
  const chooseHero = unsorted
    ? `<button type="button" class="w-7 h-7 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full" title="Choose Hero Class"><i class="fas fa-shield-halved" style="font-size:10px;"></i></button>`
    : '';
  return `
        <div class="flex items-center gap-3 px-4 py-3" style="${border}">
            <div class="w-11 h-11 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-white font-title flex items-center justify-center">${initial}</div>
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-800 text-sm">${name}</p>
                <div class="flex items-center gap-1.5 mt-0.5">
                    ${heroMeta}
                </div>
            </div>
            <div class="flex-shrink-0 flex flex-col items-end gap-1.5">
                <div class="flex items-center gap-1">
                    <span class="guild-badge-wrap">${badge}</span>
                    ${chooseHero}
                    <button type="button" class="${skillCls}" title="Skill Tree"><i class="fas fa-sitemap" style="font-size:10px;"></i></button>
                    <button type="button" class="w-7 h-7 flex items-center justify-center bg-green-100 text-green-700 rounded-full" title="Hero's Chronicle"><i class="fas fa-book-reader" style="font-size:10px;"></i></button>
                    <button type="button" class="w-7 h-7 flex items-center justify-center bg-sky-100 text-sky-700 rounded-full" title="Parent Access"><i class="fas fa-user-shield" style="font-size:10px;"></i></button>
                    <button type="button" class="w-7 h-7 flex items-center justify-center bg-fuchsia-100 text-fuchsia-700 rounded-full" title="Avatar Forge"><i class="fas fa-user-astronaut" style="font-size:10px;"></i></button>
                    <button type="button" class="w-7 h-7 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full" title="Certificate"><i class="fas fa-award" style="font-size:10px;"></i></button>
                </div>
                <div class="flex items-center gap-1.5">
                    <button type="button" class="flex items-center gap-1 border border-yellow-200 text-xs font-bold py-1 px-2.5 rounded-full"><i class="fas fa-people-arrows" style="font-size:10px;"></i> Move</button>
                    <button type="button" class="flex items-center gap-1 bg-cyan-50 text-cyan-800 border border-cyan-200 text-xs font-bold py-1 px-2.5 rounded-full"><i class="fas fa-pencil-alt" style="font-size:10px;"></i> Edit</button>
                    <button type="button" class="w-7 h-7 flex items-center justify-center bg-red-100 text-red-600 rounded-full"><i class="fas fa-trash-alt" style="font-size:10px;"></i></button>
                </div>
            </div>
        </div>`;
}

export function showRoster() {
  startShow();
  hideSettings();
  const tab = document.getElementById('manage-students-tab');
  if (!tab) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-roster');
  const name = document.getElementById('manage-class-name');
  if (name) name.textContent = 'Junior B';
  const badge = document.getElementById('student-count-badge');
  const num = document.getElementById('student-count-number');
  if (num) num.textContent = '2';
  badge?.classList.remove('hidden');
  const list = document.getElementById('student-list');
  if (list) {
    list.innerHTML = [
      rosterRow({ name: 'Alex', initial: 'A', hero: '🛡️ Guardian', title: '🛡️ Sentinel', guildId: 'dragon_flame', pending: true }),
      rosterRow({ name: 'Maria', initial: 'M', unsorted: true, guildId: 'grizzly_might', pending: false })
    ].join('');
  }
}

export function hideRoster() {
  const tab = document.getElementById('manage-students-tab');
  tab?.classList.add('hidden');
  tab?.classList.remove('capture-roster');
}

export function showChronicle() {
  startShow();
  hideSettings();
  hideRoster();
  const modal = document.getElementById('hero-chronicle-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-chronicle');
  const name = document.getElementById('hero-chronicle-student-name');
  if (name) name.textContent = 'Alex';
  const avatar = document.getElementById('hero-chronicle-avatar');
  if (avatar) avatar.textContent = 'A';
  const count = document.getElementById('chronicle-note-count');
  if (count) count.textContent = '1 Note';
  const feed = document.getElementById('hero-chronicle-notes-feed');
  if (feed) {
    feed.innerHTML = `
            <article class="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <p class="text-[10px] font-black uppercase tracking-widest text-emerald-600">🎓 Academic</p>
                <p class="text-sm text-slate-700 mt-1">Asked for a harder dictation and stayed to check the spelling list.</p>
                <p class="text-[10px] text-slate-400 mt-2">30 Aug 2026 · private</p>
            </article>`;
  }
}

export function hideChronicle() {
  const modal = document.getElementById('hero-chronicle-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-chronicle');
}

export function showSortingQuiz() {
  startShow();
  const modal = document.getElementById('sorting-quiz-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-sort');
  const emoji = document.getElementById('sorting-quiz-question-emoji');
  const progress = document.getElementById('sorting-quiz-progress');
  const q = document.getElementById('sorting-quiz-question-text');
  const opts = document.getElementById('sorting-quiz-options');
  const dots = document.getElementById('sorting-quiz-dots');
  const fill = document.getElementById('sorting-quiz-progress-fill');
  if (emoji) emoji.textContent = '🎨';
  if (progress) progress.textContent = 'Question 1 of 7';
  if (q) q.textContent = 'I like to…';
  if (fill) fill.style.width = '14%';
    if (dots) {
    dots.innerHTML = Array.from({ length: 7 }, (_, i) =>
      `<span class="sorting-quiz-dot${i === 0 ? ' sorting-quiz-dot--active' : ''}"></span>`
    ).join('');
  }
  if (opts) {
    opts.innerHTML = [
      ['🔥', 'Play a brave hero'],
      ['🤝', 'Play with friends'],
      ['🧩', 'Do a puzzle'],
      ['🌈', 'Make something new']
    ].map(([ico, text], i) =>
      `<button type="button" class="sorting-quiz-option${i === 0 ? ' sorting-quiz-option--selected' : ''}"><span class="sorting-quiz-option-label">${ico}</span><span class="sorting-quiz-option-text">${text}</span></button>`
    ).join('');
  }
}

export function hideSortingQuiz() {
  const modal = document.getElementById('sorting-quiz-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-sort');
}

function crystalCol(id, rank, fillPct) {
  const g = GUILDS[id];
  const emblem = assetUrl(getGuildEmblemUrl(id));
  return `
            <div class="guild-crystal-col is-rank-${rank}" data-guild="${id}">
                <div class="guild-crystal-rank"><span class="guild-crystal-rank__label">${rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : '4th'}</span></div>
                <div class="guild-crystal-header">
                    <div class="guild-crystal-emblem-wrapper" style="--glow-color:${g.glow};">
                        <img src="${emblem}" alt="${g.name}" class="guild-crystal-emblem" style="border-color:${g.primary}; box-shadow: 0 0 16px ${g.glow}77;">
                        <div class="guild-emblem-ring" style="border-color:${g.glow};box-shadow:0 0 24px ${g.glow}88;"></div>
                    </div>
                    <div class="guild-crystal-name" style="color:${g.primary};">${g.name}</div>
                </div>
                <div class="guild-crystal-tube-wrap">
                    <div class="guild-crystal-tube" style="border-color:${g.primary}44; box-shadow:inset 0 0 16px rgba(0,0,0,0.08), 0 0 32px ${g.glow}1a;">
                        <div class="guild-crystal-fill" style="height:${fillPct}%;background:linear-gradient(to top,${g.primary} 0%,${g.secondary} 60%,${g.glow} 100%);box-shadow:0 -6px 28px ${g.glow}cc;"></div>
                        <div class="guild-crystal-glass-shine"></div>
                    </div>
                </div>
            </div>`;
}

export function showGuildHall() {
  startShow();
  const tab = document.getElementById('guilds-tab');
  if (!tab) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-guilds');
  const list = document.getElementById('guilds-leaderboard-list');
  if (list) {
    list.innerHTML = `<div class="guild-crystal-hall">
        <div class="guild-crystal-arena-header">
            <h2 class="guild-crystal-arena-title font-title">Standings</h2>
        </div>
        <div class="guild-crystal-arena">
        ${crystalCol('dragon_flame', 1, 78)}
        ${crystalCol('owl_wisdom', 2, 61)}
        ${crystalCol('grizzly_might', 3, 44)}
        ${crystalCol('phoenix_rising', 4, 29)}
        </div>
    </div>`;
  }
}

export function hideGuildHall() {
  const tab = document.getElementById('guilds-tab');
  tab?.classList.add('hidden');
  tab?.classList.remove('capture-guilds');
}

function lessonChipHtml() {
  return `
                <div class="relative text-xs px-2 py-1.5 rounded-xl bg-sky-100 text-sky-800 border-l-4 border-sky-300 shadow-sm mb-1">
                    <div class="flex items-center justify-between mb-0.5">
                        <span class="font-black block text-[9px] opacity-60 tracking-wider">17:00-18:30</span>
                    </div>
                    <span class="truncate block font-bold text-[11px]">📚 Junior B</span>
                </div>`;
}

function starDayBannerHtml() {
  return `
                <div class="relative w-full mb-1.5 p-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 shadow-amber-500/30 text-white shadow-md border border-white/25 flex items-center z-20">
                    <div class="flex items-center gap-1.5 overflow-hidden">
                        <span class="text-[9px] font-black bg-white/30 px-1.5 py-0.5 rounded-lg backdrop-blur-sm shadow-inner">⭐ x2</span>
                        <span class="font-title text-[10px] font-bold truncate leading-tight tracking-tight">2× Star Day</span>
                    </div>
                </div>`;
}

function holidayCellHtml(day) {
  return `
            <div class="calendar-day-cell calendar-holiday-cell holiday-theme-christmas relative overflow-hidden flex flex-col">
                <div class="font-bold text-right text-gray-400 opacity-40 z-10 relative pr-2 pt-2">${day}</div>
                <div class="absolute inset-0 flex flex-col items-center justify-center opacity-80 pointer-events-none">
                    <span class="text-3xl mb-1 drop-shadow-sm">❄️</span>
                    <span class="font-title text-[10px] uppercase tracking-wider font-bold text-gray-500 text-center leading-tight px-2">Winter Break</span>
                </div>
            </div>`;
}

function lessonCellHtml(day, stars, withEvent) {
  const starHtml = stars
    ? `<div class="calendar-star-count text-center text-amber-600 font-bold -mt-5 mb-2 text-sm relative z-10 filter drop-shadow-sm"><i class="fas fa-star mr-1"></i>${stars}</div>`
    : '';
  return `
            <div class="calendar-day-cell flex flex-col min-h-0 bg-white/80">
                <div class="font-bold text-right text-gray-500 text-sm mb-1 pr-2 pt-1 opacity-70">${day}</div>
                ${starHtml}
                <div class="px-1.5 pb-2 flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
                    <div class="flex flex-col shrink-0">${withEvent ? starDayBannerHtml() : ''}</div>
                    <div class="flex flex-col gap-1 mt-1 min-h-0 flex-1 min-w-0 overflow-hidden">
                        ${lessonChipHtml()}
                    </div>
                </div>
            </div>`;
}

function emptyDayHtml(day) {
  return `
            <div class="calendar-day-cell flex flex-col min-h-0 bg-white/80">
                <div class="font-bold text-right text-gray-500 text-sm mb-1 pr-2 pt-1 opacity-70">${day}</div>
            </div>`;
}

function fillCalendarMonth() {
  const title = document.getElementById('calendar-month-year');
  if (title) title.textContent = 'December 2025';
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;
  document.getElementById('calendar-loader')?.classList.add('hidden');
  const headers = Array.from(grid.children).filter((el) => el.id !== 'calendar-loader' && !el.classList.contains('calendar-day-cell'));
  const lessons = { 1: 18, 3: 24, 8: 12, 10: 36, 15: 21, 17: 15 };
  const days = [];
  for (let i = 1; i <= 31; i++) {
    if (i >= 22) days.push(holidayCellHtml(i));
    else if (lessons[i]) days.push(lessonCellHtml(i, lessons[i], i === 10));
    else days.push(emptyDayHtml(i));
  }
  grid.innerHTML = `${headers.map((el) => el.outerHTML).join('')}${days.join('')}`;
}

export function showCalendar() {
  startShow();
  hideDayPlanner();
  hideQuizPlay();
  const tab = document.getElementById('calendar-tab');
  if (!tab) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-calendar');
  fillCalendarMonth();
}

export function hideCalendar() {
  const tab = document.getElementById('calendar-tab');
  tab?.classList.add('hidden');
  tab?.classList.remove('capture-calendar');
}

function setPlannerTab(tabName) {
  const modal = document.getElementById('day-planner-modal');
  modal?.classList.toggle('day-planner--event', tabName === 'event');
  const kicker = document.getElementById('day-planner-kicker');
  if (kicker) kicker.textContent = tabName === 'event' ? 'Summon a Quest Event' : "This day's lessons";
  document.querySelectorAll('.day-planner-tab-btn').forEach((btn) => {
    const on = btn.dataset.tab === tabName;
    btn.classList.toggle('day-planner-tab-btn--active', on);
    btn.classList.toggle('bg-white', on);
    btn.classList.toggle('shadow-sm', on);
    btn.classList.toggle('text-indigo-600', on);
    btn.classList.toggle('text-gray-500', !on);
  });
  document.getElementById('day-planner-schedule-content')?.classList.toggle('hidden', tabName !== 'schedule');
  document.getElementById('day-planner-event-content')?.classList.toggle('hidden', tabName !== 'event');
}

export function showDayPlanner(tabName = 'schedule', eventKind = 'standard') {
  startShow();
  hideCalendar();
  hideQuizPlay();
  const modal = document.getElementById('day-planner-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-planner');
  const title = document.getElementById('day-planner-title');
  if (title) title.textContent = 'Monday, 8 December 2025';
  const list = document.getElementById('schedule-manager-list');
  if (list) {
    list.innerHTML = `
                <article class="schedule-lesson-card">
                    <div class="schedule-lesson-card__main">
                        <div class="schedule-lesson-card__logo">📚</div>
                        <div>
                            <h4 class="schedule-lesson-card__name">Junior B</h4>
                            <p class="schedule-lesson-card__time"><i class="fas fa-clock"></i> 17:00 - 18:30</p>
                        </div>
                    </div>
                    <button type="button" class="cancel-lesson-btn schedule-lesson-cancel">
                    <i class="fas fa-calendar-minus"></i> Cancel
                   </button>
                </article>`;
  }
  const select = document.getElementById('add-onetime-lesson-select');
  if (select) select.innerHTML = '<option value="senior-a" data-logo="🦉" selected>Senior A</option>';
  const onetimeChips = document.getElementById('schedule-onetime-chips');
  if (onetimeChips) {
    onetimeChips.innerHTML = `
        <button type="button" class="quest-event-class-chip quest-event-class-chip--selected" data-onetime-class="senior-a" aria-pressed="true">
            <span class="quest-event-class-chip__logo" aria-hidden="true">🦉</span>
            <span>Senior A</span>
        </button>`;
  }
  document.getElementById('schedule-onetime-empty')?.classList.add('hidden');
  const addBtn = document.getElementById('add-onetime-lesson-btn');
  if (addBtn) addBtn.disabled = false;
  const type = document.getElementById('quest-event-type');
  const desc = document.getElementById('quest-event-description');
  const details = document.getElementById('quest-event-details-container');
  const scope = document.getElementById('quest-event-scope');
  const chips = document.getElementById('quest-event-class-chips');
  if (scope) {
    scope.innerHTML = '<option value="junior-b" data-logo="📚" selected>Junior B</option>';
  }
  if (chips) {
    chips.innerHTML = `
        <button type="button" class="quest-event-class-chip quest-event-class-chip--selected" data-quest-class="junior-b" aria-pressed="true">
            <span class="quest-event-class-chip__logo" aria-hidden="true">📚</span>
            <span>Junior B</span>
        </button>`;
  }
  document.querySelectorAll('.quest-event-type-card').forEach((card) => {
    card.classList.remove('quest-event-type-card--selected');
    card.setAttribute('aria-pressed', 'false');
  });
  if (eventKind === 'vault') {
    if (type) type.value = 'Vocabulary Vault';
    document.querySelector('.quest-event-type-card[data-quest-type="Vocabulary Vault"]')?.classList.add('quest-event-type-card--selected');
    document.querySelector('.quest-event-type-card[data-quest-type="Vocabulary Vault"]')?.setAttribute('aria-pressed', 'true');
    if (desc) {
      desc.classList.remove('hidden');
      desc.innerHTML = '<span class="quest-event-insight__label">Vocabulary Vault</span><p>Students spend the Word / target words in real English. Count toward the vault. You set the goal (valid uses) and the completion bonus Stars.</p>';
    }
    if (details) {
      details.innerHTML = `
        <div class="quest-event-field">
            <label for="quest-goal-target">Goal target (valid uses)</label>
            <input type="number" id="quest-goal-target" value="10" min="5" max="30" required>
        </div>
        <div class="quest-event-field">
            <span class="quest-event-field__label">Completion bonus (Stars per student)</span>
            <input type="hidden" id="quest-completion-bonus" value="1">
            <div class="quest-event-star-picks">
                <button type="button" class="quest-event-star-pick" data-star-bonus="0.5">0.5 ⭐</button>
                <button type="button" class="quest-event-star-pick quest-event-star-pick--selected" data-star-bonus="1" aria-pressed="true">1 ⭐</button>
                <button type="button" class="quest-event-star-pick" data-star-bonus="1.5">1.5 ⭐</button>
                <button type="button" class="quest-event-star-pick" data-star-bonus="2">2 ⭐</button>
            </div>
        </div>
        <div class="quest-event-field">
            <label for="quest-instructions">Instructions</label>
            <textarea id="quest-instructions" maxlength="500" rows="2">Count a use each time a child says today’s word in a real sentence.</textarea>
        </div>
        <div class="quest-event-field">
            <label for="quest-prompt">Projector prompt (optional)</label>
            <textarea id="quest-prompt" maxlength="160" rows="2">Say today’s word in a real English sentence.</textarea>
            <label class="quest-event-toggle"><input id="quest-show-prompt" type="checkbox" checked> Show prompt on projector</label>
        </div>`;
    }
  } else {
    if (type) type.value = '2x Star Day';
    document.querySelector('.quest-event-type-card[data-quest-type="2x Star Day"]')?.classList.add('quest-event-type-card--selected');
    document.querySelector('.quest-event-type-card[data-quest-type="2x Star Day"]')?.setAttribute('aria-pressed', 'true');
    if (desc) {
      desc.classList.remove('hidden');
      desc.innerHTML = '<span class="quest-event-insight__label">2x Star Day</span><p>Every positive star award that day is doubled. The app applies this on Award Stars automatically.</p>';
    }
    if (details) details.innerHTML = '';
  }
  setPlannerTab(tabName);
}

export function hideDayPlanner() {
  const modal = document.getElementById('day-planner-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-planner');
}

export function showSpecialQuestRunner() {
  startShow();
  hideCalendar();
  hideDayPlanner();
  hideQuizPlay();
  hideSpecialQuestProjector();
  const modal = document.getElementById('special-quest-runner-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-sq');
  document.getElementById('special-quest-runner-body')?.classList.remove('hidden');
  document.getElementById('special-quest-projector-view')?.classList.add('hidden');
  const toggleBtn = document.getElementById('special-quest-projector-toggle');
  if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-expand"></i> <span>Projector</span>';
  const title = document.getElementById('special-quest-runner-title');
  const instructions = document.getElementById('special-quest-runner-instructions');
  const count = document.getElementById('special-quest-runner-count');
  const bar = document.getElementById('special-quest-runner-progress');
  const complete = document.getElementById('special-quest-runner-complete');
  const recipients = document.getElementById('special-quest-recipient-list');
  const recipientCount = document.getElementById('special-quest-recipient-count');
  const controls = document.getElementById('special-quest-runner-controls');
  const saga = document.getElementById('special-quest-runner-saga');
  const status = document.getElementById('special-quest-runner-status');
  const banner = document.getElementById('special-quest-runner-banner');
  const badgeImg = document.getElementById('special-quest-runner-badge-img');
  const rewardBadge = document.getElementById('special-quest-runner-reward-badge');
  const interactive = document.getElementById('special-quest-runner-interactive');
  if (banner) banner.className = 'relative p-5 md:p-7 bg-gradient-to-r from-purple-900 via-indigo-900 to-amber-950 text-white overflow-hidden';
  if (badgeImg) badgeImg.src = '/assets/ceremony/quest-vocabulary-vault.svg';
  if (title) title.textContent = 'Vocabulary Vault';
  if (instructions) instructions.textContent = 'Count a use each time a child says today’s word in a real sentence.';
  if (rewardBadge) rewardBadge.innerHTML = '<span>⭐ +1 Stars</span> <span>🪙 +1 Gold</span>';
  if (count) count.textContent = '7 / 10';
  if (bar) bar.style.width = '70%';
  if (complete) complete.disabled = true;
  if (status) {
    status.textContent = 'Active';
    status.className = 'quest-status-chip quest-status-chip--active';
  }
  saga?.classList.add('hidden');
  if (interactive) {
    const gemsHtml = Array.from({ length: 10 }, (_, i) => `<div class="special-quest-gem${i < 7 ? ' special-quest-gem--active' : ''}" title="Word Gem ${i + 1}">💎</div>`).join('');
    interactive.innerHTML = `
      <div class="space-y-1.5">
        <div class="text-xs font-black uppercase tracking-wider text-purple-700 flex items-center justify-between">
          <span>Vault Gems Collected</span>
          <span>7 / 10 Gems</span>
        </div>
        <div class="special-quest-gems-grid">${gemsHtml}</div>
      </div>
    `;
  }
  if (controls) {
    controls.innerHTML = '<button type="button" class="special-quest-action px-4 py-2.5 rounded-xl font-black text-sm transition-all shadow-sm bg-purple-600 hover:bg-purple-500 text-white">Add Word Gem 💎</button>';
  }
  if (recipients) {
    recipients.innerHTML = ['Alex', 'Maria', 'Nikos'].map((name) => {
      const initials = name.slice(0, 2).toUpperCase();
      return `
            <label class="special-quest-recipient-chip special-quest-recipient-chip--selected">
              <input type="checkbox" class="sr-only" checked>
              <div class="special-quest-recipient-avatar">${initials}</div>
              <span class="truncate">${name}</span>
              <i class="fas fa-check ml-auto text-xs text-indigo-600"></i>
            </label>`;
    }).join('');
  }
  if (recipientCount) recipientCount.textContent = '3 recipients';
}

export function hideSpecialQuestRunner() {
  const modal = document.getElementById('special-quest-runner-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-sq');
}

export function showSpecialQuestProjector() {
  startShow();
  hideCalendar();
  hideDayPlanner();
  hideQuizPlay();
  hideSpecialQuestRunner();
  const host = document.getElementById('capture-sq-projector');
  if (!host) return;
  host.classList.remove('hidden');
  host.classList.add('capture-sq-proj');
  host.innerHTML = `
    <section class="special-quest-projector" role="region" aria-live="polite" aria-label="Special Quest Presentation">
      <img src="/assets/ceremony/quest-vocabulary-vault.svg" class="special-quest-projector-badge" alt="Vocabulary Vault" />
      <h1>Vocabulary Vault</h1>
      <p class="special-quest-projector-prompt">Say today’s word in a real English sentence.</p>
      <div class="special-quest-progress-track">
        <div class="special-quest-progress-fill" style="width: 70%;"></div>
      </div>
      <div class="special-quest-projector-counter">7 / 10 Completed (70%)</div>
    </section>`;
}

export function hideSpecialQuestProjector() {
  const host = document.getElementById('capture-sq-projector');
  host?.classList.add('hidden');
  host?.classList.remove('capture-sq-proj');
  if (host) host.innerHTML = '';
}

function quizIntroHtml() {
  return `
        <div class="quiz-modal-header">
            <span class="quiz-modal-title">⚔️ Quiz of the Week</span>
            <button class="quiz-modal-close" type="button"><i class="fas fa-times"></i></button>
        </div>
        <div class="quiz-intro">
            <div class="quiz-intro-icon">🎯</div>
            <div class="quiz-intro-title">Ready, Quest Heroes?</div>
            <p class="quiz-intro-subtitle">
                8 questions on this week's curriculum. Students will be picked at random to answer!
            </p>
            <div class="quiz-intro-curriculum">Mix — Simple Present, Daily Actions</div>
            <div class="quiz-intro-stats">
                <div class="quiz-intro-stat">
                    <div class="quiz-intro-stat-num">8</div>
                    <div class="quiz-intro-stat-label">Questions</div>
                </div>
                <div class="quiz-intro-stat">
                    <div class="quiz-intro-stat-num">12</div>
                    <div class="quiz-intro-stat-label">Present</div>
                </div>
            </div>
            <button class="quiz-start-btn bubbly-button" type="button">
                <i class="fas fa-play mr-2"></i> Begin the Quiz!
            </button>
        </div>`;
}

function quizQuestionHtml() {
  const options = [
    ['A', 'She go to school every day.'],
    ['B', 'She goes to school every day.'],
    ['C', 'She going to school every day.'],
    ['D', 'She gone to school every day.']
  ];
  return `
        <div class="quiz-modal-header">
            <span class="quiz-modal-title">⚔️ Quiz of the Week</span>
            <button class="quiz-modal-close" type="button"><i class="fas fa-times"></i></button>
        </div>
        <div class="quiz-progress-bar">
            <div class="quiz-progress-fill" style="width:25%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
            <span class="quiz-progress-label">Q 3 / 8</span>
            <div class="quiz-score-tracker">
                <span class="quiz-score-correct"><i class="fas fa-check-circle"></i> 2</span>
                <span class="quiz-score-sep">/</span>
                <span style="color:rgba(0,0,0,0.5);">8</span>
                <span style="color:rgba(0,0,0,0.4);font-size:0.78rem;">correct</span>
            </div>
        </div>
        <div class="quiz-spotlight-bar">
            <div class="quiz-spotlight-avatar"><i class="fas fa-hat-wizard"></i></div>
            <div>
                <div class="quiz-spotlight-name">Alex</div>
                <div class="quiz-spotlight-label">✨ Your turn!</div>
            </div>
            <div class="quiz-spotlight-star">
                <i class="fas fa-star"></i> 18
            </div>
        </div>
        <div class="quiz-question-layout">
            <div class="quiz-question-area">
                <div class="quiz-question-kicker">Multiple Choice Challenge</div>
                <div class="quiz-question-emoji">✨</div>
                <div class="quiz-question-text">Choose the correct sentence.</div>
            </div>
            <div class="quiz-answer-grid">
                ${options.map(([label, copy]) => `
        <button class="quiz-answer-btn quiz-answer-visible" type="button">
            <span class="quiz-answer-label">${label}</span>
            <span class="quiz-answer-copy">${copy}</span>
        </button>`).join('')}
            </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.6rem;">
            <button class="quiz-skip-btn" type="button">
                <i class="fas fa-forward-fast mr-1"></i> Skip Question
            </button>
        </div>`;
}

export function showQuizPlay(screen = 'intro') {
  startShow();
  hideCalendar();
  hideDayPlanner();
  const modal = document.getElementById('quiz-of-week-modal');
  const content = document.getElementById('quiz-modal-content');
  if (!modal || !content) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-quiz-play');
  content.innerHTML = screen === 'question' ? quizQuestionHtml() : quizIntroHtml();
}

export function hideQuizPlay() {
  const modal = document.getElementById('quiz-of-week-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-quiz-play');
}
