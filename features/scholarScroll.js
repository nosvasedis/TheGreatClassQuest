// /features/scholarScroll.js

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
    if (currentVal) classSelect.value = currentVal;
    
    document.getElementById('log-trial-btn').disabled = !currentVal;
    document.getElementById('view-trial-history-btn').disabled = !currentVal;

    if (currentVal) {
        renderScrollDashboard(currentVal);
        document.getElementById('scroll-dashboard-content').classList.remove('hidden');
        document.getElementById('scroll-placeholder').classList.add('hidden');
    } else {
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

// --- MODAL & DATA HANDLING ---

export function openLogTrialModal(classId, trialId = null) {
    if (!classId) return;
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;

    const form = document.getElementById('log-trial-form');
    form.reset();
    form.dataset.editingId = trialId || '';

    document.getElementById('log-trial-class-id').value = classId;
    document.getElementById('log-trial-modal-title').innerText = trialId ? 'Edit Trial Log' : 'Log a New Trial';
    
    const studentSelect = document.getElementById('log-trial-student-select');
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    studentSelect.innerHTML = studentsInClass.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    if (trialId) {
        const score = state.get('allWrittenScores').find(s => s.id === trialId);
        if (score) {
            studentSelect.value = score.studentId;
            document.getElementById('log-trial-date').value = score.date;
            document.getElementById('log-trial-type').value = score.type;
            document.getElementById('log-trial-notes').value = score.notes || '';
            renderLogTrialScoreInput(); // Render inputs before filling them
            if (score.scoreQualitative) {
                document.getElementById('log-trial-score-qualitative').value = score.scoreQualitative;
            } else {
                if (document.getElementById('log-trial-title')) document.getElementById('log-trial-title').value = score.title || '';
                if (document.getElementById('log-trial-score-numeric')) document.getElementById('log-trial-score-numeric').value = score.scoreNumeric;
            }
        }
    } else {
        document.getElementById('log-trial-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('log-trial-type').value = 'dictation'; // Default to Dictation
        renderLogTrialScoreInput();
        const existingScore = state.get('allWrittenScores').find(s => s.classId === classId && s.date === document.getElementById('log-trial-date').value && s.type === 'test' && s.title);
        if (existingScore && document.getElementById('log-trial-title')) {
            document.getElementById('log-trial-title').value = existingScore.title;
        }
    }
    
    modals.showAnimatedModal('log-trial-modal');
}

export function renderLogTrialScoreInput() {
    const container = document.getElementById('log-trial-score-container');
    const classId = document.getElementById('log-trial-class-id').value;
    const trialType = document.getElementById('log-trial-type').value;
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;

    const isJunior = classData.questLevel === 'Junior A' || classData.questLevel === 'Junior B';

    let inputHtml = '';
    if (isJunior && trialType === 'dictation') {
        inputHtml = `
            <label for="log-trial-score-qualitative" class="block text-sm font-medium text-gray-700">Score</label>
            <select id="log-trial-score-qualitative" class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500" required>
                <option value="Great!!!">Great!!! (Excellent)</option>
                <option value="Great!!">Great!!</option>
                <option value="Great!">Great!</option>
                <option value="Nice Try!">Nice Try!</option>
            </select>
        `;
    } else {
        const maxScore = (isJunior && trialType === 'test') ? 40 : 100;
        inputHtml = `
            <div>
                <label for="log-trial-title" class="block text-sm font-medium text-gray-700">Test Title</label>
                <input type="text" id="log-trial-title" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500" placeholder="e.g., Unit 5 Vocabulary Quiz" required>
            </div>
            <div>
                <label for="log-trial-score-numeric" class="block text-sm font-medium text-gray-700">Score (out of ${maxScore})</label>
                <input type="number" id="log-trial-score-numeric" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500" max="${maxScore}" min="0" required>
            </div>
        `;
    }
    container.innerHTML = inputHtml;
}

export async function openTrialHistoryModal(classId) {
    if (!classId) return;
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;

    const modal = document.getElementById('trial-history-modal');
    modal.dataset.classId = classId;
    document.getElementById('trial-history-title').innerHTML = `${classData.logo} Trial History`;
    
    const controlsContainer = document.getElementById('trial-history-controls-container');
    controlsContainer.innerHTML = `
        <div id="trial-history-view-toggle" class="inline-flex items-center bg-white/50 p-1 rounded-full border-2 border-amber-200 shadow-inner">
            <button data-view="test" class="toggle-btn active-toggle"><i class="fas fa-file-alt mr-2"></i>Tests</button>
            <button data-view="dictation" class="toggle-btn"><i class="fas fa-microphone-alt mr-2"></i>Dictations</button>
        </div>
        <div id="trial-history-actions" class="flex items-center gap-2">
            <!-- On-demand load buttons will be inserted here -->
        </div>
    `;

    controlsContainer.querySelector('#trial-history-view-toggle').querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            controlsContainer.querySelector('#trial-history-view-toggle').querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active-toggle'));
            e.currentTarget.classList.add('active-toggle');
            renderTrialHistoryContent(classId, e.currentTarget.dataset.view);
        });
    });
    
    document.getElementById('trial-history-content').addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-trial-btn');
        if (deleteBtn) modals.handleDeleteTrial(deleteBtn.dataset.trialId);
        const editBtn = e.target.closest('.edit-trial-btn');
        if (editBtn) openLogTrialModal(classId, editBtn.dataset.trialId);
    });
    
    renderTrialHistoryContent(classId, 'test');
    modals.showAnimatedModal('trial-history-modal');

    // --- ASYNC PART: Fetch and render historical month buttons ---
    const recentMonthKeys = new Set();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const twoMonthsAgoKey = twoMonthsAgo.toISOString().substring(0, 7);

    const allMonthsSet = await fetchAllTrialMonthsForClass(classId);
    const historicalMonths = [...allMonthsSet].filter(monthKey => monthKey < twoMonthsAgoKey).sort().reverse();
    
    const actionsContainer = controlsContainer.querySelector('#trial-history-actions');
    actionsContainer.innerHTML = historicalMonths.map(monthKey => {
        const monthName = new Date(monthKey + '-02').toLocaleString('en-GB', { month: 'short', year: 'numeric' });
        return `<button data-month="${monthKey}" class="load-month-btn font-title text-sm bg-amber-200 text-amber-800 py-1 px-3 rounded-full bubbly-button transition hover:bg-amber-300 shadow-sm">
                    <i class="fas fa-archive mr-1"></i> Load ${monthName}
                </button>`;
    }).join('');

    actionsContainer.querySelectorAll('.load-month-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const monthKey = btn.dataset.month;
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
            btn.disabled = true;

            const scoresForMonth = await fetchTrialsForMonth(classId, monthKey);
            const activeView = document.querySelector('#trial-history-view-toggle .active-toggle')?.dataset.view || 'test';
            renderTrialHistoryContent(classId, activeView, scoresForMonth, monthKey);

            btn.style.display = 'none';
        });
    });
}

