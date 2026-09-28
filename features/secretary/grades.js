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
            <div class="grades-footer">
                <button type="button" class="office-btn office-btn--quiet" data-secretary-tab-link="admin" data-secretary-admin-subtab="grading">
                    <i class="fas fa-sliders" aria-hidden="true"></i> Change how grades work
                </button>
            </div>
        </article>
    `;
}
