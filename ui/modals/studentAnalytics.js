// /ui/modals/studentAnalytics.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { HERO_CLASSES } from '../../features/heroClasses.js';
import { showAnimatedModal } from './base.js';
import { callGeminiApi } from '../../api.js';
import { showToast } from '../effects.js';
import {
    getAssessmentAverage,
    getAssessmentSchemeForClass,
    getNormalizedPercentForScore,
    getQualitativeDistribution,
    getWeightedAcademicAverage
} from '../../features/assessmentConfig.js';

/**
 * Opens the Student Analytics Modal with performance overview and AI insights
 * @param {string} studentId - The student's ID
 * @param {HTMLElement} triggerElement - The element that triggered the modal (for animation origin)
 */
export async function openStudentAnalyticsModal(studentId, triggerElement) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    const modal = document.getElementById('student-analytics-modal');
    if (!modal) {
        console.warn('student-analytics-modal not found');
        return;
    }

    const modalContent = modal.querySelector('.pop-in');
    if (modalContent && triggerElement) {
        const rect = triggerElement.getBoundingClientRect();
        const originX = rect.left + rect.width / 2;
        const originY = rect.top + rect.height / 2;
        modalContent.style.transformOrigin = `${originX}px ${originY}px`;
    }

    // Store student ID for later tab rendering
    modal.dataset.studentId = studentId;

    // Update header
    updateAnalyticsHeader(student);

    // Initialize tabs
    initializeAnalyticsTabs(studentId);

    // Show modal
    showAnimatedModal('student-analytics-modal');
}

function updateAnalyticsHeader(student) {
    const heroIcon = (student.heroClass && HERO_CLASSES[student.heroClass]) ? HERO_CLASSES[student.heroClass].icon : '⚔️';
    document.getElementById('analytics-student-name').innerHTML = `${heroIcon} ${student.name}`;

    const avatarEl = document.getElementById('analytics-student-avatar');
    if (student.avatar) {
        avatarEl.innerHTML = `<img src="${student.avatar}" alt="${student.name}" class="w-full h-full object-cover">`;
    } else {
        avatarEl.innerHTML = `<div class="flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-4xl">${student.name.charAt(0)}</div>`;
    }

    // Quick stats
    const classData = state.get('allSchoolClasses').find(c => c.id === student.classId);
    const scores = state.get('allWrittenScores').filter(s => s.studentId === student.id);
    const testScores = scores.filter(s => s.type === 'test');
    const recentScore = testScores.length > 0 ? testScores[testScores.length - 1] : null;
    const avgScore = getAssessmentAverage(testScores, classData);

    let recentScoreText = '--';
    if (recentScore) {
        const normalized = getNormalizedPercentForScore(recentScore, classData);
        recentScoreText = normalized !== null ? `${normalized.toFixed(0)}%` : '--';
    }

    document.getElementById('analytics-quick-recent').textContent = recentScoreText;
    document.getElementById('analytics-quick-avg').textContent = avgScore !== null ? `${avgScore.toFixed(0)}%` : '--';
}

function initializeAnalyticsTabs(studentId) {
    // Set up tab navigation
    const tabButtons = document.querySelectorAll('.analytics-tab-button');
    const tabContents = document.querySelectorAll('[data-tab-content]');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            showAnalyticsTab(tabName, studentId);
        });
    });

    // Show first tab by default
    showAnalyticsTab('overview', studentId);
}

