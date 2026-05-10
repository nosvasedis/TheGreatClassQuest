// /ui/modals/rankings.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { getNormalizedPercentForScore } from '../../features/assessmentConfig.js';
import * as constants from '../../constants.js';
import { showAnimatedModal } from './base.js';
import { showToast } from '../effects.js';
import { playSound } from '../../audio.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { db, doc, writeBatch } from '../../firebase.js';

let rankingsViewDate = new Date();

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
        const { fetchLogsForMonth } = await import('../../db/queries.js');
        const { fetchMonthlyHistory } = await import('../../state.js');
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
    const leaguesPromise = import('../../constants.js').then(c => c.questLeagues);
    const allLeagues = (await leaguesPromise).default || ['Junior A', 'Junior B', 'A', 'B', 'C', 'D'];
    const myClasses = state.get('allTeachersClasses').sort((a, b) => a.name.localeCompare(b.name));

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
            const preferredLeague = state.get('globalSelectedLeague');
            const currentLeague = allLeagues.includes(filterValue)
                ? filterValue
                : allLeagues.includes(preferredLeague)
                    ? preferredLeague
                    : allLeagues[0];
            const options = allLeagues.map(l => `<option value="${l}" ${l === currentLeague ? 'selected' : ''}>${l} League</option>`).join('');
            filterContainer.innerHTML = `<select id="rank-league-select" class="w-full p-3 border-2 border-indigo-100 rounded-xl bg-indigo-50 font-bold text-indigo-900 outline-none">${options}</select>`;
            const classesInLeague = allClasses.filter(c => c.questLevel === currentLeague);
            const classIds = classesInLeague.map(c => c.id);
            renderStudentList(allStudents.filter(s => classIds.includes(s.classId)), listContainer, monthlyScores);
            document.getElementById('rank-league-select').onchange = (e) => {
                state.setGlobalSelectedLeague(e.target.value, false);
                renderContent('global', e.target.value);
            };
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
                if (sc.studentId !== s.id || !sc.date) return false;
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
                const prev = ranked[i - 1];
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

// Hall of Heroes now focuses on all-time legends only.

export async function openHallOfHeroes() {
    const classId = state.get('globalSelectedClassId');
    if (!classId) { showToast("Choose a class from the header first!", "info"); return; }

    const modal = document.getElementById('history-modal');
    document.getElementById('history-timeline-section')?.classList.add('hidden');

    // Setup Modal appearance (legacy month select removed from template)
    document.getElementById('history-month-select')?.classList.add('hidden');
    
    // Custom appearance for Hall of Heroes
    modal.classList.add('hall-of-heroes-theme');
    showAnimatedModal('history-modal');

    renderHallOfHeroesContent(classId);
}

function resolveHeroStudentId(log, studentsInClass) {
    if (log.heroStudentId && studentsInClass.some((student) => student.id === log.heroStudentId)) {
        return log.heroStudentId;
    }

    const heroName = String(log.hero || '').trim().toLowerCase();
    if (!heroName) return null;

    const match = studentsInClass.find((student) => student.name.trim().toLowerCase() === heroName);
    return match?.id || null;
}

async function loadAllAdventureLogsForClass(classId) {
    const { fetchAdventureLogsForMonth } = await import('../../db/queries.js');
    const monthsToFetch = [];
    const monthCursor = new Date(constants.competitionStart.getFullYear(), constants.competitionStart.getMonth(), 1);
    const finalMonth = new Date();
    finalMonth.setDate(1);

    while (monthCursor <= finalMonth) {
        monthsToFetch.push({ year: monthCursor.getFullYear(), month: monthCursor.getMonth() + 1 });
        monthCursor.setMonth(monthCursor.getMonth() + 1);
    }

    const monthlyLogs = await Promise.all(
        monthsToFetch.map(({ year, month }) => fetchAdventureLogsForMonth(classId, year, month))
    );

    return monthlyLogs
        .flat()
        .sort((a, b) => utils.parseDDMMYYYY(b.date) - utils.parseDDMMYYYY(a.date));
}

