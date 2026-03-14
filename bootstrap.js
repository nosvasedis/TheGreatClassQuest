/**
 * Load optional config.json (for per-site Firebase config) then start the app.
 * If config.json is missing or fails (e.g. your school on GitHub Pages), the app
 * uses the hardcoded config in constants.js — no change in behavior.
 */
fetch('./config.json')
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((c) => {
        const firebase = c.firebaseConfig || c;
        if (firebase && firebase.apiKey) {
            window.__GCQ_FIREBASE_CONFIG__ = firebase;
        }
    })
    .catch(() => {})
    .finally(() => {
        import('./app.js');
    });
