// Projector cards preview: the Director's real card builders on a made-up class, no Firebase reads.
// /projector-cards-preview.html[?date=YYYY-MM-DD][&cards=a,b,c]
import * as state from './state.js';

const params = new URLSearchParams(location.search);
const today = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dmy = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
const daysAgo = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n, 11);

const names = ['Maria Papadopoulou', 'Nikos Georgiou', 'Eleni Dimitriou', 'Kostas Ioannou', 'Sofia Nikolaou', 'Giorgos Pappas', 'Anna Vlachou', 'Dimitris Karras', 'Katerina Lazarou', 'Yannis Michail', 'Ioanna Christou', 'Petros Alexiou'];
const paths = ['Guardian', 'Sage', 'Vanguard', 'Paladin', 'Guardian', 'Artificer', 'Scholar', 'Vanguard', 'Patron', 'Nomad', 'Sage', 'Guardian'];
const guilds = ['dragon_flame', 'grizzly_might', 'owl_wisdom', 'phoenix_rising'];
const cls = {
    id: 'c1', name: 'Junior B · Owls', logo: '🦉', questLevel: 'Junior B', difficultyLevel: 2,
    scheduleDays: ['1', '3', '5'], timeStart: '17:00', timeEnd: '18:30', createdBy: { uid: 'me' },
    teamLooks: null,
    pendingStarfalls: [
        { id: 'p1', studentId: 's2', bonusAmount: 1, kind: 'shine', trialType: 'test' },
        { id: 'p2', studentId: 's5', bonusAmount: 0.5, kind: 'growth', trialType: 'dictation' },
        { id: 'p3', studentId: 's8', bonusAmount: 1, kind: 'shine', trialType: 'test' }
    ],
    dayTreasures: {}
};
const students = names.map((name, i) => ({ id: `s${i}`, name, classId: 'c1', heroClass: paths[i], guildId: guilds[i % 4] }));
const seal = (date, id) => ({ [id]: { date: iso(date), found: date.getTime() } });
const scores = students.map((s, i) => ({
    id: s.id, monthlyStars: 8 + i, totalStars: 30 + i * 3, gold: 40,
    heroSeals: {
        earned: {
            ...(i === 0 ? seal(daysAgo(1), 'four_winds') : {}),
            ...(i === 1 ? seal(daysAgo(2), 'open_hand') : {}),
            ...(i === 2 ? seal(daysAgo(0), 'wild_early_light') : {}),
            ...(i === 3 ? seal(daysAgo(3), 'quill_bright') : {}), // academic: never shown
            ...(i === 4 ? seal(daysAgo(4), 'oathkeeper') : {}),
            ...(i === 5 ? seal(daysAgo(1), 'path_vanguard') : {}),
            ...(i === 6 ? seal(daysAgo(5), 'hearth_return') : {}), // an absence: never shown
            ...(i === 7 ? seal(daysAgo(2), 'steadfast') : {})
        }
    },
    legendQuest: i === 0 ? { heroClass: 'Guardian', steps: ['2026-10-01', '2026-10-05', '2026-10-08'], completedAt: '2026-10-08T10:00:00Z' } : null
}));
state.setAllSchoolClasses([cls]);
state.setAllStudents(students);
state.setAllStudentScores(scores);
const reasons = ['teamwork', 'creativity', 'respect', 'focus'];
state.setAllAwardLogs(students.flatMap((s, i) => reasons.slice(0, i % 4 === 3 ? 3 : 4).map((reason, j) => ({
    id: `l${i}${j}`, classId: 'c1', studentId: s.id, reason, stars: 2, date: dmy(daysAgo(j + 1)), createdAt: { seconds: daysAgo(j + 1).getTime() / 1000 }
}))));
state.setAllQuestBounties([{
    id: 'quiet_dragon_x', classId: 'c1', source: 'quiet_dragon', status: 'completed', type: 'standard',
    title: 'The Quiet Dragon: 12 calm minutes', reward: '2 Gold for every hero',
    quietDragon: { minutes: 12, gift: {}, heroes: 12 }, claimedAt: { seconds: daysAgo(0).getTime() / 1000 - 3600 }
}]);
state.setAllQuestEvents([{ id: 'dt1', classId: 'c1', type: 'day_treasure', status: 'scheduled', date: dmy(today), details: { title: 'The Pumpkin Hoard' } }]);
state.setAllGuildScores(Object.fromEntries(guilds.map((g, i) => [g, {
    guildName: g, totalStars: 100 - i * 10,
    sealedChapters: { 'm2026_09': { place: i + 1, crowns: [5, 3, 2, 1][i], perMember: 9 - i } },
    chronicles: i === 0 ? { 'm2026_09': { lines: ['The Phoenix rose at dawn and never looked back.', 'Owls kept watch, wise and patient, a step behind.', 'The Grizzlies dug in when the storms came.', 'And the Dragon promised fire for October.'] } } : {}
}])));
state.setSchoolYearState({ activeYearKey: '2026-2027' });
state.setSchoolHolidayRanges([]);
state.set('globalSelectedClassId', 'c1');

// Today's Hero Duels on "this computer".
try {
    localStorage.setItem('gcq.heroDuels.v1', JSON.stringify({ c1: {
        v: 1, id: 'g1', classId: 'c1', dateKey: dmy(today), createdAt: Date.now(), heroes: students.map((s) => s.id), teams: null,
        rules: {}, points: { s0: 7, s1: 5, s2: 5, s3: 2 }, wins: { s0: 3, s1: 2, s2: 1, s3: 1 }, played: { s0: 4, s1: 3, s2: 3, s3: 2, s4: 2 },
        duels: [{ n: 1, ids: ['s0', 's1'], winners: ['s0'], scores: {}, gains: {}, at: Date.now() }], current: null, finished: false
    } }));
} catch { /* fine */ }

const { applySubscriptionPreview } = await import('./utils/subscription.js');
applySubscriptionPreview({ tier: params.get('tier') || 'elite' });
const { hydrateWallpaperCard, buildSkyCardElement } = await import('./ui/wallpaper.js');
const all = ['quest_rank_portal', 'class_quest', 'hero_seals_week', 'hero_duels_today', 'quiet_dragon_week', 'starfall_waiting',
    'hero_paths_class', 'guild_chapter_chronicle', 'guild_leaderboard', 'holiday', 'pre_holiday_hype', 'post_holiday_welcome', 'special_day',
    'next_lesson', 'time_week_path', 'time_month_calendar', 'class_familiar_parade'];
const wanted = params.get('cards') ? params.get('cards').split(',') : all;
const grid = document.getElementById('pv-grid');
const missing = [];
for (const type of wanted) {
    let card = null;
    try { card = await hydrateWallpaperCard(type, 'c1'); } catch (err) { console.error(type, err); }
    if (!card) { missing.push(type); continue; }
    const wrap = document.createElement('div');
    wrap.innerHTML = `<p class="pv-label">${type}</p>`;
    wrap.appendChild(buildSkyCardElement(card));
    grid.appendChild(wrap);
}
document.getElementById('pv-missing').textContent = missing.length ? `No card (nothing to show): ${missing.join(', ')}` : '';
document.body.dataset.ready = '1';
