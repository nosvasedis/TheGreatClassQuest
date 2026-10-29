// Quest World preview (dev only): the real Team Quest map with a fake league,
// driven by the app's real sky pipeline (skyWeatherStage) with a chosen weather and time.
// &inside=owls,books marks those parties as already through the Portal this month;
// &over=owls:121 puts them past the goal, up in the Crystal Sky; &mine=owls makes that the
// class in session (the map then opens in the sky).
import { evaluatePortal } from './features/questRanksCore.mjs';
import './styles/sky_weather.css';
import './styles/team_quest_map_living.css';
import { getActiveLivingQuestMap, initializeLivingQuestMap, renderLeagueMapInto, renderSealedLeagueMapInto, rollUpLivingQuestMap } from './features/worldMap.js';
import { applySkyReading, getSkyScene } from './features/skyWeatherStage.js';

const FX_KEY = 'gcq-team-quest-map-fx-choice';
const params = new URLSearchParams(location.search);
const slot = document.getElementById('pv-slot');
const leaderInput = document.getElementById('pv-leader');
const leaderOut = document.getElementById('pv-leader-out');
const timeSelect = document.getElementById('pv-time');
const weatherSelect = document.getElementById('pv-weather');
const leagueSelect = document.getElementById('pv-league');

const PARTIES = [
    { id: 'owls', name: 'Junior A', logo: '🦉', share: 1 },
    { id: 'books', name: 'Junior B', logo: '📚', share: 0.86 },
    { id: 'stars', name: 'Junior C', logo: '🌟', share: 0.6 },
    { id: 'foxes', name: 'Junior D', logo: '🦊', share: 0.33 },
    { id: 'dragons', name: 'Junior E', logo: '🐉', share: 0.12 }
];

// WMO weather codes, the same ones the live weather reading carries.
const WEATHER = {
    clear: { code: 0, cloudCover: 4, windSpeed: 6 },
    partly: { code: 2, cloudCover: 45, windSpeed: 12 },
    overcast: { code: 3, cloudCover: 95, windSpeed: 14 },
    fog: { code: 45, cloudCover: 90, windSpeed: 3 },
    drizzle: { code: 53, cloudCover: 90, windSpeed: 10 },
    rain: { code: 63, cloudCover: 95, windSpeed: 18 },
    heavy: { code: 65, cloudCover: 100, windSpeed: 30 },
    showers: { code: 80, cloudCover: 60, windSpeed: 16 },
    snow: { code: 73, cloudCover: 95, windSpeed: 8 },
    storm: { code: 95, cloudCover: 100, windSpeed: 34 },
    windy: { code: 2, cloudCover: 40, windSpeed: 42, windDirection: 270 }
};

const HOUR = 60 * 60 * 1000;
/** A clock (now + sunrise + sunset) that lands in the chosen light. */
function clockFor(time) {
    const now = Date.now();
    const table = {
        dawn: { sunrise: now + 10 * 60 * 1000, sunset: now + 12 * HOUR },
        morning: { sunrise: now - 2 * HOUR, sunset: now + 9 * HOUR },
        noon: { sunrise: now - 6 * HOUR, sunset: now + 6 * HOUR },
        golden: { sunrise: now - 11 * HOUR, sunset: now + 40 * 60 * 1000 },
        twilight: { sunrise: now - 12 * HOUR, sunset: now - 20 * 60 * 1000 },
        night: { sunrise: now + 8 * HOUR, sunset: now - 3 * HOUR }
    };
    return table[time] ? { now, ...table[time] } : null;
}

// &over=owls:121,books:104 sets those parties' share of the goal (past 100% too).
const overs = new Map((params.get('over') || '').split(',').filter(Boolean).map((pair) => pair.split(':')));

