// /ui/modals/log.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import {
    AWARD_LOG_REASON_GRADIENTS,
    AWARD_LOG_REASON_ICONS,
    getAwardLogMonthlyStarCredit,
    getClassQuestBonusStarsFromAwardLog,
    mergeMonthlyStarsFromArchivedHistoryAndAwardLogs,
    PATHFINDER_AWARD_REASON,
    PATHFINDER_CLASS_QUEST_BONUS_STARS,
    sumMonthlyStarCreditsByStudentFromAwardLogs
} from '../../features/awardLogReasonMeta.js';
import { db } from '../../firebase.js';
import { query, collection, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { showAnimatedModal } from './base.js';
import { fetchLogsForDate } from '../../db/queries.js';
import { playSound } from '../../audio.js';

let historyMonthPickerBound = false;

function getQuestBonusFromLog(log) {
    return getClassQuestBonusStarsFromAwardLog(log);
}

function getLogRewardMarkup(log) {
    if (log.reason === PATHFINDER_AWARD_REASON) {
        return `<span class="font-title text-lg text-indigo-600">+${PATHFINDER_CLASS_QUEST_BONUS_STARS} Class Quest</span>`;
    }
    const credit = getAwardLogMonthlyStarCredit(log);
    const rounded = Number.isFinite(credit) ? (Math.round(credit * 4) / 4) : 0;
    const label = rounded === 1 ? '⭐' : `${rounded} ⭐`;
    return `<span class="font-title text-lg text-amber-600">${label}</span>`;
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
    
    const reasonColors = AWARD_LOG_REASON_GRADIENTS;
    const reasonIcons = AWARD_LOG_REASON_ICONS;

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

        const totalStars = logs.reduce((sum, log) => sum + getAwardLogMonthlyStarCredit(log), 0);
        const totalClassQuestBonus = logs.reduce((sum, log) => sum + getQuestBonusFromLog(log), 0);
        const reasonCounts = logs.reduce((acc, log) => {
            if (log.reason) acc[log.reason] = (acc[log.reason] || 0) + getAwardLogMonthlyStarCredit(log);
            return acc;
        }, {});
        const topReason = Object.keys(reasonCounts).length > 0 ? Object.entries(reasonCounts).sort((a,b) => b[1] - a[1])[0][0] : 'N/A';
        const classStarCounts = logs.reduce((acc, log) => {
            acc[log.classId] = (acc[log.classId] || 0) + getAwardLogMonthlyStarCredit(log);
            return acc;
        }, {});
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
        const myClassIdSet = new Set(state.get('allTeachersClasses').map(c => c.id));
        const classIdsOrdered = Object.keys(groupedByClass).filter(id => state.get('allSchoolClasses').some(c => c.id === id));
        classIdsOrdered.sort((a, b) => {
            const aMine = myClassIdSet.has(a);
            const bMine = myClassIdSet.has(b);
            if (aMine !== bMine) return aMine ? -1 : 1;
            const nameA = state.get('allSchoolClasses').find(c => c.id === a)?.name || '';
            const nameB = state.get('allSchoolClasses').find(c => c.id === b)?.name || '';
            return nameA.localeCompare(nameB);
        });

        let detailsHtml = '<div class="space-y-6">';
        for (const classId of classIdsOrdered) {
            const classInfo = state.get('allSchoolClasses').find(c => c.id === classId);
            if (!classInfo) continue;
            const classQuestBonus = classQuestBonusCounts[classId] || 0;
            const isMyClass = myClassIdSet.has(classId);
            const sectionOpenAttr = isMyClass ? 'open' : '';
            const mineRing = isMyClass ? 'ring-2 ring-teal-400/25' : '';
            const palette = (classInfo.color && classInfo.color.bg)
                ? classInfo.color
                : constants.classColorPalettes[utils.simpleHashCode(classId) % constants.classColorPalettes.length];
            const yourClassBadge = isMyClass
                ? '<span class="shrink-0 rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200/90">Your class</span>'
                : '';

            detailsHtml += `
                <details class="log-class-section ${mineRing} group bg-white/55 backdrop-blur-md rounded-[2rem] border-2 ${palette.border} shadow-md overflow-hidden transition-shadow hover:shadow-lg" ${sectionOpenAttr}>
                    <summary class="log-class-section__summary flex flex-wrap cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 ${palette.bg} ${palette.text} border-b-2 ${palette.border}">
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                            <span class="log-class-section__chevron flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/75 border ${palette.border} shadow-sm">
                                <i class="fas fa-chevron-right text-xs opacity-80"></i>
                            </span>
                            <span class="shrink-0 rounded-lg bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border ${palette.border} shadow-sm">Class</span>
                            <span class="w-10 h-10 shrink-0 rounded-xl bg-white flex items-center justify-center text-2xl shadow-sm border ${palette.border}">${classInfo.logo}</span>
                            <h3 class="font-title text-xl sm:text-2xl font-bold tracking-tight truncate">${classInfo.name}</h3>
                            ${yourClassBadge}
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <span class="bg-white/90 text-gray-800 px-3 py-1 rounded-full font-bold text-sm shadow-sm border ${palette.border}">${classStarCounts[classId]} ⭐</span>
                            ${classQuestBonus > 0 ? `<span class="bg-white/90 text-gray-800 px-3 py-1 rounded-full font-semibold text-xs shadow-sm border ${palette.border}">+${classQuestBonus} Quest</span>` : ''}
                        </div>
                    </summary>
                    <div class="log-class-section__body p-4 space-y-3 bg-slate-50/40 border-t border-white/60">`;
            
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
            detailsHtml += `</div></details>`;
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
    const titleEl = document.getElementById('history-modal-title');
    if (titleEl) titleEl.innerText = title;

    const league = options.league || state.get('globalSelectedLeague');

    // Logic: If it's HERO history, we still need a specific context (League or Class).
    // If it's TEAM history, we show ALL leagues, so we don't need a selection.
    
    if (type === 'hero' && !league) {
        // Show League Picker for Hero Mode
        const contentEl = document.getElementById('history-modal-content');
        const selectWrapper = document.getElementById('history-month-select-wrapper');
        if (selectWrapper) selectWrapper.classList.add('hidden');
        
        const subtitleEl = document.getElementById('history-modal-subtitle');
        if (subtitleEl) subtitleEl.innerText = 'Choose a league to view hero archives';

        contentEl.innerHTML = `
            <div class="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
                <div class="flex items-center gap-3 mb-5">
                    <div class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200 shadow-sm">
                        <i class="fas fa-layer-group"></i>
                    </div>
                    <div>
                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Hero Logs</div>
                        <div class="font-title text-2xl text-slate-800">Select a League</div>
                    </div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                    ${constants.questLeagues.map(l => `
                        <button class="league-select-btn w-full p-4 font-title text-xl text-amber-800 bg-gradient-to-br from-amber-50 to-white rounded-2xl shadow-sm border-2 border-amber-200/70 transition hover:bg-amber-100 hover:shadow-md bubbly-button" data-league="${l}">
                            <span class="block">${l}</span>
                            <span class="block text-[10px] font-black uppercase tracking-widest text-amber-500/80 mt-1">League</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        
        contentEl.querySelectorAll('.league-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                playSound('click');
                state.setGlobalSelectedLeague(btn.dataset.league, false);
                modal.dataset.historyLeague = btn.dataset.league;
                if (selectWrapper) selectWrapper.classList.remove('hidden');
                populateHistoryMonthSelector();
                renderHistoricalLeaderboard("", type, btn.dataset.league);
            });
        });

        showAnimatedModal('history-modal');
    } else {
        // Team Mode OR Hero Mode with league selected
        
        // FIX: If it is Hero mode, go straight to the Hero modal logic and SKIP the Team modal
        if (type === 'hero') {
            renderHistoricalLeaderboard("", type, league || null);
            return; // STOP here so we don't open the 'history-modal'
        }

        // Team Mode -> Show normal view
        const selectWrapper = document.getElementById('history-month-select-wrapper');
        if (selectWrapper) selectWrapper.classList.remove('hidden');
        populateHistoryMonthSelector();
        renderHistoricalLeaderboard("", type, league || null);
        showAnimatedModal('history-modal'); // Only show this for Team history
    }
}

