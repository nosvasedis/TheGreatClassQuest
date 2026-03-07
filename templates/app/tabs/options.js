// templates/app/tabs/options.js

export const optionsTabHTML = `
            <div id="options-tab" class="app-tab hidden">
                <div class="max-w-4xl mx-auto">
                    <div class="text-center mb-8">
                        <i class="fas fa-cog text-gray-600 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-gray-700 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Options & Settings</h2>
                        <p class="text-lg text-gray-600 mt-2">Manage your profile and access advanced tools.</p>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                        <div class="lg:col-span-3 flex flex-col gap-8">

                            <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-amber-300 space-y-6">
                                <h2 class="font-title text-3xl text-amber-700 mb-2 text-center">Student Star Manager
                                </h2>
                                <div id="star-manager-form" class="space-y-4">
                                    <div>
                                        <label for="star-manager-student-select"
                                            class="block text-sm font-medium text-gray-700 mb-1">Select Student</label>
                                        <select id="star-manager-student-select"
                                            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                                            <option value="">Loading students...</option>
                                        </select>
                                    </div>
                                    <div class="p-4 bg-amber-50 rounded-xl border border-amber-200">
                                        <h3 class="font-title text-xl text-amber-800 mb-2 text-center">Add Historical
                                            Award</h3>
                                        <div class="grid grid-cols-2 gap-4">
                                            <div>
                                                <label for="star-manager-date"
                                                    class="block text-sm font-medium text-gray-700">Award Date</label>
                                                <input type="date" id="star-manager-date"
                                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500"
                                                    disabled>
                                            </div>
                                            <div>
                                                <label for="star-manager-stars-to-add"
                                                    class="block text-sm font-medium text-gray-700">Stars to Add</label>
                                                <input type="number" id="star-manager-stars-to-add"
                                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500"
                                                    min="0.5" step="0.5" max="10" value="1" disabled>
                                            </div>
                                        </div>
                                        <div>
                                            <label for="star-manager-reason"
                                                class="block text-sm font-medium text-gray-700 mt-2">Reason</label>
                                            <select id="star-manager-reason"
                                                class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-amber-500"
                                                disabled>
                                                <option value="teamwork">Teamwork</option>
                                                <option value="creativity">Creativity</option>
                                                <option value="respect">Respect</option>
                                                <option value="focus">Focus/Effort</option>
                                                <option value="welcome_back">Welcome Back Bonus</option>
                                                <option value="correction">Manual Correction</option>
                                            </select>
                                        </div>
                                        <button id="star-manager-add-btn"
                                            class="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-white font-title text-lg py-2 rounded-xl bubbly-button"
                                            disabled>
                                            <i class="fas fa-plus-circle mr-2"></i> Add Stars to Log
                                        </button>
                                    </div>
                                    <div class="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                        <h3 class="font-title text-xl text-blue-800 mb-2 text-center">Direct Score
                                            Override</h3>
                                        <p class="text-xs text-gray-600 text-center mb-3">Manually set the star
                                            counters. This does NOT create a log entry.</p>
                                        <div id="star-override-form" class="grid grid-cols-3 gap-4 mb-4">
                                            <div>
                                                <label for="override-today-stars"
                                                    class="block text-sm font-medium text-gray-700">Today</label>
                                                <input type="number" id="override-today-stars"
                                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    min="0" value="0" disabled>
                                            </div>
                                            <div>
                                                <label for="override-monthly-stars"
                                                    class="block text-sm font-medium text-gray-700">Monthly</label>
                                                <input type="number" id="override-monthly-stars"
                                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    min="0" value="0" disabled>
                                            </div>
                                            <div>
                                                <label for="override-total-stars"
                                                    class="block text-sm font-medium text-gray-700">Total</label>
                                                <input type="number" id="override-total-stars"
                                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    min="0" value="0" disabled>
                                            </div>
                                        </div>
                                        <button id="star-manager-override-btn"
                                            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-title text-lg py-2 rounded-xl bubbly-button"
                                            disabled>
                                            <i class="fas fa-wrench mr-2"></i> Set Student Scores
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-yellow-400 space-y-6">
                                <div class="text-center">
                                    <div class="text-4xl mb-2">💰</div>
                                    <h2 class="font-title text-3xl text-yellow-700">Coin Purse Manager</h2>
                                    <p class="text-sm text-gray-500">Fix balances or reward custom gold amounts.</p>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="md:col-span-2">
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Select
                                            Student</label>
                                        <select id="economy-student-select"
                                            class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white">
                                            <option value="">Loading...</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Current Gold</label>
                                        <div class="relative">
                                            <input type="number" id="economy-gold-input"
                                                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 font-bold text-lg text-yellow-600"
                                                placeholder="0">
                                            <div class="absolute right-4 top-3 text-yellow-500">🪙</div>
                                        </div>
                                    </div>

                                    <div class="flex items-end">
                                        <button id="save-gold-btn"
                                            class="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-title text-lg py-3 rounded-xl bubbly-button disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled>
                                            <i class="fas fa-save mr-2"></i> Update Balance
                                        </button>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div class="lg:col-span-2 flex flex-col gap-8">
                            <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-pink-300 space-y-4">
                                <h2 class="font-title text-3xl text-pink-700 text-center">School Year Planner</h2>
                                <p class="text-sm text-gray-500 text-center">Set school-wide holidays (Christmas,
                                    Easter) to overshadow the calendar.</p>

                                <div class="grid grid-cols-2 gap-2">
                                    <div class="col-span-2">
                                        <label class="block text-xs font-bold text-gray-500">Holiday Name</label>
                                        <input type="text" id="holiday-name" placeholder="e.g. Christmas Break"
                                            class="w-full px-3 py-2 border rounded-lg">
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold text-gray-500">Start Date</label>
                                        <input type="date" id="holiday-start"
                                            class="w-full px-3 py-2 border rounded-lg">
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold text-gray-500">End Date</label>
                                        <input type="date" id="holiday-end" class="w-full px-3 py-2 border rounded-lg">
                                    </div>
                                    <div class="col-span-2">
                                        <label class="block text-xs font-bold text-gray-500">Theme</label>
                                        <select id="holiday-type" class="w-full px-3 py-2 border rounded-lg bg-white">
                                            <option value="christmas">🎄 Christmas / Winter</option>
                                            <option value="easter">🐣 Easter / Spring</option>
                                            <option value="generic">📅 Generic / Other</option>
                                        </select>
                                    </div>
                                </div>
                                <button id="add-holiday-btn"
                                    class="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 rounded-xl bubbly-button">
                                    <i class="fas fa-plus-circle mr-2"></i> Add Break
                                </button>

                                <div id="holiday-list" class="mt-4 space-y-2 max-h-40 overflow-y-auto"></div>
                            </div>
                            
                            <!-- Class End Dates Configuration -->
                            <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-purple-300 space-y-4">
                                <h2 class="font-title text-3xl text-purple-700 text-center">Class End Dates</h2>
                                <p class="text-sm text-gray-500 text-center">Set the last lesson date for each class. The Grand Guild Ceremony will activate on these dates.</p>

                                <div id="class-end-dates-list" class="space-y-3 max-h-60 overflow-y-auto">
                                    <!-- Class end dates will be populated here by JavaScript -->
                                </div>
                                
                                <button id="save-class-end-dates-btn"
                                    class="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 rounded-xl bubbly-button">
                                    <i class="fas fa-save mr-2"></i> Save End Dates
                                </button>
                            </div>
                            <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-blue-300 space-y-4">
                                <h2 class="font-title text-3xl text-blue-700 text-center">Profile Settings</h2>
                                <div>
                                    <label for="teacher-name-input"
                                        class="block text-sm font-medium text-gray-700 mb-1">Your Display Name</label>
                                    <input type="text" id="teacher-name-input"
                                        class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autocomplete="off">
                                </div>
                                <button id="save-teacher-name-btn"
                                    class="w-full bg-blue-600 hover:bg-blue-700 text-white font-title text-xl py-3 rounded-xl bubbly-button flex items-center justify-center">
                                    <i class="fas fa-save mr-2"></i> Save Name
                                </button>
                            </div>

                            <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-red-300 space-y-4">
                                <h2 class="font-title text-3xl text-red-700 text-center">Danger Zone</h2>
                                <div class="space-y-4">
                                    <p class="text-sm text-gray-600 text-center">These actions are permanent and can
                                        result in data loss. Proceed with caution.</p>
                                    <button id="star-manager-purge-btn"
                                        class="w-full bg-red-600 hover:bg-red-700 text-white font-title text-lg py-2 rounded-xl bubbly-button"
                                        disabled>
                                        <i class="fas fa-exclamation-triangle mr-2"></i> Purge Student Score Data
                                    </button>
                                    <button id="erase-today-btn"
                                        class="w-full bg-orange-500 hover:bg-orange-600 text-white font-title text-lg py-2 rounded-xl bubbly-button">
                                        <i class="fas fa-undo mr-2"></i> Erase Today's Stars
                                    </button>
                                    <button id="purge-logs-btn"
                                        class="w-full bg-red-800 hover:bg-red-900 text-white font-title text-lg py-2 rounded-xl bubbly-button">
                                        <i class="fas fa-fire mr-2"></i> Purge All My Award Logs
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
`;
