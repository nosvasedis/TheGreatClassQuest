// /features/dayTreasure.js
// Day Treasures (features/dayTreasureCore.mjs): opening a special day's chest for a class.
// The payout runs once per class: a receipt on the class (`dayTreasures.<eventId>`), then every
// hero's Gold in small transactions (see payTreasure). Opening it again only replays the reveal
// from the receipt, or finishes a payout that was cut short.
// Which days and classes: features/dayTreasureDays.js. The chests: dayTreasureArt.js. The music:
// dayTreasureSound.js.
//
// The reveal never waits for the database: the shares are rolled here with the same seed the
// transaction uses, so the chest opens at once while the Gold is saved in the background. The
// closing ribbon waits for the save (and offers a retry if it fails).

import { quietly } from '../utils/runtimeMetrics.js';
import { escapeHtml as esc } from '../utils/html.mjs';
import '../styles/day_treasure.css';
import * as state from '../state.js';
import { db, doc, runTransaction, serverTimestamp, updateDoc, arrayUnion, deleteField } from '../firebase.js';
import { getLiveYearGold, getLiveYearGoldContextFromState } from '../utils/yearGold.js';
import { PUBLIC_DATA_PATH as DATA } from '../utils/tenant.mjs';
import { rollDayTreasure, tierLabel } from './dayTreasureCore.mjs';
import { dmyToIso, isSchoolTreasure, activeTreasures, activeClassTreasure } from './dayTreasureDays.js';
import { chestFamilyFor, chestSvg, FAMILY_FX } from './dayTreasureArt.js';
import { createTreasureMusic } from './dayTreasureSound.js';
import { dayLook } from '../ui/daySceneHeader.js';
import { describeSchoolDay } from '../utils/schoolCalendar.mjs';
import * as utils from '../utils.js';
import { showToast } from '../ui/effects.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const calm = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export { windowForSpecial, eventWindow, treasureClassesOn, treasureForSpecial, treasureDayNear, treasuresOn, isTreasureOpened, lessonClassIdsOn, eligibleClassesFor, activeClassTreasure, shortDay } from './dayTreasureDays.js';

function studentsOf(classId) {
    return (state.get('allStudents') || []).filter((s) => s.classId === classId && s.enrollmentStatus !== 'inactive');
}

// Firestore rules may look up at most 20 documents per commit, and each hero's Gold costs about
// two (its score and its student), so a whole class in one transaction is refused from about 9
// heroes. The payout is therefore a claim (the receipt, marked `pending`) and then small
// transactions of a few heroes each, every one adding its heroes to the receipt's `paidIds` so a
// retry, or another laptop, carries on where it stopped and never pays a hero twice.
const HEROES_PER_COMMIT = 6;

