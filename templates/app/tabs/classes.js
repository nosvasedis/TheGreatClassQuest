// templates/app/tabs/classes.js

export const classesTabHTML = `
            <div id="my-classes-tab" class="app-tab hidden">
                <div class="max-w-4xl mx-auto">
                    <div class="text-center mb-6">
                        <i class="fas fa-chalkboard-teacher text-green-600 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-green-700 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">My Classes</h2>
                        <p class="text-lg text-gray-600 mt-2">Create new classes and manage your student rosters.</p>
                    </div>
                    <form id="add-class-form" class="bg-white p-6 rounded-3xl shadow-lg border-4 border-green-300 mb-6">
                        <h2 class="font-title text-3xl text-green-700 mb-4 text-center">Create a New Class</h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="md:col-span-2">
                                <label for="class-name" class="block text-sm font-medium text-gray-700">Class Name
                                    (e.g., "The Star Seekers")</label>
                                <div class="flex items-center gap-2 mt-1">
                                    <input type="text" id="class-name"
                                        class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                                        autocomplete="off" required>
                                    <button type="button" id="generate-class-name-btn"
                                        class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-md bubbly-button disabled:opacity-50"
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
                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
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
                                        class="bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 text-2xl bubbly-button">
                                        📚
                                    </button>
                                    <input type="hidden" id="class-logo" value="📚">
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700">Schedule Days</label>
                                <div class="mt-2 flex flex-wrap gap-2">
                                    <label class="flex items-center space-x-2 bg-gray-50 px-3 py-1 rounded-full"><input
                                            type="checkbox" name="schedule-day" value="1"
                                            class="rounded text-green-600"> <span>Mon</span></label>
                                    <label class="flex items-center space-x-2 bg-gray-50 px-3 py-1 rounded-full"><input
                                            type="checkbox" name="schedule-day" value="2"
                                            class="rounded text-green-600"> <span>Tue</span></label>
                                    <label class="flex items-center space-x-2 bg-gray-50 px-3 py-1 rounded-full"><input
                                            type="checkbox" name="schedule-day" value="3"
                                            class="rounded text-green-600"> <span>Wed</span></label>
                                    <label class="flex items-center space-x-2 bg-gray-50 px-3 py-1 rounded-full"><input
                                            type="checkbox" name="schedule-day" value="4"
                                            class="rounded text-green-600"> <span>Thu</span></label>
                                    <label class="flex items-center space-x-2 bg-gray-50 px-3 py-1 rounded-full"><input
                                            type="checkbox" name="schedule-day" value="5"
                                            class="rounded text-green-600"> <span>Fri</span></label>
                                    <label class="flex items-center space-x-2 bg-gray-50 px-3 py-1 rounded-full"><input
                                            type="checkbox" name="schedule-day" value="6"
                                            class="rounded text-green-600"> <span>Sat</span></label>
                                    <label class="flex items-center space-x-2 bg-gray-50 px-3 py-1 rounded-full"><input
                                            type="checkbox" name="schedule-day" value="0"
                                            class="rounded text-green-600"> <span>Sun</span></label>
                                </div>
                            </div>
                            <div class="flex items-center gap-4">
                                <div>
                                    <label for="class-time-start"
                                        class="block text-sm font-medium text-gray-700">From</label>
                                    <input type="time" id="class-time-start"
                                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500">
                                </div>
                                <div>
                                    <label for="class-time-end"
                                        class="block text-sm font-medium text-gray-700">To</label>
                                    <input type="time" id="class-time-end"
                                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500">
                                </div>
                            </div>
                        </div>
                        <button type="submit"
                            class="w-full mt-6 bg-green-500 hover:bg-green-600 text-white font-title text-xl py-3 rounded-xl bubbly-button">
                            <i class="fas fa-plus-circle"></i> Create Class
                        </button>
                    </form>
                    <div id="class-list" class="space-y-4"></div>
                </div>
            </div>
`;
