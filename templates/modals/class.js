// templates/modals/class.js
// Edit class, logbook, history

import { questLeagues } from '../../constants.js';

const createClassLeagueOptions = questLeagues
    .map((league) => `<option value="${league}">${league}</option>`)
    .join('');

export const classModalsHTML = `
    <div id="create-class-modal"
        class="cc-backdrop fixed inset-0 z-[71] flex items-center justify-center p-4 hidden overflow-y-auto">
        <form id="add-class-form" class="cc-charter pop-in w-full relative">
            <button type="button" id="create-class-close-btn" class="cc-close" aria-label="Close">&times;</button>

            <div class="relative">
                <header class="cc-head">
                    <div class="cc-ribbon" aria-hidden="true"></div>
                    <p class="cc-kicker">A new class charter</p>
                    <h2 class="cc-title">Add New Class</h2>
                    <p class="cc-subtitle">Name your class, pin its emblem and set the days it meets. Its adventure begins today.</p>
                </header>

                <div class="cc-emblem-row">
                    <div class="cc-emblem-seat">
                        <button type="button" id="logo-picker-btn" class="cc-emblem" aria-label="Choose the class logo" aria-describedby="cc-emblem-hint">📚</button>
                        <input type="hidden" id="class-logo" value="📚">
                    </div>
                    <div class="cc-emblem-copy">
                        <span class="cc-label">Class Logo</span>
                        <p id="cc-emblem-hint">Tap the emblem to choose from hundreds.</p>
                    </div>
                </div>

                <div class="cc-fields">
                    <div class="cc-field">
                        <label for="class-name" class="cc-label">Class Name</label>
                        <div class="cc-name-row">
                            <input type="text" id="class-name" class="cc-input" placeholder="e.g. The Star Seekers" autocomplete="off" required>
                            <button type="button" id="generate-class-name-btn" class="cc-spark"
                                title="Suggest names with AI" aria-label="Suggest names with AI">
                                <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
                            </button>
                        </div>
                        <div id="class-name-suggestions" class="mt-2 flex flex-wrap gap-2"></div>
                    </div>
                    <div class="cc-field">
                        <label for="class-level" class="cc-label">Quest Level (League)</label>
                        <select id="class-level" class="cc-input" required>
                            <option value="" disabled selected>Select a league...</option>
                            ${createClassLeagueOptions}
                        </select>
                    </div>
                    <fieldset class="cc-field cc-field--wide cc-panel">
                        <legend class="cc-label"><i class="far fa-calendar-alt" aria-hidden="true"></i>Meets on</legend>
                        <div class="cc-days">
                            <label class="cc-day"><input type="checkbox" name="schedule-day" value="1"><span>Mon</span></label>
                            <label class="cc-day"><input type="checkbox" name="schedule-day" value="2"><span>Tue</span></label>
                            <label class="cc-day"><input type="checkbox" name="schedule-day" value="3"><span>Wed</span></label>
                            <label class="cc-day"><input type="checkbox" name="schedule-day" value="4"><span>Thu</span></label>
                            <label class="cc-day"><input type="checkbox" name="schedule-day" value="5"><span>Fri</span></label>
                            <label class="cc-day"><input type="checkbox" name="schedule-day" value="6"><span>Sat</span></label>
                            <label class="cc-day"><input type="checkbox" name="schedule-day" value="0"><span>Sun</span></label>
                        </div>
                    </fieldset>
                    <div class="cc-field cc-field--wide cc-panel cc-times">
                        <div>
                            <label for="class-time-start" class="cc-label"><i class="far fa-clock" aria-hidden="true"></i>From</label>
                            <input type="time" id="class-time-start" class="cc-input">
                        </div>
                        <span class="cc-times__dash" aria-hidden="true"></span>
                        <div>
                            <label for="class-time-end" class="cc-label"><i class="far fa-clock" aria-hidden="true"></i>To</label>
                            <input type="time" id="class-time-end" class="cc-input">
                        </div>
                    </div>
                </div>

                <div class="cc-actions">
                    <button type="button" id="create-class-cancel-btn" class="cc-btn cc-btn--ghost">Cancel</button>
                    <button type="submit" class="cc-btn cc-btn--primary">
                        <i class="fas fa-flag" aria-hidden="true"></i> Create Class
                    </button>
                </div>
            </div>
        </form>
    </div>

    <div id="edit-class-modal"
        class="cc-backdrop fixed inset-0 z-[70] flex items-center justify-center p-4 hidden overflow-y-auto">
        <form id="edit-class-form" class="cc-charter cc-charter--edit pop-in w-full relative" novalidate
            aria-labelledby="edit-class-title">
            <button type="button" id="edit-class-close-btn" class="cc-close" aria-label="Close">&times;</button>

            <div class="relative">
                <header class="cc-head">
                    <div class="cc-ribbon" aria-hidden="true"></div>
                    <p class="cc-kicker">Amend the class charter</p>
                    <h2 id="edit-class-title" class="cc-title">Edit Class</h2>
                    <p id="edit-class-facts" class="cc-facts"></p>
                </header>

                <div class="cc-emblem-row">
                    <div class="cc-emblem-seat">
                        <button type="button" id="edit-logo-picker-btn" class="cc-emblem" aria-label="Change the class logo">📚</button>
                        <input type="hidden" id="edit-class-logo">
                    </div>
                    <div class="cc-emblem-copy">
                        <span class="cc-label">Class Logo</span>
                        <p>Tap the emblem to change it.</p>
                    </div>
                </div>

                <input type="hidden" id="edit-class-id">

                <div class="cc-fields">
                    <div class="cc-field" data-cc-field="name">
                        <label for="edit-class-name" class="cc-label">Class Name <span id="edit-class-name-count"></span></label>
                        <input type="text" id="edit-class-name" class="cc-input" maxlength="60" autocomplete="off" required
                            aria-describedby="edit-class-name-error">
                        <p id="edit-class-name-error" class="cc-error" role="alert"></p>
                    </div>
                    <div class="cc-field" data-cc-field="level">
                        <label for="edit-class-level" class="cc-label">Quest League <span id="edit-class-level-age"></span></label>
                        <select id="edit-class-level" class="cc-input" required aria-describedby="edit-class-league-note"></select>
                        <p id="edit-class-level-error" class="cc-error" role="alert"></p>
                    </div>
                    <div id="edit-class-league-note" class="cc-field cc-field--wide cc-note hidden" role="status">
                        <i class="fas fa-map-signs" aria-hidden="true"></i>
                        <p></p>
                    </div>

                    <fieldset class="cc-field cc-field--wide cc-panel">
                        <legend class="cc-label"><i class="far fa-calendar-alt" aria-hidden="true"></i>Meets on</legend>
                        <div id="edit-schedule-days" class="cc-days"></div>
                        <div class="cc-presets" id="edit-class-day-presets" aria-label="Quick day patterns"></div>
                    </fieldset>

                    <div class="cc-field cc-field--wide cc-panel" data-cc-field="time">
                        <div class="cc-times">
                            <div>
                                <label for="edit-class-time-start" class="cc-label"><i class="far fa-clock" aria-hidden="true"></i>From</label>
                                <input type="time" id="edit-class-time-start" class="cc-input">
                            </div>
                            <span class="cc-times__dash" aria-hidden="true"></span>
                            <div>
                                <label for="edit-class-time-end" class="cc-label"><i class="far fa-clock" aria-hidden="true"></i>To</label>
                                <input type="time" id="edit-class-time-end" class="cc-input">
                            </div>
                        </div>
                        <div class="cc-presets" id="edit-class-length-presets" aria-label="Lesson length"></div>
                        <p id="edit-class-time-error" class="cc-error" role="alert"></p>
                    </div>

                    <div class="cc-field cc-field--wide cc-summary" aria-live="polite">
                        <span class="cc-summary__icon" aria-hidden="true"><i class="fas fa-scroll"></i></span>
                        <div>
                            <span class="cc-summary__kicker">On the charter</span>
                            <p id="edit-class-summary" class="cc-summary__text"></p>
                        </div>
                    </div>
                </div>

                <div class="cc-actions">
                    <button type="button" id="edit-class-cancel-btn" class="cc-btn cc-btn--ghost">Cancel</button>
                    <button type="submit" id="edit-class-save-btn" class="cc-btn cc-btn--primary">
                        <i class="fas fa-feather-pointed" aria-hidden="true"></i> <span>Save Changes</span>
                    </button>
                </div>
            </div>
        </form>
    </div>

    <div id="logbook-modal"
        class="fixed inset-0 bg-slate-950/60 z-[71] flex items-center justify-center p-4 hidden">
        <div class="qc-modal qc-modal--log max-w-3xl w-full pop-in flex flex-col max-h-[92vh] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="logbook-modal-title">
            <!-- Header: calendar leaf, the date, day stepping and the Planner switch -->
            <div class="qc-mhead qc-mhead--log">
                <div class="qc-leaf" aria-hidden="true">
                    <span id="logbook-modal-leaf-month" class="qc-leaf__month"></span>
                    <span id="logbook-modal-leaf-day" class="qc-leaf__day font-title"></span>
                    <span id="logbook-modal-leaf-weekday" class="qc-leaf__weekday"></span>
                </div>
                <div class="qc-mhead__text">
                    <p class="qc-mhead__kicker">Daily Quest Log</p>
                    <h2 id="logbook-modal-title" class="font-title qc-mhead__title">Daily Quest Log</h2>
                    <span id="logbook-modal-when" class="qc-when"></span>
                </div>
                <div class="qc-mhead__tools">
                    <div class="qc-daynav" role="group" aria-label="Change day">
                        <button type="button" class="qc-daynav__btn" data-day-step="-1" aria-label="Previous day" title="Previous day (←)"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                        <button type="button" class="qc-daynav__btn" data-day-step="1" aria-label="Next day" title="Next day (→)"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
                    </div>
                    <button type="button" id="logbook-open-planner-btn" class="qc-switch">
                        <i class="fas fa-feather-pointed" aria-hidden="true"></i><span>Planner</span>
                    </button>
                    <button type="button" id="logbook-modal-close-btn" class="qc-close" aria-label="Close quest log">
                        <i class="fas fa-times" aria-hidden="true"></i>
                    </button>
                </div>
            </div>

            <!-- Content Area -->
            <div id="logbook-modal-content" class="qc-modal__body qc-log flex-1 overflow-y-auto custom-scrollbar">
                <!-- Content injected by showLogbookModal -->
            </div>
        </div>
    </div>

    <div id="history-modal"
        class="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[71] flex items-center justify-center p-4 hidden">
        <div class="history-archive-shell bg-white/95 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] max-w-5xl w-full pop-in border border-white/20 flex flex-col max-h-[90vh] overflow-hidden">
            <div class="history-archive-head">
                <div class="history-archive-emblem" aria-hidden="true"><i class="fas fa-scroll"></i></div>
                <div class="history-archive-heading">
                    <h2 id="history-modal-title" class="font-title">Historical Leaderboard</h2>
                    <p id="history-modal-subtitle">Quest Archives</p>
                </div>
                <button id="history-modal-close-btn" class="history-archive-close" aria-label="Close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="history-modal-content" class="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-50/30">
                <p class="text-center text-gray-500">Select a month to view historical rankings.</p>
            </div>
        </div>
    </div>
`;
