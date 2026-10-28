// School calendar preview: the real Quest Calendar, Home rest scenes, Planner glance and School
// Office panel with sample classes, no Firebase.
// /school-calendar-preview.html?view=calendar|scenes|office[&month=2026-10][&mobile=1][&city=Thessaloniki]
import * as state from './state.js';
import { calendarTabHTML } from './templates/app/tabs/calendar.js';
import { renderCalendarTab } from './ui/tabs/selectors.js';
import { resolveScheduleEmptyState } from './utils/scheduleEmptyState.js';
import { buildScheduleEmptySceneHtml, buildScheduleDayNoteHtml } from './utils/scheduleEmptyScene.js';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'calendar';
const root = document.getElementById('pv-root');
if (params.has('mobile')) {
    document.body.classList.add('gcq-mobile');
    await import('./mobile/styles/mobile.css');
}

const classes = [
    { id: 'c1', name: 'Junior A Owls', logo: '🦉', scheduleDays: ['1', '3'], timeStart: '17:00', timeEnd: '18:30', questLevel: 'Junior A' },
    { id: 'c2', name: 'B Dragons', logo: '🐉', scheduleDays: ['2', '4'], timeStart: '18:30', timeEnd: '20:00', questLevel: 'B' },
    { id: 'c3', name: 'Pre-Junior Bees', logo: '🐝', scheduleDays: ['1', '5'], timeStart: '16:00', timeEnd: '17:00', questLevel: 'Pre-Junior' },
    { id: 'c4', name: 'D Phoenix', logo: '🔥', scheduleDays: ['3', '5'], timeStart: '19:00', timeEnd: '20:30', questLevel: 'D' },
];
state.set('allSchoolClasses', classes);
state.set('allTeachersClasses', classes);
state.set('allScheduleOverrides', []);
state.set('allQuestEvents', []);
state.set('allQuestAssignments', []);
state.set('allAwardLogs', []);
if (params.get('city')) state.setSchoolWeatherLocation({ name: params.get('city'), latitude: 0, longitude: 0 });
state.setSchoolHolidayRanges(JSON.parse(params.get('ranges') || '[]'));

if (view === 'calendar') {
    root.innerHTML = calendarTabHTML;
    const [y, m, d] = (params.get('month') || '2026-10').split('-').map(Number);
    state.set('calendarCurrentDate', new Date(y, m - 1, d || 1));
    renderCalendarTab();
} else if (view === 'scenes') {
    const dates = (params.get('dates') || '2026-10-28,2026-11-17,2026-12-25,2027-01-06,2027-03-15,2027-03-25,2027-04-30,2027-05-01,2027-06-21,2026-10-26').split(',');
    root.innerHTML = `<div class="pv-scenes">${dates.map((iso) => {
        const [y, m, d] = iso.split('-').map(Number);
        const empty = resolveScheduleEmptyState({ date: new Date(y, m - 1, d), allSchoolClasses: classes, schoolHolidayRanges: state.get('schoolHolidayRanges') });
        return `<div class="vibrant-card card-glass-white"><div class="schedule-list-v2">${buildScheduleEmptySceneHtml(empty, { compact: params.has('mobile') })}</div></div>`;
    }).join('')}
    ${(params.get('notes') || '2027-01-30,2026-12-23,2027-01-04,2026-10-31').split(',').map((iso) => {
        const [y, m, d] = iso.split('-').map(Number);
        return `<div class="vibrant-card card-glass-white"><div class="schedule-list-v2">${buildScheduleDayNoteHtml(new Date(y, m - 1, d))}</div></div>`;
    }).join('')}</div>`;
} else if (view === 'office') {
    root.innerHTML = `<div class="pv-office role-shell--secretary office-admin"><article class="role-card secretary-admin-card secretary-settings-card"><div id="school-calendar-panel" class="office-cal"></div></article></div>`;
    import('./features/secretary/schoolCalendarPanel.js').then((m) => m.renderSchoolCalendarPanel());
}
