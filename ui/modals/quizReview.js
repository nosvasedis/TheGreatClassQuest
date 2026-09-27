// /ui/modals/quizReview.js — optional teacher review of Quiz of the Week questions before they go live.
import * as state from '../../state.js';
import { showToast } from '../effects.js';
import { escapeHtml } from '../../features/roles/shared.js';
import { QUIZ_MIN_QUESTIONS, QUIZ_OPTION_COUNT } from '../../features/quizReviewCore.mjs';

const OVERLAY_ID = 'qow-review-overlay';
const LETTERS = ['A', 'B', 'C', 'D'];

function questionCardHtml(question, index) {
    const options = Array.from({ length: QUIZ_OPTION_COUNT }, (_, i) => question.options?.[i] || '');
    const carried = question.carriedFrom
        ? `<span class="qow-review-carried" title="Missed last week — back for review"><i class="fas fa-rotate"></i> Review question</span>`
        : '';
    return `
        <article class="qow-review-card" data-review-card>
            <header class="qow-review-card-head">
                <span class="qow-review-num">Q${index + 1}</span>
                ${carried}
                <button type="button" class="qow-review-delete" data-review-delete aria-label="Delete question ${index + 1}" title="Delete this question">
                    <i class="fas fa-trash-can"></i>
                </button>
            </header>
            <label class="qow-review-label">Question
                <textarea class="qow-review-question" rows="2" maxlength="300" data-field="question">${escapeHtml(question.question || '')}</textarea>
            </label>
            <div class="qow-review-options" role="radiogroup" aria-label="Answers for question ${index + 1}">
                ${options.map((option, optionIndex) => `
                    <div class="qow-review-option ${optionIndex === question.correctIndex ? 'is-correct' : ''}">
                        <label class="qow-review-correct" title="Mark as the correct answer">
                            <input type="radio" name="qow-correct-${index}" value="${optionIndex}" ${optionIndex === question.correctIndex ? 'checked' : ''} data-field="correct" />
                            <span>${LETTERS[optionIndex]}</span>
                        </label>
                        <input type="text" class="qow-review-option-input" maxlength="160" value="${escapeHtml(option)}"
                            placeholder="Answer ${LETTERS[optionIndex]}${optionIndex >= 2 ? ' (optional)' : ''}" data-field="option" data-option-index="${optionIndex}" />
                    </div>`).join('')}
            </div>
            <label class="qow-review-label qow-review-label--small">Short explanation (optional)
                <input type="text" class="qow-review-explanation" maxlength="200" value="${escapeHtml(question.explanation || '')}" data-field="explanation" />
            </label>
        </article>`;
}

function readQuestionsFromDom(overlay, originals) {
    return [...overlay.querySelectorAll('[data-review-card]')].map((card, index) => {
        const original = originals[Number(card.dataset.originalIndex)] || {};
        const options = [...card.querySelectorAll('[data-field="option"]')].map((input) => input.value);
        const checked = card.querySelector('[data-field="correct"]:checked');
        return {
            ...original,
            id: `q${index + 1}`,
            question: card.querySelector('[data-field="question"]').value,
            options,
            correctIndex: checked ? Number(checked.value) : 0,
            explanation: card.querySelector('[data-field="explanation"]').value
        };
    });
}

function closeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.add('is-closing');
    document.removeEventListener('keydown', overlay._escHandler);
    window.setTimeout(() => overlay.remove(), 180);
}

/**
 * Open the review editor for this week's quiz.
 * @param {string} classId
 * @param {{ onSaved?: (result: { status: string, questionCount: number }) => void, quiz?: object }} [opts]
 *   `quiz` skips the fetch when the caller already has this week's quiz document.
 */
