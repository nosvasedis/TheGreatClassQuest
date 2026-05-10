// templates/modals/class.js
// Edit class, logbook, history

export const classModalsHTML = `
    <div id="create-class-modal"
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[71] flex items-center justify-center p-4 hidden overflow-y-auto">
        <form id="add-class-form"
            class="bg-white p-6 md:p-8 rounded-[2rem] shadow-2xl max-w-2xl w-full pop-in border border-emerald-100 my-8 relative overflow-hidden">
            <!-- Decorative Header Gradient -->
            <div class="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-emerald-500/20 via-green-400/10 to-transparent pointer-events-none"></div>
            
            <button type="button" id="create-class-close-btn"
                class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/50 hover:bg-white text-emerald-800 border border-emerald-100 text-2xl leading-none bubbly-button flex items-center justify-center shadow-sm transition-all">&times;</button>

            <div class="relative">
                <div class="text-center mb-8">
                    <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 text-3xl mb-3 shadow-inner floating-icon">
                        <i class="fas fa-magic"></i>
                    </div>
                    <h2 class="font-title text-4xl text-emerald-800 text-center" style="text-shadow: 0 2px 4px rgba(0,0,0,0.05);">Add New Class</h2>
                    <p class="text-gray-500 mt-2">Enter the class details below to begin a new adventure.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="md:col-span-2">
                        <label for="class-name" class="block text-sm font-semibold text-gray-700 mb-1">Class Name (e.g., "The Star Seekers")</label>
                        <div class="flex items-center gap-2 mt-1">
                            <input type="text" id="class-name"
                                class="block w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-colors"
                                autocomplete="off" required>
                            <button type="button" id="generate-class-name-btn"
                                class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl bubbly-button disabled:opacity-50"
                                title="Suggest names with AI">
                                <i class="fas fa-wand-magic-sparkles"></i>
                            </button>
                        </div>
                        <div id="class-name-suggestions" class="mt-2 flex flex-wrap gap-2"></div>
                    </div>
                    <div>
                        <label for="class-level" class="block text-sm font-semibold text-gray-700 mb-1">Quest Level (League)</label>
                        <select id="class-level"
                            class="block w-full px-4 py-3 border border-gray-200 bg-gray-50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-colors"
                            required>
                            <option value="" disabled selected>Select a league...</option>
                            <option>Junior A</option>
                            <option>Junior B</option>
                            <option>A</option>
                            <option>B</option>
                            <option>C</option>
                            <option>D</option>
                        </select>
                    </div>
                    <div class="flex items-center gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">Class Logo</label>
                            <button type="button" id="logo-picker-btn"
                                class="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl px-4 py-3 text-3xl bubbly-button shadow-sm hover:shadow-md transition-shadow">
                                📚
                            </button>
                            <input type="hidden" id="class-logo" value="📚">
                        </div>
                    </div>
                    <div class="md:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <label class="block text-sm font-semibold text-gray-700 mb-3"><i class="far fa-calendar-alt text-emerald-500 mr-2"></i>Schedule Days</label>
                        <div class="mt-2 flex flex-wrap gap-2">
                            <label class="flex items-center space-x-2 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm"><input
                                    type="checkbox" name="schedule-day" value="1"
                                    class="rounded text-emerald-600 focus:ring-emerald-500"> <span>Mon</span></label>
                            <label class="flex items-center space-x-2 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm"><input
                                    type="checkbox" name="schedule-day" value="2"
                                    class="rounded text-emerald-600 focus:ring-emerald-500"> <span>Tue</span></label>
                            <label class="flex items-center space-x-2 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm"><input
                                    type="checkbox" name="schedule-day" value="3"
                                    class="rounded text-emerald-600 focus:ring-emerald-500"> <span>Wed</span></label>
                            <label class="flex items-center space-x-2 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm"><input
                                    type="checkbox" name="schedule-day" value="4"
                                    class="rounded text-emerald-600 focus:ring-emerald-500"> <span>Thu</span></label>
                            <label class="flex items-center space-x-2 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm"><input
                                    type="checkbox" name="schedule-day" value="5"
                                    class="rounded text-emerald-600 focus:ring-emerald-500"> <span>Fri</span></label>
                            <label class="flex items-center space-x-2 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm"><input
                                    type="checkbox" name="schedule-day" value="6"
                                    class="rounded text-emerald-600 focus:ring-emerald-500"> <span>Sat</span></label>
                            <label class="flex items-center space-x-2 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm"><input
                                    type="checkbox" name="schedule-day" value="0"
                                    class="rounded text-emerald-600 focus:ring-emerald-500"> <span>Sun</span></label>
                        </div>
                    </div>
                    <div class="md:col-span-2 flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div class="flex-1">
                            <label for="class-time-start" class="block text-sm font-semibold text-gray-700 mb-1"><i class="far fa-clock text-emerald-500 mr-2"></i>From</label>
                            <input type="time" id="class-time-start"
                                class="block w-full px-4 py-3 border border-gray-200 bg-white rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                        </div>
                        <div class="flex-1">
                            <label for="class-time-end" class="block text-sm font-semibold text-gray-700 mb-1"><i class="far fa-clock text-emerald-500 mr-2"></i>To</label>
                            <input type="time" id="class-time-end"
                                class="block w-full px-4 py-3 border border-gray-200 bg-white rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                        </div>
                    </div>
                </div>

                <div class="flex flex-col-reverse sm:flex-row gap-4 mt-8 pt-6 border-t border-gray-100">
                    <button type="button" id="create-class-cancel-btn"
                        class="w-full sm:w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-title text-lg py-3 rounded-xl bubbly-button transition-colors">
                        Cancel
                    </button>
                    <button type="submit"
                        class="w-full sm:w-1/2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-title text-xl py-3 rounded-xl bubbly-button shadow-lg shadow-emerald-500/30">
                        <i class="fas fa-plus-circle mr-2"></i> Create Class
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
        class="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[71] flex items-center justify-center p-4 hidden">
        <div class="bg-white/95 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] max-w-3xl w-full pop-in border border-white/20 flex flex-col max-h-[90vh] overflow-hidden">
            <!-- Header Section -->
            <div class="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-6 text-white flex-shrink-0">
                <div class="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <div class="relative flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-2xl shadow-inner border border-white/30">
                            <i class="fas fa-book text-white drop-shadow-sm"></i>
                        </div>
                        <div>
                            <h2 id="logbook-modal-title" class="font-title text-3xl drop-shadow-md">Daily Quest Log</h2>
                            <p class="text-blue-100 font-bold uppercase tracking-widest text-[10px] opacity-80">Chronicle of Heroes</p>
                        </div>
                    </div>
                    <button id="logbook-modal-close-btn"
                        class="bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center transition-all hover:rotate-90">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <!-- Content Area -->
            <div id="logbook-modal-content" class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30">
                <!-- Content injected by showLogbookModal -->
            </div>
        </div>
    </div>

    <div id="history-modal"
        class="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[71] flex items-center justify-center p-4 hidden">
        <div class="bg-white/95 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] max-w-5xl w-full pop-in border border-white/20 flex flex-col max-h-[90vh] overflow-hidden">
            <div class="relative bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-6 text-white flex-shrink-0 overflow-hidden">
                <div class="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl pointer-events-none"></div>
                <div class="absolute bottom-0 left-0 w-56 h-56 bg-yellow-300/20 rounded-full -ml-24 -mb-24 blur-2xl pointer-events-none"></div>
                <div class="relative flex items-start justify-between gap-4">
                    <div class="flex items-start gap-4 min-w-0">
                        <div class="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-2xl shadow-inner border border-white/30 flex-shrink-0">
                            <i class="fas fa-history text-white drop-shadow-sm"></i>
                        </div>
                        <div class="min-w-0">
                            <h2 id="history-modal-title" class="font-title text-3xl drop-shadow-md truncate">Historical Leaderboard</h2>
                            <p id="history-modal-subtitle" class="text-amber-100 font-bold uppercase tracking-widest text-[10px] opacity-90">Quest Archives</p>
                        </div>
                    </div>
                    <button id="history-modal-close-btn"
                        class="bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center transition-all hover:rotate-90 flex-shrink-0">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="history-month-select-wrapper" class="relative mt-5">
                    <button type="button" id="history-month-picker-btn"
                        class="relative w-full bg-white/15 hover:bg-white/20 text-white font-bold py-3 pl-11 pr-10 rounded-2xl backdrop-blur-md border border-white/25 shadow-inner focus:outline-none focus:ring-2 focus:ring-white/40 transition-all cursor-pointer text-left">
                        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/80"><i class="fas fa-calendar-alt"></i></div>
                        <span id="history-month-picker-label">Choose a month...</span>
                        <div class="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-white/70"><i class="fas fa-chevron-down"></i></div>
                    </button>

                    <div id="history-month-picker-menu"
                        class="hidden absolute left-0 right-0 mt-2 z-[80] bg-white rounded-[1.5rem] shadow-2xl border border-slate-200 overflow-hidden">
                        <div id="history-month-picker-options" class="max-h-72 overflow-y-auto custom-scrollbar p-2">
                        </div>
                    </div>

                    <select id="history-month-select" class="hidden">
                        <option value="">--Choose a month--</option>
                    </select>
                </div>
            </div>
            <div id="history-modal-content" class="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/30">
                <p class="text-center text-gray-500">Select a month to view historical rankings.</p>
            </div>
        </div>
    </div>
`;
