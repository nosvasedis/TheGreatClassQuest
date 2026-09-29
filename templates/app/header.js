// templates/app/header.js

/** Soft INNER letter carve filters — must stay outside elements that mobile hides
 *  with display:none, or filter:url(#…) silently fails on the mobile chrome. */
export const svgFiltersHTML = `
    <svg class="gcq-svg-filters" width="0" height="0" aria-hidden="true" focusable="false"
         style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none">
        <defs>
            <filter id="gcq-inner-soft-stroke" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
                <!-- Thin soft inner rim -->
                <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" result="blur"/>
                <feComposite in="blur" in2="SourceAlpha" operator="in" result="inBlur"/>
                <feComposite in="SourceAlpha" in2="inBlur" operator="arithmetic" k1="0" k2="1" k3="-1" k4="0" result="rim"/>
                <feComponentTransfer in="rim" result="rimBoost">
                    <feFuncA type="linear" slope="2.4" intercept="0"/>
                </feComponentTransfer>
                <feFlood flood-color="rgb(0,0,0)" flood-opacity="0.42" result="shade"/>
                <feComposite in="shade" in2="rimBoost" operator="in" result="softRim"/>
                <feMerge>
                    <feMergeNode in="SourceGraphic"/>
                    <feMergeNode in="softRim"/>
                </feMerge>
            </filter>
            <filter id="gcq-inner-soft-stroke-sm" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
                <feGaussianBlur in="SourceAlpha" stdDeviation="0.35" result="blur"/>
                <feComposite in="blur" in2="SourceAlpha" operator="in" result="inBlur"/>
                <feComposite in="SourceAlpha" in2="inBlur" operator="arithmetic" k1="0" k2="1" k3="-1" k4="0" result="rim"/>
                <feComponentTransfer in="rim" result="rimBoost">
                    <feFuncA type="linear" slope="2.5" intercept="0"/>
                </feComponentTransfer>
                <feFlood flood-color="rgb(0,0,0)" flood-opacity="0.4" result="shade"/>
                <feComposite in="shade" in2="rimBoost" operator="in" result="softRim"/>
                <feMerge>
                    <feMergeNode in="SourceGraphic"/>
                    <feMergeNode in="softRim"/>
                </feMerge>
            </filter>
        </defs>
    </svg>
`;

