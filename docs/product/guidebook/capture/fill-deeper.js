/** Extra live chrome: Scroll bulk, Starfall, Story Weavers, Settings, Guild Quiz, Guild Hall, Calendar, Quiz play. */

import * as state from '../../../../state.js';
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
import { hideRedesign, seedSchool } from './fill-redesign.js';

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
  hideRedesign();
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
  const hintEl = document.getElementById('options-subtab-trigger-hint');
  if (hintEl) hintEl.textContent = active?.dataset.hint || '';
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
  const purse = document.getElementById('economy-student-select');
  if (purse) purse.innerHTML = '<option value="alex" selected>Alex</option><option value="maria">Maria</option>';
  const gold = document.getElementById('economy-gold-input');
  if (gold) gold.value = '42';
  const familiar = document.getElementById('familiar-maintenance-student-select');
  if (familiar) familiar.innerHTML = '<option value="" selected>Choose a student with a Familiar</option><option value="maria">Maria · Frostpaw</option>';
}

/** My Classes, drawn by the app's own renderer (ui/tabs/classes.js) with the Oaths button mounted. */
async function fillMyClasses() {
  seedSchool();
  const { renderManageClassesTab } = await import('../../../../ui/tabs/classes.js');
  renderManageClassesTab();
  const { mountCampfireEntry } = await import('../../../../features/campfireEntry.js');
  document.querySelectorAll('#class-list .edit-class-btn').forEach((btn) => {
    if (!btn.parentElement.querySelector('.campfire-entry')) mountCampfireEntry(btn.parentElement, btn.dataset.id, { oathsOnly: true });
  });
}

/** My Planning, drawn by the app's own renderer (ui/core/misc.js) for the header class. */
async function fillPlanning() {
  seedSchool();
  state.set('teacherSettings', { schoolYearSettings: { classEndDates: { 'guide-jb': '16-06-2027' } } });
  const { renderClassEndDatesList } = await import('../../../../ui/core/misc.js');
  renderClassEndDatesList();
}

