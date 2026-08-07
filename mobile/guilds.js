/**
 * Mobile Guild Hall — immersive scroll-snap stage.
 * Additive only: desktop layout untouched when body.gcq-mobile is off.
 */

import { playSound } from '../audio.js';

const MOBILE_GUILD_BLURB =
    'Guilds race for ⚜️ Glory. June’s champion wins the Grand Guild Ceremony.';

let wired = false;
let listObserver = null;
let slideIndex = 0;
let activeGuildId = null;
let syncingProgrammatic = false;
let settleTimer = 0;

function isMobileMode() {
    return typeof document !== 'undefined' && document.body?.classList.contains('gcq-mobile');
}

function prefersReducedMotion() {
    return typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function guildHallBlurbEl() {
    return document.querySelector('#guilds-tab .text-center > p.text-lg');
}

function applyMobileGuildBlurb() {
    const el = guildHallBlurbEl();
    if (!el) return;
    if (!el.dataset.mDesktopBlurb) {
        el.dataset.mDesktopBlurb = el.innerHTML;
    }
    if (isMobileMode()) {
        el.classList.add('m-guild-blurb');
        el.textContent = MOBILE_GUILD_BLURB;
    } else {
        el.classList.remove('m-guild-blurb');
        if (el.dataset.mDesktopBlurb) el.innerHTML = el.dataset.mDesktopBlurb;
    }
}

function getArena() {
    return document.querySelector('#guilds-leaderboard-list .guild-crystal-arena');
}

function getHall() {
    return document.querySelector('#guilds-leaderboard-list .guild-crystal-hall');
}

function getGuildCols() {
    return [...document.querySelectorAll('#guilds-leaderboard-list .guild-crystal-col')];
}

function ensureStageChrome() {
    const hall = getHall();
    const arena = getArena();
    if (!hall || !arena) return null;

    hall.classList.add('m-guild-stage');
    arena.classList.add('m-guild-stage__track');

    // Drop the old duplicate name/footer chrome if it still exists
    document.getElementById('m-guild-stage-chrome')?.remove();

    let viewport = hall.querySelector('.m-guild-stage__viewport');
    if (!viewport) {
        viewport = document.createElement('div');
        viewport.className = 'm-guild-stage__viewport';
        arena.parentNode.insertBefore(viewport, arena);
        viewport.appendChild(arena);
    } else if (arena.parentElement !== viewport) {
        viewport.appendChild(arena);
    }

    if (!viewport.querySelector('#m-guild-prev')) {
        const prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'm-guild-stage-nav m-guild-stage-nav--prev';
        prev.id = 'm-guild-prev';
        prev.setAttribute('aria-label', 'Previous guild');
        prev.innerHTML = '<i class="fas fa-chevron-left" aria-hidden="true"></i>';
        viewport.appendChild(prev);
    }
    if (!viewport.querySelector('#m-guild-next')) {
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'm-guild-stage-nav m-guild-stage-nav--next';
        next.id = 'm-guild-next';
        next.setAttribute('aria-label', 'Next guild');
        next.innerHTML = '<i class="fas fa-chevron-right" aria-hidden="true"></i>';
        viewport.appendChild(next);
    }

    return viewport;
}

function nearestSlideIndex(arena, cols) {
    if (!arena || !cols.length) return 0;
    const mid = arena.scrollLeft + arena.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    cols.forEach((col, i) => {
        const center = col.offsetLeft + col.offsetWidth / 2;
        const dist = Math.abs(center - mid);
        if (dist < bestDist) {
            bestDist = dist;
            best = i;
        }
    });
    return best;
}

function centeredScrollLeft(arena, target) {
    if (!arena || !target) return 0;
    const max = Math.max(0, arena.scrollWidth - arena.clientWidth);
    const left = target.offsetLeft - (arena.clientWidth - target.offsetWidth) / 2;
    return Math.max(0, Math.min(max, left));
}

/** Update active styles only — never mid-fling (avoids scale/filter stutter). */
function setActiveSlide(cols, index) {
    slideIndex = index;
    const active = cols[index];
    activeGuildId = active?.dataset.guild || null;

    cols.forEach((col, i) => {
        const on = i === index;
        col.classList.toggle('m-guild-slide--active', on);
        col.classList.toggle('m-guild-slide--peek-left', i === index - 1);
        col.classList.toggle('m-guild-slide--peek-right', i === index + 1);
        col.classList.remove('m-guild-slide--pulse');
        col.setAttribute('aria-hidden', on ? 'false' : 'true');
    });

    const prevBtn = document.getElementById('m-guild-prev');
    const nextBtn = document.getElementById('m-guild-next');
    if (prevBtn) prevBtn.disabled = cols.length <= 1;
    if (nextBtn) nextBtn.disabled = cols.length <= 1;
}

function scrollToIndex(index, { smooth = true } = {}) {
    const arena = getArena();
    const cols = getGuildCols();
    if (!arena || !cols.length) return;
    const len = cols.length;
    const next = ((index % len) + len) % len;
    const target = cols[next];
    if (!target) return;

    const useSmooth = smooth && !prefersReducedMotion();
    syncingProgrammatic = true;
    slideIndex = next;
    activeGuildId = target.dataset.guild || null;

    arena.scrollTo({
        left: centeredScrollLeft(arena, target),
        behavior: useSmooth ? 'smooth' : 'auto'
    });

    // Defer visual active state until motion finishes — keeps the swipe fluid
    const finish = () => {
        setActiveSlide(getGuildCols(), next);
        syncingProgrammatic = false;
    };

    if (useSmooth) {
        const onEnd = () => {
            arena.removeEventListener('scrollend', onEnd);
            window.clearTimeout(fallback);
            finish();
        };
        const fallback = window.setTimeout(finish, 480);
        arena.addEventListener('scrollend', onEnd, { once: true });
    } else {
        finish();
    }
}

function settleToNearest(arena) {
    if (!isMobileMode() || syncingProgrammatic) return;
    const cols = getGuildCols();
    if (!cols.length) return;

    const next = nearestSlideIndex(arena, cols);
    const ideal = centeredScrollLeft(arena, cols[next]);
    const drift = Math.abs(arena.scrollLeft - ideal);

    // Only nudge if native snap landed slightly off — never mid-gesture
    if (drift > 2) {
        syncingProgrammatic = true;
        arena.scrollTo({ left: ideal, behavior: 'auto' });
        window.setTimeout(() => {
            setActiveSlide(cols, next);
            syncingProgrammatic = false;
        }, 16);
        return;
    }

    if (next !== slideIndex || drift > 0.5) {
        setActiveSlide(cols, next);
    }
}

function syncStage() {
    if (!isMobileMode()) return;

    applyMobileGuildBlurb();
    const cols = getGuildCols();
    const arena = getArena();
    if (!cols.length || !arena) return;

    ensureStageChrome();
    wireTrackScroll(arena);

    if (activeGuildId) {
        const keep = cols.findIndex((c) => c.dataset.guild === activeGuildId);
        if (keep >= 0) slideIndex = keep;
    }
    slideIndex = Math.max(0, Math.min(slideIndex, cols.length - 1));

    setActiveSlide(cols, slideIndex);

    requestAnimationFrame(() => {
        const col = cols[slideIndex];
        if (!col) return;
        syncingProgrammatic = true;
        arena.scrollTo({ left: centeredScrollLeft(arena, col), behavior: 'auto' });
        window.setTimeout(() => { syncingProgrammatic = false; }, 40);
    });
}

function wireTrackScroll(arena) {
    if (!arena || arena.dataset.mGuildTrackWired) return;
    arena.dataset.mGuildTrackWired = '1';

    // One settle path only — no mid-scroll class thrashing
    arena.addEventListener('scroll', () => {
        if (!isMobileMode() || syncingProgrammatic) return;
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => settleToNearest(arena), 140);
    }, { passive: true });

    arena.addEventListener('scrollend', () => {
        if (!isMobileMode() || syncingProgrammatic) return;
        window.clearTimeout(settleTimer);
        settleToNearest(arena);
    }, { passive: true });
}

