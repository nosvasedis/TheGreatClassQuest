// features/portalMoments.js
// What the teacher sees when a class reaches the Crystal Portal:
//  - stepping through: a short rank-up banner (also on the projector) and the app's normal
//    notification with the Portal spoils;
//  - stars full but a rune still sleeps, or the Guardian waits: one notification per class,
//    per state, per session, with a button to the Portal (or to the Guardian).
// Rules: questRanksCore.mjs. The banner reuses the realm-moment banner look (realm_moments.css).
import '../styles/quest_ranks.css';
import '../styles/realm_moments.css';
import * as utils from '../utils.js';
import { detectLowPowerTier } from '../utils/devicePerformance.mjs';
import { rankForLevel, newAtLevel } from './questRanksCore.mjs';
import { rankCrestSvg } from './questRankCrest.mjs';

const told = new Set();

function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function notify(options) {
    return import('../ui/effects.js').then(({ notify: show }) => show(options)).catch(() => null);
}

function openPortal() {
    import('../ui/modals/crystalPortal.js').then(({ openCrystalPortalModal }) => openCrystalPortalModal()).catch(() => {});
}

function openGuardian(classId) {
    import('./portalGuardian.js').then(({ openPortalGuardian }) => openPortalGuardian(classId)).catch(() => {});
}

/** The first rune still asleep, in words ("Focus needs 3★ more"). */
export function sleepingRuneLine(status) {
    const rune = status.runes.find((r) => !r.met && r.id !== 'guardian');
    if (!rune) return '';
    if (rune.id === 'virtues') {
        const short = rune.parts.filter((p) => !p.met).map((p) => `${p.label} ${Math.ceil(p.need - p.have)}★`);
        return `Four Virtues: still to light ${short.join(', ')}.`;
    }
    if (rune.id === 'lanterns') {
        const left = Math.max(1, rune.need - rune.have);
        return `Lanterns: ${left} more ${left === 1 ? 'hero needs' : 'heroes need'} ${rune.each}★ this month.`;
    }
    if (rune.id === 'ownLight') {
        return `Own Light: the heroes' own stars need ${Math.ceil(rune.need - rune.have)}★ more.`;
    }
    return '';
}

/** Stars are full but the Portal waits (once per class, per state, per session). */
export function announcePortalWaiting(classData, status) {
    if (!classData?.id || !status) return;
    const key = `${classData.id}|${utils.getMonthKey()}|${status.state}|${status.runesLit}|${status.guardian?.triedToday ? 't' : ''}`;
    if (told.has(key)) return;
    told.add(key);
    const who = `${classData.logo || ''} ${classData.name || 'The class'}`.trim();
    if (status.state === 'guardian') {
        if (status.guardian.triedToday) return;
        notify({
            type: 'praise',
            title: 'The Portal Guardian',
            icon: '🗝️',
            key: `portal-${classData.id}`,
            duration: 9000,
            message: `${esc(who)} filled the goal and lit every rune! The Guardian waits at the gate with ${status.guardian.questions} riddles.`,
            action: { label: 'Face the Guardian', icon: 'fa-dungeon', onClick: () => openGuardian(classData.id) }
        });
        return;
    }
    notify({
        type: 'info',
        title: 'The Portal is sealed',
        icon: '🔮',
        key: `portal-${classData.id}`,
        duration: 8000,
        message: `${esc(who)} filled the goal, but a Portal rune still sleeps. ${esc(sleepingRuneLine(status))}`,
        action: { label: 'See the runes', icon: 'fa-gem', onClick: openPortal }
    });
}

// ─── Stepping through ────────────────────────────────────────────────────────

export function rankBannerHtml(classData, toLevel, { lite = false } = {}) {
    const rank = rankForLevel(toLevel);
    const sparks = lite ? '' : Array.from({ length: 8 }, (_, i) => `<i class="rm-banner__spark" style="--i:${i}"></i>`).join('');
    return `
        <div class="rm-banner rm-banner--rank qr-banner--${rank.id}${lite ? ' rm-banner--lite' : ''}" role="status" aria-live="polite">
            <span class="rm-banner__rays" aria-hidden="true"></span>
            <span class="rm-banner__ribbon" aria-hidden="true"></span>
            <span class="rm-banner__badge-wrap" aria-hidden="true">
                <span class="rm-banner__badge qr-banner__crest">${rankCrestSvg(toLevel)}</span>
                ${sparks}
            </span>
            <span class="rm-banner__copy">
                <small><span class="rm-banner__logo">${esc(classData?.logo || '📚')}</span>${esc(classData?.name || 'Our class')} stepped through the Portal</small>
                <strong class="font-title">${esc(rank.title)}</strong>
                <em>Quest Level ${rank.displayLevel} · ${esc(rank.motto)}</em>
            </span>
            <span class="rm-banner__stamp" aria-hidden="true"><b>${rank.displayLevel}</b><span>New rank</span></span>
        </div>`;
}

export function showRankBanner(classData, toLevel) {
    return new Promise((resolve) => {
        const host = document.createElement('div');
        host.className = 'rm-host';
        host.innerHTML = rankBannerHtml(classData, toLevel, { lite: detectLowPowerTier() });
        document.body.appendChild(host);
        import('../audio.js').then(({ playSound }) => playSound('hero_fanfare')).catch(() => {});
        setTimeout(() => { host.remove(); resolve(); }, 3200);
    });
}

/** The class stepped through: banner, then the notification with the spoils and what comes next. */
export async function announcePortalCrossing(classData, crossing) {
    if (!crossing) return;
    const rank = rankForLevel(crossing.toLevel);
    const next = newAtLevel(crossing.toLevel);
    try { await showRankBanner(classData, crossing.toLevel); } catch (_) { /* the notification still comes */ }
    const who = `${classData.logo || ''} ${classData.name || 'The class'}`.trim();
    const gold = crossing.gold > 0 && crossing.heroes > 0 ? ` +${crossing.gold} Gold for every hero.` : '';
    const ahead = next ? ` Next month: ${esc(next.text)}` : ' Next month the goal grows a little.';
    notify({
        type: 'praise',
        title: 'The Portal opens',
        icon: '🌀',
        key: `portal-${classData.id}`,
        duration: 10000,
        message: `${esc(who)} are now ${esc(rank.title)} (Level ${rank.displayLevel}).${gold}${ahead}`,
        action: { label: 'Open the Portal', icon: 'fa-door-open', onClick: openPortal }
    });
}
