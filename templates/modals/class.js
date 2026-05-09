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
        class="fixed inset-0 bg-black bg-opacity-50 z-[71] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-3xl w-full pop-in border-4 border-blue-300">
            <div class="flex justify-between items-center mb-4">
                <h2 id="logbook-modal-title" class="font-title text-2xl md:text-3xl text-blue-700">Daily Quest Log</h2>
                <button id="logbook-modal-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div id="logbook-modal-content" class="space-y-4 max-h-[70vh] overflow-y-auto pr-2"></div>
        </div>
    </div>

    <div id="history-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-4xl w-full pop-in border-4 border-amber-300">
            <div class="flex justify-between items-center mb-4">
                <h2 class="font-title text-2xl md:text-3xl text-amber-700">Historical Leaderboard</h2>
                <button id="history-modal-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div class="mb-4">
                <label for="history-month-select" class="block text-sm font-medium text-gray-700 mb-1">Select a past
                    month:</label>
                <select id="history-month-select"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                    <option value="">--Choose a month--</option>
                </select>
            </div>
            <div id="history-modal-content"
                class="space-y-4 max-h-[60vh] overflow-y-auto pr-2 bg-gray-50 p-4 rounded-lg">
                <p class="text-center text-gray-500">Select a month to view historical rankings.</p>
            </div>
        </div>
    </div>
`;
