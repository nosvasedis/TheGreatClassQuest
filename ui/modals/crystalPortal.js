// ui/modals/crystalPortal.js
// The Crystal Portal modal — opened by tapping the Portal at the end of the Team Quest
// road (or from the Crystal Realm overview). Shares #milestone-details-modal with the
// realm overviews (data-modal-mode="portal"). Rules: features/crystalPortalCore.mjs;
// markup: ./crystalPortalView.mjs; styles: styles/crystal_portal.css.

import '../../styles/crystal_portal.css';
import * as state from '../../state.js';
import { db, query, collection, where, getDocs } from '../../firebase.js';
import { getSchoolYearStartMonthDate } from '../../utils/schoolYear.js';
import { monthKeysSince, realmMonthKey } from '../../features/realmMomentsCore.mjs';
import { buildPortalView } from '../../features/crystalPortalCore.mjs';
import { portalModalHtml, keepersHtml } from './crystalPortalView.mjs';
import { collectLeagueParties, openZoneOverviewModal } from './realmOverview.js';
import { showAnimatedModal } from './base.js';

const MODAL_ID = 'milestone-details-modal';
const HISTORY_TTL_MS = 60 * 1000;

let historyCache = { yearKey: null, at: 0, rows: null };
let openToken = 0;

async function loadQuestHistory() {
    const yearKey = state.getActiveSchoolYearKey();
    if (!yearKey) throw new Error('School year unavailable; quest history reads are blocked.');
    if (historyCache.yearKey === yearKey && historyCache.rows && Date.now() - historyCache.at < HISTORY_TTL_MS) {
        return historyCache.rows;
    }
    const snap = await getDocs(query(
        collection(db, 'artifacts/great-class-quest/public/data/quest_history'),
        where('schoolYearKey', '==', yearKey)
    ));
    const rows = snap.docs.map((d) => d.data());
    historyCache = { yearKey, at: Date.now(), rows };
    return rows;
}

function schoolYearMonthKeys() {
    const start = getSchoolYearStartMonthDate(state.getActiveSchoolYearStartDate(), state.getActiveSchoolYearKey());
    return monthKeysSince(start ? new Date(start) : null);
}

/** The map already knows whether this laptop wants the lighter effects. */
function prefersLiteFx() {
    return document.querySelector('[data-living-quest-map]')?.dataset.fx === 'lite';
}

function bindPortalNavigation(contentEl) {
    if (contentEl.dataset.portalNavBound === 'true') return;
    contentEl.dataset.portalNavBound = 'true';
    contentEl.addEventListener('click', (event) => {
        const modal = document.getElementById(MODAL_ID);
        if (modal?.dataset.modalMode !== 'portal') return;
        if (event.target.closest('[data-portal-realm]')) {
            openZoneOverviewModal('crystal');
            contentEl.scrollTop = 0;
        }
    });
}

export function openCrystalPortalModal() {
    const league = state.get('globalSelectedLeague');
    if (!league) return;

    const modal = document.getElementById(MODAL_ID);
    const titleEl = document.getElementById('milestone-modal-title');
    const contentEl = document.getElementById('milestone-modal-content');
    if (!modal || !contentEl) return;

    const alreadyOpen = !modal.classList.contains('hidden');
    modal.dataset.modalMode = 'portal';
    if (titleEl) {
        titleEl.innerHTML = '';
        titleEl.className = 'hidden';
    }
    contentEl.className = 'custom-scrollbar';
    contentEl.scrollTop = 0;
    bindPortalNavigation(contentEl);

    const monthKey = realmMonthKey(new Date());
    const monthKeys = schoolYearMonthKeys();
    const parties = collectLeagueParties(league);
    const activeClassId = state.get('globalSelectedClassId') || null;
    const options = { league, monthKey, activeClassId, lite: prefersLiteFx() };

    contentEl.innerHTML = portalModalHtml(buildPortalView({ parties, activeClassId, monthKey, monthKeys }), options);
    if (!alreadyOpen) showAnimatedModal(MODAL_ID);

    // The year's record arrives a moment later; only this opening may fill it in.
    const token = ++openToken;
    loadQuestHistory()
        .then((history) => {
            const slot = contentEl.querySelector('[data-portal-keepers]');
            if (token !== openToken || modal.dataset.modalMode !== 'portal' || !slot) return;
            const view = buildPortalView({ parties, activeClassId, history, monthKey, monthKeys });
            slot.innerHTML = keepersHtml(view, { activeClassId });
            slot.classList.add('is-loaded');
        })
        .catch((error) => {
            console.warn('Crystal Portal: year record unavailable', error);
            const slot = contentEl.querySelector('[data-portal-keepers]');
            if (token !== openToken || modal.dataset.modalMode !== 'portal' || !slot) return;
            slot.innerHTML = keepersHtml({ keepers: null }, { failed: true });
        });
}
