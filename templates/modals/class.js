// templates/modals/class.js
// Edit class, logbook, history

export const classModalsHTML = `
    <div id="edit-class-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4 hidden overflow-y-auto">
        <form id="edit-class-form"
            class="bg-white p-8 rounded-3xl shadow-2xl max-w-lg w-full pop-in border-4 border-cyan-300 my-8">
            <h2 class="font-title text-3xl text-cyan-700 mb-6 text-center">Edit Class</h2>
            <input type="hidden" id="edit-class-id">

            <div class="space-y-4">
                <div>
                    <label for="edit-class-name" class="block text-sm font-medium text-gray-700">Class Name</label>
                    <input type="text" id="edit-class-name"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                        autocomplete="off" required>
                </div>
                <div>
                    <label for="edit-class-level" class="block text-sm font-medium text-gray-700">Quest Level</label>
                    <select id="edit-class-level"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                        required></select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Class Logo</label>
                    <button type="button" id="edit-logo-picker-btn"
                        class="bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 text-2xl bubbly-button"></button>
                    <input type="hidden" id="edit-class-logo">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Schedule Days</label>
                    <div id="edit-schedule-days" class="mt-2 flex flex-wrap gap-2"></div>
                </div>
                <div class="flex items-center gap-4">
                    <div>
                        <label for="edit-class-time-start" class="block text-sm font-medium text-gray-700">From</label>
                        <input type="time" id="edit-class-time-start"
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                    </div>
                    <div>
                        <label for="edit-class-time-end" class="block text-sm font-medium text-gray-700">To</label>
                        <input type="time" id="edit-class-time-end"
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500">
                    </div>
                </div>
            </div>

            <div class="flex gap-4 mt-6">
                <button type="button" id="edit-class-cancel-btn"
                    class="w-1/2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-3 rounded-xl bubbly-button">
                    Cancel
                </button>
                <button type="submit"
                    class="w-1/2 bg-cyan-500 hover:bg-cyan-600 text-white font-title text-lg py-3 rounded-xl bubbly-button">
                    Save Changes
                </button>
            </div>
        </form>
    </div>

    <div id="logbook-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[71] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-3xl w-full pop-in border-4 border-blue-300">
            <div class="flex justify-between items-center mb-4">
                <h2 id="logbook-modal-title" class="font-title text-2xl md:text-3xl text-blue-700">Daily Quest Log</h2>
                <button id="logbook-modal-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div id="logbook-modal-content" class="space-y-4 max-h-[70vh] overflow-y-auto pr-2"></div>
        </div>
    </div>

    <div id="history-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-4xl w-full pop-in border-4 border-amber-300">
            <div class="flex justify-between items-center mb-4">
                <h2 class="font-title text-2xl md:text-3xl text-amber-700">Historical Leaderboard</h2>
                <button id="history-modal-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div class="mb-4">
                <label for="history-month-select" class="block text-sm font-medium text-gray-700 mb-1">Select a past
                    month:</label>
                <select id="history-month-select"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                    <option value="">--Choose a month--</option>
                </select>
            </div>
            <div id="history-modal-content"
                class="space-y-4 max-h-[60vh] overflow-y-auto pr-2 bg-gray-50 p-4 rounded-lg">
                <p class="text-center text-gray-500">Select a month to view historical rankings.</p>
            </div>
        </div>
    </div>
`;
