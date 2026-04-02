// templates/modals/fortunesWheel.js — Fortune's Wheel modal template

export const fortunesWheelModalHTML = `
    <div id="fortunes-wheel-modal"
        class="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4 hidden"
        role="dialog"
        aria-labelledby="fortunes-wheel-title"
        aria-modal="true">

        <div class="fw-backdrop"></div>

        <div class="fw-card pop-in">
            <button id="fw-close-btn" type="button" class="fw-btn fw-btn--close" aria-label="Close Fortune's Wheel">
                ×
            </button>

            <div class="fw-shell-glow fw-shell-glow--left" aria-hidden="true"></div>
            <div class="fw-shell-glow fw-shell-glow--right" aria-hidden="true"></div>
            <div class="fw-shell-stars" aria-hidden="true"></div>

            <div class="fw-header">
                <div class="fw-kicker">Celestial Relic</div>
                <h2 id="fortunes-wheel-title" class="fw-title">Fortune's Wheel</h2>
                <p class="fw-subtitle">A mysterious wheel of omens, treasure, and guild-altering fate.</p>
                <div id="fw-guild-header" class="fw-guild-header"></div>
            </div>

            <div class="fw-layout">
                <section class="fw-panel fw-panel--control">
                    <div id="fw-class-selector-wrap" class="fw-class-selector-wrap">
                        <label for="fw-class-select" class="fw-class-selector-label">Class</label>
                        <select id="fw-class-select" class="fw-class-selector-select">
                            <option value="">— Select a class —</option>
                        </select>
                    </div>

                    <div id="fw-availability" class="fw-availability" aria-live="polite">
                        <div class="fw-availability__eyebrow">Wheel Status</div>
                        <div id="fw-availability-title" class="fw-availability__title">Awaiting a class</div>
                        <p id="fw-availability-message" class="fw-availability__message">Choose a class to see whether the wheel can awaken today.</p>
                        <div id="fw-availability-meta" class="fw-availability__meta"></div>
                    </div>

                    <div class="fw-footer">
                        <button id="fw-spin-btn" type="button" class="fw-btn fw-btn--spin">
                            <span class="fw-btn__glow" aria-hidden="true"></span>
                            <span class="fw-btn__label">Spin the Wheel</span>
                        </button>
                        <button id="fw-next-btn" type="button" class="fw-btn fw-btn--next hidden">
                            Next Guild
                        </button>
                        <button id="fw-done-btn" type="button" class="fw-btn fw-btn--done hidden">
                            Done
                        </button>
                    </div>
                </section>

                <section class="fw-panel fw-panel--stage">
                    <div id="fw-stage-frame" class="fw-stage-frame">
                        <div class="fw-stage-aura" aria-hidden="true"></div>
                        <div class="fw-stage-ring" aria-hidden="true"></div>
                        <div id="fw-canvas-wrap" class="fw-canvas-wrap">
                            <div class="fw-pointer" aria-hidden="true"></div>
                            <canvas id="fortunes-wheel-canvas" class="fw-canvas" width="560" height="560"></canvas>
                        </div>
                    </div>

                    <div id="fw-result" class="fw-result hidden"></div>
                    <div id="fw-summary" class="fw-summary hidden"></div>
                </section>
            </div>
        </div>
    </div>
`;
