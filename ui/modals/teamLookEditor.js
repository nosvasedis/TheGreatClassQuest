// ui/modals/teamLookEditor.js — rename a team and give it another icon (Team Maker, Hero Duels,
// and the Wand's Showdown / Hero Duels through a command). The look is saved on the class as
// `teamLooks` (one { name, emoji } per banner slot); the banner's colours never change.
// Rules live in features/teamMakerCore.mjs.
import '../../styles/class_tools.css';
import '../../styles/team_look_editor.css';
import { playSound } from '../../audio.js';
import { TEAM_ICONS, TEAM_BANNERS, TEAM_NAME_MAX, teamBanner, setTeamLook, cleanTeamName } from '../../features/teamMakerCore.mjs';
import { esc, readClassField, saveClassField } from './classTools.js';

const ROOT_ID = 'team-look-editor';
/** Fired on window after a class's team looks change, so open screens can redraw. */
export const TEAM_LOOKS_EVENT = 'gcq:team-looks';

/** The class's current team looks (a just-saved change shows at once). */
export function classTeamLooks(classId) {
    return readClassField(classId, 'teamLooks');
}

/**
 * Save one team's name and icon. A name or icon equal to the default is stored as the default,
 * so a later change of the defaults still reaches it. Resolves to the new banner, or null.
 */
export async function applyTeamLook(classId, index, { name = '', emoji = '' } = {}) {
    if (!classId) return null;
    const base = TEAM_BANNERS[((Number(index) || 0) % TEAM_BANNERS.length + TEAM_BANNERS.length) % TEAM_BANNERS.length];
    const clean = cleanTeamName(name);
    const look = {
        name: clean && clean !== base.name && clean !== base.short ? clean : '',
        emoji: emoji && emoji !== base.emoji ? emoji : ''
    };
    const looks = setTeamLook(classTeamLooks(classId), index, look);
    const saving = saveClassField(classId, 'teamLooks', looks);
    window.dispatchEvent(new CustomEvent(TEAM_LOOKS_EVENT, { detail: { classId, index } }));
    const ok = await saving;
    if (!ok) {
        const { showToast } = await import('../effects.js');
        showToast('The team name could not be saved. Please try again.', 'error');
        return null;
    }
    return teamBanner(index, looks);
}

/** The editor card over everything (the projector shows it too). */
export function openTeamLookEditor({ classId, index, onSaved = null } = {}) {
    if (!classId) return;
    document.getElementById(ROOT_ID)?.remove();
    const base = TEAM_BANNERS[((Number(index) || 0) % TEAM_BANNERS.length + TEAM_BANNERS.length) % TEAM_BANNERS.length];
    const now = teamBanner(index, classTeamLooks(classId));
    let emoji = now.emoji;
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'tle';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Name this team');
    root.style.cssText = `--c:${base.primary};--cd:${base.deep};--cs:${base.soft}`;
    root.innerHTML = `
        <div class="tle__card">
            <header class="tle__head">
                <span class="tle__emoji" data-tle-preview-emoji aria-hidden="true">${emoji}</span>
                <span class="tle__title font-title" data-tle-preview-name>${esc(now.name)}</span>
            </header>
            <label class="tle__label" for="tle-name">Team name</label>
            <input id="tle-name" class="tle__input" type="text" maxlength="${TEAM_NAME_MAX}" autocomplete="off" spellcheck="false" value="${esc(now.custom ? now.name : '')}" placeholder="${esc(base.name)}" />
            <p class="tle__label">Icon</p>
            <div class="tle__icons" role="radiogroup" aria-label="Team icon">
                ${TEAM_ICONS.map((ic) => `<button type="button" class="tle__icon${ic === emoji ? ' is-on' : ''}" role="radio" aria-checked="${ic === emoji}" data-tle-icon="${ic}">${ic}</button>`).join('')}
            </div>
            <footer class="tle__foot">
                <button type="button" class="ct-btn ct-btn--ghost" data-tle-reset title="Back to ${esc(base.emoji)} ${esc(base.name)}"><i class="fas fa-rotate-left"></i> Default</button>
                <span class="tle__gap"></span>
                <button type="button" class="ct-btn ct-btn--ghost" data-tle-cancel>Cancel</button>
                <button type="button" class="ct-btn ct-btn--hero" data-tle-save><i class="fas fa-check"></i> Save</button>
            </footer>
        </div>`;
    document.body.append(root);
    const input = root.querySelector('#tle-name');
    const preview = () => {
        root.querySelector('[data-tle-preview-name]').textContent = cleanTeamName(input.value) || base.name;
        root.querySelector('[data-tle-preview-emoji]').textContent = emoji;
        root.querySelectorAll('[data-tle-icon]').forEach((b) => {
            const on = b.dataset.tleIcon === emoji;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-checked', String(on));
        });
    };
    const shut = () => {
        window.removeEventListener('keydown', onKey, true);
        root.classList.add('is-leaving');
        setTimeout(() => root.remove(), 160);
    };
    const save = async () => {
        shut();
        playSound('confirm');
        const banner = await applyTeamLook(classId, index, { name: input.value, emoji });
        if (banner) onSaved?.(banner);
    };
    function onKey(e) {
        // Window capture runs before the games' own keys: Escape closes only this card, and typing
        // never reaches their shortcuts.
        e.stopImmediatePropagation();
        if (e.key === 'Escape') { e.preventDefault(); shut(); }
        else if (e.key === 'Enter' && e.target === input) { e.preventDefault(); save(); }
    }
    window.addEventListener('keydown', onKey, true);
    input.addEventListener('input', preview);
    root.addEventListener('click', (e) => {
        const t = e.target;
        if (t === root || t.closest('[data-tle-cancel]')) return shut();
        const icon = t.closest('[data-tle-icon]');
        if (icon) { emoji = icon.dataset.tleIcon; playSound('click'); preview(); return; }
        if (t.closest('[data-tle-reset]')) { input.value = ''; emoji = base.emoji; preview(); input.focus(); return; }
        if (t.closest('[data-tle-save]')) save();
    });
    requestAnimationFrame(() => { input.focus(); input.select(); });
}
