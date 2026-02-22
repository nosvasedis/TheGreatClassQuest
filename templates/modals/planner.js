// templates/modals/planner.js
// Day planner modal

export const plannerModalHTML = `
    <div id="day-planner-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-lg w-full pop-in border-4 border-gray-300">
            <div class="flex justify-between items-center mb-4">
                <h2 id="day-planner-title" class="font-title text-3xl text-gray-700">Day Planner</h2>
                <button id="day-planner-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>

            <div class="border-b border-gray-200 mb-4">
                <nav id="day-planner-tabs" class="-mb-px flex space-x-6">
                    <button data-tab="schedule"
                        class="day-planner-tab-btn whitespace-nowrap py-3 px-1 border-b-4 font-semibold text-lg">
                        <i class="fas fa-calendar-day mr-2"></i>Schedule
                    </button>
                    <button data-tab="event"
                        class="day-planner-tab-btn whitespace-nowrap py-3 px-1 border-b-4 font-semibold text-lg">
                        <i class="fas fa-magic mr-2"></i>Quest Event
                    </button>
                </nav>
            </div>

            <div id="day-planner-content">
                <div id="day-planner-schedule-content" class="day-planner-tab-content">
                    <div id="schedule-manager-list" class="space-y-3 max-h-60 overflow-y-auto pr-2 mb-4"></div>
                    <div class="border-t pt-4">
                        <label for="add-onetime-lesson-select" class="block text-sm font-medium text-gray-700 mb-1">Add
                            a one-time lesson:</label>
                        <div class="flex gap-2">
                            <select id="add-onetime-lesson-select"
                                class="flex-grow mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500"></select>
                            <button id="add-onetime-lesson-btn"
                                class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md bubbly-button">Add</button>
                        </div>
                    </div>
                    <div class="border-t pt-4 mt-4 text-center">
                        <button id="day-planner-mark-holiday-btn" class="bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2 px-4 rounded-md border border-red-200 transition-colors shadow-sm w-full">
                            <i class="fas fa-umbrella-beach mr-2"></i>Mark as School Holiday (No Class)
                        </button>
                    </div>
                </div>

                <div id="day-planner-event-content" class="day-planner-tab-content hidden">
                    <form id="quest-event-form" class="space-y-4">
                        <input type="hidden" id="quest-event-date">
                        <div>
                            <label for="quest-event-type" class="block text-sm font-medium text-gray-700">Event
                                Type</label>
                            <select id="quest-event-type"
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-purple-500"
                                required>
                                <option value="" disabled selected>Select an event type...</option>
                                <optgroup label="Standard Events">
                                    <option value="2x Star Day">2x Star Day</option>
                                    <option value="Reason Bonus Day">Reason Bonus Day</option>
                                </optgroup>
                                <optgroup label="Special Quests">
                                    <option value="Vocabulary Vault"
                                        data-description="Challenge the class to use a set of new vocabulary words a target number of times.">
                                        Vocabulary Vault</option>
                                    <option value="The Unbroken Chain"
                                        data-description="Challenge each student to speak about a topic for a short time without hesitation or repetition.">
                                        The Unbroken Chain</option>
                                    <option value="Grammar Guardians"
                                        data-description="Present sentences with grammatical errors and have the class work together to 'rescue' them by finding the corrections.">
                                        Grammar Guardians</option>
                                    <option value="The Scribe's Sketch"
                                        data-description="Describe a scene piece by piece and have students draw what they hear to test listening comprehension.">
                                        The Scribe's Sketch</option>
                                    <option value="Five-Sentence Saga"
                                        data-description="Give the class three elements (a character, location, object) and challenge them to write a coherent five-sentence story.">
                                        Five-Sentence Saga</option>
                                </optgroup>
                            </select>
                        </div>
                        <div id="quest-event-description"
                            class="hidden text-sm text-gray-600 bg-purple-50 p-3 rounded-md border-l-4 border-purple-200">
                        </div>
                        <div id="quest-event-details-container" class="space-y-4"></div>
                        <button type="submit"
                            class="w-full bg-purple-500 hover:bg-purple-600 text-white font-title text-lg py-3 rounded-xl bubbly-button">
                            Add Event
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
`;
