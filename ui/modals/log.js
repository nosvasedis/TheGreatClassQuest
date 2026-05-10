// /ui/modals/log.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import { db } from '../../firebase.js';
import { query, collection, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { showAnimatedModal } from './base.js';
import { fetchLogsForDate } from '../../db/queries.js';
import { playSound } from '../../audio.js';

function getQuestBonusFromLog(log) {
    return log.reason === 'pathfinder_map' ? 10 : 0;
}

function getLogRewardMarkup(log) {
    if (log.reason === 'pathfinder_map') {
        return '<span class="font-title text-lg text-indigo-600">+10 Class Quest</span>';
    }
    return `<span class="font-title text-lg text-amber-600">${log.stars} ⭐</span>`;
}

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
        contentEl.innerHTML = '<div class="flex flex-col items-center justify-center py-12"><i class="fas fa-circle-notch fa-spin text-4xl text-amber-500 mb-4"></i><p class="text-gray-500 font-bold animate-pulse">Summoning historical logs...</p></div>';
        showAnimatedModal('logbook-modal'); 
        logs = await fetchLogsForDate(dateString);
    } else {
        logs = state.get('allAwardLogs').filter(log => log.date && utils.datesMatch(log.date, dateString));
    }
    
    const reasonColors = { 
        teamwork: 'from-purple-500 to-indigo-600', 
        creativity: 'from-pink-500 to-rose-600', 
        respect: 'from-emerald-500 to-teal-600', 
        focus: 'from-amber-400 to-orange-500', 
        correction: 'from-slate-400 to-slate-600', 
        welcome_back: 'from-cyan-400 to-blue-600', 
        story_weaver: 'from-violet-400 to-purple-600', 
        scholar_s_bonus: 'from-amber-600 to-orange-700', 
        teacher_boon: 'from-fuchsia-500 to-pink-600', 
        pathfinder_map: 'from-indigo-500 to-blue-700' 
    };

    const reasonIcons = {
        teamwork: 'fa-users',
        creativity: 'fa-lightbulb',
        respect: 'fa-handshake',
        focus: 'fa-bullseye',
        correction: 'fa-wrench',
        welcome_back: 'fa-door-open',
        story_weaver: 'fa-book-open',
        scholar_s_bonus: 'fa-graduation-cap',
        teacher_boon: 'fa-gift',
        pathfinder_map: 'fa-map-marked-alt'
    };

    if (logs.length === 0) {
        contentEl.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 opacity-50">
                    <i class="fas fa-moon text-4xl text-gray-400"></i>
                </div>
                <h3 class="text-xl font-title text-gray-700">A Quiet Day</h3>
                <p class="text-gray-500 mt-2">No stars were awarded in the school on this day.</p>
            </div>`;
    } else {
        const teacherNameMap = state.get('allSchoolClasses').reduce((acc, c) => {
            if (c.createdBy?.uid && c.createdBy?.name) {
                acc[c.createdBy.uid] = c.createdBy.name;
            }
            return acc;
        }, {});
        teacherNameMap[state.get('currentUserId')] = state.get('currentTeacherName');

        const totalStars = logs.reduce((sum, log) => sum + log.stars, 0);
        const totalClassQuestBonus = logs.reduce((sum, log) => sum + getQuestBonusFromLog(log), 0);
        const reasonCounts = logs.reduce((acc, log) => { if(log.reason) acc[log.reason] = (acc[log.reason] || 0) + log.stars; return acc; }, {});
        const topReason = Object.keys(reasonCounts).length > 0 ? Object.entries(reasonCounts).sort((a,b) => b[1] - a[1])[0][0] : 'N/A';
        const classStarCounts = logs.reduce((acc, log) => { acc[log.classId] = (acc[log.classId] || 0) + log.stars; return acc; }, {});
        const classQuestBonusCounts = logs.reduce((acc, log) => {
            acc[log.classId] = (acc[log.classId] || 0) + getQuestBonusFromLog(log);
            return acc;
        }, {});

        const topClassEntry = Object.entries(classStarCounts).sort((a,b) => b[1] - a[1])[0];
        const topClassId = topClassEntry ? topClassEntry[0] : null;
        const topClass = topClassId ? state.get('allSchoolClasses').find(c => c.id === topClassId) : null;
        
        let summaryHtml = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-[1.5rem] border border-amber-100 shadow-sm flex flex-col items-center justify-center text-center group hover:scale-105 transition-transform duration-300">
                <div class="w-10 h-10 bg-amber-400/20 rounded-full flex items-center justify-center mb-2 text-amber-600">
                    <i class="fas fa-star text-lg"></i>
                </div>
                <div class="text-[10px] font-black text-amber-700/60 uppercase tracking-widest mb-1">Total Stars</div>
                <div class="font-title text-3xl text-amber-600">${totalStars}</div>
            </div>
            <div class="bg-gradient-to-br from-purple-50 to-indigo-50 p-4 rounded-[1.5rem] border border-purple-100 shadow-sm flex flex-col items-center justify-center text-center group hover:scale-105 transition-transform duration-300">
                <div class="w-10 h-10 bg-purple-400/20 rounded-full flex items-center justify-center mb-2 text-purple-600">
                    <i class="fas ${reasonIcons[topReason] || 'fa-trophy'} text-lg"></i>
                </div>
                <div class="text-[10px] font-black text-purple-700/60 uppercase tracking-widest mb-1">Top Skill</div>
                <div class="font-title text-xl text-purple-600 capitalize truncate w-full">${topReason.replace(/_/g, ' ')}</div>
            </div>
            <div class="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-[1.5rem] border border-emerald-100 shadow-sm flex flex-col items-center justify-center text-center group hover:scale-105 transition-transform duration-300">
                <div class="w-10 h-10 bg-emerald-400/20 rounded-full flex items-center justify-center mb-2 text-emerald-600">
                    <i class="fas fa-users text-lg"></i>
                </div>
                <div class="text-[10px] font-black text-emerald-700/60 uppercase tracking-widest mb-1">Top Class</div>
                <div class="font-title text-xl text-emerald-600 truncate w-full px-2">${topClass ? `${topClass.logo} ${topClass.name}` : 'N/A'}</div>
            </div>
            <div class="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-[1.5rem] border border-blue-100 shadow-sm flex flex-col items-center justify-center text-center group hover:scale-105 transition-transform duration-300 ${totalClassQuestBonus > 0 ? '' : 'hidden md:flex opacity-50'}">
                <div class="w-10 h-10 bg-blue-400/20 rounded-full flex items-center justify-center mb-2 text-blue-600">
                    <i class="fas fa-route text-lg"></i>
                </div>
                <div class="text-[10px] font-black text-blue-700/60 uppercase tracking-widest mb-1">Quest Bonus</div>
                <div class="font-title text-3xl text-indigo-600">${totalClassQuestBonus}</div>
            </div>
        </div>`;

        const groupedByClass = logs.reduce((acc, log)=> { (acc[log.classId] = acc[log.classId] || []).push(log); return acc; }, {});
        
        let detailsHtml = '<div class="space-y-6">';
        for (const classId in groupedByClass) {
            const classInfo = state.get('allSchoolClasses').find(c => c.id === classId);
            if (!classInfo) continue;
            const classQuestBonus = classQuestBonusCounts[classId] || 0;
            
            detailsHtml += `
                <div class="log-class-section bg-white/40 backdrop-blur-md rounded-[2rem] border border-white/60 shadow-lg overflow-hidden transition-all hover:shadow-xl">
                    <div class="bg-gradient-to-r from-gray-50/80 to-white/80 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                        <h3 class="font-title text-2xl text-gray-800 flex items-center gap-3">
                            <span class="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-2xl">${classInfo.logo}</span>
                            <span>${classInfo.name}</span>
                        </h3>
                        <div class="flex items-center gap-3">
                            <span class="bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold text-sm shadow-sm border border-amber-200/50">${classStarCounts[classId]} ⭐</span>
                            ${classQuestBonus > 0 ? `<span class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold text-xs shadow-sm border border-indigo-200/50">+${classQuestBonus} Quest</span>` : ''}
                        </div>
                    </div>
                    <div class="p-4 space-y-3">`;
            
            groupedByClass[classId].sort((a, b) => {
                const nameA = state.get('allStudents').find(s => s.id === a.studentId)?.name || 'Z';
                const nameB = state.get('allStudents').find(s => s.id === b.studentId)?.name || 'Z';
                return nameA.localeCompare(nameB);
            }).forEach((log, idx) => {
                const student = state.get('allStudents').find(s => s.id === log.studentId);
                const dayAdventureLog = state.get('allAdventureLogs').find(l => l.classId === log.classId && utils.datesMatch(l.date, dateString));
                const isDayHero = dayAdventureLog && dayAdventureLog.hero === student?.name;

                const teacherName = log.createdBy?.name || teacherNameMap[log.teacherId] || 'a teacher';
                const gradientClass = reasonColors[log.reason] || 'from-gray-400 to-gray-600';
                const reasonIcon = reasonIcons[log.reason] || 'fa-star';
                const noteHtml = log.note ? `
                    <div class="mt-2 pl-4 py-2 border-l-4 border-blue-200 bg-blue-50/50 rounded-r-xl">
                        <p class="text-xs text-blue-800 italic leading-relaxed">"${log.note}"</p>
                    </div>` : '';
                
                detailsHtml += `
                    <div class="log-entry relative bg-gray-50/50 hover:bg-white p-4 rounded-[1.5rem] border border-gray-100/50 transition-all hover:shadow-md group" id="log-entry-${log.id}" style="animation: fade-in-up 0.4s ease-out forwards ${idx * 0.05}s; opacity: 0;">
                        <div class="flex justify-between items-center gap-4">
                            <div class="flex items-center gap-4 flex-grow min-w-0">
                                <div class="w-10 h-10 rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white shadow-md flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <i class="fas ${reasonIcon}"></i>
                                </div>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="font-bold text-gray-800 ${isDayHero ? 'text-indigo-700' : ''}">
                                            ${isDayHero ? '<i class="fas fa-crown text-amber-500 mr-1 filter drop-shadow-sm"></i>' : ''}${student?.name || '?'}
                                        </span>
                                        <span class="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-white border border-gray-200 text-gray-400 group-hover:text-gray-600 transition-colors">${(log.reason || '').replace(/_/g, ' ')}</span>
                                    </div>
                                    <p class="text-[11px] text-gray-500 mt-0.5">Awarded by <span class="font-semibold text-gray-600">${teacherName}</span></p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2 flex-shrink-0">
                                <div class="flex flex-col items-end">
                                    ${getLogRewardMarkup(log)}
                                </div>
                                <div class="flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    ${log.teacherId === state.get('currentUserId') ? `
                                        <button class="note-log-btn w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors shadow-sm" data-log-id="${log.id}" title="${log.note ? 'Edit Note' : 'Add Note'}">
                                            <i class="fas fa-sticky-note text-xs"></i>
                                        </button>` : ''}
                                    ${log.teacherId === state.get('currentUserId') && log.reason !== 'story_weaver' && log.reason !== 'scholar_s_bonus' ? `
                                        <button class="delete-log-btn ml-1.5 w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center hover:bg-rose-200 transition-colors shadow-sm" data-log-id="${log.id}" data-student-id="${log.studentId}" data-stars="${log.stars}" title="Delete entry">
                                            <i class="fas fa-trash-alt text-xs"></i>
                                        </button>` : ''}
                                </div>
                            </div>
                        </div>
                        ${noteHtml}
                    </div>`;
            });
            detailsHtml += `</div></div>`;
        }
        detailsHtml += '</div>';
        contentEl.innerHTML = summaryHtml + detailsHtml;
    }
    
    if (!isOndemand) {
        showAnimatedModal('logbook-modal');
    }
}

