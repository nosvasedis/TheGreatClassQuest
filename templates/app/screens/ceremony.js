// templates/app/screens/ceremony.js

export const ceremonyHTML = `
    <div id="ceremony-screen"
        class="fixed inset-0 z-[100] hidden overflow-hidden bg-gray-900 transition-opacity duration-1000">

        <div class="absolute inset-0 z-0">
            <div id="ceremony-bg-gradient"
                class="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-black opacity-80"></div>
            <div id="ceremony-confetti-container" class="absolute inset-0 pointer-events-none"></div>
            <div
                class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-pulse-slow">
            </div>
        </div>

        <div class="relative z-10 ceremony-layout w-full h-full px-3 py-2 md:px-5 md:py-4">

            <div id="ceremony-header" class="text-center transform transition-all duration-500">
                <h2 id="ceremony-title"
                    class="font-title text-4xl md:text-6xl text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] mb-1">
                    The Great Class Quest</h2>
                <p id="ceremony-subtitle"
                    class="text-base md:text-xl text-indigo-200 font-semibold tracking-widest uppercase"></p>
            </div>

            <div id="ceremony-stage-area"
                class="w-full perspective-1000">
            </div>

            <div id="ceremony-ai-box"
                class="w-full max-w-4xl bg-black/40 backdrop-blur-md border border-white/20 p-4 rounded-2xl text-center min-h-[84px] flex items-center justify-center opacity-0 transition-opacity duration-500">
                <p id="ceremony-ai-text" class="text-base md:text-lg text-white font-serif italic text-shadow"></p>
            </div>

            <div class="pb-2">
                <button id="ceremony-action-btn"
                    class="bubbly-button bg-gradient-to-r from-amber-400 to-orange-500 text-white font-title text-xl md:text-2xl py-3 md:py-4 px-8 md:px-12 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.6)] hover:scale-105 transition-transform border-4 border-white/30">
                    Start Ceremony
                </button>
            </div>
        </div>
    </div>
`;
