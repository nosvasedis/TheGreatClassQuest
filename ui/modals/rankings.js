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
    const subtitleEl = document.getElementById('global-leaderboard-subtitle');
    const controlsEl = document.getElementById('global-leaderboard-controls');
    const contentEl = document.getElementById('global-leaderboard-content');

    // 1. Manage the Date (Default to last month if opening fresh)
    if (resetDate) {
        rankingsViewDate = new Date();
        rankingsViewDate.setMonth(rankingsViewDate.getMonth() - 1);
    }

    const activeMonthKey = rankingsViewDate.toISOString().substring(0, 7); // YYYY-MM
    const monthDisplay = rankingsViewDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    titleEl.innerHTML = `Hero Logs`;
    if (subtitleEl) subtitleEl.innerText = 'Monthly ranks archive';
    if (controlsEl) controlsEl.innerHTML = '';
    contentEl.innerHTML = `<div class="text-center py-10"><i class="fas fa-circle-notch fa-spin text-3xl text-indigo-500"></i><p class="mt-3 text-slate-500 font-semibold">Loading archives for ${monthDisplay}...</p></div>`;

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
    if (controlsEl) {
        controlsEl.innerHTML = `
            <div class="flex flex-col gap-4">
                <div class="flex items-center justify-between bg-white p-2 rounded-[1.25rem] border border-indigo-100 shadow-sm">
                    <button id="rank-prev-month" class="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm hover:bg-indigo-100 transition-colors flex items-center justify-center">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <div class="text-center min-w-0 px-2">
                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Archive Month</div>
                        <div class="font-title text-2xl text-indigo-900 truncate">${monthDisplay}</div>
                    </div>
                    <button id="rank-next-month" class="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm hover:bg-indigo-100 transition-colors flex items-center justify-center">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>

                <div class="flex flex-wrap justify-center gap-3">
                    <button id="rank-tab-global" class="px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest transition-all bg-indigo-600 text-white shadow-md">
                        <i class="fas fa-globe mr-2"></i>Global League
                    </button>
                    <button id="rank-tab-class" class="px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest transition-all bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 shadow-sm">
                        <i class="fas fa-chalkboard-teacher mr-2"></i>My Class
                    </button>
                </div>

                <div id="rank-filter-container"></div>
            </div>
        `;
    }

    contentEl.innerHTML = `<div id="ranks-list-container" class="space-y-3"></div>`;

    // --- NAVIGATION LISTENERS ---
    const prevBtn = document.getElementById('rank-prev-month');
    const nextBtn = document.getElementById('rank-next-month');
    if (prevBtn) {
        prevBtn.onclick = () => {
            rankingsViewDate.setMonth(rankingsViewDate.getMonth() - 1);
            openStudentRankingsModal(false); // Refresh without re-animating modal
        };
    }
    if (nextBtn) {
        nextBtn.onclick = () => {
            // Don't go past the current month
            if (rankingsViewDate.getMonth() === new Date().getMonth() && rankingsViewDate.getFullYear() === new Date().getFullYear()) return;
            rankingsViewDate.setMonth(rankingsViewDate.getMonth() + 1);
            openStudentRankingsModal(false);
        };
    }

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

    const activeTabClass = "px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest transition-all bg-indigo-600 text-white shadow-md";
    const inactiveTabClass = "px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-widest transition-all bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 shadow-sm";

    if (btnGlobal && btnClass) {
        btnGlobal.onclick = () => {
            btnGlobal.className = activeTabClass;
            btnClass.className = inactiveTabClass;
            renderContent('global');
        };

        btnClass.onclick = () => {
            btnClass.className = activeTabClass;
            btnGlobal.className = inactiveTabClass;
            renderContent('class');
        };
    }

    renderContent('global');
}

// Hall of Heroes now focuses on all-time legends only.

