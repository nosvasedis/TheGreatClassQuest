import * as state from '../state.js';
import * as modals from '../ui/modals.js';
import { db, doc, setDoc, writeBatch } from '../firebase.js';
import { showToast } from '../ui/effects.js';
import { postCommunicationMessage, backfillRoleAccessData, updateSecretaryCredentials } from '../utils/adminRuntime.js';
import { canUseFeature } from '../utils/subscription.js';
import {
    initializeSchoolLocationOptionsUi,
    handleSearchSchoolLocationFromOptions,
    handleSchoolLocationResultChange,
    handleSaveSchoolLocationFromOptions
} from '../db/actions/school.js';
import { handleAddHolidayRange, handleDeleteHolidayRange } from '../db/actions/log.js';
import { renderHolidayList } from '../ui/core/misc.js';
import { auth, EmailAuthProvider, reauthenticateWithCredential } from '../firebaseAuth.js';
import { getBillingAuthHeaders } from '../utils/billingCheckout.js';
import { BILLING_BASE_URL, BILLING_SCHOOL_ID, firebaseConfig } from '../constants.js';
import {
    readAssessmentCardValue,
    readAssessmentDefaultsFromContainer,
    wireAssessmentEditor
} from '../ui/assessmentEditor.js';
import {
    normalizeAssessmentDefaultsByLeague,
    normalizeClassAssessmentConfig
} from './assessmentConfig.js';
import {
    wireSchoolYearConsoleHandlers,
    handleSchoolYearConsoleClick
} from './schoolYearConsole.js';
import { activateSecretaryTab as activateRoleSecretaryTab } from '../ui/roles/navigation.js';
import { escapeHtml, setBusyState } from './roles/shared.js';
import { renderSecretaryHome } from './secretary/home.js';
import { renderSecretarySchool } from './secretary/school.js';
import { renderSecretaryGrades, GRADES_PAGE_SIZE } from './secretary/grades.js';
import { renderSecretaryMessages } from './secretary/messages.js';
import { renderSecretaryAdmin } from './secretary/admin.js';
import { getActiveThread } from './secretary/helpers.js';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';

let listenersWired = false;
let secretaryCallbacks = {
    onLogout: null,
    onOpenTeacherView: null,
    onSelectThread: null
};

const TAB_RENDERERS = {
    home: renderSecretaryHome,
    school: renderSecretarySchool,
    grades: renderSecretaryGrades,
    messages: renderSecretaryMessages,
    admin: renderSecretaryAdmin
};

const LEGACY_TAB_MAP = {
    overview: 'home',
    classes: 'school',
    students: 'school',
    academics: 'grades',
    communications: 'messages',
    'school-year': 'admin',
    settings: 'admin'
};

function resolveTabKey(tabKey) {
    return LEGACY_TAB_MAP[tabKey] || tabKey || 'home';
}

function getActiveTabKey() {
    const panel = document.querySelector('[data-secretary-section]:not(.hidden)');
    return panel?.dataset.secretarySection || state.get('secretaryView')?.activeTab || 'home';
}

function wireAssessmentEditorsForTab(tabKey) {
    if (tabKey !== 'admin' || state.get('secretaryView')?.adminSubTab !== 'grading') return;
    const defaultsEditor = document.getElementById('secretary-assessment-defaults-editor');
    const classEditor = document.getElementById('secretary-class-assessment-editor');
    if (defaultsEditor) wireAssessmentEditor(defaultsEditor);
    if (classEditor) wireAssessmentEditor(classEditor);
}

function hasFullSecretaryConsole() {
    return canUseFeature('secretaryAccess');
}

function applySecretaryTierUi() {
    const hasFullAccess = hasFullSecretaryConsole();
    document.querySelectorAll('[data-secretary-tab="grades"], [data-secretary-tab="messages"]')
        .forEach((button) => button.classList.toggle('hidden', !hasFullAccess));
    document.querySelectorAll('[data-secretary-edit-class], [data-secretary-edit-student]')
        .forEach((button) => button.classList.toggle('hidden', !hasFullAccess));
}

