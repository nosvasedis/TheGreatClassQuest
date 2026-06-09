import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { callGeminiApi } from '../../api.js';
import { getAssessmentValueLabel, getNormalizedPercentForScore, getWeightedAcademicAverage } from '../../features/assessmentConfig.js';
import { showToast } from '../effects.js';
import { hideModal, showAnimatedModal } from './base.js';
import { requireEliteAI } from '../../utils/upgradePrompt.js';
import { canUseFeature } from '../../utils/subscription.js';
import { fetchAllTrialsForClass, fetchAllWrittenScoresForStudent } from '../../db/queries.js';
import {
    buildAnalyticsCsv,
    buildHeatmapData,
    buildRecommendations,
    buildRollingTrend,
    buildSmartAlerts,
    buildSubjectBreakdown,
    calculateImprovementRate,
    calculateParticipationLevel,
    extractTopicWeaknesses,
    getScoreTopicTags,
    predictAssessmentOutcome,
    summarizeGradeBand
} from '../../utils/studentAnalytics.mjs';

const analyticsCache = new Map();
const aiCache = new Map();
const chartRegistry = new Map();
const CACHE_TTL_MS = 120000;

let wired = false;
let subscriptionsBound = false;
let activeStudentId = null;
let activeTrigger = null;
let activeTab = 'overview';
let activeLoadToken = 0;
let activeAiToken = 0;
/** @type {'teacher' | 'student'} */
let activeAudience = 'teacher';
/** When set, analytics use Firestore-backed full trial lists instead of the ~3mo live listener slice. */
let fullHistoryPayload = null;

function getRefs() {
    return {
        modal: document.getElementById('student-analytics-modal'),
        shell: document.querySelector('#student-analytics-modal .student-analytics-shell'),
        closeBtn: document.getElementById('student-analytics-close-btn'),
        name: document.getElementById('analytics-student-name'),
        subtitle: document.getElementById('analytics-student-subtitle'),
        avatar: document.getElementById('analytics-student-avatar'),
        quickGrade: document.getElementById('analytics-quick-grade'),
        quickAttendance: document.getElementById('analytics-quick-attendance'),
        quickRecent: document.getElementById('analytics-quick-recent'),
        quickAvg: document.getElementById('analytics-quick-avg'),
        toolbarStatus: document.getElementById('analytics-toolbar-status'),
        historyHint: document.getElementById('analytics-history-hint'),
        errorBanner: document.getElementById('student-analytics-error-banner')
    };
}

function mergeScoreDocsById(remoteDocs = [], liveDocs = []) {
    const map = new Map();
    remoteDocs.forEach((doc) => {
        if (doc?.id) map.set(doc.id, doc);
    });
    liveDocs.forEach((doc) => {
        if (doc?.id) map.set(doc.id, doc);
    });
    return [...map.values()];
}

function clearCaches() {
    analyticsCache.clear();
    aiCache.clear();
}

function bindStateInvalidation() {
    if (subscriptionsBound) return;
    subscriptionsBound = true;
    state.subscribe(
        ['allWrittenScores', 'allAttendanceRecords', 'allAwardLogs', 'allHeroChronicleNotes', 'allQuestAssignments', 'allStudents'],
        clearCaches
    );
}

function destroyCharts() {
    chartRegistry.forEach((chart) => {
        try {
            chart?.destroy?.();
        } catch (_error) {
            // Ignore chart cleanup failures.
        }
    });
    chartRegistry.clear();
}

function resetAssistantUi() {
    const transcript = document.getElementById('analytics-assistant-transcript');
    const textarea = document.getElementById('analytics-assistant-input');
    if (transcript) {
        transcript.innerHTML = `
            <div class="analytics-chat-bubble analytics-chat-bubble-system">
                Ask a question about the student's progress, request a report, or generate actionable next steps.
            </div>
        `;
    }
    if (textarea) textarea.value = '';
}

function setErrorBanner(message = '') {
    const refs = getRefs();
    if (!refs.errorBanner) return;
    if (!message) {
        refs.errorBanner.classList.add('hidden');
        refs.errorBanner.textContent = '';
        return;
    }
    refs.errorBanner.textContent = message;
    refs.errorBanner.classList.remove('hidden');
}

function setPanelState(panelName, stateName) {
    const panel = document.getElementById(`analytics-panel-${panelName}`);
    if (!panel) return;
    panel.querySelectorAll('[data-panel-state]').forEach((block) => {
        block.classList.toggle('hidden', block.dataset.panelState !== stateName);
    });
}

function setAllPanelsLoading() {
    ['overview', 'performance', 'analysis', 'assistant'].forEach((panel) => setPanelState(panel, 'loading'));
}

function activateTab(nextTab) {
    activeTab = nextTab;
    document.querySelectorAll('.analytics-tab-button').forEach((button) => {
        const isActive = button.dataset.tab === nextTab;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        button.tabIndex = isActive ? 0 : -1;
    });
    document.querySelectorAll('[data-tab-content]').forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.tabContent !== nextTab);
    });
}

function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function formatPercent(value, digits = 1) {
    return Number.isFinite(value) ? `${value.toFixed(digits)}%` : '--';
}

function formatDelta(delta) {
    if (!Number.isFinite(delta)) return '--';
    if (delta > 0) return `+${delta.toFixed(1)} pts`;
    if (delta < 0) return `${delta.toFixed(1)} pts`;
    return '0.0 pts';
}

function formatRelativeTrend(improvement) {
    if (!improvement) return '--';
    if (improvement.trend === 'up') return `${formatDelta(improvement.delta)} improving`;
    if (improvement.trend === 'down') return `${formatDelta(improvement.delta)} decline`;
    return 'Stable pattern';
}

function buildClassSessionDates(student, classScores, classAssignments, classAttendance) {
    const dates = new Set();
    classScores.forEach((score) => {
        if (score.date) dates.add(score.date);
    });
    classAttendance.forEach((record) => {
        if (record.date) dates.add(record.date);
    });
    classAssignments.forEach((assignment) => {
        if (assignment?.testData?.date) dates.add(assignment.testData.date);
    });
    if (!dates.size && student?.createdAt?.toDate) {
        dates.add(utils.getDDMMYYYY(student.createdAt.toDate()));
    }
    return [...dates];
}

function findAssignmentMeta(classAssignments, score) {
    return classAssignments.find((assignment) => {
        if (assignment.classId !== score.classId || !assignment.testData) return false;
        if (!utils.datesMatch(assignment.testData.date, score.date)) return false;
        if (score.type !== 'test') return true;
        return String(assignment.testData.title || '').trim() === String(score.title || '').trim();
    }) || null;
}

function createHistoryEntry(score, classAssignments, classData) {
    const assignment = findAssignmentMeta(classAssignments, score);
    const normalizedPercent = getNormalizedPercentForScore(score, classData);
    const extended = {
        ...score,
        curriculum: assignment?.testData?.curriculum || '',
        normalizedPercent
    };
    return {
        ...extended,
        displayScore: getAssessmentValueLabel(score, classData),
        tags: getScoreTopicTags(extended),
        sortDate: utils.parseFlexibleDate(score.date) || new Date(0)
    };
}