/** Family Access, drawn by the app's own card (features/accessManagement.js) with one parent login on file. */
async function fillFamilyAccess() {
  seedSchool();
  state.set('currentUserRole', 'teacher');
  state.set('currentUserId', 'guide-teacher');
  state.set('allStudents', (state.get('allStudents') || []).map((s) => ({ ...s, createdBy: { uid: 'guide-teacher' } })));
  const box = document.getElementById('options-access-content');
  if (!box) return;
  const { renderParentAccessCard } = await import('../../../../features/accessManagement.js');
  box.innerHTML = renderParentAccessCard({
    parentLinksByStudent: { 'guide-alex': { studentId: 'guide-alex', username: 'alex.parent', status: 'active' } }
  });
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
  document.getElementById('qow-card-options')?.classList.remove('qow-card-disabled');
  const lesson = document.getElementById('qow-lesson-focus');
  if (lesson) {
    lesson.classList.remove('hidden');
    const summary = document.getElementById('qow-lesson-summary');
    if (summary) summary.textContent = 'Since last quiz (Week 38): 3 lessons';
    const units = document.getElementById('qow-lesson-units');
    if (units) units.innerHTML = '<p class="qow-lesson-unit">Cambridge Primary Path 2 · Unit 4 · What is a friend?</p>';
    const grammar = document.getElementById('qow-lesson-grammar');
    if (grammar) {
      grammar.classList.remove('hidden');
      grammar.innerHTML = '<span class="qow-lesson-grammar-chip">present simple: affirmative, negative and questions</span>';
    }
    const words = document.getElementById('qow-lesson-words');
    if (words) {
      const list = [['friend', true], ['kind', true], ['share', true], ['trust', true], ['help', true], ['together', false]];
      words.innerHTML = list.map(([word, on]) => `
            <label class="qow-chip-label">
                <input type="checkbox" value="${word}" class="qow-chip-check qow-lesson-word"${on ? ' checked' : ''} />
                <span>${word}</span>
            </label>`).join('');
    }
    document.getElementById('qow-lesson-words-label')?.classList.remove('hidden');
  }
  const title = document.getElementById('qow-curriculum-title');
  if (title) title.innerHTML = '<i class="fas fa-book-open mr-2 text-amber-500"></i>This week\'s lessons';
  const details = document.getElementById('qow-different-focus');
  if (details) {
    details.classList.remove('qow-focus-fallback');
    details.open = false;
  }
  document.getElementById('qow-different-focus-summary')?.classList.remove('hidden');
  const keywords = document.getElementById('quiz-keywords');
  if (keywords) keywords.value = '';
  const keywordsLabel = document.getElementById('qow-keywords-label');
  if (keywordsLabel) keywordsLabel.innerHTML = '<i class="fas fa-pen mr-1"></i> Add a note <span class="text-gray-400 font-normal">(optional)</span>';
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
  const statusDetails = document.getElementById('quiz-status-details');
  if (statusDetails) statusDetails.textContent = 'MIX · What is a friend? · present simple';
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
  if (section === 'classes') return fillMyClasses();
  if (section === 'planning') return fillPlanning();
  if (section === 'profile') {
    const name = document.getElementById('teacher-name-input');
    if (name) name.value = 'Ms. Elena';
    // The staff badge follows the name as it is typed (ui/tabs/navigation.js syncTeacherBadge).
    const badgeName = document.getElementById('ts-badge-name');
    const badgeInitials = document.getElementById('ts-badge-initials');
    if (badgeName) badgeName.textContent = 'Ms. Elena';
    if (badgeInitials) badgeInitials.textContent = 'EL';
  }
  if (section === 'assessments') fillGrading();
  if (section === 'access') return fillFamilyAccess();
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
  const tool = (tone, icon, label, extra = '') =>
    `<button type="button" class="roster-tool roster-tool--${tone}${extra}"><span class="roster-tool__icon">${icon}</span><span class="roster-tool__label">${label}</span></button>`;
  const fa = (n) => `<i class="fas ${n}"></i>`;
  const heroMeta = unsorted
    ? `<span class="text-[11px] text-gray-400 italic">No class</span>`
    : `<span class="hero-title-pill inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style="background:linear-gradient(135deg,#16a34a,#16a34add)">${title}</span>`;
  const guildChip = guild ? `<span class="roster-guild-chip" style="--chip-color:${guild.primary};">${guild.name}</span>` : '';
  const heroTool = unsorted
    ? tool('class', fa('fa-shield-halved'), 'Class')
    : `<span class="roster-tool roster-tool--class is-set"><span class="roster-tool__icon"><span class="roster-tool__emoji">${hero.split(' ')[0]}</span></span><span class="roster-tool__label">${hero.split(' ').slice(1).join(' ')}</span></span>`;
  return `
        <article class="roster-row"${guild ? ` style="--roster-accent:${guild.primary};"` : ''}>
            <div class="roster-hero">
                <div class="roster-hero__avatar"><div class="w-11 h-11 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 text-white font-title flex items-center justify-center">${initial}</div></div>
                <div class="roster-hero__text">
                    <p class="roster-hero__name">${name}</p>
                    <div class="roster-hero__meta">${heroMeta}${guildChip}</div>
                </div>
            </div>
            <div class="roster-tools">
                <div class="roster-group roster-group--hero"><span class="roster-group__caption">Hero path</span><div class="roster-group__tools">
                    <span class="roster-tool roster-tool--guild is-set"><span class="roster-tool__icon"><span class="guild-badge-wrap">${badge}</span></span><span class="roster-tool__label">Guild</span></span>
                    ${heroTool}
                    ${tool('skills', fa('fa-sitemap') + (pending ? '<span class="roster-tool__ping"></span>' : ''), 'Skills', pending ? ' is-ready' : '')}
                </div></div>
                <div class="roster-group roster-group--records"><span class="roster-group__caption">Records</span><div class="roster-group__tools">
                    ${tool('chronicle', fa('fa-book-reader'), 'Chronicle')}${tool('parents', fa('fa-user-shield'), 'Parents')}${tool('avatar', fa('fa-user-astronaut'), 'Avatar')}${tool('certificate', fa('fa-award'), 'Certificate')}
                </div></div>
                <div class="roster-group roster-group--admin"><span class="roster-group__caption">Manage</span><div class="roster-group__tools">
                    ${tool('move', fa('fa-people-arrows'), 'Move')}${tool('edit', fa('fa-pencil-alt'), 'Edit')}${tool('delete', fa('fa-trash-alt'), 'Delete')}
                </div></div>
            </div>
        </article>`;
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
  if (name) name.textContent = 'The deeds of Alex';
  const avatar = document.getElementById('hero-chronicle-avatar');
  if (avatar) avatar.innerHTML = '<span class="hc-medallion__initial font-title">A</span>';
  const count = document.getElementById('chronicle-note-count');
  if (count) count.textContent = '1 Note';
  const feed = document.getElementById('hero-chronicle-notes-feed');
  if (feed) {
    feed.innerHTML = `
            <article class="hc-entry hc-entry--academic">
                <time class="hc-entry__date"><span class="hc-entry__day">30</span><span class="hc-entry__month">Aug</span><span class="hc-entry__year">2026</span></time>
                <span class="hc-entry__seal"><i class="fas fa-graduation-cap"></i></span>
                <div class="hc-entry__body">
                    <div class="hc-entry__head"><span class="hc-entry__cat">Academic</span></div>
                    <p class="hc-entry__text">Asked for a harder dictation and stayed to check the spelling list.</p>
                </div>
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
  modal.dataset.stage = 'question';
  modal.style.setProperty('--sq-orb-a', '#b45cf0');
  modal.style.setProperty('--sq-orb-b', '#f472b6');
  const ring = document.getElementById('sq-ring');
  if (ring) {
    ring.innerHTML = ['dragon_flame', 'grizzly_might', 'owl_wisdom', 'phoenix_rising'].map((id, i) => {
      const g = GUILDS[id];
      return `<div class="sq-seat" data-guild="${id}" style="--seat:${i}; --seat-glow:${g.glow}; --seat-a:${g.primary}; --seat-b:${g.secondary};"><div class="sq-seat__body"><span class="sq-seat__halo"></span><img src="${getGuildEmblemUrl(id)}" alt="" class="sq-seat__emblem"><span class="sq-seat__name">${g.name}</span></div></div>`;
    }).join('');
  }
  const glyph = document.getElementById('sorting-quiz-question-emoji');
  const progress = document.getElementById('sorting-quiz-progress');
  const q = document.getElementById('sorting-quiz-question-text');
  const opts = document.getElementById('sorting-quiz-options');
  const runes = document.getElementById('sorting-quiz-dots');
  if (glyph) glyph.textContent = '🎨';
  if (progress) progress.textContent = 'Question 3 of 7';
  if (q) q.textContent = 'I like to…';
  if (runes) {
    runes.innerHTML = Array.from({ length: 7 }, (_, i) =>
      `<span class="sq-rune${i < 2 ? ' is-lit' : ''}${i === 2 ? ' is-current' : ''}"><i></i></span>`
    ).join('');
  }
  if (opts) {
    opts.innerHTML = [
      ['🔥', 'Play a brave hero'],
      ['🤝', 'Play with friends'],
      ['🧩', 'Do a puzzle'],
      ['🌈', 'Make something new']
    ].map(([ico, text], i) =>
      `<button type="button" class="sq-option${i === 0 ? ' is-chosen' : ''}" style="--i:${i}"><span class="sq-option__key">${'ABCD'[i]}</span><span class="sq-option__glyph">${ico}</span><span class="sq-option__text">${text}</span></button>`
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
  const allClasses = document.getElementById('quest-event-all-classes');
  const classFootnote = document.getElementById('quest-event-class-footnote');
  if (scope) {
    scope.innerHTML = '<option value="junior-b" data-logo="📚" selected>Junior B</option>';
  }
  document.querySelectorAll('.quest-event-type-card').forEach((card) => {
    card.classList.remove('quest-event-type-card--selected');
    card.setAttribute('aria-pressed', 'false');
  });
  if (eventKind === 'vault') {
    chips?.classList.remove('hidden');
    allClasses?.classList.add('hidden');
    if (classFootnote) classFootnote.textContent = 'Select one or more classes. Special Quests are stored separately per class.';
    if (chips) {
      chips.innerHTML = `
        <button type="button" class="quest-event-class-chip quest-event-class-chip--selected" data-quest-class="junior-b" aria-pressed="true">
            <span class="quest-event-class-chip__logo" aria-hidden="true">📚</span>
            <span>Junior B</span>
        </button>`;
    }
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
    chips?.classList.add('hidden');
    allClasses?.classList.remove('hidden');
    if (classFootnote) classFootnote.textContent = 'A school-wide event. It applies to every class on this day, so there is nothing to pick.';
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
