// templates/app/tabs/index.js

import { homeTabHTML } from './home.js';
import { leaderboardTabHTML } from './leaderboard.js';
import { guildsTabHTML } from './guilds.js';
import { classesTabHTML } from './classes.js';
import { studentsTabHTML } from './students.js';
import { awardTabHTML } from './award.js';
import { logTabHTML } from './log.js';
import { scrollTabHTML } from './scroll.js';
import { calendarTabHTML } from './calendar.js';
import { ideasTabHTML } from './ideas.js';
import { optionsTabHTML } from './options.js';

export const mainContentHTML = `
        <main class="flex-1 overflow-y-auto p-4 md:p-6">
            <div id="bounty-board-container" class="max-w-7xl mx-auto mb-4 empty:hidden"></div>
            ${homeTabHTML}
            ${leaderboardTabHTML}
            ${guildsTabHTML}
            ${classesTabHTML}
            ${studentsTabHTML}
            ${awardTabHTML}
            ${logTabHTML}
            ${scrollTabHTML}
            ${calendarTabHTML}
            ${ideasTabHTML}
            ${optionsTabHTML}
        </main>
`;
