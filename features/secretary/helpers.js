import * as state from '../../state.js';
import { getAssessmentValueLabel } from '../assessmentConfig.js';

export function getStudentMap() {
    return new Map((state.get('allStudents') || []).map((item) => [item.id, item]));
}

export function getClassMap() {
    return new Map((state.get('allSchoolClasses') || []).map((item) => [item.id, item]));
}

export function getStudentScoreMap() {
    return new Map((state.get('allStudentScores') || []).map((item) => [item.id, item]));
}

export function getLatestScoresByStudent() {
    const latestMap = new Map();
    (state.get('allWrittenScores') || [])
        .slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .forEach((item) => {
            if (item.studentId && !latestMap.has(item.studentId)) {
                latestMap.set(item.studentId, item);
            }
        });
    return latestMap;
}

export function filteredClasses() {
    const query = String(state.get('secretaryView')?.classFilter || '').trim().toLowerCase();
    const classes = state.get('allSchoolClasses') || [];
    if (!query) return classes;
    return classes.filter((item) =>
        String(item.name || '').toLowerCase().includes(query) ||
        String(item.questLevel || '').toLowerCase().includes(query) ||
        String(item.createdBy?.name || '').toLowerCase().includes(query)
    );
}

export function filteredStudents() {
    const query = String(state.get('secretaryView')?.studentFilter || '').trim().toLowerCase();
    const students = state.get('allStudents') || [];
    if (!query) return students;
    return students.filter((item) =>
        String(item.name || '').toLowerCase().includes(query) ||
        String(item.heroClass || '').toLowerCase().includes(query)
    );
}

export function getActiveThread() {
    const threads = state.get('currentCommunicationThreads') || [];
    const selectedThreadId = state.get('currentCommunicationThreadId');
    return threads.find((thread) => thread.id === selectedThreadId) || threads[0] || null;
}

export function getThreadTypeMeta(threadType) {
    const type = String(threadType || 'message').trim().toLowerCase();
    const metaMap = {
        homework: { label: 'Homework', icon: 'fa-scroll', tone: 'sky' },
        'progress-share': { label: 'Progress Update', icon: 'fa-chart-line', tone: 'emerald' },
        celebration: { label: 'Celebration', icon: 'fa-star', tone: 'amber' },
        'attendance-alert': { label: 'Attendance', icon: 'fa-calendar-xmark', tone: 'rose' },
        'meeting-request': { label: 'Meeting Request', icon: 'fa-handshake', tone: 'violet' },
        'admin-announcement': { label: 'Announcement', icon: 'fa-bullhorn', tone: 'indigo' },
        'school-message': { label: 'School Message', icon: 'fa-envelope-open-text', tone: 'slate' }
    };
    return metaMap[type] || { label: 'School Message', icon: 'fa-envelope-open-text', tone: 'slate' };
}

export function getThreadStudentLabel(thread, studentMap, classMap) {
    const student = studentMap.get(thread.studentId);
    const classData = student ? classMap.get(student.classId) : null;
    return {
        studentName: student?.name || thread.studentName || 'Student',
        className: classData?.name || thread.className || 'Class'
    };
}

export function avatarVariant(name = '') {
    const colors = ['sky', 'violet', 'emerald', 'rose', 'amber', 'indigo'];
    return colors[(name.charCodeAt(0) || 0) % colors.length];
}

export function getLatestScoreSummary() {
    const writtenScores = state.get('allWrittenScores') || [];
    const latestScore = writtenScores.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
    if (!latestScore) return null;
    const studentMap = getStudentMap();
    const classMap = getClassMap();
    const student = studentMap.get(latestScore.studentId);
    const classData = classMap.get(latestScore.classId);
    return {
        score: latestScore,
        student,
        classData,
        label: getAssessmentValueLabel(latestScore, classData) || latestScore.scoreQualitative || 'Recorded'
    };
}