function buildAnalyticsData(studentId) {
    const now = new Date();
    const student = (state.get('allStudents') || []).find((item) => item.id === studentId);
    if (!student) return null;

    // Drop stale full-history batch if switching students mid-session.
    if (fullHistoryPayload && fullHistoryPayload.studentId !== studentId) {
        fullHistoryPayload = null;
    }

    const classData = (state.get('allSchoolClasses') || []).find((item) => item.id === student.classId)
        || (state.get('allTeachersClasses') || []).find((item) => item.id === student.classId)
        || null;

    const allScores = state.get('allWrittenScores') || [];
    const classAssignments = (state.get('allQuestAssignments') || []).filter((assignment) => assignment.classId === student.classId);

    const useFullHistory = fullHistoryPayload && fullHistoryPayload.studentId === studentId;
    const liveStudentDocs = allScores.filter((score) => score.studentId === studentId);
    const liveClassDocs = allScores.filter((score) => score.classId === student.classId);
    let studentScoreDocs = liveStudentDocs;
    let classScoreDocs = liveClassDocs;
    if (useFullHistory) {
        studentScoreDocs = mergeScoreDocsById(fullHistoryPayload.studentScores, liveStudentDocs);
        classScoreDocs = mergeScoreDocsById(fullHistoryPayload.classScores, liveClassDocs);
    }

    const studentScores = studentScoreDocs
        .map((score) => createHistoryEntry(score, classAssignments, classData))
        .filter((entry) => Number.isFinite(entry.normalizedPercent))
        .sort((left, right) => left.sortDate - right.sortDate);
    const classScores = classScoreDocs
        .map((score) => createHistoryEntry(score, classAssignments, classData))
        .filter((entry) => Number.isFinite(entry.normalizedPercent));

    const attendanceRecords = (state.get('allAttendanceRecords') || []).filter((record) => record.classId === student.classId);
    const studentAbsences = attendanceRecords.filter((record) => record.studentId === studentId);
    const classSessionDates = buildClassSessionDates(student, classScores, classAssignments, attendanceRecords);
    const uniqueAbsenceDates = new Set(studentAbsences.map((record) => record.date).filter(Boolean));
    const attendancePercent = classSessionDates.length
        ? Math.max(0, ((classSessionDates.length - uniqueAbsenceDates.size) / classSessionDates.length) * 100)
        : null;

    const awardLogs = (state.get('allAwardLogs') || []).filter((log) => log.studentId === studentId);
    const notes = (state.get('allHeroChronicleNotes') || []).filter((note) => note.studentId === studentId);
    const testScoresRaw = studentScoreDocs.filter((score) => score.studentId === studentId && score.type === 'test');
    const dictationScoresRaw = studentScoreDocs.filter((score) => score.studentId === studentId && score.type === 'dictation');
    const currentAverage = getWeightedAcademicAverage(testScoresRaw, dictationScoresRaw, classData);
    const trend = buildRollingTrend(studentScores, 6, now);
    const improvement = calculateImprovementRate(studentScores);
    const participation = calculateParticipationLevel({
        awardCount: awardLogs.length,
        noteCount: notes.length,
        assessmentCount: studentScores.length,
        attendanceRate: attendancePercent
    });
    const subjectBreakdown = buildSubjectBreakdown(
        studentScores,
        classScores.filter((score) => score.studentId !== studentId)
    );
    const weakTopics = extractTopicWeaknesses(studentScores, 4);
    const prediction = predictAssessmentOutcome(studentScores, attendancePercent);
    const alerts = buildSmartAlerts({ scores: studentScores, attendanceRate: attendancePercent, weakTopics });
    const recommendations = buildRecommendations({
        scores: studentScores,
        attendanceRate: attendancePercent,
        participationLevel: participation,
        weakTopics,
        prediction
    });
    const heatmap = buildHeatmapData(studentScores, studentAbsences, now);
    const strengths = [...subjectBreakdown].sort((left, right) => right.studentAverage - left.studentAverage).slice(0, 3);
    const areasForGrowth = weakTopics.slice(0, 3);
    const latestScores = studentScores.slice(-4).map((entry) => entry.normalizedPercent);
    const averageScore = latestScores.length
        ? latestScores.reduce((sum, value) => sum + value, 0) / latestScores.length
        : currentAverage;

    return {
        student,
        classData,
        scores: studentScores,
        classScores,
        awardLogs,
        notes,
        attendancePercent,
        totalSessions: classSessionDates.length,
        absences: uniqueAbsenceDates.size,
        currentAverage,
        currentGrade: summarizeGradeBand(currentAverage),
        trend,
        improvement,
        participation,
        subjectBreakdown,
        weakTopics,
        prediction,
        alerts,
        recommendations,
        heatmap,
        strengths,
        areasForGrowth,
        averageScore,
        hasEnoughHistory: studentScores.length > 0,
        canDeepAnalyze: studentScores.length >= 2,
        fullHistoryLoaded: Boolean(useFullHistory)
    };
}

async function loadAnalyticsData(studentId, skipCache = false) {
    if (!skipCache) {
        const cached = analyticsCache.get(studentId);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
            return cached.data;
        }
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    const data = buildAnalyticsData(studentId);
    analyticsCache.set(studentId, { timestamp: Date.now(), data });
    return data;
}

function renderAvatar(student) {
    const refs = getRefs();
    if (!refs.avatar) return;
    if (student?.avatar) {
        refs.avatar.innerHTML = `<img src="${student.avatar}" alt="${student.name}" class="w-full h-full object-cover">`;
    } else {
        refs.avatar.innerHTML = `<div class="w-full h-full flex items-center justify-center text-2xl font-bold text-indigo-600 bg-indigo-50">${(student?.name || '?').charAt(0)}</div>`;
    }
}

function renderHistoryHint(data) {
    const refs = getRefs();
    if (!refs.historyHint) return;
    refs.historyHint.classList.remove('hidden');
    if (activeAudience === 'student') {
        refs.historyHint.textContent = data.fullHistoryLoaded
            ? `Full history`
            : `Recent sync`;
        return;
    }
    refs.historyHint.textContent = data.fullHistoryLoaded
        ? `Complete history`
        : `Recent sync`;
}

function applyAudienceChrome(audience) {
    activeAudience = audience;
    const shell = document.querySelector('#student-analytics-modal .student-analytics-shell');
    if (shell) {
        shell.classList.toggle('student-analytics-shell--student', audience === 'student');
    }
    const toolbar = document.getElementById('student-analytics-toolbar');
    if (toolbar) toolbar.hidden = audience === 'student';
    const loadWrap = document.getElementById('student-analytics-load-full-history-wrap');
    if (loadWrap) loadWrap.hidden = audience === 'student';
    if (audience === 'student') {
        activateTab('overview');
    }
}

