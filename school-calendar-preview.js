// School calendar preview: the real Quest Calendar, Home rest scenes, Planner glance and School
// Office panel with sample classes, no Firebase.
// /school-calendar-preview.html?view=calendar|scenes|office|breaks[&month=2026-10][&mobile=1][&city=Thessaloniki]
import * as state from './state.js';
import { calendarTabHTML } from './templates/app/tabs/calendar.js';
import { renderCalendarTab } from './ui/tabs/selectors.js';
import { resolveScheduleEmptyState } from './utils/scheduleEmptyState.js';
import { buildScheduleEmptySceneHtml, buildScheduleDayNoteHtml } from './utils/scheduleEmptyScene.js';
import { treasureItemsOn } from './features/dayTreasureDays.js';

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
if (params.has('sample')) classes.push(
    { id: 'c5', name: 'The A-Hey Class', logo: '🍿', scheduleDays: ['4'], timeStart: '18:00', timeEnd: '20:00', questLevel: 'A' },
    { id: 'c6', name: 'The C Seekers', logo: '🍎', scheduleDays: ['4'], timeStart: '18:00', timeEnd: '20:00', questLevel: 'C' },
    { id: 'c7', name: 'The Jay-Bees', logo: '🐝', scheduleDays: ['4'], timeStart: '18:00', timeEnd: '19:30', questLevel: 'Junior B' },
);
state.set('allSchoolClasses', classes);
state.set('allTeachersClasses', classes);
state.set('allScheduleOverrides', []);
state.set('allQuestEvents', []);
state.set('allQuestAssignments', []);
state.set('schoolYearState', { activeYearKey: '2026-2027' });
state.set('allAwardLogs', params.has('sample') ? [
    { date: '05-10-2026', classId: 'c1', stars: 6, schoolYearKey: '2026-2027' }, { date: '05-10-2026', classId: 'c3', stars: 4, schoolYearKey: '2026-2027' },
    { date: '07-10-2026', classId: 'c4', stars: 9, schoolYearKey: '2026-2027' }, { date: '13-10-2026', classId: 'c2', stars: 5, schoolYearKey: '2026-2027' },
    { date: '21-10-2026', classId: 'c4', stars: 3, schoolYearKey: '2026-2027' },
    ...['Alexa Papa', 'Antonis Dragatis', 'Daniel Dorizas', 'Eleana Rakiplari'].map((name, i) => ({ id: `l${i}`, date: '28-10-2026', classId: 'c4', studentId: `ps${i}`, stars: 0.5, reason: 'story_weaver', teacherId: 'me', createdBy: { name: 'Mr. Nasos' }, schoolYearKey: '2026-2027' })),
] : []);
if (params.has('sample')) state.set('allStudents', ['Alexa Papa', 'Antonis Dragatis', 'Daniel Dorizas', 'Eleana Rakiplari'].map((name, i) => ({ id: `ps${i}`, name, classId: 'c4' })));
if (params.has('sample')) {
    state.set('allQuestEvents', [{ id: 'e1', dateKey: '2026-10-07', type: 'double_star_day' }, { id: 'e2', dateKey: '2026-10-30', type: 'reason_bonus_day' }]);
    state.set('allQuestAssignments', [{ id: 'q1', classId: 'c1', testData: { date: '2026-10-19', title: 'Unit 2 test' } }]);
}
if (params.has('halloween')) {
    // A school-wide Halloween treasure (Saturday): it opens for the Thursday and Friday classes.
    state.set('allQuestEvents', [...state.get('allQuestEvents'), { id: 'h1', type: 'day_treasure', classId: 'c1', dateKey: '31-10-2026', status: 'scheduled', details: { title: 'The Pumpkin Hoard', icon: '🎃', dayKey: 'halloween', dayName: 'Halloween', scope: 'school' } }]);
    if (params.get('opened')) classes.forEach((c) => { if (params.get('opened').split(',').includes(c.id)) c.dayTreasures = { h1: { shares: [], total: 0 } }; });
}
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
        const treasures = params.has('halloween') ? treasureItemsOn(`${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`) : [];
        return `<div class="vibrant-card card-glass-white"><div class="schedule-list-v2">${buildScheduleDayNoteHtml(new Date(y, m - 1, d), { treasures })}</div></div>`;
    }).join('')}</div>`;
} else if (view === 'office') {
    root.innerHTML = `<div class="pv-office role-shell--secretary office-admin"><article class="role-card secretary-admin-card secretary-settings-card"><div id="school-calendar-panel" class="office-cal"></div></article></div>`;
    import('./features/secretary/schoolCalendarPanel.js').then((m) => m.renderSchoolCalendarPanel());
} else if (view === 'breaks') {
    // ?view=breaks&ranges=[...]&start=2026-12-21&end=2027-01-08&type=christmas
    const m = await import('./features/secretary/schoolCalendarPanel.js');
    root.innerHTML = `<div class="pv-office role-shell--secretary office-admin"><article class="role-card secretary-admin-card secretary-settings-card">
        <h4 class="office-cal-subtitle">Your own breaks <small>Only what your school does differently. They use the same looks as the calendar and win where they overlap it.</small></h4>
        <div class="office-holiday-form">
            <label class="role-field office-holiday-form__name"><span>Break name</span><input type="text" id="holiday-name" placeholder="e.g. School break"></label>
            <label class="role-field"><span>First day off</span><input type="date" id="holiday-start" value="${params.get('start') || ''}"></label>
            <label class="role-field"><span>Last day off</span><input type="date" id="holiday-end" value="${params.get('end') || ''}"></label>
            <fieldset class="office-break-looks"><legend>Look</legend>${m.renderBreakLookPicker(params.get('type') || 'generic')}</fieldset>
            <p id="holiday-preview" class="office-break-preview" hidden></p>
            <button type="button" id="add-holiday-btn" class="role-btn-primary office-holiday-form__add"><i class="fas fa-plus-circle"></i> Add school break</button>
        </div>
        <div id="holiday-list" class="office-holiday-list"></div></article></div>`;
    m.updateOwnBreakPreview();
    m.renderOwnBreaksList();
}
if (view === 'pills') {
    // ?view=pills&sample=1&halloween=1 : the Home reminder chips
    const { getReminderPills } = await import('./features/home.js');
    root.innerHTML = `<div id="home-reminders-container" style="display:flex;flex-wrap:wrap;gap:.6rem;padding:2rem">${getReminderPills(params.get('class') || null)}</div>`;
}
if (view === 'planner' || view === 'log') {
    // ?view=planner&date=26-11-2026[&tab=event]  ·  ?view=log&date=31-10-2026
    const { plannerModalHTML } = await import('./templates/modals/planner.js');
    const { classModalsHTML } = await import('./templates/modals/class.js');
    document.body.insertAdjacentHTML('beforeend', plannerModalHTML + classModalsHTML);
    const date = params.get('date') || '26-11-2026';
    if (view === 'planner') {
        const m = await import('./ui/modals/planner.js');
        m.openDayPlannerModal(date, null, { tab: params.get('tab') || 'schedule' });
    } else {
        const m = await import('./ui/modals/log.js');
        await m.showLogbookModal(date);
    }
}
if (view === 'treasure' && params.has('halloween')) {
    // ?view=treasure&sample=1&halloween=1 : the school-wide Pumpkin Hoard as a Thursday teacher sees it
    const names = ['Eleni', 'Nikos', 'Maria', 'Giorgos', 'Sofia', 'Dimitris', 'Katerina', 'Yannis'];
    state.set('allStudents', names.map((name, i) => ({ id: `hs${i}`, name, classId: 'c5' })));
    const m = await import('./features/dayTreasure.js');
    await m.openDayTreasure('h1');
} else if (view === 'treasure') {
    // ?view=treasure&sample=1 : replays a sample Harvest Chest (no saving)
    const { rollDayTreasure } = await import('./features/dayTreasureCore.mjs');
    const names = ['Eleni', 'Nikos', 'Maria', 'Giorgos', 'Sofia', 'Dimitris', 'Katerina', 'Yannis', 'Anna', 'Petros', 'Zoe', 'Alexandros'];
    const students = names.map((name, i) => ({ id: `st${i}`, name, classId: 'c5' }));
    state.set('allStudents', students);
    const shares = rollDayTreasure(students.map((s) => s.id), params.get('seed') || 'demo-7');
    const cls = classes.find((c) => c.id === 'c5') || classes[0];
    cls.dayTreasures = { t1: { shares, total: shares.reduce((n, s) => n + s.gold, 0), name: 'The Harvest Chest' } };
    state.set('allSchoolClasses', classes);
    state.set('allQuestEvents', [{ id: 't1', type: 'day_treasure', classId: cls.id, dateKey: '26-11-2026', status: 'completed', details: { title: 'The Harvest Chest', icon: '🦃' } }]);
    const m = await import('./features/dayTreasure.js');
    await m.openDayTreasure('t1');
}
