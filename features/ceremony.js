// /features/ceremony.js

import { db } from '../firebase.js';
import { updateDoc, doc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import * as state from '../state.js';
import { playSound, ceremonyMusic, winnerFanfare, showdownSting, fadeCeremonyMusic, stopAllCeremonyAudio, playCeremonyMusic, playDrumRoll, stopDrumRoll, playWinnerFanfare } from '../audio.js';
import { fetchLogsForMonth } from '../db/queries.js';
import { callGeminiApi } from '../api.js';
import { canUseFeature } from '../utils/subscription.js';
import * as utils from '../utils.js';
import { getNormalizedPercentForScore } from './assessmentConfig.js';
import { formatTeacherBoonReason, getTeacherBoonForMonth } from './boons.js';
import {
    getAwardLogMonthlyStarCredit,
    mergeMonthlyStarsFromArchivedHistoryAndAwardLogs,
    sumMonthlyStarCreditsByStudentFromAwardLogs
} from './awardLogReasonMeta.js';
import { getQuestMapZoneForProgressPercent } from './worldMap.js';

const CEREMONY_REASON_INFO = {
    teamwork: { icon: 'fa-users', chip: 'ceremony-chip--teamwork', name: 'Teamwork' },
    creativity: { icon: 'fa-lightbulb', chip: 'ceremony-chip--creativity', name: 'Creativity' },
    respect: { icon: 'fa-hands-helping', chip: 'ceremony-chip--respect', name: 'Respect' },
    focus: { icon: 'fa-brain', chip: 'ceremony-chip--focus', name: 'Focus' },
    welcome_back: { icon: 'fa-hand-sparkles', chip: 'ceremony-chip--welcome', name: 'Back!' },
    story_weaver: { icon: 'fa-feather-alt', chip: 'ceremony-chip--story', name: 'Story' },
    scholar_s_bonus: { icon: 'fa-graduation-cap', chip: 'ceremony-chip--scholar', name: 'Scholar' },
    teacher_boon: { icon: 'fa-wand-magic-sparkles', chip: 'ceremony-chip--boon', name: 'Teacher Boon' },
    pathfinder_map: { icon: 'fa-map', chip: 'ceremony-chip--pathfinder', name: 'Pathfinder' }
};

const CEREMONY_LEVEL_STYLES = {
    1: { chip: 'ceremony-chip--lvl-1', icon: '🌱', label: 'Level 1' },
    2: { chip: 'ceremony-chip--lvl-2', icon: '💧', label: 'Level 2' },
    3: { chip: 'ceremony-chip--lvl-3', icon: '🛡️', label: 'Level 3' },
    4: { chip: 'ceremony-chip--lvl-4', icon: '🔮', label: 'Level 4' },
    5: { chip: 'ceremony-chip--lvl-5', icon: '🔥', label: 'Level 5' },
    6: { chip: 'ceremony-chip--lvl-6', icon: '🐉', label: 'Level 6' }
};

const CEREMONY_ZONE_CHIPS = {
    bronze: 'ceremony-chip--zone-bronze',
    silver: 'ceremony-chip--zone-silver',
    gold: 'ceremony-chip--zone-gold',
    crystal: 'ceremony-chip--zone-crystal'
};
let ceremonyData = {
    active: false,
    phase: 'intro', 
    monthKey: null,
    monthName: '',
    classId: null,
    league: null,
    classQueue: [], 
    studentQueue: [], 
    classPointer: 0, 
    studentPointer: 0 
};

// --- HELPER: Title Formatter (Fixes Emoji Gradient Issue) ---
function formatTitleHtml(text) {
    const emojiRegex = /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g;
    const parts = text.split(emojiRegex);
    return parts.map(part => {
        if (part.match(emojiRegex)) {
            return `<span class="emoji-reset">${part}</span>`;
        } else if (part.trim().length > 0) {
            return `<span class="gradient-text">${part}</span>`;
        }
        return '';
    }).join('');
}

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

function getTeacherBoonCeremonyMarkup(teacherBoon, options = {}) {
    if (!teacherBoon) return '';
    const { compact = false } = options;
    const stars = Number(teacherBoon.stars) || 0;
    const reasonText = formatTeacherBoonReason(teacherBoon);

    return `
        <div class="teacher-boon-ceremony-ribbon ${compact ? 'teacher-boon-ceremony-ribbon--compact' : ''}">
            <div class="teacher-boon-ceremony-ribbon__kicker">Teacher Boon</div>
            <div class="teacher-boon-ceremony-ribbon__stars">${'⭐'.repeat(Math.max(1, stars))}</div>
            <div class="teacher-boon-ceremony-ribbon__reason">${reasonText}</div>
        </div>
    `;
}

let lastCeremonyViewMode = 'intro';

const PODIUM_REVEAL_DELAY_MS = 2800;

function setCeremonyActionLabel(text) {
    const btn = document.getElementById('ceremony-action-btn');
    if (!btn) return;
    const label = btn.querySelector('.ceremony-action-btn__label');
    if (label) label.textContent = text;
    else btn.textContent = text;
}

function setCeremonyViewMode(mode) {
    const screen = document.getElementById('ceremony-screen');
    if (!screen) return;

    const prev = lastCeremonyViewMode;

    screen.classList.remove(
        'ceremony-view--intro',
        'ceremony-view--classes',
        'ceremony-view--transition',
        'ceremony-view--students',
        'ceremony-view--final',
        'ceremony-view--outro',
        'ceremony-theme-morph-active',
        'ceremony-theme-morph--to-violet',
        'ceremony-theme-morph--violet-lock'
    );
    screen.classList.add(`ceremony-view--${mode}`);

    const isTransitionFromLeagues = mode === 'transition' && prev === 'classes';
    const isHeroPhaseEntry = mode === 'students' && (prev === 'transition' || prev === 'classes');

    if (isTransitionFromLeagues) {
        screen.classList.add('ceremony-theme-morph-active', 'ceremony-theme-morph--to-violet');
    } else if (isHeroPhaseEntry) {
        screen.classList.add('ceremony-theme-morph-active', 'ceremony-theme-morph--violet-lock');
        setTimeout(() => {
            screen.classList.remove(
                'ceremony-theme-morph-active',
                'ceremony-theme-morph--to-violet',
                'ceremony-theme-morph--violet-lock'
            );
        }, 4500);
    }

    lastCeremonyViewMode = mode;

    const header = document.getElementById('ceremony-header');
    if (header) {
        header.classList.toggle('ceremony-header--hidden', mode === 'final');
        header.classList.toggle('ceremony-header--intro', mode === 'intro');
    }

    const actionBtn = document.getElementById('ceremony-action-btn');
    if (actionBtn) {
        actionBtn.classList.remove(
            'ceremony-action-btn--intro',
            'ceremony-action-btn--classes',
            'ceremony-action-btn--transition',
            'ceremony-action-btn--students',
            'ceremony-action-btn--final',
            'ceremony-action-btn--outro'
        );
        actionBtn.classList.add(`ceremony-action-btn--${mode}`);
    }
}

function resetCeremonyStage(stageEl) {
    const stage = stageEl || document.getElementById('ceremony-stage-area');
    const screen = document.getElementById('ceremony-screen');
    if (stage) {
        stage.classList.remove('ceremony-stage--podium', 'ceremony-stage--podium-duo');
    }
    if (screen) {
        screen.classList.remove('ceremony-phase-podium');
    }
}

function revealCeremonyChips(container, delayMs = 0) {
    if (!container) return;
    const blocks = container.querySelectorAll('.ceremony-chips-reveal--hidden');
    blocks.forEach((block, blockIndex) => {
        setTimeout(() => {
            block.classList.remove('ceremony-chips-reveal--hidden');
            block.classList.add('ceremony-chips-reveal--shown');
            block.querySelectorAll('.ceremony-chip').forEach((chip, chipIndex) => {
                chip.style.animationDelay = `${chipIndex * 0.07}s`;
            });
        }, delayMs + blockIndex * 90);
    });
}

function renderCeremonyIntroSplash(params) {
    const stage = document.getElementById('ceremony-stage-area');
    if (!stage) return;

    const classData = state.get('allSchoolClasses').find((c) => c.id === params.classId);
    const className = classData?.name || 'Your Class';
    const classLogo = classData?.logo || '📚';
    const leagueLabel = `League ${params.league}`;

    stage.innerHTML = `
        <div class="ceremony-intro-splash">
            <div class="ceremony-intro-splash__aurora" aria-hidden="true"></div>
            <div class="ceremony-intro-splash__spark ceremony-intro-splash__spark--a" aria-hidden="true"></div>
            <div class="ceremony-intro-splash__spark ceremony-intro-splash__spark--b" aria-hidden="true"></div>
            <div class="ceremony-intro-splash__ring" aria-hidden="true"></div>
            <div class="ceremony-intro-splash__emblem-wrap">
                <span class="ceremony-intro-splash__emblem">${classLogo}</span>
            </div>
            <p class="ceremony-intro-splash__kicker">Ceremony of the Month</p>
            <h1 class="ceremony-intro-splash__title font-title">${params.monthName}</h1>
            <p class="ceremony-intro-splash__brand">The Great Class Quest</p>
            <div class="ceremony-intro-splash__details">
                <span class="ceremony-intro-chip ceremony-intro-chip--amber"><i class="fas fa-route"></i>${leagueLabel}</span>
                <span class="ceremony-intro-chip ceremony-intro-chip--violet"><i class="fas fa-school"></i>${className}</span>
                <span class="ceremony-intro-chip ceremony-intro-chip--blend"><i class="fas fa-wand-magic-sparkles"></i>Team Quest → Hero's Challenge</span>
            </div>
            <p class="ceremony-intro-splash__tagline">League champions rise first — then your class heroes claim the spotlight.</p>
        </div>
    `;
}

function getCurrentStageCard() {
    const stage = document.getElementById('ceremony-stage-area');
    if (!stage) return null;
    return stage.querySelector('.ceremony-display-card:not(.face-off)');
}

function transitionStageCard(entry, type) {
    const stage = document.getElementById('ceremony-stage-area');
    if (!stage) return;

    resetCeremonyStage(stage);
    const outgoing = getCurrentStageCard();
    let didTransition = false;

    const renderIncoming = () => {
        if (didTransition) return;
        didTransition = true;
        stage.innerHTML = '';
        renderCard(entry, type);
        const incoming = getCurrentStageCard();
        if (incoming) {
            incoming.classList.add('ceremony-card-transition-in');
            setTimeout(() => revealCeremonyChips(incoming, 380), 120);
        }
    };

    if (!outgoing) {
        renderIncoming();
        return;
    }

    outgoing.classList.add('ceremony-card-transition-out');
    outgoing.addEventListener('animationend', renderIncoming, { once: true });
    setTimeout(renderIncoming, 520);
}

function triggerRevealFlash() {
    const screen = document.getElementById('ceremony-screen');
    if (!screen) return;

    const flash = document.createElement('div');
    flash.className = 'ceremony-reveal-flash';
    screen.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove(), { once: true });
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

    const now = new Date();
    const prevDate = new Date();
    prevDate.setMonth(now.getMonth() - 1);
    
    const monthKey = prevDate.toISOString().substring(0, 7); 

    const history = classData.ceremonyHistory || {};
    const isComplete = history[monthKey] && history[monthKey].complete;
    const currentMonthKey = now.toISOString().substring(0, 7);
    
    if (!isComplete && monthKey !== currentMonthKey && existedByMonthEnd(classData, monthKey)) {
        homeBtn.classList.add('ceremony-star-ring');
    }
}

