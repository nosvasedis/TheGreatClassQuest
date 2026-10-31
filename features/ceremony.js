// /features/ceremony.js — Ceremony of the Month.
// Classic Arena (torchlit arena, Team Quest then Hero's Challenge) and the
// Growth Festival (storybook garden for Pre-Junior). Results are
// prepared and locked once (ceremonySnapshots); markup lives in
// ceremonyArenaView.js / ceremonyGardenView.js; effects in ui/ceremonyFx.js;
// sound in ceremonyAudio.js.

import { quietly } from '../utils/runtimeMetrics.js';
import '../styles/ceremony_arena.css';
import '../styles/ceremony_garden.css';
import { db, updateDoc, setDoc, getDoc, doc, collection, getDocs, query, where } from '../firebase.js';
import * as state from '../state.js';
import {
    prepareCeremonyAudio,
    playCeremonyTrack,
    playCeremonySfx,
    stopCeremonyMusic,
    stopCeremonyOneShots,
    duckCeremonyMusic,
    playCeremonyTally,
    stopCeremonyAudio,
    startCeremonyDrumroll,
    stopCeremonyDrumroll,
    toggleCeremonyAudioMute,
    isCeremonyAudioMuted
} from '../ceremonyAudio.js';
import { fetchLogsForMonth } from '../db/queries.js';
import { callGeminiApi } from '../api.js';
import { canUseFeature } from '../utils/subscription.js';
import * as utils from '../utils.js';
import { showToast } from '../ui/effects.js';
import { createCeremonyFx } from '../ui/ceremonyFx.js';
import { getNormalizedPercentForScore } from './assessmentConfig.js';
import { buildHeroTieStats, rankHeroes } from './heroRanking.js';
import { formatTeacherBoonReason, getTeacherBoonForMonth } from './boons.js';
import {
    getAwardLogMonthlyStarCredit,
    mergeMonthlyStarsFromArchivedHistoryAndAwardLogs,
    sumMonthlyStarCreditsByStudentFromAwardLogs
} from './awardLogReasonMeta.js';
import { getQuestMapZoneForProgressPercent } from './worldMap.js';
import { isGrowthStarfallNote } from './growthStarfallCore.mjs';
import { resolveCeremonyMode, buildGrowthSpotlights, chooseCanonicalWinners, chooseRisingStar, seededShuffle, seededHash, resolvePendingCeremonyMonth } from './ceremonyDomain.js';
import { getCeremonyStarVerdict, ensureCeremonyStarVerdict } from './ceremonyStarCheck.js';
import { rankForLevel } from './questRanksCore.mjs';
import { buildQuestAscent, crossedPortalInMonth, hasNextQuestMonth, nextMonthKeyOf } from './ceremonyAscentCore.mjs';
import { prepareCeremonySnapshot, lockCeremonySnapshot, saveCeremonyPlayback, ceremonySnapshotId, stripUndefinedDeep } from './ceremonySnapshots.js';
import { buildMonthMoments, buildMonthHonours } from './ceremonyMomentsCore.mjs';
import {
    arenaBackdropHtml,
    arenaIntroHtml,
    arenaSummonHtml,
    arenaRevealHtml,
    arenaDuelHtml,
    arenaCardFaceHtml,
    arenaTransitionHtml,
    arenaLadderTokenHtml,
    arenaStandingsHtml,
    arenaCollectiveHtml,
    arenaOutroHtml
} from './ceremonyArenaView.js';
import {
    gardenBackdropHtml,
    gardenIntroHtml,
    gardenLeagueHtml,
    gardenTransitionHtml,
    gardenParadeHtml,
    gardenFinaleHtml,
    gardenEndHtml,
    gardenSprigHtml
} from './ceremonyGardenView.js';
import { PUBLIC_DATA_PATH } from '../utils/tenant.mjs';

let ceremonyData = {
    active: false,
    phase: 'intro',
    monthKey: null,
    monthName: '',
    classId: null,
    league: null,
    classQueue: [],
    studentQueue: [],
    growthGardenClasses: [],
    growthPathfinderId: null,
    growthCanonicalStudentResults: [],
    growthStudents: [],
    growthSpotlights: [],
    growthWinners: [],
    classPointer: 0,
    studentPointer: 0
};

function getCeremonyMonthBounds(monthKey) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    return { monthStart, monthEnd };
}

function normalizeCreatedAt(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function existedByMonthEnd(record, monthKey) {
    const createdAt = normalizeCreatedAt(record?.createdAt);
    if (!createdAt) return true;
    return createdAt <= getCeremonyMonthBounds(monthKey).monthEnd;
}

function formatPercent(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(0) : '0';
}

// --- 1. STATUS & INITIALIZATION ---

export function updateCeremonyStatus() {
    const teamQuestBtn = document.querySelector('.nav-button[data-tab="class-leaderboard-tab"]');
    const heroChallengeBtn = document.querySelector('.nav-button[data-tab="student-leaderboard-tab"]');
    const homeBtn = document.querySelector('.nav-button[data-tab="about-tab"]');
    
    if (!teamQuestBtn || !heroChallengeBtn || !homeBtn) return;
    
    teamQuestBtn.classList.remove('ceremony-ready-pulse');
    heroChallengeBtn.classList.remove('ceremony-ready-pulse');
    homeBtn.classList.remove('ceremony-star-ring');

    const currentClassId = state.get('globalSelectedClassId');
    if (!currentClassId) return;

    const classData = state.get('allSchoolClasses').find(c => c.id === currentClassId);
    if (!classData) return;

    const pending = resolvePendingCeremonyMonth(new Date());
    if (!pending) return;

    const history = classData.ceremonyHistory || {};
    const isComplete = history[pending.monthKey] && history[pending.monthKey].complete;
    
    if (isComplete || !existedByMonthEnd(classData, pending.monthKey)) return;
    // No stars that month (undone test stars included) means no ceremony to call for.
    const verdict = getCeremonyStarVerdict(currentClassId, pending.monthKey);
    if (verdict === true) {
        homeBtn.classList.add('ceremony-star-ring');
    } else if (verdict === undefined) {
        ensureCeremonyStarVerdict(currentClassId, pending.monthKey).then((hasStars) => {
            if (hasStars && state.get('globalSelectedClassId') === currentClassId) updateCeremonyStatus();
        });
    }
}

export async function checkAndInitCeremony(classId, { replay = false } = {}) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classData) return null;

    const pending = resolvePendingCeremonyMonth(new Date());
    if (!pending) return null;
    const { monthKey, monthName } = pending;

    const history = classData.ceremonyHistory || {};
    const snapshotSnap = await getDoc(doc(db, `${PUBLIC_DATA_PATH}/ceremony_snapshots`, ceremonySnapshotId(classId, monthKey))).catch(() => null);
    const snapshot = snapshotSnap?.exists?.() ? { id: snapshotSnap.id, ...snapshotSnap.data() } : null;
    if (history[monthKey] && history[monthKey].complete && !replay) return null;

    if (!existedByMonthEnd(classData, monthKey)) return null;
    if (!replay && !['locked', 'completed'].includes(snapshot?.status) && !(await ensureCeremonyStarVerdict(classId, monthKey))) return null;

    const modeResult = resolveCeremonyMode(classData.questLevel);
    if (!modeResult.ok) return { blocked: true, reason: modeResult.reason, classId: classData.id, monthKey, monthName };
    return {
        monthKey,
        monthName,
        classId: classData.id,
        league: classData.questLevel,
        mode: modeResult.mode,
        snapshot,
        replay
    };
}

export async function replayCeremony(classId) {
    const params = await checkAndInitCeremony(classId, { replay: true });
    if (params) startCeremony(params);
    return params;
}
// --- 2. DATA LOADING ---

async function loadCeremonyResults() {
    if (ceremonyData.loaded) return true;
    try {
        if (ceremonyData.snapshot && ['locked', 'completed'].includes(ceremonyData.snapshot.status)) {
            hydrateCeremonyFromSnapshot(ceremonyData.snapshot, ceremonyData.replay);
            await Promise.all([loadQuestAscent(), loadMonthMoments()]);
            ceremonyData.loaded = true;
            return true;
        }
        if (ceremonyData.mode === 'growth_festival') {
            await loadGrowthCeremonyData();
            await persistPreparedCeremonySnapshot();
            await Promise.all([loadQuestAscent(), loadMonthMoments()]);
            ceremonyData.loaded = true;
            return true;
        }
        const [year, month] = ceremonyData.monthKey.split('-').map(Number);
        const { monthStart } = getCeremonyMonthBounds(ceremonyData.monthKey);
        const allStudents = state.get('allStudents') || [];
        
        // 1. Fetch Logs (a failed read must stop here: the results are locked once prepared)
        const logs = await fetchLogsForMonth(year, month, { throwOnError: true });
        ceremonyData.monthLogs = logs;
        const { fetchMonthlyHistory } = await import('../state.js');
        const archived = await fetchMonthlyHistory(ceremonyData.monthKey).catch(() => ({}));
        const activeYearKey = state.getActiveSchoolYearKey();
        const questHistorySnap = await getDocs(query(
            collection(db, `${PUBLIC_DATA_PATH}/quest_history`),
            where('schoolYearKey', '==', activeYearKey)
        ));
        const questHistoryRecords = questHistorySnap.docs.map(docSnap => docSnap.data());
        ceremonyData.questHistoryRecords = questHistoryRecords;
        const fromLogs = sumMonthlyStarCreditsByStudentFromAwardLogs(logs);
        const monthlyScores = mergeMonthlyStarsFromArchivedHistoryAndAwardLogs(fromLogs, archived || {});

        // 2. PREPARE CLASSES
        const allClasses = state.get('allSchoolClasses')
            .filter(c => c.questLevel === ceremonyData.league && existedByMonthEnd(c, ceremonyData.monthKey));
        const ranges = state.get('schoolHolidayRanges') || [];
        const overrides = state.get('allScheduleOverrides') || [];

        let classScores = allClasses.map(c => {
            const students = allStudents.filter(s => s.classId === c.id && existedByMonthEnd(s, ceremonyData.monthKey));
            const scoreFromStudents = students.reduce((sum, s) => sum + (monthlyScores[s.id] || 0), 0);
            const classTeamBonus = Number(c.teamQuestBonuses?.[ceremonyData.monthKey]) || 0;
            const score = scoreFromStudents + classTeamBonus;
            const goal = utils.calculateMonthlyClassGoalForDate(
                c,
                students.length,
                ranges,
                overrides,
                monthStart,
                questHistoryRecords
            );
            const historicalDifficulty = utils.getHistoricalDifficultyForMonth(c, monthStart, questHistoryRecords);
            
            const progress = goal > 0 ? (score / goal) * 100 : 0;
            const studentIds = new Set(students.map(s => s.id));
            const classLogs = logs.filter(l => studentIds.has(l.studentId) && l.reason !== 'pathfinder_bonus');
            const reasonCounts = {};
            classLogs.forEach(l => {
                if (!l.reason) return;
                reasonCounts[l.reason] = (reasonCounts[l.reason] || 0) + getAwardLogMonthlyStarCredit(l);
            });
            const topSkill = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

            return { 
                ...c, score, goal, progress, 
                level: historicalDifficulty + 1,
                studentCount: students.length,
                teamBonus: classTeamBonus,
                studentStars: scoreFromStudents,
                avgPerHero: students.length > 0 ? scoreFromStudents / students.length : 0,
                zone: getQuestMapZoneForProgressPercent(progress),
                topSkill
            };
        });

        classScores = utils.assignUniqueTeamQuestRanks(classScores);

        ceremonyData.classQueue = classScores.reverse(); 

        // 3. PREPARE STUDENTS
        const studentsInClass = allStudents.filter(s => s.classId === ceremonyData.classId && existedByMonthEnd(s, ceremonyData.monthKey));
        const ceremonyClass = state.get('allSchoolClasses').find((item) => item.id === ceremonyData.classId);
        const monthlyTeacherBoon = getTeacherBoonForMonth(ceremonyClass, ceremonyData.monthKey);
        const allWrittenScores = state.get('allWrittenScores') || []; 

        // Ranked by the shared hero rules (features/heroRanking.js), so the
        // Hero's Challenge, the Hall of Prodigies and this ceremony agree.
        const studentStats = rankHeroes(studentsInClass.map(s => {
            const sLogs = logs.filter(l => l.studentId === s.id);
            const score = monthlyScores[s.id] || 0;
            const reasonCounts = {};
            sLogs.forEach(l => {
                if (l.reason === 'special_quest' || !l.reason) return;
                reasonCounts[l.reason] = (reasonCounts[l.reason] || 0) + getAwardLogMonthlyStarCredit(l);
            });
            const topSkill = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

            const sScores = allWrittenScores.filter(sc => {
                if(sc.studentId !== s.id || !sc.date) return false;
                const d = utils.parseFlexibleDate(sc.date);
                return d && d.getMonth() === (month - 1) && d.getFullYear() === year;
            });

            return {
                id: s.id,
                name: s.name,
                avatar: s.avatar,
                score,
                stars: score,
                className: ceremonyClass?.name || '',
                classLogo: ceremonyClass?.logo || '📚',
                stats: { ...buildHeroTieStats(sLogs, sScores, getNormalizedPercentForScore), topSkill },
                teacherBoon: monthlyTeacherBoon?.studentId === s.id
                    ? { ...monthlyTeacherBoon, reasonText: formatTeacherBoonReason(monthlyTeacherBoon) }
                    : null
            };
        })).map(({ stars, ...rest }) => rest);

        // The class had stars that month (that is why the ceremony is offered), so a month that
        // reads as completely empty is a read that went wrong (offline cache): never lock it.
        if (!ceremonyData.replay && !logs.length && !Object.keys(archived || {}).length) {
            throw new Error('The month read as empty; not locking the ceremony.');
        }
        ceremonyData.studentQueue = studentStats.reverse();
        ceremonyData.risingStar = await findRisingStar(studentsInClass, logs, monthlyScores, studentStats);
        ceremonyData.phase = 'class_reveal';
        await persistPreparedCeremonySnapshot();
        await Promise.all([loadQuestAscent(), loadMonthMoments()]);
        ceremonyData.loaded = true;
        return true;
    } catch (e) {
        console.error('Ceremony Load Error:', e);
        return false;
    }
}