export function openHistoryModal(type, options = {}) {
    const modal = document.getElementById('history-modal');
    modal.dataset.historyType = type;
    modal.dataset.historyLeague = options.league || '';
    
    // Title
    const title = type === 'team' ? 'Team Quest History' : 'Hero\'s Challenge History';
    document.querySelector('#history-modal h2').innerText = title;

    const league = options.league || state.get('globalSelectedLeague');

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
                modal.dataset.historyLeague = btn.dataset.league;
                selectEl.classList.remove('hidden');
                populateHistoryMonthSelector();
                renderHistoricalLeaderboard("", type, btn.dataset.league);
            });
        });

    } else {
        // Team Mode OR Hero Mode with league selected
        
        // FIX: If it is Hero mode, go straight to the Hero modal logic and SKIP the Team modal
        if (type === 'hero') {
            renderHistoricalLeaderboard("", type, league || null);
            return; // STOP here so we don't open the 'history-modal'
        }

        // Team Mode -> Show normal view
        document.getElementById('history-month-select').classList.remove('hidden');
        populateHistoryMonthSelector();
        renderHistoricalLeaderboard("", type, league || null);
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

export async function renderHistoricalLeaderboard(monthKey, type, leagueFilter = null) {
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
    const archiveTitle = leagueFilter ? `${leagueFilter} League Archive` : 'Team Quest Archive';
    const archiveSubtitle = leagueFilter
        ? `Historical standings for the active ${leagueFilter} tier`
        : 'Review past victories and league standings';

    const headerHtml = `
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 p-6 text-white shadow-xl mb-6 border-4 border-orange-400/50">
            <div class="absolute -right-6 -top-6 text-white/10 text-9xl transform rotate-12 pointer-events-none"><i class="fas fa-flag-checkered"></i></div>
            <div class="absolute left-10 bottom-0 text-white/10 text-8xl transform -rotate-12 pointer-events-none"><i class="fas fa-map"></i></div>
            <div class="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <div class="flex items-center gap-3 mb-1">
                        <div class="bg-white/20 p-2 rounded-lg backdrop-blur-sm"><i class="fas fa-flag-checkered text-2xl"></i></div>
                        <h3 class="font-title text-3xl text-shadow-sm tracking-wide">${archiveTitle}</h3>
                    </div>
                    <p class="text-orange-100 font-medium text-sm ml-1 opacity-90">${archiveSubtitle}</p>
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
        document.getElementById('internal-history-select').addEventListener('change', (e) => renderHistoricalLeaderboard(e.target.value, 'team', leagueFilter));
        return;
    }

    // 5. Loading State
    contentEl.innerHTML = headerHtml + `
        <div class="flex flex-col items-center justify-center py-20">
            <i class="fas fa-circle-notch fa-spin text-5xl text-amber-500 mb-4"></i>
            <p class="text-gray-600 font-bold animate-pulse text-lg">Retrieving Quest Logs...</p>
        </div>`;
    
    document.getElementById('internal-history-select').addEventListener('change', (e) => renderHistoricalLeaderboard(e.target.value, 'team', leagueFilter));

    // --- MAIN RENDER LOGIC WITH SAFETY ---
    try {
        let monthlyScores = {}; 
        let questHistoryData = []; // Store quest history across all months for accurate difficulty reconstruction

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

            const historySnap = await getDocs(collection(db, 'artifacts/great-class-quest/public/data/quest_history'));
            questHistoryData = historySnap.docs.map(d => d.data());

        } catch (e) { 
            console.error("Fetch Error:", e); 
        }

        // B. Calculate & Render
        const ranges = state.get('schoolHolidayRanges') || [];
        const monthStart = new Date(`${monthKey}-01T00:00:00`);
        const overrides = state.get('allScheduleOverrides') || [];
        const allLeagues = (await import('../../constants.js')).questLeagues;
        const allClasses = state.get('allSchoolClasses');
        const myClassIds = state.get('allTeachersClasses').map(c => c.id);

        let fullHtml = '';

        const leaguesToRender = leagueFilter ? allLeagues.filter(league => league === leagueFilter) : allLeagues;

        for (const league of leaguesToRender) {
            const classesInLeague = allClasses.filter(c => c.questLevel === league);
            if (classesInLeague.length === 0) continue;

            const leagueScores = classesInLeague.map(c => {
                // 1. Check for an Official History Record (The "Truth")
                const historyRecord = questHistoryData.find(h => h.classId === c.id && h.monthKey === monthKey);
                const daysLost = utils.calculateMonthlyDaysLostForDate(c, ranges, overrides, monthStart);

                if (historyRecord) {
                    // USE ACCURATE SNAPSHOT
                    return {
                        ...c,
                        totalStars: historyRecord.starsEarned,
                        progress: 100, // They finished it!
                        diamondGoal: historyRecord.goalTarget,
                        daysLost,
                        historicalLevel: historyRecord.levelReached - 1, // Display the level they were AT, not what they reached
                        isQuestComplete: true // Flag for UI
                    };
                }

                // 2. Fallback: Calculate from Logs (for classes that didn't finish)
                const rosterStudents = state.get('allStudents').filter(s => s.classId === c.id); 
                const studentIds = new Set(rosterStudents.map(s => s.id));
                const classQuestBonus = Number(c.teamQuestBonuses?.[monthKey]) || 0;
                const totalStars = Array.from(studentIds).reduce((sum, id) => sum + (monthlyScores[id] || 0), 0) + classQuestBonus;
                const historicalDifficulty = utils.getHistoricalDifficultyForMonth(c, monthStart, questHistoryData);
                const diamondGoal = utils.calculateMonthlyClassGoalForDate(
                    c,
                    rosterStudents.length,
                    ranges,
                    overrides,
                    monthStart,
                    questHistoryData
                );
                const progress = diamondGoal > 0 ? (totalStars / diamondGoal) * 100 : 0;
                
                return { 
                    ...c, 
                    totalStars, 
                    progress, 
                    diamondGoal, 
                    daysLost, 
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
        document.getElementById('internal-history-select').addEventListener('change', (e) => renderHistoricalLeaderboard(e.target.value, 'team', leagueFilter));

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
        if(select) select.addEventListener('change', (e) => renderHistoricalLeaderboard(e.target.value, 'team', leagueFilter));
    }
}

