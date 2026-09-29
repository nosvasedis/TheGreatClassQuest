import { showAnimatedModal, hideModal } from './base.js';
import * as state from '../../state.js';
import { playSound } from '../../audio.js';
import {
    loadQuizForClass,
    getCurrentQuestion,
    getActiveTurn,
    hasResumableQuiz,
    handleAnswer,
    skipQuestion,
    getQuizProgress,
    finalizeQuiz,
    getQuizState
} from '../../features/quizOfTheWeek.js';
import { getQuizForClass } from '../../db/actions/quizOfTheWeek.js';
import {
    computeQuizTier,
    computeQuizTrail,
    quizIntroHtml,
    quizPauseCardHtml,
    quizResultsHtml,
    quizStageShellHtml,
    quizTallyHtml,
    quizTurnHtml,
    quizVerdictHtml
} from './quizStageMarkup.js';

const MODAL_ID = 'quiz-of-week-modal';
const LETTERS = ['A', 'B', 'C', 'D'];
let currentClassId = null;
let _justCompleted = false; // the quiz was finished during this opening of the stage
let screen = 'idle'; // intro | turn | tally | results
let busy = false; // an answer is being recorded
let timers = [];

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function later(fn, ms) {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
}

function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
}

function ensureModalInDOM() {
    const existing = document.getElementById(MODAL_ID);
    if (existing?.classList.contains('qs-backdrop')) return;
    existing?.remove();
    const div = document.createElement('div');
    div.innerHTML = quizStageShellHtml(MODAL_ID).trim();
    const modal = div.firstElementChild;
    document.body.appendChild(modal);
    // A click on the dimmed backdrop only closes the stage when nothing is at stake.
    modal.addEventListener('click', (e) => {
        if (e.target === modal) requestClose();
    });
}

function contentEl() {
    return document.getElementById('quiz-modal-content');
}

function setScreen(html, name) {
    const el = contentEl();
    if (!el) return null;
    screen = name;
    el.dataset.screen = name;
    el.innerHTML = html;
    document.getElementById('quiz-close-btn')?.addEventListener('click', requestClose);
    return el;
}

// =============================================================================
// PARTICLES & CONFETTI
// =============================================================================

function spawnSparkleBurst(originEl) {
    if (!originEl || reducedMotion()) return;
    const rect = originEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ['#fbbf24', '#f59e0b', '#fde68a', '#a78bfa', '#38bdf8', '#4ade80', '#fb7185'];
    for (let i = 0; i < 14; i++) {
        const el = document.createElement('div');
        el.className = 'quiz-sparkle-particle';
        const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 55 + Math.random() * 60;
        el.style.cssText = `left:${cx - 4}px;top:${cy - 4}px;background:${colors[Math.floor(Math.random() * colors.length)]};--sx:${Math.cos(angle) * dist}px;--sy:${Math.sin(angle) * dist}px;animation-duration:${0.55 + Math.random() * 0.35}s;animation-delay:${Math.random() * 0.1}s;`;
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove(), { once: true });
    }
}

function spawnParticleBurst(triggerEl) {
    if (!triggerEl || reducedMotion()) return;
    const rect = triggerEl.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.12;
    const cy = rect.top + rect.height / 2;
    const colors = ['#34d399', '#6ee7b7', '#fde68a', '#fbbf24', '#ffffff'];
    for (let i = 0; i < 10; i++) {
        const el = document.createElement('div');
        el.className = 'quiz-particle';
        const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 34 + Math.random() * 46;
        el.style.cssText = `left:${cx - 3}px;top:${cy - 3}px;background:${colors[i % colors.length]};--px:${Math.cos(angle) * dist}px;--py:${Math.sin(angle) * dist}px;`;
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove(), { once: true });
    }
}

