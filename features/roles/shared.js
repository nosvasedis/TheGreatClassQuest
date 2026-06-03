export function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function formatFlexibleDate(value, withTime = false) {
    if (!value) return 'Unknown';
    const options = withTime
        ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short', year: 'numeric' };
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const d = new Date(`${value}T12:00:00`);
        return withTime ? d.toLocaleString('en-GB', options) : d.toLocaleDateString('en-GB', options);
    }
    if (value?.toDate) {
        return value.toDate().toLocaleString('en-GB', options);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? String(value)
        : parsed.toLocaleString('en-GB', options);
}

export function initials(value) {
    return String(value || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || '?';
}

export function setBusyState(button, isBusy, busyLabel) {
    if (!button) return;
    if (!button.dataset.idleHtml) {
        button.dataset.idleHtml = button.innerHTML;
    }
    button.disabled = isBusy;
    button.classList.toggle('opacity-70', isBusy);
    button.classList.toggle('cursor-wait', isBusy);
    button.innerHTML = isBusy
        ? `<i class="fas fa-spinner fa-spin mr-2"></i>${escapeHtml(busyLabel)}`
        : button.dataset.idleHtml;
}

export function renderTabHero({ icon, iconColor = 'text-indigo-500', title, subtitle }) {
    return `
        <div class="role-tab-hero text-center mb-6 card-appear">
            <i class="fas ${icon} ${iconColor} text-5xl floating-icon"></i>
            <h2 class="font-title text-4xl md:text-5xl text-gray-700 mt-2 bottom-nav-tab-title">${title}</h2>
            ${subtitle ? `<p class="text-lg text-gray-600 mt-2 max-w-xl mx-auto">${subtitle}</p>` : ''}
        </div>
    `;
}

export function renderEmptyState(message, { large = false } = {}) {
    return `<div class="role-empty-state${large ? ' role-empty-state--large' : ''}">${message}</div>`;
}

export function renderSubTabBar(tabs, activeKey, dataAttr = 'data-role-subtab') {
    return `
        <div class="options-subtab-bar mb-6">
            ${tabs.map(({ key, label, icon }) => `
                <button type="button"
                    class="options-subtab-btn${activeKey === key ? ' options-subtab-active' : ''}"
                    ${dataAttr}="${escapeHtml(key)}">
                    ${icon ? `<i class="fas ${icon} mr-1.5"></i>` : ''}${label}
                </button>
            `).join('')}
        </div>
    `;
}

export function greetingTime() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
}
