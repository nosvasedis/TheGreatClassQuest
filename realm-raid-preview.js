// Realm Raid preview: the hall, the victory moment and the projector card on a made-up school,
// no Firebase. /realm-raid-preview.html?season=winter|carnival|summer&phase=herald|active|broken|legendary|won|held
//   &view=hall|victory|card|help[&lite=1][&shot=1][&focus=<classId>]
import './styles/realm_raid.css';
import './styles/realm_raid_card.css';
import { raidWindow, findRaid, computeShares, raidStatus, addDays, dayKey } from './features/realmRaidCore.mjs';
import { hallHtml, howItWorksHtml, victoryHtml, raidCardHtml, skyHtml } from './ui/modals/realmRaidView.mjs';
import { guardianSvg } from './features/realmRaidArt.mjs';

const params = new URLSearchParams(location.search);
const seasonId = ['winter', 'carnival', 'summer'].includes(params.get('season')) ? params.get('season') : 'winter';
const phase = params.get('phase') || 'active';
const viewName = params.get('view') || 'hall';
const lite = params.has('lite');
if (params.has('shot')) document.body.classList.add('pv-shot');

const holidays = [{ start: '2026-12-23', end: '2027-01-07' }];
const raid = raidWindow(seasonId, 2026, { holidays });
const day = phase === 'herald' ? addDays(raid.start, -3) : (phase === 'won' || phase === 'held') ? addDays(raid.end, 2) : addDays(raid.start, 4);
const live = findRaid(day, { holidays });

const CLASSES = [
    ['c1', 'Little Owls', '🦉', 'Pre-Junior', ['1', '3'], 9],
    ['c2', 'Star Foxes', '🦊', 'A', ['2', '4'], 12],
    ['c3', 'Dragon Riders', '🐉', 'B', ['1', '4'], 14],
    ['c4', 'Sea Turtles', '🐢', 'Pre-Junior', ['5'], 7],
    ['c5', 'Moon Wolves', '🐺', 'C', ['2'], 11],
    ['c6', 'Sun Lions', '🦁', 'D', ['3', '5'], 15],
    ['c7', 'Bright Bees', '🐝', 'A', ['1'], 8],
    ['c8', 'Thunder Hawks', '🦅', 'B', ['2', '5'], 13],
    ['c9', 'Crystal Cats', '🐱', 'C', ['4'], 10],
    ['c10', 'Ocean Whales', '🐋', 'D', ['3'], 9]
];
const classes = CLASSES.map(([id, name, logo, questLevel, scheduleDays, heroes]) => ({ id, name, logo, questLevel, scheduleDays, heroes, createdBy: { uid: id === 'c3' || id === 'c7' ? 'me' : 'other' } }));
const heroCounts = Object.fromEntries(classes.map((c) => [c.id, c.heroes]));
const meets = (id, d) => classes.find((c) => c.id === id).scheduleDays.includes(String(d.getDay()));
const shares = computeShares({ raid, classes, heroCounts, meets });

// How full each class's shard is, by the phase shown.
const FILL = {
    herald: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    active: [1.15, 0.8, 0.62, 1.02, 0.3, 0.55, 0.9, 0.4, 0.2, 0.45],
    broken: [1.3, 1.1, 1.02, 1.1, 0.85, 0.98, 1.2, 0.95, 0.9, 0.8],
    legendary: [1.5, 1.3, 1.2, 1.4, 1.0, 1.15, 1.35, 1.1, 1.05, 1.2],
    won: [1.3, 1.05, 1.02, 1.1, 0.8, 0.95, 1.2, 0.9, 0.85, 0.9],
    held: [1.1, 0.7, 0.6, 1.0, 0.3, 0.6, 0.8, 0.5, 0.4, 0.5]
}[phase] || [];
const byClass = {};
shares.forEach((s, i) => { if (s.share) byClass[s.classId] = Math.round(s.share * (FILL[i] || 0) * 2) / 2; });
const status = raidStatus({ shares, tally: { byClass } });
const today = dayKey(day);
const rows = status.classes.map((row) => {
    const cls = classes.find((c) => c.id === row.classId);
    return {
        ...row,
        name: cls.name,
        logo: cls.logo,
        league: cls.questLevel,
        own: cls.createdBy.uid === 'me',
        receipt: null,
        nextLesson: row.lessonDates.find((d) => d >= today) || null,
        lessonsLeft: row.lessonDates.filter((d) => d >= today).length
    };
});
const next = raidWindow(seasonId === 'winter' ? 'carnival' : seasonId === 'carnival' ? 'summer' : 'winter', seasonId === 'summer' ? 2027 : 2026, { holidays });
const view = { raid: live, status, rows, tally: { byClass, byHero: {} }, record: {}, loading: false, next };
const focusId = params.get('focus') || 'c3';
const heroCard = params.has('hero') ? {
    name: 'Maria Papadopoulou', days: 2, stars: 5.5,
    faceHtml: '<span class="ct-face rr-hero__face" style="--ct-tone:#ec4899">M</span>',
    prize: { kind: 'treasure', name: seasonId === 'winter' ? 'Starlit Snow Globe' : 'Masquerade Mask', icon: seasonId === 'winter' ? '🌟' : '🎭' }
} : null;

const root = document.getElementById('pv-root');
if (viewName === 'coats') {
    root.innerHTML = `<div style="position:fixed;inset:0;display:grid;grid-template-columns:repeat(3,1fr);">${['winter', 'carnival', 'summer'].map((s, i) => `
        <div class="rr-hall--${s}" style="position:relative;overflow:hidden;display:grid;place-items:center;">
            ${skyHtml(s, { lite })}
            <div style="position:relative;width:86%;">${guardianSvg(s, { mood: i === 1 ? 'brace' : 'proud', id: 'pc' + s })}</div>
            <p style="position:absolute;bottom:4%;left:0;right:0;text-align:center;color:#fff;font:400 1.4rem 'Fredoka One',sans-serif;">${s[0].toUpperCase() + s.slice(1)} Coat</p>
        </div>`).join('')}</div>`;
} else if (viewName === 'victory') {
    root.innerHTML = `<div class="rr-host rr-host--victory is-open">${victoryHtml(view, { legendary: phase === 'legendary', lite })}</div>`;
} else if (viewName === 'card') {
    root.innerHTML = `<div class="pv-card"><div class="sky-card"><h3>🛡️ ${live.season.name}</h3>${raidCardHtml(view, { focusId })}</div></div>`;
} else {
    root.innerHTML = `<div class="rr-host is-open">${hallHtml(view, { focusId, heroCard, canReveal: params.has('reveal'), lite })}</div>`;
    if (viewName === 'help') root.querySelector('.rr-hall').insertAdjacentHTML('beforeend', howItWorksHtml(view));
}

const links = [];
for (const s of ['winter', 'carnival', 'summer']) links.push(`<a href="?season=${s}&phase=${phase}&view=${viewName}">${s}</a>`);
for (const p of ['herald', 'active', 'broken', 'legendary', 'won', 'held']) links.push(`<a href="?season=${seasonId}&phase=${p}&view=${viewName}">${p}</a>`);
for (const v of ['hall', 'victory', 'card', 'help', 'coats']) links.push(`<a href="?season=${seasonId}&phase=${phase}&view=${v}">${v}</a>`);
document.getElementById('pv-toolbar').innerHTML = links.join('');