async function syncHeroLegendWins(classId, legendRows) {
    const updates = legendRows.filter((row) => row.wins !== row.storedWins);
    if (!updates.length) return;

    const batch = writeBatch(db);
    updates.forEach((row) => {
        batch.set(doc(db, 'artifacts/great-class-quest/public/data/student_scores', row.student.id), {
            heroOfDayWins: row.wins
        }, { merge: true });
    });
    await batch.commit();

    const scoreMap = new Map(updates.map((row) => [row.student.id, row.wins]));
    const allScores = state.get('allStudentScores') || [];
    const knownIds = new Set(allScores.map((score) => score.id));
    const mergedScores = allScores.map((score) => (
        scoreMap.has(score.id)
            ? { ...score, heroOfDayWins: scoreMap.get(score.id) }
            : score
    ));

    updates.forEach((row) => {
        if (!knownIds.has(row.student.id)) {
            mergedScores.push({ id: row.student.id, heroOfDayWins: row.wins });
        }
    });

    state.setAllStudentScores(mergedScores);
}

async function buildHallLegendRows(classId) {
    const studentsInClass = state.get('allStudents').filter((student) => student.classId === classId);
    const allLogs = await loadAllAdventureLogsForClass(classId);
    const scoreByStudentId = new Map((state.get('allStudentScores') || []).map((score) => [score.id, score]));
    const statsByStudentId = new Map(
        studentsInClass.map((student) => [student.id, { wins: 0, latestDate: null }])
    );

    allLogs.forEach((log) => {
        const studentId = resolveHeroStudentId(log, studentsInClass);
        if (!studentId) return;

        const stats = statsByStudentId.get(studentId);
        if (!stats) return;

        stats.wins += 1;
        const logDate = utils.parseDDMMYYYY(log.date);
        if (!stats.latestDate || logDate > stats.latestDate) {
            stats.latestDate = logDate;
        }
    });

    const legendRows = studentsInClass.map((student) => {
        const stats = statsByStudentId.get(student.id) || { wins: 0, latestDate: null };
        const storedWins = Number(scoreByStudentId.get(student.id)?.heroOfDayWins) || 0;
        const tier = utils.getHeroLegendTierInfo(stats.wins);
        const nextThreshold = tier.nextThreshold;
        const progressCurrent = tier.key === 'none' ? stats.wins : Math.max(0, stats.wins - tier.minWins);
        const progressTarget = nextThreshold ? Math.max(1, nextThreshold - tier.minWins) : 1;
        const progressPercent = nextThreshold
            ? Math.min(100, Math.round((progressCurrent / progressTarget) * 100))
            : 100;

        return {
            student,
            wins: stats.wins,
            storedWins,
            latestDate: stats.latestDate,
            tier,
            nextThreshold,
            progressPercent
        };
    }).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const aTime = a.latestDate ? a.latestDate.getTime() : 0;
        const bTime = b.latestDate ? b.latestDate.getTime() : 0;
        if (bTime !== aTime) return bTime - aTime;
        return a.student.name.localeCompare(b.student.name);
    });

    await syncHeroLegendWins(classId, legendRows);
    return { legendRows, allLogs };
}