async function handleLoadFullHistory() {
    if (!activeStudentId || activeAudience === 'student') return;
    const btn = document.getElementById('student-analytics-load-full-history-btn');
    const statusEl = document.getElementById('analytics-full-history-status');
    const student = (state.get('allStudents') || []).find((item) => item.id === activeStudentId);
    if (!student?.classId) {
        showToast('Could not determine class for this student.', 'error');
        return;
    }
    const originalHtml = btn?.innerHTML;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Loading…</span>';
    }
    if (statusEl) statusEl.textContent = '';

    try {
        const [studentDocs, classDocs] = await Promise.all([
            fetchAllWrittenScoresForStudent(activeStudentId),
            fetchAllTrialsForClass(student.classId)
        ]);
        fullHistoryPayload = {
            studentId: activeStudentId,
            studentScores: studentDocs,
            classScores: classDocs
        };
        aiCache.clear();
        analyticsCache.delete(activeStudentId);
        destroyCharts();
        const data = await loadAnalyticsData(activeStudentId, true);
        if (!data || activeStudentId !== data.student.id) return;
        renderHeader(data);
        renderOverview(data);
        renderPerformance(data);
        renderAnalysis(data);
        renderAssistant(data);
        if (statusEl) {
            statusEl.textContent = `Loaded ${studentDocs.length} assessments.`;
        }
        showToast('Full assessment history is ready.', 'success');
    } catch (error) {
        console.error('Load full assessment history failed:', error);
        showToast('Could not load full history. Try again.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml || '<i class="fas fa-cloud-download-alt"></i><span>Load full history</span>';
        }
    }
}

function renderHeader(data) {
    const refs = getRefs();
    refs.name.textContent = data.student.name;
    const classLine = `${data.classData?.logo || ''} ${data.classData?.name || 'Class'}`.trim();
    refs.subtitle.textContent = activeAudience === 'student'
        ? (classLine || 'Your progress')
        : `${classLine || 'Class'} · ${data.scores.length} assessments`;
    refs.quickGrade.textContent = Number.isFinite(data.currentAverage) ? `${data.currentGrade} · ${data.currentAverage.toFixed(1)}%` : data.currentGrade;
    refs.quickAttendance.textContent = formatPercent(data.attendancePercent, 0);
    refs.quickRecent.textContent = formatRelativeTrend(data.improvement);
    refs.quickAvg.textContent = formatPercent(data.averageScore, 1);
    if (refs.toolbarStatus) {
        refs.toolbarStatus.textContent = activeAudience === 'teacher'
            ? (data.fullHistoryLoaded
                ? `Complete history · ${data.scores.length} assessments`
                : `Recent sync · ${data.scores.length} assessments (~last 3 months)`)
            : '';
    }
    renderHistoryHint(data);
    renderAvatar(data.student);
}

