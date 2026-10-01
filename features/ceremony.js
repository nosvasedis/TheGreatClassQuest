// /features/ceremony.js — Ceremony of the Month.
// Classic Arena (torchlit arena, Team Quest then Hero's Challenge) and the
// Growth Festival (storybook garden for Nursery and Pre-Junior). Results are
// prepared and locked once (ceremonySnapshots); markup lives in
// ceremonyArenaView.js / ceremonyGardenView.js; effects in ui/ceremonyFx.js;
// sound in ceremonyAudio.js.

import { db, updateDoc, setDoc, getDoc, doc, collection, getDocs, query, where } from '../firebase.js';
import * as state from '../state.js';
import {
    prepareCeremonyAudio,
    playCeremonyTrack,
    playCeremonySfx,
    stopCeremonyMusic,
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
import { resolveCeremonyMode, buildGrowthSpotlights, chooseCanonicalWinners, seededShuffle, seededHash, resolvePendingCeremonyMonth } from './ceremonyDomain.js';
import { getCeremonyStarVerdict, ensureCeremonyStarVerdict } from './ceremonyStarCheck.js';
import { prepareCeremonySnapshot, lockCeremonySnapshot, saveCeremonyPlayback, ceremonySnapshotId, stripUndefinedDeep } from './ceremonySnapshots.js';
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
    const snapshotSnap = await getDoc(doc(db, 'artifacts/great-class-quest/public/data/ceremony_snapshots', ceremonySnapshotId(classId, monthKey))).catch(() => null);
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
            ceremonyData.loaded = true;
            return true;
        }
        if (ceremonyData.mode === 'growth_festival') {
            await loadGrowthCeremonyData();
            await persistPreparedCeremonySnapshot();
            ceremonyData.loaded = true;
            return true;
        }
        const [year, month] = ceremonyData.monthKey.split('-').map(Number);
        const { monthStart } = getCeremonyMonthBounds(ceremonyData.monthKey);
        const allStudents = state.get('allStudents') || [];
        
        // 1. Fetch Logs
        const logs = await fetchLogsForMonth(year, month);
        const { fetchMonthlyHistory } = await import('../state.js');
        const archived = await fetchMonthlyHistory(ceremonyData.monthKey).catch(() => ({}));
        const activeYearKey = state.getActiveSchoolYearKey();
        const questHistorySnap = await getDocs(query(
            collection(db, 'artifacts/great-class-quest/public/data/quest_history'),
            where('schoolYearKey', '==', activeYearKey)
        ));
        const questHistoryRecords = questHistorySnap.docs.map(docSnap => docSnap.data());
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

        ceremonyData.studentQueue = studentStats.reverse();
        ceremonyData.phase = 'class_reveal';
        await persistPreparedCeremonySnapshot();
        ceremonyData.loaded = true;
        return true;
    } catch (e) {
        console.error('Ceremony Load Error:', e);
        return false;
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
    void saveCeremonyPlayback(ceremonyData.classId, ceremonyData.monthKey, { phase: ceremonyData.phase, index: ceremonyData.growthPointer || ceremonyData.studentPointer || ceremonyData.classPointer || 0 }).catch(() => {});
}

async function loadGrowthCeremonyData() {
    const [year, month] = ceremonyData.monthKey.split('-').map(Number);
    const logs = await fetchLogsForMonth(year, month).catch(() => []);
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
    const tl = { steps: steps.map((step) => ({ ...step, done: false })), timers: [], onDone };
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

function countUp(el, to, { fast = false, duration = 900 } = {}) {
    if (!el) return;
    const target = Number(to) || 0;
    if (fast || target <= 0 || typeof requestAnimationFrame !== 'function') {
        el.textContent = String(target);
        return;
    }
    const start = performance.now();
    const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = String(Math.round(target * eased));
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
        const btn = $('ceremony-action-btn');
        if (btn && !btn.disabled) btn.click();
        else finishTimeline();
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
    queue.slice(0, upTo).forEach((entry) => ladder.insertAdjacentHTML('beforeend', arenaLadderTokenHtml(entry, type)));
}

function ladderAdd(entry, type) {
    const ladder = getLadder();
    if (!ladder) return;
    ladder.insertAdjacentHTML('beforeend', arenaLadderTokenHtml(entry, type));
    const token = ladder.lastElementChild;
    token?.classList.add('is-new');
    ladder.scrollTo?.({ left: ladder.scrollWidth, behavior: 'smooth' });
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
            countUp(card.querySelector('.cer-count'), entry.score, { fast });
        } },
        { at: 1650, run: () => {
            reveal.classList.add('is-settled');
            ladderAdd(entry, type);
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
        setAction(finishedClassShowdown ? "On to the Hero's Challenge" : 'Show Final Standings', advanceCeremony);
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
    ceremonyData.music = 'heroes_theme';
    playCeremonyTrack('heroes_theme', { fade: 1.6 });
    playCeremonySfx('whoosh');
    ceremonyFx?.stars({ count: 40, colors: ['#ddd6fe', '#c4b5fd', '#fef3c7'], duration: 2400 });
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
        stage.innerHTML = arenaStandingsHtml(queue.slice().reverse(), { monthName: ceremonyData.monthName });
        setHeading('', '');
    }
    setHerald('');
    ceremonyFx?.confetti({ count: 70, duration: 1800 });
    playCeremonySfx('fanfare');
}

