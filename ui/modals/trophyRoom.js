// /ui/modals/trophyRoom.js — Trophy Room modal
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { showToast } from '../effects.js';
import { showAnimatedModal } from './base.js';
import { handleUseItem, isItemUsable } from '../../features/powerUps.js';
import { showInventoryItemDetail } from '../core/avatar.js';

const MODAL_ID = 'trophy-room-modal';
const CONTENT_ID = 'trophy-room-content';
const CUSTOM_SELECT_ID = 'trophy-room-custom-select';
const trophyRoomFeedback = new Map();
const inventoryCarouselIndices = new Map(); // Store current index per student
let trophyRoomDropdownOutsideAbort = null;
/** @type {'next' | 'prev' | null} */
let trophyBackpackRollDirection = null;

const BACKPACK_PAGE_SIZE = 3;

const BACKPACK_CARD_PALETTES = [
    { border: 'border-violet-200/90', cardBg: 'bg-gradient-to-b from-violet-50/90 to-white/95', shadow: 'shadow-violet-100/80', visualBg: 'from-violet-100/70 to-indigo-50/50', accent: 'text-violet-600', dot: 'bg-violet-400' },
    { border: 'border-sky-200/90', cardBg: 'bg-gradient-to-b from-sky-50/90 to-white/95', shadow: 'shadow-sky-100/80', visualBg: 'from-sky-100/70 to-cyan-50/50', accent: 'text-sky-600', dot: 'bg-sky-400' },
    { border: 'border-amber-200/90', cardBg: 'bg-gradient-to-b from-amber-50/95 to-white/95', shadow: 'shadow-amber-100/80', visualBg: 'from-amber-100/70 to-orange-50/40', accent: 'text-amber-700', dot: 'bg-amber-400' },
    { border: 'border-rose-200/90', cardBg: 'bg-gradient-to-b from-rose-50/90 to-white/95', shadow: 'shadow-rose-100/80', visualBg: 'from-rose-100/70 to-fuchsia-50/45', accent: 'text-rose-600', dot: 'bg-rose-400' },
];

function escAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

let trophyVaultDelegationBound = false;

function ensureTrophyVaultContentDelegation(contentEl) {
    if (trophyVaultDelegationBound) return;
    trophyVaultDelegationBound = true;
    contentEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.trophy-vault-item-visual-btn');
        if (!btn) return;
        const host = document.getElementById(CONTENT_ID);
        if (!host?.contains(btn)) return;
        e.preventDefault();
        e.stopPropagation();
        showInventoryItemDetail({
            name: btn.getAttribute('data-item-name') || '',
            description: btn.getAttribute('data-item-desc') || '',
            icon: btn.getAttribute('data-item-icon') || '',
            image: btn.getAttribute('data-item-image') || '',
        });
    });
}

function getTrophyRoomClasses() {
    return [...(state.get('allTeachersClasses') || [])].sort((a, b) => a.name.localeCompare(b.name));
}

