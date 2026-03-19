// /ui/modals/attendance.js
import * as state from '../../state.js';
import * as utils from '../../utils.js';
import * as constants from '../../constants.js';
import { showAnimatedModal, showModal } from './base.js';
import { showToast } from '../effects.js';
import { playSound } from '../../audio.js';
import { fetchAttendanceForMonth } from '../../db/queries.js';
import { handleMarkAbsent } from '../../db/actions.js';
import { canUseFeature } from '../../utils/subscription.js';
import { showUpgradePrompt } from '../../utils/upgradePrompt.js';
import { getUpgradeMessage } from '../../config/tiers/features.js';

// --- REVAMPED ATTENDANCE CHRONICLE MODAL ---

let attendanceChronicleRefreshTimer = null;

function getAttendanceChronicleModal() {
    return document.getElementById('attendance-chronicle-modal');
}

function getAttendanceViewMonthKey(date = state.get('attendanceViewDate')) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function syncAttendanceChronicleModalState(classId, isEditableMonth) {
    const modal = getAttendanceChronicleModal();
    if (!modal) return;
    modal.dataset.classId = classId || '';
    modal.dataset.viewMonthKey = getAttendanceViewMonthKey();
    modal.dataset.isLiveMonth = isEditableMonth ? 'true' : 'false';
}

export function isLiveAttendanceChronicleOpen() {
    const modal = getAttendanceChronicleModal();
    return Boolean(
        modal &&
        !modal.classList.contains('hidden') &&
        modal.dataset.isLiveMonth === 'true' &&
        modal.dataset.classId
    );
}

export function scheduleAttendanceChronicleRefresh() {
    if (!isLiveAttendanceChronicleOpen()) return;
    const modal = getAttendanceChronicleModal();
    const classId = modal?.dataset.classId;
    if (!classId) return;

    if (attendanceChronicleRefreshTimer) {
        window.clearTimeout(attendanceChronicleRefreshTimer);
    }

    attendanceChronicleRefreshTimer = window.setTimeout(() => {
        attendanceChronicleRefreshTimer = null;
        renderAttendanceChronicle(classId).catch((error) => {
            console.warn('Could not refresh Attendance Chronicle live view:', error);
        });
    }, 90);
}