function populateHistoryMonthSelector() {
    const select = document.getElementById('history-month-select');
    select.innerHTML = '<option value="">--Choose a month--</option>';

    const endMonthStart = utils.getLatestCompletedMonthStart(new Date());
    let loopDate = new Date(constants.competitionStart.getFullYear(), constants.competitionStart.getMonth(), 1);

    while (loopDate <= endMonthStart) {
        const monthKey = utils.getMonthKey(loopDate);
        const displayString = loopDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
        select.innerHTML += `<option value="${monthKey}">${displayString}</option>`;
        loopDate.setMonth(loopDate.getMonth() + 1);
    }
}

function syncHistoryMonthPicker(monthKey, leagueFilter) {
    const wrapper = document.getElementById('history-month-select-wrapper');
    const selectEl = document.getElementById('history-month-select');
    const btn = document.getElementById('history-month-picker-btn');
    const label = document.getElementById('history-month-picker-label');
    const menu = document.getElementById('history-month-picker-menu');
    const optionsEl = document.getElementById('history-month-picker-options');

    if (!wrapper || !selectEl || !btn || !label || !menu || !optionsEl) return;

    const selectedOption = Array.from(selectEl.options).find(o => o.value === (monthKey || ''));
    label.innerText = selectedOption?.value ? selectedOption.text : 'Choose a month...';

    optionsEl.innerHTML = Array.from(selectEl.options)
        .filter(o => Boolean(o.value))
        .map(o => `
            <button type="button" class="history-month-option w-full text-left px-4 py-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 flex items-center justify-between gap-3" data-value="${o.value}">
                <span class="font-bold text-slate-800">${o.text}</span>
                <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">${o.value}</span>
            </button>
        `).join('');

    optionsEl.querySelectorAll('.history-month-option').forEach((item) => {
        item.onclick = () => {
            const value = item.dataset.value || '';
            selectEl.value = value;
            menu.classList.add('hidden');
            renderHistoricalLeaderboard(value, 'team', leagueFilter);
        };
    });

    if (!historyMonthPickerBound) {
        btn.onclick = () => {
            menu.classList.toggle('hidden');
        };

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });

        historyMonthPickerBound = true;
    }
}

