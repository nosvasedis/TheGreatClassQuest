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

            <!-- Bright sunburst or sky glow in the background -->
            <div class="fw-sky-glow" aria-hidden="true"></div>
            <div class="fw-sky-rays" aria-hidden="true"></div>

            <div class="fw-content-unified">
                <!-- Top Section -->
                <header class="fw-header-floating">
                    <div class="fw-kicker"><i class="fa-solid fa-star"></i> Celestial Relic</div>
                    <h2 id="fortunes-wheel-title" class="fw-title font-title">Fortune's Wheel</h2>
                    <p class="fw-subtitle">A mysterious wheel of omens, treasure, and guild-altering fate.</p>
                    <div id="fw-guild-header" class="fw-guild-header-pill"></div>
                </header>

                <!-- Center Stage (The Wheel itself) -->
                <main class="fw-stage-centered">
                    <div id="fw-stage-frame" class="fw-stage-frame-borderless">
                        <div class="fw-stage-aura-bright" aria-hidden="true"></div>
                        <div id="fw-canvas-wrap" class="fw-canvas-wrap-centered">
                            <div class="fw-pointer-bright" aria-hidden="true"></div>
                            <canvas id="fortunes-wheel-canvas" class="fw-canvas-bright" width="560" height="560"></canvas>
                        </div>
                    </div>
                </main>

                <!-- Floating Results (Hidden initially) -->
                <div id="fw-result" class="fw-result-floating hidden"></div>
                <div id="fw-summary" class="fw-summary-floating hidden"></div>

                <!-- Bottom Floating Controls -->
                <footer class="fw-controls-floating">
                    <div class="fw-controls-row">
                        <div id="fw-class-selector-wrap" class="fw-pill-selector">
                            <label for="fw-class-select" class="sr-only">Class</label>
                            <select id="fw-class-select" class="fw-select-clean">
                                <option value="">— Select a class —</option>
                            </select>
                        </div>

                        <div id="fw-availability" class="fw-availability-pill" aria-live="polite">
                            <div id="fw-availability-title" class="fw-availability-pill-title">Awaiting a class</div>
                            <div id="fw-availability-message" class="fw-availability-pill-message">Choose a class to see whether the wheel can awaken today.</div>
                            <div id="fw-availability-meta" class="fw-availability-pill-meta"></div>
                        </div>
                    </div>

                    <div class="fw-actions-centered">
                        <button id="fw-spin-btn" type="button" class="bubbly-button fw-btn-primary">
                            <span class="fw-btn-primary__label font-title">Spin the Wheel</span>
                        </button>
                        <button id="fw-next-btn" type="button" class="bubbly-button fw-btn-secondary hidden">
                            <span class="font-title">Next Guild</span>
                        </button>
                        <button id="fw-done-btn" type="button" class="bubbly-button fw-btn-success hidden">
                            <span class="font-title">Done</span>
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    </div>
`;
