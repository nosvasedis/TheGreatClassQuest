// /templates/modals/studentAnalytics.js

export const studentAnalyticsModalHTML = `
    <div id="student-analytics-modal"
        class="modal hidden fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 sa-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-student-name"
        aria-describedby="analytics-student-subtitle">

        <div class="pop-in student-analytics-shell bg-white relative w-full max-w-5xl max-h-[95vh] flex flex-col rounded-[2.5rem] overflow-hidden sa-ring-border shadow-2xl">
            <!-- Fluffy white header with background pattern -->
            <div class="sa-bg-pattern pointer-events-none absolute inset-0 opacity-30 z-0"></div>

            <div class="flex flex-col h-full w-full relative z-10 min-h-0">
                <header class="sa-header shrink-0 px-6 py-4 md:px-8 bg-gradient-to-b from-violet-50/80 to-white/95 backdrop-blur-sm border-b border-violet-100">
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex items-center gap-4 flex-1 min-w-0">
                            <div class="relative shrink-0">
                                <div id="analytics-student-avatar" class="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-white shadow bg-indigo-50 flex items-center justify-center text-2xl text-indigo-300 font-bold bg-cover bg-center overflow-hidden"></div>
                                <div class="absolute -bottom-1 -right-1 bg-yellow-400 text-white w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm text-xs bounce-gentle"><i class="fas fa-star"></i></div>
                            </div>
                            <div class="min-w-0">
                                <h2 id="analytics-student-name" class="font-title text-2xl md:text-3xl text-gray-800 font-bold tracking-tight truncate drop-shadow-sm mb-0.5"></h2>
                                <div class="flex items-center gap-3 text-sm">
                                    <p id="analytics-student-subtitle" class="text-violet-600 font-semibold truncate flex items-center gap-1.5"><i class="fas fa-map-marker-alt"></i> Loading…</p>
                                    
                                    <div class="hidden md:flex items-center gap-2 bg-indigo-50/80 border border-indigo-100 rounded-full px-2 py-0.5 shadow-sm">
                                        <i class="fas fa-info-circle text-indigo-400 text-xs"></i>
                                        <span id="analytics-history-hint" class="text-xs font-medium text-indigo-700 truncate max-w-[150px]"></span>
                                        <span id="analytics-full-history-status" class="text-xs font-semibold text-gray-500 hidden"></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 shrink-0">
                            <div id="student-analytics-toolbar" class="student-analytics-toolbar-actions flex items-center gap-1 bg-white border border-gray-200 shadow-sm rounded-full p-1">
                                <button id="student-analytics-load-full-history-btn" type="button" class="px-3 h-8 rounded-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all shadow-sm transform hover:-translate-y-0.5" title="Load full history">
                                    <i class="fas fa-cloud-download-alt"></i> <span class="hidden md:inline">Load all</span>
                                </button>
                                <button id="student-analytics-export-csv-btn" type="button" class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-emerald-50 text-emerald-500 transition-colors" title="Export CSV"><i class="fas fa-file-csv"></i></button>
                                <button id="student-analytics-export-pdf-btn" type="button" class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-50 text-red-500 transition-colors" title="Export PDF"><i class="fas fa-file-pdf"></i></button>
                                <button id="student-analytics-print-btn" type="button" class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-50 text-gray-600 transition-colors" title="Print"><i class="fas fa-print"></i></button>
                            </div>
                            <button id="student-analytics-close-btn" type="button" class="w-10 h-10 rounded-full bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 flex items-center justify-center transition-all shadow-sm border border-red-200 group" aria-label="Close">
                                <i class="fas fa-times text-lg group-hover:rotate-90 transition-transform duration-300"></i>
                            </button>
                        </div>
                    </div>
                </header>

                <!-- Fluffy colorful tabs -->
                <div class="sa-tabbar shrink-0 flex gap-3 px-6 md:px-8 py-5 overflow-x-auto bg-white shadow-sm z-10" role="tablist" aria-label="Student analytics tabs">
                    <button id="analytics-tab-overview"
                        class="analytics-tab-button active sa-tab tab-violet"
                        data-tab="overview"
                        role="tab"
                        aria-selected="true"
                        aria-controls="analytics-panel-overview">
                        <span class="tab-icon-wrap"><i class="fas fa-smile-beam"></i></span>
                        <span class="font-bold">Overview</span>
                    </button>
                    <button id="analytics-tab-performance"
                        class="analytics-tab-button sa-tab tab-blue"
                        data-tab="performance"
                        role="tab"
                        aria-selected="false"
                        aria-controls="analytics-panel-performance"
                        tabindex="-1">
                        <span class="tab-icon-wrap"><i class="fas fa-chart-bar"></i></span>
                        <span class="font-bold">Scores</span>
                    </button>
                    <button id="analytics-tab-analysis"
                        class="analytics-tab-button sa-tab analytics-tab-teacher tab-amber"
                        data-tab="analysis"
                        role="tab"
                        aria-selected="false"
                        aria-controls="analytics-panel-analysis"
                        tabindex="-1">
                        <span class="tab-icon-wrap"><i class="fas fa-lightbulb"></i></span>
                        <span class="font-bold">Insights</span>
                    </button>
                    <button id="analytics-tab-assistant"
                        class="analytics-tab-button sa-tab analytics-tab-teacher tab-emerald"
                        data-tab="assistant"
                        role="tab"
                        aria-selected="false"
                        aria-controls="analytics-panel-assistant"
                        tabindex="-1">
                        <span class="tab-icon-wrap"><i class="fas fa-robot"></i></span>
                        <span class="font-bold">Assistant</span>
                    </button>
                </div>

                <div id="student-analytics-error-banner" class="hidden student-analytics-error-banner shrink-0 bg-red-100 text-red-700 font-bold p-4 text-center border-b border-red-200" role="alert"></div>

                <div class="flex-1 min-h-0 overflow-y-auto px-6 md:px-8 pb-12 pt-6 bg-slate-50 sa-scroll">
                    <div id="analytics-panel-overview" data-tab-content="overview" class="student-analytics-panel" role="tabpanel" aria-labelledby="analytics-tab-overview">
                        
                        <!-- Quick Stats: Colorful Bubbles -->
                        <div class="sa-quick-stats grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
                            <div class="sa-stat-bubble bg-pink-50 border-pink-200 text-pink-600">
                                <div class="sa-stat-icon bg-pink-100"><i class="fas fa-graduation-cap"></i></div>
                                <div class="sa-stat-content">
                                    <span class="sa-stat-label">Grade</span>
                                    <span id="analytics-quick-grade" class="sa-stat-value font-title">--</span>
                                </div>
                            </div>
                            <div class="sa-stat-bubble bg-emerald-50 border-emerald-200 text-emerald-600">
                                <div class="sa-stat-icon bg-emerald-100"><i class="fas fa-calendar-check"></i></div>
                                <div class="sa-stat-content">
                                    <span class="sa-stat-label">Attendance</span>
                                    <span id="analytics-quick-attendance" class="sa-stat-value font-title">--</span>
                                </div>
                            </div>
                            <div class="sa-stat-bubble bg-amber-50 border-amber-200 text-amber-600">
                                <div class="sa-stat-icon bg-amber-100"><i class="fas fa-chart-line"></i></div>
                                <div class="sa-stat-content">
                                    <span class="sa-stat-label">Trend</span>
                                    <span id="analytics-quick-recent" class="sa-stat-value font-title">--</span>
                                </div>
                            </div>
                            <div class="sa-stat-bubble bg-blue-50 border-blue-200 text-blue-600">
                                <div class="sa-stat-icon bg-blue-100"><i class="fas fa-percentage"></i></div>
                                <div class="sa-stat-content">
                                    <span class="sa-stat-label">Avg score</span>
                                    <span id="analytics-quick-avg" class="sa-stat-value font-title">--</span>
                                </div>
                            </div>
                        </div>

                        <div class="analytics-panel-shell" data-panel-state="loading">
                            <div class="analytics-skeleton analytics-skeleton-title"></div>
                            <div class="analytics-metric-grid">
                                <div class="analytics-skeleton analytics-skeleton-card"></div>
                                <div class="analytics-skeleton analytics-skeleton-card"></div>
                            </div>
                            <div class="analytics-skeleton analytics-skeleton-chart"></div>
                        </div>
                        <div class="analytics-panel-shell hidden" data-panel-state="error">
                            <div class="analytics-state-card sa-card border-red-200 bg-red-50 text-red-800">
                                <h3 class="font-title text-xl text-red-600 mb-2"><i class="fas fa-exclamation-circle"></i> Oops!</h3>
                                <p class="font-medium">We could not build the overview right now. Try again.</p>
                            </div>
                        </div>
                        <div class="analytics-panel-shell hidden" data-panel-state="empty">
                            <div class="analytics-state-card sa-card text-center items-center py-12">
                                <div class="w-24 h-24 bg-indigo-100 text-indigo-400 rounded-full flex items-center justify-center text-5xl mx-auto mb-6">
                                    <i class="fas fa-ghost"></i>
                                </div>
                                <h3 class="font-title text-2xl text-gray-800 mb-3">No assessments yet</h3>
                                <p class="text-gray-500 font-medium text-lg">Once at least one assessment is logged, this friendly snapshot will appear.</p>
                            </div>
                        </div>
                        <div class="analytics-panel-shell hidden" data-panel-state="ready">
                            <section id="analytics-overview-content" class="fade-in-up"></section>
                        </div>
                    </div>

                    <div id="analytics-panel-performance" data-tab-content="performance" class="student-analytics-panel hidden" role="tabpanel" aria-labelledby="analytics-tab-performance">
                        <div class="analytics-panel-shell" data-panel-state="loading">
                            <div class="analytics-skeleton analytics-skeleton-title"></div>
                            <div class="analytics-skeleton analytics-skeleton-chart"></div>
                            <div class="analytics-skeleton analytics-skeleton-table"></div>
                        </div>
                        <div class="analytics-panel-shell hidden" data-panel-state="error">
                            <div class="analytics-state-card sa-card border-red-200 bg-red-50 text-red-800">
                                <h3 class="font-title text-xl text-red-600 mb-2"><i class="fas fa-exclamation-circle"></i> Scores unavailable</h3>
                                <p class="font-medium">Detailed scores could not load right now.</p>
                            </div>
                        </div>
                        <div class="analytics-panel-shell hidden" data-panel-state="empty">
                            <div class="analytics-state-card sa-card text-center items-center py-12">
                                <div class="w-24 h-24 bg-blue-100 text-blue-400 rounded-full flex items-center justify-center text-5xl mx-auto mb-6">
                                    <i class="fas fa-scroll"></i>
                                </div>
                                <h3 class="font-title text-2xl text-gray-800 mb-3">Need a bit more history</h3>
                                <p class="text-gray-500 font-medium text-lg">Log more tests or dictations to fill out this view.</p>
                            </div>
                        </div>
                        <div class="analytics-panel-shell hidden" data-panel-state="ready">
                            <section id="analytics-performance-content" class="fade-in-up"></section>
                        </div>
                    </div>

                    <div id="analytics-panel-analysis" data-tab-content="analysis" class="student-analytics-panel hidden" role="tabpanel" aria-labelledby="analytics-tab-analysis">
                        <div class="analytics-panel-shell" data-panel-state="loading">
                            <div class="analytics-skeleton analytics-skeleton-title"></div>
                            <div class="analytics-metric-grid">
                                <div class="analytics-skeleton analytics-skeleton-card"></div>
                                <div class="analytics-skeleton analytics-skeleton-card"></div>
                            </div>
                        </div>
                        <div class="analytics-panel-shell hidden" data-panel-state="locked">
                            <div class="analytics-state-card sa-card text-center items-center py-12 bg-gradient-to-br from-amber-50 to-white border-amber-200">
                                <div class="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center mb-6 shadow-lg mx-auto transform hover:scale-110 transition-transform">
                                    <i class="fas fa-crown text-4xl text-amber-900"></i>
                                </div>
                                <h3 class="font-title text-3xl text-amber-600 mb-3">Elite AI Insights</h3>
                                <p class="text-gray-600 font-medium text-lg mb-8 max-w-lg mx-auto">AI summaries and smart coaching ideas are exclusive to the Elite plan.</p>
                                <button id="analytics-analysis-upgrade-btn" type="button" class="analytics-upgrade-button text-lg px-8 py-4">Unlock AI insights</button>
                            </div>
                        </div>
                        <div class="analytics-panel-shell hidden" data-panel-state="error">
                            <div class="analytics-state-card sa-card border-red-200 bg-red-50 text-red-800">
                                <h3 class="font-title text-xl text-red-600 mb-2"><i class="fas fa-exclamation-circle"></i> Insights unavailable</h3>
                                <p class="font-medium">Everything else still works — this section will catch up soon.</p>
                            </div>
                        </div>
                        <div class="analytics-panel-shell hidden" data-panel-state="empty">
                            <div class="analytics-state-card sa-card text-center items-center py-12">
                                <div class="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-6">
                                    <i class="fas fa-seedling"></i>
                                </div>
                                <h3 class="font-title text-2xl text-gray-800 mb-3">More history helps</h3>
                                <p class="text-gray-500 font-medium text-lg">Add a few more assessments for richer insights.</p>
                            </div>
                        </div>
                        <div class="analytics-panel-shell hidden" data-panel-state="ready">
                            <section id="analytics-analysis-content" class="fade-in-up"></section>
                        </div>
                    </div>

                    <div id="analytics-panel-assistant" data-tab-content="assistant" class="student-analytics-panel hidden" role="tabpanel" aria-labelledby="analytics-tab-assistant">
                        <div class="analytics-panel-shell" data-panel-state="loading">
                            <div class="analytics-skeleton analytics-skeleton-title"></div>
                            <div class="analytics-skeleton analytics-skeleton-chat"></div>
                        </div>
                        <div class="analytics-panel-shell hidden" data-panel-state="locked">
                            <div class="analytics-state-card sa-card text-center items-center py-12 bg-gradient-to-br from-amber-50 to-white border-amber-200">
                                <div class="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center mb-6 shadow-lg mx-auto transform hover:scale-110 transition-transform">
                                    <i class="fas fa-magic text-4xl text-amber-900"></i>
                                </div>
                                <h3 class="font-title text-3xl text-amber-600 mb-3">Elite AI Assistant</h3>
                                <p class="text-gray-600 font-medium text-lg mb-8 max-w-lg mx-auto">The magical teaching assistant lives on the Elite plan.</p>
                                <button id="analytics-assistant-upgrade-btn" type="button" class="analytics-upgrade-button text-lg px-8 py-4">Unlock assistant</button>
                            </div>
                        </div>
                        <div class="analytics-panel-shell hidden" data-panel-state="error">
                            <div class="analytics-state-card sa-card border-red-200 bg-red-50 text-red-800">
                                <h3 class="font-title text-xl text-red-600 mb-2"><i class="fas fa-exclamation-circle"></i> Assistant unavailable</h3>
                                <p class="font-medium">Try again in a moment.</p>
                            </div>
                        </div>
                        <div class="analytics-panel-shell hidden" data-panel-state="empty">
                            <div class="analytics-state-card sa-card text-center items-center py-12">
                                <div class="w-24 h-24 bg-purple-100 text-purple-400 rounded-full flex items-center justify-center text-5xl mx-auto mb-6">
                                    <i class="fas fa-comment-dots"></i>
                                </div>
                                <h3 class="font-title text-2xl text-gray-800 mb-3">Need more context</h3>
                                <p class="text-gray-500 font-medium text-lg">Add assessments or notes and we can chat about next steps.</p>
                            </div>
                        </div>
                        <div class="analytics-panel-shell hidden" data-panel-state="ready">
                            <section id="analytics-assistant-content" class="fade-in-up"></section>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
