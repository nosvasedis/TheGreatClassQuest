// templates/modals/heroClass.js — Hero Class selection: the Deck of Paths

export const heroClassModalsHTML = `
    <div id="hero-class-select-modal"
        class="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-4 hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hcs-title">

        <div class="hcs-backdrop"></div>

        <div id="hcs-shell" class="hcs-shell pop-in" data-mode="pick">
            <div class="hcs-cloth" aria-hidden="true">
                <span class="hcs-candle hcs-candle--left"></span>
                <span class="hcs-candle hcs-candle--right"></span>
            </div>

            <button type="button" id="hcs-close-btn" class="hcs-close" aria-label="Close">
                &times;
            </button>

            <div id="hcs-pick" class="hcs-pick">
                <header class="hcs-header">
                    <span id="hcs-kicker" class="hcs-kicker">The Deck of Paths</span>
                    <h2 id="hcs-title" class="hcs-title">Choose your Hero Class</h2>
                    <p class="hcs-for"><span class="hcs-for-label">A reading for</span> <span id="hcs-student-name" class="hcs-student-name"></span></p>
                </header>

                <div id="hcs-lock-banner" class="hcs-lock-banner hidden" role="status">
                    You keep this class, and you can change it twice this school year.
                </div>

                <div class="hcs-body">
                    <div id="hcs-cards" class="hcs-spread" role="listbox" aria-label="Hero Classes"></div>
                    <aside id="hcs-reading" class="hcs-reading" aria-live="polite"></aside>
                </div>

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
                <div class="hcs-result-stage">
                    <div class="hcs-rays" aria-hidden="true"></div>
                    <div class="hcs-embers" aria-hidden="true">
                        <span></span><span></span><span></span><span></span><span></span><span></span>
                    </div>
                    <div id="hcs-result-emblem" class="hcs-result-card" aria-hidden="true"></div>
                </div>
                <div class="hcs-result-copy">
                    <p id="hcs-result-kicker" class="hcs-kicker">Your card is drawn</p>
                    <h2 id="hcs-result-title" class="hcs-result-title">You are a Guardian!</h2>
                    <p id="hcs-result-name" class="hcs-ribbon">Guardian</p>
                    <p id="hcs-result-virtue" class="hcs-result-virtue"></p>
                    <p id="hcs-result-perk" class="hcs-result-perk"></p>
                    <div id="hcs-result-ranks" class="hcs-pathranks hcs-pathranks--result"></div>
                    <button type="button" id="hcs-done-btn" class="hcs-btn hcs-btn--swear bubbly-button">
                        Let's Go!
                    </button>
                </div>
            </div>
        </div>
    </div>
`;
