// templates/app/screens/wallpaper.js

import moonUrl from '../../../assets/celestial/moon.jpg?url';

export function celestialMoonHTML() {
    // The dark side is painted over the photo in the real phase (features/skyWeatherStage.js).
    return `<img class="gcq-moon__body" src="${moonUrl}" alt="" decoding="async" draggable="false" /><svg class="gcq-moon__phase" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d=""/></svg>`;
}

export const wallpaperHTML = `
    <div id="dynamic-wallpaper-screen"
        class="hidden fixed inset-0 z-[100] overflow-hidden transition-colors duration-[3000ms] ease-in-out flex flex-col items-center justify-center font-sans">

        <!-- The sky itself: the shared live palette (styles/sky_weather.css), melting between
             dawn, day, golden hour, twilight and night, and greying with the weather. -->
        <div id="wall-sky" class="wall-sky" aria-hidden="true"></div>

        <!-- Starfield (night only) -->
        <div id="wall-stars" class="absolute inset-0 pointer-events-none z-[1] overflow-hidden opacity-0 transition-opacity duration-[3000ms]"></div>

        <!-- Celestial bodies -->
        <div class="absolute inset-0 pointer-events-none z-[2] overflow-hidden">
            <div id="wall-sunlight" class="wall-sun" aria-hidden="true">
                <span class="wall-sun__halo"></span>
                <span class="wall-sun__disc"></span>
            </div>

            <div id="wall-moon"
                class="gcq-moon absolute transition-all duration-[3000ms] ease-in-out"
                style="top: 110%; right: 10%;">
                ${celestialMoonHTML()}
            </div>
        </div>

        <!-- Storybook clouds and weather layers (features/skyWeatherStage.js paints them from the live sky) -->
        <div id="wall-parallax-clouds" class="wx-clouds absolute inset-0 pointer-events-none z-[3] overflow-hidden" aria-hidden="true"></div>
        <div id="wall-weather-fx" class="wx-stage wx-stage--wall absolute inset-0 pointer-events-none z-[5] overflow-hidden" aria-hidden="true"></div>

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
            <button type="button" data-wall-action="dragon" title="The Quiet Dragon (Q)" aria-label="The Quiet Dragon"><i class="fas fa-dragon"></i></button>
            <button type="button" data-wall-action="wand" class="hidden" title="Quest Remote: your phone runs this screen (W)" aria-label="Quest Remote" aria-pressed="false"><i class="fas fa-wand-magic-sparkles"></i></button>
            <button type="button" data-wall-action="raid" class="hidden" title="Realm Raid" aria-label="Open the Realm Raid"><i class="fas fa-shield-halved"></i></button>
            <button type="button" data-wall-action="deck" title="Card deck (D)" aria-label="Card deck"><i class="fas fa-layer-group"></i></button>
            <button type="button" data-wall-action="fullscreen" title="Full screen (F)" aria-label="Full screen"><i class="fas fa-expand"></i></button>
            <button type="button" id="exit-wallpaper-btn" class="wall-remote__exit" title="Leave (Esc)" aria-label="Leave Projector Mode"><i class="fas fa-power-off"></i></button>
        </div>

        <div id="wall-deck-panel" class="wall-deck-panel hidden"></div>
    </div>
`;
