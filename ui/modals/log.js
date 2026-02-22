// /ui/modals/log.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import { db } from '../../firebase.js';
import { query, collection, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { showAnimatedModal } from './base.js';
import { fetchLogsForDate } from '../../db/queries.js';

export function openEditClassModal(classId) {
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;
    document.getElementById('edit-class-id').value = classId;
    document.getElementById('edit-class-name').value = classData.name;
    document.getElementById('edit-class-logo').value = classData.logo || '📚';
    document.getElementById('edit-logo-picker-btn').innerText = classData.logo || '📚';
    document.getElementById('edit-class-time-start').value = classData.timeStart || '';
    document.getElementById('edit-class-time-end').value = classData.timeEnd || '';
    const levelSelect = document.getElementById('edit-class-level');
    levelSelect.innerHTML = constants.questLeagues.map(l => `<option value="${l}" ${l === classData.questLevel ? 'selected' : ''}>${l}</option>`).join('');
    const daysContainer = document.getElementById('edit-schedule-days');
    const days = [{ v: "1", l: "Mon" }, { v: "2", l: "Tue" }, { v: "3", l: "Wed" }, { v: "4", l: "Thu" }, { v: "5", l: "Fri" }, { v: "6", l: "Sat" }, { v: "0", l: "Sun" }];
    daysContainer.innerHTML = days.map(d => `<label class="flex items-center space-x-2 bg-gray-50 px-3 py-1 rounded-full"><input type="checkbox" name="edit-schedule-day" value="${d.v}" ${(classData.scheduleDays || []).includes(d.v) ? 'checked' : ''}><span>${d.l}</span></label>`).join('');
    showAnimatedModal('edit-class-modal');
}

export async function showLogbookModal(dateString, isOndemand = false) {
    const titleEl = document.getElementById('logbook-modal-title');
    const contentEl = document.getElementById('logbook-modal-content');
    const displayDate = utils.parseDDMMYYYY(dateString);
    titleEl.innerText = `Log for ${displayDate.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' })}`;

    let logs;

    if (isOndemand) {
        contentEl.innerHTML = '<p class="text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Fetching historical log...</p>';
        // Use the helper to show the modal with animation
        showAnimatedModal('logbook-modal'); 
        logs = await fetchLogsForDate(dateString);
    } else {
        // --- THE FIX: SIMPLIFIED FILTER ---
        // Old way: utils.getDDMMYYYY(utils.parseDDMMYYYY(log.date)) === dateString
        // New way: direct string comparison. Much faster and less error-prone.
        // FIX: Robust Date Comparison
    // 1. Create a standardized timestamp for the day selected on the calendar
    const targetTime = utils.parseDDMMYYYY(dateString).setHours(0, 0, 0, 0);

    // 2. Filter logs by comparing their parsed time, not just the text string
    logs = state.get('allAwardLogs').filter(log => {
        // Exact match (Fastest)
        if (log.date === dateString) return true;
        
        // Parsing match (Handles YYYY-MM-DD, MM/DD/YYYY, etc.)
        if (log.date) {
            const logTime = utils.parseDDMMYYYY(log.date).setHours(0, 0, 0, 0);
            return logTime === targetTime;
        }
        return false;
    });
    }
    
    const reasonColors = { teamwork: 'text-purple-600', creativity: 'text-pink-600', respect: 'text-green-600', focus: 'text-yellow-600', correction: 'text-gray-500', welcome_back: 'text-cyan-600', story_weaver: 'text-cyan-600', scholar_s_bonus: 'text-amber-700' };

    if (logs.length === 0) {
        contentEl.innerHTML = '<p class="text-gray-600 text-center py-8">No stars were awarded in the school on this day.</p>';
    } else {
        const teacherNameMap = state.get('allSchoolClasses').reduce((acc, c) => {
            if (c.createdBy?.uid && c.createdBy?.name) {
                acc[c.createdBy.uid] = c.createdBy.name;
            }
            return acc;
        }, {});
        teacherNameMap[state.get('currentUserId')] = state.get('currentTeacherName');

        const totalStars = logs.reduce((sum, log) => sum + log.stars, 0);
        const reasonCounts = logs.reduce((acc, log) => { if(log.reason) acc[log.reason] = (acc[log.reason] || 0) + log.stars; return acc; }, {});
        const topReason = Object.keys(reasonCounts).length > 0 ? Object.entries(reasonCounts).sort((a,b) => b[1] - a[1])[0][0] : 'N/A';
        const classStarCounts = logs.reduce((acc, log) => { acc[log.classId] = (acc[log.classId] || 0) + log.stars; return acc; }, {});

        const topClassEntry = Object.entries(classStarCounts).sort((a,b) => b[1] - a[1])[0];
        const topClassId = topClassEntry ? topClassEntry[0] : null;
        const topClass = topClassId ? state.get('allSchoolClasses').find(c => c.id === topClassId) : null;
        
        let summaryHtml = `<div class="grid grid-cols-3 gap-4 text-center mb-6 p-4 bg-gray-50 rounded-2xl border">
            <div><div class="text-sm text-gray-500">Total Stars</div><div class="font-title text-3xl text-amber-600 flex items-center justify-center gap-2">${totalStars} <i class="fas fa-star"></i></div></div>
            <div><div class="text-sm text-gray-500">Top Skill</div><div class="font-title text-3xl ${reasonColors[topReason] || 'text-purple-600'} capitalize">${topReason.replace(/_/g, ' ')}</div></div>
            <div><div class="text-sm text-gray-500">Top Class</div><div class="font-title text-xl text-green-600 truncate">${topClass ? `${topClass.logo} ${topClass.name}` : 'N/A'}</div></div>
        </div>`;

        const groupedByClass = logs.reduce((acc, log)=> { (acc[log.classId] = acc[log.classId] || []).push(log); return acc; }, {});
        
        let detailsHtml = '';
        for (const classId in groupedByClass) {
            const classInfo = state.get('allSchoolClasses').find(c => c.id === classId);
            if (!classInfo) continue;
            detailsHtml += `<div class="mb-4 bg-white p-4 rounded-xl shadow-md border"><h3 class="font-title text-xl text-gray-800 border-b pb-2 mb-2 flex justify-between items-center"><span>${classInfo.logo} ${classInfo.name}</span> <span class="text-amber-500 font-sans font-bold text-lg">${classStarCounts[classId]} ⭐</span></h3><div class="space-y-2 mt-2">`;
            
            groupedByClass[classId].sort((a, b) => {
            const nameA = state.get('allStudents').find(s => s.id === a.studentId)?.name || 'Z';
            const nameB = state.get('allStudents').find(s => s.id === b.studentId)?.name || 'Z';
            return nameA.localeCompare(nameB);
        }).forEach(log => {
            const student = state.get('allStudents').find(s => s.id === log.studentId);
            
            // --- ADDED: Check if this student was the Hero of THIS specific day ---
            const dayAdventureLog = state.get('allAdventureLogs').find(l => l.classId === log.classId && l.date === dateString);
            const isDayHero = dayAdventureLog && dayAdventureLog.hero === student?.name;
            // ---------------------------------------------------------------------

            const teacherName = log.createdBy?.name || teacherNameMap[log.teacherId] || 'a teacher';
            const colorClass = reasonColors[log.reason] || 'text-gray-500';
            const noteHtml = log.note ? `<p class="text-xs text-gray-600 italic pl-4 border-l-2 border-gray-300 ml-1 mt-1">"${log.note}"</p>` : '';
            
            detailsHtml += `<div class="bg-gray-50 p-3 rounded-lg min-h-[50px] flex flex-col justify-center" id="log-entry-${log.id}">
                        <div class="flex justify-between items-center">
                            <div class="flex-grow">
                                <!-- UPDATED: Added Crown and Color for historical heroes -->
                                <span class="font-semibold ${isDayHero ? 'text-indigo-700' : ''}">
                                    ${isDayHero ? '<i class="fas fa-crown text-amber-500 mr-1"></i>' : ''}${student?.name || '?'}
                                </span>
                                <span class="text-sm text-gray-500"> - for <b class="${colorClass} capitalize">${(log.reason || '').replace(/_/g, ' ')}</b> from ${teacherName}</span>
                            </div>
                            <div class="flex items-center flex-shrink-0">
                                <span class="font-title text-lg text-amber-600">${log.stars} ⭐</span>
                                ${log.teacherId === state.get('currentUserId') ? `<button class="note-log-btn" data-log-id="${log.id}" title="${log.note ? 'Edit Note' : 'Add Note'}"><i class="fas fa-pencil-alt"></i></button>` : ''}
                                ${log.teacherId === state.get('currentUserId') && log.reason !== 'story_weaver' && log.reason !== 'scholar_s_bonus' ? `<button class="delete-log-btn ml-2" data-log-id="${log.id}" data-student-id="${log.studentId}" data-stars="${log.stars}" title="Delete this log entry">&times;</button>` : ''}
                            </div>
                        </div>
                        ${noteHtml}
                     </div>`;
        });
        }
        contentEl.innerHTML = summaryHtml + detailsHtml;
    }
    
    if (!isOndemand) {
        showAnimatedModal('logbook-modal');
    }
}

export function openHistoryModal(type) {
    const modal = document.getElementById('history-modal');
    modal.dataset.historyType = type;
    
    // Title
    const title = type === 'team' ? 'Team Quest History' : 'Hero\'s Challenge History';
    document.querySelector('#history-modal h2').innerText = title;

    const league = state.get('globalSelectedLeague');

    // Logic: If it's HERO history, we still need a specific context (League or Class).
    // If it's TEAM history, we show ALL leagues, so we don't need a selection.
    
    if (type === 'hero' && !league) {
        // Show League Picker for Hero Mode
        const contentEl = document.getElementById('history-modal-content');
        const selectEl = document.getElementById('history-month-select');
        selectEl.classList.add('hidden');
        
        contentEl.innerHTML = `<h3 class="text-center font-semibold text-gray-700 mb-4">Select a league to view Hero History:</h3>` +
            `<div class="grid grid-cols-2 gap-4">` +
            constants.questLeagues.map(l => `<button class="league-select-btn w-full p-4 font-title text-xl text-amber-800 bg-amber-100 rounded-xl shadow border-2 border-amber-200 transition hover:bg-amber-200 hover:shadow-md bubbly-button" data-league="${l}">${l}</button>`).join('') +
            `</div>`;
        
        contentEl.querySelectorAll('.league-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                playSound('click');
                state.setGlobalSelectedLeague(btn.dataset.league, false);
                selectEl.classList.remove('hidden');
                populateHistoryMonthSelector();
                renderHistoricalLeaderboard("", type);
            });
        });

    } else {
        // Team Mode OR Hero Mode with league selected
        
        // FIX: If it is Hero mode, go straight to the Hero modal logic and SKIP the Team modal
        if (type === 'hero') {
            renderHistoricalLeaderboard("", type);
            return; // STOP here so we don't open the 'history-modal'
        }

        // Team Mode -> Show normal view
        document.getElementById('history-month-select').classList.remove('hidden');
        populateHistoryMonthSelector();
        renderHistoricalLeaderboard("", type);
        showAnimatedModal('history-modal'); // Only show this for Team history
    }
}

