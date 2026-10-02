// templates/modals/attendance.js
// Log New Trial marking board, attendance chronicle, trial history, hidden print templates
import { TRIAL_TYPES } from '../../features/trialTypesCore.mjs';

export const attendanceModalsHTML = `
    <div id="bulk-trial-modal"
        class="tl-overlay fixed inset-0 z-[73] flex items-center justify-center p-2 sm:p-4 hidden"
        role="dialog" aria-modal="true" aria-labelledby="bulk-trial-title">
        <div id="bulk-trial-shell" class="tl-board pop-in">
            <div class="tl-clip" aria-hidden="true">
                <span class="tl-clip__plate"></span>
                <span class="tl-clip__jaw"></span>
                <span class="tl-clip__rivet tl-clip__rivet--l"></span>
                <span class="tl-clip__rivet tl-clip__rivet--r"></span>
            </div>

            <div id="bulk-trial-type-switch" class="tl-tabs hidden" role="tablist" aria-label="Kind of trial">
                <button type="button" class="tl-tab tl-tab--dictation" data-trial-type="dictation" role="tab" aria-selected="false">
                    <i class="fas ${TRIAL_TYPES.dictation.icon}" aria-hidden="true"></i><span>Dictation</span>
                </button>
                <button type="button" class="tl-tab tl-tab--test" data-trial-type="test" role="tab" aria-selected="false">
                    <i class="fas fa-file-signature" aria-hidden="true"></i><span>Test</span>
                </button>
            </div>

            <div class="tl-sheet">
                <div class="tl-sheet__head">
                    <div class="tl-sheet__heading">
                        <p class="tl-kicker"><i class="fas fa-feather-alt" aria-hidden="true"></i> Marking sheet</p>
                        <h2 id="bulk-trial-title" class="tl-title font-title">Log Results</h2>
                        <p id="bulk-trial-subtitle" class="tl-subtitle"></p>
                    </div>

                    <div class="tl-fields">
                        <div class="tl-field tl-field--date">
                            <span class="tl-field__label">Date</span>
                            <button id="bulk-trial-date-chip" type="button" class="tl-date" aria-haspopup="true" aria-expanded="false">
                                <i class="fas fa-calendar-day" aria-hidden="true"></i>
                                <span id="bulk-trial-date-display" class="tl-date__text">--/--/----</span>
                                <i class="fas fa-chevron-down dp-chevron" aria-hidden="true"></i>
                            </button>
                            <input type="date" id="bulk-trial-date" class="sr-only" tabindex="-1" aria-hidden="true">
                            <div id="bulk-trial-date-picker" class="hidden bulk-date-picker-popover tl-dp">
                                <div class="bulk-date-picker-panel tl-dp__panel">
                                    <p class="tl-dp__head"><i class="fas fa-calendar-alt" aria-hidden="true"></i> Choose date</p>
                                    <div class="tl-dp__wheels">
                                        <div class="tl-dp__col">
                                            <button type="button" id="dp-day-up" class="tl-dp__step" aria-label="Next day"><i class="fas fa-chevron-up"></i></button>
                                            <div id="dp-day" class="tl-dp__value font-title">01</div>
                                            <button type="button" id="dp-day-down" class="tl-dp__step" aria-label="Previous day"><i class="fas fa-chevron-down"></i></button>
                                            <span class="tl-dp__unit">Day</span>
                                        </div>
                                        <div class="tl-dp__col tl-dp__col--month">
                                            <button type="button" id="dp-month-up" class="tl-dp__step" aria-label="Next month"><i class="fas fa-chevron-up"></i></button>
                                            <div id="dp-month" class="tl-dp__value tl-dp__value--month font-title">January</div>
                                            <button type="button" id="dp-month-down" class="tl-dp__step" aria-label="Previous month"><i class="fas fa-chevron-down"></i></button>
                                            <span class="tl-dp__unit">Month</span>
                                        </div>
                                        <div class="tl-dp__col">
                                            <button type="button" id="dp-year-up" class="tl-dp__step" aria-label="Next year"><i class="fas fa-chevron-up"></i></button>
                                            <div id="dp-year" class="tl-dp__value font-title">—</div>
                                            <button type="button" id="dp-year-down" class="tl-dp__step" aria-label="Previous year"><i class="fas fa-chevron-down"></i></button>
                                            <span class="tl-dp__unit">Year</span>
                                        </div>
                                    </div>
                                    <div class="tl-dp__actions">
                                        <button type="button" id="dp-today-btn" class="tl-dp__today">Today</button>
                                        <button type="button" id="dp-confirm-btn" class="tl-dp__confirm"><i class="fas fa-check" aria-hidden="true"></i> Set date</button>
                                        <button type="button" id="dp-cancel-btn" class="tl-dp__cancel" aria-label="Close"><i class="fas fa-times"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="bulk-trial-title-wrapper" class="tl-field tl-field--title hidden">
                            <label for="bulk-trial-name" class="tl-field__label">Title</label>
                            <input type="text" id="bulk-trial-name" class="tl-title-input" placeholder="Test title, e.g. Unit 5 Quiz" autocomplete="off">
                        </div>
                    </div>
                </div>

                <div class="tl-sheet__meta">
                    <div id="bulk-trial-legend" class="tl-legend"></div>
                    <p id="bulk-trial-tip-default" class="tl-tip">
                        <i class="fas fa-lightbulb" aria-hidden="true"></i>
                        Tap <b>Present</b> to mark someone absent. Tap a stamp again to clear it.
                    </p>
                </div>
                <div id="bulk-trial-scheduled-hint" class="hidden tl-hint">
                    <i class="fas fa-calendar-check" aria-hidden="true"></i>
                    <span id="bulk-trial-scheduled-hint-body"></span>
                </div>

                <div class="tl-sheet__lines scrollbar-custom">
                    <div id="bulk-student-list" class="tl-list"></div>
                </div>

                <div class="tl-sheet__foot">
                    <div class="tl-tally" aria-live="polite">
                        <div class="tl-tally__bar"><span id="bulk-trial-tally-fill" class="tl-tally__fill"></span></div>
                        <span id="bulk-trial-tally" class="tl-tally__text"></span>
                    </div>
                    <span class="tl-school" data-school-name>Your School</span>
                    <div class="tl-actions">
                        <button id="bulk-trial-close-btn" type="button" class="tl-btn tl-btn--ghost">Cancel</button>
                        <button id="bulk-trial-save-btn" type="button" class="tl-btn tl-btn--save">
                            <i class="fas fa-stamp" aria-hidden="true"></i> Save results
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="attendance-chronicle-modal"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[71] flex items-center justify-center p-3 sm:p-4 hidden"
        role="dialog" aria-modal="true" aria-labelledby="attendance-chronicle-title">
        <div class="attendance-chronicle-modal-panel ac-register pop-in">
            <div class="ac-register__cover">
                <div class="ac-register__label">
                    <p class="ac-register__kicker">Class register</p>
                    <h2 id="attendance-chronicle-title" class="ac-register__title">Attendance Chronicle</h2>
                </div>
                <p class="ac-register__subtitle">Who was there, lesson by lesson. Breaks and cancelled days are marked on the month strip.</p>
                <button id="attendance-chronicle-close-btn" type="button" class="ac-register__close"
                    aria-label="Close attendance chronicle"><i class="fas fa-times" aria-hidden="true"></i></button>
            </div>
            <div id="attendance-chronicle-content" class="ac-register__page scrollbar-custom">
            </div>
        </div>
    </div>

    <div id="trial-history-modal"
        class="th-overlay fixed inset-0 z-[71] flex items-center justify-center p-2 sm:p-4 hidden"
        role="dialog" aria-modal="true" aria-labelledby="trial-history-title">
        <div class="th-book pop-in">
            <span class="th-book__band" aria-hidden="true"></span>
            <header class="th-head">
                <span class="th-head__crest" aria-hidden="true"><i class="fas fa-book-open"></i></span>
                <div class="th-head__text">
                    <p class="th-head__kicker">Scholar's Scroll · Record Book</p>
                    <h2 id="trial-history-title" class="th-head__title">Trial History</h2>
                    <p id="trial-history-summary" class="th-head__summary"></p>
                </div>
                <button id="trial-history-close-btn" type="button" class="th-close" aria-label="Close trial history">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </header>

            <div class="th-page">
                <div id="trial-history-controls-container" class="th-controls">
                    <div id="trial-history-view-toggle" class="th-seg" role="tablist" aria-label="Kind of trial"></div>
                    <div id="trial-history-mode-toggle" class="th-seg th-seg--mode" role="group" aria-label="Arrange records"></div>
                    <label class="th-search">
                        <i class="fas fa-search" aria-hidden="true"></i>
                        <input id="trial-history-search" type="search" autocomplete="off" spellcheck="false"
                            placeholder="Find a student or trial…" aria-label="Find a student or trial">
                    </label>
                </div>
                <div id="trial-history-sort-row" class="th-sortbar"></div>
                <div id="trial-history-content" class="th-pages scrollbar-custom"></div>
                <footer class="th-foot">
                    <p id="trial-history-range" class="th-foot__range"></p>
                    <div id="trial-history-actions" class="th-foot__actions"></div>
                </footer>
            </div>
        </div>
    </div>

    <div style="position: fixed; left: -9999px; top: -9999px;">
        <!-- Hero Certificate page: filled by features/certificateCore.mjs via ui/modals/reports.js -->
        <div id="certificate-template" class="gcq-cert"></div>
        <div id="storybook-print-container" style="width: 800px;"></div>
        <div id="storybook-signature-page-template"
            style="width: 800px; height: 600px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 40px; background-color: #F3E8FF; border: 10px solid #A855F7; box-sizing: border-box;">
            <div id="signature-class-logo" style="font-size: 100px; margin-bottom: 20px;"></div>
            <h2 id="signature-created-by"
                style="font-family: 'Fredoka One', 'Fredoka', sans-serif; font-size: 40px; color: #5B21B6; text-align: center;">
                Created By The Adventurers Of</h2>
            <h1 id="signature-class-name"
                style="font-family: 'Fredoka One', 'Fredoka', sans-serif; font-size: 50px; color: #3730A3; text-align: center; margin-bottom: 20px;">
            </h1>
            <div id="signature-student-list"
                style="display: flex; flex-wrap: wrap; justify-content: center; gap: 5px 15px; font-family: 'Georgia', serif; font-size: 18px; color: #4C1D95;">
            </div>
            <p id="signature-school-name" style="font-size: 14px; color: #6D28D9; margin-top: auto;">Prodigies Language
                School</p>
        </div>
    </div>
`;
