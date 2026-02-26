// templates/app/tabs/leaderboard.js

export const leaderboardTabHTML = `
            <div id="class-leaderboard-tab" class="app-tab hidden">
                <div class="max-w-7xl mx-auto">
                    <div class="text-center mb-6">
                        <i class="fas fa-route text-amber-600 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-amber-700 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Team Quest</h2>
                        <p class="text-lg text-gray-600 mt-2">Race against other classes in your league toward the
                            finish line!</p>
                    </div>

                    <div
                        class="bg-white/70 backdrop-blur-sm p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center mb-6 gap-4">
                        <div class="flex items-center gap-4">
                            <span class="font-title text-2xl text-amber-700">Quest League:</span>
                            <button id="leaderboard-league-picker-btn"
                                class="font-title text-2xl bg-white text-amber-800 py-2 px-6 rounded-full shadow-lg border-4 border-amber-300 bubbly-button">
                                Select a League
                            </button>
                            <button id="class-history-btn"
                                class="font-title text-xl bg-white text-amber-800 py-2 px-6 rounded-full shadow-lg border-4 border-amber-300 bubbly-button">
                                <i class="fas fa-history mr-2"></i>View History
                            </button>
                        </div>
                        <div class="flex items-center justify-center">
                            <div id="current-month-quest-title" class="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-title text-xl py-3 px-8 rounded-full shadow-lg">
                                <i class="fas fa-calendar-alt mr-2"></i> <span id="quest-month-name">February</span> Quest
                            </div>
                        </div>
                    </div>
                    <div class="px-4 md:px-12">
                        <div id="class-leaderboard-list" class="space-y-4"></div>
                    </div>
                </div>
            </div>

            <div id="student-leaderboard-tab" class="app-tab hidden">
                <div class="max-w-4xl mx-auto">
                    <div class="text-center mb-6">
                        <i class="fas fa-user-shield text-purple-600 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-purple-700 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Hero's Challenge</h2>
                        <p class="text-lg text-gray-600 mt-2">Rise through the ranks and become a legend!</p>
                    </div>
                    <div
                        class="bg-white/70 backdrop-blur-sm p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center mb-6 gap-4">
                        <div class="flex flex-wrap items-center justify-center gap-3 w-full max-w-full">
                            <span class="font-title text-2xl text-purple-700 shrink-0">Quest League:</span>
                            <button id="student-leaderboard-league-picker-btn"
                                class="font-title text-lg bg-white text-purple-800 py-2 px-5 rounded-full shadow-lg border-2 border-purple-300 bubbly-button inline-flex items-center justify-center shrink-0">
                                Select a League
                            </button>
                            <button id="student-history-btn"
                                class="hero-challenge-btn font-title text-lg bg-white text-purple-800 py-2 px-5 rounded-full shadow-lg border-2 border-purple-300 bubbly-button inline-flex items-center shrink-0">
                                <i class="fas fa-history mr-2 flex-shrink-0"></i><span>View History</span>
                            </button>
                        </div>
                        <div class="flex flex-wrap items-center justify-center gap-3 w-full max-w-full">
                            <button id="open-prodigy-btn"
                                class="hero-challenge-btn font-title text-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-white py-2 px-5 rounded-full shadow-lg border-2 border-yellow-600 bubbly-button transform hover:scale-105 inline-flex items-center shrink-0">
                                <i class="fas fa-crown mr-2 flex-shrink-0"></i><span>Hall of Prodigies</span>
                            </button>
                            <button id="open-shop-btn"
                                class="hero-challenge-btn font-title text-lg bg-gradient-to-r from-pink-500 to-rose-500 text-white py-2 px-5 rounded-full shadow-lg border-2 border-rose-600 bubbly-button transform hover:scale-105 inline-flex items-center shrink-0">
                                <i class="fas fa-store mr-2 flex-shrink-0"></i><span>Shop</span>
                            </button>
                            <button id="open-trophy-room-btn"
                                class="hero-challenge-btn font-title text-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-2 px-5 rounded-full shadow-lg border-2 border-teal-700 bubbly-button transform hover:scale-105 inline-flex items-center shrink-0">
                                <i class="fas fa-trophy mr-2 flex-shrink-0"></i><span>Trophy Room</span>
                            </button>
                        </div>
                        <div id="student-view-switcher"
                            class="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                            <div class="flex gap-2">
                                <button id="view-by-class"
                                    class="bg-purple-500 text-white font-bold py-2 px-4 rounded-full bubbly-button">
                                    By Class
                                </button>
                                <button id="view-by-league"
                                    class="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-full bubbly-button">
                                    Global Rank
                                </button>
                            </div>
                            <div class="flex gap-2">
                                <button id="metric-monthly"
                                    class="bg-purple-500 text-white font-bold py-2 px-4 rounded-full bubbly-button">
                                    Monthly Stars
                                </button>
                                <button id="metric-total"
                                    class="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-full bubbly-button">
                                    Total Stars
                                </button>
                            </div>
                        </div>
                    </div>
                    <div id="student-leaderboard-list" class="space-y-4"></div>
                </div>
            </div>
`;
