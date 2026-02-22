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

    <div id="avatar-maker-modal"
        class="fixed inset-0 bg-black bg-opacity-50 z-[72] flex items-center justify-center p-4 hidden">
        <div
            class="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-5xl w-full pop-in border-4 border-blue-300 flex flex-col md:flex-row gap-6 max-h-[90vh]">
            <div class="flex-1 flex flex-col min-h-0">
                <div class="text-center flex-shrink-0">
                    <h2 class="font-title text-2xl md:text-3xl text-blue-700">Avatar Forge</h2>
                    <p id="avatar-maker-student-name" class="font-semibold text-lg text-gray-600"></p>
                </div>

                <div id="avatar-maker-options-wrapper" class="mt-4 flex-grow space-y-4 overflow-y-auto pr-3">
                    <div class="avatar-maker-option-pool">
                        <h3 class="font-bold text-gray-700 mb-2 text-center">1. Choose a Creature</h3>
                        <div id="avatar-creature-pool" class="flex flex-wrap justify-center gap-2"></div>
                    </div>

                    <div class="avatar-maker-option-pool">
                        <h3 class="font-bold text-gray-700 mb-2 text-center">2. Choose a Main Color</h3>
                        <div id="avatar-color-pool" class="flex flex-wrap justify-center gap-2"></div>
                    </div>

                    <div class="avatar-maker-option-pool">
                        <h3 class="font-bold text-gray-700 mb-2 text-center">3. Choose an Accessory</h3>
                        <div id="avatar-accessory-pool" class="flex flex-wrap justify-center gap-2"></div>
                    </div>
                </div>
            </div>

            <div class="md:w-1/3 flex flex-col items-center justify-between">
                <div id="avatar-display-area" class="mb-4">
                    <div id="avatar-maker-placeholder" class="text-center text-gray-500 p-4">
                        <i class="fas fa-magic text-4xl"></i>
                        <p class="mt-2 font-semibold">Your creation will appear here!</p>
                    </div>
                    <div id="avatar-maker-loader" class="text-center text-gray-500 p-4 hidden">
                        <i class="fas fa-spinner fa-spin text-4xl"></i>
                        <p class="mt-2 font-semibold">Forging avatar...</p>
                    </div>
                    <img id="avatar-maker-img" class="hidden" src="" alt="Generated Avatar">
                </div>

                <div class="w-full space-y-2">
                    <button id="avatar-generate-btn"
                        class="w-full bg-blue-500 hover:bg-blue-600 text-white font-title text-xl py-3 rounded-xl bubbly-button disabled:opacity-50"
                        disabled>
                        <i class="fas fa-magic mr-2"></i> Generate
                    </button>
                    <div id="avatar-post-generation-btns" class="hidden w-full space-y-2">
                        <button id="avatar-save-btn"
                            class="w-full bg-green-500 hover:bg-green-600 text-white font-title text-xl py-3 rounded-xl bubbly-button">
                            <i class="fas fa-save mr-2"></i> Save Avatar
                        </button>
                        <button id="avatar-retry-btn"
                            class="w-full bg-gray-500 hover:bg-gray-600 text-white font-title text-lg py-2 rounded-xl bubbly-button">
                            <i class="fas fa-redo mr-2"></i> Try Again
                        </button>
                    </div>
                    <button id="avatar-delete-btn"
                        class="w-full bg-red-100 text-red-700 font-semibold text-sm py-2 rounded-lg mt-2 bubbly-button hidden">
                        <i class="fas fa-trash-alt mr-2"></i> Remove Avatar
                    </button>
                    <button id="avatar-maker-close-btn"
                        class="w-full text-sm text-gray-600 hover:underline mt-2">Close</button>
                </div>
            </div>
        </div>
    </div>
`;
