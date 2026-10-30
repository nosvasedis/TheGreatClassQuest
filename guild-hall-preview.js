// Dev-only preview of the Guild Hall's live updates (ui/tabs/guilds.js), no Firestore.
// Open /guild-hall-preview.html under `npm run dev`. The buttons change the pretend guild_scores
// the way the real listeners do, so the Hall's real patching and moments play.
// ?lite=1 adds the weak-laptop look; ?shot=1 hides the toolbar.
import * as state from './state.js';
import { guildsTabHTML } from './templates/app/tabs/guilds.js';
import { renderGuildsTab, requestGuildHallRender } from './ui/tabs/guilds.js';
import { chapterKeyFor } from './features/guildScoringCore.js';
import { guildHeroesModalHTML } from './templates/modals/guildHeroes.js';

const params = new URLSearchParams(location.search);
if (params.has('shot')) document.body.classList.add('pv-shot');

document.getElementById('pv-app').innerHTML = guildsTabHTML + guildHeroesModalHTML;
const tab = document.getElementById('guilds-tab');
tab.classList.remove('hidden');

const year = '2026-2027';
const key = chapterKeyFor(new Date());
const sizes = { dragon_flame: 9, grizzly_might: 14, owl_wisdom: 6, phoenix_rising: 11 };
const names = ['Maria', 'Alex', 'Eleni', 'Nikos', 'Sofia', 'Yannis', 'Zoe', 'Dimitra', 'Kostas', 'Anna', 'Petros', 'Ioanna', 'Giorgos', 'Katerina'];
const students = [];
const scores = [];
const docs = {};
Object.keys(sizes).forEach((gid, gi) => {
    const members = {};
    const memberGlory = {};
    let glory = 0;
    for (let i = 0; i < sizes[gid]; i++) {
        const id = `pv_${gid}_${i}`;
        const stars = 6 + ((i * 7 + gi * 3) % 13);
        students.push({ id, name: `${names[i % names.length]} ${String.fromCharCode(65 + gi)}.`, classId: 'c1', guildId: gid, activeSchoolYearKey: year });
        scores.push({ id, totalStars: stars, monthlyStars: 3, activeSchoolYearKey: year });
        memberGlory[id] = stars * 2;
        members[id] = [4, 6, 5, 3][gi] + ((i + gi) % 4);
        glory += members[id];
    }
    docs[gid] = {
        id: gid, guildId: gid, activeSchoolYearKey: year, memberGloryYear: year, memberGlory,
        totalGlory: Object.values(memberGlory).reduce((a, b) => a + b, 0),
        chapters: { [key]: { glory, members, standards: [] } },
        sealedChapters: { m2026_09: { place: [2, 1, 3, 4][gi], crowns: [3, 6, 2, 1][gi], unity: gi === 1 } },
    };
});
state.set('schoolYearState', { activeYearKey: year, rolloverStatus: 'active', openedAt: '2026-09-07' });
state.set('allSchoolYears', [{ id: year, startsAt: '2026-09-07' }]);
state.set('allStudents', students);
state.set('allStudentScores', scores);
state.setAllGuildScores(structuredClone(docs));
renderGuildsTab();
if (params.has('lite')) document.querySelector('.gh')?.classList.add('gh--lite');

/** Gives `glory` to `count` heroes of a guild, one write at a time, like awardGloryToStudents. */
async function give(gid, glory, count = 1, gapMs = 0) {
    const ids = students.filter((s) => s.guildId === gid).map((s) => s.id);
    for (let n = 0; n < count; n++) {
        const id = ids[(n * 3) % ids.length];
        const ch = docs[gid].chapters[key];
        const take = glory < 0 ? -Math.min(-glory, ch.members[id] || 0) : glory;
        ch.members[id] = Math.round(((ch.members[id] || 0) + take) * 100) / 100;
        ch.glory = Math.round((ch.glory + take) * 100) / 100;
        state.setAllGuildScores(structuredClone(docs));
        requestGuildHallRender();
        if (gapMs) await new Promise((r) => setTimeout(r, gapMs));
    }
}
const per = (gid) => docs[gid].chapters[key].glory / sizes[gid];
async function overtake() {
    const order = Object.keys(sizes).sort((a, b) => per(b) - per(a));
    const [top, , , last] = order;
    const need = (per(top) - per(last)) * sizes[last] + 4;
    await give(last, Math.ceil(need / 4 * 2) / 2, 4, 150);
}

const actions = [
    ['⭐ Star to Dragon Flame', () => give('dragon_flame', 2)],
    ['⭐⭐⭐ 3 stars to Owl Wisdom', () => give('owl_wisdom', 6)],
    ['🎡 Wheel gift: 8 Grizzly heroes, one by one', () => give('grizzly_might', 2, 8, 220)],
    ['🌩️ Storm on Phoenix', () => give('phoenix_rising', -2, 3, 120)],
    ['👑 Last guild takes the lead', overtake],
    ['🔁 Busy lesson (many stars)', async () => { for (let i = 0; i < 10; i++) await give(Object.keys(sizes)[i % 4], 1, 1, 260); }],
    ['↺ Reset', () => location.reload()],
];
const bar = document.getElementById('pv-toolbar');
actions.forEach(([label, fn]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.onclick = fn;
    bar.appendChild(b);
});
window.pvGive = give;
window.pvOvertake = overtake;