export async function openQuizReviewEditor(classId, { onSaved, quiz: preloadedQuiz = null } = {}) {
    if (!classId) return;
    const { getQuizForClass, saveReviewedQuestions } = await import('../../db/actions/quizOfTheWeek.js');
    const quiz = preloadedQuiz || await getQuizForClass(classId);
    if (!quiz?.questions?.length) {
        showToast('Generate this week\'s quiz first.', 'info');
        return;
    }
    if (quiz.status === 'completed' || quiz.status === 'active') {
        showToast('This quiz has already been played, so its questions are locked.', 'info');
        return;
    }

    document.getElementById(OVERLAY_ID)?.remove();
    const classData = (state.get('allTeachersClasses') || []).find((c) => c.id === classId);
    const inReview = quiz.status === 'review';
    const originals = quiz.questions.map((question) => ({ ...question }));

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'qow-review-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'qow-review-title');
    overlay.innerHTML = `
        <div class="qow-review-panel">
            <header class="qow-review-header">
                <div>
                    <p class="qow-review-kicker">${escapeHtml(`${classData?.logo || ''} ${classData?.name || ''}`.trim())} · Quiz of the Week</p>
                    <h2 id="qow-review-title" class="qow-review-title">Review this week's questions</h2>
                    <p class="qow-review-sub">${inReview
                        ? 'Nothing is shown to the class until you approve. Edit anything, tick the right answer, or delete a question.'
                        : 'This quiz is already ready to play. Changes you save here go straight into it.'}</p>
                </div>
                <button type="button" class="qow-review-close" data-review-close aria-label="Close review">&times;</button>
            </header>
            <div class="qow-review-list" data-review-list>
                ${originals.map((question, index) => questionCardHtml(question, index).replace('data-review-card', `data-review-card data-original-index="${index}"`)).join('')}
            </div>
            <p class="qow-review-error hidden" data-review-error role="alert"></p>
            <footer class="qow-review-footer">
                <span class="qow-review-count" data-review-count></span>
                <div class="qow-review-footer-actions">
                    <button type="button" class="qow-review-btn-secondary" data-review-close>Cancel</button>
                    <button type="button" class="qow-review-btn-secondary" data-review-save>${inReview ? 'Save draft' : 'Save changes'}</button>
                    ${inReview ? '<button type="button" class="qow-review-btn-primary" data-review-approve><i class="fas fa-circle-check mr-1"></i>Approve &amp; make live</button>' : ''}
                </div>
            </footer>
        </div>`;
    document.body.appendChild(overlay);

    const list = overlay.querySelector('[data-review-list]');
    const countEl = overlay.querySelector('[data-review-count]');
    const errorEl = overlay.querySelector('[data-review-error]');

    const updateCount = () => {
        const cards = list.querySelectorAll('[data-review-card]');
        cards.forEach((card, index) => {
            const num = card.querySelector('.qow-review-num');
            if (num) num.textContent = `Q${index + 1}`;
        });
        countEl.textContent = `${cards.length} question${cards.length === 1 ? '' : 's'}`;
    };
    updateCount();

    list.addEventListener('change', (event) => {
        if (event.target.matches('[data-field="correct"]')) {
            const card = event.target.closest('[data-review-card]');
            card.querySelectorAll('.qow-review-option').forEach((row) => row.classList.remove('is-correct'));
            event.target.closest('.qow-review-option')?.classList.add('is-correct');
        }
    });
    list.addEventListener('click', (event) => {
        const deleteBtn = event.target.closest('[data-review-delete]');
        if (!deleteBtn) return;
        const cards = list.querySelectorAll('[data-review-card]');
        if (cards.length <= QUIZ_MIN_QUESTIONS) {
            errorEl.textContent = `A quiz needs at least ${QUIZ_MIN_QUESTIONS} questions.`;
            errorEl.classList.remove('hidden');
            return;
        }
        deleteBtn.closest('[data-review-card]')?.remove();
        errorEl.classList.add('hidden');
        updateCount();
    });

    overlay.querySelectorAll('[data-review-close]').forEach((btn) => btn.addEventListener('click', closeOverlay));
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeOverlay();
    });
    overlay._escHandler = (event) => {
        if (event.key === 'Escape') closeOverlay();
    };
    document.addEventListener('keydown', overlay._escHandler);

    const save = async (approve) => {
        const buttons = overlay.querySelectorAll('[data-review-save], [data-review-approve]');
        buttons.forEach((btn) => { btn.disabled = true; });
        errorEl.classList.add('hidden');
        try {
            const result = await saveReviewedQuestions(classId, readQuestionsFromDom(overlay, originals), { approve });
            showToast(approve ? 'Quiz approved: it is ready to play on the first lesson day. ✨' : 'Questions saved.', 'success');
            closeOverlay();
            onSaved?.(result);
        } catch (error) {
            errorEl.textContent = error?.message || 'Could not save the questions.';
            errorEl.classList.remove('hidden');
        } finally {
            buttons.forEach((btn) => { btn.disabled = false; });
        }
    };
    overlay.querySelector('[data-review-save]')?.addEventListener('click', () => save(false));
    overlay.querySelector('[data-review-approve]')?.addEventListener('click', () => save(true));

    requestAnimationFrame(() => {
        overlay.classList.add('is-open');
        overlay.querySelector('.qow-review-question')?.focus();
    });
}
