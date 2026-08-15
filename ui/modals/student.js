// /ui/modals/student.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import { db, query, collection, where, orderBy, limit, getDocs } from '../../firebase.js';
import { showAnimatedModal, showModal, hideModal, populateDateDropdowns } from './base.js';
import { showToast } from '../effects.js';
import { playSound } from '../../audio.js';
import { handleAwardBonusStar, handleBatchAwardBonus } from '../../db/actions.js';
import { canUseFeature } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { getUpgradeMessage } from '../../config/tiers/features.js';
import { getScheduledAssessmentStatus, getStudentsAwaitingGradeForScheduledStatus } from '../../features/assessmentConfig.js';
import { getGuildHouseDisplay } from '../../features/guilds.js';
import { handleAvatarClick } from '../core/avatar.js';

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

const HERO_ICONS = {
    'Guardian': '🛡️',
    'Sage': '🔮',
    'Paladin': '⚔️',
    'Artificer': '⚙️',
    'Scholar': '📜',
    'Weaver': '✒️',
    'Nomad': '👟'
};

function fillStudentPortrait(el, { studentId, name, avatarUrl, enlargeable }) {
    if (!el) return;
    el.classList.toggle('enlargeable-avatar', Boolean(enlargeable));
    if (enlargeable && studentId) {
        el.dataset.studentId = studentId;
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', 'View portrait');
        el.title = 'View portrait';
    } else {
        delete el.dataset.studentId;
        el.removeAttribute('role');
        el.removeAttribute('tabindex');
        el.removeAttribute('aria-label');
        el.removeAttribute('title');
    }
    el.style.backgroundImage = '';
    el.replaceChildren();
    if (avatarUrl) {
        const img = document.createElement('img');
        img.src = avatarUrl;
        img.alt = name ? `${name}'s portrait` : 'Student portrait';
        img.className = 'w-full h-full object-cover pointer-events-none';
        el.appendChild(img);
        return;
    }
    el.textContent = name ? name.trim().charAt(0).toUpperCase() : '?';
}