export async function checkAndInitCeremony(classId) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classData) return null;

    const now = new Date();
    const prevDate = new Date();
    prevDate.setMonth(now.getMonth() - 1);
    
    const monthKey = prevDate.toISOString().substring(0, 7); 
    const monthName = prevDate.toLocaleString('en-GB', { month: 'long' });

    const history = classData.ceremonyHistory || {};
    if (history[monthKey] && history[monthKey].complete) {
        return null; 
    }

    if (monthKey === now.toISOString().substring(0, 7)) return null; 
    if (!existedByMonthEnd(classData, monthKey)) return null;

    return {
        monthKey,
        monthName,
        classId: classData.id,
        league: classData.questLevel
    };
}

export function startCeremony(params) {
    ceremonyData = {
        active: true,
        phase: 'intro',
        monthKey: params.monthKey,
        currentAppClassId: state.get('globalSelectedClassId'), // Identify who is watching
        monthName: params.monthName,
        classId: params.classId,
        league: params.league,
        classQueue: [],
        studentQueue: [],
        classPointer: 0,
        studentPointer: 0
    };

    const screen = document.getElementById('ceremony-screen');
    const title = document.getElementById('ceremony-title');
    const subtitle = document.getElementById('ceremony-subtitle');
    const actionBtn = document.getElementById('ceremony-action-btn');
    const stage = document.getElementById('ceremony-stage-area');
    const aiBox = document.getElementById('ceremony-ai-box');

    screen.classList.remove('hidden');
    screen.classList.remove(
        'ceremony-phase-suspense',
        'ceremony-phase-reveal',
        'ceremony-theme-morph-active',
        'ceremony-theme-morph--to-violet',
        'ceremony-theme-morph--violet-lock'
    );
    resetCeremonyStage(stage);
    aiBox.style.opacity = '0';
    lastCeremonyViewMode = 'intro';
    setCeremonyViewMode('intro');
    renderCeremonyIntroSplash(params);

    title.innerHTML = formatTitleHtml('');
    subtitle.innerHTML = formatTitleHtml('');
    setCeremonyActionLabel('Start Ceremony');
    actionBtn.onclick = loadDataAndAdvance;

    if (ceremonyMusic.loaded) {
        ceremonyMusic.volume.value = -12;
        ceremonyMusic.start();
    }

    setTimeout(() => playSound('ceremony_gling'), 420);

    aiBox.style.opacity = '1';
    document.getElementById('ceremony-ai-text').innerText = 'The scrolls are ready. The arena awaits...';
    triggerAICommentary('intro', { month: params.monthName });
}

// --- 2. DATA LOADING ---

