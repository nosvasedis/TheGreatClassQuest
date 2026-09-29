// templates/app/tabs/scroll.js

export const scrollTabHTML = `
            <div id="scholars-scroll-tab" class="app-tab hidden">
                <div class="max-w-6xl mx-auto">
                    <!-- Tab title: Scholar's Scroll -->
                    <header class="tab-sign tab-sign--scroll ss-hero">
                        <div class="tab-sign__piece">
                            <span class="tab-sign__roll tab-sign__roll--l" aria-hidden="true"></span>
                            <span class="tab-sign__roll tab-sign__roll--r" aria-hidden="true"></span>
                            <div class="tab-sign__board">
                                <span class="tab-sign__kicker">Trials · Tests · Triumphs</span>
                                <h2 class="font-title tab-sign__title">Scholar's Scroll</h2>
                            </div>
                            <span class="tab-sign__seal" aria-hidden="true"><i class="fas fa-feather-alt"></i></span>
                        </div>
                        <p class="tab-sign__tagline ss-hero-subtitle">Chronicle the Trials of Knowledge and celebrate academic triumphs!</p>
                    </header>

                    <div class="scroll-main-panels relative w-full">
                        <div id="scroll-dashboard-content"
                            class="scroll-panel scroll-panel--bg ss-desk"
                            aria-hidden="true">
                            <!-- Notices: upcoming test, pending grading, makeups (kept apart from the animated ledger + roll) -->
                            <div id="scroll-dashboard-queues" class="ss-notices"></div>
                            <div id="scroll-dashboard-inner" class="scroll-dashboard-inner">
                                <section id="scroll-stats-cards" class="ss-ledger" aria-label="Class summary"></section>

                                <section id="scroll-chart-section" class="ss-roll" aria-labelledby="ss-roll-title">
                                    <span class="ss-roll__corner ss-roll__corner--tl" aria-hidden="true"></span>
                                    <span class="ss-roll__corner ss-roll__corner--tr" aria-hidden="true"></span>
                                    <span class="ss-roll__corner ss-roll__corner--bl" aria-hidden="true"></span>
                                    <span class="ss-roll__corner ss-roll__corner--br" aria-hidden="true"></span>
                                    <header class="ss-roll__head">
                                        <div class="ss-roll__heading">
                                            <span class="ss-roll__crest" aria-hidden="true"><i class="fas fa-chart-bar"></i></span>
                                            <div>
                                                <p class="ss-roll__kicker">Class Performance</p>
                                                <h3 id="ss-roll-title" class="ss-roll__title">The Honour Roll</h3>
                                            </div>
                                        </div>
                                        <div id="scroll-chart-toolbar" class="ss-roll__tools"></div>
                                    </header>
                                    <div id="scroll-chart-legend" class="ss-roll__legend"></div>
                                    <div id="scroll-performance-chart" class="ss-roll__body"></div>
                                </section>
                            </div>
                        </div>
                        <div id="scroll-placeholder"
                            class="scroll-panel scroll-panel--fg ss-empty ss-empty--page"
                            aria-hidden="false">
                            <span class="ss-empty__art" aria-hidden="true"><i class="fas fa-scroll"></i></span>
                            <p class="ss-empty__title">The scroll is still rolled up</p>
                            <p class="ss-empty__text">Choose a class from the header to unroll its trials, results and honour roll.</p>
                        </div>
                    </div>
                </div>
            </div>
`;

