import { renderOfficeSign } from './signs.js';
import { GRADES_PAGE_SIZE, renderGradesBoard } from './gradesBoard.js';

export { GRADES_PAGE_SIZE };

export function renderSecretaryGrades() {
    return `
        ${renderOfficeSign({
            variant: 'grades',
            kicker: 'School report',
            title: 'Grades',
            tagline: "Scholar's Scroll scores and Quest Assignment, school-wide."
        })}
        <article class="role-card grades-board">
            ${renderGradesBoard()}
            <div class="mt-3 text-center">
                <button type="button" class="role-inline-link" data-secretary-tab-link="admin" data-secretary-admin-subtab="grading">Edit grading setup</button>
            </div>
        </article>
    `;
}
