// Realm Raid preview: the hall, the victory moment and the projector card on a made-up school,
// no Firebase. /realm-raid-preview.html?season=winter|carnival|summer&phase=herald|active|broken|legendary|won|held
//   &view=hall|victory|card|help[&lite=1][&shot=1][&focus=<classId>]
import './styles/tokens.css'; // shared fonts + tokens (this preview skips style.css)
import './styles/realm_raid.css';
import './styles/realm_raid_card.css';
import { raidWindow, findRaid, computeShares, raidStatus, addDays, dayKey, getRaidSeason, raidDays } from './features/realmRaidCore.mjs';
import { hallHtml, howItWorksHtml, victoryHtml, raidCardHtml, skyHtml, stageHtml } from './ui/modals/realmRaidView.mjs';

const params = new URLSearchParams(location.search);
const seasonId = ['winter', 'carnival', 'summer'].includes(params.get('season')) ? params.get('season') : 'winter';
const phase = params.get('phase') || 'active';
const viewName = params.get('view') || 'hall';
const lite = params.has('lite');
if (params.has('shot')) document.body.classList.add('pv-shot');

const holidays = [{ start: '2026-12-23', end: '2027-01-07' }];
const raid = raidWindow(seasonId, 2026, { holidays });
const day = phase === 'herald' ? addDays(raid.start, -3) : (phase === 'won' || phase === 'held') ? addDays(raid.end, 2) : addDays(raid.start, 2);
const live = findRaid(day, { holidays });

const CLASSES = [
    ['c1', 'Little Owls', '🦉', 'Pre-Junior', ['1', '3'], 9],
    ['c2', 'Star Foxes', '🦊', 'A', ['2', '4'], 12],
    ['c3', 'Dragon Riders', '🐉', 'B', ['1', '4'], 14],
    ['c4', 'Sea Turtles', '🐢', 'Junior A', ['5'], 7],
    ['c5', 'Moon Wolves', '🐺', 'C', ['2'], 11],
    ['c6', 'Sun Lions', '🦁', 'D', ['3', '5'], 15],
    ['c7', 'Bright Bees', '🐝', 'Junior B', ['1'], 8],
    ['c8', 'Thunder Hawks', '🦅', 'B', ['2', '5'], 13],
    ['c9', 'Crystal Cats', '🐱', 'C', ['4'], 10],
    ['c10', 'Ocean Whales', '🐋', 'D', ['3'], 9]
];
if (params.has('many')) {
    const extra = [['Golden Eagles', '🦅'], ['Silver Seals', '🦭'], ['Ruby Robins', '🐦'], ['Jade Frogs', '🐸'], ['Amber Bears', '🐻'], ['Coral Crabs', '🦀'], ['Pearl Swans', '🦢'], ['Iron Rhinos', '🦏'], ['Misty Owls', '🦉'], ['Swift Deer', '🦌'], ['Brave Pandas', '🐼'], ['Lucky Koalas', '🐨']];
    extra.forEach(([n, l], i) => CLASSES.push([`x${i}`, n, l, ['A', 'B', 'C', 'D', 'Junior A', 'Pre-Junior'][i % 6], [String(1 + (i % 5))], 8 + (i % 7)]));
}
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
    won: [1.3, 1.1, 1.02, 1.1, 0.85, 1.0, 1.2, 0.95, 0.9, 0.95],
    held: [1.1, 0.7, 0.6, 1.0, 0.3, 0.6, 0.8, 0.5, 0.4, 0.5]
}[phase] || [];
const byClass = {};
shares.forEach((s, i) => { if (s.share) byClass[s.classId] = Math.round(s.share * (FILL[i] ?? FILL[i % 10] ?? 0) * 2) / 2; });
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
// Stars per raid day, spread over the days that have passed.
const byDay = {};
const passed = raidDays(raid).filter((d) => dayKey(d) <= today);
const total = Object.values(byClass).reduce((a, b) => a + b, 0);
const weightOf = (d) => [0, 1.2, 0.8, 1.5, 1.1, 1, 0][d.getDay()];
const wsum = passed.reduce((sum, d) => sum + weightOf(d), 0) || 1;
const byDayClass = {};
passed.forEach((d) => {
    const key = dayKey(d);
    byDay[key] = Math.round((total * weightOf(d) / wsum) * 2) / 2;
    byDayClass[key] = {};
    shares.forEach((sh) => { if (byClass[sh.classId] && sh.lessonDates.includes(key)) byDayClass[key][sh.classId] = Math.round(byClass[sh.classId] / Math.max(1, sh.lessonDates.filter((k) => k <= today).length) * 2) / 2; });
});
const view = { raid: live, status, rows, tally: { byClass, byHero: {}, byDay, byDayClass }, record: {}, loading: false, next, brokenOn: ['broken', 'legendary', 'won'].includes(phase) ? addDays(raid.start, 3).getTime() : null };
const HEROES = ['Maria Papadopoulou', 'Nikos Georgiou', 'Eleni Dimitriou', 'Giorgos Ioannou', 'Sofia Konstantinou', 'Dimitris Nikolaou', 'Katerina Pappa', 'Yannis Vlachos', 'Anna Michailidou', 'Kostas Karras', 'Maria Antoniou', 'Christina Lamprou', 'Petros Alexiou', 'Ioanna Zervou'];
const struck = phase === 'herald' ? 0 : phase === 'active' ? 9 : 12;
const roster = HEROES.map((full, i) => {
    const first = full.split(' ')[0];
    const dup = HEROES.filter((h) => h.split(' ')[0] === first).length > 1;
    return { id: `s${i}`, name: dup ? `${first} ${full.split(' ')[1][0]}.` : first, fullName: full, stars: i < struck ? 1 + (i % 3) : 0 };
}).sort((a, b) => a.name.localeCompare(b.name));
const yearState = { winter: 'won', carnival: 'soon', summer: 'soon' };
const year = ['winter', 'carnival', 'summer'].map((s) => {
    const w = raidWindow(s, 2026, { holidays });
    return { raidId: w.raidId, season: w.season, start: w.start, state: s === seasonId ? (phase === 'active' || phase === 'broken' || phase === 'legendary' ? 'live' : phase === 'won' ? 'won' : phase === 'held' ? 'held' : 'soon') : yearState[s] };
});
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
            <div class="rr-stage" style="width:96%;">${stageHtml(getRaidSeason(s), { mood: i === 1 ? 'brace' : 'proud', rows, pct: [0.35, 0.6, 0.8][i], prefix: 'pc' + s, lite })}</div>
            <p style="position:absolute;bottom:4%;left:0;right:0;text-align:center;color:#fff;font:400 1.4rem 'Fredoka One',sans-serif;">${getRaidSeason(s).coat}</p>
        </div>`).join('')}</div>`;
} else if (viewName === 'victory') {
    root.innerHTML = `<div class="rr-host rr-host--victory is-open">${victoryHtml(view, { legendary: phase === 'legendary', lite })}</div>`;
} else if (viewName === 'card') {
    root.innerHTML = `<div class="pv-card"><div class="sky-card"><h3>🛡️ ${live.season.name}</h3>${raidCardHtml(view, { focusId })}</div></div>`;
} else {
    root.innerHTML = `<div class="rr-host is-open">${hallHtml(view, { focusId, heroCard, canReveal: params.has('reveal'), lite, roster, year, now: day, intro: params.has('intro') })}</div>`;
    if (viewName === 'help') root.querySelector('.rr-hall').insertAdjacentHTML('beforeend', howItWorksHtml(view));
}

