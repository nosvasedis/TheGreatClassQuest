// The shared "nothing here yet" card for screens without a themed empty state of their own
// (themed screens such as the roster, Hall of Heroes or Scholar's Scroll keep theirs).
// Pure markup, styles in styles/empty_state.css (.gcq-empty).
//
// Wording, so every empty screen speaks the same way:
//   title  what is missing, warm and short ("No heroes here yet")
//   line   the one next step, in plain words ("Add your first student with the form.")
// Never blame the teacher, never show an error code here: errors go to a toast.

import { escapeHtml as esc } from '../utils/html.mjs';

/**
 * @param {object} options
 * @param {string} [options.icon]   Font Awesome name ("fa-users") or a single emoji.
 * @param {string} options.title    Plain text.
 * @param {string} [options.line]   Plain text: the next step.
 * @param {'sm'|'md'|'lg'} [options.size]
 * @returns {string}
 */
export function emptyStateHtml({ icon = 'fa-feather-pointed', title, line = '', size = 'md' } = {}) {
    const art = /^fa-[a-z0-9-]+$/.test(icon)
        ? `<i class="fas ${icon}" aria-hidden="true"></i>`
        : `<span aria-hidden="true">${esc(icon)}</span>`;
    const sizeClass = size === 'sm' || size === 'lg' ? ` gcq-empty--${size}` : '';
    return `<div class="gcq-empty${sizeClass}" role="status">`
        + `<div class="gcq-empty__art">${art}</div>`
        + `<p class="gcq-empty__title">${esc(title)}</p>`
        + (line ? `<p class="gcq-empty__line">${esc(line)}</p>` : '')
        + '</div>';
}