/**
 * Rising Star: the hero (not the Prodigy) who grew most against their own previous month.
 * September has no previous month in the school year, so only Growth Starfalls count then.
 */
async function findRisingStar(studentsInClass, logs, monthlyScores, rankedStudents) {
    try {
        if (studentsInClass.length < 3) return null;
        const [year, month] = ceremonyData.monthKey.split('-').map(Number);
        const prevDate = new Date(year, month - 2, 1);
        const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        const comparable = prevDate.getMonth() + 1 !== 8 && month !== 9;
        let previousScores = {};
        if (comparable) {
            const { fetchMonthlyHistory } = await import('../state.js');
            const [prevLogs, prevArchived] = await Promise.all([
                fetchLogsForMonth(prevDate.getFullYear(), prevDate.getMonth() + 1).catch(() => []),
                fetchMonthlyHistory(prevKey).catch(() => ({}))
            ]);
            previousScores = mergeMonthlyStarsFromArchivedHistoryAndAwardLogs(sumMonthlyStarCreditsByStudentFromAwardLogs(prevLogs), prevArchived || {});
        }
        const candidates = studentsInClass.map((s) => ({
            id: s.id,
            name: s.name,
            avatar: s.avatar,
            current: monthlyScores[s.id] || 0,
            previous: previousScores[s.id] || 0,
            hasPrevious: comparable && existedByMonthEnd(s, prevKey),
            growthStarfalls: logs.filter((l) => l.studentId === s.id && l.reason === 'scholar_s_bonus' && isGrowthStarfallNote(l.note)).length
        }));
        const excludeIds = rankedStudents.filter((s) => s.rank === 1 && Number(s.score) > 0).map((s) => s.id);
        const pick = chooseRisingStar(candidates, { excludeIds, seed: `${ceremonyData.classId}:${ceremonyData.monthKey}` });
        if (pick) {
            pick.previousMonthName = comparable ? prevDate.toLocaleString('en-GB', { month: 'long' }) : '';
            import('./ceremonyRisingStar.js').catch(quietly('features/ceremony.js'));
        }
        return pick;
    } catch (error) {
        console.warn('Rising Star skipped:', error);
        return null;
    }
}

/**
 * The Portal Ascent (features/ceremonyAscentCore.mjs): did the watching class step through the
 * Crystal Portal in the ceremony month, and what does next month's quest ask? Read live (not
 * from the locked snapshot), so a ceremony prepared before a late crossing still tells it.
 * Also marks every league class that rose a rank that month for its reveal card.
 */
async function loadQuestAscent() {
    ceremonyData.ascent = null;
    try {
        const monthKey = ceremonyData.monthKey;
        let records = ceremonyData.questHistoryRecords;
        if (!records) {
            const snap = await getDocs(query(
                collection(db, `${PUBLIC_DATA_PATH}/quest_history`),
                where('schoolYearKey', '==', state.getActiveSchoolYearKey())
            ));
            records = snap.docs.map((d) => d.data());
            ceremonyData.questHistoryRecords = records;
        }
        const classes = state.get('allSchoolClasses') || [];
        const classData = classes.find((c) => c.id === ceremonyData.classId);
        if (!classData) return;
        const { monthStart } = getCeremonyMonthBounds(monthKey);
        const nextKey = nextMonthKeyOf(monthKey);
        const nextStart = getCeremonyMonthBounds(nextKey).monthStart;
        const ranges = state.get('schoolHolidayRanges') || [];
        const overrides = state.get('allScheduleOverrides') || [];
        const allStudents = state.get('allStudents') || [];
        const garden = ceremonyData.mode === 'growth_festival';

        // Every class of the league that rose a rank that month gets a mark on its card.
        (ceremonyData.classQueue || []).forEach((entry) => {
            const c = classes.find((item) => item.id === entry.id);
            if (!c) return;
            const level = Math.max(1, Number(entry.level) || (utils.getHistoricalDifficultyForMonth(c, monthStart, records) + 1));
            if (crossedPortalInMonth(c, monthKey, records)) entry.rankUp = level + 1;
            else delete entry.rankUp;
        });

        const monthHeroes = allStudents.filter((s) => s.classId === classData.id && existedByMonthEnd(s, monthKey));
        const level = utils.getHistoricalDifficultyForMonth(classData, monthStart, records) + 1;
        const nextLevel = utils.getHistoricalDifficultyForMonth(classData, nextStart, records) + 1;
        const fromQueue = (ceremonyData.classQueue || []).find((entry) => entry.id === classData.id)
            || (ceremonyData.growthGardenClasses || []).find((entry) => entry.id === classData.id);
        const goal = Number(fromQueue?.goal) || utils.calculateMonthlyClassGoalForDate(classData, monthHeroes.length, ranges, overrides, monthStart, records);
        const score = Number(fromQueue?.score) || 0;
        let nextGoal = 0;
        if (hasNextQuestMonth(monthKey)) {
            const heroesNow = allStudents.filter((s) => s.classId === classData.id && s.enrollmentStatus !== 'inactive');
            if (heroesNow.length) nextGoal = utils.calculateMonthlyClassGoalForDate(classData, heroesNow.length, ranges, overrides, nextStart, records);
        }
        ceremonyData.ascent = buildQuestAscent({
            monthName: ceremonyData.monthName,
            nextMonthName: nextStart.toLocaleString('en-GB', { month: 'long' }),
            level,
            nextLevel,
            crossed: crossedPortalInMonth(classData, monthKey, records),
            score,
            goal,
            nextGoal,
            spoilsGold: Number(classData.portalCrossings?.[monthKey]?.gold) || 0,
            young: garden || utils.isYoungLearnerLeague(ceremonyData.league)
        });
        // Fetch the scene (and its stylesheet, which also styles the rank-up chips) early.
        import('./ceremonyAscent.js').catch(quietly('features/ceremony.js'));
    } catch (error) {
        console.warn('Portal Ascent skipped:', error);
        ceremonyData.ascent = null;
    }
}

/** Resolves `promise`, or `fallback` after `ms` (a slow read never holds the ceremony up). */
function withinTime(promise, ms, fallback) {
    return Promise.race([
        Promise.resolve(promise).catch(() => fallback),
        new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
    ]);
}

/**
 * The Chronicle of the Month (the class's moments across the newer quests) and, in the
 * Classic Arena, the Honours of the Month (Quiz Champions, Seal Bearers, new Legends).
 * Read live like the Portal Ascent; anything that cannot be read in time is simply left out.
 */
async function loadMonthMoments() {
    ceremonyData.moments = [];
    ceremonyData.honours = null;
    try {
        const classId = ceremonyData.classId;
        const monthKey = ceremonyData.monthKey;
        const classData = (state.get('allSchoolClasses') || []).find((c) => c.id === classId);
        if (!classData) return;
        const [year, month] = monthKey.split('-').map(Number);
        const students = (state.get('allStudents') || []).filter((s) => s.classId === classId && existedByMonthEnd(s, monthKey));
        const scores = state.get('allStudentScores') || [];
        const [logs, oaths, quizzes] = await Promise.all([
            ceremonyData.monthLogs || withinTime(fetchLogsForMonth(year, month), 4000, []),
            (state.get('allEmberOaths') || []).length
                ? state.get('allEmberOaths')
                : withinTime(import('../db/actions/emberOaths.js').then((m) => m.loadEmberOaths(classId)), 3500, []),
            withinTime(import('../db/actions/quizOfTheWeek.js').then((m) => m.getQuizHistory(classId, 12)), 3500, [])
        ]);
        if (!ceremonyData.active || ceremonyData.classId !== classId) return;
        const young = ceremonyData.mode === 'growth_festival' || utils.isYoungLearnerLeague(ceremonyData.league);
        ceremonyData.moments = buildMonthMoments({
            monthKey,
            classData,
            studentIds: students.map((s) => s.id),
            logs: logs || [],
            oaths: oaths || [],
            bounties: state.get('allQuestBounties') || [],
            quizzes: quizzes || [],
            scores,
            young
        });
        if (ceremonyData.mode !== 'growth_festival') {
            const honours = buildMonthHonours({ monthKey, students, scores, quizzes: quizzes || [], classId });
            ceremonyData.honours = honours.sections.length ? honours : null;
        }
        if (ceremonyData.moments.length || ceremonyData.honours) import('./ceremonyMoments.js').catch(quietly('features/ceremony.js'));
    } catch (error) {
        console.warn('Month moments skipped:', error);
        ceremonyData.moments = [];
        ceremonyData.honours = null;
    }
}

async function loadDataAndAdvance() {
    const stage = $('ceremony-stage-area');
    if (ceremonyData.mode !== 'growth_festival') {
        setScene('summon');
        stage.innerHTML = arenaSummonHtml();
        setHeading('', '');
        playCeremonySfx('whoosh');
    }
    setHerald('');
    setAction(ceremonyData.mode === 'growth_festival' ? 'Gathering the garden…' : 'Unrolling the scrolls…', null, { disabled: true });
    const started = performance.now();
    const ok = await loadCeremonyResults();
    if (!ceremonyData.active) return;
    if (!ok) {
        showLoadError();
        return;
    }
    const wait = Math.max(0, 1300 - (performance.now() - started));
    setTimeout(() => {
        if (ceremonyData.active) advanceCeremony();
    }, wait);
}

function hydrateCeremonyFromSnapshot(snapshot, replay = false) {
    ceremonyData.classQueue = snapshot.classResults || snapshot.publicSequence?.classes || [];
    ceremonyData.studentQueue = snapshot.studentResultsPrivate || snapshot.publicSequence?.students || [];
    ceremonyData.growthSpotlights = snapshot.spotlights || snapshot.publicSequence?.parade || [];
    ceremonyData.growthGardenClasses = snapshot.publicSequence?.garden || [];
    ceremonyData.growthPathfinderId = ceremonyData.growthGardenClasses.find((item) => item.isPathfinder)?.id || snapshot.classWinner?.id || null;
    ceremonyData.growthStudents = (snapshot.publicSequence?.parade || snapshot.spotlights || []).map((card) => ({ id: card.studentId, name: card.studentName }));
    ceremonyData.growthWinners = snapshot.prodigyWinners || [];
    ceremonyData.risingStar = ceremonyData.mode === 'growth_festival' ? null : (snapshot.publicSequence?.risingStar || null);
    if (ceremonyData.risingStar) import('./ceremonyRisingStar.js').catch(quietly('features/ceremony.js'));
    ceremonyData.classPointer = 0;
    ceremonyData.studentPointer = 0;
    ceremonyData.growthPointer = 0;
    ceremonyData.phase = replay ? (ceremonyData.mode === 'growth_festival' ? 'growth_garden' : 'class_reveal') : (snapshot.playback?.phase || (ceremonyData.mode === 'growth_festival' ? 'growth_garden' : 'class_reveal'));
    if (!replay) {
        const index = Math.max(0, Number(snapshot.playback?.index) || 0);
        if (ceremonyData.phase === 'growth_parade') ceremonyData.growthPointer = index;
        if (ceremonyData.phase === 'student_reveal') ceremonyData.studentPointer = index;
        if (ceremonyData.phase === 'class_reveal') ceremonyData.classPointer = index;
    }
    if (ceremonyData.mode !== 'growth_festival') ceremonyData.studentQueue = ceremonyData.studentQueue.map((item) => ({ ...item, stats: item.stats || {} }));
}