function renderOverview(data) {
    if (!data.hasEnoughHistory) {
        setPanelState('overview', 'empty');
        return;
    }
    const root = document.getElementById('analytics-overview-content');
    if (!root) return;
    const isStudent = activeAudience === 'student';
    root.innerHTML = `
        <div class="analytics-grid analytics-grid-2col gap-6">
            <section class="analytics-card sa-card bg-gradient-to-br from-white to-violet-50/50 p-6 rounded-[2rem] border-2 border-violet-100 shadow-sm transition-transform hover:scale-[1.01] flex flex-col h-full min-h-[400px]">
                <div class="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-violet-100/50 pb-4 shrink-0">
                    <div class="flex items-center gap-4 min-w-0">
                        <div class="w-12 h-12 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0"><i class="fas fa-chart-line"></i></div>
                        <div class="min-w-0">
                            <span class="text-xs font-bold text-violet-500 uppercase tracking-wider block truncate">${isStudent ? 'Recent scores' : 'Six-month trend'}</span>
                            <h3 class="font-title text-2xl text-violet-900 leading-tight truncate">${isStudent ? 'How your scores move' : 'Performance over time'}</h3>
                        </div>
                    </div>
                    <span class="bg-white border-2 border-violet-100 text-violet-700 px-3 py-1 rounded-full text-sm font-bold shadow-sm whitespace-nowrap shrink-0">${formatRelativeTrend(data.improvement)}</span>
                </div>
                <div class="flex-1 relative min-h-[250px] w-full">
                    <canvas id="analytics-overview-trend-chart" aria-label="Performance trend"></canvas>
                </div>
            </section>
            
            <section class="analytics-card sa-card bg-gradient-to-br from-white to-blue-50/50 p-6 rounded-[2rem] border-2 border-blue-100 shadow-sm transition-transform hover:scale-[1.01] flex flex-col h-full">
                <div class="flex items-center gap-4 mb-6 border-b border-blue-100/50 pb-4 shrink-0">
                    <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0"><i class="fas fa-search-plus"></i></div>
                    <div class="min-w-0">
                        <span class="text-xs font-bold text-blue-500 uppercase tracking-wider block truncate">${isStudent ? 'Snapshot' : 'Quick read'}</span>
                        <h3 class="font-title text-2xl text-blue-900 leading-tight truncate">${isStudent ? 'Highlights for you' : 'Summary for planning'}</h3>
                    </div>
                </div>
                <div class="grid grid-cols-1 gap-3 flex-1 overflow-y-auto pr-2 scrollbar-custom">
                    <div class="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-indigo-200 transition-colors">
                        <div class="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center text-lg shrink-0"><i class="fas fa-bullseye"></i></div>
                        <div class="min-w-0"><p class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate">${isStudent ? 'Average score' : 'Average score'}</p><p class="font-title text-xl text-gray-800 truncate">${formatPercent(data.averageScore, 1)}</p></div>
                    </div>
                    <div class="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-emerald-200 transition-colors">
                        <div class="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-lg shrink-0"><i class="fas fa-arrow-trend-up"></i></div>
                        <div class="min-w-0"><p class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate">${isStudent ? 'Likely next band' : 'Outlook'}</p><p class="font-title text-xl text-gray-800 truncate">${data.prediction.predictedScore !== null ? `${data.prediction.band} <span class="text-sm text-gray-500">(${data.prediction.predictedScore}%)</span>` : data.prediction.band}</p></div>
                    </div>
                    <div class="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-amber-200 transition-colors">
                        <div class="w-10 h-10 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center text-lg shrink-0"><i class="fas fa-star"></i></div>
                        <div class="min-w-0"><p class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate">${isStudent ? 'Bright spot' : 'Strength'}</p><p class="font-title text-xl text-gray-800 truncate">${data.strengths[0] ? `${data.strengths[0].label} <span class="text-sm text-gray-500">(${data.strengths[0].studentAverage}%)</span>` : (isStudent ? 'Collecting data!' : 'Need more data')}</p></div>
                    </div>
                    <div class="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-rose-200 transition-colors">
                        <div class="w-10 h-10 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center text-lg shrink-0"><i class="fas fa-dumbbell"></i></div>
                        <div class="min-w-0"><p class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate">${isStudent ? 'Extra practice' : 'Support focus'}</p><p class="font-title text-xl text-gray-800 truncate">${data.areasForGrowth[0] ? `${data.areasForGrowth[0].label} <span class="text-sm text-gray-500">(${data.areasForGrowth[0].average}%)</span>` : (isStudent ? 'Nothing urgent!' : 'No urgent concerns')}</p></div>
                    </div>
                </div>
            </section>
        </div>
    `;
    setPanelState('overview', 'ready');

    const canvas = document.getElementById('analytics-overview-trend-chart');
    if (canvas && window.Chart) {
        const chart = new window.Chart(canvas, {
            type: 'line',
            data: {
                labels: data.trend.map((entry) => entry.label),
                datasets: [{
                    label: 'Average score',
                    data: data.trend.map((entry) => entry.value),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.12)',
                    tension: 0.35,
                    fill: true,
                    spanGaps: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                    y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%`, color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
                }
            }
        });
        chartRegistry.set('overviewTrend', chart);
    }
}

function renderPerformance(data) {
    if (!data.canDeepAnalyze) {
        setPanelState('performance', data.hasEnoughHistory ? 'ready' : 'empty');
    }
    const root = document.getElementById('analytics-performance-content');
    if (!root) return;
    const isStudent = activeAudience === 'student';
    const tableRows = data.scores
        .slice()
        .sort((left, right) => right.sortDate - left.sortDate)
        .map((entry) => {
            const typeIcon = entry.type?.toLowerCase().includes('dict') ? 'fa-pen-fancy text-emerald-500' : 'fa-file-lines text-blue-500';
            const scoreColor = entry.normalizedPercent >= 85 ? 'bg-emerald-100 text-emerald-800' : (entry.normalizedPercent >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800');
            return `
            <tr class="hover:bg-indigo-50/50 transition-colors group border-b border-gray-100 last:border-0">
                <td class="p-4 text-sm font-semibold text-gray-600 whitespace-nowrap">${entry.date || '--'}</td>
                <td class="p-4 text-sm whitespace-nowrap"><span class="flex items-center gap-2 font-bold text-gray-700"><i class="fas ${typeIcon} bg-white shadow-sm w-8 h-8 rounded-full flex items-center justify-center"></i> ${entry.type || '--'}</span></td>
                <td class="p-4 text-sm font-medium text-gray-800">${entry.title || 'Assessment'}</td>
                <td class="p-4 text-sm font-bold text-gray-700">${entry.displayScore || '--'}</td>
                <td class="p-4 text-sm whitespace-nowrap"><span class="px-3 py-1 rounded-full font-bold text-xs shadow-sm ${scoreColor}">${formatPercent(entry.normalizedPercent, 1)}</span></td>
                <td class="p-4 text-sm"><div class="flex flex-wrap gap-1">${(entry.tags || []).map((tag) => `<span class="bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider">${tag}</span>`).join('') || '<span class="text-gray-400 italic text-xs">General</span>'}</div></td>
            </tr>
            `;
        })
        .join('');
    const heatmapCells = data.heatmap.map((cell) => `
        <button type="button"
            class="analytics-heatmap-cell"
            style="--heat:${cell.intensity};"
            title="${cell.label}: ${cell.assessments} assessments, ${cell.averageScore === null ? 'no score' : `${cell.averageScore}% avg`}">
            <span class="sr-only">${cell.label} week ${cell.weekIndex + 1}</span>
        </button>
    `).join('');

    root.innerHTML = `
        <div class="analytics-grid analytics-grid-2col gap-6 mb-6">
            <section class="analytics-card sa-card bg-gradient-to-br from-white to-indigo-50/50 p-6 rounded-[2rem] border-2 border-indigo-100 shadow-sm transition-transform hover:scale-[1.01] flex flex-col h-full min-h-[400px]">
                <div class="flex items-center gap-4 mb-6 border-b border-indigo-100/50 pb-4 shrink-0">
                    <div class="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0"><i class="fas fa-chart-column"></i></div>
                    <div class="min-w-0">
                        <span class="text-xs font-bold text-indigo-500 uppercase tracking-wider block truncate">${isStudent ? 'By topic' : 'Topic comparison'}</span>
                        <h3 class="font-title text-2xl text-indigo-900 leading-tight truncate">${isStudent ? 'You and your class' : 'Student vs class average'}</h3>
                    </div>
                </div>
                <div class="flex-1 relative min-h-[250px] w-full">
                    <canvas id="analytics-performance-bar-chart" aria-label="Topic scores compared to class"></canvas>
                </div>
            </section>
            
            <section class="analytics-card sa-card bg-gradient-to-br from-white to-orange-50/50 p-6 rounded-[2rem] border-2 border-orange-100 shadow-sm transition-transform hover:scale-[1.01] flex flex-col h-full">
                <div class="flex items-center gap-4 mb-6 border-b border-orange-100/50 pb-4 shrink-0">
                    <div class="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0"><i class="fas fa-calendar-days"></i></div>
                    <div class="min-w-0">
                        <span class="text-xs font-bold text-orange-500 uppercase tracking-wider block truncate">${isStudent ? 'Rhythm' : 'Activity map'}</span>
                        <h3 class="font-title text-2xl text-orange-900 leading-tight truncate">${isStudent ? 'When assessments happen' : 'Assessment pattern over time'}</h3>
                    </div>
                </div>
                <div class="analytics-heatmap-grid flex-1">
                    ${heatmapCells}
                </div>
                <p class="mt-4 text-xs font-bold text-orange-700/60 bg-orange-100/50 px-3 py-2 rounded-xl shrink-0"><i class="fas fa-info-circle mr-1"></i> ${isStudent ? 'Darker squares mean more activity on those days.' : 'Darker cells show heavier assessment activity and score intensity (last 12 weeks).'}</p>
            </section>
        </div>
        
        <section class="analytics-card sa-card bg-white p-6 rounded-[2rem] border-2 border-gray-100 shadow-sm transition-transform hover:scale-[1.01]">
            <div class="flex items-center gap-4 mb-6 border-b border-gray-100 pb-4">
                <div class="w-12 h-12 bg-gray-100 text-gray-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0"><i class="fas fa-list"></i></div>
                <div class="min-w-0">
                    <span class="text-xs font-bold text-gray-500 uppercase tracking-wider block truncate">${isStudent ? 'Your log' : 'Assessment history'}</span>
                    <h3 class="font-title text-2xl text-gray-900 leading-tight truncate">${isStudent ? 'Tests & dictations' : 'Tests and dictations'}</h3>
                </div>
            </div>
            <div class="overflow-x-auto rounded-xl border border-gray-200">
                <table class="w-full text-left border-collapse min-w-[600px]">
                    <thead class="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th class="p-3 font-title text-gray-700 text-sm">Date</th>
                            <th class="p-3 font-title text-gray-700 text-sm">Type</th>
                            <th class="p-3 font-title text-gray-700 text-sm">Title</th>
                            <th class="p-3 font-title text-gray-700 text-sm">Score</th>
                            <th class="p-3 font-title text-gray-700 text-sm">Score %</th>
                            <th class="p-3 font-title text-gray-700 text-sm">Topics</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        </section>
    `;
    setPanelState('performance', data.hasEnoughHistory ? 'ready' : 'empty');

    const canvas = document.getElementById('analytics-performance-bar-chart');
    if (canvas && window.Chart && data.subjectBreakdown.length > 0) {
        const chart = new window.Chart(canvas, {
            type: 'bar',
            data: {
                labels: data.subjectBreakdown.map((entry) => entry.label),
                datasets: [
                    {
                        label: activeAudience === 'student' ? 'You' : 'Student',
                        data: data.subjectBreakdown.map((entry) => entry.studentAverage),
                        backgroundColor: '#8b5cf6'
                    },
                    {
                        label: 'Class average',
                        data: data.subjectBreakdown.map((entry) => entry.classAverage),
                        backgroundColor: '#ddd6fe'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#e2e8f0' } }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                    y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%`, color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
                }
            }
        });
        chartRegistry.set('performanceBars', chart);
    }
}

