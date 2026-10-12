// Settings → Quiz with the real page code and sample classes, no sign-in.
// /quiz-plan-preview.html?class=b|junior|none
import { optionsTabHTML } from './templates/app/tabs/options.js';
import * as state from './state.js';
import { applySubscriptionPreview } from './utils/subscription.js';

const params = new URLSearchParams(location.search);
applySubscriptionPreview({ tier: 'elite' });
document.getElementById('host').innerHTML = optionsTabHTML;
const tab = document.getElementById('options-tab');
tab.classList.remove('hidden');
tab.querySelectorAll('[data-options-section]').forEach((section) => section.classList.toggle('hidden', section.dataset.optionsSection !== 'quiz'));

const classes = {
    b: { id: 'c-b', name: 'B Wizards', logo: '🧙', questLevel: 'B', scheduleDays: [1, 3], timeStart: '17:00', timeEnd: '18:30', bookPlan: { currentBookId: 'primary-path-2', unit: 3 } },
    junior: { id: 'c-j', name: 'Junior Owls', logo: '🦉', questLevel: 'Junior B', scheduleDays: [2, 4], timeStart: '16:00', timeEnd: '17:00', bookPlan: { currentBookId: 'yeti-2', unit: 4 } },
    none: { id: 'c-n', name: 'C Comets', logo: '☄️', questLevel: 'C', scheduleDays: [5], timeStart: '18:00', timeEnd: '19:30', bookPlan: {} }
};
const chosen = classes[params.get('class') || 'b'] || classes.b;
state.setAllTeachersClasses([chosen]);
state.setAllSchoolClasses([chosen]);
state.setAllStudents(Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, classId: chosen.id, name: `Hero ${i + 1}` })));
state.set('globalSelectedClassId', chosen.id);

const { renderQuizOptionsUi } = await import('./ui/tabs/quizSetup.js');
await renderQuizOptionsUi();
const go = params.get('source');
if (go) document.querySelector(`.qwk-source__tab[data-source="${go}"]`)?.click();