function showAnalyticsTab(tabName, studentId) {
    // Update active tab button
    document.querySelectorAll('.analytics-tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Hide all tab contents
    document.querySelectorAll('[data-tab-content]').forEach(content => {
        content.style.display = 'none';
    });

    // Show selected tab
    const tabContent = document.querySelector(`[data-tab-content="${tabName}"]`);
    if (tabContent) {
        tabContent.style.display = 'block';

        // Load content if needed
        if (tabName === 'overview' && !tabContent.dataset.loaded) {
            renderOverviewTab(studentId, tabContent);
            tabContent.dataset.loaded = 'true';
        } else if (tabName === 'trends' && !tabContent.dataset.loaded) {
            renderTrendsTab(studentId, tabContent);
            tabContent.dataset.loaded = 'true';
        } else if (tabName === 'analysis' && !tabContent.dataset.loaded) {
            renderAnalysisTab(studentId, tabContent);
            tabContent.dataset.loaded = 'true';
        } else if (tabName === 'chat') {
            // Chat doesn't need data-loaded flag, it's always interactive
            if (!tabContent.dataset.initialized) {
                initializeChatTab(studentId, tabContent);
                tabContent.dataset.initialized = 'true';
            }
        }
    }
}

function renderOverviewTab(studentId, container) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    const classData = state.get('allSchoolClasses').find(c => c.id === student.classId);
    const scores = state.get('allWrittenScores').filter(s => s.studentId === studentId);
    const testScores = scores.filter(s => s.type === 'test');
    const dictationScores = scores.filter(s => s.type === 'dictation');

    const avgTest = getAssessmentAverage(testScores, classData);
    const avgDictation = getAssessmentAverage(dictationScores, classData);
    const bestScore = testScores.length > 0 
        ? Math.max(...testScores.map(s => getNormalizedPercentForScore(s, classData) || 0))
        : 0;
    const recentScore = testScores.length > 0 
        ? getNormalizedPercentForScore(testScores[testScores.length - 1], classData) || 0
        : 0;

    // Calculate trend (improving, stable, declining)
    let trend = '→';
    if (testScores.length >= 2) {
        const recent3 = testScores.slice(-3).map(s => getNormalizedPercentForScore(s, classData) || 0);
        const avgRecent = recent3.reduce((a, b) => a + b, 0) / recent3.length;
        const older3 = testScores.slice(-6, -3);
        if (older3.length > 0) {
            const avgOlder = older3.map(s => getNormalizedPercentForScore(s, classData) || 0).reduce((a, b) => a + b, 0) / older3.length;
            if (avgRecent > avgOlder + 2) trend = '📈';
            else if (avgRecent < avgOlder - 2) trend = '📉';
        }
    }

    const recentAssessments = scores.slice(-5).reverse();

    container.innerHTML = `
        <div class="analytics-overview-content">
            <div class="analytics-stats-grid">
                <div class="analytics-stat-card">
                    <div class="analytics-stat-icon">📊</div>
                    <div class="analytics-stat-label">Latest Score</div>
                    <div class="analytics-stat-value">${recentScore.toFixed(0)}%</div>
                </div>
                <div class="analytics-stat-card">
                    <div class="analytics-stat-icon">🏆</div>
                    <div class="analytics-stat-label">Best Score</div>
                    <div class="analytics-stat-value">${bestScore.toFixed(0)}%</div>
                </div>
                <div class="analytics-stat-card">
                    <div class="analytics-stat-icon">📈</div>
                    <div class="analytics-stat-label">Average</div>
                    <div class="analytics-stat-value">${avgTest !== null ? avgTest.toFixed(0) : '--'}%</div>
                </div>
                <div class="analytics-stat-card">
                    <div class="analytics-stat-icon">🔄</div>
                    <div class="analytics-stat-label">Trend</div>
                    <div class="analytics-stat-value">${trend}</div>
                </div>
            </div>

            <div class="analytics-section">
                <h3 class="analytics-section-title">Recent Assessments</h3>
                <div class="analytics-recent-list">
                    ${recentAssessments.map(score => {
                        const scorePercent = getNormalizedPercentForScore(score, classData) || 0;
                        const dateStr = utils.parseFlexibleDate(score.date).toLocaleDateString();
                        const icon = score.type === 'test' ? '📋' : '🎤';
                        return `
                            <div class="analytics-recent-item">
                                <div class="analytics-recent-icon">${icon}</div>
                                <div class="analytics-recent-info">
                                    <div class="analytics-recent-label">${score.type === 'test' ? 'Test' : 'Dictation'} • ${dateStr}</div>
                                    <div class="analytics-recent-score">${scorePercent.toFixed(0)}%</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderTrendsTab(studentId, container) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    const classData = state.get('allSchoolClasses').find(c => c.id === student.classId);
    const scores = state.get('allWrittenScores').filter(s => s.studentId === studentId);
    const testScores = scores.filter(s => s.type === 'test');

    const scoreData = testScores.map(s => ({
        date: utils.parseFlexibleDate(s.date),
        score: getNormalizedPercentForScore(s, classData) || 0
    })).sort((a, b) => a.date - b.date);

    // Calculate statistics
    const lastMonthScores = scoreData.filter(s => {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return s.date >= monthAgo;
    });
    const prevMonthScores = scoreData.filter(s => {
        const monthAgo = new Date();
        const twoMonthsAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        return s.date >= twoMonthsAgo && s.date < monthAgo;
    });

    const lastMonthAvg = lastMonthScores.length > 0 ? lastMonthScores.reduce((a, b) => a + b.score, 0) / lastMonthScores.length : 0;
    const prevMonthAvg = prevMonthScores.length > 0 ? prevMonthScores.reduce((a, b) => a + b.score, 0) / prevMonthScores.length : 0;
    const monthChange = lastMonthAvg - prevMonthAvg;

    // Trend indicator
    let trendEmoji = '→';
    let trendColor = 'text-gray-500';
    if (monthChange > 2) {
        trendEmoji = '📈';
        trendColor = 'text-green-500';
    } else if (monthChange < -2) {
        trendEmoji = '📉';
        trendColor = 'text-red-500';
    }

    container.innerHTML = `
        <div class="analytics-trends-content">
            <div class="analytics-trend-stats">
                <div class="analytics-trend-stat">
                    <div class="analytics-trend-label">This Month Average</div>
                    <div class="analytics-trend-value">${lastMonthAvg.toFixed(0)}%</div>
                </div>
                <div class="analytics-trend-stat">
                    <div class="analytics-trend-label">Last Month Average</div>
                    <div class="analytics-trend-value">${prevMonthAvg.toFixed(0)}%</div>
                </div>
                <div class="analytics-trend-stat">
                    <div class="analytics-trend-label">Month Change</div>
                    <div class="analytics-trend-value ${trendColor}">${trendEmoji} ${monthChange > 0 ? '+' : ''}${monthChange.toFixed(1)}%</div>
                </div>
            </div>

            <div class="analytics-section">
                <h3 class="analytics-section-title">Performance Chart</h3>
                <canvas id="analytics-performance-chart" class="analytics-chart"></canvas>
            </div>

            <div class="analytics-section">
                <h3 class="analytics-section-title">Score Distribution</h3>
                <canvas id="analytics-distribution-chart" class="analytics-chart"></canvas>
            </div>
        </div>
    `;

    // Render charts after HTML is in DOM
    setTimeout(() => renderPerformanceCharts(testScores, classData), 100);
}

