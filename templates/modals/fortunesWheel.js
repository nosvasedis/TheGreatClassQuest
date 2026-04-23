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
                    <p class="fw-subtitle">Guide each guild through a ceremonial spin and reveal the omens that will shape the week ahead.</p>
                </header>

                <div class="fw-ceremony-layout">
                    <section class="fw-stage-column">
                        <div id="fw-guild-header" class="fw-guild-header-pill"></div>
                        <div id="fw-progress" class="fw-progress-rail" aria-live="polite"></div>

                        <main class="fw-stage-centered">
                            <div id="fw-stage-frame" class="fw-stage-frame-borderless">
                                <div class="fw-stage-aura-bright" aria-hidden="true"></div>
                                <div class="fw-stage-ring fw-stage-ring--outer" aria-hidden="true"></div>
                                <div class="fw-stage-ring fw-stage-ring--inner" aria-hidden="true"></div>
                                <div id="fw-canvas-wrap" class="fw-canvas-wrap-centered">
                                    <div class="fw-pointer-bright" aria-hidden="true"></div>
                                    <canvas id="fortunes-wheel-canvas" class="fw-canvas-bright" width="560" height="560"></canvas>
                                    <div class="fw-guild-emblem-orb" aria-hidden="true">
                                        <img id="fw-guild-emblem-image" class="fw-guild-emblem-image" alt="">
                                    </div>
                                </div>
                            </div>
                        </main>

                        <div id="fw-stage-caption" class="fw-stage-caption">
                            Choose a class to awaken the relic and begin the guided ceremony.
                        </div>
                    </section>

                    <aside class="fw-side-column">
                        <div class="fw-side-panel fw-side-panel--availability">
                            <div class="fw-side-panel__eyebrow">Ritual Window</div>
                            <div id="fw-availability" class="fw-availability-pill" aria-live="polite">
                                <div id="fw-availability-title" class="fw-availability-pill-title">Awaiting a class</div>
                                <div id="fw-availability-message" class="fw-availability-pill-message">Choose a class to see whether the relic can awaken today.</div>
                                <div id="fw-availability-meta" class="fw-availability-pill-meta"></div>
                            </div>
                        </div>

                        <div id="fw-result" class="fw-result-floating hidden"></div>
                        <div id="fw-summary" class="fw-summary-floating hidden"></div>

                        <footer class="fw-controls-floating">
                            <div class="fw-controls-row">
                                <div id="fw-class-selector-wrap" class="fw-pill-selector">
                                    <label for="fw-class-select" class="sr-only">Class</label>
                                    <select id="fw-class-select" class="fw-select-clean">
                                        <option value="">— Select a class —</option>
                                    </select>
                                </div>
                            </div>
                            <div class="fw-actions-centered">
                                <button id="fw-spin-btn" type="button" class="bubbly-button fw-btn-primary">
                                    <span class="fw-btn-primary__label font-title">Spin the Wheel</span>
                                    <span class="fw-btn-primary__sub">The relic chooses a fate</span>
                                </button>
                                <button id="fw-next-btn" type="button" class="bubbly-button fw-btn-secondary hidden">
                                    <span class="font-title">Present Next Guild</span>
                                </button>
                                <button id="fw-done-btn" type="button" class="bubbly-button fw-btn-success hidden">
                                    <span class="font-title">Close Ceremony</span>
                                </button>
                            </div>
                        </footer>
                    </aside>
                </div>
            </div>
        </div>
    </div>
`;
