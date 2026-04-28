// templates/modals/fortunesWheel.js — Fortune's Wheel modal template

export const fortunesWheelModalHTML = `
    <div id="fortunes-wheel-modal"
        class="fixed inset-0 z-[75] hidden"
        role="dialog"
        aria-labelledby="fortunes-wheel-title"
        aria-modal="true">

        <div class="fw-backdrop"></div>

        <div class="fw-card pop-in">
            <button id="fw-close-btn" type="button" class="fw-btn fw-btn--close" aria-label="Close Fortune's Wheel">
                <i class="fa-solid fa-xmark"></i>
            </button>

            <div id="fw-reveal-layer" class="fw-reveal-layer hidden" aria-live="polite">
                <div class="fw-reveal-layer__backdrop"></div>
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

            <div class="fw-atmosphere" aria-hidden="true">
                <div class="fw-atmosphere__halo"></div>
                <div class="fw-atmosphere__veil"></div>
                <div class="fw-atmosphere__sparks">
                    <span></span><span></span><span></span><span></span><span></span><span></span>
                </div>
            </div>

            <div class="fw-content-unified">
                <header class="fw-header-floating">
                    <div class="fw-kicker"><i class="fa-solid fa-stars"></i> Fortune Relic</div>
                    <h2 id="fortunes-wheel-title" class="fw-title font-title">Fortune's Wheel</h2>
                </header>

                <div class="fw-main-layout">
                    <section class="fw-stage-section">
                        <div id="fw-guild-header" class="fw-guild-header-pill"></div>
                        <div id="fw-progress" class="fw-progress-rail" aria-live="polite"></div>

                        <main class="fw-wheel-container">
                            <div id="fw-stage-frame" class="fw-stage-frame">
                                <div class="fw-stage-aura-bright" aria-hidden="true"></div>
                                <div class="fw-stage-ring fw-stage-ring--outer" aria-hidden="true"></div>
                                <div class="fw-stage-ring fw-stage-ring--inner" aria-hidden="true"></div>
                                <div id="fw-canvas-wrap" class="fw-canvas-wrap">
                                    <div class="fw-pointer-bright" aria-hidden="true"></div>
                                    <canvas id="fortunes-wheel-canvas" class="fw-canvas" width="560" height="560"></canvas>
                                    <div class="fw-guild-emblem-orb" aria-hidden="true">
                                        <img id="fw-guild-emblem-image" class="fw-guild-emblem-image" alt="">
                                    </div>
                                </div>
                            </div>
                        </main>

                        <div id="fw-stage-caption" class="fw-stage-caption">
                            Choose a class to awaken the relic and begin the ceremony.
                        </div>
                    </section>

                    <aside class="fw-controls-section">
                        <div class="fw-class-selector">
                            <label for="fw-class-select" class="fw-class-label">Select Class</label>
                            <div class="fw-select-wrapper">
                                <select id="fw-class-select" class="fw-custom-select">
                                    <option value="">— Choose a class —</option>
                                </select>
                                <div class="fw-select-arrow"><i class="fa-solid fa-chevron-down"></i></div>
                            </div>
                        </div>

                        <div id="fw-availability" class="fw-availability-card" aria-live="polite">
                            <div id="fw-availability-title" class="fw-availability-title">Awaiting a class</div>
                            <div id="fw-availability-message" class="fw-availability-message">Choose a class to see if the relic can awaken.</div>
                            <div id="fw-availability-meta" class="fw-availability-meta"></div>
                        </div>

                        <div id="fw-result" class="fw-result-card hidden"></div>
                        <div id="fw-summary" class="fw-summary-card hidden"></div>

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
