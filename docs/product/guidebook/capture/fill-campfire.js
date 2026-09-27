/** Live Hero Campfire and Ember Oaths chrome for guidebook capture (real modules, no CSS mockups). */

import * as state from '../../../../state.js';
import { buildCampfireScript } from '../../../../features/heroCampfireCore.mjs';
import { getLeagueBand } from '../../../../features/languageScaffolds.mjs';
import { createOathDraft, addOathCheckIn, oathTemplates } from '../../../../features/emberOathCore.mjs';
import { getLocalIsoDateString } from '../../../../utils.js';
import { hideAppScreen, hideExtras } from './fill-extras.js';

const CLASS_ID = 'guide-jb';
const LEAGUE = 'Junior B';
const DATE = '2026-08-30';

function face(emoji, bg) {
  return 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="' + bg + '"/><text x="32" y="44" font-size="32" text-anchor="middle">' + emoji + '</text></svg>'
  );
}

const STUDENTS = [
  { id: 'a', name: 'Alex', guildId: 'dragon_flame', avatar: face('🦊', '#fde68a') },
  { id: 'b', name: 'Maya', guildId: 'owl_wisdom', avatar: face('🐼', '#bfdbfe') },
  { id: 'c', name: 'Sam', guildId: 'grizzly_might' },
  { id: 'd', name: 'Robin', guildId: 'phoenix_rising', avatar: face('🦁', '#fecdd3') },
  { id: 'e', name: 'Eleni', avatar: face('🐯', '#fed7aa') },
  { id: 'f', name: 'Nikos' },
  { id: 'g', name: 'Sofia', guildId: 'owl_wisdom' },
  { id: 'h', name: 'Yannis', avatar: face('🐸', '#bbf7d0') }
];

function seedRoster() {
  const cls = {
    id: CLASS_ID,
    name: 'Junior B · Tuesday',
    questLevel: LEAGUE,
    campfireEnabled: true,
    classOath: null
  };
  state.set('allTeachersClasses', [cls]);
  state.set('allStudents', STUDENTS.map((s) => ({ ...s, classId: CLASS_ID })));
  state.set('allAwardLogs', [
    { studentId: 'a', reason: 'teamwork', stars: 1, date: DATE, classId: CLASS_ID },
    { studentId: 'a', reason: 'focus', stars: 1, date: DATE, classId: CLASS_ID }
  ]);
  state.set('allWrittenScores', []);
  state.set('allAttendanceRecords', []);
  return cls;
}

function studioOaths(today) {
  const t = oathTemplates(LEAGUE);
  const base = { classId: CLASS_ID, teacherId: 'guide', schoolYearKey: '2026-2027', date: '2026-08-18' };
  let n = 0;
  const make = (tpl, studentId, extra = {}) => ({
    id: 'guide-oath-' + (++n),
    ...createOathDraft(tpl, { ...base, studentId }),
    ...extra
  });
  return [
    make(t[0], 'a', {
      checkIns: [{ date: '2026-08-25', mood: 'candle' }, { date: today, mood: 'flame' }],
      evidence: [
        { kind: 'manual', label: 'Spoke up in English', date: '2026-08-22', refId: 'x1' },
        { kind: 'manual', label: 'Asked a question in English', date: '2026-08-27', refId: 'x2' }
      ]
    }),
    make(t[5], 'b', {
      private: true,
      projectorText: 'A secret oath',
      evidence: [{ kind: 'virtue', label: 'Teamwork observed', date: '2026-08-26', refId: 'x3' }]
    }),
    make(t[1], 'd', { checkIns: [{ date: '2026-08-26', mood: 'moon' }] }),
    make(t[4], 'e'),
    make(t[2], 'a', { status: 'kept', legendLine: 'Kept a promise.', keptAt: { seconds: 1 } }),
    make(t[3], 'h', { status: 'kept', legendLine: 'Kept a promise.', keptAt: { seconds: 2 } })
  ];
}

function previewApi(oaths, cls) {
  const today = getLocalIsoDateString();
  return {
    oathContext: () => ({ teacherId: 'guide', schoolYearKey: '2026-2027' }),
    loadEmberOaths: async () => oaths.map((o) => ({ ...o })),
    ensureEmberOathsListener() {},
    createEmberOath: async (tpl, o) => {
      const oath = {
        id: 'guide-new',
        ...createOathDraft(tpl, {
          classId: CLASS_ID, teacherId: 'guide', schoolYearKey: '2026-2027',
          date: today, studentId: o.studentId, text: o.text, private: !!o.private
        })
      };
      oaths.push(oath);
      return oath;
    },
    checkInEmberOath: async (id, mood) => {
      const o = oaths.find((x) => x.id === id);
      o.checkIns = addOathCheckIn(o, mood, today);
      return { ...o };
    },
    addEmberEvidence: async () => {},
    getOathFacts: async () => ({ awards: [], writtenScores: [], quizzes: [], today }),
    keepEmberOath: async (id) => {
      const o = oaths.find((x) => x.id === id);
      Object.assign(o, { status: 'kept', legendLine: 'Kept a promise: ' + o.text, keptAt: { seconds: Date.now() / 1000 } });
      return { ...o };
    },
    releaseEmberOath: async (id) => { oaths.find((x) => x.id === id).status = 'released'; },
    setClassCampfireEnabled: async (_id, on) => { cls.campfireEnabled = on; }
  };
}

export function hideCampfire() {
  window.dispatchEvent(new CustomEvent('gcq:campfire-close'));
  document.getElementById('hero-campfire-scene')?.remove();
  const modal = document.getElementById('ember-oaths-modal');
  modal?.classList.add('hidden');
  modal?.classList.remove('capture-eo');
}

