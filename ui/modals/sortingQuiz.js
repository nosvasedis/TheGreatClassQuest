// /ui/modals/sortingQuiz.js — Sorting quiz modal: display, interaction, result

import * as state from '../../state.js';
import * as sortingQuiz from '../../features/sortingQuiz.js';
import { getGuildById, getGuildEmblemUrl } from '../../features/guilds.js';

// Option letter labels
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const QUIZ_MODAL_ID = 'sorting-quiz-modal';
const RESULT_MODAL_ID = 'sorting-quiz-result-modal';

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveQuestLevelForStudent(studentId) {
    const students = state.get('allStudents') || [];
    const classes = state.get('allSchoolClasses') || [];
    const student = students.find((s) => s.id === studentId);
    if (!student || !student.classId) return null;
    const cls = classes.find((c) => c.id === student.classId);
    return cls ? (cls.questLevel || null) : null;
}

// ─── Render ─────────────────────────────────────────────────────────────────

function renderQuizStep() {
    const { step, answers, questions } = sortingQuiz.getQuizState();
    const totalSteps = questions?.length || 0;
    const question = questions?.[step - 1];
    if (!question) return;

    // Progress text
    const progressEl = document.getElementById('sorting-quiz-progress');
    if (progressEl) progressEl.textContent = `Question ${step} of ${totalSteps}`;

    // Emoji
    const emojiEl = document.getElementById('sorting-quiz-question-emoji');
    if (emojiEl) emojiEl.textContent = question.emoji || '✨';

    // Progress fill bar
    const fill = document.getElementById('sorting-quiz-progress-fill');
    if (fill && totalSteps > 0) {
        const pct = Math.round((step / totalSteps) * 100);
        fill.style.width = `${pct}%`;
    }

    // Progress dots
    const dotsEl = document.getElementById('sorting-quiz-dots');
    if (dotsEl) {
        dotsEl.innerHTML = Array.from({ length: totalSteps }, (_, i) => {
            const done = i < step - 1;
            const current = i === step - 1;
            return `<span class="sorting-quiz-dot ${done ? 'sorting-quiz-dot--done' : ''} ${current ? 'sorting-quiz-dot--active' : ''}"></span>`;
        }).join('');
    }

    // Question text
    const textEl = document.getElementById('sorting-quiz-question-text');
    if (textEl) textEl.textContent = question.question;

    // Options
    const optionsEl = document.getElementById('sorting-quiz-options');
    if (optionsEl) {
        const selectedIdx = answers[step - 1];
        optionsEl.innerHTML = question.options.map((opt, i) => {
            const label = OPTION_LABELS[i] || String(i + 1);
            const text = typeof opt === 'object' && opt !== null && 'text' in opt ? opt.text : opt;
            const isSelected = selectedIdx === i;
            return `<button type="button"
                class="sorting-quiz-option ${isSelected ? 'sorting-quiz-option--selected' : ''}"
                data-option-index="${i}">
                <span class="sorting-quiz-option-label">${label}</span>
                <span class="sorting-quiz-option-text">${text}</span>
            </button>`;
        }).join('');
    }

    // Next/Submit button
    const nextBtn = document.getElementById('sorting-quiz-next-btn');
    if (nextBtn) {
        nextBtn.textContent = step === totalSteps ? '✓ Submit' : 'Next →';
        nextBtn.disabled = answers[step - 1] === undefined;
    }
}

// ─── Result modal ────────────────────────────────────────────────────────────

