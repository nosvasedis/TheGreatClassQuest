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
                                <div id="options-quiz-content" class="qow-panel ts-page hidden" data-ts-accent="quiz">
                                    <span class="ts-page__tape" aria-hidden="true"></span>
                                    <header class="ts-page__head">
                                        <span class="ts-sticker" aria-hidden="true"><i class="fas fa-trophy"></i></span>
                                        <div class="ts-page__heading">
                                            <h2 class="font-title ts-page__title">Quiz of the Week</h2>
                                            <p class="ts-page__lede">AI generates a tailored multiple-choice quiz from this week's lessons — play it live on Home.</p>
                                        </div>
                                    </header>

                                    <!-- ── HOW IT WORKS ── -->
                                    <div class="qow-steps-row">
                                        <div class="qow-step">
                                            <div class="qow-step-num">1</div>
                                            <div class="qow-step-icon">🎓</div>
                                            <div class="qow-step-label">Check this week's lessons</div>
                                        </div>
                                        <div class="qow-step-arrow">→</div>
                                        <div class="qow-step">
                                            <div class="qow-step-num">2</div>
                                            <div class="qow-step-icon">🤖</div>
                                            <div class="qow-step-label">AI generates questions</div>
                                        </div>
                                        <div class="qow-step-arrow">→</div>
                                        <div class="qow-step">
                                            <div class="qow-step-num">3</div>
                                            <div class="qow-step-icon">🎮</div>
                                            <div class="qow-step-label">Play live in class!</div>
                                        </div>
                                    </div>

                                    <!-- ── STEP 1 — CLASS (from header) ── -->
                                    <div class="qow-card" id="qow-card-class">
                                        <div class="qow-card-header">
                                            <span class="qow-card-badge">Step 1</span>
                                            <span class="qow-card-title"><i class="fas fa-users mr-2 text-amber-500"></i>Which class is this for?</span>
                                        </div>
                                        <div id="qow-class-display" class="qow-class-display rounded-xl border-2 border-amber-100 bg-amber-50/50 px-4 py-3 text-amber-900 font-title font-semibold text-center">
                                            Choose a class from the header…
                                        </div>
                                        <div id="qow-class-meta" class="qow-class-meta hidden">
                                            <span id="qow-class-level-badge" class="qow-level-badge"></span>
                                            <span id="qow-class-meta-text" class="qow-class-meta-text"></span>
                                        </div>
                                    </div>

                                    <!-- ── STEP 2 — CURRICULUM ── -->
                                    <div class="qow-card qow-card-disabled" id="qow-card-curriculum">
                                        <div class="qow-card-header">
                                            <span class="qow-card-badge">Step 2</span>
                                            <span class="qow-card-title" id="qow-curriculum-title"><i class="fas fa-book-open mr-2 text-amber-500"></i>This week's lessons</span>
                                        </div>

                                        <div id="qow-lesson-focus" class="qow-lesson-focus hidden">
                                            <p id="qow-lesson-summary" class="qow-lesson-summary"></p>
                                            <div id="qow-lesson-units" class="qow-lesson-units"></div>
                                            <div id="qow-lesson-grammar" class="qow-lesson-grammar"></div>
                                            <p class="qow-section-label" id="qow-lesson-words-label"><i class="fas fa-font mr-1"></i> Words they practised <span class="text-gray-400 font-normal">(untick to drop)</span></p>
                                            <div id="qow-lesson-words" class="qow-chips"></div>
                                        </div>

                                        <!-- Type pills -->
                                        <div class="qow-type-pills" id="qow-type-pills">
                                            <button class="qow-type-pill" data-type="grammar">
                                                <span class="qow-type-pill-icon">📐</span>
                                                <span class="qow-type-pill-label">Grammar</span>
                                            </button>
                                            <button class="qow-type-pill qow-type-pill-active" data-type="mix">
                                                <span class="qow-type-pill-icon">🔀</span>
                                                <span class="qow-type-pill-label">Mix</span>
                                            </button>
                                            <button class="qow-type-pill" data-type="vocabulary">
                                                <span class="qow-type-pill-icon">📚</span>
                                                <span class="qow-type-pill-label">Vocabulary</span>
                                            </button>
                                        </div>
                                        <!-- hidden select still used as source of truth -->
                                        <select id="quiz-curriculum-type" class="hidden">
                                            <option value="grammar">Grammar</option>
                                            <option value="vocabulary">Vocabulary</option>
                                            <option value="mix" selected>Mix</option>
                                        </select>

                                        <details id="qow-different-focus" class="qow-different-focus qow-focus-fallback" open>
                                            <summary id="qow-different-focus-summary" class="qow-different-focus-summary hidden">Different focus</summary>
                                            <div id="quiz-categories-wrap" class="qow-categories-wrap">
                                                <p class="qow-section-label"><i class="fas fa-tags mr-1"></i> Suggested topics <span class="text-gray-400 font-normal">(tick what you're covering)</span></p>
                                                <div id="quiz-categories-chips" class="qow-chips"></div>
                                            </div>
                                        </details>

                                        <div class="qow-keywords-wrap">
                                            <p class="qow-section-label" id="qow-keywords-label"><i class="fas fa-pen mr-1"></i> Add a note <span class="text-gray-400 font-normal">(optional)</span></p>
                                            <textarea id="quiz-keywords" class="qow-textarea" rows="2"
                                                placeholder="e.g. keep sentences short, include was/were…"></textarea>
                                        </div>
                                    </div>

                                    <!-- ── STEP 3: OPTIONAL EXTRAS ── -->
                                    <div class="qow-card qow-card-disabled" id="qow-card-options">
                                        <div class="qow-card-header">
                                            <span class="qow-card-badge">Step 3</span>
                                            <span class="qow-card-title"><i class="fas fa-sliders mr-2 text-amber-500"></i>Optional extras</span>
                                        </div>
                                        <label class="qow-option-toggle" for="quiz-review-toggle">
                                            <input type="checkbox" id="quiz-review-toggle" class="qow-option-check" />
                                            <span class="qow-option-copy">
                                                <span class="qow-option-title"><i class="fas fa-pen-to-square mr-1"></i>Review the questions before they go live</span>
                                                <span class="qow-option-sub">You can read, edit, or delete any question first. Leave this off and the quiz is ready as soon as it is generated.</span>
                                            </span>
                                        </label>
                                        <label class="qow-option-toggle" for="quiz-carry-toggle">
                                            <input type="checkbox" id="quiz-carry-toggle" class="qow-option-check" />
                                            <span class="qow-option-copy">
                                                <span class="qow-option-title"><i class="fas fa-rotate mr-1"></i>Bring back questions the class missed last week</span>
                                                <span class="qow-option-sub">Spaced review: you choose which missed questions return. Their answers are shuffled, and they take the first places in the quiz.</span>
                                            </span>
                                        </label>
                                        <div id="quiz-carry-panel" class="qow-carry-panel hidden" aria-live="polite">
                                            <div class="qow-carry-toolbar">
                                                <span id="quiz-carry-summary" class="qow-carry-summary">Looking for last week's quiz…</span>
                                                <span class="qow-carry-actions">
                                                    <button type="button" id="quiz-carry-all-btn" class="qow-carry-link">Select all</button>
                                                    <button type="button" id="quiz-carry-none-btn" class="qow-carry-link">Clear</button>
                                                </span>
                                            </div>
                                            <div id="quiz-carry-list" class="qow-carry-list"></div>
                                        </div>
                                    </div>

                                    <!-- ── VALIDATION MSG ── -->
                                    <p id="quiz-validation-msg" class="qow-validation hidden"></p>

                                    <!-- ── GENERATE BUTTON ── -->
                                    <button id="quiz-generate-btn" class="qow-generate-btn" disabled>
                                        <i class="fas fa-wand-magic-sparkles"></i>
                                        <span id="quiz-generate-btn-label">Generate from this week's lessons</span>
                                    </button>

                                    <!-- ── STATUS BANNER ── -->
                                    <div id="quiz-status-area" class="qow-status hidden">
                                        <div class="qow-status-top">
                                            <span id="quiz-status-icon" class="qow-status-emoji">⏳</span>
                                            <div class="qow-status-body">
                                                <div id="quiz-status-text" class="qow-status-title">Generating…</div>
                                                <div id="quiz-status-details" class="qow-status-sub"></div>
                                            </div>
                                            <div id="qow-status-badge" class="qow-status-pill hidden"></div>
                                        </div>
                                        <!-- Animated generation progress bar (shown during generation) -->
                                        <div id="qow-gen-progress" class="qow-gen-progress hidden">
                                            <div class="qow-gen-progress-track">
                                                <div class="qow-gen-progress-fill"></div>
                                            </div>
                                            <div class="qow-gen-steps">
                                                <span id="qow-gstep-1" class="qow-gen-step active">🤖 Crafting questions</span>
                                                <span id="qow-gstep-2" class="qow-gen-step">🖼️ Generating images</span>
                                                <span id="qow-gstep-3" class="qow-gen-step">✅ Saving to class</span>
                                            </div>
                                        </div>
                                        <button id="quiz-review-btn" type="button"
                                            class="qow-review-btn hidden">
                                            <i class="fas fa-pen-to-square mr-1"></i> <span id="quiz-review-btn-label">Review &amp; edit questions</span>
                                        </button>
                                        <button id="quiz-reset-btn"
                                            class="qow-reset-btn hidden">
                                            <i class="fas fa-rotate-left mr-1"></i> Delete &amp; Reset This Week's Quiz
                                        </button>
                                    </div>

                                    <!-- ── HISTORY ── -->
                                    <div id="quiz-history-area" class="qow-history hidden">
                                        <div class="qow-history-header">
                                            <i class="fas fa-clock-rotate-left mr-2 text-amber-500"></i>
                                            <span class="font-title text-amber-700">Recent Quizzes</span>
                                        </div>
                                        <div id="quiz-history-list" class="qow-history-list"></div>
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
