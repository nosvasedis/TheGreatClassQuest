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


// --- TAB RENDERING ---

export function renderScholarsScrollTab(selectedClassId = null) {
    const classSelect = document.getElementById('scroll-class-select');
    if (!classSelect) return;

    const currentVal = selectedClassId || state.get('globalSelectedClassId');
    const optionsHtml = state.get('allTeachersClasses').sort((a,b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${c.logo} ${c.name}</option>`).join('');
    
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

        document.getElementById('scroll-dashboard-content').classList.add('hidden');
        document.getElementById('scroll-placeholder').classList.remove('hidden');
    }
}

function renderScrollDashboard(classId) {
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    const scoresForClass = state.get('allWrittenScores').filter(s => s.classId === classId);
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const isJunior = classData && (classData.questLevel === 'Junior A' || classData.questLevel === 'Junior B');
    
    const statsContainer = document.getElementById('scroll-stats-cards');
    const chartContainer = document.getElementById('scroll-performance-chart');

    const dictationMap = { "Great!!!": 4, "Great!!": 3, "Great!": 2, "Nice Try!": 1 };
    
    const testScores = scoresForClass.filter(s => s.type === 'test' && s.scoreNumeric !== null);
    const dictationScores = scoresForClass.filter(s => s.type === 'dictation');
    
    // --- Calculate Averages ---
    const testAvg = testScores.length > 0 
        ? (testScores.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore) * 100, 0) / testScores.length) 
        : null;

    let avgDictationDisplay = '--';
    if (isJunior) {
        const juniorDictations = dictationScores.filter(s => s.scoreQualitative);
        const avgDictationValue = juniorDictations.length > 0
            ? (juniorDictations.reduce((sum, s) => sum + dictationMap[s.scoreQualitative], 0) / juniorDictations.length)
            : null;
        if (avgDictationValue !== null) {
            const dictationEntries = Object.entries(dictationMap);
            const closest = dictationEntries.reduce((prev, curr) => Math.abs(curr[1] - avgDictationValue) < Math.abs(prev[1] - avgDictationValue) ? curr : prev);
            avgDictationDisplay = closest[0];
        }
    } else {
        const seniorDictations = dictationScores.filter(s => s.scoreNumeric !== null);
        const avgSeniorDictation = seniorDictations.length > 0
            ? (seniorDictations.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore) * 100, 0) / seniorDictations.length)
            : null;
        if (avgSeniorDictation !== null) {
            avgDictationDisplay = `${avgSeniorDictation.toFixed(0)}%`;
        }
    }

    let topScholars = [];
    if (studentsInClass.length > 0 && scoresForClass.length > 0) {
        const studentAverages = studentsInClass.map(student => {
            const studentTestScores = testScores.filter(s => s.studentId === student.id);
            const studentDictationScores = dictationScores.filter(s => s.studentId === student.id);
            if (studentTestScores.length === 0 && studentDictationScores.length === 0) return null;

            const avg = isJunior 
                ? calculateJuniorTreasureRank(studentTestScores, studentDictationScores).value 
                : calculateSeniorAverage(studentTestScores, studentDictationScores);

            return { name: student.name, avg };
        }).filter(Boolean);

        if(studentAverages.length > 0) {
            const maxAvg = Math.max(...studentAverages.map(s => s.avg));
            topScholars = studentAverages.filter(s => s.avg === maxAvg);
        }
    }
    const topScholarsDisplay = topScholars.length > 0 ? topScholars.map(s => s.name).join(', ') : '--';

    statsContainer.innerHTML = `
        <div class="scroll-stat-card">
            <p class="text-sm font-bold text-amber-800">Class Avg (Test)</p>
            <p class="font-title text-4xl text-green-600">${testAvg !== null ? testAvg.toFixed(0) + '%' : '--'}</p>
        </div>
        <div class="scroll-stat-card">
            <p class="text-sm font-bold text-amber-800">Class Avg (Dictation)</p>
            <p class="font-title text-4xl text-blue-600">${avgDictationDisplay}</p>
        </div>
        <div class="scroll-stat-card">
            <p class="text-sm font-bold text-amber-800">Top Scholar(s)</p>
            <p class="font-title text-2xl text-purple-700" title="${topScholarsDisplay}">${topScholarsDisplay}</p>
        </div>
    `;

    const studentPerformanceData = studentsInClass.map(student => {
        const studentTestScores = scoresForClass.filter(s => s.studentId === student.id && s.type === 'test');
        const studentDictationScores = scoresForClass.filter(s => s.studentId === student.id && s.type === 'dictation');
        
        let performance = { value: 0, display: '--' };
        if (studentTestScores.length > 0 || studentDictationScores.length > 0) {
            if (isJunior) {
                performance = calculateJuniorTreasureRank(studentTestScores, studentDictationScores);
            } else {
                const avg = calculateSeniorAverage(studentTestScores, studentDictationScores);
                performance = { value: avg, display: `${avg.toFixed(1)}%` };
            }
        }
        return { student, performance };
    }).sort((a, b) => b.performance.value - a.performance.value);

    // Render Performance Chart
    if (studentPerformanceData.length === 0 || studentPerformanceData.every(d => d.performance.value === 0)) {
        chartContainer.innerHTML = `<p class="text-center text-gray-400 p-8">Log some trials to see the performance chart!</p>`;
    } else {
        chartContainer.innerHTML = `<div class="performance-chart-container">${studentPerformanceData.map(({student, performance}) => {
            const avatarHtml = student.avatar 
                ? `<img src="${student.avatar}" alt="${student.name}" class="student-avatar enlargeable-avatar">` 
                : `<div class="student-avatar enlargeable-avatar flex items-center justify-center bg-gray-300 text-gray-600 font-bold">${student.name.charAt(0)}</div>`;
            
            const maxVal = isJunior ? 4 : 100;
            const percentage = (performance.value / maxVal) * 100;
            let tier = 'low';
            if (percentage >= 80) tier = 'high';
            else if (percentage >= 50) tier = 'mid';

            return `
    <div class="chart-row">
        <div class="hero-stats-avatar-trigger cursor-pointer" data-student-id="${student.id}">
            ${avatarHtml}
        </div>
        <div class="chart-label">${student.name}</div>
        <div class="chart-bar-wrapper">
            <div class="chart-bar" data-score-tier="${tier}" style="width: ${percentage}%; animation-delay: ${Math.random() * 0.2}s;">
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
    const students = state.get('allStudents').filter(s => s.classId === classId).sort((a,b) => a.name.localeCompare(b.name));
    if (!classData) return;

    const isJunior = classData.questLevel === 'Junior A' || classData.questLevel === 'Junior B';
    
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
    
    if (type === 'test') {
        titleWrapper.classList.remove('hidden');
    } else {
        titleWrapper.classList.add('hidden'); 
    }

    const listContainer = document.getElementById('bulk-student-list');
    listContainer.innerHTML = '';

    if (students.length === 0) {
        listContainer.innerHTML = `<p class="col-span-full text-center text-gray-500">No students found in this class.</p>`;
    } else {
        const today = utils.getTodayDateString();
        const attendance = state.get('allAttendanceRecords').filter(r => r.classId === classId && r.date === today);

        students.forEach(student => {
            const isAbsent = attendance.some(r => r.studentId === student.id);
            listContainer.innerHTML += renderStudentBulkRow(student, type, isJunior, isAbsent);
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
    document.getElementById('bulk-trial-modal').dataset.isJunior = isJunior;

    modals.showAnimatedModal('bulk-trial-modal');
}

function renderStudentBulkRow(student, type, isJunior, isAbsent) {
    const avatarHtml = student.avatar 
        ? `<img src="${student.avatar}" class="w-10 h-10 rounded-full object-cover border border-gray-200 student-avatar">`
        : `<div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold student-avatar">${student.name.charAt(0)}</div>`;

    let inputHtml = '';

    if (isJunior && type === 'dictation') {
        inputHtml = `
            <select class="bulk-grade-input w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-400 outline-none" ${isAbsent ? 'disabled' : ''}>
                <option value="" selected disabled>Select Grade...</option>
                <option value="Great!!!">Great!!! (Excellent)</option>
                <option value="Great!!">Great!!</option>
                <option value="Great!">Great!</option>
                <option value="Nice Try!">Nice Try!</option>
            </select>
        `;
    } else {
        const maxScore = (isJunior && type === 'test') ? 40 : 100;
        inputHtml = `
            <div class="relative">
                <input type="number" class="bulk-grade-input w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 outline-none" 
                    placeholder="0-${maxScore}" min="0" max="${maxScore}" ${isAbsent ? 'disabled' : ''}>
                <span class="absolute right-3 top-2 text-gray-400 text-sm">/${maxScore}</span>
            </div>
        `;
    }

    const buttonClass = isAbsent 
        ? 'is-absent bg-red-500 text-white hover:bg-red-600' 
        : 'bg-green-500 text-white hover:bg-green-600';

    return `
        <div class="bulk-log-item bg-white p-3 rounded-xl shadow-sm flex items-center gap-3 ${isAbsent ? 'absent' : ''}" data-student-id="${student.id}">
            ${avatarHtml}
            <div class="flex-grow min-w-0">
                <p class="font-bold text-gray-800 truncate">${student.name}</p>
                <button class="toggle-absent-btn text-xs px-2 py-1 rounded-full mt-1 ${buttonClass}" tabindex="-1">
                    ${isAbsent ? '<i class="fas fa-user-slash"></i> Absent' : '<i class="fas fa-user-check"></i> Present'}
                </button>
            </div>
            <div class="w-32 grade-input-wrapper">
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
        <button data-view="test" class="toggle-btn active-toggle"><i class="fas fa-file-alt mr-2"></i>Tests</button>
        <button data-view="dictation" class="toggle-btn"><i class="fas fa-microphone-alt mr-2"></i>Dictations</button>
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
        <div class="flex items-center gap-2 bg-amber-100 text-amber-900 px-3 py-1.5 rounded-lg border border-amber-300 shadow-sm opacity-70">
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
                    <div class="flex items-center bg-white border-2 border-amber-300 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                        <div class="bg-amber-100 px-3 py-2 border-r border-amber-200">
                            <i class="fas fa-history text-amber-700"></i>
                        </div>
                        <select id="trial-history-month-select" class="pl-2 pr-8 py-2 bg-transparent text-amber-900 font-bold text-sm outline-none cursor-pointer appearance-none min-w-[140px]">
                            <option value="">Load Past Month...</option>
                            ${historicalMonths.map(m => {
                                const d = new Date(m + '-02');
                                return `<option value="${m}">${d.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</option>`;
                            }).join('')}
                        </select>
                        <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-amber-500 text-xs">
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>
                </div>
            `;

            const select = document.getElementById('trial-history-month-select');
            select.addEventListener('change', async (e) => {
                const monthKey = e.target.value;
                if(!monthKey) return;
                
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

    // 1. Get recent scores from the app's live state (last 2 months)
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    twoMonthsAgo.setDate(1);
    const twoMonthsAgoKey = twoMonthsAgo.toISOString().substring(0, 7);
    
    const recentScores = state.get('allWrittenScores').filter(s => {
        if (!s.date) return false;
        const key = s.date.substring(0, 7); // YYYY-MM
        return s.classId === classId && key >= twoMonthsAgoKey;
    });

    // 2. Combine with any loaded historical scores
    const allScoresForClass = [...recentScores, ...loadedHistoricalScores];
    
    // 3. Remove duplicates to be safe
    const uniqueScores = Array.from(new Map(allScoresForClass.map(item => [item.id, item])).values());
    
    // 4. Filter by the selected view ('test' or 'dictation')
    const scoresToRender = uniqueScores.filter(s => s.type === view);

    // 5. Group and Render
    const scoresByMonth = scoresToRender.reduce((acc, score) => {
        const key = score.date.substring(0, 7); // YYYY-MM
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
        
        const sortedDates = Object.keys(scoresByDate).sort((a,b) => new Date(b) - new Date(a));
        
        let monthScoresHtml = sortedDates.map(date => {
            const dateScoresHtml = scoresByDate[date]
                .sort((a,b) => {
                    const studentA = state.get('allStudents').find(s => s.id === a.studentId)?.name || '';
                    const studentB = state.get('allStudents').find(s => s.id === b.studentId)?.name || '';
                    return studentA.localeCompare(studentB);
                })
                .map(score => renderTrialHistoryItem(score)).join('');
            
            const title = scoresByDate[date][0].title || (view === 'dictation' ? 'Dictation' : 'Test');
            const displayDate = new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

            return `<div class="bg-white/50 rounded-lg p-2 mb-2">
                        <div class="date-group-header flex justify-between items-center">
                            <span>${displayDate}</span>
                            <span class="text-sm font-normal text-gray-500">${title}</span>
                        </div>
                        <div class="space-y-1 mt-1">${dateScoresHtml}</div>
                    </div>`;
        }).join('');

        return `
            <details class="month-group bg-white/30 rounded-lg mb-2" data-month-key="${currentMonthKey}" open>
                <summary class="font-title text-xl text-amber-800 p-3 cursor-pointer hover:bg-white/50 rounded-t-lg transition-colors">${monthName}</summary>
                <div class="p-2">
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

    const scorePercent = score.maxScore ? (score.scoreNumeric / score.maxScore) * 100 : null;
    let scoreDisplay = '';
    if (score.scoreQualitative) {
        scoreDisplay = `<span class="font-title text-lg text-blue-600">${score.scoreQualitative}</span>`;
    } else if (scorePercent !== null) {
        const colorClass = scorePercent >= 80 ? 'text-green-600' : scorePercent >= 60 ? 'text-yellow-600' : 'text-red-600';
        scoreDisplay = `<span class="font-title text-lg ${colorClass}">${scorePercent.toFixed(0)}%</span>`;
    }
    
    const isOwner = score.teacherId === state.get('currentUserId');

    return `
        <div class="trial-history-item flex items-center justify-between p-2 bg-white rounded shadow-sm border-l-2 border-amber-200">
            <span class="font-semibold text-gray-700">${student.name}</span>
            <div class="flex items-center gap-3">
                ${scoreDisplay}
                ${isOwner ? `<button data-trial-id="${score.id}" class="edit-trial-btn text-blue-400 hover:text-blue-600" title="Edit"><i class="fas fa-pencil-alt"></i></button>` : ''}
                ${isOwner ? `<button data-trial-id="${score.id}" class="delete-trial-btn text-red-400 hover:text-red-600" title="Delete"><i class="fas fa-trash-alt"></i></button>` : ''}
            </div>
        </div>
    `;
}

// --- SINGLE EDIT MODAL ---

export function openSingleTrialEditModal(classId, trialId) {
    const score = state.get('allWrittenScores').find(s => s.id === trialId);
    if (!score) return;
    
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const isJunior = classData.questLevel === 'Junior A' || classData.questLevel === 'Junior B';

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
    if(displayEl) displayEl.innerText = `${dd}/${mm}/${yyyy}`;
    
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
        const rowHtml = renderStudentBulkRow(student, score.type, isJunior, false);
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
    modal.dataset.isJunior = isJunior;
    
    const saveBtn = document.getElementById('bulk-trial-save-btn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    modals.showAnimatedModal('bulk-trial-modal');
    document.getElementById('bulk-trial-close-btn').onclick = () => modals.hideModal('bulk-trial-modal');
}


// --- HELPER CALCULATIONS ---

function calculateJuniorTreasureRank(testScores, dictationScores) {
    const dictationMap = { "Great!!!": 4, "Great!!": 3, "Great!": 2, "Nice Try!": 1 };
    const testAvg = testScores.length > 0 ? (testScores.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore), 0) / testScores.length) * 4 : 0;
    const dictationAvg = dictationScores.length > 0 ? dictationScores.reduce((sum, s) => sum + dictationMap[s.scoreQualitative], 0) / dictationScores.length : 0;
    let finalScore;
    if (testScores.length > 0 && dictationScores.length > 0) { finalScore = (testAvg * 0.6) + (dictationAvg * 0.4); } 
    else { finalScore = Math.max(testAvg, dictationAvg); }
    let display = '--';
    if (finalScore > 3.5) display = '💎 Diamond Explorer';
    else if (finalScore > 2.7) display = '👑 Gold Seeker';
    else if (finalScore > 1.8) display = '🏆 Silver Adventurer';
    else if (finalScore > 0) display = '🧭 Bronze Pathfinder';
    return { value: finalScore, display: display };
}

function calculateSeniorAverage(testScores, dictationScores) {
    const testAvg = testScores.length > 0 ? (testScores.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore), 0) / testScores.length) * 100 : 0;
    const dictationAvg = dictationScores.length > 0 ? (dictationScores.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore), 0) / dictationScores.length) * 100 : 0;
    let weightedAvg;
    if (testScores.length > 0 && dictationScores.length > 0) { weightedAvg = (testAvg * 0.6) + (dictationAvg * 0.4); } 
    else { weightedAvg = Math.max(testAvg, dictationAvg); }
    return weightedAvg;
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
    const validAssessments = Object.values(uniqueAssessments).filter(a => a.count >= threshold);

    if (validAssessments.length === 0) return;

    // 2. Find students who missed these
    const missingWork = [];

    validAssessments.forEach(assessment => {
        studentsInClass.forEach(student => {
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

    // 3. Render the list
    let html = `
        <div class="makeup-alert-container">
            <h3 class="font-title text-xl text-orange-700 mb-2"><i class="fas fa-clock mr-2"></i>Pending Makeups</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    `;

    missingWork.forEach(item => {
        html += `
            <div class="makeup-item">
                <div>
                    <div class="font-bold text-gray-800">${item.student.name}</div>
                    <div class="text-xs text-gray-500">Missed: ${item.assessment.title} (${item.assessment.type})</div>
                    <div class="text-xs text-orange-400">Original Date: ${utils.parseDDMMYYYY(item.assessment.originalDate).toLocaleDateString('en-GB')}</div>
                </div>
                <button class="makeup-log-btn makeup-trigger" 
                    data-student-id="${item.student.id}" 
                    data-title="${item.assessment.title}" 
                    data-type="${item.assessment.type}">
                    Log Now
                </button>
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
}

function openMakeupModal(classId, studentId, type, title) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const student = state.get('allStudents').find(s => s.id === studentId);
    const isJunior = classData.questLevel === 'Junior A' || classData.questLevel === 'Junior B';

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
    if(displayEl) displayEl.innerText = `${dd}/${mm}/${yyyy}`;

    // Handle Title Input
    const titleWrapper = document.getElementById('bulk-trial-title-wrapper');
    const titleInput = document.getElementById('bulk-trial-name');
    
    titleWrapper.classList.remove('hidden'); // Always show title for makeup to confirm context
    titleInput.value = title || '';
    
    // Render JUST the one student row
    const listContainer = document.getElementById('bulk-student-list');
    
    // Simplified Row Generation for Makeup
    const avatarHtml = student.avatar 
        ? `<img src="${student.avatar}" class="w-10 h-10 rounded-full object-cover border border-gray-200">`
        : `<div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">${student.name.charAt(0)}</div>`;

    let inputHtml = '';
    if (isJunior && type === 'dictation') {
        inputHtml = `
            <select class="bulk-grade-input w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-400 outline-none">
                <option value="" selected disabled>Select Grade...</option>
                <option value="Great!!!">Great!!!</option>
                <option value="Great!!">Great!!</option>
                <option value="Great!">Great!</option>
                <option value="Nice Try!">Nice Try!</option>
            </select>`;
    } else {
        const maxScore = (isJunior && type === 'test') ? 40 : 100;
        inputHtml = `
            <div class="relative">
                <input type="number" class="bulk-grade-input w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 outline-none" 
                    placeholder="Score" min="0" max="${maxScore}">
                <span class="absolute right-3 top-2 text-gray-400 text-sm">/${maxScore}</span>
            </div>`;
    }

    listContainer.innerHTML = `
        <div class="bulk-log-item bg-white p-3 rounded-xl shadow-sm flex items-center gap-3" data-student-id="${student.id}">
            ${avatarHtml}
            <div class="flex-grow min-w-0">
                <p class="font-bold text-gray-800 truncate">${student.name}</p>
                <span class="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">Taking Makeup</span>
                <!-- Hidden absent button for logic compatibility -->
                <button class="toggle-absent-btn hidden" tabindex="-1"></button>
            </div>
            <div class="w-32 grade-input-wrapper">
                ${inputHtml}
            </div>
        </div>
    `;

    // Set modal datasets for saving
    modal.dataset.classId = classId;
    modal.dataset.type = type;
    modal.dataset.isJunior = isJunior;

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
