// The card half of the app-wide tooltips (ui/questTips.js wakes it on the first hover).
// Each part of the app gets its own look, chosen by the nearest ancestor that matches a rule below:
// a calendar tag on the Calendar, a wax-ink ledger slip in the Scholar's Scroll, a hanging banner
// in the Guild Hall, an ember in the Campfire, a wooden sign in the Mystic Market, and so on.
// Styles: styles/quest_tips.css.
import '../styles/quest_tips.css';

/** Class-name prefix (`hd-` matches hd-btn, hd-stage…). */
const pre = (...names) => names.map((n) => `[class^="${n}-"],[class*=" ${n}-"]`).join(',');

// Order matters only when one element matches several rules; the nearest ancestor always wins.
const LOOKS = [
    ['market', '#shop-tab,#shop-purchase-modal,.mm-keeper-float,.mm-ledger'],
    ['satchel', `#trophy-room-modal,${pre('tr')}`],
    ['ember', `#hero-campfire-scene,[class*="campfire"],${pre('cf', 'eo')}`],
    ['dragon', pre('qd')],
    ['quiz', `${pre('qs', 'qow', 'qwk')},#quiz-week-trigger-btn`],
    ['arena', pre('hd', 'qr-sd', 'fw', 'fpk', 'tm', 'sfl', 'bp', 'special-quest')],
    ['raid', pre('rr', 'raid')],
    ['portal', pre('cp', 'ps')],
    ['ceremony', `#ceremony-screen,#grand-guild-ceremony-screen,${pre('cer', 'grd', 'gdn', 'sq')}`],
    ['projector', `#dynamic-wallpaper-screen,.wall-remote,${pre('qw', 'qr-face')}`],
    ['sky', `#award-stars-tab,${pre('aw')}`],
    ['greenhouse', '.gh-overlay,.hc-greenhouse-link'],
    ['guild', `#guilds-tab,#guild-heroes-modal,#sorting-quiz-modal,${pre('gsp', 'guild')}`],
    ['standings', `#class-leaderboard-tab,#student-leaderboard-tab,#global-leaderboard-modal,#prodigy-modal,#teacher-boon-modal,${pre('hcs', 'hl', 'hoh', 'ph', 'tb', 'hb')}`],
    ['map', `#league-archive-modal,#league-picker-modal,${pre('la', 'mj', 'ro', 'tq', 'tqc', 'lp')}`],
    ['scholar', `#scholars-scroll-tab,#scroll-test-desk,#student-analytics-modal,#trial-history-modal,#bulk-trial-modal,${pre('sf', 'ss', 'th', 'ag')}`],
    ['diary', `#adventure-log-tab,#logbook-modal,#hero-chronicle-modal,#note-modal,${pre('hc-entry', 'hc-read', 'hco', 'al', 'diary', 'qc-log')}`],
    ['calendar', `#calendar-tab,#day-planner-modal,#attendance-chronicle-modal,#edit-class-modal,${pre('qc-day', 'qc-lesson', 'qc-daynav', 'qc-ribbon', 'm-cal', 'ac', 'cc', 'wr')},.qc-dayname`],
    ['story', `#reward-ideas-tab,#story-input-modal,#story-reveal-modal,#storybook-viewer-modal,#story-archive-modal,${pre('sw')}`],
    ['passport', `#edit-student-modal,${pre('sp')}`],
    ['office', `#secretary-screen,${pre('office', 'secretary-shell')}`],
    ['family', `#parent-screen,${pre('fp')}`],
    ['classes', `${pre('mc', 'crm')}`],
    ['header', '.gcq-sky-header,.m-header-btn'],
    ['home', `#about-tab,${pre('home', 'greeting', 'gs', 'weather', 'wx', 'schedule-card')}`],
];
const SELECTOR = LOOKS.map(([, s]) => s).join(',');
const LOOK_NAMES = new Set(LOOKS.map(([n]) => n).concat('quest'));
const lookCache = new WeakMap();

function lookFor(el) {
    if (lookCache.has(el)) return lookCache.get(el);
    let look = 'quest';
    const forced = el.closest('[data-gtip-look]')?.dataset.gtipLook;
    if (forced && LOOK_NAMES.has(forced)) look = forced;
    else {
        const host = el.closest(SELECTOR);
        if (host) look = LOOKS.find(([, s]) => host.matches(s))?.[0] || look;
    }
    lookCache.set(el, look);
    return look;
}

const KEY_HINT = /\s*\((Esc|Space|Enter|Tab|[←→↑↓]|[A-Z])\)\s*$/;

