// templates/modals/ai.js
// App info, story reveal, story history, story archive, storybook viewer, story input

export const aiModalsHTML = `
    <div id="app-info-modal"
        class="fixed inset-0 bg-black bg-opacity-60 z-[95] flex items-center justify-center p-4 hidden backdrop-blur-sm">
        <div
            class="bg-white p-0 rounded-3xl shadow-2xl max-w-5xl w-full h-[85vh] pop-in border-4 border-cyan-300 flex flex-col overflow-hidden relative">
            <button id="app-info-close-btn"
                class="absolute top-4 right-4 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-500 font-bold w-10 h-10 rounded-full bubbly-button z-50 transition-colors">&times;</button>

            <div class="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 text-white text-center shadow-md z-10">
                <h2 class="font-title text-4xl mb-1 text-shadow-md"><i class="fas fa-book-open mr-3"></i>The
                    Adventurer's Guide</h2>
                <p class="opacity-90 font-semibold">Mastering the Great Class Quest</p>
            </div>

            <div class="bg-gray-100 p-3 flex justify-center gap-4 shadow-inner z-10">
                <button id="info-btn-students" class="info-tab-switcher bg-cyan-500 text-white shadow-md active">
                    <i class="fas fa-user-graduate mr-2"></i> For Students
                </button>
                <button id="info-btn-teachers" class="info-tab-switcher bg-white text-green-700">
                    <i class="fas fa-chalkboard-teacher mr-2"></i> For Teachers
                </button>
            </div>

            <div class="flex-grow overflow-y-auto p-8 bg-slate-50 custom-scrollbar relative">
                <div id="info-content-students" class="info-section space-y-8 relative z-10">
                </div>

                <div id="info-content-teachers" class="info-section hidden space-y-8 relative z-10">
                </div>
            </div>
        </div>
    </div>

    <div id="story-reveal-modal"
        class="fixed inset-0 bg-black bg-opacity-70 z-[71] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-4xl w-full pop-in relative">
            <button id="story-reveal-close-btn"
                class="absolute top-4 right-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            <p id="story-reveal-text" class="text-4xl md:text-5xl text-center leading-relaxed font-serif text-gray-800">
            </p>
        </div>
    </div>

    <div id="story-history-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[71] flex items-center justify-center p-4 hidden">
        <div
            class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-5xl w-full pop-in border-4 border-cyan-300 flex flex-col">
            <div class="flex justify-between items-center mb-4">
                <h2 id="story-history-title" class="font-title text-2xl md:text-3xl text-cyan-700">Story Chronicle</h2>
                <button id="story-history-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div id="story-history-content" class="space-y-4 max-h-[60vh] overflow-y-auto pr-2 flex-grow"></div>
        </div>
    </div>

    <div id="story-archive-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[71] flex items-center justify-center p-4 hidden">
        <div
            class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-3xl w-full pop-in border-4 border-indigo-300 flex flex-col">
            <div class="flex justify-between items-center mb-4">
                <h2 class="font-title text-2xl md:text-3xl text-indigo-700">Completed Storybook Archive</h2>
                <button id="story-archive-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div id="story-archive-list"
                class="space-y-3 max-h-[60vh] overflow-y-auto p-2 flex-grow bg-gray-50 rounded-lg"></div>
        </div>
    </div>

    <div id="storybook-viewer-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div
            class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-5xl w-full pop-in border-4 border-purple-300 flex flex-col">
            <div class="flex justify-between items-start mb-4">
                <div class="flex-grow">
                    <h2 id="storybook-viewer-title" class="font-title text-2xl md:text-3xl text-purple-700"></h2>
                    <p id="storybook-viewer-subtitle" class="text-sm text-gray-500 -mt-1"></p>
                </div>
                <button id="storybook-viewer-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button flex-shrink-0">&times;</button>
            </div>
            <div id="storybook-viewer-content"
                class="space-y-4 max-h-[60vh] overflow-y-auto pr-2 flex-grow bg-gray-50 p-4 rounded-lg"></div>
            <div class="flex gap-2 mt-4">
                <button id="storybook-viewer-play-btn"
                    class="w-full bg-amber-500 hover:bg-amber-600 text-white font-title text-lg py-3 rounded-xl bubbly-button">
                    <i class="fas fa-play-circle mr-2"></i> Narrate Story
                </button>
                <button id="storybook-viewer-print-btn"
                    class="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-title text-lg py-3 rounded-xl bubbly-button">
                    <i class="fas fa-print mr-2"></i> Print Storybook
                </button>
                <button id="storybook-viewer-delete-btn"
                    class="bg-red-500 hover:bg-red-600 text-white font-title text-lg py-3 px-5 rounded-xl bubbly-button">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    </div>

    <div id="story-input-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-lg w-full pop-in border-4 border-cyan-300">
            <h2 class="font-title text-2xl text-cyan-700 mb-4 text-center">Continue the Chronicle</h2>
            <div class="mb-4">
                <label for="story-input-textarea" class="block text-sm font-medium text-gray-700">Enter the new,
                    complete story sentence:</label>
                <textarea id="story-input-textarea" rows="5"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"></textarea>
            </div>
            <div class="flex justify-around gap-4 mt-6">
                <button id="story-input-cancel-btn"
                    class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-2 px-8 rounded-xl bubbly-button">Cancel</button>
                <button id="story-input-confirm-btn"
                    class="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-title text-lg py-2 px-8 rounded-xl bubbly-button">Save
                    Sentence</button>
            </div>
        </div>
    </div>
`;
