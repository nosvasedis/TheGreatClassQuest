// templates/modals/trophyRoom.js
// Trophy room, shop, avatar maker

export const trophyRoomModalsHTML = `
    <div id="trophy-room-modal"
        class="fixed inset-0 bg-black bg-opacity-80 z-[80] flex items-center justify-center p-4 hidden">
        <div
            class="bg-indigo-950 rounded-3xl shadow-2xl max-w-7xl w-full max-h-[95vh] flex flex-col pop-in border-4 border-amber-500 overflow-x-hidden overflow-y-auto relative">
            <button id="trophy-room-close-btn"
                class="absolute top-4 right-4 text-white/50 hover:text-white text-3xl z-30 transition-colors">&times;</button>
            <div class="bg-indigo-900/90 p-4 md:p-6 flex flex-col md:flex-row justify-between items-center border-b-4 border-amber-700/50 shadow-xl z-20 gap-4 backdrop-blur-md flex-shrink-0">
                <div class="flex items-center gap-4">
                    <div class="text-5xl filter drop-shadow-lg">🏆</div>
                    <div>
                        <h2 class="font-title text-2xl md:text-4xl text-amber-400" style="text-shadow: 0 4px 0 #78350f;">Trophy Room</h2>
                        <p class="text-indigo-200 text-sm font-bold uppercase tracking-widest opacity-80 mt-1">Treasures collected on the quest</p>
                    </div>
                </div>
                <div class="flex items-center gap-3 bg-black/30 p-2 rounded-xl border border-amber-500/30">
                    <p class="text-indigo-300 text-[10px] uppercase font-bold hidden sm:block">Adventurer</p>
                    <select id="trophy-room-student-select"
                        class="bg-indigo-900/50 border border-amber-500/50 text-white text-sm font-bold rounded-lg focus:ring-amber-500 focus:border-amber-500 block p-2.5 outline-none min-w-[180px]">
                        <option value="">Choose adventurer...</option>
                    </select>
                </div>
            </div>
            <div id="trophy-room-content" class="flex-grow overflow-y-auto overflow-x-visible p-6 min-h-0 flex items-center justify-center custom-scrollbar relative z-10">
            </div>
        </div>
    </div>

    <div id="shop-modal"
        class="fixed inset-0 bg-black bg-opacity-80 z-[80] flex items-center justify-center p-4 hidden">
        <div
            class="bg-indigo-950 rounded-3xl shadow-2xl max-w-7xl w-full h-[90vh] flex flex-col pop-in border-4 border-amber-500 overflow-hidden relative">

            <button id="shop-close-btn"
                class="absolute top-4 right-4 text-white/50 hover:text-white text-3xl z-30 transition-colors">&times;</button>

            <div
                class="bg-indigo-900/90 p-4 md:p-6 flex flex-col md:flex-row justify-between items-center border-b-4 border-indigo-800 shadow-xl z-20 gap-4 backdrop-blur-md">
                <div class="flex items-center gap-4">
                    <div class="text-6xl filter drop-shadow-lg">🎪</div>
                    <div>
                        <h2 id="shop-title" class="font-title text-3xl md:text-5xl text-amber-400"
                            style="text-shadow: 0 4px 0 #78350f;">The Mystic Market</h2>
                        <p id="shop-month"
                            class="text-indigo-200 text-sm font-bold uppercase tracking-widest opacity-80 mt-1 ml-1">
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <button id="generate-shop-btn"
                        class="bg-indigo-800 hover:bg-indigo-700 text-indigo-200 hover:text-white border border-indigo-600 font-bold py-2 px-4 rounded-xl transition-all text-sm flex items-center gap-2">
                        <i class="fas fa-sync-alt"></i> Restock
                    </button>

                    <div class="flex items-center gap-3 bg-black/30 p-2 rounded-xl border border-indigo-500/30">
                        <div class="text-right hidden lg:block">
                            <p class="text-indigo-300 text-[10px] uppercase font-bold">Purse</p>
                            <p id="shop-student-gold"
                                class="font-title text-2xl text-yellow-400 leading-none whitespace-nowrap">0 🪙</p>
                        </div>
                        <select id="shop-student-select"
                            class="bg-indigo-900/50 border border-indigo-500/50 text-white text-sm font-bold rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full p-2.5 outline-none">
                            <option value="">Choose your adventurer...</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="flex-grow overflow-y-auto p-6 md:p-8 relative custom-scrollbar">
                <div class="absolute inset-0 opacity-10 pointer-events-none"
                    style="background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48ZyBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDQwTDQwIDBIMjBMMCAyME00MCA0MFYyMEwwIDQwIiBmaWxsPSIjZmJicmIyNCIgZmlsbC1vcGFjaXR5PSIwLjUiLz48L2c+PC9zdmc+');">
                </div>

                <div id="shop-loader"
                    class="hidden absolute inset-0 z-50 flex flex-col items-center justify-center bg-indigo-950/80 backdrop-blur-sm">
                    <div class="text-6xl animate-bounce mb-4">🧙‍♂️</div>
                    <h3 class="font-title text-3xl text-amber-400 animate-pulse">The Merchant is traveling...</h3>
                    <p class="text-indigo-200">Procuring rare artifacts from the void.</p>
                </div>

                <div id="shop-items-container"
                    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 relative z-10 pb-20">
                </div>

                <div id="shop-empty-state"
                    class="hidden flex flex-col items-center justify-center h-full text-center min-h-[400px]">
                    <div class="text-8xl mb-6 opacity-50">📦</div>
                    <h3 class="font-title text-4xl text-indigo-300 mb-2">Out of Stock</h3>
                    <p class="text-indigo-400 mb-8 text-lg">Summon the merchant to restock this league's shelves!</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Purchase Success Modal -->
    <div id="shop-purchase-modal"
        class="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] flex items-center justify-center p-4 hidden">
        <div class="bg-gradient-to-br from-indigo-900 to-purple-950 rounded-3xl shadow-2xl max-w-sm w-full pop-in border-4 border-amber-500/50 overflow-hidden text-center">
            <!-- Success Header -->
            <div class="bg-gradient-to-r from-amber-500 to-orange-500 p-6 relative overflow-hidden">
                <div class="absolute inset-0 opacity-30">
                    <div class="absolute top-2 left-4 text-4xl animate-bounce">✨</div>
                    <div class="absolute top-4 right-6 text-3xl animate-pulse">🎉</div>
                    <div class="absolute bottom-2 left-8 text-2xl animate-bounce delay-100">⭐</div>
                </div>
                <div class="text-6xl mb-2 relative z-10">🛒</div>
                <h2 class="font-title text-3xl text-white drop-shadow-lg relative z-10">Purchase Complete!</h2>
            </div>
            
            <!-- Content -->
            <div class="p-6">
                <div id="shop-purchase-item" class="bg-white/10 rounded-2xl p-4 mb-4 border border-white/20">
                    <div id="shop-purchase-icon" class="text-5xl mb-2">📦</div>
                    <h3 id="shop-purchase-name" class="font-title text-xl text-amber-300">Item Name</h3>
                    <p id="shop-purchase-desc" class="text-indigo-300 text-sm mt-1">Item description</p>
                </div>
                
                <div class="flex justify-center gap-6 mb-4">
                    <div class="text-center">
                        <p class="text-indigo-400 text-xs uppercase font-bold">Cost</p>
                        <p id="shop-purchase-cost" class="font-title text-2xl text-red-400">-10 🪙</p>
                    </div>
                    <div class="text-center">
                        <p class="text-indigo-400 text-xs uppercase font-bold">Remaining</p>
                        <p id="shop-purchase-balance" class="font-title text-2xl text-green-400">90 🪙</p>
                    </div>
                </div>
                
                <p id="shop-purchase-student" class="text-indigo-300 text-sm mb-4">
                    <i class="fas fa-user mr-2"></i><span>Student Name</span>'s inventory
                </p>
                
                <button id="shop-purchase-close-btn"
                    class="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all">
                    <i class="fas fa-check mr-2"></i>Awesome!
                </button>
            </div>
        </div>
    </div>

    <div id="avatar-maker-modal"
        class="fixed inset-0 bg-black/75 backdrop-blur-sm z-[72] flex items-center justify-center p-4 hidden">
        <div class="relative bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl shadow-2xl max-w-4xl w-full pop-in border border-purple-500/40 flex flex-col max-h-[92vh] overflow-hidden"
            style="box-shadow: 0 0 80px rgba(124,58,237,0.18), 0 25px 50px rgba(0,0,0,0.6);">

            <!-- Subtle inner glow ring -->
            <div class="absolute inset-0 rounded-3xl pointer-events-none"
                style="box-shadow: inset 0 0 60px rgba(139,92,246,0.07);"></div>

            <!-- Header -->
            <div class="relative flex items-center gap-3 px-6 py-4 border-b border-white/10 flex-shrink-0 bg-black/20">
                <span class="text-3xl leading-none">⚒️</span>
                <div class="flex-1 min-w-0">
                    <h2 class="font-title text-2xl text-purple-300 leading-tight"
                        style="text-shadow: 0 0 24px rgba(167,139,250,0.5);">Avatar Forge</h2>
                    <p id="avatar-maker-student-name" class="text-indigo-400 text-sm font-semibold truncate"></p>
                </div>
                <button id="avatar-maker-close-btn"
                    class="text-white/40 hover:text-white text-2xl leading-none w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-all bubbly-button flex-shrink-0">&times;</button>
            </div>

            <!-- Body: options (left/top) + preview (right/bottom) -->
            <div class="relative flex flex-col md:flex-row flex-1 min-h-0">

                <!-- Left: scrollable option pools -->
                <div id="avatar-maker-options-wrapper" class="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">

                    <!-- Step 1: Creature -->
                    <div class="avatar-forge-step">
                        <div class="flex items-center gap-2.5 mb-3">
                            <div class="avatar-step-number">1</div>
                            <h3 class="text-xs font-bold text-indigo-300 uppercase tracking-widest">Choose a Creature</h3>
                            <i id="step-creature-check" class="fas fa-check-circle text-emerald-400 ml-auto hidden text-base"></i>
                        </div>
                        <div id="avatar-creature-pool" class="flex flex-wrap gap-1.5"></div>
                    </div>

                    <!-- Step 2: Color -->
                    <div class="avatar-forge-step">
                        <div class="flex items-center gap-2.5 mb-3">
                            <div class="avatar-step-number">2</div>
                            <h3 class="text-xs font-bold text-indigo-300 uppercase tracking-widest">Choose a Main Color</h3>
                            <i id="step-color-check" class="fas fa-check-circle text-emerald-400 ml-auto hidden text-base"></i>
                        </div>
                        <div id="avatar-color-pool" class="flex flex-wrap gap-1.5"></div>
                    </div>

                    <!-- Step 3: Accessory -->
                    <div class="avatar-forge-step">
                        <div class="flex items-center gap-2.5 mb-3">
                            <div class="avatar-step-number">3</div>
                            <h3 class="text-xs font-bold text-indigo-300 uppercase tracking-widest">Choose an Accessory</h3>
                            <i id="step-accessory-check" class="fas fa-check-circle text-emerald-400 ml-auto hidden text-base"></i>
                        </div>
                        <div id="avatar-accessory-pool" class="flex flex-wrap gap-1.5"></div>
                    </div>

                </div>

                <!-- Right: preview + action buttons -->
                <div class="w-full md:w-60 lg:w-64 flex flex-col items-center gap-4 p-5 border-t md:border-t-0 md:border-l border-white/10 bg-black/25 flex-shrink-0">

                    <!-- Preview frame -->
                    <div id="avatar-display-area">
                        <div id="avatar-maker-placeholder" class="text-center text-indigo-400/80">
                            <div class="text-5xl mb-2 opacity-70">✨</div>
                            <p class="text-xs font-semibold leading-relaxed">Your avatar<br>will appear here</p>
                        </div>
                        <div id="avatar-maker-loader" class="hidden text-center">
                            <div class="text-4xl mb-2" style="animation: avatar-forge-bounce 0.8s ease-in-out infinite;">⚒️</div>
                            <p class="font-title text-base text-purple-300" style="animation: forge-pulse 1s ease-in-out infinite;">Forging...</p>
                        </div>
                        <img id="avatar-maker-img" class="hidden" src="" alt="Generated Avatar">
                    </div>

                    <!-- Action buttons -->
                    <div class="w-full space-y-2">
                        <button id="avatar-generate-btn"
                            class="w-full text-white font-title text-lg py-3 rounded-xl bubbly-button disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            style="background: linear-gradient(135deg, #7c3aed, #2563eb); box-shadow: 0 4px 18px rgba(124,58,237,0.4);"
                            disabled>
                            <i class="fas fa-fire mr-2"></i>Forge Avatar
                        </button>
                        <div id="avatar-post-generation-btns" class="hidden space-y-2">
                            <button id="avatar-save-btn"
                                class="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-title text-lg py-3 rounded-xl bubbly-button transition-colors"
                                style="box-shadow: 0 4px 14px rgba(16,185,129,0.3);">
                                <i class="fas fa-save mr-2"></i>Save Avatar
                            </button>
                            <button id="avatar-retry-btn"
                                class="w-full bg-white/10 hover:bg-white/15 text-indigo-200 font-bold text-sm py-2.5 rounded-xl bubbly-button transition-colors border border-white/15">
                                <i class="fas fa-redo mr-1.5"></i>Try Again
                            </button>
                        </div>
                        <button id="avatar-delete-btn"
                            class="w-full hidden bg-transparent hover:bg-red-500/10 text-red-400/60 hover:text-red-300 text-xs font-semibold py-2 rounded-xl bubbly-button transition-all border border-red-500/15">
                            <i class="fas fa-trash-alt mr-1.5"></i>Remove Current Avatar
                        </button>
                    </div>

                </div>
            </div>
        </div>
    </div>
`;
