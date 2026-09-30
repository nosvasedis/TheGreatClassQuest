// templates/modals/ai.js
// App info, story reveal, story history, story archive, storybook viewer, story input

export const aiModalsHTML = `
    <div id="app-info-modal" class="ag-overlay fixed inset-0 z-[95] hidden" role="dialog" aria-modal="true" aria-labelledby="ag-title">
        <div class="ag-book pop-in">
            <header class="ag-cover">
                <svg class="ag-compass" viewBox="0 0 64 64" aria-hidden="true">
                    <circle cx="32" cy="32" r="29" class="ag-compass__rim"/>
                    <circle cx="32" cy="32" r="24.5" class="ag-compass__face"/>
                    <path class="ag-compass__rose" d="M32 9 35 29 55 32 35 35 32 55 29 35 9 32 29 29Z"/>
                    <path class="ag-compass__rose ag-compass__rose--small" d="M32 20 33.6 30.4 44 32 33.6 33.6 32 44 30.4 33.6 20 32 30.4 30.4Z" transform="rotate(45 32 32)"/>
                    <g class="ag-compass__needle">
                        <path d="M32 12 36 32H28Z" class="ag-compass__north"/>
                        <path d="M32 52 28 32H36Z" class="ag-compass__south"/>
                        <circle cx="32" cy="32" r="2.6" class="ag-compass__pin"/>
                    </g>
                </svg>
                <div class="ag-cover__text">
                    <h2 id="ag-title" class="ag-cover__title">The Adventurer's Guide</h2>
                    <p id="ag-cover-sub" class="ag-cover__sub">A field guide to The Great Class Quest</p>
                </div>
                <div id="ag-plan-stamp" class="ag-stamp"></div>
                <button type="button" id="app-info-close-btn" class="ag-close" aria-label="Close the guide">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            </header>

            <div class="ag-toolbar">
                <div class="ag-audience" role="group" aria-label="Who is reading">
                    <button type="button" class="ag-audience__btn is-active" data-ag-audience="teacher" aria-pressed="true">
                        <i class="fas fa-chalkboard-user" aria-hidden="true"></i> Quest Master
                    </button>
                    <button type="button" class="ag-audience__btn" data-ag-audience="class" aria-pressed="false">
                        <i class="fas fa-children" aria-hidden="true"></i> For the class
                    </button>
                </div>
                <div class="ag-search">
                    <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
                    <input type="search" id="ag-search-input" placeholder="Search the guide" aria-label="Search the guide" autocomplete="off" enterkeyhint="search">
                    <button type="button" id="ag-search-clear" class="ag-search__clear" aria-label="Clear the search" hidden>
                        <i class="fas fa-xmark" aria-hidden="true"></i>
                    </button>
                </div>
            </div>

            <div class="ag-body">
                <nav id="ag-index" class="ag-index" aria-label="Chapters"></nav>
                <div id="ag-page" class="ag-page" tabindex="-1"></div>
            </div>
        </div>
    </div>

    <div id="story-reveal-modal"
        class="fixed inset-0 bg-black bg-opacity-70 z-[71] flex items-center justify-center p-4 hidden">
        <div class="sw-reveal pop-in relative">
            <button id="story-reveal-close-btn"
                class="premium-close-btn absolute top-4 right-4 z-10 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            <div class="sw-reveal-book">
                <div id="story-reveal-art" class="sw-reveal-art hidden">
                    <img id="story-reveal-image" src="" alt="Story illustration" decoding="async">
                </div>
                <div class="sw-reveal-page">
                    <p id="story-reveal-text" class="sw-reveal-text"></p>
                    <p id="story-reveal-word" class="sw-reveal-word hidden"></p>
                </div>
            </div>
            <div id="story-reveal-prompts" class="sw-reveal-prompts hidden" aria-live="polite">
                <div class="sw-reveal-prompts-head">
                    <p class="sw-reveal-prompts-title"><i class="fas fa-comments" aria-hidden="true"></i> Let's talk about it</p>
                    <button type="button" id="story-reveal-prompts-shuffle" class="sw-reveal-prompts-shuffle" title="Show different questions">
                        <i class="fas fa-shuffle" aria-hidden="true"></i> New questions
                    </button>
                </div>
                <div id="story-reveal-prompts-list" class="sw-reveal-prompts-list"></div>
            </div>
        </div>
    </div>

    <div id="story-history-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[71] flex items-center justify-center p-4 hidden">
        <div
            class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-5xl w-full pop-in border-4 border-cyan-300 flex flex-col">
            <div class="flex justify-between items-center mb-4">
                <h2 id="story-history-title" class="font-title text-2xl md:text-3xl text-cyan-700">Story Chronicle</h2>
                <button id="story-history-close-btn"
                    class="premium-close-btn bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div id="story-history-content" class="story-weavers-chapter-grid max-h-[60vh] overflow-y-auto pr-2 flex-grow"></div>
        </div>
    </div>

    <div id="story-archive-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[71] flex items-center justify-center p-4 hidden">
        <div
            class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-3xl w-full pop-in border-4 border-indigo-300 flex flex-col">
            <div class="flex justify-between items-center mb-4">
                <h2 class="font-title text-2xl md:text-3xl text-indigo-700">Completed Storybook Archive</h2>
                <button id="story-archive-close-btn"
                    class="premium-close-btn bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div>
                    <label for="story-archive-search" class="block text-sm font-semibold text-slate-700">Search</label>
                    <input id="story-archive-search" type="search"
                        class="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                        placeholder="Title or class…" autocomplete="off">
                </div>
                <div>
                    <label for="story-archive-sort" class="block text-sm font-semibold text-slate-700">Sort</label>
                    <select id="story-archive-sort"
                        class="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                        aria-label="Sort storybooks">
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="title">Title A–Z</option>
                    </select>
                </div>
            </div>
            <div id="story-archive-list"
                class="story-weavers-archive-grid max-h-[60vh] overflow-y-auto p-2 flex-grow bg-gray-50 rounded-2xl"></div>
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
                    class="premium-close-btn bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button flex-shrink-0">&times;</button>
            </div>
            <div id="storybook-viewer-content"
                class="story-weavers-chapter-grid max-h-[60vh] overflow-y-auto pr-2 flex-grow bg-gray-50 p-4 rounded-2xl"></div>
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
        class="fixed inset-0 bg-slate-950/60 z-[1200] flex items-center justify-center p-4 hidden backdrop-blur-sm">
        <div class="bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-2xl max-w-lg w-full pop-in border-4 border-cyan-200/50 flex flex-col overflow-hidden relative">
            <div class="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 text-center relative overflow-hidden">
                <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none"></div>
                <div class="relative z-10">
                    <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner border border-white/30 animate-float">📖</div>
                    <h2 class="font-title text-3xl text-white drop-shadow-md leading-tight">Continue the Chronicle</h2>
                    <p class="text-cyan-100 font-title text-sm mt-1 opacity-90">✨ Weave the next chapter of your adventure ✨</p>
                </div>
            </div>

            <div class="p-8">
                <div id="story-input-helpers" class="sw-input-helpers"></div>
                <div class="mb-6">
                    <label for="story-input-textarea" class="block text-sm font-black text-cyan-800 uppercase tracking-widest mb-2 ml-1">The Next Sentence</label>
                    <textarea id="story-input-textarea" rows="5"
                        class="mt-1 block w-full px-5 py-4 bg-cyan-50/30 border-2 border-cyan-100 rounded-2xl shadow-inner focus:outline-none focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-400 transition-all font-serif text-lg text-slate-700 leading-relaxed"
                        placeholder="Once upon a time..."></textarea>
                </div>
                <div class="flex flex-col sm:flex-row justify-around gap-4 mt-2">
                    <button id="story-input-cancel-btn"
                        class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-title text-lg py-3 px-8 rounded-2xl bubbly-button transition-all border-b-4 border-slate-300 active:border-b-0">Cancel</button>
                    <button id="story-input-confirm-btn"
                        class="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-title text-lg py-3 px-8 rounded-2xl shadow-lg shadow-cyan-200 transition-all active:scale-95 border-b-4 border-blue-800 active:border-b-0">
                        <i class="fas fa-feather-pointed mr-2"></i>Chronicled!
                    </button>
                </div>
            </div>
        </div>
    </div>
`;
