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
        class="cert-folio-overlay fixed inset-0 z-[70] flex items-center justify-center p-4 hidden"
        role="dialog" aria-modal="true" aria-labelledby="certificate-modal-title">
        <div class="cert-folio pop-in">
            <div class="cert-folio__head">
                <div class="cert-folio__seal" aria-hidden="true"><i class="fas fa-award"></i></div>
                <div class="cert-folio__titles">
                    <p class="cert-folio__eyebrow">Hall of Honours</p>
                    <h2 id="certificate-modal-title" class="cert-folio__title">Hero Certificate</h2>
                    <p id="certificate-modal-student" class="cert-folio__student"></p>
                </div>
                <button id="certificate-modal-close-btn" type="button" class="cert-folio__close" aria-label="Close">&times;</button>
            </div>

            <div class="cert-folio__ribbons" role="tablist" aria-label="Certificate period">
                <button id="cert-tab-monthly" type="button" role="tab" class="cert-ribbon is-active" aria-selected="true">
                    <span class="cert-ribbon__icon" aria-hidden="true"><i class="fas fa-calendar-alt"></i></span>
                    <span class="cert-ribbon__text">
                        <span class="cert-ribbon__name">Monthly Quest</span>
                        <span class="cert-ribbon__hint">This month's deeds</span>
                    </span>
                </button>
                <button id="cert-tab-alltime" type="button" role="tab" class="cert-ribbon" aria-selected="false">
                    <span class="cert-ribbon__icon" aria-hidden="true"><i class="fas fa-crown"></i></span>
                    <span class="cert-ribbon__text">
                        <span class="cert-ribbon__name">Legend's Journey</span>
                        <span class="cert-ribbon__hint">The whole school year</span>
                    </span>
                </button>
            </div>

            <div id="certificate-modal-content" class="cert-folio__body custom-scrollbar">
                <!-- Desk (live page preview) and scribe's panel are rendered here -->
            </div>

            <div class="cert-folio__footer">
                <button id="download-certificate-btn" type="button" class="cert-btn cert-btn--seal hidden">
                    <i class="fas fa-stamp"></i> Seal &amp; Download PDF
                </button>
            </div>
        </div>
    </div>
`;
