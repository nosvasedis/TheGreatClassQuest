// /ui/modals/class.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import { db } from '../../firebase.js';
import { query, collection, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { showAnimatedModal, showModal } from './base.js';
import { fetchLogsForDate } from '../../db/queries.js';
import { ensureHistoryLoaded } from '../../db/actions.js';

// --- ADDED: OVERVIEW MODAL FUNCTIONS ---
export async function openOverviewModal(classId) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classData) return;

    // NEW: Ensure we have the data to calculate stats
    await ensureHistoryLoaded();

    const modal = document.getElementById('overview-modal');
    modal.dataset.classId = classId;
    document.getElementById('overview-modal-title').innerHTML = `${classData.logo} ${classData.name} - Quest Overview`;

    document.querySelectorAll('.overview-tab-btn').forEach(btn => {
        const isDefault = btn.dataset.view === 'class';
        btn.classList.toggle('border-purple-500', isDefault);
        btn.classList.toggle('text-purple-600', isDefault);
        btn.classList.toggle('border-transparent', !isDefault);
        btn.classList.toggle('text-gray-500', !isDefault);
    });

    renderOverviewContent(classId, 'class');
    showAnimatedModal('overview-modal');
}

export function renderOverviewContent(classId, view) {
    const contentEl = document.getElementById('overview-modal-content');
    contentEl.innerHTML = `<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-purple-500"></i><p class="mt-2">Analyzing Quest Logs...</p></div>`;

    const overviewData = generateOverviewData(classId);

    if (view === 'class') {
        renderClassOverview(overviewData);
    } else {
        renderStudentOverview(overviewData);
    }
}

function generateOverviewData(classId) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    const logsForClass = state.get('allAwardLogs').filter(log => log.classId === classId);

    if (logsForClass.length === 0) {
        return { classStats: { noData: true }, studentStats: {}, students: studentsInClass };
    }

    const logsByMonth = logsForClass.reduce((acc, log) => {
        const monthKey = utils.parseDDMMYYYY(log.date).toISOString().substring(0, 7);
        if (!acc[monthKey]) acc[monthKey] = [];
        acc[monthKey].push(log);
        return acc;
    }, {});

    const GOAL_PER_STUDENT = { BRONZE: 4, SILVER: 8, GOLD: 13, DIAMOND: 18 };
    const MILESTONE_NAMES = {
        diamond: "💎 Diamond",
        gold: "👑 Gold",
        silver: "🏆 Silver",
        bronze: "🛡️ Bronze",
        none: "None"
    };

    const monthlyStats = Object.entries(logsByMonth).map(([monthKey, monthLogs]) => {
        const totalStars = monthLogs.reduce((sum, log) => sum + log.stars, 0);
        const diamondGoal = studentsInClass.length > 0 ? Math.round(studentsInClass.length * GOAL_PER_STUDENT.DIAMOND) : 18;
        const progress = diamondGoal > 0 ? Math.min(100, (totalStars / diamondGoal) * 100) : 0;
        
        let milestone = 'none';
        if (totalStars >= studentsInClass.length * GOAL_PER_STUDENT.DIAMOND) milestone = 'diamond';
        else if (totalStars >= studentsInClass.length * GOAL_PER_STUDENT.GOLD) milestone = 'gold';
        else if (totalStars >= studentsInClass.length * GOAL_PER_STUDENT.SILVER) milestone = 'silver';
        else if (totalStars >= studentsInClass.length * GOAL_PER_STUDENT.BRONZE) milestone = 'bronze';

        return { monthKey, totalStars, progress, milestone };
    });

    const bestMonth = monthlyStats.sort((a, b) => b.totalStars - a.totalStars)[0] || null;
    const furthestMilestoneMonth = monthlyStats.sort((a, b) => b.progress - a.progress)[0] || null;

    const allTimeReasonCounts = logsForClass.reduce((acc, log) => {
        if(log.reason) acc[log.reason] = (acc[log.reason] || 0) + log.stars;
        return acc;
    }, {});
    const topReason = Object.entries(allTimeReasonCounts).sort((a,b) => b[1] - a[1])[0] || null;

    const allTimeStudentStars = logsForClass.reduce((acc, log) => {
        acc[log.studentId] = (acc[log.studentId] || 0) + log.stars;
        return acc;
    }, {});
    const topStudents = Object.entries(allTimeStudentStars).sort((a,b) => b[1] - a[1]).slice(0, 3);

    const studentStats = {};
    studentsInClass.forEach(student => {
        const studentLogs = logsForClass.filter(log => log.studentId === student.id);
        if (studentLogs.length === 0) {
            studentStats[student.id] = { noData: true };
            return;
        }
        
        const studentLogsByMonth = studentLogs.reduce((acc, log) => {
            const monthKey = utils.parseDDMMYYYY(log.date).toISOString().substring(0, 7);
            if (!acc[monthKey]) acc[monthKey] = 0;
            acc[monthKey] += log.stars;
            return acc;
        }, {});
        const bestStudentMonth = Object.entries(studentLogsByMonth).sort((a,b) => b[1] - a[1])[0] || null;

        const studentReasonCounts = studentLogs.reduce((acc, log) => {
            if(log.reason) acc[log.reason] = (acc[log.reason] || 0) + log.stars;
            return acc;
        }, {});
        const topStudentReason = Object.entries(studentReasonCounts).sort((a,b) => b[1] - a[1])[0] || null;

        studentStats[student.id] = {
            totalStars: studentLogs.reduce((sum, log) => sum + log.stars, 0),
            bestMonth: bestStudentMonth ? { month: bestStudentMonth[0], stars: bestStudentMonth[1] } : null,
            topReason: topStudentReason ? { reason: topStudentReason[0], stars: topStudentReason[1] } : null
        };
    });

    return {
        classStats: {
            bestMonth: bestMonth ? { month: bestMonth.monthKey, stars: bestMonth.totalStars } : null,
            furthestMilestone: furthestMilestoneMonth ? { month: furthestMilestoneMonth.monthKey, milestone: MILESTONE_NAMES[furthestMilestoneMonth.milestone] } : null,
            topReason: topReason ? { reason: topReason[0], stars: topReason[1] } : null,
            topStudents
        },
        studentStats,
        students: studentsInClass
    };
}