async function loadDataAndAdvance() {
    const btn = document.getElementById('ceremony-action-btn');
    btn.disabled = true;
    setCeremonyActionLabel('Summoning Scrolls...');

    try {
        const [year, month] = ceremonyData.monthKey.split('-').map(Number);
        const { monthStart } = getCeremonyMonthBounds(ceremonyData.monthKey);
        const allStudents = state.get('allStudents') || [];
        
        // 1. Fetch Logs
        const logs = await fetchLogsForMonth(year, month);
        const { fetchMonthlyHistory } = await import('../state.js');
        const archived = await fetchMonthlyHistory(ceremonyData.monthKey).catch(() => ({}));
        const questHistorySnap = await getDocs(collection(db, 'artifacts/great-class-quest/public/data/quest_history'));
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

        let studentStats = studentsInClass.map(s => {
            const sLogs = logs.filter(l => l.studentId === s.id);
            const score = monthlyScores[s.id] || 0;
            let count3 = 0, count2 = 0;
            const reasons = new Set();
            const reasonCounts = {};
            sLogs.forEach(l => {
                const cred = getAwardLogMonthlyStarCredit(l);
                if (cred >= 3) count3++;
                else if (cred >= 2) count2++;
                if (l.reason) {
                    reasons.add(l.reason);
                    reasonCounts[l.reason] = (reasonCounts[l.reason] || 0) + cred;
                }
            });
            const topSkill = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

            const sScores = allWrittenScores.filter(sc => {
                if(sc.studentId !== s.id || !sc.date) return false;
                const d = utils.parseFlexibleDate(sc.date);
                return d && d.getMonth() === (month - 1) && d.getFullYear() === year;
            });
            let acadSum = 0;
            sScores.forEach(sc => {
                const normalized = getNormalizedPercentForScore(sc);
                if (Number.isFinite(normalized)) acadSum += normalized;
            });
            const academicAvg = sScores.length > 0 ? acadSum / sScores.length : 0;

            return {
                id: s.id,
                name: s.name,
                avatar: s.avatar,
                score,
                className: ceremonyClass?.name || '',
                classLogo: ceremonyClass?.logo || '📚',
                stats: { count3, count2, academicAvg, uniqueReasons: reasons.size, topSkill },
                teacherBoon: monthlyTeacherBoon?.studentId === s.id
                    ? { ...monthlyTeacherBoon, reasonText: formatTeacherBoonReason(monthlyTeacherBoon) }
                    : null
            };
        });

        studentStats.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.stats.count3 !== a.stats.count3) return b.stats.count3 - a.stats.count3;
            if (b.stats.count2 !== a.stats.count2) return b.stats.count2 - a.stats.count2;
            if (b.stats.uniqueReasons !== a.stats.uniqueReasons) return b.stats.uniqueReasons - a.stats.uniqueReasons;
            return b.stats.academicAvg - a.stats.academicAvg;
        });

        let sRank = 1;
        studentStats = studentStats.map((s, i) => {
            if (i > 0) {
                const prev = studentStats[i-1];
                let isTie = s.score === prev.score && 
                            s.stats.count3 === prev.stats.count3 && 
                            s.stats.count2 === prev.stats.count2 &&
                            s.stats.uniqueReasons === prev.stats.uniqueReasons;
                if (sRank > 3) isTie = isTie && (Math.abs(s.stats.academicAvg - prev.stats.academicAvg) < 0.1);
                if (!isTie) sRank = i + 1;
            }
            return { ...s, rank: sRank };
        });

        ceremonyData.studentQueue = studentStats.reverse();
        ceremonyData.phase = 'class_reveal';
        advanceCeremony();

    } catch (e) {
        console.error("Ceremony Load Error:", e);
        setCeremonyActionLabel('Error loading. Check connection.');
    }
}

// --- 3. THE "CONVEYOR BELT" ENGINE ---

function advanceCeremony() {
    const btn = document.getElementById('ceremony-action-btn');
    const stage = document.getElementById('ceremony-stage-area');
    const title = document.getElementById('ceremony-title');
    const aiBox = document.getElementById('ceremony-ai-box');
    const subtitle = document.getElementById('ceremony-subtitle');
    const screen = document.getElementById('ceremony-screen');

    btn.disabled = false;
    btn.onclick = advanceCeremony; 
    if (screen) {
        screen.classList.remove('ceremony-phase-suspense', 'ceremony-phase-reveal');
        if (ceremonyData.phase === 'class_showdown' || ceremonyData.phase === 'student_showdown') {
            screen.classList.add('ceremony-phase-suspense');
        }
    }

    // --- PHASE 1: CLASSES ---
    if (ceremonyData.phase === 'class_reveal') {
        setCeremonyViewMode('classes');
        const queue = ceremonyData.classQueue;
        
        if (!queue || queue.length === 0) {
            ceremonyData.phase = 'transition';
            advanceCeremony();
            return;
        }

        if (queue.length === 1) {
            transitionStageCard(queue[0], 'class');
            title.innerHTML = formatTitleHtml("The Champion");
            ceremonyData.phase = 'transition';
            setCeremonyActionLabel('See Student Heroes');
            return;
        }

        const pointer = ceremonyData.classPointer;

        if (pointer >= queue.length - 2) {
            setCeremonyViewMode('classes');
            ceremonyData.phase = 'class_showdown'; 
            const silver = queue[queue.length - 2];
            const gold = queue[queue.length - 1];
            setupShowdown(silver, gold, 'The Final Duel', 'Two legends remain...', 'class');
            setCeremonyActionLabel('🥁 Drumroll...');
            btn.onclick = handleDramaticReveal;
            return;
        }

        const entry = queue[pointer];
        transitionStageCard(entry, 'class');
        
        title.innerHTML = formatTitleHtml(`Rank #${entry.rank}`);
        subtitle.innerHTML = formatTitleHtml("Team Quest");
        aiBox.style.opacity = '1';
        
        triggerAICommentary('class_rank', { id: entry.id, name: entry.name, rank: entry.rank, score: entry.score, progress: formatPercent(entry.progress) });

        ceremonyData.classPointer++;
        setCeremonyActionLabel('Next');
    }

    // --- PHASE 1.5: CLASS SHOWDOWN DONE → HERO'S CHALLENGE SPLASH ---
    else if (ceremonyData.phase === 'class_showdown_done') {
        resetCeremonyStage(stage);
        ceremonyData.phase = 'transition';
        advanceCeremony();
    }

    // --- PHASE 2: TRANSITION (amber → violet morph begins here) ---
    else if (ceremonyData.phase === 'transition') {
        setCeremonyViewMode('transition');
        stopAllCeremonyAudio();
        setTimeout(() => { playCeremonyMusic(); }, 500);
        resetCeremonyStage(stage);
        stage.innerHTML = `
            <div class="ceremony-transition-panel ceremony-card-enter ceremony-transition-panel--morph">
                <div class="ceremony-transition-panel__orb"></div>
                <div class="ceremony-transition-panel__gold-glow" aria-hidden="true"></div>
                <div class="ceremony-transition-panel__violet-glow" aria-hidden="true"></div>
                <div class="ceremony-transition-panel__kicker">The torches turn inward</div>
                <i class="fas fa-user-astronaut ceremony-transition-panel__icon"></i>
                <h2 class="font-title ceremony-transition-panel__title">Hero's Challenge</h2>
                <p class="ceremony-transition-panel__text">The league banners fade to gold, then violet — as your class heroes step into the spotlight.</p>
            </div>
        `;
        title.innerHTML = formatTitleHtml('Individual Honors');
        subtitle.innerHTML = formatTitleHtml("Who went above and beyond?");
        aiBox.style.opacity = '0';
        triggerAICommentary('transition', {});

        setCeremonyActionLabel("Begin Hero's Challenge");
        ceremonyData.phase = 'student_reveal';
    }
        
    // --- PHASE 3: STUDENTS ---
    else if (ceremonyData.phase === 'student_reveal') {
        setCeremonyViewMode('students');
        const queue = ceremonyData.studentQueue;
        
        if (!queue || queue.length === 0) {
            ceremonyData.phase = 'final_leaderboard';
            advanceCeremony();
            return;
        }

        if (queue.length === 1) {
            transitionStageCard(queue[0], 'student');
            title.innerHTML = formatTitleHtml("Class Hero");
            ceremonyData.phase = 'final_leaderboard';
            setCeremonyActionLabel('See Full Results');
            return;
        }

        const pointer = ceremonyData.studentPointer;

        if (pointer >= queue.length - 2) {
            setCeremonyViewMode('students');
            ceremonyData.phase = 'student_showdown';
            const silver = queue[queue.length - 2];
            const gold = queue[queue.length - 1];
            setupShowdown(silver, gold, 'Top Heroes', 'Two legends remain...', 'student');
            setCeremonyActionLabel('Crown the Champion');
            btn.onclick = handleDramaticReveal;
            return;
        }

        const entry = queue[pointer];
        transitionStageCard(entry, 'student');
        
        let rankText = `#${entry.rank}`;
        if (entry.rank === 3) rankText = "🥉 Bronze";
        
        title.innerHTML = formatTitleHtml(`${rankText} Place`);
        subtitle.innerHTML = formatTitleHtml("Hero's Challenge");
        
        aiBox.style.opacity = '1';
        
        let winReason = "";
        if (pointer > 0) {
            const prevEntry = queue[pointer - 1];
            if (entry.score === prevEntry.score && entry.rank < prevEntry.rank) {
                if (entry.stats.count3 > prevEntry.stats.count3) winReason = "tie_3star";
                else if (entry.stats.count2 > prevEntry.stats.count2) winReason = "tie_2star";
                else if (entry.stats.academicAvg > prevEntry.stats.academicAvg) winReason = "tie_academic";
                else if (entry.stats.uniqueReasons > prevEntry.stats.uniqueReasons) winReason = "tie_variety";
            }
        }

        triggerAICommentary('student_rank', { 
            name: entry.name, 
            rank: entry.rank, 
            score: entry.score,
            tieReason: winReason 
        });

        ceremonyData.studentPointer++;
        setCeremonyActionLabel('Next');
    }

    // --- PHASE 3.5: STUDENT SHOWDOWN DONE ---
    else if (ceremonyData.phase === 'student_showdown_done') {
        resetCeremonyStage(stage);
        setCeremonyViewMode('final');
        ceremonyData.phase = 'final_leaderboard';
        advanceCeremony();
    }

    // --- PHASE 3.6: FINAL LEADERBOARD (NEW) ---
    else if (ceremonyData.phase === 'final_leaderboard') {
        resetCeremonyStage(stage);
        setCeremonyViewMode('final');
        stage.innerHTML = '';
        renderFinalLeaderboard();
        
        title.innerHTML = '';
        subtitle.innerHTML = '';
        aiBox.style.opacity = '0';
        
        setCeremonyActionLabel('Finish Ceremony');
        ceremonyData.phase = 'end';
    }

    // --- PHASE 4: END ---
    else if (ceremonyData.phase === 'end') {
        setCeremonyViewMode('outro');
        saveCeremonyComplete();
        
        stage.innerHTML = `
            <div class="text-center">
                <h2 class="font-title text-6xl text-white mb-4">Congratulations!</h2>
                <p class="text-2xl text-indigo-200">A new quest begins...</p>
                <div class="mt-8 text-8xl animate-bounce">🎓</div>
            </div>
        `;
        title.innerHTML = formatTitleHtml("Ceremony Complete");
        subtitle.innerHTML = formatTitleHtml("Until next time..."); 
        aiBox.style.opacity = '0';
        triggerAICommentary('outro', {});
        setCeremonyActionLabel('Close');
        btn.onclick = closeCeremony;
        
        triggerConfetti();
        triggerFireworks();
        if (winnerFanfare.loaded) winnerFanfare.start();
        if (screen) screen.classList.add('ceremony-phase-reveal');
    }
}