/** Pay the chest once for a class with the shares rolled from `seed`; returns the receipt (new or already there). */
async function payTreasure(event, classId, seed) {
    const classRef = doc(db, `${DATA}/classes`, classId);
    const eventRef = doc(db, `${DATA}/quest_events`, event.id);
    const field = `dayTreasures.${event.id}`;
    const goldContext = getLiveYearGoldContextFromState(state);

    const claimed = await runTransaction(db, async (transaction) => {
        const classSnap = await transaction.get(classRef);
        if (!classSnap.exists()) throw new Error('The class could not be found.');
        const existing = classSnap.data()?.dayTreasures?.[event.id];
        if (existing) return existing.pending ? existing : { ...existing, replay: true };
        const shares = rollDayTreasure(studentsOf(classId).map((s) => s.id), seed);
        const receipt = {
            dateKey: event.dateKey || event.date,
            openedOn: utils.getTodayDateString(),
            name: event.details?.title || 'Day Treasure',
            dayKey: event.details?.dayKey || '',
            shares,
            total: shares.reduce((sum, s) => sum + s.gold, 0),
            openedBy: { uid: state.get('currentUserId') || '', name: state.get('currentTeacherName') || '' },
            pending: true,
            paidIds: [],
        };
        transaction.update(classRef, { [field]: { ...receipt, openedAt: serverTimestamp() } });
        return receipt;
    });
    if (claimed.replay) return claimed;

    const shares = claimed.shares || [];
    const already = new Set(claimed.paidIds || []);
    const todo = shares.filter((s) => !already.has(s.studentId));
    for (let i = 0; i < todo.length; i += HEROES_PER_COMMIT) {
        const chunk = todo.slice(i, i + HEROES_PER_COMMIT);
        await runTransaction(db, async (transaction) => {
            const classSnap = await transaction.get(classRef);
            const paid = new Set(classSnap.data()?.dayTreasures?.[event.id]?.paidIds || []);
            const fresh = chunk.filter((s) => !paid.has(s.studentId));
            if (!fresh.length) return;
            const reads = await Promise.all(fresh.map(async (share) => {
                const ref = doc(db, `${DATA}/student_scores`, share.studentId);
                return { share, ref, snap: await transaction.get(ref) };
            }));
            // A hero with no score yet is skipped (marked paid so it is not tried forever).
            reads.forEach(({ share, ref, snap }) => {
                if (snap.exists()) transaction.update(ref, { gold: getLiveYearGold(snap.data(), goldContext) + share.gold });
            });
            transaction.update(classRef, { [`${field}.paidIds`]: arrayUnion(...fresh.map((s) => s.studentId)) });
        });
    }

    await updateDoc(classRef, { [`${field}.pending`]: deleteField(), [`${field}.paidIds`]: deleteField() });
    // A class's own (older) treasure event is done once opened; a school-wide one stays for the other classes.
    if (!isSchoolTreasure(event) && event.classId === classId) {
        await updateDoc(eventRef, { status: 'completed', updatedAt: serverTimestamp() }).catch((e) => console.warn('Day Treasure event status:', e));
    }
    const { pending, paidIds, ...receipt } = claimed;
    return receipt;
}

/** Open (or replay) the active class's treasure. Other classes open theirs in their own lesson. */
export async function openDayTreasure(eventId, classId = '') {
    const active = activeClassTreasure();
    if (!active || active.id !== eventId || (classId && active.classId !== classId)) {
        showToast('Each class opens its treasure in its own lesson: select the class during the lesson.', 'info');
        return;
    }
    const event = activeTreasures().find((e) => e.id === eventId);
    const cls = (state.get('allSchoolClasses') || []).find((c) => c.id === active.classId);
    if (!event || !cls) return;
    const iso = dmyToIso(event.dateKey || event.date);
    const special = describeSchoolDay(iso).headline || { name: event.details?.dayName || 'Special day', icon: event.details?.icon || '🎁', theme: 'observance' };
    showTreasureStage({ event, cls, special, receipt: cls.dayTreasures?.[event.id] || null });
}

// ─── The reveal ─────────────────────────────────────────────────────────────

function heroFace(student) {
    if (student?.avatar) return `<img src="${esc(student.avatar)}" alt="" decoding="async">`;
    return `<span>${esc(String(student?.name || '?').trim().charAt(0).toUpperCase())}</span>`;
}

/** Short-lived bits (coins, sparks, confetti) added to a layer and cleared after they fall. */
function spray(layer, count, make, life = 2400) {
    if (calm() || !layer) return;
    const frag = document.createDocumentFragment();
    const bits = [];
    for (let i = 0; i < count; i += 1) {
        const bit = make(i);
        bits.push(bit);
        frag.appendChild(bit);
    }
    layer.appendChild(frag);
    setTimeout(() => bits.forEach((b) => b.remove()), life);
}

function piece(className, style, text = '') {
    const el = document.createElement('i');
    el.className = className;
    el.setAttribute('style', style);
    if (text) el.textContent = text;
    return el;
}