function buildTrophyRoomStudentsByClass(classId = '') {
    const classes = getTrophyRoomClasses();
    const allowedClassIds = classId
        ? new Set([classId])
        : new Set(classes.map((c) => c.id));
    return (state.get('allStudents') || [])
        .filter((student) => allowedClassIds.has(student.classId))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Custom Dropdown Logic
 */
function setupCustomDropdown(classId, selectedStudentId) {
    const container = document.getElementById(CUSTOM_SELECT_ID);
    if (!container) return;

    if (trophyRoomDropdownOutsideAbort) {
        trophyRoomDropdownOutsideAbort.abort();
        trophyRoomDropdownOutsideAbort = null;
    }

    const trigger = container.querySelector('.dropdown-trigger');
    const menu = container.querySelector('.dropdown-menu');
    const label = container.querySelector('#custom-select-label');
    const arrow = container.querySelector('.dropdown-arrow');

    const students = buildTrophyRoomStudentsByClass(classId);

    // Populate options
    menu.innerHTML = students.map(s => `
        <div class="dropdown-option px-4 py-3 hover:bg-indigo-50 cursor-pointer flex items-center gap-3 transition-colors border-b border-indigo-50 last:border-0 shrink-0" data-value="${s.id}">
            <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-400 font-bold text-xs overflow-hidden shrink-0">
                ${s.avatar ? `<img src="${s.avatar}" class="w-full h-full object-cover">` : s.name.charAt(0)}
            </div>
            <span class="text-slate-700 font-title text-sm font-normal truncate min-w-0">${s.name}</span>
        </div>
    `).join('');

    if (students.length === 0) {
        menu.innerHTML = '<div class="px-4 py-3 text-slate-500 text-sm italic">No students in this class.</div>';
    }

    // Set initial label
    const selected = students.find(s => s.id === selectedStudentId);
    if (selected) {
        label.textContent = selected.name;
        label.classList.add('text-indigo-600');
    } else {
        label.textContent = 'Select a student';
        label.classList.remove('text-indigo-600');
    }

    // Explicitly hide on init to avoid "auto-open"
    menu.classList.add('hidden', 'scale-95', 'opacity-0');

    // Toggle logic (force === true open, false close, undefined = toggle)
    const toggle = (force) => {
        const shouldOpen = force === true
            ? true
            : force === false
                ? false
                : menu.classList.contains('hidden');
        if (shouldOpen) {
            menu.classList.remove('hidden', 'pointer-events-none');
            requestAnimationFrame(() => {
                menu.classList.add('scale-100', 'opacity-100');
                menu.classList.remove('scale-95', 'opacity-0');
            });
            arrow.classList.add('rotate-180');
        } else {
            menu.classList.add('pointer-events-none');
            menu.classList.remove('scale-100', 'opacity-100');
            menu.classList.add('scale-95', 'opacity-0');
            arrow.classList.remove('rotate-180');
            setTimeout(() => menu.classList.add('hidden'), 300);
        }
    };

    trigger.onclick = (e) => {
        e.stopPropagation();
        toggle();
    };

    menu.querySelectorAll('.dropdown-option').forEach(opt => {
        opt.onclick = (e) => {
            e.stopPropagation();
            const val = opt.dataset.value;
            toggle(false);
            renderTrophyRoomContent(val);
        };
    });

    trophyRoomDropdownOutsideAbort = new AbortController();
    const { signal } = trophyRoomDropdownOutsideAbort;
    document.addEventListener('click', (e) => {
        if (container.contains(e.target)) return;
        if (!menu.classList.contains('hidden')) toggle(false);
    }, { capture: true, signal });
}

export function openTrophyRoomModal(preselectedStudentId = null) {
    const allStudents = state.get('allStudents') || [];
    const preselectedStudent = preselectedStudentId
        ? allStudents.find((s) => s.id === preselectedStudentId)
        : null;
    const globalClassId = state.get('globalSelectedClassId') || '';
    const classId = preselectedStudent?.classId || globalClassId;

    if (!classId) {
        showToast('Choose a class from the header first.', 'info');
        return;
    }

    // Custom dropdown setup (lightweight); defer heavy vault render so open animation stays smooth
    setupCustomDropdown(classId, preselectedStudentId);

    showAnimatedModal(MODAL_ID);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            renderTrophyRoomContent(preselectedStudentId || '');
        });
    });
}

