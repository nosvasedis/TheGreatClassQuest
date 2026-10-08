// Hero Campfire entry points: the hearth button in the Adventure Log (under Log / Hall of Heroes),
// a small Home reminder badge, and the Oath Board shortcut. The heavy scene and service load only on click.
import * as state from '../state.js';
import { canUseFeature } from '../utils/subscription.js';
import { getTodayDateString, getLocalIsoDateString } from '../utils.js';
import { showToast } from '../ui/effects.js';
import { evaluateOathEvidence } from './emberOathEvidence.mjs';

const FLAME = '<svg class="campfire-flame" viewBox="0 0 48 64" aria-hidden="true">' +
    '<path class="campfire-flame__outer" fill="#fa7844" d="M25 1C38 20 47 29 43 43 39 60 13 65 5 47-2 30 16 23 16 12c6 5 8 9 7 14C30 17 30 9 25 1Z"/>' +
    '<path class="campfire-flame__mid" fill="#ffc969" d="M25 20c10 13 14 20 9 29-5 10-20 9-23-1-3-11 9-17 10-23l4 10c4-5 3-9 0-15Z"/>' +
    '<path class="campfire-flame__core" fill="#fff5c8" d="M24 37c4 7 10 11 5 16-5 6-13 1-11-5 1-4 5-6 6-11Z"/></svg>';
const completed = new Set();
const igniting = new Set();
const dismissKey = classId => 'gcq_campfire_dismissed_' + classId + '_' + getLocalIsoDateString();
const isDismissed = classId => { try { return localStorage.getItem(dismissKey(classId)) === '1'; } catch { return false; } };

/** The hearth medallion: an ember disc with a glow, the flame and two crossed logs. */
const hearthMedallion = cls => '<span class="campfire-medallion ' + cls + '" aria-hidden="true"><span class="campfire-medallion__halo"></span>' + FLAME + '<span class="campfire-medallion__logs"></span></span>';
const LATER_BUTTON = '<button type="button" class="campfire-later" data-campfire-later aria-label="Not today: hide the Campfire until tomorrow" title="Not today"><i class="fas fa-times" aria-hidden="true"></i></button>';

/** Adventure Log hearth: a little night scene under Log / Hall of Heroes. Pure markup (also used by the preview harness). */
export function campfireChipMarkup({ held = false, igniting: ignite = false, oaths = true, ready = 0 } = {}) {
    const sparks = ignite ? '<span class="campfire-chip__sparks" aria-hidden="true">' + Array.from({ length: 12 }, (_, i) => '<i style="--i:' + i + '"></i>').join('') + '</span>' : '';
    const badge = ready ? '<span class="campfire-oaths-badge">' + ready + ' ready</span>' : '';
    return '<div class="campfire-hearth' + (held ? ' is-held' : '') + (ignite ? ' is-igniting' : '') + '">' +
        '<span class="campfire-hearth__sky" aria-hidden="true"><span class="campfire-hearth__stars"></span><span class="campfire-hearth__hills"></span></span>' + sparks +
        '<button type="button" class="campfire-chip" data-campfire-open>' + hearthMedallion('campfire-chip__hearth') +
        '<span class="campfire-chip__text"><span class="campfire-chip__eyebrow">' + (held ? 'Embers resting' : 'Hero Campfire') + '</span>' +
        '<strong>' + (held ? 'Campfire held' : 'Gather at the Campfire') + '</strong>' +
        '<small>' + (held ? 'Tap to relight it' : '2 minutes · words · a question · promises') + '</small></span>' +
        '<span class="campfire-chip__cta" aria-hidden="true">' + (held ? '<i class="fas fa-redo-alt"></i><span>Relight</span>' : '<span>Gather</span><i class="fas fa-arrow-right"></i>') + '</span></button>' +
        (oaths ? '<button type="button" class="campfire-hearth__oaths" data-campfire-oaths title="Ember Oaths"><span class="campfire-hearth__oaths-icon" aria-hidden="true"><i class="fas fa-fire-alt"></i></span><span class="campfire-hearth__oaths-label">Oaths</span>' + badge + '</button>' : '') +
        (held ? '' : LATER_BUTTON) + '</div>';
}