function renderAnalysis(data) {
    if (!data.hasEnoughHistory) {
        setPanelState('analysis', 'empty');
        return;
    }
    if (activeAudience === 'student') {
        const root = document.getElementById('analytics-analysis-content');
        if (root) {
            root.innerHTML = `
                <div class="sa-card sa-student-nudge">
                    <p class="sa-student-nudge-text">Your teacher uses this space for planning and coaching. If you want to talk through these numbers, ask them in class — they’re here to help.</p>
                </div>`;
        }
        setPanelState('analysis', 'ready');
        return;
    }
    const hasEliteAi = canUseFeature('eliteAI');
    const root = document.getElementById('analytics-analysis-content');
    if (!root) return;
    const strengthsHtml = data.strengths.length
        ? data.strengths.map((item) => `<li class="flex items-center gap-2"><i class="fas fa-check text-emerald-500"></i> <span class="flex-1">${item.label}</span> <strong class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">${item.studentAverage}%</strong></li>`).join('')
        : '<li class="text-gray-500 italic">Need more data to identify strengths.</li>';
    const growthHtml = data.areasForGrowth.length
        ? data.areasForGrowth.map((item) => `<li class="flex items-center gap-2"><i class="fas fa-arrow-up text-rose-500"></i> <span class="flex-1">${item.label}</span> <strong class="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">${item.average}%</strong></li>`).join('')
        : '<li class="text-gray-500 italic">No urgent areas detected.</li>';
    const alertsHtml = data.alerts.map((alert) => `
        <article class="flex items-start gap-4 p-4 rounded-2xl border ${alert.severity === 'high' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'} mb-3 shadow-sm hover:-translate-y-0.5 transition-transform">
            <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${alert.severity === 'high' ? 'bg-red-100 text-red-500' : 'bg-orange-100 text-orange-500'}">
                <i class="fas ${alert.severity === 'high' ? 'fa-exclamation-triangle' : 'fa-bell'}"></i>
            </div>
            <div>
                <h4 class="font-bold ${alert.severity === 'high' ? 'text-red-900' : 'text-orange-900'} mb-1">${alert.title}</h4>
                <p class="text-sm ${alert.severity === 'high' ? 'text-red-700' : 'text-orange-700'} leading-relaxed">${alert.message}</p>
            </div>
        </article>
    `).join('');
    const recommendationsHtml = data.recommendations.map((item) => `
        <article class="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:border-indigo-200 hover:-translate-y-0.5 transition-all mb-3">
            <span class="inline-block bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-lg mb-3">${item.type}</span>
            <h4 class="font-title text-xl text-gray-800 mb-2">${item.title}</h4>
            <p class="text-sm text-gray-600 leading-relaxed">${item.description}</p>
        </article>
    `).join('');

    root.innerHTML = `
        <div class="analytics-grid analytics-grid-2col gap-6 mb-6">
            <section class="analytics-card sa-card bg-gradient-to-br from-white to-amber-50/50 p-6 rounded-[2rem] border-2 border-amber-100 shadow-sm transition-transform hover:scale-[1.01] flex flex-col h-full">
                <div class="flex items-center justify-between gap-4 mb-6 border-b border-amber-100/50 pb-4">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0"><i class="fas fa-eye"></i></div>
                        <div>
                            <span class="text-xs font-bold text-amber-500 uppercase tracking-wider block">Looking ahead</span>
                            <h3 class="font-title text-2xl text-amber-900 leading-tight">Next assessment outlook</h3>
                        </div>
                    </div>
                    <span class="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap"><i class="fas fa-check-circle mr-1"></i> ${data.prediction.confidence} conf</span>
                </div>
                <div class="flex-1 text-center py-6">
                    <div class="font-title text-6xl text-amber-500 mb-2 drop-shadow-sm">${data.prediction.predictedScore !== null ? `${data.prediction.predictedScore}%` : '--'}</div>
                    <p class="text-xl font-bold text-amber-900 mb-4">${data.prediction.band}</p>
                    <p class="text-gray-600">${data.prediction.rationale}</p>
                </div>
            </section>
            
            <section class="analytics-card sa-card bg-gradient-to-br from-white to-emerald-50/50 p-6 rounded-[2rem] border-2 border-emerald-100 shadow-sm transition-transform hover:scale-[1.01] flex flex-col h-full">
                <div class="flex items-center gap-4 mb-6 border-b border-emerald-100/50 pb-4">
                    <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0"><i class="fas fa-balance-scale"></i></div>
                    <div>
                        <span class="text-xs font-bold text-emerald-500 uppercase tracking-wider block">Strengths & gaps</span>
                        <h3 class="font-title text-2xl text-emerald-900 leading-tight">Where to cheer & coach</h3>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-6 flex-1">
                    <div class="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
                        <h4 class="font-bold text-gray-700 mb-3 flex items-center gap-2"><i class="fas fa-star text-yellow-400"></i> Top strengths</h4>
                        <ul class="space-y-3 text-sm text-gray-600">${strengthsHtml}</ul>
                    </div>
                    <div class="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
                        <h4 class="font-bold text-gray-700 mb-3 flex items-center gap-2"><i class="fas fa-arrow-trend-up text-rose-400"></i> Growth areas</h4>
                        <ul class="space-y-3 text-sm text-gray-600">${growthHtml}</ul>
                    </div>
                </div>
            </section>
        </div>
        
        <div class="analytics-grid analytics-grid-2col gap-6 mb-6">
            <section class="analytics-card sa-card bg-gradient-to-br from-white to-red-50/30 p-6 rounded-[2rem] border-2 border-red-100 shadow-sm transition-transform hover:scale-[1.01] flex flex-col h-full">
                <div class="flex items-center gap-4 mb-6 border-b border-red-100/50 pb-4">
                    <div class="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0"><i class="fas fa-exclamation-circle"></i></div>
                    <div>
                        <span class="text-xs font-bold text-red-500 uppercase tracking-wider block">Heads-up</span>
                        <h3 class="font-title text-2xl text-red-900 leading-tight">Patterns worth noticing</h3>
                    </div>
                </div>
                <div class="flex-1">${alertsHtml || '<p class="text-gray-500 italic text-center py-6">No active alerts detected.</p>'}</div>
            </section>
            
            <section class="analytics-card sa-card bg-gradient-to-br from-white to-indigo-50/30 p-6 rounded-[2rem] border-2 border-indigo-100 shadow-sm transition-transform hover:scale-[1.01] flex flex-col h-full">
                <div class="flex items-center gap-4 mb-6 border-b border-indigo-100/50 pb-4">
                    <div class="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0"><i class="fas fa-lightbulb"></i></div>
                    <div>
                        <span class="text-xs font-bold text-indigo-500 uppercase tracking-wider block">Ideas</span>
                        <h3 class="font-title text-2xl text-indigo-900 leading-tight">Next steps to try</h3>
                    </div>
                </div>
                <div class="flex-1">${recommendationsHtml || '<p class="text-gray-500 italic text-center py-6">Collect more data for ideas.</p>'}</div>
            </section>
        </div>
        
        <section class="analytics-card sa-card bg-gradient-to-br from-white to-purple-50/50 p-6 rounded-[2rem] border-2 border-purple-100 shadow-sm transition-transform hover:scale-[1.01]">
            <div class="flex items-center gap-4 mb-6 border-b border-purple-100/50 pb-4">
                <div class="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0"><i class="fas fa-robot"></i></div>
                <div>
                    <span class="text-xs font-bold text-purple-500 uppercase tracking-wider block">AI summary</span>
                    <h3 class="font-title text-2xl text-purple-900 leading-tight">Narrative overview</h3>
                </div>
            </div>
            ${hasEliteAi
                ? `<div id="analytics-ai-summary-output" class="p-4 bg-white rounded-xl shadow-sm border border-purple-100 min-h-[100px]"><p class="text-indigo-500 font-bold flex items-center gap-2"><i class="fas fa-circle-notch fa-spin"></i> Generating strengths and improvement summary...</p></div>`
                : `<div class="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
                        <div class="w-16 h-16 bg-gray-200 text-gray-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"><i class="fas fa-lock"></i></div>
                        <p class="text-gray-600 mb-4 max-w-md mx-auto">Upgrade to Elite to unlock AI-generated strengths, improvement narratives, and personalized study recommendations.</p>
                        <button id="analytics-analysis-inline-upgrade-btn" type="button" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-full shadow-md transition-colors">Unlock Elite AI</button>
                   </div>`}
        </section>
    `;
    setPanelState('analysis', 'ready');
    if (hasEliteAi) {
        void hydrateAiSummary(data);
    }
}

