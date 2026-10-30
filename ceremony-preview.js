// Ceremony of the Month preview: the real ceremony (features/ceremony.js) on a made-up league,
// with Firestore, the award log and the AI herald replaced by ceremony-preview.vite.mjs.
//   npx vite --config ceremony-preview.vite.mjs --port 3007 → /ceremony-preview.html
// ?league=A|B|C|D|Junior A|Junior B|Pre-Junior   ?classes=1..8   ?heroes=2..24   ?tie=1
// ?cross=0 (no Portal crossing)   ?quiet=1 (no month moments)   ?tier=lite   ?shot=1   ?resume=phase:index
const params = new URLSearchParams(location.search);
if (params.has('shot')) document.body.classList.add('pv-shot');
if (params.get('tier') === 'lite') {
    try { Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2 }); Object.defineProperty(navigator, 'deviceMemory', { value: 2 }); } catch { /* fine */ }
} else if (params.get('tier') === 'full') {
    try { Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8 }); Object.defineProperty(navigator, 'deviceMemory', { value: 8 }); } catch { /* fine */ }
}

const state = await import('./state.js');
const { ceremonyHTML } = await import('./templates/app/screens/ceremony.js');
document.getElementById('pv-app').innerHTML = ceremonyHTML;

const league = params.get('league') || 'A';
const classCount = Math.max(1, Math.min(8, Number(params.get('classes')) || 6));
const heroCount = Math.max(2, Math.min(24, Number(params.get('heroes')) || 14));
const quiet = params.has('quiet');
const year = '2026-2027';
const month = '2026-10';

let seed = 7;
const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const pickOf = (list) => list[Math.floor(rnd() * list.length)];

const FIRST = ['Maria', 'Nikos', 'Eleni', 'Kostas', 'Sofia', 'Giorgos', 'Anna', 'Dimitris', 'Katerina', 'Yannis', 'Ioanna', 'Petros', 'Zoe', 'Alexandros', 'Myrto', 'Stelios', 'Danae', 'Orestis', 'Chloe', 'Vasilis', 'Iris', 'Thanos', 'Lydia', 'Pavlos'];
const LAST = ['Papadopoulou', 'Georgiou', 'Dimitriou', 'Ioannou', 'Nikolaou', 'Pappas', 'Vlachou', 'Karras', 'Lazarou', 'Michail', 'Christou', 'Alexiou'];
const CLASSES = [
    ['Owls of Athena', '🦉'], ['Sea Dragons', '🐉'], ['Star Gazers', '🔭'], ['Olive Grove', '🫒'],
    ['Thunder Foxes', '🦊'], ['Lantern Keepers', '🏮'], ['Bright Comets', '☄️'], ['Book Wyrms', '📚']
];
const PATHS = ['Guardian', 'Sage', 'Vanguard', 'Paladin', 'Artificer', 'Scholar', 'Patron', 'Nomad'];
const GUILDS = ['dragon_flame', 'grizzly_might', 'owl_wisdom', 'phoenix_rising'];
const FAMS = ['emberfang', 'frostpaw', 'thornback', 'veilshade', 'sparkling'];
const HUES = [12, 38, 160, 200, 262, 320, 90, 230];