// --- 4. RENDERERS ---

function ceremonyChip(chipClass, content, title = '') {
    const titleAttr = title ? ` title="${title.replace(/"/g, '&quot;')}"` : '';
    return `<span class="ceremony-chip ${chipClass}"${titleAttr}>${content}</span>`;
}

function getCeremonyRankMeta(rank) {
    if (rank === 1) {
        return {
            cardClass: 'card-rank-1',
            extraClass: '',
            rankbarClass: 'ceremony-card-rankbar--gold',
            pillClass: 'ceremony-rank-badge__pill--gold',
            pillContent: '🥇 Gold'
        };
    }
    if (rank === 2) {
        return {
            cardClass: 'card-rank-2',
            extraClass: '',
            rankbarClass: 'ceremony-card-rankbar--silver',
            pillClass: 'ceremony-rank-badge__pill--silver',
            pillContent: '🥈 Silver'
        };
    }
    if (rank === 3) {
        return {
            cardClass: 'card-rank-3',
            extraClass: 'bronze-shine',
            rankbarClass: 'ceremony-card-rankbar--bronze',
            pillClass: 'ceremony-rank-badge__pill--bronze',
            pillContent: '🥉 Bronze'
        };
    }
    return {
        cardClass: 'card-rank-other',
        extraClass: '',
        rankbarClass: 'ceremony-card-rankbar--other',
        pillClass: 'ceremony-rank-badge__pill--other',
        pillContent: `#${rank}`
    };
}

function buildCeremonyRankbarHtml(rank) {
    const meta = getCeremonyRankMeta(rank);
    return `
        <div class="ceremony-card-rankbar ${meta.rankbarClass}">
            <span class="ceremony-rank-badge__pill ${meta.pillClass}">${meta.pillContent}</span>
            <span class="ceremony-card-rankbar__label">Rank #${rank}</span>
        </div>`;
}

function buildCeremonyKicker(type, mode = 'reveal') {
    const isStudent = type === 'student';
    if (mode === 'duel') {
        return {
            icon: isStudent ? 'fa-user-ninja' : 'fa-shield-halved',
            label: isStudent ? 'Hero Duel' : 'League Duel'
        };
    }
    return {
        icon: isStudent ? 'fa-user-shield' : 'fa-route',
        label: isStudent ? "Hero's Challenge" : 'Team Quest'
    };
}

function buildCeremonyClassChips(entry, { compact = false, hidden = false } = {}) {
    const chips = [];
    const lvl = Math.min(6, Math.max(1, entry.level || 1));
    const lvlStyle = CEREMONY_LEVEL_STYLES[lvl] || CEREMONY_LEVEL_STYLES[1];
    chips.push(ceremonyChip(
        lvlStyle.chip,
        `${lvlStyle.icon} ${compact ? `Lv ${lvl}` : lvlStyle.label}`,
        `Quest difficulty level ${lvl}`
    ));

    if (entry.zone) {
        const zoneChip = CEREMONY_ZONE_CHIPS[entry.zone.id] || CEREMONY_ZONE_CHIPS.bronze;
        chips.push(ceremonyChip(
            zoneChip,
            compact ? `${entry.zone.icon}` : `${entry.zone.icon} ${entry.zone.label}`,
            entry.zone.desc
        ));
    }

    if (!compact && entry.avgPerHero > 0) {
        chips.push(ceremonyChip(
            'ceremony-chip--avg',
            `<i class="fas fa-user-group"></i>${entry.avgPerHero.toFixed(1)} avg/hero`,
            'Average stars per hero'
        ));
    }

    if (entry.teamBonus > 0) {
        const isPathfinder = entry.teamBonus >= 10;
        chips.push(ceremonyChip(
            isPathfinder ? 'ceremony-chip--pathfinder' : 'ceremony-chip--bonus',
            isPathfinder
                ? `<i class="fas fa-map"></i>${compact ? `+${entry.teamBonus}` : `Pathfinder +${entry.teamBonus}`}`
                : `<i class="fas fa-people-group"></i>+${entry.teamBonus} team`,
            'Team Quest bonus stars'
        ));
    }

    if (entry.topSkill) {
        const info = CEREMONY_REASON_INFO[entry.topSkill] || { icon: 'fa-star', chip: 'ceremony-chip--neutral', name: 'Strength' };
        chips.push(ceremonyChip(
            info.chip,
            compact ? `<i class="fas ${info.icon}"></i> ${info.name}` : `<i class="fas ${info.icon}"></i> Top: ${info.name}`,
            'Top class strength this month'
        ));
    }

    if (!compact || chips.length < 3) {
        chips.push(ceremonyChip(
            'ceremony-chip--heroes',
            `<i class="fas fa-users"></i>${entry.studentCount}${compact ? '' : ' heroes'}`,
            'Heroes in this class'
        ));
    }

    const hiddenClass = hidden ? ' ceremony-chips-reveal--hidden' : '';
    return `<div class="ceremony-card-metrics${compact ? ' ceremony-card-metrics--compact' : ''}${hiddenClass}">${chips.join('')}</div>`;
}

