// Native cursor artwork and state policy, shared by the controller and tests.
const arrow = '<path d="M4 3L5 25l6-6 4 10 5-2-4-9 9-1Z" fill="#e0f2fe"/><path d="M7 8l1 11 3-3 8-1Z" fill="#7dd3fc" stroke="none"/>';
const star = '<path d="m23 3 1.3 3.7L28 8l-3.7 1.3L23 13l-1.3-3.7L18 8l3.7-1.3Z" fill="#fbbf24" stroke="#92400e" stroke-width="1"/>';
const hand = '<path d="M10 16V5a2 2 0 0 1 4 0v9-2a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v5c0 5-3 8-8 8h-3c-3 0-4-2-6-5l-4-6a2.3 2.3 0 0 1 3-3Z" fill="#f0f9ff"/><path d="M13 24h10v3H13Z" fill="#fbbf24" stroke="none"/>';
const openHand = '<path d="M7 18V9a2 2 0 0 1 4 0v7-11a2 2 0 0 1 4 0v11-10a2 2 0 0 1 4 0v10-7a2 2 0 0 1 4 0v11-3a2 2 0 0 1 4 0v5c0 5-3 8-8 8h-4c-4 0-6-3-8-6l-3-4a2 2 0 0 1 3-3Z" fill="#f0f9ff"/><path d="M13 25h10v3H13Z" fill="#fbbf24" stroke="none"/>';
const closedHand = '<path d="M7 15v-3a2 2 0 0 1 4 0v-2a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v3a2 2 0 0 1 4 0v6c0 5-3 8-8 8h-4c-4 0-7-3-8-7l-2-5a2 2 0 0 1 2-2Z" fill="#e0f2fe"/><path d="M13 25h10v3H13Z" fill="#fbbf24" stroke="none"/>';
const hourglass = '<path d="M9 4h14v5c0 4-4 5-6 7 2 2 6 3 6 7v5H9v-5c0-4 4-5 6-7-2-2-6-3-6-7Z" fill="#f0f9ff"/><path d="m11 8 5 6 5-6M11 25l5-6 5 6" fill="#fbbf24" stroke="none"/><path d="M7 4h18M7 28h18" stroke="#92400e" stroke-width="3"/>';
const lens = '<path d="m20 20 9 9" stroke="#fff" stroke-width="6"/><path d="m20 20 9 9" stroke="#164e63" stroke-width="4"/><circle cx="13" cy="13" r="9" fill="#e0f2fe"/><path d="M8 13h10" stroke="#92400e"/>';
const artwork = {
    default: [arrow + star, 4, 3, 'default'],
    pointer: [hand, 12, 4, 'pointer'],
    text: ['<path d="M10 4h12M16 4v24M10 28h12" stroke="#fff" stroke-width="5"/><path d="M10 4h12M16 4v24M10 28h12" stroke="#164e63" stroke-width="2"/><path d="M14 7h4v18h-4Z" fill="#fbbf24" stroke="none"/>', 16, 16, 'text'],
    wait: [hourglass, 16, 16, 'wait'],
    progress: [arrow + '<circle cx="24" cy="24" r="6" fill="#fff"/><path d="M24 20v4l3 2" stroke="#92400e"/>', 4, 3, 'progress'],
    grab: [openHand, 16, 16, 'grab'],
    grabbing: [closedHand, 16, 16, 'grabbing'],
    blocked: ['<circle cx="16" cy="16" r="11" fill="#fff1f2" stroke="#9f1239" stroke-width="3"/><path d="m9 9 14 14" stroke="#9f1239" stroke-width="3"/>', 16, 16, 'not-allowed'],
    help: [arrow + '<circle cx="23" cy="10" r="8" fill="#fef3c7"/><path d="M21 8a2 2 0 1 1 3 2l-1 1m0 3v.1" stroke="#92400e"/>', 4, 3, 'help'],
    crosshair: ['<circle cx="16" cy="16" r="8" fill="#e0f2fe" fill-opacity=".65"/><path d="M16 2v9m0 10v9M2 16h9m10 0h9"/><circle cx="16" cy="16" r="2" fill="#fbbf24" stroke="none"/>', 16, 16, 'crosshair'],
    move: ['<path d="M16 3v26M3 16h26m-17-9 4-4 4 4m-8 18 4 4 4-4M7 12l-4 4 4 4m18-8 4 4-4 4" stroke="#fff" stroke-width="5"/><path d="M16 3v26M3 16h26m-17-9 4-4 4 4m-8 18 4 4 4-4M7 12l-4 4 4 4m18-8 4 4-4 4"/><circle cx="16" cy="16" r="3" fill="#fbbf24"/>', 16, 16, 'move'],
    'zoom-in': [lens + '<path d="M13 8v10" stroke="#92400e"/>', 13, 13, 'zoom-in'],
    'zoom-out': [lens, 13, 13, 'zoom-out']
};

export function getQuestCursorAssets() {
    return Object.fromEntries(Object.entries(artwork).map(([mode, [drawing, x, y, fallback]]) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" id="gcq-quest-cursor" width="32" height="32" viewBox="0 0 32 32"><g stroke="#fff" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${drawing}</g><g stroke="#164e63" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">${drawing}</g></svg>`;
        const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
        return [mode, { url, css: `url("${url}") ${x} ${y}, ${fallback}` }];
    }));
}

export function resolveQuestCursor({ cursor = 'auto', busy = false, disabled = false,
    interactive = false, text = false, native = false } = {}) {
    // Keep application-supplied images, invisible cursors and OS resize/precision tools.
    if (native || (cursor.includes('url(') && !cursor.includes('gcq-quest-cursor'))) return 'native';
    const keyword = cursor.split(',').at(-1).trim();
    if (keyword === 'none') return 'native';
    if (!['auto', 'default', 'not-allowed', 'no-drop'].includes(keyword) && !Object.hasOwn(artwork, keyword)) return 'native';
    if (busy || keyword === 'wait' || keyword === 'progress') return keyword === 'wait' ? 'wait' : 'progress';
    if (disabled || keyword === 'not-allowed' || keyword === 'no-drop') return 'blocked';
    if (keyword === 'auto' || keyword === 'default') {
        if (interactive) return 'pointer';
        if (text) return 'text';
        return 'default';
    }
    return Object.hasOwn(artwork, keyword) ? keyword : 'native';
}
