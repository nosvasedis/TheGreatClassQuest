// templates/modals/fortunesWheel.js — Fortune's Wheel modal template

export const fortunesWheelModalHTML = `
    <div id="fortunes-wheel-modal"
        class="fixed inset-0 z-[75] flex items-center justify-center p-4 hidden"
        role="dialog"
        aria-labelledby="fortunes-wheel-title"
        aria-modal="true">

        <div class="fw-backdrop"></div>

        <div class="fw-card pop-in">
            <!-- Header -->
            <div class="fw-header">
                <h2 id="fortunes-wheel-title" class="fw-title">⚜️ Fortune's Wheel ⚜️</h2>
                <div id="fw-guild-header" class="fw-guild-header"></div>
            </div>

            <!-- Class Selector -->
            <div id="fw-class-selector-wrap" class="fw-class-selector-wrap">
                <label for="fw-class-select" class="fw-class-selector-label">&#127775; Class</label>
                <select id="fw-class-select" class="fw-class-selector-select">
                    <option value="">&#8212; Select a class &#8212;</option>
                </select>
            </div>

            <!-- Wheel Canvas Area -->
            <div id="fw-canvas-wrap" class="fw-canvas-wrap">
                <div class="fw-pointer" aria-hidden="true">▼</div>
                <canvas id="fortunes-wheel-canvas" class="fw-canvas" width="380" height="380"></canvas>
            </div>

            <!-- Result Display -->
            <div id="fw-result" class="fw-result hidden"></div>

            <!-- Summary Display -->
            <div id="fw-summary" class="fw-summary hidden"></div>

            <!-- Buttons -->
            <div class="fw-footer">
                <button id="fw-spin-btn" type="button" class="fw-btn fw-btn--spin">
                    🎰 Spin!
                </button>
                <button id="fw-next-btn" type="button" class="fw-btn fw-btn--next hidden">
                    ➡️ Next Guild
                </button>
                <button id="fw-done-btn" type="button" class="fw-btn fw-btn--done hidden">
                    ✨ Done!
                </button>
                <button id="fw-close-btn" type="button" class="fw-btn fw-btn--close">
                    ✕
                </button>
            </div>
        </div>
    </div>
`;
