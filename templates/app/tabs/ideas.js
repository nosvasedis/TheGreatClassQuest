// templates/app/tabs/ideas.js

export const ideasTabHTML = `
            <div id="reward-ideas-tab" class="app-tab hidden">
                <div class="max-w-5xl mx-auto">
                    <div class="text-center mb-6">
                        <i class="fas fa-feather-alt text-cyan-500 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-cyan-700 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Story Weavers</h2>
                        <p class="text-lg text-gray-600 mt-2">Collaborative class storytelling with AI-powered word suggestions and illustrations.</p>
                    </div>
                    <div class="grid grid-cols-1 gap-8">
                        <div class="bg-white p-6 rounded-3xl shadow-lg border-4 border-cyan-300 space-y-4">
                            <div class="mb-2">
                                <label for="story-weavers-class-select"
                                    class="block text-sm font-medium text-gray-700 mb-1">Select class to play:</label>
                                <select id="story-weavers-class-select"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white">
                                    <option value="">Select a class...</option>
                                </select>
                            </div>

                            <div id="story-weavers-main-content" class="hidden flex flex-col">
                                <div class="flex flex-col items-center justify-center text-center">
                                    <div id="story-weavers-image-container">
                                        <img id="story-weavers-image" src="" alt="Story illustration"
                                            class="hidden pop-in">
                                        <div id="story-weavers-image-loader" class="text-gray-400 text-center hidden">
                                            <i class="fas fa-paint-brush fa-spin text-3xl"></i>
                                            <p class="text-sm mt-2">The Chronicler is illustrating...</p>
                                        </div>
                                        <div id="story-weavers-image-placeholder" class="text-gray-400 text-center">
                                            <i class="fas fa-book-reader text-4xl"></i>
                                            <p class="text-sm mt-2">The story awaits its illustration!</p>
                                        </div>
                                    </div>
                                    <p id="story-weavers-text" class="w-full p-2 max-h-28 overflow-y-auto"></p>
                                    <button id="story-weavers-reveal-btn"
                                        class="mt-2 text-sm text-cyan-600 hover:underline"><i class="fas fa-eye"></i>
                                        Reveal Story to Class</button>
                                </div>

                                <div class="mt-4 pt-4 border-t-2 border-gray-200">
                                    <h3 class="font-bold text-gray-600 text-center mb-2">Game Master's Desk</h3>
                                    <div class="flex items-center gap-2 mb-3">
                                        <input type="text" id="story-weavers-word-input"
                                            class="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm transition-colors"
                                            placeholder="Today's Word of the Day..." autocomplete="off">
                                        <button id="story-weavers-confirm-word-btn"
                                            class="bg-green-200 text-green-700 w-10 h-10 rounded-full bubbly-button flex-shrink-0 hidden"
                                            title="Lock in word"><i class="fas fa-check"></i></button>
                                        <button id="story-weavers-clear-word-btn"
                                            class="bg-red-200 text-red-700 w-10 h-10 rounded-full bubbly-button flex-shrink-0 hidden"
                                            title="Clear word"><i class="fas fa-times"></i></button>
                                        <button id="story-weavers-suggest-word-btn"
                                            class="bg-indigo-200 text-indigo-700 w-10 h-10 rounded-full bubbly-button flex-shrink-0"
                                            title="Suggest a word with AI"><i class="fas fa-magic"></i></button>
                                    </div>
                                    <div class="flex gap-2">
                                        <button id="story-weavers-lock-in-btn"
                                            class="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-title text-lg py-2 rounded-xl bubbly-button disabled:opacity-50 disabled:cursor-not-allowed">
                                            Continue...
                                        </button>
                                        <button id="story-weavers-end-btn"
                                            class="w-full bg-rose-500 hover:bg-rose-600 text-white font-title text-lg py-2 rounded-xl bubbly-button disabled:opacity-50">
                                            The End
                                        </button>
                                    </div>
                                    <div class="flex justify-between mt-3">
                                        <button id="story-weavers-history-btn"
                                            class="text-sm text-gray-500 hover:underline"><i class="fas fa-scroll"></i>
                                            Current Story</button>
                                        <button id="story-weavers-archive-btn"
                                            class="text-sm text-indigo-500 hover:underline"><i
                                                class="fas fa-book-dead"></i> Story Archive</button>
                                        <button id="story-weavers-reset-btn"
                                            class="text-sm text-red-500 hover:underline"><i class="fas fa-undo"></i>
                                            Start New</button>
                                    </div>
                                </div>
                            </div>
                            <div id="story-weavers-placeholder" class="flex items-center justify-center py-8">
                                <p class="text-center text-gray-500">Select a class to begin your chronicle!</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
`;