function showResultModal(result) {
    const modal = document.getElementById(RESULT_MODAL_ID);
    const card = document.getElementById('sorting-quiz-result-card');
    const emblemEl = document.getElementById('sorting-quiz-result-emblem');
    const nameEl = document.getElementById('sorting-quiz-result-name');
    const mottoEl = document.getElementById('sorting-quiz-result-motto');
    if (!modal || !nameEl) return;

    const guild = getGuildById(result.guildId);
    const url = getGuildEmblemUrl(result.guildId);
    const primary = guild?.primary || '#7c3aed';
    const secondary = guild?.secondary || '#a78bfa';
    const glow = guild?.glow || primary;
    const emoji = guild?.emoji || '⚔️';

    // Style the card itself with guild gradient
    if (card) {
        card.style.background = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
        card.style.setProperty('--guild-glow', glow);
    }

    if (emblemEl) {
        if (url) {
            emblemEl.innerHTML = `<img src="${url}" alt="${result.guildName}"
                class="sorting-quiz-result-emblem"
                style="border-color: rgba(255,255,255,0.6); box-shadow: 0 0 32px ${glow}cc, 0 0 64px ${glow}66;">`;
        } else {
            emblemEl.innerHTML = `<div class="sorting-quiz-result-emblem sorting-quiz-result-emblem-fallback"
                style="background: rgba(255,255,255,0.2);">
                <span style="font-size: 3.5rem;">${emoji}</span>
            </div>`;
        }
    }

    if (nameEl) nameEl.textContent = `${emoji} ${result.guildName}`;
    if (mottoEl) mottoEl.textContent = guild?.motto || '';

    modal.classList.remove('hidden');
}

// ─── One-time listener setup ──────────────────────────────────────────────────

let _listenersWired = false;

function wireQuizListeners() {
    if (_listenersWired) return;
    _listenersWired = true;

    const quizModal = document.getElementById(QUIZ_MODAL_ID);
    if (!quizModal) return;

    // Option clicks — delegated on the stable options container
    const optionsEl = document.getElementById('sorting-quiz-options');
    if (optionsEl) {
        optionsEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.sorting-quiz-option');
            if (!btn) return;
            const idx = parseInt(btn.dataset.optionIndex, 10);
            if (Number.isNaN(idx)) return;
            sortingQuiz.selectAnswer(idx);
            renderQuizStep();
        });
    }

    // Next / Submit
    const nextBtn = document.getElementById('sorting-quiz-next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
            const { step, questions } = sortingQuiz.getQuizState();
            const totalSteps = questions?.length || 0;
            const answers = sortingQuiz.getCurrentAnswers();
            if (answers[step - 1] === undefined) return;

            if (step === totalSteps) {
                nextBtn.disabled = true;
                nextBtn.textContent = '⏳';
                try {
                    const result = await sortingQuiz.submitQuiz();
                    quizModal.classList.add('hidden');
                    if (result) showResultModal(result);
                } finally {
                    nextBtn.disabled = false;
                    nextBtn.textContent = '✓ Submit';
                }
                return;
            }
            sortingQuiz.goNext();
            renderQuizStep();
        });
    }

    // Cancel
    const cancelBtn = document.getElementById('sorting-quiz-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeSortingQuizModal());
    }

    // Backdrop click
    quizModal.addEventListener('click', (e) => {
        if (e.target === quizModal) closeSortingQuizModal();
    });

    // Keyboard
    quizModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSortingQuizModal();
    });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Open the sorting quiz modal for a student.
 * @param {string} studentId
 */
export function openSortingQuizModal(studentId) {
    const modal = document.getElementById(QUIZ_MODAL_ID);
    if (!modal) return;

    const questLevel = resolveQuestLevelForStudent(studentId);
    const data = sortingQuiz.startQuiz(studentId, questLevel);
    if (!data.question) return;

    // Wire listeners once (idempotent)
    wireQuizListeners();

    renderQuizStep();
    modal.classList.remove('hidden');
}

/**
 * Close the sorting quiz modal.
 */
export function closeSortingQuizModal() {
    document.getElementById(QUIZ_MODAL_ID)?.classList.add('hidden');
    document.getElementById(RESULT_MODAL_ID)?.classList.add('hidden');
}

/**
 * Wire the result modal "Done" button (called once from listeners setup).
 */
export function wireSortingQuizResultDone() {
    const doneBtn = document.getElementById('sorting-quiz-result-done-btn');
    if (doneBtn) {
        doneBtn.addEventListener('click', () => {
            document.getElementById(RESULT_MODAL_ID)?.classList.add('hidden');
            import('../../ui/tabs.js').then((t) => t.renderManageStudentsTab?.());
        });
    }

    // Also close result modal on backdrop click
    const resultModal = document.getElementById(RESULT_MODAL_ID);
    if (resultModal) {
        resultModal.addEventListener('click', (e) => {
            if (e.target === resultModal) resultModal.classList.add('hidden');
        });
    }
}
