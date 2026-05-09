import { showAnimatedModal, hideModal } from './base.js';
import * as state from '../../state.js';
import { playSound } from '../../audio.js';
import {
    loadQuizForClass,
    getCurrentQuestion,
    handleAnswer,
    skipQuestion,
    getQuizProgress,
    finalizeQuiz,
    resetQuiz,
    getQuizState
} from '../../features/quizOfTheWeek.js';
import { getQuizForClass } from '../../db/actions/quizOfTheWeek.js';

const MODAL_ID = 'quiz-of-week-modal';
let currentClassId = null;

// =============================================================================
// HTML TEMPLATE
// =============================================================================

function getModalHTML() {
    return `
<div id="${MODAL_ID}" class="fixed inset-0 bg-slate-950/70 z-[90] flex items-center justify-center p-3 hidden backdrop-blur-sm">
    <div id="quiz-modal-inner" class="quiz-modal-inner pop-in">
        <div id="quiz-modal-content" class="quiz-modal-stage">
            <!-- Content rendered dynamically -->
        </div>
    </div>
</div>`;
}

function ensureModalInDOM() {
    if (document.getElementById(MODAL_ID)) return;
    const div = document.createElement('div');
    div.innerHTML = getModalHTML();
    document.body.appendChild(div.firstElementChild);
}

// =============================================================================
// RENDER FUNCTIONS
// =============================================================================

function renderIntroScreen(quiz, qs) {
    const contentEl = document.getElementById('quiz-modal-content');
    if (!contentEl) return;

    const studentCount = qs.studentPool.length;
    const questionCount = qs.totalQuestions;

    contentEl.innerHTML = `
        <div class="quiz-modal-header">
            <span class="quiz-modal-title">Quiz of the Week</span>
            <button class="quiz-modal-close" id="quiz-close-btn"><i class="fas fa-times"></i></button>
        </div>
        <div class="quiz-intro">
            <div class="quiz-intro-icon">❓</div>
            <div class="quiz-intro-title">Ready, Quest Heroes?</div>
            <p style="color:rgba(255,255,255,0.6);max-width:300px;line-height:1.5;">
                ${questionCount} questions on this week's curriculum. Students will be picked at random to answer!
            </p>
            <div class="quiz-intro-stats">
                <div class="quiz-intro-stat">
                    <div class="quiz-intro-stat-num">${questionCount}</div>
                    <div class="quiz-intro-stat-label">Questions</div>
                </div>
                <div class="quiz-intro-stat">
                    <div class="quiz-intro-stat-num">${studentCount}</div>
                    <div class="quiz-intro-stat-label">Heroes</div>
                </div>
            </div>
            <button class="quiz-start-btn bubbly-button" id="quiz-begin-btn">
                <i class="fas fa-play mr-2"></i> Begin the Quiz!
            </button>
        </div>
    `;

    wireHeaderListeners();
    document.getElementById('quiz-begin-btn')?.addEventListener('click', () => showNextQuestion());
}