function renderPerformanceCharts(testScores, classData) {
    // Prepare data for line chart
    const scoreData = testScores.map(s => ({
        date: utils.parseFlexibleDate(s.date),
        score: getNormalizedPercentForScore(s, classData) || 0
    })).sort((a, b) => a.date - b.date);

    // Chart.js line chart
    const ctx = document.getElementById('analytics-performance-chart');
    if (!ctx) return;

    if (window.Chart) {
        new window.Chart(ctx, {
            type: 'line',
            data: {
                labels: scoreData.map(d => d.date.toLocaleDateString()),
                datasets: [{
                    label: 'Test Score',
                    data: scoreData.map(d => d.score),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true, labels: { font: { size: 12 }, color: '#6b7280' } }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { color: '#9ca3af' },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    x: { ticks: { color: '#9ca3af' }, grid: { display: false } }
                }
            }
        });
    }

    // Score distribution histogram
    const distCtx = document.getElementById('analytics-distribution-chart');
    if (distCtx && window.Chart) {
        const ranges = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'];
        const counts = [0, 0, 0, 0, 0];
        scoreData.forEach(d => {
            if (d.score < 20) counts[0]++;
            else if (d.score < 40) counts[1]++;
            else if (d.score < 60) counts[2]++;
            else if (d.score < 80) counts[3]++;
            else counts[4]++;
        });

        new window.Chart(distCtx, {
            type: 'bar',
            data: {
                labels: ranges,
                datasets: [{
                    label: 'Assessments',
                    data: counts,
                    backgroundColor: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#10b981'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#9ca3af' }, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { ticks: { color: '#9ca3af' }, grid: { display: false } }
                }
            }
        });
    }
}

async function renderAnalysisTab(studentId, container) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    const classData = state.get('allSchoolClasses').find(c => c.id === student.classId);

    // Show loading state
    container.innerHTML = `
        <div class="analytics-analysis-content">
            <div class="analytics-skeleton">
                <div class="skeleton-line" style="height: 24px; margin-bottom: 12px;"></div>
                <div class="skeleton-line" style="height: 16px; width: 80%;"></div>
            </div>
        </div>
    `;

    try {
        // Generate AI analysis
        const analysis = await generateStudentAnalysis(studentId, classData);
        
        container.innerHTML = `
            <div class="analytics-analysis-content">
                <div class="analytics-analysis-section">
                    <h3 class="analytics-analysis-title">📊 Performance Summary</h3>
                    <p class="analytics-analysis-text">${analysis.summary}</p>
                </div>

                <div class="analytics-analysis-section">
                    <h3 class="analytics-analysis-title">💪 Strengths</h3>
                    <div class="analytics-analysis-list">
                        ${analysis.strengths.map(s => `<div class="analytics-analysis-item">✓ ${s}</div>`).join('')}
                    </div>
                </div>

                <div class="analytics-analysis-section">
                    <h3 class="analytics-analysis-title">⚠️ Areas to Improve</h3>
                    <div class="analytics-analysis-list">
                        ${analysis.weakPoints.map(w => `<div class="analytics-analysis-item">• ${w}</div>`).join('')}
                    </div>
                </div>

                <div class="analytics-analysis-section">
                    <h3 class="analytics-analysis-title">🎯 Personalized Study Plan</h3>
                    <div class="analytics-analysis-plan">
                        ${analysis.studyPlan.map(p => `<div class="analytics-study-step">${p}</div>`).join('')}
                    </div>
                </div>

                <div class="analytics-analysis-section">
                    <h3 class="analytics-analysis-title">👨‍🏫 Teacher Recommendations</h3>
                    <p class="analytics-analysis-text">${analysis.recommendations}</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error generating analysis:', error);
        container.innerHTML = `
            <div class="analytics-analysis-content">
                <p class="text-red-600">Unable to generate AI analysis. Please try again.</p>
            </div>
        `;
    }
}

async function generateStudentAnalysis(studentId, classData) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    const scores = state.get('allWrittenScores').filter(s => s.studentId === studentId);
    const testScores = scores.filter(s => s.type === 'test');

    // Build context for Gemini
    const scoresSummary = testScores.slice(-10).map(s => {
        const score = getNormalizedPercentForScore(s, classData) || 0;
        return `${utils.parseFlexibleDate(s.date).toLocaleDateString()}: ${score.toFixed(0)}%`;
    }).join(', ');

    const avgScore = getAssessmentAverage(testScores, classData) || 0;

    const prompt = `You are an educational analyst. Analyze this student's performance and provide specific, actionable insights.

Student: ${student.name}
Subject/Class: ${classData?.name || 'Unknown'}
Average Score: ${avgScore.toFixed(0)}%
Recent Scores: ${scoresSummary}
Total Assessments: ${testScores.length}

Provide a response in this exact JSON format:
{
  "summary": "1-2 sentence trend analysis",
  "strengths": ["strength 1", "strength 2"],
  "weakPoints": ["area 1", "area 2"],
  "studyPlan": ["week 1 focus", "week 2 focus", "week 3 focus"],
  "recommendations": "1-2 sentence recommendation for teacher"
}`;

    try {
        const response = await callGeminiApi(prompt, { mode: 'fast' });
        const parsed = JSON.parse(response);
        return {
            summary: parsed.summary || 'No summary available',
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
            weakPoints: Array.isArray(parsed.weakPoints) ? parsed.weakPoints : [],
            studyPlan: Array.isArray(parsed.studyPlan) ? parsed.studyPlan : [],
            recommendations: parsed.recommendations || 'No recommendations available'
        };
    } catch (error) {
        console.error('Gemini API error:', error);
        return {
            summary: 'Analysis unavailable',
            strengths: [],
            weakPoints: [],
            studyPlan: [],
            recommendations: 'Please try again later'
        };
    }
}

function initializeChatTab(studentId, container) {
    const student = state.get('allStudents').find(s => s.id === studentId);

    container.innerHTML = `
        <div class="analytics-chat-content">
            <div id="analytics-chat-messages" class="analytics-chat-messages"></div>
            
            <div class="analytics-chat-input-area">
                <div class="analytics-quick-prompts">
                    <button class="analytics-prompt-btn" data-prompt="What are ${student.name}'s main weak points?">
                        ❓ Weak Points
                    </button>
                    <button class="analytics-prompt-btn" data-prompt="How can I help ${student.name} improve?">
                        💡 How to Help
                    </button>
                    <button class="analytics-prompt-btn" data-prompt="What is ${student.name}'s learning style?">
                        🎓 Learning Style
                    </button>
                    <button class="analytics-prompt-btn" data-prompt="Should I flag ${student.name} for intervention?">
                        🚩 Intervention?
                    </button>
                </div>

                <div class="analytics-input-wrapper">
                    <input 
                        type="text" 
                        id="analytics-chat-input" 
                        class="analytics-chat-input" 
                        placeholder="Ask about ${student.name}..."
                        autocomplete="off"
                    >
                    <button id="analytics-chat-send" class="analytics-chat-send-btn">📤</button>
                </div>
            </div>
        </div>
    `;

    // Set up chat event listeners
    setupChatListeners(studentId);
}

function setupChatListeners(studentId) {
    const input = document.getElementById('analytics-chat-input');
    const sendBtn = document.getElementById('analytics-chat-send');
    const promptBtns = document.querySelectorAll('.analytics-prompt-btn');

    const sendMessage = async (text) => {
        if (!text.trim()) return;

        const messagesContainer = document.getElementById('analytics-chat-messages');
        
        // Add user message
        const userMsgEl = document.createElement('div');
        userMsgEl.className = 'analytics-chat-message teacher-message';
        userMsgEl.textContent = text;
        messagesContainer.appendChild(userMsgEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        input.value = '';

        // Show AI thinking
        const thinkingEl = document.createElement('div');
        thinkingEl.className = 'analytics-chat-message ai-message thinking';
        thinkingEl.innerHTML = '<span class="thinking-dots">🤔 Thinking<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>';
        messagesContainer.appendChild(thinkingEl);

        try {
            const response = await queryStudentAI(studentId, text);
            thinkingEl.remove();

            const aiMsgEl = document.createElement('div');
            aiMsgEl.className = 'analytics-chat-message ai-message';
            aiMsgEl.innerHTML = `<div class="analytics-chat-ai-icon">🤖</div><div class="analytics-chat-ai-text">${response}</div>`;
            messagesContainer.appendChild(aiMsgEl);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } catch (error) {
            thinkingEl.remove();
            const errorEl = document.createElement('div');
            errorEl.className = 'analytics-chat-message ai-message error';
            errorEl.textContent = 'Sorry, I encountered an error. Please try again.';
            messagesContainer.appendChild(errorEl);
        }
    };

    sendBtn.addEventListener('click', () => {
        const text = input.value.trim();
        if (text) sendMessage(text);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = input.value.trim();
            if (text) sendMessage(text);
        }
    });

    promptBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sendMessage(btn.dataset.prompt);
        });
    });
}

async function queryStudentAI(studentId, query) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    const classData = state.get('allSchoolClasses').find(c => c.id === student.classId);
    const scores = state.get('allWrittenScores').filter(s => s.studentId === studentId);
    const testScores = scores.filter(s => s.type === 'test');

    const scoresSummary = testScores.slice(-10).map(s => {
        const score = getNormalizedPercentForScore(s, classData) || 0;
        return `${utils.parseFlexibleDate(s.date).toLocaleDateString()}: ${score.toFixed(0)}%`;
    }).join(', ');

    const avgScore = getAssessmentAverage(testScores, classData) || 0;

    const prompt = `You are an educational assistant helping a teacher understand their student's performance.

Student: ${student.name}
Teacher's Question: ${query}
Class: ${classData?.name || 'Unknown'}
Average Score: ${avgScore.toFixed(0)}%
Recent Scores: ${scoresSummary}
Total Assessments: ${testScores.length}

Provide a concise, helpful response (2-3 sentences max) that directly answers the teacher's question.`;

    try {
        return await callGeminiApi(prompt, { mode: 'fast' });
    } catch (error) {
        console.error('AI query error:', error);
        throw error;
    }
}

export function closeStudentAnalyticsModal() {
    const modal = document.getElementById('student-analytics-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}
