// templates/app/tabs/classes.js

export const classesTabHTML = `
            <div id="my-classes-tab" class="app-tab hidden">
                <div class="max-w-4xl mx-auto">
                    <div class="text-center mb-6">
                        <i class="fas fa-chalkboard-teacher text-green-600 text-5xl floating-icon"></i>
                        <h2 class="font-title text-5xl text-green-700 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">My Classes</h2>
                        <p class="text-lg text-gray-600 mt-2">Manage your existing classes here and open a quick modal whenever you want to forge a new one.</p>
                    </div>
                    <div class="bg-gradient-to-r from-emerald-500 via-green-500 to-lime-500 p-[2px] rounded-[2rem] shadow-xl mb-6">
                        <div class="bg-white/95 backdrop-blur-sm rounded-[1.8rem] px-5 py-5 md:px-6 md:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <p class="text-[11px] uppercase tracking-[0.35em] font-black text-emerald-600 mb-2">Class Forge</p>
                                <h3 class="font-title text-3xl text-green-800 leading-tight">Create a New Class</h3>
                                <p class="text-sm text-gray-600 mt-1">Open a focused setup modal without leaving your class management view.</p>
                            </div>
                            <button id="open-create-class-modal-btn" type="button"
                                class="shrink-0 inline-flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-title text-xl px-6 py-4 rounded-2xl shadow-lg bubbly-button">
                                <i class="fas fa-plus-circle text-lg"></i>
                                <span>Create Class</span>
                            </button>
                        </div>
                    </div>
                    <div id="class-list" class="space-y-4"></div>
                </div>
            </div>
`;
