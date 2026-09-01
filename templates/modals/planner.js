// templates/modals/planner.js
// Day planner modal

export const plannerModalHTML = `
    <div id="day-planner-modal"
        class="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 hidden">
        <div class="day-planner-shell bg-white/95 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] max-w-2xl w-full pop-in border border-white/20 flex flex-col max-h-[90vh] overflow-hidden">
            
            <!-- Header Section -->
            <div class="day-planner-header relative p-6 text-white flex-shrink-0">
                <div class="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <div class="relative flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="day-planner-header__icon w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-2xl shadow-inner border border-white/30">
                            <i class="fas fa-calendar-alt text-white drop-shadow-sm"></i>
                        </div>
                        <div>
                            <h2 id="day-planner-title" class="font-title text-2xl drop-shadow-md">Day Planner</h2>
                            <p id="day-planner-kicker" class="text-indigo-100 font-bold uppercase tracking-widest text-[10px] opacity-80">This day's lessons</p>
                        </div>
                    </div>
                    <button id="day-planner-close-btn"
                        class="bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center transition-all hover:rotate-90">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <!-- Tab Navigation -->
            <div class="px-6 py-4 bg-slate-100/50 border-b border-gray-200">
                <nav id="day-planner-tabs" class="flex p-1 bg-gray-200/50 rounded-2xl border border-gray-200/50">
                    <button type="button" data-tab="schedule"
                        class="day-planner-tab-btn flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all">
                        <i class="fas fa-calendar-day"></i> Schedule
                    </button>
                    <button type="button" data-tab="event"
                        class="day-planner-tab-btn flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all">
                        <i class="fas fa-magic"></i> Quest Event
                    </button>
                </nav>
            </div>

            <!-- Content Area -->
            <div id="day-planner-content" class="flex-1 overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
                
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
                                <p class="quest-event-kicker">Lesson weather</p>
                                <h3>Applied on Award Stars</h3>
                                <p>The app doubles stars, or adds +1 for one virtue, during that lesson.</p>
                            </header>
                            <div class="quest-event-type-grid quest-event-type-grid--weather" role="listbox" aria-label="Standard events">
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
                            <p class="quest-event-footnote">Select one or more classes. Special Quests are stored separately per class.</p>
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
