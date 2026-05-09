// templates/app/tabs/leaderboard.js

export const leaderboardTabHTML = `
            <div id="class-leaderboard-tab" class="app-tab hidden">
                <div class="max-w-7xl mx-auto">
                    <div class="text-center mb-4">
                        <i class="fas fa-route text-amber-600 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-amber-700 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Team Quest</h2>
                        <p class="text-lg text-gray-600 mt-2">Race against other classes in your league toward the
                            finish line!</p>
                    </div>

                    <!-- Quest Month Banner -->
                    <div id="current-month-quest-title" class="quest-month-banner mb-4">
                        <!-- Floating watermark icons -->
                        <div class="quest-banner-watermarks" aria-hidden="true">
                            <i class="fas fa-star qbw-icon" style="left:6%;top:18%;font-size:2rem;animation-duration:5s;animation-delay:0s;"></i>
                            <i class="fas fa-shield-alt qbw-icon" style="left:19%;top:55%;font-size:2.8rem;animation-duration:4.5s;animation-delay:0.8s;"></i>
                            <i class="fas fa-route qbw-icon" style="left:38%;top:20%;font-size:2rem;animation-duration:6s;animation-delay:1.6s;"></i>
                            <i class="fas fa-flag-checkered qbw-icon" style="right:16%;top:50%;font-size:2.4rem;animation-duration:4.8s;animation-delay:0.4s;"></i>
                            <i class="fas fa-star qbw-icon" style="right:5%;top:12%;font-size:1.6rem;animation-duration:5.5s;animation-delay:1.2s;"></i>
                        </div>
                        <!-- Flanking emblems -->
                        <div class="quest-banner-side">
                            <i class="fas fa-star" style="font-size:1.3rem;"></i>
                            <i class="fas fa-route" style="font-size:1rem;"></i>
                        </div>
                        <div class="quest-banner-center">
                            <span id="quest-month-name">February</span>
                        </div>
                        <div class="quest-banner-side">
                            <i class="fas fa-flag-checkered" style="font-size:1rem;"></i>
                            <i class="fas fa-star" style="font-size:1.3rem;"></i>
                        </div>
                    </div>

                    <!-- Compact League Controls -->
                    <div class="bg-white/70 backdrop-blur-sm px-5 py-3 rounded-2xl shadow-lg flex items-center justify-center gap-3 mb-6 flex-wrap">
                        <span class="text-amber-600 text-sm font-bold uppercase tracking-wide flex items-center gap-1.5">
                            <i class="fas fa-shield-alt"></i> Quest League
                        </span>
                        <button id="leaderboard-league-picker-btn"
                            class="font-title text-base bg-white text-amber-800 py-1.5 px-4 rounded-full shadow border-2 border-amber-300 bubbly-button inline-flex items-center gap-1.5">
                            <i class="fas fa-layer-group text-amber-500 text-sm"></i>
                            <span>Select a League</span>
                        </button>
                        <button id="class-history-btn"
                            class="font-title text-sm bg-white text-amber-700 py-1.5 px-4 rounded-full shadow border-2 border-amber-200 bubbly-button inline-flex items-center gap-1.5">
                            <i class="fas fa-history text-amber-400 text-xs"></i>
                            <span>History</span>
                        </button>
                    </div>

                    <div class="px-4 md:px-12">
                        <div id="class-leaderboard-list" class="space-y-4"></div>
                    </div>
                </div>
            </div>

            <div id="student-leaderboard-tab" class="app-tab hidden" style="position: relative;">
                <!-- Floating Action Buttons — LEFT SIDE -->
                <div class="hc-fab-cluster">
                    <button id="open-prodigy-btn"
                        class="hc-fab bubbly-button"
                        style="background: linear-gradient(135deg, #f59e0b, #fbbf24); border: 2px solid #d97706; color: white;">
                        <i class="fas fa-crown hc-fab-icon"></i>
                        <span class="hc-fab-label">Hall of Prodigies</span>
                    </button>
                    <button id="open-trophy-room-btn"
                        class="hc-fab bubbly-button"
                        style="background: linear-gradient(135deg, #10b981, #0d9488); border: 2px solid #059669; color: white;">
                        <i class="fas fa-trophy hc-fab-icon"></i>
                        <span class="hc-fab-label">Trophy Room</span>
                    </button>
                </div>

                <div class="max-w-4xl mx-auto">
                    <div class="text-center mb-4">
                        <i class="fas fa-user-shield text-purple-600 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-purple-700 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Hero's Challenge</h2>
                        <p class="text-lg text-gray-600 mt-2">Rise through the ranks and become a legend!</p>
                    </div>

                    <!-- Compact Controls Card -->
                    <div class="bg-white/70 backdrop-blur-sm px-5 py-3 rounded-2xl shadow-lg flex flex-col items-center justify-center mb-6 gap-3">
                        <!-- League Row -->
                        <div class="flex flex-wrap items-center justify-center gap-3 w-full">
                            <span class="text-purple-600 text-sm font-bold uppercase tracking-wide flex items-center gap-1.5">
                                <i class="fas fa-shield-alt"></i> Quest League
                            </span>
                            <button id="student-leaderboard-league-picker-btn"
                                class="font-title text-base bg-white text-purple-800 py-1.5 px-4 rounded-full shadow border-2 border-purple-300 bubbly-button inline-flex items-center gap-1.5 shrink-0">
                                <i class="fas fa-layer-group text-purple-400 text-sm"></i>
                                <span>Select a League</span>
                            </button>
                            <button id="student-history-btn"
                                class="hero-challenge-btn font-title text-sm bg-white text-purple-700 py-1.5 px-4 rounded-full shadow border-2 border-purple-200 bubbly-button inline-flex items-center gap-1.5 shrink-0">
                                <i class="fas fa-history text-purple-400 text-xs"></i>
                                <span>History</span>
                            </button>
                            <!-- Expand toggle -->
                            <button id="hc-expand-toggle"
                                class="hc-expand-toggle-btn bubbly-button shrink-0"
                                aria-expanded="false" title="View options">
                                <i class="fas fa-chevron-down hc-chevron"></i>
                            </button>
                        </div>

                        <!-- View Switcher (collapsed by default via CSS) -->
                        <div id="student-view-switcher"
                            class="hc-view-switcher-wrapper flex-wrap items-center justify-center gap-2">
                            <div class="flex gap-1.5">
                                <button id="view-by-class"
                                    class="bg-purple-500 text-white font-bold py-1.5 px-3 rounded-full bubbly-button text-sm inline-flex items-center gap-1.5">
                                    <i class="fas fa-users text-xs"></i> By Class
                                </button>
                                <button id="view-by-league"
                                    class="bg-gray-300 text-gray-800 font-bold py-1.5 px-3 rounded-full bubbly-button text-sm inline-flex items-center gap-1.5">
                                    <i class="fas fa-globe text-xs"></i> Global Rank
                                </button>
                            </div>
                            <div class="flex gap-1.5">
                                <button id="metric-monthly"
                                    class="bg-purple-500 text-white font-bold py-1.5 px-3 rounded-full bubbly-button text-sm inline-flex items-center gap-1.5">
                                    <i class="fas fa-star text-xs"></i> Monthly Stars
                                </button>
                                <button id="metric-total"
                                    class="bg-gray-300 text-gray-800 font-bold py-1.5 px-3 rounded-full bubbly-button text-sm inline-flex items-center gap-1.5">
                                    <i class="fas fa-infinity text-xs"></i> Total Stars
                                </button>
                            </div>
                        </div>
                    </div>

                    <div id="student-leaderboard-list" class="space-y-4"></div>
                </div>
            </div>
`;
