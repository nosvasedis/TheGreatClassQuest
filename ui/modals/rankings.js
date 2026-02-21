
// --- STUDENT RANKINGS MODAL (HERO RANKS ARCHIVE) ---
// --- STUDENT RANKINGS MODAL (HERO RANKS ARCHIVE) ---
export async function openStudentRankingsModal(resetDate = true) {
    const modalId = 'global-leaderboard-modal';
    const titleEl = document.getElementById('global-leaderboard-title');
    const contentEl = document.getElementById('global-leaderboard-content');
    
    // 1. Manage the Date (Default to last month if opening fresh)
    if (resetDate) {
        rankingsViewDate = new Date();
        rankingsViewDate.setMonth(rankingsViewDate.getMonth() - 1);
    }
    
    const activeMonthKey = rankingsViewDate.toISOString().substring(0, 7); // YYYY-MM
    const monthDisplay = rankingsViewDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    titleEl.innerHTML = `<i class="fas fa-trophy text-amber-500 mr-2"></i>Hero Ranks`;
    contentEl.innerHTML = `<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-purple-500"></i><p class="mt-2 text-gray-500">Loading Archives for ${monthDisplay}...</p></div>`;
    
    // 2. Show Modal (Only animate the first time it opens)
    if (resetDate) {
        showAnimatedModal(modalId);
    }

    // 3. Fetch Data (Logs & History)
    let monthlyScores = {};
    let logs = [];
    
    try {
        const { fetchLogsForMonth } = await import('../db/queries.js');
        const { fetchMonthlyHistory } = await import('../state.js'); 
        const [year, month] = activeMonthKey.split('-').map(Number);
        
        // Try fetching detailed logs first (for tie-breakers)
        const logsPromise = fetchLogsForMonth(year, month);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
        
        logs = await Promise.race([logsPromise, timeoutPromise]).catch(e => []);
        
        if (!logs || logs.length === 0) {
            monthlyScores = await fetchMonthlyHistory(activeMonthKey);
        } else {
            logs.forEach(log => {
                monthlyScores[log.studentId] = (monthlyScores[log.studentId] || 0) + log.stars;
            });
        }
    } catch (e) { console.error(e); }

    // 4. Prepare Data
    const leaguesPromise = import('../constants.js').then(c => c.questLeagues);
    const allLeagues = (await leaguesPromise).default || ['Junior A', 'Junior B', 'A', 'B', 'C', 'D'];
    const myClasses = state.get('allTeachersClasses').sort((a,b) => a.name.localeCompare(b.name));

    // 5. Render UI Structure with Navigation
    contentEl.innerHTML = `
        <div class="flex items-center justify-between mb-4 bg-indigo-50 p-2 rounded-xl border border-indigo-100 shadow-sm">
            <button id="rank-prev-month" class="w-8 h-8 rounded-full bg-white text-indigo-600 shadow hover:bg-indigo-100 transition-colors flex items-center justify-center">
                <i class="fas fa-chevron-left"></i>
            </button>
            <span class="font-title text-lg text-indigo-900">${monthDisplay}</span>
            <button id="rank-next-month" class="w-8 h-8 rounded-full bg-white text-indigo-600 shadow hover:bg-indigo-100 transition-colors flex items-center justify-center">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>

        <div class="flex justify-center gap-4 mb-4 border-b border-gray-200 pb-4">
            <button id="rank-tab-global" class="px-6 py-2 rounded-full font-bold text-sm transition-all bg-indigo-600 text-white shadow-md">
                <i class="fas fa-globe mr-2"></i>Global League
            </button>
            <button id="rank-tab-class" class="px-6 py-2 rounded-full font-bold text-sm transition-all bg-white text-gray-500 hover:bg-gray-100 border border-gray-200">
                <i class="fas fa-chalkboard-teacher mr-2"></i>My Class
            </button>
        </div>

        <div id="rank-filter-container" class="mb-4"></div>

        <div id="ranks-list-container" class="space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar"></div>
    `;

    // --- NAVIGATION LISTENERS ---
    document.getElementById('rank-prev-month').onclick = () => {
        rankingsViewDate.setMonth(rankingsViewDate.getMonth() - 1);
        openStudentRankingsModal(false); // Refresh without re-animating modal
    };
    document.getElementById('rank-next-month').onclick = () => {
        // Don't go past the current month
        if (rankingsViewDate.getMonth() === new Date().getMonth() && rankingsViewDate.getFullYear() === new Date().getFullYear()) return;
        rankingsViewDate.setMonth(rankingsViewDate.getMonth() + 1);
        openStudentRankingsModal(false);
    };

    // --- INTERNAL RENDER LOGIC ---
    const renderContent = (view, filterValue) => {
        const filterContainer = document.getElementById('rank-filter-container');
        const listContainer = document.getElementById('ranks-list-container');
        const allStudents = state.get('allStudents');
        const allClasses = state.get('allSchoolClasses');

        if (view === 'global') {
            const currentLeague = filterValue || allLeagues[0];
            const options = allLeagues.map(l => `<option value="${l}" ${l === currentLeague ? 'selected' : ''}>${l} League</option>`).join('');
            filterContainer.innerHTML = `<select id="rank-league-select" class="w-full p-3 border-2 border-indigo-100 rounded-xl bg-indigo-50 font-bold text-indigo-900 outline-none">${options}</select>`;
            const classesInLeague = allClasses.filter(c => c.questLevel === currentLeague);
            const classIds = classesInLeague.map(c => c.id);
            renderStudentList(allStudents.filter(s => classIds.includes(s.classId)), listContainer, monthlyScores);
            document.getElementById('rank-league-select').onchange = (e) => renderContent('global', e.target.value);
        } else {
            if (myClasses.length === 0) {
                listContainer.innerHTML = `<p class="text-center text-gray-500">No classes found.</p>`;
                return;
            }
            const currentClassId = filterValue || myClasses[0].id;
            const options = myClasses.map(c => `<option value="${c.id}" ${c.id === currentClassId ? 'selected' : ''}>${c.logo} ${c.name}</option>`).join('');
            filterContainer.innerHTML = `<select id="rank-class-select" class="w-full p-3 border-2 border-purple-100 rounded-xl bg-purple-50 font-bold text-purple-900 outline-none">${options}</select>`;
            renderStudentList(allStudents.filter(s => s.classId === currentClassId), listContainer, monthlyScores);
            document.getElementById('rank-class-select').onchange = (e) => renderContent('class', e.target.value);
        }
    };

    const renderStudentList = (students, container, scores) => {
        if (students.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-400 py-4">No students found in this category.</p>`;
            return;
        }

        const allWrittenScores = state.get('allWrittenScores');
        const [year, month] = activeMonthKey.split('-').map(Number);

        // 1. Calculate Stats EXACTLY like ceremony.js
        const ranked = students.map(s => {
            const cls = state.get('allSchoolClasses').find(c => c.id === s.classId);
            const sLogs = logs.filter(l => l.studentId === s.id);
            const score = scores[s.id] || 0;
            
            let count3 = 0, count2 = 0;
            const reasons = new Set();
            sLogs.forEach(l => {
                if (l.stars >= 3) count3++;
                else if (l.stars >= 2) count2++;
                if (l.reason) reasons.add(l.reason);
            });

            const sScores = allWrittenScores.filter(sc => {
                if(sc.studentId !== s.id || !sc.date) return false;
                const d = utils.parseFlexibleDate(sc.date);
                return d && d.getMonth() === (month - 1) && d.getFullYear() === year;
            });

            let acadSum = 0;
            sScores.forEach(sc => {
                if (sc.scoreNumeric !== null && sc.maxScore) acadSum += (sc.scoreNumeric/sc.maxScore)*100;
                else if (sc.scoreQualitative === 'Great!!!') acadSum += 100;
                else if (sc.scoreQualitative === 'Great!!') acadSum += 75;
            });
            const academicAvg = sScores.length > 0 ? acadSum / sScores.length : 0;

            return {
                ...s,
                stars: score,
                className: cls?.name,
                classLogo: cls?.logo,
                stats: { count3, count2, academicAvg, uniqueReasons: reasons.size }
            };
        }).sort((a, b) => {
            // 2. Sort EXACTLY like ceremony.js
            if (b.stars !== a.stars) return b.stars - a.stars;
            if (b.stats.count3 !== a.stats.count3) return b.stats.count3 - a.stats.count3;
            if (b.stats.count2 !== a.stats.count2) return b.stats.count2 - a.stats.count2;
            if (b.stats.uniqueReasons !== a.stats.uniqueReasons) return b.stats.uniqueReasons - a.stats.uniqueReasons;
            return b.stats.academicAvg - a.stats.academicAvg;
        });

        // 3. Assign Ranks EXACTLY like ceremony.js (handling visual ties)
        let currentRank = 1;
        const finalizedList = ranked.map((s, i) => {
            if (i > 0) {
                const prev = ranked[i-1];
                let isTie = s.stars === prev.stars && 
                            s.stats.count3 === prev.stats.count3 && 
                            s.stats.count2 === prev.stats.count2 &&
                            s.stats.uniqueReasons === prev.stats.uniqueReasons;
                
                // Academic average only breaks ties after the Top 3
                if (currentRank > 3) {
                    isTie = isTie && (Math.abs(s.stats.academicAvg - prev.stats.academicAvg) < 0.1);
                }
                
                if (!isTie) currentRank = i + 1;
            }
            return { ...s, ceremonyRank: currentRank };
        });

        // 4. Render the UI
        container.innerHTML = finalizedList.map((s) => {
            const rank = s.ceremonyRank;
            let icon = `<span class="text-gray-400 font-bold w-6 text-right">${rank}.</span>`;
            let bgClass = "bg-white";
            
            if (rank === 1) { icon = "🥇"; bgClass = "bg-amber-50 border border-amber-200"; }
            else if (rank === 2) { icon = "🥈"; bgClass = "bg-gray-50 border border-gray-200"; }
            else if (rank === 3) { icon = "🥉"; bgClass = "bg-orange-50 border border-orange-200"; }

            return `
                <div class="flex items-center justify-between p-3 rounded-xl ${bgClass} hover:shadow-sm transition-all mb-2">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <div class="text-xl w-8 text-center shrink-0">${icon}</div>
                        ${s.avatar ? `<img src="${s.avatar}" class="w-10 h-10 rounded-full object-cover">` : `<div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">${s.name.charAt(0)}</div>`}
                        <div class="min-w-0">
                            <div class="font-bold text-gray-800 truncate">${s.name}</div>
                            <div class="text-[10px] text-gray-500 truncate">${s.classLogo || ''} ${s.className || ''}</div>
                        </div>
                    </div>
                    <div class="font-title text-xl text-indigo-600 shrink-0">${s.stars} ⭐</div>
                </div>
            `;
        }).join('');
    };
    
    // Tab Listeners
    const btnGlobal = document.getElementById('rank-tab-global');
    const btnClass = document.getElementById('rank-tab-class');

    btnGlobal.onclick = () => {
        btnGlobal.className = "px-6 py-2 rounded-full font-bold text-sm transition-all bg-indigo-600 text-white shadow-md";
        btnClass.className = "px-6 py-2 rounded-full font-bold text-sm transition-all bg-white text-gray-500 hover:bg-gray-100 border border-gray-200";
        renderContent('global');
    };

    btnClass.onclick = () => {
        btnClass.className = "px-6 py-2 rounded-full font-bold text-sm transition-all bg-indigo-600 text-white shadow-md";
        btnGlobal.className = "px-6 py-2 rounded-full font-bold text-sm transition-all bg-white text-gray-500 hover:bg-gray-100 border border-gray-200";
        renderContent('class');
    };

    renderContent('global');
}

// Internal state for the Hall of Heroes month-browsing
let rankingsViewDate = new Date();
let hallOfHeroesViewDate = new Date();

export async function openHallOfHeroes() {
    const classId = document.getElementById('adventure-log-class-select').value;
    if (!classId) { showToast("Select a class first!", "info"); return; }
    
    // Reset view to the current month when opening
    hallOfHeroesViewDate = new Date();
    
    const modal = document.getElementById('history-modal');
    const selectEl = document.getElementById('history-month-select');
    
    // Setup Modal appearance
    selectEl.classList.add('hidden');
    showAnimatedModal('history-modal');

    renderHallOfHeroesContent(classId);
}

async function renderHallOfHeroesContent(classId) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const contentEl = document.getElementById('history-modal-content');
    const modalTitle = document.querySelector('#history-modal h2');

    const monthName = hallOfHeroesViewDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const currentMonth = hallOfHeroesViewDate.getMonth();
    const currentYear = hallOfHeroesViewDate.getFullYear();

    modalTitle.innerHTML = `<i class="fas fa-crown text-amber-500 mr-3"></i>${classData.name} Heroes`;

    // --- ON-DEMAND FETCH LOGIC ---
    let monthlyLogs = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const viewMonthStart = new Date(currentYear, currentMonth, 1);

    if (viewMonthStart >= thirtyDaysAgo) {
        // Use real-time state for recent logs
        monthlyLogs = state.get('allAdventureLogs').filter(l => {
            const d = utils.parseDDMMYYYY(l.date);
            return l.classId === classId && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
    } else {
        // Fetch from Firestore on-demand for older months
        contentEl.innerHTML = `
            <div class="text-center py-16 text-gray-500">
                <i class="fas fa-spinner fa-spin mr-2"></i>
                Opening the Archives for ${monthName}...
            </div>`;
        
        try {
            const { fetchAdventureLogsForMonth } = await import('../db/queries.js');
            monthlyLogs = await fetchAdventureLogsForMonth(classId, currentYear, currentMonth + 1);
        } catch (error) {
            console.error("Historical fetch failed:", error);
            monthlyLogs = [];
        }
    }
    
    // Sort logs by date (newest first)
    monthlyLogs.sort((a,b) => utils.parseDDMMYYYY(b.date) - utils.parseDDMMYYYY(a.date));

    let html = `
        <div class="flex items-center justify-between mb-6 bg-indigo-50 p-3 rounded-2xl border-2 border-indigo-100">
            <button id="hero-prev-month" class="w-10 h-10 rounded-full bg-white text-indigo-600 shadow hover:bg-indigo-100 transition-colors flex items-center justify-center">
                <i class="fas fa-chevron-left"></i>
            </button>
            <span class="font-title text-xl text-indigo-900">${monthName}</span>
            <button id="hero-next-month" class="w-10 h-10 rounded-full bg-white text-indigo-600 shadow hover:bg-indigo-100 transition-colors flex items-center justify-center">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;

    if (monthlyLogs.length === 0) {
        html += `
            <div class="text-center py-16 opacity-50">
                <div class="text-6xl mb-4">📜</div>
                <p class="font-bold text-gray-500">No heroes were crowned in ${monthName}.</p>
            </div>`;
    } else {
        html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">`;
        
        monthlyLogs.forEach(log => {
            const dateStr = utils.parseDDMMYYYY(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            
            // Find the student object to get their avatar
            const student = state.get('allStudents').find(s => s.name === log.hero && s.classId === classId);
            const avatarHtml = student?.avatar 
                ? `<img src="${student.avatar}" class="w-14 h-14 rounded-full border-4 border-white shadow-md object-cover">`
                : `<div class="w-14 h-14 rounded-full bg-indigo-500 border-4 border-white shadow-md flex items-center justify-center text-white font-bold">${log.hero.charAt(0)}</div>`;

            html += `
                <div class="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden group hover:scale-[1.02] transition-transform">
                    <div class="h-32 w-full relative">
                        <img src="${log.imageUrl}" class="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <div class="absolute bottom-2 left-3 text-white text-[10px] font-black uppercase tracking-tighter">${dateStr}</div>
                    </div>
                    
                    <div class="p-4 pt-0 relative">
                        <div class="absolute -top-7 right-4">
                            ${avatarHtml}
                        </div>
                        
                        <div class="mt-4">
                            <h4 class="font-title text-xl text-indigo-900 leading-tight mb-1">${log.hero}</h4>
                        </div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    contentEl.innerHTML = html;

    // Attach Nav Listeners
    document.getElementById('hero-prev-month').onclick = () => {
        hallOfHeroesViewDate.setMonth(hallOfHeroesViewDate.getMonth() - 1);
        renderHallOfHeroesContent(classId);
    };
    document.getElementById('hero-next-month').onclick = () => {
        // Prevent going into the future
        if (hallOfHeroesViewDate.getMonth() === new Date().getMonth() && hallOfHeroesViewDate.getFullYear() === new Date().getFullYear()) return;
        hallOfHeroesViewDate.setMonth(hallOfHeroesViewDate.getMonth() + 1);
        renderHallOfHeroesContent(classId);
    };
}

export function openBestowBoonModal(receiverId) {
    const receiver = state.get('allStudents').find(s => s.id === receiverId);
    if (!receiver) return;

    // --- RULE 1: DAILY LIMIT CHECK (Max 2 per class per day) ---
    const today = utils.getTodayDateString();
    const classBoonsToday = state.get('allAwardLogs').filter(l => 
        l.classId === receiver.classId && 
        l.date === today && 
        l.reason === 'peer_boon'
    ).length;

    if (classBoonsToday >= 2) {
        showToast("Daily limit reached: The class has already bestowed 2 Boons today!", "error");
        return;
    }

    // --- RULE 2: ELIGIBILITY CHECK ---
    // Criteria: Must be in Bottom 3 OR must be Tied with someone
    
    const scores = state.get('allStudentScores');
    const studentsInClass = state.get('allStudents').filter(s => s.classId === receiver.classId);

    // 1. Build Leaderboard
    const leaderboard = studentsInClass.map(s => {
        const scoreData = scores.find(sc => sc.id === s.id);
        return {
            id: s.id,
            stars: scoreData ? (Number(scoreData.monthlyStars) || 0) : 0
        };
    });

    // 2. Identify Bottom 3 Students (Sorted by lowest score)
    leaderboard.sort((a, b) => a.stars - b.stars);
    const bottomThreeIds = leaderboard.slice(0, 3).map(s => s.id);

    // 3. Identify Tied Students (Anyone with a score shared by another)
    const scoreCounts = {};
    leaderboard.forEach(s => {
        scoreCounts[s.stars] = (scoreCounts[s.stars] || 0) + 1;
    });
    
    const receiverData = leaderboard.find(s => s.id === receiverId);
    const isTied = receiverData && scoreCounts[receiverData.stars] > 1;
    const isBottomThree = bottomThreeIds.includes(receiverId);

    // 4. Final Validation
    if (!isBottomThree && !isTied) {
        showToast("Boons are for the Bottom 3 or Tied students only!", "error");
        return;
    }

    // --- PROCEED TO OPEN MODAL ---
    const modal = document.getElementById('bestow-boon-modal');
    document.getElementById('boon-receiver-name').innerText = receiver.name;
    modal.dataset.receiverId = receiverId;

    // Get all other students in the same class (Potential Senders)
    const classmates = studentsInClass.filter(s => s.id !== receiverId);
    const select = document.getElementById('boon-sender-select');
    
    if (classmates.length === 0) {
        select.innerHTML = `<option value="">No other students in class</option>`;
        document.getElementById('boon-confirm-btn').disabled = true;
    } else {
        select.innerHTML = classmates.map(s => {
            const scoreData = scores.find(sc => sc.id === s.id);
            const gold = scoreData?.gold !== undefined ? scoreData.gold : (scoreData?.totalStars || 0);
            // Disable if sender has less than 15 gold
            return `<option value="${s.id}" ${gold < 15 ? 'disabled' : ''}>${s.name} (${gold} Gold)</option>`;
        }).join('');
        document.getElementById('boon-confirm-btn').disabled = false;
    }

    showAnimatedModal('bestow-boon-modal');
}

export function openZoneOverviewModal(zoneType) {
    const league = state.get('globalSelectedLeague');
    if (!league) return;

    // 1. Zone Definitions
    const ZONE_CONFIG = {
        bronze: { 
            name: "Bronze Meadows", pct: 25, icon: "🛡️", 
            desc: "The lush beginning. Green fields and ancient forests.",
            bannerGradient: "from-emerald-400 to-teal-600",
            cardBorder: "border-emerald-200",
            iconBg: "bg-emerald-100",
            barGradient: "from-emerald-400 to-teal-500",
            textColor: "text-emerald-600",
            lightBg: "bg-emerald-50"
        },
        silver: { 
            name: "Silver Peaks", pct: 50, icon: "🏆", 
            desc: "The frozen mountains. Only the brave cross the bridge.",
            bannerGradient: "from-cyan-400 to-blue-600",
            cardBorder: "border-cyan-200",
            iconBg: "bg-cyan-100",
            barGradient: "from-cyan-400 to-blue-500",
            textColor: "text-cyan-600",
            lightBg: "bg-cyan-50"
        },
        gold: { 
            name: "Golden Citadel", pct: 75, icon: "👑", 
            desc: "The royal desert city. Riches await within.",
            bannerGradient: "from-amber-300 to-orange-500",
            cardBorder: "border-amber-200",
            iconBg: "bg-amber-100",
            barGradient: "from-amber-300 to-orange-500",
            textColor: "text-amber-600",
            lightBg: "bg-amber-50"
        },
        diamond: { 
            name: "Crystal Realm", pct: 100, icon: "💎", 
            desc: "The floating void islands. The ultimate destination.",
            bannerGradient: "from-fuchsia-400 to-purple-600",
            cardBorder: "border-fuchsia-200",
            iconBg: "bg-fuchsia-100",
            barGradient: "from-fuchsia-400 to-purple-500",
            textColor: "text-fuchsia-600",
            lightBg: "bg-fuchsia-50"
        }
    };
    
    const config = ZONE_CONFIG[zoneType];
    const classes = state.get('allSchoolClasses').filter(c => c.questLevel === league);
    
    // --- CALCULATION LOGIC ---
    const BASE_GOAL = 18; 
    const SCALING_FACTOR = 2.5; 
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    let holidayDaysLost = 0;
    (state.get('schoolHolidayRanges') || []).forEach(range => {
        const start = new Date(range.start);
        const end = new Date(range.end);
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);
        const overlapStart = start > monthStart ? start : monthStart;
        const overlapEnd = end < monthEnd ? end : monthEnd;
        if (overlapStart <= overlapEnd) {
            holidayDaysLost += (Math.ceil(Math.abs(overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1);
        }
    });

    let monthModifier = (daysInMonth - holidayDaysLost) / daysInMonth;
    if (currentMonth === 5) monthModifier = 0.5;
    else monthModifier = Math.max(0.6, Math.min(1.0, monthModifier));

    const completed = [];
    const approaching = [];
    const far = [];

    const allStudentScores = state.get('allStudentScores') || [];

    classes.forEach(c => {
        const studentsInClass = state.get('allStudents').filter(s => s.classId === c.id);
        const studentCount = studentsInClass.length;
        
        let isCompletedThisMonth = false;
        if (c.questCompletedAt) {
            const completedDate = c.questCompletedAt.toDate();
            if (completedDate.getMonth() === currentMonth && completedDate.getFullYear() === currentYear) {
                isCompletedThisMonth = true;
            }
        }

        const dbDifficulty = c.difficultyLevel || 0;
        const effectiveDifficulty = isCompletedThisMonth ? Math.max(0, dbDifficulty - 1) : dbDifficulty;
        const adjustedGoalPerStudent = (BASE_GOAL + (effectiveDifficulty * SCALING_FACTOR)) * monthModifier;
        const diamondGoal = studentCount > 0 ? Math.round(studentCount * adjustedGoalPerStudent) : 18;

        const currentMonthlyStars = studentsInClass.reduce((sum, s) => {
            const scoreData = allStudentScores.find(sc => sc.id === s.id);
            return sum + (scoreData ? (Number(scoreData.monthlyStars) || 0) : 0);
        }, 0);

        const zoneTargetStars = (diamondGoal * (config.pct / 100));
        const remaining = Math.max(0, zoneTargetStars - currentMonthlyStars);
        
        let progressPct = diamondGoal > 0 ? (currentMonthlyStars / diamondGoal) * 100 : 0;
        if (isCompletedThisMonth && progressPct < 100) progressPct = 100;
        
        const info = { 
            name: c.name, 
            logo: c.logo, 
            progress: progressPct, 
            stars: currentMonthlyStars,
            remaining: remaining 
        };
        
        if (progressPct >= config.pct) completed.push(info);
        else if (progressPct >= (config.pct - 20)) approaching.push(info); 
        else far.push(info);
    });

    // --- NEW: SORT LISTS BY PROGRESS DESCENDING ---
    const sortDesc = (a, b) => {
        // Primary sort: Progress %
        if (b.progress !== a.progress) return b.progress - a.progress;
        // Secondary sort: Total Stars (Tie-breaker)
        return b.stars - a.stars;
    };
    
    completed.sort(sortDesc);
    approaching.sort(sortDesc);
    far.sort(sortDesc);

    const formatStarValue = (val) => {
        return val % 1 !== 0 ? val.toFixed(1) : val.toFixed(0);
    };

    // 5. Render
    const titleEl = document.getElementById('milestone-modal-title');
    const contentEl = document.getElementById('milestone-modal-content');
    
    titleEl.innerHTML = ``;
    titleEl.className = "hidden"; 

    const renderSection = (list, title, type) => {
        if (list.length === 0) return '';
        
        let icon = type === 'done' ? '✅' : (type === 'near' ? '🔥' : '🔭');
        let titleColor = type === 'done' ? 'text-green-600' : 'text-gray-500';
        
        return `
            <div class="mb-8 animate-fade-in">
                <div class="flex items-center gap-3 mb-4 pl-2">
                    <span class="text-2xl filter drop-shadow-sm">${icon}</span>
                    <h4 class="text-lg font-black ${titleColor} uppercase tracking-widest">${title}</h4>
                    <span class="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold shadow-inner">${list.length} Classes</span>
                </div>
                
                <div class="grid grid-cols-1 gap-4">
                    ${list.map(c => {
                        let badge;
                        let cardStyle = `bg-white border-4 ${config.cardBorder}`;
                        let glowEffect = "";
                        
                        const remainingFormatted = formatStarValue(c.remaining);

                        if (type === 'done') {
                            badge = `<div class="bg-gradient-to-r from-green-400 to-emerald-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md transform -rotate-2">Completed</div>`;
                            cardStyle = `bg-gradient-to-br from-white to-green-50 border-4 border-green-300`;
                            glowEffect = "shadow-[0_0_15px_rgba(34,197,94,0.3)]";
                        } else {
                            badge = `<div class="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-gray-200 shadow-sm"><span class="text-rose-500 mr-1">${remainingFormatted}</span> Stars Left</div>`;
                        }

                        const starsFormatted = formatStarValue(c.stars);
                        const barFill = Math.min(100, (c.progress / config.pct) * 100);

                        return `
                        <div class="group relative p-5 rounded-[2rem] ${cardStyle} ${glowEffect} shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                            <div class="absolute inset-0 opacity-[0.03]" style="background-image: radial-gradient(#000 1px, transparent 1px); background-size: 20px 20px;"></div>
                            
                            <div class="relative z-10 flex items-center gap-5">
                                <div class="w-16 h-16 rounded-2xl ${config.iconBg} flex items-center justify-center text-4xl shadow-inner transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500">
                                    ${c.logo}
                                </div>
                                
                                <div class="flex-grow min-w-0">
                                    <div class="flex justify-between items-center mb-2">
                                        <div class="font-title text-xl text-gray-800 truncate tracking-tight">${c.name}</div>
                                        ${badge}
                                    </div>
                                    
                                    <div class="h-6 bg-gray-100 rounded-full border border-gray-200 overflow-hidden relative shadow-inner">
                                        <div class="h-full bg-gradient-to-r ${config.barGradient} relative transition-all duration-1000" style="width: ${barFill}%">
                                            <div class="absolute inset-0 w-full h-full opacity-30" 
                                                 style="background-image: linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent); background-size: 1rem 1rem;">
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="flex justify-between mt-2 text-xs font-bold text-gray-400 uppercase tracking-wide">
                                        <span><i class="fas fa-star text-amber-400 mr-1"></i>${starsFormatted} Collected</span>
                                        <span class="${config.textColor}">${c.progress.toFixed(0)}% Overall</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
    };

    contentEl.innerHTML = `
        <div class="relative overflow-hidden p-8 rounded-[2.5rem] bg-gradient-to-br ${config.bannerGradient} shadow-2xl text-white mb-8 border-4 border-white ring-4 ring-${config.color}-100 transform transition-transform hover:scale-[1.01]">
            <div class="absolute -right-6 -bottom-6 text-9xl opacity-20 transform rotate-12 filter blur-sm pointer-events-none">${config.icon}</div>
            
            <div class="relative z-10">
                <div class="flex items-center gap-3 mb-2">
                     <span class="text-4xl filter drop-shadow-md animate-bounce-slow">${config.icon}</span>
                     <h3 class="font-title text-4xl text-shadow-md tracking-wide">${config.name}</h3>
                </div>
                <p class="text-lg font-medium opacity-90 italic max-w-lg leading-relaxed">"${config.desc}"</p>
                
                <div class="mt-6 inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-5 py-2 rounded-full border border-white/40 shadow-lg">
                    <i class="fas fa-flag text-yellow-300"></i> 
                    <span class="font-black uppercase tracking-wider text-xs">Requirement: ${config.pct}% Total Progress</span>
                </div>
            </div>
        </div>
        
        <div class="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar pb-8">
            ${renderSection(completed, "Conquered", 'done')}
            ${renderSection(approaching, "Approaching", 'near')}
            ${renderSection(far, "On the Way", 'far')}
        </div>
    `;

    import('./modals.js').then(m => m.showAnimatedModal('milestone-details-modal'));
}

// --- PRODIGY OF THE MONTH FEATURE (FIXED) ---

// Local state for navigation
let prodigyViewDate = new Date();

export async function openProdigyModal() {
    const classSelect = document.getElementById('prodigy-class-select');
    const allTeachersClasses = state.get('allTeachersClasses');
    
    // 1. Reset Date: Default to LAST month
    prodigyViewDate = new Date();
    prodigyViewDate.setDate(1); 
    prodigyViewDate.setMonth(prodigyViewDate.getMonth() - 1);
    
    // 2. Populate Dropdown
    classSelect.innerHTML = '<option value="">Select a Class...</option>' + 
        allTeachersClasses.sort((a,b) => a.name.localeCompare(b.name))
        .map(c => `<option value="${c.id}">${c.logo} ${c.name}</option>`).join('');

    // 3. SMART AUTO-SELECT FIX
    const currentGlobal = state.get('globalSelectedClassId');
    
    // Check if the current global class is actually in the teacher's list
    const isValidClass = allTeachersClasses.some(c => c.id === currentGlobal);

    if (currentGlobal && isValidClass) {
        classSelect.value = currentGlobal;
        // Trigger render immediately
        renderProdigyHistory(currentGlobal);
    } else {
        document.getElementById('prodigy-content').innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-indigo-300 opacity-60">
                <i class="fas fa-hand-pointer text-6xl mb-4 animate-bounce"></i>
                <p class="text-2xl font-bold">Select a class to enter the Hall</p>
            </div>`;
    }

    showAnimatedModal('prodigy-modal');
}

export async function renderProdigyHistory(classId) {
    if (!classId) return;
    const contentEl = document.getElementById('prodigy-content');
    
    // Loading State
    contentEl.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-amber-400"><i class="fas fa-circle-notch fa-spin text-5xl"></i><p class="mt-4 font-bold text-lg">Summoning the Legends...</p></div>`;

    // Ensure history is loaded
    await import('../db/actions.js').then(a => a.ensureHistoryLoaded());
    // Import artifacts to lookup icons if missing from DB
    const { LEGENDARY_ARTIFACTS } = await import('../features/powerUps.js');

    // 1. Setup Dates
    const viewYear = prodigyViewDate.getFullYear();
    const viewMonthIndex = prodigyViewDate.getMonth();
    const monthName = prodigyViewDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    // 2. Navigation Limits
    const now = new Date();
    const canGoForward = (new Date(viewYear, viewMonthIndex + 1, 1) < new Date(now.getFullYear(), now.getMonth(), 1));
    const canGoBack = (new Date(viewYear, viewMonthIndex, 1) > new Date('2025-11-01'));

    // 3. Build Header
    let html = `
        <div class="flex items-center justify-between mb-6 bg-black/20 p-3 rounded-full border border-white/10 backdrop-blur-md shadow-lg z-20 relative mx-auto max-w-lg">
            <button id="prodigy-prev-btn" class="w-10 h-10 rounded-full bg-white text-indigo-900 hover:bg-indigo-100 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed" ${!canGoBack ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
            <span class="font-title text-2xl text-amber-300 tracking-wide drop-shadow-md">${monthName}</span>
            <button id="prodigy-next-btn" class="w-10 h-10 rounded-full bg-white text-indigo-900 hover:bg-indigo-100 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed" ${!canGoForward ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;

    // --- DATA FETCHING ---
    let logsToAnalyze = [];
    const isCurrentMonth = (viewYear === now.getFullYear() && viewMonthIndex === now.getMonth());

    if (isCurrentMonth) {
        logsToAnalyze = state.get('allAwardLogs').filter(l => l.classId === classId);
    } else {
        try {
            const { fetchLogsForMonth } = await import('../db/queries.js');
            const fetchedLogs = await fetchLogsForMonth(viewYear, viewMonthIndex + 1);
            logsToAnalyze = fetchedLogs.filter(l => l.classId === classId);
        } catch (e) {
            console.error("Prodigy history fetch error:", e);
            contentEl.innerHTML = `<div class="text-center text-red-400 p-8">Could not retrieve archives.</div>`;
            return;
        }
    }

    const monthlyLogs = logsToAnalyze.filter(l => {
        const d = utils.parseFlexibleDate(l.date); 
        if (!d) return false;
        return d.getMonth() === viewMonthIndex && d.getFullYear() === viewYear;
    });

    const allScores = state.get('allWrittenScores').filter(s => s.classId === classId);
    const students = state.get('allStudents').filter(s => s.classId === classId);

    if (monthlyLogs.length === 0) {
        html += `
            <div class="flex flex-col items-center justify-center py-20 opacity-50">
                <div class="text-8xl mb-4 grayscale filter drop-shadow-lg">🕸️</div>
                <p class="font-bold text-indigo-200 text-2xl">The Hall is empty.</p>
                <p class="text-indigo-400">No stars were recorded in ${monthName}.</p>
            </div>`;
    } else {
        // 5. Calculate Stats
        const studentStats = students.map(s => {
            const sLogs = monthlyLogs.filter(l => l.studentId === s.id);
            const totalStars = sLogs.reduce((sum, l) => sum + l.stars, 0);
            
            let count3 = 0, count2 = 0;
            const reasons = new Set();
            sLogs.forEach(l => {
                if (l.stars >= 3) count3++;
                else if (l.stars >= 2) count2++;
                if (l.reason) reasons.add(l.reason);
            });

            const sScores = allScores.filter(sc => {
                const scDate = utils.parseFlexibleDate(sc.date);
                return sc.studentId === s.id && scDate && scDate.getMonth() === viewMonthIndex && scDate.getFullYear() === viewYear;
            });
            
            let acadSum = 0;
            sScores.forEach(sc => {
                if (sc.maxScore) acadSum += (sc.scoreNumeric / sc.maxScore) * 100;
                else if (sc.scoreQualitative === "Great!!!") acadSum += 100;
                else if (sc.scoreQualitative === "Great!!") acadSum += 75;
            });
            const academicAvg = sScores.length > 0 ? (acadSum / sScores.length) : 0;

            return { 
                ...s, 
                monthlyStars: totalStars, 
                stats: { count3, count2, academicAvg, uniqueReasons: reasons.size }
            };
        });

        // 6. SORT: EXACT MATCH to Leaderboard/Ceremony
        // Order: Stars -> 3Stars -> 2Stars -> Unique Skills -> Academic
        studentStats.sort((a, b) => {
            if (b.monthlyStars !== a.monthlyStars) return b.monthlyStars - a.monthlyStars;
            if (b.stats.count3 !== a.stats.count3) return b.stats.count3 - a.stats.count3;
            if (b.stats.count2 !== a.stats.count2) return b.stats.count2 - a.stats.count2;
            if (b.stats.uniqueReasons !== a.stats.uniqueReasons) return b.stats.uniqueReasons - a.stats.uniqueReasons;
            return b.stats.academicAvg - a.stats.academicAvg;
        });

        const topStudent = studentStats[0];

        if (!topStudent || topStudent.monthlyStars === 0) {
             html += `<div class="text-center py-12 text-indigo-300">No stars awarded this month.</div>`;
        } else {
            // --- TIE DETECTION ---
            const winners = studentStats.filter(s => {
                // 1. Must equal top stars
                if (s.monthlyStars !== topStudent.monthlyStars) return false;
                
                // 2. Must equal top stats counts
                if (s.stats.count3 !== topStudent.stats.count3) return false;
                if (s.stats.count2 !== topStudent.stats.count2) return false;
                if (s.stats.uniqueReasons !== topStudent.stats.uniqueReasons) return false;
                
                // 3. Academic Tie-Breaker (Allow 0.5% tolerance for floating point math)
                // If top student has 0 academic score, we strictly require 0.
                if (topStudent.stats.academicAvg === 0 && s.stats.academicAvg > 0) return false;
                
                // Otherwise check difference
                if (Math.abs(s.stats.academicAvg - topStudent.stats.academicAvg) > 0.5) return false;
                
                return true;
            });

            // Adjust Layout
            const isTie = winners.length > 1;
            const containerClass = isTie ? "flex flex-wrap justify-center gap-8" : "flex justify-center";
            const cardClass = isTie ? "w-full lg:w-[45%] max-w-md" : "w-full max-w-lg"; 
            const titleText = isTie ? "Co-Prodigy of the Month" : "Prodigy of the Month";

            const cardsHtml = winners.map(winner => {
                // Inventory Handling
                const scoreData = state.get('allStudentScores').find(sc => sc.id === winner.id);
                const inventory = scoreData?.inventory || [];
                
                const inventoryHtml = inventory.length > 0 
                    ? inventory.slice(0, 4).map(i => {
                        // FIX: Logic for displaying Image OR Icon (for Legendaries)
                        let visual = '';
                        if (i.image) {
                            visual = `<img src="${i.image}" class="w-full h-full object-cover">`;
                        } else {
                            // Try to find icon in legendary list by ID or Name, or fallback
                            const legendary = LEGENDARY_ARTIFACTS.find(l => l.id === i.id || l.name === i.name);
                            const icon = i.icon || (legendary ? legendary.icon : '📦');
                            visual = `<div class="w-full h-full flex items-center justify-center text-xl bg-indigo-900/50 text-white">${icon}</div>`;
                        }

                        return `
                        <div class="relative group">
                            <div class="w-12 h-12 rounded-lg border-2 border-amber-400/60 shadow-lg bg-black/40 overflow-hidden transform group-hover:scale-110 transition-transform">
                                ${visual}
                            </div>
                            <div class="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-white bg-black/90 px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-50 transition-opacity border border-white/20">${i.name}</div>
                        </div>`;
                    }).join('')
                    : '<span class="text-sm text-indigo-300/50 italic py-2">Vault is empty</span>';

                const avatarHtml = winner.avatar 
                    ? `<img src="${winner.avatar}" class="w-48 h-48 rounded-full border-8 border-amber-300 shadow-[0_0_50px_rgba(251,191,36,0.6)] object-cover bg-white relative z-10">`
                    : `<div class="w-48 h-48 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-8 border-amber-300 flex items-center justify-center text-8xl font-bold text-white shadow-[0_0_50px_rgba(251,191,36,0.6)] relative z-10">${winner.name.charAt(0)}</div>`;

                let badgeText = "Behavior Hero";
                let badgeIcon = "❤️";
                if (winner.stats.academicAvg >= 90) { badgeText = `Quiz Master (${winner.stats.academicAvg.toFixed(0)}%)`; badgeIcon = "🧠"; }
                else if (winner.stats.academicAvg > 0) { badgeText = `Academic Star (${winner.stats.academicAvg.toFixed(0)}%)`; badgeIcon = "📝"; }

                // Confetti CSS
                const confettiHtml = Array.from({length: 15}).map((_, i) => {
                    const left = Math.random() * 100;
                    const delay = Math.random() * 3;
                    const color = ['#fbbf24', '#f87171', '#60a5fa'][Math.floor(Math.random()*3)];
                    return `<div class="absolute w-2 h-2 rounded-full" style="background:${color}; left:${left}%; top:-20%; animation: fall-confetti ${3+Math.random()}s linear infinite; animation-delay:${delay}s; opacity:0.6;"></div>`;
                }).join('');

                return `
                <div class="relative ${cardClass} perspective-1000 mb-4 transform hover:-translate-y-2 transition-transform duration-500">
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-gradient-to-r from-indigo-600/30 via-purple-600/30 to-indigo-600/30 blur-[60px] rounded-full animate-pulse-slow"></div>

                    <div class="relative bg-gradient-to-b from-indigo-900/90 to-indigo-950/95 border-2 border-amber-400/30 rounded-[3rem] p-6 flex flex-col items-center text-center shadow-2xl overflow-hidden backdrop-blur-md h-full justify-between">
                        
                        <div class="absolute inset-0 pointer-events-none overflow-hidden">${confettiHtml}</div>

                        <!-- Badge -->
                        <div class="bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 px-6 py-1.5 rounded-full font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 mb-6 transform hover:scale-105 transition-transform cursor-default relative z-20 text-xs sm:text-sm">
                            <i class="fas fa-crown mr-1"></i>${titleText}
                        </div>

                        <!-- Avatar -->
                        <div class="relative mb-4 group cursor-pointer">
                            ${avatarHtml}
                            <div class="absolute top-0 right-0 text-6xl filter drop-shadow-md z-30 animate-bounce-slow" style="animation-delay: 0.5s">👑</div>
                        </div>

                        <!-- Name & Score -->
                        <div class="relative z-10 w-full mb-6">
                            <h2 class="font-title text-5xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-white to-indigo-200 drop-shadow-sm mb-2 leading-tight">${winner.name.split(' ')[0]}</h2>
                            <div class="inline-block bg-black/40 px-4 py-1 rounded-full border border-amber-500/30">
                                <span class="text-2xl font-bold text-amber-400">${winner.monthlyStars} Stars</span>
                            </div>
                        </div>

                        <!-- Stats & Inventory -->
                        <div class="w-full bg-white/5 rounded-3xl p-4 border border-white/10 backdrop-blur-md relative z-10">
                            <div class="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-white/10">
                                <div class="bg-black/20 rounded-xl p-2">
                                    <p class="text-[9px] text-indigo-300 uppercase font-bold tracking-wider mb-1">Top Skill</p>
                                    <p class="text-white font-bold text-sm"><i class="fas fa-star text-yellow-400 mr-1"></i>${winner.stats.uniqueReasons} Types</p>
                                </div>
                                <div class="bg-black/20 rounded-xl p-2">
                                    <p class="text-[9px] text-indigo-300 uppercase font-bold tracking-wider mb-1">Academics</p>
                                    <p class="text-white font-bold text-sm">${badgeIcon} ${badgeText.split(' ')[0]}</p>
                                </div>
                            </div>
                            
                            <div class="text-center">
                                <p class="text-[9px] text-amber-400/80 uppercase font-bold tracking-widest mb-2">Hero's Loot</p>
                                <div class="flex flex-wrap justify-center gap-3">
                                    ${inventoryHtml}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');

            html += `<div class="${containerClass} w-full pb-8">${cardsHtml}</div>`;
        }
    }

    contentEl.innerHTML = html;

    // 6. Bind Listeners
    const prevBtn = document.getElementById('prodigy-prev-btn');
    const nextBtn = document.getElementById('prodigy-next-btn');

    if (prevBtn) {
        prevBtn.onclick = () => {
            playSound('click');
            prodigyViewDate.setMonth(prodigyViewDate.getMonth() - 1);
            renderProdigyHistory(classId);
        };
    }
    if (nextBtn) {
        nextBtn.onclick = () => {
            playSound('click');
            prodigyViewDate.setMonth(prodigyViewDate.getMonth() + 1);
            renderProdigyHistory(classId);
        };
    }
}