function populateHistoryMonthSelector() {
    const select = document.getElementById('history-month-select');
    select.innerHTML = '<option value="">--Choose a month--</option>';

    const now = new Date();
    let loopDate = new Date(constants.competitionStart);

    while (loopDate < now) {
        if (loopDate.getFullYear() < now.getFullYear() || (loopDate.getFullYear() === now.getFullYear() && loopDate.getMonth() < now.getMonth())) {const monthKey = loopDate.toISOString().substring(0, 7);
            const displayString = loopDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
            select.innerHTML += `<option value="${monthKey}">${displayString}</option>`;
        }
        loopDate.setMonth(loopDate.getMonth() + 1);
    }
}

// --- TEAM QUEST & HERO ARCHIVE ---
// ui/modals.js

export async function renderHistoricalLeaderboard(monthKey, type, scope = 'class') {
    // 1. Handle Hero History Redirect
    if (type === 'hero') {
        const modalTitle = document.querySelector('#history-modal h2');
        if(modalTitle) modalTitle.style.display = 'block';
        const outerSelect = document.querySelector('#history-month-select')?.parentElement;
        if(outerSelect) outerSelect.style.display = 'block';
        
        import('./modals.js').then(m => m.openStudentRankingsModal()); 
        return;
    }

    // 2. DOM Manipulation: Hide redundant elements
    const modalTitle = document.querySelector('#history-modal h2');
    if(modalTitle) modalTitle.style.display = 'none'; 
    
    const originalSelect = document.getElementById('history-month-select');
    if (originalSelect && originalSelect.parentElement) {
        originalSelect.parentElement.style.display = 'none';
    }

    const contentEl = document.getElementById('history-modal-content');
    
    // 3. Prepare Dropdown Options
    const options = Array.from(originalSelect.options).map(opt => {
        const isSelected = opt.value === monthKey ? 'selected' : '';
        return `<option value="${opt.value}" ${isSelected} class="text-gray-800 py-1">${opt.text}</option>`;
    }).join('');

    // --- Banner Header ---
    const headerHtml = `
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 p-6 text-white shadow-xl mb-6 border-4 border-orange-400/50">
            <div class="absolute -right-6 -top-6 text-white/10 text-9xl transform rotate-12 pointer-events-none"><i class="fas fa-flag-checkered"></i></div>
            <div class="absolute left-10 bottom-0 text-white/10 text-8xl transform -rotate-12 pointer-events-none"><i class="fas fa-map"></i></div>
            <div class="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <div class="flex items-center gap-3 mb-1">
                        <div class="bg-white/20 p-2 rounded-lg backdrop-blur-sm"><i class="fas fa-flag-checkered text-2xl"></i></div>
                        <h3 class="font-title text-3xl text-shadow-sm tracking-wide">Team Quest Archive</h3>
                    </div>
                    <p class="text-orange-100 font-medium text-sm ml-1 opacity-90">Review past victories and league standings</p>
                </div>
                <div class="w-full md:w-auto">
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-orange-200"><i class="fas fa-calendar-alt"></i></div>
                        <select id="internal-history-select" 
                            class="appearance-none w-full md:w-64 bg-white/20 hover:bg-white/30 text-white font-bold py-3 pl-10 pr-10 rounded-xl backdrop-blur-md border border-white/40 shadow-inner focus:outline-none focus:ring-2 focus:ring-white/50 transition-all cursor-pointer placeholder-white">
                            ${options}
                        </select>
                        <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-orange-200"><i class="fas fa-chevron-down"></i></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 4. Handle Empty State
    if (!monthKey) {
        contentEl.innerHTML = headerHtml + `
            <div class="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-300">
                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4"><i class="fas fa-history text-4xl text-gray-300"></i></div>
                <p class="text-gray-500 font-bold text-lg">Time Machine Ready</p>
                <p class="text-gray-400 text-sm">Select a month above to travel back in time.</p>
            </div>`;
        document.getElementById('internal-history-select').addEventListener('change', (e) => renderHistoricalLeaderboard(e.target.value, 'team'));
        return;
    }

    // 5. Loading State
    contentEl.innerHTML = headerHtml + `
        <div class="flex flex-col items-center justify-center py-20">
            <i class="fas fa-circle-notch fa-spin text-5xl text-amber-500 mb-4"></i>
            <p class="text-gray-600 font-bold animate-pulse text-lg">Retrieving Quest Logs...</p>
        </div>`;
    
    document.getElementById('internal-history-select').addEventListener('change', (e) => renderHistoricalLeaderboard(e.target.value, 'team'));

    // --- MAIN RENDER LOGIC WITH SAFETY ---
    try {
        let monthlyScores = {}; 
        let questHistoryData = []; // NEW: Store the accurate history

        // A. Fetch Data
        try {
            const { fetchLogsForMonth } = await import('../../db/queries.js');
            const { fetchMonthlyHistory } = await import('../../state.js'); 
            const [year, month] = monthKey.split('-').map(Number);
            
            // 1. Fetch Star Logs (The raw numbers)
            const logsPromise = fetchLogsForMonth(year, month);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
            const logs = await Promise.race([logsPromise, timeoutPromise]).catch(e => []);
            
            if (!logs || logs.length === 0) {
                monthlyScores = await fetchMonthlyHistory(monthKey);
            } else {
                logs.forEach(log => {
                    monthlyScores[log.studentId] = (monthlyScores[log.studentId] || 0) + log.stars;
                });
            }

            // 2. NEW: Fetch Quest History (The "Truth" Snapshots)
            // This grabs the official record if a class finished the quest that month
            const historyQ = query(
                collection(db, "artifacts/great-class-quest/public/data/quest_history"),
                where("monthKey", "==", monthKey)
            );
            const historySnap = await getDocs(historyQ);
            questHistoryData = historySnap.docs.map(d => d.data());

        } catch (e) { 
            console.error("Fetch Error:", e); 
        }

        // B. Calculate & Render
        const [hYear, hMonth] = monthKey.split('-').map(Number);
        const daysInMonth = new Date(hYear, hMonth, 0).getDate();
        
        let globalHolidayDays = 0;
        const ranges = state.get('schoolHolidayRanges') || [];
        const monthStart = new Date(hYear, hMonth - 1, 1);
        const monthEnd = new Date(hYear, hMonth, 0);

        ranges.forEach(range => {
            const start = new Date(range.start);
            const end = new Date(range.end);
            const overlapStart = start > monthStart ? start : monthStart;
            const overlapEnd = end < monthEnd ? end : monthEnd;
            if (overlapStart <= overlapEnd) {
                const diffTime = Math.abs(overlapEnd - overlapStart);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                globalHolidayDays += diffDays;
            }
        });

        const overrides = state.get('allScheduleOverrides') || [];
        const allLeagues = (await import('../../constants.js')).questLeagues;
        const allClasses = state.get('allSchoolClasses');
        const myClassIds = state.get('allTeachersClasses').map(c => c.id);
        const BASE_GOAL = 18;
        const SCALING_FACTOR = 1.5;

        let fullHtml = '';

        for (const league of allLeagues) {
            const classesInLeague = allClasses.filter(c => c.questLevel === league);
            if (classesInLeague.length === 0) continue;

            const leagueScores = classesInLeague.map(c => {
                // 1. Check for an Official History Record (The "Truth")
                const historyRecord = questHistoryData.find(h => h.classId === c.id);

                if (historyRecord) {
                    // USE ACCURATE SNAPSHOT
                    return {
                        ...c,
                        totalStars: historyRecord.starsEarned,
                        progress: 100, // They finished it!
                        diamondGoal: historyRecord.goalTarget,
                        daysLost: 0, // Not needed for history records
                        historicalLevel: historyRecord.levelReached - 1, // Display the level they were AT, not what they reached
                        isQuestComplete: true // Flag for UI
                    };
                }

                // 2. Fallback: Calculate from Logs (for classes that didn't finish)
                const rosterStudents = state.get('allStudents').filter(s => s.classId === c.id); 
                const studentIds = new Set(rosterStudents.map(s => s.id));
                const totalStars = Array.from(studentIds).reduce((sum, id) => sum + (monthlyScores[id] || 0), 0);
                
                const classCancellations = overrides.filter(o => {
                    if (o.classId !== c.id || o.type !== 'cancelled') return false;
                    const oDate = utils.parseDDMMYYYY(o.date); 
                    return oDate.getMonth() === (hMonth - 1) && oDate.getFullYear() === hYear;
                }).length;

                const totalDaysLost = globalHolidayDays + classCancellations;
                let monthModifier = (daysInMonth - totalDaysLost) / daysInMonth;
                if (hMonth === 6) monthModifier = 0.5; 
                else monthModifier = Math.max(0.6, Math.min(1.0, monthModifier));

                // Guess difficulty based on current state (fallback)
                let historicalDifficulty = c.difficultyLevel || 0;
                
                // Adjustment attempt for older logs
                if (c.questCompletedAt) {
                    try {
                        const completedDate = c.questCompletedAt.toDate ? c.questCompletedAt.toDate() : new Date(c.questCompletedAt);
                        completedDate.setHours(0,0,0,0);
                        if (completedDate >= monthStart) {
                            historicalDifficulty = Math.max(0, historicalDifficulty - 1);
                        }
                    } catch(err) {}
                }

                const adjustedGoalPerStudent = (BASE_GOAL + (historicalDifficulty * SCALING_FACTOR)) * monthModifier;
                const diamondGoal = Math.round(Math.max(18, rosterStudents.length * adjustedGoalPerStudent));
                const progress = diamondGoal > 0 ? (totalStars / diamondGoal) * 100 : 0;
                
                return { 
                    ...c, 
                    totalStars, 
                    progress, 
                    diamondGoal, 
                    daysLost: totalDaysLost, 
                    historicalLevel: historicalDifficulty,
                    isQuestComplete: false 
                };
            }).sort((a, b) => b.progress - a.progress);
            if (leagueScores.every(c => c.totalStars === 0)) continue; 

            fullHtml += `
                <div class="mb-8 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h4 class="font-title text-xl text-indigo-900 flex items-center gap-2">
                            <span class="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                            ${league} League
                        </h4>
                        <span class="text-xs font-bold text-gray-400 uppercase tracking-widest bg-white px-2 py-1 rounded border border-gray-200">Historical Data</span>
                    </div>
                    <div class="p-4 space-y-3">
            `;

            leagueScores.forEach((c, index) => {
                const rank = index + 1;
                const isMine = myClassIds.includes(c.id);
                
                let rankBadge = `<div class="w-10 h-10 rounded-full bg-gray-100 text-gray-500 font-bold flex items-center justify-center text-lg shadow-inner border border-gray-200">${rank}</div>`;
                let rowBg = "bg-white hover:bg-gray-50";
                let borderClass = "border border-gray-200";
                
                if (rank === 1) { 
                    rankBadge = `<div class="w-12 h-12 text-4xl filter drop-shadow-md transform hover:scale-110 transition-transform">🥇</div>`; 
                    rowBg = "bg-gradient-to-r from-amber-50 to-white";
                    borderClass = "border border-amber-200 shadow-amber-100/50 shadow-md";
                }
                else if (rank === 2) { rankBadge = `<div class="w-10 h-10 text-3xl filter drop-shadow-sm">🥈</div>`; }
                else if (rank === 3) { rankBadge = `<div class="w-10 h-10 text-3xl filter drop-shadow-sm">🥉</div>`; }

                if (isMine) {
                    rowBg += " bg-indigo-50/30";
                    borderClass = "border-2 border-indigo-200 shadow-md ring-2 ring-indigo-50";
                }

                const highlightBadge = isMine ? `<span class="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider border border-indigo-200 ml-2">My Class</span>` : '';
                const lostBadge = c.daysLost > 0 ? `<span class="bg-red-50 text-red-500 text-[10px] px-2 py-0.5 rounded-full border border-red-100 font-bold ml-1" title="${c.daysLost} days lost (Holidays/Cancelled)">-${c.daysLost}d</span>` : '';
                const levelBadge = c.historicalLevel > 0 ? `<span class="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded-full border border-orange-200 font-bold ml-1">Lvl ${c.historicalLevel + 1}</span>` : '';
                const displayProgress = Math.min(100, c.progress);
                const barColor = rank === 1 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : (isMine ? 'bg-indigo-500' : 'bg-gray-400');

                fullHtml += `
                    <div class="relative rounded-2xl p-4 transition-all ${rowBg} ${borderClass} flex items-center gap-4 group">
                        <div class="flex-shrink-0 w-12 text-center">${rankBadge}</div>
                        <div class="flex-grow min-w-0">
                            <div class="flex items-center gap-2 mb-1.5">
                                <span class="text-2xl filter drop-shadow-sm">${c.logo}</span>
                                <h5 class="font-bold text-lg text-gray-800 truncate">${c.name}</h5>
                                ${highlightBadge} ${levelBadge}
                            </div>
                            <div class="w-full bg-gray-200/80 rounded-full h-3 overflow-hidden shadow-inner relative" title="${c.progress.toFixed(1)}%">
                                <div class="${barColor} h-full rounded-full transition-all duration-1000 relative" style="width: ${displayProgress}%">
                                    <div class="absolute inset-0 bg-white/20"></div>
                                </div>
                                <div class="absolute top-0 bottom-0 w-0.5 bg-white z-10 opacity-50" style="left: 100%"></div>
                            </div>
                            <div class="flex items-center gap-2 mt-2">
                                <span class="text-xs text-gray-500 font-medium bg-white px-2 py-0.5 rounded-md border border-gray-200 shadow-sm flex items-center">
                                    <i class="fas fa-bullseye text-gray-400 mr-1"></i> Goal: ${c.diamondGoal}
                                </span>
                                ${lostBadge}
                            </div>
                        </div>
                        <div class="text-right flex-shrink-0 pl-4 border-l border-gray-100/50">
                            <div class="font-title text-2xl text-amber-600 leading-none mb-1">${c.progress.toFixed(0)}%</div>
                            <div class="text-xs font-bold text-gray-400 uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded">${c.totalStars} ⭐</div>
                        </div>
                    </div>`;
            });
            fullHtml += `</div></div>`;
        }

        contentEl.innerHTML = headerHtml + (fullHtml || `<div class="p-8 text-center text-gray-500 bg-gray-50 rounded-2xl">No data available for this month.</div>`);
        
        // Re-bind listener after HTML update
        document.getElementById('internal-history-select').addEventListener('change', (e) => renderHistoricalLeaderboard(e.target.value, 'team'));

    } catch (error) {
        console.error("Render Error:", error);
        contentEl.innerHTML = headerHtml + `
            <div class="flex flex-col items-center justify-center py-16 text-center">
                <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                <p class="text-gray-700 font-bold">The Archives are dusty.</p>
                <p class="text-gray-500 text-sm mt-1">Error: ${error.message}</p>
                <p class="text-gray-400 text-xs mt-4">Try selecting a different month.</p>
            </div>`;
        // Re-bind listener even on error state
        const select = document.getElementById('internal-history-select');
        if(select) select.addEventListener('change', (e) => renderHistoricalLeaderboard(e.target.value, 'team'));
    }
}
