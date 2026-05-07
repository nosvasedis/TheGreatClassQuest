// templates/app/tabs/shop.js

export const shopTabHTML = `
            <div id="shop-tab" class="app-tab hidden">
                <div class="max-w-7xl mx-auto">
                    <!-- Tab Header -->
                    <div class="text-center mb-6">
                        <i class="fas fa-store text-fuchsia-600 text-5xl floating-icon"></i>
                        <h2 id="shop-title" class="font-title text-5xl text-fuchsia-700 mt-2"
                            style="text-shadow: 0 2px 4px rgba(0,0,0,0.1);">The Mystic Market</h2>
                        <p id="shop-month" class="text-lg text-gray-600 mt-2 font-bold uppercase tracking-widest"></p>
                    </div>

                    <!-- Controls Bar (Glassmorphism) -->
                    <div class="bg-white/70 backdrop-blur-sm p-4 rounded-2xl shadow-lg flex flex-wrap items-center justify-center mb-8 gap-4 md:gap-6 relative z-20">
                        
                        <div class="shop-class-shell flex items-center gap-3 bg-white/70 p-2.5 rounded-xl border-2 border-fuchsia-200 shadow-inner w-full md:w-auto">
                            <div class="shop-class-display">
                                <span id="shop-class-icon" class="shop-class-display__icon">🏫</span>
                                <span id="shop-class-name" class="shop-class-display__text">All classes in selected league</span>
                            </div>
                            <select id="shop-class-select"
                                class="shop-class-select bg-white border-2 border-fuchsia-300 text-fuchsia-900 text-sm font-bold rounded-lg focus:ring-fuchsia-500 focus:border-fuchsia-500 block w-full md:w-auto p-2.5 outline-none shadow-sm min-w-[200px] transition-all">
                                <option value="">Select a class...</option>
                            </select>
                        </div>

                        <div class="flex items-center gap-4 bg-white/60 p-2 rounded-xl border-2 border-fuchsia-200 shadow-inner w-full md:w-auto">
                            <div class="text-right flex-1 md:flex-none">
                                <p class="text-fuchsia-800 text-[10px] uppercase font-bold tracking-wider">Purse</p>
                                <p id="shop-student-gold"
                                    class="font-title text-2xl text-amber-500 leading-none whitespace-nowrap drop-shadow-sm">0 🪙</p>
                            </div>
                            <select id="shop-student-select"
                                class="bg-white border-2 border-fuchsia-300 text-fuchsia-900 text-sm font-bold rounded-lg focus:ring-fuchsia-500 focus:border-fuchsia-500 block w-full md:w-auto p-2.5 outline-none shadow-sm min-w-[220px] transition-all">
                                <option value="">Choose your adventurer...</option>
                            </select>
                        </div>

                        <button id="generate-shop-btn"
                            class="hidden font-title text-lg bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white py-3 px-6 rounded-xl shadow-lg border-2 border-fuchsia-400 bubbly-button transform hover:scale-105 inline-flex items-center shrink-0">
                            <i class="fas fa-sync-alt mr-2"></i> Restock Market
                        </button>

                    </div>

                    <!-- Shop Content Area (Dark Magical Theme) -->
                    <div class="relative bg-indigo-950 border-4 border-indigo-900/50 rounded-[2rem] p-6 md:p-10 shadow-[0_20px_50px_rgba(30,27,75,0.5)] overflow-hidden min-h-[500px]">
                        
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
