// /ui/tabs/ideas.js
import * as state from '../../state.js';
import * as storyWeaver from '../../features/storyWeaver.js';

export function renderIdeasTabSelects() {
    storyWeaver.handleStoryWeaversClassSelect();
}

export function renderStarManagerStudentSelect() {
    const select = document.getElementById('star-manager-student-select');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Select a student...</option>';

    const allTeachersClasses = state.get('allTeachersClasses');
    if (allTeachersClasses.length === 0) {
        select.innerHTML = '<option value="">No students found in your classes</option>';
        return;
    }

    const classesMap = allTeachersClasses.reduce((acc, c) => {
        acc[c.id] = { name: c.name, students: [] };
        return acc;
    }, {});

    const studentsInMyClasses = state.get('allStudents').filter(s => classesMap[s.classId]);

    if (studentsInMyClasses.length === 0) {
        select.innerHTML = '<option value="">No students found in your classes</option>';
        return;
    }

    studentsInMyClasses.forEach(s => {
        classesMap[s.classId].students.push(s);
    });

    const sortedClassIds = Object.keys(classesMap).sort((a, b) => classesMap[a].name.localeCompare(b.name));
    sortedClassIds.forEach(classId => {
        const classData = classesMap[classId];
        if (classData.students.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = classData.name;
            classData.students.sort((a, b) => a.name.localeCompare(b.name));
            classData.students.forEach(s => {
                const option = document.createElement('option');
                option.value = s.id;
                option.textContent = s.name;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        }
    });
    select.value = currentVal;
}