function coinFountain(layer, count = 26, power = 1) {
    spray(layer, count, (i) => {
        const angle = -90 + (Math.random() * 120 - 60);
        const dist = (9 + Math.random() * 9) * power;
        const x = Math.cos((angle * Math.PI) / 180) * dist;
        const y = Math.sin((angle * Math.PI) / 180) * dist;
        return piece('dt-coin', `--x:${x.toFixed(1)}rem;--y:${y.toFixed(1)}rem;--fall:${(14 + Math.random() * 8).toFixed(1)}rem;--r:${Math.round(Math.random() * 720 - 360)}deg;--d:${(i % 8) * 0.03}s;--s:${(0.8 + Math.random() * 0.6).toFixed(2)}`);
    }, 2200);
}

function themedBurst(layer, emojis, count = 14) {
    spray(layer, count, (i) => {
        const angle = (i / count) * 360 + Math.random() * 20;
        const dist = 10 + Math.random() * 10;
        return piece('dt-fx', `--x:${(Math.cos((angle * Math.PI) / 180) * dist).toFixed(1)}rem;--y:${(Math.sin((angle * Math.PI) / 180) * dist * 0.75).toFixed(1)}rem;--r:${Math.round(Math.random() * 90 - 45)}deg;--d:${(i % 5) * 0.04}s`, emojis[i % emojis.length]);
    }, 2400);
}

function confetti(layer, colors, count = 46) {
    spray(layer, count, (i) => piece('dt-confetti', `--x:${(Math.random() * 100).toFixed(1)}vw;--drift:${(Math.random() * 16 - 8).toFixed(1)}vw;--r:${Math.round(Math.random() * 900)}deg;--t:${(2.2 + Math.random() * 1.6).toFixed(2)}s;--d:${(Math.random() * 0.5).toFixed(2)}s;background:${colors[i % colors.length]};`), 4400);
}

function coinRain(layer, count = 34) {
    spray(layer, count, () => piece('dt-rain', `--x:${(Math.random() * 100).toFixed(1)}vw;--t:${(1.3 + Math.random() * 1.1).toFixed(2)}s;--d:${(Math.random() * 0.9).toFixed(2)}s;--s:${(0.7 + Math.random() * 0.8).toFixed(2)}`), 3400);
}

