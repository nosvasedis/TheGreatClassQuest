// /features/scholarScroll.js
let loadedHistoricalScores = [];
let historySortDateDir = 'desc';   // 'desc' = newest first, 'asc' = oldest first
let historySortStudentBy = 'name'; // 'name' | 'name-desc' | 'score-desc' | 'score-asc'

/** Last class id used to render Scholar's Scroll (for swap animations on header class change). */
let lastRenderedScrollClassId = null;

/** Cleanup function for the bulk-trial custom date picker outside-click handler. */
let _dpOutsideClickHandler = null;

function scrollMotionReduced() {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Stats + performance chart only (class-swap animation applies here). */
function getScrollDashboardHost() {
    return document.getElementById('scroll-dashboard-inner') || document.getElementById('scroll-dashboard-content');
}

/** Pending grading, makeups, upcoming-test ribbon — stays visually separate from the chart “stage”. */
function getScrollQueuesHost() {
    return document.getElementById('scroll-dashboard-queues') || document.getElementById('scroll-dashboard-content');
}

function setScrollPanelStack(showDashboard) {
    const dash = document.getElementById('scroll-dashboard-content');
    const ph = document.getElementById('scroll-placeholder');
    if (!dash || !ph) return;

    dash.classList.remove('hidden');
    ph.classList.remove('hidden');

    if (!dash.classList.contains('scroll-panel')) dash.classList.add('scroll-panel');
    if (!ph.classList.contains('scroll-panel')) ph.classList.add('scroll-panel');

    const on = Boolean(showDashboard);
    dash.classList.toggle('scroll-panel--fg', on);
    dash.classList.toggle('scroll-panel--bg', !on);
    ph.classList.toggle('scroll-panel--fg', !on);
    ph.classList.toggle('scroll-panel--bg', on);

    dash.setAttribute('aria-hidden', on ? 'false' : 'true');
    ph.setAttribute('aria-hidden', on ? 'true' : 'false');
}

function waitForAnimation(el, animName, fallbackMs) {
    return new Promise((resolve) => {
        if (!el || scrollMotionReduced()) {
            resolve();
            return;
        }
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            el.removeEventListener('animationend', onEnd);
            resolve();
        };
        const onEnd = (e) => {
            if (e.target === el && e.animationName === animName) finish();
        };
        el.addEventListener('animationend', onEnd);
        setTimeout(finish, fallbackMs);
    });
}

function bumpInnerReflow(inner) {
    if (inner) void inner.offsetWidth;
}

async function playInnerEnter(inner) {
    if (!inner || scrollMotionReduced()) return;
    inner.classList.remove('scroll-dashboard-inner--swap-out');
    inner.classList.add('scroll-dashboard-inner--swap-in');
    await waitForAnimation(inner, 'scroll-dash-inner-swap-in', 560);
    inner.classList.remove('scroll-dashboard-inner--swap-in');
}

async function playInnerClassSwap(inner, runRender) {
    if (!inner || scrollMotionReduced()) {
        runRender();
        return;
    }
    inner.classList.remove('scroll-dashboard-inner--swap-in');
    inner.classList.add('scroll-dashboard-inner--swap-out');
    await waitForAnimation(inner, 'scroll-dash-inner-swap-out', 400);
    runRender();
    inner.classList.remove('scroll-dashboard-inner--swap-out');
    bumpInnerReflow(inner);
    inner.classList.add('scroll-dashboard-inner--swap-in');
    await waitForAnimation(inner, 'scroll-dash-inner-swap-in', 560);
    inner.classList.remove('scroll-dashboard-inner--swap-in');
}

// --- IMPORTS ---
import { db, doc, addDoc, updateDoc, collection, serverTimestamp, writeBatch, runTransaction } from '../firebase.js';

import * as state from '../state.js';
import * as utils from '../utils.js';
import { showToast } from '../ui/effects.js';
import { playSound } from '../audio.js';
import * as modals from '../ui/modals.js';
import { wrapAvatarWithLevelUpIndicator } from '../ui/core/avatar.js';
import { HERO_CLASSES } from '../features/heroClasses.js';
import {
    getAssessmentAverage,
    getAssessmentSchemeForClass,
    getAssessmentValueLabel,
    getClassAssessmentUsage,
    getNearestQualitativeLabel,
    getNormalizedPercentForScore,
    getScheduledAssessmentStatus,
    getScheduledAssignmentForClassOnDate,
    getStudentsAwaitingGradeForScheduledStatus,
    classUsesTests,
    isAssessmentSchemeEnabled,
    normalizeAssessmentScheme,
    getUpcomingScheduledAssessment,
    getWeightedAcademicAverage,
    listScheduledAssessmentsNeedingGrades
} from './assessmentConfig.js';
import {
    trialDateLabel,
    trialRowHtml,
    trialScaleLegendHtml,
    trialTipHtml,
    trialTally,
    trialTallyText,
    numericBandFor
} from './trialLogCore.mjs';

function formatYmdFromAnyDateString(dateStr) {
    const d = utils.parseFlexibleDate(dateStr);
    const target = d || new Date();
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function pickBulkTestLogContext(classId) {
    const todayStr = utils.getTodayDateString();
    const incompletes = listScheduledAssessmentsNeedingGrades(classId);

    const urgent = incompletes.filter((s) => s.phase === 'missed' || s.phase === 'window_passed');
    urgent.sort((a, b) => a.dayDiff - b.dayDiff);

    if (urgent.length > 0) {
        const s = urgent[0];
        return {
            initialDate: formatYmdFromAnyDateString(s.testData.date),
            suggestedTitle: String(s.testData.title || '').trim(),
            status: s
        };
    }

    const todayIncomplete = incompletes.find((s) => utils.datesMatch(s.testData.date, todayStr));
    if (todayIncomplete) {
        return {
            initialDate: todayStr,
            suggestedTitle: String(todayIncomplete.testData.title || '').trim(),
            status: todayIncomplete
        };
    }

    const todayAssignment = getScheduledAssignmentForClassOnDate(classId, todayStr);
    if (todayAssignment?.testData) {
        const st = getScheduledAssessmentStatus(todayAssignment);
        return {
            initialDate: todayStr,
            suggestedTitle: String(todayAssignment.testData.title || '').trim(),
            status: st
        };
    }

    return {
        initialDate: todayStr,
        suggestedTitle: '',
        status: null
    };
}

function refreshBulkTrialScheduledHint(classId, type, dateVal) {
    // Badge removed — it was noisy and unhelpful during test entry.
    const hintEl = document.getElementById('bulk-trial-scheduled-hint');
    if (hintEl) hintEl.classList.add('hidden');
}

const TRIAL_SAVE_IDLE_HTML = '<i class="fas fa-stamp" aria-hidden="true"></i> Save results';

function todayIsoDate() {
    return formatYmdFromAnyDateString(utils.getTodayDateString());
}

function setTrialDateDisplay(isoDate) {
    const el = document.getElementById('bulk-trial-date-display');
    if (el) el.textContent = trialDateLabel(isoDate, todayIsoDate());
}

/** Reads what the teacher has put on the sheet so far, keyed by student id. */
function readTrialSheet() {
    const marks = new Map();
    document.querySelectorAll('#bulk-student-list .bulk-log-item').forEach((row) => {
        const input = row.querySelector('.bulk-grade-input');
        marks.set(row.dataset.studentId, {
            value: input ? input.value : '',
            absent: !!row.querySelector('.toggle-absent-btn')?.classList.contains('is-absent')
        });
    });
    return marks;
}

function updateTrialTally() {
    const rows = [...document.querySelectorAll('#bulk-student-list .bulk-log-item')];
    const tally = trialTally(rows.map((row) => ({
        absent: !!row.querySelector('.toggle-absent-btn')?.classList.contains('is-absent'),
        value: row.querySelector('.bulk-grade-input')?.value ?? ''
    })));
    const text = document.getElementById('bulk-trial-tally');
    const fill = document.getElementById('bulk-trial-tally-fill');
    if (text) text.textContent = rows.length ? trialTallyText(tally) : '';
    if (fill) fill.style.width = tally.present ? `${Math.round((tally.graded / tally.present) * 100)}%` : '0%';
    const saveBtn = document.getElementById('bulk-trial-save-btn');
    if (saveBtn) saveBtn.classList.toggle('is-ready', tally.graded > 0 && tally.graded === tally.present);
}

function setRowAbsent(row, isAbsent) {
    const btn = row.querySelector('.toggle-absent-btn');
    const input = row.querySelector('.bulk-grade-input');
    btn?.classList.toggle('is-absent', isAbsent);
    if (btn && !btn.classList.contains('hidden')) {
        btn.setAttribute('aria-pressed', isAbsent ? 'true' : 'false');
        btn.title = isAbsent ? 'Mark present' : 'Mark absent';
        btn.innerHTML = isAbsent
            ? '<i class="fas fa-user-slash" aria-hidden="true"></i><span>Absent</span>'
            : '<i class="fas fa-user-check" aria-hidden="true"></i><span>Present</span>';
    }
    row.classList.toggle('absent', isAbsent);
    row.querySelectorAll('.tl-stamp').forEach((stamp) => {
        stamp.disabled = isAbsent;
        if (isAbsent) {
            stamp.classList.remove('active');
            stamp.setAttribute('aria-pressed', 'false');
        }
    });
    if (input) {
        if (input.type !== 'hidden') input.disabled = isAbsent;
        if (isAbsent) {
            input.value = '';
            input.removeAttribute('data-grade');
            row.classList.remove('is-graded');
        }
    }
}

/** One set of delegated handlers for the whole sheet (re-assigned, never stacked). */
function wireTrialSheet(listContainer) {
    listContainer.onclick = (e) => {
        const attend = e.target.closest('.toggle-absent-btn');
        if (attend && listContainer.contains(attend)) {
            const row = attend.closest('.bulk-log-item');
            setRowAbsent(row, !attend.classList.contains('is-absent'));
            updateTrialTally();
            return;
        }
        const stamp = e.target.closest('.tl-stamp');
        if (stamp && !stamp.disabled) {
            const row = stamp.closest('.bulk-log-item');
            const input = row.querySelector('.bulk-grade-input');
            const wasActive = stamp.classList.contains('active');
            row.querySelectorAll('.tl-stamp').forEach((b) => {
                b.classList.remove('active', 'just-stamped');
                b.setAttribute('aria-pressed', 'false');
            });
            if (wasActive) {
                input.value = '';
            } else {
                input.value = stamp.dataset.value;
                stamp.classList.add('active', 'just-stamped');
                stamp.setAttribute('aria-pressed', 'true');
            }
            row.classList.toggle('is-graded', !!input.value);
            updateTrialTally();
        }
    };
    listContainer.oninput = (e) => {
        const input = e.target.closest('.bulk-grade-numeric');
        if (!input) return;
        const band = numericBandFor(input.value, input.max);
        if (band) input.setAttribute('data-grade', band);
        else input.removeAttribute('data-grade');
        input.closest('.bulk-log-item')?.classList.toggle('is-graded', input.value !== '');
        updateTrialTally();
    };
    listContainer.onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        const input = e.target.closest('.bulk-grade-numeric');
        if (!input) return;
        e.preventDefault();
        const inputs = [...listContainer.querySelectorAll('.bulk-grade-numeric:not(:disabled)')];
        const next = inputs[inputs.indexOf(input) + 1];
        if (next) {
            next.focus();
            next.select();
        } else {
            document.getElementById('bulk-trial-save-btn')?.focus();
        }
    };
    listContainer.onwheel = (e) => {
        if (e.target.closest('.bulk-grade-numeric') === document.activeElement) document.activeElement.blur();
    };
}

