// templates/modals/guildHeroes.js — the Guild Spotlight (filled by ui/modals/guildHeroes.js)

export const guildHeroesModalHTML = `
    <div id="guild-heroes-modal" class="gsp-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="gsp-title">
        <div id="guild-heroes-overlay-bg" class="gsp-overlay__bg"></div>
        <div class="gsp-card pop-in" id="guild-heroes-card">
            <div class="gsp-card__wash" aria-hidden="true"></div>
            <button id="guild-heroes-close-btn" class="gsp-close" type="button" aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>
            <nav id="gsp-guilds" class="gsp-guilds" aria-label="Choose a guild"></nav>
            <header id="gsp-hero" class="gsp-hero"></header>
            <div id="gsp-tabs" class="gsp-tabs" role="tablist" aria-label="Spotlight sections"></div>
            <div id="gsp-body" class="gsp-body" role="tabpanel" aria-live="polite"></div>
        </div>
    </div>
`;
