// /ui/tabs/leaderboard.js
import * as state from '../../state.js';
import { getLeaderboardEffectiveLeague } from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import * as modals from '../modals.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { getGuildLeaderboardData, getGuildChampionsForMonth } from '../../features/guildScoring.js';
import { getGuildById, getGuildEmblemUrl } from '../../features/guilds.js';
import { getHeroTitle, HERO_SKILL_TREE } from '../../features/heroSkillTree.js';
import { renderFamiliarSprite } from '../../features/familiars.js';
import { getEggAlertState } from '../../features/familiarProgression.mjs';
import { wrapAvatarWithLevelUpIndicator } from '../core/avatar.js';
import { canUseFeature } from '../../utils/subscription.js';
import { getNormalizedPercentForScore } from '../../features/assessmentConfig.js';
import { generateLeagueMapHtml, QUEST_MAP_ZONES } from '../../features/worldMap.js';
import {
    getAwardLogMonthlyStarCredit,
    mergeMonthlyStarsFromArchivedHistoryAndAwardLogs,
    sumMonthlyStarCreditsByStudentFromAwardLogs
} from '../../features/awardLogReasonMeta.js';

// --- REIGNING PRODIGY CACHE ---
// Fetches previous month's award logs once per session (cached by monthKey).
// Returns { [classId]: Set<studentId> } — a Set to support co-prodigies (ties).
let _prodigyCacheKey = null;
let _prodigyCache = {}; // classId -> Set of winner studentIds

async function getReigningProdigies() {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const cacheKey = `${prevMonth.getFullYear()}-${prevMonth.getMonth()}`;

    if (_prodigyCacheKey === cacheKey) return _prodigyCache; // Already fetched this month

    try {
        const { fetchLogsForMonth } = await import('../../db/queries.js');
        const { fetchMonthlyHistory } = await import('../../state.js');

        const monthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
        const logs = await fetchLogsForMonth(prevMonth.getFullYear(), prevMonth.getMonth() + 1);
        const archived = await fetchMonthlyHistory(monthKey).catch(() => ({}));
        const allScores = state.get('allWrittenScores') || [];

        // Group logs by class
        const logsByClass = {};
        logs.forEach(l => {
            if (!l.classId) return;
            if (!logsByClass[l.classId]) logsByClass[l.classId] = [];
            logsByClass[l.classId].push(l);
        });

        const result = {};
        const vm = prevMonth.getMonth();
        const vy = prevMonth.getFullYear();

        Object.entries(logsByClass).forEach(([classId, classLogs]) => {
            const students = state.get('allStudents').filter(s => s.classId === classId);
            const fromLogsTotals = sumMonthlyStarCreditsByStudentFromAwardLogs(classLogs);
            const mergedTotals = mergeMonthlyStarsFromArchivedHistoryAndAwardLogs(fromLogsTotals, archived || {});

            // Compute per-student stats using same algorithm as renderProdigyHistory
            const studentStats = students.map(s => {
                const sLogs = classLogs.filter(l => l.studentId === s.id);
                const monthlyStars = Number(mergedTotals[s.id]) || 0;
                let count3 = 0, count2 = 0;
                const reasons = new Set();
                sLogs.forEach(l => {
                    const cred = getAwardLogMonthlyStarCredit(l);
                    if (cred >= 3) count3++;
                    else if (cred >= 2) count2++;
                    if (l.reason) reasons.add(l.reason);
                });
                const sScores = allScores.filter(sc => {
                    const scDate = utils.parseFlexibleDate(sc.date);
                    return sc.studentId === s.id && scDate && scDate.getMonth() === vm && scDate.getFullYear() === vy;
                });
                let acadSum = 0;
                sScores.forEach(sc => {
                    const normalized = getNormalizedPercentForScore(sc);
                    if (Number.isFinite(normalized)) acadSum += normalized;
                });
                const academicAvg = sScores.length > 0 ? acadSum / sScores.length : 0;
                return { id: s.id, monthlyStars, count3, count2, uniqueReasons: reasons.size, academicAvg };
            }).filter(s => s.monthlyStars > 0);

            if (studentStats.length === 0) return;

            // Sort: same order as renderProdigyHistory
            studentStats.sort((a, b) => {
                if (b.monthlyStars !== a.monthlyStars) return b.monthlyStars - a.monthlyStars;
                if (b.count3 !== a.count3) return b.count3 - a.count3;
                if (b.count2 !== a.count2) return b.count2 - a.count2;
                if (b.uniqueReasons !== a.uniqueReasons) return b.uniqueReasons - a.uniqueReasons;
                return b.academicAvg - a.academicAvg;
            });

            const top = studentStats[0];
            // Collect all tied winners (co-prodigies)
            const winners = studentStats.filter(s =>
                s.monthlyStars === top.monthlyStars &&
                s.count3 === top.count3 &&
                s.count2 === top.count2 &&
                s.uniqueReasons === top.uniqueReasons
            );

            result[classId] = new Set(winners.map(w => w.id));
        });

        _prodigyCacheKey = cacheKey;
        _prodigyCache = result;
    } catch (e) {
        console.warn('Could not load reigning prodigies:', e);
    }
    return _prodigyCache;
}

function syncHeroChallengeFabs() {
    const enable = Boolean(state.get('globalSelectedClassId'));
    const prodigyBtn = document.getElementById('open-prodigy-btn');
    const trophyBtn = document.getElementById('open-trophy-room-btn');
    if (prodigyBtn) prodigyBtn.disabled = !enable;
    if (trophyBtn) trophyBtn.disabled = !enable;
}

// --- TAB CONTENT RENDERERS ---