/** Splits "Unity Seal: +1 Crown when…" into a heading and a line, and "(Esc)" into a key chip. */
function parts(text) {
    let rest = text;
    let key = '';
    const k = rest.match(KEY_HINT);
    if (k) { key = k[1]; rest = rest.slice(0, k.index).trim(); }
    let head = '';
    let body = rest;
    const m = rest.match(/^(.{2,42}?)(?::\s| — | · )(.{3,})$/s);
    if (m && !/\d$/.test(m[1].trim()) && !/^\d/.test(m[2])) { head = m[1].trim(); body = m[2].trim(); }
    else if (m && rest.length > 48) { head = m[1].trim(); body = m[2].trim(); }
    if (head) body = body.charAt(0).toUpperCase() + body.slice(1);
    return { head, body, key };
}

let tipEl = null;
let tipFor = null;

function ensureTip(host) {
    if (!tipEl) {
        tipEl = document.createElement('div');
        tipEl.id = 'gcq-quest-tip';
        tipEl.className = 'qtip';
        tipEl.setAttribute('role', 'tooltip');
        tipEl.innerHTML = '<span class="qtip__mark" aria-hidden="true"></span><span class="qtip__copy"><b class="qtip__head"></b><span class="qtip__body"></span></span><kbd class="qtip__key"></kbd>';
    }
    // Modal <dialog>s and full-screen scenes sit in the top layer, so the tip has to live inside them.
    if (tipEl.parentNode !== host) host.appendChild(tipEl);
    return tipEl;
}

function hostFor(el) {
    let dialog = el.closest('dialog[open]');
    if (!dialog) {
        try { dialog = el.closest(':popover-open'); } catch { dialog = null; }
    }
    const full = document.fullscreenElement;
    if (dialog) return dialog;
    if (full && full.contains(el)) return full;
    return document.body;
}

function place(tip, target, look) {
    const r = target.getBoundingClientRect();
    const margin = 8;
    const gap = look === 'guild' ? 14 : 11;
    tip.style.left = '0px';
    tip.style.top = '0px';
    // Inside a transformed dialog "fixed" is relative to the dialog: measure where 0,0 lands.
    const offset = tip.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    // Header icons sit at the top of the screen: their tips hang below.
    let below = look === 'header' ? r.bottom + gap + h < vh - margin : r.top - h - gap < margin;
    if (!below && r.top - h - gap < margin) below = true;
    const top = below ? Math.min(r.bottom + gap, vh - h - margin) : r.top - h - gap;
    const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, margin), vw - w - margin);
    tip.classList.toggle('is-below', below);
    tip.style.left = `${Math.round(left - offset.left)}px`;
    tip.style.top = `${Math.round(top - offset.top)}px`;
    tip.style.setProperty('--qtip-x', `${Math.round(Math.min(Math.max(r.left + r.width / 2 - left, 14), w - 14))}px`);
}

export function showQuestTip(target) {
    const text = target?.dataset?.gtip;
    if (!text) return;
    const look = lookFor(target);
    const tip = ensureTip(hostFor(target));
    const { head, body, key } = parts(text);
    tip.className = `qtip qtip--${look}`;
    tip.querySelector('.qtip__head').textContent = head;
    tip.querySelector('.qtip__body').textContent = body;
    tip.querySelector('.qtip__key').textContent = key;
    tip.classList.toggle('has-head', !!head);
    tip.classList.toggle('has-key', !!key);
    tip.classList.toggle('is-long', text.length > 70);
    // Guild banners and Team Maker heroes carry their own colour.
    const ink = target.closest('[style*="--g:"],[style*="--crm-guild"],[style*="--gc:"],[style*="--c:"]');
    const color = ink && (getComputedStyle(ink).getPropertyValue('--g') || getComputedStyle(ink).getPropertyValue('--crm-guild') || getComputedStyle(ink).getPropertyValue('--gc') || getComputedStyle(ink).getPropertyValue('--c'));
    if (color && color.trim()) tip.style.setProperty('--qtip-ink', color.trim());
    else tip.style.removeProperty('--qtip-ink');
    if (tipFor && tipFor !== target) tipFor.removeAttribute('aria-describedby');
    tipFor = target;
    if (!target.hasAttribute('aria-describedby') && target.getAttribute('aria-label') !== text) target.setAttribute('aria-describedby', tip.id);
    tip.classList.remove('is-on');
    place(tip, target, look);
    // Restart the entrance each time so moving along a row of icons feels alive.
    void tip.offsetWidth;
    tip.classList.add('is-on');
}

export function hideQuestTip() {
    if (!tipEl) return;
    tipEl.classList.remove('is-on');
    if (tipFor?.getAttribute('aria-describedby') === tipEl.id) tipFor.removeAttribute('aria-describedby');
    tipFor = null;
}

export function isQuestTipOpen() {
    return !!tipEl?.classList.contains('is-on');
}
