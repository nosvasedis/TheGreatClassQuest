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

export function offerDeviceCacheChoice() {
    if (hasChosenDeviceCache() || document.getElementById('gcq-device-cache-choice')) return;

    const panel = document.createElement('section');
    panel.id = 'gcq-device-cache-choice';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'gcq-device-cache-title');
    panel.className = 'fixed inset-0 z-[2200] flex items-center justify-center bg-slate-950/55 p-4';
    panel.innerHTML = `
        <div class="w-full max-w-lg rounded-[2rem] border border-sky-100 bg-white p-7 shadow-2xl">
            <div class="mb-4 text-4xl" aria-hidden="true">⚡</div>
            <h2 id="gcq-device-cache-title" class="font-title text-2xl text-sky-800">Keep this teacher device fast?</h2>
            <p class="mt-3 leading-relaxed text-slate-600">Choose the recommended teacher-device option when this Windows/browser profile is used only by school staff. GCQ can then keep its protected browser cache for faster starts and fewer Firebase reads.</p>
            <p class="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Choose shared browser only</strong> if students, parents, guests, or unrelated accounts can use this same browser profile.</p>
            <div class="mt-6 grid gap-3 sm:grid-cols-2">
                <button type="button" data-cache-choice="trusted" class="rounded-2xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200">Yes — teacher device</button>
                <button type="button" data-cache-choice="shared" class="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200">No — shared browser</button>
            </div>
            <p class="mt-4 text-xs text-slate-500">This changes local caching only—not login, permissions, school-year data, or app features.</p>
        </div>`;

    panel.addEventListener('click', (event) => {
        const button = event.target.closest('[data-cache-choice]');
        if (!button) return;
        const choice = button.dataset.cacheChoice;
        saveDeviceCacheChoice(choice);
        panel.remove();
        if (choice === 'trusted') window.location.reload();
    });
    document.body.appendChild(panel);
    panel.querySelector('[data-cache-choice="trusted"]')?.focus();
}
