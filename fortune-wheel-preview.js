// Fortune's Wheel preview: the real ceremony and the real fates against a pretend class, no Firestore.
// /fortune-wheel-preview.html?wedge=<id>[&omen=1][&order=guild,guild,…][&lite=1][&shot=1]
//   wedge: every guild lands on that wedge (Envoy guilds land on it only if it is an Envoy gift)
//   omen:  every guild's wheel carries an Omen
// Phoenix Rising has no heroes in this class, so its turn is the Envoy's wheel.
import * as state from './state.js';
import { fortunesWheelModalHTML } from './templates/modals/fortunesWheel.js';
import { openFortunesWheel, triggerSpin, closeFortunesWheel, wheelIo, wheelTestHooks, getWheelCatalog } from './features/fortunesWheel.js';
import { chapterKeyFor } from './features/guildScoringCore.js';

const params = new URLSearchParams(location.search);
if (params.has('shot')) document.body.classList.add('pv-shot');

const names = ['Maria Papadopoulou', 'Nikos Georgiou', 'Eleni Dimitriou', 'Kostas Ioannou', 'Sofia Nikolaou', 'Giorgos Pappas', 'Anna Vlachou', 'Dimitris Karras', 'Katerina Lazarou', 'Yannis Michail', 'Ioanna Christou', 'Petros Alexiou', 'Christina Raptis'];
const guildOf = ['dragon_flame', 'grizzly_might', 'owl_wisdom', 'dragon_flame', 'grizzly_might', 'owl_wisdom', 'dragon_flame', 'grizzly_might', 'owl_wisdom', 'dragon_flame', 'owl_wisdom', 'grizzly_might', 'dragon_flame'];
const cls = { id: 'c1', name: 'Junior B · Owls', logo: '🦉', questLevel: 'Junior B' };
const students = names.map((name, i) => ({ id: `s${i}`, name, classId: 'c1', guildId: guildOf[i] }));
// heroes of the other classes, so guild sizes look like a real school
for (let i = 0; i < 24; i += 1) students.push({ id: `o${i}`, name: `Other ${i}`, classId: 'c2', guildId: ['dragon_flame', 'grizzly_might', 'owl_wisdom', 'phoenix_rising'][i % 4] });
const gold = new Map(students.map((s, i) => [s.id, i % 5 === 0 ? 0 : 10 + (i * 7) % 40]));
const monthGlory = new Map(students.map((s, i) => [s.id, i % 4 === 0 ? 0 : 1 + (i % 6)]));

state.setAllTeachersClasses([cls]);
state.setAllSchoolClasses([cls]);
state.setAllStudents(students);
state.setAllStudentScores(students.map((s) => ({ id: s.id, gold: gold.get(s.id), totalStars: 20, monthlyStars: 4 })));
const key = chapterKeyFor(new Date());
const chapterOf = (gid) => {
    const members = Object.fromEntries(students.filter((s) => s.guildId === gid).map((s) => [s.id, monthGlory.get(s.id)]));
    return { chapters: { [key]: { glory: Object.values(members).reduce((a, b) => a + b, 0) + (gid === 'owl_wisdom' ? 30 : 0), members } } };
};
state.setAllGuildScores(Object.fromEntries(['dragon_flame', 'grizzly_might', 'owl_wisdom', 'phoenix_rising'].map((g) => [g, chapterOf(g)])));
state.set('globalSelectedClassId', 'c1');