const links = [];
for (const s of ['winter', 'carnival', 'summer']) links.push(`<a href="?season=${s}&phase=${phase}&view=${viewName}">${s}</a>`);
for (const p of ['herald', 'active', 'broken', 'legendary', 'won', 'held']) links.push(`<a href="?season=${seasonId}&phase=${p}&view=${viewName}">${p}</a>`);
for (const v of ['hall', 'victory', 'card', 'help', 'coats']) links.push(`<a href="?season=${seasonId}&phase=${phase}&view=${v}">${v}</a>`);
document.getElementById('pv-toolbar').innerHTML = links.join('');

// ?hit=1 opens the real hall, then sends a few more stars to show the bolts and damage numbers.
if (params.has('hit')) {
    const { openRaidHall, rerenderRaidHall } = await import('./ui/modals/realmRaid.js');
    root.innerHTML = '';
    await openRaidHall({ view, focusId, roster: () => roster, year: () => year, now: () => day });
    setTimeout(() => {
        const rowsMore = view.rows.map((r, i) => (i % 3 === 0 && r.share ? { ...r, stars: r.stars + 2 + i } : r));
        const gained = rowsMore.reduce((sum, r, i) => sum + r.stars - view.rows[i].stars, 0);
        const todayHits = { ...(byDayClass[today] || {}) };
        rowsMore.forEach((r, i) => { if (r.stars > view.rows[i].stars) todayHits[r.classId] = (todayHits[r.classId] || 0) + r.stars - view.rows[i].stars; });
        const more = { ...view, rows: rowsMore, status: { ...view.status, dealt: view.status.dealt + gained }, tally: { ...view.tally, byDayClass: { ...byDayClass, [today]: todayHits } } };
        rerenderRaidHall(more);
    }, Number(params.get('hitAt')) || 3600);
}