function renderAssistant(data) {
    if (activeAudience === 'student') {
        const root = document.getElementById('analytics-assistant-content');
        if (root) {
            root.innerHTML = `
                <div class="sa-card sa-student-nudge">
                    <p class="sa-student-nudge-text">Teachers use this assistant to plan next steps for you. Questions? Ask your teacher — they’re happy to help.</p>
                </div>`;
        }
        setPanelState('assistant', 'ready');
        return;
    }
    const hasEliteAi = canUseFeature('eliteAI');
    if (!data.hasEnoughHistory) {
        setPanelState('assistant', hasEliteAi ? 'empty' : 'locked');
        return;
    }
    if (!hasEliteAi) {
        setPanelState('assistant', 'locked');
        return;
    }
    const root = document.getElementById('analytics-assistant-content');
    if (!root) return;
    root.innerHTML = `
        <div class="analytics-grid analytics-grid-2col gap-6">
            <section class="analytics-card sa-card bg-gradient-to-br from-white to-indigo-50/50 p-6 rounded-[2rem] border-2 border-indigo-100 shadow-sm flex flex-col h-full min-h-[500px]">
                <div class="flex items-center gap-4 mb-6 border-b border-indigo-100/50 pb-4 shrink-0">
                    <div class="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0"><i class="fas fa-comments"></i></div>
                    <div>
                        <span class="text-xs font-bold text-indigo-500 uppercase tracking-wider block">Chat</span>
                        <h3 class="font-title text-2xl text-indigo-900 leading-tight">Ask the teaching assistant</h3>
                    </div>
                </div>
                <div id="analytics-assistant-transcript" class="flex-1 overflow-y-auto pr-2 space-y-4 mb-4 scrollbar-custom"></div>
                <div class="bg-white rounded-2xl border-2 border-indigo-100 p-2 shadow-inner shrink-0 flex items-end gap-2">
                    <textarea id="analytics-assistant-input" rows="2" class="w-full bg-transparent border-none focus:ring-0 text-gray-700 placeholder-gray-400 resize-none px-2 py-1 text-sm outline-none" placeholder="Ask about trends, weak points, or next steps..."></textarea>
                    <button id="analytics-assistant-send-btn" type="button" class="bg-indigo-600 hover:bg-indigo-700 text-white w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform hover:scale-105 shadow-sm">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </section>
            
            <section class="analytics-card sa-card bg-gradient-to-br from-white to-purple-50/50 p-6 rounded-[2rem] border-2 border-purple-100 shadow-sm flex flex-col h-full">
                <div class="flex items-center gap-4 mb-6 border-b border-purple-100/50 pb-4 shrink-0">
                    <div class="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center text-xl shadow-inner shrink-0"><i class="fas fa-bolt"></i></div>
                    <div>
                        <span class="text-xs font-bold text-purple-500 uppercase tracking-wider block">Shortcuts</span>
                        <h3 class="font-title text-2xl text-purple-900 leading-tight">Ready-made prompts</h3>
                    </div>
                </div>
                <div class="grid grid-cols-1 gap-2 mb-6">
                    <button type="button" class="analytics-quick-prompt text-left bg-white border border-purple-100 hover:border-purple-300 hover:bg-purple-50 p-3 rounded-xl shadow-sm transition-all text-sm font-semibold text-purple-800 flex items-center gap-3" data-prompt-type="report"><i class="fas fa-file-alt text-purple-400"></i> Generate parent-teacher report</button>
                    <button type="button" class="analytics-quick-prompt text-left bg-white border border-purple-100 hover:border-purple-300 hover:bg-purple-50 p-3 rounded-xl shadow-sm transition-all text-sm font-semibold text-purple-800 flex items-center gap-3" data-prompt-type="instructions"><i class="fas fa-list-ol text-purple-400"></i> Create personalized instructions</button>
                    <button type="button" class="analytics-quick-prompt text-left bg-white border border-purple-100 hover:border-purple-300 hover:bg-purple-50 p-3 rounded-xl shadow-sm transition-all text-sm font-semibold text-purple-800 flex items-center gap-3" data-prompt-type="weakness"><i class="fas fa-search text-purple-400"></i> Analyze weak points deeply</button>
                    <button type="button" class="analytics-quick-prompt text-left bg-white border border-purple-100 hover:border-purple-300 hover:bg-purple-50 p-3 rounded-xl shadow-sm transition-all text-sm font-semibold text-purple-800 flex items-center gap-3" data-prompt-type="summary"><i class="fas fa-compress-alt text-purple-400"></i> Summarize trajectory</button>
                </div>
                <div id="analytics-assistant-result" class="flex-1 bg-white border border-purple-100 rounded-2xl p-6 shadow-inner overflow-y-auto scrollbar-custom">
                    <p class="text-gray-400 text-center italic mt-10"><i class="fas fa-magic text-3xl text-purple-200 block mb-3"></i>Use a quick action or ask a custom question to generate teacher-ready support.</p>
                </div>
            </section>
        </div>
    `;
    resetAssistantUi();
    setPanelState('assistant', 'ready');
}

function parseAnalyticsMarkdown(text) {
    if (window.marked) return window.marked.parse(String(text || ''));
    let html = String(text || '');
    // Bold italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold text-gray-800 mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-gray-900 mt-5 mb-3">$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-gray-900 mt-6 mb-4">$1</h1>');
    // Bullets (simple approach)
    html = html.replace(/^\s*\-\s(.*$)/gm, '<li class="ml-4 list-disc marker:text-indigo-500 mb-1">$1</li>');
    // Newlines
    html = html.replace(/\n/g, '<br>');
    // Clean up empty <br> inside lists
    html = html.replace(/<\/li><br>/g, '</li>');
    return html;
}