export function activateSecretaryTab(tabKey, options) {
    let resolved = resolveTabKey(tabKey);
    if (!hasFullSecretaryConsole() && (resolved === 'grades' || resolved === 'messages')) {
        resolved = 'admin';
        state.setSecretaryView({ adminSubTab: 'settings' });
        showToast('School-wide editing and family messaging require the Elite Secretary Console.', 'info');
    }
    void import('../db/listeners.js').then(({ activateDataFeature, deactivateDataFeature }) => {
        if (resolved === 'school' || resolved === 'grades') {
            activateDataFeature('assessments');
            activateDataFeature('attendance');
        } else {
            deactivateDataFeature('assessments');
            deactivateDataFeature('attendance');
        }
    });
    if (resolved === 'school' && tabKey === 'students') {
        state.setSecretaryView({ schoolSubTab: 'students' });
    } else if (resolved === 'school' && tabKey === 'classes') {
        state.setSecretaryView({ schoolSubTab: 'classes' });
    } else if (resolved === 'admin' && (tabKey === 'settings' || tabKey === 'school-year')) {
        state.setSecretaryView({ adminSubTab: tabKey === 'settings' ? 'settings' : 'year' });
    }
    state.setSecretaryView({ activeTab: resolved });
    activateRoleSecretaryTab(resolved, options);
    renderSecretaryTab(resolved);
}

export function renderSecretaryTab(tabKey) {
    let resolved = resolveTabKey(tabKey);
    if (!hasFullSecretaryConsole() && (resolved === 'grades' || resolved === 'messages')) resolved = 'admin';
    const renderer = TAB_RENDERERS[resolved];
    const section = document.querySelector(`[data-secretary-section="${resolved}"]`);
    if (!renderer || !section) return;
    section.innerHTML = renderer();
    wireAssessmentEditorsForTab(resolved);
    if (resolved === 'admin' && document.getElementById('secretary-school-name-form')) {
        initializeSchoolLocationOptionsUi();
        renderHolidayList();
    }
    applySecretaryTierUi();
}

export function renderSecretaryConsole(tabKey) {
    const titleEl = document.querySelector('[data-secretary-title]');
    if (titleEl) {
        titleEl.textContent = 'Secretary Office';
        titleEl.dataset.text = 'Secretary Office';
    }

    if (tabKey) {
        renderSecretaryTab(resolveTabKey(tabKey));
        return;
    }

    const activeTab = getActiveTabKey();
    renderSecretaryTab(activeTab);
}

