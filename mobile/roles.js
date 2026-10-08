import { playSound } from '../audio.js';
import { auth, signOut } from '../firebaseAuth.js';
import { walkOutThroughGate } from '../ui/authGate.js';
import { getDeviceCacheChoice, clearLocalAppData } from '../utils/deviceCache.js';

let wired = false;
const observers = [];

function logout() {
    playSound('click');
    void walkOutThroughGate(() => signOut(auth)).then(() => {
        if (getDeviceCacheChoice() === 'shared') clearLocalAppData();
    });
}

function mirrorText(sourceSelector, targetId) {
    const source = document.querySelector(sourceSelector);
    const target = document.getElementById(targetId);
    if (!source || !target) return;
    const sync = () => {
        const text = source.textContent;
        target.textContent = text;
        // Keep soft INNER letter-face (::before) in sync when present.
        if (target.classList.contains('m-header__title')) {
            target.dataset.text = text;
        }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(source, { childList: true, characterData: true, subtree: true });
    observers.push(observer);
}

function wireSecretary() {
    document.getElementById('m-secretary-logout-btn')?.addEventListener('click', logout);
    mirrorText('#secretary-screen [data-secretary-title]', 'm-secretary-title');
    mirrorText('#secretary-screen [data-school-name]', 'm-school-name');
}

function wire() {
    if (wired) return;
    wired = true;
    wireSecretary();
}

export function initRoleMobile() {
    wire();
}

export function disposeRoleMirrors() {
    observers.forEach((observer) => observer.disconnect());
    observers.length = 0;
}
