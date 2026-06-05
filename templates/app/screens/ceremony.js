// templates/app/screens/ceremony.js

export const ceremonyHTML = `
    <div id="ceremony-screen"
        class="fixed inset-0 z-[100] hidden overflow-hidden bg-gray-900 transition-opacity duration-1000">

        <div class="absolute inset-0 z-0">
            <div id="ceremony-bg-gradient"
                class="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-black opacity-80"></div>
            <div id="ceremony-theme-veil" class="ceremony-theme-veil" aria-hidden="true">
                <div class="ceremony-theme-veil__layer ceremony-theme-veil__amber"></div>
                <div class="ceremony-theme-veil__layer ceremony-theme-veil__violet"></div>
                <div class="ceremony-theme-veil__sweep"></div>
            </div>
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
                class="w-full max-w-4xl bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-2xl text-center min-h-[52px] flex items-center justify-center opacity-0 transition-opacity duration-500">
                <p id="ceremony-ai-text" class="text-sm md:text-base text-white font-serif italic text-shadow"></p>
            </div>

            <div class="pb-2 ceremony-action-btn-wrap">
                <button id="ceremony-action-btn" type="button" class="ceremony-action-btn" aria-live="polite">
                    <span class="ceremony-action-btn__rim" aria-hidden="true"></span>
                    <span class="ceremony-action-btn__label">Start Ceremony</span>
                </button>
            </div>
        </div>
    </div>
`;
