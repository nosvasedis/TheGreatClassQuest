// templates/app/tabs/leaderboard.js

export const leaderboardTabHTML = `
            <div id="class-leaderboard-tab" class="app-tab hidden">
                <div class="max-w-7xl mx-auto">
                    <!-- Tab title: Team Quest (a folded quest map) -->
                    <header class="tab-sign tab-sign--quest">
                        <div class="tab-sign__piece">
                            <span class="tab-sign__wax tab-sign__wax--l" aria-hidden="true"></span>
                            <span class="tab-sign__wax tab-sign__wax--r" aria-hidden="true"></span>
                            <div class="tab-sign__board">
                                <svg class="tab-sign__route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M4 86 C 18 96, 22 60, 36 72 S 58 98, 66 70 S 84 40, 94 22"/></svg>
                                <span class="tab-sign__compass" aria-hidden="true"><i class="fas fa-compass"></i></span>
                                <span class="tab-sign__start" aria-hidden="true"></span>
                                <span class="tab-sign__flag" aria-hidden="true"><i class="fas fa-flag-checkered"></i></span>
                                <span class="tab-sign__kicker">Leagues · Races · Glory</span>
                                <h2 class="font-title tab-sign__title">Team Quest</h2>
                            </div>
                        </div>
                        <p class="tab-sign__tagline">Race against other classes in your league toward the finish line!</p>
                    </header>

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
                            <span class="quest-banner-kicker" aria-hidden="true">This month's race</span>
                            <span class="quest-banner-month"><span id="quest-month-name">February</span></span>
                        </div>
                        <div class="quest-banner-side">
                            <i class="fas fa-flag-checkered" style="font-size:1rem;"></i>
                            <i class="fas fa-star" style="font-size:1.3rem;"></i>
                        </div>
                    </div>

                    <!-- Quest League bar -->
                    <div class="league-bar league-bar--quest" role="group" aria-label="Quest League">
                        <div class="league-bar__league">
                            <span class="league-bar__emblem" aria-hidden="true"><i class="fas fa-shield-halved"></i></span>
                            <div class="league-bar__league-copy">
                                <span class="league-bar__kicker">Quest League</span>
                                <button type="button" id="leaderboard-league-picker-btn" class="league-bar__pick bubbly-button" title="Choose a Quest League">
                                    <span class="league-bar__pick-name">Select a League</span>
                                    <i class="fas fa-chevron-down league-bar__pick-caret" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                        <button type="button" id="leaderboard-league-match-btn" title="Show the league for your selected class" class="hidden league-bar__match bubbly-button">
                            <i class="fas fa-magic" aria-hidden="true"></i><span>Active class</span>
                        </button>
                        <button type="button" id="class-history-btn" class="league-bar__history bubbly-button" title="Past months">
                            <i class="fas fa-history" aria-hidden="true"></i><span>History</span>
                        </button>
                    </div>

                    <div class="px-4 md:px-12">
                        <div id="class-leaderboard-list" class="space-y-4"></div>
                    </div>
                </div>
            </div>

            <div id="student-leaderboard-tab" class="app-tab hidden">
                <div class="max-w-7xl mx-auto">
                    <!-- Tab title: Hero's Challenge -->
                    <header class="tab-sign tab-sign--hero">
                        <div class="tab-sign__piece">
                            <span class="tab-sign__rod" aria-hidden="true"></span>
                            <span class="tab-sign__crest" aria-hidden="true"><i class="fas fa-crown"></i></span>
                            <div class="tab-sign__board">
                                <span class="tab-sign__gem tab-sign__gem--l" aria-hidden="true"></span>
                                <span class="tab-sign__gem tab-sign__gem--r" aria-hidden="true"></span>
                                <span class="tab-sign__kicker">Ranks · Titles · Legends</span>
                                <h2 class="font-title tab-sign__title">Hero's Challenge</h2>
                            </div>
                        </div>
                        <p class="tab-sign__tagline">Rise through the ranks and become a legend!</p>
                    </header>

                    <!-- Hero Month Banner -->
                    <div id="current-month-hero-title" class="hero-month-banner mb-4">
                        <!-- Floating watermark icons -->
                        <div class="quest-banner-watermarks" aria-hidden="true">
                            <i class="fas fa-star qbw-icon" style="left:6%;top:20%;font-size:2rem;--qbw-duration:8.8s;--qbw-delay:-1.8s;--qbw-drift-x:7px;--qbw-drift-y:11px;--qbw-tilt:3deg;"></i>
                            <i class="fas fa-user-shield qbw-icon" style="left:18%;top:58%;font-size:2.6rem;--qbw-duration:10.2s;--qbw-delay:-3.7s;--qbw-drift-x:8px;--qbw-drift-y:12px;--qbw-tilt:4deg;--qbw-pulse-duration:6.6s;"></i>
                            <i class="fas fa-crown qbw-icon" style="left:39%;top:24%;font-size:2rem;--qbw-duration:11.4s;--qbw-delay:-2.4s;--qbw-drift-x:9px;--qbw-drift-y:10px;--qbw-tilt:2deg;"></i>
                            <i class="fas fa-medal qbw-icon" style="right:16%;top:53%;font-size:2.35rem;--qbw-duration:9.6s;--qbw-delay:-4.1s;--qbw-drift-x:7px;--qbw-drift-y:9px;--qbw-tilt:3.5deg;"></i>
                            <i class="fas fa-star qbw-icon" style="right:6%;top:15%;font-size:1.7rem;--qbw-duration:10.8s;--qbw-delay:-5.3s;--qbw-drift-x:6px;--qbw-drift-y:8px;--qbw-tilt:2.5deg;--qbw-pulse-duration:7.4s;"></i>
                        </div>
                        <!-- Flanking emblems -->
                        <div class="quest-banner-side">
                            <i class="fas fa-star" style="font-size:1.3rem;"></i>
                            <i class="fas fa-user-shield" style="font-size:1rem;"></i>
                        </div>
                        <div class="quest-banner-center">
                            <span class="quest-banner-kicker" aria-hidden="true">This month's challenge</span>
                            <span class="quest-banner-month"><span id="hero-month-name">February</span></span>
                        </div>
                        <div class="quest-banner-side">
                            <i class="fas fa-medal" style="font-size:1rem;"></i>
                            <i class="fas fa-star" style="font-size:1.3rem;"></i>
                        </div>
                    </div>

                    <!-- Quest League bar -->
                    <div class="league-bar league-bar--hero" role="group" aria-label="Quest League">
                        <div class="league-bar__league">
                            <span class="league-bar__emblem" aria-hidden="true"><i class="fas fa-shield-halved"></i></span>
                            <div class="league-bar__league-copy">
                                <span class="league-bar__kicker">Quest League</span>
                                <button type="button" id="student-leaderboard-league-picker-btn" class="league-bar__pick bubbly-button" title="Choose a Quest League">
                                    <span class="league-bar__pick-name">Select a League</span>
                                    <i class="fas fa-chevron-down league-bar__pick-caret" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                        <button type="button" id="student-leaderboard-league-match-btn" title="Show the league for your selected class" class="hidden league-bar__match bubbly-button">
                            <i class="fas fa-magic" aria-hidden="true"></i><span>Active class</span>
                        </button>
                        <div id="student-view-switcher" class="league-bar__switches">
                            <div class="league-seg" role="group" aria-label="Who to rank" style="--seg-i:0">
                                <span class="league-seg__thumb" aria-hidden="true"></span>
                                <button type="button" id="view-by-class" class="league-seg__btn is-active" aria-pressed="true"><i class="fas fa-users" aria-hidden="true"></i><span>By Class</span></button>
                                <button type="button" id="view-by-league" class="league-seg__btn" aria-pressed="false"><i class="fas fa-globe" aria-hidden="true"></i><span>Global Rank</span></button>
                            </div>
                            <div class="league-seg" role="group" aria-label="Which stars count" style="--seg-i:0">
                                <span class="league-seg__thumb" aria-hidden="true"></span>
                                <button type="button" id="metric-monthly" class="league-seg__btn is-active" aria-pressed="true"><i class="fas fa-star" aria-hidden="true"></i><span>Monthly Stars</span></button>
                                <button type="button" id="metric-total" class="league-seg__btn" aria-pressed="false"><i class="fas fa-infinity" aria-hidden="true"></i><span>Total Stars</span></button>
                            </div>
                        </div>
                        <button type="button" id="student-history-btn" class="league-bar__history bubbly-button" title="Past months">
                            <i class="fas fa-history" aria-hidden="true"></i><span>History</span>
                        </button>
                    </div>

                    <!-- The class's halls: past champions and every hero's satchel -->
                    <nav class="hc-halls" aria-label="Class halls">
                        <button type="button" id="open-prodigy-btn" class="hc-hall hc-hall--prodigy" disabled>
                            <span class="hc-hall__medal" aria-hidden="true"><i class="fas fa-crown"></i></span>
                            <span class="hc-hall__text">
                                <span class="hc-hall__title">Hall of Prodigies</span>
                                <span class="hc-hall__sub">A crown for every month</span>
                            </span>
                            <i class="fas fa-chevron-right hc-hall__go" aria-hidden="true"></i>
                        </button>
                        <button type="button" id="open-trophy-room-btn" class="hc-hall hc-hall--trophy" disabled>
                            <span class="hc-hall__medal" aria-hidden="true"><i class="fas fa-trophy"></i></span>
                            <span class="hc-hall__text">
                                <span class="hc-hall__title">Trophy Room</span>
                                <span class="hc-hall__sub">Every hero's relics and treasures</span>
                            </span>
                            <i class="fas fa-chevron-right hc-hall__go" aria-hidden="true"></i>
                        </button>
                    </nav>
                </div>

                <div class="hcs-board">
                    <div id="student-leaderboard-list" class="hcs-list"></div>
                </div>
            </div>
`;
