// templates/modals/planner.js
// Day planner modal

export const plannerModalHTML = `
    <div id="day-planner-modal"
        class="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 hidden">
        <div class="bg-white/95 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] max-w-lg w-full pop-in border border-white/20 flex flex-col max-h-[90vh] overflow-hidden">
            
            <!-- Header Section -->
            <div class="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-6 text-white flex-shrink-0">
                <div class="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <div class="relative flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-2xl shadow-inner border border-white/30">
                            <i class="fas fa-calendar-alt text-white drop-shadow-sm"></i>
                        </div>
                        <div>
                            <h2 id="day-planner-title" class="font-title text-2xl drop-shadow-md">Day Planner</h2>
                            <p class="text-indigo-100 font-bold uppercase tracking-widest text-[10px] opacity-80">Chronicle the Journey</p>
                        </div>
                    </div>
                    <button id="day-planner-close-btn"
                        class="bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center transition-all hover:rotate-90">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <!-- Tab Navigation -->
            <div class="px-6 py-4 bg-slate-100/50 border-b border-gray-200">
                <nav id="day-planner-tabs" class="flex p-1 bg-gray-200/50 rounded-2xl border border-gray-200/50">
                    <button data-tab="schedule"
                        class="day-planner-tab-btn flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all">
                        <i class="fas fa-calendar-day"></i> Schedule
                    </button>
                    <button data-tab="event"
                        class="day-planner-tab-btn flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all">
                        <i class="fas fa-magic"></i> Quest Event
                    </button>
                </nav>
            </div>

            <!-- Content Area -->
            <div id="day-planner-content" class="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                
                <!-- Schedule Tab -->
                <div id="day-planner-schedule-content" class="day-planner-tab-content space-y-6">
                    <div id="schedule-manager-list" class="space-y-3">
                        <!-- List injected by renderScheduleManagerList -->
                    </div>
                    
                    <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                        <div>
                            <label for="add-onetime-lesson-select" class="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">Add One-Time Lesson</label>
                            <div class="flex gap-2">
                                <select id="add-onetime-lesson-select"
                                    class="flex-grow px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-gray-700"></select>
                                <button id="add-onetime-lesson-btn"
                                    class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95">Add</button>
                            </div>
                        </div>
                        
                        <div class="border-t border-gray-50 pt-4">
                            <button id="day-planner-mark-holiday-btn" class="w-full py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl border border-rose-100 transition-all active:scale-95 flex items-center justify-center gap-2">
                                <i class="fas fa-umbrella-beach"></i> Mark as School Holiday
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Event Tab -->
                <div id="day-planner-event-content" class="day-planner-tab-content hidden space-y-6">
                    <form id="quest-event-form" class="space-y-6">
                        <input type="hidden" id="quest-event-date">
                        <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                            <div>
                                <label for="quest-event-type" class="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">Event Type</label>
                                <select id="quest-event-type"
                                    class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold text-gray-700"
                                    required>
                                    <option value="" disabled selected>Select an event type...</option>
                                    <optgroup label="Standard Events">
                                        <option value="2x Star Day">2x Star Day</option>
                                        <option value="Reason Bonus Day">Reason Bonus Day</option>
                                    </optgroup>
                                    <optgroup label="Special Quests">
                                        <option value="Vocabulary Vault">Vocabulary Vault</option>
                                        <option value="The Unbroken Chain">The Unbroken Chain</option>
                                        <option value="Grammar Guardians">Grammar Guardians</option>
                                        <option value="The Scribe's Sketch">The Scribe's Sketch</option>
                                        <option value="Five-Sentence Saga">Five-Sentence Saga</option>
                                    </optgroup>
                                </select>
                            </div>
                            
                            <div id="quest-event-description"
                                class="hidden text-sm text-purple-700 bg-purple-50 p-4 rounded-xl border-l-4 border-purple-400 font-medium leading-relaxed">
                            </div>
                            
                            <div id="quest-event-details-container" class="space-y-4"></div>
                        </div>

                        <button type="submit"
                            class="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-title text-xl py-4 rounded-2xl shadow-lg shadow-purple-200 transition-all active:scale-95">
                            <i class="fas fa-magic mr-2"></i> Summon Event
                        </button>
                    </form>
                </div>
            </div>
        </div>
    </div>
`;
