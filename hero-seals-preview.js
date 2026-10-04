// Hero Seals preview: the real markup with sample heroes, no Firebase.
// /hero-seals-preview.html?view=catalogue|folio|trophy|summary|notice|opens[&lite=1][&shot=1]
import './styles/notifications.css';
import './styles/hero_seals.css';
import { notify } from './ui/effects.js';
import { SEALS, buildSealBook, buildSealBookView, collectNewSeals, sealArtHtml } from './features/heroSealsCore.mjs';
import { heroSealsNoticeCopy, escSeal, heroSealsSummaryHtml, sealBookPanelHtml } from './features/heroSealsView.mjs';
import { studentAnalyticsModalHTML } from './templates/modals/studentAnalytics.js';
import { trophyRoomModalsHTML } from './templates/modals/trophyRoom.js';
import { renderTrophyRosterHtml, renderTrophySatchelHtml } from './ui/modals/trophyRoomView.js';
import { buildTrophySatchel } from './features/trophyRoomCore.mjs';

const params = new URLSearchParams(location.search);
const viewName = params.get('view') || 'catalogue';
const lite = params.has('lite');
const root = document.getElementById('pv-root');
const T = Date.now();

const maria = { id: 'maria', name: 'Maria Papadopoulou', heroClass: 'Guardian', guildId: 'owl_wisdom', birthday: '2016-10-02' };
const nikos = { id: 'nikos', name: 'Nikos Georgiou', heroClass: 'Sage', guildId: 'dragon_flame' };
const eleni = { id: 'eleni', name: 'Eleni Dimitriou', guildId: 'phoenix_rising' };
const kostas = { id: 'kostas', name: 'Kostas Ioannou', heroClass: 'Patron', guildId: 'grizzly_might' };

const press = (date, note, ago, extra = {}) => ({ date, note, found: T - ago, ...extra });
const mariaSeals = {
    book: buildSealBook({ studentId: 'maria', heroClass: 'Guardian', guildId: 'owl_wisdom', trials: [{ pct: 74 }], hasOccasion: true }),
    earned: {
        virtue_respect: press('2026-09-09', 'First Respect star', 9e6, { late: true }),
        virtue_teamwork: press('2026-09-16', 'First Teamwork star', 9e6, { late: true }),
        open_hand: press('2026-09-23', "First Hero's Boon given", 9e6, { late: true }),
        wild_candle: press('2026-10-02', 'A star on a special day', 9e6, { late: true }),
        virtue_focus: press('2026-10-04', 'First Focus star', 3000),
        path_guardian: press('2026-10-04', 'Hero Path level 1', 2500),
    },
};
const nikosSeals = {
    book: buildSealBook({ studentId: 'nikos', heroClass: 'Sage', guildId: 'dragon_flame', trials: [{ pct: 91 }] }),
    earned: { steadfast: press('2026-10-04', 'Ten lessons in a row', 2000), quiz_champion: press('2026-10-04', 'Quiz Champion', 1900) },
};
const eleniSeals = {
    book: buildSealBook({ studentId: 'eleni', guildId: 'phoenix_rising', recentAbsences: 2 }),
    earned: { hearth_return: press('2026-10-04', 'A star on the first lesson back', 1500) },
};

const rows = [
    { student: maria, heroSeals: mariaSeals, classLabel: '🦉 Fifth Grade Owls' },
    { student: nikos, heroSeals: nikosSeals, classLabel: '🦉 Fifth Grade Owls' },
    { student: eleni, heroSeals: eleniSeals, classLabel: '🦉 Fifth Grade Owls' },
];

function catalogue() {
    root.innerHTML = `<div class="pv-cat">${Object.values(SEALS).map((s) => `
        <figure>${sealArtHtml(s, { size: 72 })}<figcaption>${s.name}<small>${s.family}</small></figcaption></figure>`).join('')}
        <figure>${sealArtHtml('steadfast', { earned: false, size: 72 })}<figcaption>Not yet pressed<small>impression</small></figcaption></figure>
    </div>`;
}

