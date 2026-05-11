// templates/app/tabs/shop.js

export const shopTabHTML = `
            <div id="shop-tab" class="app-tab hidden">
                <div class="max-w-7xl mx-auto px-3 sm:px-4">
                    <div class="text-center mb-6">
                        <i class="fas fa-store text-fuchsia-600 text-5xl floating-icon"></i>
                        <h2 id="shop-title" class="font-title text-5xl text-fuchsia-700 mt-2 bottom-nav-tab-title"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Mystic Market</h2>
                        <p id="shop-tagline" class="text-lg text-gray-600 mt-2 max-w-3xl mx-auto">
                            Legends, seasonal treasures, and companion eggs — pick a shopper, check their purse, then browse.
                        </p>
                    </div>

                    <!-- Unified shop shell: mystical shop-window frame -->
                    <div id="shop-window"
                        class="shop-window-shell relative flex flex-col overflow-visible min-h-[520px]">

                        <div class="absolute inset-0 bg-gradient-to-br from-indigo-950 via-[#1e1b4b] to-[#0f172a] pointer-events-none z-[1] rounded-[inherit]"></div>
                        <div class="absolute inset-0 opacity-[0.07] pointer-events-none shop-window-noise z-[1] rounded-[inherit]"></div>
                        <div class="absolute -top-32 -right-32 w-[420px] h-[420px] bg-fuchsia-500/18 rounded-full blur-3xl pointer-events-none z-[1]"></div>
                        <div class="absolute -bottom-40 -left-20 w-[380px] h-[380px] bg-amber-400/12 rounded-full blur-3xl pointer-events-none z-[1]"></div>
                        <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/35 to-transparent pointer-events-none z-[2]"></div>

                        <div class="shop-window-lattice" aria-hidden="true">
                            <span class="shop-window-lintel"></span>
                            <span class="shop-window-corner shop-window-corner--tl"></span>
                            <span class="shop-window-corner shop-window-corner--tr"></span>
                            <span class="shop-window-corner shop-window-corner--bl"></span>
                            <span class="shop-window-corner shop-window-corner--br"></span>
                        </div>

                        <!-- Command deck (merged shopper · purse · restock) -->
                        <div id="shop-command-deck" class="shop-command-deck relative z-30 shrink-0 border-b border-white/10">
                            <div class="shop-command-deck__inner flex flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 p-4 sm:p-5">
                                <div class="shop-command-deck__primary flex flex-col gap-1 min-w-0 flex-1">
                                    <span class="shop-deck-label"><i class="fas fa-user-circle"></i> Shopper</span>
                                    <div class="shop-controls-primary flex items-center gap-3 flex-wrap min-w-0">
                                        <div class="shop-selector-pill shop-selector-pill--student shop-selector-pill--dark shop-selector-pill--shopper">
                                            <i class="fas fa-hat-wizard shop-sel-icon shop-sel-icon--shopper text-fuchsia-400"></i>
                                            <div class="shop-shopper" id="shop-shopper-root">
                                                <button type="button" id="shop-shopper-trigger" class="shop-shopper__trigger"
                                                    aria-haspopup="listbox" aria-expanded="false" aria-controls="shop-shopper-listbox">
                                                    <span class="shop-shopper__trigger-text">
                                                        <span class="shop-shopper__trigger-label">Shopper</span>
                                                        <span class="shop-shopper__trigger-value" id="shop-shopper-display">Choose your adventurer…</span>
                                                    </span>
                                                    <span class="shop-shopper__chev" aria-hidden="true"><i class="fas fa-chevron-down"></i></span>
                                                </button>
                                                <div id="shop-shopper-listbox" class="shop-shopper__panel" role="listbox" aria-hidden="true"></div>
                                            </div>
                                            <select id="shop-student-select" class="shop-shopper-native" tabindex="-1" aria-hidden="true">
                                                <option value="">Choose your adventurer…</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div class="shop-command-deck__actions flex flex-wrap items-center gap-3 w-full sm:w-auto sm:ml-auto sm:justify-end">
                                    <div class="flex flex-col gap-1 min-w-0">
                                        <span class="shop-deck-label"><i class="fas fa-wallet"></i> Purse</span>
                                        <div class="shop-purse-glass shrink-0" aria-live="polite">
                                            <div class="shop-purse-glass__icon" aria-hidden="true">
                                                <i class="fas fa-coins"></i>
                                            </div>
                                            <div class="shop-purse-glass__body">
                                                <span class="shop-purse-glass__label">Gold</span>
                                                <p id="shop-student-gold" class="shop-purse-glass__amount">0 🪙</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex flex-col gap-1 justify-end sm:pt-5">
                                        <span class="shop-deck-label opacity-0 hidden sm:block pointer-events-none select-none" aria-hidden="true">.</span>
                                        <button id="generate-shop-btn" type="button"
                                            class="hidden shop-restock-btn font-title text-sm sm:text-base bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-600 text-white py-2.5 px-5 rounded-xl shadow-[0_8px_24px_rgba(147,51,234,0.35)] border border-fuchsia-400/50 bubbly-button inline-flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto">
                                            <i class="fas fa-sync-alt"></i> Restock
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Catalog region (curtain / loader / grid — same frame, deck stays visible) -->
                        <div id="shop-catalog" class="shop-catalog relative flex-1 flex flex-col min-h-[380px] z-10 p-4 sm:p-6 md:p-8 pt-4 overflow-hidden">

                            <div class="absolute inset-0 opacity-[0.11] pointer-events-none shop-catalog-pattern"></div>

                            <!-- Shop Curtain (shown when no class is selected) -->
                            <div id="shop-curtain" class="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden shop-catalog-overlay">
                                <div class="absolute inset-0 shop-curtain-bg"></div>
                                <div class="absolute inset-0 pointer-events-none shop-curtain-glow"></div>
                                <div class="relative z-10 text-center px-6 max-w-md">
                                    <div class="text-7xl sm:text-8xl mb-5 floating-icon shop-curtain-icon">🔮</div>
                                    <h3 class="font-title text-3xl sm:text-4xl text-indigo-100 mb-2 tracking-tight">The Market Sleeps</h3>
                                    <p class="text-indigo-300/85 text-base leading-relaxed">Pick a class from the header to lift the veil — then choose a shopper and browse the stalls.</p>
                                </div>
                            </div>

                            <!-- Shop Loader -->
                            <div id="shop-loader"
                                class="hidden absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0f0a2e]/85 backdrop-blur-md shop-catalog-overlay">
                                <div class="text-6xl sm:text-7xl animate-bounce mb-5 filter drop-shadow-[0_0_18px_rgba(217,70,239,0.45)]">🧙‍♂️</div>
                                <h3 class="font-title text-2xl sm:text-3xl text-amber-300 animate-pulse mb-2 text-center px-4">The Merchant is traveling…</h3>
                                <p class="text-indigo-200/90 text-center px-4">Procuring rare artifacts from the void.</p>
                            </div>

                            <!-- Empty State -->
                            <div id="shop-empty-state"
                                class="hidden flex flex-col items-center justify-center flex-1 min-h-[320px] text-center relative z-10 py-8">
                                <div class="text-7xl mb-5 opacity-35 grayscale filter drop-shadow-lg">📦</div>
                                <h3 class="font-title text-3xl text-indigo-200 mb-2">The Shelves Are Bare</h3>
                                <p class="text-indigo-400/90 mb-2 text-base max-w-md leading-relaxed">Nothing on display yet — summon fresh stock so heroes have something to save coins for.</p>
                                <p class="text-indigo-500/80 text-sm max-w-sm">Elite teachers can use <strong class="text-fuchsia-300 font-title">Restock</strong> for AI-crafted seasonal treasures.</p>
                            </div>

                            <!-- Items Grid -->
                            <div id="shop-items-container" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 sm:gap-6 relative z-10">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
`;
