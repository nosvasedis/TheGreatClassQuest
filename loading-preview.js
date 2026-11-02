// Dev-only preview of the loading screen: Lumi, the constellation, the Welcome and the woosh,
// without Firebase. Open /loading-preview.html under `npm run dev`. Query options:
//   role=teacher|secretary|parent|signedout  part=morning|afternoon|evening|night
//   speed=fast|slow  low=1 (weak-laptop scene)  gate=1 (arrive through the sign-in gate)
//   film=full|short (force a cut)  shot=1 (hide the toolbar)  ready=<ms> (when the app is ready)
//   header=0 (plain next screen, no app header: Lumi leaves by the top corner)
//   sky=dawn|day|golden|twilight|night  wx=<WMO weather code, e.g. 0 clear, 3 grey, 45 fog, 63 rain, 73 snow, 95 storm>
// The hand-over is the app's own (templates/loading.js#playLoadingExit); window.__pvLog
// records when each step happened, for headless timing checks.
import { headerHTML } from './templates/app/header.js';
import { startPixieDust } from './ui/headerClock.js';
import { loadingHTML, initLoadingAtmosphere, initLoadingTips, markLoadingStage, stageLoadingPersonalization, playLoadingExit, reopenLoadingScreen, setLoadingFilmCut } from './templates/loading.js';

const params = new URLSearchParams(location.search);
const opts = {
    role: params.get('role') || 'teacher',
    part: params.get('part') || 'afternoon',
    speed: params.get('speed') || 'fast',
    low: params.get('low') === '1',
    gate: params.get('gate') === '1',
};
if (params.get('shot') === '1') document.body.classList.add('pv-shot');

const NAMES = { teacher: 'Ms Maria Papadopoulou', secretary: 'Eleni Georgiou', parent: 'Family of Nikos' };
const TIMES = { fast: { auth: 350, profile: 800, ready: 1800 }, slow: { auth: 1400, profile: 3600, ready: 7000 } };

const t0 = performance.now();
window.__pvLog = [];
const log = (step) => window.__pvLog.push({ step, at: Math.round(performance.now() - t0) });

if (params.get('header') !== '0') {
    // The real app header, so Lumi can fly home to the little Lumi over its title.
    const next = document.getElementById('pv-next');
    next.style.placeItems = 'start stretch';
    next.innerHTML = `<div class="gcq-sky-atmosphere relative">${headerHTML}</div>`;
    startPixieDust();
}
document.getElementById('app-root').innerHTML = loadingHTML;
initLoadingAtmosphere();
initLoadingTips();
const screen = document.getElementById('loading-screen');
if (opts.low) screen.classList.add('gcq-perf-low');
// film=full|short forces a cut; otherwise the first play of the day is full, then short.
if (params.get('film')) setLoadingFilmCut(params.get('film'));
if (opts.gate) {
    screen.classList.add('hidden');
    setTimeout(() => {
        reopenLoadingScreen({ fromGate: true });
        if (params.get('film')) setLoadingFilmCut(params.get('film'));
        log('reopened');
    }, 200);
}

function exit() {
    screen.dataset.exiting = 'true';
    log('exit');
    const revealIn = playLoadingExit(screen, {
        schoolName: params.get('school') ?? 'Prodigies Language School',
        dayPart: opts.part,
        onHidden: () => log('hidden'),
    });
    setTimeout(() => log('reveal'), revealIn);
}

const times = { ...(TIMES[opts.speed] || TIMES.fast) };
if (Number(params.get('ready')) > 0) times.ready = Number(params.get('ready'));
const lead = opts.gate ? 200 : 0;
setTimeout(() => { markLoadingStage(1); log('stage1'); }, lead + times.auth);
if (opts.role === 'signedout') {
    setTimeout(exit, lead + times.auth + 60);
} else {
    setTimeout(() => { stageLoadingPersonalization(NAMES[opts.role], opts.role); log('stage2'); }, lead + times.profile);
    setTimeout(exit, lead + times.ready);
}

// Toolbar: every change replays from a fresh page.
const ids = { role: 'pv-role', part: 'pv-part', speed: 'pv-speed' };
Object.entries(ids).forEach(([key, id]) => { document.getElementById(id).value = opts[key]; });
document.getElementById('pv-low').checked = opts.low;
document.getElementById('pv-gate').checked = opts.gate;
document.getElementById('pv-play').addEventListener('click', () => {
    const next = new URLSearchParams();
    Object.entries(ids).forEach(([key, id]) => next.set(key, document.getElementById(id).value));
    if (document.getElementById('pv-low').checked) next.set('low', '1');
    if (document.getElementById('pv-gate').checked) next.set('gate', '1');
    location.search = next.toString();
});