function renderQuestion(questionData, qs) {
    const contentEl = document.getElementById('quiz-modal-content');
    if (!contentEl) return;

    const progress = getQuizProgress(currentClassId);
    const pct = progress ? Math.round((progress.answeredCount / progress.totalQuestions) * 100) : 0;
    const q = questionData.question;
    const student = questionData.student;

    const isImage = q.type === 'image';
    const isFill = q.type === 'fill';
    const isMcq = q.type === 'mcq';

    const fillInputHTML = `
                <div class="quiz-fill-input-wrap">
                    <input type="text" class="quiz-fill-input" id="quiz-fill-answer" placeholder="Type your answer..." autocomplete="off" />
                    <button class="quiz-fill-submit bubbly-button" id="quiz-fill-submit-btn">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
                <div id="quiz-fill-feedback" class="quiz-explanation hidden"></div>`;

    let questionMiddleHTML = '';
    if (isImage && q.imageUrl) {
        questionMiddleHTML = `
            <div class="quiz-question-area">
                <img src="${q.imageUrl}" class="quiz-question-image" alt="Question image" />
                <div class="quiz-question-text">${q.question}</div>
                ${fillInputHTML}
            </div>`;
    } else if (isImage) {
        questionMiddleHTML = `
            <div class="quiz-question-area">
                <div class="quiz-question-emoji">🖼️</div>
                <div class="quiz-question-text">${q.question}</div>
                ${fillInputHTML}
            </div>`;
    } else if (isFill) {
        questionMiddleHTML = `
            <div class="quiz-question-area">
                <div class="quiz-question-text">${q.question}</div>
                ${fillInputHTML}
            </div>`;
    } else {
        const labels = ['A', 'B', 'C', 'D'];
        const optionsHTML = (q.options || []).map((opt, i) => `
            <button class="quiz-answer-btn bubbly-button" data-answer-index="${i}" data-answer-text="${escapeHTML(q.type === 'mcq' ? opt : '')}" ${isFill ? '' : ''}>
                <span class="quiz-answer-label">${labels[i] || i + 1}</span>
                <span>${opt}</span>
            </button>
        `).join('');
        questionMiddleHTML = `
            <div class="quiz-question-area">
                <div class="quiz-question-emoji">🤔</div>
                <div class="quiz-question-text">${q.question}</div>
            </div>
            <div class="quiz-answer-grid">
                ${optionsHTML}
            </div>`;
    }

    contentEl.innerHTML = `
        <div class="quiz-modal-header">
            <span class="quiz-modal-title">Quiz of the Week</span>
            <button class="quiz-modal-close" id="quiz-close-btn"><i class="fas fa-times"></i></button>
        </div>
        <div class="quiz-progress-bar">
            <div class="quiz-progress-fill" style="width:${pct}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="quiz-progress-label">Q ${progress.answeredCount + 1} / ${progress.totalQuestions}</span>
            <div class="quiz-score-tracker">
                <span class="quiz-score-correct"><i class="fas fa-check-circle"></i> ${progress.correctFirstTry}</span>
                <span class="quiz-score-sep">/</span>
                <span style="color:rgba(255,255,255,0.6);">${progress.totalQuestions}</span>
                &nbsp;correct
            </div>
        </div>
        ${questionMiddleHTML}
        ${questionData ? `
            <div class="quiz-spotlight-bar">
                <div class="quiz-spotlight-avatar">
                    ${student && student.avatar
                        ? `<img src="${student.avatar}" alt="${student?.name || ''}" />`
                        : `<i class="fas fa-user"></i>`}
                </div>
                <div>
                    <div class="quiz-spotlight-name">${student?.name || 'Hero'}</div>
                    <div style="font-size:0.7rem;color:rgba(255,255,255,0.5);">Your turn!</div>
                </div>
                <div class="quiz-spotlight-star">
                    <i class="fas fa-star"></i> ${questionData.score?.totalStars || 0}
                </div>
            </div>` : ''}
        <div id="quiz-explanation-area" class="quiz-explanation hidden"></div>
        <div id="quiz-action-area">
            <button class="quiz-next-btn bubbly-button hidden" id="quiz-next-btn">
                <i class="fas fa-arrow-right mr-2"></i> Next Question
            </button>
            <button class="quiz-skip-btn bubbly-button" id="quiz-skip-btn" style="background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);font-size:0.75rem;padding:0.35rem 0.9rem;">
                <i class="fas fa-forward mr-1"></i> Skip
            </button>
        </div>
    `;

    wireHeaderListeners();
    wireAnswerListeners(q);
}

