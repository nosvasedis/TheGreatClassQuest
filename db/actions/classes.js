// /db/actions/classes.js
// Class management actions: create, delete, update classes

import {
    db,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    serverTimestamp
} from '../../firebase.js';
import * as state from '../../state.js';
import { showToast } from '../../ui/effects.js';
import { hideModal } from '../../ui/modals.js';
import { classColorPalettes } from '../../constants.js';
import { simpleHashCode } from '../../utils.js';
import { getLimit } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { getUpgradeMessage } from '../../config/tiers/features.js';
import { normalizeClassAssessmentConfig } from '../../features/assessmentConfig.js';
import { withSchoolYear } from '../../utils/schoolYear.js';

const publicDataPath = 'artifacts/great-class-quest/public/data';

function normalizeCreatedBy(createdBy) {
    const uid = String(createdBy?.uid || state.get('currentUserId') || '').trim();
    const name = String(createdBy?.name || state.get('currentTeacherName') || 'Teacher').trim() || 'Teacher';
    if (!uid) {
        throw new Error('A teacher is required to create a class.');
    }
    return { uid, name };
}

export function getClassCreationLimitError(teacherUid) {
    const maxClasses = getLimit('maxClasses');
    const maxTeachers = getLimit('maxTeachers');
    const classes = (state.get('allSchoolClasses') || []).filter((item) => item.status !== 'archived');
    if (maxClasses !== null && classes.length >= maxClasses) {
        return {
            feature: 'More classes',
            tier: 'Pro',
            message: getUpgradeMessage('Pro', 'maxClasses')
        };
    }
    const teacherIds = new Set(classes.map((item) => item.createdBy?.uid).filter(Boolean));
    const assignedUid = String(teacherUid || state.get('currentUserId') || '').trim();
    const isNewTeacher = assignedUid && !teacherIds.has(assignedUid);
    if (maxTeachers !== null && isNewTeacher && teacherIds.size >= maxTeachers) {
        return {
            feature: 'More teachers',
            tier: 'Pro',
            message: getUpgradeMessage('Pro', 'maxTeachers')
        };
    }
    return null;
}

export function showClassCreationLimitIfNeeded(teacherUid) {
    const error = getClassCreationLimitError(teacherUid);
    if (!error) return false;
    showUpgradePrompt(error);
    return true;
}

/**
 * Create a class in Firestore. Used by handleAddClass, first-user setup, and the secretary class desk.
 * @param {object} data - { name, questLevel, logo?, scheduleDays?, timeStart?, timeEnd?, createdBy? }
 * @param {object} [options]
 * @param {boolean} [options.silent]
 * @returns {Promise<string|null>} new class id
 */
export async function createClass(data, options = {}) {
    const { name, questLevel, logo = '📚', scheduleDays = [], timeStart = '', timeEnd = '' } = data;
    if (!name || !questLevel) {
        showToast('Please fill in both Class Name and Quest Level.', 'error');
        return null;
    }
    const owner = normalizeCreatedBy(data.createdBy);
    const randomColor = classColorPalettes[simpleHashCode(name) % classColorPalettes.length];
    const docRef = await addDoc(collection(db, `${publicDataPath}/classes`), withSchoolYear({
        name,
        questLevel,
        logo,
        scheduleDays,
        timeStart,
        timeEnd,
        assessmentConfig: normalizeClassAssessmentConfig({ inheritSchoolDefaults: true }, questLevel),
        color: randomColor,
        status: 'active',
        createdBy: owner,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    }, state.getActiveSchoolYearKey()));
    if (!options.silent) showToast('Class created successfully!', 'success');
    return docRef.id;
}

