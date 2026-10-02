// templates/modals/base.js
// Confirmation, league picker, logo picker

export const baseModalsHTML = `
    <div id="confirmation-modal"
        class="fixed inset-0 bg-slate-950/60 z-[2000] flex items-center justify-center p-4 hidden backdrop-blur-sm">
        <div class="bg-white/95 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full pop-in border-4 border-indigo-100 flex flex-col items-center text-center relative overflow-hidden">
            <div class="absolute -top-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
            <div class="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-50 rounded-full blur-3xl opacity-50"></div>
            
            <div id="modal-icon-container" class="w-20 h-20 bg-gradient-to-br from-indigo-50 to-white rounded-3xl flex items-center justify-center text-5xl mb-6 shadow-inner border-2 border-indigo-100/50 relative z-10 animate-float hidden"></div>
            
            <h2 id="modal-title" class="font-title text-3xl text-indigo-900 mb-3 relative z-10 drop-shadow-sm">Are you sure?</h2>
            <p id="modal-message" class="text-indigo-600/80 font-title font-normal text-lg mb-8 relative z-10 leading-relaxed italic">This action cannot be undone.</p>
            
            <div class="flex flex-col sm:flex-row justify-center gap-3 w-full relative z-10">
                <button id="modal-cancel-btn"
                    class="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-title text-lg py-3 px-6 rounded-2xl bubbly-button transition-all border-b-4 border-slate-200 active:border-b-0">
                    Cancel
                </button>
                <button id="modal-confirm-btn"
                    class="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-title text-lg py-3 px-6 rounded-2xl shadow-lg shadow-indigo-100 transition-all active:scale-95 border-b-4 border-indigo-800 active:border-b-0">
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
