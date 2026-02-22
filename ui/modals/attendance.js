// /ui/modals/attendance.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import { showAnimatedModal, showModal } from './base.js';
import { showToast } from '../effects.js';
import { playSound } from '../../audio.js';
import { fetchAttendanceForMonth } from '../../db/queries.js';
import { handleMarkAbsent } from '../../db/actions.js';

// --- REVAMPED ATTENDANCE CHRONICLE MODAL ---

export async function openAttendanceChronicle() {
    const classId = document.getElementById('adventure-log-class-select').value;
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;

    // Reset view date to current month on open
    state.setAttendanceViewDate(new Date());

    document.getElementById('attendance-chronicle-title').innerHTML = `${classData.logo} Attendance Chronicle`;
    document.getElementById('attendance-chronicle-content').innerHTML = `<p class="text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading attendance records...</p>`;
    showAnimatedModal('attendance-chronicle-modal');

    await renderAttendanceChronicle(classId);
}

export async function renderAttendanceChronicle(classId) {
    const contentEl = document.getElementById('attendance-chronicle-content');
    const classData = state.get('allSchoolClasses').find(c => c.id === classId);
    const studentsInClass = state.get('allStudents').filter(s => s.classId === classId);

    if (!classData || studentsInClass.length === 0) {
        contentEl.innerHTML = `<p class="text-center text-gray-500 py-8">No students in this class to track attendance for.</p>`;
        return;
    }

    const viewDate = state.get('attendanceViewDate');
    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();
    const monthName = viewDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    // 1. Determine if we can go back/forward
    const competitionStart = constants.competitionStart;
    const canGoBack = new Date(currentYear, currentMonth, 1) > new Date(competitionStart.getFullYear(), competitionStart.getMonth(), 1);
    const canGoForward = new Date(currentYear, currentMonth + 1, 1) <= new Date();

    // 2. Fetch data if it's an old month not covered by real-time listener
    let attendanceRecords = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const viewMonthStart = new Date(currentYear, currentMonth, 1);
    
    if (viewMonthStart >= thirtyDaysAgo) {
        // Use real-time state
        attendanceRecords = state.get('allAttendanceRecords').filter(r => r.classId === classId);
    } else {
        // Fetch on demand
        contentEl.innerHTML = `<div class="text-center py-8 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Fetching historical data for ${monthName}...</div>`;
        attendanceRecords = await fetchAttendanceForMonth(classId, currentYear, currentMonth + 1);
    }

    // 3. Filter lesson dates for this specific month
    const scheduledDaysOfWeek = classData.scheduleDays || [];
    const lessonDates = [];
    
    // Generate all days in the month that match the schedule
    let loopDate = new Date(currentYear, currentMonth, 1);
    const overrides = state.get('allScheduleOverrides') || [];

    while (loopDate.getMonth() === currentMonth) {
        const dayOfWeek = loopDate.getDay().toString();
        const dateStr = utils.getDDMMYYYY(loopDate);
        
        // Check if this specific date has a "cancelled" override
        const isCancelled = overrides.some(o => 
            o.classId === classId && 
            o.date === dateStr && 
            o.type === 'cancelled'
        );

        if (scheduledDaysOfWeek.includes(dayOfWeek) && !isCancelled) {
            // Don't show future dates
            if (loopDate <= new Date()) {
                lessonDates.push(dateStr);
            }
        }
        loopDate.setDate(loopDate.getDate() + 1);
    }

    // Also include dates where attendance was actually taken (e.g. one-off lessons)
    attendanceRecords.forEach(r => {
        const rDate = utils.parseDDMMYYYY(r.date);
        if (rDate.getMonth() === currentMonth && rDate.getFullYear() === currentYear && !lessonDates.includes(r.date)) {
            lessonDates.push(r.date);
        }
    });

    lessonDates.sort((a,b) => utils.parseDDMMYYYY(a) - utils.parseDDMMYYYY(b));

    // 4. Build HTML
    let html = `
        <div class="flex items-center justify-between mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <button id="attendance-prev-btn" class="text-gray-600 hover:text-gray-800 font-bold py-1 px-3 rounded disabled:opacity-30" ${!canGoBack ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
            <span class="font-title text-xl text-gray-700">${monthName}</span>
            <button id="attendance-next-btn" class="text-gray-600 hover:text-gray-800 font-bold py-1 px-3 rounded disabled:opacity-30" ${!canGoForward ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
        </div>
    `;

    if(lessonDates.length === 0) {
        html += `<p class="text-center text-gray-500 py-8">No lessons recorded for this month.</p>`;
        contentEl.innerHTML = html;
    } else {
        const attendanceByStudent = attendanceRecords.reduce((acc, record) => {
            if (!acc[record.studentId]) acc[record.studentId] = new Set();
            acc[record.studentId].add(record.date);
            return acc;
        }, {});

        html += `<div class="overflow-x-auto rounded-lg border border-gray-200 shadow-sm"><table class="w-full border-collapse bg-white"><thead><tr class="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
            <th class="p-3 font-semibold text-left border-b sticky left-0 bg-gray-100 z-10 shadow-sm">Student</th>`;
        
        lessonDates.forEach(dateStr => {
            const d = utils.parseDDMMYYYY(dateStr);
            // MODIFIED: Added delete button to header
            html += `<th class="p-3 font-semibold text-center border-b min-w-[60px] align-top">
                <div class="attendance-header-container">
                    <span>${d.getDate()}</span>
                    <button class="delete-column-btn" data-date="${dateStr}" data-class-id="${classId}" title="Remove this day (Holiday/Cancelled)">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </th>`;
        });
        html += `</tr></thead><tbody>`;

        studentsInClass.forEach((student, index) => {
            const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
            html += `<tr class="${rowBg} hover:bg-gray-100 transition-colors">
                <td class="p-3 font-medium text-gray-800 border-r sticky left-0 ${rowBg} z-10">${student.name}</td>`;
            
            lessonDates.forEach(dateStr => {
                const isAbsent = attendanceByStudent[student.id]?.has(dateStr);
                const isEditable = viewMonthStart >= thirtyDaysAgo; 

                html += `<td class="p-3 text-center border-r border-gray-100">
                    <button class="attendance-status-btn w-6 h-6 rounded-full transition-transform transform hover:scale-110 focus:outline-none shadow-sm ${isAbsent ? 'status-absent bg-red-500' : 'status-present bg-green-500'}" 
                            data-student-id="${student.id}" 
                            data-date="${dateStr}" 
                            ${!isEditable ? 'disabled style="cursor: default; opacity: 0.7;"' : ''}
                            title="${isAbsent ? 'Absent' : 'Present'}">
                            ${isAbsent ? '<i class="fas fa-times text-white text-xs"></i>' : '<i class="fas fa-check text-white text-xs"></i>'}
                    </button>
                </td>`;
            });
            html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        
        const totalPossible = studentsInClass.length * lessonDates.length;
        let totalAbsences = 0;
        Object.values(attendanceByStudent).forEach(set => totalAbsences += set.size); 
        
        const attendanceRate = totalPossible > 0 ? ((totalPossible - totalAbsences) / totalPossible * 100).toFixed(1) : 100;

        html += `<div class="mt-4 text-right text-sm text-gray-500">
            Monthly Attendance Rate: <span class="font-bold ${attendanceRate > 90 ? 'text-green-600' : 'text-amber-600'}">${attendanceRate}%</span>
        </div>`;

        contentEl.innerHTML = html;
    }

    document.getElementById('attendance-prev-btn').addEventListener('click', () => changeAttendanceMonth(-1, classId));
    document.getElementById('attendance-next-btn').addEventListener('click', () => changeAttendanceMonth(1, classId));

    // Listener for toggling attendance status (Present/Absent)
    contentEl.querySelectorAll('.attendance-status-btn:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', (e) => toggleAttendanceRecord(e.currentTarget));
    });

    // NEW: Listeners for removing columns with Holiday option
    contentEl.querySelectorAll('.delete-column-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const dateStr = e.currentTarget.dataset.date;
            const cId = e.currentTarget.dataset.classId;
            
            // Inject a checkbox into the confirmation message
            const messageHtml = `
                <p class="mb-4">Mark <b>${dateStr}</b> as a "No Lesson" day?</p>
                <div class="bg-red-50 p-3 rounded-lg text-left border border-red-200">
                    <label class="flex items-center cursor-pointer">
                        <input type="checkbox" id="holiday-checkbox" class="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300">
                        <span class="ml-3 font-bold text-red-800">Is this a School Holiday?</span>
                    </label>
                    <p class="text-xs text-red-600 mt-1 ml-8">Checked: Removes this day for ALL classes.<br>Unchecked: Removes for THIS class only.</p>
                </div>
            `;

            showModal(
                'Remove Date?', 
                'placeholder', // We will replace this innerHTML immediately after
                () => {
                    // Check if the element exists before accessing checked property
                    const checkbox = document.getElementById('holiday-checkbox');
                    const isGlobal = checkbox ? checkbox.checked : false;
                    
                    // Dynamic import to avoid circular dependency issues if needed, or direct call
                    // We imported handleRemoveAttendanceColumn at the top of this file, so direct call is fine:
                    import('../../db/actions.js').then(actions => {
                        actions.handleRemoveAttendanceColumn(cId, dateStr, isGlobal);
                    });
                },
                'Confirm Removal'
            );
            
            // Hack to inject HTML into the simple modal
            const msgEl = document.getElementById('modal-message');
            if(msgEl) msgEl.innerHTML = messageHtml;
        });
    });
}