function avatar(i) {
    const h = HUES[i % HUES.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${h},70%,72%)"/><circle cx="32" cy="27" r="13" fill="hsl(${h},45%,92%)"/><path d="M12 64c2-14 10-20 20-20s18 6 20 20z" fill="hsl(${h},55%,45%)"/><circle cx="27" cy="26" r="1.8" fill="#1e293b"/><circle cx="37" cy="26" r="1.8" fill="#1e293b"/><path d="M27 32q5 4 10 0" stroke="#1e293b" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const at = (day, hour = 11) => new Date(2026, 9, day, hour, 0, 0);
const prevAt = (day) => new Date(2026, 8, day, 11, 0, 0);
const dmy = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const classes = CLASSES.slice(0, classCount).map(([name, logo], i) => ({
    id: `c${i + 1}`, name, logo, questLevel: league, difficultyLevel: i === 0 && params.get('cross') !== '0' ? 1 : (i % 3 === 2 ? 1 : 0),
    scheduleDays: ['1', '3'], timeStart: '17:00', timeEnd: '18:30', createdBy: { uid: 'me' },
    createdAt: new Date(2026, 8, 1).toISOString(),
    portalCrossings: i === 0 && params.get('cross') !== '0' ? { [month]: { gold: 6, at: at(23).toISOString() } } : {},
    ceremonyHistory: {},
    teamQuestBonuses: i === 1 ? { [month]: 10 } : (i === 0 ? { [month]: 2 } : {}),
    ...(i === 0 && !quiet ? {
        mapJournal: { [month]: { silver: { date: iso(at(9)), at: at(9).getTime(), stars: 60 }, gold: { date: iso(at(19)), at: at(19).getTime(), stars: 140 }, crystal: { date: iso(at(23)), at: at(23).getTime(), stars: 190 } } },
        trainingGrounds: {
            hoard: { rounds: 5, log: [5, 7, 12, 19, 26].map((d) => ({ date: iso(at(d)), ok: true })) },
            map: { rounds: 3, log: [6, 14, 21].map((d) => ({ date: iso(at(d)), ok: true })) },
            council: { rounds: 2, log: [8, 20].map((d) => ({ date: iso(at(d)), ok: true })) }
        }
    } : {})
}));

const students = [];
const scores = [];
const logs = [];
classes.forEach((c, ci) => {
    const n = ci === 0 ? heroCount : 8 + ((ci * 3) % 6);
    for (let i = 0; i < n; i += 1) {
        const id = ci === 0 ? `s${i}` : `${c.id}s${i}`;
        const name = `${FIRST[(i + ci * 5) % FIRST.length]} ${LAST[(i * 7 + ci) % LAST.length]}`;
        students.push({ id, name, classId: c.id, avatar: i % 5 === 4 ? null : avatar(i + ci), heroClass: PATHS[i % PATHS.length], guildId: GUILDS[i % 4], createdAt: new Date(2026, 8, 1).toISOString() });
        const seals = {};
        if (ci === 0 && !quiet) {
            const add = (sid, day) => { seals[sid] = { date: iso(at(day)), found: at(day).getTime() }; };
            if (i === 0) add('four_winds', 14);
            if (i === 1) add('open_hand', 9);
            if (i === 2) add('oathkeeper', 21);
            if (i === 3) add('steadfast', 26);
            if (i === 5) add('path_vanguard', 12);
            if (i === 6) add('hearth_return', 16); // an absence seal: must never be shown
            if (i === 7) add('quill_bright', 22); // academic: must never be shown
        }
        scores.push({
            id, monthlyStars: 0, totalStars: 40 + i, gold: 30, activeSchoolYearKey: year,
            heroSeals: { v: 2, earned: seals },
            familiar: ci === 0 && i % 2 === 0 ? { typeId: FAMS[i % FAMS.length], name: ['Cinder', 'Frost', 'Moss', 'Shade', 'Zap'][i % 5], state: 'alive', level: 1 + (i % 3) } : null,
            legendQuest: ci === 0 && i === 4 && !quiet ? { heroClass: 'Artificer', steps: [iso(at(7)), iso(at(14)), iso(at(21))], completedAt: at(21).toISOString() } : null
        });
        // October stars: lessons on most Mondays and Wednesdays.
        const reasons = ['teamwork', 'creativity', 'respect', 'focus'];
        const lessonDays = [1, 5, 7, 12, 14, 19, 21, 26, 28];
        lessonDays.forEach((day, k) => {
            const strength = ci === 0 ? (heroCount - i) / heroCount : 0.4 + rnd() * 0.5;
            if (rnd() > 0.35 + strength * 0.5) return;
            const stars = rnd() < 0.25 + strength * 0.3 ? 2 : 1;
            const d = at(day, 17);
            logs.push({ id: `l${id}${k}`, studentId: id, classId: c.id, reason: reasons[(i + k) % 4], stars, date: dmy(d), createdAt: d, schoolYearKey: year });
        });
        if (params.has('tie') && ci === 0 && i < 2) {
            // Two heroes level on every tie-breaker.
            logs.splice(0, logs.length, ...logs.filter((l) => !['s0', 's1'].includes(l.studentId)));
            [1, 5, 7, 12].forEach((day) => logs.push({ id: `t${id}${day}`, studentId: id, classId: c.id, reason: 'teamwork', stars: 3, date: dmy(at(day, 17)), createdAt: at(day, 17), schoolYearKey: year }));
        }
        if (ci === 0 && i === heroCount - 2) {
            // A Rising Star: a quiet September, a bright October with a Growth Starfall.
            [7, 12, 14, 19, 21].forEach((day) => logs.push({ id: `r${day}`, studentId: id, classId: c.id, reason: 'focus', stars: 2, date: dmy(at(day, 17)), createdAt: at(day, 17), schoolYearKey: year }));
            logs.push({ id: 'rsf', studentId: id, classId: c.id, reason: 'scholar_s_bonus', stars: 1, note: 'Growth Starfall: a big step up', date: dmy(at(22, 17)), createdAt: at(22, 17), schoolYearKey: year });
        }
        // September (for the Rising Star comparison).
        [10, 15, 17, 22, 24, 29].forEach((day, k) => {
            if (rnd() > 0.6) return;
            const d = prevAt(day);
            logs.push({ id: `p${id}${k}`, studentId: id, classId: c.id, reason: reasons[k % 4], stars: ci === 0 && i === heroCount - 2 ? 0.5 : 1, date: dmy(d), createdAt: d, schoolYearKey: year });
        });
    }
});

const ourIds = new Set(students.filter((s) => s.classId === 'c1').map((s) => s.id));
const bounties = quiet ? [] : [
    { id: 'quiet_dragon_a', classId: 'c1', source: 'quiet_dragon', status: 'completed', type: 'standard', title: 'The Quiet Dragon', reward: '2 Gold for every hero', quietDragon: { minutes: 14, heroes: heroCount }, claimedAt: at(14, 18) },
    { id: 'quiet_dragon_b', classId: 'c1', source: 'quiet_dragon', status: 'completed', type: 'standard', title: 'The Quiet Dragon', reward: 'A Calm Star', quietDragon: { minutes: 9, heroes: heroCount }, claimedAt: at(26, 18) },
    { id: 'b1', classId: 'c1', status: 'completed', type: 'standard', title: 'Read 3 stories together', reward: 'Story time picnic', createdAt: at(3), claimedAt: at(12, 18) },
    { id: 'b2', classId: 'c1', status: 'completed', type: 'timer', title: 'Silent Library', reward: '+1 Team Quest', createdAt: at(18), claimedAt: at(19, 18) }
];
const oaths = quiet ? [] : [
    { id: 'o1', classId: 'c1', status: 'kept', keptAt: at(12).toISOString(), text: 'I will help a friend each lesson' },
    { id: 'o2', classId: 'c1', status: 'kept', keptAt: at(19).toISOString(), text: 'I will read every evening' },
    { id: 'o3', classId: 'c1', status: 'kept', keptAt: at(28).toISOString(), text: 'I will speak only English in class' },
    { id: 'o4', classId: 'c1', status: 'active', text: 'I will learn 10 new words' }
];
const quizzes = quiet ? [] : [
    { id: 'q2', classId: 'c1', status: 'completed', completedAt: at(28, 18), results: { rewards: { studentRewards: [{ studentId: 's3', top: true, firstTry: 3 }, { studentId: 's6', top: true, firstTry: 3 }], prize: { studentId: 's3', kind: 'treasure', item: { name: 'Pumpkin Lantern', icon: '🎃' } } } } },
    { id: 'q1', classId: 'c1', status: 'completed', completedAt: at(14, 18), results: { rewards: { studentRewards: [{ studentId: 's9', top: true, firstTry: 4 }], prize: { studentId: 's9', kind: 'gold', gold: 10 } } } }
];

window.__pvLogs = logs;
window.__pvCollections = { quest_history: [], quiz_of_the_week: quizzes, ember_oaths: oaths, quest_bounties: bounties };
window.__pvHerald = () => pickOf(['The arena roars!', 'What a month, heroes!', 'Legends are made here.', '']);

const { applySubscriptionPreview } = await import('./utils/subscription.js');
applySubscriptionPreview({ tier: params.get('plan') || 'elite' });

state.setCurrentUserId('me');
state.setSchoolYearState({ activeYearKey: year, rolloverStatus: 'active', openedAt: '2026-09-07' });
state.setAllSchoolYears([{ id: year, startsAt: '2026-09-07' }]);
state.setAllSchoolClasses(classes);
state.setAllTeachersClasses?.(classes);
state.setAllStudents(students);
state.setAllStudentScores(scores);
state.setAllWrittenScores([]);
state.setAllAttendanceRecords([]);
state.setAllScheduleOverrides([]);
state.setSchoolHolidayRanges([]);
state.setAllQuestBounties?.(bounties);
state.set('allEmberOaths', oaths);
state.set('globalSelectedClassId', 'c1');

const ceremony = await import('./features/ceremony.js');
window.__pvCeremony = ceremony;
window.__pvOurIds = ourIds;

async function open() {
    const pending = await ceremony.checkAndInitCeremony('c1');
    if (!pending) { console.warn('[preview] no ceremony pending'); return; }
    window.__pvStarted = ceremony.startCeremony(pending);
}
document.getElementById('pv-restart')?.addEventListener('click', () => { window.__pvStore?.clear(); location.reload(); });
await open();
