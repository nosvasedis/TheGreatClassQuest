// ui/core/marketGuide.js — opens "How treasures work" over the Mystic Market with this
// league's live numbers and the chosen shopper's Hoard. Markup: marketGuideView.mjs.
import * as state from '../../state.js';
import { JUNIOR_LEAGUES } from '../../constants.js';
import { buildHoard, smartStockMax } from '../../features/treasureCharmsCore.mjs';
import { stallRosterFor } from '../../db/actions/smartStock.js';
import { renderMarketGuideHtml } from './marketGuideView.mjs';
import '../../styles/market_guide.css';

function currentLeague() {
    const classId = state.get('globalSelectedClassId');
    const cls = (state.get('allTeachersClasses') || []).find((c) => c.id === classId);
    return state.get('globalSelectedLeague') || cls?.questLevel || '';
}

export function openMarketGuide({ studentId = '', opener = null } = {}) {
    document.querySelector('.mg-overlay')?.remove();
    const league = currentLeague();
    const roster = stallRosterFor(league);
    const copies = Object.fromEntries(['common', 'rare', 'legendary']
        .map((tier) => [tier, smartStockMax({ tier, children: roster.children })]));
    const student = studentId ? (state.get('allStudents') || []).find((s) => s.id === studentId) : null;
    const score = student ? (state.get('allStudentScores') || []).find((s) => s.id === studentId) : null;

    const overlay = document.createElement('div');
    overlay.className = 'mg-overlay';
    overlay.innerHTML = renderMarketGuideHtml({
        league,
        young: JUNIOR_LEAGUES.includes(league),
        children: roster.children,
        classCount: roster.classCount,
        copies,
        shopper: student ? { name: student.name, hoard: buildHoard(score?.inventory) } : null
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));

    const close = () => {
        window.removeEventListener('keydown', onKey, true);
        overlay.classList.remove('is-open');
        setTimeout(() => overlay.remove(), 220);
        opener?.focus?.({ preventScroll: true });
    };
    const onKey = (e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        close();
    };
    window.addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.closest('[data-mg-close]')) close();
    });
    overlay.querySelector('.mg-done')?.focus({ preventScroll: true });
}