function buildAiSummaryPrompt(data) {
    const strengths = data.strengths.map((item) => `${item.label} (${item.studentAverage}%)`).join(', ') || 'No clear strengths yet';
    const areas = data.areasForGrowth.map((item) => `${item.label} (${item.average}%)`).join(', ') || 'No major weak areas';
    const alerts = data.alerts.map((item) => `${item.title}: ${item.message}`).join(' | ');
    return {
        systemPrompt: 'You are an educational performance analyst. Produce concise, teacher-facing insight using plain English and short bullet points.',
        userPrompt: `Student: ${data.student.name}
Class: ${data.classData?.name || 'Unknown'}
Current grade band: ${data.currentGrade}
Current weighted average: ${data.currentAverage?.toFixed?.(1) || 'N/A'}%
Attendance: ${data.attendancePercent?.toFixed?.(1) || 'N/A'}%
Improvement: ${data.improvement?.label || 'Stable'} (${data.improvement?.delta || 0})
Prediction: ${data.prediction.predictedScore || 'N/A'}%
Top strengths: ${strengths}
Support areas: ${areas}
Smart alerts: ${alerts}

Return:
1. Three strengths
2. Three areas needing improvement
3. A short teacher-facing next-step summary

Keep it under 180 words and use markdown bullets.`
    };
}

async function hydrateAiSummary(data) {
    if (activeAudience === 'student') return;
    const output = document.getElementById('analytics-ai-summary-output');
    if (!output) return;
    const cacheKey = `${data.student.id}:analysisSummary`;
    if (aiCache.has(cacheKey)) {
        output.innerHTML = aiCache.get(cacheKey);
        return;
    }
    const requestToken = ++activeAiToken;
    try {
        const prompts = buildAiSummaryPrompt(data);
        const text = await callGeminiApi(prompts.systemPrompt, prompts.userPrompt, { retries: 1, baseDelay: 500, timeoutMs: 20000 });
        if (requestToken !== activeAiToken || activeStudentId !== data.student.id) return;
        const parsedHTML = parseAnalyticsMarkdown(text);
        const html = `<div class="prose prose-sm max-w-none text-gray-800">${parsedHTML}</div>`;
        aiCache.set(cacheKey, html);
        output.innerHTML = html;
    } catch (error) {
        console.error('Student analytics AI summary failed:', error);
        if (requestToken !== activeAiToken || activeStudentId !== data.student.id) return;
        output.innerHTML = '<p class="text-red-600">The AI summary is temporarily unavailable. Deterministic predictions and alerts remain visible.</p>';
    }
}

function buildAssistantPrompt(data, promptType, customText = '') {
    const weakTopics = data.weakTopics.map((item) => `${item.label} (${item.average}%)`).join(', ') || 'No urgent weak topics';
    const strengths = data.strengths.map((item) => `${item.label} (${item.studentAverage}%)`).join(', ') || 'No clear strengths yet';
    const baseContext = `Student: ${data.student.name}
Class: ${data.classData?.name || 'Unknown'}
Current grade: ${data.currentGrade} (${data.currentAverage?.toFixed?.(1) || 'N/A'}%)
Attendance: ${data.attendancePercent?.toFixed?.(1) || 'N/A'}%
Improvement rate: ${data.improvement?.delta || 0}
Prediction: ${data.prediction.predictedScore || 'N/A'}%
Strengths: ${strengths}
Weak topics: ${weakTopics}
Alerts: ${data.alerts.map((item) => item.title).join(', ') || 'None'}
Recent assessments:
${data.scores.slice(-6).map((entry) => `- ${entry.date}: ${entry.title || entry.type} => ${entry.normalizedPercent}%`).join('\n')}`;

    if (promptType === 'report') {
        return `${baseContext}

Write a parent-teacher meeting report with:
- current picture
- progress summary
- concerns
- recommended next steps

Keep it constructive and professional.`;
    }
    if (promptType === 'instructions') {
        return `${baseContext}

Generate three personalized instruction templates the teacher can adapt and send.`;
    }
    if (promptType === 'weakness') {
        return `${baseContext}

Give a deep-dive analysis of the student's weakest concepts, likely root causes, and targeted support strategies.`;
    }
    if (promptType === 'summary') {
        return `${baseContext}

Summarize the student's recent trajectory for the teacher in short action-oriented bullets.`;
    }
    return `${baseContext}

Teacher question: ${customText}

Answer the teacher directly using short sections and practical recommendations.`;
}

function appendAssistantMessage(kind, text) {
    const transcript = document.getElementById('analytics-assistant-transcript');
    if (!transcript) return;
    const bubble = document.createElement('div');
    
    if (kind === 'user') {
        bubble.className = `ml-auto max-w-[85%] bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-none shadow-sm text-sm`;
        bubble.textContent = text;
    } else if (kind === 'system') {
        bubble.className = `mx-auto text-center text-red-500 text-xs font-bold my-2`;
        bubble.textContent = text;
    } else {
        const parsedHTML = parseAnalyticsMarkdown(text);
        bubble.className = `mr-auto max-w-[90%] bg-gray-100 text-gray-800 p-4 rounded-2xl rounded-tl-none shadow-sm text-sm`;
        bubble.innerHTML = `<div class="prose prose-sm max-w-none">${parsedHTML}</div>`;
    }
    
    transcript.appendChild(bubble);
    transcript.scrollTop = transcript.scrollHeight;
}

async function runAssistantAction(promptType, customText = '') {
    if (activeAudience === 'student') return;
    if (!requireEliteAI({ feature: 'Student analytics assistant' })) return;
    const data = analyticsCache.get(activeStudentId)?.data || await loadAnalyticsData(activeStudentId);
    if (!data) return;

    const resultEl = document.getElementById('analytics-assistant-result');
    if (resultEl) {
        resultEl.innerHTML = '<p class="analytics-loading-text">Generating teacher-ready response...</p>';
    }

    const userText = customText || ({
        report: 'Generate parent-teacher report',
        instructions: 'Create personalized instructions',
        weakness: 'Analyze weak points deeply',
        summary: 'Summarize trajectory'
    }[promptType] || 'Custom teacher question');

    appendAssistantMessage('user', userText);
    const requestToken = ++activeAiToken;

    try {
        const response = await callGeminiApi(
            'You are a concise AI teaching assistant for student analytics. Provide structured, teacher-ready responses in plain English.',
            buildAssistantPrompt(data, promptType, customText),
            { retries: 1, baseDelay: 500, timeoutMs: 25000 }
        );
        if (requestToken !== activeAiToken || activeStudentId !== data.student.id) return;
        appendAssistantMessage('assistant', response);
        if (resultEl) {
            const parsedHTML = parseAnalyticsMarkdown(response);
            resultEl.innerHTML = `<div class="prose prose-sm max-w-none text-gray-800">${parsedHTML}</div>`;
        }
    } catch (error) {
        console.error('Student analytics assistant failed:', error);
        if (requestToken !== activeAiToken || activeStudentId !== data.student.id) return;
        appendAssistantMessage('system', 'The AI assistant could not complete that request right now.');
        if (resultEl) {
            resultEl.innerHTML = '<p class="text-red-600">The assistant could not complete that request right now.</p>';
        }
    }
}

