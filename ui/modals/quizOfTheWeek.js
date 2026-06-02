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
let _justCompleted = false; // track if quiz completed during this session

// =============================================================================
// HTML TEMPLATE
// =============================================================================

function getModalHTML() {
    return `
<div id="${MODAL_ID}" class="fixed inset-0 z-[90] flex items-center justify-center p-3 hidden backdrop-blur-sm">
    <div id="quiz-modal-inner" class="quiz-modal-inner">
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
// SPARKLE BURST (from trigger button origin)
// =============================================================================

function spawnSparkleBurst(originEl) {
    if (!originEl) return;
    const rect = originEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const colors = ['#fbbf24', '#f59e0b', '#fde68a', '#a78bfa', '#38bdf8', '#4ade80', '#fb7185'];
    for (let i = 0; i < 14; i++) {
        const el = document.createElement('div');
        el.className = 'quiz-sparkle-particle';
        const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 55 + Math.random() * 60;
        el.style.cssText = `
            left: ${cx - 4}px;
            top: ${cy - 4}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            --sx: ${Math.cos(angle) * dist}px;
            --sy: ${Math.sin(angle) * dist}px;
            animation-duration: ${0.55 + Math.random() * 0.35}s;
            animation-delay: ${Math.random() * 0.1}s;
        `;
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove(), { once: true });
    }
}

// =============================================================================
// RENDER FUNCTIONS
// =============================================================================

function renderIntroScreen(quiz, qs) {
    const contentEl = document.getElementById('quiz-modal-content');
    if (!contentEl) return;

    const studentCount = qs.studentPool.length;
    const questionCount = qs.totalQuestions;
    const absentCount = qs.absentCount || 0;

    const curriculum = quiz?.curriculum;
    const curriculumHTML = curriculum ? `
        <div class="quiz-intro-curriculum">
            ${curriculum.type ? curriculum.type.charAt(0).toUpperCase() + curriculum.type.slice(1) : 'Quiz'}
            ${curriculum.categories?.length ? '— ' + curriculum.categories.slice(0, 2).join(', ') : ''}
        </div>` : '';

    const absentBadgeHTML = absentCount > 0 ? `
        <div class="quiz-absent-badge">
            <i class="fas fa-user-slash"></i>
            <span class="absent-dot">${absentCount}</span>
            <span>absent today — excluded from pool</span>
        </div>` : '';

    contentEl.innerHTML = `
        <div class="quiz-modal-header">
            <span class="quiz-modal-title">⚔️ Quiz of the Week</span>
            <button class="quiz-modal-close" id="quiz-close-btn"><i class="fas fa-times"></i></button>
        </div>
        <div class="quiz-intro">
            <div class="quiz-intro-icon">🎯</div>
            <div class="quiz-intro-title">Ready, Quest Heroes?</div>
            <p class="quiz-intro-subtitle">
                ${questionCount} questions on this week's curriculum. Students will be picked at random to answer!
            </p>
            ${curriculumHTML}
            <div class="quiz-intro-stats">
                <div class="quiz-intro-stat">
                    <div class="quiz-intro-stat-num">${questionCount}</div>
                    <div class="quiz-intro-stat-label">Questions</div>
                </div>
                <div class="quiz-intro-stat">
                    <div class="quiz-intro-stat-num">${studentCount}</div>
                    <div class="quiz-intro-stat-label">Present</div>
                </div>
            </div>
            ${absentBadgeHTML}
            <button class="quiz-start-btn bubbly-button" id="quiz-begin-btn">
                <i class="fas fa-play mr-2"></i> Begin the Quiz!
            </button>
        </div>
    `;

    wireHeaderListeners();
    document.getElementById('quiz-begin-btn')?.addEventListener('click', () => {
        playSound('quiz_open');
        showNextQuestion();
    });
}

function renderQuestion(questionData, qs) {
    const contentEl = document.getElementById('quiz-modal-content');
    if (!contentEl) return;

    const progress = getQuizProgress(currentClassId);
    const pct = progress ? Math.round((progress.answeredCount / progress.totalQuestions) * 100) : 0;
    const q = questionData.question;
    const student = questionData.student;

    const labels = ['A', 'B', 'C', 'D'];
    const optionsHTML = (q.options || []).map((opt, i) => `
        <button class="quiz-answer-btn" data-answer-index="${i}" data-answer-text="${escapeHTML(opt)}">
            <span class="quiz-answer-label">${labels[i] || i + 1}</span>
            <span class="quiz-answer-copy">${opt}</span>
        </button>
    `).join('');

    const spotlightEl = student ? `
        <div class="quiz-spotlight-bar quiz-spotlight-entering">
            <div class="quiz-spotlight-avatar">
                ${student.avatar
                    ? `<img src="${student.avatar}" alt="${student.name || ''}" />`
                    : `<i class="fas fa-hat-wizard"></i>`}
            </div>
            <div>
                <div class="quiz-spotlight-name">${student.name || 'Hero'}</div>
                <div class="quiz-spotlight-label">✨ Your turn!</div>
            </div>
            <div class="quiz-spotlight-star">
                <i class="fas fa-star"></i> ${questionData.score?.totalStars || 0}
            </div>
        </div>` : '';

    const questionAreaHTML = `
        <div class="quiz-question-area quiz-question-entering">
            <div class="quiz-question-kicker">Multiple Choice Challenge</div>
            <div class="quiz-question-emoji">✨</div>
            <div class="quiz-question-text">${q.question}</div>
        </div>`;

    const answerGridHTML = `
        <div class="quiz-answer-grid">
            ${optionsHTML}
        </div>`;

    contentEl.innerHTML = `
        <div class="quiz-modal-header">
            <span class="quiz-modal-title">⚔️ Quiz of the Week</span>
            <button class="quiz-modal-close" id="quiz-close-btn"><i class="fas fa-times"></i></button>
        </div>
        <div class="quiz-progress-bar">
            <div class="quiz-progress-fill" style="width:${pct}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
            <span class="quiz-progress-label">Q ${progress.answeredCount + 1} / ${progress.totalQuestions}</span>
            <div class="quiz-score-tracker">
                <span class="quiz-score-correct"><i class="fas fa-check-circle"></i> ${progress.correctFirstTry}</span>
                <span class="quiz-score-sep">/</span>
                <span style="color:rgba(0,0,0,0.5);">${progress.totalQuestions}</span>
                <span style="color:rgba(0,0,0,0.4);font-size:0.78rem;">correct</span>
            </div>
        </div>
        ${spotlightEl}
        <div class="quiz-question-layout">
            ${questionAreaHTML}
            ${answerGridHTML}
        </div>
        <div id="quiz-explanation-area" class="quiz-explanation hidden"></div>
        <div id="quiz-action-area" style="display:flex;flex-direction:column;gap:0.6rem;">
            <button class="quiz-next-btn bubbly-button hidden" id="quiz-next-btn">
                <i class="fas fa-arrow-right mr-2"></i> Next Question
            </button>
            <button class="quiz-skip-btn" id="quiz-skip-btn">
                <i class="fas fa-forward-fast mr-1"></i> Skip Question
            </button>
        </div>
    `;

    wireHeaderListeners();
    playSound('quiz_question_in');
    if (student) {
        setTimeout(() => playSound('quiz_student_reveal'), 200);
    }
    requestAnimationFrame(() => {
        document.querySelectorAll('.quiz-answer-btn').forEach((btn, i) => {
            setTimeout(() => {
                btn.classList.add('quiz-answer-visible');
            }, i * 65);
        });
    });
    wireAnswerListeners(q);
}

function renderCalculatingScreen() {
    const contentEl = document.getElementById('quiz-modal-content');
    if (!contentEl) return;
    contentEl.innerHTML = `
        <div class="quiz-modal-header">
            <span class="quiz-modal-title">⚔️ Quiz of the Week</span>
        </div>
        <div class="quiz-calculating">
            <div class="quiz-calculating-spinner"></div>
            <div class="quiz-calculating-text">Calculating Results…</div>
        </div>
    `;
}

function renderResultsScreen(results) {
    const contentEl = document.getElementById('quiz-modal-content');
    if (!contentEl) return;

    _justCompleted = true;

    const tier = results.rewards?.tier || results.tier || computeTier(results.firstTryCorrectPct);
    const tierEmoji = { legendary: '👑', epic: '🌟', rare: '💎', common: '🎯', heroic: '🛡️' }[tier] || '🎯';

    const rewards = results.rewards || {};
    const correctStudentDetails = rewards.correctStudentDetails || [];
    const guildDetails = rewards.guildDetails || [];
    const awardedArtifacts = rewards.awardedArtifacts || [];
    const totalStarsGranted = (rewards.studentRewards || []).reduce((sum, reward) => sum + (Number(reward.stars) || 0), 0);

    const stats = [
        { value: results.totalQuestions || 0, label: 'Questions' },
        { value: results.correctFirstTry || 0, label: 'Correct 1st Try' },
        { value: `${results.firstTryCorrectPct || 0}%`, label: 'Accuracy' },
        { value: totalStarsGranted, label: 'Stars Granted' },
    ];

    // ── Phase A: Spinner ──
    contentEl.innerHTML = `
        <div class="quiz-modal-header">
            <span class="quiz-modal-title">⚔️ Quiz Complete!</span>
            <button class="quiz-modal-close" id="quiz-close-btn"><i class="fas fa-times"></i></button>
        </div>
        <div class="quiz-results-stage" id="quiz-results-stage">
            <div class="quiz-calculating" id="quiz-calc-phase">
                <div class="quiz-calculating-spinner"></div>
                <div class="quiz-calculating-text">Tallying scores…</div>
            </div>
        </div>
    `;
    wireHeaderListeners();

    const stage = document.getElementById('quiz-results-stage');

    // ── Phase B: Tier reveal at +900ms ──
    setTimeout(() => {
        if (!stage || !document.contains(stage)) return;
        document.getElementById('quiz-calc-phase')?.remove();

        playSound('quiz_tier_reveal');

        const emojiWrap = document.createElement('div');
        emojiWrap.className = 'quiz-tier-emoji-wrap';
        emojiWrap.textContent = tierEmoji;
        stage.appendChild(emojiWrap);

        setTimeout(() => {
            if (!document.contains(stage)) return;
            const tierEl = document.createElement('div');
            tierEl.className = `quiz-result-tier tier-${tier}`;
            tierEl.textContent = tier.toUpperCase();
            stage.appendChild(tierEl);
        }, 350);

        // ── Phase C: Stats count-up at +800ms from B ──
        setTimeout(() => {
            if (!document.contains(stage)) return;
            const statsWrap = document.createElement('div');
            statsWrap.className = 'quiz-result-stats';
            statsWrap.innerHTML = stats.map((s, i) => `
                <div class="quiz-result-stat" id="quiz-stat-${i}" style="animation-delay:${i * 110}ms">
                    <div class="quiz-result-stat-value" id="quiz-stat-val-${i}">${typeof s.value === 'number' ? 0 : s.value}</div>
                    <div class="quiz-result-stat-label">${s.label}</div>
                </div>
            `).join('');
            stage.appendChild(statsWrap);

            stats.forEach((s, i) => {
                const card = document.getElementById(`quiz-stat-${i}`);
                const valEl = document.getElementById(`quiz-stat-val-${i}`);
                if (card) setTimeout(() => card.classList.add('quiz-stat-visible'), i * 110 + 30);
                if (valEl && typeof s.value === 'number') animateCount(valEl, 0, s.value, 900 + i * 80);
            });

            // ── Phase D: Hero Roster at +1600ms from C ──
            setTimeout(() => {
                if (!document.contains(stage)) return;

                if (correctStudentDetails.length > 0) {
                    const heroSection = document.createElement('div');
                    heroSection.className = 'quiz-hero-section';
                    heroSection.innerHTML = `
                        <div class="quiz-section-heading" id="quiz-heading-heroes">⚔️ Correct Heroes</div>
                        <div class="quiz-hero-roster" id="quiz-hero-roster"></div>`;
                    stage.appendChild(heroSection);

                    setTimeout(() => document.getElementById('quiz-heading-heroes')?.classList.add('quiz-section-heading-visible'), 60);

                    const roster = document.getElementById('quiz-hero-roster');
                    correctStudentDetails.forEach((student, i) => {
                        const card = document.createElement('div');
                        card.className = 'quiz-hero-card';
                        const solvedAnswers = (student.solvedAnswers || []).slice(0, 3);
                        card.innerHTML = `
                            <div class="quiz-hero-avatar">
                                ${student.avatar
                                    ? `<img src="${student.avatar}" alt="${student.name || ''}" />`
                                    : `<i class="fas fa-hat-wizard"></i>`}
                            </div>
                            <div class="quiz-hero-info">
                                <div class="quiz-hero-name">${student.name || 'Hero'}</div>
                                <div class="quiz-hero-meta">Solved ${student.correctCount || 0} question${(student.correctCount || 0) === 1 ? '' : 's'} • ${student.attemptedCount || 0} turn${(student.attemptedCount || 0) === 1 ? '' : 's'}</div>
                                <div class="quiz-hero-rewards">
                                    ${(student.awardedStars || 0) > 0 ? `<span class="quiz-hero-reward-pill stars">+${student.awardedStars}⭐</span>` : ''}
                                    ${(student.awardedGold || 0) > 0 ? `<span class="quiz-hero-reward-pill gold">+${student.awardedGold}🪙</span>` : ''}
                                </div>
                                ${solvedAnswers.length > 0 ? `<div class="quiz-hero-answer-chips">${solvedAnswers.map((answer) => `<span class="quiz-hero-answer-chip">${escapeHTML(answer.answer)}</span>`).join('')}</div>` : ''}
                            </div>`;
                        roster.appendChild(card);
                        setTimeout(() => card.classList.add('quiz-hero-card-visible'), i * 130 + 90);
                    });
                }

                const heroDelay = correctStudentDetails.length > 0
                    ? Math.max(correctStudentDetails.length * 130 + 420, 600)
                    : 200;

                // ── Phase E: Guild Rewards ──
                setTimeout(() => {
                    if (!document.contains(stage)) return;

                    if (guildDetails.length > 0) {
                        const guildSection = document.createElement('div');
                        guildSection.className = 'quiz-guild-section';
                        guildSection.innerHTML = `
                            <div class="quiz-section-heading" id="quiz-heading-guilds">⚜️ Guild Rewards</div>
                            <div class="quiz-guild-list" id="quiz-guild-list"></div>`;
                        stage.appendChild(guildSection);

                        setTimeout(() => document.getElementById('quiz-heading-guilds')?.classList.add('quiz-section-heading-visible'), 60);

                        const list = document.getElementById('quiz-guild-list');
                        guildDetails.forEach((g, i) => {
                            const row = document.createElement('div');
                            row.className = 'quiz-guild-row';
                            row.style.setProperty('--guild-primary', g.primary || '#fbbf24');
                            const contributors = (g.contributors || []).slice(0, 3);
                            row.innerHTML = `
                                <span class="quiz-guild-emoji">${g.emoji}</span>
                                <div class="quiz-guild-copy">
                                    <span class="quiz-guild-name">${g.name}</span>
                                    ${contributors.length > 0 ? `<span class="quiz-guild-contributors">${contributors.map((contributor) => `${escapeHTML(contributor.name)} x${contributor.correctCount}`).join(' • ')}</span>` : ''}
                                </div>
                                <span class="quiz-guild-glory">+${g.glory} Glory</span>`;
                            list.appendChild(row);
                            setTimeout(() => row.classList.add('quiz-guild-row-visible'), i * 140 + 90);
                        });
                    }

                    const guildDelay2 = guildDetails.length > 0
                        ? Math.max(guildDetails.length * 140 + 380, 500)
                        : 150;

                    // ── Phase F: Artifacts ──
                    setTimeout(() => {
                        if (!document.contains(stage)) return;

                        if (awardedArtifacts.length > 0) {
                            const artSection = document.createElement('div');
                            artSection.className = 'quiz-artifact-section';
                            artSection.innerHTML = `
                                <div class="quiz-section-heading" id="quiz-heading-artifacts">🎁 Artifacts Awarded</div>
                                <div class="quiz-artifact-list" id="quiz-artifact-list"></div>`;
                            stage.appendChild(artSection);

                            setTimeout(() => document.getElementById('quiz-heading-artifacts')?.classList.add('quiz-section-heading-visible'), 60);

                            const artList = document.getElementById('quiz-artifact-list');
                            awardedArtifacts.forEach((aw, i) => {
                                const card = document.createElement('div');
                                card.className = 'quiz-artifact-card';
                                const recip = correctStudentDetails.find(s => s.id === aw.studentId);
                                const recipName = recip?.name || 'A hero';
                                card.innerHTML = `
                                    <span class="quiz-artifact-icon">${aw.artifact?.icon || '🎁'}</span>
                                    <div class="quiz-artifact-info">
                                        <div class="quiz-artifact-name">${aw.artifact?.name || 'Artifact'}</div>
                                        <div class="quiz-artifact-recipient">→ ${recipName}</div>
                                    </div>`;
                                artList.appendChild(card);
                                setTimeout(() => card.classList.add('quiz-artifact-card-visible'), i * 160 + 90);
                            });
                        }

                        const artDelay = awardedArtifacts.length > 0
                            ? Math.max(awardedArtifacts.length * 160 + 380, 500)
                            : 150;

                        // ── Phase G: Finish button + confetti ──
                        setTimeout(() => {
                            if (!document.contains(stage)) return;

                            const finishBtn = document.createElement('button');
                            finishBtn.className = 'quiz-results-finish-btn bubbly-button';
                            finishBtn.innerHTML = '<i class="fas fa-flag-checkered mr-2"></i> Finish!';
                            stage.appendChild(finishBtn);
                            setTimeout(() => finishBtn.classList.add('quiz-finish-visible'), 40);
                            finishBtn.addEventListener('click', () => closeQuizModal(true), { once: true });

                            if (tier === 'legendary' || tier === 'epic') {
                                spawnConfetti(tier);
                                playSound('quiz_confetti_pop');
                            }
                            if (tier === 'legendary') {
                                // second burst delayed for legendary
                                setTimeout(() => { spawnConfetti(tier); playSound('quiz_confetti_pop'); }, 700);
                            }
                        }, artDelay);

                    }, guildDelay2);

                }, heroDelay);

            }, 1600);

        }, 800);

    }, 900);
}

function renderCompletedScreen(quizResults) {
    const contentEl = document.getElementById('quiz-modal-content');
    if (!contentEl) return;

    const tier = quizResults?.tier || 'common';
    const tierEmoji = { legendary: '👑', epic: '🌟', rare: '💎', common: '🎯', heroic: '🛡️' }[tier] || '🎯';

    contentEl.innerHTML = `
        <div class="quiz-modal-header">
            <span class="quiz-modal-title">⚔️ Quiz of the Week</span>
            <button class="quiz-modal-close" id="quiz-close-btn"><i class="fas fa-times"></i></button>
        </div>
        <div class="quiz-completed-state">
            <div class="quiz-completed-icon">${tierEmoji}</div>
            <div class="quiz-result-tier tier-${tier}">${tier.toUpperCase()}</div>
            <p style="color:rgba(0,0,0,0.5);text-align:center;">This week's quiz is already complete!</p>
            <div class="quiz-result-stats">
                <div class="quiz-result-stat quiz-stat-visible">
                    <div class="quiz-result-stat-value">${quizResults?.firstTryCorrectPct || 0}%</div>
                    <div class="quiz-result-stat-label">Accuracy</div>
                </div>
                <div class="quiz-result-stat quiz-stat-visible">
                    <div class="quiz-result-stat-value">${quizResults?.totalQuestions || 0}</div>
                    <div class="quiz-result-stat-label">Questions</div>
                </div>
            </div>
            <button class="quiz-start-btn bubbly-button" id="quiz-finish-btn" style="margin-top:0.5rem;">
                <i class="fas fa-check mr-2"></i> Close
            </button>
        </div>
    `;

    wireHeaderListeners();
    document.getElementById('quiz-finish-btn')?.addEventListener('click', () => closeQuizModal(false));
}

// =============================================================================
// CONFETTI
// =============================================================================

function spawnConfetti(tier) {
    const tierColors = {
        legendary: ['#fbbf24', '#f59e0b', '#fde68a', '#d97706', '#ffffff', '#ffe566', '#fef08a'],
        epic: ['#a78bfa', '#8b5cf6', '#c4b5fd', '#7c3aed', '#e9d5ff', '#ddd6fe', '#fff'],
    };
    const colors = tierColors[tier] || tierColors.legendary;
    const count = tier === 'legendary' ? 55 : 35;
    // Weighted shapes: more circles/squares than stars for performance
    const shapes = ['circle', 'circle', 'square', 'square', 'star'];

    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'quiz-confetti-piece';
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const size = 6 + Math.random() * 11;
        const startX = 5 + Math.random() * 90;
        const dur = 1.0 + Math.random() * 1.3;
        const delay = Math.random() * 0.9;
        const color = colors[Math.floor(Math.random() * colors.length)];

        let shapeCSS = '';
        if (shape === 'circle') shapeCSS = 'border-radius:50%;';
        else if (shape === 'square') shapeCSS = 'border-radius:2px;';
        else shapeCSS = 'clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);';

        el.style.cssText = `
            left:${startX}vw;top:-12px;
            width:${size}px;height:${size}px;
            background:${color};${shapeCSS}
            --cr:${Math.random() * 720 - 360}deg;
            --cd:${dur}s;--cdel:${delay}s;
        `;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), (dur + delay) * 1000 + 300);
    }
}

// =============================================================================
// FLOATING CHECK / PARTICLE BURST / WRONG EFFECT
// =============================================================================

function spawnFloatingCheck(triggerEl) {
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'quiz-float-check';
    el.textContent = '✓';
    el.style.left = `${rect.left + rect.width / 2 - 22}px`;
    el.style.top = `${rect.top + rect.height / 2 - 22}px`;
    el.style.color = '#22c55e';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
}

function spawnParticleBurst(triggerEl) {
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ['#22c55e', '#4ade80', '#86efac', '#fbbf24', '#fde68a'];
    for (let i = 0; i < 5; i++) {
        const el = document.createElement('div');
        el.className = 'quiz-particle';
        const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 30 + Math.random() * 40;
        el.style.cssText = `
            left: ${cx - 3}px;
            top: ${cy - 3}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            --px: ${Math.cos(angle) * dist}px;
            --py: ${Math.sin(angle) * dist}px;
        `;
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove(), { once: true });
    }
}

// =============================================================================
// COUNT-UP ANIMATION
// =============================================================================

function animateCount(el, from, to, duration) {
    const start = performance.now();
    const isFloat = !Number.isInteger(to);
    function step(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const current = from + (to - from) * eased;
        el.textContent = isFloat ? current.toFixed(1) : Math.round(current);
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = to;
    }
    requestAnimationFrame(step);
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

function wireHeaderListeners() {
    document.getElementById('quiz-close-btn')?.addEventListener('click', () => closeQuizModal(false));
}

function wireAnswerListeners(question) {
    document.querySelectorAll('.quiz-answer-btn').forEach(btn => {
        btn.addEventListener('click', () => handleMcqAnswer(btn, question));
    });

    document.getElementById('quiz-skip-btn')?.addEventListener('click', () => {
        const progress = skipQuestion(currentClassId);
        if (!progress) return;
        if (progress.isComplete) {
            renderCalculatingScreen();
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
    document.querySelectorAll('.quiz-answer-btn').forEach(b => b.disabled = true);

    const answerIndex = parseInt(btn.dataset.answerIndex);
    const isCorrect = answerIndex === question.correctIndex;
    const selectedAnswer = btn.dataset.answerText || String(answerIndex);

    if (isCorrect) {
        btn.classList.add('answer-correct');
        playSound('quiz_correct');
        spawnFloatingCheck(btn);
        spawnParticleBurst(btn);
    } else {
        btn.classList.add('answer-wrong');
        playSound('quiz_wrong');
        const qArea = document.querySelector('.quiz-question-area');
        if (qArea) {
            qArea.style.animation = 'quiz-red-wash 0.5s ease forwards';
            setTimeout(() => { qArea.style.animation = ''; }, 500);
        }
    }

    const result = await handleAnswer(currentClassId, selectedAnswer, isCorrect);

    if (isCorrect) {
        showExplanation(question.explanation || 'Correct! Great solve.', true);
    } else {
        if (result?.questionPassedToNextStudent) {
            const grid = document.querySelector('.quiz-answer-grid');
            if (grid) {
                setTimeout(() => grid.classList.add('quiz-answer-grid--blurred'), 650);
            }
            showExplanation('Not quite. The answer stays hidden and the question passes to another hero.', false);
        } else {
            highlightCorrectOption(question);
            showExplanation(`No one solved it this round. Correct answer: ${question.options?.[question.correctIndex] || ''}`, false);
        }
    }

    showNextAction(isCorrect, result);
}

function highlightCorrectOption(question) {
    if (question.type !== 'mcq') return;
    const correctBtn = document.querySelector(`.quiz-answer-btn[data-answer-index="${question.correctIndex}"]`);
    if (correctBtn) correctBtn.classList.add('answer-correct');
}

function showExplanation(text, isCorrect) {
    const area = document.getElementById('quiz-explanation-area');
    if (!area) return;
    area.textContent = text;
    area.className = 'quiz-explanation' + (isCorrect ? ' quiz-explanation-correct' : '');
    area.classList.remove('hidden');
    area.style.animation = 'none';
    void area.offsetHeight;
    area.style.animation = 'slideUpFade 0.35s ease';
}

function showNextAction(isCorrect, result) {
    const nextBtn = document.getElementById('quiz-next-btn');
    if (!nextBtn) return;

    document.getElementById('quiz-skip-btn')?.classList.add('hidden');

    const isComplete = result?.isComplete || false;
    nextBtn.classList.remove('hidden');
    // Trigger the slide-up animation by forcing reflow
    nextBtn.style.animation = 'none';
    void nextBtn.offsetHeight;
    nextBtn.style.animation = '';

    if (isComplete) {
        nextBtn.innerHTML = '<i class="fas fa-trophy mr-2"></i> See Results!';
        nextBtn.addEventListener('click', async () => {
            renderCalculatingScreen();
            const final = await finalizeQuiz(currentClassId);
            if (final) renderResultsScreen(final);
        }, { once: true });
    } else if (isCorrect || result?.questionResolved) {
        nextBtn.innerHTML = '<i class="fas fa-arrow-right mr-2"></i> Next Question';
        nextBtn.addEventListener('click', () => showNextQuestion(), { once: true });
    } else {
        nextBtn.innerHTML = '<i class="fas fa-users mr-2"></i> Try Another Student';
        nextBtn.addEventListener('click', () => showNextQuestion(), { once: true });
    }
}

// =============================================================================
// QUESTION FLOW
// =============================================================================

function showNextQuestion() {
    const questionData = getCurrentQuestion(currentClassId);
    if (!questionData) {
        handleQuizComplete();
        return;
    }
    const qs = getQuizState(currentClassId);
    renderQuestion(questionData, qs);
}

async function handleQuizComplete() {
    const progress = getQuizProgress(currentClassId);
    if (progress && progress.isComplete) {
        renderCalculatingScreen();
        const results = await finalizeQuiz(currentClassId);
        if (results) renderResultsScreen(results);
    }
}

// =============================================================================
// MODAL OPEN / CLOSE
// =============================================================================

export async function openQuizModal(classId) {
    currentClassId = classId;
    _justCompleted = false;
    ensureModalInDOM();

    const triggerBtn = document.getElementById('quiz-week-trigger-btn');

    // Check if quiz is already completed
    const quiz = await getQuizForClass(classId);
    if (quiz?.status === 'completed' && quiz.results) {
        showAnimatedModal(MODAL_ID);
        triggerEntrance(triggerBtn);
        renderResultsScreen(quiz.results);
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
    triggerEntrance(triggerBtn);
    renderIntroScreen(quiz, qs);

    // Backdrop click to close
    const backdrop = document.getElementById(MODAL_ID);
    if (backdrop) {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeQuizModal(false);
        }, { once: true });
    }
}

function triggerEntrance(triggerBtn) {
    // Sparkle burst from button
    spawnSparkleBurst(triggerBtn);

    // Backdrop flash
    const backdrop = document.getElementById(MODAL_ID);
    if (backdrop) {
        backdrop.classList.remove('quiz-modal-backdrop-entering');
        void backdrop.offsetWidth; // force reflow
        backdrop.classList.add('quiz-modal-backdrop-entering');
        backdrop.addEventListener('animationend', () => backdrop.classList.remove('quiz-modal-backdrop-entering'), { once: true });
    }

    // Grand entrance animation on modal inner
    const inner = document.getElementById('quiz-modal-inner');
    if (inner) {
        inner.classList.remove('quiz-modal-entering');
        void inner.offsetWidth;
        inner.classList.add('quiz-modal-entering');
        inner.addEventListener('animationend', () => {
            inner.classList.remove('quiz-modal-entering');
        }, { once: true });
    }
}

export function closeQuizModal(wasCompleted = false) {
    hideModal(MODAL_ID);

    // Real-time button update if quiz was completed this session
    if ((wasCompleted || _justCompleted)) {
        animateButtonCompletion();
    }

    _justCompleted = false;
    currentClassId = null;
}

function animateButtonCompletion() {
    const wrap = document.querySelector('.quiz-week-btn-wrap');
    const btn = document.querySelector('.quiz-week-btn');
    if (!btn || !wrap) return;

    // Swap icon to checkmark with green flash
    btn.classList.add('quiz-btn-completing');
    const icon = btn.querySelector('i');
    if (icon) {
        setTimeout(() => {
            icon.className = 'fas fa-check';
            btn.classList.add('quiz-btn-completed');
            btn.classList.remove('quiz-btn-completing');
        }, 350);
    }

    // Then shrink the whole wrap away
    setTimeout(() => {
        wrap.classList.add('quiz-btn-wrap-exit');
        wrap.addEventListener('animationend', () => wrap.remove(), { once: true });
    }, 600);
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