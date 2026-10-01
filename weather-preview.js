// Dev-only preview of the header, Award sky and Home weather card in every weather.
// Open /weather-preview.html?code=63&time=23:00&sky=1 under `npm run dev`.
import { headerHTML, svgFiltersHTML } from './templates/app/header.js';
import { awardImmersiveSkyHTML } from './templates/app/index.js';
import { awardTabHTML } from './templates/app/tabs/award.js';
import { buildAwardCloudCardHtml } from './features/awardCloudCard.mjs';
import { resolveWeatherTheme, headerClassesForTheme, withNightWeatherText, HEADER_WEATHER_CLASSES, wallpaperClassesForCode, WALLPAPER_WEATHER_CLASSES } from './features/weatherTheme.js';
import { syncAwardSkyWeather } from './utils.js';
import { applySkyReading, paintSkySurface } from './features/skyWeatherStage.js';
import { getWeatherCardHtml } from './features/weatherCard.js';
import { wallpaperHTML } from './templates/app/screens/wallpaper.js';

const params = new URLSearchParams(location.search);
const state = {
    code: Number(params.get('code') ?? 0),
    time: params.get('time') || '09:40',
    sky: params.get('sky') === '1',
    wall: params.get('wall') === '1',
    wind: Number(params.get('wind') ?? 9),
    windDir: Number(params.get('dir') ?? 270),
    cover: params.get('cover') === null ? undefined : Number(params.get('cover'))
};
if (params.get('shot') === '1') document.body.classList.add('pv-shot');

function card(name, cloud, i) {
    return buildAwardCloudCardHtml({
        id: name, name, firstName: name, avatar: null, guild: null,
        heroClass: { title: 'Scout', icon: '🛡️', aura: '#16a34a' },
        gold: 20 + i * 7, today: i % 3, month: 10 + i * 4, total: 60 + i * 9, todayReason: null,
        locked: false, isAbsent: false, attendanceMode: 'none', boon: { eligible: false },
        honours: {}, cloud, floatDelay: i * 900, riseDelay: 0
    }).replace(' tab-mount-rise', '');
}

document.getElementById('app-root').innerHTML = `
    ${svgFiltersHTML}
    <div id="app-screen" class="flex-1 flex flex-col h-full overflow-hidden">
        <div id="award-header-atmosphere" class="award-header-atmosphere relative z-[60] flex shrink-0 flex-col overflow-visible shadow-md">
        ${headerHTML}
        </div>
        ${awardImmersiveSkyHTML}
        <main id="preview-main">
            <div id="pv-home" class="pv-row">
                <div class="vibrant-card greeting-panel" style="min-height: 16rem"></div>
                <div id="pv-weather-slot"></div>
            </div>
            <div id="pv-award" class="hidden">${awardTabHTML}</div>
        </main>
    </div>
    ${wallpaperHTML}`;

if (params.get('mobile') === '1') {
    await import('./mobile/styles/mobile.css');
    const { injectMobileShells } = await import('./mobile/templates.js');
    document.body.classList.add('gcq-mobile');
    injectMobileShells();
}

const awardTab = document.getElementById('award-stars-tab');
awardTab?.classList.remove('hidden');
const list = document.getElementById('award-stars-student-list');
if (list) list.innerHTML = ['Alex', 'Maria', 'Nikos', 'Eleni'].map((n, i) => card(n, 'abcd'[i], i)).join('');

function atTime(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
}

function render() {
    const now = atTime(state.time);
    const sun = { now: now.getTime(), sunrise: atTime('07:20').getTime(), sunset: atTime('20:30').getTime() };
    const hours = [1, 2, 3, 4].map((k) => {
        const t = new Date(now.getTime() + k * 3600000);
        t.setMinutes(0, 0, 0);
        return { time: t.toISOString(), code: k === 2 ? 3 : state.code, temp: 17 + k, pop: k * 15 };
    });
    const reading = { code: state.code, temp: 17, hi: 21, lo: 12, cloudCover: state.cover, windSpeed: state.wind, windDirection: state.windDir, hours };
    const scene = applySkyReading(reading, sun);
    const isNight = scene.isNight;
    const theme = { ...resolveWeatherTheme(state.code), isNight, temp: '17°C', hi: 21, lo: 12 };
    if (isNight) theme.weatherText = withNightWeatherText(theme.weatherText);
    document.body.classList.toggle('night-mode', isNight);

    const header = document.querySelector('#award-header-atmosphere header');
    header.classList.remove(...HEADER_WEATHER_CLASSES);
    header.classList.add(...headerClassesForTheme(theme, isNight));
    syncAwardSkyWeather(header);

    document.getElementById('pv-weather-slot').innerHTML = getWeatherCardHtml(theme, scene, { reading, sun, now });

    const app = document.getElementById('app-screen');
    app.classList.toggle('award-sky-active', state.sky);
    document.getElementById('pv-home').classList.toggle('hidden', state.sky);
    document.getElementById('pv-award').classList.toggle('hidden', !state.sky);

    const wall = document.getElementById('dynamic-wallpaper-screen');
    wall.classList.toggle('hidden', !state.wall);
    wall.classList.remove(...WALLPAPER_WEATHER_CLASSES);
    wall.classList.add(...wallpaperClassesForCode(state.code));
    wall.classList.toggle('is-night', isNight);
    // Same sun placement as ui/wallpaper.js#placeSkySun.
    const p = (sun.now - sun.sunrise) / (sun.sunset - sun.sunrise);
    if (p >= 0 && p <= 1) {
        const x = 10 + 80 * p;
        wall.style.setProperty('--sun-x', `${x.toFixed(1)}vw`);
        wall.style.setProperty('--sun-y', `${(64 - 50 * Math.sin(Math.PI * p) - 14 * Math.exp(-(((x - 50) / 14) ** 2))).toFixed(1)}vh`);
    } else {
        wall.style.removeProperty('--sun-x');
        wall.style.removeProperty('--sun-y');
    }
    paintSkySurface('wall');
}

const codeSel = document.getElementById('pv-code');
const timeSel = document.getElementById('pv-time');
codeSel.value = String(state.code);
timeSel.value = state.time;
codeSel.addEventListener('change', () => { state.code = Number(codeSel.value); render(); });
timeSel.addEventListener('change', () => { state.time = timeSel.value; render(); });
document.getElementById('pv-sky').addEventListener('click', () => { state.sky = !state.sky; render(); });

render();
window.__pvRender = (next) => { Object.assign(state, next); render(); };
