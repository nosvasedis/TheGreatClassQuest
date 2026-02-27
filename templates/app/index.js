// templates/app/index.js

import { headerHTML } from './header.js';
import { mainContentHTML } from './tabs/index.js';
import { navHTML } from './nav.js';
import { ceremonyHTML } from './screens/ceremony.js';
import { grandGuildCeremonyHTML } from './screens/grandGuildCeremony.js';
import { wallpaperHTML } from './screens/wallpaper.js';

export const appHTML = `
    <div id="app-screen" class="hidden flex-1 flex flex-col h-full overflow-hidden">
        ${headerHTML}
        ${mainContentHTML}
        ${navHTML}
    </div>
    ${ceremonyHTML}
    ${grandGuildCeremonyHTML}
    ${wallpaperHTML}
`;
