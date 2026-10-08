import * as state from '../state.js';
import { friendlyActionError, looksTechnical } from '../utils/friendlyErrors.js';

// ─── Herald notifications ────────────────────────────────────────────────────
// Every notification in the app is one of these: a gem medallion, a kicker,
// the message, an optional action and a draining timer rune. showToast,
// showPraiseToast and the undo bar are all thin wrappers around notify().

const HERALD_TONES = {
    success: { icon: '<i class="fas fa-check"></i>', kicker: 'Done' },
    error: { icon: '<i class="fas fa-exclamation"></i>', kicker: 'Oops' },
    warning: { icon: '<i class="fas fa-bell"></i>', kicker: 'Heads up' },
    info: { icon: '<i class="fas fa-feather-pointed"></i>', kicker: 'Notice' },
    praise: { icon: '✨', kicker: 'Well done' },
    undo: { icon: '<i class="fas fa-stamp"></i>', kicker: 'Saved' }
};
const HERALD_MAX_VISIBLE = 4;
const HERALD_EXIT_MS = 360;

function heraldTone(type) {
    if (type === 'warn') return 'warning';
    return HERALD_TONES[type] ? type : 'info';
}

function heraldReadingTime(message, duration) {
    const plain = String(message ?? '').replace(/<[^>]*>/g, '');
    return Math.max(Number(duration) || 0, Math.min(9000, 1800 + plain.length * 50));
}

function dismissHerald(el, reason = 'closed') {
    if (!el || el.dataset.state === 'leaving') return;
    el.dataset.state = 'leaving';
    clearTimeout(el.__heraldTimer);
    try { el.__heraldOnDismiss?.(reason); } catch (error) { console.warn('Notification dismiss hook failed:', error); }
    el.style.setProperty('--herald-height', `${el.offsetHeight}px`);
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), HERALD_EXIT_MS);
}

/**
 * Show a notification.
 * @param {object} options
 * @param {string} options.message        Message (HTML allowed; escape user text first).
 * @param {'success'|'error'|'warning'|'info'|'praise'|'undo'} [options.type]
 * @param {string} [options.title]        Kicker label above the message.
 * @param {string} [options.icon]         Emoji or icon HTML for the medallion.
 * @param {number} [options.duration]     Milliseconds before it leaves (0 = stays).
 * @param {string} [options.key]          Replaces any open notification with the same key.
 * @param {{label: string, icon?: string, busyLabel?: string, onClick: Function}} [options.action]
 * @param {Array<{label: string, icon?: string, busyLabel?: string, className?: string, onClick: Function}>} [options.actions]
 *        A row of choices under the message. An onClick that resolves to false keeps the notification open.
 * @param {boolean} [options.sticky]      Stays until a choice or the ×: no timer, never pushed out by newer ones.
 * @param {string} [options.className]   Extra class on the notification (its own tone or look).
 * @param {string} [options.closeLabel]  Screen-reader name of the × (default "Dismiss").
 * @param {Function} [options.onDismiss]  Called once when it leaves, with 'closed' (the ×), 'action', 'replaced' or 'code'.
 * @returns {{ dismiss: Function, element: HTMLElement } | null}
 */