async function exportAnalyticsPdf() {
    const button = document.getElementById('student-analytics-export-pdf-btn');
    const shell = document.querySelector('#student-analytics-modal .student-analytics-shell');
    if (!button || !shell || !window.jspdf || !window.html2canvas) return;

    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>PDF</span>';
    try {
        const canvas = await window.html2canvas(shell, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        const studentName = (getRefs().name?.textContent || 'student').replace(/\s+/g, '_');
        pdf.save(`${studentName}_analytics.pdf`);
    } catch (error) {
        console.error('Student analytics PDF export failed:', error);
        showToast('Could not export analytics PDF.', 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-file-pdf"></i><span>PDF</span>';
    }
}

async function exportAnalyticsCsv() {
    const data = analyticsCache.get(activeStudentId)?.data || await loadAnalyticsData(activeStudentId);
    if (!data) return;
    const csv = buildAnalyticsCsv({
        student: data.student,
        metrics: {
            currentGrade: data.currentGrade,
            attendancePercent: data.attendancePercent?.toFixed?.(1) || 'N/A',
            averageScore: data.averageScore?.toFixed?.(1) || 'N/A',
            improvementDelta: data.improvement?.delta?.toFixed?.(1) || '0.0'
        },
        history: data.scores,
        alerts: data.alerts,
        recommendations: data.recommendations
    });
    const filename = `${(data.student.name || 'student').replace(/\s+/g, '_')}_analytics.csv`;
    downloadTextFile(filename, csv, 'text/csv;charset=utf-8');
}

function printAnalytics() {
    document.body.classList.add('student-analytics-print-mode');
    const cleanup = () => {
        document.body.classList.remove('student-analytics-print-mode');
        window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1000);
}

function wireModal() {
    if (wired) return;
    wired = true;
    bindStateInvalidation();

    const refs = getRefs();
    if (!refs.modal) return;

    refs.closeBtn?.addEventListener('click', closeStudentAnalyticsModal);
    refs.modal.addEventListener('click', (event) => {
        if (event.target === refs.modal) closeStudentAnalyticsModal();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && activeStudentId && !refs.modal.classList.contains('hidden')) {
            closeStudentAnalyticsModal();
        }
    });

    document.querySelectorAll('.analytics-tab-button').forEach((button) => {
        button.addEventListener('click', () => activateTab(button.dataset.tab));
    });

    document.getElementById('student-analytics-retry-btn')?.addEventListener('click', () => {
        if (activeStudentId) {
            clearCaches();
            void openStudentAnalyticsModal(activeStudentId, activeTrigger, { audience: activeAudience });
        }
    });
    document.getElementById('student-analytics-load-full-history-btn')?.addEventListener('click', () => void handleLoadFullHistory());
    document.getElementById('student-analytics-export-pdf-btn')?.addEventListener('click', () => void exportAnalyticsPdf());
    document.getElementById('student-analytics-export-csv-btn')?.addEventListener('click', () => void exportAnalyticsCsv());
    document.getElementById('student-analytics-print-btn')?.addEventListener('click', printAnalytics);

    refs.modal.addEventListener('click', (event) => {
        const upgradeButton = event.target.closest('#analytics-analysis-upgrade-btn, #analytics-assistant-upgrade-btn, #analytics-analysis-inline-upgrade-btn');
        if (upgradeButton) {
            requireEliteAI({ feature: 'Student analytics AI' });
            return;
        }
        const quickPrompt = event.target.closest('.analytics-quick-prompt');
        if (quickPrompt) {
            void runAssistantAction(quickPrompt.dataset.promptType);
        }
    });

    refs.modal.addEventListener('click', (event) => {
        const sendButton = event.target.closest('#analytics-assistant-send-btn');
        if (!sendButton) return;
        const textarea = document.getElementById('analytics-assistant-input');
        const question = textarea?.value?.trim();
        if (!question) {
            showToast('Enter a teacher question first.', 'info');
            return;
        }
        textarea.value = '';
        void runAssistantAction('custom', question);
    });
}

function resetModalUi() {
    destroyCharts();
    setErrorBanner('');
    setAllPanelsLoading();
    activateTab('overview');
    resetAssistantUi();
}

function populateTriggerOrigin(triggerElement) {
    const refs = getRefs();
    if (!refs.shell || !triggerElement) return;
    const rect = triggerElement.getBoundingClientRect();
    const originX = rect.left + (rect.width / 2);
    const originY = rect.top + (rect.height / 2);
    refs.shell.style.transformOrigin = `${originX}px ${originY}px`;
}

function renderEmptyShell(student) {
    const refs = getRefs();
    refs.name.textContent = student?.name || 'Student analytics';
    refs.subtitle.textContent = 'Preparing analytics dashboard...';
    refs.quickGrade.textContent = '--';
    refs.quickAttendance.textContent = '--';
    refs.quickRecent.textContent = '--';
    refs.quickAvg.textContent = '--';
    if (refs.toolbarStatus) {
        refs.toolbarStatus.textContent = activeAudience === 'teacher' ? 'Gathering insights…' : '';
    }
    if (refs.historyHint) {
        refs.historyHint.textContent = '';
        refs.historyHint.classList.add('hidden');
    }
    renderAvatar(student);
}

export async function openStudentAnalyticsModal(studentId, triggerElement = null, options = {}) {
    const { ensureHeroChronicleNotesListener } = await import('../../db/listeners.js');
    ensureHeroChronicleNotesListener();

    wireModal();
    activeStudentId = studentId;
    activeTrigger = triggerElement || null;
    activeLoadToken += 1;
    const loadToken = activeLoadToken;

    const student = (state.get('allStudents') || []).find((item) => item.id === studentId);
    if (!student) {
        showToast('Student not found.', 'error');
        return;
    }

    applyAudienceChrome(options.audience === 'student' ? 'student' : 'teacher');

    const refs = getRefs();
    populateTriggerOrigin(triggerElement);
    resetModalUi();
    renderEmptyShell(student);
    refs.modal.dataset.studentId = studentId;
    showAnimatedModal('student-analytics-modal');
    setTimeout(() => refs.closeBtn?.focus(), 60);

    try {
        const data = await loadAnalyticsData(studentId);
        if (loadToken !== activeLoadToken || activeStudentId !== studentId) return;
        if (!data) {
            setErrorBanner('Could not load student analytics.');
            ['overview', 'performance', 'analysis', 'assistant'].forEach((panel) => setPanelState(panel, 'error'));
            return;
        }
        renderHeader(data);
        renderOverview(data);
        renderPerformance(data);
        renderAnalysis(data);
        renderAssistant(data);
    } catch (error) {
        console.error('Student analytics load failed:', error);
        if (loadToken !== activeLoadToken || activeStudentId !== studentId) return;
        setErrorBanner('The student analytics modal could not load right now. Try again.');
        ['overview', 'performance', 'analysis', 'assistant'].forEach((panel) => setPanelState(panel, 'error'));
    }
}

export function closeStudentAnalyticsModal() {
    activeAiToken += 1;
    activeStudentId = null;
    hideModal('student-analytics-modal');
    destroyCharts();
    if (activeTrigger?.focus) {
        const triggerToFocus = activeTrigger;
        setTimeout(() => triggerToFocus.focus(), 360);
    }
    activeTrigger = null;
}
