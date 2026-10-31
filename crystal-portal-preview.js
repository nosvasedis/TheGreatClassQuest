// Crystal Portal preview: the Portal modal on a made-up league, no Firebase.
// /crystal-portal-preview.html?scene=open|sealed|through|road|runes|guardian|riddle|bowed[&lite=1][&shot=1][&loading=1]
// runes: your class filled the goal but a rune sleeps; guardian: the Guardian waits;
// riddle / bowed: the Guardian's riddle card and its happy ending.
import './styles/tokens.css'; // shared fonts + tokens (this preview skips style.css)
import './styles/crystal_portal.css';
import './styles/quest_ranks.css';
import { buildPortalView } from './features/crystalPortalCore.mjs';
import { portalModalHtml, keepersHtml } from './ui/modals/crystalPortalView.mjs';
import { evaluatePortal } from './features/questRanksCore.mjs';
import { riddleHtml, endHtml } from './features/portalGuardianView.mjs';

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
if (scene === 'runes' || scene === 'guardian') rows = BASE.map((r) => (r[0] === 'c4' ? [...r.slice(0, 3), scene === 'guardian' ? 4 : 3, 306, 300, null] : r));

// A made-up Portal status per class: ten heroes, their own stars spread a little, and the
// four virtues. Through classes are marked completed (their level is already the new one).
function portalFor([id, , , level, stars, goal, completedAt]) {
    const heroes = 10;
    const each = stars / heroes;
    const heroStars = Array.from({ length: heroes }, (_, i) => Math.max(0, Math.round(each + (i % 3 - 1) * 3)));
    if (id === 'c4' && scene === 'runes') { heroStars[8] = 2; heroStars[9] = 1; heroStars[7] = 3; }
    const share = stars / 4;
    const virtueStars = { teamwork: share * 1.2, creativity: share * 0.9, respect: share, focus: id === 'c4' && scene === 'runes' ? 12 : share * 0.9 };
    return evaluatePortal({
        level: completedAt ? level - 1 : level,
        goal,
        heroStars,
        virtueStars,
        guardian: { passed: false },
        completed: Boolean(completedAt)
    });
}
const parties = rows.map((row) => {
    const [id, name, logo, level, stars, goal, completedAt] = row;
    return { id, name, logo, level, stars, goal, progress: (stars / goal) * 100, completedAt, portal: portalFor(row), owned: true };
});
const activeClassId = { open: 'c4', sealed: 'c4', through: 'c2', road: 'c4' }[scene] || 'c4';
const history = [
    { classId: 'c1', monthKey: '2026-09' },
    { classId: 'c2', monthKey: '2026-09' },
    { classId: 'c5', monthKey: '2026-09' }
];

const content = document.getElementById('milestone-modal-content');
if (scene === 'riddle' || scene === 'bowed') {
    const guardianParty = parties.find((p) => p.id === 'c2');
    const status = evaluatePortal({ level: 4, goal: 330, heroStars: Array(10).fill(34), virtueStars: { teamwork: 99, creativity: 99, respect: 99, focus: 99 } });
    const host = document.createElement('div');
    host.className = 'pg-host';
    document.body.appendChild(host);
    const session = {
        classData: guardianParty, status, questions: 3, toPass: 2,
        results: scene === 'bowed' ? [true, false, true] : [true],
        challenge: { text: 'She ___ to school every day. (go / goes / going)', answer: 'goes' }
    };
    host.innerHTML = scene === 'bowed' ? endHtml(session, true) : riddleHtml(session);
}
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

document.getElementById('pv-toolbar').innerHTML = ['open', 'sealed', 'through', 'road', 'runes', 'guardian', 'riddle', 'bowed']
    .map((s) => `<a href="?scene=${s}">${s}</a>`).join('') + `<a href="?scene=${scene}&lite=1">lite</a>`;