export async function showOathBoard() {
  hideExtras();
  hideCampfire();
  hideAppScreen();
  try { localStorage.setItem('gcq_campfire_sound', 'off'); } catch { /* capture is silent */ }
  const cls = seedRoster();
  const today = getLocalIsoDateString();
  const oaths = studioOaths(today);
  state.set('allEmberOaths', oaths);
  const { openOathBoard } = await import('../../../../ui/modals/emberOaths.js');
  await openOathBoard(CLASS_ID, { preview: { api: previewApi(oaths, cls) } });
  const modal = document.getElementById('ember-oaths-modal');
  modal?.classList.add('capture-eo');
}

function scenePayload() {
  seedRoster();
  const present = STUDENTS.slice(0, 4);
  const script = buildCampfireScript({
    league: LEAGUE,
    date: DATE,
    presentIds: present.map((s) => s.id),
    recentQuestionKeys: [],
    words: ['family', 'home', 'friend', 'lion'],
    atlasWords: [
      { w: 'family', pos: 'n', example: 'We are five people in my family.' },
      { w: 'home', pos: 'n', example: 'My home is near the school.' },
      { w: 'friend', pos: 'n', example: 'My friend is kind.' },
      { w: 'lion', pos: 'n', example: 'A lion lives in the wild.' }
    ],
    continuity: 'first',
    random: () => 0,
    lessonTarget: {
      bookId: 'primary-path-1', component: 'sb', unit: 1, page: 8,
      summary: 'Cambridge Primary Path 1 · Unit 1 · What is a family? · p. 8',
      theme: '', bigQuestion: 'What is a family?', grammar: 'be: affirmative, negative and questions'
    },
    next: { nextBigQuestion: 'What is school like?' }
  });
  const oaths = present.map((s, i) => ({
    id: 'scene-o' + i,
    studentId: s.id,
    private: i === 1,
    text: ['I share an idea in English.', 'A personal promise', 'I help someone take a turn.', 'I practise a little between lessons.'][i],
    projectorText: i === 1 ? 'A secret promise' : ['I share an idea in English.', 'A personal promise', 'I help someone take a turn.', 'I practise a little between lessons.'][i],
    status: 'active',
    checkIns: i === 0 ? [{ date: DATE, mood: 'flame' }] : i === 2 ? [{ date: DATE, mood: 'candle' }] : [],
    evidence: i === 0 ? [{ kind: 'manual', date: DATE, label: 'Shared a sentence' }] : []
  }));
  oaths.push(
    { id: 'old1', studentId: 'a', status: 'kept', category: 'speak', legendLine: 'A little courage, shared.', keptAt: { seconds: 1 } },
    { id: 'old1b', studentId: 'e', status: 'kept', category: 'speak', legendLine: 'Another spoken promise.', keptAt: { seconds: 2 } },
    { id: 'old4', studentId: 'd', status: 'kept', category: 'words', legendLine: 'New words, used with care.', keptAt: { seconds: 3 } },
    { id: 'old4b', studentId: 'f', status: 'kept', category: 'words', legendLine: 'A new word, spoken.', keptAt: { seconds: 4 } },
    { id: 'old5', studentId: 'h', status: 'kept', category: 'write', legendLine: 'A sentence, improved.', keptAt: { seconds: 5 } },
    { id: 'old5b', studentId: 'g', status: 'kept', category: 'write', legendLine: 'A little extra, written.', keptAt: { seconds: 6 } },
    { id: 'old6', studentId: 'c', status: 'kept', category: 'read/listen', legendLine: 'A story, retold.', keptAt: { seconds: 7 } },
    { id: 'old6b', studentId: 'b', status: 'kept', category: 'read/listen', legendLine: 'A question, answered from the page.', keptAt: { seconds: 8 } },
    { id: 'old3', studentId: 'b', status: 'kept', category: 'habit', legendLine: 'A small habit, kept.', keptAt: { seconds: 9 } },
    { id: 'old3b', studentId: 'c', status: 'kept', category: 'habit', legendLine: 'Ready to learn, again.', keptAt: { seconds: 10 } },
    { id: 'old2', studentId: 'a', status: 'kept', category: 'virtue', legendLine: 'A kind hand, offered.', keptAt: { seconds: 11 } },
    { id: 'old2b', studentId: 'd', status: 'kept', category: 'virtue', legendLine: 'A friend, invited in.', keptAt: { seconds: 12 } }
  );
  script.readyOathIds = ['scene-o0'];
  return {
    session: {
      id: 'guide-campfire', classId: CLASS_ID, date: DATE, stars: 22, starsToday: 22,
      league: LEAGUE, band: getLeagueBand(LEAGUE), status: 'lit', script, heroStudentId: 'a'
    },
    students: present,
    oaths
  };
}

export async function showCampfireScene(stage = 'circle') {
  hideExtras();
  hideCampfire();
  hideAppScreen();
  try { localStorage.setItem('gcq_campfire_sound', 'off'); } catch { /* capture is silent */ }
  const { session, students, oaths } = scenePayload();
  const { openCampfireScene } = await import('../../../../features/campfire/campfireScene.js');
  const opened = openCampfireScene({
    session, students, oaths, preview: true,
    performance: { reducedMotion: true, tier: 'mid', particles: 90, fps: 30, dpr: 1.5 }
  });
  opened.element.classList.add('capture-cf');
  opened.goTo(stage);
  return opened.element;
}
