// Dev-only preview of the Grand Guild Ceremony (features/grandGuildCeremony.js) with a pretend
// school year, no Firestore. Open /grand-ceremony-preview.html under `npm run dev`.
//   ?classes=1..8   how many classes are on stage (default 3)
//   ?tie=1          the top two guilds finish level on Crowns (the year's Glory decides)
//   ?quiet=1        a year with no Wheel, familiars or raids (Wonders is skipped)
//   ?lite=1         the weak-laptop look; ?auto=1 starts at once
import * as state from './state.js';
import { applySubscriptionPreview } from './utils/subscription.js';
import { grandGuildCeremonyHTML } from './templates/app/screens/grandGuildCeremony.js';
import { startGrandGuildCeremony, grandCeremonyIo } from './features/grandGuildCeremony.js';

const params = new URLSearchParams(location.search);
applySubscriptionPreview({ tier: params.get('tier') || 'pro' });
document.getElementById('pv-app').innerHTML = grandGuildCeremonyHTML;

const YEAR = '2026-2027';
const NOW = new Date(2027, 5, 18, 10, 0);
const GUILDS = ['dragon_flame', 'grizzly_might', 'owl_wisdom', 'phoenix_rising'];
const FIRST = ['Maria', 'Alex', 'Eleni', 'Nikos', 'Sofia', 'Yannis', 'Zoe', 'Dimitra', 'Kostas', 'Anna', 'Petros', 'Ioanna', 'Giorgos', 'Katerina', 'Leo', 'Mia', 'Thanos', 'Iris', 'Stelios', 'Danae'];
const LAST = ['P.', 'K.', 'G.', 'M.', 'A.', 'V.', 'D.', 'L.'];
let seed = 7;
const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const quiet = params.has('quiet');

const face = (hue) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${hue} 70% 80%)"/><circle cx="32" cy="27" r="14" fill="#f5d0b5"/><path d="M14 64c2-14 10-20 18-20s16 6 18 20z" fill="hsl(${hue} 60% 45%)"/><circle cx="27" cy="26" r="2" fill="#333"/><circle cx="37" cy="26" r="2" fill="#333"/><path d="M27 33q5 4 10 0" stroke="#333" stroke-width="2" fill="none"/><path d="M18 22q14-16 28 0" fill="hsl(${(hue + 40) % 360} 40% 30%)"/></svg>`)}`;

const CLASS_DEFS = [
    { name: 'Junior B · Owls', logo: '🦉', questLevel: 'Junior B', difficultyLevel: 2 },
    { name: 'Class C · Comets', logo: '☄️', questLevel: 'C', difficultyLevel: 4 },
    { name: 'Pre-Junior · Bees', logo: '🐝', questLevel: 'Pre-Junior', difficultyLevel: 0 },
    { name: 'Junior A · Foxes', logo: '🦊', questLevel: 'Junior A', difficultyLevel: 1 },
    { name: 'Class D · Dragons', logo: '🐲', questLevel: 'D', difficultyLevel: 6 },
    { name: 'Class B · Lions', logo: '🦁', questLevel: 'B', difficultyLevel: 3 },
    { name: 'Class A · Whales', logo: '🐳', questLevel: 'A', difficultyLevel: 2 },
    { name: 'Junior B · Kites', logo: '🪁', questLevel: 'Junior B', difficultyLevel: 1 }
];
const classCount = Math.max(1, Math.min(8, Number(params.get('classes')) || 3));
const monthKeys = ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06'];
const classes = CLASS_DEFS.slice(0, classCount).map((c, i) => ({
    id: `c${i}`, ...c,
    portalCrossings: i === 1 ? { '2026-11': true, '2027-03': true } : i === 0 ? { '2027-02': true } : {},
    teamQuestBonuses: { '2026-12': 6 },
    realmRaids: quiet ? {} : { winter_2026: { victoryAt: 1, hero: { name: 'Maria P.' } }, ...(i === 1 ? { carnival_2027: { victoryAt: 1, legendaryAt: 1 } } : {}) }
}));
// Other classes of the school, so guild sizes look like a real school.
const others = [{ id: 'x1', name: 'Other class', logo: '📚' }];
const students = [];
classes.forEach((c, ci) => {
    const size = 10 + ((ci * 3) % 5);
    for (let i = 0; i < size; i += 1) {
        const id = `s${ci}_${i}`;
        students.push({ id, name: `${FIRST[(i + ci * 5) % FIRST.length]} ${LAST[(i + ci) % LAST.length]}`, classId: c.id, guildId: GUILDS[(i + ci) % 4], avatar: i % 3 === 2 ? null : face((i * 47 + ci * 90) % 360), activeSchoolYearKey: YEAR });
    }
});
for (let i = 0; i < 30; i += 1) students.push({ id: `o${i}`, name: `Hero ${i}`, classId: 'x1', guildId: GUILDS[i % 4], activeSchoolYearKey: YEAR });

const scores = students.map((s, i) => ({
    id: s.id,
    totalStars: 40 + Math.round(rnd() * 120),
    heroOfDayWins: i % 4 === 0 ? 1 + Math.round(rnd() * 6) : 0,
    heroOfDayWinsYearKey: YEAR,
    familiar: quiet ? null : (i % 3 === 0 ? { state: 'alive', level: 1 + (i % 5), typeId: 'ember' } : i % 7 === 0 ? { state: 'egg', typeId: 'frost' } : null)
}));

