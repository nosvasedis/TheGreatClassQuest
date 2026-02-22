// templates/app/tabs/scroll.js

export const scrollTabHTML = `
            <div id="scholars-scroll-tab" class="app-tab hidden">
                <div class="max-w-6xl mx-auto">
                    <div class="text-center mb-6">
                        <i class="fas fa-scroll text-amber-800 text-5xl floating-icon"
                            style="animation-delay: -1s;"></i>
                        <h2 class="font-title text-5xl text-amber-800 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">The Scholar's Scroll</h2>
                        <p class="text-lg text-gray-600 mt-2">Chronicle the Trials of Knowledge and celebrate academic
                            triumphs!</p>
                    </div>

                    <div
                        class="bg-white p-4 rounded-2xl shadow-lg border-2 border-gray-100 flex flex-col sm:flex-row items-center gap-4 mb-6">
                        <select id="scroll-class-select"
                            class="w-full sm:w-auto flex-grow px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white text-lg">
                            <option value="">Select a class to view their scroll...</option>
                        </select>
                        <button id="log-trial-btn"
                            class="w-full sm:w-auto bg-amber-700 hover:bg-amber-800 text-white font-title text-xl py-3 px-6 rounded-lg bubbly-button disabled:opacity-50"
                            disabled>
                            <i class="fas fa-feather-alt mr-2"></i> Log a New Trial
                        </button>
                        <button id="view-trial-history-btn"
                            class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-title text-xl py-3 px-6 rounded-lg bubbly-button disabled:opacity-50"
                            disabled>
                            <i class="fas fa-history mr-2"></i> View History
                        </button>
                    </div>

                    <div id="scroll-dashboard-content" class="hidden">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" id="scroll-stats-cards"></div>

                        <div class="bg-white p-6 rounded-2xl shadow-lg">
                            <h3 class="font-title text-2xl text-gray-700 mb-4">Class Performance Chart</h3>
                            <div id="scroll-performance-chart" class="space-y-3"></div>
                        </div>
                    </div>
                    <div id="scroll-placeholder" class="text-center text-gray-500 bg-white/50 p-6 rounded-2xl">
                        Please select a class to view their academic progress.
                    </div>
                </div>
            </div>
`;