function buildCeremonyStudentChips(entry, { compact = false, hidden = false } = {}) {
    const stats = entry.stats || {};
    const chips = [];

    if (stats.count3 > 0) {
        chips.push(ceremonyChip(
            'ceremony-chip--epic',
            `<i class="fas fa-bolt"></i>${stats.count3}${compact ? '' : ' × 3⭐'}`,
            'Epic lessons (3-star)'
        ));
    }
    if (stats.count2 > 0 && !compact) {
        chips.push(ceremonyChip(
            'ceremony-chip--strong',
            `<i class="fas fa-star-half-alt"></i>${stats.count2} × 2⭐`,
            'Strong lessons (2-star)'
        ));
    }
    if (stats.topSkill) {
        const info = CEREMONY_REASON_INFO[stats.topSkill] || { icon: 'fa-star', chip: 'ceremony-chip--neutral', name: 'Star' };
        chips.push(ceremonyChip(
            info.chip,
            `<i class="fas ${info.icon}"></i> ${info.name}`,
            'Top strength this month'
        ));
    }
    if (!compact && stats.uniqueReasons > 0) {
        chips.push(ceremonyChip(
            'ceremony-chip--variety',
            `<i class="fas fa-shapes"></i>${stats.uniqueReasons} strengths`,
            'Unique award reasons (tie-breaker)'
        ));
    }
    if (stats.academicAvg > 0) {
        chips.push(ceremonyChip(
            'ceremony-chip--scholar',
            `<i class="fas fa-graduation-cap"></i>${Math.round(stats.academicAvg)}% Scholar`,
            'Average written score this month'
        ));
    }
    if (compact && chips.length < 2 && stats.count2 > 0) {
        chips.push(ceremonyChip(
            'ceremony-chip--strong',
            `<i class="fas fa-star-half-alt"></i>${stats.count2}`,
            'Strong lessons (2-star)'
        ));
    }
    if (compact && chips.length < 2 && stats.uniqueReasons > 0) {
        chips.push(ceremonyChip(
            'ceremony-chip--variety',
            `<i class="fas fa-shapes"></i>${stats.uniqueReasons}`,
            'Unique strengths'
        ));
    }
    if (chips.length === 0) {
        chips.push(ceremonyChip(
            'ceremony-chip--neutral',
            `<i class="fas fa-star"></i>${entry.score} this month`,
            'Monthly stars'
        ));
    }

    const hiddenClass = hidden ? ' ceremony-chips-reveal--hidden' : '';
    return `<div class="ceremony-card-metrics${compact ? ' ceremony-card-metrics--compact' : ''}${hiddenClass}">${chips.join('')}</div>`;
}

function unwrapCeremonyChipRow(html) {
    return html.replace(/^<div class="ceremony-card-metrics[^"]*">/, '').replace(/<\/div>\s*$/, '');
}

function buildCeremonyClassScoreHeadline(entry) {
    return `
        <div class="ceremony-class-score-headline">
            <span class="ceremony-class-score-headline__value">${entry.score}</span>
            <span class="ceremony-class-score-headline__label">Stars Collected</span>
            <span class="ceremony-class-score-headline__heroes"><i class="fas fa-users"></i>${entry.studentCount} heroes</span>
        </div>`;
}

function buildCeremonyClassGoalPanel(entry, { hidden = false, compact = false } = {}) {
    const p = Math.min(100, Math.max(0, Number(entry.progress) || 0));
    const hiddenClass = hidden ? ' ceremony-chips-reveal--hidden' : '';
    const compactClass = compact ? ' ceremony-class-goal-panel--compact' : '';
    const fillBronze = Math.min(p, 30) / 30 * 100;
    const fillSilver = Math.min(Math.max(p - 30, 0), 30) / 30 * 100;
    const fillGold = Math.min(Math.max(p - 60, 0), 25) / 25 * 100;
    const fillCrystal = Math.min(Math.max(p - 85, 0), 15) / 15 * 100;
    const zone = entry.zone;
    const zoneLabel = zone?.label || 'Quest Path';
    const zoneIcon = zone?.icon || '🌿';
    const markerHtml = compact
        ? ''
        : `<div class="ceremony-quest-trail__marker" style="left:${Math.min(p, 100)}%"></div>`;
    const stagesHtml = compact
        ? ''
        : '<span class="ceremony-class-goal-panel__stages">🌿 🏔️ 🏰 💎</span>';

    return `
        <div class="ceremony-class-goal-panel${compactClass}${hiddenClass}">
            <div class="ceremony-class-goal-panel__header">
                <span class="ceremony-class-goal-panel__zone">${zoneIcon} ${zoneLabel}</span>
                <span class="ceremony-class-goal-panel__pct">${formatPercent(p)}%</span>
            </div>
            <div class="ceremony-quest-trail" aria-label="Quest goal progress ${formatPercent(p)} percent">
                <div class="ceremony-quest-trail__track">
                    <div class="ceremony-quest-trail__seg ceremony-quest-trail__seg--bronze">
                        <div class="ceremony-quest-trail__fill" style="width:${fillBronze}%"></div>
                    </div>
                    <div class="ceremony-quest-trail__seg ceremony-quest-trail__seg--silver">
                        <div class="ceremony-quest-trail__fill" style="width:${fillSilver}%"></div>
                    </div>
                    <div class="ceremony-quest-trail__seg ceremony-quest-trail__seg--gold">
                        <div class="ceremony-quest-trail__fill" style="width:${fillGold}%"></div>
                    </div>
                    <div class="ceremony-quest-trail__seg ceremony-quest-trail__seg--crystal">
                        <div class="ceremony-quest-trail__fill" style="width:${fillCrystal}%"></div>
                    </div>
                </div>
                ${markerHtml}
            </div>
            <div class="ceremony-class-goal-panel__meta">
                <span>${entry.score} / ${entry.goal || 0} goal</span>
                ${stagesHtml}
            </div>
        </div>`;
}

function buildCeremonyStudentClassStrip(entry) {
    if (!entry.className) return '';
    return `
        <div class="ceremony-card-class-strip">
            <span class="ceremony-card-class-strip__emoji" aria-hidden="true">${entry.classLogo || '📚'}</span>
            <span class="ceremony-card-class-strip__name">${entry.className}</span>
        </div>`;
}

function renderCard(entry, type) {
    const stage = document.getElementById('ceremony-stage-area');
    const isStudent = type === 'student';
    const kicker = buildCeremonyKicker(type, 'reveal');
    const rankMeta = getCeremonyRankMeta(entry.rank);
    const rankBadgeHtml = buildCeremonyRankbarHtml(entry.rank);

    // --- Avatar / logo ---
    const avatarBorderColor = entry.rank === 1 ? '#F59E0B' : entry.rank === 2 ? '#94a3b8' : entry.rank === 3 ? '#cd7f32' : '#818cf8';
    const imageHtml = isStudent
        ? (entry.avatar
            ? `<img src="${entry.avatar}" class="w-40 h-40 rounded-full object-cover mx-auto mb-4" style="border: 4px solid ${avatarBorderColor}; box-shadow: 0 0 18px ${avatarBorderColor}66;">`
            : `<div class="w-40 h-40 rounded-full flex items-center justify-center text-7xl font-bold mx-auto mb-4" style="background: linear-gradient(135deg,#6366f1,#8b5cf6); border: 4px solid ${avatarBorderColor}; box-shadow: 0 0 18px ${avatarBorderColor}66; color:white;">${entry.name.charAt(0)}</div>`)
        : `<div class="text-8xl mb-4 filter drop-shadow-lg">${entry.logo}</div>`;

    const subText = isStudent
        ? `<span class="font-title text-3xl" style="color:#d97706;">${entry.score} ⭐</span>`
        : buildCeremonyClassScoreHeadline(entry);
    const detailChips = isStudent
        ? buildCeremonyStudentChips(entry, { hidden: true })
        : `${buildCeremonyClassChips(entry, { hidden: true })}${buildCeremonyClassGoalPanel(entry, { hidden: true, compact: true })}`;
    const teacherBoonHtml = isStudent ? getTeacherBoonCeremonyMarkup(entry.teacherBoon) : '';
    // Check if this card belongs to the class currently using the app
    const isMyClass = !isStudent && entry.id === ceremonyData.currentAppClassId;
    const myClassBadge = isMyClass
        ? `<span class="ceremony-my-class-badge">YOU</span>`
        : '';
    const card = document.createElement('div');
    card.className = `ceremony-display-card ceremony-display-card--${type} ${rankMeta.cardClass} ${rankMeta.extraClass}`;
    card.style.position = 'relative';
    card.innerHTML = `
        <div class="ceremony-card-aura"></div>
        ${rankBadgeHtml}
        <div class="ceremony-card-shell">
            ${myClassBadge}
            <div class="ceremony-card-kicker"><i class="fas ${kicker.icon}"></i>${kicker.label}</div>
            ${isStudent ? buildCeremonyStudentClassStrip(entry) : ''}
            ${imageHtml}
            <h3 class="font-title ceremony-card-name text-gray-800">${entry.name}</h3>
            <div class="mt-2">${subText}</div>
            ${detailChips}
            ${teacherBoonHtml}
        </div>
    `;

    stage.appendChild(card);
    playSound(entry.rank <= 3 ? 'star2' : 'click');
}

