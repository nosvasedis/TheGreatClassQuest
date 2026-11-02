// Familiar Habitat preview: the real Den with sample students, no Firebase writes.
//   npx vite --config ceremony-preview.vite.mjs --port 3007
//   /familiar-den-preview.html?type=emberfang&level=3[&egg=1][&time=dawn|day|dusk|night][&season=spring|summer|autumn|winter][&weather=...][&seed=x][&shot=1]
import * as state from './state.js';
import { FAMILIAR_TYPES, openFamiliarStatsOverlay } from './features/familiars.js';
import { FAMILIAR_STAGE_BOND } from './features/familiarProgression.mjs';

const params = new URLSearchParams(location.search);
const typeId = params.get('type') || 'emberfang';
const egg = params.has('egg');
const level = egg ? 0 : Math.max(1, Math.min(5, Number(params.get('level') || 3)));
const bond = egg ? 12 : FAMILIAR_STAGE_BOND[level] + (level === 5 ? 210 : 23);
const named = params.get('name') ?? (level >= 2 ? 'Pyrrhos' : '');

const student = { id: 'stu-1', name: 'Eleni Papadopoulou', classId: 'c1' };
state.setAllStudents([student]);
state.setAllStudentScores([{
    id: 'stu-1', totalStars: bond, monthlyStars: 6,
    familiar: {
        typeId, state: egg ? 'egg' : 'alive', level, seenLevel: level, name: egg ? '' : named,
        starsWhenPurchased: 0, bond: { banked: 0, anchor: 0, year: '2026-27' },
        look: { v: 2, preset: params.get('preset') || undefined, seed: Number(params.get('seed') || 4242) },
        trickMonth: params.has('used') ? new Date().toISOString().slice(0, 7) : '', trickUses: params.has('used') ? 1 : 0
    }
}]);
window.__habitatOverride = {
    time: params.get('time') || null,
    season: params.get('season') || null,
    weather: params.get('weather') || null
};
if (params.has('shot')) document.body.classList.add('pv-shot');
const link = (q, label) => `<a href="?${q}">${label}</a>`;
document.getElementById('pv-toolbar').innerHTML = [
    ...Object.keys(FAMILIAR_TYPES).map((t) => link(`type=${t}&level=${level}`, t)),
    link(`type=${typeId}&egg=1`, 'egg'),
    ...[1, 2, 3, 4, 5].map((l) => link(`type=${typeId}&level=${l}`, `L${l}`)),
    ...['dawn', 'day', 'dusk', 'night'].map((t) => link(`type=${typeId}&level=${level}&time=${t}`, t)),
    ...['spring', 'summer', 'autumn', 'winter'].map((s) => link(`type=${typeId}&level=${level}&season=${s}`, s))
].join('');
setTimeout(() => openFamiliarStatsOverlay('stu-1', { skipMoment: true }), 50);
document.addEventListener('keydown', (e) => { if (e.key === 'o') openFamiliarStatsOverlay('stu-1', { skipMoment: true }); });
