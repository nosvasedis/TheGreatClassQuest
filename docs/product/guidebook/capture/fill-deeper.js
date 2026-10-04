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
import { trialDateLabel, trialRowHtml, trialScaleLegendHtml, trialTally, trialTallyText, trialTipHtml } from '../../../../features/trialLogCore.mjs';
import { hideAppScreen, hideExtras, onHideExtras } from './fill-extras.js';
import { classroomShellHtml, hideClassroom } from './fill-classroom.js';
import { hideSurfaces, surfacesShellHtml } from './fill-surfaces.js';
import { hideRedesign, seedSchool } from './fill-redesign.js';
import { QUIZ_TYPES, describeQuizWeek, planSummaryText, quizFactsHtml, quizHistoryHtml, quizTrackHtml, weekRangeLabel } from '../../../../ui/tabs/quizSetupView.mjs';
import { quizIntroHtml as stageIntroHtml, quizResultsHtml as stageResultsHtml, quizStageShellHtml, quizTurnHtml, quizVerdictHtml } from '../../../../ui/modals/quizStageMarkup.js';

function quizPlayShellHtml() {
  return quizStageShellHtml();
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

const CAPTURE_DICTATION_SCHEME = {
  mode: 'qualitative',
  scale: [
    { label: 'Great!!!', normalizedPercent: 100 },
    { label: 'Great!!', normalizedPercent: 75 },
    { label: 'Great!', normalizedPercent: 50 },
    { label: 'Nice Try!', normalizedPercent: 25 }
  ]
};
const CAPTURE_TEST_SCHEME = { mode: 'numeric', maxScore: 20 };

/** The real Log New Trial marking board, filled with the same row builder the app uses. */
export function showBulkTrial(kind = 'dictation') {
  startShow();
  const modal = document.getElementById('bulk-trial-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('capture-bulk');
  const isTest = kind === 'test';
  const scheme = isTest ? CAPTURE_TEST_SCHEME : CAPTURE_DICTATION_SCHEME;
  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  set('bulk-trial-title', isTest ? 'Log Test' : 'Log Dictation');
  set('bulk-trial-subtitle', '📚 Junior B');
  set('bulk-trial-date-display', trialDateLabel('2026-08-30', '2026-08-30'));
  document.getElementById('bulk-trial-title-wrapper')?.classList.toggle('hidden', !isTest);
  const titleInput = document.getElementById('bulk-trial-name');
  if (titleInput) titleInput.value = isTest ? 'Unit 3 Vocabulary Quiz' : '';
  const legend = document.getElementById('bulk-trial-legend');
  if (legend) legend.innerHTML = trialScaleLegendHtml(scheme);
  const tip = document.getElementById('bulk-trial-tip-default');
  if (tip) tip.innerHTML = trialTipHtml(scheme);
  const tabs = document.getElementById('bulk-trial-type-switch');
  tabs?.classList.remove('hidden');
  tabs?.querySelectorAll('.tl-tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.trialType === kind));
  document.getElementById('bulk-trial-shell')?.classList.add('tl-board--tabbed');
  const list = document.getElementById('bulk-student-list');
  if (!list) return;
  const people = isTest
    ? [['Alex', '18'], ['Eleni', '15'], ['Maria', ''], ['Nikos', null], ['Sofia', '11'], ['Yannis', '']]
    : [['Alex', 'Great!!!'], ['Eleni', 'Great!'], ['Maria', 'Great!!'], ['Nikos', null], ['Sofia', ''], ['Yannis', '']];
  const rows = people.map(([name, value], i) => ({
    student: { id: `cap-${i}`, name },
    absent: value === null,
    value: value || ''
  }));
  list.innerHTML = rows.map((r) => trialRowHtml({ student: r.student, scheme, isAbsent: r.absent, value: r.value })).join('');
  const tally = trialTally(rows);
  set('bulk-trial-tally', trialTallyText(tally));
  const fill = document.getElementById('bulk-trial-tally-fill');
  if (fill) fill.style.width = `${Math.round((tally.graded / tally.present) * 100)}%`;
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

const QUIZ_SAMPLE_QUESTIONS = Array.from({ length: 8 }, (_, i) => ({ id: `q${i + 1}`, ...(i < 2 ? { carriedFrom: { questionId: `p${i}` } } : {}) }));
const QUIZ_SAMPLE_CURRICULUM = {
  type: 'mix',
  categories: [],
  lessonFocus: { source: 'book-atlas', units: [{ unit: 4 }], words: ['friend', 'kind', 'share', 'trust', 'help'] }
};
const QUIZ_SAMPLE = {
  none: null,
  review: { status: 'review', questions: QUIZ_SAMPLE_QUESTIONS, curriculum: QUIZ_SAMPLE_CURRICULUM, reviewBeforeLive: true },
  ready: { status: 'ready', questions: QUIZ_SAMPLE_QUESTIONS, curriculum: QUIZ_SAMPLE_CURRICULUM, reviewBeforeLive: false },
  generating: { status: 'pending', questions: [], curriculum: QUIZ_SAMPLE_CURRICULUM },
  completed: {
    status: 'completed', weekKey: '2026-W40', questions: QUIZ_SAMPLE_QUESTIONS, curriculum: QUIZ_SAMPLE_CURRICULUM,
    results: { tier: 'epic', firstTryCorrectPct: 88, allParticipating: Array.from({ length: 11 }, (_, i) => `s${i}`) }
  }
};

/** Settings → Quiz with the same view models the live page uses (ui/tabs/quizSetup.js). */
function fillQuizSetup(stateName = 'ready') {
  const quiz = stateName in QUIZ_SAMPLE ? QUIZ_SAMPLE[stateName] : QUIZ_SAMPLE.ready;
  const generating = stateName === 'generating';
  const $ = (id) => document.getElementById(id);
  const show = (el, on) => el?.classList.toggle('hidden', !on);
  show($('options-quiz-locked'), false);
  show($('options-quiz-content'), true);
  show($('qwk-no-class'), false);
  show($('qwk-body'), true);
  show($('qwk-class-chip'), true);
  $('qwk-class-logo').textContent = '📚';
  $('qwk-class-name').textContent = 'Junior B';
  $('qwk-class-meta').textContent = 'Junior B · Mon, Wed · 17:00–18:30';

  const nextLesson = { date: new Date(2026, 9, 5), timeStart: '17:00' };
  const model = describeQuizWeek({ quiz, nextLesson, generating });
  const week = $('qwk-week');
  week.dataset.tone = model.tone;
  $('qwk-week-icon').textContent = model.icon;
  $('qwk-week-eyebrow').textContent = `This week · ${weekRangeLabel('2026-10-05')}`;
  $('qwk-week-title').textContent = model.title;
  $('qwk-week-sub').textContent = model.sub;
  $('qwk-track').innerHTML = quizTrackHtml(model.phase, { skippedCheck: quiz ? !quiz.reviewBeforeLive : false });
  $('qwk-week-facts').innerHTML = quizFactsHtml(model.facts);
  show($('qwk-week-facts'), model.facts.length > 0);
  show($('qwk-gen'), generating);
  if (generating) {
    week.querySelectorAll('[data-gen-step]').forEach((el) => {
      el.classList.toggle('is-done', el.dataset.genStep === '1');
      el.classList.toggle('is-now', el.dataset.genStep === '2');
    });
    const fill = week.querySelector('.qwk-gen__fill');
    if (fill) { fill.style.animation = 'none'; fill.style.width = '46%'; }
  }
  const actions = new Set(model.actions);
  show($('quiz-review-btn'), actions.has('review') || actions.has('edit'));
  $('quiz-review-btn').classList.toggle('ts-btn--quiet', !actions.has('review'));
  $('quiz-review-btn-label').textContent = actions.has('review') ? 'Check & approve' : 'Read & edit the questions';
  show($('qwk-play-btn'), actions.has('play'));
  show($('qwk-results-btn'), actions.has('results'));
  show($('quiz-reset-btn'), actions.has('reset'));

  const hasQuestions = (quiz?.questions || []).length > 0;
  const locked = quiz?.status === 'completed';
  const open = !hasQuestions && !locked;
  $('qwk-plan').dataset.mode = locked ? 'locked' : open ? 'open' : 'closed';
  show($('qwk-plan-form'), open);
  show($('qwk-plan-locked'), locked);
  $('qwk-plan-title').textContent = hasQuestions ? 'This week\'s plan' : 'Plan the quiz';
  $('qwk-plan-summary').textContent = quiz ? planSummaryText(quiz.curriculum) : '';
  show($('qwk-plan-summary'), !open && Boolean(quiz));
  show($('qwk-plan-toggle'), hasQuestions && !locked);

  show($('qwk-lesson'), true);
  show($('qwk-topics'), false);
  $('qwk-lesson-window').textContent = 'Since last quiz (Week 39): 3 lessons';
  $('qwk-lesson-units').innerHTML = '<p class="qwk-lesson__unit"><i class="fas fa-bookmark" aria-hidden="true"></i> Cambridge Primary Path 2 · Unit 4 · What is a friend?</p>';
  $('qwk-lesson-grammar').innerHTML = '<span class="qwk-grammar"><i class="fas fa-spell-check" aria-hidden="true"></i> present simple: affirmative, negative and questions</span>';
  const words = [['friend', true], ['kind', true], ['share', true], ['trust', true], ['help', true], ['together', false]];
  $('qwk-lesson-words').innerHTML = words.map(([word, on]) => `
            <label class="qwk-chip">
                <input type="checkbox" value="${word}" class="qwk-chip__input qwk-lesson-word"${on ? ' checked' : ''} />
                <span>${word}</span>
            </label>`).join('');
  $('qwk-words-count').textContent = '5 of 6';
  $('qwk-type').innerHTML = QUIZ_TYPES.map((t) => `
        <button type="button" role="radio" class="qwk-type__opt" data-type="${t.id}" aria-checked="${t.id === 'mix'}">
            <span class="qwk-type__icon" aria-hidden="true">${t.icon}</span>
            <span class="qwk-type__label">${t.label}</span>
            <span class="qwk-type__hint">${t.hint}</span>
        </button>`).join('');
  $('quiz-review-toggle').checked = true;
  $('quiz-carry-toggle').checked = true;
  show($('quiz-carry-panel'), true);
  $('quiz-carry-summary').textContent = '2 questions missed last time. Tick the ones to bring back.';
  $('quiz-carry-list').innerHTML = [
    ['Which word means "a person you like and trust"?', 'friend', 'teacher', true],
    ['She ___ her toys with her brother.', 'shares', 'share', false]
  ].map(([q, a, w, on], i) => `
            <label class="qwk-carry__item">
                <input type="checkbox" class="qwk-carry__check" data-carry-index="${i}"${on ? ' checked' : ''} />
                <span class="qwk-carry__copy">
                    <span class="qwk-carry__question">${q}</span>
                    <span class="qwk-carry__meta"><span class="qwk-carry__answer"><i class="fas fa-check" aria-hidden="true"></i> ${a}</span><span class="qwk-carry__wrong">Most chose “${w}”</span></span>
                </span>
            </label>`).join('');
  $('qwk-go-summary').textContent = 'About 9 questions · Mix · 5 words · 1 back from last time';
  const generate = $('quiz-generate-btn');
  generate.disabled = false;
  $('quiz-generate-btn-label').textContent = 'Create the quiz';

  show($('quiz-history-area'), true);
  $('quiz-history-list').innerHTML = quizHistoryHtml([
    { weekKey: '2026-W39', curriculum: { type: 'vocabulary', lessonFocus: { units: [{ unit: 3 }], words: ['tall', 'short', 'curly', 'straight'] } }, results: { tier: 'epic', firstTryCorrectPct: 88, totalQuestions: 8, allParticipating: Array(11).fill(0) } },
    { weekKey: '2026-W38', curriculum: { type: 'grammar', lessonFocus: { units: [{ unit: 3 }], grammarPoints: ['have got / has got'], words: [] } }, results: { tier: 'rare', firstTryCorrectPct: 71, totalQuestions: 7, allParticipating: Array(10).fill(0) } },
    { weekKey: '2026-W37', curriculum: { type: 'mix', categories: ['Animals', 'Can / Can\'t'] }, results: { tier: 'common', firstTryCorrectPct: 54, totalQuestions: 8, allParticipating: Array(9).fill(0) } }
  ]);
}

export function showSettings(sectionArg) {
  // 'quiz' or 'quiz:review' (none, generating, review, ready, completed)
  const [section, quizState = section === 'quiz' ? 'ready' : ''] = String(sectionArg).split(':');
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
  if (quizState) fillQuizSetup(quizState);
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

let _guildHallRestore = null;

/** Seeds four guilds mid-October (September already sealed) and renders the real Guild Hall. */
function seedGuildHall() {
  const now = new Date();
  const key = `m${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
  const year = '2026-2027';
  const classId = state.get('globalSelectedClassId');
  const sizes = { dragon_flame: 9, grizzly_might: 14, owl_wisdom: 6, phoenix_rising: 11 };
  const names = ['Maria', 'Alex', 'Eleni', 'Nikos', 'Sofia', 'Yannis', 'Zoe', 'Dimitra', 'Kostas', 'Anna', 'Petros', 'Ioanna', 'Giorgos', 'Katerina'];
  const students = [];
  const scores = [];
  const docs = {};
  Object.keys(sizes).forEach((gid, gi) => {
    const memberIds = [];
    const memberGlory = {};
    const members = {};
    let totalGlory = 0;
    let glory = 0;
    for (let i = 0; i < sizes[gid]; i++) {
      const id = `capture_${gid}_${i}`;
      memberIds.push(id);
      const stars = 6 + ((i * 7 + gi * 3) % 13);
      students.push({ id, name: `${names[i % names.length]} ${String.fromCharCode(65 + gi)}.`, classId, guildId: gid, activeSchoolYearKey: year });
      scores.push({ id, totalStars: stars, monthlyStars: 3, activeSchoolYearKey: year });
      memberGlory[id] = stars * 2;
      totalGlory += stars * 2;
      members[id] = i % (gi + 2) === 0 ? 2 : 6 + ((i + gi) % 5) * 2;
      glory += members[id];
    }
    docs[gid] = {
      id: gid, guildId: gid, activeSchoolYearKey: year, memberGloryYear: year, memberIds, memberCount: memberIds.length, totalGlory, memberGlory,
      chapters: { [key]: { glory, members, standards: gi === 2 ? [{ studentId: memberIds[1], name: 'Alex C.' }] : [] } },
      sealedChapters: { m2026_09: { place: [2, 1, 3, 4][gi], crowns: [3, 6, 2, 1][gi], unity: gi === 1 } }
    };
  });
  _guildHallRestore = {
    schoolYearState: state.get('schoolYearState'),
    allSchoolYears: state.get('allSchoolYears'),
    allStudents: state.get('allStudents'),
    allStudentScores: state.get('allStudentScores'),
    allGuildScores: state.get('allGuildScores')
  };
  state.set('schoolYearState', { activeYearKey: year, rolloverStatus: 'active', openedAt: '2026-09-07' });
  state.set('allSchoolYears', [{ id: year, startsAt: '2026-09-07' }]);
  state.set('allStudents', [...(state.get('allStudents') || []), ...students]);
  state.set('allStudentScores', [...(state.get('allStudentScores') || []), ...scores]);
  state.setAllGuildScores(docs);
}

export async function showGuildHall() {
  startShow();
  const tab = document.getElementById('guilds-tab');
  if (!tab) return;
  tab.classList.remove('hidden');
  tab.classList.add('capture-guilds');
  if (!_guildHallRestore) seedGuildHall();
  const { renderGuildsTab } = await import('../../../../ui/tabs/guilds.js');
  renderGuildsTab();
  // The vials pour on the second frame after the first paint.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export function hideGuildHall() {
  const tab = document.getElementById('guilds-tab');
  tab?.classList.add('hidden');
  tab?.classList.remove('capture-guilds');
  if (_guildHallRestore) {
    const { allGuildScores, ...rest } = _guildHallRestore;
    Object.entries(rest).forEach(([k, v]) => state.set(k, v));
    state.set('allGuildScores', allGuildScores);
    _guildHallRestore = null;
  }
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

const QUIZ_CAST = ['Alex', 'Chloe', 'Dimitris', 'Eleni', 'Jonas', 'Maria', 'Nikos', 'Sofia', 'Yiannis', 'Zoe', 'Leo', 'Anna']
  .map((name) => ({ name, avatar: null }));

// The live stage's own markup (ui/modals/quizStageMarkup.js) with sample data, so the guidebook never drifts.
function quizIntroHtml() {
  return stageIntroHtml({ questionCount: 8, contestants: QUIZ_CAST, absentCount: 1, topic: 'Mix · Simple Present, Daily Routines' });
}

function quizQuestionHtml() {
  return quizTurnHtml({
    question: {
      question: 'Choose the correct sentence.',
      options: ['She go to school every day.', 'She goes to school every day.', 'She going to school every day.', 'She gone to school every day.']
    },
    questionNumber: 3,
    total: 8,
    attemptNumber: 2,
    student: { name: 'Sofia', avatar: null },
    stars: 18,
    trail: ['first', 'late'],
    firstTryCount: 1,
    triedIndexes: [0]
  }).replace('class="qs-answer" data-gem="b"', 'class="qs-answer is-picked is-correct" data-gem="b"')
    .replace('<div id="quiz-explanation-area" class="qs-verdict hidden" role="status"></div>',
      `<div id="quiz-explanation-area" class="qs-verdict qs-verdict--correct" role="status">${quizVerdictHtml({ kind: 'correct', attemptNumber: 2, explanation: 'With he, she or it we add -s: she goes.' })}</div>`)
    .replace('class="qs-btn qs-btn--quiet" id="quiz-skip-btn"', 'class="qs-btn qs-btn--quiet hidden" id="quiz-skip-btn"')
    .replace('class="qs-btn qs-btn--go hidden" id="quiz-next-btn"', 'class="qs-btn qs-btn--go" id="quiz-next-btn"');
}

function quizResultsHtml() {
  const hero = (id, name, guildId, firstTry, rescues = 0) => {
    const stars = Math.min(2, firstTry + rescues * 0.5);
    return { id, name, avatar: null, guildId, firstTry, rescues, correctCount: firstTry + rescues, attemptedCount: Math.max(1, firstTry + rescues), brave: stars === 0, awardedStars: stars, awardedGold: stars || 1 };
  };
  const heroes = [hero('s1', 'Sofia', 'owl_wisdom', 2), hero('s2', 'Nikos', 'dragon_flame', 1, 1), hero('s3', 'Eleni', 'phoenix_rising', 1), hero('s4', 'Jonas', 'grizzly_might', 1), hero('s5', 'Zoe', 'owl_wisdom', 0, 1), hero('s6', 'Leo', 'dragon_flame', 0)];
  const guild = (id, glory, names) => ({ guildId: id, name: GUILDS[id].name, emoji: GUILDS[id].emoji, primary: GUILDS[id].primary, glory, contributors: names.map((name) => ({ name, correctCount: 1 })) });
  const stat = (question, correctIndex, correctAnswer, firstTryCorrect, solved = true) => ({ question, correctIndex, correctAnswer, firstTryCorrect, solved, asked: true });
  return stageResultsHtml({
    totalQuestions: 8,
    correctFirstTry: 7,
    firstTryCorrectPct: 88,
    rewards: {
      tier: 'epic',
      questBonus: 2,
      studentRewards: heroes.map((h) => ({ studentId: h.id, stars: h.awardedStars, gold: h.awardedGold })),
      correctStudentDetails: heroes,
      guildDetails: [guild('owl_wisdom', 5, ['Sofia', 'Zoe']), guild('dragon_flame', 3, ['Nikos']), guild('phoenix_rising', 2, ['Eleni']), guild('grizzly_might', 2, ['Jonas'])],
      prize: { studentId: 's1', kind: 'treasure', item: { name: 'Autumn Leaf Lantern', icon: '🏮', description: 'A paper lantern that glows like October leaves.' } }
    },
    questionStats: [
      stat('What is the opposite of "early"?', 0, 'late', true),
      stat('Choose the correct sentence.', 1, 'She goes to school every day.', false),
      stat('Which word is a fruit?', 1, 'banana', true)
    ]
  });
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
  content.innerHTML = screen === 'question' ? quizQuestionHtml() : screen === 'results' ? quizResultsHtml() : quizIntroHtml();
}

export function hideQuizPlay() {
  const modal = document.getElementById('quiz-of-week-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-quiz-play');
}
