// templates/modals/heroClass.js — Hero Class selection ceremony

export const heroClassModalsHTML = `
    <div id="hero-class-select-modal"
        class="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-4 hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hcs-title">

        <div class="hcs-backdrop"></div>

        <div id="hcs-shell" class="hcs-shell pop-in" data-mode="pick">
            <div class="hcs-glow" aria-hidden="true"></div>
            <div id="hcs-watermark" class="hcs-watermark" aria-hidden="true">⚔️</div>
            <div class="hcs-particles" aria-hidden="true">
                <span class="hcs-particle hcs-particle--1">✦</span>
                <span class="hcs-particle hcs-particle--2">✧</span>
                <span class="hcs-particle hcs-particle--3">⭐</span>
                <span class="hcs-particle hcs-particle--4">✦</span>
                <span class="hcs-particle hcs-particle--5">✧</span>
            </div>

            <button type="button" id="hcs-close-btn" class="hcs-close" aria-label="Close">
                &times;
            </button>

            <div id="hcs-pick" class="hcs-pick">
                <header class="hcs-header">
                    <span id="hcs-kicker" class="hcs-kicker">Hero Path</span>
                    <div id="hcs-header-emoji" class="hcs-header-emoji" aria-hidden="true">⚔️</div>
                    <h2 id="hcs-title" class="hcs-title">Choose your Hero Class</h2>
                    <p id="hcs-student-name" class="hcs-student-name"></p>
                    <p id="hcs-subtitle" class="hcs-subtitle">Who will you become?</p>
                </header>

                <div id="hcs-lock-banner" class="hcs-lock-banner hidden" role="status">
                    This is your one change — after this, the path locks.
                </div>

                <div id="hcs-cards" class="hcs-cards" role="listbox" aria-label="Hero Classes"></div>

                <footer class="hcs-footer">
                    <button type="button" id="hcs-cancel-btn" class="hcs-btn hcs-btn--ghost">
                        Not yet
                    </button>
                    <button type="button" id="hcs-swear-btn" class="hcs-btn hcs-btn--swear bubbly-button" disabled>
                        Swear this Path
                    </button>
                </footer>
            </div>

            <div id="hcs-result" class="hcs-result">
                <div class="hcs-result-sparkles" aria-hidden="true">
                    <span>✦</span><span>✧</span><span>✦</span><span>✧</span><span>✦</span>
                </div>
                <p id="hcs-result-kicker" class="hcs-kicker">Hero Path</p>
                <h2 id="hcs-result-title" class="hcs-result-title">You are a Guardian!</h2>
                <div id="hcs-result-emblem" class="hcs-result-emblem" aria-hidden="true">🛡️</div>
                <p id="hcs-result-name" class="hcs-result-class">Guardian</p>
                <p id="hcs-result-virtue" class="hcs-result-virtue"></p>
                <p id="hcs-result-perk" class="hcs-result-perk"></p>
                <button type="button" id="hcs-done-btn" class="hcs-btn hcs-btn--swear bubbly-button">
                    Let's Go!
                </button>
            </div>
        </div>
    </div>
`;
