// Preview: the Team Quest + Hero's Challenge controls and the Quest League picker, with fake data.
// Open /league-controls-preview.html?view=quest|hero|picker[&peek=1][&shot=1]
import { leaderboardTabHTML } from './templates/app/tabs/leaderboard.js';
import { baseModalsHTML } from './templates/modals/base.js';
import * as constants from './constants.js';
import { leaguePickerFollowHtml, renderLeaguePickerHtml } from './ui/modals/leaguePickerView.mjs';
import './styles/league_controls.css';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'quest';
const peek = params.get('peek') === '1';
if (params.get('shot') === '1') document.body.classList.add('pv-shot');
if (params.get('mobile') === '1') document.body.classList.add('gcq-mobile');

const loadStyles = window.__pvLoadStyles ? window.__pvLoadStyles() : Promise.resolve();

document.getElementById('pv-main').innerHTML = leaderboardTabHTML;
document.getElementById('pv-modals').innerHTML = baseModalsHTML;
document.getElementById('pv-toolbar').innerHTML = ['quest', 'hero', 'picker'].map((v) => `<a href="?view=${v}">${v}</a>`).join('') + `<a href="?view=${view}&peek=${peek ? 0 : 1}">peek</a>`;

const league = 'Junior B';
const tab = document.getElementById(view === 'hero' ? 'student-leaderboard-tab' : 'class-leaderboard-tab');
tab.classList.remove('hidden');
document.getElementById('quest-month-name').textContent = 'November';
document.getElementById('hero-month-name').textContent = 'November';
['leaderboard-league-picker-btn', 'student-leaderboard-league-picker-btn'].forEach((id) => {
  const btn = document.getElementById(id);
  const peekTag = peek
    ? '<span class="league-bar__peek" title="Peeking at another league"><span class="league-bar__peek-lens" aria-hidden="true"><i class="fas fa-eye"></i></span><span class="league-bar__peek-word">Peeking</span></span>'
    : '';
  btn.classList.toggle('is-peeking', peek);
  btn.querySelector('.league-bar__pick').innerHTML = `<span class="league-bar__pick-name">${league}</span>${peekTag}<i class="fas fa-chevron-down league-bar__pick-caret" aria-hidden="true"></i>`;
});
['leaderboard-league-match-btn', 'student-leaderboard-league-match-btn'].forEach((id) => document.getElementById(id).classList.toggle('hidden', !peek));
document.getElementById('open-prodigy-btn').removeAttribute('disabled');
document.getElementById('open-trophy-room-btn').removeAttribute('disabled');
document.getElementById('class-leaderboard-list').innerHTML = '<div class="pv-fake-list">Team Quest map / race</div>';
document.getElementById('student-leaderboard-list').innerHTML = '<div class="pv-fake-list">Hero standings</div>';

// segmented switches: click to move
document.querySelectorAll('.league-seg').forEach((seg) => {
  seg.querySelectorAll('.league-seg__btn').forEach((btn, i) => btn.addEventListener('click', () => {
    seg.style.setProperty('--seg-i', String(i));
    seg.querySelectorAll('.league-seg__btn').forEach((b, j) => { b.classList.toggle('is-active', i === j); b.setAttribute('aria-pressed', String(i === j)); });
  }));
});

function openPicker() {
  const list = document.getElementById('league-picker-list');
  const classCounts = new Map([['Pre-Junior', 2], ['Junior A', 3], ['Junior B', 4], ['A', 3], ['B', 2], ['C', 1]]);
  const myCounts = new Map([['Junior B', 2], ['A', 1]]);
  const currentLeague = peek ? 'A' : league;
  const followHtml = leaguePickerFollowHtml({ activeClass: { name: 'Junior B · Tue/Thu', logo: '🦉', questLevel: 'Junior B' }, peeking: peek, currentLeague });
  list.innerHTML = renderLeaguePickerHtml({ definitions: constants.QUEST_LEAGUE_DEFINITIONS, currentLeague, classCounts, myCounts, followHtml });
  document.getElementById('league-picker-modal').classList.remove('hidden');
}
loadStyles.then(() => { if (view === 'picker') openPicker(); });
document.getElementById('leaderboard-league-picker-btn').addEventListener('click', openPicker);
document.getElementById('student-leaderboard-league-picker-btn').addEventListener('click', openPicker);
document.getElementById('league-picker-close-btn').addEventListener('click', () => document.getElementById('league-picker-modal').classList.add('hidden'));