function renderArenaOutro() {
    const stage = $('ceremony-stage-area');
    ladderOff();
    setScene('outro', { realm: 'violet' });
    const champions = (ceremonyData.studentQueue || []).filter((s) => s.rank === 1 && Number(s.score) > 0).map((s) => s.name);
    stage.innerHTML = arenaOutroHtml({ className: ceremonyData.className, classLogo: ceremonyData.classLogo, monthName: ceremonyData.monthName, champions });
    setHeading('Ceremony Complete', 'Until the next moon');
    triggerAICommentary('outro', {});
    ceremonyFx?.fireworks({ count: 6, spread: 3000 });
    ceremonyFx?.confetti({ count: 120, duration: 1600 });
    playCeremonySfx('gold');
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
            ceremonyData.phase = 'transition';
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
            ceremonyData.phase = 'transition';
            setAction("On to the Hero's Challenge", advanceCeremony);
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
        triggerAICommentary('class_rank', { id: entry.id, name: entry.name, rank: entry.rank, score: entry.score, progress: formatPercent(entry.progress) });
        ceremonyData.classPointer += 1;
        setAction('Next', advanceCeremony);
        return;
    }

    if (ceremonyData.phase === 'class_showdown_done') {
        ceremonyData.phase = 'transition';
        advanceCeremony();
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
            ceremonyData.phase = 'final_leaderboard';
            setAction('See Full Results', advanceCeremony);
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
        ceremonyData.phase = 'final_leaderboard';
        advanceCeremony();
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
    setHeading('Ceremony Complete', 'Sleep well, little garden');
    setHerald('Our classroom garden will keep blooming bright all year long! 🌿💖');
    ceremonyFx?.stars({ count: 36, colors: ['#fef9c3', '#fde68a', '#fbcfe8'], duration: 4000 });
    playCeremonySfx('chime');
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
        setAction('Finish Ceremony 🌿', advanceCeremony);
        ceremonyData.phase = 'growth_end';
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
        const classRef = doc(db, `artifacts/great-class-quest/public/data/classes`, classId);
        const snapshotId = `${classId}__${monthKey}`;
        const snapshotRef = doc(db, 'artifacts/great-class-quest/public/data/ceremony_snapshots', snapshotId);
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
            publicSequence: ceremonyData.mode === 'growth_festival' ? { parade: ceremonyData.growthSpotlights || [] } : { classes: ceremonyData.classQueue || [], students: ceremonyData.studentQueue || [] },
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
        else if (phase === 'outro') userPrompt = "Sign off with energy. See you next month.";
        else if (phase === 'showdown_build') userPrompt = `It's down to ${data.name1} vs ${data.name2}. The tension is maximum! Build extreme suspense but DO NOT announce the winner yet.`;
        else if (phase === 'tie') userPrompt = `UNBELIEVABLE! It's a tie between ${data.names}! Two Co-Prodigies!`;

        const genericByPhase = {
            intro: `Welcome to the ${data.month} Ceremony!`,
            class_rank: `Rank #${data.rank} — ${data.name}!`,
            class_winner: `${data.name} wins! You did it!`,
            transition: 'Who will be our Prodigy?',
            student_rank: `Shout out to ${data.name}!`,
            student_winner: `${data.name} is our Prodigy of the Month!`,
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