export function notify(options = {}) {
    const container = document.getElementById('toast-container');
    if (!container) return null;

    const tone = heraldTone(options.type);
    const preset = HERALD_TONES[tone];
    const sticky = Boolean(options.sticky);
    const duration = sticky || options.duration === 0 ? 0 : heraldReadingTime(options.message, options.duration ?? 3000);

    if (options.key) {
        container.querySelectorAll('.herald').forEach((el) => {
            if (el.dataset.key === options.key) dismissHerald(el, 'replaced');
        });
    }

    const el = document.createElement('div');
    el.className = `herald herald--${tone}${sticky ? ' herald--sticky' : ''}${options.className ? ` ${options.className}` : ''}`;
    el.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    if (options.key) el.dataset.key = options.key;
    const action = options.action;
    const choices = Array.isArray(options.actions) ? options.actions.filter(Boolean) : [];
    const buttonInner = (a) => `${a.icon ? `<i class="fas ${a.icon}" aria-hidden="true"></i>` : ''}<span>${a.label}</span>`;
    el.innerHTML = `
        <div class="herald__gem" aria-hidden="true"><span class="herald__gem-core">${options.icon || preset.icon}</span></div>
        <div class="herald__body">
            <span class="herald__kicker">${options.title || preset.kicker}</span>
            <span class="herald__message">${options.message ?? ''}</span>
            ${choices.length ? `<span class="herald__actions">${choices.map((a, i) =>
                `<button type="button" class="herald__action${a.className ? ` ${a.className}` : ''}" data-herald-choice="${i}">${buttonInner(a)}</button>`).join('')}</span>` : ''}
        </div>
        ${action ? `<button type="button" class="herald__action">${buttonInner(action)}</button>` : ''}
        <button type="button" class="herald__close" aria-label="${options.closeLabel || 'Dismiss'}"><i class="fas fa-times" aria-hidden="true"></i></button>
        ${duration ? `<span class="herald__timer" style="animation-duration:${duration}ms" aria-hidden="true"></span>` : ''}
    `;
    el.__heraldOnDismiss = typeof options.onDismiss === 'function' ? options.onDismiss : null;

    const closeBtn = el.querySelector('.herald__close');
    closeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (closeBtn.disabled) return;
        dismissHerald(el, 'closed');
    });

    // While an action works, every button waits (the × too), so a choice cannot be taken twice.
    const runAction = async (btn, a) => {
        if (btn.disabled || el.dataset.state === 'leaving') return;
        const buttons = [...el.querySelectorAll('button')];
        const original = btn.innerHTML;
        buttons.forEach((b) => { b.disabled = true; });
        btn.innerHTML = `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>${a.busyLabel || 'Working...'}</span>`;
        el.classList.add('is-busy');
        clearTimeout(el.__heraldTimer);
        el.classList.add('is-paused');
        const restore = () => {
            buttons.forEach((b) => { b.disabled = false; });
            btn.innerHTML = original;
            el.classList.remove('is-busy');
        };
        try {
            const keepOpen = (await a.onClick?.()) === false;
            if (keepOpen) restore();
            else dismissHerald(el, 'action');
        } catch (error) {
            console.error('Notification action failed:', error);
            restore();
            showToast(error?.message || 'That did not work. Please try again.', 'error');
        }
    };

    if (action) {
        const btn = el.querySelector(':scope > .herald__action');
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            runAction(btn, action);
        });
    }
    el.querySelectorAll('[data-herald-choice]').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            runAction(btn, choices[Number(btn.dataset.heraldChoice)]);
        });
    });

    // Timer pauses while the pointer rests on the notification.
    let remaining = duration;
    let startedAt = 0;
    const arm = () => {
        if (!remaining) return;
        startedAt = Date.now();
        el.__heraldTimer = setTimeout(() => dismissHerald(el), remaining);
    };
    el.addEventListener('mouseenter', () => {
        if (!duration || el.dataset.state === 'leaving') return;
        clearTimeout(el.__heraldTimer);
        remaining = Math.max(600, remaining - (Date.now() - startedAt));
        el.classList.add('is-paused');
    });
    el.addEventListener('mouseleave', () => {
        if (!duration || el.dataset.state === 'leaving' || el.querySelector('.herald__action:disabled')) return;
        el.classList.remove('is-paused');
        arm();
    });

    container.appendChild(el);
    // Newer notifications push the oldest out, but never one that is waiting for a choice.
    const live = [...container.querySelectorAll('.herald:not(.is-leaving):not(.herald--sticky)')];
    const room = HERALD_MAX_VISIBLE - container.querySelectorAll('.herald--sticky:not(.is-leaving)').length;
    live.slice(0, Math.max(0, live.length - Math.max(1, room))).forEach((old) => dismissHerald(old, 'replaced'));
    arm();

    return { element: el, dismiss: (reason = 'code') => dismissHerald(el, reason) };
}

