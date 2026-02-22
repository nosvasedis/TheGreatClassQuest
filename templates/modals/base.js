// templates/modals/base.js
// Confirmation, league picker, logo picker

export const baseModalsHTML = `
    <div id="confirmation-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full pop-in border-4 border-red-300">
            <h2 id="modal-title" class="font-title text-2xl text-red-700 mb-4 text-center">Are you sure?</h2>
            <p id="modal-message" class="text-center text-gray-700 mb-6">This action cannot be undone.</p>
            <div class="flex justify-around">
                <button id="modal-cancel-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-2 px-8 rounded-xl bubbly-button">
                    Cancel
                </button>
                <button id="modal-confirm-btn"
                    class="bg-red-500 hover:bg-red-600 text-white font-title text-lg py-2 px-8 rounded-xl bubbly-button">
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
        class="fixed inset-0 bg-black bg-opacity-50 z-[71] flex items-center justify-center p-4 hidden">
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
