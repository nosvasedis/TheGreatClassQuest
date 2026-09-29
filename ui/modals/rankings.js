// /ui/modals/rankings.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { getNormalizedPercentForScore } from '../../features/assessmentConfig.js';
import { showAnimatedModal } from './base.js';
import {
    buildProdigyEmptyHtml,
    buildProdigyLoadingHtml,
    buildProdigyNavHtml,
    buildProdigyShrinesHtml,
    buildProdigyYearHtml
} from './prodigyHallView.js';
import { showToast } from '../effects.js';
import { renderBoonSponsorPicker } from '../boonSponsorPicker.js';
import { playSound } from '../../audio.js';
import {
    HERO_CLASSES,
    PEER_BOON_BASE_STARS,
    PEER_BOON_COST,
    PEER_BOON_DAILY_CAP,
    calculatePatronGiftEffects
} from '../../features/heroClasses.js';
import { canUseFeature } from '../../utils/subscription.js';
import {
    getAwardLogMonthlyStarCredit,
    mergeMonthlyStarsFromArchivedHistoryAndAwardLogs,
    sumMonthlyStarCreditsByStudentFromAwardLogs
} from '../../features/awardLogReasonMeta.js';
import { db, doc, writeBatch } from '../../firebase.js';
import { getLiveYearGoldFromAppState } from '../../utils/yearGold.js';

import { getYearLegendContextFromState, getYearScopedHeroOfDayWins } from '../../utils/yearLegend.js';
import { getSchoolYearStartMonthDate, getViewableCompletedMonthStart, withActiveScoreYear } from '../../utils/schoolYear.js';

let rankingsViewDate = new Date();

function getArchiveStartMonth() {
    return getSchoolYearStartMonthDate(
        state.getActiveSchoolYearStartDate(),
        state.getActiveSchoolYearKey()
    ) || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
}

function getLatestViewableArchiveMonth(ref = new Date()) {
    return getViewableCompletedMonthStart({
        startsAt: state.getActiveSchoolYearStartDate(),
        yearKey: state.getActiveSchoolYearKey(),
        now: ref
    });
}