async function changeAttendanceMonth(delta, classId) {
    const currentViewDate = state.get('attendanceViewDate');
    currentViewDate.setMonth(currentViewDate.getMonth() + delta);
    state.setAttendanceViewDate(currentViewDate);
    await renderAttendanceChronicle(classId);
}

async function toggleAttendanceRecord(button) {
    playSound('click');
    const { studentId, date } = button.dataset;
    const isCurrentlyAbsent = button.classList.contains('status-absent');
    const student = state.get('allStudents').find(s => s.id === studentId);
    if (!student) return;

    button.classList.toggle('status-absent', !isCurrentlyAbsent);
    button.classList.toggle('status-present', isCurrentlyAbsent);
    button.classList.toggle('bg-red-500', !isCurrentlyAbsent);
    button.classList.toggle('bg-green-500', isCurrentlyAbsent);
    button.innerHTML = !isCurrentlyAbsent ? '<i class="fas fa-times text-white text-xs"></i>' : '<i class="fas fa-check text-white text-xs"></i>';

    try {
        await handleMarkAbsent(studentId, student.classId, !isCurrentlyAbsent);
    } catch (error) {
        button.classList.toggle('status-absent', isCurrentlyAbsent);
        button.classList.toggle('status-present', !isCurrentlyAbsent);
        button.classList.toggle('bg-red-500', isCurrentlyAbsent);
        button.classList.toggle('bg-green-500', !isCurrentlyAbsent);
        button.innerHTML = isCurrentlyAbsent ? '<i class="fas fa-times text-white text-xs"></i>' : '<i class="fas fa-check text-white text-xs"></i>';
        showToast('Failed to update attendance.', 'error');
    }
}