function folio() {
    root.innerHTML = studentAnalyticsModalHTML;
    const overlay = document.getElementById('student-analytics-modal');
    overlay.classList.remove('hidden');
    if (lite) overlay.classList.add('sf--lite');
    document.getElementById('sf-head').innerHTML = `<div class="sf-id"><div class="sf-portrait"><span class="sf-portrait__initial">M</span><span class="sf-portrait__badge">🛡️</span></div>
        <div class="sf-id__text"><p class="sf-id__kicker">Scholar’s Folio</p><h2 id="sf-name" class="sf-id__name">Maria Papadopoulou</h2>
        <p class="sf-id__meta"><span>🛡️ Guardian</span><span>🦉 Fifth Grade Owls</span></p>
        <div class="sf-id__chips"><span class="sf-chip">2nd of 18</span><button type="button" class="sf-chip sf-chip--seals"><i class="fas fa-stamp"></i>6 Hero Seals</button></div></div></div>`;
    document.querySelectorAll('.sf-tab').forEach((b) => b.classList.toggle('is-active', b.dataset.sfTab === 'seals'));
    document.getElementById('sf-seal-count').textContent = '6';
    document.getElementById('sf-range').hidden = true;
    ['overview', 'trials', 'oracle'].forEach((n) => { document.getElementById(`sf-panel-${n}`).hidden = true; });
    const panel = document.getElementById('sf-panel-seals');
    panel.hidden = false;
    panel.classList.add('is-entering');
    panel.innerHTML = sealBookPanelHtml(buildSealBookView({ student: maria, heroSeals: mariaSeals }), maria);
}

function trophy() {
    root.innerHTML = trophyRoomModalsHTML;
    const modal = document.getElementById('trophy-room-modal');
    modal.classList.remove('hidden');
    document.getElementById('trophy-room-roster').innerHTML = renderTrophyRosterHtml([
        { id: 'maria', name: 'Maria Papadopoulou', total: 3, ready: 1 }, { id: 'nikos', name: 'Nikos Georgiou', total: 1, ready: 0 },
        { id: 'eleni', name: 'Eleni Dimitriou', total: 0, ready: 0 }, { id: 'kostas', name: 'Kostas Ioannou', total: 2, ready: 0 },
    ], 'maria');
    const satchel = buildTrophySatchel([
        { name: 'Elixir of Luck', icon: '🍀', description: '50% chance of a bonus star.' },
        { name: 'Owl Reading Lamp', icon: '🦉', description: 'A cosy autumn treasure.', acquiredAt: '2026-09-20' },
        { name: 'A Kept Promise', icon: '🔥', description: 'A small promise, kept with care.', source: 'ember_oath', acquiredAt: '2026-09-28' },
    ], { isUsable: (n) => n === 'Elixir of Luck' });
    document.getElementById('trophy-room-content').innerHTML = renderTrophySatchelHtml({
        student: maria, classLabel: '🦉 Fifth Grade Owls', gold: 46, satchel, effects: [],
        seals: buildSealBookView({ student: maria, heroSeals: mariaSeals }),
    });
    document.querySelector('.tr-satchel')?.classList.add('tr-satchel--enter');
}

function summary(since = T - 60000) {
    const groups = collectNewSeals(rows, since);
    const host = document.createElement('div');
    host.className = `hs-sum${lite ? ' hs--still' : ''}`;
    host.innerHTML = `<div class="hs-sum__bg"></div>${heroSealsSummaryHtml(groups, { lite })}`;
    document.body.appendChild(host);
    requestAnimationFrame(() => host.classList.add('is-in'));
}

function notice() {
    catalogue();
    const host = document.createElement('div');
    host.id = 'toast-container';
    document.body.appendChild(host);
    const groups = collectNewSeals(rows, T - 60000);
    const { title, sub } = heroSealsNoticeCopy(groups);
    notify({
        type: 'praise',
        title: 'Hero Seals',
        icon: sealArtHtml(groups[0].seals[0], { size: 34, className: 'hs-herald-seal' }),
        message: `${escSeal(title)}<span class="hs-herald-sub">${escSeal(sub)}</span>`,
        duration: 0,
        action: { label: 'See who', icon: 'fa-scroll', onClick: () => summary() },
    });
}

({ catalogue, folio, trophy, summary: () => summary(), notice, opens: () => summary(0) })[viewName]?.();
if (params.has('shot')) document.body.classList.add('pv-shot');
document.getElementById('pv-toolbar').innerHTML = ['catalogue', 'folio', 'trophy', 'notice', 'summary', 'opens']
    .map((v) => `<a href="?view=${v}">${v}</a>`).join('') + `<a href="?view=${viewName}&lite=1">lite</a>`;
