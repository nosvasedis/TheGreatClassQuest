// Crystal Portal preview: the Portal modal on a made-up league, no Firebase.
// /crystal-portal-preview.html?scene=open|sealed|through|road[&lite=1][&shot=1][&loading=1]
import './styles/crystal_portal.css';
import { buildPortalView } from './features/crystalPortalCore.mjs';
import { portalModalHtml, keepersHtml } from './ui/modals/crystalPortalView.mjs';

const params = new URLSearchParams(location.search);
const scene = params.get('scene') || 'open';
if (params.has('shot')) document.body.classList.add('pv-shot');

const monthKey = '2026-10';
const monthKeys = ['2026-09', '2026-10'];
const at = (day, hour) => new Date(2026, 9, day, hour).getTime();

const BASE = [
    ['c1', 'Star Foxes', '🦊', 3, 312, 300, at(6, 11)],
    ['c2', 'Dragon Riders', '🐉', 4, 340, 330, at(7, 13)],
    ['c3', 'Moon Wolves', '🐺', 2, 268, 260, at(9, 10)],
    ['c4', 'Thunder Hawks', '🦅', 3, 281, 300, null],
    ['c5', 'Crystal Cats', '🐱', 2, 247, 270, null],
    ['c6', 'Sea Turtles', '🐢', 2, 160, 250, null],
    ['c7', 'Bright Bees', '🐝', 1, 95, 240, null]
];
let rows = BASE;
if (scene === 'sealed') rows = BASE.map(([id, n, l, lv, s, g]) => [id, n, l, lv, Math.min(s, Math.floor(g * 0.93)), g, null]);
if (scene === 'road') rows = BASE.map((r) => (r[0] === 'c4' ? [...r.slice(0, 4), 150, 300, null] : r));
const parties = rows.map(([id, name, logo, level, stars, goal, completedAt]) => ({ id, name, logo, level, stars, goal, progress: (stars / goal) * 100, completedAt }));
const activeClassId = { open: 'c4', sealed: 'c4', through: 'c2', road: 'c4' }[scene] || 'c4';
const history = [
    { classId: 'c1', monthKey: '2026-09' },
    { classId: 'c2', monthKey: '2026-09' },
    { classId: 'c5', monthKey: '2026-09' }
];

const content = document.getElementById('milestone-modal-content');
const opts = { league: 'B', monthKey, activeClassId, lite: params.has('lite') };
content.innerHTML = portalModalHtml(buildPortalView({ parties, activeClassId, monthKey, monthKeys }), opts);
if (!params.has('loading')) {
    setTimeout(() => {
        const slot = content.querySelector('[data-portal-keepers]');
        if (!slot) return;
        slot.innerHTML = keepersHtml(buildPortalView({ parties, activeClassId, history, monthKey, monthKeys }), { activeClassId });
        slot.classList.add('is-loaded');
    }, 400);
}

document.getElementById('pv-toolbar').innerHTML = ['open', 'sealed', 'through', 'road']
    .map((s) => `<a href="?scene=${s}">${s}</a>`).join('') + `<a href="?scene=${scene}&lite=1">lite</a>`;