// The Crown Race: nine sealed Chapters (Sep–May) and the live June Chapter.
const placesByMonth = [
    ['owl_wisdom', 'dragon_flame', 'grizzly_might', 'phoenix_rising'],
    ['dragon_flame', 'owl_wisdom', 'phoenix_rising', 'grizzly_might'],
    ['grizzly_might', 'dragon_flame', 'owl_wisdom', 'phoenix_rising'],
    ['owl_wisdom', 'phoenix_rising', 'dragon_flame', 'grizzly_might'],
    ['phoenix_rising', 'owl_wisdom', 'grizzly_might', 'dragon_flame'],
    ['dragon_flame', 'grizzly_might', 'owl_wisdom', 'phoenix_rising'],
    ['owl_wisdom', 'dragon_flame', 'phoenix_rising', 'grizzly_might'],
    ['grizzly_might', 'owl_wisdom', 'dragon_flame', 'phoenix_rising'],
    [params.has('tie') ? 'grizzly_might' : 'dragon_flame', 'owl_wisdom', params.has('tie') ? 'dragon_flame' : 'grizzly_might', 'phoenix_rising']
];
const CROWNS = [5, 3, 2, 1];
const members = Object.fromEntries(GUILDS.map((g) => [g, students.filter((s) => s.guildId === g).map((s) => s.id)]));
const guildScores = Object.fromEntries(GUILDS.map((gid, gi) => {
    const sealedChapters = {};
    placesByMonth.forEach((order, mi) => {
        const place = order.indexOf(gid) + 1;
        const unity = (mi + gi) % 4 === 0;
        sealedChapters[`m${monthKeys[mi].replace('-', '_')}`] = { place, placeCrowns: CROWNS[place - 1], crowns: CROWNS[place - 1] + (unity ? 1 : 0), unity, perMember: 10 - place, memberCount: members[gid].length };
    });
    const juneMembers = Object.fromEntries(members[gid].map((id, i) => [id, (gi === 2 ? 9 : 4) + (i % 3)]));
    const memberGlory = Object.fromEntries(members[gid].map((id, i) => [id, 60 + gi * 12 + i * 3]));
    return [gid, {
        id: gid, guildId: gid, activeSchoolYearKey: YEAR, memberGloryYear: YEAR, memberGlory,
        totalGlory: Object.values(memberGlory).reduce((a, b) => a + b, 0) + (params.has('tie') && gid === 'owl_wisdom' ? 900 : 0),
        sealedChapters,
        chapters: { m2027_06: { glory: Object.values(juneMembers).reduce((a, b) => a + b, 0), members: juneMembers } }
    }];
}));

state.set('schoolYearState', { activeYearKey: YEAR, rolloverStatus: 'active', openedAt: '2026-09-07' });
state.set('allSchoolYears', [{ id: YEAR, startsAt: '2026-09-07', endsAt: '2027-06-20' }]);
state.setAllSchoolClasses([...classes, ...others]);
state.setAllTeachersClasses(classes);
state.setAllStudents(students);
state.setAllStudentScores(scores);
state.setAllGuildScores(guildScores);
state.set('currentUserId', 'preview-teacher');

// One archived month of stars per class member; no award logs needed.
grandCeremonyIo.now = () => new Date(NOW);
grandCeremonyIo.fetchMonth = async (m) => {
    await new Promise((r) => setTimeout(r, 120));
    if (m.monthKey === '2027-06') return { logs: [], archived: {} };
    const archived = {};
    students.forEach((s, i) => { archived[s.id] = Math.round(2 + ((i * 7 + m.month * 3) % 11) + rnd() * 3); });
    return { logs: [], archived };
};
const LABELS = [['🌠 Wishing Star', 'omen'], ['⚜️ Glory Fountain', 'rare'], ['⭐ Star Supernova', 'legendary'], ['🪙 Gold Rush', 'common'], ['⛈️ Thunderclap', 'storm'], ['🧞 Genie\'s Wish', 'epic']];
grandCeremonyIo.fetchWheelLog = async (ids) => (quiet ? [] : ids.flatMap((classId, ci) => Array.from({ length: 24 }, (_, w) => ({
    classId,
    results: GUILDS.map((guildId, gi) => {
        const [segmentLabel, rarity] = LABELS[(w + gi + ci) % LABELS.length];
        const glory = rarity === 'storm' ? -2 : rarity === 'omen' ? 16 : 3 + gi;
        return { guildId, segmentLabel, rarity, gloryDelta: glory, gloryByGuild: { [guildId]: glory }, braved: rarity === 'storm' && w % 2 === 0 };
    })
}))));
grandCeremonyIo.save = async (record) => console.info('[preview] ceremony saved', record);

const start = () => {
    document.querySelector('.pv-start')?.remove();
    startGrandGuildCeremony(classes.map((c) => c.id)).then(() => {
        if (params.has('lite')) document.getElementById('grand-guild-ceremony-screen').dataset.tier = 'lite';
    });
};
document.getElementById('pv-start').addEventListener('click', start);
if (params.has('auto')) start();
window.pvNext = () => document.getElementById('grd-action-btn')?.click();
