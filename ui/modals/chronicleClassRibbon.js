// /ui/modals/chronicleClassRibbon.js
// The Hero's Chronicle and the Class Greenhouse in tandem. The Chronicle reads one child; the
// Greenhouse reads the whole class. This module carries the class view into the Chronicle:
// the green ribbon on the cover (the child's growth profile, a tap opens their glowing dot in
// the Greenhouse) and the "In the class" section at the top of the Oracle's reading.
// Everything here is computed on this computer from the Greenhouse records (no AI).

import { classRoleBrief } from '../../features/classGreenhouseCore.mjs';

const ROLE_CACHE_MS = 3 * 60 * 1000;
const roles = new Map(); // studentId → { at, role }

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** Where this child stands in their class (cached for a few minutes; null when unknown). */
export async function classRoleFor(studentId, { waitMs = 4000, fresh = false } = {}) {
    const hit = roles.get(studentId);
    if (!fresh && hit && Date.now() - hit.at < ROLE_CACHE_MS) return hit.role;
    try {
        const { readChildInClass } = await import('./classGreenhouseData.js');
        const role = await readChildInClass(studentId, { waitMs });
        roles.set(studentId, { at: Date.now(), role });
        return role;
    } catch (error) {
        console.warn('Chronicle class view:', error?.message);
        return null;
    }
}

/** The cached role only, for drawing without waiting. */
export function cachedClassRole(studentId) {
    const hit = roles.get(studentId);
    return hit && Date.now() - hit.at < ROLE_CACHE_MS ? hit.role : null;
}

/** The class lines for the Oracle's AI brief (teacher counsels only; never the parent summary). */
export async function classBriefFor(studentId) {
    const role = cachedClassRole(studentId) || await classRoleFor(studentId, { waitMs: 2500 });
    return role ? classRoleBrief(role) : '';
}

export function forgetClassRole(studentId) {
    if (studentId) roles.delete(studentId);
    else roles.clear();
}

// ------------------------------------------------------------------ cover ribbon

/** Fills the cover's ribbon: "Needs tending in the class" with the profile's own colour. */
export function paintCoverRibbon(button, student) {
    if (!button) return;
    button.hidden = !student?.classId;
    if (!student?.classId) return;
    const first = String(student.name || '').trim().split(/\s+/)[0] || 'this hero';
    const label = button.querySelector('[data-ribbon-label]');
    button.dataset.profile = '';
    button.classList.remove('is-ready');
    if (label) label.textContent = `${first} in the class`;
    button.title = `See ${first} among the whole class in the Class Greenhouse`;
    const studentId = student.id;
    const draw = (role) => {
        if (!role || button.closest('#hero-chronicle-modal')?.dataset.studentId !== studentId) return;
        button.dataset.profile = role.profile;
        if (label) label.textContent = `${role.profileLabel} in the class`;
        const plans = role.roles.length ? ` · ${role.roles.length} thing${role.roles.length === 1 ? '' : 's'} planned for next lesson` : '';
        button.title = `${role.meaning}${plans}. Tap to see ${first} among the whole class.`;
        requestAnimationFrame(() => button.classList.add('is-ready'));
    };
    const cached = cachedClassRole(studentId);
    if (cached) draw(cached);
    else classRoleFor(studentId).then(draw);
}

// ------------------------------------------------------------------ the Oracle's "In the class"

const pct = (v) => (v == null ? '' : `${v > 0 ? '+' : ''}${v}`);

/** The "In the class" section at the top of the Oracle reading. */
export function classSectionHtml(role) {
    if (!role) return '';
    const n = role.numbers;
    const facts = [];
    if (n.starsPerLesson != null) {
        const vs = n.classStarsPerLesson != null ? `<small>class ${esc(n.classStarsPerLesson)}</small>` : '';
        facts.push(`<span class="hco-class__fact"><b>${esc(n.starsPerLesson)}</b><span>stars a lesson</span>${vs}</span>`);
    }
    if (n.papersVsClass != null) facts.push(`<span class="hco-class__fact"><b>${esc(pct(n.papersVsClass))}</b><span>points vs class papers</span>${n.papersAvg != null ? `<small>average ${esc(n.papersAvg)}%</small>` : ''}</span>`);
    if (n.attendance != null) facts.push(`<span class="hco-class__fact"><b>${esc(n.attendance)}%</b><span>attendance</span></span>`);
    const plan = role.roles.slice(0, 6).map((r, i) => `
        <li class="hco-class__role" style="--k:${i}">
            <i class="fas ${esc(r.icon)}" aria-hidden="true"></i>
            <span><b>${esc(r.label)}</b>${r.text ? `<small>${esc(r.text)}</small>` : ''}</span>
        </li>`).join('');
    const grouped = new Set(role.roles.filter((r) => r.id === 'group').map((r) => r.label));
    const shared = role.shared.filter((s) => !grouped.has(`${s.label} group`)).slice(0, 4).map((s) => `
        <span class="hco-chip hco-chip--shared"><i class="fas ${esc(s.icon || 'fa-tag')}" aria-hidden="true"></i> ${esc(s.label)} <small>with ${esc(s.others.slice(0, 3).join(', '))}${s.others.length > 3 ? ` +${s.others.length - 3}` : ''}</small></span>`).join('');
    return `
        <section class="hco-class hco-class--${esc(role.profile)}" aria-label="${esc(role.first)} in the class">
            <div class="hco-class__head">
                <span class="hco-class__seed" aria-hidden="true"><i class="fas ${esc(role.profileIcon)}"></i></span>
                <div class="hco-class__title">
                    <p class="hco-class__kicker">In the class · from the Class Greenhouse</p>
                    <p class="hco-class__profile font-title">${esc(role.profileLabel)}</p>
                    <p class="hco-class__meaning">${esc(role.meaning)}</p>
                </div>
                <button type="button" class="hco-class__go" data-class-greenhouse="${esc(role.id)}">
                    <i class="fas fa-seedling" aria-hidden="true"></i> See ${esc(role.first)} among ${esc(role.classSize)}
                </button>
            </div>
            ${facts.length ? `<div class="hco-class__facts">${facts.join('')}</div>` : ''}
            ${plan ? `<p class="hco-class__sub">The class plan for next lesson</p><ul class="hco-class__roles">${plan}</ul>` : `<p class="hco-class__sub">Nothing special planned for ${esc(role.first)} next lesson.</p>`}
            ${shared ? `<p class="hco-class__sub">Shared with classmates</p><div class="hco-chips">${shared}</div>` : ''}
        </section>`;
}