export function showToast(message, type = 'info', duration = 3000) {
    // Last safety net: a raw Firebase code never reaches a teacher, parent or secretary.
    if (type === 'error' && looksTechnical(message)) message = friendlyActionError(message);
    return notify({ message, type, duration });
}

export function showPraiseToast(message, icon = '✨') {
    return notify({ message, type: 'praise', icon, duration: 5000 });
}

/** A notification with an Undo button; a newer one with the same key replaces it. */
export function showUndoToast(message, onUndo, { key = 'undo', duration = 9000 } = {}) {
    return notify({
        message,
        type: 'undo',
        key,
        duration,
        action: { label: 'Undo', icon: 'fa-rotate-left', busyLabel: 'Undoing...', onClick: onUndo }
    });
}

export async function showWelcomeBackMessage(firstName, stars) {
    const modal = document.getElementById('welcome-back-modal');
    const messageEl = document.getElementById('welcome-back-message');
    const starsEl = document.getElementById('welcome-back-stars');

    starsEl.textContent = stars;
    modal.classList.remove('hidden');

    messageEl.textContent = `We're so glad you're back, ${firstName}!`;

    setTimeout(() => {
        document.getElementById('welcome-back-modal').classList.add('hidden'); // Simplified hideModal
    }, 4000);
}