function populateBulkTrialStudentRows(classId, type, assessmentScheme, dateIso, carry = null) {
    const students = state.get('allStudents').filter((s) => s.classId === classId).sort((a, b) => a.name.localeCompare(b.name));
    const listContainer = document.getElementById('bulk-student-list');

    if (students.length === 0) {
        listContainer.innerHTML = `
            <div class="tl-empty">
                <div class="tl-empty__icon">🧭</div>
                <p class="tl-empty__title font-title">No students yet</p>
                <p class="tl-empty__text">Add students to this class to start logging trials.</p>
            </div>
        `;
        updateTrialTally();
        return;
    }

    const attendance = state.get('allAttendanceRecords').filter((r) => r.classId === classId && utils.datesMatch(r.date, dateIso));

    listContainer.innerHTML = students.map((student) => {
        const wasAbsent = attendance.some((r) => r.studentId === student.id);
        const kept = carry?.marks?.get(student.id);
        const isAbsent = carry?.keepAbsences && kept ? kept.absent : wasAbsent;
        const value = !isAbsent && carry?.keepValues && kept ? kept.value : '';
        return trialRowHtml({ student, scheme: assessmentScheme, isAbsent, wasAbsent, value });
    }).join('');

    wireTrialSheet(listContainer);
    updateTrialTally();
}

function rememberTrialType(classId, type) {
    try { localStorage.setItem(`gcq-trial-type-${classId}`, type); } catch (_) { /* private mode */ }
}

function recallTrialType(classId) {
    try { return localStorage.getItem(`gcq-trial-type-${classId}`); } catch (_) { return null; }
}

/** Resets the parts of the board that edit/makeup mode change. */
function resetTrialBoard({ tabsFor = null, scheme = null } = {}) {
    const board = document.getElementById('bulk-trial-shell');
    const tabs = document.getElementById('bulk-trial-type-switch');
    if (tabs) {
        tabs.classList.toggle('hidden', !tabsFor);
        tabs.querySelectorAll('.tl-tab').forEach((tab) => {
            const on = tab.dataset.trialType === tabsFor;
            tab.classList.toggle('is-active', on);
            tab.setAttribute('aria-selected', on ? 'true' : 'false');
        });
    }
    board?.classList.toggle('tl-board--tabbed', !!tabsFor);
    const legend = document.getElementById('bulk-trial-legend');
    if (legend) legend.innerHTML = trialScaleLegendHtml(scheme);
    const tip = document.getElementById('bulk-trial-tip-default');
    if (tip) tip.innerHTML = trialTipHtml(scheme);
    const saveBtn = document.getElementById('bulk-trial-save-btn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = TRIAL_SAVE_IDLE_HTML;
        saveBtn.dataset.idleHtml = TRIAL_SAVE_IDLE_HTML;
    }
    document.getElementById('bulk-trial-tip-default')?.classList.remove('hidden');
}

// --- TAB RENDERING ---

export async function renderScholarsScrollTab(selectedClassId = null, opts = {}) {
    const subtleReenter = opts.subtleReenter === true;
    const logTrialFab = document.getElementById('log-trial-fab');
    const viewHistoryFab = document.getElementById('view-trial-history-fab');

    const currentVal = selectedClassId || state.get('globalSelectedClassId');
    const inner = document.getElementById('scroll-dashboard-inner');

    if (currentVal) {
        const classData = state.get('allSchoolClasses').find((c) => c.id === currentVal)
            || state.get('allTeachersClasses').find((c) => c.id === currentVal);
        const usage = getClassAssessmentUsage(classData);
        const hasScores = (state.get('allWrittenScores') || []).some((score) => score.classId === currentVal);
        if (logTrialFab) {
            logTrialFab.disabled = !usage.any;
            logTrialFab.title = usage.any ? 'Log a test or dictation' : 'This class does not use tests or dictations';
        }
        if (viewHistoryFab) {
            viewHistoryFab.disabled = !usage.any && !hasScores;
            viewHistoryFab.title = (!usage.any && !hasScores) ? 'This class does not use tests or dictations' : 'View History';
        }

        const prevRendered = lastRenderedScrollClassId;
        const classChanged = prevRendered != null && prevRendered !== currentVal;
        const firstDashboardShow = prevRendered == null && currentVal != null;

        lastRenderedScrollClassId = currentVal;
        setScrollPanelStack(true);

        const runRender = () => {
            renderMissingWorkDashboard(currentVal);
            renderScrollDashboard(currentVal);
        };

        if (classChanged) {
            await playInnerClassSwap(inner, runRender);
        } else {
            runRender();
            if (firstDashboardShow || subtleReenter) await playInnerEnter(inner);
        }
    } else {
        lastRenderedScrollClassId = null;
        inner?.classList.remove('scroll-dashboard-inner--swap-in', 'scroll-dashboard-inner--swap-out');

        if (logTrialFab) logTrialFab.disabled = true;
        if (viewHistoryFab) viewHistoryFab.disabled = true;

        setScrollPanelStack(false);
    }
}