async function persistPreparedCeremonySnapshot() {
    try {
        const classData = state.get('allSchoolClasses').find((item) => item.id === ceremonyData.classId) || {};
        const snapshot = await prepareCeremonySnapshot({
            classId: ceremonyData.classId,
            className: ceremonyData.className,
            classLogo: classData.logo || '📚',
            questLeague: ceremonyData.league,
            monthKey: ceremonyData.monthKey,
            schoolYearKey: state.getActiveSchoolYearKey(),
            classResults: ceremonyData.mode === 'growth_festival' ? (ceremonyData.growthGardenClasses || []) : (ceremonyData.classQueue || []),
            studentResults: ceremonyData.mode === 'growth_festival'
                ? (ceremonyData.growthCanonicalStudentResults || [])
                : (ceremonyData.studentQueue || []).map((item) => ({ ...item, count3: item.stats?.count3 ?? 0, count2: item.stats?.count2 ?? 0, uniqueReasons: item.stats?.uniqueReasons ?? 0, academicAvg: item.stats?.academicAvg ?? 0 })),
            students: ceremonyData.growthStudents || [],
            // The bloom stories already worked out from the month (a resumed ceremony shows the same).
            spotlights: ceremonyData.mode === 'growth_festival' ? (ceremonyData.growthSpotlights || []) : undefined,
            risingStar: ceremonyData.mode === 'growth_festival' ? null : (ceremonyData.risingStar || null),
            spotlightOptions: {},
            snapshotVersion: 1
        });
        ceremonyData.snapshot = await lockCeremonySnapshot(ceremonyData.classId, ceremonyData.monthKey);
        return snapshot;
    } catch (error) {
        console.warn('Ceremony snapshot persistence unavailable; continuing with in-memory ceremony.', error);
        return null;
    }
}

function persistCeremonyPlayback() {
    if (!ceremonyData.snapshot || !['locked', 'completed'].includes(ceremonyData.snapshot.status)) return;
    const phase = ceremonyData.phase;
    const index = phase === 'growth_parade' ? ceremonyData.growthPointer
        : phase === 'student_reveal' ? ceremonyData.studentPointer
            : phase === 'class_reveal' ? ceremonyData.classPointer : 0;
    void saveCeremonyPlayback(ceremonyData.classId, ceremonyData.monthKey, { phase, index: Number(index) || 0 }).catch(quietly('features/ceremony.js'));
}

async function loadGrowthCeremonyData() {
    const [year, month] = ceremonyData.monthKey.split('-').map(Number);
    // As in the arena: an unreadable month must not be locked into the snapshot.
    const logs = await fetchLogsForMonth(year, month, { throwOnError: true });
    if (!logs.length && !ceremonyData.replay) throw new Error('The month read as empty; not locking the ceremony.');
    ceremonyData.monthLogs = logs;
    const previousDate = new Date(year, month - 2, 1);
    const previousLogs = await fetchLogsForMonth(previousDate.getFullYear(), previousDate.getMonth() + 1).catch(() => []);
    const students = (state.get('allStudents') || []).filter((student) => student.classId === ceremonyData.classId && student.enrollmentStatus !== 'inactive');
    const classData = (state.get('allSchoolClasses') || []).find((item) => item.id === ceremonyData.classId) || {};
    const attendance = state.get('allAttendanceRecords') || [];
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
    const lessonDates = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
        const dateKey = `${ceremonyData.monthKey}-${String(day).padStart(2, '0')}`;
        if (utils.doesClassMeetOnDate(ceremonyData.classId, dateKey, state.get('allSchoolClasses') || [], state.get('allScheduleOverrides') || [], state.get('schoolHolidayRanges') || [], classEndDates)) lessonDates.push(dateKey);
    }
    const allLearners = state.get('allStudents') || [];
    const currentLogsByStudent = Object.fromEntries(students.map((student) => [student.id, logs.filter((log) => log.studentId === student.id)]));
    const currentLogsByLearner = Object.fromEntries(allLearners.map((student) => [student.id, logs.filter((log) => log.studentId === student.id)]));
    const options = Object.fromEntries(students.map((student) => {
        const absentDates = new Set(attendance.filter((record) => record.studentId === student.id && record.classId === ceremonyData.classId && record.status === 'absent').map((record) => record.date));
        return [student.id, { currentLogs: currentLogsByStudent[student.id], previousLogs: previousLogs.filter((log) => log.studentId === student.id), attendedLessons: lessonDates.filter((dateKey) => !absentDates.has(dateKey)) }];
    }));
    const monthCredits = Object.fromEntries(allLearners.map((student) => [student.id, (currentLogsByLearner[student.id] || []).reduce((sum, log) => sum + getAwardLogMonthlyStarCredit(log), 0)]));
    const allClasses = (state.get('allSchoolClasses') || []).filter((item) => item.questLevel === ceremonyData.league && existedByMonthEnd(item, ceremonyData.monthKey));
    const ranges = state.get('schoolHolidayRanges') || [];
    const overrides = state.get('allScheduleOverrides') || [];
    const classSummaries = allClasses.map((item) => {
        const classStudents = (state.get('allStudents') || []).filter((student) => student.classId === item.id && existedByMonthEnd(student, ceremonyData.monthKey));
        const score = classStudents.reduce((sum, student) => sum + (monthCredits[student.id] || 0), 0);
        const goal = utils.calculateMonthlyClassGoalForDate(item, classStudents.length, ranges, overrides, new Date(year, month - 1, 1), []);
        const progress = goal > 0 ? Math.round((score / goal) * 100) : 0;
        const reasonTotals = {};
        classStudents.forEach((student) => (currentLogsByLearner[student.id] || []).forEach((log) => {
            if (!['teamwork', 'creativity', 'respect', 'focus'].includes(log.reason)) return;
            reasonTotals[log.reason] = (reasonTotals[log.reason] || 0) + getAwardLogMonthlyStarCredit(log);
        }));
        const topSkill = Object.entries(reasonTotals).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || null;
        return {
            id: item.id,
            name: item.name || 'Our class',
            className: item.name || 'Our class',
            logo: item.logo || '📚',
            topSkill,
            progressLabel: progress >= 100 ? 'Blooming brightly' : progress >= 60 ? 'Growing steadily' : 'Finding its way',
            mapZone: getQuestMapZoneForProgressPercent(progress),
            score
        };
    });
    const canonicalClass = [...classSummaries].sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)))[0] || null;
    ceremonyData.growthGardenClasses = seededShuffle(classSummaries, `${ceremonyData.classId}:${ceremonyData.monthKey}:garden`);
    ceremonyData.growthPathfinderId = canonicalClass?.id || null;
    ceremonyData.growthStudents = students;
    ceremonyData.growthSpotlights = buildGrowthSpotlights(students, options, { classId: ceremonyData.classId, monthKey: ceremonyData.monthKey, snapshotVersion: 1 });
    ceremonyData.growthPointer = 0;
    ceremonyData.growthCanonicalStudentResults = students.map((student) => {
        const logsForStudent = currentLogsByStudent[student.id] || [];
        const positiveCore = logsForStudent.filter((log) => !['special_quest', 'welcome_back', 'absence'].includes(log.reason) && getAwardLogMonthlyStarCredit(log) > 0);
        const reasons = new Set(positiveCore.map((log) => log.reason).filter(Boolean));
        return {
            id: student.id,
            name: student.name,
            avatar: student.avatar,
            score: monthCredits[student.id] || 0,
            count3: positiveCore.filter((log) => getAwardLogMonthlyStarCredit(log) >= 3).length,
            count2: positiveCore.filter((log) => getAwardLogMonthlyStarCredit(log) >= 2 && getAwardLogMonthlyStarCredit(log) < 3).length,
            uniqueReasons: reasons.size,
            academicAvg: 0
        };
    });
    const canonicalStudents = chooseCanonicalWinners({ studentResults: ceremonyData.growthCanonicalStudentResults });
    ceremonyData.growthWinners = canonicalStudents.prodigyWinners.map((winner) => students.find((student) => student.id === winner.id)).filter(Boolean);
    ceremonyData.phase = 'growth_garden';
}

// ============================================================== SHELL

const $ = (id) => document.getElementById(id);
let ceremonyFx = null;
let timeline = null;
let frozenAnimations = [];

function screenEl() {
    return $('ceremony-screen');
}

function freezeAppBackdrop(screen) {
    if (frozenAnimations.length || typeof document.getAnimations !== 'function') return;
    frozenAnimations = document.getAnimations().filter((animation) => {
        if (animation.playState !== 'running') return false;
        if (animation.effect?.getTiming?.().iterations !== Infinity) return false;
        const target = animation.effect?.target;
        return Boolean(target) && !screen.contains(target);
    });
    frozenAnimations.forEach((animation) => animation.pause());
}

function resumeAppBackdrop() {
    const frozen = frozenAnimations;
    frozenAnimations = [];
    frozen.forEach((animation) => {
        if (animation.playState === 'paused') animation.play();
    });
}

function mountShell(mode) {
    const screen = screenEl();
    const backdrop = $('ceremony-backdrop');
    screen.dataset.mode = mode;
    if (backdrop && backdrop.dataset.mode !== mode) {
        backdrop.innerHTML = mode === 'garden' ? gardenBackdropHtml() : arenaBackdropHtml();
        backdrop.dataset.mode = mode;
    }
    const bedRow = document.getElementById('gdn-bed-row');
    if (bedRow) bedRow.innerHTML = '';
    const ladder = $('ceremony-ladder');
    if (ladder) ladder.innerHTML = '';
    screen.dataset.ladder = 'off';
    const host = $('ceremony-fx-host');
    if (host && !ceremonyFx) ceremonyFx = createCeremonyFx(host);
    else ceremonyFx?.resize();
    // Lite machines keep the scenery still; only the reveals move.
    screen.dataset.tier = ceremonyFx?.tier || 'lite';
}

function setScene(scene, { realm } = {}) {
    const screen = screenEl();
    if (!screen) return;
    screen.dataset.scene = scene;
    if (realm) screen.dataset.realm = realm;
    screen.classList.remove('is-drumroll', 'is-revealed');
    delete screen.dataset.spot;
}

function replay(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
}

function setHeading(kicker = '', title = '') {
    const kickerEl = $('ceremony-subtitle');
    const titleEl = $('ceremony-title');
    if (kickerEl) kickerEl.textContent = kicker;
    if (titleEl) titleEl.textContent = title;
    const header = $('ceremony-header');
    if (header) {
        header.classList.toggle('is-empty', !kicker && !title);
        replay(header, 'is-fresh');
    }
}

function setHerald(text = '') {
    const box = $('ceremony-ai-box');
    const p = $('ceremony-ai-text');
    if (!box || !p) return;
    p.textContent = text;
    box.classList.toggle('is-on', Boolean(text));
    if (text) replay(box, 'is-fresh');
}

function setAction(label, handler, { disabled = false } = {}) {
    const btn = $('ceremony-action-btn');
    if (!btn) return;
    const labelEl = btn.querySelector('.cer-action__label');
    if (labelEl) labelEl.textContent = label;
    btn.disabled = disabled;
    btn.onclick = () => {
        if (pressTooSoon()) return;
        if (finishTimeline()) return;
        handler?.();
    };
    replay(btn, 'is-fresh');
}

// A timeline is a set of steps at fixed offsets. Pressing Next (or Space)
// while one runs fast-forwards it: every remaining step runs at once with
// `fast = true`, so a teacher is never stuck waiting for an animation.
function runTimeline(steps, onDone) {
    cancelTimeline();
    const tl = { steps: steps.map((step) => ({ ...step, done: false })), timers: [], onDone, startedAt: Date.now() };
    timeline = tl;
    const settle = () => {
        if (tl.steps.every((step) => step.done)) {
            if (timeline === tl) timeline = null;
            tl.onDone?.();
        }
    };
    tl.steps.forEach((step) => {
        tl.timers.push(setTimeout(() => {
            if (timeline !== tl || step.done) return;
            step.done = true;
            step.run(false);
            settle();
        }, step.at));
    });
    if (!tl.steps.length) settle();
}