function renderClassOverview(data) {
    const contentEl = document.getElementById('overview-modal-content');
    if (data.classStats.noData) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">Not enough data yet! Award some stars to this class to start seeing insights.</p>`;
        return;
    }

    const { bestMonth, furthestMilestone, topReason, topStudents } = data.classStats;

    const reasonInfo = {
        teamwork: { icon: 'fa-users', color: 'text-purple-500', name: 'Teamwork' },
        creativity: { icon: 'fa-lightbulb', color: 'text-pink-500', name: 'Creativity' },
        respect: { icon: 'fa-hands-helping', color: 'text-green-500', name: 'Respect' },
        focus: { icon: 'fa-brain', color: 'text-yellow-600', name: 'Focus/Effort' },
        welcome_back: { icon: 'fa-hand-sparkles', color: 'text-cyan-500', name: 'Welcome Back' },
        story_weaver: { icon: 'fa-feather-alt', color: 'text-cyan-600', name: 'Story Weaver' },
        scholar_s_bonus: { icon: 'fa-graduation-cap', color: 'text-amber-700', name: 'Scholar\'s Bonus' }
    };

    const bestMonthDisplay = bestMonth ? new Date(bestMonth.month + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' }) : 'N/A';
    const furthestMilestoneDisplay = furthestMilestone ? `${furthestMilestone.milestone} <span class="text-sm font-normal text-gray-500">(in ${new Date(furthestMilestone.month + '-02').toLocaleString('en-GB', { month: 'long' })})</span>` : 'N/A';
    const topReasonDisplay = topReason ? `<i class="fas ${reasonInfo[topReason.reason]?.icon || 'fa-star'} ${reasonInfo[topReason.reason]?.color || 'text-purple-500'} mr-2"></i> ${reasonInfo[topReason.reason]?.name || topReason.reason}` : 'N/A';
    
    const topStudentsHtml = topStudents.length > 0 
        ? topStudents.map((studentEntry, index) => {
            const student = state.get('allStudents').find(s => s.id === studentEntry[0]);
            return `<div class="flex items-center gap-2"><span class="font-bold text-gray-400 w-6">${index+1}.</span> <span class="flex-grow">${student?.name || 'Unknown'}</span> <span class="font-semibold text-purple-600">${studentEntry[1]} ⭐</span></div>`;
        }).join('')
        : 'No stars awarded yet.';

    contentEl.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-calendar-alt mr-2"></i>Best Month</p>
                <p class="font-title text-3xl text-purple-700">${bestMonthDisplay}</p>
                <p class="font-semibold text-lg text-purple-600">${bestMonth?.stars || 0} ⭐ collected</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-route mr-2"></i>Furthest on Quest Map</p>
                <p class="font-title text-3xl text-purple-700">${furthestMilestoneDisplay}</p>
                <p class="font-semibold text-lg text-purple-600">Highest monthly progress</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-award mr-2"></i>All-Time Top Skill</p>
                <p class="font-title text-3xl text-purple-700">${topReasonDisplay}</p>
                <p class="font-semibold text-lg text-purple-600">${topReason?.stars || 0} ⭐ from this skill</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-crown mr-2"></i>All-Time Top Adventurers</p>
                <div class="space-y-1 mt-2 text-lg">
                    ${topStudentsHtml}
                </div>
            </div>
        </div>
    `;
}

function renderStudentOverview(data) {
    const contentEl = document.getElementById('overview-modal-content');
    
    if (data.students.length === 0) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">Add students to this class to see their individual stats.</p>`;
        return;
    }
    
    const studentOptions = data.students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    contentEl.innerHTML = `
        <div class="flex flex-col md:flex-row gap-4">
            <div class="md:w-1/3">
                <label for="overview-student-select" class="block text-sm font-medium text-gray-700 mb-1">Select a Student:</label>
                <select id="overview-student-select" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-lg">
                    ${studentOptions}
                </select>
            </div>
            <div id="overview-student-details" class="flex-grow">
                </div>
        </div>
    `;

    const studentSelect = document.getElementById('overview-student-select');
    studentSelect.addEventListener('change', (e) => {
        renderStudentDetails(data, e.target.value);
    });

    renderStudentDetails(data, studentSelect.value);
}