function countUp(el, to, ms = 700) {
    if (!el) return;
    if (calm()) { el.textContent = String(to); return; }
    const start = performance.now();
    const step = (now) => {
        const p = Math.min(1, (now - start) / ms);
        el.textContent = String(Math.round(to * (1 - (1 - p) ** 3)));
        if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

function showTreasureStage({ event, cls, special, receipt }) {
    document.getElementById('day-treasure-stage')?.remove();
    const look = dayLook(special);
    const family = chestFamilyFor(special);
    const fx = FAMILY_FX[family] || FAMILY_FX.royal;
    const music = createTreasureMusic(family);
    const name = event.details?.title || 'Day Treasure';
    const confettiColors = [look.a, look.b, look.ink, '#fbbf24', '#fde68a', fx.beam];

    const stage = document.createElement('div');
    stage.id = 'day-treasure-stage';
    stage.className = `dt-stage dt-stage--${family}`;
    stage.setAttribute('role', 'dialog');
    stage.setAttribute('aria-modal', 'true');
    stage.setAttribute('aria-label', name);
    stage.style.cssText = `--day-a:${look.a};--day-b:${look.b};--day-ink:${look.ink};--beam:${fx.beam}`;
    const floaters = look.particles.concat(fx.burst).slice(0, 9);
    stage.innerHTML = `
        <div class="dt-stage__sky" aria-hidden="true">
            <span class="dt-rays"></span>
            ${floaters.map((p, i) => `<span class="dt-float" style="--x:${(i * 11 + 5) % 94}%;--d:${(i * 0.8) % 6}s;--t:${8 + (i % 4) * 1.5}s">${esc(p)}</span>`).join('')}
        </div>
        <div class="dt-stage__fx" aria-hidden="true"></div>
        <button type="button" class="dt-stage__close" data-dt-close aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>
        <div class="dt-stage__inner">
            <p class="dt-stage__eyebrow">${esc(special.icon)} ${esc(special.name)} · ${esc(cls.logo || '🏫')} ${esc(cls.name || 'Class')}</p>
            <h2 class="dt-stage__title font-title">${esc(name)}</h2>
            <div class="dt-chest" data-dt-open role="button" tabindex="0" aria-label="${receipt ? 'Show the treasure again' : `Open the ${esc(fx.label.toLowerCase())}`}">
                <span class="dt-chest__halo" aria-hidden="true"></span>
                <span class="dt-chest__beam" aria-hidden="true"></span>
                <span class="dt-chest__art">${chestSvg(family, esc(special.icon))}</span>
                <span class="dt-chest__shadow" aria-hidden="true"></span>
                <span class="dt-chest__burst" aria-hidden="true"></span>
            </div>
            <p class="dt-stage__hint">${receipt ? 'Opened before. Tap to see who found what.' : 'Every hero finds Gold. Who will find the Hoard? Tap the chest!'}</p>
            <div class="dt-hoard-banner" aria-hidden="true"><span>The Hoard!</span></div>
            <ol class="dt-heroes" aria-live="polite"></ol>
            <p class="dt-total" hidden></p>
        </div>`;
    document.body.appendChild(stage);
    requestAnimationFrame(() => stage.classList.add('is-in'));

    const fxLayer = stage.querySelector('.dt-stage__fx');
    const burstLayer = stage.querySelector('.dt-chest__burst');
    const chest = stage.querySelector('[data-dt-open]');
    const hint = stage.querySelector('.dt-stage__hint');
    let closed = false;
    let busy = false;

    const close = () => {
        closed = true;
        stage.classList.remove('is-in');
        setTimeout(() => { stage.remove(); music.close(); }, 300);
        document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    stage.addEventListener('click', (e) => {
        if (e.target.closest('[data-dt-close]') || e.target === stage) close();
    });

    const open = async () => {
        if (busy || stage.classList.contains('is-open')) return;
        busy = true;
        // Roll now with the transaction's seed: the reveal shows the very shares being saved.
        const seed = `${event.id}:${cls.id}:${Date.now()}`;
        const preview = receipt || { shares: rollDayTreasure(studentsOf(cls.id).map((s) => s.id), seed) };
        const saving = receipt && !receipt.pending ? Promise.resolve(receipt) : payTreasure(event, cls.id, seed);
        saving.catch(quietly('features/dayTreasure.js'));

        hint.textContent = ' ';
        chest.classList.add('is-shaking');
        stage.classList.add('is-charging');
        music.roll(1.15);
        await wait(calm() ? 0 : 1150);
        if (closed) return;
        chest.classList.remove('is-shaking');
        stage.classList.remove('is-charging');
        stage.classList.add('is-open', 'is-flash');
        music.open();
        coinFountain(burstLayer, 28);
        themedBurst(burstLayer, fx.burst, 14);
        confetti(fxLayer, confettiColors);
        setTimeout(() => stage.classList.remove('is-flash'), 280);
        await wait(calm() ? 0 : 900);
        if (closed) return;
        stage.classList.add('is-dealing');
        await revealHeroes({ stage, shares: preview.shares || [], music, fxLayer, burstLayer, confettiColors, isClosed: () => closed });
        if (closed) return;
        await finish({ stage, saving, preview, cls, music, fxLayer, confettiColors, event, seed, receipt });
        busy = false;
    };
    chest.addEventListener('click', open);
    chest.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    chest.focus({ preventScroll: true });
}

async function revealHeroes({ stage, shares, music, fxLayer, burstLayer, confettiColors, isClosed }) {
    const students = new Map((state.get('allStudents') || []).map((s) => [s.id, s]));
    const list = stage.querySelector('.dt-heroes');
    const ordered = [...shares].sort((a, b) => a.gold - b.gold);
    list.innerHTML = ordered.map((s, i) => {
        const student = students.get(s.studentId);
        return `
            <li class="dt-hero dt-hero--${esc(s.tier)}" style="--i:${i}">
                <span class="dt-hero__face">${heroFace(student)}</span>
                <span class="dt-hero__name">${esc(student?.name || 'A hero')}</span>
                <span class="dt-hero__gold"><i class="dt-hero__coin" aria-hidden="true"></i>+<b>${s.gold}</b></span>
                <span class="dt-hero__tier">${esc(tierLabel(s.tier))}</span>
            </li>`;
    }).join('');
    const step = calm() ? 0 : Math.max(110, Math.min(300, 3600 / Math.max(1, ordered.length)));
    for (let i = 0; i < ordered.length; i += 1) {
        if (isClosed()) return;
        const share = ordered[i];
        const item = list.children[i];
        if (share.tier === 'hoard' && !calm()) {
            // Everything holds its breath, then the Hoard.
            stage.classList.add('is-hush');
            music.hush();
            await wait(950);
            if (isClosed()) return;
            stage.classList.remove('is-hush');
            stage.classList.add('is-hoard');
            music.hoard();
            coinRain(fxLayer);
            coinFountain(burstLayer, 34, 1.3);
            confetti(fxLayer, confettiColors, 40);
            item.classList.add('is-shown');
            countUp(item.querySelector('b'), share.gold, 900);
            await wait(1600);
            stage.classList.remove('is-hoard');
            continue;
        }
        item.classList.add('is-shown');
        music.coin(i, share.tier);
        if (share.tier === 'chest') countUp(item.querySelector('b'), share.gold, 500);
        await wait(step + (share.tier === 'chest' ? 160 : 0));
    }
}

async function finish({ stage, saving, preview, cls, music, fxLayer, confettiColors, event, seed, receipt }) {
    const total = stage.querySelector('.dt-total');
    const hint = stage.querySelector('.dt-stage__hint');
    total.hidden = false;
    total.innerHTML = '<i class="dt-hero__coin" aria-hidden="true"></i> Filling the purses…';
    try {
        const saved = await saving;
        // Another laptop opened it first, or a hero had no score yet: show what was really saved.
        if (JSON.stringify(saved.shares || []) !== JSON.stringify(preview.shares || [])) {
            await revealHeroes({ stage, shares: saved.shares || [], music, fxLayer, burstLayer: stage.querySelector('.dt-chest__burst'), confettiColors, isClosed: () => !stage.isConnected });
        }
        const sum = saved.total ?? (saved.shares || []).reduce((n, s) => n + s.gold, 0);
        const before = Boolean((receipt && !receipt.pending) || saved.replay);
        total.innerHTML = `<i class="dt-hero__coin" aria-hidden="true"></i> <b>0</b> Gold for ${esc(cls.name || 'the class')}${before ? ' · opened before' : ''}`;
        total.classList.add('is-done');
        countUp(total.querySelector('b'), sum, 1100);
        music.finale();
        confetti(fxLayer, confettiColors, 36);
        hint.textContent = before ? 'Every hero already has this Gold.' : 'The Gold is in every hero\'s purse. Spend it well in the Mystic Market!';
    } catch (error) {
        console.error('Day Treasure:', error);
        total.classList.add('is-error');
        total.innerHTML = '<i class="fas fa-rotate-right" aria-hidden="true"></i> The Gold was not saved. Tap to try again';
        total.setAttribute('role', 'button');
        total.tabIndex = 0;
        total.onclick = () => {
            total.onclick = null;
            total.classList.remove('is-error');
            finish({ stage, saving: payTreasure(event, cls.id, seed), preview, cls, music, fxLayer, confettiColors, event, seed, receipt });
        };
    }
}

/** Dev preview (school-calendar-preview.html?view=treasure&date=…): replays a reveal without saving. */
export function previewTreasureStage({ event, cls, special, receipt }) {
    showTreasureStage({ event, cls, special, receipt });
}