// A quick double press (or a held Space) must not skip the moment it just opened:
// presses that land right after the last one, or right as a timeline begins, are ignored.
let lastPressAt = 0;
function pressTooSoon() {
    const now = Date.now();
    const tooSoon = now - lastPressAt < 350 || (timeline && now - timeline.startedAt < 650);
    if (!tooSoon) lastPressAt = now;
    return tooSoon;
}

function finishTimeline() {
    const tl = timeline;
    if (!tl) return false;
    timeline = null;
    tl.timers.forEach(clearTimeout);
    const screen = screenEl();
    screen?.classList.add('is-skipping');
    tl.steps.filter((step) => !step.done).forEach((step) => {
        step.done = true;
        step.run(true);
    });
    tl.onDone?.();
    requestAnimationFrame(() => requestAnimationFrame(() => screen?.classList.remove('is-skipping')));
    return true;
}

function cancelTimeline() {
    if (!timeline) return;
    timeline.timers.forEach(clearTimeout);
    timeline = null;
}

function countUp(el, to, { fast = false, duration = 900, tally = false } = {}) {
    if (!el) return;
    const target = Number(to) || 0;
    if (fast || target <= 0 || typeof requestAnimationFrame !== 'function') {
        el.textContent = String(target);
        return;
    }
    if (tally) playCeremonyTally({ seconds: duration / 1000, steps: Math.min(12, Math.max(3, Math.round(target / 6))) });
    const start = performance.now();
    const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = String(t < 1 ? Math.round(target * eased) : target);
        if (t < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

function fxPoint(el) {
    return ceremonyFx?.pointOf(el) || { x: 0, y: 0 };
}

const METAL_SPARKS = {
    gold: ['#fde68a', '#fbbf24', '#ffffff'],
    silver: ['#e2e8f0', '#cbd5e1', '#ffffff'],
    bronze: ['#fdba74', '#f59e0b', '#ffffff'],
    steel: ['#c7d2fe', '#a5b4fc', '#ffffff']
};

/** Animate elements from their old box to their new box (transform only). */
function flipLayout(elements, mutate, { fast = false, duration = 950 } = {}) {
    const first = new Map(elements.map((el) => [el, el.getBoundingClientRect()]));
    mutate();
    if (fast || typeof Element.prototype.animate !== 'function') return;
    elements.forEach((el) => {
        const a = first.get(el);
        const b = el.getBoundingClientRect();
        if (!a || !b.width) return;
        const dx = a.left - b.left;
        const dy = a.top - b.top;
        const s = a.width / b.width;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.01) return;
        el.style.transformOrigin = '0 0';
        const anim = el.animate([
            { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
            { transform: 'translate(0, 0) scale(1)' }
        ], { duration, easing: 'cubic-bezier(.2,.85,.25,1)' });
        anim.onfinish = () => { el.style.transformOrigin = ''; };
    });
}

// ============================================================== START / CLOSE

function handleCeremonyKeys(e) {
    if (!ceremonyData.active) return;
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.repeat) return;
        const btn = $('ceremony-action-btn');
        if (btn && !btn.disabled) btn.click();
        else if (!pressTooSoon()) finishTimeline();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCeremony();
    }
}

export function startCeremony(params) {
    const modeResult = resolveCeremonyMode(params.league);
    if (!modeResult.ok) {
        if (typeof document !== 'undefined') showToast(modeResult.reason, 'warning');
        return false;
    }
    const allClasses = state.get('allSchoolClasses') || [];
    const classData = allClasses.find((item) => item.id === params.classId) || {};
    ceremonyData = {
        active: true,
        phase: 'intro',
        monthKey: params.monthKey,
        currentAppClassId: state.get('globalSelectedClassId'),
        monthName: params.monthName,
        classId: params.classId,
        className: params.className || classData.name || 'Our Class',
        classLogo: classData.logo || '📚',
        league: params.league,
        mode: modeResult.mode,
        snapshot: params.snapshot || null,
        replay: Boolean(params.replay),
        classQueue: [],
        studentQueue: [],
        classPointer: 0,
        studentPointer: 0,
        growthPointer: 0,
        gardenPlanted: new Set()
    };

    const screen = screenEl();
    if (!screen) return false;
    const isGarden = modeResult.mode === 'growth_festival';
    screen.classList.remove('hidden', 'is-closing');
    document.documentElement.classList.add('cer-open');
    mountShell(isGarden ? 'garden' : 'arena');
    freezeAppBackdrop(screen);
    requestAnimationFrame(() => screen.classList.add('is-open'));

    const closeBtn = $('ceremony-close-btn');
    const soundBtn = $('ceremony-sound-btn');
    const soundIcon = $('ceremony-sound-icon');
    const crumb = $('ceremony-crumb');
    if (crumb) crumb.textContent = `${ceremonyData.monthName} · ${ceremonyData.className}`;
    if (closeBtn) closeBtn.onclick = closeCeremony;
    const paintSound = () => {
        const off = isCeremonyAudioMuted();
        if (soundIcon) soundIcon.className = off ? 'fas fa-volume-xmark' : 'fas fa-volume-high';
        soundBtn?.setAttribute('aria-pressed', off ? 'true' : 'false');
    };
    if (soundBtn) {
        soundBtn.onclick = () => {
            toggleCeremonyAudioMute();
            paintSound();
            if (!isCeremonyAudioMuted()) playCeremonyTrack(ceremonyData.music || (isGarden ? 'garden_theme' : 'arena_theme'));
        };
    }
    paintSound();

    window.removeEventListener('keydown', handleCeremonyKeys);
    window.addEventListener('keydown', handleCeremonyKeys);

    ceremonyData.music = isGarden ? 'garden_theme' : 'arena_theme';
    prepareCeremonyAudio(isGarden ? 'garden' : 'arena').then(() => {
        if (!ceremonyData.active) return;
        playCeremonyTrack(ceremonyData.music);
        playCeremonySfx(isGarden ? 'chime' : 'boom');
    });

    const stage = $('ceremony-stage-area');
    if (isGarden) {
        setScene('gate', { realm: 'day' });
        stage.innerHTML = gardenIntroHtml({ monthName: ceremonyData.monthName, className: ceremonyData.className, classLogo: ceremonyData.classLogo });
        setHeading('', '');
        setHerald('Welcome to the garden! Every bloom has a story…');
        setAction('Enter the Garden 🌸', openGardenGate);
    } else {
        setScene('intro', { realm: 'ember' });
        stage.innerHTML = arenaIntroHtml({ monthName: ceremonyData.monthName, league: ceremonyData.league, className: ceremonyData.className, classLogo: ceremonyData.classLogo });
        setHeading('', '');
        setHerald('The scrolls are sealed. The arena awaits…');
        setAction('Start Ceremony', () => loadDataAndAdvance());
        ceremonyFx?.embers({ count: 26, duration: 4000 });
    }
    triggerAICommentary('intro', { month: params.monthName });
    return true;
}

function closeCeremony() {
    ceremonyData.active = false;
    import('./familiarParade.js').then((m) => m.stopFamiliarParade()).catch(quietly('features/ceremony.js'));
    if (screenEl()) delete screenEl().dataset.parade;
    cancelTimeline();
    window.removeEventListener('keydown', handleCeremonyKeys);
    stopCeremonyAudio({ fade: 0.6 });
    ceremonyFx?.clear();
    const screen = screenEl();
    if (screen) {
        screen.classList.remove('is-open');
        screen.classList.add('hidden');
    }
    document.documentElement.classList.remove('cer-open');
    resumeAppBackdrop();
    import('../features/home.js').then((m) => m.renderHomeTab());
}

function showLoadError() {
    setHerald('The scrolls could not be read. Check the connection and try again.');
    setAction('Try again', () => loadDataAndAdvance());
}

// ============================================================== CLASSIC ARENA

function getLadder() {
    return $('ceremony-ladder');
}

function ladderReset(type, upTo = 0) {
    const ladder = getLadder();
    const screen = screenEl();
    if (!ladder || !screen) return;
    ladder.innerHTML = '';
    ladder.dataset.type = type;
    screen.dataset.ladder = 'on';
    const queue = type === 'student' ? ceremonyData.studentQueue : ceremonyData.classQueue;
    // A big class: slimmer tokens, and the newest one always in view.
    ladder.dataset.dense = queue.length > 9 ? 'on' : 'off';
    queue.slice(0, upTo).forEach((entry) => ladder.insertAdjacentHTML('beforeend', arenaLadderTokenHtml(entry, type)));
    ladder.scrollTop = ladder.scrollHeight;
}

function ladderAdd(entry, type) {
    const ladder = getLadder();
    if (!ladder) return;
    ladder.insertAdjacentHTML('beforeend', arenaLadderTokenHtml(entry, type));
    const token = ladder.lastElementChild;
    token?.classList.add('is-new');
    ladder.dataset.overflow = ladder.scrollHeight > ladder.clientHeight + 2 ? 'on' : 'off';
    if (typeof ladder.scrollTo === 'function') ladder.scrollTo({ top: ladder.scrollHeight, behavior: 'smooth' });
    else ladder.scrollTop = ladder.scrollHeight;
}

function ladderOff() {
    const screen = screenEl();
    if (screen) screen.dataset.ladder = 'off';
}

/** Herald banner drops, the wax seal cracks, the card flips, stars count up. */
function revealRank(entry, type) {
    const stage = $('ceremony-stage-area');
    const isMyClass = type === 'class' && entry.id === ceremonyData.currentAppClassId;
    stage.innerHTML = arenaRevealHtml(entry, type, { isMyClass });
    const reveal = stage.querySelector('.cer-reveal');
    const card = reveal.querySelector('.cer-card');
    const metal = reveal.dataset.metal;
    const screen = screenEl();
    runTimeline([
        { at: 30, run: (fast) => { reveal.classList.add('is-dropping'); if (!fast) playCeremonySfx('drop'); } },
        { at: 720, run: (fast) => { reveal.classList.add('is-breaking'); if (!fast) playCeremonySfx('crack'); } },
        { at: 1080, run: (fast) => {
            reveal.classList.remove('is-sealed');
            reveal.classList.add('is-open');
            if (!fast) {
                playCeremonySfx(entry.rank <= 3 ? 'reveal' : 'chime');
                const p = fxPoint(card);
                ceremonyFx?.burst(p.x, p.y, { colors: METAL_SPARKS[metal] || METAL_SPARKS.steel, count: entry.rank <= 3 ? 90 : 50, speed: 300 });
                replay(screen, 'is-cheering');
            }
            countUp(card.querySelector('.cer-count'), entry.score, { fast, tally: true });
        } },
        { at: 1650, run: (fast) => {
            reveal.classList.add('is-settled');
            ladderAdd(entry, type);
            // A class that stepped through the Portal this month: its rank-up mark lands.
            const mark = card.querySelector('.cer-chip--rankup');
            if (mark && !fast) {
                playCeremonySfx('stamp');
                const p = fxPoint(mark);
                ceremonyFx?.burst(p.x, p.y, { colors: ['#fef3c7', '#a5f3fc', '#c4b5fd'], count: 28, speed: 160 });
            }
        } }
    ]);
}

function setupDuel(silver, gold, type) {
    const stage = $('ceremony-stage-area');
    const flip = seededHash(`${ceremonyData.monthKey}:${ceremonyData.classId}:${type}`) % 2 === 1;
    const left = flip ? gold : silver;
    const right = flip ? silver : gold;
    const queue = type === 'student' ? ceremonyData.studentQueue : ceremonyData.classQueue;
    const bronze = queue.length >= 3 && queue[queue.length - 3]?.rank === 3 ? queue[queue.length - 3] : null;
    ceremonyData.duel = { type, bronze };
    setScene('duel');
    stage.innerHTML = arenaDuelHtml(left, right, type, { myClassId: ceremonyData.currentAppClassId });
    setHeading(type === 'student' ? "Hero's Challenge" : 'Team Quest', 'The Final Duel');
    setHerald('');
    triggerAICommentary('showdown_build', { name1: left.name, name2: right.name });
    playCeremonyTrack('duel');
    playCeremonySfx('boom');
    const duel = stage.querySelector('.cer-duel');
    requestAnimationFrame(() => duel?.classList.add('is-in'));
}

function unveilDuelist(duelist, fast) {
    const rank = Number(duelist.dataset.rank);
    const metal = rank === 1 ? 'gold' : 'silver';
    const card = duelist.querySelector('.cer-card');
    card?.classList.remove('cer-metal--mystery');
    card?.classList.add(`cer-metal--${metal}`);
    const plate = card?.querySelector('.cer-card__plate');
    if (plate) plate.innerHTML = `<span>${rank === 1 ? 'Gold' : 'Silver'}</span><b>#${rank}</b>`;
    card?.querySelector('.cer-card__score')?.classList.remove('is-veiled');
    countUp(card?.querySelector('.cer-count'), card?.querySelector('.cer-count')?.dataset.count, { fast });
    duelist.classList.add(rank === 1 ? 'is-winner' : 'is-runnerup');
    if (rank === 1) card?.classList.add('is-crowned');
}

