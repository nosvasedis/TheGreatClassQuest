// templates/app/screens/wallpaper.js

import moonUrl from '../../../assets/celestial/moon.jpg?url';

export function celestialMoonHTML() {
    return `<img class="gcq-moon__body" src="${moonUrl}" alt="" decoding="async" draggable="false" />`;
}

export const wallpaperHTML = `
    <div id="dynamic-wallpaper-screen"
        class="hidden fixed inset-0 z-[100] overflow-hidden transition-colors duration-[3000ms] ease-in-out flex flex-col items-center justify-center font-sans">

        <div id="wall-bg-day"
            class="absolute inset-0 bg-gradient-to-b from-sky-400 via-blue-300 to-indigo-100 transition-opacity duration-[3000ms]">
        </div>

        <div id="wall-bg-night"
            class="absolute inset-0 bg-gradient-to-b from-indigo-950 via-purple-900 to-slate-800 opacity-0 transition-opacity duration-[3000ms]">
        </div>

        <!-- Starfield (night only) -->
        <div id="wall-stars" class="absolute inset-0 pointer-events-none z-[1] overflow-hidden opacity-0 transition-opacity duration-[3000ms]"></div>

        <!-- Celestial bodies -->
        <div class="absolute inset-0 pointer-events-none z-[2] overflow-hidden">
            <div id="wall-sun"
                class="absolute w-64 h-64 rounded-full bg-yellow-300 blur-2xl opacity-80 transition-all duration-[3000ms] ease-in-out"
                style="top: -5%; right: -5%;"></div>

            <div id="wall-moon"
                class="gcq-moon absolute transition-all duration-[3000ms] ease-in-out"
                style="top: 110%; right: 10%;">
                ${celestialMoonHTML()}
            </div>
        </div>

        <!-- Parallax cloud art lanes -->
        <div id="wall-parallax-clouds" class="absolute inset-0 pointer-events-none z-[3] overflow-hidden" aria-hidden="true">
            <div class="wall-parallax-lane" style="--lane-duration:140s; --lane-top:8%; --lane-scale:1.2;"><i class="fas fa-cloud"></i></div>
            <div class="wall-parallax-lane" style="--lane-duration:110s; --lane-top:22%; --lane-scale:0.9;"><i class="fas fa-cloud"></i></div>
            <div class="wall-parallax-lane" style="--lane-duration:160s; --lane-top:38%; --lane-scale:1.5;"><i class="fas fa-cloud"></i></div>
            <div class="wall-parallax-lane" style="--lane-duration:95s; --lane-top:55%; --lane-scale:0.7;"><i class="fas fa-cloud"></i></div>
            <div class="wall-parallax-lane" style="--lane-duration:130s; --lane-top:68%; --lane-scale:1.1;"><i class="fas fa-cloud"></i></div>
            <div class="wall-parallax-lane" style="--lane-duration:180s; --lane-top:82%; --lane-scale:1.3;"><i class="fas fa-cloud"></i></div>
        </div>

        <!-- Weather overlay planes -->
        <div id="wall-weather-fx" class="absolute inset-0 pointer-events-none z-[5] overflow-hidden" aria-hidden="true">
            <div id="wall-rain-fx" class="wall-weather-plane"></div>
            <div id="wall-snow-fx" class="wall-weather-plane"></div>
            <div id="wall-cloudy-fx" class="wall-weather-plane"></div>
            <div id="wall-storm-flash" class="wall-weather-plane"></div>
            <div id="wall-fog-fx" class="wall-weather-plane"></div>
            <div id="wall-hail-fx" class="wall-weather-plane"></div>
        </div>

        <!-- The realm on the horizon: rolling hills and a little castle, lit by day or by the moon -->
        <div id="wall-horizon" class="wall-horizon" aria-hidden="true">
            <svg viewBox="0 0 1600 260" preserveAspectRatio="none" class="wall-horizon__far">
                <path d="M0 150 C 140 95 260 120 380 108 C 520 94 600 60 760 78 C 900 94 980 130 1120 112 C 1260 94 1380 70 1600 98 L1600 260 L0 260 Z" />
            </svg>
            <svg viewBox="0 0 1600 260" preserveAspectRatio="xMidYMax slice" class="wall-horizon__castle">
                <g transform="translate(1180 64)">
                    <rect x="0" y="40" width="22" height="60" /><rect x="0" y="32" width="6" height="10" /><rect x="8" y="32" width="6" height="10" /><rect x="16" y="32" width="6" height="10" />
                    <rect x="22" y="58" width="60" height="42" />
                    <rect x="82" y="26" width="26" height="74" /><rect x="82" y="18" width="7" height="10" /><rect x="91" y="18" width="7" height="10" /><rect x="100" y="18" width="8" height="10" />
                    <path d="M95 18 L95 -8" class="wall-horizon__pole" /><path d="M95 -8 L118 -2 L95 4 Z" class="wall-horizon__flag" />
                    <rect x="108" y="54" width="44" height="46" /><rect x="152" y="44" width="18" height="56" /><rect x="152" y="36" width="5" height="9" /><rect x="159" y="36" width="5" height="9" /><rect x="165" y="36" width="5" height="9" />
                    <rect x="89" y="46" width="6" height="10" rx="3" class="wall-horizon__window" /><rect x="36" y="70" width="6" height="10" rx="3" class="wall-horizon__window" /><rect x="126" y="68" width="6" height="10" rx="3" class="wall-horizon__window" />
                </g>
            </svg>
            <svg viewBox="0 0 1600 260" preserveAspectRatio="none" class="wall-horizon__near">
                <path d="M0 190 C 180 150 320 176 470 168 C 640 158 760 128 930 150 C 1100 172 1220 188 1380 164 C 1480 150 1540 150 1600 158 L1600 260 L0 260 Z" />
            </svg>
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
            class="z-20 text-center relative wall-center-hub sky-hub hub-breathe transition-all duration-1000">
            <div class="sky-hub__halo" aria-hidden="true"></div>

            <div class="sky-hub__dayarc" aria-hidden="true">
                <svg viewBox="0 0 300 70">
                    <path d="M 20 58 A 130 46 0 0 1 280 58" class="sky-hub__dayarc-path" />
                    <path id="wall-day-done" d="" class="sky-hub__dayarc-done" />
                    <line x1="6" y1="58" x2="294" y2="58" class="sky-hub__dayarc-horizon" />
                    <g id="wall-day-marker" class="sky-hub__dayarc-marker" transform="translate(150 12)">
                        <circle r="11" class="sky-hub__dayarc-glow" />
                        <circle r="6.5" class="sky-hub__dayarc-body" />
                    </g>
                </svg>
                <span id="wall-sunrise" class="sky-hub__dayarc-label sky-hub__dayarc-label--rise"></span>
                <span id="wall-sunset" class="sky-hub__dayarc-label sky-hub__dayarc-label--set"></span>
            </div>

            <h1 id="wall-time" class="sky-hub__time font-title">12:00</h1>
            <h2 id="wall-date" class="sky-hub__date font-title">Monday, January 1st</h2>

            <div id="wall-analogue-clock" class="wall-analogue-clock sky-hub__dial mx-auto">
                <svg id="wall-clock-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="100" cy="100" r="96" class="clock-outer-ring" />
                    <g class="clock-lesson" aria-hidden="true">
                        <path id="wall-lesson-track" class="clock-lesson__track" d="" />
                        <path id="wall-lesson-done" class="clock-lesson__done" d="" />
                    </g>
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
            <p id="wall-lesson-caption" class="sky-hub__lesson" aria-live="polite"></p>

            <div id="wall-class-badge" class="sky-hub__banner">
                <h3 id="wall-class-name" class="sky-hub__class font-title">Class Name</h3>
                <p id="wall-class-level" class="sky-hub__league">Level</p>
            </div>
        </div>

        <div id="wall-floating-area" class="absolute inset-0 pointer-events-none z-30"></div>

        <div id="wall-quote-container"
            class="absolute bottom-8 left-0 right-0 text-center z-40 transition-opacity duration-1000 opacity-0 px-4">
            <div class="wall-ribbon">
                <span class="wall-ribbon__star" aria-hidden="true">✦</span>
                <p id="wall-quote-text" class="wall-ribbon__text font-title">"Loading Wisdom..."</p>
                <span class="wall-ribbon__star" aria-hidden="true">✦</span>
            </div>
        </div>

        <!-- Projector remote: fades away when the mouse rests, wakes on movement or a key -->
        <div id="wall-remote" class="wall-remote" role="toolbar" aria-label="Projector controls">
            <button type="button" data-wall-action="prev" title="Previous card (←)" aria-label="Previous card"><i class="fas fa-backward-step"></i></button>
            <button type="button" data-wall-action="pause" title="Pin this card (Space)" aria-label="Pin this card" aria-pressed="false"><i class="fas fa-thumbtack"></i></button>
            <button type="button" data-wall-action="next" title="Next card (→)" aria-label="Next card"><i class="fas fa-forward-step"></i></button>
            <span class="wall-remote__sep" aria-hidden="true"></span>
            <button type="button" data-wall-action="deck" title="Card deck (D)" aria-label="Card deck"><i class="fas fa-layer-group"></i></button>
            <button type="button" data-wall-action="fullscreen" title="Full screen (F)" aria-label="Full screen"><i class="fas fa-expand"></i></button>
            <button type="button" id="exit-wallpaper-btn" class="wall-remote__exit" title="Leave (Esc)" aria-label="Leave Projector Mode"><i class="fas fa-power-off"></i></button>
        </div>

        <div id="wall-deck-panel" class="wall-deck-panel hidden"></div>
    </div>
`;
