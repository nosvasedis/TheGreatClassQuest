// Dev-only preview of the two award moments (ui/awardMoments.js), no Firebase.
// Open /award-moments-preview.html under `npm run dev`; ?play=boon|fail|hero|away plays one on load.
import { buildAwardCloudCardHtml } from './features/awardCloudCard.mjs';
import { startBoonMoment, announceBoon, playHeroBonusMoment } from './ui/awardMoments.js';

const params = new URLSearchParams(location.search);
if (params.get('shot') === '1') document.body.classList.add('pv-shot');

const heroes = [
    { id: 'maria', name: 'Maria Papadopoulou', hero: true },
    { id: 'nikos', name: 'Nikos Georgiou' },
    { id: 'eleni', name: 'Eleni Dimitriou' }
];
document.getElementById('pv-grid').innerHTML = heroes.map((h, i) => `<div class="award-card-mount">${buildAwardCloudCardHtml({
    id: h.id, name: h.name, firstName: h.name.split(' ')[0], avatar: null, guild: null,
    heroClass: { title: 'Scout', icon: '🛡️', aura: '#16a34a' },
    gold: 20 + i * 7, today: h.hero ? 3 : 0, month: 10 + i * 4, total: 60 + i * 9, todayReason: h.hero ? 'teamwork' : null,
    locked: Boolean(h.hero), isAbsent: false, attendanceMode: 'none', boon: { eligible: !h.hero },
    honours: { heroOfDay: Boolean(h.hero) }, cloud: ['a', 'b', 'c'][i], floatDelay: i * 900, riseDelay: 0
}).replace(' tab-mount-rise', '')}</div>`).join('');

function boon(ok) {
    const moment = startBoonMoment({
        giver: { id: 'nikos', name: 'Nikos Georgiou' },
        receiver: { id: 'eleni', name: 'Eleni Dimitriou' },
        origin: { x: window.innerWidth * 0.6, y: window.innerHeight * 0.75 }
    });
    setTimeout(() => {
        if (ok) {
            moment.land({ stars: 1 });
            announceBoon({ giverName: 'Nikos Georgiou', receiverName: 'Eleni Dimitriou', stars: 1, patronGoldBack: 2 });
        } else moment.fizzle();
    }, 1200);
}
function hero(away) {
    if (away) document.querySelector('[data-studentid="maria"]').style.visibility = 'hidden';
    playHeroBonusMoment({ studentId: away ? 'nobody' : 'maria', name: 'Maria Papadopoulou' });
}
document.getElementById('pv-boon').onclick = () => boon(true);
document.getElementById('pv-boon-fail').onclick = () => boon(false);
document.getElementById('pv-hero').onclick = () => hero(false);
document.getElementById('pv-hero-away').onclick = () => hero(true);
const play = params.get('play');
if (play) setTimeout(() => ({ boon: () => boon(true), fail: () => boon(false), hero: () => hero(false), away: () => hero(true) })[play]?.(), 400);