function spawnConfetti(tier) {
    if (reducedMotion()) return;
    const tierColors = {
        legendary: ['#fbbf24', '#f59e0b', '#fde68a', '#d97706', '#ffffff', '#ffe566', '#fef08a'],
        epic: ['#a78bfa', '#8b5cf6', '#c4b5fd', '#7c3aed', '#e9d5ff', '#fde68a', '#fff'],
        rare: ['#7dd3fc', '#38bdf8', '#e0f2fe', '#fde68a', '#fff']
    };
    const colors = tierColors[tier] || tierColors.legendary;
    const count = tier === 'legendary' ? 60 : tier === 'epic' ? 40 : 24;
    const shapes = ['circle', 'circle', 'square', 'square', 'star'];
    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'quiz-confetti-piece';
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const size = 6 + Math.random() * 11;
        const dur = 1.2 + Math.random() * 1.4;
        const delay = Math.random() * 0.9;
        const shapeCSS = shape === 'circle' ? 'border-radius:50%;'
            : shape === 'square' ? 'border-radius:2px;'
                : 'clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);';
        el.style.cssText = `left:${5 + Math.random() * 90}vw;top:-12px;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random() * colors.length)]};${shapeCSS}--cr:${Math.random() * 720 - 360}deg;--cd:${dur}s;--cdel:${delay}s;`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), (dur + delay) * 1000 + 300);
    }
}

function animateCount(el, to, duration) {
    const target = Number(to);
    if (!Number.isFinite(target) || reducedMotion()) return;
    const isFloat = !Number.isInteger(target);
    const start = performance.now();
    el.textContent = '0';
    function step(now) {
        if (!document.contains(el)) return;
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const current = target * eased;
        el.textContent = isFloat ? current.toFixed(1) : String(Math.round(current));
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = String(to);
    }
    requestAnimationFrame(step);
}

// =============================================================================
// SCREENS
// =============================================================================

