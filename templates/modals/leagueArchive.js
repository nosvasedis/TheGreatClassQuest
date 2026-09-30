// templates/modals/leagueArchive.js
// League Archive: Team Quest's past months, charted as sheets of a map-maker's atlas.

export const leagueArchiveModalHTML = `
    <div id="league-archive-modal"
        class="fixed inset-0 bg-slate-950/60 z-[71] flex items-center justify-center p-4 hidden">
        <div class="la-shell max-w-4xl w-full pop-in flex flex-col max-h-[92vh] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="league-archive-title">
            <!-- Header: the atlas cover, a folded map with the race route inked across it -->
            <header class="la-head">
                <svg class="la-head__route" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                    <path d="M-6 94 C 50 100, 90 76, 140 84 S 220 100, 262 80 S 330 34, 406 40"/>
                </svg>
                <span class="la-head__x" aria-hidden="true">✕</span>
                <span class="la-head__rose" aria-hidden="true">
                    <svg viewBox="0 0 64 64" focusable="false">
                        <circle cx="32" cy="32" r="29" class="la-rose__ring"/>
                        <circle cx="32" cy="32" r="23" class="la-rose__ring la-rose__ring--inner"/>
                        <g class="la-rose__needle">
                            <path d="M32 6 L37 32 L32 58 L27 32 Z" class="la-rose__ns"/>
                            <path d="M32 6 L37 32 L32 32 Z" class="la-rose__north"/>
                            <path d="M6 32 L32 28 L58 32 L32 36 Z" class="la-rose__ew"/>
                        </g>
                        <circle cx="32" cy="32" r="3.2" class="la-rose__pin"/>
                    </svg>
                </span>
                <div class="la-head__titles">
                    <p class="la-head__kicker">Team Quest · past months</p>
                    <h2 id="league-archive-title" class="la-head__title font-title">League Archive</h2>
                    <p id="league-archive-subtitle" class="la-head__sub">Every race, charted when its month closes</p>
                </div>
                <button id="league-archive-close-btn" type="button" class="la-close" aria-label="Close the League Archive">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            </header>
            <div id="league-archive-controls" class="la-controls"></div>
            <div id="league-archive-content" class="la-body flex-1 overflow-y-auto custom-scrollbar"></div>
        </div>
    </div>
`;
