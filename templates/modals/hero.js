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

    <div id="hero-level-up-modal"
        class="fixed inset-0 bg-black bg-opacity-85 z-[96] flex items-center justify-center p-4 hidden">
        <div id="hero-level-up-modal-inner"
            class="bg-gradient-to-b from-indigo-900 via-purple-900 to-violet-900 rounded-[2.5rem] shadow-2xl max-w-md w-full pop-in border-4 border-amber-400/90 relative overflow-hidden text-center p-8">
            <div class="absolute inset-0 opacity-25" style="background: radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.4) 0%, transparent 60%);"></div>
            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
            <div class="absolute top-4 left-1/2 -translate-x-1/2 text-6xl opacity-90 animate-bounce" style="animation-duration: 1.2s;">✨</div>
            <div class="absolute top-12 right-6 text-4xl opacity-70">🌟</div>
            <div class="absolute top-14 left-6 text-4xl opacity-70">🌟</div>

            <div class="relative z-10 pt-10">
                <div class="inline-block px-4 py-1.5 rounded-full bg-amber-400/95 text-amber-900 font-title font-bold text-lg shadow-[0_0_24px_rgba(250,204,21,0.5)] mb-4">
                    LEVEL UP!
                </div>
                <div id="hero-level-up-avatar"
                    class="w-28 h-28 mx-auto rounded-full border-4 border-amber-400/90 shadow-2xl mb-4 bg-white flex items-center justify-center text-5xl font-bold text-indigo-500 overflow-hidden">
                </div>
                <h2 id="hero-level-up-name" class="font-title text-3xl text-white mb-1 text-shadow-lg">Student</h2>
                <p id="hero-level-up-subtitle" class="text-purple-200 text-sm font-semibold mb-2">reached a new rank</p>
                <div id="hero-level-up-title-badge" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white font-title text-xl font-bold mb-2 shadow-lg" style="background: linear-gradient(135deg, #a855f7, #7c3aed); border: 2px solid rgba(255,255,255,0.3);">
                    <span id="hero-level-up-title-icon"></span>
                    <span id="hero-level-up-title-text">Tinkerer</span>
                </div>
                <p id="hero-level-up-level" class="text-amber-300 text-sm font-bold mb-6">Level <span id="hero-level-up-level-num">2</span></p>
                <p class="text-white/80 text-sm mb-5">Choose a new skill in the Skill Tree!</p>
                <div class="flex flex-col sm:flex-row gap-3 justify-center">
                    <button id="hero-level-up-skill-tree-btn"
                        class="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-amber-900 font-title text-lg py-3 px-6 rounded-xl bubbly-button shadow-xl border-2 border-amber-300/50">
                        <i class="fas fa-sitemap mr-2"></i> Open Skill Tree
                    </button>
                    <button id="hero-level-up-close-btn"
                        class="bg-white/20 hover:bg-white/30 text-white font-semibold py-3 px-6 rounded-xl transition-colors border border-white/30">
                        Later
                    </button>
                </div>
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
        class="fixed inset-0 bg-black/60 z-[72] flex items-center justify-center p-4 hidden backdrop-blur-md">
        <div
            class="bg-slate-50 rounded-[2.5rem] shadow-2xl max-w-5xl w-full pop-in border-4 border-white flex flex-col min-h-0 max-h-[min(92vh,calc(100dvh-1.5rem))] h-[min(88vh,calc(100dvh-2rem))] overflow-hidden">
            
            <!-- Premium Header Section -->
            <div class="relative bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white flex-shrink-0 overflow-hidden">
                <div class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
                <div class="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/20 rounded-full -ml-20 -mb-20 blur-2xl pointer-events-none"></div>
                
                <div class="relative flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div id="hero-chronicle-avatar" class="w-16 h-16 rounded-2xl border-2 border-white/30 bg-white/20 flex items-center justify-center text-3xl shadow-inner overflow-hidden">
                            <!-- Avatar injected here -->
                        </div>
                        <div>
                            <h2 class="font-title text-3xl drop-shadow-md">Hero's Chronicle</h2>
                            <p id="hero-chronicle-student-name" class="text-emerald-100 font-bold uppercase tracking-widest text-xs opacity-90"></p>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-4">
                        <!-- Tab Navigation -->
                        <div class="flex bg-black/20 p-1 rounded-2xl backdrop-blur-sm gap-0.5" role="tablist" aria-label="Chronicle sections">
                            <button type="button" id="chronicle-tab-notes" role="tab" aria-selected="true" aria-controls="hero-chronicle-content-notes"
                                class="hero-chronicle-tab-btn active px-5 py-2.5 rounded-[0.65rem] text-sm font-black uppercase tracking-wider transition-all flex items-center gap-2">
                                <i class="fas fa-book-open" aria-hidden="true"></i>
                                <span>Notes</span>
                            </button>
                            <button type="button" id="chronicle-tab-oracle" role="tab" aria-selected="false" aria-controls="hero-chronicle-content-oracle"
                                class="hero-chronicle-tab-btn px-5 py-2.5 rounded-[0.65rem] text-sm font-black uppercase tracking-wider transition-all flex items-center gap-2">
                                <i class="fas fa-wand-sparkles" aria-hidden="true"></i>
                                <span>The Oracle</span>
                            </button>
                        </div>
                        
                        <button id="hero-chronicle-close-btn"
                            class="bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Main Content Area -->
            <div class="flex-1 min-h-0 overflow-hidden relative flex flex-col bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
                
                <!-- Tab 1: Chronicle (Notes) -->
                <div id="hero-chronicle-content-notes" role="tabpanel" aria-labelledby="chronicle-tab-notes" class="flex flex-col flex-1 min-h-0 p-6 gap-6">
                    <div class="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
                        <!-- Left: Feed -->
                        <div class="flex-grow flex flex-col min-h-0">
                             <div class="flex items-center justify-between mb-3 px-2">
                                <h3 class="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <i class="fas fa-stream"></i> History of Deeds
                                </h3>
                                <span id="chronicle-note-count" class="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-bold">0 Notes</span>
                            </div>
                            <div id="hero-chronicle-notes-feed"
                                class="flex-grow space-y-4 overflow-y-auto pr-2 custom-scrollbar p-1">
                                <!-- Notes injected here -->
                            </div>
                        </div>

                        <!-- Right: Add Note Form -->
                        <div class="md:w-80 flex-shrink-0">
                            <div class="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 sticky top-0">
                                <h3 class="text-sm font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <i class="fas fa-plus-circle"></i> New Entry
                                </h3>
                                
                                <form id="hero-chronicle-note-form" class="space-y-4">
                                    <input type="hidden" id="hero-chronicle-note-id">
                                    
                                    <div>
                                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Focus Category</label>
                                        <select id="hero-chronicle-note-category"
                                            class="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-400 outline-none font-bold text-sm text-slate-700 transition-colors cursor-pointer">
                                            <option value="General">📓 General</option>
                                            <option value="Academic">🎓 Academic</option>
                                            <option value="Behavior">🎭 Behavior</option>
                                            <option value="Social">💬 Social</option>
                                            <option value="Goals">🎯 Goals</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Observations</label>
                                        <textarea id="hero-chronicle-note-text" rows="5"
                                            class="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-400 outline-none font-medium text-sm text-slate-700 transition-colors resize-none"
                                            placeholder="What happened on today's quest?"></textarea>
                                    </div>

                                    <div class="pt-2">
                                        <button type="submit"
                                            class="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-title text-lg py-3 rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-95">
                                            Record Entry
                                        </button>
                                        <button type="button" id="hero-chronicle-cancel-edit-btn"
                                            class="hidden w-full mt-2 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold py-2 rounded-xl text-sm transition-colors">
                                            Cancel Editing
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tab 2: The Oracle (AI) -->
                <div id="hero-chronicle-content-oracle" role="tabpanel" aria-labelledby="chronicle-tab-oracle" class="hidden flex flex-col flex-1 min-h-0 p-6 gap-6">
                    <div class="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
                        <!-- Left: Controls -->
                        <div class="md:w-72 flex-shrink-0 space-y-4">
                            <div class="bg-indigo-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
                                <div class="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>
                                <h3 class="relative z-10 text-sm font-black text-indigo-300 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <i class="fas fa-sparkles"></i> Oracle's Gaze
                                </h3>
                                
                                <div class="relative z-10 space-y-3">
                                    <button data-type="parent"
                                        class="ai-insight-btn w-full bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all flex items-center gap-3 border border-white/10 group">
                                        <div class="w-10 h-10 rounded-xl bg-indigo-500/30 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">👪</div>
                                        <div class="text-left">
                                            <div class="text-sm font-black leading-tight">Parent Summary</div>
                                            <div class="text-[10px] text-indigo-200">Balanced & Constructive</div>
                                        </div>
                                    </button>
                                    
                                    <button data-type="teacher"
                                        class="ai-insight-btn w-full bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all flex items-center gap-3 border border-white/10 group">
                                        <div class="w-10 h-10 rounded-xl bg-indigo-500/30 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">🧑‍🏫</div>
                                        <div class="text-left">
                                            <div class="text-sm font-black leading-tight">Teacher Strategy</div>
                                            <div class="text-[10px] text-indigo-200">Actionable Classroom Tips</div>
                                        </div>
                                    </button>
                                    
                                    <button data-type="analysis"
                                        class="ai-insight-btn w-full bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all flex items-center gap-3 border border-white/10 group">
                                        <div class="w-10 h-10 rounded-xl bg-indigo-500/30 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">📊</div>
                                        <div class="text-left">
                                            <div class="text-sm font-black leading-tight">Traits & Trends</div>
                                            <div class="text-[10px] text-indigo-200">Strengths/Weaknesses</div>
                                        </div>
                                    </button>
                                    
                                    <button data-type="goal"
                                        class="ai-insight-btn w-full bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all flex items-center gap-3 border border-white/10 group">
                                        <div class="w-10 h-10 rounded-xl bg-indigo-500/30 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">🎯</div>
                                        <div class="text-left">
                                            <div class="text-sm font-black leading-tight">Hero's Goal</div>
                                            <div class="text-[10px] text-indigo-200">SMART Monthly Targets</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                            
                            <button id="hero-chronicle-publish-parent-btn"
                                class="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-4 rounded-[1.5rem] transition-all flex flex-col items-center gap-1 border-2 border-dashed border-emerald-200 group">
                                <div class="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center text-lg group-hover:scale-110 transition-transform shadow-md">
                                    <i class="fas fa-paper-plane"></i>
                                </div>
                                <span class="text-xs font-black uppercase tracking-widest mt-1">Publish to Portal</span>
                                <span class="text-[10px] opacity-60">Visible to Parents</span>
                            </button>
                        </div>

                        <!-- Right: AI Display -->
                        <div class="flex-1 flex flex-col min-h-0">
                            <div class="flex items-center justify-between mb-3 px-2 flex-shrink-0">
                                <h3 class="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <i class="fas fa-comment-dots"></i> The Oracle's Response
                                </h3>
                                <div id="oracle-status-badge" class="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                                    <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                                    Elite AI Active
                                </div>
                            </div>
                            <div class="flex-1 min-h-[12rem] md:min-h-0 relative">
                                <div id="hero-chronicle-ai-output"
                                    class="absolute inset-0 bg-white rounded-[2rem] p-6 md:p-8 shadow-inner border border-slate-100 overflow-y-auto rich-text custom-scrollbar">
                                    <div class="h-full flex flex-col items-center justify-center text-center space-y-4">
                                        <div class="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-5xl opacity-40">🔮</div>
                                        <p class="text-slate-400 font-medium max-w-xs">Consult the records by selecting a counsel type on the left.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>

    <div id="prodigy-modal"
        class="fixed inset-0 bg-indigo-950/70 z-[95] flex items-center justify-center p-3 sm:p-4 hidden backdrop-blur-xl">
        <div
            class="prodigy-hall-shell bg-gradient-to-br from-indigo-50 via-white to-violet-50 rounded-[2rem] md:rounded-[2.5rem] max-w-5xl w-full max-h-[min(96vh,56rem)] min-h-[62vh] sm:min-h-[70vh] md:min-h-[74vh] flex flex-col relative overflow-hidden border-4 border-white pop-in">
            <span class="prodigy-hall-sparkle prodigy-hall-sparkle--1" aria-hidden="true"></span>
            <span class="prodigy-hall-sparkle prodigy-hall-sparkle--2" aria-hidden="true"></span>
            <span class="prodigy-hall-sparkle prodigy-hall-sparkle--3" aria-hidden="true"></span>
            
            <!-- Animated Background Glows -->
            <div class="absolute inset-0 pointer-events-none overflow-hidden opacity-55">
                <div class="absolute -top-40 -left-40 w-[500px] h-[500px] bg-amber-200 blur-[150px] rounded-full animate-pulse"></div>
                <div class="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-violet-400/30 blur-[150px] rounded-full animate-pulse" style="animation-delay: 1.5s;"></div>
            </div>

            <!-- Header -->
            <div class="prodigy-hall-header relative z-20 px-4 py-3.5 md:px-8 md:py-5 flex flex-wrap items-center justify-between gap-3 bg-white/55 backdrop-blur-md border-b border-indigo-100/60 flex-shrink-0">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="prodigy-hall-icon-wrap w-14 h-14 md:w-16 md:h-16 shrink-0 bg-gradient-to-tr from-violet-600 via-purple-600 to-indigo-700 rounded-xl md:rounded-[1.25rem] flex items-center justify-center text-3xl md:text-4xl border-2 border-white text-white">
                        <i class="fas fa-landmark" aria-hidden="true"></i>
                    </div>
                    <div class="min-w-0">
                        <h2 class="font-title text-3xl md:text-4xl text-indigo-950 tracking-tight leading-none">
                            Hall of Prodigies
                        </h2>
                    </div>
                </div>

                <div class="flex items-center gap-3 md:gap-5 w-full sm:w-auto justify-end">
                    <div id="prodigy-nav-container" class="flex items-center gap-2 flex-1 sm:flex-initial justify-center sm:justify-end min-w-0"></div>
                    
                    <button type="button" id="prodigy-close-btn"
                        class="prodigy-hall-close text-slate-400 hover:text-indigo-600 text-3xl leading-none w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/80 bg-white/30"
                        aria-label="Close Hall of Prodigies">
                        <i class="fas fa-circle-xmark" aria-hidden="true"></i>
                    </button>
                </div>
            </div>

            <div id="prodigy-content" class="flex-1 overflow-y-auto p-5 md:p-8 lg:p-10 custom-scrollbar relative z-10 min-h-0 bg-transparent">
                <!-- Content injected here -->
            </div>
        </div>
    </div>
`;
