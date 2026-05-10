// /ui/modals/student.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { db } from '../../firebase.js';
import { query, collection, where, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { showAnimatedModal, showModal, hideModal, populateDateDropdowns } from './base.js';
import { showToast } from '../effects.js';
import { playSound } from '../../audio.js';
import { handleAwardBonusStar, handleBatchAwardBonus } from '../../db/actions.js';
import { canUseFeature } from '../../utils/subscription.js';
import { getScheduledAssessmentStatus, getStudentsAwaitingGradeForScheduledStatus } from '../../features/assessmentConfig.js';

const LEGACY_ASSIGNMENT_DATE_PREFIX_REGEX = /^\s*\d{1,2}[\/-]\d{1,2}[\/-]\d{4}\s*[:\-]?\s*/;

function stripLegacyAssignmentDatePrefix(text) {
    if (typeof text !== 'string') return '';
    return text.replace(LEGACY_ASSIGNMENT_DATE_PREFIX_REGEX, '').trimStart();
}

function getTodayAssignmentChipText() {
    const parsedToday = utils.parseFlexibleDate(utils.getTodayDateString()) || new Date();
    const dd = String(parsedToday.getDate()).padStart(2, '0');
    const mm = String(parsedToday.getMonth() + 1).padStart(2, '0');
    const yyyy = parsedToday.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function getQuestTestElements() {
    return {
        testDate: document.getElementById('quest-test-date'),
        testTitle: document.getElementById('quest-test-title'),
        testCurriculum: document.getElementById('quest-test-curriculum'),
        summaryCard: document.getElementById('quest-test-summary-card'),
        summaryTitle: document.getElementById('quest-test-summary-title'),
        summaryDetails: document.getElementById('quest-test-summary-details'),
        headerBadge: document.getElementById('quest-header-test-badge')
    };
}

export function setQuestTestModalVisible(visible) {
    if (visible) {
        showAnimatedModal('quest-test-modal');
    } else {
        hideModal('quest-test-modal');
    }
}

export function refreshQuestTestPanelSummary() {
    const { testDate, testTitle, testCurriculum, summaryCard, summaryTitle, summaryDetails, headerBadge } = getQuestTestElements();
    const hasTitle = !!testTitle?.value?.trim();
    const hasDate = !!testDate?.value;
    const hasAnyValue = hasTitle || hasDate;

    if (summaryCard) summaryCard.classList.toggle('hidden', !hasAnyValue);
    if (headerBadge) headerBadge.classList.toggle('hidden', !hasAnyValue);

    if (hasAnyValue) {
        if (summaryTitle) summaryTitle.textContent = testTitle.value.trim() || 'Untitled Test';
        if (summaryDetails) {
            const pieces = [];
            if (hasDate) {
                const d = utils.parseFlexibleDate(testDate.value);
                pieces.push(d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : testDate.value);
            }
            if (testCurriculum?.value?.trim()) pieces.push(testCurriculum.value.trim());
            summaryDetails.textContent = pieces.join(' • ');
        }
    }
}

export function clearQuestTestFields(options = {}) {
    const { testDate, testTitle, testCurriculum } = getQuestTestElements();
    if (testDate) testDate.value = '';
    if (testTitle) testTitle.value = '';
    if (testCurriculum) testCurriculum.value = '';
    refreshQuestTestPanelSummary();
    if (options.hide !== false) {
        setQuestTestModalVisible(false);
    }
}

export function toggleQuestTestPanel() {
    setQuestTestModalVisible(true);
}

export function openEditStudentModal(studentId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    document.getElementById('edit-student-id-input-full').value = studentId;
    document.getElementById('edit-student-name-input-full').value = student.name;
    
    // NEW: Use helper to populate dropdowns
    populateDateDropdowns('edit-student-birthday-month', 'edit-student-birthday-day', student.birthday);
    populateDateDropdowns('edit-student-nameday-month', 'edit-student-nameday-day', student.nameday);
    // Load Hero Class into dropdown
   // Load Hero Class and check if locked
    const classDropdown = document.getElementById('edit-student-hero-class');
    const tierNote = document.getElementById('hero-class-tier-note');
    const heroProgressionEnabled = canUseFeature('heroProgression');
    const namedayLookupBtn = document.getElementById('lookup-nameday-btn');
    const eliteAiEnabled = canUseFeature('eliteAI');
    classDropdown.value = student.heroClass || "";

    if (namedayLookupBtn) {
        namedayLookupBtn.className = eliteAiEnabled
            ? 'bg-indigo-100 text-indigo-700 h-10 w-10 rounded-full bubbly-button flex-shrink-0 transition-colors hover:bg-indigo-200'
            : 'bg-slate-100 text-slate-400 h-10 w-10 rounded-full bubbly-button flex-shrink-0 border border-slate-200 transition-colors hover:bg-slate-200';
        namedayLookupBtn.title = eliteAiEnabled ? 'AI Nameday Lookup' : 'Elite plan: AI Nameday Lookup';
        namedayLookupBtn.setAttribute('aria-label', namedayLookupBtn.title);
    }

    if (!heroProgressionEnabled) {
        classDropdown.disabled = true;
        classDropdown.title = 'Hero Classes & Skill Tree are available on Pro and above.';
        if (tierNote) {
            tierNote.className = 'text-[10px] text-rose-500 mt-2 font-bold';
            tierNote.textContent = 'Pro feature: Hero Classes and Skill Tree are locked on Starter.';
        }
    } else if (student.isHeroClassLocked) {
        classDropdown.disabled = true;
        classDropdown.title = "This student has already used their one-time class change.";
        if (tierNote) {
            tierNote.className = 'text-[10px] text-indigo-400 mt-2 italic';
            tierNote.textContent = 'This student has used their one-time class change.';
        }
    } else {
        classDropdown.disabled = false;
        classDropdown.title = "";
        if (tierNote) {
            tierNote.className = 'text-[10px] text-indigo-400 mt-2 italic';
            tierNote.textContent = 'Classes grant +10 extra Gold Coins when earning stars for their specific trait.';
        }
    }
    showAnimatedModal('edit-student-modal');
}

export async function openQuestAssignmentModal() {
    const classId = state.get('globalSelectedClassId');
    if (!classId) {
        showToast('Choose a class from the header first.', 'info');
        return;
    }

    const modal = document.getElementById('quest-assignment-modal');
    modal.dataset.editingId = '';
    document.getElementById('quest-assignment-confirm-btn').innerText = 'Save Assignment';

    document.getElementById('quest-assignment-class-id').value = classId;
    const previousAssignmentTextEl = document.getElementById('previous-assignment-text');
    const currentAssignmentTextarea = document.getElementById('quest-assignment-textarea');
    const dateChipEl = document.getElementById('quest-assignment-date-chip');

    previousAssignmentTextEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    currentAssignmentTextarea.value = '';
    clearQuestTestFields();
    if (dateChipEl) {
        const labelEl = dateChipEl.querySelector('span');
        if (labelEl) labelEl.textContent = getTodayAssignmentChipText();
    }

    showAnimatedModal('quest-assignment-modal');

    try {
        const q = query(
            collection(db, `artifacts/great-class-quest/public/data/quest_assignments`),
            where("classId", "==", classId),
            where("createdBy.uid", "==", state.get('currentUserId')),
            orderBy("createdAt", "desc"),
            limit(1)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const lastAssignmentDoc = snapshot.docs[0];
            const lastAssignment = lastAssignmentDoc.data();

            // --- Quest Board test status (same rules as Scholar's Scroll / bulk log) ---
            let testBadgeHtml = '';
            if (lastAssignment.testData) {
                const assignmentStub = { ...lastAssignment, id: lastAssignmentDoc.id, classId: lastAssignment.classId || classId };
                const scheduledStatus = getScheduledAssessmentStatus(assignmentStub);
                const awaiting = scheduledStatus ? getStudentsAwaitingGradeForScheduledStatus(scheduledStatus) : [];

                if (!scheduledStatus) {
                    testBadgeHtml = '';
                } else if (scheduledStatus.isConcluded) {
                    testBadgeHtml = `
                        <div class="mb-6 bg-gradient-to-r from-emerald-50/80 to-white border-l-4 border-emerald-500 rounded-r-2xl p-4 shadow-sm flex items-center justify-between group pop-in">
                            <div class="flex items-start gap-4">
                                <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-xl shadow-sm">
                                    <i class="fas fa-check-circle"></i>
                                </div>
                                <div>
                                    <div class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-1">
                                        <i class="fas fa-medal text-[9px]"></i>
                                        <span>Test Completed</span>
                                    </div>
                                    <h4 class="font-bold text-emerald-900 text-lg leading-tight">${lastAssignment.testData.title}</h4>
                                    <p class="text-emerald-600/70 text-[10px] font-black mt-1 uppercase tracking-[0.1em]">${scheduledStatus.detailLabel} · ${scheduledStatus.chipLabel}</p>
                                </div>
                            </div>
                        </div>`;
                } else if (scheduledStatus.dayDiff >= 0) {
                    const dateDisplay = scheduledStatus.scheduledDate
                        ? scheduledStatus.scheduledDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                        : 'Date TBD';
                    testBadgeHtml = `
                        <div class="mb-6 bg-gradient-to-r from-amber-50/80 to-white border-l-4 border-amber-500 rounded-r-2xl p-4 shadow-sm flex items-center justify-between group pop-in">
                            <div class="flex items-start gap-4">
                                <div class="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-xl shadow-sm animate-pulse">
                                    <i class="fas fa-bolt"></i>
                                </div>
                                <div>
                                    <div class="inline-flex items-center gap-1.5 rounded-full bg-amber-100/50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 mb-1">
                                        <i class="fas fa-calendar-alt text-[9px]"></i>
                                        <span>Test Scheduled</span>
                                    </div>
                                    <h4 class="font-bold text-amber-900 text-lg leading-tight">${lastAssignment.testData.title}</h4>
                                    <p class="text-amber-600/70 text-sm font-bold mt-1 tracking-tight">${dateDisplay}</p>
                                    <p class="text-amber-800/80 text-xs font-semibold mt-1">${scheduledStatus.statusLabel} · ${scheduledStatus.chipLabel}${awaiting.length ? ` · ${awaiting.length} still need a grade` : ''}</p>
                                    ${lastAssignment.testData.curriculum ? `<p class="text-gray-400 text-[10px] font-black mt-1.5 uppercase tracking-widest opacity-80">Topics: ${lastAssignment.testData.curriculum}</p>` : ''}
                                </div>
                            </div>
                        </div>`;
                } else {
                    const daysLate = Math.abs(scheduledStatus.dayDiff);
                    testBadgeHtml = `
                        <div class="mb-6 bg-gradient-to-r from-orange-50/90 to-white border-l-4 border-orange-600 rounded-r-2xl p-4 shadow-sm flex items-center justify-between group pop-in">
                            <div class="flex items-start gap-4 min-w-0">
                                <div class="w-12 h-12 bg-orange-100 text-orange-700 rounded-xl flex items-center justify-center text-xl shadow-sm shrink-0">
                                    <i class="fas fa-exclamation-circle"></i>
                                </div>
                                <div class="min-w-0">
                                    <div class="inline-flex items-center gap-1.5 rounded-full bg-orange-100/60 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-800 mb-1">
                                        <i class="fas fa-pen-alt text-[9px]"></i>
                                        <span>Grading still open</span>
                                    </div>
                                    <h4 class="font-bold text-orange-950 text-lg leading-tight">${lastAssignment.testData.title}</h4>
                                    <p class="text-orange-800/85 text-xs font-semibold mt-1">${scheduledStatus.dateLabel} was test day (${daysLate} day${daysLate === 1 ? '' : 's'} ago).</p>
                                    <p class="text-orange-900/80 text-[11px] font-bold mt-1">${scheduledStatus.chipLabel}${awaiting.length ? ` · ${awaiting.length} student${awaiting.length === 1 ? '' : 's'} awaiting a score` : ''}. Open Scholar's Scroll → Log Test — the correct title &amp; date are filled automatically.</p>
                                    ${lastAssignment.testData.curriculum ? `<p class="text-gray-400 text-[10px] font-black mt-1.5 uppercase tracking-widest opacity-80">Topics: ${lastAssignment.testData.curriculum}</p>` : ''}
                                </div>
                            </div>
                        </div>`;
                }
            }
            
            // --- SMART FORMATTER START ---
            const formatAssignmentText = (text) => {
                const lines = text.split('\n');
                let html = '';
                
                // Check if any line starts with a number pattern to decide if we use List Mode
                const hasList = lines.some(l => l.trim().match(/^(\d+)[\.\)]\s+/));
                
                if (!hasList) {
                    // Standard Text Mode (preserve line breaks)
                    return `<p class="text-gray-800 italic whitespace-pre-wrap">${text}</p>`;
                }

                // List Mode
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return;

                    // Match "1. " or "1) "
                    const match = trimmed.match(/^(\d+)[\.\)]\s+(.*)/);
                    
                    if (match) {
                        const [_, num, content] = match;
                        // Styled Card for List Item
                        html += `
                            <div class="flex items-start gap-3 mb-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm transition-transform hover:translate-x-1">
                                <span class="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-indigo-500 text-white text-xs font-bold rounded-full mt-0.5 shadow-sm">${num}</span>
                                <span class="text-gray-800 text-sm leading-relaxed">${content}</span>
                            </div>`;
                    } else {
                        // Regular text (headers, notes)
                        html += `<p class="text-gray-600 text-xs font-bold uppercase tracking-wider mb-2 mt-3 ml-1">${trimmed}</p>`;
                    }
                });
                return `<div class="space-y-1 mt-2">${html}</div>`;
            };
            
            const formattedContent = formatAssignmentText(lastAssignment.text || '');
            const dateStr = utils.getDDMMYYYY(lastAssignment.createdAt?.toDate ? lastAssignment.createdAt.toDate() : lastAssignment.createdAt);

            previousAssignmentTextEl.innerHTML = `
                <div class="relative mb-6">
                    <div class="flex items-center gap-2 mb-1">
                         <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-400 flex items-center justify-center text-xs shadow-sm border border-indigo-100/50">
                            <i class="fas fa-calendar-alt"></i>
                        </div>
                        <span class="text-[11px] font-black text-indigo-300 uppercase tracking-[0.15em]">${dateStr}</span>
                    </div>
                    
                    <button id="edit-last-assignment-btn" 
                        class="absolute top-0 right-0 group/edit w-10 h-10 bg-white hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm border border-indigo-50 hover:border-indigo-600 active:scale-95 z-20"
                        title="Edit Previous Assignment">
                        <i class="fas fa-pen-nib text-sm transition-transform group-hover/edit:rotate-12"></i>
                    </button>
                </div>

                ${testBadgeHtml}
                <div class="prose prose-indigo max-w-none text-gray-600 leading-relaxed selection:bg-indigo-100">${formattedContent}</div>
            `;
            // --- SMART FORMATTER END ---

            document.getElementById('edit-last-assignment-btn').onclick = () => {
                currentAssignmentTextarea.value = stripLegacyAssignmentDatePrefix(lastAssignment.text || '');
                modal.dataset.editingId = lastAssignmentDoc.id;
                document.getElementById('quest-assignment-confirm-btn').innerText = 'Update Assignment';
                
                if (lastAssignment.testData) {
                    const { testDate, testTitle, testCurriculum } = getQuestTestElements();
                    if (testDate) testDate.value = lastAssignment.testData.date || '';
                    if (testTitle) testTitle.value = lastAssignment.testData.title || '';
                    if (testCurriculum) testCurriculum.value = lastAssignment.testData.curriculum || '';
                    refreshQuestTestPanelSummary();
                }

                currentAssignmentTextarea.focus();
            };
        } else {
            previousAssignmentTextEl.textContent = "No previous assignment was set for this class.";
        }

    } catch (error) {
        console.error("Error loading previous assignment:", error);
        previousAssignmentTextEl.textContent = "Could not load the previous assignment.";
    }
}