export async function renderClassLeaderboardTab() {
    const list = document.getElementById('class-leaderboard-list');
    if (!list) return;

    // Update the month name in the title
    const monthNameEl = document.getElementById('quest-month-name');
    if (monthNameEl) {
        const monthName = new Date().toLocaleString('en-US', { month: 'long' });
        monthNameEl.textContent = monthName;
    }

    const league = getLeaderboardEffectiveLeague();
    if (!league) {
        list.innerHTML = `<div class="max-w-xl mx-auto"><p class="text-center text-gray-700 bg-white/50 p-6 rounded-2xl text-lg">Please select a league to view the Team Quest map.</p></div>`;
        return;
    }

    const classesInLeague = state.get('allSchoolClasses').filter(c => c.questLevel === league);

    if (classesInLeague.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-700 bg-white/50 p-4 rounded-2xl text-lg">No classes in this quest league... yet!</p>`;
        return;
    }

    // Yield so the UI can paint (e.g. league picker closing) before heavy string/DOM work.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // --- CALCULATIONS ---
    const allStudentScores = state.get('allStudentScores') || [];
    const allStudents = state.get('allStudents') || [];
    const allAwardLogs = state.get('allAwardLogs') || [];
    const allAdventureLogs = state.get('allAdventureLogs') || [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const scoresByStudentId = new Map(allStudentScores.map(sc => [sc.id, sc]));

    const studentsByClassId = new Map();
    for (const s of allStudents) {
        if (!s.classId) continue;
        let bucket = studentsByClassId.get(s.classId);
        if (!bucket) {
            bucket = [];
            studentsByClassId.set(s.classId, bucket);
        }
        bucket.push(s);
    }

    const awardLogsByClassId = new Map();
    const weeklyStarsByClassId = new Map();
    for (const log of allAwardLogs) {
        if (!log.classId) continue;
        let bucket = awardLogsByClassId.get(log.classId);
        if (!bucket) {
            bucket = [];
            awardLogsByClassId.set(log.classId, bucket);
        }
        bucket.push(log);

        const logDate = utils.parseDDMMYYYY(log.date);
        if (logDate && logDate >= startOfWeek) {
            weeklyStarsByClassId.set(
                log.classId,
                (weeklyStarsByClassId.get(log.classId) || 0) + getAwardLogMonthlyStarCredit(log)
            );
        }
    }

    const adventureCountByClassId = new Map();
    for (const l of allAdventureLogs) {
        if (!l.classId) continue;
        const advDate = utils.parseDDMMYYYY(l.date);
        if (!advDate || advDate.getMonth() !== currentMonth) continue;
        adventureCountByClassId.set(l.classId, (adventureCountByClassId.get(l.classId) || 0) + 1);
    }

    const classScores = classesInLeague.map(c => {
        const studentsInClass = studentsByClassId.get(c.id) || [];
        const studentCount = studentsInClass.length;

        const goalValue = utils.calculateMonthlyClassGoal(
            c,
            studentCount,
            state.get('schoolHolidayRanges'),
            state.get('allScheduleOverrides')
        );

        const goals = { diamond: goalValue };

        const dbDifficulty = c.difficultyLevel || 0;
        let isCompletedThisMonth = false;
        let goalDifference = 0;

        if (studentCount > 0) {
            if (c.questCompletedAt) {
                const completedDate = typeof c.questCompletedAt.toDate === 'function' ? c.questCompletedAt.toDate() : new Date(c.questCompletedAt);
                if (completedDate.getMonth() === now.getMonth() && completedDate.getFullYear() === now.getFullYear()) {
                    isCompletedThisMonth = true;
                }
            }
            const effectiveDiff = isCompletedThisMonth ? Math.max(0, dbDifficulty - 1) : dbDifficulty;
            const originalGoalTotal = Math.round(studentCount * (18 + (effectiveDiff * 2.5)));
            goalDifference = goalValue - originalGoalTotal;
        }

        const { totalStars: teamQuestStars, classBonus: classTeamBonus } = utils.getClassMonthlyQuestStars(
            c,
            studentsInClass,
            allStudentScores,
            now,
            scoresByStudentId
        );

        const classLogs = awardLogsByClassId.get(c.id) || [];
        const weeklyStars = weeklyStarsByClassId.get(c.id) || 0;

        const totalGold = studentsInClass.reduce((sum, s) => {
            const scoreData = scoresByStudentId.get(s.id);
            const gold = scoreData && scoreData.gold !== undefined ? scoreData.gold : (scoreData?.totalStars || 0);
            return sum + (Number(gold) || 0);
        }, 0);

        const adventureCount = adventureCountByClassId.get(c.id) || 0;

        const topHeroes = studentsInClass
            .map(s => {
                const scoreData = scoresByStudentId.get(s.id);
                return {
                    name: s.name,
                    avatar: s.avatar,
                    stars: scoreData ? (Number(scoreData.monthlyStars) || 0) : 0
                };
            })
            .sort((a, b) => b.stars - a.stars)
            .slice(0, 3);

        const hasPathfinder = classTeamBonus >= 10;

        const reasons = {};
        classLogs.forEach(l => {
            if (l.reason) {
                reasons[l.reason] = (reasons[l.reason] || 0) + getAwardLogMonthlyStarCredit(l);
            }
        });
        const topSkill = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

        let progress = goals.diamond > 0 ? (teamQuestStars / goals.diamond) * 100 : 0;
        // Removed: Don't force progress to 100% - show actual progress for accuracy

        return {
            ...c,
            studentCount,
            goals,
            goalDifference,
            currentMonthlyStars: teamQuestStars,
            classQuestBonus: classTeamBonus,
            weeklyStars,
            totalGold,
            adventureCount,
            topHeroes,
            hasPathfinder,
            topSkill,
            progress,
            difficulty: dbDifficulty
        };
    }).sort((a, b) => b.progress - a.progress);

    // Removed: quest update button no longer exists

    const mapHtml = generateLeagueMapHtml(classScores);

    // --- RENDER ANALYTICS CARDS ---
    const cardsHtml = classScores.map((c, index) => {
        const rank = index + 1;

        // 1. EXACT LEVELS (1-6) - NO NAMES - HOVER INFO
        const diff = (c.difficulty || 0) + 1;
        let diffBadge = "";
        let factor = 1.0 + (c.difficulty * 0.1); // Fake factor calculation for display

        // Define style based on level 1-6
        const lvlStyles = {
            1: { color: "bg-teal-100 text-teal-800 border-teal-200", icon: "🌱" },
            2: { color: "bg-cyan-100 text-cyan-800 border-cyan-200", icon: "💧" },
            3: { color: "bg-blue-100 text-blue-800 border-blue-200", icon: "🛡️" },
            4: { color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: "🔮" },
            5: { color: "bg-orange-100 text-orange-800 border-orange-200", icon: "🔥" },
            6: { color: "bg-rose-100 text-rose-800 border-rose-200", icon: "🐉" }
        };
        const style = lvlStyles[diff] || lvlStyles[1];

        // Badge with JS-based hover for simplicity/reliability
        diffBadge = `
        <div class="relative inline-block" 
             onmouseenter="this.querySelector('.lvl-tooltip').classList.remove('opacity-0', 'pointer-events-none')"
             onmouseleave="this.querySelector('.lvl-tooltip').classList.add('opacity-0', 'pointer-events-none')">
            <span class="${style.color} px-3 py-1 rounded-md text-xs font-bold border shadow-sm cursor-help">
                ${style.icon} Level ${diff}
            </span>
            <div class="lvl-tooltip absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-32 bg-gray-900 text-white text-[10px] p-2 rounded shadow-lg opacity-0 pointer-events-none transition-opacity z-50 text-center">
                Difficulty Factor: <strong>${factor.toFixed(1)}x</strong><br>
                <span class="text-gray-400 italic">Stars needed per student increases.</span>
            </div>
        </div>`;

        // 2. Goal Adjustment Icon (Umbrella/Calendar)
        // Only visible if there IS a difference. Tooltip logic attached strictly to the Icon.
        let goalIconHtml = "";
        if (c.goalDifference !== 0) {
            const isReduction = c.goalDifference < 0;
            const sign = isReduction ? "" : "+"; // Negative number already has sign
            const colorClass = isReduction ? "text-orange-500" : "text-green-500";
            const icon = isReduction ? "fa-umbrella-beach" : "fa-calendar-plus";

            goalIconHtml = `
            <div class="relative inline-block ml-2" 
                 onmouseenter="this.querySelector('.goal-tooltip').classList.remove('opacity-0', 'pointer-events-none')" 
                 onmouseleave="this.querySelector('.goal-tooltip').classList.add('opacity-0', 'pointer-events-none')">
                <i class="fas ${icon} ${colorClass} text-sm cursor-help animate-pulse"></i>
                <div class="goal-tooltip absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-40 bg-gray-900 text-white text-[10px] p-2 rounded shadow-lg opacity-0 pointer-events-none transition-opacity z-50 text-center leading-tight">
                    Goal adjusted by <span class="font-bold ${isReduction ? 'text-orange-300' : 'text-green-300'} text-xs">${sign}${c.goalDifference} stars</span> due to holidays/events.
                </div>
            </div>`;
        }

        const skillIcons = { teamwork: 'users', creativity: 'lightbulb', respect: 'hand-holding-heart', focus: 'brain', scholar_s_bonus: 'scroll', welcome_back: 'door-open', teacher_boon: 'wand-magic-sparkles' };
        const skillName = c.topSkill.replace(/_/g, ' ');

        const avgStars = c.studentCount > 0 ? (c.currentMonthlyStars / c.studentCount).toFixed(1) : 0;
        const weeklyGrowth = c.weeklyStars > 0 ? "Trending Up 🚀" : "Steady Path ⚓";
        const spiritRank = c.adventureCount > 3 ? "Legendary ✨" : (c.adventureCount > 1 ? "Active 🌟" : "Quiet 🍃");

        let cardRankClass = "team-quest-card-refreshed--rank-other";
        let rankEmblemClass = "rank-emblem-wrap--other";
        let rankEmblemInner = `#${rank}`;
        let headerColor = "bg-gray-50 border-b border-gray-200";

        if (rank === 1) { 
            headerColor = "bg-gradient-to-r from-amber-50 to-orange-50/50 border-b border-amber-100"; 
            cardRankClass = "team-quest-card-refreshed--rank-1";
            rankEmblemClass = "rank-emblem-wrap--1";
            rankEmblemInner = "🥇";
        }
        else if (rank === 2) { 
            headerColor = "bg-gradient-to-r from-slate-50 to-gray-50/50 border-b border-slate-100"; 
            cardRankClass = "team-quest-card-refreshed--rank-2";
            rankEmblemClass = "rank-emblem-wrap--2";
            rankEmblemInner = "🥈";
        }
        else if (rank === 3) { 
            headerColor = "bg-gradient-to-r from-orange-50 to-amber-50/50 border-b border-orange-100"; 
            cardRankClass = "team-quest-card-refreshed--rank-3";
            rankEmblemClass = "rank-emblem-wrap--3";
            rankEmblemInner = "🥉";
        }

        let rankBadge = `<span class="rank-emblem-wrap ${rankEmblemClass}">${rankEmblemInner}</span>`;

        // Multi-Stage Progress Bar Styled as an Adventure Trail Path
        const p = c.progress;
        const fillBronze = Math.min(p, 30) / 30 * 100;
        const fillSilver = Math.min(Math.max(p - 30, 0), 30) / 30 * 100;
        const fillGold = Math.min(Math.max(p - 60, 0), 25) / 25 * 100;
        const fillCrystal = Math.min(Math.max(p - 85, 0), 15) / 15 * 100;

        const nodeBronzeClass = p >= 30 ? "quest-stage-node--active-bronze" : "";
        const nodeSilverClass = p >= 60 ? "quest-stage-node--active-silver" : "";
        const nodeGoldClass = p >= 85 ? "quest-stage-node--active-gold" : "";
        const nodeCrystalClass = p >= 100 ? "quest-stage-node--active-crystal" : "";

        // Current zone derived from QUEST_MAP_ZONES thresholds
        const currentZone = QUEST_MAP_ZONES.reduce((cur, z) => (p >= z.minPercent ? z : cur), QUEST_MAP_ZONES[0]);

        const multiStageBar = `
            <div class="relative w-full select-none" style="height: 3.25rem;">
                <!-- Seamless multi-segment track -->
                <div class="flex items-stretch w-full h-6 absolute rounded-full overflow-hidden shadow-inner border border-slate-200/60" style="top: 8px; background: #e9ecef;">
                    <div class="quest-trail-segment--bronze h-full relative overflow-hidden" style="flex: 30;" title="🌿 Bronze Meadows (0–30%)">
                        <div class="quest-trail-segment--bronze-fill h-full" style="width: ${fillBronze}%"></div>
                    </div>
                    <div class="quest-trail-segment--silver h-full relative overflow-hidden" style="flex: 30;" title="🏔️ Silver Peaks (30–60%)">
                        <div class="quest-trail-segment--silver-fill h-full" style="width: ${fillSilver}%"></div>
                    </div>
                    <div class="quest-trail-segment--gold h-full relative overflow-hidden" style="flex: 25;" title="🏰 Golden Citadel (60–85%)">
                        <div class="quest-trail-segment--gold-fill h-full" style="width: ${fillGold}%"></div>
                    </div>
                    <div class="quest-trail-segment--crystal h-full relative overflow-hidden" style="flex: 15;" title="💎 Crystal Realm (85–100%)">
                        <div class="quest-trail-segment--crystal-fill h-full" style="width: ${fillCrystal}%"></div>
                    </div>
                </div>
                
                <!-- Stage Checkpoints / Nodes -->
                <div class="quest-stage-node ${nodeBronzeClass}" style="left: 30%;" title="🌿 Bronze Meadows threshold"></div>
                <div class="quest-stage-node ${nodeSilverClass}" style="left: 60%;" title="🏔️ Silver Peaks threshold"></div>
                <div class="quest-stage-node ${nodeGoldClass}" style="left: 85%;" title="🏰 Golden Citadel threshold"></div>
                <div class="quest-stage-node ${nodeCrystalClass}" style="left: 99.5%;" title="💎 Crystal Realm — Summit"></div>
                
                <!-- Position marker -->
                <div class="quest-trail-marker-pin" style="left: ${Math.min(p, 100)}%;">
                    <div class="quest-trail-marker-ripple"></div>
                    <div class="quest-trail-marker-icon font-bold animate-none" title="Class Position: ${p.toFixed(0)}%">
                        <i class="fas fa-map-marker-alt"></i>
                    </div>
                </div>
            </div>
            
            <!-- Stage labels aligned to segment proportional widths (30/30/25/15) -->
            <div class="flex items-start mt-1.5 px-0.5" style="gap: 0;">
                <div class="text-center" style="flex: 30;">
                    <span class="text-[9px] font-black uppercase tracking-wider" style="color: #A0724A;">🌿 Bronze</span>
                </div>
                <div class="text-center" style="flex: 30;">
                    <span class="text-[9px] font-black uppercase tracking-wider" style="color: #6B7A8A;">🏔️ Silver</span>
                </div>
                <div class="text-center" style="flex: 25;">
                    <span class="text-[9px] font-black uppercase tracking-wider" style="color: #B45309;">🏰 Gold</span>
                </div>
                <div class="text-center" style="flex: 15;">
                    <span class="text-[9px] font-black uppercase tracking-wider" style="color: #7C3AED;">💎 Crystal</span>
                </div>
            </div>
        `;

        const starsFormatted = Number(c.currentMonthlyStars) % 1 !== 0 ? c.currentMonthlyStars.toFixed(1) : c.currentMonthlyStars.toFixed(0);
        const weeklyFormatted = Number(c.weeklyStars) % 1 !== 0 ? c.weeklyStars.toFixed(1) : c.weeklyStars.toFixed(0);

        const topHeroesHtml = c.topHeroes.length > 0 ?
            c.topHeroes.map(h => `
                <div class="flex flex-col items-center" title="${h.name}: ${h.stars} Stars">
                    <div class="w-8 h-8 rounded-full border border-gray-200 overflow-hidden shadow-sm">
                        ${h.avatar ? `<img src="${h.avatar}" class="w-full h-full object-cover">` : `<div class="w-full h-full bg-indigo-100 flex items-center justify-center text-indigo-500 font-bold text-xs">${h.name[0]}</div>`}
                    </div>
                </div>
            `).join('') : '<span class="text-xs text-gray-400 italic">No heroes yet</span>';

        return `
        <div class="tab-mount-rise" style="--tab-rise-delay: ${Math.min(index * 55, 800)}ms">
        <div class="team-quest-card-refreshed ${cardRankClass} group pop-in">
            <div class="${headerColor} p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2.5 shrink-0">
                        ${rankBadge}
                        <div class="quest-logo-container text-4xl md:text-5xl filter drop-shadow-md transition-transform group-hover:scale-110 group-hover:rotate-6">${c.logo}</div>
                    </div>
                    <div>
                        <h4 class="font-title text-3xl text-indigo-900 leading-tight">${c.name}</h4>
                        <div class="flex flex-wrap gap-2 mt-2 items-center">
                            ${diffBadge}
                            <span class="text-[10px] font-black bg-white text-indigo-600 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest shadow-sm"><i class="fas fa-users mr-1"></i>${c.studentCount} Heroes</span>
                        </div>
                    </div>
                </div>
                <div class="quest-status-crystal flex items-center gap-6">
                    <div class="text-center px-2 border-r border-indigo-100">
                        <div class="font-title text-4xl text-indigo-600 leading-none filter drop-shadow-sm">${starsFormatted}</div>
                        <div class="text-[9px] font-black text-indigo-400 uppercase mt-1 tracking-wider">Stars Collected</div>
                    </div>
                    <div class="text-center px-2">
                        <div class="font-title text-4xl text-amber-500 leading-none filter drop-shadow-sm">${avgStars}</div>
                        <div class="text-[9px] font-black text-amber-500 uppercase mt-1 tracking-wider">Avg / Hero</div>
                    </div>
                </div>
            </div>
            <div class="p-6 bg-gradient-to-b from-transparent to-indigo-50/30">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="space-y-4">
                        <div class="bg-white p-4 rounded-3xl border quest-progress-section" style="border-color: rgba(226,232,240,0.9); box-shadow: 0 2px 10px rgba(99,102,241,0.05), inset 0 1px 0 rgba(255,255,255,0.9);">
                            <div class="flex justify-between items-center mb-2 px-1">
                                <span class="text-xs font-black text-indigo-900 uppercase tracking-widest">League Progress</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-[10px] font-black px-2 py-0.5 rounded-full" style="background: rgba(99,102,241,0.07); color: #4338ca;">${currentZone.icon} ${currentZone.label}</span>
                                    <span class="font-title text-xl text-indigo-600">${c.progress.toFixed(0)}%</span>
                                </div>
                            </div>
                            
                            ${multiStageBar}
                            
                            <div class="text-center mt-2 flex items-center justify-center gap-2">
                                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">Target: ${c.goals.diamond} Stars</p>
                                ${goalIconHtml}
                            </div>
                        </div>
                        <div class="champions-vanguard-banner p-4 flex items-center justify-between">
                            <span class="text-[11px] font-black text-indigo-100 uppercase tracking-widest ml-2 italic flex items-center gap-1.5">
                                <i class="fas fa-crown text-amber-300 animate-pulse"></i> Leading the Charge
                            </span>
                            <div class="flex -space-x-2.5 pr-2 champions-vanguard-avatars">${topHeroesHtml}</div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <!-- Weekly Growth / Fire Rune -->
                        <div class="stat-rune-card stat-rune-card--fire px-3 pt-3 pb-3">
                            <div class="text-[9px] font-black text-orange-400 uppercase tracking-widest w-full text-center">${weeklyGrowth}</div>
                            <i class="fas fa-fire stat-rune-card__icon text-orange-500"></i>
                            <div class="font-title text-lg text-slate-800 leading-tight">+${weeklyFormatted}</div>
                        </div>
                        
                        <!-- Top Talent / Magic Rune -->
                        <div class="stat-rune-card stat-rune-card--magic px-3 pt-3 pb-3">
                            <div class="text-[9px] font-black text-blue-400 uppercase tracking-widest w-full text-center">Top Talent</div>
                            <i class="fas fa-magic stat-rune-card__icon text-blue-500"></i>
                            <div class="font-bold text-slate-800 text-sm truncate w-full capitalize leading-none text-center" title="${skillName}">${skillName}</div>
                        </div>
                        
                        <!-- Bank of Class / Gold Rune -->
                        <div class="stat-rune-card stat-rune-card--gold px-3 pt-3 pb-3">
                            <div class="text-[9px] font-black text-yellow-600 uppercase tracking-widest w-full text-center truncate">Bank of ${c.name}</div>
                            <i class="fas fa-coins stat-rune-card__icon text-yellow-500"></i>
                            <div class="font-title text-lg text-slate-800 leading-tight">${c.totalGold}</div>
                        </div>
                        
                        <!-- Class Spirit / Heart Rune -->
                        <div class="stat-rune-card stat-rune-card--heart px-3 pt-3 pb-3">
                            <div class="text-[9px] font-black text-green-500 uppercase tracking-widest w-full text-center">Class Spirit</div>
                            <i class="fas fa-heart stat-rune-card__icon text-green-500"></i>
                            <div class="font-bold text-slate-800 text-sm capitalize leading-none">${spiritRank}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </div>`;
    }).join('');

    // --- RENDER CONTAINER + STICKY BUTTON ---
    list.innerHTML = `
        <div class="mb-8 animate-fade-in">${mapHtml}</div>
        <div id="league-standings-container" class="max-w-5xl mx-auto hidden transition-all duration-500 opacity-0 transform translate-y-4 relative">
            <div class="flex items-center gap-4 mb-4">
                <h3 class="font-title text-2xl text-indigo-900">Mission Analytics</h3>
                <div class="h-1 flex-grow bg-indigo-50 rounded-full"></div>
            </div>
            
            <div class="grid grid-cols-1 gap-4">${cardsHtml}</div>
        </div>
        
        <button id="sticky-show-map-btn" 
                class="fixed bottom-24 right-6 bg-indigo-600 text-white shadow-2xl rounded-full w-14 h-14 flex items-center justify-center font-bold z-50 transform translate-y-32 opacity-0 transition-all duration-500 hover:scale-110 hover:bg-indigo-700 hover:shadow-indigo-500/50 bubbly-button" 
                title="Back to Map">
            <i class="fas fa-map text-xl"></i>
        </button>
    `;

    // --- ANIMATION TRIGGER ---
    setTimeout(() => {
        const avatars = list.querySelectorAll('.league-map-avatar');
        avatars.forEach(av => {
            av.style.left = av.dataset.finalLeft;
            av.style.top = av.dataset.finalTop;
        });
    }, 100);

    const toggleBtn = document.getElementById('toggle-map-list-btn');
    const container = document.getElementById('league-standings-container');
    const stickyBtn = document.getElementById('sticky-show-map-btn');

    if (toggleBtn && container) {
        // Main Toggle Button Logic
        toggleBtn.onclick = () => {
            // FIX: Always act as "Open/Go To" when clicked. 
            // Do not toggle closed, because the sticky button handles closing.

            container.classList.remove('hidden');
            requestAnimationFrame(() => {
                container.classList.remove('opacity-0', 'translate-y-4');
            });

            // 1. Hide the original Analysis button
            toggleBtn.classList.add('opacity-0', 'pointer-events-none');

            // 2. Show the sticky button immediately
            if (stickyBtn) stickyBtn.classList.remove('translate-y-32', 'opacity-0');

            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        // Sticky Button Logic
        if (stickyBtn) {
            stickyBtn.onclick = () => hideAnalytics();

            // Watch the map to automatically toggle buttons when scrolling
            const mapArea = list.querySelector('.team-quest-map-parchment') || list.querySelector('.league-map-wrapper') || list.firstElementChild;

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    // If map comes back into view (User scrolled to top)
                    if (entry.isIntersecting) {
                        toggleBtn.classList.remove('opacity-0', 'pointer-events-none'); // Show Analysis
                        stickyBtn.classList.add('translate-y-32', 'opacity-0');       // Hide Pin
                    } else {
                        // Map is gone (User scrolled down) -> Ensure Pin is shown if Analytics is open
                        if (!container.classList.contains('hidden')) {
                            toggleBtn.classList.add('opacity-0', 'pointer-events-none');
                            stickyBtn.classList.remove('translate-y-32', 'opacity-0');
                        }
                    }
                });
            }, { threshold: 0.1 }); // Trigger when 10% of the map is visible

            if (mapArea) observer.observe(mapArea);
        }

        function hideAnalytics() {
            // CLOSE ANALYTICS
            container.classList.add('opacity-0', 'translate-y-4');
            setTimeout(() => container.classList.add('hidden'), 300);

            // 1. Restore the original Analysis button
            toggleBtn.classList.remove('opacity-0', 'pointer-events-none');

            // 2. Hide the sticky button
            if (stickyBtn) stickyBtn.classList.add('translate-y-32', 'opacity-0');

            // Scroll back to Map smoothly
            list.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    list.querySelectorAll('.zone-trigger').forEach(zone => {
        zone.addEventListener('click', (e) => {
            const zoneType = e.currentTarget.dataset.zone;
            import('../modals.js').then(m => m.openZoneOverviewModal(zoneType));
        });
    });
}

