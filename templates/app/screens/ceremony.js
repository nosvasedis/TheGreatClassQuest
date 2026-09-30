// templates/app/screens/ceremony.js — shell for the Ceremony of the Month.
// The backdrop (torchlit arena or storybook garden) and every scene are drawn
// by features/ceremony.js from ceremonyArenaView.js / ceremonyGardenView.js.

export const ceremonyHTML = `
    <div id="ceremony-screen" class="cer-screen hidden" data-mode="arena" data-scene="intro" data-realm="ember"
        role="dialog" aria-modal="true" aria-label="Ceremony of the Month">
        <div id="ceremony-backdrop" class="cer-backdrop" aria-hidden="true"></div>
        <div id="ceremony-fx-host" class="cer-fx-host" aria-hidden="true"></div>

        <div class="cer-topbar" role="toolbar" aria-label="Ceremony controls">
            <button id="ceremony-close-btn" type="button" class="cer-iconbtn" title="Exit Ceremony (Esc)" aria-label="Exit Ceremony">
                <i class="fas fa-xmark" aria-hidden="true"></i>
            </button>
            <p id="ceremony-crumb" class="cer-topbar__crumb"></p>
            <div class="cer-topbar__end">
                <span class="cer-keyhint"><kbd>Space</kbd> Next</span>
                <button id="ceremony-sound-btn" type="button" class="cer-iconbtn" title="Sound on or off" aria-label="Sound on or off" aria-pressed="false">
                    <i id="ceremony-sound-icon" class="fas fa-volume-high" aria-hidden="true"></i>
                </button>
            </div>
        </div>

        <div class="cer-layout">
            <header id="ceremony-header" class="cer-heading is-empty">
                <p id="ceremony-subtitle" class="cer-heading__kicker"></p>
                <h2 id="ceremony-title" class="cer-heading__title"></h2>
            </header>
            <div id="ceremony-stage-area" class="cer-stage" role="region" aria-live="polite" aria-label="Ceremony stage"></div>
            <div id="ceremony-ai-box" class="cer-herald" aria-live="polite">
                <span class="cer-herald__icon" aria-hidden="true"></span>
                <p id="ceremony-ai-text"></p>
            </div>
            <div class="cer-controls">
                <button id="ceremony-action-btn" type="button" class="cer-action">
                    <span class="cer-action__label">Start Ceremony</span>
                </button>
            </div>
        </div>

        <ol id="ceremony-ladder" class="cer-ladder" aria-label="Revealed so far"></ol>
    </div>
`;