export function openMoveStudentModal(studentId) {
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;
    const currentClass = state.get('allSchoolClasses').find(c => c.id === student.classId);
    if (!currentClass) return;

    const modal = document.getElementById('move-student-modal');
    modal.dataset.studentId = studentId;

    document.getElementById('move-student-name').innerText = student.name;
    document.getElementById('move-student-current-class').innerText = `${currentClass.logo} ${currentClass.name}`;

    const targetClassSelect = document.getElementById('move-student-target-class');
    const possibleClasses = state.get('allSchoolClasses').filter(c => c.questLevel === currentClass.questLevel && c.id !== currentClass.id);

    if (possibleClasses.length === 0) {
        targetClassSelect.innerHTML = `<option value="">No other classes in this league.</option>`;
        document.getElementById('move-student-confirm-btn').disabled = true;
    } else {
        targetClassSelect.innerHTML = possibleClasses.map(c => `<option value="${c.id}">${c.logo} ${c.name} (by ${c.createdBy.name})</option>`).join('');
        document.getElementById('move-student-confirm-btn').disabled = false;
    }
    
    showAnimatedModal('move-student-modal');

}

// --- SINGLE STARFALL (Used for individual entry edit or correction) ---
export function showStarfallModal(studentId, studentName, bonusAmount, trialType) {
    playSound('magic_chime');

    // Toggle views
    document.getElementById('starfall-single-view').classList.remove('hidden');
    document.getElementById('starfall-batch-view').classList.add('hidden');

    document.getElementById('starfall-student-name').innerText = studentName;
    const confirmBtn = document.getElementById('starfall-confirm-btn');
    confirmBtn.innerText = `Yes, Bestow ${bonusAmount} Star! ✨`;

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        handleAwardBonusStar(studentId, bonusAmount, trialType); 
        hideModal('starfall-modal');
    });

    showAnimatedModal('starfall-modal');
}

// --- BATCH STARFALL (New Function) ---
export function showBatchStarfallModal(eligibleStudents) {
    playSound('magic_chime');

    // Toggle views
    document.getElementById('starfall-single-view').classList.add('hidden');
    document.getElementById('starfall-batch-view').classList.remove('hidden');

    const listEl = document.getElementById('starfall-batch-list');
    listEl.innerHTML = eligibleStudents.map(s => `
        <div class="flex justify-between items-center p-2 border-b border-white/20 last:border-0">
            <span class="font-semibold text-white">${s.name}</span>
            <span class="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">+${s.bonusAmount} ⭐</span>
        </div>
    `).join('');

    const confirmBtn = document.getElementById('starfall-confirm-btn');
    const totalStars = eligibleStudents.reduce((sum, s) => sum + s.bonusAmount, 0);
    confirmBtn.innerText = `Yes, Bestow Bonus Stars! ✨`;

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        handleBatchAwardBonus(eligibleStudents); 
        hideModal('starfall-modal');
    });

    showAnimatedModal('starfall-modal');
}
