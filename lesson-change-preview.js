// Preview harness for the Lesson Change slip (see lesson-change-preview.vite.mjs).
import * as state from './state.js';
import { openLessonChange } from './ui/modals/lessonChange.js';
import { getClassesOnDay, getClassDayChronicleInsight, getMonthlyLessonBalanceForDate } from './utils.js';

const bunnies = { id: 'c1', name: 'Bunnies', logo: '🐰', questLevel: 'A', scheduleDays: ['1', '4'], timeStart: '17:00', timeEnd: '18:30', createdBy: { uid: 't1', name: 'Nasos' } };
const owls = { id: 'c2', name: 'Owls', logo: '🦉', questLevel: 'B', scheduleDays: ['1', '3'], timeStart: '18:30', timeEnd: '20:00', createdBy: { uid: 't1', name: 'Nasos' } };
state.setCurrentUserId('t1');
state.setSchoolYearState({ activeYearKey: '2026-2027' });
state.set('currentTeacherName', 'Nasos');
state.setAllSchoolClasses([bunnies, owls]);
state.setAllTeachersClasses([bunnies, owls]);
state.set('allScheduleOverrides', []);
state.set('allAttendanceRecords', [{ id: 'a1', classId: 'c1', studentId: 's1', date: '23-11-2026', markedBy: { uid: 't1' } }]);
state.set('allAwardLogs', []);
state.set('allQuestAssignments', [{ id: 'q1', classId: 'c1', text: 'Workbook p. 12', testData: { date: '2026-11-23', title: 'Unit 3 test' }, createdBy: { uid: 't1', name: 'Nasos' }, createdAt: { seconds: 1763900000 } }]);

const log = (...a) => { document.getElementById('pv-log').textContent += a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') + '\n'; };
window.__lcApply = (ops) => {
    let overrides = state.get('allScheduleOverrides').slice();
    let att = state.get('allAttendanceRecords').slice();
    let qa = state.get('allQuestAssignments').slice();
    for (const [kind, ref, data] of ops) {
        const col = ref.col.split('/').pop();
        log(kind, col, ref.id, data ? JSON.stringify({ ...data, createdAt: undefined }) : '');
        if (col === 'schedule_overrides') {
            if (kind === 'delete') overrides = overrides.filter((o) => o.id !== ref.id);
            else overrides.push({ id: ref.id, ...data });
        } else if (col === 'attendance' && kind === 'delete') att = att.filter((r) => r.id !== ref.id);
        else if (col === 'quest_assignments') {
            if (kind === 'delete') qa = qa.filter((r) => r.id !== ref.id); else qa.push({ id: ref.id, ...data });
        }
    }
    state.set('allScheduleOverrides', overrides);
    state.set('allAttendanceRecords', att);
    state.setAllQuestAssignments(qa);
    const wed = getClassesOnDay('25-11-2026', [bunnies, owls], overrides, {}).map((c) => `${c.name} ${c.timeStart}-${c.timeEnd}${c.makeupFor ? ' makeup for ' + c.makeupFor : ''}`);
    log('Wed lessons:', wed);
    log('Mon insight:', getClassDayChronicleInsight('c1', '23-11-2026', [bunnies], overrides, [], {}));
    log('Nov balance:', getMonthlyLessonBalanceForDate(bunnies, [], overrides, new Date(2026, 10, 1)));
    log('Test now:', qa.find((a) => a.classId === 'c1')?.testData);
};

document.getElementById('pv-bar').addEventListener('click', (e) => {
    const k = e.target.dataset.pv;
    if (k === 'missed' || k === 'edit') openLessonChange({ classId: 'c1', missedDate: '23-11-2026' });
    if (k === 'makeup') openLessonChange({ classId: 'c1', makeupDate: '25-11-2026', mode: 'makeup' });
});
const params = new URLSearchParams(location.search);
if (params.get('open') === 'missed') openLessonChange({ classId: 'c1', missedDate: '23-11-2026' });
if (params.get('open') === 'makeup') openLessonChange({ classId: 'c1', makeupDate: '25-11-2026', mode: 'makeup' });
