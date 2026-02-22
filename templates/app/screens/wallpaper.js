// templates/app/screens/wallpaper.js

export const wallpaperHTML = `
    <div id="dynamic-wallpaper-screen"
        class="hidden fixed inset-0 z-[100] overflow-hidden transition-colors duration-[3000ms] ease-in-out flex flex-col items-center justify-center font-sans">

        <div id="wall-bg-day"
            class="absolute inset-0 bg-gradient-to-b from-sky-400 via-blue-300 to-indigo-100 transition-opacity duration-[3000ms]">
        </div>

        <div id="wall-bg-night"
            class="absolute inset-0 bg-gradient-to-b from-indigo-950 via-purple-900 to-slate-800 opacity-0 transition-opacity duration-[3000ms]">
        </div>

        <div class="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div id="wall-sun"
                class="absolute w-64 h-64 rounded-full bg-yellow-300 blur-2xl opacity-80 transition-all duration-[3000ms] ease-in-out"
                style="top: -5%; right: -5%;"></div>

            <div id="wall-moon"
                class="absolute w-48 h-48 rounded-full bg-slate-100 shadow-[0_0_50px_rgba(255,255,255,0.8)] transition-all duration-[3000ms] ease-in-out"
                style="top: 110%; right: 10%;">
                <div class="absolute top-10 left-8 w-8 h-8 bg-slate-200 rounded-full opacity-50"></div>
                <div class="absolute bottom-12 right-10 w-12 h-12 bg-slate-200 rounded-full opacity-50"></div>
            </div>
        </div>

        <div class="absolute inset-0 pointer-events-none z-10">
            <i class="fas fa-cloud text-white/40 absolute text-[18rem]"
                style="top: 5%; left: -10%; animation: float-clouds-right 80s linear infinite;"></i>
            <i class="fas fa-cloud text-white/30 absolute text-[22rem]"
                style="bottom: 15%; right: -20%; animation: float-clouds-left 100s linear infinite;"></i>
            <i class="fas fa-cloud text-white/20 absolute text-[12rem]"
                style="top: 30%; left: 85%; animation: float-clouds-right 90s linear infinite;"></i>
            <i class="fas fa-cloud text-white/15 absolute text-[10rem]"
                style="top: 60%; left: 10%; animation: float-clouds-right 120s linear infinite; animation-delay: -20s;"></i>
            <i class="fas fa-cloud text-white/25 absolute text-[16rem]"
                style="top: 15%; right: 30%; animation: float-clouds-left 110s linear infinite; animation-delay: -40s;"></i>
        </div>

        <div id="wall-center-hub"
            class="z-20 text-center relative p-10 rounded-[3rem] wall-center-hub hub-breathe transition-all duration-1000">
            <h1 id="wall-time" class="font-title text-[9rem] text-white leading-none drop-shadow-xl"
                style="text-shadow: 4px 4px 0 rgba(0,0,0,0.15);">12:00</h1>
            <h2 id="wall-date" class="font-title text-4xl text-white/95 mt-2 mb-6 tracking-wide drop-shadow-md">Monday,
                January 1st</h2>

            <div id="wall-analogue-clock" class="wall-analogue-clock mx-auto my-4">
                <svg id="wall-clock-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="100" cy="100" r="96" class="clock-outer-ring" />
                    <circle cx="100" cy="100" r="90" class="clock-face" />
                    <circle cx="100" cy="100" r="85" class="clock-inner-ring" />
                    <g class="clock-ticks-major">
                        <line x1="100" y1="17" x2="100" y2="30" />
                        <line x1="100" y1="17" x2="100" y2="30" transform="rotate(30 100 100)" />
                        <line x1="100" y1="17" x2="100" y2="30" transform="rotate(60 100 100)" />
                        <line x1="100" y1="17" x2="100" y2="30" transform="rotate(90 100 100)" />
                        <line x1="100" y1="17" x2="100" y2="30" transform="rotate(120 100 100)" />
                        <line x1="100" y1="17" x2="100" y2="30" transform="rotate(150 100 100)" />
                        <line x1="100" y1="17" x2="100" y2="30" transform="rotate(180 100 100)" />
                        <line x1="100" y1="17" x2="100" y2="30" transform="rotate(210 100 100)" />
                        <line x1="100" y1="17" x2="100" y2="30" transform="rotate(240 100 100)" />
                        <line x1="100" y1="17" x2="100" y2="30" transform="rotate(270 100 100)" />
                        <line x1="100" y1="17" x2="100" y2="30" transform="rotate(300 100 100)" />
                        <line x1="100" y1="17" x2="100" y2="30" transform="rotate(330 100 100)" />
                    </g>
                    <g class="clock-ticks-minor" id="clock-minor-ticks"></g>
                    <text x="100" y="44" class="clock-number" text-anchor="middle" dominant-baseline="middle">12</text>
                    <text x="156" y="100" class="clock-number" text-anchor="middle" dominant-baseline="middle">3</text>
                    <text x="100" y="160" class="clock-number" text-anchor="middle" dominant-baseline="middle">6</text>
                    <text x="44" y="100" class="clock-number" text-anchor="middle" dominant-baseline="middle">9</text>
                    <line id="wall-clock-hour" x1="100" y1="100" x2="100" y2="48" class="clock-hand-hour"
                        stroke-linecap="round" />
                    <line id="wall-clock-minute" x1="100" y1="100" x2="100" y2="24" class="clock-hand-minute"
                        stroke-linecap="round" />
                    <line id="wall-clock-second" x1="100" y1="112" x2="100" y2="18" class="clock-hand-second"
                        stroke-linecap="round" />
                    <circle cx="100" cy="100" r="7" class="clock-center-cap" />
                    <circle cx="100" cy="100" r="3.5" class="clock-center-dot" />
                </svg>
            </div>

            <div id="wall-class-badge"
                class="inline-block bg-white/90 backdrop-blur-md px-12 py-6 rounded-full shadow-2xl transform transition-transform hover:scale-105 border-4 border-white/60">
                <h3 id="wall-class-name" class="font-title text-5xl text-indigo-700 tracking-tight">Class Name</h3>
                <p id="wall-class-level" class="text-indigo-500 font-bold uppercase tracking-[0.2em] text-sm mt-2">Level
                </p>
            </div>
        </div>

        <div id="wall-floating-area" class="absolute inset-0 pointer-events-none z-30"></div>

        <div id="wall-quote-container"
            class="absolute bottom-8 left-0 right-0 text-center z-40 transition-opacity duration-1000 opacity-0 px-4">
            <div
                class="inline-flex items-center gap-4 bg-black/20 backdrop-blur-md border border-white/20 rounded-full px-8 py-3 shadow-lg hover:bg-black/30 transition-colors">
                <span class="text-2xl">✨</span>
                <p id="wall-quote-text" class="font-title text-xl text-white tracking-wide">"Loading Wisdom..."</p>
                <span class="text-2xl">✨</span>
            </div>
        </div>

        <button id="exit-wallpaper-btn"
            class="absolute top-8 right-8 z-50 bg-white/20 hover:bg-red-500 hover:text-white text-white/60 rounded-full w-16 h-16 flex items-center justify-center text-3xl backdrop-blur-md transition-all duration-300 shadow-lg border border-white/30 cursor-pointer pointer-events-auto">
            <i class="fas fa-power-off"></i>
        </button>
    </div>
`;
