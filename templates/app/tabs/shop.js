// templates/app/tabs/shop.js

export const shopTabHTML = `
            <div id="shop-tab" class="app-tab hidden">
                <div class="max-w-7xl mx-auto h-full flex flex-col">
                    <div class="bg-indigo-950 rounded-3xl shadow-2xl w-full flex flex-col border-4 border-amber-500 overflow-hidden relative min-h-[80vh]">

                        <div class="bg-indigo-900/90 p-4 md:p-6 flex flex-col md:flex-row justify-between items-center border-b-4 border-indigo-800 shadow-xl z-20 gap-4 backdrop-blur-md">
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
                                    <div class="text-right">
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
            </div>
`;
