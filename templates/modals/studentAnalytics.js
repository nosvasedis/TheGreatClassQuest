// /templates/modals/studentAnalytics.js

export const studentAnalyticsModalHTML = `
    <div id="student-analytics-modal"
        class="modal hidden fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
        role="dialog"
        aria-modal="true">
        
        <div class="pop-in relative w-full max-w-5xl max-h-[90vh] bg-gradient-to-br from-white via-gray-50 to-gray-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            
            <!-- Header -->
            <div class="relative bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-6 text-white flex items-center justify-between gap-4">
                <div class="flex items-center gap-4 flex-1 min-w-0">
                    <div id="analytics-student-avatar" class="w-16 h-16 rounded-full border-4 border-white shadow-lg flex-shrink-0 bg-white overflow-hidden"></div>
                    <div class="min-w-0">
                        <h2 id="analytics-student-name" class="text-2xl font-title truncate"></h2>
                        <div class="flex gap-4 mt-1 text-sm opacity-90">
                            <span>📊 <span id="analytics-quick-recent">--</span></span>
                            <span>📈 <span id="analytics-quick-avg">--</span></span>
                        </div>
                    </div>
                </div>
                <button id="student-analytics-close-btn" class="text-white hover:bg-white/20 p-2 rounded-lg transition-all text-2xl flex-shrink-0">
                    ✕
                </button>
            </div>

            <!-- Tab Navigation -->
            <div class="flex border-b border-gray-200 bg-white px-8 overflow-x-auto">
                <button class="analytics-tab-button active" data-tab="overview">
                    <span class="tab-icon">📋</span> Overview
                </button>
                <button class="analytics-tab-button" data-tab="trends">
                    <span class="tab-icon">📈</span> Performance Trends
                </button>
                <button class="analytics-tab-button" data-tab="analysis">
                    <span class="tab-icon">🧠</span> AI Analysis
                </button>
                <button class="analytics-tab-button" data-tab="chat">
                    <span class="tab-icon">💬</span> Chat
                </button>
            </div>

            <!-- Tab Contents -->
            <div class="flex-1 overflow-y-auto">
                <!-- Overview Tab -->
                <div data-tab-content="overview" class="p-8 min-h-full">
                    <div class="analytics-overview-loading">Loading...</div>
                </div>

                <!-- Performance Trends Tab -->
                <div data-tab-content="trends" class="p-8 min-h-full hidden">
                    <div class="analytics-trends-loading">Loading...</div>
                </div>

                <!-- AI Analysis Tab -->
                <div data-tab-content="analysis" class="p-8 min-h-full hidden">
                    <div class="analytics-analysis-loading">Loading...</div>
                </div>

                <!-- Chat Tab -->
                <div data-tab-content="chat" class="p-8 min-h-full hidden flex flex-col">
                    <div class="analytics-chat-loading">Loading...</div>
                </div>
            </div>
        </div>
    </div>
`;