export function switchEditStudentTab(tabName) {
    const tabButtons = document.querySelectorAll('.edit-student-tab-btn');
    const tabPanels = document.querySelectorAll('.edit-student-tab-panel');

    tabButtons.forEach(btn => {
        const isSelected = btn.dataset.tab === tabName;
        btn.classList.toggle('active', isSelected);
        btn.classList.toggle('text-cyan-700', isSelected);
        btn.classList.toggle('bg-white', isSelected);
        btn.classList.toggle('shadow-sm', isSelected);
        btn.classList.toggle('border', isSelected);
        btn.classList.toggle('border-cyan-200/60', isSelected);

        btn.classList.toggle('text-slate-600', !isSelected);
        btn.classList.toggle('hover:text-slate-900', !isSelected);
        btn.classList.toggle('hover:bg-white/60', !isSelected);
        btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    tabPanels.forEach(panel => {
        panel.classList.add('hidden');
    });

    const activePanel = document.getElementById(`edit-student-panel-${tabName}`);
    if (activePanel) {
        activePanel.classList.remove('hidden');
    }
}

export function openEditStudentModal(studentId) {
    const student = (state.get('allStudents') || []).find(s => s.id === studentId);
    if (!student) return;

    // 1. Basic IDs and Name
    const idInput = document.getElementById('edit-student-id-input-full');
    const nameInput = document.getElementById('edit-student-name-input-full');
    const titleEl = document.getElementById('edit-student-title');
    const subtitleEl = document.getElementById('edit-student-header-subtitle');

    if (idInput) idInput.value = studentId;
    if (nameInput) nameInput.value = student.name || '';
    if (titleEl) titleEl.textContent = student.name ? `Edit ${student.name}` : 'Edit Student Details';
    if (subtitleEl) subtitleEl.textContent = 'Customize profile, celebrations & hero path';

    // 2. Fetch Class, Guild & Score Data
    const classData = (state.get('allSchoolClasses') || []).find(c => c.id === student.classId);
    const guildHouse = getGuildHouseDisplay(student.guildId);
    const scoreData = (state.get('allStudentScores') || []).find(s => s.id === studentId) || {};

    // 3. Header Avatar & Preview Box
    const headerAvatar = document.getElementById('edit-student-header-avatar');
    const avatarPreviewBox = document.getElementById('edit-student-avatar-preview-box');
    const avatarStatusEl = document.getElementById('edit-student-avatar-status');
    const heroIconBadge = document.getElementById('edit-student-hero-icon-badge');

    const heroIcon = HERO_ICONS[student.heroClass] || '🌟';
    if (heroIconBadge) heroIconBadge.textContent = heroIcon;

    fillStudentPortrait(headerAvatar, {
        studentId,
        name: student.name,
        avatarUrl: student.avatar,
        enlargeable: true,
    });
    fillStudentPortrait(avatarPreviewBox, {
        studentId,
        name: student.name,
        avatarUrl: student.avatar,
        enlargeable: false,
    });
    if (headerAvatar) {
        headerAvatar.onclick = (event) => {
            event.stopPropagation();
            handleAvatarClick(event);
        };
        headerAvatar.onkeydown = (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            handleAvatarClick(event);
        };
    }
    if (avatarStatusEl) {
        avatarStatusEl.textContent = student.avatar ? 'Custom hero portrait active' : 'Using initials';
    }

    // 4. Header Badges
    const headerClassBadge = document.getElementById('edit-student-header-class-badge');
    const headerGuildBadge = document.getElementById('edit-student-header-guild-badge');
    if (headerClassBadge) {
        headerClassBadge.textContent = classData ? `${classData.logo || '📚'} ${classData.name}` : 'No Class';
    }
    if (headerGuildBadge) {
        if (guildHouse.assigned) {
            headerGuildBadge.textContent = guildHouse.label;
            headerGuildBadge.classList.remove('hidden');
        } else {
            headerGuildBadge.classList.add('hidden');
        }
    }

    // 5. Stats Summary Row
    const statTotal = document.getElementById('edit-student-stat-total-stars');
    const statMonthly = document.getElementById('edit-student-stat-monthly-stars');
    const statGold = document.getElementById('edit-student-stat-gold');
    const statHeroLevel = document.getElementById('edit-student-stat-hero-level');

    if (statTotal) statTotal.textContent = `${scoreData.totalStars ?? 0} ⭐`;
    if (statMonthly) statMonthly.textContent = `${scoreData.monthlyStars ?? 0} 🌟`;
    if (statGold) statGold.textContent = `${scoreData.gold ?? 0} 🪙`;
    if (statHeroLevel) statHeroLevel.textContent = `Lvl ${scoreData.heroLevel ?? 1}`;

    // 6. Profile Tab Placement Information
    const currentClassDisplay = document.getElementById('edit-student-current-class-display');
    const currentLeagueDisplay = document.getElementById('edit-student-current-league-display');
    const currentGuildDisplay = document.getElementById('edit-student-current-guild-display');
    const currentGuildDesc = document.getElementById('edit-student-current-guild-desc');

    if (currentClassDisplay) currentClassDisplay.textContent = classData ? `${classData.logo || '📚'} ${classData.name}` : 'No class assigned';
    if (currentLeagueDisplay) currentLeagueDisplay.textContent = classData?.questLevel || 'Standard League';
    if (currentGuildDisplay) currentGuildDisplay.textContent = guildHouse.label;
    if (currentGuildDesc) {
        currentGuildDesc.textContent = guildHouse.description;
        currentGuildDesc.classList.toggle('text-amber-600', !guildHouse.assigned);
        currentGuildDesc.classList.toggle('text-emerald-700', guildHouse.assigned);
    }

    // 7. Special Dates Dropdowns
    populateDateDropdowns('edit-student-birthday-month', 'edit-student-birthday-day', student.birthday);
    populateDateDropdowns('edit-student-nameday-month', 'edit-student-nameday-day', student.nameday);

    // Clear Date Buttons
    const clearBirthdayBtn = document.getElementById('edit-student-clear-birthday-btn');
    if (clearBirthdayBtn) {
        clearBirthdayBtn.onclick = () => {
            const bM = document.getElementById('edit-student-birthday-month');
            const bD = document.getElementById('edit-student-birthday-day');
            if (bM) bM.value = '';
            if (bD) bD.value = '';
            showToast('Birthday cleared.', 'info');
        };
    }

    const clearNamedayBtn = document.getElementById('edit-student-clear-nameday-btn');
    if (clearNamedayBtn) {
        clearNamedayBtn.onclick = () => {
            const nM = document.getElementById('edit-student-nameday-month');
            const nD = document.getElementById('edit-student-nameday-day');
            if (nM) nM.value = '';
            if (nD) nD.value = '';
            showToast('Nameday cleared.', 'info');
        };
    }

    // Nameday AI Lookup Button State
    const eliteAiEnabled = canUseFeature('eliteAI');
    const namedayLookupBtn = document.getElementById('lookup-nameday-btn');
    if (namedayLookupBtn) {
        namedayLookupBtn.className = eliteAiEnabled
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white h-[42px] px-3.5 rounded-xl bubbly-button flex items-center justify-center gap-1.5 shadow-sm transition-all text-xs font-bold shrink-0 cursor-pointer'
            : 'bg-slate-200 text-slate-400 h-[42px] px-3.5 rounded-xl bubbly-button flex items-center justify-center gap-1.5 border border-slate-300 transition-all text-xs font-bold shrink-0 cursor-pointer';
        namedayLookupBtn.title = eliteAiEnabled ? 'AI Nameday Lookup (Greek Orthodox calendar)' : 'Elite plan: AI Nameday Lookup';
        namedayLookupBtn.setAttribute('aria-label', namedayLookupBtn.title);
    }

    // 8. Hero Progression & Interactive Archetype Cards
    const classDropdown = document.getElementById('edit-student-hero-class');
    const tierNote = document.getElementById('hero-class-tier-note');
    const heroProgressionEnabled = canUseFeature('heroProgression');
    const isLocked = Boolean(student.isHeroClassLocked);

    if (classDropdown) classDropdown.value = student.heroClass || "";

    if (!heroProgressionEnabled) {
        if (classDropdown) {
            classDropdown.disabled = true;
            classDropdown.title = 'Hero Classes & Skill Tree are available on Pro and above.';
        }
        if (tierNote) {
            tierNote.className = 'text-xs text-rose-600 leading-relaxed font-bold';
            tierNote.textContent = '🔒 Pro feature: Hero Archetypes and Skill Trees are unlocked on Pro and above.';
        }
    } else if (isLocked) {
        if (classDropdown) {
            classDropdown.disabled = true;
            classDropdown.title = "This student has already used their one-time class change.";
        }
        if (tierNote) {
            tierNote.className = 'text-xs text-indigo-700 leading-relaxed italic font-medium';
            tierNote.textContent = '🔒 Hero Class Locked: This student has already finalized their one-time archetype selection.';
        }
    } else {
        if (classDropdown) {
            classDropdown.disabled = false;
            classDropdown.title = "";
        }
        if (tierNote) {
            tierNote.className = 'text-xs text-indigo-700 leading-relaxed font-medium';
            tierNote.textContent = '⚡ Active Perk: Classes grant +10 extra Gold when earning stars for their specific trait.';
        }
    }

    // Helper to refresh hero cards visual state
    const refreshHeroCards = (selectedClass) => {
        document.querySelectorAll('.hero-archetype-card').forEach(card => {
            const cardClass = card.dataset.class;
            const isSelected = cardClass === (selectedClass || "");
            const checkIcon = card.querySelector('.hero-card-check');

            card.classList.toggle('active', isSelected);
            card.classList.toggle('card-disabled', !heroProgressionEnabled || isLocked);

            if (checkIcon) {
                checkIcon.classList.toggle('hidden', !isSelected);
                checkIcon.classList.toggle('flex', isSelected);
            }
        });

        // Update header icon
        if (heroIconBadge) {
            heroIconBadge.textContent = HERO_ICONS[selectedClass] || '🌟';
        }
    };

    refreshHeroCards(student.heroClass || "");

    // Attach click listeners to hero cards
    document.querySelectorAll('.hero-archetype-card').forEach(card => {
        card.onclick = () => {
            if (!heroProgressionEnabled) {
                showUpgradePrompt({
                    feature: 'Hero Classes & Skill Tree',
                    tier: 'Pro',
                    message: getUpgradeMessage('Pro', 'heroProgression')
                });
                return;
            }
            if (isLocked && card.dataset.class !== (student.heroClass || "")) {
                showToast('This student has already chosen their Hero Class and is now locked.', 'error');
                return;
            }
            const chosenClass = card.dataset.class;
            if (classDropdown) classDropdown.value = chosenClass;
            refreshHeroCards(chosenClass);
            playSound('button_click');
        };
    });

    // 9. Attach Tab Navigation Listeners
    document.querySelectorAll('.edit-student-tab-btn').forEach(btn => {
        btn.onclick = () => {
            switchEditStudentTab(btn.dataset.tab);
            playSound('tap');
        };
    });

    // Reset to first tab (Profile)
    switchEditStudentTab('profile');

    // 10. Top Close Button
    const topCloseBtn = document.getElementById('edit-student-top-close-btn');
    if (topCloseBtn) {
        topCloseBtn.onclick = () => hideModal('edit-student-modal');
    }

    // 11. Quick Action & Hub Buttons
    const openAvatarBtn = document.getElementById('edit-student-open-avatar-btn');
    const hubAvatarBtn = document.getElementById('edit-student-hub-avatar-btn');

    const handleOpenAvatar = () => {
        if (!canUseFeature('eliteAI')) {
            showUpgradePrompt({
                feature: 'Avatar Forge',
                tier: 'Elite',
                message: getUpgradeMessage('Elite')
            });
            return;
        }
        hideModal('edit-student-modal');
        import('../../features/avatar.js').then(a => a.openAvatarMaker(studentId));
    };

    if (openAvatarBtn) openAvatarBtn.onclick = handleOpenAvatar;
    if (hubAvatarBtn) hubAvatarBtn.onclick = handleOpenAvatar;

    const quickMoveBtn = document.getElementById('edit-student-quick-move-btn');
    const hubMoveBtn = document.getElementById('edit-student-hub-move-btn');
    const handleMove = () => {
        hideModal('edit-student-modal');
        openMoveStudentModal(studentId);
    };
    if (quickMoveBtn) quickMoveBtn.onclick = handleMove;
    if (hubMoveBtn) hubMoveBtn.onclick = handleMove;

    const quickGuildBtn = document.getElementById('edit-student-quick-guild-btn');
    const handleGuildQuiz = () => {
        hideModal('edit-student-modal');
        import('./sortingQuiz.js').then(sq => sq.openSortingQuizModal(studentId));
    };
    if (quickGuildBtn) quickGuildBtn.onclick = handleGuildQuiz;

    const openSkillTreeBtn = document.getElementById('edit-student-open-skilltree-btn');
    const hubSkillTreeBtn = document.getElementById('edit-student-hub-skilltree-btn');
    const handleSkillTree = () => {
        if (!heroProgressionEnabled) {
            showUpgradePrompt({
                feature: 'Hero Classes & Skill Tree',
                tier: 'Pro',
                message: getUpgradeMessage('Pro', 'heroProgression')
            });
            return;
        }
        hideModal('edit-student-modal');
        import('./skillTree.js').then(st => st.openSkillTreeModal(studentId));
    };
    if (openSkillTreeBtn) openSkillTreeBtn.onclick = handleSkillTree;
    if (hubSkillTreeBtn) hubSkillTreeBtn.onclick = handleSkillTree;

    const hubChronicleBtn = document.getElementById('edit-student-hub-chronicle-btn');
    if (hubChronicleBtn) {
        hubChronicleBtn.onclick = () => {
            hideModal('edit-student-modal');
            import('./hero.js').then(h => h.openHeroChronicleModal(studentId));
        };
    }

    const hubAnalyticsBtn = document.getElementById('edit-student-hub-analytics-btn');
    if (hubAnalyticsBtn) {
        hubAnalyticsBtn.onclick = () => {
            hideModal('edit-student-modal');
            import('./studentAnalytics.js').then(sa => sa.openStudentAnalyticsModal(studentId));
        };
    }

    const hubCertificateBtn = document.getElementById('edit-student-hub-certificate-btn');
    if (hubCertificateBtn) {
        hubCertificateBtn.onclick = () => {
            hideModal('edit-student-modal');
            import('./reports.js').then(r => r.handleGenerateCertificate(studentId));
        };
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
                                    <p class="text-amber-800/80 text-xs font-semibold mt-1">${scheduledStatus.statusLabel} · ${scheduledStatus.chipLabel}</p>
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
                                        <span>Test still needs results</span>
                                    </div>
                                    <h4 class="font-bold text-orange-950 text-lg leading-tight">${lastAssignment.testData.title}</h4>
                                    <p class="text-orange-800/85 text-xs font-semibold mt-1">${scheduledStatus.dateLabel} was test day (${daysLate} day${daysLate === 1 ? '' : 's'} ago).</p>
                                    <p class="text-orange-900/80 text-[11px] font-bold mt-1">${awaiting.length ? `${awaiting.length} student${awaiting.length === 1 ? '' : 's'} still need ${awaiting.length === 1 ? 'this result' : 'their results'} recorded.` : 'This test still has missing results.'} Open Scholar's Scroll and choose Log Test; the test name and date will already be filled in.</p>
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
