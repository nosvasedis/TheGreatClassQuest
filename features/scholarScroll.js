// /features/scholarScroll.js
let loadedHistoricalScores = [];

// --- IMPORTS ---
import { fetchTrialsForMonth, fetchAllTrialMonthsForClass } from '../db/queries.js';
import { db } from '../firebase.js';
import { doc, addDoc, updateDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { writeBatch, runTransaction } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

import * as state from '../state.js';
import * as utils from '../utils.js';
import { showToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import * as modals from '../ui/modals.js';
import { wrapAvatarWithLevelUpIndicator } from '../ui/core/avatar.js';
import { HERO_CLASSES } from '../features/heroClasses.js';
import {
    getAssessmentAverage,
    getAssessmentSchemeForClass,
    getAssessmentValueLabel,
    getNearestQualitativeLabel,
    getNormalizedPercentForScore,
    getUpcomingScheduledAssessment,
    getWeightedAcademicAverage
} from './assessmentConfig.js';


// --- TAB RENDERING ---

export function renderScholarsScrollTab(selectedClassId = null) {
    const classSelect = document.getElementById('scroll-class-select');
    if (!classSelect) return;
    const logTrialFab = document.getElementById('log-trial-fab');
    const viewHistoryFab = document.getElementById('view-trial-history-fab');

    const currentVal = selectedClassId || state.get('globalSelectedClassId');
    const optionsHtml = state.get('allTeachersClasses').sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${c.logo} ${c.name}</option>`).join('');

    classSelect.innerHTML = '<option value="">Select a class to view their scroll...</option>' + optionsHtml;

    // FIX 1: Restore the selected value so the dropdown doesn't reset visualy on refresh
    if (currentVal) {
        classSelect.value = currentVal;
    }

    // Remove old listeners to prevent duplicates (simple cloning trick)
    const logBtn = document.getElementById('log-trial-btn');
    const newLogBtn = logBtn.cloneNode(true);
    logBtn.parentNode.replaceChild(newLogBtn, logBtn);

    newLogBtn.addEventListener('click', () => openTrialTypeModal(classSelect.value));

    if (currentVal) {
        // Enable buttons
        document.getElementById('log-trial-btn').disabled = false;
        document.getElementById('view-trial-history-btn').disabled = false;
        if (logTrialFab) logTrialFab.disabled = false;
        if (viewHistoryFab) viewHistoryFab.disabled = false;

        // Render Content
        renderScrollDashboard(currentVal);
        document.getElementById('scroll-dashboard-content').classList.remove('hidden');
        document.getElementById('scroll-placeholder').classList.add('hidden');

        // Render Missing Work
        renderMissingWorkDashboard(currentVal);
    } else {
        // Disable buttons
        document.getElementById('log-trial-btn').disabled = true;
        document.getElementById('view-trial-history-btn').disabled = true;
        if (logTrialFab) logTrialFab.disabled = true;
        if (viewHistoryFab) viewHistoryFab.disabled = true;

        document.getElementById('scroll-dashboard-content').classList.add('hidden');
        document.getElementById('scroll-placeholder').classList.remove('hidden');
    }
}

function renderScrollDashboard(classId) {
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    threeMonthsAgo.setDate(1); // Start from the beginning of that month

    const scoresForClass = state.get('allWrittenScores').filter(s => {
        if (s.classId !== classId || !s.date) return false;
        const scoreDate = utils.parseFlexibleDate(s.date);
        return scoreDate >= threeMonthsAgo;
    });
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const testScheme = getAssessmentSchemeForClass(classData, 'test');
    const dictationScheme = getAssessmentSchemeForClass(classData, 'dictation');

    const statsContainer = document.getElementById('scroll-stats-cards');
    // --- NEW: Upcoming Test Indicator ---
    const dashboard = document.getElementById('scroll-dashboard-content');
    let testAlert = document.getElementById('scroll-test-alert');
    if (testAlert) testAlert.remove(); // Clear previous to prevent duplicates

    const upcomingTest = getUpcomingScheduledAssessment(classId);

    if (upcomingTest) {
        const toneClasses = {
            red: { bg: 'from-red-50 to-white', border: 'border-red-500', heading: 'text-red-800', body: 'text-red-600', icon: 'text-red-200' },
            rose: { bg: 'from-rose-50 to-white', border: 'border-rose-500', heading: 'text-rose-800', body: 'text-rose-600', icon: 'text-rose-200' },
            orange: { bg: 'from-amber-50 to-white', border: 'border-amber-500', heading: 'text-amber-800', body: 'text-amber-700', icon: 'text-amber-200' },
            emerald: { bg: 'from-emerald-50 to-white', border: 'border-emerald-500', heading: 'text-emerald-800', body: 'text-emerald-700', icon: 'text-emerald-200' },
            slate: { bg: 'from-slate-50 to-white', border: 'border-slate-400', heading: 'text-slate-800', body: 'text-slate-600', icon: 'text-slate-200' },
            amber: { bg: 'from-amber-50 to-white', border: 'border-amber-500', heading: 'text-amber-800', body: 'text-amber-700', icon: 'text-amber-200' }
        };
        const palette = toneClasses[upcomingTest.tone] || toneClasses.amber;
        testAlert = document.createElement('div');
        testAlert.id = 'scroll-test-alert';
        testAlert.className = `mb-4 bg-gradient-to-r ${palette.bg} ${palette.border} border-l-4 p-4 rounded-r-2xl shadow-sm flex items-center justify-between gap-4`;
        testAlert.innerHTML = `
            <div>
                <div class="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${palette.body}">
                    <i class="fas fa-${upcomingTest.icon}"></i>
                    <span>${upcomingTest.statusLabel}</span>
                </div>
                <h4 class="font-bold ${palette.heading} text-lg flex items-center gap-2 mt-3">
                    <i class="fas fa-file-alt"></i> ${upcomingTest.testData.title}
                </h4>
                <p class="text-sm ${palette.body} ml-6">
                    <span class="font-semibold">${upcomingTest.detailLabel}</span>
                    <span class="ml-1">• ${upcomingTest.chipLabel}</span>
                    ${upcomingTest.testData.curriculum ? `<br><span class="text-gray-500 text-xs mt-1 block">Topics: ${upcomingTest.testData.curriculum}</span>` : ''}
                </p>
            </div>
            <div class="text-3xl ${palette.icon}"><i class="fas fa-${upcomingTest.icon}"></i></div>
        `;
        // Insert it at the very top of the dashboard content
        dashboard.prepend(testAlert);
    }
    const chartContainer = document.getElementById('scroll-performance-chart');

    const testScores = scoresForClass.filter(s => s.type === 'test');
    const dictationScores = scoresForClass.filter(s => s.type === 'dictation');

    const testsByStudentId = new Map();
    const dictationsByStudentId = new Map();
    for (const s of scoresForClass) {
        if (s.type === 'test') {
            if (!testsByStudentId.has(s.studentId)) testsByStudentId.set(s.studentId, []);
            testsByStudentId.get(s.studentId).push(s);
        } else if (s.type === 'dictation') {
            if (!dictationsByStudentId.has(s.studentId)) dictationsByStudentId.set(s.studentId, []);
            dictationsByStudentId.get(s.studentId).push(s);
        }
    }
    const scoreMetaByStudentId = new Map(
        (state.get('allStudentScores') || []).map(sc => [sc.id, sc])
    );

    // --- Calculate Averages ---
    const testAvg = getAssessmentAverage(testScores, classData);
    const dictationAvg = getAssessmentAverage(dictationScores, classData);
    const avgDictationDisplay = dictationAvg === null
        ? '--'
        : (dictationScheme.mode === 'qualitative'
            ? `${getNearestQualitativeLabel(dictationScheme, dictationAvg)} (${dictationAvg.toFixed(0)}%)`
            : `${dictationAvg.toFixed(0)}%`);

    let topScholars = [];
    if (studentsInClass.length > 0 && scoresForClass.length > 0) {
        const studentAverages = studentsInClass.map(student => {
            const studentTestScores = testsByStudentId.get(student.id) || [];
            const studentDictationScores = dictationsByStudentId.get(student.id) || [];
            if (studentTestScores.length === 0 && studentDictationScores.length === 0) return null;

            const avg = getWeightedAcademicAverage(studentTestScores, studentDictationScores, classData);

            return { name: student.name, avg };
        }).filter(Boolean);

        if (studentAverages.length > 0) {
            const maxAvg = Math.max(...studentAverages.map(s => s.avg));
            topScholars = studentAverages.filter(s => s.avg === maxAvg);
        }
    }
    // Stat cards deprecated - removed as per v2 cleanup

    const studentPerformanceData = studentsInClass.map(student => {
        const studentTestScores = testsByStudentId.get(student.id) || [];
        const studentDictationScores = dictationsByStudentId.get(student.id) || [];

        const avg = getWeightedAcademicAverage(studentTestScores, studentDictationScores, classData);
        const performance = (studentTestScores.length > 0 || studentDictationScores.length > 0)
            ? { value: avg, display: `${avg.toFixed(1)}%` }
            : { value: 0, display: '--' };
        return { student, performance };
    }).sort((a, b) => b.performance.value - a.performance.value);

    // Render Performance Chart
    if (studentPerformanceData.length === 0 || studentPerformanceData.every(d => d.performance.value === 0)) {
        chartContainer.innerHTML = `<p class="text-center text-gray-400 p-8">Log some trials to see the performance chart!</p>`;
    } else {
        chartContainer.innerHTML = `<div class="performance-chart-container">${studentPerformanceData.map(({ student, performance }, rowIndex) => {
            const scoreData = scoreMetaByStudentId.get(student.id);
            const pendingSkill = !!scoreData?.pendingSkillChoice;
            const avatarInner = student.avatar
                ? `<img src="${student.avatar}" alt="${student.name}" class="student-avatar enlargeable-avatar" data-student-id="${student.id}">`
                : `<div class="student-avatar enlargeable-avatar flex items-center justify-center bg-gray-300 text-gray-600 font-bold" data-student-id="${student.id}">${student.name.charAt(0)}</div>`;
            const avatarHtml = wrapAvatarWithLevelUpIndicator(avatarInner, pendingSkill);

            const percentage = performance.value;
            let tier = 'low';
            if (percentage >= 80) tier = 'high';
            else if (percentage >= 50) tier = 'mid';

            return `
    <div class="chart-row" data-score-tier="${tier}" style="--chart-stagger: ${rowIndex * 0.02}s">
        <div class="chart-avatar-wrapper">
            ${avatarHtml}
        </div>
        <button type="button"
            class="chart-label chart-label-button cursor-pointer"
            data-student-id="${student.id}"
            aria-label="Open analytics for ${student.name}">
            ${student.heroClass && HERO_CLASSES[student.heroClass] ? HERO_CLASSES[student.heroClass].icon : ''} ${student.name}
        </button>
        <div class="chart-bar-wrapper">
            <div class="chart-bar" data-score-tier="${tier}" style="width: ${percentage}%;">
                <span>${performance.display}</span>
            </div>
        </div>
    </div>
`;
        }).join('')}</div>`;
    }
}

// --- NEW MODAL LOGIC ---

export function openTrialTypeModal(classId) {
    if (!classId) return;
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classData) return;

    modals.showAnimatedModal('trial-type-modal');

    document.getElementById('select-dictation-btn').onclick = () => {
        modals.hideModal('trial-type-modal');
        setTimeout(() => openBulkLogModal(classId, 'dictation'), 300);
    };

    document.getElementById('select-test-btn').onclick = () => {
        modals.hideModal('trial-type-modal');
        setTimeout(() => openBulkLogModal(classId, 'test'), 300);
    };

    document.getElementById('trial-type-cancel-btn').onclick = () => modals.hideModal('trial-type-modal');
}

export function openBulkLogModal(classId, type) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const students = state.get('allStudents').filter(s => s.classId === classId).sort((a, b) => a.name.localeCompare(b.name));
    if (!classData) return;
    const assessmentScheme = getAssessmentSchemeForClass(classData, type);

    const todayStr = utils.getTodayDateString();
    const scheduledTest = state.get('allQuestAssignments').find(a =>
        a.classId === classId &&
        a.testData &&
        utils.datesMatch(a.testData.date, todayStr)
    );

    // UI Setup
    document.getElementById('bulk-trial-title').innerText = type === 'dictation' ? 'Log Dictation' : 'Log Test';
    document.getElementById('bulk-trial-subtitle').innerText = `${classData.logo} ${classData.name}`;

    // Ensure date input is YYYY-MM-DD for input type="date"
    const todayObj = new Date();
    const yyyy = todayObj.getFullYear();
    const mm = String(todayObj.getMonth() + 1).padStart(2, '0');
    const dd = String(todayObj.getDate()).padStart(2, '0');
    document.getElementById('bulk-trial-date').value = `${yyyy}-${mm}-${dd}`;

    // NEW: Update the DD/MM/YYYY display label
    const dateDisplay = document.getElementById('bulk-trial-date-display');
    const updateDateDisplay = (val) => {
        // Fix: Added check for !dateDisplay to prevent crash if element is missing
        if (!val || !dateDisplay) return;
        const [y, m, d] = val.split('-');
        dateDisplay.innerText = `${d}/${m}/${y}`;
    };
    updateDateDisplay(document.getElementById('bulk-trial-date').value);

    // Add listener for changes
    document.getElementById('bulk-trial-date').onchange = (e) => updateDateDisplay(e.target.value);

    const titleWrapper = document.getElementById('bulk-trial-title-wrapper');
    const titleInput = document.getElementById('bulk-trial-name');
    titleInput.value = '';
    if (scheduledTest && type === 'test') {
        titleInput.value = scheduledTest.testData.title;
    }

    if (type === 'test') {
        titleWrapper.classList.remove('hidden');
    } else {
        titleWrapper.classList.add('hidden');
    }

    const listContainer = document.getElementById('bulk-student-list');
    listContainer.innerHTML = '';

    if (students.length === 0) {
        listContainer.innerHTML = `
            <div class="col-span-full rounded-3xl border border-amber-200/70 bg-white/70 p-8 text-center shadow-sm">
                <div class="text-5xl mb-3">🧭</div>
                <p class="font-title text-2xl text-amber-900">No students found</p>
                <p class="text-sm text-amber-900/60 font-semibold mt-1">Add students to this class to start logging trials.</p>
            </div>
        `;
    } else {
        const today = utils.getTodayDateString();
        const attendance = state.get('allAttendanceRecords').filter(r => r.classId === classId && r.date === today);

        students.forEach(student => {
            const isAbsent = attendance.some(r => r.studentId === student.id);
            listContainer.innerHTML += renderStudentBulkRow(student, assessmentScheme, isAbsent);
        });
    }

    // Attach Toggle Listeners
    listContainer.querySelectorAll('.toggle-absent-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('.bulk-log-item');
            const isNowAbsent = !btn.classList.contains('is-absent');
            const input = row.querySelector('.bulk-grade-input');

            btn.classList.toggle('is-absent');

            if (isNowAbsent) {
                btn.classList.remove('bg-green-500', 'text-white', 'hover:bg-green-600');
                btn.classList.add('bg-red-500', 'text-white', 'hover:bg-red-600');
                btn.innerHTML = '<i class="fas fa-user-slash"></i> Absent';
            } else {
                btn.classList.remove('bg-red-500', 'text-white', 'hover:bg-red-600');
                btn.classList.add('bg-green-500', 'text-white', 'hover:bg-green-600');
                btn.innerHTML = '<i class="fas fa-user-check"></i> Present';
            }

            row.classList.toggle('absent', isNowAbsent);
            if (input) input.disabled = isNowAbsent;
            if (isNowAbsent && input) input.value = '';
        });
    });

    document.getElementById('bulk-trial-close-btn').onclick = () => modals.hideModal('bulk-trial-modal');

    document.getElementById('bulk-trial-modal').dataset.classId = classId;
    document.getElementById('bulk-trial-modal').dataset.type = type;
    document.getElementById('bulk-trial-modal').dataset.gradingMode = assessmentScheme.mode;

    modals.showAnimatedModal('bulk-trial-modal');
}

function renderStudentBulkRow(student, scheme, isAbsent) {
    const avatarHtml = student.avatar
        ? `<img src="${student.avatar}" class="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm ring-1 ring-amber-200/60 student-avatar">`
        : `<div class="w-11 h-11 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-amber-800 font-black shadow-sm ring-1 ring-amber-200/60 student-avatar">${student.name.charAt(0)}</div>`;

    let inputHtml = '';

    if (scheme.mode === 'qualitative') {
        inputHtml = `
            <select class="bulk-grade-input w-full p-2.5 border border-amber-200/80 rounded-xl bg-white/80 focus:ring-2 focus:ring-amber-400 outline-none shadow-sm" ${isAbsent ? 'disabled' : ''}>
                <option value="" selected disabled>Select Grade...</option>
                ${(scheme.scale || []).map((entry) => `<option value="${entry.label}">${entry.label} (${entry.normalizedPercent}%)</option>`).join('')}
            </select>
        `;
    } else {
        const maxScore = Number(scheme.maxScore) || 100;
        inputHtml = `
            <div class="relative">
                <input type="number" class="bulk-grade-input w-full p-2.5 border border-amber-200/80 rounded-xl bg-white/80 focus:ring-2 focus:ring-amber-400 outline-none shadow-sm" 
                    placeholder="0-${maxScore}" min="0" max="${maxScore}" ${isAbsent ? 'disabled' : ''} onwheel="this.blur()">
                <span class="absolute right-3 top-2.5 text-amber-900/45 text-sm font-bold">/${maxScore}</span>
            </div>
        `;
    }

    const buttonClass = isAbsent
        ? 'is-absent bg-red-500 text-white hover:bg-red-600'
        : 'bg-emerald-500 text-white hover:bg-emerald-600';

    return `
        <div class="bulk-log-item bg-white/80 p-4 rounded-2xl shadow-sm flex items-center gap-3 border border-amber-200/60 hover:border-amber-300 hover:shadow-md transition-all ${isAbsent ? 'absent' : ''}" data-student-id="${student.id}">
            ${avatarHtml}
            <div class="flex-grow min-w-0">
                <p class="font-bold text-gray-800 truncate">${student.name}</p>
                <button type="button" class="toggle-absent-btn text-xs px-2.5 py-1.5 rounded-full mt-1 ${buttonClass} shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400">
                    ${isAbsent ? '<i class="fas fa-user-slash"></i> Absent' : '<i class="fas fa-user-check"></i> Present'}
                </button>
            </div>
            <div class="w-36 grade-input-wrapper">
                ${inputHtml}
            </div>
        </div>
    `;
}

// --- HISTORY & SINGLE EDIT ---

export async function openTrialHistoryModal(classId) {
    if (!classId) return;
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;

    loadedHistoricalScores = [];

    const modal = document.getElementById('trial-history-modal');
    modal.dataset.classId = classId;
    document.getElementById('trial-history-title').innerHTML = `${classData.logo} Trial History`;

    // 1. Reset Toggle Buttons
    const viewToggleContainer = document.getElementById('trial-history-view-toggle');
    viewToggleContainer.innerHTML = `
        <button data-view="test" class="toggle-btn active-toggle px-4 py-2 rounded-xl font-bold text-sm transition-all"><i class="fas fa-file-alt mr-2"></i>Tests</button>
        <button data-view="dictation" class="toggle-btn px-4 py-2 rounded-xl font-bold text-sm transition-all"><i class="fas fa-microphone-alt mr-2"></i>Dictations</button>
    `;

    viewToggleContainer.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            viewToggleContainer.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active-toggle'));
            e.currentTarget.classList.add('active-toggle');
            renderTrialHistoryContent(classId, e.currentTarget.dataset.view);
        });
    });

    // 2. Setup Edit/Delete Listeners
    const contentEl = document.getElementById('trial-history-content');
    const newContentEl = contentEl.cloneNode(false);
    contentEl.parentNode.replaceChild(newContentEl, contentEl);

    newContentEl.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-trial-btn');
        if (deleteBtn) handleDeleteTrial(deleteBtn.dataset.trialId);
        const editBtn = e.target.closest('.edit-trial-btn');
        if (editBtn) openSingleTrialEditModal(classId, editBtn.dataset.trialId);
    });

    // 3. Initial Render
    renderTrialHistoryContent(classId, 'test');
    modals.showAnimatedModal('trial-history-modal');

    // 4. PERMANENT DROPDOWN IN HEADER (Safe Zone)
    const actionsContainer = document.getElementById('trial-history-actions');

    // Reset container with a loading state
    actionsContainer.innerHTML = `
        <div class="flex items-center gap-2 bg-purple-100 text-purple-900 px-3 py-1.5 rounded-xl border border-purple-200 shadow-sm opacity-70">
            <i class="fas fa-spinner fa-spin text-sm"></i>
            <span class="text-xs font-bold uppercase tracking-wider">Locating Archives...</span>
        </div>`;

    try {
        const { parseFlexibleDate } = await import('../utils.js');
        const { fetchTrialsForMonth } = await import('../db/queries.js');

        // Smart Month Scanner (Checks local data first)
        const now = new Date();
        const currentMonthKey = now.toISOString().substring(0, 7);
        const allScores = state.get('allWrittenScores').filter(s => s.classId === classId);
        const monthSet = new Set();

        allScores.forEach(s => {
            const d = parseFlexibleDate(s.date);
            if (d) monthSet.add(d.toISOString().substring(0, 7));
        });

        // Also check DB for older months not loaded yet
        const dbMonths = await fetchAllTrialMonthsForClass(classId);
        dbMonths.forEach(m => monthSet.add(m));

        const historicalMonths = [...monthSet].filter(m => m < currentMonthKey).sort().reverse();

        if (historicalMonths.length > 0) {
            // Render The Beautiful Dropdown
            actionsContainer.innerHTML = `
                <div class="relative group">
                    <div class="flex items-center bg-white border border-purple-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                        <div class="bg-purple-50 px-3 py-2 border-r border-purple-100">
                            <i class="fas fa-history text-purple-600"></i>
                        </div>
                        <select id="trial-history-month-select" class="pl-3 pr-8 py-2 bg-transparent text-purple-900 font-bold text-sm outline-none cursor-pointer appearance-none min-w-[140px]">
                            <option value="">Load Past Month...</option>
                            ${historicalMonths.map(m => {
                const d = new Date(m + '-02');
                return `<option value="${m}">${d.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</option>`;
            }).join('')}
                        </select>
                        <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-purple-400 text-xs group-hover:text-purple-600 transition-colors">
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>
                </div>
            `;

            const select = document.getElementById('trial-history-month-select');
            select.addEventListener('change', async (e) => {
                const monthKey = e.target.value;
                if (!monthKey) return;

                const originalText = select.options[select.selectedIndex].text;
                select.disabled = true;
                // Visual feedback inside the select
                const tempOption = document.createElement('option');
                tempOption.text = "Fetching...";
                select.add(tempOption, select[0]);
                select.selectedIndex = 0;

                const scores = await fetchTrialsForMonth(classId, monthKey);

                // Remove temp option
                select.remove(0);

                if (scores.length > 0) {
                    loadedHistoricalScores.push(...scores);
                    // Force refresh current view
                    const activeView = document.querySelector('#trial-history-view-toggle .active-toggle')?.dataset.view || 'test';
                    renderTrialHistoryContent(classId, activeView);

                    showToast(`Archive opened: ${originalText}`, 'success');
                } else {
                    showToast('No records found in that archive.', 'info');
                }

                select.disabled = false;
                select.value = ""; // Reset to default
            });
        } else {
            actionsContainer.innerHTML = `
                <div class="px-3 py-1.5 bg-gray-100 rounded-lg border border-gray-200 text-gray-400 text-xs font-bold">
                    No Archives Found
                </div>`;
        }
    } catch (err) {
        console.error("History Error:", err);
        actionsContainer.innerHTML = `<span class="text-xs text-red-400">Connection Error</span>`;
    }
}

export function renderTrialHistoryContent(classId, view) {
    const contentEl = document.getElementById('trial-history-content');

    // 1. Get ONLY recent scores (last 45 days) for the initial view
    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 45);

    const recentScores = state.get('allWrittenScores').filter(s => {
        if (!s.date || s.classId !== classId) return false;
        return utils.parseFlexibleDate(s.date) >= recentCutoff;
    });

    // 2. ONLY combine with historical scores if the user explicitly clicked them
    const allScoresForClass = [...recentScores, ...loadedHistoricalScores];

    // 3. Remove duplicates to be safe
    const uniqueScores = Array.from(new Map(allScoresForClass.map(item => [item.id, item])).values());

    // 4. Filter by the selected view ('test' or 'dictation')
    const scoresToRender = uniqueScores.filter(s => s.type === view);

    // 5. Group and Render (use smart date parser — scores may be DD-MM-YYYY or YYYY-MM-DD)
    const scoresByMonth = scoresToRender.reduce((acc, score) => {
        const d = utils.parseFlexibleDate(score.date);
        const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : (score.date && score.date.substring(0, 7)) || 'unknown';
        if (!acc[key]) acc[key] = [];
        acc[key].push(score);
        return acc;
    }, {});

    const sortedMonths = Object.keys(scoresByMonth).sort().reverse();

    if (sortedMonths.length === 0) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">No ${view} records found. Try loading historical data if available.</p>`;
        return;
    }

    const newHtml = sortedMonths.map(currentMonthKey => {
        const monthName = new Date(currentMonthKey + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' });

        const scoresByDate = scoresByMonth[currentMonthKey].reduce((acc, score) => {
            if (!acc[score.date]) acc[score.date] = [];
            acc[score.date].push(score);
            return acc;
        }, {});

        const sortedDates = Object.keys(scoresByDate).sort((a, b) => {
            const da = utils.parseFlexibleDate(a);
            const db = utils.parseFlexibleDate(b);
            return (db || 0) - (da || 0);
        });

        let monthScoresHtml = sortedDates.map(date => {
            const dateScoresHtml = scoresByDate[date]
                .sort((a, b) => {
                    const studentA = state.get('allStudents').find(s => s.id === a.studentId)?.name || '';
                    const studentB = state.get('allStudents').find(s => s.id === b.studentId)?.name || '';
                    return studentA.localeCompare(studentB);
                })
                .map(score => renderTrialHistoryItem(score)).join('');
            const title = scoresByDate[date][0].title || (view === 'dictation' ? 'Dictation' : 'Test');
            const dateObj = utils.parseFlexibleDate(date);
            const displayDate = dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) : date;

            return `<div class="mb-5 last:mb-0 relative">
                        <div class="flex items-center gap-3 mb-3 pl-2">
                            <div class="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-b from-purple-100 to-white border border-purple-200 shadow-sm text-center leading-none">
                                <span class="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-0.5">${displayDate.substring(0,3)}</span>
                                <span class="text-lg font-black text-purple-900 font-title">${dateObj ? dateObj.getDate() : ''}</span>
                            </div>
                            <div>
                                <span class="font-bold text-gray-700">${dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', year: 'numeric' }) : date}</span>
                                <div class="text-xs font-semibold text-purple-600 bg-purple-100 px-2.5 py-0.5 rounded-full inline-block mt-0.5 border border-purple-200 shadow-sm">${title}</div>
                            </div>
                        </div>
                        <div class="space-y-2 pl-4 ml-8 relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-purple-100">${dateScoresHtml}</div>
                    </div>`;
        }).join('');

        return `
            <details class="group month-group bg-white/80 backdrop-blur-sm rounded-2xl mb-4 shadow-sm border border-purple-100 overflow-hidden transition-all hover:shadow-md" data-month-key="${currentMonthKey}" open>
                <summary class="flex items-center justify-between font-title text-xl text-purple-900 p-4 cursor-pointer bg-gradient-to-r from-purple-50/50 to-fuchsia-50/50 hover:from-purple-100/50 hover:to-fuchsia-100/50 transition-colors list-none select-none" style="list-style: none;">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-purple-200/50 flex items-center justify-center text-purple-700">
                            <i class="fas fa-calendar-alt text-sm"></i>
                        </div>
                        ${monthName}
                    </div>
                    <div class="text-purple-400 group-open:rotate-180 transition-transform duration-300">
                        <i class="fas fa-chevron-down"></i>
                    </div>
                </summary>
                <div class="p-4 pt-4 border-t border-purple-100/50">
                    ${monthScoresHtml}
                </div>
            </details>
        `;
    }).join('');

    contentEl.innerHTML = newHtml;
}

function renderTrialHistoryItem(score) {
    const student = state.get('allStudents').find(s => s.id === score.studentId);
    if (!student) return '';

    let scoreDisplay = '';
    let scorePercent = 0;
    let colorClass = 'text-blue-600';
    let bgClass = 'bg-blue-50';
    let borderClass = 'border-blue-200';

    if (score.scoreQualitative) {
        scoreDisplay = `<span class="font-title text-lg leading-none">${score.scoreQualitative}</span>`;
    }
    else if (score.scoreNumeric !== null && score.maxScore) {
        scorePercent = getNormalizedPercentForScore(score) || 0;
        if (scorePercent >= 80) { colorClass = 'text-emerald-700'; bgClass = 'bg-emerald-50'; borderClass = 'border-emerald-200'; }
        else if (scorePercent >= 60) { colorClass = 'text-amber-700'; bgClass = 'bg-amber-50'; borderClass = 'border-amber-200'; }
        else { colorClass = 'text-rose-700'; bgClass = 'bg-rose-50'; borderClass = 'border-rose-200'; }
        
        scoreDisplay = `<span class="font-title text-lg leading-none">${getAssessmentValueLabel(score)}</span>
                        <span class="text-xs font-bold opacity-70 ml-1.5 mt-0.5">${scorePercent.toFixed(0)}%</span>`;
    }

    const isOwner = score.teacherId === state.get('currentUserId');
    const avatarHtml = student.avatar
        ? `<img src="${student.avatar}" class="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm shrink-0">`
        : `<div class="w-9 h-9 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-purple-700 font-bold shadow-sm border-2 border-white shrink-0">${student.name.charAt(0)}</div>`;

    return `
        <div class="trial-history-item relative flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-purple-300 hover:shadow-md transition-all duration-200 group/item">
            <div class="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${scorePercent >= 80 ? 'bg-emerald-400' : scorePercent >= 60 ? 'bg-amber-400' : scorePercent > 0 ? 'bg-rose-400' : 'bg-blue-400'}"></div>
            
            <div class="flex items-center gap-3 pl-3">
                ${avatarHtml}
                <span class="font-bold text-gray-800">${student.name}</span>
            </div>
            
            <div class="flex items-center gap-4">
                <div class="flex items-center justify-center px-3 py-1.5 rounded-lg ${bgClass} ${borderClass} border ${colorClass}">
                    ${scoreDisplay}
                </div>
                
                ${isOwner ? `
                <div class="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <button data-trial-id="${score.id}" class="edit-trial-btn w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-110 transition-all flex items-center justify-center shadow-sm" title="Edit"><i class="fas fa-pencil-alt text-sm"></i></button>
                    <button data-trial-id="${score.id}" class="delete-trial-btn w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-100 hover:scale-110 transition-all flex items-center justify-center shadow-sm" title="Delete"><i class="fas fa-trash-alt text-sm"></i></button>
                </div>
                ` : '<div class="w-[72px]"></div>'}
            </div>
        </div>
    `;
}

// --- SINGLE EDIT MODAL ---

export function openSingleTrialEditModal(classId, trialId) {
    const score = state.get('allWrittenScores').find(s => s.id === trialId);
    if (!score) return;

    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const assessmentScheme = getAssessmentSchemeForClass(classData, score.type);

    const modal = document.getElementById('bulk-trial-modal');

    document.getElementById('bulk-trial-title').innerText = 'Edit Result';
    document.getElementById('bulk-trial-subtitle').innerText = `${classData.name}`;

    const dateObj = utils.parseDDMMYYYY(score.date);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    document.getElementById('bulk-trial-date').value = `${yyyy}-${mm}-${dd}`;

    // Also update display label for single edit
    const displayEl = document.getElementById('bulk-trial-date-display');
    if (displayEl) displayEl.innerText = `${dd}/${mm}/${yyyy}`;

    const titleWrapper = document.getElementById('bulk-trial-title-wrapper');
    const titleInput = document.getElementById('bulk-trial-name');

    if (score.type === 'test') {
        titleWrapper.classList.remove('hidden');
        titleInput.value = score.title || '';
    } else {
        titleWrapper.classList.add('hidden');
    }

    const listContainer = document.getElementById('bulk-student-list');
    listContainer.innerHTML = '';

    const student = state.get('allStudents').find(s => s.id === score.studentId);
    if (student) {
        const rowHtml = renderStudentBulkRow(student, assessmentScheme, false);
        listContainer.innerHTML = rowHtml;

        const input = listContainer.querySelector('.bulk-grade-input');
        if (input) {
            if (score.scoreQualitative) input.value = score.scoreQualitative;
            else if (score.scoreNumeric !== null) input.value = score.scoreNumeric;
        }
        listContainer.querySelector('.bulk-log-item').dataset.trialId = trialId;
    }

    modal.dataset.classId = classId;
    modal.dataset.type = score.type;
    modal.dataset.gradingMode = assessmentScheme.mode;

    const saveBtn = document.getElementById('bulk-trial-save-btn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    import('../db/actions.js').then(actions => {
        newSaveBtn.addEventListener('click', actions.handleBulkSaveTrial);
    });

    modals.showAnimatedModal('bulk-trial-modal');
    document.getElementById('bulk-trial-close-btn').onclick = () => modals.hideModal('bulk-trial-modal');
}


