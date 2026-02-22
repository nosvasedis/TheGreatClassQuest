// templates/app/header.js

export const headerHTML = `
        <header class="relative overflow-hidden z-10 flex justify-between p-4 shadow-md"
            style="background: linear-gradient(to right, #89f7fe 0%, #66a6ff 100%);">
            <div class="absolute inset-0 z-1">
                <i class="fas fa-cloud cloud" style="left: 10%; animation-delay: -5s;"></i>
                <i class="fas fa-cloud cloud cloud-fast" style="left: 30%; animation-delay: -15s; font-size: 6rem;"></i>
                <i class="fas fa-cloud cloud" style="left: 60%; animation-delay: -2s; font-size: 10rem;"></i>
                <i class="fas fa-cloud cloud cloud-fast" style="left: 80%; animation-delay: -25s;"></i>
            </div>

            <div class="z-10 flex flex-col justify-between">
                <div>
                    <h1 id="main-app-title" class="font-title text-4xl text-white">The Great Class Quest</h1>
                </div>
                <div id="header-quote-container"
                    class="hidden md:inline-flex items-center gap-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-1.5 shadow-md mt-2">
                    <span class="text-lg text-white/80">✨</span>
                    <p id="header-quote-text" class="font-title text-sm text-white tracking-wide"
                        style="text-shadow: 0 1px 3px rgba(0,0,0,0.2);">Loading wisdom...</p>
                    <span class="text-lg text-white/80">✨</span>
                </div>
            </div>

            <div class="z-10 flex flex-col justify-between items-end font-title hidden md:flex date-time-hover-group">
                <div id="current-date" class="text-4xl font-bold text-white text-right" style="word-spacing: 0.1em;">
                </div>

                <div class="flex items-center gap-4 mt-2">
                    <div
                        class="flex items-center gap-1 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full p-1 shadow-md">
                        <button id="app-info-btn"
                            class="hover:bg-white/40 text-white w-8 h-8 rounded-full bubbly-button transition-colors duration-300 flex items-center justify-center border border-white/30"
                            title="Game Guide" aria-label="Open Game Guide">
                            <i class="fas fa-info text-xs"></i>
                        </button>
                        <button id="projector-mode-btn"
                            class="hover:bg-white/40 text-white w-8 h-8 rounded-full bubbly-button transition-colors duration-300 flex items-center justify-center border border-white/30"
                            title="Projector Mode" aria-label="Toggle Projector Mode">
                            <i class="fas fa-tv text-xs"></i>
                        </button>
                        <button id="logout-btn"
                            class="bg-red-500/80 hover:bg-red-500 text-white w-8 h-8 rounded-full bubbly-button flex items-center justify-center border border-white/30"
                            title="Logout" aria-label="Logout">
                            <i class="fas fa-sign-out-alt text-xs"></i>
                        </button>
                    </div>
                    <div id="current-time" class="text-4xl font-bold leading-none text-white"></div>
                </div>
            </div>
        </header>
`;
