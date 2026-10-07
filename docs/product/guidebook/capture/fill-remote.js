/** Quest Remote for guidebook capture: the real Wand and projector markup (pure views + real styles), no Firebase. */

import '../../../../styles/quest_remote.css';
import '../../../../styles/quest_remote_wand.css';
import { wandShellHtml, nowStripHtml, starsHtml, awardSheetHtml, magicHtml, showHtml, stageHtml } from '../../../../features/questRemote/remoteWandView.mjs';
import { bindingHtml, showdownHtml, timerHtml, starRibbonHtml } from '../../../../features/questRemote/remoteStageView.mjs';
import { createShowdown, scoreShowdown, showdownPanel, buildStageSummary } from '../../../../features/questRemote/remoteCore.mjs';
import { hideAppScreen, hideExtras } from './fill-extras.js';

const ROOT_ID = 'capture-quest-remote';

function face(emoji, bg) {
  return 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="' + bg + '"/><text x="32" y="44" font-size="32" text-anchor="middle">' + emoji + '</text></svg>'
  );
}

const HEROES = [
  { id: 'a', first: 'Alex', avatar: face('🦊', '#fde68a'), stars: 2 },
  { id: 'b', first: 'Maya', avatar: face('🐼', '#bfdbfe'), stars: 0 },
  { id: 'c', first: 'Sam', avatar: '', stars: 1 },
  { id: 'd', first: 'Robin', avatar: face('🦁', '#fecdd3'), stars: 0 },
  { id: 'e', first: 'Eleni', avatar: face('🐯', '#fed7aa'), stars: 0, pending: true },
  { id: 'f', first: 'Nikos', avatar: '', stars: 0, away: true },
  { id: 'g', first: 'Sofia', avatar: face('🦉', '#ddd6fe'), stars: 3 },
  { id: 'h', first: 'Yannis', avatar: face('🐸', '#bbf7d0'), stars: 0 },
  { id: 'i', first: 'Daphne', avatar: face('🐬', '#bae6fd'), stars: 0 }
];

function sampleShowdown() {
  let sd = createShowdown([
    { name: 'Foxes', color: '#f97316', emoji: '🦊' },
    { name: 'Dolphins', color: '#0ea5e9', emoji: '🐬' },
    { name: 'Turtles', color: '#10b981', emoji: '🐢' },
    { name: 'Bees', color: '#eab308', emoji: '🐝' }
  ], { title: '📚 Junior B · Tuesday' });
  [0, 1, 0, 0, 2, 0, 1, 3].forEach((i) => { sd = scoreShowdown(sd, i); });
  return sd;
}

/** The Training Grounds as the Wand mirrors it: the game tabs, then that game's own controls. */
function trainingStage() {
  const g = 'Training Grounds games';
  return buildStageSummary({
    surface: 'tab', tab: 'reward-ideas-tab', title: 'Training Grounds',
    padActions: [
      { id: 'g1', label: 'Story Weavers', icon: 'fa-feather', kind: 'tab', on: false, group: g, x: 0.2, y: 0.12, inView: true, bg: '#ec4899', bg2: '#be185d', fg: '#ffffff', round: 'soft' },
      { id: 'g2', label: 'The Vanishing Hoard', icon: 'fa-gem', kind: 'tab', on: true, group: g, x: 0.4, y: 0.12, inView: true, bg: '#f59e0b', bg2: '#c2410c', fg: '#5b2408', round: 'soft' },
      { id: 'g3', label: 'The Torn Map', icon: 'fa-map', kind: 'tab', on: false, group: g, x: 0.6, y: 0.12, inView: true, bg: '#8b5cf6', bg2: '#4338ca', fg: '#ffffff', round: 'soft' },
      { id: 'g4', label: 'The Round Table', icon: 'fa-users', kind: 'tab', on: false, group: g, x: 0.8, y: 0.12, inView: true, bg: '#10b981', bg2: '#047857', fg: '#ffffff', round: 'soft' },
      { id: 'h1', label: 'Use lesson words', kind: 'toggle', on: true, group: 'The Vanishing Hoard', x: 0.25, y: 0.4, inView: true },
      { id: 'h2', label: 'Lesson words, separated by commas', kind: 'text', multiline: true, value: 'castle, lantern, brave', placeholder: 'castle, lantern, brave…', group: 'The Vanishing Hoard', x: 0.5, y: 0.46, inView: true },
      { id: 'h3', label: 'Hide the treasure', icon: 'fa-eye-slash', group: 'The Vanishing Hoard', x: 0.4, y: 0.62, inView: true, bg: '#f59e0b', bg2: '#c2410c', fg: '#ffffff', round: 'pill' },
      { id: 'h4', label: 'Reveal', icon: 'fa-eye', group: 'The Vanishing Hoard', x: 0.6, y: 0.62, inView: true, bg: '#ffffff', fg: '#7c2d12', border: '#fdba74', round: 'pill' },
      { id: 'h5', label: 'How to play', icon: 'fa-circle-question', group: 'The Vanishing Hoard', x: 0.5, y: 1.2, inView: false, bg: '#fff7ed', fg: '#9a3412', round: 'soft' }
    ],
    scrollable: true
  });
}

