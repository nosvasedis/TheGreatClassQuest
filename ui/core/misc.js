// /ui/core/misc.js

import * as state from '../../state.js';
import { db, doc, updateDoc, setDoc } from '../../firebase.js';
import * as utils from '../../utils.js';
import { showToast } from '../effects.js';
import * as storyWeaver from '../../features/storyWeaver.js';
import { playSound } from '../../audio.js';
import { bountyAudienceTagHtml } from '../bountyAudienceTag.js';
import { normalizeAudience } from '../../features/bountyAudience.mjs';

function audienceTag(bounty, tone) {
    const audience = normalizeAudience(bounty);
    const names = audience.kind === 'heroes'
        ? (state.get('allStudents') || []).filter(s => audience.studentIds.includes(s.id)).map(s => s.name)
        : null;
    return bountyAudienceTagHtml(bounty, { tone, names });
}

const completingTimerBounties = new Set();

// --- GLOBAL STATE SYNC FUNCTIONS ---
export function findAndSetCurrentClass(targetSelectId = null) {
    if (state.get('globalSelectedClassId')) return;
    if (!state.get('classFollowSchedule')) return;

    const todayString = utils.getTodayDateString();
    const classEndDates = state.get('teacherSettings')?.schoolYearSettings?.classEndDates || {};
    const classesToday = utils.getClassesOnDay(todayString, state.get('allSchoolClasses'), state.get('allScheduleOverrides'), classEndDates);
    
    // FIX: Only consider classes that belong to the current teacher
    const myClassesToday = classesToday.filter(c => state.get('allTeachersClasses').some(tc => tc.id === c.id));

    const activeClass = utils.findLessonClassWithGrace(myClassesToday);
    if (activeClass) {
        state.setGlobalSelectedClass(activeClass.id);
    }
}

export function updateStudentCardAttendanceState(studentId, isAbsent) {
    const awardTab = document.getElementById('award-stars-tab');
    if (awardTab && !awardTab.classList.contains('hidden')) {
        import('../tabs.js').then((tabs) => {
            tabs.updateStudentCardAttendanceState?.(studentId, isAbsent);
        }).catch((error) => console.warn('Could not refresh award cards after attendance change:', error));
    }
}

export function confirmWord() {
    storyWeaver.confirmStoryWord();
}

export function handleWordInputChange(event) {
    if (event.target.value.trim() !== '') {
        storyWeaver.showWordEditorControls();
    } else {
        storyWeaver.hideWordEditorControls();
    }
}

