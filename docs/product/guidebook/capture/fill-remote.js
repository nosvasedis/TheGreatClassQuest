/** Quest Remote for guidebook capture: the real Wand and projector markup (pure views + real styles), no Firebase. */

import '../../../../styles/quest_remote.css';
import '../../../../styles/quest_remote_wand.css';
import { wandShellHtml, starsHtml, awardSheetHtml, magicHtml, showHtml, stageHtml } from '../../../../features/questRemote/remoteWandView.mjs';
import { bindingHtml, showdownHtml, timerHtml } from '../../../../features/questRemote/remoteStageView.mjs';
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

/** The phone: `stars` (hero orbs), `award` (the award card with the star to flick), `magic`, `show`, `stage`. */
export function showWand(view = 'stars') {
  const mode = view === 'award' ? 'stars' : view;
  const root = mount(`<div class="qw qw-still is-in" data-phase="bound">${wandShellHtml({})}</div>`, 'capture-wand');
  const qw = root.querySelector('.qw');
  qw.querySelector('[data-qw-link]').dataset.state = 'bound';
  qw.querySelector('[data-qw-link-text]').textContent = 'Bound · K M 4 R';
  qw.querySelector('[data-qw-class]').textContent = '📚 Junior B';
  qw.querySelectorAll('[data-qw-mode]').forEach((b) => b.classList.toggle('is-on', b.dataset.qwMode === mode));
  const sd = sampleShowdown();
  const stage = buildStageSummary({
    surface: 'overlay', tab: 'guilds-tab', title: "Fortune's Wheel",
    padActions: [{ id: 'p1', label: 'Spin!', icon: 'fa-dharmachakra', explicit: true, primary: true }, { id: 'p2', label: 'Close', icon: 'fa-times' }],
    panel: { kind: 'wheel', ready: true, caption: 'Dragon Flame steps up to the wheel.', next: '' }
  });
  let html = '';
  if (mode === 'stars') html = starsHtml(HEROES, { className: '📚 Junior B' });
  else if (mode === 'magic') html = magicHtml({ timer: { label: 'Pair', total: 60, remainingMs: 42000 }, blackout: false, wall: false });
  else if (mode === 'show') html = showHtml({ panel: showdownPanel(sd) });
  else html = stageHtml(stage, { castAllowed: () => true });
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
  if (view === 'showdown') {
    mount(`<div class="qr-sd is-in" style="position:relative;inset:auto;width:1280px;height:760px">${showdownHtml(sampleShowdown(), { secondsLeft: 7 })}</div>`, 'capture-qr');
    return;
  }
  mount(`<div class="capture-qr-timer-stage"><div class="qr-timer is-in" style="position:absolute;top:40px;right:40px">${timerHtml({ label: 'Think', seconds: 30, remainingMs: 19000 })}</div></div>`, 'capture-qr');
}