function renderResultsScreen(results) {
    const contentEl = document.getElementById('quiz-modal-content');
    if (!contentEl) return;

    const tier = results.rewards?.tier || computeTier(results.firstTryCorrectPct);
    const tierClass = `tier-${tier}`;
    const tierEmoji = { legendary: '👑', epic: '🌟', rare: '💎', common: '🎯', heroic: '🛡️' }[tier] || '🎯';

    const rewards = results.rewards || {};
    const rewardItems = [];
    if (rewards.rewardedStudents > 0) rewardItems.push({ icon: '⭐', text: `${rewards.rewardedStudents} students rewarded` });
    if (rewards.questBonus > 0) rewardItems.push({ icon: '🗺️', text: `+${rewards.questBonus} Team Quest bonus` });
    if (rewards.totalGloryDistributed > 0) rewardItems.push({ icon: '⚜️', text: `+${rewards.totalGloryDistributed} Glory distributed` });
    if (rewards.awardedArtifacts?.length > 0) rewardItems.push({ icon: '🎁', text: `${rewards.awardedArtifacts.length} artifact(s) awarded` });

    const rewardHTML = rewardItems.length > 0
        ? `<div class="quiz-reward-list">${rewardItems.map(r => `
            <div class="quiz-reward-item">
                <span class="quiz-reward-icon">${r.icon}</span>
                <span>${r.text}</span>
            </div>
        `).join('')}</div>`
        : '';

    contentEl.innerHTML = `
        <div class="quiz-modal-header">
            <span class="quiz-modal-title">Quiz Complete!</span>
            <button class="quiz-modal-close" id="quiz-close-btn"><i class="fas fa-times"></i></button>
        </div>
        <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:1rem;">
            <div class="quiz-intro-icon">${tierEmoji}</div>
            <div class="quiz-result-tier ${tierClass}">${tier.toUpperCase()}</div>
            <div class="quiz-result-stats">
                <div class="quiz-result-stat">
                    <div class="quiz-result-stat-value">${results.totalQuestions}</div>
                    <div class="quiz-result-stat-label">Questions</div>
                </div>
                <div class="quiz-result-stat">
                    <div class="quiz-result-stat-value">${results.correctFirstTry}</div>
                    <div class="quiz-result-stat-label">Correct on 1st Try</div>
                </div>
                <div class="quiz-result-stat">
                    <div class="quiz-result-stat-value">${results.firstTryCorrectPct}%</div>
                    <div class="quiz-result-stat-label">Accuracy</div>
                </div>
                <div class="quiz-result-stat">
                    <div class="quiz-result-stat-value">${rewards.rewardedStudents || 0}</div>
                    <div class="quiz-result-stat-label">Heroes Rewarded</div>
                </div>
            </div>
            ${rewardHTML}
            <button class="quiz-start-btn bubbly-button" id="quiz-finish-btn">
                <i class="fas fa-check mr-2"></i> Finish
            </button>
        </div>
    `;

    wireHeaderListeners();
    document.getElementById('quiz-finish-btn')?.addEventListener('click', () => closeQuizModal());
}

