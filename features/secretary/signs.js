// features/secretary/signs.js — each Secretary Office tab title sits on an object
// that IS that tab (see styles/secretary_office.css, "Office signs"):
//   school    the school corkboard, pinned with a class list
//   grades    a report card with its grade band and a red A+
//   messages  a stamped envelope from home
//   admin     the office file folder with its paperclip
import { escapeHtml } from '../roles/shared.js';

const PROPS = {
    school: `
        <span class="office-sign__pin office-sign__pin--l" aria-hidden="true"></span>
        <span class="office-sign__pin office-sign__pin--r" aria-hidden="true"></span>
        <span class="office-sign__polaroid" aria-hidden="true"><i class="fas fa-school"></i></span>`,
    grades: `
        <span class="office-sign__grade" aria-hidden="true">A+</span>
        <span class="office-sign__corner" aria-hidden="true"></span>`,
    messages: `
        <span class="office-sign__flap" aria-hidden="true"></span>
        <span class="office-sign__stamp" aria-hidden="true"><i class="fas fa-heart"></i></span>
        <span class="office-sign__postmark" aria-hidden="true"></span>`,
    admin: `
        <span class="office-sign__clip" aria-hidden="true"></span>
        <span class="office-sign__papers" aria-hidden="true"></span>`
};

export function renderOfficeSign({ variant, kicker, title, tagline = '' }) {
    return `
        <header class="office-sign office-sign--${variant}">
            <div class="office-sign__piece">
                ${variant === 'admin' ? `<span class="office-sign__tab">${escapeHtml(kicker)}</span>` : ''}
                <div class="office-sign__board">
                    ${PROPS[variant] || ''}
                    ${variant === 'admin' ? '' : `<span class="office-sign__kicker">${escapeHtml(kicker)}</span>`}
                    <h2 class="font-title office-sign__title">${escapeHtml(title)}</h2>
                </div>
            </div>
            ${tagline ? `<p class="office-sign__tagline">${tagline}</p>` : ''}
        </header>
    `;
}
