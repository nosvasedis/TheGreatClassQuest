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
import { getScheduledAssessmentStatus, getStudentsAwaitingGradeForScheduledStatus, classUsesTests } from '../../features/assessmentConfig.js';
import { getGuildHouseDisplay, getGuildColors } from '../../features/guilds.js';
import { HERO_CLASSES, heroClassLockApplies } from '../../features/heroClasses.js';
import { getReasonDisplayName } from '../../features/heroSkillTree.js';
import { handleAvatarClick } from '../core/avatar.js';
import { getLiveYearGoldFromAppState } from '../../utils/yearGold.js';
import { escapeHtml } from '../../features/roles/shared.js';
import { isSecretaryOfficeActive } from '../../features/secretary/officeModal.js';
import { openMoveStudentModal } from './moveStudent.js';
import { PUBLIC_DATA_PATH } from '../../utils/tenant.mjs';

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

function applyQuestTestSchedulingVisibility(classData) {
    const scheduleBtn = document.getElementById('open-quest-test-modal-btn');
    const usesTests = classUsesTests(classData);
    if (scheduleBtn) scheduleBtn.classList.toggle('hidden', !usesTests);
    if (!usesTests) {
        clearQuestTestFields({ hide: false });
        const { summaryCard, headerBadge } = getQuestTestElements();
        summaryCard?.classList.add('hidden');
        headerBadge?.classList.add('hidden');
    }
    return usesTests;
}

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

// The passport shows every section at once; "switching tab" scrolls that section into view.
export function switchEditStudentTab(tabName) {
    const modal = document.getElementById('edit-student-modal');
    const section = document.getElementById(`edit-student-panel-${tabName}`);
    if (!modal || !section) return;
    modal.querySelectorAll('.edit-student-tab-panel').forEach(panel => panel.classList.remove('hidden', 'sp-section--flash'));
    if (tabName === 'profile') {
        modal.querySelector('.sp-spread')?.scrollTo({ top: 0 });
        return;
    }
    requestAnimationFrame(() => {
        section.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        void section.offsetWidth;
        section.classList.add('sp-section--flash');
    });
}

const SP_TRACKED_FIELD_IDS = [
    'edit-student-name-input-full',
    'edit-student-birthday-month',
    'edit-student-birthday-day',
    'edit-student-nameday-month',
    'edit-student-nameday-day',
];

function readPassportFields() {
    return SP_TRACKED_FIELD_IDS.map(id => document.getElementById(id)?.value ?? '');
}

// Stamps look inked once both month and day are picked; the footer says when there is something to save.
function refreshPassportState(modal) {
    if (!modal) return;
    ['birthday', 'nameday'].forEach(kind => {
        const month = document.getElementById(`edit-student-${kind}-month`)?.value;
        const day = document.getElementById(`edit-student-${kind}-day`)?.value;
        const stamp = modal.querySelector(`[data-stamp="${kind}"]`);
        const dateEl = modal.querySelector(`[data-stamp-date="${kind}"]`);
        if (dateEl) {
            const monthSelect = document.getElementById(`edit-student-${kind}-month`);
            const monthName = monthSelect?.selectedOptions?.[0]?.textContent || '';
            dateEl.textContent = month && day ? `${day} ${monthName}` : (month || day ? 'Pick day and month' : 'Not set yet');
        }
        if (stamp) {
            const wasSet = stamp.classList.contains('is-set');
            const isSet = Boolean(month && day);
            stamp.classList.toggle('is-set', isSet);
            if (isSet && !wasSet && modal.dataset.spReady === 'true') {
                stamp.classList.remove('is-stamping');
                void stamp.offsetWidth;
                stamp.classList.add('is-stamping');
            }
        }
    });

    const baseline = modal.dataset.spBaseline || '';
    const dirty = baseline !== '' && JSON.stringify(readPassportFields()) !== baseline;
    modal.classList.toggle('is-dirty', dirty);
    const note = document.getElementById('edit-student-dirty-note');
    if (note) note.textContent = dirty ? 'Unsaved changes' : 'No changes yet';
}