function renderCompletedScreen(quizResults) {
    const contentEl = document.getElementById('quiz-modal-content');
    if (!contentEl) return;

    const tier = quizResults?.tier || 'common';
    const tierClass = `tier-${tier}`;
    const tierEmoji = { legendary: '👑', epic: '🌟', rare: '💎', common: '🎯', heroic: '🛡️' }[tier] || '🎯';

    contentEl.innerHTML = `
        <div class="quiz-modal-header">
            <span class="quiz-modal-title">Quiz of the Week</span>
            <button class="quiz-modal-close" id="quiz-close-btn"><i class="fas fa-times"></i></button>
        </div>
        <div class="quiz-completed-state">
            <div class="quiz-completed-icon">${tierEmoji}</div>
            <div class="quiz-result-tier ${tierClass}">${tier.toUpperCase()}</div>
            <p style="color:rgba(255,255,255,0.6);">This week's quiz is complete!</p>
            <div class="quiz-result-stats">
                <div class="quiz-result-stat">
                    <div class="quiz-result-stat-value">${quizResults?.firstTryCorrectPct || 0}%</div>
                    <div class="quiz-result-stat-label">Accuracy</div>
                </div>
                <div class="quiz-result-stat">
                    <div class="quiz-result-stat-value">${quizResults?.totalQuestions || 0}</div>
                    <div class="quiz-result-stat-label">Questions</div>
                </div>
            </div>
            <button class="quiz-start-btn bubbly-button" id="quiz-finish-btn">
                <i class="fas fa-check mr-2"></i> Close
            </button>
        </div>
    `;

    wireHeaderListeners();
    document.getElementById('quiz-finish-btn')?.addEventListener('click', () => closeQuizModal());
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

function wireHeaderListeners() {
    document.getElementById('quiz-close-btn')?.addEventListener('click', () => closeQuizModal());
}

function wireAnswerListeners(question) {
    const isMcq = question.type === 'mcq';
    const isFill = question.type === 'fill';
    const isImage = question.type === 'image';
    const correctAnswer = question.type === 'mcq'
        ? question.options?.[question.correctIndex]
        : question.correctAnswer;

    if (isFill || isImage) {
        document.getElementById('quiz-fill-submit-btn')?.addEventListener('click', () => handleFillAnswer(correctAnswer, question.explanation));
        document.getElementById('quiz-fill-answer')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleFillAnswer(correctAnswer, question.explanation);
        });
    }

    if (isMcq) {
        document.querySelectorAll('.quiz-answer-btn').forEach(btn => {
            btn.addEventListener('click', () => handleMcqAnswer(btn, question));
        });
    }

    document.getElementById('quiz-skip-btn')?.addEventListener('click', () => {
        const progress = skipQuestion(currentClassId);
        if (!progress) return;
        if (progress.isComplete) {
            finalizeQuiz(currentClassId).then(results => {
                if (results) renderResultsScreen(results);
            });
        } else {
            const next = getCurrentQuestion(currentClassId);
            if (next) renderQuestion(next);
        }
    });
}

async function handleMcqAnswer(btn, question) {
    // Disable all answer buttons
    document.querySelectorAll('.quiz-answer-btn').forEach(b => b.disabled = true);

    const answerIndex = parseInt(btn.dataset.answerIndex);
    const isCorrect = question.type === 'mcq'
        ? answerIndex === question.correctIndex
        : (btn.dataset.answerText || '').trim().toLowerCase() === (question.correctAnswer || '').trim().toLowerCase();

    if (isCorrect) {
        btn.classList.add('answer-correct');
        playSound('confirm');
        showExplanation(question.explanation || 'Correct! Well done!');
    } else {
        btn.classList.add('answer-wrong');
        playSound('star_remove');
        highlightCorrectOption(question);
        showExplanation(question.explanation || 'Not quite. Let\'s try again!');
    }

    const result = await handleAnswer(currentClassId, btn.dataset.answerText || String(answerIndex), isCorrect);
    showNextAction(isCorrect, result);
}

async function handleFillAnswer(correctAnswer, explanation) {
    const input = document.getElementById('quiz-fill-answer');
    const feedbackEl = document.getElementById('quiz-fill-feedback');
    const submitBtn = document.getElementById('quiz-fill-submit-btn');
    if (!input || !feedbackEl) return;

    const userAnswer = input.value.trim();
    const isCorrect = userAnswer.toLowerCase() === (correctAnswer || '').trim().toLowerCase();

    if (submitBtn) submitBtn.disabled = true;
    if (input) input.disabled = true;

    feedbackEl.classList.remove('hidden');
    if (isCorrect) {
        feedbackEl.style.background = 'rgba(34,197,94,0.15)';
        feedbackEl.style.borderColor = 'rgba(34,197,94,0.3)';
        feedbackEl.innerText = 'Correct! ' + (explanation || '');
        playSound('confirm');
    } else {
        feedbackEl.style.background = 'rgba(239,68,68,0.15)';
        feedbackEl.style.borderColor = 'rgba(239,68,68,0.3)';
        feedbackEl.innerText = `Incorrect. The answer was: "${correctAnswer}"`;
        playSound('star_remove');
    }

    const result = await handleAnswer(currentClassId, userAnswer, isCorrect);
    showNextAction(isCorrect, result);
}

