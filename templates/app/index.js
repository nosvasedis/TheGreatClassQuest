// templates/app/index.js

import { headerHTML, svgFiltersHTML, DEFAULT_SKY_SCENE } from './header.js';
import { buildCloudsHtml } from '../../features/skyWeatherArt.js';
import { mainContentHTML } from './tabs/index.js';
import { navHTML } from './nav.js';
import { ceremonyHTML } from './screens/ceremony.js';
import { grandGuildCeremonyHTML } from './screens/grandGuildCeremony.js';
import { wallpaperHTML, celestialMoonHTML } from './screens/wallpaper.js';

export const awardImmersiveSkyHTML = `
        <div id="award-immersive-sky" class="award-immersive-sky" aria-hidden="true">
            <div class="award-immersive-sky-gradient" aria-hidden="true"></div>
            <div class="award-immersive-stars" aria-hidden="true"></div>
            <div class="award-immersive-sun" aria-hidden="true"></div>
            <div class="award-immersive-moon gcq-moon" aria-hidden="true">${celestialMoonHTML()}</div>
            <div class="award-immersive-sky-parallax wx-clouds wx-clouds--sky" aria-hidden="true">${buildCloudsHtml(DEFAULT_SKY_SCENE, 'sky')}</div>
            <div class="wx-stage wx-stage--sky" aria-hidden="true"></div>
        </div>`;

export const appHTML = `
    ${svgFiltersHTML}
    <div id="app-screen" class="hidden flex-1 flex flex-col h-full overflow-hidden">
        <div id="award-header-atmosphere" class="award-header-atmosphere relative z-[60] flex shrink-0 flex-col overflow-visible shadow-md">
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
