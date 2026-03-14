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
    serverTimestamp,
    getDoc,
    setDoc
} from '../../firebase.js';
import * as state from '../../state.js';
import { showToast } from '../../ui/effects.js';
import { classColorPalettes } from '../../constants.js';
import { simpleHashCode } from '../../utils.js';
import { getLimit } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { getUpgradeMessage } from '../../config/tiers/features.js';

const publicDataPath = 'artifacts/great-class-quest/public/data';

/**
 * Create a class in Firestore. Used by handleAddClass and by the first-user setup flow.
 * @param {object} data - { name, questLevel, logo?, scheduleDays?, timeStart?, timeEnd? }
 */
export async function createClass(data) {
    const { name, questLevel, logo = '📚', scheduleDays = [], timeStart = '', timeEnd = '' } = data;
    if (!name || !questLevel) {
        showToast('Please fill in both Class Name and Quest Level.', 'error');
        return;
    }
    const randomColor = classColorPalettes[simpleHashCode(name) % classColorPalettes.length];
    await addDoc(collection(db, `${publicDataPath}/classes`), {
        name,
        questLevel,
        logo,
        scheduleDays,
        timeStart,
        timeEnd,
        color: randomColor,
        createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
        createdAt: serverTimestamp()
    });
    showToast('Class created successfully!', 'success');
}

export async function handleAddClass() {
    const maxClasses = getLimit('maxClasses');
    const maxTeachers = getLimit('maxTeachers');
    const classes = state.get('allSchoolClasses') || [];
    const userId = state.get('currentUserId');

    if (maxClasses !== null && classes.length >= maxClasses) {
        showUpgradePrompt({ feature: 'More classes', tier: 'Pro', message: getUpgradeMessage('Pro', 'maxClasses') });
        return;
    }
    const teacherIds = new Set(classes.map(c => c.createdBy?.uid).filter(Boolean));
    const isNewTeacher = userId && !teacherIds.has(userId);
    if (maxTeachers !== null && isNewTeacher && teacherIds.size >= maxTeachers) {
        showUpgradePrompt({ feature: 'More teachers', tier: 'Pro', message: getUpgradeMessage('Pro', 'maxTeachers') });
        return;
    }

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
    } catch (error) {
        console.error("Error adding class: ", error);
        showToast(`Error: ${error.message}`, 'error');
    }
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
    } catch (error) {
        console.error("Error deleting class: ", error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

export async function handleEditClass() {
    const classId = document.getElementById('edit-class-id').value;
    const name = document.getElementById('edit-class-name').value;
    const level = document.getElementById('edit-class-level').value;
    if (!name || !level) {
        showToast('Please fill in all fields.', 'error');
        return;
    }
    const logo = document.getElementById('edit-class-logo').value;
    const timeStart = document.getElementById('edit-class-time-start').value;
    const timeEnd = document.getElementById('edit-class-time-end').value;
    const scheduleDays = Array.from(document.querySelectorAll('input[name="edit-schedule-day"]:checked')).map(cb => cb.value);

    try {
        const classRef = doc(db, "artifacts/great-class-quest/public/data/classes", classId);
        await updateDoc(classRef, { name, questLevel: level, logo, timeStart, timeEnd, scheduleDays });
        showToast('Class updated successfully!', 'success');
        document.getElementById('edit-class-modal').classList.add('hidden');
    } catch (error) {
        console.error("Error updating class: ", error);
        showToast(`Error: ${error.message}`, 'error');
    }
}
