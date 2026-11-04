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

                    <!-- This month's race: a race banner strung between two poles -->
                    <div id="current-month-quest-title" class="lgc-race">
                        <span class="lgc-race__pole lgc-race__pole--start" aria-hidden="true"><span class="lgc-race__flag"></span></span>
                        <div class="lgc-race__cloth">
                            <span class="lgc-race__bunting" aria-hidden="true"></span>
                            <span class="lgc-race__tag"><i class="fas fa-route" aria-hidden="true"></i>This month's race</span>
                            <span class="lgc-race__month"><span id="quest-month-name">February</span></span>
                            <span class="lgc-race__checker" aria-hidden="true"></span>
                        </div>
                        <span class="lgc-race__pole lgc-race__pole--finish" aria-hidden="true"><span class="lgc-race__flag"></span></span>
                    </div>

                    <!-- Quest League bar -->
                    <div class="league-bar league-bar--quest" role="group" aria-label="Quest League">
                        <button type="button" id="leaderboard-league-picker-btn" class="league-bar__plate bubbly-button" title="Choose a Quest League">
                            <span class="league-bar__emblem" aria-hidden="true"><i class="fas fa-shield-halved"></i></span>
                            <span class="league-bar__league-copy">
                                <span class="league-bar__kicker">Quest League</span>
                                <span class="league-bar__pick"><span class="league-bar__pick-name">Select a League</span><i class="fas fa-chevron-down league-bar__pick-caret" aria-hidden="true"></i></span>
                            </span>
                        </button>
                        <button type="button" id="leaderboard-league-match-btn" title="Show the league for your selected class" class="hidden league-bar__match bubbly-button">
                            <i class="fas fa-rotate-left" aria-hidden="true"></i><span>My class</span>
                        </button>
                        <button type="button" id="class-history-btn" class="league-bar__history bubbly-button" title="Past months">
                            <i class="fas fa-clock-rotate-left" aria-hidden="true"></i><span>Past races</span>
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

                    <!-- This month's challenge: a royal plaque between two laurels -->
                    <div id="current-month-hero-title" class="lgc-crown">
                        <svg class="lgc-crown__laurel" viewBox="0 0 60 100" aria-hidden="true" focusable="false"><path class="lgc-crown__stem" d="M44 94 C 18 78, 10 50, 26 8"/><g class="lgc-crown__leaves"><ellipse cx="38" cy="82" rx="9" ry="4" transform="rotate(-28 38 82)"/><ellipse cx="22" cy="74" rx="9" ry="4" transform="rotate(40 22 74)"/><ellipse cx="29" cy="66" rx="9" ry="4" transform="rotate(-48 29 66)"/><ellipse cx="13" cy="56" rx="9" ry="4" transform="rotate(58 13 56)"/><ellipse cx="22" cy="48" rx="9" ry="4" transform="rotate(-62 22 48)"/><ellipse cx="11" cy="37" rx="8.5" ry="3.8" transform="rotate(72 11 37)"/><ellipse cx="22" cy="30" rx="8.5" ry="3.8" transform="rotate(-72 22 30)"/><ellipse cx="17" cy="18" rx="8" ry="3.6" transform="rotate(84 17 18)"/><ellipse cx="27" cy="9" rx="7" ry="3.4" transform="rotate(-80 27 9)"/></g></svg>
                        <div class="lgc-crown__plaque">
                            <span class="lgc-crown__jewel" aria-hidden="true"><i class="fas fa-crown"></i></span>
                            <span class="lgc-crown__kicker">This month's challenge</span>
                            <span class="lgc-crown__month"><span id="hero-month-name">February</span></span>
                        </div>
                        <svg class="lgc-crown__laurel lgc-crown__laurel--r" viewBox="0 0 60 100" aria-hidden="true" focusable="false"><path class="lgc-crown__stem" d="M44 94 C 18 78, 10 50, 26 8"/><g class="lgc-crown__leaves"><ellipse cx="38" cy="82" rx="9" ry="4" transform="rotate(-28 38 82)"/><ellipse cx="22" cy="74" rx="9" ry="4" transform="rotate(40 22 74)"/><ellipse cx="29" cy="66" rx="9" ry="4" transform="rotate(-48 29 66)"/><ellipse cx="13" cy="56" rx="9" ry="4" transform="rotate(58 13 56)"/><ellipse cx="22" cy="48" rx="9" ry="4" transform="rotate(-62 22 48)"/><ellipse cx="11" cy="37" rx="8.5" ry="3.8" transform="rotate(72 11 37)"/><ellipse cx="22" cy="30" rx="8.5" ry="3.8" transform="rotate(-72 22 30)"/><ellipse cx="17" cy="18" rx="8" ry="3.6" transform="rotate(84 17 18)"/><ellipse cx="27" cy="9" rx="7" ry="3.4" transform="rotate(-80 27 9)"/></g></svg>
                    </div>

                    <!-- Quest League bar -->
                    <div class="league-bar league-bar--hero" role="group" aria-label="Quest League">
                        <button type="button" id="student-leaderboard-league-picker-btn" class="league-bar__plate bubbly-button" title="Choose a Quest League">
                            <span class="league-bar__emblem" aria-hidden="true"><i class="fas fa-shield-halved"></i></span>
                            <span class="league-bar__league-copy">
                                <span class="league-bar__kicker">Quest League</span>
                                <span class="league-bar__pick"><span class="league-bar__pick-name">Select a League</span><i class="fas fa-chevron-down league-bar__pick-caret" aria-hidden="true"></i></span>
                            </span>
                        </button>
                        <button type="button" id="student-leaderboard-league-match-btn" title="Show the league for your selected class" class="hidden league-bar__match bubbly-button">
                            <i class="fas fa-rotate-left" aria-hidden="true"></i><span>My class</span>
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
                            <i class="fas fa-clock-rotate-left" aria-hidden="true"></i><span>Past months</span>
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
                            <span class="hc-hall__go" aria-hidden="true"><i class="fas fa-chevron-right"></i></span>
                        </button>
                        <button type="button" id="open-trophy-room-btn" class="hc-hall hc-hall--satchel" disabled>
                            <span class="hc-hall__medal" aria-hidden="true"><i class="fas fa-bag-shopping"></i></span>
                            <span class="hc-hall__text">
                                <span class="hc-hall__title">Satchels</span>
                                <span class="hc-hall__sub">Every hero's relics and treasures</span>
                            </span>
                            <span class="hc-hall__go" aria-hidden="true"><i class="fas fa-chevron-right"></i></span>
                        </button>
                    </nav>
                </div>

                <div class="hcs-board">
                    <div id="student-leaderboard-list" class="hcs-list"></div>
                </div>
            </div>
`;
