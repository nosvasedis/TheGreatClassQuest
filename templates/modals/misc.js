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
        <div id="milestone-details-panel" class="milestone-details-panel bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-4xl w-full pop-in border-4 border-blue-300 max-h-[90vh] overflow-y-auto">
            <div class="milestone-details-header flex justify-between items-center mb-4 gap-3">
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
        class="fixed inset-0 bg-black bg-opacity-60 z-[72] flex items-center justify-center p-4 hidden backdrop-blur-md">
        <div class="bg-white rounded-[2.5rem] shadow-2xl max-w-4xl w-full pop-in border-4 border-indigo-400 flex flex-col max-h-[90vh] overflow-hidden">
            
            <!-- Premium Header -->
            <div class="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-8 text-white flex-shrink-0">
                <div class="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <div class="relative flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl shadow-inner border border-white/30">
                            📝
                        </div>
                        <div>
                            <h2 class="font-title text-4xl drop-shadow-md">Quest Board</h2>
                            <p class="text-indigo-100 font-bold uppercase tracking-widest text-xs opacity-80">Assign Today's Challenge</p>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-3">
                        <button id="open-quest-test-modal-btn" type="button"
                            class="bg-amber-400 hover:bg-amber-300 text-amber-900 font-bold px-5 py-2.5 rounded-full flex items-center gap-2 shadow-lg transition-all active:scale-95 text-sm">
                            <i class="fas fa-calendar-check"></i>
                            <span>Schedule Test</span>
                            <span id="quest-header-test-badge" class="hidden ml-1 px-1.5 py-0.5 bg-amber-900 text-amber-100 text-[10px] rounded-full">!</span>
                        </button>
                        
                        <button id="quest-assignment-close-x-btn"
                            class="bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/50">
                <input type="hidden" id="quest-assignment-class-id">

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <!-- Left Column: Previous Assignment -->
                    <div class="flex flex-col h-full">
                         <h3 class="text-sm font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <i class="fas fa-history"></i> Previous Assignment
                        </h3>
                        <div class="flex-1 bg-white rounded-3xl p-6 border-2 border-indigo-50 shadow-sm relative overflow-hidden group">
                            <div class="absolute -bottom-6 -right-6 opacity-[0.08] group-hover:opacity-15 transition-all duration-700 group-hover:scale-110 group-hover:-rotate-12 rotate-[-15deg] pointer-events-none">
                                <i class="fas fa-clipboard-list text-[10rem] text-indigo-900"></i>
                            </div>
                            <div id="previous-assignment-text" class="relative z-10 text-gray-600 leading-relaxed min-h-[150px]">
                                Loading previous assignment...
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: New Assignment -->
                    <div class="flex flex-col h-full">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-sm font-black text-purple-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <i class="fas fa-pen-nib"></i> Next Assignment
                            </h3>
                        </div>
                        
                        <!-- Redesigned Centered Date Badge -->
                        <div class="flex justify-center -mb-5 relative z-20">
                            <div id="quest-assignment-date-chip"
                                class="inline-flex items-center gap-2.5 rounded-2xl border-2 border-purple-200 bg-white px-6 py-2 text-base font-black uppercase tracking-[0.1em] text-purple-600 shadow-xl ring-8 ring-slate-50/50">
                                <i class="fas fa-calendar-day text-lg"></i>
                                <span>DD/MM/YYYY</span>
                            </div>
                        </div>

                        <!-- Notebook Container -->
                        <div class="flex-1 notebook-container group">
                            <textarea id="quest-assignment-textarea" rows="8"
                                class="notebook-textarea"
                                placeholder=""></textarea>
                        </div>
                    </div>
                </div>
                
                <!-- Test Summary (Optional) -->
                <div id="quest-test-summary-card" class="hidden bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-3xl p-6 flex items-center justify-between gap-6 shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                            <i class="fas fa-bolt"></i>
                        </div>
                        <div>
                            <p class="text-xs font-black text-amber-600 uppercase tracking-widest">Upcoming Challenge</p>
                            <h4 id="quest-test-summary-title" class="font-title text-2xl text-amber-900">Unit 5 Final Test</h4>
                            <p id="quest-test-summary-details" class="text-amber-700 font-bold">15/05/2024 • Grammar & Vocab</p>
                        </div>
                    </div>
                    <button id="edit-quest-test-btn" class="bg-white hover:bg-amber-50 text-amber-600 font-bold px-6 py-2.5 rounded-xl border-2 border-amber-100 transition-all shadow-sm">
                        Edit Test
                    </button>
                </div>
            </div>

            <!-- Footer -->
            <div class="p-8 bg-white border-t border-gray-100 flex-shrink-0">
                <div class="flex gap-4 max-w-2xl mx-auto">
                    <button id="quest-assignment-cancel-btn"
                        class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold py-4 px-8 rounded-2xl transition-all active:scale-95">
                        Cancel
                    </button>
                    <button id="quest-assignment-confirm-btn"
                        class="flex-[2] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-title text-xl py-4 px-8 rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95">
                        <i class="fas fa-save mr-2"></i>Save Quest Board
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- New Test Modal -->
    <div id="quest-test-modal"
        class="fixed inset-0 bg-black bg-opacity-60 z-[75] flex items-center justify-center p-4 hidden backdrop-blur-sm">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full pop-in border-4 border-amber-300 overflow-hidden">
            <div class="bg-gradient-to-r from-amber-400 to-orange-500 p-6 text-center text-white">
                <div class="text-5xl mb-2">📅</div>
                <h2 class="font-title text-3xl">Schedule a Test</h2>
                <p class="text-amber-100 font-bold uppercase tracking-widest text-xs">Prepare the Challenge</p>
            </div>
            <div class="p-8 space-y-4">
                <div>
                    <label class="block text-xs font-bold text-amber-700 mb-1.5 uppercase tracking-wide">Test Date</label>
                    <input type="date" id="quest-test-date"
                        class="w-full px-4 py-3 border-2 border-amber-100 rounded-2xl focus:ring-2 focus:ring-amber-400 outline-none bg-amber-50/30 font-bold">
                </div>
                <div>
                    <label class="block text-xs font-bold text-amber-700 mb-1.5 uppercase tracking-wide">Test Title</label>
                    <input type="text" id="quest-test-title" placeholder="e.g. Unit 5 Review"
                        class="w-full px-4 py-3 border-2 border-amber-100 rounded-2xl focus:ring-2 focus:ring-amber-400 outline-none bg-amber-50/30 font-bold">
                </div>
                <div>
                    <label class="block text-xs font-bold text-amber-700 mb-1.5 uppercase tracking-wide">Curriculum / Topics</label>
                    <input type="text" id="quest-test-curriculum" placeholder="e.g. Past Simple, Vocabulary pg 40-45"
                        class="w-full px-4 py-3 border-2 border-amber-100 rounded-2xl focus:ring-2 focus:ring-amber-400 outline-none bg-amber-50/30 font-bold">
                </div>
                <div class="pt-4 flex gap-3">
                    <button id="quest-test-clear-btn" type="button" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold py-3 rounded-2xl transition-colors">
                        Clear
                    </button>
                    <button id="quest-test-done-btn" class="flex-[2] bg-amber-500 hover:bg-amber-600 text-white font-title text-xl py-3 px-8 rounded-2xl shadow-lg transition-all active:scale-95">
                        Done
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



    <div id="create-bounty-modal"
        class="fixed inset-0 bg-slate-950/60 z-[72] flex items-center justify-center p-4 hidden backdrop-blur-md">
        <div class="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full pop-in border-4 border-amber-400 overflow-hidden flex flex-col max-h-[90vh]">

            <!-- Premium Header -->
            <div class="relative bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 text-white flex-shrink-0">
                <div class="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]"></div>
                <div class="relative flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-2xl shadow-inner border border-white/30">
                            <i class="fas fa-crosshairs text-white drop-shadow-sm"></i>
                        </div>
                        <div>
                            <h2 class="font-title text-3xl drop-shadow-md">Post a Bounty</h2>
                            <p class="text-amber-100 font-bold uppercase tracking-widest text-[10px] opacity-80">Set a Challenge for the Class</p>
                        </div>
                    </div>
                    <button id="bounty-cancel-x-btn"
                        class="bg-white/10 hover:bg-white/20 text-white w-9 h-9 rounded-full flex items-center justify-center transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                <form id="create-bounty-form" class="space-y-6">
                    <input type="hidden" id="bounty-class-id">
                    <input type="hidden" id="bounty-type" value="standard">

                    <!-- Mode Switcher -->
                    <div class="flex p-1.5 bg-slate-200/50 rounded-2xl border border-slate-200">
                        <button type="button" id="bounty-mode-stars"
                            class="flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all bg-white text-amber-600 shadow-sm">
                            <i class="fas fa-star mr-2"></i>Star Target
                        </button>
                        <button type="button" id="bounty-mode-timer"
                            class="flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all text-slate-500 hover:text-slate-700">
                            <i class="fas fa-hourglass-half mr-2"></i>Countdown
                        </button>
                    </div>

                    <!-- Title Input -->
                    <div class="space-y-1.5">
                        <label class="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Bounty Name</label>
                        <div class="relative group">
                            <i class="fas fa-tag absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-amber-500 transition-colors"></i>
                            <input type="text" id="bounty-title" placeholder="e.g. Rapid Clean Up / Unit 5 Test"
                                class="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-100 rounded-2xl focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 outline-none font-bold text-slate-700 transition-all"
                                required autocomplete="off">
                        </div>
                    </div>

                    <!-- Dynamic Inputs: Stars -->
                    <div id="bounty-inputs-stars" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="space-y-1.5">
                            <label class="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Target Stars</label>
                            <div class="relative group">
                                <i class="fas fa-star absolute left-4 top-1/2 -translate-y-1/2 text-amber-300 group-focus-within:text-amber-500 transition-colors"></i>
                                <input type="number" id="bounty-target" value="20" min="1"
                                    class="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-100 rounded-2xl focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 outline-none font-bold text-slate-700 transition-all">
                            </div>
                        </div>
                        <div class="space-y-1.5">
                            <label class="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Reward</label>
                            <div class="relative group">
                                <i class="fas fa-gift absolute left-4 top-1/2 -translate-y-1/2 text-rose-300 group-focus-within:text-rose-500 transition-colors"></i>
                                <input type="text" id="bounty-reward" placeholder="e.g. 5m Free Time"
                                    class="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-100 rounded-2xl focus:border-rose-400 focus:ring-4 focus:ring-rose-400/10 outline-none font-bold text-slate-700 transition-all">
                            </div>
                        </div>
                    </div>

                    <!-- Dynamic Inputs: Timer -->
                    <div id="bounty-inputs-timer" class="hidden space-y-4">
                        <div class="bg-indigo-50/50 p-5 rounded-3xl border-2 border-indigo-100/50 space-y-4">
                            <label class="block text-xs font-black text-indigo-400 uppercase tracking-widest">Set Duration</label>

                            <div id="bounty-smart-options" class="flex flex-wrap gap-2"></div>

                            <div class="grid grid-cols-2 gap-4 pt-2">
                                <div class="space-y-1">
                                    <p class="text-[10px] font-bold text-indigo-300 uppercase ml-1">Minutes</p>
                                    <div class="relative">
                                        <input type="number" id="bounty-timer-minutes" placeholder="20"
                                            class="w-full px-4 py-3 bg-white border-2 border-indigo-50 rounded-xl focus:border-indigo-400 outline-none font-bold text-indigo-900">
                                        <span class="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 text-xs font-bold">MIN</span>
                                    </div>
                                </div>
                                <div class="space-y-1">
                                    <p class="text-[10px] font-bold text-indigo-300 uppercase ml-1">End Time</p>
                                    <input type="time" id="bounty-timer-end"
                                        class="w-full px-4 py-3 bg-white border-2 border-indigo-50 rounded-xl focus:border-indigo-400 outline-none font-bold text-indigo-900">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex gap-4 pt-2">
                        <button type="button" id="bounty-cancel-btn"
                            class="flex-1 bg-white hover:bg-slate-50 text-slate-400 font-bold py-4 rounded-2xl border-2 border-slate-100 transition-all active:scale-95">
                            Cancel
                        </button>
                        <button type="submit" id="bounty-submit-btn"
                            class="flex-[2] bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-title text-xl py-4 rounded-2xl shadow-lg shadow-amber-200 transition-all active:scale-95">
                            <i class="fas fa-paper-plane mr-2"></i>Start Quest
                        </button>
                    </div>
                </form>
            </div>
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