function handleDuelReveal() {
    const stage = $('ceremony-stage-area');
    const screen = screenEl();
    const duel = stage.querySelector('.cer-duel');
    if (!duel) return advanceCeremony();
    const left = duel.querySelector('.cer-duelist--left');
    const right = duel.querySelector('.cer-duelist--right');
    const rankL = Number(left?.dataset.rank);
    const rankR = Number(right?.dataset.rank);
    const isTie = rankL === 1 && rankR === 1;
    const winnerSide = isTie ? 'both' : (rankL === 1 ? 'l' : 'r');
    const type = ceremonyData.duel?.type || 'class';
    const countEl = duel.querySelector('.cer-vs__count');
    const labelEl = duel.querySelector('.cer-vs__label');
    const finishedClassShowdown = ceremonyData.phase === 'class_showdown';

    setAction('Revealing…', null);
    screen.classList.add('is-drumroll');
    duel.classList.add('is-tense');
    if (labelEl) labelEl.textContent = 'Get ready…';
    stopCeremonyMusic({ fade: 0.4 });
    startCeremonyDrumroll(2.9);

    const sweeps = [0, 470, 880, 1240, 1550, 1810, 2030, 2210, 2360, 2480, 2580, 2670, 2750];
    const steps = sweeps.map((at, i) => ({ at, run: (fast) => {
        if (fast) return;
        screen.dataset.spot = i % 2 ? 'r' : 'l';
        if (i % 2 === 0) playCeremonySfx('tick');
    } }));
    [3, 2, 1].forEach((n, i) => steps.push({ at: 650 + i * 760, run: (fast) => {
        if (fast) return;
        if (countEl) countEl.textContent = String(n);
        if (labelEl) labelEl.textContent = 'Revealing…';
        replay(duel.querySelector('.cer-vs'), 'is-tick');
        playCeremonySfx('heartbeat');
    } }));
    steps.push({ at: 2950, run: (fast) => {
        stopCeremonyDrumroll({ crash: !fast });
        screen.dataset.spot = winnerSide;
        screen.classList.remove('is-drumroll');
        screen.classList.add('is-revealed');
        duel.classList.remove('is-tense');
        duel.classList.add('is-revealed');
        if (!fast) replay(screen, 'is-flashing');
        [left, right].forEach((d) => d && unveilDuelist(d, fast));
        const winners = [left, right].filter((d) => Number(d?.dataset.rank) === 1);
        const names = winners.map((d) => d.querySelector('.cer-card__name')?.textContent || '');
        if (isTie) {
            setHeading(type === 'student' ? 'Co-Prodigies' : "It's a draw", type === 'student' ? 'Two crowns tonight!' : 'Shared Champions!');
            triggerAICommentary('tie', { names: names.join(' & ') });
        } else {
            setHeading(type === 'student' ? `${ceremonyData.monthName} · ${ceremonyData.className}` : `League ${ceremonyData.league}`, type === 'student' ? 'Prodigy of the Month' : 'Champion of the League');
            const winner = winners[0];
            triggerAICommentary(finishedClassShowdown ? 'class_winner' : 'student_winner', { id: winner?.dataset.id, name: names[0] });
        }
        if (!fast) {
            playCeremonyTrack('victory');
            playCeremonySfx('gold');
            winners.forEach((d) => {
                const p = fxPoint(d.querySelector('.cer-card'));
                ceremonyFx?.burst(p.x, p.y, { colors: METAL_SPARKS.gold, count: 140, speed: 380, ring: true });
            });
            ceremonyFx?.fireworks({ count: 7, spread: 2600 });
            ceremonyFx?.confetti({ count: 160, duration: 1400 });
            replay(screen, 'is-cheering');
        }
        ceremonyData.phase = finishedClassShowdown ? 'class_showdown_done' : 'student_showdown_done';
    } });
    steps.push({ at: 5600, run: (fast) => {
        const bronze = isTie ? null : ceremonyData.duel?.bronze;
        const duelists = [left, right].filter(Boolean);
        flipLayout(duelists, () => {
            duel.classList.add('is-podium');
            if (isTie) duel.classList.add('is-tie');
            duelists.forEach((d) => { d.dataset.place = String(Number(d.dataset.rank) === 1 ? (isTie && d === right ? '1b' : '1') : '2'); });
        }, { fast });
        if (bronze) {
            duel.insertAdjacentHTML('beforeend', `<div class="cer-duelist cer-duelist--bronze is-runnerup" data-place="3" data-rank="3">
                <div class="cer-pedestal" aria-hidden="true"><span></span></div>
                ${arenaCardFaceHtml(bronze, type, { metal: 'bronze', isMyClass: type === 'class' && bronze.id === ceremonyData.currentAppClassId })}
            </div>`);
            const bronzeCard = duel.querySelector('.cer-duelist--bronze .cer-card');
            if (!fast) playCeremonySfx('reveal');
            countUp(bronzeCard?.querySelector('.cer-count'), bronze.score, { fast });
        } else {
            duel.classList.add('is-duo');
        }
        delete screen.dataset.spot;
    } });
    runTimeline(steps, () => {
        setAction(finishedClassShowdown ? afterTeamQuestLabel() : afterHeroesLabel(), advanceCeremony);
    });
}

function renderTransition() {
    const stage = $('ceremony-stage-area');
    ladderOff();
    setScene('transition', { realm: 'violet' });
    stage.innerHTML = arenaTransitionHtml();
    setHeading('Individual Honours', 'Who went above and beyond?');
    setHerald('');
    triggerAICommentary('transition', {});
    stopCeremonyOneShots({ fade: 1.2 });
    ceremonyData.music = 'heroes_theme';
    playCeremonyTrack('heroes_theme', { fade: 1.6 });
    playCeremonySfx('whoosh');
    ceremonyFx?.stars({ count: 40, colors: ['#ddd6fe', '#c4b5fd', '#fef3c7'], duration: 2400 });
}

async function renderRisingStar() {
    const star = ceremonyData.risingStar;
    const stage = $('ceremony-stage-area');
    if (!star || !stage) return;
    let view;
    try { view = await import('./ceremonyRisingStar.js'); } catch (error) { console.warn('Rising Star view unavailable:', error); return; }
    if (!ceremonyData.active) return;
    ladderOff();
    setScene('rising', { realm: 'violet' });
    stage.innerHTML = view.risingStarHtml(star, { monthName: ceremonyData.monthName });
    setHeading(`${ceremonyData.monthName} · ${ceremonyData.className}`, 'Rising Star');
    setHerald('');
    triggerAICommentary('rising_star', { name: star.name, gain: star.gain, starfalls: star.starfalls });
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    playCeremonySfx('whoosh');
    await new Promise((resolve) => {
        runTimeline([
            { at: 900, run: (fast) => {
                const card = stage.querySelector('.cer-rise__card');
                stage.querySelector('.cer-rise')?.classList.add('is-landed');
                if (fast || reduced) return;
                playCeremonySfx('reveal');
                const p = fxPoint(card);
                ceremonyFx?.burst(p.x, p.y, { colors: ['#fef3c7', '#fde68a', '#c4b5fd', '#a5f3fc'], count: 110, speed: 320, ring: true });
            } },
            { at: 1500, run: (fast) => {
                countUp(stage.querySelector('.cer-rise__gain .cer-count'), star.gain, { fast });
                if (!fast && !reduced) {
                    playCeremonySfx('gold');
                    ceremonyFx?.stars({ count: 36, colors: ['#fef3c7', '#c4b5fd', '#a5f3fc'], duration: 2200 });
                }
            } }
        ], resolve);
    });
}

// ---------------------------------------------------------------- THE PORTAL ASCENT

let ascentView = null;

function hasMoments() {
    return Boolean(ceremonyData.moments?.length);
}

function hasHonours() {
    return Boolean(ceremonyData.honours?.sections?.length);
}

function afterTeamQuestPhase() {
    if (ceremonyData.ascent) return 'class_ascent';
    return hasMoments() ? 'class_moments' : 'transition';
}

function afterTeamQuestLabel() {
    if (ceremonyData.ascent) return ceremonyData.ascent.crossed ? 'Our New Quest Rank ✦' : 'Our Next Quest';
    if (hasMoments()) return `The Chronicle of ${ceremonyData.monthName} 📜`;
    return "On to the Hero's Challenge";
}

/** After the hero duel (or a lone hero): the Rising Star, the Honours, then the standings. */
function afterHeroesPhase() {
    if (ceremonyData.risingStar) return 'rising_star';
    return hasHonours() ? 'honours' : 'final_leaderboard';
}

function afterHeroesLabel() {
    if (ceremonyData.risingStar) return 'One more star rises…';
    return hasHonours() ? 'Honours of the Month ✦' : 'Show Final Standings';
}

/**
 * The watching class's quest rank: the old crest bursts into the new one when it stepped
 * through the Portal (or the road it walked when it did not), then next month's quest.
 * `nextLabel` is the button that follows (the phase is already set by the caller).
 */
async function renderAscent(nextLabel) {
    const ascent = ceremonyData.ascent;
    const stage = $('ceremony-stage-area');
    const garden = ceremonyData.mode === 'growth_festival';
    if (!ascent || !stage) { advanceCeremony(); return; }
    setAction('Opening the Portal…', null, { disabled: true });
    try { ascentView = ascentView || await import('./ceremonyAscent.js'); } catch (error) { console.warn('Portal Ascent view unavailable:', error); advanceCeremony(); return; }
    if (!ceremonyData.active) return;
    ladderOff();
    silenceAICommentary();
    setScene('ascent', { realm: garden ? 'day' : 'violet' });
    stage.innerHTML = ascentView.questAscentHtml(ascent, { className: ceremonyData.className, classLogo: ceremonyData.classLogo, garden });
    setHeading('', '');
    setHerald('');
    setAction(nextLabel, advanceCeremony);
    const box = stage.querySelector('.cer-asc');
    const screen = screenEl();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const [light, mid] = ascent.rank.colors;
    const crestPoint = () => fxPoint(box.querySelector('.cer-asc__emblem'));
    stopCeremonyOneShots({ fade: 0.8 });
    const questStep = (at) => ({ at, run: (fast) => {
        box.classList.add('is-quest');
        const count = box.querySelector('.cer-asc__goal .cer-count');
        if (count) count.textContent = '0';
        countUp(count, ascent.nextGoal, { fast, duration: 1100, tally: true });
        if (fast) return;
        duckCeremonyMusic(false);
        playCeremonySfx('quest_horn');
    } });
    if (ascent.crossed) {
        runTimeline([
            { at: 120, run: (fast) => {
                box.classList.add('is-open');
                if (fast) return;
                playCeremonySfx('portal_open');
                if (!reduced) ceremonyFx?.stars({ count: 30, colors: [light, '#a5f3fc', '#ffffff'], duration: 1800 });
            } },
            { at: 1050, run: (fast) => {
                if (fast) return;
                box.classList.add('is-charging');
                duckCeremonyMusic(true);
                playCeremonySfx('charge');
            } },
            { at: 2200, run: (fast) => {
                box.classList.remove('is-charging');
                box.classList.add('is-ascended');
                setHerald(ascent.line);
                if (fast) return;
                playCeremonySfx('rankup');
                playCeremonyTrack(garden ? 'garden_theme' : 'victory', { fade: 1.2 });
                const p = crestPoint();
                ceremonyFx?.burst(p.x, p.y, { colors: [light, mid, '#ffffff', '#fde68a'], count: reduced ? 40 : 150, speed: 380, ring: true });
                if (garden) ceremonyFx?.petals({ count: 40, duration: 2400 });
                else if (!reduced) ceremonyFx?.fireworks({ count: 5, spread: 2200 });
                replay(screen, 'is-flashing');
                replay(screen, 'is-cheering');
            } },
            { at: 2750, run: (fast) => {
                box.classList.add('is-stamped');
                if (!fast) playCeremonySfx('stamp');
            } },
            questStep(4000)
        ]);
    } else {
        if (!garden) playCeremonyTrack('arena_theme', { fade: 1.2 });
        runTimeline([
            { at: 120, run: (fast) => {
                box.classList.add('is-open');
                if (!fast) playCeremonySfx('road');
            } },
            { at: 600, run: (fast) => {
                box.classList.add('is-filled');
                if (!fast && ascent.progress > 0) playCeremonyTally({ seconds: 1.3, steps: Math.max(3, Math.round(ascent.progress / 9)) });
            } },
            { at: 2100, run: (fast) => {
                setHerald(ascent.line);
                if (!fast && !reduced) {
                    const p = crestPoint();
                    ceremonyFx?.burst(p.x, p.y, { colors: [light, mid, '#ffffff'], count: 50, speed: 220 });
                }
            } },
            questStep(2300)
        ]);
    }
}

