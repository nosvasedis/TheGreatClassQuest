// Update ready badge (styles/nav.css, phone orb in mobile/styles/chrome.css).
// One badge in every shell's header (teacher, School Office, and their phone
// headers): each [data-gcq-update-mount] gets its own copy. A shell injected after
// the badge appeared asks for it with the gcq:update-mounts event.
const UPDATE_PRESS_MS = 720;
const UPDATE_SPARK_COUNT = 8;
let updateBadge = null;

function updateBadgeHTML() {
    const sparks = Array.from({ length: UPDATE_SPARK_COUNT }, (_, i) =>
        `<span class="gcq-ur-spark" style="--a:${Math.round((360 / UPDATE_SPARK_COUNT) * i + 22)}deg;--d:${i % 2 ? 1.7 : 2.25}"></span>`).join('');
    return '<span class="gcq-ur-halo" aria-hidden="true"></span>'
        + '<span class="gcq-ur-glass" aria-hidden="true"><span class="gcq-ur-glint"></span><span class="gcq-ur-flood"></span></span>'
        + '<span class="gcq-ur-ring" aria-hidden="true"></span>'
        + `<span class="gcq-ur-sparks" aria-hidden="true">${sparks}</span>`
        + '<span class="gcq-ur-gem" aria-hidden="true"><i class="fas fa-rotate gcq-update-ready-icon"></i></span>'
        + '<span class="gcq-update-ready-label"><span class="gcq-ur-word">Update ready</span><span class="gcq-ur-word gcq-ur-word--going">Updating…</span></span>'
        + '<span class="gcq-update-ready-sparkle" aria-hidden="true">✦</span>';
}

function pressUpdateBadge() {
    if (!updateBadge || updateBadge.pressed) return;
    updateBadge.pressed = true;
    document.querySelectorAll('.gcq-update-ready-button').forEach((button) => {
        button.disabled = true;
        button.classList.remove('is-arriving');
        button.classList.add('is-pressed');
        button.setAttribute('aria-label', 'Updating the app…');
    });
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Let the burst play before the page goes away.
    window.setTimeout(updateBadge.onPress, reduced ? 0 : UPDATE_PRESS_MS);
}

function mountUpdateBadges() {
    if (!updateBadge) return;
    const mounts = document.querySelectorAll('[data-gcq-update-mount]');
    const targets = mounts.length ? Array.from(mounts) : [document.body];
    targets.forEach((mount) => {
        if (mount.querySelector(':scope > .gcq-update-ready-button')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gcq-update-ready-button font-title is-arriving';
        button.setAttribute('aria-label', 'Update ready. Reload the app.');
        button.title = updateBadge.title;
        button.innerHTML = updateBadgeHTML();
        button.addEventListener('click', pressUpdateBadge);
        button.addEventListener('animationend', (event) => {
            if (event.animationName === 'gcqUpdateArrive') button.classList.remove('is-arriving');
        });
        if (mount === document.body) {
            // Defensive fallback for a future shell without a header mount.
            button.classList.add('gcq-update-ready-button--fallback');
        } else {
            mount.classList.remove('hidden');
            mount.classList.add('has-update');
            // Phones: the badge takes the Game Guide's seat (the guide is still in More).
            mount.closest('.m-header__actions')?.classList.add('m-header__actions--update');
        }
        mount.appendChild(button);
    });
}

export function showUpdateBadge({ title, onPress }) {
    if (updateBadge) return;
    updateBadge = { title, onPress, pressed: false };
    mountUpdateBadges();
}

if (typeof window !== 'undefined') window.addEventListener('gcq:update-mounts', mountUpdateBadges);