export function triggerDynamicPraise(studentName, starCount, reason) {
    const firstName = studentName.split(' ')[0];

    // 1. Get Gender from State (Cached from DB)
    const student = state.get('allStudents').find(s => s.name === studentName) || {};
    const g = student.gender === 'girl' ? 'girl' : 'boy';

    // --- PRE-DEFINED PERSONALIZED DATABASE ---
    const praiseDB = {
        // 1. TEAMWORK (Purple)
        teamwork: {
            color: "text-purple-600",
            1: {
                boy: ["Great helper, ${name}!", "Solid teammate!", "Good assist!"],
                girl: ["Great helper, ${name}!", "Solid teammate!", "Good assist!"]
            },
            2: {
                boy: ["You make the team stronger, ${name}!", "A true brother in arms!", "Excellent cooperation!"],
                girl: ["You make the team stronger, ${name}!", "A true sister in arms!", "Excellent cooperation!"]
            },
            3: {
                boy: ["THE KING OF COOPERATION! The guild salutes you!", "A Legendary Ally!", "The team's MVP!"],
                girl: ["THE QUEEN OF COOPERATION! The guild salutes you!", "A Legendary Ally!", "The team's MVP!"]
            }
        },
        // 2. CREATIVITY (Pink)
        creativity: {
            color: "text-pink-600",
            1: {
                boy: ["Cool idea, ${name}!", "Nice thinking!", "Creative spark!"],
                girl: ["Cool idea, ${name}!", "Nice thinking!", "Creative spark!"]
            },
            2: {
                boy: ["Brilliant imagination, sir!", "What a clever mind!", "Colorful thinking!"],
                girl: ["Brilliant imagination, miss!", "What a clever mind!", "Colorful thinking!"]
            },
            3: {
                boy: ["A VISIONARY GENIUS! Your mind is a galaxy!", "Master Inventor!", "Pure Magic!"],
                girl: ["A VISIONARY GENIUS! Your mind is a galaxy!", "Mistress of Invention!", "Pure Magic!"]
            }
        },
        // 3. RESPECT (Green)
        respect: {
            color: "text-green-600",
            1: {
                boy: ["Very polite, ${name}.", "Respectful choice.", "Kind heart."],
                girl: ["Very polite, ${name}.", "Respectful choice.", "Kind heart."]
            },
            2: {
                boy: ["A true gentleman!", "You earn respect by giving it!", "Honorable behavior!"],
                girl: ["A true lady!", "You earn respect by giving it!", "Honorable behavior!"]
            },
            3: {
                boy: ["A PARAGON OF VIRTUE! A Knight of Honor!", "The heart of a Hero!", "Maximum Respect!"],
                girl: ["A PARAGON OF VIRTUE! A Knight of Honor!", "The heart of a Heroine!", "Maximum Respect!"]
            }
        },
        // 4. FOCUS (Yellow/Amber)
        focus: {
            color: "text-amber-600",
            1: {
                boy: ["Sharp eyes, ${name}!", "Good focus.", "On target."],
                girl: ["Sharp eyes, ${name}!", "Good focus.", "On target."]
            },
            2: {
                boy: ["Laser concentration!", "Nothing gets past him!", "Locked in!"],
                girl: ["Laser concentration!", "Nothing gets past her!", "Locked in!"]
            },
            3: {
                boy: ["UNBREAKABLE WILL! Nothing distracts him!", "The Eye of the Tiger!", "Hyper-Focus Achieved!"],
                girl: ["UNBREAKABLE WILL! Nothing distracts her!", "The Eye of the Tiger!", "Hyper-Focus Achieved!"]
            }
        },
        // 5. GENERIC / OTHER (Blue)
        default: {
            color: "text-blue-600",
            1: {
                boy: ["Well done, ${name}!", "Good job!", "Nice work!"],
                girl: ["Well done, ${name}!", "Good job!", "Nice work!"]
            },
            2: {
                boy: ["Awesome effort, ${name}!", "He's leveling up!", "Way to go!"],
                girl: ["Awesome effort, ${name}!", "She's leveling up!", "Way to go!"]
            },
            3: {
                boy: ["SPECTACULAR! He is on fire today!", "Quest Crushed!", "A Legend is born!"],
                girl: ["SPECTACULAR! She is on fire today!", "Quest Crushed!", "A Legend is born!"]
            }
        }
    };

    // Select category and star level
    const category = praiseDB[reason] || praiseDB['default'];
    const countKey = Math.min(starCount, 3);

    // Select gender-specific array
    const messages = category[countKey][g];

    // Pick random message
    const rawMessage = messages[Math.floor(Math.random() * messages.length)];
    const message = rawMessage.replace("${name}", firstName);

    // Determine Icon
    let icon = '✨';
    if (starCount === 2) icon = '🌟';
    if (starCount >= 3) icon = '🏆';

    // Stylize
    const styledMessage = `<span class="${category.color} font-bold">${message}</span>`;

    // Trigger
    showPraiseToast(styledMessage, icon);
}

export function createFloatingHearts(x, y) {
    const numHearts = 8 + Math.floor(Math.random() * 5); // 8 to 12 hearts

    for (let i = 0; i < numHearts; i++) {
        const heart = document.createElement('i');
        heart.className = 'fas fa-heart absolute text-rose-500 z-[100] pointer-events-none drop-shadow-md';

        const size = 16 + Math.random() * 24; // 16px to 40px
        heart.style.fontSize = `${size}px`;
        heart.style.left = `${x}px`;
        heart.style.top = `${y}px`;

        const tx = (Math.random() - 0.5) * 150; // -75px to 75px horizontal
        const ty = -100 - Math.random() * 150; // -100px to -250px vertical
        const rot = (Math.random() - 0.5) * 90; // Rotation
        const duration = 1 + Math.random() * 1.5; // 1s to 2.5s

        heart.style.setProperty('--tx', `${tx}px`);
        heart.style.setProperty('--ty', `${ty}px`);
        heart.style.setProperty('--rot', `${rot}deg`);

        heart.style.animation = `float-up-heart ${duration}s ease-out forwards`;

        document.body.appendChild(heart);

        heart.addEventListener('animationend', () => heart.remove());
    }
}
