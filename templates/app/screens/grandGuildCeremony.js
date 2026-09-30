// templates/app/screens/grandGuildCeremony.js — shell for the Grand Guild
// Ceremony (end of year). Every id is grd- prefixed so it never collides with
// the Ceremony of the Month screen. Scenes are drawn by
// features/grandGuildCeremony.js from features/grandCeremonyView.js.

export const grandGuildCeremonyHTML = `
    <div id="grand-guild-ceremony-screen" class="grd-screen hidden" data-scene="opening" data-realm="dusk"
        role="dialog" aria-modal="true" aria-label="Grand Guild Ceremony">
        <div id="grd-backdrop" class="grd-backdrop" aria-hidden="true"></div>
        <div id="grd-fx-host" class="grd-fx-host" aria-hidden="true"></div>

        <div class="grd-topbar" role="toolbar" aria-label="Ceremony controls">
            <button id="grd-close-btn" type="button" class="grd-iconbtn" title="Exit Ceremony (Esc)" aria-label="Exit Ceremony">
                <i class="fas fa-xmark" aria-hidden="true"></i>
            </button>
            <ol id="grd-chapters" class="grd-chapters" aria-label="Chapters"></ol>
            <button id="grd-sound-btn" type="button" class="grd-iconbtn" title="Sound on or off" aria-label="Sound on or off" aria-pressed="false">
                <i id="grd-sound-icon" class="fas fa-volume-high" aria-hidden="true"></i>
            </button>
        </div>

        <div class="grd-layout">
            <header id="grd-header" class="grd-heading is-empty">
                <p id="grd-kicker" class="grd-heading__kicker"></p>
                <h2 id="grd-title" class="grd-heading__title"></h2>
            </header>
            <div id="grd-stage" class="grd-stage" role="region" aria-live="polite" aria-label="Ceremony stage"></div>
            <div id="grd-herald" class="grd-herald" aria-live="polite">
                <span class="grd-herald__icon" aria-hidden="true"></span>
                <p id="grd-herald-text"></p>
            </div>
            <div class="grd-controls">
                <button id="grd-action-btn" type="button" class="grd-action">
                    <span class="grd-action__label">Begin the Festival</span>
                </button>
            </div>
        </div>
    </div>
`;
