// ui/core/marketParcel.js — "The Keeper's Parcel": the Mystic Market's purchase-complete reveal.
// A wrapped parcel lands on the velvet counter cloth, the wax seal pops, the lid lifts and the ware
// rises into the lantern light. The keeper's receipt tears off the till and gets stamped PAID while
// the purse ticks down. Everything that moves is a transform or opacity; .is-lite (low-power
// machines) keeps the unwrap but drops the endless loops, and reduced motion shows the final state.

import { handleUseItem, isItemUsable } from '../../features/powerUps.js';
import { keeperPurchaseLine } from '../../features/marketKeeperCore.mjs';
import { detectLowPowerTier } from '../../utils/devicePerformance.mjs';
import { playSound } from '../../audio.js';
import '../../styles/market_parcel.css';

const AUTO_CLOSE_MS = 6500;
const REVEAL_MS = 1500; // when the ware has risen and the receipt is out
const USE_IDLE_HTML = '<i class="fas fa-bolt" aria-hidden="true"></i><span>Use it now</span>';

let active = null; // { close } of the parcel on screen

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function prefersReducedMotion() {
    try { return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

function isLowPower() {
    try { return detectLowPowerTier(); } catch { return false; }
}

const KIND_RIBBON = {
    legendary: 'Legendary artifact',
    familiar: 'A companion egg',
    ware: 'Wrapped by the keeper'
};

function parcelMarkup({ kind, itemName, itemDescription, itemVisualHtml, finalPrice, basePrice, newGoldBalance, purseShown, studentName, cta, keeperLine, soldOut, discountNote }) {
    const discounted = Number(basePrice) > Number(finalPrice);
    const ribbon = soldOut ? 'The very last one!' : KIND_RIBBON[kind] || KIND_RIBBON.ware;
    const motes = Array.from({ length: 9 }, (_, i) => `<i class="mmp-mote mmp-mote--${i + 1}"></i>`).join('');
    return `
    <div class="mmp-card" role="dialog" aria-modal="true" aria-labelledby="mmp-title" aria-describedby="mmp-desc" data-kind="${kind}" tabindex="-1">
        <div class="mmp-awning" aria-hidden="true"></div>
        <button type="button" class="mmp-x" data-mmp-close aria-label="Close"><i class="fas fa-times" aria-hidden="true"></i></button>

        <div class="mmp-stage" aria-hidden="true">
            <div class="mmp-rays"></div>
            <div class="mmp-glow"></div>
            <div class="mmp-motes">${motes}</div>
            <div class="mmp-ware">
                <div class="mmp-ware__art">${itemVisualHtml}</div>
            </div>
            <div class="mmp-parcel">
                <div class="mmp-parcel__lid"><span class="mmp-twine mmp-twine--lid"></span></div>
                <div class="mmp-parcel__box">
                    <span class="mmp-twine mmp-twine--v"></span>
                    <span class="mmp-twine mmp-twine--h"></span>
                    <span class="mmp-parcel__tag">For ${escapeHtml(studentName.split(' ')[0] || studentName)}</span>
                </div>
                <span class="mmp-seal"><span>✦</span></span>
            </div>
            <div class="mmp-cloth"></div>
        </div>

        <p class="mmp-ribbon"><span>${escapeHtml(ribbon)}</span></p>
        <h2 id="mmp-title" class="mmp-title">${escapeHtml(itemName)}</h2>
        <p id="mmp-desc" class="mmp-desc">${escapeHtml(itemDescription)}</p>

        <div class="mmp-receipt">
            <p class="mmp-receipt__head">Mystic Market · Receipt</p>
            <dl class="mmp-receipt__rows">
                <div><dt>Sold to</dt><dd class="mmp-receipt__who">${escapeHtml(studentName)}</dd></div>
                <div><dt>Price</dt><dd>${discounted ? `<s>${Number(basePrice)}</s> ` : ''}<b>${Number(finalPrice)}</b> 🪙</dd></div>
                ${discountNote ? `<div class="mmp-receipt__note"><dt>Discount</dt><dd>${escapeHtml(discountNote)}</dd></div>` : ''}
                <div class="mmp-receipt__purse"><dt>Purse now</dt><dd><b data-mmp-purse>${Number(purseShown)}</b> 🪙</dd></div>
            </dl>
            <span class="mmp-stamp" aria-hidden="true">Paid</span>
        </div>

        <div class="mmp-keeper">
            <span class="mmp-keeper__face" aria-hidden="true"></span>
            <p class="mmp-keeper__line">${escapeHtml(keeperLine)}</p>
        </div>

        <div class="mmp-actions">
            <button type="button" class="mmp-btn mmp-btn--use hidden" data-mmp-use>${USE_IDLE_HTML}</button>
            <button type="button" class="mmp-btn mmp-btn--done" data-mmp-close><i class="fas fa-check" aria-hidden="true"></i><span>${escapeHtml(cta)}</span></button>
        </div>
        <div class="mmp-wick" aria-hidden="true"><span class="mmp-wick__burn"></span></div>
    </div>`;
}

/** Ticks the receipt's purse down from what it held to what is left. */
function tickPurse(el, from, to, durationMs) {
    if (!el) return;
    if (from === to) { el.textContent = String(to); return; }
    const start = performance.now();
    const step = (now) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = String(Math.round(from + (to - from) * eased));
        if (t < 1 && el.isConnected) requestAnimationFrame(step);
    };
    el.textContent = String(from);
    requestAnimationFrame(step);
}

/**
 * Shows the purchase reveal. Returns false when the modal shell is missing so callers can toast.
 * kind: 'ware' | 'legendary' | 'familiar'
 */
export function showShopPurchasePopup({
    itemName,
    itemDescription,
    itemVisualHtml,
    finalPrice,
    basePrice = finalPrice,
    newGoldBalance,
    studentName = '',
    cta = 'Into the satchel!',
    useContext = null,
    kind = 'ware',
    soldOut = false,
    discountNote = ''
}) {
    const overlay = document.getElementById('shop-purchase-modal');
    if (!overlay) return false;
    active?.close({ instant: true });

    const reduced = prefersReducedMotion();
    const lite = !reduced && isLowPower();
    const returnFocusTo = document.activeElement;
    const openId = String(Date.now() + Math.random());
    overlay.dataset.mmpOpen = openId;

    overlay.innerHTML = parcelMarkup({
        kind,
        itemName,
        itemDescription: itemDescription || 'A rare artifact for your collection!',
        itemVisualHtml: itemVisualHtml || '🎁',
        finalPrice,
        basePrice,
        newGoldBalance,
        purseShown: reduced ? newGoldBalance : Number(newGoldBalance) + Number(finalPrice),
        studentName: String(studentName || 'Your hero'),
        cta,
        keeperLine: keeperPurchaseLine({ studentName, itemName, soldOut }),
        soldOut,
        discountNote
    });
    overlay.classList.toggle('is-lite', lite);
    overlay.classList.toggle('is-still', reduced);
    overlay.classList.remove('hidden', 'is-closing');

    const card = overlay.querySelector('.mmp-card');
    const useBtn = overlay.querySelector('[data-mmp-use]');
    const doneBtn = overlay.querySelector('.mmp-btn--done');
    const wick = overlay.querySelector('.mmp-wick__burn');

    let closed = false;
    let useInFlight = false;
    let autoCloseTimer = null;
    let revealTimer = null;
    let remaining = AUTO_CLOSE_MS;
    let timerStartedAt = 0;
    let paused = false;

    const startAutoClose = (ms = AUTO_CLOSE_MS) => {
        clearTimeout(autoCloseTimer);
        remaining = ms;
        timerStartedAt = performance.now();
        if (wick) {
            wick.style.transition = 'none';
            wick.style.transform = `scaleX(${ms / AUTO_CLOSE_MS})`;
            void wick.offsetWidth;
            wick.style.transition = `transform ${ms}ms linear`;
            wick.style.transform = 'scaleX(0)';
        }
        overlay.classList.remove('is-paused');
        autoCloseTimer = setTimeout(() => close(), ms);
    };

    const pauseAutoClose = () => {
        if (paused || closed || useInFlight) return;
        paused = true;
        clearTimeout(autoCloseTimer);
        remaining = Math.max(1200, remaining - (performance.now() - timerStartedAt));
        if (wick) {
            const now = getComputedStyle(wick).transform;
            wick.style.transition = 'none';
            wick.style.transform = now === 'none' ? `scaleX(${remaining / AUTO_CLOSE_MS})` : now;
        }
        overlay.classList.add('is-paused');
    };

    const resumeAutoClose = () => {
        if (!paused || closed || useInFlight) return;
        paused = false;
        startAutoClose(remaining);
    };

    const purseEl = overlay.querySelector('[data-mmp-purse]');
    const reveal = () => {
        clearTimeout(revealTimer);
        if (closed || card.classList.contains('is-revealed')) return;
        card.classList.add('is-revealed');
        playSound(kind === 'legendary' ? 'award_3' : 'magic_chime');
        // the purse ticks down as the receipt comes out of the till
        setTimeout(() => {
            if (!closed) tickPurse(purseEl, Number(newGoldBalance) + Number(finalPrice), Number(newGoldBalance), 650);
        }, 560);
    };

    const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
    };

    function close({ instant = false } = {}) {
        if (closed || (useInFlight && !instant)) return;
        closed = true;
        clearTimeout(autoCloseTimer);
        clearTimeout(revealTimer);
        document.removeEventListener('keydown', onKey, true);
        if (active?.close === close) active = null;
        const finish = () => {
            if (overlay.dataset.mmpOpen !== openId) return; // a newer parcel already took the counter
            overlay.classList.add('hidden');
            overlay.classList.remove('is-closing', 'is-paused');
            overlay.innerHTML = '';
        };
        if (instant || reduced) finish();
        else {
            overlay.classList.add('is-closing');
            setTimeout(finish, 240);
        }
        if (!instant && returnFocusTo && typeof returnFocusTo.focus === 'function' && returnFocusTo.isConnected) {
            try { returnFocusTo.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
        }
    }
    active = { close };

    // Opening sequence: the parcel lands, the seal pops, the ware rises, the receipt is stamped.
    if (reduced) {
        card.classList.add('is-revealed', 'is-instant');
    } else {
        requestAnimationFrame(() => card.classList.add('is-landing'));
        revealTimer = setTimeout(reveal, lite ? 420 : 720);
    }

    // Tapping the card mid-unwrap skips straight to the reveal.
    card.addEventListener('click', (e) => {
        if (!card.classList.contains('is-revealed') && !e.target.closest('button')) reveal();
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelectorAll('[data-mmp-close]').forEach((btn) => { btn.onclick = () => close(); });
    card.addEventListener('pointerenter', pauseAutoClose);
    card.addEventListener('pointerleave', resumeAutoClose);
    let quietFocus = false; // our own focus on the done button is not the teacher reaching for it
    card.addEventListener('focusin', (e) => { if (!quietFocus && e.target !== card) pauseAutoClose(); });
    document.addEventListener('keydown', onKey, true);

    const canUseNow = Boolean(
        useContext &&
        useContext.studentId &&
        Number.isInteger(useContext.itemIndex) && useContext.itemIndex >= 0 &&
        isItemUsable(useContext.itemName)
    );

    if (canUseNow && useBtn) {
        useBtn.classList.remove('hidden');
        useBtn.onclick = async () => {
            if (useInFlight) return;
            useInFlight = true;
            clearTimeout(autoCloseTimer);
            overlay.classList.add('is-paused');
            useBtn.disabled = true;
            useBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>Using…</span>';
            let used = false;
            try {
                const result = await handleUseItem(useContext.studentId, useContext.itemIndex);
                used = Boolean(result?.success);
            } catch (error) {
                console.error('Use from purchase modal failed:', error);
            } finally {
                useInFlight = false;
            }
            if (used) { close(); return; }
            if (closed) return;
            useBtn.disabled = false;
            useBtn.innerHTML = USE_IDLE_HTML;
            paused = false;
            startAutoClose();
        };
    }

    startAutoClose();
    setTimeout(() => {
        if (closed) return;
        quietFocus = true;
        try { doneBtn?.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
        quietFocus = false;
    }, reduced ? 0 : REVEAL_MS);
    return true;
}
