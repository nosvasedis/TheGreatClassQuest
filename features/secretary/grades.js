import { renderTabHero } from '../roles/shared.js';
import { GRADES_PAGE_SIZE, renderGradesBoard } from './gradesBoard.js';

export { GRADES_PAGE_SIZE };

export function renderSecretaryGrades() {
    return `
        ${renderTabHero({
            icon: 'fa-scroll',
            iconColor: 'text-amber-500',
            title: 'Grades',
            subtitle: "Scholar's Scroll scores and Quest Assignment, school-wide."
        })}
        <article class="role-card grades-board">
            ${renderGradesBoard()}
            <div class="mt-3 text-center">
                <button type="button" class="role-inline-link" data-secretary-tab-link="admin" data-secretary-admin-subtab="grading">Edit grading setup</button>
            </div>
        </article>
    `;
}