function getShowdownBronzeEntry(entryType) {
    const queue = entryType === 'student' ? ceremonyData.studentQueue : ceremonyData.classQueue;
    if (!queue || queue.length < 3) return null;
    const bronze = queue[queue.length - 3];
    return bronze?.rank === 3 ? bronze : null;
}

function setupShowdown(silverEntry, goldEntry, titleText, subText, entryType) {
    const stage = document.getElementById('ceremony-stage-area');
    const title = document.getElementById('ceremony-title');
    const subtitle = document.getElementById('ceremony-subtitle');
    const aiBox = document.getElementById('ceremony-ai-box');

    ceremonyData.showdownContext = {
        entryType,
        bronze: getShowdownBronzeEntry(entryType)
    };

    title.innerHTML = formatTitleHtml(titleText);
    subtitle.innerHTML = formatTitleHtml(subText);
    subtitle.style.opacity = '1';
    aiBox.style.opacity = '1'; 

    resetCeremonyStage(stage);
    stage.innerHTML = '';

    const spotlight = document.createElement('div');
    spotlight.className = 'absolute inset-0 bg-radial-gradient-spotlight pointer-events-none animate-pulse-slow';
    stage.appendChild(spotlight);

    const leftCard = createFaceOff(silverEntry, silverEntry.rank, 'left', entryType);
    const rightCard = createFaceOff(goldEntry, goldEntry.rank, 'right', entryType);
    
    const vsBadge = document.createElement('div');
    vsBadge.id = 'ceremony-vs-badge';
    vsBadge.className = 'ceremony-countdown-ring';
    vsBadge.innerHTML = `
        <span class="ceremony-countdown-ring__halo"></span>
        <span class="ceremony-countdown-ring__number">VS</span>
        <span class="ceremony-countdown-ring__label">Final Duel</span>
    `;

    stage.appendChild(leftCard);
    stage.appendChild(vsBadge);
    stage.appendChild(rightCard);

    triggerAICommentary('showdown_build', { name1: silverEntry.name, name2: goldEntry.name });

    stopAllCeremonyAudio(); 
    if (showdownSting.loaded) {
        showdownSting.volume.value = -5;
        showdownSting.start();
    }
}

function createFaceOff(entry, realRank, position, entryType) {
    if (!entry) return document.createElement('div');

    const div = document.createElement('div');
    // Pick a rank card class: gold for #1 finalist, silver for #2 finalist (revealed later)
    const rankCardClass = realRank === 1 ? 'card-rank-1' : 'card-rank-2';
    div.className = `ceremony-display-card ceremony-card ceremony-display-card--${entryType} face-off face-off--duel ${rankCardClass} relative`;

    div.id = `showdown-card-${position}`;
    div.dataset.rank = realRank;
    div.dataset.name = entry.name;
    div.dataset.score = entry.score;
    div.dataset.id = entry.id;
    div.dataset.teacherBoonReason = entry.teacherBoon?.reasonText || '';

    const isStudent = entryType === 'student';

    // Avatar border tinted per rank (greyed during face-off, pops on reveal via CSS)
    const imageHtml = !isStudent
        ? `<div class="text-8xl mb-4 filter drop-shadow-lg">${entry.logo}</div>`
        : (entry.avatar
            ? `<img src="${entry.avatar}" class="w-40 h-40 rounded-full border-4 border-gray-300 mx-auto mb-4 object-cover shadow-inner">`
            : `<div class="w-40 h-40 rounded-full bg-gray-200 flex items-center justify-center text-7xl text-gray-500 font-bold mx-auto mb-4 border-4 border-gray-300 shadow-inner">${entry.name.charAt(0)}</div>`);

    const scoreDisplay = isStudent
        ? `<span class="font-title text-2xl" style="color:#d97706;">${entry.score} ⭐</span>`
        : buildCeremonyClassScoreHeadline(entry);
    const faceOffKicker = buildCeremonyKicker(entryType, 'duel');
    const faceOffMetrics = isStudent
        ? buildCeremonyStudentChips(entry, { compact: true, hidden: true })
        : buildCeremonyClassChips(entry, { compact: true, hidden: true });
    const faceOffGoalPanel = !isStudent
        ? buildCeremonyClassGoalPanel(entry, { hidden: true, compact: true })
        : '';
    const teacherBoonWrapped = isStudent && entry.teacherBoon
        ? `<div class="ceremony-teacher-boon-reveal ceremony-teacher-boon-reveal--hidden">${getTeacherBoonCeremonyMarkup(entry.teacherBoon, { compact: true })}</div>`
        : '';

    div.innerHTML = `
        <div class="ceremony-card-aura"></div>
        <div class="rank-badge ceremony-card-rankbar ceremony-card-rankbar--faceoff ${realRank === 1 ? 'ceremony-card-rankbar--gold' : 'ceremony-card-rankbar--silver'}">
            <span class="ceremony-rank-badge__pill ${realRank === 1 ? 'ceremony-rank-badge__pill--gold' : 'ceremony-rank-badge__pill--silver'}">${realRank === 1 ? '🥇 Gold' : '🥈 Silver'}</span>
            <span class="ceremony-card-rankbar__label">Rank #${realRank}</span>
        </div>
        <div class="ceremony-card-shell">
            <div class="ceremony-card-kicker"><i class="fas ${faceOffKicker.icon}"></i>${faceOffKicker.label}</div>
            ${isStudent ? buildCeremonyStudentClassStrip(entry) : ''}
            ${imageHtml}
            <h3 class="font-title ceremony-card-name ceremony-card-name--faceoff text-gray-700">${entry.name}</h3>
            <div class="star-count opacity-0 transition-all duration-500">
                ${scoreDisplay}
            </div>
            ${faceOffMetrics}
            ${faceOffGoalPanel}
            ${teacherBoonWrapped}
        </div>
    `;
    return div;
}

function createPodiumCard(entry, entryType) {
    const card = createFaceOff(entry, entry.rank, 'bronze', entryType);
    card.id = 'showdown-card-bronze';
    card.classList.remove('face-off', 'card-rank-2');
    card.classList.add('card-rank-3', 'bronze-shine', 'revealed-bronze', 'ceremony-podium-card');

    const rankbar = card.querySelector('.ceremony-card-rankbar');
    if (rankbar) {
        rankbar.classList.remove('ceremony-card-rankbar--silver', 'ceremony-card-rankbar--gold');
        rankbar.classList.add('ceremony-card-rankbar--bronze');
        const pill = rankbar.querySelector('.ceremony-rank-badge__pill');
        if (pill) {
            pill.className = 'ceremony-rank-badge__pill ceremony-rank-badge__pill--bronze';
            pill.textContent = '🥉 Bronze';
        }
    }

    const badge = card.querySelector('.rank-badge');
    const scoreEl = card.querySelector('.star-count');
    if (badge) badge.classList.remove('opacity-0');
    if (scoreEl) {
        scoreEl.classList.remove('opacity-0');
        scoreEl.classList.add('opacity-100');
    }

    return card;
}

function insertPodiumSteps(stage, hasBronze) {
    if (stage.querySelector('.ceremony-podium-steps')) return;

    const steps = document.createElement('div');
    steps.className = `ceremony-podium-steps${hasBronze ? '' : ' ceremony-podium-steps--duo'}`;
    steps.innerHTML = `
        <div class="ceremony-podium-step ceremony-podium-step--2"></div>
        <div class="ceremony-podium-step ceremony-podium-step--1"></div>
        ${hasBronze ? '<div class="ceremony-podium-step ceremony-podium-step--3"></div>' : ''}
    `;
    stage.appendChild(steps);
}