// --- TEAM QUEST & HERO ARCHIVE ---
// ui/modals.js

export async function renderHistoricalLeaderboard(monthKey, type, leagueFilter = null) {
    // 1. Handle Hero History Redirect
    if (type === 'hero') {
        import('./modals.js').then(m => m.openStudentRankingsModal()); 
        return;
    }

    const contentEl = document.getElementById('history-modal-content');
    const headerTitleEl = document.getElementById('history-modal-title');
    const headerSubtitleEl = document.getElementById('history-modal-subtitle');
    const archiveTitle = leagueFilter ? `${leagueFilter} League Archive` : 'Team Quest Archive';
    const archiveSubtitle = leagueFilter
        ? `Historical standings for the active ${leagueFilter} tier`
        : 'Review past victories and league standings';

    if (headerTitleEl) headerTitleEl.innerText = archiveTitle;
    if (headerSubtitleEl) headerSubtitleEl.innerText = archiveSubtitle;

    const selectEl = document.getElementById('history-month-select');
    if (selectEl) {
        if (selectEl.value !== monthKey) selectEl.value = monthKey || '';
        selectEl.onchange = (e) => renderHistoricalLeaderboard(e.target.value, 'team', leagueFilter);
    }
    syncHistoryMonthPicker(monthKey, leagueFilter);

    // 4. Handle Empty State
    if (!monthKey) {
        contentEl.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 shadow-sm">
                <div class="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-200 shadow-inner">
                    <i class="fas fa-history text-4xl text-slate-300"></i>
                </div>
                <p class="text-slate-700 font-title text-3xl">Time Machine Ready</p>
                <p class="text-slate-500 text-sm mt-2">Pick a month in the header to travel back in time.</p>
            </div>
        `;
        return;
    }

    // 5. Loading State
    contentEl.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20">
            <i class="fas fa-circle-notch fa-spin text-5xl text-amber-500 mb-4"></i>
            <p class="text-slate-600 font-bold animate-pulse text-lg">Retrieving Quest Logs...</p>
        </div>
    `;

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
            const archivedPromise = fetchMonthlyHistory(monthKey);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
            const logs = await Promise.race([logsPromise, timeoutPromise]).catch(() => []);
            const archivedRows = await archivedPromise.catch(() => ({}));
            const fromLogs = sumMonthlyStarCreditsByStudentFromAwardLogs(logs || []);
            monthlyScores = mergeMonthlyStarsFromArchivedHistoryAndAwardLogs(fromLogs, archivedRows || {});

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

        contentEl.innerHTML = fullHtml || `<div class="p-8 text-center text-gray-500 bg-white rounded-[2rem] border border-slate-200 shadow-sm">No data available for this month.</div>`;

    } catch (error) {
        console.error("Render Error:", error);
        contentEl.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-center bg-white rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div class="w-20 h-20 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mb-5">
                    <i class="fas fa-exclamation-triangle text-3xl text-rose-400"></i>
                </div>
                <p class="text-slate-800 font-title text-3xl">The Archives are dusty.</p>
                <p class="text-slate-500 text-sm mt-2">Error: ${error.message}</p>
                <p class="text-slate-400 text-xs mt-4">Try selecting a different month.</p>
            </div>
        `;
    }
}