// Pretend writes: the fates run for real, only Firestore is swapped out.
const byGuildOf = (ids, n) => ids.reduce((acc, id) => { const g = students.find((s) => s.id === id)?.guildId; if (g) acc[g] = (acc[g] || 0) + n; return acc; }, {});
const pick = (list, n) => [...list].sort(() => Math.random() - 0.5).slice(0, Math.min(n, list.length));
const ARTIFACTS = [['🗡️', 'Blade of Dawn'], ['🔮', 'Seer’s Orb'], ['🪶', 'Phoenix Quill'], ['🛡️', 'Aegis of Owls'], ['📿', 'Moonstone Charm']];
Object.assign(wheelIo, {
    awardGlory: async (ids, n) => byGuildOf(ids, n),
    takeGlory: async (ids, n) => {
        const byGuild = {}; const byStudent = {};
        ids.forEach((id) => {
            const take = Math.min(n, monthGlory.get(id) || 0);
            if (!take) return;
            byStudent[id] = take;
            const g = students.find((s) => s.id === id).guildId;
            byGuild[g] = (byGuild[g] || 0) + take;
        });
        return { byGuild, byStudent };
    },
    studentEffects: async ({ students: list = [], count = 0, starsDelta = 0, goldDelta = 0, artifactsGrantCount = 0 }) => {
        const chosen = pick(list, count);
        const grantedArtifacts = artifactsGrantCount ? chosen.map((s, i) => { const [icon, name] = ARTIFACTS[(i + s.id.length) % ARTIFACTS.length]; return { id: name, name, icon, studentId: s.id }; }) : [];
        const goldApplied = goldDelta < 0 ? -chosen.reduce((a, s) => a + Math.min(-goldDelta, gold.get(s.id) || 0), 0) : goldDelta * chosen.length;
        return { affectedStudents: chosen.map((s) => s.id), starsDelta: starsDelta * chosen.length, goldDelta: goldApplied, artifactsGranted: grantedArtifacts.length, artifactsRemoved: 0, grantedArtifacts };
    },
    questBonus: async (_c, delta) => ({ classQuestDelta: delta }),
    starGlory: async (_id, n) => ({ totalGloryDelta: n * 2 }),
    bounty: async () => {},
    questCheck: async () => {},
    hasSpun: async () => false,
    save: async (classId, results) => { window.__wheelSaved = results; console.log('[wheel preview] saved', results); },
    availability: { allowed: true, code: 'ready', title: 'The wheel is awake', message: 'This is the class\'s final lesson before the weekend. The ceremonial spin may begin now.', meta: 'Preview: nothing is saved.' },
});

const catalog = getWheelCatalog();
const wedge = params.get('wedge');
const wanted = catalog.find((w) => w.id === wedge);
if (params.get('lite')) wheelTestHooks.lite = params.get('lite') === '1';
if (params.get('order')) wheelTestHooks.order = params.get('order').split(',');
wheelTestHooks.segments = (segs, { envoy, catalog: all }) => {
    let out = [...segs];
    const put = (id) => {
        if (out.some((s) => s.id === id)) return;
        const full = all.find((s) => s.id === id);
        const at = out.findIndex((s) => ['common', 'uncommon', 'envoy'].includes(s.rarity));
        out[at >= 0 ? at : 0] = { ...full, paletteIndex: 0 };
    };
    if (params.has('omen') && !envoy && !out.some((s) => s.rarity === 'omen')) put(['falling_comet', 'eclipse', 'golden_dawn', 'dragons_wager'][Math.floor(Math.random() * 4)]);
    if (wanted && (envoy === (wanted.rarity === 'envoy'))) put(wanted.id);
    return out;
};
if (wanted) wheelTestHooks.pick = (segs) => { const i = segs.findIndex((s) => s.id === wanted.id); return i >= 0 ? i : Math.floor(Math.random() * segs.length); };

document.body.insertAdjacentHTML('beforeend', fortunesWheelModalHTML);
document.getElementById('fw-spin-btn').addEventListener('click', () => triggerSpin());
document.getElementById('fw-close-btn').addEventListener('click', () => closeFortunesWheel());
const groups = { omens: catalog.filter((w) => w.rarity === 'omen'), envoy: catalog.filter((w) => w.rarity === 'envoy'), new: catalog.filter((w) => ['genies_wish', 'lucky_clover', 'castle_feast', 'gift_exchange', 'golden_tide', 'rainbow_bridge', 'artifact_rain', 'rain_cloud'].includes(w.id)) };
document.getElementById('pv-toolbar').innerHTML = ['<a href="?">random</a>', '<a href="?omen=1">omen on every wheel</a>',
    ...Object.values(groups).flat().map((w) => `<a href="?wedge=${w.id}&order=${w.rarity === 'envoy' ? 'phoenix_rising,dragon_flame,grizzly_might,owl_wisdom' : 'dragon_flame,phoenix_rising,grizzly_might,owl_wisdom'}">${w.emoji} ${w.label}</a>`)].join('');
openFortunesWheel();
