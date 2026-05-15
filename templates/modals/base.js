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
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full pop-in border-4 border-amber-300">
            <h2 class="font-title text-3xl text-amber-700 mb-6 text-center">Choose a League</h2>
            <div id="league-picker-list" class="grid grid-cols-2 gap-4"></div>
            <button id="league-picker-close-btn"
                class="w-full mt-6 bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-2 rounded-xl bubbly-button">
                Close
            </button>
        </div>
    </div>

    <div id="logo-picker-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[90] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-3xl w-full pop-in border-4 border-green-300">
            <h2 class="font-title text-3xl text-green-700 mb-6 text-center">Choose a Class Logo</h2>
            <div id="logo-picker-list" class="grid grid-cols-10 gap-4 text-3xl max-h-72 overflow-y-auto p-2"></div>
            <button id="logo-picker-close-btn"
                class="w-full mt-6 bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-2 rounded-xl bubbly-button">
                Close
            </button>
        </div>
    </div>
`;
