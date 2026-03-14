// templates/index.js

import { loadingHTML } from './loading.js';
import { authHTML } from './auth.js';
import { setupHTML } from './setup.js';
import { appHTML } from './app/index.js';
import { allModalsHTML } from './modals/index.js';

export function injectHTML() {
    document.getElementById('app-root').innerHTML =
        loadingHTML +
        authHTML +
        setupHTML +
        appHTML +
        allModalsHTML;
}
