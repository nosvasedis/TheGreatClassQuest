// templates/app/tabs/ideas.js

export const ideasTabHTML = `
            <div id="reward-ideas-tab" class="app-tab hidden">
                <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
                    <div class="text-center mb-6">
                        <i class="fas fa-feather-alt text-cyan-500 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-cyan-700 mt-2 bottom-nav-tab-title"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Story Weavers</h2>
                        <p class="text-lg text-gray-600 mt-2">Collaborative class storytelling with AI-powered word suggestions and illustrations.</p>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                        <div class="bg-white/80 backdrop-blur rounded-3xl shadow-sm ring-1 ring-black/5 border border-cyan-100 p-5 sm:p-6">
                            <div class="flex items-start justify-between gap-4">
                                <div class="min-w-0">
                                    <h3 class="font-title text-2xl text-slate-800">Current Chronicle</h3>
                                    <p class="text-sm text-slate-500 mt-1">Illustration and the latest line of the story.</p>
                                </div>
                                <button id="story-weavers-reveal-btn"
                                    class="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
                                    aria-label="Reveal story to class">
                                    <i class="fas fa-eye" aria-hidden="true"></i>
                                    <span class="hidden sm:inline">Reveal</span>
                                </button>
                            </div>

                            <div id="story-weavers-main-content" class="hidden mt-5">
                                <div id="story-weavers-image-container" class="story-weavers-image-frame">
                                    <img id="story-weavers-image" src="" alt="Story illustration" class="hidden pop-in" decoding="async" width="520" height="347">
                                    <div id="story-weavers-image-loader" class="text-slate-400 text-center hidden">
                                        <i class="fas fa-paint-brush fa-spin text-3xl" aria-hidden="true"></i>
                                        <p class="text-sm mt-2">The Chronicler is illustrating...</p>
                                    </div>
                                    <div id="story-weavers-image-placeholder" class="text-slate-400 text-center">
                                        <i class="fas fa-book-reader text-4xl" aria-hidden="true"></i>
                                        <p class="text-sm mt-2">The story awaits its illustration!</p>
                                    </div>
                                </div>

                                <div class="mt-4">
                                    <p class="text-xs font-semibold tracking-wide text-slate-500">LATEST LINE</p>
                                    <p id="story-weavers-text" class="story-weavers-story-text mt-2"></p>
                                </div>
                            </div>

                            <div id="story-weavers-placeholder" class="flex items-center justify-center py-10">
                                <div class="text-center max-w-sm">
                                    <p class="text-slate-600 font-semibold">Choose a class from the header to begin your chronicle.</p>
                                    <p class="text-slate-500 text-sm mt-1">You can still browse the storybook archive below.</p>
                                </div>
                            </div>
                        </div>

                        <div class="bg-white/80 backdrop-blur rounded-3xl shadow-sm ring-1 ring-black/5 border border-cyan-100 p-5 sm:p-6">
                            <div>
                                <h3 class="font-title text-2xl text-slate-800">Game Master Controls</h3>
                                <p class="text-sm text-slate-500 mt-1">Class is chosen in the header. Set the Word of the Day and continue the tale.</p>
                            </div>

                            <div class="mt-5">
                                <div class="flex items-center justify-between gap-3">
                                    <label for="story-weavers-word-input" class="block text-sm font-semibold text-slate-700">Word of the Day</label>
                                    <button id="story-weavers-suggest-word-btn"
                                        class="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                                        title="Suggest a word with AI" aria-label="Suggest a word with AI">
                                        <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
                                        <span class="hidden sm:inline">Suggest</span>
                                    </button>
                                </div>

                                <div class="mt-2 flex flex-wrap items-center gap-2">
                                    <input type="text" id="story-weavers-word-input"
                                        class="min-w-[10rem] flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                                        placeholder="e.g., mysterious" autocomplete="off" inputmode="text" aria-label="Word of the Day">

                                    <button id="story-weavers-confirm-word-btn"
                                        class="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors bubbly-button flex-shrink-0 hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                                        title="Lock in word" aria-label="Lock in word">
                                        <i class="fas fa-check" aria-hidden="true"></i>
                                    </button>
                                    <button id="story-weavers-clear-word-btn"
                                        class="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors bubbly-button flex-shrink-0 hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                                        title="Clear word" aria-label="Clear word">
                                        <i class="fas fa-times" aria-hidden="true"></i>
                                    </button>
                                </div>
                            </div>

                            <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button id="story-weavers-lock-in-btn"
                                    class="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-title text-lg py-3 rounded-2xl bubbly-button disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2">
                                    Continue...
                                </button>
                                <button id="story-weavers-end-btn"
                                    class="w-full bg-rose-600 hover:bg-rose-700 text-white font-title text-lg py-3 rounded-2xl bubbly-button disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2">
                                    The End
                                </button>
                            </div>

                            <div class="mt-5 story-weavers-actions-row">
                                <button id="story-weavers-history-btn"
                                    class="inline-flex flex-shrink-0 items-center gap-2 px-3.5 py-2 rounded-2xl text-sm font-semibold text-slate-800 bg-white/70 hover:bg-white shadow-sm ring-1 ring-slate-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 whitespace-nowrap">
                                    <span class="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-100 to-teal-100 flex items-center justify-center text-cyan-800 ring-1 ring-cyan-200">
                                        <i class="fas fa-scroll" aria-hidden="true"></i>
                                    </span>
                                    Current Story
                                </button>
                                <button id="story-weavers-archive-btn"
                                    class="inline-flex flex-shrink-0 items-center gap-2 px-3.5 py-2 rounded-2xl text-sm font-semibold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 shadow-sm ring-1 ring-indigo-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 whitespace-nowrap">
                                    <span class="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-800 ring-1 ring-indigo-200">
                                        <i class="fas fa-book-open" aria-hidden="true"></i>
                                    </span>
                                    View Archive
                                </button>
                                <button id="story-weavers-reset-btn"
                                    class="inline-flex flex-shrink-0 items-center gap-2 px-3.5 py-2 rounded-2xl text-sm font-semibold text-rose-900 bg-rose-50 hover:bg-rose-100 shadow-sm ring-1 ring-rose-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 whitespace-nowrap">
                                    <span class="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-100 to-orange-100 flex items-center justify-center text-rose-800 ring-1 ring-rose-200">
                                        <i class="fas fa-undo" aria-hidden="true"></i>
                                    </span>
                                    Start New
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
`;