function renderScrollDashboard(classId) {
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    threeMonthsAgo.setDate(1); // Start from the beginning of that month

    const scoresForClass = state.get('allWrittenScores').filter(s => {
        if (s.classId !== classId || !s.date) return false;
        const scoreDate = utils.parseFlexibleDate(s.date);
        return scoreDate >= threeMonthsAgo;
    });
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const testScheme = getAssessmentSchemeForClass(classData, 'test');
    const dictationScheme = getAssessmentSchemeForClass(classData, 'dictation');

    const statsContainer = document.getElementById('scroll-stats-cards');
    // --- NEW: Upcoming Test Indicator (with queues / makeups — not the chart block) ---
    const queuesHost = getScrollQueuesHost();
    let testAlert = document.getElementById('scroll-test-alert');
    if (testAlert) testAlert.remove(); // Clear previous to prevent duplicates

    const upcomingTest = classUsesTests(classData) ? getUpcomingScheduledAssessment(classId) : null;

    if (upcomingTest) {
        const toneClasses = {
            red: { bg: 'from-red-50 to-white', border: 'border-red-500', heading: 'text-red-800', body: 'text-red-600', icon: 'text-red-200' },
            rose: { bg: 'from-rose-50 to-white', border: 'border-rose-500', heading: 'text-rose-800', body: 'text-rose-600', icon: 'text-rose-200' },
            orange: { bg: 'from-amber-50 to-white', border: 'border-amber-500', heading: 'text-amber-800', body: 'text-amber-700', icon: 'text-amber-200' },
            emerald: { bg: 'from-emerald-50 to-white', border: 'border-emerald-500', heading: 'text-emerald-800', body: 'text-emerald-700', icon: 'text-emerald-200' },
            slate: { bg: 'from-slate-50 to-white', border: 'border-slate-400', heading: 'text-slate-800', body: 'text-slate-600', icon: 'text-slate-200' },
            amber: { bg: 'from-amber-50 to-white', border: 'border-amber-500', heading: 'text-amber-800', body: 'text-amber-700', icon: 'text-amber-200' }
        };
        const palette = toneClasses[upcomingTest.tone] || toneClasses.amber;
        testAlert = document.createElement('div');
        testAlert.id = 'scroll-test-alert';
        testAlert.className = `mb-4 bg-gradient-to-r ${palette.bg} ${palette.border} border-l-4 p-4 rounded-r-2xl shadow-sm flex items-center justify-between gap-4`;
        testAlert.innerHTML = `
            <div>
                <div class="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${palette.body}">
                    <i class="fas fa-${upcomingTest.icon}"></i>
                    <span>${upcomingTest.statusLabel}</span>
                </div>
                <h4 class="font-bold ${palette.heading} text-lg flex items-center gap-2 mt-3">
                    <i class="fas fa-file-alt"></i> ${upcomingTest.testData.title}
                </h4>
                <p class="text-sm ${palette.body} ml-6">
                    <span class="font-semibold">${upcomingTest.detailLabel}</span>
                    <span class="ml-1">• ${upcomingTest.chipLabel}</span>
                    ${upcomingTest.phase === 'missed'
        ? `<span class="block mt-2 text-xs font-semibold opacity-95">Matched to <strong class="font-black">Schedule a Test</strong> on the Quest Board — log results for everyone who wrote so Pending Makeups stay accurate.</span>`
        : (upcomingTest.phase === 'window_passed'
            ? `<span class="block mt-2 text-xs font-semibold opacity-95">Lesson window ended — capture grades while memory is fresh. Title &amp; date below stay tied to what you advertised.</span>`
            : '')}
                    ${upcomingTest.testData.curriculum ? `<br><span class="text-gray-500 text-xs mt-1 block">Topics: ${upcomingTest.testData.curriculum}</span>` : ''}
                </p>
            </div>
            <div class="text-3xl ${palette.icon}"><i class="fas fa-${upcomingTest.icon}"></i></div>
        `;
        // Ribbon sits with other scroll alerts above the performance chart
        queuesHost.prepend(testAlert);
    }
    const chartContainer = document.getElementById('scroll-performance-chart');

    const testScores = scoresForClass.filter(s => s.type === 'test');
    const dictationScores = scoresForClass.filter(s => s.type === 'dictation');

    const testsByStudentId = new Map();
    const dictationsByStudentId = new Map();
    for (const s of scoresForClass) {
        if (s.type === 'test') {
            if (!testsByStudentId.has(s.studentId)) testsByStudentId.set(s.studentId, []);
            testsByStudentId.get(s.studentId).push(s);
        } else if (s.type === 'dictation') {
            if (!dictationsByStudentId.has(s.studentId)) dictationsByStudentId.set(s.studentId, []);
            dictationsByStudentId.get(s.studentId).push(s);
        }
    }
    const scoreMetaByStudentId = new Map(
        (state.get('allStudentScores') || []).map(sc => [sc.id, sc])
    );

    // --- Calculate Averages ---
    const testAvg = getAssessmentAverage(testScores, classData);
    const dictationAvg = getAssessmentAverage(dictationScores, classData);
    const avgDictationDisplay = dictationAvg === null
        ? '--'
        : (dictationScheme.mode === 'qualitative'
            ? `${getNearestQualitativeLabel(dictationScheme, dictationAvg)} (${dictationAvg.toFixed(0)}%)`
            : `${dictationAvg.toFixed(0)}%`);

    let topScholars = [];
    if (studentsInClass.length > 0 && scoresForClass.length > 0) {
        const studentAverages = studentsInClass.map(student => {
            const studentTestScores = testsByStudentId.get(student.id) || [];
            const studentDictationScores = dictationsByStudentId.get(student.id) || [];
            if (studentTestScores.length === 0 && studentDictationScores.length === 0) return null;

            const avg = getWeightedAcademicAverage(studentTestScores, studentDictationScores, classData);
            if (!Number.isFinite(avg)) return null;

            return { name: student.name, avg };
        }).filter(Boolean);

        if (studentAverages.length > 0) {
            const maxAvg = Math.max(...studentAverages.map(s => s.avg));
            topScholars = studentAverages.filter(s => s.avg === maxAvg);
        }
    }
    // Stat cards deprecated - removed as per v2 cleanup

    const studentPerformanceData = studentsInClass.map(student => {
        const studentTestScores = testsByStudentId.get(student.id) || [];
        const studentDictationScores = dictationsByStudentId.get(student.id) || [];

        const avg = getWeightedAcademicAverage(studentTestScores, studentDictationScores, classData);
        const performance = (studentTestScores.length > 0 || studentDictationScores.length > 0) && Number.isFinite(avg)
            ? { value: avg, display: `${avg.toFixed(1)}%` }
            : { value: 0, display: '--' };
        return { student, performance };
    }).sort((a, b) => b.performance.value - a.performance.value);

    // Render Performance Chart
    const usage = getClassAssessmentUsage(classData);
    if (!usage.any) {
        chartContainer.innerHTML = `<p class="text-center text-gray-400 p-8">This class does not use tests or dictations. The secretary can turn them on in Grading.</p>`;
    } else if (studentPerformanceData.length === 0 || studentPerformanceData.every(d => d.performance.value === 0)) {
        chartContainer.innerHTML = `<p class="text-center text-gray-400 p-8">${usage.tests && usage.dictations ? 'Log some trials' : (usage.tests ? 'Log a test' : 'Log a dictation')} to see the performance chart!</p>`;
    } else {
        chartContainer.innerHTML = `<div class="performance-chart-container">${studentPerformanceData.map(({ student, performance }, rowIndex) => {
            const scoreData = scoreMetaByStudentId.get(student.id);
            const pendingSkill = !!scoreData?.pendingSkillChoice;
            const avatarInner = student.avatar
                ? `<img src="${student.avatar}" alt="${student.name}" loading="lazy" decoding="async" class="student-avatar enlargeable-avatar" data-student-id="${student.id}">`
                : `<div class="student-avatar enlargeable-avatar flex items-center justify-center bg-gray-300 text-gray-600 font-bold" data-student-id="${student.id}">${student.name.charAt(0)}</div>`;
            const avatarHtml = wrapAvatarWithLevelUpIndicator(avatarInner, pendingSkill);

            const percentage = performance.value;
            let tier = 'low';
            if (percentage >= 80) tier = 'high';
            else if (percentage >= 50) tier = 'mid';

            return `
    <div class="chart-row" data-score-tier="${tier}" style="--chart-stagger: ${rowIndex * 0.02}s">
        <div class="chart-avatar-wrapper">
            ${avatarHtml}
        </div>
        <button type="button"
            class="chart-label chart-label-button cursor-pointer"
            data-student-id="${student.id}"
            aria-label="Open analytics for ${student.name}">
            ${student.heroClass && HERO_CLASSES[student.heroClass] ? HERO_CLASSES[student.heroClass].icon : ''} ${student.name}
        </button>
        <div class="chart-bar-wrapper">
            <div class="chart-bar" data-score-tier="${tier}" style="width: ${percentage}%;">
                <span>${performance.display}</span>
            </div>
        </div>
    </div>
`;
        }).join('')}</div>`;
    }
}

// --- NEW MODAL LOGIC ---

/** Log New Trial: one marking board; a Dictation / Test tab pair when the class uses both. */
export function openTrialTypeModal(classId) {
    if (!classId) return;
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    if (!classData) return;
    const usage = getClassAssessmentUsage(classData);
    if (!usage.any) {
        showToast('This class does not use tests or dictations.', 'info');
        return;
    }
    if (usage.tests && !usage.dictations) {
        openBulkLogModal(classId, 'test');
        return;
    }
    if (!usage.tests && usage.dictations) {
        openBulkLogModal(classId, 'dictation');
        return;
    }
    // A test on the calendar (today or overdue) wins; otherwise the kind last logged for this class.
    const scheduled = pickBulkTestLogContext(classId).status;
    const last = recallTrialType(classId);
    const type = scheduled ? 'test' : (last === 'test' || last === 'dictation' ? last : 'dictation');
    openBulkLogModal(classId, type, { allowTypeSwitch: true });
}

