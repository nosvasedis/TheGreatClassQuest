const CACHE_CHOICE_KEY = 'gcq_device_cache_choice_v1';

export function getDeviceCacheChoice() {
    if (typeof window === 'undefined') return 'shared';
    try {
        return window.localStorage.getItem(CACHE_CHOICE_KEY) === 'trusted'
            ? 'trusted'
            : 'shared';
    } catch (_) {
        return 'shared';
    }
}

export function hasChosenDeviceCache() {
    if (typeof window === 'undefined') return true;
    try {
        return Boolean(window.localStorage.getItem(CACHE_CHOICE_KEY));
    } catch (_) {
        return true;
    }
}

export function saveDeviceCacheChoice(choice) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CACHE_CHOICE_KEY, choice === 'trusted' ? 'trusted' : 'shared');
}

export function clearLocalAppData() {
    if (typeof window === 'undefined') return;
    const preservedCacheChoice = window.localStorage.getItem(CACHE_CHOICE_KEY);
    Object.keys(window.localStorage)
        .filter((key) => key.startsWith('gcq_') || key.startsWith('quest_') || key.startsWith('dismissed_makeups_'))
        .forEach((key) => window.localStorage.removeItem(key));
    if (preservedCacheChoice === 'shared') {
        window.localStorage.setItem(CACHE_CHOICE_KEY, 'shared');
    }
    window.sessionStorage.clear();
}

// The prompt itself (copy, look, animation) lives in ui/modals/deviceCachePrompt.js
// and is loaded only when it is actually needed: once per browser, after the
// first sign-in has settled. Nothing of it rides in the startup bundle.
let promptLoading = null;

export function offerDeviceCacheChoice(role) {
    if (hasChosenDeviceCache() || document.getElementById('gcq-device-cache-choice') || promptLoading) return;
    promptLoading = import('../ui/modals/deviceCachePrompt.js')
        .then((module) => module.openDeviceCachePrompt(role))
        .catch((error) => console.warn('Device cache prompt could not open:', error))
        .finally(() => { promptLoading = null; });
}
