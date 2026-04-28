/**
 * Load config.json for each school deployment.
 * Local development may fall back to the hardcoded default config, but hosted
 * school deployments must provide config.json so they never connect to the
 * wrong Firebase project by accident.
 */

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

function isCanonicalHostedFallbackSite() {
    const { hostname, pathname } = window.location;
    const prefix = '/TheGreatClassQuest';
    return (
        hostname === 'nosvasedis.github.io' &&
        (pathname === prefix || pathname === `${prefix}/` || pathname.startsWith(`${prefix}/`))
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

let configLoaded = false;

if (isLocalHost() || isCanonicalHostedFallbackSite()) {
    import('./app.js');
} else {
    fetch('./config.json')
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((c) => {
            const firebase = c.firebaseConfig || c;
            if (firebase && firebase.apiKey && firebase.projectId && firebase.appId) {
                window.__GCQ_FIREBASE_CONFIG__ = firebase;
                configLoaded = true;
            }
            if (c.billingBaseUrl) window.__GCQ_BILLING_BASE_URL__ = c.billingBaseUrl;
            if (c.billingSchoolId) window.__GCQ_BILLING_SCHOOL_ID__ = c.billingSchoolId;
            if (c.functionsRegion) window.__GCQ_FIREBASE_FUNCTIONS_REGION__ = c.functionsRegion;
            if (c.aiTextConfig) window.__GCQ_AI_TEXT_CONFIG__ = c.aiTextConfig;
        })
        .catch(() => {})
        .finally(() => {
            if (!configLoaded) {
                renderConfigRequiredScreen();
                return;
            }
            import('./app.js');
        });
}