function animateShowdownPodium(cardLeft, cardRight, isTie) {
    const stage = document.getElementById('ceremony-stage-area');
    const ctx = ceremonyData.showdownContext || {};
    if (!stage || !cardLeft || !cardRight) return;

    const rankLeft = parseInt(cardLeft.dataset.rank, 10);
    const rankRight = parseInt(cardRight.dataset.rank, 10);
    const winnerCard = rankLeft === 1 ? cardLeft : (rankRight === 1 ? cardRight : cardRight);
    const secondCard = winnerCard === cardLeft ? cardRight : cardLeft;
    const hasBronze = Boolean(ctx.bronze) && !isTie;

    const screen = document.getElementById('ceremony-screen');
    if (screen) screen.classList.add('ceremony-phase-podium');

    stage.classList.add('ceremony-stage--podium');
    if (!hasBronze) stage.classList.add('ceremony-stage--podium-duo');
    insertPodiumSteps(stage, hasBronze);

    [cardLeft, cardRight].forEach((card) => {
        card.classList.remove(
            'converge-left',
            'converge-right',
            'tension-active',
            'face-off',
            'ceremony-duel-reveal'
        );
        void card.offsetWidth;
    });

    if (isTie) {
        cardLeft.classList.add('ceremony-podium-tie-left', 'revealed-gold', 'ceremony-winner');
        cardRight.classList.add('ceremony-podium-tie-right', 'revealed-gold', 'ceremony-winner');
        return;
    }

    winnerCard.classList.add('ceremony-podium-first');
    secondCard.classList.add('ceremony-podium-second');

    if (!hasBronze) return;

    setTimeout(() => {
        const bronzeCard = createPodiumCard(ctx.bronze, ctx.entryType);
        bronzeCard.classList.add('ceremony-podium-third');
        stage.appendChild(bronzeCard);

        const bronzeStep = stage.querySelector('.ceremony-podium-step--3');
        if (bronzeStep) bronzeStep.classList.add('ceremony-podium-step--visible');

        setTimeout(() => revealCeremonyChips(bronzeCard, 200), 400);
        playSound('star2');
    }, 1350);
}

function handleDramaticReveal() {
    const btn = document.getElementById('ceremony-action-btn');
    const title = document.getElementById('ceremony-title');
    const subtitle = document.getElementById('ceremony-subtitle');
    const cards = document.querySelectorAll('.ceremony-card.face-off');
    const screen = document.getElementById('ceremony-screen');
    
    btn.disabled = true;
    if (screen) {
        screen.classList.remove('ceremony-phase-suspense');
        screen.classList.add('ceremony-phase-reveal');
    }

    stopAllCeremonyAudio();
    playDrumRoll();

    cards.forEach(card => card.classList.add('tension-active'));
    const finishedClassShowdown = ceremonyData.phase === 'class_showdown';
    const countdownRing = document.getElementById('ceremony-vs-badge');
    const countdownNumber = countdownRing?.querySelector('.ceremony-countdown-ring__number');
    const countdownLabel = countdownRing?.querySelector('.ceremony-countdown-ring__label');

    if (countdownLabel) countdownLabel.textContent = 'Get ready...';

    [3, 2, 1].forEach((count, index) => {
        setTimeout(() => {
            if (countdownRing) {
                countdownRing.classList.remove('is-tick');
                countdownRing.dataset.count = String(count);
            }
            if (countdownNumber) countdownNumber.textContent = String(count);
            if (countdownLabel) countdownLabel.textContent = 'Revealing...';
            if (countdownRing) {
                void countdownRing.offsetWidth;
                countdownRing.classList.add('is-tick');
            }
        }, index * 760);
    });

    setTimeout(() => {
        stopDrumRoll();
        triggerRevealFlash();

        if (screen) {
            screen.classList.add('ceremony-phase-reveal-burst');
            setTimeout(() => screen.classList.remove('ceremony-phase-reveal-burst'), 1400);
        }
        
        if(subtitle) {
            subtitle.style.opacity = '0'; 
            setTimeout(() => subtitle.innerHTML = '', 500);
        }

        const vsBadge = document.getElementById('ceremony-vs-badge');
        if (vsBadge) {
            vsBadge.classList.add('fade-out-fast');
            setTimeout(() => vsBadge.remove(), 500);
        }
        
        let winners = [];
        const cardLeft = document.getElementById('showdown-card-left');
        const cardRight = document.getElementById('showdown-card-right');

        const rankLeft = parseInt(cardLeft?.dataset.rank);
        const rankRight = parseInt(cardRight?.dataset.rank);
        const isTie = rankLeft === rankRight && rankLeft === 1;

        if (cardLeft) {
            cardLeft.classList.remove('tension-active', 'face-off');
            cardLeft.classList.add('converge-left', 'ceremony-duel-reveal');
        }
        if (cardRight) {
            cardRight.classList.remove('tension-active', 'face-off');
            cardRight.classList.add('converge-right', 'ceremony-duel-reveal');
        }

        [cardLeft, cardRight].forEach(card => {
            if(!card) return;
            
            const badge = card.querySelector('.rank-badge');
            const scoreEl = card.querySelector('.star-count');
            
            if(badge) badge.classList.remove('opacity-0');
            if(scoreEl) {
                scoreEl.classList.remove('opacity-0');
                scoreEl.classList.add('opacity-100', 'ceremony-score-reveal-pop');
            }

            const boonReveal = card.querySelector('.ceremony-teacher-boon-reveal');
            if (boonReveal) {
                boonReveal.classList.remove('ceremony-teacher-boon-reveal--hidden');
            }

            setTimeout(() => revealCeremonyChips(card, 0), 480);

            const r = parseInt(card.dataset.rank);
            if (r === 1) {
                card.classList.add('revealed-gold', 'ceremony-winner', 'ceremony-winner-spectacular');
                winners.push(card.dataset.name);
                
                setTimeout(() => {
                    triggerFireworks();
                    triggerFireworks();
                    triggerConfetti();
                }, 120);
                setTimeout(() => {
                    triggerFireworks();
                    triggerConfetti();
                }, 520);
            } else {
                card.classList.add('revealed-silver');
            }
        });

        playWinnerFanfare();

        if (isTie) {
            title.innerHTML = formatTitleHtml("It's a Draw! 🤝");
            triggerAICommentary('tie', { names: winners.join(' & '), score: cardRight.dataset.score });
        } else {
            title.innerHTML = formatTitleHtml("Champion Crowned!");
            const phaseType = ceremonyData.phase === 'class_showdown' ? 'class_winner' : 'student_winner';
            triggerAICommentary(phaseType, { id: cardRight.dataset.id, name: cardRight.dataset.name, score: cardRight.dataset.score });
        }

        if (finishedClassShowdown) {
            ceremonyData.phase = 'class_showdown_done'; 
        } else {
            ceremonyData.phase = 'student_showdown_done'; 
        }

        setTimeout(() => {
            animateShowdownPodium(cardLeft, cardRight, isTie);
        }, PODIUM_REVEAL_DELAY_MS);

        btn.disabled = false;
        setCeremonyActionLabel(
            finishedClassShowdown ? 'Conclude Team Quest Awards' : 'Show Final Standings'
        );
        btn.onclick = advanceCeremony; 

    }, 2520);
}