export async function handleAddClass() {
    const userId = state.get('currentUserId');
    if (showClassCreationLimitIfNeeded(userId)) return;

    const form = document.getElementById('add-class-form');
    const name = document.getElementById('class-name').value;
    const level = document.getElementById('class-level').value;
    if (!name || !level) {
        showToast('Please fill in both Class Name and Quest Level.', 'error');
        return;
    }
    const logo = document.getElementById('class-logo').value;
    const timeStart = document.getElementById('class-time-start').value;
    const timeEnd = document.getElementById('class-time-end').value;
    const scheduleDays = Array.from(document.querySelectorAll('input[name="schedule-day"]:checked')).map(cb => cb.value);

    try {
        await createClass({ name, questLevel: level, logo, scheduleDays, timeStart, timeEnd });
        form.reset();
        if (document.getElementById('logo-picker-btn')) document.getElementById('logo-picker-btn').innerText = '📚';
        if (document.getElementById('class-logo')) document.getElementById('class-logo').value = '📚';
        if (document.getElementById('class-name-suggestions')) document.getElementById('class-name-suggestions').innerHTML = '';
        hideModal('create-class-modal');
    } catch (error) {
        console.error("Error adding class: ", error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

export async function updateClassDetails(classId, data, options = {}) {
    const name = String(data.name || '').trim();
    const questLevel = String(data.questLevel || '').trim();
    if (!classId || !name || !questLevel) {
        showToast('Please fill in both Class Name and Quest League.', 'error');
        return false;
    }
    const classRef = doc(db, `${publicDataPath}/classes`, classId);
    await updateDoc(classRef, {
        name,
        questLevel,
        logo: data.logo || '📚',
        timeStart: data.timeStart || '',
        timeEnd: data.timeEnd || '',
        scheduleDays: Array.isArray(data.scheduleDays) ? data.scheduleDays : [],
        updatedAt: serverTimestamp()
    });
    if (!options.silent) showToast('Class updated successfully!', 'success');
    return true;
}

export async function deleteClass(classId) {
    try {
        const studentsQuery = query(collection(db, `${publicDataPath}/students`), where("classId", "==", classId));
        const studentSnapshot = await getDocs(studentsQuery);
        const studentIdsInClass = studentSnapshot.docs.map(d => d.id);
        const batch = writeBatch(db);

        studentSnapshot.forEach(d => batch.delete(d.ref));
        studentIdsInClass.forEach(studentId => batch.delete(doc(db, `${publicDataPath}/student_scores`, studentId)));

        if (studentIdsInClass.length > 0) {
            const todayStarsQuery = query(collection(db, `${publicDataPath}/today_stars`), where("studentId", "in", studentIdsInClass));
            const todayStarsSnapshot = await getDocs(todayStarsQuery);
            todayStarsSnapshot.forEach(d => batch.delete(d.ref));

            const attendanceQuery = query(collection(db, `${publicDataPath}/attendance`), where("studentId", "in", studentIdsInClass));
            const attendanceSnapshot = await getDocs(attendanceQuery);
            attendanceSnapshot.forEach(d => batch.delete(d.ref));
        }

        batch.delete(doc(db, `${publicDataPath}/classes`, classId));
        batch.delete(doc(db, `${publicDataPath}/story_data`, classId));

        const historySnapshot = await getDocs(collection(db, `${publicDataPath}/story_data/${classId}/story_history`));
        historySnapshot.forEach(d => batch.delete(d.ref));

        await batch.commit();
        showToast('Class and all associated data deleted.', 'success');
        return true;
    } catch (error) {
        console.error("Error deleting class: ", error);
        showToast(`Error: ${error.message}`, 'error');
        return false;
    }
}

export async function deleteEmptyClass(classId) {
    const roster = (state.get('allStudents') || []).filter((student) => (
        student.classId === classId && student.enrollmentStatus !== 'inactive'
    ));
    if (roster.length) {
        showToast('This class still has students. Move them first.', 'error');
        return false;
    }
    return deleteClass(classId);
}

export async function handleEditClass() {
    const classId = document.getElementById('edit-class-id').value;
    const name = document.getElementById('edit-class-name').value;
    const level = document.getElementById('edit-class-level').value;
    const logo = document.getElementById('edit-class-logo').value;
    const timeStart = document.getElementById('edit-class-time-start').value;
    const timeEnd = document.getElementById('edit-class-time-end').value;
    const scheduleDays = Array.from(document.querySelectorAll('input[name="edit-schedule-day"]:checked')).map(cb => cb.value);

    try {
        await updateClassDetails(classId, {
            name,
            questLevel: level,
            logo,
            timeStart,
            timeEnd,
            scheduleDays
        });
        hideModal('edit-class-modal');
    } catch (error) {
        console.error("Error updating class: ", error);
        showToast(`Error: ${error.message}`, 'error');
    }
}
