// templates/modals/misc.js
// Quest update, milestone, welcome back, celebration bonus, quest assignment,
// starfall, overview, bounty, boon confirm, bestow boon

export const miscModalsHTML = `
    <div id="quest-update-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-2xl w-full pop-in border-4 border-purple-300">
            <div class="flex justify-between items-center mb-4">
                <h2 class="font-title text-2xl md:text-3xl text-purple-700">Latest Quest Update</h2>
                <button id="quest-update-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>

            <div id="narrative-text-container"
                class="bg-purple-50 p-6 rounded-2xl border-2 border-purple-100 text-lg text-purple-900 leading-relaxed min-h-[150px] flex items-center justify-center">
                Loading update...
            </div>

            <div class="mt-6 flex justify-center">
                <button id="play-narrative-btn"
                    class="bg-purple-500 hover:bg-purple-600 text-white font-title text-xl py-3 px-8 rounded-full bubbly-button shadow-lg hidden">
                    <i class="fas fa-play-circle mr-2"></i> Play Commentary
                </button>
            </div>
        </div>
    </div>

    <div id="milestone-details-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-4xl w-full pop-in border-4 border-blue-300">
            <div class="flex justify-between items-center mb-4">
                <h2 id="milestone-modal-title" class="font-title text-2xl md:text-3xl text-blue-700">Milestone Progress
                </h2>
                <button id="milestone-modal-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>
            <div id="milestone-modal-content" class="space-y-4 text-center">
            </div>
        </div>
    </div>

    <div id="welcome-back-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div
            class="relative bg-gradient-to-br from-sky-300 to-lime-300 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border-4 border-white overflow-hidden">
            <span class="absolute text-4xl top-4 left-4 animate-ping opacity-50">✨</span>
            <span class="absolute text-3xl bottom-8 right-8 animate-pulse">🎉</span>
            <span class="absolute text-2xl top-12 right-12 animate-bounce">👋</span>

            <div id="welcome-back-content" class="relative z-10 pop-in space-y-4">
                <h2 id="welcome-back-title" class="font-title text-4xl text-white"
                    style="text-shadow: 0 2px 4px rgba(0,0,0,0.2);">Welcome Back!</h2>
                <p id="welcome-back-message" class="text-xl font-semibold text-gray-800 leading-relaxed"></p>
                <div class="inline-block bg-white/50 rounded-full p-4">
                    <p class="font-title text-5xl text-amber-600 flex items-center justify-center gap-2">
                        <i class="fas fa-star"></i>
                        <span id="welcome-back-stars">3</span>
                    </p>
                    <p class="text-sm font-bold text-amber-800 -mt-1">Bonus Stars!</p>
                </div>
            </div>
        </div>
    </div>

    <div id="celebration-bonus-modal"
        class="fixed inset-0 bg-black bg-opacity-60 z-[90] flex items-center justify-center p-4 hidden">
        <div
            class="bg-white rounded-3xl shadow-2xl max-w-sm w-full pop-in border-4 border-white relative overflow-hidden text-center">
            <div
                class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/confetti.png')] opacity-20">
            </div>
            <div id="celebration-header" class="bg-gradient-to-r from-pink-500 to-rose-500 p-6">
                <div class="text-6xl mb-2 animate-bounce">🎂</div>
                <h2 id="celebration-title" class="font-title text-3xl text-white drop-shadow-md">Happy Birthday!</h2>
            </div>
            <div class="p-6">
                <p id="celebration-message" class="text-gray-600 mb-6 text-lg">It's <b>Student's</b> special day! Would
                    you like to award a gift?</p>
                <button id="celebration-award-btn"
                    class="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-title text-xl py-3 rounded-xl bubbly-button shadow-lg mb-3">
                    <i class="fas fa-gift mr-2"></i> Award +<span id="celebration-points">2.5</span> Stars
                </button>
                <button id="celebration-cancel-btn" class="text-gray-400 text-sm hover:text-gray-600 underline">Not
                    now</button>
            </div>
        </div>
    </div>

    <div id="quest-assignment-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full pop-in border-4 border-indigo-300 flex flex-col max-h-[90vh]">
            <!-- Header -->
            <div class="p-6 pb-4 border-b border-indigo-100 flex-shrink-0">
                <div class="flex items-center justify-center gap-3">
                    <div class="text-4xl">📜</div>
                    <h2 class="font-title text-2xl text-indigo-700">Quest Board</h2>
                </div>
            </div>
            
            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
                <input type="hidden" id="quest-assignment-class-id">

                <!-- Previous Assignment Card -->
                <div class="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
                    <h3 class="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <i class="fas fa-history"></i> Previous Assignment
                    </h3>
                    <div id="previous-assignment-text" class="text-sm text-gray-700 italic">
                        Loading previous assignment...
                    </div>
                </div>

                <!-- New Assignment Section -->
                <div class="space-y-3">
                    <label for="quest-assignment-textarea" class="block text-sm font-bold text-gray-700 flex items-center gap-2">
                        <i class="fas fa-edit text-indigo-500"></i> Assignment for Next Lesson:
                    </label>
                    <div class="relative">
                        <div id="quest-assignment-date-chip"
                            class="pointer-events-none absolute top-2 left-3 inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                            <i class="fas fa-calendar-day"></i>
                            <span>DD/MM/YYYY</span>
                        </div>
                        <textarea id="quest-assignment-textarea" rows="4"
                            class="w-full px-4 pt-9 pb-3 border-2 border-indigo-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 resize-none"
                            placeholder="Enter homework, topics to review, or any notes for the class..."></textarea>
                    </div>
                </div>

                <!-- Test Scheduling Card -->
                <div class="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-white shadow-sm overflow-hidden">
                    <button id="quest-test-toggle-btn" type="button"
                        class="w-full text-left px-4 py-4 flex items-center justify-between gap-4 hover:bg-white/40 transition-colors">
                        <div class="flex items-start gap-3 min-w-0">
                            <div class="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-sm flex-shrink-0">
                                <i class="fas fa-calendar-check"></i>
                            </div>
                            <div class="min-w-0">
                                <h3 class="font-title text-xl text-amber-900">Schedule a Test</h3>
                                <p id="quest-test-toggle-copy" class="text-sm text-amber-700 leading-relaxed">Add a test date, title, and topic when you want this assignment to lead into an upcoming test.</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <span id="quest-test-toggle-badge" class="px-3 py-1 rounded-full bg-white/80 border border-amber-200 text-[11px] font-bold uppercase tracking-wide text-amber-700">Closed</span>
                            <i id="quest-test-toggle-icon" class="fas fa-chevron-down text-amber-500 transition-transform"></i>
                        </div>
                    </button>
                    <div id="quest-test-panel" class="hidden border-t border-amber-200/80 px-4 pb-4">
                        <div class="pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-bold text-amber-700 mb-1.5 uppercase tracking-wide">Test Date</label>
                                <input type="date" id="quest-test-date"
                                    class="w-full px-3 py-2.5 border-2 border-amber-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-amber-700 mb-1.5 uppercase tracking-wide">Test Title</label>
                                <input type="text" id="quest-test-title" placeholder="e.g. Unit 5 Review"
                                    class="w-full px-3 py-2.5 border-2 border-amber-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400">
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-xs font-bold text-amber-700 mb-1.5 uppercase tracking-wide">Curriculum / Topics</label>
                                <input type="text" id="quest-test-curriculum"
                                    placeholder="e.g. Past Simple, Vocabulary pg 40-45"
                                    class="w-full px-3 py-2.5 border-2 border-amber-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400">
                            </div>
                        </div>
                        <div class="mt-3 flex items-center justify-between gap-3 text-xs text-amber-700">
                            <p id="quest-test-panel-hint">Leave this closed when the assignment does not include a test.</p>
                            <button id="quest-test-clear-btn" type="button" class="font-bold px-3 py-1.5 rounded-full border border-amber-200 bg-white hover:bg-amber-50 transition-colors">
                                Clear Test Plan
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer Buttons -->
            <div class="p-6 pt-4 border-t border-gray-100 flex-shrink-0">
                <div class="flex gap-3">
                    <button id="quest-assignment-cancel-btn"
                        class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl transition-colors">
                        <i class="fas fa-times mr-2"></i>Cancel
                    </button>
                    <button id="quest-assignment-confirm-btn"
                        class="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all">
                        <i class="fas fa-save mr-2"></i>Save Assignment
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="starfall-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[80] flex items-center justify-center p-4 hidden">
        <div id="starfall-modal-content"
            class="relative text-center p-8 rounded-3xl shadow-2xl max-w-lg w-full pop-in overflow-hidden">
            <div class="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] starfall-bg"></div>
            <div class="relative z-10">
                <div id="starfall-icon" class="text-7xl mb-4 starfall-icon-animate">⭐</div>
                <h2 class="font-title text-4xl text-white mb-4" style="text-shadow: 0 2px 4px rgba(0,0,0,0.3);">A
                    Starfall Opportunity!</h2>

                <div id="starfall-single-view">
                    <p id="starfall-message" class="text-white/90 text-lg leading-relaxed mb-6"
                        style="text-shadow: 0 1px 3px rgba(0,0,0,0.3);">The stars have noticed <b
                            id="starfall-student-name" class="text-yellow-200">Student Name's</b> incredible effort on
                        their trial! Their brilliance has caused a star to fall from the sky.</p>
                </div>

                <div id="starfall-batch-view" class="hidden mb-6">
                    <p class="text-white/90 text-lg leading-relaxed mb-4"
                        style="text-shadow: 0 1px 3px rgba(0,0,0,0.3);">The stars are raining down! These scholars have
                        triggered a Starfall Bonus!</p>
                    <div id="starfall-batch-list"
                        class="bg-white/20 backdrop-blur-sm rounded-xl p-2 max-h-40 overflow-y-auto text-left space-y-1">
                    </div>
                </div>

                <p class="text-white font-bold text-xl mb-6">Shall we bestow these Bonus Stars?</p>
                <div class="flex flex-col items-center gap-3">
                    <button id="starfall-confirm-btn"
                        class="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-title text-xl py-3 rounded-xl bubbly-button shadow-lg border-b-4 border-yellow-600">Yes,
                        Bestow Bonus Stars! ✨</button>
                    <button id="starfall-cancel-btn" class="text-white/70 hover:text-white hover:underline">Not This
                        Time</button>
                </div>
            </div>
        </div>
    </div>

    <div id="overview-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[71] flex items-center justify-center p-4 hidden">
        <div
            class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-4xl w-full pop-in border-4 border-purple-300 flex flex-col">
            <div class="flex justify-between items-center mb-4">
                <h2 id="overview-modal-title" class="font-title text-2xl md:text-3xl text-purple-700">Quest Overview
                </h2>
                <button id="overview-modal-close-btn"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold w-10 h-10 rounded-full bubbly-button">&times;</button>
            </div>

            <div class="border-b border-gray-200 mb-4">
                <nav id="overview-modal-tabs" class="-mb-px flex space-x-6">
                    <button data-view="class"
                        class="overview-tab-btn whitespace-nowrap py-3 px-1 border-b-4 font-semibold text-lg border-purple-500 text-purple-600">
                        <i class="fas fa-users mr-2"></i>Class Overview
                    </button>
                    <button data-view="student"
                        class="overview-tab-btn whitespace-nowrap py-3 px-1 border-b-4 font-semibold text-lg border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">
                        <i class="fas fa-user-graduate mr-2"></i>Student Overviews
                    </button>
                </nav>
            </div>

            <div id="overview-modal-content" class="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            </div>
        </div>
    </div>

    <div id="create-bounty-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-lg w-full pop-in border-4 border-amber-400">

            <h2 id="bounty-modal-title" class="font-title text-3xl text-amber-600 mb-6 text-center">
                <i class="fas fa-scroll mr-2"></i>Post a Bounty
            </h2>

            <form id="create-bounty-form" class="space-y-4">
                <input type="hidden" id="bounty-class-id">
                <input type="hidden" id="bounty-type" value="standard">

                <div class="flex justify-center bg-gray-100 p-1 rounded-lg mb-4">
                    <button type="button" id="bounty-mode-stars"
                        class="flex-1 py-2 rounded-md text-sm font-bold bg-white text-amber-600 shadow-sm transition-all">Star
                        Target</button>
                    <button type="button" id="bounty-mode-timer"
                        class="flex-1 py-2 rounded-md text-sm font-bold text-gray-500 hover:text-gray-700 transition-all">Countdown
                        Timer</button>
                </div>

                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-1">Quest Title</label>
                    <input type="text" id="bounty-title" placeholder="e.g. Unit 5 Test / Clean Up"
                        class="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        required autocomplete="off">
                </div>

                <div id="bounty-inputs-stars" class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Target Stars</label>
                        <input type="number" id="bounty-target" value="20" min="1"
                            class="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Reward</label>
                        <input type="text" id="bounty-reward" placeholder="e.g. Free Time"
                            class="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none">
                    </div>
                </div>

                <div id="bounty-inputs-timer" class="hidden space-y-4">
                    <div class="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <label class="block text-xs font-bold text-indigo-800 uppercase tracking-wide mb-2">Duration
                            Setting</label>

                        <div id="bounty-smart-options" class="flex flex-wrap gap-2 mb-3"></div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs text-gray-500 mb-1">Minutes</label>
                                <div class="relative">
                                    <input type="number" id="bounty-timer-minutes" placeholder="20"
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 outline-none">
                                    <span class="absolute right-3 top-2 text-gray-400 text-xs">min</span>
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs text-gray-500 mb-1">OR End Time</label>
                                <input type="time" id="bounty-timer-end"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 outline-none">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-between gap-4 mt-6">
                    <button type="button" id="bounty-cancel-btn"
                        class="w-1/3 bg-gray-200 text-gray-700 font-bold py-3 rounded-xl bubbly-button">Cancel</button>
                    <button type="submit"
                        class="w-2/3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-3 rounded-xl bubbly-button shadow-lg"
                        id="bounty-submit-btn">Start Quest</button>
                </div>
            </form>
        </div>
    </div>

    <div id="boon-confirm-modal"
        class="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4 hidden backdrop-blur-md">
        <div class="bg-white rounded-3xl shadow-2xl max-w-sm w-full pop-in border-4 border-rose-300 overflow-hidden">
            <div class="bg-rose-500 p-4 text-center text-white">
                <h3 class="font-title text-2xl">Confirm Boon?</h3>
            </div>
            <div class="p-6 text-center">
                <p class="text-gray-700 mb-6">
                    Spend <span class="font-bold text-amber-600">15 Gold</span> from <b id="boon-confirm-sender"
                        class="text-rose-600"></b>
                    to bestow a Hero's Boon on <b id="boon-confirm-receiver" class="text-rose-600"></b>?
                    <br><span class="text-sm text-rose-400 font-bold mt-2 inline-block">(+0.5 Stars)</span>
                </p>
                <div class="flex gap-4">
                    <button id="boon-confirm-cancel-btn"
                        class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold py-2 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button id="boon-confirm-final-btn"
                        class="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-title text-xl py-2 rounded-xl shadow-lg transition-all active:scale-95">
                        Confirm!
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="bestow-boon-modal"
        class="fixed inset-0 bg-black bg-opacity-60 z-[90] flex items-center justify-center p-4 hidden backdrop-blur-sm">
        <div
            class="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full pop-in border-4 border-rose-300 relative overflow-hidden">
            <div class="bg-gradient-to-r from-rose-400 to-pink-500 p-6 text-center text-white">
                <div class="text-5xl mb-2 animate-bounce">💝</div>
                <h2 class="font-title text-3xl">Hero's Boon</h2>
                <p class="text-rose-100 font-bold uppercase tracking-widest text-xs">Spread the magic</p>
            </div>

            <div class="p-8">
                <p class="text-gray-600 text-center mb-6">
                    Choose an adventurer to sponsor <b id="boon-receiver-name" class="text-rose-600"></b>'s quest!
                    It costs <span class="font-bold text-amber-600">15 Gold</span> to bestow <span
                        class="font-bold text-amber-600">+0.5 Stars</span>.
                </p>

                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-black text-gray-400 uppercase mb-1 ml-1">Select the
                            Sponsor</label>
                        <select id="boon-sender-select"
                            class="w-full px-4 py-3 border-2 border-rose-100 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none bg-rose-50/30 font-bold text-rose-900">
                        </select>
                    </div>
                </div>

                <div class="flex gap-4 mt-8">
                    <button id="boon-cancel-btn"
                        class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold py-3 rounded-2xl transition-colors">
                        Cancel
                    </button>
                    <button id="boon-confirm-btn"
                        class="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-title text-xl py-3 rounded-2xl shadow-lg shadow-rose-200 transition-all active:scale-95">
                        Bestow!
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="teacher-boon-modal"
        class="fixed inset-0 bg-slate-950/70 z-[95] flex items-center justify-center p-4 hidden backdrop-blur-md">
        <div id="teacher-boon-shell"
            class="teacher-boon-shell pop-in">
            <div class="teacher-boon-shell__backdrop"></div>
            <div class="teacher-boon-shell__sparkles" aria-hidden="true">
                <span class="teacher-boon-sparkle teacher-boon-sparkle--1"></span>
                <span class="teacher-boon-sparkle teacher-boon-sparkle--2"></span>
                <span class="teacher-boon-sparkle teacher-boon-sparkle--3"></span>
                <span class="teacher-boon-sparkle teacher-boon-sparkle--4"></span>
                <span class="teacher-boon-sparkle teacher-boon-sparkle--5"></span>
            </div>

            <div id="teacher-boon-success-overlay" class="teacher-boon-success-overlay hidden">
                <div class="teacher-boon-success-overlay__burst"></div>
                <div class="teacher-boon-success-confetti" aria-hidden="true">
                    <span class="teacher-boon-confetti teacher-boon-confetti--1"></span>
                    <span class="teacher-boon-confetti teacher-boon-confetti--2"></span>
                    <span class="teacher-boon-confetti teacher-boon-confetti--3"></span>
                    <span class="teacher-boon-confetti teacher-boon-confetti--4"></span>
                    <span class="teacher-boon-confetti teacher-boon-confetti--5"></span>
                    <span class="teacher-boon-confetti teacher-boon-confetti--6"></span>
                    <span class="teacher-boon-confetti teacher-boon-confetti--7"></span>
                    <span class="teacher-boon-confetti teacher-boon-confetti--8"></span>
                    <span class="teacher-boon-confetti teacher-boon-confetti--9"></span>
                    <span class="teacher-boon-confetti teacher-boon-confetti--10"></span>
                </div>
                <div class="teacher-boon-success-overlay__card">
                    <div class="teacher-boon-success-overlay__icon">✨</div>
                    <div class="teacher-boon-success-overlay__title">Teacher Boon</div>
                    <div class="teacher-boon-success-overlay__copy">Two stars bestowed.</div>
                </div>
            </div>

            <button id="teacher-boon-close-btn" class="teacher-boon-close-btn" type="button">&times;</button>

            <div class="teacher-boon-header teacher-boon-entrance teacher-boon-entrance--1">
                <div class="teacher-boon-header__crest">
                    <span class="teacher-boon-header__crest-icon">🌟</span>
                    <span class="teacher-boon-header__crest-ring"></span>
                </div>
                <div class="teacher-boon-header__text">
                    <p class="teacher-boon-header__eyebrow">Monthly blessing</p>
                    <h2 class="teacher-boon-header__title">Teacher Boon</h2>
                    <p id="teacher-boon-class-name" class="teacher-boon-header__class">Selected class</p>
                    <p class="teacher-boon-header__copy">A guided three-step ceremony. Teacher Boon now always grants two stars.</p>
                </div>
            </div>

            <div class="teacher-boon-content">
                <div id="teacher-boon-status-banner" class="teacher-boon-entrance teacher-boon-entrance--2"></div>
                <div id="teacher-boon-stepper" class="teacher-boon-stepper teacher-boon-entrance teacher-boon-entrance--3"></div>

                <div class="teacher-boon-stage-layout teacher-boon-entrance teacher-boon-entrance--4">
                    <div class="teacher-boon-stage-stack">
                        <section class="teacher-boon-section teacher-boon-step-panel" data-teacher-boon-step-panel="1">
                            <div class="teacher-boon-section__heading">
                                <span class="teacher-boon-section__icon">🧒</span>
                                <div>
                                    <p class="teacher-boon-section__eyebrow">Step 1</p>
                                    <h3 class="teacher-boon-section__title">Choose the student</h3>
                                    <p class="teacher-boon-section__copy">Pick the hero who will receive this month’s two-star Teacher Boon.</p>
                                </div>
                            </div>
                            <div class="teacher-boon-carousel-wrapper">
                                <button id="teacher-boon-carousel-prev" class="teacher-boon-carousel-arrow teacher-boon-carousel-arrow--prev" type="button" aria-label="Previous student">
                                    <i class="fas fa-chevron-left"></i>
                                </button>
                                <div id="teacher-boon-student-grid" class="teacher-boon-carousel"></div>
                                <button id="teacher-boon-carousel-next" class="teacher-boon-carousel-arrow teacher-boon-carousel-arrow--next" type="button" aria-label="Next student">
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </section>

                        <section class="teacher-boon-section teacher-boon-step-panel" data-teacher-boon-step-panel="2">
                            <div class="teacher-boon-section__heading">
                                <span class="teacher-boon-section__icon">💌</span>
                                <div>
                                    <p class="teacher-boon-section__eyebrow">Step 2</p>
                                    <h3 class="teacher-boon-section__title">Choose the reason</h3>
                                    <p class="teacher-boon-section__copy">Select a preset reason or write a custom message. Either one completes the blessing.</p>
                                </div>
                            </div>

                            <div class="teacher-boon-fixed-stars-pill">
                                <span class="teacher-boon-fixed-stars-pill__stars">⭐⭐</span>
                                <div>
                                    <strong>Two-star boon</strong>
                                    <p>Teacher Boon is now fixed at two stars for a clearer monthly reward.</p>
                                </div>
                            </div>

                            <div id="teacher-boon-presets" class="teacher-boon-presets"></div>
                            <label class="teacher-boon-custom-label" for="teacher-boon-custom-reason">Or write your own reason</label>
                            <textarea id="teacher-boon-custom-reason" class="teacher-boon-custom-reason" rows="3" placeholder="Add a short note that feels personal…"></textarea>
                        </section>

                        <section class="teacher-boon-section teacher-boon-step-panel" data-teacher-boon-step-panel="3">
                            <div class="teacher-boon-section__heading">
                                <span class="teacher-boon-section__icon">🪄</span>
                                <div>
                                    <p class="teacher-boon-section__eyebrow">Step 3</p>
                                    <h3 class="teacher-boon-section__title">Confirm the blessing</h3>
                                    <p class="teacher-boon-section__copy">Take one last look before the two stars are awarded.</p>
                                </div>
                            </div>
                            <div id="teacher-boon-selected-summary"></div>
                        </section>
                    </div>

                    <aside class="teacher-boon-aside">
                        <div class="teacher-boon-orbit-card">
                            <div class="teacher-boon-orbit-card__eyebrow">Boon aura</div>
                            <div class="teacher-boon-orbit-card__title">A small monthly ceremony</div>
                            <div class="teacher-boon-orbit-card__copy">One student, one reason, two bright stars.</div>
                            <div class="teacher-boon-fixed-stars">
                                <div class="teacher-boon-fixed-stars__stars">⭐⭐</div>
                                <div class="teacher-boon-fixed-stars__copy">Teacher Boon now always grants two stars.</div>
                            </div>
                            <div id="teacher-boon-stage-hint" class="teacher-boon-stage-hint"></div>
                            <div id="teacher-boon-side-summary" class="teacher-boon-side-summary"></div>
                        </div>
                    </aside>
                </div>
            </div>

            <div class="teacher-boon-footer teacher-boon-entrance teacher-boon-entrance--5">
                <button id="teacher-boon-cancel-btn" class="teacher-boon-cancel-btn" type="button">Cancel</button>
                <div class="teacher-boon-footer__actions">
                    <button id="teacher-boon-back-btn" class="teacher-boon-secondary-btn hidden" type="button">Back</button>
                    <button id="teacher-boon-next-btn" class="teacher-boon-secondary-btn" type="button">Continue</button>
                    <button id="teacher-boon-confirm-btn" class="teacher-boon-confirm-btn hidden" type="button"></button>
                </div>
            </div>
        </div>
    </div>
`;
