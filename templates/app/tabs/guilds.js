// templates/app/tabs/guilds.js — Guild Hall

export const guildsTabHTML = `
            <div id="guilds-tab" class="app-tab hidden">

                <!-- Title above the framed scene -->
                <div class="guild-hall-header text-center">
                    <div class="guild-hall-crest">🛡️</div>
                    <h2 class="font-title guild-hall-title">Guild Hall</h2>
                    <p class="guild-hall-subtitle">
                        Every star fills your guild's crystal.
                        The brightest guild in June wins the <strong>Grand Guild Ceremony</strong>! ✨
                    </p>
                </div>

                <!-- Framed hall scene (pure CSS, no image) -->
                <div class="guild-hall-scene">

                    <!-- Atmospheric layers inside the frame -->
                    <div class="guild-hall-scene-overlay" aria-hidden="true">

                        <!-- Torch glows on left & right walls -->
                        <div class="guild-hall-torch guild-hall-torch--left"></div>
                        <div class="guild-hall-torch guild-hall-torch--right"></div>

                        <!-- Rising ember sparks -->
                        <div class="guild-hall-embers">
                            <span style="--x:7%;  --s:3px;--d:2.8s;--dl:0.0s;--c:rgba(245,158,11,0.95)"></span>
                            <span style="--x:18%; --s:2px;--d:3.3s;--dl:0.5s;--c:rgba(239,68,68,0.85)"></span>
                            <span style="--x:30%; --s:4px;--d:2.6s;--dl:1.0s;--c:rgba(251,191,36,0.90)"></span>
                            <span style="--x:43%; --s:2px;--d:3.7s;--dl:0.3s;--c:rgba(245,158,11,0.75)"></span>
                            <span style="--x:56%; --s:3px;--d:2.9s;--dl:1.4s;--c:rgba(239,68,68,0.80)"></span>
                            <span style="--x:67%; --s:4px;--d:3.1s;--dl:0.7s;--c:rgba(251,191,36,0.90)"></span>
                            <span style="--x:79%; --s:3px;--d:2.7s;--dl:1.9s;--c:rgba(245,158,11,0.95)"></span>
                            <span style="--x:90%; --s:2px;--d:3.5s;--dl:0.2s;--c:rgba(239,68,68,0.70)"></span>
                            <span style="--x:13%; --s:2px;--d:4.0s;--dl:0.8s;--c:rgba(167,139,250,0.65)"></span>
                            <span style="--x:52%; --s:3px;--d:3.2s;--dl:2.1s;--c:rgba(196,181,253,0.60)"></span>
                            <span style="--x:85%; --s:2px;--d:2.5s;--dl:0.4s;--c:rgba(167,139,250,0.75)"></span>
                        </div>

                        <!-- Faint rising glow orbs -->
                        <div class="guild-hall-glows">
                            <span style="--x:12%; --d:6.5s;--dl:0.0s;--c:rgba(124,58,237,0.20)"></span>
                            <span style="--x:35%; --d:8.0s;--dl:2.5s;--c:rgba(220,38,38,0.18)"></span>
                            <span style="--x:60%; --d:7.0s;--dl:1.0s;--c:rgba(190,24,93,0.16)"></span>
                            <span style="--x:84%; --d:5.5s;--dl:3.5s;--c:rgba(245,158,11,0.15)"></span>
                        </div>

                        <!-- Star particles -->
                        <div class="guild-hall-stars-field"></div>
                    </div>

                    <!-- Crystal columns rendered by JS -->
                    <div id="guilds-leaderboard-list" class="guild-hall-scene-content"></div>
                </div>

                <!-- Guild Lore Overlay (shown on emblem click) -->
                <div id="guild-lore-overlay" class="guild-lore-overlay hidden" role="dialog" aria-modal="true">
                    <div class="guild-lore-overlay-bg" id="guild-lore-overlay-bg"></div>
                    <div class="guild-lore-card pop-in" id="guild-lore-card">
                        <button class="guild-lore-close" id="guild-lore-close" aria-label="Close">✕</button>
                        <div class="guild-lore-sparkles" aria-hidden="true">
                            <span>✦</span><span>✧</span><span>✦</span><span>✧</span><span>✦</span>
                        </div>
                        <div class="guild-lore-emblem-wrap" id="guild-lore-emblem-wrap"></div>
                        <div class="guild-lore-emoji" id="guild-lore-emoji"></div>
                        <h3 class="guild-lore-name font-title" id="guild-lore-name"></h3>
                        <p class="guild-lore-motto" id="guild-lore-motto"></p>
                        <div class="guild-lore-traits" id="guild-lore-traits"></div>
                        <div class="guild-lore-stats" id="guild-lore-stats"></div>
                    </div>
                </div>
            </div>
`;
