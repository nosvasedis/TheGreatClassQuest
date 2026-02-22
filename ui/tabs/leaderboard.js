// /ui/tabs/leaderboard.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import * as modals from '../modals.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';

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

    // --- CALCULATIONS ---
    const allStudentScores = state.get('allStudentScores') || [];
    const allStudents = state.get('allStudents') || [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const classScores = classesInLeague.map(c => {
        const studentsInClass = allStudents.filter(s => s.classId === c.id);
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

    const { generateLeagueMapHtml } = await import('../../features/worldMap.js');
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
            import('../modals.js').then(m => m.openZoneOverviewModal(zoneType));
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
        let count3Star = 0; // Total 3-stars (kept for tie-breaking)
        let count2Star = 0;

        monthlyLogs.forEach(log => {
            if (log.reason) {
                if (!reasonCounts[log.reason]) reasonCounts[log.reason] = 0;
                reasonCounts[log.reason] += log.stars;
            }
            if (log.stars >= 3) count3Star++;
            else if (log.stars >= 2) count2Star++;
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
                <div class="student-leaderboard-card relative p-3 rounded-xl mb-3 flex items-center justify-between transition-all ${cardClasses}">
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
