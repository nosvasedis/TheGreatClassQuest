// /features/dayTreasure.js
// Day Treasures (features/dayTreasureCore.mjs): opening a special day's chest for a class.
// The payout runs once per class, in one transaction: every hero's Gold and a receipt on the
// class (`dayTreasures.<eventId>`). Opening it again only replays the reveal from the receipt.
// The reveal is made for the projector. Which days and classes: features/dayTreasureDays.js.

import '../styles/day_treasure.css';
import * as state from '../state.js';
import { db, doc, runTransaction, serverTimestamp } from '../firebase.js';
import { getLiveYearGold, getLiveYearGoldContextFromState } from '../utils/yearGold.js';
import { PUBLIC_DATA_PATH as DATA } from '../utils/tenant.mjs';
import { rollDayTreasure, tierLabel } from './dayTreasureCore.mjs';
import { dmyToIso, activeTreasures, eventWindow, eligibleClassesFor, bestClassFor, shortDay } from './dayTreasureDays.js';
import { dayLook } from '../ui/daySceneHeader.js';
import { describeSchoolDay } from '../utils/schoolCalendar.mjs';
import * as utils from '../utils.js';
import { showToast } from '../ui/effects.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export { windowForSpecial, eventWindow, treasureClassesOn, treasureForSpecial, treasureDayNear, treasuresOn, isTreasureOpened, lessonClassIdsOn, eligibleClassesFor, shortDay } from './dayTreasureDays.js';

function studentsOf(classId) {
    return (state.get('allStudents') || []).filter((s) => s.classId === classId && s.enrollmentStatus !== 'inactive');
}

/** Pay the chest once for a class; returns the receipt (new or already there). */
async function payTreasure(event, classId) {
    const classRef = doc(db, `${DATA}/classes`, classId);
    const eventRef = doc(db, `${DATA}/quest_events`, event.id);
    const students = studentsOf(classId);
    const goldContext = getLiveYearGoldContextFromState(state);
    return runTransaction(db, async (transaction) => {
        const classSnap = await transaction.get(classRef);
        if (!classSnap.exists()) throw new Error('The class could not be found.');
        const existing = classSnap.data()?.dayTreasures?.[event.id];
        if (existing) return { ...existing, replay: true };
        const reads = await Promise.all(students.map(async (s) => {
            const ref = doc(db, `${DATA}/student_scores`, s.id);
            return { id: s.id, ref, snap: await transaction.get(ref) };
        }));
        const present = reads.filter((r) => r.snap.exists());
        const shares = rollDayTreasure(present.map((r) => r.id), `${event.id}:${classId}:${Date.now()}`);
        const byId = new Map(shares.map((s) => [s.studentId, s]));
        present.forEach((r) => {
            const share = byId.get(r.id);
            if (share) transaction.update(r.ref, { gold: getLiveYearGold(r.snap.data(), goldContext) + share.gold });
        });
        const receipt = {
            dateKey: event.dateKey || event.date,
            openedOn: utils.getTodayDateString(),
            name: event.details?.title || 'Day Treasure',
            dayKey: event.details?.dayKey || '',
            shares,
            total: shares.reduce((sum, s) => sum + s.gold, 0),
            openedBy: { uid: state.get('currentUserId') || '', name: state.get('currentTeacherName') || '' },
        };
        transaction.update(classRef, { [`dayTreasures.${event.id}`]: { ...receipt, openedAt: serverTimestamp() } });
        // A class's own (older) treasure event is done once opened; a school-wide one stays for the other classes.
        if (event.classId === classId) transaction.update(eventRef, { status: 'completed', updatedAt: serverTimestamp() });
        return receipt;
    });
}

/**
 * Open (or replay) a treasure for one of your classes: the class asked for, else the selected
 * class, the class in session, or the first one still waiting.
 */
