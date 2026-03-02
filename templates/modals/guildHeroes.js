// templates/modals/guildHeroes.js

export const guildHeroesModalHTML = `
    <div id="guild-heroes-modal" class="guild-heroes-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="guild-heroes-title">
        <div id="guild-heroes-overlay-bg" class="guild-heroes-overlay-bg"></div>
        <div class="guild-heroes-card pop-in" id="guild-heroes-card">
            <button id="guild-heroes-close-btn" class="guild-heroes-close-btn" aria-label="Close">✕</button>

            <div class="guild-heroes-header">
                <h3 id="guild-heroes-title" class="font-title guild-heroes-title">Guild Heroes Analytics</h3>
                <p id="guild-heroes-subtitle" class="guild-heroes-subtitle"></p>
            </div>

            <div id="guild-heroes-overview" class="guild-heroes-overview"></div>
            <div id="guild-heroes-tabs" class="guild-heroes-tabs"></div>
            <div id="guild-heroes-content" class="guild-heroes-content"></div>
        </div>
    </div>
`;

