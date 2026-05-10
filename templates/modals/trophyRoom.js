// templates/modals/trophyRoom.js
// Trophy room, shop, avatar maker

export const trophyRoomModalsHTML = `
    <div id="trophy-room-modal"
        class="fixed inset-0 bg-black bg-opacity-80 z-[80] flex items-center justify-center p-4 hidden">
        <div
            class="bg-indigo-950 rounded-3xl shadow-2xl max-w-7xl w-full max-h-[95vh] flex flex-col pop-in border-4 border-amber-500 overflow-hidden relative">
            <button id="trophy-room-close-btn"
                class="absolute top-4 right-4 text-white/50 hover:text-white text-3xl z-30 transition-colors">&times;</button>
            <div class="absolute inset-0 pointer-events-none opacity-20"
                style="background: radial-gradient(circle at top, rgba(251,191,36,0.28), transparent 34%), radial-gradient(circle at bottom right, rgba(59,130,246,0.18), transparent 28%);"></div>
            <div class="bg-indigo-900/90 p-4 md:p-6 flex flex-col md:flex-row justify-between items-center border-b-4 border-amber-700/50 shadow-xl z-20 gap-4 backdrop-blur-md flex-shrink-0 relative">
                <div class="flex items-center gap-4">
                    <div class="text-5xl filter drop-shadow-lg">🏆</div>
                    <div>
                        <h2 class="font-title text-2xl md:text-4xl text-amber-400" style="text-shadow: 0 4px 0 #78350f;">Trophy Room</h2>
                        <p class="text-indigo-200 text-sm font-bold uppercase tracking-widest opacity-80 mt-1">Character vault and collected relics</p>
                    </div>
                </div>
                <div class="flex items-center gap-3 bg-black/30 p-2 rounded-xl border border-amber-500/30 flex-wrap justify-end">
                    <div class="flex items-center gap-2">
                        <p class="text-indigo-300 text-[10px] uppercase font-bold hidden sm:block">Class</p>
                        <p id="trophy-room-class-label" class="bg-indigo-900/50 border border-amber-500/50 text-white text-sm font-bold rounded-lg px-3 py-2 min-w-[160px] text-center"></p>
                    </div>
                    <div class="flex items-center gap-2">
                        <p class="text-indigo-300 text-[10px] uppercase font-bold hidden sm:block">Adventurer</p>
                        <select id="trophy-room-student-select"
                            class="bg-indigo-900/50 border border-amber-500/50 text-white text-sm font-bold rounded-lg focus:ring-amber-500 focus:border-amber-500 block p-2.5 outline-none min-w-[180px]">
                            <option value="">Choose adventurer...</option>
                        </select>
                    </div>
                </div>
            </div>
            <div id="trophy-room-content" class="flex-grow overflow-y-auto p-4 md:p-6 min-h-0 flex items-start justify-center custom-scrollbar relative z-10">
            </div>
        </div>
    </div>



    <!-- Purchase Success Modal — z-[100] ensures it appears above the shop (z-[80]) -->
    <div id="shop-purchase-modal"
        class="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 hidden">
        <div class="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-950 rounded-3xl shadow-2xl max-w-sm w-full pop-in overflow-hidden text-center"
             style="box-shadow: 0 0 0 2px rgba(251,191,36,0.4), 0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(251,191,36,0.15);">

            <!-- Floating particles -->
            <div class="absolute inset-0 pointer-events-none overflow-hidden">
                <div class="absolute top-3 left-6 text-3xl animate-bounce" style="animation-delay:0s">✨</div>
                <div class="absolute top-6 right-8 text-2xl animate-pulse" style="animation-delay:0.3s">🎉</div>
                <div class="absolute top-[55%] left-3 text-xl animate-bounce" style="animation-delay:0.6s">⭐</div>
                <div class="absolute top-[60%] right-4 text-2xl animate-pulse" style="animation-delay:0.9s">💫</div>
                <div class="absolute bottom-16 left-10 text-lg animate-bounce" style="animation-delay:0.2s">🪙</div>
                <div class="absolute bottom-20 right-6 text-xl animate-pulse" style="animation-delay:0.5s">✨</div>
            </div>

            <!-- Success Header -->
            <div class="relative bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 overflow-hidden"
                 style="box-shadow: 0 8px 32px rgba(251,146,60,0.4);">
                <div class="absolute inset-0 opacity-20"
                     style="background: radial-gradient(circle at 30% 50%, white 0%, transparent 60%);"></div>
                <div class="text-7xl mb-2 relative z-10 drop-shadow-lg">🛒</div>
                <h2 class="font-title text-3xl text-white relative z-10"
                    style="text-shadow: 0 2px 8px rgba(0,0,0,0.3);">Purchase Complete!</h2>
                <p class="text-amber-100 text-sm mt-1 relative z-10 opacity-80">Added to your collection</p>
            </div>

            <!-- Content -->
            <div class="p-6 relative z-10">
                <!-- Item card -->
                <div id="shop-purchase-item"
                     class="bg-white/8 rounded-2xl p-4 mb-5 border border-amber-500/25"
                     style="background: rgba(255,255,255,0.05); box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);">
                    <div id="shop-purchase-icon" class="text-5xl mb-2 flex justify-center items-center min-h-[60px]">📦</div>
                    <h3 id="shop-purchase-name" class="font-title text-xl text-amber-300 leading-tight">Item Name</h3>
                    <p id="shop-purchase-desc" class="text-indigo-300 text-xs mt-1 line-clamp-2 leading-relaxed">Item description</p>
                </div>

                <!-- Cost / Balance row -->
                <div class="flex justify-center gap-4 mb-5">
                    <div class="flex-1 bg-red-500/15 border border-red-500/30 rounded-xl p-3 text-center">
                        <p class="text-red-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Cost</p>
                        <p id="shop-purchase-cost" class="font-title text-2xl text-red-300">-10 🪙</p>
                    </div>
                    <div class="flex-1 bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-3 text-center">
                        <p class="text-emerald-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Balance</p>
                        <p id="shop-purchase-balance" class="font-title text-2xl text-emerald-300">90 🪙</p>
                    </div>
                </div>

                <!-- Student badge -->
                <p id="shop-purchase-student"
                   class="text-indigo-300 text-xs mb-5 flex items-center justify-center gap-2 bg-indigo-800/40 px-3 py-2 rounded-full border border-indigo-600/30 mx-auto w-fit">
                    <i class="fas fa-user text-indigo-400"></i>
                    <span class="font-bold text-indigo-200">Student Name</span>'s inventory
                </p>

                <!-- Action buttons -->
                <div class="flex flex-col gap-3 mb-3">
                    <button id="shop-purchase-use-btn"
                        class="hidden bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                        style="box-shadow: 0 4px 20px rgba(251,146,60,0.35);">
                        <i class="fas fa-bolt mr-2"></i>Use Now
                    </button>
                    <button id="shop-purchase-close-btn"
                        class="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                        style="box-shadow: 0 4px 20px rgba(16,185,129,0.35);">
                        <i class="fas fa-check mr-2"></i>Awesome!
                    </button>
                </div>

                <!-- Auto-close progress bar -->
                <div class="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div id="shop-purchase-timer-bar"
                         class="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-none"
                         style="width:100%;"></div>
                </div>
                <p class="text-indigo-500 text-[10px] mt-1.5">Closes automatically in 3 seconds</p>
            </div>
        </div>
    </div>

    <div id="avatar-maker-modal"
        class="fixed inset-0 bg-black/80 backdrop-blur-xl z-[72] flex items-center justify-center p-4 hidden overflow-hidden">
        
        <!-- Background Decorative Elements -->
        <div class="absolute inset-0 pointer-events-none overflow-hidden">
            <div class="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse"></div>
            <div class="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse" style="animation-delay: 2s;"></div>
            <div id="forge-particles-container" class="absolute inset-0 opacity-30"></div>
        </div>

        <div class="relative bg-slate-950/80 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] max-w-5xl w-full pop-in border border-white/10 flex flex-col max-h-[92vh] overflow-hidden backdrop-blur-2xl"
            style="box-shadow: 0 0 0 1px rgba(255,255,255,0.05), 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 100px rgba(124,58,237,0.1);">

            <!-- Top Header with "Forge" vibe -->
            <div class="relative px-8 py-6 flex-shrink-0 bg-white/5 border-b border-white/5 overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-700 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-purple-900/40 border border-white/20 transform -rotate-3">⚒️</div>
                        <div>
                            <h2 class="font-title text-3xl text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-white to-blue-200 tracking-tight"
                                style="text-shadow: 0 0 20px rgba(167,139,250,0.3);">Avatar Forge</h2>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <p id="avatar-maker-student-name" class="text-indigo-300/80 text-sm font-medium tracking-wide"></p>
                            </div>
                        </div>
                    </div>
                    <button id="avatar-maker-close-btn"
                        class="text-white/30 hover:text-white text-3xl leading-none w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-all duration-300 hover:rotate-90 flex-shrink-0">&times;</button>
                </div>
            </div>

            <!-- Main Content Area -->
            <div class="relative flex flex-col lg:flex-row flex-1 min-h-0">
                
                <!-- Left Column: Selection Pools -->
                <div id="avatar-maker-options-wrapper" class="flex-1 overflow-y-auto p-8 space-y-8 min-h-0 custom-scrollbar">
                    
                    <!-- Progress Bar (Subtle) -->
                    <div class="flex justify-between items-center px-2 mb-2">
                        <span class="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400/60">Crafting Progress</span>
                        <div class="flex gap-1">
                            <div id="step-creature-dot" class="w-2 h-2 rounded-full bg-white/10 transition-colors duration-500"></div>
                            <div id="step-color-dot" class="w-2 h-2 rounded-full bg-white/10 transition-colors duration-500"></div>
                            <div id="step-accessory-dot" class="w-2 h-2 rounded-full bg-white/10 transition-colors duration-500"></div>
                        </div>
                    </div>

                    <!-- Step 1: Creature -->
                    <div class="avatar-forge-card group">
                        <div class="flex items-center gap-4 mb-5">
                            <div class="avatar-step-badge">1</div>
                            <div>
                                <h3 class="text-sm font-black text-white uppercase tracking-widest">Select Origin</h3>
                                <p class="text-[10px] text-indigo-400 font-bold uppercase tracking-wider opacity-60">Choose your base creature</p>
                            </div>
                            <div id="step-creature-check" class="ml-auto w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center opacity-0 transition-opacity duration-300">
                                <i class="fas fa-check text-xs"></i>
                            </div>
                        </div>
                        <div id="avatar-creature-pool" class="flex flex-wrap gap-2"></div>
                    </div>

                    <!-- Step 2: Color -->
                    <div class="avatar-forge-card group">
                        <div class="flex items-center gap-4 mb-5">
                            <div class="avatar-step-badge">2</div>
                            <div>
                                <h3 class="text-sm font-black text-white uppercase tracking-widest">Essence Color</h3>
                                <p class="text-[10px] text-indigo-400 font-bold uppercase tracking-wider opacity-60">Infuse with magical aura</p>
                            </div>
                            <div id="step-color-check" class="ml-auto w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center opacity-0 transition-opacity duration-300">
                                <i class="fas fa-check text-xs"></i>
                            </div>
                        </div>
                        <div id="avatar-color-pool" class="flex flex-wrap gap-2"></div>
                    </div>

                    <!-- Step 3: Accessory -->
                    <div class="avatar-forge-card group">
                        <div class="flex items-center gap-4 mb-5">
                            <div class="avatar-step-badge">3</div>
                            <div>
                                <h3 class="text-sm font-black text-white uppercase tracking-widest">Relic & Gear</h3>
                                <p class="text-[10px] text-indigo-400 font-bold uppercase tracking-wider opacity-60">Equip unique artifacts</p>
                            </div>
                            <div id="step-accessory-check" class="ml-auto w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center opacity-0 transition-opacity duration-300">
                                <i class="fas fa-check text-xs"></i>
                            </div>
                        </div>
                        <div id="avatar-accessory-pool" class="flex flex-wrap gap-2"></div>
                    </div>

                </div>

                <!-- Right Column: Summoning Circle / Preview -->
                <div class="w-full lg:w-[380px] bg-black/40 border-t lg:border-t-0 lg:border-l border-white/5 p-8 flex flex-col items-center justify-between gap-8">
                    
                    <div class="w-full flex flex-col items-center">
                        <p class="text-[10px] font-black text-purple-400/60 uppercase tracking-[0.3em] mb-8">Summoning Circle</p>
                        
                        <!-- The Magic Circle Preview -->
                        <div class="relative group">
                            <!-- Animated Rings -->
                            <div class="absolute -inset-8 border border-purple-500/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
                            <div class="absolute -inset-4 border border-blue-500/20 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
                            <div class="absolute -inset-12 border-2 border-dashed border-white/5 rounded-full animate-[spin_30s_linear_infinite]"></div>
                            
                            <!-- Main Display Area -->
                            <div id="avatar-display-area" class="relative z-10 w-64 h-64 rounded-[2rem] bg-slate-900 shadow-[0_0_50px_rgba(124,58,237,0.2)] overflow-hidden flex items-center justify-center border border-white/10 group-hover:border-purple-500/40 transition-all duration-500">
                                
                                <div id="avatar-maker-placeholder" class="text-center p-6">
                                    <div class="text-6xl mb-4 animate-float opacity-50">✨</div>
                                    <h4 class="text-white text-sm font-bold uppercase tracking-widest mb-2">Awaiting Forge</h4>
                                    <p class="text-[10px] text-indigo-300/50 leading-relaxed uppercase font-medium">Select all ingredients<br>to begin the ritual</p>
                                </div>

                                <div id="avatar-maker-loader" class="hidden flex flex-col items-center">
                                    <div class="relative w-24 h-24 mb-6">
                                        <div class="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse"></div>
                                        <div class="absolute inset-0 flex items-center justify-center text-5xl animate-bounce">⚒️</div>
                                    </div>
                                    <p class="font-title text-xl text-purple-200 animate-pulse tracking-widest uppercase">Forging...</p>
                                    <div class="mt-4 w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                                        <div class="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 animate-[loading-bar_2s_ease-in-out_infinite]" style="width: 50%"></div>
                                    </div>
                                </div>

                                <img id="avatar-maker-img" class="hidden w-full h-full object-cover transition-all duration-700 scale-110 group-hover:scale-100" src="" alt="Generated Avatar">
                                
                                <!-- Scanline effect -->
                                <div class="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-white/5 to-transparent h-[20%] w-full animate-[scanline_3s_linear_infinite] opacity-30"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="w-full space-y-4">
                        <button id="avatar-generate-btn"
                            class="group relative w-full h-16 rounded-2xl overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                            disabled>
                            <div class="absolute inset-0 bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 transition-all group-hover:scale-110"></div>
                            <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                            <div class="relative flex items-center justify-center gap-3 text-white font-title text-xl tracking-wider">
                                <i class="fas fa-fire animate-pulse text-orange-400"></i>
                                <span>FORGE AVATAR</span>
                            </div>
                            <!-- Shine effect -->
                            <div class="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-25deg] group-hover:animate-[shine_1s_ease-in-out]"></div>
                        </button>

                        <div id="avatar-post-generation-btns" class="hidden space-y-3">
                            <button id="avatar-save-btn"
                                class="w-full h-14 bg-emerald-500 hover:bg-emerald-400 text-white font-title text-lg rounded-2xl shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]">
                                <i class="fas fa-save"></i>
                                <span>KEEP AVATAR</span>
                            </button>
                            <button id="avatar-retry-btn"
                                class="w-full h-12 bg-white/5 hover:bg-white/10 text-indigo-200 font-bold text-xs rounded-2xl border border-white/10 transition-all uppercase tracking-widest hover:text-white">
                                <i class="fas fa-redo-alt mr-2"></i>Remix Creation
                            </button>
                        </div>

                        <button id="avatar-delete-btn"
                            class="w-full hidden h-10 bg-transparent hover:bg-red-500/10 text-red-400/40 hover:text-red-400 text-[10px] font-black rounded-xl transition-all border border-red-500/5 hover:border-red-500/20 uppercase tracking-[0.2em]">
                            <i class="fas fa-trash-alt mr-2"></i>Destroy Current
                        </button>
                    </div>

                </div>
            </div>
        </div>
    </div>

`;
