// templates/app/tabs/award.js

export const awardTabHTML = `
            <div id="award-stars-tab" class="app-tab hidden">
                <div class="max-w-4xl mx-auto">
                    <div class="text-center mb-6">
                        <i class="fas fa-star text-rose-500 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-rose-700 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Award Stars</h2>
                        <p class="text-lg text-gray-600 mt-2">Recognize your students' excellence and effort.</p>
                    </div>

                    <div id="award-class-dropdown" class="relative max-w-md mx-auto mb-6">
                        <button id="award-class-dropdown-btn"
                            class="w-full flex items-center justify-between p-4 rounded-2xl border-4 border-rose-300 bg-white shadow-lg bubbly-button">
                            <span class="flex items-center gap-3">
                                <span id="selected-class-logo" class="text-4xl"></span>
                                <div class="text-left">
                                    <div id="selected-class-name" class="font-bold text-lg text-rose-800">Select a
                                        class...</div>
                                    <div id="selected-class-level" class="text-sm text-rose-500 -mt-1"></div>
                                </div>
                            </span>
                            <i class="fas fa-chevron-down text-rose-500 transition-transform"></i>
                        </button>
                        <div id="award-class-dropdown-panel"
                            class="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl z-20 hidden overflow-hidden border-2 border-rose-200">
                            <div id="award-class-list" class="max-h-64 overflow-y-auto"></div>
                        </div>
                    </div>

                    <div class="flex justify-center mb-6">
                        <button id="open-bounty-modal-btn"
                            class="w-full md:w-auto bg-amber-100 text-amber-800 font-title text-xl py-3 px-8 rounded-2xl bubbly-button shadow-md hover:bg-amber-200 border-2 border-amber-300 transition-transform hover:scale-105">
                            <i class="fas fa-crosshairs mr-2"></i> Post a Bounty
                        </button>
                    </div>

                    <div id="award-stars-student-list" class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <p
                            class="text-center text-gray-700 bg-white/70 backdrop-blur-sm p-4 rounded-2xl text-lg col-span-full">
                            Please select a class to award stars.</p>
                    </div>
                </div>
            </div>
`;
