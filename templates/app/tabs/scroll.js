// templates/app/tabs/scroll.js

export const scrollTabHTML = `
            <div id="scholars-scroll-tab" class="app-tab hidden">
                <div class="ss-fab-cluster ss-fab-cluster--left" aria-hidden="true">
                    <button id="view-trial-history-fab"
                        class="ss-fab ss-fab--left bg-gradient-to-br from-sky-600 via-blue-500 to-indigo-500 text-white border-sky-300/70"
                        disabled>
                        <span class="ss-fab-icon"><i class="fas fa-history"></i></span>
                        <span class="ss-fab-label">View History</span>
                    </button>
                </div>

                <div class="ss-fab-cluster ss-fab-cluster--right" aria-hidden="true">
                    <button id="log-trial-fab"
                        class="ss-fab ss-fab--right bg-gradient-to-br from-pink-600 via-rose-500 to-fuchsia-500 text-white border-pink-300/70"
                        disabled>
                        <span class="ss-fab-icon"><i class="fas fa-feather-alt"></i></span>
                        <span class="ss-fab-label">Log New Trial</span>
                    </button>
                </div>

                <div class="max-w-6xl mx-auto">
                    <div class="ss-hero text-center mb-6">
                        <i class="fas fa-scroll text-pink-700 text-5xl floating-icon"
                            style="animation-delay: -1s;"></i>
                        <h2 class="font-title text-5xl text-pink-700 mt-2 bottom-nav-tab-title"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Scholar's Scroll</h2>
                        <p class="ss-hero-subtitle text-lg text-gray-600 mt-2">Chronicle the Trials of Knowledge and celebrate academic
                            triumphs!</p>
                    </div>

                    <div class="scroll-main-panels relative w-full">
                        <div id="scroll-dashboard-content"
                            class="scroll-panel scroll-panel--bg flex flex-col gap-6"
                            aria-hidden="true">
                            <!-- Alerts / pending grading / makeups — separate from the animated chart block -->
                            <div id="scroll-dashboard-queues" class="scroll-dashboard-queues flex flex-col gap-4"></div>
                            <div id="scroll-dashboard-inner" class="scroll-dashboard-inner">
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" id="scroll-stats-cards"></div>

                                <div class="bg-white p-6 rounded-2xl shadow-lg">
                                    <h3 class="chart-section-title font-title text-xl md:text-2xl text-slate-800 tracking-tight leading-tight mb-5 flex items-center gap-3">
                                        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-700 text-white shadow-md border border-slate-900/20" aria-hidden="true">
                                            <i class="fas fa-chart-line text-sm opacity-95"></i>
                                        </span>
                                        <span>Class Performance Chart</span>
                                    </h3>
                                    <div id="scroll-performance-chart" class="space-y-3"></div>
                                </div>
                            </div>
                        </div>
                        <div id="scroll-placeholder"
                            class="scroll-panel scroll-panel--fg text-center text-gray-500 bg-white/50 p-6 rounded-2xl"
                            aria-hidden="false">
                            Please choose a class from the header to view academic progress.
                        </div>
                    </div>
                </div>
            </div>
`;