/** Home greeting-card reminder badge (same family as the other `home-pill`s), with the same "Not today" ✕. */
export function campfireHomePillMarkup({ held = false, igniting: ignite = false } = {}) {
    return '<div class="date-pill home-pill home-pill--campfire campfire-home-pill' + (held ? ' is-held' : '') + (ignite ? ' is-igniting' : '') + '">' +
        '<span class="home-pill__shine" aria-hidden="true"></span>' +
        '<button type="button" class="campfire-home-pill__open" data-campfire-open>' + hearthMedallion('campfire-home-pill__icon') +
        '<span class="home-pill__body"><span class="home-pill__eyebrow">' + (held ? 'Campfire held' : 'Hero Campfire') + '</span>' +
        '<span class="home-pill__title">' + (held ? 'Relight the embers' : 'Gather round') + '</span></span></button>' +
        LATER_BUTTON + '</div>';
}

/** The Oaths button when the Campfire is not lit: same family as Log / Hall of Heroes. */
export function oathsButtonMarkup({ ready = 0, variant = 'log', disabled = false } = {}) {
    const badge = ready ? '<span class="campfire-oaths-badge">' + ready + ' ready</span>' : '';
    const off = disabled ? ' disabled aria-disabled="true" title="Select a class in the header first"' : '';
    // My Classes card tool (styles/class_cards.css): name plus a hint, like its neighbours.
    if (variant === 'class') return '<button type="button" data-campfire-oaths class="mc-tool mc-tool--oaths campfire-class-oaths" title="Ember Oaths: the promises each student is keeping"' + off + '><span class="mc-tool__icon" aria-hidden="true"><i class="fas fa-fire-alt"></i></span><span class="mc-tool__text"><span class="mc-tool__name">Ember Oaths</span><span class="mc-tool__hint">Students\' promises</span></span>' + badge + '</button>';
    return '<button type="button" data-campfire-oaths class="al-primary-btn al-primary-btn--oaths bubbly-button"' + off + '><i class="fas fa-fire-alt"></i><span>Ember Oaths</span>' + badge + '</button>';
}

function todaysLog(classId) {
    return (state.get('allAdventureLogs') || []).find(l => l.classId === classId && l.date === getTodayDateString());
}
function readyCount(classId) {
    if (!state.get('hasLoadedEmberOaths')) return 0;
    // Same rule as the Oath Board, so a virtue promise filled by stars counts here too.
    const facts = { awards: state.get('allAwardLogs') || [], writtenScores: state.get('allWrittenScores') || [], today: getLocalIsoDateString() };
    return (state.get('allEmberOaths') || []).filter(o => o.classId === classId && o.status === 'active' && evaluateOathEvidence(o, facts).ready).length;
}

export function mountCampfireEntry(host, classId, { oathsOnly = false, home = false } = {}) {
    if (!host) return;
    // Home redraws the greeting often; an unchanged badge stays put instead of popping in again.
    // (Taking a node out and back in would restart its animations, so it is only moved if needed.)
    const existing = host.querySelector(':scope > .campfire-entry');
    if (!canUseFeature('heroCampfire')) { existing?.remove(); return; }
    if (!classId) {
        existing?.remove();
        if (!home && !oathsOnly) mountDisabledOathsButton(host);
        return;
    }
    const c = state.get('allTeachersClasses').find(item => item.id === classId); if (!c) { existing?.remove(); return; }
    watchOaths();
    const log = todaysLog(classId);
    const celebrationClosed = document.getElementById('hero-celebration-modal')?.classList.contains('hidden') !== false;
    const key = classId + '_' + getTodayDateString();
    const held = completed.has(key);
    const ready = !oathsOnly && c.campfireEnabled !== false && log && celebrationClosed && !isDismissed(classId);
    if (home && !ready) { existing?.remove(); return; }
    const entry = document.createElement('div');
    entry.className = 'campfire-entry' + (home ? ' campfire-entry--home' : '') + (oathsOnly ? ' campfire-entry--class' : '');
    entry.dataset.classId = classId;
    if (ready) {
        entry.insertAdjacentHTML('beforeend', home
            ? campfireHomePillMarkup({ held, igniting: igniting.has(key) })
            : campfireChipMarkup({ held, igniting: igniting.has(key), ready: readyCount(classId) }));
        igniting.delete(key);
        const button = entry.querySelector('[data-campfire-open]');
        button.onclick = async () => {
            button.disabled = true;
            try { const m = await import('./campfire/campfireService.js'); await m.openCampfire(classId); }
            catch (e) { showToast(e.message || 'Could not open Campfire.', 'error'); }
            finally { button.disabled = false; }
        };
        const later = entry.querySelector('[data-campfire-later]');
        if (later) later.onclick = () => { try { localStorage.setItem(dismissKey(classId), '1'); } catch {} refreshEntries(); showToast('The Campfire will wait until the next lesson. 🌙', 'info'); };
    } else if (!home) {
        entry.insertAdjacentHTML('beforeend', oathsButtonMarkup({ ready: readyCount(classId), variant: oathsOnly ? 'class' : 'log' }));
    }
    const oaths = entry.querySelector('[data-campfire-oaths]');
    if (oaths) oaths.onclick = () => import('../ui/modals/emberOaths.js').then(m => m.openOathBoard(classId)).catch(e => showToast(e.message, 'error'));
    // Older hosts kept the trash can last, so Oaths sits just left of it there.
    const trash = oathsOnly ? host.querySelector(':scope > .delete-class-btn') : null;
    if (existing && existing.className === entry.className && existing.dataset.classId === entry.dataset.classId
        && existing.innerHTML === entry.innerHTML) {
        if (home && host.firstElementChild !== existing) host.prepend(existing);
        return;
    }
    existing?.remove();
    if (trash) host.insertBefore(entry, trash); else if (home) host.prepend(entry); else host.append(entry);
}

