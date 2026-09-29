// templates/modals/planner.js
// Day planner modal

export const plannerModalHTML = `
    <div id="day-planner-modal"
        class="fixed inset-0 bg-slate-950/60 z-[70] flex items-center justify-center p-4 hidden">
        <div class="day-planner-shell qc-modal qc-modal--planner max-w-2xl w-full pop-in flex flex-col max-h-[92vh] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="day-planner-title">
            
            <!-- Header: a torn-off calendar leaf, the date, day stepping and the Quest Log switch -->
            <div class="day-planner-header qc-mhead qc-mhead--planner">
                <div class="qc-leaf" aria-hidden="true">
                    <span id="day-planner-leaf-month" class="qc-leaf__month"></span>
                    <span id="day-planner-leaf-day" class="qc-leaf__day font-title"></span>
                    <span id="day-planner-leaf-weekday" class="qc-leaf__weekday"></span>
                </div>
                <div class="qc-mhead__text">
                    <p id="day-planner-kicker" class="qc-mhead__kicker">This day's lessons</p>
                    <h2 id="day-planner-title" class="font-title qc-mhead__title">Day Planner</h2>
                    <span id="day-planner-when" class="qc-when"></span>
                </div>
                <div class="qc-mhead__tools">
                    <div class="qc-daynav" role="group" aria-label="Change day">
                        <button type="button" class="qc-daynav__btn" data-day-step="-1" aria-label="Previous day" title="Previous day (←)"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                        <button type="button" class="qc-daynav__btn" data-day-step="1" aria-label="Next day" title="Next day (→)"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
                    </div>
                    <button type="button" id="day-planner-open-log-btn" class="qc-switch hidden">
                        <i class="fas fa-book-open" aria-hidden="true"></i><span>Quest Log</span>
                    </button>
                    <button type="button" id="day-planner-close-btn" class="qc-close" aria-label="Close planner">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                </div>
            </div>

            <!-- Day at a glance -->
            <div id="day-planner-glance" class="qc-glance" aria-live="polite"></div>

            <!-- Tab Navigation -->
            <div class="qc-tabs-wrap">
                <nav id="day-planner-tabs" class="qc-tabs" role="tablist">
                    <button type="button" data-tab="schedule" role="tab" class="day-planner-tab-btn qc-tab">
                        <i class="fas fa-calendar-day" aria-hidden="true"></i><span>Schedule</span>
                    </button>
                    <button type="button" data-tab="event" role="tab" id="day-planner-event-tab-btn" class="day-planner-tab-btn qc-tab">
                        <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i><span>Quest Event</span>
                    </button>
                </nav>
                <p id="day-planner-past-note" class="qc-tabs-note hidden"><i class="fas fa-hourglass-end" aria-hidden="true"></i> Quest Events can only be summoned for today or later.</p>
            </div>

            <!-- Content Area -->
            <div id="day-planner-content" class="qc-modal__body flex-1 overflow-y-auto custom-scrollbar">
                
                <!-- Schedule Tab -->
                <div id="day-planner-schedule-content" class="day-planner-tab-content schedule-tab">
                    <section class="quest-event-section">
                        <header class="quest-event-section__head">
                            <p class="quest-event-kicker">This day</p>
                            <h3>Lessons on the calendar</h3>
                            <p>Cancel a class you teach. That override lowers Team Quest goal pressure.</p>
                        </header>
                        <div id="schedule-manager-list" class="schedule-lesson-list"></div>
                    </section>

                    <section class="quest-event-section">
                        <header class="quest-event-section__head">
                            <p class="quest-event-kicker">Extra lesson</p>
                            <h3>Add a one-time lesson</h3>
                            <p>Pick a class that is not already meeting this day.</p>
                        </header>
                        <select id="add-onetime-lesson-select" class="quest-event-native"></select>
                        <div id="schedule-onetime-chips" class="quest-event-class-chips"></div>
                        <p id="schedule-onetime-empty" class="quest-event-footnote hidden">Every class you teach is already on this day.</p>
                        <button type="button" id="add-onetime-lesson-btn" class="schedule-add-btn">
                            <i class="fas fa-plus" aria-hidden="true"></i>
                            <span>Add lesson</span>
                        </button>
                    </section>

                    <section class="quest-event-section schedule-holiday-section">
                        <header class="quest-event-section__head">
                            <p class="quest-event-kicker">Unexpected closure</p>
                            <h3>Mark as School Holiday</h3>
                            <p>Cancels all classes this date and reshapes monthly goals. Winter Break and Easter belong in the School Office.</p>
                        </header>
                        <button type="button" id="day-planner-mark-holiday-btn" class="schedule-holiday-btn">
                            <i class="fas fa-umbrella-beach" aria-hidden="true"></i>
                            <span>Mark as School Holiday</span>
                        </button>
                    </section>
                </div>

                <!-- Event Tab -->
                <div id="day-planner-event-content" class="day-planner-tab-content hidden">
                    <form id="quest-event-form" class="quest-event-form">
                        <input type="hidden" id="quest-event-date">
                        <select id="quest-event-type" class="quest-event-native" required>
                            <option value="" disabled selected>Select an event type...</option>
                            <optgroup label="Standard Events">
                                <option value="2x Star Day">2x Star Day</option>
                                <option value="Reason Bonus Day">Reason Bonus Day</option>
                            </optgroup>
                            <optgroup label="Special Quests">
                                <option value="Vocabulary Vault">Vocabulary Vault</option>
                                <option value="The Unbroken Chain">The Unbroken Chain</option>
                                <option value="Grammar Guardians">Grammar Guardians</option>
                                <option value="The Scribe's Sketch">The Scribe's Sketch</option>
                                <option value="Five-Sentence Saga">Five-Sentence Saga</option>
                            </optgroup>
                        </select>
                        <select id="quest-event-scope" multiple size="3" class="quest-event-native"></select>

                        <section class="quest-event-section">
                            <header class="quest-event-section__head">
                                <p class="quest-event-kicker">Standard events</p>
                                <h3>Applied on Award Stars</h3>
                                <p>The app doubles stars, or adds +1 for one virtue, during that lesson.</p>
                            </header>
                            <div class="quest-event-type-grid quest-event-type-grid--standard" role="listbox" aria-label="Standard events">
                                <button type="button" class="quest-event-type-card quest-event-type-card--star" data-quest-type="2x Star Day" aria-pressed="false">
                                    <span class="quest-event-type-card__glyph" aria-hidden="true">⭐×2</span>
                                    <span class="quest-event-type-card__name">2x Star Day</span>
                                    <span class="quest-event-type-card__hint">Every positive award is doubled</span>
                                </button>
                                <button type="button" class="quest-event-type-card quest-event-type-card--reason" data-quest-type="Reason Bonus Day" aria-pressed="false">
                                    <span class="quest-event-type-card__glyph" aria-hidden="true">🎯</span>
                                    <span class="quest-event-type-card__name">Reason Bonus Day</span>
                                    <span class="quest-event-type-card__hint">+1 star for one Award Stars virtue</span>
                                </button>
                            </div>
                        </section>

                        <section class="quest-event-section">
                            <header class="quest-event-section__head">
                                <p class="quest-event-kicker">Special Quests</p>
                                <h3>Run in the room</h3>
                                <p>One-lesson shapes with a projector progress bar. Stored separately per class.</p>
                            </header>
                            <div class="quest-event-type-grid quest-event-type-grid--quests" role="listbox" aria-label="Special Quests">
                                <button type="button" class="quest-event-type-card quest-event-type-card--vault" data-quest-type="Vocabulary Vault" aria-pressed="false">
                                    <span class="quest-event-type-card__glyph" aria-hidden="true">💎</span>
                                    <span class="quest-event-type-card__name">Vocabulary Vault</span>
                                    <span class="quest-event-type-card__hint">Count valid word uses</span>
                                </button>
                                <button type="button" class="quest-event-type-card quest-event-type-card--grammar" data-quest-type="Grammar Guardians" aria-pressed="false">
                                    <span class="quest-event-type-card__glyph" aria-hidden="true">🛡️</span>
                                    <span class="quest-event-type-card__name">Grammar Guardians</span>
                                    <span class="quest-event-type-card__hint">Rescue sentences</span>
                                </button>
                                <button type="button" class="quest-event-type-card quest-event-type-card--chain" data-quest-type="The Unbroken Chain" aria-pressed="false">
                                    <span class="quest-event-type-card__glyph" aria-hidden="true">🔗</span>
                                    <span class="quest-event-type-card__name">The Unbroken Chain</span>
                                    <span class="quest-event-type-card__hint">Keep a spoken chain going</span>
                                </button>
                                <button type="button" class="quest-event-type-card quest-event-type-card--scribe" data-quest-type="The Scribe's Sketch" aria-pressed="false">
                                    <span class="quest-event-type-card__glyph" aria-hidden="true">✏️</span>
                                    <span class="quest-event-type-card__name">The Scribe's Sketch</span>
                                    <span class="quest-event-type-card__hint">Listen and draw</span>
                                </button>
                                <button type="button" class="quest-event-type-card quest-event-type-card--saga" data-quest-type="Five-Sentence Saga" aria-pressed="false">
                                    <span class="quest-event-type-card__glyph" aria-hidden="true">📜</span>
                                    <span class="quest-event-type-card__name">Five-Sentence Saga</span>
                                    <span class="quest-event-type-card__hint">Five given sentences</span>
                                </button>
                            </div>
                        </section>

                        <section class="quest-event-section">
                            <header class="quest-event-section__head">
                                <p class="quest-event-kicker">Who joins</p>
                                <h3>Classes</h3>
                            </header>
                            <div id="quest-event-class-chips" class="quest-event-class-chips"></div>
                            <div id="quest-event-all-classes" class="quest-event-class-chips hidden">
                                <span class="quest-event-class-chip quest-event-class-chip--selected quest-event-class-chip--locked" role="note">
                                    <span class="quest-event-class-chip__logo" aria-hidden="true">🏫</span>
                                    <span>All classes</span>
                                </span>
                            </div>
                            <p id="quest-event-class-footnote" class="quest-event-footnote">Select one or more classes. Special Quests are stored separately per class.</p>
                        </section>

                        <div id="quest-event-description" class="quest-event-insight hidden"></div>
                        <div id="quest-event-details-container" class="quest-event-details"></div>

                        <button type="submit" class="quest-event-submit">
                            <i class="fas fa-magic" aria-hidden="true"></i>
                            <span>Summon Event</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
`;
