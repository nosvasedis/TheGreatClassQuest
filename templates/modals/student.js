// templates/modals/student.js
// Edit student, award note, note, move student

export const studentModalsHTML = `
    <div id="edit-student-modal"
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[75] flex items-center justify-center p-3 sm:p-4 hidden overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-student-title">
        
        <div class="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl max-w-2xl w-full pop-in border border-cyan-100 relative overflow-hidden flex flex-col max-h-[92vh] my-auto">
            
            <!-- Top Decorative Header Banner -->
            <div class="relative px-6 pt-6 pb-5 bg-gradient-to-r from-cyan-600 via-teal-600 to-indigo-600 text-white overflow-hidden shrink-0">
                <!-- Background decorative shapes -->
                <div class="absolute -right-12 -top-12 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                <div class="absolute -left-10 -bottom-10 w-36 h-36 bg-cyan-400/20 rounded-full blur-xl pointer-events-none"></div>
                
                <div class="flex items-start justify-between gap-3 relative z-10">
                    <div class="flex items-center gap-3.5 min-w-0">
                        <!-- Student Avatar with glowing ring -->
                        <div class="relative shrink-0" id="edit-student-header-avatar-wrap">
                            <div id="edit-student-header-avatar"
                                class="enlargeable-avatar w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-white/80 shadow-md bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold text-white overflow-hidden bg-cover bg-center"
                                title="View portrait"
                                role="button"
                                tabindex="0"
                                aria-label="View portrait">
                            </div>
                            <div id="edit-student-hero-icon-badge"
                                class="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-400 border-2 border-white text-amber-950 flex items-center justify-center text-[11px] shadow-sm font-bold"
                                title="Hero Class">
                                🛡️
                            </div>
                        </div>

                        <!-- Title & Badges -->
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap mb-0.5">
                                <span class="text-[10px] font-black uppercase tracking-widest text-cyan-200 bg-black/20 px-2 py-0.5 rounded-full backdrop-blur-xs">Student Profile</span>
                                <span id="edit-student-header-class-badge" class="text-[11px] font-bold text-white/90 bg-white/15 px-2 py-0.5 rounded-full border border-white/20 truncate max-w-[140px] sm:max-w-none">
                                    Class
                                </span>
                                <span id="edit-student-header-guild-badge" class="hidden text-[11px] font-bold text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-300/30 truncate">
                                    Guild
                                </span>
                            </div>
                            <h2 id="edit-student-title" class="font-title text-xl sm:text-2xl text-white font-bold tracking-tight truncate drop-shadow-sm">
                                Edit Student Details
                            </h2>
                            <p id="edit-student-header-subtitle" class="text-xs text-cyan-100/90 truncate">
                                Customize profile, celebrations & hero path
                            </p>
                        </div>
                    </div>

                    <!-- Top Close Button -->
                    <button type="button" id="edit-student-top-close-btn"
                        class="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-lg bubbly-button transition-all duration-200 backdrop-blur-xs border border-white/30"
                        title="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Stats summary chips row -->
                <div class="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                    <div class="bg-black/20 backdrop-blur-xs rounded-xl py-1.5 px-2 border border-white/10">
                        <span class="text-[10px] uppercase font-bold text-cyan-200 block">Total</span>
                        <span id="edit-student-stat-total-stars" class="font-title font-bold text-yellow-300 text-sm">0 ⭐</span>
                    </div>
                    <div class="bg-black/20 backdrop-blur-xs rounded-xl py-1.5 px-2 border border-white/10">
                        <span class="text-[10px] uppercase font-bold text-cyan-200 block">Month</span>
                        <span id="edit-student-stat-monthly-stars" class="font-title font-bold text-amber-300 text-sm">0 🌟</span>
                    </div>
                    <div class="bg-black/20 backdrop-blur-xs rounded-xl py-1.5 px-2 border border-white/10">
                        <span class="text-[10px] uppercase font-bold text-cyan-200 block">Gold</span>
                        <span id="edit-student-stat-gold" class="font-title font-bold text-amber-200 text-sm">0 🪙</span>
                    </div>
                    <div class="bg-black/20 backdrop-blur-xs rounded-xl py-1.5 px-2 border border-white/10">
                        <span class="text-[10px] uppercase font-bold text-cyan-200 block">Hero Rank</span>
                        <span id="edit-student-stat-hero-level" class="font-title font-bold text-cyan-100 text-sm">Lvl 0</span>
                    </div>
                </div>
            </div>

            <!-- Tab Navigation Bar -->
            <div class="flex items-center gap-1.5 px-4 sm:px-6 py-2.5 bg-slate-100/90 border-b border-slate-200/80 overflow-x-auto shrink-0 scrollbar-none" role="tablist" aria-label="Student edit sections">
                <button type="button" id="edit-student-tab-profile-btn" data-tab="profile"
                    class="edit-student-tab-btn active flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-cyan-700 bg-white shadow-sm border border-cyan-200/60"
                    role="tab" aria-selected="true" aria-controls="edit-student-panel-profile">
                    <i class="fas fa-id-card text-cyan-600"></i>
                    <span>Profile</span>
                </button>
                <button type="button" id="edit-student-tab-dates-btn" data-tab="dates"
                    class="edit-student-tab-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    role="tab" aria-selected="false" aria-controls="edit-student-panel-dates">
                    <i class="fas fa-cake-candles text-pink-500"></i>
                    <span>Special Dates</span>
                </button>
                <button type="button" id="edit-student-tab-hero-btn" data-tab="hero"
                    class="edit-student-tab-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    role="tab" aria-selected="false" aria-controls="edit-student-panel-hero">
                    <i class="fas fa-shield-halved text-indigo-500"></i>
                    <span>Hero Path</span>
                </button>
                <button type="button" id="edit-student-tab-actions-btn" data-tab="actions"
                    class="edit-student-tab-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    role="tab" aria-selected="false" aria-controls="edit-student-panel-actions">
                    <i class="fas fa-bolt text-amber-500"></i>
                    <span>Quick Hub</span>
                </button>
            </div>

            <!-- Tab Panels Content Container (Scrollable) -->
            <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-slate-50/70 space-y-4">
                <input type="hidden" id="edit-student-id-input-full">

                <!-- TAB 1: Profile & Identity -->
                <div id="edit-student-panel-profile" class="edit-student-tab-panel space-y-4" role="tabpanel" aria-labelledby="edit-student-tab-profile-btn">
                    <!-- Student Name Input Card -->
                    <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                        <label for="edit-student-name-input-full" class="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                            <i class="fas fa-user-graduate text-cyan-600"></i>
                            <span>Student Name</span>
                        </label>
                        <div class="flex items-center gap-3">
                            <button type="button" id="edit-student-open-avatar-btn"
                                class="edit-student-forge-btn bubbly-button shrink-0"
                                title="Open Avatar Forge"
                                aria-label="Open Avatar Forge">
                                <span id="edit-student-avatar-preview-box" class="edit-student-forge-btn__portrait"></span>
                                <span class="edit-student-forge-btn__spark" aria-hidden="true">
                                    <i class="fas fa-wand-magic-sparkles"></i>
                                </span>
                            </button>
                            <div class="relative min-w-0 flex-1">
                                <input type="text" id="edit-student-name-input-full"
                                    class="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold text-slate-800 text-base focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all"
                                    placeholder="Enter student's full name..."
                                    autocomplete="off" required>
                                <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <i class="fas fa-pencil-alt"></i>
                                </div>
                            </div>
                        </div>
                        <p id="edit-student-avatar-status" class="sr-only">Using initials</p>
                        <p class="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <i class="fas fa-info-circle text-cyan-500"></i>
                            <span>This name appears on class rosters, adventure logs, and parent portals.</span>
                        </p>
                    </div>

                    <!-- Class & Guild Placement Info Cards -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between gap-3">
                            <div class="min-w-0">
                                <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Enrolled Class</span>
                                <p id="edit-student-current-class-display" class="font-bold text-slate-800 text-sm truncate">--</p>
                                <p id="edit-student-current-league-display" class="text-[11px] text-cyan-600 font-semibold truncate">--</p>
                            </div>
                            <button type="button" id="edit-student-quick-move-btn"
                                class="shrink-0 p-2 text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-xl border border-cyan-200 text-xs font-bold bubbly-button flex items-center gap-1 transition-colors"
                                title="Transfer to another class">
                                <i class="fas fa-exchange-alt"></i>
                                <span>Move</span>
                            </button>
                        </div>

                        <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between gap-3">
                            <div class="min-w-0">
                                <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Guild House</span>
                                <p id="edit-student-current-guild-display" class="font-bold text-slate-800 text-sm truncate">Unassigned</p>
                                <p id="edit-student-current-guild-desc" class="text-[11px] text-amber-600 font-semibold truncate">No guild assigned</p>
                            </div>
                            <button type="button" id="edit-student-quick-guild-btn"
                                class="shrink-0 p-2 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 text-xs font-bold bubbly-button flex items-center gap-1 transition-colors"
                                title="Guild Sorting Quiz">
                                <i class="fas fa-hat-wizard"></i>
                                <span>Sort</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- TAB 2: Special Dates & Celebrations -->
                <div id="edit-student-panel-dates" class="edit-student-tab-panel hidden space-y-4" role="tabpanel" aria-labelledby="edit-student-tab-dates-btn">
                    <!-- Birthday Card -->
                    <div class="bg-white p-4 sm:p-5 rounded-2xl border border-pink-100 shadow-sm space-y-3">
                        <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <div class="w-8 h-8 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center text-sm shadow-xs">
                                    <i class="fas fa-cake-candles"></i>
                                </div>
                                <div>
                                    <h4 class="font-bold text-slate-800 text-sm">Student Birthday</h4>
                                    <p class="text-[11px] text-slate-500">Celebrated with extra stars & fanfare during attendance</p>
                                </div>
                            </div>
                            <button type="button" id="edit-student-clear-birthday-btn"
                                class="text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-colors px-2 py-1 rounded-lg hover:bg-rose-50"
                                title="Clear Birthday">
                                Clear
                            </button>
                        </div>

                        <div class="grid grid-cols-2 gap-2.5">
                            <div>
                                <label for="edit-student-birthday-month" class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Month</label>
                                <select id="edit-student-birthday-month"
                                    class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-100 outline-none transition-all">
                                </select>
                            </div>
                            <div>
                                <label for="edit-student-birthday-day" class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Day</label>
                                <select id="edit-student-birthday-day"
                                    class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-100 outline-none transition-all">
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Nameday Card with AI Lookup -->
                    <div class="bg-white p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-sm space-y-3">
                        <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <div class="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm shadow-xs">
                                    <i class="fas fa-calendar-check"></i>
                                </div>
                                <div>
                                    <h4 class="font-bold text-slate-800 text-sm">Nameday</h4>
                                    <p class="text-[11px] text-slate-500">Greek Orthodox name day celebration</p>
                                </div>
                            </div>
                            <button type="button" id="edit-student-clear-nameday-btn"
                                class="text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-colors px-2 py-1 rounded-lg hover:bg-rose-50"
                                title="Clear Nameday">
                                Clear
                            </button>
                        </div>

                        <div class="flex items-end gap-2.5">
                            <div class="flex-1 grid grid-cols-2 gap-2.5">
                                <div>
                                    <label for="edit-student-nameday-month" class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Month</label>
                                    <select id="edit-student-nameday-month"
                                        class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all">
                                    </select>
                                </div>
                                <div>
                                    <label for="edit-student-nameday-day" class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Day</label>
                                    <select id="edit-student-nameday-day"
                                        class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all">
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 text-center">AI Lookup</label>
                                <button type="button" id="lookup-nameday-btn"
                                    class="bg-indigo-600 hover:bg-indigo-700 text-white h-[42px] px-3.5 rounded-xl bubbly-button flex items-center justify-center gap-1.5 shadow-sm transition-all text-xs font-bold shrink-0"
                                    title="AI Nameday Lookup (Greek Orthodox calendar)">
                                    <i class="fas fa-magic"></i>
                                    <span class="hidden sm:inline">Lookup</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Celebration Highlight Info Banner -->
                    <div class="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 flex items-center gap-3">
                        <span class="text-2xl shrink-0">✨</span>
                        <p class="text-xs text-amber-900 font-medium">
                            <b class="font-bold">Special Day Celebrations:</b> When a student celebrates their Birthday or Nameday, a special banner and celebration modal are triggered to award bonus stars and fanfare!
                        </p>
                    </div>
                </div>

                <!-- TAB 3: Hero Path -->
                <div id="edit-student-panel-hero" class="edit-student-tab-panel hidden space-y-4" role="tabpanel" aria-labelledby="edit-student-tab-hero-btn">
                    <div class="flex items-center justify-between gap-2">
                        <div>
                            <h4 class="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                                <i class="fas fa-shield-halved text-indigo-600"></i>
                                <span>Hero Path</span>
                            </h4>
                            <p class="text-xs text-slate-500">Each class earns +10 extra Gold for stars in their specialized virtue</p>
                        </div>
                        <button type="button" id="edit-student-open-skilltree-btn"
                            class="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-bold rounded-xl bubbly-button flex items-center gap-1.5 transition-colors shrink-0"
                            title="Open Hero Skill Tree">
                            <i class="fas fa-sitemap"></i>
                            <span class="hidden sm:inline">Skill Tree</span>
                        </button>
                    </div>

                    <div id="edit-student-hero-summary"
                        class="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex items-center gap-3 flex-wrap sm:flex-nowrap">
                        <div id="edit-student-hero-summary-icon"
                            class="w-14 h-14 rounded-2xl bg-indigo-50 text-2xl flex items-center justify-center shrink-0 border border-indigo-100">
                            🌟
                        </div>
                        <div class="min-w-0 flex-1">
                            <p id="edit-student-hero-summary-name" class="font-bold text-slate-800 text-sm">No Class</p>
                            <p id="edit-student-hero-summary-virtue" class="text-[11px] text-indigo-600 font-semibold truncate">Unassigned</p>
                            <p id="edit-student-hero-summary-perk" class="text-[11px] text-slate-500">Leave unassigned, or open the ceremony so they can choose.</p>
                        </div>
                        <button type="button" id="edit-student-choose-hero-class-btn"
                            class="shrink-0 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl bubbly-button flex items-center gap-1.5 transition-colors">
                            <i class="fas fa-hat-wizard"></i>
                            <span id="edit-student-choose-hero-class-label">Choose Hero Class</span>
                        </button>
                    </div>

                    <div class="p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-100">
                        <p id="hero-class-tier-note" class="text-xs text-indigo-700 leading-relaxed font-medium">
                            Classes grant +10 extra Gold when earning stars for their specific trait.
                        </p>
                    </div>
                </div>

                <!-- TAB 4: Quick Hub & Actions -->
                <div id="edit-student-panel-actions" class="edit-student-tab-panel hidden space-y-3" role="tabpanel" aria-labelledby="edit-student-tab-actions-btn">
                    <p class="text-xs text-slate-500 font-medium">Quickly jump to student tools, records, and celebrations:</p>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <!-- Avatar Forge -->
                        <button type="button" id="edit-student-hub-avatar-btn"
                            class="p-3.5 bg-white hover:bg-indigo-50/50 rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-xs flex items-center gap-3 transition-all text-left group bubbly-button">
                            <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                <i class="fas fa-wand-magic-sparkles"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <h5 class="font-bold text-slate-800 text-sm">Avatar Forge</h5>
                                <p class="text-[11px] text-slate-500">Create or update a hero portrait</p>
                            </div>
                            <i class="fas fa-chevron-right text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform"></i>
                        </button>

                        <!-- Skill Tree -->
                        <button type="button" id="edit-student-hub-skilltree-btn"
                            class="p-3.5 bg-white hover:bg-purple-50/50 rounded-2xl border border-slate-200 hover:border-purple-300 shadow-xs flex items-center gap-3 transition-all text-left group bubbly-button">
                            <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                <i class="fas fa-sitemap"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <h5 class="font-bold text-slate-800 text-sm">Hero Skill Tree</h5>
                                <p class="text-[11px] text-slate-500">Talents & active abilities</p>
                            </div>
                            <i class="fas fa-chevron-right text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform"></i>
                        </button>

                        <!-- Hero's Chronicle -->
                        <button type="button" id="edit-student-hub-chronicle-btn"
                            class="p-3.5 bg-white hover:bg-emerald-50/50 rounded-2xl border border-slate-200 hover:border-emerald-300 shadow-xs flex items-center gap-3 transition-all text-left group bubbly-button">
                            <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                <i class="fas fa-book-reader"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <h5 class="font-bold text-slate-800 text-sm">Hero's Chronicle</h5>
                                <p class="text-[11px] text-slate-500">Adventure notes & Oracle AI</p>
                            </div>
                            <i class="fas fa-chevron-right text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform"></i>
                        </button>

                        <!-- Student Analytics -->
                        <button type="button" id="edit-student-hub-analytics-btn"
                            class="p-3.5 bg-white hover:bg-cyan-50/50 rounded-2xl border border-slate-200 hover:border-cyan-300 shadow-xs flex items-center gap-3 transition-all text-left group bubbly-button">
                            <div class="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-600 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <h5 class="font-bold text-slate-800 text-sm">Student Analytics</h5>
                                <p class="text-[11px] text-slate-500">Scores, grades & history</p>
                            </div>
                            <i class="fas fa-chevron-right text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform"></i>
                        </button>

                        <!-- Certificate -->
                        <button type="button" id="edit-student-hub-certificate-btn"
                            class="p-3.5 bg-white hover:bg-amber-50/50 rounded-2xl border border-slate-200 hover:border-amber-300 shadow-xs flex items-center gap-3 transition-all text-left group bubbly-button">
                            <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                <i class="fas fa-award"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <h5 class="font-bold text-slate-800 text-sm">Certificate</h5>
                                <p class="text-[11px] text-slate-500">Generate award certificate</p>
                            </div>
                            <i class="fas fa-chevron-right text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform"></i>
                        </button>

                        <!-- Move Student -->
                        <button type="button" id="edit-student-hub-move-btn"
                            class="p-3.5 bg-white hover:bg-yellow-50/50 rounded-2xl border border-slate-200 hover:border-yellow-300 shadow-xs flex items-center gap-3 transition-all text-left group bubbly-button">
                            <div class="w-10 h-10 rounded-xl bg-yellow-100 text-yellow-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                <i class="fas fa-people-arrows"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <h5 class="font-bold text-slate-800 text-sm">Move Student</h5>
                                <p class="text-[11px] text-slate-500">Transfer to another class</p>
                            </div>
                            <i class="fas fa-chevron-right text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Sticky Modal Footer -->
            <div class="px-6 py-4 bg-white border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
                <button type="button" id="edit-student-cancel-btn"
                    class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl bubbly-button transition-colors">
                    Cancel
                </button>
                <button type="button" id="edit-student-confirm-btn"
                    class="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white font-title text-base rounded-xl shadow-md bubbly-button flex items-center gap-2 transition-all">
                    <i class="fas fa-check"></i>
                    <span>Save Changes</span>
                </button>
            </div>
        </div>
    </div>

    <div id="award-note-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full pop-in border-4 border-blue-300">
            <h2 class="font-title text-2xl text-blue-700 mb-4 text-center">Teacher's Note for Award</h2>
            <input type="hidden" id="award-note-log-id-input">
            <div class="mb-4">
                <label for="award-note-textarea" class="block text-sm font-medium text-gray-700">Your personal note for
                    this award:</label>
                <textarea id="award-note-textarea" rows="4"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"></textarea>
            </div>
            <div class="flex justify-around gap-4 mt-6">
                <button id="award-note-cancel-btn"
                    class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-2 px-8 rounded-xl bubbly-button">Cancel</button>
                <button id="award-note-confirm-btn"
                    class="w-full bg-blue-500 hover:bg-blue-600 text-white font-title text-lg py-2 px-8 rounded-xl bubbly-button">Save
                    Note</button>
            </div>
        </div>
    </div>

    <div id="note-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full pop-in border-4 border-blue-300">
            <h2 class="font-title text-2xl text-blue-700 mb-4 text-center">Teacher's Note for Adventure Log</h2>
            <input type="hidden" id="note-log-id-input">
            <div class="mb-4">
                <label for="note-textarea" class="block text-sm font-medium text-gray-700">Your personal note for this
                    day's log:</label>
                <textarea id="note-textarea" rows="4"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"></textarea>
            </div>
            <div class="flex justify-around gap-4 mt-6">
                <button id="note-cancel-btn"
                    class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-2 px-8 rounded-xl bubbly-button">Cancel</button>
                <button id="note-confirm-btn"
                    class="w-full bg-blue-500 hover:bg-blue-600 text-white font-title text-lg py-2 px-8 rounded-xl bubbly-button">Save
                    Note</button>
            </div>
        </div>
    </div>

    <div id="move-student-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div class="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full pop-in border-4 border-yellow-300">
            <h2 class="font-title text-2xl text-yellow-800 mb-4 text-center">Move Student</h2>
            <p class="text-center mb-2">Moving: <b id="move-student-name" class="text-lg"></b></p>
            <p class="text-center text-sm text-gray-600 mb-6">From: <span id="move-student-current-class"></span></p>
            <div class="mb-4">
                <label for="move-student-target-class" class="block text-sm font-medium text-gray-700">Select new class
                    (must be in the same league):</label>
                <select id="move-student-target-class"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"></select>
            </div>
            <div class="flex justify-around gap-4 mt-6">
                <button id="move-student-cancel-btn"
                    class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-title text-lg py-2 px-8 rounded-xl bubbly-button">Cancel</button>
                <button id="move-student-confirm-btn"
                    class="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-title text-lg py-2 px-8 rounded-xl bubbly-button">Confirm
                    Move</button>
            </div>
        </div>
    </div>
`;
