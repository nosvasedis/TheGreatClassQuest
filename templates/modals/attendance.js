// templates/modals/attendance.js
// Trial type, bulk trial, attendance chronicle, trial history, hidden print templates

export const attendanceModalsHTML = `
    <div id="trial-type-modal"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[72] flex items-center justify-center p-4 hidden">
        <div class="relative bg-gradient-to-br from-white via-amber-50 to-orange-50 rounded-[2rem] shadow-2xl max-w-2xl w-full pop-in border border-amber-200/80 overflow-hidden text-center"
            style="box-shadow: 0 0 0 2px rgba(251,191,36,0.35), 0 28px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.8);">

            <div class="absolute inset-0 pointer-events-none opacity-40"
                style="background: radial-gradient(circle at 22% 12%, rgba(251,191,36,0.35), transparent 45%), radial-gradient(circle at 90% 80%, rgba(249,115,22,0.18), transparent 55%);"></div>

            <div class="relative z-10 p-8">
                <div class="flex items-center justify-center gap-3 mb-2">
                    <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-400 text-white flex items-center justify-center shadow-lg"
                        style="box-shadow: 0 10px 30px rgba(251,146,60,0.35);">
                        <i class="fas fa-map-signs text-xl"></i>
                    </div>
                </div>
                <h2 class="font-title text-4xl text-amber-900 leading-tight">Choose Your Challenge</h2>
                <p class="text-amber-900/60 font-semibold mt-2 mb-7">What kind of trial are we logging today?</p>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <button id="select-dictation-btn" type="button"
                        class="group relative overflow-hidden rounded-3xl border border-amber-200/80 bg-white/70 p-6 text-left shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400 bubbly-button">
                        <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            style="background: radial-gradient(circle at 30% 20%, rgba(59,130,246,0.18), transparent 55%);"></div>
                        <div class="relative flex items-center gap-4">
                            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-lg flex-shrink-0"
                                style="box-shadow: 0 12px 30px rgba(37,99,235,0.28);">
                                <i class="fas fa-microphone-alt text-2xl"></i>
                            </div>
                            <div class="min-w-0">
                                <div class="text-[11px] font-black uppercase tracking-[0.22em] text-blue-700/70">Option</div>
                                <div class="font-title text-3xl text-blue-900 leading-tight">Dictation</div>
                                <div class="text-sm text-blue-900/60 font-semibold mt-1">Quick entries • qualitative or numeric</div>
                            </div>
                            <div class="ml-auto text-blue-700/40 group-hover:text-blue-700/70 transition-colors">
                                <i class="fas fa-arrow-right"></i>
                            </div>
                        </div>
                    </button>

                    <button id="select-test-btn" type="button"
                        class="group relative overflow-hidden rounded-3xl border border-amber-200/80 bg-white/70 p-6 text-left shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400 bubbly-button">
                        <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            style="background: radial-gradient(circle at 30% 20%, rgba(16,185,129,0.18), transparent 55%);"></div>
                        <div class="relative flex items-center gap-4">
                            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg flex-shrink-0"
                                style="box-shadow: 0 12px 30px rgba(16,185,129,0.26);">
                                <i class="fas fa-file-alt text-2xl"></i>
                            </div>
                            <div class="min-w-0">
                                <div class="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700/70">Option</div>
                                <div class="font-title text-3xl text-emerald-900 leading-tight">Test</div>
                                <div class="text-sm text-emerald-900/60 font-semibold mt-1">Optional title • bulk entry</div>
                            </div>
                            <div class="ml-auto text-emerald-700/40 group-hover:text-emerald-700/70 transition-colors">
                                <i class="fas fa-arrow-right"></i>
                            </div>
                        </div>
                    </button>
                </div>

                <button id="trial-type-cancel-btn" type="button"
                    class="mt-7 px-4 py-2 rounded-xl font-bold text-amber-900/70 hover:text-red-700 bg-white/60 hover:bg-red-50 border border-amber-200/70 hover:border-red-200 transition-all bubbly-button">
                    Cancel
                </button>
            </div>
        </div>
    </div>

    <div id="bulk-trial-modal"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[73] flex items-center justify-center p-4 hidden">
        <div id="bulk-trial-shell" class="relative bg-gradient-to-br from-white via-amber-50 to-orange-50 rounded-[2rem] shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col pop-in border border-amber-200/80 overflow-hidden"
            style="box-shadow: 0 0 0 2px rgba(251,191,36,0.35), 0 28px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.8);">

            <div class="absolute inset-0 pointer-events-none opacity-40"
                style="background: radial-gradient(circle at 20% 10%, rgba(251,191,36,0.35), transparent 45%), radial-gradient(circle at 90% 70%, rgba(249,115,22,0.18), transparent 55%);"></div>

            <div class="relative z-30 px-6 pt-6 pb-5 border-b border-amber-200/70 bg-white/55 backdrop-blur-md flex flex-col gap-4 flex-shrink-0">
                <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div class="flex items-start gap-3 min-w-0">
                        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-400 text-white flex items-center justify-center shadow-lg flex-shrink-0"
                            style="box-shadow: 0 10px 30px rgba(251,146,60,0.35);">
                            <i class="fas fa-feather-alt text-xl"></i>
                        </div>
                        <div class="min-w-0">
                            <h2 id="bulk-trial-title" class="font-title text-3xl text-amber-900 leading-tight">Log Results</h2>
                            <p id="bulk-trial-subtitle" class="text-amber-700 font-semibold truncate"></p>
                            <div class="relative mt-2">
                                <button id="bulk-trial-date-chip" type="button"
                                    class="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 border border-amber-200/70 text-amber-900 shadow-sm hover:bg-amber-50 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group"
                                    aria-haspopup="true" aria-expanded="false">
                                    <i class="fas fa-calendar-alt text-amber-500 group-hover:text-amber-600 transition-colors"></i>
                                    <span id="bulk-trial-date-display" class="text-xs font-black tracking-widest">--/--/----</span>
                                    <i class="fas fa-chevron-down text-amber-400 text-[10px] transition-transform duration-200 dp-chevron"></i>
                                </button>
                                <input type="date" id="bulk-trial-date" class="sr-only" tabindex="-1" aria-hidden="true">
                                <div id="bulk-trial-date-picker"
                                    class="hidden absolute left-0 top-full mt-2 z-[120] select-none bulk-date-picker-popover"
                                    style="filter: drop-shadow(0 20px 48px rgba(0,0,0,0.28)) drop-shadow(0 0 0 1px rgba(251,191,36,0.2));">
                                    <div class="bulk-date-picker-panel bg-gradient-to-br from-white via-amber-50 to-orange-50 rounded-2xl border border-amber-200 overflow-hidden"
                                        style="box-shadow: 0 0 0 1px rgba(251,191,36,0.18), inset 0 1px 0 rgba(255,255,255,0.95);">
                                        <div class="px-4 pt-3 pb-2 border-b border-amber-100/80 flex items-center gap-2">
                                            <i class="fas fa-calendar-alt text-amber-500 text-xs"></i>
                                            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700/70">Choose Date</p>
                                        </div>
                                        <div class="flex items-stretch px-1 py-3">
                                            <div class="flex flex-col items-center gap-0.5 px-3 border-r border-amber-100/80">
                                                <button type="button" id="dp-day-up" class="w-8 h-7 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors active:scale-90"><i class="fas fa-chevron-up text-[10px]"></i></button>
                                                <div id="dp-day" class="font-title text-3xl text-amber-900 w-11 text-center leading-none my-1.5 tabular-nums">01</div>
                                                <button type="button" id="dp-day-down" class="w-8 h-7 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors active:scale-90"><i class="fas fa-chevron-down text-[10px]"></i></button>
                                                <span class="text-[9px] font-black uppercase tracking-widest text-amber-600/55 mt-1.5">Day</span>
                                            </div>
                                            <div class="flex flex-col items-center gap-0.5 px-3 border-r border-amber-100/80">
                                                <button type="button" id="dp-month-up" class="w-8 h-7 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors active:scale-90"><i class="fas fa-chevron-up text-[10px]"></i></button>
                                                <div id="dp-month" class="font-title text-xl text-amber-900 w-20 text-center leading-none my-1.5">January</div>
                                                <button type="button" id="dp-month-down" class="w-8 h-7 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors active:scale-90"><i class="fas fa-chevron-down text-[10px]"></i></button>
                                                <span class="text-[9px] font-black uppercase tracking-widest text-amber-600/55 mt-1.5">Month</span>
                                            </div>
                                            <div class="flex flex-col items-center gap-0.5 px-3">
                                                <button type="button" id="dp-year-up" class="w-8 h-7 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors active:scale-90"><i class="fas fa-chevron-up text-[10px]"></i></button>
                                                <div id="dp-year" class="font-title text-2xl text-amber-900 w-16 text-center leading-none my-1.5 tabular-nums">—</div>
                                                <button type="button" id="dp-year-down" class="w-8 h-7 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors active:scale-90"><i class="fas fa-chevron-down text-[10px]"></i></button>
                                                <span class="text-[9px] font-black uppercase tracking-widest text-amber-600/55 mt-1.5">Year</span>
                                            </div>
                                        </div>
                                        <div class="px-3 pb-3 flex gap-2">
                                            <button type="button" id="dp-confirm-btn"
                                                class="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-95 text-white font-title text-base py-2 rounded-xl transition-all shadow-md">
                                                <i class="fas fa-check mr-1.5 text-sm"></i>Set Date
                                            </button>
                                            <button type="button" id="dp-cancel-btn"
                                                class="px-3 py-2 rounded-xl text-amber-900/50 hover:text-amber-900 hover:bg-amber-100 transition-all text-sm font-bold">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-3 items-end justify-end">
                        <div id="bulk-trial-title-wrapper" class="hidden">
                            <label class="block text-[11px] font-black text-amber-900/70 uppercase tracking-widest mb-1">Title</label>
                            <input type="text" id="bulk-trial-name" placeholder="e.g. Unit 5 Quiz"
                                class="px-3.5 py-2.5 border border-amber-200/80 rounded-xl bg-white/80 focus:ring-2 focus:ring-amber-400 outline-none shadow-sm w-52 md:w-72">
                        </div>
                    </div>
                </div>
                <div id="bulk-trial-scheduled-hint" class="hidden rounded-lg border border-violet-200/70 bg-violet-50/70 px-3 py-1.5 text-[11px] flex items-center gap-2">
                    <i class="fas fa-calendar-check text-violet-400 shrink-0"></i>
                    <span id="bulk-trial-scheduled-hint-body" class="text-violet-900/80 font-semibold truncate"></span>
                </div>
                <p id="bulk-trial-tip-default" class="text-xs text-amber-900/60 font-semibold">
                    Tip: Mark a student absent to skip grading them.
                </p>
            </div>

            <div class="relative z-10 flex-grow overflow-y-auto p-6 bg-gradient-to-b from-white/30 to-orange-50/50">
                <div id="bulk-student-list" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
            </div>

            <div class="relative z-10 p-4 md:p-5 border-t border-amber-200/70 bg-white/60 backdrop-blur-md flex justify-between items-center gap-3 flex-shrink-0">
                <span class="text-xs text-amber-900/40 font-semibold" data-school-name>Your School</span>
                <div class="flex items-center gap-2">
                    <button id="bulk-trial-close-btn"
                        class="px-4 py-2 rounded-xl font-bold text-amber-900/70 hover:text-red-700 bg-white/60 hover:bg-red-50 border border-amber-200/70 hover:border-red-200 transition-all bubbly-button">
                        Cancel
                    </button>
                    <button id="bulk-trial-save-btn"
                        class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-title text-xl py-2.5 px-8 rounded-xl shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] bubbly-button"
                        style="box-shadow: 0 10px 30px rgba(251,146,60,0.35);">
                        <i class="fas fa-save mr-2"></i> Save All
                    </button>
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
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[71] flex items-center justify-center p-4 hidden">
        <div
            class="relative bg-gradient-to-br from-indigo-50 via-purple-50 to-fuchsia-50 p-6 md:p-8 rounded-[2.5rem] shadow-2xl max-w-5xl w-full pop-in border border-purple-200 flex flex-col h-[85vh] overflow-hidden"
            style="box-shadow: 0 0 0 2px rgba(168,85,247,0.35), 0 28px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.8);">
            
            <div class="absolute inset-0 pointer-events-none opacity-40"
                style="background: radial-gradient(circle at 20% 10%, rgba(168,85,247,0.15), transparent 45%), radial-gradient(circle at 90% 70%, rgba(217,70,239,0.1), transparent 55%);"></div>

            <div class="relative z-10 flex justify-between items-start mb-6 border-b border-purple-200/60 pb-4 shrink-0">
                <div class="flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white flex items-center justify-center shadow-lg shrink-0"
                        style="box-shadow: 0 10px 30px rgba(168,85,247,0.4);">
                        <i class="fas fa-scroll text-2xl"></i>
                    </div>
                    <div>
                        <h2 id="trial-history-title" class="font-title text-3xl md:text-4xl text-purple-900 leading-tight">Trial History</h2>
                        <p class="text-purple-700/70 font-semibold text-sm">Review past performance</p>
                    </div>
                </div>
                <button id="trial-history-close-btn"
                    class="text-purple-900/50 hover:text-purple-900 text-2xl w-10 h-10 rounded-full flex items-center justify-center bg-white/60 hover:bg-white/80 border border-purple-200/80 shadow-sm transition-all bubbly-button shrink-0">&times;</button>
            </div>
            
            <div id="trial-history-controls-container" class="relative z-10 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center mb-6 bg-white/60 p-2 rounded-2xl border border-purple-100 shadow-sm backdrop-blur-sm shrink-0">
                <div id="trial-history-view-toggle"
                    class="flex items-center gap-1 bg-purple-50/50 p-1.5 rounded-xl border border-purple-100 shadow-inner w-full sm:w-auto">
                </div>
                <div id="trial-history-actions" class="flex items-center gap-2 flex-wrap justify-end w-full sm:w-auto">
                </div>
            </div>
            <div id="trial-history-sort-row" class="relative z-10 flex items-center gap-1.5 mb-4 bg-white/60 px-3 py-2 rounded-xl border border-purple-100 shadow-sm backdrop-blur-sm shrink-0 flex-wrap">
            </div>
            <div id="trial-history-content"
                class="relative z-10 space-y-4 overflow-y-auto p-2 pr-4 flex-grow rounded-xl scrollbar-custom">
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