async function renderHallOfHeroesContent(classId) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const contentEl = document.getElementById('history-modal-content');
    const modalTitle = document.querySelector('#history-modal h2');

    modalTitle.innerHTML = `
        <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shadow-inner border border-amber-200">
                <i class="fas fa-crown text-2xl text-amber-600"></i>
            </div>
            <div>
                <h2 class="font-title text-3xl text-slate-800 tracking-tight">${classData.name} Legends</h2>
                <div class="flex items-center gap-2 text-amber-600 text-[10px] font-black uppercase tracking-[0.2em]">
                    <span class="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                    Hall of Heroes
                </div>
            </div>
        </div>`;
    contentEl.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20">
            <div class="relative">
                <div class="absolute inset-0 bg-amber-400/20 blur-2xl rounded-full animate-pulse"></div>
                <i class="fas fa-monument fa-spin-pulse text-6xl text-amber-500 relative z-10"></i>
            </div>
            <p class="mt-6 font-title text-2xl text-slate-700">Opening the Golden Gates...</p>
            <p class="text-slate-400 font-medium">Assembling the legendary roster of ${classData.name}</p>
        </div>`;

    const { legendRows, allLogs } = await buildHallLegendRows(classId);
    const crownedHeroes = legendRows.filter((row) => row.wins > 0);
    const topLegend = crownedHeroes[0] || null;

    let html = `
        <div class="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-sky-400 via-indigo-400 to-indigo-500 p-8 md:p-10 text-white shadow-2xl mb-12 border-4 border-white ring-1 ring-sky-100 group">
            <!-- Atmospheric Background Decor -->
            <div class="absolute inset-0 pointer-events-none">
                <div class="absolute top-0 right-0 w-96 h-96 bg-white/20 blur-[100px] rounded-full"></div>
                <div class="absolute bottom-0 left-0 w-96 h-96 bg-indigo-200/20 blur-[100px] rounded-full"></div>
            </div>

            <div class="relative z-10">
                <div class="flex flex-col lg:flex-row justify-between items-center gap-10">
                    <div class="text-center lg:text-left flex-1">
                        <div class="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 font-black text-[10px] uppercase tracking-widest mb-6">
                            <i class="fas fa-sparkles"></i> The Eternal Registry
                        </div>
                        <h3 class="font-title text-4xl md:text-5xl leading-tight mb-3 tracking-tight">Legends of the Realm</h3>
                        <p class="text-white/80 font-medium text-lg leading-relaxed max-w-xl">Celebrating every "Hero of the Day" recorded in our history. Their names are carved into the annals of glory forever.</p>
                    </div>
                    
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full lg:w-auto">
                        <div class="bg-white/10 backdrop-blur-xl rounded-[2rem] p-5 border border-white/20 text-center shadow-lg">
                            <div class="text-[9px] font-black text-white/70 uppercase tracking-widest mb-1.5">Total Crowns</div>
                            <div class="font-title text-4xl text-white">${allLogs.length}</div>
                        </div>
                        <div class="bg-white/10 backdrop-blur-xl rounded-[2rem] p-5 border border-white/20 text-center shadow-lg">
                            <div class="text-[9px] font-black text-white/70 uppercase tracking-widest mb-1.5">Crowned Heroes</div>
                            <div class="font-title text-4xl text-white">${crownedHeroes.length}</div>
                        </div>
                        <div class="bg-white/10 backdrop-blur-xl rounded-[2rem] p-5 border border-white/20 text-center col-span-2 sm:col-span-1 shadow-lg">
                            <div class="text-[9px] font-black text-white/70 uppercase tracking-widest mb-1.5">Top Legend</div>
                            <div class="font-title text-2xl text-amber-300 truncate">${topLegend ? topLegend.student.name.split(' ')[0] : 'None'}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Background Flourish -->
            <div class="absolute -right-12 -bottom-12 text-white/10 text-[15rem] pointer-events-none transform rotate-12">
                <i class="fas fa-monument"></i>
            </div>
        </div>
    `;

    if (!crownedHeroes.length) {
        html += `
            <div class="text-center py-16 opacity-60">
                <div class="text-7xl mb-4">🏛️</div>
                <p class="font-bold text-gray-500 text-lg">No class legends yet.</p>
                <p class="text-sm text-gray-400 mt-2">Save Adventure Logs to start building the Hall.</p>
            </div>`;
    } else {
        html += `<div class="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-10">`;

        crownedHeroes.forEach((row, index) => {
            const heroClass = row.student.heroClass;
            const heroIcon = heroClass ? (HERO_CLASSES[heroClass]?.icon || '⭐') : '⭐';
            const avatarHtml = row.student.avatar
                ? `<img src="${row.student.avatar}" class="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-2xl relative z-10 transform group-hover/card:scale-110 group-hover/card:rotate-2 transition-transform duration-500">`
                : `<div class="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-700 to-slate-900 text-white text-4xl font-title flex items-center justify-center border-4 border-white shadow-2xl relative z-10 transform group-hover/card:scale-110 group-hover/card:rotate-2 transition-transform duration-500">${row.student.name.charAt(0)}</div>`;
            const latestDate = row.latestDate
                ? row.latestDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'No date';
            const nextTierText = row.nextThreshold
                ? `Next Goal: ${utils.getHeroLegendTierInfo(row.nextThreshold).label} (${Math.max(0, row.nextThreshold - row.wins)} crowns away)`
                : 'Maximum legend rank achieved';

            html += `
                <article class="group/card relative rounded-[3rem] overflow-hidden shadow-sm border border-slate-100 bg-white transition-all duration-700 hover:-translate-y-2 hover:shadow-2xl hover:shadow-sky-500/10 flex flex-col">
                    <!-- Fluffy Tier Aura -->
                    <div class="absolute -right-20 -top-20 w-48 h-48 bg-gradient-to-br ${row.tier.accent} opacity-0 group-hover/card:opacity-10 blur-[60px] rounded-full transition-opacity duration-700"></div>

                    <div class="p-8 flex flex-col h-full relative z-10">
                        <div class="flex items-start justify-between mb-8">
                            <div class="flex items-center gap-6">
                                <div class="relative">
                                    <div class="absolute inset-0 bg-slate-200 blur-2xl opacity-0 group-hover/card:opacity-20 rounded-full transition-opacity"></div>
                                    ${avatarHtml}
                                    <div class="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-xl border border-slate-100 flex items-center justify-center text-xl transform group-hover/card:rotate-12 transition-transform duration-500">
                                        ${heroIcon}
                                    </div>
                                </div>
                                <div>
                                    <div class="text-[10px] uppercase tracking-[0.25em] font-black text-slate-400 mb-1.5">Rank #${index + 1}</div>
                                    <h4 class="font-title text-3xl text-slate-800 tracking-tight mb-1 group-hover/card:text-indigo-600 transition-colors">${row.student.name}</h4>
                                    <div class="flex items-center gap-2">
                                        <span class="px-3 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-100">${heroClass || 'Novice'}</span>
                                        <span class="w-1 h-1 bg-slate-200 rounded-full"></span>
                                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Since ${latestDate}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="text-right">
                            <div class="rounded-2xl bg-amber-50 border border-amber-200 p-5 group-hover/card:bg-amber-100/50 transition-colors">
                                <div class="text-[10px] uppercase tracking-[0.2em] font-black text-amber-600 mb-2">Legend Perk</div>
                                <div class="font-title text-xl text-amber-900 leading-none">+${row.tier.extraDiscount}% Shop Perk</div>
                            </div>
                        </div>
                        <div class="rounded-3xl bg-slate-900 p-6 text-white shadow-inner relative overflow-hidden">
                            <div class="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent pointer-events-none"></div>
                            <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 mb-3 relative z-10">
                                <span>Legend Progression</span>
                                <span class="text-amber-400">${row.progressPercent}%</span>
                            </div>
                            <div class="h-4 rounded-full bg-white/10 overflow-hidden relative z-10 shadow-inner">
                                <div class="h-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-200 relative transition-all duration-1000 ease-out" style="width:${row.progressPercent}%">
                                    <div class="absolute inset-0 bg-white/20 shimmer"></div>
                                </div>
                            </div>
                            <div class="text-xs text-slate-400 mt-4 font-medium italic relative z-10 flex items-center gap-2">
                                <i class="fas fa-circle-info opacity-50"></i>
                                ${nextTierText}
                            </div>
                        </div>
                    </div>
                </article>
            `;
        });

        html += `</div>`;
    }

    contentEl.innerHTML = html;
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
    const allStudentScores = state.get('allStudentScores') || [];
    const classes = state.get('allSchoolClasses').filter(c => c.questLevel === league);

    const completed = [];
    const approaching = [];
    const far = [];

    classes.forEach(c => {
        const studentsInClass = state.get('allStudents').filter(s => s.classId === c.id);
        const studentCount = studentsInClass.length;

        // --- CALCULATION LOGIC ---
        const diamondGoal = utils.calculateMonthlyClassGoal(
            c,
            studentCount,
            state.get('schoolHolidayRanges'),
            state.get('allScheduleOverrides')
        );

        const { totalStars: currentMonthlyStars, classBonus: classQuestBonus } = utils.getClassMonthlyQuestStars(c, studentsInClass, allStudentScores);

        const zoneTargetStars = (diamondGoal * (config.pct / 100));
        const remaining = Math.max(0, zoneTargetStars - currentMonthlyStars);

        let progressPct = diamondGoal > 0 ? (currentMonthlyStars / diamondGoal) * 100 : 0;

        // Track if completed this month for badge display (but don't force 100% progress)
        let isCompletedThisMonth = false;
        if (c.questCompletedAt) {
            const completedDate = typeof c.questCompletedAt.toDate === 'function' ? c.questCompletedAt.toDate() : new Date(c.questCompletedAt);
            if (completedDate.getMonth() === new Date().getMonth() && completedDate.getFullYear() === new Date().getFullYear()) {
                isCompletedThisMonth = true;
            }
        }
        // Removed: Don't force progress to 100% - show actual progress for accuracy

        const info = {
            name: c.name,
            logo: c.logo,
            level: (c.difficultyLevel || 0) + 1,
            progress: progressPct,
            stars: currentMonthlyStars,
            questBonus: classQuestBonus,
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

        const lvlStyles = {
            1: { color: "bg-teal-100 text-teal-800 border-teal-200", icon: "🌱" },
            2: { color: "bg-cyan-100 text-cyan-800 border-cyan-200", icon: "💧" },
            3: { color: "bg-blue-100 text-blue-800 border-blue-200", icon: "🛡️" },
            4: { color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: "🔮" },
            5: { color: "bg-orange-100 text-orange-800 border-orange-200", icon: "🔥" },
            6: { color: "bg-rose-100 text-rose-800 border-rose-200", icon: "🐉" }
        };

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
            const levelValue = Number(c.level) || 1;
            const levelStyle = lvlStyles[levelValue] || lvlStyles[1];

            return `
                        <div class="group relative p-5 rounded-[2rem] ${cardStyle} ${glowEffect} shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                            <div class="absolute inset-0 opacity-[0.03]" style="background-image: radial-gradient(#000 1px, transparent 1px); background-size: 20px 20px;"></div>
                            
                            <div class="relative z-10 flex items-center gap-5">
                                <div class="w-16 h-16 rounded-2xl ${config.iconBg} flex items-center justify-center text-4xl shadow-inner transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500">
                                    ${c.logo}
                                </div>
                                
                                <div class="flex-grow min-w-0">
                                    <div class="flex justify-between items-center mb-2">
                                        <div>
                                            <div class="font-title text-xl text-gray-800 truncate tracking-tight">${c.name}</div>
                                            <div class="inline-flex items-center gap-2 mt-1 px-3 py-1 rounded-md text-xs font-bold border shadow-sm ${levelStyle.color}">
                                                ${levelStyle.icon} Level ${levelValue}
                                            </div>
                                        </div>
                                        ${badge}
                                    </div>
                                    
                                    <div class="h-6 bg-gray-100 rounded-full border border-gray-200 overflow-hidden relative shadow-inner">
                                        <div class="h-full bg-gradient-to-r ${config.barGradient} relative transition-all duration-1000" style="width: ${barFill}%">
                                            <div class="absolute inset-0 w-full h-full opacity-30" 
                                                 style="background-image: linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent); background-size: 1rem 1rem;">
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="flex justify-between mt-2 text-xs font-bold text-gray-400 uppercase tracking-wide gap-3">
                                        <span><i class="fas fa-star text-amber-400 mr-1"></i>${starsFormatted} Collected${c.questBonus > 0 ? ` <span class="text-indigo-600">(+${c.questBonus} Quest)</span>` : ''}</span>
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

    import('../modals.js').then(m => m.showAnimatedModal('milestone-details-modal'));
}