function bindPassportTracking(modal) {
    if (!modal || modal.dataset.spBound === 'true') return;
    modal.dataset.spBound = 'true';
    const onEdit = () => refreshPassportState(modal);
    modal.addEventListener('input', onEdit);
    modal.addEventListener('change', onEdit);
}

export function openEditStudentModal(studentId, options = {}) {
    const student = (state.get('allStudents') || []).find(s => s.id === studentId);
    if (!student) return;

    // 1. Basic IDs and Name
    const idInput = document.getElementById('edit-student-id-input-full');
    const nameInput = document.getElementById('edit-student-name-input-full');
    const titleEl = document.getElementById('edit-student-title');
    const subtitleEl = document.getElementById('edit-student-header-subtitle');

    if (idInput) idInput.value = studentId;
    if (nameInput) nameInput.value = student.name || '';
    if (titleEl) titleEl.textContent = student.name || 'Edit Student Details';

    // The Secretary Office holds the same passport, but with the office's own desk:
    // no classroom tools (portraits, skill trees, hero ceremonies) and never guild sorting.
    const officeMode = isSecretaryOfficeActive();
    const passportEl = document.getElementById('edit-student-modal');
    if (passportEl) passportEl.dataset.passportMode = officeMode ? 'office' : 'teacher';
    if (subtitleEl) {
        subtitleEl.textContent = officeMode
            ? 'Student record: identity, special days, class and office notes'
            : 'Customize profile, celebrations & hero path';
    }

    // 2. Fetch Class, Guild & Score Data
    const classData = (state.get('allSchoolClasses') || []).find(c => c.id === student.classId);
    const guildHouse = getGuildHouseDisplay(student.guildId);
    const scoreData = (state.get('allStudentScores') || []).find(s => s.id === studentId) || {};

    // 3. Header Avatar & Preview Box
    const headerAvatar = document.getElementById('edit-student-header-avatar');
    const avatarPreviewBox = document.getElementById('edit-student-avatar-preview-box');
    const avatarStatusEl = document.getElementById('edit-student-avatar-status');
    const heroIconBadge = document.getElementById('edit-student-hero-icon-badge');

    const heroIcon = HERO_CLASSES[student.heroClass]?.icon || '🌟';
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
            headerGuildBadge.style.setProperty('--sp-guild', getGuildColors(student.guildId).primary);
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
    if (statGold) statGold.textContent = `${getLiveYearGoldFromAppState(scoreData, state)} 🪙`;
    if (statHeroLevel) statHeroLevel.textContent = `Lvl ${scoreData.heroLevel ?? 1}`;

    // 6. Profile Tab Placement Information
    const currentClassDisplay = document.getElementById('edit-student-current-class-display');
    const currentLeagueDisplay = document.getElementById('edit-student-current-league-display');
    const currentGuildDisplay = document.getElementById('edit-student-current-guild-display');
    const currentGuildDesc = document.getElementById('edit-student-current-guild-desc');

    if (currentClassDisplay) {
        currentClassDisplay.textContent = classData
            ? `${classData.logo || '📚'} ${classData.name}`
            : (officeMode ? 'Waiting for a class' : 'No class assigned');
    }
    if (currentLeagueDisplay) {
        currentLeagueDisplay.textContent = classData?.questLevel
            || (officeMode
                ? (student.previousQuestLevel ? `${student.previousQuestLevel} league last year` : 'Seat them in a class')
                : 'Standard League');
    }
    if (currentGuildDisplay) currentGuildDisplay.textContent = guildHouse.label;
    if (currentGuildDesc) {
        // Guilds are for life: once sorted, a student is never sorted again.
        currentGuildDesc.textContent = guildHouse.assigned
            ? 'Member for life. Guilds never change.'
            : (officeMode ? 'Sorted in class by their teacher.' : guildHouse.description);
        currentGuildDesc.classList.toggle('sp-field__sub--warn', !guildHouse.assigned);
        currentGuildDesc.classList.toggle('sp-field__sub--ok', guildHouse.assigned);
    }

    // 7. Special Dates Dropdowns
    populateDateDropdowns('edit-student-birthday-month', 'edit-student-birthday-day', student.birthday);
    populateDateDropdowns('edit-student-nameday-month', 'edit-student-nameday-day', student.nameday);
    ['birthday', 'nameday'].forEach(kind => {
        const monthPlaceholder = document.getElementById(`edit-student-${kind}-month`)?.options[0];
        const dayPlaceholder = document.getElementById(`edit-student-${kind}-day`)?.options[0];
        if (monthPlaceholder) monthPlaceholder.textContent = 'Month';
        if (dayPlaceholder) dayPlaceholder.textContent = 'Day';
    });

    // Clear Date Buttons
    const clearBirthdayBtn = document.getElementById('edit-student-clear-birthday-btn');
    if (clearBirthdayBtn) {
        clearBirthdayBtn.onclick = () => {
            const bM = document.getElementById('edit-student-birthday-month');
            const bD = document.getElementById('edit-student-birthday-day');
            if (bM) bM.value = '';
            if (bD) bD.value = '';
            bM?.dispatchEvent(new Event('change', { bubbles: true }));
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
            nM?.dispatchEvent(new Event('change', { bubbles: true }));
            showToast('Nameday cleared.', 'info');
        };
    }

    // Nameday AI Lookup Button State
    const eliteAiEnabled = canUseFeature('eliteAI');
    const namedayLookupBtn = document.getElementById('lookup-nameday-btn');
    if (namedayLookupBtn) {
        namedayLookupBtn.classList.toggle('sp-lookup--locked', !eliteAiEnabled);
        namedayLookupBtn.title = eliteAiEnabled ? 'AI Nameday Lookup (Greek Orthodox calendar)' : 'Elite plan: AI Nameday Lookup';
        namedayLookupBtn.setAttribute('aria-label', namedayLookupBtn.title);
    }

    // 8. Hero Path summary + ceremony
    const tierNote = document.getElementById('hero-class-tier-note');
    const heroProgressionEnabled = canUseFeature('heroProgression');
    const isLocked = heroClassLockApplies(student, state.getActiveSchoolYearKey());
    const classInfo = student.heroClass ? HERO_CLASSES[student.heroClass] : null;

    const summaryIcon = document.getElementById('edit-student-hero-summary-icon');
    const summaryName = document.getElementById('edit-student-hero-summary-name');
    const summaryVirtue = document.getElementById('edit-student-hero-summary-virtue');
    const summaryPerk = document.getElementById('edit-student-hero-summary-perk');
    const chooseBtn = document.getElementById('edit-student-choose-hero-class-btn');
    const chooseLabel = document.getElementById('edit-student-choose-hero-class-label');

    if (summaryIcon) summaryIcon.textContent = classInfo?.icon || '🌟';
    if (summaryName) summaryName.textContent = classInfo ? student.heroClass : 'No Class';
    if (summaryVirtue) {
        summaryVirtue.textContent = classInfo
            ? getReasonDisplayName(classInfo.reason)
            : (heroProgressionEnabled ? 'Unassigned' : 'Pro feature');
    }
    if (summaryPerk) {
        summaryPerk.textContent = classInfo
            ? classInfo.desc
            : (officeMode
                ? 'Not chosen yet. Their teacher runs the ceremony in class.'
                : 'Leave unassigned, or open the ceremony so they can choose.');
    }
    if (chooseLabel) {
        chooseLabel.textContent = !heroProgressionEnabled
            ? 'Choose Hero Class'
            : isLocked
                ? 'Your Path'
                : (student.heroClass ? 'Change Hero Class' : 'Choose Hero Class');
    }
    if (chooseBtn) {
        chooseBtn.onclick = () => {
            if (!heroProgressionEnabled) {
                showUpgradePrompt({
                    feature: 'Hero Classes & Skill Tree',
                    tier: 'Pro',
                    message: getUpgradeMessage('Pro', 'heroProgression')
                });
                return;
            }
            import('./heroClass.js').then((h) => h.openHeroClassSelectModal(studentId, { restoreEditStudent: true }));
        };
    }

    const heroSummary = document.getElementById('edit-student-hero-summary');
    if (heroSummary) {
        heroSummary.classList.toggle('is-empty', !classInfo);
        heroSummary.classList.toggle('is-locked', heroProgressionEnabled && isLocked);
    }
    if (officeMode) {
        if (tierNote) {
            tierNote.className = 'sp-note sp-note--office';
            tierNote.textContent = 'Hero classes and skills are chosen in class with their teacher.';
        }
    } else if (!heroProgressionEnabled) {
        if (tierNote) {
            tierNote.className = 'sp-note sp-note--hero sp-note--pro';
            tierNote.textContent = '🔒 Pro feature: Hero Archetypes and Skill Trees are unlocked on Pro and above.';
        }
    } else if (isLocked) {
        if (tierNote) {
            tierNote.className = 'sp-note sp-note--hero sp-note--locked';
            tierNote.textContent = '🔒 Hero Class locked for this school year. They keep this class. Next year they can change it twice again.';
        }
    } else {
        if (tierNote) {
            tierNote.className = 'sp-note sp-note--hero';
            tierNote.textContent = '⚡ Active Perk: Classes grant +10 extra Gold when earning stars for their specific trait.';
        }
    }

    // 9. Unsaved-changes tracking, then bring the requested section into view
    const modalEl = document.getElementById('edit-student-modal');
    bindPassportTracking(modalEl);
    if (modalEl) {
        modalEl.dataset.spReady = 'false';
        modalEl.dataset.spBaseline = JSON.stringify(readPassportFields());
        refreshPassportState(modalEl);
        modalEl.dataset.spReady = 'true';
    }

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
    const officeMoveBtn = document.getElementById('edit-student-office-move-btn');
    const isWaitingForClass = !classData;
    const handleMove = () => {
        hideModal('edit-student-modal');
        if (officeMode) {
            import('../../features/secretary/studentDesk.js').then(d => d.openStudentMove(studentId));
            return;
        }
        openMoveStudentModal(studentId);
    };
    if (quickMoveBtn) quickMoveBtn.onclick = handleMove;
    if (hubMoveBtn) hubMoveBtn.onclick = handleMove;
    if (officeMoveBtn) officeMoveBtn.onclick = handleMove;
    // A waiting student can be seated from here: by the Office in any class, by a teacher in one of theirs.
    if (quickMoveBtn) quickMoveBtn.classList.remove('hidden');
    const quickMoveLabel = document.getElementById('edit-student-quick-move-label');
    if (quickMoveLabel) quickMoveLabel.textContent = isWaitingForClass ? 'Seat' : 'Move';
    const officeMoveLabel = document.getElementById('edit-student-office-move-label');
    if (officeMoveLabel) officeMoveLabel.textContent = isWaitingForClass ? 'Seat in a class' : 'Move class';

    // Guilds are for life: the sorting quiz is only offered to a student who has never been sorted.
    const quickGuildBtn = document.getElementById('edit-student-quick-guild-btn');
    const handleGuildQuiz = () => {
        hideModal('edit-student-modal');
        import('./sortingQuiz.js').then(sq => sq.openSortingQuizModal(studentId));
    };
    if (quickGuildBtn) {
        quickGuildBtn.onclick = handleGuildQuiz;
        quickGuildBtn.classList.toggle('hidden', officeMode || guildHouse.assigned);
    }

    // Secretary Office desk
    const officeNotesBtn = document.getElementById('edit-student-office-notes-btn');
    const officeNotesCount = document.getElementById('edit-student-office-notes-count');
    if (officeNotesBtn) {
        officeNotesBtn.onclick = () => {
            hideModal('edit-student-modal');
            import('../../features/secretary/studentDesk.js').then(d => d.openStudentNotes(studentId));
        };
    }
    if (officeNotesCount) {
        const noteCount = (state.get('allHeroChronicleNotes') || []).filter(n => n.studentId === studentId).length;
        officeNotesCount.textContent = String(noteCount);
        officeNotesCount.classList.toggle('hidden', !noteCount);
    }
    const officeFamilyBtn = document.getElementById('edit-student-office-family-btn');
    if (officeFamilyBtn) {
        officeFamilyBtn.classList.toggle('hidden', !canUseFeature('parentAccess'));
        officeFamilyBtn.onclick = () => {
            hideModal('edit-student-modal');
            import('../../features/secretary/familyLogins.js').then(f => f.openFamilyLogin(studentId));
        };
    }
    const officeGradesBtn = document.getElementById('edit-student-office-grades-btn');
    if (officeGradesBtn) {
        officeGradesBtn.onclick = () => {
            hideModal('edit-student-modal');
            state.setSecretaryView({ gradesBoardSubTab: 'scroll', gradesSearch: student.name || '', gradesPage: 0 });
            import('../../features/secretaryConsole.js').then(c => c.activateSecretaryTab('grades'));
        };
    }
    const officeLeaveBtn = document.getElementById('edit-student-office-leave-btn');
    if (officeLeaveBtn) {
        officeLeaveBtn.onclick = () => {
            hideModal('edit-student-modal');
            import('../../features/secretary/formerStudents.js').then(f => f.openLeaveDialog(studentId));
        };
    }

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
    switchEditStudentTab(options.tab || 'profile');
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
    const classData = state.get('allSchoolClasses').find((item) => item.id === classId)
        || state.get('allTeachersClasses').find((item) => item.id === classId)
        || null;
    const usesTests = applyQuestTestSchedulingVisibility(classData);
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
    import('../../features/bookProgress.js').then(m => m.attachBookRecognition(classId)).catch(console.error);

    try {
        const q = query(
            collection(db, `${PUBLIC_DATA_PATH}/quest_assignments`),
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
                        <div class="qb-test-slip qb-test-slip--done pop-in">
                            <span class="qb-test-slip__icon" aria-hidden="true"><i class="fas fa-check"></i></span>
                            <div class="qb-test-slip__text">
                                <span class="qb-test-slip__kicker">Test done</span>
                                <strong>${escapeHtml(lastAssignment.testData.title)}</strong>
                                <span>${scheduledStatus.detailLabel} · ${scheduledStatus.chipLabel}</span>
                            </div>
                        </div>`;
                } else if (scheduledStatus.dayDiff >= 0) {
                    const dateDisplay = scheduledStatus.scheduledDate
                        ? scheduledStatus.scheduledDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                        : 'Date TBD';
                    testBadgeHtml = `
                        <div class="qb-test-slip qb-test-slip--upcoming pop-in">
                            <span class="qb-test-slip__icon" aria-hidden="true"><i class="fas fa-bolt"></i></span>
                            <div class="qb-test-slip__text">
                                <span class="qb-test-slip__kicker">Test scheduled · ${dateDisplay}</span>
                                <strong>${escapeHtml(lastAssignment.testData.title)}</strong>
                                <span>${scheduledStatus.statusLabel} · ${scheduledStatus.chipLabel}</span>
                                ${lastAssignment.testData.curriculum ? `<span class="qb-test-slip__topics">Topics: ${escapeHtml(lastAssignment.testData.curriculum)}</span>` : ''}
                            </div>
                        </div>`;
                } else {
                    const daysLate = Math.abs(scheduledStatus.dayDiff);
                    testBadgeHtml = `
                        <div class="qb-test-slip qb-test-slip--late pop-in">
                            <span class="qb-test-slip__icon" aria-hidden="true"><i class="fas fa-exclamation"></i></span>
                            <div class="qb-test-slip__text">
                                <span class="qb-test-slip__kicker">Results still missing</span>
                                <strong>${escapeHtml(lastAssignment.testData.title)}</strong>
                                <span>${scheduledStatus.dateLabel} was test day (${daysLate} day${daysLate === 1 ? '' : 's'} ago).</span>
                                <span>${awaiting.length ? `${awaiting.length} student${awaiting.length === 1 ? '' : 's'} still need ${awaiting.length === 1 ? 'this result' : 'their results'} recorded.` : 'This test still has missing results.'} Open Scholar's Scroll and choose Log Test; the name and date are filled in for you.</span>
                                ${lastAssignment.testData.curriculum ? `<span class="qb-test-slip__topics">Topics: ${escapeHtml(lastAssignment.testData.curriculum)}</span>` : ''}
                            </div>
                        </div>`;
                }
            }
            
            // --- SMART FORMATTER START ---
            const formatAssignmentText = (text) => {
                const lines = text.split('\n');
                // Numbered lines ("1. " or "1) ") become a checklist; anything else keeps its line breaks.
                const hasList = lines.some(l => l.trim().match(/^(\d+)[\.\)]\s+/));
                if (!hasList) {
                    return `<p class="qb-card__text">${escapeHtml(text)}</p>`;
                }
                let html = '';
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return;
                    const match = trimmed.match(/^(\d+)[\.\)]\s+(.*)/);
                    if (match) {
                        const [, num, content] = match;
                        html += `<li class="qb-card__item"><span class="qb-card__num">${num}</span><span>${escapeHtml(content)}</span></li>`;
                    } else {
                        html += `<li class="qb-card__heading">${escapeHtml(trimmed)}</li>`;
                    }
                });
                return `<ol class="qb-card__list">${html}</ol>`;
            };
            
            const formattedContent = formatAssignmentText(lastAssignment.text || '');
            const createdDate = lastAssignment.createdAt?.toDate ? lastAssignment.createdAt.toDate() : lastAssignment.createdAt;
            const dateStr = utils.getDDMMYYYY(createdDate);
            const createdObj = utils.parseFlexibleDate(dateStr);
            const dateLabel = createdObj ? createdObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : dateStr;

            previousAssignmentTextEl.innerHTML = `
                <div class="qb-card__head">
                    <span class="qb-card__date">${dateLabel}</span>
                    <button id="edit-last-assignment-btn" type="button" class="qb-card__edit" title="Edit this assignment">
                        <i class="fas fa-pen-nib" aria-hidden="true"></i><span>Edit</span>
                    </button>
                </div>
                ${testBadgeHtml}
                ${formattedContent}
            `;
            // --- SMART FORMATTER END ---

            document.getElementById('edit-last-assignment-btn').onclick = () => {
                currentAssignmentTextarea.value = stripLegacyAssignmentDatePrefix(lastAssignment.text || '');
                modal.dataset.editingId = lastAssignmentDoc.id;
                document.getElementById('quest-assignment-confirm-btn').innerText = 'Update Assignment';
                
                if (usesTests && lastAssignment.testData) {
                    const { testDate, testTitle, testCurriculum } = getQuestTestElements();
                    if (testDate) testDate.value = lastAssignment.testData.date || '';
                    if (testTitle) testTitle.value = lastAssignment.testData.title || '';
                    if (testCurriculum) testCurriculum.value = lastAssignment.testData.curriculum || '';
                    refreshQuestTestPanelSummary();
                }

                currentAssignmentTextarea.focus();
            };
        } else {
            previousAssignmentTextEl.innerHTML = '<p class="qb-card__empty">Nothing pinned yet. Your first assignment for this class will appear here next time.</p>';
        }

    } catch (error) {
        console.error("Error loading previous assignment:", error);
        previousAssignmentTextEl.textContent = "Could not load the previous assignment.";
    }
}

export { openMoveStudentModal };

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

    const hasGrowth = eligibleStudents.some((s) => s.kind === 'growth');
    const messageEl = document.querySelector('#starfall-batch-view .starfall-message');
    if (messageEl) {
        messageEl.textContent = hasGrowth
            ? 'The stars are raining down! Some scholars shone, and some climbed far above their own recent best (🌱 Growth Starfall).'
            : 'The stars are raining down! These scholars have triggered a Starfall Bonus!';
    }

    const listEl = document.getElementById('starfall-batch-list');
    listEl.innerHTML = eligibleStudents.map(s => `
        <div class="flex justify-between items-center gap-2 p-2 border-b border-white/20 last:border-0">
            <span class="font-semibold text-white">${escapeHtml(s.name)}</span>
            <span class="flex items-center gap-1.5">
                ${s.kind === 'growth'
                    ? `<span class="starfall-growth-chip" title="${escapeHtml(`About ${Math.round(Number(s.jump) || 0)} points above their recent average`)}">🌱 Growth</span>`
                    : ''}
                <span class="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">+${s.bonusAmount} ⭐</span>
            </span>
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