export function renderHolidayList() {
    const list = document.getElementById('holiday-list');
    if (!list) return;
    const ranges = state.get('schoolHolidayRanges') || [];
    
    if (ranges.length === 0) {
        list.innerHTML = '<p class="text-center text-xs text-gray-400">No holidays set.</p>';
        return;
    }
    
    list.innerHTML = ranges.map(r => `
        <div class="flex justify-between items-center bg-gray-50 p-2 rounded border text-sm">
            <div>
                <span class="font-bold text-gray-700">${r.name}</span>
                <div class="text-xs text-gray-500">${utils.parseDDMMYYYY(utils.getDDMMYYYY(new Date(r.start))).toLocaleDateString('en-GB', {day:'numeric', month:'short'})} - ${utils.parseDDMMYYYY(utils.getDDMMYYYY(new Date(r.end))).toLocaleDateString('en-GB', {day:'numeric', month:'short'})}</div>
            </div>
            <button class="delete-holiday-btn text-red-500 hover:text-red-700" data-id="${r.id}"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}

function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// --- CLASS END DATES CONFIGURATION ---

export function renderClassEndDatesList() {
    const list = document.getElementById('class-end-dates-list');
    const saveBtn = document.getElementById('save-class-end-dates-btn');
    if (!list) return;

    const classId = state.get('globalSelectedClassId');
    const myClasses = state.get('allTeachersClasses') || [];
    const teacherSettings = state.get('teacherSettings') || {};
    const classEndDates = teacherSettings.schoolYearSettings?.classEndDates || {};

    const setSaveEnabled = (on) => {
        if (saveBtn) saveBtn.disabled = !on;
    };

    if (myClasses.length === 0) {
        setSaveEnabled(false);
        list.innerHTML = `
            <div class="ts-empty">
                <div class="ts-empty__icon" aria-hidden="true">📚</div>
                <p class="ts-empty__text">No classes on your roster yet. Add a class first, then choose it in the header.</p>
            </div>`;
        return;
    }

    if (!classId) {
        setSaveEnabled(false);
        list.innerHTML = `
            <div class="ts-empty">
                <div class="ts-empty__icon" aria-hidden="true">🎓</div>
                <p class="ts-empty__title font-title">Choose a class in the header</p>
                <p class="ts-empty__text">Then set its <strong>final lesson date</strong> here, one class at a time.</p>
            </div>`;
        return;
    }

    const cls = myClasses.find((c) => c.id === classId);
    if (!cls) {
        setSaveEnabled(false);
        list.innerHTML = `
            <div class="ts-empty ts-empty--warn">
                <div class="ts-empty__icon" aria-hidden="true">🧭</div>
                <p class="ts-empty__text">The class selected in the header isn’t in your teaching roster. Pick one of your classes from the header menu.</p>
            </div>`;
        return;
    }

    setSaveEnabled(true);

    try {
        const scheduleRaw = (cls.scheduleDays || []).map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
        const schedule = escapeHtml(scheduleRaw || '—');
        const name = escapeHtml(cls.name ?? 'Class');
        const logo = escapeHtml(cls.logo ?? '📚');
        const cid = cls.id ?? '';
        const currentEndDate = classEndDates[cid] || '';
        const suggestedDdMm = calculateSuggestedEndDate(cls.scheduleDays || []);
        const pickerValue = utils.toHtmlDateInputValue(currentEndDate);
        const suggestedPicker = utils.toHtmlDateInputValue(suggestedDdMm);
        const league = escapeHtml(cls.questLevel || '');
        const savedDate = currentEndDate ? utils.parseFlexibleDate(currentEndDate) : null;
        const savedValid = savedDate && !Number.isNaN(savedDate.getTime());
        let savedLabel = 'Not set yet';
        if (currentEndDate) {
            savedLabel = savedValid
                ? escapeHtml(savedDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }))
                : escapeHtml(String(currentEndDate));
        }

        list.innerHTML = `
            <div class="ts-finale">
                <div class="ts-leaf${savedValid ? '' : ' ts-leaf--empty'}" id="class-end-date-leaf" aria-hidden="true">
                    <span class="ts-leaf__rings"><i></i><i></i></span>
                    <span class="ts-leaf__month" data-leaf-month>${savedValid ? escapeHtml(savedDate.toLocaleDateString('en-GB', { month: 'long' })) : 'Last day'}</span>
                    <span class="ts-leaf__day font-title" data-leaf-day>${savedValid ? savedDate.getDate() : '?'}</span>
                    <span class="ts-leaf__weekday" data-leaf-weekday>${savedValid ? escapeHtml(savedDate.toLocaleDateString('en-GB', { weekday: 'long' })) : 'not set yet'}</span>
                </div>
                <div class="ts-finale__main">
                    <div class="ts-finale__class">
                        <span class="ts-finale__logo" aria-hidden="true">${logo}</span>
                        <div class="min-w-0">
                            <div class="ts-finale__name-row">
                                <h3 class="font-title ts-finale__name">${name}</h3>
                                ${league ? `<span class="ts-chip">League ${league}</span>` : ''}
                            </div>
                            <p class="ts-finale__meta"><i class="fas fa-calendar-week" aria-hidden="true"></i> ${schedule}</p>
                            <p class="ts-finale__saved"><strong>Saved end date:</strong> ${savedLabel}</p>
                        </div>
                    </div>
                    <label for="class-end-date-active" class="ts-label">Final lesson date</label>
                    <div class="ts-finale__pick">
                        <input type="date"
                            id="class-end-date-active"
                            class="ts-input"
                            value="${escapeHtml(pickerValue)}"
                            min="2020-01-01"
                            max="2035-12-31">
                        <button type="button"
                            class="class-end-date-use-suggested-btn ts-btn ts-btn--quiet"
                            data-suggested="${escapeHtml(suggestedPicker)}">
                            <i class="fas fa-wand-magic-sparkles"></i>
                            Use suggested
                        </button>
                    </div>
                    <p class="ts-help">Suggested picks the last scheduled weekday in June. Clear the date and save to remove an end date for this class.</p>
                </div>
            </div>`;
    } catch (e) {
        console.error('renderClassEndDatesList failed:', e);
        list.innerHTML = '<p class="text-center text-sm text-rose-600 py-6">Could not load class end date. Check the console for details.</p>';
        setSaveEnabled(false);
        return;
    }

    list.querySelectorAll('.class-end-date-use-suggested-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-suggested') || '';
            const input = document.getElementById('class-end-date-active');
            if (input) {
                input.value = val;
                syncClassEndDateLeaf(input.value);
            }
        });
    });
    document.getElementById('class-end-date-active')?.addEventListener('input', (event) => {
        syncClassEndDateLeaf(event.target.value);
    });
}

// The calendar leaf beside the picker shows whatever date is currently picked.
function syncClassEndDateLeaf(value) {
    const leaf = document.getElementById('class-end-date-leaf');
    if (!leaf) return;
    const date = value ? new Date(`${value}T12:00:00`) : null;
    const valid = date && !Number.isNaN(date.getTime());
    leaf.classList.toggle('ts-leaf--empty', !valid);
    leaf.querySelector('[data-leaf-month]').textContent = valid ? date.toLocaleDateString('en-GB', { month: 'long' }) : 'Last day';
    leaf.querySelector('[data-leaf-day]').textContent = valid ? String(date.getDate()) : '?';
    leaf.querySelector('[data-leaf-weekday]').textContent = valid ? date.toLocaleDateString('en-GB', { weekday: 'long' }) : 'not set yet';
}

/**
 * Calculate suggested end date for a class based on schedule
 */
function calculateSuggestedEndDate(scheduleDays) {
    const configuredEnd = state.getActiveSchoolYearEndDate();
    if (!configuredEnd) return '';
    const targetMonth = configuredEnd.getMonth();
    const targetYear = configuredEnd.getFullYear();
    const lastDay = new Date(targetYear, targetMonth + 1, 0); // Last day of June
    const scheduleDaysArray = scheduleDays.map(Number).sort();

    // Work backwards from last day of month to find last scheduled day
    for (let d = lastDay.getDate(); d >= 1; d--) {
        const checkDate = new Date(targetYear, targetMonth, d);
        const dayOfWeek = checkDate.getDay().toString();

        if (scheduleDaysArray.includes(dayOfWeek)) {
            return utils.getDDMMYYYY(checkDate);
        }
    }

    return utils.getDDMMYYYY(lastDay); // Fallback to last day of June
}

/**
 * Save class end dates to teacher settings
 */
export async function saveClassEndDates() {
    const teacherId = state.get('currentUserId');
    if (!teacherId) {
        showToast('Error: Teacher not found', 'error');
        return;
    }

    const classId = state.get('globalSelectedClassId');
    if (!classId) {
        showToast('Choose a class from the header first.', 'info');
        return;
    }

    const myClasses = state.get('allTeachersClasses') || [];
    if (!myClasses.some((c) => c.id === classId)) {
        showToast('Selected class is not in your roster.', 'error');
        return;
    }

    const input = document.getElementById('class-end-date-active');
    const currentSettings = state.get('teacherSettings') || {};
    const prevAll = { ...(currentSettings.schoolYearSettings?.classEndDates || {}) };
    const classEndDates = { ...prevAll };

    if (input?.value) {
        const canon = utils.normalizeToDateString(input.value);
        if (canon) classEndDates[classId] = canon;
        else {
            showToast('Invalid date', 'error');
            return;
        }
    } else {
        delete classEndDates[classId];
    }

    try {
        const teacherRef = doc(db, 'artifacts/great-class-quest/public/data/teachers', teacherId);
        await setDoc(teacherRef, {
            schoolYearSettings: { classEndDates }
        }, { merge: true });

        const updatedSettings = {
            ...currentSettings,
            schoolYearSettings: {
                ...currentSettings.schoolYearSettings,
                classEndDates
            }
        };
        state.setTeacherSettings(updatedSettings);

        const { updateCeremonyButtons } = await import('../../features/grandGuildCeremony.js');
        updateCeremonyButtons();

        renderClassEndDatesList();

        showToast(input?.value ? 'Class end date saved.' : 'End date cleared for this class.', 'success');
    } catch (error) {
        console.error('Error saving class end dates:', error);
        showToast('Error saving class end date', 'error');
    }
}

// --- BOUNTY LOGIC ---

function getTimerToneMeta(deadline) {
    const tone = utils.getCountdownTone(deadline);
    if (tone === 'critical') {
        return {
            tone,
            shellClass: 'from-rose-600 via-red-500 to-orange-400 border-rose-200/80 shadow-[0_20px_45px_rgba(225,29,72,0.28)]',
            badgeClass: 'bg-white/18 text-rose-50 border border-white/20',
            timerClass: 'text-white drop-shadow-[0_4px_14px_rgba(255,255,255,0.3)]',
            icon: 'fa-fire'
        };
    }
    if (tone === 'warning') {
        return {
            tone,
            shellClass: 'from-amber-500 via-orange-400 to-rose-400 border-amber-100/80 shadow-[0_20px_45px_rgba(251,146,60,0.24)]',
            badgeClass: 'bg-white/18 text-amber-50 border border-white/20',
            timerClass: 'text-white',
            icon: 'fa-hourglass-half'
        };
    }
    return {
        tone,
        shellClass: 'from-sky-600 via-indigo-500 to-violet-500 border-sky-100/80 shadow-[0_20px_45px_rgba(79,70,229,0.24)]',
        badgeClass: 'bg-white/18 text-sky-50 border border-white/20',
        timerClass: 'text-white',
        icon: 'fa-clock'
    };
}

function renderTimerBountyCard(bounty) {
    const tone = getTimerToneMeta(bounty.deadline);
    return `
        <div class="bounty-card bounty-card--timer-live mb-4 overflow-hidden rounded-[28px] border bg-gradient-to-br ${tone.shellClass} p-5 text-white" data-bounty-timer-card data-bounty-id="${bounty.id}" data-deadline="${bounty.deadline}" data-bounty-tone="${tone.tone}">
            <div class="flex items-start justify-between gap-4">
                <div class="flex min-w-0 items-center gap-4">
                    <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl shadow-inner shadow-white/10">
                        <i class="fas ${tone.icon}"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                            <div class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] ${tone.badgeClass}">
                                Timed Quest
                            </div>
                            ${audienceTag(bounty, 'dark')}
                        </div>
                        <h4 class="mt-3 truncate font-title text-2xl leading-tight">${bounty.title}</h4>
                        <p class="mt-1 text-sm font-semibold text-white/75">Race the clock before this challenge fades.</p>
                    </div>
                </div>
                <button class="delete-bounty-btn rounded-full bg-black/15 px-3 py-2 text-white/70 transition hover:bg-black/25 hover:text-white" data-id="${bounty.id}" title="Cancel Timer">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="mt-5 flex items-end justify-between gap-4 rounded-[22px] bg-black/15 px-4 py-3 backdrop-blur-sm">
                <div>
                    <div class="text-[10px] font-black uppercase tracking-[0.28em] text-white/60">Time Remaining</div>
                    <span class="bounty-timer mt-2 block font-title text-4xl leading-none ${tone.timerClass}" data-bounty-timer-value data-deadline="${bounty.deadline}">${utils.formatCountdownClock(bounty.deadline, { expiredLabel: '00:00:00' })}</span>
                </div>
                <div class="text-right text-xs font-bold uppercase tracking-[0.2em] text-white/65">
                    <div>Urgency</div>
                    <div class="mt-2 text-lg tracking-normal text-white" data-bounty-timer-status>${utils.formatCountdownCompact(bounty.deadline, 'Expired')}</div>
                </div>
            </div>
        </div>`;
}

function renderStarBountyCard(bounty) {
    const progressPercent = Math.min(100, (bounty.currentProgress / bounty.target) * 100);
    const isReady = bounty.currentProgress >= bounty.target;
    const actionBtn = isReady
        ? `<button class="claim-bounty-btn rounded-full bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-emerald-500/30 transition hover:scale-105" data-id="${bounty.id}" data-reward="${bounty.reward}">Claim</button>`
        : `<span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-700">${bounty.currentProgress}/${bounty.target} Stars</span>`;

    return `
        <div class="bounty-card mb-4 overflow-hidden rounded-[28px] border border-amber-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(255,251,235,0.98)_48%,_rgba(254,243,199,0.96))] p-4 shadow-[0_18px_40px_rgba(251,191,36,0.16)]">
            <div class="flex items-start gap-4">
                <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-yellow-300 to-orange-300 text-3xl text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_18px_rgba(245,158,11,0.22)]">
                    <i class="fas fa-stars"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <div class="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-amber-700">Star Bounty</div>
                                ${audienceTag(bounty, 'light')}
                            </div>
                            <h4 class="mt-3 truncate font-title text-2xl leading-tight text-slate-800">${bounty.title}</h4>
                        </div>
                        <button class="delete-bounty-btn rounded-full bg-slate-200/70 px-3 py-2 text-slate-500 transition hover:bg-red-50 hover:text-red-500" data-id="${bounty.id}" title="Delete Bounty">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="mt-4 overflow-hidden rounded-full bg-slate-200">
                        <div class="h-3 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 transition-all duration-1000" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="mt-3 flex items-center justify-between gap-3">
                        <p class="text-sm font-bold text-slate-500">Reward: <span class="text-slate-700">${bounty.reward}</span></p>
                        ${actionBtn}
                    </div>
                </div>
            </div>
        </div>`;
}

