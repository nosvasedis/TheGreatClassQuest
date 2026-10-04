// ui/quietDragonIcon.js — the Quiet Dragon's small head mark for buttons (header and projector remote).
// Kept apart from the full drawing (ui/quietDragonArt.js) so the buttons never load the big art.

export function quietDragonIconSvg(cls = 'qd-icon') {
    return `<svg class="${cls}" viewBox="0 0 32 32" width="1em" height="1em" aria-hidden="true" focusable="false">
        <path d="M17.5 9.5 C 19.5 5 24 2.4 30.5 1.8 C 26.4 3.6 23.8 6 22.4 9.4 Z" fill="currentColor" opacity=".75"/>
        <path d="M2.6 20.2 C 2.4 17.6 4.6 15.8 7.6 15 L 12.6 13.4 C 14.6 10.4 17.8 8.6 21.6 8.6 C 25.6 8.6 28.8 11 29.2 14.6 C 29.6 18.6 26.6 21.8 22.4 22.6 L 12.4 24 C 8 24.6 3 23.6 2.6 20.2 Z" fill="currentColor"/>
        <path d="M22.4 22.6 C 24.6 24.6 25.6 27.4 25 30.4 C 23.2 28 21 26.4 18.4 25.4 Z" fill="currentColor" opacity=".55"/>
        <path d="M15.6 15.4 C 17 14.2 19 14 20.4 15" fill="none" stroke="var(--qd-icon-eye, #1e3a5f)" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M4.8 19.6 C 7.6 20.4 10.6 20.4 13.4 19.6" fill="none" stroke="var(--qd-icon-eye, #1e3a5f)" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>
        <circle cx="6" cy="17" r=".9" fill="var(--qd-icon-eye, #1e3a5f)"/>
    </svg>`;
}
