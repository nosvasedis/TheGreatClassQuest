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
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 hidden overflow-y-auto">
        <form id="edit-class-form"
            class="bg-white p-6 md:p-8 rounded-[2rem] shadow-2xl max-w-2xl w-full pop-in border border-cyan-100 my-8 relative overflow-hidden">
            <!-- Decorative Header Gradient -->
            <div class="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-cyan-500/20 via-sky-400/10 to-transparent pointer-events-none"></div>
            
            <div class="relative">
                <div class="text-center mb-8">
                    <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-100 text-cyan-500 text-3xl mb-3 shadow-inner floating-icon">
                        <i class="fas fa-edit"></i>
                    </div>
                    <h2 class="font-title text-4xl text-cyan-800 text-center" style="text-shadow: 0 2px 4px rgba(0,0,0,0.05);">Edit Class</h2>
                    <p class="text-gray-500 mt-2">Update the details and schedule for this class.</p>
                </div>

                <input type="hidden" id="edit-class-id">

                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="md:col-span-2">
                        <label for="edit-class-name" class="block text-sm font-semibold text-gray-700 mb-1">Class Name</label>
                        <input type="text" id="edit-class-name"
                            class="block w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:bg-white transition-colors"
                            autocomplete="off" required>
                    </div>
                    <div>
                        <label for="edit-class-level" class="block text-sm font-semibold text-gray-700 mb-1">Quest Level</label>
                        <select id="edit-class-level"
                            class="block w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:bg-white transition-colors"
                            required></select>
                    </div>
                    <div class="flex items-center gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Class Logo</label>
                            <button type="button" id="edit-logo-picker-btn"
                                class="bg-gradient-to-br from-cyan-50 to-white border border-cyan-200 rounded-xl px-4 py-3 text-3xl bubbly-button shadow-sm hover:shadow-md transition-shadow"></button>
                            <input type="hidden" id="edit-class-logo">
                        </div>
                    </div>
                    <div class="md:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <label class="block text-sm font-semibold text-gray-700 mb-3"><i class="far fa-calendar-alt text-cyan-500 mr-2"></i>Schedule Days</label>
                        <div id="edit-schedule-days" class="flex flex-wrap gap-2"></div>
                    </div>
                    <div class="md:col-span-2 flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div class="flex-1">
                            <label for="edit-class-time-start" class="block text-sm font-semibold text-gray-700 mb-1"><i class="far fa-clock text-cyan-500 mr-2"></i>From</label>
                            <input type="time" id="edit-class-time-start"
                                class="block w-full px-4 py-3 border border-gray-200 bg-white rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
                        </div>
                        <div class="flex-1">
                            <label for="edit-class-time-end" class="block text-sm font-semibold text-gray-700 mb-1"><i class="far fa-clock text-cyan-500 mr-2"></i>To</label>
                            <input type="time" id="edit-class-time-end"
                                class="block w-full px-4 py-3 border border-gray-200 bg-white rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
                        </div>
                    </div>
                </div>

                <div class="flex flex-col-reverse sm:flex-row gap-4 mt-8 pt-6 border-t border-gray-100">
                    <button type="button" id="edit-class-cancel-btn"
                        class="w-full sm:w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-title text-lg py-3 rounded-xl bubbly-button transition-colors">
                        Cancel
                    </button>
                    <button type="submit"
                        class="w-full sm:w-1/2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-title text-xl py-3 rounded-xl bubbly-button shadow-lg shadow-cyan-500/30">
                        <i class="fas fa-save mr-2"></i> Save Changes
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
                <div id="history-month-select-wrapper" class="history-month-rail">
                    <button type="button" class="history-month-nudge" data-dir="-1" aria-label="Earlier month"><i class="fas fa-chevron-left"></i></button>
                    <div id="history-month-picker-options" class="history-month-track" role="tablist" aria-label="Choose a month"></div>
                    <button type="button" class="history-month-nudge" data-dir="1" aria-label="Later month"><i class="fas fa-chevron-right"></i></button>
                    <select id="history-month-select" class="hidden" aria-hidden="true" tabindex="-1">
                        <option value="">--Choose a month--</option>
                    </select>
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