export function renderTrophyRoomContent(studentId, partial = false) {
    const contentEl = document.getElementById(CONTENT_ID);
    if (!contentEl) return;

    const backpackRollAnim = partial ? trophyBackpackRollDirection : null;
    if (partial) trophyBackpackRollDirection = null;

    const student = state.get('allStudents').find(s => s.id === studentId);
    
    // Update custom select label
    const label = document.getElementById('custom-select-label');
    if (label && student) {
        label.textContent = student.name;
        label.classList.add('text-indigo-900');
    }

    if (!studentId) {
        contentEl.innerHTML = `
            <div class="flex-1 min-h-0 flex flex-col items-center justify-center text-center space-y-4 py-10 animate-in">
                <div class="relative">
                    <div class="absolute inset-0 bg-indigo-200 blur-3xl rounded-full opacity-30 animate-pulse"></div>
                    <div class="text-6xl relative z-10 animate-float">🛡️</div>
                </div>
                <div>
                    <h3 class="font-title text-2xl text-indigo-900/70 tracking-tight">Pick a student</h3>
                    <p class="text-indigo-500/70 font-title text-sm font-normal mt-1.5 opacity-90">Choose someone from the list above to open the vault.</p>
                </div>
            </div>`;
        return;
    }

    const scoreData = state.get('allStudentScores').find(s => s.id === studentId);
    const inventory = scoreData?.inventory || [];
    const studentClass = state.get('allSchoolClasses').find(c => c.id === student?.classId)
        || state.get('allTeachersClasses').find(c => c.id === student?.classId);
    
    const gold = scoreData?.gold !== undefined ? scoreData.gold : (scoreData?.totalStars ?? 0);
    const usableCount = inventory.filter(item => isItemUsable(item.name)).length;
    const collectibleCount = inventory.length - usableCount;
    const featuredItem = inventory.find(item => isItemUsable(item.name)) || inventory[0] || null;

    // Effects logic
    const activeEffects = [];
    if (scoreData?.hasGildedEffect) activeEffects.push({ icon: '✨', title: 'Gilded Star', body: 'Triple Gold payout next.' });
    if (scoreData?.luckDate) activeEffects.push({ icon: '🍀', title: 'Luck Stored', body: `Lesson on ${scoreData.luckDate}.` });
    if (scoreData?.starfallCatalystActive) activeEffects.push({ icon: '📜', title: 'Catalyst', body: 'Next bonus doubled.' });
    if (scoreData?.pendingHeroStatus) activeEffects.push({ icon: '🎭', title: 'Protagonist', body: 'Hero in next Story Log.' });
    if (scoreData?.peerBoonFreeMonthKey === utils.getLocalMonthKey()) activeEffects.push({ icon: '💝', title: 'Compassion Token', body: "Hero's Boon costs 0 Gold this month." });
    if ((scoreData?.gloryBannerCharges || 0) > 0) activeEffects.push({ icon: '⚜️', title: 'Banner of Glory', body: `${scoreData.gloryBannerCharges} charge${scoreData.gloryBannerCharges > 1 ? 's' : ''} remaining — qualifying stars each write +1 bonus Guild Glory into the ledger.` });
    if (scoreData?.storyWeaverDoubleNext) activeEffects.push({ icon: '✒️', title: "Archivist's Quill", body: 'Next Story Weaver bonus will be worth double stars.' });
    const aurumMonth = scoreData?.aurumVoucherMonth;
    if ((scoreData?.aurumVoucherPercent || 0) > 0 && aurumMonth === utils.getLocalMonthKey()) activeEffects.push({ icon: '💰', title: 'Aurum Satchel', body: `${scoreData.aurumVoucherPercent}% off next Mystic Market purchase this month.` });

    // Featured Item HTML
    const featuredHtml = featuredItem
        ? (() => {
            const visual = featuredItem.image ? `<img src="${featuredItem.image}" class="w-full h-full object-cover">` : featuredItem.icon || '📦';
            return `
                <div class="tv-featured-card bg-gradient-to-br from-amber-50/90 via-white to-violet-50/70 rounded-xl p-3 flex items-center gap-3 border-2 border-amber-200/55 shadow-md shadow-amber-100/50 transition-transform hover:scale-[1.01]">
                    <div class="relative shrink-0">
                        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-violet-100 flex items-center justify-center text-2xl border-2 border-white shadow-inner overflow-hidden">${visual}</div>
                        <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 text-white text-[8px] flex items-center justify-center shadow-sm ring-2 ring-white" aria-hidden="true"><i class="fas fa-star"></i></span>
                    </div>
                    <div class="min-w-0">
                        <h4 class="font-title text-indigo-950 text-sm tracking-tight truncate">${featuredItem.name}</h4>
                        <p class="text-xs text-indigo-600/90 leading-snug mt-0.5 line-clamp-2 font-medium">${featuredItem.description || 'A prized heroic artifact.'}</p>
                    </div>
                </div>`;
        })()
        : `<div class="rounded-xl py-5 px-4 text-center border-2 border-dashed border-violet-200/70 bg-gradient-to-br from-violet-50/60 to-fuchsia-50/40 text-sm text-violet-700 font-title font-normal leading-snug"><i class="fas fa-gem text-violet-400 mr-2" aria-hidden="true"></i>No featured artifact yet.</div>`;

    // Carousel Logic
    const pageSize = BACKPACK_PAGE_SIZE;
    let currentIndex = inventoryCarouselIndices.get(studentId) || 0;
    if (currentIndex > 0 && currentIndex >= inventory.length) {
        currentIndex = Math.max(0, inventory.length - 1);
        inventoryCarouselIndices.set(studentId, currentIndex);
    }
    const visibleItems = inventory.slice(currentIndex, currentIndex + pageSize);
    const canPrev = currentIndex > 0;
    const canNext = currentIndex + pageSize < inventory.length;

    const rollClass = backpackRollAnim === 'next'
        ? 'trophy-backpack-roll--next'
        : backpackRollAnim === 'prev'
            ? 'trophy-backpack-roll--prev'
            : '';

    const inventoryHtml = visibleItems.length > 0
        ? visibleItems.map((item, idx) => {
            const realIdx = currentIndex + idx;
            const usable = isItemUsable(item.name);
            const visual = item.image ? `<img src="${item.image}" class="w-full h-full object-cover">` : item.icon || '📦';
            const pal = BACKPACK_CARD_PALETTES[realIdx % BACKPACK_CARD_PALETTES.length];
            const statusDot = usable ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : pal.dot;
            const statusTextClass = usable ? 'text-emerald-600' : pal.accent;
            return `
                <div class="trophy-vault-compartment ${pal.cardBg} backdrop-blur-sm rounded-2xl border-2 ${pal.border} shadow-md ${pal.shadow} p-3 flex flex-col items-stretch gap-2 min-w-0 h-auto group hover:brightness-[1.02] transition-all duration-300">
                    <div class="flex flex-col items-center gap-2 min-w-0">
                    <button type="button" class="trophy-vault-item-visual-btn w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-2xl bg-gradient-to-br ${pal.visualBg} flex items-center justify-center text-3xl sm:text-4xl overflow-hidden shadow-inner border-2 border-white/90 transition-transform duration-300 group-hover:scale-[1.04] group-hover:rotate-1 shrink-0 cursor-zoom-in p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white/40"
                        data-item-name="${escAttr(item.name)}"
                        data-item-desc="${escAttr(item.description || '')}"
                        data-item-icon="${escAttr(item.icon || '')}"
                        data-item-image="${escAttr(item.image || '')}"
                        aria-label="Enlarge item">
                        ${visual}
                    </button>
                    <div class="text-center min-w-0 w-full">
                        <p class="font-title text-indigo-950 text-xs sm:text-sm leading-tight line-clamp-2 break-words mb-1">${item.name}</p>
                        <div class="flex items-center justify-center gap-1.5">
                             <span class="w-2 h-2 rounded-full shrink-0 ${statusDot}" aria-hidden="true"></span>
                             <p class="text-[10px] font-semibold ${statusTextClass}">${usable ? 'Ready to use' : 'Vaulted'}</p>
                        </div>
                    </div>
                    </div>
                    ${usable 
                        ? `<button type="button" class="trophy-room-use-btn mt-auto w-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-title text-sm py-2 rounded-xl transition-all shadow-md shadow-orange-200/40 active:scale-95 border border-orange-300/30" data-student-id="${studentId}" data-item-index="${realIdx}"><i class="fas fa-wand-magic-sparkles mr-1.5 text-xs opacity-90"></i>Use relic</button>`
                        : `<div class="mt-auto w-full bg-white/75 text-slate-600 font-title text-sm py-2 rounded-xl text-center border-2 border-slate-200/70 shadow-inner"><i class="fas fa-award text-amber-500/90 mr-1.5 text-xs"></i>Collectible</div>`
                    }
                </div>`;
        }).join('')
        : `<div class="col-span-full text-center py-8 px-3 text-violet-700 text-sm font-title font-normal italic rounded-xl border-2 border-dashed border-violet-200/80 bg-gradient-to-br from-violet-50/70 to-white/80"><i class="fa-solid fa-bag-shopping text-violet-400 text-lg block mb-2" aria-hidden="true"></i>Backpack is empty.</div>`;

    const backpackHtml = `
        <div id="backpack-container" class="tv-backpack-shell min-w-0 rounded-2xl border-2 border-violet-200/45 shadow-lg shadow-violet-100/40 p-4 flex flex-col gap-3 relative overflow-hidden transition-all duration-300 bg-gradient-to-br from-violet-50/75 via-white to-amber-50/45">
            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.06] pointer-events-none"></div>
            <div class="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-gradient-to-br from-fuchsia-200/35 to-amber-200/30 blur-2xl pointer-events-none"></div>
            <div class="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-gradient-to-tr from-sky-200/30 to-violet-200/25 blur-2xl pointer-events-none"></div>
            <div class="flex flex-wrap items-center justify-between gap-2 relative z-10">
                <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm shadow-lg shadow-indigo-200/45 shrink-0 ring-2 ring-white/70"><i class="fas fa-scroll" aria-hidden="true"></i></div>
                    <div class="min-w-0">
                        <p class="font-title text-base text-indigo-950 tracking-tight leading-tight">Hero's backpack</p>
                        <p class="text-[10px] text-indigo-500 font-semibold leading-none mt-0.5 flex items-center gap-1"><i class="fas fa-shuffle text-[9px] opacity-80" aria-hidden="true"></i>Roll items with arrows</p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" id="inventory-prev-btn" class="w-9 h-9 rounded-xl bg-white border-2 border-violet-200/70 flex items-center justify-center text-violet-600 hover:bg-violet-50 hover:border-violet-300 transition-all disabled:opacity-25 disabled:pointer-events-none shadow-sm active:scale-95 text-sm" ${!canPrev ? 'disabled' : ''} aria-label="Previous items">
                        <i class="fas fa-chevron-left" aria-hidden="true"></i>
                    </button>
                    <button type="button" id="inventory-next-btn" class="w-9 h-9 rounded-xl bg-white border-2 border-violet-200/70 flex items-center justify-center text-violet-600 hover:bg-violet-50 hover:border-violet-300 transition-all disabled:opacity-25 disabled:pointer-events-none shadow-sm active:scale-95 text-sm" ${!canNext ? 'disabled' : ''} aria-label="Next items">
                        <i class="fas fa-chevron-right" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
            <div class="trophy-backpack-roll-viewport relative z-10 min-h-0">
                <div class="treasure-vault-backpack-grid treasure-vault-backpack-grid--compact ${rollClass}">
                    ${inventoryHtml}
                </div>
            </div>
            <div class="flex items-center justify-center gap-3 relative z-10 pt-0.5">
                <div class="h-1.5 flex-1 max-w-[160px] bg-gradient-to-r from-violet-100 via-indigo-100 to-amber-100 rounded-full overflow-hidden shadow-inner">
                    <div class="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-amber-400 transition-all duration-500 ease-out rounded-full" style="width: ${inventory.length > 0 ? ((currentIndex + pageSize) / inventory.length) * 100 : 0}%"></div>
                </div>
                <p class="text-xs text-violet-700 font-title tabular-nums shrink-0 opacity-90">
                    <i class="fas fa-layer-group text-[10px] mr-1 opacity-70" aria-hidden="true"></i>${inventory.length > 0 ? currentIndex + 1 : 0}–${Math.min(currentIndex + pageSize, inventory.length)} of ${inventory.length}
                </p>
            </div>
        </div>`;

    if (partial) {
        // Seamless update for backpack only
        const oldBackpack = document.getElementById('backpack-container');
        if (oldBackpack) {
            const temp = document.createElement('div');
            temp.innerHTML = backpackHtml;
            const newBackpack = temp.firstElementChild;
            oldBackpack.replaceWith(newBackpack);
            bindBackpackListeners(studentId);
            bindUseBtns(studentId, newBackpack);
            return;
        }
    }

    const existingShell = contentEl.querySelector('.treasure-vault-shell');
    const switchingStudent = !!(existingShell?.dataset?.studentId && existingShell.dataset.studentId !== studentId);

    const runEnterAnimation = switchingStudent || !existingShell;

    const finishVaultShellMount = (withEnterAnim) => {
        contentEl.innerHTML = `
        <div class="treasure-vault-shell w-full max-w-[min(1180px,100%)] mx-auto space-y-4 animate-in" data-student-id="${studentId}">
            <!-- Hero summary (compact, horizontal on wider viewports) -->
            <section class="tv-hero-panel bg-gradient-to-br from-indigo-600 via-violet-700 to-fuchsia-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 relative overflow-hidden shadow-xl shadow-indigo-900/25 border-2 border-white/20">
                <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none"></div>
                <div class="absolute -top-16 -right-10 w-40 h-40 rounded-full bg-amber-300/20 blur-3xl pointer-events-none"></div>
                <div class="flex justify-center sm:justify-start shrink-0 relative z-10">
                    <div class="relative group">
                        <div class="w-[4.5rem] h-[4.5rem] sm:w-24 sm:h-24 rounded-full border-4 border-white/35 shadow-xl bg-white overflow-hidden ring-4 ring-amber-200/25">
                            ${student?.avatar ? `<img src="${student.avatar}" class="w-full h-full object-cover" alt="${student?.name || 'Student'}">` : `<div class="w-full h-full flex items-center justify-center text-3xl sm:text-4xl font-title text-indigo-600 bg-indigo-50">${student?.name.charAt(0)}</div>`}
                        </div>
                        <div class="absolute -top-1 -right-1 bg-gradient-to-br from-amber-400 to-orange-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-lg border-2 border-white ring-2 ring-amber-200/60" aria-hidden="true">👑</div>
                    </div>
                </div>
                <div class="relative z-10 flex-1 min-w-0 flex flex-col gap-3 text-center sm:text-left">
                    <div>
                        <p class="text-[10px] text-amber-200/95 font-title tracking-wide mb-1"><i class="fas fa-trophy text-amber-300 mr-1" aria-hidden="true"></i>Vault hero</p>
                        <h2 class="font-title text-xl sm:text-2xl text-white drop-shadow-md tracking-tight">${student?.name}</h2>
                        <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                            <span class="inline-flex items-center gap-1.5 bg-white/18 backdrop-blur-md text-white border border-white/25 px-3 py-1 rounded-xl text-xs font-title shadow-sm">
                                <i class="fas fa-users text-sky-200 text-[10px]" aria-hidden="true"></i>${studentClass?.logo ?? ''} ${studentClass?.name ?? ''}
                            </span>
                            <span class="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-orange-400 text-amber-950 px-3 py-1 rounded-xl text-xs font-title shadow-md shadow-amber-900/15 border border-amber-200/50">
                                <i class="fas fa-coins text-[10px] opacity-90" aria-hidden="true"></i>${gold} gold
                            </span>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-2 max-w-md sm:max-w-none mx-auto sm:mx-0 w-full">
                        <div class="tv-hero-stat tv-hero-stat--inventory bg-gradient-to-br from-cyan-400/55 to-cyan-950/30 backdrop-blur-sm rounded-xl py-2.5 px-1.5 text-center border-2 border-cyan-200/60 shadow-lg shadow-cyan-950/20 ring-1 ring-cyan-300/35">
                            <i class="fas fa-box-open text-cyan-50 text-xs mb-1 block drop-shadow-md" aria-hidden="true"></i>
                            <p class="text-lg sm:text-xl font-title text-white leading-none drop-shadow-sm">${inventory.length}</p>
                            <p class="text-[10px] font-title text-cyan-50 mt-1">Inventory</p>
                        </div>
                        <div class="tv-hero-stat tv-hero-stat--usable bg-gradient-to-br from-amber-400/60 to-orange-950/30 backdrop-blur-sm rounded-xl py-2.5 px-1.5 text-center border-2 border-amber-200/60 shadow-lg shadow-amber-950/20 ring-1 ring-amber-300/35">
                            <i class="fas fa-bolt text-amber-50 text-xs mb-1 block drop-shadow-md" aria-hidden="true"></i>
                            <p class="text-lg sm:text-xl font-title text-white leading-none drop-shadow-sm">${usableCount}</p>
                            <p class="text-[10px] font-title text-amber-50 mt-1">Usable</p>
                        </div>
                        <div class="tv-hero-stat tv-hero-stat--vaulted bg-gradient-to-br from-rose-400/55 to-fuchsia-950/30 backdrop-blur-sm rounded-xl py-2.5 px-1.5 text-center border-2 border-rose-200/55 shadow-lg shadow-rose-950/20 ring-1 ring-rose-300/35">
                            <i class="fas fa-gem text-rose-50 text-xs mb-1 block drop-shadow-md" aria-hidden="true"></i>
                            <p class="text-lg sm:text-xl font-title text-white leading-none drop-shadow-sm">${collectibleCount}</p>
                            <p class="text-[10px] font-title text-rose-50 mt-1">Vaulted</p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Lower Section -->
            <div class="grid lg:grid-cols-2 gap-4 min-w-0">
                <!-- Enchantments Panel -->
                <div class="tv-enchant-panel min-w-0 bg-gradient-to-br from-emerald-50/55 via-white to-violet-50/40 rounded-2xl border-2 border-emerald-100/80 shadow-lg shadow-emerald-100/30 p-4 flex flex-col gap-3 relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-200/25 to-transparent rounded-bl-full pointer-events-none"></div>
                    <div class="flex items-center gap-2.5 relative z-10">
                        <div class="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white text-sm shadow-md shadow-emerald-200/50 ring-2 ring-white/60"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i></div>
                        <div>
                            <p class="font-title text-base text-indigo-950 tracking-tight leading-tight">Active enchantments</p>
                            <p class="text-[10px] text-emerald-700/80 font-semibold mt-0.5"><i class="fas fa-feather-pointed text-[9px] mr-1" aria-hidden="true"></i>Boons & sparks</p>
                        </div>
                    </div>
                    <div class="flex flex-col gap-2.5 relative z-10">
                        ${activeEffects.length > 0 
                            ? activeEffects.map((e, ei) => {
                                const ring = ['border-cyan-200/70', 'border-violet-200/70', 'border-amber-200/70', 'border-rose-200/70'][ei % 4];
                                return `
                                <div class="bg-white/95 border-2 ${ring} p-3 rounded-xl flex items-center gap-3 shadow-md hover:shadow-lg transition-shadow">
                                    <div class="w-10 h-10 bg-gradient-to-br from-emerald-50 to-cyan-50 rounded-xl flex items-center justify-center text-xl shrink-0 border border-emerald-100/80 shadow-inner">${e.icon}</div>
                                    <div class="min-w-0">
                                        <p class="font-title text-indigo-950 text-sm leading-snug">${e.title}</p>
                                        <p class="text-xs text-emerald-700 font-semibold mt-0.5"><i class="fas fa-scroll text-[10px] mr-1 opacity-75" aria-hidden="true"></i>${e.body}</p>
                                    </div>
                                </div>`;
                            }).join('')
                            : `<div class="py-6 px-3 text-center text-sm text-violet-700 font-title font-normal leading-snug border-2 border-dashed border-emerald-200/60 rounded-xl bg-white/60"><i class="fas fa-moon text-emerald-400 mr-2" aria-hidden="true"></i>Your aura is calm — no active enchantments.</div>`
                        }
                    </div>
                    <div class="pt-3 mt-0.5 border-t border-emerald-100/80 relative z-10">
                        <div class="flex items-center gap-2 mb-2">
                             <p class="text-xs font-title text-violet-800 tracking-tight flex items-center gap-1.5"><i class="fas fa-gem text-amber-500 text-[11px]" aria-hidden="true"></i>Featured artifact</p>
                             <div class="flex-grow h-px bg-gradient-to-r from-amber-200/80 via-violet-200/60 to-transparent"></div>
                        </div>
                        ${featuredHtml}
                    </div>
                </div>

                <!-- Backpack Carousel Container -->
                ${backpackHtml}
            </div>
        </div>`;

        bindBackpackListeners(studentId);
        bindUseBtns(studentId, contentEl);

        ensureTrophyVaultContentDelegation(contentEl);

        const newShell = contentEl.querySelector('.treasure-vault-shell');
        if (newShell && withEnterAnim) {
            newShell.classList.add('tv-vault-shell--enter');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => newShell.classList.add('tv-vault-shell--enter-active'));
            });
        }
    };

    if (switchingStudent) {
        existingShell.classList.add('tv-vault-shell--exit');
        setTimeout(() => finishVaultShellMount(true), 235);
        return;
    }

    finishVaultShellMount(runEnterAnimation);
}