export const headerHTML = `
    <header class="relative z-[1] flex w-full items-center justify-between gap-3 bg-transparent p-4 shadow-none overflow-visible">
            <div class="header-night-stars absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true"></div>
            <div class="header-sky-clouds absolute inset-0 z-[1] overflow-hidden pointer-events-none">
                <i class="fas fa-cloud cloud" style="left: 10%; animation-delay: -5s;"></i>
                <i class="fas fa-cloud cloud cloud-fast" style="left: 30%; animation-delay: -15s; font-size: 6rem;"></i>
                <i class="fas fa-cloud cloud" style="left: 60%; animation-delay: -2s; font-size: 10rem;"></i>
                <i class="fas fa-cloud cloud cloud-fast" style="left: 80%; animation-delay: -25s;"></i>
            </div>
            <div class="sky-theater-sky absolute inset-0 z-[2] overflow-hidden pointer-events-none" aria-hidden="true"></div>

            <div class="gcq-header-trim" aria-hidden="true">
                <span class="gcq-header-trim__thread"></span>
                <span class="gcq-header-trim__bead" style="--x: 9%; --d: -0.4s"></span>
                <span class="gcq-header-trim__bead" style="--x: 28%; --d: -2.1s"></span>
                <svg class="gcq-header-trim__gem" style="--x: 50%" viewBox="0 0 96 20" focusable="false">
                    <defs>
                        <linearGradient id="gcq-gem-gold" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stop-color="#fffbe6"/>
                            <stop offset="0.45" stop-color="#fcd34d"/>
                            <stop offset="1" stop-color="#d97706"/>
                        </linearGradient>
                    </defs>
                    <path d="M4 10 C 16 10, 26 5, 38 9 C 30 8.5, 22 13, 4 10 Z" fill="#fff7d6"/>
                    <path d="M92 10 C 80 10, 70 5, 58 9 C 66 8.5, 74 13, 92 10 Z" fill="#fff7d6"/>
                    <circle cx="14" cy="10" r="1.3" fill="#fde68a"/>
                    <circle cx="82" cy="10" r="1.3" fill="#fde68a"/>
                    <path d="M48 1.5 L56.5 10 L48 18.5 L39.5 10 Z" fill="url(#gcq-gem-gold)" stroke="#fffdf2" stroke-width="1.4"/>
                    <path d="M48 5.5 L52.5 10 L48 14.5 L43.5 10 Z" fill="#fffdf2" opacity="0.85"/>
                </svg>
                <span class="gcq-header-trim__bead" style="--x: 72%; --d: -1.3s"></span>
                <span class="gcq-header-trim__bead" style="--x: 91%; --d: -3s"></span>
            </div>

            <div class="z-10 min-w-0 flex flex-1 flex-col justify-between">
                <div class="gcq-title-wrap">
                    <h1 id="main-app-title" class="font-title text-2xl text-white sm:text-4xl"
                        data-text="The Great Class Quest">The Great Class Quest</h1>
                    <svg class="gcq-swash gcq-swash--title" viewBox="0 0 260 18" aria-hidden="true" focusable="false">
                        <defs>
                            <linearGradient id="gcq-swash-gold" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0" stop-color="#fff7d6" stop-opacity="0.2"/>
                                <stop offset="0.35" stop-color="#fde68a"/>
                                <stop offset="0.7" stop-color="#ffffff"/>
                                <stop offset="1" stop-color="#fcd34d"/>
                            </linearGradient>
                        </defs>
                        <path d="M4 11 C 46 15, 86 4, 128 9 S 206 14, 238 7" fill="none" stroke="url(#gcq-swash-gold)" stroke-width="2.6" stroke-linecap="round"/>
                        <path d="M60 13.2 C 92 15.5, 118 10.5, 150 12.4" fill="none" stroke="url(#gcq-swash-gold)" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
                        <path d="M249 7 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 z" fill="#fff7d6"/>
                    </svg>
                    <span class="gcq-twinkle gcq-twinkle--title-end" aria-hidden="true"></span>
                    <span class="gcq-twinkle gcq-twinkle--title-start" aria-hidden="true"></span>
                </div>
                <div id="header-quote-container"
                    class="hidden self-start md:inline-flex items-center gap-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-1.5 shadow-md mt-2">
                    <span class="text-lg text-white/80">✨</span>
                    <p id="header-quote-text" class="font-title text-sm text-white tracking-wide"
                        style="text-shadow: 0 1px 3px rgba(0,0,0,0.2);">Loading wisdom...</p>
                    <span class="text-lg text-white/80">✨</span>
                </div>
            </div>

            <div class="z-10 ml-auto flex shrink-0 flex-col justify-between items-end font-title date-time-hover-group relative">
                <div class="sky-theater-cameo absolute inset-0 z-[3] overflow-visible pointer-events-none" aria-hidden="true"></div>
                <div class="gcq-date-wrap relative z-[4]">
                    <div id="current-date" class="relative z-[4] text-right text-lg font-bold text-white sm:text-2xl md:text-4xl" style="word-spacing: 0.1em;" data-text="">
                    </div>
                    <svg class="gcq-swash gcq-swash--date" viewBox="0 0 260 18" aria-hidden="true" focusable="false">
                        <path d="M256 11 C 214 15, 174 4, 132 9 S 54 14, 22 7" fill="none" stroke="url(#gcq-swash-gold)" stroke-width="2.6" stroke-linecap="round"/>
                        <path d="M11 7 l-2 -5 l-2 5 l-5 2 l5 2 l2 5 l2 -5 l5 -2 z" fill="#fff7d6"/>
                    </svg>
                    <span class="gcq-twinkle gcq-twinkle--date" aria-hidden="true"></span>
                </div>

                <div class="relative z-[4] mt-2 flex items-center gap-2 sm:gap-4">
                    <div id="gcq-update-ready-mount" class="hidden shrink-0" aria-live="polite"></div>
                    <div
                        class="gcq-header-controls flex items-center gap-1 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full p-1 shadow-md overflow-visible">
                        <div id="header-class-selector-wrap" class="relative z-20 flex items-center overflow-visible">
                            <button type="button" id="header-class-selector-btn"
                                class="hover:bg-white/40 text-white max-w-[9.5rem] sm:max-w-[13rem] h-7 sm:h-8 pl-2 pr-2 sm:pl-3 sm:pr-2 rounded-full bubbly-button transition-colors duration-300 flex items-center gap-1.5 border border-white/30 font-title leading-none"
                                title="Choose class" aria-expanded="false" aria-haspopup="listbox">
                                <span id="header-class-selector-logo" class="leading-none shrink-0" aria-hidden="true">🏫</span>
                                <span id="header-class-selector-text" class="truncate text-left font-bold leading-none">Class…</span>
                                <i class="fas fa-chevron-down opacity-80 shrink-0"></i>
                            </button>
                            <div id="header-class-selector-panel"
                                class="hidden w-[min(18rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-white/90 ring-4 ring-sky-100/50 origin-top-right">
                                <div class="max-h-72 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                    <button type="button" id="header-class-follow-schedule-btn"
                                        class="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50 hover:from-sky-100 hover:to-indigo-100 border border-sky-200/80 text-left transition-colors">
                                        <span class="text-xl w-10 text-center bg-white rounded-lg py-1 shadow-sm">⏰</span>
                                        <div>
                                            <div class="font-title font-bold text-sky-900 text-sm">Follow today’s schedule</div>
                                            <div class="text-[11px] text-sky-700/90">Auto-switch to the class in session, or General when none is</div>
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
                            title="The Adventurer's Guide" aria-label="Open The Adventurer's Guide">
                            <i class="fas fa-info"></i>
                        </button>
                        <button id="projector-mode-btn"
                            class="hover:bg-white/40 text-white h-7 w-7 rounded-full bubbly-button transition-colors duration-300 flex items-center justify-center border border-white/30 sm:h-8 sm:w-8"
                            title="Projector Mode" aria-label="Toggle Projector Mode">
                            <i class="fas fa-tv"></i>
                        </button>
                        <button id="secretary-console-btn"
                            class="hidden hover:bg-white/40 text-white h-7 w-7 rounded-full bubbly-button transition-colors duration-300 flex items-center justify-center border border-white/30 sm:h-8 sm:w-8"
                            title="School Office" aria-label="Open School Office">
                            <i class="fas fa-building-shield"></i>
                        </button>
                        <button id="header-settings-btn"
                            class="hover:bg-white/40 text-white h-7 w-7 rounded-full bubbly-button transition-colors duration-300 flex items-center justify-center border border-white/30 sm:h-8 sm:w-8"
                            title="Settings" aria-label="Settings">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button id="logout-btn"
                            class="bg-red-500/80 hover:bg-red-500 text-white h-7 w-7 rounded-full bubbly-button flex items-center justify-center border border-white/30 sm:h-8 sm:w-8"
                            title="Logout" aria-label="Logout">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                    <div id="current-time" class="text-xl font-bold leading-none text-white sm:text-3xl md:text-4xl" data-text=""></div>
                </div>
            </div>
        </header>
`;
