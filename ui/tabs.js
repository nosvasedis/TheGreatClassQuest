// /ui/tabs.js

// --- IMPORTS ---
import * as state from '../state.js';
import * as utils from '../utils.js';
import * as constants from '../constants.js';
import { deleteClass, deleteStudent, ensureHistoryLoaded } from '../db/actions.js';
import { db } from '../firebase.js';
import { fetchMonthlyHistory } from '../state.js';
import * as modals from './modals.js';
import * as scholarScroll from '../features/scholarScroll.js';
import * as avatar from '../features/avatar.js';
import * as storyWeaver from '../features/storyWeaver.js';
import { playSound } from '../audio.js';
import { renderActiveBounties } from './core.js';
import { updateCeremonyStatus } from '../features/ceremony.js';
import { renderHomeTab } from '../features/home.js';
import { HERO_CLASSES } from '../features/heroClasses.js';
import { generateLeagueMapHtml } from '../features/worldMap.js';

// --- TAB NAVIGATION ---

export async function showTab(tabName) {
    const allTabs = document.querySelectorAll('.app-tab');
    const tabId = tabName.endsWith('-tab') ? tabName : `${tabName}-tab`;
    const nextTab = document.getElementById(tabId);

    const currentTab = document.querySelector('.app-tab:not(.hidden)');

    if (!nextTab || (currentTab && currentTab.id === tabId)) {
        return;
    }

    localStorage.setItem('quest_last_active_tab', tabId);

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

    if (tabId === 'class-leaderboard-tab') renderClassLeaderboardTab();
    if (tabId === 'student-leaderboard-tab') renderStudentLeaderboardTab();
    if (tabId === 'my-classes-tab') renderManageClassesTab();
    if (tabId === 'manage-students-tab') renderManageStudentsTab();

    if (tabId === 'award-stars-tab') {
        const { findAndSetCurrentClass } = await import('./core.js');
        // First render with whatever state we have
        renderAwardStarsTab();
        // Then try to find the current class based on time, which will trigger a re-render via state.js if found
        findAndSetCurrentClass();
    }

    if (tabId === 'adventure-log-tab') {
        const { findAndSetCurrentClass } = await import('./core.js');
        renderAdventureLogTab();
        findAndSetCurrentClass('adventure-log-class-select');
    }

    if (tabId === 'scholars-scroll-tab') {
        const { findAndSetCurrentClass } = await import('./core.js');
        scholarScroll.renderScholarsScrollTab();
        findAndSetCurrentClass('scroll-class-select');
    }

    if (tabId === 'calendar-tab') {
        await ensureHistoryLoaded();
        renderCalendarTab();
    }

    if (tabId === 'about-tab') {
        renderHomeTab();
    }

    if (tabId === 'reward-ideas-tab') renderIdeasTabSelects();
    if (tabId === 'options-tab') {
        // Load holidays and the new economy selector
        import('./core.js').then(m => {
            if (m.renderHolidayList) m.renderHolidayList();
            if (m.renderEconomyStudentSelect) m.renderEconomyStudentSelect();
        });

        // FIX: Call this directly (it is defined in this file, not core.js)
        renderStarManagerStudentSelect();

        if (document.getElementById('teacher-name-input')) {
            document.getElementById('teacher-name-input').value = state.get('currentTeacherName') || '';
        }
    }
}
// --- TAB CONTENT RENDERERS ---

