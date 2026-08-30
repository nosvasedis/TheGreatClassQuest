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
        class="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4 hidden">
        <div class="league-picker-shell bg-white p-5 sm:p-8 rounded-3xl shadow-2xl max-w-5xl w-full pop-in border-4 border-amber-300 max-h-[92vh] overflow-y-auto">
            <div class="league-picker-heading" aria-hidden="true">
                <i class="fas fa-star"></i><i class="fas fa-crown"></i><i class="fas fa-star"></i>
            </div>
            <h2 class="font-title text-3xl text-amber-700 mb-1 text-center">Choose a League</h2>
            <p class="league-picker-subtitle">Every path has its own kind of magic.</p>
            <div id="league-picker-list" class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"></div>
            <button id="league-picker-close-btn"
                class="w-full mt-6 bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-2 rounded-xl bubbly-button">
                Close
            </button>
        </div>
    </div>

    <div id="logo-picker-modal"
        class="fixed inset-0 bg-slate-950/55 z-[90] flex items-center justify-center p-3 sm:p-4 hidden backdrop-blur-sm"
        role="dialog" aria-modal="true" aria-labelledby="logo-picker-title">
        <div class="logo-picker-shell pop-in max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div class="logo-picker-header">
                <div class="logo-picker-header__glow" aria-hidden="true"></div>
                <button type="button" id="logo-picker-close-btn"
                    class="logo-picker-close bubbly-button" aria-label="Close class logo picker">
                    <i class="fas fa-times"></i>
                </button>
                <div class="flex items-start gap-4">
                    <div id="logo-picker-preview" class="logo-picker-preview" aria-hidden="true">📚</div>
                    <div class="min-w-0 flex-1">
                        <p class="logo-picker-kicker">Class emblem</p>
                        <h2 id="logo-picker-title" class="font-title text-3xl sm:text-4xl text-emerald-900 leading-tight">Choose a Class Logo</h2>
                        <p class="logo-picker-subtitle">Browse by theme, or search by name. One tap sets the emblem.</p>
                    </div>
                </div>
                <label class="logo-picker-search-wrap" for="logo-picker-search">
                    <i class="fas fa-search" aria-hidden="true"></i>
                    <input type="text" id="logo-picker-search" placeholder="Search dragons, rockets, books..."
                        autocomplete="off" spellcheck="false" role="searchbox" enterkeyhint="search">
            <span id="logo-picker-count" class="logo-picker-count" aria-live="polite">0</span>
                </label>
                <div id="logo-picker-categories" class="logo-picker-chips" role="group" aria-label="Logo categories"></div>
            </div>
            <div id="logo-picker-list" class="logo-picker-list custom-scrollbar"></div>
            <div id="logo-picker-empty" class="logo-picker-empty hidden">
                <span aria-hidden="true">🔍</span>
                <p>No emblems match that search.</p>
                <p>Try another word, or pick a category above.</p>
            </div>
        </div>
    </div>
`;