// --- NEW: MAKEUP / MISSING WORK LOGIC ---

function renderMissingWorkDashboard(classId) {
    const dashboard = document.getElementById('scroll-dashboard-content');
    // Check if container exists, if not create it at top
    let container = document.getElementById('makeup-work-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'makeup-work-container';
        dashboard.prepend(container);
    }
    container.innerHTML = ''; // Clear previous

    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    const scoresForClass = state.get('allWrittenScores').filter(s => s.classId === classId);

    // 1. Identify unique Tests (Group by Title+Type)
    const uniqueAssessments = {};

    scoresForClass.forEach(score => {
        // FIX 2: ONLY Tests
        if (score.type === 'test') {
            const key = `${score.type}-${score.title || 'Untitled'}`;
            if (!uniqueAssessments[key]) {
                uniqueAssessments[key] = {
                    type: score.type,
                    title: score.title || 'Untitled',
                    originalDate: score.date,
                    count: 0
                };
            }
            uniqueAssessments[key].count++;
        }
    });

    // Filter out assessments that only 1 or 2 students took (likely makeups themselves)
    const threshold = Math.max(2, Math.floor(studentsInClass.length * 0.3));

    // Only show makeups for assessments within the past 3 months (matching the data load window)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    threeMonthsAgo.setHours(0, 0, 0, 0);

    const validAssessments = Object.values(uniqueAssessments).filter(a => {
        if (a.count < threshold) return false;
        const aDate = utils.parseFlexibleDate(a.originalDate);
        if (!aDate) return false;
        return aDate >= threeMonthsAgo; // Skip stale assessments from > 3 months ago
    });

    if (validAssessments.length === 0) return;

    // 2. Find students who missed these
    const missingWork = [];

    validAssessments.forEach(assessment => {
        studentsInClass.forEach(student => {
            // FIX: Check if student joined AFTER the test date
            if (student.createdAt) {
                const joinDate = student.createdAt.toDate ? student.createdAt.toDate() : new Date(student.createdAt);
                const testDate = utils.parseFlexibleDate(assessment.originalDate);
                testDate.setHours(23, 59, 59, 999);
                if (joinDate > testDate) return;
            }

            const hasTaken = scoresForClass.some(s =>
                s.studentId === student.id &&
                s.type === assessment.type &&
                (s.title === assessment.title || (!s.title && !assessment.title))
            );

            if (!hasTaken) {
                missingWork.push({
                    student,
                    assessment
                });
            }
        });
    });

    if (missingWork.length === 0) return;

    // Load dismissed makeups from localStorage (keyed by classId-type-title-studentId)
    const dismissedKey = `dismissed_makeups_${classId}`;
    const dismissed = JSON.parse(localStorage.getItem(dismissedKey) || '{}');

    // Filter out dismissed items
    const filteredWork = missingWork.filter(item => {
        const itemKey = `${item.assessment.type}-${item.assessment.title}-${item.student.id}`;
        return !dismissed[itemKey];
    });

    if (filteredWork.length === 0) return;

    // 3. Render the list
    let html = `
        <div class="makeup-alert-container">
            <h3 class="font-title text-xl text-orange-700 mb-2"><i class="fas fa-clock mr-2"></i>Pending Makeups</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    `;

    filteredWork.forEach(item => {
        html += `
            <div class="makeup-item">
                <div>
                    <div class="font-bold text-gray-800">${item.student.name}</div>
                    <div class="text-xs text-gray-500">Missed: ${item.assessment.title} (${item.assessment.type})</div>
                    <div class="text-xs text-orange-400">Original Date: ${(utils.parseFlexibleDate(item.assessment.originalDate) || new Date()).toLocaleDateString('en-GB')}</div>
                </div>
                <div class="flex items-center gap-2">
                    <button class="makeup-dismiss-btn w-7 h-7 rounded-full bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors" 
                        data-student-id="${item.student.id}" 
                        data-title="${item.assessment.title}" 
                        data-type="${item.assessment.type}"
                        title="Dismiss this pending makeup">
                        <i class="fas fa-times text-xs pointer-events-none"></i>
                    </button>
                    <button class="makeup-log-btn makeup-trigger" 
                        data-student-id="${item.student.id}" 
                        data-title="${item.assessment.title}" 
                        data-type="${item.assessment.type}">
                        Log Now
                    </button>
                </div>
            </div>
        `;
    });


    html += `</div></div>`;
    container.innerHTML = html;

    // 4. Bind Click Events
    container.querySelectorAll('.makeup-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
            openMakeupModal(classId, btn.dataset.studentId, btn.dataset.type, btn.dataset.title);
        });
    });

    // 5. Bind Dismiss Buttons
    container.querySelectorAll('.makeup-dismiss-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const itemKey = `${btn.dataset.type}-${btn.dataset.title}-${btn.dataset.studentId}`;
            const saved = JSON.parse(localStorage.getItem(dismissedKey) || '{}');
            saved[itemKey] = true;
            localStorage.setItem(dismissedKey, JSON.stringify(saved));
            // Remove from DOM immediately
            const makeupItem = btn.closest('.makeup-item');
            if (makeupItem) {
                makeupItem.style.opacity = '0';
                makeupItem.style.transition = 'opacity 0.3s';
                setTimeout(() => {
                    makeupItem.remove();
                    // If no items left, remove the whole container
                    const remaining = container.querySelectorAll('.makeup-item');
                    if (remaining.length === 0) container.remove();
                }, 300);
            }
        });
    });
}

