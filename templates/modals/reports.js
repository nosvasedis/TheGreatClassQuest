// templates/modals/reports.js
// Report modal, certificate modal

export const reportsModalsHTML = `
    <div id="report-modal"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 hidden">
        <div class="relative bg-white/80 backdrop-blur-2xl p-8 md:p-10 rounded-[2.5rem] shadow-2xl max-w-3xl w-full pop-in border border-white/50 overflow-hidden">
            <!-- Decorative Orbs -->
            <div class="absolute -top-20 -right-20 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none"></div>
            <div class="absolute -bottom-20 -left-20 w-64 h-64 bg-green-400/20 rounded-full blur-3xl pointer-events-none"></div>

            <div class="relative z-10">
                <!-- Header -->
                <div class="flex justify-between items-start mb-6">
                    <div class="flex items-center gap-4">
                        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-500 shadow-lg shadow-green-200 flex items-center justify-center transform rotate-3 hover:rotate-6 transition-transform">
                            <i class="fas fa-scroll text-3xl text-white"></i>
                        </div>
                        <div>
                            <h2 class="font-title text-3xl md:text-4xl text-emerald-800 tracking-wide drop-shadow-sm">Weekly Report</h2>
                            <p class="text-sm font-bold uppercase tracking-widest text-emerald-600/80 mt-1">Oracle AI Analysis</p>
                        </div>
                    </div>
                    <button id="report-modal-close-btn"
                        class="bg-white/50 hover:bg-white text-emerald-800 border border-emerald-100 font-bold w-12 h-12 rounded-full bubbly-button transition-all shadow-sm flex items-center justify-center text-xl">
                        &times;
                    </button>
                </div>

                <!-- Content Area -->
                <div id="report-modal-content"
                    class="space-y-4 max-h-[65vh] overflow-y-auto pr-4 custom-scrollbar text-gray-700 leading-relaxed text-lg bg-white/60 p-6 md:p-8 rounded-[1.5rem] border border-white shadow-inner">
                </div>
            </div>
        </div>
    </div>

    <div id="certificate-modal"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 hidden">
        <div class="relative bg-white/80 backdrop-blur-2xl p-8 md:p-10 rounded-[2.5rem] shadow-2xl max-w-2xl w-full pop-in border border-white/50 flex flex-col max-h-[95vh] overflow-hidden">
            <!-- Decorative Elements -->
            <div class="absolute -top-24 -left-24 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none"></div>
            <div class="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl pointer-events-none"></div>
            
            <!-- Header -->
            <div class="relative z-10 flex justify-between items-start mb-8 flex-shrink-0">
                <div class="flex items-center gap-4">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200 flex items-center justify-center transform -rotate-3 hover:rotate-0 transition-transform">
                        <i class="fas fa-award text-3xl text-white"></i>
                    </div>
                    <div>
                        <h2 class="font-title text-3xl md:text-4xl text-indigo-900 tracking-wide">Achievement</h2>
                        <p class="text-sm font-bold uppercase tracking-widest text-indigo-600/80 mt-1">Hero Certificate</p>
                    </div>
                </div>
                <button id="certificate-modal-close-btn"
                    class="bg-white/50 hover:bg-white text-indigo-800 border border-indigo-100 font-bold w-12 h-12 rounded-full bubbly-button transition-all shadow-sm flex items-center justify-center text-xl">
                    &times;
                </button>
            </div>

            <!-- Tabs -->
            <div class="relative z-10 flex gap-2 mb-6 bg-indigo-50/50 p-1.5 rounded-2xl border border-indigo-100 flex-shrink-0">
                <button id="cert-tab-monthly" class="flex-1 py-2.5 rounded-xl font-title text-sm transition-all bubbly-button bg-white text-indigo-600 shadow-sm">
                    <i class="fas fa-calendar-alt mr-2"></i> Monthly Quest
                </button>
                <button id="cert-tab-alltime" class="flex-1 py-2.5 rounded-xl font-title text-sm transition-all bubbly-button text-indigo-400 hover:text-indigo-600">
                    <i class="fas fa-scroll mr-2"></i> Legend's Journey
                </button>
            </div>

            <!-- Content Area -->
            <div id="certificate-modal-content"
                class="relative z-10 space-y-6 bg-white/60 p-6 md:p-8 rounded-[2rem] border border-white shadow-inner flex-grow overflow-y-auto custom-scrollbar flex flex-col items-center text-center">
                <!-- Content will be injected here -->
            </div>

            <!-- Action Button -->
            <div class="relative z-10 flex-shrink-0">
                <button id="download-certificate-btn"
                    class="w-full mt-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-title text-xl py-4 rounded-2xl bubbly-button hidden shadow-lg shadow-indigo-200/50 transition-all hover:scale-[1.02] active:scale-[0.98]">
                    <i class="fas fa-download mr-2"></i> Download as PDF
                </button>
        </div>
    </div>
`;