export async function renderClassLeaderboardTab() {
    const list = document.getElementById('class-leaderboard-list');
    const questUpdateBtn = document.getElementById('get-quest-update-btn');
    if (!list) return;

    const league = state.get('globalSelectedLeague');
    if (!league) {
        list.innerHTML = `<div class="max-w-xl mx-auto"><p class="text-center text-gray-700 bg-white/50 p-6 rounded-2xl text-lg">Please select a league to view the Team Quest map.</p></div>`;
        questUpdateBtn.disabled = true;
        return;
    }

    const classesInLeague = state.get('allSchoolClasses').filter(c => c.questLevel === league);

    if (classesInLeague.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-700 bg-white/50 p-4 rounded-2xl text-lg">No classes in this quest league... yet!</p>`;
        questUpdateBtn.disabled = true;
        return;
    }

    const allStudentScores = state.get('allStudentScores') || [];
    const allStudents = state.get('allStudents') || [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const classScores = classesInLeague.map(c => {
        const studentsInClass = allStudents.filter(s => s.classId === c.id);
        const studentCount = studentsInClass.length;

        // Calculate goal centrally
        const goalValue = utils.calculateMonthlyClassGoal(
            c,
            studentCount,
            state.get('schoolHolidayRanges'),
            state.get('allScheduleOverrides')
        );

        const goals = { diamond: goalValue };

        let goalDifference = 0;
        let isCompletedThisMonth = false;
        const dbDifficulty = c.difficultyLevel || 0;

        if (c.questCompletedAt) {
            const completedDate = typeof c.questCompletedAt.toDate === 'function' ? c.questCompletedAt.toDate() : new Date(c.questCompletedAt);
            if (completedDate.getMonth() === new Date().getMonth() && completedDate.getFullYear() === new Date().getFullYear()) {
                isCompletedThisMonth = true;
            }
        }

        if (studentCount > 0) {
            // Estimate original for UI difference
            const effectiveDiff = isCompletedThisMonth ? Math.max(0, dbDifficulty - 1) : dbDifficulty;
            const originalGoalTotal = Math.round(studentCount * (18 + (effectiveDiff * 2.5)));
            goalDifference = goalValue - originalGoalTotal;
        }

        const currentMonthlyStars = studentsInClass.reduce((sum, s) => {
            const scoreData = allStudentScores.find(sc => sc.id === s.id);
            return sum + (scoreData ? (Number(scoreData.monthlyStars) || 0) : 0);
        }, 0);

        const classLogs = state.get('allAwardLogs').filter(l => l.classId === c.id);
        const weeklyStars = classLogs.filter(log => {
            const d = utils.parseDDMMYYYY(log.date);
            return d && d >= startOfWeek;
        }).reduce((sum, log) => sum + (Number(log.stars) || 0), 0);

        const totalGold = studentsInClass.reduce((sum, s) => {
            const scoreData = allStudentScores.find(sc => sc.id === s.id);
            const gold = scoreData && scoreData.gold !== undefined ? scoreData.gold : (scoreData?.totalStars || 0);
            return sum + (Number(gold) || 0);
        }, 0);

        const adventureCount = state.get('allAdventureLogs').filter(l => {
            const d = utils.parseDDMMYYYY(l.date);
            return l.classId === c.id && d && d.getMonth() === currentMonth;
        }).length;

        const topHeroes = studentsInClass
            .map(s => {
                const scoreData = allStudentScores.find(sc => sc.id === s.id);
                return {
                    name: s.name,
                    avatar: s.avatar,
                    stars: scoreData ? (Number(scoreData.monthlyStars) || 0) : 0
                };
            })
            .sort((a, b) => b.stars - a.stars)
            .slice(0, 3);

        const hasPathfinder = classLogs.some(log => {
            const d = utils.parseDDMMYYYY(log.date);
            return d && d.getMonth() === currentMonth && log.reason === 'pathfinder_bonus';
        });

        const reasons = {};
        classLogs.forEach(l => { if (l.reason) reasons[l.reason] = (reasons[l.reason] || 0) + l.stars; });
        const topSkill = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

        let progress = goals.diamond > 0 ? (currentMonthlyStars / goals.diamond) * 100 : 0;
        if (isCompletedThisMonth && progress < 100) progress = 100;

        return {
            ...c,
            studentCount,
            goals,
            goalDifference,
            currentMonthlyStars,
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

    questUpdateBtn.disabled = classScores.filter(c => c.currentMonthlyStars > 0).length < 2;

    const { generateLeagueMapHtml } = await import('../features/worldMap.js');
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

        const skillIcons = { teamwork: 'users', creativity: 'lightbulb', respect: 'hand-holding-heart', focus: 'brain', scholar_s_bonus: 'scroll', welcome_back: 'door-open' };
        const skillName = c.topSkill.replace(/_/g, ' ');

        const avgStars = c.studentCount > 0 ? (c.currentMonthlyStars / c.studentCount).toFixed(1) : 0;
        const weeklyGrowth = c.weeklyStars > 0 ? "Trending Up 🚀" : "Steady Path ⚓";
        const spiritRank = c.adventureCount > 3 ? "Legendary ✨" : (c.adventureCount > 1 ? "Active 🌟" : "Quiet 🍃");

        let headerColor = "bg-gray-50 border-b border-gray-200";
        let rankBadge = `<span class="bg-gray-200 text-gray-600 w-8 h-8 rounded-full flex items-center justify-center font-bold">#${rank}</span>`;
        if (rank === 1) { headerColor = "bg-gradient-to-r from-amber-100 to-orange-50 border-b border-amber-200"; rankBadge = `<div class="text-3xl filter drop-shadow-sm">🥇</div>`; }
        else if (rank === 2) { headerColor = "bg-gradient-to-r from-gray-100 to-slate-50 border-b border-gray-200"; rankBadge = `<div class="text-3xl filter drop-shadow-sm">🥈</div>`; }
        else if (rank === 3) { headerColor = "bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-200"; rankBadge = `<div class="text-3xl filter drop-shadow-sm">🥉</div>`; }

        // Multi-Stage Progress Bar
        const p = c.progress;
        const fillBronze = Math.min(p, 30) / 30 * 100;
        const fillSilver = Math.min(Math.max(p - 30, 0), 30) / 30 * 100;
        const fillGold = Math.min(Math.max(p - 60, 0), 25) / 25 * 100;
        const fillCrystal = Math.min(Math.max(p - 85, 0), 15) / 15 * 100;

        const multiStageBar = `
            <div class="relative w-full h-8 mt-2 select-none">
                <div class="flex items-center gap-1 w-full h-4 absolute top-2 rounded-full overflow-hidden shadow-inner">
                    <div class="h-full bg-orange-100 flex-grow relative" style="flex: 30;" title="Bronze Stage">
                        <div class="h-full bg-orange-500 transition-all duration-1000" style="width: ${fillBronze}%"></div>
                    </div>
                    <div class="h-full bg-slate-100 flex-grow relative" style="flex: 30;" title="Silver Stage">
                        <div class="h-full bg-slate-400 transition-all duration-1000" style="width: ${fillSilver}%"></div>
                    </div>
                    <div class="h-full bg-yellow-50 flex-grow relative" style="flex: 25;" title="Gold Stage">
                        <div class="h-full bg-yellow-400 transition-all duration-1000" style="width: ${fillGold}%"></div>
                    </div>
                    <div class="h-full bg-purple-50 flex-grow relative" style="flex: 15;" title="Crystal Stage">
                        <div class="h-full bg-purple-500 transition-all duration-1000" style="width: ${fillCrystal}%"></div>
                    </div>
                </div>
                
                <div class="absolute top-0 transform -translate-x-1/2 transition-all duration-1000 z-10 filter drop-shadow-md" style="left: ${Math.min(p, 100)}%;">
                   <div class="text-rose-600 text-xl animate-bounce"><i class="fas fa-map-marker-alt"></i></div>
                </div>
            </div>
            
            <div class="flex justify-between text-[9px] text-gray-400 font-bold uppercase -mt-1 px-1">
                <span>Start</span>
                <span>Bronze</span>
                <span>Silver</span>
                <span>Gold</span>
                <span>Diamond</span>
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
        <div class="bg-white rounded-[2.5rem] shadow-xl border-4 border-indigo-50 overflow-hidden mb-6 transition-all hover:shadow-2xl hover:border-indigo-200 group pop-in">
            <div class="${headerColor} p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-5">
                    <div class="relative">
                        ${rankBadge}
                        <div class="text-5xl md:text-6xl filter drop-shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-6">${c.logo}</div>
                    </div>
                    <div>
                        <h4 class="font-title text-3xl text-indigo-900 leading-tight">${c.name}</h4>
                        <div class="flex flex-wrap gap-2 mt-2 items-center">
                            ${diffBadge}
                            <span class="text-[10px] font-black bg-white text-indigo-600 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest shadow-sm"><i class="fas fa-users mr-1"></i>${c.studentCount} Heroes</span>
                        </div>
                    </div>
                </div>
                <div class="bg-white/60 backdrop-blur-md rounded-3xl p-4 flex items-center gap-6 border border-white shadow-inner">
                    <div class="text-center px-2 border-r border-indigo-100">
                        <div class="font-title text-4xl text-indigo-600 leading-none">${starsFormatted}</div>
                        <div class="text-[9px] font-black text-indigo-400 uppercase mt-1">Stars Collected</div>
                    </div>
                    <div class="text-center px-2">
                        <div class="font-title text-4xl text-amber-500 leading-none">${avgStars}</div>
                        <div class="text-[9px] font-black text-amber-400 uppercase mt-1">Avg / Hero</div>
                    </div>
                </div>
            </div>
            <div class="p-6 bg-gradient-to-b from-transparent to-indigo-50/30">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="space-y-4">
                        <div class="bg-white p-4 rounded-3xl shadow-sm border border-indigo-50">
                            <div class="flex justify-between items-end mb-1 px-1">
                                <span class="text-xs font-black text-indigo-900 uppercase tracking-widest">League Progress</span>
                                <span class="font-title text-xl text-indigo-600">${c.progress.toFixed(0)}%</span>
                            </div>
                            
                            ${multiStageBar}
                            
                            <div class="text-center mt-2 flex items-center justify-center gap-2">
                                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">Target: ${c.goals.diamond} Stars</p>
                                ${goalIconHtml}
                            </div>
                        </div>
                        <div class="bg-indigo-600 rounded-[2rem] p-4 flex items-center justify-between shadow-lg">
                            <span class="text-[10px] font-black text-indigo-100 uppercase tracking-widest ml-2 italic">Leading the Charge</span>
                            <div class="flex -space-x-3 pr-2">${topHeroesHtml}</div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div class="bg-white p-3 rounded-3xl border-2 border-orange-100 shadow-sm flex flex-col items-center justify-center text-center">
                            <i class="fas fa-fire text-2xl text-orange-500 mb-1"></i>
                            <div class="font-title text-lg text-gray-800">+${weeklyFormatted}</div>
                            <div class="text-[8px] font-black text-orange-400 uppercase">${weeklyGrowth}</div>
                        </div>
                        <div class="bg-white p-3 rounded-3xl border-2 border-blue-100 shadow-sm flex flex-col items-center justify-center text-center">
                            <i class="fas fa-magic text-2xl text-blue-500 mb-1"></i>
                            <div class="font-bold text-gray-800 text-sm truncate w-full capitalize">${skillName}</div>
                            <div class="text-[8px] font-black text-blue-400 uppercase">Top Talent</div>
                        </div>
                        <div class="bg-white p-3 rounded-3xl border-2 border-yellow-100 shadow-sm flex flex-col items-center justify-center text-center">
                            <i class="fas fa-coins text-2xl text-yellow-500 mb-1"></i>
                            <div class="font-title text-lg text-gray-800">${c.totalGold}</div>
                            <div class="text-[8px] font-black text-yellow-500 uppercase">Bank of ${c.name}</div>
                        </div>
                        <div class="bg-white p-3 rounded-3xl border-2 border-green-100 shadow-sm flex flex-col items-center justify-center text-center">
                            <i class="fas fa-heart text-2xl text-green-500 mb-1"></i>
                            <div class="font-bold text-gray-800 text-sm capitalize">${spiritRank}</div>
                            <div class="text-[8px] font-black text-green-400 uppercase">Class Spirit</div>
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
            const mapArea = list.querySelector('.league-map-wrapper') || list.firstElementChild;

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
            import('./modals.js').then(m => m.openZoneOverviewModal(zoneType));
        });
    });
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
            .reduce((sum, log) => sum + log.stars, 0);

        // B. 3-Star Streak Calculation (Consecutive lessons with 3+ stars)
        // We exclude small bonuses like 'welcome_back' so they don't break the streak
        const streakLogs = studentLogs
            .filter(l => !['welcome_back', 'scholar_s_bonus', 'story_weaver'].includes(l.reason))
            .sort((a, b) => utils.parseDDMMYYYY(b.date) - utils.parseDDMMYYYY(a.date)); // Newest first

        let streak = 0;
        for (const log of streakLogs) {
            if (log.stars >= 3) {
                streak++;
            } else {
                break; // Streak ends if a main lesson wasn't 3 stars
            }
        }

        // C. Top Reason of the Month
        const reasonCounts = {};

        monthlyLogs.forEach(log => {
            if (log.reason) {
                if (!reasonCounts[log.reason]) reasonCounts[log.reason] = 0;
                reasonCounts[log.reason] += log.stars;
            }
        });

        // Sort reasons by highest star count
        const topReasonEntry = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
        const topSkill = topReasonEntry ? topReasonEntry[0] : null;

        // D. Academic Avg
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
                if (val > 0) { acadSum += val; acadCount++; }
            }
        });
        const academicAvg = acadCount > 0 ? (acadSum / acadCount) : 0;

        // Use the centralized helper for the tie-breaker specific stats
        const tieBreakerStats = utils.calculateStudentStats(studentId, monthlyLogs, studentScores.filter(s => {
            if (!s.date) return false;
            const sDate = new Date(s.date);
            return sDate.getMonth() === currentMonthIndex && sDate.getFullYear() === currentYear;
        }));

        return {
            weeklyStars, topSkill, streak,
            academicAvg,
            ...tieBreakerStats // Brings in count3, count2, uniqueReasons, and recalculates academicAvg strictly for tie-breaking
        };
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
    const sortStudents = utils.sortStudentsByTieBreaker;

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

        return html;
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
                            <h3 class="font-bold text-gray-800 text-lg truncate">
    ${s.heroClass && HERO_CLASSES[s.heroClass] ? HERO_CLASSES[s.heroClass].icon : ''} ${s.name} 
    <span class="text-xs font-normal opacity-60">(${s.heroClass || 'Novice'})</span>
</h3>
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

            // Re-map score to stars for sort Students By Tie Breaker
            classData.students = classData.students.map(s => ({ ...s, stars: s.score }));
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
                                <h4 class="font-title text-xl ${nameColor} truncate leading-tight mb-1">
    ${s.heroClass && HERO_CLASSES[s.heroClass] ? HERO_CLASSES[s.heroClass].icon : ''} ${s.name}
</h4>
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
    list.innerHTML = state.get('allTeachersClasses').sort((a, b) => a.name.localeCompare(b.name)).map(c => {
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
    const studentsInClass = state.get('allStudents').filter(s => s.classId === currentManagingClassId).sort((a, b) => a.name.localeCompare(b.name));
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
        .sort((a, b) => a.name.localeCompare(b.name))
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
        const selectedClass = allTeachersClasses.find(c => c.id === selectedClassId);
        if (selectedClass) {
            document.getElementById('selected-class-name').innerText = selectedClass.name;
            document.getElementById('selected-class-level').innerText = selectedClass.questLevel;
            document.getElementById('selected-class-logo').innerText = selectedClass.logo;
            renderAwardStarsStudentList(selectedClassId);
        } else {
            // Class might have been deleted but ID still in localStorage
            document.getElementById('selected-class-name').innerText = 'Select a class...';
            document.getElementById('selected-class-level').innerText = '';
            document.getElementById('selected-class-logo').innerText = '❓';
            studentListContainer.innerHTML = `<p class="text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl text-lg col-span-full">Please select a class above to award stars.</p>`;
        }
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

            // --- 1. PRE-CALCULATE BOON ELIGIBILITY ---
            const allScores = state.get('allStudentScores');
            // Map students to scores
            const leaderboard = studentsInClass.map(s => {
                const sc = allScores.find(score => score.id === s.id);
                return { id: s.id, stars: sc ? (Number(sc.monthlyStars) || 0) : 0 };
            });
            // Sort ascending (Lowest stars first)
            leaderboard.sort((a, b) => a.stars - b.stars);
            // Identify Bottom 3 IDs
            const bottomThreeIds = leaderboard.slice(0, 3).map(x => x.id);
            // Identify Ties
            const scoreCounts = {};
            leaderboard.forEach(x => { scoreCounts[x.stars] = (scoreCounts[x.stars] || 0) + 1; });

            listContainer.innerHTML = studentsInClass.map((s, index) => {
                const reigningHero = state.get('reigningHero');
                const isReigningHero = reigningHero && reigningHero.id === s.id;
                const scoreData = state.get('allStudentScores').find(score => score.id === s.id) || {};
                const totalStars = scoreData.totalStars || 0;
                const goldCount = scoreData.gold !== undefined ? scoreData.gold : (scoreData.totalStars || 0);
                const monthlyStars = scoreData.monthlyStars || 0;
                const starsToday = state.get('todaysStars')[s.id]?.stars || 0;
                const reasonToday = state.get('todaysStars')[s.id]?.reason;
                const cloudShape = cloudShapes[index % cloudShapes.length];

                const isMarkedAbsentToday = state.get('allAttendanceRecords').some(r => r.studentId === s.id && r.date === today);
                const wasAbsentLastTime = previousLessonDate && state.get('allAttendanceRecords').some(r => r.studentId === s.id && r.date === previousLessonDate);

                const isPresentToday = starsToday > 0 || reasonToday === 'marked_present' || reasonToday === 'welcome_back';
                const isVisuallyAbsent = isMarkedAbsentToday || (wasAbsentLastTime && !isPresentToday);
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
                  <div class="coin-pill ${starsToday > 0 ? 'animate-glitter' : ''}" title="Current Gold">
                      <i class="fas fa-coins text-yellow-400"></i>
                      <span id="student-gold-display-${s.id}">${goldCount}</span>
                  </div>
                `;

                // --- BOON BUTTON VISUAL LOGIC ---
                // Check eligibility based on the pre-calculated leaderboard
                const myLeaderboardData = leaderboard.find(x => x.id === s.id);
                const isEligible = bottomThreeIds.includes(s.id) || (myLeaderboardData && scoreCounts[myLeaderboardData.stars] > 1);

                let boonBtnHtml = '';
                if (isEligible) {
                    boonBtnHtml = `
                    <button class="boon-btn absolute top-2 left-14 w-8 h-8 rounded-full bg-rose-100 text-rose-500 hover:bg-rose-200 transition-colors shadow-sm border border-rose-200 z-30" 
                            data-receiver-id="${s.id}" title="Bestow Hero's Boon">
                        <i class="fas fa-heart"></i>
                    </button>`;
                } else {
                    // Visually disabled state (Greyed out)
                    boonBtnHtml = `
                    <button class="boon-btn absolute top-2 left-14 w-8 h-8 rounded-full bg-gray-100 text-gray-300 border border-gray-200 z-30 cursor-not-allowed opacity-60" 
                            data-receiver-id="${s.id}" title="Not eligible for Boon">
                        <i class="fas fa-heart-broken"></i>
                    </button>`;
                }

                return `
               <div class="student-cloud-card ${cloudShape} ${isVisuallyAbsent ? 'is-absent' : ''} ${isReigningHero ? 'reigning-hero-card' : ''}" data-studentid="${s.id}" style="animation: float-card ${4 + Math.random() * 4}s ease-in-out infinite;">
               ${isReigningHero ? '<div class="hero-crown-badge">👑</div>' : ''}
               <div class="absence-controls">
               ${absenceButtonHtml}
                    </div>
                    ${avatarHtml}
                    ${coinHtml} 
                    ${boonBtnHtml}
                    <button id="post-award-undo-${s.id}" class="post-award-undo-btn bubbly-button ${starsToday > 0 ? '' : 'hidden'}" title="Undo Award"><i class="fas fa-times"></i></button>
                    
                    <div class="card-content-wrapper">
                        <h3 class="font-title text-2xl text-gray-800 text-center">
                            <span class="text-sm opacity-70 block mb-1">
                                ${s.heroClass && HERO_CLASSES[s.heroClass] ? HERO_CLASSES[s.heroClass].icon : ''} ${s.heroClass || ''}
                            </span>
                            ${s.name}
                        </h3>
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
        if (absenceControls) {
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

// Accepts optional 'customLogs' for historical views. 
// If null, defaults to state.allAwardLogs (Current Month).
export function renderCalendarTab(customLogs = null) {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    // Determine which dataset to use
    const logsToRender = customLogs || state.get('allAwardLogs');

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
    today.setHours(0, 0, 0, 0);
    document.getElementById('prev-month-btn').disabled = calendarCurrentDate <= constants.competitionStart;
    document.getElementById('next-month-btn').disabled = calendarCurrentDate.getMonth() === constants.competitionEnd.getMonth() && calendarCurrentDate.getFullYear() === constants.competitionEnd.getFullYear();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const isRecentView = calendarCurrentDate >= thirtyDaysAgo;

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

        // 1. Check for Global Holidays
        const yyyy = day.getFullYear();
        const mm = String(day.getMonth() + 1).padStart(2, '0');
        const dd = String(day.getDate()).padStart(2, '0');
        const compDate = `${yyyy}-${mm}-${dd}`;

        const globalHoliday = (state.get('schoolHolidayRanges') || []).find(h => compDate >= h.start && compDate <= h.end);

        // 2. Check for Manual Cancellations
        const myClasses = state.get('allTeachersClasses');
        const dayOfWeekStr = day.getDay().toString();
        const myScheduledClasses = myClasses.filter(c => c.scheduleDays && c.scheduleDays.includes(dayOfWeekStr));
        const classesOnThisDay = utils.getClassesOnDay(dateString, state.get('allSchoolClasses'), state.get('allScheduleOverrides'));
        const myClassIds = myClasses.map(c => c.id);
        const myCancellations = state.get('allScheduleOverrides').filter(o =>
            o.date === dateString &&
            o.type === 'cancelled' &&
            myClassIds.includes(o.classId)
        );

        const isFullHoliday = globalHoliday || (myScheduledClasses.length > 0 && classesOnThisDay.length === 0 && myCancellations.length > 0);
        const dayNumberHtml = isToday ? `<span class="today-date-highlight shadow-md transform scale-110">${i}</span>` : i;

        if (isFullHoliday) {
            const themeClass = globalHoliday ? `holiday-theme-${globalHoliday.type}` : 'bg-red-50 border-red-200';
            const labelText = globalHoliday ? (globalHoliday.type === 'christmas' ? 'Winter Break' : globalHoliday.name) : 'No School';
            const icon = globalHoliday ? (globalHoliday.type === 'christmas' ? '❄️' : (globalHoliday.type === 'easter' ? '🐰' : '📅')) : '⛔';

            dayCell.className = `border rounded-md p-1 calendar-day-cell calendar-holiday-cell ${themeClass} relative overflow-hidden flex flex-col`;
            dayCell.innerHTML = `
                <div class="font-bold text-right text-gray-400 opacity-50 z-10 relative">${i}</div>
                <div class="absolute inset-0 flex flex-col items-center justify-center opacity-80 pointer-events-none">
                    <span class="text-3xl mb-1">${icon}</span>
                    <span class="font-title text-xs uppercase tracking-wider font-bold text-gray-500 text-center leading-tight px-1">${labelText}</span>
                </div>
            `;
        } else {
            // --- RENDER NORMAL DAY ---
            dayCell.className = `border rounded-md p-1 calendar-day-cell flex flex-col ${isFuture ? 'bg-white future-day' : 'bg-white logbook-day-btn'}`;

            const starHtml = totalStarsThisDay > 0 ? `<div class="calendar-star-count text-center text-amber-600 font-bold -mt-4 mb-1 text-sm relative z-10"><i class="fas fa-star"></i> ${totalStarsThisDay}</div>` : '';

            // --- NEW: Event Icons Map ---
            const eventIcons = {
                '2x Star Day': '⭐ x2',
                'Reason Bonus Day': '✨ Bonus',
                'Vocabulary Vault': '🔑 Vocab',
                'The Unbroken Chain': '🔗 Chain',
                'Grammar Guardians': '🛡️ Grammar',
                'The Scribe\'s Sketch': '✏️ Sketch',
                'Five-Sentence Saga': '📜 Saga'
            };

            const questEventsOnThisDay = state.get('allQuestEvents').filter(e => e.date === dateString);

            // --- NEW: Render Events as Banners (Outside Scroll) ---
            let questEventsHtml = questEventsOnThisDay.map(e => {
                const title = e.details?.title || e.type;
                const icon = eventIcons[e.type] || '📅 Event';
                // Vibrant Gradient Style
                return `
                <div class="relative group w-full mb-1 p-1 rounded-md bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-md border border-fuchsia-400 flex items-center justify-between z-20 cursor-help transition-transform hover:scale-105" title="${title}">
                    <div class="flex items-center gap-1.5 overflow-hidden">
                        <span class="text-[10px] font-bold bg-white/20 px-1 rounded">${icon}</span>
                        <span class="font-title text-[10px] font-bold truncate leading-tight">${title}</span>
                    </div>
                    <button class="delete-event-btn bg-white/20 hover:bg-white/40 text-white rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 transition-colors" data-id="${e.id}" data-name="${title}">
                        <i class="fas fa-times text-[8px]"></i>
                    </button>
                </div>`;
            }).join('');

            // Classes (Inside Scroll)
            let classesHtml = classesOnThisDay.map(c => {
                const color = c.color || constants.classColorPalettes[utils.simpleHashCode(c.id) % constants.classColorPalettes.length];
                const timeDisplay = (c.timeStart && c.timeEnd) ? `${c.timeStart}-${c.timeEnd}` : (c.timeStart || '');

                // --- NEW: Check for Scheduled Test (Smart Match) ---
                const testAssignment = state.get('allQuestAssignments').find(a =>
                    a.classId === c.id &&
                    a.testData &&
                    utils.datesMatch(dateString, a.testData.date)
                );

                // 2. Create the Indicator
                const testIndicator = testAssignment
                    ? `<div class="absolute -top-1 -right-1 z-20">
                         <span class="relative flex h-3 w-3">
                           <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                           <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                         </span>
                       </div>
                       <span class="absolute top-[-4px] right-[-4px] bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-bl-md rounded-tr-md shadow-sm z-10" title="Test: ${testAssignment.testData.title}">📝 TEST</span>`
                    : '';
                // -------------------------------------

                return `
                <div class="relative text-xs px-1.5 py-1 rounded ${color.bg} ${color.text} border-l-4 ${color.border} shadow-sm group hover:scale-[1.02] transition-transform" title="${c.name} (${timeDisplay})">
                    ${testIndicator}
                    <span class="font-bold block text-[10px] opacity-80">${timeDisplay}</span>
                    <span class="truncate block font-semibold">${c.logo} ${c.name}</span>
                </div>`;
            }).join('');

            dayCell.innerHTML = `
                <div class="font-bold text-right text-gray-800 text-sm mb-1">${dayNumberHtml}</div>
                ${starHtml}
                
                <!-- Events Area (Fixed Top) -->
                <div class="flex flex-col shrink-0">
                    ${questEventsHtml}
                </div>
                
                <!-- Classes Area (Scrollable) -->
                <div class="flex flex-col gap-1 mt-1 overflow-y-auto flex-grow custom-scrollbar" style="min-height: 0;">
                    ${classesHtml}
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
            classData.students.sort((a, b) => a.name.localeCompare(b.name));
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

export async function renderAdventureLogTab() {
    const classSelect = document.getElementById('adventure-log-class-select');
    const monthFilter = document.getElementById('adventure-log-month-filter');

    if (!classSelect || !monthFilter) return;

    const classVal = state.get('globalSelectedClassId');
    const optionsHtml = state.get('allTeachersClasses').sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${c.logo} ${c.name}</option>`).join('');
    classSelect.innerHTML = '<option value="">Select a class to view its log...</option>' + optionsHtml;

    if (classVal) {
        classSelect.value = classVal;
    }

    state.get('currentLogFilter').classId = classVal;
    document.getElementById('log-adventure-btn').disabled = !classVal;
    document.getElementById('quest-assignment-btn').disabled = !classVal;
    document.getElementById('attendance-chronicle-btn').disabled = !classVal;
    document.getElementById('hall-of-heroes-btn').disabled = !classVal;

    const monthVal = monthFilter.value;

    // --- FIX: Generate month list from competition start instead of memory ---
    const availableMonths = [];
    const now = new Date();
    // Start from the first day of the competition start month
    let loopDate = new Date(constants.competitionStart.getFullYear(), constants.competitionStart.getMonth(), 1);

    while (loopDate <= now) {
        const month = (loopDate.getMonth() + 1).toString().padStart(2, '0');
        const year = loopDate.getFullYear();
        availableMonths.unshift(`${month}-${year}`); // Newest months first
        loopDate.setMonth(loopDate.getMonth() + 1);
    }

    const currentMonth = utils.getDDMMYYYY(new Date()).substring(3);

    monthFilter.innerHTML = availableMonths.map(monthKey => {
        const [m, y] = monthKey.split('-').map(Number);
        const d = new Date(y, m - 1, 1);
        const display = d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
        return `<option value="${monthKey}">${display}</option>`;
    }).join('');

    monthFilter.value = monthVal || currentMonth;
    state.get('currentLogFilter').month = monthFilter.value;

    await renderAdventureLog();
}

export async function renderAdventureLog() {
    const feed = document.getElementById('adventure-log-feed');
    if (!feed) return;

    const currentLogFilter = state.get('currentLogFilter');

    if (!currentLogFilter.classId) {
        feed.innerHTML = `<p class="text-center text-gray-500 bg-white/50 p-6 rounded-2xl">Please select one of your classes to see its Adventure Log.</p>`;
        return;
    }

    // --- FIX: ON-DEMAND FETCHING FOR HISTORICAL LOGS ---
    let logsForClass = [];
    const [month, year] = currentLogFilter.month.split('-').map(Number);
    const viewMonthStart = new Date(year, month - 1, 1);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (viewMonthStart >= thirtyDaysAgo) {
        // Use real-time state for recent logs
        logsForClass = state.get('allAdventureLogs').filter(log => {
            if (log.classId !== currentLogFilter.classId) return false;
            const dateObj = utils.parseFlexibleDate(log.date);
            if (!dateObj || isNaN(dateObj.getTime())) return false;
            const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
            const y = dateObj.getFullYear();
            return `${m}-${y}` === currentLogFilter.month;
        });
    } else {
        // Fetch from Firestore on-demand for older months
        feed.innerHTML = `
            <div class="diary-page empty">
                <p class="text-center text-gray-500">
                    <i class="fas fa-spinner fa-spin mr-2"></i>
                    Reading the archives for ${currentLogFilter.month}...
                </p>
            </div>`;
        try {
            const { fetchAdventureLogsForMonth } = await import('../db/queries.js');
            logsForClass = await fetchAdventureLogsForMonth(currentLogFilter.classId, year, month);
        } catch (error) {
            console.error("Historical log fetch failed:", error);
        }
    }

    if (logsForClass.length === 0) {
        const selectedMonthDisplay = document.getElementById('adventure-log-month-filter').options[document.getElementById('adventure-log-month-filter').selectedIndex]?.text;
        feed.innerHTML = `<div class="diary-page empty"><p class="text-center text-gray-500">The diary is empty for ${selectedMonthDisplay}.<br>Award some stars and then 'Log Today's Adventure'!</p></div>`;
        return;
    }

    // Sort descending by date
    logsForClass.sort((a, b) => utils.parseFlexibleDate(b.date) - utils.parseFlexibleDate(a.date));

    feed.innerHTML = logsForClass.map(log => {
        const dateObj = utils.parseFlexibleDate(log.date);
        const displayDate = dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' }) : log.date;
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
                    <div class="diary-hero bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md">
                        <i class="fas fa-crown mr-1"></i> 
                        <span class="uppercase tracking-tighter text-[10px] opacity-90 mr-1">Hero:</span>
                        ${log.hero}
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
            </div>`;
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
