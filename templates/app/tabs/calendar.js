// templates/app/tabs/calendar.js

export const calendarTabHTML = `
            <div id="calendar-tab" class="app-tab hidden">
                <div class="max-w-7xl mx-auto">
                    <!-- Tab title: Quest Calendar -->
                    <header class="tab-sign tab-sign--calendar m-calendar-hero">
                        <div class="tab-sign__piece">
                            <span class="tab-sign__ring tab-sign__ring--l" aria-hidden="true"></span>
                            <span class="tab-sign__ring tab-sign__ring--r" aria-hidden="true"></span>
                            <div class="tab-sign__board">
                                <span class="tab-sign__orb tab-sign__orb--sun" aria-hidden="true"><i class="fas fa-sun"></i></span>
                                <span class="tab-sign__orb tab-sign__orb--moon" aria-hidden="true"><i class="fas fa-moon"></i></span>
                                <span class="tab-sign__kicker">Days · Events · Adventures</span>
                                <h2 class="font-title tab-sign__title">Quest Calendar</h2>
                            </div>
                        </div>
                        <p class="tab-sign__tagline m-calendar-hero__sub">View your schedule and plan special Quest Events.</p>
                    </header>
                    <div class="qc-shell">
                        <div class="qc-bar m-calendar-nav">
                            <div class="qc-bar__nav">
                                <button id="prev-month-btn" type="button" aria-label="Previous month" class="qc-nav-btn">
                                    <i class="fas fa-chevron-left" aria-hidden="true"></i>
                                </button>
                                <div class="m-calendar-nav__center qc-bar__center">
                                    <span class="qc-bar__kicker" aria-hidden="true">The month of</span>
                                    <h2 id="calendar-month-year" class="font-title qc-bar__title"></h2>
                                    <span id="m-calendar-today-chip" class="m-calendar-today-chip hidden">Today</span>
                                </div>
                                <button id="next-month-btn" type="button" aria-label="Next month" class="qc-nav-btn">
                                    <i class="fas fa-chevron-right" aria-hidden="true"></i>
                                </button>
                            </div>
                            <div id="qc-month-stats" class="qc-bar__stats" aria-live="polite"></div>
                            <button id="calendar-today-btn" type="button" class="qc-today-btn hidden">
                                <i class="fas fa-location-crosshairs" aria-hidden="true"></i>
                                <span>Back to today</span>
                            </button>
                        </div>
                        <div class="qc-page">
                            <div class="qc-page__rings" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
                            <div id="calendar-grid" class="qc-grid" role="grid" aria-label="Quest Calendar month">
                                <div id="calendar-loader" class="qc-loader hidden">
                                    <i class="fas fa-star" aria-hidden="true"></i>
                                    <p class="font-title">Fetching Quest Logs...</p>
                                </div>
                            </div>
                        </div>
                        <ul class="qc-legend" aria-label="Calendar key">
                            <li><span class="qc-legend__swatch qc-legend__swatch--today"></span>Today</li>
                            <li><span class="qc-legend__swatch qc-legend__swatch--stars"><i class="fas fa-star"></i></span>Stars awarded</li>
                            <li><span class="qc-legend__swatch qc-legend__swatch--event"></span>Quest Event</li>
                            <li><span class="qc-legend__swatch qc-legend__swatch--test">📝</span>Test day</li>
                            <li><span class="qc-legend__swatch qc-legend__swatch--holiday"></span>No school</li>
                            <li class="qc-legend__hint"><i class="fas fa-hand-pointer" aria-hidden="true"></i>Past days open the Quest Log. Today and later open the Planner.</li>
                        </ul>
                        <div id="m-calendar-day" class="m-calendar-day" hidden aria-live="polite"></div>
                    </div>
                </div>
            </div>
`;
