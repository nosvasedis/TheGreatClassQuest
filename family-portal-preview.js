// Dev-only preview of the Family Portal with sample data. Open /family-portal-preview.html under `npm run dev`.
// ?tab=home|homework|progress|messages  ?lang=el  ?empty=1  ?holiday=1  ?view=thread|compose  ?bare=1 (no new fields)
import { roleShellsHTML } from './templates/roles.js';
import * as state from './state.js';

const params = new URLSearchParams(location.search);
try { localStorage.setItem('gcq_family_lang_v1', ['en', 'bi'].includes(params.get('lang')) ? params.get('lang') : 'el'); } catch { /* preview */ }
if (params.get('seen') !== '1') {
    try { Object.keys(localStorage).filter((k) => k.startsWith('gcq_family_')).forEach((k) => k !== 'gcq_family_lang_v1' && localStorage.removeItem(k)); } catch { /* preview */ }
}

document.getElementById('app-root').innerHTML = roleShellsHTML;
document.getElementById('secretary-screen')?.remove();
document.getElementById('parent-screen').classList.remove('hidden');

const day = (offset, hour = 12) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(hour, 0, 0, 0); return d; };
const iso = (offset) => { const d = day(offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const monthKey = (back) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const tomorrowDay = String(day(1).getDay());
const otherDay = String(day(4).getDay());

const empty = params.get('empty') === '1';
const bare = params.get('bare') === '1';

state.setCurrentUserProfile({ role: 'parent', linkedStudentId: 'stu_maria' });
state.setSchoolName('Rentis English School');
state.setSchoolHolidayRanges(params.get('holiday') === '1'
    ? [{ name: 'Christmas holidays', start: iso(-2), end: iso(9) }]
    : [{ name: 'Christmas holidays', start: iso(10), end: iso(24) }]);

const snapshot = empty ? {
    studentId: 'stu_maria', studentName: 'Maria Papadopoulou', className: 'Junior B Owls', classLogo: '🦉', guildId: 'owl_wisdom', teacherName: 'Ms Eleni',
    scheduleDays: [tomorrowDay, otherDay], timeStart: '17:00', timeEnd: '18:30', progress: { totalStars: 0, monthlyStars: 0, heroLevel: 0, gold: 0 },
    weekStars: 0, starsHistory: [], attendanceSummary: { absences: 0, absenceDates: [] }, gradeHistory: [], recentCelebrations: [], publishedNotes: []
} : {
    studentId: 'stu_maria',
    studentName: 'Maria Papadopoulou',
    className: 'Junior B Owls',
    classLogo: '🦉',
    guildId: 'owl_wisdom',
    teacherName: 'Ms Eleni',
    questLevel: params.get('level') || 'Junior B', // ?level=Pre-Junior | Junior A | A | C ...
    heroClass: 'Sage',
    scheduleDays: [tomorrowDay, otherDay],
    timeStart: '17:00',
    timeEnd: '18:30',
    // ?stars=N sets this month's stars; ?mix=old drops the per-skill tally (an older server).
    progress: { totalStars: 86, monthlyStars: Number(params.get('stars') ?? 14), heroLevel: 4, gold: 23 },
    monthReasons: params.get('mix') === 'old' ? undefined : { teamwork: 5, creativity: 3, respect: 2.5, focus: 4, quiet_dragon: 0.5, torn_map: 1, correction: -1 },
    weekStars: 5,
    // ?months=N: N finished months (default 5), to see a long school year on the doorframe.
    starsHistory: Array.from({ length: Number(params.get('months') || 5) }, (_, i) => Number(params.get('months') || 5) - i)
        .map((b, i) => ({ month: monthKey(b), stars: [9, 12, 17, 11, 15, 8, 20, 13, 6, 16][i % 10] })),
    attendanceSummary: { absences: 2, absenceDates: [iso(-12), iso(-30)] },
    latestGrade: { label: '18 / 20', title: 'Unit 2 Test', type: 'test', percent: 90 },
    gradeAveragePercent: 84,
    gradeHistory: [
        { title: 'Unit 2 Test', type: 'test', date: iso(-3), scoreLabel: '18 / 20', percent: 90 },
        { title: 'dictation', type: 'dictation', date: iso(-7), scoreLabel: 'Very good', percent: 80 },
        { title: 'Unit 1 Test', type: 'test', date: iso(-20), scoreLabel: '15 / 20', percent: 75 },
        { title: 'dictation', type: 'dictation', date: iso(-24), scoreLabel: '?', percent: null }
    ],
    recentCelebrations: [
        { reason: 'teamwork', stars: 1, note: 'Helped Nikos with the reading', date: iso(-1) },
        { reason: 'creativity', stars: 2, note: '', date: iso(-3) },
        { reason: 'quiet_dragon', stars: 0.5, note: '', date: iso(-6) },
        { reason: 'focus', stars: 1, note: 'Finished the whole worksheet', date: iso(-8) }
    ],
    // ?note=spelling: a recent note about spelling, to see Lumi follow the class notes.
    publishedNotes: params.get('note') === 'spelling' ? [
        { body: 'Μερικά λάθη στην ορθογραφία αυτή την εβδομάδα και ξεχνάει συχνά το τετράδιο. Με λίγη επανάληψη θα τα πάει μια χαρά!', createdAt: day(-2).toISOString(), label: 'Parent Summary' }
    ] : [
        { body: 'Maria read her part in the class play with real confidence today. Please keep reading together at home: ten minutes is plenty.', createdAt: day(-1).toISOString(), label: 'Parent Summary' },
        { body: 'A lovely start to the year.', createdAt: day(-20).toISOString(), label: 'Parent Summary' }
    ],
    ...(bare ? {} : {
        heroOfDayWins: 3,
        familiar: { typeId: 'emberfang', level: 3, state: 'alive', seenLevel: 3, name: 'Pip', look: null },
        satchel: [
            { name: 'Glow Lantern', icon: '🏮', description: 'A little lantern for dark caves.', tier: 'rare', acquiredAt: day(-4).toISOString() },
            { name: 'Map of Whispers', icon: '🗺️', description: 'Shows one hidden path.', tier: 'common', acquiredAt: day(-14).toISOString() },
            { name: 'Owl Feather Quill', icon: '🪶', description: 'Writes in silver ink.', tier: 'epic', acquiredAt: day(-22).toISOString() },
            { name: 'Kept promise', icon: '🔥', description: 'An Ember Oath kept.', kind: 'keepsake', acquiredAt: day(-30).toISOString() },
            { name: 'Lucky Clover', icon: '🍀', description: '', tier: 'common', acquiredAt: day(-34).toISOString() }
        ]
    })
};
// ?lastyear=1: a child who moved up keeps last year's records; none of them may show.
const lastYear = params.get('lastyear') === '1';
if (lastYear) {
    snapshot.classId = 'class_jb';
    snapshot.gradeHistory = [...(snapshot.gradeHistory || []), { title: 'dictation', type: 'dictation', date: '2026-05-20', scoreLabel: '9 / 20', percent: 45 }];
    if (!snapshot.gradeHistory.some((g) => g.date >= '2026-08-20')) snapshot.latestGrade = { label: '9 / 20', title: 'dictation', type: 'dictation', percent: 45 };
    snapshot.attendanceSummary = { absences: 4, absenceDates: [...(snapshot.attendanceSummary?.absenceDates || []), '2026-05-12', '2026-04-02'] };
    snapshot.recentCelebrations = [...(snapshot.recentCelebrations || []), { reason: 'focus', stars: 1, note: 'Last June', date: '2026-06-10' }];
}
state.setCurrentParentSnapshot(snapshot);
state.setCurrentParentHomework(empty ? [] : [
    ...(lastYear ? [{
        id: 'hw-old', classId: 'class_keys', sourceClassId: 'class_keys', title: 'Quest Assignment: Homework', publishedAt: '2026-06-05T10:00:00.000Z', updatedAt: '2026-06-05T10:00:00.000Z',
        body: 'Junior Keys revision.\nUpcoming test: dictation on Friday.', sourceTestDate: '2026-06-12'
    }] : []),
    {
        id: 'hw1', title: 'Quest Assignment: Homework', publishedAt: day(-1).toISOString(),
        body: 'Workbook page 24, exercises 1 to 3.\nLearn the new words on page 22.\nUpcoming test: Unit 3 Test on Tuesday.\nCurriculum: Unit 3 vocabulary, past simple',
        sourceTestDate: iso(6), ...(lastYear ? { classId: 'class_jb' } : {})
    },
    { id: 'hw2', ...(lastYear ? { classId: 'class_jb' } : {}), title: 'Quest Assignment: Homework', publishedAt: day(-5).toISOString(), body: 'Read pages 18-19 aloud to someone at home.' }
]);
const threads = empty ? [] : [
    { id: 't1', threadType: 'progress-share', previewText: 'Maria read her part in the class play with real confidence today.', lastMessageAt: day(-1, 19).toISOString(), lastAuthorRole: 'teacher' },
    { id: 't2', threadType: 'absence-note', previewText: 'Thank you for letting us know.', lastMessageAt: day(-12, 10).toISOString(), lastAuthorRole: 'parent' }
];
state.setCurrentCommunicationThreads(threads);
state.setCurrentCommunicationMessages([
    { authorRole: 'teacher', body: 'Maria read her part in the class play with real confidence today.', createdAt: day(-1, 19).toISOString() },
    { authorRole: 'parent', body: 'Thank you! She practised a lot at home.', createdAt: day(-1, 20).toISOString() },
    { authorRole: 'secretary', body: 'Lovely to hear. See you on Thursday!', createdAt: day(0, 9).toISOString() }
]);

const portal = await import('./features/parentPortal.js');
portal.wireParentPortalListeners({
    onLogout: () => alert('log out'),
    onRefresh: () => new Promise((r) => setTimeout(r, 900)),
    onSelectThread: (id) => state.setCurrentCommunicationThreadId(id)
});
const tab = params.get('tab') || 'home';
if (params.get('view')) {
    state.setCurrentCommunicationThreadId('t1');
    state.setParentView({ messageView: params.get('view') });
}
portal.activateParentTab(tab, { animate: false });
portal.renderParentPortal();
window.__fp = { state, portal };
document.body.dataset.ready = '1';