// ---------------------------------------------------------------- THE CHRONICLE AND THE HONOURS

let momentsView = null;

async function loadMomentsView() {
    momentsView = momentsView || await import('./ceremonyMoments.js');
    return momentsView;
}

/** The class's month across the newer quests: a scroll unrolls, then each moment is stamped in. */
async function renderMoments(nextLabel) {
    const stage = $('ceremony-stage-area');
    const garden = ceremonyData.mode === 'growth_festival';
    const tiles = ceremonyData.moments || [];
    setAction('Unrolling the chronicle…', null, { disabled: true });
    let view;
    try { view = await loadMomentsView(); } catch (error) { console.warn('Chronicle view unavailable:', error); advanceCeremony(); return; }
    if (!ceremonyData.active || !stage) return;
    ladderOff();
    silenceAICommentary();
    setScene('moments', { realm: garden ? 'day' : 'ember' });
    stage.innerHTML = view.monthMomentsHtml(tiles, { monthName: ceremonyData.monthName, className: ceremonyData.className, garden });
    setHeading('', '');
    setHerald('');
    setAction(nextLabel, advanceCeremony);
    stopCeremonyOneShots({ fade: 0.8 });
    const theme = garden ? 'garden_theme' : 'arena_theme';
    ceremonyData.music = theme;
    playCeremonyTrack(theme, { fade: 1.2 });
    duckCeremonyMusic(false);
    const box = stage.querySelector('.cer-mom');
    const items = [...stage.querySelectorAll('.cer-mom__tile')];
    const gap = items.length > 5 ? 430 : 560;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const steps = [{ at: 60, run: (fast) => { box?.classList.add('is-open'); if (!fast) playCeremonySfx('scroll'); } }];
    items.forEach((tile, i) => steps.push({ at: 900 + i * gap, run: (fast) => {
        tile.classList.remove('is-pending');
        tile.classList.add('is-in');
        countUp(tile.querySelector('.cer-count'), tile.querySelector('.cer-count')?.dataset.count, { fast, duration: 700 });
        if (fast) return;
        playCeremonySfx('stamp');
        if (!reduced) {
            const p = fxPoint(tile.querySelector('.cer-mom__seal'));
            ceremonyFx?.burst(p.x, p.y, { colors: garden ? ['#fde68a', '#f9a8d4', '#ffffff'] : ['#fde68a', '#fca5a5', '#ffffff'], count: 22, speed: 150, gravity: 60 });
        }
    } }));
    steps.push({ at: 900 + items.length * gap + 200, run: (fast) => {
        const cheer = garden
            ? `What a wonderful ${ceremonyData.monthName} we had together! 🌸`
            : `${ceremonyData.monthName}, written in deeds. Well done, ${ceremonyData.className}!`;
        setHerald(cheer);
        if (!fast) playCeremonySfx(garden ? 'chime' : 'reveal');
    } });
    runTimeline(steps);
}

/** Named heroes of the month: Quiz Champions, Seal Bearers and new Legends. */
async function renderHonours(nextLabel) {
    const stage = $('ceremony-stage-area');
    setAction('Calling the heroes…', null, { disabled: true });
    let view;
    try { view = await loadMomentsView(); } catch (error) { console.warn('Honours view unavailable:', error); advanceCeremony(); return; }
    if (!ceremonyData.active || !stage) return;
    ladderOff();
    silenceAICommentary();
    setScene('honours', { realm: 'violet' });
    stage.innerHTML = view.monthHonoursHtml(ceremonyData.honours, { monthName: `${ceremonyData.monthName} · ${ceremonyData.className}` });
    setHeading('', '');
    setHerald('');
    setAction(nextLabel, advanceCeremony);
    stopCeremonyOneShots({ fade: 0.8 });
    ceremonyData.music = 'heroes_theme';
    playCeremonyTrack('heroes_theme', { fade: 1.2 });
    const box = stage.querySelector('.cer-hon');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const steps = [{ at: 40, run: (fast) => { box?.classList.add('is-open'); if (!fast) playCeremonySfx('whoosh'); } }];
    let t = 500;
    [...stage.querySelectorAll('.cer-hon__col')].forEach((col) => {
        steps.push({ at: t, run: (fast) => {
            col.classList.remove('is-pending');
            col.classList.add('is-in');
            if (!fast) playCeremonySfx('drop');
        } });
        t += 380;
        const heroes = [...col.querySelectorAll('.cer-hon__hero')];
        const each = heroes.length > 5 ? 170 : 260;
        heroes.forEach((hero, i) => {
            steps.push({ at: t + i * each, run: (fast) => {
                hero.classList.remove('is-pending');
                hero.classList.add('is-in');
                if (fast) return;
                if (i < 6) playCeremonySfx('pling');
                if (!reduced && i < 4) {
                    const p = fxPoint(hero.querySelector('.cer-hon__face-wrap'));
                    ceremonyFx?.burst(p.x, p.y, { colors: METAL_SPARKS.gold, count: 14, speed: 120, gravity: 50 });
                }
            } });
        });
        t += heroes.length * each + 260;
    });
    steps.push({ at: t + 150, run: (fast) => {
        setHerald(`Every one of them earned it. Bravo, heroes of ${ceremonyData.monthName}!`);
        if (!fast) {
            playCeremonySfx('fanfare');
            if (!reduced) ceremonyFx?.stars({ count: 30, colors: ['#fef3c7', '#fde68a', '#c4b5fd'], duration: 2000 });
        }
    } });
    runTimeline(steps);
}

function addAscentRibbon(host) {
    const ascent = ceremonyData.ascent;
    if (!host || !ascent || !(ascent.nextGoal > 0)) return;
    const add = (view) => { if (host.isConnected) host.insertAdjacentHTML('beforeend', view.questAscentRibbonHtml(ascent)); };
    if (ascentView) add(ascentView);
    else import('./ceremonyAscent.js').then((view) => { ascentView = view; add(view); }).catch(quietly('features/ceremony.js'));
}

function renderStandings() {
    const stage = $('ceremony-stage-area');
    ladderOff();
    setScene('standings', { realm: 'violet' });
    const queue = ceremonyData.studentQueue || [];
    if (queue.length && queue.every((student) => Number(student.score) <= 0)) {
        stage.innerHTML = arenaCollectiveHtml();
        setHeading(ceremonyData.monthName, 'Our Whole Class Quest');
    } else {
        stage.innerHTML = arenaStandingsHtml(queue.slice().reverse(), { monthName: ceremonyData.monthName, risingStarId: ceremonyData.risingStar?.id || null });
        setHeading('', '');
        glideStandings(stage.querySelector('.cer-roll__list'));
    }
    setHerald('');
    ceremonyFx?.confetti({ count: 70, duration: 1800 });
    playCeremonySfx('fanfare');
}

/**
 * A long roll of honour glides down slowly once the rows are in, so the whole class is read
 * out on the projector without anyone touching the scroll bar; it stops if the teacher scrolls.
 */
function glideStandings(list) {
    if (!list || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let stopped = false;
    const stop = () => { stopped = true; };
    list.addEventListener('wheel', stop, { once: true, passive: true });
    list.addEventListener('pointerdown', stop, { once: true, passive: true });
    const rows = list.children.length;
    setTimeout(() => {
        const distance = list.scrollHeight - list.clientHeight;
        if (stopped || distance < 8 || !list.isConnected) return;
        const speed = 34; // px per second: easy to read aloud
        const start = performance.now();
        const from = list.scrollTop;
        const step = (now) => {
            if (stopped || !list.isConnected || !ceremonyData.active) return;
            const y = Math.min(distance, from + ((now - start) / 1000) * speed);
            list.scrollTop = y;
            if (y < distance) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, 1400 + Math.min(rows, 14) * 70);
}

function renderArenaOutro() {
    const stage = $('ceremony-stage-area');
    ladderOff();
    setScene('outro', { realm: 'violet' });
    const champions = (ceremonyData.studentQueue || []).filter((s) => s.rank === 1 && Number(s.score) > 0).map((s) => s.name);
    stage.innerHTML = arenaOutroHtml({ className: ceremonyData.className, classLogo: ceremonyData.classLogo, monthName: ceremonyData.monthName, champions });
    addAscentRibbon(stage.querySelector('.cer-outro'));
    setHeading('Ceremony Complete', 'Until the next moon');
    triggerAICommentary('outro', {});
    ceremonyFx?.fireworks({ count: 6, spread: 3000 });
    ceremonyFx?.confetti({ count: 120, duration: 1600 });
    playCeremonySfx('gold');
    queueFamiliarParade();
}

function advanceCeremony() {
    const screen = screenEl();
    if (!screen || !ceremonyData.active) return;
    persistCeremonyPlayback();

    if (ceremonyData.mode === 'growth_festival') {
        advanceGrowthCeremony();
        return;
    }

    if (ceremonyData.phase === 'class_reveal') {
        const queue = ceremonyData.classQueue || [];
        if (!queue.length) {
            ceremonyData.phase = afterTeamQuestPhase();
            advanceCeremony();
            return;
        }
        if (screen.dataset.scene !== 'classes') {
            setScene('classes', { realm: 'ember' });
            ladderReset('class', ceremonyData.classPointer);
        }
        if (queue.length === 1) {
            revealRank(queue[0], 'class');
            setHeading(`League ${ceremonyData.league}`, 'Champion of the League');
            ceremonyData.phase = afterTeamQuestPhase();
            setAction(afterTeamQuestLabel(), advanceCeremony);
            return;
        }
        const pointer = ceremonyData.classPointer;
        if (pointer >= queue.length - 2) {
            ceremonyData.phase = 'class_showdown';
            ladderOff();
            setupDuel(queue[queue.length - 2], queue[queue.length - 1], 'class');
            setAction('🥁 Drumroll…', handleDuelReveal);
            return;
        }
        const entry = queue[pointer];
        revealRank(entry, 'class');
        setHeading(`Team Quest · League ${ceremonyData.league}`, 'The League Rises');
        triggerAICommentary('class_rank', { id: entry.id, name: entry.name, rank: entry.rank, score: entry.score, progress: formatPercent(entry.progress), rankUp: entry.rankUp ? rankForLevel(entry.rankUp).title : '' });
        ceremonyData.classPointer += 1;
        setAction('Next', advanceCeremony);
        return;
    }

    if (ceremonyData.phase === 'class_showdown_done') {
        ceremonyData.phase = afterTeamQuestPhase();
        advanceCeremony();
        return;
    }

    if (ceremonyData.phase === 'class_ascent') {
        ceremonyData.phase = hasMoments() ? 'class_moments' : 'transition';
        renderAscent(hasMoments() ? `The Chronicle of ${ceremonyData.monthName} 📜` : "On to the Hero's Challenge");
        return;
    }

    if (ceremonyData.phase === 'class_moments') {
        ceremonyData.phase = 'transition';
        if (!hasMoments()) { advanceCeremony(); return; }
        renderMoments("On to the Hero's Challenge");
        return;
    }

    if (ceremonyData.phase === 'transition') {
        renderTransition();
        ceremonyData.phase = 'student_reveal';
        setAction("Begin Hero's Challenge", advanceCeremony);
        return;
    }

    if (ceremonyData.phase === 'student_reveal') {
        const queue = ceremonyData.studentQueue || [];
        if (!queue.length) {
            ceremonyData.phase = 'final_leaderboard';
            advanceCeremony();
            return;
        }
        if (screen.dataset.scene !== 'heroes') {
            setScene('heroes', { realm: 'violet' });
            ladderReset('student', ceremonyData.studentPointer);
            if (ceremonyData.music !== 'heroes_theme') {
                ceremonyData.music = 'heroes_theme';
                playCeremonyTrack('heroes_theme');
            }
        }
        if (queue.length === 1) {
            revealRank(queue[0], 'student');
            setHeading(ceremonyData.className, 'Class Hero');
            ceremonyData.phase = afterHeroesPhase();
            setAction(ceremonyData.phase === 'final_leaderboard' ? 'See Full Results' : afterHeroesLabel(), advanceCeremony);
            return;
        }
        const pointer = ceremonyData.studentPointer;
        if (pointer >= queue.length - 2) {
            ceremonyData.phase = 'student_showdown';
            ladderOff();
            setupDuel(queue[queue.length - 2], queue[queue.length - 1], 'student');
            setAction('Crown the Champion', handleDuelReveal);
            return;
        }
        const entry = queue[pointer];
        revealRank(entry, 'student');
        setHeading(`Hero's Challenge · ${ceremonyData.className}`, entry.rank === 3 ? 'The Bronze Hero' : 'Heroes of the Month');
        let tieReason = '';
        if (pointer > 0) {
            const prev = queue[pointer - 1];
            if (entry.score === prev.score && entry.rank < prev.rank) {
                if (entry.stats.count3 > prev.stats.count3) tieReason = 'tie_3star';
                else if (entry.stats.count2 > prev.stats.count2) tieReason = 'tie_2star';
                else if (entry.stats.academicAvg > prev.stats.academicAvg) tieReason = 'tie_academic';
                else if (entry.stats.uniqueReasons > prev.stats.uniqueReasons) tieReason = 'tie_variety';
            }
        }
        triggerAICommentary('student_rank', { name: entry.name, rank: entry.rank, score: entry.score, tieReason });
        ceremonyData.studentPointer += 1;
        setAction('Next', advanceCeremony);
        return;
    }

    if (ceremonyData.phase === 'student_showdown_done') {
        ceremonyData.phase = afterHeroesPhase();
        advanceCeremony();
        return;
    }

    if (ceremonyData.phase === 'rising_star') {
        const next = hasHonours() ? 'honours' : 'final_leaderboard';
        ceremonyData.phase = next;
        if (!ceremonyData.risingStar) { advanceCeremony(); return; }
        setAction('Showing the Rising Star…', null, { disabled: true });
        renderRisingStar().finally(() => {
            if (ceremonyData.active && ceremonyData.phase === next) setAction(next === 'honours' ? 'Honours of the Month ✦' : 'Show Final Standings', advanceCeremony);
        });
        return;
    }

    if (ceremonyData.phase === 'honours') {
        ceremonyData.phase = 'final_leaderboard';
        if (!hasHonours()) { advanceCeremony(); return; }
        renderHonours('Show Final Standings');
        return;
    }

    if (ceremonyData.phase === 'final_leaderboard') {
        renderStandings();
        ceremonyData.phase = 'end';
        setAction('Finish Ceremony', advanceCeremony);
        return;
    }

    if (ceremonyData.phase === 'end') {
        saveCeremonyComplete();
        renderArenaOutro();
        setAction('Close', closeCeremony);
        ceremonyData.phase = 'closed';
    }
}

// ============================================================== GROWTH FESTIVAL

function gardenPerson(id, fallbackName = '') {
    const all = state.get('allStudents') || [];
    const found = all.find((s) => s.id === id) || (ceremonyData.growthStudents || []).find((s) => s.id === id);
    return { id, name: found?.name || fallbackName || 'Learner', avatar: found?.avatar || null };
}

function gardenLearners() {
    const cards = ceremonyData.growthSpotlights || [];
    const fromCards = cards.map((card) => gardenPerson(card.studentId, card.studentName));
    const seen = new Set(fromCards.map((p) => p.id));
    (ceremonyData.growthStudents || []).forEach((s) => {
        if (!seen.has(s.id)) {
            seen.add(s.id);
            fromCards.push(gardenPerson(s.id, s.name));
        }
    });
    return fromCards;
}

function plantSprig(person, { fast = false, from = null } = {}) {
    const row = document.getElementById('gdn-bed-row');
    if (!row || ceremonyData.gardenPlanted.has(person.id)) return;
    ceremonyData.gardenPlanted.add(person.id);
    row.insertAdjacentHTML('beforeend', gardenSprigHtml(person, row.children.length));
    row.style.setProperty('--n', String(row.children.length));
    const sprig = row.lastElementChild;
    if (fast || !from) {
        sprig.classList.add('is-planted');
        return;
    }
    sprig.classList.add('is-arriving');
    const a = from.getBoundingClientRect();
    const b = sprig.querySelector('.gdn-bloom')?.getBoundingClientRect();
    if (!b || typeof from.animate !== 'function') {
        sprig.classList.add('is-planted');
        return;
    }
    const flyer = from.cloneNode(true);
    flyer.classList.add('gdn-flyer');
    Object.assign(flyer.style, { position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, margin: '0', transformOrigin: '0 0', zIndex: '40', pointerEvents: 'none' });
    document.body.appendChild(flyer);
    const s = b.width / a.width;
    const anim = flyer.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${(b.left - a.left) * 0.5}px, ${(b.top - a.top) * 0.35 - 80}px) scale(${(1 + s) / 2})`, opacity: 1, offset: 0.5 },
        { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${s})`, opacity: 0.9 }
    ], { duration: 900, easing: 'cubic-bezier(.3,.7,.3,1)' });
    anim.onfinish = () => {
        flyer.remove();
        sprig.classList.remove('is-arriving');
        sprig.classList.add('is-planted');
        const p = fxPoint(sprig.querySelector('.gdn-bloom'));
        ceremonyFx?.burst(p.x, p.y, { colors: ['#fde68a', '#f9a8d4', '#ffffff'], count: 22, speed: 120, size: 8, gravity: 40 });
    };
}

