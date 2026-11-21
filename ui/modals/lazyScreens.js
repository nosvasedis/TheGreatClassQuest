// /ui/modals/lazyScreens.js
// Windows that open only on demand (Hall of Heroes, Prodigies, Weekly Report, certificates,
// the Hero Folio). The barrel (./index.js) exports these thin entry points instead of the big
// modules, so those load on first open and not with the start-up chunks. Same names, same
// arguments: callers keep using `modals.openProdigyModal()` and friends.
import { showToast } from '../effects.js';

// A failed load must not look like a dead button. Say so; the rethrow lets the app's
// stale-build recovery see the chunk error too (same as lazyOpen in ./student.js).
function lazy(load, pick) {
    return async (...args) => {
        let mod;
        try {
            mod = await load();
        } catch (error) {
            showToast('That window could not load. Check the connection and try again.', 'error');
            throw error;
        }
        return pick(mod)(...args);
    };
}

const rankings = () => import('./rankings.js');
const reports = () => import('./reports.js');
const analytics = () => import('./studentAnalytics.js');

export const openStudentRankingsModal = lazy(rankings, (m) => m.openStudentRankingsModal);
export const openHallOfHeroes = lazy(rankings, (m) => m.openHallOfHeroes);
export const openBestowBoonModal = lazy(rankings, (m) => m.openBestowBoonModal);
export const openProdigyModal = lazy(rankings, (m) => m.openProdigyModal);
export const handleGenerateReport = lazy(reports, (m) => m.handleGenerateReport);
export const handleGenerateCertificate = lazy(reports, (m) => m.handleGenerateCertificate);
export const downloadCertificateAsPdf = lazy(reports, (m) => m.downloadCertificateAsPdf);
export const openStudentAnalyticsModal = lazy(analytics, (m) => m.openStudentAnalyticsModal);
export const closeStudentAnalyticsModal = lazy(analytics, (m) => m.closeStudentAnalyticsModal);