function renderStudentDetails(data, studentId) {
    const detailsEl = document.getElementById('overview-student-details');
    const studentData = data.studentStats[studentId];

    if (!studentData || studentData.noData) {
        detailsEl.innerHTML = `<div class="h-full flex items-center justify-center bg-gray-50 rounded-lg"><p class="text-gray-500">This student hasn't earned any stars yet.</p></div>`;
        return;
    }

    const { totalStars, bestMonth, topReason } = studentData;

    const reasonInfo = {
        teamwork: { icon: 'fa-users', color: 'text-purple-500', name: 'Teamwork' },
        creativity: { icon: 'fa-lightbulb', color: 'text-pink-500', name: 'Creativity' },
        respect: { icon: 'fa-hands-helping', color: 'text-green-500', name: 'Respect' },
        focus: { icon: 'fa-brain', color: 'text-yellow-600', name: 'Focus/Effort' },
        welcome_back: { icon: 'fa-hand-sparkles', color: 'text-cyan-500', name: 'Welcome Back' },
        story_weaver: { icon: 'fa-feather-alt', color: 'text-cyan-600', name: 'Story Weaver' },
        scholar_s_bonus: { icon: 'fa-graduation-cap', color: 'text-amber-700', name: 'Scholar\'s Bonus' }
    };

    const bestMonthDisplay = bestMonth ? new Date(bestMonth.month + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' }) : 'N/A';
    const topReasonDisplay = topReason ? `<i class="fas ${reasonInfo[topReason.reason]?.icon || 'fa-star'} ${reasonInfo[topReason.reason]?.color || 'text-purple-500'} mr-2"></i> ${reasonInfo[topReason.reason]?.name || topReason.reason}` : 'N/A';

    detailsEl.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-star mr-2"></i>All-Time Stars</p>
                <p class="font-title text-4xl text-purple-700">${totalStars}</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-calendar-alt mr-2"></i>Best Month</p>
                <p class="font-title text-2xl text-purple-700">${bestMonthDisplay}</p>
                <p class="font-semibold text-md text-purple-600">${bestMonth?.stars || 0} ⭐ earned</p>
            </div>
            <div class="overview-stat-card">
                <p class="text-sm font-bold text-purple-800 flex items-center"><i class="fas fa-award mr-2"></i>Top Skill</p>
                <p class="font-title text-2xl text-purple-700">${topReasonDisplay}</p>
                <p class="font-semibold text-md text-purple-600">${topReason?.stars || 0} ⭐ from this skill</p>
            </div>
        </div>
    `;
}