// --- PRODIGY OF THE MONTH FEATURE (FIXED) ---

// Local state for navigation
let prodigyViewDate = new Date();
const PRODIGY_ARCHIVE_START = new Date('2025-11-01');
const prodigyCountsCache = new Map();

function buildProdigyMonthOutcome(students, monthlyLogs, allScores, viewYear, viewMonthIndex) {
    const studentStats = students.map((student) => {
        const studentLogs = monthlyLogs.filter((log) => log.studentId === student.id);
        const totalStars = studentLogs.reduce((sum, log) => sum + (Number(log.stars) || 0), 0);

        let count3 = 0;
        let count2 = 0;
        const reasons = new Set();

        studentLogs.forEach((log) => {
            if (log.stars >= 3) count3++;
            else if (log.stars >= 2) count2++;
            if (log.reason) reasons.add(log.reason);
        });

        const studentScores = allScores.filter((score) => {
            const scoreDate = utils.parseFlexibleDate(score.date);
            return score.studentId === student.id
                && scoreDate
                && scoreDate.getMonth() === viewMonthIndex
                && scoreDate.getFullYear() === viewYear;
        });

        let academicSum = 0;
        studentScores.forEach((score) => {
            const normalized = getNormalizedPercentForScore(score);
            if (Number.isFinite(normalized)) academicSum += normalized;
        });

        return {
            ...student,
            monthlyStars: totalStars,
            stats: {
                count3,
                count2,
                academicAvg: studentScores.length > 0 ? (academicSum / studentScores.length) : 0,
                uniqueReasons: reasons.size
            }
        };
    });

    studentStats.sort((a, b) => {
        if (b.monthlyStars !== a.monthlyStars) return b.monthlyStars - a.monthlyStars;
        if (b.stats.count3 !== a.stats.count3) return b.stats.count3 - a.stats.count3;
        if (b.stats.count2 !== a.stats.count2) return b.stats.count2 - a.stats.count2;
        if (b.stats.uniqueReasons !== a.stats.uniqueReasons) return b.stats.uniqueReasons - a.stats.uniqueReasons;
        return b.stats.academicAvg - a.stats.academicAvg;
    });

    const topStudent = studentStats[0];
    if (!topStudent || topStudent.monthlyStars === 0) {
        return { studentStats, winners: [], topStudent: null };
    }

    const winners = studentStats.filter((student) => {
        if (student.monthlyStars !== topStudent.monthlyStars) return false;
        if (student.stats.count3 !== topStudent.stats.count3) return false;
        if (student.stats.count2 !== topStudent.stats.count2) return false;
        if (student.stats.uniqueReasons !== topStudent.stats.uniqueReasons) return false;
        return true;
    });

    return { studentStats, winners, topStudent };
}