function setupBulkDatePicker() {
    const chip = document.getElementById('bulk-trial-date-chip');
    const picker = document.getElementById('bulk-trial-date-picker');
    const hiddenInput = document.getElementById('bulk-trial-date');
    const shell = document.getElementById('bulk-trial-shell');
    const chevron = chip?.querySelector('.dp-chevron');
    if (!chip || !picker || !hiddenInput) return;
    let closeAnimTimer = null;

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const activeYearStart = state.getActiveSchoolYearStartDate();
    const activeYearEnd = state.getActiveSchoolYearEndDate();

    let dpState = { day: 1, month: 1, year: new Date().getFullYear() };

    const setStateFromDate = (date) => {
        dpState = {
            day: date.getDate(),
            month: date.getMonth() + 1,
            year: date.getFullYear()
        };
    };

    const parseFromInput = () => {
        const val = hiddenInput.value;
        if (!val) return;
        const [y, m, d] = val.split('-').map(Number);
        dpState = { day: d, month: m, year: y };
    };

    const clampDay = () => {
        const max = new Date(dpState.year, dpState.month, 0).getDate();
        if (dpState.day > max) dpState.day = max;
        const selected = new Date(dpState.year, dpState.month - 1, dpState.day);
        if (activeYearStart && selected < activeYearStart) setStateFromDate(activeYearStart);
        else if (activeYearEnd && selected > activeYearEnd) setStateFromDate(activeYearEnd);
    };

    const renderDp = () => {
        clampDay();
        document.getElementById('dp-day').textContent = String(dpState.day).padStart(2, '0');
        document.getElementById('dp-month').textContent = MONTHS[dpState.month - 1];
        document.getElementById('dp-year').textContent = String(dpState.year);
    };

    const closeDp = () => {
        if (closeAnimTimer) {
            clearTimeout(closeAnimTimer);
            closeAnimTimer = null;
        }
        picker.classList.remove('bulk-date-picker--open');
        picker.classList.add('bulk-date-picker--closing');
        chip.setAttribute('aria-expanded', 'false');
        if (chevron) chevron.style.transform = '';
        if (_dpOutsideClickHandler) {
            document.removeEventListener('click', _dpOutsideClickHandler, true);
            _dpOutsideClickHandler = null;
        }
        closeAnimTimer = setTimeout(() => {
            picker.classList.add('hidden');
            picker.classList.remove('bulk-date-picker--closing');
            if (shell) shell.style.overflow = '';
            closeAnimTimer = null;
        }, 170);
    };

    const openDp = () => {
        if (closeAnimTimer) {
            clearTimeout(closeAnimTimer);
            closeAnimTimer = null;
        }
        parseFromInput();
        renderDp();
        if (shell) shell.style.overflow = 'visible';
        picker.classList.remove('bulk-date-picker--closing');
        picker.classList.remove('hidden');
        void picker.offsetWidth;
        picker.classList.add('bulk-date-picker--open');
        chip.setAttribute('aria-expanded', 'true');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        _dpOutsideClickHandler = (e) => {
            if (!picker.contains(e.target) && !chip.contains(e.target)) {
                closeDp();
            }
        };
        document.addEventListener('click', _dpOutsideClickHandler, true);
    };

    chip.onclick = (e) => {
        e.stopPropagation();
        const isHidden = picker.classList.contains('hidden');
        const isClosing = picker.classList.contains('bulk-date-picker--closing');
        (isHidden || isClosing) ? openDp() : closeDp();
    };

    const maxDayFor = () => new Date(dpState.year, dpState.month, 0).getDate();

    picker.querySelector('#dp-day-up').onclick = () => {
        dpState.day = dpState.day >= maxDayFor() ? 1 : dpState.day + 1;
        renderDp();
    };
    picker.querySelector('#dp-day-down').onclick = () => {
        dpState.day = dpState.day <= 1 ? maxDayFor() : dpState.day - 1;
        renderDp();
    };
    picker.querySelector('#dp-month-up').onclick = () => {
        if (dpState.month >= 12) {
            dpState.month = 1;
            dpState.year += 1;
        } else {
            dpState.month += 1;
        }
        renderDp();
    };
    picker.querySelector('#dp-month-down').onclick = () => {
        if (dpState.month <= 1) {
            dpState.month = 12;
            dpState.year -= 1;
        } else {
            dpState.month -= 1;
        }
        renderDp();
    };
    picker.querySelector('#dp-year-up').onclick = () => {
        dpState.year++;
        renderDp();
    };
    picker.querySelector('#dp-year-down').onclick = () => {
        dpState.year--;
        renderDp();
    };

    picker.querySelector('#dp-confirm-btn').onclick = () => {
        clampDay();
        const yyyy = String(dpState.year);
        const mm = String(dpState.month).padStart(2, '0');
        const dd = String(dpState.day).padStart(2, '0');
        hiddenInput.value = `${yyyy}-${mm}-${dd}`;
        hiddenInput.dispatchEvent(new Event('change'));
        closeDp();
    };

    picker.querySelector('#dp-cancel-btn').onclick = () => closeDp();

    const todayBtn = picker.querySelector('#dp-today-btn');
    if (todayBtn) {
        todayBtn.onclick = () => {
            setStateFromDate(new Date());
            renderDp();
        };
    }
}

export function openBulkLogModal(classId, type, options = {}) {
    const classData = state.get('allSchoolClasses').find((c) => c.id === classId);
    if (!classData) return;
    const assessmentScheme = getAssessmentSchemeForClass(classData, type);
    if (!isAssessmentSchemeEnabled(assessmentScheme)) {
        showToast(type === 'dictation' ? 'This class does not use dictations.' : 'This class does not use tests.', 'info');
        return;
    }
    const modal = document.getElementById('bulk-trial-modal');
    const isSwitch = !!options.carry;

    document.getElementById('bulk-trial-title').innerText = type === 'dictation' ? 'Log Dictation' : 'Log Test';
    document.getElementById('bulk-trial-subtitle').innerText = `${classData.logo} ${classData.name}`;
    if (!isSwitch) resetTrialBoard({ tabsFor: options.allowTypeSwitch ? type : null, scheme: assessmentScheme });
    else resetTrialBoard({ tabsFor: type, scheme: assessmentScheme });
    rememberTrialType(classId, type);

    const dateInput = document.getElementById('bulk-trial-date');
    if (!isSwitch) {
        let initialDate =
            typeof options.presetDate === 'string' && options.presetDate.trim()
                ? formatYmdFromAnyDateString(options.presetDate.trim())
                : null;
        if (!initialDate) initialDate = todayIsoDate();
        dateInput.value = initialDate;
    }
    setTrialDateDisplay(dateInput.value);

    const titleWrapper = document.getElementById('bulk-trial-title-wrapper');
    const titleInput = document.getElementById('bulk-trial-name');

    if (type === 'test') {
        titleWrapper.classList.remove('hidden');
        const presetTitle = typeof options.presetTitle === 'string' ? options.presetTitle.trim() : '';
        if (presetTitle) {
            titleInput.value = presetTitle;
        } else {
            const assignmentOnDate = getScheduledAssignmentForClassOnDate(classId, dateInput.value);
            titleInput.value = String(assignmentOnDate?.testData?.title || pickBulkTestLogContext(classId).suggestedTitle || '').trim();
        }
    } else {
        titleWrapper.classList.add('hidden');
        titleInput.value = '';
    }

    dateInput.onchange = (e) => {
        setTrialDateDisplay(e.target.value);
        if (type === 'test') {
            const assn = getScheduledAssignmentForClassOnDate(classId, e.target.value);
            if (assn?.testData?.title || !titleInput.value.trim()) titleInput.value = String(assn?.testData?.title || '').trim();
        }
        // Keep the marks already written; attendance follows the new day's register.
        populateBulkTrialStudentRows(classId, type, assessmentScheme, e.target.value, { marks: readTrialSheet(), keepValues: true });
        refreshBulkTrialScheduledHint(classId, type, e.target.value);
    };

    setupBulkDatePicker();
    populateBulkTrialStudentRows(classId, type, assessmentScheme, dateInput.value, options.carry || null);
    refreshBulkTrialScheduledHint(classId, type, dateInput.value);
    titleInput.oninput = null;

    const tabs = document.getElementById('bulk-trial-type-switch');
    if (tabs) {
        tabs.onclick = (e) => {
            const tab = e.target.closest('.tl-tab');
            const next = tab?.dataset.trialType;
            if (!next || next === modal.dataset.type) return;
            const marks = readTrialSheet();
            const switchNow = () => openBulkLogModal(classId, next, { allowTypeSwitch: true, carry: { marks, keepAbsences: true } });
            const hasMarks = [...marks.values()].some((m) => !m.absent && m.value !== '');
            if (hasMarks) {
                modals.showModal(
                    `Switch to ${next === 'test' ? 'Test' : 'Dictation'}?`,
                    'The marks on this sheet will be cleared. Absences stay as they are.',
                    switchNow,
                    'Switch',
                    'Keep marking'
                );
            } else {
                switchNow();
            }
        };
    }

    document.getElementById('bulk-trial-close-btn').onclick = () => modals.hideModal('bulk-trial-modal');

    modal.dataset.classId = classId;
    modal.dataset.type = type;
    modal.dataset.gradingMode = assessmentScheme.mode;

    if (isSwitch) {
        const sheet = modal.querySelector('.tl-sheet');
        sheet?.classList.remove('tl-sheet--flip');
        void sheet?.offsetWidth;
        sheet?.classList.add('tl-sheet--flip');
        return;
    }
    modals.showAnimatedModal('bulk-trial-modal');
    if (type === 'test' && !titleInput.value.trim()) {
        setTimeout(() => titleInput.focus({ preventScroll: true }), 320);
    }
}

