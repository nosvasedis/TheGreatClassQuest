// templates/app/screens/grandGuildCeremony.js - Grand Guild Ceremony Screen HTML

export const grandGuildCeremonyHTML = `
    <div id="grand-guild-ceremony-screen"
        class="fixed inset-0 z-[100] hidden flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-black transition-opacity duration-1000">

        <!-- Background Effects -->
        <div class="absolute inset-0 z-0">
            <div id="ceremony-bg-gradient"
                class="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-black opacity-80"></div>
            <div id="ceremony-confetti-container" class="absolute inset-0 pointer-events-none"></div>
            <div
                class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-pulse-slow">
            </div>
            
            <!-- Guild-Themed Particle Effects -->
            <div class="absolute inset-0 pointer-events-none">
                <!-- Dragon Flame Fire Particles -->
                <div class="fire-particles-container">
                    <span class="fire-particle" style="--x:10%; --y:20%; --delay:0s; --duration:3s;"></span>
                    <span class="fire-particle" style="--x:85%; --y:15%; --delay:1s; --duration:2.5s;"></span>
                    <span class="fire-particle" style="--x:45%; --y:80%; --delay:2s; --duration:3.5s;"></span>
                </div>
                
                <!-- Grizzly Might Earth Particles -->
                <div class="earth-particles-container">
                    <span class="earth-particle" style="--x:25%; --y:30%; --delay:0.5s; --duration:4s;"></span>
                    <span class="earth-particle" style="--x:70%; --y:60%; --delay:1.5s; --duration:3s;"></span>
                    <span class="earth-particle" style="--x:15%; --y:70%; --delay:2.5s; --duration:3.5s;"></span>
                </div>
                
                <!-- Owl Wisdom Star Particles -->
                <div class="star-particles-container">
                    <span class="star-particle" style="--x:30%; --y:25%; --delay:0.3s; --duration:2.8s;"></span>
                    <span class="star-particle" style="--x:75%; --y:45%; --delay:1.8s; --duration:3.2s;"></span>
                    <span class="star-particle" style="--x:55%; --y:75%; --delay:2.3s; --duration:2.9s;"></span>
                </div>
                
                <!-- Phoenix Rising Light Particles -->
                <div class="light-particles-container">
                    <span class="light-particle" style="--x:40%; --y:35%; --delay:0.7s; --duration:3.3s;"></span>
                    <span class="light-particle" style="--x:80%; --y:25%; --delay:1.7s; --duration:2.7s;"></span>
                    <span class="light-particle" style="--x:20%; --y:65%; --delay:2.7s; --duration:3.1s;"></span>
                </div>
            </div>
        </div>

        <!-- Main Ceremony Content -->
        <div class="relative z-10 w-full max-w-7xl p-4 flex flex-col items-center justify-center h-full">

            <!-- Ceremony Header -->
            <div id="ceremony-header" class="text-center mb-8 transform transition-all duration-500">
                <h2 id="ceremony-title"
                    class="font-title text-5xl md:text-7xl text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] mb-2">
                    The Grand Guild Ceremony
                </h2>
                <p id="ceremony-subtitle"
                    class="text-xl md:text-2xl text-indigo-200 font-semibold tracking-widest uppercase">
                    The Ultimate End of Year Celebration
                </p>
            </div>

            <!-- Ceremony Stage Area -->
            <div id="ceremony-stage-area"
                class="flex-grow flex items-center justify-center w-full gap-8 perspective-1000 mb-8">
                <!-- Dynamic ceremony content will be rendered here -->
            </div>

            <!-- AI Commentary Box -->
            <div id="ceremony-ai-box"
                class="w-full max-w-4xl bg-black/40 backdrop-blur-md border border-white/20 p-6 rounded-2xl text-center min-h-[120px] flex items-center justify-center mb-8 opacity-0 transition-opacity duration-500">
                <div class="flex items-center gap-3">
                    <div class="text-3xl animate-pulse">✨</div>
                    <p id="ceremony-ai-text" class="text-xl text-white font-serif italic text-shadow">
                        Welcome to the ultimate celebration of our year's achievements!
                    </p>
                    <div class="text-3xl animate-pulse">✨</div>
                </div>
            </div>

            <!-- Ceremony Action Button -->
            <div class="mt-8 mb-4">
                <button id="ceremony-action-btn"
                    class="bubbly-button bg-gradient-to-r from-amber-400 to-orange-500 text-white font-title text-2xl py-4 px-12 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.6)] hover:scale-105 transition-transform border-4 border-white/30 animate-pulse">
                    <i class="fas fa-crown mr-2"></i>
                    Begin Ceremony
                </button>
            </div>
        </div>
    </div>

    <!-- Ceremony Styles -->
    <style>
        /* Fire Particles (Dragon Flame) */
        .fire-particle {
            position: absolute;
            width: 4px;
            height: 4px;
            background: radial-gradient(circle, #ff6b35, #f7931e, #ff4500);
            border-radius: 50%;
            box-shadow: 0 0 10px #ff6b35, 0 0 20px #f7931e;
            animation: float-up var(--duration, 3s) ease-out infinite;
            animation-delay: var(--delay, 0s);
            left: var(--x, 50%);
            top: var(--y, 50%);
        }

        /* Earth Particles (Grizzly Might) */
        .earth-particle {
            position: absolute;
            width: 6px;
            height: 6px;
            background: radial-gradient(circle, #8b4513, #a0522d, #d2691e);
            border-radius: 50%;
            box-shadow: 0 0 8px #8b4513, 0 0 16px #a0522d;
            animation: float-up var(--duration, 4s) ease-out infinite;
            animation-delay: var(--delay, 0s);
            left: var(--x, 50%);
            top: var(--y, 50%);
        }

        /* Star Particles (Owl Wisdom) */
        .star-particle {
            position: absolute;
            width: 8px;
            height: 8px;
            background: radial-gradient(circle, #ffd700, #ffed4e, #fff8dc);
            clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
            box-shadow: 0 0 12px #ffd700, 0 0 24px #ffed4e;
            animation: twinkle var(--duration, 3s) ease-in-out infinite;
            animation-delay: var(--delay, 0s);
            left: var(--x, 50%);
            top: var(--y, 50%);
        }

        /* Light Particles (Phoenix Rising) */
        .light-particle {
            position: absolute;
            width: 10px;
            height: 10px;
            background: radial-gradient(circle, #ff69b4, #ff1493, #c71585);
            border-radius: 50%;
            box-shadow: 0 0 15px #ff69b4, 0 0 30px #ff1493;
            animation: float-rise var(--duration, 3s) ease-out infinite;
            animation-delay: var(--delay, 0s);
            left: var(--x, 50%);
            top: var(--y, 50%);
        }

        /* Confetti Pieces */
        .confetti-piece {
            position: absolute;
            width: 8px;
            height: 8px;
            opacity: 0.8;
            animation: confetti-fall var(--animation-duration, 3s) linear infinite;
            animation-delay: var(--animation-delay, 0s);
        }

        /* Firework Effects */
        .firework {
            position: absolute;
            width: 4px;
            height: 4px;
            border-radius: 50%;
            animation: firework-explode 2s ease-out forwards;
        }

        /* Animations */
        @keyframes float-up {
            0% {
                transform: translateY(0) scale(1);
                opacity: 0;
            }
            10% {
                opacity: 1;
            }
            90% {
                opacity: 1;
            }
            100% {
                transform: translateY(-100vh) scale(0.5);
                opacity: 0;
            }
        }

        @keyframes float-rise {
            0% {
                transform: translateY(0) scale(1);
                opacity: 0;
            }
            10% {
                opacity: 1;
            }
            90% {
                opacity: 1;
            }
            100% {
                transform: translateY(-80vh) scale(1.5);
                opacity: 0;
            }
        }

        @keyframes twinkle {
            0%, 100% {
                transform: scale(1) rotate(0deg);
                opacity: 0.3;
            }
            50% {
                transform: scale(1.2) rotate(180deg);
                opacity: 1;
            }
        }

        @keyframes confetti-fall {
            0% {
                transform: translateY(-100vh) rotate(0deg);
                opacity: 1;
            }
            100% {
                transform: translateY(100vh) rotate(720deg);
                opacity: 0;
            }
        }

        @keyframes firework-explode {
            0% {
                transform: scale(0);
                opacity: 1;
                box-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
            }
            50% {
                transform: scale(1);
                opacity: 1;
                box-shadow: 0 0 20px currentColor, 0 0 40px currentColor, 0 0 60px currentColor;
            }
            100% {
                transform: scale(2);
                opacity: 0;
                box-shadow: 0 0 40px currentColor, 0 0 80px currentColor, 0 0 120px currentColor;
            }
        }

        /* Ceremony Screen Transitions */
        #grand-guild-ceremony-screen {
            transition: all 0.5s ease-in-out;
        }

        #grand-guild-ceremony-screen.hidden {
            opacity: 0;
            pointer-events: none;
        }

        #grand-guild-ceremony-screen:not(.hidden) {
            opacity: 1;
            pointer-events: all;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            #ceremony-title {
                font-size: 2.5rem;
            }
            
            #ceremony-subtitle {
                font-size: 1rem;
            }
            
            #ceremony-action-btn {
                font-size: 1.25rem;
                padding: 1rem 2rem;
            }
            
            .fire-particle,
            .earth-particle,
            .star-particle,
            .light-particle {
                width: 3px;
                height: 3px;
            }
        }

        /* Accessibility */
        @media (prefers-reduced-motion: reduce) {
            .fire-particle,
            .earth-particle,
            .star-particle,
            .light-particle,
            .confetti-piece {
                animation: none;
            }
            
            #ceremony-action-btn {
                animation: none;
            }
        }
    </style>
`;