function openGardenGate() {
    const stage = $('ceremony-stage-area');
    const gate = stage.querySelector('.gdn-gate');
    setAction('Opening the gate…', null);
    const loading = loadCeremonyResults();
    playCeremonySfx('whoosh');
    gate?.classList.add('is-opening');
    ceremonyFx?.petals({ count: 36, duration: 1600 });
    let ready = false;
    let opened = false;
    const go = () => {
        if (ready && opened && ceremonyData.active) advanceCeremony();
    };
    loading.then((ok) => {
        if (!ok) {
            showLoadError();
            return;
        }
        ready = true;
        go();
    });
    runTimeline([{ at: 1500, run: () => { opened = true; } }], go);
}

function renderGardenLeague() {
    const stage = $('ceremony-stage-area');
    setScene('league', { realm: 'day' });
    const garden = ceremonyData.growthGardenClasses || [];
    const pathfinder = garden.find((item) => item.id === ceremonyData.growthPathfinderId);
    const ordered = [...garden.filter((item) => item.id !== ceremonyData.growthPathfinderId), ...(pathfinder ? [pathfinder] : [])];
    stage.innerHTML = gardenLeagueHtml(ordered, { pathfinderId: ceremonyData.growthPathfinderId, myClassId: ceremonyData.classId, soloClassName: ceremonyData.className });
    setHeading('Our League Garden', 'Every class grows in its own way');
    setHerald('Look how our league garden is blossoming together! 🌸');
    const planters = [...stage.querySelectorAll('.gdn-planter')];
    const steps = planters.map((planter, i) => ({
        at: 250 + i * 520 + (planter.classList.contains('gdn-planter--pathfinder') ? 500 : 0),
        run: (fast) => {
            planter.classList.add('is-grown');
            if (fast) return;
            playCeremonySfx(planter.classList.contains('gdn-planter--pathfinder') ? 'pop' : 'sprout');
            const p = fxPoint(planter.querySelector('.gdn-bloom'));
            ceremonyFx?.burst(p.x, p.y, { colors: planter.classList.contains('gdn-planter--pathfinder') ? ['#fde68a', '#fbbf24', '#fff'] : ['#f9a8d4', '#bbf7d0', '#fff'], count: 30, speed: 160, gravity: 60 });
        }
    }));
    runTimeline(steps);
}

function renderGardenRain() {
    const stage = $('ceremony-stage-area');
    setScene('rain', { realm: 'day' });
    stage.innerHTML = gardenTransitionHtml();
    setHeading('', '');
    setHerald('Every little step, warm smile and kind helping hand made our classroom blossom! 🌷');
    playCeremonySfx('chime');
    ceremonyFx?.petals({ count: 50, duration: 3000 });
}

function renderGardenParade(index) {
    const stage = $('ceremony-stage-area');
    const queue = ceremonyData.growthSpotlights || [];
    const card = queue[index];
    setScene('parade', { realm: 'day' });
    // Children shown before this card are already in the bed (resume or back-navigation).
    queue.slice(0, index).forEach((c) => plantSprig(gardenPerson(c.studentId, c.studentName), { fast: true }));
    const person = gardenPerson(card.studentId, card.studentName);
    stage.innerHTML = gardenParadeHtml(card, { index, total: queue.length, person });
    setHeading('Parade of Blooms', 'A special part of our garden');
    setHerald(`Let's celebrate ${person.name}! 🌸`);
    const parade = stage.querySelector('.gdn-parade');
    const head = parade.querySelector('.gdn-grow__head .gdn-bloom');
    const already = ceremonyData.gardenPlanted.has(person.id);
    stage.querySelector('[data-growth-nav="prev"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelTimeline();
        if (index > 0) {
            renderGardenParade(index - 1);
            ceremonyData.growthPointer = index;
            setParadeAction(index - 1);
        }
    });
    stage.querySelector('[data-growth-nav="next"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (index + 1 >= queue.length) return;
        finishTimeline();
        cancelTimeline();
        ceremonyData.growthPointer = index + 1;
        advanceGrowthCeremony();
    });
    runTimeline([
        { at: 60, run: (fast) => { parade.classList.add('is-seeded'); if (!fast) playCeremonySfx('seed'); } },
        { at: 650, run: (fast) => { parade.classList.add('is-sprouting'); if (!fast) playCeremonySfx('sprout'); } },
        { at: 1350, run: () => { parade.classList.add('is-budding'); } },
        { at: 2350, run: (fast) => {
            parade.classList.add('is-bloomed');
            head?.classList.add('is-open');
            if (!fast) {
                playCeremonySfx('pop');
                const p = fxPoint(head);
                ceremonyFx?.burst(p.x, p.y, { colors: ['#fde68a', '#f9a8d4', '#c4b5fd', '#ffffff'], count: 60, speed: 240, gravity: 70 });
                ceremonyFx?.petals({ count: 16, duration: 800 });
            }
        } },
        { at: 2700, run: () => { parade.classList.add('is-told'); } },
        { at: 3500, run: (fast) => { if (!already) plantSprig(person, { fast, from: head }); } }
    ]);
}

function setParadeAction(index) {
    const total = (ceremonyData.growthSpotlights || []).length;
    setAction(index + 1 >= total ? 'Reveal Our Golden Bloom ✨' : 'Next Bloom 🌸', advanceCeremony);
}

function renderGardenFinale() {
    const stage = $('ceremony-stage-area');
    setScene('finale', { realm: 'day' });
    gardenLearners().forEach((person) => plantSprig(person, { fast: true }));
    const allStudents = state.get('allStudents') || [];
    const winners = (ceremonyData.growthWinners || []).map((w) => {
        const s = allStudents.find((x) => x.id === w.id) || w;
        return { id: s.id, name: s.name || w.name, avatar: s.avatar || null };
    });
    stage.innerHTML = gardenFinaleHtml(winners, { classLogo: ceremonyData.classLogo, className: ceremonyData.className });
    setHeading('The Golden Bloom', 'Who is shining brightest?');
    setHerald('Shh… the biggest bud in the garden is waking up!');
    const finale = stage.querySelector('.gdn-finale');
    stopCeremonyMusic({ fade: 1 });
    playCeremonyTrack('golden_bloom');
    const bed = document.querySelector('.gdn-bed');
    runTimeline([
        { at: 80, run: () => finale.classList.add('is-growing') },
        { at: 900, run: (fast) => { if (!fast) playCeremonySfx('chime'); } },
        { at: 1700, run: (fast) => { finale.classList.add('is-glowing'); if (!fast) playCeremonySfx('chime'); } },
        { at: 2600, run: (fast) => { if (!fast) playCeremonySfx('sprout'); } },
        { at: 3300, run: (fast) => {
            finale.classList.add('is-open');
            finale.querySelectorAll('.gdn-bloom').forEach((b) => b.classList.add('is-open'));
            if (winners.length) {
                setHeading(winners.length > 1 ? 'Co-Prodigies' : 'Prodigy of the Month', winners.length > 1 ? 'Our Golden Blooms' : 'Our Golden Bloom');
                setHerald(winners.length > 1 ? 'Two golden blooms are shining in our garden! 👑✨' : `${winners[0].name} is our Golden Bloom! 👑✨`);
            } else {
                setHeading('Whole Class Garden', 'Everyone helped our garden grow');
                setHerald('Everyone helped our class garden grow and blossom together! 🌸💖');
            }
            if (!fast) {
                playCeremonySfx('pop');
                playCeremonySfx('gold');
                finale.querySelectorAll('.gdn-golden .gdn-bloom').forEach((b) => {
                    const p = fxPoint(b);
                    ceremonyFx?.burst(p.x, p.y, { colors: ['#fde047', '#facc15', '#ffffff', '#f9a8d4'], count: 120, speed: 320, ring: true, gravity: 60 });
                });
                ceremonyFx?.confetti({ count: 120, colors: ['#fde68a', '#f9a8d4', '#bbf7d0', '#c4b5fd', '#a5f3fc'], duration: 1500 });
                ceremonyFx?.petals({ count: 40, duration: 2500 });
            }
            replay(bed, 'is-cheering');
        } }
    ]);
}

