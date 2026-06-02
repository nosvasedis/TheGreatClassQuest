// templates/app/header.js

export const headerHTML = `
    <header class="relative z-[1] flex w-full items-center justify-between gap-3 bg-transparent p-4 shadow-none overflow-visible">
            <div class="header-night-stars absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true"></div>
            <div class="header-sky-clouds absolute inset-0 z-[1] overflow-hidden pointer-events-none">
                <i class="fas fa-cloud cloud" style="left: 10%; animation-delay: -5s;"></i>
                <i class="fas fa-cloud cloud cloud-fast" style="left: 30%; animation-delay: -15s; font-size: 6rem;"></i>
                <i class="fas fa-cloud cloud" style="left: 60%; animation-delay: -2s; font-size: 10rem;"></i>
                <i class="fas fa-cloud cloud cloud-fast" style="left: 80%; animation-delay: -25s;"></i>
            </div>

            <div class="z-10 min-w-0 flex flex-1 flex-col justify-between">
                <div>
                    <h1 id="main-app-title" class="font-title text-2xl text-white sm:text-4xl">The Great Class Quest</h1>
                </div>
                <div id="header-quote-container"
                    class="hidden self-start md:inline-flex items-center gap-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-1.5 shadow-md mt-2">
                    <span class="text-lg text-white/80">✨</span>
                    <p id="header-quote-text" class="font-title text-sm text-white tracking-wide"
                        style="text-shadow: 0 1px 3px rgba(0,0,0,0.2);">Loading wisdom...</p>
                    <span class="text-lg text-white/80">✨</span>
                </div>
            </div>

            <div class="z-10 ml-auto flex shrink-0 flex-col justify-between items-end font-title date-time-hover-group">
                <div id="current-date" class="text-right text-lg font-bold text-white sm:text-2xl md:text-4xl" style="word-spacing: 0.1em;">
                </div>

                <div class="mt-2 flex items-center gap-2 sm:gap-4">
                    <div
                        class="flex items-center gap-1 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full p-1 shadow-md overflow-visible">
                        <div id="header-class-selector-wrap" class="relative z-20 overflow-visible">
                            <button type="button" id="header-class-selector-btn"
                                class="hover:bg-white/40 text-white max-w-[9.5rem] sm:max-w-[13rem] h-7 sm:h-8 pl-2 pr-2 sm:pl-3 sm:pr-2 rounded-full bubbly-button transition-colors duration-300 flex items-center gap-1.5 border border-white/30 font-title text-[10px] sm:text-xs leading-tight"
                                title="Choose class" aria-expanded="false" aria-haspopup="listbox">
                                <span id="header-class-selector-logo" class="text-base sm:text-lg leading-none shrink-0" aria-hidden="true">🏫</span>
                                <span id="header-class-selector-text" class="truncate text-left font-bold">Class…</span>
                                <i class="fas fa-chevron-down text-[8px] sm:text-[9px] opacity-80 shrink-0"></i>
                            </button>
                            <div id="header-class-selector-panel"
                                class="hidden w-[min(18rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-white/90 ring-4 ring-sky-100/50 origin-top-right">
                                <div class="max-h-72 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    <button type="button" id="header-class-follow-schedule-btn"
                                        class="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50 hover:from-sky-100 hover:to-indigo-100 border border-sky-200/80 text-left transition-colors">
                                        <span class="text-xl w-10 text-center bg-white rounded-lg py-1 shadow-sm">⏰</span>
                                        <div>
                                            <div class="font-title font-bold text-sky-900 text-sm">Follow today’s schedule</div>
                                            <div class="text-[11px] text-sky-700/90">Auto-switch to the class in session</div>
                                        </div>
                                    </button>
                                    <div class="header-class-item flex items-center gap-3 p-3 hover:bg-indigo-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-indigo-100"
                                        data-id="" role="option">
                                        <span class="text-2xl w-10 text-center bg-indigo-100 rounded-lg py-1">🏫</span>
                                        <span class="font-title font-bold text-indigo-800 text-sm">General view</span>
                                    </div>
                                    <div id="header-class-list-mount"></div>
                                </div>
                            </div>
                        </div>
                        <button id="app-info-btn"
                            class="hover:bg-white/40 text-white h-7 w-7 rounded-full bubbly-button transition-colors duration-300 flex items-center justify-center border border-white/30 sm:h-8 sm:w-8"
                            title="Game Guide" aria-label="Open Game Guide">
                            <i class="fas fa-info text-xs"></i>
                        </button>
                        <button id="projector-mode-btn"
                            class="hover:bg-white/40 text-white h-7 w-7 rounded-full bubbly-button transition-colors duration-300 flex items-center justify-center border border-white/30 sm:h-8 sm:w-8"
                            title="Projector Mode" aria-label="Toggle Projector Mode">
                            <i class="fas fa-tv text-xs"></i>
                        </button>
                        <button id="secretary-console-btn"
                            class="hidden hover:bg-white/40 text-white h-7 w-7 rounded-full bubbly-button transition-colors duration-300 flex items-center justify-center border border-white/30 sm:h-8 sm:w-8"
                            title="Secretary Console" aria-label="Open Secretary Console">
                            <i class="fas fa-building-shield text-xs"></i>
                        </button>
                        <button id="header-settings-btn"
                            class="hover:bg-white/40 text-white h-7 w-7 rounded-full bubbly-button transition-colors duration-300 flex items-center justify-center border border-white/30 sm:h-8 sm:w-8"
                            title="Settings" aria-label="Settings">
                            <i class="fas fa-cog text-xs"></i>
                        </button>
                        <button id="logout-btn"
                            class="bg-red-500/80 hover:bg-red-500 text-white h-7 w-7 rounded-full bubbly-button flex items-center justify-center border border-white/30 sm:h-8 sm:w-8"
                            title="Logout" aria-label="Logout">
                            <i class="fas fa-sign-out-alt text-xs"></i>
                        </button>
                    </div>
                    <div id="current-time" class="text-xl font-bold leading-none text-white sm:text-3xl md:text-4xl"></div>
                </div>
            </div>
        </header>
`;
