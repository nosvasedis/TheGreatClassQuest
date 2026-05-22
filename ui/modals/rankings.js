// /ui/modals/rankings.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { getNormalizedPercentForScore } from '../../features/assessmentConfig.js';
import * as constants from '../../constants.js';
import { showAnimatedModal } from './base.js';
import { showToast } from '../effects.js';
import { playSound } from '../../audio.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import {
    getAwardLogMonthlyStarCredit,
    mergeMonthlyStarsFromArchivedHistoryAndAwardLogs,
    sumMonthlyStarCreditsByStudentFromAwardLogs
} from '../../features/awardLogReasonMeta.js';
import { db, doc, writeBatch } from '../../firebase.js';

let rankingsViewDate = new Date();

// --- STUDENT RANKINGS MODAL (HERO RANKS ARCHIVE) ---
export async function openStudentRankingsModal(resetDate = true) {
    const modalId = 'global-leaderboard-modal';
    const titleEl = document.getElementById('global-leaderboard-title');
    const subtitleEl = document.getElementById('global-leaderboard-subtitle');
    const controlsEl = document.getElementById('global-leaderboard-controls');
    const contentEl = document.getElementById('global-leaderboard-content');

    // 1. Archives never include the in-progress month: default to the last completed calendar month.
    if (resetDate) {
        rankingsViewDate = new Date(utils.getLatestCompletedMonthStart());
    }

    const activeMonthKey = utils.getMonthKey(rankingsViewDate);
    const monthDisplay = rankingsViewDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    titleEl.innerHTML = `Hero Logs`;
    if (subtitleEl) subtitleEl.innerText = 'Monthly ranks (completed months only)';
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
        const archivedPromise = fetchMonthlyHistory(activeMonthKey);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));

        const [logsResult, archivedRows] = await Promise.all([
            Promise.race([logsPromise, timeoutPromise]).catch(() => []),
            archivedPromise.catch(() => ({}))
        ]);
        logs = logsResult || [];
        const fromLogs = sumMonthlyStarCreditsByStudentFromAwardLogs(logs);
        monthlyScores = mergeMonthlyStarsFromArchivedHistoryAndAwardLogs(fromLogs, archivedRows || {});
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
            const ceiling = utils.getLatestCompletedMonthStart(new Date());
            if (
                rankingsViewDate.getFullYear() === ceiling.getFullYear()
                && rankingsViewDate.getMonth() === ceiling.getMonth()
            ) {
                return;
            }
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
                const cred = getAwardLogMonthlyStarCredit(l);
                if (cred >= 3) count3++;
                else if (cred >= 2) count2++;
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