function presentContestants(qs) {
    const students = state.get('allStudents') || [];
    return (qs?.studentPool || [])
        .map((id) => students.find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => ({ id: s.id, name: s.name, avatar: s.avatar || null }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function describeTopic(curriculum) {
    if (!curriculum) return '';
    const type = curriculum.type ? curriculum.type.charAt(0).toUpperCase() + curriculum.type.slice(1) : '';
    const cats = (curriculum.categories || []).slice(0, 3).join(', ');
    return [type, cats].filter(Boolean).join(' · ');
}

function renderIntroScreen(quiz, qs, { resume = false } = {}) {
    const progress = getQuizProgress(currentClassId);
    const html = quizIntroHtml({
        questionCount: qs.totalQuestions,
        contestants: presentContestants(qs),
        absentCount: qs.absentCount || 0,
        topic: describeTopic(quiz?.curriculum),
        resume: resume && progress
            ? { questionNumber: Math.min(progress.answeredCount + 1, progress.totalQuestions), total: progress.totalQuestions }
            : null
    });
    if (!setScreen(html, 'intro')) return;
    const begin = document.getElementById('quiz-begin-btn');
    begin?.addEventListener('click', () => {
        playSound('quiz_open');
        showNextQuestion({ resume });
    }, { once: true });
}

function renderTurn(turn) {
    const qs = getQuizState(currentClassId);
    const progress = getQuizProgress(currentClassId);
    if (!qs || !progress) return;
    const q = turn.question;
    const triedIndexes = (turn.triedAnswers || [])
        .map((answer) => (q.options || []).indexOf(answer))
        .filter((i) => i >= 0);
    const pool = presentContestants(qs);
    const roll = !reducedMotion() && pool.length > 1 && turn.student;

    const html = quizTurnHtml({
        question: q,
        questionNumber: progress.answeredCount + 1,
        total: progress.totalQuestions,
        attemptNumber: turn.attemptNumber || 1,
        student: turn.student,
        stars: turn.score?.totalStars || 0,
        trail: computeQuizTrail(qs.answeredQuestions, qs.attempts),
        firstTryCount: progress.correctFirstTry,
        triedIndexes,
        rolling: Boolean(roll)
    });
    if (!setScreen(html, 'turn')) return;
    busy = false;

    playSound('quiz_question_in');
    const stage = contentEl();
    stage.querySelectorAll('.qs-answer').forEach((btn) => btn.addEventListener('click', () => handleMcqAnswer(btn, q)));
    document.getElementById('quiz-skip-btn')?.addEventListener('click', handleSkip);

    if (roll) spinSpotlight(pool, turn);
    else playSound('quiz_student_reveal');
}

/** Game-show roulette: names flicker under the spotlight, then land on the hero the fair rotation already chose. */
function spinSpotlight(pool, turn) {
    const podium = document.querySelector('.qs-podium');
    const nameEl = podium?.querySelector('[data-quiz-contestant]');
    if (!podium || !nameEl) return;
    const others = pool.filter((s) => s.id !== turn.student.id);
    const steps = [55, 60, 65, 75, 90, 110, 135, 165, 205];
    let index = Math.floor(Math.random() * others.length);
    let elapsed = 0;
    steps.forEach((gap, i) => {
        elapsed += gap;
        later(() => {
            if (!document.contains(nameEl)) return;
            index = (index + 1 + Math.floor(Math.random() * Math.max(1, others.length - 1))) % others.length;
            nameEl.textContent = others[index]?.name || '…';
            nameEl.classList.remove('is-flick');
            void nameEl.offsetWidth;
            nameEl.classList.add('is-flick');
        }, elapsed);
        if (i === steps.length - 1) {
            later(() => landSpotlight(podium, turn), elapsed + 240);
        }
    });
}

function landSpotlight(podium, turn) {
    if (!document.contains(podium)) return;
    const passed = (turn.attemptNumber || 1) > 1;
    podium.querySelector('[data-quiz-contestant]').textContent = turn.student?.name || 'Hero';
    podium.querySelector('.qs-podium__call').textContent = passed ? 'The question passes to' : 'In the spotlight';
    const ring = podium.querySelector('.qs-podium__ring');
    if (ring) {
        const avatar = turn.student?.avatar
            ? `<span class="qs-podium__avatar"><img src="${escapeAttr(turn.student.avatar)}" alt=""></span>`
            : `<span class="qs-podium__avatar qs-podium__avatar--initial" aria-hidden="true">${escapeAttr((turn.student?.name || '?').trim().charAt(0).toUpperCase())}</span>`;
        ring.innerHTML = avatar;
    }
    podium.classList.remove('is-rolling');
    podium.classList.add('is-landed', 'is-landing');
    playSound('quiz_student_reveal');
}

function renderTallyScreen() {
    setScreen(quizTallyHtml(), 'tally');
}

function renderResultsScreen(results, { replay = false } = {}) {
    clearTimers();
    if (!replay) _justCompleted = true;
    const el = setScreen(quizResultsHtml(results, { replay }), 'results');
    if (!el) return;
    const stage = document.getElementById('quiz-results-stage');
    const finish = document.getElementById('quiz-finish-btn');
    finish?.addEventListener('click', () => closeQuizModal(!replay), { once: true });

    // A tap anywhere on the curtain call skips the staged reveal.
    stage?.addEventListener('pointerdown', () => stage.classList.add('is-instant'), { once: true });

    const tier = results.rewards?.tier || results.tier || computeQuizTier(results.firstTryCorrectPct);
    playSound('quiz_tier_reveal');
    el.querySelectorAll('[data-count-to]').forEach((node, i) => later(() => animateCount(node, node.dataset.countTo, 900 + i * 120), 420));
    if (!replay && ['legendary', 'epic', 'rare'].includes(tier)) {
        later(() => { spawnConfetti(tier); playSound('quiz_confetti_pop'); }, 650);
        if (tier === 'legendary') later(() => { spawnConfetti(tier); playSound('quiz_confetti_pop'); }, 1400);
    }
}

// =============================================================================
// ANSWERS
// =============================================================================

async function handleMcqAnswer(btn, question) {
    if (busy || btn.disabled) return;
    const podium = document.querySelector('.qs-podium');
    if (podium?.classList.contains('is-rolling')) return; // wait for the spotlight to land
    busy = true;
    const stage = contentEl();
    stage.querySelectorAll('.qs-answer').forEach((b) => { b.disabled = true; });
    document.getElementById('quiz-skip-btn')?.classList.add('hidden');

    const answerIndex = parseInt(btn.dataset.answerIndex, 10);
    const isCorrect = answerIndex === question.correctIndex;
    const selectedAnswer = btn.dataset.answerText || String(answerIndex);
    const turnAttempt = (getQuizState(currentClassId)?.attempts || []).filter((a) => a.questionId === question.id).length + 1;

    btn.classList.add('is-picked');
    if (isCorrect) {
        btn.classList.add('is-correct');
        playSound('quiz_correct');
        spawnParticleBurst(btn);
    } else {
        btn.classList.add('is-wrong');
        playSound('quiz_wrong');
    }

    const result = await handleAnswer(currentClassId, selectedAnswer, isCorrect);
    if (screen !== 'turn') return;
    refreshTrail();

    let verdict;
    if (isCorrect) {
        stage.classList.add('is-solved');
        verdict = quizVerdictHtml({ kind: 'correct', attemptNumber: turnAttempt, explanation: question.explanation });
    } else if (result?.questionPassedToNextStudent) {
        verdict = quizVerdictHtml({ kind: 'pass' });
    } else {
        stage.querySelector(`.qs-answer[data-answer-index="${question.correctIndex}"]`)?.classList.add('is-reveal');
        verdict = quizVerdictHtml({
            kind: 'missed',
            correctLetter: LETTERS[question.correctIndex] || '',
            correctAnswer: question.options?.[question.correctIndex] || '',
            explanation: question.explanation
        });
    }
    showVerdict(verdict, isCorrect ? 'correct' : result?.questionPassedToNextStudent ? 'pass' : 'missed');
    showNextAction(result, isCorrect);
}

function refreshTrail() {
    const qs = getQuizState(currentClassId);
    const progress = getQuizProgress(currentClassId);
    if (!qs || !progress) return;
    const trail = computeQuizTrail(qs.answeredQuestions, qs.attempts);
    document.querySelectorAll('.qs-trail .qs-pip').forEach((pip, i) => {
        const outcome = trail[i];
        if (!outcome || pip.classList.contains(`is-${outcome}`)) return;
        pip.className = `qs-pip is-${outcome} is-new`;
    });
    const score = document.querySelector('.qs-score strong');
    if (score) score.textContent = String(progress.correctFirstTry);
}

function showVerdict(html, kind) {
    const area = document.getElementById('quiz-explanation-area');
    if (!area) return;
    area.innerHTML = html;
    area.className = `qs-verdict qs-verdict--${kind}`;
    area.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

function showNextAction(result, isCorrect) {
    const nextBtn = document.getElementById('quiz-next-btn');
    if (!nextBtn) return;
    document.querySelector('.qs-foot .qs-keys')?.replaceChildren(Object.assign(document.createElement('span'), { innerHTML: '<kbd>Enter</kbd> to continue' }));

    const isComplete = result?.isComplete || false;
    const [icon, label] = isComplete
        ? ['fa-trophy', 'See the results']
        : (isCorrect || result?.questionResolved)
            ? ['fa-arrow-right', 'Next question']
            : ['fa-people-arrows', 'Pass to another hero'];
    nextBtn.innerHTML = `<i class="fas ${icon}"></i><span>${label}</span>`;
    nextBtn.classList.remove('hidden');
    nextBtn.classList.add('is-arriving');
    nextBtn.addEventListener('click', () => (isComplete ? finishQuiz() : showNextQuestion()), { once: true });
}

function handleSkip() {
    if (busy) return;
    const progress = skipQuestion(currentClassId);
    if (!progress) return;
    if (progress.isComplete) finishQuiz();
    else showNextQuestion();
}

// =============================================================================
// QUESTION FLOW
// =============================================================================

function showNextQuestion({ resume = false } = {}) {
    clearTimers();
    const turn = (resume && getActiveTurn(currentClassId)) || getCurrentQuestion(currentClassId);
    if (!turn) {
        finishQuiz();
        return;
    }
    renderTurn(turn);
}

async function finishQuiz() {
    const progress = getQuizProgress(currentClassId);
    if (!progress?.isComplete || screen === 'tally' || screen === 'results') return;
    clearTimers();
    renderTallyScreen();
    const classId = currentClassId;
    const [results] = await Promise.all([
        finalizeQuiz(classId),
        new Promise((r) => setTimeout(r, reducedMotion() ? 200 : 1500))
    ]);
    if (results && currentClassId === classId) renderResultsScreen(results);
}

// =============================================================================
// PAUSE / CLOSE / KEYBOARD
// =============================================================================

function requestClose() {
    if (screen === 'tally') return; // rewards are being written
    if (screen === 'turn') {
        openPauseCard();
        return;
    }
    closeQuizModal(screen === 'results' && _justCompleted);
}

function openPauseCard() {
    const stage = document.getElementById('quiz-modal-inner');
    if (!stage || document.getElementById('quiz-pause-card')) return;
    stage.insertAdjacentHTML('beforeend', quizPauseCardHtml());
    const card = document.getElementById('quiz-pause-card');
    document.getElementById('quiz-pause-stay')?.addEventListener('click', closePauseCard);
    document.getElementById('quiz-pause-leave')?.addEventListener('click', () => {
        closePauseCard();
        closeQuizModal(false);
    });
    card?.addEventListener('click', (e) => { if (e.target === card) closePauseCard(); });
}

function closePauseCard() {
    document.getElementById('quiz-pause-card')?.remove();
}

function onKeydown(e) {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || modal.classList.contains('hidden') || e.defaultPrevented) return;
    if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (document.getElementById('quiz-pause-card')) {
        if (e.key === 'Escape') { e.preventDefault(); closePauseCard(); }
        return;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
        return;
    }
    if (screen === 'turn') {
        const map = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 };
        const idx = map[String(e.key).toLowerCase()];
        if (idx != null) {
            const btn = document.querySelector(`.qs-answer[data-answer-index="${idx}"]`);
            if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
            return;
        }
    }
    if (e.key === 'Enter' || e.key === 'ArrowRight') {
        // Enter on a focused button already clicks it.
        if (e.key === 'Enter' && e.target?.closest?.('button')) return;
        const primary = ['quiz-next-btn', 'quiz-begin-btn', 'quiz-finish-btn']
            .map((id) => document.getElementById(id))
            .find((btn) => btn && !btn.classList.contains('hidden'));
        if (primary) { e.preventDefault(); primary.click(); }
    }
}

// =============================================================================
// MODAL OPEN / CLOSE
// =============================================================================

export async function openQuizModal(classId) {
    currentClassId = classId;
    _justCompleted = false;
    busy = false;
    clearTimers();
    ensureModalInDOM();

    const triggerBtn = document.getElementById('quiz-week-trigger-btn');
    const quiz = await getQuizForClass(classId);

    // Finished this week: reopen the curtain call as it stood.
    if (quiz?.status === 'completed' && quiz.results) {
        showStage(triggerBtn);
        renderResultsScreen(quiz.results, { replay: true });
        return;
    }

    // Paused earlier in this page session: offer to carry on.
    if (hasResumableQuiz(classId)) {
        showStage(triggerBtn);
        renderIntroScreen(quiz, getQuizState(classId), { resume: true });
        return;
    }

    const loaded = await loadQuizForClass(classId);
    if (!loaded) {
        console.error('Failed to load quiz for class:', classId);
        return;
    }
    showStage(triggerBtn);
    renderIntroScreen(quiz, getQuizState(classId));
}

function showStage(triggerBtn) {
    showAnimatedModal(MODAL_ID);
    document.removeEventListener('keydown', onKeydown);
    document.addEventListener('keydown', onKeydown);
    spawnSparkleBurst(triggerBtn);
    const inner = document.getElementById('quiz-modal-inner');
    if (inner && !reducedMotion()) {
        inner.classList.remove('qs-stage--entering');
        void inner.offsetWidth;
        inner.classList.add('qs-stage--entering');
        inner.addEventListener('animationend', () => inner.classList.remove('qs-stage--entering'), { once: true });
    }
}

export function closeQuizModal(wasCompleted = false) {
    clearTimers();
    closePauseCard();
    document.removeEventListener('keydown', onKeydown);
    hideModal(MODAL_ID);

    if (wasCompleted || _justCompleted) animateButtonCompletion();

    _justCompleted = false;
    currentClassId = null;
    screen = 'idle';
}

function animateButtonCompletion() {
    const wrap = document.querySelector('.quiz-week-btn-wrap');
    const btn = document.querySelector('.quiz-week-btn');
    if (!btn || !wrap || btn.classList.contains('quiz-btn-completed')) return;

    btn.classList.add('quiz-btn-completing');
    setTimeout(() => {
        const icon = btn.querySelector('.quiz-week-btn__gem i');
        if (icon) icon.className = 'fas fa-check';
        const title = btn.querySelector('.quiz-week-btn__title');
        if (title) title.textContent = 'See the results';
        btn.title = 'See this week’s quiz results';
        btn.classList.add('quiz-btn-completed');
        btn.classList.remove('quiz-btn-completing');
    }, 420);
}

function escapeAttr(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