function league(leaderPercent) {
    const goal = 140;
    return PARTIES.map((party, index) => {
        const over = Number(overs.get(party.id)) || 0;
        const stars = over ? Math.round((goal * over) / 100) : Math.round((goal * leaderPercent * party.share) / 100);
        return {
            id: party.id,
            name: party.name,
            logo: party.logo,
            rank: index + 1,
            goals: { diamond: goal },
            currentMonthlyStars: stars,
            progress: (stars / goal) * 100,
            classQuestBonus: index === 0 ? 4 : 0,
            weeklyStars: 12 - index * 2,
            difficulty: [2, 3, 0, 4, 6][index] ?? 0,
            portal: evaluatePortal({
                level: ([2, 3, 0, 4, 6][index] ?? 0) + 1,
                goal,
                heroStars: Array.from({ length: 10 }, (_, i) => (index === 0 && i > 6 ? 1 : (index === 0 ? stars / 7 : stars / 10))),
                virtueStars: { teamwork: stars / 4, creativity: stars / 4, respect: stars / 4, focus: index === 1 ? 2 : stars / 4 },
                completed: (params.get('inside') || '').split(',').includes(party.id)
            }),
            createdBy: { uid: 'preview' },
            topHeroes: [{ name: 'Anna Papadopoulou', stars: 14 }, { name: 'Nikos K', stars: 11 }]
        };
    });
}

function applySky() {
    const clock = clockFor(timeSelect.value);
    const reading = WEATHER[weatherSelect.value] || WEATHER.partly;
    const sun = clock || { now: Date.now() };
    applySkyReading(reading, sun);
    const world = slot.querySelector('[data-quest-world]');
    if (world?.__questScene) world.__questScene.setSky(getSkyScene(), clock);
    else setTimeout(applySky, 150);
}

function draw({ replay = false } = {}) {
    renderLeagueMapInto(slot, league(Number(leaderInput.value)), { activeClassId: new URLSearchParams(location.search).get('mine') || 'books' });
    initializeLivingQuestMap(slot, { leagueKey: leagueSelect.value, replay });
    applySky();
}

document.querySelectorAll('[data-tier]').forEach((button) => {
    let stored = null;
    try { stored = sessionStorage.getItem(FX_KEY); } catch { /* private mode */ }
    button.setAttribute('aria-pressed', String((stored === 'lite' ? 'lite' : 'full') === button.dataset.tier));
    button.addEventListener('click', () => {
        try { sessionStorage.setItem(FX_KEY, button.dataset.tier); } catch { /* private mode */ }
        location.reload();
    });
});

if (params.get('leader')) leaderInput.value = params.get('leader');
if (params.get('time')) timeSelect.value = params.get('time');
if (params.get('weather')) weatherSelect.value = params.get('weather');
if (params.get('league')) leagueSelect.value = params.get('league');
leaderOut.textContent = `${leaderInput.value}%`;
leaderInput.addEventListener('input', () => { leaderOut.textContent = `${leaderInput.value}%`; });
leaderInput.addEventListener('change', () => draw());
timeSelect.addEventListener('change', applySky);
weatherSelect.addEventListener('change', applySky);
leagueSelect.addEventListener('change', () => draw());
document.getElementById('pv-find').addEventListener('click', () => getActiveLivingQuestMap()?.focusClass('books'));
document.getElementById('pv-sky').addEventListener('click', () => {
    const map = getActiveLivingQuestMap();
    map?.showView(map.view === 'sky' ? 'land' : 'sky');
});
// What the header's general view does: the map rolls up and waits; a class unrolls it again.
const generalButton = document.getElementById('pv-general');
generalButton.addEventListener('click', async () => {
    if (generalButton.dataset.idle === 'true') {
        delete generalButton.dataset.idle;
        generalButton.textContent = 'General view';
        draw({ replay: true });
        return;
    }
    generalButton.dataset.idle = 'true';
    generalButton.textContent = 'Pick a class';
    await rollUpLivingQuestMap({ note: '<i class="fas fa-compass" aria-hidden="true"></i> Choose a class or a Quest League to unroll the map' });
});

// A simple frames-per-second readout.
const fpsOut = document.getElementById('pv-fps');
let frames = 0;
let since = performance.now();
(function count(now) {
    frames += 1;
    if (now - since >= 1000) {
        fpsOut.textContent = `${Math.round((frames * 1000) / (now - since))} fps`;
        frames = 0;
        since = now;
    }
    requestAnimationFrame(count);
}(performance.now()));

// ?start=general opens the tab in the general view: the sealed scroll waits for a class.
if (params.get('start') === 'general') {
    renderSealedLeagueMapInto(slot, '<i class="fas fa-compass" aria-hidden="true"></i> Choose a class or a Quest League to unroll the map');
    generalButton.dataset.idle = 'true';
    generalButton.textContent = 'Pick a class';
} else draw({ replay: true });
window.__questWorldPreview = { draw, league, applySky, rollUp: rollUpLivingQuestMap };