function mount(html, cls) {
  hideRemote();
  hideExtras();
  hideAppScreen();
  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.className = cls;
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

export function hideRemote() {
  document.getElementById(ROOT_ID)?.remove();
}

/** The phone: `stars` (hero orbs), `several` (choosing heroes), `award` (the star to flick), `magic`, `show`, `stage`. */
export function showWand(view = 'stars') {
  const mode = view === 'award' || view === 'several' ? 'stars' : view === 'controls' ? 'stage' : view;
  const root = mount(`<div class="qw qw-still is-in" data-phase="bound">${wandShellHtml({})}</div>`, 'capture-wand');
  const qw = root.querySelector('.qw');
  qw.querySelector('[data-qw-link]').dataset.state = 'bound';
  qw.querySelector('[data-qw-link-text]').textContent = 'Bound · K M 4 R';
  qw.querySelector('[data-qw-class]').textContent = '📚 Junior B';
  qw.dataset.mode = mode;
  qw.querySelectorAll('[data-qw-mode]').forEach((b) => b.classList.toggle('is-on', b.dataset.qwMode === mode));
  const now = qw.querySelector('[data-qw-now]');
  if (now) now.innerHTML = nowStripHtml({ tab: 'about-tab', title: 'Home', covered: false, timer: mode === 'magic' ? { remainingMs: 42000, total: 60, label: 'Pair' } : null });
  const sd = sampleShowdown();
  const stage = buildStageSummary({
    surface: 'overlay', tab: 'guilds-tab', title: "Fortune's Wheel",
    padActions: [
      { id: 'p2', label: 'Close Fortune’s Wheel', icon: 'fa-times', x: 0.93, y: 0.06, inView: true, bg: '#1e293b', fg: '#e2e8f0', round: 'pill', iconOnly: true },
      { id: 'p1', label: 'Spin!', icon: 'fa-dharmachakra', x: 0.5, y: 0.82, inView: true, bg: '#fbbf24', bg2: '#d97706', fg: '#451a03', round: 'pill', group: 'Dragon Flame at the wheel' },
      { id: 'p3', label: 'Skip this guild', icon: 'fa-forward', x: 0.62, y: 0.82, inView: true, bg: '#ffffff', fg: '#334155', border: '#cbd5e1', round: 'soft', group: 'Dragon Flame at the wheel' },
      { id: 'p4', label: 'Fortune Ledger', icon: 'fa-book', x: 0.5, y: 1.3, inView: false, bg: '#7c3aed', fg: '#ffffff', round: 'soft', group: 'This week' }
    ],
    panel: { kind: 'wheel', ready: true, caption: 'Dragon Flame steps up to the wheel.', next: '' }
  });
  let html = '';
  if (mode === 'stars') html = starsHtml(HEROES, { className: '📚 Junior B', multi: view === 'several', picked: view === 'several' ? ['b', 'd', 'h'] : [], note: view === 'stars' ? 'Award Stars opens on the projector with your first star.' : '' });
  else if (mode === 'magic') html = magicHtml({ timer: { label: 'Pair', total: 60, remainingMs: 42000 }, blackout: false, wall: false });
  else if (mode === 'show') html = showHtml({ panel: showdownPanel(sd) });
  else if (view === 'controls') html = stageHtml(trainingStage(), { castAllowed: () => true });
  else html = stageHtml({ ...stage, scroll: { canUp: true, canDown: true, at: 0.35 } }, { castAllowed: () => true });
  qw.querySelector('[data-qw-main]').innerHTML = `<div class="qw-view">${html}</div>`;
  if (view === 'award') {
    const sheet = qw.querySelector('[data-qw-sheet]');
    sheet.innerHTML = awardSheetHtml(HEROES[1], { reason: 'teamwork', size: 'auto' });
    sheet.classList.add('is-open');
  }
}

/** The projector: `bind` (the rune circle), `showdown` (the arena), `timer` (the ember ring over a dark stage). */
export async function showProjectorRemote(view = 'bind') {
  if (view === 'bind') {
    let qr = '';
    try {
      const { renderQrSvg } = await import('../../../../features/familyAccessKit.js');
      qr = await renderQrSvg('https://great-class-quest-school.pages.dev/#wand=wguidebook0000', { color: '#1e1b4b', accent: '#d97706', title: 'Quest Remote', emblem: true });
    } catch { /* the circle still shows */ }
    mount(`<div class="qr-bind is-open" style="position:relative;inset:auto;width:1100px;height:820px">${bindingHtml({ qrSvg: qr, code: 'KM4R' })}</div>`, 'capture-qr');
    return;
  }
  if (view === 'ribbon') {
    mount(`<div class="capture-qr-timer-stage capture-qr-ribbon-stage"><div class="qr-ribbon is-in" style="position:absolute;animation:none;opacity:1;transform:translate(-50%,0)">${starRibbonHtml({ name: 'Maya', avatar: face('🐼', '#bfdbfe'), stars: 2, reason: 'teamwork' })}</div></div>`, 'capture-qr');
    return;
  }
  if (view === 'showdown') {
    mount(`<div class="qr-sd is-in" style="position:relative;inset:auto;width:1280px;height:760px">${showdownHtml(sampleShowdown(), { secondsLeft: 7 })}</div>`, 'capture-qr');
    return;
  }
  mount(`<div class="capture-qr-timer-stage"><div class="qr-timer is-in" style="position:absolute;top:40px;right:40px">${timerHtml({ label: 'Think', seconds: 30, remainingMs: 19000 })}</div></div>`, 'capture-qr');
}
