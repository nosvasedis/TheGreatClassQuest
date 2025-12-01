// /ui/tabs.js

// --- IMPORTS ---
import * as state from '../state.js';
import * as utils from '../utils.js';
import * as constants from '../constants.js';
import { deleteClass, ensureHistoryLoaded } from '../db/actions.js';
import { db } from '../firebase.js'; 
import { fetchMonthlyHistory } from '../state.js';
import * as modals from './modals.js';
import * as scholarScroll from '../features/scholarScroll.js';
import * as avatar from '../features/avatar.js';
import * as storyWeaver from '../features/storyWeaver.js';
import { renderActiveBounties } from './core.js';
import { updateCeremonyStatus } from '../features/ceremony.js';

// --- TAB NAVIGATION ---

export async function showTab(tabName) {
    const allTabs = document.querySelectorAll('.app-tab');
    const tabId = tabName.endsWith('-tab') ? tabName : `${tabName}-tab`;
    const nextTab = document.getElementById(tabId);
    
    const currentTab = document.querySelector('.app-tab:not(.hidden)');

    if (!nextTab || (currentTab && currentTab.id === tabId)) {
        return;
    }

    document.querySelectorAll('.nav-button[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    if (tabId === 'manage-students-tab') {
        document.querySelector('.nav-button[data-tab="my-classes-tab"]').classList.add('active');
    }

    const animationDuration = 350;

    if (currentTab) {
        currentTab.classList.add('tab-animate-out');
        
        setTimeout(() => {
            currentTab.classList.add('hidden');
            currentTab.classList.remove('tab-animate-out');

            nextTab.classList.remove('hidden');
            nextTab.classList.add('tab-animate-in');
            
            setTimeout(() => {
                nextTab.classList.remove('tab-animate-in');
            }, animationDuration);

        }, animationDuration);
    } else {
        nextTab.classList.remove('hidden');
        nextTab.classList.add('tab-animate-in');
        setTimeout(() => {
            nextTab.classList.remove('tab-animate-in');
        }, animationDuration);
    }

    // --- Trigger specific render functions when a tab is shown ---
    if (tabId === 'class-leaderboard-tab' || tabId === 'student-leaderboard-tab') {
        const { findAndSetCurrentLeague } = await import('./core.js');
        findAndSetCurrentLeague();
        updateCeremonyStatus(tabId); // Pass the ID!
    }
    
    if(tabId === 'class-leaderboard-tab') renderClassLeaderboardTab();
    if(tabId === 'student-leaderboard-tab') renderStudentLeaderboardTab();
    if(tabId === 'my-classes-tab') renderManageClassesTab();
    if(tabId === 'manage-students-tab') renderManageStudentsTab();
    
    if(tabId === 'award-stars-tab') { 
        const { findAndSetCurrentClass } = await import('./core.js');
        // First render with whatever state we have
        renderAwardStarsTab(); 
        // Then try to find the current class based on time, which will trigger a re-render via state.js if found
        findAndSetCurrentClass(); 
    }
    
    if(tabId === 'adventure-log-tab') { 
        const { findAndSetCurrentClass } = await import('./core.js');
        renderAdventureLogTab(); 
        findAndSetCurrentClass('adventure-log-class-select'); 
    }
    
    if(tabId === 'scholars-scroll-tab') { 
        const { findAndSetCurrentClass } = await import('./core.js');
        scholarScroll.renderScholarsScrollTab(); 
        findAndSetCurrentClass('scroll-class-select'); 
    }
    
    if(tabId === 'calendar-tab') {
        await ensureHistoryLoaded(); 
        renderCalendarTab();
    }
    
    if(tabId === 'reward-ideas-tab') renderIdeasTabSelects();
    if(tabId === 'options-tab') {
        import('./core.js').then(m => m.renderHolidayList());
        if (document.getElementById('teacher-name-input')) document.getElementById('teacher-name-input').value = state.get('currentTeacherName') || '';
        renderStarManagerStudentSelect(); 
    }
}

// --- TAB CONTENT RENDERERS ---

