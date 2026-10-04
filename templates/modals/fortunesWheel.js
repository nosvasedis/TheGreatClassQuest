// templates/modals/fortunesWheel.js — Fortune's Wheel modal template
// The celestial Wheel of Fate: a night sky with a turning zodiac ring, a gilded
// star crest for the title, an enamelled wheel framed by star lamps and zodiac
// signs, and a tarot-framed oracle panel for the ceremony controls.

// Zodiac glyphs with U+FE0E so they render as gilt text, never as emoji tiles
const ZODIAC = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'].map(z => `${z}\uFE0E`);

// 24 lamps around the wheel: even positions are stars, odd positions zodiac signs
const MARQUEE_BULBS = Array.from({ length: 24 }, (_, i) => (i % 2
    ? `<span class="fw-marquee__bulb" style="--i:${i}" data-z><i data-z="${ZODIAC[(i - 1) / 2]}"></i></span>`
    : `<span class="fw-marquee__bulb" style="--i:${i}"><i></i></span>`)
).join('');

const ZODIAC_RING = ZODIAC.map((z, i) => `<span style="--i:${i}" data-z="${z}"></span>`).join('');

export const fortunesWheelModalHTML = `
    <div id="fortunes-wheel-modal"
        class="fixed inset-0 z-[75] hidden"
        role="dialog"
        aria-labelledby="fortunes-wheel-title"
        aria-modal="true">

        <div class="fw-backdrop"></div>

        <div class="fw-card pop-in" data-phase="idle">
            <button id="fw-close-btn" type="button" class="fw-btn fw-btn--close" aria-label="Close Fortune's Wheel">
                <i class="fa-solid fa-xmark"></i>
            </button>

            <div id="fw-reveal-layer" class="fw-reveal-layer hidden" aria-live="polite">
                <div class="fw-reveal-layer__backdrop"></div>
                <div class="fw-reveal-layer__rays" aria-hidden="true"></div>
                <div class="fw-reveal-layer__shell">
                    <div id="fw-reveal-card" class="fw-reveal-card"></div>
                    <div class="fw-reveal-actions">
                        <button id="fw-reveal-secondary-btn" type="button" class="bubbly-button fw-btn-secondary hidden">
                            <span class="font-title">Close</span>
                        </button>
                        <button id="fw-reveal-primary-btn" type="button" class="bubbly-button fw-btn-success hidden">
                            <span class="font-title">Continue</span>
                        </button>
                    </div>
                </div>
            </div>

            <div id="fw-fx" class="fw-fx" aria-hidden="true"></div>

            <div class="fw-atmosphere" aria-hidden="true">
                <div class="fw-atmosphere__halo"></div>
                <div class="fw-atmosphere__stars"></div>
                <div class="fw-atmosphere__veil"></div>
                <div class="fw-atmosphere__zodiac">${ZODIAC_RING}</div>
                <div class="fw-atmosphere__sparks">
                    <span></span><span></span><span></span><span></span><span></span><span></span>
                </div>
            </div>

            <div class="fw-content-unified">
                <header class="fw-header-floating">
                    <div class="fw-crest">
                        <span class="fw-crest__moon" aria-hidden="true"></span>
                        <div class="fw-kicker"><i class="fa-solid fa-star"></i> Fortune Relic <i class="fa-solid fa-star"></i></div>
                        <h2 id="fortunes-wheel-title" class="fw-title font-title">Fortune's Wheel</h2>
                        <span class="fw-crest__flourish" aria-hidden="true"></span>
                    </div>
                </header>

                <div class="fw-main-layout">
                    <section class="fw-stage-section">
                        <div class="fw-stage-top">
                            <div id="fw-guild-header" class="fw-guild-header-pill"></div>
                            <div id="fw-progress" class="fw-progress-rail" aria-live="polite"></div>
                        </div>

                        <main class="fw-wheel-container">
                            <div id="fw-stage-frame" class="fw-stage-frame">
                                <div class="fw-stage-aura-bright" aria-hidden="true"></div>
                                <div class="fw-stage-ring fw-stage-ring--outer" aria-hidden="true"></div>
                                <div class="fw-marquee" aria-hidden="true">${MARQUEE_BULBS}</div>
                                <div class="fw-stage-ring fw-stage-ring--inner" aria-hidden="true"></div>
                                <div class="fw-dormant" aria-hidden="true">
                                    <div class="fw-dormant__wheel"></div>
                                    <div class="fw-dormant__chain fw-dormant__chain--a"></div>
                                    <div class="fw-dormant__chain fw-dormant__chain--b"></div>
                                    <div class="fw-dormant__seal"><i class="fa-solid fa-hourglass-half fw-dormant__icon--recharge"></i><i class="fa-solid fa-lock fw-dormant__icon--lock"></i></div>
                                </div>
                                <div id="fw-canvas-wrap" class="fw-canvas-wrap">
                                    <canvas id="fortunes-wheel-canvas" class="fw-canvas" width="560" height="560"></canvas>
                                    <div class="fw-guild-emblem-orb" aria-hidden="true">
                                        <img id="fw-guild-emblem-image" class="fw-guild-emblem-image" alt="">
                                    </div>
                                </div>
                                <div class="fw-pointer-bright" aria-hidden="true">
                                    <span class="fw-pointer__cap"></span>
                                    <span class="fw-pointer__blade"></span>
                                    <span class="fw-pointer__gem"></span>
                                </div>
                            </div>
                        </main>

                        <div id="fw-summary" class="fw-summary-card hidden"></div>

                        <div id="fw-stage-caption" class="fw-stage-caption">
                            Choose a class in the header to awaken the relic and begin the ceremony.
                        </div>
                    </section>

                    <aside class="fw-controls-section">
                        <div id="fw-availability" class="fw-availability-card" aria-live="polite">
                            <div id="fw-availability-title" class="fw-availability-title">Awaiting a class</div>
                            <div id="fw-availability-message" class="fw-availability-message">Choose a class in the header to see if the relic can awaken.</div>
                            <div id="fw-availability-meta" class="fw-availability-meta"></div>
                        </div>

                        <div id="fw-wheel-legend" class="fw-wheel-legend hidden" aria-live="polite"></div>

                        <div id="fw-guild-members" class="fw-guild-members-panel" aria-live="polite">
                            <div class="fw-guild-members__header">Active Guild Members</div>
                            <div class="fw-guild-members__empty">Select a class in the header to view guild members for each turn.</div>
                        </div>

                        <div id="fw-result" class="fw-result-card hidden"></div>

                        <div class="fw-actions">
                            <button id="fw-spin-btn" type="button" class="bubbly-button fw-btn-primary">
                                <span class="fw-btn-primary__label font-title">Spin the Wheel</span>
                                <span class="fw-btn-primary__sub">The relic chooses a fate</span>
                            </button>
                            <button id="fw-next-btn" type="button" class="bubbly-button fw-btn-secondary hidden">
                                <span class="font-title">Next Guild</span>
                            </button>
                            <button id="fw-done-btn" type="button" class="bubbly-button fw-btn-success hidden">
                                <span class="font-title">Close Ceremony</span>
                            </button>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    </div>
`;