// --- STUDENT RANKINGS MODAL (HERO RANKS ARCHIVE) ---
export async function openStudentRankingsModal(resetDate = true) {
    const modalId = 'global-leaderboard-modal';
    const titleEl = document.getElementById('global-leaderboard-title');
    const subtitleEl = document.getElementById('global-leaderboard-subtitle');
    const controlsEl = document.getElementById('global-leaderboard-controls');
    const contentEl = document.getElementById('global-leaderboard-content');

    // 1. Archives never include the in-progress month, and never last year's months.
    if (resetDate) {
        rankingsViewDate = getLatestViewableArchiveMonth();
    }

    titleEl.innerHTML = `Hero Logs`;
    if (subtitleEl) subtitleEl.innerText = 'Monthly ranks (completed months only)';

    if (!rankingsViewDate) {
        if (controlsEl) controlsEl.innerHTML = '';
        contentEl.innerHTML = `<div class="text-center py-10 px-6 max-w-md mx-auto">
            <p class="font-title text-2xl text-indigo-900 mb-2">A new year</p>
            <p class="text-slate-500 font-semibold">This year's monthly ranks open after the first school month closes. Last year's logs stay in last year's archive.</p>
        </div>`;
        if (resetDate) showAnimatedModal(modalId);
        return;
    }

    const activeMonthKey = utils.getMonthKey(rankingsViewDate);
    const monthDisplay = rankingsViewDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
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
    const allLeagues = (await import('../../constants.js')).questLeagues;
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
            const archiveStart = getArchiveStartMonth();
            const previous = new Date(rankingsViewDate.getFullYear(), rankingsViewDate.getMonth() - 1, 1);
            if (previous < archiveStart) return;
            rankingsViewDate = previous;
            openStudentRankingsModal(false);
        };
    }
    if (nextBtn) {
        nextBtn.onclick = () => {
            const ceiling = getLatestViewableArchiveMonth(new Date());
            if (!ceiling) return;
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
                        ${s.avatar ? `<img src="${s.avatar}" loading="lazy" decoding="async" class="w-10 h-10 rounded-full object-cover">` : `<div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">${s.name.charAt(0)}</div>`}
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
    document.getElementById('history-modal')?.classList.add('is-hoh');

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
    const monthCursor = getArchiveStartMonth();
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

    const yearKey = state.getActiveSchoolYearKey();
    const batch = writeBatch(db);
    updates.forEach((row) => {
        const payload = {
            heroOfDayWins: row.wins,
            ...(yearKey ? { heroOfDayWinsYearKey: yearKey } : {})
        };
        batch.set(
            doc(db, 'artifacts/great-class-quest/public/data/student_scores', row.student.id),
            yearKey ? withActiveScoreYear(payload, yearKey) : payload,
            { merge: true }
        );
    });
    await batch.commit();

    const scoreMap = new Map(updates.map((row) => [row.student.id, row.wins]));
    const allScores = state.get('allStudentScores') || [];
    const knownIds = new Set(allScores.map((score) => score.id));
    const mergedScores = allScores.map((score) => (
        scoreMap.has(score.id)
            ? { ...score, heroOfDayWins: scoreMap.get(score.id), ...(yearKey ? { heroOfDayWinsYearKey: yearKey } : {}) }
            : score
    ));

    updates.forEach((row) => {
        if (!knownIds.has(row.student.id)) {
            mergedScores.push({
                id: row.student.id,
                heroOfDayWins: row.wins,
                ...(yearKey ? { heroOfDayWinsYearKey: yearKey } : {})
            });
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
        const storedWins = getYearScopedHeroOfDayWins(
            scoreByStudentId.get(student.id),
            getYearLegendContextFromState(state)
        );
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

function escapeHallText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function hallPortraitHtml(student, sizeClass = '') {
    const name = escapeHallText(student.name);
    return student.avatar
        ? `<img src="${escapeHallText(student.avatar)}" alt="${name}" class="hoh-portrait__img ${sizeClass}" loading="lazy" decoding="async">`
        : `<span class="hoh-portrait__initial ${sizeClass}" aria-hidden="true">${escapeHallText(String(student.name || '?').trim().charAt(0).toUpperCase())}</span>`;
}

function hallCrownTallyHtml(wins) {
    const shown = Math.min(wins, 10);
    const crowns = Array.from({ length: shown }, () => '<i class="fas fa-crown"></i>').join('');
    return `<span class="hoh-tally" aria-label="${wins} crown${wins === 1 ? '' : 's'}">${crowns}${wins > 10 ? `<b>+${wins - 10}</b>` : ''}</span>`;
}

function hallFrameHtml(row, rank, { featured = false } = {}) {
    const heroClass = row.student.heroClass;
    const heroIcon = heroClass ? (HERO_CLASSES[heroClass]?.icon || '') : '';
    const latestDate = row.latestDate
        ? row.latestDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : '';
    const toNext = row.nextThreshold ? Math.max(0, row.nextThreshold - row.wins) : 0;
    const nextLabel = row.nextThreshold ? utils.getHeroLegendTierInfo(row.nextThreshold).label : '';
    const nextText = row.nextThreshold
        ? `${toNext} more to <strong>${nextLabel}</strong>`
        : 'Highest rank reached';
    const rankLabel = ['First', 'Second', 'Third'][rank - 1] || `No. ${rank}`;
    const delay = Math.min(rank * 60, 480);

    return `
        <article class="hoh-frame hoh-frame--${row.tier.key}${featured ? ' hoh-frame--featured hoh-frame--rank' + rank : ''}" style="animation-delay:${delay}ms">
            <div class="hoh-frame__picture">
                <span class="hoh-portrait">${hallPortraitHtml(row.student)}</span>
                ${heroIcon ? `<span class="hoh-frame__class" title="${escapeHallText(heroClass)}">${heroIcon}</span>` : ''}
                ${featured ? `<span class="hoh-frame__rank">${rankLabel}</span>` : ''}
            </div>
            <div class="hoh-plate">
                <h3 class="hoh-plate__name">${escapeHallText(row.student.name)}</h3>
                <p class="hoh-plate__tier">${escapeHallText(row.tier.label)}${row.tier.extraDiscount ? ` · ${row.tier.extraDiscount}% off in the Market` : ''}</p>
            </div>
            <div class="hoh-frame__facts">
                <div class="hoh-frame__crowns">
                    <span class="hoh-frame__count">${row.wins}</span>
                    <span class="hoh-frame__count-label">crown${row.wins === 1 ? '' : 's'}</span>
                </div>
                ${hallCrownTallyHtml(row.wins)}
                <div class="hoh-progress" role="img" aria-label="${row.progressPercent}% of the way to the next rank">
                    <span class="hoh-progress__fill" style="width:${row.progressPercent}%"></span>
                </div>
                <p class="hoh-frame__next">${nextText}${latestDate ? `<span>Last crowned ${latestDate}</span>` : ''}</p>
            </div>
        </article>`;
}

/** Pure markup for the Hall of Heroes; exported so the guidebook capture renders the real layout. */
export function buildHallOfHeroesHtml(legendRows, crownCount) {
    const crownedHeroes = legendRows.filter((row) => row.wins > 0);
    const waiting = legendRows.filter((row) => row.wins === 0);

    let html = `
        <div class="hoh-hall">
            <div class="hoh-plaques">
                <div class="hoh-plaque"><span class="hoh-plaque__value">${crownCount}</span><span class="hoh-plaque__label">crowns awarded</span></div>
                <div class="hoh-plaque"><span class="hoh-plaque__value">${crownedHeroes.length}</span><span class="hoh-plaque__label">heroes crowned</span></div>
                <div class="hoh-plaque"><span class="hoh-plaque__value">${waiting.length}</span><span class="hoh-plaque__label">still waiting</span></div>
            </div>
    `;

    if (!crownedHeroes.length) {
        html += `
            <div class="hoh-empty">
                <span class="hoh-empty__frame" aria-hidden="true"><i class="fas fa-crown"></i></span>
                <p class="hoh-empty__title">The walls are waiting for their first portrait.</p>
                <p class="hoh-empty__body">Each time you save a page in the Adventure Log, that lesson's Hero of the Day is hung here.</p>
            </div>`;
    } else {
        const podium = crownedHeroes.slice(0, 3);
        const gallery = crownedHeroes.slice(3);
        html += `<section class="hoh-podium" aria-label="Top heroes">${podium.map((row, i) => hallFrameHtml(row, i + 1, { featured: true })).join('')}</section>`;
        if (gallery.length) {
            html += `
                <h3 class="hoh-section-title"><span>The gallery</span></h3>
                <section class="hoh-gallery">${gallery.map((row, i) => hallFrameHtml(row, i + 4)).join('')}</section>`;
        }
    }

    if (waiting.length) {
        html += `
            <h3 class="hoh-section-title"><span>Waiting for their first crown</span></h3>
            <div class="hoh-waiting">
                ${waiting.map((row) => `<span class="hoh-waiting__chip"><span class="hoh-waiting__face">${hallPortraitHtml(row.student)}</span>${escapeHallText(row.student.name)}</span>`).join('')}
            </div>`;
    }

    html += `
            <footer class="hoh-legend" aria-label="Legend ranks">
                <span class="hoh-legend__item hoh-legend__item--rising"><i class="fas fa-crown"></i> 3 crowns · Rising Legend · 5% off</span>
                <span class="hoh-legend__item hoh-legend__item--golden"><i class="fas fa-crown"></i> 5 crowns · Golden Legend · 10% off</span>
                <span class="hoh-legend__item hoh-legend__item--mythic"><i class="fas fa-crown"></i> 10 crowns · Mythic Legend · 15% off</span>
            </footer>
        </div>`;

    return html;
}

async function renderHallOfHeroesContent(classId) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const contentEl = document.getElementById('history-modal-content');
    const titleEl = document.getElementById('history-modal-title');
    const subtitleEl = document.getElementById('history-modal-subtitle');
    if (titleEl) titleEl.innerText = 'Hall of Heroes';
    if (subtitleEl) subtitleEl.innerText = `${classData?.name || 'Class'} · Heroes of the Day`;

    contentEl.innerHTML = `
        <div class="hoh-loading">
            <i class="fas fa-crown" aria-hidden="true"></i>
            <p>Hanging the portraits…</p>
        </div>`;

    const { legendRows, allLogs } = await buildHallLegendRows(classId);
    contentEl.innerHTML = buildHallOfHeroesHtml(legendRows, allLogs.length);
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

    if (classBoonsToday >= PEER_BOON_DAILY_CAP) {
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

    const pickerOptions = [];
    const heroProgressionEnabled = canUseFeature('heroProgression');
    if (classmates.length === 0) {
        select.innerHTML = `<option value="">No other students in class</option>`;
    } else {
        const monthKey = utils.getLocalMonthKey();
        const placeholder = '<option value="" disabled selected>-- Select a Sponsor --</option>';
        const optionsHtml = classmates.map(s => {
            const scoreData = scores.find(sc => sc.id === s.id);
            const gold = getLiveYearGoldFromAppState(scoreData, state);
            const freeBoonUses = Number(scoreData?.peerBoonFreeUses) || 0;
            const isMonthFree = scoreData?.peerBoonFreeMonthKey === monthKey;
            const hasFreeBoon = isMonthFree || freeBoonUses > 0;
            const hasEnoughGold = gold >= PEER_BOON_COST;
            const isConsecutiveLimit = scoreData?.lastPeerBoonRecipientId === receiverId;
            const isDisabled = isConsecutiveLimit || (!hasFreeBoon && !hasEnoughGold);
            const patronGift = heroProgressionEnabled ? calculatePatronGiftEffects(s, scoreData) : null;

            pickerOptions.push({
                id: s.id,
                name: s.name,
                avatar: s.avatar || '',
                gold,
                status: isDisabled ? 'locked' : (hasFreeBoon ? 'free' : 'ready'),
                reason: isConsecutiveLimit ? 'Gave them the last one' : `Needs ${PEER_BOON_COST} Gold`,
                patronGoldBack: patronGift?.applies ? patronGift.giverGoldBonus : 0,
                extraStars: patronGift?.applies ? patronGift.extraStarsForReceiver : 0
            });

            return `<option value="${s.id}"${isDisabled ? ' disabled' : ''}>${String(s.name).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}</option>`;
        }).join('');

        select.innerHTML = placeholder + optionsHtml;
    }
    document.getElementById('boon-confirm-btn').disabled = true;
    const receiverScore = scores.find(sc => sc.id === receiverId);
    renderBoonSponsorPicker(pickerOptions, {
        receiver: {
            id: receiver.id,
            name: receiver.name,
            avatar: receiver.avatar || '',
            monthlyStars: Math.round((Number(receiverScore?.monthlyStars) || 0) * 10) / 10
        },
        boonsToday: classBoonsToday,
        dailyCap: PEER_BOON_DAILY_CAP,
        cost: PEER_BOON_COST,
        baseStars: PEER_BOON_BASE_STARS
    });

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

    const sortDesc = utils.sortTeamQuestEntries;

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

/** Latest completed month in this school year — never the live month, never last year. */
function getLatestViewableProdigyMonth(ref = new Date()) {
    return getLatestViewableArchiveMonth(ref);
}

let prodigyViewDate = null;

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

export async function getProdigyCountsForClass(classId) {
    const cacheKey = `${classId}::${state.getActiveSchoolYearKey() || 'legacy'}::${PRODIGY_COUNTS_CACHE_TAG}`;
    if (prodigyCountsCache.has(cacheKey)) return prodigyCountsCache.get(cacheKey);

    const students = state.get('allStudents').filter((student) => student.classId === classId);
    const allScores = state.get('allWrittenScores').filter((score) => score.classId === classId);
    const monthCursor = getArchiveStartMonth();
    const newestMonthStart = getLatestViewableArchiveMonth(new Date());
    const monthRequests = [];

    if (newestMonthStart) {
        while (monthCursor <= newestMonthStart) {
            monthRequests.push({
                year: monthCursor.getFullYear(),
                monthIndex: monthCursor.getMonth(),
                month: monthCursor.getMonth() + 1,
                monthKey: utils.getMonthKey(monthCursor)
            });
            monthCursor.setMonth(monthCursor.getMonth() + 1);
        }
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

let prodigyRenderToken = 0;
let prodigyShownMonthKey = null;
let prodigyFrozenAnimations = [];
let prodigyCloseObserver = null;

/** Pause looping animations behind the hall while it is open (weak laptops), resume on close. */
function freezeProdigyBackdrop(modal) {
    if (typeof document.getAnimations !== 'function' || prodigyFrozenAnimations.length) return;
    const toasts = document.getElementById('toast-container');
    prodigyFrozenAnimations = document.getAnimations().filter((animation) => {
        if (animation.playState !== 'running') return false;
        if (animation.effect?.getTiming?.().iterations !== Infinity) return false;
        const target = animation.effect?.target;
        return !!target && !modal.contains(target) && !toasts?.contains(target);
    });
    prodigyFrozenAnimations.forEach((animation) => animation.pause());
    if (!prodigyCloseObserver && typeof MutationObserver === 'function') {
        prodigyCloseObserver = new MutationObserver(() => {
            if (!modal.classList.contains('hidden')) return;
            const frozen = prodigyFrozenAnimations;
            prodigyFrozenAnimations = [];
            frozen.forEach((animation) => { if (animation.playState === 'paused') animation.play(); });
        });
        prodigyCloseObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
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
    prodigyShownMonthKey = null;

    const modal = document.getElementById('prodigy-modal');
    const contentEl = document.getElementById('prodigy-content');
    if (contentEl) contentEl.innerHTML = buildProdigyLoadingHtml();
    const yearEl = document.getElementById('prodigy-year-strip');
    if (yearEl) {
        yearEl.innerHTML = '';
        yearEl.classList.remove('is-settled');
    }
    const navEl = document.getElementById('prodigy-nav-container');
    if (navEl) navEl.innerHTML = '';

    showAnimatedModal('prodigy-modal');
    if (modal) freezeProdigyBackdrop(modal);
    await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    await renderProdigyHistory(currentGlobal);
}

function buildProdigyYearMonths(archiveStart, latestViewable, viewKey, winnersByMonth, students) {
    const byId = new Map(students.map((s) => [s.id, s]));
    const months = [];
    if (!archiveStart) return months;
    const cursor = new Date(archiveStart.getFullYear(), archiveStart.getMonth(), 1);
    const liveMonth = latestViewable
        ? new Date(latestViewable.getFullYear(), latestViewable.getMonth() + 1, 1)
        : new Date(archiveStart.getFullYear(), archiveStart.getMonth(), 1);
    while (cursor <= liveMonth && months.length < 13) {
        const key = utils.getMonthKey(cursor);
        const isLive = cursor.getTime() === liveMonth.getTime();
        const winners = isLive ? [] : (winnersByMonth?.get?.(key) || [])
            .map((id) => byId.get(id))
            .filter(Boolean)
            .map((s) => ({ name: s.name, avatar: s.avatar }));
        months.push({
            key,
            short: cursor.toLocaleString('en-GB', { month: 'short' }),
            label: cursor.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
            state: isLive ? 'live' : (winners.length ? 'crowned' : 'empty'),
            isCurrent: key === viewKey,
            winners,
        });
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
}

export async function renderProdigyHistory(classId) {
    if (!classId) return;
    const contentEl = document.getElementById('prodigy-content');
    const navEl = document.getElementById('prodigy-nav-container');
    const yearEl = document.getElementById('prodigy-year-strip');
    if (!contentEl || !navEl) return;
    const token = ++prodigyRenderToken;
    const isStale = () => token !== prodigyRenderToken;

    // First paint of this opening shows the lighting-up state; month changes keep the old shrine
    // dimmed until the new one is ready.
    if (!prodigyShownMonthKey) contentEl.innerHTML = buildProdigyLoadingHtml();
    else contentEl.classList.add('is-turning');

    const countsPromise = getProdigyCountsForClass(classId).catch(() => ({ winCounts: new Map(), winnersByMonth: new Map() }));
    await import('../../db/actions.js').then(a => a.ensureHistoryLoaded());
    if (isStale()) return;

    const now = new Date();
    const archiveStart = getArchiveStartMonth();
    const latestViewable = getLatestViewableProdigyMonth(now);
    const students = state.get('allStudents').filter(s => s.classId === classId);

    if (!latestViewable) {
        navEl.innerHTML = '';
        if (yearEl) yearEl.innerHTML = buildProdigyYearHtml(buildProdigyYearMonths(archiveStart, null, null, new Map(), students));
        contentEl.classList.remove('is-turning');
        contentEl.innerHTML = buildProdigyEmptyHtml({ variant: 'new-year' });
        prodigyShownMonthKey = 'new-year';
        return;
    }

    if (!prodigyViewDate || prodigyViewDate < archiveStart) {
        prodigyViewDate = new Date(latestViewable.getFullYear(), latestViewable.getMonth(), 1);
    }

    let viewYear = prodigyViewDate.getFullYear();
    let viewMonthIndex = prodigyViewDate.getMonth();
    const viewStart = new Date(viewYear, viewMonthIndex, 1);
    if (viewStart > latestViewable || viewStart < archiveStart) {
        prodigyViewDate = new Date(latestViewable.getFullYear(), latestViewable.getMonth(), 1);
        viewYear = prodigyViewDate.getFullYear();
        viewMonthIndex = prodigyViewDate.getMonth();
    }

    const monthName = prodigyViewDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const viewMonthKey = utils.getMonthKey(new Date(viewYear, viewMonthIndex, 1));

    const canGoBack = (new Date(viewYear, viewMonthIndex, 1) > archiveStart);
    const nextMonthStart = new Date(viewYear, viewMonthIndex + 1, 1);
    const canGoForward = nextMonthStart <= latestViewable;

    navEl.innerHTML = buildProdigyNavHtml({ monthName, canGoBack, canGoForward });

    const { fetchLogsForMonth } = await import('../../db/queries.js');
    const { fetchMonthlyHistory } = await import('../../state.js');

    const archivedByStudent = await fetchMonthlyHistory(viewMonthKey).catch(() => ({}));

    const fetched = await fetchLogsForMonth(viewYear, viewMonthIndex + 1);
    const logsToAnalyze = fetched.filter(l => l.classId === classId);

    const monthlyLogs = logsToAnalyze.filter(l => {
        const d = utils.parseFlexibleDate(l.date);
        return d && d.getMonth() === viewMonthIndex && d.getFullYear() === viewYear;
    });

    const allScores = state.get('allWrittenScores').filter(s => s.classId === classId);
    const { winCounts, winnersByMonth } = await countsPromise;
    if (isStale()) return;

    const hasArchivedNonZero = students.some((s) => (Number(archivedByStudent[s.id]) || 0) > 0);
    const hasLogActivity = monthlyLogs.length > 0;
    const direction = prodigyShownMonthKey && prodigyShownMonthKey !== 'new-year' && prodigyShownMonthKey !== viewMonthKey
        ? (viewMonthKey > prodigyShownMonthKey ? 'next' : 'prev')
        : '';

    let html;
    if (!hasLogActivity && !hasArchivedNonZero) {
        html = buildProdigyEmptyHtml({ variant: 'quiet', monthName });
    } else {
        const { winners } = buildProdigyMonthOutcome(students, monthlyLogs, allScores, viewYear, viewMonthIndex, archivedByStudent);
        if (!winners || winners.length === 0) {
            html = buildProdigyEmptyHtml({ variant: 'no-stars', monthName });
        } else {
            const allScoreData = state.get('allStudentScores') || [];
            const inventoryById = new Map(winners.map((w) => [w.id, allScoreData.find(sc => sc.id === w.id)?.inventory || []]));
            html = buildProdigyShrinesHtml({ winners, monthName, crownsById: winCounts, inventoryById, direction });
        }
    }

    contentEl.classList.remove('is-turning');
    contentEl.innerHTML = html;
    contentEl.scrollTop = 0;
    prodigyShownMonthKey = viewMonthKey;

    if (yearEl) {
        // Coins pop in once per opening; month changes just move the highlight.
        yearEl.classList.toggle('is-settled', yearEl.childElementCount > 0);
        yearEl.innerHTML = buildProdigyYearHtml(buildProdigyYearMonths(archiveStart, latestViewable, viewMonthKey, winnersByMonth, students));
        yearEl.querySelector('.ph-coin.is-current')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
        yearEl.querySelectorAll('[data-prodigy-month]').forEach((coin) => {
            coin.onclick = () => {
                const [y, m] = coin.dataset.prodigyMonth.split('-').map(Number);
                if (!y || !m || coin.dataset.prodigyMonth === prodigyShownMonthKey) return;
                playSound('click');
                prodigyViewDate = new Date(y, m - 1, 1);
                renderProdigyHistory(classId);
            };
        });
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
