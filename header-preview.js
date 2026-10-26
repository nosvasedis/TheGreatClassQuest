// Dev-only preview of the teacher header and the School Office header side by side.
// Open /header-preview.html?time=09:40 under `npm run dev`.
import { headerHTML, svgFiltersHTML } from './templates/app/header.js';
import { roleShellsHTML } from './templates/roles.js';
import { applySkyReading } from './features/skyWeatherStage.js';
import { paintHeaderDateTime, playHeaderIntro } from './ui/headerClock.js';

const params = new URLSearchParams(location.search);
const state = { time: params.get('time') || '09:40' };
if (params.get('shot') === '1') document.body.classList.add('pv-shot');

document.getElementById('app-root').innerHTML = `
    ${svgFiltersHTML}
    <div class="pv-label">Teacher</div>
    <div id="app-screen" class="flex-1 flex flex-col">
        <div id="award-header-atmosphere" class="award-header-atmosphere relative z-[60] flex shrink-0 flex-col overflow-visible shadow-md">${headerHTML}</div>
    </div>
    <div class="pv-label">School Office</div>
    ${roleShellsHTML}`;
document.getElementById('secretary-screen').classList.remove('hidden');
document.querySelector('#secretary-screen main')?.remove();
document.querySelector('#secretary-bottom-nav')?.remove();
document.getElementById('parent-screen')?.remove();
const sTitle = document.querySelector('[data-secretary-title]');
sTitle.textContent = sTitle.dataset.text = 'Secretary Office';
document.querySelectorAll('[data-school-name]').forEach((el) => { el.textContent = 'Rentis English School'; });
const q = document.getElementById('header-quote-container');
q.classList.remove('hidden');
document.getElementById('header-quote-text').innerText = 'Every small step on the road is part of the great quest.';
document.getElementById('header-class-selector-text').textContent = 'Junior B';

function atTime(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0); return d;
}
function render() {
    const now = atTime(state.time);
    const sun = { now: now.getTime(), sunrise: atTime('07:20').getTime(), sunset: atTime('18:30').getTime() };
    const scene = applySkyReading({ code: 1, temp: 17, windSpeed: 9, windDirection: 270, hours: [] }, sun);
    document.body.classList.toggle('night-mode', scene.isNight);
    document.querySelectorAll('header').forEach((h) => h.classList.toggle('header-night', scene.isNight));
    paintHeaderDateTime(now);
}
function shift(minutes) {
    const now = new Date(atTime(state.time).getTime() + minutes * 60000);
    state.time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    render();
}
const intro = () => document.querySelectorAll('header.gcq-sky-header').forEach(playHeaderIntro);
document.getElementById('pv-intro').addEventListener('click', intro);
document.getElementById('pv-minute').addEventListener('click', () => shift(1));
document.getElementById('pv-hour').addEventListener('click', () => shift(60));
window.__pv = { shift, intro, render, state };
document.getElementById('pv-time').addEventListener('change', (e) => { state.time = e.target.value; render(); });
render();