export async function openHallOfHeroes() {
    const classId = state.get('globalSelectedClassId');
    if (!classId) { showToast("Choose a class from the header first!", "info"); return; }

    const modal = document.getElementById('history-modal');
    document.getElementById('history-timeline-section')?.classList.add('hidden');

    // Setup Modal appearance (legacy month select removed from template)
    document.getElementById('history-month-select-wrapper')?.classList.add('hidden');
    
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
    const titleEl = document.getElementById('history-modal-title');
    const subtitleEl = document.getElementById('history-modal-subtitle');
    if (titleEl) titleEl.innerText = `${classData?.name || 'Class'} Legends`;
    if (subtitleEl) subtitleEl.innerText = 'Hall of Heroes';
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

    const milestoneModal = document.getElementById('milestone-details-modal');
    if (milestoneModal) milestoneModal.dataset.modalMode = 'zone-overview';

    // 1. Zone Definitions
    const ZONE_CONFIG = {
        bronze: {
            name: "Bronze Meadows", pct: 25, icon: "🌿",
            desc: "The lush beginning. Green fields and ancient forests.",
            bannerGradient: "from-emerald-400 to-teal-600",
            cardBorder: "border-emerald-200",
            iconBg: "bg-emerald-100",
            barGradient: "from-emerald-400 to-teal-500",
            textColor: "text-emerald-600",
            lightBg: "bg-emerald-50"
        },
        silver: {
            name: "Silver Peaks", pct: 50, icon: "🏔️",
            desc: "The frozen mountains. Only the brave cross the bridge.",
            bannerGradient: "from-cyan-400 to-blue-600",
            cardBorder: "border-cyan-200",
            iconBg: "bg-cyan-100",
            barGradient: "from-cyan-400 to-blue-500",
            textColor: "text-cyan-600",
            lightBg: "bg-cyan-50"
        },
        gold: {
            name: "Golden Citadel", pct: 75, icon: "🏰",
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
                        <div class="zone-overview-class-card group relative p-5 rounded-[2rem] ${cardStyle} ${glowEffect} shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                            <div class="zone-overview-class-card__dots" aria-hidden="true"></div>
                            
                            <div class="relative z-10 flex items-center gap-5">
                                <div class="zone-overview-class-seal zone-overview-class-seal--${zoneType}" aria-hidden="true">
                                    <span class="zone-overview-class-seal__emoji">${c.logo}</span>
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
        <div class="zone-overview-hero zone-overview-hero--${zoneType}">
            <div class="zone-overview-hero__shine" aria-hidden="true"></div>
            <div class="zone-overview-hero__deco zone-overview-hero__deco--bg" aria-hidden="true">${config.icon}</div>
            <div class="zone-overview-hero__row">
                <div class="zone-overview-hero__icon-ring">
                    <span class="zone-overview-hero__icon">${config.icon}</span>
                </div>
                <div class="zone-overview-hero__copy">
                    <p class="zone-overview-hero__eyebrow">League region</p>
                    <h3 class="zone-overview-hero__title">${config.name}</h3>
                    <p class="zone-overview-hero__quote">“${config.desc}”</p>
                </div>
            </div>
            <div class="zone-overview-hero__foot">
                <span class="zone-overview-hero__req-icon" aria-hidden="true"><i class="fas fa-flag-checkered"></i></span>
                <span class="zone-overview-hero__req-text"><strong>${config.pct}%</strong> overall progress</span>
                <span class="zone-overview-hero__req-hint">to chart this realm on the Team Quest map</span>
            </div>
        </div>
        
        <div class="zone-overview-body max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar pb-2 md:pb-6 text-left">
            ${renderSection(completed, "Conquered", 'done')}
            ${renderSection(approaching, "Approaching", 'near')}
            ${renderSection(far, "On the Way", 'far')}
        </div>
    `;

    import('../modals.js').then(m => m.showAnimatedModal('milestone-details-modal'));
}

// --- PRODIGY OF THE MONTH FEATURE (FIXED) ---

const PRODIGY_ARCHIVE_START = new Date('2025-11-01');
const prodigyCountsCache = new Map();

/** Latest month that can appear in the Hall (always the previous calendar month — never the current one). */
function getLatestViewableProdigyMonth(ref = new Date()) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), 1);
    d.setMonth(d.getMonth() - 1);
    return d;
}

// Local state for navigation (defaults to last completed month)
let prodigyViewDate = getLatestViewableProdigyMonth();

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
    const currentGlobal = state.get('globalSelectedClassId');
    const allTeachersClasses = state.get('allTeachersClasses') || [];
    const isValidClass = Boolean(currentGlobal && allTeachersClasses.some(c => c.id === currentGlobal));

    if (!isValidClass) {
        showToast('Choose a class from the header first.', 'info');
        return;
    }

    // Hall opens on the last *completed* month (never the current calendar month).
    prodigyViewDate = getLatestViewableProdigyMonth();

    showAnimatedModal('prodigy-modal');
    await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    await renderProdigyHistory(currentGlobal);
}

export async function renderProdigyHistory(classId) {
    if (!classId) return;
    const contentEl = document.getElementById('prodigy-content');
    const navEl = document.getElementById('prodigy-nav-container');
    if (!contentEl || !navEl) return;

    // Loading State
    contentEl.innerHTML = `
        <div class="h-full min-h-[12rem] flex flex-col items-center justify-center text-indigo-300 space-y-5 py-8">
            <div class="relative w-24 h-24">
                <div class="absolute inset-0 border-8 border-violet-300/30 rounded-full"></div>
                <div class="absolute inset-0 border-8 border-violet-500 border-t-transparent rounded-full prodigy-hall-loading-pulse"></div>
                <div class="absolute inset-0 flex items-center justify-center text-3xl drop-shadow-lg" aria-hidden="true"><i class="fas fa-crown text-amber-500"></i></div>
            </div>
            <div class="text-center space-y-2 px-4">
                <p class="font-title text-2xl sm:text-3xl text-indigo-900 tracking-wide">Opening the vault…</p>
                <p class="text-indigo-500 font-semibold text-sm prodigy-hall-tagline flex items-center justify-center gap-2 flex-wrap">
                    <i class="fas fa-wand-magic-sparkles text-amber-500"></i>
                    Polishing plaques &amp; dusting crowns
                    <i class="fas fa-sparkles text-violet-400"></i>
                </p>
            </div>
        </div>`;

    const countsPromise = getProdigyCountsForClass(classId).catch(() => ({ winCounts: new Map() }));
    await import('../../db/actions.js').then(a => a.ensureHistoryLoaded());

    const now = new Date();
    const latestViewable = getLatestViewableProdigyMonth(now);
    let viewYear = prodigyViewDate.getFullYear();
    let viewMonthIndex = prodigyViewDate.getMonth();
    const viewStart = new Date(viewYear, viewMonthIndex, 1);
    if (viewStart > latestViewable) {
        prodigyViewDate = new Date(latestViewable.getFullYear(), latestViewable.getMonth(), 1);
        viewYear = prodigyViewDate.getFullYear();
        viewMonthIndex = prodigyViewDate.getMonth();
    }

    const monthName = prodigyViewDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    const PRODIGY_ARCHIVE_START = new Date(2023, 8, 1);
    const canGoBack = (new Date(viewYear, viewMonthIndex, 1) > PRODIGY_ARCHIVE_START);
    const nextMonthStart = new Date(viewYear, viewMonthIndex + 1, 1);
    const canGoForward = nextMonthStart <= latestViewable;

    navEl.innerHTML = `
        <div class="prodigy-hall-nav-wrap flex items-center p-1.5 gap-1">
            <button type="button" id="prodigy-prev-btn" title="Earlier month" aria-label="Earlier month" class="prodigy-hall-nav-btn prodigy-hall-nav-arrow-btn w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white border border-indigo-100 text-indigo-600 flex items-center justify-center disabled:opacity-25 disabled:pointer-events-none" ${!canGoBack ? 'disabled' : ''}>
                <span class="prodigy-hall-nav-glyph" aria-hidden="true">&lt;</span>
            </button>
            <div class="px-4 sm:px-5 text-center min-w-[11rem] sm:min-w-[13rem]">
                <p class="prodigy-hall-month text-base sm:text-lg text-indigo-950 truncate font-semibold">${monthName}</p>
            </div>
            <button type="button" id="prodigy-next-btn" title="Later month" aria-label="Later month" class="prodigy-hall-nav-btn prodigy-hall-nav-arrow-btn w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white border border-indigo-100 text-indigo-600 flex items-center justify-center disabled:opacity-25 disabled:pointer-events-none" ${!canGoForward ? 'disabled' : ''}>
                <span class="prodigy-hall-nav-glyph" aria-hidden="true">&gt;</span>
            </button>
        </div>`;

    const { fetchLogsForMonth } = await import('../../db/queries.js');
    const fetched = await fetchLogsForMonth(viewYear, viewMonthIndex + 1);
    const logsToAnalyze = fetched.filter(l => l.classId === classId);

    const monthlyLogs = logsToAnalyze.filter(l => {
        const d = utils.parseFlexibleDate(l.date);
        return d && d.getMonth() === viewMonthIndex && d.getFullYear() === viewYear;
    });

    const allScores = state.get('allWrittenScores').filter(s => s.classId === classId);
    const students = state.get('allStudents').filter(s => s.classId === classId);
    const { winCounts } = await countsPromise;

    if (monthlyLogs.length === 0) {
        contentEl.innerHTML = `
            <div class="prodigy-hall-empty h-full flex flex-col items-center justify-center py-12 px-6 max-w-lg mx-auto text-center group">
                <div class="relative mb-6">
                    <div class="absolute inset-0 bg-violet-200/50 blur-3xl rounded-full opacity-60"></div>
                    <div class="prodigy-hall-empty-icon relative w-24 h-24 bg-white rounded-full flex items-center justify-center border-2 border-violet-100 shadow-lg">
                        <i class="fas fa-dove text-4xl text-indigo-300 group-hover:text-violet-500 transition-colors" aria-hidden="true"></i>
                    </div>
                </div>
                <h4 class="text-indigo-900 font-title text-2xl sm:text-3xl mb-2 tracking-tight flex items-center justify-center gap-2 flex-wrap">
                    <i class="fas fa-moon text-indigo-400" aria-hidden="true"></i> Quiet halls
                </h4>
                <p class="text-indigo-600/90 prodigy-hall-tagline text-sm sm:text-base max-w-sm">No star awards logged for <span class="font-title text-indigo-800">${monthName}</span> — pick another month.</p>
            </div>`;
    } else {
        const { winners } = buildProdigyMonthOutcome(students, monthlyLogs, allScores, viewYear, viewMonthIndex);

        if (!winners || winners.length === 0) {
            contentEl.innerHTML = `<div class="h-full flex flex-col items-center justify-center gap-3 text-indigo-500 py-12 px-4 text-center prodigy-hall-tagline">
                <i class="fas fa-star-half-stroke text-3xl text-amber-400" aria-hidden="true"></i>
                <span>No stars this month for <span class="font-title text-indigo-800">${monthName}</span>, so there is no prodigy for this month.</span>
            </div>`;
        } else {
            const isTie = winners.length > 1;
            const containerClass = isTie ? "flex flex-wrap justify-center gap-5 md:gap-6 items-stretch" : "flex justify-center";
            const cardClass = isTie ? "w-full sm:w-[calc(50%-0.5rem)] min-w-[min(100%,18rem)] max-w-lg" : "w-full max-w-3xl";
            const titleText = isTie ? "Legendary Co-Prodigy" : "Eternal Prodigy";

            const cardsHtml = winners.map(winner => {
                const scoreData = state.get('allStudentScores').find(sc => sc.id === winner.id);
                const inventory = scoreData?.inventory || [];
                const inventoryHtml = inventory.length > 0
                    ? inventory.slice(0, 8).map(item => {
                        const visual = item.image ? `<img src="${item.image}" class="w-full h-full object-cover" alt="">` : `<span class="text-sm leading-none">${item.icon || '📦'}</span>`;
                        return `<div class="prodigy-hall-vault-item w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/90 border-2 border-white/80 flex items-center justify-center overflow-hidden shrink-0" title="${item.name}">${visual}</div>`;
                    }).join('')
                    : '<span class="text-xs text-white/60 italic">No shop items yet</span>';

                const avatarHtml = winner.avatar
                    ? `<img src="${winner.avatar}" class="w-full h-full object-cover" alt="">`
                    : `<div class="w-full h-full flex items-center justify-center text-3xl sm:text-4xl font-title text-indigo-600 bg-white">${winner.name.charAt(0)}</div>`;

                let badgeFa = 'fa-heart';
                let badgeText = 'Heroic Spirit';
                let badgeColor = 'from-rose-400 to-pink-500';
                
                if (winner.stats.academicAvg >= 90) { 
                    badgeText = `Ancient Sage (${winner.stats.academicAvg.toFixed(0)}%)`;
                    badgeFa = 'fa-hat-wizard';
                    badgeColor = 'from-amber-400 to-orange-500';
                } else if (winner.stats.academicAvg > 0) { 
                    badgeText = `Learned Hero (${winner.stats.academicAvg.toFixed(0)}%)`;
                    badgeFa = 'fa-book-open';
                    badgeColor = 'from-emerald-400 to-teal-500';
                }
                
                const timesCrowned = winCounts.get(winner.id) || 1;

                return `
                <div class="prodigy-hall-card relative ${cardClass} group/card">
                    <div class="prodigy-hall-card__inner p-5 sm:p-7 md:p-8 h-full min-h-[14rem] sm:min-h-[16rem]">
                        <div class="prodigy-hall-card__stars absolute inset-0 opacity-[0.17] pointer-events-none"></div>
                        <div class="relative z-[2] flex flex-col sm:flex-row gap-5 sm:gap-6 md:gap-8 items-center sm:items-stretch text-center sm:text-left">
                            <div class="relative shrink-0 flex flex-col items-center">
                                <div class="prodigy-hall-avatar-ring w-[5.5rem] h-[5.5rem] sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full border-[3px] border-white/35 overflow-hidden bg-indigo-50">
                                    ${avatarHtml}
                                </div>
                                <div class="absolute -top-1 -right-1 bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-md border-2 border-amber-400 text-amber-500" aria-hidden="true">
                                    <i class="fas fa-trophy text-lg"></i>
                                </div>
                            </div>
                            <div class="flex-1 min-w-0 flex flex-col gap-3 sm:gap-3.5 w-full justify-center">
                                <div class="flex flex-wrap items-center justify-center sm:justify-between gap-2.5">
                                    <div class="prodigy-hall-crown-pill text-amber-950 px-3 py-1.5 rounded-xl text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 bg-amber-400">
                                        <i class="fas fa-crown text-sm" aria-hidden="true"></i>
                                        ${titleText}
                                    </div>
                                    <div class="prodigy-hall-medal-pill flex items-center gap-2 bg-white/12 px-3 py-1.5 rounded-xl border border-white/20">
                                        <span class="text-lg text-amber-200 font-title">${timesCrowned}×</span>
                                        <i class="fas fa-medal text-amber-300 text-sm" aria-hidden="true"></i>
                                    </div>
                                </div>
                                <h2 class="prodigy-hall-student-name text-2xl sm:text-3xl md:text-4xl text-white tracking-tight leading-snug break-words">${winner.name}</h2>
                                <div class="prodigy-hall-badge-row flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-sm text-white/90">
                                    <span class="text-amber-200 font-title text-2xl sm:text-3xl leading-none">${winner.monthlyStars}</span>
                                    <span class="font-semibold tracking-wide text-sm sm:text-base"><i class="fas fa-sparkles text-amber-300 mr-1.5" aria-hidden="true"></i>stars this month</span>
                                </div>
                                <div class="bg-gradient-to-r ${badgeColor} px-4 py-2.5 sm:py-3 rounded-2xl border border-white/25 flex items-center justify-center sm:justify-start gap-2.5 shadow-md">
                                    <span class="text-white text-lg" aria-hidden="true"><i class="fas ${badgeFa}"></i></span>
                                    <span class="text-white prodigy-hall-badge-row text-sm sm:text-base leading-snug">${badgeText}</span>
                                </div>
                                <div class="grid grid-cols-2 gap-3 sm:gap-4 text-left">
                                    <div class="bg-black/25 rounded-2xl px-3 py-3 sm:px-4 sm:py-3.5 border border-white/10" title="How many different praise reasons were used when awarding stars">
                                        <p class="prodigy-hall-stat-label text-xs sm:text-sm text-indigo-100/95 mb-1 flex items-center gap-1.5 leading-snug">
                                            <i class="fas fa-comments text-amber-300 shrink-0" aria-hidden="true"></i>
                                            <span>Different praise reasons</span>
                                        </p>
                                        <p class="text-white font-title text-2xl sm:text-3xl leading-none">${winner.stats.uniqueReasons}</p>
                                    </div>
                                    <div class="bg-black/25 rounded-2xl px-3 py-3 sm:px-4 sm:py-3.5 border border-white/10" title="Days this month with three or more stars in one go">
                                        <p class="prodigy-hall-stat-label text-xs sm:text-sm text-indigo-100/95 mb-1 flex items-center gap-1.5 leading-snug">
                                            <i class="fas fa-star text-amber-300 shrink-0" aria-hidden="true"></i>
                                            <span>Days with 3★ or more</span>
                                        </p>
                                        <p class="text-white font-title text-2xl sm:text-3xl leading-none">${winner.stats.count3}</p>
                                    </div>
                                </div>
                                <div class="mt-1">
                                    <p class="prodigy-hall-vault-title text-xs sm:text-sm text-indigo-100/90 tracking-wide mb-2 text-center sm:text-left flex items-center justify-center sm:justify-start gap-2 font-semibold">
                                        <i class="fas fa-bag-shopping text-sky-300 text-base" aria-hidden="true"></i> Shop items owned
                                    </p>
                                    <div class="flex flex-wrap gap-2 justify-center sm:justify-start">
                                        ${inventoryHtml}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');

            contentEl.innerHTML = `<div class="${containerClass} w-full pb-4 md:pb-6 animate-in">${cardsHtml}</div>`;
        }
    }

    // Bind Listeners
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
