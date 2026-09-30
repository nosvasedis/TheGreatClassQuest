// templates/modals/rankings.js
// Global leaderboard modal

export const rankingsModalsHTML = `
    <div id="global-leaderboard-modal"
        class="fixed inset-0 bg-slate-950/60 z-[95] flex items-center justify-center p-4 hidden">
        <div class="hl-shell max-w-4xl w-full pop-in flex flex-col max-h-[92vh] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="global-leaderboard-title">
            <!-- Header: the archive's velvet cover with a gold-hemmed valance -->
            <header class="hl-head">
                <span class="hl-head__valance" aria-hidden="true"></span>
                <span class="hl-head__crest" aria-hidden="true"><i class="fas fa-book-bookmark"></i></span>
                <div class="hl-head__titles">
                    <p class="hl-head__kicker">Hero's Challenge · Archive</p>
                    <h2 id="global-leaderboard-title" class="hl-head__title font-title">Hero Logs</h2>
                    <p id="global-leaderboard-subtitle" class="hl-head__sub">Monthly ranks, sealed when each month closes</p>
                </div>
                <button id="global-leaderboard-close-btn" type="button" class="hl-close" aria-label="Close Hero Logs">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            </header>
            <div id="global-leaderboard-controls" class="hl-controls"></div>
            <div id="global-leaderboard-content" class="hl-body flex-1 overflow-y-auto custom-scrollbar"></div>
        </div>
    </div>
`;
