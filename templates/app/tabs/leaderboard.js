// templates/app/tabs/leaderboard.js

export const leaderboardTabHTML = `
            <div id="class-leaderboard-tab" class="app-tab hidden">
                <div class="max-w-7xl mx-auto">
                    <div class="text-center mb-4">
                        <i class="fas fa-route text-amber-600 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-amber-700 mt-2 bottom-nav-tab-title"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Team Quest</h2>
                        <p class="text-lg text-gray-600 mt-2">Race against other classes in your league toward the
                            finish line!</p>
                    </div>

                    <!-- Quest Month Banner -->
                    <div id="current-month-quest-title" class="quest-month-banner mb-4">
                        <!-- Floating watermark icons -->
                        <div class="quest-banner-watermarks" aria-hidden="true">
                            <i class="fas fa-star qbw-icon" style="left:6%;top:20%;font-size:2rem;--qbw-duration:8.8s;--qbw-delay:-1.8s;--qbw-drift-x:7px;--qbw-drift-y:11px;--qbw-tilt:3deg;"></i>
                            <i class="fas fa-shield-alt qbw-icon" style="left:18%;top:58%;font-size:2.6rem;--qbw-duration:10.2s;--qbw-delay:-3.7s;--qbw-drift-x:8px;--qbw-drift-y:12px;--qbw-tilt:4deg;--qbw-pulse-duration:6.6s;"></i>
                            <i class="fas fa-route qbw-icon" style="left:39%;top:24%;font-size:2rem;--qbw-duration:11.4s;--qbw-delay:-2.4s;--qbw-drift-x:9px;--qbw-drift-y:10px;--qbw-tilt:2deg;"></i>
                            <i class="fas fa-flag-checkered qbw-icon" style="right:16%;top:53%;font-size:2.35rem;--qbw-duration:9.6s;--qbw-delay:-4.1s;--qbw-drift-x:7px;--qbw-drift-y:9px;--qbw-tilt:3.5deg;"></i>
                            <i class="fas fa-star qbw-icon" style="right:6%;top:15%;font-size:1.7rem;--qbw-duration:10.8s;--qbw-delay:-5.3s;--qbw-drift-x:6px;--qbw-drift-y:8px;--qbw-tilt:2.5deg;--qbw-pulse-duration:7.4s;"></i>
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
                <!-- FAB — LEFT CORNER -->
                <div class="hc-fab-cluster hc-fab-cluster--left">
                    <button id="open-prodigy-btn"
                        class="hc-fab bubbly-button"
                        style="background: linear-gradient(135deg, #7c3aed 0%, #9333ea 55%, #c026d3 100%); border: 2px solid rgba(196, 181, 253, 0.75); color: white;">
                        <i class="fas fa-crown hc-fab-icon"></i>
                        <span class="hc-fab-label">Hall of Prodigies</span>
                    </button>
                </div>
                <!-- FAB — RIGHT CORNER -->
                <div class="hc-fab-cluster hc-fab-cluster--right">
                    <button id="open-trophy-room-btn"
                        class="hc-fab hc-fab--right bubbly-button"
                        style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 55%, #ea580c 100%); border: 2px solid rgba(253, 186, 116, 0.75); color: white;">
                        <i class="fas fa-trophy hc-fab-icon"></i>
                        <span class="hc-fab-label">Trophy Room</span>
                    </button>
                </div>

                <div class="max-w-4xl mx-auto">
                    <div class="text-center mb-4">
                        <i class="fas fa-user-shield text-purple-600 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-purple-700 mt-2 bottom-nav-tab-title"
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