/** No header class selected: Ember Oaths stays visible but greyed out, like Log / Hall of Heroes. */
function mountDisabledOathsButton(host) {
    const entry = document.createElement('div');
    entry.className = 'campfire-entry';
    entry.insertAdjacentHTML('beforeend', oathsButtonMarkup({ disabled: true }));
    host.append(entry);
}

function refreshEntries() {
    const classId = state.get('globalSelectedClassId');
    mountCampfireEntry(document.querySelector('.al-primary-actions'), classId);
    const home = document.getElementById('home-reminders-container');
    if (home) mountCampfireEntry(home, classId, { home: true });
}

/** The "N ready" badges need the year's promises; start that one small listener once, off the critical path. */
let watching = false;
function watchOaths() {
    if (watching || state.get('hasLoadedEmberOaths') || state.get('currentUserRole') !== 'teacher') return;
    watching = true;
    setTimeout(() => import('../db/actions/emberOaths.js').then(m => m.ensureEmberOathsListener()).catch(() => {}).finally(() => { watching = false; }), 1500);
}

/** Keep every "N ready" badge true while promises change (check-ins, moments, keeping one). */
function refreshReadyBadges() {
    document.querySelectorAll('.campfire-entry[data-class-id] [data-campfire-oaths]').forEach(button => {
        const ready = readyCount(button.closest('.campfire-entry').dataset.classId);
        let badge = button.querySelector('.campfire-oaths-badge');
        if (!ready) { badge?.remove(); return; }
        if (!badge) { badge = document.createElement('span'); badge.className = 'campfire-oaths-badge'; button.append(badge); }
        badge.textContent = ready + ' ready';
    });
}
state.subscribe(['allEmberOaths', 'allAwardLogs'], refreshReadyBadges);

window.addEventListener('gcq:campfire-updated', async event => {
    const m = await import('./campfire/campfireService.js');
    const classId = event.detail?.classId;
    const status = classId ? m.getCachedCampfire(classId)?.status : null;
    if (status === 'completed') completed.add(classId + '_' + getTodayDateString());
    // "Not today" on the projector rests the card exactly like its ✕ does.
    if (status === 'skipped') { try { localStorage.setItem(dismissKey(classId), '1'); } catch {} }
    refreshEntries();
});
window.addEventListener('gcq:hero-crowned', event => {
    if (!canUseFeature('heroCampfire') || !event.detail?.classId) return;
    igniting.add(event.detail.classId + '_' + getTodayDateString());
    refreshEntries();
    import('./campfire/campfireService.js').then(m => m.igniteCampfire(event.detail)).catch(e => showToast('Campfire preparation: ' + e.message, 'error'));
});
window.addEventListener('gcq:campfire-reset', () => { completed.clear(); igniting.clear(); document.querySelectorAll('.campfire-entry').forEach(e => e.remove()); });
window.addEventListener('gcq:campfire-error', e => showToast(e.detail, 'error'));
document.addEventListener('home:rendered', () => {
    // The badge sits first among the greeting card's reminder badges.
    const host = document.getElementById('home-reminders-container');
    if (host) mountCampfireEntry(host, state.get('globalSelectedClassId'), { home: true });
});