function bindBackpackListeners(studentId) {
    const prevBtn = document.getElementById('inventory-prev-btn');
    const nextBtn = document.getElementById('inventory-next-btn');
    const items = state.get('allStudentScores').find(s => s.id === studentId)?.inventory || [];

    if (prevBtn) prevBtn.onclick = () => {
        const current = inventoryCarouselIndices.get(studentId) || 0;
        if (current <= 0) return;
        trophyBackpackRollDirection = 'prev';
        inventoryCarouselIndices.set(studentId, current - 1);
        renderTrophyRoomContent(studentId, true);
    };
    if (nextBtn) nextBtn.onclick = () => {
        const current = inventoryCarouselIndices.get(studentId) || 0;
        if (items.length === 0) return;
        if (current + BACKPACK_PAGE_SIZE >= items.length) return;
        trophyBackpackRollDirection = 'next';
        inventoryCarouselIndices.set(studentId, Math.min(items.length - 1, current + 1));
        renderTrophyRoomContent(studentId, true);
    };
}

function bindUseBtns(studentId, container) {
    container.querySelectorAll('.trophy-room-use-btn').forEach(btn => {
        btn.onclick = async () => {
            const idx = parseInt(btn.dataset.itemIndex, 10);
            const original = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            try {
                const result = await handleUseItem(studentId, idx);
                if (result?.success && result.feedback) {
                    trophyRoomFeedback.set(studentId, result.feedback);
                }
                renderTrophyRoomContent(studentId);
            } catch (e) {
                btn.disabled = false;
                btn.innerHTML = original;
            }
        };
    });
}