// --- HISTORY & SINGLE EDIT ---

export function openTrialHistoryModal(classId) {
    if (!classId) return;
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;

    loadedHistoricalScores = [];
    historySortDateDir = 'desc';
    historySortStudentBy = 'name';

    const modal = document.getElementById('trial-history-modal');
    modal.dataset.classId = classId;
    document.getElementById('trial-history-title').innerHTML = `${classData.logo} Trial History`;

    const usage = getClassAssessmentUsage(classData);
    const scoresForHistory = (state.get('allWrittenScores') || []).filter((score) => score.classId === classId);
    const showTests = usage.tests || scoresForHistory.some((score) => score.type === 'test');
    const showDictations = usage.dictations || scoresForHistory.some((score) => score.type === 'dictation');
    const initialView = showTests ? 'test' : 'dictation';

    const viewToggleContainer = document.getElementById('trial-history-view-toggle');
    viewToggleContainer.innerHTML = `
        ${showTests ? `<button data-view="test" class="toggle-btn ${initialView === 'test' ? 'active-toggle' : ''} px-4 py-2 rounded-xl font-bold text-sm transition-all"><i class="fas fa-file-alt mr-2"></i>Tests</button>` : ''}
        ${showDictations ? `<button data-view="dictation" class="toggle-btn ${initialView === 'dictation' ? 'active-toggle' : ''} px-4 py-2 rounded-xl font-bold text-sm transition-all"><i class="fas fa-microphone-alt mr-2"></i>Dictations</button>` : ''}
    `;
    viewToggleContainer.classList.toggle('hidden', !showTests || !showDictations);

    viewToggleContainer.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            viewToggleContainer.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active-toggle'));
            e.currentTarget.classList.add('active-toggle');
            renderTrialHistoryContent(classId, e.currentTarget.dataset.view);
        });
    });

    // 2. Setup Edit/Delete Listeners
    const contentEl = document.getElementById('trial-history-content');
    const newContentEl = contentEl.cloneNode(false);
    contentEl.parentNode.replaceChild(newContentEl, contentEl);

    newContentEl.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-trial-btn');
        if (deleteBtn) handleDeleteTrial(deleteBtn.dataset.trialId);
        const editBtn = e.target.closest('.edit-trial-btn');
        if (editBtn) openSingleTrialEditModal(classId, editBtn.dataset.trialId);
    });

    // 3. Initial Render
    renderTrialHistoryContent(classId, initialView);
    modals.showAnimatedModal('trial-history-modal');

    // 4. Load full history on demand (one fetch — same query as Student Analytics class scores)
    const actionsContainer = document.getElementById('trial-history-actions');
    actionsContainer.innerHTML = `
        <div class="flex flex-col items-end gap-1">
            <button id="trial-history-load-full-btn" type="button" class="px-3 h-9 rounded-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm transform hover:-translate-y-0.5 disabled:opacity-60 disabled:pointer-events-none disabled:transform-none" title="Fetch every assessment for this class from the database">
                <i class="fas fa-cloud-download-alt"></i>
                <span>Load full history</span>
            </button>
            <span id="trial-history-full-status" class="text-[11px] font-semibold text-purple-800/75 max-w-[240px] text-right leading-snug"></span>
        </div>`;

    const btn = document.getElementById('trial-history-load-full-btn');
    const statusEl = document.getElementById('trial-history-full-status');

    btn?.addEventListener('click', async () => {
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Loading…</span>';
        if (statusEl) statusEl.textContent = '';

        try {
            const { fetchAllTrialsForClass } = await import('../db/queries.js');
            const scores = await fetchAllTrialsForClass(classId);
            loadedHistoricalScores = scores;
            const activeView = document.querySelector('#trial-history-view-toggle .active-toggle')?.dataset.view || 'test';
            renderTrialHistoryContent(classId, activeView);
            if (statusEl) {
                statusEl.textContent = scores.length
                    ? `Loaded ${scores.length} assessment${scores.length === 1 ? '' : 's'} from the archive.`
                    : 'No archived assessments found for this class.';
            }
            showToast(
                scores.length ? 'Full trial history is ready.' : 'No records found in the archive.',
                scores.length ? 'success' : 'info'
            );
        } catch (err) {
            console.error('Trial history full load failed:', err);
            showToast('Could not load full history. Try again.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml || '<i class="fas fa-cloud-download-alt"></i><span>Load full history</span>';
        }
    });

    // 5. Sort controls
    const sortRow = document.getElementById('trial-history-sort-row');
    const chipBase = 'sort-chip px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border';
    const chipActive = 'bg-purple-100 text-purple-700 border-purple-300 shadow-sm';
    const chipInactive = 'bg-white text-purple-400 border-purple-100 hover:border-purple-300 hover:text-purple-600';
    const makeSortChip = (type, val, label, isActive) =>
        `<button data-sort-type="${type}" data-sort-val="${val}" class="${chipBase} ${isActive ? chipActive : chipInactive}">${label}</button>`;

    const buildSortRow = () => {
        sortRow.innerHTML = `
            <span class="text-[10px] font-bold text-purple-400 uppercase tracking-wider shrink-0 mr-1">Sort</span>
            <span class="text-[9px] font-semibold text-purple-300 uppercase tracking-wider ml-1">Date</span>
            ${makeSortChip('date', 'desc', 'Newest ↓', historySortDateDir === 'desc')}
            ${makeSortChip('date', 'asc', 'Oldest ↑', historySortDateDir === 'asc')}
            <div class="w-px h-4 bg-purple-200 mx-1 shrink-0"></div>
            <span class="text-[9px] font-semibold text-purple-300 uppercase tracking-wider">Students</span>
            ${makeSortChip('student', 'name', 'A→Z', historySortStudentBy === 'name')}
            ${makeSortChip('student', 'name-desc', 'Z→A', historySortStudentBy === 'name-desc')}
            ${makeSortChip('student', 'score-desc', 'Score ↓', historySortStudentBy === 'score-desc')}
            ${makeSortChip('student', 'score-asc', 'Score ↑', historySortStudentBy === 'score-asc')}
        `;
    };
    buildSortRow();

    sortRow.addEventListener('click', (e) => {
        const btn2 = e.target.closest('.sort-chip');
        if (!btn2) return;
        const type = btn2.dataset.sortType;
        const val = btn2.dataset.sortVal;
        if (type === 'date') historySortDateDir = val;
        else if (type === 'student') historySortStudentBy = val;
        buildSortRow();
        const activeView = document.querySelector('#trial-history-view-toggle .active-toggle')?.dataset.view || 'test';
        renderTrialHistoryContent(classId, activeView);
    });
}