function openMakeupModal(classId, studentId, type, title) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const student = state.get('allStudents').find(s => s.id === studentId);
    const assessmentScheme = getAssessmentSchemeForClass(classData, type);

    // Reuse Bulk Modal DOM but configure for single makeup
    const modal = document.getElementById('bulk-trial-modal');

    document.getElementById('bulk-trial-title').innerText = `Makeup: ${type === 'dictation' ? 'Dictation' : 'Test'}`;
    document.getElementById('bulk-trial-subtitle').innerText = `${student.name} - ${title}`;

    // Set Date to TODAY (ISO format for input)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('bulk-trial-date').value = `${yyyy}-${mm}-${dd}`;

    // Update Visual Display manually
    const displayEl = document.getElementById('bulk-trial-date-display');
    if (displayEl) displayEl.innerText = `${dd}/${mm}/${yyyy}`;

    // Handle Title Input
    const titleWrapper = document.getElementById('bulk-trial-title-wrapper');
    const titleInput = document.getElementById('bulk-trial-name');

    titleWrapper.classList.remove('hidden'); // Always show title for makeup to confirm context
    titleInput.value = title || '';

    // Render JUST the one student row
    const listContainer = document.getElementById('bulk-student-list');

    // Simplified Row Generation for Makeup
    const avatarHtml = student.avatar
        ? `<img src="${student.avatar}" class="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm ring-1 ring-amber-200/60">`
        : `<div class="w-11 h-11 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-amber-800 font-black shadow-sm ring-1 ring-amber-200/60">${student.name.charAt(0)}</div>`;

    let inputHtml = '';
    if (assessmentScheme.mode === 'qualitative') {
        inputHtml = `
            <select class="bulk-grade-input w-full p-2.5 border border-amber-200/80 rounded-xl bg-white/80 focus:ring-2 focus:ring-amber-400 outline-none shadow-sm">
                <option value="" selected disabled>Select Grade...</option>
                ${(assessmentScheme.scale || []).map((entry) => `<option value="${entry.label}">${entry.label} (${entry.normalizedPercent}%)</option>`).join('')}
            </select>`;
    } else {
        const maxScore = Number(assessmentScheme.maxScore) || 100;
        inputHtml = `
            <div class="relative">
                <input type="number" class="bulk-grade-input w-full p-2.5 border border-amber-200/80 rounded-xl bg-white/80 focus:ring-2 focus:ring-amber-400 outline-none shadow-sm" 
                    placeholder="Score" min="0" max="${maxScore}" onwheel="this.blur()">
                <span class="absolute right-3 top-2.5 text-amber-900/45 text-sm font-bold">/${maxScore}</span>
            </div>`;
    }

    listContainer.innerHTML = `
        <div class="bulk-log-item bg-white/80 p-4 rounded-2xl shadow-sm flex items-center gap-3 border border-amber-200/60 hover:border-amber-300 hover:shadow-md transition-all" data-student-id="${student.id}">
            ${avatarHtml}
            <div class="flex-grow min-w-0">
                <p class="font-bold text-gray-800 truncate">${student.name}</p>
                <span class="text-xs text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full font-bold">Taking Makeup</span>
                <!-- Hidden absent button for logic compatibility -->
                <button class="toggle-absent-btn hidden" tabindex="-1"></button>
            </div>
            <div class="w-36 grade-input-wrapper">
                ${inputHtml}
            </div>
        </div>
    `;

    // Set modal datasets for saving
    modal.dataset.classId = classId;
    modal.dataset.type = type;
    modal.dataset.gradingMode = assessmentScheme.mode;

    // Bind Save Button
    const saveBtn = document.getElementById('bulk-trial-save-btn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    // We need to import handleBulkSaveTrial from actions to bind it
    import('../db/actions.js').then(actions => {
        newSaveBtn.addEventListener('click', actions.handleBulkSaveTrial);
    });

    // Show
    modals.showAnimatedModal('bulk-trial-modal');
    document.getElementById('bulk-trial-close-btn').onclick = () => modals.hideModal('bulk-trial-modal');
}
