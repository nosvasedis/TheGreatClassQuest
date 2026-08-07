import { playSound } from '../audio.js';
import { auth, signOut } from '../firebaseAuth.js';
import { getDeviceCacheChoice, clearLocalAppData } from '../utils/deviceCache.js';

let wired = false;
const observers = [];

function logout() {
    playSound('click');
    void signOut(auth).then(() => {
        if (getDeviceCacheChoice() === 'shared') clearLocalAppData();
    });
}

function mirrorText(sourceSelector, targetId) {
    const source = document.querySelector(sourceSelector);
    const target = document.getElementById(targetId);
    if (!source || !target) return;
    target.textContent = source.textContent;
    const observer = new MutationObserver(() => {
        target.textContent = source.textContent;
    });
    observer.observe(source, { childList: true, characterData: true, subtree: true });
    observers.push(observer);
}

function wireParent() {
    document.getElementById('m-parent-refresh-btn')?.addEventListener('click', () => {
        playSound('click');
        Promise.all([
            import('../db/listeners.js'),
            import('../features/parentPortal.js')
        ]).then(([listeners, portal]) => listeners.refreshParentPortalData().then(() => portal.renderParentPortal()));
    });

    document.getElementById('m-parent-logout-btn')?.addEventListener('click', logout);
    mirrorText('#parent-screen [data-parent-title]', 'm-parent-title');
    mirrorText('#parent-screen [data-parent-student-name]', 'm-parent-student-name');
}

function wireSecretary() {
    document.getElementById('m-secretary-open-teacher-app-btn')?.addEventListener('click', () => {
        playSound('click');
        document.getElementById('secretary-screen')?.classList.add('hidden');
        document.getElementById('app-screen')?.classList.remove('hidden');
        import('../ui/tabs.js').then((tabs) => tabs.showTab('about-tab'));
    });

    document.getElementById('m-secretary-logout-btn')?.addEventListener('click', logout);
    mirrorText('#secretary-screen [data-secretary-title]', 'm-secretary-title');
    mirrorText('#secretary-screen [data-school-name]', 'm-school-name');
}

function wire() {
    if (wired) return;
    wired = true;
    wireParent();
    wireSecretary();
}

export function initRoleMobile() {
    wire();
}

export function disposeRoleMirrors() {
    observers.forEach((observer) => observer.disconnect());
    observers.length = 0;
}
