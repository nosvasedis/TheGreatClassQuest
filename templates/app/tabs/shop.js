// templates/app/tabs/shop.js

export const shopTabHTML = `
            <div id="shop-tab" class="app-tab hidden">
                <div class="max-w-7xl mx-auto">
                    <!-- Tab Header -->
                    <div class="text-center mb-6">
                        <i class="fas fa-store text-fuchsia-600 text-5xl floating-icon"></i>
                        <h2 id="shop-title" class="font-title text-5xl text-fuchsia-700 mt-2 bottom-nav-tab-title"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Mystic Market</h2>
                        <p id="shop-month" class="text-lg text-gray-600 mt-2 font-bold uppercase tracking-widest"></p>
                    </div>

                    <!-- Controls Bar: primary cluster (class → shopper) stays left; gold/restock stay right — avoids flex-center jump when state changes -->
                    <div class="shop-controls-bar bg-white/70 backdrop-blur-sm px-5 py-3.5 rounded-2xl shadow-lg flex flex-wrap items-center gap-3 mb-8 relative z-20 w-full max-w-full">

                        <div class="shop-controls-primary flex items-center gap-3 flex-wrap min-w-0 flex-1">
                            <!-- Class Selector Pill -->
                            <div class="shop-selector-pill shop-selector-pill--class">
                                <i class="fas fa-users shop-sel-icon text-fuchsia-400"></i>
                                <select id="shop-class-select" class="shop-sel-select text-fuchsia-900">
                                    <option value="">Choose a class...</option>
                                </select>
                                <i class="fas fa-chevron-down shop-sel-arrow text-fuchsia-300"></i>
                            </div>

                            <div class="hidden sm:block h-8 w-px bg-fuchsia-200 shrink-0"></div>

                            <!-- Student Selector Pill (this element is shopHeader for badge/ring effects) -->
                            <div class="shop-selector-pill shop-selector-pill--student">
                                <i class="fas fa-hat-wizard shop-sel-icon text-purple-400"></i>
                                <select id="shop-student-select" class="shop-sel-select text-purple-900">
                                    <option value="">Choose your adventurer...</option>
                                </select>
                                <i class="fas fa-chevron-down shop-sel-arrow text-purple-300"></i>
                            </div>
                        </div>

                        <div class="shop-controls-actions flex items-center gap-3 shrink-0 ml-auto">
                            <!-- Gold Chip -->
                            <div class="shop-gold-chip shrink-0">
                                <i class="fas fa-coins text-amber-400 text-sm"></i>
                                <p id="shop-student-gold" class="font-title text-xl text-amber-500 leading-none whitespace-nowrap">0 🪙</p>
                            </div>

                            <!-- Restock Button -->
                            <button id="generate-shop-btn"
                                class="hidden shop-restock-btn font-title text-base bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white py-2.5 px-5 rounded-xl shadow-lg border-2 border-fuchsia-400 bubbly-button inline-flex items-center gap-2 shrink-0">
                                <i class="fas fa-sync-alt"></i> Restock
                            </button>
                        </div>

                    </div>

                    <!-- Shop Content Area (Dark Magical Theme) -->
                    <div id="shop-window" class="relative bg-indigo-950 border-4 border-indigo-900/50 rounded-[2rem] p-6 md:p-10 shadow-[0_20px_50px_rgba(30,27,75,0.5)] overflow-hidden min-h-[500px]">

                        <!-- Shop Curtain (shown when no class is selected) -->
                        <div id="shop-curtain" class="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-[2rem] overflow-hidden">
                            <div class="absolute inset-0" style="background: linear-gradient(135deg, rgba(15,10,60,0.97) 0%, rgba(30,27,75,0.97) 100%);"></div>
                            <div class="absolute inset-0 pointer-events-none" style="background-image: radial-gradient(circle at 30% 40%, rgba(139,92,246,0.25) 0%, transparent 55%), radial-gradient(circle at 70% 60%, rgba(217,70,239,0.18) 0%, transparent 55%);"></div>
                            <div class="relative z-10 text-center px-8">
                                <div class="text-8xl mb-6 floating-icon" style="filter: drop-shadow(0 0 24px rgba(139,92,246,0.6));">🔮</div>
                                <h3 class="font-title text-4xl text-indigo-200 mb-3">The Market Awaits</h3>
                                <p class="text-indigo-400/80 text-lg max-w-sm mx-auto">Choose a class above to lift the veil and reveal the Mystic Market's wares.</p>
                            </div>
                        </div>
                        
                        <!-- Magical Background Elements -->
                        <div class="absolute inset-0 opacity-10 pointer-events-none"
                            style="background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48ZyBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDQwTDQwIDBIMjBMMCAyME00MCA0MFYyMEwwIDQwIiBmaWxsPSIjZmJicmIyNCIgZmlsbC1vcGFjaXR5PSIwLjUiLz48L2c+PC9zdmc+');">
                        </div>
                        <div class="absolute -top-40 -right-40 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-3xl pointer-events-none"></div>
                        <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                        <!-- Shop Loader -->
                        <div id="shop-loader"
                            class="hidden absolute inset-0 z-50 flex flex-col items-center justify-center bg-indigo-950/80 backdrop-blur-md">
                            <div class="text-7xl animate-bounce mb-6 filter drop-shadow-[0_0_15px_rgba(217,70,239,0.5)]">🧙‍♂️</div>
                            <h3 class="font-title text-4xl text-amber-400 animate-pulse mb-2">The Merchant is traveling...</h3>
                            <p class="text-indigo-200 text-lg">Procuring rare artifacts from the void.</p>
                        </div>

                        <!-- Empty State -->
                        <div id="shop-empty-state"
                            class="hidden flex flex-col items-center justify-center h-full min-h-[400px] text-center relative z-10">
                            <div class="text-8xl mb-6 opacity-30 grayscale filter drop-shadow-lg">📦</div>
                            <h3 class="font-title text-4xl text-indigo-300 mb-3">Out of Stock</h3>
                            <p class="text-indigo-400/80 mb-8 text-lg max-w-md">Summon the merchant to restock this league's magical shelves with wonders and artifacts!</p>
                        </div>

                        <!-- Items Grid -->
                        <div id="shop-items-container" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 relative z-10">
                        </div>

                    </div>
                </div>
            </div>
`;