export function renderTrialHistoryContent(classId, view) {
    const contentEl = document.getElementById('trial-history-content');

    // 1. Get ONLY recent scores (last 45 days) for the initial view
    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 45);

    const recentScores = state.get('allWrittenScores').filter(s => {
        if (!s.date || s.classId !== classId) return false;
        return utils.parseFlexibleDate(s.date) >= recentCutoff;
    });

    // 2. Combine with scores loaded explicitly via “Load full history” (and dedupe by id)
    const allScoresForClass = [...recentScores, ...loadedHistoricalScores];

    // 3. Remove duplicates to be safe
    const uniqueScores = Array.from(new Map(allScoresForClass.map(item => [item.id, item])).values());

    // 4. Filter by the selected view ('test' or 'dictation')
    const scoresToRender = uniqueScores.filter(s => s.type === view);

    // 5. Group and Render (use smart date parser — scores may be DD-MM-YYYY or YYYY-MM-DD)
    const scoresByMonth = scoresToRender.reduce((acc, score) => {
        const d = utils.parseFlexibleDate(score.date);
        const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : (score.date && score.date.substring(0, 7)) || 'unknown';
        if (!acc[key]) acc[key] = [];
        acc[key].push(score);
        return acc;
    }, {});

    const sortedMonths = Object.keys(scoresByMonth).sort();
    if (historySortDateDir === 'desc') sortedMonths.reverse();

    if (sortedMonths.length === 0) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">No ${view} records found. Use <span class="font-semibold text-purple-700">Load full history</span> above to fetch older assessments from the database.</p>`;
        return;
    }

    const newHtml = sortedMonths.map(currentMonthKey => {
        const monthName = new Date(currentMonthKey + '-02').toLocaleString('en-GB', { month: 'long', year: 'numeric' });

        const scoresByDate = scoresByMonth[currentMonthKey].reduce((acc, score) => {
            if (!acc[score.date]) acc[score.date] = [];
            acc[score.date].push(score);
            return acc;
        }, {});

        const sortedDates = Object.keys(scoresByDate).sort((a, b) => {
            const da = utils.parseFlexibleDate(a);
            const db = utils.parseFlexibleDate(b);
            return historySortDateDir === 'asc' ? (da || 0) - (db || 0) : (db || 0) - (da || 0);
        });

        let monthScoresHtml = sortedDates.map(date => {
            const dateScoresHtml = [...scoresByDate[date]]
                .sort((a, b) => {
                    if (historySortStudentBy === 'score-desc') {
                        return (getNormalizedPercentForScore(b) || 0) - (getNormalizedPercentForScore(a) || 0);
                    } else if (historySortStudentBy === 'score-asc') {
                        return (getNormalizedPercentForScore(a) || 0) - (getNormalizedPercentForScore(b) || 0);
                    } else {
                        const students = state.get('allStudents');
                        const nA = students.find(s => s.id === a.studentId)?.name || '';
                        const nB = students.find(s => s.id === b.studentId)?.name || '';
                        return historySortStudentBy === 'name-desc' ? nB.localeCompare(nA) : nA.localeCompare(nB);
                    }
                })
                .map(score => renderTrialHistoryItem(score)).join('');
            const title = scoresByDate[date][0].title || (view === 'dictation' ? 'Dictation' : 'Test');
            const dateObj = utils.parseFlexibleDate(date);
            const displayDate = dateObj ? dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) : date;

            return `<div class="mb-5 last:mb-0 relative">
                        <div class="flex items-center gap-3 mb-3 pl-2">
                            <div class="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-b from-purple-100 to-white border border-purple-200 shadow-sm text-center leading-none">
                                <span class="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-0.5">${displayDate.substring(0,3)}</span>
                                <span class="text-lg font-black text-purple-900 font-title">${dateObj ? dateObj.getDate() : ''}</span>
                            </div>
                            <div>
                                <span class="font-bold text-gray-700">${dateObj ? dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : date}</span>
                                <div class="text-xs font-semibold text-purple-600 bg-purple-100 px-2.5 py-0.5 rounded-full inline-block mt-0.5 border border-purple-200 shadow-sm">${title}</div>
                            </div>
                        </div>
                        <div class="space-y-2 pl-4 ml-8 relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-purple-100">${dateScoresHtml}</div>
                    </div>`;
        }).join('');

        return `
            <details class="group month-group bg-white/80 backdrop-blur-sm rounded-2xl mb-4 shadow-sm border border-purple-100 overflow-hidden transition-all hover:shadow-md" data-month-key="${currentMonthKey}" open>
                <summary class="flex items-center justify-between font-title text-xl text-purple-900 p-4 cursor-pointer bg-gradient-to-r from-purple-50/50 to-fuchsia-50/50 hover:from-purple-100/50 hover:to-fuchsia-100/50 transition-colors list-none select-none" style="list-style: none;">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-purple-200/50 flex items-center justify-center text-purple-700">
                            <i class="fas fa-calendar-alt text-sm"></i>
                        </div>
                        ${monthName}
                    </div>
                    <div class="text-purple-400 group-open:rotate-180 transition-transform duration-300">
                        <i class="fas fa-chevron-down"></i>
                    </div>
                </summary>
                <div class="p-4 pt-4 border-t border-purple-100/50">
                    ${monthScoresHtml}
                </div>
            </details>
        `;
    }).join('');

    contentEl.innerHTML = newHtml;
}

function renderTrialHistoryItem(score) {
    const student = state.get('allStudents').find(s => s.id === score.studentId);
    if (!student) return '';

    let scoreDisplay = '';
    let scorePercent = 0;
    let colorClass = 'text-blue-600';
    let bgClass = 'bg-blue-50';
    let borderClass = 'border-blue-200';

    if (score.scoreQualitative) {
        scoreDisplay = `<span class="font-title text-lg leading-none">${score.scoreQualitative}</span>`;
    }
    else if (score.scoreNumeric !== null && score.maxScore) {
        scorePercent = getNormalizedPercentForScore(score) || 0;
        if (scorePercent >= 80) { colorClass = 'text-emerald-700'; bgClass = 'bg-emerald-50'; borderClass = 'border-emerald-200'; }
        else if (scorePercent >= 60) { colorClass = 'text-amber-700'; bgClass = 'bg-amber-50'; borderClass = 'border-amber-200'; }
        else { colorClass = 'text-rose-700'; bgClass = 'bg-rose-50'; borderClass = 'border-rose-200'; }

        scoreDisplay = `<span class="font-title text-lg leading-none">${getAssessmentValueLabel(score)}</span>
                        <span class="text-xs font-bold opacity-70 ml-1.5 mt-0.5">${scorePercent.toFixed(0)}%</span>`;
    }

    const isOwner = score.teacherId === state.get('currentUserId');
    const avatarHtml = student.avatar
        ? `<img src="${student.avatar}" loading="lazy" decoding="async" class="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm shrink-0">`
        : `<div class="w-9 h-9 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-purple-700 font-bold shadow-sm border-2 border-white shrink-0">${student.name.charAt(0)}</div>`;

    return `
        <div class="trial-history-item relative flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-purple-300 hover:shadow-md transition-all duration-200 group/item">
            <div class="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${scorePercent >= 80 ? 'bg-emerald-400' : scorePercent >= 60 ? 'bg-amber-400' : scorePercent > 0 ? 'bg-rose-400' : 'bg-blue-400'}"></div>

            <div class="flex items-center gap-3 pl-3">
                ${avatarHtml}
                <span class="font-bold text-gray-800">${student.name}</span>
            </div>

            <div class="flex items-center gap-4">
                <div class="flex items-center justify-center px-3 py-1.5 rounded-lg ${bgClass} ${borderClass} border ${colorClass}">
                    ${scoreDisplay}
                </div>

                ${isOwner ? `
                <div class="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <button data-trial-id="${score.id}" class="edit-trial-btn w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-110 transition-all flex items-center justify-center shadow-sm" title="Edit"><i class="fas fa-pencil-alt text-sm"></i></button>
                    <button data-trial-id="${score.id}" class="delete-trial-btn w-8 h-8 rounded-full bg-red-50 text-red-600 hover:bg-red-100 hover:scale-110 transition-all flex items-center justify-center shadow-sm" title="Delete"><i class="fas fa-trash-alt text-sm"></i></button>
                </div>
                ` : '<div class="w-[72px]"></div>'}
            </div>
        </div>
    `;
}

// --- SINGLE EDIT MODAL ---

