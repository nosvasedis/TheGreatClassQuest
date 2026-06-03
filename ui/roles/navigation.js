// ui/roles/navigation.js — tab navigation for parent & secretary portals

const ROLE_CONFIG = {
    parent: {
        screenId: 'parent-screen',
        navSelector: '.nav-button[data-parent-tab]',
        panelSelector: '[data-parent-section]',
        tabAttr: 'parentTab',
        sectionAttr: 'parentSection',
        storageKey: 'gcq_parent_last_tab',
        defaultTab: 'home'
    },
    secretary: {
        screenId: 'secretary-screen',
        navSelector: '.nav-button[data-secretary-tab]',
        panelSelector: '[data-secretary-section]',
        tabAttr: 'secretaryTab',
        sectionAttr: 'secretarySection',
        storageKey: 'gcq_secretary_last_tab',
        defaultTab: 'home'
    }
};

const ANIMATION_MS = 350;

function getConfig(role) {
    return ROLE_CONFIG[role] || ROLE_CONFIG.secretary;
}

export function activateRoleTab(role, tabKey, { animate = true, persist = true } = {}) {
    const config = getConfig(role);
    const screen = document.getElementById(config.screenId);
    if (!screen || screen.classList.contains('hidden')) {
        applyRoleTab(role, tabKey, { animate: false, persist });
        return;
    }
    applyRoleTab(role, tabKey, { animate, persist });
}

function applyRoleTab(role, tabKey, { animate = true, persist = true } = {}) {
    const config = getConfig(role);
    const resolvedTab = tabKey || config.defaultTab;

    document.querySelectorAll(config.navSelector).forEach((btn) => {
        const isActive = btn.dataset[config.tabAttr] === resolvedTab;
        btn.classList.toggle('active', isActive);
    });

    const panels = document.querySelectorAll(config.panelSelector);
    const currentPanel = Array.from(panels).find((panel) => !panel.classList.contains('hidden'));
    const nextPanel = Array.from(panels).find((panel) => panel.dataset[config.sectionAttr] === resolvedTab);

    if (!nextPanel) return;
    if (currentPanel && currentPanel === nextPanel) return;

    if (persist) {
        localStorage.setItem(config.storageKey, resolvedTab);
    }

    if (!animate || !currentPanel) {
        panels.forEach((panel) => {
            panel.classList.toggle('hidden', panel.dataset[config.sectionAttr] !== resolvedTab);
            panel.classList.remove('tab-animate-in', 'tab-animate-out');
        });
        return;
    }

    currentPanel.classList.add('tab-animate-out');
    setTimeout(() => {
        currentPanel.classList.add('hidden');
        currentPanel.classList.remove('tab-animate-out');
        nextPanel.classList.remove('hidden');
        nextPanel.classList.add('tab-animate-in');
        setTimeout(() => nextPanel.classList.remove('tab-animate-in'), ANIMATION_MS);
    }, ANIMATION_MS);
}

export function getStoredRoleTab(role) {
    const config = getConfig(role);
    return localStorage.getItem(config.storageKey) || config.defaultTab;
}

export function activateParentTab(tabKey, options) {
    activateRoleTab('parent', tabKey, options);
}

export function activateSecretaryTab(tabKey, options) {
    activateRoleTab('secretary', tabKey, options);
}