export function renderClassLeaderboardTab() {
    const list = document.getElementById('class-leaderboard-list');
    const questUpdateBtn = document.getElementById('get-quest-update-btn');
    if (!list) return;

    const league = state.get('globalSelectedLeague');
    if (!league) {
        list.innerHTML = `<div class="max-w-xl mx-auto"><p class="text-center text-gray-700 bg-white/50 p-6 rounded-2xl text-lg">Please select a league to view the Team Quest map.</p></div>`;
        questUpdateBtn.disabled = true;
        return;
    }

    // --- RESTORED DEFINITION ---
    const classesInLeague = state.get('allSchoolClasses').filter(c => c.questLevel === league);
    
    if (classesInLeague.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-700 bg-white/50 p-4 rounded-2xl text-lg">No classes in this quest league... yet!</p>`;
        questUpdateBtn.disabled = true;
        return;
    }
    
    const BASE_GOAL = 18; 
    const SCALING_FACTOR = 1.5; 
    
    // --- SMART HOLIDAY CALCULATOR ---
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    let holidayDaysLost = 0;
    const ranges = state.get('schoolHolidayRanges') || [];
    
    ranges.forEach(range => {
        const start = new Date(range.start);
        const end = new Date(range.end);
        
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        
        const overlapStart = start > monthStart ? start : monthStart;
        const overlapEnd = end < monthEnd ? end : monthEnd;
        
        if (overlapStart <= overlapEnd) {
            const diffTime = Math.abs(overlapEnd - overlapStart);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            holidayDaysLost += diffDays;
        }
    });

    let monthModifier = (daysInMonth - holidayDaysLost) / daysInMonth;
    if (currentMonth === 5) {
        monthModifier = 0.5;
    } else {
        monthModifier = Math.max(0.6, Math.min(1.0, monthModifier));
    }

    let monthMsg = holidayDaysLost > 0 ? `(Adjusted for ${holidayDaysLost} days off)` : "";

    const classScores = classesInLeague.map(c => {
        const studentsInClass = state.get('allStudents').filter(s => s.classId === c.id);
        const studentCount = studentsInClass.length;
        
        // CHECK: Did they finish the quest THIS month?
        let isCompletedThisMonth = false;
        if (c.questCompletedAt) {
            const completedDate = c.questCompletedAt.toDate();
            const now = new Date();
            if (completedDate.getMonth() === now.getMonth() && completedDate.getFullYear() === now.getFullYear()) {
                isCompletedThisMonth = true;
            }
        }

        // LOGIC FIX: 
        // If they finished this month, the DB shows the NEXT level (e.g., 1).
        // But for the UI right now, we must calculate based on the level they just played (e.g., 0).
        // If it's a new month (December), isCompletedThisMonth is false, so we use the new harder level.
        const dbDifficulty = c.difficultyLevel || 0;
        const effectiveDifficulty = isCompletedThisMonth ? Math.max(0, dbDifficulty - 1) : dbDifficulty;

        // Calculate Goal using the EFFECTIVE difficulty
        const adjustedGoalPerStudent = (BASE_GOAL + (effectiveDifficulty * SCALING_FACTOR)) * monthModifier;

        const goals = {
            bronze: Math.round(studentCount * (adjustedGoalPerStudent * 0.25)),
            silver: Math.round(studentCount * (adjustedGoalPerStudent * 0.50)),
            gold: Math.round(studentCount * (adjustedGoalPerStudent * 0.75)),
            diamond: studentCount > 0 ? Math.round(studentCount * adjustedGoalPerStudent) : 18
        };
        
        const currentMonthlyStars = studentsInClass.reduce((sum, s) => {
            const scoreData = state.get('allStudentScores').find(score => score.id === s.id);
            return sum + (scoreData?.monthlyStars || 0);
        }, 0);

        // If they completed it this month, FORCE progress to 100% (or higher) to avoid "99%" bugs due to rounding
        let progress = goals.diamond > 0 ? (currentMonthlyStars / goals.diamond) * 100 : 0;
        if (isCompletedThisMonth && progress < 100) progress = 100;

        return { ...c, studentCount, goals, currentMonthlyStars, progress, difficulty: dbDifficulty, questCompletedAt: c.questCompletedAt || null };
    }).sort((a, b) => {
        if (b.progress !== a.progress) {
            return b.progress - a.progress;
        }
        if (a.progress >= 100 && b.progress >= 100) {
            if (a.questCompletedAt && b.questCompletedAt) {
                return a.questCompletedAt.toMillis() - b.questCompletedAt.toMillis();
            }
            if (a.questCompletedAt) return -1;
            if (b.questCompletedAt) return 1;
        }
        return b.currentMonthlyStars - a.currentMonthlyStars;
    });

    questUpdateBtn.disabled = classScores.filter(c => c.currentMonthlyStars > 0).length < 2;

    let lastUniqueScore = -1, currentRank = 0;
    list.innerHTML = classScores.map((c, index) => {
        const uniqueScoreIdentifier = `${c.progress.toFixed(2)}`; 
        if (uniqueScoreIdentifier !== lastUniqueScore) {
            currentRank = index + 1;
            lastUniqueScore = uniqueScoreIdentifier;
        }
        const rankDisplay = currentRank;

        const bronzeAchieved = c.currentMonthlyStars >= c.goals.bronze;
        const silverAchieved = c.currentMonthlyStars >= c.goals.silver;
        const goldAchieved = c.currentMonthlyStars >= c.goals.gold;
        const diamondAchieved = c.currentMonthlyStars >= c.goals.diamond;
        
        let progressBarColor = 'bg-gradient-to-r from-gray-300 to-gray-400';
        if (bronzeAchieved) progressBarColor = 'bg-gradient-to-r from-stone-400 to-stone-500';
        if (silverAchieved) progressBarColor = 'bg-gradient-to-r from-slate-400 to-slate-500';
        if (goldAchieved) progressBarColor = 'bg-gradient-to-r from-amber-400 to-amber-500';
        if (diamondAchieved) progressBarColor = 'bg-gradient-to-r from-cyan-400 to-blue-500';

        const starsTo = {
            bronze: Math.max(0, c.goals.bronze - c.currentMonthlyStars),
            silver: Math.max(0, c.goals.silver - c.currentMonthlyStars),
            gold: Math.max(0, c.goals.gold - c.currentMonthlyStars),
            diamond: Math.max(0, c.goals.diamond - c.currentMonthlyStars)
        };
        
        const progressPositions = {
            bronze: c.goals.diamond > 0 ? (c.goals.bronze / c.goals.diamond) * 100 : 25,
            silver: c.goals.diamond > 0 ? (c.goals.silver / c.goals.diamond) * 100 : 50,
            gold: c.goals.diamond > 0 ? (c.goals.gold / c.goals.diamond) * 100 : 75,
        };
        
        let progressTier = 'low';
        if (c.progress >= 66) progressTier = 'high';
        else if (c.progress >= 33) progressTier = 'mid';

        const displayProgress = Math.min(100, c.progress);
        
        const difficultyBadge = c.difficulty > 0 
            ? `<span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full border border-red-200" title="Difficulty Level: ${c.difficulty}">🔥 Level ${c.difficulty + 1}</span>` 
            : `<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-200">🌱 Level 1</span>`;

        return `
        <div class="quest-card bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-xl border-2 border-white/50 space-y-3" 
            data-class-id="${c.id}">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-4">
                    <span class="font-title text-4xl text-gray-400 w-8 text-center">${rankDisplay}</span>
                    <div>
                        <h3 class="font-title text-2xl text-gray-800 flex items-center gap-2">${c.logo} ${c.name} ${difficultyBadge}</h3>
                        <p class="text-sm text-gray-600">Teacher: ${c.createdBy.name} | Students: ${c.studentCount}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-title text-4xl text-amber-500">${c.currentMonthlyStars} ⭐</p>
                    <p class="text-xs text-gray-500 -mt-1">Goal: ${c.goals.diamond} Stars ${monthMsg}</p>
                </div>
            </div>
            <div class="quest-track-path relative w-full h-10 bg-gray-200 rounded-full shadow-inner flex items-center">
                <div class="quest-track-progress h-full rounded-full ${progressBarColor}" data-progress="${displayProgress}" style="width: 0%;"></div>
                
                <div class="milestone-marker absolute top-1/2 ${bronzeAchieved ? 'achieved' : ''}" style="left: ${progressPositions.bronze}%;">
                    🛡️
                    <div class="milestone-tooltip"><p class="tooltip-main-text">${starsTo.bronze > 0 ? `${starsTo.bronze} more!` : 'Achieved!'}</p></div>
                </div>
                <div class="milestone-marker absolute top-1/2 ${silverAchieved ? 'achieved' : ''}" style="left: ${progressPositions.silver}%;">
                    🏆
                    <div class="milestone-tooltip"><p class="tooltip-main-text">${starsTo.silver > 0 ? `${starsTo.silver} more!` : 'Achieved!'}</p></div>
                </div>
                <div class="milestone-marker absolute top-1/2 ${goldAchieved ? 'achieved' : ''}" style="left: ${progressPositions.gold}%;">
                    👑
                    <div class="milestone-tooltip"><p class="tooltip-main-text">${starsTo.gold > 0 ? `${starsTo.gold} more!` : 'Achieved!'}</p></div>
                </div>
                <div class="milestone-marker is-diamond absolute top-1/2 ${diamondAchieved ? 'achieved' : ''}" style="left: 100%;">
                    💎
                    <div class="milestone-tooltip"><p class="tooltip-main-text">${starsTo.diamond > 0 ? `${starsTo.diamond} more!` : 'QUEST COMPLETE!'}</p></div>
                </div>
                
                <div class="quest-track-avatar absolute top-1/2 text-4xl ${c.progress >= 100 ? 'quest-complete' : ''}" data-progress="${displayProgress}" data-progress-tier="${progressTier}" style="left: 0%;">
                    <span>${c.logo}</span>
                    ${c.progress < 100 ? `<div class="avatar-tooltip">${c.progress.toFixed(1)}% Complete</div>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    setTimeout(() => {
        list.querySelectorAll('.quest-track-progress, .quest-track-avatar').forEach(el => {
            const progress = el.dataset.progress;
            if (el.classList.contains('quest-track-progress')) el.style.width = `${progress}%`;
            else el.style.left = `${progress}%`;
        });
        list.querySelectorAll('.milestone-marker').forEach(marker => {
            marker.addEventListener('click', () => modals.openMilestoneModal(marker));
        });
    }, 10);
}

export function renderStudentLeaderboardTab() {
    const list = document.getElementById('student-leaderboard-list');
    if (!list) return;

    const league = state.get('globalSelectedLeague');
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

    // 1. HELPER: Calculate Stats & Tie-Breakers
    const getStudentStats = (studentId) => {
        const studentLogs = allLogs.filter(log => log.studentId === studentId);
        const studentScores = allScores.filter(s => s.studentId === studentId);

        const currentMonthIndex = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const monthlyLogs = studentLogs.filter(log => {
            const logDate = utils.parseDDMMYYYY(log.date);
            return logDate.getMonth() === currentMonthIndex && logDate.getFullYear() === currentYear;
        });

        // A. Weekly Stars
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const startOfWeek = new Date(today.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);
        const weeklyStars = studentLogs
            .filter(log => utils.parseDDMMYYYY(log.date) >= startOfWeek)
            .reduce((sum, log) => sum + log.stars, 0);

        // B. Behavior Stats
        const reasonCounts = {};
        let uniqueReasons = 0;
        let count3Star = 0;
        let count2Star = 0;

        monthlyLogs.forEach(log => {
            if (log.reason) {
                if (!reasonCounts[log.reason]) { reasonCounts[log.reason] = 0; uniqueReasons++; }
                reasonCounts[log.reason] += log.stars;
            }
            if (log.stars >= 3) count3Star++;
            else if (log.stars >= 2) count2Star++;
        });
        const topReasonEntry = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
        const topSkill = topReasonEntry ? topReasonEntry[0] : null;

        // C. Academic Avg (For Month)
        let acadSum = 0;
        let acadCount = 0;

        studentScores.forEach(s => {
            if (!s.date) return;
            const sDate = new Date(s.date);
            if (sDate.getMonth() === currentMonthIndex && sDate.getFullYear() === currentYear) {
                let val = 0;
                if (s.maxScore > 0 && s.scoreNumeric !== null) val = (s.scoreNumeric / s.maxScore) * 100;
                else if (s.scoreQualitative === "Great!!!") val = 100;
                else if (s.scoreQualitative === "Great!!") val = 75;
                if (val > 0) {
                    acadSum += val;
                    acadCount++;
                }
            }
        });
        const academicAvg = acadCount > 0 ? (acadSum / acadCount) : 0;

        return { weeklyStars, topSkill, uniqueReasons, count3Star, count2Star, academicAvg };
    };

    let studentsInLeague = state.get('allStudents')
        .filter(s => classesInLeague.some(c => c.id === s.classId))
        .map(s => {
            const studentClass = state.get('allSchoolClasses').find(c => c.id === s.classId);
            const scoreData = state.get('allStudentScores').find(sc => sc.id === s.id) || {};
            const score = state.get('studentStarMetric') === 'monthly' ? (scoreData.monthlyStars || 0) : (scoreData.totalStars || 0);

            // NEW: Get Gold
            const gold = scoreData.gold !== undefined ? scoreData.gold : (scoreData.totalStars || 0);

            const stats = getStudentStats(s.id);

            return { ...s, score, gold, stats, className: studentClass?.name || '?', classLogo: studentClass?.logo || '📚' };
        });

    // 3. SORTING FUNCTION
    const sortStudents = (a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.stats.count3Star !== a.stats.count3Star) return b.stats.count3Star - a.stats.count3Star;
        if (b.stats.count2Star !== a.stats.count2Star) return b.stats.count2Star - a.stats.count2Star;
        if (b.stats.academicAvg !== a.stats.academicAvg) return b.stats.academicAvg - a.stats.academicAvg;
        if (b.stats.uniqueReasons !== a.stats.uniqueReasons) return b.stats.uniqueReasons - a.stats.uniqueReasons;
        return a.name.localeCompare(b.name);
    };

    // --- RENDER HELPERS ---
    const reasonInfo = {
        teamwork: { icon: 'fa-users', color: 'bg-purple-100 text-purple-700', name: 'Teamwork' },
        creativity: { icon: 'fa-lightbulb', color: 'bg-pink-100 text-pink-700', name: 'Creativity' },
        respect: { icon: 'fa-hands-helping', color: 'bg-green-100 text-green-700', name: 'Respect' },
        focus: { icon: 'fa-brain', color: 'bg-yellow-100 text-yellow-700', name: 'Focus' },
        welcome_back: { icon: 'fa-hand-sparkles', color: 'bg-cyan-100 text-cyan-700', name: 'Back!' },
        story_weaver: { icon: 'fa-feather-alt', color: 'bg-cyan-100 text-cyan-700', name: 'Story' },
        scholar_s_bonus: { icon: 'fa-graduation-cap', color: 'bg-amber-100 text-amber-800', name: 'Scholar' }
    };

    const getAvatarHtml = (s, sizeClass = "w-12 h-12") => {
        // Removed 'hero-stats-avatar-trigger' so it defaults to the Inventory modal via 'enlargeable-avatar'
        const hoverEffects = "transform transition-transform duration-200 hover:scale-110 hover:rotate-3 cursor-pointer enlargeable-avatar";
        if (s.avatar) {
            return `<img src="${s.avatar}" alt="${s.name}" data-student-id="${s.id}" class="${sizeClass} rounded-full object-cover border-4 border-white shadow-md ${hoverEffects}">`;
        } else {
            return `<div data-student-id="${s.id}" class="${sizeClass} rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg border-4 border-white shadow-md ${hoverEffects}">${s.name.charAt(0)}</div>`;
        }
    };

    const getPillsHtml = (s) => {
        let html = '';
        if (s.stats.weeklyStars > 0) {
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-600 shadow-sm border border-orange-200" title="${s.stats.weeklyStars} stars this week"><i class="fas fa-fire"></i> ${s.stats.weeklyStars}</div>`;
        }
        if (s.stats.count3Star > 0) {
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-600 shadow-sm border border-indigo-200" title="${s.stats.count3Star} Perfect 3-Star Awards"><i class="fas fa-meteor"></i> ${s.stats.count3Star}</div>`;
        }
        if (s.stats.topSkill) {
            const info = reasonInfo[s.stats.topSkill] || {icon: 'fa-star', color: 'bg-gray-100 text-gray-600', name: 'Star'};
            html += `<div class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${info.color} shadow-sm border border-white/50" title="Top Skill"><i class="fas ${info.icon}"></i> <span>${info.name}</span></div>`;
        }
        return html;
    };

    let outputHtml = '';

    if (state.get('studentLeaderboardView') === 'league') {
        // === GLOBAL VIEW ===
        studentsInLeague.sort(sortStudents);
        let lastScore = -1, last3 = -1, last2 = -1, lastUnique = -1, lastRank = 0;

        studentsInLeague.slice(0, 50).forEach((s, index) => {
            let isBehaviorTie = (s.score === lastScore && s.stats.count3Star === last3 && s.stats.count2Star === last2 && s.stats.uniqueReasons === lastUnique);
            let currentRank;
            if (index === 0) currentRank = 1;
            else {
                if (lastRank <= 3) currentRank = isBehaviorTie ? lastRank : index + 1;
                else {
                    let isTotalTie = isBehaviorTie && (s.stats.academicAvg === studentsInLeague[index-1].stats.academicAvg);
                    currentRank = isTotalTie ? lastRank : index + 1;
                }
            }
            lastScore = s.score; last3 = s.stats.count3Star; last2 = s.stats.count2Star; lastUnique = s.stats.uniqueReasons; lastRank = currentRank;

            let cardClasses = "bg-white border-l-4 border-gray-200 hover:shadow-md";
            let rankBadge = `<div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500">${currentRank}</div>`;

            if (currentRank === 1) { cardClasses = "bg-gradient-to-r from-amber-50 to-white border-l-4 border-amber-400 shadow-md"; rankBadge = `<div class="text-3xl">🥇</div>`; }
            else if (currentRank === 2) { cardClasses = "bg-gradient-to-r from-gray-50 to-white border-l-4 border-gray-400 shadow-sm"; rankBadge = `<div class="text-3xl">🥈</div>`; }
            else if (currentRank === 3) { cardClasses = "bg-gradient-to-r from-orange-50 to-white border-l-4 border-orange-400 shadow-sm"; rankBadge = `<div class="text-3xl">🥉</div>`; }

            outputHtml += `
                <div class="student-leaderboard-card p-3 rounded-xl mb-3 flex items-center justify-between transition-all ${cardClasses}">
                    <div class="flex items-center gap-3 md:gap-4 overflow-hidden">
                        <div class="flex-shrink-0 w-8 text-center">${rankBadge}</div>
                        <div class="flex-shrink-0">${getAvatarHtml(s)}</div>
                        <div class="min-w-0">
                            <h3 class="font-bold text-gray-800 text-lg truncate">${s.name}</h3>
                            <div class="flex items-center gap-2 mt-0.5">
                                <p class="text-xs text-gray-500 flex items-center gap-1"><span>${s.classLogo} ${s.className}</span></p>
                                <div class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-white shadow-sm" style="background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%); color: white; font-size: 0.65rem; font-family: 'Fredoka One', cursive;">
                                    <i class="fas fa-coins" style="color: #fcd34d;"></i> ${s.gold}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 flex-shrink-0 ml-2">
                        <div class="flex flex-col items-end gap-1 flex-wrap">${getPillsHtml(s)}</div>
                        <div class="text-right">
                            <div class="font-title text-3xl text-indigo-600 leading-none">${s.score}</div>
                            <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Stars</div>
                        </div>
                    </div>
                </div>`;
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

        for (const classId of sortedClassIds) {
            const classData = classesMap[classId];
            classData.students.sort(sortStudents);
            const randomGradient = constants.titleGradients[utils.simpleHashCode(classData.name) % constants.titleGradients.length];

            outputHtml += `
            <div class="mt-10 mb-6 text-center">
                <div class="inline-flex items-center gap-3 px-6 py-2 rounded-2xl bg-white shadow-sm border border-gray-100 transform hover:scale-105 transition-transform duration-300">
                    <span class="text-4xl filter drop-shadow-md">${classData.logo}</span>
                    <h3 class="font-title text-3xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r ${randomGradient}" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.05));">${classData.name}</h3>
                </div>
            </div>
            <div class="flex flex-col gap-3 mb-12 max-w-5xl mx-auto">`;

            let lastScore = -1, last3 = -1, last2 = -1, lastUnique = -1, lastRank = 0;

            classData.students.forEach((s, index) => {
                let isBehaviorTie = (s.score === lastScore && s.stats.count3Star === last3 && s.stats.count2Star === last2 && s.stats.uniqueReasons === lastUnique);
                let currentRank;
                if (index === 0) currentRank = 1;
                else {
                    if (lastRank <= 3) currentRank = isBehaviorTie ? lastRank : index + 1;
                    else {
                        let isTotalTie = isBehaviorTie && (s.stats.academicAvg === classData.students[index-1].stats.academicAvg);
                        currentRank = isTotalTie ? lastRank : index + 1;
                    }
                }
                lastScore = s.score; last3 = s.stats.count3Star; last2 = s.stats.count2Star; lastUnique = s.stats.uniqueReasons; lastRank = currentRank;

                let cardBg = "bg-white border-b-4 border-gray-200";
                let rankColor = "bg-gray-100 text-gray-500";
                let nameColor = "text-gray-700";
                let starColor = "text-indigo-600";
                let bgTrophy = '';

                if (currentRank === 1) { cardBg = "bg-gradient-to-br from-white to-amber-50 border-b-4 border-amber-400 ring-2 ring-amber-100"; rankColor = "bg-amber-400 text-white shadow-md"; nameColor = "text-amber-900"; starColor = "text-amber-500"; bgTrophy = `<div class="absolute top-0 right-0 p-3 opacity-20 text-5xl pointer-events-none text-amber-300"><i class="fas fa-trophy"></i></div>`; }
                else if (currentRank === 2) { cardBg = "bg-gradient-to-br from-white to-gray-50 border-b-4 border-gray-400 ring-2 ring-gray-100"; rankColor = "bg-gray-400 text-white shadow-md"; nameColor = "text-gray-800"; starColor = "text-gray-500"; bgTrophy = `<div class="absolute top-0 right-0 p-3 opacity-20 text-5xl pointer-events-none text-gray-300"><i class="fas fa-trophy"></i></div>`; }
                else if (currentRank === 3) { cardBg = "bg-gradient-to-br from-white to-orange-50 border-b-4 border-orange-400 ring-2 ring-orange-100"; rankColor = "bg-orange-400 text-white shadow-md"; nameColor = "text-orange-900"; starColor = "text-orange-600"; bgTrophy = `<div class="absolute top-0 right-0 p-3 opacity-20 text-5xl pointer-events-none text-orange-300"><i class="fas fa-trophy"></i></div>`; }

                outputHtml += `
                    <div class="relative rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${cardBg} flex justify-between items-center gap-4">
                        ${bgTrophy}
                        <div class="flex items-center gap-4 z-10">
                            <div class="flex-shrink-0 relative">
                                <div class="absolute -top-3 -left-2 w-8 h-8 rounded-full ${rankColor} flex items-center justify-center font-title text-sm z-10 border-2 border-white shadow-sm">${currentRank}</div>
                                ${getAvatarHtml(s, "w-16 h-16")}
                            </div>
                            <div class="min-w-0">
                                <h4 class="font-title text-xl ${nameColor} truncate leading-tight mb-1">${s.name}</h4>
                                <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white shadow-sm" style="background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%); color: white; font-size: 0.7rem; font-family: 'Fredoka One', cursive;">
                                    <i class="fas fa-coins" style="color: #fcd34d;"></i> ${s.gold}
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-1 flex-shrink-0 z-10">
                            <div class="flex items-baseline gap-1">
                                <span class="font-title text-3xl ${starColor} leading-none">${s.score}</span>
                                <span class="text-xs font-bold text-gray-400 uppercase">Stars</span>
                            </div>
                            <div class="flex flex-wrap justify-end gap-1 max-w-[200px]">${getPillsHtml(s)}</div>
                        </div>
                    </div>`;
            });
            outputHtml += `</div>`;
        }
    }
    list.innerHTML = outputHtml;
}

export function renderManageClassesTab() {
    const list = document.getElementById('class-list');
    if (!list) return;
    if (state.get('allTeachersClasses').length === 0) {
        list.innerHTML = `<p class="text-center text-gray-700 bg-white/50 p-4 rounded-2xl text-lg">You haven't created any classes yet. Add one above!</p>`;
        return;
    }
    list.innerHTML = state.get('allTeachersClasses').sort((a,b) => a.name.localeCompare(b.name)).map(c => {
        const schedule = (c.scheduleDays || []).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
        const time = (c.timeStart && c.timeEnd) ? `${c.timeStart} - ${c.timeEnd}` : 'No time set';
        return `
            <div class="bg-white p-4 rounded-2xl shadow-lg border-2 border-gray-100 transform transition hover:shadow-xl hover:scale-[1.02]">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h3 class="font-bold text-2xl text-gray-800">${c.logo || '📚'} ${c.name}</h3>
                        <p class="text-sm text-green-700 font-semibold">${c.questLevel || 'Uncategorized'}</p>
                        <p class="text-sm text-gray-500"><i class="fas fa-calendar-day mr-1"></i> ${schedule || 'No days set'}</p>
                        <p class="text-sm text-gray-500"><i class="fas fa-clock mr-1"></i> ${time}</p>
                    </div>
                    <div class="flex flex-col sm:flex-row gap-2">
                        <button data-id="${c.id}" class="report-class-btn bg-green-100 text-green-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-magic mr-0 sm:mr-2"></i><span class="hidden sm:inline">Report</span></button>
                        <button data-id="${c.id}" class="overview-class-btn bg-purple-100 text-purple-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-chart-line mr-0 sm:mr-2"></i><span class="hidden sm:inline">Overview</span></button>
                        <button data-id="${c.id}" class="edit-class-btn bg-cyan-100 text-cyan-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-pencil-alt mr-0 sm:mr-2"></i><span class="hidden sm:inline">Edit</span></button>
                        <button data-id="${c.id}" data-name="${c.name.replace(/'/g, "\\'")}" class="manage-students-btn bg-teal-100 text-teal-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-users mr-0 sm:mr-2"></i><span class="hidden sm:inline">Students</span></button>
                        <button data-id="${c.id}" class="delete-class-btn bg-red-100 text-red-800 font-bold py-2 px-4 rounded-full bubbly-button"><i class="fas fa-trash-alt mr-0 sm:mr-2"></i><span class="hidden sm:inline">Delete</span></button>
                    </div>
                </div>
            </div>`;
    }).join('');
    
    list.querySelectorAll('.manage-students-btn').forEach(btn => btn.addEventListener('click', () => {
        state.set('currentManagingClassId', btn.dataset.id);
        document.getElementById('manage-class-name').innerText = btn.dataset.name;
        document.getElementById('manage-class-id').value = btn.dataset.id;
        showTab('manage-students-tab');
    }));
    list.querySelectorAll('.delete-class-btn').forEach(btn => btn.addEventListener('click', () => modals.showModal('Delete Class?', 'Are you sure you want to delete this class and all its students? This cannot be undone.', () => deleteClass(btn.dataset.id))));
    list.querySelectorAll('.edit-class-btn').forEach(btn => btn.addEventListener('click', () => modals.openEditClassModal(btn.dataset.id)));
    list.querySelectorAll('.report-class-btn').forEach(btn => btn.addEventListener('click', () => modals.handleGenerateReport(btn.dataset.id)));
    list.querySelectorAll('.overview-class-btn').forEach(btn => btn.addEventListener('click', () => modals.openOverviewModal(btn.dataset.id)));
}

export function renderManageStudentsTab() {
    const list = document.getElementById('student-list');
    const currentManagingClassId = state.get('currentManagingClassId');
    if (!list || !currentManagingClassId) return;
    const studentsInClass = state.get('allStudents').filter(s => s.classId === currentManagingClassId).sort((a,b) => a.name.localeCompare(b.name));
    if (studentsInClass.length === 0) {
        list.innerHTML = `<p class="text-sm text-center text-gray-500">No students in this class yet. Add one!</p>`;
        return;
    }
    list.innerHTML = studentsInClass.map(s => {
        const avatarHtml = s.avatar 
            ? `<img src="${s.avatar}" alt="${s.name}" data-student-id="${s.id}" class="student-avatar large-avatar enlargeable-avatar cursor-pointer">` 
            : `<div data-student-id="${s.id}" class="student-avatar large-avatar enlargeable-avatar cursor-pointer flex items-center justify-center bg-gray-300 text-gray-600 font-bold">${s.name.charAt(0)}</div>`;

        return `
        <div class="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
            <div class="flex items-center gap-3">
                ${avatarHtml}
                <span class="font-medium text-gray-700">${s.name}</span>
            </div>
            <div class="flex gap-2">
                <button data-id="${s.id}" class="move-student-btn bg-yellow-100 text-yellow-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Move Student"><i class="fas fa-people-arrows text-xs"></i></button>
                <button data-id="${s.id}" class="hero-chronicle-btn bg-green-100 text-green-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Hero's Chronicle"><i class="fas fa-book-reader text-xs"></i></button>
                <button data-id="${s.id}" class="avatar-maker-btn font-bold w-8 h-8 rounded-full bubbly-button" title="Create/Edit Avatar"><i class="fas fa-user-astronaut text-xs"></i></button>
                <button data-id="${s.id}" class="certificate-student-btn bg-indigo-100 text-indigo-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Generate Certificate"><i class="fas fa-award text-xs"></i></button>
                <button data-id="${s.id}" class="edit-student-btn bg-cyan-100 text-cyan-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Edit Student Details"><i class="fas fa-pencil-alt text-xs"></i></button>
                <button data-id="${s.id}" class="delete-student-btn bg-red-100 text-red-800 font-bold w-8 h-8 rounded-full bubbly-button" title="Delete Student"><i class="fas fa-trash-alt text-xs"></i></button>
            </div>
        </div>`;
    }).join('');
    
    list.querySelectorAll('.delete-student-btn').forEach(btn => btn.addEventListener('click', () => modals.showModal('Delete Student?', 'Are you sure you want to delete this student?', () => deleteStudent(btn.dataset.id))));
    list.querySelectorAll('.certificate-student-btn').forEach(btn => btn.addEventListener('click', () => modals.handleGenerateCertificate(btn.dataset.id)));
    list.querySelectorAll('.edit-student-btn').forEach(btn => btn.addEventListener('click', () => modals.openEditStudentModal(btn.dataset.id)));
    list.querySelectorAll('.avatar-maker-btn').forEach(btn => btn.addEventListener('click', () => avatar.openAvatarMaker(btn.dataset.id)));
    list.querySelectorAll('.move-student-btn').forEach(btn => btn.addEventListener('click', () => modals.openMoveStudentModal(btn.dataset.id)));
    list.querySelectorAll('.hero-chronicle-btn').forEach(btn => btn.addEventListener('click', () => modals.openHeroChronicleModal(btn.dataset.id)));
}

export function renderAwardStarsTab() {
    const dropdownList = document.getElementById('award-class-list');
    const studentListContainer = document.getElementById('award-stars-student-list');
    if (!dropdownList) return;
    
    const selectedClassId = state.get('globalSelectedClassId');
    const allTeachersClasses = state.get('allTeachersClasses');

    if (allTeachersClasses.length === 0) {
         dropdownList.innerHTML = '';
         document.getElementById('selected-class-name').innerText = 'No classes created';
         document.getElementById('selected-class-level').innerText = 'Create one in "My Classes"';
         document.getElementById('selected-class-logo').innerText = '😢';
         studentListContainer.innerHTML = `<p class="text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl text-lg col-span-full">You must create a class first.</p>`;
         return;
    }
    
    dropdownList.innerHTML = allTeachersClasses
        .sort((a,b) => a.name.localeCompare(b.name))
        .map(c => `
        <div class="award-class-item flex items-center gap-3 p-3 hover:bg-rose-50 cursor-pointer" data-id="${c.id}">
            <span class="text-3xl">${c.logo}</span>
            <div class="text-left">
                <div class="font-bold text-md text-rose-800">${c.name}</div>
                <div class="text-xs text-rose-500 -mt-1">${c.questLevel}</div>
            </div>
        </div>
    `).join('');

    if (selectedClassId) {
        renderAwardStarsStudentList(selectedClassId);
    } else {
         document.getElementById('selected-class-name').innerText = 'Select a class...';
         document.getElementById('selected-class-level').innerText = '';
         document.getElementById('selected-class-logo').innerText = '❓';
         studentListContainer.innerHTML = `<p class="text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl text-lg col-span-full">Please select a class above to award stars.</p>`;
    }
}

export function renderAwardStarsStudentList(selectedClassId, fullRender = true) {
    const listContainer = document.getElementById('award-stars-student-list');
    if (!listContainer) return;

    const renderContent = () => {
        if (!selectedClassId) {
            listContainer.innerHTML = `<p class="text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl text-lg col-span-full">Please select a class above to award stars.</p>`;
            return;
        }

        let studentsInClass = state.get('allStudents').filter(s => s.classId === selectedClassId);
        
        if (fullRender) {
            for (let i = studentsInClass.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [studentsInClass[i], studentsInClass[j]] = [studentsInClass[j], studentsInClass[i]];
            }
        }

        if (studentsInClass.length === 0) {
            listContainer.innerHTML = `<p class="text-sm text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl col-span-full">No students in this class. Add some in "My Classes"!</p>`;
        } else {
            const previousLessonDate = utils.getPreviousLessonDate(selectedClassId, state.get('allSchoolClasses'));
            const today = utils.getTodayDateString();

            const cloudShapes = ['cloud-shape-1', 'cloud-shape-2', 'cloud-shape-3', 'cloud-shape-4'];
            
            listContainer.innerHTML = studentsInClass.map((s, index) => {
                const scoreData = state.get('allStudentScores').find(score => score.id === s.id) || {}; 
                const totalStars = scoreData.totalStars || 0;
                const goldCount = scoreData.gold !== undefined ? scoreData.gold : (scoreData.totalStars || 0); // Default to total if gold not initialized yet
                const monthlyStars = scoreData.monthlyStars || 0; 
                const starsToday = state.get('todaysStars')[s.id]?.stars || 0;
                const reasonToday = state.get('todaysStars')[s.id]?.reason;
                const cloudShape = cloudShapes[index % cloudShapes.length];
                
                const isMarkedAbsentToday = state.get('allAttendanceRecords').some(r => r.studentId === s.id && r.date === today);
                const wasAbsentLastTime = previousLessonDate && state.get('allAttendanceRecords').some(r => r.studentId === s.id && r.date === previousLessonDate);
                
                // Corrected logic: Present if stars > 0 OR if specifically marked present/welcome_back (even if stars are 0)
                const isPresentToday = starsToday > 0 || reasonToday === 'marked_present' || reasonToday === 'welcome_back';
                
                // Card is "Visually Absent" if explicitly marked absent today OR (absent last time AND hasn't arrived yet today)
                const isVisuallyAbsent = isMarkedAbsentToday || (wasAbsentLastTime && !isPresentToday);
                
                // Lock the card if normal stars are awarded. 
                // DO NOT LOCK if stars are 0 (e.g. marked_present) or if reason is 'welcome_back' (bonus given, but class still starts)
                const isCardLocked = starsToday > 0 && reasonToday !== 'welcome_back';

                let absenceButtonHtml = '';
                
                if (isVisuallyAbsent) {
                    if (isMarkedAbsentToday) {
                         absenceButtonHtml = `
                            <button class="absence-btn bg-green-200 text-green-700 hover:bg-green-300" data-action="mark-present" title="Undo: Mark as Present">
                                <i class="fas fa-user-check pointer-events-none"></i>
                            </button>`;
                    } else {
                        absenceButtonHtml = `
                            <button class="absence-btn bg-green-200 text-green-700 hover:bg-green-300" data-action="mark-present" title="Mark as Present">
                                <i class="fas fa-user-check pointer-events-none"></i>
                            </button>
                            <button class="welcome-back-btn" data-action="welcome-back" title="Welcome Back Bonus!">
                                <i class="fas fa-hand-sparkles pointer-events-none"></i>
                            </button>`;
                    }
                } 
                else {
                    // If they are present (stars awarded or marked present), show "Mark Absent" only if 0 stars 
                    // OR if the only record is welcome_back/marked_present (so we can undo arrival)
                    // Actually, simple rule: allow marking absent if we haven't awarded performance stars yet.
                    if (!isCardLocked) {
                        absenceButtonHtml = `
                            <button class="absence-btn" data-action="mark-absent" title="Mark as Absent">
                                <i class="fas fa-user-slash pointer-events-none"></i>
                            </button>`;
                    }
                }
                
                const avatarHtml = s.avatar 
                    ? `<img src="${s.avatar}" alt="${s.name}" class="student-avatar-cloud enlargeable-avatar">` 
                    : `<div class="student-avatar-cloud-placeholder">${s.name.charAt(0)}</div>`;

                const coinHtml = `
                    <div class="coin-pill" title="Current Gold">
                        <i class="fas fa-coins"></i>
                        <span id="student-gold-display-${s.id}">${goldCount}</span>
                    </div>
                `;
                //

                return `
                <div class="student-cloud-card ${cloudShape} ${isVisuallyAbsent ? 'is-absent' : ''}" data-studentid="${s.id}" style="animation: float-card ${4 + Math.random() * 4}s ease-in-out infinite;">
                    <div class="absence-controls">
                        ${absenceButtonHtml}
                    </div>
                    ${avatarHtml}
                    ${coinHtml}
                    <button id="post-award-undo-${s.id}" class="post-award-undo-btn bubbly-button ${starsToday > 0 ? '' : 'hidden'}" title="Undo Award"><i class="fas fa-times"></i></button>
                    
                    <div class="card-content-wrapper">
                        <h3 class="font-title text-2xl text-gray-800 text-center">${s.name}</h3>
                        <div class="flex gap-2 text-center justify-center items-center p-2">
                            <div class="counter-bubble w-20 h-20 flex flex-col items-center justify-center bg-pink-300 rounded-full shadow-md border-b-4 border-pink-400 text-pink-900 transform transition-transform hover:scale-105">
                                <span class="text-xs font-bold">TODAY</span>
                                <span class="font-title text-3xl" id="today-stars-${s.id}">${starsToday}</span>
                                <i class="fas fa-star text-xs -mt-1"></i>
                            </div>
                            <div class="counter-bubble w-20 h-20 flex flex-col items-center justify-center bg-yellow-300 rounded-full shadow-md border-b-4 border-yellow-400 text-yellow-900 transform transition-transform hover:scale-105">
                                <span class="text-xs font-bold">MONTH</span>
                                <span class="font-title text-3xl" id="monthly-stars-${s.id}">${monthlyStars}</span>
                                <i class="fas fa-star text-xs -mt-1"></i>
                            </div>
                            <div class="counter-bubble w-20 h-20 flex flex-col items-center justify-center bg-cyan-300 rounded-full shadow-md border-b-4 border-cyan-400 text-cyan-900 transform transition-transform hover:scale-105">
                                <span class="text-xs font-bold">TOTAL</span>
                                <span class="font-title text-3xl" id="total-stars-${s.id}">${totalStars}</span>
                                <i class="fas fa-star text-xs -mt-1"></i>
                            </div>
                        </div>
                        <div class="reason-selector flex justify-center items-center gap-2 ${isCardLocked ? 'pointer-events-none opacity-50' : ''}">
                            <button class="reason-btn bubbly-button p-3 rounded-full bg-gray-100 hover:bg-purple-200" data-reason="teamwork" title="Teamwork"><i class="fas fa-users text-purple-600 pointer-events-none"></i></button>
                            <button class="reason-btn bubbly-button p-3 rounded-full bg-gray-100 hover:bg-pink-200" data-reason="creativity" title="Creativity"><i class="fas fa-lightbulb text-pink-600 pointer-events-none"></i></button>
                            <button class="reason-btn bubbly-button p-3 rounded-full bg-gray-100 hover:bg-green-200" data-reason="respect" title="Respect"><i class="fas fa-hands-helping text-green-600 pointer-events-none"></i></button>
                            <button class="reason-btn bubbly-button p-3 rounded-full bg-gray-100 hover:bg-yellow-200" data-reason="focus" title="Focus/Effort"><i class="fas fa-brain text-yellow-600 pointer-events-none"></i></button>
                        </div>
                        <div class="star-selector-container flex items-center justify-center space-x-2">
                            <button data-stars="1" class="star-award-btn star-btn-1"><i class="fas fa-star"></i></button>
                            <button data-stars="2" class="star-award-btn star-btn-2"><i class="fas fa-star"></i><i class="fas fa-star"></i></button>
                            <button data-stars="3" class="star-award-btn star-btn-3"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    };

    if (fullRender) {
        listContainer.classList.remove('fade-in');
        listContainer.classList.add('fade-out');
        setTimeout(() => {
            renderContent();
            listContainer.classList.remove('fade-out');
            listContainer.classList.add('fade-in');
        }, 300);
    } else {
        renderContent();
    }
}

export function updateStudentCardAttendanceState(studentId, isAbsent) {
    const selectedClassId = state.get('globalSelectedClassId');
    const student = state.get('allStudents').find(s => s.id === studentId);
    
    if (student && student.classId === selectedClassId) {
         const activeTab = document.querySelector('.app-tab:not(.hidden)');
         if (activeTab && activeTab.id === 'award-stars-tab') {
             renderAwardStarsStudentList(selectedClassId, false);
         }
    }
}

export function updateAwardCardState(studentId, starsToday, reason) {
    const studentCard = document.querySelector(`.student-cloud-card[data-studentid="${studentId}"]`);
    if (!studentCard) return;

    const todayStarsEl = studentCard.querySelector(`#today-stars-${studentId}`);
    if (todayStarsEl && todayStarsEl.textContent != starsToday) {
        todayStarsEl.textContent = starsToday;
        const bubble = todayStarsEl.closest('.counter-bubble');
        if (bubble) {
            bubble.classList.add('counter-animate');
            setTimeout(() => bubble.classList.remove('counter-animate'), 500);
        }
    }
    
    const undoBtn = studentCard.querySelector(`#post-award-undo-${studentId}`);
    const reasonSelector = studentCard.querySelector('.reason-selector');
    const starSelector = studentCard.querySelector('.star-selector-container');
    const absenceControls = studentCard.querySelector('.absence-controls');

    // Logic: Card locks ONLY if stars > 0 AND the reason is NOT 'welcome_back'
    const shouldLock = starsToday > 0 && reason !== 'welcome_back';

    if (shouldLock) {
        undoBtn?.classList.remove('hidden');
        reasonSelector?.classList.add('pointer-events-none', 'opacity-50');
        starSelector?.classList.remove('visible');
        reasonSelector?.querySelectorAll('.reason-btn.active').forEach(b => b.classList.remove('active'));
    } else {
        // If not locked (either 0 stars OR welcome_back), enable controls
        undoBtn?.classList.add('hidden'); // Hide general undo
        reasonSelector?.classList.remove('pointer-events-none', 'opacity-50');
    }

    // If we have 0 stars (unlocked), we are present, so remove absent visual
    // (Unless we are specifically marked absent, but this function usually runs after awarding stars)
    if (starsToday >= 0) {
        studentCard.classList.remove('is-absent');
        if(absenceControls) {
             // Re-render controls to show "Mark Absent" again
             absenceControls.innerHTML = `
                <button class="absence-btn" data-action="mark-absent" title="Mark as Absent">
                    <i class="fas fa-user-slash pointer-events-none"></i>
                </button>
            `;
        }
    }
}


export function findAndSetCurrentClass(targetSelectId = null) {
    if (state.get('globalSelectedClassId')) return;

    const todayString = utils.getTodayDateString();
    const classesToday = utils.getClassesOnDay(todayString, state.get('allSchoolClasses'), state.get('allScheduleOverrides'));
    const myClassesToday = classesToday.filter(c => state.get('allTeachersClasses').some(tc => tc.id === c.id));

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    for (const c of myClassesToday) {
        if (c.timeStart && c.timeEnd && currentTime >= c.timeStart && currentTime <= c.timeEnd) {
            state.setGlobalSelectedClass(c.id);
            return;
        }
    }
}

export function findAndSetCurrentLeague(shouldRender = true) {
    if (state.get('globalSelectedLeague')) return;

    const now = new Date();
    const currentDay = now.getDay().toString();
    const currentTime = now.toTimeString().slice(0, 5);
    for (const c of state.get('allTeachersClasses')) {
        if (c.scheduleDays && c.scheduleDays.includes(currentDay)) {
            if (c.timeStart && c.timeEnd && currentTime >= c.timeStart && currentTime <= c.timeEnd) {
                state.setGlobalSelectedLeague(c.questLevel);
                if (shouldRender) {
                    renderClassLeaderboardTab();
                    renderStudentLeaderboardTab();
                }
                return;
            }
        }
    }
}

export function populateCalendarStars(logSource) {
    if (!logSource || logSource.length === 0) return;

    const logsByDate = logSource.reduce((acc, log) => {
        const date = log.date; 
        if (!acc[date]) {
            acc[date] = 0;
        }
        acc[date] += log.stars;
        return acc;
    }, {});

    for (const [dateString, totalStars] of Object.entries(logsByDate)) {
        const dayCell = document.querySelector(`.calendar-day-cell[data-date="${dateString}"]`);
        if (dayCell && totalStars > 0) {
            const dateNumberEl = dayCell.querySelector('.font-bold.text-right');
            if (dateNumberEl) {
                const existingStars = dayCell.querySelector('.calendar-star-count');
                if (existingStars) existingStars.remove();
                
                const starHtml = `<div class="calendar-star-count text-center text-amber-600 font-bold mt-1 text-sm"><i class="fas fa-star"></i> ${totalStars}</div>`;
                dateNumberEl.insertAdjacentHTML('afterend', starHtml);
            }
        }
    }
}

export function renderCalendarTab() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    
    const loader = document.getElementById('calendar-loader');
    const isLoaderVisible = loader && !loader.classList.contains('hidden');
    
    grid.innerHTML = ''; 
    if (isLoaderVisible) {
        grid.appendChild(loader);
    }
    
    const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayHeaders.forEach(day => {
        const headerEl = document.createElement('div');
        headerEl.className = 'text-center font-bold text-gray-600';
        headerEl.textContent = day;
        grid.appendChild(headerEl);
    });
    
    const calendarCurrentDate = state.get('calendarCurrentDate');
    const month = calendarCurrentDate.getMonth(), year = calendarCurrentDate.getFullYear();
    document.getElementById('calendar-month-year').innerText = calendarCurrentDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0,0,0,0); 
    document.getElementById('prev-month-btn').disabled = calendarCurrentDate <= constants.competitionStart;
    document.getElementById('next-month-btn').disabled = calendarCurrentDate.getMonth() === constants.competitionEnd.getMonth() && calendarCurrentDate.getFullYear() === constants.competitionEnd.getFullYear();
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const isRecentView = calendarCurrentDate >= thirtyDaysAgo;
    const logsToRender = isRecentView ? state.get('allAwardLogs') : [];

    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'border rounded-md bg-gray-50/70 calendar-day-cell';
        grid.appendChild(emptyCell);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
        const day = new Date(year, month, i);
        const isFuture = day > today;
        const isToday = today.toDateString() === day.toDateString();
        const dateString = utils.getDDMMYYYY(day);
        
        const logsForThisDay = logsToRender.filter(log => utils.getDDMMYYYY(utils.parseDDMMYYYY(log.date)) === dateString);
        const totalStarsThisDay = logsForThisDay.reduce((sum, log) => sum + (log.stars || 0), 0);
        
        const dayCell = document.createElement('div');
        dayCell.dataset.date = dateString;

        // 1. Check for Global Holidays (Ranges set in Options)
        // Convert current loop day to YYYY-MM-DD for comparison
        const yyyy = day.getFullYear();
        const mm = String(day.getMonth() + 1).padStart(2, '0');
        const dd = String(day.getDate()).padStart(2, '0');
        const compDate = `${yyyy}-${mm}-${dd}`;
        
        const globalHoliday = (state.get('schoolHolidayRanges') || []).find(h => compDate >= h.start && compDate <= h.end);

        // 2. Check for Manual Cancellations (The Trash Can)
        // We check if ALL scheduled classes for this teacher are cancelled on this day.
        const myClasses = state.get('allTeachersClasses');
        const dayOfWeekStr = day.getDay().toString();
        
        // Classes that SHOULD occur today
        const myScheduledClasses = myClasses.filter(c => c.scheduleDays && c.scheduleDays.includes(dayOfWeekStr));
        
        // Classes actually running today (utils.getClassesOnDay filters out cancelled ones)
        const classesOnThisDay = utils.getClassesOnDay(dateString, state.get('allSchoolClasses'), state.get('allScheduleOverrides'));
        
        // Check overrides
        const myClassIds = myClasses.map(c => c.id);
        const myCancellations = state.get('allScheduleOverrides').filter(o => 
            o.date === dateString && 
            o.type === 'cancelled' && 
            myClassIds.includes(o.classId)
        );

        // LOGIC: Full Block if Global Holiday OR (Scheduled Classes exist AND All are Cancelled)
        const isFullHoliday = globalHoliday || (myScheduledClasses.length > 0 && classesOnThisDay.length === 0 && myCancellations.length > 0);

        const dayNumberHtml = isToday ? `<span class="today-date-highlight">${i}</span>` : i;
        
        if (isFullHoliday) {
            // --- RENDER HOLIDAY BLOCK ---
            const themeClass = globalHoliday ? `holiday-theme-${globalHoliday.type}` : 'bg-red-50 border-red-200';
            const labelText = globalHoliday ? (globalHoliday.type === 'christmas' ? 'Winter Break' : globalHoliday.name) : 'No School';
            const icon = globalHoliday ? (globalHoliday.type === 'christmas' ? '❄️' : (globalHoliday.type === 'easter' ? '🐰' : '📅')) : '⛔';

            dayCell.className = `border rounded-md p-1 calendar-day-cell calendar-holiday-cell ${themeClass} relative overflow-hidden`;
            dayCell.innerHTML = `
                <div class="font-bold text-right text-gray-400 opacity-50 z-10 relative">${i}</div>
                <div class="absolute inset-0 flex flex-col items-center justify-center opacity-80 pointer-events-none">
                    <span class="text-3xl mb-1">${icon}</span>
                    <span class="font-title text-xs uppercase tracking-wider font-bold text-gray-500 text-center leading-tight px-1">${labelText}</span>
                </div>
            `;
        } else {
            // --- RENDER NORMAL DAY ---
            const logsForThisDay = logsToRender.filter(log => utils.getDDMMYYYY(utils.parseDDMMYYYY(log.date)) === dateString);
            const totalStarsThisDay = logsForThisDay.reduce((sum, log) => sum + (log.stars || 0), 0);
            
            dayCell.className = `border rounded-md p-1 calendar-day-cell ${isFuture ? 'bg-white future-day' : 'bg-white logbook-day-btn'}`;
            
            const starHtml = totalStarsThisDay > 0 ? `<div class="calendar-star-count text-center text-amber-600 font-bold mt-1 text-sm"><i class="fas fa-star"></i> ${totalStarsThisDay}</div>` : '';
            
            let eventsHtml = classesOnThisDay.map(c => {
                const color = c.color || constants.classColorPalettes[utils.simpleHashCode(c.id) % constants.classColorPalettes.length];
                const timeDisplay = (c.timeStart && c.timeEnd) ? `${c.timeStart}-${c.timeEnd}` : (c.timeStart || '');
                return `<div class="text-xs px-1.5 py-1 rounded ${color.bg} ${color.text} border-l-4 ${color.border} shadow-sm" title="${c.name} (${timeDisplay})"><span class="font-bold">${c.logo} ${timeDisplay}</span><span class="truncate block">${c.name}</span></div>`;
            }).join('');
            
            const questEventsOnThisDay = state.get('allQuestEvents').filter(e => e.date === dateString);
            let questEventsHtml = questEventsOnThisDay.map(e => {
                const title = e.details?.title || e.type; 
                return `<div class="relative text-xs px-1.5 py-1 rounded bg-purple-200 text-purple-800 border-l-4 border-purple-400 shadow-sm truncate"><span class="font-bold">${title}</span></div>`;
            }).join('');

            dayCell.innerHTML = `
                <div class="font-bold text-right text-gray-800">${dayNumberHtml}</div>
                ${starHtml}
                <div class="flex flex-col gap-1 mt-1 overflow-y-auto" style="max-height: 150px;">
                    ${questEventsHtml}
                    ${eventsHtml}
                </div>
            `;
        }
        grid.appendChild(dayCell);
    }
}

export function renderIdeasTabSelects() {
    const geminiSelect = document.getElementById('gemini-class-select');
    const oracleSelect = document.getElementById('oracle-class-select');
    const storySelect = document.getElementById('story-weavers-class-select');
    if (!geminiSelect || !oracleSelect || !storySelect) return;

    const optionsHtml = state.get('allTeachersClasses').sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${c.name} (${c.questLevel})</option>`).join('');

    const globalClassId = state.get('globalSelectedClassId');

    geminiSelect.innerHTML = '<option value="">Select a class...</option>' + optionsHtml;
    geminiSelect.value = globalClassId || '';
    document.getElementById('gemini-idea-btn').disabled = !geminiSelect.value;

    oracleSelect.innerHTML = '<option value="">Select a class...</option>' + optionsHtml;
    oracleSelect.value = globalClassId || '';
    document.getElementById('oracle-insight-btn').disabled = !oracleSelect.value;

    storySelect.innerHTML = '<option value="">Select a class...</option>' + optionsHtml;
    storySelect.value = globalClassId || '';

    storyWeaver.handleStoryWeaversClassSelect(); 
}

export function renderStarManagerStudentSelect() {
    const select = document.getElementById('star-manager-student-select');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Select a student...</option>';

    const allTeachersClasses = state.get('allTeachersClasses');
    if (allTeachersClasses.length === 0) {
        select.innerHTML = '<option value="">No students found in your classes</option>';
        return;
    }
    
    const classesMap = allTeachersClasses.reduce((acc, c) => {
        acc[c.id] = { name: c.name, students: [] };
        return acc;
    }, {});
    
    const studentsInMyClasses = state.get('allStudents').filter(s => classesMap[s.classId]);
    
    if (studentsInMyClasses.length === 0) {
        select.innerHTML = '<option value="">No students found in your classes</option>';
        return;
    }

    studentsInMyClasses.forEach(s => {
        classesMap[s.classId].students.push(s);
    });

    const sortedClassIds = Object.keys(classesMap).sort((a, b) => classesMap[a].name.localeCompare(b.name));
    sortedClassIds.forEach(classId => {
        const classData = classesMap[classId];
        if (classData.students.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = classData.name;
            classData.students.sort((a,b) => a.name.localeCompare(b.name));
            classData.students.forEach(s => {
                const option = document.createElement('option');
                option.value = s.id;
                option.textContent = s.name;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        }
    });
    select.value = currentVal;
}

export function renderAdventureLogTab() {
    const classSelect = document.getElementById('adventure-log-class-select');
    const monthFilter = document.getElementById('adventure-log-month-filter');

    if (!classSelect || !monthFilter) return;

    const classVal = state.get('globalSelectedClassId');
    const optionsHtml = state.get('allTeachersClasses').sort((a,b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${c.logo} ${c.name}</option>`).join('');
    classSelect.innerHTML = '<option value="">Select a class to view its log...</option>' + optionsHtml;
    
    if (classVal) {
        classSelect.value = classVal;
    }
    
    state.get('currentLogFilter').classId = classVal; 
    document.getElementById('log-adventure-btn').disabled = !classVal;
    document.getElementById('quest-assignment-btn').disabled = !classVal;
    document.getElementById('attendance-chronicle-btn').disabled = !classVal;
    
    const monthVal = monthFilter.value;
    const availableMonths = [...new Set(state.get('allAdventureLogs').map(log => {
        const dateObj = utils.parseDDMMYYYY(log.date);
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const year = dateObj.getFullYear();
        return `${month}-${year}`;
    }))];
    availableMonths.sort().reverse();
    const currentMonth = utils.getDDMMYYYY(new Date()).substring(3);
    if (!availableMonths.includes(currentMonth)) {
        availableMonths.unshift(currentMonth);
    }
    monthFilter.innerHTML = availableMonths.map(monthKey => {
        const d = utils.parseDDMMYYYY('01-' + monthKey);
        const display = d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
        return `<option value="${monthKey}">${display}</option>`;
    }).join('');
    monthFilter.value = monthVal || currentMonth;
    state.get('currentLogFilter').month = monthFilter.value;

    renderAdventureLog();
}

export function renderAdventureLog() {
    const feed = document.getElementById('adventure-log-feed');
    if (!feed) return;
    
    const currentLogFilter = state.get('currentLogFilter');

    if (!currentLogFilter.classId) {
        feed.innerHTML = `<p class="text-center text-gray-500 bg-white/50 p-6 rounded-2xl">Please select one of your classes to see its Adventure Log.</p>`;
        return;
    }
    
    const logsForClass = state.get('allAdventureLogs').filter(log => {
         if (log.classId !== currentLogFilter.classId) return false;
        const dateObj = utils.parseDDMMYYYY(log.date);
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const year = dateObj.getFullYear();
        const logMonthKey = `${month}-${year}`;
        return logMonthKey === currentLogFilter.month;
    });
    
    if (logsForClass.length === 0) {
        const selectedMonthDisplay = document.getElementById('adventure-log-month-filter').options[document.getElementById('adventure-log-month-filter').selectedIndex]?.text;
        feed.innerHTML = `<div class="diary-page empty"><p class="text-center text-gray-500">The diary is empty for ${selectedMonthDisplay}.<br>Award some stars and then 'Log Today's Adventure'!</p></div>`;
        return;
    }

    feed.innerHTML = logsForClass.map(log => {
        const displayDate = utils.parseDDMMYYYY(log.date).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
        const keywordsHtml = (log.keywords || []).map(kw => `<span class="diary-keyword">#${kw}</span>`).join('');
        
        const noteHtml = log.note ? `
            <div class="diary-note">
                <p>"${log.note}"</p>
                <span class="diary-note-author">- Note by ${log.noteBy || 'the Teacher'}</span>
            </div>
        ` : '';

        return `
            <div class="diary-page pop-in-start">
                <div class="diary-header">
                    <h3 class="diary-date">${displayDate}</h3>
                    <div class="diary-hero">
                        <i class="fas fa-crown mr-1"></i> Hero: ${log.hero}
                    </div>
                </div>
                <div class="diary-body">
                    <div class="diary-image-container">
                        <img src="${log.imageUrl || log.imageBase64 || ''}" alt="Image for ${(log.keywords || []).join(', ')}" class="diary-image">
                    </div>
                    <div class="diary-text-content">
                        <p class="diary-text">${log.text}</p>
                        ${noteHtml}
                    </div>
                </div>
                <div class="diary-footer">
                    <div class="diary-keywords">
                        ${keywordsHtml}
                    </div>
                    <div class="flex gap-2">
                        <button class="log-note-btn bubbly-button bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center" data-log-id="${log.id}" title="${log.note ? 'Edit Note' : 'Add Note'}"><i class="fas fa-pencil-alt"></i></button>
                        <button class="log-delete-btn bubbly-button bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center" data-log-id="${log.id}" title="Delete Log Entry"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const pages = feed.querySelectorAll('.diary-page');
    pages.forEach((page, index) => {
        setTimeout(() => {
            page.classList.remove('pop-in-start');
        }, 50 + (index * 80));
    });

}

// --- GLOBAL UI SYNC FUNCTIONS ---
export function updateAllClassSelectors(isManual) {
    state.set('isProgrammaticSelection', true);
    const classId = state.get('globalSelectedClassId');

    const awardBtn = document.getElementById('award-class-dropdown-btn');
    if (awardBtn) {
        const allSchoolClasses = state.get('allSchoolClasses');
        const selectedClass = allSchoolClasses.find(c => c.id === classId);
        if (selectedClass) {
            document.getElementById('selected-class-logo').innerText = selectedClass.logo;
            document.getElementById('selected-class-name').innerText = selectedClass.name;
            document.getElementById('selected-class-level').innerText = selectedClass.questLevel;
            awardBtn.dataset.selectedId = classId;
            if (document.querySelector('.app-tab:not(.hidden)')?.id === 'award-stars-tab') {
                renderAwardStarsStudentList(classId);
            }
        } else {
            document.getElementById('selected-class-logo').innerText = '❓';
            document.getElementById('selected-class-name').innerText = 'Select a class...';
            document.getElementById('selected-class-level').innerText = '';
            awardBtn.dataset.selectedId = '';
            if (document.querySelector('.app-tab:not(.hidden)')?.id === 'award-stars-tab') {
                 renderAwardStarsStudentList(null);
            }
        }
    }

    const selectors = ['gemini-class-select', 'oracle-class-select', 'story-weavers-class-select', 'adventure-log-class-select', 'scroll-class-select'];
    selectors.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.value = classId || '';
        }
    });
    state.set('isProgrammaticSelection', false);
}

export function updateAllLeagueSelectors() {
    state.set('isProgrammaticSelection', true);
    const league = state.get('globalSelectedLeague');
    const leagueButtons = ['leaderboard-league-picker-btn', 'student-leaderboard-league-picker-btn'];
    leagueButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.innerText = league || 'Select a League';
        }
    });
    state.set('isProgrammaticSelection', false);
}

export function openMilestoneModal(markerElement) {
    const questCard = markerElement.closest('.quest-card');
    const classId = questCard.dataset.classId;
    const classInfo = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classInfo) return;

    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    const studentCount = studentsInClass.length;
    const currentMonthlyStars = studentsInClass.reduce((sum, s) => {
        const scoreData = state.get('allStudentScores').find(score => score.id === s.id);
        return sum + (scoreData?.monthlyStars || 0);
    }, 0);

    const GOAL_PER_STUDENT = { BRONZE: 4, SILVER: 8, GOLD: 13, DIAMOND: 18 };
    const goals = {
        bronze: Math.round(studentCount * GOAL_PER_STUDENT.BRONZE),
        silver: Math.round(studentCount * GOAL_PER_STUDENT.SILVER),
        gold: Math.round(studentCount * GOAL_PER_STUDENT.GOLD),
        diamond: studentCount > 0 ? Math.round(studentCount * GOAL_PER_STUDENT.DIAMOND) : 18
    };

    const modalTitle = document.getElementById('milestone-modal-title');
    const modalContent = document.getElementById('milestone-modal-content');
    
    let milestoneName, goal, icon;
    if (markerElement.innerText.includes('🛡️')) { milestoneName = "Bronze Shield"; goal = goals.bronze; icon = '🛡️'; } 
    else if (markerElement.innerText.includes('🏆')) { milestoneName = "Silver Trophy"; goal = goals.silver; icon = '🏆'; }
    else if (markerElement.innerText.includes('👑')) { milestoneName = "Golden Crown"; goal = goals.gold; icon = '👑'; } 
    else { milestoneName = "Diamond Quest"; goal = goals.diamond; icon = '💎'; }

    const now = new Date();
    const currentMonthIndex = now.getMonth();
    const currentYear = now.getFullYear();

    const relevantLogs = state.get('allAwardLogs').filter(log => {
        if (log.classId !== classId) return false;
        const logDate = utils.parseDDMMYYYY(log.date); 
        return logDate.getMonth() === currentMonthIndex && logDate.getFullYear() === currentYear;
    });

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const startOfWeek = new Date(today.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklyStars = relevantLogs
    .filter(log => utils.parseDDMMYYYY(log.date) >= startOfWeek)
    .reduce((sum, log) => sum + log.stars, 0);

    const reasonCounts = relevantLogs.reduce((acc, log) => {
        acc[log.reason || 'other'] = (acc[log.reason || 'other'] || 0) + log.stars;
        return acc;
    }, {});
    const topReasonEntry = Object.entries(reasonCounts).sort((a,b) => b[1] - a[1])[0];
    const topReason = topReasonEntry ? `${topReasonEntry[0].charAt(0).toUpperCase() + topReasonEntry[0].slice(1)}` : "N/A";

    const studentScores = studentsInClass.map(s => {
        const score = state.get('allStudentScores').find(sc => sc.id === s.id)?.monthlyStars || 0;
        return { name: s.name, score };
    }).filter(s => s.score > 0);
    
    let topAdventurers = "None yet this month!";
    if(studentScores.length > 0) {
        const topStudents = studentScores.sort((a, b) => b.score - a.score).slice(0, 5).map(s => `${s.name} (${s.score}⭐)`);
        topAdventurers = topStudents.join(', ');
    }
    
    modalTitle.innerHTML = `${icon} ${milestoneName}`;
    const starsNeeded = Math.max(0, goal - currentMonthlyStars);
    const progressPercent = goal > 0 ? Math.min(100, (currentMonthlyStars / goal) * 100).toFixed(1) : 0;

    modalContent.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div class="text-center">
                <h3 class="font-title text-4xl text-gray-800">${classInfo.logo} ${classInfo.name}</h3>
                <p class="text-lg text-gray-600 -mt-2">Progress towards the ${milestoneName}</p>
                
                <div class="text-2xl my-4">
                    <p><span class="font-bold text-amber-500 text-5xl">${currentMonthlyStars}</span> / <span class="font-bold text-3xl text-gray-500">${goal}</span></p>
                    <p class="text-sm text-gray-500 -mt-1">Total Stars Collected</p>
                    <div class="w-full bg-gray-200 rounded-full h-6 shadow-inner mt-2 border-2 border-gray-300">
                        <div class="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full flex items-center justify-center text-white font-bold text-sm" style="width: ${progressPercent}%">
                            ${progressPercent > 10 ? `${progressPercent}%` : ''}
                        </div>
                    </div>
                </div>
                
                ${starsNeeded > 0 
                    ? `<p class="mt-4 text-blue-600 font-bold text-3xl animate-pulse">${starsNeeded} more stars to go!</p>` 
                    : `<p class="mt-4 text-green-600 font-bold text-3xl title-sparkle">Milestone Achieved! Well done!</p>`
                }
            </div>
            <div class="text-left bg-gray-50 p-6 rounded-2xl border-2 border-gray-200 space-y-4">
                 <div class="bg-white p-3 rounded-lg shadow-sm">
                    <p class="text-sm text-gray-500 flex items-center gap-1"><i class="fas fa-bolt text-yellow-500"></i> Weekly Momentum (Since Monday)</p>
                    <p class="font-bold text-2xl text-yellow-600">${weeklyStars} stars</p>
                </div>
                <div class="bg-white p-3 rounded-lg shadow-sm">
                    <p class="text-sm text-gray-500 flex items-center gap-1"><i class="fas fa-award text-green-500"></i> Top Skill This Month</p>
                    <p class="font-bold text-2xl text-green-600">${topReason}</p>
                </div>
                <div class="bg-white p-3 rounded-lg shadow-sm">
                    <p class="text-sm text-gray-500 flex items-center gap-1"><i class="fas fa-crown text-purple-500"></i> Top Adventurers (Monthly)</p>
                    <p class="font-semibold text-lg text-purple-600" title="${topAdventurers}">${topAdventurers}</p>
                </div>
            </div>
        </div>
    `;
    
    modals.showAnimatedModal('milestone-details-modal');
}