async function getProdigyCountsForClass(classId) {
    if (prodigyCountsCache.has(classId)) return prodigyCountsCache.get(classId);

    const students = state.get('allStudents').filter((student) => student.classId === classId);
    const allScores = state.get('allWrittenScores').filter((score) => score.classId === classId);
    const monthCursor = new Date(PRODIGY_ARCHIVE_START.getFullYear(), PRODIGY_ARCHIVE_START.getMonth(), 1);
    const lastCompletedMonth = new Date();
    lastCompletedMonth.setDate(1);
    lastCompletedMonth.setMonth(lastCompletedMonth.getMonth() - 1);
    const monthRequests = [];

    while (monthCursor <= lastCompletedMonth) {
        monthRequests.push({
            year: monthCursor.getFullYear(),
            monthIndex: monthCursor.getMonth(),
            month: monthCursor.getMonth() + 1,
            monthKey: `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`
        });
        monthCursor.setMonth(monthCursor.getMonth() + 1);
    }

    const { fetchLogsForMonth } = await import('../../db/queries.js');
    const monthLogs = await Promise.all(monthRequests.map(async ({ year, month }) => {
        try {
            return await fetchLogsForMonth(year, month);
        } catch (error) {
            console.error('Prodigy monthly archive fetch failed:', error);
            return [];
        }
    }));

    const winCounts = new Map();
    const winnersByMonth = new Map();

    monthRequests.forEach((request, index) => {
        const logsForClass = monthLogs[index].filter((log) => log.classId === classId);
        const { winners } = buildProdigyMonthOutcome(students, logsForClass, allScores, request.year, request.monthIndex);
        winnersByMonth.set(request.monthKey, winners.map((winner) => winner.id));
        winners.forEach((winner) => {
            winCounts.set(winner.id, (winCounts.get(winner.id) || 0) + 1);
        });
    });

    const result = { winCounts, winnersByMonth };
    prodigyCountsCache.set(classId, result);
    return result;
}

