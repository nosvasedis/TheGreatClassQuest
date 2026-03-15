// Teacher onboarding setup screen (shown after payment/grace when a teacher still needs setup).

export const setupHTML = `
    <div id="setup-screen" class="fixed inset-0 z-40 hidden overflow-y-auto p-4 md:p-6"
        style="background: radial-gradient(circle at top, #fef3c7 0%, #c7d2fe 36%, #8ee3f8 100%);">
        <div class="mx-auto w-full max-w-6xl">
            <div class="bg-white/90 backdrop-blur rounded-[2rem] shadow-2xl border border-white/70 overflow-hidden">
                <div class="px-6 py-8 md:px-10 md:py-10 bg-gradient-to-r from-sky-500 via-cyan-500 to-indigo-500 text-white">
                    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p class="font-black uppercase tracking-[0.25em] text-white/75 text-xs mb-2">Teacher Setup Quest</p>
                            <h1 id="setup-title" class="font-title text-4xl md:text-5xl leading-tight">Build your school’s first adventure</h1>
                            <p id="setup-subtitle" class="text-white/90 text-lg mt-3 max-w-3xl">
                                Before entering the app, let’s set up your school name, your first classes, and the students in each class.
                            </p>
                        </div>
                        <div class="bg-white/15 rounded-3xl px-5 py-4 border border-white/25 max-w-sm">
                            <p class="text-xs uppercase tracking-[0.2em] text-white/70 mb-2">What happens here</p>
                            <ul class="space-y-2 text-sm">
                                <li><i class="fas fa-check-circle mr-2"></i> Name the school if this is the very first teacher</li>
                                <li><i class="fas fa-check-circle mr-2"></i> Add each class with its league and emoji</li>
                                <li><i class="fas fa-check-circle mr-2"></i> Paste students one per line and enter the Quest</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="p-6 md:p-10 space-y-8">
                    <section id="setup-school-section" class="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-6">
                        <div class="rounded-[1.5rem] border border-sky-100 bg-sky-50/70 p-6">
                            <h2 class="font-title text-2xl text-sky-800 mb-3 flex items-center gap-2">
                                <i class="fas fa-school text-sky-500"></i> School details
                            </h2>
                            <p id="setup-school-copy" class="text-slate-600 mb-5">
                                If you are the first teacher here, give the school its name so GCQ shows it everywhere beautifully.
                            </p>

                            <label class="block text-sm font-bold text-slate-700 mb-2" for="setup-school-name">School name</label>
                            <input type="text" id="setup-school-name" placeholder="e.g. Quest Academy"
                                class="w-full px-4 py-3 border border-sky-200 rounded-2xl focus:ring-2 focus:ring-sky-500 bg-white mb-5">

                            <label class="block text-sm font-bold text-slate-700 mb-2" for="setup-school-location-search">School location (for live weather)</label>
                            <div class="flex flex-wrap gap-2 mb-2">
                                <input type="text" id="setup-school-location-search" placeholder="e.g. Patra, Chania, Volos"
                                    class="flex-1 min-w-[220px] px-4 py-3 border border-sky-200 rounded-2xl focus:ring-2 focus:ring-sky-500 bg-white">
                                <button type="button" id="setup-search-location-btn" class="bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-5 rounded-2xl bubbly-button whitespace-nowrap">
                                    <i class="fas fa-search mr-2"></i>Search
                                </button>
                            </div>
                            <select id="setup-location-results" class="hidden w-full px-4 py-3 border border-sky-200 rounded-2xl bg-white text-sm"></select>
                            <p id="setup-location-status" class="text-xs text-slate-500 mt-2">No location selected yet. Weather will use the default Athens area until you choose one.</p>
                        </div>

                        <div class="rounded-[1.5rem] border border-amber-100 bg-amber-50/80 p-6">
                            <h2 class="font-title text-2xl text-amber-800 mb-3 flex items-center gap-2">
                                <i class="fas fa-sparkles text-amber-500"></i> Gentle Reminder
                            </h2>
                            <div class="space-y-3 text-sm text-slate-700 leading-relaxed">
                                <p>This setup screen is meant for a real teacher, not a programmer. Fill in the boxes, add your classes, and press one main button at the end.</p>
                                <p>If the school is still on its first grace day, the app stays open temporarily. When that day ends, GCQ locks again until payment is completed.</p>
                                <div id="setup-grace-banner" class="hidden rounded-[1.25rem] border border-emerald-200 bg-white/90 px-4 py-4 shadow-sm">
                                    <p class="text-[11px] uppercase tracking-[0.24em] text-emerald-600 font-black mb-1">Grace Day Countdown</p>
                                    <div class="flex items-center justify-between gap-3">
                                        <div>
                                            <p id="setup-grace-copy" class="text-sm text-slate-700">Finish setup before the timer ends so the school does not lock again.</p>
                                        </div>
                                        <div class="rounded-2xl bg-emerald-50 border border-emerald-200 px-3 py-2 min-w-[126px] text-center">
                                            <p id="setup-grace-countdown" class="font-title text-xl text-emerald-800">24h 00m</p>
                                        </div>
                                    </div>
                                </div>
                                <p id="setup-ai-note" class="rounded-2xl bg-white/80 border border-amber-100 px-4 py-3">
                                    AI class-name suggestions wake up automatically only on the Elite plan.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section class="rounded-[1.75rem] border border-indigo-100 bg-indigo-50/70 p-6 md:p-8">
                        <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-5">
                            <div>
                                <h2 class="font-title text-3xl text-indigo-800 flex items-center gap-2">
                                    <i class="fas fa-chalkboard text-indigo-500"></i> Add your classes
                                </h2>
                                <p class="text-slate-600 mt-2">Create one class at a time. For each class, choose the league, the emoji, and paste the student names one per line.</p>
                            </div>
                            <div class="rounded-2xl bg-white/80 border border-indigo-100 px-4 py-3 text-sm text-slate-600">
                                <span class="font-semibold text-indigo-700">Tip:</span> If students are not decided yet, add the class now and leave the student box empty. You can add them later inside the app.
                            </div>
                        </div>

                        <div class="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
                            <div class="rounded-[1.5rem] bg-white border border-indigo-100 p-5">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label class="block text-sm font-bold text-slate-700 mb-2" for="setup-class-level">League</label>
                                        <select id="setup-class-level" class="w-full px-4 py-3 border border-indigo-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-white"></select>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-bold text-slate-700 mb-2" for="setup-class-logo-grid">Class emoji</label>
                                        <div class="rounded-2xl border border-indigo-200 bg-white p-3">
                                            <div class="flex items-center justify-between gap-3 mb-3">
                                                <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Selected</p>
                                                <div id="setup-class-logo-preview" class="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center text-2xl shadow-sm">📚</div>
                                            </div>
                                            <div id="setup-class-logo-grid" class="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-40 overflow-y-auto pr-1"></div>
                                        </div>
                                    </div>
                                </div>

                                <label class="block text-sm font-bold text-slate-700 mb-2" for="setup-class-name">Class name</label>
                                <div class="flex flex-wrap gap-2 mb-3">
                                    <input type="text" id="setup-class-name" placeholder="e.g. Star Seekers"
                                        class="flex-1 min-w-[240px] px-4 py-3 border border-indigo-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-white">
                                    <button type="button" id="setup-generate-class-name-btn" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-5 rounded-2xl bubbly-button whitespace-nowrap flex items-center justify-center gap-2">
                                        <i class="fas fa-wand-magic-sparkles"></i>
                                        <span>Suggest with AI</span>
                                    </button>
                                </div>
                                <div id="setup-class-name-suggestions" class="flex flex-wrap gap-2 mb-4"></div>

                                <label class="block text-sm font-bold text-slate-700 mb-2" for="setup-class-students">Students in this class</label>
                                <textarea id="setup-class-students" rows="7" placeholder="One student per line&#10;Maria Papadopoulou&#10;Nikos Georgiou&#10;Eleni Ioannou"
                                    class="w-full px-4 py-3 border border-indigo-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-white resize-y"></textarea>
                                <p class="text-xs text-slate-500 mt-2">Write each student’s full name on one line. GCQ keeps the whole line as the student name and uses the first word as the first name in greetings.</p>

                                <div class="mt-5 flex flex-wrap gap-3">
                                    <button type="button" id="setup-add-class-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-2xl bubbly-button flex items-center gap-2">
                                        <i class="fas fa-plus"></i> Add This Class
                                    </button>
                                    <button type="button" id="setup-clear-class-form-btn" class="bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-6 rounded-2xl border border-slate-200">
                                        Clear Form
                                    </button>
                                </div>
                            </div>

                            <div class="rounded-[1.5rem] bg-slate-900 text-white p-5 shadow-xl">
                                <div class="flex items-center justify-between gap-3 mb-4">
                                    <div>
                                        <p class="text-xs uppercase tracking-[0.25em] text-slate-400 mb-1">Ready To Save</p>
                                        <h3 class="font-title text-2xl">Your setup bundle</h3>
                                    </div>
                                    <div id="setup-draft-count" class="min-w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center font-title text-2xl">0</div>
                                </div>
                                <div id="setup-draft-classes-list" class="space-y-3 max-h-[26rem] overflow-y-auto pr-1"></div>
                            </div>
                        </div>
                    </section>

                    <section class="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-6">
                        <h2 class="font-title text-2xl text-emerald-800 mb-3 flex items-center gap-2">
                            <i class="fas fa-user-plus text-emerald-500"></i> Invite other teachers later
                        </h2>
                        <p class="text-slate-600 text-sm mb-3">After you enter the app, you can share this signup link with colleagues from the same school.</p>
                        <div class="flex flex-col md:flex-row gap-2">
                            <input type="text" id="setup-invite-link" readonly
                                class="flex-1 px-4 py-3 border border-emerald-200 rounded-2xl bg-white text-sm">
                            <button type="button" id="setup-copy-link-btn" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-5 rounded-2xl bubbly-button whitespace-nowrap">
                                <i class="fas fa-copy mr-2"></i>Copy Link
                            </button>
                        </div>
                    </section>

                    <div class="flex flex-col lg:flex-row gap-4 items-center justify-between rounded-[1.75rem] bg-slate-950 text-white px-6 py-5">
                        <div>
                            <p class="font-title text-2xl">One last step</p>
                            <p id="setup-enter-copy" class="text-slate-300">When you press this button, GCQ saves the school details, creates your classes, adds the students, and opens the app.</p>
                        </div>
                        <div class="w-full lg:w-auto text-center">
                            <button type="button" id="setup-enter-quest-btn" class="w-full lg:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-title text-xl py-4 px-8 rounded-2xl bubbly-button flex items-center justify-center gap-3">
                                <i class="fas fa-dragon"></i>
                                <span>Save Everything & Enter the Quest</span>
                            </button>
                            <p id="setup-enter-hint" class="text-xs text-amber-300 mt-3 hidden">Add at least one class before entering the app.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;
