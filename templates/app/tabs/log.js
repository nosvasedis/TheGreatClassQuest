// templates/app/tabs/log.js

export const logTabHTML = `
            <div id="adventure-log-tab" class="app-tab hidden">
                <div class="max-w-4xl mx-auto">
                    <div class="text-center mb-6">
                        <i class="fas fa-book-open text-teal-500 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-teal-700 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Adventure Log</h2>
                        <p class="text-lg text-gray-600 mt-2">A visual diary of your class's epic journey!</p>
                    </div>

                    <div class="bg-white p-4 rounded-2xl shadow-lg border-2 border-gray-100 flex flex-col gap-4 mb-6">
                        <div class="flex flex-col sm:flex-row items-center justify-start gap-4 w-full">
                            <select id="adventure-log-class-select"
                                class="w-full sm:w-auto flex-grow px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-lg">
                                <option value="">Select a class to view its log...</option>
                            </select>
                            <select id="adventure-log-month-filter"
                                class="w-full sm:w-auto px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white text-lg"></select>
                        </div>
                        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
                            <button id="log-adventure-btn"
                                class="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-title text-xl py-3 px-6 rounded-lg bubbly-button disabled:opacity-50"
                                disabled>
                                <i class="fas fa-feather-alt mr-2"></i> Log Today's Adventure
                            </button>
                            <button id="quest-assignment-btn"
                                class="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 text-white font-title text-xl py-3 px-6 rounded-lg bubbly-button disabled:opacity-50"
                                disabled>
                                <i class="fas fa-scroll mr-2"></i> Quest Assignment
                            </button>
                            <button id="attendance-chronicle-btn"
                                class="w-full sm:w-auto bg-gray-500 hover:bg-gray-600 text-white font-title text-xl py-3 px-6 rounded-lg bubbly-button disabled:opacity-50"
                                disabled>
                                <i class="fas fa-user-check mr-2"></i> Attendance
                            </button>
                            <button id="hall-of-heroes-btn"
                                class="w-full sm:w-auto bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-title text-xl py-3 px-6 rounded-lg bubbly-button shadow-lg transition-all disabled:opacity-50 disabled:grayscale"
                                disabled>
                                <i class="fas fa-crown mr-2"></i> Hall of Heroes
                            </button>
                        </div>
                    </div>

                    <div id="adventure-log-feed" class="space-y-6 max-h-[60vh] overflow-y-auto p-2"></div>
                </div>
            </div>
`;
