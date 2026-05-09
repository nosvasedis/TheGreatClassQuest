// templates/index.js

import { loadingHTML, initLoadingTips } from './loading.js';
import { authHTML } from './auth.js';
import { subscribeHTML } from './subscribe.js';
import { setupHTML } from './setup.js';
import { appHTML } from './app/index.js';
import { roleShellsHTML } from './roles.js';
import { allModalsHTML } from './modals/index.js';

export function injectHTML() {
    document.getElementById('app-root').innerHTML =
        loadingHTML +
        authHTML +
        subscribeHTML +
        setupHTML +
        appHTML +
        roleShellsHTML +
        allModalsHTML;

    // Start rotating fun tips on the loading screen
    initLoadingTips();
}