export function openSingleTrialEditModal(classId, trialId) {
    const score = state.get('allWrittenScores').find(s => s.id === trialId);
    if (!score) return;

    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    let assessmentScheme = getAssessmentSchemeForClass(classData, score.type);
    if (!isAssessmentSchemeEnabled(assessmentScheme) && score.gradingSnapshot) {
        assessmentScheme = normalizeAssessmentScheme(score.gradingSnapshot, score.gradingSnapshot);
    }

    const modal = document.getElementById('bulk-trial-modal');
    document.getElementById('bulk-trial-scheduled-hint')?.classList.add('hidden');
    resetTrialBoard({ scheme: assessmentScheme });
    document.getElementById('bulk-trial-tip-default')?.classList.add('hidden');

    document.getElementById('bulk-trial-title').innerText = 'Edit Result';
    document.getElementById('bulk-trial-subtitle').innerText = `${classData.logo || ''} ${classData.name}`.trim();

    const dateObj = utils.parseDDMMYYYY(score.date);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const dateInput = document.getElementById('bulk-trial-date');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
    dateInput.onchange = (e) => setTrialDateDisplay(e.target.value);
    setTrialDateDisplay(dateInput.value);
    setupBulkDatePicker();

    const titleWrapper = document.getElementById('bulk-trial-title-wrapper');
    const titleInput = document.getElementById('bulk-trial-name');

    if (score.type === 'test') {
        titleWrapper.classList.remove('hidden');
        titleInput.value = score.title || '';
    } else {
        titleWrapper.classList.add('hidden');
    }

    const listContainer = document.getElementById('bulk-student-list');
    listContainer.innerHTML = '';

    const student = state.get('allStudents').find(s => s.id === score.studentId);
    if (student) {
        const value = score.scoreQualitative || (score.scoreNumeric !== null && score.scoreNumeric !== undefined ? String(score.scoreNumeric) : '');
        listContainer.innerHTML = trialRowHtml({ student, scheme: assessmentScheme, value });
        listContainer.querySelector('.bulk-log-item').dataset.trialId = trialId;
    }
    wireTrialSheet(listContainer);
    updateTrialTally();

    modal.dataset.classId = classId;
    modal.dataset.type = score.type;
    modal.dataset.gradingMode = assessmentScheme.mode;

    const saveBtn = document.getElementById('bulk-trial-save-btn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    import('../db/actions.js').then(actions => {
        newSaveBtn.addEventListener('click', actions.handleBulkSaveTrial);
    });

    modals.showAnimatedModal('bulk-trial-modal');
    document.getElementById('bulk-trial-close-btn').onclick = () => modals.hideModal('bulk-trial-modal');
}


function positionMakeupBelowScheduledQueue(dashboard, container) {
    if (!dashboard || !container) return;
    const sched = document.getElementById('scheduled-grading-queue');
    if (sched) {
        sched.insertAdjacentElement('afterend', container);
        return;
    }
    dashboard.insertBefore(container, dashboard.firstChild);
}

function renderScheduledGradingQueue(classId, dashboardEl) {
    if (!dashboardEl) return;
    let wrap = document.getElementById('scheduled-grading-queue');
    const backlog = listScheduledAssessmentsNeedingGrades(classId);

    if (backlog.length === 0) {
        if (wrap) wrap.remove();
        return;
    }

    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'scheduled-grading-queue';
    }

    const cards = backlog.map((st) => {
        const awaiting = getStudentsAwaitingGradeForScheduledStatus(st);
        const preview = awaiting
            .slice(0, 4)
            .map((s) => s.name.split(' ')[0])
            .join(', ');
        const extras = awaiting.length > 4 ? ` +${awaiting.length - 4}` : '';
        const phaseNote =
            st.phase === 'missed'
                ? `Scheduled test day passed — ${Math.abs(st.dayDiff)} day${Math.abs(st.dayDiff) === 1 ? '' : 's'} ago`
                : `${st.statusLabel} · catching up`;

        const ymd = formatYmdFromAnyDateString(st.testData.date);

        return `
            <div class="scheduled-grade-card bg-violet-50/50 p-3 md:p-3.5 rounded-2xl border border-violet-100 hover:bg-white hover:border-violet-200 hover:shadow-md transition-all">
                <div class="flex flex-wrap items-start justify-between gap-2">
                    <div class="min-w-0">
                        <p class="font-title text-base text-violet-950 leading-snug">${st.testData.title || 'Scheduled test'}</p>
                        <p class="text-[11px] font-bold text-violet-700/85 mt-0.5">${st.dateLabel} · ${st.chipLabel}</p>
                        <p class="text-[10px] font-semibold text-slate-500 mt-1">${phaseNote}${awaiting.length ? ` · still missing: ${preview}${extras}` : ''}</p>
                    </div>
                    <button type="button" class="log-scheduled-test-btn shrink-0 h-9 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-[9px] uppercase tracking-wide shadow-md hover:scale-[1.02] transition-all"
                        data-preset-date="${ymd}">
                        Log class results
                    </button>
                </div>
            </div>
        `;
    }).join('');

    wrap.className = 'mb-6';
    wrap.innerHTML = `
        <div class="p-1 md:p-1 bg-gradient-to-br from-violet-200 via-indigo-200 to-sky-200 rounded-[2rem] md:rounded-[2.3rem] shadow-[0_16px_40px_rgba(99,102,241,0.15)] relative overflow-hidden group">
            <div class="bg-white/95 backdrop-blur-xl rounded-[1.65rem] md:rounded-[2rem] p-4 md:p-5 relative overflow-hidden">
                <div class="absolute -right-8 -top-8 text-[7rem] text-violet-500/5 pointer-events-none"><i class="fas fa-link"></i></div>
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 relative z-10">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shadow-lg">
                            <i class="fas fa-clipboard-list text-sm"></i>
                        </div>
                        <div class="min-w-0">
                            <span class="px-2 py-0.5 bg-violet-500/10 text-violet-700 text-[9px] font-black uppercase tracking-[0.18em] rounded-full border border-violet-500/20">Quest Board → Scroll</span>
                            <h3 class="font-title text-xl md:text-2xl text-slate-800 tracking-tight leading-tight">Pending grading</h3>
                            <p class="text-slate-500 text-xs font-medium leading-snug mt-0.5">These tests were announced with <strong>Schedule a Test</strong>. Finish logging so Starfall, analytics, and Pending Makeups stay truthful.</p>
                        </div>
                    </div>
                    <div class="text-[10px] font-black text-violet-800 uppercase tracking-wider bg-violet-50 px-3 py-1.5 rounded-xl border border-violet-100 shrink-0">${backlog.length} open</div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 relative z-10">
                    ${cards}
                </div>
            </div>
        </div>
    `;

    dashboardEl.insertBefore(wrap, dashboardEl.firstChild);

    wrap.querySelectorAll('.log-scheduled-test-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const ymd = btn.dataset.presetDate;
            const assn = getScheduledAssignmentForClassOnDate(classId, ymd);
            openBulkLogModal(classId, 'test', {
                presetDate: ymd,
                presetTitle: String(assn?.testData?.title || '').trim()
            });
        });
    });
}

// --- NEW: MAKEUP / MISSING WORK LOGIC ---