export async function openProdigyModal() {
    const allTeachersClasses = state.get('allTeachersClasses') || [];
    const currentGlobal = state.get('globalSelectedClassId');
    const isValidClass = Boolean(currentGlobal && allTeachersClasses.some(c => c.id === currentGlobal));

    prodigyViewDate = new Date();
    prodigyViewDate.setDate(1);
    prodigyViewDate.setMonth(prodigyViewDate.getMonth() - 1);

    const contextEl = document.getElementById('prodigy-class-context');
    if (!isValidClass) {
        showToast('Choose a class from the header first.', 'info');
        return;
    }

    const cls = allTeachersClasses.find(c => c.id === currentGlobal);
    if (contextEl) {
        contextEl.hidden = false;
        contextEl.textContent = `${cls?.logo || ''} ${cls?.name || 'Class'}${cls?.questLevel ? ` (${cls.questLevel})` : ''}`.trim();
    }

    await renderProdigyHistory(currentGlobal);
    showAnimatedModal('prodigy-modal');
}

export async function renderProdigyHistory(classId) {
    if (!classId) return;
    const contentEl = document.getElementById('prodigy-content');

    // Loading State
    contentEl.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-amber-400"><i class="fas fa-circle-notch fa-spin text-5xl"></i><p class="mt-4 font-bold text-lg">Summoning the Legends...</p></div>`;

    // Ensure history is loaded
    await import('../../db/actions.js').then(a => a.ensureHistoryLoaded());
    // Import artifacts to lookup icons if missing from DB
    const { LEGENDARY_ARTIFACTS } = await import('../../features/powerUps.js');

    // 1. Setup Dates
    const viewYear = prodigyViewDate.getFullYear();
    const viewMonthIndex = prodigyViewDate.getMonth();
    const monthName = prodigyViewDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    // 2. Navigation Limits
    const now = new Date();
    const canGoForward = (new Date(viewYear, viewMonthIndex + 1, 1) < new Date(now.getFullYear(), now.getMonth(), 1));
    const canGoBack = (new Date(viewYear, viewMonthIndex, 1) > PRODIGY_ARCHIVE_START);

    // 3. Build Header
    let html = `
        <div class="flex items-center justify-between mb-10 bg-white/10 p-3 rounded-[2rem] border-2 border-white/20 shadow-xl backdrop-blur-xl relative z-20 mx-auto max-w-lg">
            <button id="prodigy-prev-btn" class="w-12 h-12 rounded-2xl bg-white text-indigo-900 shadow-sm hover:shadow-md hover:bg-indigo-50 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed group" ${!canGoBack ? 'disabled' : ''}>
                <i class="fas fa-chevron-left group-hover:-translate-x-1 transition-transform"></i>
            </button>
            <div class="text-center">
                <div class="text-[9px] font-black text-amber-300 uppercase tracking-[0.3em] mb-0.5">Legendary Period</div>
                <span class="font-title text-2xl text-white tracking-tight drop-shadow-md">${monthName}</span>
            </div>
            <button id="prodigy-next-btn" class="w-12 h-12 rounded-2xl bg-white text-indigo-900 shadow-sm hover:shadow-md hover:bg-indigo-50 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed group" ${!canGoForward ? 'disabled' : ''}>
                <i class="fas fa-chevron-right group-hover:translate-x-1 transition-transform"></i>
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
            const { fetchLogsForMonth } = await import('../../db/queries.js');
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
    const { winCounts } = await getProdigyCountsForClass(classId);

    if (monthlyLogs.length === 0) {
        html += `
            <div class="flex flex-col items-center justify-center py-24 bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10 backdrop-blur-sm group">
                <div class="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center mb-8 shadow-xl border border-white/10 group-hover:scale-110 transition-transform duration-700">
                    <i class="fas fa-ghost text-7xl text-white/20 group-hover:text-amber-300/30 transition-colors"></i>
                </div>
                <h4 class="text-white font-title text-4xl mb-3">Quiet Halls</h4>
                <p class="text-indigo-200/60 font-medium text-xl max-w-sm text-center">No heroic deeds were recorded in the scrolls of ${monthName}.</p>
            </div>`;
    } else {
        const { studentStats, topStudent, winners } = buildProdigyMonthOutcome(students, monthlyLogs, allScores, viewYear, viewMonthIndex);

        if (!topStudent || topStudent.monthlyStars === 0) {
            html += `<div class="text-center py-12 text-indigo-300">No stars awarded this month.</div>`;
        } else {
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
                const timesCrowned = winCounts.get(winner.id) || 1;

                // Confetti CSS
                const confettiHtml = Array.from({ length: 15 }).map((_, i) => {
                    const left = Math.random() * 100;
                    const delay = Math.random() * 3;
                    const color = ['#fbbf24', '#f87171', '#60a5fa'][Math.floor(Math.random() * 3)];
                    return `<div class="absolute w-2 h-2 rounded-full" style="background:${color}; left:${left}%; top:-20%; animation: fall-confetti ${3 + Math.random()}s linear infinite; animation-delay:${delay}s; opacity:0.6;"></div>`;
                }).join('');

                return `
                <div class="relative ${cardClass} perspective-1000 mb-8 transform hover:-translate-y-3 transition-all duration-500 group/card">
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[115%] h-[115%] bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-indigo-500/40 blur-[80px] rounded-full animate-pulse-slow opacity-0 group-hover/card:opacity-100 transition-opacity"></div>
                    
                    <!-- Decorative Floating Elements -->
                    <div class="absolute -left-4 -top-4 w-12 h-12 bg-amber-400/20 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center text-xl shadow-lg z-30 group-hover/card:-translate-y-2 group-hover/card:-translate-x-1 transition-transform">✨</div>
                    <div class="absolute -right-2 bottom-12 w-10 h-10 bg-indigo-400/20 backdrop-blur-md rounded-xl border border-white/20 flex items-center justify-center text-lg shadow-lg z-30 group-hover/card:translate-y-2 group-hover/card:translate-x-1 transition-transform">📜</div>

                    <div class="relative bg-gradient-to-b from-indigo-900/95 to-indigo-950 border-4 border-white/10 rounded-[4rem] p-8 flex flex-col items-center text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden backdrop-blur-2xl h-full justify-between ring-1 ring-white/10">
                        
                        <div class="absolute inset-0 pointer-events-none overflow-hidden">${confettiHtml}</div>
                        
                        <!-- Header Badge -->
                        <div class="relative z-20 mb-8">
                            <div class="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-amber-900 px-8 py-2.5 rounded-full font-title text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(251,191,36,0.4)] border border-white/20">
                                <i class="fas fa-crown mr-2"></i>${titleText}
                            </div>
                        </div>

                        <!-- Trophy Count -->
                        <div class="absolute top-24 right-10 flex flex-col items-center group/trophy cursor-help">
                            <div class="w-14 h-14 bg-white/5 backdrop-blur-lg rounded-2xl flex items-center justify-center border border-white/10 shadow-inner group-hover/trophy:bg-white/15 transition-all">
                                <span class="font-title text-2xl text-amber-300">${timesCrowned}x</span>
                            </div>
                            <span class="text-[9px] font-black text-indigo-300 uppercase tracking-widest mt-1.5 opacity-60">Hall Entries</span>
                        </div>

                        <!-- Avatar Section -->
                        <div class="relative mb-8 group/avatar">
                            <div class="absolute inset-0 bg-amber-400/20 blur-3xl rounded-full opacity-60 group-hover/avatar:opacity-100 transition-opacity"></div>
                            ${avatarHtml}
                            <div class="absolute -top-4 -right-4 text-7xl filter drop-shadow-xl z-30 animate-bounce-slow" style="animation-delay: 0.5s">👑</div>
                        </div>

                        <!-- Name & Score -->
                        <div class="relative z-10 w-full mb-8">
                            <h2 class="font-title text-6xl text-white drop-shadow-md mb-3 leading-tight tracking-tight">${winner.name.split(' ')[0]}</h2>
                            <div class="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 shadow-lg">
                                <span class="text-3xl font-title text-amber-400 leading-none">${winner.monthlyStars}</span>
                                <span class="text-xs font-black text-indigo-200 uppercase tracking-widest">Stars Earned</span>
                            </div>
                        </div>

                        <!-- Metrics & Vault -->
                        <div class="w-full space-y-4 relative z-10">
                            <div class="grid grid-cols-2 gap-3">
                                <div class="bg-white/5 rounded-3xl p-4 border border-white/5 shadow-inner">
                                    <p class="text-[10px] text-indigo-300 font-black uppercase tracking-widest mb-2 opacity-60">Versatility</p>
                                    <p class="text-white font-title text-xl leading-none flex items-center justify-center gap-2">
                                        <i class="fas fa-bolt text-amber-400"></i>
                                        ${winner.stats.uniqueReasons} <span class="text-[10px] font-black uppercase opacity-60">Types</span>
                                    </p>
                                </div>
                                <div class="bg-white/5 rounded-3xl p-4 border border-white/5 shadow-inner">
                                    <p class="text-[10px] text-indigo-300 font-black uppercase tracking-widest mb-2 opacity-60">Academics</p>
                                    <p class="text-white font-title text-lg leading-none truncate px-1" title="${badgeText}">
                                        ${badgeIcon} ${badgeText.split(' ')[0]}
                                    </p>
                                </div>
                            </div>
                            
                            <div class="bg-black/20 rounded-[2.5rem] p-5 border border-white/5">
                                <div class="flex items-center justify-between mb-4 px-2">
                                    <span class="text-[10px] font-black text-amber-400/80 uppercase tracking-[0.25em]">Legendary Vault</span>
                                    <span class="w-8 h-px bg-white/10"></span>
                                </div>
                                <div class="flex flex-wrap justify-center gap-4">
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