export async function openDayTreasure(eventId, classId = '') {
    const event = activeTreasures().find((e) => e.id === eventId) || (state.get('allQuestEvents') || []).find((e) => e.id === eventId);
    if (!event) return;
    const classes = eligibleClassesFor(event);
    const cls = classes.find((c) => c.id === classId) || bestClassFor(classes, event);
    if (!cls) {
        const days = eventWindow(event).map(shortDay);
        showToast(`None of your classes has a lesson on the treasure day${days.length > 1 ? 's' : ''}${days.length ? ` (${days.join(', ')})` : ''}.`, 'info');
        return;
    }
    const iso = dmyToIso(event.dateKey || event.date);
    const special = describeSchoolDay(iso).headline || { name: event.details?.dayName || 'Special day', icon: event.details?.icon || '🎁', theme: 'observance' };
    const receipt = cls.dayTreasures?.[event.id] || null;
    showTreasureStage({ event, cls, special, receipt, classes });
}

// ─── The reveal ─────────────────────────────────────────────────────────────

let audio = null;
function chime(kind = 'coin') {
    try {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        const now = audio.currentTime;
        const notes = kind === 'open' ? [523, 659, 784, 1047] : kind === 'hoard' ? [784, 988, 1175, 1568, 1976] : [1319, 1760];
        notes.forEach((freq, i) => {
            const osc = audio.createOscillator();
            const gain = audio.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const t = now + i * (kind === 'coin' ? 0.05 : 0.09);
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(kind === 'coin' ? 0.05 : 0.08, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
            osc.connect(gain).connect(audio.destination);
            osc.start(t);
            osc.stop(t + 0.4);
        });
    } catch { /* sound is a bonus */ }
}

function heroFace(student) {
    if (student?.avatar) return `<img src="${esc(student.avatar)}" alt="" loading="lazy" decoding="async">`;
    return `<span>${esc(String(student?.name || '?').trim().charAt(0).toUpperCase())}</span>`;
}

function coinsHtml(count = 18) {
    return Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360 + (i % 3) * 7;
        const dist = 7 + (i % 4) * 2.2;
        return `<i class="dt-coin" style="--a:${angle}deg;--r:${dist}rem;--d:${(i % 6) * 0.04}s"></i>`;
    }).join('');
}

