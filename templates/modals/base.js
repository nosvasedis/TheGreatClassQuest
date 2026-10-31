// templates/modals/base.js
// Confirmation, league picker, logo picker

export const baseModalsHTML = `
    <div id="confirmation-modal"
        class="fixed inset-0 bg-slate-950/60 z-[2000] flex items-center justify-center p-4 hidden backdrop-blur-sm">
        <!-- The herald's question: tone set by ui/modals/base.js#showModal (default, danger, milestone). -->
        <div class="gcq-confirm pop-in" data-tone="default" role="alertdialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-message">
            <span class="gcq-confirm__glow" aria-hidden="true"></span>
            <div id="modal-icon-container" class="gcq-confirm__seal hidden" aria-hidden="true"></div>
            <h2 id="modal-title" class="gcq-confirm__title">Are you sure?</h2>
            <div id="modal-message" class="gcq-confirm__message">This action cannot be undone.</div>
            <div class="gcq-confirm__actions">
                <button id="modal-cancel-btn" type="button" class="gcq-confirm__btn gcq-confirm__btn--cancel bubbly-button">
                    Cancel
                </button>
                <button id="modal-confirm-btn" type="button" class="gcq-confirm__btn gcq-confirm__btn--ok bubbly-button">
                    Confirm
                </button>
            </div>
        </div>
    </div>

    <div id="league-picker-modal"
        class="lp-backdrop fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 hidden">
        <div class="league-picker-shell lp-shell pop-in w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="league-picker-title" aria-describedby="league-picker-subtitle">
            <!-- Header: a heraldic plaque with a gold-hemmed banner -->
            <header class="lp-head">
                <span class="lp-head__banner" aria-hidden="true"></span>
                <span class="lp-head__crest" aria-hidden="true">
                    <i class="fas fa-shield-halved lp-head__shield"></i>
                    <i class="fas fa-crown lp-head__crown"></i>
                </span>
                <div class="lp-head__titles">
                    <p class="lp-head__kicker">Quest Leagues</p>
                    <h2 id="league-picker-title" class="lp-head__title font-title">Choose a League</h2>
                    <p id="league-picker-subtitle" class="lp-head__sub">Classes race only against their own league. Pick whose race to watch.</p>
                </div>
                <button id="league-picker-close-btn" type="button" class="lp-close" aria-label="Close the league picker">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            </header>
            <div id="league-picker-list" class="lp-body flex-1 overflow-y-auto custom-scrollbar"></div>
        </div>
    </div>

    <div id="logo-picker-modal"
        class="logo-picker-backdrop fixed inset-0 z-[2400] flex items-center justify-center p-3 sm:p-4 hidden"
        role="dialog" aria-modal="true" aria-labelledby="logo-picker-title">
        <div class="logo-picker-shell pop-in w-full flex flex-col overflow-hidden">
            <div class="logo-picker-header">
                <div class="logo-picker-header__glow" aria-hidden="true"></div>
                <button type="button" id="logo-picker-close-btn"
                    class="logo-picker-close" aria-label="Close class logo picker">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
                <div class="logo-picker-intro">
                    <div class="logo-picker-medallion" aria-hidden="true">
                        <div id="logo-picker-preview" class="logo-picker-preview">📚</div>
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="logo-picker-kicker">Class emblem</p>
                        <h2 id="logo-picker-title" class="logo-picker-title">Choose a Class Logo</h2>
                        <p class="logo-picker-subtitle">Every emblem rests in the case. Browse a drawer or search by name, then tap one to pin it on your class.</p>
                    </div>
                </div>
                <label class="logo-picker-search-wrap" for="logo-picker-search">
                    <i class="fas fa-search" aria-hidden="true"></i>
                    <input type="text" id="logo-picker-search" placeholder="Search dragons, rockets, books..."
                        autocomplete="off" spellcheck="false" role="searchbox" enterkeyhint="search">
                </label>
                <div id="logo-picker-categories" class="logo-picker-chips" role="group" aria-label="Logo categories"></div>
            </div>
            <div class="logo-picker-tray">
                <div id="logo-picker-list" class="logo-picker-list"></div>
                <div id="logo-picker-empty" class="logo-picker-empty hidden">
                    <span aria-hidden="true">🔍</span>
                    <p>No emblems match that search.</p>
                    <p>Try another word, or open a different drawer above.</p>
                </div>
            </div>
        </div>
    </div>
`;