export async function openHallOfHeroes() {
    const classId = state.get('globalSelectedClassId');
    if (!classId) { showToast("Choose a class from the header first!", "info"); return; }

    document.getElementById('history-timeline-section')?.classList.add('hidden');
    document.getElementById('history-month-select-wrapper')?.classList.add('hidden');

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
        <div class="flex flex-col items-center justify-center py-24 gap-5">
            <div class="relative">
                <div class="absolute inset-0 rounded-full bg-amber-300/30 blur-2xl animate-pulse scale-150"></div>
                <i class="fas fa-crown text-5xl text-amber-500 relative drop-shadow-lg" style="animation: hoh-float 2.4s ease-in-out infinite;"></i>
            </div>
            <p class="font-title text-2xl text-slate-600 tracking-tight">Assembling the legends…</p>
        </div>
        <style>
            @keyframes hoh-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
            @keyframes hoh-in { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
            @keyframes hoh-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
            .hoh-card { animation: hoh-in 0.45s ease both; }
            .hoh-bar-fill { background: linear-gradient(90deg,#f59e0b,#fcd34d,#f59e0b); background-size:200% auto; animation: hoh-shimmer 2.5s linear infinite; }
        </style>`;

    const { legendRows, allLogs } = await buildHallLegendRows(classId);
    const crownedHeroes = legendRows.filter((row) => row.wins > 0);
    const topLegend = crownedHeroes[0] || null;

    const MEDAL = ['🥇', '🥈', '🥉'];

    let html = `
        <style>
            @keyframes hoh-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
            @keyframes hoh-in { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
            @keyframes hoh-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
            .hoh-card { animation: hoh-in 0.45s ease both; }
            .hoh-bar-fill { background: linear-gradient(90deg,#f59e0b,#fcd34d,#f59e0b); background-size:200% auto; animation: hoh-shimmer 2.5s linear infinite; }
            .hoh-crown { animation: hoh-float 3s ease-in-out infinite; display:inline-block; }
        </style>

        <div class="grid grid-cols-3 gap-3 mb-7">
            <div class="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-lg text-center">
                <div class="absolute -right-4 -bottom-4 text-white/10 text-7xl pointer-events-none"><i class="fas fa-crown"></i></div>
                <div class="text-[9px] uppercase tracking-[0.2em] font-black opacity-75 mb-1">Total Crowns</div>
                <div class="font-title text-4xl">${allLogs.length}</div>
            </div>
            <div class="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg text-center">
                <div class="absolute -right-4 -bottom-4 text-white/10 text-7xl pointer-events-none"><i class="fas fa-users"></i></div>
                <div class="text-[9px] uppercase tracking-[0.2em] font-black opacity-75 mb-1">Crowned Heroes</div>
                <div class="font-title text-4xl">${crownedHeroes.length}</div>
            </div>
            <div class="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-lg text-center">
                <div class="absolute -right-4 -bottom-4 text-white/10 text-7xl pointer-events-none"><i class="fas fa-star"></i></div>
                <div class="text-[9px] uppercase tracking-[0.2em] font-black opacity-75 mb-1">Top Legend</div>
                <div class="font-title text-2xl leading-tight truncate">${topLegend ? topLegend.student.name.split(' ')[0] : '—'}</div>
            </div>
        </div>
    `;

    if (!crownedHeroes.length) {
        html += `
            <div class="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <span class="text-7xl" style="animation:hoh-float 3s ease-in-out infinite;display:inline-block">🏛️</span>
                <p class="font-title text-xl text-slate-500">The Hall awaits its first legend.</p>
                <p class="text-sm text-slate-400">Save Adventure Logs to start building the Hall of Heroes.</p>
            </div>`;
    } else {
        html += `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-10">`;

        crownedHeroes.forEach((row, index) => {
            const heroClass = row.student.heroClass;
            const heroIcon = heroClass ? (HERO_CLASSES[heroClass]?.icon || '⭐') : '⭐';
            const medal = MEDAL[index] ?? null;
            const delay = Math.min(index * 60, 400);

            const avatarHtml = row.student.avatar
                ? `<img src="${row.student.avatar}" class="w-16 h-16 rounded-2xl object-cover border-4 border-white/80 shadow-xl" style="box-shadow:0 0 0 2px rgba(255,255,255,0.4),0 8px 24px rgba(0,0,0,0.25)">`
                : `<div class="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm text-white text-2xl font-title flex items-center justify-center border-4 border-white/50 shadow-xl">${row.student.name.charAt(0)}</div>`;

            const latestDate = row.latestDate
                ? row.latestDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'No crowns yet';

            const nextTierText = row.nextThreshold
                ? `${Math.max(0, row.nextThreshold - row.wins)} more crown${row.nextThreshold - row.wins === 1 ? '' : 's'} to reach <strong>${utils.getHeroLegendTierInfo(row.nextThreshold).label}</strong>`
                : '<i class="fas fa-infinity mr-1"></i>Maximum legend rank achieved';

            html += `
                <article class="hoh-card rounded-[1.75rem] overflow-hidden shadow-md border border-white/60 bg-white hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300" style="animation-delay:${delay}ms">
                    <div class="relative p-5 text-white bg-gradient-to-br ${row.tier.accent} overflow-hidden">
                        <div class="absolute inset-0 pointer-events-none">
                            <div class="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>
                        </div>
                        <div class="relative flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="relative flex-shrink-0">
                                    ${avatarHtml}
                                    <div class="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-xl bg-white shadow-lg border border-white/60 flex items-center justify-center text-base leading-none">${heroIcon}</div>
                                </div>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-1.5 mb-0.5">
                                        <span class="text-[9px] uppercase tracking-[0.2em] font-black opacity-70">#${index + 1}</span>
                                        ${medal ? `<span class="text-base leading-none">${medal}</span>` : ''}
                                    </div>
                                    <h3 class="font-title text-2xl leading-tight truncate">${row.student.name}</h3>
                                    <div class="inline-flex items-center gap-1.5 mt-1 bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide">
                                        <i class="fas fa-shield-halved text-[8px]"></i>
                                        ${row.tier.label}
                                    </div>
                                </div>
                            </div>
                            <div class="flex-shrink-0 text-right">
                                <div class="text-[9px] uppercase tracking-[0.18em] font-black opacity-70 mb-0.5">Crowns</div>
                                <div class="font-title text-5xl leading-none" style="text-shadow:0 2px 12px rgba(0,0,0,0.3)">${row.wins}</div>
                                <div class="text-[9px] opacity-60 mt-0.5"><i class="fas fa-crown"></i></div>
                            </div>
                        </div>
                    </div>

                    <div class="px-4 py-3 space-y-2.5">
                        <div class="grid grid-cols-2 gap-2">
                            <div class="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                                <i class="fas fa-calendar-check text-indigo-400 text-sm flex-shrink-0"></i>
                                <div>
                                    <div class="text-[9px] uppercase tracking-[0.14em] font-black text-slate-400">Latest Crown</div>
                                    <div class="font-bold text-slate-700 text-sm mt-0.5">${latestDate}</div>
                                </div>
                            </div>
                            <div class="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
                                <i class="fas fa-tag text-amber-400 text-sm flex-shrink-0"></i>
                                <div>
                                    <div class="text-[9px] uppercase tracking-[0.14em] font-black text-amber-600">Shop Perk</div>
                                    <div class="font-bold text-amber-900 text-sm mt-0.5">+${row.tier.extraDiscount}% off</div>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-xl bg-slate-900 px-4 py-3">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[9px] uppercase tracking-[0.16em] font-black text-slate-400 flex items-center gap-1.5">
                                    <i class="fas fa-bolt text-amber-400"></i> Next milestone
                                </span>
                                <span class="text-[10px] font-black text-amber-400">${row.progressPercent}%</span>
                            </div>
                            <div class="h-2 rounded-full bg-white/10 overflow-hidden">
                                <div class="h-full rounded-full hoh-bar-fill" style="width:${row.progressPercent}%"></div>
                            </div>
                            <p class="text-[11px] text-slate-400 mt-2">${nextTierText}</p>
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

    // --- RULE 1: DAILY LIMIT CHECK (Max 4 per class per day) ---
    const today = utils.getTodayDateString();
    const classBoonsToday = state.get('allAwardLogs').filter(l =>
        l.classId === receiver.classId &&
        l.date === today &&
        l.reason === 'peer_boon'
    ).length;

    if (classBoonsToday >= 4) {
        showToast("Daily limit reached: The class has already bestowed 4 Boons today!", "error");
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
        const monthKey = utils.getLocalMonthKey();
        const placeholder = '<option value="" disabled selected>-- Select a Sponsor --</option>';
        const optionsHtml = classmates.map(s => {
            const scoreData = scores.find(sc => sc.id === s.id);
            const gold = scoreData?.gold !== undefined ? scoreData.gold : (scoreData?.totalStars || 0);
            const freeBoonUses = Number(scoreData?.peerBoonFreeUses) || 0;
            const isMonthFree = scoreData?.peerBoonFreeMonthKey === monthKey;
            const hasFreeBoon = isMonthFree || freeBoonUses > 0;
            const hasEnoughGold = gold >= 15;
            const isConsecutiveLimit = scoreData?.lastPeerBoonRecipientId === receiverId;

            let labelSuffix = `(${gold} Gold)`;
            let isDisabled = false;

            if (isConsecutiveLimit) {
                isDisabled = true;
                labelSuffix = `(Unavailable: Consecutive Limit)`;
            } else if (!hasFreeBoon && !hasEnoughGold) {
                isDisabled = true;
                labelSuffix = `(Needs 15 Gold, has ${gold})`;
            } else if (hasFreeBoon) {
                labelSuffix = `(Free Boon Available!)`;
            }

            return `<option value="${s.id}" ${isDisabled ? 'disabled style="color: #94a3b8; opacity: 0.5;"' : ''}>${s.name} ${labelSuffix}</option>`;
        }).join('');

        select.innerHTML = placeholder + optionsHtml;
        document.getElementById('boon-confirm-btn').disabled = true;
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

    contentEl.className = 'space-y-4 text-left custom-scrollbar';

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
        
        <div class="zone-overview-body pb-1 md:pb-3 text-left">
            ${renderSection(completed, "Conquered", 'done')}
            ${renderSection(approaching, "Approaching", 'near')}
            ${renderSection(far, "On the Way", 'far')}
        </div>
    `;

    import('../modals.js').then(m => m.showAnimatedModal('milestone-details-modal'));
}

// --- PRODIGY OF THE MONTH FEATURE (FIXED) ---

const PRODIGY_COUNTS_CACHE_TAG = 'v4-award-log-credit-merge';
const prodigyCountsCache = new Map();

/** Latest completed month allowed in the hall — never the live calendar month. */
function getLatestViewableProdigyMonth(ref = new Date()) {
    return utils.getLatestCompletedMonthStart(ref);
}

let prodigyViewDate = getLatestViewableProdigyMonth();

function buildProdigyMonthOutcome(students, monthlyLogs, allScores, viewYear, viewMonthIndex, archivedByStudentId = {}) {
    const studentStats = students.map((student) => {
        const studentLogs = monthlyLogs.filter((log) => log.studentId === student.id);
        const fromLogs = studentLogs.reduce((sum, log) => sum + getAwardLogMonthlyStarCredit(log), 0);
        const archivedVal = archivedByStudentId[student.id];
        const totalStars = Object.prototype.hasOwnProperty.call(archivedByStudentId, student.id)
            ? (Number(archivedVal) || 0)
            : fromLogs;

        let count3 = 0;
        let count2 = 0;
        const reasons = new Set();

        studentLogs.forEach((log) => {
            const cred = getAwardLogMonthlyStarCredit(log);
            if (cred >= 3) count3++;
            else if (cred >= 2) count2++;
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

    studentStats.sort((a, b) => utils.sortStudentsByTieBreaker(
        { stars: a.monthlyStars, name: a.name, stats: a.stats },
        { stars: b.monthlyStars, name: b.name, stats: b.stats }
    ));

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
    const cacheKey = `${classId}::${PRODIGY_COUNTS_CACHE_TAG}`;
    if (prodigyCountsCache.has(cacheKey)) return prodigyCountsCache.get(cacheKey);

    const students = state.get('allStudents').filter((student) => student.classId === classId);
    const allScores = state.get('allWrittenScores').filter((score) => score.classId === classId);
    const monthCursor = new Date(constants.competitionStart.getFullYear(), constants.competitionStart.getMonth(), 1);
    const newestMonthStart = utils.getLatestCompletedMonthStart(new Date());
    const monthRequests = [];

    while (monthCursor <= newestMonthStart) {
        monthRequests.push({
            year: monthCursor.getFullYear(),
            monthIndex: monthCursor.getMonth(),
            month: monthCursor.getMonth() + 1,
            monthKey: utils.getMonthKey(monthCursor)
        });
        monthCursor.setMonth(monthCursor.getMonth() + 1);
    }

    const { fetchLogsForMonth } = await import('../../db/queries.js');
    const { fetchMonthlyHistory } = await import('../../state.js');

    const monthLogs = await Promise.all(monthRequests.map(async ({ year, month }) => {
        try {
            return await fetchLogsForMonth(year, month);
        } catch (error) {
            console.error('Prodigy monthly archive fetch failed:', error);
            return [];
        }
    }));

    const archivedRows = await Promise.all(
        monthRequests.map(({ monthKey }) => fetchMonthlyHistory(monthKey).catch(() => ({})))
    );

    const winCounts = new Map();
    const winnersByMonth = new Map();

    monthRequests.forEach((request, index) => {
        const logsForClass = monthLogs[index].filter((log) => log.classId === classId);
        const { winners } = buildProdigyMonthOutcome(
            students,
            logsForClass,
            allScores,
            request.year,
            request.monthIndex,
            archivedRows[index] || {}
        );
        winnersByMonth.set(request.monthKey, winners.map((winner) => winner.id));
        winners.forEach((winner) => {
            winCounts.set(winner.id, (winCounts.get(winner.id) || 0) + 1);
        });
    });

    const result = { winCounts, winnersByMonth };
    prodigyCountsCache.set(cacheKey, result);
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

    // Hall opens on the most recent completed month only (never the in-progress month).
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

    const archiveStart = new Date(constants.competitionStart.getFullYear(), constants.competitionStart.getMonth(), 1);
    const canGoBack = (new Date(viewYear, viewMonthIndex, 1) > archiveStart);
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
    const { fetchMonthlyHistory } = await import('../../state.js');

    const viewMonthKey = utils.getMonthKey(new Date(viewYear, viewMonthIndex, 1));
    const archivedByStudent = await fetchMonthlyHistory(viewMonthKey).catch(() => ({}));

    const fetched = await fetchLogsForMonth(viewYear, viewMonthIndex + 1);
    const logsToAnalyze = fetched.filter(l => l.classId === classId);

    const monthlyLogs = logsToAnalyze.filter(l => {
        const d = utils.parseFlexibleDate(l.date);
        return d && d.getMonth() === viewMonthIndex && d.getFullYear() === viewYear;
    });

    const allScores = state.get('allWrittenScores').filter(s => s.classId === classId);
    const students = state.get('allStudents').filter(s => s.classId === classId);
    const { winCounts } = await countsPromise;

    const hasArchivedNonZero = students.some((s) => (Number(archivedByStudent[s.id]) || 0) > 0);
    const hasLogActivity = monthlyLogs.length > 0;

    if (!hasLogActivity && !hasArchivedNonZero) {
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
        const { winners } = buildProdigyMonthOutcome(students, monthlyLogs, allScores, viewYear, viewMonthIndex, archivedByStudent);

        if (!winners || winners.length === 0) {
            contentEl.innerHTML = `<div class="h-full flex flex-col items-center justify-center gap-3 text-indigo-500 py-12 px-4 text-center prodigy-hall-tagline">
                <i class="fas fa-star-half-stroke text-3xl text-amber-400" aria-hidden="true"></i>
                <span>No stars this month for <span class="font-title text-indigo-800">${monthName}</span>, so there is no prodigy for this month.</span>
            </div>`;
        } else {
            const isTie = winners.length > 1;
            const titleText = isTie ? "Legendary Co-Prodigy" : "Eternal Prodigy";

            const cardsHtml = winners.map(winner => {
                const scoreData = state.get('allStudentScores').find(sc => sc.id === winner.id);
                const inventory = scoreData?.inventory || [];
                const vaultLimit = isTie ? 10 : 8;
                const inventoryHtml = inventory.length > 0
                    ? inventory.slice(0, vaultLimit).map(item => {
                        const visual = item.image ? `<img src="${item.image}" class="w-full h-full object-cover" alt="">` : `<span class="text-sm leading-none">${item.icon || '📦'}</span>`;
                        const box = isTie
                            ? `prodigy-hall-vault-item prodigy-hall-vault-item--co w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/90 border border-white/80 flex items-center justify-center overflow-hidden shrink-0`
                            : `prodigy-hall-vault-item w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/90 border-2 border-white/80 flex items-center justify-center overflow-hidden shrink-0`;
                        return `<div class="${box}" title="${item.name}">${visual}</div>`;
                    }).join('')
                    : `<span class="text-xs text-white/60 italic${isTie ? ' prodigy-hall-co-empty-vault' : ''}">No shop items yet</span>`;

                const avatarHtml = winner.avatar
                    ? `<img src="${winner.avatar}" class="w-full h-full object-cover" alt="">`
                    : `<div class="w-full h-full flex items-center justify-center ${isTie ? 'text-xl sm:text-2xl' : 'text-3xl sm:text-4xl'} font-title text-indigo-600 bg-white">${winner.name.charAt(0)}</div>`;

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

                if (isTie) {
                    return `
                <div class="prodigy-hall-card prodigy-hall-card--co relative min-w-0 w-full group/card animate-in">
                    <div class="prodigy-hall-card__inner prodigy-hall-card__inner--co p-3 sm:p-3.5 h-full max-h-full flex flex-col">
                        <div class="prodigy-hall-card__stars absolute inset-0 opacity-[0.17] pointer-events-none"></div>
                        <div class="relative z-[2] flex flex-row gap-2.5 sm:gap-3 items-start text-left flex-1 min-h-0">
                            <div class="relative shrink-0">
                                <div class="prodigy-hall-avatar-ring w-14 h-14 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full border-[3px] border-white/35 overflow-hidden bg-indigo-50">
                                    ${avatarHtml}
                                </div>
                                <div class="absolute -top-0.5 -right-0.5 bg-white w-7 h-7 rounded-full flex items-center justify-center shadow-md border-2 border-amber-400 text-amber-500" aria-hidden="true">
                                    <i class="fas fa-trophy text-xs"></i>
                                </div>
                            </div>
                            <div class="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2">
                                <div class="flex flex-wrap items-center justify-between gap-1">
                                    <div class="prodigy-hall-crown-pill text-amber-950 px-2 py-1 rounded-lg text-[9px] sm:text-[10px] uppercase tracking-wide flex items-center gap-1 bg-amber-400 leading-tight">
                                        <i class="fas fa-crown text-[9px]" aria-hidden="true"></i>
                                        ${titleText}
                                    </div>
                                    <div class="prodigy-hall-medal-pill flex items-center gap-1 bg-white/12 px-2 py-0.5 rounded-lg border border-white/20">
                                        <span class="text-sm text-amber-200 font-title">${timesCrowned}×</span>
                                        <i class="fas fa-medal text-amber-300 text-[10px]" aria-hidden="true"></i>
                                    </div>
                                </div>
                                <h2 class="prodigy-hall-student-name text-base sm:text-lg md:text-xl text-white tracking-tight leading-snug break-words">${winner.name}</h2>
                                <div class="prodigy-hall-badge-row flex flex-wrap items-center gap-1.5 text-white/90">
                                    <span class="text-amber-200 font-title text-xl sm:text-2xl leading-none">${winner.monthlyStars}</span>
                                    <span class="font-semibold text-[11px] sm:text-xs leading-tight"><i class="fas fa-sparkles text-amber-300 mr-1" aria-hidden="true"></i>stars this month</span>
                                </div>
                                <div class="bg-gradient-to-r ${badgeColor} px-2 py-1.5 rounded-xl border border-white/25 flex items-center gap-1.5 shadow-sm">
                                    <span class="text-white text-sm" aria-hidden="true"><i class="fas ${badgeFa}"></i></span>
                                    <span class="text-white prodigy-hall-badge-row text-[10px] sm:text-xs leading-snug">${badgeText}</span>
                                </div>
                                <div class="grid grid-cols-2 gap-1.5 sm:gap-2 text-left">
                                    <div class="bg-black/25 rounded-xl px-2 py-2 border border-white/10" title="How many different praise reasons were used when awarding stars">
                                        <p class="prodigy-hall-stat-label text-[9px] sm:text-[10px] text-indigo-100/95 mb-0.5 flex items-start gap-1 leading-snug">
                                            <i class="fas fa-comments text-amber-300 shrink-0 mt-0.5" aria-hidden="true"></i>
                                            <span>Different praise reasons</span>
                                        </p>
                                        <p class="text-white font-title text-lg sm:text-xl leading-none">${winner.stats.uniqueReasons}</p>
                                    </div>
                                    <div class="bg-black/25 rounded-xl px-2 py-2 border border-white/10" title="Days this month with three or more stars in one go">
                                        <p class="prodigy-hall-stat-label text-[9px] sm:text-[10px] text-indigo-100/95 mb-0.5 flex items-start gap-1 leading-snug">
                                            <i class="fas fa-star text-amber-300 shrink-0 mt-0.5" aria-hidden="true"></i>
                                            <span>Days with 3★ or more</span>
                                        </p>
                                        <p class="text-white font-title text-lg sm:text-xl leading-none">${winner.stats.count3}</p>
                                    </div>
                                </div>
                                <div class="mt-0.5 min-h-0">
                                    <p class="prodigy-hall-vault-title text-[9px] sm:text-[10px] text-indigo-100/90 mb-1 flex items-center gap-1 font-semibold leading-tight">
                                        <i class="fas fa-bag-shopping text-sky-300" aria-hidden="true"></i> Shop items owned
                                    </p>
                                    <div class="prodigy-hall-co-vault-strip flex flex-nowrap gap-1 sm:gap-1.5 justify-start items-center overflow-x-auto overflow-y-hidden pb-0.5 -mx-0.5 px-0.5">
                                        ${inventoryHtml}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
                }

                return `
                <div class="prodigy-hall-card relative w-full max-w-3xl group/card animate-in">
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

            if (isTie) {
                const coMany = winners.length > 2;
                const coExtra = coMany ? ' prodigy-hall-co-grid--many' : '';
                contentEl.innerHTML = `<div class="prodigy-hall-co-layout prodigy-hall-co-grid w-full h-full min-h-0 animate-in flex-1${coExtra}">${cardsHtml}</div>`;
            } else {
                contentEl.innerHTML = `<div class="flex justify-center w-full pb-4 md:pb-6 animate-in">${cardsHtml}</div>`;
            }
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
