// templates/app/tabs/options.js

export const optionsTabHTML = `
            <div id="options-tab" class="app-tab hidden">
                <div class="max-w-4xl mx-auto">
                    <!-- Tab title: Teacher Settings (the teacher's chalkboard) -->
                    <header class="tab-sign tab-sign--settings">
                        <div class="tab-sign__piece">
                            <div class="tab-sign__board">
                                <span class="tab-sign__doodle tab-sign__doodle--l" aria-hidden="true"><i class="fas fa-cog"></i></span>
                                <span class="tab-sign__doodle tab-sign__doodle--r" aria-hidden="true"><i class="fas fa-star"></i></span>
                                <span class="tab-sign__kicker">Classes · Tools · Profile</span>
                                <h2 class="font-title tab-sign__title">Teacher Settings</h2>
                            </div>
                            <span class="tab-sign__tray" aria-hidden="true"></span>
                            <span class="tab-sign__chalk" aria-hidden="true"></span>
                            <span class="tab-sign__apple" aria-hidden="true"><i class="fas fa-apple-whole"></i></span>
                            <span class="tab-sign__eraser" aria-hidden="true"></span>
                        </div>
                        <p class="tab-sign__tagline">Manage your profile, your classes, and the students you teach.</p>
                    </header>

                    <div class="options-subtab-bar">
                        <div class="options-subtab-select" id="options-subtab-select" data-active-tab="classes">
                            <button type="button" class="options-subtab-select__trigger" id="options-subtab-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="options-subtab-menu" aria-label="Choose settings section">
                                <span class="options-subtab-select__icon" id="options-subtab-trigger-icon" aria-hidden="true"><i class="fas fa-chalkboard-teacher"></i></span>
                                <span class="options-subtab-select__text">
                                    <span class="options-subtab-select__label" id="options-subtab-trigger-label">My Classes</span>
                                    <span class="options-subtab-select__hint" id="options-subtab-trigger-hint">Your classes and rosters</span>
                                </span>
                                <span class="options-subtab-select__switch" aria-hidden="true">Switch <i class="fas fa-chevron-down options-subtab-select__chev"></i></span>
                            </button>
                            <div class="options-subtab-select__menu hidden" id="options-subtab-menu" role="listbox" aria-label="Teacher Settings sections"></div>
                        </div>
                        <div class="options-subtab-buttons" aria-hidden="true">
                            <button type="button" class="options-subtab-btn options-subtab-active" data-options-tab="classes" data-hint="Your classes and rosters">
                                <i class="fas fa-chalkboard-teacher mr-1.5"></i> My Classes
                            </button>
                            <button type="button" class="options-subtab-btn" data-options-tab="manage" data-hint="Fix stars, gold or a Familiar">
                                <i class="fas fa-tools mr-1.5"></i> Student Tools
                            </button>
                            <button type="button" class="options-subtab-btn" data-options-tab="planning" data-hint="Set a class's last lesson day">
                                <i class="fas fa-calendar-alt mr-1.5"></i> My Planning
                            </button>
                            <button type="button" class="options-subtab-btn" data-options-tab="profile" data-hint="Your display name">
                                <i class="fas fa-user mr-1.5"></i> Profile
                            </button>
                            <button type="button" class="options-subtab-btn" data-options-tab="assessments" data-hint="How tests and dictations are marked">
                                <i class="fas fa-clipboard-check mr-1.5"></i> Class Grading
                            </button>
                            <button type="button" class="options-subtab-btn" data-options-tab="access" data-hint="Parent logins for each student">
                                <i class="fas fa-user-shield mr-1.5"></i> Family Access
                            </button>
                            <button type="button" class="options-subtab-btn" data-options-tab="quiz" data-hint="An AI quiz from this week's lessons">
                                <i class="fas fa-circle-question mr-1.5"></i> Quiz
                            </button>
                            <button type="button" class="options-subtab-btn" data-options-tab="market" data-hint="Repair this month's stall">
                                <i class="fas fa-store mr-1.5"></i> Market
                            </button>
                        </div>
                    </div>

                    <div class="ts-desk">

                            <!-- ── STUDENT TOOLS ── -->
                            <section class="ts-page hidden" data-options-section="manage" data-ts-accent="manage">
                                <span class="ts-page__tape" aria-hidden="true"></span>
                                <header class="ts-page__head">
                                    <span class="ts-sticker" aria-hidden="true"><i class="fas fa-tools"></i></span>
                                    <div class="ts-page__heading">
                                        <h2 class="font-title ts-page__title">Student Tools</h2>
                                        <p class="ts-page__lede">Quick fixes for one student at a time: their stars, their gold, or their Familiar.</p>
                                    </div>
                                </header>

                                <div class="ts-tools">
                                    <article class="ts-card ts-tools__wide" data-ts-card="stars">
                                        <header class="ts-card__head">
                                            <span class="ts-card__icon" aria-hidden="true"><i class="fas fa-star"></i></span>
                                            <div>
                                                <h3 class="font-title ts-card__title">Student Star Manager</h3>
                                                <p class="ts-card__hint">Add historical awards or manually override current student scores.</p>
                                            </div>
                                        </header>
                                        <div id="star-manager-form" class="ts-card__body">
                                            <label class="ts-field">
                                                <span class="ts-label">Student</span>
                                                <select id="star-manager-student-select" class="ts-input">
                                                    <option value="">Loading students...</option>
                                                </select>
                                            </label>
                                            <div class="ts-split">
                                                <div class="ts-slip" data-ts-card="award">
                                                    <h4 class="ts-slip__title"><i class="fas fa-clock-rotate-left" aria-hidden="true"></i> Add Historical Award</h4>
                                                    <p class="ts-slip__hint">Writes a dated entry in the log, as if it were awarded that day.</p>
                                                    <div class="ts-row ts-row--2">
                                                        <label class="ts-field" for="star-manager-date">
                                                            <span class="ts-label">Award date</span>
                                                            <input type="date" id="star-manager-date" class="ts-input" disabled>
                                                        </label>
                                                        <label class="ts-field" for="star-manager-stars-to-add">
                                                            <span class="ts-label">Stars to add</span>
                                                            <input type="number" id="star-manager-stars-to-add" class="ts-input" min="0.5" step="0.5" max="10" value="1" disabled>
                                                        </label>
                                                    </div>
                                                    <label class="ts-field" for="star-manager-reason">
                                                        <span class="ts-label">Reason</span>
                                                        <select id="star-manager-reason" class="ts-input" disabled>
                                                            <option value="teamwork">Teamwork</option>
                                                            <option value="creativity">Creativity</option>
                                                            <option value="respect">Respect</option>
                                                            <option value="focus">Focus/Effort</option>
                                                            <option value="welcome_back">Welcome Back Bonus</option>
                                                            <option value="correction">Manual Correction</option>
                                                        </select>
                                                    </label>
                                                    <button id="star-manager-add-btn" class="ts-btn bubbly-button" disabled>
                                                        <i class="fas fa-plus-circle"></i> Add Stars to Log
                                                    </button>
                                                </div>
                                                <div class="ts-slip" data-ts-card="override">
                                                    <h4 class="ts-slip__title"><i class="fas fa-sliders" aria-hidden="true"></i> Direct Score Override</h4>
                                                    <p class="ts-slip__hint">Manually set the star counters. This does NOT create a log entry.</p>
                                                    <div id="star-override-form" class="ts-row ts-row--3">
                                                        <label class="ts-field" for="override-today-stars">
                                                            <span class="ts-label">Today</span>
                                                            <input type="number" id="override-today-stars" class="ts-input ts-input--num" min="0" value="0" disabled>
                                                        </label>
                                                        <label class="ts-field" for="override-monthly-stars">
                                                            <span class="ts-label">Monthly</span>
                                                            <input type="number" id="override-monthly-stars" class="ts-input ts-input--num" min="0" value="0" disabled>
                                                        </label>
                                                        <label class="ts-field" for="override-total-stars">
                                                            <span class="ts-label">Total</span>
                                                            <input type="number" id="override-total-stars" class="ts-input ts-input--num" min="0" value="0" disabled>
                                                        </label>
                                                    </div>
                                                    <button id="star-manager-override-btn" class="ts-btn bubbly-button" disabled>
                                                        <i class="fas fa-wrench"></i> Set Student Scores
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </article>

                                    <article class="ts-card" data-ts-card="gold">
                                        <header class="ts-card__head">
                                            <span class="ts-card__icon" aria-hidden="true"><i class="fas fa-coins"></i></span>
                                            <div>
                                                <h3 class="font-title ts-card__title">Coin Purse Manager</h3>
                                                <p class="ts-card__hint">Fix balances or reward custom gold amounts.</p>
                                            </div>
                                        </header>
                                        <div class="ts-card__body">
                                            <label class="ts-field" for="economy-student-select">
                                                <span class="ts-label">Student</span>
                                                <select id="economy-student-select" class="ts-input">
                                                    <option value="">Loading...</option>
                                                </select>
                                            </label>
                                            <label class="ts-field" for="economy-gold-input">
                                                <span class="ts-label">Current gold</span>
                                                <span class="ts-coin-input">
                                                    <input type="number" id="economy-gold-input" class="ts-input ts-input--gold" placeholder="0">
                                                    <span class="ts-coin-input__coin" aria-hidden="true">🪙</span>
                                                </span>
                                            </label>
                                            <button id="save-gold-btn" class="ts-btn bubbly-button" disabled>
                                                <i class="fas fa-save"></i> Update Balance
                                            </button>
                                        </div>
                                    </article>

                                    <article class="ts-card" data-ts-card="forge">
                                        <header class="ts-card__head">
                                            <span class="ts-card__icon" aria-hidden="true"><i class="fas fa-dragon"></i></span>
                                            <div>
                                                <h3 class="font-title ts-card__title">Familiar Sprite Forge</h3>
                                                <p class="ts-card__hint">Regenerate a Familiar sprite when the saved sheet looks wrong.</p>
                                            </div>
                                        </header>
                                        <div class="ts-card__body">
                                            <label class="ts-field" for="familiar-maintenance-student-select">
                                                <span class="ts-label">Student</span>
                                                <select id="familiar-maintenance-student-select" class="ts-input">
                                                    <option value="">Loading familiars...</option>
                                                </select>
                                            </label>
                                            <div id="familiar-maintenance-status" class="ts-note" aria-live="polite">
                                                Choose a student to inspect or regenerate their Familiar sprite.
                                            </div>
                                            <button id="familiar-regenerate-btn" class="ts-btn bubbly-button" disabled>
                                                <i class="fas fa-wand-sparkles"></i> Regenerate Familiar Sprite
                                            </button>
                                        </div>
                                    </article>
                                </div>
                            </section>

                            <!-- ── MY CLASSES ── -->
                            <section class="ts-page" data-options-section="classes" data-ts-accent="classes">
                                <span class="ts-page__tape" aria-hidden="true"></span>
                                <header class="ts-page__head">
                                    <span class="ts-sticker" aria-hidden="true"><i class="fas fa-chalkboard-teacher"></i></span>
                                    <div class="ts-page__heading">
                                        <h2 class="font-title ts-page__title">My Classes</h2>
                                        <p class="ts-page__lede">Manage your classes and student rosters from one place.</p>
                                    </div>
                                    <button id="open-create-class-modal-btn" type="button" class="ts-btn ts-page__action bubbly-button">
                                        <i class="fas fa-plus-circle"></i>
                                        <span>Add New Class</span>
                                    </button>
                                </header>
                                <div id="class-list" class="space-y-4"></div>
                            </section>

                            <!-- ── MY PLANNING ── -->
                            <section class="ts-page-wrap hidden" data-options-section="planning">
                                <div id="options-planning-locked" class="options-tier-locked hidden">
                                    <div class="options-tier-locked-icon">📅</div>
                                    <div class="options-tier-locked-title">Planning tools</div>
                                    <p class="options-tier-locked-text">Per-class planning preferences are available on the Pro plan. School-wide dates are managed by the Secretary/admin.</p>
                                    <span class="options-tier-locked-badge">Pro</span>
                                </div>
                                <div id="options-planning-content" class="ts-page" data-ts-accent="planning">
                                    <span class="ts-page__tape" aria-hidden="true"></span>
                                    <header class="ts-page__head">
                                        <span class="ts-sticker" aria-hidden="true"><i class="fas fa-calendar-alt"></i></span>
                                        <div class="ts-page__heading">
                                            <h2 class="font-title ts-page__title">My Class Planning</h2>
                                            <p class="ts-page__lede">Set the <strong>final lesson day</strong> for a class you own. After that date it drops out of day-by-day schedules.</p>
                                        </div>
                                    </header>

                                    <div class="ts-planning">
                                        <div id="class-end-dates-list" class="ts-planning__list">
                                            <!-- Filled by renderClassEndDatesList() -->
                                        </div>
                                        <aside class="ts-sticky-note">
                                            <p class="ts-sticky-note__title font-title">Class finale</p>
                                            <ol class="ts-sticky-note__steps">
                                                <li>Choose a class in the <strong>header</strong>.</li>
                                                <li>Pick its last lesson day.</li>
                                                <li>Save. Leave it empty if the class runs all year.</li>
                                            </ol>
                                            <p class="ts-sticky-note__foot">School-wide breaks still shade your calendars, but only the Secretary/admin edits them.</p>
                                        </aside>
                                    </div>

                                    <button type="button" id="save-class-end-dates-btn" disabled class="ts-btn ts-btn--block bubbly-button">
                                        <i class="fas fa-save"></i> Save for this class
                                    </button>
                                </div>
                            </section>

                            <!-- ── FAMILY ACCESS ── -->
                            <section class="ts-page hidden" data-options-section="access" data-ts-accent="access">
                                <span class="ts-page__tape" aria-hidden="true"></span>
                                <header class="ts-page__head">
                                    <span class="ts-sticker" aria-hidden="true"><i class="fas fa-user-shield"></i></span>
                                    <div class="ts-page__heading">
                                        <span class="ts-page__eyebrow"><i class="fas fa-lock" aria-hidden="true"></i> Parent logins</span>
                                        <h2 class="font-title ts-page__title">Family Access</h2>
                                        <p class="ts-page__lede">Create a parent username and password for each student you teach. Families can follow progress, homework, and school messages.</p>
                                    </div>
                                </header>
                                <div id="options-access-content"></div>
                            </section>

                            <!-- ── PROFILE ── -->
                            <section class="ts-page hidden" data-options-section="profile" data-ts-accent="profile">
                                <span class="ts-page__tape" aria-hidden="true"></span>
                                <header class="ts-page__head">
                                    <span class="ts-sticker" aria-hidden="true"><i class="fas fa-user-circle"></i></span>
                                    <div class="ts-page__heading">
                                        <h2 class="font-title ts-page__title">Profile Settings</h2>
                                        <p class="ts-page__lede">This is the name the app uses for you. Your badge updates as you type.</p>
                                    </div>
                                </header>
                                <div class="ts-profile">
                                    <div class="ts-badge" aria-hidden="true">
                                        <span class="ts-badge__clip"></span>
                                        <div class="ts-badge__band">
                                            <span>Staff</span>
                                            <i class="fas fa-star"></i>
                                        </div>
                                        <div class="ts-badge__photo" id="ts-badge-initials">?</div>
                                        <div class="ts-badge__name font-title" id="ts-badge-name">Your name</div>
                                        <div class="ts-badge__role">Teacher</div>
                                        <div class="ts-badge__school">The Great Class Quest</div>
                                        <div class="ts-badge__barcode"></div>
                                    </div>
                                    <div class="ts-profile__form">
                                        <label class="ts-field" for="teacher-name-input">
                                            <span class="ts-label">Your display name</span>
                                            <input type="text" id="teacher-name-input" class="ts-input ts-input--lg" autocomplete="off" placeholder="e.g. Ms. Papadaki">
                                        </label>
                                        <button id="save-teacher-name-btn" class="ts-btn ts-btn--block bubbly-button">
                                            <i class="fas fa-save"></i> Save Name
                                        </button>
                                        <label class="quest-cursor-preference" for="quest-cursor-toggle">
                                            <input type="checkbox" id="quest-cursor-toggle" checked>
                                            <span>Quest cursor</span>
                                        </label>
                                    </div>
                                </div>
                            </section>

                            <!-- ── CLASS GRADING ── -->
                            <section class="ts-page hidden" data-options-section="assessments" data-ts-accent="assessments" data-grading-tab="classes" data-grading-kind="tests">
                                <span class="ts-page__tape" aria-hidden="true"></span>
                                <header class="ts-page__head">
                                    <span class="ts-sticker" aria-hidden="true"><i class="fas fa-clipboard-check"></i></span>
                                    <div class="ts-page__heading">
                                        <h2 class="font-title ts-page__title">Class Grading</h2>
                                        <p class="ts-page__lede">School picture is read-only. Override Tests or Dictations only for a class you teach.</p>
                                    </div>
                                </header>
                                <div class="class-grading-switch" role="tablist" aria-label="Class Grading sections">
                                    <button type="button" class="class-grading-switch__btn is-active" data-grading-tab="classes" role="tab" aria-selected="true"><i class="fas fa-chalkboard-teacher" aria-hidden="true"></i> My classes</button>
                                    <button type="button" class="class-grading-switch__btn" data-grading-tab="school" role="tab" aria-selected="false"><i class="fas fa-school" aria-hidden="true"></i> School picture</button>
                                </div>
                                <div class="class-grading-panel hidden" data-grading-panel="school">
                                    <p class="class-grading-panel__lead">What the Secretary set for each Quest League. Ask them to change it.</p>
                                    <div id="options-assessment-defaults-editor"></div>
                                </div>
                                <div class="class-grading-panel" data-grading-panel="classes">
                                    <div class="class-grading-toolbar">
                                        <label class="class-grading-class-picker">
                                            <span>Class</span>
                                            <select id="class-grading-class-select"></select>
                                        </label>
                                        <div class="class-grading-kind" role="tablist" aria-label="Tests or dictations">
                                            <button type="button" class="class-grading-kind__btn is-active" data-grading-kind="tests" role="tab" aria-selected="true">Tests</button>
                                            <button type="button" class="class-grading-kind__btn" data-grading-kind="dictations" role="tab" aria-selected="false">Dictations</button>
                                        </div>
                                    </div>
                                    <div id="options-class-assessment-editor"></div>
                                    <button id="save-assessment-settings-btn" class="ts-btn ts-btn--block bubbly-button">
                                        <i class="fas fa-save"></i> Save My Class Grading
                                    </button>
                                </div>
                            </section>

                            <!-- Quiz of the Week section -->
                            <section class="ts-page-wrap hidden" data-options-section="quiz">
                                <div id="options-quiz-locked" class="options-tier-locked hidden">
                                    <div class="options-tier-locked-icon">❓</div>
                                    <div class="options-tier-locked-title">Quiz of the Week</div>
                                    <p class="options-tier-locked-text">AI-powered weekly quizzes are available on the Elite plan.</p>
                                    <span class="options-tier-locked-badge">Elite</span>
                                </div>
                                <div id="options-quiz-content" class="qwk ts-page hidden" data-ts-accent="quiz">
                                    <span class="ts-page__tape" aria-hidden="true"></span>
                                    <header class="ts-page__head qwk-head">
                                        <span class="ts-sticker" aria-hidden="true"><i class="fas fa-trophy"></i></span>
                                        <div class="ts-page__heading">
                                            <h2 class="font-title ts-page__title">Quiz of the Week</h2>
                                            <p class="ts-page__lede">A quiz show made from this week's lessons. Plan it here; the class plays it from Home during a lesson.</p>
                                        </div>
                                        <div id="qwk-class-chip" class="qwk-class hidden">
                                            <span id="qwk-class-logo" class="qwk-class__logo" aria-hidden="true"></span>
                                            <span class="qwk-class__copy">
                                                <span id="qwk-class-name" class="qwk-class__name"></span>
                                                <span id="qwk-class-meta" class="qwk-class__meta"></span>
                                            </span>
                                        </div>
                                    </header>

                                    <div id="qwk-no-class" class="qwk-empty">
                                        <span class="qwk-empty__icon" aria-hidden="true">🎟️</span>
                                        <p class="qwk-empty__title">Choose a class first</p>
                                        <p class="qwk-empty__text">Pick a class in the header and its quiz for this week appears here.</p>
                                    </div>

                                    <div id="qwk-body" class="qwk-body hidden">
                                        <!-- ── THIS WEEK ── -->
                                        <article id="qwk-week" class="qwk-week" data-tone="idle" aria-live="polite">
                                            <div class="qwk-week__top">
                                                <span id="qwk-week-icon" class="qwk-week__icon" aria-hidden="true">✨</span>
                                                <div class="qwk-week__copy">
                                                    <p id="qwk-week-eyebrow" class="qwk-week__eyebrow">This week</p>
                                                    <h3 id="qwk-week-title" class="qwk-week__title">No quiz for this week yet</h3>
                                                    <p id="qwk-week-sub" class="qwk-week__sub"></p>
                                                </div>
                                            </div>
                                            <ol id="qwk-track" class="qwk-track" aria-label="Quiz steps"></ol>
                                            <div id="qwk-week-facts" class="qwk-facts"></div>
                                            <div id="qwk-gen" class="qwk-gen hidden">
                                                <div class="qwk-gen__track"><div class="qwk-gen__fill"></div></div>
                                                <div class="qwk-gen__steps">
                                                    <span data-gen-step="1" class="qwk-gen__step">Writing questions</span>
                                                    <span data-gen-step="2" class="qwk-gen__step">Adding pictures</span>
                                                    <span data-gen-step="3" class="qwk-gen__step">Saving to the class</span>
                                                </div>
                                            </div>
                                            <div id="qwk-week-actions" class="qwk-week__actions">
                                                <button type="button" id="qwk-play-btn" class="ts-btn hidden"><i class="fas fa-play"></i> Open the quiz show</button>
                                                <button type="button" id="quiz-review-btn" class="ts-btn hidden"><i class="fas fa-eye"></i> <span id="quiz-review-btn-label">Check &amp; approve</span></button>
                                                <button type="button" id="qwk-results-btn" class="ts-btn hidden"><i class="fas fa-trophy"></i> See the results</button>
                                                <button type="button" id="quiz-reset-btn" class="qwk-link qwk-link--danger hidden"><i class="fas fa-trash-can"></i> Delete this week's quiz</button>
                                            </div>
                                        </article>

                                        <!-- ── THE PLAN ── -->
                                        <article id="qwk-plan" class="qwk-plan" data-mode="open">
                                            <header class="qwk-plan__head">
                                                <div>
                                                    <h3 class="qwk-plan__title"><i class="fas fa-pen-ruler"></i> <span id="qwk-plan-title">Plan the quiz</span></h3>
                                                    <p id="qwk-plan-summary" class="qwk-plan__summary hidden"></p>
                                                </div>
                                                <button type="button" id="qwk-plan-toggle" class="ts-btn ts-btn--quiet qwk-plan__toggle hidden"><i class="fas fa-sliders"></i> <span>Change the plan</span></button>
                                            </header>
                                            <p id="qwk-plan-locked" class="qwk-plan__locked hidden"><i class="fas fa-lock"></i> This week's quiz has been played, so its plan is closed. Next week's opens on Saturday.</p>

                                            <div id="qwk-plan-form" class="qwk-plan__form">
                                                <!-- 1. What it covers -->
                                                <section class="qwk-part">
                                                    <h4 class="qwk-part__title"><span class="qwk-part__num">1</span> What should it cover?</h4>

                                                    <div id="qwk-lesson" class="qwk-lesson hidden">
                                                        <div class="qwk-lesson__head">
                                                            <span class="qwk-lesson__badge"><i class="fas fa-book-open"></i> From your lessons</span>
                                                            <span id="qwk-lesson-window" class="qwk-lesson__window"></span>
                                                        </div>
                                                        <div id="qwk-lesson-units" class="qwk-lesson__units"></div>
                                                        <div id="qwk-lesson-grammar" class="qwk-lesson__grammar"></div>
                                                        <div id="qwk-words-block" class="qwk-words">
                                                            <div class="qwk-words__bar">
                                                                <span class="qwk-label">Words to practise <span id="qwk-words-count" class="qwk-label__count"></span></span>
                                                                <span class="qwk-words__tools">
                                                                    <button type="button" class="qwk-link" data-words="all">All</button>
                                                                    <button type="button" class="qwk-link" data-words="none">None</button>
                                                                </span>
                                                            </div>
                                                            <div id="qwk-lesson-words" class="qwk-chips"></div>
                                                        </div>
                                                        <button type="button" id="qwk-own-topics-btn" class="qwk-link qwk-lesson__switch"><i class="fas fa-shuffle"></i> Use my own topics instead</button>
                                                    </div>

                                                    <div id="qwk-topics" class="qwk-topics">
                                                        <div class="qwk-topics__bar">
                                                            <span class="qwk-label" id="qwk-topics-label">Pick the topics you covered</span>
                                                            <button type="button" id="qwk-back-to-lessons-btn" class="qwk-link hidden"><i class="fas fa-book-open"></i> Back to the lessons</button>
                                                        </div>
                                                        <div id="quiz-categories-chips" class="qwk-chips"></div>
                                                    </div>
                                                </section>

                                                <!-- 2. Style -->
                                                <section class="qwk-part">
                                                    <h4 class="qwk-part__title"><span class="qwk-part__num">2</span> What kind of questions?</h4>
                                                    <div id="qwk-type" class="qwk-type" role="radiogroup" aria-label="Question style"></div>
                                                    <label class="qwk-label qwk-note-label" for="quiz-keywords">Note for the quiz writer <span class="qwk-label__hint">(optional)</span></label>
                                                    <textarea id="quiz-keywords" class="ts-input qwk-note" rows="2" placeholder="e.g. keep sentences short, include was / were"></textarea>
                                                </section>

                                                <!-- 3. Extras -->
                                                <section class="qwk-part">
                                                    <h4 class="qwk-part__title"><span class="qwk-part__num">3</span> Before it goes live</h4>
                                                    <label class="qwk-switch" for="quiz-review-toggle">
                                                        <input type="checkbox" id="quiz-review-toggle" class="qwk-switch__input" />
                                                        <span class="qwk-switch__track" aria-hidden="true"><span class="qwk-switch__knob"></span></span>
                                                        <span class="qwk-switch__copy">
                                                            <span class="qwk-switch__title">Let me check the questions first</span>
                                                            <span class="qwk-switch__sub">Read, fix or remove any question before the class sees it.</span>
                                                        </span>
                                                    </label>
                                                    <label class="qwk-switch" for="quiz-carry-toggle">
                                                        <input type="checkbox" id="quiz-carry-toggle" class="qwk-switch__input" />
                                                        <span class="qwk-switch__track" aria-hidden="true"><span class="qwk-switch__knob"></span></span>
                                                        <span class="qwk-switch__copy">
                                                            <span class="qwk-switch__title">Bring back questions they missed</span>
                                                            <span class="qwk-switch__sub">You choose which ones return. They come first, with the answers shuffled.</span>
                                                        </span>
                                                    </label>
                                                    <div id="quiz-carry-panel" class="qwk-carry hidden" aria-live="polite">
                                                        <div class="qwk-carry__bar">
                                                            <span id="quiz-carry-summary" class="qwk-carry__summary">Looking for last week's quiz…</span>
                                                            <span class="qwk-words__tools">
                                                                <button type="button" id="quiz-carry-all-btn" class="qwk-link">All</button>
                                                                <button type="button" id="quiz-carry-none-btn" class="qwk-link">None</button>
                                                            </span>
                                                        </div>
                                                        <div id="quiz-carry-list" class="qwk-carry__list"></div>
                                                    </div>
                                                </section>

                                                <footer class="qwk-go">
                                                    <p id="quiz-validation-msg" class="qwk-go__warn hidden" role="alert"></p>
                                                    <p id="qwk-replace-note" class="qwk-go__replace hidden"><i class="fas fa-circle-info"></i> <span></span></p>
                                                    <div class="qwk-go__row">
                                                        <p id="qwk-go-summary" class="qwk-go__summary"></p>
                                                        <button type="button" id="quiz-generate-btn" class="ts-btn qwk-go__btn" disabled>
                                                            <i class="fas fa-wand-magic-sparkles"></i>
                                                            <span id="quiz-generate-btn-label">Create the quiz</span>
                                                        </button>
                                                    </div>
                                                </footer>
                                            </div>
                                        </article>

                                        <!-- ── PAST QUIZZES ── -->
                                        <article id="quiz-history-area" class="qwk-history hidden">
                                            <h3 class="qwk-history__title"><i class="fas fa-clock-rotate-left"></i> Past quizzes</h3>
                                            <ol id="quiz-history-list" class="qwk-history__list"></ol>
                                        </article>
                                    </div>
                                </div>
                            </section>

                            <section class="ts-page-wrap hidden" data-options-section="market">
                                <div id="options-market-locked" class="options-tier-locked hidden">
                                    <div class="options-tier-locked-icon">🛒</div>
                                    <div class="options-tier-locked-title">Market Manager</div>
                                    <p class="options-tier-locked-text">Repair Seasonal Treasures and the Festival Stall — new pictures, copies, and text — on the Elite plan.</p>
                                    <span class="options-tier-locked-badge">Elite</span>
                                </div>
                                <div id="options-market-content" class="ts-page hidden" data-ts-accent="market">
                                    <span class="ts-page__tape" aria-hidden="true"></span>
                                    <header class="ts-page__head">
                                        <span class="ts-sticker" aria-hidden="true"><i class="fas fa-store"></i></span>
                                        <div class="ts-page__heading">
                                            <h2 class="font-title ts-page__title">Market Manager</h2>
                                            <p class="ts-page__lede">Fix a black picture, rewrite a description, or change how many copies remain. This class’s stall follows the header.</p>
                                        </div>
                                    </header>
                                    <div id="market-manager-class" class="ts-class-strip">
                                        Choose a class from the header…
                                    </div>
                                    <div id="market-manager-list" class="market-manager-list"></div>
                                </div>
                            </section>
                    </div>
                    <div id="options-tier-summary" class="mt-8"></div>
                </div>
            </div>

`;
