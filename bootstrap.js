/**
 * Load config.json for each school deployment.
 * Local development may fall back to the hardcoded default config, but hosted
 * school deployments must provide config.json so they never connect to the
 * wrong Firebase project by accident.
 */

window.__GCQ_BUILD_ID__ = typeof __GCQ_BUILD_ID__ === 'string' ? __GCQ_BUILD_ID__ : 'development';

function logRuntimeFailure(label, error) {
    if (import.meta.env?.DEV) {
        console.error(label, error);
        return;
    }
    console.error(label, {
        name: String(error?.name || 'Error').slice(0, 80),
        code: String(error?.code || '').slice(0, 80)
    });
}

window.addEventListener('error', (event) => {
    logRuntimeFailure('GCQ runtime error', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    logRuntimeFailure('GCQ unhandled promise rejection', event.reason);
});

function isLocalHost() {
  const host = window.location.hostname;
  return (
        window.location.protocol === 'file:' ||
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host.endsWith('.local')
  );
}

function renderConfigRequiredScreen() {
    const root = document.getElementById('app-root');
    if (!root) return;

    root.innerHTML = `
        <div class="min-h-screen flex items-center justify-center p-6" style="background: linear-gradient(135deg, #a8e0ff 0%, #8ee3f8 100%);">
            <div class="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl border border-sky-100 p-8 md:p-10 text-center">
                <div class="w-20 h-20 mx-auto mb-5 rounded-[1.5rem] bg-sky-100 text-sky-600 flex items-center justify-center text-4xl">
                    <i class="fas fa-school-circle-exclamation"></i>
                </div>
                <h1 class="font-title text-4xl text-sky-700 mb-3">This School Site Is Not Configured Yet</h1>
                <p class="text-gray-600 text-lg leading-relaxed mb-6">
                    This hosted school site is missing its generated <code>config.json</code>, so GCQ stopped before connecting to the wrong Firebase school.
                </p>
                <div class="text-left bg-sky-50 border border-sky-100 rounded-2xl p-5 text-sm text-slate-700">
                    <p class="font-semibold text-sky-800 mb-2">Fix in your hosting provider:</p>
                    <p>Add the required school environment variables or GitHub Actions secrets, redeploy, and let the build create <code>config.json</code>.</p>
                    <p class="mt-3">Required vars: <code>GCQ_FIREBASE_API_KEY</code>, <code>GCQ_FIREBASE_AUTH_DOMAIN</code>, <code>GCQ_FIREBASE_PROJECT_ID</code>, <code>GCQ_FIREBASE_APP_ID</code>, plus the other school config values from the onboarding console.</p>
                </div>
            </div>
        </div>
    `;
}

function applyRuntimeConfig(c) {
    const firebase = c?.firebaseConfig || c;
    if (!firebase?.apiKey || !firebase?.projectId || !firebase?.appId) return false;
    window.__GCQ_FIREBASE_CONFIG__ = firebase;
    if (c.billingBaseUrl) window.__GCQ_BILLING_BASE_URL__ = c.billingBaseUrl;
    if (c.billingSchoolId) window.__GCQ_BILLING_SCHOOL_ID__ = c.billingSchoolId;
    if (c.functionsRegion) window.__GCQ_FIREBASE_FUNCTIONS_REGION__ = c.functionsRegion;
    if (c.appCheckSiteKey) window.__GCQ_APP_CHECK_SITE_KEY__ = c.appCheckSiteKey;
    if (c.aiTextConfig) window.__GCQ_AI_TEXT_CONFIG__ = c.aiTextConfig;
    if (c.certificateImageProxyUrl) window.__GCQ_CERTIFICATE_IMAGE_PROXY_URL__ = c.certificateImageProxyUrl;
    return true;
}

async function bootApplication() {
    if (isLocalHost()) {
        await import('./app.js');
        await import('./mobile/index.js');
        return;
    }

    let configLoaded = false;
    try {
        const response = await fetch(`./config.json?v=${encodeURIComponent(window.__GCQ_BUILD_ID__)}`, {
            cache: 'no-store',
        });
        if (response.ok) configLoaded = applyRuntimeConfig(await response.json());
    } catch (error) {
        console.warn('GCQ runtime configuration could not be loaded:', error);
    }

    if (!configLoaded) {
        renderConfigRequiredScreen();
        return;
    }
    await import('./app.js');
    await import('./mobile/index.js');
}

function showUpdateAvailable(registration) {
    if (!registration?.waiting || document.getElementById('gcq-update-ready')) return;
    const button = document.createElement('button');
    button.id = 'gcq-update-ready';
    button.type = 'button';
    button.className = 'gcq-update-ready-button font-title';
    button.setAttribute('aria-label', 'Update ready. Reload the app.');
    button.title = 'A new version is ready';
    button.innerHTML = '<span class="gcq-update-ready-sparkle" aria-hidden="true">✦</span><i class="fas fa-rotate gcq-update-ready-icon" aria-hidden="true"></i><span class="gcq-update-ready-label">Update ready</span>';
    button.addEventListener('click', () => {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin gcq-update-ready-icon" aria-hidden="true"></i><span class="gcq-update-ready-label">Updating…</span>';
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
    const mount = document.getElementById('gcq-update-ready-mount');
    if (mount) {
        mount.classList.remove('hidden');
        mount.appendChild(button);
    } else {
        // Defensive fallback for a future shell that does not include the header mount.
        button.classList.add('gcq-update-ready-button--fallback');
        document.body.appendChild(button);
    }
}

function watchForServiceWorkerUpdates(registration) {
    const checkForUpdate = () => {
        // Browsers do not push SW updates; we must poll. Failures are expected offline.
        registration.update().catch(() => {});
    };

    // Recheck when the teacher returns to the tab after a deploy.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
    });
    window.addEventListener('focus', checkForUpdate);

    // Keep open sessions current without waiting for a full reload.
    const UPDATE_POLL_MS = 60 * 1000;
    const pollId = window.setInterval(checkForUpdate, UPDATE_POLL_MS);
    window.addEventListener('beforeunload', () => window.clearInterval(pollId), { once: true });

    // First live check shortly after boot (idle registration is delayed).
    window.setTimeout(checkForUpdate, 15 * 1000);
}

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (isLocalHost()) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        return;
    }

    const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
    if (registration.waiting) showUpdateAvailable(registration);
    registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateAvailable(registration);
            }
        });
    });

    watchForServiceWorkerUpdates(registration);

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
}

void bootApplication();
window.addEventListener('load', () => {
    const register = () => void registerServiceWorker().catch((error) => console.warn('Service worker registration failed:', error));
    if ('requestIdleCallback' in window) window.requestIdleCallback(register, { timeout: 5000 });
    else setTimeout(register, 3000);
}, { once: true });