function highlightCorrectOption(question) {
    if (question.type !== 'mcq') return;
    const correctBtn = document.querySelector(`.quiz-answer-btn[data-answer-index="${question.correctIndex}"]`);
    if (correctBtn) {
        correctBtn.classList.add('answer-correct');
    }
}

function showExplanation(text) {
    const area = document.getElementById('quiz-explanation-area');
    if (area) {
        area.innerText = text;
        area.classList.remove('hidden');
        area.style.animation = 'none';
        void area.offsetHeight;
        area.style.animation = 'slideUpFade 0.3s ease';
    }
}

function showNextAction(isCorrect, result) {
    const nextBtn = document.getElementById('quiz-next-btn');
    if (!nextBtn) return;

    // Hide skip once an answer has been submitted
    document.getElementById('quiz-skip-btn')?.classList.add('hidden');

    const isComplete = result?.isComplete || false;
    nextBtn.classList.remove('hidden');

    if (isComplete) {
        nextBtn.innerHTML = '<i class="fas fa-trophy mr-2"></i> See Results!';
        nextBtn.addEventListener('click', async () => {
            const final = await finalizeQuiz(currentClassId);
            renderResultsScreen(final);
        }, { once: true });
    } else if (isCorrect) {
        nextBtn.innerHTML = '<i class="fas fa-arrow-right mr-2"></i> Next Question';
        nextBtn.addEventListener('click', () => showNextQuestion(), { once: true });
    } else {
        // Wrong answer — pass to next student (or skip if all students exhausted)
        nextBtn.innerHTML = '<i class="fas fa-user-group mr-2"></i> Try Another Student';
        nextBtn.addEventListener('click', () => showNextQuestion(), { once: true });
    }
}

// =============================================================================
// QUESTION FLOW
// =============================================================================

function showNextQuestion() {
    const questionData = getCurrentQuestion(currentClassId);
    if (!questionData) {
        // No more questions
        handleQuizComplete();
        return;
    }

    const qs = getQuizState(currentClassId);
    renderQuestion(questionData, qs);
}

async function handleQuizComplete() {
    const progress = getQuizProgress(currentClassId);
    if (progress && progress.isComplete) {
        const results = await finalizeQuiz(currentClassId);
        renderResultsScreen(results);
    }
}

// =============================================================================
// MODAL OPEN / CLOSE
// =============================================================================

export async function openQuizModal(classId) {
    currentClassId = classId;
    ensureModalInDOM();

    // Check if quiz is already completed
    const quiz = await getQuizForClass(classId);
    if (quiz?.status === 'completed' && quiz.results) {
        showAnimatedModal(MODAL_ID);
        renderCompletedScreen(quiz.results);
        return;
    }

    // Load quiz data
    const loaded = await loadQuizForClass(classId);
    if (!loaded) {
        console.error('Failed to load quiz for class:', classId);
        return;
    }

    const qs = getQuizState(classId);

    showAnimatedModal(MODAL_ID);
    renderIntroScreen(quiz, qs);

    // Backdrop click to close — but not during active quiz
    const backdrop = document.getElementById(MODAL_ID);
    if (backdrop) {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeQuizModal();
        });
    }
}

export function closeQuizModal() {
    hideModal(MODAL_ID);
    currentClassId = null;
}

// =============================================================================
// HELPERS
// =============================================================================

function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
}

function computeTier(pct) {
    if (pct === 100) return 'legendary';
    if (pct >= 80) return 'epic';
    if (pct >= 60) return 'rare';
    if (pct >= 40) return 'common';
    return 'heroic';
}
