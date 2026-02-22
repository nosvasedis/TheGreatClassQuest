// templates/modals/hero.js
// Hero celebration, hero stats, hero chronicle, prodigy

export const heroModalsHTML = `
    <div id="hero-celebration-modal"
        class="fixed inset-0 bg-black bg-opacity-80 z-[95] flex items-center justify-center p-4 hidden">
        <div
            class="bg-gradient-to-b from-purple-900 to-indigo-900 rounded-[3rem] shadow-2xl max-w-md w-full pop-in border-4 border-yellow-400 relative overflow-hidden text-center p-8">
            <div
                class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-pulse">
            </div>

            <div class="relative z-10">
                <div
                    class="badge-pill bg-yellow-400 text-yellow-900 mx-auto mb-4 shadow-[0_0_20px_rgba(250,204,21,0.6)]">
                    Hero of the Day</div>

                <div id="hero-celebration-avatar"
                    class="w-40 h-40 mx-auto rounded-full border-8 border-yellow-400 shadow-2xl mb-6 bg-white flex items-center justify-center text-7xl font-bold text-indigo-500 relative">
                    <div class="absolute -top-4 -right-4 text-6xl animate-bounce">👑</div>
                </div>

                <h2 id="hero-celebration-name" class="font-title text-5xl text-white mb-2 text-shadow-lg">Student Name
                </h2>
                <p id="hero-celebration-reason"
                    class="text-purple-200 text-xl font-bold uppercase tracking-widest mb-8">For Outstanding Courage</p>

                <button id="hero-celebration-close-btn"
                    class="bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-title text-xl py-3 px-10 rounded-full bubbly-button shadow-xl">
                    Huzzah!
                </button>
            </div>
        </div>
    </div>

    <div id="hero-stats-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div
            class="bg-gradient-to-br from-gray-800 via-purple-900 to-gray-900 p-6 rounded-3xl shadow-2xl max-w-4xl w-full pop-in border-4 border-purple-400 flex flex-col md:flex-row gap-6 relative">
            <button id="hero-stats-close-btn"
                class="absolute top-4 right-4 bg-gray-700 hover:bg-gray-600 text-white font-bold w-10 h-10 rounded-full bubbly-button z-10">&times;</button>

            <div id="hero-stats-avatar-container"
                class="md:w-1/3 flex flex-col items-center justify-center text-center text-white">
                <div id="hero-stats-avatar" class="w-48 h-48 rounded-full border-4 border-purple-300 shadow-lg mb-4">
                </div>
                <h2 id="hero-stats-name" class="font-title text-3xl" style="text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
                </h2>
            </div>

            <div class="flex-grow flex flex-col">
                <div id="hero-stats-content" class="space-y-3">
                </div>

                <div class="mt-4 px-2">
                    <button id="open-boon-modal-btn"
                        class="w-full bg-gradient-to-r from-rose-400 to-pink-500 hover:from-rose-500 hover:to-pink-600 text-white font-title text-lg py-3 rounded-2xl bubbly-button shadow-lg shadow-rose-200/50 flex items-center justify-center gap-2">
                        <i class="fas fa-hand-holding-heart"></i> Bestow a Boon (Gift Stars)
                    </button>
                </div>
                <div id="hero-stats-chart-container" class="mt-4 flex-grow">
                </div>
            </div>
        </div>
    </div>

    <div id="hero-chronicle-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div
            class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-6xl w-full pop-in border-4 border-green-300 flex flex-col max-h-[90vh]">
            <div class="flex justify-between items-start mb-4 flex-shrink-0">
                <div>
                    <h2 id="hero-chronicle-title" class="font-title text-2xl md:text-3xl text-green-700">Hero's
                        Chronicle</h2>
                    <p id="hero-chronicle-student-name" class="font-semibold text-lg text-gray-600 -mt-1"></p>
                </div>
                <button id="hero-chronicle-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button flex-shrink-0">&times;</button>
            </div>

            <div class="flex flex-col md:flex-row gap-6 min-h-0">
                <div class="md:w-1/2 flex flex-col min-h-0">
                    <h3 class="font-title text-xl text-gray-700 mb-2 flex-shrink-0">Teacher's Logbook</h3>
                    <div id="hero-chronicle-notes-feed"
                        class="flex-grow space-y-3 overflow-y-auto pr-2 bg-gray-50 p-3 rounded-lg border">
                    </div>
                    <form id="hero-chronicle-note-form" class="mt-4 pt-4 border-t flex-shrink-0">
                        <input type="hidden" id="hero-chronicle-note-id">
                        <div class="flex items-center gap-2 mb-2">
                            <label for="hero-chronicle-note-category" class="font-semibold text-sm">Category:</label>
                            <select id="hero-chronicle-note-category"
                                class="flex-grow border border-gray-300 rounded-md px-2 py-1 text-sm">
                                <option>General</option>
                                <option>Behavior</option>
                                <option>Academic</option>
                                <option>Social</option>
                            </select>
                        </div>
                        <textarea id="hero-chronicle-note-text" rows="3"
                            class="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                            placeholder="Add a new note..."></textarea>
                        <div class="flex items-center gap-2 mt-2">
                            <button type="submit"
                                class="w-full bg-green-500 hover:bg-green-600 text-white font-title py-2 rounded-lg bubbly-button">Save
                                Note</button>
                            <button type="button" id="hero-chronicle-cancel-edit-btn"
                                class="hidden w-full bg-gray-200 text-gray-700 font-title py-2 rounded-lg bubbly-button">Cancel
                                Edit</button>
                        </div>
                    </form>
                </div>

                <div class="md:w-1/2 flex flex-col">
                    <h3 class="font-title text-xl text-indigo-700 mb-2">The Oracle's Counsel</h3>
                    <div class="grid grid-cols-2 gap-2 mb-4">
                        <button data-type="parent"
                            class="ai-insight-btn bg-indigo-100 text-indigo-800 p-2 rounded-lg bubbly-button text-sm font-semibold"><i
                                class="fas fa-user-friends mr-1"></i> Parent Summary</button>
                        <button data-type="teacher"
                            class="ai-insight-btn bg-indigo-100 text-indigo-800 p-2 rounded-lg bubbly-button text-sm font-semibold"><i
                                class="fas fa-chalkboard-teacher mr-1"></i> Teacher Strategy</button>
                        <button data-type="analysis"
                            class="ai-insight-btn bg-indigo-100 text-indigo-800 p-2 rounded-lg bubbly-button text-sm font-semibold"><i
                                class="fas fa-chart-pie mr-1"></i> Strengths/Weaknesses</button>
                        <button data-type="goal"
                            class="ai-insight-btn bg-indigo-100 text-indigo-800 p-2 rounded-lg bubbly-button text-sm font-semibold"><i
                                class="fas fa-bullseye mr-1"></i> Goal Suggestion</button>
                    </div>
                    <div id="hero-chronicle-ai-output"
                        class="flex-grow bg-indigo-50 p-4 rounded-lg border border-indigo-200 overflow-y-auto">
                        <p class="text-center text-indigo-700">Select a counsel type to receive the Oracle's wisdom.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="prodigy-modal"
        class="fixed inset-0 bg-black bg-opacity-80 z-[95] flex items-center justify-center p-4 hidden backdrop-blur-sm">
        <div
            class="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl shadow-2xl max-w-4xl w-full h-[85vh] pop-in border-4 border-amber-400 flex flex-col relative overflow-hidden">
            <div class="absolute inset-0 opacity-20 pointer-events-none"
                style="background-image: url('https://www.transparenttextures.com/patterns/stardust.png');"></div>

            <button id="prodigy-close-btn"
                class="absolute top-4 right-4 bg-white/10 hover:bg-white/30 text-white w-10 h-10 rounded-full z-50 transition-colors">&times;</button>

            <div class="text-center p-6 border-b border-white/10 relative z-10">
                <div class="text-6xl mb-2 animate-bounce-slow">👑</div>
                <h2
                    class="font-title text-4xl text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 filter drop-shadow-md">
                    Hall of Prodigies</h2>
                <p class="text-indigo-200 text-lg mt-1">Legends of Months Past</p>

                <div class="mt-4 flex justify-center">
                    <select id="prodigy-class-select"
                        class="bg-indigo-950/50 border-2 border-amber-500/50 text-amber-100 text-lg font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-amber-400">
                        <option value="">Select a Class...</option>
                    </select>
                </div>
            </div>

            <div id="prodigy-content" class="flex-grow overflow-y-auto p-6 custom-scrollbar relative z-10 space-y-6">
                <div class="text-center text-indigo-300 mt-10 text-xl">Select a class to view its legends.</div>
            </div>
        </div>
    </div>
`;
