// templates/modals/misc.js
// Quest update, milestone, welcome back, celebration bonus, quest assignment,
// starfall, overview, bounty, bestow boon

export const miscModalsHTML = `
    <div id="quest-update-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-2xl w-full pop-in border-4 border-purple-300">
            <div class="flex justify-between items-center mb-4">
                <h2 class="font-title text-2xl md:text-3xl text-purple-700">Latest Quest Update</h2>
                <button id="quest-update-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>

            <div id="narrative-text-container"
                class="bg-purple-50 p-6 rounded-2xl border-2 border-purple-100 text-lg text-purple-900 leading-relaxed min-h-[150px] flex items-center justify-center">
                Loading update...
            </div>

            <div class="mt-6 flex justify-center">
                <button id="play-narrative-btn"
                    class="bg-purple-500 hover:bg-purple-600 text-white font-title text-xl py-3 px-8 rounded-full bubbly-button shadow-lg hidden">
                    <i class="fas fa-play-circle mr-2"></i> Play Commentary
                </button>
            </div>
        </div>
    </div>

    <div id="milestone-details-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4 hidden">
        <div id="milestone-details-panel" class="milestone-details-panel bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-4xl w-full pop-in border-4 border-blue-300 max-h-[90vh] overflow-y-auto">
            <div class="milestone-details-header flex justify-between items-center mb-4 gap-3">
                <h2 id="milestone-modal-title" class="font-title text-2xl md:text-3xl text-blue-700">Milestone Progress
                </h2>
                <button id="milestone-modal-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div id="milestone-modal-content" class="space-y-4 text-center">
            </div>
        </div>
    </div>

    <div id="welcome-back-modal"
        class="fixed inset-0 bg-black/70 backdrop-blur-md z-[72] flex items-center justify-center p-4 hidden">
        <div class="welcome-back-shell pop-in">
            <!-- Animated gradient backdrop -->
            <div class="welcome-back-shell__backdrop"></div>

            <!-- Floating particles -->
            <div class="welcome-back-particles" aria-hidden="true">
                <span class="wb-particle wb-particle--1">✨</span>
                <span class="wb-particle wb-particle--2">⭐</span>
                <span class="wb-particle wb-particle--3">🌟</span>
                <span class="wb-particle wb-particle--4">✦</span>
                <span class="wb-particle wb-particle--5">✧</span>
                <span class="wb-particle wb-particle--6">🎉</span>
            </div>

            <div id="welcome-back-content" class="welcome-back-content">
                <!-- Waving hand icon -->
                <div class="welcome-back-icon" aria-hidden="true">👋</div>

                <h2 id="welcome-back-title" class="welcome-back-title">Welcome Back!</h2>
                <p id="welcome-back-message" class="welcome-back-message"></p>

                <!-- Stars display -->
                <div class="welcome-back-stars-badge">
                    <div class="welcome-back-stars-ring">
                        <i class="fas fa-star welcome-back-star-icon"></i>
                        <span id="welcome-back-stars" class="welcome-back-stars-num">3</span>
                    </div>
                    <p class="welcome-back-stars-label">Bonus Stars Awarded!</p>
                </div>
            </div>
        </div>
    </div>

    <div id="celebration-bonus-modal"
        class="fixed inset-0 bg-black bg-opacity-60 z-[90] flex items-center justify-center p-4 hidden">
        <div
            class="bg-white rounded-3xl shadow-2xl max-w-sm w-full pop-in border-4 border-white relative overflow-hidden text-center">
            <div
                class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/confetti.png')] opacity-20">
            </div>
            <div id="celebration-header" class="bg-gradient-to-r from-pink-500 to-rose-500 p-6">
                <div class="text-6xl mb-2 animate-bounce">🎂</div>
                <h2 id="celebration-title" class="font-title text-3xl text-white drop-shadow-md">Happy Birthday!</h2>
            </div>
            <div class="p-6">
                <p id="celebration-message" class="text-gray-600 mb-6 text-lg">It's <b>Student's</b> special day! Would
                    you like to award a gift?</p>
                <button id="celebration-award-btn"
                    class="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-title text-xl py-3 rounded-xl bubbly-button shadow-lg mb-3">
                    <i class="fas fa-gift mr-2"></i> Award +<span id="celebration-points">2.5</span> Stars
                </button>
                <button id="celebration-cancel-btn" class="text-gray-400 text-sm hover:text-gray-600 underline">Not
                    now</button>
            </div>
        </div>
    </div>

    <div id="quest-assignment-modal"
        class="fixed inset-0 bg-black bg-opacity-60 z-[72] flex items-center justify-center p-4 hidden backdrop-blur-md"
        role="dialog" aria-modal="true" aria-labelledby="quest-board-title">
        <div class="qb-board pop-in">
            <header class="qb-header">
                <div class="qb-header__sign">
                    <span class="qb-pin qb-pin--left" aria-hidden="true"></span>
                    <span class="qb-pin qb-pin--right" aria-hidden="true"></span>
                    <h2 id="quest-board-title" class="qb-header__title">Quest Board</h2>
                    <p class="qb-header__subtitle">Homework and tests for the next lesson</p>
                </div>
                <div class="qb-header__tools">
                    <button id="open-quest-test-modal-btn" type="button" class="qb-test-tag">
                        <i class="fas fa-calendar-check" aria-hidden="true"></i>
                        <span>Schedule Test</span>
                        <span id="quest-header-test-badge" class="qb-test-tag__badge hidden">!</span>
                    </button>
                    <button id="quest-assignment-close-x-btn" type="button" class="qb-close" aria-label="Close the Quest Board">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                </div>
            </header>

            <div class="qb-cork">
                <input type="hidden" id="quest-assignment-class-id">

                <div class="qb-columns">
                    <!-- Pinned last time: the assignment already on the board -->
                    <section class="qb-col" aria-labelledby="qb-previous-heading">
                        <h3 id="qb-previous-heading" class="qb-col__label"><i class="fas fa-history" aria-hidden="true"></i> Pinned last time</h3>
                        <div class="qb-card qb-card--previous">
                            <span class="qb-pin qb-pin--card" aria-hidden="true"></span>
                            <div id="previous-assignment-text" class="qb-card__body">
                                Loading previous assignment...
                            </div>
                        </div>
                    </section>

                    <!-- The new note for next lesson -->
                    <section class="qb-col" aria-labelledby="qb-next-heading">
                        <h3 id="qb-next-heading" class="qb-col__label"><i class="fas fa-pen-nib" aria-hidden="true"></i> For next lesson</h3>
                        <div class="notebook-container qb-notepad">
                            <span class="qb-notepad__clip" aria-hidden="true"></span>
                            <div id="quest-assignment-date-chip" class="qb-notepad__date">
                                <i class="fas fa-calendar-day" aria-hidden="true"></i>
                                <span>DD/MM/YYYY</span>
                            </div>
                            <label for="quest-assignment-textarea" class="sr-only">Assignment for next lesson</label>
                            <textarea id="quest-assignment-textarea" rows="8"
                                class="notebook-textarea"
                                placeholder="1.&#10;2.&#10;3."></textarea>
                        </div>
                    </section>
                </div>

                <!-- Test notice (shown when a test is scheduled in this session) -->
                <div id="quest-test-summary-card" class="qb-notice hidden">
                    <span class="qb-pin qb-pin--notice" aria-hidden="true"></span>
                    <div class="qb-notice__stamp" aria-hidden="true">Test</div>
                    <div class="qb-notice__text">
                        <p class="qb-notice__kicker">Upcoming test</p>
                        <h4 id="quest-test-summary-title" class="qb-notice__title">Unit 5 Final Test</h4>
                        <p id="quest-test-summary-details" class="qb-notice__details">15/05/2024 • Grammar & Vocab</p>
                    </div>
                    <button id="edit-quest-test-btn" type="button" class="qb-notice__edit">
                        <i class="fas fa-pen" aria-hidden="true"></i> Edit test
                    </button>
                </div>
            </div>

            <footer class="qb-footer">
                <button id="quest-assignment-cancel-btn" type="button" class="qb-btn qb-btn--ghost">
                    Cancel
                </button>
                <button id="quest-assignment-confirm-btn" type="button" class="qb-btn qb-btn--pin">
                    Save Quest Board
                </button>
            </footer>
        </div>
    </div>

    <!-- New Test Modal -->
    <div id="quest-test-modal"
        class="fixed inset-0 bg-black bg-opacity-60 z-[75] flex items-center justify-center p-4 hidden backdrop-blur-sm"
        role="dialog" aria-modal="true" aria-labelledby="quest-test-title-heading">
        <div class="qb-test-card pop-in">
            <span class="qb-pin qb-pin--notice" aria-hidden="true"></span>
            <div class="qb-test-card__head">
                <span class="qb-notice__stamp" aria-hidden="true">Test</span>
                <div>
                    <h2 id="quest-test-title-heading" class="qb-test-card__title">Schedule a test</h2>
                    <p class="qb-test-card__subtitle">It is pinned to the board and shown to parents with the homework.</p>
                </div>
            </div>
            <div class="qb-test-card__fields">
                <div class="qb-field">
                    <label for="quest-test-date">Test date</label>
                    <input type="date" id="quest-test-date">
                </div>
                <div class="qb-field">
                    <label for="quest-test-title">Test title</label>
                    <input type="text" id="quest-test-title" placeholder="e.g. Unit 5 Review" autocomplete="off">
                </div>
                <div class="qb-field">
                    <label for="quest-test-curriculum">Topics</label>
                    <input type="text" id="quest-test-curriculum" placeholder="e.g. Past simple, vocabulary p. 40-45" autocomplete="off">
                </div>
            </div>
            <div class="qb-test-card__actions">
                <button id="quest-test-clear-btn" type="button" class="qb-btn qb-btn--ghost">Clear</button>
                <button id="quest-test-done-btn" type="button" class="qb-btn qb-btn--test">Done</button>
            </div>
        </div>
    </div>

    <div id="starfall-modal"
        class="fixed inset-0 bg-black/80 backdrop-blur-xl z-[80] flex items-center justify-center p-4 hidden">
        <div id="starfall-modal-content"
            class="starfall-shell pop-in">

            <!-- Rotating deep-space background -->
            <div class="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] starfall-bg" aria-hidden="true"></div>

            <!-- Shooting star streaks -->
            <div class="starfall-streaks" aria-hidden="true">
                <div class="starfall-streak starfall-streak--1"></div>
                <div class="starfall-streak starfall-streak--2"></div>
                <div class="starfall-streak starfall-streak--3"></div>
            </div>

            <!-- Floating particles -->
            <div class="starfall-particles" aria-hidden="true">
                <span class="starfall-particle starfall-particle--1">✦</span>
                <span class="starfall-particle starfall-particle--2">✧</span>
                <span class="starfall-particle starfall-particle--3">⭐</span>
                <span class="starfall-particle starfall-particle--4">✦</span>
                <span class="starfall-particle starfall-particle--5">✧</span>
                <span class="starfall-particle starfall-particle--6">💫</span>
            </div>

            <!-- Content -->
            <div class="relative z-10 flex flex-col items-center">
                <!-- Multi-ring glowing star -->
                <div class="starfall-icon-wrapper" aria-hidden="true">
                    <span class="starfall-icon-ring starfall-icon-ring--3"></span>
                    <span class="starfall-icon-ring starfall-icon-ring--2"></span>
                    <span class="starfall-icon-ring starfall-icon-ring--1"></span>
                    <div id="starfall-icon" class="starfall-icon-animate relative z-10">⭐</div>
                </div>

                <h2 class="starfall-title">A Starfall Opportunity!</h2>

                <div id="starfall-single-view">
                    <p id="starfall-message" class="starfall-message">The stars have noticed <b
                            id="starfall-student-name" class="starfall-student-name">Student Name's</b> incredible effort on
                        their trial! Their brilliance has caused a star to fall from the sky.</p>
                </div>

                <div id="starfall-batch-view" class="hidden w-full mb-5">
                    <p class="starfall-message mb-3">The stars are raining down! These scholars have triggered a Starfall Bonus!</p>
                    <div id="starfall-batch-list" class="starfall-batch-list"></div>
                </div>

                <p class="starfall-prompt">Shall we bestow these Bonus Stars?</p>

                <div class="flex flex-col items-center gap-3 w-full">
                    <button id="starfall-confirm-btn" class="starfall-confirm-btn">
                        <span class="starfall-confirm-btn__shimmer"></span>
                        Yes, Bestow Bonus Stars! ✨
                    </button>
                    <button id="starfall-cancel-btn" class="starfall-cancel-btn">Not This Time</button>
                </div>
            </div>
        </div>
    </div>



    <div id="create-bounty-modal"
        class="bp-overlay fixed inset-0 z-[72] flex items-center justify-center p-3 sm:p-6 hidden"
        role="dialog" aria-modal="true" aria-labelledby="bp-title">
        <div class="bp-sheet pop-in" data-mode="standard">
            <span class="bp-tack bp-tack--left" aria-hidden="true"></span>
            <span class="bp-tack bp-tack--right" aria-hidden="true"></span>

            <form id="create-bounty-form" class="bp-paper" novalidate>
                <input type="hidden" id="bounty-class-id">
                <input type="hidden" id="bounty-type" value="standard">

                <header class="bp-head">
                    <button type="button" id="bounty-cancel-x-btn" class="bp-close" aria-label="Close">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                    <p class="bp-posted-for">
                        <span>Posted for</span>
                        <span class="bp-class-chip"><span id="bp-class-logo" class="bp-class-chip__logo">📚</span><span id="bp-class-name">your class</span></span>
                    </p>
                    <h2 id="bp-title" class="bp-title">
                        <span class="bp-title__rule" aria-hidden="true"></span>
                        <span class="bp-title__word">Bounty</span>
                        <span class="bp-title__rule" aria-hidden="true"></span>
                    </h2>
                    <p id="bp-tagline" class="bp-tagline">The whole class takes it on together</p>
                </header>

                <div class="bp-body">
                    <fieldset class="bp-modes">
                        <legend class="sr-only">Kind of bounty</legend>
                        <button type="button" id="bounty-mode-stars" class="bp-mode is-active" aria-pressed="true">
                            <span class="bp-mode__icon" aria-hidden="true"><i class="fas fa-star"></i></span>
                            <span class="bp-mode__text">
                                <span class="bp-mode__name">Star Hunt</span>
                                <span class="bp-mode__hint">Earn stars together to win a reward</span>
                            </span>
                        </button>
                        <button type="button" id="bounty-mode-timer" class="bp-mode" aria-pressed="false">
                            <span class="bp-mode__icon" aria-hidden="true"><i class="fas fa-hourglass-half"></i></span>
                            <span class="bp-mode__text">
                                <span class="bp-mode__name">Race the Clock</span>
                                <span class="bp-mode__hint">Finish a task before time runs out</span>
                            </span>
                        </button>
                    </fieldset>

                    <div id="bp-on-board" class="bp-on-board hidden" role="note"></div>

                    <section class="bp-field" data-bp-field="title">
                        <label for="bounty-title" class="bp-label"><span class="bp-label__num">I</span><span id="bp-title-label">What's the quest?</span></label>
                        <input type="text" id="bounty-title" class="bp-ink-input" maxlength="48"
                            placeholder="Name the challenge" required autocomplete="off" enterkeyhint="next">
                        <div id="bp-title-ideas" class="bp-chips" aria-label="Quest ideas"></div>
                    </section>

                    <div id="bounty-inputs-stars" class="bp-group">
                        <section class="bp-field" data-bp-field="target">
                            <label for="bounty-target" class="bp-label"><span class="bp-label__num">II</span>Stars to earn</label>
                            <div class="bp-stepper">
                                <button type="button" class="bp-stepper__btn" data-bp-step="-1" aria-label="Fewer stars"><i class="fas fa-minus" aria-hidden="true"></i></button>
                                <div class="bp-stepper__value">
                                    <i class="fas fa-star" aria-hidden="true"></i>
                                    <input type="number" id="bounty-target" value="20" min="1" max="500" inputmode="numeric" aria-describedby="bp-target-hint">
                                </div>
                                <button type="button" class="bp-stepper__btn" data-bp-step="1" aria-label="More stars"><i class="fas fa-plus" aria-hidden="true"></i></button>
                            </div>
                            <div id="bp-target-picks" class="bp-chips bp-chips--tiers" aria-label="Suggested targets"></div>
                            <p id="bp-target-hint" class="bp-hint"></p>
                        </section>

                        <section class="bp-field" data-bp-field="reward">
                            <label for="bounty-reward" class="bp-label"><span class="bp-label__num">III</span>The reward</label>
                            <input type="text" id="bounty-reward" class="bp-ink-input" maxlength="40"
                                placeholder="What will they win?" autocomplete="off" enterkeyhint="done">
                            <div id="bp-reward-ideas" class="bp-chips" aria-label="Reward ideas"></div>
                        </section>
                    </div>

                    <div id="bounty-inputs-timer" class="bp-group hidden">
                        <section class="bp-field" data-bp-field="time">
                            <span class="bp-label" id="bp-time-label"><span class="bp-label__num">II</span>How long?</span>
                            <div id="bounty-smart-options" class="bp-chips bp-chips--time" role="group" aria-labelledby="bp-time-label"></div>
                            <div class="bp-time-custom">
                                <label class="bp-mini">
                                    <span>Minutes</span>
                                    <span class="bp-mini__box">
                                        <input type="number" id="bounty-timer-minutes" min="1" max="600" placeholder="20" inputmode="numeric">
                                        <small>min</small>
                                    </span>
                                </label>
                                <span class="bp-or" aria-hidden="true">or</span>
                                <label class="bp-mini">
                                    <span>Ends at</span>
                                    <span class="bp-mini__box"><input type="time" id="bounty-timer-end"></span>
                                </label>
                            </div>
                            <p id="bp-time-readout" class="bp-hourglass-readout">Pick a time and the hourglass is set.</p>
                        </section>
                    </div>

                </div>

                <footer class="bp-foot">
                    <p id="bp-proclamation" class="bp-proclamation" aria-live="polite"></p>
                    <button type="button" id="bounty-cancel-btn" class="bp-cancel">Not now</button>
                    <button type="submit" id="bounty-submit-btn" class="bp-submit">
                        <span class="bp-submit__seal" aria-hidden="true"><i class="fas fa-thumbtack"></i></span>
                        <span class="bp-submit__label">Pin it to the board</span>
                    </button>
                </footer>
            </form>
        </div>
    </div>

    <div id="bestow-boon-modal"
        class="hb-overlay fixed inset-0 z-[90] flex items-center justify-center p-4 hidden">
        <div id="bestow-boon-shell" class="hb-shell pop-in" role="dialog" aria-modal="true" aria-labelledby="bestow-boon-title">
            <div class="hb-sky" aria-hidden="true">
                <span class="hb-sky__glow"></span>
                <span class="hb-sky__puff hb-sky__puff--1"></span>
                <span class="hb-sky__puff hb-sky__puff--2"></span>
                <span class="hb-sky__puff hb-sky__puff--3"></span>
                <span class="hb-sky__twinkle hb-sky__twinkle--1"></span>
                <span class="hb-sky__twinkle hb-sky__twinkle--2"></span>
                <span class="hb-sky__twinkle hb-sky__twinkle--3"></span>
            </div>

            <header class="hb-header">
                <span class="hb-gem" aria-hidden="true"><i class="fas fa-heart"></i></span>
                <div class="hb-header__text">
                    <p class="hb-eyebrow">A gift between classmates</p>
                    <h2 id="bestow-boon-title" class="hb-title">Hero’s Boon</h2>
                </div>
                <button id="boon-close-btn" class="hb-close" type="button" aria-label="Close">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            </header>

            <section class="hb-bridge" aria-live="polite">
                <div id="boon-giver-slot" class="hb-end hb-end--giver"></div>
                <div class="hb-arc" aria-hidden="true">
                    <svg class="hb-arc__art" viewBox="0 0 200 64" preserveAspectRatio="none" focusable="false">
                        <path class="hb-arc__track" d="M8 58 Q100 -6 192 58"/>
                        <path class="hb-arc__lit" d="M8 58 Q100 -6 192 58" pathLength="100"/>
                    </svg>
                    <span class="hb-arc__heart"><i class="fas fa-heart"></i></span>
                    <span id="boon-deal" class="hb-deal"></span>
                </div>
                <div id="boon-receiver-slot" class="hb-end hb-end--receiver"></div>
            </section>

            <p class="hb-prompt">
                Who will share their Gold with <b id="boon-receiver-name" class="hb-prompt__name"></b>?
            </p>

            <div class="hb-picker-wrap">
                <span id="boon-sender-label" class="sr-only">Choose the sponsor</span>
                <select id="boon-sender-select" class="hb-native" tabindex="-1" aria-hidden="true"></select>
                <div id="boon-sponsor-picker" class="hb-picker"></div>
            </div>

            <footer class="hb-footer">
                <div id="boon-today" class="hb-today"></div>
                <div class="hb-footer__actions">
                    <button id="boon-cancel-btn" class="hb-btn hb-btn--ghost" type="button">Cancel</button>
                    <button id="boon-confirm-btn" class="hb-btn hb-btn--gift" type="button" disabled>
                        <i class="fas fa-heart" aria-hidden="true"></i>
                        <span id="boon-confirm-label">Choose a sponsor</span>
                    </button>
                </div>
            </footer>
        </div>
    </div>

    <div id="teacher-boon-modal"
        class="tb-overlay fixed inset-0 z-[95] flex items-center justify-center p-4 hidden">
        <div id="teacher-boon-shell" class="tb-shell pop-in" role="dialog" aria-modal="true" aria-labelledby="teacher-boon-title">
            <div class="tb-sky" aria-hidden="true">
                <span class="tb-sky__sun"></span>
                <span class="tb-sky__puff tb-sky__puff--1"></span>
                <span class="tb-sky__puff tb-sky__puff--2"></span>
                <span class="tb-sky__puff tb-sky__puff--3"></span>
            </div>

            <header class="tb-header">
                <div class="tb-crest" aria-hidden="true">
                    <span class="tb-crest__rays"></span>
                    <span class="tb-crest__gem"><i class="fas fa-wand-magic-sparkles"></i></span>
                </div>
                <div class="tb-header__text">
                    <p class="tb-eyebrow">Once a month, from you</p>
                    <h2 id="teacher-boon-title" class="tb-title">Teacher Boon</h2>
                    <p id="teacher-boon-class-name" class="tb-subtitle"></p>
                </div>
                <button id="teacher-boon-close-btn" class="tb-close" type="button" aria-label="Close">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            </header>

            <nav id="teacher-boon-stepper" class="tb-steps" aria-label="Teacher Boon steps"></nav>

            <div class="tb-body">
                <section class="tb-panel" data-teacher-boon-step-panel="1">
                    <p class="tb-prompt">Who shone brightest this month?</p>
                    <div id="teacher-boon-student-grid" class="tb-students"></div>
                </section>

                <section class="tb-panel" data-teacher-boon-step-panel="2">
                    <p class="tb-prompt">What are you celebrating?</p>
                    <div id="teacher-boon-presets" class="tb-reasons"></div>
                    <div class="tb-divider"><span>or in your own words</span></div>
                    <textarea id="teacher-boon-custom-reason" class="tb-note" rows="2" maxlength="160"
                        aria-label="Your own reason" placeholder="For always lending a hand…"></textarea>
                </section>

                <section class="tb-panel" data-teacher-boon-step-panel="3">
                    <div id="teacher-boon-selected-summary"></div>
                </section>
            </div>

            <footer class="tb-footer">
                <button id="teacher-boon-back-btn" class="tb-btn tb-btn--ghost hidden" type="button">
                    <i class="fas fa-arrow-left" aria-hidden="true"></i><span>Back</span>
                </button>
                <button id="teacher-boon-cancel-btn" class="tb-btn tb-btn--ghost" type="button">Cancel</button>
                <button id="teacher-boon-next-btn" class="tb-btn tb-btn--primary" type="button"></button>
                <button id="teacher-boon-confirm-btn" class="tb-btn tb-btn--bestow hidden" type="button"></button>
            </footer>

            <div id="teacher-boon-success-overlay" class="tb-success hidden" aria-live="polite">
                <span class="tb-success__rays" aria-hidden="true"></span>
                <div class="tb-success__burst" aria-hidden="true">
                    <span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span>
                </div>
                <div class="tb-success__stars" aria-hidden="true">
                    <i class="fas fa-star"></i><i class="fas fa-star"></i>
                </div>
                <p class="tb-success__title">Boon bestowed!</p>
                <p id="teacher-boon-success-copy" class="tb-success__copy"></p>
            </div>
        </div>
    </div>

    <!-- Pricing Comparison Modal -->
    <div id="pricing-modal" class="fixed inset-0 bg-slate-950/60 z-[2000] flex items-center justify-center p-4 hidden backdrop-blur-sm">
        <div class="bg-white p-0 rounded-[1.8rem] shadow-2xl max-w-6xl w-full h-[85vh] pop-in border border-slate-200 flex flex-col overflow-hidden relative">
            <button id="pricing-modal-close-btn" class="premium-close-btn absolute top-4 right-4 bg-white/75 hover:bg-white text-slate-500 hover:text-rose-500 font-bold w-10 h-10 rounded-full bubbly-button z-50 transition-colors">&times;</button>
            
            <div class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 text-center">
                <h2 class="font-title text-3xl mb-2">🏆 Choose Your Quest Plan</h2>
                <p class="text-indigo-100">Unlock powerful features to transform your English teaching adventure</p>
            </div>
            
            <div class="flex-grow overflow-y-auto p-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <!-- Starter Tier -->
                    <div class="bg-white rounded-2xl border-2 border-gray-200 shadow-lg overflow-hidden">
                        <div class="bg-gradient-to-r from-gray-500 to-gray-600 text-white p-4 text-center">
                            <h3 class="font-title text-2xl mb-1">Starter</h3>
                            <div class="text-3xl font-bold mb-2">€20<span class="text-lg font-normal">/month</span></div>
                            <p class="text-gray-100 text-sm">Perfect for getting started</p>
                        </div>
                        <div class="p-4">
                            <h4 class="font-semibold text-gray-700 mb-3">Core Features:</h4>
                            <ul class="space-y-2 text-sm">
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Award Stars (four virtues)</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Ceremony of the Month</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Quest Assignment & Attendance</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Quest Bounties</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Mystic Market artifacts</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Hero's Boon & Teacher Boon</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Team Quest map</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Hero's Challenge</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Projector Mode</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>Hero's Chronicle (notes only)</span></li>
                            </ul>
                        </div>
                    </div>
                    
                    <!-- Pro Tier -->
                    <div class="bg-white rounded-2xl border-2 border-indigo-400 shadow-lg overflow-hidden relative">
                        <div class="absolute top-0 right-0 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs px-3 py-1 rounded-bl-xl">MOST POPULAR</div>
                        <div class="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-4 text-center">
                            <h3 class="font-title text-2xl mb-1">Pro</h3>
                            <div class="text-3xl font-bold mb-2">€40<span class="text-lg font-normal">/month</span></div>
                            <p class="text-indigo-100 text-sm">Complete classroom management</p>
                        </div>
                        <div class="p-4">
                            <h4 class="font-semibold text-gray-700 mb-3">All Starter +:</h4>
                            <ul class="space-y-2 text-sm">
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🏰 Guilds system & sorting quiz</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>⚔️ Hero Classes & Skill Tree</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>📅 Quest Calendar & Day Planner</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🗓️ My Planning (class end dates)</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>📜 Scholar's Scroll (tests/dictations)</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>📓 Adventure Log (manual entries and your own pictures)</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🔥 Hero Campfire & Ember Oaths</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>📋 Attendance Chronicle</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🔄 Pending Makeups (missing test grades)</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🏆 Hall of Heroes (Hero of the Day)</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>👨‍👩‍👧 Family Access / Family Portal</span></li>
                            </ul>
                        </div>
                    </div>
                    
                    <!-- Elite Tier -->
                    <div class="bg-white rounded-2xl border-2 border-purple-400 shadow-lg overflow-hidden">
                        <div class="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 text-center">
                            <h3 class="font-title text-2xl mb-1">Elite</h3>
                            <div class="text-3xl font-bold mb-2">€60<span class="text-lg font-normal">/month</span></div>
                            <p class="text-purple-100 text-sm">Ultimate AI-powered experience</p>
                        </div>
                        <div class="p-4">
                            <h4 class="font-semibold text-gray-700 mb-3">All Pro +:</h4>
                            <ul class="space-y-2 text-sm">
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🏆 AI-powered Quiz of the Week</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🤖 Personalised Adventure Log from your class activity, with AI pictures</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>✏️ Edit AI-generated entries</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>📖 Story Weavers (collaborative)</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🔤 Word of the Day</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🐉 Familiars (magical companions)</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🔮 Hero's Chronicle Oracle</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🎭 AI avatars</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>📄 AI reports & certificates</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🎨 AI story images</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🛒 Market Restock & Festival Stall</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🏛️ School Office (Secretary)</span></li>
                                <li class="flex items-start gap-2"><i class="fas fa-check text-green-500 mt-0.5"></i><span>🌟 Priority support</span></li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <div class="mt-6 p-4 bg-gray-50 rounded-xl">
                    <h4 class="font-semibold text-gray-700 mb-2">💡 Why upgrade?</h4>
                    <p class="text-sm text-gray-600 mb-3">Each tier builds upon the previous one, giving you more powerful tools to engage your students and save time.</p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div class="text-center">
                            <div class="text-2xl mb-1">🌱</div>
                            <strong>Starter:</strong> Perfect for testing the waters
                        </div>
                        <div class="text-center">
                            <div class="text-2xl mb-1">🚀</div>
                            <strong>Pro:</strong> Complete classroom ecosystem
                        </div>
                        <div class="text-center">
                            <div class="text-2xl mb-1">✨</div>
                            <strong>Elite:</strong> AI-powered magic that saves hours
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