export function renderTrialHistoryContent(classId, view, onDemandScores = null, monthKey = null) {
    const contentEl = document.getElementById('trial-history-content');
    
    let scoresToRender;
    if (onDemandScores) {
        scoresToRender = onDemandScores.filter(s => s.type === view);
    } else {
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        twoMonthsAgo.setDate(1);
        const twoMonthsAgoKey = twoMonthsAgo.toISOString().substring(0, 7);
        
        scoresToRender = state.get('allWrittenScores').filter(s => 
            s.classId === classId && 
            s.type === view &&
            s.date.substring(0, 7) >= twoMonthsAgoKey
        );
    }

    const scoresByMonth = scoresToRender.reduce((acc, score) => {
        const key = score.date.substring(0, 7); // YYYY-MM
        if (!acc[key]) acc[key] = [];
        acc[key].push(score);
        return acc;
    }, {});

    const sortedMonths = Object.keys(scoresByMonth).sort().reverse();

    const newHtml = sortedMonths.map(currentMonthKey => {
        const monthName = new Date(currentMonthKey + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' });
        
        let monthScoresHtml;
        if (view === 'dictation') {
            const scoresByDate = scoresByMonth[currentMonthKey].reduce((acc, score) => {
                if (!acc[score.date]) acc[score.date] = [];
                acc[score.date].push(score);
                return acc;
            }, {});
            const sortedDates = Object.keys(scoresByDate).sort((a,b) => new Date(b) - new Date(a));
            
            monthScoresHtml = sortedDates.map(date => {
                const dateScoresHtml = scoresByDate[date].map(score => renderTrialHistoryItem(score)).join('');
                return `<div class="date-group-header">${new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</div>${dateScoresHtml}`;
            }).join('');
        } else {
            monthScoresHtml = scoresByMonth[currentMonthKey].map(score => renderTrialHistoryItem(score)).join('');
        }

        if (monthScoresHtml.trim() === '') return '';

        return `
            <details class="month-group bg-white/50 rounded-lg" data-month-key="${currentMonthKey}" open>
                <summary class="font-title text-xl text-amber-800 p-3 cursor-pointer">${monthName}</summary>
                <div class="p-2 space-y-2">
                    ${monthScoresHtml}
                </div>
            </details>
        `;
    }).join('');

    if (onDemandScores) {
        if (newHtml.trim() === '') {
            const monthName = new Date(monthKey + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' });
            contentEl.innerHTML += `<div class="text-center text-gray-500 p-4">No ${view}s were recorded in ${monthName}.</div>`;
        } else {
            contentEl.innerHTML += newHtml;
        }
    } else {
        if (newHtml.trim() === '') {
            contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">No recent ${view} records found. Try loading historical data.</p>`;
        } else {
            contentEl.innerHTML = newHtml;
        }
    }
}


function renderTrialHistoryItem(score) {
    const student = state.get('allStudents').find(s => s.id === score.studentId);
    if (!student) return '';

    const scorePercent = score.maxScore ? (score.scoreNumeric / score.maxScore) * 100 : null;
    let scoreDisplay = '';
    if (score.scoreQualitative) {
        scoreDisplay = `<span class="font-title text-xl text-blue-600">${score.scoreQualitative}</span>`;
    } else if (scorePercent !== null) {
        const colorClass = scorePercent >= 80 ? 'text-green-600' : scorePercent >= 60 ? 'text-yellow-600' : 'text-red-600';
        scoreDisplay = `<span class="font-title text-2xl ${colorClass}">${scorePercent.toFixed(0)}%</span>
                        <span class="text-xs text-gray-500">(${score.scoreNumeric}/${score.maxScore})</span>`;
    }
    
    const isOwner = score.teacherId === state.get('currentUserId');

    return `
        <div class="trial-history-item">
            <div class="flex-grow">
                ${score.type === 'test' ? `<p class="text-sm text-gray-500">${new Date(score.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</p>` : ''}
                <p class="font-semibold text-lg text-gray-800">${student.name}</p>
                ${score.title ? `<p class="text-amber-800 font-medium italic">"${score.title}"</p>` : ''}
                ${score.notes ? `<p class="text-xs text-gray-600 mt-1 pl-2 border-l-2 border-gray-300">Note: ${score.notes}</p>` : ''}
            </div>
            <div class="text-right flex-shrink-0 w-24 flex flex-col items-end">
                ${scoreDisplay}
            </div>
            <div class="flex-shrink-0 ml-2 flex flex-col gap-1">
                ${isOwner ? `<button data-trial-id="${score.id}" class="edit-trial-btn bubbly-button bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center" title="Edit Trial Record"><i class="fas fa-pencil-alt"></i></button>` : ''}
                ${isOwner ? `<button data-trial-id="${score.id}" class="delete-trial-btn bubbly-button bg-red-100 text-red-700 w-8 h-8 rounded-full flex items-center justify-center" title="Delete Trial Record"><i class="fas fa-trash-alt"></i></button>` : ''}
            </div>
        </div>
    `;
}

// --- HELPER CALCULATIONS ---

function calculateJuniorTreasureRank(testScores, dictationScores) {
    const dictationMap = { "Great!!!": 4, "Great!!": 3, "Great!": 2, "Nice Try!": 1 };
    
    const testAvg = testScores.length > 0
        ? (testScores.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore), 0) / testScores.length) * 4
        : 0;
    
    const dictationAvg = dictationScores.length > 0
        ? dictationScores.reduce((sum, s) => sum + dictationMap[s.scoreQualitative], 0) / dictationScores.length
        : 0;

    let finalScore;
    if (testScores.length > 0 && dictationScores.length > 0) {
        finalScore = (testAvg * 0.6) + (dictationAvg * 0.4);
    } else {
        finalScore = Math.max(testAvg, dictationAvg);
    }

    let display = '--';
    if (finalScore > 3.5) display = '💎 Diamond Explorer';
    else if (finalScore > 2.7) display = '👑 Gold Seeker';
    else if (finalScore > 1.8) display = '🏆 Silver Adventurer';
    else if (finalScore > 0) display = '🧭 Bronze Pathfinder';
    
    return { value: finalScore, display: display };
}

function calculateSeniorAverage(testScores, dictationScores) {
    const dictationMap = { "Great!!!": 4, "Great!!": 3, "Great!": 2, "Nice Try!": 1 };
    
    const testAvg = testScores.length > 0 
        ? (testScores.reduce((sum, s) => sum + (s.scoreNumeric / s.maxScore), 0) / testScores.length) * 100 
        : 0;
        
    const dictationAvg = dictationScores.length > 0 
        ? (dictationScores.reduce((sum, s) => sum + dictationMap[s.scoreQualitative], 0) / dictationScores.length) 
        : 0;
    
    let weightedAvg;
    if (testScores.length > 0 && dictationScores.length > 0) {
        weightedAvg = (testAvg * 0.6) + ((dictationAvg / 4) * 100 * 0.4);
    } else {
        weightedAvg = Math.max(testAvg, (dictationAvg / 4) * 100);
    }
    return weightedAvg;

}
