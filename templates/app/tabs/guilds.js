// templates/app/tabs/guilds.js — Guild Hall

export const guildsTabHTML = `
            <div id="guilds-tab" class="app-tab hidden">

                <!-- Title above the framed scene (layout matches other app-tab headers) -->
                <div class="max-w-7xl mx-auto">
                    <!-- Tab title: Guild Hall -->
                    <header class="tab-sign tab-sign--guild">
                        <div class="tab-sign__piece">
                            <span class="tab-sign__shield tab-sign__shield--l" aria-hidden="true"><span class="tab-sign__flame"></span><i class="fas fa-chess-rook"></i></span>
                            <span class="tab-sign__shield tab-sign__shield--r" aria-hidden="true"><span class="tab-sign__flame"></span><i class="fas fa-chess-knight"></i></span>
                            <div class="tab-sign__board">
                                <span class="tab-sign__kicker">Glory · Chapters · Crowns</span>
                                <h2 class="font-title tab-sign__title guild-hall-title">Guild Hall</h2>
                            </div>
                        </div>
                        <p class="tab-sign__tagline">Win the month, take the Crowns. When June comes, one banner will be crowned.</p>
                    </header>
                </div>

                <!-- The hall: a night-time great hall drawn in CSS (styles/guild_hall.css) -->
                <div class="guild-hall-scene">
                    <div class="guild-hall-scene-overlay" aria-hidden="true">
                        <div class="guild-hall-vault"></div>
                        <div class="guild-hall-motes">
                            <span style="--x:6%;--d:11s;--dl:0s"></span>
                            <span style="--x:19%;--d:14s;--dl:3s"></span>
                            <span style="--x:33%;--d:12s;--dl:6s"></span>
                            <span style="--x:51%;--d:15s;--dl:1.5s"></span>
                            <span style="--x:66%;--d:13s;--dl:4.5s"></span>
                            <span style="--x:81%;--d:11.5s;--dl:7s"></span>
                            <span style="--x:93%;--d:14.5s;--dl:2.2s"></span>
                        </div>
                    </div>

                    <!-- Month banners and the Crown Race, built by ui/tabs/guilds.js -->
                    <div id="guilds-leaderboard-list" class="guild-hall-scene-content"></div>
                </div>

                <!-- Fortune Ledger: the year's Wheel finds, a closed book until opened (built by ui/tabs/guilds.js) -->
                <section id="fortunes-wheel-section" class="fl" data-ledger-expanded="false" aria-labelledby="fortune-ledger-heading">
                    <button type="button"
                            id="fortune-ledger-toggle"
                            class="fl-toggle"
                            aria-expanded="false"
                            aria-controls="fortune-ledger-panel"
                            aria-label="Open the Fortune Ledger">
                        <span class="fl-toggle__book" aria-hidden="true"><i class="fa-solid fa-book"></i><span class="fl-toggle__clasp"></span></span>
                        <span class="fl-toggle__text">
                            <span class="fl-toggle__kicker">Every fortune the Wheel brought this year</span>
                            <h3 id="fortune-ledger-heading" class="fl-toggle__title font-title">Fortune Ledger</h3>
                            <span id="fortune-ledger-summary" class="fl-toggle__summary">No spins yet this year</span>
                        </span>
                        <span id="fortune-ledger-peek" class="fl-peek" aria-hidden="true"></span>
                        <span class="fl-toggle__chev" aria-hidden="true"><i class="fa-solid fa-chevron-down"></i></span>
                    </button>

                    <div id="fortune-ledger-panel" class="fl-panel" role="region" aria-labelledby="fortune-ledger-heading" aria-hidden="true" inert>
                        <div class="fl-panel__clip">
                            <div class="fl-panel__body">
                                <div class="fl-status">
                                    <span class="fl-status__icon" aria-hidden="true"><i class="fa-solid fa-dharmachakra"></i></span>
                                    <span id="fortunes-wheel-class" class="fl-status__class">No class selected</span>
                                    <p id="fortunes-wheel-status" class="fl-status__text"></p>
                                </div>
                                <div id="fortune-ledger-tally" class="fl-tally"></div>
                                <div id="fortune-ledger-filter" class="fl-filter" role="group" aria-label="Show one guild"></div>
                                <div id="fortunes-log-section" class="fl-book">
                                    <ol id="fortunes-log-list" class="fl-list"></ol>
                                    <button type="button" id="fortune-ledger-more" class="fl-more" hidden><i class="fa-solid fa-angles-down" aria-hidden="true"></i><span>Show older spins</span></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Guild Lore Overlay (shown on emblem click): the guild's own hanging banner -->
                <div id="guild-lore-overlay" class="guild-lore-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="guild-lore-name">
                    <div class="guild-lore-overlay-bg" id="guild-lore-overlay-bg"></div>
                    <div class="guild-lore-card" id="guild-lore-card">
                        <div class="guild-lore-cloth" aria-hidden="true"></div>
                        <div class="guild-lore-rod" aria-hidden="true">
                            <span class="guild-lore-tassel guild-lore-tassel--l"></span>
                            <span class="guild-lore-tassel guild-lore-tassel--r"></span>
                        </div>
                        <button class="guild-lore-close" id="guild-lore-close" aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>
                        <div class="guild-lore-sparkles" aria-hidden="true">
                            <span>✦</span><span>✧</span><span>✦</span><span>✧</span><span>✦</span>
                        </div>
                        <div class="guild-lore-emblem-wrap" id="guild-lore-emblem-wrap"></div>
                        <div class="guild-lore-emoji" id="guild-lore-emoji"></div>
                        <span class="guild-lore-kicker" aria-hidden="true">Banner of the Guild</span>
                        <h3 class="guild-lore-name font-title" id="guild-lore-name"></h3>
                        <p class="guild-lore-motto" id="guild-lore-motto"></p>
                        <div class="guild-lore-traits" id="guild-lore-traits"></div>
                        <div class="guild-lore-stats" id="guild-lore-stats"></div>
                    </div>
                </div>

                <!-- Guild Anthem Modal (shown on note button click) -->
                <div id="guild-anthem-overlay" class="guild-anthem-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="guild-anthem-title">
                    <div class="guild-anthem-overlay-bg" id="guild-anthem-overlay-bg"></div>
                    <div class="guild-anthem-card" id="guild-anthem-card">
                        <button class="guild-anthem-close" id="guild-anthem-close" aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>
                        <div class="guild-anthem-header" id="guild-anthem-header">
                            <div class="guild-anthem-arch" aria-hidden="true">
                                <span class="guild-anthem-torch guild-anthem-torch--l"><span class="guild-anthem-torch__flame"></span></span>
                                <span class="guild-anthem-crest"></span>
                                <span class="guild-anthem-torch guild-anthem-torch--r"><span class="guild-anthem-torch__flame"></span></span>
                            </div>
                            <div class="guild-anthem-note-icon" aria-hidden="true">🎵</div>
                            <h3 class="guild-anthem-title font-title" id="guild-anthem-title"></h3>
                            <p class="guild-anthem-subtitle">Sing along with your guild!</p>
                        </div>
                        <div class="guild-anthem-player" id="guild-anthem-player">
                            <div class="guild-anthem-now-playing" id="guild-anthem-now-playing">
                                <span class="guild-anthem-note-anim">♪</span>
                                <span class="guild-anthem-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                                <span class="guild-anthem-now-playing-text" id="guild-anthem-now-playing-text">Now Playing…</span>
                                <span class="guild-anthem-note-anim" style="animation-delay:0.4s">♫</span>
                            </div>
                            <div class="guild-anthem-progress" aria-hidden="true"><span class="guild-anthem-progress__fill" id="guild-anthem-progress-fill"></span></div>
                        </div>
                        <div class="guild-anthem-lyrics" id="guild-anthem-lyrics"></div>
                    </div>
                </div>
            </div>
`;
