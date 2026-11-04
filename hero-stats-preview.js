// Hero stats preview: the real modal with sample heroes, no Firebase.
// /hero-stats-preview.html?hero=nikos|valentina|eleni|tiny[&roster=1][&shot=1]
import * as state from './state.js';
import * as utils from './utils.js';
import { applySubscriptionPreview } from './utils/subscription.js';
import { openHeroStatsModal, primeHeroStatsHistory } from './ui/modals/heroStats.js';
import { studentAnalyticsModalHTML } from './templates/modals/studentAnalytics.js';

document.body.insertAdjacentHTML('beforeend', studentAnalyticsModalHTML);

applySubscriptionPreview({ tier: 'elite' });
const params = new URLSearchParams(location.search);
if (params.has('shot')) document.body.classList.add('pv-shot');

const face = (bg, fur) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="58" r="30" fill="${fur}"/><ellipse cx="26" cy="40" rx="10" ry="20" fill="${fur}"/><ellipse cx="74" cy="40" rx="10" ry="20" fill="${fur}"/><circle cx="40" cy="54" r="5" fill="#222"/><circle cx="60" cy="54" r="5" fill="#222"/><ellipse cx="50" cy="66" rx="6" ry="4" fill="#a33"/></svg>`);

const today = new Date();
const dayKey = (back) => utils.getDDMMYYYY(new Date(today.getFullYear(), today.getMonth(), today.getDate() - back));
const stamp = (back) => ({ toMillis: () => today.getTime() - back * 86400000 });
const monthKey = utils.getLocalMonthKey();

state.setAllSchoolYears([{ id: '2026-2027', startsAt: '2026-09-07', endsAt: '2027-06-25' }]);
state.setSchoolYearState({ activeYearKey: '2026-2027' });

const classes = [
    {
        id: 'c1', name: 'The Small Dodos', logo: '🦤', questLevel: 'Junior A', scheduleDays: ['2', '4'], timeStart: '16:30', timeEnd: '18:00',
        createdBy: { uid: 't1', name: 'Mr. Nasos' },
        teacherBoons: params.has('boon') ? {} : { [monthKey]: { studentId: 'nikos', reasonText: 'Helped a new classmate all week' } },
    },
    { id: 'c2', name: 'Little Acorns', logo: '🌰', questLevel: 'Pre-Junior', scheduleDays: ['1', '3'], timeStart: '15:00', timeEnd: '16:00', createdBy: { uid: 't1', name: 'Mr. Nasos' } },
];
const students = [
    { id: 'nikos', name: 'Nikos Georgiou', classId: 'c1', heroClass: 'Sage', guildId: 'dragon_flame', avatar: face('#fde68a', '#a16207') },
    { id: 'valentina', name: 'Valentina Gourai', classId: 'c1', heroClass: 'Guardian', guildId: 'owl_wisdom', avatar: face('#f5d0fe', '#f9a8d4') },
    { id: 'eleni', name: 'Eleni Dimitriou', classId: 'c1', avatar: '' },
    { id: 'maria', name: 'Maria Papadaki', classId: 'c1', guildId: 'owl_wisdom', avatar: face('#bbf7d0', '#16a34a') },
    { id: 'tiny', name: 'Giorgos Alexiou', classId: 'c2', avatar: face('#bae6fd', '#0369a1') },
];
const scores = [
    {
        id: 'nikos', monthlyStars: 9.5, totalStars: 61.5, gold: 140, heroLevel: 2, starsByReason: { creativity: 52 },
        heroSkills: ['sage_1a'], heroOfDayWins: 4, heroOfDayWinsYearKey: '2026-2027', lastMonthlyResetDate: `${monthKey}-01`,
        familiar: { typeId: 'emberfang', state: 'alive', level: 2, name: 'Pip', look: { v: 2, seed: 7 } },
        inventory: [{ id: 'stall_lantern', name: 'Moonlit Lantern', icon: '🏮', price: 40, tier: 'rare' }, { id: 'leg_aurum', name: 'Aurum Satchel', icon: '💰' }],
    },
    { id: 'valentina', monthlyStars: 2, totalStars: 24, gold: 34, heroLevel: 1, starsByReason: { respect: 21 }, heroOfDayWins: 1, heroOfDayWinsYearKey: '2026-2027', inventory: [] },
    { id: 'eleni', monthlyStars: 0, totalStars: 0, gold: 0, inventory: [] },
    { id: 'maria', monthlyStars: 12, totalStars: 40, gold: 50, inventory: [] },
    { id: 'tiny', monthlyStars: 3, totalStars: 11, gold: 9, inventory: [] },
];
const log = (id, studentId, back, reason, stars, note = '') => ({ id, studentId, classId: 'c1', reason, stars, date: dayKey(back), note, createdAt: stamp(back) });
const logs = [
    log('l1', 'nikos', 0, 'creativity', 2, 'Invented a whole new ending for the story, with English speech bubbles.'),
    log('l2', 'nikos', 0, 'quiz_of_the_week', 1),
    log('l3', 'nikos', 2, 'teamwork', 1.5),
    log('l4', 'nikos', 2, 'peer_boon', 0.5),
    log('l5', 'nikos', 2, 'teacher_boon', 2, 'Helped a new classmate all week'),
    log('l6', 'nikos', 2, 'focus', 1),
    log('l7', 'nikos', 2, 'creativity', 1),
    log('l8', 'valentina', 1, 'focus', 2),
];
const written = [
    { id: 'w1', studentId: 'nikos', classId: 'c1', type: 'test', title: 'Unit 1 test', date: '2026-09-29', scoreNumeric: 72, maxScore: 100 },
    { id: 'w2', studentId: 'nikos', classId: 'c1', type: 'dictation', title: 'Dictation 1', date: '2026-10-06', scoreNumeric: 8, maxScore: 10, normalizedPercent: 80 },
    { id: 'w3', studentId: 'nikos', classId: 'c1', type: 'test', title: 'Unit 2 test', date: '2026-10-20', scoreNumeric: 88, maxScore: 100 },
    { id: 'w4', studentId: 'nikos', classId: 'c1', type: 'dictation', title: 'Dictation 2', date: '2026-10-27', scoreNumeric: 9, maxScore: 10, normalizedPercent: 90 },
    { id: 'w5', studentId: 'nikos', classId: 'c1', type: 'test', title: 'Unit 3 test', date: '2026-11-03', scoreNumeric: 94, maxScore: 100 },
];

state.setAllSchoolClasses(classes);
state.setAllTeachersClasses(classes);
state.setAllStudents(students);
state.setAllStudentScores(scores);
state.setAllAwardLogs(logs);
state.setAllWrittenScores(written);
state.setAllAttendanceRecords([{ id: 'a1', studentId: 'nikos', classId: 'c1', date: dayKey(6) }]);
state.setAllAdventureLogs([{ id: 'adv1', classId: 'c1', date: dayKey(2), heroStudentId: 'nikos', createdAt: stamp(2) }]);
state.setTodaysStars({ nikos: { stars: 2 } });

primeHeroStatsHistory('nikos', { '2026-09': 8, '2026-10': 17.5 });
primeHeroStatsHistory('valentina', { '2026-09': 9, '2026-10': 13 });
primeHeroStatsHistory('tiny', { '2026-09': 3, '2026-10': 5 });
primeHeroStatsHistory('eleni', {});
primeHeroStatsHistory('maria', { '2026-09': 14, '2026-10': 11 });

document.getElementById('pv-toolbar').innerHTML = ['?hero=nikos', '?hero=valentina', '?hero=eleni', '?hero=tiny', '?hero=nikos&roster=1', '?hero=valentina&boon=1']
    .map((q) => `<a href="${q}">${q.slice(1)}</a>`).join('');

const hero = params.get('hero') || 'nikos';
if (params.has('roster')) {
    import('./ui/modals/classRoster.js').then((m) => m.openClassRosterModal('c1', {}));
} else {
    openHeroStatsModal(hero);
}
