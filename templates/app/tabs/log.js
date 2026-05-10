// templates/app/tabs/log.js

export const logTabHTML = `
            <div id="adventure-log-tab" class="app-tab hidden">
                <!-- ═════════════════════════════════════════════════════════════════
                     FLOATING ACTION BUTTONS (Left & Right)
                     ═════════════════════════════════════════════════════════════════ -->
                <!-- FAB — LEFT CORNER (Quest Assignment) -->
                <div class="al-fab-cluster al-fab-cluster--left">
                    <button id="quest-assignment-fab"
                        class="al-fab bubbly-button al-fab--left"
                        style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 55%, #06b6d4 100%); border: 2px solid rgba(94, 234, 212, 0.75); color: white;"
                        title="Quest Assignment">
                        <i class="fas fa-clipboard-list al-fab-icon"></i>
                        <span class="al-fab-label">Quest Assignment</span>
                    </button>
                </div>

                <!-- FAB — RIGHT CORNER (Attendance) -->
                <div class="al-fab-cluster al-fab-cluster--right">
                    <button id="attendance-fab"
                        class="al-fab bubbly-button al-fab--right"
                        style="background: linear-gradient(135deg, #f97316 0%, #fb923c 55%, #f59e0b 100%); border: 2px solid rgba(253, 186, 116, 0.75); color: white;"
                        title="Attendance">
                        <i class="fas fa-user-check al-fab-icon"></i>
                        <span class="al-fab-label">Attendance</span>
                    </button>
                </div>

                <div class="max-w-4xl mx-auto">
                    <!-- ═══════════════════════════════════════════════════════════════
                         HERO TITLE SECTION
                         ═══════════════════════════════════════════════════════════════ -->
                    <div class="text-center mb-8">
                        <i class="fas fa-book-open text-teal-500 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-teal-700 mt-2 bottom-nav-tab-title"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Adventure Log</h2>
                        <p id="adventure-log-tagline" class="text-lg text-gray-600 mt-2">A visual diary of your class's epic journey!</p>
                    </div>

                    <!-- ═══════════════════════════════════════════════════════════════
                         ENHANCED CONTROLS SECTION
                         ═══════════════════════════════════════════════════════════════ -->
                    <div class="al-controls-card">
                        <!-- Row 1: Month selector -->
                        <div class="al-controls-row">
                            <div class="al-selector-group">
                                <label for="adventure-log-month-filter" class="al-selector-label">
                                    <i class="fas fa-calendar text-teal-600"></i> Month
                                </label>
                                <select id="adventure-log-month-filter" class="al-selector"></select>
                            </div>
                        </div>

                        <!-- Row 2: Primary Actions -->
                        <div class="al-controls-row al-primary-actions">
                            <button id="log-adventure-btn"
                                class="al-primary-btn al-primary-btn--log bubbly-button"
                                disabled>
                                <i class="fas fa-feather-alt"></i>
                                <span>Log Today's Adventure</span>
                            </button>
                            <button id="hall-of-heroes-btn"
                                class="al-primary-btn al-primary-btn--heroes bubbly-button"
                                disabled>
                                <i class="fas fa-crown"></i>
                                <span>Hall of Heroes</span>
                            </button>
                        </div>
                    </div>

                    <!-- ═══════════════════════════════════════════════════════════════
                         LOG FEED (Unified Timeline)
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