// --- NEW FUNCTION: RENDER FINAL LEADERBOARD ---
function renderFinalLeaderboard() {
    const stage = document.getElementById('ceremony-stage-area');
    
    const container = document.createElement('div');
    container.className = 'ceremony-leaderboard-container';
    
    const queue = ceremonyData.studentQueue.slice().reverse();

    function buildItemHtml(s, animIndex) {
        const rank = s.rank;
        let rankBarClass = 'ceremony-lb-rankbar--other';
        let badgePillClass = 'ceremony-rank-badge__pill--other';
        let badgeContent = `#${rank}`;
        let itemExtraClass = '';

        if (rank === 1) {
            rankBarClass = 'ceremony-lb-rankbar--gold';
            badgePillClass = 'ceremony-rank-badge__pill--gold';
            badgeContent = '🥇 Gold';
            itemExtraClass = 'rank-top3-gold';
        } else if (rank === 2) {
            rankBarClass = 'ceremony-lb-rankbar--silver';
            badgePillClass = 'ceremony-rank-badge__pill--silver';
            badgeContent = '🥈 Silver';
            itemExtraClass = 'rank-top3-silver';
        } else if (rank === 3) {
            rankBarClass = 'ceremony-lb-rankbar--bronze';
            badgePillClass = 'ceremony-rank-badge__pill--bronze';
            badgeContent = '🥉 Bronze';
            itemExtraClass = 'rank-top3-bronze';
        }

        const avatarBorder = rank === 1 ? '#F59E0B' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7f32' : '#818cf8';
        const avatarHtml = s.avatar
            ? `<img src="${s.avatar}" class="cli-avatar" style="border-color:${avatarBorder}; box-shadow: 0 0 14px ${avatarBorder}55;">`
            : `<div class="cli-avatar cli-avatar--fallback" style="border-color:${avatarBorder}; box-shadow: 0 0 14px ${avatarBorder}55;">${s.name.charAt(0)}</div>`;

        const showDelayedBoon = (rank === 1 || rank === 2) && s.teacherBoon;
        const boonRowHtml = showDelayedBoon
            ? `<div class="ceremony-leaderboard-boon-row ceremony-teacher-boon-reveal ceremony-teacher-boon-reveal--hidden">${getTeacherBoonCeremonyMarkup(s.teacherBoon, { compact: true })}</div>`
            : '';

        return `
            <div class="ceremony-leaderboard-item ${itemExtraClass}" style="animation-delay: ${animIndex * 0.1}s">
                <div class="ceremony-lb-rankbar ${rankBarClass}">
                    <span class="ceremony-rank-badge__pill ${badgePillClass}">${badgeContent}</span>
                    <span class="ceremony-lb-rankbar__label">Rank #${rank}</span>
                </div>
                <div class="ceremony-lb-body">
                    ${avatarHtml}
                    <div class="cli-info">
                        <div class="cli-name">${s.name}</div>
                        <div class="cli-stats ceremony-lb-chips">
                            ${unwrapCeremonyChipRow(buildCeremonyStudentChips(s, { compact: true }))}
                        </div>
                    </div>
                    <div class="cli-stars">${s.score} ⭐</div>
                </div>
                ${boonRowHtml}
            </div>
        `;
    }

    const top3 = queue.filter(s => s.rank <= 3);
    const rest  = queue.filter(s => s.rank > 3);

    let html = `
        <div class="ceremony-leaderboard-header">
            <div class="ceremony-leaderboard-header__glow"></div>
            <span class="ceremony-leaderboard-title">🏆 Final Standings</span>
            <div class="ceremony-leaderboard-title__sub">${ceremonyData.monthName} · Month of Glory</div>
        </div>
        <div class="ceremony-leaderboard-scroll custom-scrollbar">
            <div class="ceremony-leaderboard-list">
    `;

    if (top3.length > 0) {
        html += `<div class="ceremony-leaderboard-top3">`;
        top3.forEach((s, i) => { html += buildItemHtml(s, i); });
        html += `</div>`;
    }

    if (rest.length > 0) {
        if (top3.length > 0) html += `<div class="ceremony-leaderboard-divider"></div>`;
        rest.forEach((s, i) => { html += buildItemHtml(s, i + top3.length); });
    }

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;
    stage.appendChild(container);

    queue.forEach((s, index) => {
        if (!((s.rank === 1 || s.rank === 2) && s.teacherBoon)) return;
        const allItems = container.querySelectorAll('.ceremony-leaderboard-item');
        const item = allItems[index];
        const boonRow = item?.querySelector('.ceremony-leaderboard-boon-row');
        if (!boonRow) return;
        setTimeout(() => {
            boonRow.classList.remove('ceremony-teacher-boon-reveal--hidden');
        }, index * 100 + 350);
    });
    
    triggerConfetti(); 
}

// --- 5. HELPERS ---

async function saveCeremonyComplete() {
    const classId = ceremonyData.classId;
    const monthKey = ceremonyData.monthKey;
    try {
        const classRef = doc(db, `artifacts/great-class-quest/public/data/classes`, classId);
        await updateDoc(classRef, {
            [`ceremonyHistory.${monthKey}.complete`]: true,
            [`ceremonyHistory.${monthKey}.watchedAt`]: new Date()
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

function closeCeremony() {
    const screen = document.getElementById('ceremony-screen');
    screen.classList.add('hidden');
    screen.classList.remove('ceremony-phase-suspense', 'ceremony-phase-reveal');
    stopAllCeremonyAudio();
    import('../features/home.js').then(m => m.renderHomeTab());
}

function triggerConfetti() {
    const container = document.getElementById('ceremony-confetti-container');
    container.innerHTML = '';
    const colors = ['#fcd34d', '#f87171', '#60a5fa', '#a78bfa', '#34d399'];
    for(let i=0; i<150; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        el.style.left = Math.random() * 100 + '%';
        el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        el.style.animationDuration = (Math.random() * 2 + 2) + 's';
        el.style.animationDelay = (Math.random() * 2) + 's';
        container.appendChild(el);
    }
}

// Firework Generator
function triggerFireworks() {
    const container = document.getElementById('ceremony-confetti-container');
    for(let i=0; i<5; i++) {
        setTimeout(() => {
            const x = 20 + Math.random() * 60; 
            const y = 20 + Math.random() * 40; 
            
            const firework = document.createElement('div');
            firework.className = 'firework';
            firework.style.left = x + '%';
            firework.style.top = y + '%';
            container.appendChild(firework);
            
            setTimeout(() => firework.remove(), 1000);
        }, i * 300);
    }
}

// --- AI COMMENTARY ---
let aiDebounce = null;

async function triggerAICommentary(phase, data) {
    if (aiDebounce) clearTimeout(aiDebounce);

    const aiBox = document.getElementById('ceremony-ai-box');
    const aiText = document.getElementById('ceremony-ai-text');

    aiDebounce = setTimeout(async () => {
        aiBox.style.opacity = '0.5'; 

        // 1. Determine Tone based on League (Age Group)
        const league = ceremonyData.league || 'A'; // Default to A if missing
        let toneInstruction = "";
        
        if (league.includes('Junior')) {
            // Young Kids (7-9): Simple, high energy, magical
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
        else if (phase === 'student_winner') userPrompt = `Announce ${data.name} is the PRODIGY of the Month!`;
        else if (phase === 'outro') userPrompt = "Sign off with energy. See you next month.";
        else if (phase === 'showdown_build') userPrompt = `It's down to ${data.name1} vs ${data.name2}. The tension is maximum! Build extreme suspense but DO NOT announce the winner yet.`;
        else if (phase === 'tie') userPrompt = `UNBELIEVABLE! It's a Tie! Double winners!`;

        const genericByPhase = {
            intro: `Welcome to the ${data.month} Ceremony!`,
            class_rank: `Rank #${data.rank} — ${data.name}!`,
            class_winner: `${data.name} wins! You did it!`,
            transition: 'Who will be our Prodigy?',
            student_rank: `Shout out to ${data.name}!`,
            student_winner: `${data.name} is the PRODIGY of the Month!`,
            outro: 'See you next month!',
            showdown_build: `${data.name1} vs ${data.name2} — the final showdown!`,
            tie: 'Unbelievable — double winners!'
        };
        const genericMessage = genericByPhase[phase] || 'Congratulations to our heroes!';

        try {
            if (canUseFeature('eliteAI')) {
                const commentary = await callGeminiApi(systemPrompt, userPrompt);
                aiBox.style.opacity = '0';
                setTimeout(() => {
                    aiText.innerText = commentary;
                    aiBox.style.opacity = '1';
                }, 300);
            } else {
                aiText.innerText = genericMessage;
                aiBox.style.opacity = '1';
            }
        } catch (e) {
            console.error("AI Error", e);
            aiText.innerText = genericMessage;
            aiBox.style.opacity = '1';
        }
    }, 250); 
}
