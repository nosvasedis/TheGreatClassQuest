// On-demand reads: the diary must not depend on which feature tabs were opened.
import { db, doc, getDoc, collection, query, where, getDocs } from '../firebase.js';
import * as state from '../state.js';
import { getDDMMYYYY, getNextLessonDate, getLeagueAiAudience } from '../utils.js';
import { buildAdventureLogContext, adventureDateKey } from './adventureLogContextCore.mjs';
import { collectLearnedToday } from './learnedTodayCore.mjs';
import { QUEST_TYPE_LABELS, normalizeQuestType } from './specialQuestEngine.js';
import { getISOWeekKey } from './guildScoring.js';
import { dataPath } from '../utils/tenant.mjs';

const dayDate = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };

export async function gatherAdventureLogContext(classId, { date = new Date(), hero = '' } = {}) {
    const teacherId = state.get('currentUserId');
    const schoolYearKey = state.getActiveSchoolYearKey();
    if (!teacherId || !schoolYearKey) throw new Error('Choose an active school year before writing the diary.');
    const dateKey = adventureDateKey(date), day = dayDate(dateKey), dateString = getDDMMYYYY(day);
    const health = {};
    const stillCurrent = () => state.get('currentUserId') === teacherId && state.getActiveSchoolYearKey() === schoolYearKey;
    const read = async (key, operation, fallback) => {
        let timer;
        try {
            // Offline SDK reads can wait indefinitely; retain known data and keep the closing ritual usable.
            const result = await Promise.race([operation(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Context read timed out')), 10000); })]);
            health[key] = 'fresh';
            return result;
        } catch (error) {
            console.warn(`Adventure context: ${key} unavailable.`, error.code || error.message);
            health[key] = fallback == null ? 'unavailable' : 'cached';
            return fallback;
        } finally { clearTimeout(timer); }
    };
    const documents = async (path, constraints) => (await getDocs(query(collection(db, dataPath(path)), ...constraints))).docs.map(d => ({ id: d.id, ...d.data() }));
    const classRead = (path, daily = false) => documents(path, [where('classId', '==', classId), ...(daily ? [where('date', 'in', [...new Set([dateString, dateKey, dateString.replaceAll('-', '/')])])] : [where('schoolYearKey', '==', schoolYearKey)])]);
    const teacherRead = path => documents(path, [where('teacherId', '==', teacherId), where('schoolYearKey', '==', schoolYearKey)]);
    const cached = key => state.get(key) || [];
    const sources = {
        classData: () => read('classData', async () => { const s = await getDoc(doc(db, dataPath('classes'), classId)); return s.exists() ? { id: s.id, ...s.data() } : null; }, cached('allTeachersClasses').find(c => c.id === classId)),
        students: () => read('students', () => documents('students', [where('classId', '==', classId)]), cached('allStudents')),
        events: () => read('events', () => documents('quest_events', [where('schoolYearKey', '==', schoolYearKey)]), cached('allQuestEvents')),
        holidays: () => read('holidays', async () => { const s = await getDoc(doc(db, dataPath('school_settings'), 'holidays')); return s.data()?.ranges || []; }, cached('schoolHolidayRanges')),
        awards: () => read('awards', () => classRead('award_log', true), cached('allAwardLogs')),
        attendance: () => read('attendance', () => classRead('attendance', true), cached('allAttendanceRecords')),
        trials: () => read('trials', () => classRead('written_scores', true), cached('allWrittenScores')),
        assignments: () => read('assignments', () => classRead('quest_assignments'), cached('allQuestAssignments')),
        quizzes: () => read('quizzes', () => classRead('quiz_of_the_week'), null),
        questRuns: () => read('questRuns', () => classRead('quest_event_runs'), null),
        wheel: () => read('wheel', () => classRead('fortune_wheel_log'), cached('fortuneWheelLog')),
        bounties: () => read('bounties', () => classRead('quest_bounties'), cached('allQuestBounties')),
        ceremonies: () => read('ceremonies', () => classRead('ceremony_snapshots'), null),
        campfires: () => read('campfires', async () => { const s = await getDoc(doc(db, dataPath('campfire_sessions'), `${classId}_${dateKey}`)); return s.exists() ? [{ id: s.id, ...s.data() }] : []; }, null),
        oaths: () => read('oaths', () => teacherRead('ember_oaths'), cached('allEmberOaths')),
        completedStories: () => read('completedStories', () => documents('completed_stories', [where('classId', '==', classId)]), cached('allCompletedStories')),
        storyChapters: () => read('storyChapters', () => documents(`story_data/${classId}/story_history`, [where('createdAt', '>=', day), where('createdAt', '<', new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1))]), null),
        logs: () => read('logs', () => classRead('adventure_logs'), cached('allAdventureLogs'))
    };
    const entries = await Promise.all(Object.entries(sources).map(async ([key, getter]) => [key, await getter()]));
    if (!stillCurrent()) throw new Error('The teacher or school year changed while gathering the lesson.');
    const data = Object.fromEntries(entries);
    if (!data.classData || data.classData.createdBy?.uid !== teacherId) throw new Error('The diary can only use one of your classes.');
    const students = data.students.filter(s => s.classId === classId).map(s => ({ ...s }));
    const events = data.events;
    const played = (data.quizzes || []).find(q => adventureDateKey(q.completedAt) === dateKey);
    const chapters = data.storyChapters || [];
    const assignment = (data.assignments || []).filter(a => a.classId === classId).sort((a, b) => adventureDateKey(b.createdAt).localeCompare(adventureDateKey(a.createdAt)))[0];
    const learnedToday = collectLearnedToday({
        quiz: played ? { playedToday: true, curriculum: played.curriculum } : null,
        story: chapters.length ? { updatedToday: true, word: chapters.at(-1).word, sentence: chapters.at(-1).sentence } : null,
        trials: (data.trials || []).filter(t => t.classId === classId && adventureDateKey(t.date) === dateKey).map(t => ({ type: t.type, title: t.title })),
        quests: events.filter(e => e.classId === classId && adventureDateKey(e.dateKey || e.date) === dateKey && (data.questRuns || []).some(r => r.eventId === e.id && ['active', 'completed'].includes(r.status))).map(e => ({ label: QUEST_TYPE_LABELS[normalizeQuestType(e.type)] || '', prompt: e.presentation?.prompt || e.prompt || '' })),
        assignment: assignment ? { text: assignment.text, createdToday: adventureDateKey(assignment.createdAt) === dateKey, testToday: false } : null
    });
    const { getClassQuestProgressData } = await import('./worldMap.js');
    const scores = cached('allStudentScores');
    health.scores = 'live';
    const { GUILDS } = await import('./guilds.js');
    const { getActiveSkills, getHeroTitle } = await import('./heroSkillTree.js');
    students.forEach(s => {
        if (s.guildId && GUILDS[s.guildId]) s.guildName = GUILDS[s.guildId].name;
        const score = scores.find(item => item.id === s.id);
        s.heroTitle = getHeroTitle(s.heroClass, score?.heroLevel);
        s.heroSkillNames = getActiveSkills(s.heroClass, score?.heroSkills || []).map(skill => skill.name);
    });
    const { BOOK_ATLAS } = await import('./bookAtlas.data.mjs');
    const bookPlan = data.classData.bookPlan;
    if (bookPlan?.history?.length) {
        data.classData = { ...data.classData, bookPlan: { ...bookPlan, history: bookPlan.history.map(h => {
            const book = BOOK_ATLAS.find(b => b.id === h.bookId);
            const unit = book?.units?.find(u => String(u.n) === String(h.unit));
            return { ...h, bookTitle: book?.title || h.bookId, theme: unit?.theme || unit?.title || '', grammar: unit?.grammar || '' };
        }) } };
    }
    const { getActiveFestival } = await import('../utils/shopCalendar.js');
    const festival = getActiveFestival(day);
    let weather = null;
    if (dateKey === adventureDateKey(new Date())) {
        const [{ getCachedWeather }, { resolveWeatherTheme }] = await Promise.all([import('./liveWeather.js'), import('./weatherTheme.js')]);
        const reading = getCachedWeather();
        if (reading) weather = { description: resolveWeatherTheme(reading.code)?.weatherText || '' };
    }
    const nextLesson = getNextLessonDate(classId, [data.classData], cached('allScheduleOverrides'), data.holidays, state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {}, day);
    const context = buildAdventureLogContext({ ...data, date: dateKey, schoolYearKey, hero, students, scores, events, weather, festival, learnedToday, weekKey: getISOWeekKey(day), questProgress: getClassQuestProgressData(data.classData, students, scores), nextLessonDate: nextLesson ? adventureDateKey(nextLesson) : '', audience: getLeagueAiAudience(data.classData.questLevel), sourceHealth: health });
    if (!stillCurrent()) throw new Error('The teacher or school year changed while gathering the lesson.');
    return { context, learnedToday, classData: data.classData, students, attendance: data.attendance || [], awards: data.awards || [] };
}
