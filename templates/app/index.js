// templates/app/index.js

import { headerHTML } from './header.js';
import { mainContentHTML } from './tabs/index.js';
import { navHTML } from './nav.js';
import { ceremonyHTML } from './screens/ceremony.js';
import { grandGuildCeremonyHTML } from './screens/grandGuildCeremony.js';
import { wallpaperHTML } from './screens/wallpaper.js';

export const awardImmersiveSkyHTML = `
        <div id="award-immersive-sky" class="award-immersive-sky" aria-hidden="true">
            <div class="award-immersive-sky-gradient" aria-hidden="true"></div>
            <div class="award-immersive-stars" aria-hidden="true"></div>
            <div class="award-immersive-rain-fx" aria-hidden="true"></div>
            <div class="award-immersive-snow-fx" aria-hidden="true"></div>
            <div class="award-immersive-cloudy-fx" aria-hidden="true"></div>
            <div class="award-immersive-sun" aria-hidden="true"></div>
            <div class="award-immersive-moon" aria-hidden="true"></div>
            <div class="award-immersive-sky-parallax loading-cloud-art-layer" aria-hidden="true">
                <div class="loading-cloud-art lca-1"></div>
                <div class="loading-cloud-art lca-2"></div>
                <div class="loading-cloud-art lca-3"></div>
                <div class="loading-cloud-art lca-4"></div>
                <div class="loading-cloud-art lca-5"></div>
                <div class="loading-cloud-art lca-6"></div>
                <div class="loading-cloud-art lca-7"></div>
                <div class="loading-cloud-art lca-8"></div>
            </div>
        </div>`;

export const appHTML = `
    <div id="app-screen" class="hidden flex-1 flex flex-col h-full overflow-hidden">
        <div id="award-header-atmosphere" class="award-header-atmosphere relative z-[1000] flex shrink-0 flex-col overflow-visible shadow-md"
             style="background: linear-gradient(to right, #89f7fe 0%, #66a6ff 100%);">
        ${headerHTML}
        </div>
        ${awardImmersiveSkyHTML}
        ${mainContentHTML}
        ${navHTML}
    </div>
    ${ceremonyHTML}
    ${grandGuildCeremonyHTML}
    ${wallpaperHTML}
`;
