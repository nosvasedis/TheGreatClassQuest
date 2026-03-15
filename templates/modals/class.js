// templates/modals/class.js
// Edit class, logbook, history

export const classModalsHTML = `
    <div id="create-class-modal"
        class="fixed inset-0 bg-black/65 backdrop-blur-sm z-[71] flex items-center justify-center p-4 hidden overflow-y-auto">
        <form id="add-class-form"
            class="bg-white p-6 md:p-8 rounded-[2rem] shadow-2xl max-w-2xl w-full pop-in border-[3px] border-green-300 my-8 relative overflow-hidden">
            <div class="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-emerald-500/10 via-green-400/10 to-lime-400/10 pointer-events-none"></div>
            <button type="button" id="create-class-close-btn"
                class="absolute top-4 right-4 w-10 h-10 rounded-full bg-green-50 hover:bg-green-100 text-green-800 text-2xl leading-none bubbly-button">&times;</button>

            <div class="relative">
                <div class="text-center mb-6">
                    <h2 class="font-title text-4xl text-green-700">Add New Class</h2>
                    <p class="text-gray-600 mt-2">Enter the class details below.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="md:col-span-2">
                        <label for="class-name" class="block text-sm font-medium text-gray-700">Class Name
                            (e.g., "The Star Seekers")</label>
                        <div class="flex items-center gap-2 mt-1">
                            <input type="text" id="class-name"
                                class="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                                autocomplete="off" required>
                            <button type="button" id="generate-class-name-btn"
                                class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl bubbly-button disabled:opacity-50"
                                title="Suggest names with AI">
                                <i class="fas fa-magic"></i>
                            </button>
                        </div>
                        <div id="class-name-suggestions" class="mt-2 flex flex-wrap gap-2"></div>
                    </div>
                    <div>
                        <label for="class-level" class="block text-sm font-medium text-gray-700">Quest Level
                            (League)</label>
                        <select id="class-level"
                            class="mt-1 block w-full px-4 py-3 border border-gray-300 bg-white rounded-xl shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                            required>
                            <option value="" disabled selected>Select a league...</option>
                            <option>Junior A</option>
                            <option>Junior B</option>
                            <option>A</option>
                            <option>B</option>
                            <option>C</option>
                            <option>D</option>
                        </select>
                    </div>
                    <div class="flex items-center gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Class Logo</label>
                            <button type="button" id="logo-picker-btn"
                                class="bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 text-2xl bubbly-button">
                                📚
                            </button>
                            <input type="hidden" id="class-logo" value="📚">
                        </div>
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-700">Schedule Days</label>
                        <div class="mt-2 flex flex-wrap gap-2">
                            <label class="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-full"><input
                                    type="checkbox" name="schedule-day" value="1"
                                    class="rounded text-green-600"> <span>Mon</span></label>
                            <label class="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-full"><input
                                    type="checkbox" name="schedule-day" value="2"
                                    class="rounded text-green-600"> <span>Tue</span></label>
                            <label class="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-full"><input
                                    type="checkbox" name="schedule-day" value="3"
                                    class="rounded text-green-600"> <span>Wed</span></label>
                            <label class="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-full"><input
                                    type="checkbox" name="schedule-day" value="4"
                                    class="rounded text-green-600"> <span>Thu</span></label>
                            <label class="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-full"><input
                                    type="checkbox" name="schedule-day" value="5"
                                    class="rounded text-green-600"> <span>Fri</span></label>
                            <label class="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-full"><input
                                    type="checkbox" name="schedule-day" value="6"
                                    class="rounded text-green-600"> <span>Sat</span></label>
                            <label class="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-full"><input
                                    type="checkbox" name="schedule-day" value="0"
                                    class="rounded text-green-600"> <span>Sun</span></label>
                        </div>
                    </div>
                    <div class="md:col-span-2 flex items-center gap-4">
                        <div class="flex-1">
                            <label for="class-time-start"
                                class="block text-sm font-medium text-gray-700">From</label>
                            <input type="time" id="class-time-start"
                                class="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500">
                        </div>
                        <div class="flex-1">
                            <label for="class-time-end"
                                class="block text-sm font-medium text-gray-700">To</label>
                            <input type="time" id="class-time-end"
                                class="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500">
                        </div>
                    </div>
                </div>

                <div class="flex flex-col-reverse sm:flex-row gap-3 mt-8">
                    <button type="button" id="create-class-cancel-btn"
                        class="w-full sm:w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-title text-lg py-3 rounded-xl bubbly-button">
                        Cancel
                    </button>
                    <button type="submit"
                        class="w-full sm:w-1/2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-title text-xl py-3 rounded-xl bubbly-button">
                        <i class="fas fa-plus-circle"></i> Create Class
                    </button>
                </div>
            </div>
        </form>
    </div>

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
