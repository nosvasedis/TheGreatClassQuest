// templates/app/tabs/log.js

export const logTabHTML = `
            <div id="adventure-log-tab" class="app-tab hidden">
                <div class="max-w-4xl mx-auto">
                    <!-- ═══════════════════════════════════════════════════════════════
                         HERO TITLE SECTION
                         ═══════════════════════════════════════════════════════════════ -->
                    <!-- Tab title: Adventure Log -->
                    <header class="tab-sign tab-sign--log">
                        <div class="tab-sign__piece">
                            <span class="tab-sign__spine" aria-hidden="true"></span>
                            <div class="tab-sign__board">
                                <span class="tab-sign__corner tab-sign__corner--t" aria-hidden="true"></span>
                                <span class="tab-sign__corner tab-sign__corner--b" aria-hidden="true"></span>
                                <span class="tab-sign__kicker">Days · Deeds · Memories</span>
                                <h2 class="font-title tab-sign__title">Adventure Log</h2>
                            </div>
                            <span class="tab-sign__bookmark" aria-hidden="true"></span>
                        </div>
                        <p class="tab-sign__tagline" id="adventure-log-tagline">A visual diary of your class's epic journey!</p>
                    </header>

                    <!-- ═══════════════════════════════════════════════════════════════
                         DIARY DESK: month divider tabs, this month's summary, today's page
                         ═══════════════════════════════════════════════════════════════ -->
                    <section class="al-desk" aria-label="Diary controls">
                        <div class="al-month-tabs-wrap">
                            <div id="adventure-log-month-tabs" class="al-month-tabs" role="tablist" aria-label="Diary month"></div>
                            <!-- The select stays the source of truth (listeners read its change event); the tabs drive it. -->
                            <label for="adventure-log-month-filter" class="sr-only">Month</label>
                            <select id="adventure-log-month-filter" class="al-selector al-selector--hidden" tabindex="-1" aria-hidden="true"></select>
                        </div>
                        <div class="al-desk-page">
                            <div class="al-desk-month">
                                <p class="al-desk-kicker">This month in the diary</p>
                                <h3 id="adventure-log-month-name" class="al-desk-month-name">&nbsp;</h3>
                                <div id="adventure-log-month-stats" class="al-desk-stats" aria-live="polite"></div>
                            </div>
                            <div class="al-desk-today">
                                <div class="al-controls-row al-primary-actions">
                                    <button id="log-adventure-btn"
                                        class="al-primary-btn al-primary-btn--log bubbly-button"
                                        disabled>
                                        <i class="fas fa-crown" aria-hidden="true"></i>
                                        <span>Crown Today's Hero</span>
                                    </button>
                                    <button id="hall-of-heroes-btn"
                                        class="al-primary-btn al-primary-btn--heroes bubbly-button"
                                        disabled>
                                        <i class="fas fa-crown"></i>
                                        <span>Hall of Heroes</span>
                                    </button>
                                </div>
                                <p id="adventure-log-today-hint" class="al-today-hint" aria-live="polite"></p>
                            </div>
                        </div>
                    </section>

                    <!-- ═══════════════════════════════════════════════════════════════
                         CLASS TOOLS: the Quest Board and the register, clipped to the desk.
                         Kept outside .al-desk so they stay available when the diary is locked.
                         ═══════════════════════════════════════════════════════════════ -->
                    <nav class="al-tools" aria-label="Class tools">
                        <button id="quest-assignment-btn" type="button" class="al-tool al-tool--board" disabled>
                            <span class="al-tool__icon" aria-hidden="true"><i class="fas fa-clipboard-list"></i></span>
                            <span class="al-tool__text">
                                <span class="al-tool__title">Quest Assignment</span>
                                <span id="quest-assignment-btn-status" class="al-tool__status">Homework and tests for the next lesson</span>
                            </span>
                            <i class="fas fa-chevron-right al-tool__go" aria-hidden="true"></i>
                        </button>
                        <button id="attendance-chronicle-btn" type="button" class="al-tool al-tool--register" disabled>
                            <span class="al-tool__icon" aria-hidden="true"><i class="fas fa-user-check"></i></span>
                            <span class="al-tool__text">
                                <span class="al-tool__title">Attendance</span>
                                <span id="attendance-chronicle-btn-status" class="al-tool__status">Who was there, lesson by lesson</span>
                            </span>
                            <i class="fas fa-chevron-right al-tool__go" aria-hidden="true"></i>
                        </button>
                    </nav>

                    <!-- ═══════════════════════════════════════════════════════════════
                         DIARY PAGES (newest first)
                         ═══════════════════════════════════════════════════════════════ -->
                    <div id="adventure-log-feed" class="al-log-feed"></div>

                    <!-- ═══════════════════════════════════════════════════════════════
                         UPSELL (Subscription Messaging)
                         ═══════════════════════════════════════════════════════════════ -->
                    <div id="adventure-log-upsell" class="al-upsell hidden">
                        <p id="adventure-log-upsell-title" class="al-upsell-title"></p>
                        <p id="adventure-log-upsell-body" class="al-upsell-body"></p>
                        <p class="al-upsell-footer">See Options for your plan and upgrade path.</p>
                    </div>
                </div>
            </div>
`;
