// templates/modals/sortingQuiz.js — Sorting quiz and result modals

export const sortingQuizModalsHTML = `
    <div id="sorting-quiz-modal"
        class="fixed inset-0 z-[72] flex items-center justify-center p-4 hidden"
        role="dialog"
        aria-labelledby="sorting-quiz-title"
        aria-modal="true">

        <div class="sorting-quiz-backdrop"></div>

        <div class="sorting-quiz-card pop-in">
            <!-- Header -->
            <div class="sorting-quiz-header">
                <div id="sorting-quiz-question-emoji" class="sorting-quiz-question-emoji">💪</div>
                <h2 id="sorting-quiz-title" class="sorting-quiz-title">Guild Sorting Quiz</h2>
                <p class="sorting-quiz-subtitle">Discover your destiny ✨</p>
            </div>

            <!-- Progress dots -->
            <div class="sorting-quiz-dots" id="sorting-quiz-dots"></div>

            <!-- Progress bar (hidden but used for accessibility) -->
            <div class="sorting-quiz-progress-bar" aria-hidden="true">
                <div id="sorting-quiz-progress-fill" class="sorting-quiz-progress-fill" style="width: 20%;"></div>
            </div>

            <p id="sorting-quiz-progress" class="sorting-quiz-progress-text">Question 1 of 5</p>

            <!-- Question -->
            <div id="sorting-quiz-question" class="sorting-quiz-question-wrap">
                <p id="sorting-quiz-question-text" class="sorting-quiz-question-text"></p>
                <div id="sorting-quiz-options" class="sorting-quiz-options-grid"></div>
            </div>

            <!-- Buttons -->
            <div class="sorting-quiz-footer">
                <button id="sorting-quiz-cancel-btn" type="button" class="sorting-quiz-btn sorting-quiz-btn--cancel">
                    ✕ Cancel
                </button>
                <button id="sorting-quiz-next-btn" type="button" class="sorting-quiz-btn sorting-quiz-btn--next">
                    Next →
                </button>
            </div>
        </div>
    </div>

    <div id="sorting-quiz-result-modal"
        class="fixed inset-0 z-[73] flex items-center justify-center p-4 hidden"
        role="dialog"
        aria-labelledby="sorting-quiz-result-title"
        aria-modal="true">

        <div class="sorting-quiz-backdrop"></div>

        <div id="sorting-quiz-result-card" class="sorting-quiz-result-card pop-in">
            <div class="sorting-quiz-result-sparkles" aria-hidden="true">
                <span>✦</span><span>✧</span><span>✦</span><span>✧</span><span>✦</span>
            </div>
            <h2 id="sorting-quiz-result-title" class="sorting-quiz-result-title">You've been sorted!</h2>
            <div id="sorting-quiz-result-emblem" class="sorting-quiz-result-emblem-wrap"></div>
            <p id="sorting-quiz-result-name" class="sorting-quiz-result-guild-name"></p>
            <p id="sorting-quiz-result-motto" class="sorting-quiz-result-motto"></p>
            <p class="sorting-quiz-result-msg">Every star you earn brings your guild closer to glory. Give it your all! ⭐</p>
            <button id="sorting-quiz-result-done-btn" type="button" class="sorting-quiz-btn sorting-quiz-btn--done">
                🎉 Let's Go!
            </button>
        </div>
    </div>
`;
