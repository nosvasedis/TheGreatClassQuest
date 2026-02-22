// templates/app/tabs/calendar.js

export const calendarTabHTML = `
            <div id="calendar-tab" class="app-tab hidden">
                <div class="max-w-7xl mx-auto">
                    <div class="text-center mb-6">
                        <i class="fas fa-calendar-alt text-blue-600 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-blue-700 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Quest Calendar</h2>
                        <p class="text-lg text-gray-600 mt-2">View your schedule and plan special Quest Events.</p>
                    </div>
                    <div>
                        <div
                            class="flex items-center justify-between mb-4 p-4 bg-white/70 rounded-2xl shadow-lg backdrop-blur-sm">
                            <button id="prev-month-btn"
                                class="bg-blue-500 hover:bg-blue-600 text-white font-bold w-12 h-12 rounded-full bubbly-button">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <h2 id="calendar-month-year" class="font-title text-3xl text-blue-700 text-center"></h2>
                            <button id="next-month-btn"
                                class="bg-blue-500 hover:bg-blue-600 text-white font-bold w-12 h-12 rounded-full bubbly-button">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                        <div id="calendar-grid"
                            class="grid grid-cols-7 gap-1 p-4 bg-white/70 rounded-2xl shadow-lg backdrop-blur-sm">
                            <div id="calendar-loader"
                                class="hidden absolute inset-0 bg-white/50 backdrop-blur-sm flex-col items-center justify-center z-10 rounded-2xl">
                                <i class="fas fa-star text-amber-500 text-5xl animate-spin"></i>
                                <p class="font-title text-xl text-amber-700 mt-4">Fetching Quest Logs...</p>
                            </div>
                            <div class="text-center font-bold text-gray-600">Mon</div>
                            <div class="text-center font-bold text-gray-600">Tue</div>
                            <div class="text-center font-bold text-gray-600">Wed</div>
                            <div class="text-center font-bold text-gray-600">Thu</div>
                            <div class="text-center font-bold text-gray-600">Fri</div>
                            <div class="text-center font-bold text-gray-600">Sat</div>
                            <div class="text-center font-bold text-gray-600">Sun</div>
                        </div>
                    </div>
                </div>
            </div>
`;