async function openSecretaryBillingPortal(button) {
    let billingUrl = String(BILLING_BASE_URL || '').trim().replace(/\/$/, '');
    if (billingUrl && !/^https?:\/\//i.test(billingUrl)) billingUrl = `https://${billingUrl}`;
    const schoolId = BILLING_SCHOOL_ID || firebaseConfig?.projectId || '';
    if (!billingUrl || !schoolId) {
        modals.showModal('Subscription', 'Billing is not configured for this school yet.', null, 'OK', 'Close');
        return;
    }
    try {
        setBusyState(button, true, 'Opening Stripe...');
        const response = await fetch(`${billingUrl}/create-portal-session`, {
            method: 'POST',
            headers: await getBillingAuthHeaders({
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': '1'
            }),
            body: JSON.stringify({ schoolId, returnUrl: window.location.href })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.url) throw new Error(data?.error || 'Stripe did not return a billing portal link.');
        window.location.href = data.url;
    } catch (error) {
        console.error('Could not open Secretary billing portal:', error);
        modals.showModal('Subscription', error?.message || 'Could not open subscription management.', null, 'OK', 'Close');
    } finally {
        setBusyState(button, false);
    }
}

async function saveSecretarySchoolName(button) {
    const input = document.getElementById('secretary-school-name-input');
    const newName = input?.value?.trim() || '';
    if (!newName) {
        showToast('School name cannot be empty.', 'error');
        return;
    }

    try {
        setBusyState(button, true, 'Saving...');
        await setDoc(doc(db, `${PUBLIC_DATA_PATH}/school_settings`, 'holidays'), { schoolName: newName }, { merge: true });
        state.setSchoolName(newName);
        document.querySelectorAll('[data-school-name]').forEach((el) => {
            el.textContent = newName;
        });
        showToast('School name updated.', 'success');
    } catch (error) {
        console.error('Could not save school name:', error);
        showToast('Could not save the school name.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

async function saveSecretaryAssessmentSettings(button) {
    const defaultsContainer = document.getElementById('secretary-assessment-defaults-editor');
    const classCard = document.querySelector('#secretary-class-assessment-editor [data-assessment-card]');
    if (!defaultsContainer) return;

    try {
        setBusyState(button, true, 'Saving...');
        const schoolDefaults = normalizeAssessmentDefaultsByLeague(readAssessmentDefaultsFromContainer(defaultsContainer));
        const batch = writeBatch(db);
        batch.set(doc(db, `${PUBLIC_DATA_PATH}/school_settings`, 'holidays'), { assessmentDefaultsByLeague: schoolDefaults }, { merge: true });

        const updatedSchoolClasses = (state.get('allSchoolClasses') || []).map((classData) => ({ ...classData }));

        if (classCard) {
            const classId = (classCard.dataset.cardKey || '').replace('secretary-class-', '');
            const classData = updatedSchoolClasses.find((item) => item.id === classId);
            if (classData) {
                const assessmentConfig = normalizeClassAssessmentConfig(
                    readAssessmentCardValue(classCard, { allowInherit: true }),
                    classData.questLevel
                );
                classData.assessmentConfig = assessmentConfig;
                batch.set(doc(db, `${PUBLIC_DATA_PATH}/classes`, classId), { assessmentConfig }, { merge: true });
            }
        }

        await batch.commit();
        state.setSchoolAssessmentDefaults(schoolDefaults);
        state.setAllSchoolClasses(updatedSchoolClasses);
        state.setAllTeachersClasses(updatedSchoolClasses);
        showToast('Grading settings updated.', 'success');
        renderSecretaryTab('admin');
    } catch (error) {
        console.error('Could not save assessment settings:', error);
        showToast('Could not save grading settings.', 'error');
    } finally {
        setBusyState(button, false);
    }
}

export function wireSecretaryConsoleListeners({ onLogout, onOpenTeacherView, onSelectThread }) {
    secretaryCallbacks = { onLogout, onOpenTeacherView, onSelectThread };
    wireSchoolYearConsoleHandlers({ onRerender: () => renderSecretaryTab('admin') });
    if (listenersWired) return;
    listenersWired = true;

    document.getElementById('secretary-logout-btn')?.addEventListener('click', () => secretaryCallbacks.onLogout?.());
    document.getElementById('secretary-open-teacher-app-btn')?.addEventListener('click', () => secretaryCallbacks.onOpenTeacherView?.());

    document.getElementById('secretary-screen')?.addEventListener('click', async (event) => {
        if (handleSchoolYearConsoleClick(event)) return;

        const navBtn = event.target.closest('.nav-button[data-secretary-tab]');
        if (navBtn) {
            state.setSecretaryView({ messageView: 'inbox' });
            activateSecretaryTab(navBtn.dataset.secretaryTab || 'home');
            return;
        }

        const tabLinkBtn = event.target.closest('[data-secretary-tab-link]');
        if (tabLinkBtn) {
            const tab = tabLinkBtn.dataset.secretaryTabLink;
            if (tabLinkBtn.dataset.secretaryAdminSubtab) {
                state.setSecretaryView({ adminSubTab: tabLinkBtn.dataset.secretaryAdminSubtab, activeTab: 'admin' });
            }
            if (tabLinkBtn.dataset.secretarySchoolSubtab) {
                state.setSecretaryView({ schoolSubTab: tabLinkBtn.dataset.secretarySchoolSubtab, activeTab: 'school' });
            }
            activateSecretaryTab(tab);
            return;
        }

        const schoolSubTabBtn = event.target.closest('[data-secretary-school-subtab]');
        if (schoolSubTabBtn) {
            state.setSecretaryView({ schoolSubTab: schoolSubTabBtn.dataset.secretarySchoolSubtab });
            renderSecretaryTab('school');
            return;
        }

        const adminSubTabBtn = event.target.closest('[data-secretary-admin-subtab]');
        if (adminSubTabBtn) {
            if (adminSubTabBtn.dataset.secretaryAdminSubtab === 'grading' && !hasFullSecretaryConsole()) {
                showToast('Grading administration requires the Elite Secretary Console.', 'info');
                return;
            }
            state.setSecretaryView({ adminSubTab: adminSubTabBtn.dataset.secretaryAdminSubtab });
            renderSecretaryTab('admin');
            return;
        }

        const assessmentDetailsBtn = event.target.closest('[data-secretary-assessment-details-action]');
        if (assessmentDetailsBtn) {
            const shouldOpen = assessmentDetailsBtn.dataset.secretaryAssessmentDetailsAction === 'open';
            document.querySelectorAll('#secretary-assessment-defaults-editor details[data-assessment-card]')
                .forEach((details) => { details.open = shouldOpen; });
            return;
        }

        const gradingClassBtn = event.target.closest('[data-secretary-grading-class]');
        if (gradingClassBtn) {
            state.setSecretaryView({ selectedGradingClassId: gradingClassBtn.dataset.secretaryGradingClass, adminSubTab: 'grading' });
            renderSecretaryTab('admin');
            return;
        }

        const gradesPageBtn = event.target.closest('[data-secretary-grades-page]');
        if (gradesPageBtn && !gradesPageBtn.disabled) {
            state.setSecretaryView({ gradesPage: Number(gradesPageBtn.dataset.secretaryGradesPage) });
            renderSecretaryTab('grades');
            return;
        }

        const messageViewBtn = event.target.closest('[data-secretary-message-view]');
        if (messageViewBtn) {
            state.setSecretaryView({ messageView: messageViewBtn.dataset.secretaryMessageView });
            renderSecretaryTab('messages');
            return;
        }

        const editClassBtn = event.target.closest('[data-secretary-edit-class]');
        if (editClassBtn) {
            if (!hasFullSecretaryConsole()) {
                showToast('School-wide class editing requires the Elite Secretary Console.', 'info');
                return;
            }
            modals.openEditClassModal(editClassBtn.dataset.secretaryEditClass);
            return;
        }

        const editStudentBtn = event.target.closest('[data-secretary-edit-student]');
        if (editStudentBtn) {
            if (!hasFullSecretaryConsole()) {
                showToast('School-wide student editing requires the Elite Secretary Console.', 'info');
                return;
            }
            modals.openEditStudentModal(editStudentBtn.dataset.secretaryEditStudent);
            return;
        }

        const chronicleBtn = event.target.closest('[data-secretary-chronicle]');
        if (chronicleBtn) {
            modals.openHeroChronicleModal(chronicleBtn.dataset.secretaryChronicle);
            return;
        }

        const threadBtn = event.target.closest('[data-secretary-thread]');
        if (threadBtn) {
            const threadId = threadBtn.dataset.secretaryThread;
            secretaryCallbacks.onSelectThread?.(threadId);
            state.setSecretaryView({ messageView: 'thread', activeTab: 'messages' });
            if (threadBtn.dataset.secretaryOpenMessages) {
                activateSecretaryTab('messages', { animate: false });
            } else {
                renderSecretaryTab('messages');
            }
            return;
        }

        const saveAssessmentBtn = event.target.closest('#secretary-save-assessment-btn');
        if (saveAssessmentBtn) {
            if (!hasFullSecretaryConsole()) return;
            await saveSecretaryAssessmentSettings(saveAssessmentBtn);
            return;
        }

        const backfillBtn = event.target.closest('#secretary-run-backfill-btn');
        if (backfillBtn) {
            if (!hasFullSecretaryConsole()) return;
            try {
                setBusyState(backfillBtn, true, 'Refreshing...');
                const result = await backfillRoleAccessData({});
                showToast(`Parent summaries refreshed for ${result?.parentSnapshotsUpdated || 0} students.`, 'success');
            } catch (error) {
                console.error('Could not refresh parent summaries:', error);
                showToast(error?.message || 'Could not refresh parent summaries.', 'error');
            } finally {
                setBusyState(backfillBtn, false);
            }
            return;
        }

        const searchLocationBtn = event.target.closest('#search-school-location-btn');
        if (searchLocationBtn) {
            await handleSearchSchoolLocationFromOptions();
            return;
        }

        const saveLocationBtn = event.target.closest('#save-school-location-btn');
        if (saveLocationBtn) {
            await handleSaveSchoolLocationFromOptions();
            return;
        }

        const addHolidayBtn = event.target.closest('#add-holiday-btn');
        if (addHolidayBtn) {
            await handleAddHolidayRange();
            renderHolidayList();
            return;
        }

        const deleteHolidayBtn = event.target.closest('.delete-holiday-btn');
        if (deleteHolidayBtn) {
            await handleDeleteHolidayRange(deleteHolidayBtn.dataset.id);
            renderHolidayList();
            return;
        }

        const billingBtn = event.target.closest('#secretary-manage-subscription-btn');
        if (billingBtn) {
            await openSecretaryBillingPortal(billingBtn);
            return;
        }

        const teacherBtn = event.target.closest('#secretary-open-teacher-from-settings-btn');
        if (teacherBtn) {
            secretaryCallbacks.onOpenTeacherView?.();
        }
    });

    document.getElementById('secretary-screen')?.addEventListener('submit', async (event) => {
        if (event.target.id === 'secretary-message-form') {
            event.preventDefault();
            const activeThread = getActiveThread();
            const body = document.getElementById('secretary-message-text')?.value?.trim();
            const messageType = document.getElementById('secretary-message-type')?.value || 'school-message';
            const sendBtn = document.getElementById('secretary-message-send-btn');
            if (!activeThread || !body) {
                showToast('Write a message first.', 'info');
                return;
            }
            try {
                setBusyState(sendBtn, true, 'Sending...');
                await postCommunicationMessage({
                    threadId: activeThread.id,
                    studentId: activeThread.studentId,
                    body,
                    messageType
                });
                document.getElementById('secretary-message-text').value = '';
                showToast('Message sent.', 'success');
            } catch (error) {
                console.error('Could not send secretary message:', error);
                showToast(error?.message || 'Could not send the message right now.', 'error');
            } finally {
                setBusyState(sendBtn, false);
            }
            return;
        }

        if (event.target.id === 'secretary-school-name-form') {
            event.preventDefault();
            await saveSecretarySchoolName(document.getElementById('secretary-school-name-save-btn'));
            return;
        }

        if (event.target.id === 'secretary-credentials-form') {
            event.preventDefault();
            const currentPassword = document.getElementById('secretary-current-password')?.value || '';
            const username = document.getElementById('secretary-new-username')?.value?.trim() || '';
            const password = document.getElementById('secretary-new-password')?.value || '';
            const button = document.getElementById('secretary-credentials-save-btn');
            if (!currentPassword || (!username && !password)) {
                showToast('Confirm the current password and enter a new username or password.', 'error');
                return;
            }
            try {
                setBusyState(button, true, 'Updating...');
                const user = auth.currentUser;
                if (!user?.email) throw new Error('Sign in again before changing credentials.');
                const credential = EmailAuthProvider.credential(user.email, currentPassword);
                await reauthenticateWithCredential(user, credential);
                await user.getIdToken(true);
                const payload = {};
                if (username) payload.username = username;
                if (password) payload.password = password;
                const result = await updateSecretaryCredentials(payload);
                showToast(`Secretary credentials updated${result?.username ? ` for ${result.username}` : ''}.`, 'success');
                event.target.reset();
            } catch (error) {
                console.error('Could not update Secretary credentials:', error);
                showToast(error?.message || 'Could not update Secretary credentials.', 'error');
            } finally {
                setBusyState(button, false);
            }
        }
    });

    document.getElementById('secretary-screen')?.addEventListener('input', (event) => {
        if (event.target.id === 'secretary-class-filter') {
            state.setSecretaryView({ classFilter: event.target.value, schoolSubTab: 'classes' });
            renderSecretaryTab('school');
            return;
        }
        if (event.target.id === 'secretary-student-filter') {
            state.setSecretaryView({ studentFilter: event.target.value, schoolSubTab: 'students' });
            renderSecretaryTab('school');
            return;
        }
        if (event.target.id === 'secretary-grades-search') {
            state.setSecretaryView({ gradesSearch: event.target.value, gradesPage: 0 });
            renderSecretaryTab('grades');
            return;
        }
        if (event.target.id === 'options-school-location-results') {
            handleSchoolLocationResultChange();
        }
    });
}

export { GRADES_PAGE_SIZE };
