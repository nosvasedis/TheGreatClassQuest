import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { APP_CHECK_SITE_KEY } from './constants.js';
import { app } from './firebaseApp.js';

let appCheck = null;

export function getAppCheckInstance() {
    if (!APP_CHECK_SITE_KEY || typeof window === 'undefined') return null;
    if (!appCheck) {
        appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
            isTokenAutoRefreshEnabled: true
        });
    }
    return appCheck;
}

export async function getAppCheckHeader() {
    const instance = getAppCheckInstance();
    if (!instance) return {};
    try {
        const result = await getToken(instance, false);
        return result?.token ? { 'X-Firebase-AppCheck': result.token } : {};
    } catch (error) {
        console.warn('App Check token is temporarily unavailable:', error?.message || error);
        return {};
    }
}