export async function renderStudentLeaderboardTab() {
    const list = document.getElementById('student-leaderboard-list');
    if (!list) return;

    syncHeroChallengeFabs();

    const heroProgressionEnabled = canUseFeature('heroProgression');

    // Match Team Quest: always refresh ribbon month (static HTML placeholder e.g. "February"
    // would otherwise survive until after a league is chosen).
    const heroMonthNameEl = document.getElementById('hero-month-name');
    if (heroMonthNameEl) {
        const monthName = new Date().toLocaleString('en-US', { month: 'long' });
        heroMonthNameEl.textContent = monthName;
    }

    const league = getLeaderboardEffectiveLeague();
    if (!league) {
        list.innerHTML = `<div class="max-w-xl mx-auto"><p class="text-center text-gray-700 bg-white/50 p-6 rounded-2xl text-lg">Please select a league to view the leaderboard.</p></div>`;
        return;
    }

    const classesInLeague = state.get('allSchoolClasses').filter(c => c.questLevel === league);
    if (classesInLeague.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-700 bg-white/50 p-4 rounded-2xl text-lg">No classes in this quest league... yet!</p>`;
        return;
    }

    // --- DATA PREPARATION ---
    const allLogs = state.get('allAwardLogs');
    const allScores = state.get('allWrittenScores');
    const allStudents = state.get('allStudents') || [];
    const allStudentScores = state.get('allStudentScores') || [];
    const persistedGuildChampions = state.get('guildChampions') || {};
    const computedGuildChampions = getGuildChampionsForMonth(allStudents, allStudentScores);
    const guildChampions = { ...computedGuildChampions, ...persistedGuildChampions };
    const topHeroByGuild = {};
    getGuildLeaderboardData().forEach((guildRow) => {
        const topHero = guildRow.topContributors?.[0];
        if (topHero?.studentId) {
            topHeroByGuild[guildRow.guildId] = topHero.studentId;
        }
    });

    // 1. HELPER: Calculate Stats & Tie-Breakers
    // 1. HELPER: Calculate Stats & Tie-Breakers
    const getStudentStats = (studentId) => {
        const studentLogs = allLogs.filter(log => log.studentId === studentId);
        const studentScores = allScores.filter(s => s.studentId === studentId);

        const now = new Date();
        const currentMonthIndex = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlyLogs = studentLogs.filter(log => {
            const logDate = utils.parseDDMMYYYY(log.date);
            return logDate.getMonth() === currentMonthIndex &&
                logDate.getFullYear() === currentYear &&
                log.reason !== 'pathfinder_bonus';
        });

        // A. Weekly Stars (Monday to Friday)
        const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Calculate days to go back to Monday
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - daysToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        const weeklyStars = studentLogs
            .filter(log => utils.parseDDMMYYYY(log.date) >= startOfWeek)
            .reduce((sum, log) => sum + getAwardLogMonthlyStarCredit(log), 0);

        // B. 3-Star Streak Calculation (Consecutive lessons with 3+ stars)
        // We exclude small bonuses like 'welcome_back' so they don't break the streak
        const streakLogs = studentLogs
            .filter(l => !['welcome_back', 'scholar_s_bonus', 'story_weaver'].includes(l.reason))
            .sort((a, b) => utils.parseDDMMYYYY(b.date) - utils.parseDDMMYYYY(a.date)); // Newest first

        let streak = 0;
        for (const log of streakLogs) {
            if (getAwardLogMonthlyStarCredit(log) >= 3) {
                streak++;
            } else {
                break; // Streak ends if a main lesson wasn't 3 stars
            }
        }

        // C. Top Reason of the Month
        const reasonCounts = {};
        let count3Star = 0; // Total 3-stars (kept for tie-breaking)
        let count2Star = 0;

        monthlyLogs.forEach(log => {
            const cred = getAwardLogMonthlyStarCredit(log);
            if (log.reason) {
                if (!reasonCounts[log.reason]) reasonCounts[log.reason] = 0;
                reasonCounts[log.reason] += cred;
            }
            if (cred >= 3) count3Star++;
            else if (cred >= 2) count2Star++;
        });

        // Sort reasons by highest star count
        const topReasonEntry = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
        const topSkill = topReasonEntry ? topReasonEntry[0] : null;

        // D. Academic Avg
            let acadSum = 0;
            let acadCount = 0;
            studentScores.forEach(s => {
            if (!s.date) return;
            const sDate = utils.parseFlexibleDate(s.date);
            if (!sDate || (sDate.getMonth() !== currentMonthIndex || sDate.getFullYear() !== currentYear)) return;
            {
                const val = getNormalizedPercentForScore(s) || 0;
                if (val > 0) { acadSum += val; acadCount++; }
            }
        });
        const academicAvg = acadCount > 0 ? (acadSum / acadCount) : 0;

        // Use the centralized helper for the tie-breaker specific stats
        const tieBreakerStats = utils.calculateStudentStats(studentId, monthlyLogs, studentScores.filter(s => {
            if (!s.date) return false;
            const sDate = utils.parseFlexibleDate(s.date);
            return sDate && sDate.getMonth() === currentMonthIndex && sDate.getFullYear() === currentYear;
        }));

        return {
            weeklyStars, topSkill, streak,
            academicAvg,
            ...tieBreakerStats // Brings in count3, count2, uniqueReasons, and recalculates academicAvg strictly for tie-breaking
        };
    };

    let studentsInLeague = allStudents
        .filter(s => classesInLeague.some(c => c.id === s.classId))
        .map(s => {
            const studentClass = state.get('allSchoolClasses').find(c => c.id === s.classId);
            const scoreData = allStudentScores.find(sc => sc.id === s.id) || {};
            const score = state.get('studentStarMetric') === 'monthly' ? (scoreData.monthlyStars || 0) : (scoreData.totalStars || 0);
            const totalStars = scoreData.totalStars || 0;

            // NEW: Get Gold
            const gold = scoreData.gold !== undefined ? scoreData.gold : (scoreData.totalStars || 0);

            const stats = getStudentStats(s.id);

            return {
                ...s,
                score,
                totalStars,
                gold,
                stats,
                heroLevel: heroProgressionEnabled ? (scoreData.heroLevel || 0) : 0,
                pendingSkillChoice: heroProgressionEnabled ? !!scoreData.pendingSkillChoice : false,
                familiar: scoreData.familiar || null,
                className: studentClass?.name || '?',
                classLogo: studentClass?.logo || '📚'
            };
        });
    // --- REIGNING PRODIGY (previous month's winners, with co-prodigy/tie support) ---
    const prodigyByClass = await getReigningProdigies();

    // 3. SORTING FUNCTION
    const sortStudents = utils.sortStudentsByTieBreaker;

    // --- RENDER HELPERS ---
    const reasonInfo = {
        teamwork: { icon: 'fa-users', color: 'bg-purple-100 text-purple-700', name: 'Teamwork' },
        creativity: { icon: 'fa-lightbulb', color: 'bg-pink-100 text-pink-700', name: 'Creativity' },
        respect: { icon: 'fa-hands-helping', color: 'bg-green-100 text-green-700', name: 'Respect' },
        focus: { icon: 'fa-brain', color: 'bg-yellow-100 text-yellow-700', name: 'Focus' },
        welcome_back: { icon: 'fa-hand-sparkles', color: 'bg-cyan-100 text-cyan-700', name: 'Back!' },
        story_weaver: { icon: 'fa-feather-alt', color: 'bg-cyan-100 text-cyan-700', name: 'Story' },
        scholar_s_bonus: { icon: 'fa-graduation-cap', color: 'bg-amber-100 text-amber-800', name: 'Scholar' },
        teacher_boon: { icon: 'fa-wand-magic-sparkles', color: 'bg-fuchsia-100 text-fuchsia-700', name: 'Teacher Boon' },
        pathfinder_map: { icon: 'fa-map', color: 'bg-indigo-100 text-indigo-700', name: 'Pathfinder' }
    };

    const getAvatarHtml = (s, sizeClass = "w-12 h-12") => {
        const hoverEffects = "transform transition-transform duration-200 hover:scale-110 hover:rotate-3 cursor-pointer enlargeable-avatar";
        const heroLevel = s.heroLevel || 0;
        const auraColor = heroProgressionEnabled && heroLevel >= 3 && s.heroClass && HERO_SKILL_TREE[s.heroClass] ? HERO_SKILL_TREE[s.heroClass].auraColor : null;
        const auraStyle = auraColor ? `style="box-shadow: 0 0 0 3px ${auraColor}, 0 0 14px 4px ${auraColor}88; border-color: ${auraColor};"` : '';
        let inner;
        if (s.avatar) {
            inner = `<img src="${s.avatar}" alt="${s.name}" data-student-id="${s.id}" class="${sizeClass} rounded-full object-cover border-4 border-white shadow-md ${hoverEffects}" ${auraStyle}>`;
        } else {
            inner = `<div data-student-id="${s.id}" class="${sizeClass} rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg border-4 border-white shadow-md ${hoverEffects}" ${auraStyle}>${s.name.charAt(0)}</div>`;
        }
        return wrapAvatarWithLevelUpIndicator(inner, s.pendingSkillChoice);
    };

    const getGuildRoleBadgesHtml = (s) => {
        if (!s.guildId) return '';
        const guild = getGuildById(s.guildId);
        const color = guild?.primary || '#7c3aed';
        const badges = [];

        if (guildChampions[s.guildId]?.studentId === s.id) {
            badges.push(`<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style="background:${color};" title="Guild Champion this month">⚔️ Champion</span>`);
        }
        if (topHeroByGuild[s.guildId] === s.id) {
            badges.push(`<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300" title="Top Hero for this guild">🏅 Top Hero</span>`);
        }

        return badges.join('');
    };

    /** Hero rank title (e.g. Tinkerer, Sentinel) as a styled pill using class aura color. */
    const getHeroTitleBadgeHtml = (s) => {
        if (!heroProgressionEnabled) return '';
        if (!s.heroClass) return '';
        const level = s.heroLevel || 0;
        const title = level > 0 ? getHeroTitle(s.heroClass, level) : (s.heroClass || 'Novice');
        const tree = HERO_SKILL_TREE[s.heroClass];
        const auraColor = tree?.auraColor || '#7c3aed';
        const icon = HERO_CLASSES[s.heroClass]?.icon || '';
        return `<span class="hero-title-pill inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white shadow-sm border border-white/30" style="background: linear-gradient(135deg, ${auraColor}, ${auraColor}dd); box-shadow: 0 1px 3px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.2);" title="Hero rank">${icon ? `<span class="opacity-90">${icon}</span>` : ''}<span>${title}</span></span>`;
    };

    const getPillsHtml = (s) => {
        let html = '';

        // Badge 0: Reigning Prodigy of the Month (previous month's winner, supports co-prodigies)
        if (prodigyByClass[s.classId]?.has(s.id)) {
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 shadow-sm border border-amber-300" title="Reigning Prodigy of the Month!">👑 Prodigy</div>`;
        }

        // Badge 1: Stars THIS WEEK
        if (s.stats.weeklyStars > 0) {
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-600 shadow-sm border border-orange-200" title="${s.stats.weeklyStars} stars this week"><i class="fas fa-fire"></i> Week: ${s.stats.weeklyStars}</div>`;
        }

        // Badge 2: Streak of Perfect 3-Stars
        if (s.stats.streak > 1) {
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-600 shadow-sm border border-indigo-200" title="Streak of ${s.stats.streak} perfect lessons!"><i class="fas fa-bolt"></i> Streak: ${s.stats.streak}</div>`;
        }

        // Badge 3: Top Reason of the MONTH
        if (s.stats.topSkill) {
            const info = reasonInfo[s.stats.topSkill] || { icon: 'fa-star', color: 'bg-gray-100 text-gray-600', name: 'Star' };
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${info.color} shadow-sm border border-white/50" title="Top Skill this Month"><i class="fas ${info.icon}"></i> <span>${info.name}</span></div>`;
        }

        const eggAlert = s.familiar ? getEggAlertState(s.familiar, s.totalStars) : null;
        if (eggAlert?.kind === 'ready') {
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-300" title="This egg is ready to hatch now">🥚 Ready!</div>`;
        } else if (eggAlert?.kind === 'soon') {
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-fuchsia-100 text-fuchsia-700 shadow-sm border border-fuchsia-300" title="${eggAlert.remaining} more star(s) until hatch">🥚 ${eggAlert.remaining} left</div>`;
        }

        return html;
    };

    const starMetric = state.get('studentStarMetric') === 'monthly' ? 'monthly' : 'total';
    const metricChipLabel = starMetric === 'monthly' ? 'This month' : 'All-time';
    const metricChipShort = starMetric === 'monthly' ? 'Monthly' : 'Total';

    /**
     * Unified Hero's Challenge row for Global Rank and By Class (same chrome, layout, motion).
     */
    const renderHeroChallengeCard = (s, currentRank, riseDelayMs, { showClassRow }) => {
        const podium = currentRank <= 3 ? currentRank : 0;
        const podiumMod = podium === 1 ? 'hc-lb-card--gold' : podium === 2 ? 'hc-lb-card--silver' : podium === 3 ? 'hc-lb-card--bronze' : '';

        const rankInner = podium === 1 ? '<span class="hc-lb-medal" aria-hidden="true">🥇</span>'
            : podium === 2 ? '<span class="hc-lb-medal" aria-hidden="true">🥈</span>'
                : podium === 3 ? '<span class="hc-lb-medal" aria-hidden="true">🥉</span>'
                    : `<span class="hc-lb-rank-num font-title">${currentRank}</span>`;

        const classStrip = showClassRow
            ? `<div class="hc-lb-class-strip">
                    <span class="hc-lb-class-strip__emoji" aria-hidden="true">${s.classLogo}</span>
                    <span class="hc-lb-class-strip__name">${s.className}</span>
               </div>`
            : '';

        const familiarHtml = s.familiar
            ? `<div class="familiar-chip hero-challenge-familiar-chip">${renderFamiliarSprite(s.familiar, 'small', s.id)}</div>`
            : '';

        const sparkleHtml = podium
            ? `<div class="hc-lb-card__sparkles hc-lb-card__sparkles--${podium === 1 ? 'gold' : podium === 2 ? 'silver' : 'bronze'}" aria-hidden="true">
                    <span class="hc-lb-spark"></span><span class="hc-lb-spark"></span><span class="hc-lb-spark"></span>
                    <span class="hc-lb-spark"></span><span class="hc-lb-spark"></span>
               </div>`
            : '';

        const risePodiumMod = podium ? `hc-lb-card-rise--podium hc-lb-card-rise--podium-${podium}` : '';
        const scoreStarClass = podium === 1
            ? 'hc-lb-score-star hc-lb-score-star--p1'
            : podium === 2
                ? 'hc-lb-score-star hc-lb-score-star--p2'
                : podium === 3
                    ? 'hc-lb-score-star hc-lb-score-star--p3'
                    : 'hc-lb-score-star';

        return `
        <div class="tab-mount-rise hc-lb-card-rise ${risePodiumMod}" style="--tab-rise-delay: ${riseDelayMs}ms">
            <div class="student-leaderboard-card hc-lb-card ${podiumMod}" data-hc-rank="${currentRank}" data-hc-podium="${podium || ''}" style="--tab-rise-delay: ${riseDelayMs}ms">
                <div class="hc-lb-card__blob hc-lb-card__blob--a" aria-hidden="true"></div>
                <div class="hc-lb-card__blob hc-lb-card__blob--b" aria-hidden="true"></div>
                <div class="hc-lb-card__shine" aria-hidden="true"></div>
                ${sparkleHtml}
                <div class="hc-lb-card__inner">
                    <div class="hc-lb-rank-tower" aria-label="Rank ${currentRank}">
                        ${rankInner}
                    </div>
                    <div class="hc-lb-hero-col">
                        <div class="flex-shrink-0 relative hero-challenge-avatar-wrap hc-lb-avatar-stage">
                            ${getAvatarHtml(s, 'w-14 h-14 sm:w-16 sm:h-16')}
                            ${familiarHtml}
                        </div>
                    </div>
                    <div class="hc-lb-copy">
                        <h3 class="hc-lb-name font-title text-lg sm:text-xl leading-tight flex items-center flex-wrap gap-1.5">
                            <span class="hc-lb-name__text truncate">${heroProgressionEnabled && s.heroClass && HERO_CLASSES[s.heroClass] ? HERO_CLASSES[s.heroClass].icon : ''} ${s.name}</span>
                            ${getHeroTitleBadgeHtml(s)}
                            ${getGuildRoleBadgesHtml(s)}
                        </h3>
                        <div class="hc-lb-meta-row">
                            <div class="hc-lb-gold" title="Gold balance">
                                <i class="fas fa-coins hc-lb-gold__icon"></i>
                                <span class="hc-lb-gold__val">${s.gold}</span>
                            </div>
                            ${classStrip}
                        </div>
                        <div class="hc-lb-pills flex flex-wrap gap-1.5">${getPillsHtml(s)}</div>
                    </div>
                    <div class="hc-lb-score-stack">
                        <div class="hc-lb-score-row" title="${metricChipLabel} stars">
                            <span class="${scoreStarClass}" aria-hidden="true"><i class="fas fa-star"></i></span>
                            <div class="hc-lb-score">${s.score}</div>
                        </div>
                        <div class="hc-lb-stars-label">Stars</div>
                        <div class="hc-lb-metric-chip">${metricChipShort}</div>
                    </div>
                </div>
            </div>
        </div>`;
    };

    let outputHtml = '';

    if (state.get('studentLeaderboardView') === 'league') {
        // === GLOBAL VIEW ===
        // Re-map score to stars for sort Students By Tie Breaker
        studentsInLeague = studentsInLeague.map(s => ({ ...s, stars: s.score }));
        studentsInLeague.sort(sortStudents);
        let lastScore = -1, last3 = -1, last2 = -1, lastUnique = -1, lastRank = 0;

        studentsInLeague.slice(0, 50).forEach((s, index) => {
            let isBehaviorTie = (s.stars === lastScore && s.stats.count3 === last3 && s.stats.count2 === last2 && s.stats.uniqueReasons === lastUnique);
            let currentRank;
            if (index === 0) currentRank = 1;
            else {
                if (lastRank <= 3) currentRank = isBehaviorTie ? lastRank : index + 1;
                else {
                    let isTotalTie = isBehaviorTie && (s.stats.academicAvg === studentsInLeague[index - 1].stats.academicAvg);
                    currentRank = isTotalTie ? lastRank : index + 1;
                }
            }
            lastScore = s.stars; last3 = s.stats.count3; last2 = s.stats.count2; lastUnique = s.stats.uniqueReasons; lastRank = currentRank;

            outputHtml += renderHeroChallengeCard(s, currentRank, Math.min(index * 42, 720), { showClassRow: true });
        });

    } else {
        // === BY CLASS VIEW ===
        const classesMap = studentsInLeague.reduce((acc, student) => {
            if (!acc[student.classId]) acc[student.classId] = { name: student.className, logo: student.classLogo, students: [] };
            acc[student.classId].students.push(student);
            return acc;
        }, {});

        const allClassIds = Object.keys(classesMap);
        const myClassIds = allClassIds.filter(id => state.get('allTeachersClasses').some(c => c.id === id));
        const otherClassIds = allClassIds.filter(id => !myClassIds.includes(id));
        const nameSort = (a, b) => classesMap[a].name.localeCompare(classesMap[b].name);
        const sortedClassIds = [...myClassIds.sort(nameSort), ...otherClassIds.sort(nameSort)];

        let hcRiseSeq = 0;
        for (const classId of sortedClassIds) {
            const classData = classesMap[classId];

            // Re-map score to stars for sort Students By Tie Breaker
            classData.students = classData.students.map(s => ({ ...s, stars: s.score }));
            classData.students.sort(sortStudents);
            const randomGradient = constants.titleGradients[utils.simpleHashCode(classData.name) % constants.titleGradients.length];

            outputHtml += `
            <div class="tab-mount-rise hc-lb-section-rise mt-10 mb-6 text-center" style="--tab-rise-delay: ${Math.min(hcRiseSeq++ * 40, 680)}ms">
                <div class="hc-lb-section-head inline-flex items-center gap-3 sm:gap-4">
                    <div class="hc-lb-section-head__glow" aria-hidden="true"></div>
                    <span class="hc-lb-section-logo" aria-hidden="true">${classData.logo}</span>
                    <h3 class="hc-lb-section-title font-title text-2xl sm:text-3xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r ${randomGradient}">${classData.name}</h3>
                </div>
            </div>
            <div class="hc-lb-list-stack flex flex-col gap-3 mb-12 max-w-5xl mx-auto">`;

            let lastScore = -1, last3 = -1, last2 = -1, lastUnique = -1, lastRank = 0;

            classData.students.forEach((s, index) => {
                let isBehaviorTie = (s.stars === lastScore && s.stats.count3 === last3 && s.stats.count2 === last2 && s.stats.uniqueReasons === lastUnique);
                let currentRank;
                if (index === 0) currentRank = 1;
                else {
                    if (lastRank <= 3) currentRank = isBehaviorTie ? lastRank : index + 1;
                    else {
                        let isTotalTie = isBehaviorTie && (s.stats.academicAvg === classData.students[index - 1].stats.academicAvg);
                        currentRank = isTotalTie ? lastRank : index + 1;
                    }
                }
                lastScore = s.stars; last3 = s.stats.count3; last2 = s.stats.count2; lastUnique = s.stats.uniqueReasons; lastRank = currentRank;

                outputHtml += renderHeroChallengeCard(s, currentRank, Math.min(hcRiseSeq++ * 38, 760), { showClassRow: false });
            });
            outputHtml += `</div>`;
        }
    }
    list.innerHTML = outputHtml;
}