function showTreasureStage({ event, cls, special, receipt, classes = [] }) {
    document.getElementById('day-treasure-stage')?.remove();
    const look = dayLook(special);
    const name = event.details?.title || 'Day Treasure';
    const stage = document.createElement('div');
    stage.id = 'day-treasure-stage';
    stage.className = 'dt-stage';
    stage.setAttribute('role', 'dialog');
    stage.setAttribute('aria-modal', 'true');
    stage.setAttribute('aria-label', name);
    stage.style.cssText = `--day-a:${look.a};--day-b:${look.b};--day-ink:${look.ink}`;
    stage.innerHTML = `
        <div class="dt-stage__sky" aria-hidden="true">
            ${look.particles.concat(look.particles).map((p, i) => `<span class="dt-float" style="--x:${(i * 13 + 7) % 96}%;--d:${(i * 0.7) % 5}s;--t:${7 + (i % 4)}s">${esc(p)}</span>`).join('')}
        </div>
        <button type="button" class="dt-stage__close" data-dt-close aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
        <div class="dt-stage__inner">
            <p class="dt-stage__eyebrow">${esc(special.icon)} ${esc(special.name)}${classes.length > 1 ? '' : ` · ${esc(cls.logo || '🏫')} ${esc(cls.name || 'Class')}`}</p>
            ${classes.length > 1 ? `<div class="dt-classes" role="group" aria-label="Which class opens it">${classes.map((c) => {
                const done = Boolean(c.dayTreasures?.[event.id]);
                return `<button type="button" class="dt-class${c.id === cls.id ? ' is-on' : ''}${done ? ' is-done' : ''}" data-dt-class="${esc(c.id)}" aria-pressed="${c.id === cls.id}">
                    <span aria-hidden="true">${esc(c.logo || '🏫')}</span>${esc(c.name || 'Class')}${done ? '<i aria-label="opened">🪙</i>' : ''}</button>`;
            }).join('')}</div>` : ''}
            <h2 class="dt-stage__title font-title">${esc(name)}</h2>
            <div class="dt-chest" data-dt-open role="button" tabindex="0" aria-label="${receipt ? 'Show the treasure again' : 'Open the treasure'}">
                <span class="dt-chest__glow" aria-hidden="true"></span>
                <span class="dt-chest__burst" aria-hidden="true">${coinsHtml()}</span>
                <span class="dt-chest__lid" aria-hidden="true"><span class="dt-chest__lock">${esc(special.icon)}</span></span>
                <span class="dt-chest__box" aria-hidden="true"><span class="dt-chest__band"></span></span>
            </div>
            <p class="dt-stage__hint">${receipt ? 'Already opened. Tap the chest to see who found what.' : 'Every hero finds Gold. Who will find the Hoard? Tap the chest!'}</p>
            <ol class="dt-heroes" aria-live="polite"></ol>
            <p class="dt-total" hidden></p>
        </div>`;
    document.body.appendChild(stage);
    requestAnimationFrame(() => stage.classList.add('is-in'));

    const close = () => {
        stage.classList.remove('is-in');
        setTimeout(() => stage.remove(), 250);
        document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    stage.addEventListener('click', (e) => {
        if (e.target.closest('[data-dt-close]') || e.target === stage) close();
        const pick = e.target.closest('[data-dt-class]');
        if (pick && pick.dataset.dtClass !== cls.id && !busy) {
            document.removeEventListener('keydown', onKey);
            openDayTreasure(event.id, pick.dataset.dtClass);
        }
    });

    const chest = stage.querySelector('[data-dt-open]');
    let busy = false;
    const open = async () => {
        if (busy || stage.classList.contains('is-open')) return;
        busy = true;
        chest.classList.add('is-shaking');
        try {
            const [result] = await Promise.all([receipt ? Promise.resolve(receipt) : payTreasure(event, cls.id), new Promise((r) => setTimeout(r, 900))]);
            chest.classList.remove('is-shaking');
            stage.classList.add('is-open');
            chime('open');
            revealHeroes(stage, result, cls);
        } catch (error) {
            console.error('Day Treasure:', error);
            chest.classList.remove('is-shaking');
            stage.querySelector('.dt-stage__hint').textContent = 'The chest is stuck. Check the connection and try again.';
        } finally {
            busy = false;
        }
    };
    chest.addEventListener('click', open);
    chest.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    chest.focus({ preventScroll: true });
}

function revealHeroes(stage, result, cls) {
    const students = new Map((state.get('allStudents') || []).map((s) => [s.id, s]));
    const list = stage.querySelector('.dt-heroes');
    const shares = [...(result.shares || [])].sort((a, b) => a.gold - b.gold);
    list.innerHTML = shares.map((s, i) => {
        const student = students.get(s.studentId);
        return `
            <li class="dt-hero dt-hero--${esc(s.tier)}" style="--i:${i}">
                <span class="dt-hero__face">${heroFace(student)}</span>
                <span class="dt-hero__name">${esc(student?.name || 'A hero')}</span>
                <span class="dt-hero__gold"><i class="dt-hero__coin" aria-hidden="true"></i>+${s.gold}</span>
                <span class="dt-hero__tier">${esc(tierLabel(s.tier))}</span>
            </li>`;
    }).join('');
    const step = Math.max(90, Math.min(260, 3200 / Math.max(1, shares.length)));
    shares.forEach((s, i) => {
        setTimeout(() => {
            const item = list.children[i];
            if (!item) return;
            item.classList.add('is-shown');
            chime(s.tier === 'hoard' ? 'hoard' : 'coin');
        }, 500 + i * step);
    });
    setTimeout(() => {
        const total = stage.querySelector('.dt-total');
        total.hidden = false;
        total.innerHTML = `<i class="dt-hero__coin" aria-hidden="true"></i> ${result.total} Gold for ${esc(cls.name || 'the class')}${result.replay ? ' · opened before' : ''}`;
        stage.querySelector('.dt-stage__hint').textContent = 'The Gold is in every hero\'s purse. Spend it well in the Mystic Market!';
    }, 700 + shares.length * step);
}