export function renderActiveBounties() {
    const container = document.getElementById('bounty-board-container');
    if (!container) return;

    const classId = state.get('globalSelectedClassId');
    if (!classId) {
        container.innerHTML = '';
        return;
    }

    const bounties = state.get('allQuestBounties')
        .filter(b => b.classId === classId && b.status !== 'completed') // Hide completed ones to keep board clean
        .sort((a,b) => new Date(a.deadline) - new Date(b.deadline));

    if (bounties.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = bounties.map(b => {
        const isTimer = b.type === 'timer';
        
        // --- TIMER RENDER ---
        if (isTimer) {
            return renderTimerBountyCard(b);
        }

        // --- STANDARD STAR RENDER ---
        const progressPercent = Math.min(100, (b.currentProgress / b.target) * 100);
        const isReady = b.currentProgress >= b.target;
        let actionBtn = isReady 
            ? `<button class="claim-bounty-btn bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-bounce shadow-md" data-id="${b.id}" data-reward="${b.reward}">CLAIM</button>`
            : `<span class="text-xs font-bold text-amber-500">${b.currentProgress}/${b.target} ⭐</span>`;

        return `
            <div class="bounty-card mb-3 bg-gradient-to-r from-amber-50 to-white border-l-4 border-amber-400 shadow-sm p-3 flex items-center gap-3">
                <div class="text-2xl text-amber-500">🎯</div>
                <div class="flex-grow min-w-0">
                    <div class="flex justify-between items-center mb-1">
                        <h4 class="font-bold text-gray-800 truncate">${b.title}</h4>
                        ${actionBtn}
                    </div>
                    <div class="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div class="bg-amber-500 h-full transition-all duration-1000" style="width: ${progressPercent}%"></div>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">Reward: ${b.reward}</p>
                </div>
                <button class="delete-bounty-btn text-gray-300 hover:text-red-500" data-id="${b.id}"><i class="fas fa-times"></i></button>
            </div>
        `;
    }).join('');
    
    startBountyTimer(); // Ensure the interval runs
}

let bountyInterval;
function startBountyTimer() {
    if (bountyInterval) clearInterval(bountyInterval);
    
    const update = () => {
        const timerCards = document.querySelectorAll('[data-bounty-timer-card]');
        if (timerCards.length === 0) {
            clearInterval(bountyInterval);
            bountyInterval = null;
            return;
        }

        for (const card of timerCards) {
            const deadline = card.dataset.deadline;
            const parts = utils.getCountdownParts(deadline);
            const tone = utils.getCountdownTone(deadline);
            const valueEl = card.querySelector('[data-bounty-timer-value]');
            const statusEl = card.querySelector('[data-bounty-timer-status]');

            if (valueEl) {
                valueEl.innerText = utils.formatCountdownClock(deadline, { expiredLabel: '00:00:00' });
            }
            if (statusEl) {
                statusEl.innerText = utils.formatCountdownCompact(deadline, 'Expired');
            }

            if (!parts.expired && card.dataset.bountyTone !== tone) {
                renderActiveBounties();
                return;
            }

            if (parts.expired) {
                card.classList.add('bounty-card--timer-exit');
                const bountyId = card.dataset.bountyId;
                if (!document.body.classList.contains('projector-mode') && bountyId && !completingTimerBounties.has(bountyId)) {
                    completingTimerBounties.add(bountyId);
                    window.setTimeout(async () => {
                        try {
                            await updateDoc(doc(db, 'artifacts/great-class-quest/public/data/quest_bounties', bountyId), { status: 'completed' });
                            playSound('magic_chime');
                        } catch (error) {
                            console.error('Error completing expired timer bounty:', error);
                        } finally {
                            completingTimerBounties.delete(bountyId);
                        }
                    }, 380);
                }
            }
        }
    };
    
    update();
    bountyInterval = setInterval(update, 1000);
}
