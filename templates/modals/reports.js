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
        class="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-2xl w-full pop-in border-4 border-indigo-300">
            <div class="flex justify-between items-center mb-4">
                <h2 class="font-title text-2xl md:text-3xl text-indigo-700">Certificate of Achievement</h2>
                <button id="certificate-modal-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div id="certificate-modal-content"
                class="space-y-4 max-h-[70vh] overflow-y-auto pr-2 bg-indigo-50 p-4 rounded-lg"></div>
            <button id="download-certificate-btn"
                class="w-full mt-4 bg-indigo-500 hover:bg-indigo-600 text-white font-title text-lg py-3 rounded-xl bubbly-button hidden">
                <i class="fas fa-download mr-2"></i> Download as PDF
            </button>
        </div>
    </div>
`;
