import * as state from '../state.js';
import * as modals from '../ui/modals.js';
import { db, doc, setDoc, writeBatch } from '../firebase.js';
import { showToast } from '../ui/effects.js';
import { postCommunicationMessage, backfillRoleAccessData } from '../utils/adminRuntime.js';
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

export function activateSecretaryTab(tabKey, options) {
    const resolved = resolveTabKey(tabKey);
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
    const resolved = resolveTabKey(tabKey);
    const renderer = TAB_RENDERERS[resolved];
    const section = document.querySelector(`[data-secretary-section="${resolved}"]`);
    if (!renderer || !section) return;
    section.innerHTML = renderer();
    wireAssessmentEditorsForTab(resolved);
}

export function renderSecretaryConsole(tabKey) {
    const titleEl = document.querySelector('[data-secretary-title]');
    if (titleEl) titleEl.textContent = 'Secretary Office';

    if (tabKey) {
        renderSecretaryTab(resolveTabKey(tabKey));
        return;
    }

    const activeTab = getActiveTabKey();
    renderSecretaryTab(activeTab);
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
            state.setSecretaryView({ adminSubTab: adminSubTabBtn.dataset.secretaryAdminSubtab });
            renderSecretaryTab('admin');
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
            modals.openEditClassModal(editClassBtn.dataset.secretaryEditClass);
            return;
        }

        const editStudentBtn = event.target.closest('[data-secretary-edit-student]');
        if (editStudentBtn) {
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
            await saveSecretaryAssessmentSettings(saveAssessmentBtn);
            return;
        }

        const backfillBtn = event.target.closest('#secretary-run-backfill-btn');
        if (backfillBtn) {
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
        }
    });
}

export { GRADES_PAGE_SIZE };
