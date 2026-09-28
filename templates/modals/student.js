// templates/modals/student.js
// Edit student, award note, note, move student

export const studentModalsHTML = `
    <div id="edit-student-modal"
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[75] flex items-center justify-center p-3 sm:p-4 hidden overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-student-title">

        <!-- The student's Adventurer's Passport: a teal cover opened on two pages -->
        <div class="sp-passport pop-in my-auto">

            <!-- Cover strip: who this passport belongs to -->
            <header class="sp-cover">
                <div class="sp-cover__crest" aria-hidden="true"><i class="fas fa-compass"></i></div>
                <div class="sp-cover__text">
                    <p class="sp-cover__eyebrow">Adventurer's Passport</p>
                    <h2 id="edit-student-title" class="sp-cover__title">Edit Student Details</h2>
                    <div class="sp-cover__chips">
                        <span id="edit-student-header-class-badge" class="sp-chip">Class</span>
                        <span id="edit-student-header-guild-badge" class="sp-chip sp-chip--guild hidden">Guild</span>
                    </div>
                    <p id="edit-student-header-subtitle" class="sr-only">Customize profile, celebrations & hero path</p>
                </div>
                <button type="button" id="edit-student-top-close-btn" class="sp-cover__close bubbly-button" title="Close" aria-label="Close">
                    <i class="fas fa-times"></i>
                </button>
            </header>

            <!-- The open passport: identity page + stamps page -->
            <div class="sp-spread">
                <input type="hidden" id="edit-student-id-input-full">

                <!-- LEFT PAGE: identity, record and shortcuts -->
                <div class="sp-page sp-page--left">
                    <section id="edit-student-panel-profile" class="edit-student-tab-panel sp-section sp-section--id" aria-labelledby="sp-id-heading">
                        <h3 id="sp-id-heading" class="sp-page__heading"><i class="fas fa-id-card"></i><span>Identity</span></h3>

                        <div class="sp-id">
                            <div class="sp-id__photo-col">
                                <div class="sp-photo" id="edit-student-header-avatar-wrap">
                                    <div id="edit-student-header-avatar"
                                        class="enlargeable-avatar sp-photo__img"
                                        title="View portrait"
                                        role="button"
                                        tabindex="0"
                                        aria-label="View portrait">
                                    </div>
                                    <span class="sp-photo__holo" aria-hidden="true"></span>
                                    <div id="edit-student-hero-icon-badge" class="sp-photo__badge" title="Hero Class">🌟</div>
                                </div>
                                <button type="button" id="edit-student-open-avatar-btn"
                                    class="edit-student-forge-btn sp-forge bubbly-button"
                                    title="Open Avatar Forge"
                                    aria-label="Open Avatar Forge">
                                    <span id="edit-student-avatar-preview-box" class="edit-student-forge-btn__portrait" aria-hidden="true"></span>
                                    <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
                                    <span>New portrait</span>
                                </button>
                                <p id="edit-student-avatar-status" class="sr-only">Using initials</p>
                            </div>

                            <div class="sp-id__fields">
                                <label for="edit-student-name-input-full" class="sp-field">
                                    <span class="sp-field__label">Name</span>
                                    <span class="sp-field__input-wrap">
                                        <input type="text" id="edit-student-name-input-full"
                                            class="sp-field__input"
                                            placeholder="Student's full name"
                                            autocomplete="off" required>
                                        <i class="fas fa-pen sp-field__pen" aria-hidden="true"></i>
                                    </span>
                                    <span class="sp-field__hint">Shown on rosters, logs and the parent portal.</span>
                                </label>

                                <div class="sp-field sp-field--row">
                                    <div class="min-w-0">
                                        <span class="sp-field__label">Class</span>
                                        <p id="edit-student-current-class-display" class="sp-field__value">--</p>
                                        <p id="edit-student-current-league-display" class="sp-field__sub">--</p>
                                    </div>
                                    <button type="button" id="edit-student-quick-move-btn" class="sp-mini-btn bubbly-button" title="Transfer to another class">
                                        <i class="fas fa-exchange-alt" aria-hidden="true"></i><span>Move</span>
                                    </button>
                                </div>

                                <div class="sp-field sp-field--row">
                                    <div class="min-w-0">
                                        <span class="sp-field__label">Guild</span>
                                        <p id="edit-student-current-guild-display" class="sp-field__value">Unassigned</p>
                                        <p id="edit-student-current-guild-desc" class="sp-field__sub">No guild assigned</p>
                                    </div>
                                    <button type="button" id="edit-student-quick-guild-btn" class="sp-mini-btn sp-mini-btn--gold bubbly-button" title="Guild Sorting Quiz">
                                        <i class="fas fa-hat-wizard" aria-hidden="true"></i><span>Sort</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Record strip -->
                        <dl class="sp-record" aria-label="Quest record">
                            <div class="sp-record__cell">
                                <dt>Total stars</dt>
                                <dd id="edit-student-stat-total-stars">0 ⭐</dd>
                            </div>
                            <div class="sp-record__cell">
                                <dt>This month</dt>
                                <dd id="edit-student-stat-monthly-stars">0 🌟</dd>
                            </div>
                            <div class="sp-record__cell">
                                <dt>Gold</dt>
                                <dd id="edit-student-stat-gold">0 🪙</dd>
                            </div>
                            <div class="sp-record__cell">
                                <dt>Hero rank</dt>
                                <dd id="edit-student-stat-hero-level">Lvl 1</dd>
                            </div>
                        </dl>
                    </section>

                    <!-- Tools -->
                    <section id="edit-student-panel-actions" class="edit-student-tab-panel sp-section" aria-labelledby="sp-tools-heading">
                        <h3 id="sp-tools-heading" class="sp-page__heading"><i class="fas fa-bolt"></i><span>Open for this student</span></h3>
                        <div class="sp-tools">
                            <button type="button" id="edit-student-hub-chronicle-btn" class="sp-tool sp-tool--chronicle bubbly-button" title="Adventure notes & Oracle AI">
                                <span class="sp-tool__icon"><i class="fas fa-book-reader"></i></span>
                                <span class="sp-tool__label">Chronicle</span>
                            </button>
                            <button type="button" id="edit-student-hub-analytics-btn" class="sp-tool sp-tool--analytics bubbly-button" title="Scores, grades & history">
                                <span class="sp-tool__icon"><i class="fas fa-chart-line"></i></span>
                                <span class="sp-tool__label">Analytics</span>
                            </button>
                            <button type="button" id="edit-student-hub-certificate-btn" class="sp-tool sp-tool--certificate bubbly-button" title="Generate award certificate">
                                <span class="sp-tool__icon"><i class="fas fa-award"></i></span>
                                <span class="sp-tool__label">Certificate</span>
                            </button>
                            <button type="button" id="edit-student-hub-avatar-btn" class="sp-tool sp-tool--forge bubbly-button" title="Create or update a hero portrait">
                                <span class="sp-tool__icon"><i class="fas fa-wand-magic-sparkles"></i></span>
                                <span class="sp-tool__label">Avatar Forge</span>
                            </button>
                            <button type="button" id="edit-student-hub-skilltree-btn" class="sp-tool sp-tool--tree bubbly-button" title="Talents & active abilities">
                                <span class="sp-tool__icon"><i class="fas fa-sitemap"></i></span>
                                <span class="sp-tool__label">Skill Tree</span>
                            </button>
                            <button type="button" id="edit-student-hub-move-btn" class="sp-tool sp-tool--move bubbly-button" title="Transfer to another class">
                                <span class="sp-tool__icon"><i class="fas fa-people-arrows"></i></span>
                                <span class="sp-tool__label">Move class</span>
                            </button>
                        </div>
                    </section>
                </div>

                <!-- RIGHT PAGE: special-day stamps and the hero path -->
                <div class="sp-page sp-page--right">

                    <!-- Special days -->
                    <section id="edit-student-panel-dates" class="edit-student-tab-panel sp-section" aria-labelledby="sp-dates-heading">
                        <h3 id="sp-dates-heading" class="sp-page__heading"><i class="fas fa-cake-candles"></i><span>Special days</span></h3>
                        <div class="sp-stamps">
                            <div class="sp-stamp sp-stamp--birthday" data-stamp="birthday">
                                <div class="sp-stamp__inner">
                                    <div class="sp-stamp__head">
                                        <span class="sp-stamp__icon" aria-hidden="true">🎂</span>
                                        <span class="sp-stamp__title">Birthday</span>
                                        <button type="button" id="edit-student-clear-birthday-btn" class="sp-stamp__clear" title="Clear Birthday">Clear</button>
                                    </div>
                                    <div class="sp-stamp__selects">
                                        <label class="sr-only" for="edit-student-birthday-day">Birthday day</label>
                                        <select id="edit-student-birthday-day" class="sp-select sp-select--day"></select>
                                        <label class="sr-only" for="edit-student-birthday-month">Birthday month</label>
                                        <select id="edit-student-birthday-month" class="sp-select"></select>
                                    </div>
                                    <div class="sp-stamp__foot">
                                        <span class="sp-stamp__date" data-stamp-date="birthday">Not set yet</span>
                                    </div>
                                </div>
                            </div>

                            <div class="sp-stamp sp-stamp--nameday" data-stamp="nameday">
                                <div class="sp-stamp__inner">
                                    <div class="sp-stamp__head">
                                        <span class="sp-stamp__icon" aria-hidden="true">📅</span>
                                        <span class="sp-stamp__title">Nameday</span>
                                        <button type="button" id="edit-student-clear-nameday-btn" class="sp-stamp__clear" title="Clear Nameday">Clear</button>
                                    </div>
                                    <div class="sp-stamp__selects">
                                        <label class="sr-only" for="edit-student-nameday-day">Nameday day</label>
                                        <select id="edit-student-nameday-day" class="sp-select sp-select--day"></select>
                                        <label class="sr-only" for="edit-student-nameday-month">Nameday month</label>
                                        <select id="edit-student-nameday-month" class="sp-select"></select>
                                    </div>
                                    <div class="sp-stamp__foot">
                                        <span class="sp-stamp__date" data-stamp-date="nameday">Not set yet</span>
                                        <button type="button" id="lookup-nameday-btn" class="sp-lookup bubbly-button" title="AI Nameday Lookup (Greek Orthodox calendar)">
                                            <i class="fas fa-magic" aria-hidden="true"></i>
                                            <span>Find from name</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p class="sp-note">On their day the class sees a celebration banner and they get bonus stars.</p>
                    </section>

                    <!-- Hero path -->
                    <section id="edit-student-panel-hero" class="edit-student-tab-panel sp-section" aria-labelledby="sp-hero-heading">
                        <h3 id="sp-hero-heading" class="sp-page__heading"><i class="fas fa-shield-halved"></i><span>Hero path</span></h3>
                        <div id="edit-student-hero-summary" class="sp-visa">
                            <div id="edit-student-hero-summary-icon" class="sp-visa__emblem">🌟</div>
                            <div class="sp-visa__body">
                                <p id="edit-student-hero-summary-name" class="sp-visa__name">No Class</p>
                                <p id="edit-student-hero-summary-virtue" class="sp-visa__virtue">Unassigned</p>
                                <p id="edit-student-hero-summary-perk" class="sp-visa__perk">Leave unassigned, or open the ceremony so they can choose.</p>
                            </div>
                            <div class="sp-visa__actions">
                                <button type="button" id="edit-student-choose-hero-class-btn" class="sp-visa__choose bubbly-button">
                                    <i class="fas fa-hat-wizard" aria-hidden="true"></i>
                                    <span id="edit-student-choose-hero-class-label">Choose Hero Class</span>
                                </button>
                                <button type="button" id="edit-student-open-skilltree-btn" class="sp-visa__tree bubbly-button" title="Open Hero Skill Tree">
                                    <i class="fas fa-sitemap" aria-hidden="true"></i>
                                    <span>Skill tree</span>
                                </button>
                            </div>
                        </div>
                        <p id="hero-class-tier-note" class="sp-note sp-note--hero">
                            Classes grant +10 extra Gold when earning stars for their specific trait.
                        </p>
                    </section>

                </div>
            </div>

            <!-- Sticky Modal Footer -->
            <footer class="sp-footer">
                <p id="edit-student-dirty-note" class="sp-footer__status" aria-live="polite">No changes yet</p>
                <div class="sp-footer__actions">
                    <button type="button" id="edit-student-cancel-btn" class="sp-btn sp-btn--ghost bubbly-button">Cancel</button>
                    <button type="button" id="edit-student-confirm-btn" class="sp-btn sp-btn--save bubbly-button">
                        <i class="fas fa-check mr-1.5"></i> Save Changes
                    </button>
                </div>
            </footer>
        </div>
    </div>

    <div id="award-note-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full pop-in border-4 border-blue-300">
            <h2 class="font-title text-2xl text-blue-700 mb-4 text-center">Teacher's Note for Award</h2>
            <input type="hidden" id="award-note-log-id-input">
            <div class="mb-4">
                <label for="award-note-textarea" class="block text-sm font-medium text-gray-700">Your personal note for
                    this award:</label>
                <textarea id="award-note-textarea" rows="4"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"></textarea>
            </div>
            <div class="flex justify-around gap-4 mt-6">
                <button id="award-note-cancel-btn"
                    class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-2 px-8 rounded-xl bubbly-button">Cancel</button>
                <button id="award-note-confirm-btn"
                    class="w-full bg-blue-500 hover:bg-blue-600 text-white font-title text-lg py-2 px-8 rounded-xl bubbly-button">Save
                    Note</button>
            </div>
        </div>
    </div>

    <div id="note-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden"
        role="dialog" aria-modal="true" aria-labelledby="note-modal-title">
        <div class="diary-sticky pop-in">
            <span class="diary-sticky__tape" aria-hidden="true"></span>
            <h2 id="note-modal-title" class="diary-sticky__title">A note for this page</h2>
            <p id="note-modal-page" class="diary-sticky__page"></p>
            <input type="hidden" id="note-log-id-input">
            <label for="note-textarea" class="sr-only">Your note for this day's page</label>
            <textarea id="note-textarea" rows="5" class="diary-sticky__text" maxlength="400"
                placeholder="A few words for the class to remember about this day…"></textarea>
            <p class="diary-sticky__hint">It appears on the page as a sticky note, signed with your name. Leave it empty to remove it.</p>
            <div class="diary-sticky__actions">
                <button id="note-cancel-btn" type="button" class="diary-sticky__btn diary-sticky__btn--ghost">Cancel</button>
                <button id="note-confirm-btn" type="button" class="diary-sticky__btn diary-sticky__btn--save"><i class="fas fa-thumbtack" aria-hidden="true"></i> Stick it on</button>
            </div>
        </div>
    </div>

    <div id="move-student-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full pop-in border-4 border-yellow-300">
            <h2 class="font-title text-2xl text-yellow-800 mb-4 text-center">Move Student</h2>
            <p class="text-center mb-2">Moving: <b id="move-student-name" class="text-lg"></b></p>
            <p class="text-center text-sm text-gray-600 mb-6">From: <span id="move-student-current-class"></span></p>
            <div class="mb-4">
                <label for="move-student-target-class" class="block text-sm font-medium text-gray-700">Select new class
                    (must be in the same league):</label>
                <select id="move-student-target-class"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"></select>
            </div>
            <div class="flex justify-around gap-4 mt-6">
                <button id="move-student-cancel-btn"
                    class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-2 px-8 rounded-xl bubbly-button">Cancel</button>
                <button id="move-student-confirm-btn"
                    class="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-title text-lg py-2 px-8 rounded-xl bubbly-button">Confirm
                    Move</button>
            </div>
        </div>
    </div>
`;