function renderGardenEnd() {
    const stage = $('ceremony-stage-area');
    setScene('end', { realm: 'dusk' });
    stage.innerHTML = gardenEndHtml({ className: ceremonyData.className });
    addAscentRibbon(stage.querySelector('.gdn-end'));
    setHeading('Ceremony Complete', 'Sleep well, little garden');
    setHerald('Our classroom garden will keep blooming bright all year long! 🌿💖');
    ceremonyFx?.stars({ count: 36, colors: ['#fef9c3', '#fde68a', '#fbcfe8'], duration: 4000 });
    playCeremonySfx('chime');
    queueFamiliarParade();
}

/** After the final scene, every hatched familiar of the class walks across the screen once. */
function queueFamiliarParade() {
    if (ceremonyData.paradeQueued) return;
    ceremonyData.paradeQueued = true;
    const classId = ceremonyData.classId;
    setTimeout(() => {
        if (!ceremonyData.active || ceremonyData.classId !== classId) return;
        import('./familiarParade.js')
            .then((m) => {
                const screen = screenEl();
                if (!m.startFamiliarParade(classId, { host: screen || document.body, muted: isCeremonyAudioMuted() }) || !screen) return;
                // The companions walk along the bottom: the outro steps up and the herald rests.
                screen.dataset.parade = 'on';
                const watch = setInterval(() => {
                    if (!screen.querySelector('.fam-parade') || !ceremonyData.active) {
                        clearInterval(watch);
                        delete screen.dataset.parade;
                    }
                }, 800);
            })
            .catch((e) => console.warn('Familiar Parade could not start:', e));
    }, 2600);
}

function advanceGrowthCeremony() {
    if (ceremonyData.phase === 'growth_garden') {
        renderGardenLeague();
        setAction('Explore Our Blooms 🌸', advanceCeremony);
        ceremonyData.phase = 'growth_transition';
        return;
    }
    if (ceremonyData.phase === 'growth_transition') {
        renderGardenRain();
        setAction('Begin the Bloom Parade 🌺', advanceCeremony);
        ceremonyData.phase = 'growth_parade';
        return;
    }
    if (ceremonyData.phase === 'growth_parade') {
        const queue = ceremonyData.growthSpotlights || [];
        const index = ceremonyData.growthPointer || 0;
        if (index >= queue.length) {
            ceremonyData.phase = 'growth_final';
            advanceGrowthCeremony();
            return;
        }
        renderGardenParade(index);
        ceremonyData.growthPointer = index + 1;
        setParadeAction(index);
        return;
    }
    if (ceremonyData.phase === 'growth_final') {
        renderGardenFinale();
        if (ceremonyData.ascent) {
            setAction(ceremonyData.ascent.crossed ? 'Our Garden Grows 🌱' : 'Our Next Adventure 🌱', advanceCeremony);
            ceremonyData.phase = 'growth_ascent';
        } else if (hasMoments()) {
            setAction(`Our ${ceremonyData.monthName} Story 📖`, advanceCeremony);
            ceremonyData.phase = 'growth_moments';
        } else {
            setAction('Finish Ceremony 🌿', advanceCeremony);
            ceremonyData.phase = 'growth_end';
        }
        return;
    }
    if (ceremonyData.phase === 'growth_ascent') {
        ceremonyData.phase = hasMoments() ? 'growth_moments' : 'growth_end';
        renderAscent(hasMoments() ? `Our ${ceremonyData.monthName} Story 📖` : 'Finish Ceremony 🌿');
        return;
    }
    if (ceremonyData.phase === 'growth_moments') {
        ceremonyData.phase = 'growth_end';
        if (!hasMoments()) { advanceGrowthCeremony(); return; }
        renderMoments('Finish Ceremony 🌿');
        return;
    }
    if (ceremonyData.phase === 'growth_end') {
        saveCeremonyComplete();
        renderGardenEnd();
        setAction('Close', closeCeremony);
        ceremonyData.phase = 'end';
    }
}

// ============================================================== SAVE

async function saveCeremonyComplete() {
    const classId = ceremonyData.classId;
    const monthKey = ceremonyData.monthKey;
    try {
        const classRef = doc(db, `${PUBLIC_DATA_PATH}/classes`, classId);
        const snapshotId = `${classId}__${monthKey}`;
        const snapshotRef = doc(db, `${PUBLIC_DATA_PATH}/ceremony_snapshots`, snapshotId);
        const snapshotPayload = {
            schemaVersion: 1,
            schoolYearKey: state.getActiveSchoolYearKey(),
            classId,
            className: state.get('allSchoolClasses').find((item) => item.id === classId)?.name || '',
            questLeague: ceremonyData.league,
            monthKey,
            mode: ceremonyData.mode || 'classic_arena',
            status: 'completed',
            classResults: ceremonyData.classQueue || [],
            studentResultsPrivate: ceremonyData.studentQueue || [],
            classWinner: ceremonyData.classQueue?.[ceremonyData.classQueue.length - 1] || null,
            prodigyWinners: ceremonyData.mode === 'growth_festival' ? (ceremonyData.growthWinners || []) : (ceremonyData.studentQueue?.filter((item) => item.rank === 1) || []),
            publicSequence: ceremonyData.mode === 'growth_festival' ? { parade: ceremonyData.growthSpotlights || [] } : { classes: ceremonyData.classQueue || [], students: ceremonyData.studentQueue || [], risingStar: ceremonyData.risingStar || null },
            spotlights: ceremonyData.growthSpotlights || [],
            sourceGeneratedAt: new Date(),
            snapshotVersion: 1,
            playback: { phase: ceremonyData.phase, index: 0, updatedAt: new Date() },
            completedAt: new Date(),
            completedBy: state.get('currentUserId')
        };
        const existingSnapshot = await getDoc(snapshotRef);
        if (existingSnapshot.exists() && ['locked', 'completed'].includes(existingSnapshot.data().status)) {
            await updateDoc(snapshotRef, { status: 'completed', playback: snapshotPayload.playback, completedAt: new Date(), completedBy: state.get('currentUserId') });
        } else {
            await setDoc(snapshotRef, stripUndefinedDeep(snapshotPayload), { merge: true });
        }
        await updateDoc(classRef, {
            [`ceremonyHistory.${monthKey}.complete`]: true,
            [`ceremonyHistory.${monthKey}.watchedAt`]: new Date(),
            [`ceremonyHistory.${monthKey}.snapshotId`]: snapshotId,
            [`ceremonyHistory.${monthKey}.mode`]: ceremonyData.mode || 'classic_arena',
            [`ceremonyHistory.${monthKey}.snapshotVersion`]: 1
        });
        
        const classes = state.get('allSchoolClasses');
        const c = classes.find(x => x.id === classId);
        if(c) {
            if(!c.ceremonyHistory) c.ceremonyHistory = {};
            if(!c.ceremonyHistory[monthKey]) c.ceremonyHistory[monthKey] = {};
            c.ceremonyHistory[monthKey].complete = true;
        }
        updateCeremonyStatus();
    } catch(e) { console.error("Save failed", e); }
}

// --- AI COMMENTARY ---
let aiDebounce = null;

let heraldToken = 0;

/** A late herald line from the last scene must not cover this one's own words. */
function silenceAICommentary() {
    if (aiDebounce) clearTimeout(aiDebounce);
    aiDebounce = null;
    heraldToken += 1;
}

async function triggerAICommentary(phase, data) {
    if (aiDebounce) clearTimeout(aiDebounce);
    const token = ++heraldToken;

    aiDebounce = setTimeout(async () => {

        // 1. Determine Tone based on League (Age Group)
        const league = ceremonyData.league || 'A'; // Default to A if missing
        let toneInstruction = "";
        
        if (utils.isYoungLearnerLeague(league)) {
            // Young learners (5-9): simple, high energy, magical
            toneInstruction = "Speak like an exciting game show host for young kids. Use simple words. Be very enthusiastic and magical.";
        } else {
            // Older Kids/Teens (10+): Serious, professional, 'Esports' style
            toneInstruction = "Speak like a professional Esports commentator. Use sophisticated, punchy, dramatic language. Be serious but hype. Use words like 'dominance', 'precision', 'legendary status'.";
        }

        let systemPrompt = `You are the 'Grand Quest Master'. ${toneInstruction} Your commentary must be short (max 12 words). Do not use markdown.`;
        let userPrompt = "";

        if (phase === 'intro') userPrompt = `Hyping up the start of the ${data.month} Ceremony.`;
        else if (phase === 'class_rank') {
            const isMyClass = data.id === state.get('globalSelectedClassId');
            if (isMyClass) {
                userPrompt = `The class watching this is '${data.name}'. They just got Rank #${data.rank}. Talk directly to them ("You"). Congratulate or encourage them on their result!`;
            } else {
                userPrompt = `Class '${data.name}' got Rank #${data.rank}. Hype them up!`;
            }
            if (data.rankUp) userPrompt += ` They also stepped through the Crystal Portal this month and rose to the quest rank '${data.rankUp}'. Mention it.`;
        }
        else if (phase === 'class_winner') {
            const isMyClass = data.id === state.get('globalSelectedClassId');
            if (isMyClass) {
                userPrompt = `The class watching this ('${data.name}') WON! Tell them "YOU DID IT!" Go wild!`;
            } else {
                userPrompt = `Class '${data.name}' WON the whole thing! Go wild!`;
            }
        }
        else if (phase === 'transition') userPrompt = "Transitioning to the student hero reveal. Ask who is the best.";
        else if (phase === 'student_rank') {
            if (data.tieReason === 'tie_3star') userPrompt = `Hype ${data.name} for having tons of 3-Star badges!`;
            else if (data.tieReason === 'tie_2star') userPrompt = `Hype ${data.name} for consistent 2-Star plays!`;
            else if (data.tieReason === 'tie_academic') userPrompt = `Hype ${data.name} for their brain power on tests!`;
            else if (data.tieReason === 'tie_variety') userPrompt = `Hype ${data.name} for being a jack-of-all-trades!`;
            else userPrompt = `Shout out ${data.name} for hitting Rank #${data.rank}.`;
        }
        else if (phase === 'student_winner') userPrompt = `Announce ${data.name} is the Prodigy of the Month!`;
        else if (phase === 'rising_star') userPrompt = `Celebrate ${data.name} as this month's Rising Star: the hero who grew the most compared with their own last month. Warm and proud, not competitive.`;
        else if (phase === 'outro') userPrompt = "Sign off with energy. See you next month.";
        else if (phase === 'showdown_build') userPrompt = `It's down to ${data.name1} vs ${data.name2}. The tension is maximum! Build extreme suspense but DO NOT announce the winner yet.`;
        else if (phase === 'tie') userPrompt = `UNBELIEVABLE! It's a tie between ${data.names}! Two Co-Prodigies!`;

        const genericByPhase = {
            intro: `Welcome to the ${data.month} Ceremony!`,
            class_rank: data.rankUp ? `Rank #${data.rank}: ${data.name}, now ${data.rankUp}!` : `Rank #${data.rank} — ${data.name}!`,
            class_winner: `${data.name} wins! You did it!`,
            transition: 'Who will be our Prodigy?',
            student_rank: `Shout out to ${data.name}!`,
            student_winner: `${data.name} is our Prodigy of the Month!`,
            rising_star: `${data.name} climbed higher than ever. Our Rising Star!`,
            outro: 'See you next month!',
            showdown_build: `${data.name1} vs ${data.name2} — the final showdown!`,
            tie: `Two crowns! ${data.names || 'Our Co-Prodigies'} share the glory!`
        };
        const genericMessage = genericByPhase[phase] || 'Congratulations to our heroes!';

        try {
            if (canUseFeature('eliteAI')) {
                const commentary = await callGeminiApi(systemPrompt, userPrompt);
                if (ceremonyData.active && token === heraldToken) setHerald(String(commentary || genericMessage).trim());
            } else {
                setHerald(genericMessage);
            }
        } catch (e) {
            console.error('AI Error', e);
            if (ceremonyData.active && token === heraldToken) setHerald(genericMessage);
        }
    }, 250); 
}