export async function openAttendanceChronicle() {
    if (!canUseFeature('advancedAttendance')) {
        showUpgradePrompt('Pro', { message: getUpgradeMessage('Pro', 'advancedAttendance') });
        return;
    }
    const classId = document.getElementById('adventure-log-class-select').value;
    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;

    // Reset view date to current month on open
    state.setAttendanceViewDate(new Date());

    document.getElementById('attendance-chronicle-title').innerHTML = `${classData.logo} Attendance Chronicle`;
    document.getElementById('attendance-chronicle-content').innerHTML = `<p class="text-center py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading attendance records...</p>`;
    showAnimatedModal('attendance-chronicle-modal');
    syncAttendanceChronicleModalState(classId, true);

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
    const now = new Date();
    const isCurrentMonthView = currentYear === now.getFullYear() && currentMonth === now.getMonth();
    const isEditableMonth = isCurrentMonthView;
    syncAttendanceChronicleModalState(classId, isEditableMonth);
    
    if (isEditableMonth) {
        // Use real-time state
        attendanceRecords = state.get('allAttendanceRecords').filter(r => r.classId === classId);
    } else {
        // Fetch on demand
        contentEl.innerHTML = `<div class="text-center py-8 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Fetching historical data for ${monthName}...</div>`;
        attendanceRecords = await fetchAttendanceForMonth(classId, currentYear, currentMonth + 1);
    }

    // 3. Filter lesson dates for this specific month
    const lessonDates = [];
    const allScheduleOverrides = state.get('allScheduleOverrides') || [];
    const schoolHolidayRanges = state.get('schoolHolidayRanges') || [];

    // Generate all real lesson dates in the month using the shared lesson helper
    let loopDate = new Date(currentYear, currentMonth, 1);

    while (loopDate.getMonth() === currentMonth) {
        if (loopDate <= new Date() && utils.doesClassMeetOnDate(classId, loopDate, state.get('allSchoolClasses'), allScheduleOverrides, schoolHolidayRanges)) {
            lessonDates.push(utils.getDDMMYYYY(loopDate));
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

        const attendanceByDate = attendanceRecords.reduce((acc, record) => {
            acc[record.date] = (acc[record.date] || 0) + 1;
            return acc;
        }, {});

        const studentSummaries = studentsInClass.map((student) => {
            const absenceCount = attendanceByStudent[student.id]?.size || 0;
            const presentCount = Math.max(0, lessonDates.length - absenceCount);
            const attendanceRate = lessonDates.length > 0 ? ((presentCount / lessonDates.length) * 100).toFixed(0) : '100';
            return {
                studentId: student.id,
                absenceCount,
                presentCount,
                attendanceRate
            };
        });

        const totalPossible = studentsInClass.length * lessonDates.length;
        const totalAbsences = studentSummaries.reduce((sum, student) => sum + student.absenceCount, 0);
        const attendanceRate = totalPossible > 0 ? ((totalPossible - totalAbsences) / totalPossible * 100).toFixed(1) : '100.0';
        const perfectAttendees = studentSummaries.filter((student) => student.absenceCount === 0).length;

        html += `
            <div class="attendance-chronicle-summary-grid">
                <div class="attendance-summary-card attendance-summary-card--emerald">
                    <div class="attendance-summary-label">Monthly Attendance</div>
                    <div class="attendance-summary-value">${attendanceRate}%</div>
                    <div class="attendance-summary-meta">${studentsInClass.length} students tracked</div>
                </div>
                <div class="attendance-summary-card attendance-summary-card--blue">
                    <div class="attendance-summary-label">Lessons Held</div>
                    <div class="attendance-summary-value">${lessonDates.length}</div>
                    <div class="attendance-summary-meta">Includes one-off lesson dates</div>
                </div>
                <div class="attendance-summary-card attendance-summary-card--rose">
                    <div class="attendance-summary-label">Total Absences</div>
                    <div class="attendance-summary-value">${totalAbsences}</div>
                    <div class="attendance-summary-meta">Across all students this month</div>
                </div>
                <div class="attendance-summary-card attendance-summary-card--amber">
                    <div class="attendance-summary-label">Perfect Attendees</div>
                    <div class="attendance-summary-value">${perfectAttendees}</div>
                    <div class="attendance-summary-meta">No absences this month</div>
                </div>
            </div>
            <div class="attendance-chronicle-toolbar">
                <div class="attendance-chronicle-legend">
                    <span class="attendance-legend-pill attendance-legend-pill--present"><i class="fas fa-check"></i> Present</span>
                    <span class="attendance-legend-pill attendance-legend-pill--absent"><i class="fas fa-times"></i> Absent</span>
                </div>
                <div class="attendance-chronicle-mode ${isEditableMonth ? 'is-live' : 'is-readonly'}">
                    ${isEditableMonth ? '<i class="fas fa-pen"></i> Live month: tap to edit attendance' : '<i class="fas fa-lock"></i> Archive view: attendance is read-only'}
                </div>
            </div>
        `;

        html += `<div class="attendance-chronicle-table-wrap"><table class="attendance-chronicle-table"><thead><tr>
            <th class="attendance-student-col">Student</th>`;
        
        lessonDates.forEach(dateStr => {
            const d = utils.parseDDMMYYYY(dateStr);
            const absentCount = attendanceByDate[dateStr] || 0;
            html += `<th class="attendance-date-col">
                <div class="attendance-date-chip">
                    <span class="attendance-date-chip-day">${d.getDate()}</span>
                    <span class="attendance-date-chip-weekday">${d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                    <span class="attendance-date-chip-meta">${absentCount} absent</span>
                    <button class="delete-column-btn" data-date="${dateStr}" data-class-id="${classId}" title="Remove this day (Holiday/Cancelled)" ${!isEditableMonth ? 'disabled' : ''}>
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </th>`;
        });
        html += `<th class="attendance-summary-col">Absences</th><th class="attendance-summary-col">Attendance %</th></tr></thead><tbody>`;

        studentsInClass.forEach((student, index) => {
            const rowSummary = studentSummaries.find((item) => item.studentId === student.id) || { absenceCount: 0, attendanceRate: '100' };
            const avatarHtml = student.avatar
                ? `<img src="${student.avatar}" alt="${student.name}" class="attendance-student-avatar">`
                : `<div class="attendance-student-avatar attendance-student-avatar--placeholder">${student.name.charAt(0).toUpperCase()}</div>`;

            html += `<tr class="attendance-row ${index % 2 === 0 ? 'attendance-row--even' : 'attendance-row--odd'}">
                <td class="attendance-student-col attendance-student-cell">
                    <div class="attendance-student-meta">
                        ${avatarHtml}
                        <div>
                            <div class="attendance-student-name">${student.name}</div>
                            <div class="attendance-student-subtitle">${rowSummary.presentCount} present lessons</div>
                        </div>
                    </div>
                </td>`;
            
            lessonDates.forEach(dateStr => {
                const isAbsent = attendanceByStudent[student.id]?.has(dateStr);

                html += `<td class="attendance-status-cell">
                    <button class="attendance-status-btn ${isAbsent ? 'status-absent bg-red-500' : 'status-present bg-green-500'}" 
                            data-student-id="${student.id}" 
                            data-date="${dateStr}" 
                            ${!isEditableMonth ? 'disabled' : ''}
                            title="${isAbsent ? 'Absent' : 'Present'}">
                            ${isAbsent ? '<i class="fas fa-times text-white text-xs"></i>' : '<i class="fas fa-check text-white text-xs"></i>'}
                    </button>
                </td>`;
            });
            html += `
                <td class="attendance-summary-cell">
                    <span class="attendance-count-pill">${rowSummary.absenceCount}</span>
                </td>
                <td class="attendance-summary-cell">
                    <span class="attendance-rate-pill ${Number(rowSummary.attendanceRate) >= 90 ? 'is-strong' : ''}">${rowSummary.attendanceRate}%</span>
                </td>
            </tr>`;
        });

        html += `</tbody></table></div>`;

        contentEl.innerHTML = html;
    }

    document.getElementById('attendance-prev-btn').addEventListener('click', () => changeAttendanceMonth(-1, classId));
    document.getElementById('attendance-next-btn').addEventListener('click', () => changeAttendanceMonth(1, classId));

    // Listener for toggling attendance status (Present/Absent)
    contentEl.querySelectorAll('.attendance-status-btn:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', (e) => toggleAttendanceRecord(e.currentTarget));
    });

    // NEW: Listeners for removing columns with Holiday option
    contentEl.querySelectorAll('.delete-column-btn:not(:disabled)').forEach(btn => {
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
        await handleMarkAbsent(studentId, student.classId, !isCurrentlyAbsent, date);
    } catch (error) {
        button.classList.toggle('status-absent', isCurrentlyAbsent);
        button.classList.toggle('status-present', !isCurrentlyAbsent);
        button.classList.toggle('bg-red-500', isCurrentlyAbsent);
        button.classList.toggle('bg-green-500', !isCurrentlyAbsent);
        button.innerHTML = isCurrentlyAbsent ? '<i class="fas fa-times text-white text-xs"></i>' : '<i class="fas fa-check text-white text-xs"></i>';
        showToast('Failed to update attendance.', 'error');
    }
}