function renderMissingWorkDashboard(classId) {
    const dashboard = getScrollQueuesHost();
    document.getElementById('scheduled-grading-queue')?.remove();

    let container = document.getElementById('makeup-work-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'makeup-work-container';
    }
    container.innerHTML = '';

    const classData = state.get('allSchoolClasses').find((c) => c.id === classId)
        || state.get('allTeachersClasses').find((c) => c.id === classId);
    if (!classUsesTests(classData)) {
        container.remove();
        return;
    }

    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);
    const scoresForClass = state.get('allWrittenScores').filter(s => s.classId === classId);

    // 1. Identify unique Tests (Group by Title+Type)
    const uniqueAssessments = {};

    scoresForClass.forEach(score => {
        // FIX 2: ONLY Tests
        if (score.type === 'test') {
            const key = `${score.type}-${score.title || 'Untitled'}`;
            if (!uniqueAssessments[key]) {
                uniqueAssessments[key] = {
                    type: score.type,
                    title: score.title || 'Untitled',
                    originalDate: score.date,
                    count: 0
                };
            }
            uniqueAssessments[key].count++;
        }
    });

    // Filter out assessments that only 1 or 2 students took (likely makeups themselves)
    const threshold = Math.max(2, Math.floor(studentsInClass.length * 0.3));

    // Only show makeups for assessments within the past 3 months (matching the data load window)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    threeMonthsAgo.setHours(0, 0, 0, 0);

    const validAssessments = Object.values(uniqueAssessments).filter(a => {
        if (a.count < threshold) return false;
        const aDate = utils.parseFlexibleDate(a.originalDate);
        if (!aDate) return false;
        return aDate >= threeMonthsAgo; // Skip stale assessments from > 3 months ago
    });

    if (validAssessments.length === 0) {
        container.remove();
        return;
    }

    // 2. Find students who missed these
    const missingWork = [];

    validAssessments.forEach(assessment => {
        studentsInClass.forEach(student => {
            // FIX: Check if student joined AFTER the test date
            if (student.createdAt) {
                const joinDate = student.createdAt.toDate ? student.createdAt.toDate() : new Date(student.createdAt);
                const testDate = utils.parseFlexibleDate(assessment.originalDate);
                testDate.setHours(23, 59, 59, 999);
                if (joinDate > testDate) return;
            }

            const hasTaken = scoresForClass.some(s =>
                s.studentId === student.id &&
                s.type === assessment.type &&
                (s.title === assessment.title || (!s.title && !assessment.title))
            );

            if (!hasTaken) {
                missingWork.push({
                    student,
                    assessment
                });
            }
        });
    });

    if (missingWork.length === 0) {
        container.remove();
        return;
    }

    // Load dismissed makeups from localStorage (keyed by classId-type-title-studentId)
    const dismissedKey = `dismissed_makeups_${classId}`;
    const dismissed = JSON.parse(localStorage.getItem(dismissedKey) || '{}');

    // Filter out dismissed items
    const filteredWork = missingWork.filter(item => {
        const itemKey = `${item.assessment.type}-${item.assessment.title}-${item.student.id}`;
        return !dismissed[itemKey];
    });

    if (filteredWork.length === 0) {
        container.remove();
        return;
    }

    // 3. Render the list
    let html = `
        <div class="mb-6 p-1 md:p-1 bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500 rounded-[2rem] md:rounded-[2.3rem] shadow-[0_16px_40px_rgba(245,158,11,0.18)] relative overflow-hidden group">
            <div class="bg-white/95 backdrop-blur-xl rounded-[1.65rem] md:rounded-[2rem] p-4 md:p-5 relative overflow-hidden">

                <!-- Atmospheric Background Decor -->
                <div class="absolute -right-10 -top-10 text-[9rem] text-amber-500/5 transform rotate-12 pointer-events-none transition-transform duration-1000 group-hover:scale-110 group-hover:rotate-6">
                    <i class="fas fa-scroll-old"></i>
                </div>
                <div class="absolute -left-16 -bottom-16 w-52 h-52 bg-amber-200/20 blur-[64px] rounded-full pointer-events-none"></div>

                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 relative z-10">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="relative shrink-0">
                            <div class="absolute inset-0 bg-amber-400 blur-lg opacity-25 animate-pulse"></div>
                            <div class="relative w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200/80 border border-white/20">
                                <i class="fas fa-hourglass-start text-white text-base"></i>
                            </div>
                        </div>
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span class="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-[9px] font-black uppercase tracking-[0.18em] rounded-full border border-amber-500/20 shrink-0">Scholastic Alerts</span>
                                <h3 class="font-title text-xl md:text-2xl text-slate-800 tracking-tight leading-tight">Pending Makeups</h3>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 shrink-0 self-start sm:self-auto">
                        <div class="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></div>
                        <span class="text-[10px] font-black text-amber-700 uppercase tracking-wider">${filteredWork.length} Records Found</span>
                    </div>
                </div>

                <div class="makeup-items-grid grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
    `;

    filteredWork.forEach(item => {
        const student = item.student;
        const avatar = student.avatar
            ? `<img src="${student.avatar}" loading="lazy" decoding="async" class="w-11 h-11 rounded-xl object-cover border border-white shadow-sm">`
            : `<div class="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-800 font-title flex items-center justify-center text-base border border-white shadow-sm">${student.name.charAt(0)}</div>`;

        html += `
            <div class="scroll-makeup-item bg-slate-50/50 p-3.5 md:p-4 rounded-2xl border border-slate-100 hover:bg-white hover:border-amber-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group/item relative min-w-0">
                <div class="absolute inset-0 rounded-[inherit] overflow-hidden pointer-events-none bg-gradient-to-br from-amber-500/0 to-amber-500/[0.02] opacity-0 group-hover/item:opacity-100 transition-opacity"></div>

                <div class="relative z-10 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                    <div class="flex items-start gap-3 min-w-0 flex-1">
                        <div class="relative shrink-0 pt-0.5">
                            <div class="absolute inset-0 bg-amber-200 blur-md opacity-0 group-hover/item:opacity-35 transition-opacity rounded-lg"></div>
                            <div class="relative transform group-hover/item:scale-105 transition-all duration-300">
                                ${avatar}
                            </div>
                        </div>
                        <div class="min-w-0 flex-1 space-y-1.5">
                            <div class="font-title text-base md:text-lg text-slate-800 leading-snug break-words">${student.name}</div>
                            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span class="text-[8px] font-black text-amber-600 uppercase tracking-wide bg-amber-100/60 px-2 py-0.5 rounded-md border border-amber-500/15">${item.assessment.type}</span>
                                <span class="text-[11px] font-bold text-slate-600 leading-snug break-words">${item.assessment.title}</span>
                            </div>
                            <div class="text-[10px] text-slate-500 font-medium flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span class="inline-flex items-center gap-1"><i class="far fa-calendar-alt text-amber-500 text-[10px]"></i>
                                Expected: <span class="text-slate-700 font-bold">${(utils.parseFlexibleDate(item.assessment.originalDate) || new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></span>
                                <span class="w-1 h-1 rounded-full bg-amber-400 animate-pulse shrink-0" aria-hidden="true"></span>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center justify-end gap-1.5 shrink-0 sm:flex-col sm:items-end sm:pt-0.5 sm:min-w-[7.5rem]">
                        <button class="makeup-dismiss-btn w-8 h-8 rounded-lg bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-all border border-slate-200 hover:border-rose-200 shadow-sm"
                            data-student-id="${item.student.id}"
                            data-title="${item.assessment.title}"
                            data-type="${item.assessment.type}"
                            title="Dismiss this record">
                            <i class="fas fa-trash-can text-[10px] pointer-events-none"></i>
                        </button>
                        <button class="makeup-log-btn makeup-trigger h-8 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-[9px] uppercase tracking-wide shadow-md shadow-amber-200/70 hover:shadow-amber-300/80 hover:scale-[1.02] transition-all flex items-center gap-1.5 whitespace-nowrap"
                            data-student-id="${item.student.id}"
                            data-title="${item.assessment.title}"
                            data-type="${item.assessment.type}">
                            <span>Log Result</span>
                            <i class="fas fa-chevron-right text-[7px] opacity-60"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });


    html += `
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
    positionMakeupBelowScheduledQueue(dashboard, container);

    // 4. Bind Click Events
    container.querySelectorAll('.makeup-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
            openMakeupModal(classId, btn.dataset.studentId, btn.dataset.type, btn.dataset.title);
        });
    });

    // 5. Bind Dismiss Buttons
    container.querySelectorAll('.makeup-dismiss-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const itemKey = `${btn.dataset.type}-${btn.dataset.title}-${btn.dataset.studentId}`;
            const saved = JSON.parse(localStorage.getItem(dismissedKey) || '{}');
            saved[itemKey] = true;
            localStorage.setItem(dismissedKey, JSON.stringify(saved));
            // Remove from DOM immediately
            const makeupItem = btn.closest('.scroll-makeup-item');
            if (makeupItem) {
                makeupItem.style.opacity = '0';
                makeupItem.style.transition = 'opacity 0.3s';
                setTimeout(() => {
                    makeupItem.remove();
                    // If no items left, remove the whole container
                    const remaining = container.querySelectorAll('.scroll-makeup-item');
                    if (remaining.length === 0) container.remove();
                }, 300);
            }
        });
    });
}

function openMakeupModal(classId, studentId, type, title) {
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const student = state.get('allStudents').find(s => s.id === studentId);
    const assessmentScheme = getAssessmentSchemeForClass(classData, type);

    // Reuse the marking board, configured for one makeup line
    const modal = document.getElementById('bulk-trial-modal');
    document.getElementById('bulk-trial-scheduled-hint')?.classList.add('hidden');
    resetTrialBoard({ scheme: assessmentScheme });
    document.getElementById('bulk-trial-tip-default')?.classList.add('hidden');

    document.getElementById('bulk-trial-title').innerText = `Makeup: ${type === 'dictation' ? 'Dictation' : 'Test'}`;
    document.getElementById('bulk-trial-subtitle').innerText = `${student.name} · ${title}`;

    const dateInput = document.getElementById('bulk-trial-date');
    dateInput.value = todayIsoDate();
    dateInput.onchange = (e) => setTrialDateDisplay(e.target.value);
    setTrialDateDisplay(dateInput.value);
    setupBulkDatePicker();

    // Always show the title for a makeup, to confirm which trial it belongs to
    const titleWrapper = document.getElementById('bulk-trial-title-wrapper');
    const titleInput = document.getElementById('bulk-trial-name');
    titleWrapper.classList.remove('hidden');
    titleInput.value = title || '';

    const listContainer = document.getElementById('bulk-student-list');
    listContainer.innerHTML = trialRowHtml({ student, scheme: assessmentScheme, note: 'Taking makeup', lockAttendance: true });
    wireTrialSheet(listContainer);
    updateTrialTally();

    // Set modal datasets for saving
    modal.dataset.classId = classId;
    modal.dataset.type = type;
    modal.dataset.gradingMode = assessmentScheme.mode;

    // Bind Save Button
    const saveBtn = document.getElementById('bulk-trial-save-btn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    // We need to import handleBulkSaveTrial from actions to bind it
    import('../db/actions.js').then(actions => {
        newSaveBtn.addEventListener('click', actions.handleBulkSaveTrial);
    });

    // Show
    modals.showAnimatedModal('bulk-trial-modal');
    document.getElementById('bulk-trial-close-btn').onclick = () => modals.hideModal('bulk-trial-modal');
}