function observeGuildList() {
    const list = document.getElementById('guilds-leaderboard-list');
    if (!list) return;
    if (listObserver) listObserver.disconnect();
    listObserver = new MutationObserver(() => {
        if (!isMobileMode()) return;
        requestAnimationFrame(() => syncStage());
    });
    listObserver.observe(list, { childList: true, subtree: false });
}

function teardownMobileStage() {
    const hall = getHall();
    const arena = getArena();
    const viewport = hall?.querySelector('.m-guild-stage__viewport');

    getGuildCols().forEach((col) => {
        col.classList.remove(
            'm-guild-slide--active',
            'm-guild-slide--peek-left',
            'm-guild-slide--peek-right',
            'm-guild-slide--pulse'
        );
        col.removeAttribute('aria-hidden');
    });

    if (viewport && arena && hall) {
        hall.insertBefore(arena, viewport);
        viewport.remove();
    }

    hall?.classList.remove('m-guild-stage');
    arena?.classList.remove('m-guild-stage__track');
    if (arena) delete arena.dataset.mGuildTrackWired;
    document.getElementById('m-guild-stage-chrome')?.remove();
    document.getElementById('m-guild-carousel')?.remove();
}

function wire() {
    if (wired) return;
    wired = true;

    document.addEventListener('click', (event) => {
        if (!isMobileMode()) return;

        if (event.target.closest('#m-guild-prev')) {
            event.preventDefault();
            playSound('click');
            scrollToIndex(slideIndex - 1);
            return;
        }
        if (event.target.closest('#m-guild-next')) {
            event.preventDefault();
            playSound('click');
            scrollToIndex(slideIndex + 1);
        }
    });

    document.addEventListener('gcq-mobile-mode', () => {
        applyMobileGuildBlurb();
        if (isMobileMode()) {
            observeGuildList();
            syncStage();
        } else {
            teardownMobileStage();
        }
    });

    document.addEventListener('click', (event) => {
        const tabBtn = event.target.closest('[data-tab="guilds-tab"]');
        if (!tabBtn || !isMobileMode()) return;
        window.setTimeout(() => {
            applyMobileGuildBlurb();
            observeGuildList();
            syncStage();
        }, 140);
    });
}

export function initMobileGuilds() {
    wire();
    observeGuildList();
    applyMobileGuildBlurb();
    if (isMobileMode()) syncStage();
}
